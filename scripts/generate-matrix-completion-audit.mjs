#!/usr/bin/env node

// Matrix completion audit.
//
// A read-only audit that answers, for every NON-GREEN / not-yet-run cell of the
// master catalog matrix: what lane is it, what state, what is the product-readable
// reason, what is the next action, what support artifact backs it, and -- the point
// of this surface -- which of three buckets the cell falls into:
//
//   needs-run                  : a command exists; just run it.
//   needs-target-or-prereq-fix : blocked on a target prerequisite, image, or tooling.
//   needs-modeling             : the catalog/model has to change before it can pass.
//   already-decided            : a watch row with a recorded product decision (evidence + named residue).
//
// This separates "needs a run" from "needs a model/support fix" from "already has a
// named product decision" so the matrix can be finished faster.
//
// It is a PROJECTION over committed surfaces, not a re-derivation:
//   - data/disposition-frontier/cells.csv  (per-cell R/C/L/G/P/K disposition + derived reason)
//   - data/master-catalog-matrix/matrix.csv (lifecycle + promotion lanes, support artifacts)
//   - data/live-parity-decisions/decisions.csv (G/P reason/owner/artifact)
//   - data/kind-parity-decisions/decisions.csv (K reason/owner)
//   - data/outcome-coverage/base-outcomes.csv (L-lane local-live evidence)
//   - data/live-matrix-burndown/work-items.csv (todo commands)
//   - data/live-run-blocks/run-blocks.csv (predicted residue for todo rows)
//   - data/lifecycle-route-actions/actions.csv (lifecycle action packets)
//
// It runs nothing, edits no runs/ receipts, and changes no status. --verify
// regenerates and byte-compares, and FAILS if any non-green/non-n/a cell lacks a
// reason or a next action, or carries an unknown completion class.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const SOURCES = {
  cells: "data/disposition-frontier/cells.csv",
  matrix: "data/master-catalog-matrix/matrix.csv",
  liveDecisions: "data/live-parity-decisions/decisions.csv",
  kindDecisions: "data/kind-parity-decisions/decisions.csv",
  baseOutcomes: "data/outcome-coverage/base-outcomes.csv",
  burndown: "data/live-matrix-burndown/work-items.csv",
  runBlocks: "data/live-run-blocks/run-blocks.csv",
  lifecycleActions: "data/lifecycle-route-actions/actions.csv",
};

const outDir = join(repoRoot, "data", "matrix-completion-audit");
const csvPath = join(outDir, "audit.csv");
const jsonPath = join(outDir, "audit.json");
const summaryPath = join(outDir, "summary.md");

// --- CSV ------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsv(rel) {
  const abs = join(repoRoot, rel);
  check(existsSync(abs), `missing source ${rel}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, idx) => [h, cells[idx] ?? ""])));
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  return `${[headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n")}\n`;
}

// Collapse any absolute path baked into a reason to repo-relative.
function clean(text) {
  return (text ?? "").replace(/\/[^\s]*?\/((?:recipes|runs|packages|data|scripts|tests)\/)/g, "$1").replace(/\s+/g, " ").trim();
}

// --- Keys -----------------------------------------------------------------

// Canonical cell key: "org/chart@version|variant".
function keyFromMatrix(r) {
  return `${r.chart}@${r.version}|${r.variant}`;
}
function keyFromCombined(chartAtVersion, variant) {
  return `${chartAtVersion}|${variant}`;
}

// --- States ---------------------------------------------------------------

const GREEN = new Set(["pass", "yes", "n/a", "n-a", "na", ""]);

function isNonGreen(state) {
  return !GREEN.has((state ?? "").trim().toLowerCase());
}

// promotion status -> normalized state
function promotionState(status) {
  const s = (status ?? "").trim();
  if (s === "proven-with-watch") return "watch";
  if (s === "missing-confighub-proof") return "blocked";
  if (s === "available-needs-receipt") return "todo";
  return s; // unknown promotion states fall through (treated as their own non-green token)
}

// --- Triage ---------------------------------------------------------------

const COMPLETION_CLASSES = new Set([
  "needs-run",
  "needs-target-or-prereq-fix",
  "needs-modeling",
  "already-decided",
]);

function triage(state, owner, residue) {
  const s = (state ?? "").toLowerCase();
  if (s === "todo") return "needs-run";
  if (s === "watch") return "already-decided";
  // blocked / fail
  const hay = `${residue ?? ""} ${owner ?? ""}`.toLowerCase();
  if (/model|semantic|capability|catalog/.test(hay) && !/prerequisite|target fact/.test(hay)) return "needs-modeling";
  return "needs-target-or-prereq-fix";
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "variant",
  "lane",
  "lane_label",
  "state",
  "reason",
  "next_action",
  "support_artifact",
  "owner",
  "completion_class",
  "command",
];

const CELL_LANES = [
  { key: "L", source: "cells", label: "local-live" },
  { key: "G", source: "cells", label: "gitops-oci-live" },
  { key: "P", source: "cells", label: "live-helm-vs-confighub-parity" },
  { key: "K", source: "cells", label: "two-cluster-kind" },
];

function index(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, r);
  }
  return m;
}

