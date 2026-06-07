// Generated hook lifecycle work plan.
//
// This script does not execute Helm hooks. It keeps the hook-bearing maintained
// charts visible and defines the receipt paths needed before production support
// can claim hook lifecycle proof.
//
//   node scripts/generate-hook-lifecycle-wave.mjs --generate
//   node scripts/generate-hook-lifecycle-wave.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "hook-lifecycle");
const paths = {
  corpus: join(outputRoot, "top100-hooks.csv"),
  receiptIndex: join(outputRoot, "receipt-index.csv"),
  summary: join(outputRoot, "summary.md"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(paths.corpus, report.outputs.corpus);
  write(paths.receiptIndex, report.outputs.receiptIndex);
  write(paths.summary, report.outputs.summary);
  console.log(`wrote hook lifecycle wave -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [key, path] of Object.entries(paths)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run hooks:lifecycle`);
    check(readFileSync(path, "utf8") === report.outputs[key], `${relativeRepo(path)} is stale; run npm run hooks:lifecycle`);
  }
  console.log(`verified hook lifecycle wave: ${report.hookRows.length} maintained hook chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-hook-lifecycle-wave.mjs --generate
  node scripts/generate-hook-lifecycle-wave.mjs --verify`);
}

function buildReport() {
  const top100 = JSON.parse(readFileSync(join(repoRoot, "data", "top100-catalog-analysis", "raw.json"), "utf8"));
  const top500 = JSON.parse(readFileSync(join(repoRoot, "data", "top500-catalog-analysis", "raw.json"), "utf8"));
  check(Array.isArray(top100.entries), "top100 raw JSON must contain entries");
  check(Array.isArray(top500.rows), "top500 raw JSON must contain rows");

  const top500HookRows = top500.rows.filter(hasHelmHooks);
  const hookRows = top100.entries.filter(hasHelmHooks).map((entry) => {
    const base = firstListItem(entry.supported_variants) || firstListItem(entry.candidate_variants) || entry.start_variant || "default";
    return {
      proof_surface_rank: entry.proof_surface_rank,
      top500_rank: entry.top500_rank,
      chart: entry.chart,
      version: entry.version,
      catalog_status: entry.catalog_status,
      production_readiness: entry.production_readiness,
      selected_base: base,
      source_features: entry.source_features,
      lifecycle_disposition: "requires-route-and-receipt",
      recommended_route: recommendedRoute(entry),
      required_receipt: `data/hook-lifecycle/receipts/${slug(entry.chart)}/${base}/latest.yaml`,
      next_action: "choose lifecycle route, run live path, commit lifecycle or observation receipt",
    };
  });

  const receiptRows = hookRows.map((row) => ({
    chart: row.chart,
    version: row.version,
    base: row.selected_base,
    recommended_route: row.recommended_route,
    required_receipt: row.required_receipt,
    receipt_status: existsSync(join(repoRoot, row.required_receipt)) ? "present" : "not-yet-written",
    minimum_checks: [
      "hook resources inventoried",
      "route selected",
      "controller or operator action recorded",
      "runtime outcome observed",
      "freshness timestamp recorded",
    ].join(";"),
  }));

  check(top500HookRows.length === 54, `expected 54 top500 hook rows; found ${top500HookRows.length}`);
  check(hookRows.length === 5, `expected 5 maintained top100 hook rows; found ${hookRows.length}`);
  check(receiptRows.every((row) => row.receipt_status === "not-yet-written"), "hook lifecycle receipts should not be pre-claimed");

  const outputs = {
    corpus: csv(hookRows),
    receiptIndex: csv(receiptRows),
    summary: summary({ top500HookRows, hookRows, receiptRows }),
  };
  return { outputs, hookRows };
}

function hasHelmHooks(row) {
  return splitList(row.source_features).includes("hooks");
}

function recommendedRoute(entry) {
  if (entry.catalog_status === "catalog-supported") return "production-disposition-first";
  if (Number(entry.top500_rank || 9999) <= 50) return "catalog-promotion-review-first";
  return "recipe-maintenance-review-first";
}

function summary({ top500HookRows, hookRows, receiptRows }) {
  const catalogSupported = hookRows.filter((row) => row.catalog_status === "catalog-supported").length;
  const proofGrade = hookRows.filter((row) => row.catalog_status === "proof-grade").length;
  return `# Hook Lifecycle Wave

This generated file tracks maintained charts whose source scan found Helm hooks.
Render equivalence makes hook resources explicit; it does not prove hook
execution. Production support requires a lifecycle route and a lifecycle or
observation receipt for that route.

Hook rows move through explicit states: inventoried, render-proven,
route-selected, lifecycle-observed, or blocked. The first two states are useful
evidence, but they are not hook lifecycle support. Some hooks may remain blocked
until chart-specific review finds a safe route.

## Current Reading

\`\`\`text
top-500 charts with Helm hooks:        ${top500HookRows.length}
top-100 maintained charts with hooks:  ${hookRows.length}
catalog-supported hook charts:         ${catalogSupported}
proof-grade hook charts:               ${proofGrade}
hook lifecycle receipts present:       ${receiptRows.filter((row) => row.receipt_status === "present").length}
\`\`\`

## Files

| File | Purpose |
| --- | --- |
| \`top100-hooks.csv\` | Maintained recipe/package entries whose source scan found Helm hooks. |
| \`receipt-index.csv\` | Required receipt path and minimum checks for each hook lifecycle proof. |

## Rule

A row is not hook-lifecycle-proven until the receipt under
\`data/hook-lifecycle/receipts/\` exists and records the chosen route,
execution or controller behavior, runtime outcome, and freshness timestamp.

Related lifecycle observations can exist outside this hook queue when a chart
has hook-like runtime behavior but no Helm hook. For example, cert-manager and
External Secrets lifecycle observations live under
\`data/lifecycle-observations/cert-manager-eso/\`. Those receipts demonstrate
the lifecycle-observation pattern, not universal hook support.
`;
}

function firstListItem(value) {
  return splitList(value)[0] ?? "";
}

function splitList(value) {
  return String(value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function csv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function slug(value) {
  return String(value).replaceAll("/", "-");
}
