#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "top100-coverage");
const outputs = {
  contract: join(outDir, "contract.md"),
  csv: join(outDir, "coverage.csv"),
  summary: join(outDir, "summary.md"),
  workQueueCsv: join(outDir, "work-queue.csv"),
  workQueueSummary: join(outDir, "work-queue.md"),
  decisionsNeeded: join(outDir, "decisions-needed.md"),
};

const contractItems = [
  ["a", "pinned chart version", "The row names a chart version and points at a retained recipe source lock."],
  ["b", "reviewed named base variant", "At least one named base variant is present with a catalog rationale."],
  ["c", "render parity receipt", "Every declared base variant has Helm-template versus cub installer render parity."],
  ["d", "pain report and quirk axes", "The per-chart pain report and control-point notes exist."],
  ["e", "facts declared", "Target facts, generated facts, values, and control points are represented in recipe artifacts."],
  ["f", "scan and production disposition", "Scan and production-disposition evidence exists for the current support scope."],
  ["g", "live witness or routed reason", "At least one supported base has live evidence, or the deferred live route is explicit."],
  ["h", "catalog and site entry", "The row has a per-chart catalog page and appears in the generated public site data."],
];

if (mode === "--generate") {
  mkdirSync(outDir, { recursive: true });
  const report = buildReport();
  write(outputs.contract, report.contract);
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  write(outputs.workQueueCsv, report.workQueueCsv);
  write(outputs.workQueueSummary, report.workQueueSummary);
  write(outputs.decisionsNeeded, report.decisionsNeeded);
  console.log("wrote top100 coverage contract");
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${path} is missing; run npm run top100:coverage`);
    check(readFileSync(path, "utf8") === report[name], `${path} is stale; run npm run top100:coverage`);
  }
  console.log(`verified top100 coverage for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-top100-coverage.mjs --generate
  node scripts/generate-top100-coverage.mjs --verify`);
}

function buildReport() {
  const readinessRows = parseCsvFile("data/top100-readiness/readiness.csv");
  const readinessByChart = new Map(readinessRows.map((row) => [row.chart, row]));
  const chartOutcomeByChart = new Map(parseCsvFile("data/outcome-coverage/chart-outcomes.csv").map((row) => [row.chart, row]));
  const baseRowsByChart = groupBy(parseCsvFile("data/outcome-coverage/base-outcomes.csv"), (row) => row.chart);
  const featureRowsByChart = groupBy(parseCsvFile("data/outcome-coverage/feature-outcomes.csv"), (row) => row.chart);
  const rows = readinessRows.map((row) => coverageRow(row, chartOutcomeByChart.get(row.chart) ?? {}, baseRowsByChart.get(row.chart) ?? [], featureRowsByChart.get(row.chart) ?? []));
  const workRows = workQueueRows(rows, readinessByChart);
  return {
    rows,
    workRows,
    contract: contractMarkdown(rows),
    csv: toCsv(rows),
    summary: summaryMarkdown(rows),
    workQueueCsv: toCsv(workRows),
    workQueueSummary: workQueueMarkdown(workRows),
    decisionsNeeded: decisionsNeededMarkdown(workRows),
  };
}

function coverageRow(row, chartOutcome, baseRows, featureRows) {
  const [chartName, version = ""] = row.chart.split("@");
  const recipeDir = row.recipe_path ? dirname(row.recipe_path) : "";
  const sourceLock = recipeDir ? `${recipeDir}/source-lock.yaml` : "";
  const dependencyLock = recipeDir ? `${recipeDir}/dependency-lock.yaml` : "";
  const controlPoints = recipeDir ? `${recipeDir}/control-points.yaml` : "";
  const valueModel = recipeDir ? `${recipeDir}/value-model.yaml` : "";
  const helmPlan = recipeDir ? `${recipeDir}/helm-plan.yaml` : "";
  const publicationReceipt = recipeDir ? `${recipeDir}/publication/installer-package-receipt.yaml` : "";

  const checks = {
    a: status(existsPath(row.recipe_path) && existsPath(sourceLock) && Boolean(version), sourceLock || row.recipe_path, "missing recipe source lock or chart version"),
    b: status(number(row.variant_count) > 0 && row.variants && existsPath(row.catalog_path), row.catalog_path, "no named base variant cataloged"),
    c: status(allCountPassed(row.render_parity), renderEvidence(baseRows), "not every base variant has render parity"),
    d: status(existsPath(row.helm_pain_report) && existsPath(controlPoints) && featureRows.length > 0, `${row.helm_pain_report};${controlPoints};data/outcome-coverage/feature-outcomes.csv`, "missing pain report, control points, or feature rows"),
    e: status(existsPath(controlPoints) && existsPath(valueModel) && existsPath(helmPlan), `${controlPoints};${valueModel};${helmPlan}`, "facts/control points are not fully declared in recipe artifacts"),
    f: scanDispositionStatus(row, chartOutcome, publicationReceipt),
    g: liveWitnessStatus(row, chartOutcome),
    h: status(existsPath(row.catalog_path) && existsPath("site/catalog.json"), `${row.catalog_path};site/catalog.json`, "missing catalog page or generated site catalog"),
  };
  const denominator = Object.values(checks).filter((item) => item.status !== "n-a").length;
  const passed = Object.values(checks).filter((item) => item.status === "pass").length;
  const coveragePercent = denominator === 0 ? 0 : Math.round((passed / denominator) * 100);
  const covered = Object.values(checks).every((item) => item.status === "pass" || item.status === "n-a");

  return {
    chart: chartName,
    version,
    chart_ref: row.chart,
    bucket: row.adoption_bucket,
    catalog_tier: row.catalog_tier,
    coverage_status: covered ? "covered" : "partial",
    coverage_percent: String(coveragePercent),
    next_action: covered ? "keep evidence fresh" : row.next_action,
    owner: "",
    a_pinned_version: checks.a.status,
    a_evidence: checks.a.evidence,
    b_named_base_variant: checks.b.status,
    b_evidence: checks.b.evidence,
    c_render_parity_receipt: checks.c.status,
    c_evidence: checks.c.evidence,
    d_pain_and_quirks: checks.d.status,
    d_evidence: checks.d.evidence,
    e_facts_declared: checks.e.status,
    e_evidence: checks.e.evidence,
    f_scan_and_disposition: checks.f.status,
    f_evidence: checks.f.evidence,
    g_live_witness_or_route: checks.g.status,
    g_evidence: checks.g.evidence,
    h_catalog_and_site: checks.h.status,
    h_evidence: checks.h.evidence,
  };
}

function scanDispositionStatus(row, chartOutcome, publicationReceipt) {
  const evidence = [
    publicationReceipt,
    row.next_action_source === "production-disposition" ? "data/production-disposition/summary.md" : "",
    chartOutcome.production_readiness ? "data/outcome-coverage/chart-outcomes.csv" : "",
  ].filter(Boolean).join(";");
  const top20 = row.catalog_tier === "top20-catalog-supported";
  const ready = ["production-review-ready", "supported"].includes(chartOutcome.production_readiness) || row.next_action_source === "production-disposition";
  if (top20 && ready && existsPath(publicationReceipt)) return status(true, evidence, "");
  return status(false, evidence || row.next_action_source || "data/top100-readiness/readiness.csv", "scan or production disposition not recorded for this support scope");
}

function liveWitnessStatus(row, chartOutcome) {
  const liveEvidence = [
    "live-helm-vs-confighub-parity",
    "two-cluster-kind-parity",
    "gitops-oci-live",
    "local-kubernetes-live",
  ].includes(row.strongest_evidence);
  const routed = row.hard_gap && row.hard_gap !== "-" && row.next_action_source;
  const evidence = liveEvidence
    ? "data/outcome-coverage/base-outcomes.csv;data/live-kind-parity/summary.md;data/live-helm-confighub-compare/summary.md"
    : routed
      ? `data/top100-readiness/readiness.csv;${row.next_action_source}`
      : "data/top100-readiness/readiness.csv";
  const passed = liveEvidence || routed;
  return status(passed, evidence, "no live witness receipt or routed deferral");
}

function renderEvidence(baseRows) {
  const first = baseRows.find((row) => row.variant_revision)?.variant_revision;
  return first || "data/outcome-coverage/base-outcomes.csv";
}

function status(passed, evidence, reason) {
  return {
    status: passed ? "pass" : "todo",
    evidence: evidence || reason || "",
  };
}

function contractMarkdown(rows) {
  return `# Top-100 Coverage Contract

This file defines what "covered" means for the maintained top-100 corpus.
Coverage is stricter than render parity. A chart can be useful, proof-grade,
and still only partly covered until live evidence, production disposition, or a
routed limitation exists for the declared scope.

## Contract Items

| Item | Requirement | Meaning |
| --- | --- | --- |
${contractItems.map(([key, requirement, meaning]) => `| ${key} | ${requirement} | ${meaning} |`).join("\n")}

## Status Values

| Value | Meaning |
| --- | --- |
| \`pass\` | The item has a concrete evidence path in \`coverage.csv\`. |
| \`todo\` | The item is not yet covered for the chart. Read \`next_action\`. |
| \`n-a\` | The item is not applicable to the row. Current generator rarely uses this; absence should normally be explicit work, not hidden. |

## How To Use This

Use [coverage.csv](./coverage.csv) as the work queue. A row is \`covered\` only
when all eight contract items are \`pass\` or \`n-a\`.

This is not a production support claim. Production support still needs a
target-scoped decision and fresh receipts.

## Current Aggregate

~~~text
charts: ${rows.length}
covered: ${rows.filter((row) => row.coverage_status === "covered").length}
partial: ${rows.filter((row) => row.coverage_status === "partial").length}
average coverage: ${averageCoverage(rows)}%
~~~

Regenerate:

~~~sh
npm run top100:coverage
npm run top100:coverage:verify
~~~
`;
}

