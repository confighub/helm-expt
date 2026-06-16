#!/usr/bin/env node
// Disposition frontier: distance to the 99% bar, measured the way the
// next-execution-plan defines it — NOT "every cell green", but "every
// top-100 chart/base/lane cell carries a verified disposition"
// (pass/watch/blocked/refused/n-a; todo only as a temporary state that must
// name a next action). A bare `missing` cell is the only real gap.
//
// Granularity: chart@version x variant x lane cell (the master matrix's
// cells). Nearest existing view: data/master-catalog-matrix (shows the
// cells) and data/top100-coverage (chart-level coverage). This view adds
// the cell-level disposition accounting neither carries, overlays committed
// two-cluster kind parity receipts when they are newer than base-outcomes,
// and for every remaining `missing` cell DERIVES the honest disposition +
// next action by rule. Read-only over committed sources; it proposes, it
// does not mutate base-outcomes.
//
//   node scripts/generate-disposition-frontier.mjs --generate
//   node scripts/generate-disposition-frontier.mjs --verify

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "disposition-frontier");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  cells: join(outputRoot, "cells.csv"),
};

const SOURCE = "data/outcome-coverage/base-outcomes.csv";
const KIND_PARITY_SOURCE = "data/live-kind-parity/summary.csv";
const RUNS_DIR = join(repoRoot, "runs", "next80-local-kind");

// The six lanes, in the matrix's order. `live` lanes are the ones that
// require a converged workload on a real cluster, so they inherit a
// single-cluster local-live blocker as the same named prerequisite.
const LANES = [
  { key: "render_parity", label: "R", live: false },
  { key: "in_confighub", label: "C", live: false },
  { key: "local_live", label: "L", live: true },
  { key: "gitops_oci_live", label: "G", live: true },
  { key: "live_helm_vs_confighub_parity", label: "P", live: true },
  { key: "two_cluster_kind_parity", label: "K", live: true },
];

// A recorded value is already a verified disposition unless it is bare
// `missing`. (`watch` and `blocked` carry their own reasons in the source.)
const RECORDED_DISPOSITIONS = new Set(["pass", "watch", "blocked", "fail", "refused", "n/a"]);

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.cells, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote disposition frontier -> ${relativeRepo(outputRoot)}/ (${report.cells.length} cells, ${report.recordedPct}% recorded, ${report.coveredPct}% covered incl. derived)`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run disposition-frontier`);
    check(readFileSync(path, "utf8") === report[name === "cells" ? "csv" : name], `${relativeRepo(path)} is stale; run npm run disposition-frontier`);
  }
  console.log(`verified disposition frontier: ${report.cells.length} cells, disposition coverage ${report.coveredPct}% (recorded ${report.recordedPct}%), ${report.genuineTodo} genuine todo`);
} else {
  console.log(`Usage:
  node scripts/generate-disposition-frontier.mjs --generate
  node scripts/generate-disposition-frontier.mjs --verify`);
}

function buildReport() {
  const rows = readCsv(SOURCE);
  const kindParity = indexKindParity(readCsv(KIND_PARITY_SOURCE));
  const cells = [];
  for (const row of rows) {
    const localLive = row.local_live;
    const localReason = localLive === "blocked" || localLive === "fail" ? localLiveReason(row) : "";
    for (const lane of LANES) {
      const key = `${row.chart}|${row.base}`;
      const kindResult = lane.key === "two_cluster_kind_parity" ? kindParity.get(key)?.result : "";
      const recorded = kindResult || row[lane.key] || "";
      const cell = {
        chart: row.chart,
        variant: row.base,
        lane: lane.key,
        lane_label: lane.label,
        recorded,
        disposition: recorded,
        derived: "no",
        reason: "",
        next_action: "",
        owner: "",
      };
      const kindRow = kindResult ? kindParity.get(key) : null;
      if (kindRow) {
        cell.reason = kindRow.reason || kindRow.meaning || "";
        cell.owner = "kind-parity";
      }
      if (RECORDED_DISPOSITIONS.has(recorded)) {
        cells.push(cell);
        continue;
      }
      // recorded === "missing": derive the honest disposition.
      derive(cell, row, lane, localLive, localReason);
      cells.push(cell);
    }
  }

  const recorded = cells.filter((c) => RECORDED_DISPOSITIONS.has(c.recorded)).length;
  const covered = cells.filter((c) => c.disposition !== "missing" && c.disposition !== "todo").length;
  const genuineTodo = cells.filter((c) => c.disposition === "todo").length;
  const stillMissing = cells.filter((c) => c.disposition === "missing").length;

  return {
    cells,
    recordedPct: pct(recorded, cells.length),
    coveredPct: pct(covered, cells.length),
    genuineTodo,
    stillMissing,
    csv: toCsv(cells),
    summary: summary(cells, { recorded, covered, genuineTodo, stillMissing }),
  };
}

