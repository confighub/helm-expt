#!/usr/bin/env node

// Model-gap workdown.
//
// Catalog-owned model gaps: non-pass rows that will not pass by re-running,
// because the recipe/base model has to change first (a render-shape or CRD
// lifecycle gap, a missing CRD, a missing generated/target fact, a semantic
// normalization, or a base-design gap). It is the complement of the
// target/user-prerequisite rows: this surface says what the CATALOG has to
// change, not what a user stages in the target.
//
// Read-only projection over committed decisions + matrix + receipts:
//   - data/kind-parity-decisions/decisions.csv (K-lane catalog residues)
//   - data/live-parity-decisions/decisions.csv (G/P-lane catalog residues)
//   - data/master-catalog-matrix/matrix.csv    (sibling base that already passes)
//   - data/live-parity-rerun-plan/rerun-plan.csv (rerun command after the fix)
// It runs nothing, edits no runs/ receipts, and marks no row fixed or pass.
// --verify regenerates and byte-compares, and FAILS if any included row lacks a
// gap kind, an owner class, a next action, or an evidence path.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const KIND_DECISIONS = "data/kind-parity-decisions/decisions.csv";
const LIVE_DECISIONS = "data/live-parity-decisions/decisions.csv";
const MATRIX = "data/master-catalog-matrix/matrix.csv";
const RERUN = "data/live-parity-rerun-plan/rerun-plan.csv";

// Catalog-owned residues that indicate a model gap (hook-lifecycle is excluded:
// it is a lifecycle-route concern handled by the lifecycle-route surfaces).
const K_RESIDUES = new Set(["model-gap-render", "model-gap-target-fact", "capability-profile-diff"]);
const GP_RESIDUES = new Set(["semantic-model-gap", "capability-profile", "render-input"]);

const outDir = join(repoRoot, "data", "model-gap-workdown");
const csvPath = join(outDir, "workdown.csv");
const jsonPath = join(outDir, "workdown.json");
const summaryPath = join(outDir, "summary.md");

const KINDS = new Set(["crd-lifecycle", "missing-crd", "object-set-shape", "generated-fact", "semantic-normalization", "base-design", "unknown"]);
const OWNERS = new Set(["catalog-modeling", "recipe-generator", "support-policy", "operator-review"]);

// kind -> { action, owner }
const KIND_PLAN = {
  "generated-fact": { action: "add-target-fact-generator", owner: "recipe-generator" },
  "base-design": { action: "design-new-base", owner: "catalog-modeling" },
  "semantic-normalization": { action: "add-semantic-normalization", owner: "catalog-modeling" },
  "missing-crd": { action: "design-new-base", owner: "catalog-modeling" },
  "crd-lifecycle": { action: "split-lifecycle-objects", owner: "catalog-modeling" },
  "object-set-shape": { action: "add-semantic-normalization", owner: "catalog-modeling" },
  "unknown": { action: "operator-review", owner: "operator-review" },
};

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

// --- Classification -------------------------------------------------------

function kindOf(residue, reason) {
  const r = (reason ?? "").toLowerCase();
  if (residue === "model-gap-target-fact" || /target fact|value generator/.test(r)) return "generated-fact";
  if (residue === "render-input" || /render-input|values missing|apply failed|invalid\)/.test(r)) return "base-design";
  if (residue === "capability-profile" || residue === "capability-profile-diff" || /apiservice|not served/.test(r)) return "semantic-normalization";
  if (/missing=\S*customresourcedefinition/i.test(r)) return "missing-crd";
  if (/extra=\S*customresourcedefinition/i.test(r)) return "crd-lifecycle";
  if (/object diff|semantic object parity|diffs=[1-9]|missing=|extra=/.test(r)) return "object-set-shape";
  return "unknown";
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "base",
  "lane",
  "result",
  "model_gap_kind",
  "failure_signature",
  "sibling_base_passes",
  "recommended_action",
  "owner_class",
  "rerun_command",
  "evidence_path",
];

function siblingPassIndex(matrix) {
  // (chart|version) -> [{base, K, G, P}]
  const m = new Map();
  for (const r of matrix) {
    const key = `${r.chart}|${r.version}`;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push({
      base: r.variant,
      K: r.lane_two_cluster_kind,
      G: r.lane_gitops_oci_live,
      P: r.lane_live_dual_parity,
    });
  }
  return m;
}

