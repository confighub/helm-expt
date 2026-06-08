import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { TOP20_CONFIGHUB_PROOF_CHARTS } from "./lib/top20-confighub-proof.mjs";
import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputPath = join(repoRoot, "CATALOG.md");

if (mode === "--generate") {
  write(outputPath, buildMarkdown());
  console.log("wrote CATALOG.md");
} else if (mode === "--verify") {
  const expected = buildMarkdown();
  check(existsSync(outputPath), "CATALOG.md is missing; run npm run catalog:index");
  const actual = readFileSync(outputPath, "utf8");
  check(actual === expected, "CATALOG.md is stale; run npm run catalog:index");
  console.log("verified CATALOG.md");
} else {
  console.log(`Usage:
  node scripts/generate-root-catalog.mjs --generate
  node scripts/generate-root-catalog.mjs --verify`);
  process.exit(1);
}

function buildMarkdown() {
  const entries = artifactIndexes().map(buildEntry);
  const byChart = new Map(entries.map((entry) => [entry.chart, entry]));
  const liveTested = TOP20_CONFIGHUB_PROOF_CHARTS.map((chart) => byChart.get(chart.chart)).filter(Boolean);
  const remaining = entries.filter((entry) => !liveTested.some((live) => live.chart === entry.chart));
  const lines = [
    generatedNotice(),
    "",
    "# ConfigHub Helm Catalog",
    "",
    "This is the top-level catalog for choosing a chart and a variant.",
    "",
    "Use this page when you want to answer:",
    "",
    "```text",
    "What can I install?",
    "Which variant should I start with?",
    "Which variant needs existing Secrets or other target facts?",
    "Where is the executable cub installer package?",
    "Where are the proof receipts?",
    "```",
    "",
    "## How To Read This Catalog",
    "",
    "```text",
    "chart",
    "  variant",
    "    cub installer package base",
    "    rendered objects",
    "    receipts and checks",
    "```",
    "",
    "The root catalog is the entry point. The per-chart `CATALOG.md` is the",
    "evidence folder. The `packages/` path is what `cub installer setup` uses.",
    "",
    "## Folder Map",
    "",
    "```text",
    "CATALOG.md",
    "  Top-level chart and variant index.",
    "",
    "recipes/<repo>/<chart>/<version>/CATALOG.md",
    "  Per-chart recipe, variants, rendered objects, receipts, and status.",
    "",
    "packages/<repo>/<chart>/<version>/",
    "  Executable cub installer package with one base per variant.",
    "",
    "runs/",
    "  Receipts from live, ConfigHub, scan, and safe-ops proof runs.",
    "",
    "data/",
    "  Aggregate catalog, production disposition, top-500, and review data.",
    "```",
    "",
    "## Live-Tested Catalog Entries",
    "",
    "These 20 charts have local kind live/e2e receipts and ConfigHub upload,",
    "scan, and safe-ops proof receipts. Start with the first variant unless a",
    "different variant matches your intent.",
    "",
    "For exact base-variant readiness, including prerequisites and runtime",
    "review rows, see [Top-20 Base Variant Readiness](data/top20-base-readiness/summary.md).",
    "",
    "### At A Glance",
    "",
    liveTestedTable(liveTested),
    "",
    "### Chart Details",
    "",
    ...liveTested.flatMap(chartSection),
    "## Full 100-Chart Proof Index",
    "",
    "The rows below include the live-tested top 20 plus 80 proof-grade",
    "recipe/package artifacts. `catalog-supported` means reviewed variants for",
    "the declared scope. `proof-grade` means machine-verified artifacts that",
    "still need catalog promotion review before support is claimed.",
    "",
    summaryTable([...liveTested, ...remaining]),
    "",
  ];
  return lines.join("\n");
}

function artifactIndexes() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/artifact-index.yaml"))
    .sort();
}

function buildEntry(indexPath) {
  const index = readYaml(indexPath);
  const spec = index.spec ?? {};
  const variants = spec.variants ?? [];
  const startVariant = variants.find((variant) => variant.packageBase?.default) ?? variants[0];
  return {
    chart: spec.chart?.ref ?? index.metadata?.chart ?? "",
    version: spec.chart?.version ?? index.metadata?.version ?? "",
    namespace: startVariant?.namespace ?? "",
    releaseName: startVariant?.releaseName ?? "",
    catalog: relativeRepo(join(dirname(indexPath), "CATALOG.md")),
    recipe: spec.recipe?.path ?? "",
    helmPainReport: spec.recipe?.helmPainReport ?? "",
    package: spec.installerPackage?.path ?? "",
    status: spec.catalogStatus?.status ?? "",
    supportLevel: spec.catalogStatus?.supportLevel ?? "",
    productionReadiness: spec.catalogStatus?.productionReadiness ?? "",
    proofSummary: spec.proofSummary ?? {},
    startVariant: startVariant?.name ?? "",
    variants,
  };
}

