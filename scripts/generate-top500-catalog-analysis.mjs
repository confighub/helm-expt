import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "top500-catalog-analysis");
const rawPath = join(outputRoot, "raw.json");
const reviewCsvPath = join(outputRoot, "review.csv");
const drilldownCsvPath = join(outputRoot, "drilldown.csv");
const summaryPath = join(outputRoot, "summary.md");

// Per-chart "what we can't yet easily enable" gap, from generate-chart-facts.mjs (graceful if absent).
const chartFactsPath = join(repoRoot, "data", "chart-facts", "chart-facts.json");
const chartFacts = existsSync(chartFactsPath) ? JSON.parse(readFileSync(chartFactsPath, "utf8")) : {};
function notYetEnabledFor(chart, hasProof) {
  const ref = String(chart).split("@")[0].split("/").slice(0, 2).join("/");
  if (chartFacts[ref]) return chartFacts[ref].not_yet_enabled;
  return hasProof ? "" : "no recipe yet (source-recon only)";
}
const sourceScanPath = join(repoRoot, "data", "top500-catalog-analysis", "source", "source-feature-scan.raw.json");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const report = buildReport();
  writeReport(report);
  console.log(`wrote ${relativeRepo(rawPath)}`);
  console.log(`wrote ${relativeRepo(reviewCsvPath)}`);
  console.log(`wrote ${relativeRepo(drilldownCsvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(rawPath), "missing top500 catalog analysis raw JSON; run npm run top500:catalog");
  check(existsSync(reviewCsvPath), "missing top500 catalog analysis review CSV; run npm run top500:catalog");
  check(existsSync(drilldownCsvPath), "missing top500 catalog analysis drilldown CSV; run npm run top500:catalog");
  check(existsSync(summaryPath), "missing top500 catalog analysis summary; run npm run top500:catalog");
  check(readFileSync(rawPath, "utf8") === report.rawJson, "top500 catalog analysis raw JSON is stale");
  check(readFileSync(reviewCsvPath, "utf8") === report.reviewCsv, "top500 catalog analysis review CSV is stale");
  check(readFileSync(drilldownCsvPath, "utf8") === report.drilldownCsv, "top500 catalog analysis drilldown CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "top500 catalog analysis summary is stale");
  for (const output of advertisedOutputs(report.summary)) {
    check(existsSync(join(repoRoot, output)), `top500 catalog analysis summary advertises missing output: ${output}`);
  }
  console.log("verified top500 catalog analysis outputs");
} else {
  console.log(`Usage:
  node scripts/generate-top500-catalog-analysis.mjs --generate
  node scripts/generate-top500-catalog-analysis.mjs --verify`);
}

function buildReport() {
  const sourceRows = JSON.parse(readFileSync(sourceScanPath, "utf8"));
  check(Array.isArray(sourceRows), "old top500 matrix raw JSON must be an array");
  check(sourceRows.length === 500, `expected 500 source rows, found ${sourceRows.length}`);
  const proofIndex = currentProofIndex();
  const usedProofIds = new Set();
  const rows = sourceRows.map((source) => {
    const match = matchProof(source, proofIndex, usedProofIds);
    if (match.proof) usedProofIds.add(match.proof.id);
    return buildRow(source, match.proof, match.basis);
  });
  const summary = buildSummary(rows);
  summary.currentProofsTotal = proofIndex.proofs.length;
  summary.currentProofsMatched = usedProofIds.size;
  summary.currentProofsUnmatchedToOldMatrix = proofIndex.proofs.length - usedProofIds.size;
  return {
    rows,
    summary,
    rawJson: `${JSON.stringify({ generatedBy: "scripts/generate-top500-catalog-analysis.mjs", source: relativeRepo(sourceScanPath), summary, rows }, null, 2)}\n`,
    reviewCsv: toCsv(rows, reviewHeaders()),
    drilldownCsv: toCsv(rows, drilldownHeaders()),
    summary: toSummary(summary, rows),
  };
}

function currentProofIndex() {
  const proofs = [];
  const byChart = new Map();
  const byNameVersion = new Map();
  const byName = new Map();
  for (const recipePath of listFiles(join(repoRoot, "recipes")).filter((file) => file.endsWith("/recipe.yaml"))) {
    const root = dirname(recipePath);
    const indexPath = join(root, "artifact-index.yaml");
    const statusPath = join(root, "catalog-status.yaml");
    const helmPlanPath = join(root, "helm-plan.yaml");
    const valueModelPath = join(root, "value-model.yaml");
    const controlPointsPath = join(root, "control-points.yaml");
    check(existsSync(indexPath), `${relativeRepo(root)} missing artifact-index.yaml`);
    const index = readYaml(indexPath);
    const status = readYaml(statusPath);
    const helmPlan = readYaml(helmPlanPath);
    const valueModel = readYaml(valueModelPath);
    const controlPoints = readYaml(controlPointsPath);
    const chart = index.spec?.chart?.ref;
    check(chart, `${relativeRepo(indexPath)} missing chart ref`);
    const variants = index.spec?.variants ?? [];
    const revisions = variants.flatMap((variant) => variant.revisions ?? []);
    const firstRevision = revisions[0] ?? {};
    const receiptKinds = [...new Set(revisions.flatMap((revision) => Object.keys(revision.receipts ?? {})))].sort();
    const controlCategories = (controlPoints.spec?.points ?? []).map((point) => point.category).sort();
    const gateResults = [...new Set(revisions.map((revision) => revision.receipts?.installGate?.result).filter(Boolean))].sort();
    const scanResults = [...new Set(revisions.map((revision) => revision.receipts?.scan?.result).filter(Boolean))].sort();
    const scanCounts = revisions.reduce(
      (acc, revision) => {
        const scanPath = revision.receipts?.scan?.path;
        if (!scanPath) return acc;
        const scan = readYaml(join(repoRoot, scanPath));
        acc.high += Number(scan.spec?.findingCounts?.high ?? 0);
        acc.medium += Number(scan.spec?.findingCounts?.medium ?? 0);
        acc.low += Number(scan.spec?.findingCounts?.low ?? 0);
        return acc;
      },
      { high: 0, medium: 0, low: 0 },
    );
    const proof = {
      id: `${chart}@${index.spec?.chart?.version ?? ""}`,
      chart,
      name: chart.split("/").at(-1),
      version: index.spec?.chart?.version ?? "",
      appVersion: index.spec?.chart?.appVersion ?? "",
      proofTier: helmPlan.metadata?.labels?.["confighub.io/proof-tier"] ?? "",
      recipePath: index.spec?.recipe?.path ?? "",
      packagePath: index.spec?.installerPackage?.path ?? "",
      catalogStatus: status.spec?.status ?? "",
      supportLevel: status.spec?.supportLevel ?? "",
      productionReadiness: status.spec?.productionReadiness ?? "",
      supportedScopes: status.spec?.supportedScopes ?? [],
      variants: variants.map((variant) => variant.name),
      supportedVariants: status.spec?.supportedVariants ?? [],
      candidateVariants: status.spec?.candidateVariants ?? [],
      variantCount: variants.length,
      revisionCount: revisions.length,
      renderedObjectCount: sum(revisions.map((revision) => revision.objectCount)),
      firstRenderedSHA256: firstRevision.renderedObjectSetSHA256 ?? "",
      helmObjectCount: sum(revisions.map((revision) => revision.helmObjectCount)),
      cubObjectCount: sum(revisions.map((revision) => revision.cubInstallObjectCountIncludingSupport)),
      semanticMatches: [...new Set(revisions.map((revision) => revision.semanticObjectMatches).filter(Boolean))].join(";"),
      gateResults,
      scanResults,
      scanHigh: scanCounts.high,
      scanMedium: scanCounts.medium,
      scanLow: scanCounts.low,
      controlCategories,
      usesLookup: Boolean(valueModel.spec?.sourceFeatureSignals?.usesLookup),
      usesGeneratedFacts: Boolean(valueModel.spec?.sourceFeatureSignals?.usesGeneratedFacts),
      usesCapabilities: Boolean(valueModel.spec?.sourceFeatureSignals?.usesCapabilities),
      usesTpl: Boolean(valueModel.spec?.sourceFeatureSignals?.usesTpl),
      hasExtensionSlots: Boolean(valueModel.spec?.sourceFeatureSignals?.hasExtensionSlots),
      hasWeirdnessNote: Boolean(index.spec?.recipe?.weirdnessAndMitigations),
      weirdnessPath: index.spec?.recipe?.weirdnessAndMitigations ?? "",
      receiptKinds,
    };
    proofs.push(proof);
    byChart.set(chart, proof);
    const nameVersion = `${proof.name}@${normalizeVersion(proof.version)}`;
    if (!byNameVersion.has(nameVersion)) byNameVersion.set(nameVersion, []);
    byNameVersion.get(nameVersion).push(proof);
    if (!byName.has(proof.name)) byName.set(proof.name, []);
    byName.get(proof.name).push(proof);
  }
  check(proofs.length === 100, `expected 100 current recipe proofs, found ${proofs.length}`);
  return { proofs, byChart, byNameVersion, byName };
}

function matchProof(source, proofIndex, usedProofIds) {
  const exact = proofIndex.byChart.get(source.chart);
  if (exact && !usedProofIds.has(exact.id)) return { proof: exact, basis: "exact-chart-ref" };
  const byNameVersion = (proofIndex.byNameVersion.get(`${source.name ?? source.chart.split("/").at(-1)}@${normalizeVersion(source.version)}`) ?? [])
    .filter((proof) => !usedProofIds.has(proof.id));
  if (byNameVersion.length === 1) return { proof: byNameVersion[0], basis: "chart-name-version" };
  const byName = proofIndex.byName.get(source.name ?? source.chart.split("/").at(-1)) ?? [];
  const unusedByName = byName.filter((proof) => !usedProofIds.has(proof.id));
  if (byName.length === 1 && unusedByName.length === 1) return { proof: unusedByName[0], basis: "chart-name-only" };
  return { proof: null, basis: "none" };
}

function buildRow(source, proof, matchBasis) {
  const sourceStatus = source.scanStatus === "scanned" ? "source-scanned" : "source-scan-failed";
  const hasProof = Boolean(proof);
  const versionMatch = hasProof && normalizeVersion(proof.version) === normalizeVersion(source.version);
  const recipeStatus = hasProof ? (versionMatch ? "current-recipe-exact-version" : "current-recipe-different-version") : "no-current-recipe";
  const packageStatus = hasProof && proof.packagePath ? "package-proof-exists" : "no-package-proof";
  const variantStatus = hasProof ? (proof.variantCount > 1 ? "multi-variant" : "default-only") : "no-variants";
  const proofStatus = hasProof ? `${proof.proofTier || "proof"}:${proof.revisionCount} revision(s)` : "not-proved";
  const catalogStatus = proof?.catalogStatus ?? "not-in-catalog";
  const nextAction = nextActionFor({ source, proof, versionMatch, sourceStatus, variantStatus, catalogStatus });
  const sourceFeatures = sourceFeatureSummary(source);
  const currentRisk = currentRiskFor({ source, proof, catalogStatus, variantStatus });
  return {
    rank: source.rank,
    chart: source.chart,
    source_version: source.version ?? "",
    current_recipe_version: proof?.version ?? "",
    proof_match_basis: matchBasis,
    version_match: hasProof ? (versionMatch ? "exact" : "different-current-version") : "none",
    source_status: sourceStatus,
    recipe_status: recipeStatus,
    package_status: packageStatus,
    variant_status: variantStatus,
    proof_status: proofStatus,
    catalog_status: catalogStatus,
    support_level: proof?.supportLevel ?? "none",
    production_readiness: proof?.productionReadiness ?? "none",
    supported_scopes: (proof?.supportedScopes ?? []).join(";"),
    supported_variants: (proof?.supportedVariants ?? []).join(";"),
    candidate_variants: (proof?.candidateVariants ?? []).join(";"),
    next_action: nextAction,
    not_yet_enabled: notYetEnabledFor(source.chart, hasProof),
    current_risk: currentRisk,
    source_classification: source.classification ?? "",
    source_problem_score: source.problemScore ?? "",
    source_features: sourceFeatures,
    source_pre_recipe_risk_count: source.preRecipeRiskCount ?? "",
    source_lifecycle_policy_count: source.lifecyclePolicyCount ?? "",
    source_early_policy_count: source.earlyPolicyCount ?? "",
    source_generated_facts_count: source.generatedFactsCount ?? "",
    source_install_operate_count: source.installOperateCount ?? "",
    lookup_count: countFeature(source.lookup),
    rand_count: countFeature(source.randFuncs),
    cert_count: countFeature(source.certFuncs),
    time_uuid_count: countFeature(source.timeUuidFuncs),
    required_fail_count: countFeature(source.requiredOrFail),
    tpl_count: countFeature(source.tpl),
    capabilities_api_count: countFeature(source.capabilitiesAPIs),
    capabilities_kube_version_count: countFeature(source.capabilitiesKubeVersion),
    hooks_count: countFeature(source.hooks),
    crd_files_count: source.crdFiles ?? 0,
    cluster_roles_count: source.clusterRoles ?? 0,
    webhooks_count: Number(source.validatingWebhooks ?? 0) + Number(source.mutatingWebhooks ?? 0),
    api_services_count: source.apiServices ?? 0,
    stateful_sets_count: source.statefulSets ?? 0,
    pvc_count: source.persistentVolumeClaims ?? 0,
    secrets_count: source.secrets ?? 0,
    dependencies_declared: source.dependenciesDeclared ?? 0,
    dependency_lock_present: Boolean(source.dependencyLockPresent),
    non_exact_dependency_constraints: source.nonExactDependencyConstraints ?? 0,
    proof_tier: proof?.proofTier ?? "",
    proof_variant_count: proof?.variantCount ?? 0,
    proof_revision_count: proof?.revisionCount ?? 0,
    proof_rendered_object_count: proof?.renderedObjectCount ?? 0,
    proof_first_rendered_sha256: proof?.firstRenderedSHA256 ?? "",
    proof_semantic_matches: proof?.semanticMatches ?? "",
    proof_scan_results: (proof?.scanResults ?? []).join(";"),
    proof_gate_results: (proof?.gateResults ?? []).join(";"),
    proof_scan_high: proof?.scanHigh ?? "",
    proof_scan_medium: proof?.scanMedium ?? "",
    proof_scan_low: proof?.scanLow ?? "",
    proof_control_categories: (proof?.controlCategories ?? []).join(";"),
    proof_uses_lookup: proof?.usesLookup ?? "",
    proof_uses_generated_facts: proof?.usesGeneratedFacts ?? "",
    proof_uses_capabilities: proof?.usesCapabilities ?? "",
    proof_uses_tpl: proof?.usesTpl ?? "",
    proof_has_extension_slots: proof?.hasExtensionSlots ?? "",
    proof_receipts: (proof?.receiptKinds ?? []).join(";"),
    weirdness_note: proof?.weirdnessPath ?? "",
    recipe_path: proof?.recipePath ?? "",
    package_path: proof?.packagePath ?? "",
    source_repository_url: source.repoURL ?? "",
    source_archive_sha256: source.archiveSHA256 ?? "",
    old_matrix_scan_status: source.scanStatus ?? "",
    old_matrix_error: source.directError ?? "",
  };
}

function nextActionFor({ source, proof, versionMatch, sourceStatus, variantStatus, catalogStatus }) {
  if (sourceStatus === "source-scan-failed") return "repair source acquisition before recipe proof";
  if (!proof) return "create recipe, package, variants, rendered digest, scans, and receipts";
  if (!versionMatch) return "review source/current-version drift and refresh recipe if needed";
  if (catalogStatus === "catalog-supported") return "add production dispositions and live/e2e observation lane";
  if (variantStatus === "default-only") return "add user-shaped variants before catalog promotion";
  return "run catalog promotion review";
}

function currentRiskFor({ source, proof, catalogStatus, variantStatus }) {
  if (!proof) return source.classification?.startsWith("P0") ? "source-risk-no-proof" : "not-yet-proved";
  if (catalogStatus === "catalog-supported") return "local-test-supported-production-blocked";
  if (variantStatus === "default-only") return "proof-grade-needs-variants";
  return "needs-promotion-review";
}

function sourceFeatureSummary(source) {
  const features = [];
  if (countFeature(source.lookup)) features.push("lookup");
  if (countFeature(source.randFuncs) || countFeature(source.certFuncs) || countFeature(source.timeUuidFuncs)) {
    features.push("generated-facts");
  }
  if (countFeature(source.tpl)) features.push("tpl");
  if (countFeature(source.capabilitiesAPIs) || countFeature(source.capabilitiesKubeVersion)) features.push("capabilities");
  if (countFeature(source.hooks)) features.push("hooks");
  if (Number(source.crdFiles ?? 0)) features.push("crds");
  if (Number(source.clusterRoles ?? 0) || Number(source.clusterRoleBindings ?? 0)) features.push("cluster-rbac");
  if (Number(source.validatingWebhooks ?? 0) || Number(source.mutatingWebhooks ?? 0)) features.push("webhooks");
  if (Number(source.statefulSets ?? 0) || Number(source.persistentVolumeClaims ?? 0)) features.push("stateful-storage");
  if (Number(source.extraManifestValues ?? 0)) features.push("raw-extension-slots");
  return features.join(";") || "plain-ish";
}

function buildSummary(rows) {
  return {
    rows: rows.length,
    sourceScanned: rows.filter((row) => row.source_status === "source-scanned").length,
    sourceFailed: rows.filter((row) => row.source_status === "source-scan-failed").length,
    currentRecipeRows: rows.filter((row) => row.recipe_status.startsWith("current-recipe")).length,
    proofMatchExactChart: rows.filter((row) => row.proof_match_basis === "exact-chart-ref").length,
    proofMatchNameVersion: rows.filter((row) => row.proof_match_basis === "chart-name-version").length,
    proofMatchNameOnly: rows.filter((row) => row.proof_match_basis === "chart-name-only").length,
    exactCurrentVersionRows: rows.filter((row) => row.version_match === "exact").length,
    differentCurrentVersionRows: rows.filter((row) => row.version_match === "different-current-version").length,
    noCurrentRecipeRows: rows.filter((row) => row.recipe_status === "no-current-recipe").length,
    catalogSupported: rows.filter((row) => row.catalog_status === "catalog-supported").length,
    proofGrade: rows.filter((row) => row.catalog_status === "proof-grade").length,
    defaultOnlyProofs: rows.filter((row) => row.variant_status === "default-only").length,
    multiVariantProofs: rows.filter((row) => row.variant_status === "multi-variant").length,
    productionBlockedSupported: rows.filter(
      (row) => row.catalog_status === "catalog-supported" && row.production_readiness === "blocked-by-current-scan-gate",
    ).length,
  };
}

function toSummary(summary, rows) {
  const topNext = rows
    .filter((row) => row.next_action === "add user-shaped variants before catalog promotion")
    .slice(0, 10);
  const missing = rows.filter((row) => row.recipe_status === "no-current-recipe").slice(0, 10);
  return `# Top-500 Catalog Analysis

This is the public catalog proof index for the Helm mission.

It combines two kinds of evidence:

\`\`\`text
source-feature reconnaissance
  + current ConfigHub/cub installer recipe evidence
\`\`\`

The source scan tells us what Helm complexity exists in popular charts. The
catalog proof columns tell us whether this repo already has a current recipe,
package, variant, rendered digest, scan/gate evidence, and catalog status for
that chart.

## Summary

\`\`\`text
rows: ${summary.rows}
source scanned: ${summary.sourceScanned}
source failed: ${summary.sourceFailed}
current proof recipes in repo: ${summary.currentProofsTotal}
current proof recipes matched to old matrix rows: ${summary.currentProofsMatched}
current proof recipes not represented in old matrix rows: ${summary.currentProofsUnmatchedToOldMatrix}
current recipe proofs: ${summary.currentRecipeRows}
proof matched by exact chart ref: ${summary.proofMatchExactChart}
proof matched by chart name and version: ${summary.proofMatchNameVersion}
proof matched by chart name only: ${summary.proofMatchNameOnly}
exact source/current version matches: ${summary.exactCurrentVersionRows}
current recipe version differs from old source row: ${summary.differentCurrentVersionRows}
no current recipe proof: ${summary.noCurrentRecipeRows}
catalog-supported: ${summary.catalogSupported}
proof-grade: ${summary.proofGrade}
multi-variant proofs: ${summary.multiVariantProofs}
default-only proofs: ${summary.defaultOnlyProofs}
supported but production-blocked: ${summary.productionBlockedSupported}
\`\`\`

## What We Learn

- Helm complexity is normal, not exceptional. The high-rank rows include CRDs,
  hooks, generated facts, lookup, tpl, RBAC, webhooks, and stateful storage.
- ${summary.currentProofsTotal} current recipe/package/proof artifacts exist in this repo.
- ${summary.currentRecipeRows} of the top-500 source rows currently match those
  proof artifacts.
- ${summary.catalogSupported} matched rows are catalog-supported for the
  declared \`local-test\` scope.
- ${summary.proofGrade} matched rows are proof-grade default installs. They
  prove deterministic render/package behavior, but they still need
  user-shaped variants before catalog promotion.
- ${summary.noCurrentRecipeRows} rows still have source reconnaissance only.
  They are useful backlog data, not product proof.
- ${summary.differentCurrentVersionRows} rows have a current recipe for the
  chart but at a different version than the original source-scan row. These are
  upgrade/freshness review candidates.
- The practical next work is visible: add variants to high-rank proof-grade
  charts, add production dispositions to local-test supported charts, and
  create recipes for high-rank rows with no current proof.

## Recent Catalog Learnings (2026-06)

- **"Supported" means Level 2.** A chart is supported when every Helm quirk it uses is
  either modeled or explicitly disclosed (operator-decision / blocker) with zero silent
  gaps. Variant richness is an *enhancement* on top of that bar, not the bar itself — all
  ${summary.currentProofsTotal} current proof recipes are Level-2 supported.
- **A deterministic variant generator now promotes enhancement variants.**
  \`scripts/generate-variant-proof.mjs\` captures a \`helm template\` render as a package
  base, proves Helm-equivalence (\`cub installer setup\` re-emits it), and regenerates all
  bookkeeping; \`scripts/run-variant-wave.mjs\` drives it in resumable waves. Three waves
  (no-crds ×2, ha) lifted multi-variant proofs in this matrix to ${summary.multiVariantProofs}.
- **Hooks are routed through lifecycle policy.** Render equivalence does not prove hook
  execution. A chart with hooks still needs a lifecycle disposition for the chosen route,
  such as plain applied resources, GitOps-controller behavior, or an operator-reviewed
  action, plus lifecycle or observation receipts before production support.
- **Placeholders ≠ extension slots.** Safe, bounded fill-fields (image, replicas, hostname)
  are *placeholders* — filled on derived ConfigHub variants with no re-render. Open
  injection points (\`extraManifests\`, \`tpl\`) are *extension slots* — arbitrary,
  shape-changing, flagged for per-use review. Governed differently.
- **Honest gaps, disclosed not hidden:** secret-delivery (many secret-rendering charts ship
  no \`existing-secret\` toggle, so that variant isn't buildable); template-rendered CRDs
  (17 charts bake CRDs in \`templates/\` not \`crds/\`, so a clean no-crds variant needs a
  chart-specific \`--set\` toggle or isn't available); curated proof-lane drift (the 20
  curated per-chart lanes carry a pre-existing \`installer.yaml\` source-SHA mismatch from
  target-facts / namespace-transformer changes — tracked separately).

## How To Read The Files

| File | Use |
| --- | --- |
| \`summary.md\` | Human summary and next actions. |
| \`review.csv\` | Short front sheet: one row per top-500 chart with proof/catalog status. |
| \`drilldown.csv\` | Wider evidence table for control points and source features. |
| \`raw.json\` | Machine-readable generated report. |
| \`source/source-feature-scan.raw.json\` | Historical source scan input used to build the current catalog analysis. |

## Important Boundary

This matrix is an evidence map, not a blanket certification.

\`\`\`text
catalog-supported = recommended only for the declared scope
proof-grade = deterministic proof exists, but product variants/review remain
source reconnaissance only = no product proof yet
\`\`\`

## Next Promotion Candidates

These are high-rank proof-grade rows that need real variants before promotion.

| Rank | Chart | Current version | Source features | Next action |
| ---: | --- | --- | --- | --- |
${topNext.map((row) => `| ${row.rank} | \`${row.chart}\` | ${row.current_recipe_version} | ${row.source_features} | ${row.next_action} |`).join("\n")}

