#!/usr/bin/env node

// Kind-parity decisions.
//
// Classifies the committed NON-PASS two-cluster kind-parity (K-lane) rows into
// product-readable decisions: for each watch/blocked row, what it means for a
// Helm user, who has to fix it (user vs catalog), whether the chart/base is
// usable today, and the exact next action — resolving generic blocked rows by
// reading the committed receipt.
//
// Read-only over committed evidence: data/live-kind-parity/summary.csv and the
// runs/live-kind-parity/*/receipt.yaml receipts. It does NOT run live, touch
// kind clusters, edit runs/ receipts, or write into data/live-kind-parity/.
// Output is a pure function of committed data; --verify regenerates and
// byte-compares.
//
// Honest framing: a `watch` row is known evidence with a named residue, not a
// pass and not a failure. A `blocked` row did not reach parity; its decision
// says why and who owns the fix.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const SUMMARY_CSV = "data/live-kind-parity/summary.csv";

const outDir = join(repoRoot, "data", "kind-parity-decisions");
const csvPath = join(outDir, "decisions.csv");
const jsonPath = join(outDir, "decisions.json");
const summaryPath = join(outDir, "summary.md");

// Residue category -> product-readable decision shape.
// blocker_owner: who has to act. usable_today: the honest user answer.
const CATEGORIES = {
  "target-prerequisite-crds": {
    blocker_owner: "user",
    usable_today: "yes, after staging CRDs",
    decision: "Usable once you stage the required CRDs on the target. The rendered object set matched regular Helm (semantic parity passed); only the cluster prerequisite is missing.",
    next_action: "Stage the chart's CRDs as target facts (or pick a CRD-rendering base), then the row can move to pass.",
  },
  "target-prerequisite-secret": {
    blocker_owner: "user",
    usable_today: "yes, after staging a Secret",
    decision: "Usable once you stage the required Secret on the target. The rendered object set matched regular Helm (semantic parity passed); only the cluster prerequisite is missing.",
    next_action: "Stage the named Secret as a target fact, then the row can move to pass.",
  },
  "target-prerequisite-namespace": {
    blocker_owner: "user",
    usable_today: "yes, after creating the Namespace",
    decision: "Usable once you create the required Namespace on the target. The rendered object set matched regular Helm (semantic parity passed); only the cluster prerequisite is missing.",
    next_action: "Declare and stage the required Namespace as a target fact, then the row can move to pass.",
  },
  "hook-lifecycle": {
    blocker_owner: "catalog",
    usable_today: "no — needs lifecycle route",
    decision: "Not usable as a pure config-only apply yet: the chart relies on a Helm hook or hook-produced object, so the catalog must route that lifecycle action explicitly.",
    next_action: "Catalog work: add a lifecycle route for the hook action or provide the hook-produced object as a target prerequisite, then rerun.",
  },
  "render-input": {
    blocker_owner: "user",
    usable_today: "yes, after supplying values",
    decision: "Usable once you supply the required Helm values. With complete inputs the rendered object set matched regular Helm (semantic parity passed).",
    next_action: "Provide the required values in the base/variant, then the row can move to pass.",
  },
  "target-runtime": {
    blocker_owner: "needs runtime review",
    usable_today: "watch — config correct, runtime unconfirmed",
    decision: "The rendered config is correct (semantic parity passed), but the workload did not converge on the test target. This is a runtime/target residue to review, not a parity defect.",
    next_action: "Review the runtime residue (crash loop / readiness) on the target and record a runtime-review support artifact.",
  },
  readiness: {
    blocker_owner: "needs readiness review",
    usable_today: "watch — objects match, readiness unconfirmed",
    decision: "Objects match regular Helm (semantic parity passed); workload readiness on the target is not yet confirmed.",
    next_action: "Confirm workload readiness on the target and record the result.",
  },
  "model-gap-target-fact": {
    blocker_owner: "catalog",
    usable_today: "no — needs catalog work",
    decision: "Not usable on this base yet, and not something you can supply: the harness has no value generator for a required target fact, so the run blocked before parity. Catalog/model work, not a user action.",
    next_action: "Catalog work: add the missing target-fact value generator, then rerun.",
  },
  "model-gap-render": {
    blocker_owner: "catalog",
    usable_today: "no — needs catalog work",
    decision: "Not usable on this base yet, and not a user action: the installer package's rendered object model does not match the live Helm result. Catalog/model work.",
    next_action: "Catalog work: update the base, render context, target facts, or semantic contract so the installer package matches the live Helm result, then rerun.",
  },
  "capability-profile-diff": {
    blocker_owner: "catalog",
    usable_today: "no — needs catalog work",
    decision: "Not usable on this base yet, and not a user action: live Helm rendered fields that the packaged installer render did not, because the live cluster capability profile changed the object set. Catalog/model work.",
    next_action: "Catalog work: model the required Kubernetes capability/profile field, update the base or semantic contract, then rerun.",
  },
};

