#!/usr/bin/env node
// The master catalog matrix: ONE generated view of the whole catalog, one row
// per (chart, version, variant), joining the per-variant lane results with
// chart-level translation attributes (tier, adoption bucket, quirk features,
// hook disposition, target run decisions, outcome level, and downstream
// ConfigHub-derived variants. It invents no new truth - every cell is a join
// over committed sources, and the verifier fails when this view goes stale
// against them.
//
// Three renderings of the same rows:
//   matrix.csv  - machine/spreadsheet import (words, not colors: CSV cannot
//                 carry formatting; open matrix.html for the colored cells)
//   summary.md  - GitHub-readable compact table with icons
//   matrix.html - self-contained colored-cell rendering for a browser
//
// Cell vocabulary:
//   yes (pass)            -> green
//   watch                 -> amber: passing with a recorded caution
//   no (blocked/failed)   -> red
//   todo (not yet run)    -> grey box: absence of evidence, not a failure
//   n/a                   -> neutral blue-grey: the attribute does not apply
//
// Deferred/postponed work is not a cell state. It is an action overlay derived
// from the coverage completion plan so the matrix can show rows whose non-green
// cells already have an accepted disposition and should not consume live-run
// time.
//
//   node scripts/generate-master-catalog-matrix.mjs --generate
//   node scripts/generate-master-catalog-matrix.mjs --verify

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "master-catalog-matrix");
const GITHUB_TREE_ROOT = "https://github.com/confighub/helm-expt/tree/main";
const GITHUB_BLOB_ROOT = "https://github.com/confighub/helm-expt/blob/main";
const outputs = {
  summary: join(outputRoot, "summary.md"),
  matrix: join(outputRoot, "matrix.csv"),
  html: join(outputRoot, "matrix.html"),
  generatedAt: join(outputRoot, "generated-at.txt"),
};

const SOURCES = {
  outcomes: "data/outcome-coverage/base-outcomes.csv",
  readiness: "data/top100-readiness/readiness.csv",
  hooks: "data/hook-disposition/top100-hook-dispositions.csv",
  maintainedHooks: "data/hook-lifecycle/maintained-hook-queue.csv",
  hookCandidates: "data/hook-route-candidates/candidates.csv",
  selectedHookRoutes: "data/lifecycle-boundary/selected-routes.csv",
  lifecycleRoutes: "data/lifecycle-routes/routes.csv",
  decisions: "data/production-support-decisions/decisions.csv",
  activeProof: "data/live-parity-rerun-plan/rerun-plan.csv",
  variantPromotion: "data/variant-promotion/status.csv",
  liveCompare: "data/live-helm-confighub-compare/summary.csv",
  runtimeGitopsRoot: "data/runtime-gitops/receipts",
  kindParity: "data/live-kind-parity/summary.csv",
  coverageCompletion: "data/coverage-completion-plan/actions.json",
  derivedTargetBound: "data/derived-variant-target-bound/summary.csv",
  derivedExecutionRoot: "runs/derived-variant-execution",
  wave2VariantWorkOrders: "data/catalog-promotion-wave2/variant-work-orders.yaml",
  usefulBaseWave2: "data/useful-base-realization-wave/wave2-selection.csv",
  targetPrereqActions: "data/target-prerequisite-actions/actions.csv",
  renderIntents: "data/helm-render-intents/intents.csv",
};

// Spine columns come from base-outcomes (the derived lane superset).
// lane-test-matrix/variant-lanes.csv is its upstream intermediate and is no
// longer read here - rationalization plan R1.
const LANE_COLUMNS = [
  ["lane_render_parity", "render_parity"],
  ["lane_confighub_scan_ops", "in_confighub"],
  ["lane_local_kind", "local_live"],
  ["lane_lifecycle_observed", "lifecycle_observation"],
  ["lane_gitops_oci_live", "gitops_oci_live"],
  ["lane_live_dual_parity", "live_helm_vs_confighub_parity"],
];

// What each joined source carries into this view and what stays behind -
// rendered into the summary so the compression is documented, not silent.
const COLUMN_PROVENANCE = [
  {
    source: "outcome-coverage/base-outcomes.csv",
    carried: "the spine: variants, the five proof lanes, lifecycle observation, two-cluster kind parity (K), outcome level, core-lane completeness, recipe path",
    dropped: "two_cluster_kind_parity_reason, missing_or_non_pass_lanes, evidence_notes, package_path, variant_revision",
  },
  {
    source: "top100-readiness/readiness.csv",
    carried: "catalog tier, adoption bucket, quirk features, hard gap, strongest evidence, next action",
    dropped: "workability, user_status, per-chart lane ratios, proof_surface_rank, top500_rank, next_action_source/receipt, file paths",
  },
  {
    source: "hook-disposition/top100-hook-dispositions.csv",
    carried: "source-top100 hook count, disposition, live status",
    dropped: "hook_phases, selected_route detail, evidence_status text, next_action, evidence paths, rank",
  },
  {
    source: "hook-lifecycle/maintained-hook-queue.csv",
    carried: "maintained hook lifecycle fallback rows when a chart has an observed route outside the source-top100 disposition table",
    dropped: "hook examples, route details, required receipt path, next action",
  },
  {
    source: "hook-route-candidates/candidates.csv",
    carried: "candidate hook routes for charts whose hook or hook-like lifecycle work has been reviewed but not promoted to a maintained receipt",
    dropped: "pattern, phases, delete policies, dependency source, target dependencies, promotion next step",
  },
  {
    source: "lifecycle-boundary/selected-routes.csv",
    carried: "base-specific hook candidate routes that have a selected route receipt",
    dropped: "receipt evidence list, non-claim boundaries, remaining work",
  },
  {
    source: "lifecycle-routes/routes.csv",
    carried: "route-contract status, route count, disposition summary, execution-mode summary, safe-as-automatic count, and chart-family evidence version when needed",
    dropped: "per-route alternatives, requirements, exact evidence/next-action text; follow the JSON/CSV route contract for agent-readable detail",
  },
  {
    source: "production-support-decisions/decisions.csv",
    carried: "target run decision and target scope",
    dropped: "delivery_path, image/scan/lifecycle/target-fact/live-evidence sub-decisions, evidence_count, remaining_final_requirements, next_action",
  },
  {
    source: "variant-promotion/status.csv",
    carried: "server-side ConfigHub promotion status, matrix value, evidence path, reason, and next action",
    dropped: "none; follow the source when you need the full per-row promotion route",
  },
  {
    source: "live-helm-confighub-compare/summary.csv",
    carried: "exact chart/version/base live GitOps/OCI and live Helm-vs-ConfigHub parity result, overriding older aggregate outcome rows when a newer receipt exists",
    dropped: "receipt reason and path; follow the source when diagnosing the run itself",
  },
  {
    source: "runtime-gitops/receipts",
    carried: "exact committed RuntimeGitOps receipt result for a chart/base, overriding stale aggregate GitOps lane values when present",
    dropped: "controller logs, workload diagnostics, and target-prerequisite detail; follow the receipt when diagnosing the run itself",
  },
  {
    source: "live-kind-parity/summary.csv",
    carried: "exact chart/version/base two-cluster kind parity result, overriding older aggregate outcome rows when a newer receipt exists",
    dropped: "semantic parity details, reason, related lifecycle evidence, and receipt path",
  },
  {
    source: "live-parity-rerun-plan/rerun-plan.csv",
    carried: "active non-pass live parity rows: current result, next step, rerun readiness, reason, support artifact, rerun command",
    dropped: "priority and receipt path; follow the source when diagnosing the run itself",
  },
  {
    source: "coverage-completion-plan/actions.json",
    carried: "row-level completion action overlay: active run/fix/stage work, upstream dependency, scope decision, or deferred accepted disposition",
    dropped: "full cell-level completion families; follow the coverage completion plan for the exact affected cells and family ranking",
  },
  {
    source: "../runs/derived-variant-execution",
    carried: "real downstream ConfigHub derived variants: source base, downstream space, clone/link/gate result, environment, region, and no-Helm-rerender proof",
    dropped: "full command transcript, unit hash details, corrective update details, and gate counts",
  },
  {
    source: "derived-variant-target-bound/summary.csv",
    carried: "target-bound status for derived variants when a downstream variant has been reconciled through OCI/Argo and observed",
    dropped: "receipt internals; follow the target-bound receipt when diagnosing the target run",
  },
  {
    source: "catalog-promotion-wave2/variant-work-orders.yaml",
    carried: "candidate F2 base/fork rows that are explicitly not rendered yet and need recipe/package/evidence work before becoming real bases",
    dropped: "per-value detail beyond the compact inputs, blockers, and first action shown in the candidate row",
  },
  {
    source: "useful-base-realization-wave/wave2-selection.csv",
    carried: "candidate F2 user-shaped base rows from the useful-base queue, including render-time knobs, target inputs, and required receipts",
    dropped: "priority scoring internals; follow the source for full wave ordering",
  },
  {
    source: "target-prerequisite-actions/actions.csv",
    carried: "candidate F3 target prerequisite/fill rows, including required facts, action kind, evidence required, and whether human review is needed",
    dropped: "duplicate lane-level rows after they are grouped by chart/base/prerequisite/action",
  },
  {
    source: "helm-render-intents/intents.csv",
    carried: "one lifecycle-contract state and one target-prerequisite state for every real base, plus requirement/action counts and the exact generated intent",
    dropped: "the full route implementations, normalized prerequisite records, freshness rules, and evidence links; follow the render intent for those details",
  },
];

