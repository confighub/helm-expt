#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const sourcePath = join(repoRoot, "config-catalog", "managed-journeys.yaml");
const outputRoot = join(repoRoot, "data", "managed-journey-coverage");
const summaryPath = join(outputRoot, "summary.md");
const jsonPath = join(outputRoot, "journeys.json");
const allowedTechnicalResults = new Set(["pass", "partial", "blocked", "not-run"]);
const allowedUserTrials = new Set(["pass", "partial", "blocked", "not-run"]);

if (!["--generate", "--verify"].includes(mode)) {
  console.log("Usage: node scripts/generate-managed-journey-coverage.mjs --generate|--verify");
  process.exit(1);
}

const report = buildReport();
if (mode === "--generate") {
  write(summaryPath, report.summary);
  write(jsonPath, report.json);
  console.log(`wrote managed journey coverage for ${report.journeys.length} journey(s)`);
} else {
  verifyFile(summaryPath, report.summary);
  verifyFile(jsonPath, report.json);
  console.log(`verified managed journey coverage for ${report.journeys.length} journey(s)`);
}

function buildReport() {
  const document = readYaml(sourcePath);
  check(document?.apiVersion === "catalog.confighub.com/v1alpha1", "managed journey apiVersion is invalid");
  check(document?.kind === "ManagedJourneyCoverage", "managed journey kind is invalid");
  check(document?.metadata?.name === "config-workshop-managed-journeys", "managed journey name is invalid");
  check(typeof document?.spec?.purpose === "string" && document.spec.purpose.trim(), "managed journey purpose is missing");
  const journeys = document?.spec?.journeys;
  check(Array.isArray(journeys) && journeys.length === 6, `managed journey plan must contain six journeys, found ${journeys?.length ?? 0}`);

  const packageScripts = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8").toString()).scripts ?? {};
  const ids = new Set();
  for (const journey of journeys) {
    check(typeof journey.id === "string" && journey.id, "managed journey id is missing");
    check(!ids.has(journey.id), `duplicate managed journey ${journey.id}`);
    ids.add(journey.id);
    check(typeof journey.question === "string" && journey.question.endsWith("?"), `${journey.id} must use a plain question`);
    check(allowedTechnicalResults.has(journey.technicalResult), `${journey.id} has invalid technicalResult`);
    check(allowedUserTrials.has(journey.userTrial), `${journey.id} has invalid userTrial`);
    check(Array.isArray(journey.evidence) && journey.evidence.length, `${journey.id} has no evidence`);
    for (const path of journey.evidence) {
      check(existsSync(join(repoRoot, path)), `${journey.id} names missing evidence ${path}`);
    }
    check(Array.isArray(journey.verify) && journey.verify.length, `${journey.id} has no verifier`);
    for (const command of journey.verify) {
      const match = String(command).match(/^npm run ([a-zA-Z0-9:_-]+)$/);
      check(match, `${journey.id} has invalid verification command ${command}`);
      check(packageScripts[match[1]], `${journey.id} names missing npm script ${match[1]}`);
    }
    check(typeof journey.limit === "string" && journey.limit.trim(), `${journey.id} must state its limit`);
  }

  const generated = {
    apiVersion: document.apiVersion,
    kind: document.kind,
    metadata: document.metadata,
    spec: {
      purpose: document.spec.purpose,
      counts: {
        technicalPass: journeys.filter((journey) => journey.technicalResult === "pass").length,
        userTrialPass: journeys.filter((journey) => journey.userTrial === "pass").length,
        userTrialNotRun: journeys.filter((journey) => journey.userTrial === "not-run").length,
      },
      journeys,
    },
  };

  return {
    journeys,
    json: `${JSON.stringify(generated, null, 2)}\n`,
    summary: summary(generated),
  };
}

function summary(document) {
  const { counts, journeys } = document.spec;
  return `# Managed Journey Coverage

This record tracks the six journeys that connect the public Config Workshop to
ConfigHub. It deliberately separates a working technical proof from evidence
that an ordinary user can complete the journey without help.

Generated from [config-catalog/managed-journeys.yaml](../../config-catalog/managed-journeys.yaml).

## Current result

\`\`\`text
technical pass:   ${counts.technicalPass}/${journeys.length}
user trial pass:  ${counts.userTrialPass}/${journeys.length}
user trial not run: ${counts.userTrialNotRun}/${journeys.length}
\`\`\`

| User question | Technical result | User trial | Current limit |
| --- | --- | --- | --- |
${journeys.map((journey) => `| ${cell(journey.question)} | ${journey.technicalResult} | ${journey.userTrial} | ${cell(journey.limit)} |`).join("\n")}

## Evidence and commands

| Journey | Evidence | Verify |
| --- | --- | --- |
${journeys.map((journey) => `| ${journey.id} | ${journey.evidence.map((path) => `[${path}](../../${path})`).join("<br>")} | ${journey.verify.map((command) => `\`${command}\``).join("<br>")} |`).join("\n")}

## Reading rule

A technical pass means the named example has committed evidence and a verifier.
It does not mean the public website, CLI, or ConfigHub browser makes the journey
easy for a new user. A user-trial pass requires an outside user to complete the
same task with their own input and normal AI assistant. No such trial is recorded
for these six journeys yet.
`;
}

function cell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function verifyFile(path, expected) {
  check(existsSync(path) && readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; regenerate managed journey coverage`);
}
