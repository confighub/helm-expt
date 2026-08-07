#!/usr/bin/env node
// NO-TEMP-PATHS gate.
//
// A machine-specific scratch path in a committed artifact is noise at best and a
// leak of somebody's filesystem layout at worst. It also churns diffs: the same
// generator run on a laptop and on a runner produces different bytes. The repo
// already normalizes these to a literal <tmp> placeholder when it records a
// command (scripts/lib/proof-kit.mjs) and when it captures output
// (normalizeTempPaths in scripts/lib/proof-common.mjs). This lane makes the
// convention permanent for new work: it fails when a tracked file in scope
// contains an absolute macOS or Linux scratch path.
//
// Scope notes:
//   - runs/ is exempt, matching the no-personal-names precedent. Those receipts
//     are recorded evidence: several are verbatim tool transcripts, and a rewrite
//     would falsify what the run actually printed.
//   - Two live-run receipts sit outside runs/ by an older filing choice. They are
//     recorded evidence too, so they are named exemptions rather than edits, and
//     the site page generated from one of them is exempt for the same reason.
//     Do not add an exemption for a file a generator can simply normalize.
//   - This script is excluded from its own scan because it must hold the pattern.
//
// Usage:
//   node scripts/verify-no-temp-paths.mjs   # exit 1 on any hit
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const PATTERN = "/var/folders/|/private/tmp/";
const SELF = "scripts/verify-no-temp-paths.mjs";

// Recorded live evidence that predates the convention. Each is the output of a
// real cluster run, so its text stays as observed.
const RECORDED_EVIDENCE = [
  "data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml",
  "data/crd-ordering-gap/summary.md",
  "data/crd-ordering-gap/summary.html",
  "site/d/data/crd-ordering-gap/summary.html",
];

const res = spawnSync(
  "git",
  [
    "grep",
    "-nE",
    PATTERN,
    "--",
    ".",
    ":(exclude)runs",
    `:(exclude)${SELF}`,
    ...RECORDED_EVIDENCE.map((path) => `:(exclude)${path}`),
  ],
  { cwd: repoRoot, encoding: "utf8" },
);

if (res.error) throw res.error;

if (res.status === 1) {
  console.log("no-temp-paths gate: clean (all tracked files outside runs/ and the named recorded receipts)");
  process.exit(0);
}

if (res.status === 0) {
  const lines = res.stdout.trim().split("\n");
  console.error(res.stdout.trim());
  console.error("");
  console.error(`no-temp-paths gate: ${lines.length} line(s) above record a machine-specific scratch path.`);
  console.error("Route captured text through normalizeTempPaths from scripts/lib/proof-common.mjs, or write");
  console.error("the recorded command with a literal <tmp> placeholder, then regenerate the artifact.");
  console.error("runs/ receipts are exempt as recorded evidence; every other tracked file is in scope.");
  process.exit(1);
}

console.error(res.stderr.trim() || `git grep exited with status ${res.status}`);
process.exit(2);
