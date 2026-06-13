#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { check, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputDir = join(repoRoot, "data", "chart-evidence-router");
const csvPath = join(outputDir, "router.csv");
const summaryPath = join(outputDir, "summary.md");

const SOURCES = {
  userReadiness: "data/top100-user-readiness/readiness.csv",
  chartUseGuide: "data/chart-use-guide/chart-use-guide.csv",
  coverage: "data/top100-coverage/coverage.csv",
  baseOutcomes: "data/outcome-coverage/base-outcomes.csv",
  hooks: "data/hook-coverage/top100-hook-coverage.csv",
  quirks: "data/quirk-work-queue/top100-queue.csv",
  runtimeGitops: "data/runtime-gitops/receipt-index.csv",
  liveCompare: "data/live-helm-confighub-compare/summary.csv",
  gitopsHealthResidue: "data/gitops-health-residue/residue.csv",
  productionDecisions: "data/production-support-decisions/decisions.csv",
  top500: "data/top500-catalog-analysis/review.csv",
};

const OUTPUTS = {
  csv: "data/chart-evidence-router/router.csv",
  summary: "data/chart-evidence-router/summary.md",
};

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  console.log(`wrote ${OUTPUTS.csv} and ${OUTPUTS.summary}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), `${OUTPUTS.csv} is missing; run npm run chart:evidence-router`);
  check(existsSync(summaryPath), `${OUTPUTS.summary} is missing; run npm run chart:evidence-router`);
  check(readFileSync(csvPath, "utf8") === report.csv, `${OUTPUTS.csv} is stale; run npm run chart:evidence-router`);
  check(
    readFileSync(summaryPath, "utf8") === report.summary,
    `${OUTPUTS.summary} is stale; run npm run chart:evidence-router`,
  );
  check(report.rows.length === 100, `expected 100 top-100 router rows, derived ${report.rows.length}`);
  console.log(`verified chart evidence router (${report.rows.length} chart(s))`);
} else {
  console.error(`Usage:
  node scripts/generate-chart-evidence-router.mjs --generate
  node scripts/generate-chart-evidence-router.mjs --verify`);
  process.exit(1);
}

function buildReport() {
  const userRows = readCsv(SOURCES.userReadiness);
  const chartUse = mapBy(readCsv(SOURCES.chartUseGuide), "chart");
  const coverage = mapBy(readCsv(SOURCES.coverage), "chart_ref");
  const baseOutcomes = groupBy(readCsv(SOURCES.baseOutcomes), "chart");
  const hooks = mapBy(readCsv(SOURCES.hooks), "chart");
  const quirks = mapBy(readCsv(SOURCES.quirks), "chart");
  const runtimeGitops = groupBy(loadRuntimeGitopsRows(), (row) => chartKey(row.chart, row.version));
  const liveCompare = groupBy(readCsv(SOURCES.liveCompare), (row) => chartKey(row.chart, row.version));
  const gitopsHealthResidue = groupBy(readCsv(SOURCES.gitopsHealthResidue), (row) => chartKey(row.chart, row.version));
  const productionDecisions = groupBy(readCsv(SOURCES.productionDecisions), (row) => chartKey(row.chart, row.version));
  const top500 = top500Index(readCsv(SOURCES.top500));

  const rows = userRows
    .map((row) => {
      const key = chartKey(row.chart, row.version);
      const chartUseRow = chartUse.get(key);
      const coverageRow = coverage.get(key);
      const baseRows = baseOutcomes.get(key) ?? [];
      const hookRow = hooks.get(row.chart);
      const quirkRow = quirks.get(row.chart);
      const gitopsRows = runtimeGitops.get(key) ?? [];
      const liveRows = liveCompare.get(key) ?? [];
      const residueRows = gitopsHealthResidue.get(key) ?? [];
      const decisionRows = productionDecisions.get(key) ?? [];
      const top500Row = top500.get(key) ?? top500.get(row.chart);
      const firstBase = cleanBase(row.recommended_first_base || chartUseRow?.recommended_base_or_variant || "");
      return {
        rank: row.rank,
        chart: row.chart,
        version: row.version,
        user_status: row.bucket,
        chart_use_answer: chartUseRow?.answer ?? "",
        first_base: firstBase,
        catalog_path: chartUseRow?.catalog_path ?? "",
        current_proof: row.current_proof,
        proof_lane_rows: baseRows.map((item) => item.base).join(";") || "",
        proof_lane_summary: laneSummary(baseRows, gitopsRows),
        variant_revisions: joinPaths(baseRows.map((item) => item.variant_revision)),
        recipe_paths: joinPaths(baseRows.map((item) => item.recipe_path)),
        package_paths: joinPaths(baseRows.map((item) => item.package_path)),
        coverage_status: coverageRow?.coverage_status ?? "",
        coverage_evidence: coverageEvidence(coverageRow),
        hooks_route: hookRoute(hookRow),
        hooks_evidence: joinPaths([hookRow?.evidence]),
        quirks: row.quirks,
        quirk_route: quirkRoute(quirkRow),
        quirk_evidence: joinPaths([quirkRow?.candidate_route_artifact, quirkRow?.source_evidence]),
        runtime_gitops_results: runtimeGitopsSummary(gitopsRows),
        runtime_gitops_receipts: joinPaths(gitopsRows.map((item) => item.required_receipt)),
        gitops_health_residue: gitopsHealthResidueSummary(residueRows),
        gitops_health_residue_evidence: joinPaths(residueRows.flatMap((item) => [item.receipt, "data/gitops-health-residue/summary.md"])),
        live_compare_receipts: joinPaths(liveRows.map((item) => item.receipt)),
        production_decisions: productionDecisionSummary(decisionRows),
        production_decision_paths: joinPaths(decisionRows.map((item) => item.path)),
        top500_route: top500Route(top500Row),
        user_must_provide: row.user_must_provide,
        routed_or_absorbed: row.confighub_absorbs,
        next_action: row.next_action,
      };
    })
    .sort((a, b) => Number(a.rank) - Number(b.rank));

  const header = [
    "rank",
    "chart",
    "version",
    "user_status",
    "chart_use_answer",
    "first_base",
    "catalog_path",
    "current_proof",
    "proof_lane_rows",
    "proof_lane_summary",
    "variant_revisions",
    "recipe_paths",
    "package_paths",
    "coverage_status",
    "coverage_evidence",
    "hooks_route",
    "hooks_evidence",
    "quirks",
    "quirk_route",
    "quirk_evidence",
    "runtime_gitops_results",
    "runtime_gitops_receipts",
    "gitops_health_residue",
    "gitops_health_residue_evidence",
    "live_compare_receipts",
    "production_decisions",
    "production_decision_paths",
    "top500_route",
    "user_must_provide",
    "routed_or_absorbed",
    "next_action",
  ];
  return { rows, csv: toCsv(header, rows), summary: summaryMarkdown(rows) };
}

function summaryMarkdown(rows) {
  return `# Chart Evidence Router

Generated. Do not edit by hand.

~~~sh
npm run chart:evidence-router
npm run chart:evidence-router:verify
~~~

This is a per-chart routing index for the top-100 catalog corpus. It does not
define chart status. For status, use the linked source rows:

| Question | Source |
| --- | --- |
| Can a Helm user try this chart? | [../chart-use-guide/chart-use-guide.csv](../chart-use-guide/chart-use-guide.csv) |
| What works, what needs prerequisites, what needs operator review, and what is blocked? | [../top100-user-readiness/readiness.csv](../top100-user-readiness/readiness.csv) |
| Which chart/base proof lanes have receipts? | [../outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) |
| Which hooks or source quirks are routed? | [../hook-coverage/top100-hook-coverage.csv](../hook-coverage/top100-hook-coverage.csv), [../quirk-work-queue/top100-queue.csv](../quirk-work-queue/top100-queue.csv) |
| Which production decisions or live receipts exist? | [../production-support-decisions/decisions.csv](../production-support-decisions/decisions.csv), [../runtime-gitops/receipt-index.csv](../runtime-gitops/receipt-index.csv), [../live-helm-confighub-compare/summary.csv](../live-helm-confighub-compare/summary.csv), [../gitops-health-residue/summary.md](../gitops-health-residue/summary.md) |

Use [router.csv](./router.csv) when you know the chart name and need the
catalog path, base rows, variant revisions, receipts, hook route, quirk route,
and decision files in one place.

## Routes

| Chart | User status | First base | Evidence rows | Hooks and quirks | Decisions and receipts | Next action |
| --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => summaryRow(row)).join("\n")}
`;
}

function summaryRow(row) {
  return [
    chartCell(row),
    code(row.user_status),
    code(row.first_base || "-"),
    evidenceCell(row),
    hookQuirkCell(row),
    decisionReceiptCell(row),
    textCell(row.next_action || "-"),
  ].join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function chartCell(row) {
  const label = `${row.chart}@${row.version}`;
  if (row.catalog_path) return markdownLink(label, row.catalog_path);
  return code(label);
}

function evidenceCell(row) {
  const parts = [
    row.coverage_status ? `coverage ${code(row.coverage_status)}` : "",
    row.proof_lane_rows ? `bases ${code(row.proof_lane_rows)}` : "",
    pathLinks(row.variant_revisions, "variants"),
  ].filter(Boolean);
  return parts.join("<br>") || "-";
}

function hookQuirkCell(row) {
  const parts = [
    row.hooks_route ? `hooks ${code(row.hooks_route)}` : "",
    row.hooks_evidence ? pathLinks(row.hooks_evidence, "hook evidence") : "",
    row.quirks ? `quirks ${code(row.quirks)}` : "",
    row.quirk_route ? `route ${code(row.quirk_route)}` : "",
    row.quirk_evidence ? pathLinks(row.quirk_evidence, "quirk evidence") : "",
  ].filter(Boolean);
  return parts.join("<br>") || "-";
}

function decisionReceiptCell(row) {
  const parts = [
    row.production_decisions ? `production ${code(row.production_decisions)}` : "",
    row.production_decision_paths ? pathLinks(row.production_decision_paths, "decision") : "",
    row.runtime_gitops_results ? `GitOps ${code(row.runtime_gitops_results)}` : "",
    row.runtime_gitops_receipts ? pathLinks(row.runtime_gitops_receipts, "GitOps receipts") : "",
    row.gitops_health_residue ? `GitOps health ${code(row.gitops_health_residue)}` : "",
    row.gitops_health_residue_evidence ? pathLinks(row.gitops_health_residue_evidence, "health residue") : "",
    row.live_compare_receipts ? pathLinks(row.live_compare_receipts, "live compare") : "",
  ].filter(Boolean);
  return parts.join("<br>") || "-";
}

function laneSummary(rows, gitopsRows = []) {
  const runtimeByBase = new Map();
  for (const row of gitopsRows) {
    if (!row.base || !row.receipt_result) continue;
    if (!runtimeByBase.has(row.base)) runtimeByBase.set(row.base, []);
    runtimeByBase.get(row.base).push(row.receipt_result);
  }
  return rows
    .map((row) => {
      const runtimeResults = [...new Set(runtimeByBase.get(row.base) ?? [])];
      const gitopsStatus = runtimeResults.length
        ? `${row.gitops_oci_live}/runtime-${runtimeResults.join("+")}`
        : row.gitops_oci_live;
      return [
        row.base,
        `render=${row.render_parity}`,
        `confighub=${row.in_confighub}`,
        `local=${row.local_live}`,
        `gitops=${gitopsStatus}`,
        `live-parity=${row.live_helm_vs_confighub_parity}`,
        `two-cluster=${row.two_cluster_kind_parity}`,
      ].join(" ");
    })
    .join("; ");
}

function runtimeGitopsSummary(rows) {
  return rows
    .map((row) =>
      [row.base, row.controller, row.receipt_result || row.receipt_status]
        .filter(Boolean)
        .join(":"),
    )
    .join(";");
}

function gitopsHealthResidueSummary(rows) {
  return rows
    .map((row) => [row.base, row.classification].filter(Boolean).join(":"))
    .sort()
    .join(";");
}

function coverageEvidence(row) {
  if (!row) return "";
  return joinPaths([
    row.a_evidence,
    row.b_evidence,
    row.c_evidence,
    row.d_evidence,
    row.e_evidence,
    row.f_evidence,
    row.g_evidence,
    row.h_evidence,
  ]);
}

function hookRoute(row) {
  if (!row) return "";
  return [row.coverage_status, row.route_or_policy].filter(Boolean).join(": ");
}

function quirkRoute(row) {
  if (!row) return "";
  return [row.priority, row.first_action, row.next_artifact].filter(Boolean).join(": ");
}

function productionDecisionSummary(rows) {
  return rows
    .map((row) => [row.supported_base, row.decision, row.live_evidence_decision].filter(Boolean).join(":"))
    .join(";");
}

function top500Route(row) {
  if (!row) return "";
  return [
    row.rank ? `rank ${row.rank}` : "",
    row.catalog_status,
    row.proof_status,
    row.production_readiness,
    row.next_action,
  ]
    .filter(Boolean)
    .join(": ");
}

function top500Index(rows) {
  const result = new Map();
  for (const row of rows) {
    result.set(row.chart, row);
    if (row.current_recipe_version) result.set(chartKey(row.chart, row.current_recipe_version), row);
    if (row.source_version) result.set(chartKey(row.chart, row.source_version), row);
  }
  return result;
}

function loadRuntimeGitopsRows() {
  const indexedRows = readCsv(SOURCES.runtimeGitops).map((row) => ({
    ...row,
    evidence_source: "wave-index",
  }));
  const rows = [...indexedRows];
  const seen = new Set(rows.map(runtimeGitopsKey));
  for (const path of findFiles(join(repoRoot, "data", "runtime-gitops", "receipts"), "latest.yaml")) {
    const requiredReceipt = relative(repoRoot, path).replaceAll("\\", "/");
    const receipt = readYaml(path);
    const spec = receipt.spec ?? {};
    if (!spec.chart || !spec.version || !spec.base) continue;
    const row = {
      chart: spec.chart,
      version: spec.version,
      base: spec.base,
      controller: spec.controller ?? "",
      required_receipt: requiredReceipt,
      receipt_status: "present",
      receipt_result: spec.result ?? "",
      minimum_checks: "ConfigHub OCI artifact digest recorded;GitOps controller observed synced revision;Kubernetes runtime result recorded;freshness timestamp recorded",
      evidence_source: "receipt-scan",
    };
    const key = runtimeGitopsKey(row);
    if (!seen.has(key)) {
      rows.push(row);
      seen.add(key);
    }
  }
  return rows.sort((a, b) =>
    [a.chart, a.version, a.base, a.required_receipt].join("\0").localeCompare(
      [b.chart, b.version, b.base, b.required_receipt].join("\0"),
    ),
  );
}

function runtimeGitopsKey(row) {
  return [row.chart, row.version, row.base, row.required_receipt].join("\0");
}

function findFiles(dir, basename) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findFiles(path, basename));
    } else if (entry.isFile() && entry.name === basename) {
      found.push(path);
    }
  }
  return found.sort();
}

function cleanBase(value) {
  return String(value ?? "").replace(/ \(unreviewed first guess\)$/, "").trim();
}

function chartKey(chart, version) {
  return `${chart}@${version}`;
}

function mapBy(rows, key) {
  const get = typeof key === "function" ? key : (row) => row[key];
  return new Map(rows.map((row) => [get(row), row]));
}

function groupBy(rows, key) {
  const get = typeof key === "function" ? key : (row) => row[key];
  const result = new Map();
  for (const row of rows) {
    const value = get(row);
    if (!result.has(value)) result.set(value, []);
    result.get(value).push(row);
  }
  return result;
}

function joinPaths(values) {
  const paths = [];
  for (const value of values) {
    for (const part of String(value ?? "").split(";")) {
      const trimmed = part.trim();
      if (trimmed && trimmed !== "-") paths.push(trimmed);
    }
  }
  return [...new Set(paths)].join(";");
}

function pathLinks(value, label) {
  const paths = String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!paths.length) return "";
  if (paths.length === 1) return markdownLink(label, paths[0]);
  return paths.map((path, index) => markdownLink(`${label} ${index + 1}`, path)).join(", ");
}

function markdownLink(label, path) {
  if (!existsSync(join(repoRoot, path))) return code(label === path ? path : `${label}: ${path}`);
  return `[${escapeTable(label)}](${relativeFromRouter(path)})`;
}

function relativeFromRouter(path) {
  if (path.startsWith("data/")) return `../${path.slice("data/".length)}`;
  return `../../${path}`;
}

function code(value) {
  return `\`${escapeTable(value)}\``;
}

function textCell(value) {
  return escapeTable(value);
}

function escapeTable(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function readCsv(relativePath) {
  const text = readFileSync(join(repoRoot, relativePath), "utf8");
  const rows = parseCsv(text);
  const headers = rows.shift() ?? [];
  return rows
    .filter((row) => row.length > 1 || (row[0] ?? "").trim() !== "")
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
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
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toCsv(header, rows) {
  return [header.join(","), ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(","))].join("\n") + "\n";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
