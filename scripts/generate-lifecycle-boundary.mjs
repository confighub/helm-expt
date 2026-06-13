#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "lifecycle-boundary");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  csv: join(outputRoot, "lifecycle-boundary.csv"),
  selectedRoutes: join(outputRoot, "selected-routes.csv"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.selectedRoutes, report.selectedRoutesCsv);
  write(outputs.summary, report.summary);
  console.log(`wrote ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  const expected = {
    csv: report.csv,
    selectedRoutes: report.selectedRoutesCsv,
    summary: report.summary,
  };
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run lifecycle:boundary`);
    check(readFileSync(path, "utf8") === expected[name], `${relativeRepo(path)} is stale; run npm run lifecycle:boundary`);
  }
  console.log(`verified lifecycle boundary for ${report.rows.length} row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-lifecycle-boundary.mjs --generate
  node scripts/generate-lifecycle-boundary.mjs --verify`);
}

function buildReport() {
  const hookRows = parseCsvFile("data/hook-lifecycle/maintained-hook-queue.csv");
  const observationRows = parseCsvFile("data/lifecycle-observations/cert-manager-eso/summary.csv");
  const selectedRouteRows = readSelectedRouteReceipts();
  const rows = [
    ...hookRows.map((row) => ({
      lane: "helm-hook-lifecycle-queue",
      chart: `${row.chart}@${row.version}`,
      base: row.selected_base,
      status: hookQueueStatus(row.receipt_status),
      route_or_policy: row.route_hint,
      proves: hookQueueProof(row.receipt_status),
      does_not_prove: hookQueueNonProof(row.receipt_status),
      evidence: `data/hook-lifecycle/maintained-hook-queue.csv;${row.required_receipt}`,
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
    ...selectedRouteRows.map((row) => ({
      lane: "selected-hook-route",
      chart: `${row.chart}@${row.version}`,
      base: row.base,
      status: row.status,
      route_or_policy: row.route_or_policy,
      proves: row.proves,
      does_not_prove: row.does_not_prove,
      evidence: row.evidence,
      next_action: row.next_action,
    })),
  ];

  const hookRouteReceiptCount = hookRows.filter((row) => ["route-selected", "partially-observed", "observed", "blocked"].includes(row.receipt_status)).length;
  const hookObservedCount = hookRows.filter((row) => row.receipt_status === "observed").length;
  const hookPartiallyObservedCount = hookRows.filter((row) => row.receipt_status === "partially-observed").length;
  const hookRouteOnlyCount = hookRows.filter((row) => row.receipt_status === "route-selected").length;
  const hookRouteNeededCount = hookRows.filter((row) => row.receipt_status === "not-yet-written").length;
  const observationPass = observationRows.filter((row) => row.result === "pass").length;
  const selectedRouteObserved = selectedRouteRows.filter((row) => row.status === "lifecycle-observed").length;
  const csv = toCsv(rows);
  const selectedRoutesCsv = toCsv(selectedRouteRows);
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
maintained hook queue rows:               ${hookRows.length}
hook route receipts present:              ${hookRouteReceiptCount}/${hookRows.length}
hook lifecycle observations present:      ${hookObservedCount}/${hookRows.length}
hook partial lifecycle observations:      ${hookPartiallyObservedCount}/${hookRows.length}
hook routes awaiting observation:         ${hookRouteOnlyCount}/${hookRows.length}
hook rows still needing route receipt:    ${hookRouteNeededCount}/${hookRows.length}
hook-like lifecycle observations passing: ${observationPass}/${observationRows.length}
selected candidate routes observed:       ${selectedRouteObserved}/${selectedRouteRows.length}
~~~

## Rows

| Lane | Chart | Base | Status | Route or policy | What it proves | What it does not prove |
| --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.lane} | \`${row.chart}\` | ${row.base} | ${row.status} | ${escapePipes(row.route_or_policy)} | ${escapePipes(row.proves)} | ${escapePipes(row.does_not_prove)} |`).join("\n")}

## Files

| File | Purpose |
| --- | --- |
| \`data/lifecycle-boundary/lifecycle-boundary.csv\` | One row per hook queue item or lifecycle observation row. |
| \`data/hook-lifecycle/source-top100-hooks.csv\` | Source-scan inventory of top-100 public charts where the retained source scan found Helm hooks. |
| \`data/hook-lifecycle/maintained-hook-queue.csv\` | Maintained hook queue rows that need route, execution, or observation receipts. |
| \`data/lifecycle-observations/cert-manager-eso/summary.csv\` | Current cert-manager and External Secrets lifecycle observations. |
| \`data/lifecycle-boundary/selected-routes.csv\` | Base-specific selected routes promoted from hook route candidates. |
| \`data/hook-route-candidates/selected-routes/*.yaml\` | Receipt files for selected candidate routes. |

Regenerate:

~~~sh
npm run lifecycle:boundary
npm run lifecycle:boundary:verify
~~~
`;
  return { rows, csv, selectedRoutesCsv, summary };
}