if (mode === "--generate") {
  const generatedAt = process.env.HELM_EXPT_MASTER_MATRIX_GENERATED_AT || new Date().toISOString();
  const report = buildReport(generatedAt);
  write(outputs.matrix, report.csv);
  write(outputs.summary, report.summary);
  write(outputs.html, report.html);
  write(outputs.generatedAt, `${generatedAt}\n`);
  console.log(`wrote master catalog matrix -> ${relativeRepo(outputRoot)}/ (${report.rows.length} matrix rows)`);
} else if (mode === "--verify") {
  check(existsSync(outputs.generatedAt), `${relativeRepo(outputs.generatedAt)} is missing; run npm run master-matrix`);
  const report = buildReport(readFileSync(outputs.generatedAt, "utf8").trim());
  const expected = { summary: report.summary, matrix: report.csv, html: report.html };
  for (const [name, path] of Object.entries(outputs).filter(([name]) => name !== "generatedAt")) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run master-matrix`);
    check(readFileSync(path, "utf8") === expected[name], `${relativeRepo(path)} is stale; run npm run master-matrix`);
  }
  console.log(`verified master catalog matrix: ${report.rows.length} matrix rows, ${report.charts} chart versions`);
} else {
  console.log(`Usage:
  node scripts/generate-master-catalog-matrix.mjs --generate
  node scripts/generate-master-catalog-matrix.mjs --verify`);
}

function buildReport(generatedAt) {
  const outcomes = readCsv(SOURCES.outcomes);
  const readiness = indexBy(readCsv(SOURCES.readiness), (row) => row.chart);
  const hookRows = readCsv(SOURCES.hooks);
  const maintainedHookRows = readCsv(SOURCES.maintainedHooks).map((row) => ({
    chart: row.chart,
    version: row.version,
    source_hook_count: row.hook_count,
    disposition: row.receipt_status === "observed" ? "observed" : row.lifecycle_disposition || "routed",
    live_status: row.receipt_status,
  }));
  const hookCandidateRows = readCsv(SOURCES.hookCandidates).map((row) => ({
    chart: row.chart,
    version: row.version,
    source_hook_count: hookCandidateCount(row),
    disposition: "candidate-route",
    live_status: "none",
  }));
  const selectedHookRouteRows = readCsv(SOURCES.selectedHookRoutes).map((row) => ({
    chart: row.chart,
    version: row.version,
    base: row.base,
    source_hook_count: row.hook_count || "1",
    disposition: row.status === "lifecycle-observed" ? "observed" : row.status,
    live_status: row.status === "lifecycle-observed" ? "observed" : row.status === "blocked" ? "blocked" : "none",
  }));
  const hooksExact = indexBy(hookRows, (row) => `${row.chart}@${row.version}`);
  const hooksByChart = indexBy(hookRows, (row) => row.chart);
  const maintainedHooksExact = indexBy(maintainedHookRows, (row) => `${row.chart}@${row.version}`);
  const maintainedHooksByChart = indexBy(maintainedHookRows, (row) => row.chart);
  const hookCandidatesExact = indexBy(hookCandidateRows, (row) => `${row.chart}@${row.version}`);
  const hookCandidatesByChart = indexBy(hookCandidateRows, (row) => row.chart);
  const selectedHookRoutesExactBase = indexBy(selectedHookRouteRows, (row) => `${row.chart}@${row.version}|${row.base}`);
  const lifecycleRouteRows = readCsv(SOURCES.lifecycleRoutes);
  const lifecycleRoutes = aggregateLifecycleRoutes(lifecycleRouteRows);
  const lifecycleRoutesByChart = indexBy(lifecycleRoutes.filter((row) => !row.base_or_variant), (row) => row.chart);
  const decisions = indexBy(readCsv(SOURCES.decisions), (row) => `${row.chart}|${row.version}|${row.supported_base}`);
  const variantPromotion = indexBy(readCsv(SOURCES.variantPromotion), (row) => `${row.chart}|${row.version}|${row.variant}`);
  const liveCompare = indexBy(readCsv(SOURCES.liveCompare), (row) => `${row.chart}|${row.version}|${row.variant}`);
  const kindParity = indexBy(readCsv(SOURCES.kindParity), (row) => `${row.chart}|${row.version}|${row.base}`);
  const activeProofRows = readCsv(SOURCES.activeProof);
  const activeProof = groupBy(activeProofRows, (row) => `${row.chart}|${row.version}|${row.base}`);
  const completionActions = aggregateCompletionActions(readJson(SOURCES.coverageCompletion));
  const derivedTargetBoundRows = readCsv(SOURCES.derivedTargetBound);
  const derivedTargetBound = indexBy(derivedTargetBoundRows, (row) => `${row.chart}|${row.version}|${row.base}|${row.variant}`);
  const derivedExecution = mergeDerivedRows(loadDerivedExecutionRows(), derivedTargetBoundRows);
  const renderIntents = indexBy(
    readCsv(SOURCES.renderIntents),
    (row) => `${row.chart}|${row.version}|${row.base}`,
  );

  const baseRows = outcomes
    .map((outcome) => {
      const chartAtVersion = outcome.chart;
      const at = chartAtVersion.lastIndexOf("@");
      check(at > 0, `base-outcomes chart ${chartAtVersion} is not in name@version form`);
      const chartName = chartAtVersion.slice(0, at);
      const version = chartAtVersion.slice(at + 1);
      const variant = outcome.base;
      const recipePath = outcome.recipe_path;
      const recipeCatalogPath = `${recipePath}/CATALOG.md`;
      const variantPath = `${recipePath}/variants/${variant}/variant.yaml`;
      const packageBasePath = `packages/${chartName}/${version}/bases/${variant}`;
      const variantRevisionPath = `${recipePath}/revisions/${variant}/r001/variant-revision.yaml`;
      const sourceLockPath = `${recipePath}/source-lock.yaml`;
      check(existsSync(join(repoRoot, sourceLockPath)), `missing source lock for ${chartAtVersion}`);
      const sourceLock = readYaml(join(repoRoot, sourceLockPath));
      const sourceSpec = sourceLock.spec ?? {};
      const sourceRepositoryURL = sourceSpec.repositoryURL ?? "";
      const sourceContentURL = sourceSpec.contentURL ?? "";
      const ready = readiness.get(chartAtVersion);
      // Hook evidence joins by exact chart@version when available; otherwise
      // it falls back to the chart family's disposition row and SAYS SO via
      // hook_evidence_version - family evidence must not read as evidence
      // for this exact version.
      const hookExact = hooksExact.get(chartAtVersion);
      const selectedHookRouteExactBase = selectedHookRoutesExactBase.get(`${chartAtVersion}|${variant}`);
      const hookFamily = hooksByChart.get(chartName);
      const maintainedHookExact = maintainedHooksExact.get(chartAtVersion);
      const maintainedHookFamily = maintainedHooksByChart.get(chartName);
      const hookCandidateExact = hookCandidatesExact.get(chartAtVersion);
      const hookCandidateFamily = hookCandidatesByChart.get(chartName);
      const hook = selectedHookRouteExactBase ?? hookExact ?? maintainedHookExact ?? hookCandidateExact ?? hookFamily ?? maintainedHookFamily ?? hookCandidateFamily;
      const exactHook = selectedHookRouteExactBase ?? hookExact ?? maintainedHookExact ?? hookCandidateExact;
      const lifecycleRouteExact = lifecycleRouteForBase(
        lifecycleRouteRows,
        chartName,
        version,
        variant,
      );
      const lifecycleRouteFamily = lifecycleRoutesByChart.get(chartName);
      const lifecycleRoute = lifecycleRouteExact ?? lifecycleRouteFamily;
      const lifecycleRouteEvidenceVersion = lifecycleRouteExact || !lifecycleRoute ? "" : lifecycleRoute.version;
      const hookEvidenceVersion = exactHook || !hook ? "" : hook.version;
      const decision = decisions.get(`${chartName}|${version}|${variant}`);
      const promotion = variantPromotion.get(`${chartName}|${version}|${variant}`);
      const liveCompareResult = liveCompare.get(`${chartName}|${version}|${variant}`)?.result;
      const runtimeGitopsResult = runtimeGitopsReceiptResult(chartName, variant);
      const kindParityResult = kindParity.get(`${chartName}|${version}|${variant}`)?.result;
      const activeRows = activeProof.get(`${chartName}|${version}|${variant}`) ?? [];
      const activeLive = activeRows.find((row) => row.lane === "configHub-oci-live-comparison");
      const active = chooseActiveProofRow(activeRows);
      const completion = completionActions.get(`${chartName}|${version}|${variant}`) ?? [];
      // A base with no render intent used to abort this whole view. That looks
      // like strictness and works as a deadlock: the intents are generated from
      // this matrix, so an entry added to the catalog later can enter neither.
      // It is why twelve chart identities sat outside the proof pipeline with
      // nothing recording that they were missing.
      //
      // Absence is an actionable gap, which is the state the doctrine already
      // names, so the row is emitted and says so. The contract lane still holds
      // the line: it counts intents against the matrix's own base rows and fails
      // when one is uncovered, so this cannot become a quiet hole.
      const renderIntent = renderIntents.get(`${chartName}|${version}|${variant}`) ?? null;
      const hookCount = hook ? Number(hook.source_hook_count) : null;
      const nextAction = normalizeTargetRunText(ready?.next_action ?? "");
      // A chart whose source scan flags hooks but that has no disposition row
      // is UNROUTED - rendering it as "no hooks" would hide exactly the gap
      // the hook-disposition completeness gate exists to surface.
      const hookFlagged = (ready?.source_features ?? "").split(";").includes("hooks");
      const baseLayer = baseLayerForVariant(variant);
      const row = {
        row_kind: "base",
        catalog_layer: baseLayer.layer,
        customization_layer: baseLayer.label,
        row_status: "real",
        custom_discussion: "no",
        candidate_source: "",
        candidate_state: "",
        candidate_inputs: "",
        candidate_required_before: "",
        parent_base: "",
        downstream_space: "",
        target_run_status: "",
        target_run_receipt: "",
        target_run_blockers: "",
        chart: chartName,
        version,
        variant,
        catalog_tier: ready?.catalog_tier ?? "",
        adoption_bucket: ready?.adoption_bucket ?? "",
        quirk_features: ready?.source_features ?? "",
        hard_gap: ready?.hard_gap === "-" ? "" : (ready?.hard_gap ?? ""),
        strongest_evidence: ready?.strongest_evidence ?? "",
        next_action: nextAction,
        hook_count: hook ? String(hookCount) : "",
        hook_disposition: hook ? (hookCount === 0 ? "n/a" : hook.disposition) : hookFlagged ? "unrouted" : "",
        hook_evidence_version: hookEvidenceVersion,
        hook_live_status: hook && hookCount > 0 ? (hook.live_status === "observed" ? "yes" : hook.live_status === "none" ? "todo" : hook.live_status.startsWith("none (") ? "n/a" : "no") : hook ? "n/a" : "",
        lifecycle_route_contract: lifecycleRoute?.contract_status ?? "n/a",
        lifecycle_route_count: lifecycleRoute?.route_count ?? "",
        lifecycle_route_dispositions: lifecycleRoute?.dispositions ?? "",
        lifecycle_route_execution_modes: lifecycleRoute?.execution_modes ?? "",
        lifecycle_route_safe_automatic: lifecycleRoute?.safe_as_automatic ?? "",
        lifecycle_route_evidence_version: lifecycleRouteEvidenceVersion,
        lifecycle_route_contract_path: lifecycleRoute ? "data/lifecycle-routes/summary.md" : "",
        lifecycle_route_json_path: lifecycleRoute ? "data/lifecycle-routes/routes.json" : "",
        render_intent_state: renderIntent ? "attached" : "actionable-gap",
        render_intent_next_action: renderIntent ? "" : "generate a Helm render intent for this base, then re-run the matrix",
        render_intent_path: renderIntent?.intent_path ?? "",
        render_intent_lifecycle_state: renderIntent?.lifecycle_contract_state ?? "",
        render_intent_lifecycle_reason: renderIntent?.lifecycle_contract_reason ?? "",
        render_intent_lifecycle_next_action: renderIntent?.lifecycle_contract_next_action ?? "",
        render_intent_target_state: renderIntent?.target_fact_contract_state ?? "",
        render_intent_target_reason: renderIntent?.target_fact_contract_reason ?? "",
        render_intent_target_next_action: renderIntent?.target_fact_contract_next_action ?? "",
        render_intent_target_requirement_count: renderIntent?.target_requirement_count ?? "",
        render_intent_target_action_count: renderIntent?.target_fact_action_count ?? "",
        ...Object.fromEntries(LANE_COLUMNS.map(([target, source]) => [target, normalizeLane(outcome[source])])),
        lane_two_cluster_kind: normalizeLane(outcome.two_cluster_kind_parity),
        core_lanes_complete: outcome.complete_core_lane_set === "yes" ? "yes" : "no",
        outcome_level: outcome.outcome_level ?? "",
        production_decision: decision ? (decision.decision === "supported" ? "yes" : decision.decision === "rejected" ? "no" : decision.decision) : "todo",
        production_target_scope: decision?.target_scope ?? "",
        variant_promotion: promotion?.matrix_value ?? "todo",
        variant_promotion_status: promotion?.promotion_status ?? "missing-status",
        variant_promotion_evidence: promotion?.evidence ?? "",
        variant_promotion_reason: promotion?.reason ?? "no server-side promotion status row exists yet for this base",
        variant_promotion_next_action: promotion?.next_action ?? "generate or run the server-side variant promotion status for this base",
        active_proof_next_step: active?.next_step_type ?? "",
        active_proof_readiness: active?.rerun_readiness ?? "",
        active_proof_reason: active?.reason ?? "",
        active_proof_command: active?.rerun_command ?? "",
        active_proof_support_artifact: active?.support_artifact ?? "",
        recipe_path: recipePath,
        recipe_catalog_path: recipeCatalogPath,
        variant_path: variantPath,
        package_base_path: packageBasePath,
        variant_revision_path: variantRevisionPath,
        source_lock_path: sourceLockPath,
        source_repository_url: sourceRepositoryURL,
        source_content_url: sourceContentURL,
        github_recipe_url: `${GITHUB_TREE_ROOT}/${recipePath}`,
        github_catalog_url: `${GITHUB_BLOB_ROOT}/${recipeCatalogPath}`,
        github_package_base_url: `${GITHUB_TREE_ROOT}/${packageBasePath}`,
      };
      if (liveCompareResult) {
        const value = normalizeLane(liveCompareResult);
        row.lane_gitops_oci_live = value;
        row.lane_live_dual_parity = value;
      } else if (activeLive?.current_result) {
        const value = normalizeLane(activeLive.current_result);
        row.lane_gitops_oci_live = value;
        row.lane_live_dual_parity = value;
      }
      if (runtimeGitopsResult) {
        row.lane_gitops_oci_live = normalizeLane(runtimeGitopsResult);
      }
      if (kindParityResult) {
        row.lane_two_cluster_kind = normalizeLane(kindParityResult);
      }
      if (row.lane_lifecycle_observed === "todo" && !needsLifecycleLane(row)) {
        row.lane_lifecycle_observed = "n/a";
      }
      const completionSummary = summarizeCompletion(completion, row);
      row.completion_action = completionSummary.primary;
      row.completion_action_summary = completionSummary.summary;
      row.completion_action_families = completionSummary.families;
      row.completion_deferred_cells = String(completionSummary.deferredCells);
      row.completion_owner_lanes = completionSummary.owners;
      return row;
    });
  const baseIndex = indexBy(baseRows, (row) => `${row.chart}|${row.version}|${row.variant}`);
  const baseByChartVersion = preferredBaseByChartVersion(baseRows);
  const sourceRows = [...baseByChartVersion.values()].map((base) => sourceMatrixRow(base));
  const candidateRows = loadCandidateRows(baseIndex, baseByChartVersion);
  const rows = [
    ...sourceRows,
    ...baseRows,
    ...candidateRows,
    ...derivedExecution.map((receiptRow) => derivedMatrixRow(receiptRow, baseIndex, derivedTargetBound)),
  ].sort(compareMatrixRows);

  // No silent gaps: spine rows that did not join the chart-level sources are
  // counted and listed, not dropped or blank-faked.
  const unmatchedReadiness = [...new Set(rows.filter((row) => !row.catalog_tier).map((row) => `${row.chart}@${row.version}`))].sort();
  const charts = new Set(rows.map((row) => `${row.chart}@${row.version}`)).size;

  return {
    rows,
    charts,
    unmatchedReadiness,
    csv: toCsv(rows),
    summary: summary(rows, charts, unmatchedReadiness),
    html: htmlReport(rows, charts, unmatchedReadiness, generatedAt),
  };
}

function normalizeLane(value) {
  if (value === "pass") return "yes";
  if (value === "watch") return "watch";
  if (value === "blocked" || value === "fail") return "no";
  if (value === "missing") return "todo";
  if (value === "not-applicable" || value === "n/a") return "n/a";
  return value ?? "";
}

function icon(value) {
  if (value === "yes") return "✅";
  if (value === "watch") return "⚠️";
  if (value === "no") return "❌";
  if (value === "todo") return "⬜";
  if (value === "n/a" || value === "") return "-";
  return value;
}

function splitList(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hookCandidateCount(row) {
  return row.source_hook_count || "1";
}

function lifecycleRouteForBase(rows, chart, version, base) {
  const exactVersion = rows.filter((row) => row.chart === chart && row.version === version);
  if (!exactVersion.length) return null;

  const exactBase = exactVersion.filter((row) => row.base_or_variant === base);
  const exactQuirkClasses = new Set(exactBase.map((row) => row.quirk_class));
  const selected = [
    ...exactVersion.filter((row) => !row.base_or_variant && !exactQuirkClasses.has(row.quirk_class)),
    ...exactBase,
  ];
  if (!selected.length) return null;

  return summarizeLifecycleRouteRows(selected, chart, version, base);
}

function aggregateLifecycleRoutes(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.chart}@${row.version}|${row.base_or_variant ?? ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        chart: row.chart,
        version: row.version,
        base_or_variant: row.base_or_variant ?? "",
        rows: [],
      });
    }
    groups.get(key).rows.push(row);
  }
  return [...groups.values()].map((group) =>
    summarizeLifecycleRouteRows(
      group.rows,
      group.chart,
      group.version,
      group.base_or_variant,
    ));
}

function summarizeLifecycleRouteRows(rows, chart, version, base) {
  const dispositions = countValues(rows.map((row) => row.disposition));
  const executionModes = countValues(rows.map((row) => row.execution_mode));
  const routeCount = rows.length;
  const automaticCount = rows.filter((row) => row.safe_as_automatic === "yes").length;
  const hasTodo = rows.some((row) => row.disposition === "todo");
  const allObserved = rows.every((row) => row.disposition === "observed");
  const contractStatus = hasTodo ? "todo" : allObserved ? "yes" : "watch";
  return {
    chart,
    version,
    base_or_variant: base,
    route_count: String(routeCount),
    contract_status: contractStatus,
    dispositions: summarizeCounts(dispositions),
    execution_modes: summarizeCounts(executionModes),
    safe_as_automatic: `${automaticCount}/${routeCount}`,
  };
}

function countValues(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function summarizeCounts(counts) {
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => `${value}:${count}`)
    .join("; ");
}

function summarizeLayerCounts(rows) {
  const counts = countValues(rows.map((row) => row.catalog_layer));
  const order = ["F1", "F2a", "F2b", "F2c", "F3", "F4a", "F4b"];
  return order
    .filter((layer) => counts.has(layer))
    .map((layer) => `${layer}:${counts.get(layer)}`)
    .join(" / ");
}

function renderIntentCoverageCounts(rows) {
  const bases = rows.filter((row) => row.row_kind === "base");
  return {
    lifecycleAttached: bases.filter((row) => row.render_intent_lifecycle_state === "attached").length,
    lifecycleGap: bases.filter((row) => row.render_intent_lifecycle_state === "actionable-gap").length,
    lifecycleNone: bases.filter((row) => row.render_intent_lifecycle_state === "no-route-required").length,
    targetAttached: bases.filter((row) =>
      ["attached", "attached-with-observed-actions"].includes(row.render_intent_target_state)).length,
    targetGap: bases.filter((row) => row.render_intent_target_state === "actionable-gap").length,
    targetNone: bases.filter((row) => row.render_intent_target_state === "no-target-facts-required").length,
  };
}

function needsLifecycleLane(row) {
  if (row.hook_disposition && row.hook_disposition !== "n/a") return true;
  const features = splitList(row.quirk_features);
  if (features.some((feature) => ["hooks", "crds", "webhooks"].includes(feature))) return true;
  const text = `${row.hard_gap} ${row.next_action} ${row.active_proof_reason}`.toLowerCase();
  return ["admission", "apiservice", "crd", "hook", "lifecycle", "webhook"].some((term) => text.includes(term));
}

function baseLayerForVariant(variant) {
  if (variant === "default") return { layer: "F2a", label: "F2a honest default base" };
  if (variant.includes("parameterized")) return { layer: "F2c", label: "F2c parameterized base" };
  return { layer: "F2b", label: "F2b rendered standard fork" };
}

function preferredBaseByChartVersion(baseRows) {
  const grouped = groupBy(baseRows, (row) => `${row.chart}|${row.version}`);
  const preferred = new Map();
  for (const [key, rows] of grouped.entries()) {
    preferred.set(key, rows.find((row) => row.variant === "default") ?? rows[0]);
  }
  return preferred;
}

function sourceMatrixRow(base) {
  return {
    ...base,
    row_kind: "source",
    catalog_layer: "F1",
    customization_layer: "F1 upstream chart source",
    row_status: "real",
    custom_discussion: "no",
    parent_base: "",
    downstream_space: "",
    target_run_status: "",
    target_run_receipt: "",
    target_run_blockers: "",
    variant: "(source)",
    adoption_bucket: "source-chart",
    strongest_evidence: "source-lock",
    next_action: "choose or create an F2 base before rendering or deploying",
    hook_live_status: base.hook_count && base.hook_count !== "0" ? base.hook_live_status : "n/a",
    lifecycle_route_contract: "n/a",
    lifecycle_route_count: "",
    lifecycle_route_dispositions: "",
    lifecycle_route_execution_modes: "",
    lifecycle_route_safe_automatic: "",
    lifecycle_route_evidence_version: "",
    lifecycle_route_contract_path: "",
    lifecycle_route_json_path: "",
    render_intent_state: "n/a",
    render_intent_next_action: "",
    render_intent_path: "",
    render_intent_lifecycle_state: "n/a",
    render_intent_lifecycle_reason: "",
    render_intent_lifecycle_next_action: "",
    render_intent_target_state: "n/a",
    render_intent_target_reason: "",
    render_intent_target_next_action: "",
    render_intent_target_requirement_count: "",
    render_intent_target_action_count: "",
    lane_render_parity: "n/a",
    lane_confighub_scan_ops: "n/a",
    lane_local_kind: "n/a",
    lane_lifecycle_observed: "n/a",
    lane_gitops_oci_live: "n/a",
    lane_live_dual_parity: "n/a",
    lane_two_cluster_kind: "n/a",
    core_lanes_complete: "n/a",
    outcome_level: "source-lock",
    production_decision: "n/a",
    production_target_scope: "",
    variant_promotion: "n/a",
    variant_promotion_status: "not-applicable-source",
    variant_promotion_evidence: "",
    variant_promotion_reason: "source rows are upstream chart inputs, not server-side promotion evidence",
    variant_promotion_next_action: "choose or create an F2 base before server-side variant promotion applies",
    active_proof_next_step: "",
    active_proof_readiness: "",
    active_proof_reason: "",
    active_proof_command: "",
    active_proof_support_artifact: "",
    recipe_catalog_path: base.recipe_catalog_path,
    variant_path: "",
    package_base_path: "",
    variant_revision_path: "",
    completion_action: "-",
    completion_action_summary: "",
    completion_action_families: "",
    completion_deferred_cells: "0",
    completion_owner_lanes: "",
  };
}

function loadCandidateRows(baseIndex, baseByChartVersion) {
  const rows = [
    ...loadWave2CandidateRows(baseIndex, baseByChartVersion),
    ...loadUsefulBaseCandidateRows(baseIndex, baseByChartVersion),
    ...loadTargetPrerequisiteCandidateRows(baseIndex),
  ];
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.chart}|${row.version}|${row.catalog_layer}|${row.parent_base}|${row.variant}|${row.candidate_source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function loadWave2CandidateRows(baseIndex, baseByChartVersion) {
  const doc = readYaml(join(repoRoot, SOURCES.wave2VariantWorkOrders));
  const rows = [];
  for (const workOrder of doc.spec?.workOrders ?? []) {
    const chart = chartFromPackagePath(workOrder.packagePath) ?? workOrder.chart;
    const version = versionFromPackagePath(workOrder.packagePath) ?? workOrder.version;
    const base = baseByChartVersion.get(`${chart}|${version}`);
    check(base, `wave-2 candidate ${workOrder.chart}@${workOrder.version} (${chart}@${version}) has no matrix base row`);
    for (const variant of workOrder.variants ?? []) {
      if (baseIndex.has(`${chart}|${version}|${variant.name}`)) continue;
      rows.push(candidateMatrixRow(base, {
        layer: "F2c",
        label: "F2c candidate base/fork",
        variant: variant.name,
        source: SOURCES.wave2VariantWorkOrders,
        state: workOrder.state ?? "candidate",
        parentBase: base.variant,
        inputs: joinText([...(variant.values ?? []), ...(variant.facts ?? [])]),
        requiredBefore: joinText(workOrder.requiredBeforeCatalogSupport ?? []),
        nextAction: joinText([variant.intent, ...(variant.blockers ?? [])]) || "render this candidate as a real base, then add receipts",
        customDiscussion: (variant.blockers ?? []).length > 0 || (variant.facts ?? []).length > 0,
        completionAction: "model",
      }));
    }
  }
  return rows;
}

function chartFromPackagePath(path) {
  const parts = String(path || "").split("/");
  if (parts[0] !== "packages" || parts.length < 4) return "";
  return `${parts[1]}/${parts[2]}`;
}

function versionFromPackagePath(path) {
  const parts = String(path || "").split("/");
  if (parts[0] !== "packages" || parts.length < 4) return "";
  return parts[3];
}

function loadUsefulBaseCandidateRows(baseIndex, baseByChartVersion) {
  return readCsv(SOURCES.usefulBaseWave2)
    .filter((row) => !baseIndex.has(`${row.chart}|${row.version}|${row.proposed_base}`))
    .map((row) => {
      const base = baseByChartVersion.get(`${row.chart}|${row.version}`);
      check(base, `useful-base candidate ${row.chart}@${row.version} has no matrix base row`);
      return candidateMatrixRow(base, {
        layer: "F2c",
        label: "F2c candidate useful base",
        variant: row.proposed_base,
        source: SOURCES.usefulBaseWave2,
        state: "not-yet-rendered",
        parentBase: base.variant,
        inputs: joinText([row.render_time_knobs, row.target_inputs]),
        requiredBefore: row.required_receipts,
        nextAction: row.first_action,
        customDiscussion: true,
        completionAction: "model",
      });
    });
}

function loadTargetPrerequisiteCandidateRows(baseIndex) {
  const groups = groupBy(readCsv(SOURCES.targetPrereqActions), (row) =>
    `${row.chart}|${row.version}|${row.base}|${row.prerequisite_kind}|${row.prerequisite_name}|${row.action_kind}|${row.owner_class}`,
  );
  return [...groups.values()].map((group) => {
    const first = group[0];
    const base = baseIndex.get(`${first.chart}|${first.version}|${first.base}`);
    check(base, `target-prerequisite candidate ${first.chart}@${first.version}/${first.base} has no matrix base row`);
    const lanes = [...new Set(group.map((row) => row.lane))].sort().join("+");
    const customDiscussion = first.owner_class === "operator-review" || first.prerequisite_kind === "unknown" || first.action_kind === "operator-review";
    const prerequisite = first.prerequisite_kind === "unknown" ? "review" : first.prerequisite_kind;
    return candidateMatrixRow(base, {
      layer: "F3",
      label: "F3 target prerequisite/fill",
      variant: `${first.base} + ${prerequisite}`,
      source: SOURCES.targetPrereqActions,
      state: `${lanes} ${first.current_result ?? "candidate"}`.trim(),
      parentBase: first.base,
      inputs: first.required_inputs,
      requiredBefore: first.evidence_required,
      nextAction: `${first.action_kind}: ${first.prerequisite_name}; ${first.rerun_command}`,
      customDiscussion,
      completionAction: customDiscussion ? "scope" : "stage",
      supportArtifact: first.support_artifact,
      sourceReceipt: first.source_receipt,
    });
  });
}

function candidateMatrixRow(base, options) {
  const customDiscussion = options.customDiscussion ? "yes" : "no";
  return {
    ...base,
    row_kind: "candidate",
    catalog_layer: options.layer,
    customization_layer: options.label,
    row_status: customDiscussion === "yes" ? "candidate-custom-discussion" : "candidate",
    custom_discussion: customDiscussion,
    candidate_source: options.source,
    candidate_state: options.state ?? "candidate",
    candidate_inputs: options.inputs ?? "",
    candidate_required_before: options.requiredBefore ?? "",
    parent_base: options.parentBase ?? base.variant,
    downstream_space: "",
    target_run_status: "not-applicable",
    target_run_receipt: options.sourceReceipt ?? options.supportArtifact ?? "",
    target_run_blockers: options.inputs ?? "",
    variant: options.variant,
    catalog_tier: "candidate",
    adoption_bucket: customDiscussion === "yes" ? "candidate-custom-discussion" : "candidate-row",
    hard_gap: options.inputs ?? "",
    strongest_evidence: "candidate-plan",
    next_action: options.nextAction ?? "turn this candidate into a receipt-backed row before treating it as runnable",
    hook_count: "",
    hook_disposition: "",
    hook_evidence_version: "",
    hook_live_status: "n/a",
    lifecycle_route_contract: "n/a",
    lifecycle_route_count: "",
    lifecycle_route_dispositions: "",
    lifecycle_route_execution_modes: "",
    lifecycle_route_safe_automatic: "",
    lifecycle_route_evidence_version: "",
    lifecycle_route_contract_path: "",
    lifecycle_route_json_path: "",
    render_intent_state: "n/a",
    render_intent_next_action: "",
    render_intent_path: "",
    render_intent_lifecycle_state: "n/a",
    render_intent_lifecycle_reason: "",
    render_intent_lifecycle_next_action: "",
    render_intent_target_state: "n/a",
    render_intent_target_reason: "",
    render_intent_target_next_action: "",
    render_intent_target_requirement_count: "",
    render_intent_target_action_count: "",
    lane_render_parity: "n/a",
    lane_confighub_scan_ops: "n/a",
    lane_local_kind: "n/a",
    lane_lifecycle_observed: "n/a",
    lane_gitops_oci_live: "n/a",
    lane_live_dual_parity: "n/a",
    lane_two_cluster_kind: "n/a",
    core_lanes_complete: "n/a",
    outcome_level: "candidate-plan",
    production_decision: "n/a",
    production_target_scope: "",
    variant_promotion: "n/a",
    variant_promotion_status: "not-applicable-candidate",
    variant_promotion_evidence: "",
    variant_promotion_reason: "candidate rows are planning rows, not server-side promotion evidence",
    variant_promotion_next_action: "turn this candidate into a real base or derived variant before server-side promotion applies",
    active_proof_next_step: "",
    active_proof_readiness: "",
    active_proof_reason: "",
    active_proof_command: "",
    active_proof_support_artifact: options.supportArtifact ?? options.sourceReceipt ?? options.source,
    recipe_catalog_path: base.recipe_catalog_path,
    variant_path: "",
    package_base_path: "",
    variant_revision_path: "",
    completion_action: options.completionAction ?? "model",
    completion_action_summary: `${options.completionAction ?? "model"}:1`,
    completion_action_families: "candidate-row",
    completion_deferred_cells: "0",
    completion_owner_lanes: customDiscussion === "yes" ? "product-review:1" : "Codex-live:1",
  };
}

function joinText(values) {
  return values.filter(Boolean).join("; ");
}

function loadDerivedExecutionRows() {
  const root = join(repoRoot, SOURCES.derivedExecutionRoot);
  if (!existsSync(root)) return [];
  return listFiles(root)
    .filter((file) => file.endsWith("/variant-create-receipt.yaml"))
    .map((path) => {
      const receipt = readYaml(path);
      const spec = receipt.spec ?? {};
      return {
        receipt: relativeRepo(path),
        chart: spec.source?.chart ?? "",
        version: spec.source?.chartVersion ?? "",
        base: spec.source?.base ?? "",
        variant: spec.create?.variant ?? "",
        component: spec.source?.component ?? "",
        downstream_space: spec.create?.downstreamSpace ?? "",
        environment: spec.create?.environment ?? "",
        region: spec.create?.region ?? "",
        target: spec.target?.desired ?? "",
        result: spec.result ?? "",
        create_result: spec.create?.result ?? "",
        unit_count: String(spec.clone?.unitCount ?? ""),
        upstream_linked_unit_count: String(spec.clone?.upstreamLinkedUnitCount ?? ""),
        same_data_hash_set: String(spec.clone?.sameDataHashSetAsSource ?? ""),
        live_apply_result: spec.liveApply?.result ?? "",
        live_apply_reason: spec.liveApply?.reason ?? "",
      };
    })
    .sort((left, right) => `${left.chart}|${left.version}|${left.base}|${left.variant}`.localeCompare(`${right.chart}|${right.version}|${right.base}|${right.variant}`));
}

function mergeDerivedRows(executionRows, targetBoundRows) {
  const rows = [...executionRows];
  const seen = new Set(executionRows.map((row) => `${row.chart}|${row.version}|${row.base}|${row.variant}`));
  for (const targetRow of targetBoundRows) {
    const key = `${targetRow.chart}|${targetRow.version}|${targetRow.base}|${targetRow.variant}`;
    if (seen.has(key)) continue;
    rows.push({
      receipt: targetRow.receipt,
      chart: targetRow.chart,
      version: targetRow.version,
      base: targetRow.base,
      variant: targetRow.variant,
      component: "",
      downstream_space: targetRow.downstream_space,
      environment: "",
      region: "",
      target: targetRow.target,
      result: targetRow.result,
      create_result: "not-recorded",
      unit_count: "",
      upstream_linked_unit_count: "",
      same_data_hash_set: "",
      live_apply_result: targetRow.runtime,
      live_apply_reason: targetRow.route_forward,
    });
  }
  return rows.sort((left, right) => `${left.chart}|${left.version}|${left.base}|${left.variant}`.localeCompare(`${right.chart}|${right.version}|${right.base}|${right.variant}`));
}

function derivedMatrixRow(receiptRow, baseIndex, targetBoundIndex) {
  const base = baseIndex.get(`${receiptRow.chart}|${receiptRow.version}|${receiptRow.base}`);
  check(base, `derived variant ${receiptRow.chart}@${receiptRow.version}/${receiptRow.variant} has no source base row ${receiptRow.base}`);
  const targetBound = targetBoundIndex.get(`${receiptRow.chart}|${receiptRow.version}|${receiptRow.base}|${receiptRow.variant}`);
  const targetResult = targetBound?.result ?? "not-attempted";
  const targetStatus = targetResult === "pass" ? "yes" : targetResult === "blocked" ? "no" : targetResult === "watch" ? "watch" : "todo";
  const blockers = targetBound?.blocker_ids ?? "";
  const routeForward = targetBound?.route_forward ?? "";
  const target = targetBound?.target || receiptRow.target || "";
  const nextAction =
    targetResult === "pass"
      ? "keep the target-bound derived variant receipt fresh when the source base or target changes"
      : targetResult === "blocked"
        ? routeForward || "resolve the target-bound derived variant blockers, then rerun the target-bound receipt"
        : "bind the derived ConfigHub variant to a target and run the target-bound derived variant lane";
  return {
    ...base,
    row_kind: "derived",
    catalog_layer: targetResult === "not-attempted" ? "F4a" : "F4b",
    customization_layer: targetResult === "not-attempted" ? "F4a derived ConfigHub clone" : "F4b target-bound derived variant",
    row_status: targetStatus === "yes" ? "real" : "real-needs-work",
    custom_discussion: targetStatus === "no" ? "yes" : "no",
    candidate_source: "",
    candidate_state: "",
    candidate_inputs: "",
    candidate_required_before: "",
    parent_base: receiptRow.base,
    downstream_space: receiptRow.downstream_space,
    target_run_status: targetResult,
    target_run_receipt: targetBound?.receipt || receiptRow.receipt,
    target_run_blockers: blockers,
    variant: receiptRow.variant,
    catalog_tier: "derived-variant",
    adoption_bucket: "derived-target-variant",
    hard_gap: blockers,
    strongest_evidence: targetResult === "pass" ? "target-bound-derived-variant" : "derived-variant-clone",
    next_action: nextAction,
    hook_count: base.hook_count,
    hook_disposition: base.hook_disposition,
    hook_evidence_version: base.hook_evidence_version,
    hook_live_status: base.hook_live_status,
    lifecycle_route_contract: "n/a",
    lifecycle_route_count: "",
    lifecycle_route_dispositions: "",
    lifecycle_route_execution_modes: "",
    lifecycle_route_safe_automatic: "",
    lifecycle_route_evidence_version: "",
    lifecycle_route_contract_path: "",
    lifecycle_route_json_path: "",
    render_intent_state: "n/a",
    render_intent_next_action: "",
    render_intent_path: "",
    render_intent_lifecycle_state: "n/a",
    render_intent_lifecycle_reason: "",
    render_intent_lifecycle_next_action: "",
    render_intent_target_state: "n/a",
    render_intent_target_reason: "",
    render_intent_target_next_action: "",
    render_intent_target_requirement_count: "",
    render_intent_target_action_count: "",
    lane_render_parity: "n/a",
    lane_confighub_scan_ops: receiptRow.result === "pass" ? "yes" : "no",
    lane_local_kind: "n/a",
    lane_lifecycle_observed: "n/a",
    lane_gitops_oci_live: targetStatus,
    lane_live_dual_parity: "n/a",
    lane_two_cluster_kind: "n/a",
    core_lanes_complete: targetStatus === "yes" ? "yes" : "no",
    outcome_level: targetStatus === "yes" ? "target-bound-derived" : "derived-intended-state",
    production_decision: targetStatus,
    production_target_scope: target,
    variant_promotion: "n/a",
    variant_promotion_status: "not-applicable-derived-variant",
    variant_promotion_evidence: receiptRow.receipt,
    variant_promotion_reason: "derived ConfigHub variant creation is not the base-variant promotion lane",
    variant_promotion_next_action: "use the derived variant receipts and target-bound lane for this downstream variant",
    active_proof_next_step: targetStatus === "yes" ? "" : "target-bound-derived-variant",
    active_proof_readiness: targetStatus === "todo" ? "needs-target-binding" : targetStatus === "no" ? "blocked" : "",
    active_proof_reason: blockers || receiptRow.live_apply_reason,
    active_proof_command: "",
    active_proof_support_artifact: targetBound?.receipt || receiptRow.receipt,
    completion_action: targetStatus === "yes" ? "-" : targetStatus === "no" ? "stage" : "run",
    completion_action_summary: targetStatus === "yes" ? "" : targetStatus === "no" ? "stage:1" : "run:1",
    completion_action_families: "derived-variant-target-bound",
    completion_deferred_cells: "0",
    completion_owner_lanes: targetStatus === "yes" ? "" : "Codex-live:1",
  };
}

function compareMatrixRows(a, b) {
  const chart = a.chart.localeCompare(b.chart) || a.version.localeCompare(b.version, undefined, { numeric: true });
  if (chart !== 0) return chart;
  const layer = layerOrder(a.catalog_layer) - layerOrder(b.catalog_layer);
  if (layer !== 0) return layer;
  const kind = rowKindOrder(a.row_kind) - rowKindOrder(b.row_kind);
  if (kind !== 0) return kind;
  const parent = (a.parent_base || a.variant).localeCompare(b.parent_base || b.variant);
  if (parent !== 0) return parent;
  if (a.variant === "default") return -1;
  if (b.variant === "default") return 1;
  return a.variant.localeCompare(b.variant);
}

function layerOrder(layer) {
  return {
    F1: 10,
    F2a: 20,
    F2b: 30,
    F2c: 40,
    F3: 50,
    F4a: 60,
    F4b: 70,
  }[layer] ?? 99;
}

function rowKindOrder(kind) {
  return {
    source: 10,
    base: 20,
    candidate: 30,
    derived: 40,
  }[kind] ?? 99;
}

function summary(rows, charts, unmatchedReadiness) {
  const laneCells = rows.flatMap((row) => [...LANE_COLUMNS.map(([target]) => row[target]), row.lane_two_cluster_kind]).filter(Boolean);
  const sourceRowCount = rows.filter((row) => row.row_kind === "source").length;
  const baseRowCount = rows.filter((row) => row.row_kind === "base").length;
  const candidateRowCount = rows.filter((row) => row.row_kind === "candidate").length;
  const derivedRowCount = rows.filter((row) => row.row_kind === "derived").length;
  const layerCounts = summarizeLayerCounts(rows);
  const counts = {
    yes: laneCells.filter((value) => value === "yes").length,
    watch: laneCells.filter((value) => value === "watch").length,
    no: laneCells.filter((value) => value === "no").length,
    todo: laneCells.filter((value) => value === "todo").length,
    na: laneCells.filter((value) => value === "n/a").length,
  };
  const complete = rows.filter((row) => row.core_lanes_complete === "yes").length;
  const targetRunYes = rows.filter((row) => row.production_decision === "yes").length;
  const superseded = rows.filter((row) => row.production_decision === "superseded").length;
  const targetRunBlocked = rows.filter((row) => row.production_decision === "no").length;
  const promotionProven = rows.filter((row) => row.variant_promotion === "yes").length;
  const promotionWatch = rows.filter((row) => row.variant_promotion === "watch").length;
  const promotionTodo = rows.filter((row) => row.variant_promotion === "todo").length;
  const promotionBlocked = rows.filter((row) => row.variant_promotion === "no").length;
  const promotionNa = rows.filter((row) => row.variant_promotion === "n/a").length;
  const routeContractYes = rows.filter((row) => row.lifecycle_route_contract === "yes").length;
  const routeContractWatch = rows.filter((row) => row.lifecycle_route_contract === "watch").length;
  const routeContractTodo = rows.filter((row) => row.lifecycle_route_contract === "todo").length;
  const routeContractNa = rows.filter((row) => row.lifecycle_route_contract === "n/a").length;
  const unrouted = rows.filter((row) => row.hook_disposition === "unrouted").length;
  const activeProofRows = rows.filter((row) => row.active_proof_next_step);
  const deferredCells = rows.reduce((sum, row) => sum + Number(row.completion_deferred_cells || 0), 0);
  const queues = productQueues(rows);
  const intentCoverage = renderIntentCoverageCounts(rows);

  let lastChart = "";
  const table = rows
    .map((row) => {
      const chartAtVersion = `${row.chart}@${row.version}`;
      const chartCell = chartAtVersion === lastChart ? "" : `\`${chartAtVersion}\``;
      lastChart = chartAtVersion;
      const hooks =
        row.hook_disposition === "unrouted"
          ? "unrouted ⚠️"
          : row.hook_count === ""
            ? "-"
            : row.hook_count === "0"
              ? "0 -"
              : `${row.hook_count} ${row.hook_disposition} ${icon(row.hook_live_status)}${row.hook_evidence_version ? ` (from @${row.hook_evidence_version})` : ""}`;
      const route = row.lifecycle_route_contract === "n/a" ? "-" : icon(row.lifecycle_route_contract);
      const quirks = row.quirk_features ? `\`${row.quirk_features}\`` : "-";
      return `| ${chartCell} | ${row.catalog_layer} | ${rowKindLabel(row)} | ${row.variant} | ${tierShort(row.catalog_tier)} | ${quirks} | ${hooks} | ${route} | ${icon(row.lane_render_parity)} | ${icon(row.lane_confighub_scan_ops)} | ${icon(row.lane_local_kind)} | ${icon(row.lane_lifecycle_observed)} | ${icon(row.lane_gitops_oci_live)} | ${icon(row.lane_live_dual_parity)} | ${icon(row.lane_two_cluster_kind)} | ${icon(row.variant_promotion)} | ${row.completion_action || "-"} | ${row.outcome_level || "-"} | ${icon(row.production_decision)} |`;
    })
    .join("\n");

  const provenance = COLUMN_PROVENANCE.map((entry) => `| [${entry.source}](../${entry.source}) | ${entry.carried} | ${entry.dropped} |`).join("\n");

  return `# Master Catalog Matrix

ONE view of the whole catalog: one row per chart/version/catalog layer,
including upstream sources, real installer bases, candidate paths, and
downstream ConfigHub-derived variants. The translation attributes and per-lane
status are joined from the committed sources below. This file invents no new
truth - every cell comes from a source the verifier checks this view against.

Three renderings of the same rows: this summary (GitHub),
[matrix.csv](matrix.csv) for spreadsheet import (CSV carries words, not
colors), and [matrix.html](matrix.html) - open it in a browser for the
literal red/green/grey colored cells.

## Legend

| Icon | Meaning |
| --- | --- |
| ✅ | yes / pass |
| ⚠️ | watch - passing with a recorded caution |
| ❌ | no / blocked |
| ⬜ | not yet run - absence of evidence, not a failure |
| - | not applicable - this lane does not apply to this row |

Deferred accepted means the cell already has an honest disposition, usually
watch or not applicable. It stays visible, but it is not where live-run time
should be spent until the product scope changes.

Lane columns: **R** render parity (helm template vs installer setup) ·
**C** ConfigHub upload + scan + safe ops · **L** local kind apply ·
**Y** explicit lifecycle observation ·
**G** ConfigHub OCI + Argo live · **P** live Helm-vs-ConfigHub dual parity ·
**K** two-cluster kind parity · **V** server-side ConfigHub variant promotion.
Hooks column: source hook count, disposition route, live-rehearsal status.
**Route** is the generated lifecycle route/off-ramp contract: ✅ all route rows
observed, ⚠️ route/executor named with cautions, ⬜ route work still todo, -
no route row applies.
\`unrouted ⚠️\` marks a chart whose source scan flags hooks but that has no
hook-disposition row yet; \`(from @x.y.z)\` marks chart-family evidence taken
from a different chart version's disposition row.

## Current Status

| Metric | Value |
| --- | ---: |
| Chart versions | ${charts} |
| Matrix rows | ${rows.length} |
| F1 source / F2 base / candidate / F4 derived rows | ${sourceRowCount} / ${baseRowCount} / ${candidateRowCount} / ${derivedRowCount} |
| Layer rows | ${layerCounts} |
| Lane cells ✅ / ⚠️ / ❌ / ⬜ / - | ${counts.yes} / ${counts.watch} / ${counts.no} / ${counts.todo} / ${counts.na} |
| Base/derived rows with the complete core lane set | ${complete} |
| Rows with a target run decision | ${targetRunYes + superseded + targetRunBlocked} |
| Target run decisions (runs / superseded / blocked-or-rejected) | ${targetRunYes} / ${superseded} / ${targetRunBlocked} |
| Server-side variant promotion (proven / watch / todo / blocked / n/a) | ${promotionProven} / ${promotionWatch} / ${promotionTodo} / ${promotionBlocked} / ${promotionNa} |
| Lifecycle route contracts (observed / watch / todo / n/a) | ${routeContractYes} / ${routeContractWatch} / ${routeContractTodo} / ${routeContractNa} |
| Render-intent lifecycle records (attached / gap / no separate route) | ${intentCoverage.lifecycleAttached} / ${intentCoverage.lifecycleGap} / ${intentCoverage.lifecycleNone} |
| Render-intent prerequisite records (attached / gap / none explicitly required) | ${intentCoverage.targetAttached} / ${intentCoverage.targetGap} / ${intentCoverage.targetNone} |
| Hook-flagged variants with no disposition row (unrouted) | ${unrouted} |
| Rows currently in the active proof queue | ${activeProofRows.length} |
| Cells with deferred accepted disposition | ${deferredCells} |

${unmatchedReadiness.length ? `Chart versions in the lane matrix but not in top-100 readiness (retained candidates or version drift): ${unmatchedReadiness.map((chart) => `\`${chart}\``).join(", ")}.\n` : ""}
## How To Use This Sheet

Each row is one chart/version layer: F1 source chart, F2 base variant, F3
target-prerequisite/fill candidate, or F4 downstream ConfigHub-derived variant.
Use the row to answer three questions before deciding what to do next:

| Question | Column to check |
| --- | --- |
| Can I try this now, promote it, or does it need more design? | Use / adoption bucket |
| What is the strongest evidence currently available? | Evidence, R/C/L/G/P/K, Core |
| What prevents a stronger target-run claim? | Target, Scope, Gap, Next action |
| Where am I in the customization flow? | Layer, Kind |
| Can downstream ConfigHub variants be promoted from this base? | V, Promotion status |
| If a hook or lifecycle behavior exists, where does it go? | Route, Hooks, lifecycle route contract |
| Has this exact base recorded its lifecycle work and target prerequisites? | Render-intent lifecycle and target states in the CSV/HTML view |
| Which non-pass live row should be rerun or reviewed now? | Active proof |
| Is this row active work, an external dependency, or deferred for now? | Action |

The HTML view carries these user/product columns directly:
[matrix.html](matrix.html). The CSV carries the same fields for filtering:
[matrix.csv](matrix.csv). Counts below are matrix rows unless stated
otherwise.

## Current Product Queues

| Queue | Rows | Meaning | Examples |
| --- | ---: | --- | --- |
${queues.map((queue) => `| ${queue.label} | ${queue.rows.length} | ${queue.meaning} | ${examples(queue.rows)} |`).join("\n")}

## Sources joined, and what this view compresses

The matrix is the variant-granularity overview, not a replacement for its
sources. Per source: what is carried here, and what deliberately stays
behind (follow the source link when you need it). Chart-granularity,
value-path-granularity, and claim-granularity views (status dashboard,
blast-radius accuracy, claims register) are different granularities, not
duplicates of this one.

| Source of truth | Carried into the matrix | Stays in the source |
| --- | --- | --- |
${provenance}

The CSV and HTML carry adoption bucket, hard gap, strongest evidence, next
action, target run scope, and active proof queue details. The Markdown
table below stays compact for GitHub readability; open [matrix.html](matrix.html)
when you want the user/product view with those columns visible.

## Matrix

| Chart | Layer | Kind | Variant | Tier | Quirks | Hooks | Route | R | C | L | Y | G | P | K | V | Action | Outcome | Target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${table}

## Regenerate

~~~sh
npm run master-matrix
npm run master-matrix:verify
~~~
`;
}

