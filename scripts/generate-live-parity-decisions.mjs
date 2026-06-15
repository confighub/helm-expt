#!/usr/bin/env node

// Live-parity (G/P-lane) decisions.
//
// The G/P-lane equivalent of data/kind-parity-decisions. Classifies the
// committed NON-PASS ConfigHub OCI + live Helm-vs-ConfigHub parity rows into
// product-readable decisions: for each watch/blocked row, what it means for a
// Helm user, who has to fix it, whether the chart/base is usable today, the
// next action, the support artifact, and the receipt.
//
// Read-only over committed evidence: data/live-helm-confighub-compare/summary.csv
// (+ the row's committed receipt only when a blocked reason is generic) and the
// existing recipe support artifacts. It does NOT run live, touch clusters, edit
// runs/ receipts, write into data/live-helm-confighub-compare/, or touch the
// master-matrix / status-dashboard generators. Output is a pure function of
// committed data; --verify regenerates and byte-compares.
//
// Honest framing: a `watch` row is known evidence with a named residue (the
// semantic Helm-vs-ConfigHub parity passed; a GitOps/runtime/operate condition
// remains). It is never a pass and never a failure. A `blocked` row did not
// reach the lane result; the decision names why and who owns the fix.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const SUMMARY_CSV = "data/live-helm-confighub-compare/summary.csv";

const outDir = join(repoRoot, "data", "live-parity-decisions");
const csvPath = join(outDir, "decisions.csv");
const jsonPath = join(outDir, "decisions.json");
const summaryPath = join(outDir, "summary.md");

// Residue category -> product-readable decision + the recipe support artifact
// that records/holds the decision, by convention.
const CATEGORIES = {
  "gitops-runtime": {
    blocker_owner: "needs GitOps controller-health review",
    usable_today: "watch — synced and converged; aggregate health needs explanation",
    decision: "Desired state synced through ConfigHub OCI/Argo and the workloads converged, and semantic Helm-vs-ConfigHub parity passed — but Argo's aggregate health is Progressing, or a resource reads OutOfSync while Healthy. Known GitOps controller-health residue, not a parity defect.",
    next_action: "Review the controller-health residue (aggregate vs per-resource health, sync state) and refresh the gitops-runtime-review support artifact.",
    support_artifact: "gitops-runtime-review.yaml",
  },
  "operate-policy": {
    blocker_owner: "needs operate review",
    usable_today: "watch — needs an operational readiness step",
    decision: "Semantic parity passed, but an operational policy/readiness step (for example init/unseal) is required before the workload is fully ready. Not a parity defect.",
    next_action: "Perform and record the operational step (e.g. Vault init/unseal) for the target scope; see the operating-policy artifact.",
    support_artifact: "operating-policy.yaml",
  },
  "target-runtime": {
    blocker_owner: "needs runtime review",
    usable_today: "watch — config correct, runtime unconfirmed",
    decision: "The rendered config matched regular Helm (semantic parity passed) but the workload did not reach the expected runtime state on the target. Runtime residue to review, not a parity defect.",
    next_action: "Review the runtime residue (pod errors / not ready) on the target and record a runtime-review support artifact.",
    support_artifact: "runtime-review.yaml",
  },
  "target-prerequisite": {
    blocker_owner: "user",
    usable_today: "yes, after staging the prerequisite",
    decision: "Usable once you stage the named prerequisite (for example a namespace, Secret, or CRD) on the target; the rendered objects matched regular Helm (semantic parity passed). The prerequisite is missing, not the configuration.",
    next_action: "Stage the named prerequisite as a target fact (see the target-prerequisite-plan), then the row can move to pass.",
    support_artifact: "target-prerequisite-plan.yaml",
  },
  "semantic-model-gap": {
    blocker_owner: "catalog",
    usable_today: "no — needs catalog work",
    decision: "Not usable on this base yet, and not a user action: the ConfigHub delivery did not match the live Helm result (a semantic/model difference), so the row did not pass. Catalog/model work.",
    next_action: "Catalog work: reconcile the base, render context, target facts, or semantic contract with the live Helm result, then rerun.",
    support_artifact: "",
  },
};

function classify(reason, result) {
  const r = (reason ?? "").toLowerCase().trim();
  if (r.startsWith("gitops-runtime")) return "gitops-runtime";
  if (r.startsWith("operate-policy")) return "operate-policy";
  if (r.startsWith("target-prerequisite")) return "target-prerequisite";
  if (r.startsWith("target-runtime")) return "target-runtime";
  if (/semantic|object diff|does not match|model/.test(r)) return "semantic-model-gap";
  // Fallbacks for un-prefixed reasons.
  if (/namespace|secret|crd|prerequisite/.test(r)) return "target-prerequisite";
  if (/argo|sync|controller|health/.test(r)) return "gitops-runtime";
  if (result === "blocked") return "semantic-model-gap";
  return "target-runtime";
}

