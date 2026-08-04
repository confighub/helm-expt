#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { check, cubEnv, listFiles, relativeRepo, repoRoot } from "./lib/proof-common.mjs";
import { installerOciRefForPackagePath } from "./lib/installer-oci.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const idempotent = args.includes("--idempotent");
const packageArg = valueAfter("--package");
const limitArg = valueAfter("--limit");
const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

if (args.includes("--help")) {
  console.log(`Usage:
  node scripts/publish-installer-oci-packages.mjs [--package packages/<repo>/<chart>/<version>] [--limit N] [--dry-run] [--idempotent]
  node scripts/publish-installer-oci-packages.mjs --self-test

Publishes installer package source directories to their assigned OCI refs and
writes runs/installer-oci/<slug>/<tag>/installer-package-publication-receipt.yaml.

Requires registry credentials with package write permission for the configured
installer OCI registry.
`);
  process.exit(0);
}

if (args.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

if (args.includes("--package")) check(packageArg && !packageArg.startsWith("--"), "--package requires an exact package path");
if (args.includes("--limit")) check(limitArg && !limitArg.startsWith("--"), "--limit requires a value");
if (limitArg) check(Number.isFinite(limit) && limit > 0, "--limit must be a positive integer");
if (idempotent) check(Boolean(packageArg), "--idempotent requires one exact --package path");

const packagePaths = selectPackagePaths();
if (dryRun) {
  for (const packagePath of packagePaths) {
    console.log(`${packagePath} -> ${installerOciRefForPackagePath(packagePath)}`);
  }
  process.exit(0);
}

for (const packagePath of packagePaths) {
  publishPackage(packagePath);
}

function selectPackagePaths() {
  if (packageArg) {
    const normalized = packageArg.replaceAll("\\", "/").replace(/\/+$/, "");
    const parts = normalized.split("/");
    check(parts.length === 4 && parts[0] === "packages" && parts.slice(1).every((part) => part && part !== "." && part !== ".."), "--package must be an exact repo-relative packages/<repo>/<chart>/<version> path");
    check(fileExists(join(repoRoot, normalized, "installer.yaml")), `${normalized}/installer.yaml is missing`);
    return [normalized];
  }
  const paths = listFiles(join(repoRoot, "packages"))
    .filter((path) => basename(path) === "installer.yaml")
    .map((path) => relativeRepo(dirname(path)))
    .sort();
  return typeof limit === "number" ? paths.slice(0, limit) : paths;
}

function publishPackage(packagePath) {
  const packageRoot = join(repoRoot, packagePath);
  const ociRef = installerOciRefForPackagePath(packagePath);
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-installer-oci-"));
  try {
    const archiveName = archiveNameFor(packagePath);
    const archivePath = join(tempRoot, archiveName);
    const packageOutput = run("cub", ["installer", "package", packageRoot, "-o", archivePath]);
    const packageSha = sha256File(archivePath);
    const sourceTreeSha = treeDigest(packageRoot);
    const existingInspect = idempotent ? inspectIfPresent(ociRef) : null;
    let pushOutput;
    let publicationAction;
    if (existingInspect) {
      const existing = inspectMetadata(existingInspect, ociRef);
      verifyExistingLayer(existing, packageSha, ociRef);
      pushOutput = `Reused existing ${ociRef}\n  manifest: ${existing.manifestDigest}\n  layer:    ${existing.layerDigest}`;
      publicationAction = "reused-existing-exact-artifact";
    } else {
      pushOutput = run("cub", ["installer", "push", archivePath, ociRef]);
      publicationAction = "pushed-new";
    }
    const inspectOutput = run("cub", ["installer", "inspect", ociRef, "--json"]);
    const inspected = inspectMetadata(inspectOutput, ociRef);
    check(inspected.layerDigest === `sha256:${packageSha}`, `${ociRef}: remote layer does not match the local deterministic package`);
    const receiptPath = receiptPathFor(packagePath);
    writeReceipt(receiptPath, {
      packagePath,
      archiveName,
      ociRef,
      packageSha,
      sourceTreeSha,
      packageOutput,
      pushOutput,
      inspectOutput,
      publicationAction,
      manifestDigest: inspected.manifestDigest,
      layerDigest: inspected.layerDigest,
    });
    console.log(`published ${packagePath} -> ${ociRef}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function run(command, commandArgs) {
  return execFileSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    env: cubEnv(),
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 200,
  });
}

function inspectIfPresent(ociRef) {
  const result = spawnSync("cub", ["installer", "inspect", ociRef, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: cubEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 200,
  });
  if (result.status === 0) return result.stdout;
  const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (/: not found\b/i.test(detail) || /manifest unknown/i.test(detail)) return null;
  throw new Error(`cannot safely determine whether ${ociRef} exists; refusing publish\n${detail}`);
}

function inspectMetadata(text, ociRef) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${ociRef}: installer inspect did not return JSON: ${error.message}`);
  }
  const manifestDigest = parsed.ManifestDigest ?? parsed.manifestDigest ?? "";
  const layerDigest = parsed.Config?.bundle?.layerDigest ?? parsed.config?.bundle?.layerDigest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(manifestDigest), `${ociRef}: inspected manifest digest is invalid`);
  check(/^sha256:[0-9a-f]{64}$/.test(layerDigest), `${ociRef}: inspected layer digest is invalid`);
  return { manifestDigest, layerDigest };
}

