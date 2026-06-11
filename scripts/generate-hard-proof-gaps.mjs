#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "hard-proof-gaps");
const summaryPath = join(outDir, "summary.md");
const csvPath = join(outDir, "shortlist.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
  console.log(`wrote ${relativeRepo(csvPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "missing hard proof gaps summary; run npm run top100:hard-gaps");
  check(existsSync(csvPath), "missing hard proof gaps CSV; run npm run top100:hard-gaps");
  check(readFileSync(summaryPath, "utf8") === report.summary, "hard proof gaps summary is stale");
  check(readFileSync(csvPath, "utf8") === report.csv, "hard proof gaps CSV is stale");
  console.log(`verified hard proof gaps shortlist for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-hard-proof-gaps.mjs --generate
  node scripts/generate-hard-proof-gaps.mjs --verify`);
}

function buildReport() {
  const quirkRows = parseCsvFile("data/quirk-work-queue/top100-queue.csv");
  const remoteRows = parseCsvFile("data/remote-dependency-closure/top100.csv");
  const hookRows = parseCsvFile("data/hook-route-candidates/candidates.csv");
  const coverageRows = parseCsvFile("data/top100-coverage/work-queue.csv");

  const remoteByRef = new Map(remoteRows.map((row) => [chartRef(row.chart, row.source_version), row]));
  const hookByRef = new Map(hookRows.map((row) => [chartRef(row.chart, row.version), row]));
  const coverageByRef = new Map(coverageRows.map((row) => [row.chart_ref, row]));

  const rows = quirkRows
    .filter((row) => row.priority === "P0")
    .map((row) => shortlistRow(row, remoteByRef, hookByRef, coverageByRef))
    .sort((left, right) => Number(right.score) - Number(left.score) || Number(left.source_rank) - Number(right.source_rank))
    .slice(0, 25)
    .map((row, index) => ({ ...row, shortlist_rank: index + 1 }));

  check(rows.length > 0, "expected at least one hard proof gap row");
  check(rows.some((row) => row.primary_gap === "apiservice"), "expected APIService gap to remain visible");
  check(rows.some((row) => row.remote_dependency_workstream), "expected remote dependency gap to remain visible");
  check(rows.some((row) => row.hook_route_candidate), "expected hook route candidates to remain visible");

  return {
    rows,
    csv: rowsToCsv(rows),
    summary: summary(rows),
  };
}

function shortlistRow(row, remoteByRef, hookByRef, coverageByRef) {
  const ref = chartRef(row.chart, row.source_version);
  const remote = remoteByRef.get(ref);
  const hook = hookByRef.get(ref);
  const coverage = coverageByRef.get(ref);
  const openQuirks = splitList(row.open_quirks);
  const score = Number(row.priority_score)
    + (remote?.priority === "P0" ? 8 : 0)
    + (hook ? 8 : 0)
    + (row.catalog_status === "catalog-supported" ? 8 : 0)
    + (openQuirks.includes("apiservice") ? 6 : 0)
    + (openQuirks.includes("webhooks") ? 4 : 0)
    + (openQuirks.includes("crds") ? 4 : 0);
  const remoteAction = remote?.next_action ?? "";
  const hookAction = hook?.promotion_next_step ?? "";
  const firstAction = [
    row.first_action,
    remoteAction && remoteAction !== row.first_action ? remoteAction : "",
    hookAction,
  ].filter(Boolean)[0] ?? "";
  const requiredArtifact = [
    row.next_artifact,
    remote?.done_when ? "data/remote-dependency-closure/top100.csv" : "",
    hook ? "data/hook-route-candidates/candidates.csv" : "",
  ].filter(Boolean)[0] ?? "";
  return {
    shortlist_rank: "",
    score,
    source_rank: row.source_rank,
    chart: row.chart,
    version: row.source_version,
    chart_ref: ref,
    catalog_status: row.catalog_status,
    proof_surface: row.proof_surface,
    top100_queue: coverage?.queue ?? "",
    primary_gap: row.top_quirk,
    open_quirks: row.open_quirks,
    remote_dependency_workstream: remote?.workstream ?? "",
    hook_route_candidate: hook?.candidate_route ?? "",
    first_action: firstAction,
    required_artifact: requiredArtifact,
    why_it_matters: row.why_it_matters,
    model_gap: row.model_gap,
    source_evidence: row.source_evidence,
    not_a_claim: "shortlist row only; not a support decision or proof that the chart is unsupported",
  };
}

function summary(rows) {
  const byGap = groupCount(rows, "primary_gap");
  const catalogRows = rows.filter((row) => row.catalog_status === "catalog-supported");
  const hookRows = rows.filter((row) => row.hook_route_candidate);
  const remoteRows = rows.filter((row) => row.remote_dependency_workstream);
  return `# Hard Proof Gaps Shortlist

This generated shortlist joins the P0 source-quirk queue with remote dependency
closure and hook route candidate data. It is the short assignment surface for
the top-100 rows most likely to damage trust if the project overclaims them.

It does not say these charts are unsupported. It says the named gap must be
modeled, routed, observed, or explicitly refused before stronger catalog or
production claims are made.

## Summary

~~~text
shortlist rows: ${rows.length}
catalog-supported rows on shortlist: ${catalogRows.length}
rows with remote dependency work: ${remoteRows.length}
rows with hook route candidates: ${hookRows.length}
~~~

## Main Gap Types

| Gap | Rows |
| --- | ---: |
${[...byGap.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([gap, count]) => `| ${gap} | ${count} |`).join("\n")}

## First Rows

| Rank | Chart | Main gap | Why it matters | First action |
| ---: | --- | --- | --- | --- |
${rows.slice(0, 12).map((row) => `| ${row.shortlist_rank} | \`${row.chart_ref}\` | ${row.primary_gap} | ${escapePipes(row.why_it_matters)} | ${escapePipes(row.first_action)} |`).join("\n")}

## Catalog Rows On The Shortlist

These rows are visible because they are already public catalog entries or have
strong proof surfaces. They should be kept honest first.

| Chart | Main gap | Next artifact |
| --- | --- | --- |
${catalogRows.map((row) => `| \`${row.chart_ref}\` | ${row.primary_gap} | ${row.required_artifact || "-"} |`).join("\n") || "| none | - | - |"}

## How To Use This

1. Pick a row from the top of the table.
2. Open the source evidence and required artifact.
3. Decide whether the gap becomes a modeled fact, a route receipt, a runtime
   observation, a better base variant, or an explicit blocker.
4. Regenerate the owning queue before changing any support or catalog claim.

## Source Tables

| Source | Use |
| --- | --- |
| [quirk-work-queue/top100-queue.csv](../quirk-work-queue/top100-queue.csv) | P0 source-quirk queue and first action. |
| [remote-dependency-closure/top100.csv](../remote-dependency-closure/top100.csv) | Dependency closure and refresh-survival workstreams. |
| [hook-route-candidates/candidates.csv](../hook-route-candidates/candidates.csv) | Candidate routes for hook-bearing source charts not yet in the maintained queue. |
| [top100-coverage/work-queue.csv](../top100-coverage/work-queue.csv) | Current top-100 promotion, variant, and limitation queues. |
`;
}

function rowsToCsv(rows) {
  const headers = [
    "shortlist_rank",
    "score",
    "source_rank",
    "chart",
    "version",
    "chart_ref",
    "catalog_status",
    "proof_surface",
    "top100_queue",
    "primary_gap",
    "open_quirks",
    "remote_dependency_workstream",
    "hook_route_candidate",
    "first_action",
    "required_artifact",
    "why_it_matters",
    "model_gap",
    "source_evidence",
    "not_a_claim",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  return lines.filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === "\"" && line[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function chartRef(chart, version) {
  return `${chart}@${version}`;
}

function splitList(value) {
  return String(value ?? "").split(";").map((item) => item.trim()).filter(Boolean);
}

function groupCount(rows, key) {
  const result = new Map();
  for (const row of rows) result.set(row[key], (result.get(row[key]) ?? 0) + 1);
  return result;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}
