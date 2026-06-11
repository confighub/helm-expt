#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "outcome-evidence-contract");
const summaryPath = join(outputRoot, "summary.md");
const csvPath = join(outputRoot, "outcomes.csv");

const sourcePaths = {
  claims: "data/claims-register/claims.csv",
  status: "data/status-dashboard/status.csv",
};

const contract = [
  {
    id: "inspect-before-install",
    question: "Can I see exactly what the chart will produce before I install it?",
    claimId: "render-parity",
    statusMetrics: ["render parity rows"],
    evidence: ["data/outcome-coverage/base-outcomes.csv", "data/claims-register/summary.md", "data/chart-use-guide/summary.md"],
    verify: "npm run outcomes:verify; npm run claims:register:verify",
    scope: "chart/version/base under recorded values and capability profile",
    nextAction: "Keep new bases on the render-parity lane before publishing them.",
  },
  {
    id: "try-a-supported-public-path",
    question: "Can I start from a recommended public catalog path instead of inventing values?",
    claimId: "top20-live-evidence",
    statusMetrics: ["catalog-supported charts", "top20 start-here base variants", "public catalog answers"],
    evidence: ["CATALOG.md", "data/chart-use-guide/summary.md", "data/top20-base-readiness/summary.md", "site/charts/index.html"],
    verify: "npm run top20:base-readiness:verify; npm run chart-use:guide:verify; npm run site:verify",
    scope: "public catalog entries and their named start-here bases",
    nextAction: "Promote the next proof-grade charts only after base usefulness and live lanes are reviewed.",
  },
  {
    id: "prove-helm-equivalence",
    question: "Can I prove the ConfigHub/installer path did not secretly change Helm output?",
    claimId: "render-parity",
    statusMetrics: ["render parity rows", "two-cluster semantic parity pass rows", "selected live Helm-vs-ConfigHub parity receipts"],
    evidence: ["data/live-kind-parity/summary.md", "data/live-helm-confighub-compare/summary.md", "data/outcome-coverage/base-outcomes.csv"],
    verify: "npm run kind-parity:verify; npm run live-parity:verify; npm run outcomes:verify",
    scope: "selected chart/version/base rows with committed receipts",
    nextAction: "Add or refresh live parity receipts when a base, chart version, or target profile changes.",
  },
  {
    id: "manage-rendered-configs-in-confighub",
    question: "Can I manage the rendered objects as ConfigHub configs with scans and safe operations?",
    claimId: "scan-gates-safe-ops",
    statusMetrics: ["in-ConfigHub proof rows", "runtime/GitOps wave rows", "high-priority scan rows"],
    evidence: ["data/external-scan-lane/summary.md", "data/scan-disposition-workdown/summary.md", "runs"],
    verify: "npm run top20:verify-confighub-proof; npm run external-scan:verify; npm run scan-disposition:workdown:verify",
    scope: "catalog rows with committed ConfigHub upload, scan, safe-op, or runtime receipts",
    nextAction: "Expand ConfigHub scan/safe-operation receipts beyond the current catalog-supported rows.",
  },
  {
    id: "deliver-through-gitops-and-observe-live",
    question: "Can Argo or Flux pull ConfigHub OCI and can I see that the workload actually works?",
    claimId: "oci-gitops-runtime",
    statusMetrics: ["GitOps/OCI live pass rows", "local live rows", "ConfigHub/OCI semantic parity defect receipts"],
    evidence: ["data/runtime-gitops/summary.md", "data/live-e2e/summary.md", "data/live-e2e/cub-scout-watchlist.md"],
    verify: "npm run runtime-gitops:wave:verify; npm run top20:verify-local-e2e; npm run live-parity:verify",
    scope: "live receipts for declared targets; local live is not the same as GitOps live",
    nextAction: "Keep GitOps/runtime receipts fresh and add more target-bound cub-scout witness runs.",
  },
  {
    id: "create-safe-variants",
    question: "Can I create variants without falling back into hidden Helm values sprawl?",
    claimId: "config-variants",
    statusMetrics: ["variant-rich maintained chart rows", "derived variant golden rows", "target-bound derived variant receipts"],
    evidence: ["docs/user/creating-variants.md", "data/variant-goldens/derived-expansion-wave/work-orders.csv", "data/outcome-coverage/derived-variant-outcomes.csv"],
    verify: "npm run variant-goldens:verify; npm run derived-variants:verify; npm run derived-variants:target-bound:verify",
    scope: "base variants are render-time choices; derived variants are post-render refinements",
    nextAction: "Add more target-bound derived variant receipts and keep routing rules visible before OCI delivery.",
  },
  {
    id: "route-custom-overlays",
    question: "Can wrapper charts, values files, and customer overlays be supported without pretending they are simple public-chart installs?",
    claimId: "custom-overlays",
    statusMetrics: ["top100 user-shaped variant queue", "useful-base proposal rows", "useful-base proposals not yet built", "top100 promotion-review queue"],
    evidence: ["docs/user/custom-overlays.md", "docs/reference/customization-algorithm.md", "data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md", "data/useful-base-design-queue/summary.md"],
    verify: "npm run variant-goldens:verify; npm run top100:coverage:verify; npm run top100:useful-base-queue:verify",
    scope: "managed imports and reviewed overlay paths; arbitrary private overlays are not public-catalog guarantees",
    nextAction: "Convert more user-shaped variant queue rows into reviewed base or overlay examples.",
  },
  {
    id: "handle-hooks-and-lifecycle",
    question: "Can hooks, CRDs, webhooks, and controller-populated fields be handled without lying about static YAML?",
    claimId: "hooks-lifecycle",
    statusMetrics: ["top100 source-scan hook charts", "hook lifecycle observations present", "related lifecycle observation receipts passing"],
    evidence: ["data/hook-lifecycle/summary.md", "data/hook-coverage/summary.md", "data/lifecycle-boundary/summary.md", "data/lifecycle-observations/cert-manager-eso/summary.md"],
    verify: "npm run hooks:lifecycle:verify; npm run hooks:coverage:verify; npm run lifecycle:boundary:verify; npm run lifecycle:cert-manager-eso:verify",
    scope: "maintained hook queue and candidate source-hook routes; every hook class remains per-chart until observed or refused",
    nextAction: "Turn candidate hook routes into maintained lifecycle receipts, especially for top-100 source hook charts.",
  },
  {
    id: "make-production-scope-explicit",
    question: "Can I tell what is production-supported, what is review-ready, and what is only proof evidence?",
    claimId: "top20-live-evidence",
    statusMetrics: ["supported decision artifacts", "top20 production-review-ready charts", "rejected decision artifacts"],
    evidence: ["data/production-support-decisions/summary.md", "data/hard-chart-production-packets/summary.md", "data/production-disposition/summary.md"],
    verify: "npm run production:support-decisions:verify; npm run hard-charts:packets:verify; npm run production:disposition:verify",
    scope: "target-scoped support decisions; production support is not implied by render parity",
    nextAction: "Create broader or stricter support decisions only after target, image, scan, lifecycle, and live evidence are refreshed.",
  },
  {
    id: "scale-the-catalog-honestly",
    question: "Can this scale from 20 charts to 100 or 500 without turning into spreadsheet theater?",
    claimId: "top100-proof-corpus",
    statusMetrics: ["proof-grade non-catalog charts", "rows with current recipe proof", "rows with no current recipe proof"],
    evidence: ["data/top100-readiness/summary.md", "data/top100-coverage/summary.md", "data/top500-catalog-analysis/summary.md", "data/status-dashboard/summary.md"],
    verify: "npm run top100:readiness:verify; npm run top100:coverage:verify; npm run top500:catalog:verify; npm run status:dashboard:verify",
    scope: "top-100 has maintained proof artifacts; top-500 is planning/reconnaissance unless a row links to current proof",
    nextAction: "Promote proof-grade rows through useful-base review, selected live lanes, and production disposition.",
  },
  {
    id: "keep-overclaims-out",
    question: "Can I trust the project not to overclaim when a lane is missing or blocked?",
    claimId: "refused-blanket-verification",
    statusMetrics: ["ConfigHub/OCI semantic parity defect receipts", "two-cluster semantic parity defect receipts", "source-scanned but not surfaced axes"],
    evidence: ["data/claims-register/summary.md", "docs/user/what-we-refuse-to-claim.md", "data/status-dashboard/summary.md"],
    verify: "npm run claims:register:verify; npm run docs:verify; npm run status:dashboard:verify",
    scope: "public claims must name chart, version, base, lane, and target profile",
    nextAction: "Keep rejected, partial, planned, watch, blocked, and missing statuses visible in public-facing summaries.",
  },
];

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
  console.log(`wrote outcome evidence contract for ${report.rows.length} outcome(s)`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "missing outcome evidence contract summary; run npm run outcomes:contract");
  check(existsSync(csvPath), "missing outcome evidence contract CSV; run npm run outcomes:contract");
  check(readFileSync(summaryPath, "utf8") === report.summary, "outcome evidence contract summary is stale");
  check(readFileSync(csvPath, "utf8") === report.csv, "outcome evidence contract CSV is stale");
  console.log(`verified outcome evidence contract for ${report.rows.length} outcome(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-outcome-evidence-contract.mjs --generate
  node scripts/generate-outcome-evidence-contract.mjs --verify`);
}

