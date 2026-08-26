#!/usr/bin/env node

// Attach Sigstore keyless signatures to the exact manifest digests recorded by
// the installer package publication receipts. The signer is a dedicated Google
// service account. Its short-lived OIDC token is written only to a private
// temporary file because putting it on the command line exposes it to process
// inspection. No signing key is created or stored by this repository.

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  INSTALLER_PACKAGE_COSIGN_VERSION,
  INSTALLER_PACKAGE_SIGNATURE_SCHEME,
  INSTALLER_PACKAGE_SIGNER_IDENTITY,
  INSTALLER_PACKAGE_SIGNER_ISSUER,
  installerPackagePublicationRecords,
  signaturePayloadVerificationCommand,
  signatureVerificationCommand,
} from "./lib/installer-package-signatures.mjs";
import { check, relativeRepo, sha256, write, writeYaml } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const mode = args[0] ?? "--plan";
const supportedModes = new Set(["--plan", "--sign", "--reobserve"]);
if (!supportedModes.has(mode)) usage();

const packageArg = valueAfter("--package");
const limitArg = valueAfter("--limit");
const limit = limitArg === undefined ? undefined : Number.parseInt(limitArg, 10);
const force = args.includes("--force");
if (args.includes("--package")) check(packageArg && !packageArg.startsWith("--"), "--package requires a value");
if (args.includes("--limit")) check(limitArg && !limitArg.startsWith("--"), "--limit requires a value");
if (limitArg !== undefined) check(Number.isInteger(limit) && limit > 0, "--limit must be a positive integer");

const records = selectRecords();
if (mode === "--plan") {
  for (const record of records) {
    const state = existsSync(record.receiptPath) ? "signed-receipt-present" : "unsigned";
    console.log(`${state}\t${record.packagePath}\t${record.immutableReference}`);
  }
  console.log(`${records.length} package(s) selected`);
  process.exit(0);
}

check(
  process.env.HELM_EXPT_ALLOW_REGISTRY_SIGNING === "1",
  "set HELM_EXPT_ALLOW_REGISTRY_SIGNING=1 to confirm registry signature writes or live re-verification",
);
check(commandAvailable("cosign", ["version"]), "cosign is required");
if (mode === "--sign") {
  check(
    (process.env.SIGSTORE_ID_TOKEN && process.env.HELM_EXPT_REGISTRY_ACCESS_TOKEN)
      || commandAvailable("gcloud", ["version"]),
    "gcloud is required for signing unless both short-lived tokens are supplied",
  );
}

const cosignVersion = readCosignVersion();
check(cosignVersion === INSTALLER_PACKAGE_COSIGN_VERSION, `expected cosign ${INSTALLER_PACKAGE_COSIGN_VERSION}, found ${cosignVersion}`);
let changed = 0;
for (const record of records) {
  if (mode === "--sign" && existsSync(record.receiptPath) && !force) {
    console.log(`kept existing signature receipt ${relativeRepo(record.receiptPath)}`);
    continue;
  }
  if (mode === "--reobserve") {
    check(existsSync(record.receiptPath), `${record.packagePath}: no signature receipt to reobserve`);
    check(existsSync(record.bundlePath), `${record.packagePath}: no committed Sigstore bundle to reobserve`);
    check(existsSync(record.payloadPath), `${record.packagePath}: no committed signed payload to reobserve`);
    const bundleText = readFileSync(record.bundlePath, "utf8");
    const payloadText = readFileSync(record.payloadPath, "utf8");
    withAnonymousDockerConfig((extraEnv) => {
      verifyAndRecord(record, cosignVersion, bundleText, payloadText, verifyPayload(record), extraEnv);
    });
  } else {
    signAndRecord(record, cosignVersion);
  }
  changed += 1;
}
console.log(`${mode === "--sign" ? "signed" : "reverified"} ${changed} package(s)`);

