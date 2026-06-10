#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, toYaml, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "latest-top20-refresh", "action-queue");
const csvPath = join(outputRoot, "queue.csv");
const summaryPath = join(outputRoot, "summary.md");
const yamlPath = join(outputRoot, "queue.yaml");

const refreshPath = join(repoRoot, "data", "refresh-survival", "refreshes.csv");
const replacementPath = join(repoRoot, "data", "latest-top20-refresh", "replacement-decisions", "decisions.csv");

const proofScriptByChart = new Map([
  ["argo-cd/argo-cd", "scripts/argo-cd-proof.mjs"],
  ["bitnami/mongodb", "scripts/mongodb-proof.mjs"],
  ["bitnami/nginx", "scripts/nginx-proof.mjs"],
  ["bitnami/postgresql", "scripts/postgresql-proof.mjs"],
  ["prometheus-community/kube-prometheus-stack", "scripts/kube-prometheus-stack-proof.mjs"],
  ["prometheus-community/prometheus", "scripts/prometheus-proof.mjs"],
]);

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  writeYaml(yamlPath, report.yaml);
  verify();
  console.log(`wrote latest refresh action queue for ${report.rows.length} update row(s)`);
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/generate-latest-refresh-action-queue.mjs --generate
  node scripts/generate-latest-refresh-action-queue.mjs --verify`);
  process.exit(1);
}

function verify() {
  check(existsSync(csvPath), `${relativeRepo(csvPath)} is missing`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing`);
  check(existsSync(yamlPath), `${relativeRepo(yamlPath)} is missing`);
  const report = buildReport();
  check(readFileSync(csvPath, "utf8") === report.csv, `${relativeRepo(csvPath)} is stale`);
  check(readFileSync(summaryPath, "utf8") === report.summary, `${relativeRepo(summaryPath)} is stale`);
  check(readFileSync(yamlPath, "utf8") === `${toYaml(report.yaml)}\n`, `${relativeRepo(yamlPath)} is stale`);
  check(report.rows.length > 0, "latest refresh action queue should contain at least one update row");
  const refreshRows = parseCsv(readFileSync(refreshPath, "utf8")).filter((row) => row.refresh_state === "upstream-update-candidate");
  check(report.rows.length === refreshRows.length, `expected ${refreshRows.length} action rows; found ${report.rows.length}`);
  console.log(`verified latest refresh action queue: ${report.rows.length} update row(s)`);
}

function buildReport() {
  const refreshRows = parseCsv(readFileSync(refreshPath, "utf8")).filter((row) => row.refresh_state === "upstream-update-candidate");
  const replacementRows = existsSync(replacementPath)
    ? new Map(parseCsv(readFileSync(replacementPath, "utf8")).map((row) => [row.chart, row]))
    : new Map();

  const rows = refreshRows.map((row) => actionRow(row, replacementRows.get(row.chart)));
  return {
    rows,
    csv: csv(rows),
    summary: summary(rows),
    yaml: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "LatestRefreshActionQueue",
      metadata: {
        name: "latest-top20-refresh-action-queue",
        generatedBy: "scripts/generate-latest-refresh-action-queue.mjs",
      },
      spec: {
        claim: "latest upstream movement is split into replacement decisions, retained-candidate refreshes, and new-candidate creation work",
        rows: rows.map((row) => ({
          chart: row.chart,
          currentVersion: row.current_version,
          latestUpstreamVersion: row.latest_upstream_version,
          retainedCandidateVersion: row.retained_candidate_version || null,
          action: row.action,
          priority: row.priority,
          firstStep: row.first_step,
          doneWhen: row.done_when,
          evidence: splitList(row.evidence),
          command: row.command || null,
        })),
      },
    },
  };
}

