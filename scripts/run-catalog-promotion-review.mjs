import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "catalog-promotion-review");
const reviewCsvPath = join(outputRoot, "review.csv");
const summaryPath = join(outputRoot, "summary.md");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const report = buildReport();
  writeReport(report);
  console.log(`wrote ${relativeRepo(reviewCsvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(reviewCsvPath), "missing catalog promotion review CSV; run npm run catalog:review");
  check(existsSync(summaryPath), "missing catalog promotion summary; run npm run catalog:review");
  check(readFileSync(reviewCsvPath, "utf8") === report.csv, "catalog promotion review CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "catalog promotion summary is stale");
  console.log("verified catalog promotion review outputs");
} else {
  console.log(`Usage:
  node scripts/run-catalog-promotion-review.mjs --generate
  node scripts/run-catalog-promotion-review.mjs --verify`);
}

function buildReport() {
  const roots = recipeRoots();
  check(roots.length === 100, `expected 100 recipe roots, found ${roots.length}`);
  const rows = roots.map(reviewRecipe).sort((left, right) => left.chart.localeCompare(right.chart));
  return { rows, csv: toCsv(rows), summary: toSummary(rows) };
}

function recipeRoots() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
}

function reviewRecipe(root) {
  const recipe = readYaml(join(root, "recipe.yaml"));
  const helmPlan = readYaml(join(root, "helm-plan.yaml"));
  const sourceLock = readYaml(join(root, "source-lock.yaml"));
  const controlPoints = readYaml(join(root, "control-points.yaml"));
  const valueModel = readYaml(join(root, "value-model.yaml"));
  const catalogStatusPath = join(root, "catalog-status.yaml");
  const catalogStatus = existsSync(catalogStatusPath) ? readYaml(catalogStatusPath) : null;
  const packageReceiptPath = join(root, "publication", "installer-package-receipt.yaml");
  const packageReceipt = existsSync(packageReceiptPath) ? readYaml(packageReceiptPath) : null;
  const chart = helmPlan.spec?.readiness?.chart ?? sourceLock.spec?.ref ?? `${sourceLock.spec?.repositoryName}/${sourceLock.spec?.chart}`;
  const version = String(helmPlan.spec?.readiness?.version ?? sourceLock.spec?.version ?? recipe.metadata?.version ?? "");
  const variantPaths = recipe.spec?.variants ?? [];
  const variantNames = variantPaths.map((path) => basenameNoExt(dirname(path)));
  const revisionRoots = listFiles(join(root, "revisions"))
    .filter((file) => file.endsWith("/variant-revision.yaml"))
    .map((file) => dirname(file))
    .sort();
  const receiptReviews = revisionRoots.map((revisionRoot) => reviewRevision(root, revisionRoot));
  const proofTier = recipe.metadata?.labels?.["confighub.io/proof-tier"] ?? "bespoke-top20";
  const fixturePath = recipe.spec?.currentExecutableFixture?.installerPackage ?? "";
  const fixtureUsesCurrentPackages = fixturePath.startsWith("packages/") || fixturePath.startsWith("../../../../packages/");
  const controlCategories = (controlPoints.spec?.points ?? []).map((point) => point.category).sort();
  const valueSignals = valueModel.spec?.sourceFeatureSignals ?? {};
  const machineMissing = requiredRootFiles(root).filter((file) => !existsSync(join(root, file)));
  const receiptFailures = receiptReviews.flatMap((receipt) => receipt.failures);
  const machinePass = machineMissing.length === 0 && receiptFailures.length === 0;
  const gateDecisions = [...new Set(receiptReviews.map((receipt) => receipt.gateDecision).filter(Boolean))].sort();
  const scanHigh = sum(receiptReviews.map((receipt) => receipt.scanHigh));
  const scanMedium = sum(receiptReviews.map((receipt) => receipt.scanMedium));
  const renderedObjects = sum(receiptReviews.map((receipt) => receipt.objectCount));
  const packagePath = packageReceipt?.spec?.package?.path ?? "";
  const packageExists = packagePath ? existsSync(join(repoRoot, packagePath)) : false;
  const inferredState = promotionState({ chart, machinePass, proofTier, variantCount: variantPaths.length });
  const state = catalogStatus?.spec?.status ?? inferredState;
  const gaps = productGaps({
    proofTier,
    variantCount: variantPaths.length,
    fixtureUsesCurrentPackages,
    packageExists,
    scanHigh,
    scanMedium,
    gateDecisions,
    controlCategories,
  });

  return {
    chart: `${chart}@${version}`,
    recipe_path: relativeRepo(root),
    package_path: packagePath,
    proof_tier: proofTier,
    promotion_state: state,
    inferred_promotion_state: inferredState,
    production_readiness: catalogStatus?.spec?.productionReadiness ?? "not-reviewed",
    support_level: catalogStatus?.spec?.supportLevel ?? "not-explicit",
    supported_variants: (catalogStatus?.spec?.supportedVariants ?? []).join(";"),
    machine_checks: machinePass ? "pass" : "fail",
    variants: variantNames.join(";"),
    variant_count: variantPaths.length,
    revision_count: revisionRoots.length,
    rendered_objects_total: renderedObjects,
    gate_decisions: gateDecisions.join(";") || "unknown",
    scan_high: scanHigh,
    scan_medium: scanMedium,
    has_crds: hasCategory(controlCategories, "crds"),
    has_hooks: hasCategory(controlCategories, "lifecycle-policy") || hasCategory(controlCategories, "hook-policy"),
    has_lookup: hasCategory(controlCategories, "target-facts") || valueSignals.usesLookup === true,
    has_generated_facts: hasCategory(controlCategories, "generated-facts") || valueSignals.usesGeneratedFacts === true,
    has_cluster_rbac: hasCategory(controlCategories, "cluster-rbac"),
    has_webhooks: hasCategory(controlCategories, "webhooks"),
    fixture_uses_current_packages: fixtureUsesCurrentPackages,
    default_review_required: "yes",
    obvious_variants_review: variantPaths.length > 1 ? "review-covered-variants" : "needs-user-shaped-variants",
    ux_review_required: "yes",
    catalog_recommendation: recommendationFor(state, gaps, catalogStatus),
    gaps: gaps.join("; "),
  };
}

function requiredRootFiles(root) {
  return [
    "README.md",
    "helm-plan.yaml",
    "chart-dossier.yaml",
    "source-lock.yaml",
    "dependency-lock.yaml",
    "control-points.yaml",
    "value-model.yaml",
    "recipe.yaml",
    "publication/installer-package-receipt.yaml",
  ];
}

function reviewRevision(root, revisionRoot) {
  const failures = [];
  const files = {
    revision: join(revisionRoot, "variant-revision.yaml"),
    release: join(revisionRoot, "rendered", "release-objects.yaml"),
    inventory: join(revisionRoot, "rendered", "object-inventory.yaml"),
    equivalence: join(revisionRoot, "receipts", "helm-equivalence-receipt.yaml"),
    render: join(revisionRoot, "receipts", "render-receipt.yaml"),
    scan: join(revisionRoot, "receipts", "scan-receipt.yaml"),
    gate: join(revisionRoot, "receipts", "install-gate.yaml"),
  };
  for (const [name, path] of Object.entries(files)) {
    if (!existsSync(path)) failures.push(`missing ${relative(root, path) || name}`);
  }
  if (failures.length) return { failures, scanHigh: 0, scanMedium: 0, objectCount: 0, gateDecision: "" };

  const releaseSHA = sha256File(files.release);
  const revision = readYaml(files.revision);
  const inventory = readYaml(files.inventory);
  const equivalence = readYaml(files.equivalence);
  const render = readYaml(files.render);
  const scan = readYaml(files.scan);
  const gate = readYaml(files.gate);
  if (inventory.spec?.sourceSHA256 !== releaseSHA) failures.push("inventory digest mismatch");
  if (revision.spec?.digestInputs?.renderedObjectSetSHA256 !== releaseSHA) failures.push("variant revision digest mismatch");
  if (render.spec?.outputs?.renderedObjectSetSHA256 !== releaseSHA) failures.push("render receipt digest mismatch");
  if (render.spec?.outputs?.deterministicAcrossTwoLocalRenders === false) failures.push("render receipt is not deterministic");
  if (equivalence.spec?.regularHelm?.renderedSHA256 !== releaseSHA) failures.push("Helm equivalence digest mismatch");
  if (equivalence.spec?.result !== "pass") failures.push("Helm equivalence did not pass");
  if (scan.spec?.renderedObjectSetSHA256 !== releaseSHA) failures.push("scan digest mismatch");
  if (gate.spec?.renderedObjectSetSHA256 !== releaseSHA) failures.push("install gate digest mismatch");
  return {
    failures,
    scanHigh: scan.spec?.findingCounts?.high ?? 0,
    scanMedium: scan.spec?.findingCounts?.medium ?? 0,
    objectCount: inventory.spec?.objectCount ?? 0,
    gateDecision: gate.spec?.decision ?? "",
  };
}

function promotionState({ chart, machinePass, proofTier, variantCount }) {
  if (!machinePass) return "blocked";
  if (chart === "bitnami/redis") return "catalog-candidate";
  if (proofTier === "next80-full") return "proof-grade";
  if (variantCount > 1) return "catalog-candidate";
  return "proof-grade";
}

function productGaps(input) {
  const gaps = [];
  if (input.variantCount <= 1) gaps.push("default-only; add or explicitly defer obvious user variants");
  else gaps.push("human review needed: confirm variants are the obvious Helm-user paths");
  if (!input.fixtureUsesCurrentPackages) gaps.push("recipe executable fixture does not point at current packages/ path");
  if (!input.packageExists) gaps.push("installer package path missing or not current");
  if (input.scanHigh > 0) gaps.push("high scan findings require review before catalog support");
  if (input.scanMedium > 0) gaps.push("medium scan findings require review or waiver before production support");
  if (input.gateDecisions.includes("warn")) gaps.push("install gate warns; catalog support requires documented production disposition");
  if (input.controlCategories.includes("crds")) gaps.push("CRD lifecycle policy must be catalog-readable");
  if (input.controlCategories.includes("webhooks")) gaps.push("webhook readiness/observation policy must be catalog-readable");
  if (input.controlCategories.includes("stateful-storage")) gaps.push("stateful storage and rollback policy must be catalog-readable");
  return gaps;
}

function recommendationFor(state, gaps, catalogStatus = null) {
  if (state === "blocked") return "fix machine proof failures first";
  if (state === "catalog-supported") {
    return catalogStatus?.spec?.productionReadiness === "blocked-by-current-scan-gate"
      ? "supported for declared scopes; production remains blocked by current gate"
      : "catalog-supported with explicit status";
  }
  if (state === "proof-grade") return "keep as proof-grade until product variants and UX review are complete";
  if (gaps.some((gap) => gap.startsWith("recipe executable fixture") || gap.startsWith("installer package path"))) {
    return "candidate, but clean executable fixture before catalog support";
  }
  return "run human catalog promotion review";
}

function toCsv(rows) {
  const headers = [
    "chart",
    "promotion_state",
    "inferred_promotion_state",
    "production_readiness",
    "support_level",
    "supported_variants",
    "machine_checks",
    "proof_tier",
    "variant_count",
    "variants",
    "revision_count",
    "rendered_objects_total",
    "gate_decisions",
    "scan_high",
    "scan_medium",
    "has_crds",
    "has_hooks",
    "has_lookup",
    "has_generated_facts",
    "has_cluster_rbac",
    "has_webhooks",
    "fixture_uses_current_packages",
    "default_review_required",
    "obvious_variants_review",
    "ux_review_required",
    "catalog_recommendation",
    "gaps",
    "recipe_path",
    "package_path",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function toSummary(rows) {
  const counts = countBy(rows, "promotion_state");
  const supportLevelCounts = countBy(rows, "support_level");
  const machineCounts = countBy(rows, "machine_checks");
  const proofTierCounts = countBy(rows, "proof_tier");
  const defaultOnly = rows.filter((row) => row.variant_count <= 1).length;
  const multiVariant = rows.length - defaultOnly;
  const warningGates = rows.filter((row) => row.gate_decisions.includes("warn")).length;
  const currentFixtureGaps = rows.filter((row) => row.fixture_uses_current_packages === false).length;
  const candidates = rows.filter((row) => row.promotion_state === "catalog-candidate");
  const topCandidates = candidates.slice(0, 20);
  return `# Catalog Promotion Review Report

This report is generated from the recipe, variant, receipt, and package
artifacts. It executes the machine-readable part of
\`docs/catalog-promotion-review.md\` and identifies the human/product review
gaps that remain before any recipe can be called catalog-supported.

Important boundary:

\`\`\`text
This report does not infer catalog-supported status from machine checks.
Catalog support must come from explicit catalog-status.yaml files.
\`\`\`

## Summary

\`\`\`text
recipes reviewed: ${rows.length}
machine checks pass: ${machineCounts.pass ?? 0}
machine checks fail: ${machineCounts.fail ?? 0}
proof-grade: ${counts["proof-grade"] ?? 0}
catalog-candidate: ${counts["catalog-candidate"] ?? 0}
catalog-supported: ${counts["catalog-supported"] ?? 0}
blocked: ${counts.blocked ?? 0}
default-only recipes: ${defaultOnly}
multi-variant recipes: ${multiVariant}
recipes with warning gates: ${warningGates}
recipes with non-current executable fixture path: ${currentFixtureGaps}
\`\`\`

## Proof Tiers

${Object.entries(proofTierCounts)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([tier, count]) => `- \`${tier}\`: ${count}`)
  .join("\n")}

