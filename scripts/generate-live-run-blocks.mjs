#!/usr/bin/env node

// Live run-block planner (S3).
//
// A read-only projection that groups the READY-TO-RUN todo rows from
// data/live-matrix-burndown/work-items.csv into small, ordered run blocks for the
// serial live lane, so the next commands can be handed out safely.
//
// Ordering (per the S3 contract):
//   1. G/P live-parity rows first (one serial command classifies both G and P cells),
//   2. then two-cluster kind-parity rows,
//   3. within each, hard charts first (operators, CRD/webhook/lifecycle,
//      platform/networking) then ordinary apps, then by predicted residue family
//      and chart family,
//   4. blocks capped at 5 commands, balanced toward 4-5, with a block goal and a
//      stop condition.
//
// Predictions are DERIVED from committed evidence (sibling receipts in the
// decision surfaces, recipe support artifacts, or the chart family pattern) and
// are NEVER claims: when there is no evidence the prediction is `unknown`, not a
// guess. This surface never changes a row's current status; it only helps choose
// the next command block.
//
// Read-only inputs: data/live-matrix-burndown/work-items.csv (spine),
// data/live-parity-decisions/decisions.csv + data/kind-parity-decisions/decisions.csv
// (sibling/family residue signal), and recipe support artifacts under recipes/.
// It runs nothing, edits no runs/ receipts, and changes no status. --verify
// regenerates and byte-compares, and fails if a ready-to-run row is omitted or a
// derived prediction lacks a basis/confidence.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const WORK_ITEMS = "data/live-matrix-burndown/work-items.csv";
const LIVE_DECISIONS = "data/live-parity-decisions/decisions.csv";
const KIND_DECISIONS = "data/kind-parity-decisions/decisions.csv";

const outDir = join(repoRoot, "data", "live-run-blocks");
const csvPath = join(outDir, "run-blocks.csv");
const jsonPath = join(outDir, "run-blocks.json");
const summaryPath = join(outDir, "summary.md");

const MAX_BLOCK = 5;

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
  if (!existsSync(abs)) return [];
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

// --- Classification heuristics --------------------------------------------

function family(chart) {
  return (chart || "").split("/")[0];
}

// Cluster-scoped operators and CRD/webhook/lifecycle charts: highest live value
// because one run classifies a hard lifecycle/CRD cell.
const OPERATOR_OR_CRD = /(operator|tigera|calico|rook|ceph|percona|cert-manager|jetstack|kyverno|gatekeeper|jaeger|strimzi|keda|minio-operator)/i;
// Platform / networking charts.
const PLATFORM_NET = /(istio|istiod|traefik|linkerd|cilium|contour|ingress-nginx|kong|gateway|nginx-ingress)/i;
// Stateful / heavy workloads: serial-sensitive, longer timeouts, storage cleanup.
const STATEFUL = /(elasticsearch|opensearch|spark|zookeeper|kafka|mongodb|postgres|mysql|mariadb|redis|cassandra|clickhouse|etcd|vault|consul|rook|ceph|victoria|loki|tempo|thanos|mimir)/i;

function hardnessTier(chart) {
  if (OPERATOR_OR_CRD.test(chart)) return 0; // operators, CRD/webhook/lifecycle
  if (PLATFORM_NET.test(chart)) return 1; // platform / networking
  return 2; // ordinary app
}

function hardnessLabel(tier) {
  return ["operator/CRD/lifecycle", "platform/networking", "app"][tier] ?? "app";
}

function serialSafetyNotes(row) {
  const notes = [];
  if (row.work_type === "kind-parity") notes.push("two-cluster kind run (provisions two clusters)");
  if (OPERATOR_OR_CRD.test(row.chart)) notes.push("installs cluster-scoped CRDs/webhooks — verify CRD ownership and cleanup; do not batch with another CRD installer in parallel");
  if (STATEFUL.test(row.chart)) notes.push("stateful/heavy — run alone, allow a longer timeout, verify PVC/cluster cleanup");
  if (row.base === "ha") notes.push("HA/multi-replica base — higher resource use");
  if (notes.length === 0) notes.push("light controller — safe within a block");
  return notes.join("; ");
}

// --- Predictions (derived, never claimed) ---------------------------------

