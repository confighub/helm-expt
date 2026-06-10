import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
} from "./lib/proof-common.mjs";

const outDir = join(repoRoot, "data", "top100-promotion-wave");
const wavePath = join(outDir, "wave.yaml");
const csvPath = join(outDir, "wave.csv");
const summaryPath = join(outDir, "summary.md");
const workOrdersPath = join(outDir, "work-orders.md");
const workOrdersCsvPath = join(outDir, "work-orders.csv");
const workQueuePath = join(repoRoot, "data", "top100-coverage", "work-queue.csv");
const catalogReviewPath = join(repoRoot, "data", "catalog-promotion-review", "review.csv");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const report = buildReport();
  write(wavePath, report.yaml);
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  write(workOrdersPath, report.workOrders);
  write(workOrdersCsvPath, report.workOrdersCsv);
  console.log(`wrote ${relativeRepo(wavePath)}`);
  console.log(`wrote ${relativeRepo(csvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
  console.log(`wrote ${relativeRepo(workOrdersPath)}`);
  console.log(`wrote ${relativeRepo(workOrdersCsvPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(wavePath), "missing top100 promotion wave YAML; run npm run top100:promotion-wave");
  check(existsSync(csvPath), "missing top100 promotion wave CSV; run npm run top100:promotion-wave");
  check(existsSync(summaryPath), "missing top100 promotion wave summary; run npm run top100:promotion-wave");
  check(existsSync(workOrdersPath), "missing top100 promotion wave work orders; run npm run top100:promotion-wave");
  check(existsSync(workOrdersCsvPath), "missing top100 promotion wave work order CSV; run npm run top100:promotion-wave");
  check(readFileSync(wavePath, "utf8") === report.yaml, "top100 promotion wave YAML is stale");
  check(readFileSync(csvPath, "utf8") === report.csv, "top100 promotion wave CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "top100 promotion wave summary is stale");
  check(readFileSync(workOrdersPath, "utf8") === report.workOrders, "top100 promotion wave work orders are stale");
  check(readFileSync(workOrdersCsvPath, "utf8") === report.workOrdersCsv, "top100 promotion wave work order CSV is stale");
  console.log(`verified top100 promotion wave for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-top100-promotion-wave.mjs --generate
  node scripts/generate-top100-promotion-wave.mjs --verify`);
}

function buildReport() {
  const workRows = parseCsvFile(workQueuePath);
  const reviewByChart = new Map(parseCsvFile(catalogReviewPath).map((row) => [row.chart, row]));
  const rows = workRows
    .filter((row) => row.queue === "promotion-review" && row.priority === "2")
    .map((row) => waveRow(row, reviewByChart.get(row.chart_ref)))
    .sort((left, right) => Number(left.priority) - Number(right.priority) || left.chart_ref.localeCompare(right.chart_ref));
  check(rows.length > 0, "expected at least one priority-2 top100 promotion row");
  check(rows.every((row) => row.strongest_evidence === "two-cluster-kind-parity"), "priority-2 promotion wave rows must already have two-cluster parity evidence");
  check(rows.every((row) => splitList(row.missing_items).includes("f") || row.missing_requirements.includes("production disposition")), "priority-2 promotion wave rows must include production disposition as a missing item");
  return {
    rows,
    yaml: `${toYaml(waveYaml(rows))}\n`,
    csv: rowsToCsv(rows),
    summary: summary(rows),
    workOrders: workOrdersMarkdown(rows),
    workOrdersCsv: workOrdersToCsv(workOrders(rows)),
  };
}

function waveRow(row, review) {
  check(review, `missing catalog promotion review row for ${row.chart_ref}`);
  const catalogPath = `recipes/${row.chart}/${row.version}/catalog-status.yaml`;
  const catalogStatus = existsSync(join(repoRoot, catalogPath)) ? readYaml(join(repoRoot, catalogPath)) : null;
  return {
    priority: row.priority,
    chart: row.chart,
    version: row.version,
    chart_ref: row.chart_ref,
    variants: row.variants,
    strongest_evidence: row.strongest_evidence,
    source_features: row.source_features,
    scan_high: review.scan_high,
    scan_medium: review.scan_medium,
    gate_decisions: review.gate_decisions,
    current_support_level: review.support_level,
    current_production_readiness: review.production_readiness,
    current_catalog_status: catalogStatus?.spec?.status ?? review.promotion_state,
    supported_variants: (catalogStatus?.spec?.supportedVariants ?? []).join(";"),
    missing_items: row.missing_items,
    missing_requirements: row.missing_requirements,
    promotion_question: "Which variant, target scope, scan/gate dispositions, and live evidence are enough to promote this chart?",
    first_step: "review the existing variants, then write production disposition or support-decision artifacts before changing catalog status",
    done_when: "a selected variant has explicit scan/gate disposition, production support boundary, and live evidence or routed deferral",
    evidence: row.evidence,
    gaps: review.gaps,
    recipe_path: review.recipe_path,
    package_path: review.package_path,
  };
}

function waveYaml(rows) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Top100PromotionWave",
    metadata: {
      name: "strict-priority-2-promotion-review",
      generatedBy: "scripts/generate-top100-promotion-wave.mjs",
    },
    spec: {
      sourceQueue: relativeRepo(workQueuePath),
      sourceReview: relativeRepo(catalogReviewPath),
      scope:
        "Priority-2 top100 rows: proof-grade charts with multiple variants and two-cluster kind parity, but no production disposition yet.",
      boundary:
        "This wave is a promotion review queue, not a catalog support claim. Promotion still requires explicit support decisions and current target-scoped evidence.",
      rows: rows.map((row) => ({
        chart: row.chart,
        version: row.version,
        variants: splitList(row.variants),
        strongestEvidence: row.strongest_evidence,
        sourceFeatures: splitList(row.source_features),
        scan: {
          high: Number(row.scan_high),
          medium: Number(row.scan_medium),
          gateDecisions: splitList(row.gate_decisions),
        },
        currentState: {
          supportLevel: row.current_support_level,
          productionReadiness: row.current_production_readiness,
          catalogStatus: row.current_catalog_status,
          supportedVariants: splitList(row.supported_variants),
        },
        gaps: splitList(row.gaps),
        firstStep: row.first_step,
        doneWhen: row.done_when,
        evidence: splitList(row.evidence),
      })),
    },
  };
}

