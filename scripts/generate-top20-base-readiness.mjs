#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "top20-base-readiness");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  csv: join(outputRoot, "base-readiness.csv"),
  startHere: join(outputRoot, "start-here.md"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  write(outputs.startHere, report.startHere);
  console.log(`wrote ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run top20:base-readiness`);
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run top20:base-readiness`);
  check(existsSync(outputs.startHere), `${relativeRepo(outputs.startHere)} is missing; run npm run top20:base-readiness`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run top20:base-readiness`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run top20:base-readiness`);
  check(readFileSync(outputs.startHere, "utf8") === report.startHere, `${relativeRepo(outputs.startHere)} is stale; run npm run top20:base-readiness`);
  console.log(`verified top20 base readiness for ${report.rows.length} base variant(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-top20-base-readiness.mjs --generate
  node scripts/generate-top20-base-readiness.mjs --verify`);
}

function buildReport() {
  const productionRows = parseCsvFile("data/production-disposition/top20.csv");
  const baseRows = parseCsvFile("data/outcome-coverage/base-outcomes.csv");
  const baseByKey = new Map(baseRows.map((row) => [`${row.chart}|${row.base}`, row]));
  const lifecycleObservations = lifecycleObservationIndex();
  const rerunPlan = liveParityRerunIndex();
  const rows = [];

  for (const [index, production] of productionRows.entries()) {
    const chartKey = `${production.chart}@${production.version}`;
    const artifactIndex = readYaml(join(repoRoot, production.recipe_path, "artifact-index.yaml"));
    const variants = artifactIndex.spec?.variants ?? [];
    for (const variant of variants) {
      const base = variant.name;
      const baseRow = baseByKey.get(`${chartKey}|${base}`);
      check(Boolean(baseRow), `missing base outcome row for ${chartKey} ${base}`);
      const lifecycle = lifecycleObservations.get(`${chartKey}|${base}`);
      const rerun = rerunPlan.get(`${chartKey}|${base}`);
      const readiness = readinessFor(baseRow, lifecycle);
      rows.push({
        rank: String(index + 1),
        chart: chartKey,
        base,
        recommended_first: variant.packageBase?.default ? "yes" : "no",
        user_readiness: readiness.status,
        why: readiness.why,
        next_action: readiness.nextAction,
        live_rerun_readiness: rerun?.rerun_readiness ?? "",
        live_rerun_next_step: rerun?.next_step_type ?? "",
        live_rerun_command: rerun?.rerun_command ?? "",
        command: `cub installer setup --pull ${production.package_path} --base ${base} --work-dir <tmp> --non-interactive --namespace ${variant.namespace}`,
        target_facts: variant.targetFactSummary || "none",
        render_parity: baseRow.render_parity,
        in_confighub: baseRow.in_confighub,
        local_live: baseRow.local_live,
        gitops_oci_live: baseRow.gitops_oci_live,
        live_helm_vs_confighub_parity: baseRow.live_helm_vs_confighub_parity,
        two_cluster_kind_parity: baseRow.two_cluster_kind_parity,
        two_cluster_kind_parity_reason: baseRow.two_cluster_kind_parity_reason,
        lifecycle_observation: lifecycle?.result ?? "",
        lifecycle_observation_receipt: lifecycle?.receipt ?? "",
        complete_core_lane_set: baseRow.complete_core_lane_set,
        package_base: variant.packageBase?.path ?? "",
        catalog_path: `${production.recipe_path}/CATALOG.md`,
      });
    }
  }

  rows.sort((a, b) =>
    Number(a.rank) - Number(b.rank)
    || firstSort(a.recommended_first) - firstSort(b.recommended_first)
    || a.base.localeCompare(b.base),
  );
  const counts = groupCount(rows, "user_readiness");
  const rerunCounts = groupCount(rows.filter((row) => row.live_rerun_readiness), "live_rerun_readiness");
  const startHereRows = rows.filter((row) => row.user_readiness === "start-here");
  const summary = `# Top-20 Base Variant Readiness

This generated table answers the practical catalog question:

~~~text
For each top-20 chart base variant, can a user start with it now, or does it
need a target prerequisite, runtime review, hook lifecycle route, or more proof?
~~~

It is intentionally base-variant level. Chart-level summaries can hide the fact
that one base is a clean first path while another base still needs prerequisites
or runtime review.

## Summary

~~~text
base variants: ${rows.length}
start-here: ${counts.get("start-here") ?? 0}
try-with-proof: ${counts.get("try-with-proof") ?? 0}
runtime-watch: ${counts.get("runtime-watch") ?? 0}
runtime-review-needed: ${counts.get("runtime-review-needed") ?? 0}
target-prerequisite-needed: ${counts.get("target-prerequisite-needed") ?? 0}
hook-lifecycle-review-needed: ${counts.get("hook-lifecycle-review-needed") ?? 0}
lifecycle-observed: ${counts.get("lifecycle-observed") ?? 0}
prerequisite-observed: ${counts.get("prerequisite-observed") ?? 0}
render-only: ${counts.get("render-only") ?? 0}
~~~

Live rerun readiness for non-pass rows:

~~~text
model-or-stage-first: ${rerunCounts.get("model-or-stage-first") ?? 0}
review-target-first: ${rerunCounts.get("review-target-first") ?? 0}
inspect-diff-first: ${rerunCounts.get("inspect-diff-first") ?? 0}
rerun-now-after-cleanup: ${rerunCounts.get("rerun-now-after-cleanup") ?? 0}
~~~

## How To Read User Readiness

| Readiness | Meaning |
| --- | --- |
| \`start-here\` | Best current demo/catalog path: render parity, ConfigHub proof, local live, GitOps/OCI, selected live parity, and two-cluster parity are all passing. |
| \`try-with-proof\` | Render parity and two-cluster parity pass, but one or more broader ConfigHub/live lanes are still missing for this base. |
| \`runtime-watch\` | Object parity passed, but the live target did not fully settle during the run. |
| \`runtime-review-needed\` | Object parity passed, but runtime state needs investigation before this base is presented as easy. |
| \`target-prerequisite-needed\` | The base expects CRDs, APIs, Secrets, storage, or another target prerequisite to exist or be staged. |
| \`hook-lifecycle-review-needed\` | Helm hook or hook-like lifecycle behavior needs an explicit route and receipt. |
| \`lifecycle-observed\` | Strict parity remains blocked or watch, but the hook-like lifecycle route has a passing observation receipt. |
| \`prerequisite-observed\` | The base needs an external prerequisite, and a related observation receipt proves the staged-prerequisite path. |
| \`render-only\` | Render parity exists, but live/user proof lanes are not present for this base. |

## Rows

| Chart | Base | First | Readiness | Rerun readiness | Why | Next action |
| --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}\` | ${row.base} | ${row.recommended_first} | ${row.user_readiness} | ${row.live_rerun_readiness || "-"} | ${escapePipes(row.why)} | ${escapePipes(row.next_action)} |`).join("\n")}

