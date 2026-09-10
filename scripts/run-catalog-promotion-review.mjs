import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { dirname, join, relative } from "node:path";
import {
  check,
  listFiles,
  readYamlFiles,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
} from "./lib/proof-common.mjs";
import { catalogDerivedPath } from "./lib/catalog-derived-views.mjs";

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
  check(readFileSync(reviewCsvPath, "utf8") === report.csv, "catalog promotion review CSV is stale; run npm run catalog:review");
  check(readFileSync(summaryPath, "utf8") === report.summary, "catalog promotion summary is stale; run npm run catalog:review");
  console.log("verified catalog promotion review outputs");
} else if (mode === "--self-test") {
  selfTest();
} else {
  console.log(`Usage:
  node scripts/run-catalog-promotion-review.mjs --generate
  node scripts/run-catalog-promotion-review.mjs --verify
  node scripts/run-catalog-promotion-review.mjs --self-test`);
}

function selfTest() {
  const root = mkdtempSync(join(repoRoot, "recipes", ".catalog-review-self-test-"));
  try {
    const files = {
      "helm-plan.yaml": "spec:\n  readiness:\n    chart: example/chart\n    version: '1'\n",
      "source-lock.yaml": "spec:\n  ref: example/chart\n  version: '1'\n",
      "control-points.yaml": "spec:\n  points: []\n",
      "value-model.yaml": "spec:\n  sourceFeatureSignals: {}\n",
      "recipe.yaml": "metadata:\n  version: '1'\nspec:\n  variants: []\n",
      "publication/installer-package-receipt.yaml": "spec:\n  package:\n    path: packages/missing.yaml\n",
      "README.md": "# fixture\n",
      "chart-dossier.yaml": "spec: {}\n",
      "dependency-lock.yaml": "spec: {}\n",
      "revisions/v1/variant-revision.yaml": "spec:\n  digestInputs: {}\n",
      "revisions/v1/rendered/object-inventory.yaml": "spec: {}\n",
      "revisions/v1/receipts/helm-equivalence-receipt.yaml": "spec: {}\n",
      "revisions/v1/receipts/render-receipt.yaml": "spec: {}\n",
      "revisions/v1/receipts/scan-receipt.yaml": "[unterminated\n",
      "revisions/v1/receipts/install-gate.yaml": "spec: {}\n",
    };
    for (const [path, text] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
    }
    const incomplete = reviewRecipe(root);
    assert.equal(incomplete.machine_checks, "fail");
    assert.equal(incomplete.inferred_promotion_state, "blocked");
    unlinkSync(join(root, "README.md"));
    const missingRootFile = reviewRecipe(root);
    assert.match(missingRootFile.machine_failure_details, /missing README\.md/);
    writeFileSync(join(root, "README.md"), "# fixture\n");
    writeFileSync(join(root, "revisions/v1/rendered/release-objects.yaml"), "kind: List\n");
    assert.throws(() => reviewRecipe(root), /unterminated|YAML|mapping/);
    const releasePath = join(root, "revisions/v1/rendered/release-objects.yaml");
    const releaseSHA = sha256File(releasePath);
    writeFileSync(join(root, "revisions/v1/rendered/object-inventory.yaml"), "spec:\n  sourceSHA256: wrong-bound-sha\n  objectCount: 0\n");
    writeFileSync(join(root, "revisions/v1/receipts/scan-receipt.yaml"), `spec:\n  renderedObjectSetSHA256: ${releaseSHA}\n  findingCounts: {}\n`);
    writeFileSync(join(root, "revisions/v1/variant-revision.yaml"), `spec:\n  digestInputs:\n    renderedObjectSetSHA256: ${releaseSHA}\n`);
    writeFileSync(join(root, "revisions/v1/receipts/helm-equivalence-receipt.yaml"), `spec:\n  regularHelm:\n    renderedSHA256: ${releaseSHA}\n  result: pass\n`);
    writeFileSync(join(root, "revisions/v1/receipts/render-receipt.yaml"), `spec:\n  outputs:\n    renderedObjectSetSHA256: ${releaseSHA}\n    deterministicAcrossTwoLocalRenders: true\n`);
    writeFileSync(join(root, "revisions/v1/receipts/install-gate.yaml"), `spec:\n  renderedObjectSetSHA256: ${releaseSHA}\n  decision: allow\n`);
    const failedReview = reviewRecipe(root);
    assert.equal(failedReview.machine_checks, "fail");
    assert.equal(failedReview.inferred_promotion_state, "blocked");
    assert.match(failedReview.machine_failure_details, /inventory digest mismatch/);
    assert.match(failedReview.machine_failure_details, /recipes\/.+\/revisions\/v1\/rendered\/object-inventory\.yaml/);
    assert.match(failedReview.machine_failure_details, /wrong-bound-sha/);
    assert.match(failedReview.machine_failure_details, new RegExp(releaseSHA));
    assert.match(failedReview.machine_failure_details, /rendered\/release-objects\.yaml/);
    assert.match(failedReview.machine_failure_details, /npm run catalog:review/);
    console.log("catalog promotion review self-test passed: incomplete revisions short-circuit before YAML parsing");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function buildReport() {
  const roots = recipeRoots();
  check(roots.length >= 100, `expected at least 100 recipe roots, found ${roots.length}`);
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
  const catalogStatusPath = catalogDerivedPath(root, "catalog-status.yaml");
  const packageReceiptPath = join(root, "publication", "installer-package-receipt.yaml");
  const revisionRoots = listFiles(join(root, "revisions"))
    .filter((file) => file.endsWith("/variant-revision.yaml"))
    .map((file) => dirname(file))
    .sort();
  const revisionFiles = revisionRoots.flatMap((revisionRoot) => {
    const files = [
      join(revisionRoot, "variant-revision.yaml"),
      join(revisionRoot, "rendered", "release-objects.yaml"),
      join(revisionRoot, "rendered", "object-inventory.yaml"),
      join(revisionRoot, "receipts", "helm-equivalence-receipt.yaml"),
      join(revisionRoot, "receipts", "render-receipt.yaml"),
      join(revisionRoot, "receipts", "scan-receipt.yaml"),
      join(revisionRoot, "receipts", "install-gate.yaml"),
    ];
    return files.every((file) => existsSync(file)) ? files.filter((file) => !file.endsWith("release-objects.yaml")) : [];
  });
  const yaml = readYamlFiles([
    join(root, "recipe.yaml"), join(root, "helm-plan.yaml"), join(root, "source-lock.yaml"),
    join(root, "control-points.yaml"), join(root, "value-model.yaml"),
    ...(existsSync(catalogStatusPath) ? [catalogStatusPath] : []),
    ...(existsSync(packageReceiptPath) ? [packageReceiptPath] : []), ...revisionFiles,
  ]);
  const recipe = yaml.get(join(root, "recipe.yaml"));
  const helmPlan = yaml.get(join(root, "helm-plan.yaml"));
  const sourceLock = yaml.get(join(root, "source-lock.yaml"));
  const controlPoints = yaml.get(join(root, "control-points.yaml"));
  const valueModel = yaml.get(join(root, "value-model.yaml"));
  const catalogStatus = yaml.get(catalogStatusPath) ?? null;
  const packageReceipt = yaml.get(packageReceiptPath) ?? null;
  const chart = helmPlan.spec?.readiness?.chart ?? sourceLock.spec?.ref ?? `${sourceLock.spec?.repositoryName}/${sourceLock.spec?.chart}`;
  const version = String(helmPlan.spec?.readiness?.version ?? sourceLock.spec?.version ?? recipe.metadata?.version ?? "");
  const variantPaths = recipe.spec?.variants ?? [];
  const variantNames = variantPaths.map((path) => basenameNoExt(dirname(path)));
  const receiptReviews = revisionRoots.map((revisionRoot) => reviewRevision(root, revisionRoot, yaml));
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
    machine_failure_details: [
      ...machineMissing.map((file) => `missing ${file}`),
      ...receiptFailures,
    ].join("; "),
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

function reviewRevision(root, revisionRoot, yaml) {
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
  const revision = yaml.get(files.revision);
  const inventory = yaml.get(files.inventory);
  const equivalence = yaml.get(files.equivalence);
  const render = yaml.get(files.render);
  const scan = yaml.get(files.scan);
  const gate = yaml.get(files.gate);
  if (inventory.spec?.sourceSHA256 !== releaseSHA) failures.push(digestMismatch(
    "inventory digest mismatch", files.inventory, inventory.spec?.sourceSHA256, releaseSHA, files.release));
  if (revision.spec?.digestInputs?.renderedObjectSetSHA256 !== releaseSHA) failures.push(digestMismatch(
    "variant revision digest mismatch", files.revision, revision.spec?.digestInputs?.renderedObjectSetSHA256, releaseSHA, files.release));
  if (render.spec?.outputs?.renderedObjectSetSHA256 !== releaseSHA) failures.push(digestMismatch(
    "render receipt digest mismatch", files.render, render.spec?.outputs?.renderedObjectSetSHA256, releaseSHA, files.release));
  if (render.spec?.outputs?.deterministicAcrossTwoLocalRenders === false) failures.push("render receipt is not deterministic");
  if (equivalence.spec?.regularHelm?.renderedSHA256 !== releaseSHA) failures.push(digestMismatch(
    "Helm equivalence digest mismatch", files.equivalence, equivalence.spec?.regularHelm?.renderedSHA256, releaseSHA, files.release));
  if (equivalence.spec?.result !== "pass") failures.push("Helm equivalence did not pass");
  if (scan.spec?.renderedObjectSetSHA256 !== releaseSHA) failures.push(digestMismatch(
    "scan digest mismatch", files.scan, scan.spec?.renderedObjectSetSHA256, releaseSHA, files.release));
  if (gate.spec?.renderedObjectSetSHA256 !== releaseSHA) failures.push(digestMismatch(
    "install gate digest mismatch", files.gate, gate.spec?.renderedObjectSetSHA256, releaseSHA, files.release));
  return {
    failures,
    scanHigh: scan.spec?.findingCounts?.high ?? 0,
    scanMedium: scan.spec?.findingCounts?.medium ?? 0,
    objectCount: inventory.spec?.objectCount ?? 0,
    gateDecision: gate.spec?.decision ?? "",
  };
}

function digestMismatch(label, receiptPath, boundSHA, currentSHA, sourcePath) {
  return `${label}: ${relativeRepo(receiptPath)} binds sha256:${boundSHA ?? "missing"} ` +
    `for ${relativeRepo(sourcePath)}; current bytes are sha256:${currentSHA}. ` +
    "Run the receipt producer's verifier/generator for the named receipt, then " +
    "run npm run catalog:review to regenerate this review; do not rewrite a historical receipt by hand.";
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
  if (input.gateDecisions.includes("warn")) gaps.push("install gate warns; production support requires documented disposition or acceptance");
  if (input.controlCategories.includes("crds")) gaps.push("CRD lifecycle policy must be catalog-readable");
  if (input.controlCategories.includes("webhooks")) gaps.push("webhook readiness/observation policy must be catalog-readable");
  if (input.controlCategories.includes("stateful-storage")) gaps.push("stateful storage and rollback policy must be catalog-readable");
  return gaps;
}

function recommendationFor(state, gaps, catalogStatus = null) {
  if (state === "blocked") return "fix machine proof failures first";
  if (state === "catalog-supported") {
    if (catalogStatus?.spec?.productionReadiness === "production-review-ready") {
      return "supported for declared scopes; production support needs final target-scoped decision";
    }
    if (catalogStatus?.spec?.productionReadiness === "blocked-by-current-scan-gate") {
      return "supported for declared scopes; production disposition needed before support review";
    }
    return "catalog-supported with explicit status";
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
    "machine_failure_details",
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
\`docs/planning/catalog-promotion-review.md\` and identifies the human/product review
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
- Warning gates need dispositions, waivers, or stronger mitigations before
  production support.
- Charts with CRDs, webhooks, generated facts, lookup, cluster RBAC, or
  stateful storage need plain-English catalog notes, not only machine receipts.
- Executable fixture paths now point at current \`packages/\` paths; keep this as
  a hard invariant.

## Next Actions

1. Pick 3-5 proof-grade charts from the generated/default set and add
   user-shaped variants before promotion.
2. Record target-scoped production support decisions for review-ready top-20
   charts.
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