function summary(rows) {
  const featureCounts = countFeatures(rows);
  return `# Top-100 Promotion Wave

This generated wave is the first strict promotion-review slice from the
top-100 coverage queue.

It selects proof-grade charts that already have:

- multiple named variants;
- two-cluster kind parity evidence;
- no named limitation blocking review.

Catalog support still requires a human promotion decision, production
disposition, and a current support boundary for each row.

## Summary

~~~text
wave rows: ${rows.length}
two-cluster parity rows: ${rows.filter((row) => row.strongest_evidence === "two-cluster-kind-parity").length}
missing item: scan and production disposition
~~~

## Selected Rows

| Chart | Variants | Scan/gate | Feature focus | First step |
| --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart_ref}\` | ${escapePipes(row.variants)} | high=${row.scan_high}, medium=${row.scan_medium}, gates=${escapePipes(row.gate_decisions)} | ${escapePipes(row.source_features || "-")} | ${escapePipes(row.first_step)} |`).join("\n")}

## Review Details

This table is the first promotion-review work packet. It shows what is known,
what is missing, and what must be true before the chart can become a catalog
offer.

| Chart | Current state | Gaps to review | Done when |
| --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart_ref}\` | ${escapePipes(currentState(row))} | ${escapePipes(formatGaps(row.gaps))} | ${escapePipes(row.done_when)} |`).join("\n")}

## Feature Mix

| Feature | Rows |
| --- | ---: |
${[...featureCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([feature, count]) => `| \`${feature}\` | ${count} |`).join("\n")}

## Promotion Review Checklist

For each row:

