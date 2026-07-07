#!/usr/bin/env node

// Quirk work queue.
//
// This turns the source-vs-modeled quirk audit into chart-level work items.
// It is intentionally separate from data/quirk-review-queue/, which queues
// needs-operator-decision residue from maintained helm-pain-report.yaml files.
//
//   node scripts/generate-quirk-work-queue.mjs --generate
//   node scripts/generate-quirk-work-queue.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "quirk-work-queue");
const outputs = {
  csv: join(outDir, "top100-queue.csv"),
  summary: join(outDir, "summary.md"),
};

const QUIRKS = [
  {
    id: "apiservice",
    label: "APIService aggregation",
    risk: 5,
    detect: (row) => count(row.apiServices) > 0,
    sourceDetail: (row) => `${count(row.apiServices)} APIService object(s)`,
    firstAction: "add an APIService readiness model and runtime observation route",
    artifact: "chart facts axis plus lifecycle observation receipt",
    why: "APIService aggregation can pass render parity while failing at API aggregation or TLS/runtime readiness.",
  },
  {
    id: "remote-dependencies",
    label: "remote chart dependencies",
    risk: 5,
    detect: (row) => number(row.remoteDependencyRepos) > 0,
    sourceDetail: (row) => `${number(row.remoteDependencyRepos)} remote dependency repo(s)`,
    firstAction: "model remote dependency closure in chart facts and source/dependency lock evidence",
    artifact: "dependency closure facts plus refresh-survival check",
    why: "remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart.",
  },
  {
    id: "non-exact-dependencies",
    label: "non-exact dependency constraints",
    risk: 5,
    detect: (row) => number(row.nonExactDependencyConstraints) > 0,
    sourceDetail: (row) => `${number(row.nonExactDependencyConstraints)} non-exact dependency constraint(s)`,
    firstAction: "pin or explicitly accept dependency ranges and add refresh-survival evidence",
    artifact: "dependency policy row plus refresh-survival receipt",
    why: "non-exact dependency ranges can silently change the rendered dependency closure during refresh.",
  },
  {
    id: "hooks",
    label: "Helm hooks",
    risk: 5,
    detect: (row) => count(row.hooks) > 0,
    sourceDetail: (row) => `${count(row.hooks)} hook template(s): ${row.hookTypesText || "phase unknown"}`,
    firstAction: "choose a lifecycle route and commit a route or observation receipt",
    artifact: "hook lifecycle route receipt",
    why: "hooks are phaseful actions; render parity does not prove install, upgrade, delete, or test behavior.",
  },
  {
    id: "hook-delete-policy",
    label: "hook delete policy",
    risk: 4,
    detect: (row) => count(row.hookDeletePolicies) > 0,
    sourceDetail: (row) => `${count(row.hookDeletePolicies)} hook delete policy reference(s)`,
    firstAction: "record cleanup/rerun policy alongside the hook route",
    artifact: "hook lifecycle route receipt with cleanup policy",
    why: "delete policy affects reruns, cleanup, and rollback semantics.",
  },
  {
    id: "hook-weight-ordering",
    label: "hook weight/order",
    risk: 4,
    detect: (row) => count(row.hookWeights) > 0,
    sourceDetail: (row) => `${count(row.hookWeights)} hook weight reference(s)`,
    firstAction: "record ordering semantics and candidate sync-wave or managed-action route",
    artifact: "hook lifecycle route receipt with ordering policy",
    why: "hook weights encode ordering that may not map directly to ConfigHub or GitOps delivery.",
  },
  {
    id: "semver-compare",
    label: "semverCompare branching",
    risk: 4,
    detect: (row) => count(row.semverCompare) > 0,
    sourceDetail: (row) => `${count(row.semverCompare)} semverCompare call site(s)`,
    firstAction: "promote version-conditional rendering into chart facts and variant-path coverage",
    artifact: "chart facts axis plus capability/version matrix row",
    why: "version-conditional templates can change rendered objects under a different Kubernetes, chart, or dependency version.",
  },
  {
    id: "files-get",
    label: ".Files.Get bundled files",
    risk: 4,
    detect: (row) => count(row.filesGet) > 0,
    sourceDetail: (row) => `${count(row.filesGet)} .Files.Get call site(s)`,
    firstAction: "add bundled-file inventory to the source lock and value/provenance map",
    artifact: "source-lock bundled file index",
    why: "bundled files can drive rendered config while bypassing values and values schema.",
  },
  {
    id: "generated-facts",
    label: "generated/random/time/cert functions",
    risk: 4,
    detect: (row) => generatedCount(row) > 0,
    sourceDetail: (row) => `${generatedCount(row)} generated or nondeterministic signal(s)`,
    firstAction: "classify generated values as generated facts, target facts, or existing-secret bases",
    artifact: "generated-facts policy plus field reachability row",
    why: "random, time, certificate, and password functions can break deterministic review unless captured or replaced.",
  },
  {
    id: "lookup",
    label: "lookup target facts",
    risk: 4,
    detect: (row) => count(row.lookup) > 0,
    sourceDetail: (row) => `${count(row.lookup)} lookup call site(s)`,
    firstAction: "turn lookup dependencies into target facts or preflight checks",
    artifact: "target-fact requirement plus preflight receipt",
    why: "lookup makes rendered output depend on live cluster state unless facts are captured explicitly.",
  },
  {
    id: "capabilities",
    label: "Kubernetes capability branching",
    risk: 4,
    detect: (row) => count(row.capabilitiesKubeVersion) + count(row.capabilitiesAPIs) > 0,
    sourceDetail: (row) => `${count(row.capabilitiesKubeVersion)} kubeVersion and ${count(row.capabilitiesAPIs)} apiVersions branch(es)`,
    firstAction: "bind the render to named capability profiles and test the important alternate profile",
    artifact: "capability profile matrix row",
    why: "capability branches can render different objects across Kubernetes versions and API availability.",
  },
  {
    id: "required-or-fail",
    label: "required/fail inputs",
    risk: 3,
    detect: (row) => count(row.requiredOrFail) > 0,
    sourceDetail: (row) => `${count(row.requiredOrFail)} required/fail call site(s)`,
    firstAction: "promote required inputs into typed prompts, placeholders, or supported base choices",
    artifact: "input contract row",
    why: "required()/fail() blocks mean the happy path depends on values that should be explicit to users and agents.",
  },
  {
    id: "webhooks",
    label: "admission webhooks",
    risk: 3,
    detect: (row) => number(row.validatingWebhooks) + number(row.mutatingWebhooks) > 0,
    sourceDetail: (row) => `${number(row.validatingWebhooks) + number(row.mutatingWebhooks)} webhook object(s)`,
    firstAction: "add webhook readiness and CA/admission observation where the chart is promoted",
    artifact: "webhook lifecycle observation receipt",
    why: "webhooks can render correctly but fail admission, TLS, or readiness after apply.",
  },
  {
    id: "crds",
    label: "CRDs",
    risk: 3,
    detect: (row) => number(row.crdFiles) > 0,
    sourceDetail: (row) => `${number(row.crdFiles)} CRD file(s)`,
    firstAction: "separate CRD install from CRD upgrade policy and record the supported route",
    artifact: "CRD lifecycle policy row",
    why: "CRD install can be simple while CRD upgrade, conversion, and pruning remain operator-reviewed.",
  },
  {
    id: "stateful-storage",
    label: "stateful storage",
    risk: 3,
    detect: (row) => number(row.statefulSets) + number(row.persistentVolumeClaims) + number(row.storageClasses) > 0,
    sourceDetail: (row) => `${number(row.statefulSets)} StatefulSet(s), ${number(row.persistentVolumeClaims)} PVC(s), ${number(row.storageClasses)} StorageClass(es)`,
    firstAction: "record storage prerequisite, retention, and runtime binding checks for supported targets",
    artifact: "target-scoped storage support decision",
    why: "stateful charts need target-specific storage proof beyond object render parity.",
  },
];

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote ${relativeRepo(outputs.csv)}`);
  console.log(`wrote ${relativeRepo(outputs.summary)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run quirk-work-queue`);
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run quirk-work-queue`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run quirk-work-queue`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run quirk-work-queue`);
  console.log(`verified quirk work queue for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-quirk-work-queue.mjs --generate
  node scripts/generate-quirk-work-queue.mjs --verify`);
}

