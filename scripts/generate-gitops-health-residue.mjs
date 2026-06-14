#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "gitops-health-residue");
const csvPath = join(outDir, "residue.csv");
const summaryPath = join(outDir, "summary.md");

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, toCsv(report.rows));
  write(summaryPath, summaryMarkdown(report.rows));
  console.log(`wrote ${relativeRepo(csvPath)} and ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), `${relativeRepo(csvPath)} is missing; run npm run gitops:health-residue`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run gitops:health-residue`);
  check(readFileSync(csvPath, "utf8") === toCsv(report.rows), `${relativeRepo(csvPath)} is stale; run npm run gitops:health-residue`);
  check(
    readFileSync(summaryPath, "utf8") === summaryMarkdown(report.rows),
    `${relativeRepo(summaryPath)} is stale; run npm run gitops:health-residue`,
  );
  console.log(`verified GitOps health residue report for ${report.rows.length} row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-gitops-health-residue.mjs --generate
  node scripts/generate-gitops-health-residue.mjs --verify`);
}

function buildReport() {
  const receiptRoot = join(repoRoot, "runs", "live-helm-confighub-compare");
  const rows = listFiles(receiptRoot)
    .filter((path) => path.endsWith("/receipt.yaml"))
    .map((path) => receiptRow(path))
    .filter(Boolean)
    .sort((left, right) => `${left.chart}@${left.version}:${left.base}`.localeCompare(`${right.chart}@${right.version}:${right.base}`));
  return { rows };
}

function receiptRow(path) {
  const receipt = readYaml(path);
  const spec = receipt.spec ?? {};
  const leg = spec.legs?.configHubOciArgo;
  if (!leg) return null;

  const appStatus = leg.argoStatus ?? {};
  const rootStatus = leg.rootArgoStatus ?? {};
  const argocdCore = appStatus.diagnostics?.argocdCore ?? {};
  const rootArgocdCore = rootStatus.diagnostics?.argocdCore ?? {};
  const receiptDir = dirname(path);
  const argocdCoreJson = readArgocdCoreJson(receiptDir, argocdCore.json?.artifact);
  const argocdCoreArtifact = artifactRef(receiptDir, argocdCore.json?.artifact);
  const argocdCoreTreeArtifact = artifactRef(receiptDir, argocdCore.tree?.artifact);
  const sync = appStatus.sync?.status ?? leg.sync ?? "";
  const health = appStatus.health?.status ?? leg.health ?? "";
  const rootSync = rootStatus.sync?.status ?? "";
  const rootHealth = rootStatus.health?.status ?? "";
  const operationPhase = appStatus.operationState?.phase ?? "";
  const syncResultStatusCounts = appStatus.operationState?.syncResultStatusCounts ?? {};
  const resources = Array.isArray(argocdCoreJson?.status?.resources)
    ? normalizeArgoResources(argocdCoreJson.status.resources)
    : Array.isArray(appStatus.resources)
    ? appStatus.resources
    : [];
  const conditions = Array.isArray(appStatus.conditions) ? appStatus.conditions : [];
  const resourceHealthCounts = countBy(resources, (resource) => resource.health || "blank");
  const resourceStatusCounts = countBy(resources, (resource) => resource.status || "blank");
  const unhealthyResources = resources.filter((resource) => resource.health && !["Healthy", "Suspended"].includes(resource.health));
  const unsyncedResources = resources.filter((resource) => resource.status && resource.status !== "Synced");
  const residueResources = [
    ...new Set([...unhealthyResources, ...unsyncedResources].map((resource) => resourceIdentity(resource))),
  ].sort();
  const healthResidueCount = unhealthyResources.length + unsyncedResources.length + conditions.length;
  const result = leg.result ?? spec.result ?? "";

  if (result === "pass" && health === "Healthy" && sync === "Synced" && healthResidueCount === 0) return null;

  const classification = classify({ result, sync, health, operationPhase, resources, healthResidueCount, resourceHealthCounts });
  const allSyncResultResourcesSynced =
    Object.keys(syncResultStatusCounts).length === 1 && Number(syncResultStatusCounts.Synced ?? 0) > 0;
  return {
    chart: spec.chart ?? "",
    version: spec.version ?? "",
    base: spec.base ?? "",
    result,
    classification,
    observed_at: spec.observedAt ?? "",
    receipt: relativeRepo(path),
    app_sync: sync,
    app_health: health,
    root_app_sync: rootSync,
    root_app_health: rootHealth,
    operation_phase: operationPhase,
    argocd_core_result: argocdCore.result ?? "",
    argocd_core_tree_result: argocdCore.tree?.result ?? "",
    argocd_core_json_artifact: argocdCoreArtifact,
    argocd_core_tree_artifact: argocdCoreTreeArtifact,
    root_argocd_core_result: rootArgocdCore.result ?? "",
    conditions: conditions.length,
    resource_count: resources.length,
    resource_synced: resourceStatusCounts.Synced ?? 0,
    resource_unsynced: resources.length - (resourceStatusCounts.Synced ?? 0),
    resource_health_healthy: resourceHealthCounts.Healthy ?? 0,
    resource_health_progressing: resourceHealthCounts.Progressing ?? 0,
    resource_health_degraded: resourceHealthCounts.Degraded ?? 0,
    resource_health_suspended: resourceHealthCounts.Suspended ?? 0,
    resource_health_missing: resourceHealthCounts.Missing ?? 0,
    resource_health_unknown: resourceHealthCounts.Unknown ?? 0,
    resource_health_blank: resourceHealthCounts.blank ?? 0,
    residue_count: healthResidueCount,
    residue_resources: residueResources.join("; "),
    next_action: nextAction(classification, {
      allSyncResultResourcesSynced,
      argocdCoreTreeCaptured: argocdCore.tree?.result === "pass",
      rootApplicationHealthy: rootSync === "Synced" && rootHealth === "Healthy",
      residueResources,
    }),
  };
}

