#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "status-dashboard");
const summaryPath = join(outDir, "summary.md");
const csvPath = join(outDir, "status.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
  console.log("wrote status dashboard");
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "data/status-dashboard/summary.md is missing; run npm run status:dashboard");
  check(existsSync(csvPath), "data/status-dashboard/status.csv is missing; run npm run status:dashboard");
  check(readFileSync(summaryPath, "utf8") === report.summary, "data/status-dashboard/summary.md is stale; run npm run status:dashboard");
  check(readFileSync(csvPath, "utf8") === report.csv, "data/status-dashboard/status.csv is stale; run npm run status:dashboard");
  console.log(`verified status dashboard for ${report.rows.length} metric(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-status-dashboard.mjs --generate
  node scripts/generate-status-dashboard.mjs --verify`);
}

function buildReport() {
  const chartRows = readCsv("data/outcome-coverage/chart-outcomes.csv");
  const baseRows = readCsv("data/outcome-coverage/base-outcomes.csv");
  const top100Rows = readCsv("data/top100-readiness/readiness.csv");
  const quirkRows = readCsv("data/quirk-coverage/coverage.csv");
  const hookRows = readCsv("data/hook-lifecycle/top100-hooks.csv");
  const liveRows = readCsv("data/live-helm-confighub-compare/summary.csv");
  const runtimeRows = readCsv("data/runtime-gitops/wave1.csv");

  const rows = [];

  rows.push(metric("top100", "charts with model support", chartRows.filter((row) => row.model_supported_level2 === "yes").length, chartRows.length, "good", "data/outcome-coverage/chart-outcomes.csv", "The top100 corpus has honest chart models for the declared scope."));
  rows.push(metric("top100", "catalog-supported charts", count(top100Rows, "catalog_tier", "top20-catalog-supported"), top100Rows.length, "partial", "data/top100-readiness/readiness.csv", "These are the current public catalog entries; production support still depends on lane status."));
  rows.push(metric("top100", "proof-grade non-catalog charts", top100Rows.filter((row) => row.catalog_tier !== "top20-catalog-supported").length, top100Rows.length, "partial", "data/top100-readiness/readiness.csv", "These charts have proof artifacts but are not promoted catalog entries."));
  rows.push(metric("top100", "variant-rich charts", chartRows.filter((row) => row.variant_rich === "yes").length, chartRows.length, "partial", "data/outcome-coverage/chart-outcomes.csv", "Charts with more than one declared base variant."));

  rows.push(metric("proof lanes", "render parity rows", passCount(baseRows, "render_parity"), baseRows.length, "good", "data/outcome-coverage/base-outcomes.csv", "Every chart/base row has render parity under recorded inputs."));
  rows.push(metric("proof lanes", "in-ConfigHub proof rows", passCount(baseRows, "in_confighub"), baseRows.length, "partial", "data/outcome-coverage/base-outcomes.csv", "Rows with upload, scan, or safe-operation proof receipts."));
  rows.push(metric("proof lanes", "local live rows", passCount(baseRows, "local_live"), baseRows.length, "partial", "data/outcome-coverage/base-outcomes.csv", "Rows with committed local Kubernetes observation receipts."));
  rows.push(metric("proof lanes", "GitOps/OCI live pass rows", passCount(baseRows, "gitops_oci_live"), baseRows.length, "partial", "data/outcome-coverage/base-outcomes.csv", `${nonPassCount(baseRows, "gitops_oci_live")} rows have non-pass GitOps/OCI receipts.`));
  rows.push(metric("proof lanes", "live Helm-vs-ConfigHub parity pass rows", passCount(baseRows, "live_helm_vs_confighub_parity"), baseRows.length, "partial", "data/outcome-coverage/base-outcomes.csv", `${nonPassCount(baseRows, "live_helm_vs_confighub_parity")} rows have non-pass live parity receipts.`));
  rows.push(metric("proof lanes", "complete core lane rows", count(baseRows, "complete_core_lane_set", "yes"), baseRows.length, "gap", "data/outcome-coverage/base-outcomes.csv", "Rows with render parity, ConfigHub proof, local live, GitOps live, and live parity all passing."));

  rows.push(metric("live evidence", "runtime/GitOps wave rows", runtimeRows.length, runtimeRows.length, "partial", "data/runtime-gitops/wave1.csv", "Selected Argo/Flux OCI wave rows; this is not the whole corpus."));
  rows.push(metric("live evidence", "live Helm-vs-ConfigHub receipts", liveRows.length, liveRows.length, "partial", "data/live-helm-confighub-compare/summary.csv", "Committed live comparison receipts, including pass and non-pass results."));

  const quirkTierCounts = groupCount(quirkRows, "coverage_tier");
  rows.push(metric("quirks", "tracked-and-surfaced axes", quirkTierCounts.get("tracked-and-surfaced") ?? 0, quirkRows.length, "good", "data/quirk-coverage/coverage.csv", "Quirk axes visible in generated chart or user data."));
  rows.push(metric("quirks", "partly tracked axes", quirkTierCounts.get("partly-tracked") ?? 0, quirkRows.length, "partial", "data/quirk-coverage/coverage.csv", "Visible quirk axes that still need lifecycle or proof coverage."));
  rows.push(metric("quirks", "source-scanned but not surfaced axes", quirkTierCounts.get("source-scanned-not-surfaced") ?? 0, quirkRows.length, "gap", "data/quirk-coverage/coverage.csv", "Detected in source scan but not promoted to front-door chart facts."));
  rows.push(metric("quirks", "not-scanned axes", quirkTierCounts.get("not-scanned") ?? 0, quirkRows.length, "gap", "data/quirk-coverage/coverage.csv", "Known blind spots in the scanner/data model."));

  rows.push(metric("hooks", "top100 maintained hook charts", hookRows.length, hookRows.length, "partial", "data/hook-lifecycle/top100-hooks.csv", "Hook-bearing maintained charts with required lifecycle receipt paths."));
  rows.push(metric("hooks", "hook lifecycle receipts present", hookRows.filter((row) => row.lifecycle_disposition === "lifecycle-observed").length, hookRows.length, "gap", "data/hook-lifecycle/top100-hooks.csv", "Current hook rows still need lifecycle route and receipt work."));

  return { rows, csv: toCsv(rows), summary: summary(rows, { chartRows, baseRows, top100Rows, quirkRows, hookRows, liveRows, runtimeRows }) };
}

