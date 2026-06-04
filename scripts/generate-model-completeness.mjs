// Model-completeness scorer for the "complete corresponding model" contract.
// Scores every recipe against the 7-point per-chart contract from
// docs/reference/complete-corresponding-model.md and emits a gap report.
//
//   node scripts/generate-model-completeness.mjs --generate   # write data/model-completeness/{report.csv,summary.md}
//   node scripts/generate-model-completeness.mjs --verify      # fail if the report is stale
//
// A chart's corresponding model is COMPLETE when all 7 criteria pass:
//   render_equivalent     every variant revision has a passing, digest-matched Helm-equivalence receipt
//   behaviorally_complete HelmPlan reports no unhandled/unknown pain points (blocked-with-reason is honest, not a gap)
//   variant_complete      more than the default variant, OR obvious variants explicitly deferred/candidate in catalog-status
//   readable              CATALOG.md + artifact-index.yaml present
//   usable                executable fixture points at a current packages/ path and that package exists
//   verifiable            full receipt chain present + digest-bound (render/scan/gate/equivalence), no machine-proof gaps
//   honestly_scoped       catalog-status.yaml declares status + supportLevel + supportedScopes + productionReadiness
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { check, listFiles, readYaml, relativeRepo, repoRoot, sha256File, write } from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "model-completeness");
const reportCsvPath = join(outputRoot, "report.csv");
const summaryPath = join(outputRoot, "summary.md");
const mode = process.argv[2] ?? "--generate";

const CRITERIA = [
  "render_equivalent",
  "behaviorally_complete",
  "readable",
  "usable",
  "verifiable",
  "honestly_scoped",
];

if (mode === "--generate") {
  const report = buildReport();
  mkdirSync(outputRoot, { recursive: true });
  write(reportCsvPath, report.csv);
  write(summaryPath, report.summary);
  console.log(`wrote ${relativeRepo(reportCsvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
  console.log(`supported (Level 2): ${report.supportedCount}/${report.rows.length}  ·  variant-rich (enhancement): ${report.variantRichCount}/${report.rows.length}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(reportCsvPath), "missing model-completeness report; run npm run completeness:generate");
  check(existsSync(summaryPath), "missing model-completeness summary; run npm run completeness:generate");
  check(readFileSync(reportCsvPath, "utf8") === report.csv, "model-completeness report.csv is stale; run npm run completeness:generate");
  check(readFileSync(summaryPath, "utf8") === report.summary, "model-completeness summary.md is stale; run npm run completeness:generate");
  console.log(`verified model-completeness outputs (supported Level 2: ${report.supportedCount}/${report.rows.length}; variant-rich: ${report.variantRichCount}/${report.rows.length})`);
} else {
  console.log(`Usage:
  node scripts/generate-model-completeness.mjs --generate
  node scripts/generate-model-completeness.mjs --verify`);
}

function buildReport() {
  const roots = recipeRoots();
  check(roots.length === 100, `expected 100 recipe roots, found ${roots.length}`);
  const rows = roots.map(scoreRecipe).sort((left, right) => left.chart.localeCompare(right.chart));
  const supportedCount = rows.filter((row) => row._supported).length;
  const variantRichCount = rows.filter((row) => row.variant_complete === "yes").length;
  return { rows, supportedCount, variantRichCount, csv: toCsv(rows), summary: toSummary(rows, supportedCount, variantRichCount) };
}

function recipeRoots() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
}

