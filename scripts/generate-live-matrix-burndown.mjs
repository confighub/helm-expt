#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "live-matrix-burndown");
const csvPath = join(outDir, "work-items.csv");
const summaryPath = join(outDir, "summary.md");

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, toCsv(report.workItems));
  write(summaryPath, summary(report));
  console.log(`wrote live matrix burn-down: ${report.workItems.length} work item(s)`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), "data/live-matrix-burndown/work-items.csv is missing; run npm run live-matrix:burndown");
  check(existsSync(summaryPath), "data/live-matrix-burndown/summary.md is missing; run npm run live-matrix:burndown");
  check(readFileSync(csvPath, "utf8") === toCsv(report.workItems), "data/live-matrix-burndown/work-items.csv is stale; run npm run live-matrix:burndown");
  check(readFileSync(summaryPath, "utf8") === summary(report), "data/live-matrix-burndown/summary.md is stale; run npm run live-matrix:burndown");
  console.log(`verified live matrix burn-down: ${report.workItems.length} work item(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-live-matrix-burndown.mjs --generate
  node scripts/generate-live-matrix-burndown.mjs --verify`);
}

function buildReport() {
  const rows = readCsv("data/master-catalog-matrix/matrix.csv");
  const activeReruns = activeRerunMap();
  const workItems = [];
  for (const row of rows) {
    const liveState = laneState([row.lane_gitops_oci_live, row.lane_live_dual_parity]);
    if (liveState.needsWork) workItems.push(liveParityWorkItem(row, liveState, activeReruns));
    const kindState = laneState([row.lane_two_cluster_kind]);
    if (kindState.needsWork) workItems.push(kindParityWorkItem(row, kindState, activeReruns));
  }
  workItems.sort(compareWorkItems);
  const counts = countBy(workItems, "work_type");
  const byStatus = countBy(workItems, "current_status");
  const byTier = countBy(workItems, "catalog_tier");
  const byReadiness = countBy(workItems, "run_readiness");
  const rowsNeedingAny = new Set(workItems.map((item) => item.row_key)).size;
  return { rows, workItems, counts, byStatus, byTier, byReadiness, rowsNeedingAny };
}

function liveParityWorkItem(row, state, activeReruns) {
  const active = activeReruns.get(rerunKey(row, "configHub-oci-live-comparison")) ?? {};
  const hasActiveRerun = Boolean(active.current_result || active.reason || active.rerun_command);
  const activeReason = hasActiveRerun ? active.reason || "" : "";
  const currentStatus = hasActiveRerun ? active.current_result || state.status : state.status;
  return {
    priority: priorityFor(row, "live-parity", { ...state, status: currentStatus }),
    work_type: "live-parity",
    current_status: currentStatus,
    lane_cells: active.current_result ? `G=${active.current_result};P=${active.current_result}` : `G=${row.lane_gitops_oci_live};P=${row.lane_live_dual_parity}`,
    chart: row.chart,
    version: row.version,
    base: row.variant,
    catalog_tier: row.catalog_tier || "uncategorized",
    adoption_bucket: row.adoption_bucket,
    outcome_level: row.outcome_level,
    core_lanes_complete: row.core_lanes_complete,
    production_decision: row.production_decision,
    run_readiness: hasActiveRerun && active.rerun_readiness
      ? active.rerun_readiness
      : (currentStatus === "watch" || currentStatus === "blocked" ? "review-target-first" : "ready-to-run"),
    reason: activeReason || reasonForMissing("GitOps/OCI live and live Helm-vs-ConfigHub parity", state.status),
    next_step: hasActiveRerun && active.next_step_type
      ? active.next_step_type
      : (currentStatus === "watch" ? "review-watch-receipt" : currentStatus === "blocked" ? "review-blocked-receipt" : "run-live-parity"),
    command: hasActiveRerun && active.rerun_command ? active.rerun_command : `npm run live-parity:run -- --recipe ${row.recipe_path} --base ${row.variant}`,
    support_artifact: hasActiveRerun ? active.support_artifact || "" : "",
    receipt: hasActiveRerun ? active.receipt || "" : "",
    recipe_path: row.recipe_path,
    variant_path: row.variant_path,
    row_key: rowKey(row),
  };
}

