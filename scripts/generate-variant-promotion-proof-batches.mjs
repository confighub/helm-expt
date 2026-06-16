#!/usr/bin/env node

// Variant-promotion proof batches.
//
// A run plan: every ready-to-run promotion row from the closeout audit, grouped
// into safe serial batches of 5-10 `cub variant promote` proof commands to run
// once ConfigHub auth is restored. These are batches we SHOULD run, not completed
// promotion evidence.
//
// Read-only projection over data/variant-promotion-closeout/closeout.csv
// (promote_readiness=ready-to-run). It runs nothing, mutates no ConfigHub state,
// and edits no runs/ receipts. --verify regenerates and byte-compares, and FAILS
// if any ready row is omitted or duplicated, or if any command is not a real
// `node scripts/run-top20-confighub-proof.mjs ...` invocation.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const CLOSEOUT = "data/variant-promotion-closeout/closeout.csv";
const PROOF_CMD = /^node scripts\/run-top20-confighub-proof\.mjs .*--variant-promotion-proof/;
const MAX_BATCH = 10;

const outDir = join(repoRoot, "data", "variant-promotion-proof-batches");
const csvPath = join(outDir, "batches.csv");
const jsonPath = join(outDir, "batches.json");
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

// --- Batching -------------------------------------------------------------

// Balanced chunks of at most MAX_BATCH (aim for an even 9-10 per batch).
function balancedChunks(arr) {
  if (arr.length === 0) return [];
  const nBatches = Math.ceil(arr.length / MAX_BATCH);
  const base = Math.floor(arr.length / nBatches);
  const extra = arr.length % nBatches;
  const chunks = [];
  let i = 0;
  for (let b = 0; b < nBatches; b += 1) {
    const size = base + (b < extra ? 1 : 0);
    chunks.push(arr.slice(i, i + size));
    i += size;
  }
  return chunks;
}

const CSV_HEADERS = ["batch_id", "batch_goal", "chart", "version", "base", "command"];

function buildBatches() {
  const ready = readCsv(CLOSEOUT)
    .filter((r) => r.promote_readiness === "ready-to-run")
    .map((r) => ({ chart: r.chart, version: r.version, base: r.base, command: (r.next_action ?? "").trim() }));
  ready.sort((a, b) => `${a.chart}|${a.version}|${a.base}`.localeCompare(`${b.chart}|${b.version}|${b.base}`));

  const batches = [];
  let seq = 0;
  for (const chunk of balancedChunks(ready)) {
    seq += 1;
    const id = `B${String(seq).padStart(2, "0")}`;
    const charts = [...new Set(chunk.map((r) => r.chart))];
    const goal = `Run ${chunk.length} ready variant-promotion proofs serially once cub auth returns: ${charts.join(", ")}.`;
    batches.push({ batch_id: id, goal, rows: chunk });
  }
  return batches;
}

const STOP_CONDITION =
  "Run serially once `cub auth login` is restored; each command records one server-side cub variant promote receipt. Stop on the first failure and inspect before continuing. Do not run in parallel -- each mutates ConfigHub server state.";

function flatRows(batches) {
  const out = [];
  for (const b of batches) {
    for (const r of b.rows) {
      out.push({ batch_id: b.batch_id, batch_goal: b.goal, chart: r.chart, version: r.version, base: r.base, command: r.command });
    }
  }
  return out;
}

function buildJson(batches) {
  return `${JSON.stringify(
    {
      kind: "VariantPromotionProofBatches",
      unofficial: true,
      description:
        "Run plan: every ready-to-run promotion row grouped into safe serial batches of 5-10 cub variant promote proof commands, to run once ConfigHub auth is restored. These are batches to run, NOT completed promotion evidence. Read-only projection over variant-promotion-closeout; generated by scripts/generate-variant-promotion-proof-batches.mjs; do not hand-edit.",
      source: CLOSEOUT,
      maxBatchSize: MAX_BATCH,
      readyRowCount: batches.reduce((n, b) => n + b.rows.length, 0),
      batchCount: batches.length,
      stopCondition: STOP_CONDITION,
      batches: batches.map((b) => ({ batch_id: b.batch_id, goal: b.goal, commands: b.rows.map((r) => r.command) })),
    },
    null,
    2,
  )}\n`;
}

