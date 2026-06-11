#!/usr/bin/env node

// Top-100 hook coverage bridge.
//
// This joins the source hook inventory, maintained hook lifecycle queue, and
// candidate route plans. It answers the simple reviewer question: for each
// top-100 chart where the source scan found Helm hooks, do we have an observed
// maintained route, a partial route, a candidate route, or an uncovered row?
//
//   node scripts/generate-hook-coverage.mjs --generate
//   node scripts/generate-hook-coverage.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "hook-coverage");
const outputs = {
  csv: join(outputRoot, "top100-hook-coverage.csv"),
  summary: join(outputRoot, "summary.md"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run hooks:coverage`);
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run hooks:coverage`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run hooks:coverage`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run hooks:coverage`);
  console.log(`verified hook coverage for ${report.rows.length} top100 source hook row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-hook-coverage.mjs --generate
  node scripts/generate-hook-coverage.mjs --verify`);
}

function buildReport() {
  const sourceRows = parseCsvFile("data/hook-lifecycle/source-top100-hooks.csv");
  const maintainedRows = parseCsvFile("data/hook-lifecycle/maintained-hook-queue.csv");
  const candidateRows = parseCsvFile("data/hook-route-candidates/candidates.csv");
  const maintainedByChart = new Map(maintainedRows.map((row) => [row.chart, row]));
  const candidateByChart = new Map(candidateRows.map((row) => [row.chart, row]));

  check(sourceRows.length === 11, `expected 11 source top100 hook rows; found ${sourceRows.length}`);
  check(candidateRows.length >= 8, `expected at least 8 hook candidate rows; found ${candidateRows.length}`);
  for (const candidate of candidateRows) {
    check(candidate.status === "candidate-route-plan", `${candidate.chart}@${candidate.version} candidate status must be candidate-route-plan`);
    check(existsSync(join(repoRoot, candidateYamlPath(candidate))), `${candidate.chart}@${candidate.version} missing ${candidateYamlPath(candidate)}`);
  }

  const rows = sourceRows.map((source) => {
    const maintained = maintainedByChart.get(source.chart);
    const candidate = candidateByChart.get(source.chart);
    if (maintained) return rowForMaintained(source, maintained);
    if (candidate) return rowForCandidate(source, candidate);
    return rowForMissing(source);
  });

  const candidateSourceCharts = new Set(rows.filter((row) => row.coverage_status === "candidate-route-plan").map((row) => row.chart));
  const maintainedSourceCharts = new Set(rows.filter((row) => row.coverage_status.startsWith("maintained-")).map((row) => row.chart));
  const sourceCharts = new Set(sourceRows.map((row) => row.chart));
  const extraCandidates = candidateRows.filter((row) => !sourceCharts.has(row.chart));
  const extraMaintained = maintainedRows.filter((row) => !sourceCharts.has(row.chart));
  const missingRows = rows.filter((row) => row.coverage_status === "uncovered-source-hook");

  check(missingRows.length === 0, `top100 source hook rows without maintained or candidate route: ${missingRows.map((row) => row.chart).join(", ")}`);

  const summary = summaryMarkdown({
    rows,
    sourceRows,
    maintainedRows,
    candidateRows,
    maintainedSourceCharts,
    candidateSourceCharts,
    extraCandidates,
    extraMaintained,
  });
  return { rows, csv: toCsv(rows), summary };
}

function rowForMaintained(source, maintained) {
  return {
    rank: source.rank,
    chart: source.chart,
    source_version: source.version,
    hook_count: source.hook_count,
    hook_types: source.hook_types,
    coverage_status: maintainedStatus(maintained.receipt_status),
    maintained_version: maintained.version,
    candidate_version: "",
    route_or_policy: maintained.route_hint,
    evidence: `data/hook-lifecycle/maintained-hook-queue.csv;${maintained.required_receipt}`,
    next_action: maintained.next_action,
    note: "maintained hook lifecycle queue row",
  };
}

function rowForCandidate(source, candidate) {
  return {
    rank: source.rank,
    chart: source.chart,
    source_version: source.version,
    hook_count: source.hook_count,
    hook_types: source.hook_types,
    coverage_status: "candidate-route-plan",
    maintained_version: "",
    candidate_version: candidate.version,
    route_or_policy: candidate.candidate_route,
    evidence: `data/hook-route-candidates/candidates.csv;${candidateYamlPath(candidate)}`,
    next_action: candidate.promotion_next_step,
    note: "candidate route only; no maintained receipt or runtime observation yet",
  };
}

function rowForMissing(source) {
  return {
    rank: source.rank,
    chart: source.chart,
    source_version: source.version,
    hook_count: source.hook_count,
    hook_types: source.hook_types,
    coverage_status: "uncovered-source-hook",
    maintained_version: "",
    candidate_version: "",
    route_or_policy: "",
    evidence: "data/hook-lifecycle/source-top100-hooks.csv",
    next_action: "write candidate route or explicit blocker before stronger hook claims",
    note: "source scan found hooks but no maintained row or candidate route exists",
  };
}

