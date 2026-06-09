#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "lifecycle-boundary");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  csv: join(outputRoot, "lifecycle-boundary.csv"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run lifecycle:boundary`);
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run lifecycle:boundary`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run lifecycle:boundary`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run lifecycle:boundary`);
  console.log(`verified lifecycle boundary for ${report.rows.length} row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-lifecycle-boundary.mjs --generate
  node scripts/generate-lifecycle-boundary.mjs --verify`);
}

function buildReport() {
  const hookRows = parseCsvFile("data/hook-lifecycle/top100-hooks.csv");
  const observationRows = parseCsvFile("data/lifecycle-observations/cert-manager-eso/summary.csv");
  const rows = [
    ...hookRows.map((row) => ({
      lane: "helm-hook-lifecycle-queue",
      chart: `${row.chart}@${row.version}`,
      base: row.selected_base,
      status: hookQueueStatus(row.receipt_status),
      route_or_policy: row.route_hint,
      proves: hookQueueProof(row.receipt_status),
      does_not_prove: hookQueueNonProof(row.receipt_status),
      evidence: `data/hook-lifecycle/top100-hooks.csv;${row.required_receipt}`,
      next_action: row.next_action,
    })),
    ...observationRows.map((row) => ({
      lane: "hook-like-lifecycle-observation",
      chart: `${row.chart}@${row.version}`,
      base: row.base,
      status: row.result,
      route_or_policy: row.hook_policy,
      proves: observationProof(row.chart),
      does_not_prove: "universal Helm hook support or support for unrelated hook-bearing charts",
      evidence: row.receipt,
      next_action: row.result === "pass" ? "keep receipt fresh when chart, base, or cluster version changes" : "rerun lifecycle observation and inspect the receipt",
    })),
  ];

  const hookRouteReceiptCount = hookRows.filter((row) => ["route-selected", "observed", "blocked"].includes(row.receipt_status)).length;
  const hookObservedCount = hookRows.filter((row) => row.receipt_status === "observed").length;
  const hookRouteOnlyCount = hookRows.filter((row) => row.receipt_status === "route-selected").length;
  const hookRouteNeededCount = hookRows.filter((row) => row.receipt_status === "not-yet-written").length;
  const observationPass = observationRows.filter((row) => row.result === "pass").length;
  const csv = toCsv(rows);
  const summary = `# Hook And Lifecycle Boundary

This generated report separates two related but different claims:

~~~text
Helm hook lifecycle support: hook-bearing charts need a selected route and a
receipt before production support.

Hook-like lifecycle observation: some charts have Helm hook, controller, CRD,
webhook, or runtime behavior that rendered YAML cannot prove through render
parity alone.
~~~

The distinction matters because passing cert-manager and External Secrets
lifecycle observations do not mean every Helm hook is solved. Cert-manager
proves a chart-specific route for its known startup API check hook. External
Secrets proves controller-owned webhook behavior in bases that do not use a
Helm hook.

## Current Reading

~~~text
maintained hook-bearing chart rows:       ${hookRows.length}
hook route receipts present:              ${hookRouteReceiptCount}/${hookRows.length}
hook lifecycle observations present:      ${hookObservedCount}/${hookRows.length}
hook routes awaiting observation:         ${hookRouteOnlyCount}/${hookRows.length}
hook rows still needing route receipt:    ${hookRouteNeededCount}/${hookRows.length}
hook-like lifecycle observations passing: ${observationPass}/${observationRows.length}
~~~

## Rows

| Lane | Chart | Base | Status | Route or policy | What it proves | What it does not prove |
| --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.lane} | \`${row.chart}\` | ${row.base} | ${row.status} | ${escapePipes(row.route_or_policy)} | ${escapePipes(row.proves)} | ${escapePipes(row.does_not_prove)} |`).join("\n")}

## Files

| File | Purpose |
| --- | --- |
| \`data/lifecycle-boundary/lifecycle-boundary.csv\` | One row per hook queue item or lifecycle observation row. |
| \`data/hook-lifecycle/top100-hooks.csv\` | Maintained charts whose source scan found Helm hooks. |
| \`data/lifecycle-observations/cert-manager-eso/summary.csv\` | Current cert-manager and External Secrets lifecycle observations. |

Regenerate:

~~~sh
npm run lifecycle:boundary
npm run lifecycle:boundary:verify
~~~
`;
  return { rows, csv, summary };
}

function hookQueueStatus(receiptStatus) {
  if (receiptStatus === "observed") return "lifecycle-observed";
  if (receiptStatus === "route-selected") return "route-selected";
  if (receiptStatus === "blocked") return "blocked";
  if (receiptStatus === "needs-classification") return "receipt-needs-classification";
  return "route-and-receipt-needed";
}

function hookQueueProof(receiptStatus) {
  if (receiptStatus === "observed") return "hook route has a lifecycle observation or execution receipt";
  if (receiptStatus === "route-selected") return "hook templates are inventoried and a route receipt records the selected handling";
  if (receiptStatus === "blocked") return "hook behavior was reviewed and remains blocked";
  if (receiptStatus === "needs-classification") return "hook templates are inventoried and a receipt exists, but its result is not classified";
  return "hook templates are inventoried and a receipt path is declared";
}

function hookQueueNonProof(receiptStatus) {
  if (receiptStatus === "observed") return "universal Helm hook support or support for unrelated hook-bearing charts";
  if (receiptStatus === "route-selected") return "hook execution, cleanup, ordering, upgrade behavior, runtime outcome, or production support";
  if (receiptStatus === "blocked") return "support until the blocker is resolved";
  if (receiptStatus === "needs-classification") return "hook execution or support until the receipt is classified";
  return "hook execution, cleanup, ordering, upgrade behavior, or production support";
}

function observationProof(chart) {
  if (chart === "jetstack/cert-manager") {
    return "CRD ownership policy, startup API readiness route, webhook CA bundle injection, and server dry-run";
  }
  if (chart === "external-secrets/external-secrets") {
    return "CRD ownership policy, webhook CA bundle injection, controller-populated webhook Secret data, and server dry-run";
  }
  return "controller-owned or hook-like lifecycle behavior was observed";
}

function parseCsvFile(path) {
  const full = join(repoRoot, path);
  const text = readFileSync(full, "utf8").trim();
  if (!text) return [];
  const rows = parseCsv(text);
  const headers = rows[0];
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
      if (ch === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
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