function summaryMarkdown(rows) {
  const statusCounts = countBy(rows, (row) => row.coverage_status);
  const bucketCounts = countBy(rows, (row) => row.bucket);
  const itemRows = contractItems.map(([key, requirement]) => {
    const column = itemColumn(key);
    const pass = rows.filter((row) => row[column] === "pass").length;
    const todo = rows.filter((row) => row[column] === "todo").length;
    const na = rows.filter((row) => row[column] === "n-a").length;
    return [key, requirement, pass, todo, na];
  });
  const lowest = [...rows].sort((left, right) => number(left.coverage_percent) - number(right.coverage_percent) || left.chart_ref.localeCompare(right.chart_ref)).slice(0, 15);
  return `# Top-100 Coverage

This generated report applies the top-100 coverage contract to every maintained
chart. It shows where the corpus is complete and where the next work is
required.

## Summary

~~~text
charts: ${rows.length}
covered: ${statusCounts.get("covered") ?? 0}
partial: ${statusCounts.get("partial") ?? 0}
average coverage: ${averageCoverage(rows)}%
~~~

## Coverage By Item

| Item | Requirement | Pass | Todo | N/A |
| --- | --- | ---: | ---: | ---: |
${itemRows.map(([key, requirement, pass, todo, na]) => `| ${key} | ${requirement} | ${pass} | ${todo} | ${na} |`).join("\n")}

## Coverage By Bucket

| Bucket | Charts |
| --- | ---: |
${[...bucketCounts.entries()].map(([bucket, count]) => `| \`${bucket}\` | ${count} |`).join("\n")}

