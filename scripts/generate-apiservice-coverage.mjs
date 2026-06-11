#!/usr/bin/env node

// Top-100 APIService coverage bridge.
//
// APIService objects are rendered configuration, but the important runtime
// question is whether Kubernetes API aggregation and TLS readiness work after
// apply. This report separates source detection, recipe/model coverage,
// object/workload observation, live parity, and the remaining aggregated API
// availability receipt.
//
//   node scripts/generate-apiservice-coverage.mjs --generate
//   node scripts/generate-apiservice-coverage.mjs --verify
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "apiservice-coverage");
const outputs = {
  csv: join(outputRoot, "top100-apiservice-coverage.csv"),
  maintainedCsv: join(outputRoot, "maintained-apiservice-coverage.csv"),
  summary: join(outputRoot, "summary.md"),
  workOrdersCsv: join(outputRoot, "work-orders.csv"),
  workOrdersMd: join(outputRoot, "work-orders.md"),
};

const knownReceipts = {
  "metrics-server/metrics-server@3.13.0": {
    configHubProof: "runs/metrics-server-confighub-proof/latest/confighub-proof-receipt.yaml",
    localObservation: "runs/top20-local-kind/metrics-server-default/observation-receipt.json",
    objectSet: "runs/top20-local-kind/metrics-server-default/cub-scout.object-set.receipt.json",
    workload: "runs/top20-local-kind/metrics-server-default/cub-scout.workloads.receipt.json",
    liveParity: "runs/live-helm-confighub-compare/metrics-server-metrics-server-default/receipt.yaml",
    kindParity: [
      "runs/live-kind-parity/metrics-server-metrics-server-default/receipt.yaml",
      "runs/live-kind-parity/metrics-server-metrics-server-external-tls-ca/receipt.yaml",
    ],
    runtimeGitOps: "data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml",
  },
  "kedacore/keda@2.19.0": {
    configHubProof: "runs/keda-confighub-proof/latest/confighub-proof-receipt.yaml",
    kindParity: [
      "runs/live-kind-parity/kedacore-keda-default/receipt.yaml",
    ],
    runtimeGitOps: "data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml",
  },
  "prometheus-community/prometheus-adapter@5.3.0": {
    configHubProof: "runs/prometheus-adapter-confighub-proof/latest/confighub-proof-receipt.yaml",
  },
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.outputs.csv);
  write(outputs.maintainedCsv, report.outputs.maintainedCsv);
  write(outputs.summary, report.outputs.summary);
  write(outputs.workOrdersCsv, report.outputs.workOrdersCsv);
  write(outputs.workOrdersMd, report.outputs.workOrdersMd);
  console.log(`wrote ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const path of Object.values(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run apiservice:coverage`);
  }
  check(readFileSync(outputs.csv, "utf8") === report.outputs.csv, `${relativeRepo(outputs.csv)} is stale; run npm run apiservice:coverage`);
  check(readFileSync(outputs.maintainedCsv, "utf8") === report.outputs.maintainedCsv, `${relativeRepo(outputs.maintainedCsv)} is stale; run npm run apiservice:coverage`);
  check(readFileSync(outputs.summary, "utf8") === report.outputs.summary, `${relativeRepo(outputs.summary)} is stale; run npm run apiservice:coverage`);
  check(readFileSync(outputs.workOrdersCsv, "utf8") === report.outputs.workOrdersCsv, `${relativeRepo(outputs.workOrdersCsv)} is stale; run npm run apiservice:coverage`);
  check(readFileSync(outputs.workOrdersMd, "utf8") === report.outputs.workOrdersMd, `${relativeRepo(outputs.workOrdersMd)} is stale; run npm run apiservice:coverage`);
  console.log(`verified APIService coverage for ${report.rows.length} top100 source row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-apiservice-coverage.mjs --generate
  node scripts/generate-apiservice-coverage.mjs --verify`);
}

