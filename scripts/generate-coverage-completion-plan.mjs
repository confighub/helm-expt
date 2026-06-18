#!/usr/bin/env node

// Coverage completion plan.
//
// Makes the path to 100% *verified disposition* (not 100% green) explicit by
// collapsing every non-green master-matrix cell into a small number of ACTION
// FAMILIES, ranked by cells-cleared-per-action. A correct watch/blocked/refused/
// n-a with evidence and a named next action is a valid product answer.
//
// Read-only projection over committed surfaces (it runs nothing and edits no
// runs/ receipts):
//   - data/matrix-completion-audit/audit.csv      (the non-green cell spine + triage)
//   - data/master-catalog-matrix/matrix.csv       (lifecycle route contract)
//   - data/target-prerequisite-actions/actions.csv (prereq action kind/owner)
//   - data/model-gap-workdown/workdown.csv         (model-gap kind)
//   - data/remote-image-runtime-workdown/workdown.csv (image rows)
//   - data/local-live-triage/triage.csv            (local-kind non-pass route class)
//   - data/variant-promotion-proof-batches/, data/live-run-blocks/ (commands)
//
// Predictions (expected status after a run/fix/stage) are marked prediction=true;
// recorded dispositions (record-decision / refuse-or-scope) are not predictions.
// --verify regenerates and byte-compares, and FAILS if a non-green cell is not
// assigned to exactly one family, an action_type/owner_lane is unknown, or the
// ranked top-10 is missing.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const AUDIT = "data/matrix-completion-audit/audit.csv";
const MATRIX = "data/master-catalog-matrix/matrix.csv";
const TARGET_ACTIONS = "data/target-prerequisite-actions/actions.csv";
const MODEL_GAP = "data/model-gap-workdown/workdown.csv";
const REMOTE_IMAGE = "data/remote-image-runtime-workdown/workdown.csv";
const VARIANT_PROMOTION = "data/variant-promotion/status.csv";

const outDir = join(repoRoot, "data", "coverage-completion-plan");
const csvPath = join(outDir, "actions.csv");
const jsonPath = join(outDir, "actions.json");
const summaryPath = join(outDir, "summary.md");