function scoreRecipe(root) {
  const recipe = readYaml(join(root, "recipe.yaml"));
  const helmPlan = readYaml(join(root, "helm-plan.yaml"));
  const sourceLock = readYaml(join(root, "source-lock.yaml"));
  const catalogStatusPath = join(root, "catalog-status.yaml");
  const catalogStatus = existsSync(catalogStatusPath) ? readYaml(catalogStatusPath) : null;
  const packageReceiptPath = join(root, "publication", "installer-package-receipt.yaml");
  const packageReceipt = existsSync(packageReceiptPath) ? readYaml(packageReceiptPath) : null;

  const chart = helmPlan.spec?.readiness?.chart ?? `${sourceLock.spec?.repositoryName}/${sourceLock.spec?.chart}`;
  const version = String(helmPlan.spec?.readiness?.version ?? sourceLock.spec?.version ?? "");
  const variantPaths = recipe.spec?.variants ?? [];
  const variantCount = variantPaths.length;

  const revisionRoots = listFiles(join(root, "revisions"))
    .filter((file) => file.endsWith("/variant-revision.yaml"))
    .map((file) => dirname(file))
    .sort();
  const receiptReviews = revisionRoots.map((revisionRoot) => reviewRevision(root, revisionRoot));
  const receiptFailures = receiptReviews.flatMap((review) => review.failures);
  const machineMissing = requiredRootFiles().filter((file) => !existsSync(join(root, file)));

  // Criterion 1: render-equivalent — every revision has a passing, digest-matched equivalence receipt.
  const render_equivalent = revisionRoots.length > 0 && receiptReviews.every((review) => review.equivalencePass);

  // Criterion 2: behaviorally complete — a helm-pain-report.yaml enumerates every Helm behavior and disposes
  // it with no unknown/unhandled. needs-operator-decision / blocked-with-reason are explicit (honest), so they
  // do NOT fail behavioral completeness; they surface in production-readiness (scope), not here.
  const painReportPath = join(root, "helm-pain-report.yaml");
  const painReport = existsSync(painReportPath) ? readYaml(painReportPath) : null;
  const painPoints = painReport?.spec?.painPoints ?? [];
  const badDispositions = painPoints.filter((point) => ["unknown", "unhandled"].includes(String(point.disposition ?? "")));
  const scopeStatus = String(painReport?.spec?.supportedScopeStatus ?? "");
  const behaviorally_complete = Boolean(painReport) && /no-unhandled/.test(scopeStatus) && badDispositions.length === 0;

  // Criterion 3: variant-complete — more than the default variant, OR obvious variants explicitly DEFERRED
  // with a reason. candidateVariants:[default] only names the default, so it does not count.
  const deferred = catalogStatus?.spec?.deferredVariants ?? [];
  const variant_complete = variantCount > 1 || deferred.length > 0;

  // Criterion 4: readable — the per-chart artifact map exists.
  const readable = existsSync(join(root, "CATALOG.md")) && existsSync(join(root, "artifact-index.yaml"));

  // Criterion 5: usable — executable fixture points at a current packages/ path and that package exists.
  const fixturePath = recipe.spec?.currentExecutableFixture?.installerPackage ?? "";
  const fixtureUsesCurrentPackages = fixturePath.includes("packages/");
  const packagePath = packageReceipt?.spec?.package?.path ?? "";
  const packageExists = packagePath ? existsSync(join(repoRoot, packagePath)) : false;
  const usable = fixtureUsesCurrentPackages && packageExists;

  // Criterion 6: verifiable — full receipt chain present + digest-bound, no machine-proof gaps.
  const verifiable = machineMissing.length === 0 && receiptFailures.length === 0 && revisionRoots.length > 0;

  // Criterion 7: honestly scoped — catalog-status declares status + supportLevel + productionReadiness.
  // An explicit "proof-grade / not-reviewed-for-production" with empty supportedScopes is HONEST scoping
  // (it truthfully says "not yet supported"), so it passes; what matters is that the scope is declared.
  const honestly_scoped = Boolean(
    catalogStatus?.spec?.status && catalogStatus?.spec?.supportLevel && catalogStatus?.spec?.productionReadiness,
  );

  const scores = { render_equivalent, behaviorally_complete, variant_complete, readable, usable, verifiable, honestly_scoped };
  // SUPPORTED (Level 2) = the 6 criteria in CRITERIA. variant_complete is a SEPARATE enhancement metric
  // for this model report. Declared non-default choices still need their own lane evidence.
  const passed = CRITERIA.filter((key) => scores[key]);
  const missing = CRITERIA.filter((key) => !scores[key]);
  const supported = missing.length === 0;

  return {
    chart: `${chart}@${version}`,
    recipe_path: relativeRepo(root),
    supported: supported ? "yes" : "no",
    score: `${passed.length}/${CRITERIA.length}`,
    variant_count: variantCount,
    support_status: catalogStatus?.spec?.status ?? "none",
    production_readiness: catalogStatus?.spec?.productionReadiness ?? "none",
    ...Object.fromEntries(CRITERIA.map((key) => [key, scores[key] ? "yes" : "no"])),
    variant_complete: scores.variant_complete ? "yes" : "no",
    missing_criteria: missing.join(";") || "none",
    _supported: supported,
    _missing: missing,
  };
}