function buildAudit() {
  const matrix = readCsv(SOURCES.matrix);
  const cells = readCsv(SOURCES.cells);
  const live = index(readCsv(SOURCES.liveDecisions), (r) => keyFromCombined(`${r.chart}@${r.version}`, r.variant));
  const kind = index(readCsv(SOURCES.kindDecisions), (r) => keyFromCombined(`${r.chart}@${r.version}`, r.base));
  const baseOut = index(readCsv(SOURCES.baseOutcomes), (r) => keyFromCombined(r.chart, r.base));
  const burndown = index(readCsv(SOURCES.burndown).map((r) => ({ ...r, _k: `${r.chart}@${r.version}|${r.base}` })), (r) => `${r._k}|${r.work_type}`);
  const runBlocks = index(readCsv(SOURCES.runBlocks), (r) => `${r.chart}@${r.version}|${r.base}|${r.work_type}`);
  const lifecycleActions = index(readCsv(SOURCES.lifecycleActions), (r) => `${r.chart}@${r.version}`);

  // cells.csv: key -> {lane_label -> row}
  const cellsByKeyLane = new Map();
  for (const c of cells) {
    const k = keyFromCombined(c.chart, c.variant);
    if (!cellsByKeyLane.has(k)) cellsByKeyLane.set(k, new Map());
    cellsByKeyLane.get(k).set(c.lane_label, c);
  }

  const audit = [];

  for (const row of matrix) {
    const key = keyFromMatrix(row);
    const chartAtVersion = `${row.chart}@${row.version}`;
    const laneMap = cellsByKeyLane.get(key) ?? new Map();

    // R/C/L/G/P/K from disposition-frontier cells.csv
    for (const lane of CELL_LANES) {
      const cell = laneMap.get(lane.key);
      if (!cell) continue;
      const state = (cell.disposition ?? "").trim();
      if (!isNonGreen(state)) continue;
      audit.push(buildCell({ row, lane, state, cell, live, kind, baseOut, burndown, runBlocks, chartAtVersion, key }));
    }

    // Lifecycle lane (matrix lane_lifecycle_observed)
    const lc = (row.lane_lifecycle_observed ?? "").trim();
    if (isNonGreen(lc)) {
      audit.push(buildLifecycle({ row, state: lc, lifecycleActions, chartAtVersion }));
    }

    // Promotion lane (matrix variant_promotion_status)
    const promRaw = (row.variant_promotion_status ?? "").trim();
    const promState = promotionState(promRaw);
    if (promRaw && isNonGreen(promState)) {
      audit.push(buildPromotion({ row, state: promState, promRaw }));
    }
  }

  audit.sort((a, b) =>
    `${a.chart}|${a.version}|${a.variant}|${a.lane}`.localeCompare(`${b.chart}|${b.version}|${b.variant}|${b.lane}`),
  );
  return audit;
}

