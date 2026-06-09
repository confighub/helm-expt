#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "top100-readiness");
const outputs = {
  csv: join(outputRoot, "readiness.csv"),
  summary: join(outputRoot, "summary.md"),
};

if (mode === "--generate") {
  mkdirSync(outputRoot, { recursive: true });
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote top100 readiness -> data/top100-readiness/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${path} is missing; run npm run top100:readiness`);
    check(readFileSync(path, "utf8") === report[name], `${path} is stale; run npm run top100:readiness`);
  }
  console.log(`verified top100 readiness for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-top100-readiness.mjs --generate
  node scripts/generate-top100-readiness.mjs --verify`);
}

function buildReport() {
  const top100Rows = parseCsvFile("data/top100-catalog-analysis/review.csv");
  const outcomeRows = parseCsvFile("data/outcome-coverage/chart-outcomes.csv");
  const productionNextActions = productionNextActionIndex();
  const outcomeByChart = new Map(outcomeRows.map((row) => [row.chart, row]));

  const rows = top100Rows.map((top100) => {
    const key = `${top100.chart}@${top100.version}`;
    const outcome = outcomeByChart.get(key) ?? {};
    const strongestEvidence = strongestEvidenceFor(outcome);
    const productionNextAction = productionNextActions.get(key);
    const status = userStatusFor(top100, outcome, strongestEvidence, productionNextAction);
    const workability = workabilityFor(status.userStatus);
    return {
      proof_surface_rank: top100.proof_surface_rank,
      chart: key,
      catalog_tier: top100.proof_surface,
      workability,
      adoption_bucket: adoptionBucketFor(status.userStatus),
      user_status: status.userStatus,
      strongest_evidence: strongestEvidence,
      variant_count: top100.variant_count,
      variants: top100.supported_variants || top100.candidate_variants || top100.start_variant,
      render_parity: countText(outcome.render_parity_pass, outcome.base_rows),
      in_confighub: countText(outcome.in_confighub_pass, outcome.base_rows),
      local_live: countText(outcome.local_live_pass, outcome.base_rows),
      gitops_live: countText(outcome.gitops_live_pass, outcome.base_rows),
      live_parity: countText(outcome.live_parity_pass, outcome.base_rows),
      hard_gap: shortGap(outcome.hard_gap || top100.not_yet_enabled),
      next_action: status.nextAction,
      next_action_source: status.nextActionSource,
      next_action_receipt: status.nextActionReceipt,
      recipe_path: top100.recipe_path,
      catalog_path: top100.catalog_path,
    };
  });
  const missingProductionRows = rows
    .filter((row) => row.catalog_tier === "top20-catalog-supported")
    .filter((row) => !productionNextActions.has(row.chart))
    .map((row) => row.chart);
  check(missingProductionRows.length === 0, `missing production next actions for top20 rows: ${missingProductionRows.join(", ")}`);

  return {
    rows,
    csv: toCsv(rows),
    summary: summary(rows),
  };
}

function strongestEvidenceFor(row) {
  if (number(row.live_parity_pass) > 0) return "live-helm-vs-confighub-parity";
  if (number(row.gitops_live_pass) > 0) return "gitops-oci-live";
  if (number(row.local_live_pass) > 0) return "local-kubernetes-live";
  if (number(row.in_confighub_pass) > 0) return "in-confighub-proof";
  if (number(row.render_parity_pass) > 0) return "render-parity";
  return "not-proven";
}

function userStatusFor(top100, outcome, strongestEvidence, productionNextAction) {
  const hardGap = shortGap(outcome.hard_gap || top100.not_yet_enabled);
  if (top100.catalog_status === "catalog-supported") {
    if (["live-helm-vs-confighub-parity", "gitops-oci-live", "local-kubernetes-live"].includes(strongestEvidence)) {
      return {
        userStatus: "catalog-supported-with-live-evidence",
        nextAction: productionNextAction?.nextAction ?? (hardGap === "-" ? "promote a declared production scope when gates pass" : `resolve or document: ${hardGap}`),
        nextActionSource: productionNextAction ? "production-disposition" : "top100-readiness-fallback",
        nextActionReceipt: productionNextAction?.nextDispositionReceipt ?? "",
      };
    }
    return {
      userStatus: "catalog-supported-needs-live-expansion",
      nextAction: productionNextAction?.nextAction ?? "add live evidence for the remaining supported variants",
      nextActionSource: productionNextAction ? "production-disposition" : "live-lane-expansion",
      nextActionReceipt: productionNextAction?.nextDispositionReceipt ?? "",
    };
  }
  if (top100.catalog_status === "proof-grade") {
    if (number(top100.variant_count) > 1) {
      return {
        userStatus: hardGap === "-" ? "proof-grade-ready-for-promotion-review" : "proof-grade-with-named-limitation",
        nextAction: hardGap === "-" ? "run catalog promotion review" : `review limitation before promotion: ${hardGap}`,
        nextActionSource: hardGap === "-" ? "catalog-promotion-review" : "limitation-review",
        nextActionReceipt: "",
      };
    }
    return {
      userStatus: "proof-grade-needs-user-shaped-variant",
      nextAction: "add at least one user-shaped variant before catalog promotion",
      nextActionSource: "user-shaped-variant-backlog",
      nextActionReceipt: "",
    };
  }
  return {
    userStatus: "not-in-current-catalog-lane",
    nextAction: top100.top500_next_action || "review chart analysis and create a recipe candidate",
    nextActionSource: "top500-catalog-analysis",
    nextActionReceipt: "",
  };
}

function productionNextActionIndex() {
  const result = new Map();
  const path = join(repoRoot, "data", "production-disposition", "next-actions.csv");
  if (!existsSync(path)) return result;
  for (const row of parseCsvFile("data/production-disposition/next-actions.csv")) {
    if (row.chart && row.version) result.set(`${row.chart}@${row.version}`, row);
  }
  return result;
}

function summary(rows) {
  const counts = countBy(rows, (row) => row.user_status);
  const adoptionCounts = countBy(rows, (row) => row.adoption_bucket);
  const evidenceCounts = countBy(rows, (row) => row.strongest_evidence);
  const hardGaps = rows.filter((row) => row.hard_gap !== "-");
  const hardGapCounts = countBy(hardGaps, (row) => row.hard_gap);
  const hardGapByBucket = hardGapBucketRows(rows);
  const top20 = rows.filter((row) => row.catalog_tier === "top20-catalog-supported");
  const next80 = rows.filter((row) => row.catalog_tier === "next80-proof-grade");
  const liveEvidence = rows.filter((row) =>
    ["live-helm-vs-confighub-parity", "gitops-oci-live", "local-kubernetes-live"].includes(row.strongest_evidence),
  );
  const promotionReview = rows.filter((row) => row.user_status === "proof-grade-ready-for-promotion-review");
  const needsVariant = rows.filter((row) => row.user_status === "proof-grade-needs-user-shaped-variant");
  const namedLimitation = rows.filter((row) => row.user_status === "proof-grade-with-named-limitation");
  return `# Top-100 Readiness

This is the shortest chart-by-chart answer for the maintained top-100 corpus.
It joins the catalog analysis with the outcome evidence so readers can see what
works now, what works with help, and what still needs product or operator work.

## Summary

~~~text
charts: ${rows.length}
top-20 catalog-supported: ${top20.length}
next-80 proof-grade: ${next80.length}
charts with live evidence on at least one variant: ${liveEvidence.length}
charts with named hard gaps: ${hardGaps.length}
~~~

## Workability Lens

| User question | Count | Answer |
| --- | ---: | --- |
${workabilityRows(rows).map((row) => `| ${row.question} | ${row.count} | ${row.answer} |`).join("\n")}

## Practical Buckets

| Question | Count | Read it as | Next move |
| --- | ---: | --- | --- |
| Which charts are already public catalog entries? | ${top20.length} | Use the catalog, then check exact base status before claiming a lane. | Open \`CATALOG.md\`, the per-chart catalog page, \`base-outcomes.csv\`, and the production next-action queue. |
| Which proof-grade charts are closest to promotion? | ${promotionReview.length} | Recipe/package proof and multiple variants exist, but catalog review is not done. | Run catalog promotion review and add live lanes for selected bases. |
| Which charts need a useful user-shaped variant first? | ${needsVariant.length} | The default render proves the mechanism, but it is not yet a good catalog offer. | Add one or more realistic base variants before promotion. |
| Which charts need a limitation decision first? | ${namedLimitation.length} | A known gap affects the recommended path. | Decide whether to support, disclose, or defer that capability. |

## Adoption Buckets

| Bucket | Count | What it means | Use this when |
| --- | ---: | --- | --- |
${[...adoptionCounts.entries()].map(([bucket, count]) => `| \`${bucket}\` | ${count} | ${escapePipes(adoptionMeaning(bucket))} | ${escapePipes(adoptionUse(bucket))} |`).join("\n")}

