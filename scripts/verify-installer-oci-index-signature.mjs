#!/usr/bin/env node

// Verify the committed binding between the public package index, its Sigstore
// bundle, and the successful live cosign verification record.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  readJson,
} from "./lib/installer-package-signatures.mjs";
import { check, readYaml, relativeRepo, repoRoot, sha256 } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--verify", "--self-test", "--verify-crypto", "--crypto-self-test"].includes(mode), "use --verify, --self-test, --verify-crypto, or --crypto-self-test");
const paths = installerOciIndexSignaturePaths();
if (mode === "--self-test") {
  selfTest();
  console.log("verified installer OCI index signature checks against fake surfaces");
  process.exit(0);
}

const schemaPath = join(repoRoot, "schemas", "installer-oci-index-signature-receipt.schema.json");
execFileSync(process.execPath, ["scripts/generate-installer-package-signatures.mjs", "--verify"], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
  maxBuffer: 1024 * 1024 * 64,
});
for (const path of [INSTALLER_OCI_INDEX_PATH, paths.receiptPath, paths.bundlePath, paths.verificationPath, schemaPath]) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
}
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
check(schema.title === "Installer OCI Index Signature Receipt", `${relativeRepo(schemaPath)} has the wrong identity`);

const catalogText = readFileSync(INSTALLER_OCI_INDEX_PATH, "utf8");
const catalog = JSON.parse(catalogText);
const receipt = readYaml(paths.receiptPath);
const bundleText = readFileSync(paths.bundlePath, "utf8");
const bundle = readJson(paths.bundlePath);
const verificationText = readFileSync(paths.verificationPath, "utf8");
const certificateText = certificateTextFromBundle(bundle, relativeRepo(paths.bundlePath));
validateBindings({ catalog, catalogText, receipt, bundle, bundleText, verificationText, certificateText });
if (mode === "--verify-crypto") {
  cryptographicallyVerify(INSTALLER_OCI_INDEX_PATH);
  console.log(`cryptographically verified signed installer OCI index for ${catalog.metadata.packageCount} package(s)`);
} else if (mode === "--crypto-self-test") {
  cryptographicSelfTest(catalogText);
  console.log("verified that index signature cryptography rejects changed catalog bytes");
} else {
  console.log(`verified signed installer OCI index for ${catalog.metadata.packageCount} package(s)`);
}