const ACTION_TYPES = new Set([
  "run-live", "run-kind", "run-promotion", "record-decision", "fix-model",
  "stage-prereq", "refresh-image", "lifecycle-observe", "refuse-or-scope",
]);
const OWNER_LANES = new Set(["Codex-live", "Claude-non-live", "product-decision", "upstream-implementation"]);

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
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") { field += c; }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function readCsv(rel) {
  const abs = join(repoRoot, rel);
  check(existsSync(abs), `missing source ${rel}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((c) => c.trim() !== ""));
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

// --- Classification -------------------------------------------------------

const k = (chart, version, base, lane) => `${chart}|${version}|${base}|${lane}`;
const kNoLane = (chart, version, base) => `${chart}|${version}|${base}`;

function ownerForPrereq(actionKind) {
  if (["create-namespace", "stage-secret", "install-crds", "unknown-preflight"].includes(actionKind)) return "Claude-non-live";
  return "product-decision"; // provide-external-service / provide-storage-or-topology / operator-review
}

function classifyLocalLive(cell) {
  const text = `${cell.reason ?? ""} ${cell.next_action ?? ""} ${cell.owner ?? ""}`.toLowerCase();
  if (cell.owner === "image-dependency") {
    return fam("refresh-image", "remote-image-refresh", "Claude-non-live", true,
      "pass after the image is pullable (refresh tag / pin digest / mirror)", "", "a pullable image or retained digest",
      "local-live-triage", ["#753"]);
  }
  if (cell.owner === "target-prerequisite") {
    return fam("stage-prereq", "stage-secret", "Claude-non-live", true,
      "pass after the prerequisite is staged", "", "required Secret/ConfigMap/mount target fact",
      "local-live-triage", ["#248", "#753"]);
  }
  if (cell.owner === "webhook-cert-lifecycle") {
    return fam("stage-prereq", "webhook-cert-lifecycle", "Claude-non-live", true,
      "pass after the certificate lifecycle is modeled and observed", "", "webhook serving certificate route or target fact",
      "local-live-triage", ["#248", "#753"]);
  }
  if (cell.owner === "admission-or-rbac") {
    return fam("stage-prereq", "admission-or-rbac", "product-decision", true,
      "pass after a target policy decision or base change", "", "permission/admission preflight or support boundary",
      "local-live-triage", ["#248", "#753"]);
  }
  if (cell.owner === "api-version-unsupported") {
    return fam("fix-model", "api-version-compatibility", "Claude-non-live", true,
      "pass after the chart/base targets a served Kubernetes API version", "", "",
      "local-live-triage", ["#248", "#753"]);
  }
  if (cell.owner === "cloud-or-provider-prerequisite") {
    return fam("stage-prereq", "provide-external-service", "product-decision", true,
      "pass after the provider prerequisite is modeled and staged", "", "provider credentials, cloud API, bucket, DNS, or volume",
      "local-live-triage", ["#248", "#753"]);
  }
  if (cell.owner === "lifecycle-ordering") {
    return fam("lifecycle-observe", "lifecycle-route", "Codex-live", true,
      "observed", "data/lifecycle-route-actions (route/action packets)", "",
      "local-live-triage", ["#248", "#753"]);
  }
  if (cell.owner === "runtime-readiness") {
    return fam("stage-prereq", "operator-review", "product-decision", true,
      "pass after the runtime residue is reviewed or a better base is selected", "", "runtime review or target-specific support decision",
      "local-live-triage", ["#248", "#753"]);
  }
  if (/imagepull|errimagepull|image-pull|image inspect|image/.test(text)) {
    return fam("refresh-image", "remote-image-refresh", "Claude-non-live", true,
      "pass after the image is pullable (refresh tag / pin digest / mirror)", "", "a pullable image or retained digest",
      "remote-image-runtime-workdown", ["#753"]);
  }
  if (/required crd|crds? missing|target fact/.test(text)) {
    return fam("stage-prereq", "install-crds", "Claude-non-live", true,
      "pass after the prerequisite is staged", "", "required CRDs as target facts or a CRD-rendering base",
      "target-prerequisite-workdown", ["#248", "#753"]);
  }
  if (/secret|configmap|mount|createcontainerconfigerror|containercreating/.test(text)) {
    return fam("stage-prereq", "stage-secret", "Claude-non-live", true,
      "pass after the prerequisite is staged", "", "required Secret/ConfigMap/mount target fact",
      "target-prerequisite-workdown", ["#248", "#753"]);
  }
  if (/invalid|required value|required helm values|apply-blocked/.test(text)) {
    return fam("fix-model", "base-design", "Claude-non-live", true,
      "pass after the model/recipe change", "", "",
      "model-gap-workdown", ["#248", "#753"]);
  }
  if (/crashloopbackoff|not-ready|runtime|readiness|podinitializing/.test(text)) {
    return fam("stage-prereq", "operator-review", "product-decision", true,
      "pass after the runtime residue is reviewed or a better base is selected", "", "runtime review or target-specific support decision",
      "target-prerequisite-workdown", ["#248", "#753"]);
  }
  return fam("stage-prereq", "local-kind-apply-harness", "upstream-implementation", true,
    "pass after the local-kind apply harness is fixed", "", "local-kind kubectl-apply harness fix",
    "outcome-coverage/base-outcomes", ["#248", "#753"]);
}

// Returns the family descriptor for one non-green audit cell.
function classify(cell, idx) {
  const { lane, state, completion_class: cc, reason } = cell;
  // The audit splits the live lane into G and P; the workdowns key those rows as
  // "G/P". Normalize for the join so model-gap/prereq sub-kinds resolve.
  const laneJoin = lane === "G" || lane === "P" ? "G/P" : lane;
  const ri = idx.remoteImage.has(kNoLane(cell.chart, cell.version, cell.variant));

  if (lane === "promotion") {
    if (state === "todo") {
      return fam("run-promotion", "promotion-ready", "Codex-live", true,
        "pass or watch", "npm run … (data/variant-promotion-proof-batches: 18 serial batches)", "",
        "variant-promotion-closeout", ["#948"]);
    }
    return fam("refuse-or-scope", "promotion-changeset-bug", "upstream-implementation", false,
      "watch (verified); pass once the server fix lands", "", "ConfigHub changeset add-new-units fix",
      "variant-promotion-closeout", ["#682", "#948"]);
  }

  if (lane === "lifecycle") {
    const contract = (idx.lifecycleContract.get(kNoLane(cell.chart, cell.version, cell.variant)) ?? "").trim();
    if (contract && contract !== "n/a") {
      return fam("lifecycle-observe", "lifecycle-route", "Codex-live", true,
        "observed", "data/lifecycle-route-actions (route/action packets)", "",
        "lifecycle-route-actions", ["#248", "#753"]);
    }
    return fam("record-decision", "lifecycle-not-applicable", "product-decision", false,
      "n/a (no routed lifecycle to observe)", "", "", "master-catalog-matrix", ["#753"]);
  }

  // core lanes G/P/K/L
  if (ri) {
    return fam("refresh-image", "remote-image-refresh", "Claude-non-live", true,
      "pass after the image is pullable (refresh tag / pin digest / mirror)", "", "a pullable image or retained digest",
      "remote-image-runtime-workdown", ["#753"]);
  }
  if (cc === "needs-run") {
    if (lane === "K") return fam("run-kind", "kind-ready", "Codex-live", true, "pass or watch",
      "npm run kind-parity:run … (data/live-run-blocks)", "", "kind-parity-decisions", ["#248", "#753"]);
    return fam("run-live", "live-ready", "Codex-live", true, "pass or watch",
      "npm run live-parity:run … (data/live-run-blocks)", "", "live-parity-decisions", ["#248", "#753"]);
  }
  if (cc === "needs-modeling") {
    const mk = idx.modelGap.get(k(cell.chart, cell.version, cell.variant, laneJoin))?.model_gap_kind ?? "model-gap";
    return fam("fix-model", mk, "Claude-non-live", true, "pass after the model/recipe change", "",
      "", "model-gap-workdown", ["#248", "#753"]);
  }
  if (cc === "needs-target-or-prereq-fix") {
    if (lane === "L") {
      return classifyLocalLive(cell);
    }
    const tp = idx.targetActions.get(k(cell.chart, cell.version, cell.variant, laneJoin));
    const ak = tp?.action_kind ?? "stage-prereq-other";
    const name = tp?.prerequisite_name && tp.prerequisite_name !== "unknown" ? tp.prerequisite_name : "see target-prerequisite-actions";
    return fam("stage-prereq", ak, ownerForPrereq(ak), true, "pass after the prerequisite is staged", "",
      name, "target-prerequisite-workdown", ["#248", "#753"]);
  }
  // already-decided (watch) -> verified disposition; the action is to keep it (or upgrade separately)
  return fam("record-decision", "verified-watch", "product-decision", false,
    `${state} (verified disposition; recorded with evidence)`, "", "", "(already recorded)", ["#753"]);
}

function fam(action_type, sub_group, owner_lane, prediction, expected_status, command, prerequisite, evidence_surface, linked_issues) {
  return { action_type, sub_group, owner_lane, prediction, expected_status, command, prerequisite, evidence_surface, linked_issues };
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "action_id", "action_type", "sub_group", "owner_lane", "affected_cell_count",
  "lanes", "command", "prerequisite", "expected_status", "prediction",
  "evidence_surface", "linked_issues", "affected_rows_sample",
];

function buildFamilies() {
  const audit = readCsv(AUDIT);
  const idx = {
    targetActions: new Map(readCsv(TARGET_ACTIONS).map((r) => [k(r.chart, r.version, r.base, r.lane), r])),
    modelGap: new Map(readCsv(MODEL_GAP).map((r) => [k(r.chart, r.version, r.base, r.lane), r])),
    remoteImage: new Set(readCsv(REMOTE_IMAGE).map((r) => kNoLane(r.chart, r.version, r.base))),
    lifecycleContract: new Map(readCsv(MATRIX).map((r) => [kNoLane(r.chart, r.version, r.variant), r.lifecycle_route_contract])),
  };

  const families = new Map();
  for (const cell of audit) {
    const d = classify(cell, idx);
    const key = `${d.action_type}::${d.sub_group}::${d.owner_lane}`;
    if (!families.has(key)) {
      families.set(key, {
        ...d,
        affected_rows: [],
        lanes: new Set(),
        evidence_surfaces: new Set(),
      });
    }
    const f = families.get(key);
    f.affected_rows.push(`${cell.chart}@${cell.version}/${cell.variant} [${cell.lane}]`);
    f.lanes.add(cell.lane);
    if (d.evidence_surface) f.evidence_surfaces.add(d.evidence_surface);
  }

  const list = [...families.values()].map((f) => ({
    ...f,
    affected_cell_count: f.affected_rows.length,
    lanes: [...f.lanes].sort(),
    evidence_surface: [...f.evidence_surfaces].sort().join("; "),
    linked_issues: f.linked_issues.join("; "),
  }));
  list.sort((a, b) => (b.affected_cell_count - a.affected_cell_count) || `${a.action_type}:${a.sub_group}`.localeCompare(`${b.action_type}:${b.sub_group}`));
  list.forEach((f, i) => { f.action_id = `CCP-${String(i + 1).padStart(2, "0")}`; });
  return list;
}

function flatRow(f) {
  const sample = f.affected_rows.slice(0, 8).join("; ") + (f.affected_rows.length > 8 ? ` (+${f.affected_rows.length - 8} more)` : "");
  return {
    action_id: f.action_id,
    action_type: f.action_type,
    sub_group: f.sub_group,
    owner_lane: f.owner_lane,
    affected_cell_count: f.affected_cell_count,
    lanes: f.lanes.join("|"),
    command: f.command,
    prerequisite: f.prerequisite,
    expected_status: f.expected_status,
    prediction: String(f.prediction),
    evidence_surface: f.evidence_surface,
    linked_issues: f.linked_issues,
    affected_rows_sample: sample,
  };
}

function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));
}

function sumBy(rows, key, val) {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) ?? 0) + r[val]);
  return [...m.entries()].sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0])));
}

function variantPromotionCounts() {
  const rows = readCsv(VARIANT_PROMOTION);
  const byMatrixValue = new Map();
  for (const row of rows) {
    const value = row.matrix_value || "unknown";
    byMatrixValue.set(value, (byMatrixValue.get(value) ?? 0) + 1);
  }
  return {
    proven: byMatrixValue.get("yes") ?? 0,
    watch: byMatrixValue.get("watch") ?? 0,
    todo: byMatrixValue.get("todo") ?? 0,
    blocked: byMatrixValue.get("no") ?? 0,
    nA: byMatrixValue.get("n/a") ?? 0,
  };
}

function buildJson(families) {
  const total = families.reduce((n, f) => n + f.affected_cell_count, 0);
  return `${JSON.stringify({
    kind: "CoverageCompletionPlan",
    unofficial: true,
    description:
      "The path to 100% VERIFIED DISPOSITION (not 100% green) for the master matrix, as a small set of ranked action families. Each family collapses many non-green cells into one action with an owner lane, command/prerequisite, expected status (predictions marked), evidence surface to regenerate, and linked issues. Generated by scripts/generate-coverage-completion-plan.mjs; do not hand-edit.",
    note: "A correct watch/blocked/refused/n-a with evidence and a named next action is a valid product answer; 100% means every cell has a verified disposition, not that every cell is green.",
    sources: [AUDIT, MATRIX, TARGET_ACTIONS, MODEL_GAP, REMOTE_IMAGE, "data/local-live-triage/triage.csv", "data/live-run-blocks", "data/variant-promotion-proof-batches"],
    nonGreenCellsCovered: total,
    familyCount: families.length,
    byActionType: Object.fromEntries(sumBy(families, "action_type", "affected_cell_count")),
    byOwnerLane: Object.fromEntries(sumBy(families, "owner_lane", "affected_cell_count")),
    top10: families.slice(0, 10).map((f) => ({ action_id: f.action_id, action_type: f.action_type, sub_group: f.sub_group, affected_cell_count: f.affected_cell_count, owner_lane: f.owner_lane })),
    families: families.map((f) => ({
      action_id: f.action_id,
      action_type: f.action_type,
      sub_group: f.sub_group,
      owner_lane: f.owner_lane,
      affected_cell_count: f.affected_cell_count,
      lanes: f.lanes,
      command: f.command,
      prerequisite: f.prerequisite,
      expected_status: f.expected_status,
      prediction: f.prediction,
      evidence_surface: f.evidence_surface,
      linked_issues: f.linked_issues,
      affected_rows: f.affected_rows,
    })),
  }, null, 2)}\n`;
}

function buildSummary(families) {
  const total = families.reduce((n, f) => n + f.affected_cell_count, 0);
  const promotion = variantPromotionCounts();
  const lines = [];
  lines.push("# Coverage Completion Plan");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  lines.push("`scripts/generate-coverage-completion-plan.mjs`. Do not hand-edit. Regenerate with");
  lines.push("`npm run coverage-completion-plan`.");
  lines.push("");
  lines.push("The path to **100% verified disposition** of the master matrix — *not* 100% green.");
  lines.push("A correct `watch` / `blocked` / `refused` / `n-a` with evidence and a named next");
  lines.push(`action is a valid product answer. This collapses the ${total} non-green cells from the`);
  lines.push("[matrix-completion-audit](../matrix-completion-audit/summary.md) into");
  lines.push(`**${families.length} action families**, ranked by cells-cleared-per-action, so a large`);
  lines.push("matrix becomes a short punch-list.");
  lines.push("");
  lines.push("Predictions (expected status after a run/fix/stage) are marked `prediction`;");
  lines.push("recorded dispositions (`record-decision` / `refuse-or-scope`) are not predictions.");
  lines.push("");
  lines.push("## Top 10 actions by cells cleared");
  lines.push("");
  lines.push("| # | Action | Family | Cells | Owner lane | Command / prerequisite |");
  lines.push("| --- | --- | --- | ---: | --- | --- |");
  for (const f of families.slice(0, 10)) {
    lines.push(`| ${f.action_id} | ${f.action_type} | ${f.sub_group} | ${f.affected_cell_count} | ${f.owner_lane} | ${f.command || f.prerequisite || "—"} |`);
  }
  lines.push("");
  lines.push("## Cells by action type");
  lines.push("");
  lines.push("| Action type | Cells |");
  lines.push("| --- | ---: |");
  for (const [t, n] of sumBy(families, "action_type", "affected_cell_count")) lines.push(`| \`${t}\` | ${n} |`);
  lines.push("");
  lines.push("## Cells by owner lane");
  lines.push("");
  lines.push("| Owner lane | Cells |");
  lines.push("| --- | ---: |");
  for (const [o, n] of sumBy(families, "owner_lane", "affected_cell_count")) lines.push(`| \`${o}\` | ${n} |`);
  lines.push("");
  lines.push("## Variant promotion (first-class family)");
  lines.push("");
  lines.push(`The promotion (V) lane is the loudest hole: **${promotion.proven} proven / ${promotion.watch} watch / ${promotion.todo} todo / ${promotion.blocked} blocked / ${promotion.nA} n/a**.`);
  const promoRun = families.find((f) => f.action_type === "run-promotion");
  const promoBug = families.find((f) => f.action_type === "refuse-or-scope");
  if (promoRun) lines.push(`- \`${promoRun.action_id}\` **run-promotion** — ${promoRun.affected_cell_count} ready promotions via the serial ConfigHub lane (#948); run plan in [variant-promotion-proof-batches](../variant-promotion-proof-batches/summary.md).`);
  if (promoBug) lines.push(`- \`${promoBug.action_id}\` **refuse-or-scope** — ${promoBug.affected_cell_count} watch rows blocked on the ConfigHub changeset add-new-units bug (#682); upstream server fix.`);
  lines.push("");
  lines.push("## All action families");
  lines.push("");
  lines.push("| # | Action | Family | Cells | Lanes | Owner | Expected (pred?) | Evidence surface | Issues |");
  lines.push("| --- | --- | --- | ---: | --- | --- | --- | --- | --- |");
  for (const f of families) {
    lines.push(`| ${f.action_id} | ${f.action_type} | ${f.sub_group} | ${f.affected_cell_count} | ${f.lanes.join("/")} | ${f.owner_lane} | ${f.expected_status}${f.prediction ? " (prediction)" : ""} | ${f.evidence_surface} | ${f.linked_issues} |`);
  }
  lines.push("");
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Read-only projection over committed surfaces. No live run, no `runs/` edit, no");
  lines.push("  status changed; the underlying decisions live in the surfaces this projects.");
  lines.push("- `expected_status` for run/fix/stage families is a **prediction**, not a claim;");
  lines.push("  the cell stays at its current disposition until a fresh receipt proves otherwise.");
  lines.push("- Owner lanes: `Codex-live` runs the serial live/promotion lane; `Claude-non-live`");
  lines.push("  is catalog/recipe/decision PR work; `product-decision` needs a scope/refuse call;");
  lines.push("  `upstream-implementation` needs the ConfigHub server changeset fix.");
  lines.push("");
  return `${lines.join("\n")}`;
}

