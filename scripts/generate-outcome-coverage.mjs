#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "outcome-coverage");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  charts: join(outputRoot, "chart-outcomes.csv"),
  bases: join(outputRoot, "base-outcomes.csv"),
  derived: join(outputRoot, "derived-variant-outcomes.csv"),
  features: join(outputRoot, "feature-outcomes.csv"),
};

if (mode === "--generate") {
  const report = buildReport();
  for (const [key, path] of Object.entries(outputs)) write(path, report[key]);
  console.log(`wrote outcome coverage -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [key, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run outcomes:generate`);
    check(readFileSync(path, "utf8") === report[key], `${relativeRepo(path)} is stale; run npm run outcomes:generate`);
  }
  console.log(`verified outcome coverage for ${report.chartRows.length} chart(s), ${report.baseRows.length} base row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-outcome-coverage.mjs --generate
  node scripts/generate-outcome-coverage.mjs --verify`);
}

function buildReport() {
  const modelRows = parseCsvFile("data/model-completeness/report.csv");
  const laneRows = parseCsvFile("data/lane-test-matrix/variant-lanes.csv");
  const chartFacts = parseCsvFile("data/chart-facts/chart-facts.csv");
  const productionRows = parseCsvFile("data/production-disposition/top20.csv");
  const derivedTargetRows = parseCsvFile("data/derived-variant-target-bound/summary.csv");
  const hookRows = parseCsvFile("data/hook-lifecycle/maintained-hook-queue.csv");
  const hookReceiptRows = parseCsvFile("data/hook-lifecycle/receipt-index.csv");
  const lifecycleObservationRows = parseCsvFile("data/lifecycle-observations/cert-manager-eso/summary.csv");
  const liveParityRows = parseCsvFile("data/live-helm-confighub-compare/summary.csv");
  const kindParityRows = parseCsvFile("data/live-kind-parity/summary.csv");

  const modelByChart = new Map(modelRows.map((row) => [row.chart, row]));
  const factsByChart = new Map(chartFacts.map((row) => [`${row.chart}@${row.version}`, row]));
  const prodByChart = new Map(productionRows.map((row) => [`${row.chart}@${row.version}`, row]));
  const hookReceiptByChart = new Map(hookReceiptRows.map((row) => [`${row.chart}@${row.version}`, row]));
  const lanesByChart = group(laneRows, (row) => `${row.chart}@${row.version}`);
  const kindParityByBase = new Map(kindParityRows.map((row) => [`${row.chart}@${row.version}|${row.base}`, row]));

  const chartRows = modelRows
    .map((model) => {
      const chart = model.chart;
      const facts = factsByChart.get(chart) ?? {};
      const production = prodByChart.get(chart) ?? {};
      const rows = lanesByChart.get(chart) ?? [];
      return {
        chart,
        support_status: model.support_status,
        production_readiness: model.production_readiness,
        model_supported_level2: model.supported,
        model_score: model.score,
        variant_count: model.variant_count,
        variant_rich: model.variant_complete,
        base_rows: rows.length,
        complete_core_rows: count(rows, (row) => row.complete_core_lane_set === "yes"),
        render_parity_pass: count(rows, lanePass("helm_template_vs_installer_setup")),
        in_confighub_pass: count(rows, lanePass("confighub_upload_variant_scan_safe_ops")),
        local_live_pass: count(rows, lanePass("local_kind_kubectl_apply")),
        gitops_live_pass: count(rows, lanePass("confighub_oci_argo_live")),
        gitops_live_non_pass_receipts: count(rows, laneNonPassReceipt("confighub_oci_argo_live")),
        live_parity_pass: count(rows, lanePass("live_helm_vs_confighub_dual_compare")),
        live_parity_non_pass_receipts: count(rows, laneNonPassReceipt("live_helm_vs_confighub_dual_compare")),
        two_cluster_kind_parity_pass: count(rows, (row) => kindParityByBase.get(`${row.chart}@${row.version}|${row.variant}`)?.result === "pass"),
        two_cluster_kind_parity_non_pass_receipts: count(rows, (row) => {
          const result = kindParityByBase.get(`${row.chart}@${row.version}|${row.variant}`)?.result;
          return ["fail", "watch", "blocked"].includes(result);
        }),
        supported_variants: production.supported_variants || rows.map((row) => row.variant).join(";"),
        hook_route_status: hookReceiptByChart.get(chart)?.receipt_status ?? "",
        feature_summary: featureSummary(facts),
        hard_gap: facts.not_yet_enabled ?? "",
        buildable_backlog: facts.buildable_not_yet_run ?? "",
        recipe_path: model.recipe_path,
      };
    })
    .sort((a, b) => a.chart.localeCompare(b.chart));

  const baseRows = laneRows.map((row) => {
    const kindParity = kindParityByBase.get(`${row.chart}@${row.version}|${row.variant}`);
    return {
      chart: `${row.chart}@${row.version}`,
      base: row.variant,
      outcome_level: outcomeLevel(row),
      render_parity: row.helm_template_vs_installer_setup,
      in_confighub: row.confighub_upload_variant_scan_safe_ops,
      local_live: row.local_kind_kubectl_apply,
      gitops_oci_live: row.confighub_oci_argo_live,
      live_helm_vs_confighub_parity: row.live_helm_vs_confighub_dual_compare,
      two_cluster_kind_parity: kindParity?.result ?? "missing",
      two_cluster_kind_parity_reason: kindParity?.reason ?? "",
      complete_core_lane_set: row.complete_core_lane_set,
      missing_or_non_pass_lanes: row.missing_core_lanes,
      recipe_path: row.recipe_path,
      package_path: row.package_path,
      variant_revision: row.variant_revision,
      evidence_notes: [row.lane_notes, kindParity ? kindParity.receipt : "no two-cluster kind parity receipt in this repo"].filter(Boolean).join(" | "),
    };
  });

  const derivedRows = derivedVariantRows(derivedTargetRows);
  const featureRows = chartFacts.flatMap((facts) =>
    featureRowsForChart(facts, modelByChart.get(`${facts.chart}@${facts.version}`), hookReceiptByChart.get(`${facts.chart}@${facts.version}`))
  );

  const aggregate = {
    charts: chartRows.length,
    modelSupported: count(chartRows, (row) => row.model_supported_level2 === "yes"),
    variantRich: count(chartRows, (row) => row.variant_rich === "yes"),
    baseRows: baseRows.length,
    completeCoreRows: count(baseRows, (row) => row.complete_core_lane_set === "yes"),
    renderParityPass: count(baseRows, (row) => row.render_parity === "pass"),
    inConfighubPass: count(baseRows, (row) => row.in_confighub === "pass"),
    localLivePass: count(baseRows, (row) => row.local_live === "pass"),
    gitopsLivePass: count(baseRows, (row) => row.gitops_oci_live === "pass"),
    gitopsLiveNonPass: count(baseRows, (row) => ["fail", "watch", "blocked"].includes(row.gitops_oci_live)),
    liveParityPass: count(baseRows, (row) => row.live_helm_vs_confighub_parity === "pass"),
    liveParityNonPass: count(baseRows, (row) => ["fail", "watch", "blocked"].includes(row.live_helm_vs_confighub_parity)),
    derivedIntendedPass: count(derivedRows, (row) => row.intended_state === "pass"),
    derivedTargetPass: count(derivedRows, (row) => row.target_bound_live === "pass"),
    derivedTargetBlocked: count(derivedRows, (row) => row.target_bound_live === "blocked"),
    hookChartsTop100: hookRows.length,
    hookRouteReceipts: count(hookReceiptRows, (row) => ["route-selected", "partially-observed", "observed", "blocked"].includes(row.receipt_status)),
    hookLifecycleObserved: count(hookReceiptRows, (row) => row.receipt_status === "observed"),
    hookLifecyclePartiallyObserved: count(hookReceiptRows, (row) => row.receipt_status === "partially-observed"),
    hookRoutesAwaitingObservation: count(hookReceiptRows, (row) => row.receipt_status === "route-selected"),
    hookRowsStillNeedingRoute: count(hookReceiptRows, (row) => row.receipt_status === "not-yet-written"),
    relatedLifecycleObservationPass: count(lifecycleObservationRows, (row) => row.result === "pass"),
    relatedLifecycleObservationRows: lifecycleObservationRows.length,
    liveParityRows: liveParityRows.length,
    liveParitySelectedPass: count(liveParityRows, (row) => row.result === "pass"),
    liveParitySelectedWatch: count(liveParityRows, (row) => row.result === "watch"),
    liveParitySelectedBlocked: count(liveParityRows, (row) => row.result === "blocked"),
    kindParityRows: kindParityRows.length,
    kindParityPass: count(kindParityRows, (row) => row.result === "pass"),
    kindParityWatch: count(kindParityRows, (row) => row.result === "watch"),
    kindParityBlocked: count(kindParityRows, (row) => row.result === "blocked"),
  };

  return {
    chartRows,
    baseRows,
    derivedRows,
    featureRows,
    summary: summary({ aggregate, chartRows }),
    charts: toCsv(chartRows),
    bases: toCsv(baseRows),
    derived: toCsv(derivedRows),
    features: toCsv(featureRows),
  };
}