function buildReport() {
  const sourceRows = JSON.parse(readFileSync(join(repoRoot, "data/top500-catalog-analysis/source/source-feature-scan.raw.json"), "utf8"))
    .filter((row) => row.scanStatus === "scanned" && number(row.rank) <= 100)
    .sort((a, b) => number(a.rank) - number(b.rank));
  const auditRows = parseCsvFile("data/quirk-inventory-audit/top100-source-vs-modeled.csv");
  const hookReviewRows = parseCsvFile("data/hook-lifecycle-review/top100-source-hook-route-review.csv");
  const hookCandidateRows = parseCsvFile("data/hook-route-candidates/candidates.csv");
  const modeledRows = parseCsvFile("data/top100-catalog-analysis/review.csv");
  const modeledByChart = new Map(modeledRows.map((row) => [row.chart, row]));
  const hookReviewByChart = new Map(hookReviewRows.map((row) => [row.chart, row]));
  const hookCandidateByChart = new Map(hookCandidateRows.map((row) => [row.chart, row]));
  const auditByQuirk = new Map(auditRows.map((row) => [row.quirk, row]));

  const rows = sourceRows
    .map((source) => chartWorkItem(source, {
      modeled: modeledByChart.get(source.chart),
      hookReview: hookReviewByChart.get(source.chart),
      hookCandidate: hookCandidateFor(source, hookCandidateByChart),
      auditByQuirk,
    }))
    .filter((row) => row.open_quirks)
    .sort((a, b) => number(b.priority_score) - number(a.priority_score) || number(a.source_rank) - number(b.source_rank) || a.chart.localeCompare(b.chart));

  return {
    rows,
    csv: toCsv(rows),
    summary: toSummary(rows, auditRows),
  };
}

