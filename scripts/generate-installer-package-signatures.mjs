#!/usr/bin/env node

// Check the internal consistency of committed Sigstore package evidence without
// contacting the registry. The --verify-crypto mode also runs cosign against
// each committed payload and bundle. Both lanes bind the result to the package
// publication receipt and refuse missing, duplicated, or mismatched evidence.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  INSTALLER_PACKAGE_COSIGN_VERSION,
  INSTALLER_PACKAGE_SIGNATURE_SCHEME,
  INSTALLER_PACKAGE_SIGNATURE_PREDICATE_TYPE,
  INSTALLER_PACKAGE_SIGNER_IDENTITY,
  INSTALLER_PACKAGE_SIGNER_ISSUER,
  allStringValues,
  installerPackagePublicationRecords,
  installerPackageSignatureReceiptMap,
  readJson,
  signaturePayloadVerificationCommand,
  signatureVerificationCommand,
} from "./lib/installer-package-signatures.mjs";
import { check, readYaml, relativeRepo, repoRoot, sha256, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const supportedModes = new Set(["--generate", "--verify", "--self-test", "--verify-crypto", "--crypto-self-test"]);
if (!supportedModes.has(mode)) usage();

const outputRoot = join(repoRoot, "data", "installer-package-signatures");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  csv: join(outputRoot, "signatures.csv"),
  json: join(outputRoot, "signatures.json"),
};
const schemaPath = join(repoRoot, "schemas", "installer-package-signature-receipt.schema.json");

if (mode === "--self-test") {
  selfTest();
  console.log("verified installer package signature checks against fake surfaces");
  process.exit(0);
}

