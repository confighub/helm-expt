import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "top100-catalog-analysis");
const rawPath = join(outputRoot, "raw.json");
const reviewCsvPath = join(outputRoot, "review.csv");
const summaryPath = join(outputRoot, "summary.md");
const top500RawPath = join(repoRoot, "data", "top500-catalog-analysis", "raw.json");
const productionDispositionPath = join(repoRoot, "data", "production-disposition", "top20.csv");
const latestRefreshPath = join(repoRoot, "data", "latest-top20-refresh", "review.csv");
const chartFactsPath = join(repoRoot, "data", "chart-facts", "chart-facts.json");
const chartFacts = existsSync(chartFactsPath) ? JSON.parse(readFileSync(chartFactsPath, "utf8")) : {};
const notYetEnabledFor = (chart) => chartFacts[String(chart).split("@")[0].split("/").slice(0, 2).join("/")]?.not_yet_enabled ?? "";
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const report = buildReport();
  write(rawPath, report.rawJson);
  write(reviewCsvPath, report.reviewCsv);
  write(summaryPath, report.summaryText);
  console.log(`wrote ${relativeRepo(rawPath)}`);
  console.log(`wrote ${relativeRepo(reviewCsvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(rawPath), "missing top100 catalog analysis raw JSON; run npm run top100:catalog");
  check(existsSync(reviewCsvPath), "missing top100 catalog analysis review CSV; run npm run top100:catalog");
  check(existsSync(summaryPath), "missing top100 catalog analysis summary; run npm run top100:catalog");
  check(readFileSync(rawPath, "utf8") === report.rawJson, "top100 catalog analysis raw JSON is stale");
  check(readFileSync(reviewCsvPath, "utf8") === report.reviewCsv, "top100 catalog analysis review CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summaryText, "top100 catalog analysis summary is stale");
  console.log("verified top100 catalog analysis outputs");
} else {
  console.log(`Usage:
  node scripts/generate-top100-catalog-analysis.mjs --generate
  node scripts/generate-top100-catalog-analysis.mjs --verify`);
}

function buildReport() {
  const top500 = JSON.parse(readFileSync(top500RawPath, "utf8"));
  check(Array.isArray(top500.rows), "top500 raw JSON must contain rows");
  const top500ByChart = new Map(top500.rows.map((row) => [row.chart, row]));
  const productionRows = parseCsv(readFileSync(productionDispositionPath, "utf8"));
  const productionByChart = new Map(productionRows.map((row, index) => [row.chart, { ...row, top20_rank: index + 1 }]));
  const latestRows = parseCsv(readFileSync(latestRefreshPath, "utf8"));
  const latestByChart = new Map(latestRows.map((row) => [row.chart, row]));
  const entries = artifactEntries({ top500ByChart, productionByChart, latestByChart });
  check(entries.length === 100, `expected 100 top100 proof entries; found ${entries.length}`);
  const summary = summarize(entries);
  return {
    entries,
    summary,
    rawJson: `${JSON.stringify({ generatedBy: "scripts/generate-top100-catalog-analysis.mjs", summary, entries }, null, 2)}\n`,
    reviewCsv: toCsv(entries, reviewHeaders()),
    summaryText: toSummary(summary, entries),
  };
}

function artifactEntries({ top500ByChart, productionByChart, latestByChart }) {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/artifact-index.yaml"))
    .sort()
    .map((indexPath) => {
      const root = dirname(indexPath);
      const index = readYaml(indexPath);
      const spec = index.spec ?? {};
      const chart = spec.chart?.ref ?? "";
      const status = spec.catalogStatus ?? {};
      const variants = spec.variants ?? [];
      const startVariant = variants.find((variant) => variant.packageBase?.default) ?? variants[0] ?? {};
      const production = productionByChart.get(chart);
      const latest = latestByChart.get(chart);
      const top500Row = top500ByChart.get(chart);
      const proofSurface = production ? "top20-catalog-supported" : "next80-proof-grade";
      return {
        proof_surface: proofSurface,
        proof_surface_rank: 0,
        top20_rank: production?.top20_rank ?? "",
        top500_rank: top500Row?.rank ?? "",
        chart,
        version: spec.chart?.version ?? "",
        latest_version: latest?.latest_version ?? "",
        latest_status: latest?.status ?? "",
        catalog_status: status.status ?? "",
        support_level: status.supportLevel ?? "",
        production_readiness: status.productionReadiness ?? "",
        supported_scopes: (status.supportedScopes ?? []).join(";"),
        supported_variants: (status.supportedVariants ?? []).join(";"),
        candidate_variants: (status.candidateVariants ?? []).join(";"),
        variant_count: variants.length,
        start_variant: startVariant.name ?? "",
        namespace: startVariant.namespace ?? "",
        source_features: top500Row?.source_features ?? "",
        source_classification: top500Row?.source_classification ?? "",
        top500_next_action: top500Row?.next_action ?? "",
        not_yet_enabled: notYetEnabledFor(chart),
        package_path: spec.installerPackage?.path ?? "",
        recipe_path: spec.recipe?.path ?? relativeRepo(root),
        catalog_path: relativeRepo(join(root, "CATALOG.md")),
        helm_pain_report: spec.recipe?.helmPainReport ?? "",
      };
    })
    .sort((left, right) => sortKey(left).localeCompare(sortKey(right)))
    .map((entry, index) => ({ ...entry, proof_surface_rank: index + 1 }));
}

function sortKey(entry) {
  if (entry.top20_rank) return `0-${String(entry.top20_rank).padStart(3, "0")}-${entry.chart}`;
  if (entry.top500_rank) return `1-${String(entry.top500_rank).padStart(3, "0")}-${entry.chart}`;
  return `2-${entry.chart}`;
}

function summarize(entries) {
  return {
    rows: entries.length,
    top20CatalogSupported: entries.filter((entry) => entry.proof_surface === "top20-catalog-supported").length,
    next80ProofGrade: entries.filter((entry) => entry.proof_surface === "next80-proof-grade").length,
    catalogSupported: entries.filter((entry) => entry.catalog_status === "catalog-supported").length,
    proofGrade: entries.filter((entry) => entry.catalog_status === "proof-grade").length,
    multiVariant: entries.filter((entry) => Number(entry.variant_count) > 1).length,
    defaultOnly: entries.filter((entry) => Number(entry.variant_count) === 1).length,
    latestCurrent: entries.filter((entry) => entry.latest_status === "current").length,
    latestUpdateAvailable: entries.filter((entry) => entry.latest_status === "update-available").length,
    productionBlocked: entries.filter((entry) => entry.production_readiness === "blocked-by-current-scan-gate").length,
    top500Matched: entries.filter((entry) => entry.top500_rank !== "").length,
    noHardGap: entries.filter((entry) => String(entry.not_yet_enabled ?? "").startsWith("—")).length,
    hardGap: entries.filter((entry) => !String(entry.not_yet_enabled ?? "").startsWith("—")).length,
  };
}

function toSummary(summary, entries) {
  const top20Updates = entries.filter((entry) => entry.latest_status === "update-available");
  const next80Promotions = entries
    .filter((entry) => entry.proof_surface === "next80-proof-grade")
    .filter((entry) => Number(entry.top500_rank || 9999) <= 50)
    .slice(0, 10);
  return `# Top-100 Catalog Analysis

This is the generated proof-surface view for the 100 maintained public Helm
chart recipes in this repo.

It is different from the top-500 matrix:

\`\`\`text
top-100 = maintained recipe/package proof artifacts in this repo
top-500 = source-feature reconnaissance plus any matching recipe proof
\`\`\`

## Summary

\`\`\`text
rows: ${summary.rows}
top-20 catalog-supported entries: ${summary.top20CatalogSupported}
next-80 proof-grade entries: ${summary.next80ProofGrade}
catalog-supported: ${summary.catalogSupported}
proof-grade: ${summary.proofGrade}
multi-variant entries: ${summary.multiVariant}
default-only entries: ${summary.defaultOnly}
top-20 current with latest upstream: ${summary.latestCurrent}
top-20 update candidates: ${summary.latestUpdateAvailable}
production-blocked entries: ${summary.productionBlocked}
entries matched to top-500 source rows: ${summary.top500Matched}
no hard gap in chart-facts: ${summary.noHardGap}
hard gap for at least one recommended capability: ${summary.hardGap}
\`\`\`

## Interpretation

- The top-20 entries are the public catalog-supported lane for the declared
  \`local-test\` scope.
- The next-80 entries are proof-grade. They have deterministic recipe/package
  proof artifacts, but they still need user-shaped variants and promotion review
  before support is claimed.
- Latest-version currentness is tracked only for the top-20 catalog-supported
  lane at the moment. The broader top-100 currentness lane should wait until
  the current top-20 update candidates are promoted or explicitly deferred.

## Readiness Tiers

The top-100 should be read as four overlapping readiness views, not one blanket
claim.

| Tier | Count | Meaning |
| --- | ---: | --- |
| Recipe/package proof exists | ${summary.rows} | The chart has a maintained recipe and executable \`cub installer\` package with proof artifacts. |
| Catalog-supported for local-test | ${summary.top20CatalogSupported} | The chart is in the public top-20 lane with local kind live/e2e and ConfigHub proof receipts. |
| Proof-grade, not catalog-supported | ${summary.next80ProofGrade} | The chart has deterministic proof artifacts but still needs user-shaped variants and promotion review. |
| Variant-rich | ${summary.multiVariant} | The chart has more than one base variant. |
| Default-only | ${summary.defaultOnly} | The chart has a proof path, but not enough variants for common user choices. |
| No hard gap in chart-facts | ${summary.noHardGap} | Recommended capabilities are built, not applicable, or have a known path. |
| Hard gap for a recommended capability | ${summary.hardGap} | The core recipe may still work, but at least one useful capability is not yet enabled. See \`data/chart-facts/summary.md\`. |

In plain English:

\`\`\`text
works now under declared proof scope
  100 charts have recipe/package proof artifacts.

works for the public local-test catalog
  20 charts have top-20 catalog support and live/e2e receipts.

works, but still needs user-shaped product review
  80 charts are proof-grade but not catalog-supported.

works only with a named limitation or user/operator help
  ${summary.hardGap} charts have at least one hard gap for a recommended extra capability.
\`\`\`

The hard-gap column is about missing recommended capabilities, not total chart
failure. For example, a chart may have a working default recipe while still
lacking an \`existing-secret\`, \`no-crds\`, or HA path for a specific variant.

## Top-20 Update Candidates

| Chart | Supported version | Latest version | Variants | Required action |
| --- | --- | --- | --- | --- |
${top20Updates.map((entry) => `| \`${entry.chart}\` | \`${entry.version}\` | \`${entry.latest_version}\` | ${entry.supported_variants} | Run full promotion lanes before replacing the supported version. |`).join("\n")}

