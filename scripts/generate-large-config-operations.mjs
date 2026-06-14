#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "large-config-operations");
const csvPath = join(outDir, "operations.csv");
const summaryPath = join(outDir, "summary.md");
const minObjectCount = 50;

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, toCsv(report.rows));
  write(summaryPath, summaryMarkdown(report.rows));
  console.log(`wrote ${relativeRepo(csvPath)} and ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), `${relativeRepo(csvPath)} is missing; run node scripts/generate-large-config-operations.mjs --generate`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run node scripts/generate-large-config-operations.mjs --generate`);
  check(readFileSync(csvPath, "utf8") === toCsv(report.rows), `${relativeRepo(csvPath)} is stale; run node scripts/generate-large-config-operations.mjs --generate`);
  check(
    readFileSync(summaryPath, "utf8") === summaryMarkdown(report.rows),
    `${relativeRepo(summaryPath)} is stale; run node scripts/generate-large-config-operations.mjs --generate`,
  );
  console.log(`verified large ConfigHub operation report for ${report.rows.length} row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-large-config-operations.mjs --generate
  node scripts/generate-large-config-operations.mjs --verify`);
}

function buildReport() {
  const receiptRoot = join(repoRoot, "runs", "live-helm-confighub-compare");
  const rows = listFiles(receiptRoot)
    .filter((path) => path.endsWith("/receipt.yaml"))
    .map(rowForReceipt)
    .filter((row) => row && Number(row.oci_object_count) >= minObjectCount)
    .sort((left, right) => `${left.chart}@${left.version}:${left.base}`.localeCompare(`${right.chart}@${right.version}:${right.base}`));
  return { rows };
}

function rowForReceipt(path) {
  const receipt = readYaml(path);
  const spec = receipt.spec ?? {};
  const oci = spec.legs?.configHubOciArgo ?? {};
  const apply = spec.legs?.configHubKubectlApply ?? {};
  const regular = spec.legs?.regularHelm ?? {};
  if (!oci.objectCount) return null;

  const argoStatus = oci.argoStatus ?? {};
  const operationState = argoStatus.operationState ?? {};
  const elapsedSeconds = elapsed(operationState.startedAt, operationState.finishedAt);
  const gitopsHealth = argoStatus.health?.status ?? oci.health ?? "";
  const gitopsSync = argoStatus.sync?.status ?? oci.sync ?? "";
  const workloadResult = oci.runtime?.result ?? "";
  const targetProfile = spec.targetProfile ?? {};
  const renderedLifecycleSecrets = oci.renderedLifecycleSecrets ?? {};
  const separatedSecrets = Array.isArray(oci.separatedSecrets) ? oci.separatedSecrets : [];
  const confighubUnitCount = unitCountFromConsulRuntime(spec);
  const stage = classifyStage({
    result: spec.result,
    regularResult: regular.result,
    applyResult: apply.result,
    ociResult: oci.result,
    gitopsSync,
    gitopsHealth,
    workloadResult,
  });
  const residue = residueFor({ receiptPath: path, spec, oci, argoStatus });
  const missingProgress = missingProgressFields({ operationState, spec });

  return {
    chart: spec.chart ?? "",
    version: spec.version ?? "",
    base: spec.base ?? "",
    result: spec.result ?? "",
    observed_at: spec.observedAt ?? "",
    receipt: relativeRepo(path),
    oci_object_count: oci.objectCount ?? "",
    confighub_unit_count: confighubUnitCount,
    controller: oci.controller ?? "",
    workload_space: oci.workloadSpace ?? "",
    regular_helm_runtime: regular.runtime?.result ?? regular.result ?? "",
    confighub_apply_runtime: apply.runtime?.result ?? apply.result ?? "",
    oci_runtime: workloadResult || oci.result || "",
    gitops_sync: gitopsSync,
    gitops_health: gitopsHealth,
    operation_phase: operationState.phase ?? "",
    operation_elapsed_seconds: elapsedSeconds ?? "",
    target_profile: targetProfile.name ?? "",
    target_profile_result: targetProfile.result ?? "",
    schedulable_nodes: targetProfile.observedSchedulableNodes ?? "",
    separated_secret_count: separatedSecrets.length,
    lifecycle_secret_count: renderedLifecycleSecrets.count ?? "",
    current_stage: stage,
    residue,
    missing_progress_fields: missingProgress.join("; "),
    next_action: nextAction({ stage, residue, missingProgress, result: spec.result, gitopsHealth }),
  };
}