function readArgocdCoreJson(receiptDir, artifact) {
  if (!artifact?.path) return null;
  const path = join(receiptDir, artifact.path);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function artifactRef(receiptDir, artifact) {
  if (!artifact?.path) return "";
  const path = join(receiptDir, artifact.path);
  const parts = [relativeRepo(path)];
  if (artifact.sha256) parts.push(`sha256:${artifact.sha256}`);
  if (artifact.bytes !== undefined) parts.push(`${artifact.bytes} bytes`);
  return parts.join(" ");
}

function normalizeArgoResources(resources) {
  return resources.map((resource) => ({
    kind: resource.kind ?? "",
    namespace: resource.namespace ?? "",
    name: resource.name ?? "",
    status: resource.status ?? "",
    health: resource.health?.status ?? resource.health ?? "",
  }));
}

function resourceIdentity(resource) {
  const namespace = resource.namespace ? `${resource.namespace}/` : "";
  return `${resource.kind}/${namespace}${resource.name}:${resource.status || "blank"}/${resource.health || "blank"}`;
}

function classify({ result, sync, health, operationPhase, resources, healthResidueCount, resourceHealthCounts }) {
  if (result === "blocked") return "blocked-before-controller-health";
  if (result === "fail") return "failed-before-controller-health";
  if (sync !== "Synced") return "sync-not-complete";
  if (health === "Healthy" && healthResidueCount === 0) return "healthy";
  if (healthResidueCount > 0) return "resource-or-condition-residue";
  if (health === "Progressing" && operationPhase === "Succeeded" && resources.length > 0 && resourceHealthCounts.blank === resources.length) {
    return "aggregate-progressing-with-blank-resource-health";
  }
  if (health === "Progressing") return "aggregate-progressing";
  return "controller-health-review";
}

function nextAction(classification, evidence = {}) {
  const actions = {
    "aggregate-progressing-with-blank-resource-health":
      evidence.allSyncResultResourcesSynced && evidence.argocdCoreTreeCaptured && evidence.rootApplicationHealthy
        ? "Decide the target-scoped controller-health policy: root Application is Healthy, child Application is Synced/Progressing, workloads converged, and the Argo core tree shows blank child-resource health."
        : evidence.allSyncResultResourcesSynced
        ? "Record the target-scoped controller-health policy: Argo sync succeeded for all resources and workloads converged, but aggregate health remains Progressing because per-resource health is blank."
        : "Capture Argo resource tree/controller-health detail on rerun, or record a target-scoped policy explaining why blank per-resource health can leave aggregate health Progressing.",
    "aggregate-progressing":
      "Inspect Argo controller health logic and resource tree; keep the row watch until the aggregate health reason is explained.",
    "resource-or-condition-residue":
      evidence.residueResources?.length
        ? `Name the specific resource or condition (${evidence.residueResources.join("; ")}), fix the target/lifecycle issue or record a bounded watch policy, then rerun.`
        : "Name the specific resource or condition, fix the target/lifecycle issue or record a bounded watch policy, then rerun.",
    "sync-not-complete": "Inspect GitOps source/revision/sync state before treating this as workload parity.",
    "blocked-before-controller-health": "Resolve the named blocker before inspecting controller health.",
    "failed-before-controller-health": "Resolve the failed lane before inspecting controller health.",
    healthy: "No action.",
    "controller-health-review": "Review controller health and record a chart-specific decision.",
  };
  return actions[classification] ?? actions["controller-health-review"];
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function summaryMarkdown(rows) {
  const counts = countBy(rows, (row) => row.classification);
  return `# GitOps Health Residue

This generated report classifies ConfigHub OCI/GitOps live rows where the
controller health signal is not a clean pass. It is designed for large charts
where render parity, sync, and workload readiness may pass while a controller
aggregate health bit still needs explanation.

The report does not turn a \`watch\` row into a \`pass\`. It names what the
receipt contains so the next action is specific.

\`\`\`text
rows: ${rows.length}
${Object.entries(counts)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}
\`\`\`

## Rows

| Chart | Base | Result | Classification | Child App | Root App | Argo tree | Resources | Healthy | Blank health | Residue | Full evidence | Receipt | Next action |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
${rows
  .map(
    (row) =>
      `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.result} | ${row.classification} | ${row.app_sync}/${row.app_health} | ${row.root_app_sync || "-"}/${row.root_app_health || "-"} | ${row.argocd_core_tree_result || "-"} | ${row.resource_count} | ${row.resource_health_healthy} | ${row.resource_health_blank} | ${row.residue_resources || row.residue_count} | ${artifactLinks(row)} | [receipt](../../${row.receipt}) | ${row.next_action} |`,
  )
  .join("\n")}

## How To Read This

- \`resource-or-condition-residue\` means a specific resource health value,
  sync state, or Application condition needs to be handled.
- \`aggregate-progressing-with-blank-resource-health\` means Argo reports the
  Application aggregate as \`Progressing\`, but the captured resource list does
  not identify an unhealthy child resource. This is a controller-health review
  row, not a render-parity defect.
- \`blocked-before-controller-health\` and \`failed-before-controller-health\`
  mean the lane stopped earlier and controller health is not the first problem.

The machine-readable table is [residue.csv](./residue.csv).
`;
}

function toCsv(rows) {
  const headers = [
    "chart",
    "version",
    "base",
    "result",
    "classification",
    "observed_at",
    "receipt",
    "app_sync",
    "app_health",
    "root_app_sync",
    "root_app_health",
    "operation_phase",
    "argocd_core_result",
    "argocd_core_tree_result",
    "argocd_core_json_artifact",
    "argocd_core_tree_artifact",
    "root_argocd_core_result",
    "conditions",
    "resource_count",
    "resource_synced",
    "resource_unsynced",
    "resource_health_healthy",
    "resource_health_progressing",
    "resource_health_degraded",
    "resource_health_suspended",
    "resource_health_missing",
    "resource_health_unknown",
    "resource_health_blank",
    "residue_count",
    "residue_resources",
    "next_action",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function artifactLinks(row) {
  const links = [];
  if (row.argocd_core_json_artifact) {
    const [path] = row.argocd_core_json_artifact.split(" ");
    links.push(`[json](../../${path})`);
  }
  if (row.argocd_core_tree_artifact) {
    const [path] = row.argocd_core_tree_artifact.split(" ");
    links.push(`[tree](../../${path})`);
  }
  return links.join(" ") || "-";
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
