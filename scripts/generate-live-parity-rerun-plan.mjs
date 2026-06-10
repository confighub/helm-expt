#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "live-parity-rerun-plan");
const summaryPath = join(outputRoot, "summary.md");
const csvPath = join(outputRoot, "rerun-plan.csv");
const bitnamiOciRepository = "oci://registry-1.docker.io/bitnamicharts";

if (mode === "--generate") {
  const plan = buildPlan();
  write(summaryPath, plan.markdown);
  write(csvPath, plan.csv);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const plan = buildPlan();
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run live-parity:rerun-plan`);
  check(existsSync(csvPath), `${relativeRepo(csvPath)} is missing; run npm run live-parity:rerun-plan`);
  check(readFileSync(summaryPath, "utf8") === plan.markdown, `${relativeRepo(summaryPath)} is stale; run npm run live-parity:rerun-plan`);
  check(readFileSync(csvPath, "utf8") === plan.csv, `${relativeRepo(csvPath)} is stale; run npm run live-parity:rerun-plan`);
  console.log(`verified live parity rerun plan for ${plan.rows.length} row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-live-parity-rerun-plan.mjs --generate
  node scripts/generate-live-parity-rerun-plan.mjs --verify`);
}

function buildPlan() {
  const allRows = [
    ...configHubOciRows(),
    ...twoClusterRows(),
  ].map((row) => {
    const next_step_type = nextStepType(row);
    const support_artifact = supportArtifactFor(row);
    return {
      next_step_type,
      rerun_readiness: rerunReadiness(next_step_type),
      support_artifact,
      ...row,
    };
  }).sort((left, right) =>
    left.priority - right.priority
    || left.lane.localeCompare(right.lane)
    || `${left.chart}@${left.version}/${left.base}`.localeCompare(`${right.chart}@${right.version}/${right.base}`),
  );
  const lifecycleRoutedRows = allRows.filter(lifecycleRouted);
  const rows = allRows.filter((row) => !lifecycleRouted(row));
  return { rows, lifecycleRoutedRows, csv: toCsv(rows), markdown: markdown(rows, lifecycleRoutedRows) };
}

function configHubOciRows() {
  const path = join(repoRoot, "data", "live-helm-confighub-compare", "summary.csv");
  if (!existsSync(path)) return [];
  return parseCsv(readFileSync(path, "utf8"))
    .filter((row) => ["blocked", "watch"].includes(row.result))
    .map((row) => ({
      priority: priorityForConfigHubOci(row),
      lane: "configHub-oci-live-comparison",
      chart: row.chart,
      version: row.version,
      base: row.variant,
      current_result: row.result,
      reason: row.reason || "watch: inspect receipt",
      diagnosis: diagnosisForConfigHubOci(row),
      rerun_command: `npm run live-parity:top20 -- --from-rank ${row.rank} --to-rank ${row.rank}${repoUrlFlag(row)} --continue-on-fail`,
      followup: followupForConfigHubOci(row),
      receipt: row.receipt,
    }));
}

function twoClusterRows() {
  const path = join(repoRoot, "data", "live-kind-parity", "summary.csv");
  if (!existsSync(path)) return [];
  const lifecycleObservations = lifecycleObservationIndex();
  return parseCsv(readFileSync(path, "utf8"))
    .filter((row) => ["blocked", "watch"].includes(row.result))
    .map((row) => {
      const lifecycle = lifecycleObservations.get(lifecycleKey(row));
      return {
        priority: priorityForTwoCluster(row),
        lane: "two-cluster-kind-parity",
        chart: row.chart,
        version: row.version,
        base: row.base,
        current_result: row.result,
        reason: row.reason || reasonForTwoCluster(row),
        diagnosis: diagnosisForTwoCluster(row, lifecycle),
        rerun_command: `npm run kind-parity:run -- --chart ${row.chart} --version ${row.version} --base ${row.base}${repoUrlFlag(row)}`,
        followup: followupForTwoCluster(row, lifecycle),
        receipt: row.receipt,
        related_lifecycle_result: lifecycle?.result ?? "",
        related_lifecycle_receipt: lifecycle?.receipt ?? "",
      };
    });
}

function lifecycleObservationIndex() {
  const path = join(repoRoot, "data", "lifecycle-observations", "cert-manager-eso", "summary.csv");
  if (!existsSync(path)) return new Map();
  return new Map(parseCsv(readFileSync(path, "utf8")).map((row) => [lifecycleKey(row), row]));
}

function lifecycleKey(row) {
  return `${row.chart}@${row.version}/${row.base}`;
}

function repoUrlFlag(row) {
  return repoUrlOverrideFor(row) ? ` --repo-url ${repoUrlOverrideFor(row)}` : "";
}

function repoUrlOverrideFor(row) {
  if (row.chart?.startsWith("bitnami/")) return bitnamiOciRepository;
  return "";
}

function priorityForConfigHubOci(row) {
  if (row.reason?.startsWith("infra:")) return 10;
  if (row.reason?.startsWith("helm-runtime:")) return 20;
  if (row.result === "watch") return 30;
  return 40;
}

function priorityForTwoCluster(row) {
  if (row.reason?.startsWith("parity:")) return 45;
  if (row.reason?.startsWith("target-prerequisite:")) return 50;
  if (row.reason?.startsWith("helm-hook:")) return 55;
  if (row.reason?.startsWith("target-runtime:") || row.reason?.startsWith("helm-runtime:")) return 60;
  if (row.result === "blocked") return 50;
  if (row.result === "watch") return 60;
  return 70;
}

function diagnosisForConfigHubOci(row) {
  if (row.reason?.startsWith("infra:")) {
    return "Rerun on a clean host with serial execution and authoritative cluster/container cleanup.";
  }
  if (row.reason?.startsWith("helm-runtime:")) {
    return "Semantic parity already passed; rerun with right-sized Helm readiness waits or classify as watch if upstream Helm stays pending.";
  }
  if (row.reason?.startsWith("target-fit:")) {
    return "Semantic parity and workload readiness passed, but the proof target lacks a required platform behavior such as LoadBalancer external IP assignment.";
  }
  if (row.result === "watch") {
    return "Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior.";
  }
  return "Inspect receipt before rerun.";
}

function followupForConfigHubOci(row) {
  if (row.reason?.startsWith("infra:")) return "If it still blocks, fix rig provisioning before judging chart parity.";
  if (row.reason?.startsWith("helm-runtime:")) return "If object comparison remains clean, record this as upstream runtime readiness rather than a ConfigHub parity defect.";
  if (row.reason?.startsWith("target-fit:")) return "Use a target with the required platform behavior, or create a separate base that matches the proof target.";
  if (row.result === "watch") return "Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation.";
  return "Open a dedicated parity issue only if the semantic object comparison fails.";
}

function reasonForTwoCluster(row) {
  if (row.result === "watch") return "object parity passed but readiness needs review";
  return "strict parity row blocked; inspect receipt";
}

function diagnosisForTwoCluster(row, lifecycle) {
  if (isMetricsServerExternalTlsCa(row)) {
    return "Object parity passed, but the current rendered APIService caBundle is a placeholder. Generate target TLS material first, inject the matching CA as a pre-render value, then render both legs and stage the matching Secret before rerun.";
  }
  if (lifecycle?.result === "pass" && row.reason?.startsWith("helm-hook:")) {
    return `Object parity passed. Helm hook execution blocked the regular Helm leg, while the related lifecycle observation passed: ${lifecycle.receipt}.`;
  }
  if (lifecycle?.result === "pass" && row.reason?.startsWith("target-prerequisite:")) {
    return `Object parity passed. This base needs external prerequisites; the related lifecycle observation passed with those prerequisites staged: ${lifecycle.receipt}.`;
  }
  if (row.reason?.startsWith("parity:")) {
    return "Semantic object comparison did not pass. Inspect the diff before changing waits or target provisioning.";
  }
  if (row.reason?.startsWith("target-prerequisite:")) {
    return "The target is missing required API types or prerequisites. Stage them, then rerun the same base.";
  }
  if (row.reason?.startsWith("helm-hook:")) {
    return "This is Helm lifecycle behavior. Decide whether the hook maps to desired config, a lifecycle operation, or an observation check.";
  }
  if (row.reason?.startsWith("operate-policy:")) {
    return "Object parity passed; the remaining condition is a post-render operating procedure, not a recipe drift.";
  }
  if (row.reason?.startsWith("target-fit:")) {
    return "Object parity passed; the selected proof target does not provide the platform shape required by this base.";
  }
  if (row.reason?.startsWith("target-runtime:") || row.reason?.startsWith("helm-runtime:")) {
    return "Object parity passed; rerun only after target resources, storage, and readiness waits are appropriate.";
  }
  if (row.result === "watch") {
    return "Rerun once on a clean pair of vanilla kind clusters; if object parity remains clean, decide whether readiness should stay watch.";
  }
  return "Rerun the same chart/base with two clean vanilla kind clusters before changing the recipe.";
}

function followupForTwoCluster(row, lifecycle) {
  if (row.reason?.startsWith("parity:")) return "Open a parity issue only if the diff is not an intentional, documented normalization.";
  if (isMetricsServerExternalTlsCa(row)) return "Do not rerun the existing placeholder render as-is; use the target-prerequisite plan to bind caBundle and metrics-server-tls from the same generated or supplied CA.";
  if (lifecycle?.result === "pass" && row.reason?.startsWith("helm-hook:")) return "Keep this as lifecycle-routed evidence unless the product decision is to emulate the Helm hook directly.";
  if (lifecycle?.result === "pass" && row.reason?.startsWith("target-prerequisite:")) return "Record the external prerequisite in the base variant and use the lifecycle receipt when explaining target readiness.";
  if (row.reason?.startsWith("target-prerequisite:")) return "Record the prerequisite in the chart facts, base variant, or install checks before promoting.";
  if (row.reason?.startsWith("helm-hook:")) return "Keep desired object parity separate from hook execution and document the lifecycle route.";
  if (row.reason?.startsWith("operate-policy:")) return "Record the operating procedure and a receipt for it; rerun strict parity only if the expected readiness contract changes.";
  if (row.reason?.startsWith("target-fit:")) return "Use a target that satisfies the base, or add a separate base for the smaller proof target.";
  if (row.reason?.startsWith("target-runtime:") || row.reason?.startsWith("helm-runtime:")) {
    return "Keep the recipe stable unless the rendered object comparison starts failing.";
  }
  if (row.result === "watch") return "Do not change chart artifacts unless semantic parity or object readiness shows a real difference.";
  return "If blocked again, classify as recipe issue, target-fact/prerequisite issue, or chart runtime issue from the receipt.";
}

function isMetricsServerExternalTlsCa(row) {
  return row.chart === "metrics-server/metrics-server" && row.base === "external-tls-ca";
}

function nextStepType(row) {
  const reason = row.reason ?? "";
  if (reason.startsWith("parity:")) return "inspect-parity-diff";
  if (reason.startsWith("infra:")) return "clean-rerun";
  if (reason.startsWith("target-prerequisite:")) return "stage-prerequisite";
  if (reason.startsWith("helm-hook:")) return "lifecycle-route";
  if (reason.startsWith("operate-policy:")) return "operating-policy";
  if (reason.startsWith("target-fit:")) return "target-fit-review";
  if (reason.startsWith("gitops-runtime:")) return "gitops-runtime-review";
  if (reason.startsWith("target-runtime:") || reason.startsWith("helm-runtime:")) return "runtime-review";
  if (row.current_result === "watch") return "runtime-review";
  return "inspect-receipt";
}

function supportArtifactFor(row) {
  const recipePath = join("recipes", row.chart ?? "", row.version ?? "");
  const reason = row.reason ?? "";
  const candidates = [];
  if (reason.startsWith("target-prerequisite:")) candidates.push("target-prerequisite-plan.yaml");
  if (reason.startsWith("helm-hook:")) candidates.push("lifecycle-policy.yaml");
  if (reason.startsWith("operate-policy:")) candidates.push("operating-policy.yaml");
  if (reason.startsWith("target-fit:")) candidates.push("target-topology.yaml", "operating-policy.yaml");
  for (const candidate of candidates) {
    const absolutePath = join(repoRoot, recipePath, candidate);
    if (existsSync(absolutePath)) return `${recipePath}/${candidate}`;
  }
  return "";
}

function lifecycleRouted(row) {
  return row.related_lifecycle_result === "pass"
    && (row.reason?.startsWith("helm-hook:") || row.reason?.startsWith("target-prerequisite:"));
}

function nextStepDescription(type) {
  return {
    "inspect-parity-diff": "Inspect the object diff before changing waits, target provisioning, or the recipe.",
    "clean-rerun": "Rerun once on a clean host with serial execution and authoritative cleanup.",
    "stage-prerequisite": "Stage or model CRDs, APIs, Secrets, storage, or another prerequisite before rerunning.",
    "lifecycle-route": "Choose the lifecycle route or observation contract before rerunning strict parity.",
    "operating-policy": "Record the operating policy decision, then rerun only if the expected readiness changes.",
    "target-fit-review": "Choose a target that provides the required platform behavior, or create a base that fits the target.",
    "gitops-runtime-review": "Inspect GitOps/controller health; rerun after target conditions or controller waits are corrected.",
    "runtime-review": "Inspect runtime readiness, waits, storage, capacity, or app initialization before rerunning.",
    "inspect-receipt": "Read the receipt and classify the row before rerunning.",
  }[type] ?? "Read the receipt and classify the row before rerunning.";
}

function rerunReadiness(type) {
  return {
    "inspect-parity-diff": "inspect-diff-first",
    "clean-rerun": "rerun-now-after-cleanup",
    "stage-prerequisite": "model-or-stage-first",
    "lifecycle-route": "model-or-stage-first",
    "operating-policy": "model-or-stage-first",
    "target-fit-review": "model-or-stage-first",
    "gitops-runtime-review": "review-target-first",
    "runtime-review": "review-target-first",
    "inspect-receipt": "inspect-receipt-first",
  }[type] ?? "inspect-receipt-first";
}

function rerunReadinessDescription(type) {
  return {
    "inspect-diff-first": "Do not rerun until the semantic diff has been inspected.",
    "rerun-now-after-cleanup": "Rerun serially on a clean host after confirming no other live lane is running.",
    "model-or-stage-first": "Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning.",
    "review-target-first": "Review runtime, storage, controller health, or wait conditions before rerunning.",
    "inspect-receipt-first": "Read the receipt and classify the row before rerunning.",
  }[type] ?? "Read the receipt and classify the row before rerunning.";
}

function markdown(rows, lifecycleRoutedRows = []) {
  const counts = countBy(rows, "lane");
  const resultCounts = countBy(rows, "current_result");
  const laneResults = countByLaneAndResult(rows);
  const nextStepCounts = countBy(rows, "next_step_type");
  const readinessCounts = countBy(rows, "rerun_readiness");
  const lifecycleRows = [
    ...rows.filter((row) => row.related_lifecycle_receipt),
    ...lifecycleRoutedRows,
  ];
  const semanticDefects = rows.filter((row) => row.reason?.startsWith("parity:")).length;
  const infraRows = rows.filter((row) => row.reason?.startsWith("infra:")).length;
  const prerequisiteRows = rows.filter((row) => row.reason?.startsWith("target-prerequisite:") || row.reason?.startsWith("helm-hook:")).length;
  const runtimeRows = rows.filter((row) =>
    ["runtime-review", "gitops-runtime-review"].includes(row.next_step_type)
  ).length;
  return `# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

\`\`\`text
rows: ${rows.length}
lifecycle-routed-not-active-rerun: ${lifecycleRoutedRows.length}
blocked: ${resultCounts.blocked ?? 0}
watch: ${resultCounts.watch ?? 0}
configHub-oci-live-comparison: ${counts["configHub-oci-live-comparison"] ?? 0}
two-cluster-kind-parity: ${counts["two-cluster-kind-parity"] ?? 0}
semantic-parity-defects: ${semanticDefects}
infra-or-rig-rows: ${infraRows}
prerequisite-or-lifecycle-rows: ${prerequisiteRows}
runtime-or-watch-rows: ${runtimeRows}
\`\`\`

## Lane Breakdown

| Lane | Rows | Pass | Watch | Blocked | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
${["configHub-oci-live-comparison", "two-cluster-kind-parity"].map((lane) => {
  const row = laneResults[lane] ?? {};
  return `| ${lane} | ${counts[lane] ?? 0} | ${row.pass ?? 0} | ${row.watch ?? 0} | ${row.blocked ?? 0} | ${row.fail ?? 0} |`;
}).join("\n")}

The ConfigHub/OCI live comparison rows in this queue are current \`watch\` rows.
They have semantic parity and need runtime, target, or controller-health review.
The \`blocked\` rows are currently from the two-cluster kind parity lane.

## Recommended Order

1. Inspect any \`parity:\` rows first. Those are the only rows that currently
   point at an object-set difference.
2. Re-run any \`infra:\` rows on a clean host, one at a time.
3. Resolve \`target-prerequisite:\` and \`helm-hook:\` rows by staging the
   prerequisite or choosing the lifecycle route before rerunning.
4. Review \`target-runtime:\`, \`helm-runtime:\`, and \`watch\` rows last. They
   usually mean object parity passed and the target needs a readiness, storage,
   capacity, or operating-policy decision.

## Next Step Buckets

| Next step | Rows | What to do |
| --- | ---: | --- |
${Object.entries(nextStepCounts).sort((left, right) => left[0].localeCompare(right[0])).map(([type, count]) => `| ${type} | ${count} | ${nextStepDescription(type)} |`).join("\n")}

Rows in \`stage-prerequisite\`, \`lifecycle-route\`, and \`operating-policy\`
usually need a model or target decision before another rerun is useful. Rows in
\`runtime-review\` and \`gitops-runtime-review\` are good rerun candidates only
after the receipt explains what readiness, storage, controller, or wait
condition changed.

## Rerun Readiness

This table separates rows that need modeling or target work from rows that are
reasonable live rerun candidates.

| Readiness | Rows | Meaning |
| --- | ---: | --- |
${Object.entries(readinessCounts).sort((left, right) => left[0].localeCompare(right[0])).map(([type, count]) => `| ${type} | ${count} | ${rerunReadinessDescription(type)} |`).join("\n")}

## Run Safety

Run live parity reruns serially. Do not run two live parity commands at the
same time from different terminals or agents. The live harness creates and
prunes parity-owned kind clusters and related local resources; concurrent runs
can delete each other's in-flight cluster and produce a false infrastructure
failure.

If several rows need reruns, run one command, let it finish, inspect the
receipt, regenerate the relevant summary, then move to the next row.

## Repository Overrides

Some pinned public chart versions remain available from OCI even when the classic
Helm repository index no longer exposes them. The generated commands include an
explicit \`--repo-url\` override for those rows. This keeps the rerun command
faithful to the locked chart/version without changing the recipe.

## Rerun Queue

| Priority | Readiness | Next step | Lane | Chart | Base | Current | Reason | Support artifact | Command |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.priority} | ${row.rerun_readiness} | ${row.next_step_type} | ${row.lane} | \`${row.chart}@${row.version}\` | ${row.base} | ${row.current_result} | ${row.reason} | ${row.support_artifact ? `[\`${row.support_artifact}\`](../../${row.support_artifact})` : "-"} | \`${row.rerun_command}\` |`).join("\n")}

