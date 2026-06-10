#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "status-dashboard");
const summaryPath = join(outDir, "summary.md");
const csvPath = join(outDir, "status.csv");
const top20Path = join(outDir, "top20-status.csv");
const nextWorkQueuesPath = join(outDir, "next-work-queues.csv");
const activeProofQueuePath = join(outDir, "active-proof-queue.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
  write(top20Path, report.top20Csv);
  write(nextWorkQueuesPath, report.nextWorkQueuesCsv);
  write(activeProofQueuePath, report.activeProofQueueCsv);
  console.log("wrote status dashboard");
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "data/status-dashboard/summary.md is missing; run npm run status:dashboard");
  check(existsSync(csvPath), "data/status-dashboard/status.csv is missing; run npm run status:dashboard");
  check(existsSync(top20Path), "data/status-dashboard/top20-status.csv is missing; run npm run status:dashboard");
  check(existsSync(nextWorkQueuesPath), "data/status-dashboard/next-work-queues.csv is missing; run npm run status:dashboard");
  check(existsSync(activeProofQueuePath), "data/status-dashboard/active-proof-queue.csv is missing; run npm run status:dashboard");
  check(readFileSync(summaryPath, "utf8") === report.summary, "data/status-dashboard/summary.md is stale; run npm run status:dashboard");
  check(readFileSync(csvPath, "utf8") === report.csv, "data/status-dashboard/status.csv is stale; run npm run status:dashboard");
  check(readFileSync(top20Path, "utf8") === report.top20Csv, "data/status-dashboard/top20-status.csv is stale; run npm run status:dashboard");
  check(readFileSync(nextWorkQueuesPath, "utf8") === report.nextWorkQueuesCsv, "data/status-dashboard/next-work-queues.csv is stale; run npm run status:dashboard");
  check(readFileSync(activeProofQueuePath, "utf8") === report.activeProofQueueCsv, "data/status-dashboard/active-proof-queue.csv is stale; run npm run status:dashboard");
  console.log(`verified status dashboard for ${report.rows.length} metric(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-status-dashboard.mjs --generate
  node scripts/generate-status-dashboard.mjs --verify`);
}