const RESIDUE_TARGET_PROFILE = {
  "remote-image": "vanilla kind proof rig — image must be pullable on the target",
  "target-prerequisite": "vanilla kind + the named prerequisite staged (CRD/Secret/Namespace)",
  "target-prerequisite-crds": "vanilla kind + the chart CRDs staged",
  "target-prerequisite-secret": "vanilla kind + the required Secret staged",
  "target-prerequisite-namespace": "vanilla kind + the required Namespace created",
  "target-fit": "non-vanilla target profile — a platform identity/capability the chart needs",
  "gitops-runtime": "vanilla kind proof rig with ConfigHub OCI/Argo — expect a controller-health residue to explain",
  "target-runtime": "vanilla kind proof rig — runtime convergence to review",
  "operate-policy": "vanilla kind + an operational readiness step (e.g. init/unseal)",
  "hook-lifecycle": "vanilla kind + a lifecycle route for the hook action",
  "render-input": "vanilla kind — required input values must be supplied or refused first",
  "capability-profile": "a target whose API capabilities match the chart render profile",
  "capability-profile-diff": "a target whose API capabilities match the chart render profile",
  "model-gap-render": "vanilla kind — a render/model gap to reconcile in the catalog",
  "model-gap-target-fact": "vanilla kind — a missing target fact to model in the catalog",
};

const RECIPE_ARTIFACT_SIGNALS = [
  ["target-topology.yaml", "target-fit"],
  ["target-prerequisite-plan.yaml", "target-prerequisite"],
  ["gitops-runtime-review.yaml", "gitops-runtime"],
  ["runtime-review.yaml", "target-runtime"],
  ["operating-policy.yaml", "operate-policy"],
  ["lifecycle-route.yaml", "hook-lifecycle"],
];

function buildResidueMaps() {
  const all = [...readCsv(LIVE_DECISIONS), ...readCsv(KIND_DECISIONS)];
  const byChart = new Map();
  const byFamily = new Map();
  for (const r of all) {
    const rc = (r.residue_category || "").trim();
    if (!rc) continue;
    if (!byChart.has(r.chart)) byChart.set(r.chart, { residue: rc, receipt: (r.receipt || "").trim() });
    const f = family(r.chart);
    const ctr = byFamily.get(f) ?? new Map();
    ctr.set(rc, (ctr.get(rc) ?? 0) + 1);
    byFamily.set(f, ctr);
  }
  return { byChart, byFamily };
}

function recipeArtifactSignal(row) {
  const base = row.recipe_path || `recipes/${row.chart}/${row.version}`;
  for (const [file, residue] of RECIPE_ARTIFACT_SIGNALS) {
    if (existsSync(join(repoRoot, base, file))) {
      return { residue, basis: `recipe artifact ${base}/${file}`, confidence: "medium" };
    }
  }
  return null;
}