function buildReport() {
  const sourceRows = JSON.parse(readFileSync(join(repoRoot, "data/top500-catalog-analysis/source/source-feature-scan.raw.json"), "utf8"))
    .filter((row) => row.scanStatus === "scanned" && Number(row.rank) <= 100 && Number(row.apiServices ?? 0) > 0)
    .sort((left, right) => Number(left.rank) - Number(right.rank));
  const reviewRows = parseCsvFile("data/top100-catalog-analysis/review.csv");
  const quirkRows = parseCsvFile("data/quirk-work-queue/top100-queue.csv");
  const reviewByChart = new Map(reviewRows.map((row) => [row.chart, row]));
  const quirkByRef = new Map(quirkRows.map((row) => [`${row.chart}@${row.source_version}`, row]));

  check(sourceRows.length === 5, `expected 5 source top100 APIService rows; found ${sourceRows.length}`);

  const localTriageRows = parseCsvFile("data/local-live-triage/triage.csv");
  const localTriageByRef = new Map(localTriageRows.map((row) => [row.chart, row]));

  const rows = sourceRows.map((source) => rowFor(source, reviewByChart.get(source.chart), quirkByRef.get(`${source.chart}@${source.version}`), localTriageByRef));
  const sourceRefs = new Set(rows.map((row) => `${row.chart}@${row.source_version}`));
  const maintainedRows = JSON.parse(readFileSync(join(repoRoot, "data/top500-catalog-analysis/source/source-feature-scan.raw.json"), "utf8"))
    .filter((row) => row.scanStatus === "scanned" && Number(row.apiServices ?? 0) > 0)
    .map((source) => rowFor(source, reviewByChart.get(source.chart), quirkByRef.get(`${source.chart}@${source.version}`), localTriageByRef))
    .filter((row) => Boolean(row.evidence_recipe_path))
    .sort((left, right) => Number(left.rank) - Number(right.rank));
  const maintainedExtraRows = maintainedRows.filter((row) => !sourceRefs.has(`${row.chart}@${row.source_version}`));
  const aggregationRows = rows.filter((row) => row.api_aggregation_observed === "yes");

  check(rows.some((row) => row.chart === "metrics-server/metrics-server" && row.coverage_status === "api-aggregation-observed"), "expected Metrics Server API aggregation observation row");
  check(rows.some((row) => row.chart === "kedacore/keda" && row.coverage_status === "api-aggregation-observed"), "expected KEDA ConfigHub OCI/API aggregation observation row");
  check(maintainedExtraRows.some((row) => row.chart === "prometheus-community/prometheus-adapter" && row.coverage_status === "target-api-version-blocked"), "expected Prometheus Adapter target API-version blocked maintained row");
  check(aggregationRows.length === 2, `expected exactly two API aggregation availability rows; found ${aggregationRows.length}`);
  for (const row of aggregationRows) {
    check(row.api_condition_observed === "yes", `${row.chart}@${row.source_version} aggregation row missing APIService condition evidence`);
    check(row.aggregated_query_observed === "yes", `${row.chart}@${row.source_version} aggregation row missing aggregated API query evidence`);
    check(row.freshness_observed === "yes", `${row.chart}@${row.source_version} aggregation row missing freshness evidence`);
    check(row.aggregation_receipt && receiptExists(row.aggregation_receipt), `${row.chart}@${row.source_version} aggregation row missing receipt path`);
    check(row.contract_gaps === "none", `${row.chart}@${row.source_version} aggregation row has unresolved contract gap: ${row.contract_gaps}`);
  }

  const workOrders = workOrdersFor(rows, maintainedExtraRows);

  check(workOrders.length === rows.length + maintainedExtraRows.length, `expected one APIService work order per source row plus maintained extra row; found ${workOrders.length}`);
  check(workOrders[0]?.chart === "kedacore/keda", "expected KEDA as first APIService proof-wave work order");

  return {
    rows,
    workOrders,
    outputs: {
      csv: toCsv(rows),
      maintainedCsv: toCsv(maintainedRows),
      summary: summaryMarkdown(rows, workOrders, maintainedRows, maintainedExtraRows),
      workOrdersCsv: toCsv(workOrders),
      workOrdersMd: workOrdersMarkdown(workOrders),
    },
  };
}

