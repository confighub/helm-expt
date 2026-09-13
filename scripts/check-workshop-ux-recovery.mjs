#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { listFiles, listTrackedFiles, repoRoot, sha256 } from "./lib/proof-common.mjs";

const HASH_MANIFEST_NAME = "refusal-hashes.json";
const DEFAULT_ROOT = join(repoRoot, "runs", "workshop-ux");

function finding(code, message) {
  return { code, message };
}

function output(passed, findings) {
  process.stdout.write(`${JSON.stringify({
    passed,
    scope: "Validates that a preserved refusal is untouched and that recovery from it happened in a separate, differently named result; it does not validate the recovery's own correctness.",
    findings,
  })}\n`);
}

// See check-workshop-ux-predictions.mjs for why the default scan reads the
// git index (runs/ is gitignored with individual receipts force-added) while
// a --root override, used only by the self-test, reads the filesystem.
function collectFiles(root, useGit) {
  return useGit ? listTrackedFiles(root) : listFiles(root);
}

function parseArgs(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--verify")) {
    return { root: DEFAULT_ROOT, useGit: true };
  }
  if (args.length === 2 && args[0] === "--root") {
    return { root: resolve(args[1]), useGit: false };
  }
  throw new Error("invalid arguments");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeHash(value) {
  return String(value ?? "").replace(/^sha256:/, "").trim().toLowerCase();
}

// A refusal record is named for what it is, or, failing that, is any JSON
// object whose certification verdict is false. The hash manifest sitting
// beside it is never itself a refusal record, no matter what its name matches.
function isRefusalFile(path) {
  if (basename(path) === HASH_MANIFEST_NAME) return false;
  if (/refusal/i.test(basename(path))) return true;
  try {
    const parsed = readJson(path);
    return Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed) && parsed.certified === false;
  } catch {
    return false;
  }
}

// A refusal record is governed by this checker once its trial has opted into
// the hash-manifest convention by recording a refusal-hashes.json sidecar
// beside it. Earlier trials preserved their refusal a different way (a
// per-file manifest.json with its own originalSha256/retainedSha256 pair) and
// are not retroactively held to a convention that postdates them; a refusal
// with no sidecar at all is simply out of this checker's scope, not a pass or
// a fail on its own.
function isGoverned(refusalFile, allFiles) {
  return allFiles.includes(join(dirname(refusalFile), HASH_MANIFEST_NAME));
}

// Directories are derived from file paths rather than read from the
// filesystem, so existence follows the same committed-evidence rule as file
// content: a sibling directory nobody committed does not count as recovery,
// even if it happens to sit on disk in a dirty working copy.
function childDirNames(allFiles, parentDir) {
  const prefix = `${parentDir}/`;
  const names = new Set();
  for (const file of allFiles) {
    if (!file.startsWith(prefix)) continue;
    const rest = file.slice(prefix.length);
    const separator = rest.indexOf("/");
    if (separator > 0) names.add(rest.slice(0, separator));
  }
  return [...names];
}

function validateRefusalFile(refusalFile, allFiles) {
  const findings = [];
  const dir = dirname(refusalFile);
  const refusalBasename = basename(refusalFile);

  // check() only calls this on a governed refusal, so the manifest is already
  // known to exist; this guard stays as a defensive fallback for any other
  // caller rather than something reachable through the normal scan.
  const hashManifestPath = join(dir, HASH_MANIFEST_NAME);
  if (!allFiles.includes(hashManifestPath)) {
    return [finding("missing-hash-manifest", `${dir}: no ${HASH_MANIFEST_NAME} recorded beside the refusal.`)];
  }
  let hashes;
  try {
    hashes = readJson(hashManifestPath);
  } catch {
    return [finding("invalid-hash-manifest", `${hashManifestPath}: cannot be parsed as JSON.`)];
  }
  if (!hashes || typeof hashes !== "object" || Array.isArray(hashes) || !Object.hasOwn(hashes, refusalBasename)) {
    return [finding("missing-hash-entry", `${hashManifestPath}: no recorded hash for ${refusalBasename}.`)];
  }
  const recorded = normalizeHash(hashes[refusalBasename]);
  const actual = sha256(readFileSync(refusalFile));
  if (recorded !== actual) {
    findings.push(finding("refusal-tampered", `${refusalFile}: bytes no longer match the recorded hash; the refusal was overwritten.`));
  }

  const parentDir = dirname(dir);
  const recoveryDirNames = childDirNames(allFiles, parentDir).filter(
    (name) => name !== basename(dir) && /recover/i.test(name),
  );
  if (recoveryDirNames.length === 0) {
    findings.push(finding("missing-recovery-sibling", `${dir}: no sibling recovery directory holds a separate result.`));
    return findings;
  }
  for (const name of recoveryDirNames) {
    const recoveryDir = join(parentDir, name);
    const recoveryFiles = allFiles.filter((file) => file.startsWith(`${recoveryDir}/`));
    if (recoveryFiles.length === 0) {
      findings.push(finding("empty-recovery-directory", `${recoveryDir}: holds no result.`));
      continue;
    }
    if (recoveryFiles.some((file) => basename(file) === refusalBasename)) {
      findings.push(finding("recovery-reuses-filename", `${recoveryDir}: reuses ${refusalBasename} instead of recovering under a new filename.`));
    }
  }
  return findings;
}

function check(args) {
  const { root, useGit } = parseArgs(args);
  const allFiles = collectFiles(root, useGit);
  const jsonFiles = allFiles.filter((file) => file.endsWith(".json"));
  const refusalFiles = jsonFiles.filter(isRefusalFile).filter((file) => isGoverned(file, allFiles));
  if (refusalFiles.length === 0) {
    return { passed: true, findings: [finding("no-refusals", "no refusal artifacts to verify")] };
  }
  const findings = refusalFiles.flatMap((file) => validateRefusalFile(file, allFiles));
  const refusalDirs = new Set(refusalFiles.map((file) => dirname(file)));
  if (findings.length) return { passed: false, findings };
  return {
    passed: true,
    findings: [finding("recovery-validated", `verified ${refusalDirs.size} refusal dirs`)],
  };
}

try {
  const { passed, findings } = check(process.argv.slice(2));
  output(passed, findings);
  process.exitCode = passed ? 0 : 1;
} catch {
  output(false, [finding("invalid-arguments", "Arguments must be --verify, or --root <dir> for tests.")]);
  process.exitCode = 2;
}
