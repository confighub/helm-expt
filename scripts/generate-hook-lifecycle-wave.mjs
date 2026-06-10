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
  const sourceScanRows = JSON.parse(readFileSync(join(repoRoot, "data", "top500-catalog-analysis", "source", "source-feature-scan.raw.json"), "utf8"));
  const lifecycleObservationRows = readCsvIfExists("data/lifecycle-observations/cert-manager-eso/summary.csv");
  check(Array.isArray(top100.entries), "top100 raw JSON must contain entries");
  check(Array.isArray(top500.rows), "top500 raw JSON must contain rows");
  check(Array.isArray(sourceScanRows), "source feature scan raw JSON must contain rows");

  const top500HookRows = top500.rows.filter(hasHelmHooks);
  const hookRows = top100.entries.filter(hasHelmHooks).map((entry) => {
    const sourceRow = sourceScanRows.find((row) => row.chart === entry.chart) ?? {};
    const base = firstListItem(entry.supported_variants) || firstListItem(entry.candidate_variants) || entry.start_variant || "default";
    const requiredReceipt = `data/hook-lifecycle/receipts/${slug(entry.chart)}/${base}/latest.yaml`;
    const receipt = hookReceiptState(requiredReceipt);
    return {
      proof_surface_rank: entry.proof_surface_rank,
      top500_rank: entry.top500_rank,
      chart: entry.chart,
      version: entry.version,
      catalog_status: entry.catalog_status,
      production_readiness: entry.production_readiness,
      selected_base: base,
      source_features: entry.source_features,
      hook_count: sourceRow.hooks?.count ?? "",
      hook_types: sourceRow.hookTypesText ?? "",
      hook_examples: (sourceRow.hooks?.examples ?? []).join(";"),
      test_hook_count: sourceRow.testHooks?.count ?? "",
      hook_weight_count: sourceRow.hookWeights?.count ?? "",
      hook_delete_policy_count: sourceRow.hookDeletePolicies?.count ?? "",
      job_count: sourceRow.jobs ?? "",
      webhook_count: Number(sourceRow.validatingWebhooks ?? 0) + Number(sourceRow.mutatingWebhooks ?? 0),
      crd_count: sourceRow.crdFiles ?? "",
      lookup_count: sourceRow.lookup?.count ?? "",
      lifecycle_disposition: receipt.lifecycleDisposition,
      recommended_route: recommendedRoute(entry),
      route_hint: routeHint(sourceRow),
      required_receipt: requiredReceipt,
      receipt_status: receipt.receiptStatus,
      next_action: nextActionFor(receipt),
    };
  });

  const receiptRows = hookRows.map((row) => ({
    chart: row.chart,
    version: row.version,
    base: row.selected_base,
    recommended_route: row.recommended_route,
    required_receipt: row.required_receipt,
    receipt_status: row.receipt_status,
    hook_types: row.hook_types,
    route_hint: row.route_hint,
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
  check(receiptRows.every((row) => ["not-yet-written", "route-selected", "observed", "blocked", "needs-classification"].includes(row.receipt_status)), "hook lifecycle receipt status must be explicit");
  for (const row of hookRows) {
    if (row.receipt_status === "observed") verifyObservedReceipt(row.required_receipt);
  }

  const outputs = {
    corpus: csv(hookRows),
    receiptIndex: csv(receiptRows),
    summary: summary({ top500HookRows, hookRows, receiptRows, lifecycleObservationRows }),
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

function hookReceiptState(path) {
  const absolute = join(repoRoot, path);
  if (!existsSync(absolute)) {
    return {
      receiptStatus: "not-yet-written",
      lifecycleDisposition: "requires-route-and-receipt",
    };
  }

  const text = readFileSync(absolute, "utf8");
  const result = fieldValue(text, "result") || fieldValue(text, "status") || fieldValue(text, "phase");
  if (result === "route-selected") {
    return {
      receiptStatus: "route-selected",
      lifecycleDisposition: "route-selected",
    };
  }
  if (["pass", "observed", "observed-pass", "lifecycle-observed"].includes(result)) {
    const observedAt = fieldValue(text, "observedAt");
    const runtimeObserved = fieldValue(text, "runtimeObserved");
    const evidencePaths = receiptEvidencePaths(text);
    const missingEvidence = evidencePaths.filter((evidencePath) => !existsSync(join(repoRoot, evidencePath)));
    if (!observedAt || runtimeObserved !== "true" || missingEvidence.length > 0) {
      return {
        receiptStatus: "needs-classification",
        lifecycleDisposition: "observed-receipt-incomplete",
      };
    }
    return {
      receiptStatus: "observed",
      lifecycleDisposition: "lifecycle-observed",
    };
  }
  if (result === "blocked") {
    return {
      receiptStatus: "blocked",
      lifecycleDisposition: "blocked",
    };
  }
  return {
    receiptStatus: "needs-classification",
    lifecycleDisposition: "receipt-present-needs-classification",
  };
}

function fieldValue(text, field) {
  const pattern = new RegExp(`^\\s*${field}:\\s*["']?([^"'\\n#]+)`, "m");
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function receiptEvidencePaths(text) {
  return [...text.matchAll(/^(\s*)-?\s*path:\s*["']?([^"'\n#]+)["']?/gm)]
    .map((match) => match[2].trim())
    .filter(Boolean);
}

function verifyObservedReceipt(path) {
  const text = readFileSync(join(repoRoot, path), "utf8");
  const observedAt = fieldValue(text, "observedAt");
  const runtimeObserved = fieldValue(text, "runtimeObserved");
  const evidencePaths = receiptEvidencePaths(text);
  check(Boolean(observedAt), `${path} is observed but missing observedAt`);
  check(runtimeObserved === "true", `${path} is observed but missing runtimeObserved: true`);
  check(evidencePaths.length > 0, `${path} is observed but has no evidence paths`);
  for (const evidencePath of evidencePaths) {
    check(existsSync(join(repoRoot, evidencePath)), `${path} references missing evidence ${evidencePath}`);
  }
}

function nextActionFor(receipt) {
  if (receipt.receiptStatus === "not-yet-written") {
    return "choose lifecycle route and commit route receipt";
  }
  if (receipt.receiptStatus === "route-selected") {
    return "run selected lifecycle path and commit observation or execution receipt";
  }
  if (receipt.receiptStatus === "observed") {
    return "keep receipt fresh when chart, base, or cluster version changes";
  }
  if (receipt.receiptStatus === "blocked") {
    return "resolve blocker or keep chart outside production support";
  }
  return "classify lifecycle receipt result";
}

function routeHint(sourceRow) {
  const types = splitList(sourceRow.hookTypesText);
  const hints = [];
  if (types.some((type) => type.startsWith("pre-install"))) hints.push("preflight-or-presync");
  if (types.some((type) => type.startsWith("post-install"))) hints.push("postsync-check-or-observation");
  if (types.some((type) => type.includes("upgrade"))) hints.push("upgrade-action-with-receipt");
  if (types.some((type) => type.includes("delete"))) hints.push("delete-cleanup-policy");
  if ((sourceRow.testHooks?.count ?? 0) > 0) hints.push("explicit-test-check");
  if ((sourceRow.hookWeights?.count ?? 0) > 0) hints.push("preserve-ordering");
  if ((sourceRow.hookDeletePolicies?.count ?? 0) > 0) hints.push("preserve-cleanup-policy");
  if ((Number(sourceRow.validatingWebhooks ?? 0) + Number(sourceRow.mutatingWebhooks ?? 0)) > 0) hints.push("webhook-readiness-observation");
  if ((sourceRow.lookup?.count ?? 0) > 0) hints.push("target-facts-or-preflight");
  return [...new Set(hints)].join(";");
}

function summary({ top500HookRows, hookRows, receiptRows, lifecycleObservationRows }) {
  const catalogSupported = hookRows.filter((row) => row.catalog_status === "catalog-supported").length;
  const proofGrade = hookRows.filter((row) => row.catalog_status === "proof-grade").length;
  const lifecycleObservationPass = lifecycleObservationRows.filter((row) => row.result === "pass").length;
  const routeReceipts = receiptRows.filter((row) => ["route-selected", "observed", "blocked"].includes(row.receipt_status)).length;
  const observedReceipts = receiptRows.filter((row) => row.receipt_status === "observed").length;
  const routeOnlyReceipts = receiptRows.filter((row) => row.receipt_status === "route-selected").length;
  const missingRoutes = receiptRows.filter((row) => row.receipt_status === "not-yet-written").length;
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
hook route receipts present:           ${routeReceipts}/${receiptRows.length}
hook lifecycle observations present:   ${observedReceipts}/${receiptRows.length}
hook routes awaiting observation:      ${routeOnlyReceipts}/${receiptRows.length}
hook rows still needing route receipt: ${missingRoutes}/${receiptRows.length}
related lifecycle observations passing: ${lifecycleObservationPass}/${lifecycleObservationRows.length}
\`\`\`

## Files

| File | Purpose |
| --- | --- |
| \`top100-hooks.csv\` | Maintained recipe/package entries whose source scan found Helm hooks. |
| \`receipt-index.csv\` | Required receipt path and minimum checks for each hook lifecycle proof. |

## Rule

A row is not hook-lifecycle-proven just because a route receipt exists. A route
receipt records the selected handling for the hook. Lifecycle proof requires an
execution or observation receipt with runtime outcome and freshness timestamp.

Related lifecycle observations can exist outside this hook queue when a
chart-specific lane is proving runtime behavior that rendered YAML alone cannot
prove. The current cert-manager receipts cover the known
\`startupapicheck\` Helm post-install hook route. The current External Secrets
receipts cover controller/webhook behavior in bases that do not use a Helm
hook. These receipts demonstrate the lifecycle-observation pattern, not
universal hook support.

## Related Lifecycle Observation Lane

This lane is separate from the top100 hook queue. It proves the observation
shape for CRD/webhook/controller behavior that rendered YAML alone cannot prove.

| Chart | Base | Result | Lifecycle policy | Receipt |
| --- | --- | --- | --- | --- |
${lifecycleObservationRows.map((row) => `| ${row.chart}@${row.version} | ${row.base} | ${row.result} | ${row.hook_policy} | ${row.receipt} |`).join("\n")}

## Maintained Hook Chart Details

| Chart | Hooks | Hook types | Route hint | Example templates |
| --- | ---: | --- | --- | --- |
${hookRows.map((row) => `| ${row.chart}@${row.version} | ${row.hook_count} | ${row.hook_types || "-"} | ${row.route_hint || "-"} | ${truncateExamples(row.hook_examples)} |`).join("\n")}
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

function readCsvIfExists(path) {
  const absolute = join(repoRoot, path);
  if (!existsSync(absolute)) return [];
  return parseCsv(readFileSync(absolute, "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
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
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function slug(value) {
  return String(value).replaceAll("/", "-");
}

function truncateExamples(value) {
  const examples = splitList(value);
  if (examples.length === 0) return "-";
  return examples.slice(0, 2).join("<br>");
}
