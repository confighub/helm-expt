#!/usr/bin/env node

// Target-prerequisite action packets.
//
// Turns data/target-prerequisite-workdown/ from a queue into practical
// preflight/action guidance: one action packet per workdown row that says what to
// do before rerunning a non-green K/G/P row -- create a Namespace, stage a Secret,
// install CRDs, provide an external service, provide storage/topology, or ask for
// operator review -- with the required inputs, the evidence to look for after
// staging, and the rerun command.
//
// Read-only projection over data/target-prerequisite-workdown/workdown.csv.
// `automatic` is false for every packet: this is a plan/preflight layer, not
// proof of automated execution. It runs nothing and edits no runs/ receipts.
// --verify regenerates and byte-compares, and FAILS if a workdown row lacks a
// packet, a packet has an unknown action_kind, `automatic: true` appears without
// committed evidence, a concrete prerequisite name is lost, or a
// semantic-parity-passed row lacks a rerun command.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const WORKDOWN = "data/target-prerequisite-workdown/workdown.csv";

const outDir = join(repoRoot, "data", "target-prerequisite-actions");
const csvPath = join(outDir, "actions.csv");
const jsonPath = join(outDir, "actions.json");
const summaryPath = join(outDir, "summary.md");

const ACTION_KINDS = new Set([
  "create-namespace",
  "stage-secret",
  "install-crds",
  "provide-external-service",
  "provide-storage-or-topology",
  "operator-review",
  "unknown-preflight",
]);

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

// --- Action mapping -------------------------------------------------------

function actionKind(prereqKind, ownerClass, reason) {
  switch (prereqKind) {
    case "namespace": return "create-namespace";
    case "secret": return "stage-secret";
    case "crd": return "install-crds";
    case "external-api": return "provide-external-service";
    case "storage":
    case "object-store":
    case "topology": return "provide-storage-or-topology";
    default:
      // unknown prerequisite kind: a render-input/value gap the user supplies is a
      // preflight; a runtime/operational residue is an operator review.
      return ownerClass === "user-stage" ? "unknown-preflight" : "operator-review";
  }
}

// Machine-readable required inputs, derived from the extracted prerequisite name.
function requiredInputs(actionKindValue, prereqName) {
  const named = prereqName && prereqName !== "unknown" ? prereqName.split(";").map((s) => s.trim()).filter(Boolean) : [];
  if (named.length) return named;
  switch (actionKindValue) {
    case "create-namespace": return ["the target Namespace named by the chart"];
    case "stage-secret": return ["the required Secret(s) named in the receipt"];
    case "install-crds": return ["the chart's CRDs"];
    case "provide-external-service": return ["the upstream service/endpoint the workload connects to"];
    case "provide-storage-or-topology": return ["a target with the required storage/topology"];
    case "unknown-preflight": return ["the missing Helm input value(s)"];
    default: return ["operator review of the runtime residue"];
  }
}

function evidenceRequired(actionKindValue, lane) {
  const lanePass = `then a fresh ${lane} parity receipt for this base`;
  switch (actionKindValue) {
    case "create-namespace": return `the named Namespace exists on the target before apply; ${lanePass}`;
    case "stage-secret": return `the named Secret(s) present in the target namespace before apply; ${lanePass}`;
    case "install-crds": return `the required CRDs Established on the target before apply; ${lanePass}`;
    case "provide-external-service": return `the upstream service/endpoint reachable from the workload; ${lanePass}`;
    case "provide-storage-or-topology": return `a bound PVC / a target with the required topology; ${lanePass}`;
    case "operator-review": return `an operator decision recorded for this base/target; ${lanePass}`;
    default: return `the missing input(s) supplied and the re-render matching regular Helm; ${lanePass}`;
  }
}

function constructRerun(chart, version, base, lane) {
  return lane === "K"
    ? `npm run kind-parity:run -- --chart ${chart} --version ${version} --base ${base}`
    : `npm run live-parity:run -- --recipe recipes/${chart}/${version} --base ${base}`;
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "base",
  "lane",
  "prerequisite_kind",
  "prerequisite_name",
  "action_kind",
  "owner_class",
  "required_inputs",
  "evidence_required",
  "rerun_command",
  "automatic",
  "source_receipt",
  "support_artifact",
];

function buildPackets() {
  return readCsv(WORKDOWN).map((w) => {
    const ak = actionKind(w.prerequisite_kind, w.owner_class, w.recommended_next_action);
    const inputs = requiredInputs(ak, w.prerequisite_name);
    const rerun = (w.rerun_command ?? "").trim() || constructRerun(w.chart, w.version, w.base, w.lane);
    return {
      chart: w.chart,
      version: w.version,
      base: w.base,
      lane: w.lane,
      prerequisite_kind: w.prerequisite_kind,
      prerequisite_name: w.prerequisite_name,
      action_kind: ak,
      owner_class: w.owner_class,
      required_inputs: inputs,
      evidence_required: evidenceRequired(ak, w.lane),
      rerun_command: rerun,
      automatic: false,
      source_receipt: w.evidence_path,
      support_artifact: w.support_artifact,
      _semParity: w.semantic_parity_passed,
    };
  });
}

function flatRow(p) {
  return { ...p, required_inputs: p.required_inputs.join("; "), automatic: String(p.automatic) };
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));
}

function mdCount(title, pairs) {
  return [`| ${title} | Rows |`, "| --- | ---: |", ...pairs.map(([k, v]) => `| \`${k || "(blank)"}\` | ${v} |`)].join("\n");
}

