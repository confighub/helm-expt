// Variant backlog — derives, from each chart's real detected control-points, WHICH standard variants it
// should offer (per docs/user/per-chart-recipes.md), minus the variants it already ships. This is the
// scoping input for the wave-based variant build; it does NOT author the variants (those are bespoke
// per chart, like data/catalog-promotion-wave2/variant-work-orders.yaml). It names the work, honestly.
//
//   node scripts/generate-variant-backlog.mjs --generate
//   node scripts/generate-variant-backlog.mjs --verify
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "variant-backlog");
const csvPath = join(outputRoot, "backlog.csv");
const summaryPath = join(outputRoot, "summary.md");
const mode = process.argv[2] ?? "--generate";

// A standard dimension is recommended only where a real detected behavior calls for it (no padding).
const DIMENSION_RULES = [
  { dim: "existing-secret", test: (c) => /secret|generated-facts/.test(c), why: "chart generates/needs a secret" },
  { dim: "no-crds", test: (c) => /crd/.test(c), why: "chart ships CRDs a controller/GitOps should own" },
  { dim: "ha", test: (c) => /stateful|pvc|replicaset|availability|storage-retention|storage-config|storageclass|storage-policy/.test(c), why: "chart has a real clustered/stateful mode" },
  { dim: "ingress-tls", test: (c) => /ingress|service-exposure/.test(c), why: "chart has a web/UI surface" },
  { dim: "minimal", test: (c) => /component-selection|bundle-dependencies|monitoring-workloads/.test(c), why: "chart has optional components worth dropping" },
  { dim: "tls", test: (c) => /tls-posture/.test(c), why: "chart consumes BYO TLS/CA material" },
  { dim: "rotation", test: (c) => /sync-secret-rotation/.test(c), why: "chart supports secret rotation" },
];

// Map an existing variant name to the dimension(s) it already covers, so we don't recommend duplicates.
function coveredDimensions(variantName) {
  const n = variantName.toLowerCase();
  const dims = new Set();
  if (/secret/.test(n)) dims.add("existing-secret");
  if (/crd/.test(n)) { dims.add("no-crds"); }
  if (/\bha\b|raft|scalable|replicaset|cluster/.test(n)) dims.add("ha");
  if (/ingress/.test(n)) dims.add("ingress-tls");
  if (/minimal|server-only|admission-disabled|single-binary|ephemeral|local-persistent/.test(n)) dims.add("minimal");
  if (/tls/.test(n)) dims.add("tls");
  if (/rotation/.test(n)) dims.add("rotation");
  return dims;
}

if (mode === "--generate") {
  const report = buildReport();
  mkdirSync(outputRoot, { recursive: true });
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  console.log(`wrote ${relativeRepo(csvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
  console.log(`variants to build: ${report.totalToBuild} across ${report.chartsNeedingWork} charts`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath) && readFileSync(csvPath, "utf8") === report.csv, "variant-backlog backlog.csv is stale; run npm run variant-backlog:generate");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === report.summary, "variant-backlog summary.md is stale; run npm run variant-backlog:generate");
  console.log(`verified variant-backlog (${report.totalToBuild} variants to build across ${report.chartsNeedingWork} charts)`);
} else {
  console.log("usage: node scripts/generate-variant-backlog.mjs --generate|--verify");
}

function buildReport() {
  const roots = listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
  check(roots.length === 100, `expected 100 recipe roots, found ${roots.length}`);
  const rows = roots.map(scoreRecipe).sort((a, b) => a.chart.localeCompare(b.chart));
  const totalToBuild = rows.reduce((n, r) => n + r._recommend.length, 0);
  const chartsNeedingWork = rows.filter((r) => r._recommend.length > 0).length;
  return { rows, totalToBuild, chartsNeedingWork, csv: toCsv(rows), summary: toSummary(rows, totalToBuild, chartsNeedingWork) };
}

function scoreRecipe(root) {
  const recipe = readYaml(join(root, "recipe.yaml"));
  const sourceLock = readYaml(join(root, "source-lock.yaml"));
  const controlPoints = readYaml(join(root, "control-points.yaml"));
  const catalogStatusPath = join(root, "catalog-status.yaml");
  const catalogStatus = existsSync(catalogStatusPath) ? readYaml(catalogStatusPath) : null;
  const chart = catalogStatus?.spec?.chart ?? `${sourceLock.spec?.repositoryName}/${sourceLock.spec?.chart}`;
  const version = String(catalogStatus?.spec?.version ?? sourceLock.spec?.version ?? "");

  const categories = (controlPoints.spec?.points ?? []).map((p) => String(p.category ?? ""));
  const variantPaths = recipe.spec?.variants ?? [];
  const variantNames = variantPaths.map((p) => p.split("/").filter(Boolean).at(-2) ?? "");
  const covered = new Set();
  for (const name of variantNames) for (const d of coveredDimensions(name)) covered.add(d);

  const applicable = DIMENSION_RULES.filter((rule) => categories.some((c) => rule.test(c)));
  const recommend = applicable.map((r) => r.dim).filter((d) => !covered.has(d));

  return {
    chart: `${chart}@${version}`,
    current_variant_count: variantPaths.length,
    current_variants: variantNames.join(";"),
    applicable_dimensions: applicable.map((r) => r.dim).join(";"),
    recommend_to_build: recommend.join(";") || "none",
    to_build_count: recommend.length,
    recipe_path: relativeRepo(root),
    _recommend: recommend,
  };
}

function toCsv(rows) {
  const headers = ["chart", "current_variant_count", "current_variants", "applicable_dimensions", "recommend_to_build", "to_build_count", "recipe_path"];
  return `${[headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n")}\n`;
}

function toSummary(rows, totalToBuild, chartsNeedingWork) {
  const byDim = {};
  for (const r of rows) for (const d of r._recommend) byDim[d] = (byDim[d] ?? 0) + 1;
  const complete = rows.filter((r) => r._recommend.length === 0);
  return `# Variant Backlog — what each chart still needs

Derived from each chart's real \`control-points.yaml\` using the \`per-chart-recipes.md\` method: a standard
variant is recommended only where a detected behavior calls for it (no padding), minus the variants the chart
already ships. This **scopes** the wave-based variant build; it does not author the variants (those are
bespoke per chart — see \`data/catalog-promotion-wave2/variant-work-orders.yaml\` for the worked shape).

## Headline

\`\`\`text
charts: ${rows.length}
charts needing variant work: ${chartsNeedingWork}
charts already variant-complete: ${complete.length}
total variants to build: ${totalToBuild}
\`\`\`

## Build volume by dimension (highest-leverage first)

${Object.entries(byDim).sort(([, a], [, b]) => b - a).map(([d, n]) => `- \`${d}\`: ${n} charts`).join("\n") || "- none"}

## Per-chart backlog (charts needing work)

| Chart | Has | Build next |
| --- | ---: | --- |
${rows.filter((r) => r._recommend.length > 0).map((r) => `| \`${r.chart}\` | ${r.current_variant_count} | ${r._recommend.join(", ")} |`).join("\n")}

## How to use this

1. Take a wave of charts from the top of the build-volume dimensions (\`existing-secret\`, \`ha\` are broadest).
2. For each, author the variant like the wave-2 work orders (real values delta that changes the object set),
   render it, prove Helm-equivalence, write the revision + scan/gate receipts, and declare its scope.
3. Re-run \`npm run completeness:generate\` — the chart flips to \`variant_complete\` and, once it has a
   pain report + scope, to model-complete.
`;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