function buildCell({ row, lane, state, cell, live, kind, baseOut, burndown, runBlocks, chartAtVersion, key }) {
  let reason = clean(cell.reason);
  let nextAction = clean(cell.next_action);
  let owner = clean(cell.owner);
  let support = "";
  let command = "";

  if (lane.key === "L") {
    const bo = baseOut.get(key);
    if (!reason && bo) reason = `local-live ${state}: ${clean(bo.evidence_notes).split("|")[0].trim()}`;
    if (!nextAction && bo) nextAction = `resolve the local-live blocker first (${clean(bo.missing_or_non_pass_lanes) || "named prerequisite"}); the live lanes inherit it`;
    if (!owner) owner = "tooling/target";
  } else if (lane.key === "G" || lane.key === "P") {
    const d = live.get(key);
    if (d) {
      reason = clean(d.reason) || reason;
      nextAction = clean(d.next_action) || nextAction;
      owner = clean(d.blocker_owner) || owner;
      support = clean(d.support_artifact) || support;
    }
  } else if (lane.key === "K") {
    const d = kind.get(key);
    if (d) {
      reason = clean(d.reason) || reason;
      nextAction = clean(d.next_action) || nextAction;
      owner = clean(d.blocker_owner) || owner;
      support = clean(d.receipt) || support;
    }
  }

  // todo / still-blank cells: fall back to the live burn-down work item.
  const workType = lane.key === "K" ? "kind-parity" : "live-parity";
  const wi = burndown.get(`${chartAtVersion}|${row.variant}|${workType}`);
  if (wi) {
    if (!reason) reason = clean(wi.reason);
    if (!nextAction) nextAction = clean(wi.next_step);
    if (!support) support = clean(wi.support_artifact);
    if (!command) command = clean(wi.command);
  }
  const rb = runBlocks.get(`${chartAtVersion}|${row.variant}|${workType}`);
  if (rb && !command) command = clean(rb.command);

  const residue = (live.get(key)?.residue_category) || (kind.get(key)?.residue_category) || "";
  return {
    chart: row.chart,
    version: row.version,
    variant: row.variant,
    lane: lane.key,
    lane_label: lane.label,
    state,
    reason,
    next_action: nextAction,
    support_artifact: support,
    owner,
    completion_class: triage(state, owner, residue),
    command,
  };
}

function buildLifecycle({ row, state, lifecycleActions, chartAtVersion }) {
  const hasContract = (row.lifecycle_route_contract ?? "").trim() && row.lifecycle_route_contract.trim() !== "n/a";
  const action = lifecycleActions.get(chartAtVersion);
  let reason = hasContract
    ? `lifecycle route(s) defined (${clean(row.lifecycle_route_dispositions) || "routed"}) but not yet observed live`
    : "chart has hook/lifecycle behavior with no live observation yet";
  let nextAction = action
    ? "observe the routed lifecycle action and record a receipt (see lifecycle-route-actions)"
    : "decide and record the lifecycle route, then observe it live";
  const support = clean(row.lifecycle_route_contract_path) || (action ? "data/lifecycle-route-actions/summary.md" : "");
  return {
    chart: row.chart,
    version: row.version,
    variant: row.variant,
    lane: "lifecycle",
    lane_label: "lifecycle-observed",
    state,
    reason,
    next_action: nextAction,
    support_artifact: support,
    owner: "catalog",
    completion_class: triage(state, "catalog", "lifecycle"),
    command: "",
  };
}

function buildPromotion({ row, state, promRaw }) {
  return {
    chart: row.chart,
    version: row.version,
    variant: row.variant,
    lane: "promotion",
    lane_label: `variant-promotion (${promRaw})`,
    state,
    reason: clean(row.variant_promotion_reason),
    next_action: clean(row.variant_promotion_next_action),
    support_artifact: clean(row.variant_promotion_evidence),
    owner: "catalog/promotion",
    completion_class: triage(state, "promotion", ""),
    command: "",
  };
}

// --- JSON + summary -------------------------------------------------------

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));
}

function mdCount(title, pairs) {
  return [`| ${title} | Cells |`, "| --- | ---: |", ...pairs.map(([k, v]) => `| \`${k || "(blank)"}\` | ${v} |`)].join("\n");
}

function buildJson(audit) {
  return `${JSON.stringify(
    {
      kind: "MatrixCompletionAudit",
      unofficial: true,
      description:
        "Read-only audit of every non-green / not-yet-run master-matrix cell: lane, state, product-readable reason, next action, support artifact, and a completion class (needs-run / needs-target-or-prereq-fix / needs-modeling / already-decided). A projection over committed surfaces; it changes no status. Generated by scripts/generate-matrix-completion-audit.mjs; do not hand-edit.",
      sources: Object.values(SOURCES),
      cellCount: audit.length,
      byCompletionClass: Object.fromEntries(countBy(audit, "completion_class")),
      byLane: Object.fromEntries(countBy(audit, "lane")),
      cells: audit,
    },
    null,
    2,
  )}\n`;
}

