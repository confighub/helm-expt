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
  const kindParityRows = readCsv(KIND_PARITY_SOURCE);
  const kindParity = indexKindParity(kindParityRows);
  // Same K receipts, indexed by chart-VARIANT (no version) — the granularity
  // the kind-parity rig actually records at — so a missing-for-this-version K
  // cell can be recognized as covered by a sibling version's receipt.
  const kindCovering = indexKindParityByVariant(kindParityRows);
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
      derive(cell, row, lane, localLive, localReason, kindCovering);
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
function derive(cell, row, lane, localLive, localReason, kindCovering) {
  // Two-cluster kind parity (K) receipts are keyed by chart-VARIANT, not by
  // version: scripts/run-kind-parity.mjs writes one receipt per chart+base
  // (runs/live-kind-parity/<chart>-<base>/, NO version in the slug). The
  // catalog ships several versions of the same chart+variant, so only the
  // version that last ran holds the receipt; every other shipped version shows
  // a bare `missing` K cell even though the variant IS proven. Re-running an
  // older version would OVERWRITE the current version's receipt — net-negative
  // — so the honest disposition is "covered by the sibling version", not a
  // runnable `todo`. This recorded cross-version evidence is authoritative, so
  // it is checked before the local-live-derived branches below.
  if (lane.key === "two_cluster_kind_parity") {
    const covered = kindCoveredBy(row, kindCovering);
    if (covered) {
      cell.derived = "yes";
      cell.owner = "kind-parity";
      if (covered.proven) {
        cell.disposition = "n/a";
        cell.reason = `variant-keyed K rig: this version has no own receipt but the chart-variant is proven by the two-cluster kind parity receipt on ${covered.version} (${covered.result}) — ${covered.receipt}`;
        cell.next_action = `none — the variant is proven on ${covered.version}; the K rig keys receipts by chart-variant (no version), so re-running this version would overwrite that receipt (net-negative)`;
      } else {
        cell.disposition = "blocked";
        cell.reason = `variant-keyed K rig: the chart-variant's only two-cluster kind parity receipt is on ${covered.version} and is ${covered.result}${covered.reason ? ` (${covered.reason})` : ""}, so no version has a passing K proof — ${covered.receipt}`;
        cell.next_action = `resolve the variant's K blocker on ${covered.version}; the K rig keys receipts by chart-variant, so re-running this version would overwrite that receipt`;
      }
      return;
    }
  }
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
  const derivedNa = cells.filter((c) => c.derived === "yes" && c.disposition === "n/a").length;

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
+ derived n/a (K covered):  ${derivedNa}
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
- The two-cluster **K** lane is **variant-keyed**: \`scripts/run-kind-parity.mjs\` writes one receipt per chart-variant (\`runs/live-kind-parity/<chart>-<base>/\`, **no version in the slug**), so only the version that last ran holds the receipt. A bare \`missing\` K cell whose chart-variant **is** proven on another shipped version is therefore **not** a runnable gap — it is **n/a, covered by that version** (re-running it would overwrite the sibling receipt: net-negative). If every receipt for the variant is itself \`blocked\`/\`fail\` (no version has a passing K proof), the cell **inherits blocked** rather than n/a, so a blocked variant is never laundered into a clean n/a. Only a chart-variant with **no** K receipt on any version stays a genuine K \`todo\`.
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

// Index the same K receipts by chart-variant (chart without version + base).
// Each entry is the list of recorded receipts for that chart-variant across the
// versions that have actually run — at most one under today's variant-keyed
// slug, but kept as a list so the rule is robust if that ever changes.
function indexKindParityByVariant(rows) {
  const byVariant = new Map();
  for (const row of rows) {
    if (!row.chart || !row.version || !row.base || !row.result) continue;
    const key = `${row.chart}|${row.base}`;
    if (!byVariant.has(key)) byVariant.set(key, []);
    byVariant.get(key).push({
      version: row.version,
      result: row.result,
      reason: row.reason || "",
      receipt: row.receipt || "",
    });
  }
  return byVariant;
}

// Decide whether a bare-`missing` K cell is covered by the same chart-variant's
// receipt on a DIFFERENT shipped version. base-outcomes keys charts as
// "<chart>@<version>"; the K summary keys them bare, so split the version off
// and look up the variant. A covering receipt that passed (or is a watch — a
// known non-failure) means the variant is proven and this version carries no
// independent proof obligation: `proven` true -> the caller marks it n/a. If
// every receipt for the variant is itself blocked/fail, no version has a
// passing K proof, so `proven` is false and the caller inherits that blocked
// status (a blocked variant is never laundered into a clean n/a). Returns null
// when no sibling receipt exists (e.g. a variant never run on any version),
// which keeps it an honest, runnable K `todo`.
function kindCoveredBy(row, kindCovering) {
  const at = row.chart.lastIndexOf("@");
  if (at === -1) return null;
  const chartBare = row.chart.slice(0, at);
  const version = row.chart.slice(at + 1);
  const covers = (kindCovering.get(`${chartBare}|${row.base}`) ?? [])
    .filter((c) => c.version !== version)
    .sort((a, b) => a.version.localeCompare(b.version));
  if (covers.length === 0) return null;
  const passing = covers.filter((c) => c.result === "pass" || c.result === "watch");
  const pick = passing[0] ?? covers[0];
  return { ...pick, proven: passing.length > 0 };
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
