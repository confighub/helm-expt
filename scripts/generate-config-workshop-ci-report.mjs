#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { buildWorkshopCiReport, renderWorkshopCiMarkdown } from "./lib/config-workshop-ci-report.mjs";
import { composeWorkshopResult } from "./lib/config-workshop-result.mjs";
import { check, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "config-workshop-ci-report");
const outputs = buildOutputs();

if (mode === "--generate") {
  for (const [path, content] of outputs) write(path, content);
  console.log(`wrote ${outputs.size} Config Workshop CI report artifacts`);
} else if (mode === "--verify") {
  for (const [path, content] of outputs) {
    check(existsSync(path), `${path} is missing; run npm run workshop:ci-report:generate`);
    check(readFileSync(path, "utf8") === content, `${path} is stale; run npm run workshop:ci-report:generate`);
  }
  console.log(`verified ${outputs.size} Config Workshop CI report artifacts`);
} else if (mode === "--self-test") {
  runSelfTest();
  console.log("Config Workshop CI report self-test passed");
} else {
  console.log(`Usage:
  node scripts/generate-config-workshop-ci-report.mjs --generate
  node scripts/generate-config-workshop-ci-report.mjs --verify
  node scripts/generate-config-workshop-ci-report.mjs --self-test`);
  process.exitCode = 1;
}

