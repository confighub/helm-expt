#!/usr/bin/env node
// The master catalog matrix: ONE generated view of the whole catalog, one row
// per (chart, version, variant), joining the per-variant lane results with
// chart-level translation attributes (tier, adoption bucket, quirk features,
// hook disposition, production decision, outcome level). It invents no new
// truth — every cell is a join over committed sources, and the verifier fails
// when this view goes stale against them.
//
// Cell vocabulary (CSV words -> summary icons):
//   yes (pass)            -> green
//   watch                 -> needs attention, not a failure
//   no (blocked/failed)   -> red
//   todo (not yet run)    -> grey box: absence of evidence, not a failure
//   n/a                   -> dash: the attribute does not apply
//
//   node scripts/generate-master-catalog-matrix.mjs --generate
//   node scripts/generate-master-catalog-matrix.mjs --verify

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "master-catalog-matrix");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  matrix: join(outputRoot, "matrix.csv"),
};

const SOURCES = {
  lanes: "data/lane-test-matrix/variant-lanes.csv",
  outcomes: "data/outcome-coverage/base-outcomes.csv",
  readiness: "data/top100-readiness/readiness.csv",
  hooks: "data/hook-disposition/top100-hook-dispositions.csv",
  decisions: "data/production-support-decisions/decisions.csv",
};

const LANE_COLUMNS = [
  ["lane_render_parity", "helm_template_vs_installer_setup"],
  ["lane_confighub_scan_ops", "confighub_upload_variant_scan_safe_ops"],
  ["lane_local_kind", "local_kind_kubectl_apply"],
  ["lane_gitops_oci_live", "confighub_oci_argo_live"],
  ["lane_live_dual_parity", "live_helm_vs_confighub_dual_compare"],
];

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.matrix, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote master catalog matrix -> ${relativeRepo(outputRoot)}/ (${report.rows.length} variant rows)`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run master-matrix`);
    check(readFileSync(path, "utf8") === report[name === "matrix" ? "csv" : name], `${relativeRepo(path)} is stale; run npm run master-matrix`);
  }
  console.log(`verified master catalog matrix: ${report.rows.length} variant rows, ${report.charts} chart versions`);
} else {
  console.log(`Usage:
  node scripts/generate-master-catalog-matrix.mjs --generate
  node scripts/generate-master-catalog-matrix.mjs --verify`);
}