function rowFor(source, review, quirk, localTriageByRef) {
  const ref = `${source.chart}@${source.version}`;
  const receipts = knownReceipts[ref] ?? {};
  const targetBlock = localTriageByRef.get(ref);
  const renderedApiService = renderedApiServiceEvidence(review?.recipe_path);
  const local = receiptExists(receipts.localObservation) && observationHasPassCheck(receipts.localObservation, "apiservice-");
  const objectSet = receiptExists(receipts.objectSet) && objectSetHasAPIService(receipts.objectSet);
  const workload = receiptExists(receipts.workload) && receiptVerdict(receipts.workload) === "PASS";
  const liveParity = receiptExists(receipts.liveParity);
  const kindParity = (receipts.kindParity ?? []).filter(receiptExists);
  const runtimeGitOpsEvidence = runtimeGitOpsAggregationEvidence(receipts.runtimeGitOps);
  const runtimeGitOpsAggregation = runtimeGitOpsEvidence.contract === "pass";
  const runtimeGitOpsWorkload = runtimeGitOpsEvidence.workload === "yes";
  const kindParityEvidence = kindParityAggregationEvidence(kindParity);
  const kindParityAggregation = kindParityEvidence.contract === "pass";
  const apiAggregation = runtimeGitOpsAggregation || kindParityAggregation;
  const hasRecipe = Boolean(review?.recipe_path);
  const coverageStatus = coverageStatusFor({
    hasRecipe,
    local,
    objectSet,
    workload,
    liveParity,
    kindParity,
    runtimeGitOpsAggregation,
    kindParityAggregation,
    targetBlock,
    renderedApiServiceCount: renderedApiService.count,
  });
  const contract = contractFor({
    hasRecipe,
    objectObserved: renderedApiService.count > 0 || objectSet || local || runtimeGitOpsAggregation,
    workloadObserved: workload || runtimeGitOpsWorkload,
    runtimeGitOpsEvidence,
    kindParityEvidence,
    apiAggregation,
    renderedApiServiceCount: renderedApiService.count,
  });
  return {
    rank: source.rank,
    chart: source.chart,
    source_version: source.version,
    api_service_count: String(source.apiServices ?? ""),
    rendered_api_service_count: String(renderedApiService.count),
    catalog_status: review?.catalog_status ?? "not-in-modeled-top100",
    proof_surface: review?.proof_surface ?? "",
    modeled_version: review?.version ?? "",
    coverage_status: coverageStatus,
    api_object_observed: objectSet || local || runtimeGitOpsAggregation ? "yes" : "no",
    workload_observed: workload || runtimeGitOpsWorkload ? "yes" : "no",
    live_parity_observed: liveParity ? "yes" : "no",
    two_cluster_parity_observed: kindParity.length > 0 ? "yes" : "no",
    api_aggregation_observed: apiAggregation ? "yes" : "no",
    api_aggregation_evidence: runtimeGitOpsAggregation ? "runtime-gitops" : kindParityAggregation ? "two-cluster-kind" : "",
    aggregation_receipt: contract.receipt,
    api_condition_observed: contract.condition,
    aggregated_query_observed: contract.query,
    freshness_observed: contract.freshness,
    contract_gaps: contract.gaps,
    evidence: evidenceFor({ review, quirk, receipts, kindParity }),
    evidence_recipe_path: review?.recipe_path ?? "",
    rendered_api_service_evidence: renderedApiService.evidence,
    target_block_route: targetBlock?.route_class ?? "",
    target_block_receipt: targetBlock?.receipt ?? "",
    next_action: nextActionFor({ ref, hasRecipe, coverageStatus }),
    limitation: "APIService object evidence is not the same as Kubernetes API aggregation availability. Close this with an explicit Available=True or aggregated API query receipt.",
  };
}

function contractFor({ hasRecipe, objectObserved, workloadObserved, runtimeGitOpsEvidence, kindParityEvidence, apiAggregation, renderedApiServiceCount }) {
  const best = runtimeGitOpsEvidence.contract === "pass" ? runtimeGitOpsEvidence : kindParityEvidence.contract === "pass" ? kindParityEvidence : null;
  if (best) {
    return {
      receipt: best.path,
      condition: best.condition,
      query: best.query,
      freshness: best.freshness,
      gaps: "none",
    };
  }
  const gaps = [];
  if (!hasRecipe) gaps.push("no maintained recipe/import row");
  if (hasRecipe && renderedApiServiceCount === 0) gaps.push("source APIService templates not rendered by maintained bases");
  if (!objectObserved) gaps.push("no rendered APIService object observation");
  if (renderedApiServiceCount > 0 && !workloadObserved) gaps.push("no backing workload observation");
  if (renderedApiServiceCount > 0 && !apiAggregation) gaps.push("no APIService Available=True plus aggregated API query receipt");
  return {
    receipt: "",
    condition: "no",
    query: "no",
    freshness: "no",
    gaps: gaps.join("; "),
  };
}