## Lowest Coverage Rows

| Chart | Coverage | Bucket | Next action |
| --- | ---: | --- | --- |
${lowest.map((row) => `| \`${row.chart_ref}\` | ${row.coverage_percent}% | \`${row.bucket}\` | ${escapePipes(row.next_action)} |`).join("\n")}

## Files

| File | Use |
| --- | --- |
| [contract.md](./contract.md) | Human-readable definition of covered. |
| [coverage.csv](./coverage.csv) | One row per top-100 chart with item statuses and evidence paths. |
| [work-queue.md](./work-queue.md) | Human-readable queue for the remaining 80 partial rows. |
| [work-queue.csv](./work-queue.csv) | Spreadsheet queue: promotion review, user-shaped variants, and limitation decisions. |
| [decisions-needed.md](./decisions-needed.md) | Human decision memos for limitation-decision rows. |

Regenerate:

~~~sh
npm run top100:coverage
npm run top100:coverage:verify
~~~
`;
}

function workQueueRows(rows, readinessByChart) {
  return rows
    .filter((row) => row.coverage_status !== "covered")
    .map((row) => {
      const readiness = readinessByChart.get(row.chart_ref) ?? {};
      const missing = missingItems(row);
      const queue = queueFor(row);
      return {
        queue,
        priority: priorityFor(queue, readiness),
        chart: row.chart,
        version: row.version,
        chart_ref: row.chart_ref,
        bucket: row.bucket,
        coverage_percent: row.coverage_percent,
        strongest_evidence: readiness.strongest_evidence || "",
        variants: readiness.variants || "",
        hard_gap: readiness.hard_gap || "-",
        source_features: readiness.source_features || "",
        missing_items: missing.map((item) => item.key).join(";"),
        missing_requirements: missing.map((item) => item.requirement).join(";"),
        first_step: firstStepFor(queue, readiness),
        done_when: doneWhenFor(queue),
        evidence: queueEvidenceFor(row, readiness),
        next_action: row.next_action,
        owner: "",
      };
    })
    .sort((left, right) =>
      number(left.priority) - number(right.priority)
      || number(left.coverage_percent) - number(right.coverage_percent)
      || left.chart_ref.localeCompare(right.chart_ref),
    );
}

function missingItems(row) {
  return contractItems
    .map(([key, requirement]) => ({ key, requirement, status: row[itemColumn(key)] }))
    .filter((item) => item.status === "todo");
}

function queueFor(row) {
  if (row.bucket === "limitation-decision-first") return "limitation-decision";
  if (row.bucket === "promote-after-review") return "promotion-review";
  if (row.bucket === "needs-useful-variant") return "user-shaped-variant";
  if (row.bucket === "try-from-public-catalog") return "supported-refresh";
  return "review";
}

function priorityFor(queue, readiness) {
  if (queue === "limitation-decision") return "1";
  if (queue === "promotion-review" && readiness.strongest_evidence === "two-cluster-kind-parity") return "2";
  if (queue === "promotion-review") return "3";
  if (queue === "user-shaped-variant") return "4";
  return "5";
}

function firstStepFor(queue, readiness) {
  if (queue === "limitation-decision") return `decide whether to support, disclose, defer, or block: ${readiness.hard_gap || "named limitation"}`;
  if (queue === "promotion-review") return "run catalog promotion review, choose one supported base, then add selected live evidence";
  if (queue === "user-shaped-variant") return "design one realistic base variant a Helm user would actually choose";
  if (queue === "supported-refresh") return "refresh target-scoped production support evidence";
  return "review row and choose the next evidence lane";
}

function doneWhenFor(queue) {
  if (queue === "limitation-decision") return "the limitation has a recorded support, disclosure, deferral, or blocker decision";
  if (queue === "promotion-review") return "scan/disposition evidence exists and at least one selected base has live witness or routed deferral";
  if (queue === "user-shaped-variant") return "a realistic named base variant exists and the chart moves to promotion or limitation review";
  if (queue === "supported-refresh") return "fresh target-scoped receipts support the current claim";
  return "the row has a concrete next action and evidence path";
}

function queueEvidenceFor(row, readiness) {
  return [
    row.c_evidence,
    row.d_evidence,
    row.e_evidence,
    readiness.catalog_path,
    readiness.helm_pain_report,
  ].filter(Boolean).join(";");
}

function workQueueMarkdown(workRows) {
  const queueCounts = countBy(workRows, (row) => row.queue);
  const firstRows = [...workRows].slice(0, 20);
  return `# Top-100 Coverage Work Queue

