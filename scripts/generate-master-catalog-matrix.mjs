#!/usr/bin/env node
// The master catalog matrix: ONE generated view of the whole catalog, one row
// per (chart, version, variant), joining the per-variant lane results with
// chart-level translation attributes (tier, adoption bucket, quirk features,
// hook disposition, production decision, outcome level). It invents no new
// truth — every cell is a join over committed sources, and the verifier fails
// when this view goes stale against them.
//
// Three renderings of the same rows:
//   matrix.csv  — machine/spreadsheet import (words, not colors: CSV cannot
//                 carry formatting; open matrix.html for the colored cells)
//   summary.md  — GitHub-readable compact table with icons
//   matrix.html — self-contained colored-cell rendering for a browser
//
// Cell vocabulary:
//   yes (pass)            -> green
//   watch                 -> amber: passing with a recorded caution
//   no (blocked/failed)   -> red
//   todo (not yet run)    -> grey box: absence of evidence, not a failure
//   n/a                   -> neutral blue-grey: the attribute does not apply
//
//   node scripts/generate-master-catalog-matrix.mjs --generate
//   node scripts/generate-master-catalog-matrix.mjs --verify

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

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
  kindParity: "data/live-kind-parity/summary.csv",
};

// Spine columns come from base-outcomes (the derived lane superset).
// lane-test-matrix/variant-lanes.csv is its upstream intermediate and is no
// longer read here — rationalization plan R1.
const LANE_COLUMNS = [
  ["lane_render_parity", "render_parity"],
  ["lane_confighub_scan_ops", "in_confighub"],
  ["lane_local_kind", "local_live"],
  ["lane_lifecycle_observed", "lifecycle_observation"],
  ["lane_gitops_oci_live", "gitops_oci_live"],
  ["lane_live_dual_parity", "live_helm_vs_confighub_parity"],
];

// What each joined source carries into this view and what stays behind —
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
    carried: "decision, target scope",
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
    source: "live-kind-parity/summary.csv",
    carried: "exact chart/version/base two-cluster kind parity result, overriding older aggregate outcome rows when a newer receipt exists",
    dropped: "semantic parity details, reason, related lifecycle evidence, and receipt path",
  },
  {
    source: "live-parity-rerun-plan/rerun-plan.csv",
    carried: "active non-pass live parity rows: next step, rerun readiness, reason, support artifact, rerun command",
    dropped: "priority, lane, current result, receipt path; follow the source when diagnosing the run itself",
  },
];