## Hard Gap Buckets

| Gap | Charts | What it means |
| --- | ---: | --- |
${[...hardGapCounts.entries()].map(([gap, count]) => `| ${escapePipes(gap)} | ${count} | ${escapePipes(gapMeaning(gap))} |`).join("\n")}

## Hard Gaps Versus Adoption Buckets

| Adoption bucket | Rows | Rows with named hard gaps | Meaning |
| --- | ---: | ---: | --- |
${hardGapByBucket.map((row) => `| \`${row.bucket}\` | ${row.total} | ${row.withGap} | ${escapePipes(row.meaning)} |`).join("\n")}

A hard gap is a capability warning, not an automatic failure. A top-20 catalog
chart can have a hard gap for an additional path such as HA or existing-secret
support while still being usable for its reviewed base variants. A
\`limitation-decision-first\` row is different: the named gap affects the next
recommended promotion path, so it needs a support, disclosure, or deferral
decision before catalog promotion.

## User Status

| Status | Count | Meaning |
| --- | ---: | --- |
${[...counts.entries()].map(([status, count]) => `| \`${status}\` | ${count} | ${statusMeaning(status)} |`).join("\n")}

## Strongest Evidence Per Chart

| Evidence | Count | Meaning |
| --- | ---: | --- |
${[...evidenceCounts.entries()].map(([status, count]) => `| \`${status}\` | ${count} | ${evidenceMeaning(status)} |`).join("\n")}