function kindParityWorkItem(row, state, activeReruns) {
  const active = activeReruns.get(rerunKey(row, "two-cluster-kind-parity")) ?? {};
  const collision = kindReceiptCollision(row);
  if (collision) {
    return {
      priority: priorityFor(row, "kind-parity", { ...state, status: "blocked" }),
      work_type: "kind-parity",
      current_status: state.status,
      lane_cells: `K=${row.lane_two_cluster_kind}`,
      chart: row.chart,
      version: row.version,
      base: row.variant,
      catalog_tier: row.catalog_tier || "uncategorized",
      adoption_bucket: row.adoption_bucket,
      outcome_level: row.outcome_level,
      core_lanes_complete: row.core_lanes_complete,
      production_decision: row.production_decision,
      run_readiness: "model-or-stage-first",
      reason: `kind parity receipt path collision: ${collision.receiptPath} currently records ${collision.chart}@${collision.version}/${collision.base}`,
      next_step: "fix-kind-parity-receipt-slug-before-rerun",
      command: "",
      support_artifact: collision.receiptPath,
      receipt: collision.receiptPath,
      recipe_path: row.recipe_path,
      variant_path: row.variant_path,
      row_key: rowKey(row),
    };
  }
  const receiptPath = kindReceiptPath(row);
  const hasReceipt = existsSync(join(repoRoot, receiptPath));
  const currentStatus = active.current_result || state.status;
  return {
    priority: priorityFor(row, "kind-parity", { ...state, status: currentStatus }),
    work_type: "kind-parity",
    current_status: currentStatus,
    lane_cells: `K=${row.lane_two_cluster_kind}`,
    chart: row.chart,
    version: row.version,
    base: row.variant,
    catalog_tier: row.catalog_tier || "uncategorized",
    adoption_bucket: row.adoption_bucket,
    outcome_level: row.outcome_level,
    core_lanes_complete: row.core_lanes_complete,
    production_decision: row.production_decision,
    run_readiness: active.rerun_readiness || (currentStatus === "watch" || currentStatus === "blocked" ? "review-target-first" : "ready-to-run"),
    reason: active.reason || (currentStatus === "watch"
      ? "two-cluster kind parity watch row needs review"
      : currentStatus === "blocked"
        ? "two-cluster kind parity blocked or failed; inspect the recorded receipt before rerun"
        : "missing two-cluster kind parity receipt"),
    next_step: active.next_step_type || (currentStatus === "watch"
      ? "review-kind-parity-watch"
      : currentStatus === "blocked"
        ? "review-kind-parity-blocker"
        : "run-kind-parity"),
    command: currentStatus === "blocked" ? "" : `npm run kind-parity:run -- --recipe ${row.recipe_path} --base ${row.variant}`,
    support_artifact: active.support_artifact || (hasReceipt ? receiptPath : ""),
    receipt: active.receipt || (hasReceipt ? receiptPath : ""),
    recipe_path: row.recipe_path,
    variant_path: row.variant_path,
    row_key: rowKey(row),
  };
}

function kindReceiptCollision(row) {
  const receiptPath = kindReceiptPath(row);
  if (!existsSync(join(repoRoot, receiptPath))) return null;
  const receipt = readYaml(join(repoRoot, receiptPath));
  const spec = receipt?.spec ?? {};
  if (spec.chart === row.chart && spec.version === row.version && spec.base === row.variant) return null;
  return {
    receiptPath,
    chart: spec.chart || "unknown-chart",
    version: spec.version || "unknown-version",
    base: spec.base || "unknown-base",
  };
}

function kindReceiptPath(row) {
  return `runs/live-kind-parity/${row.chart.replaceAll("/", "-")}-${row.variant}/receipt.yaml`;
}

function priorityFor(row, workType, state) {
  if (state.status === "watch") return 10;
  if (row.catalog_tier === "top20-catalog-supported") return 20;
  if (workType === "live-parity" && row.lane_local_kind === "yes") return 25;
  if (row.adoption_bucket === "promote-after-review") return 30;
  if (row.core_lanes_complete !== "yes") return 40;
  return 50;
}

function laneState(values) {
  const relevant = values.filter((value) => value !== "n/a");
  if (relevant.length === 0 || relevant.every((value) => value === "yes")) return { needsWork: false, status: "pass" };
  if (relevant.includes("watch")) return { needsWork: true, status: "watch" };
  if (relevant.includes("blocked")) return { needsWork: true, status: "blocked" };
  if (relevant.includes("no")) return { needsWork: true, status: "blocked" };
  return { needsWork: true, status: "todo" };
}

function reasonForMissing(lane, status) {
  if (status === "watch") return `${lane} produced a watch receipt that needs review`;
  if (status === "blocked") return `${lane} is blocked by a recorded target, lifecycle, or infrastructure condition`;
  return `${lane} has no committed pass/watch receipt for this chart/base yet`;
}

function compareWorkItems(a, b) {
  return Number(a.priority) - Number(b.priority)
    || workOrder(a.work_type) - workOrder(b.work_type)
    || `${a.chart}@${a.version}/${a.base}`.localeCompare(`${b.chart}@${b.version}/${b.base}`);
}

function workOrder(value) {
  return value === "live-parity" ? 0 : 1;
}

function rowKey(row) {
  return `${row.chart}@${row.version}/${row.variant}`;
}

function rerunKey(row, lane) {
  return `${lane}:${rowKey(row)}`;
}

function countBy(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const value = row[key] || "blank";
    result.set(value, (result.get(value) ?? 0) + 1);
  }
  return result;
}

