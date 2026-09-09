#!/usr/bin/env node

// Write one Dynamo model-profile record plus one config-plane receipt for
// every `kind: DynamoGraphDeployment` document retained under
// data/aicr-dynamo-models/upstream/recipes/, NVIDIA's own ai-dynamo/dynamo
// production recipes corpus. It creates no new catalog entry and changes no
// catalog count.
//
// All extraction, consistency checking, and rendering lives in
// scripts/lib/aicr-dynamo-models.mjs so this script and its verifier cannot
// disagree. Everything runs offline against committed bytes.

import { relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";
import { buildReport } from "./lib/aicr-dynamo-models.mjs";

const report = buildReport(repoRoot);
for (const profile of report.profiles) write(profile.path, profile.yaml);
for (const receipt of report.receipts) write(receipt.path, receipt.yaml);
write(report.summaryPath, report.summaryMd);

console.log(
  `wrote ${report.profiles.length} model profile(s), ${report.receipts.length} receipt(s), and ${relativeRepo(report.summaryPath)}`,
);