## Files

| File | Purpose |
| --- | --- |
| \`data/top20-base-readiness/base-readiness.csv\` | Spreadsheet-ready one-row-per-base readiness table. |
| \`data/top20-base-readiness/start-here.md\` | Short guide to the clean first catalog paths. |
| \`data/outcome-coverage/base-outcomes.csv\` | Underlying lane data used by this report. |
| \`data/live-kind-parity/summary.md\` | Two-cluster Helm-vs-installer parity receipts and non-pass reasons. |
| \`data/live-parity-rerun-plan/rerun-plan.csv\` | Rerun readiness, next step, and exact rerun command for non-pass live rows. |
| \`CATALOG.md\` | Top-level chart and variant catalog. |

Regenerate:

~~~sh
npm run top20:base-readiness
npm run top20:base-readiness:verify
~~~
`;
  const startHere = `# Top-20 Start-Here Bases

This generated page lists the catalog bases that are currently the easiest
first paths. Each row has render parity, ConfigHub proof, local live evidence,
GitOps/OCI evidence, selected live Helm-vs-ConfigHub parity, and two-cluster
kind parity passing for that base.

These are not production support claims. Before production use, check the
production support decision contract and the chart's support decision queue.

## Summary

~~~text
start-here bases: ${startHereRows.length}
top-20 base variants: ${rows.length}
production-supported charts: 0
~~~

## First Paths

| Chart | Base | Command | Before production |
| --- | --- | --- | --- |
${startHereRows.map((row) => `| \`${row.chart}\` | ${row.base} | \`${row.command}\` | ${productionReminder(row)} |`).join("\n")}

## Related Files