function derivedVariantRows(targetRows) {
  const targetByExact = new Map(targetRows.map((row) => [`${row.chart}@${row.version}|${row.base}|${row.variant}`, row]));
  const targetByVariant = new Map(targetRows.map((row) => [`${row.chart}@${row.version}|${row.variant}`, row]));
  const matchedTargets = new Set();
  const receipts = listFiles(join(repoRoot, "runs", "derived-variant-execution"))
    .filter((file) => file.endsWith("/variant-create-receipt.yaml"))
    .map((path) => {
      const receipt = readYaml(path);
      const spec = receipt.spec ?? {};
      const exactKey = `${spec.source?.chart}@${spec.source?.chartVersion}|${spec.source?.base}|${spec.create?.variant}`;
      const variantKey = `${spec.source?.chart}@${spec.source?.chartVersion}|${spec.create?.variant}`;
      const target = targetByExact.get(exactKey) ?? targetByVariant.get(variantKey);
      if (target) matchedTargets.add(`${target.chart}@${target.version}|${target.base}|${target.variant}`);
      return {
        chart: `${spec.source?.chart}@${spec.source?.chartVersion}`,
        base: spec.source?.base ?? "",
        target_bound_base: target?.base ?? "",
        derived_variant: spec.create?.variant ?? "",
        source_space: spec.source?.sourceSpace ?? "",
        downstream_space: spec.create?.downstreamSpace ?? "",
        intended_state: spec.result ?? "",
        target_bound_live: target?.result ?? "not-target-bound",
        argo: target?.argo ?? spec.liveApply?.result ?? "",
        runtime: target?.runtime ?? spec.liveApply?.result ?? "",
        blockers: target?.blocker_ids ?? "",
        route_forward: target?.route_forward ?? "",
        intended_receipt: relativeRepo(path),
        target_bound_receipt: target?.receipt ?? "",
      };
    });
  const targetOnlyRows = targetRows
    .filter((row) => !matchedTargets.has(`${row.chart}@${row.version}|${row.base}|${row.variant}`))
    .map((row) => ({
      chart: `${row.chart}@${row.version}`,
      base: row.base,
      target_bound_base: row.base,
      derived_variant: row.variant,
      source_space: "",
      downstream_space: row.downstream_space,
      intended_state: "not-in-intended-wave",
      target_bound_live: row.result,
      argo: row.argo,
      runtime: row.runtime,
      blockers: row.blocker_ids,
      route_forward: row.route_forward,
      intended_receipt: "",
      target_bound_receipt: row.receipt,
    }));
  return [...receipts, ...targetOnlyRows].sort((a, b) => `${a.chart}/${a.derived_variant}/${a.base}`.localeCompare(`${b.chart}/${b.derived_variant}/${b.base}`));
}