function buildReport() {
  const lanes = readCsv(SOURCES.lanes);
  const outcomes = indexBy(readCsv(SOURCES.outcomes), (row) => `${row.chart}|${row.base}`);
  const readiness = indexBy(readCsv(SOURCES.readiness), (row) => row.chart);
  const hooksByChart = indexBy(readCsv(SOURCES.hooks), (row) => row.chart);
  const decisions = indexBy(readCsv(SOURCES.decisions), (row) => `${row.chart}|${row.version}|${row.supported_base}`);

  const rows = lanes
    .map((lane) => {
      const chartAtVersion = `${lane.chart}@${lane.version}`;
      const ready = readiness.get(chartAtVersion);
      const hook = hooksByChart.get(lane.chart);
      const outcome = outcomes.get(`${chartAtVersion}|${lane.variant}`);
      const decision = decisions.get(`${lane.chart}|${lane.version}|${lane.variant}`);
      const hookCount = hook ? Number(hook.source_hook_count) : null;
      const row = {
        chart: lane.chart,
        version: lane.version,
        variant: lane.variant,
        catalog_tier: ready?.catalog_tier ?? "",
        adoption_bucket: ready?.adoption_bucket ?? "",
        quirk_features: ready?.source_features ?? "",
        hard_gap: ready?.hard_gap === "-" ? "" : (ready?.hard_gap ?? ""),
        hook_count: hook ? String(hookCount) : "",
        hook_disposition: hook ? (hookCount === 0 ? "n/a" : hook.disposition) : "",
        hook_live_status: hook && hookCount > 0 ? (hook.live_status === "observed" ? "yes" : hook.live_status === "none" ? "todo" : hook.live_status.startsWith("none (") ? "n/a" : "no") : hook ? "n/a" : "",
        ...Object.fromEntries(LANE_COLUMNS.map(([target, source]) => [target, normalizeLane(lane[source])])),
        core_lanes_complete: lane.complete_core_lane_set === "yes" ? "yes" : "no",
        outcome_level: outcome?.outcome_level ?? "",
        production_decision: decision ? (decision.decision === "supported" ? "yes" : decision.decision === "rejected" ? "no" : decision.decision) : "todo",
        recipe_path: lane.recipe_path,
      };
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
  };
}

function normalizeLane(value) {
  if (value === "pass") return "yes";
  if (value === "watch") return "watch";
  if (value === "blocked") return "no";
  if (value === "missing") return "todo";
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

function summary(rows, charts, unmatchedReadiness) {
  const laneCells = rows.flatMap((row) => LANE_COLUMNS.map(([target]) => row[target]));
  const counts = {
    yes: laneCells.filter((value) => value === "yes").length,
    watch: laneCells.filter((value) => value === "watch").length,
    no: laneCells.filter((value) => value === "no").length,
    todo: laneCells.filter((value) => value === "todo").length,
  };
  const complete = rows.filter((row) => row.core_lanes_complete === "yes").length;
  const supported = rows.filter((row) => row.production_decision === "yes").length;

  let lastChart = "";
  const table = rows
    .map((row) => {
      const chartAtVersion = `${row.chart}@${row.version}`;
      const chartCell = chartAtVersion === lastChart ? "" : `\`${chartAtVersion}\``;
      lastChart = chartAtVersion;
      const hooks = row.hook_count === "" ? "—" : row.hook_count === "0" ? "0 —" : `${row.hook_count} ${row.hook_disposition} ${icon(row.hook_live_status)}`;
      const quirks = row.quirk_features ? `\`${row.quirk_features}\`` : "—";
      return `| ${chartCell} | ${row.variant} | ${tierShort(row.catalog_tier)} | ${quirks} | ${hooks} | ${icon(row.lane_render_parity)} | ${icon(row.lane_confighub_scan_ops)} | ${icon(row.lane_local_kind)} | ${icon(row.lane_gitops_oci_live)} | ${icon(row.lane_live_dual_parity)} | ${row.outcome_level || "—"} | ${icon(row.production_decision)} |`;
    })
    .join("\n");

  return `# Master Catalog Matrix

ONE view of the whole catalog: one row per supported variant, grouped by chart
and version, with the translation attributes and per-lane status joined from
the committed sources below. This file invents no new truth — every cell comes
from a source the verifier checks this view against.

## Legend

| Icon | Meaning |
| --- | --- |
| ✅ | yes / pass |
| ⚠️ | watch — passing with a recorded caution |
| ❌ | no / blocked |
| ⬜ | not yet run — absence of evidence, not a failure |
| — | not applicable |

Lane columns: **R** render parity (helm template vs installer setup) ·
**C** ConfigHub upload + scan + safe ops · **L** local kind apply ·
**G** ConfigHub OCI + Argo live · **P** live Helm-vs-ConfigHub dual parity.
Hooks column: source hook count, disposition route, live-rehearsal status.

## Current Status

| Metric | Value |
| --- | ---: |
| Chart versions | ${charts} |
| Variant rows | ${rows.length} |
| Lane cells ✅ / ⚠️ / ❌ / ⬜ | ${counts.yes} / ${counts.watch} / ${counts.no} / ${counts.todo} |
| Variants with the complete core lane set | ${complete} |
| Variants with a recorded production support decision | ${supported} |

${unmatchedReadiness.length ? `Chart versions in the lane matrix but not in top-100 readiness (retained candidates or version drift): ${unmatchedReadiness.map((chart) => `\`${chart}\``).join(", ")}.\n` : ""}
## Sources joined

| Attribute | Source of truth |
| --- | --- |
| Variants and the five proof lanes | [lane-test-matrix](../lane-test-matrix/variant-lanes.csv) |
| Outcome level per variant | [outcome-coverage](../outcome-coverage/base-outcomes.csv) |
| Tier, adoption bucket, quirk features, hard gap | [top100-readiness](../top100-readiness/readiness.csv) |
| Hook count, disposition, live status | [hook-disposition](../hook-disposition/top100-hook-dispositions.csv) |
| Production support decision | [production-support-decisions](../production-support-decisions/decisions.csv) |

## Matrix

| Chart | Variant | Tier | Quirks | Hooks | R | C | L | G | P | Outcome | Prod |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${table}

## Regenerate

~~~sh
npm run master-matrix
npm run master-matrix:verify
~~~
`;
}

function tierShort(tier) {
  if (tier === "top20-catalog-supported") return "top20";
  if (tier === "next80-proof-grade") return "next80";
  return tier || "—";
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