function chartSection(entry) {
  const lines = [
    `#### ${entry.chart}@${entry.version}`,
    "",
    `Status: ${entry.status}`,
    `Production readiness: ${entry.productionReadiness}`,
    `Strongest evidence: ${entry.proofSummary.strongestEvidence || "see per-chart catalog"}`,
    `Proof lanes: ${proofLaneText(entry.proofSummary.proofLanes)}`,
    `Hard gap: ${entry.proofSummary.hardGap || "-"}`,
    `Package: ${link(entry.package, entry.package)}`,
    `Per-chart catalog: ${link("CATALOG.md", entry.catalog)}`,
    ...(entry.helmPainReport ? [`Helm pain report: ${link("helm-pain-report.yaml", entry.helmPainReport)}`] : []),
    "",
    "Start here:",
    "",
    "```sh",
    `cub installer setup --pull ${entry.package} --base ${entry.startVariant} --work-dir <tmp> --non-interactive --namespace ${entry.namespace}`,
    "```",
    "",
    "Variants:",
    "",
  ];

  for (const variant of entry.variants) {
    lines.push(...variantSection(variant, entry.startVariant));
  }
  return [...lines, ""];
}

function variantSection(variant, startVariant) {
  const revision = variant.revisions?.[0] ?? {};
  const isStart = variant.name === startVariant;
  return [
    `##### ${variant.name}${isStart ? " (recommended first)" : ""}`,
    "",
    `When to use: ${variant.packageBase?.description ?? "see per-chart catalog"}`,
    `Namespace: ${variant.namespace}`,
    `Target facts: ${variant.targetFactSummary || "none"}`,
    `Package base: ${link(variant.packageBase?.path ?? "", variant.packageBase?.path ?? "")}`,
    `Variant file: ${link(variant.variant, variant.variant)}`,
    `Rendered objects: ${link(revision.renderedObjects ?? "", revision.renderedObjects ?? "")}`,
    `Helm equivalence: ${revision.semanticObjectMatches || "see receipt"} objects matched`,
    `Receipts: ${link("per-chart receipts", entrylessCatalogPath(variant.variant))}`,
    "",
  ];
}

function liveTestedTable(entries) {
  return markdownTable(
    ["Chart", "Start With", "Evidence", "Hard Gap", "Variants", "Package", "Catalog"],
    entries.map((entry) => [
      `${entry.chart}@${entry.version}`,
      entry.startVariant,
      entry.proofSummary.strongestEvidence || "-",
      entry.proofSummary.hardGap || "-",
      entry.variants.map((variant) => variant.name).join(", "),
      link(entry.package, entry.package),
      link("CATALOG.md", entry.catalog),
    ]),
  );
}

function entrylessCatalogPath(variantPath) {
  const parts = variantPath.split("/");
  const variantIndex = parts.indexOf("variants");
  if (variantIndex === -1) return "";
  return [...parts.slice(0, variantIndex), "CATALOG.md"].join("/");
}

function summaryTable(entries) {
  return markdownTable(
    ["Chart", "Status", "Bucket", "Evidence", "Start With", "Hard Gap", "Catalog"],
    entries.map((entry) => [
      `${entry.chart}@${entry.version}`,
      entry.status,
      entry.proofSummary.adoptionBucket || "-",
      entry.proofSummary.strongestEvidence || "-",
      entry.startVariant,
      entry.proofSummary.hardGap || "-",
      link("CATALOG.md", entry.catalog),
    ]),
  );
}

function proofLaneText(lanes) {
  if (!lanes) return "-";
  return [
    `render parity ${lanes.renderParity || "-"}`,
    `ConfigHub ${lanes.inConfigHub || "-"}`,
    `local live ${lanes.localLive || "-"}`,
    `GitOps live ${lanes.gitopsLive || "-"}`,
    `live parity ${lanes.liveParity || "-"}`,
  ].join("; ");
}

function markdownTable(headers, rows) {
  const escape = (value) => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
}

function link(label, path) {
  if (!path) return "";
  return `[${label}](${path})`;
}

function generatedNotice() {
  return "<!-- Generated by npm run catalog:index. Do not edit by hand. -->";
}