function buildReport() {
  const claims = parseCsvFile(sourcePaths.claims);
  const statusRows = parseCsvFile(sourcePaths.status);
  const packageScripts = Object.keys(JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).scripts ?? {});
  const claimById = new Map(claims.map((row) => [row.id, row]));
  const statusByMetric = new Map(statusRows.map((row) => [row.metric, row]));
  const rows = contract.map((item) => rowFor(item, claimById, statusByMetric, packageScripts));
  return { rows, summary: summary(rows), csv: toCsv(rows) };
}

function rowFor(item, claimById, statusByMetric, packageScripts) {
  const claim = claimById.get(item.claimId);
  check(claim, `missing claim ${item.claimId} for outcome ${item.id}`);
  const metrics = item.statusMetrics.map((metric) => {
    const row = statusByMetric.get(metric);
    check(row, `missing status metric ${metric} for outcome ${item.id}`);
    return row;
  });
  const status = outcomeStatus(claim.status, metrics);
  const sources = [...new Set([...item.evidence, ...metrics.map((row) => row.source), ...splitList(claim.evidence_paths)])];
  for (const path of sources) {
    if (path === "runs") {
      check(existsSync(join(repoRoot, path)), `missing evidence directory ${path}`);
    } else {
      check(existsSync(join(repoRoot, path)), `missing evidence ${path} for outcome ${item.id}`);
    }
  }
  validateNpmCommands(item.verify, packageScripts, item.id);
  return {
    outcome_id: item.id,
    user_question: item.question,
    status,
    claim_status: claim.status,
    representative_metric: metrics.map(formatMetric).join("; "),
    scope: item.scope,
    evidence: sources.join("; "),
    verify_commands: item.verify,
    limit_or_refusal: claim.limit_or_refusal,
    next_action: item.nextAction,
  };
}