This generated file turns the strict top-100 coverage contract into the next
work queues. It is not a production support claim. It says which missing
evidence or product decision would move a partial row toward covered.

## Summary

~~~text
partial rows: ${workRows.length}
promotion-review: ${queueCounts.get("promotion-review") ?? 0}
user-shaped-variant: ${queueCounts.get("user-shaped-variant") ?? 0}
limitation-decision: ${queueCounts.get("limitation-decision") ?? 0}
supported-refresh: ${queueCounts.get("supported-refresh") ?? 0}
~~~

## Queues

| Queue | Rows | First step | Done when |
| --- | ---: | --- | --- |
${["limitation-decision", "promotion-review", "user-shaped-variant", "supported-refresh", "review"].map((queue) => `| \`${queue}\` | ${queueCounts.get(queue) ?? 0} | ${escapePipes(firstStepFor(queue, {}))} | ${escapePipes(doneWhenFor(queue))} |`).join("\n")}

## First Rows

| Priority | Queue | Chart | Coverage | Missing | First step |
| ---: | --- | --- | ---: | --- | --- |
${firstRows.map((row) => `| ${row.priority} | \`${row.queue}\` | \`${row.chart_ref}\` | ${row.coverage_percent}% | ${escapePipes(row.missing_items)} | ${escapePipes(row.first_step)} |`).join("\n")}