function signAndRecord(record, cosignVersion) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-package-signature-"));
  try {
    const tokenPath = join(tempRoot, "sigstore-identity-token");
    const dockerConfigPath = join(tempRoot, "config.json");
    const bundlePath = join(tempRoot, "signature.sigstore.json");
    writeFileSync(tokenPath, identityToken(), { encoding: "utf8", mode: 0o600 });
    chmodSync(tokenPath, 0o600);
    writeFileSync(dockerConfigPath, registryDockerConfig(registryAccessToken()), { encoding: "utf8", mode: 0o600 });
    chmodSync(dockerConfigPath, 0o600);
    runCosign([
      "sign",
      "--yes",
      "--identity-token",
      tokenPath,
      "--bundle",
      bundlePath,
      "--annotations",
      `confighub.com/package-path=${record.packagePath}`,
      "--annotations",
      `confighub.com/package-sha256=${record.packageSHA256}`,
      record.immutableReference,
    ], { DOCKER_CONFIG: tempRoot });
    check(existsSync(bundlePath), `${record.packagePath}: cosign wrote no verification bundle`);
    const bundleText = normalizeJson(readFileSync(bundlePath, "utf8"));
    write(record.bundlePath, bundleText);
    // Prove the consumer path after the write. From this point onward Cosign
    // sees an empty private Docker config, not the signer's registry token.
    writeFileSync(dockerConfigPath, `${JSON.stringify({ auths: {} }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    const payloadText = downloadSignedPayload(record, bundleText, { DOCKER_CONFIG: tempRoot });
    write(record.payloadPath, payloadText);
    verifyAndRecord(record, cosignVersion, bundleText, payloadText, verifyPayload(record), { DOCKER_CONFIG: tempRoot });
    console.log(`signed ${record.packagePath}\n  ${record.immutableReference}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyAndRecord(record, cosignVersion, bundleText, payloadText, payloadVerificationText, extraEnv = {}) {
  const verificationText = runCosign([
    "verify",
    "--certificate-identity",
    INSTALLER_PACKAGE_SIGNER_IDENTITY,
    "--certificate-oidc-issuer",
    INSTALLER_PACKAGE_SIGNER_ISSUER,
    "--annotations",
    `confighub.com/package-path=${record.packagePath}`,
    "--annotations",
    `confighub.com/package-sha256=${record.packageSHA256}`,
    "--output",
    "json",
    record.immutableReference,
  ], extraEnv);
  const normalizedVerification = normalizeJson(verificationText);
  write(record.verificationPath, normalizedVerification);
  write(record.payloadVerificationPath, payloadVerificationText);
  writeYaml(record.receiptPath, receiptFor(
    record,
    cosignVersion,
    bundleText,
    payloadText,
    normalizedVerification,
    payloadVerificationText,
  ));
}

function receiptFor(record, cosignVersion, bundleText, payloadText, verificationText, payloadVerificationText) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "InstallerPackageSignatureReceipt",
    metadata: { name: record.name },
    spec: {
      observedAt: new Date().toISOString(),
      subject: {
        packagePath: record.packagePath,
        publicationReceipt: record.publicationReceipt,
        tagReference: record.tagReference,
        manifestDigest: record.manifestDigest,
        immutableReference: record.immutableReference,
        packageSHA256: record.packageSHA256,
        layerDigest: record.layerDigest,
      },
      signature: {
        scheme: INSTALLER_PACKAGE_SIGNATURE_SCHEME,
        signerIdentity: INSTALLER_PACKAGE_SIGNER_IDENTITY,
        oidcIssuer: INSTALLER_PACKAGE_SIGNER_ISSUER,
        bundlePath: relativeRepo(record.bundlePath),
        bundleSHA256: sha256(bundleText),
        payloadPath: relativeRepo(record.payloadPath),
        payloadSHA256: sha256(payloadText),
        registryAttached: true,
        registryAnonymousRead: true,
      },
      verification: {
        result: "pass",
        command: signatureVerificationCommand(record),
        outputPath: relativeRepo(record.verificationPath),
        outputSHA256: sha256(verificationText),
        payloadCommand: signaturePayloadVerificationCommand(record),
        payloadOutputPath: relativeRepo(record.payloadVerificationPath),
        payloadOutputSHA256: sha256(payloadVerificationText),
        cosignVersion,
      },
      annotations: {
        "confighub.com/package-path": record.packagePath,
        "confighub.com/package-sha256": record.packageSHA256,
      },
      scope: {
        proves: [
          "the named signer signed the exact OCI manifest digest",
          "the signature covers the package path and package SHA-256 annotations",
          "the public registry served the signature without credentials when this receipt was written",
        ],
        doesNotProve: [
          "that the selected configuration is suitable for a particular cluster",
          "that hooks, CRDs, Secrets, or other lifecycle work will succeed",
          "that a later package published under the same tag has the same digest",
        ],
      },
    },
  };
}

function downloadSignedPayload(record, bundleText, extraEnv = {}) {
  const bundle = JSON.parse(bundleText);
  const bundleSignature = String(bundle?.messageSignature?.signature ?? bundle?.dsseEnvelope?.signatures?.[0]?.sig ?? "");
  check(bundleSignature, `${record.packagePath}: Sigstore bundle carries no signature`);
  const output = runCosign(["download", "signature", record.immutableReference], extraEnv);
  const entries = parseDownloadedSignatures(output);
  const matched = entries.find((entry) => String(entry.Base64Signature ?? entry.base64Signature ?? "") === bundleSignature);
  check(matched, `${record.packagePath}: registry signature payload does not match the new Sigstore bundle`);
  const encoded = String(matched.Payload ?? matched.payload ?? "");
  check(encoded, `${record.packagePath}: registry signature has no payload`);
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch (error) {
    throw new Error(`${record.packagePath}: cannot decode the signed image payload: ${error.message}`);
  }
  validateSignedPayload(record, payload);
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function parseDownloadedSignatures(text) {
  const trimmed = text.trim();
  check(trimmed, "cosign download signature returned no signatures");
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  }
}

