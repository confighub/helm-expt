#!/usr/bin/env node

// Verify that the committed NIM model-shape candidate views under
// data/aicr-nim-model-profiles/ (candidates.csv, candidates.md,
// candidates.html) match what
// scripts/lib/aicr-nim-model-profile-catalog.mjs computes right now from the
// digest-bound member index and its retained source files. Also asserts the
// candidate count equals the number of `role: model-shape` members in that
// index, so a member added or removed from the index cannot go unnoticed.
//
// Fully offline against committed bytes: no network, no cluster, no NGC
// contact, and no wall-clock time takes part.

import { existsSync, readFileSync } from "node:fs";

import { check, relativeRepo, repoRoot } from "./lib/proof-common.mjs";
import { buildCatalog } from "./lib/aicr-nim-model-profile-catalog.mjs";

const GENERATE_HINT = "run npm run aicr-nim-model-profile-catalog:generate";

const report = buildCatalog(repoRoot);

check(
  report.candidates.length === report.modelShapeMemberCount,
  `candidate count ${report.candidates.length} does not equal the ${report.modelShapeMemberCount} role: model-shape member(s) in ${report.digestIndexPathRepo}; ${GENERATE_HINT}`,
);

for (const [path, text, label] of [
  [report.csvPath, report.csvText, "candidates.csv"],
  [report.mdPath, report.mdText, "candidates.md"],
  [report.htmlPath, report.htmlText, "candidates.html"],
]) {
  check(existsSync(path), `${relativeRepo(path)} is missing; ${GENERATE_HINT}`);
  check(readFileSync(path, "utf8") === text, `${relativeRepo(path)} is stale (${label} drifted from the computed view); ${GENERATE_HINT}`);
}

console.log(
  `verified ${report.counts.total} NIM model-shape candidate(s) against the digest index ` +
    `(${report.counts.profiled} profiled, ${report.counts.receipted} receipted, ${report.counts.termsRead} terms-read)`,
);