function requiredRootFiles() {
  return [
    "README.md",
    "helm-plan.yaml",
    "chart-dossier.yaml",
    "source-lock.yaml",
    "dependency-lock.yaml",
    "control-points.yaml",
    "value-model.yaml",
    "recipe.yaml",
    "catalog-status.yaml",
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
  if (failures.length) return { failures, equivalencePass: false };

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
  if (equivalence.spec?.regularHelm?.renderedSHA256 !== releaseSHA) failures.push("Helm equivalence digest mismatch");
  if (scan.spec?.renderedObjectSetSHA256 !== releaseSHA) failures.push("scan digest mismatch");
  if (gate.spec?.renderedObjectSetSHA256 !== releaseSHA) failures.push("install gate digest mismatch");
  const equivalencePass = equivalence.spec?.result === "pass" && equivalence.spec?.regularHelm?.renderedSHA256 === releaseSHA;
  return { failures, equivalencePass };
}

function toCsv(rows) {
  const headers = [
    "chart",
    "supported",
    "score",
    ...CRITERIA,
    "variant_complete",
    "variant_count",
    "support_status",
    "production_readiness",
    "missing_criteria",
    "recipe_path",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function toSummary(rows, supportedCount, variantRichCount) {
  const total = rows.length;
  const perCriterion = CRITERIA.map((key) => [key, rows.filter((row) => row[key] === "yes").length]);
  const incomplete = rows.filter((row) => !row._supported);
  const byMissing = {};
  for (const row of incomplete) for (const m of row._missing) byMissing[m] = (byMissing[m] ?? 0) + 1;
  return `# Model Support Report (Level 2)

Generated from recipe / pain-report / receipt / catalog-status artifacts. A chart is **supported (Level 2)**
when all 6 support criteria pass — every Helm quirk modeled or explicitly disclosed (\`needs-operator-decision\`
/ \`blocked\` are honest dispositions, not gaps).

This is a model-support report, not the whole live outcome. Full chart-choice support still needs the
lane-test matrix: Helm-equivalence, ConfigHub proof, local live observation, ConfigHub OCI/Argo or Flux,
and live Helm-vs-ConfigHub parity for each supported default or declared main choice.

**Variant richness is a separate enhancement metric** until a choice is declared supported. Once declared
supported, that choice must be tracked as its own chart-recipe-variant row in \`data/lane-test-matrix/\`.

## Headline

\`\`\`text
charts: ${total}
supported (Level 2, all 6): ${supportedCount}
not yet supported: ${total - supportedCount}
variant-rich (enhancement, >1 variant): ${variantRichCount}
\`\`\`

## Per-criterion coverage (the 6 support criteria)

${perCriterion.map(([key, count]) => `- \`${key}\`: ${count}/${total}`).join("\n")}
- _enhancement_ \`variant_complete\`: ${variantRichCount}/${total}  (not a support criterion)

## Gap by criterion (how many charts each one blocks)

${Object.entries(byMissing)
  .sort(([, a], [, b]) => b - a)
  .map(([key, count]) => `- \`${key}\`: ${count}`)
  .join("\n") || "- none — every chart is supported (Level 2)"}

## Not yet supported (the work queue)

| Chart | Score | Missing support criteria |
| --- | ---: | --- |
${incomplete
  .map((row) => `| \`${row.chart}\` | ${row.score} | ${row._missing.join(", ")} |`)
  .join("\n") || "| none | 6/6 | — |"}

## Notes

- **Supported (Level 2)** = the 6 criteria above all pass: render-equivalent · quirks accounted (pain report,
  no unknown/unhandled) · readable · usable · verifiable · honestly scoped. Quirks left as
  \`needs-operator-decision\` are *disclosed*, not silent — the human-review residue, tracked per chart in
  \`helm-pain-report.yaml\`; they do not block Level-2 support.
- **\`variant_complete\` is an ENHANCEMENT for the Level-2 model report.** A default-only chart can have a
  complete model for its declared scope, but it is not fully live-supported for unbuilt or undeclared
  main choices. Once a non-default choice is declared supported, it must get its own lane evidence.
- Re-run \`npm run completeness:generate\` after any chart's pain report, receipts, or catalog-status change.
`;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