function unitCountFromConsulRuntime(spec) {
  const chart = spec.chart ?? "";
  const base = spec.base ?? "";
  if (chart !== "hashicorp/consul" || base !== "secure-mesh-existing-secrets") return "";
  const runtimePath = join(repoRoot, "data", "runtime-gitops", "receipts", "hashicorp-consul", base, "latest.yaml");
  if (!existsSync(runtimePath)) return "";
  const runtime = readYaml(runtimePath);
  return runtime.spec?.confighub?.unitCount ?? "";
}

function classifyStage({ result, regularResult, applyResult, ociResult, gitopsSync, gitopsHealth, workloadResult }) {
  if (regularResult !== "pass") return "regular-helm-runtime";
  if (applyResult !== "pass") return "confighub-direct-apply";
  if (!gitopsSync) return "oci-gitops-source";
  if (gitopsSync !== "Synced") return "gitops-sync";
  if (workloadResult && workloadResult !== "pass") return "workload-convergence";
  if (ociResult === "blocked") return "target-or-lifecycle-prerequisite";
  if (result === "watch" || gitopsHealth !== "Healthy") return "controller-health-watch";
  return "complete";
}

function residueFor({ receiptPath, spec, oci, argoStatus }) {
  const health = argoStatus.health?.status ?? oci.health ?? "";
  if (health && health !== "Healthy") {
    const resources = resourcesWithHealth(receiptPath, argoStatus);
    const residueResources = resources
      .filter((resource) => resourceHealth(resource) && !["Healthy", "Suspended"].includes(resourceHealth(resource)))
      .map((resource) => {
        const namespace = resource.namespace ? `${resource.namespace}/` : "";
        return `${resource.kind}/${namespace}${resource.name}:${resource.status ?? "blank"}/${resourceHealth(resource)}`;
      })
      .sort();
    return residueResources.join("; ") || `gitops-health:${health}`;
  }
  const checks = Array.isArray(spec.checks) ? spec.checks : [];
  const failedChecks = checks.filter((checkItem) => !["pass", "recorded", "not-needed"].includes(checkItem.result ?? ""));
  if (failedChecks.length > 0) return failedChecks.map((checkItem) => `${checkItem.name}:${checkItem.result}`).join("; ");
  return "";
}

function resourcesWithHealth(receiptPath, argoStatus) {
  const inlineResources = Array.isArray(argoStatus.resources) ? argoStatus.resources : [];
  if (inlineResources.some(resourceHealth)) return inlineResources;
  const artifact = argoStatus.diagnostics?.argocdCore?.json?.artifact?.path;
  if (!artifact) return inlineResources;
  const artifactPath = join(dirname(receiptPath), artifact);
  if (!existsSync(artifactPath)) return inlineResources;
  try {
    const parsed = JSON.parse(readFileSync(artifactPath, "utf8"));
    return Array.isArray(parsed.status?.resources) ? parsed.status.resources : inlineResources;
  } catch {
    return inlineResources;
  }
}

function resourceHealth(resource) {
  if (!resource) return "";
  if (typeof resource.health === "string") return resource.health;
  if (resource.health && typeof resource.health === "object") return resource.health.status ?? "";
  return "";
}

function missingProgressFields({ operationState, spec }) {
  const missing = [];
  if (!operationState.startedAt || !operationState.finishedAt) missing.push("gitops-operation-elapsed");
  if (!hasElapsedCheck(spec, "confighub-upload")) missing.push("confighub-upload-elapsed");
  if (!hasElapsedCheck(spec, "direct-apply") && !hasElapsedCheck(spec, "kubectl-apply")) missing.push("direct-apply-elapsed");
  if (mentionsUnitApply(spec) && !hasElapsedCheck(spec, "unit apply")) missing.push("unit-apply-wait-elapsed");
  return missing;
}

function hasElapsedCheck(spec, needle) {
  const checks = Array.isArray(spec.checks) ? spec.checks : [];
  return checks.some((checkItem) => `${checkItem.name ?? ""} ${checkItem.detail ?? ""}`.toLowerCase().includes(needle) && /\b\d+(\.\d+)?s\b/.test(`${checkItem.detail ?? ""}`));
}

