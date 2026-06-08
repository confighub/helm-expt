#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "status-dashboard");
const summaryPath = join(outDir, "summary.md");
const csvPath = join(outDir, "status.csv");
const top20Path = join(outDir, "top20-status.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
  write(top20Path, report.top20Csv);
  console.log("wrote status dashboard");
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "data/status-dashboard/summary.md is missing; run npm run status:dashboard");
  check(existsSync(csvPath), "data/status-dashboard/status.csv is missing; run npm run status:dashboard");
  check(existsSync(top20Path), "data/status-dashboard/top20-status.csv is missing; run npm run status:dashboard");
  check(readFileSync(summaryPath, "utf8") === report.summary, "data/status-dashboard/summary.md is stale; run npm run status:dashboard");
  check(readFileSync(csvPath, "utf8") === report.csv, "data/status-dashboard/status.csv is stale; run npm run status:dashboard");
  check(readFileSync(top20Path, "utf8") === report.top20Csv, "data/status-dashboard/top20-status.csv is stale; run npm run status:dashboard");
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
  const lifecycleBoundaryRows = readCsv("data/lifecycle-boundary/lifecycle-boundary.csv");
  const lifecycleObservationRows = readCsv("data/lifecycle-observations/cert-manager-eso/summary.csv");
  const liveRows = readCsv("data/live-helm-confighub-compare/summary.csv");
  const kindParityRows = readCsv("data/live-kind-parity/summary.csv");
  const runtimeRows = readCsv("data/runtime-gitops/wave1.csv");
  const derivedWorkOrders = readCsv("data/variant-goldens/derived-expansion-wave/work-orders.csv");
  const derivedLiveReceiptCount = derivedWorkOrders.filter((row) =>
    existsSync(join(repoRoot, "runs", "derived-variant-execution", row.id, "variant-create-receipt.yaml")),
  ).length;
  const targetBoundDerivedReceiptCount = listFiles(join(repoRoot, "runs", "derived-variant-target-bound"))
    .filter((file) => /receipt\.ya?ml$/.test(file)).length;

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
  rows.push(metric("proof lanes", "two-cluster kind parity pass rows", resultCount(kindParityRows, "pass"), kindParityRows.length, "partial", "data/live-kind-parity/summary.csv", "Regular Helm in one vanilla kind cluster, cub installer output in another, then semantic comparison."));
  rows.push(metric("proof lanes", "complete core lane rows", count(baseRows, "complete_core_lane_set", "yes"), baseRows.length, "gap", "data/outcome-coverage/base-outcomes.csv", "Rows with render parity, ConfigHub proof, local live, GitOps live, and live parity all passing."));

  rows.push(metric("derived variants", "derived variant golden rows", derivedWorkOrders.length, derivedWorkOrders.length, "good", "data/variant-goldens/derived-expansion-wave/work-orders.csv", "Golden work orders that specify source base, downstream variant, current cub variant create command, and receipt targets."));
  rows.push(metric("derived variants", "derived variant live create receipts", derivedLiveReceiptCount, derivedWorkOrders.length, "good", "runs/derived-variant-execution", "Receipts from current cub variant create executions without hidden Helm rerender."));
  rows.push(metric("derived variants", "target-bound derived variant receipts", targetBoundDerivedReceiptCount, derivedWorkOrders.length, "partial", "runs/derived-variant-target-bound", "Derived variants that went further through target binding, ConfigHub OCI, Argo sync, and runtime observation."));

  rows.push(metric("live evidence", "runtime/GitOps wave rows", runtimeRows.length, runtimeRows.length, "partial", "data/runtime-gitops/wave1.csv", "Selected Argo/Flux OCI wave rows; this is not the whole corpus."));
  rows.push(metric("live evidence", "live Helm-vs-ConfigHub receipts", liveRows.length, liveRows.length, "partial", "data/live-helm-confighub-compare/summary.csv", "Committed live comparison receipts, including pass and non-pass results."));
  rows.push(metric("live evidence", "two-cluster kind parity receipts", kindParityRows.length, kindParityRows.length, "partial", "data/live-kind-parity/summary.csv", "Committed two-cluster parity receipts for the top-20 base variants, including pass and non-pass results."));
  rows.push(metric("live evidence", "ConfigHub/OCI semantic parity defect receipts", semanticDefectCount(liveRows), liveRows.length, "good", "data/live-helm-confighub-compare/summary.csv", "Rows whose committed receipt currently points at a semantic object comparison defect."));
  rows.push(metric("live evidence", "two-cluster semantic parity defect receipts", semanticDefectCount(kindParityRows), kindParityRows.length, "good", "data/live-kind-parity/summary.csv", "Rows whose committed two-cluster receipt currently points at a semantic object comparison defect."));

  const quirkTierCounts = groupCount(quirkRows, "coverage_tier");
  rows.push(metric("quirks", "tracked-and-surfaced axes", quirkTierCounts.get("tracked-and-surfaced") ?? 0, quirkRows.length, "good", "data/quirk-coverage/coverage.csv", "Quirk axes visible in generated chart or user data."));
  rows.push(metric("quirks", "partly tracked axes", quirkTierCounts.get("partly-tracked") ?? 0, quirkRows.length, "partial", "data/quirk-coverage/coverage.csv", "Visible quirk axes that still need lifecycle or proof coverage."));
  rows.push(metric("quirks", "source-scanned but not surfaced axes", quirkTierCounts.get("source-scanned-not-surfaced") ?? 0, quirkRows.length, "gap", "data/quirk-coverage/coverage.csv", "Detected in source scan but not promoted to front-door chart facts."));
  rows.push(metric("quirks", "not-scanned axes", quirkTierCounts.get("not-scanned") ?? 0, quirkRows.length, "gap", "data/quirk-coverage/coverage.csv", "Known blind spots in the scanner/data model."));

  rows.push(metric("hooks", "top100 maintained hook charts", hookRows.length, hookRows.length, "partial", "data/hook-lifecycle/top100-hooks.csv", "Hook-bearing maintained charts with required lifecycle receipt paths."));
  rows.push(metric("hooks", "hook lifecycle receipts present", hookRows.filter((row) => row.lifecycle_disposition === "lifecycle-observed").length, hookRows.length, "gap", "data/hook-lifecycle/top100-hooks.csv", "Current hook rows still need lifecycle route and receipt work."));
  rows.push(metric("hooks", "hook/lifecycle boundary rows", lifecycleBoundaryRows.length, lifecycleBoundaryRows.length, "partial", "data/lifecycle-boundary/lifecycle-boundary.csv", "Separates hook queue rows from hook-like controller lifecycle observations."));
  rows.push(metric("hooks", "hook queue rows still needing route receipts", lifecycleBoundaryRows.filter((row) => row.lane === "helm-hook-lifecycle-queue" && row.status === "route-and-receipt-needed").length, lifecycleBoundaryRows.filter((row) => row.lane === "helm-hook-lifecycle-queue").length, "gap", "data/lifecycle-boundary/lifecycle-boundary.csv", "Hook-bearing rows whose behavior is inventoried but not yet lifecycle-observed."));
  rows.push(metric("hooks", "related lifecycle observation receipts passing", passCount(lifecycleObservationRows, "result"), lifecycleObservationRows.length, "good", "data/lifecycle-observations/cert-manager-eso/summary.csv", "Cert-manager and External Secrets receipts for CRD/webhook/controller behavior that rendered YAML alone cannot prove."));

  const chartByName = new Map(chartRows.map((row) => [row.chart, row]));
  const top20Rows = top20StatusRows(top100Rows, chartByName);
  return {
    rows,
    csv: toCsv(rows),
    top20Rows,
    top20Csv: top20ToCsv(top20Rows),
    summary: summary(rows, { chartRows, baseRows, top100Rows, top20Rows, quirkRows, hookRows, lifecycleBoundaryRows, liveRows, kindParityRows, runtimeRows, derivedWorkOrders, derivedLiveReceiptCount, targetBoundDerivedReceiptCount }),
  };
}