function featureRowsForChart(facts, model, hookReceipt) {
  const chart = `${facts.chart}@${facts.version}`;
  const recipePath = model?.recipe_path ?? "";
  const rows = [
    ["post_deploy_hooks", facts.post_deploy_hooks],
    ["other_hooks", facts.other_hooks],
    ["hook_status", facts.hook_status],
    ["hook_route_evidence", facts.hook_route_evidence],
    ["hook_route_next_action", facts.hook_route_next_action],
    ["generates_secrets", facts.generates_secrets],
    ["existing_secret", facts.existing_secret],
    ["crds", facts.crds],
    ["no_crds_variant", facts.no_crds_variant],
    ["webhooks", facts.webhooks],
    ["required_values", facts.required_values],
    ["values_schema", facts.values_schema],
    ["install_vs_upgrade", facts.install_vs_upgrade],
    ["notes", facts.notes],
    ["extension_slots", facts.extension_slots],
    ["dependency_lock", facts.dependency_lock],
    ["remote_dependency_risk", facts.remote_dependency_risk],
    ["dependency_range_policy", facts.dependency_range_policy],
    ["dependency_refresh_survival", facts.dependency_refresh_survival],
    ["buildable_not_yet_run", facts.buildable_not_yet_run],
    ["not_yet_enabled", facts.not_yet_enabled],
  ];
  return rows.map(([feature, status]) => {
    const hookFeature = isHookFeature(feature);
    return {
      chart,
      feature,
      status: featureStatus(feature, status, hookFeature ? hookReceipt : undefined),
      support_meaning: featureMeaning(feature, status, hookFeature ? hookReceipt : undefined),
      evidence: unique([
        "data/chart-facts/chart-facts.csv",
        `${recipePath}/helm-pain-report.yaml`,
        `${recipePath}/weirdness-and-mitigations.md`,
        hookFeature && facts.hook_route_evidence !== "—" ? facts.hook_route_evidence : "",
        hookFeature ? hookReceipt?.required_receipt : "",
      ].filter(Boolean)).join(";"),
    };
  });
}

