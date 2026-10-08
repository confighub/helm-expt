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
// It also verifies the Catalog entry files under
// data/aicr-nim-operator-models/catalog-entries/: every retained sample has
// its inventory, verdict and two routes, each matches what
// scripts/lib/nimservice-entries.mjs computes, and no file is left over from a
// sample that is gone.
//
// Fully offline against committed bytes: no network, no cluster, no NGC
// contact, and no wall-clock time takes part.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, relativeRepo, repoRoot } from "./lib/proof-common.mjs";
import { buildReport } from "./lib/aicr-nim-operator-models.mjs";
import { buildNimServiceEntryOutputs, loadNimServiceEntries, NIMSERVICE_ENTRY_ROOT } from "./lib/nimservice-entries.mjs";

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

const entries = loadNimServiceEntries({ root: repoRoot });
check(
  entries.length === report.profiles.length,
  `${entries.length} Catalog entry inventories were built for ${report.profiles.length} profiled NIMService samples; every sample needs exactly one`,
);
const entryOutputs = buildNimServiceEntryOutputs({ root: repoRoot, entries });
for (const [rel, expected] of entryOutputs) {
  const path = join(repoRoot, rel);
  check(existsSync(path), `${rel} is missing; run npm run aicr-nim-operator-models:generate`);
  check(readFileSync(path, "utf8") === expected, `${rel} is stale; run npm run aicr-nim-operator-models:generate`);
}
const onDisk = listFiles(join(repoRoot, NIMSERVICE_ENTRY_ROOT)).map(relativeRepo).sort();
const expectedPaths = [...entryOutputs.keys()].sort();
check(
  JSON.stringify(onDisk) === JSON.stringify(expectedPaths),
  `${NIMSERVICE_ENTRY_ROOT} holds ${onDisk.length} file(s) and the retained samples produce ${expectedPaths.length}; run npm run aicr-nim-operator-models:generate`,
);
const flagged = entries.filter((entry) => entry.openQuestions.length > 0);

console.log(
  `verified ${report.profiles.length} NIM-Operator model profile(s) and ${report.receipts.length} receipt(s) against the retained upstream corpus, and ${entryOutputs.size} Catalog entry file(s) for ${entries.length} NIMService variant(s) (${entries.filter((entry) => entry.nimCacheIncluded).length} with a NIMCache, ${flagged.length} marked watch)`,
);