const report = buildReport();
if (mode === "--verify-crypto") {
  cryptographicallyVerifyRows(report.rows);
  console.log(`cryptographically verified ${report.rows.length} signed installer package payload(s)`);
} else if (mode === "--crypto-self-test") {
  cryptographicSelfTest(report.rows);
  console.log("verified that package signature cryptography rejects a changed payload");
} else if (mode === "--generate") {
  rmSync(outputRoot, { recursive: true, force: true });
  write(outputs.summary, report.summary);
  write(outputs.csv, report.csv);
  write(outputs.json, `${JSON.stringify({ signatures: report.rows }, null, 2)}\n`);
  console.log(`wrote ${report.rows.length} installer package signature record(s) -> ${relativeRepo(outputRoot)}`);
} else {
  for (const path of Object.values(outputs)) check(existsSync(path), `${relativeRepo(path)} is missing; run npm run installer-oci:signatures:generate`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale`);
  check(readFileSync(outputs.json, "utf8") === `${JSON.stringify({ signatures: report.rows }, null, 2)}\n`, `${relativeRepo(outputs.json)} is stale`);
  console.log(`verified ${report.rows.length} signed installer package manifest(s)`);
}

function buildReport() {
  validateSchemaSurface();
  const publications = installerPackagePublicationRecords();
  const signatures = installerPackageSignatureReceiptMap();
  check(publications.length > 0, "no installer package publication receipts found");
  check(signatures.size === publications.length, `${signatures.size}/${publications.length} published installer packages have signature receipts`);

  const publicationRefs = new Set(publications.map((record) => record.tagReference));
  const extra = [...signatures.keys()].filter((ref) => !publicationRefs.has(ref)).sort();
  check(extra.length === 0, `signature receipts exist for unknown package refs: ${extra.join(", ")}`);

  const rows = publications.map((record) => {
    const signed = signatures.get(record.tagReference);
    check(signed, `${record.packagePath}: no signature receipt`);
    return validateCommittedRecord(record, signed.path);
  });
  return { rows, summary: renderSummary(rows), csv: renderCsv(rows) };
}

function validateCommittedRecord(record, receiptRel) {
  const receiptPath = join(repoRoot, receiptRel);
  const receipt = readYaml(receiptPath);
  const spec = receipt?.spec ?? {};
  const bundlePath = join(repoRoot, String(spec.signature?.bundlePath ?? ""));
  const payloadPath = join(repoRoot, String(spec.signature?.payloadPath ?? ""));
  const verificationPath = join(repoRoot, String(spec.verification?.outputPath ?? ""));
  const payloadVerificationPath = join(repoRoot, String(spec.verification?.payloadOutputPath ?? ""));
  check(existsSync(bundlePath), `${receiptRel}: signature bundle is missing`);
  check(existsSync(payloadPath), `${receiptRel}: signed payload is missing`);
  check(existsSync(verificationPath), `${receiptRel}: verification output is missing`);
  check(existsSync(payloadVerificationPath), `${receiptRel}: payload verification output is missing`);
  const bundleText = readFileSync(bundlePath, "utf8");
  const payloadText = readFileSync(payloadPath, "utf8");
  const verificationText = readFileSync(verificationPath, "utf8");
  const payloadVerificationText = readFileSync(payloadVerificationPath, "utf8");
  const bundle = readJson(bundlePath);
  const payload = readJson(payloadPath);
  const verification = readJson(verificationPath);
  const certificateText = certificateTextFromBundle(bundle, receiptRel);
  validateBindings({
    record, receipt, receiptRel, bundle, bundleText, payload, payloadText,
    verification, verificationText, payloadVerificationText, certificateText,
  });
  return {
    package_path: record.packagePath,
    tag_reference: record.tagReference,
    manifest_digest: record.manifestDigest,
    immutable_reference: record.immutableReference,
    package_sha256: record.packageSHA256,
    signer_identity: INSTALLER_PACKAGE_SIGNER_IDENTITY,
    oidc_issuer: INSTALLER_PACKAGE_SIGNER_ISSUER,
    observed_at: String(spec.observedAt),
    signature_receipt: receiptRel,
    signature_bundle: relativeRepo(bundlePath),
    signature_payload: relativeRepo(payloadPath),
    verification_output: relativeRepo(verificationPath),
    payload_verification_output: relativeRepo(payloadVerificationPath),
    verification_command: signatureVerificationCommand(record),
    payload_verification_command: signaturePayloadVerificationCommand(record),
  };
}

function validateBindings({
  record, receipt, receiptRel, bundle, bundleText, payload, payloadText,
  verification, verificationText, payloadVerificationText, certificateText,
}) {
  const prefix = receiptRel || record.packagePath;
  check(receipt?.apiVersion === "evidence.confighub.com/v1alpha1", `${prefix}: wrong API version`);
  check(receipt?.kind === "InstallerPackageSignatureReceipt", `${prefix}: wrong receipt kind`);
  check(receipt?.metadata?.name === record.name, `${prefix}: wrong receipt name`);
  const spec = receipt.spec ?? {};
  check(!Number.isNaN(Date.parse(spec.observedAt)), `${prefix}: invalid observation time`);

  const subject = spec.subject ?? {};
  for (const [field, expected] of Object.entries({
    packagePath: record.packagePath,
    publicationReceipt: record.publicationReceipt,
    tagReference: record.tagReference,
    manifestDigest: record.manifestDigest,
    immutableReference: record.immutableReference,
    packageSHA256: record.packageSHA256,
    layerDigest: record.layerDigest,
  })) check(subject[field] === expected, `${prefix}: subject.${field} differs from the publication receipt`);

  const signature = spec.signature ?? {};
  check(signature.scheme === INSTALLER_PACKAGE_SIGNATURE_SCHEME, `${prefix}: wrong signature scheme`);
  check(signature.signerIdentity === INSTALLER_PACKAGE_SIGNER_IDENTITY, `${prefix}: wrong signer identity`);
  check(signature.oidcIssuer === INSTALLER_PACKAGE_SIGNER_ISSUER, `${prefix}: wrong OIDC issuer`);
  check(signature.registryAttached === true, `${prefix}: signature is not recorded as registry-attached`);
  check(signature.bundlePath === relativeRepo(record.bundlePath), `${prefix}: signature bundle path differs`);
  check(signature.bundleSHA256 === sha256(bundleText), `${prefix}: signature bundle hash differs`);
  check(signature.payloadPath === relativeRepo(record.payloadPath), `${prefix}: signed payload path differs`);
  check(signature.payloadSHA256 === sha256(payloadText), `${prefix}: signed payload hash differs`);
  check(signature.registryAnonymousRead === true, `${prefix}: anonymous registry verification is not recorded`);

  const checked = spec.verification ?? {};
  check(checked.result === "pass", `${prefix}: signature verification did not pass`);
  check(checked.command === signatureVerificationCommand(record), `${prefix}: verification command differs`);
  check(checked.outputPath === relativeRepo(record.verificationPath), `${prefix}: verification output path differs`);
  check(checked.outputSHA256 === sha256(verificationText), `${prefix}: verification output hash differs`);
  check(checked.payloadCommand === signaturePayloadVerificationCommand(record), `${prefix}: payload verification command differs`);
  check(checked.payloadOutputPath === relativeRepo(record.payloadVerificationPath), `${prefix}: payload verification output path differs`);
  check(checked.payloadOutputSHA256 === sha256(payloadVerificationText), `${prefix}: payload verification output hash differs`);
  check(checked.cosignVersion === INSTALLER_PACKAGE_COSIGN_VERSION, `${prefix}: cosign version differs from the pinned verifier`);
  check(/Verified OK/i.test(payloadVerificationText), `${prefix}: payload cryptographic verification is not recorded`);

  const annotations = spec.annotations ?? {};
  check(annotations["confighub.com/package-path"] === record.packagePath, `${prefix}: package-path annotation differs`);
  check(annotations["confighub.com/package-sha256"] === record.packageSHA256, `${prefix}: package-sha256 annotation differs`);
  check((spec.scope?.proves ?? []).length >= 2, `${prefix}: receipt does not say what the signature proves`);
  check((spec.scope?.doesNotProve ?? []).length >= 2, `${prefix}: receipt does not state the signature limits`);

  check(/sigstore\.bundle/.test(String(bundle?.mediaType ?? "")), `${prefix}: unexpected Sigstore bundle media type`);
  check(bundle?.dsseEnvelope?.payloadType === "application/vnd.in-toto+json", `${prefix}: bundle carries no in-toto statement`);
  check(Boolean(bundle?.dsseEnvelope?.signatures?.[0]?.sig), `${prefix}: bundle carries no DSSE signature`);
  check((bundle?.verificationMaterial?.tlogEntries ?? []).length > 0, `${prefix}: bundle carries no transparency-log entry`);
  check(certificateText.includes(INSTALLER_PACKAGE_SIGNER_IDENTITY), `${prefix}: certificate does not name the expected signer`);
  check(certificateText.includes(INSTALLER_PACKAGE_SIGNER_ISSUER), `${prefix}: certificate does not name the expected OIDC issuer`);
  check(isDeepStrictEqual(payload, decodeBundlePayload(bundle, prefix)), `${prefix}: saved statement differs from the signed bundle payload`);
  validatePayloadClaims(record, payload, prefix);

  const values = new Set(allStringValues(verification));
  for (const expected of [
    record.manifestDigest,
    record.packagePath,
    record.packageSHA256,
  ]) check(values.has(expected), `${prefix}: cosign verification output does not bind ${expected}`);
}

function validatePayloadClaims(record, payload, prefix) {
  check(payload?._type === "https://in-toto.io/Statement/v1", `${prefix}: signed payload is not an in-toto statement`);
  check(payload.predicateType === INSTALLER_PACKAGE_SIGNATURE_PREDICATE_TYPE, `${prefix}: signed payload has the wrong predicate type`);
  const subject = (payload.subject ?? []).find((item) => item?.digest?.sha256 === record.manifestDigest.replace(/^sha256:/, ""));
  check(subject, `${prefix}: signed payload has the wrong manifest digest`);
  check(subject.annotations?.["confighub.com/package-path"] === record.packagePath, `${prefix}: signed payload has the wrong package-path annotation`);
  check(subject.annotations?.["confighub.com/package-sha256"] === record.packageSHA256, `${prefix}: signed payload has the wrong package-sha256 annotation`);
}

function decodeBundlePayload(bundle, prefix) {
  const encoded = String(bundle?.dsseEnvelope?.payload ?? "");
  check(encoded, `${prefix}: bundle carries no DSSE payload`);
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch (error) {
    throw new Error(`${prefix}: cannot decode the signed bundle payload: ${error.message}`);
  }
}

function cryptographicallyVerifyRows(rows) {
  check(commandAvailable("cosign", ["version"]), "cosign is required for cryptographic package verification");
  const version = readCosignVersion();
  check(version === INSTALLER_PACKAGE_COSIGN_VERSION, `expected cosign ${INSTALLER_PACKAGE_COSIGN_VERSION}, found ${version}`);
  for (const row of rows) cryptographicallyVerify(row.signature_bundle, row.manifest_digest);
}

function cryptographicallyVerify(bundle, manifestDigest, { expectFailure = false } = {}) {
  const result = spawnSync("cosign", [
    "verify-blob-attestation",
    "--bundle", join(repoRoot, bundle),
    "--digest", manifestDigest.replace(/^sha256:/, ""),
    "--digestAlg", "sha256",
    "--type", INSTALLER_PACKAGE_SIGNATURE_PREDICATE_TYPE,
    "--certificate-identity", INSTALLER_PACKAGE_SIGNER_IDENTITY,
    "--certificate-oidc-issuer", INSTALLER_PACKAGE_SIGNER_ISSUER,
  ], { encoding: "utf8", maxBuffer: 1024 * 1024 * 8 });
  if (expectFailure) {
    check(result.status !== 0, "cosign accepted the wrong package manifest digest");
    return;
  }
  check(result.status === 0, `${bundle}: cosign verify-blob-attestation failed: ${String(result.stderr || result.stdout).trim()}`);
  check(/Verified OK/i.test(`${result.stdout ?? ""}${result.stderr ?? ""}`), `${bundle}: cosign did not report successful statement verification`);
}

function cryptographicSelfTest(rows) {
  check(rows.length > 0, "no signed package is available for the cryptographic self-test");
  const row = rows[0];
  cryptographicallyVerifyRows([row]);
  const wrongDigest = `sha256:${row.manifest_digest.slice("sha256:".length).replace(/^./, (value) => value === "0" ? "1" : "0")}`;
  cryptographicallyVerify(row.signature_bundle, wrongDigest, { expectFailure: true });
}

function commandAvailable(command, args) {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}

function readCosignVersion() {
  const output = execFileSync("cosign", ["version"], { encoding: "utf8" });
  return output.match(/GitVersion:\s*(\S+)/)?.[1] ?? output.trim().split("\n")[0];
}

function certificateTextFromBundle(bundle, receiptRel) {
  const raw = bundle?.verificationMaterial?.certificate?.rawBytes ?? "";
  check(raw, `${receiptRel}: bundle carries no signing certificate`);
  const decoded = Buffer.from(raw, "base64");
  try {
    return execFileSync("openssl", ["x509", "-inform", "DER", "-noout", "-text"], {
      input: decoded,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
    });
  } catch (error) {
    throw new Error(`${receiptRel}: cannot decode signing certificate: ${error.message}`);
  }
}

function validateSchemaSurface() {
  check(existsSync(schemaPath), `${relativeRepo(schemaPath)} is missing`);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  check(schema.$schema && schema.title === "Installer Package Signature Receipt", `${relativeRepo(schemaPath)} has the wrong identity`);
  for (const field of ["apiVersion", "kind", "metadata", "spec"]) check(schema.required?.includes(field), `${relativeRepo(schemaPath)} does not require ${field}`);
  check(schema.properties?.spec?.additionalProperties === false, `${relativeRepo(schemaPath)} must close the spec object`);
}

function renderSummary(rows) {
  const first = rows.find((row) => row.package_path === "packages/bitnami/redis/25.5.3") ?? rows[0];
  return `# Signed Installer Packages

Generated by \`scripts/generate-installer-package-signatures.mjs\`.

Every published installer package has a signature receipt for its immutable OCI
manifest digest. The live signing run used \`${INSTALLER_PACKAGE_COSIGN_VERSION}\`
with the identity \`${INSTALLER_PACKAGE_SIGNER_IDENTITY}\`. No private signing
key is kept in this repository or on the package-building machine.

## Coverage

| Measure | Count |
| --- | ---: |
| Published package manifests | ${rows.length} |
| Manifests with a committed signature receipt | ${rows.length} |
| Manifests with a signed payload, Sigstore bundle, and cosign verification output | ${rows.length} |

## Verify One Package

~~~sh
${first.verification_command}
~~~

This command checks the named signer, the Google OIDC issuer, the exact OCI
manifest digest, the package path, and the package SHA-256 annotation. A
successful run cryptographically checks that those exact package bytes were
signed by the catalog publisher. The repository keeps the exact signed payload
from the DSSE bundle and verifies that the bundle names the exact OCI manifest
digest. It also checks the signature attached to the public OCI digest. A
signature does not show that a preset is suitable for a particular cluster.
Use the chart page and its checks, lifecycle instructions, and receipts for
that decision.

## Files

- [signatures.csv](./signatures.csv)
- [signatures.json](./signatures.json)
`;
}

function renderCsv(rows) {
  const headers = [
    "package_path", "tag_reference", "manifest_digest", "immutable_reference",
    "package_sha256", "signer_identity", "oidc_issuer", "observed_at",
    "signature_receipt", "signature_bundle", "signature_payload", "verification_output",
    "payload_verification_output", "verification_command", "payload_verification_command",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function selfTest() {
  const manifestDigest = `sha256:${"1".repeat(64)}`;
  const packageSHA256 = "2".repeat(64);
  const record = {
    name: "example-1-0-0",
    packagePath: "packages/example/chart/1.0.0",
    publicationReceipt: "runs/installer-oci/example/1.0.0/installer-package-publication-receipt.yaml",
    tagReference: "oci://registry.example/catalog/example:1.0.0",
    manifestDigest,
    immutableReference: `registry.example/catalog/example:1.0.0@${manifestDigest}`,
    packageSHA256,
    layerDigest: `sha256:${packageSHA256}`,
    bundlePath: join(repoRoot, "runs/installer-oci-signatures/example/1.0.0/signature.sigstore.json"),
    payloadPath: join(repoRoot, "runs/installer-oci-signatures/example/1.0.0/signature-payload.json"),
    verificationPath: join(repoRoot, "runs/installer-oci-signatures/example/1.0.0/verification.json"),
    payloadVerificationPath: join(repoRoot, "runs/installer-oci-signatures/example/1.0.0/payload-verification.txt"),
  };
  const payload = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{
      digest: { sha256: record.manifestDigest.replace(/^sha256:/, "") },
      annotations: {
        "confighub.com/package-path": record.packagePath,
        "confighub.com/package-sha256": record.packageSHA256,
      },
    }],
    predicateType: INSTALLER_PACKAGE_SIGNATURE_PREDICATE_TYPE,
    predicate: {},
  };
  const bundle = {
    mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
    verificationMaterial: { certificate: { rawBytes: "ZmFrZQ==" }, tlogEntries: [{}] },
    dsseEnvelope: {
      payload: Buffer.from(JSON.stringify(payload)).toString("base64"),
      payloadType: "application/vnd.in-toto+json",
      signatures: [{ sig: "c2ln" }],
    },
  };
  const verification = [
    { manifestDigest, packagePath: record.packagePath, packageSHA256, signer: INSTALLER_PACKAGE_SIGNER_IDENTITY, issuer: INSTALLER_PACKAGE_SIGNER_ISSUER },
  ];
  const bundleText = `${JSON.stringify(bundle)}\n`;
  const verificationText = `${JSON.stringify(verification)}\n`;
  const payloadText = `${JSON.stringify(payload)}\n`;
  const payloadVerificationText = "Verified OK\n";
  const receipt = {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "InstallerPackageSignatureReceipt",
    metadata: { name: record.name },
    spec: {
      observedAt: "2026-08-25T00:00:00.000Z",
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
        bundlePath: "runs/installer-oci-signatures/example/1.0.0/signature.sigstore.json",
        bundleSHA256: sha256(bundleText),
        payloadPath: "runs/installer-oci-signatures/example/1.0.0/signature-payload.json",
        payloadSHA256: sha256(payloadText),
        registryAttached: true,
        registryAnonymousRead: true,
      },
      verification: {
        result: "pass",
        command: signatureVerificationCommand(record),
        outputPath: "runs/installer-oci-signatures/example/1.0.0/verification.json",
        outputSHA256: sha256(verificationText),
        payloadCommand: signaturePayloadVerificationCommand(record),
        payloadOutputPath: "runs/installer-oci-signatures/example/1.0.0/payload-verification.txt",
        payloadOutputSHA256: sha256(payloadVerificationText),
        cosignVersion: INSTALLER_PACKAGE_COSIGN_VERSION,
      },
      annotations: {
        "confighub.com/package-path": record.packagePath,
        "confighub.com/package-sha256": record.packageSHA256,
      },
      scope: { proves: ["one", "two"], doesNotProve: ["one", "two"] },
    },
  };
  const input = {
    record, receipt, receiptRel: "self-test", bundle, bundleText, payload, payloadText,
    verification, verificationText, payloadVerificationText,
    certificateText: `${INSTALLER_PACKAGE_SIGNER_IDENTITY}\n${INSTALLER_PACKAGE_SIGNER_ISSUER}`,
  };
  validateBindings(input);
  expectRefusal(() => validateBindings({ ...input, record: { ...record, manifestDigest: `sha256:${"3".repeat(64)}` } }), "manifest digest");
  expectRefusal(() => validateBindings({ ...input, receipt: { ...receipt, spec: { ...receipt.spec, signature: { ...receipt.spec.signature, signerIdentity: "wrong@example.com" } } } }), "signer identity");
  expectRefusal(() => validateBindings({ ...input, receipt: { ...receipt, spec: { ...receipt.spec, signature: { ...receipt.spec.signature, registryAnonymousRead: false } } } }), "anonymous registry verification");
  expectRefusal(() => validateBindings({ ...input, bundleText: `${bundleText} ` }), "bundle hash");
  expectRefusal(() => validateBindings({ ...input, bundle: { ...bundle, verificationMaterial: { ...bundle.verificationMaterial, tlogEntries: [] } } }), "transparency log");
}

function expectRefusal(fn, label) {
  let refused = false;
  try { fn(); } catch { refused = true; }
  check(refused, `self-test did not refuse the wrong ${label}`);
}

function usage() {
  console.error(`Usage:
  node scripts/generate-installer-package-signatures.mjs --generate
  node scripts/generate-installer-package-signatures.mjs --verify
  node scripts/generate-installer-package-signatures.mjs --self-test
  node scripts/generate-installer-package-signatures.mjs --verify-crypto
  node scripts/generate-installer-package-signatures.mjs --crypto-self-test`);
  process.exit(2);
}
