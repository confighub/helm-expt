#!/usr/bin/env node

// Top-100 APIService coverage bridge.
//
// APIService objects are rendered configuration, but the important runtime
// question is whether Kubernetes API aggregation and TLS readiness work after
// apply. This report separates source detection, recipe/model coverage,
// object/workload observation, live parity, and the remaining aggregated API
// availability receipt.
//
//   node scripts/generate-apiservice-coverage.mjs --generate
//   node scripts/generate-apiservice-coverage.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "apiservice-coverage");
const outputs = {
  csv: join(outputRoot, "top100-apiservice-coverage.csv"),
  summary: join(outputRoot, "summary.md"),
};

const knownReceipts = {
  "metrics-server/metrics-server@3.13.0": {
    localObservation: "runs/top20-local-kind/metrics-server-default/observation-receipt.json",
    objectSet: "runs/top20-local-kind/metrics-server-default/cub-scout.object-set.receipt.json",
    workload: "runs/top20-local-kind/metrics-server-default/cub-scout.workloads.receipt.json",
    liveParity: "runs/live-helm-confighub-compare/metrics-server-metrics-server-default/receipt.yaml",
    kindParity: [
      "runs/live-kind-parity/metrics-server-metrics-server-default/receipt.yaml",
      "runs/live-kind-parity/metrics-server-metrics-server-external-tls-ca/receipt.yaml",
    ],
  },
  "kedacore/keda@2.19.0": {
    kindParity: [
      "runs/live-kind-parity/kedacore-keda-default/receipt.yaml",
    ],
  },
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run apiservice:coverage`);
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run apiservice:coverage`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run apiservice:coverage`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run apiservice:coverage`);
  console.log(`verified APIService coverage for ${report.rows.length} top100 source row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-apiservice-coverage.mjs --generate
  node scripts/generate-apiservice-coverage.mjs --verify`);
}

function buildReport() {
  const sourceRows = JSON.parse(readFileSync(join(repoRoot, "data/top500-catalog-analysis/source/source-feature-scan.raw.json"), "utf8"))
    .filter((row) => row.scanStatus === "scanned" && Number(row.rank) <= 100 && Number(row.apiServices ?? 0) > 0)
    .sort((left, right) => Number(left.rank) - Number(right.rank));
  const reviewRows = parseCsvFile("data/top100-catalog-analysis/review.csv");
  const quirkRows = parseCsvFile("data/quirk-work-queue/top100-queue.csv");
  const reviewByChart = new Map(reviewRows.map((row) => [row.chart, row]));
  const quirkByRef = new Map(quirkRows.map((row) => [`${row.chart}@${row.source_version}`, row]));

  check(sourceRows.length === 5, `expected 5 source top100 APIService rows; found ${sourceRows.length}`);

  const rows = sourceRows.map((source) => rowFor(source, reviewByChart.get(source.chart), quirkByRef.get(`${source.chart}@${source.version}`)));
  const aggregationRows = rows.filter((row) => row.api_aggregation_observed === "yes");

  check(rows.some((row) => row.coverage_status === "object-and-workload-observed"), "expected Metrics Server object/workload observation row");
  check(aggregationRows.length === 0, "unexpected API aggregation availability claim; add a receipt before changing this status");

  return {
    rows,
    csv: toCsv(rows),
    summary: summaryMarkdown(rows),
  };
}

function rowFor(source, review, quirk) {
  const ref = `${source.chart}@${source.version}`;
  const receipts = knownReceipts[ref] ?? {};
  const local = receiptExists(receipts.localObservation) && observationHasPassCheck(receipts.localObservation, "apiservice-");
  const objectSet = receiptExists(receipts.objectSet) && objectSetHasAPIService(receipts.objectSet);
  const workload = receiptExists(receipts.workload) && receiptVerdict(receipts.workload) === "PASS";
  const liveParity = receiptExists(receipts.liveParity);
  const kindParity = (receipts.kindParity ?? []).filter(receiptExists);
  const hasRecipe = Boolean(review?.recipe_path);
  const coverageStatus = coverageStatusFor({ hasRecipe, local, objectSet, workload, liveParity, kindParity });
  return {
    rank: source.rank,
    chart: source.chart,
    source_version: source.version,
    api_service_count: String(source.apiServices ?? ""),
    catalog_status: review?.catalog_status ?? "not-in-modeled-top100",
    proof_surface: review?.proof_surface ?? "",
    modeled_version: review?.version ?? "",
    coverage_status: coverageStatus,
    api_object_observed: objectSet || local ? "yes" : "no",
    workload_observed: workload ? "yes" : "no",
    live_parity_observed: liveParity ? "yes" : "no",
    two_cluster_parity_observed: kindParity.length > 0 ? "yes" : "no",
    api_aggregation_observed: "no",
    evidence: evidenceFor({ review, quirk, receipts, kindParity }),
    next_action: nextActionFor({ ref, hasRecipe, coverageStatus }),
    limitation: "APIService object evidence is not the same as Kubernetes API aggregation availability. Close this with an explicit Available=True or aggregated API query receipt.",
  };
}

function coverageStatusFor({ hasRecipe, local, objectSet, workload, liveParity, kindParity }) {
  if (local && objectSet && workload && liveParity && kindParity.length > 0) return "object-and-workload-observed";
  if (hasRecipe && kindParity.length > 0) return "two-cluster-parity-only";
  if (hasRecipe) return "modeled-needs-runtime-observation";
  return "source-detected-needs-recipe";
}