function buildSummary(batches) {
  const total = batches.reduce((n, b) => n + b.rows.length, 0);
  const lines = [];
  lines.push("# Variant-Promotion Proof Batches");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-variant-promotion-proof-batches.mjs`. Do not hand-edit. Regenerate");
  lines.push("with `npm run variant-promotion-proof-batches`.");
  lines.push("");
  lines.push(`A **run plan**, not evidence. The ${total} \`ready-to-run\` promotion rows from the`);
  lines.push("[promotion closeout](../variant-promotion-closeout/summary.md) — each already has a");
  lines.push("server-side clone and ConfigHub upload proof and only needs the `cub variant promote`");
  lines.push(`receipt — grouped here into ${batches.length} safe serial batches to run **once \`cub`);
  lines.push("auth login` is restored**. These are the batches we should run; nothing here is");
  lines.push("completed promotion evidence.");
  lines.push("");
  lines.push("Live G/P is paused on expired ConfigHub auth; this plan is staged for when it");
  lines.push("returns. Run batches serially — each command mutates ConfigHub server state.");
  lines.push("");
  lines.push(`**Stop condition (every batch):** ${STOP_CONDITION}`);
  lines.push("");
  for (const b of batches) {
    lines.push(`## ${b.batch_id} (${b.rows.length})`);
    lines.push("");
    lines.push(b.goal);
    lines.push("");
    lines.push("```bash");
    for (const r of b.rows) lines.push(r.command);
    lines.push("```");
    lines.push("");
  }
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Read-only projection over the promotion closeout. No ConfigHub mutation, no");
  lines.push("  kind cluster, no `runs/` edit, no live runner touched.");
  lines.push("- A batch is a planned run, never a claim of completed promotion. Receipts are");
  lines.push("  recorded only when the commands are actually run, after auth is restored.");
  lines.push("");
  return `${lines.join("\n")}`;
}

// --- Invariants -----------------------------------------------------------

function checkInvariants(batches) {
  const flat = flatRows(batches);
  const ready = readCsv(CLOSEOUT).filter((r) => r.promote_readiness === "ready-to-run");
  const key = (r) => `${r.chart}|${r.version}|${r.base}`;
  // exactly once: no omissions, no duplicates
  const planned = flat.map(key);
  const plannedSet = new Set(planned);
  check(planned.length === plannedSet.size, "a ready row is duplicated across batches");
  for (const r of ready) check(plannedSet.has(key(r)), `ready-to-run row omitted from the batches: ${key(r)}`);
  check(flat.length === ready.length, `batched row count ${flat.length} != ready-to-run rows ${ready.length}`);
  // every command is a real promotion-proof invocation
  for (const r of flat) check(PROOF_CMD.test(r.command), `${r.chart}/${r.base}: command is not a real run-top20-confighub-proof variant-promotion command: ${r.command}`);
  // batch sizes 5-10 (the last balanced batch may be smaller only if there are <5 total)
  for (const b of batches) {
    const ok = b.rows.length <= MAX_BATCH && (b.rows.length >= 5 || batches.length === 1);
    check(ok, `${b.batch_id}: batch size ${b.rows.length} outside 5..${MAX_BATCH}`);
  }
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const batches = buildBatches();
  return {
    batches,
    csv: toCsv(CSV_HEADERS, flatRows(batches)),
    json: buildJson(batches),
    summary: buildSummary(batches),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  checkInvariants(out.batches);
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  const total = out.batches.reduce((n, b) => n + b.rows.length, 0);
  console.log(`wrote variant-promotion proof batches -> ${relativeRepo(outDir)}/ (${out.batches.length} batches, ${total} ready rows)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.batches);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run variant-promotion-proof-batches`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run variant-promotion-proof-batches`);
  }
  const total = out.batches.reduce((n, b) => n + b.rows.length, 0);
  console.log(`verified variant-promotion proof batches: ${out.batches.length} batches, ${total} ready rows`);
} else {
  console.log(`Usage:
  node scripts/generate-variant-promotion-proof-batches.mjs --generate
  node scripts/generate-variant-promotion-proof-batches.mjs --verify`);
}