function chartWorkItem(source, context) {
  const signals = QUIRKS
    .filter((quirk) => quirk.detect(source))
    .map((quirk) => ({ ...quirk, detail: quirk.sourceDetail(source), audit: auditFor(quirk.id, context.auditByQuirk) }));
  const top = signals[0] ? signals.reduce((best, item) => item.risk > best.risk ? item : best, signals[0]) : null;
  const leverage = leverageScore(source);
  const priorityScore = signals.reduce((sum, item) => sum + item.risk, 0) + leverage;
  const priority = priorityScore >= 38 || signals.some((item) => ["apiservice", "remote-dependencies", "non-exact-dependencies", "hooks"].includes(item.id) && item.risk >= 5) ? "P0"
    : priorityScore >= 24 ? "P1"
      : "P2";
  const hookReview = context.hookReview;
  const hookCandidate = context.hookCandidate;
  const modeled = context.modeled;
  const firstAction = top
    ? top.id === "hooks" && hookReview?.next_action
      ? hookReview.next_action
      : top.firstAction
    : "";
  return {
    priority,
    priority_score: String(priorityScore),
    source_rank: String(source.rank),
    chart: source.chart,
    source_version: source.version,
    modeled_version: modeled?.version ?? "",
    catalog_status: modeled?.catalog_status ?? "not-in-modeled-top100",
    proof_surface: modeled?.proof_surface ?? "",
    open_quirks: signals.map((item) => item.id).join(";"),
    top_quirk: top?.id ?? "",
    top_quirk_detail: top?.detail ?? "",
    candidate_route: hookCandidate?.candidate_route ?? "",
    candidate_route_artifact: hookCandidate ? "data/hook-route-candidates/summary.md" : "",
    first_action: firstAction,
    next_artifact: top?.artifact ?? "",
    why_it_matters: top?.why ?? "",
    source_evidence: evidenceFor(source, signals),
    model_gap: modelGap(signals),
  };
}

