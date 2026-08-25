import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot } from "./proof-common.mjs";

export const INSTALLER_PACKAGE_SIGNER_IDENTITY =
  "helm-expt-package-signer@nth-fort-499605-q5.iam.gserviceaccount.com";
export const INSTALLER_PACKAGE_SIGNER_ISSUER = "https://accounts.google.com";
export const INSTALLER_PACKAGE_SIGNATURE_SCHEME = "sigstore-keyless";
export const INSTALLER_PACKAGE_COSIGN_VERSION = "v3.1.3";
export const INSTALLER_PACKAGE_SIGNATURE_ROOT = join(repoRoot, "runs", "installer-oci-signatures");
export const INSTALLER_OCI_INDEX_PATH = join(repoRoot, "data", "installer-oci-packages", "packages.json");
export const INSTALLER_OCI_INDEX_SIGNATURE_ROOT = join(repoRoot, "runs", "installer-oci-index-signature");

const digestPattern = /^sha256:[0-9a-f]{64}$/;

export function installerPackagePublicationRecords() {
  const receiptPaths = listFiles(join(repoRoot, "runs"))
    .filter((path) => path.endsWith("installer-package-publication-receipt.yaml"))
    .sort();
  return receiptPaths.map((path) => publicationRecord(path));
}

export function publicationRecord(path) {
  const receipt = readYaml(path);
  const rel = relativeRepo(path);
  check(receipt?.kind === "InstallerPackagePublicationReceipt", `${rel}: unexpected receipt kind`);
  const spec = receipt.spec ?? {};
  const tagReference = String(spec.ref ?? "");
  const packagePath = String(spec.package?.path ?? "");
  const packageSHA256 = String(spec.package?.sha256 ?? "");
  const publishedAt = String(spec.observedAt ?? "");
  const manifestDigest = publicationDigest(spec.outputs ?? {}, "manifestDigest", "manifest");
  const layerDigest = publicationDigest(spec.outputs ?? {}, "layerDigest", "layer") || `sha256:${packageSHA256}`;
  check(/^oci:\/\/.+:[^/]+$/.test(tagReference), `${rel}: invalid package OCI reference`);
  check(/^packages\/[^/]+\/[^/]+\/[^/]+$/.test(packagePath), `${rel}: invalid package path`);
  check(/^[0-9a-f]{64}$/.test(packageSHA256), `${rel}: invalid package SHA-256`);
  check(!Number.isNaN(Date.parse(publishedAt)), `${rel}: invalid publication time`);
  check(digestPattern.test(manifestDigest), `${rel}: no valid manifest digest in publication receipt`);
  check(digestPattern.test(layerDigest), `${rel}: no valid layer digest in publication receipt`);
  check(layerDigest === `sha256:${packageSHA256}`, `${rel}: package SHA-256 and layer digest differ`);
  const digestPinnedReference = `${tagReference}@${manifestDigest}`;
  const immutableReference = digestPinnedReference.replace(/^oci:\/\//, "");
  const paths = signaturePathsForPublication(path);
  return {
    name: `${paths.slug}-${paths.tag}`,
    packagePath,
    packageSHA256,
    publishedAt,
    publicationReceipt: rel,
    tagReference,
    digestPinnedReference,
    manifestDigest,
    layerDigest,
    immutableReference,
    ...paths,
  };
}

export function signaturePathsForPublication(publicationReceiptPath) {
  const publicationDir = dirname(publicationReceiptPath);
  const tag = basename(publicationDir);
  const slug = basename(dirname(publicationDir));
  const root = join(INSTALLER_PACKAGE_SIGNATURE_ROOT, slug, tag);
  return {
    slug,
    tag,
    root,
    receiptPath: join(root, "signature-receipt.yaml"),
    bundlePath: join(root, "signature.sigstore.json"),
    payloadPath: join(root, "signature-payload.json"),
    verificationPath: join(root, "verification.json"),
    payloadVerificationPath: join(root, "payload-verification.txt"),
  };
}

export function signatureVerificationCommand(record) {
  return [
    "cosign verify",
    `--certificate-identity ${INSTALLER_PACKAGE_SIGNER_IDENTITY}`,
    `--certificate-oidc-issuer ${INSTALLER_PACKAGE_SIGNER_ISSUER}`,
    `--annotations confighub.com/package-path=${record.packagePath}`,
    `--annotations confighub.com/package-sha256=${record.packageSHA256}`,
    record.immutableReference,
  ].join(" ");
}

export function signaturePayloadVerificationCommand(record) {
  return [
    "cosign verify-blob",
    `--bundle ${relativeRepo(record.bundlePath)}`,
    `--certificate-identity ${INSTALLER_PACKAGE_SIGNER_IDENTITY}`,
    `--certificate-oidc-issuer ${INSTALLER_PACKAGE_SIGNER_ISSUER}`,
    relativeRepo(record.payloadPath),
  ].join(" ");
}

export function installerOciIndexSignaturePaths() {
  return {
    receiptPath: join(INSTALLER_OCI_INDEX_SIGNATURE_ROOT, "signature-receipt.yaml"),
    bundlePath: join(INSTALLER_OCI_INDEX_SIGNATURE_ROOT, "packages.sigstore.json"),
    verificationPath: join(INSTALLER_OCI_INDEX_SIGNATURE_ROOT, "verification.txt"),
  };
}

export function indexSignatureVerificationCommand() {
  const paths = installerOciIndexSignaturePaths();
  return [
    "cosign verify-blob",
    `--bundle ${relativeRepo(paths.bundlePath)}`,
    `--certificate-identity ${INSTALLER_PACKAGE_SIGNER_IDENTITY}`,
    `--certificate-oidc-issuer ${INSTALLER_PACKAGE_SIGNER_ISSUER}`,
    relativeRepo(INSTALLER_OCI_INDEX_PATH),
  ].join(" ");
}

export function installerPackageSignatureReceiptMap() {
  const result = new Map();
  if (!existsSync(INSTALLER_PACKAGE_SIGNATURE_ROOT)) return result;
  for (const path of listFiles(INSTALLER_PACKAGE_SIGNATURE_ROOT).filter((item) => item.endsWith("signature-receipt.yaml")).sort()) {
    const receipt = readYaml(path);
    const tagReference = String(receipt?.spec?.subject?.tagReference ?? "");
    check(tagReference, `${relativeRepo(path)}: no signed tag reference`);
    check(!result.has(tagReference), `${tagReference}: duplicate installer package signature receipts`);
    result.set(tagReference, { path: relativeRepo(path), receipt });
  }
  return result;
}

function publicationDigest(outputs, structuredField, outputLabel) {
  const structured = String(outputs?.[structuredField] ?? "");
  if (structured) return structured;
  const text = String(outputs?.push ?? "");
  return text.match(new RegExp(`^\\s*${outputLabel}:\\s*(sha256:[0-9a-f]{64})\\s*$`, "m"))?.[1] ?? "";
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${relativeRepo(path)}: invalid JSON: ${error.message}`);
  }
}

export function allStringValues(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => allStringValues(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => allStringValues(item, output));
  return output;
}
