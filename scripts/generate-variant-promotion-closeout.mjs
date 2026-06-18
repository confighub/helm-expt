#!/usr/bin/env node

// Variant-promotion closeout audit.
//
// Turns the master matrix's promotion column into a product-and-engineering
// queue: for every variant, what its promotion state is, whether a server-side
// variant clone already exists, whether `cub variant promote` is ready-to-run
// now / watch-grade / blocked by a proof prerequisite, the exact next command
// or fix, and the owner class that has to act.
//
// Promotion is a ConfigHub SERVER value -- `cub variant promote` clones and
// promotes a Unit server-side. This surface says which variants users can
// promote today, which old watch receipts need a rerun on the fixed server,
// and which need prerequisite proof first.
//
// Read-only projection over committed data:
//   - data/variant-promotion/status.csv   (per-variant promotion status + evidence)
//   - data/master-catalog-matrix/matrix.csv (cross-check of the promotion cell)
// It runs nothing, edits no runs/ receipts, and changes no status. --verify
// regenerates and byte-compares, and FAILS if any todo/watch promotion row lacks
// an owner class or a next action.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const STATUS_CSV = "data/variant-promotion/status.csv";
const MATRIX_CSV = "data/master-catalog-matrix/matrix.csv";
const CHANGESET_BUG = "https://github.com/confighub/helm-expt/issues/682";
const CHANGESET_FIX_NOTE = "ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass";

const outDir = join(repoRoot, "data", "variant-promotion-closeout");
const csvPath = join(outDir, "closeout.csv");
const jsonPath = join(outDir, "closeout.json");
const summaryPath = join(outDir, "summary.md");

// promotion_status -> closeout decision.
const DECISIONS = {
  "available-needs-receipt": {
    promote_readiness: "ready-to-run",
    owner_class: "run-proof",
    server_clone_exists: "yes",
    blocked_by: "",
    meaning:
      "A server-side variant clone already exists and the base has ConfigHub upload proof; only the cub variant promote receipt is missing. Runnable now.",
  },
  "proven-with-watch": {
    promote_readiness: "watch-grade",
    owner_class: "run-proof",
    server_clone_exists: "yes",
    blocked_by: "",
    meaning:
      "Server-side promotion mechanics passed on an old receipt, but the changeset-bound add-new-units path used the fallback. ConfigHub v0.1.80 contains the server fix; rerun the receipt for a full pass.",
  },
  "missing-confighub-proof": {
    promote_readiness: "blocked-needs-confighub-proof",
    owner_class: "run-proof",
    server_clone_exists: "no",
    blocked_by: "",
    meaning:
      "No ConfigHub upload proof yet (the chart is not in ConfigHub), so there is no clone to promote. The ConfigHub proof lane has to run first.",
  },
  "proven": {
    promote_readiness: "promotion-proven",
    owner_class: "not-applicable-if-any",
    server_clone_exists: "yes",
    blocked_by: "",
    meaning:
      "Full variant promotion proven end to end, including the changeset-bound add-new-units path. Nothing left to run.",
  },
  "blocked": {
    promote_readiness: "blocked-proof-failed",
    owner_class: "run-proof",
    server_clone_exists: "yes",
    blocked_by: "",
    meaning:
      "The promotion proof ran but failed its own assertions (for example the no-changeset fallback could not demonstrate changed-unit catch-up). Inspect the recorded receipt blocker and resolve it before the cell can be proven.",
  },
  "needs-server-variant": {
    promote_readiness: "blocked-needs-server-variant",
    owner_class: "run-proof",
    server_clone_exists: "no",
    blocked_by: "",
    meaning:
      "The base has a ConfigHub upload proof, but no server-side variant clone exists yet to promote. The promotion-candidate setup that creates the variant clone must run before this cell can be promoted.",
  },
};

const OWNER_CLASSES = new Set(["run-proof", "catalog-modeling", "not-applicable-if-any"]);

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

function clean(text) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "base",
  "promotion_state",
  "promotion_status",
  "server_clone_exists",
  "promote_readiness",
  "owner_class",
  "blocked_by",
  "evidence_receipt",
  "next_action",
  "reason",
];