function unique(values) {
  return [...new Set(values)];
}

function featureStatus(feature, status, hookReceipt) {
  const text = String(status ?? "").trim();
  if (emptyFeatureStatus(text)) return "-";
  if (feature === "hook_status" && hookReceipt?.receipt_status === "observed") return "lifecycle-observed: explicit receipt committed";
  if (feature === "hook_status" && hookReceipt?.receipt_status === "partially-observed") return "install-lifecycle-observed: remaining hook phase pending";
  if (feature === "hook_route_evidence") return text;
  if (feature === "hook_route_next_action") return text;
  if (feature === "crds" || feature === "webhooks") return "present";
  return text;
}

function featureMeaning(feature, status, hookReceipt) {
  const text = String(status ?? "").trim();
  if (emptyFeatureStatus(text)) return "not observed or not applicable in chart facts";
  if (feature === "not_yet_enabled") return text.includes("no open gap") ? "no hard capability gap recorded" : "hard gap or curated proof lane remains";
  if (feature === "buildable_not_yet_run") return text === "-" ? "no buildable backlog recorded" : "known build path exists but has not been promoted";
  if (feature === "hook_route_evidence") return "file that supports the hook route state";
  if (feature === "hook_route_next_action") return "next lifecycle step before stronger hook support can be claimed";
  if (isHookFeature(feature)) return hookMeaning(hookReceipt);
  if (feature === "existing_secret") return "bring-your-own-secret route status";
  if (feature === "crds" && /^\d+$/.test(text)) return `CRDs are present; count ${text}; raw count is in chart-facts.csv`;
  if (feature === "no_crds_variant") return "CRD ownership route status";
  if (feature === "webhooks" && /^\d+$/.test(text)) return `admission webhooks are present; count ${text}; raw count is in chart-facts.csv`;
  if (feature === "extension_slots") return "open extension slots require per-use review";
  if (feature === "dependency_lock") return "recipe dependency closure and Chart.lock digest status";
  if (feature === "remote_dependency_risk") return "source-scan dependency risk surfaced from remote-dependency-closure";
  if (feature === "dependency_range_policy") return text === "freeze-to-chart-lock"
    ? "install uses the committed dependency lock; range re-resolution belongs to refresh candidates"
    : "dependency range policy status";
  if (feature === "dependency_refresh_survival") return "dependency row is connected to refresh-survival evidence where available";
  return "tracked chart fact";
}

function isHookFeature(feature) {
  return ["post_deploy_hooks", "other_hooks", "hook_status", "hook_route_evidence", "hook_route_next_action"].includes(feature);
}

function hookMeaning(hookReceipt) {
  if (!hookReceipt) return "hook or lifecycle behavior must be tracked through lifecycle policy or blocker";
  if (hookReceipt.receipt_status === "route-selected") return "hook route is selected; runtime execution or observation is still required";
  if (hookReceipt.receipt_status === "partially-observed") return "fresh-install lifecycle is observed; another hook phase such as upgrade still needs execution or observation";
  if (hookReceipt.receipt_status === "observed") return "hook route has lifecycle observation or execution evidence";
  if (hookReceipt.receipt_status === "blocked") return "hook route is reviewed and blocked";
  if (hookReceipt.receipt_status === "not-yet-written") return "hook route receipt is still required";
  return "hook receipt exists but needs classification";
}

function emptyFeatureStatus(text) {
  return !text || text === "-" || text === "—";
}

