#!/usr/bin/env node

// Target-prerequisite workdown.
//
// The complement of model-gap-workdown: non-pass rows where the catalog model may
// be fine, but the target/user/operator has to stage a prerequisite or choose a
// target shape before the row can pass -- a CRD, Namespace, Secret, storage /
// object-store, external controller/API, or target topology/identity.
//
// It tells a user/operator exactly what must exist before a base can be used, and
// who owns it (user-stage / catalog-support / target-policy / operator-review /
// upstream-or-registry).
//
// Read-only projection over committed decisions + matrix + receipts:
//   - data/kind-parity-decisions/decisions.csv (K-lane target residues)
//   - data/live-parity-decisions/decisions.csv (G/P-lane target residues)
//   - data/master-catalog-matrix/matrix.csv    (cross-check)
//   - data/live-parity-rerun-plan/rerun-plan.csv (rerun command after staging)
//   - the linked receipts (read-only) for the exact prerequisite name
// It runs nothing, edits no runs/ receipts, and marks no row fixed or pass.
// --verify regenerates and byte-compares, and FAILS if any row lacks an owner
// class, a next action, or a prerequisite name (extracted or explicit `unknown`).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const KIND_DECISIONS = "data/kind-parity-decisions/decisions.csv";
const LIVE_DECISIONS = "data/live-parity-decisions/decisions.csv";
const RERUN = "data/live-parity-rerun-plan/rerun-plan.csv";

// Target/user-prerequisite residues (the complement of the model-gap residues;
// remote-image, hook-lifecycle, gitops-runtime, and the model-gap residues are
// handled by their own surfaces and are excluded here).
const K_RESIDUES = new Set(["target-prerequisite-crds", "target-prerequisite-secret", "target-prerequisite-namespace", "target-runtime", "render-input"]);
const GP_RESIDUES = new Set(["target-prerequisite", "target-runtime", "operate-policy", "target-fit"]);

const outDir = join(repoRoot, "data", "target-prerequisite-workdown");
const csvPath = join(outDir, "workdown.csv");
const jsonPath = join(outDir, "workdown.json");
const summaryPath = join(outDir, "summary.md");

const KINDS = new Set(["crd", "namespace", "secret", "storage", "object-store", "topology", "external-api", "image", "unknown"]);
const OWNERS = new Set(["user-stage", "catalog-support", "target-policy", "operator-review", "upstream-or-registry"]);

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

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

// --- Classification -------------------------------------------------------

function prereqKind(residue, reason) {
  const r = (reason ?? "").toLowerCase();
  if (residue.includes("crd") || /\bcrds?\b/.test(r)) return "crd";
  if (residue.includes("secret") || /\bsecret\b/.test(r)) return "secret";
  if (residue.includes("namespace") || /\bnamespace\b/.test(r)) return "namespace";
  if (residue === "target-fit" || /metadata|provider identity|aws|eks|platform/.test(r)) return "topology";
  if (/upstream not ready|endpoint|external|\bnats\b|\bapi server\b/.test(r)) return "external-api";
  if (/storage|pvc|persistent|object.?store|ceph|bucket/.test(r)) return "storage";
  return "unknown";
}

// owner by kind + reason
function ownerOf(kind, reason) {
  const r = (reason ?? "").toLowerCase();
  if (kind === "crd") return /cert-manager/.test(r) ? "operator-review" : "user-stage";
  if (kind === "secret" || kind === "namespace") return "user-stage";
  if (kind === "topology") return "target-policy";
  if (kind === "external-api") return "operator-review";
  if (kind === "storage" || kind === "object-store") return "target-policy";
  // unknown: render-input is a user input; operate-policy/runtime is a review
  if (/values missing|render-input/.test(r)) return "user-stage";
  return "operator-review";
}

function nextActionOf(kind, reason, name) {
  const named = name && name !== "unknown" ? ` (${name})` : "";
  const r = (reason ?? "").toLowerCase();
  if (kind === "crd") return `Stage the required CRDs${named} on the target (or use the CRD-rendering base), then rerun.`;
  if (kind === "secret") return `Create the required Secret(s)${named} on the target as a target fact, then rerun.`;
  if (kind === "namespace") return `Create the required Namespace${named} on the target, then rerun.`;
  if (kind === "topology") return `Run on a target with the required platform identity${named} (e.g. AWS/EKS metadata + providerID), or use a target-scoped base.`;
  if (kind === "external-api") return `Provide the required upstream service/endpoint${named} as a stack dependency or target fact, then rerun.`;
  if (kind === "storage" || kind === "object-store") return `Provide the required ${kind}${named} on the target, then rerun.`;
  if (/values missing|render-input/.test(r)) return "Supply the required Helm input values for this base, then rerun.";
  if (/init|unseal/.test(r)) return "Perform the operational readiness step (e.g. init/unseal) on the target, then rerun.";
  return "Review the runtime residue on the target (pod not ready / crash loop / ContainerCreating); stage any missing dependency, then rerun.";
}