function verifyExistingLayer(existing, packageSha, ociRef) {
  check(existing.layerDigest === `sha256:${packageSha}`, `${ociRef} already exists with layer ${existing.layerDigest}; refusing overwrite with sha256:${packageSha}`);
}

function selfTest() {
  const manifestDigest = `sha256:${"1".repeat(64)}`;
  const layerDigest = `sha256:${"2".repeat(64)}`;
  const left = JSON.stringify({ ManifestDigest: manifestDigest, Config: { bundle: { files: ["installer.yaml"], layerDigest } } });
  const right = JSON.stringify({ Config: { bundle: { layerDigest, files: ["installer.yaml"] } }, ManifestDigest: manifestDigest }, null, 2);
  const inspected = inspectMetadata(left, "oci://self-test/example:1");
  verifyExistingLayer(inspected, "2".repeat(64), "oci://self-test/example:1");
  check(canonicalJsonSHA256(left) === canonicalJsonSHA256(right), "canonical inspect hash changed with JSON formatting or key order");
  let conflictRejected = false;
  try {
    verifyExistingLayer(inspected, "3".repeat(64), "oci://self-test/example:1");
  } catch (error) {
    conflictRejected = /refusing overwrite/.test(String(error.message));
  }
  check(conflictRejected, "idempotent publication self-test did not refuse a conflicting remote layer");
  console.log("installer OCI idempotency self-test passed: exact reuse, conflict refusal, and canonical inspect hashing");
}

function writeReceipt(path, receipt) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `apiVersion: helm-expt.confighub.com/v1alpha1
kind: InstallerPackagePublicationReceipt
metadata:
  name: ${receiptNameFor(receipt.packagePath)}
spec:
  ref: ${receipt.ociRef}
  package:
    path: ${receipt.packagePath}
    sha256: ${receipt.packageSha}
    sourceTreeSHA256: ${receipt.sourceTreeSha}
  publicationAction: ${receipt.publicationAction}
  commands:
    package: "cub installer package ${receipt.packagePath} -o <tmp>/${receipt.archiveName}"
    push: "cub installer push <tmp>/${receipt.archiveName} ${receipt.ociRef}"
    inspect: "cub installer inspect ${receipt.ociRef} --json"
  outputs:
    manifestDigest: ${receipt.manifestDigest}
    layerDigest: ${receipt.layerDigest}
    package: |
${indentBlock(receipt.packageOutput.trimEnd(), 6)}
    push: |
${indentBlock(receipt.pushOutput.trimEnd(), 6)}
    inspectJSONSHA256: ${sha256(receipt.inspectOutput)}
    inspectJSONCanonicalSHA256: ${canonicalJsonSHA256(receipt.inspectOutput)}
`,
  );
}

function receiptPathFor(packagePath) {
  const { slug, tag } = refParts(installerOciRefForPackagePath(packagePath));
  return join(repoRoot, "runs", "installer-oci", slug, tag, "installer-package-publication-receipt.yaml");
}

function archiveNameFor(packagePath) {
  const { slug, tag } = refParts(installerOciRefForPackagePath(packagePath));
  return `${slug}-${tag}.tgz`;
}

function receiptNameFor(packagePath) {
  const { slug, tag } = refParts(installerOciRefForPackagePath(packagePath));
  return `${slug}-${tag}`;
}

function refParts(ref) {
  const withoutScheme = ref.replace(/^oci:\/\//, "");
  const refName = withoutScheme.split("/").at(-1) ?? "";
  const [slug, tag = "latest"] = refName.split(":");
  return { slug, tag };
}

function valueAfter(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function fileExists(path) {
  return existsSync(path);
}

function indentBlock(text, spaces) {
  const prefix = " ".repeat(spaces);
  return (text || "")
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function canonicalJsonSHA256(text) {
  return sha256(JSON.stringify(sortDeep(JSON.parse(text))));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, sortDeep(nested)]));
  }
  return value;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function treeDigest(root) {
  const hash = createHash("sha256");
  for (const path of listFiles(root)) {
    hash.update(`${path.slice(root.length + 1).replaceAll("\\", "/")}\0`);
    hash.update(`${sha256File(path)}\n`);
  }
  return hash.digest("hex");
}
