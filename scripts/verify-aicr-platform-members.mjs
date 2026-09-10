#!/usr/bin/env node

// Verify that the committed platform-to-model membership contract under
// data/aicr-nim-model-profiles/ (platform-members.csv, platform-members.md)
// matches what scripts/lib/aicr-platform-members.mjs computes right now from
// the AICR recipe criteria, the shared KServe model-profile catalog, and the
// one authored NIMService file. buildReport() itself asserts the platform
// count, the join rule, and the per-platform membership counts, so any drift
// in those facts fails here before the byte-for-byte comparison even runs.
//
// Fully offline against committed bytes: no network, no cluster, no NGC
// contact, and no wall-clock time takes part.

import assert from "node:assert/strict";

import { existsSync, readFileSync } from "node:fs";

import { check, relativeRepo, repoRoot } from "./lib/proof-common.mjs";
import { buildReport, parseGpuCount } from "./lib/aicr-platform-members.mjs";

const GENERATE_HINT = "run npm run aicr-platform-members:generate";

// Malformed quantities must not silently become smaller hardware requirements.
for (const invalid of ["1.5", 1.5, "2gpu", "1e2", " 2", "2 ", "0", 0, -1, null, true, [2], {}, "9007199254740993"]) {
  assert.throws(() => parseGpuCount(invalid), /GPU count/);
}
assert.equal(parseGpuCount("2"), 2);
assert.equal(parseGpuCount(8), 8);

const report = buildReport(repoRoot);

for (const [path, text, label] of [
  [report.csvPath, report.csvText, "platform-members.csv"],
  [report.mdPath, report.mdText, "platform-members.md"],
]) {
  check(existsSync(path), `${relativeRepo(path)} is missing; ${GENERATE_HINT}`);
  check(readFileSync(path, "utf8") === text, `${relativeRepo(path)} is stale (${label} drifted from the computed view); ${GENERATE_HINT}`);
}

console.log(
  `verified ${report.counts.totalPlatforms} inference platform(s) ` +
    `(${report.counts.populatedPlatforms} populated, ${report.counts.emptyPlatforms} empty, ${report.counts.totalMemberRows} member row(s)) ` +
    "against the recipe criteria and the shared KServe model-profile catalog",
);
