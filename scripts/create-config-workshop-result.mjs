#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { composeWorkshopResult } from "./lib/config-workshop-result.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.length === 0) {
  console.log(`Usage:
  node scripts/create-config-workshop-result.mjs \\
    --candidate <yaml-file-or-directory> \\
    --cub-check <cub-check.json> \\
    --source-type <helm|aicr|timoni|oci|kubernetes-yaml|existing-release|mixed|unknown> \\
    --source <identity> \\
    --output <workshop-result.json> [options]

Options:
  --source-version <version>
  --visibility <public|private>       default: private
  --comparison <yaml-file-or-dir>
  --source-record <BaseVariantRecord>
  --configuration-decision <ConfigurationDecision>
  --catalog-url <url>
  --question-code <code>
  --question <plain-English question>
  --values-summary <summary>
  --created-at <ISO timestamp>       useful for reproducible examples

Run cub check first:
  cub check --format json --output cub-check.json <candidate>
`);
  process.exit(0);
}

const options = {
  candidatePath: required("--candidate"),
  cubCheckPath: required("--cub-check"),
  sourceType: required("--source-type"),
  sourceIdentity: required("--source"),
  outputPath: required("--output"),
  sourceVersion: optional("--source-version"),
  visibility: optional("--visibility") || "private",
  comparisonPath: optional("--comparison"),
  sourceRecordPath: optional("--source-record"),
  configurationDecisionPath: optional("--configuration-decision"),
  catalogUrl: optional("--catalog-url"),
  questionCode: optional("--question-code"),
  question: optional("--question"),
  valuesSummary: optional("--values-summary"),
  createdAt: optional("--created-at"),
};

const sourceTypes = new Set(["helm", "aicr", "timoni", "oci", "kubernetes-yaml", "existing-release", "mixed", "unknown"]);
if (!sourceTypes.has(options.sourceType)) throw new Error(`unsupported --source-type ${options.sourceType}`);
if (!["public", "private"].includes(options.visibility)) throw new Error("--visibility must be public or private");

const composed = composeWorkshopResult(options);
const output = resolve(options.outputPath);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, composed.text);
console.log(`wrote ${options.outputPath}`);
console.log(`candidate object set: ${composed.candidateIdentity.sha256} (${composed.candidateIdentity.objectCount} objects)`);

function optional(name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function required(name) {
  const value = optional(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}
