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
  html: join(outputRoot, "matrix.html"),
};

const SOURCES = {
  outcomes: "data/outcome-coverage/base-outcomes.csv",
  readiness: "data/top100-readiness/readiness.csv",
  hooks: "data/hook-disposition/top100-hook-dispositions.csv",
  decisions: "data/production-support-decisions/decisions.csv",
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
    carried: "hook count, disposition, live status",
    dropped: "hook_phases, selected_route detail, evidence_status text, next_action, evidence paths, rank",
  },
  {
    source: "production-support-decisions/decisions.csv",
    carried: "decision, target scope",
    dropped: "delivery_path, image/scan/lifecycle/target-fact/live-evidence sub-decisions, evidence_count, remaining_final_requirements, next_action",
  },
];

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.matrix, report.csv);
  write(outputs.summary, report.summary);
  write(outputs.html, report.html);
  console.log(`wrote master catalog matrix -> ${relativeRepo(outputRoot)}/ (${report.rows.length} variant rows)`);
} else if (mode === "--verify") {
  const report = buildReport();
  const expected = { summary: report.summary, matrix: report.csv, html: report.html };
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run master-matrix`);
    check(readFileSync(path, "utf8") === expected[name], `${relativeRepo(path)} is stale; run npm run master-matrix`);
  }
  console.log(`verified master catalog matrix: ${report.rows.length} variant rows, ${report.charts} chart versions`);
} else {
  console.log(`Usage:
  node scripts/generate-master-catalog-matrix.mjs --generate
  node scripts/generate-master-catalog-matrix.mjs --verify`);
}

function buildReport() {
  const outcomes = readCsv(SOURCES.outcomes);
  const readiness = indexBy(readCsv(SOURCES.readiness), (row) => row.chart);
  const hookRows = readCsv(SOURCES.hooks);
  const hooksExact = indexBy(hookRows, (row) => `${row.chart}@${row.version}`);
  const hooksByChart = indexBy(hookRows, (row) => row.chart);
  const decisions = indexBy(readCsv(SOURCES.decisions), (row) => `${row.chart}|${row.version}|${row.supported_base}`);

  const rows = outcomes
    .map((outcome) => {
      const chartAtVersion = outcome.chart;
      const at = chartAtVersion.lastIndexOf("@");
      check(at > 0, `base-outcomes chart ${chartAtVersion} is not in name@version form`);
      const chartName = chartAtVersion.slice(0, at);
      const version = chartAtVersion.slice(at + 1);
      const variant = outcome.base;
      const ready = readiness.get(chartAtVersion);
      // Hook evidence joins by exact chart@version when available; otherwise
      // it falls back to the chart family's disposition row and SAYS SO via
      // hook_evidence_version — family evidence must not read as evidence
      // for this exact version.
      const hookExact = hooksExact.get(chartAtVersion);
      const hookFamily = hooksByChart.get(chartName);
      const hook = hookExact ?? hookFamily;
      const hookEvidenceVersion = hookExact || !hook ? "" : hook.version;
      const decision = decisions.get(`${chartName}|${version}|${variant}`);
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
        ...Object.fromEntries(LANE_COLUMNS.map(([target, source]) => [target, normalizeLane(outcome[source])])),
        lane_two_cluster_kind: normalizeLane(outcome.two_cluster_kind_parity),
        core_lanes_complete: outcome.complete_core_lane_set === "yes" ? "yes" : "no",
        outcome_level: outcome.outcome_level ?? "",
        production_decision: decision ? (decision.decision === "supported" ? "yes" : decision.decision === "rejected" ? "no" : decision.decision) : "todo",
        production_target_scope: decision?.target_scope ?? "",
        recipe_path: outcome.recipe_path,
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
    html: htmlReport(rows, charts, unmatchedReadiness),
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
  const laneCells = rows.flatMap((row) => [...LANE_COLUMNS.map(([target]) => row[target]), row.lane_two_cluster_kind]).filter(Boolean);
  const counts = {
    yes: laneCells.filter((value) => value === "yes").length,
    watch: laneCells.filter((value) => value === "watch").length,
    no: laneCells.filter((value) => value === "no").length,
    todo: laneCells.filter((value) => value === "todo").length,
  };
  const complete = rows.filter((row) => row.core_lanes_complete === "yes").length;
  const supported = rows.filter((row) => row.production_decision === "yes").length;
  const superseded = rows.filter((row) => row.production_decision === "superseded").length;
  const rejected = rows.filter((row) => row.production_decision === "no").length;
  const unrouted = rows.filter((row) => row.hook_disposition === "unrouted").length;

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
      const quirks = row.quirk_features ? `\`${row.quirk_features}\`` : "—";
      return `| ${chartCell} | ${row.variant} | ${tierShort(row.catalog_tier)} | ${quirks} | ${hooks} | ${icon(row.lane_render_parity)} | ${icon(row.lane_confighub_scan_ops)} | ${icon(row.lane_local_kind)} | ${icon(row.lane_gitops_oci_live)} | ${icon(row.lane_live_dual_parity)} | ${icon(row.lane_two_cluster_kind)} | ${row.outcome_level || "—"} | ${icon(row.production_decision)} |`;
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
| — | not applicable |

Lane columns: **R** render parity (helm template vs installer setup) ·
**C** ConfigHub upload + scan + safe ops · **L** local kind apply ·
**G** ConfigHub OCI + Argo live · **P** live Helm-vs-ConfigHub dual parity ·
**K** two-cluster kind parity.
Hooks column: source hook count, disposition route, live-rehearsal status.
\`unrouted ⚠️\` marks a chart whose source scan flags hooks but that has no
hook-disposition row yet; \`(from @x.y.z)\` marks chart-family evidence taken
from a different chart version's disposition row.

## Current Status

| Metric | Value |
| --- | ---: |
| Chart versions | ${charts} |
| Variant rows | ${rows.length} |
| Lane cells ✅ / ⚠️ / ❌ / ⬜ | ${counts.yes} / ${counts.watch} / ${counts.no} / ${counts.todo} |
| Variants with the complete core lane set | ${complete} |
| Variants with a SUPPORTED production decision | ${supported} |
| Recorded production decisions (supported / superseded / rejected) | ${supported} / ${superseded} / ${rejected} |
| Hook-flagged variants with no disposition row (unrouted) | ${unrouted} |

${unmatchedReadiness.length ? `Chart versions in the lane matrix but not in top-100 readiness (retained candidates or version drift): ${unmatchedReadiness.map((chart) => `\`${chart}\``).join(", ")}.\n` : ""}
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

The CSV additionally carries adoption bucket, hard gap, strongest evidence,
next action, and production target scope as columns; the table below omits
them for width.

## Matrix

| Chart | Variant | Tier | Quirks | Hooks | R | C | L | G | P | K | Outcome | Prod |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${table}

## Regenerate

~~~sh
npm run master-matrix
npm run master-matrix:verify
~~~
`;
}