function coverageStatusFor({ hasRecipe, local, objectSet, workload, liveParity, kindParity, runtimeGitOpsAggregation, kindParityAggregation, targetBlock, renderedApiServiceCount }) {
  if (runtimeGitOpsAggregation && hasRecipe && kindParity.length > 0) return "api-aggregation-observed";
  if (kindParityAggregation && hasRecipe && kindParity.length > 0) return "two-cluster-api-aggregation-observed";
  if (local && objectSet && workload && liveParity && kindParity.length > 0) return "object-and-workload-observed";
  if (hasRecipe && kindParity.length > 0) return "two-cluster-parity-only";
  if (hasRecipe && targetBlock?.route_class === "api-version-unsupported") return "target-api-version-blocked";
  if (hasRecipe && renderedApiServiceCount === 0) return "source-signal-not-rendered-in-maintained-bases";
  if (hasRecipe) return "modeled-needs-runtime-observation";
  return "source-detected-needs-recipe";
}

function nextActionFor({ ref, hasRecipe, coverageStatus }) {
  if (ref === "metrics-server/metrics-server@3.13.0") {
    return "keep the runtime/GitOps APIService receipt fresh; use this pattern for the next APIService chart";
  }
  if (ref === "kedacore/keda@2.19.0" && coverageStatus === "api-aggregation-observed") {
    return "decide whether KEDA enters a catalog promotion wave using the two-cluster parity and ConfigHub OCI APIService receipts";
  }
  if (coverageStatus === "two-cluster-parity-only") {
    return "add local/APIService observation and aggregated API availability receipt before catalog promotion or stronger runtime claims";
  }
  if (coverageStatus === "two-cluster-api-aggregation-observed") {
    return "use the two-cluster API aggregation receipt to decide promotion scope, then add ConfigHub OCI/GitOps evidence if promoting";
  }
  if (coverageStatus === "target-api-version-blocked") {
    return "choose a supported chart version, compatibility base, or target Kubernetes profile before rerunning live APIService observation";
  }
  if (coverageStatus === "source-signal-not-rendered-in-maintained-bases") {
    return "record which values or subcharts would render APIService objects before requiring runtime aggregation evidence";
  }
  if (hasRecipe) {
    return "add runtime APIService observation route and aggregated API availability receipt for the selected base";
  }
  return "create recipe/import candidate, then model APIService readiness and aggregation observation before catalog claims";
}

function evidenceFor({ review, quirk, receipts, kindParity }) {
  return [
    "data/top500-catalog-analysis/source/source-feature-scan.raw.json",
    quirk ? "data/quirk-work-queue/top100-queue.csv" : "",
    review?.recipe_path,
    receipts.localObservation,
    receipts.objectSet,
    receipts.workload,
    receipts.liveParity,
    receipts.runtimeGitOps,
    ...kindParity,
  ].filter(Boolean).join(";");
}

function workOrdersFor(rows, maintainedExtraRows) {
  const orders = rows
    .concat(maintainedExtraRows)
    .map((row) => workOrderFor(row))
    .sort((left, right) => Number(left.priority) - Number(right.priority));
  return orders;
}