function readSelectedRouteReceipts() {
  const receiptDir = join(repoRoot, "data", "hook-route-candidates", "selected-routes");
  if (!existsSync(receiptDir)) return [];
  return readdirSync(receiptDir)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => {
      const path = `data/hook-route-candidates/selected-routes/${name}`;
      const doc = readYaml(join(repoRoot, path));
      const spec = doc.spec ?? {};
      const result = spec.result ?? "";
      const runtimeObserved = spec.execution?.runtimeObserved === true;
      const evidencePaths = (spec.evidence ?? []).map((entry) => entry.path).filter(Boolean);
      check(spec.chart, `${path} is missing spec.chart`);
      check(spec.version, `${path} is missing spec.version`);
      check(spec.base, `${path} is missing spec.base`);
      check(result, `${path} is missing spec.result`);
      for (const evidencePath of evidencePaths) {
        check(evidencePath.startsWith("http") || existsSync(join(repoRoot, evidencePath)), `${path} references missing evidence ${evidencePath}`);
      }
      const status = result === "observed" && runtimeObserved ? "lifecycle-observed" : result === "blocked" ? "blocked" : "route-selected";
      return {
        chart: spec.chart,
        version: spec.version,
        base: spec.base,
        status,
        hook_count: String(spec.route?.phases?.length ?? 1),
        route_or_policy: spec.route?.summary ?? "",
        proves: status === "lifecycle-observed"
          ? "selected hook candidate route has runtime observation for this base"
          : "selected hook candidate route is recorded for this base",
        does_not_prove: "the same route for other bases, full Helm hook execution, full CRD upgrade safety, or production support",
        evidence: [path, ...evidencePaths].join(";"),
        next_action: (spec.remainingWork ?? [])[0] ?? "keep receipt fresh when chart, base, or cluster version changes",
      };
    });
}

function hookQueueStatus(receiptStatus) {
  if (receiptStatus === "observed") return "lifecycle-observed";
  if (receiptStatus === "partially-observed") return "install-lifecycle-observed-upgrade-pending";
  if (receiptStatus === "route-selected") return "route-selected";
  if (receiptStatus === "blocked") return "blocked";
  if (receiptStatus === "needs-classification") return "receipt-needs-classification";
  return "route-and-receipt-needed";
}

function hookQueueProof(receiptStatus) {
  if (receiptStatus === "observed") return "hook route has a lifecycle observation or execution receipt";
  if (receiptStatus === "partially-observed") return "fresh-install lifecycle route has runtime observation; at least one other route remains pending";
  if (receiptStatus === "route-selected") return "hook templates are inventoried and a route receipt records the selected handling";
  if (receiptStatus === "blocked") return "hook behavior was reviewed and remains blocked";
  if (receiptStatus === "needs-classification") return "hook templates are inventoried and a receipt exists, but its result is not classified";
  return "hook templates are inventoried and a receipt path is declared";
}

function hookQueueNonProof(receiptStatus) {
  if (receiptStatus === "observed") return "universal Helm hook support or support for unrelated hook-bearing charts";
  if (receiptStatus === "partially-observed") return "remaining hook phases such as upgrade, delete, cleanup, or production support";
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
