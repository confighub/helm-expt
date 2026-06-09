#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "production-support-decisions");
const summaryPath = join(root, "summary.md");
const csvPath = join(root, "decisions.csv");
const workItemsPath = join(root, "work-items.csv");
const decisionQueuePath = join(repoRoot, "data", "production-disposition", "support-decision-queue.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
  write(workItemsPath, report.workItemsCsv);
  for (const readme of report.readmes) write(join(repoRoot, readme.path), readme.contents);
  console.log("wrote production support decisions");
} else if (mode === "--scaffold") {
  const rows = readDecisionQueue();
  let wrote = 0;
  for (const row of rows) {
    const target = join(repoRoot, row.proposedDecisionArtifact);
    if (existsSync(target)) continue;
    write(target, decisionYaml(row));
    wrote += 1;
  }
  console.log(`scaffolded ${wrote} production support decision draft(s)`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "missing production support decision summary; run npm run production:support-decisions");
  check(existsSync(csvPath), "missing production support decision CSV; run npm run production:support-decisions");
  check(existsSync(workItemsPath), "missing production support work item CSV; run npm run production:support-decisions");
  check(readFileSync(summaryPath, "utf8") === report.summary, "production support decision summary is stale");
  check(readFileSync(csvPath, "utf8") === report.csv, "production support decision CSV is stale");
  check(readFileSync(workItemsPath, "utf8") === report.workItemsCsv, "production support work item CSV is stale");
  for (const readme of report.readmes) {
    check(existsSync(join(repoRoot, readme.path)), `missing production support workdown ${readme.path}; run npm run production:support-decisions`);
    check(readFileSync(join(repoRoot, readme.path), "utf8") === readme.contents, `production support workdown ${readme.path} is stale`);
  }
  console.log(`verified ${report.rows.length} production support decision(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-production-support-decisions.mjs --generate
  node scripts/generate-production-support-decisions.mjs --scaffold
  node scripts/generate-production-support-decisions.mjs --verify`);
}

function buildReport() {
  const expected = expectedDecisionMap();
  const rows = decisionRows(expected);
  const workItems = workItemRows(rows);
  const readmes = decisionReadmes(rows);
  return { rows, workItems, readmes, summary: summary(rows, workItems), csv: toCsv(rows), workItemsCsv: workItemsToCsv(workItems) };
}

function decisionRows(expected) {
  const supportDecisionFiles = listFiles(root)
    .filter((file) => file.endsWith("/support-decision.yaml"))
    .sort();
  for (const [path] of expected) {
    check(existsSync(join(repoRoot, path)), `missing production support decision artifact ${path}; run node scripts/generate-production-support-decisions.mjs --scaffold`);
  }
  return supportDecisionFiles.map((file) => decisionRow(file, expected));
}

function decisionRow(file, expected) {
  const decision = readYaml(file);
  const relativePath = relativeRepo(file);
  const expectedRow = expected.get(relativePath);
  check(expectedRow, `${relativePath} is not referenced by data/production-disposition/support-decision-queue.csv`);
  check(decision.kind === "ProductionSupportDecision", `${relativeRepo(file)} must be kind ProductionSupportDecision`);
  const spec = decision.spec ?? {};
  const chart = required(spec.chart, `${relativeRepo(file)} missing spec.chart`);
  const version = required(spec.version, `${relativeRepo(file)} missing spec.version`);
  const supportedBase = required(spec.supportedBase, `${relativeRepo(file)} missing spec.supportedBase`);
  check(chart === expectedRow.chart, `${relativePath} chart ${chart} does not match queue chart ${expectedRow.chart}`);
  check(version === expectedRow.version, `${relativePath} version ${version} does not match queue version ${expectedRow.version}`);
  check(supportedBase === expectedRow.candidateBase, `${relativePath} base ${supportedBase} does not match queue base ${expectedRow.candidateBase}`);
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
    required_before_final: spec.requiredBeforeFinal ?? [],
    support_includes: spec.supportBoundary?.includes ?? [],
    support_excludes: spec.supportBoundary?.excludes ?? [],
    evidence: spec.evidence ?? [],
    next_action: spec.nextAction ?? "",
    path: relativeRepo(file),
    workdown_path: relativePath.replace(/support-decision\.yaml$/, "README.md"),
  };
}