function validateBindings(input) {
  const { catalog, catalogText, receipt, bundle, bundleText, verificationText, certificateText } = input;
  const prefix = "installer OCI index signature";
  check(catalog?.kind === "InstallerPackageCatalogIndex", `${prefix}: wrong catalog kind`);
  check(Array.isArray(catalog.packages) && catalog.packages.length === catalog.metadata?.packageCount, `${prefix}: catalog row count differs`);
  check(catalog.packages.every((row) => row.signature_status === "signed-receipt"), `${prefix}: catalog contains an unsigned package`);
  check(receipt?.apiVersion === "evidence.confighub.com/v1alpha1", `${prefix}: wrong receipt API version`);
  check(receipt?.kind === "InstallerOciIndexSignatureReceipt", `${prefix}: wrong receipt kind`);
  check(receipt?.metadata?.name === "installer-oci-packages-index", `${prefix}: wrong receipt name`);
  const spec = receipt.spec ?? {};
  check(!Number.isNaN(Date.parse(spec.observedAt)), `${prefix}: invalid observation time`);
  check(spec.subject?.catalogPath === relativeRepo(INSTALLER_OCI_INDEX_PATH), `${prefix}: wrong catalog path`);
  check(spec.subject?.catalogSHA256 === sha256(catalogText), `${prefix}: catalog hash differs`);
  check(spec.subject?.catalogGeneratedAt === catalog.metadata.generatedAt, `${prefix}: catalog date differs`);
  check(spec.subject?.packageCount === catalog.metadata.packageCount, `${prefix}: package count differs`);
  check(spec.subject?.signedPackageCount === catalog.metadata.packageCount, `${prefix}: signed package count differs`);
  check(spec.signature?.scheme === INSTALLER_PACKAGE_SIGNATURE_SCHEME, `${prefix}: wrong signature scheme`);
  check(spec.signature?.signerIdentity === INSTALLER_PACKAGE_SIGNER_IDENTITY, `${prefix}: wrong signer identity`);
  check(spec.signature?.oidcIssuer === INSTALLER_PACKAGE_SIGNER_ISSUER, `${prefix}: wrong OIDC issuer`);
  check(spec.signature?.bundlePath === relativeRepo(paths.bundlePath), `${prefix}: wrong bundle path`);
  check(spec.signature?.bundleSHA256 === sha256(bundleText), `${prefix}: bundle hash differs`);
  check(spec.verification?.result === "pass", `${prefix}: verification did not pass`);
  check(spec.verification?.command === indexSignatureVerificationCommand(), `${prefix}: verification command differs`);
  check(spec.verification?.outputPath === relativeRepo(paths.verificationPath), `${prefix}: verification output path differs`);
  check(spec.verification?.outputSHA256 === sha256(verificationText), `${prefix}: verification output hash differs`);
  check(spec.verification?.cosignVersion === INSTALLER_PACKAGE_COSIGN_VERSION, `${prefix}: cosign version differs from the pinned verifier`);
  check(/Verified OK/i.test(verificationText), `${prefix}: cosign success is not recorded`);
  check(/sigstore\.bundle/.test(String(bundle?.mediaType ?? "")), `${prefix}: unexpected Sigstore bundle media type`);
  check(Boolean(bundle?.messageSignature?.signature || bundle?.dsseEnvelope?.signatures?.[0]?.sig), `${prefix}: bundle carries no signature`);
  check((bundle?.verificationMaterial?.tlogEntries ?? []).length > 0, `${prefix}: bundle carries no transparency-log entry`);
  check(certificateText.includes(INSTALLER_PACKAGE_SIGNER_IDENTITY), `${prefix}: certificate does not name the signer`);
  check(certificateText.includes(INSTALLER_PACKAGE_SIGNER_ISSUER), `${prefix}: certificate does not name the issuer`);
  check((spec.scope?.proves ?? []).length >= 2, `${prefix}: receipt does not state what the signature proves`);
  check((spec.scope?.doesNotProve ?? []).length >= 2, `${prefix}: receipt does not state the signature limits`);
}

function certificateTextFromBundle(bundle, label) {
  const raw = bundle?.verificationMaterial?.certificate?.rawBytes ?? "";
  check(raw, `${label}: bundle carries no signing certificate`);
  try {
    return execFileSync("openssl", ["x509", "-inform", "DER", "-noout", "-text"], {
      input: Buffer.from(raw, "base64"), encoding: "utf8", maxBuffer: 1024 * 1024 * 8,
    });
  } catch (error) {
    throw new Error(`${label}: cannot decode signing certificate: ${error.message}`);
  }
}

function cryptographicallyVerify(catalogPath, { expectFailure = false } = {}) {
  check(commandAvailable("cosign", ["version"]), "cosign is required for cryptographic index verification");
  const version = readCosignVersion();
  check(version === INSTALLER_PACKAGE_COSIGN_VERSION, `expected cosign ${INSTALLER_PACKAGE_COSIGN_VERSION}, found ${version}`);
  const result = spawnSync("cosign", [
    "verify-blob",
    "--bundle", paths.bundlePath,
    "--certificate-identity", INSTALLER_PACKAGE_SIGNER_IDENTITY,
    "--certificate-oidc-issuer", INSTALLER_PACKAGE_SIGNER_ISSUER,
    catalogPath,
  ], { encoding: "utf8", maxBuffer: 1024 * 1024 * 8 });
  if (expectFailure) {
    check(result.status !== 0, "cosign accepted changed catalog bytes");
    return;
  }
  check(result.status === 0, `cosign verify-blob failed: ${String(result.stderr || result.stdout).trim()}`);
  check(/Verified OK/i.test(`${result.stdout ?? ""}${result.stderr ?? ""}`), "cosign did not report successful index verification");
}