function workOrderFor(row) {
  const ref = `${row.chart}@${row.source_version}`;
  if (ref === "kedacore/keda@2.19.0") {
    return {
      priority: 1,
      chart: row.chart,
      version: row.source_version,
      current_state: row.coverage_status,
      work_type: "catalog-promotion-decision",
      owner_hint: "catalog-review",
      first_task: "decide whether KEDA enters a catalog promotion wave using the two-cluster parity and ConfigHub OCI APIService receipts",
      receipts_to_add: "production disposition and support decision if selected as catalog-supported",
      done_when: "KEDA has either a target-scoped production/support decision or a named reason to stay proof-grade",
      evidence: row.evidence,
    };
  }
  if (ref === "metrics-server/metrics-server@3.13.0") {
    return {
      priority: 8,
      chart: row.chart,
      version: row.source_version,
      current_state: row.coverage_status,
      work_type: "keep-fresh-pattern",
      owner_hint: "support-lane",
      first_task: "keep the Metrics Server runtime/GitOps aggregation receipt fresh and reuse its checks as the next chart pattern",
      receipts_to_add: "fresh runtime/GitOps receipt when chart, base, cluster profile, or controller changes",
      done_when: "existing api-aggregation-observed row remains fresh and reproducible",
      evidence: row.evidence,
    };
  }
  if (ref === "bitnami/metrics-server@7.4.12") {
    return {
      priority: 5,
      chart: row.chart,
      version: row.source_version,
      current_state: row.coverage_status,
      work_type: "duplicate-chart-decision",
      owner_hint: "catalog-review",
      first_task: "decide whether Bitnami Metrics Server should be imported separately or routed to the existing upstream Metrics Server catalog entry",
      receipts_to_add: "recipe/import candidate if supported separately; otherwise a catalog refusal/routing note",
      done_when: "the row is either modeled with APIService readiness or intentionally refused as a duplicate package route",
      evidence: row.evidence,
    };
  }
  if (ref === "k8s-dashboard/kubernetes-dashboard@7.14.0") {
    return {
      priority: 2,
      chart: row.chart,
      version: row.source_version,
      current_state: row.coverage_status,
      work_type: "recipe-import-plus-runtime-proof",
      owner_hint: "catalog-import",
      first_task: "create the recipe/import candidate, then add APIService readiness and runtime aggregation checks",
      receipts_to_add: "source lock; dependency lock; base render receipt; APIService object/workload receipts; APIService Available=True or dashboard API query receipt",
      done_when: "the chart has a maintained recipe row plus a pass/watch/refused aggregation receipt",
      evidence: row.evidence,
    };
  }
  if (row.coverage_status === "target-api-version-blocked") {
    return {
      priority: 3,
      chart: row.chart,
      version: row.source_version,
      current_state: row.coverage_status,
      work_type: "target-compatibility-decision",
      owner_hint: "catalog-review",
      first_task: "choose a supported chart version, compatibility base, or target Kubernetes profile before rerunning live APIService observation",
      receipts_to_add: "target compatibility decision; rerun local/APIService observation if a compatible target or base is selected",
      done_when: "the chart has either a compatible live APIService observation or a named unsupported-target decision",
      evidence: row.evidence,
    };
  }
  if (row.coverage_status === "source-signal-not-rendered-in-maintained-bases") {
    return {
      priority: 6,
      chart: row.chart,
      version: row.source_version,
      current_state: row.coverage_status,
      work_type: "render-path-analysis",
      owner_hint: "catalog-review",
      first_task: "record which values or subcharts would render APIService objects before requiring runtime aggregation evidence",
      receipts_to_add: "render-path note or values-path receipt showing whether the APIService source signal is reachable from supported bases",
      done_when: "the source APIService signal is either tied to a supported base with runtime evidence, or recorded as not rendered for maintained bases",
      evidence: row.evidence,
    };
  }
  return {
    priority: 4,
    chart: row.chart,
    version: row.source_version,
    current_state: row.coverage_status,
    work_type: "recipe-import-plus-runtime-proof",
    owner_hint: "catalog-import",
    first_task: "create the recipe/import candidate, then add APIService readiness and runtime aggregation checks",
    receipts_to_add: "source lock; dependency lock; base render receipt; APIService object/workload receipts; APIService Available=True or target-specific API query receipt",
    done_when: "the chart has a maintained recipe row plus a pass/watch/refused aggregation receipt",
    evidence: row.evidence,
  };
}