function buildReport() {
  const chartRows = readCsv("data/outcome-coverage/chart-outcomes.csv");
  const baseRows = readCsv("data/outcome-coverage/base-outcomes.csv");
  const top20BaseReadinessRows = readCsv("data/top20-base-readiness/base-readiness.csv");
  const top100Rows = readCsv("data/top100-readiness/readiness.csv");
  const top500Rows = readCsv("data/top500-catalog-analysis/review.csv");
  const quirkRows = readCsv("data/quirk-coverage/coverage.csv");
  const extensionRows = readCsv("data/extension-slots/extension-slots.csv");
  const hookRows = readCsv("data/hook-lifecycle/top100-hooks.csv");
  const lifecycleBoundaryRows = readCsv("data/lifecycle-boundary/lifecycle-boundary.csv");
  const lifecycleObservationRows = readCsv("data/lifecycle-observations/cert-manager-eso/summary.csv");
  const edgeRows = readCsv("data/edge-recovery/edges.csv");
  const liveRows = readCsv("data/live-helm-confighub-compare/summary.csv");
  const kindParityRows = readCsv("data/live-kind-parity/summary.csv");
  const liveParityRerunRows = readCsv("data/live-parity-rerun-plan/rerun-plan.csv");
  const runtimeRows = readCsv("data/runtime-gitops/wave1.csv");
  const productionRows = readCsv("data/production-disposition/top20.csv");
  const productionSupportDecisionRows = readCsv("data/production-support-decisions/decisions.csv");
  const scanDispositionRows = readCsv("data/scan-disposition-workdown/workdown.csv");
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
  rows.push(metric("top500", "source rows scanned", count(top500Rows, "source_status", "source-scanned"), top500Rows.length, "partial", "data/top500-catalog-analysis/review.csv", "Retained source-scan rows with source feature data."));
  rows.push(metric("top500", "rows with current recipe proof", top500Rows.filter((row) => row.recipe_status.startsWith("current-recipe")).length, top500Rows.length, "partial", "data/top500-catalog-analysis/review.csv", "Retained source-scan rows matched to current recipe/package proof."));
  rows.push(metric("top500", "catalog-supported rows", count(top500Rows, "catalog_status", "catalog-supported"), top500Rows.length, "partial", "data/top500-catalog-analysis/review.csv", "Rows promoted to the current public catalog; production gates still matter."));
  rows.push(metric("top500", "proof-grade rows", count(top500Rows, "catalog_status", "proof-grade"), top500Rows.length, "partial", "data/top500-catalog-analysis/review.csv", "Rows with deterministic proof that are not public catalog entries."));
  rows.push(metric("top500", "rows with no current recipe proof", count(top500Rows, "recipe_status", "no-current-recipe"), top500Rows.length, "gap", "data/top500-catalog-analysis/review.csv", "Source reconnaissance rows with no current recipe/package proof yet."));
  rows.push(metric("top500", "version-drift review rows", count(top500Rows, "version_match", "different-current-version"), top500Rows.length, "partial", "data/top500-catalog-analysis/review.csv", "Current recipe exists but the retained source-scan version differs."));

  rows.push(metric("proof lanes", "render parity rows", passCount(baseRows, "render_parity"), baseRows.length, "good", "data/outcome-coverage/base-outcomes.csv", "Every chart/base row has render parity under recorded inputs."));
  rows.push(metric("proof lanes", "in-ConfigHub proof rows", passCount(baseRows, "in_confighub"), baseRows.length, "partial", "data/outcome-coverage/base-outcomes.csv", "Rows with upload, scan, or safe-operation proof receipts."));
  rows.push(metric("proof lanes", "local live rows", passCount(baseRows, "local_live"), baseRows.length, "partial", "data/outcome-coverage/base-outcomes.csv", "Rows with committed local Kubernetes observation receipts."));
  rows.push(metric("proof lanes", "GitOps/OCI live pass rows", passCount(baseRows, "gitops_oci_live"), baseRows.length, "partial", "data/outcome-coverage/base-outcomes.csv", `${nonPassCount(baseRows, "gitops_oci_live")} rows have non-pass GitOps/OCI receipts.`));
  rows.push(metric("proof lanes", "live Helm-vs-ConfigHub parity pass rows", passCount(baseRows, "live_helm_vs_confighub_parity"), baseRows.length, "partial", "data/outcome-coverage/base-outcomes.csv", `${nonPassCount(baseRows, "live_helm_vs_confighub_parity")} rows have non-pass live parity receipts.`));
  rows.push(metric("proof lanes", "two-cluster kind parity pass rows", resultCount(kindParityRows, "pass"), kindParityRows.length, "partial", "data/live-kind-parity/summary.csv", "Regular Helm in one vanilla kind cluster, cub installer output in another, then semantic comparison."));
  rows.push(metric("proof lanes", "complete core lane rows", count(baseRows, "complete_core_lane_set", "yes"), baseRows.length, "gap", "data/outcome-coverage/base-outcomes.csv", "Rows with render parity, ConfigHub proof, local live, GitOps live, and live parity all passing."));
  rows.push(metric("proof lanes", "top20 start-here base variants", count(top20BaseReadinessRows, "user_readiness", "start-here"), top20BaseReadinessRows.length, "partial", "data/top20-base-readiness/base-readiness.csv", "Base variants that are the cleanest first catalog paths today."));
  rows.push(metric("proof lanes", "top20 bases needing unresolved prerequisite or runtime review", top20BaseReadinessRows.filter((row) => ["target-prerequisite-needed", "runtime-watch", "runtime-review-needed", "hook-lifecycle-review-needed", "operating-policy-needed", "target-fit-needed"].includes(row.user_readiness)).length, top20BaseReadinessRows.length, "partial", "data/top20-base-readiness/base-readiness.csv", "Base variants whose render parity is useful but whose target fit, runtime, or lifecycle behavior still needs review."));

  rows.push(metric("derived variants", "derived variant golden rows", derivedWorkOrders.length, derivedWorkOrders.length, "good", "data/variant-goldens/derived-expansion-wave/work-orders.csv", "Golden work orders that specify source base, downstream variant, current cub variant create command, and receipt targets."));
  rows.push(metric("derived variants", "derived variant live create receipts", derivedLiveReceiptCount, derivedWorkOrders.length, "good", "runs/derived-variant-execution", "Receipts from current cub variant create executions without hidden Helm rerender."));
  rows.push(metric("derived variants", "target-bound derived variant receipts", targetBoundDerivedReceiptCount, derivedWorkOrders.length, "partial", "runs/derived-variant-target-bound", "Derived variants that went further through target binding, ConfigHub OCI, Argo sync, and runtime observation."));

  rows.push(metric("graph bridge", "charts with recovered graph fragments", new Set(edgeRows.map((row) => row.chart)).size, chartRows.length, "partial", "data/edge-recovery/edges.csv", "Catalog-supported recipe artifacts converted into desired-state graph fragments."));
  rows.push(metric("graph bridge", "recovered graph edge rows", edgeRows.length, edgeRows.length, "good", "data/edge-recovery/edges.csv", "Recovered base, override, target-fact, generated-fact, and field-reachability rows."));
  rows.push(metric("graph bridge", "target-fact graph edges", count(edgeRows, "edge_type", "target-fact"), edgeRows.length, "partial", "data/edge-recovery/edges.csv", "Edges from a variant to required target facts such as pre-existing Secrets, CRDs, or hook-produced material."));
  rows.push(metric("graph bridge", "generated-fact graph edges", count(edgeRows, "edge_type", "generated-fact"), edgeRows.length, "partial", "data/edge-recovery/edges.csv", "Edges from generated facts to the rendered fields they affect where field reachability is available."));
  rows.push(metric("graph bridge", "rows with field reachability", edgeRows.filter((row) => row.field_reachability_paths).length, edgeRows.length, "partial", "data/edge-recovery/edges.csv", "Rows that connect an input, generated fact, or variant change to rendered output fields."));

  rows.push(metric("live evidence", "runtime/GitOps wave rows", runtimeRows.length, runtimeRows.length, "partial", "data/runtime-gitops/wave1.csv", "Selected Argo/Flux OCI wave rows; this is not the whole corpus."));
  rows.push(metric("live evidence", "live Helm-vs-ConfigHub receipts", liveRows.length, liveRows.length, "partial", "data/live-helm-confighub-compare/summary.csv", "Committed live comparison receipts, including pass and non-pass results."));
  rows.push(metric("live evidence", "two-cluster kind parity receipts", kindParityRows.length, kindParityRows.length, "partial", "data/live-kind-parity/summary.csv", "Committed two-cluster parity receipts for the top-20 base variants, including pass and non-pass results."));
  rows.push(metric("live evidence", "live parity rerun rows needing decisions", liveParityRerunRows.length, liveParityRerunRows.length, "partial", "data/live-parity-rerun-plan/rerun-plan.csv", "Non-pass live parity rows grouped by next action, such as runtime review, staged prerequisites, lifecycle route, or operating policy."));
  rows.push(metric("live evidence", "live parity rows needing model or staging first", count(liveParityRerunRows, "rerun_readiness", "model-or-stage-first"), liveParityRerunRows.length, "partial", "data/live-parity-rerun-plan/rerun-plan.csv", "Rows where another rerun is not the next useful action until a prerequisite, lifecycle route, or operating policy is handled."));
  rows.push(metric("live evidence", "live parity rows needing target review first", count(liveParityRerunRows, "rerun_readiness", "review-target-first"), liveParityRerunRows.length, "partial", "data/live-parity-rerun-plan/rerun-plan.csv", "Rows where object parity passed but runtime, storage, controller health, or wait conditions should be reviewed before rerun."));
  rows.push(metric("live evidence", "ConfigHub/OCI semantic parity defect receipts", semanticDefectCount(liveRows), liveRows.length, "good", "data/live-helm-confighub-compare/summary.csv", "Rows whose committed receipt currently points at a semantic object comparison defect."));
  rows.push(metric("live evidence", "two-cluster semantic parity defect receipts", semanticDefectCount(kindParityRows), kindParityRows.length, "good", "data/live-kind-parity/summary.csv", "Rows whose committed two-cluster receipt currently points at a semantic object comparison defect."));

  rows.push(metric("production disposition", "top20 production-review-ready charts", productionRows.filter((row) => row.production_support === "production-review-ready").length, productionRows.length, "partial", "data/production-disposition/top20.csv", "Top-20 catalog charts with required pre-review dispositions closed."));
  rows.push(metric("production disposition", "top20 production-blocked charts", productionRows.filter((row) => row.production_support === "blocked").length, productionRows.length, "partial", "data/production-disposition/top20.csv", "Top-20 catalog charts that still have open disposition work before support review."));
  rows.push(metric("production disposition", "charts with accepted production dispositions", productionRows.filter((row) => dispositionCount(row.accepted_dispositions) > 0).length, productionRows.length, "partial", "data/production-disposition/top20.csv", "Charts with at least one disposition receipt accepted."));
  rows.push(metric("production support decisions", "target-scoped decision artifacts", productionSupportDecisionRows.length, productionRows.length, "partial", "data/production-support-decisions/decisions.csv", "Supported, superseded, rejected, or draft target-scoped support decision records."));
  rows.push(metric("production support decisions", "supported decision artifacts", count(productionSupportDecisionRows, "decision", "supported"), productionRows.length, "partial", "data/production-support-decisions/decisions.csv", "Support decisions with fresh target evidence and no remaining final requirements."));
  rows.push(metric("production support decisions", "superseded decision artifacts", count(productionSupportDecisionRows, "decision", "superseded"), productionRows.length, "partial", "data/production-support-decisions/decisions.csv", "Proof records kept for deprecated source charts that should not be production-promoted."));
  rows.push(metric("production support decisions", "rejected decision artifacts", count(productionSupportDecisionRows, "decision", "rejected"), productionRows.length, "partial", "data/production-support-decisions/decisions.csv", "Default bases that remain parity evidence but need a better production base or target scope."));
  rows.push(metric("production support decisions", "draft decision artifacts", count(productionSupportDecisionRows, "decision", "draft"), productionRows.length, "good", "data/production-support-decisions/decisions.csv", "Draft support boundaries that still need a final target-scoped decision."));
  rows.push(metric("scan disposition", "high-priority scan rows", scanDispositionRows.filter((row) => row.scanPriority === "high").length, scanDispositionRows.length, "partial", "data/scan-disposition-workdown/workdown.csv", "External scan rows that need a fix, hardened base, or explicit production disposition."));
  rows.push(metric("scan disposition", "remaining mutable-image rows", scanDispositionRows.filter((row) => row.dispositionRoute === "fix-image-pin").length, scanDispositionRows.length, "good", "data/scan-disposition-workdown/workdown.csv", "Rows still routed to image-pin fixes after the supported-base pinning work."));
  rows.push(metric("scan disposition", "privileged infrastructure review rows", scanDispositionRows.filter((row) => row.dispositionRoute === "accept-or-split-privileged-infrastructure").length, scanDispositionRows.length, "partial", "data/scan-disposition-workdown/workdown.csv", "Rows where host, node, or privileged access is likely part of the chart and needs explicit acceptance or a narrower base."));

  const quirkTierCounts = groupCount(quirkRows, "coverage_tier");
  rows.push(metric("quirks", "tracked-and-surfaced axes", quirkTierCounts.get("tracked-and-surfaced") ?? 0, quirkRows.length, "good", "data/quirk-coverage/coverage.csv", "Quirk axes visible in generated chart or user data."));
  rows.push(metric("quirks", "partly tracked axes", quirkTierCounts.get("partly-tracked") ?? 0, quirkRows.length, "partial", "data/quirk-coverage/coverage.csv", "Visible quirk axes that still need lifecycle or proof coverage."));
  rows.push(metric("quirks", "source-scanned but not surfaced axes", quirkTierCounts.get("source-scanned-not-surfaced") ?? 0, quirkRows.length, "gap", "data/quirk-coverage/coverage.csv", "Detected in source scan but not promoted to front-door chart facts."));
  rows.push(metric("quirks", "not-scanned axes", quirkTierCounts.get("not-scanned") ?? 0, quirkRows.length, "gap", "data/quirk-coverage/coverage.csv", "Known blind spots in the scanner/data model."));
  rows.push(metric("extension slots", "top20 charts with extension slots", extensionRows.filter((row) => row.catalog_scope === "top20-catalog").length, 20, "partial", "data/extension-slots/extension-slots.csv", "Top-20 catalog charts that expose raw manifests, tpl snippets, config blocks, sidecars, or add-on slots."));
  rows.push(metric("extension slots", "top100 charts with extension slots", extensionRows.length, 100, "partial", "data/extension-slots/extension-slots.csv", "Top-100 chart facts where NGINX-like extension slots are surfaced."));
  rows.push(metric("extension slots", "top500 source rows using tpl", Number(quirkRows.find((row) => row.axis === "tpl-extension-slots")?.top500_count ?? 0), top500Rows.length, "partial", "data/quirk-coverage/coverage.csv", "Broader source-scan signal for template-powered inputs; not every tpl use is an explicit supported slot."));

  const hookQueueRows = lifecycleBoundaryRows.filter((row) => row.lane === "helm-hook-lifecycle-queue");
  rows.push(metric("hooks", "top100 maintained hook charts", hookRows.length, hookRows.length, "partial", "data/hook-lifecycle/top100-hooks.csv", "Hook-bearing maintained charts with required lifecycle receipt paths."));
  rows.push(metric("hooks", "hook route receipts present", hookRows.filter((row) => ["route-selected", "lifecycle-observed", "blocked"].includes(row.lifecycle_disposition)).length, hookRows.length, "partial", "data/hook-lifecycle/top100-hooks.csv", "Hook-bearing rows with a recorded lifecycle route, observation, or blocker."));
  rows.push(metric("hooks", "hook lifecycle observations present", hookRows.filter((row) => row.lifecycle_disposition === "lifecycle-observed").length, hookRows.length, "gap", "data/hook-lifecycle/top100-hooks.csv", "Hook-bearing rows with runtime lifecycle observation or execution receipts."));
  rows.push(metric("hooks", "hook/lifecycle boundary rows", lifecycleBoundaryRows.length, lifecycleBoundaryRows.length, "partial", "data/lifecycle-boundary/lifecycle-boundary.csv", "Separates hook queue rows from hook-like controller lifecycle observations."));
  rows.push(metric("hooks", "hook queue rows still needing route receipts", hookQueueRows.filter((row) => row.status === "route-and-receipt-needed").length, hookQueueRows.length, "good", "data/lifecycle-boundary/lifecycle-boundary.csv", "Hook-bearing rows whose behavior is inventoried but has no selected route."));
  rows.push(metric("hooks", "hook routes still needing execution or observation", hookQueueRows.filter((row) => row.status === "route-selected").length, hookQueueRows.length, "gap", "data/lifecycle-boundary/lifecycle-boundary.csv", "Hook-bearing rows with a selected route but no committed runtime observation or execution receipt."));
  rows.push(metric("hooks", "related lifecycle observation receipts passing", passCount(lifecycleObservationRows, "result"), lifecycleObservationRows.length, "good", "data/lifecycle-observations/cert-manager-eso/summary.csv", "Cert-manager and External Secrets receipts for CRD/webhook/controller behavior that rendered YAML alone cannot prove."));

  const chartByName = new Map(chartRows.map((row) => [row.chart, row]));
  const top20Rows = top20StatusRows(top100Rows, chartByName, top20BaseReadinessRows, productionSupportDecisionRows);
  const nextWorkQueues = nextWorkQueueRows({ top100Rows, hookRows, lifecycleObservationRows, liveParityRerunRows, productionSupportDecisionRows });
  const activeProofQueue = activeProofQueueRows(liveParityRerunRows);
  return {
    rows,
    csv: toCsv(rows),
    top20Rows,
    top20Csv: top20ToCsv(top20Rows),
    nextWorkQueues,
    nextWorkQueuesCsv: nextWorkQueuesToCsv(nextWorkQueues),
    activeProofQueue,
    activeProofQueueCsv: activeProofQueueToCsv(activeProofQueue),
    summary: summary(rows, { chartRows, baseRows, top100Rows, top500Rows, top20Rows, quirkRows, extensionRows, hookRows, lifecycleBoundaryRows, lifecycleObservationRows, edgeRows, liveRows, kindParityRows, liveParityRerunRows, runtimeRows, productionRows, productionSupportDecisionRows, scanDispositionRows, derivedWorkOrders, derivedLiveReceiptCount, targetBoundDerivedReceiptCount, nextWorkQueues, activeProofQueue }),
  };
}