// derive turns a bare `missing` live-lane cell into the honest disposition,
// by propagating the same-row single-cluster signal: you cannot make a
// GitOps / dual-parity / two-cluster live claim for a row whose workload
// will not even converge on one cluster, so those cells are blocked by the
// SAME named prerequisite — not an un-dispositioned gap.
function derive(cell, row, lane, localLive, localReason) {
  if (lane.key === "in_confighub") {
    cell.derived = "yes";
    cell.disposition = "todo";
    cell.owner = "loop";
    cell.reason = "ConfigHub proof not yet recorded";
    cell.next_action = `run scripts/run-top20-confighub-proof.mjs for ${row.chart} ${row.base} (loop's bitnami/prometheus-community/elastic candidate pipeline)`;
    return;
  }
  if (lane.live && localLive === "blocked") {
    cell.derived = "yes";
    cell.disposition = "blocked";
    cell.reason = `upstream: single-cluster local live is blocked (${localReason || "named prerequisite"})`;
    cell.next_action = "resolve the local-live prerequisite first; the live lanes inherit it";
    cell.owner = "either";
    return;
  }
  if (lane.live && localLive === "fail") {
    cell.derived = "yes";
    cell.disposition = "blocked";
    cell.reason = "upstream: single-cluster local live failed; live lanes cannot make a green claim until it converges";
    cell.next_action = "fix or route the local-live failure first";
    cell.owner = "either";
    return;
  }
  if (lane.live && localLive === "pass") {
    cell.derived = "yes";
    cell.disposition = "todo";
    cell.reason = "single-cluster local live passes; this live lane is runnable but not yet recorded";
    cell.next_action =
      lane.key === "gitops_oci_live"
        ? "run the ConfigHub OCI/Argo live lane"
        : lane.key === "live_helm_vs_confighub_parity"
          ? "run scripts/run-top20-live-parity.mjs for this row"
          : "run the two-cluster kind parity lane";
    cell.owner = "either";
    return;
  }
  // Could not derive (e.g. local_live itself missing): leave as the honest
  // un-dispositioned gap so it is counted, never hidden.
  cell.disposition = "missing";
  cell.reason = "no recorded disposition and no rule applies yet";
  cell.next_action = "record this lane or declare it n/a/refused";
}

function localLiveReason(row) {
  const slug = `${row.chart.replace("@", "-").replaceAll("/", "-")}-${row.base}`;
  const receiptPath = join(RUNS_DIR, slug, "observation-receipt.yaml");
  if (!existsSync(receiptPath)) return "";
  const text = readFileSync(receiptPath, "utf8");
  if (/image-pull|ImagePull|ErrImage/.test(text)) return "image unavailable (registry purge)";
  if (/missing target facts|required CRD/.test(text)) return "missing target-fact prerequisite";
  if (/prerequisite-blocked/.test(text)) return "missing prerequisite (mount/secret/config)";
  return "recorded blocker";
}