function maintainedStatus(receiptStatus) {
  if (receiptStatus === "observed") return "maintained-observed";
  if (receiptStatus === "partially-observed") return "maintained-partial";
  if (receiptStatus === "route-selected") return "maintained-route-selected";
  if (receiptStatus === "blocked") return "maintained-blocked";
  return "maintained-needs-classification";
}

function summaryMarkdown({
  rows,
  sourceRows,
  maintainedRows,
  candidateRows,
  maintainedSourceCharts,
  candidateSourceCharts,
  extraCandidates,
  extraMaintained,
}) {
  const counts = countBy(rows, (row) => row.coverage_status);
  const sourceMaintainedRows = rows.filter((row) => row.coverage_status.startsWith("maintained-"));
  const sourceCandidateRows = rows.filter((row) => row.coverage_status === "candidate-route-plan");
  const statusRows = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return `# Top-100 Hook Coverage

This generated report joins the source-scan hook inventory to the maintained
hook lifecycle queue and the candidate route plans.

It answers:

~~~text
For each top-100 chart where the source scan found Helm hooks, do we have a
maintained lifecycle receipt, a candidate route, or an uncovered row?
~~~

It does not claim hook execution for candidate rows. Candidate rows are route
plans only. Maintained rows only claim what their receipt status says.

## Current Reading

~~~text
source top-100 hook rows:                    ${sourceRows.length}
source rows with maintained hook coverage:   ${sourceMaintainedRows.length}
source rows with candidate route coverage:   ${sourceCandidateRows.length}
source rows still uncovered:                 ${rows.filter((row) => row.coverage_status === "uncovered-source-hook").length}
maintained hook queue rows total:            ${maintainedRows.length}
candidate route rows total:                  ${candidateRows.length}
hook-like candidate rows outside inventory:  ${extraCandidates.length}
maintained rows outside source top100 hooks: ${extraMaintained.length}
~~~

## Coverage Status

| Status | Rows |
| --- | ---: |
${statusRows.map(([status, count]) => `| \`${status}\` | ${count} |`).join("\n")}

## Source Top-100 Rows

| Rank | Chart | Source version | Status | Evidence | Next action |
| ---: | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.rank} | \`${row.chart}\` | ${row.source_version} | \`${row.coverage_status}\` | ${escapePipes(row.evidence)} | ${escapePipes(row.next_action)} |`).join("\n")}

## Extra Rows

These rows are useful, but they are not counted as source top-100 hook coverage.

| Type | Chart | Version | Why |
| --- | --- | --- | --- |
${extraCandidates.map((row) => `| hook-like candidate | \`${row.chart}\` | ${row.version} | candidate route exists, but this exact chart row is not in the source top-100 hook inventory |`).join("\n")}
${extraMaintained.map((row) => `| maintained hook row | \`${row.chart}\` | ${row.version} | maintained hook lifecycle row exists outside the source top-100 hook inventory |`).join("\n")}

## How To Use This

- \`maintained-observed\` means a maintained hook lifecycle receipt has runtime
  observation or execution evidence for the selected route.
- \`maintained-partial\` means a maintained receipt exists and at least one
  lifecycle path was observed, but another phase such as upgrade/delete remains.
- \`candidate-route-plan\` means the source hook has been reviewed and routed,
  but the chart is not yet in the maintained hook lifecycle queue.
- \`uncovered-source-hook\` must stay at zero before saying the top-100 hook
  inventory is fully classified.

## Files

| File | Purpose |
| --- | --- |
| \`top100-hook-coverage.csv\` | One row per source top-100 hook chart with maintained/candidate coverage status. |
| \`data/hook-lifecycle/source-top100-hooks.csv\` | Source-scan hook inventory. |
| \`data/hook-lifecycle/maintained-hook-queue.csv\` | Maintained hook lifecycle queue. |
| \`data/hook-route-candidates/candidates.csv\` | Candidate route plans that are not maintained receipts. |

Regenerate:

~~~sh
npm run hooks:coverage
npm run hooks:coverage:verify
~~~
`;
}

function candidateYamlPath(row) {
  return `data/hook-route-candidates/${row.chart.replace(/[^a-z0-9]+/gi, "-")}.yaml`;
}

function countBy(rows, keyFn) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function parseCsvFile(path) {
  const full = join(repoRoot, path);
  const text = readFileSync(full, "utf8").trim();
  if (!text) return [];
  const rows = parseCsv(text);
  const headers = rows[0] ?? [];
  return rows.slice(1).map((cols) => Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (quote) {
      if (ch === "\"" && text[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (ch === "\"") {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === "\"") {
      quote = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}
