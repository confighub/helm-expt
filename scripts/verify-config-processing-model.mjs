#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const documents = {
  doctrine: read("docs/reference/config-catalog-doctrine.md"),
  dataModel: read("docs/user/confighub-data-model.md"),
  vocabulary: read("docs/user/model-and-vocabulary.md"),
  flattening: read("docs/reference/flattening-alignment.md"),
  deployment: read("site/how-it-works.html"),
};
const corpus = Object.values(documents).join("\n");
const failures = [];

function requireText(scope, text, label) {
  if (!scope.includes(text)) failures.push(`${label}: missing ${JSON.stringify(text)}`);
}

for (const term of [
  "source + processing intent",
  "materialize exact Kubernetes objects",
  "decide whether to flatten",
  "attach lifecycle routes and protected ownership",
  "retain, compare, promote, and publish",
  "reconcile on a target",
  "observe the runtime result",
]) {
  requireText(documents.doctrine, term, "canonical pipeline");
}

const sourceScenarios = [
  ["Helm chart", "Run Helm with recorded values and render context", "Helm render variant"],
  ["AICR, Kubara, or another generator", "generation or composition step", "process late"],
  ["Installer or source OCI", "invoke the processor", "not automatically deployable"],
  ["Literal configuration OCI", "Materialization is a no-op", "Already flat"],
  ["Plain Kubernetes YAML", "Read, parse, and canonicalize", "Already flat"],
  ["ConfigHub Units or release OCI", "Read the retained exact objects", "Already retained as data"],
];
for (const [source, materialization, outcome] of sourceScenarios) {
  requireText(documents.doctrine, source, `${source} scenario`);
  requireText(documents.doctrine, materialization, `${source} scenario`);
  requireText(documents.doctrine, outcome, `${source} scenario`);
}

const decisionScenarios = [
  ["safe-to-flatten", "Safe to flatten", "no required Helm behavior outside the retained objects"],
  ["flatten-with-routes", "Flatten with routes", "Retain the literal objects"],
  ["process-late", "Process late (`render late` for Helm)", "live lookup"],
  ["explicit-no-route", "No route required", "different from a missing record"],
];
for (const [id, decision, boundary] of decisionScenarios) {
  requireText(documents.doctrine, decision, `${id} scenario`);
  requireText(corpus, boundary, `${id} scenario`);
}

const protectionScenarios = [
  ["field ownership", "Protected local field", "downstream variant"],
  ["secret input", "Secret or protected input", "Secret reference"],
  ["prune behavior", "Prune-protected resource", "delivery behavior"],
];
for (const [id, term, boundary] of protectionScenarios) {
  requireText(documents.doctrine, term, `${id} scenario`);
  requireText(documents.doctrine, boundary, `${id} scenario`);
}

for (const term of [
  "materialization",
  "Helm renders a chart",
  "Literal YAML and configuration OCI already contain the objects",
  "Keep them with recorded setup",
  "Process the source later",
  "Record lifecycle routes separately",
  "Source OCI",
  "Plain YAML",
  "ConfigHub Units",
  "Protection means three different things",
  "Protected local field",
  "Protected input",
  "Prune-protected resource",
  "Apply gates decide whether ConfigHub may apply it",
  "source receipt -> object receipt -> delivery receipt -> runtime receipt",
]) {
  requireText(documents.deployment, term, "public deployment explanation");
}

requireText(documents.dataModel, "Do not create a fake render variant", "source-specific records");
requireText(documents.dataModel, "complete managed result is source and intent, exact configuration, lifecycle routes,\nand runtime receipts", "complete record");
requireText(documents.flattening, "No-op cases still need records", "no-op processing");

for (const match of corpus.matchAll(/full rendering/gi)) {
  const context = corpus.slice(Math.max(0, match.index - 80), match.index + 80);
  if (!/do not call/i.test(context)) failures.push(`unsupported "full rendering" usage: ${context.replaceAll("\n", " ")}`);
}

if (failures.length) {
  console.error("configuration processing model failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verified source-neutral configuration processing model: 6 sources, 4 processing decisions, and 3 protection classes");
