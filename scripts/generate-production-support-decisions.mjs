#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "production-support-decisions");
const summaryPath = join(root, "summary.md");
const csvPath = join(root, "decisions.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
  console.log("wrote production support decisions");
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "missing production support decision summary; run npm run production:support-decisions");
  check(existsSync(csvPath), "missing production support decision CSV; run npm run production:support-decisions");
  check(readFileSync(summaryPath, "utf8") === report.summary, "production support decision summary is stale");
  check(readFileSync(csvPath, "utf8") === report.csv, "production support decision CSV is stale");
  console.log(`verified ${report.rows.length} production support decision(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-production-support-decisions.mjs --generate
  node scripts/generate-production-support-decisions.mjs --verify`);
}

function buildReport() {
  const rows = decisionRows();
  return { rows, summary: summary(rows), csv: toCsv(rows) };
}

function decisionRows() {
  const supportDecisionFiles = listFiles(root)
    .filter((file) => file.endsWith("/support-decision.yaml"))
    .sort();
  return supportDecisionFiles.map((file) => decisionRow(file));
}

function decisionRow(file) {
  const decision = readYaml(file);
  check(decision.kind === "ProductionSupportDecision", `${relativeRepo(file)} must be kind ProductionSupportDecision`);
  const spec = decision.spec ?? {};
  const chart = required(spec.chart, `${relativeRepo(file)} missing spec.chart`);
  const version = required(spec.version, `${relativeRepo(file)} missing spec.version`);
  const supportedBase = required(spec.supportedBase, `${relativeRepo(file)} missing spec.supportedBase`);
  const state = required(spec.decision, `${relativeRepo(file)} missing spec.decision`);
  check(["draft", "supported", "rejected", "superseded"].includes(state), `${relativeRepo(file)} has unsupported decision ${state}`);
  check(spec.targetScope?.clusterClass, `${relativeRepo(file)} missing spec.targetScope.clusterClass`);
  check(spec.targetScope?.namespace, `${relativeRepo(file)} missing spec.targetScope.namespace`);
  check(spec.targetScope?.deliveryPath, `${relativeRepo(file)} missing spec.targetScope.deliveryPath`);
  check(spec.supportBoundary?.includes?.length > 0, `${relativeRepo(file)} missing supportBoundary.includes`);
  check(spec.supportBoundary?.excludes?.length > 0, `${relativeRepo(file)} missing supportBoundary.excludes`);
  for (const evidence of spec.evidence ?? []) {
    check(evidence.path, `${relativeRepo(file)} has evidence entry without path`);
    check(existsSync(join(repoRoot, evidence.path)), `${relativeRepo(file)} references missing evidence ${evidence.path}`);
  }
  if (state === "supported") {
    check(spec.decisions?.liveEvidenceDecision?.state === "fresh-target-evidence-passed", `${relativeRepo(file)} cannot be supported without fresh target evidence`);
    check((spec.requiredBeforeFinal ?? []).length === 0, `${relativeRepo(file)} cannot be supported with requiredBeforeFinal entries`);
  }
  return {
    chart,
    version,
    supported_base: supportedBase,
    decision: state,
    target_scope: targetScope(spec.targetScope),
    delivery_path: spec.targetScope.deliveryPath,
    image_decision: spec.decisions?.imageDecision?.state ?? "",
    scan_decision: spec.decisions?.scanDecision?.state ?? "",
    lifecycle_decision: spec.decisions?.lifecycleDecision?.state ?? "",
    target_fact_decision: spec.decisions?.targetFactDecision?.state ?? "",
    live_evidence_decision: spec.decisions?.liveEvidenceDecision?.state ?? "",
    evidence_count: String((spec.evidence ?? []).length),
    remaining_final_requirements: (spec.requiredBeforeFinal ?? []).join("; "),
    next_action: spec.nextAction ?? "",
    path: relativeRepo(file),
  };
}

function summary(rows) {
  const stateCounts = groupCount(rows, "decision");
  const supported = stateCounts.get("supported") ?? 0;
  const draft = stateCounts.get("draft") ?? 0;
  return `# Production Support Decisions

This generated report records target-scoped production support decisions. It is
separate from production disposition closure.

Disposition closure means the pre-review evidence exists. A production support
decision names the supported base, target scope, delivery path, accepted risks,
live evidence rule, and operator-owned boundaries.

## Summary

\`\`\`text
decision artifacts: ${rows.length}
supported decisions: ${supported}
draft decisions: ${draft}
\`\`\`

## Decisions

| Chart | Base | Decision | Target scope | Live evidence decision | Next action |
| --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.supported_base} | ${row.decision} | ${row.target_scope} | ${row.live_evidence_decision} | ${row.next_action} |`).join("\n")}

## Rule

A \`draft\` decision is useful because it names the proposed support boundary.
It is not a production support claim. A row can move to \`supported\` only when
fresh target-scoped evidence for the declared delivery path is recorded and the
decision no longer has \`requiredBeforeFinal\` entries.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
`;
}

function toCsv(rows) {
  const headers = [
    "chart",
    "version",
    "supported_base",
    "decision",
    "target_scope",
    "delivery_path",
    "image_decision",
    "scan_decision",
    "lifecycle_decision",
    "target_fact_decision",
    "live_evidence_decision",
    "evidence_count",
    "remaining_final_requirements",
    "next_action",
    "path",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function targetScope(scope) {
  return [
    scope.clusterClass,
    `namespace=${scope.namespace}`,
    `delivery=${scope.deliveryPath}`,
    scope.gitopsController ? `controller=${scope.gitopsController}` : "",
  ].filter(Boolean).join("; ");
}

function required(value, message) {
  check(Boolean(value), message);
  return value;
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