function summary(cells, counts) {
  const total = cells.length;
  const byLane = LANES.map((lane) => {
    const laneCells = cells.filter((c) => c.lane === lane.key);
    const dispositioned = laneCells.filter((c) => c.disposition !== "missing" && c.disposition !== "todo").length;
    const todo = laneCells.filter((c) => c.disposition === "todo").length;
    const gap = laneCells.filter((c) => c.disposition === "missing").length;
    return `| ${lane.label} ${lane.key} | ${laneCells.length} | ${dispositioned} | ${todo} | ${gap} |`;
  }).join("\n");

  const todoByAction = new Map();
  for (const c of cells.filter((c) => c.disposition === "todo")) {
    const key = c.next_action;
    todoByAction.set(key, (todoByAction.get(key) ?? 0) + 1);
  }
  const todoTable = [...todoByAction.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([action, n]) => `| ${n} | ${action} |`)
    .join("\n");

  const derivedBlocked = cells.filter((c) => c.derived === "yes" && c.disposition === "blocked").length;

  return `# Disposition Frontier — distance to the 99% bar

The [next-execution-plan](../../docs/planning/next-execution-plan.md) defines
the 99% target as **every top-100 chart/base/lane cell carrying a verified
disposition** — pass, watch, blocked, refused, or n/a — with \`todo\` allowed
only as a temporary state that names a next action. "Every cell green" is
explicitly NOT the goal; a correct \`blocked\` or \`n/a\` is part of the
product because it tells a user where the proof stops.

This view scores that bar at the cell granularity the master matrix shows,
and for every bare \`missing\` cell **derives** the honest disposition by
rule (a live lane whose single-cluster local-live row is blocked inherits
the same named prerequisite — it is blocked, not un-dispositioned). It
proposes; it does not mutate \`base-outcomes\`. Nearest views:
[master-catalog-matrix](../master-catalog-matrix/summary.md) (the cells),
[top100-coverage](../top100-coverage/summary.md) (chart-level coverage).

## Headline

\`\`\`text
lane cells:                 ${total}
recorded disposition:       ${counts.recorded}  (${pct(counts.recorded, total)}%)
+ derived blocked:          ${derivedBlocked}
= verified disposition:     ${counts.covered}  (${pct(counts.covered, total)}%)
genuine todo (named next):  ${counts.genuineTodo}
un-dispositioned gap:       ${counts.stillMissing}
\`\`\`

**Distance to 99%:** ${counts.genuineTodo + counts.stillMissing} cells are not yet a
non-todo verified disposition (${pct(counts.genuineTodo + counts.stillMissing, total)}% of cells).
Every one carries a named next action below — none is a silent gap.

## By lane

| Lane | Cells | Verified disposition | Genuine todo | Un-dispositioned |
| --- | ---: | ---: | ---: | ---: |
${byLane}

## The work to 99%, by next action

Each genuine \`todo\` cell, grouped by what closes it.

| Cells | Next action |
| --- | --- |
${todoTable}

## Rules (so the derivation is auditable)

- A recorded \`pass\`/\`watch\`/\`blocked\`/\`fail\`/\`refused\`/\`n-a\` is already a verified disposition.
- A recorded two-cluster K receipt in \`data/live-kind-parity/summary.csv\` overrides the older aggregate \`base-outcomes\` K cell.
- A live lane (G/P/K) on a row whose \`local_live\` is **blocked** -> derived **blocked**, same named prerequisite (you cannot make a multi-cluster or GitOps live claim when one cluster will not converge).
- A live lane on a row whose \`local_live\` **failed** -> derived **blocked** on the upstream failure.
- A live lane on a row whose \`local_live\` **passes** -> genuine **todo**, runnable now, with the lane's run command as the next action.
- \`in_confighub\` missing -> **todo**, owner loop (the bitnami/prometheus-community/elastic candidate pipeline).

## Regenerate

~~~sh
npm run disposition-frontier
npm run disposition-frontier:verify
~~~
`;
}

function indexKindParity(rows) {
  const byKey = new Map();
  for (const row of rows) {
    if (!row.chart || !row.version || !row.base || !row.result) continue;
    byKey.set(`${row.chart}@${row.version}|${row.base}`, row);
  }
  return byKey;
}

function pct(n, total) {
  return total === 0 ? "0.0" : ((100 * n) / total).toFixed(1);
}

function readCsv(rel) {
  const path = join(repoRoot, rel);
  check(existsSync(path), `disposition-frontier source missing: ${rel}`);
  const [header, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const headers = parseCsvLine(header);
  return lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
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