function mentionsUnitApply(spec) {
  return JSON.stringify(spec).toLowerCase().includes("cub unit apply");
}

function elapsed(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) return null;
  return Math.round((finish - start) / 1000);
}

function nextAction({ stage, residue, missingProgress, result, gitopsHealth }) {
  if (stage === "complete" && missingProgress.length === 0) return "Keep the evidence fresh before using as a large-operation example.";
  if (stage === "complete") return "Add upload/apply elapsed-time evidence in the next live run so this pass also proves progress visibility.";
  if (stage === "controller-health-watch") {
    const residueText = residue ? ` (${residue})` : "";
    return `Keep as watch until the controller-health residue is explained or accepted for the target scope${residueText}; add upload/apply elapsed-time evidence on rerun.`;
  }
  if (result === "watch" || gitopsHealth === "Progressing") return "Preserve the row as watch, name the first non-green stage, and rerun only after the target/controller policy is explicit.";
  return "Resolve the named non-pass stage, then rerun with upload/apply elapsed-time capture.";
}

function summaryMarkdown(rows) {
  const counts = countBy(rows, "current_stage");
  const observedDates = rows.map((row) => row.observed_at).filter(Boolean).sort();
  const latestObserved = observedDates.at(-1) ?? "unknown";
  return `# Large ConfigHub Operations

Generated from committed live Helm-vs-ConfigHub receipts. This report shows
large ConfigHub operations as a funnel, so a 100+ Unit upload/apply/GitOps path
does not collapse into a vague wait.

This is evidence about current receipts, not a claim that the CLI already emits
perfect progress streams. Rows with missing upload/apply timing keep that product
gap visible. Current live parity receipts mostly exercise direct apply and
OCI/GitOps; a separate \`cub unit apply --wait\` receipt should be added when
that path is the operation under review.

\`\`\`text
large rows: ${rows.length}
minimum ConfigHub OCI objects: ${minObjectCount}
latest observed receipt: ${latestObserved}
${Object.entries(counts)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}
\`\`\`

## Rows

| Chart | Base | Result | OCI objects | Units | Stage | GitOps | Workload | Target profile | Residue | Missing progress | Receipt | Next action |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | \`${row.base}\` | ${row.result} | ${row.oci_object_count} | ${row.confighub_unit_count || ""} | ${row.current_stage} | ${row.gitops_sync}/${row.gitops_health} | ${row.oci_runtime} | ${targetProfile(row)} | ${md(row.residue || "")} | ${md(row.missing_progress_fields || "")} | [receipt](../../${row.receipt}) | ${md(row.next_action)} |`).join("\n")}

## Reading Rule

Read these rows stage by stage:

1. regular Helm runtime;
2. ConfigHub direct apply;
3. ConfigHub OCI/GitOps sync;
4. target facts and lifecycle prerequisites;
5. workload convergence;
6. controller aggregate health;
7. upload/apply progress evidence.

A row can prove render/runtime parity and still remain \`watch\` if controller
aggregate health has a named residue. A row can pass and still need better
progress evidence if upload/apply elapsed time is not recorded.

The machine-readable table is [operations.csv](./operations.csv).
`;
}

function targetProfile(row) {
  const parts = [];
  if (row.target_profile) parts.push(row.target_profile);
  if (row.schedulable_nodes) parts.push(`${row.schedulable_nodes} nodes`);
  if (row.target_profile_result) parts.push(row.target_profile_result);
  return md(parts.join("; "));
}

function countBy(rows, key) {
  const result = {};
  for (const row of rows) {
    const value = row[key] || "blank";
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function md(value) {
  return String(value || "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function toCsv(rows) {
  const headers = [
    "chart",
    "version",
    "base",
    "result",
    "observed_at",
    "receipt",
    "oci_object_count",
    "confighub_unit_count",
    "controller",
    "workload_space",
    "regular_helm_runtime",
    "confighub_apply_runtime",
    "oci_runtime",
    "gitops_sync",
    "gitops_health",
    "operation_phase",
    "operation_elapsed_seconds",
    "target_profile",
    "target_profile_result",
    "schedulable_nodes",
    "separated_secret_count",
    "lifecycle_secret_count",
    "current_stage",
    "residue",
    "missing_progress_fields",
    "next_action",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csv(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csv(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