// --- Invariants -----------------------------------------------------------

function checkInvariants(families) {
  const auditCount = readCsv(AUDIT).length;
  const total = families.reduce((n, f) => n + f.affected_cell_count, 0);
  check(total === auditCount, `families cover ${total} cells != ${auditCount} non-green audit cells`);
  check(families.length >= 10, `expected at least 10 families for a top-10; got ${families.length}`);
  for (const f of families) {
    check(ACTION_TYPES.has(f.action_type), `${f.action_id}: unknown action_type ${f.action_type}`);
    check(OWNER_LANES.has(f.owner_lane), `${f.action_id}: unknown owner_lane ${f.owner_lane}`);
    check(typeof f.prediction === "boolean", `${f.action_id}: prediction must be boolean`);
    check(f.expected_status.trim() !== "", `${f.action_id}: missing expected_status`);
    // record-decision / refuse-or-scope are recorded dispositions, not predictions
    if (["record-decision", "refuse-or-scope"].includes(f.action_type)) check(f.prediction === false, `${f.action_id}: ${f.action_type} must not be a prediction`);
  }
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const families = buildFamilies();
  return {
    families,
    csv: toCsv(CSV_HEADERS, families.map(flatRow)),
    json: buildJson(families),
    summary: buildSummary(families),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  checkInvariants(out.families);
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  const total = out.families.reduce((n, f) => n + f.affected_cell_count, 0);
  console.log(`wrote coverage completion plan -> ${relativeRepo(outDir)}/ (${out.families.length} families, ${total} cells)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.families);
  for (const [path, expected] of [[csvPath, out.csv], [jsonPath, out.json], [summaryPath, out.summary]]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run coverage-completion-plan`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run coverage-completion-plan`);
  }
  console.log(`verified coverage completion plan for ${out.families.length} families`);
} else {
  console.log(`Usage:
  node scripts/generate-coverage-completion-plan.mjs --generate
  node scripts/generate-coverage-completion-plan.mjs --verify`);
}