1. Pick the variant that is a real user path, not merely a rendered baseline.
2. Review the scan and install-gate warnings for that variant.
3. Record accepted, patched, deferred, or blocked dispositions.
4. Name the support scope and delivery path.
5. Link live evidence or write a routed deferral if live proof is not applicable yet.
6. Only then update catalog support status.

## Files

| File | Use |
| --- | --- |
| [wave.csv](./wave.csv) | Spreadsheet queue for the selected promotion-review rows. |
| [wave.yaml](./wave.yaml) | Machine-readable wave input for future tooling. |
| [fast-track.md](./fast-track.md) | Low-residue promotion-review subset with clean scan/gate state. |
| [fast-track.csv](./fast-track.csv) | Spreadsheet form of the fast-track subset. |
| [work-orders.md](./work-orders.md) | Assignable chart-by-chart review tasks for the first promotion wave. |
| [work-orders.csv](./work-orders.csv) | Spreadsheet form of the promotion review work orders. |
| [../top100-coverage/work-queue.md](../top100-coverage/work-queue.md) | Full strict top-100 work queue. |
| [../catalog-promotion-review/summary.md](../catalog-promotion-review/summary.md) | Machine proof and product gaps for all 100 recipes. |

Regenerate:

~~~sh
npm run top100:promotion-wave
npm run top100:promotion-wave:verify
~~~
`;
}

function rowsToCsv(rows) {
  const headers = [
    "priority",
    "chart",
    "version",
    "chart_ref",
    "variants",
    "strongest_evidence",
    "source_features",
    "scan_high",
    "scan_medium",
    "gate_decisions",
    "current_support_level",
    "current_production_readiness",
    "current_catalog_status",
    "supported_variants",
    "promotion_question",
    "first_step",
    "done_when",
    "evidence",
    "gaps",
    "recipe_path",
    "package_path",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function workOrdersMarkdown(rows) {
  const orders = workOrders(rows);
  return `# Top-100 Promotion Wave Work Orders

These generated work orders turn the first promotion wave into assignable
review tasks. They do not promote any chart by themselves.

Each chart is already proof-grade and has two-cluster kind parity evidence.
Promotion still requires selecting the user-facing base, closing scan/gate and
lifecycle questions, choosing the support scope, and linking live evidence or a
routed deferral.

## Summary

~~~text
charts: ${rows.length}
work orders: ${orders.length}
~~~

## Work Orders By Chart

${rows.map((row) => chartWorkOrderSection(row, orders.filter((order) => order.chart_ref === row.chart_ref))).join("\n\n")}

## Spreadsheet

Use [work-orders.csv](./work-orders.csv) for assignment, filtering, and status
tracking.
`;
}

function chartWorkOrderSection(row, orders) {
  return `### ${row.chart_ref}

Variants: \`${row.variants || "-"}\`<br>
Evidence: \`${row.strongest_evidence}\`<br>
Feature focus: \`${row.source_features || "-"}\`<br>
Current state: ${currentState(row)}

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
${orders.map((order) => `| ${order.order} | ${order.work_type} | ${order.reviewer} | ${escapePipes(order.done_when)} |`).join("\n")}`;
}