function classify(reason, base, result, semanticParity) {
  const r = (reason ?? "").toLowerCase();
  if (/trafficdistribution|preferclose|service objects differ|capability profile/.test(r)) return "capability-profile-diff";
  if (/no target fact value generator/.test(r)) return "model-gap-target-fact";
  if (semanticParity === "defect") return "model-gap-render";
  if (/not found in .*rendered|required crd .*not found/.test(r)) return "model-gap-render";
  if (/secret/.test(r)) return "target-prerequisite-secret";
  if (/namespace/.test(r) && /not found|missing|required/.test(r)) return "target-prerequisite-namespace";
  if (/helm-hook|hook|certgen|certificate generation/.test(r)) return "hook-lifecycle";
  if (/crd/.test(r) && (/disabled|missing|no-crds/.test(r) || base.includes("no-crds"))) return "target-prerequisite-crds";
  if (/required helm values|render-input/.test(r)) return "render-input";
  if (/crash|runtime/.test(r)) return "target-runtime";
  if (/readiness/.test(r)) return "readiness";
  // Blocked rows that only say "inspect receipt" but whose receipt reason is
  // still generic fall back to a catalog-owned inspection decision.
  if (result === "blocked") return "model-gap-render";
  return "readiness";
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

// Authoritative reason for a blocked row whose summary reason is generic
// ("inspect receipt") — read it from the committed receipt.
function authoritativeReason(row) {
  const generic = !row.reason || /inspect receipt|semantic object diff/i.test(row.reason);
  if (!generic) return row.reason;
  const abs = row.receipt ? join(repoRoot, row.receipt) : "";
  if (!abs || !existsSync(abs)) return row.reason || "blocked (receipt missing)";
  try {
    const doc = readYaml(abs);
    const spec = doc?.spec ?? {};
    if (/semantic object diff/i.test(row.reason ?? "")) {
      const receiptText = readFileSync(abs, "utf8");
      const comparison = spec.semanticComparison?.helmVsCubInstallerApply ?? {};
      const missing = comparison.missingFromInstaller ?? [];
      const extra = comparison.extraInInstaller ?? [];
      const diffs = comparison.semanticDiffs ?? [];
      const parts = [`semantic object parity issue: missing=${missing.length} extra=${extra.length} diffs=${diffs.length}`];
      if (missing.length > 0) parts.push(`missing=${missing.slice(0, 6).join("; ")}`);
      if (extra.length > 0) parts.push(`extra=${extra.slice(0, 6).join("; ")}`);
      if (diffs.length > 0) parts.push(`objects=${diffs.slice(0, 6).join("; ")}`);
      if (/trafficDistribution|PreferClose/.test(receiptText)) {
        parts.push("live Helm includes Service spec.trafficDistribution=PreferClose for this cluster capability profile");
      }
      if (/ImagePullBackOff|ErrImagePull|Failed to pull image|pull access denied/i.test(receiptText)) {
        const match = receiptText.match(/docker\.io\/[A-Za-z0-9._/-]+:[A-Za-z0-9._-]+/);
        parts.push(match ? `runtime also fails to pull ${match[0]}` : "runtime also hits image pull failure");
      }
      const secretNames = [...new Set([...receiptText.matchAll(/secret "([^"]+)" not found/gi)].map((m) => m[1]))].sort();
      if (secretNames.length > 0) parts.push(`runtime also requires Secret(s): ${secretNames.join(", ")}`);
      return parts.join("; ");
    }
    if (spec.failure?.message) return String(spec.failure.message);
    const blockedCheck = (spec.checks ?? []).find((c) => c.result === "blocked" && c.detail);
    if (blockedCheck) return String(blockedCheck.detail);
  } catch {
    // fall through to the summary reason
  }
  return row.reason || "blocked (see receipt)";
}

// --- Build ----------------------------------------------------------------

const CSV_HEADERS = [
  "chart",
  "version",
  "base",
  "result",
  "semantic_parity",
  "residue_category",
  "blocker_owner",
  "usable_today",
  "user_decision",
  "next_action",
  "reason",
  "receipt",
];

// Collapse any absolute path baked into a receipt reason to a repo-relative
// one, so the decision is portable and does not leak a local checkout path.
function normalizeReason(text) {
  return (text ?? "")
    .replace(/\/[^\s]*?\/((?:recipes|runs|packages|data|scripts|tests)\/)/g, "$1")
    .trim();
}

function buildDecisions() {
  const rows = readSummaryRows().filter((row) => row.result && row.result !== "pass");
  const decisions = rows.map((row) => {
    const reason = normalizeReason(authoritativeReason(row));
    const category = classify(reason, row.base, row.result, row.semantic_parity);
    const def = CATEGORIES[category];
    check(def !== undefined, `no decision template for category "${category}"`);
    return {
      chart: row.chart,
      version: row.version,
      base: row.base,
      result: row.result,
      semantic_parity: row.semantic_parity,
      residue_category: category,
      blocker_owner: def.blocker_owner,
      usable_today: def.usable_today,
      user_decision: def.decision,
      next_action: def.next_action,
      reason,
      receipt: row.receipt,
    };
  });
  decisions.sort((a, b) =>
    `${a.chart}|${a.version}|${a.base}`.localeCompare(`${b.chart}|${b.version}|${b.base}`),
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
      kind: "KindParityDecisions",
      unofficial: true,
      description:
        "Product-readable decisions for the committed NON-PASS two-cluster kind-parity rows. Classifies each watch/blocked row by residue, who owns the fix, and whether the chart/base is usable today. Read-only over committed evidence. Generated by scripts/generate-kind-parity-decisions.mjs; do not hand-edit.",
      source: SUMMARY_CSV,
      residue_categories: Object.keys(CATEGORIES),
      note: "A watch row is known evidence with a named residue — not a pass and not a failure. A blocked row did not reach parity; the decision names why and who owns the fix.",
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
    "| Chart | Base | Result | Residue | Who fixes it | Usable today |",
    "| --- | --- | --- | --- | --- | --- |",
    ...decisions.map((d) => `| ${d.chart}@${d.version} | ${d.base} | ${d.result} | ${d.residue_category} | ${d.blocker_owner} | ${d.usable_today} |`),
  ].join("\n");

  return `# Kind-Parity Decisions

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`scripts/generate-kind-parity-decisions.mjs\`. Do not hand-edit. Regenerate with
\`npm run kind-parity:decisions\`.

This classifies the committed **non-pass** two-cluster kind-parity (K-lane) rows
into product-readable decisions: for each \`watch\`/\`blocked\` row, what it means
for a Helm user, **who has to fix it** (you vs the catalog), whether the
chart/base is **usable today**, and the exact next action. It reads the
committed receipts, so generic blocked rows get a real reason.

Source: [${SUMMARY_CSV}](../live-kind-parity/summary.md) (read-only). Forms:
[decisions.csv](./decisions.csv), [decisions.json](./decisions.json).

## What watch and blocked mean

- **watch** — known evidence with a named residue. Semantic parity passed (the
  rendered objects match regular Helm); a target/runtime/readiness condition
  still needs review. **Not a pass, not a failure.**
- **blocked** — the run did not reach parity. The decision names why and who
  owns the fix (often the catalog, not the user).

## This batch

${decisions.length} non-pass rows: ${watch} watch, ${blocked} blocked.
${userOwned} are resolved by the **user** (stage a prerequisite or supply
values); ${catalogOwned} need **catalog/model** work; the rest need a runtime or
readiness review.

${mdCount("Residue category", countBy(decisions, "residue_category"))}

${mdCount("Who fixes it", countBy(decisions, "blocker_owner"))}

## Rows

${rowTable}

## How To Read One Decision

\`residue_category\` is the kind of gap; \`blocker_owner\` is who acts (\`user\`,
\`catalog\`, or a review); \`usable_today\` is the honest answer for a Helm user;
\`user_decision\` is the plain explanation; \`next_action\` is the concrete step;
\`reason\` is the authoritative residue (read from the receipt for blocked rows);
\`receipt\` is the committed evidence.

## Boundaries

- Read-only classification of committed kind-parity evidence. No live run, no
  kind cluster, no \`runs/\` receipt edited, nothing written into
  \`data/live-kind-parity/\`.
- A decision never turns a \`watch\` into a \`pass\` or a \`failure\`; it explains
  the residue and routes the fix.
`;
}

// --- Verify invariants ----------------------------------------------------

function checkInvariants(decisions) {
  const sourceNonPass = readSummaryRows().filter((row) => row.result && row.result !== "pass");
  check(
    decisions.length === sourceNonPass.length,
    `decision count ${decisions.length} != non-pass K-lane rows ${sourceNonPass.length}`,
  );
  for (const d of decisions) {
    check(CATEGORIES[d.residue_category] !== undefined, `${d.chart}/${d.base}: unknown residue_category ${d.residue_category}`);
    check(!/^pass$/i.test(d.usable_today), `${d.chart}/${d.base}: a non-pass row must not be presented as pass`);
    if (d.result === "blocked") {
      check(d.reason && !/inspect receipt/i.test(d.reason), `${d.chart}/${d.base}: blocked row still has a generic "inspect receipt" reason`);
    }
    if (d.semantic_parity === "defect") {
      check(d.blocker_owner === "catalog", `${d.chart}/${d.base}: semantic parity defect must stay catalog-owned`);
      check(!/^watch/.test(d.usable_today), `${d.chart}/${d.base}: semantic parity defect must not be presented as watch-grade`);
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
  console.log(`wrote kind-parity decisions -> ${relativeRepo(outDir)}/ (${out.decisions.length} non-pass rows)`);
} else if (mode === "--verify") {
  const out = buildAll();
  checkInvariants(out.decisions);
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run kind-parity:decisions`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run kind-parity:decisions`);
  }
  console.log(`verified kind-parity decisions for ${out.decisions.length} non-pass rows`);
} else {
  console.log(`Usage:
  node scripts/generate-kind-parity-decisions.mjs --generate
  node scripts/generate-kind-parity-decisions.mjs --verify`);
}
