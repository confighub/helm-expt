#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
check(["--generate", "--verify", "--self-test"].includes(mode), "use --generate, --verify, or --self-test");

const sourcePath = join(repoRoot, "config-catalog", "assessment-cases.yaml");
const outputRoot = join(repoRoot, "data", "config-assessment-stages");
const jsonPath = join(outputRoot, "cases.json");
const summaryPath = join(outputRoot, "summary.md");

const source = readYaml(sourcePath);
validateSource(source);
validateFixtures(source);

if (mode === "--self-test") {
  const bad = structuredClone(source);
  const blocked = bad.spec.cases.find(
    (item) => item.id === "aicr-expected-resources-components-absent",
  );
  blocked.resultState = "fail";
  let refused = false;
  try {
    validateSource(bad);
  } catch {
    refused = true;
  }
  check(refused, "the stage contract accepted missing deployed components as a failed configuration");
  console.log("verified config assessment stage self-test");
  process.exit(0);
}

const report = {
  schemaVersion: "config-assessment-stages-v1",
  generatedBy: "scripts/generate-config-assessment-stages.mjs",
  source: relativeRepo(sourcePath),
  stageOrder: source.spec.stageOrder,
  cases: source.spec.cases,
};
const json = `${JSON.stringify(report, null, 2)}\n`;
const summary = renderSummary(report);

if (mode === "--generate") {
  write(jsonPath, json);
  write(summaryPath, summary);
  console.log(`wrote ${relativeRepo(outputRoot)} (${report.cases.length} assessment cases)`);
} else {
  check(existsSync(jsonPath) && readFileSync(jsonPath, "utf8") === json, `${relativeRepo(jsonPath)} is stale`);
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summary, `${relativeRepo(summaryPath)} is stale`);
  console.log(`verified ${report.cases.length} cross-format assessment cases`);
}

function validateSource(document) {
  check(document.apiVersion === "catalog.confighub.com/v1alpha1", "assessment cases apiVersion changed");
  check(document.kind === "ConfigAssessmentCases", "assessment cases kind changed");
  check(document.metadata?.name === "cross-format-assessment-cases", "assessment cases name changed");
  check(
    sameJson(document.spec?.stageOrder, [
      "inspection",
      "materialization",
      "destination",
      "post-deployment",
    ]),
    "assessment stage order changed",
  );
  const cases = document.spec?.cases ?? [];
  check(cases.length >= 6, "fewer than six cross-format assessment cases are recorded");
  check(new Set(cases.map((item) => item.id)).size === cases.length, "assessment case ids are not unique");
  const evidenceStates = new Set(["completed", "pending", "not-run", "blocked", "not-applicable"]);
  const resultStates = new Set(["available", "pass", "watch", "fail", "pending", "not-run", "blocked", "not-applicable"]);

  for (const item of cases) {
    check(document.spec.stageOrder.includes(item.stage), `${item.id}: invalid stage`);
    check(item.format && item.question && item.answer && item.claimBoundary, `${item.id}: explanatory fields are incomplete`);
    check(Array.isArray(item.requiredInputs) && item.requiredInputs.length > 0, `${item.id}: required inputs are missing`);
    for (const key of [
      "catalogMatchRequired",
      "sourceIntentRequired",
      "destinationAccessRequired",
      "deploymentRequired",
    ]) check(typeof item[key] === "boolean", `${item.id}: ${key} must be boolean`);
    check(evidenceStates.has(item.evidenceState), `${item.id}: invalid evidence state`);
    check(resultStates.has(item.resultState), `${item.id}: invalid result state`);
    check(Array.isArray(item.evidence) && item.evidence.length > 0, `${item.id}: evidence or fixture links are missing`);
    check(!item.deploymentRequired || item.destinationAccessRequired, `${item.id}: deployment requires destination access`);
    if (item.stage === "materialization") {
      check(!item.destinationAccessRequired && !item.deploymentRequired, `${item.id}: materialization depends on a destination or deployment`);
    }
    if (item.stage === "destination") {
      check(item.destinationAccessRequired && !item.deploymentRequired, `${item.id}: destination check prerequisites are wrong`);
    }
    if (item.stage === "post-deployment") {
      check(item.destinationAccessRequired && item.deploymentRequired, `${item.id}: post-deployment prerequisites are wrong`);
    }
    if (item.evidenceState === "blocked") {
      check(["blocked", "not-run"].includes(item.resultState), `${item.id}: a blocked check was presented as a completed result`);
    }
  }

  const requiredCases = [
    "literal-yaml-inspection",
    "helm-values-materialization",
    "destination-crd-api-check",
    "aicr-snapshot-diff-without-recipe",
    "aicr-expected-resources-components-absent",
    "runtime-request-after-deployment",
  ];
  check(requiredCases.every((id) => cases.some((item) => item.id === id)), "required cross-format fixtures are missing");

  const snapshot = cases.find((item) => item.id === "aicr-snapshot-diff-without-recipe");
  check(
    snapshot.catalogMatchRequired === false
      && snapshot.sourceIntentRequired === false
      && snapshot.destinationAccessRequired === true
      && snapshot.deploymentRequired === false,
    "AICR snapshot/diff was made recipe- or deployment-dependent",
  );
  const expectedResources = cases.find(
    (item) => item.id === "aicr-expected-resources-components-absent",
  );
  check(
    expectedResources.sourceIntentRequired === true
      && expectedResources.deploymentRequired === true
      && expectedResources.evidenceState === "blocked"
      && expectedResources.resultState === "not-run",
    "AICR expected-resources does not distinguish missing deployment from failed conformance",
  );
}