function htmlReport(rows, charts, unmatchedReadiness, generatedAt) {
  const laneCells = rows.flatMap((row) => [...LANE_COLUMNS.map(([target]) => row[target]), row.lane_two_cluster_kind]).filter(Boolean);
  const sourceRowCount = rows.filter((row) => row.row_kind === "source").length;
  const baseRowCount = rows.filter((row) => row.row_kind === "base").length;
  const candidateRowCount = rows.filter((row) => row.row_kind === "candidate").length;
  const derivedRowCount = rows.filter((row) => row.row_kind === "derived").length;
  const layerCounts = summarizeLayerCounts(rows);
  const counts = {
    yes: laneCells.filter((value) => value === "yes").length,
    watch: laneCells.filter((value) => value === "watch").length,
    no: laneCells.filter((value) => value === "no").length,
    todo: laneCells.filter((value) => value === "todo").length,
    na: laneCells.filter((value) => value === "n/a").length,
  };
  const targetRunYes = rows.filter((row) => row.production_decision === "yes").length;
  const superseded = rows.filter((row) => row.production_decision === "superseded").length;
  const targetRunBlocked = rows.filter((row) => row.production_decision === "no").length;
  const promotionProven = rows.filter((row) => row.variant_promotion === "yes").length;
  const promotionWatch = rows.filter((row) => row.variant_promotion === "watch").length;
  const promotionTodo = rows.filter((row) => row.variant_promotion === "todo").length;
  const promotionBlocked = rows.filter((row) => row.variant_promotion === "no").length;
  const promotionNa = rows.filter((row) => row.variant_promotion === "n/a").length;
  const routeContractYes = rows.filter((row) => row.lifecycle_route_contract === "yes").length;
  const routeContractWatch = rows.filter((row) => row.lifecycle_route_contract === "watch").length;
  const routeContractTodo = rows.filter((row) => row.lifecycle_route_contract === "todo").length;
  const routeContractNa = rows.filter((row) => row.lifecycle_route_contract === "n/a").length;
  const unrouted = rows.filter((row) => row.hook_disposition === "unrouted").length;
  const activeProofRows = rows.filter((row) => row.active_proof_next_step);
  const deferredCells = rows.reduce((sum, row) => sum + Number(row.completion_deferred_cells || 0), 0);
  const queues = productQueues(rows);
  const intentCoverage = renderIntentCoverageCounts(rows);

  const statusCell = (value, title, label) => {
    const cls = value === "yes" ? "y" : value === "watch" ? "w" : value === "no" ? "n" : value === "todo" ? "t" : "na";
    const symbol = label ?? (value === "yes" ? "✓" : value === "watch" ? "!" : value === "no" ? "✗" : value === "todo" ? "·" : "–");
    return `<td class="s ${cls}"${title ? ` title="${escapeHtml(title)}"` : ""}>${symbol}</td>`;
  };
  const contractCell = (state, reason, nextAction) => {
    const value = ["attached", "attached-with-observed-actions"].includes(state)
      ? "yes"
      : state === "actionable-gap"
        ? "todo"
        : "n/a";
    const title = [reason, nextAction ? `Next: ${nextAction}` : ""].filter(Boolean).join(" ");
    return statusCell(value, title);
  };

  let lastChart = "";
  const bodyRows = rows
    .map((row) => {
      const chartAtVersion = `${row.chart}@${row.version}`;
      const first = chartAtVersion !== lastChart;
      lastChart = chartAtVersion;
      const hooks =
        row.hook_disposition === "unrouted"
          ? `<td class="s w" title="source scan flags hooks; no hook-disposition row yet">U</td>`
          : row.hook_count === ""
            ? `<td class="s na">–</td>`
            : row.hook_count === "0"
              ? `<td class="s na" title="no source hooks">0</td>`
              : statusCell(row.hook_live_status, `${row.hook_count} hook(s), disposition: ${row.hook_disposition}${row.hook_evidence_version ? ` - evidence from @${row.hook_evidence_version} (chart-family, not this version)` : ""}`, row.hook_count);
      const routeText = lifecycleRouteSummary(row);
      const routeCell = statusCell(row.lifecycle_route_contract, routeText.title, routeText.label);
      const renderIntentLifecycleCell = contractCell(
        row.render_intent_lifecycle_state,
        row.render_intent_lifecycle_reason,
        row.render_intent_lifecycle_next_action,
      );
      const renderIntentTargetCell = contractCell(
        row.render_intent_target_state,
        row.render_intent_target_reason,
        row.render_intent_target_next_action,
      );
      const nextAction = row.next_action ? `<td class="note" title="${escapeHtml(row.next_action)}">${escapeHtml(row.next_action.length > 70 ? `${row.next_action.slice(0, 67)}...` : row.next_action)}</td>` : `<td class="note"></td>`;
      const hardGap = row.hard_gap || "not applicable";
      const scope = row.production_target_scope || "not applicable";
      const activeProofText = activeProofSummary(row);
      const completionText = completionActionSummary(row);
      const promotionText = variantPromotionSummary(row);
      const links = [
        ["source", row.source_repository_url || row.source_content_url],
        ["catalog", row.recipe_catalog_path],
        ["variant", row.variant_path],
        ["package", row.package_base_path],
        ["revision", row.variant_revision_path],
        ["routes", row.lifecycle_route_contract_path],
        ["intent", row.render_intent_path],
      ].filter(([, path]) => path).map(([label, path]) => linkFor(label, path, row)).join(" · ");
      return `<tr class="${rowClass(row)}${first ? " grp" : ""}"><td class="chart">${first ? escapeHtml(chartAtVersion) : ""}</td><td class="layer" title="${escapeHtml(row.customization_layer)}">${escapeHtml(row.catalog_layer)}</td><td class="note kind" title="${escapeHtml(rowStatusTitle(row))}">${escapeHtml(rowKindLabel(row))}</td><td>${escapeHtml(row.variant)}</td><td class="links">${links}<br><a href="${escapeHtml(row.github_recipe_url)}">GitHub folder</a></td><td>${escapeHtml(tierShort(row.catalog_tier))}</td><td class="note route" title="${escapeHtml(row.adoption_bucket)}">${escapeHtml(useShort(row.adoption_bucket))}</td><td class="note evidence" title="${escapeHtml(row.strongest_evidence)}">${escapeHtml(evidenceShort(row.strongest_evidence))}</td>${statusCell(row.core_lanes_complete, row.core_lanes_complete === "yes" ? "complete core lane set" : "one or more core lanes still missing")}<td class="note" title="${escapeHtml(row.quirk_features)}">${escapeHtml(row.quirk_features || "–")}</td>${hooks}${routeCell}${renderIntentLifecycleCell}${renderIntentTargetCell}${statusCell(row.lane_render_parity)}${statusCell(row.lane_confighub_scan_ops)}${statusCell(row.lane_local_kind)}${statusCell(row.lane_lifecycle_observed, row.lane_lifecycle_observed === "n/a" ? "no explicit lifecycle route expected for this base" : "")}${statusCell(row.lane_gitops_oci_live)}${statusCell(row.lane_live_dual_parity)}${statusCell(row.lane_two_cluster_kind)}${statusCell(row.variant_promotion, promotionText.title, promotionText.label)}<td class="note action" title="${escapeHtml(completionText.title)}">${escapeHtml(completionText.label)}</td><td>${escapeHtml(row.outcome_level || "–")}</td>${statusCell(row.production_decision, row.production_target_scope || "")}<td class="note scope" title="${escapeHtml(scope)}">${escapeHtml(row.production_target_scope ? compactText(row.production_target_scope, 54) : "–")}</td><td class="note gap" title="${escapeHtml(hardGap)}">${escapeHtml(row.hard_gap ? compactText(row.hard_gap, 58) : "–")}</td><td class="note active" title="${escapeHtml(activeProofText.title)}">${escapeHtml(activeProofText.label)}</td>${nextAction}</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Master Catalog Matrix</title>
<style>
body{font:13px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:24px;color:#202124}
h1{font-size:20px;margin:0 0 4px}
p.sub{color:#5f6368;margin:0 0 12px}
.chips span{display:inline-block;border-radius:4px;padding:2px 8px;margin-right:8px;font-size:12px}
table{border-collapse:collapse;margin-top:16px;width:100%}
th,td{border:1px solid #dadce0;padding:3px 7px;text-align:left;vertical-align:top}
thead th{position:sticky;top:0;background:#f1f3f4;z-index:1}
tr.grp td{border-top:2px solid #80868b}
td.chart{font-weight:600;white-space:nowrap}
td.s{text-align:center;font-weight:700;width:28px}
td.note{max-width:330px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#5f6368}
td.links{font-size:12px;white-space:nowrap;line-height:1.35}
a{color:#1558d6;text-decoration:none}
a:hover{text-decoration:underline}
td.route{max-width:120px;color:#202124}
td.evidence{max-width:130px;color:#202124}
td.layer{font-weight:700;text-align:center;white-space:nowrap}
td.kind{max-width:120px;color:#202124;font-weight:600}
td.scope{max-width:190px}
td.gap{max-width:220px;color:#7a4f00}
td.action{max-width:130px;color:#202124;font-weight:600}
.y{background:#1e8e3e;color:#fff}
.w{background:#f9ab00;color:#202124}
.n{background:#d93025;color:#fff}
.t{background:#e8eaed;color:#5f6368}
.na{background:#edf4ff;color:#476282}
tr.layer-f1 td{background:#f8fafd}
tr.candidate td{background:#fff8e6}
tr.custom-discussion td{background:#fff1e8}
</style>
</head>
<body>
<h1>Master Catalog Matrix</h1>
<p class="sub"><b>Generated at:</b> ${escapeHtml(generatedAt)} UTC · source: committed catalog, proof, live, and target-run data.</p>
<p class="sub">${charts} chart versions · ${rows.length} matrix rows (${sourceRowCount} F1 source / ${baseRowCount} F2 base / ${candidateRowCount} candidate / ${derivedRowCount} F4 derived) · layers ${escapeHtml(layerCounts)} · lane cells: ${counts.yes} pass / ${counts.watch} watch / ${counts.no} blocked / ${counts.todo} not yet run / ${counts.na} n/a · target run decisions: ${targetRunYes} runs / ${superseded} superseded / ${targetRunBlocked} blocked-or-rejected · variant promotion: ${promotionProven} proven / ${promotionWatch} watch / ${promotionTodo} todo / ${promotionBlocked} blocked / ${promotionNa} n/a · lifecycle records: ${intentCoverage.lifecycleAttached} attached / ${intentCoverage.lifecycleGap} gap / ${intentCoverage.lifecycleNone} no separate route · prerequisite records: ${intentCoverage.targetAttached} attached / ${intentCoverage.targetGap} gap / ${intentCoverage.targetNone} none explicitly required · ${activeProofRows.length} active proof queue row(s) · ${deferredCells} deferred accepted cell(s) · ${unrouted} hook-flagged variants unrouted (U). Generated from committed sources by scripts/generate-master-catalog-matrix.mjs; regenerate with <code>npm run master-matrix</code>.</p>
<p class="chips"><span class="y">✓ pass</span><span class="w">! watch</span><span class="n">✗ blocked/failed</span><span class="t">· not yet run</span><span class="na">– not applicable</span></p>
<p class="sub">This is the user/product database view: Layer marks the path from F1 source chart, through F2 bases and F3 target inputs, to F4 derived ConfigHub variants. Candidate and human-review rows are planning rows, not proof claims. Use says the current route, Evidence says the strongest proof available, Core says whether the main proof lanes are complete, Scope says where the row is known to run or why it is bounded, Gap names the main product or chart gap, Action shows whether remaining work is active, external, deferred, or target-scoped, and Active proof shows the exact current non-pass live row action when a row is in the rerun plan. Route record says whether hooks and setup work are attached for this exact base; Prerequisite record says whether Secrets, CRDs, namespaces, values, storage, external services, and target assumptions have been reviewed. Hover either cell for the reason and next action. The Links column includes the full render intent for every real base. Lanes: Route lifecycle route/off-ramp contract · R render parity · C ConfigHub upload+scan+ops or derived variant clone · L local kind apply · Y explicit lifecycle observation · G OCI+Argo live · P live Helm-vs-ConfigHub dual parity · K two-cluster kind parity · V server-side ConfigHub variant promotion. Hooks: U = source scan flags hooks but no disposition row yet; family evidence from another chart version is named in the tooltip.${unmatchedReadiness.length ? ` Not in top-100 readiness (candidates/version drift): ${unmatchedReadiness.map(escapeHtml).join(", ")}.` : ""}</p>
<table class="queues">
<thead><tr><th>Current product queue</th><th>Rows</th><th>Meaning</th><th>Examples</th></tr></thead>
<tbody>
${queues.map((queue) => `<tr><td>${escapeHtml(queue.label)}</td><td>${queue.rows.length}</td><td>${escapeHtml(queue.meaning)}</td><td class="note">${escapeHtml(examples(queue.rows, 4, false))}</td></tr>`).join("\n")}
</tbody>
</table>
<table>
<thead><tr><th>Chart</th><th>Layer</th><th>Kind</th><th>Variant</th><th>Links</th><th>Tier</th><th>Use</th><th>Evidence</th><th>Core</th><th>Quirks</th><th>Hooks</th><th>Route</th><th>Route record</th><th>Prerequisite record</th><th>R</th><th>C</th><th>L</th><th>Y</th><th>G</th><th>P</th><th>K</th><th>V</th><th>Action</th><th>Outcome</th><th>Target</th><th>Scope</th><th>Gap</th><th>Active proof</th><th>Next action</th></tr></thead>
<tbody>
${bodyRows}
</tbody>
</table>
</body>
</html>
`;
}

function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function tierShort(tier) {
  if (tier === "top20-catalog-supported") return "top20";
  if (tier === "next80-proof-grade") return "next80";
  if (tier === "derived-variant") return "derived";
  if (tier === "candidate") return "candidate";
  return tier || "-";
}

function useShort(bucket) {
  if (bucket === "source-chart") return "source";
  if (bucket === "try-from-public-catalog") return "try";
  if (bucket === "promote-after-review") return "review";
  if (bucket === "needs-useful-variant") return "needs variant";
  if (bucket === "limitation-decision-first") return "limit first";
  if (bucket === "derived-target-variant") return "derived";
  if (bucket === "candidate-custom-discussion") return "human review";
  if (bucket === "candidate-row") return "candidate";
  return "-";
}

function evidenceShort(evidence) {
  if (evidence === "live-helm-vs-confighub-parity") return "live parity";
  if (evidence === "two-cluster-kind-parity") return "kind parity";
  if (evidence === "local-kubernetes-live") return "local live";
  if (evidence === "in-confighub-proof") return "ConfigHub";
  if (evidence === "render-parity") return "render";
  if (evidence === "target-bound-derived-variant") return "target-bound";
  if (evidence === "derived-variant-clone") return "derived clone";
  if (evidence === "source-lock") return "source lock";
  if (evidence === "candidate-plan") return "candidate";
  return evidence || "-";
}

function normalizeTargetRunText(text) {
  return String(text || "")
    .replaceAll("supported production base and target scope", "target-ready base and target scope")
    .replaceAll("supported production base", "target-ready base")
    .replaceAll("production base", "target-ready base")
    .replaceAll("claiming production support", "claiming a target run path")
    .replaceAll("production support", "target run evidence")
    .replaceAll("final support decision", "final target run decision");
}

function rowKindLabel(row) {
  if (row.row_kind === "source") return "source";
  if (row.row_kind === "candidate") return row.custom_discussion === "yes" ? "candidate review" : "candidate";
  if (row.row_kind === "derived") return `derived from ${row.parent_base}`;
  return "base";
}

function rowClass(row) {
  return [
    `layer-${String(row.catalog_layer || "").toLowerCase()}`,
    row.row_kind === "candidate" ? "candidate" : "",
    row.custom_discussion === "yes" ? "custom-discussion" : "",
  ].filter(Boolean).join(" ");
}

function rowStatusTitle(row) {
  return [
    row.customization_layer,
    row.row_status ? `status: ${row.row_status}` : "",
    row.custom_discussion === "yes" ? "non-default, requires human review before use" : "",
    row.candidate_source ? `source: ${row.candidate_source}` : "",
    row.candidate_state ? `state: ${row.candidate_state}` : "",
    row.candidate_inputs ? `inputs: ${row.candidate_inputs}` : "",
    row.candidate_required_before ? `required before runnable: ${row.candidate_required_before}` : "",
  ].filter(Boolean).join(" | ");
}

function compactText(text, limit) {
  const value = String(text);
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function productQueues(rows) {
  const realRunnableRows = rows.filter((row) => row.row_kind === "base" || row.row_kind === "derived");
  return [
    {
      label: "F1 source charts",
      rows: rows.filter((row) => row.catalog_layer === "F1"),
      meaning: "Upstream Helm chart/version source rows. These are the starting points before any installer base is chosen.",
    },
    {
      label: "Public catalog rows",
      rows: rows.filter((row) => row.adoption_bucket === "try-from-public-catalog"),
      meaning: "Reviewed top-20 catalog rows. Use base-readiness or the per-chart catalog page to choose the easiest first base.",
    },
    {
      label: "Promote after review",
      rows: rows.filter((row) => row.adoption_bucket === "promote-after-review"),
      meaning: "Proof-grade rows that need catalog/product review before becoming public starting points.",
    },
    {
      label: "Design a more useful base",
      rows: rows.filter((row) => row.adoption_bucket === "needs-useful-variant"),
      meaning: "Rows where plain render proof exists but the first user-facing base is not yet good enough.",
    },
    {
      label: "Decide a limitation first",
      rows: rows.filter((row) => row.adoption_bucket === "limitation-decision-first"),
      meaning: "Rows where a product or operator boundary must be chosen before promotion.",
    },
    {
      label: "Complete the core proof lane",
      rows: realRunnableRows.filter((row) => row.core_lanes_complete !== "yes"),
      meaning: "Real base or derived rows missing at least one core evidence lane: ConfigHub proof, live Kubernetes, GitOps/OCI, or live parity.",
    },
    {
      label: "Active proof queue",
      rows: rows.filter((row) => row.active_proof_next_step),
      meaning: "Rows with a current non-pass live parity result and an exact rerun or review action.",
    },
    {
      label: "Deferred accepted dispositions",
      rows: rows.filter((row) => row.completion_action === "deferred"),
      meaning: "Rows whose current non-green cells are already accepted as watch or n/a; do not spend live-run time until scope changes.",
    },
    {
      label: "Derived ConfigHub variants",
      rows: rows.filter((row) => row.row_kind === "derived"),
      meaning: "Downstream ConfigHub variants cloned from reviewed bases. These show environment, region, customer, or target-specific post-render customization without a Helm rerender.",
    },
    {
      label: "Candidate rows",
      rows: rows.filter((row) => row.row_kind === "candidate"),
      meaning: "Planned F2/F3 paths from committed work-order data. These are visible product paths, not proof claims.",
    },
    {
      label: "Custom-discussion candidates",
      rows: rows.filter((row) => row.row_kind === "candidate" && row.custom_discussion === "yes"),
      meaning: "Non-default or target-specific paths where inputs, ownership, or risk must be discussed before the row becomes runnable.",
    },
    {
      label: "Decide target run scope",
      rows: realRunnableRows.filter((row) => row.production_decision === "todo"),
      meaning: "Rows without a target run decision or target-bound receipt yet.",
    },
    {
      label: "Investigate hard gaps",
      rows: rows.filter((row) => row.row_kind !== "source" && row.hard_gap),
      meaning: "Rows with a named chart/product gap rather than a simple missing receipt.",
    },
  ];
}

function examples(rows, limit = 3, markdown = true) {
  if (rows.length === 0) return "-";
  return rows
    .slice(0, limit)
    .map((row) => {
      const label = `${row.chart}@${row.version}/${row.variant}`;
      return markdown ? `\`${label}\`` : label;
    })
    .join(", ");
}

function activeProofSummary(row) {
  if (!row.active_proof_next_step) return { label: "–", title: "not in the active proof queue" };
  const parts = [
    `next step: ${row.active_proof_next_step}`,
    row.active_proof_readiness ? `readiness: ${row.active_proof_readiness}` : "",
    row.active_proof_reason ? `reason: ${row.active_proof_reason}` : "",
    row.active_proof_support_artifact ? `support artifact: ${row.active_proof_support_artifact}` : "",
    row.active_proof_command ? `command: ${row.active_proof_command}` : "",
  ].filter(Boolean);
  return {
    label: compactText(row.active_proof_next_step, 34),
    title: parts.join(" | "),
  };
}

function variantPromotionSummary(row) {
  const parts = [
    `status: ${row.variant_promotion_status || "unknown"}`,
    row.variant_promotion_reason ? `reason: ${row.variant_promotion_reason}` : "",
    row.variant_promotion_evidence ? `evidence: ${row.variant_promotion_evidence}` : "",
    row.variant_promotion_next_action ? `next action: ${row.variant_promotion_next_action}` : "",
  ].filter(Boolean);
  return {
    label:
      row.variant_promotion === "yes"
        ? "✓"
        : row.variant_promotion === "watch"
          ? "!"
          : row.variant_promotion === "no"
            ? "✗"
            : row.variant_promotion === "todo"
              ? "·"
              : "–",
    title: parts.join(" | "),
  };
}

function completionActionSummary(row) {
  if (!row.completion_action || row.completion_action === "-") {
    return { label: "–", title: "no coverage completion action is attached to this row" };
  }
  const parts = [
    `primary: ${row.completion_action}`,
    row.completion_action_summary ? `summary: ${row.completion_action_summary}` : "",
    row.completion_action_families ? `families: ${row.completion_action_families}` : "",
    row.completion_owner_lanes ? `owners: ${row.completion_owner_lanes}` : "",
    Number(row.completion_deferred_cells || 0) > 0 ? `deferred accepted cells: ${row.completion_deferred_cells}` : "",
  ].filter(Boolean);
  return {
    label: row.completion_action,
    title: parts.join(" | "),
  };
}

function lifecycleRouteSummary(row) {
  if (row.lifecycle_route_contract === "n/a") {
    return { label: "–", title: "no lifecycle route contract applies to this row" };
  }
  const parts = [
    `route rows: ${row.lifecycle_route_count}`,
    `dispositions: ${row.lifecycle_route_dispositions}`,
    `execution modes: ${row.lifecycle_route_execution_modes}`,
    `safe as automatic: ${row.lifecycle_route_safe_automatic}`,
    row.lifecycle_route_evidence_version ? `evidence from chart family @${row.lifecycle_route_evidence_version}, not this exact version` : "",
    `contract: ${row.lifecycle_route_contract_path}`,
    `agent data: ${row.lifecycle_route_json_path}`,
  ].filter(Boolean);
  return {
    label:
      row.lifecycle_route_contract === "yes"
        ? "✓"
        : row.lifecycle_route_contract === "watch"
          ? "!"
          : row.lifecycle_route_contract === "todo"
            ? "·"
            : "–",
    title: parts.join(" | "),
  };
}

function linkFor(label, path, row) {
  if (!path) return escapeHtml(label);
  if (/^https?:\/\//.test(path)) {
    const title = row.source_content_url && row.source_content_url !== path ? ` title="${escapeHtml(row.source_content_url)}"` : "";
    return `<a href="${escapeHtml(path)}"${title}>${escapeHtml(label)}</a>`;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
    return `<span title="${escapeHtml(path)}">${escapeHtml(label)}</span>`;
  }
  return `<a href="../../${escapeHtml(path)}">${escapeHtml(label)}</a>`;
}

function readCsv(rel) {
  const path = join(repoRoot, rel);
  check(existsSync(path), `master matrix source missing: ${rel}`);
  const [header, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const headers = parseCsvLine(header);
  return lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
}

function readJson(rel) {
  const path = join(repoRoot, rel);
  check(existsSync(path), `master matrix source missing: ${rel}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function aggregateCompletionActions(plan) {
  const map = new Map();
  for (const family of plan.families ?? []) {
    for (const affected of family.affected_rows ?? []) {
      const parsed = parseAffectedRow(affected);
      if (!parsed) continue;
      const key = `${parsed.chart}|${parsed.version}|${parsed.base}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        lane: parsed.lane,
        action_id: family.action_id,
        action_type: family.action_type,
        sub_group: family.sub_group,
        owner_lane: family.owner_lane,
      });
    }
  }
  return map;
}

function parseAffectedRow(value) {
  const match = /^(.*)@([^/]+)\/(.+) \[([^\]]+)\]$/.exec(value);
  if (!match) return null;
  return {
    chart: match[1],
    version: match[2],
    base: match[3],
    lane: match[4],
  };
}