function cryptographicSelfTest(catalogText) {
  cryptographicallyVerify(INSTALLER_OCI_INDEX_PATH);
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-index-signature-self-test-"));
  try {
    const changed = join(tempRoot, "changed-packages.json");
    writeFileSync(changed, `${catalogText} `);
    cryptographicallyVerify(changed, { expectFailure: true });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function commandAvailable(command, args) {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}

function readCosignVersion() {
  const output = execFileSync("cosign", ["version"], { encoding: "utf8" });
  return output.match(/GitVersion:\s*(\S+)/)?.[1] ?? output.trim().split("\n")[0];
}

function selfTest() {
  const packages = [{ signature_status: "signed-receipt" }];
  const catalog = { kind: "InstallerPackageCatalogIndex", metadata: { generatedAt: "2026-08-25T00:00:00.000Z", packageCount: 1 }, packages };
  const catalogText = `${JSON.stringify(catalog)}\n`;
  const bundle = { mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json", verificationMaterial: { certificate: { rawBytes: "ZmFrZQ==" }, tlogEntries: [{}] }, messageSignature: { signature: "c2ln" } };
  const bundleText = `${JSON.stringify(bundle)}\n`;
  const verificationText = "Verified OK\n";
  const receipt = {
    apiVersion: "evidence.confighub.com/v1alpha1", kind: "InstallerOciIndexSignatureReceipt", metadata: { name: "installer-oci-packages-index" },
    spec: {
      observedAt: "2026-08-25T00:01:00.000Z",
      subject: { catalogPath: relativeRepo(INSTALLER_OCI_INDEX_PATH), catalogSHA256: sha256(catalogText), catalogGeneratedAt: catalog.metadata.generatedAt, packageCount: 1, signedPackageCount: 1 },
      signature: { scheme: INSTALLER_PACKAGE_SIGNATURE_SCHEME, signerIdentity: INSTALLER_PACKAGE_SIGNER_IDENTITY, oidcIssuer: INSTALLER_PACKAGE_SIGNER_ISSUER, bundlePath: relativeRepo(paths.bundlePath), bundleSHA256: sha256(bundleText) },
      verification: { result: "pass", command: indexSignatureVerificationCommand(), outputPath: relativeRepo(paths.verificationPath), outputSHA256: sha256(verificationText), cosignVersion: INSTALLER_PACKAGE_COSIGN_VERSION },
      scope: { proves: ["one", "two"], doesNotProve: ["one", "two"] },
    },
  };
  const input = { catalog, catalogText, receipt, bundle, bundleText, verificationText, certificateText: `${INSTALLER_PACKAGE_SIGNER_IDENTITY}\n${INSTALLER_PACKAGE_SIGNER_ISSUER}` };
  validateBindings(input);
  expectRefusal(() => validateBindings({ ...input, catalogText: `${catalogText} ` }), "catalog hash");
  expectRefusal(() => validateBindings({ ...input, receipt: { ...receipt, spec: { ...receipt.spec, signature: { ...receipt.spec.signature, signerIdentity: "wrong@example.com" } } } }), "signer");
  expectRefusal(() => validateBindings({ ...input, bundleText: `${bundleText} ` }), "bundle hash");
  expectRefusal(() => validateBindings({ ...input, bundle: { ...bundle, verificationMaterial: { ...bundle.verificationMaterial, tlogEntries: [] } } }), "transparency log");
}

function expectRefusal(fn, label) {
  let refused = false;
  try { fn(); } catch { refused = true; }
  check(refused, `self-test did not refuse the wrong ${label}`);
}
