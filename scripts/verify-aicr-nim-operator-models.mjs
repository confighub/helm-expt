#!/usr/bin/env node

// Verify that the committed NIM-Operator model-profile records, receipts,
// and summary under data/aicr-nim-operator-models/ match what
// scripts/lib/aicr-nim-operator-models.mjs computes right now from the
// retained sample corpus under
// data/aicr-nim-operator-models/upstream/serving/. A generator that drifted
// from what is committed would otherwise go unnoticed the moment someone
// edited a committed output by hand or an upstream file changed underneath
// it.
//
// Fully offline against committed bytes: no network, no cluster, no NGC
// contact, and no wall-clock time takes part.

import { existsSync, readFileSync } from "node:fs";

import { check, relativeRepo, repoRoot } from "./lib/proof-common.mjs";
import { buildReport } from "./lib/aicr-nim-operator-models.mjs";

const report = buildReport(repoRoot);

for (const profile of report.profiles) {
  check(existsSync(profile.path), `${relativeRepo(profile.path)} is missing; run npm run aicr-nim-operator-models:generate`);
  check(
    readFileSync(profile.path, "utf8") === profile.yaml,
    `${relativeRepo(profile.path)} is stale; run npm run aicr-nim-operator-models:generate`,
  );
}
for (const receipt of report.receipts) {
  check(existsSync(receipt.path), `${relativeRepo(receipt.path)} is missing; run npm run aicr-nim-operator-models:generate`);
  check(
    readFileSync(receipt.path, "utf8") === receipt.yaml,
    `${relativeRepo(receipt.path)} is stale; run npm run aicr-nim-operator-models:generate`,
  );
}
check(
  existsSync(report.summaryPath),
  `${relativeRepo(report.summaryPath)} is missing; run npm run aicr-nim-operator-models:generate`,
);
check(
  readFileSync(report.summaryPath, "utf8") === report.summaryMd,
  `${relativeRepo(report.summaryPath)} is stale; run npm run aicr-nim-operator-models:generate`,
);

console.log(
  `verified ${report.profiles.length} NIM-Operator model profile(s) and ${report.receipts.length} receipt(s) against the retained upstream corpus`,
);