function actionRow(row, replacement) {
  const retainedVersion = retainedCandidateVersion(row, replacement);
  if (row.candidate_proof === "candidate-proof-complete-root-path-present") {
    return {
      chart: row.chart,
      current_version: row.current_version,
      latest_upstream_version: row.latest_version,
      retained_candidate_version: retainedVersion,
      action: "write-replacement-decision",
      priority: row.chart === "prometheus-community/kube-prometheus-stack" ? "p0" : "p1",
      first_step: `review target-scoped replacement decision for ${row.chart}@${retainedVersion}`,
      done_when: "replacement decision records replace, defer, or keep-both and names fresh live evidence requirements",
      evidence: [
        "data/latest-top20-refresh/replacement-decisions/summary.md",
        replacement?.current_support_decision,
        replacement?.candidate_recipe,
        replacement?.candidate_package,
      ]
        .filter(Boolean)
        .join(";"),
      command: "npm run top20:latest-replacement-decisions:verify",
    };
  }

  if (row.candidate_proof === "candidate-superseded-by-newer-upstream") {
    const script = proofScriptByChart.get(row.chart);
    check(script, `no proof script registered for superseded candidate ${row.chart}`);
    const outputSlug = `${slug(row.chart)}-${row.latest_version}`;
    return {
      chart: row.chart,
      current_version: row.current_version,
      latest_upstream_version: row.latest_version,
      retained_candidate_version: retainedVersion,
      action: "refresh-retained-candidate",
      priority: "p0",
      first_step: `refresh retained ${row.chart}@${retainedVersion} proof to upstream ${row.latest_version}`,
      done_when: `candidate-status.csv records ${row.chart}@${row.latest_version}, root paths exist, and replacement decision queue marks it latest-upstream-aligned`,
      evidence: [
        "data/refresh-survival/summary.md",
        `data/latest-top20-refresh/candidates/${slug(row.chart)}-${retainedVersion}`,
      ].join(";"),
      command: `HELM_EXPT_CHART_VERSION=${row.latest_version} HELM_EXPT_PROOF_OUTPUT_ROOT=data/latest-top20-refresh/candidates/${outputSlug} node ${script} --generate-proof && HELM_EXPT_CHART_VERSION=${row.latest_version} HELM_EXPT_PROOF_OUTPUT_ROOT=data/latest-top20-refresh/candidates/${outputSlug} node ${script} --generate-package`,
    };
  }

  if (row.candidate_proof === "candidate-render-proof-present") {
    return {
      chart: row.chart,
      current_version: row.current_version,
      latest_upstream_version: row.latest_version,
      retained_candidate_version: row.latest_version,
      action: "promote-render-candidate",
      priority: row.chart === "bitnami/redis" ? "p0" : "p1",
      first_step: `promote ${row.chart}@${row.latest_version} candidate root paths, then run ConfigHub proof, local live, and live parity lanes`,
      done_when: "root recipe/package paths exist and promotion readiness records the remaining live/proof lanes explicitly",
      evidence: [
        "data/latest-top20-refresh/candidates/README.md",
        `data/latest-top20-refresh/candidates/${slug(row.chart)}-${row.latest_version}`,
        "data/latest-top20-refresh/promotion-readiness.md",
      ].join(";"),
      command: "npm run top20:latest-promote-root-paths && npm run top20:latest-promotion-readiness",
    };
  }

  return {
    chart: row.chart,
    current_version: row.current_version,
    latest_upstream_version: row.latest_version,
    retained_candidate_version: "",
    action: "create-retained-candidate",
    priority: row.chart === "bitnami/redis" ? "p0" : "p1",
    first_step:
      row.chart === "bitnami/redis"
        ? "make the bespoke Redis proof/package generator version-output override capable or migrate Redis to proof-kit, then generate Redis 27.0.0 candidate proof"
        : `create retained candidate proof for ${row.chart}@${row.latest_version}`,
    done_when: `candidate-status.csv records ${row.chart}@${row.latest_version} and refresh-survival no longer shows missing candidate proof`,
    evidence: "data/refresh-survival/summary.md",
    command:
      row.chart === "bitnami/redis"
        ? "node scripts/generate-redis-proof.mjs and node scripts/generate-redis-installer-package.mjs need override support before this can be a one-command candidate"
        : "",
  };
}

function retainedCandidateVersion(row, replacement) {
  if (replacement?.candidate_version) return replacement.candidate_version;
  const match = row.next_action.match(/refresh retained candidate ([^ ]+) to latest upstream/);
  return match?.[1] ?? "";
}

function summary(rows) {
  const counts = countBy(rows, "action");
  const priorityCounts = countBy(rows, "priority");
  const tableRows = rows.map(
    (row) =>
      `| \`${row.chart}\` | \`${row.current_version}\` | \`${row.latest_upstream_version}\` | \`${row.retained_candidate_version || "-"}\` | ${row.action} | ${row.priority} | ${row.first_step} |`,
  );
  return `# Latest Refresh Action Queue

This generated queue turns upstream Helm chart movement into concrete work.

It separates four cases:

- a retained candidate still matches latest upstream and needs a replacement
  decision;
- a retained candidate is proof-complete but already behind a newer upstream
  chart version and needs refresh work;
- no retained candidate exists yet, so the proof chain must be created first;
- a retained render/package candidate exists and needs root-path promotion plus
  the remaining ConfigHub and live lanes.

## Result

\`\`\`text
update rows: ${rows.length}
replacement decisions ready: ${counts.get("write-replacement-decision") ?? 0}
retained candidates needing refresh: ${counts.get("refresh-retained-candidate") ?? 0}
render candidates needing root/live work: ${counts.get("promote-render-candidate") ?? 0}
new retained candidates needed: ${counts.get("create-retained-candidate") ?? 0}
p0 rows: ${priorityCounts.get("p0") ?? 0}
p1 rows: ${priorityCounts.get("p1") ?? 0}
\`\`\`

## Queue

| Chart | Current supported | Latest upstream | Retained candidate | Action | Priority | First step |
| --- | --- | --- | --- | --- | --- | --- |
${tableRows.join("\n")}

## Why This Exists

The refresh lane should not collapse into a single vague "upgrade charts" task.
Each row has a different safe next action. The queue keeps the supported catalog
pinned while making the next proof work visible.

## Files

| File | Role |
| --- | --- |
| [queue.csv](./queue.csv) | Spreadsheet work queue. |
| [queue.yaml](./queue.yaml) | Machine-readable work queue. |
| [../replacement-decisions/summary.md](../replacement-decisions/summary.md) | Replacement-decision queue for retained proof-complete candidates. |
| [../../refresh-survival/summary.md](../../refresh-survival/summary.md) | Refresh status across the top-20. |

## Verify

\`\`\`sh
npm run top20:latest-action-queue:verify
\`\`\`
`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function csv(rows) {
  const headers = [
    "chart",
    "current_version",
    "latest_upstream_version",
    "retained_candidate_version",
    "action",
    "priority",
    "first_step",
    "done_when",
    "evidence",
    "command",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function splitList(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return counts;
}

function slug(chart) {
  return chart.split("/").at(-1).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
