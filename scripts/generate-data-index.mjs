#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, listFiles, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const readmePath = join(repoRoot, "data", "README.md");
const csvIndexPath = join(repoRoot, "data", "csv-index.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(readmePath, report.readme);
  write(csvIndexPath, report.csv);
  console.log("wrote data index");
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(readmePath), "data/README.md is missing; run npm run data:index");
  check(existsSync(csvIndexPath), "data/csv-index.csv is missing; run npm run data:index");
  check(readFileSync(readmePath, "utf8") === report.readme, "data/README.md is stale; run npm run data:index");
  check(readFileSync(csvIndexPath, "utf8") === report.csv, "data/csv-index.csv is stale; run npm run data:index");
  console.log(`verified data index for ${report.rows.length} CSV file(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-data-index.mjs --generate
  node scripts/generate-data-index.mjs --verify`);
}

function buildReport() {
  const discoveredCsvFiles = listFiles(join(repoRoot, "data"))
    .filter((file) => file.endsWith(".csv"))
    .map(relativeRepo)
    .sort();
  const csvFiles = [...new Set([...discoveredCsvFiles, "data/csv-index.csv"])].sort();
  const rows = csvFiles.map((path) => {
    const family = path === "data/csv-index.csv" ? "data-index" : (path.split("/")[1] ?? "");
    return {
      path,
      family,
      audience: audienceFor(path),
      use_for: roleFor(path),
      summary: summaryFor(path),
      regenerate: commandFor(family),
      verify: verifyFor(family),
    };
  });
  return { rows, csv: toCsv(rows), readme: readme(rows) };
}

function readme(rows) {
  const primary = [
    ["data/status-dashboard/summary.md", "Start here for a one-page status dashboard: top100, proof lanes, hooks, quirks, GitOps, and live parity."],
    ["data/status-dashboard/top20-status.csv", "Compact chart-by-chart status for the top-20 public catalog: variants, evidence strength, proof lanes, gaps, next action."],
    ["data/outcome-coverage/summary.md", "Start here. Outcome promises, tests that prove them, and links to the four front-door CSVs."],
    ["data/outcome-coverage/chart-outcomes.csv", "One row per chart: model support, production readiness, lane counts, hard gaps, feature summary."],
    ["data/outcome-coverage/base-outcomes.csv", "One row per chart/base variant: render parity, ConfigHub proof, local live, GitOps/OCI live, live Helm parity."],
    ["data/outcome-coverage/derived-variant-outcomes.csv", "One row per derived ConfigHub variant: intended-state proof and target-bound live status."],
    ["data/outcome-coverage/feature-outcomes.csv", "One row per chart feature: hooks, generated secrets, CRDs, webhooks, required values, schemas, extension slots, gaps."],
    ["data/live-kind-parity/summary.md", "Two-cluster live parity: regular Helm in one vanilla kind cluster and cub installer output in another."],
    ["data/pain-point-coverage/summary.md", "General Helm pain point coverage: current answers, handoffs, evidence, gaps, and next actions."],
    ["data/top100-readiness/summary.md", "Top-100 readiness: one chart-by-chart answer for current user status, strongest evidence, and next action."],
    ["data/variant-path-coverage/summary.md", "Per chart/base/path matrix for base variants, diffs, operations, and derived ConfigHub variants."],
    ["data/quirk-coverage/summary.md", "Coverage audit for Helm quirks: tracked, partly tracked, source-scanned only, or not scanned."],
    ["data/high-fanout-demo/summary.md", "Prometheus/kube-prometheus-stack example showing how one base choice changes many objects and prerequisites."],
    ["data/edge-recovery/summary.md", "Recovered graph fragments from Redis and kube-prometheus-stack recipe artifacts."],
    ["data/csv-index.csv", "Machine-readable index of every CSV under data/."],
  ];
  const families = [...new Set(rows.map((row) => row.family))].sort();
  return `# Data Index

This directory contains generated evidence, CSVs, and summary pages for the
Helm experiment. The data is meant to answer three questions without requiring
readers to inspect every recipe folder:

~~~text
What outcomes are promised?
Which tests prove those outcomes?
What is the current status for each chart, base, derived variant, and feature?
~~~

## Start Here

| File | Use it for |
| --- | --- |
${primary.map(([path, role]) => `| [${path.replace("data/", "")}](${path.replace("data/", "./")}) | ${role} |`).join("\n")}

The front-door CSVs are intentionally redundant with deeper generated reports.
They join the important evidence into a small set of spreadsheet-friendly
tables. Use the deeper CSVs when you need drill-down.

## How To Read Status

| Term | Meaning |
| --- | --- |
| \`model-supported\` | The chart has a complete, honest model for its declared scope. It is not a live-deployment claim by itself. |
| \`render parity\` | \`cub installer\` setup renders the same Kubernetes object set as regular Helm under recorded inputs. |
| \`in-ConfigHub\` | The rendered objects upload as ConfigHub Units with scan/safe-operation receipts. |
| \`local live\` | The rendered objects were applied to Kubernetes and observed with workload checks. |
| \`GitOps live\` | ConfigHub OCI was reconciled by Argo or Flux and observed. |
| \`live parity\` | A live Helm install was compared with ConfigHub delivery paths. |
| \`missing\` | No committed receipt for that exact row yet. |
| \`blocked\` / \`watch\` / \`fail\` | A committed receipt exists and records a non-pass outcome on the tested target. |

## Dataset Families

| Family | Main summary | Primary use |
| --- | --- | --- |
${families.map((family) => {
  const summary = `data/${family}/summary.md`;
  const summaryLink = existsSync(join(repoRoot, summary)) ? `[${summary.replace("data/", "")}](${summary.replace("data/", "./")})` : "-";
  return `| \`${family}\` | ${summaryLink} | ${familyRole(family)} |`;
}).join("\n")}

