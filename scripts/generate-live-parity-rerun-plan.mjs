#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "live-parity-rerun-plan");
const summaryPath = join(outputRoot, "summary.md");
const csvPath = join(outputRoot, "rerun-plan.csv");

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
  const rows = [
    ...configHubOciRows(),
    ...twoClusterRows(),
  ].sort((left, right) =>
    left.priority - right.priority
    || left.lane.localeCompare(right.lane)
    || `${left.chart}@${left.version}/${left.base}`.localeCompare(`${right.chart}@${right.version}/${right.base}`),
  );
  return { rows, csv: toCsv(rows), markdown: markdown(rows) };
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
      rerun_command: `npm run live-parity:top20 -- --from-rank ${row.rank} --to-rank ${row.rank} --continue-on-fail`,
      followup: followupForConfigHubOci(row),
      receipt: row.receipt,
    }));
}

function twoClusterRows() {
  const path = join(repoRoot, "data", "live-kind-parity", "summary.csv");
  if (!existsSync(path)) return [];
  return parseCsv(readFileSync(path, "utf8"))
    .filter((row) => ["blocked", "watch"].includes(row.result))
    .map((row) => ({
      priority: priorityForTwoCluster(row),
      lane: "two-cluster-kind-parity",
      chart: row.chart,
      version: row.version,
      base: row.base,
      current_result: row.result,
      reason: reasonForTwoCluster(row),
      diagnosis: diagnosisForTwoCluster(row),
      rerun_command: `npm run kind-parity:run -- --chart ${row.chart} --version ${row.version} --base ${row.base}`,
      followup: followupForTwoCluster(row),
      receipt: row.receipt,
    }));
}

function priorityForConfigHubOci(row) {
  if (row.reason?.startsWith("infra:")) return 10;
  if (row.reason?.startsWith("helm-runtime:")) return 20;
  if (row.result === "watch") return 30;
  return 40;
}

function priorityForTwoCluster(row) {
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
  if (row.result === "watch") {
    return "Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior.";
  }
  return "Inspect receipt before rerun.";
}

function followupForConfigHubOci(row) {
  if (row.reason?.startsWith("infra:")) return "If it still blocks, fix rig provisioning before judging chart parity.";
  if (row.reason?.startsWith("helm-runtime:")) return "If object comparison remains clean, record this as upstream runtime readiness rather than a ConfigHub parity defect.";
  if (row.result === "watch") return "Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation.";
  return "Open a dedicated parity issue only if the semantic object comparison fails.";
}

function reasonForTwoCluster(row) {
  if (row.result === "watch") return "object parity passed but readiness needs review";
  return "strict parity row blocked; inspect receipt";
}

function diagnosisForTwoCluster(row) {
  if (row.result === "watch") {
    return "Rerun once on a clean pair of vanilla kind clusters; if object parity remains clean, decide whether readiness should stay watch.";
  }
  return "Rerun the same chart/base with two clean vanilla kind clusters before changing the recipe.";
}

function followupForTwoCluster(row) {
  if (row.result === "watch") return "Do not change chart artifacts unless semantic parity or object readiness shows a real difference.";
  return "If blocked again, classify as recipe issue, target-fact/prerequisite issue, or chart runtime issue from the receipt.";
}

function markdown(rows) {
  const counts = countBy(rows, "lane");
  const resultCounts = countBy(rows, "current_result");
  return `# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

\`\`\`text
rows: ${rows.length}
blocked: ${resultCounts.blocked ?? 0}
watch: ${resultCounts.watch ?? 0}
configHub-oci-live-comparison: ${counts["configHub-oci-live-comparison"] ?? 0}
two-cluster-kind-parity: ${counts["two-cluster-kind-parity"] ?? 0}
\`\`\`

## Recommended Order

1. Re-run the ConfigHub/OCI rows with \`infra:\` reasons on a clean host, one at a time.
2. Re-run the ConfigHub/OCI row where semantic parity already passed but upstream Helm readiness timed out.
3. Re-run strict two-cluster blocked rows for all base variants.
4. Review watch rows last; most are readiness or target-limit cases rather than object parity failures.

## Rerun Queue

| Priority | Lane | Chart | Base | Current | Reason | Command |
| ---: | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.priority} | ${row.lane} | \`${row.chart}@${row.version}\` | ${row.base} | ${row.current_result} | ${row.reason} | \`${row.rerun_command}\` |`).join("\n")}

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
    "diagnosis",
    "rerun_command",
    "followup",
    "receipt",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