function buildJson(packets) {
  return `${JSON.stringify(
    {
      kind: "TargetPrerequisiteActions",
      unofficial: true,
      description:
        "One action packet per target-prerequisite-workdown row: what to do before rerunning a non-green K/G/P row (create-namespace / stage-secret / install-crds / provide-external-service / provide-storage-or-topology / operator-review / unknown-preflight), the required inputs, the evidence to look for after staging, and the rerun command. automatic is false for every packet (plan/preflight layer, not automation proof). Generated by scripts/generate-target-prerequisite-actions.mjs; do not hand-edit.",
      source: WORKDOWN,
      packetCount: packets.length,
      byActionKind: Object.fromEntries(countBy(packets, "action_kind")),
      packets: packets.map((p) => ({
        chart: p.chart,
        version: p.version,
        base: p.base,
        lane: p.lane,
        prerequisite_kind: p.prerequisite_kind,
        prerequisite_name: p.prerequisite_name,
        action_kind: p.action_kind,
        owner_class: p.owner_class,
        required_inputs: p.required_inputs,
        evidence_required: p.evidence_required,
        rerun_command: p.rerun_command,
        automatic: p.automatic,
        source_receipt: p.source_receipt,
        support_artifact: p.support_artifact,
      })),
    },
    null,
    2,
  )}\n`;
}

function buildSummary(packets) {
  const lines = [];
  lines.push("# Target-Prerequisite Action Packets");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-target-prerequisite-actions.mjs`. Do not hand-edit. Regenerate");
  lines.push("with `npm run target-prerequisite-actions`.");
  lines.push("");
  lines.push("One **action packet** per [target-prerequisite-workdown](../target-prerequisite-workdown/summary.md)");
  lines.push("row: the concrete preflight to do **before** rerunning a non-green K/G/P row, with");
  lines.push("the required inputs, the evidence to look for after staging, and the rerun");
  lines.push("command. Every packet is `automatic: false` — this is a plan/preflight layer, not");
  lines.push("proof of automated execution. See");
  lines.push("[remote-images-and-supported-bases](../../docs/user/remote-images-and-supported-bases.md)");
  lines.push("for the sibling image story, and");
  lines.push("[residue-families](../../docs/reference/residue-families.md) for the vocabulary.");
  lines.push("");
  lines.push(`## ${packets.length} action packets`);
  lines.push("");
  lines.push(mdCount("Action kind", countBy(packets, "action_kind")));
  lines.push("");
  lines.push(mdCount("Owner class", countBy(packets, "owner_class")));
  lines.push("");
  lines.push("## Packets");
  lines.push("");
  lines.push("| Chart | Base | Lane | Action | Required inputs | Rerun after staging |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const p of packets) {
    lines.push(`| ${p.chart}@${p.version} | ${p.base} | ${p.lane} | ${p.action_kind} | ${p.required_inputs.join("; ")} | \`${p.rerun_command}\` |`);
  }
  lines.push("");
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Read-only projection over the target-prerequisite workdown. No live run, no");
  lines.push("  cluster, no `runs/` edit, and nothing marked fixed or automated.");
  lines.push("- `automatic: false` on every packet; staging and the rerun are deliberate steps.");
  lines.push("- The rerun command is what to run *after* the prerequisite is staged, not now.");
  lines.push("");
  return `${lines.join("\n")}`;
}

// --- Invariants -----------------------------------------------------------

function checkInvariants(packets) {
  const workdown = readCsv(WORKDOWN);
  check(packets.length === workdown.length, `packet count ${packets.length} != workdown rows ${workdown.length}`);
  const key = (r) => `${r.chart}|${r.version}|${r.base}|${r.lane}`;
  const packetKeys = new Set(packets.map(key));
  for (const w of workdown) check(packetKeys.has(key(w)), `workdown row without an action packet: ${key(w)}`);
  // map workdown name by key to check concrete names are not lost
  const wdName = new Map(workdown.map((w) => [key(w), w.prerequisite_name]));
  for (const p of packets) {
    check(ACTION_KINDS.has(p.action_kind), `${p.chart}/${p.base}: unknown action_kind ${p.action_kind}`);
    check(p.automatic === false, `${p.chart}/${p.base}: automatic must be false without committed automation evidence`);
    const wn = wdName.get(key(p));
    if (wn && wn !== "unknown") check(p.prerequisite_name === wn, `${p.chart}/${p.base}: concrete prerequisite name lost in the action packet`);
    if (p._semParity === "yes") check(p.rerun_command.trim() !== "", `${p.chart}/${p.base}: semantic-parity-passed row lacks a rerun command`);
    check(p.required_inputs.length > 0, `${p.chart}/${p.base}: empty required_inputs`);
  }
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const packets = buildPackets();
  return {
    packets,
    csv: toCsv(CSV_HEADERS, packets.map(flatRow)),
    json: buildJson(packets),
    summary: buildSummary(packets),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  checkInvariants(out.packets);
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  console.log(`wrote target-prerequisite actions -> ${relativeRepo(outDir)}/ (${out.packets.length} packets)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.packets);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run target-prerequisite-actions`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run target-prerequisite-actions`);
  }
  console.log(`verified target-prerequisite actions for ${out.packets.length} packets`);
} else {
  console.log(`Usage:
  node scripts/generate-target-prerequisite-actions.mjs --generate
  node scripts/generate-target-prerequisite-actions.mjs --verify`);
}