function summary(report) {
  const live = report.workItems.filter((row) => row.work_type === "live-parity");
  const kind = report.workItems.filter((row) => row.work_type === "kind-parity");
  const reviewRows = report.workItems.filter((row) => row.current_status === "watch" || row.current_status === "blocked" || row.run_readiness !== "ready-to-run");
  const ready = report.workItems.filter((row) => row.run_readiness === "ready-to-run");
  const nextLive = report.workItems.filter((row) => row.work_type === "live-parity" && row.run_readiness === "ready-to-run").slice(0, 20);
  const activeReview = reviewRows.slice(0, 20);
  return `# Live Matrix Burn-Down

This generated queue answers a narrow operational question: how many live
commands remain before the live columns in the master matrix are green or
explicitly watch/blocked?

It uses [../master-catalog-matrix/matrix.csv](../master-catalog-matrix/matrix.csv)
as its spine and [../live-parity-rerun-plan/rerun-plan.csv](../live-parity-rerun-plan/rerun-plan.csv)
for active watch-row details. It does not create evidence, change any status,
or run Kubernetes. Run live commands serially.

Do not compare this command count directly with the 99% cell frontier. This
page is an execution queue: watch/review rows stay visible until reviewed, and
one \`live-parity\` command covers both the G and P cells in the master matrix.
For the cell-level completion count, use
[../disposition-frontier/summary.md](../disposition-frontier/summary.md).

## Current Count

| Metric | Rows |
| --- | ---: |
| Matrix variant rows | ${report.rows.length} |
| Variants needing at least one live command | ${report.rowsNeedingAny} |
| Live commands remaining | ${report.workItems.length} |
| GitOps/OCI + live Helm-vs-ConfigHub commands | ${live.length} |
| Two-cluster kind parity commands | ${kind.length} |
| Watch/blocked/review rows | ${reviewRows.length} |
| Ready-to-run todo rows | ${ready.length} |

## By Work Type

${tableFromMap(report.counts, "Work type")}

## By Current Status

${tableFromMap(report.byStatus, "Status")}

## By Run Readiness

${tableFromMap(report.byReadiness, "Readiness")}

Rows marked \`model-or-stage-first\` are not safe copy-paste commands yet. For
example, a two-cluster kind row may need a versioned receipt path before rerun
so it does not overwrite an existing receipt for a different chart version.

## Active Watch Or Blocked Rows

These rows already have live evidence. Review the support artifact before
rerunning; do not turn them green unless the new receipt proves the stronger
claim.

${table(activeReview, ["work_type", "chart", "version", "base", "lane_cells", "reason", "support_artifact", "receipt", "command"])}

## Next Ready Live-Parity Commands

These are the first non-watch GitOps/OCI + live Helm-vs-ConfigHub rows by the
generated priority. They are good candidates for a serial live block.

${table(nextLive, ["chart", "version", "base", "catalog_tier", "lane_cells", "command"])}

## Full Queue

The complete queue is [work-items.csv](work-items.csv). Each row is one command,
not one colored cell. A \`live-parity\` row exercises both G and P in the master
matrix. A \`kind-parity\` row exercises K.
`;
}

function tableFromMap(map, label) {
  const rows = [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return `| ${label} | Rows |
| --- | ---: |
${rows.map(([key, value]) => `| \`${escapeTable(key)}\` | ${value} |`).join("\n")}`;
}

function table(rows, columns) {
  if (rows.length === 0) return "_None._";
  return `| ${columns.map(title).join(" | ")} |
| ${columns.map(() => "---").join(" | ")} |
${rows.map((row) => `| ${columns.map((column) => cell(row[column])).join(" | ")} |`).join("\n")}`;
}

function title(value) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function cell(value) {
  const text = String(value ?? "");
  if (!text) return "";
  if (text.startsWith("data/") || text.startsWith("recipes/") || text.startsWith("runs/")) return `[${escapeTable(text)}](../../${escapeLink(text)})`;
  return escapeTable(text);
}

function escapeTable(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function escapeLink(value) {
  return String(value ?? "").replaceAll(")", "%29").replaceAll(" ", "%20");
}

function readCsv(relativePath) {
  const text = readFileSync(join(repoRoot, relativePath), "utf8");
  const rows = parseCsv(text);
  const headers = rows.shift() ?? [];
  return rows
    .filter((row) => row.length > 1 || (row[0] ?? "").trim() !== "")
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function activeRerunMap() {
  const path = join(repoRoot, "data", "live-parity-rerun-plan", "rerun-plan.csv");
  if (!existsSync(path)) return new Map();
  const rows = readCsv("data/live-parity-rerun-plan/rerun-plan.csv");
  return new Map(rows.map((row) => [`${row.lane}:${row.chart}@${row.version}/${row.base}`, row]));
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

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]).filter((header) => header !== "row_key");
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