function summaryMarkdown(rows, workOrders, maintainedRows, maintainedExtraRows) {
  const counts = countBy(rows, (row) => row.coverage_status);
  const catalogRows = rows.filter((row) => row.catalog_status === "catalog-supported");
  const sourceOnlyRows = rows.filter((row) => row.coverage_status === "source-detected-needs-recipe");
  const objectWorkloadRows = rows.filter((row) => row.api_object_observed === "yes" && row.workload_observed === "yes");
  const aggregationRows = rows.filter((row) => row.api_aggregation_observed === "yes");
  const maintainedCounts = countBy(maintainedRows, (row) => row.coverage_status);
  const activeWorkOrders = workOrders.filter((row) => row.work_type !== "keep-fresh-pattern");
  const statusRows = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return `# Top-100 APIService Coverage

This generated report joins the source-scan APIService signal to maintained
recipe/package rows and committed runtime evidence.

APIService objects need a stricter runtime contract than ordinary rendered
objects. The desired object can match while Kubernetes API aggregation, CA
trust, or backing service readiness still fails. This report therefore keeps
four facts separate:

~~~text
rendered APIService object observed
backing workload observed
Helm-vs-ConfigHub live parity observed
aggregated API availability observed
~~~

## Current Reading

~~~text
source top-100 APIService rows:          ${rows.length}
maintained APIService recipe rows:       ${maintainedRows.length}
maintained rows outside source top-100:  ${maintainedExtraRows.length}
catalog-supported APIService rows:       ${catalogRows.length}
rows with API aggregation observation:   ${aggregationRows.length}
rows with object/workload observation:   ${objectWorkloadRows.length}
rows with two-cluster parity only:       ${rows.filter((row) => row.coverage_status === "two-cluster-parity-only").length}
rows still source-detected only:         ${sourceOnlyRows.length}
aggregated API availability receipts:    ${aggregationRows.length}
active proof/import work orders:          ${activeWorkOrders.length}
~~~

Only rows with both an \`Available=True\` APIService condition and a successful
aggregated API query receipt claim aggregated API availability. Today that
evidence exists for Metrics Server and KEDA.

## Coverage Status

| Status | Rows |
| --- | ---: |
${statusRows.map(([status, count]) => `| \`${status}\` | ${count} |`).join("\n")}

## Source Top-100 Rows

| Rank | Chart | Source version | Status | Object observed | Workload observed | Live parity | Aggregation observed | Next action |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.rank} | \`${row.chart}\` | ${row.source_version} | \`${row.coverage_status}\` | ${row.api_object_observed} | ${row.workload_observed} | ${row.live_parity_observed} | ${row.api_aggregation_observed} | ${escapePipes(row.next_action)} |`).join("\n")}

## Maintained APIService Rows

This appendix includes maintained recipe/package rows with APIService source
signals even when the source chart sits outside the source top-100 slice. It
keeps target compatibility blockers visible without changing the source-top-100
counts above.

| Rank | Chart | Source version | Rendered APIService objects | Status | ConfigHub proof | Target block | Next action |
| ---: | --- | --- | ---: | --- | --- | --- | --- |
${maintainedRows.map((row) => `| ${row.rank} | \`${row.chart}\` | ${row.source_version} | ${row.rendered_api_service_count} | \`${row.coverage_status}\` | ${receiptExists(knownReceipts[`${row.chart}@${row.source_version}`]?.configHubProof) ? "yes" : "no"} | ${row.target_block_route ? `\`${row.target_block_route}\`` : "-"} | ${escapePipes(row.next_action)} |`).join("\n")}

Maintained status counts:

| Status | Rows |
| --- | ---: |
${[...maintainedCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([status, count]) => `| \`${status}\` | ${count} |`).join("\n")}

## Runtime Contract

APIService rows become trusted runtime evidence only when one committed receipt
records all of these facts for the selected chart/base:

| Fact | Why it matters |
| --- | --- |
| rendered APIService object observed | proves the desired aggregation object is present in the object set |
| backing workload observed | proves the APIService has a real server behind it |
| APIService \`Available=True\` observed | proves Kubernetes API aggregation accepted the route and trust chain |
| aggregated API query observed | proves a client can use the aggregated API, not only read the object |
| freshness timestamp recorded | lets support decide whether the observation is still usable |

Current contract rows:

| Chart | Receipt | Condition | Query | Freshness | Gaps |
| --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.source_version}\` | ${row.aggregation_receipt ? `\`${row.aggregation_receipt}\`` : "-"} | ${row.api_condition_observed} | ${row.aggregated_query_observed} | ${row.freshness_observed} | ${escapePipes(row.contract_gaps)} |`).join("\n")}

## How To Use This

- \`api-aggregation-observed\` means committed runtime evidence records both
  APIService \`Available=True\` and a successful aggregated API query.
- \`object-and-workload-observed\` means the APIService object and backing
  workload were observed in committed receipts. It is still not an aggregated
  API availability claim.
- \`two-cluster-parity-only\` means regular Helm and \`cub installer\` reached
  live semantic parity, but there is no dedicated APIService observation.
- \`modeled-needs-runtime-observation\` means recipe proof exists, but runtime
  APIService evidence is missing.
- \`source-signal-not-rendered-in-maintained-bases\` means the source scan found
  APIService templates, but the maintained recipe bases do not render APIService
  objects. Runtime aggregation evidence is not owed until a base enables that
  path.
- \`source-detected-needs-recipe\` means the source scan found an APIService,
  but the chart is not yet a maintained recipe/package row.

## Files

| File | Purpose |
| --- | --- |
| \`top100-apiservice-coverage.csv\` | One row per source top-100 chart that renders APIService objects. |
| \`maintained-apiservice-coverage.csv\` | Maintained recipe/package rows with APIService source signals, including rows outside the source top-100 slice. |
| \`work-orders.md\` | Human next-proof queue for APIService charts. |
| \`work-orders.csv\` | Spreadsheet-ready next-proof queue for assignment and reruns. |
| \`data/quirk-work-queue/top100-queue.csv\` | Source quirk queue that currently carries the APIService hard gap. |
| \`runs/top20-local-kind/metrics-server-default/observation-receipt.json\` | Metrics Server object/workload observation evidence. |
| \`data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml\` | Metrics Server APIService Available=True and \`kubectl top nodes\` evidence. |
| \`data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml\` | KEDA ConfigHub OCI/Argo runtime evidence: workloads ready, APIService Available=True, and aggregated API query pass. |
| \`runs/live-kind-parity/*/receipt.yaml\` | Two-cluster Helm-vs-\`cub installer\` parity evidence. |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
`;
}