function summary({ aggregate, chartRows }) {
  const top20 = chartRows.filter((row) => row.support_status === "catalog-supported");
  const selected = top20.slice(0, 20);
  return `# Outcome Coverage

This generated report joins the main proof surfaces into one reader-facing map:
what outcomes the project claims, which tests prove them, and where to inspect
the status per chart, base variant, derived variant, and Helm feature.

## Aggregate Status

\`\`\`text
charts with model support:           ${aggregate.modelSupported}/${aggregate.charts}
variant-rich charts:                 ${aggregate.variantRich}/${aggregate.charts}
chart/base rows:                     ${aggregate.baseRows}
complete core lane rows:             ${aggregate.completeCoreRows}/${aggregate.baseRows}
render parity rows:                  ${aggregate.renderParityPass}/${aggregate.baseRows}
in-ConfigHub proof rows:             ${aggregate.inConfighubPass}/${aggregate.baseRows}
local live rows:                     ${aggregate.localLivePass}/${aggregate.baseRows}
GitOps/OCI live pass rows:           ${aggregate.gitopsLivePass}/${aggregate.baseRows}
GitOps/OCI non-pass receipts:        ${aggregate.gitopsLiveNonPass}
live Helm-vs-ConfigHub pass rows:    ${aggregate.liveParityPass}/${aggregate.baseRows}
live Helm-vs-ConfigHub non-pass receipts: ${aggregate.liveParityNonPass}
selected live parity receipts:       ${aggregate.liveParitySelectedPass} pass, ${aggregate.liveParitySelectedWatch} watch, ${aggregate.liveParitySelectedBlocked} blocked
two-cluster kind parity receipts:    ${aggregate.kindParityPass} pass, ${aggregate.kindParityWatch} watch, ${aggregate.kindParityBlocked} blocked
derived intended-state pass rows:    ${aggregate.derivedIntendedPass}
target-bound derived pass rows:      ${aggregate.derivedTargetPass}
target-bound derived blocked rows:   ${aggregate.derivedTargetBlocked}
maintained hook queue rows:          ${aggregate.hookChartsTop100}
hook route receipts present:         ${aggregate.hookRouteReceipts}/${aggregate.hookChartsTop100}
hook lifecycle observations present: ${aggregate.hookLifecycleObserved}/${aggregate.hookChartsTop100}
hook partial lifecycle observations: ${aggregate.hookLifecyclePartiallyObserved}/${aggregate.hookChartsTop100}
hook routes awaiting observation:    ${aggregate.hookRoutesAwaitingObservation}/${aggregate.hookChartsTop100}
hook rows still needing route:       ${aggregate.hookRowsStillNeedingRoute}/${aggregate.hookChartsTop100}
related lifecycle observations:      ${aggregate.relatedLifecycleObservationPass}/${aggregate.relatedLifecycleObservationRows}
\`\`\`

## Outcome Promises And Proving Tests

| Outcome users care about | Test / evidence | Command |
| --- | --- | --- |
| The chart model is understandable and honestly scoped. | model-completeness report, chart facts, pain reports, weirdness notes | \`npm run completeness:verify\` |
| A base variant renders the same object set as Helm under recorded inputs. | \`render_parity\` in [base-outcomes.csv](./base-outcomes.csv) | \`npm run outcomes:verify\` |
| The rendered objects can be uploaded and operated in ConfigHub. | \`confighub_upload_variant_scan_safe_ops\` lane | \`npm run top20:verify-confighub-proof\` |
| The rendered objects work in Kubernetes for tested rows. | \`local_kind_kubectl_apply\` lane | \`npm run top20:verify-local-e2e\` |
| ConfigHub OCI can be reconciled by GitOps for tested rows. | \`confighub_oci_argo_live\` lane | \`npm run runtime-gitops:wave:verify\` |
| Plain Helm and ConfigHub delivery reach equivalent live outcomes for tested rows. | \`live_helm_vs_confighub_dual_compare\`, two-cluster parity receipts | \`npm run live-parity:verify && npm run kind-parity:verify\` |
| Derived ConfigHub variants preserve reviewed bases and expose post-render changes. | derived variant execution and target-bound receipts | \`npm run derived-variants:verify && npm run derived-variants:target-bound:verify\` |
| Hooks and hook-like lifecycle behavior are not hidden in render proof. | hook route receipts, hook lifecycle queue, and lifecycle observations | \`npm run hooks:lifecycle:verify && npm run lifecycle:boundary:verify && npm run lifecycle:cert-manager-eso:verify\` |
| Images, Secrets, CRDs, webhooks, target facts, and other chart-specific features are visible. | chart facts, attack-plan workdown, image-digest workdown | \`npm run chart-facts:verify && npm run attack-plan:verify && npm run image-digests:workdown:verify\` |

## Files

| File | What it shows |
| --- | --- |
| \`chart-outcomes.csv\` | One row per chart: model support, production readiness, variant count, lane counts, feature summary, hard gaps. |
| \`base-outcomes.csv\` | One row per chart/base variant: render parity, in-ConfigHub proof, local live, GitOps/OCI live, live parity, and two-cluster kind parity. |
| \`derived-variant-outcomes.csv\` | One row per executed derived ConfigHub variant: intended-state proof and target-bound live status. |
| \`feature-outcomes.csv\` | One row per chart/feature: hooks, generated secrets, CRDs, webhooks, required values, schemas, extension slots, gaps. |

## Catalog-Supported Chart Snapshot

| Chart | Variants | Model | In-ConfigHub | Local live | GitOps live | Live parity | Two-cluster parity | Hard gap |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${selected
  .map((row) =>
    `| \`${row.chart}\` | ${row.supported_variants || row.variant_count} | ${row.model_supported_level2} | ${row.in_confighub_pass}/${row.base_rows} | ${row.local_live_pass}/${row.base_rows} | ${row.gitops_live_pass}/${row.base_rows} | ${row.live_parity_pass}/${row.base_rows} | ${row.two_cluster_kind_parity_pass}/${row.base_rows} | ${escapePipes(shortGap(row.hard_gap))} |`
  )
  .join("\n")}

