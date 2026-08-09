#!/usr/bin/env node
// Variant promotion status: one row per chart/version/base in the master
// matrix spine, describing whether ConfigHub's server-side promotion path is
// proven for that base, available but not yet receipt-backed, blocked by an
// upstream proof gap, or not applicable.
//
// This is deliberately not a live runner. It is a generated status join over
// committed evidence. Receipts are written by run-top20-confighub-proof.mjs
// when invoked with --variant-promotion-proof.
//
//   node scripts/generate-variant-promotion-status.mjs --generate
//   node scripts/generate-variant-promotion-status.mjs --verify

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  listFiles,
  listTrackedFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "variant-promotion");
const outputs = {
  status: join(outputRoot, "status.csv"),
  summary: join(outputRoot, "summary.md"),
};

const OUTCOMES = "data/outcome-coverage/base-outcomes.csv";
const RECEIPT_KIND = "VariantPromotionReceipt";
const CHANGESET_PROMOTION_ISSUE = "https://github.com/confighub/helm-expt/issues/682";
const CHANGESET_FIX_NOTE = "ConfigHub v0.1.80 includes the changeset-bound add-new-units fix; rerun this promotion proof to replace the old fallback receipt with a full pass";

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.status, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote variant promotion status -> ${relativeRepo(outputRoot)}/ (${report.rows.length} rows)`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run variant-promotion:status`);
    check(
      readFileSync(path, "utf8") === report[name === "status" ? "csv" : "summary"],
      `${relativeRepo(path)} is stale; run npm run variant-promotion:status`,
    );
  }
  console.log(`verified variant promotion status for ${report.rows.length} chart/base row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-variant-promotion-status.mjs --generate
  node scripts/generate-variant-promotion-status.mjs --verify`);
}

function buildReport() {
  const outcomes = readCsv(OUTCOMES);
  const promotionReceipts = indexPromotionReceipts();
  const rows = outcomes.map((row) => {
    const { chart, version } = splitChartVersion(row.chart);
    const key = `${chart}|${version}|${row.base}`;
    const receipt = promotionReceipts.get(key);
    const confighubReceipt = firstReceiptPath(row.evidence_notes, "confighub-proof-receipt.yaml");
    const serverVariant = confighubReceipt ? serverVariantStatus(confighubReceipt) : null;
    const base = {
      chart,
      version,
      variant: row.base,
      in_confighub: row.in_confighub,
      promotion_status: "",
      matrix_value: "",
      evidence: "",
      reason: "",
      next_action: "",
    };

    if (receipt) {
      const receiptResult =
        receipt.result === "pass"
          ? {
              status: "proven",
              matrix: "yes",
              reason: "server-side promotion receipt passed",
              next: "keep receipt fresh when the upstream base changes",
            }
          : receipt.result === "watch"
            ? {
                status: "proven-with-watch",
                matrix: "watch",
                reason: receipt.reason || "server-side promotion mechanics passed with a recorded product caution",
                next: CHANGESET_FIX_NOTE,
              }
            : {
                status: "blocked",
                matrix: "no",
                reason: receipt.reason || "server-side promotion receipt failed",
                next: "inspect the promotion receipt and resolve the recorded blocker",
              };
      return {
        ...base,
        promotion_status: receiptResult.status,
        matrix_value: receiptResult.matrix,
        evidence: receipt.path,
        reason: receiptResult.reason,
        next_action: receiptResult.next,
      };
    }

    if (row.in_confighub === "pass" && serverVariant?.result === "pass") {
      return {
        ...base,
        promotion_status: "available-needs-receipt",
        matrix_value: "todo",
        evidence: confighubReceipt,
        reason: "base has ConfigHub upload proof and a server-side variant clone, but no cub variant promote receipt yet",
        next_action: `node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts ${chart.split("/").at(-1)} --base ${row.base} --variant-promotion-proof --cleanup-spaces`,
      };
    }

    if (row.in_confighub === "pass") {
      return {
        ...base,
        promotion_status: "needs-server-variant",
        matrix_value: "todo",
        evidence: confighubReceipt,
        reason: "base uploads to ConfigHub, but the committed proof receipt does not yet show a downstream Space created by cub variant create",
        next_action: "rerun the ConfigHub proof lane with current cub variant create and then run variant promotion proof",
      };
    }

    if (row.in_confighub === "missing") {
      return {
        ...base,
        promotion_status: "missing-confighub-proof",
        matrix_value: "todo",
        reason: "promotion depends on upstream and downstream ConfigHub Spaces; the ConfigHub proof lane is missing",
        next_action: "run the ConfigHub proof lane first",
      };
    }

    if (row.in_confighub === "blocked" || row.in_confighub === "fail") {
      return {
        ...base,
        promotion_status: "blocked-by-confighub-proof",
        matrix_value: "no",
        evidence: confighubReceipt,
        reason: `ConfigHub proof lane is ${row.in_confighub}`,
        next_action: "resolve the ConfigHub proof blocker before proving promotion",
      };
    }

    if (row.in_confighub === "n/a" || row.in_confighub === "not-applicable") {
      return {
        ...base,
        promotion_status: "n/a",
        matrix_value: "n/a",
        reason: "ConfigHub promotion is not applicable for this row",
        next_action: "none",
      };
    }

    return {
      ...base,
      promotion_status: "unknown",
      matrix_value: "todo",
      evidence: confighubReceipt,
      reason: `unhandled ConfigHub lane value: ${row.in_confighub}`,
      next_action: "classify this row in generate-variant-promotion-status.mjs",
    };
  });

  return {
    rows,
    csv: toCsv(rows),
    summary: summary(rows),
  };
}