function validateSignedPayload(record, payload) {
  const critical = valueIgnoreCase(payload, "critical");
  const image = valueIgnoreCase(critical, "image");
  const manifestDigest = valueIgnoreCase(image, "docker-manifest-digest");
  const optional = valueIgnoreCase(payload, "optional");
  check(manifestDigest === record.manifestDigest, `${record.packagePath}: signed payload has the wrong manifest digest`);
  check(optional?.["confighub.com/package-path"] === record.packagePath, `${record.packagePath}: signed payload has the wrong package-path annotation`);
  check(optional?.["confighub.com/package-sha256"] === record.packageSHA256, `${record.packagePath}: signed payload has the wrong package-sha256 annotation`);
}

function valueIgnoreCase(object, name) {
  if (!object || typeof object !== "object") return undefined;
  const key = Object.keys(object).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : object[key];
}

function verifyPayload(record) {
  const output = runCosign([
    "verify-blob",
    "--bundle", record.bundlePath,
    "--certificate-identity", INSTALLER_PACKAGE_SIGNER_IDENTITY,
    "--certificate-oidc-issuer", INSTALLER_PACKAGE_SIGNER_ISSUER,
    record.payloadPath,
  ]);
  check(/Verified OK/i.test(output), `${record.packagePath}: cosign did not verify the committed package payload`);
  return output.endsWith("\n") ? output : `${output}\n`;
}

function identityToken() {
  if (process.env.SIGSTORE_ID_TOKEN) return `${process.env.SIGSTORE_ID_TOKEN.trim()}\n`;
  if (identityToken.cached) return identityToken.cached;
  identityToken.cached = execFileSync(
    "gcloud",
    [
      "auth",
      "print-identity-token",
      `--impersonate-service-account=${INSTALLER_PACKAGE_SIGNER_IDENTITY}`,
      "--include-email",
      "--audiences=sigstore",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1024 * 1024 * 8 },
  );
  return identityToken.cached;
}

function registryAccessToken() {
  if (process.env.HELM_EXPT_REGISTRY_ACCESS_TOKEN) return process.env.HELM_EXPT_REGISTRY_ACCESS_TOKEN.trim();
  if (registryAccessToken.cached) return registryAccessToken.cached;
  registryAccessToken.cached = execFileSync(
    "gcloud",
    ["auth", "print-access-token", `--impersonate-service-account=${INSTALLER_PACKAGE_SIGNER_IDENTITY}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1024 * 1024 * 8 },
  ).trim();
  return registryAccessToken.cached;
}

function registryDockerConfig(accessToken) {
  check(accessToken, "gcloud returned an empty registry access token");
  const auth = Buffer.from(`oauth2accesstoken:${accessToken}`).toString("base64");
  return `${JSON.stringify({ auths: { "europe-west1-docker.pkg.dev": { auth } } }, null, 2)}\n`;
}

function withAnonymousDockerConfig(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-package-public-read-"));
  try {
    const dockerConfigPath = join(tempRoot, "config.json");
    writeFileSync(dockerConfigPath, `${JSON.stringify({ auths: {} }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    chmodSync(dockerConfigPath, 0o600);
    return fn({ DOCKER_CONFIG: tempRoot });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runCosign(commandArgs, extraEnv = {}) {
  return execFileSync("cosign", commandArgs, {
    encoding: "utf8",
    env: { ...process.env, ...extraEnv, COSIGN_YES: "true" },
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 64,
  });
}

function readCosignVersion() {
  const output = execFileSync("cosign", ["version"], { encoding: "utf8" });
  return output.match(/GitVersion:\s*(\S+)/)?.[1] ?? output.trim().split("\n")[0];
}

function normalizeJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`cosign returned invalid JSON: ${error.message}`);
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function selectRecords() {
  let selected = installerPackagePublicationRecords();
  if (packageArg) {
    const normalized = packageArg.replaceAll("\\", "/").replace(/\/+$/, "");
    selected = selected.filter((record) => record.packagePath === normalized);
    check(selected.length === 1, `no publication receipt matches ${normalized}`);
  }
  if (limit !== undefined) selected = selected.slice(0, limit);
  return selected;
}

function commandAvailable(command, commandArgs) {
  return spawnSync(command, commandArgs, { stdio: "ignore" }).status === 0;
}

function valueAfter(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  console.error(`Usage:
  node scripts/sign-installer-oci-packages.mjs --plan [--package packages/<repo>/<chart>/<version>] [--limit N]
  HELM_EXPT_ALLOW_REGISTRY_SIGNING=1 node scripts/sign-installer-oci-packages.mjs --sign [--package ...] [--limit N] [--force]
  HELM_EXPT_ALLOW_REGISTRY_SIGNING=1 node scripts/sign-installer-oci-packages.mjs --reobserve [--package ...] [--limit N]`);
  process.exit(2);
}
