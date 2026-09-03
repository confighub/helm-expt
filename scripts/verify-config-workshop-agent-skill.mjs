#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot } from "./lib/proof-common.mjs";

const skillRoot = join(repoRoot, "skills", "config-workshop");
const skillPath = join(skillRoot, "SKILL.md");
const processingPath = join(skillRoot, "references", "processing-model.md");
const playbookPath = join(skillRoot, "references", "task-playbook.md");
const metadataPath = join(skillRoot, "agents", "openai.yaml");
const evalPath = join(repoRoot, "tests", "agent-skills", "config-workshop", "evals.json");
const publishedRoot = join(repoRoot, "site", ".well-known", "agent-skills", "config-workshop");
const discoveryPath = join(repoRoot, "site", ".well-known", "agent-skills", "index.json");

for (const path of [skillPath, processingPath, playbookPath, metadataPath, evalPath]) {
  check(existsSync(path), `${path.slice(repoRoot.length + 1)} is missing`);
}

const skill = readFileSync(skillPath, "utf8");
const processing = readFileSync(processingPath, "utf8");
const playbook = readFileSync(playbookPath, "utf8");
const metadata = readFileSync(metadataPath, "utf8");
const evals = JSON.parse(readFileSync(evalPath, "utf8"));

for (const phrase of [
  "name: config-workshop",
  "Find a known answer",
  "Check my config",
  "Promote my config",
  "Missing coverage means \"not checked\"",
  "Never print Secret values",
  "Do not run `kubectl apply`",
  "source-package OCI",
  "Timoni builds a module or bundle",
  "npm run workshop:ci-report",
]) {
  check(skill.includes(phrase), `skills/config-workshop/SKILL.md must include: ${phrase}`);
}
for (const phrase of [
  "Source and intent",
  "Materialize exact Kubernetes objects",
  "Decide flattening",
  "Record lifecycle work",
  "OCI is transport",
  "Timoni",
  "AICR",
  "Kubara",
]) {
  check(processing.includes(phrase), `processing-model.md must include: ${phrase}`);
}
for (const phrase of ["site/changes.json", "base-variant-records.json", "Checks not run", "ConfigHub handoff", "workshop-result.json", "workshop:ci-report"]) {
  check(playbook.includes(phrase), `task-playbook.md must include: ${phrase}`);
}
check(metadata.includes('display_name: "ConfigHub Workshop"'), "agent metadata must name ConfigHub Workshop");
check(!/\bcub install\b/.test([skill, processing, playbook].join("\n")), "agent skill must say cub installer, not cub install");

check(evals.schemaVersion === "1", "agent eval schemaVersion must be 1");
check(evals.skill === "config-workshop", "agent eval skill name must match");
check(Array.isArray(evals.cases) && evals.cases.length >= 7, "agent evals must cover at least seven tasks");
const ids = new Set();
for (const item of evals.cases) {
  check(item.id && !ids.has(item.id), `agent eval id is missing or repeated: ${item.id}`);
  ids.add(item.id);
  check(String(item.prompt ?? "").length >= 20, `${item.id}: prompt is too short`);
  check(Array.isArray(item.expected) && item.expected.length >= 2, `${item.id}: expected outcomes are incomplete`);
  check(Array.isArray(item.forbidden) && item.forbidden.length >= 1, `${item.id}: forbidden outcomes are missing`);
}

for (const relative of ["SKILL.md", "references/processing-model.md", "references/task-playbook.md"]) {
  const source = join(skillRoot, relative);
  const published = join(publishedRoot, relative);
  check(existsSync(published), `published agent skill is missing ${relative}; run npm run site:generate`);
  check(readFileSync(source, "utf8") === readFileSync(published, "utf8"), `published agent skill is stale: ${relative}`);
}
check(existsSync(discoveryPath), "published agent skill discovery index is missing");
const discovery = JSON.parse(readFileSync(discoveryPath, "utf8"));
check(discovery.skills?.some((item) => item.name === "config-workshop"), "agent skill discovery index does not list config-workshop");

console.log(`verified ConfigHub Workshop agent skill and ${evals.cases.length} task contract(s); no task-completion claim is made`);