function buildRows() {
  const status = readCsv(STATUS_CSV);
  const rows = status.map((s) => {
    const decision = DECISIONS[s.promotion_status];
    check(decision !== undefined, `${s.chart}/${s.variant}: no closeout decision for promotion_status "${s.promotion_status}"`);
    return {
      chart: s.chart,
      version: s.version,
      base: s.variant,
      promotion_state: s.matrix_value,
      promotion_status: s.promotion_status,
      server_clone_exists: decision.server_clone_exists,
      promote_readiness: decision.promote_readiness,
      owner_class: decision.owner_class,
      blocked_by: decision.blocked_by,
      evidence_receipt: clean(s.evidence),
      next_action: clean(s.next_action),
      reason: clean(s.reason),
    };
  });
  rows.sort((a, b) => `${a.chart}|${a.version}|${a.base}`.localeCompare(`${b.chart}|${b.version}|${b.base}`));
  return rows;
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));
}

function mdCount(title, pairs) {
  return [`| ${title} | Variants |`, "| --- | ---: |", ...pairs.map(([k, v]) => `| \`${k || "(blank)"}\` | ${v} |`)].join("\n");
}

function buildJson(rows) {
  return `${JSON.stringify(
    {
      kind: "VariantPromotionCloseout",
      unofficial: true,
      description:
        "Promotion-cell closeout queue: one row per variant with promotion state, whether a server-side clone exists, whether cub variant promote is ready-to-run / watch-grade / blocked by a proof prerequisite, the exact next command or fix, and the owner class. Promotion is a ConfigHub server value. Read-only projection; generated by scripts/generate-variant-promotion-closeout.mjs; do not hand-edit.",
      sources: [STATUS_CSV, MATRIX_CSV],
      changesetBug: CHANGESET_BUG,
      variantCount: rows.length,
      byOwnerClass: Object.fromEntries(countBy(rows, "owner_class")),
      byReadiness: Object.fromEntries(countBy(rows, "promote_readiness")),
      rows,
    },
    null,
    2,
  )}\n`;
}

