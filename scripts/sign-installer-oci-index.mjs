#!/usr/bin/env node

// Sign the generated public package index as a blob. The index is dated from
// its committed package evidence, so rerunning the generator does not change
// the bytes unless the catalog evidence changes.

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  INSTALLER_OCI_INDEX_PATH,
  INSTALLER_PACKAGE_COSIGN_VERSION,
  INSTALLER_PACKAGE_SIGNATURE_SCHEME,
  INSTALLER_PACKAGE_SIGNER_IDENTITY,
  INSTALLER_PACKAGE_SIGNER_ISSUER,
  indexSignatureVerificationCommand,
  installerOciIndexSignaturePaths,
} from "./lib/installer-package-signatures.mjs";
import { check, relativeRepo, repoRoot, sha256, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--plan";
check(["--plan", "--sign", "--reobserve"].includes(mode), "use --plan, --sign, or --reobserve");
const paths = installerOciIndexSignaturePaths();

check(existsSync(INSTALLER_OCI_INDEX_PATH), `${relativeRepo(INSTALLER_OCI_INDEX_PATH)} is missing; run npm run installer-oci:catalog`);
const catalog = readCatalog();
const catalogText = readFileSync(INSTALLER_OCI_INDEX_PATH, "utf8");
const catalogSHA256 = sha256(catalogText);
const signedPackageCount = catalog.packages.filter((row) => row.signature_status === "signed-receipt").length;

if (mode === "--plan") {
  const state = signedPackageCount === catalog.metadata.packageCount
    ? (existsSync(paths.receiptPath) ? "signature-receipt-present" : "ready-to-sign")
    : `blocked-${signedPackageCount}-of-${catalog.metadata.packageCount}-packages-signed`;
  console.log(`${state}\t${relativeRepo(INSTALLER_OCI_INDEX_PATH)}\tsha256:${catalogSHA256}`);
  process.exit(0);
}

check(process.env.HELM_EXPT_ALLOW_INDEX_SIGNING === "1", "set HELM_EXPT_ALLOW_INDEX_SIGNING=1 to confirm the public index signature write or live re-verification");
check(signedPackageCount === catalog.metadata.packageCount, `only ${signedPackageCount}/${catalog.metadata.packageCount} packages in the index have signature receipts`);
check(commandAvailable("cosign", ["version"]), "cosign is required");
if (mode === "--sign") {
  check(process.env.SIGSTORE_ID_TOKEN || commandAvailable("gcloud", ["version"]), "gcloud is required for signing unless SIGSTORE_ID_TOKEN is supplied");
}

const cosignVersion = readCosignVersion();
check(cosignVersion === INSTALLER_PACKAGE_COSIGN_VERSION, `expected cosign ${INSTALLER_PACKAGE_COSIGN_VERSION}, found ${cosignVersion}`);
verifyPackageEvidence();
if (mode === "--sign") signIndex();
else reobserveIndex();

function signIndex() {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-index-signature-"));
  try {
    const tokenPath = join(tempRoot, "sigstore-identity-token");
    const bundlePath = join(tempRoot, "packages.sigstore.json");
    const oidcToken = identityToken();
    check(oidcToken && !/\s/.test(oidcToken), "the Sigstore identity token must not contain whitespace");
    writeFileSync(tokenPath, oidcToken, { encoding: "utf8", mode: 0o600 });
    chmodSync(tokenPath, 0o600);
    runCosign(["sign-blob", "--yes", "--identity-token", tokenPath, "--bundle", bundlePath, INSTALLER_OCI_INDEX_PATH]);
    check(existsSync(bundlePath), "cosign wrote no index signature bundle");
    const bundleText = normalizeJson(readFileSync(bundlePath, "utf8"));
    write(paths.bundlePath, bundleText);
    verifyAndRecord(bundleText);
    console.log(`signed ${relativeRepo(INSTALLER_OCI_INDEX_PATH)} at sha256:${catalogSHA256}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function reobserveIndex() {
  check(existsSync(paths.bundlePath), `${relativeRepo(paths.bundlePath)} is missing`);
  verifyAndRecord(readFileSync(paths.bundlePath, "utf8"));
  console.log(`reverified ${relativeRepo(INSTALLER_OCI_INDEX_PATH)} at sha256:${catalogSHA256}`);
}

function verifyAndRecord(bundleText) {
  const output = runCosign([
    "verify-blob",
    "--bundle", paths.bundlePath,
    "--certificate-identity", INSTALLER_PACKAGE_SIGNER_IDENTITY,
    "--certificate-oidc-issuer", INSTALLER_PACKAGE_SIGNER_ISSUER,
    INSTALLER_OCI_INDEX_PATH,
  ]);
  const verificationText = output.endsWith("\n") ? output : `${output}\n`;
  check(/Verified OK/i.test(verificationText), "cosign did not report a successful index verification");
  write(paths.verificationPath, verificationText);
  writeYaml(paths.receiptPath, receiptFor(bundleText, verificationText));
}

function receiptFor(bundleText, verificationText) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "InstallerOciIndexSignatureReceipt",
    metadata: { name: "installer-oci-packages-index" },
    spec: {
      observedAt: new Date().toISOString(),
      subject: {
        catalogPath: relativeRepo(INSTALLER_OCI_INDEX_PATH),
        catalogSHA256,
        catalogGeneratedAt: catalog.metadata.generatedAt,
        packageCount: catalog.metadata.packageCount,
        signedPackageCount,
      },
      signature: {
        scheme: INSTALLER_PACKAGE_SIGNATURE_SCHEME,
        signerIdentity: INSTALLER_PACKAGE_SIGNER_IDENTITY,
        oidcIssuer: INSTALLER_PACKAGE_SIGNER_ISSUER,
        bundlePath: relativeRepo(paths.bundlePath),
        bundleSHA256: sha256(bundleText),
      },
      verification: {
        result: "pass",
        command: indexSignatureVerificationCommand(),
        outputPath: relativeRepo(paths.verificationPath),
        outputSHA256: sha256(verificationText),
        cosignVersion,
      },
      scope: {
        proves: [
          "the named signer signed the exact bytes of this dated package index",
          "the index listed the stated package count and package signature coverage when it was signed",
        ],
        doesNotProve: [
          "that every package is suitable for every cluster",
          "that tags or upstream chart versions published later are unchanged",
        ],
      },
    },
  };
}

function readCatalog() {
  const parsed = JSON.parse(readFileSync(INSTALLER_OCI_INDEX_PATH, "utf8"));
  check(parsed?.kind === "InstallerPackageCatalogIndex", "package index has the wrong kind");
  check(!Number.isNaN(Date.parse(parsed?.metadata?.generatedAt)), "package index has no valid generated time");
  check(Number.isInteger(parsed?.metadata?.packageCount) && parsed.metadata.packageCount > 0, "package index has no package count");
  check(Array.isArray(parsed?.packages) && parsed.packages.length === parsed.metadata.packageCount, "package index count differs from its rows");
  return parsed;
}

function identityToken() {
  if (process.env.SIGSTORE_ID_TOKEN) return process.env.SIGSTORE_ID_TOKEN.trim();
  return execFileSync("gcloud", [
    "auth", "print-identity-token",
    `--impersonate-service-account=${INSTALLER_PACKAGE_SIGNER_IDENTITY}`,
    "--include-email", "--audiences=sigstore",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1024 * 1024 * 8 }).trim();
}

function runCosign(args) {
  return execFileSync("cosign", args, {
    encoding: "utf8",
    env: { ...process.env, COSIGN_YES: "true" },
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 64,
  });
}

function readCosignVersion() {
  const output = execFileSync("cosign", ["version"], { encoding: "utf8" });
  return output.match(/GitVersion:\s*(\S+)/)?.[1] ?? output.trim().split("\n")[0];
}

function verifyPackageEvidence() {
  for (const mode of ["--verify", "--verify-crypto"]) {
    execFileSync(process.execPath, ["scripts/generate-installer-package-signatures.mjs", mode], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      maxBuffer: 1024 * 1024 * 64,
    });
  }
}

function normalizeJson(text) {
  return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
}

function commandAvailable(command, args) {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}