function hookCandidateFor(source, hookCandidateByChart) {
  const direct = hookCandidateByChart.get(source.chart);
  if (direct) return direct;
  if (source.chart === "bitnami/thanos") return hookCandidateByChart.get("bitnami/minio") ?? null;
  return null;
}

function auditFor(quirkId, auditByQuirk) {
  const key = {
    "hook-delete-policy": "hook delete policies",
    "hook-weight-ordering": "hook weights",
    "generated-facts": "generated/random/time/cert functions",
    "capabilities": "capabilities",
    "required-or-fail": "required/fail",
    "files-get": ".Files.Get",
    "semver-compare": "semverCompare",
    "install-vs-upgrade": "install-vs-upgrade branching",
    "remote-dependencies": "remote dependencies",
    "non-exact-dependencies": "non-exact dependencies",
    "stateful-storage": "stateful storage",
    "apiservice": "APIService",
    "webhooks": "webhooks",
    "crds": "CRDs",
    "lookup": "lookup",
    "hooks": "hooks",
    "tpl": "tpl",
  }[quirkId] ?? quirkId;
  return auditByQuirk.get(key) ?? null;
}

function modelGap(signals) {
  const unmodeled = signals
    .filter((signal) => /not tracked|none|undercount|inconsistency/i.test(`${signal.audit?.modeled_catalog_count ?? ""} ${signal.audit?.risk_note ?? ""}`))
    .map((signal) => signal.id);
  if (unmodeled.length > 0) return `source signal not fully modeled: ${unmodeled.join(";")}`;
  if (signals.length > 0) return "source signal modeled or partly modeled; proof may still be profile-bound";
  return "";
}

function evidenceFor(source, signals) {
  const examples = [];
  for (const signal of signals.slice(0, 4)) {
    if (signal.id === "hooks") examples.push(...listExamples(source.hooks));
    else if (signal.id === "lookup") examples.push(...listExamples(source.lookup));
    else if (signal.id === "semver-compare") examples.push(...listExamples(source.semverCompare));
    else if (signal.id === "files-get") examples.push(...listExamples(source.filesGet));
    else if (signal.id === "generated-facts") examples.push(...listExamples(source.randFuncs), ...listExamples(source.certFuncs), ...listExamples(source.timeUuidFuncs));
  }
  return examples.slice(0, 4).join(";");
}