function workOrders(rows) {
  return rows.flatMap((row) => {
    let order = 1;
    const add = (workType, reviewer, reason, doneWhen, evidence) => ({
      chart: row.chart,
      version: row.version,
      chart_ref: row.chart_ref,
      order: order++,
      work_type: workType,
      reviewer,
      reason,
      done_when: doneWhen,
      evidence,
    });
    const features = new Set(splitList(row.source_features));
    const chartOrders = [
      add(
        "variant-selection",
        "catalog reviewer",
        "Confirm the promoted base is a real Helm-user path, not merely the first rendered baseline.",
        `A selected variant is named from ${row.variants || "the chart variants"} and the non-selected variants have a written promote/defer reason.`,
        `${row.recipe_path}/CATALOG.md`,
      ),
      add(
        "scan-and-gate-disposition",
        "security reviewer",
        `Scan/gate state is high=${row.scan_high}, medium=${row.scan_medium}, gates=${row.gate_decisions || "-"}.`,
        "Every warning is fixed, accepted with rationale, or routed to a narrower base before catalog support.",
        "data/catalog-promotion-review/review.csv",
      ),
    ];
    if (features.has("crds")) {
      chartOrders.push(add(
        "crd-lifecycle",
        "platform reviewer",
        "The chart includes CRDs or CRD-like lifecycle concerns.",
        "CRD install, upgrade, ownership, and no-CRDs behavior are recorded or explicitly deferred for the selected base.",
        `${row.recipe_path}/helm-pain-report.yaml`,
      ));
    }
    if (features.has("webhooks")) {
      chartOrders.push(add(
        "webhook-readiness",
        "platform reviewer",
        "The chart includes webhook resources or webhook runtime dependencies.",
        "Webhook readiness, CA/material injection, failure policy, and observation path are recorded or explicitly deferred.",
        `${row.recipe_path}/helm-pain-report.yaml`,
      ));
    }
    if (features.has("stateful-storage")) {
      chartOrders.push(add(
        "storage-and-rollback-policy",
        "operator reviewer",
        "The chart has persistent or stateful behavior.",
        "Storage class assumptions, PVC behavior, backup/rollback boundary, and destructive-change policy are written for the selected base.",
        `${row.recipe_path}/helm-pain-report.yaml`,
      ));
    }
    if (features.has("generated-facts")) {
      chartOrders.push(add(
        "generated-fact-policy",
        "catalog reviewer",
        "The chart has generated or once-only values that can affect repeatability.",
        "Generated facts are persisted, replaced by target facts, or explicitly scoped out of the promoted base.",
        `${row.recipe_path}/control-points.yaml`,
      ));
    }
    if (features.has("cluster-rbac")) {
      chartOrders.push(add(
        "rbac-scope",
        "security reviewer",
        "The chart creates cluster-scoped RBAC or similar permissions.",
        "Cluster permissions are accepted for the support scope or a narrower base is selected.",
        `${row.recipe_path}/helm-pain-report.yaml`,
      ));
    }
    if (features.has("tpl") || features.has("capabilities")) {
      chartOrders.push(add(
        "template-and-capability-boundary",
        "catalog reviewer",
        "The chart has template-powered inputs or Kubernetes capability branches.",
        "The supported values, capability profile, and extension-slot policy are catalog-readable for the selected base.",
        `${row.recipe_path}/helm-plan.yaml`,
      ));
    }
    chartOrders.push(
      add(
        "selected-live-evidence",
        "operator reviewer",
        "Two-cluster kind parity exists; catalog promotion needs the selected runtime evidence boundary.",
        "The selected base has linked live evidence, GitOps/OCI evidence, live parity evidence, or a routed deferral with rationale.",
        "data/live-kind-parity/summary.csv",
      ),
      add(
        "target-scoped-support-decision",
        "catalog owner",
        "Catalog support is not implied by machine proof.",
        "A target-scoped support decision exists with supported, deferred, superseded, or blocked outcome.",
        "data/production-support-decisions/summary.md",
      ),
    );
    return chartOrders;
  });
}

function workOrdersToCsv(rows) {
  const headers = ["chart", "version", "chart_ref", "order", "work_type", "reviewer", "reason", "done_when", "evidence"];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(path, "utf8"));
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
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === "\"" && line[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      result.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  result.push(cell);
  return result;
}

function countFeatures(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const feature of splitList(row.source_features)) {
      counts.set(feature, (counts.get(feature) ?? 0) + 1);
    }
  }
  return counts;
}

function currentState(row) {
  return [
    `support=${row.current_support_level || "-"}`,
    `production=${row.current_production_readiness || "-"}`,
    `catalog=${row.current_catalog_status || "-"}`,
  ].join("; ");
}

function formatGaps(value) {
  const gaps = splitList(value);
  return gaps.length ? gaps.join("<br>") : "-";
}

function splitList(value) {
  return String(value ?? "").split(";").map((item) => item.trim()).filter(Boolean);
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}