${lifecycleRows.length ? `## Related Lifecycle Evidence

These rows have a separate lifecycle receipt for hook, CRD, webhook, or
controller-owned behavior. Rows with a passing lifecycle receipt are not active
rerun work unless the lifecycle decision changes.

| Chart | Base | Rerun result | Lifecycle result | Lifecycle receipt |
| --- | --- | --- | --- | --- |
${lifecycleRows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.current_result} | ${row.related_lifecycle_result} | ${row.related_lifecycle_receipt} |`).join("\n")}
` : ""}

The machine-readable queue is:

\`\`\`text
data/live-parity-rerun-plan/rerun-plan.csv
\`\`\`
`;
}

function countBy(rows, key) {
  const result = {};
  for (const row of rows) result[row[key]] = (result[row[key]] ?? 0) + 1;
  return result;
}

function countByLaneAndResult(rows) {
  const result = {};
  for (const row of rows) {
    result[row.lane] ??= {};
    result[row.lane][row.current_result] = (result[row.lane][row.current_result] ?? 0) + 1;
  }
  return result;
}

function parseCsv(text) {
  const rows = [];
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  if (!headerLine) return rows;
  const headers = parseCsvLine(headerLine);
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function toCsv(rows) {
  const headers = [
    "priority",
    "lane",
    "chart",
    "version",
    "base",
    "current_result",
    "reason",
    "next_step_type",
    "rerun_readiness",
    "diagnosis",
    "rerun_command",
    "followup",
    "support_artifact",
    "receipt",
    "related_lifecycle_result",
    "related_lifecycle_receipt",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