## First Rows Without Current Proof

| Rank | Chart | Source version | Source classification | Next action |
| ---: | --- | --- | --- | --- |
${missing.map((row) => `| ${row.rank} | \`${row.chart}\` | ${row.source_version} | ${row.source_classification} | ${row.next_action} |`).join("\n")}

## Outputs

\`\`\`text
data/top500-catalog-analysis/raw.json
data/top500-catalog-analysis/review.csv
data/top500-catalog-analysis/drilldown.csv
data/top500-catalog-analysis/summary.md
data/top500-catalog-analysis/source/source-feature-scan.raw.json
\`\`\`
`;
}

function advertisedOutputs(summary) {
  const match = summary.match(/## Outputs\n\n```text\n([\s\S]*?)\n```/);
  check(match, "top500 catalog analysis summary must contain an Outputs block");
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function reviewHeaders() {
  return [
    "rank",
    "chart",
    "source_version",
    "current_recipe_version",
    "proof_match_basis",
    "version_match",
    "source_status",
    "recipe_status",
    "package_status",
    "variant_status",
    "proof_status",
    "catalog_status",
    "production_readiness",
    "supported_variants",
    "next_action",
    "not_yet_enabled",
    "source_features",
    "recipe_path",
    "package_path",
  ];
}

function drilldownHeaders() {
  return [
    ...reviewHeaders(),
    "support_level",
    "supported_scopes",
    "candidate_variants",
    "current_risk",
    "source_classification",
    "source_problem_score",
    "source_pre_recipe_risk_count",
    "source_lifecycle_policy_count",
    "source_early_policy_count",
    "source_generated_facts_count",
    "source_install_operate_count",
    "lookup_count",
    "rand_count",
    "cert_count",
    "time_uuid_count",
    "required_fail_count",
    "tpl_count",
    "capabilities_api_count",
    "capabilities_kube_version_count",
    "hooks_count",
    "crd_files_count",
    "cluster_roles_count",
    "webhooks_count",
    "api_services_count",
    "stateful_sets_count",
    "pvc_count",
    "secrets_count",
    "dependencies_declared",
    "dependency_lock_present",
    "non_exact_dependency_constraints",
    "proof_tier",
    "proof_variant_count",
    "proof_revision_count",
    "proof_rendered_object_count",
    "proof_first_rendered_sha256",
    "proof_semantic_matches",
    "proof_scan_results",
    "proof_gate_results",
    "proof_scan_high",
    "proof_scan_medium",
    "proof_scan_low",
    "proof_control_categories",
    "proof_uses_lookup",
    "proof_uses_generated_facts",
    "proof_uses_capabilities",
    "proof_uses_tpl",
    "proof_has_extension_slots",
    "proof_receipts",
    "weirdness_note",
    "source_repository_url",
    "source_archive_sha256",
    "old_matrix_scan_status",
    "old_matrix_error",
  ];
}

function toCsv(rows, headers) {
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function writeReport(report) {
  mkdirSync(outputRoot, { recursive: true });
  write(rawPath, report.rawJson);
  write(reviewCsvPath, report.reviewCsv);
  write(drilldownCsvPath, report.drilldownCsv);
  write(summaryPath, report.summary);
}

function countFeature(value) {
  if (value && typeof value === "object" && "count" in value) return Number(value.count ?? 0);
  return Number(value ?? 0);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function normalizeVersion(version) {
  return String(version ?? "").replace(/^v/, "");
}
