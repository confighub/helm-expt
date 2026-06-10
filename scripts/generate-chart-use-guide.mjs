#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "chart-use-guide");
const summaryPath = join(outDir, "summary.md");
const csvPath = join(outDir, "chart-use-guide.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
  console.log("wrote chart use guide");
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "data/chart-use-guide/summary.md is missing; run npm run chart-use:guide");
  check(existsSync(csvPath), "data/chart-use-guide/chart-use-guide.csv is missing; run npm run chart-use:guide");
  check(readFileSync(summaryPath, "utf8") === report.summary, "data/chart-use-guide/summary.md is stale; run npm run chart-use:guide");
  check(readFileSync(csvPath, "utf8") === report.csv, "data/chart-use-guide/chart-use-guide.csv is stale; run npm run chart-use:guide");
  console.log(`verified chart use guide for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-chart-use-guide.mjs --generate
  node scripts/generate-chart-use-guide.mjs --verify`);
}

function buildReport() {
  const top20StatusByChart = new Map(readCsv("data/status-dashboard/top20-status.csv").map((row) => [row.chart, row]));
  const rows = readCsv("data/top100-readiness/readiness.csv").map((row) => {
    const top20Status = top20StatusByChart.get(row.chart);
    const route = routeFor(row);
    return {
      proof_surface_rank: row.proof_surface_rank,
      chart: row.chart,
      answer: route.answer,
      plain_english: route.plainEnglish,
      first_action: route.firstAction,
      recommended_base_or_variant: recommendedBase(row, top20Status),
      command_or_file: route.commandOrFile(row, top20Status),
      strongest_evidence: row.strongest_evidence,
      render_parity: row.render_parity,
      live_summary: liveSummary(row),
      hard_gap: row.hard_gap || "-",
      production_note: route.productionNote(row, top20Status),
      catalog_path: row.catalog_path,
      helm_pain_report: row.helm_pain_report,
    };
  });
  return { rows, csv: toCsv(rows), summary: summary(rows) };
}

function routeFor(row) {
  if (row.adoption_bucket === "try-from-public-catalog") {
    return {
      answer: "yes-public-catalog",
      plainEnglish: "Use the public catalog entry, then check the exact base and lane before making a production claim.",
      firstAction: "Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command.",
      commandOrFile: (input, top20Status) => top20Status?.recommended_setup_command || input.catalog_path,
      productionNote: () => "Production support is target-scoped. Use production support decisions before claiming production readiness.",
    };
  }
  if (row.adoption_bucket === "promote-after-review") {
    return {
      answer: "not-yet-public-catalog-proof-ready",
      plainEnglish: "The recipe/package proof exists and useful variants exist, but this chart has not been promoted into the public catalog.",
      firstAction: "Run catalog promotion review and add selected live lanes for the base a user would actually try.",
      commandOrFile: (input) => input.catalog_path,
      productionNote: () => "Do not present as a catalog-supported chart until promotion review and support decisions are recorded.",
    };
  }
  if (row.adoption_bucket === "needs-useful-variant") {
    return {
      answer: "not-yet-user-ready",
      plainEnglish: "The mechanism works, but the current base is too default-shaped to be a good user offer.",
      firstAction: "Design at least one useful base variant before catalog promotion.",
      commandOrFile: (input) => input.catalog_path,
      productionNote: () => "Render parity alone is useful evidence, not a production or catalog recommendation.",
    };
  }
  if (row.adoption_bucket === "limitation-decision-first") {
    return {
      answer: "decision-needed-first",
      plainEnglish: "A named capability gap affects the recommended path.",
      firstAction: "Decide whether to support, disclose, defer, or block the hard gap before promotion.",
      commandOrFile: (input) => input.helm_pain_report || input.catalog_path,
      productionNote: (input) => `Resolve the named gap first: ${input.hard_gap || "see helm pain report"}.`,
    };
  }
  return {
    answer: "review-needed",
    plainEnglish: "The chart needs manual review before a user-facing recommendation is made.",
    firstAction: "Open top100 readiness and the chart catalog page.",
    commandOrFile: (input) => input.catalog_path,
    productionNote: () => "No production claim.",
  };
}