function validateFixtures(document) {
  for (const item of document.spec.cases) {
    for (const path of item.evidence) {
      const absolute = join(repoRoot, path);
      check(existsSync(absolute), `${item.id}: missing evidence or fixture ${path}`);
      check(statSync(absolute).isFile() || statSync(absolute).isDirectory(), `${item.id}: invalid evidence path ${path}`);
    }
  }

  const baseline = readYaml(join(repoRoot, "tests/fixtures/config-assessment/aicr-snapshot-baseline.yaml"));
  const target = readYaml(join(repoRoot, "tests/fixtures/config-assessment/aicr-snapshot-target.yaml"));
  const baselineCmdline = measurementValue(baseline, "OS", "kernel-cmdline", "cmdline");
  const targetCmdline = measurementValue(target, "OS", "kernel-cmdline", "cmdline");
  const baselineModule = measurementValue(baseline, "OS", "kernel-modules", "nvidia_peermem");
  const targetModule = measurementValue(target, "OS", "kernel-modules", "nvidia_peermem");
  check(baselineCmdline.includes("iommu=pt") && !targetCmdline.includes("iommu=pt"), "AICR snapshot fixture does not expose iommu=pt drift");
  check(baselineModule === "loaded" && targetModule === "absent", "AICR snapshot fixture does not expose nvidia_peermem drift");

  const absent = readYaml(join(
    repoRoot,
    "tests/fixtures/config-assessment/aicr-expected-resources-components-absent.yaml",
  ));
  check(
    absent.spec?.selectedConfigurationDeployed === false
      && absent.spec?.expectedClassification?.evidenceState === "blocked"
      && absent.spec?.expectedClassification?.resultState === "not-run",
    "expected-resources fixture does not preserve the missing-deployment boundary",
  );
}

function measurementValue(snapshot, type, subtype, key) {
  const measurement = (snapshot.measurements ?? []).find((item) => item.type === type);
  const reading = (measurement?.subtypes ?? []).find((item) => item.subtype === subtype);
  return String(reading?.data?.[key] ?? "");
}

function renderSummary(report) {
  const rows = report.cases.map((item) => `| ${item.question} | \`${item.format}\` | \`${item.stage}\` | ${yesNo(item.catalogMatchRequired)} | ${yesNo(item.destinationAccessRequired)} | ${yesNo(item.deploymentRequired)} | \`${item.evidenceState}\` | \`${item.resultState}\` | ${item.answer} |`).join("\n");
  return `# Configuration assessment stages

Generated from [\`${report.source}\`](../../${report.source}).

The same four questions apply to every configuration source:

1. **What do I have?** Inspect the source, snapshot, YAML, or OCI.
2. **What will it produce?** Render, build, compose, generate, or read the exact objects.
3. **Can this destination accept it?** Check the chosen destination before apply.
4. **Did it work?** Check the delivered revision and live result after deployment.

The first two questions do not need a cluster for sources that can be processed locally. The third needs destination facts but not a deployed candidate. The fourth needs a deployment. A missing prerequisite is reported as blocked or not run, not as a failed configuration or conformance result.

| Question | Format | Stage | Catalog match needed | Destination access needed | Deployment needed | Evidence | Result | Answer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

These cases test the classification and its prerequisites. Each evidence link states its own scope; a fixture is not a live deployment receipt.
`;
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