## Every CSV

The complete CSV list is generated at:

~~~text
data/csv-index.csv
~~~

It includes ${rows.length} CSV files. Each row records the path, audience,
purpose, summary, and regenerate/verify command where known.

## Regeneration

Regenerate and verify this index:

~~~sh
npm run data:index
npm run data:index:verify
~~~

The full repository verifier includes the data index:

~~~sh
npm run verify
~~~
`;
}

function audienceFor(path) {
  if (path === "data/csv-index.csv") return "user/front-door";
  if (path.startsWith("data/status-dashboard/")) return "user/front-door";
  if (path.startsWith("data/outcome-coverage/")) return "user/front-door";
  if (path.startsWith("data/pain-point-coverage/")) return "user/front-door";
  if (path.startsWith("data/top100-readiness/")) return "user/front-door";
  if (path.startsWith("data/variant-path-coverage/")) return "user/front-door";
  if (path.startsWith("data/quirk-coverage/")) return "user/front-door";
  if (path.startsWith("data/high-fanout-demo/")) return "user/front-door";
  if (path.startsWith("data/edge-recovery/")) return "corpus";
  if (path.includes("lane-test") || path.includes("live") || path.includes("runtime") || path.includes("derived-variant-target-bound")) return "verification";
  if (path.includes("chart-facts") || path.includes("top100") || path.includes("top500") || path.includes("hook") || path.includes("image") || path.includes("quirk")) return "corpus";
  if (path.includes("production") || path.includes("catalog") || path.includes("latest") || path.includes("legacy") || path.includes("next-ten")) return "planning";
  return "supporting";
}

function roleFor(path) {
  if (path === "data/csv-index.csv") return "machine-readable index of every CSV under data";
  if (path === "data/status-dashboard/status.csv") return "front-door status dashboard across top100, proof lanes, hooks, quirks, GitOps, and live parity";
  if (path === "data/status-dashboard/top20-status.csv") return "one row per top-20 catalog chart: variants, evidence strength, proof lanes, gaps, next action";
  if (path === "data/outcome-coverage/chart-outcomes.csv") return "one row per chart: model support, lane counts, gaps";
  if (path === "data/outcome-coverage/base-outcomes.csv") return "one row per chart/base: proof lane status";
  if (path === "data/outcome-coverage/derived-variant-outcomes.csv") return "one row per derived variant: intended and target-bound status";
  if (path === "data/outcome-coverage/feature-outcomes.csv") return "one row per chart feature or quirk";
  if (path === "data/pain-point-coverage/pain-points.csv") return "one row per Helm pain point: answer, handoff, evidence, gap";
  if (path === "data/top100-readiness/readiness.csv") return "one row per top-100 chart: user status, strongest evidence, gap, next action";
  if (path === "data/edge-recovery/edges.csv") return "recovered desired-state graph fragments from recipe artifacts";
  if (path === "data/variant-path-coverage/coverage-matrix.csv") return "one row per chart/base/path proof status";
  if (path === "data/quirk-coverage/coverage.csv") return "one row per Helm quirk axis: coverage tier, evidence, remaining gap, next action";
  if (path === "data/high-fanout-demo/prometheus-kps.csv") return "Prometheus/kube-prometheus-stack high-fanout base-variant example";
  if (path.endsWith("variant-lanes.csv")) return "row-level proof lane matrix";
  if (path.endsWith("chart-facts.csv")) return "chart facts and hard gaps";
  if (path.endsWith("report.csv")) return "model completeness report";
  if (path.endsWith("top20.csv")) return "top-20 production disposition";
  if (path.endsWith("summary.csv")) return "machine-readable summary";
  if (path.endsWith("review.csv")) return "review or promotion worksheet";
  if (path.endsWith("work-orders.csv")) return "generated work orders";
  if (path.endsWith("receipt-index.csv")) return "required receipt paths and minimum checks";
  if (path.endsWith("wave1.csv")) return "first runtime/GitOps wave";
  if (path.endsWith("queue.csv")) return "review queue";
  if (path.endsWith("backlog.csv")) return "variant backlog";
  return "supporting generated CSV";
}

function summaryFor(path) {
  const summary = join(dirname(join(repoRoot, path)), "summary.md");
  return existsSync(summary) ? relativeRepo(summary) : "";
}

function familyRole(family) {
  const roles = {
    adversarial10: "hard-chart readiness and control-point analysis",
    "outcome-coverage": "front-door outcome, test, and status map",
    "status-dashboard": "one-page front-door status dashboard",
    "pain-point-coverage": "front-door Helm pain point coverage map",
    "top100-readiness": "front-door top-100 user readiness and evidence summary",
    "edge-recovery": "recovered desired-state graph fragments",
    "variant-path-coverage": "chart/base/path proof status matrix",
    "quirk-coverage": "Helm quirk-axis coverage audit",
    "high-fanout-demo": "Prometheus base-variant fanout and prerequisite example",
    "data-index": "CSV index and generated data guide",
    "lane-test-matrix": "exact chart/base proof lane status",
    "model-completeness": "chart-level model support criteria",
    "chart-facts": "per-chart feature, quirk, and hard-gap facts",
    "catalog-promotion-review": "catalog promotion worksheet for the 100-chart corpus",
    "catalog-promotion-wave2": "second promotion-wave review worksheet",
    "derived-variant-target-bound": "derived ConfigHub variants with target/live evidence",
    "external-scan-lane": "external scanner lane review output",
    "live-helm-confighub-compare": "strict live Helm-vs-ConfigHub parity",
    "live-e2e": "top-20 local kind runtime status",
    "live-kind-parity": "two-cluster kind parity receipts",
    "live-parity-rerun-plan": "rerun queue for non-pass live parity rows",
    "runtime-gitops": "Argo/Flux OCI live proof wave",
    "hook-lifecycle": "hook-bearing charts and required lifecycle receipt paths",
    "lifecycle-observations": "controller-owned or hook-like lifecycle observations",
    "latest-top20-refresh": "latest upstream chart-version refresh candidates",
    "legacy-patch-review": "older chart-version patch support review",
    "next80-full-proofs": "80 additional full proof-grade chart artifacts",
    "top100-catalog-analysis": "top-100 proof and promotion surface",
    "top500-catalog-analysis": "top-500 catalog planning analysis",
    "production-disposition": "top-20 production blockers and next actions",
    "quirk-review-queue": "queue for chart quirks needing human or product review",
    "image-digest-workdown": "image pinning and mutable tag review",
    "attack-plan-workdown": "execution workdown across gaps and proof lanes",
    "next-ten-waves": "compact next work queues",
    "variant-backlog": "candidate base-variant expansion backlog",
    "variant-goldens": "golden work orders for derived-variant examples",
  };
  return roles[family] ?? "supporting generated evidence";
}

function commandFor(family) {
  const commands = commandMap()[family];
  return commands?.generate ?? "";
}

function verifyFor(family) {
  const commands = commandMap()[family];
  return commands?.verify ?? "";
}

function commandMap() {
  return {
    "outcome-coverage": { generate: "npm run outcomes:generate", verify: "npm run outcomes:verify" },
    "status-dashboard": { generate: "npm run status:dashboard", verify: "npm run status:dashboard:verify" },
    "pain-point-coverage": { generate: "npm run pain-points:generate", verify: "npm run pain-points:verify" },
    "top100-readiness": { generate: "npm run top100:readiness", verify: "npm run top100:readiness:verify" },
    "edge-recovery": { generate: "npm run edges:generate", verify: "npm run edges:verify" },
    "variant-path-coverage": { generate: "npm run variant-paths:generate", verify: "npm run variant-paths:verify" },
    "quirk-coverage": { generate: "npm run quirk-coverage", verify: "npm run quirk-coverage:verify" },
    "high-fanout-demo": { generate: "npm run high-fanout:generate", verify: "npm run high-fanout:verify" },
    "data-index": { generate: "npm run data:index", verify: "npm run data:index:verify" },
    adversarial10: { generate: "npm run adversarial10:generate", verify: "npm run adversarial10:verify" },
    "lane-test-matrix": { generate: "npm run lane-tests:generate", verify: "npm run lane-tests:verify" },
    "model-completeness": { generate: "npm run completeness:generate", verify: "npm run completeness:verify" },
    "chart-facts": { generate: "npm run chart-facts", verify: "npm run chart-facts:verify" },
    "catalog-promotion-review": { generate: "npm run catalog:review", verify: "npm run catalog:review:verify" },
    "catalog-promotion-wave2": { generate: "npm run catalog:wave2", verify: "npm run catalog:wave2:verify" },
    "derived-variant-target-bound": { generate: "npm run derived-variants:target-bound:summary", verify: "npm run derived-variants:target-bound:summary:verify" },
    "external-scan-lane": { generate: "npm run external-scan", verify: "npm run external-scan:verify" },
    "live-e2e": { generate: "npm run top20:local-e2e:summary", verify: "npm run top20:verify-local-e2e" },
    "live-helm-confighub-compare": { generate: "npm run live-parity:top20:summary", verify: "npm run live-parity:verify" },
    "live-parity-rerun-plan": { generate: "npm run live-parity:rerun-plan", verify: "npm run live-parity:rerun-plan:verify" },
    "live-kind-parity": { generate: "npm run kind-parity:summary", verify: "npm run kind-parity:verify" },
    "runtime-gitops": { generate: "npm run runtime-gitops:wave", verify: "npm run runtime-gitops:wave:verify" },
    "hook-lifecycle": { generate: "npm run hooks:lifecycle", verify: "npm run hooks:lifecycle:verify" },
    "lifecycle-observations": { generate: "npm run lifecycle:cert-manager-eso:summary", verify: "npm run lifecycle:cert-manager-eso:verify" },
    "top100-catalog-analysis": { generate: "npm run top100:catalog", verify: "npm run top100:catalog:verify" },
    "top500-catalog-analysis": { generate: "npm run top500:catalog", verify: "npm run top500:catalog:verify" },
    "production-disposition": { generate: "npm run production:disposition", verify: "npm run production:disposition:verify" },
    "image-digest-workdown": { generate: "npm run image-digests:workdown", verify: "npm run image-digests:workdown:verify" },
    "attack-plan-workdown": { generate: "npm run attack-plan:generate", verify: "npm run attack-plan:verify" },
    "next-ten-waves": { generate: "npm run next-ten:waves", verify: "npm run next-ten:waves:verify" },
    "latest-top20-refresh": { generate: "npm run top20:latest-refresh", verify: "npm run top20:latest-refresh:verify" },
    "next80-full-proofs": { generate: "npm run next80:generate", verify: "npm run next80:verify" },
    "quirk-review-queue": { generate: "npm run quirk-queue:generate", verify: "npm run quirk-queue:verify" },
    "legacy-patch-review": { generate: "npm run legacy-patch:review", verify: "npm run legacy-patch:review:verify" },
    "variant-backlog": { generate: "npm run variant-backlog:generate", verify: "npm run variant-backlog:verify" },
    "variant-goldens": { generate: "npm run variant-goldens", verify: "npm run variant-goldens:verify" },
  };
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