## Support Levels

${Object.entries(supportLevelCounts)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([level, count]) => `- \`${level}\`: ${count}`)
  .join("\n")}

## Catalog Candidates

These are not catalog-supported yet. They are the first recipes worth human
promotion review because they already have richer variant artifacts or bespoke
proof work.

| Chart | Variants | Gate | Recommendation |
| --- | ---: | --- | --- |
${topCandidates
  .map((row) => `| \`${row.chart}\` | ${row.variant_count} | ${row.gate_decisions} | ${row.catalog_recommendation} |`)
  .join("\n") || "| none | 0 | none | none |"}

## Main Gaps

- Default-only recipes remain proof-grade until they get user-shaped variants
  or explicit deferrals.
- Warning gates need production dispositions, waivers, or stronger mitigations
  before catalog support.
- Charts with CRDs, webhooks, generated facts, lookup, cluster RBAC, or
  stateful storage need plain-English catalog notes, not only machine receipts.
- Executable fixture paths now point at current \`packages/\` paths; keep this as
  a hard invariant.

## Next Actions

1. Pick 3-5 proof-grade charts from the generated/default set and add
   user-shaped variants before promotion.
2. Add production dispositions for the currently supported local-test charts.
3. Keep \`catalog-status.yaml\` explicit for every maintained chart.
4. Use the legacy-patch review lane for supported old versions.
5. Re-run this report whenever chart versions, scan policy, installer behavior,
   or supported variants change.
`;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return counts;
}

function hasCategory(categories, category) {
  return categories.includes(category);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function basenameNoExt(path) {
  return path.split("/").filter(Boolean).at(-1)?.replace(/\.ya?ml$/, "") ?? "";
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeReport(report) {
  mkdirSync(outputRoot, { recursive: true });
  write(reviewCsvPath, report.csv);
  write(summaryPath, report.summary);
}
