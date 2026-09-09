#!/usr/bin/env node

// Write the platform-to-model membership contract:
// data/aicr-nim-model-profiles/platform-members.csv and .md. This joins
// every one of the 44 AICR inference platforms to the model shapes it can
// actually run, through an explicit, delivery-scoped join: a KServe model
// shape attaches only to the KServe reference entry, the one authored
// NIMService attaches only to its home NIM platform, and every other
// platform carries zero members with a stated reason.
//
// All discovery, the join, and rendering live in
// scripts/lib/aicr-platform-members.mjs so this script and its verifier
// cannot disagree. Everything runs offline against committed bytes.

import { relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";
import { buildReport } from "./lib/aicr-platform-members.mjs";

const report = buildReport(repoRoot);
write(report.csvPath, report.csvText);
write(report.mdPath, report.mdText);

console.log(
  `wrote ${relativeRepo(report.csvPath)} and ${relativeRepo(report.mdPath)} for ${report.counts.totalPlatforms} platforms ` +
    `(${report.counts.populatedPlatforms} populated, ${report.counts.emptyPlatforms} empty, ${report.counts.totalMemberRows} member row(s))`,
);