function validateNpmCommands(commandText, packageScripts, outcomeId) {
  const scripts = new Set(packageScripts);
  for (const part of commandText.split(";")) {
    const command = part.trim();
    if (!command.startsWith("npm run ")) continue;
    const script = command.replace(/^npm run\s+/, "").split(/\s+/)[0];
    check(scripts.has(script), `outcome ${outcomeId} references missing npm script ${script}`);
  }
}

function outcomeStatus(claimStatus, metrics) {
  if (claimStatus === "refused") return "refused";
  if (claimStatus === "planned") return "planned";
  if (metrics.some((row) => row.status === "gap")) return "gap";
  if (claimStatus === "partial" || metrics.some((row) => row.status === "partial")) return "partial";
  return "backed";
}

function summary(rows) {
  const counts = groupCount(rows, "status");
  const rowsByStatus = ["backed", "partial", "gap", "planned", "refused"].map((status) => `${status}: ${counts.get(status) ?? 0}`).join("\n");
  return `# Outcome Evidence Contract

This generated contract answers a simple product question: for each user-visible
outcome, what do we currently promise, what evidence backs it, what command
checks it, and where are the limits?

It is intentionally narrower than the full proof corpus. The rows below are
the outcomes a Helm user, platform team, or reviewer is likely to ask about
first.

## Summary

\`\`\`text
outcomes: ${rows.length}
${rowsByStatus}
\`\`\`

## Outcome Rows

| Outcome | Status | Current metric | Scope | Next action |
| --- | --- | --- | --- | --- |
${rows.map((row) => `| ${md(row.user_question)} | ${md(row.status)} | ${md(row.representative_metric)} | ${md(row.scope)} | ${md(row.next_action)} |`).join("\n")}

## Evidence And Commands

| Outcome | Evidence | Verify |
| --- | --- | --- |
${rows.map((row) => `| ${md(row.outcome_id)} | ${md(row.evidence)} | \`${row.verify_commands}\` |`).join("\n")}

## Reading Rule

Use the narrowest true status:

- \`backed\`: current evidence and scoped verifiers support the claim.
- \`partial\`: the model works for named rows, but not across the full catalog
  or every target scope.
- \`gap\`: the repo records a missing or weak area that needs work before
  stronger claims.
- \`planned\`: product or commercial direction, not current shipped behavior.
- \`refused\`: the repo deliberately refuses a broad claim.

Regenerate:

~~~sh
npm run outcomes:contract
npm run outcomes:contract:verify
~~~
`;
}

function formatMetric(row) {
  return `${row.metric} ${row.value}/${row.total} ${row.status}`;
}

function parseCsvFile(path) {
  check(existsSync(join(repoRoot, path)), `missing ${path}`);
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
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
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function toCsv(rows) {
  const headers = ["outcome_id", "user_question", "status", "claim_status", "representative_metric", "scope", "evidence", "verify_commands", "limit_or_refusal", "next_action"];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function splitList(text) {
  return String(text ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function groupCount(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return counts;
}

function csvCell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function md(value) {
  return String(value).replaceAll("|", "\\|");
}