function supportArtifactCandidates(category) {
  const file = CATEGORIES[category]?.support_artifact;
  const candidates = file ? [file] : [];
  if (category === "target-runtime") {
    candidates.push("target-prerequisite-plan.yaml", "target-topology.yaml", "operating-policy.yaml");
  }
  return candidates;
}

function supportArtifactPath(category, chart, version) {
  for (const file of supportArtifactCandidates(category)) {
    const rel = `recipes/${chart}/${version}/${file}`;
    if (existsSync(join(repoRoot, rel))) return rel;
  }
  return "";
}

// --- CSV parsing ----------------------------------------------------------

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

function readSummaryRows() {
  const abs = join(repoRoot, SUMMARY_CSV);
  check(existsSync(abs), `missing source ${SUMMARY_CSV}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((cell) => cell.trim() !== ""));
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, idx) => [h, cells[idx] ?? ""])));
}

// Collapse any absolute path baked into a receipt reason to repo-relative.
function normalizeReason(text) {
  return (text ?? "").replace(/\/[^\s]*?\/((?:recipes|runs|packages|data|scripts|tests)\/)/g, "$1").trim();
}

// Authoritative reason for a blocked row whose summary reason is generic — read
// it from the committed receipt.
function authoritativeReason(row) {
  const generic = !row.reason || /inspect receipt|see receipt|semantic object diff/i.test(row.reason);
  if (!generic) return row.reason;
  const abs = row.receipt ? join(repoRoot, row.receipt) : "";
  if (!abs || !existsSync(abs)) return row.reason || "blocked (receipt missing)";
  try {
    const spec = readYaml(abs)?.spec ?? {};
    if (spec.failure?.message) return String(spec.failure.message);
    const blockedCheck = (spec.checks ?? []).find((c) => c.result === "blocked" && c.detail);
    if (blockedCheck) return String(blockedCheck.detail);
  } catch {
    // fall through
  }
  return row.reason || "blocked (see receipt)";
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "variant",
  "result",
  "residue_category",
  "blocker_owner",
  "usable_today",
  "user_decision",
  "next_action",
  "reason",
  "support_artifact",
  "receipt",
];

function buildDecisions() {
  const rows = readSummaryRows().filter((row) => row.result && row.result !== "pass");
  const decisions = rows.map((row) => {
    const reason = normalizeReason(authoritativeReason(row));
    const category = classify(reason, row.result);
    const def = CATEGORIES[category];
    check(def !== undefined, `no decision template for category "${category}"`);
    return {
      chart: row.chart,
      version: row.version,
      variant: row.variant,
      result: row.result,
      residue_category: category,
      blocker_owner: def.blocker_owner,
      usable_today: def.usable_today,
      user_decision: def.decision,
      next_action: def.next_action,
      reason,
      support_artifact: supportArtifactPath(category, row.chart, row.version),
      receipt: row.receipt,
    };
  });
  decisions.sort((a, b) =>
    `${a.chart}|${a.version}|${a.variant}`.localeCompare(`${b.chart}|${b.version}|${b.variant}`),
  );
  return decisions;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  return `${[headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n")}\n`;
}

function buildJson(decisions) {
  return `${JSON.stringify(
    {
      kind: "LiveParityDecisions",
      unofficial: true,
      description:
        "Product-readable decisions for the committed NON-PASS ConfigHub OCI + live Helm-vs-ConfigHub (G/P-lane) rows. Classifies each watch/blocked row by residue, who owns the fix, and whether the chart/base is usable today. Read-only over committed evidence. Generated by scripts/generate-live-parity-decisions.mjs; do not hand-edit.",
      source: SUMMARY_CSV,
      residue_categories: Object.keys(CATEGORIES),
      note: "A watch row is known evidence with a named residue: semantic Helm-vs-ConfigHub parity passed; a GitOps/runtime/operate condition remains. It is not a pass and not a failure.",
      decisions,
    },
    null,
    2,
  )}\n`;
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
}

function mdCount(title, pairs) {
  return [`| ${title} | Rows |`, "| --- | ---: |", ...pairs.map(([k, v]) => `| \`${k}\` | ${v} |`)].join("\n");
}

function buildSummary(decisions) {
  const watch = decisions.filter((d) => d.result === "watch").length;
  const blocked = decisions.filter((d) => d.result === "blocked").length;
  const userOwned = decisions.filter((d) => d.blocker_owner === "user").length;
  const catalogOwned = decisions.filter((d) => d.blocker_owner === "catalog").length;
  const rowTable = [
    "| Chart | Variant | Result | Residue | Who fixes it | Usable today |",
    "| --- | --- | --- | --- | --- | --- |",
    ...decisions.map((d) => `| ${d.chart}@${d.version} | ${d.variant} | ${d.result} | ${d.residue_category} | ${d.blocker_owner} | ${d.usable_today} |`),
  ].join("\n");

  return `# Live-Parity (G/P-lane) Decisions

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`scripts/generate-live-parity-decisions.mjs\`. Do not hand-edit. Regenerate with
\`npm run live-parity:decisions\`.

The G/P-lane companion to [kind-parity-decisions](../kind-parity-decisions/summary.md).
It classifies the committed **non-pass** ConfigHub OCI + live Helm-vs-ConfigHub
(G/P-lane) rows into product-readable decisions: per \`watch\`/\`blocked\` row, what
it means for a Helm user, **who has to fix it**, whether the chart/base is
**usable today**, the next action, and the recipe support artifact that records
the decision.

Source: [${SUMMARY_CSV}](../live-helm-confighub-compare/summary.md) (read-only).
Forms: [decisions.csv](./decisions.csv), [decisions.json](./decisions.json).

## What watch and blocked mean here

- **watch** — known evidence with a named residue. The semantic Helm-vs-ConfigHub
  parity passed (the delivered objects match regular Helm); a GitOps
  controller-health, runtime, or operational condition still needs review.
  **Not a pass, not a failure.**
- **blocked** — the row did not reach the lane result. The decision names why and
  who owns the fix.

## This batch

${decisions.length} non-pass rows: ${watch} watch, ${blocked} blocked.
${userOwned} are resolved by the **user** (stage a prerequisite); ${catalogOwned}
need **catalog/model** work; the rest are GitOps controller-health, runtime, or
operational residues to review. In every watch row, semantic parity already
passed — the residue is operational, not a config mismatch.

${mdCount("Residue category", countBy(decisions, "residue_category"))}

${mdCount("Who fixes it", countBy(decisions, "blocker_owner"))}

## Rows

${rowTable}

## How To Read One Decision

\`residue_category\` is the kind of gap (\`gitops-runtime\`, \`operate-policy\`,
\`target-runtime\`, \`target-prerequisite\`, \`semantic-model-gap\`);
\`blocker_owner\` is who acts; \`usable_today\` is the honest answer for a Helm
user; \`user_decision\` is the plain explanation; \`next_action\` is the concrete
step; \`support_artifact\` is the recipe file that records the decision;
\`receipt\` is the committed evidence.

## Boundaries

- Read-only classification of committed G/P-lane evidence. No live run, no
  cluster, no \`runs/\` receipt edited, nothing written into
  \`data/live-helm-confighub-compare/\`, and no change to the master-matrix or
  status-dashboard generators.
- A decision never turns a \`watch\` into a \`pass\` or a \`failure\`; it explains
  the residue and routes the fix.
`;
}

// --- Verify invariants ----------------------------------------------------

function checkInvariants(decisions) {
  const sourceNonPass = readSummaryRows().filter((row) => row.result && row.result !== "pass");
  check(
    decisions.length === sourceNonPass.length,
    `decision count ${decisions.length} != non-pass G/P rows ${sourceNonPass.length}`,
  );
  for (const d of decisions) {
    check(CATEGORIES[d.residue_category] !== undefined, `${d.chart}/${d.variant}: unknown residue_category ${d.residue_category}`);
    check(!/^pass$/i.test(d.usable_today), `${d.chart}/${d.variant}: a non-pass row must not be presented as pass`);
    if (d.result === "blocked") {
      check(d.reason && !/inspect receipt|see receipt/i.test(d.reason), `${d.chart}/${d.variant}: blocked row still has a generic reason`);
    }
  }
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const decisions = buildDecisions();
  return {
    decisions,
    csv: toCsv(CSV_HEADERS, decisions),
    json: buildJson(decisions),
    summary: buildSummary(decisions),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  checkInvariants(out.decisions);
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  console.log(`wrote live-parity decisions -> ${relativeRepo(outDir)}/ (${out.decisions.length} non-pass rows)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.decisions);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run live-parity:decisions`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run live-parity:decisions`);
  }
  console.log(`verified live-parity decisions for ${out.decisions.length} non-pass rows`);
} else {
  console.log(`Usage:
  node scripts/generate-live-parity-decisions.mjs --generate
  node scripts/generate-live-parity-decisions.mjs --verify`);
}