function indexPromotionReceipts() {
  const receipts = new Map();
  const runsRoot = join(repoRoot, "runs");
  if (!existsSync(runsRoot)) return receipts;
  for (const path of listTrackedFiles(runsRoot).filter((file) => file.endsWith("variant-promotion-receipt.yaml"))) {
    const doc = readYaml(path);
    if (doc.kind !== RECEIPT_KIND) continue;
    const subject = doc.spec?.subject ?? {};
    const chart = subject.chart;
    const version = subject.chartVersion;
    const variant = subject.variant;
    if (!chart || !version || !variant) continue;
    const result = doc.spec?.result ?? "unknown";
    const reason = doc.spec?.reason ?? doc.spec?.limitations?.join("; ") ?? "";
    receipts.set(`${chart}|${version}|${variant}`, {
      path: relativeRepo(path),
      result,
      reason,
    });
  }
  return receipts;
}

function serverVariantStatus(path) {
  if (!path || !existsSync(join(repoRoot, path))) return null;
  const doc = readYaml(join(repoRoot, path));
  const variant = doc.spec?.serverSideVariant;
  if (!variant) return null;
  return {
    result: variant.result,
    upstreamSpace: variant.upstreamSpace,
    downstreamSpace: variant.downstreamSpace,
  };
}

function firstReceiptPath(notes, suffix) {
  return String(notes ?? "")
    .split("|")
    .map((part) => part.trim())
    .find((part) => part.endsWith(suffix)) ?? "";
}

function splitChartVersion(value) {
  const at = value.lastIndexOf("@");
  check(at > 0, `chart/version value is not name@version: ${value}`);
  return { chart: value.slice(0, at), version: value.slice(at + 1) };
}

function summary(rows) {
  const byStatus = countBy(rows, (row) => row.promotion_status);
  const byMatrix = countBy(rows, (row) => row.matrix_value);
  const watchRows = rows.filter((row) => row.matrix_value === "watch");
  const watchByReason = [...countBy(watchRows, (row) => row.reason).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `| ${count} | ${reason} | [#682 fixed; rerun required](${CHANGESET_PROMOTION_ISSUE}) |`)
    .join("\n");
  const watchExamples = watchRows
    .slice(0, 10)
    .map((row) => `| \`${row.chart}@${row.version}/${row.variant}\` | ${row.evidence} | ${row.next_action} |`)
    .join("\n");
  const topTodos = rows
    .filter((row) => row.matrix_value === "todo")
    .slice(0, 20)
    .map((row) => `| \`${row.chart}@${row.version}/${row.variant}\` | ${row.promotion_status} | ${row.next_action} |`)
    .join("\n");

  return `# Variant Promotion Status

This generated view records whether each chart/version/base has a proven
server-side ConfigHub promotion path. It is separate from catalog promotion:
this is about a downstream Space created from an upstream Space using
\`cub variant create\`, then later catching up with upstream changes using
\`cub variant promote\`.

Status values:

| Status | Meaning |
| --- | --- |
| \`proven\` | A committed \`VariantPromotionReceipt\` proves \`cub variant promote\` for this chart/base. |
| \`proven-with-watch\` | A committed receipt proves core promotion mechanics, but records a caution such as a changeset integration bug. |
| \`available-needs-receipt\` | The base has ConfigHub upload proof and a server-side clone, but no promotion receipt yet. |
| \`needs-server-variant\` | The base uploads to ConfigHub, but the receipt does not yet show a downstream server-side variant clone. |
| \`missing-confighub-proof\` | Promotion cannot be tested until the ConfigHub proof lane exists. |
| \`blocked-by-confighub-proof\` | Promotion is blocked by the ConfigHub proof lane. |
| \`n/a\` | Promotion is not applicable for this row. |

## Counts

| Status | Rows |
| --- | ---: |
${[...byStatus.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([status, count]) => `| ${status} | ${count} |`).join("\n")}

Matrix values:

| Matrix value | Rows |
| --- | ---: |
${[...byMatrix.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([status, count]) => `| ${status} | ${count} |`).join("\n")}

## Watch Rows

Watch means a receipt proved useful mechanics but recorded a named product
caution. For the changeset fallback rows, the server fix is now present in
ConfigHub v0.1.80; those rows remain watch until their receipts are rerun and
show the changeset-bound path passing.

| Rows | Reason | Tracking |
| ---: | --- | --- |
${watchByReason || "| 0 | — | — |"}

| Row | Evidence | Next action |
| --- | --- | --- |
${watchExamples || "| — | — | — |"}

## First TODO Rows

| Row | Status | Next action |
| --- | --- | --- |
${topTodos || "| — | — | — |"}

## Regenerate

~~~sh
npm run variant-promotion:status
npm run variant-promotion:status:verify
~~~
`;
}

function readCsv(rel) {
  const path = join(repoRoot, rel);
  check(existsSync(path), `variant promotion source missing: ${rel}`);
  const [header, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const headers = parseCsvLine(header);
  return lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