function summary(rows, workItems) {
  const stateCounts = groupCount(rows, "decision");
  const supported = stateCounts.get("supported") ?? 0;
  const draft = stateCounts.get("draft") ?? 0;
  const workstreams = supportWorkstreams(rows);
  const priorityRows = prioritySupportRows(rows);
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
open work items: ${workItems.filter((row) => row.priority !== "keep-fresh").length}
\`\`\`

## Workstreams

Workstreams can overlap. One chart can need image, scan, lifecycle, and fresh
evidence work before it becomes production-supported for a target scope.

| Workstream | Charts | Examples | Next action |
| --- | ---: | --- | --- |
${workstreams.map((row) => `| ${row.name} | ${row.rows.length} | ${previewRows(row.rows)} | ${row.nextAction} |`).join("\n")}

## Priority Rows

These rows have the most remaining production-support decisions. The table does
not replace the per-chart decision artifact; it shows where review effort is
currently concentrated.

| Chart | Base | Open work | Next action |
| --- | --- | --- | --- |
${priorityRows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.supported_base} | ${openWork(row).join("; ")} | ${row.next_action} |`).join("\n")}

The spreadsheet form is [work-items.csv](./work-items.csv). It has one row per
production-support task or keep-fresh item, so overlapping work such as image,
scan, lifecycle, runtime, and fresh evidence can be assigned independently.

Each decision directory also has a generated workdown page:

| Chart | Workdown |
| --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | [${row.supported_base}](${row.workdown_path.replace(/^data\/production-support-decisions\//, "./")}) |`).join("\n")}

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

function decisionReadmes(rows) {
  return rows.map((row) => ({ path: row.workdown_path, contents: decisionReadme(row) }));
}

function decisionReadme(row) {
  return `# ${row.chart}@${row.version} Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | \`${row.chart}@${row.version}\` |
| Candidate base | \`${row.supported_base}\` |
| Decision state | \`${row.decision}\` |
| Target scope | ${row.target_scope} |
| Delivery path | \`${row.delivery_path}\` |

## Open Work

${openWorkMarkdown(row)}

## Closeout Sequence

${closeoutSequenceMarkdown(row)}

## Required Before Final Support

${listOrDash(row.required_before_final)}

## Support Boundary

Included:

${listOrDash(row.support_includes)}

Excluded:

${listOrDash(row.support_excludes)}

## Evidence

${evidenceMarkdown(row.evidence)}

## Next Action

${row.next_action}

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
`;
}

function openWorkMarkdown(row) {
  const items = [];
  if (row.image_decision === "needs-image-digest-resolution-or-exception") {
    items.push(["Image digest", "Pin rendered image references by digest or record an explicit mutable-image exception."]);
  }
  if (row.scan_decision === "needs-scan-scope-decision") {
    items.push(["Scan scope", "Record which scanner findings are accepted, fixed, or outside this target scope."]);
  }
  if (row.scan_decision === "needs-security-acceptance-or-hardened-base") {
    items.push(["Security posture", "Accept current findings for this infrastructure scope or create a narrower hardened base."]);
  }
  if (["needs-lifecycle-support-boundary", "route-selected-observation-needed"].includes(row.lifecycle_decision)) {
    items.push(["Lifecycle", "Record the lifecycle boundary, or execute and observe the selected hook/lifecycle route."]);
  }
  if (row.target_fact_decision === "needs-target-prerequisite-scope") {
    items.push(["Target prerequisites", "Decide which target facts or prerequisites are inside this support scope."]);
  }
  if (row.live_evidence_decision === "needs-runtime-decision-before-final") {
    items.push(["Runtime decision", "Decide whether the runtime condition is supported before refreshing live evidence."]);
  }
  if (row.live_evidence_decision === "needs-missing-live-or-confighub-lanes-before-final") {
    items.push(["Missing proof lane", "Complete the missing ConfigHub, GitOps, or live lane before final support."]);
  }
  if (row.live_evidence_decision === "needs-lifecycle-observation-before-final") {
    items.push(["Lifecycle observation", "Bind lifecycle observation evidence to this target scope before final support."]);
  }
  if (row.live_evidence_decision === "needs-fresh-target-evidence-before-final") {
    items.push(["Fresh evidence", "Refresh ConfigHub OCI/GitOps and live/e2e evidence after earlier decisions are closed."]);
  }
  if (items.length === 0 && row.decision === "supported") {
    items.push(["Keep fresh", "Keep target-scoped evidence fresh before using this supported scope as an example."]);
  }
  if (items.length === 0) return "- No open generated work item for this decision.\n";
  return `| Work | Action |\n| --- | --- |\n${items.map(([work, action]) => `| ${work} | ${action} |`).join("\n")}\n`;
}

function closeoutSequenceMarkdown(row) {
  const steps = closeoutSteps(row);
  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function closeoutSteps(row) {
  if (row.decision === "supported") {
    return ["Keep the target-scoped evidence fresh for the declared support boundary."];
  }
  const steps = ["Choose the final target scope, GitOps controller, namespace, and artifact digest."];
  if (row.image_decision === "needs-image-digest-resolution-or-exception") {
    steps.push("Pin rendered image references by digest or record an explicit mutable-image exception.");
  }
  if (row.scan_decision === "needs-scan-scope-decision") {
    steps.push("Decide which scanner findings are accepted, fixed, hardened, or outside this target scope.");
  }
  if (row.scan_decision === "needs-security-acceptance-or-hardened-base") {
    steps.push("Accept current security findings for this infrastructure scope or create a narrower hardened base.");
  }
  if (row.lifecycle_decision === "needs-lifecycle-support-boundary") {
    steps.push("Record the lifecycle boundary, including hook, webhook, CRD, cleanup, ordering, and upgrade behavior.");
  }
  if (row.lifecycle_decision === "route-selected-observation-needed") {
    steps.push("Execute or observe the selected lifecycle route and bind the receipt to this target scope.");
  }
  if (row.target_fact_decision === "needs-target-prerequisite-scope") {
    steps.push("State the required target facts or prerequisites that must exist before delivery.");
  }
  if (row.live_evidence_decision === "needs-runtime-decision-before-final") {
    steps.push("Decide whether the runtime condition is supported, excluded, or operator-owned.");
  }
  if (row.live_evidence_decision === "needs-missing-live-or-confighub-lanes-before-final") {
    steps.push("Complete the missing ConfigHub, GitOps, or live lane for the selected support boundary.");
  }
  if (row.live_evidence_decision === "needs-lifecycle-observation-before-final") {
    steps.push("Bind lifecycle observation evidence to this target scope.");
  }
  if (row.live_evidence_decision === "needs-fresh-target-evidence-before-final") {
    steps.push("Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence after the earlier decisions are closed.");
  }
  return [...new Set(steps)];
}

function evidenceMarkdown(evidence) {
  if (!evidence.length) return "- No evidence entries recorded.\n";
  return evidence.map((entry) => `- [${entry.path}](../../../${entry.path}) - ${entry.claim}`).join("\n");
}

function listOrDash(items) {
  if (!items?.length) return "- None.\n";
  return items.map((item) => `- ${item}`).join("\n");
}

function supportWorkstreams(rows) {
  return [
    {
      name: "Supported scope evidence",
      rows: rows.filter((row) => row.decision === "supported"),
      nextAction: "Keep target-scoped evidence fresh before using the supported scope as a production example.",
    },
    {
      name: "Image digest resolution or exception",
      rows: rows.filter((row) => row.image_decision === "needs-image-digest-resolution-or-exception"),
      nextAction: "Pin images by digest or record an explicit exception before production OCI support.",
    },
    {
      name: "Scan scope decision",
      rows: rows.filter((row) => row.scan_decision === "needs-scan-scope-decision"),
      nextAction: "Record which scanner findings are accepted, fixed, or outside the supported target scope.",
    },
    {
      name: "Security acceptance or hardened base",
      rows: rows.filter((row) => row.scan_decision === "needs-security-acceptance-or-hardened-base"),
      nextAction: "Accept current security findings for the target scope or create a narrower hardened base.",
    },
    {
      name: "Lifecycle decision or observation",
      rows: rows.filter((row) => ["needs-lifecycle-support-boundary", "route-selected-observation-needed"].includes(row.lifecycle_decision)),
      nextAction: "Record the lifecycle boundary, or execute and observe the selected hook/lifecycle route.",
    },
    {
      name: "Runtime or missing-lane decision",
      rows: rows.filter((row) => ["needs-runtime-decision-before-final", "needs-missing-live-or-confighub-lanes-before-final", "needs-lifecycle-observation-before-final"].includes(row.live_evidence_decision)),
      nextAction: "Close the runtime, missing-lane, or lifecycle-observation decision before refreshing final evidence.",
    },
    {
      name: "Fresh target-scoped evidence",
      rows: rows.filter((row) => row.live_evidence_decision === "needs-fresh-target-evidence-before-final"),
      nextAction: "After scope and risk decisions are closed, refresh ConfigHub OCI/GitOps and live/e2e evidence for that exact scope.",
    },
  ].filter((row) => row.rows.length > 0);
}

function prioritySupportRows(rows) {
  return rows
    .filter((row) => row.decision !== "supported")
    .map((row) => ({ ...row, openWorkCount: openWork(row).length }))
    .filter((row) => row.openWorkCount > 0)
    .sort((left, right) => right.openWorkCount - left.openWorkCount || left.chart.localeCompare(right.chart))
    .slice(0, 8);
}

function openWork(row) {
  const work = [];
  if (row.image_decision === "needs-image-digest-resolution-or-exception") work.push("image");
  if (row.scan_decision === "needs-scan-scope-decision") work.push("scan scope");
  if (row.scan_decision === "needs-security-acceptance-or-hardened-base") work.push("security/hardened base");
  if (["needs-lifecycle-support-boundary", "route-selected-observation-needed"].includes(row.lifecycle_decision)) work.push("lifecycle");
  if (row.live_evidence_decision === "needs-runtime-decision-before-final") work.push("runtime decision");
  if (row.live_evidence_decision === "needs-missing-live-or-confighub-lanes-before-final") work.push("missing proof lane");
  if (row.live_evidence_decision === "needs-lifecycle-observation-before-final") work.push("lifecycle observation");
  if (row.live_evidence_decision === "needs-fresh-target-evidence-before-final") work.push("fresh evidence");
  return work;
}

function previewRows(rows) {
  if (rows.length === 0) return "-";
  const values = rows.slice(0, 4).map((row) => `\`${row.chart}@${row.version}\` (${row.supported_base})`);
  const remaining = rows.length - values.length;
  if (remaining > 0) values.push(`and ${remaining} more`);
  return values.join("<br>");
}

function workItemRows(rows) {
  return rows.flatMap((row) => {
    const items = [];
    if (row.decision === "supported") {
      items.push(workItem(row, "supported-scope-evidence", "decision", row.decision, "keep-fresh", "Keep target-scoped evidence fresh before using this supported scope as an example."));
      return items;
    }
    if (row.image_decision === "needs-image-digest-resolution-or-exception") {
      items.push(workItem(row, "image-digest-resolution", "image_decision", row.image_decision, "before-final", "Pin images by digest or record an explicit mutable-image exception for the supported scope."));
    }
    if (row.scan_decision === "needs-scan-scope-decision") {
      items.push(workItem(row, "scan-scope-decision", "scan_decision", row.scan_decision, "before-final", "Record which scanner findings are accepted, fixed, or outside the supported target scope."));
    }
    if (row.scan_decision === "needs-security-acceptance-or-hardened-base") {
      items.push(workItem(row, "security-acceptance-or-hardened-base", "scan_decision", row.scan_decision, "before-final", "Accept current security findings for the target scope or create a narrower hardened base."));
    }
    if (["needs-lifecycle-support-boundary", "route-selected-observation-needed"].includes(row.lifecycle_decision)) {
      items.push(workItem(row, "lifecycle-decision-or-observation", "lifecycle_decision", row.lifecycle_decision, "before-final", "Record the lifecycle boundary, or execute and observe the selected hook/lifecycle route."));
    }
    if (row.live_evidence_decision === "needs-runtime-decision-before-final") {
      items.push(workItem(row, "runtime-decision", "live_evidence_decision", row.live_evidence_decision, "before-final", "Decide whether the runtime condition is in the supported scope before refreshing live evidence."));
    }
    if (row.live_evidence_decision === "needs-missing-live-or-confighub-lanes-before-final") {
      items.push(workItem(row, "missing-proof-lane", "live_evidence_decision", row.live_evidence_decision, "before-final", "Complete the missing ConfigHub, GitOps, or live lane before final support."));
    }
    if (row.live_evidence_decision === "needs-lifecycle-observation-before-final") {
      items.push(workItem(row, "lifecycle-observation", "live_evidence_decision", row.live_evidence_decision, "before-final", "Bind lifecycle observation evidence to the supported target scope before final support."));
    }
    if (row.live_evidence_decision === "needs-fresh-target-evidence-before-final") {
      items.push(workItem(row, "fresh-target-scoped-evidence", "live_evidence_decision", row.live_evidence_decision, "after-decisions", "Refresh ConfigHub OCI/GitOps and live/e2e evidence after the other decisions are closed."));
    }
    return items;
  });
}

function workItem(row, workType, statusField, status, priority, nextAction) {
  return {
    chart: row.chart,
    version: row.version,
    supported_base: row.supported_base,
    decision: row.decision,
    work_type: workType,
    status_field: statusField,
    status,
    priority,
    target_scope: row.target_scope,
    next_action: nextAction,
    source_decision: row.path,
  };
}

function workItemsToCsv(rows) {
  const headers = [
    "chart",
    "version",
    "supported_base",
    "decision",
    "work_type",
    "status_field",
    "status",
    "priority",
    "target_scope",
    "next_action",
    "source_decision",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
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

function expectedDecisionMap() {
  const rows = readDecisionQueue();
  const expected = new Map();
  for (const row of rows) {
    check(row.proposedDecisionArtifact, "support decision queue row missing proposedDecisionArtifact");
    expected.set(row.proposedDecisionArtifact, row);
  }
  return expected;
}

function readDecisionQueue() {
  check(existsSync(decisionQueuePath), "missing data/production-disposition/support-decision-queue.csv");
  return parseCsv(readFileSync(decisionQueuePath, "utf8"));
}

function decisionYaml(row) {
  const chartSlug = slug(row.chart);
  const namespace = row.chart.split("/").at(-1).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const evidence = evidenceFor(row);
  const requiredBeforeFinal = finalRequirements(row);
  return `${[
    "apiVersion: helm-expt.confighub.com/v1alpha1",
    "kind: ProductionSupportDecision",
    "metadata:",
    `  name: ${yaml(`${chartSlug}-${row.candidateBase}-public-oci-draft`)}`,
    "spec:",
    `  chart: ${yaml(row.chart)}`,
    `  version: ${yaml(row.version)}`,
    "  decision: draft",
    `  decisionDate: ${yaml("2026-06-09")}`,
    `  supportedBase: ${yaml(row.candidateBase)}`,
    "  targetScope:",
    "    clusterClass: vanilla-kubernetes",
    `    namespace: ${yaml(namespace)}`,
    "    deliveryPath: confighub-oci",
    "    gitopsController: argo-or-flux",
    "    storageAssumptions:",
    `      - ${yaml("Use the chart's recorded storage behavior for the candidate base unless this draft is narrowed before final support.")}`,
    "    networkAssumptions:",
    `      - ${yaml("Use the service, ingress, DNS, and certificate behavior recorded by the candidate base unless this draft is narrowed before final support.")}`,
    "    requiredTargetFacts: []",
    "  supportBoundary:",
    "    includes:",
    `      - ${yaml(`${row.chart}@${row.version} ${row.candidateBase} base`)}`,
    "      - ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded",
    "      - rendered objects, labels, gates, receipts, and support objects produced by the recorded base",
    "    excludes:",
    ...excludedBases(row).map((item) => `      - ${yaml(item)}`),
    `      - ${yaml("private values overlays, wrapper charts, and populated extension slots unless separately reviewed")}`,
    `      - ${yaml("non-vanilla Kubernetes distributions unless separately reviewed")}`,
    `      - ${yaml("other delivery controllers or target scopes unless separately reviewed")}`,
    "  decisions:",
    "    imageDecision:",
    `      state: ${yaml(imageDecisionState(row))}`,
    `      detail: ${yaml(row.imageRequirement)}`,
    "    scanDecision:",
    `      state: ${yaml(scanDecisionState(row))}`,
    `      detail: ${yaml(row.scanRequirement)}`,
    "    lifecycleDecision:",
    `      state: ${yaml(lifecycleDecisionState(row))}`,
    `      detail: ${yaml(row.lifecycleRequirement)}`,
    "    targetFactDecision:",
    `      state: ${yaml(targetFactDecisionState(row))}`,
    `      detail: ${yaml(row.prerequisiteRequirement)}`,
    "    liveEvidenceDecision:",
    `      state: ${yaml(liveEvidenceDecisionState(row))}`,
    `      detail: ${yaml(row.liveEvidenceRequired)}`,
    "  evidence:",
    ...evidence.map((entry) => `    - path: ${yaml(entry.path)}\n      claim: ${yaml(entry.claim)}`),
    "  requiredBeforeFinal:",
    ...requiredBeforeFinal.map((item) => `    - ${yaml(item)}`),
    `  nextAction: ${yaml(row.nextAction)}`,
    "",
  ].join("\n")}`;
}

function evidenceFor(row) {
  const entries = [];
  const chartPath = `${row.chart}/${row.version}`;
  const base = row.candidateBase;
  const chartSlug = slug(row.chart);
  addIfExists(entries, `recipes/${chartPath}/revisions/${base}/r001/receipts/helm-equivalence-receipt.yaml`, "The candidate base is Helm-equivalent under recorded inputs.");
  addIfExists(entries, `recipes/${chartPath}/revisions/${base}/r001/receipts/scan-receipt.yaml`, "The rendered-object scan receipt exists for the candidate base.");
  addIfExists(entries, `runs/live-kind-parity/${chartSlug}-${base}/receipt.yaml`, "The two-cluster Helm-vs-installer parity receipt exists for the candidate base.");
  addIfExists(entries, `runs/live-helm-confighub-compare/${chartSlug}-${base}/receipt.yaml`, "The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.");
  addIfExists(entries, `data/runtime-gitops/receipts/${chartSlug}/${base}/latest.yaml`, "The runtime/GitOps receipt exists for the candidate base and should be refreshed for the declared target before final support.");

  const dispositionRoot = join(repoRoot, "data", "production-disposition", "receipts", chartSlug);
  if (existsSync(dispositionRoot)) {
    for (const name of readdirSync(dispositionRoot).filter((item) => item.endsWith(".yaml")).sort()) {
      addIfExists(entries, `data/production-disposition/receipts/${chartSlug}/${name}`, `The ${name.replace(/\.yaml$/, "").replaceAll("-", " ")} disposition exists for this chart.`);
    }
  }
  return entries;
}

function addIfExists(entries, path, claim) {
  if (existsSync(join(repoRoot, path))) entries.push({ path, claim });
}

function finalRequirements(row) {
  const requirements = [
    "Choose the final target scope, exact GitOps controller, namespace, and artifact digest.",
    "Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.",
  ];
  if (!row.imageRequirement.startsWith("no open image-digest gap")) requirements.push(row.imageRequirement);
  if (row.decisionFocus === "security-acceptance-or-hardened-base") requirements.push(row.scanRequirement);
  if (row.decisionFocus === "lifecycle-support-scope") requirements.push(row.lifecycleRequirement);
  if (row.decisionFocus === "runtime-or-prerequisite-scope") requirements.push(row.nextAction);
  return [...new Set(requirements.filter(Boolean))];
}

function excludedBases(row) {
  return (row.supportedVariants ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && item !== row.candidateBase)
    .map((item) => `${item} base`);
}

function imageDecisionState(row) {
  return row.imageRequirement.startsWith("no open image-digest gap")
    ? "no-open-image-digest-gap"
    : "needs-image-digest-resolution-or-exception";
}

function scanDecisionState(row) {
  if (row.decisionFocus === "security-acceptance-or-hardened-base") return "needs-security-acceptance-or-hardened-base";
  return "needs-scan-scope-decision";
}

function lifecycleDecisionState(row) {
  if (row.lifecycleRequirement.startsWith("no lifecycle-specific")) return "no-lifecycle-specific-decision";
  if (row.lifecycleRequirement.includes("no-hooks")) return "no-chart-hooks";
  return "needs-lifecycle-support-boundary";
}

function targetFactDecisionState(row) {
  return row.prerequisiteRequirement.startsWith("no unresolved")
    ? "no-unresolved-target-prerequisite-in-candidate-base"
    : "needs-target-prerequisite-scope";
}

function liveEvidenceDecisionState(row) {
  if (row.liveEvidenceRequired.startsWith("complete missing")) return "needs-missing-live-or-confighub-lanes-before-final";
  if (row.liveEvidenceRequired.startsWith("resolve or accept runtime")) return "needs-runtime-decision-before-final";
  if (row.liveEvidenceRequired.startsWith("attach lifecycle")) return "needs-lifecycle-observation-before-final";
  return "needs-fresh-target-evidence-before-final";
}

function slug(value) {
  return value.replaceAll("/", "-");
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

function yaml(value) {
  return JSON.stringify(String(value));
}

function csvCell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