function summary(rows, context) {
  const top100Status = groupCount(context.top100Rows, "adoption_bucket");
  const strongestEvidence = groupCount(context.top100Rows, "strongest_evidence");
  const top500CatalogStatus = groupCount(context.top500Rows, "catalog_status");
  const top500RecipeStatus = groupCount(context.top500Rows, "recipe_status");
  const quirkTierCounts = groupCount(context.quirkRows, "coverage_tier");
  const top20ExtensionRows = context.extensionRows.filter((row) => row.catalog_scope === "top20-catalog");
  const lifecycleBoundaryCounts = groupCount(context.lifecycleBoundaryRows, "lane");
  const hookPreview = context.hookRows.slice(0, 8);
  const liveNonPass = context.liveRows.filter((row) => row.result && row.result !== "pass");
  const kindParityNonPass = context.kindParityRows.filter((row) => row.result && row.result !== "pass");
  const liveParityNextSteps = groupCount(context.liveParityRerunRows, "next_step_type");
  const liveParityRerunReadiness = groupCount(context.liveParityRerunRows, "rerun_readiness");
  const productionBlockers = [...flattenCounts(context.productionRows, "open_dispositions").entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8);
  const productionPreview = context.productionRows.slice(0, 10);
  const scanDispositionRoutes = groupCount(context.scanDispositionRows, "dispositionRoute");
  const highScanRows = context.scanDispositionRows.filter((row) => row.scanPriority === "high");
  const productionWorkstreams = nextWorkQueueMarkdown(context.nextWorkQueues, "top20-production-support", "workstream");
  const top100WorkQueues = nextWorkQueueMarkdown(context.nextWorkQueues, "top100-catalog-work", "queue");
  const liveParityWorkQueues = nextWorkQueueMarkdown(context.nextWorkQueues, "live-parity-work", "queue");
  const hookWorkQueueRows = nextWorkQueueMarkdown(context.nextWorkQueues, "hook-and-lifecycle-work", "queue");

  return `# Status Dashboard

This generated dashboard is the short front door for current project status. It
joins the top100 readiness, top500 evidence map, proof lane, graph bridge,
quirk, hook, GitOps, and live-parity tables without replacing them.

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

## Next Work Queues

Use this section when the question is what should move next, not when the
question is whether a specific receipt passed.
Workstreams can overlap: one chart can need image, scan, lifecycle, and fresh
evidence work before it becomes production-supported for a target scope.

### Top100 Catalog Work

| Queue | Charts | Next action |
| --- | ---: | --- |
${top100WorkQueues}

### Top20 Production Support Work

| Workstream | Charts | Next action |
| --- | ---: | --- |
${productionWorkstreams}

### Live Parity Work

| Queue | Rows | Next action |
| --- | ---: | --- |
${liveParityWorkQueues}

### Active Proof Queue

These are the current live parity rows where another run is not the first useful
step. Each row points at the support artifact that explains the prerequisite,
lifecycle route, target fit, or operating policy.

| Chart | Base | Result | Next step | Support artifact |
| --- | --- | --- | --- | --- |
${activeProofQueueMarkdown(context.activeProofQueue)}

### Hook And Lifecycle Work

| Queue | Rows | Next action |
| --- | ---: | --- |
${hookWorkQueueRows}

Spreadsheet forms: [next-work-queues.csv](next-work-queues.csv) and
[active-proof-queue.csv](active-proof-queue.csv).

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

## Top500 Evidence Map

The top500 table is retained source reconnaissance joined to the current
recipe/package corpus. It shows which retained source-scan rows now have
current proof, which rows only have source facts, and where the retained source
version differs from the maintained recipe version.

| Catalog status | Rows |
| --- | ---: |
${mapRows(top500CatalogStatus)}

| Recipe status | Rows |
| --- | ---: |
${mapRows(top500RecipeStatus)}

Use [top500-catalog-analysis/summary.md](../top500-catalog-analysis/summary.md)
for the narrative and [top500-catalog-analysis/review.csv](../top500-catalog-analysis/review.csv)
for one row per retained source-scan chart.

## Top20 Catalog Status

This is the compact chart-by-chart view for the public catalog. It shows the
supported base variants, current evidence strength, and lane counts. The CSV
also includes each chart's feature summary for hooks, CRDs, generated Secrets,
webhooks, values schemas, and other tracked quirks. Use
[top20-status.csv](top20-status.csv) when you want the same data in a
spreadsheet.

| Chart | Recommended base | Base readiness | Strongest evidence | Render | ConfigHub | Local live | GitOps live | Live parity | Hard gap |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${context.top20Rows.map((row) => `| ${row.chart} | ${row.recommended_base} | ${row.base_readiness} | ${row.strongest_evidence} | ${row.render_parity} | ${row.in_confighub} | ${row.local_live} | ${row.gitops_live} | ${row.live_parity} | ${row.hard_gap} |`).join("\n")}

The table is deliberately lane-specific. A chart can be useful today without
every lane passing for every base variant. The exact per-base rows are in
[outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv).
The \`Base readiness\` column is generated from
[top20-base-readiness/base-readiness.csv](../top20-base-readiness/base-readiness.csv),
which is the better source when the question is which base variant to try
first.

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

## Live Parity Next Actions

The rerun plan groups non-pass rows by the work needed before another rerun is
useful.

| Rerun readiness | Rows | Meaning |
| --- | ---: | --- |
${liveParityRerunReadinessRows(liveParityRerunReadiness)}

| Next step | Rows | Meaning |
| --- | ---: | --- |
${liveParityNextStepRows(liveParityNextSteps)}

Use [live-parity-rerun-plan/summary.md](../live-parity-rerun-plan/summary.md)
for the exact row, command, receipt, diagnosis, and follow-up.

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

## Production Disposition Boundary

The top-20 catalog entries are currently supported for the declared local-test
scope. Production support is tracked separately. A review-ready row has accepted
dispositions for scan/gate warnings, lifecycle risks, target facts, storage
policy, RBAC, webhook behavior, and extension slots. Final production support
is recorded only in the target-scoped support decision artifacts.

| Metric | Value |
| --- | ---: |
| production-review-ready disposition rows | ${context.productionRows.filter((row) => row.production_support === "production-review-ready").length}/${context.productionRows.length} |
| production-blocked pending disposition | ${context.productionRows.filter((row) => row.production_support === "blocked").length}/${context.productionRows.length} |
| charts with accepted dispositions | ${context.productionRows.filter((row) => dispositionCount(row.accepted_dispositions) > 0).length}/${context.productionRows.length} |
| target-scoped support decision artifacts | ${context.productionSupportDecisionRows.length}/${context.productionRows.length} |
| supported decision artifacts | ${count(context.productionSupportDecisionRows, "decision", "supported")}/${context.productionRows.length} |
| superseded decision artifacts | ${count(context.productionSupportDecisionRows, "decision", "superseded")}/${context.productionRows.length} |
| rejected decision artifacts | ${count(context.productionSupportDecisionRows, "decision", "rejected")}/${context.productionRows.length} |
| draft decision artifacts | ${count(context.productionSupportDecisionRows, "decision", "draft")}/${context.productionRows.length} |
| high-priority scan rows | ${highScanRows.length}/${context.scanDispositionRows.length} |
| mutable-image rows still needing fixes | ${context.scanDispositionRows.filter((row) => row.dispositionRoute === "fix-image-pin").length}/${context.scanDispositionRows.length} |

| Open disposition | Charts |
| --- | ---: |
${productionBlockers.length ? productionBlockers.map(([blocker, count]) => `| ${blocker} | ${count} |`).join("\n") : "| none | 0 |"}

| Scan route | Charts |
| --- | ---: |
${mapRows(scanDispositionRoutes)}

| Chart | Production | Accepted | Open | Next action |
| --- | --- | ---: | ---: | --- |
${productionPreview.map((row) => `| ${row.chart}@${row.version} | ${row.production_support} | ${dispositionCount(row.accepted_dispositions)} | ${dispositionCount(row.open_dispositions)} | ${row.next_action} |`).join("\n")}

Use [production-disposition/summary.md](../production-disposition/summary.md)
for the full top-20 disposition table and
[scan-disposition-workdown/summary.md](../scan-disposition-workdown/summary.md)
for the scan warning routes. Use
[production-support-decisions/summary.md](../production-support-decisions/summary.md)
for target-scoped support decision artifacts.

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

## Extension Slot Coverage

Extension slots are Helm inputs that can inject raw manifests, templated
snippets, config blocks, sidecars, extra volumes, or chart-specific config
files. They are useful, but a populated slot changes the install shape. The
supported catalog route is to keep them empty or controlled in the first base,
then create a reviewed \`cub installer\` base when a slot is populated.

| Scope | Charts |
| --- | ---: |
| top-20 catalog charts with extension slots | ${top20ExtensionRows.length}/20 |
| top-100 chart facts with extension slots | ${context.extensionRows.length}/100 |
| top-500 source rows using \`tpl\` | ${Number(context.quirkRows.find((row) => row.axis === "tpl-extension-slots")?.top500_count ?? 0)}/${context.top500Rows.length} |

| Top-20 chart | Example surfaces | Route |
| --- | --- | --- |
${top20ExtensionRows.map((row) => `| ${row.chart} | ${row.surfaces} | ${row.current_route} |`).join("\n")}

Use [extension-slots/summary.md](../extension-slots/summary.md) for the full
NGINX-style extension-slot report.

## Hook Residue

| Hook chart | Selected base | Current disposition | Next action |
| --- | --- | --- | --- |
${hookPreview.map((row) => `| ${row.chart}@${row.version} | ${row.selected_base} | ${row.lifecycle_disposition} | ${row.next_action} |`).join("\n")}

Hook rows are not support claims. Route-selected means the chart has an
explicit handling plan; lifecycle-observed means that plan has runtime or
execution evidence. The hook doctrine is
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
| How much of the retained top500 source scan maps to current proof? | [top500-catalog-analysis/review.csv](../top500-catalog-analysis/review.csv) |
| Which base variants have which proof lanes? | [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) |
| Which top-20 base variant should I start with? | [top20-base-readiness/summary.md](../top20-base-readiness/summary.md) |
| Which hooks, CRDs, generated facts, or target facts matter? | [outcome-coverage/feature-outcomes.csv](../outcome-coverage/feature-outcomes.csv) |
| Which charts have NGINX-like extension slots? | [extension-slots/summary.md](../extension-slots/summary.md) |
| Which Helm quirk axes are still blind spots? | [quirk-coverage/coverage.csv](../quirk-coverage/coverage.csv) |
| Which hook charts need lifecycle receipts? | [hook-lifecycle/top100-hooks.csv](../hook-lifecycle/top100-hooks.csv) |
| Which hook claims are queued versus observed? | [lifecycle-boundary/summary.md](../lifecycle-boundary/summary.md) |
| Which Helm artifacts have recovered graph fragments? | [edge-recovery/summary.md](../edge-recovery/summary.md) |
| Which live comparisons passed or failed? | [live-helm-confighub-compare/summary.csv](../live-helm-confighub-compare/summary.csv) |
| Which live rows should be rerun next? | [live-parity-rerun-plan/summary.md](../live-parity-rerun-plan/summary.md) |
| Which top-20 charts are production-supported? | [production-support-decisions/summary.md](../production-support-decisions/summary.md) |
| Which production-support tasks can be assigned? | [production-support-decisions/work-items.csv](../production-support-decisions/work-items.csv) |
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

function top20StatusRows(top100Rows, chartByName, top20BaseReadinessRows, productionSupportDecisionRows) {
  const readinessByChart = new Map();
  for (const row of top20BaseReadinessRows) {
    const rows = readinessByChart.get(row.chart) ?? [];
    rows.push(row);
    readinessByChart.set(row.chart, rows);
  }
  const supportByChart = new Map(productionSupportDecisionRows.map((row) => [`${row.chart}@${row.version}`, row]));
  return top100Rows
    .filter((row) => row.catalog_tier === "top20-catalog-supported")
    .map((row) => {
      const baseRows = readinessByChart.get(row.chart) ?? [];
      const recommended = recommendedBaseRow(baseRows);
      const support = supportByChart.get(row.chart);
      return {
        rank: row.proof_surface_rank,
        chart: row.chart,
        variants: row.variants,
        recommended_base: recommended ? `${recommended.base} (${recommended.user_readiness})` : "-",
        recommended_setup_command: recommended?.command ?? "",
        base_readiness: readinessSummary(baseRows),
        user_status: row.user_status,
        strongest_evidence: row.strongest_evidence,
        render_parity: row.render_parity,
        in_confighub: row.in_confighub,
        local_live: row.local_live,
        gitops_live: row.gitops_live,
        live_parity: row.live_parity,
        feature_summary: chartByName.get(row.chart)?.feature_summary ?? "",
        hard_gap: row.hard_gap,
        next_action: support?.next_action || row.next_action,
        next_action_source: support ? "production-support-decisions" : row.next_action_source,
        catalog_path: row.catalog_path,
      };
    })
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function recommendedBaseRow(baseRows) {
  const readinessRank = new Map([
    ["start-here", 0],
    ["try-with-proof", 1],
    ["lifecycle-observed", 2],
    ["prerequisite-observed", 3],
    ["runtime-watch", 4],
    ["runtime-review-needed", 5],
    ["hook-lifecycle-review-needed", 6],
    ["target-prerequisite-needed", 7],
    ["render-only", 8],
    ["blocked", 9],
  ]);
  return [...baseRows].sort((left, right) => {
    const leftRank = readinessRank.get(left.user_readiness) ?? 99;
    const rightRank = readinessRank.get(right.user_readiness) ?? 99;
    if (leftRank !== rightRank) return leftRank - rightRank;
    if (left.recommended_first !== right.recommended_first) return left.recommended_first === "yes" ? -1 : 1;
    return left.base.localeCompare(right.base);
  })[0];
}

function top20ToCsv(rows) {
  const headers = [
    "rank",
    "chart",
    "variants",
    "recommended_base",
    "recommended_setup_command",
    "base_readiness",
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
    "next_action_source",
    "catalog_path",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function readinessSummary(rows) {
  if (!rows.length) return "-";
  const summary = groupCount(rows, "user_readiness");
  const priority = [
    "start-here",
    "try-with-proof",
    "lifecycle-observed",
    "prerequisite-observed",
    "runtime-watch",
    "runtime-review-needed",
    "target-prerequisite-needed",
    "hook-lifecycle-review-needed",
  ];
  return [...summary.entries()]
    .sort((a, b) => {
      const priorityA = priority.includes(a[0]) ? priority.indexOf(a[0]) : priority.length;
      const priorityB = priority.includes(b[0]) ? priority.indexOf(b[0]) : priority.length;
      return priorityA - priorityB || a[0].localeCompare(b[0]);
    })
    .map(([key, value]) => `${key}:${value}`)
    .join("; ");
}

function liveParityNextStepRows(counts) {
  const order = [
    "inspect-parity-diff",
    "clean-rerun",
    "stage-prerequisite",
    "lifecycle-route",
    "operating-policy",
    "target-fit-review",
    "gitops-runtime-review",
    "runtime-review",
    "inspect-receipt",
  ];
  return [...counts.entries()]
    .sort((left, right) => {
      const leftRank = order.includes(left[0]) ? order.indexOf(left[0]) : order.length;
      const rightRank = order.includes(right[0]) ? order.indexOf(right[0]) : order.length;
      return leftRank - rightRank || left[0].localeCompare(right[0]);
    })
    .map(([step, count]) => `| ${step} | ${count} | ${liveParityNextStepMeaning(step)} |`)
    .join("\n");
}

function nextWorkQueueRows(context) {
  const top100Status = groupCount(context.top100Rows, "adoption_bucket");
  const liveParityRerunReadiness = groupCount(context.liveParityRerunRows, "rerun_readiness");
  return [
    ...top100WorkQueueObjects(top100Status),
    ...supportDecisionWorkstreamObjects(context.productionSupportDecisionRows),
    ...liveParityRerunReadinessObjects(liveParityRerunReadiness),
    ...hookWorkQueueObjects(context.hookRows, context.lifecycleObservationRows),
  ];
}

function top100WorkQueueObjects(counts) {
  return [
    {
      section: "top100-catalog-work",
      item_type: "queue",
      item: "Use public catalog now",
      count: counts.get("try-from-public-catalog") ?? 0,
      next_action: "Open CATALOG.md and top20 base readiness; choose a base with the lane you need.",
      source: "data/top100-readiness/readiness.csv",
      detail: "adoption_bucket=try-from-public-catalog",
    },
    {
      section: "top100-catalog-work",
      item_type: "queue",
      item: "Promote proof-grade charts",
      count: counts.get("promote-after-review") ?? 0,
      next_action: "Run catalog promotion review, select realistic bases, and add selected live lanes.",
      source: "data/top100-readiness/readiness.csv",
      detail: "adoption_bucket=promote-after-review",
    },
    {
      section: "top100-catalog-work",
      item_type: "queue",
      item: "Design useful base variants",
      count: counts.get("needs-useful-variant") ?? 0,
      next_action: "Create the first user-shaped base before treating the chart as a catalog offer.",
      source: "data/top100-readiness/readiness.csv",
      detail: "adoption_bucket=needs-useful-variant",
    },
    {
      section: "top100-catalog-work",
      item_type: "queue",
      item: "Resolve limitation decisions",
      count: counts.get("limitation-decision-first") ?? 0,
      next_action: "Decide whether the named gap is supported, disclosed, deferred, or blocked.",
      source: "data/top100-readiness/readiness.csv",
      detail: "adoption_bucket=limitation-decision-first",
    },
  ];
}

function supportDecisionWorkstreamObjects(rows) {
  const workstreams = [
    {
      item: "Supported scope evidence",
      rows: rows.filter((row) => row.decision === "supported"),
      next_action: "Keep target-scoped evidence fresh before using the supported scope as a production example.",
    },
    {
      item: "Image digest resolution or exception",
      rows: rows.filter((row) => row.image_decision === "needs-image-digest-resolution-or-exception"),
      next_action: "Pin images by digest or record an explicit exception before production OCI support.",
    },
    {
      item: "Scan scope decision",
      rows: rows.filter((row) => row.scan_decision === "needs-scan-scope-decision"),
      next_action: "Record which scanner findings are accepted, fixed, or outside the supported target scope.",
    },
    {
      item: "Security acceptance or hardened base",
      rows: rows.filter((row) => row.scan_decision === "needs-security-acceptance-or-hardened-base"),
      next_action: "Accept current security findings for the target scope or create a narrower hardened base.",
    },
    {
      item: "Lifecycle decision or observation",
      rows: rows.filter((row) => ["needs-lifecycle-support-boundary", "route-selected-observation-needed"].includes(row.lifecycle_decision)),
      next_action: "Record the lifecycle boundary, or execute and observe the selected hook/lifecycle route.",
    },
    {
      item: "Runtime or missing-lane decision",
      rows: rows.filter((row) => ["needs-runtime-decision-before-final", "needs-missing-live-or-confighub-lanes-before-final", "needs-lifecycle-observation-before-final"].includes(row.live_evidence_decision)),
      next_action: "Close the runtime, missing-lane, or lifecycle-observation decision before refreshing final evidence.",
    },
    {
      item: "Fresh target-scoped evidence",
      rows: rows.filter((row) => row.live_evidence_decision === "needs-fresh-target-evidence-before-final"),
      next_action: "After scope and risk decisions are closed, refresh ConfigHub OCI/GitOps and live/e2e evidence for that exact scope.",
    },
  ];
  return workstreams
    .filter((workstream) => workstream.rows.length > 0)
    .map((workstream) => ({
      section: "top20-production-support",
      item_type: "workstream",
      item: workstream.item,
      count: workstream.rows.length,
      next_action: workstream.next_action,
      source: "data/production-support-decisions/decisions.csv",
      detail: previewCharts(workstream.rows),
    }));
}

function liveParityRerunReadinessObjects(counts) {
  const order = [
    "inspect-diff-first",
    "rerun-now-after-cleanup",
    "model-or-stage-first",
    "review-target-first",
    "inspect-receipt-first",
  ];
  return [...counts.entries()]
    .sort((left, right) => {
      const leftRank = order.includes(left[0]) ? order.indexOf(left[0]) : order.length;
      const rightRank = order.includes(right[0]) ? order.indexOf(right[0]) : order.length;
      return leftRank - rightRank || left[0].localeCompare(right[0]);
    })
    .map(([readiness, count]) => ({
      section: "live-parity-work",
      item_type: "queue",
      item: readiness,
      count,
      next_action: liveParityRerunReadinessMeaning(readiness),
      source: "data/live-parity-rerun-plan/rerun-plan.csv",
      detail: `rerun_readiness=${readiness}`,
    }));
}

function hookWorkQueueObjects(hookRows, lifecycleObservationRows) {
  const routeSelected = hookRows.filter((row) => row.lifecycle_disposition === "route-selected").length;
  const observed = hookRows.filter((row) => row.lifecycle_disposition === "lifecycle-observed").length;
  const relatedObserved = passCount(lifecycleObservationRows, "result");
  return [
    {
      section: "hook-and-lifecycle-work",
      item_type: "queue",
      item: "Hook route selected, observation pending",
      count: routeSelected,
      next_action: "Run the selected lifecycle path and commit execution or observation receipts.",
      source: "data/hook-lifecycle/top100-hooks.csv",
      detail: "lifecycle_disposition=route-selected",
    },
    {
      section: "hook-and-lifecycle-work",
      item_type: "queue",
      item: "Hook-bearing rows observed",
      count: observed,
      next_action: "Keep receipt freshness current when the supported target changes.",
      source: "data/hook-lifecycle/top100-hooks.csv",
      detail: "lifecycle_disposition=lifecycle-observed",
    },
    {
      section: "hook-and-lifecycle-work",
      item_type: "queue",
      item: "Related CRD/webhook/controller observations",
      count: relatedObserved,
      next_action: "Use these as examples for hook-like lifecycle proof, not as universal hook support.",
      source: "data/lifecycle-observations/cert-manager-eso/summary.csv",
      detail: "related lifecycle observations, not universal hook support",
    },
  ];
}

function nextWorkQueueMarkdown(rows, section, label) {
  return rows
    .filter((row) => row.section === section)
    .map((row) => `| ${row.item} | ${row.count} | ${row.next_action} |`)
    .join("\n") || `| none | 0 | No current ${label} rows. |`;
}

function activeProofQueueRows(rows) {
  return rows.map((row) => ({
    chart: `${row.chart}@${row.version}`,
    base: row.base,
    current_result: row.current_result,
    next_step_type: row.next_step_type,
    reason: row.reason,
    support_artifact: row.support_artifact,
    receipt: row.receipt,
    rerun_command: row.rerun_command,
  }));
}

function activeProofQueueMarkdown(rows) {
  return rows
    .map((row) => `| ${row.chart} | ${row.base} | ${row.current_result} | ${row.next_step_type} | [${row.support_artifact}](../../${row.support_artifact}) |`)
    .join("\n") || "| none | - | - | - | - |";
}

function nextWorkQueuesToCsv(rows) {
  const headers = ["section", "item_type", "item", "count", "next_action", "source", "detail"];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function activeProofQueueToCsv(rows) {
  const headers = ["chart", "base", "current_result", "next_step_type", "reason", "support_artifact", "receipt", "rerun_command"];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function previewCharts(rows) {
  const values = rows.slice(0, 5).map((row) => `${row.chart}@${row.version} (${row.candidateBase || row.supported_base || row.base || "base"})`);
  const remaining = rows.length - values.length;
  if (remaining > 0) values.push(`and ${remaining} more`);
  return values.join("; ");
}

function liveParityRerunReadinessRows(counts) {
  const order = [
    "inspect-diff-first",
    "rerun-now-after-cleanup",
    "model-or-stage-first",
    "review-target-first",
    "inspect-receipt-first",
  ];
  return [...counts.entries()]
    .sort((left, right) => {
      const leftRank = order.includes(left[0]) ? order.indexOf(left[0]) : order.length;
      const rightRank = order.includes(right[0]) ? order.indexOf(right[0]) : order.length;
      return leftRank - rightRank || left[0].localeCompare(right[0]);
    })
    .map(([readiness, count]) => `| ${readiness} | ${count} | ${liveParityRerunReadinessMeaning(readiness)} |`)
    .join("\n");
}

function liveParityRerunReadinessMeaning(readiness) {
  return {
    "inspect-diff-first": "Inspect the semantic diff before another rerun.",
    "rerun-now-after-cleanup": "Rerun serially on a clean host after confirming no other live lane is running.",
    "model-or-stage-first": "Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning.",
    "review-target-first": "Review runtime, storage, controller health, or wait conditions before rerunning.",
    "inspect-receipt-first": "Read the receipt and classify the row before rerunning.",
  }[readiness] ?? "Read the receipt and classify the row before rerunning.";
}

function liveParityNextStepMeaning(step) {
  return {
    "inspect-parity-diff": "Inspect the semantic object diff before changing waits, target provisioning, or the recipe.",
    "clean-rerun": "Rerun once on a clean host with serial execution and authoritative cleanup.",
    "stage-prerequisite": "Stage or model CRDs, APIs, Secrets, storage, or another target prerequisite before rerunning.",
    "lifecycle-route": "Choose the hook or lifecycle observation route before rerunning strict parity.",
    "operating-policy": "Record the operating policy decision, then rerun only if expected readiness changes.",
    "target-fit-review": "Choose a target that provides the required platform behavior, or create a base that fits the target.",
    "gitops-runtime-review": "Inspect GitOps/controller health and rerun after target conditions or controller waits are corrected.",
    "runtime-review": "Inspect runtime readiness, waits, storage, capacity, or app initialization before rerunning.",
    "inspect-receipt": "Read the receipt and classify the row before rerunning.",
  }[step] ?? "Read the receipt and classify the row before rerunning.";
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

function dispositionCount(value) {
  return splitDisposition(value).length;
}

function flattenCounts(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    for (const value of splitDisposition(row[field])) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

function splitDisposition(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}