function buildSummary(audit) {
  const byClass = countBy(audit, "completion_class");
  const byLane = countBy(audit, "lane");
  const byState = countBy(audit, "state");

  const classBlurb = {
    "needs-run": "A command exists — just run it (the burn-down / run-block surfaces have the exact command).",
    "needs-target-or-prereq-fix": "Blocked on a target prerequisite, image, or tooling — a user/target action, not a model change.",
    "needs-modeling": "The catalog/model has to change before this can pass.",
    "already-decided": "A watch row with a recorded product decision: evidence plus a named residue. Usable today with the caveat.",
  };

  const lines = [];
  lines.push("# Matrix Completion Audit");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-matrix-completion-audit.mjs`. Do not hand-edit. Regenerate with");
  lines.push("`npm run matrix-completion-audit`.");
  lines.push("");
  lines.push("One row per **non-green / not-yet-run** cell of the");
  lines.push("[master catalog matrix](../master-catalog-matrix/summary.md). For each cell it");
  lines.push("records the lane, the state, a product-readable reason, the next action, the");
  lines.push("support artifact, and a **completion class** that separates *needs a run* from");
  lines.push("*needs a model/support fix* from *already has a named product decision* — so the");
  lines.push("matrix can be finished in the right order.");
  lines.push("");
  lines.push("It is a read-only projection over the committed decision/queue surfaces");
  lines.push("(disposition-frontier, the live/kind decisions, the burn-down, run-blocks,");
  lines.push("base-outcomes, lifecycle-route-actions, and the matrix's own promotion/lifecycle");
  lines.push("columns). It changes no status and runs nothing.");
  lines.push("");
  lines.push("## Completion classes");
  lines.push("");
  lines.push(`${audit.length} non-green cells:`);
  lines.push("");
  lines.push("| Class | Cells | Meaning |");
  lines.push("| --- | ---: | --- |");
  for (const [k, v] of byClass) lines.push(`| \`${k}\` | ${v} | ${classBlurb[k] ?? ""} |`);
  lines.push("");
  lines.push(mdCount("Lane", byLane));
  lines.push("");
  lines.push(mdCount("State", byState));
  lines.push("");

  for (const [cls, blurb] of Object.entries(classBlurb)) {
    const rows = audit.filter((r) => r.completion_class === cls);
    if (rows.length === 0) continue;
    lines.push(`## ${cls} (${rows.length})`);
    lines.push("");
    lines.push(blurb);
    lines.push("");
    lines.push("| Chart | Variant | Lane | State | Reason | Next action |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const r of rows) {
      lines.push(`| ${r.chart}@${r.version} | ${r.variant} | ${r.lane} | ${r.state} | ${r.reason} | ${r.next_action} |`);
    }
    lines.push("");
  }

  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Read-only projection over committed surfaces. No live run, no `runs/` edited,");
  lines.push("  and no status changed; the authoritative per-row decisions live in the source");
  lines.push("  surfaces this projects.");
  lines.push("- A completion class is a triage hint for finishing the matrix, not a claim. A");
  lines.push("  `watch` cell is a recorded decision, never silently rounded to a pass.");
  lines.push("- This surface is a projection of the live burn-down and regenerates with it:");
  lines.push("  run `npm run matrix-completion-audit` when a live row lands.");
  lines.push("");
  return `${lines.join("\n")}`;
}

// --- Invariants -----------------------------------------------------------

function checkInvariants(audit) {
  for (const r of audit) {
    check(isNonGreen(r.state), `${r.chart}/${r.variant} ${r.lane}: green cell must not appear in the audit (${r.state})`);
    check(r.reason.trim() !== "", `${r.chart}/${r.variant} ${r.lane} (${r.state}): missing reason`);
    check(r.next_action.trim() !== "", `${r.chart}/${r.variant} ${r.lane} (${r.state}): missing next_action`);
    check(COMPLETION_CLASSES.has(r.completion_class), `${r.chart}/${r.variant} ${r.lane}: unknown completion_class ${r.completion_class}`);
    check(!/^pass$/i.test(r.state), `${r.chart}/${r.variant} ${r.lane}: a non-green cell must not be presented as pass`);
  }
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const audit = buildAudit();
  return {
    audit,
    csv: toCsv(CSV_HEADERS, audit),
    json: buildJson(audit),
    summary: buildSummary(audit),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  checkInvariants(out.audit);
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  console.log(`wrote matrix completion audit -> ${relativeRepo(outDir)}/ (${out.audit.length} non-green cells)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.audit);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run matrix-completion-audit`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run matrix-completion-audit`);
  }
  console.log(`verified matrix completion audit for ${out.audit.length} non-green cells`);
} else {
  console.log(`Usage:
  node scripts/generate-matrix-completion-audit.mjs --generate
  node scripts/generate-matrix-completion-audit.mjs --verify`);
}