function summary(rows, context) {
  const top100Status = groupCount(context.top100Rows, "user_status");
  const strongestEvidence = groupCount(context.top100Rows, "strongest_evidence");
  const quirkTierCounts = groupCount(context.quirkRows, "coverage_tier");
  const hookPreview = context.hookRows.slice(0, 8);
  const liveNonPass = context.liveRows.filter((row) => row.result && row.result !== "pass");

  return `# Status Dashboard

This generated dashboard is the short front door for current project status. It
joins the top100 readiness, proof lane, quirk, hook, GitOps, and live-parity
tables without replacing them.

Use this page to answer:

~~~text
What is working now?
Which claims are only partial?
Where are the main residues?
Which detailed CSV should I open next?
~~~

## Current State

| Section | Metric | Value | Status | Source |
| --- | --- | ---: | --- | --- |
${rows.map((row) => `| ${row.section} | ${row.metric} | ${row.value}${row.total ? `/${row.total}` : ""} | ${row.status} | [${row.source}](../../${row.source}) |`).join("\n")}

## Top100 Readiness

| User status | Charts |
| --- | ---: |
${mapRows(top100Status)}

| Strongest evidence | Charts |
| --- | ---: |
${mapRows(strongestEvidence)}

The top100 is model-supported, but not uniformly live-proven. Use
[top100-readiness/readiness.csv](../top100-readiness/readiness.csv) for one row
per chart, and [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv)
for exact chart/base lane status.

## Live And Parity Residue

| Lane | Pass | Non-pass | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| in-ConfigHub | ${passCount(context.baseRows, "in_confighub")} | ${nonPassCount(context.baseRows, "in_confighub")} | ${missingCount(context.baseRows, "in_confighub")} | ${context.baseRows.length} |
| local live | ${passCount(context.baseRows, "local_live")} | ${nonPassCount(context.baseRows, "local_live")} | ${missingCount(context.baseRows, "local_live")} | ${context.baseRows.length} |
| GitOps/OCI live | ${passCount(context.baseRows, "gitops_oci_live")} | ${nonPassCount(context.baseRows, "gitops_oci_live")} | ${missingCount(context.baseRows, "gitops_oci_live")} | ${context.baseRows.length} |
| live Helm-vs-ConfigHub parity | ${passCount(context.baseRows, "live_helm_vs_confighub_parity")} | ${nonPassCount(context.baseRows, "live_helm_vs_confighub_parity")} | ${missingCount(context.baseRows, "live_helm_vs_confighub_parity")} | ${context.baseRows.length} |

Non-pass live receipts are useful evidence. They usually identify a target
prerequisite, runtime behavior, or provisioning boundary rather than a render
parity failure.

${liveNonPass.length ? `Current live parity non-pass receipts:

| Chart | Variant | Result | Reason |
| --- | --- | --- | --- |
${liveNonPass.map((row) => `| ${row.chart}@${row.version} | ${row.variant} | ${row.result} | ${row.reason || "-"} |`).join("\n")}
` : "There are no current live parity non-pass receipts.\n"}

## Quirk And Hook Residue

| Quirk coverage tier | Axes |
| --- | ---: |
${mapRows(quirkTierCounts)}

| Hook chart | Selected base | Current disposition | Next action |
| --- | --- | --- | --- |
${hookPreview.map((row) => `| ${row.chart}@${row.version} | ${row.selected_base} | ${row.lifecycle_disposition} | ${row.next_action} |`).join("\n")}

Hook rows are not support claims. They are the queue for lifecycle route and
receipt work. The hook doctrine is
[Seven-Stage Helm Lifecycle](../../docs/reference/seven-stage-helm-lifecycle.md)
and [Hook Lifecycle Strategy](../../docs/user/hook-lifecycle-strategy.md).

## How To Use This

| Question | Open |
| --- | --- |
| Can I use this chart today? | [top100-readiness/readiness.csv](../top100-readiness/readiness.csv) |
| Which base variants have which proof lanes? | [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) |
| Which hooks, CRDs, generated facts, or target facts matter? | [outcome-coverage/feature-outcomes.csv](../outcome-coverage/feature-outcomes.csv) |
| Which Helm quirk axes are still blind spots? | [quirk-coverage/coverage.csv](../quirk-coverage/coverage.csv) |
| Which hook charts need lifecycle receipts? | [hook-lifecycle/top100-hooks.csv](../hook-lifecycle/top100-hooks.csv) |
| Which live comparisons passed or failed? | [live-helm-confighub-compare/summary.csv](../live-helm-confighub-compare/summary.csv) |

Regenerate:

~~~sh
npm run status:dashboard
npm run status:dashboard:verify
~~~
`;
}

function metric(section, metricName, value, total, status, source, note) {
  return { section, metric: metricName, value: String(value), total: String(total), status, source, note };
}

function readCsv(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...body] = rows.filter((item) => item.some((fieldValue) => fieldValue !== ""));
  return body.map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}

function toCsv(rows) {
  const headers = ["section", "metric", "value", "total", "status", "source", "note"];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function count(rows, key, value) {
  return rows.filter((row) => row[key] === value).length;
}

function passCount(rows, key) {
  return count(rows, key, "pass");
}

function missingCount(rows, key) {
  return count(rows, key, "missing");
}

function nonPassCount(rows, key) {
  return rows.filter((row) => row[key] && !["pass", "missing"].includes(row[key])).length;
}

function groupCount(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const value = row[key] || "-";
    result.set(value, (result.get(value) ?? 0) + 1);
  }
  return new Map([...result.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function mapRows(map) {
  return [...map.entries()].map(([key, value]) => `| ${key} | ${value} |`).join("\n");
}