## Files

| File | Use |
| --- | --- |
| [work-queue.csv](./work-queue.csv) | Spreadsheet queue with every partial row. |
| [decisions-needed.md](./decisions-needed.md) | Human decision memos for limitation-decision rows. |
| [coverage.csv](./coverage.csv) | Strict item-by-item coverage contract. |
| [../top100-readiness/summary.md](../top100-readiness/summary.md) | Broader top-100 readiness view. |

Regenerate:

~~~sh
npm run top100:coverage
npm run top100:coverage:verify
~~~
`;
}

function decisionsNeededMarkdown(workRows) {
  const rows = workRows.filter((row) => row.queue === "limitation-decision");
  return `# Top-100 Decisions Needed

These rows need a human support decision before catalog promotion. The generator
does not decide the outcome. It records the evidence and the options to review.

~~~text
decision rows: ${rows.length}
~~~

${rows.map(decisionMemo).join("\n")}
`;
}

function decisionMemo(row) {
  return `## ${row.chart_ref}

Current evidence: ${row.strongest_evidence || "not recorded"}.

Named limitation: ${row.hard_gap || "-"}.

Known variants: ${row.variants || "-"}.

Source features: ${row.source_features || "-"}.

Options:

1. Support the path by adding the required base variant, lifecycle route, target fact, or live evidence.
2. Disclose the limitation and promote only the safe supported base.
3. Defer promotion until the chart has a better user-shaped path.
4. Block the path for public catalog use if it cannot be represented safely.

Next action: ${row.first_step}.

Evidence:

\`\`\`text
${row.evidence || "-"}
\`\`\`
`;
}

function itemColumn(key) {
  return {
    a: "a_pinned_version",
    b: "b_named_base_variant",
    c: "c_render_parity_receipt",
    d: "d_pain_and_quirks",
    e: "e_facts_declared",
    f: "f_scan_and_disposition",
    g: "g_live_witness_or_route",
    h: "h_catalog_and_site",
  }[key];
}

function allCountPassed(text) {
  const match = String(text ?? "").match(/^(\d+)\/(\d+)$/);
  return Boolean(match) && Number(match[1]) > 0 && Number(match[1]) === Number(match[2]);
}

function existsPath(path) {
  return Boolean(path) && existsSync(join(repoRoot, path));
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  return lines.filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function groupBy(rows, keyFn) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

function countBy(rows, keyFn) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function averageCoverage(rows) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + number(row.coverage_percent), 0) / rows.length);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}