## High-Rank Next-80 Promotion Candidates

These rows already have proof-grade artifacts and appear high in the source
catalog reconnaissance. They need real variants before catalog support.

| Proof rank | Top-500 rank | Chart | Version | Source features |
| ---: | ---: | --- | --- | --- |
${next80Promotions.map((entry) => `| ${entry.proof_surface_rank} | ${entry.top500_rank} | \`${entry.chart}\` | \`${entry.version}\` | ${entry.source_features || "not matched"} |`).join("\n")}

## Outputs

\`\`\`text
data/top100-catalog-analysis/raw.json
data/top100-catalog-analysis/review.csv
data/top100-catalog-analysis/summary.md
\`\`\`
`;
}

function reviewHeaders() {
  return [
    "proof_surface_rank",
    "proof_surface",
    "top20_rank",
    "top500_rank",
    "chart",
    "version",
    "latest_version",
    "latest_status",
    "catalog_status",
    "production_readiness",
    "variant_count",
    "supported_variants",
    "candidate_variants",
    "start_variant",
    "namespace",
    "source_features",
    "source_classification",
    "top500_next_action",
    "not_yet_enabled",
    "recipe_path",
    "package_path",
    "catalog_path",
    "helm_pain_report",
  ];
}

function toCsv(rows, headers) {
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`;
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

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