function buildOutputs() {
  const cases = [
    {
      id: "nginx-reviewed",
      result: readResult("data/config-workshop-command-contract/helm/workshop-result.json"),
      purpose: "AI-written Helm values corrected, reviewed, and retained with one scoped exception.",
    },
    {
      id: "kubernetes-yaml",
      result: readResult("data/config-workshop-command-contract/kubernetes-yaml/workshop-result.json"),
      purpose: "Literal Kubernetes YAML checked with the same report contract; rendering is a no-op.",
    },
    {
      id: "redis-reuse-existing-secret",
      result: buildRedisResult(),
      purpose: "A Redis Catalog configuration checked for storage and credential handling before use.",
    },
  ];
  const built = new Map();
  const summaries = [];
  for (const item of cases) {
    const report = buildWorkshopCiReport(item.result, { artifactBase: "./" });
    const directory = join(outputRoot, item.id);
    built.set(join(directory, "workshop-result.json"), `${JSON.stringify(item.result, null, 2)}\n`);
    built.set(join(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    built.set(join(directory, "report.md"), renderWorkshopCiMarkdown(report, { headingLevel: 1 }));
    for (const file of item.result.spec.files) built.set(join(directory, file.path), canonicalText(file.content));
    summaries.push({ ...item, report });
  }
  built.set(join(outputRoot, "summary.md"), renderSummary(summaries));
  return built;
}

function buildRedisResult() {
  const receipt = JSON.parse(readFileSync(
    join(repoRoot, "data/catalog-shared-checks/receipts/bitnami-redis-25-5-3-reuse-existing-secret.json"),
    "utf8",
  ));
  return composeWorkshopResult({
    candidatePath: join(repoRoot, "recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml"),
    cubCheckText: `${JSON.stringify(receipt.scannerResult, null, 2)}\n`,
    sourceRecordPath: join(repoRoot, "data/base-variant-records/records/bitnami-redis-25-5-3-reuse-existing-secret.yaml"),
    sourceType: "helm",
    visibility: "public",
    sourceIdentity: "bitnami/redis",
    sourceVersion: "25.5.3",
    valuesSummary: "Catalog preset: reuse-existing-secret",
    questionCode: "ci-render-check",
    question: "What should a pull-request reviewer know before using this Redis configuration?",
    catalogUrl: "https://confighub.github.io/helm-expt/site/charts/bitnami-redis-25-5-3.html",
    createdAt: receipt.scannerResult.provenance.scan_time,
  }).result;
}

function readResult(path) {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
}

function renderSummary(cases) {
  const rows = cases.map((item) => `| ${item.id} | ${item.purpose} | ${item.report.verdictLabel} | [Markdown](${item.id}/report.md) · [JSON](${item.id}/report.json) · [complete result](${item.id}/workshop-result.json) |`).join("\n");
  return `# Pull-request reports from Config Workshop results

This command turns one source-neutral \`WorkshopResult\` into a short pull-request
comment. It reports the exact object-set hash, what changed, local findings,
lifecycle requirements, checks that ran, and checks that did not run.

Start with the [CI guide](../../docs/user/ci-render-check.md) for the local command
and optional GitHub Actions example.

It does not label a static check as deployment or runtime proof. The strongest
clear result says **No blocker found in the completed checks**. Destination,
delivery, health, drift, and rollback remain separate until their receipts exist.

## Run it

\`\`\`bash
npm run workshop:ci-report -- \\
  --input workshop-result.json \\
  --output comment.md \\
  --fail-on blocked
\`\`\`

Use \`--fail-on needs-review\` when unresolved findings or omitted checks must stop
CI. Use \`--format json\` when another tool or AI assistant should consume the
same report.

The JSON form follows the [Config Workshop CI report schema](https://confighub.github.io/helm-expt/site/workshop-ci-report.schema.json).

## Worked reports

| Example | What it shows | Result | Files |
| --- | --- | --- | --- |
${rows}

The Redis report satisfies the original chart-analysis use case without making
the format Helm-specific. Helm, AICR, Timoni, OCI, and literal YAML can all use
this report after they have produced exact Kubernetes objects and a
\`WorkshopResult\`.
`;
}

function runSelfTest() {
  const nginx = readResult("data/config-workshop-command-contract/helm/workshop-result.json");
  const report = buildWorkshopCiReport(nginx);
  check(report.verdict === "needs-review", "reviewed NGINX result must still name omitted checks and its scoped exception");
  check(report.checks.runtime === "not-checked", "local report must not claim runtime status");
  check(report.candidate.objectSetSha256 === nginx.spec.candidate.objectSet.sha256, "report changed the candidate object identity");
  check(!renderWorkshopCiMarkdown(report).includes("safe to deploy"), "report must not turn a static check into a deployment claim");

  const blocked = structuredClone(nginx);
  blocked.spec.findingDecisions.outcomes[0].decision = "rejected";
  check(buildWorkshopCiReport(blocked).verdict === "blocked", "a rejected finding must block the report");

  const unknown = structuredClone(nginx);
  unknown.spec.checks.advisoryReceipts[0].input.objectSetSha256 = `sha256:${"0".repeat(64)}`;
  check(buildWorkshopCiReport(unknown).verdict === "unknown", "a mismatched check receipt must make the result unknown");

  const tampered = structuredClone(nginx);
  tampered.spec.files.find((file) => file.path === "candidate.yaml").content += "# tampered\n";
  expectFailure(() => buildWorkshopCiReport(tampered), "does not match its recorded SHA-256");

  const traversal = structuredClone(nginx);
  traversal.spec.files[0].path = "../candidate.yaml";
  expectFailure(() => buildWorkshopCiReport(traversal), "unsafe embedded file path");

  const clear = structuredClone(nginx);
  const scanFile = clear.spec.files.find((file) => file.path === "cub-check.json");
  const scan = JSON.parse(scanFile.content);
  scan.findings = [];
  scan.finding_count = 0;
  scanFile.content = `${JSON.stringify(scan, null, 2)}\n`;
  scanFile.sha256 = sha256(scanFile.content);
  clear.spec.checks.advisoryReceipts[0].findingCount = 0;
  clear.spec.checks.advisoryReceipts[0].findingIds = [];
  clear.spec.checks.notRun = [];
  clear.spec.findingDecisions = {
    status: "not-required",
    candidateObjectSetSha256: clear.spec.candidate.objectSet.sha256,
    outcomes: [],
  };
  const reviewFile = clear.spec.files.find((file) => file.path === "workshop-review.json");
  const review = JSON.parse(reviewFile.content);
  review.spec.lifecycle.requirements = [];
  reviewFile.content = `${JSON.stringify(review, null, 2)}\n`;
  reviewFile.sha256 = sha256(reviewFile.content);
  check(buildWorkshopCiReport(clear).verdict === "clear-in-completed-checks", "a complete static record with no findings should use the bounded clear verdict");

  const schema = JSON.parse(readFileSync(join(repoRoot, "schemas/config-workshop-ci-report.schema.json"), "utf8"));
  check(schema.properties.verdict.enum.includes(report.verdict), "CI report schema omits a generated verdict");
  for (const field of schema.required) check(Object.hasOwn(report, field), `CI report schema requires missing field ${field}`);
}

function expectFailure(callback, message) {
  try {
    callback();
  } catch (error) {
    check(String(error.message).includes(message), `expected failure containing ${message}, got ${error.message}`);
    return;
  }
  throw new Error(`expected failure containing ${message}`);
}

function canonicalText(text) {
  return `${String(text).replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/\n+$/u, "")}\n`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