## How To Read This

- Every row in this file has a maintained recipe/package proof path.
- \`render-parity\` means regular Helm and \`cub installer setup\` produce the same
  Kubernetes object set under recorded inputs, apart from declared installer
  support objects.
- Live evidence is intentionally counted separately. A chart can be proof-grade
  without every base variant having live Kubernetes, GitOps, or live parity
  evidence yet.
- For top-20 public catalog rows, \`next_action\` comes from
  \`data/production-disposition/next-actions.csv\`. That keeps "can I try this?"
  separate from "can we call it production-supported?"
- \`next_action_source\` records which generated queue produced the advice.
- Hard gaps are capability gaps, not necessarily chart failure. They usually mean
  a useful path such as an existing-secret, HA, no-CRDs, or production lifecycle
  path still needs a supported variant or operator decision.

## First Backlog Rows

| Backlog | First rows |
| --- | --- |
| Promotion review | ${sampleCharts(promotionReview)} |
| User-shaped variants | ${sampleCharts(needsVariant)} |
| Named limitation review | ${sampleCharts(namedLimitation)} |

## First Rows

| Chart | Adoption bucket | Evidence | Variants | Next action | Next receipt | Source |
| --- | --- | --- | ---: | --- | --- | --- |
${rows.slice(0, 25).map((row) => `| \`${row.chart}\` | \`${row.adoption_bucket}\` | \`${row.strongest_evidence}\` | ${row.variant_count} | ${escapePipes(row.next_action)} | ${row.next_action_receipt ? `\`${row.next_action_receipt}\`` : "-"} | \`${row.next_action_source}\` |`).join("\n")}

## Files

| File | Use |
| --- | --- |
| \`data/top100-readiness/readiness.csv\` | One row per top-100 chart: workability, user status, strongest evidence, lane counts, gap, next action, next receipt path where available, and next-action source. |
| \`data/top100-catalog-analysis/review.csv\` | Catalog analysis and promotion surface. |
| \`data/outcome-coverage/chart-outcomes.csv\` | Detailed outcome counts per chart. |
| \`data/outcome-coverage/base-outcomes.csv\` | Per base-variant proof lane status. |

Regenerate:

~~~sh
npm run top100:readiness
npm run top100:readiness:verify
~~~
`;
}