function summarizeCompletion(entries, row) {
  const currentEntries = entries.filter((entry) => currentLaneValue(row, entry.lane) !== "yes");
  if (currentEntries.length === 0) {
    return {
      primary: "-",
      summary: "",
      families: "",
      deferredCells: 0,
      owners: "",
    };
  }
  const classes = currentEntries.map((entry) => completionClass(entry));
  const classCounts = countValues(classes);
  const ownerCounts = countValues(currentEntries.map((entry) => entry.owner_lane));
  const priority = ["image", "model", "stage", "run", "upstream", "scope", "deferred"];
  const primary = priority.find((item) => classCounts.has(item)) ?? classes[0] ?? "-";
  return {
    primary,
    summary: summarizeCounts(classCounts),
    families: [...new Set(currentEntries.map((entry) => `${entry.action_id}:${entry.sub_group}`))].sort().join("; "),
    deferredCells: currentEntries.filter((entry) => completionClass(entry) === "deferred").length,
    owners: summarizeCounts(ownerCounts),
  };
}

function currentLaneValue(row, lane) {
  if (lane === "G") return row.lane_gitops_oci_live;
  if (lane === "P") return row.lane_live_dual_parity;
  if (lane === "K") return row.lane_two_cluster_kind;
  if (lane === "L") return row.lane_local_kind;
  if (lane === "lifecycle") return row.lane_lifecycle_observed;
  if (lane === "promotion") return row.variant_promotion;
  return "";
}

function runtimeGitopsReceiptResult(chart, variant) {
  const receiptPath = join(repoRoot, SOURCES.runtimeGitopsRoot, chart.replaceAll("/", "-"), variant, "latest.yaml");
  if (!existsSync(receiptPath)) return "";
  const doc = readYaml(receiptPath) ?? {};
  return doc.spec?.result ?? doc.result ?? "";
}

function completionClass(entry) {
  if (entry.action_type === "record-decision") return "deferred";
  if (entry.action_type === "refuse-or-scope") return entry.owner_lane === "upstream-implementation" ? "upstream" : "scope";
  if (entry.action_type === "refresh-image") return "image";
  if (entry.action_type === "fix-model") return "model";
  if (entry.action_type === "stage-prereq") return "stage";
  if (["run-kind", "run-promotion", "lifecycle-observe"].includes(entry.action_type)) return "run";
  return entry.action_type || "unknown";
}

function indexBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) map.set(keyFn(row), row);
  return map;
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function chooseActiveProofRow(rows) {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => Number(a.priority || 9999) - Number(b.priority || 9999))[0];
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
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