function toSummary(rows, auditRows) {
  const byPriority = countBy(rows, "priority");
  const byTopQuirk = countBy(rows, "top_quirk");
  const p0 = rows.filter((row) => row.priority === "P0").slice(0, 15);
  const candidateRows = rows.filter((row) => row.candidate_route);
  const topTable = p0.map((row) => `| ${row.priority} | ${row.source_rank} | \`${row.chart}@${row.source_version}\` | \`${row.top_quirk}\` | ${escapePipes(row.first_action)} |`).join("\n");
  const candidateTable = candidateRows
    .map((row) => `| ${row.priority} | \`${row.chart}@${row.source_version}\` | ${escapePipes(row.candidate_route)} | ${escapePipes(row.candidate_route_artifact)} |`)
    .join("\n");
  const quirkTable = [...byTopQuirk.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([quirk, countValue]) => `| \`${quirk}\` | ${countValue} |`)
    .join("\n");
  const auditGapTable = auditRows
    .filter((row) => /not tracked|undercount|inconsistency|overclaim|definitional drift/i.test(`${row.modeled_catalog_count} ${row.risk_note}`))
    .slice(0, 12)
    .map((row) => `| \`${row.quirk}\` | ${row.source_top100_count} | ${row.modeled_catalog_count} | ${escapePipes(row.risk_note)} |`)
    .join("\n");
  return `# Quirk Work Queue

This generated queue turns the source-vs-modeled quirk audit into chart-level
work items. It answers a different question from \`data/quirk-review-queue/\`:

~~~text
Which public top-100 charts should we improve first so source-scan quirks become
modeled, reviewable, and eventually provable?
~~~

The queue is not a support claim. It is a prioritized work list for closing
source-inventory gaps, model gaps, and proof gaps.

## Current Reading

~~~text
queued source top-100 charts: ${rows.length}
P0: ${byPriority.get("P0") ?? 0}
P1: ${byPriority.get("P1") ?? 0}
P2: ${byPriority.get("P2") ?? 0}
~~~

## Highest Priority Rows

| Priority | Source rank | Chart | Top quirk | First action |
| --- | ---: | --- | --- | --- |
${topTable}

## Hook Route Candidates Connected

These rows have source-scan hook signals and a candidate route plan. Candidate
routes are not receipts and do not claim runtime behavior; they are the next
step before admitting a chart to the maintained hook lifecycle queue.

| Priority | Chart | Candidate route | Candidate artifact |
| --- | --- | --- | --- |
${candidateTable || "| - | - | - | - |"}

## Top Quirk Driving Each Row

| Top quirk | Rows |
| --- | ---: |
${quirkTable}

## Audit Gaps Feeding This Queue

| Quirk | Source top-100 | Modeled count | Risk note |
| --- | ---: | --- | --- |
${auditGapTable}

## Files

| File | Purpose |
| --- | --- |
| \`top100-queue.csv\` | One chart-level work item per affected public top-100 source row. |
| \`data/hook-route-candidates/summary.md\` | Candidate hook route plans referenced by queue rows where available. |
| \`data/quirk-inventory-audit/top100-source-vs-modeled.csv\` | Source vs modeled vs proof counts that feed this queue. |
| \`data/top500-catalog-analysis/source/source-feature-scan.raw.json\` | Source-scan input. |

Regenerate:

~~~sh
npm run quirk-work-queue
npm run quirk-work-queue:verify
~~~
`;
}

function leverageScore(row) {
  const rank = number(row.rank);
  if (rank <= 10) return 12;
  if (rank <= 25) return 9;
  if (rank <= 50) return 6;
  if (rank <= 100) return 3;
  return 0;
}

function generatedCount(row) {
  return number(row.generatedFactsCount) + count(row.randFuncs) + count(row.certFuncs) + count(row.timeUuidFuncs) + count(row.hashPasswordFuncs);
}

function listExamples(value) {
  return Array.isArray(value?.examples) ? value.examples : [];
}

function count(value) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") return number(value.count);
  return number(value);
}

function number(value) {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countBy(rows, field) {
  const result = new Map();
  for (const row of rows) result.set(row[field], (result.get(row[field]) ?? 0) + 1);
  return result;
}

function toCsv(rows) {
  const headers = [
    "priority",
    "priority_score",
    "source_rank",
    "chart",
    "source_version",
    "modeled_version",
    "catalog_status",
    "proof_surface",
    "open_quirks",
    "top_quirk",
    "top_quirk_detail",
    "candidate_route",
    "candidate_route_artifact",
    "first_action",
    "next_artifact",
    "why_it_matters",
    "source_evidence",
    "model_gap",
  ];
  const lines = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","));
  return `${headers.join(",")}\n${lines.join("\n")}\n`;
}

function parseCsvFile(path) {
  const text = readFileSync(join(repoRoot, path), "utf8").trim();
  if (!text) return [];
  const rows = parseCsv(text);
  const headers = rows[0];
  return rows.slice(1).map((cols) => Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((items) => items.some((item) => item.length > 0));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}
