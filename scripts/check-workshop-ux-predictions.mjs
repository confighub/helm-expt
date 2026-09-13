#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { listFiles, listTrackedFiles, repoRoot } from "./lib/proof-common.mjs";

// A prediction entry records a call made before a command ran, so a reviewer
// can tell a genuine forecast from a caption written after the fact. The
// fields are typed strictly: a wrong type is as dishonest as a missing one.
const FIELD_TYPES = {
  command: "string",
  predictedExit: "integer",
  predictedField: "string",
  actualExit: "integer",
  actualField: "string",
  predictedAt: "iso",
  ranAt: "iso",
};
const REQUIRED_KEYS = Object.keys(FIELD_TYPES);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const DEFAULT_ROOT = join(repoRoot, "runs", "workshop-ux");

function finding(code, message) {
  return { code, message };
}

function output(passed, findings) {
  process.stdout.write(`${JSON.stringify({
    passed,
    scope: "Validates predictions.json structure and that each prediction was recorded before the command ran; it does not require a prediction to match the actual result.",
    findings,
  })}\n`);
}

function isIsoString(value) {
  return typeof value === "string" && ISO_RE.test(value) && Number.isFinite(Date.parse(value));
}

function matchesType(value, type) {
  if (type === "string") return typeof value === "string";
  if (type === "integer") return Number.isInteger(value);
  if (type === "iso") return isIsoString(value);
  return false;
}

function validateEntry(entry, location) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return [finding("invalid-entry", `${location}: entry is not an object.`)];
  }
  const findings = [];
  for (const key of REQUIRED_KEYS) {
    if (!Object.hasOwn(entry, key)) {
      findings.push(finding("missing-field", `${location}: missing required field "${key}".`));
    } else if (!matchesType(entry[key], FIELD_TYPES[key])) {
      findings.push(finding("wrong-type", `${location}: field "${key}" has the wrong type.`));
    }
  }
  // A malformed entry cannot be checked for ordering or emptiness without
  // risking a confusing cascade of findings about fields that never parsed.
  if (findings.length) return findings;
  if (entry.predictedField.trim() === "") {
    findings.push(finding("empty-predicted-field", `${location}: predictedField is empty.`));
  }
  if (!(Date.parse(entry.predictedAt) < Date.parse(entry.ranAt))) {
    findings.push(finding("prediction-not-before-run", `${location}: predictedAt must be strictly before ranAt.`));
  }
  return findings;
}

// Committed evidence is the only evidence the chain trusts: runs/ is
// gitignored with individual receipts force-added, so a working copy can hold
// predictions.json files nobody committed. The default scan reads the git
// index rather than the filesystem so a clean checkout and a dirty working
// copy report the same thing. A --root override (used by the self-test) reads
// the filesystem directly, because its fixtures live in a temp directory the
// git index never sees.
function collectPredictionsFiles(root, useGit) {
  const files = useGit ? listTrackedFiles(root) : listFiles(root);
  return files.filter((file) => basename(file) === "predictions.json");
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

function check(args) {
  const { root, useGit } = parseArgs(args);
  const files = collectPredictionsFiles(root, useGit);
  if (files.length === 0) {
    return { passed: true, findings: [finding("no-predictions", "no predictions to verify")] };
  }
  const findings = [];
  let totalEntries = 0;
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      findings.push(finding("invalid-json", `${file}: cannot be parsed as JSON.`));
      continue;
    }
    if (!Array.isArray(parsed)) {
      findings.push(finding("invalid-predictions-file", `${file}: predictions.json must be an array.`));
      continue;
    }
    parsed.forEach((entry, index) => {
      totalEntries += 1;
      findings.push(...validateEntry(entry, `${file}[${index}]`));
    });
  }
  if (findings.length) return { passed: false, findings };
  return {
    passed: true,
    findings: [finding("predictions-validated", `verified ${totalEntries} entries across ${files.length} files`)],
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