function workOrdersMarkdown(rows) {
  return `# APIService Proof Work Orders

This generated queue turns the APIService coverage report into assignable
proof work. APIService rows are high value because a rendered object can match
regular Helm while Kubernetes API aggregation still fails after apply.

## Work Queue

| Priority | Chart | Version | Current state | Work type | First task | Done when |
| ---: | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.priority} | \`${row.chart}\` | ${row.version} | \`${row.current_state}\` | \`${row.work_type}\` | ${escapePipes(row.first_task)} | ${escapePipes(row.done_when)} |`).join("\n")}

## Receipt Contract

For a row to become \`api-aggregation-observed\`, it needs committed evidence
for the selected chart/base:

~~~text
rendered APIService object observed
backing workload observed
APIService Available=True observed
aggregated API query or target-specific equivalent observed
freshness timestamp recorded
~~~

KEDA now has both two-cluster parity and ConfigHub OCI/Argo API aggregation
evidence. Its next question is product scope: whether to promote it to a
catalog-supported entry for a named target profile, or keep it proof-grade.
Kubernetes Dashboard, Datadog, and Bitnami Metrics Server need import/catalog
decisions before a runtime aggregation receipt can close the gap. Prometheus
Adapter has a maintained recipe and ConfigHub proof, but the tested target does
not serve the rendered APIService version. Goldilocks and VPA have source
APIService signals, but the maintained bases do not render APIService objects;
those rows need render-path analysis before a runtime aggregation test is owed.

## Files

| File | Purpose |
| --- | --- |
| \`top100-apiservice-coverage.csv\` | Current APIService state per top-100 source row. |
| \`work-orders.csv\` | Same queue in spreadsheet form. |
| \`data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml\` | Existing Metrics Server pattern receipt. |
| \`data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml\` | KEDA ConfigHub OCI/Argo APIService receipt. |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
`;
}

function receiptExists(path) {
  return Boolean(path) && existsSync(join(repoRoot, path));
}

function renderedApiServiceEvidence(recipePath) {
  if (!recipePath) return { count: 0, evidence: "" };
  const recipeRoot = join(repoRoot, dirname(recipePath));
  const revisionRoot = join(recipeRoot, "revisions");
  if (!existsSync(revisionRoot)) return { count: 0, evidence: "" };
  const variants = readDirNames(revisionRoot);
  let count = 0;
  const evidence = [];
  for (const variant of variants) {
    const inventoryPath = join(revisionRoot, variant, "r001", "rendered", "object-inventory.yaml");
    if (!existsSync(inventoryPath)) continue;
    const inventory = readYaml(inventoryPath);
    const objects = inventory.spec?.objects ?? inventory.objects ?? [];
    const apiObjects = objects.filter((object) =>
      object.kind === "APIService" ||
      String(object.identity ?? "").includes("|APIService|") ||
      String(object.apiVersion ?? "").startsWith("apiregistration.k8s.io/")
    );
    count += apiObjects.length;
    if (apiObjects.length > 0) evidence.push(relativeRepo(inventoryPath));
  }
  return { count, evidence: evidence.join(";") };
}