function siblingThatPasses(siblings, base, lane) {
  const passes = (s) => (lane === "K" ? s.K === "yes" : s.G === "yes" && s.P === "yes");
  const winners = (siblings ?? []).filter((s) => s.base !== base && passes(s));
  return winners.length ? winners.map((s) => `${s.base} (${lane} pass)`).join("; ") : "none";
}

function rerunIndex(rerun) {
  const m = new Map();
  for (const r of rerun) {
    const lane = r.lane === "two-cluster-kind-parity" ? "K" : r.lane === "configHub-oci-live-comparison" ? "G/P" : r.lane;
    m.set(`${r.chart}|${r.version}|${r.base}|${lane}`, clean(r.rerun_command));
  }
  return m;
}

function buildRows() {
  const matrix = readCsv(MATRIX);
  const siblings = siblingPassIndex(matrix);
  const rerun = rerunIndex(readCsv(RERUN));

  const out = [];
  const pushRow = (chart, version, base, lane, result, residue, reason, receipt) => {
    const kind = kindOf(residue, reason);
    const plan = KIND_PLAN[kind];
    out.push({
      chart,
      version,
      base,
      lane,
      result,
      model_gap_kind: kind,
      failure_signature: clean(reason).slice(0, 160),
      sibling_base_passes: siblingThatPasses(siblings.get(`${chart}|${version}`), base, lane),
      recommended_action: plan.action,
      owner_class: plan.owner,
      rerun_command: rerun.get(`${chart}|${version}|${base}|${lane}`) ?? "",
      evidence_path: receipt,
    });
  };

  for (const r of readCsv(KIND_DECISIONS)) {
    if (!K_RESIDUES.has(r.residue_category)) continue;
    pushRow(r.chart, r.version, r.base, "K", r.result, r.residue_category, r.reason, r.receipt);
  }
  for (const r of readCsv(LIVE_DECISIONS)) {
    if (!GP_RESIDUES.has(r.residue_category)) continue;
    pushRow(r.chart, r.version, r.variant, "G/P", r.result, r.residue_category, r.reason, r.receipt);
  }
  out.sort((a, b) => `${a.chart}|${a.version}|${a.base}|${a.lane}`.localeCompare(`${b.chart}|${b.version}|${b.base}|${b.lane}`));
  return out;
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));
}

function mdCount(title, pairs) {
  return [`| ${title} | Rows |`, "| --- | ---: |", ...pairs.map(([k, v]) => `| \`${k || "(blank)"}\` | ${v} |`)].join("\n");
}

function buildJson(rows) {
  return `${JSON.stringify(
    {
      kind: "ModelGapWorkdown",
      unofficial: true,
      description:
        "Catalog-owned model gaps: non-pass rows that need a recipe/base model change (not a re-run and not a target prerequisite) before they can pass. Per row: model-gap kind, failure signature, a sibling base that already passes, the recommended product action, the owner class, the rerun command after the fix, and the evidence path. Read-only; marks no row fixed. Generated by scripts/generate-model-gap-workdown.mjs; do not hand-edit.",
      sources: [KIND_DECISIONS, LIVE_DECISIONS, MATRIX, RERUN],
      rowCount: rows.length,
      byKind: Object.fromEntries(countBy(rows, "model_gap_kind")),
      byOwner: Object.fromEntries(countBy(rows, "owner_class")),
      rows,
    },
    null,
    2,
  )}\n`;
}