function nextActionFor({ ref, hasRecipe, coverageStatus }) {
  if (ref === "metrics-server/metrics-server@3.13.0") {
    return "add API aggregation availability receipt for v1beta1.metrics.k8s.io, then remove the catalog-visible APIService hard gap if the receipt passes";
  }
  if (coverageStatus === "two-cluster-parity-only") {
    return "add local/APIService observation and aggregated API availability receipt before catalog promotion or stronger runtime claims";
  }
  if (hasRecipe) {
    return "add runtime APIService observation route and aggregated API availability receipt for the selected base";
  }
  return "create recipe/import candidate, then model APIService readiness and aggregation observation before catalog claims";
}

function evidenceFor({ review, quirk, receipts, kindParity }) {
  return [
    "data/top500-catalog-analysis/source/source-feature-scan.raw.json",
    quirk ? "data/quirk-work-queue/top100-queue.csv" : "",
    review?.recipe_path,
    receipts.localObservation,
    receipts.objectSet,
    receipts.workload,
    receipts.liveParity,
    ...kindParity,
  ].filter(Boolean).join(";");
}

function summaryMarkdown(rows) {
  const counts = countBy(rows, (row) => row.coverage_status);
  const catalogRows = rows.filter((row) => row.catalog_status === "catalog-supported");
  const sourceOnlyRows = rows.filter((row) => row.coverage_status === "source-detected-needs-recipe");
  const aggregationRows = rows.filter((row) => row.api_aggregation_observed === "yes");
  const statusRows = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return `# Top-100 APIService Coverage

This generated report joins the source-scan APIService signal to maintained
recipe/package rows and committed runtime evidence.

APIService objects need a stricter runtime contract than ordinary rendered
objects. The desired object can match while Kubernetes API aggregation, CA
trust, or backing service readiness still fails. This report therefore keeps
four facts separate:

~~~text
rendered APIService object observed
backing workload observed
Helm-vs-ConfigHub live parity observed
aggregated API availability observed
~~~

## Current Reading

~~~text
source top-100 APIService rows:          ${rows.length}
catalog-supported APIService rows:       ${catalogRows.length}
rows with object/workload observation:   ${rows.filter((row) => row.coverage_status === "object-and-workload-observed").length}
rows with two-cluster parity only:       ${rows.filter((row) => row.coverage_status === "two-cluster-parity-only").length}
rows still source-detected only:         ${sourceOnlyRows.length}
aggregated API availability receipts:    ${aggregationRows.length}
~~~

No row currently claims aggregated API availability. That is intentional. Add a
receipt that proves an \`Available=True\` APIService condition or a successful
query against the aggregated API before changing that claim.

## Coverage Status

| Status | Rows |
| --- | ---: |
${statusRows.map(([status, count]) => `| \`${status}\` | ${count} |`).join("\n")}

## Source Top-100 Rows

| Rank | Chart | Source version | Status | Object observed | Workload observed | Live parity | Aggregation observed | Next action |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.rank} | \`${row.chart}\` | ${row.source_version} | \`${row.coverage_status}\` | ${row.api_object_observed} | ${row.workload_observed} | ${row.live_parity_observed} | ${row.api_aggregation_observed} | ${escapePipes(row.next_action)} |`).join("\n")}

## How To Use This

- \`object-and-workload-observed\` means the APIService object and backing
  workload were observed in committed receipts. It is still not an aggregated
  API availability claim.
- \`two-cluster-parity-only\` means regular Helm and \`cub installer\` reached
  live semantic parity, but there is no dedicated APIService observation.
- \`modeled-needs-runtime-observation\` means recipe proof exists, but runtime
  APIService evidence is missing.
- \`source-detected-needs-recipe\` means the source scan found an APIService,
  but the chart is not yet a maintained recipe/package row.

## Files

| File | Purpose |
| --- | --- |
| \`top100-apiservice-coverage.csv\` | One row per source top-100 chart that renders APIService objects. |
| \`data/quirk-work-queue/top100-queue.csv\` | Source quirk queue that currently carries the APIService hard gap. |
| \`runs/top20-local-kind/metrics-server-default/observation-receipt.json\` | Metrics Server object/workload observation evidence. |
| \`runs/live-kind-parity/*/receipt.yaml\` | Two-cluster Helm-vs-\`cub installer\` parity evidence. |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
`;
}

function receiptExists(path) {
  return Boolean(path) && existsSync(join(repoRoot, path));
}

function observationHasPassCheck(path, prefix) {
  if (!receiptExists(path)) return false;
  const receipt = JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  return (receipt.spec?.checks ?? []).some((checkItem) => checkItem.result === "pass" && String(checkItem.name ?? "").startsWith(prefix));
}

function objectSetHasAPIService(path) {
  if (!receiptExists(path)) return false;
  const receipt = JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  return (receipt.predicate?.evidence?.objectSet?.objects ?? []).some((object) =>
    object.status === "matched" && object.id?.kind === "APIService"
  );
}

function receiptVerdict(path) {
  if (!receiptExists(path)) return "";
  const receipt = JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  return String(receipt.predicate?.verdict ?? "");
}

function parseCsvFile(path) {
  const full = join(repoRoot, path);
  const text = readFileSync(full, "utf8").trim();
  if (!text) return [];
  const rows = parseCsv(text);
  const headers = rows[0] ?? [];
  return rows.slice(1).map((cols) => Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (quote) {
      if (ch === "\"" && text[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (ch === "\"") {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === "\"") {
      quote = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function countBy(rows, keyFn) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
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