function summary(rows, context) {
  const top100Status = groupCount(context.top100Rows, "adoption_bucket");
  const strongestEvidence = groupCount(context.top100Rows, "strongest_evidence");
  const quirkTierCounts = groupCount(context.quirkRows, "coverage_tier");
  const lifecycleBoundaryCounts = groupCount(context.lifecycleBoundaryRows, "lane");
  const hookPreview = context.hookRows.slice(0, 8);
  const liveNonPass = context.liveRows.filter((row) => row.result && row.result !== "pass");
  const kindParityNonPass = context.kindParityRows.filter((row) => row.result && row.result !== "pass");

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

| Adoption bucket | Charts |
| --- | ---: |
${mapRows(top100Status)}

| Strongest evidence | Charts |
| --- | ---: |
${mapRows(strongestEvidence)}

The top100 is model-supported, but not uniformly live-proven. Use
[top100-readiness/readiness.csv](../top100-readiness/readiness.csv) for one row
per chart, and [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv)
for exact chart/base lane status.

## Top20 Catalog Status

This is the compact chart-by-chart view for the public catalog. It shows the
supported base variants, current evidence strength, and lane counts. The CSV
also includes each chart's feature summary for hooks, CRDs, generated Secrets,
webhooks, values schemas, and other tracked quirks. Use
[top20-status.csv](top20-status.csv) when you want the same data in a
spreadsheet.

| Chart | Variants | Strongest evidence | Render | ConfigHub | Local live | GitOps live | Live parity | Hard gap |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${context.top20Rows.map((row) => `| ${row.chart} | ${row.variants} | ${row.strongest_evidence} | ${row.render_parity} | ${row.in_confighub} | ${row.local_live} | ${row.gitops_live} | ${row.live_parity} | ${row.hard_gap} |`).join("\n")}

The table is deliberately lane-specific. A chart can be useful today without
every lane passing for every base variant. The exact per-base rows are in
[outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv).

## Live And Parity Residue

| Lane | Pass | Non-pass | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| in-ConfigHub | ${passCount(context.baseRows, "in_confighub")} | ${nonPassCount(context.baseRows, "in_confighub")} | ${missingCount(context.baseRows, "in_confighub")} | ${context.baseRows.length} |
| local live | ${passCount(context.baseRows, "local_live")} | ${nonPassCount(context.baseRows, "local_live")} | ${missingCount(context.baseRows, "local_live")} | ${context.baseRows.length} |
| GitOps/OCI live | ${passCount(context.baseRows, "gitops_oci_live")} | ${nonPassCount(context.baseRows, "gitops_oci_live")} | ${missingCount(context.baseRows, "gitops_oci_live")} | ${context.baseRows.length} |
| live Helm-vs-ConfigHub parity | ${passCount(context.baseRows, "live_helm_vs_confighub_parity")} | ${nonPassCount(context.baseRows, "live_helm_vs_confighub_parity")} | ${missingCount(context.baseRows, "live_helm_vs_confighub_parity")} | ${context.baseRows.length} |
| two-cluster kind parity | ${resultCount(context.kindParityRows, "pass")} | ${context.kindParityRows.filter((row) => row.result !== "pass").length} | 0 | ${context.kindParityRows.length} |

Non-pass live receipts are useful evidence. They usually identify a target
prerequisite, runtime behavior, or provisioning boundary rather than a render
parity failure.

Current semantic parity defect receipts:

~~~text
ConfigHub/OCI live comparison: ${semanticDefectCount(context.liveRows)}/${context.liveRows.length}
two-cluster kind parity:       ${semanticDefectCount(context.kindParityRows)}/${context.kindParityRows.length}
~~~

The two-cluster kind parity lane is the cleanest live comparison for chart/base
rows: regular Helm is applied to one vanilla kind cluster and the \`cub installer\`
rendered objects are applied to another vanilla kind cluster. The receipts then
compare the live outcomes. Use
[live-kind-parity/summary.csv](../live-kind-parity/summary.csv) for those rows.

${liveNonPass.length ? `Current ConfigHub/OCI live parity non-pass receipts:

| Chart | Variant | Result | Reason |
| --- | --- | --- | --- |
${liveNonPass.map((row) => `| ${row.chart}@${row.version} | ${row.variant} | ${row.result} | ${row.reason || "-"} |`).join("\n")}
` : "There are no current live parity non-pass receipts.\n"}

${kindParityNonPass.length ? `Current two-cluster kind parity non-pass receipts:

| Chart | Base | Result | Reason |
| --- | --- | --- | --- |
${kindParityNonPass.map((row) => `| ${row.chart}@${row.version} | ${row.base} | ${row.result} | ${row.reason || "-"} |`).join("\n")}
` : "There are no current two-cluster kind parity non-pass receipts.\n"}

## Derived Variant Evidence

Derived ConfigHub variants are the post-render half of the model. They start
from reviewed uploaded bases and use \`cub variant create\` plus ConfigHub
metadata, targets, gates, links, checks, and receipts. They do not rerender
Helm.

| Metric | Value |
| --- | ---: |
| derived variant golden rows | ${context.derivedWorkOrders.length}/${context.derivedWorkOrders.length} |
| live cub variant create receipts | ${context.derivedLiveReceiptCount}/${context.derivedWorkOrders.length} |
| target-bound derived variant receipts | ${context.targetBoundDerivedReceiptCount}/${context.derivedWorkOrders.length} |

The golden rows are in
[variant-goldens/derived-expansion-wave/work-orders.csv](../variant-goldens/derived-expansion-wave/work-orders.csv).
Live create receipts are in
[runs/derived-variant-execution](../../runs/derived-variant-execution), and
target-bound receipts are in
[runs/derived-variant-target-bound](../../runs/derived-variant-target-bound).

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

The generated boundary table separates hook queue rows from hook-like
controller lifecycle observations:

| Lifecycle lane | Rows |
| --- | ---: |
${mapRows(lifecycleBoundaryCounts)}

Open [lifecycle-boundary/summary.md](../lifecycle-boundary/summary.md) when the
question is whether a row proves hook execution or only proves controller
lifecycle observation.

## How To Use This

| Question | Open |
| --- | --- |
| Can I use this chart today? | [top100-readiness/readiness.csv](../top100-readiness/readiness.csv) |
| Which base variants have which proof lanes? | [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) |
| Which hooks, CRDs, generated facts, or target facts matter? | [outcome-coverage/feature-outcomes.csv](../outcome-coverage/feature-outcomes.csv) |
| Which Helm quirk axes are still blind spots? | [quirk-coverage/coverage.csv](../quirk-coverage/coverage.csv) |
| Which hook charts need lifecycle receipts? | [hook-lifecycle/top100-hooks.csv](../hook-lifecycle/top100-hooks.csv) |
| Which hook claims are queued versus observed? | [lifecycle-boundary/summary.md](../lifecycle-boundary/summary.md) |
| Which live comparisons passed or failed? | [live-helm-confighub-compare/summary.csv](../live-helm-confighub-compare/summary.csv) |
| Which live rows should be rerun next? | [live-parity-rerun-plan/summary.md](../live-parity-rerun-plan/summary.md) |
| Which derived variants are specified or executed? | [variant-goldens/derived-expansion-wave/work-orders.csv](../variant-goldens/derived-expansion-wave/work-orders.csv) |

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

function top20StatusRows(top100Rows, chartByName) {
  return top100Rows
    .filter((row) => row.catalog_tier === "top20-catalog-supported")
    .map((row) => ({
      rank: row.proof_surface_rank,
      chart: row.chart,
      variants: row.variants,
      user_status: row.user_status,
      strongest_evidence: row.strongest_evidence,
      render_parity: row.render_parity,
      in_confighub: row.in_confighub,
      local_live: row.local_live,
      gitops_live: row.gitops_live,
      live_parity: row.live_parity,
      feature_summary: chartByName.get(row.chart)?.feature_summary ?? "",
      hard_gap: row.hard_gap,
      next_action: row.next_action,
      catalog_path: row.catalog_path,
    }))
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function top20ToCsv(rows) {
  const headers = [
    "rank",
    "chart",
    "variants",
    "user_status",
    "strongest_evidence",
    "render_parity",
    "in_confighub",
    "local_live",
    "gitops_live",
    "live_parity",
    "feature_summary",
    "hard_gap",
    "next_action",
    "catalog_path",
  ];
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

function resultCount(rows, result) {
  return rows.filter((row) => row.result === result).length;
}

function semanticDefectCount(rows) {
  return rows.filter((row) => {
    const reason = String(row.reason ?? "").toLowerCase();
    return reason.startsWith("parity:") || reason.includes("semantic object diff");
  }).length;
}