function htmlReport(rows, charts, unmatchedReadiness) {
  const laneCells = rows.flatMap((row) => [...LANE_COLUMNS.map(([target]) => row[target]), row.lane_two_cluster_kind]).filter(Boolean);
  const counts = {
    yes: laneCells.filter((value) => value === "yes").length,
    watch: laneCells.filter((value) => value === "watch").length,
    no: laneCells.filter((value) => value === "no").length,
    todo: laneCells.filter((value) => value === "todo").length,
  };
  const supported = rows.filter((row) => row.production_decision === "yes").length;
  const superseded = rows.filter((row) => row.production_decision === "superseded").length;
  const rejected = rows.filter((row) => row.production_decision === "no").length;
  const unrouted = rows.filter((row) => row.hook_disposition === "unrouted").length;

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
      const nextAction = row.next_action ? `<td class="note" title="${escapeHtml(row.next_action)}">${escapeHtml(row.next_action.length > 70 ? `${row.next_action.slice(0, 67)}...` : row.next_action)}</td>` : `<td class="note"></td>`;
      return `<tr${first ? ' class="grp"' : ""}><td class="chart">${first ? escapeHtml(chartAtVersion) : ""}</td><td>${escapeHtml(row.variant)}</td><td>${escapeHtml(tierShort(row.catalog_tier))}</td><td class="note" title="${escapeHtml(row.quirk_features)}${row.hard_gap ? ` | hard gap: ${escapeHtml(row.hard_gap)}` : ""}">${escapeHtml(row.quirk_features)}</td>${hooks}${statusCell(row.lane_render_parity)}${statusCell(row.lane_confighub_scan_ops)}${statusCell(row.lane_local_kind)}${statusCell(row.lane_gitops_oci_live)}${statusCell(row.lane_live_dual_parity)}${statusCell(row.lane_two_cluster_kind)}<td>${escapeHtml(row.outcome_level || "–")}</td>${statusCell(row.production_decision, row.production_target_scope || "")}${nextAction}</tr>`;
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
.y{background:#1e8e3e;color:#fff}
.w{background:#f9ab00;color:#202124}
.n{background:#d93025;color:#fff}
.t{background:#e8eaed;color:#5f6368}
.na{background:#fff;color:#9aa0a6}
</style>
</head>
<body>
<h1>Master Catalog Matrix</h1>
<p class="sub">${charts} chart versions · ${rows.length} variant rows · lane cells: ${counts.yes} pass / ${counts.watch} watch / ${counts.no} blocked / ${counts.todo} not yet run · production decisions: ${supported} supported / ${superseded} superseded / ${rejected} rejected · ${unrouted} hook-flagged variants unrouted (U). Generated from committed sources by scripts/generate-master-catalog-matrix.mjs; regenerate with <code>npm run master-matrix</code>.</p>
<p class="chips"><span class="y">✓ pass</span><span class="w">! watch</span><span class="n">✗ blocked/failed</span><span class="t">· not yet run</span><span class="na">– n/a</span></p>
<p class="sub">Lanes: R render parity · C ConfigHub upload+scan+ops · L local kind apply · G OCI+Argo live · P live dual parity · K two-cluster kind parity. Hover cells for detail (hooks, quirks, production target scope, next action). Hooks: U = source scan flags hooks but no disposition row yet; family evidence from another chart version is named in the tooltip.${unmatchedReadiness.length ? ` Not in top-100 readiness (candidates/version drift): ${unmatchedReadiness.map(escapeHtml).join(", ")}.` : ""}</p>
<table>
<thead><tr><th>Chart</th><th>Variant</th><th>Tier</th><th>Quirks</th><th>Hooks</th><th>R</th><th>C</th><th>L</th><th>G</th><th>P</th><th>K</th><th>Outcome</th><th>Prod</th><th>Next action</th></tr></thead>
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