if (mode === "--generate") {
  const generatedAt = new Date().toISOString();
  const report = buildReport(generatedAt);
  write(outputs.matrix, report.csv);
  write(outputs.summary, report.summary);
  write(outputs.html, report.html);
  write(outputs.generatedAt, `${generatedAt}\n`);
  console.log(`wrote master catalog matrix -> ${relativeRepo(outputRoot)}/ (${report.rows.length} variant rows)`);
} else if (mode === "--verify") {
  check(existsSync(outputs.generatedAt), `${relativeRepo(outputs.generatedAt)} is missing; run npm run master-matrix`);
  const report = buildReport(readFileSync(outputs.generatedAt, "utf8").trim());
  const expected = { summary: report.summary, matrix: report.csv, html: report.html };
  for (const [name, path] of Object.entries(outputs).filter(([name]) => name !== "generatedAt")) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run master-matrix`);
    check(readFileSync(path, "utf8") === expected[name], `${relativeRepo(path)} is stale; run npm run master-matrix`);
  }
  console.log(`verified master catalog matrix: ${report.rows.length} variant rows, ${report.charts} chart versions`);
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
  const lifecycleRoutes = aggregateLifecycleRoutes(readCsv(SOURCES.lifecycleRoutes));
  const lifecycleRoutesExactBase = indexBy(lifecycleRoutes.filter((row) => row.base_or_variant), (row) => `${row.chart}@${row.version}|${row.base_or_variant}`);
  const lifecycleRoutesExact = indexBy(lifecycleRoutes.filter((row) => !row.base_or_variant), (row) => `${row.chart}@${row.version}`);
  const lifecycleRoutesByChart = indexBy(lifecycleRoutes.filter((row) => !row.base_or_variant), (row) => row.chart);
  const decisions = indexBy(readCsv(SOURCES.decisions), (row) => `${row.chart}|${row.version}|${row.supported_base}`);
  const variantPromotion = indexBy(readCsv(SOURCES.variantPromotion), (row) => `${row.chart}|${row.version}|${row.variant}`);
  const liveCompare = indexBy(readCsv(SOURCES.liveCompare), (row) => `${row.chart}|${row.version}|${row.variant}`);
  const kindParity = indexBy(readCsv(SOURCES.kindParity), (row) => `${row.chart}|${row.version}|${row.base}`);
  const activeProofRows = readCsv(SOURCES.activeProof);
  const activeProof = indexBy(activeProofRows, (row) => `${row.chart}|${row.version}|${row.base}`);

  const rows = outcomes
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
      // hook_evidence_version — family evidence must not read as evidence
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
      const lifecycleRouteExactBase = lifecycleRoutesExactBase.get(`${chartAtVersion}|${variant}`);
      const lifecycleRouteExact = lifecycleRoutesExact.get(chartAtVersion);
      const lifecycleRouteFamily = lifecycleRoutesByChart.get(chartName);
      const lifecycleRoute = lifecycleRouteExactBase ?? lifecycleRouteExact ?? lifecycleRouteFamily;
      const lifecycleRouteEvidenceVersion = lifecycleRouteExactBase || lifecycleRouteExact || !lifecycleRoute ? "" : lifecycleRoute.version;
      const hookEvidenceVersion = exactHook || !hook ? "" : hook.version;
      const decision = decisions.get(`${chartName}|${version}|${variant}`);
      const promotion = variantPromotion.get(`${chartName}|${version}|${variant}`);
      const liveCompareResult = liveCompare.get(`${chartName}|${version}|${variant}`)?.result;
      const kindParityResult = kindParity.get(`${chartName}|${version}|${variant}`)?.result;
      const active = activeProof.get(`${chartName}|${version}|${variant}`);
      const hookCount = hook ? Number(hook.source_hook_count) : null;
      // A chart whose source scan flags hooks but that has no disposition row
      // is UNROUTED — rendering it as "no hooks" would hide exactly the gap
      // the hook-disposition completeness gate exists to surface.
      const hookFlagged = (ready?.source_features ?? "").split(";").includes("hooks");
      const row = {
        chart: chartName,
        version,
        variant,
        catalog_tier: ready?.catalog_tier ?? "",
        adoption_bucket: ready?.adoption_bucket ?? "",
        quirk_features: ready?.source_features ?? "",
        hard_gap: ready?.hard_gap === "-" ? "" : (ready?.hard_gap ?? ""),
        strongest_evidence: ready?.strongest_evidence ?? "",
        next_action: ready?.next_action ?? "",
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
        ...Object.fromEntries(LANE_COLUMNS.map(([target, source]) => [target, normalizeLane(outcome[source])])),
        lane_two_cluster_kind: normalizeLane(outcome.two_cluster_kind_parity),
        core_lanes_complete: outcome.complete_core_lane_set === "yes" ? "yes" : "no",
        outcome_level: outcome.outcome_level ?? "",
        production_decision: decision ? (decision.decision === "supported" ? "yes" : decision.decision === "rejected" ? "no" : decision.decision) : "todo",
        production_target_scope: decision?.target_scope ?? "",
        variant_promotion: promotion?.matrix_value ?? "todo",
        variant_promotion_status: promotion?.promotion_status ?? "missing-status",
        variant_promotion_evidence: promotion?.evidence ?? "",
        variant_promotion_reason: promotion?.reason ?? "",
        variant_promotion_next_action: promotion?.next_action ?? "generate variant promotion status",
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
      }
      if (kindParityResult) {
        row.lane_two_cluster_kind = normalizeLane(kindParityResult);
      }
      if (row.lane_lifecycle_observed === "todo" && !needsLifecycleLane(row)) {
        row.lane_lifecycle_observed = "n/a";
      }
      return row;
    })
    .sort((a, b) => {
      const chart = a.chart.localeCompare(b.chart) || a.version.localeCompare(b.version, undefined, { numeric: true });
      if (chart !== 0) return chart;
      if (a.variant === "default") return -1;
      if (b.variant === "default") return 1;
      return a.variant.localeCompare(b.variant);
    });

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
  if (value === "n/a" || value === "") return "—";
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
  return [...groups.values()].map((group) => {
    const dispositions = countValues(group.rows.map((row) => row.disposition));
    const executionModes = countValues(group.rows.map((row) => row.execution_mode));
    const routeCount = group.rows.length;
    const automaticCount = group.rows.filter((row) => row.safe_as_automatic === "yes").length;
    const hasTodo = group.rows.some((row) => row.disposition === "todo");
    const allObserved = group.rows.every((row) => row.disposition === "observed");
    const contractStatus = hasTodo ? "todo" : allObserved ? "yes" : "watch";
    return {
      chart: group.chart,
      version: group.version,
      base_or_variant: group.base_or_variant,
      route_count: String(routeCount),
      contract_status: contractStatus,
      dispositions: summarizeCounts(dispositions),
      execution_modes: summarizeCounts(executionModes),
      safe_as_automatic: `${automaticCount}/${routeCount}`,
    };
  });
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

function needsLifecycleLane(row) {
  if (row.hook_disposition && row.hook_disposition !== "n/a") return true;
  const features = splitList(row.quirk_features);
  if (features.some((feature) => ["hooks", "crds", "webhooks"].includes(feature))) return true;
  const text = `${row.hard_gap} ${row.next_action} ${row.active_proof_reason}`.toLowerCase();
  return ["admission", "apiservice", "crd", "hook", "lifecycle", "webhook"].some((term) => text.includes(term));
}

function summary(rows, charts, unmatchedReadiness) {
  const laneCells = rows.flatMap((row) => [...LANE_COLUMNS.map(([target]) => row[target]), row.lane_two_cluster_kind]).filter(Boolean);
  const counts = {
    yes: laneCells.filter((value) => value === "yes").length,
    watch: laneCells.filter((value) => value === "watch").length,
    no: laneCells.filter((value) => value === "no").length,
    todo: laneCells.filter((value) => value === "todo").length,
    na: laneCells.filter((value) => value === "n/a").length,
  };
  const complete = rows.filter((row) => row.core_lanes_complete === "yes").length;
  const supported = rows.filter((row) => row.production_decision === "yes").length;
  const superseded = rows.filter((row) => row.production_decision === "superseded").length;
  const rejected = rows.filter((row) => row.production_decision === "no").length;
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
  const queues = productQueues(rows);

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
            ? "—"
            : row.hook_count === "0"
              ? "0 —"
              : `${row.hook_count} ${row.hook_disposition} ${icon(row.hook_live_status)}${row.hook_evidence_version ? ` (from @${row.hook_evidence_version})` : ""}`;
      const route = row.lifecycle_route_contract === "n/a" ? "—" : icon(row.lifecycle_route_contract);
      const quirks = row.quirk_features ? `\`${row.quirk_features}\`` : "—";
      return `| ${chartCell} | ${row.variant} | ${tierShort(row.catalog_tier)} | ${quirks} | ${hooks} | ${route} | ${icon(row.lane_render_parity)} | ${icon(row.lane_confighub_scan_ops)} | ${icon(row.lane_local_kind)} | ${icon(row.lane_lifecycle_observed)} | ${icon(row.lane_gitops_oci_live)} | ${icon(row.lane_live_dual_parity)} | ${icon(row.lane_two_cluster_kind)} | ${icon(row.variant_promotion)} | ${row.outcome_level || "—"} | ${icon(row.production_decision)} |`;
    })
    .join("\n");

  const provenance = COLUMN_PROVENANCE.map((entry) => `| [${entry.source}](../${entry.source}) | ${entry.carried} | ${entry.dropped} |`).join("\n");

  return `# Master Catalog Matrix

ONE view of the whole catalog: one row per supported variant, grouped by chart
and version, with the translation attributes and per-lane status joined from
the committed sources below. This file invents no new truth — every cell comes
from a source the verifier checks this view against.

Three renderings of the same rows: this summary (GitHub),
[matrix.csv](matrix.csv) for spreadsheet import (CSV carries words, not
colors), and [matrix.html](matrix.html) — open it in a browser for the
literal red/green/grey colored cells.

## Legend

| Icon | Meaning |
| --- | --- |
| ✅ | yes / pass |
| ⚠️ | watch — passing with a recorded caution |
| ❌ | no / blocked |
| ⬜ | not yet run — absence of evidence, not a failure |
| — | not applicable — this lane does not apply to this base |

Lane columns: **R** render parity (helm template vs installer setup) ·
**C** ConfigHub upload + scan + safe ops · **L** local kind apply ·
**Y** explicit lifecycle observation ·
**G** ConfigHub OCI + Argo live · **P** live Helm-vs-ConfigHub dual parity ·
**K** two-cluster kind parity · **V** server-side ConfigHub variant promotion.
Hooks column: source hook count, disposition route, live-rehearsal status.
**Route** is the generated lifecycle route/off-ramp contract: ✅ all route rows
observed, ⚠️ route/executor named with cautions, ⬜ route work still todo, —
no route row applies.
\`unrouted ⚠️\` marks a chart whose source scan flags hooks but that has no
hook-disposition row yet; \`(from @x.y.z)\` marks chart-family evidence taken
from a different chart version's disposition row.

## Current Status

| Metric | Value |
| --- | ---: |
| Chart versions | ${charts} |
| Variant rows | ${rows.length} |
| Lane cells ✅ / ⚠️ / ❌ / ⬜ / — | ${counts.yes} / ${counts.watch} / ${counts.no} / ${counts.todo} / ${counts.na} |
| Variants with the complete core lane set | ${complete} |
| Variants with a SUPPORTED production decision | ${supported} |
| Recorded production decisions (supported / superseded / rejected) | ${supported} / ${superseded} / ${rejected} |
| Server-side variant promotion (proven / watch / todo / blocked / n/a) | ${promotionProven} / ${promotionWatch} / ${promotionTodo} / ${promotionBlocked} / ${promotionNa} |
| Lifecycle route contracts (observed / watch / todo / n/a) | ${routeContractYes} / ${routeContractWatch} / ${routeContractTodo} / ${routeContractNa} |
| Hook-flagged variants with no disposition row (unrouted) | ${unrouted} |
| Variants currently in the active proof queue | ${activeProofRows.length} |

${unmatchedReadiness.length ? `Chart versions in the lane matrix but not in top-100 readiness (retained candidates or version drift): ${unmatchedReadiness.map((chart) => `\`${chart}\``).join(", ")}.\n` : ""}
## How To Use This Sheet

Each row is one chart/version/base variant. Use the row to answer three
questions before deciding what to do next:

| Question | Column to check |
| --- | --- |
| Can I try this now, promote it, or does it need more design? | Use / adoption bucket |
| What is the strongest evidence currently available? | Evidence, R/C/L/G/P/K, Core |
| What prevents a stronger claim? | Prod, Scope, Gap, Next action |
| Can downstream ConfigHub variants be promoted from this base? | V, Promotion status |
| If a hook or lifecycle behavior exists, where does it go? | Route, Hooks, lifecycle route contract |
| Which non-pass live row should be rerun or reviewed now? | Active proof |

The HTML view carries these user/product columns directly:
[matrix.html](matrix.html). The CSV carries the same fields for filtering:
[matrix.csv](matrix.csv). Counts below are variant rows unless stated
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
action, production target scope, and active proof queue details. The Markdown
table below stays compact for GitHub readability; open [matrix.html](matrix.html)
when you want the user/product view with those columns visible.

## Matrix

| Chart | Variant | Tier | Quirks | Hooks | Route | R | C | L | Y | G | P | K | V | Outcome | Prod |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
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
  const counts = {
    yes: laneCells.filter((value) => value === "yes").length,
    watch: laneCells.filter((value) => value === "watch").length,
    no: laneCells.filter((value) => value === "no").length,
    todo: laneCells.filter((value) => value === "todo").length,
    na: laneCells.filter((value) => value === "n/a").length,
  };
  const supported = rows.filter((row) => row.production_decision === "yes").length;
  const superseded = rows.filter((row) => row.production_decision === "superseded").length;
  const rejected = rows.filter((row) => row.production_decision === "no").length;
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
  const queues = productQueues(rows);

  const statusCell = (value, title, label) => {
    const cls = value === "yes" ? "y" : value === "watch" ? "w" : value === "no" ? "n" : value === "todo" ? "t" : "na";
    const symbol = label ?? (value === "yes" ? "✓" : value === "watch" ? "!" : value === "no" ? "✗" : value === "todo" ? "·" : "–");
    return `<td class="s ${cls}"${title ? ` title="${escapeHtml(title)}"` : ""}>${symbol}</td>`;
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
              : statusCell(row.hook_live_status, `${row.hook_count} hook(s), disposition: ${row.hook_disposition}${row.hook_evidence_version ? ` — evidence from @${row.hook_evidence_version} (chart-family, not this version)` : ""}`, row.hook_count);
      const routeText = lifecycleRouteSummary(row);
      const routeCell = statusCell(row.lifecycle_route_contract, routeText.title, routeText.label);
      const nextAction = row.next_action ? `<td class="note" title="${escapeHtml(row.next_action)}">${escapeHtml(row.next_action.length > 70 ? `${row.next_action.slice(0, 67)}...` : row.next_action)}</td>` : `<td class="note"></td>`;
      const hardGap = row.hard_gap || "not applicable";
      const scope = row.production_target_scope || "not applicable";
      const activeProofText = activeProofSummary(row);
      const promotionText = variantPromotionSummary(row);
      const links = [
        ["source", row.source_repository_url || row.source_content_url],
        ["catalog", row.recipe_catalog_path],
        ["variant", row.variant_path],
        ["package", row.package_base_path],
        ["revision", row.variant_revision_path],
        ["routes", row.lifecycle_route_contract_path],
      ].filter(([label, path]) => label !== "routes" || path).map(([label, path]) => linkFor(label, path, row)).join(" · ");
      return `<tr${first ? ' class="grp"' : ""}><td class="chart">${first ? escapeHtml(chartAtVersion) : ""}</td><td>${escapeHtml(row.variant)}</td><td class="links">${links}<br><a href="${escapeHtml(row.github_recipe_url)}">GitHub folder</a></td><td>${escapeHtml(tierShort(row.catalog_tier))}</td><td class="note route" title="${escapeHtml(row.adoption_bucket)}">${escapeHtml(useShort(row.adoption_bucket))}</td><td class="note evidence" title="${escapeHtml(row.strongest_evidence)}">${escapeHtml(evidenceShort(row.strongest_evidence))}</td>${statusCell(row.core_lanes_complete, row.core_lanes_complete === "yes" ? "complete core lane set" : "one or more core lanes still missing")}<td class="note" title="${escapeHtml(row.quirk_features)}">${escapeHtml(row.quirk_features || "–")}</td>${hooks}${routeCell}${statusCell(row.lane_render_parity)}${statusCell(row.lane_confighub_scan_ops)}${statusCell(row.lane_local_kind)}${statusCell(row.lane_lifecycle_observed, row.lane_lifecycle_observed === "n/a" ? "no explicit lifecycle route expected for this base" : "")}${statusCell(row.lane_gitops_oci_live)}${statusCell(row.lane_live_dual_parity)}${statusCell(row.lane_two_cluster_kind)}${statusCell(row.variant_promotion, promotionText.title, promotionText.label)}<td>${escapeHtml(row.outcome_level || "–")}</td>${statusCell(row.production_decision, row.production_target_scope || "")}<td class="note scope" title="${escapeHtml(scope)}">${escapeHtml(row.production_target_scope ? compactText(row.production_target_scope, 54) : "–")}</td><td class="note gap" title="${escapeHtml(hardGap)}">${escapeHtml(row.hard_gap ? compactText(row.hard_gap, 58) : "–")}</td><td class="note active" title="${escapeHtml(activeProofText.title)}">${escapeHtml(activeProofText.label)}</td>${nextAction}</tr>`;
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
td.scope{max-width:190px}
td.gap{max-width:220px;color:#7a4f00}
.y{background:#1e8e3e;color:#fff}
.w{background:#f9ab00;color:#202124}
.n{background:#d93025;color:#fff}
.t{background:#e8eaed;color:#5f6368}
.na{background:#edf4ff;color:#476282}
</style>
</head>
<body>
<h1>Master Catalog Matrix</h1>
<p class="sub"><b>Generated at:</b> ${escapeHtml(generatedAt)} UTC · source: committed catalog, proof, live, and production-status data.</p>
<p class="sub">${charts} chart versions · ${rows.length} variant rows · lane cells: ${counts.yes} pass / ${counts.watch} watch / ${counts.no} blocked / ${counts.todo} not yet run / ${counts.na} n/a · production decisions: ${supported} supported / ${superseded} superseded / ${rejected} rejected · variant promotion: ${promotionProven} proven / ${promotionWatch} watch / ${promotionTodo} todo / ${promotionBlocked} blocked / ${promotionNa} n/a · lifecycle routes: ${routeContractYes} observed / ${routeContractWatch} watch / ${routeContractTodo} todo / ${routeContractNa} n/a · ${activeProofRows.length} active proof queue row(s) · ${unrouted} hook-flagged variants unrouted (U). Generated from committed sources by scripts/generate-master-catalog-matrix.mjs; regenerate with <code>npm run master-matrix</code>.</p>
<p class="chips"><span class="y">✓ pass</span><span class="w">! watch</span><span class="n">✗ blocked/failed</span><span class="t">· not yet run</span><span class="na">– n/a</span></p>
<p class="sub">This is the user/product front door: Use says the current route, Evidence says the strongest proof available, Core says whether the main proof lanes are complete, Scope says where production support is bounded, Gap names the main product or chart gap, and Active proof shows the exact current non-pass live row action when a row is in the rerun plan. The Links column jumps to the chart catalog, variant definition, package base, variant revision, lifecycle route contract, and GitHub folder. Lanes: Route lifecycle route/off-ramp contract · R render parity · C ConfigHub upload+scan+ops · L local kind apply · Y explicit lifecycle observation · G OCI+Argo live · P live dual parity · K two-cluster kind parity · V server-side variant promotion. Hover cells for detail (hooks, route execution modes, quirks, production target scope, variant promotion status, active proof command, next action). Hooks: U = source scan flags hooks but no disposition row yet; family evidence from another chart version is named in the tooltip.${unmatchedReadiness.length ? ` Not in top-100 readiness (candidates/version drift): ${unmatchedReadiness.map(escapeHtml).join(", ")}.` : ""}</p>
<table class="queues">
<thead><tr><th>Current product queue</th><th>Rows</th><th>Meaning</th><th>Examples</th></tr></thead>
<tbody>
${queues.map((queue) => `<tr><td>${escapeHtml(queue.label)}</td><td>${queue.rows.length}</td><td>${escapeHtml(queue.meaning)}</td><td class="note">${escapeHtml(examples(queue.rows, 4, false))}</td></tr>`).join("\n")}
</tbody>
</table>
<table>
<thead><tr><th>Chart</th><th>Variant</th><th>Links</th><th>Tier</th><th>Use</th><th>Evidence</th><th>Core</th><th>Quirks</th><th>Hooks</th><th>Route</th><th>R</th><th>C</th><th>L</th><th>Y</th><th>G</th><th>P</th><th>K</th><th>V</th><th>Outcome</th><th>Prod</th><th>Scope</th><th>Gap</th><th>Active proof</th><th>Next action</th></tr></thead>
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
  return tier || "—";
}

function useShort(bucket) {
  if (bucket === "try-from-public-catalog") return "try";
  if (bucket === "promote-after-review") return "review";
  if (bucket === "needs-useful-variant") return "needs variant";
  if (bucket === "limitation-decision-first") return "limit first";
  return "—";
}

function evidenceShort(evidence) {
  if (evidence === "live-helm-vs-confighub-parity") return "live parity";
  if (evidence === "two-cluster-kind-parity") return "kind parity";
  if (evidence === "local-kubernetes-live") return "local live";
  if (evidence === "in-confighub-proof") return "ConfigHub";
  if (evidence === "render-parity") return "render";
  return evidence || "—";
}

function compactText(text, limit) {
  const value = String(text);
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function productQueues(rows) {
  return [
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
      rows: rows.filter((row) => row.core_lanes_complete !== "yes"),
      meaning: "Rows missing at least one core evidence lane: ConfigHub proof, live Kubernetes, GitOps/OCI, or live parity.",
    },
    {
      label: "Active proof queue",
      rows: rows.filter((row) => row.active_proof_next_step),
      meaning: "Rows with a current non-pass live parity result and an exact rerun or review action.",
    },
    {
      label: "Record or finish production scope",
      rows: rows.filter((row) => row.production_decision === "todo"),
      meaning: "Rows without a target-scoped supported, superseded, or rejected production decision.",
    },
    {
      label: "Investigate hard gaps",
      rows: rows.filter((row) => row.hard_gap),
      meaning: "Rows with a named chart/product gap rather than a simple missing receipt.",
    },
  ];
}

function examples(rows, limit = 3, markdown = true) {
  if (rows.length === 0) return "—";
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

function indexBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) map.set(keyFn(row), row);
  return map;
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
