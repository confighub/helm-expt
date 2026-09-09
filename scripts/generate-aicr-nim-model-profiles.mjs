#!/usr/bin/env node

// Write one NIM model-profile record plus one config-plane receipt for each
// of three NIM model shapes already retained under
// examples/aicr/kserve-nim-inference/upstream/kserve/. This proves the
// generation-and-receipt mechanics end to end on real, license-cleared
// bytes, alongside the entry's existing first described profile. It creates
// no new catalog entry and changes no count.
//
// All extraction, consistency checking, and rendering lives in
// scripts/lib/aicr-nim-model-profiles.mjs so this script and its verifier
// cannot disagree. Everything runs offline against committed bytes.

import { relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";
import { buildReport } from "./lib/aicr-nim-model-profiles.mjs";

const report = buildReport(repoRoot);
for (const profile of report.profiles) write(profile.path, profile.yaml);
for (const receipt of report.receipts) write(receipt.path, receipt.yaml);
write(report.summaryPath, report.summaryMd);

console.log(
  `wrote ${report.profiles.length} model profile(s), ${report.receipts.length} receipt(s), and ${relativeRepo(report.summaryPath)}`,
);