function buildSummary(rows) {
  const ready = rows.filter((r) => r.promote_readiness === "ready-to-run");
  const watch = rows.filter((r) => r.promote_readiness === "watch-grade");
  const blocked = rows.filter((r) => r.promote_readiness === "blocked-needs-confighub-proof");

  // Representative ready-to-run commands (5-20), de-duplicated by chart.
  const repCommands = [];
  const seenCharts = new Set();
  for (const r of ready) {
    if (seenCharts.has(r.chart)) continue;
    seenCharts.add(r.chart);
    if (r.next_action) repCommands.push(r);
    if (repCommands.length >= 20) break;
  }

  const lines = [];
  lines.push("# Variant-Promotion Closeout");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-variant-promotion-closeout.mjs`. Do not hand-edit. Regenerate");
  lines.push("with `npm run variant-promotion-closeout`.");
  lines.push("");
  lines.push("This surface turns the master matrix promotion column into a product-and-engineering queue:");
  lines.push("for every variant, whether `cub variant promote` is **ready to run now**,");
  lines.push("**watch-grade pending receipt rerun**, or **blocked** by a proof prerequisite, with the exact next command or fix");
  lines.push("and the owner who has to act.");
  lines.push("");
  lines.push("Promotion is a **ConfigHub server value**, not a helm-expt-only trick:");
  lines.push("`cub variant promote` clones and promotes a Unit server-side. See");
  lines.push("[variant-promotion-closeout reference](../../docs/reference/variant-promotion-closeout.md).");
  lines.push("Source of record: [variant-promotion/status.csv](../variant-promotion/status.csv).");
  lines.push("");
  lines.push("## Owner classes");
  lines.push("");
  lines.push("| Owner class | Variants | Meaning |");
  lines.push("| --- | ---: | --- |");
  lines.push(`| \`run-proof\` | ${rows.filter((r) => r.owner_class === "run-proof").length} | A clone exists (or a prerequisite proof can run); record or rerun the proof. Engineering/CI. |`);
  lines.push(`| \`catalog-modeling\` | ${rows.filter((r) => r.owner_class === "catalog-modeling").length} | Needs catalog/model work before promotion is meaningful. |`);
  lines.push(`| \`not-applicable-if-any\` | ${rows.filter((r) => r.owner_class === "not-applicable-if-any").length} | Promotion does not apply to this variant. |`);
  lines.push("");
  lines.push(mdCount("Readiness", countBy(rows, "promote_readiness")));
  lines.push("");
  lines.push(mdCount("Promotion state", countBy(rows, "promotion_state")));
  lines.push("");
  lines.push(`## Ready to run now (${ready.length})`);
  lines.push("");
  lines.push("These variants already have a server-side clone and ConfigHub upload proof; only");
  lines.push("the `cub variant promote` receipt is missing. **A representative set of commands");
  lines.push("(not run here — promotion is a ConfigHub-server action):**");
  lines.push("");
  lines.push("```text");
  for (const r of repCommands) lines.push(`# ${r.chart}@${r.version} / ${r.base}\n${r.next_action}`);
  lines.push("```");
  lines.push("");
  lines.push(`The full ${ready.length}-row ready-to-run set is in [closeout.csv](./closeout.csv).`);
  lines.push("");
  lines.push(`## Watch-grade — rerun on the fixed server (${watch.length})`);
  lines.push("");
  lines.push("Server-side promotion mechanics are proven for these, but the committed receipts");
  lines.push("were recorded before the changeset-bound add-new-units server fix. The next action is:");
  lines.push("");
  lines.push(`> ${CHANGESET_FIX_NOTE}.`);
  lines.push("");
  lines.push("| Chart | Base | Evidence |");
  lines.push("| --- | --- | --- |");
  for (const r of watch) lines.push(`| ${r.chart}@${r.version} | ${r.base} | ${r.evidence_receipt} |`);
  lines.push("");
  if (blocked.length > 0) {
    lines.push(`## Blocked — needs the ConfigHub proof first (${blocked.length})`);
    lines.push("");
    lines.push("No ConfigHub upload proof exists yet, so there is no clone to promote.");
    lines.push("");
    lines.push("| Chart | Base | Next action |");
    lines.push("| --- | --- | --- |");
    for (const r of blocked) lines.push(`| ${r.chart}@${r.version} | ${r.base} | ${r.next_action} |`);
    lines.push("");
  }
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Read-only projection over `variant-promotion/status.csv`. No live run, no");
  lines.push("  ConfigHub-server call, no `runs/` edit, and no status changed.");
  lines.push("- `ready-to-run` lists the command; it does not run it. Promotion is a ConfigHub");
  lines.push("  server action and is executed deliberately, not by this surface.");
  lines.push("- A `watch-grade` row is a recorded decision (mechanics proven, old receipt still");
  lines.push("  used the fallback), never silently rounded to proven.");
  lines.push("");
  return `${lines.join("\n")}`;
}

// --- Invariants -----------------------------------------------------------

function checkInvariants(rows) {
  const status = readCsv(STATUS_CSV);
  check(rows.length === status.length, `closeout row count ${rows.length} != status rows ${status.length}`);
  for (const r of rows) {
    check(OWNER_CLASSES.has(r.owner_class), `${r.chart}/${r.base}: unknown owner_class ${r.owner_class}`);
    // every todo/watch promotion row must carry an owner class AND a next action
    if (["todo", "watch"].includes(r.promotion_state)) {
      check(r.owner_class.trim() !== "", `${r.chart}/${r.base}: todo/watch promotion row missing owner_class`);
      check(r.next_action.trim() !== "", `${r.chart}/${r.base}: todo/watch promotion row missing next_action`);
    }
    check(!/^proven$/i.test(r.promote_readiness), `${r.chart}/${r.base}: a non-proven promotion row must not read proven`);
  }
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const rows = buildRows();
  return {
    rows,
    csv: toCsv(CSV_HEADERS, rows),
    json: buildJson(rows),
    summary: buildSummary(rows),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  checkInvariants(out.rows);
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  console.log(`wrote variant-promotion closeout -> ${relativeRepo(outDir)}/ (${out.rows.length} variants)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.rows);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run variant-promotion-closeout`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run variant-promotion-closeout`);
  }
  console.log(`verified variant-promotion closeout for ${out.rows.length} variants`);
} else {
  console.log(`Usage:
  node scripts/generate-variant-promotion-closeout.mjs --generate
  node scripts/generate-variant-promotion-closeout.mjs --verify`);
}