| File | Use |
| --- | --- |
| \`data/top20-base-readiness/base-readiness.csv\` | Full one-row-per-base table. |
| \`data/top20-base-readiness/summary.md\` | All readiness categories, including runtime and prerequisite rows. |
| \`data/production-disposition/support-decision-contract.md\` | What must be recorded before production support can be claimed. |
| \`data/production-disposition/support-decision-queue.csv\` | One production decision row per top-20 chart. |
| \`CATALOG.md\` | Top-level chart and variant catalog. |
`;

  return { rows, csv: toCsv(rows), summary, startHere };
}

function readinessFor(row, lifecycle) {
  if (row.complete_core_lane_set === "yes" && row.two_cluster_kind_parity === "pass") {
    return {
      status: "start-here",
      why: "all core lanes plus two-cluster parity pass for this base",
      nextAction: "use as the first catalog path; check production disposition before production use",
    };
  }
  if (row.two_cluster_kind_parity === "pass") {
    return {
      status: "try-with-proof",
      why: "render parity and two-cluster live parity pass, but one or more broader lanes are missing",
      nextAction: "run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims",
    };
  }
  const reason = row.two_cluster_kind_parity_reason || "";
  if (lifecycle?.result === "pass" && reason.startsWith("helm-hook")) {
    return {
      status: "lifecycle-observed",
      why: `${reason}; lifecycle observation passed`,
      nextAction: `use the lifecycle route evidence at ${lifecycle.receipt}; rerun strict parity only if the hook handling decision changes`,
    };
  }
  if (lifecycle?.result === "pass" && reason.startsWith("target-prerequisite")) {
    return {
      status: "prerequisite-observed",
      why: `${reason}; prerequisite-staged lifecycle observation passed`,
      nextAction: `record the prerequisite for this base and use ${lifecycle.receipt} when explaining target readiness`,
    };
  }
  if (reason.startsWith("target-prerequisite")) {
    return {
      status: "target-prerequisite-needed",
      why: reason,
      nextAction: "stage or model the prerequisite, then rerun the same base; keep render parity separate from target fit",
    };
  }
  if (reason.startsWith("helm-hook")) {
    return {
      status: "hook-lifecycle-review-needed",
      why: reason,
      nextAction: "choose a lifecycle route and commit a lifecycle or observation receipt",
    };
  }
  if (row.two_cluster_kind_parity === "watch") {
    return {
      status: "runtime-watch",
      why: reason || "object parity passed, but readiness did not fully settle",
      nextAction: "inspect the receipt and rerun after target resources, storage, and waits are appropriate",
    };
  }
  if (row.two_cluster_kind_parity === "blocked") {
    return {
      status: "runtime-review-needed",
      why: reason || "two-cluster parity did not pass as-is",
      nextAction: "inspect runtime state; keep the recipe stable unless semantic object comparison starts failing",
    };
  }
  if (row.render_parity === "pass") {
    return {
      status: "render-only",
      why: "render parity exists, but two-cluster live parity has no committed receipt for this base",
      nextAction: "run two-cluster kind parity and then add ConfigHub/live lanes as needed",
    };
  }
  return {
    status: "needs-review",
    why: "no passing render parity row found",
    nextAction: "inspect the recipe and proof receipts before presenting this base",
  };
}

function lifecycleObservationIndex() {
  const path = join(repoRoot, "data", "lifecycle-observations", "cert-manager-eso", "summary.csv");
  if (!existsSync(path)) return new Map();
  return new Map(parseCsvFile("data/lifecycle-observations/cert-manager-eso/summary.csv")
    .map((row) => [`${row.chart}@${row.version}|${row.base}`, row]));
}

function liveParityRerunIndex() {
  const path = join(repoRoot, "data", "live-parity-rerun-plan", "rerun-plan.csv");
  if (!existsSync(path)) return new Map();
  return new Map(parseCsvFile("data/live-parity-rerun-plan/rerun-plan.csv")
    .map((row) => [`${row.chart}@${row.version}|${row.base}`, row]));
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...body] = rows.filter((item) => item.some((fieldValue) => fieldValue !== ""));
  return body.map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}

function groupCount(rows, key) {
  const result = new Map();
  for (const row of rows) result.set(row[key], (result.get(row[key]) ?? 0) + 1);
  return result;
}

function firstSort(value) {
  return value === "yes" ? 0 : 1;
}

function productionReminder(row) {
  return `check production decision for ${row.chart.split("@")[0]}`;
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}