function readDirNames(path) {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function observationHasPassCheck(path, prefix) {
  if (!receiptExists(path)) return false;
  const receipt = JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  return (receipt.spec?.checks ?? []).some((checkItem) => checkItem.result === "pass" && String(checkItem.name ?? "").startsWith(prefix));
}

function objectSetHasAPIService(path) {
  if (!receiptExists(path)) return false;
  const receipt = JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  return (receipt.predicate?.evidence?.objectSet?.objects ?? []).some((object) =>
    object.status === "matched" && object.id?.kind === "APIService"
  );
}

function receiptVerdict(path) {
  if (!receiptExists(path)) return "";
  const receipt = JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  return String(receipt.predicate?.verdict ?? "");
}

function runtimeGitOpsAggregationEvidence(path) {
  if (!receiptExists(path)) return evidenceResult({ path });
  const receipt = readYaml(join(repoRoot, path));
  const apiServiceAvailable = receipt.spec?.runtime?.apiService?.available === true;
  const metricsApiPass = (receipt.spec?.checks ?? []).some((checkItem) => checkItem.name === "metrics-api" && checkItem.result === "pass");
  const aggregatedApiPass = receipt.spec?.runtime?.aggregatedApiQuery?.result === "pass" ||
    (receipt.spec?.checks ?? []).some((checkItem) => checkItem.name === "aggregated-api-query" && checkItem.result === "pass");
  const observedAt = Boolean(receipt.spec?.observedAt);
  const resultPass = receipt.spec?.result === "pass";
  return evidenceResult({
    path,
    condition: apiServiceAvailable,
    query: metricsApiPass || aggregatedApiPass,
    freshness: observedAt,
    workload: runtimeGitOpsHasWorkload(path),
    contract: resultPass && apiServiceAvailable && (metricsApiPass || aggregatedApiPass) && observedAt,
  });
}

function runtimeGitOpsHasWorkload(path) {
  if (!receiptExists(path)) return false;
  const receipt = readYaml(join(repoRoot, path));
  if (receipt.spec?.runtime?.deployment?.ready) return true;
  return (receipt.spec?.runtime?.deployments ?? []).some((deployment) =>
    Number(deployment.readyReplicas ?? 0) > 0 && Number(deployment.replicas ?? 0) > 0
  );
}

function kindParityAggregationEvidence(paths) {
  const usable = paths.filter(receiptExists);
  if (usable.length === 0) return evidenceResult({});
  for (const path of usable) {
    const receipt = readYaml(join(repoRoot, path));
    const helmItems = receipt.spec?.legs?.regularHelm?.runtime?.apiServices?.items ?? [];
    const installerItems = receipt.spec?.legs?.cubInstallerApply?.runtime?.apiServices?.items ?? [];
    const itemsPass = [helmItems, installerItems].every((items) =>
      items.length > 0 && items.every((item) =>
        item.available === true &&
        item.conditionStatus === "True" &&
        item.queryResult === "pass" &&
        /^[a-f0-9]{64}$/.test(item.querySHA256 ?? "")
      )
    );
    const observedAt = Boolean(receipt.spec?.observedAt ?? receipt.spec?.run?.observedAt);
    if (receipt.spec?.result === "pass" && itemsPass && observedAt) {
      return evidenceResult({
        path,
        condition: true,
        query: true,
        freshness: true,
        workload: true,
        contract: true,
      });
    }
  }
  return evidenceResult({ path: usable[0] });
}

function evidenceResult({ path = "", condition = false, query = false, freshness = false, workload = false, contract = false }) {
  return {
    path,
    condition: condition ? "yes" : "no",
    query: query ? "yes" : "no",
    freshness: freshness ? "yes" : "no",
    workload: workload ? "yes" : "no",
    contract: contract ? "pass" : "missing",
  };
}

function parseCsvFile(path) {
  const full = join(repoRoot, path);
  const text = readFileSync(full, "utf8").trim();
  if (!text) return [];
  const rows = parseCsv(text);
  const headers = rows[0] ?? [];
  return rows.slice(1).map((cols) => Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (quote) {
      if (ch === "\"" && text[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (ch === "\"") {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === "\"") {
      quote = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function countBy(rows, keyFn) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}
