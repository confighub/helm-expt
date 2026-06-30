#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { check, cubEnv, listFiles, relativeRepo, repoRoot } from "./lib/proof-common.mjs";
import { installerOciRefForPackagePath } from "./lib/installer-oci.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const packageArg = valueAfter("--package");
const limitArg = valueAfter("--limit");
const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

if (args.includes("--help")) {
  console.log(`Usage:
  node scripts/publish-installer-oci-packages.mjs [--package packages/<repo>/<chart>/<version>] [--limit N] [--dry-run]

Publishes installer package source directories to their assigned OCI refs and
writes runs/installer-oci/<slug>/<tag>/installer-package-publication-receipt.yaml.

Requires registry credentials with package write permission, for example a GHCR
token with write:packages for ghcr.io/confighub/helm-expt.
`);
  process.exit(0);
}

if (limitArg) check(Number.isFinite(limit) && limit > 0, "--limit must be a positive integer");

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
    const normalized = packageArg.replace(/\/+$/, "");
    check(normalized.startsWith("packages/"), "--package must be a repo-relative packages/... path");
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
    const pushOutput = run("cub", ["installer", "push", archivePath, ociRef]);
    const inspectOutput = run("cub", ["installer", "inspect", ociRef, "--json"]);
    const receiptPath = receiptPathFor(packagePath);
    writeReceipt(receiptPath, {
      packagePath,
      archiveName,
      ociRef,
      packageSha,
      packageOutput,
      pushOutput,
      inspectOutput,
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
  commands:
    package: "cub installer package ${receipt.packagePath} -o <tmp>/${receipt.archiveName}"
    push: "cub installer push <tmp>/${receipt.archiveName} ${receipt.ociRef}"
    inspect: "cub installer inspect ${receipt.ociRef} --json"
  outputs:
    package: |
${indentBlock(receipt.packageOutput.trimEnd(), 6)}
    push: |
${indentBlock(receipt.pushOutput.trimEnd(), 6)}
    inspectJSONSHA256: ${sha256(receipt.inspectOutput)}
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

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