function sampleCharts(rows) {
  if (!rows.length) return "-";
  return rows.slice(0, 5).map((row) => `\`${row.chart}\``).join("<br>");
}

function workabilityFor(status) {
  switch (status) {
    case "catalog-supported-with-live-evidence":
    case "catalog-supported-needs-live-expansion":
      return "try-now-public-catalog";
    case "proof-grade-ready-for-promotion-review":
      return "works-as-proof-needs-catalog-review";
    case "proof-grade-needs-user-shaped-variant":
      return "not-yet-a-good-catalog-offer";
    case "proof-grade-with-named-limitation":
      return "decision-needed-before-promotion";
    default:
      return "not-in-current-catalog-lane";
  }
}

function workabilityRows(rows) {
  const counts = countBy(rows, (row) => row.workability);
  const ordered = [
    {
      key: "try-now-public-catalog",
      question: "What can a user try from the public catalog now?",
      answer: "Use the catalog entry, then check the exact base and proof lane before making a stronger claim.",
    },
    {
      key: "works-as-proof-needs-catalog-review",
      question: "What works as a proof but is not promoted yet?",
      answer: "The recipe/package proof exists and useful variants exist; run catalog review and selected live lanes.",
    },
    {
      key: "not-yet-a-good-catalog-offer",
      question: "What should not be shown as a real catalog offer yet?",
      answer: "The default render proves the mechanism, but a realistic user-shaped base variant is still needed.",
    },
    {
      key: "decision-needed-before-promotion",
      question: "What needs a decision before promotion?",
      answer: "A named limitation such as existing-secret, HA, or CRD routing must be supported, disclosed, or deferred.",
    },
    {
      key: "not-in-current-catalog-lane",
      question: "What is outside the maintained top-100 lane?",
      answer: "Use top-500 reconnaissance and create a recipe candidate first.",
    },
  ];
  return ordered
    .filter((row) => counts.has(row.key))
    .map((row) => ({ ...row, count: counts.get(row.key) }));
}

function hardGapBucketRows(rows) {
  const byBucket = new Map();
  for (const row of rows) {
    const current = byBucket.get(row.adoption_bucket) ?? { total: 0, withGap: 0 };
    current.total += 1;
    if (row.hard_gap !== "-") current.withGap += 1;
    byBucket.set(row.adoption_bucket, current);
  }
  const order = ["try-from-public-catalog", "promote-after-review", "needs-useful-variant", "limitation-decision-first", "try-with-lane-check", "not-ready"];
  return [...byBucket.entries()]
    .sort(([left], [right]) => {
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex) || left.localeCompare(right);
    })
    .map(([bucket, counts]) => ({
      bucket,
      ...counts,
      meaning: hardGapBucketMeaning(bucket),
    }));
}

function hardGapBucketMeaning(bucket) {
  const meanings = {
    "try-from-public-catalog": "The catalog has reviewed bases; the hard gap usually points to another path that still needs support or disclosure.",
    "promote-after-review": "No named hard gap currently blocks promotion review.",
    "needs-useful-variant": "Add realistic variants first; any named hard gap should shape those variants or be disclosed.",
    "limitation-decision-first": "The named gap blocks the next promotion decision until it is supported, disclosed, or deferred.",
    "try-with-lane-check": "A catalog row exists, but exact lane evidence must be checked before use.",
    "not-ready": "Outside the maintained proof lane.",
  };
  return meanings[bucket] ?? "Review the row before promotion.";
}

function gapMeaning(gap) {
  if (gap.includes("existing-secret")) return "The chart does not expose a clean bring-your-own-secret render path. Do not invent one silently.";
  if (gap.includes("no-crds")) return "The chart bakes CRDs into templates or lacks a clean CRDs-off switch. CRD ownership needs an explicit route.";
  if (gap.includes("tempo single-binary")) return "The current chart path is single-binary; HA belongs to a separate supported topology decision.";
  if (gap.includes("ha")) return "The proof path does not yet teach a realistic HA variant for that chart.";
  return "Review before catalog promotion.";
}