function predictResidue(row, maps) {
  // 1. Same-chart sibling already classified on another base -> high confidence.
  const sib = maps.byChart.get(row.chart);
  if (sib) {
    return {
      status: "derived",
      residue: sib.residue,
      basis: `sibling receipt — ${row.chart} already classified ${sib.residue}${sib.receipt ? ` (${sib.receipt})` : ""}`,
      confidence: "high",
    };
  }
  // 2. A recipe support artifact already names the route -> medium confidence.
  const art = recipeArtifactSignal(row);
  if (art) return { status: "derived", residue: art.residue, basis: art.basis, confidence: art.confidence };
  // 3. Chart-family pattern from already-classified siblings -> medium/low.
  const ctr = maps.byFamily.get(family(row.chart));
  if (ctr && ctr.size > 0) {
    const sorted = [...ctr.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const [top, n] = sorted[0];
    const total = [...ctr.values()].reduce((a, b) => a + b, 0);
    return {
      status: "derived",
      residue: top,
      basis: `family pattern — ${family(row.chart)}: ${n}/${total} classified rows are ${top}`,
      confidence: n / total >= 0.5 ? "medium" : "low",
    };
  }
  // 4. No evidence -> unknown (not a guess).
  return { status: "unknown", residue: "unknown", basis: "", confidence: "unknown" };
}

function predictTargetProfile(prediction) {
  if (prediction.status === "unknown") return "unknown";
  return RESIDUE_TARGET_PROFILE[prediction.residue] ?? "vanilla kind proof rig";
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "block_id",
  "block_goal",
  "work_type",
  "chart",
  "version",
  "base",
  "command",
  "current_status",
  "lane_cells",
  "run_readiness",
  "support_artifact",
  "receipt",
  "prediction_status",
  "predicted_residue_family",
  "predicted_target_profile",
  "prediction_basis",
  "confidence",
  "serial_safety_notes",
  "why_this_block_matters_for_99",
];

function readyRows() {
  return readCsv(WORK_ITEMS).filter((r) => (r.run_readiness || "").trim() === "ready-to-run");
}

// Split an array into balanced chunks of at most MAX_BLOCK (aim for 4-5).
function balancedChunks(arr) {
  if (arr.length === 0) return [];
  const nBlocks = Math.ceil(arr.length / MAX_BLOCK);
  const base = Math.floor(arr.length / nBlocks);
  const extra = arr.length % nBlocks;
  const chunks = [];
  let i = 0;
  for (let b = 0; b < nBlocks; b += 1) {
    const size = base + (b < extra ? 1 : 0);
    chunks.push(arr.slice(i, i + size));
    i += size;
  }
  return chunks;
}

function annotate(row, maps) {
  const prediction = predictResidue(row, maps);
  return {
    ...row,
    _tier: hardnessTier(row.chart),
    _family: family(row.chart),
    prediction_status: prediction.status,
    predicted_residue_family: prediction.residue,
    predicted_target_profile: predictTargetProfile(prediction),
    prediction_basis: prediction.basis,
    confidence: prediction.confidence,
    serial_safety_notes: serialSafetyNotes(row),
  };
}

function sortKey(r) {
  return [r._tier, r.predicted_residue_family, r._family, r.chart, r.base]
    .map((x) => String(x))
    .join("|");
}

function blockGoal(partitionLabel, rows) {
  const fams = [...new Set(rows.map((r) => r.predicted_residue_family))];
  const charts = [...new Set(rows.map((r) => `${r.chart}@${r.version}`))];
  const famText = fams.length === 1
    ? (fams[0] === "unknown" ? "no prior residue signal (first observation)" : `predicted ${fams[0]}`)
    : `predicted ${fams.join(" / ")}`;
  const cellText = partitionLabel === "G/P"
    ? "each live-parity command classifies both the G and P cells"
    : "each kind-parity command classifies the K cell";
  return `${partitionLabel}: run the ${rows.length} ready ${partitionLabel === "G/P" ? "live-parity" : "kind-parity"} row(s) with ${famText} (${charts.join(", ")}); ${cellText}. Confirm or reclassify from each receipt.`;
}

const STOP_CONDITION =
  "Stop when every command in the block has written a committed receipt. If an actual residue differs from the prediction, keep the receipt and let the decision surfaces reclassify — never force the predicted family.";

function whyFor99(row) {
  return `ready-to-run todo cell(s) [${row.lane_cells}] counted against the 99% disposition bar; running this converts todo -> pass/watch/blocked with a committed receipt`;
}

function buildBlocks() {
  const maps = buildResidueMaps();
  const annotated = readyRows().map((r) => annotate(r, maps));

  const partitions = [
    { label: "G/P", prefix: "GP", rows: annotated.filter((r) => r.work_type === "live-parity") },
    { label: "K", prefix: "K", rows: annotated.filter((r) => r.work_type === "kind-parity") },
  ];

  const blocks = [];
  for (const part of partitions) {
    const sorted = [...part.rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    let idx = 0;
    for (const chunk of balancedChunks(sorted)) {
      idx += 1;
      const blockId = `${part.prefix}-${String(idx).padStart(2, "0")}`;
      const goal = blockGoal(part.label, chunk);
      blocks.push({
        block_id: blockId,
        partition: part.label,
        block_goal: goal,
        stop_condition: STOP_CONDITION,
        predicted_residue_families: [...new Set(chunk.map((r) => r.predicted_residue_family))],
        hardness: hardnessLabel(Math.min(...chunk.map((r) => r._tier))),
        rows: chunk,
      });
    }
  }
  return blocks;
}

function flatRows(blocks) {
  const rows = [];
  for (const b of blocks) {
    for (const r of b.rows) {
      rows.push({
        block_id: b.block_id,
        block_goal: b.block_goal,
        work_type: r.work_type,
        chart: r.chart,
        version: r.version,
        base: r.base,
        command: r.command,
        current_status: r.current_status,
        lane_cells: r.lane_cells,
        run_readiness: r.run_readiness,
        support_artifact: r.support_artifact,
        receipt: r.receipt,
        prediction_status: r.prediction_status,
        predicted_residue_family: r.predicted_residue_family,
        predicted_target_profile: r.predicted_target_profile,
        prediction_basis: r.prediction_basis,
        confidence: r.confidence,
        serial_safety_notes: r.serial_safety_notes,
        why_this_block_matters_for_99: whyFor99(r),
      });
    }
  }
  return rows;
}

function buildJson(blocks) {
  return `${JSON.stringify(
    {
      kind: "LiveRunBlocks",
      unofficial: true,
      description:
        "Read-only run-block plan for the ready-to-run todo rows in data/live-matrix-burndown/work-items.csv. Groups them into small ordered blocks (G/P before K, hard charts first) with a predicted residue family and target profile per row. Predictions are derived from committed evidence and are never claims; insufficient evidence is recorded as unknown. Generated by scripts/generate-live-run-blocks.mjs; do not hand-edit.",
      sources: [WORK_ITEMS, LIVE_DECISIONS, KIND_DECISIONS, "recipes/<chart>/<version>/ support artifacts"],
      maxBlockSize: MAX_BLOCK,
      readyRowCount: blocks.reduce((n, b) => n + b.rows.length, 0),
      blockCount: blocks.length,
      blocks: blocks.map((b) => ({
        block_id: b.block_id,
        partition: b.partition,
        hardness: b.hardness,
        predicted_residue_families: b.predicted_residue_families,
        block_goal: b.block_goal,
        stop_condition: b.stop_condition,
        rows: b.rows.map((r) => ({
          work_type: r.work_type,
          chart: r.chart,
          version: r.version,
          base: r.base,
          command: r.command,
          current_status: r.current_status,
          lane_cells: r.lane_cells,
          support_artifact: r.support_artifact,
          receipt: r.receipt,
          prediction_status: r.prediction_status,
          predicted_residue_family: r.predicted_residue_family,
          predicted_target_profile: r.predicted_target_profile,
          prediction_basis: r.prediction_basis,
          confidence: r.confidence,
          serial_safety_notes: r.serial_safety_notes,
        })),
      })),
    },
    null,
    2,
  )}\n`;
}

function buildSummary(blocks) {
  const total = blocks.reduce((n, b) => n + b.rows.length, 0);
  const gp = blocks.filter((b) => b.partition === "G/P");
  const k = blocks.filter((b) => b.partition === "K");
  const derived = blocks.flatMap((b) => b.rows).filter((r) => r.prediction_status === "derived").length;
  const unknown = total - derived;

  const lines = [];
  lines.push("# Live Run-Block Planner");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-live-run-blocks.mjs`. Do not hand-edit. Regenerate with");
  lines.push("`npm run live-run-blocks`.");
  lines.push("");
  lines.push("A read-only plan that turns the **ready-to-run todo** rows in");
  lines.push("[live-matrix-burndown/work-items.csv](../live-matrix-burndown/work-items.csv)");
  lines.push("into small, ordered run blocks for the serial live lane. It does not run");
  lines.push("anything, edit any receipt, or change any status; it only sequences the next");
  lines.push("commands. Per-row decisions live in");
  lines.push("[live-parity-decisions](../live-parity-decisions/summary.md) and");
  lines.push("[kind-parity-decisions](../kind-parity-decisions/summary.md); residue families are");
  lines.push("defined in [residue-families](../../docs/reference/residue-families.md).");
  lines.push("");
  lines.push("## Predictions are not claims");
  lines.push("");
  lines.push("Each row carries a **predicted** residue family and target profile, derived from");
  lines.push("committed evidence (a sibling receipt for the same chart, a recipe support");
  lines.push("artifact, or the chart-family pattern). A prediction is a hint for sequencing,");
  lines.push("never a result. Where there is no evidence the prediction is `unknown`, not a");
  lines.push("guess. Always classify from the actual receipt after a run.");
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push("```text");
  lines.push(`ready-to-run rows:   ${total}`);
  lines.push(`run blocks:          ${blocks.length}  (G/P: ${gp.length}, K: ${k.length})`);
  lines.push(`derived predictions: ${derived}`);
  lines.push(`unknown predictions: ${unknown}`);
  lines.push("```");
  lines.push("");
  lines.push("Order: G/P live-parity blocks first (one command classifies both the G and P");
  lines.push("cells), then two-cluster kind-parity blocks; within each, hard charts");
  lines.push("(operators, CRD/webhook/lifecycle, platform/networking) before ordinary apps,");
  lines.push("then by predicted residue family and chart family. Blocks are capped at");
  lines.push(`${MAX_BLOCK} commands.`);
  lines.push("");

  for (const b of blocks) {
    lines.push(`## ${b.block_id} — ${b.partition} · ${b.hardness}`);
    lines.push("");
    lines.push(`**Goal:** ${b.block_goal}`);
    lines.push("");
    lines.push(`**Stop:** ${b.stop_condition}`);
    lines.push("");
    lines.push("| Chart | Base | Command | Predicted residue | Confidence | Serial safety |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const r of b.rows) {
      const pred = r.prediction_status === "unknown" ? "unknown" : `${r.predicted_residue_family}`;
      lines.push(`| ${r.chart}@${r.version} | ${r.base} | \`${r.command}\` | ${pred} | ${r.confidence} | ${r.serial_safety_notes} |`);
    }
    lines.push("");
  }

  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Read-only projection over committed sources. No live run, no cluster, no");
  lines.push("  `runs/` receipt edited, and no status changed.");
  lines.push("- Predictions are derived hints, never claims. `unknown` means no evidence —");
  lines.push("  it is not a defect and not a guess.");
  lines.push("- Blocks only sequence existing ready-to-run rows; they never invent rows or");
  lines.push("  promote a row's status.");
  lines.push("");
  return `${lines.join("\n")}`;
}

// --- Invariants -----------------------------------------------------------

function checkInvariants(blocks) {
  const flat = flatRows(blocks);
  // 1. Every ready-to-run todo row from work-items.csv appears exactly once.
  const ready = readyRows();
  const key = (r) => `${r.work_type}|${r.chart}|${r.version}|${r.base}`;
  const planned = new Set(flat.map(key));
  for (const r of ready) {
    check(planned.has(key(r)), `ready-to-run row omitted from the planner: ${key(r)}`);
  }
  check(flat.length === ready.length, `planner row count ${flat.length} != ready-to-run rows ${ready.length}`);
  // 2. Predictions obey the contract.
  for (const r of flat) {
    if (r.prediction_status === "derived") {
      check(r.prediction_basis.trim() !== "", `${r.chart}/${r.base}: derived prediction without a basis`);
      check(["high", "medium", "low"].includes(r.confidence), `${r.chart}/${r.base}: derived prediction without a valid confidence`);
      check(r.predicted_residue_family !== "unknown", `${r.chart}/${r.base}: derived prediction must name a residue family`);
    } else {
      check(r.prediction_status === "unknown", `${r.chart}/${r.base}: invalid prediction_status ${r.prediction_status}`);
      check(r.predicted_residue_family === "unknown" && r.predicted_target_profile === "unknown" && r.prediction_basis === "" && r.confidence === "unknown", `${r.chart}/${r.base}: unknown prediction must leave all prediction fields unknown/empty`);
    }
  }
  // 3. Blocks are capped.
  for (const b of blocks) {
    check(b.rows.length >= 1 && b.rows.length <= MAX_BLOCK, `${b.block_id}: block size ${b.rows.length} out of range 1..${MAX_BLOCK}`);
  }
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const blocks = buildBlocks();
  return {
    blocks,
    csv: toCsv(CSV_HEADERS, flatRows(blocks)),
    json: buildJson(blocks),
    summary: buildSummary(blocks),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  checkInvariants(out.blocks);
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  const total = out.blocks.reduce((n, b) => n + b.rows.length, 0);
  console.log(`wrote live run-blocks -> ${relativeRepo(outDir)}/ (${out.blocks.length} blocks, ${total} ready rows)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.blocks);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run live-run-blocks`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run live-run-blocks`);
  }
  const total = out.blocks.reduce((n, b) => n + b.rows.length, 0);
  console.log(`verified live run-blocks: ${out.blocks.length} blocks, ${total} ready rows`);
} else {
  console.log(`Usage:
  node scripts/generate-live-run-blocks.mjs --generate
  node scripts/generate-live-run-blocks.mjs --verify`);
}