function buildSummary(rows) {
  const kindBlurb = {
    "crd-lifecycle": "The installer-applied set includes CRD lifecycle objects that regular Helm's live set excludes. Split the CRD/lifecycle objects out (the no-crds sibling is usually the off-ramp).",
    "missing-crd": "The base omits CRDs that the live Helm object set includes. Reconcile the rendered object set or design a base that matches.",
    "object-set-shape": "The delivered object set differs from live Helm (extra/missing objects or field diffs). Normalize the render so the shapes match.",
    "generated-fact": "A required target-fact value has no generator (e.g. autoDiscovery.clusterName). Add the value generator to the recipe.",
    "semantic-normalization": "A rendered field/version differs from what the target serves (e.g. an APIService version or a deprecated field). Normalize or gate it; a sibling capability base may already pass.",
    "base-design": "The base renders incomplete/invalid objects because required inputs are not modeled. Design a base that supplies or refuses them.",
    "unknown": "Needs an operator/engineering review to classify the model gap.",
  };

  const lines = [];
  lines.push("# Model-Gap Workdown");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-model-gap-workdown.mjs`. Do not hand-edit. Regenerate with");
  lines.push("`npm run model-gap-workdown`.");
  lines.push("");
  lines.push("These are the non-pass rows that **will not pass by re-running** — the");
  lines.push("recipe/base model has to change first. They are **catalog-owned**, the");
  lines.push("complement of the target/user-prerequisite rows: this surface says what the");
  lines.push("catalog must change, not what a user stages in the target. **It marks nothing");
  lines.push("fixed** — it is a workdown queue, not evidence.");
  lines.push("");
  lines.push("Source decisions: [kind-parity-decisions](../kind-parity-decisions/summary.md) and");
  lines.push("[live-parity-decisions](../live-parity-decisions/summary.md); residue families in");
  lines.push("[residue-families](../../docs/reference/residue-families.md). For the full");
  lines.push("non-green triage (which rows are runs vs fixes vs decided) see");
  lines.push("[matrix-completion-audit](../matrix-completion-audit/summary.md).");
  lines.push("");
  lines.push(`## ${rows.length} model-gap rows`);
  lines.push("");
  lines.push(mdCount("Model-gap kind", countBy(rows, "model_gap_kind")));
  lines.push("");
  lines.push(mdCount("Owner class", countBy(rows, "owner_class")));
  lines.push("");
  lines.push("## Rows");
  lines.push("");
  lines.push("| Chart | Base | Lane | Kind | Action | Owner | Sibling that passes |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    lines.push(`| ${r.chart}@${r.version} | ${r.base} | ${r.lane} | ${r.model_gap_kind} | ${r.recommended_action} | ${r.owner_class} | ${r.sibling_base_passes} |`);
  }
  lines.push("");
  lines.push("## Model-gap kinds");
  lines.push("");
  for (const [k, blurb] of Object.entries(kindBlurb)) {
    if (!rows.some((r) => r.model_gap_kind === k)) continue;
    lines.push(`- **${k}** — ${blurb}`);
  }
  lines.push("");
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Read-only projection over committed decisions, the matrix, and receipts. No");
  lines.push("  live run, no kind cluster, no `runs/` edit, no row marked fixed or pass.");
  lines.push("- A recommended action is the model change needed before the row can pass; the");
  lines.push("  rerun command is what to run *after* the change, not now.");
  lines.push("- The `sibling_base_passes` column names an existing off-ramp where one exists;");
  lines.push("  it does not promote it.");
  lines.push("");
  return `${lines.join("\n")}`;
}

// --- Invariants -----------------------------------------------------------

function checkInvariants(rows) {
  for (const r of rows) {
    check(KINDS.has(r.model_gap_kind), `${r.chart}/${r.base}: unknown model_gap_kind ${r.model_gap_kind}`);
    check(OWNERS.has(r.owner_class), `${r.chart}/${r.base}: unknown owner_class ${r.owner_class}`);
    check(r.recommended_action.trim() !== "", `${r.chart}/${r.base}: missing recommended_action`);
    check(r.evidence_path.trim() !== "", `${r.chart}/${r.base}: missing evidence_path`);
    check(!/^(pass|fixed)$/i.test(r.result), `${r.chart}/${r.base}: a model-gap row must not be marked pass/fixed`);
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
  console.log(`wrote model-gap workdown -> ${relativeRepo(outDir)}/ (${out.rows.length} rows)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.rows);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run model-gap-workdown`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run model-gap-workdown`);
  }
  console.log(`verified model-gap workdown for ${out.rows.length} rows`);
} else {
  console.log(`Usage:
  node scripts/generate-model-gap-workdown.mjs --generate
  node scripts/generate-model-gap-workdown.mjs --verify`);
}
