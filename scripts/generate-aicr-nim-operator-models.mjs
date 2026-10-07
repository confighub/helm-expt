#!/usr/bin/env node

// Write one NIM-Operator model-profile record plus one config-plane receipt
// for every `kind: NIMService` document retained under
// data/aicr-nim-operator-models/upstream/serving/, NVIDIA's own
// k8s-nim-operator sample corpus. This is distinct from
// scripts/generate-aicr-nim-model-profiles.mjs, which profiles the
// kserve-nim-inference entry's retained nim-deploy KServe subtree.
//
// It also writes, for each retained sample, the files its Catalog record is
// built from: an entry inventory, a flattening-safety verdict, and two route
// intents (operator first, and the Secrets the user supplies). They sit under
// data/aicr-nim-operator-models/catalog-entries/<slug>/. The record itself is
// written by `npm run config-catalog`, which reads these files and refuses a
// missing or stale one.
//
// All extraction, consistency checking, and rendering lives in
// scripts/lib/aicr-nim-operator-models.mjs and scripts/lib/nimservice-entries.mjs
// so this script and its verifier cannot disagree. Everything runs offline
// against committed bytes.

import { rmSync } from "node:fs";
import { join } from "node:path";

import { relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";
import { buildReport } from "./lib/aicr-nim-operator-models.mjs";
import { buildNimServiceEntryOutputs, NIMSERVICE_ENTRY_ROOT } from "./lib/nimservice-entries.mjs";

const report = buildReport(repoRoot);
for (const profile of report.profiles) write(profile.path, profile.yaml);
for (const receipt of report.receipts) write(receipt.path, receipt.yaml);
write(report.summaryPath, report.summaryMd);

// The entry files are rewritten as a set, so a sample that leaves the corpus
// does not leave a verdict behind.
const entryOutputs = buildNimServiceEntryOutputs({ root: repoRoot });
rmSync(join(repoRoot, NIMSERVICE_ENTRY_ROOT), { recursive: true, force: true });
for (const [rel, text] of entryOutputs) write(join(repoRoot, rel), text);

console.log(
  `wrote ${report.profiles.length} model profile(s), ${report.receipts.length} receipt(s), ${relativeRepo(report.summaryPath)}, and ${entryOutputs.size} Catalog entry file(s) under ${NIMSERVICE_ENTRY_ROOT}`,
);