## How To Read This

\`pass\` means a committed receipt exists and the verifier checks it. \`missing\`
means the lane has not been proven for that exact chart/base row. \`fail\`,
\`watch\`, or \`blocked\` means the repo has evidence that the row did not pass
as-is on the tested target.

Use the narrowest true claim: model-supported, render parity, in-ConfigHub,
local live, GitOps live, live parity, hook route selected, lifecycle observed,
or production-ready.
`;
}

function outcomeLevel(row) {
  const order = [
    ["live-parity", row.live_helm_vs_confighub_dual_compare],
    ["gitops-live", row.confighub_oci_argo_live],
    ["local-live", row.local_kind_kubectl_apply],
    ["in-confighub", row.confighub_upload_variant_scan_safe_ops],
    ["render-parity", row.helm_template_vs_installer_setup],
  ];
  const found = order.find(([, value]) => value === "pass");
  return found?.[0] ?? "not-proven";
}

function featureSummary(facts) {
  const features = [];
  if (truthyStatus(facts.post_deploy_hooks) || truthyStatus(facts.other_hooks)) features.push("hooks");
  if (truthyStatus(facts.generates_secrets)) features.push("generated-secrets");
  if (truthyStatus(facts.crds)) features.push("crds");
  if (truthyStatus(facts.webhooks)) features.push("webhooks");
  if (truthyStatus(facts.required_values)) features.push("required-values");
  if (truthyStatus(facts.values_schema)) features.push("values-schema");
  if (truthyStatus(facts.install_vs_upgrade)) features.push("install-vs-upgrade");
  if (truthyStatus(facts.extension_slots)) features.push("extension-slots");
  if (truthyStatus(facts.remote_dependency_risk)) features.push("remote-dependencies");
  if (facts.dependency_range_policy === "freeze-to-chart-lock") features.push("dependency-range-frozen");
  return features.join(";") || "none-recorded";
}

function truthyStatus(value) {
  const text = String(value ?? "").trim();
  return !emptyFeatureStatus(text) && text !== "n/a" && !text.startsWith("n/a ");
}

function lanePass(lane) {
  return (row) => row[lane] === "pass";
}

function laneNonPassReceipt(lane) {
  return (row) => ["fail", "watch", "blocked"].includes(row[lane]);
}

function group(rows, keyFn) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function shortGap(value) {
  const text = String(value ?? "").trim();
  if (!text || text.includes("no open gap")) return "-";
  return ascii(text).replace(/^-\s*/, "").slice(0, 90);
}

function ascii(text) {
  return String(text ?? "")
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2026", "...");
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function parseCsv(text) {
  const lines = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      lines.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    lines.push(row);
  }
  const [headers, ...records] = lines.filter((line) => line.some((item) => item !== ""));
  if (!headers) return [];
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
  );
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = ascii(value === undefined || value === null ? "" : String(value));
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|");
}