function recommendedBase(row, top20Status) {
  if (top20Status?.recommended_base) return top20Status.recommended_base.replace(/ \(start-here\)$/, "");
  return (row.variants || "").split(";")[0] || "-";
}

function liveSummary(row) {
  return [
    `local:${row.local_live}`,
    `gitops:${row.gitops_live}`,
    `live-parity:${row.live_parity}`,
    `two-cluster:${row.two_cluster_kind_parity}`,
  ].join(" ");
}

function summary(rows) {
  const answerCounts = groupCount(rows, "answer");
  const firstPublicRows = rows.filter((row) => row.answer === "yes-public-catalog").slice(0, 20);
  const nextRows = rows.filter((row) => row.answer !== "yes-public-catalog").slice(0, 16);
  return `# Chart Use Guide

This generated guide answers one user question:

~~~text
Can I use this chart, and what should I do next?
~~~

It is a routing surface over the maintained top-100 data. It does not replace
the detailed proof lanes, production decisions, or per-chart catalog pages.

## Summary

| Answer | Charts | Meaning |
| --- | ---: | --- |
| yes-public-catalog | ${answerCounts.get("yes-public-catalog") ?? 0} | Public catalog entry exists. Choose a base and check the lane you need. |
| not-yet-public-catalog-proof-ready | ${answerCounts.get("not-yet-public-catalog-proof-ready") ?? 0} | Proof exists and variants look useful, but catalog promotion review is not done. |
| not-yet-user-ready | ${answerCounts.get("not-yet-user-ready") ?? 0} | The current proof is too default-shaped; design a useful base variant first. |
| decision-needed-first | ${answerCounts.get("decision-needed-first") ?? 0} | A named gap must be supported, disclosed, deferred, or blocked before promotion. |

## How To Use This

1. Find the chart in [chart-use-guide.csv](./chart-use-guide.csv).
2. Read the \`answer\` and \`first_action\` columns.
3. Open the per-chart \`catalog_path\` for variants and receipts.
4. Open the \`helm_pain_report\` when the row has a hard gap or quirk.
5. Check production decisions before using any row as a production-support claim.

## Public Catalog Rows

These rows are the cleanest public starting points. They are still scoped by
base variant and proof lane.

| Chart | Recommended base | Evidence | First action |
| --- | --- | --- | --- |
${firstPublicRows.map((row) => `| \`${row.chart}\` | \`${row.recommended_base_or_variant}\` | \`${row.strongest_evidence}\` | ${row.first_action} |`).join("\n")}

## Next Non-Catalog Rows

These rows have proof value but need promotion review, a better base variant,
or a limitation decision before they should be treated as catalog offers.

| Chart | Answer | Evidence | First action |
| --- | --- | --- | --- |
${nextRows.map((row) => `| \`${row.chart}\` | \`${row.answer}\` | \`${row.strongest_evidence}\` | ${row.first_action} |`).join("\n")}

## Boundaries

- A public catalog row is not a blanket production-support claim.
- A render-parity row proves the installer path matches Helm under recorded
  inputs. It does not prove live runtime behavior by itself.
- A hard gap is a product or operator decision, not an automatic failure.
- Use [Top-100 Readiness](../top100-readiness/summary.md), [Outcome Coverage](../outcome-coverage/summary.md), and [Production Support Decisions](../production-support-decisions/summary.md) for drill-down.
`;
}

function readCsv(relativePath) {
  const text = readFileSync(join(repoRoot, relativePath), "utf8").trim();
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csv(row[header])).join(",")).join("\n")}\n`;
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function groupCount(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
  }
  return counts;
}