// Extract a prerequisite name from the receipt + reason. Returns "unknown" when
// nothing concrete is extractable (never invents).
function extractName(receiptRel, reason) {
  const names = [];
  const r = reason ?? "";
  if (/cert-manager CRDs/i.test(r)) names.push("cert-manager CRDs");
  if (/AWS\/EKS|metadata|provider identity/i.test(r)) names.push("AWS/EKS metadata + node providerID");
  const abs = receiptRel ? join(repoRoot, receiptRel) : "";
  if (abs && existsSync(abs)) {
    const text = readFileSync(abs, "utf8");
    for (const m of text.matchAll(/missingSecret:\s*["']?([\w.\-/]+)/g)) names.push(`Secret ${m[1]}`);
    for (const m of text.matchAll(/missingNamespace:\s*["']?([\w.\-/]+)/g)) names.push(`Namespace ${m[1]}`);
    for (const m of text.matchAll(/namespaces?\s+"([^"]+)"\s+not found/g)) names.push(`Namespace ${m[1]}`);
    for (const m of text.matchAll(/secret\s+"([^"]+)"\s+not found/gi)) names.push(`Secret ${m[1]}`);
    // Required Helm input values surfaced by the renderer, e.g. "nfs.server: Required value".
    for (const m of text.matchAll(/([\w.]+):\s*Required value/g)) names.push(`value ${m[1].replace(/^\.+/, "")}`);
  }
  return uniq(names).join("; ") || "unknown";
}

function supportArtifact(decisionSA, chart, version) {
  if (decisionSA && decisionSA.trim()) return clean(decisionSA);
  for (const f of ["target-prerequisite-plan.yaml", "target-topology.yaml", "runtime-review.yaml", "operating-policy.yaml"]) {
    const rel = `recipes/${chart}/${version}/${f}`;
    if (existsSync(join(repoRoot, rel))) return rel;
  }
  return "";
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "base",
  "lane",
  "result",
  "prerequisite_kind",
  "prerequisite_name",
  "semantic_parity_passed",
  "owner_class",
  "support_artifact",
  "recommended_next_action",
  "rerun_command",
  "evidence_path",
];

function rerunIndex(rerun) {
  const m = new Map();
  for (const r of rerun) {
    const lane = r.lane === "two-cluster-kind-parity" ? "K" : r.lane === "configHub-oci-live-comparison" ? "G/P" : r.lane;
    m.set(`${r.chart}|${r.version}|${r.base}|${lane}`, clean(r.rerun_command));
  }
  return m;
}

function buildRows() {
  const rerun = rerunIndex(readCsv(RERUN));
  const out = [];

  const push = (chart, version, base, lane, result, residue, reason, receipt, semParity, decisionSA) => {
    const kind = prereqKind(residue, reason);
    const name = extractName(receipt, reason);
    out.push({
      chart,
      version,
      base,
      lane,
      result,
      prerequisite_kind: kind,
      prerequisite_name: name,
      semantic_parity_passed: semParity,
      owner_class: ownerOf(kind, reason),
      support_artifact: supportArtifact(decisionSA, chart, version),
      recommended_next_action: nextActionOf(kind, reason, name),
      rerun_command: rerun.get(`${chart}|${version}|${base}|${lane}`) ?? "",
      evidence_path: receipt,
    });
  };

  for (const r of readCsv(KIND_DECISIONS)) {
    if (!K_RESIDUES.has(r.residue_category)) continue;
    const sem = r.semantic_parity === "pass" ? "yes" : r.semantic_parity === "defect" ? "no" : "unknown";
    push(r.chart, r.version, r.base, "K", r.result, r.residue_category, r.reason, r.receipt, sem, "");
  }
  for (const r of readCsv(LIVE_DECISIONS)) {
    if (!GP_RESIDUES.has(r.residue_category)) continue;
    const sem = /parity passed/i.test(r.reason ?? "") ? "yes" : "unknown";
    push(r.chart, r.version, r.variant, "G/P", r.result, r.residue_category, r.reason, r.receipt, sem, r.support_artifact);
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
      kind: "TargetPrerequisiteWorkdown",
      unofficial: true,
      description:
        "Target/user/operator prerequisites: non-pass rows that need something staged on the target (CRD, Namespace, Secret, storage, external API, or target topology) before the base can pass. The complement of model-gap-workdown. Per row: prerequisite kind + name (or unknown), whether semantic parity already passed, owner class, support artifact, recommended action, rerun command, and evidence. Read-only; marks no row fixed. Generated by scripts/generate-target-prerequisite-workdown.mjs; do not hand-edit.",
      sources: [KIND_DECISIONS, LIVE_DECISIONS, RERUN, "runs/live-*/**/receipt.yaml"],
      rowCount: rows.length,
      byKind: Object.fromEntries(countBy(rows, "prerequisite_kind")),
      byOwner: Object.fromEntries(countBy(rows, "owner_class")),
      rows,
    },
    null,
    2,
  )}\n`;
}

function buildSummary(rows) {
  const lines = [];
  lines.push("# Target-Prerequisite Workdown");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-target-prerequisite-workdown.mjs`. Do not hand-edit. Regenerate");
  lines.push("with `npm run target-prerequisite-workdown`.");
  lines.push("");
  lines.push("The complement of [model-gap-workdown](../model-gap-workdown/summary.md): these");
  lines.push("rows do **not** need a catalog model change — the **target/user/operator** has to");
  lines.push("stage a prerequisite or choose a target shape first (a CRD, Namespace, Secret,");
  lines.push("storage, external API, or target topology). Each row says exactly **what must");
  lines.push("exist** before the base can be used, and **who owns it**. It marks nothing fixed.");
  lines.push("");
  lines.push("Source decisions: [kind-parity-decisions](../kind-parity-decisions/summary.md) and");
  lines.push("[live-parity-decisions](../live-parity-decisions/summary.md); families in");
  lines.push("[residue-families](../../docs/reference/residue-families.md). For the full non-green");
  lines.push("triage see [matrix-completion-audit](../matrix-completion-audit/summary.md).");
  lines.push("");
  lines.push(`## ${rows.length} target-prerequisite rows`);
  lines.push("");
  lines.push(mdCount("Prerequisite kind", countBy(rows, "prerequisite_kind")));
  lines.push("");
  lines.push(mdCount("Owner class", countBy(rows, "owner_class")));
  lines.push("");
  lines.push("## Rows");
  lines.push("");
  lines.push("| Chart | Base | Lane | Kind | Prerequisite | Owner | Parity |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    lines.push(`| ${r.chart}@${r.version} | ${r.base} | ${r.lane} | ${r.prerequisite_kind} | ${r.prerequisite_name} | ${r.owner_class} | ${r.semantic_parity_passed} |`);
  }
  lines.push("");
  lines.push("## How to read a row");
  lines.push("");
  lines.push("- **prerequisite_kind/name** is what must exist on the target; `unknown` means the");
  lines.push("  exact object was not extractable from the committed receipt (not invented).");
  lines.push("- **semantic_parity_passed = yes** means the rendered objects already match regular");
  lines.push("  Helm — only the target prerequisite is missing, so this is usually a user/target");
  lines.push("  action, not a catalog defect.");
  lines.push("- **owner_class** routes it: `user-stage` (stage the object), `target-policy`");
  lines.push("  (choose/provide the target shape), `operator-review` (operational step or a");
  lines.push("  dependency to provision), `catalog-support`, or `upstream-or-registry`.");
  lines.push("");
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Read-only projection over committed decisions and receipts. No live run, no");
  lines.push("  kind cluster, no `runs/` edit, and no row marked fixed or pass.");
  lines.push("- The rerun command is what to run *after* the prerequisite is staged, not now.");
  lines.push("");
  return `${lines.join("\n")}`;
}

// --- Invariants -----------------------------------------------------------

function checkInvariants(rows) {
  for (const r of rows) {
    check(KINDS.has(r.prerequisite_kind), `${r.chart}/${r.base}: unknown prerequisite_kind ${r.prerequisite_kind}`);
    check(OWNERS.has(r.owner_class), `${r.chart}/${r.base}: unknown owner_class ${r.owner_class}`);
    check(r.recommended_next_action.trim() !== "", `${r.chart}/${r.base}: missing recommended_next_action`);
    check(r.prerequisite_name.trim() !== "", `${r.chart}/${r.base}: prerequisite_name must be a name or explicit 'unknown'`);
    check(!/^(pass|fixed)$/i.test(r.result), `${r.chart}/${r.base}: a target-prerequisite row must not be marked pass/fixed`);
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
  console.log(`wrote target-prerequisite workdown -> ${relativeRepo(outDir)}/ (${out.rows.length} rows)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.rows);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run target-prerequisite-workdown`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run target-prerequisite-workdown`);
  }
  console.log(`verified target-prerequisite workdown for ${out.rows.length} rows`);
} else {
  console.log(`Usage:
  node scripts/generate-target-prerequisite-workdown.mjs --generate
  node scripts/generate-target-prerequisite-workdown.mjs --verify`);
}