function statusMeaning(status) {
  const meanings = {
    "catalog-supported-with-live-evidence": "Top-20 catalog entry with at least one live proof lane.",
    "catalog-supported-needs-live-expansion": "Catalog entry whose remaining variants need live proof expansion.",
    "proof-grade-ready-for-promotion-review": "Recipe/package proof exists and variants exist; needs human catalog promotion review.",
    "proof-grade-with-named-limitation": "Proof-grade chart with a named capability gap or operator decision.",
    "proof-grade-needs-user-shaped-variant": "Proof-grade chart whose current path is too default-only for catalog promotion.",
    "not-in-current-catalog-lane": "Not part of the maintained top-100 proof lane.",
  };
  return meanings[status] ?? "";
}

function adoptionBucketFor(status) {
  const buckets = {
    "catalog-supported-with-live-evidence": "try-from-public-catalog",
    "catalog-supported-needs-live-expansion": "try-with-lane-check",
    "proof-grade-ready-for-promotion-review": "promote-after-review",
    "proof-grade-needs-user-shaped-variant": "needs-useful-variant",
    "proof-grade-with-named-limitation": "limitation-decision-first",
    "not-in-current-catalog-lane": "not-ready",
  };
  return buckets[status] ?? "not-ready";
}

function adoptionMeaning(bucket) {
  const meanings = {
    "try-from-public-catalog": "A public catalog entry exists and at least one base has live evidence. Check the exact base lane before making a broader claim.",
    "try-with-lane-check": "A public catalog entry exists, but the useful base still needs more live evidence.",
    "promote-after-review": "Recipe/package proof and multiple variants exist. It is a good candidate for catalog review and selected live lanes.",
    "needs-useful-variant": "The proof mechanism works, but the current default-only path is not yet a compelling catalog offer.",
    "limitation-decision-first": "A named capability gap affects the recommended path. Decide whether to support, disclose, or defer it.",
    "not-ready": "The chart is outside the current maintained proof lane.",
  };
  return meanings[bucket] ?? "";
}

function adoptionUse(bucket) {
  const uses = {
    "try-from-public-catalog": "You want a maintained public example and can choose a base with the needed proof lane.",
    "try-with-lane-check": "You accept partial live coverage and will verify the exact base yourself.",
    "promote-after-review": "You are expanding the catalog or choosing the next charts for live evidence.",
    "needs-useful-variant": "You are deciding which realistic base variants users would actually want.",
    "limitation-decision-first": "You need an operator/product decision before presenting the chart as supported.",
    "not-ready": "Use source analysis only; do not present it as catalog support.",
  };
  return uses[bucket] ?? "";
}

function evidenceMeaning(status) {
  const meanings = {
    "live-helm-vs-confighub-parity": "Plain Helm and ConfigHub delivery reached equivalent live outcomes for at least one variant.",
    "gitops-oci-live": "ConfigHub OCI delivery reconciled live through GitOps for at least one variant.",
    "local-kubernetes-live": "Rendered objects were applied to Kubernetes and observed for at least one variant.",
    "in-confighub-proof": "Rendered objects uploaded to ConfigHub and passed the ConfigHub proof lane.",
    "render-parity": "Regular Helm and cub installer setup render-equivalent objects.",
    "not-proven": "No committed proof lane evidence found.",
  };
  return meanings[status] ?? "";
}

function countText(passed, total) {
  const denominator = number(total);
  if (!denominator) return "0/0";
  return `${number(passed)}/${denominator}`;
}

function shortGap(value) {
  const text = ascii(value ?? "").trim();
  if (!text || text === "-" || text.includes("no open gap")) return "-";
  return text.replace(/^-\s*/, "").slice(0, 120);
}

function number(value) {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) counts.set(keyFn(row), (counts.get(keyFn(row)) ?? 0) + 1);
  return new Map([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function parseCsv(text) {
  const lines = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      lines.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    lines.push(row);
  }
  const [headers, ...records] = lines.filter((line) => line.some((item) => item !== ""));
  if (!headers) return [];
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = ascii(value === undefined || value === null ? "" : String(value));
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function ascii(text) {
  return String(text)
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2026", "...");
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|");
}
