import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { TOP20_CONFIGHUB_PROOF_CHARTS } from "./lib/top20-confighub-proof.mjs";
import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";
import { installerOciRef } from "./lib/installer-oci.mjs";
import { catalogDerivedPaths } from "./lib/catalog-derived-views.mjs";

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
  const readinessByKey = top20BaseReadinessByKey();
  const entries = artifactIndexes().map((indexPath) => buildEntry(indexPath, readinessByKey));
  const byChartVersion = new Map(entries.map((entry) => [`${entry.chart}@${entry.version}`, entry]));
  const liveKeys = new Set(TOP20_CONFIGHUB_PROOF_CHARTS.map((chart) => `${chart.chart}@${chart.chartVersion}`));
  const liveTested = TOP20_CONFIGHUB_PROOF_CHARTS.map((chart) =>
    byChartVersion.get(`${chart.chart}@${chart.chartVersion}`),
  ).filter(Boolean);
  const remaining = entries.filter((entry) => !liveKeys.has(`${entry.chart}@${entry.version}`));
  const fullIndexEntries = [...liveTested, ...remaining];
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
    "evidence folder. The `oci://` package ref is what users pass to",
    "`cub installer setup --pull`. The `packages/` path is the repo source",
    "for maintainers and proof scripts.",
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
    "data/kubara-catalog-release/recipe-views/recipes/<repo>/<chart>/<version>/CATALOG.md",
    "  Derived maps for byte-frozen additive Kubara recipe roots.",
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
    "The `Start Base Status` column uses the same generated readiness labels.",
    "",
    "### At A Glance",
    "",
    liveTestedTable(liveTested),
    "",
    "### Start Base Status Labels",
    "",
    readinessLabelTable(),
    "",
    "### Chart Details",
    "",
    ...liveTested.flatMap(chartSection),
    `## Full Proof Index (${fullIndexEntries.length} Entries)`,
    "",
    "The rows below include the live-tested top 20, proof-grade recipe/package",
    "artifacts, and any retained newer chart-version candidates. `catalog-supported`",
    "means reviewed variants for the declared scope. `catalog-candidate` means",
    "a newer or richer candidate is visible for review but is not the supported",
    "catalog version. `proof-grade` means machine-verified artifacts that still",
    "need catalog promotion review before support is claimed.",
    "",
    summaryTable(fullIndexEntries),
    "",
  ];
  return lines.join("\n");
}

function artifactIndexes() {
  return catalogDerivedPaths("artifact-index.yaml", { existingOnly: true }).sort();
}

function buildEntry(indexPath, readinessByKey) {
  const index = readYaml(indexPath);
  const spec = index.spec ?? {};
  const chart = spec.chart?.ref ?? index.metadata?.chart ?? "";
  const version = spec.chart?.version ?? index.metadata?.version ?? "";
  const variants = (spec.variants ?? []).map((variant) => ({
    ...variant,
    readiness: readinessByKey.get(`${chart}@${version}|${variant.name}`),
  }));
  const startVariant =
    variants.find((variant) => variant.readiness?.recommended_first === "yes") ??
    variants.find((variant) => variant.packageBase?.default) ??
    variants[0];
  return {
    chart,
    version,
    namespace: startVariant?.namespace ?? "",
    releaseName: startVariant?.releaseName ?? "",
    catalog: relativeRepo(join(dirname(indexPath), "CATALOG.md")),
    recipe: spec.recipe?.path ?? "",
    helmPainReport: spec.recipe?.helmPainReport ?? "",
    package: spec.installerPackage?.path ?? "",
    packageOciRef: spec.installerPackage?.ociRef ?? installerOciRef(chart, version),
    status: spec.catalogStatus?.status ?? "",
    supportLevel: spec.catalogStatus?.supportLevel ?? "",
    productionReadiness: spec.catalogStatus?.productionReadiness ?? "",
    proofSummary: spec.proofSummary ?? {},
    startVariant: startVariant?.name ?? "",
    startReadiness: startVariant?.readiness?.user_readiness ?? "",
    variants,
  };
}

function chartSection(entry) {
  const lines = [
    `#### ${entry.chart}@${entry.version}`,
    "",
    `Status: ${entry.status}`,
    `Production readiness: ${entry.productionReadiness}`,
    `Start base readiness: ${entry.startReadiness || "-"}`,
    `Strongest evidence: ${entry.proofSummary.strongestEvidence || "see per-chart catalog"}`,
    `Proof lanes: ${proofLaneText(entry.proofSummary.proofLanes)}`,
    `Hard gap: ${entry.proofSummary.hardGap || "-"}`,
    `Installer package OCI: \`${entry.packageOciRef}\``,
    `Source package: ${link(entry.package, entry.package)}`,
    `Per-chart catalog: ${link("CATALOG.md", entry.catalog)}`,
    ...(entry.helmPainReport ? [`Helm pain report: ${link("helm-pain-report.yaml", entry.helmPainReport)}`] : []),
    "",
    "Start here:",
    "",
    "```sh",
    `cub installer setup --pull ${entry.packageOciRef} --base ${entry.startVariant} --work-dir <tmp> --non-interactive --namespace ${entry.namespace}`,
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
    `Readiness: ${variant.readiness?.user_readiness ?? "see status dashboard"}`,
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
    ["Chart", "Start With", "Start Base Status", "Evidence", "Hard Gap", "Variants", "Installer OCI", "Catalog"],
    entries.map((entry) => [
      `${entry.chart}@${entry.version}`,
      entry.startVariant,
      entry.startReadiness || "-",
      entry.proofSummary.strongestEvidence || "-",
      entry.proofSummary.hardGap || "-",
      entry.variants.map((variant) => variant.name).join(", "),
      `\`${entry.packageOciRef}\``,
      link("CATALOG.md", entry.catalog),
    ]),
  );
}

function readinessLabelTable() {
  return markdownTable(
    ["Status", "Meaning"],
    [
      ["start-here", "Best first catalog path today for the declared scope."],
      ["try-with-proof", "Useful base with proof, but not every lane is complete."],
      ["lifecycle-observed", "Lifecycle behavior has a committed observation receipt."],
      ["prerequisite-observed", "Target prerequisites are explicit and have observation evidence."],
      ["runtime-watch", "Render/parity evidence exists, but runtime behavior needs review or rerun."],
      ["runtime-review-needed", "Runtime readiness needs inspection before broader claims."],
      ["target-prerequisite-needed", "The target must provide a prerequisite such as CRDs, Secrets, or storage."],
    ],
  );
}

function top20BaseReadinessByKey() {
  const path = join(repoRoot, "data", "top20-base-readiness", "base-readiness.csv");
  if (!existsSync(path)) return new Map();
  return new Map(readCsv(path).map((row) => [`${row.chart}|${row.base}`, row]));
}

function readCsv(path) {
  return parseCsv(readFileSync(path, "utf8"));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
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

function entrylessCatalogPath(variantPath) {
  const parts = variantPath.split("/");
  const variantIndex = parts.indexOf("variants");
  if (variantIndex === -1) return "";
  return [...parts.slice(0, variantIndex), "CATALOG.md"].join("/");
}

function summaryTable(entries) {
  return markdownTable(
    ["Chart", "Status", "Bucket", "Evidence", "Start With", "Package OCI", "Hard Gap", "Catalog"],
    entries.map((entry) => [
      `${entry.chart}@${entry.version}`,
      entry.status,
      entry.proofSummary.adoptionBucket || "-",
      entry.proofSummary.strongestEvidence || "-",
      entry.startVariant,
      `\`${entry.packageOciRef}\``,
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
