#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "production-support-decisions");
const summaryPath = join(root, "summary.md");
const csvPath = join(root, "decisions.csv");
const decisionQueuePath = join(repoRoot, "data", "production-disposition", "support-decision-queue.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
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
  check(readFileSync(summaryPath, "utf8") === report.summary, "production support decision summary is stale");
  check(readFileSync(csvPath, "utf8") === report.csv, "production support decision CSV is stale");
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
  return { rows, summary: summary(rows), csv: toCsv(rows) };
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
