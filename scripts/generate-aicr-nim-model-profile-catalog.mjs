#!/usr/bin/env node

// Write a decision-neutral candidate-and-readiness view over the 16
// `role: model-shape` members of the kserve-nim-inference entry's
// digest-bound member index: data/aicr-nim-model-profiles/candidates.csv,
// candidates.md, and candidates.html. This adds no register entry, creates
// no catalog entry, and changes no catalog count; it is a derived view over
// files this repository already commits.
//
// All extraction and rendering lives in
// scripts/lib/aicr-nim-model-profile-catalog.mjs so this script and its
// verifier cannot disagree. Everything runs offline against committed
// bytes.

import { relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";
import { buildCatalog } from "./lib/aicr-nim-model-profile-catalog.mjs";

const report = buildCatalog(repoRoot);
write(report.csvPath, report.csvText);
write(report.mdPath, report.mdText);
write(report.htmlPath, report.htmlText);

console.log(
  `wrote ${relativeRepo(report.csvPath)}, ${relativeRepo(report.mdPath)}, and ${relativeRepo(report.htmlPath)} for ${report.counts.total} candidates ` +
    `(${report.counts.profiled} profiled, ${report.counts.receipted} receipted, ${report.counts.termsRead} terms-read)`,
);
