import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const siteRoot = join(repoRoot, "site");
const chartPagesRoot = join(siteRoot, "charts");
const indexPath = join(siteRoot, "index.html");
const offeringPath = join(siteRoot, "offering.html");
const tryPath = join(siteRoot, "try.html");
const howItWorksPath = join(siteRoot, "how-it-works.html");
const variantsPath = join(siteRoot, "variants.html");
const customAppsPath = join(siteRoot, "custom-apps.html");
const operationsPath = join(siteRoot, "operations.html");
const docsPath = join(siteRoot, "docs.html");
const proofPath = join(siteRoot, "proof.html");
const hardQuestionsPath = join(siteRoot, "hard-questions.html");
const knownGapsPath = join(siteRoot, "known-gaps.html");
const hooksPath = join(siteRoot, "hooks.html");
const tiersPath = join(siteRoot, "tiers.html");
const privateRoot = join(siteRoot, "private");
const privateIndexPath = join(privateRoot, "index.html");
const journeyPath = join(siteRoot, "journey.html");
const day1OperationsPath = join(siteRoot, "day1-operations.html");
const chartIndexPath = join(chartPagesRoot, "index.html");
const catalogJsonPath = join(siteRoot, "catalog.json");
const readmePath = join(siteRoot, "README.md");
const generatedAtPath = join(siteRoot, "generated-at.txt");
const top100Path = join(repoRoot, "data", "top100-catalog-analysis", "raw.json");
const top500Path = join(repoRoot, "data", "top500-catalog-analysis", "raw.json");
const latestReadinessPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");
const latestReplacementDecisionsPath = join(repoRoot, "data", "latest-top20-refresh", "replacement-decisions", "decisions.csv");
const latestActionQueuePath = join(repoRoot, "data", "latest-top20-refresh", "action-queue", "queue.csv");
const runtimeWavePath = join(repoRoot, "data", "runtime-gitops", "wave1.csv");
const imageDigestSubjectsPath = join(repoRoot, "data", "image-digest-workdown", "all-subjects.csv");
const nextTenGapsPath = join(repoRoot, "data", "next-ten-waves", "gap-review-wave.csv");
const statusDashboardPath = join(repoRoot, "data", "status-dashboard", "status.csv");
const activeProofQueuePath = join(repoRoot, "data", "status-dashboard", "active-proof-queue.csv");
const outcomeEvidenceContractPath = join(repoRoot, "data", "outcome-evidence-contract", "summary.md");
const baseReadinessPath = join(repoRoot, "data", "top20-base-readiness", "base-readiness.csv");
const extensionSlotsPath = join(repoRoot, "data", "extension-slots", "extension-slots.csv");
const chartUseGuidePath = join(repoRoot, "data", "chart-use-guide", "chart-use-guide.csv");
const top100ReadinessPath = join(repoRoot, "data", "top100-readiness", "readiness.csv");
const top100UserReadinessPath = join(repoRoot, "data", "top100-user-readiness", "readiness.csv");
const top100CoverageWorkQueuePath = join(repoRoot, "data", "top100-coverage", "work-queue.csv");
const usefulBaseDesignQueuePath = join(repoRoot, "data", "useful-base-design-queue", "summary.md");
const top100PromotionWavePath = join(repoRoot, "data", "top100-promotion-wave", "wave.csv");
const refreshSurvivalPath = join(repoRoot, "data", "refresh-survival", "refreshes.csv");
const liveParityRerunPlanPath = join(repoRoot, "data", "live-parity-rerun-plan", "rerun-plan.csv");
const productionDispositionPath = join(repoRoot, "data", "production-disposition", "top20.csv");
const productionSupportDecisionsPath = join(repoRoot, "data", "production-support-decisions", "decisions.csv");
const scanDispositionPath = join(repoRoot, "data", "scan-disposition-workdown", "workdown.csv");
const highFanoutPath = join(repoRoot, "data", "high-fanout-demo", "prometheus-kps.csv");
const hardChartPacketsSummaryPath = join(repoRoot, "data", "hard-chart-production-packets", "summary.md");
const lifecycleRoutesJsonPath = join(repoRoot, "data", "lifecycle-routes", "routes.json");
const lifecycleRouteActionsJsonPath = join(repoRoot, "data", "lifecycle-route-actions", "actions.json");
const lifecycleByVariantJsonPath = join(repoRoot, "data", "lifecycle-routes-by-variant", "by-variant.json");
const chartSkillsJsonPath = join(repoRoot, "data", "chart-skills", "skills.json");
const chartEvidenceRouterPath = join(repoRoot, "data", "chart-evidence-router", "router.csv");
const masterCatalogMatrixPath = join(repoRoot, "data", "master-catalog-matrix", "matrix.csv");
const cubAdoptionCaveatsPath = join(repoRoot, "data", "cub-adoption-caveats", "caveats.csv");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const generatedAt = process.env.HELM_EXPT_SITE_GENERATED_AT || new Date().toISOString();
  const site = buildSite(generatedAt);
  rmSync(chartPagesRoot, { recursive: true, force: true });
  rmSync(privateRoot, { recursive: true, force: true });
  write(indexPath, site.indexHtml);
  write(offeringPath, site.offeringHtml);
  write(tryPath, site.tryHtml);
  write(howItWorksPath, site.howItWorksHtml);
  write(variantsPath, site.variantsHtml);
  write(customAppsPath, site.customAppsHtml);
  write(operationsPath, site.operationsHtml);
  write(docsPath, site.docsHtml);
  write(proofPath, site.proofHtml);
  write(hardQuestionsPath, site.hardQuestionsHtml);
  write(knownGapsPath, site.knownGapsHtml);
  write(hooksPath, site.hooksHtml);
  write(tiersPath, site.tiersRedirectHtml);
  write(privateIndexPath, site.privateHtml);
  write(journeyPath, site.journeyHtml);
  write(day1OperationsPath, site.day1OperationsHtml);
  write(join(siteRoot, "matrix.html"), site.matrixHtml);
  write(chartIndexPath, site.chartIndexHtml);
  for (const page of site.chartPages) write(page.path, page.html);
  write(catalogJsonPath, site.catalogJson);
  write(readmePath, site.readme);
  write(generatedAtPath, `${generatedAt}\n`);
  console.log(`wrote public site outputs and ${site.chartPages.length} chart page(s)`);
} else if (mode === "--verify") {
  check(existsSync(generatedAtPath), "site/generated-at.txt is missing; run npm run site:generate");
  const site = buildSite(readFileSync(generatedAtPath, "utf8").trim());
  check(existsSync(indexPath), "site/index.html is missing; run npm run site:generate");
  check(existsSync(offeringPath), "site/offering.html is missing; run npm run site:generate");
  check(existsSync(tryPath), "site/try.html is missing; run npm run site:generate");
  check(existsSync(howItWorksPath), "site/how-it-works.html is missing; run npm run site:generate");
  check(existsSync(variantsPath), "site/variants.html is missing; run npm run site:generate");
  check(existsSync(customAppsPath), "site/custom-apps.html is missing; run npm run site:generate");
  check(existsSync(operationsPath), "site/operations.html is missing; run npm run site:generate");
  check(existsSync(docsPath), "site/docs.html is missing; run npm run site:generate");
  check(existsSync(proofPath), "site/proof.html is missing; run npm run site:generate");
  check(existsSync(hardQuestionsPath), "site/hard-questions.html is missing; run npm run site:generate");
  check(existsSync(knownGapsPath), "site/known-gaps.html is missing; run npm run site:generate");
  check(existsSync(hooksPath), "site/hooks.html is missing; run npm run site:generate");
  check(existsSync(tiersPath), "site/tiers.html is missing; run npm run site:generate");
  check(existsSync(privateIndexPath), "site/private/index.html is missing; run npm run site:generate");
  check(existsSync(journeyPath), "site/journey.html is missing; run npm run site:generate");
  check(existsSync(day1OperationsPath), "site/day1-operations.html is missing; run npm run site:generate");
  check(existsSync(chartIndexPath), "site/charts/index.html is missing; run npm run site:generate");
  check(existsSync(catalogJsonPath), "site/catalog.json is missing; run npm run site:generate");
  check(existsSync(readmePath), "site/README.md is missing; run npm run site:generate");
  check(existsSync(generatedAtPath), "site/generated-at.txt is missing; run npm run site:generate");
  check(readFileSync(indexPath, "utf8") === site.indexHtml, "site/index.html is stale");
  check(readFileSync(offeringPath, "utf8") === site.offeringHtml, "site/offering.html is stale");
  check(readFileSync(tryPath, "utf8") === site.tryHtml, "site/try.html is stale");
  check(readFileSync(howItWorksPath, "utf8") === site.howItWorksHtml, "site/how-it-works.html is stale");
  check(readFileSync(variantsPath, "utf8") === site.variantsHtml, "site/variants.html is stale");
  check(readFileSync(customAppsPath, "utf8") === site.customAppsHtml, "site/custom-apps.html is stale");
  check(readFileSync(operationsPath, "utf8") === site.operationsHtml, "site/operations.html is stale");
  check(readFileSync(docsPath, "utf8") === site.docsHtml, "site/docs.html is stale");
  check(readFileSync(proofPath, "utf8") === site.proofHtml, "site/proof.html is stale");
  check(readFileSync(hardQuestionsPath, "utf8") === site.hardQuestionsHtml, "site/hard-questions.html is stale");
  check(readFileSync(knownGapsPath, "utf8") === site.knownGapsHtml, "site/known-gaps.html is stale");
  check(readFileSync(hooksPath, "utf8") === site.hooksHtml, "site/hooks.html is stale");
  check(readFileSync(tiersPath, "utf8") === site.tiersRedirectHtml, "site/tiers.html is stale");
  check(readFileSync(privateIndexPath, "utf8") === site.privateHtml, "site/private/index.html is stale");
  check(readFileSync(journeyPath, "utf8") === site.journeyHtml, "site/journey.html is stale");
  check(readFileSync(day1OperationsPath, "utf8") === site.day1OperationsHtml, "site/day1-operations.html is stale");
  check(existsSync(join(siteRoot, "matrix.html")), "site/matrix.html is missing; run npm run site:generate");
  check(readFileSync(join(siteRoot, "matrix.html"), "utf8") === site.matrixHtml, "site/matrix.html is stale (regen master matrix first)");
  check(readFileSync(chartIndexPath, "utf8") === site.chartIndexHtml, "site/charts/index.html is stale");
  const expectedChartPages = new Map(site.chartPages.map((page) => [page.fileName, page]));
  const actualChartPages = readdirSync(chartPagesRoot).filter((name) => name.endsWith(".html") && name !== "index.html").sort();
  check(actualChartPages.length === expectedChartPages.size, `expected ${expectedChartPages.size} generated chart page(s), found ${actualChartPages.length}`);
  for (const name of actualChartPages) check(expectedChartPages.has(name), `unexpected generated chart page ${name}`);
  for (const [name, page] of expectedChartPages) {
    check(existsSync(page.path), `site/charts/${name} is missing; run npm run site:generate`);
    check(readFileSync(page.path, "utf8") === page.html, `site/charts/${name} is stale`);
  }
  check(readFileSync(catalogJsonPath, "utf8") === site.catalogJson, "site/catalog.json is stale");
  check(readFileSync(readmePath, "utf8") === site.readme, "site/README.md is stale");
  console.log("verified generated public site outputs");
} else {
  console.log(`Usage:
  node scripts/generate-public-site.mjs --generate
  node scripts/generate-public-site.mjs --verify`);
}

function buildSite(generatedAt) {
  const top100 = JSON.parse(readFileSync(top100Path, "utf8"));
  const top500 = JSON.parse(readFileSync(top500Path, "utf8"));
  const readiness = parseCsv(readFileSync(latestReadinessPath, "utf8"));
  const latestReplacementDecisions = existsSync(latestReplacementDecisionsPath)
    ? parseCsv(readFileSync(latestReplacementDecisionsPath, "utf8"))
    : [];
  const latestActionQueue = existsSync(latestActionQueuePath) ? parseCsv(readFileSync(latestActionQueuePath, "utf8")) : [];
  const runtimeWave = parseCsv(readFileSync(runtimeWavePath, "utf8"));
  const imageSubjects = parseCsv(readFileSync(imageDigestSubjectsPath, "utf8"));
  const nextTenGaps = parseCsv(readFileSync(nextTenGapsPath, "utf8"));
  const statusMetrics = parseCsv(readFileSync(statusDashboardPath, "utf8"));
  const activeProofQueue = parseCsv(readFileSync(activeProofQueuePath, "utf8"));
  check(existsSync(outcomeEvidenceContractPath), "data/outcome-evidence-contract/summary.md is missing; run npm run outcomes:contract");
  const baseReadiness = parseCsv(readFileSync(baseReadinessPath, "utf8"));
  const extensionSlots = parseCsv(readFileSync(extensionSlotsPath, "utf8"));
  const chartUseGuide = parseCsv(readFileSync(chartUseGuidePath, "utf8"));
  const top100Readiness = parseCsv(readFileSync(top100ReadinessPath, "utf8"));
  const top100UserReadiness = parseCsv(readFileSync(top100UserReadinessPath, "utf8"));
  const top100CoverageWorkQueue = parseCsv(readFileSync(top100CoverageWorkQueuePath, "utf8"));
  check(existsSync(usefulBaseDesignQueuePath), "data/useful-base-design-queue/summary.md is missing; run npm run top100:useful-base-queue");
  const top100CoverageQueueCounts = countBy(top100CoverageWorkQueue, "queue");
  const top100PromotionWave = parseCsv(readFileSync(top100PromotionWavePath, "utf8"));
  const refreshSurvival = parseCsv(readFileSync(refreshSurvivalPath, "utf8"));
  const liveParityRerunPlan = parseCsv(readFileSync(liveParityRerunPlanPath, "utf8"));
  const productionDisposition = parseCsv(readFileSync(productionDispositionPath, "utf8"));
  const productionSupportDecisions = parseCsv(readFileSync(productionSupportDecisionsPath, "utf8"));
  const scanDisposition = parseCsv(readFileSync(scanDispositionPath, "utf8"));
  const highFanout = parseCsv(readFileSync(highFanoutPath, "utf8"));
  const lifecycleRoutes = existsSync(lifecycleRoutesJsonPath) ? JSON.parse(readFileSync(lifecycleRoutesJsonPath, "utf8")).routes : [];
  const lifecycleRouteActions = existsSync(lifecycleRouteActionsJsonPath) ? JSON.parse(readFileSync(lifecycleRouteActionsJsonPath, "utf8")).actions : [];
  const lifecycleRouteActionSummary = {
    total: lifecycleRouteActions.length,
    automatic: lifecycleRouteActions.filter((action) => action.automatic === true || action.automatic === "true").length,
  };
  const lifecycleByVariant = existsSync(lifecycleByVariantJsonPath) ? JSON.parse(readFileSync(lifecycleByVariantJsonPath, "utf8")).charts : [];
  const chartSkills = existsSync(chartSkillsJsonPath) ? JSON.parse(readFileSync(chartSkillsJsonPath, "utf8")).charts : [];
  const chartEvidenceRouter = existsSync(chartEvidenceRouterPath) ? parseCsv(readFileSync(chartEvidenceRouterPath, "utf8")) : [];
  const masterCatalogMatrix = parseCsv(readFileSync(masterCatalogMatrixPath, "utf8"));
  const cubAdoptionCaveats = existsSync(cubAdoptionCaveatsPath) ? parseCsv(readFileSync(cubAdoptionCaveatsPath, "utf8")) : [];
  const matrixDisposition = matrixLaneDispositionCounts(masterCatalogMatrix);
  check(existsSync(hardChartPacketsSummaryPath), "data/hard-chart-production-packets/summary.md is missing; run npm run hard-charts:packets");
  const baseReadinessByKey = new Map(baseReadiness.map((row) => [`${row.chart}|${row.base}`, row]));
  const bestBaseByChart = new Map(bestBaseRows(baseReadiness).map((row) => [row.chart, row]));
  const top100ReadinessWithSupport = applySupportDecisionNextActions(top100Readiness, productionSupportDecisions);
  const catalogEntries = top100.entries
    .filter((entry) => ["top20-catalog-supported", "next80-proof-grade"].includes(entry.proof_surface))
    .map((entry) => {
      const chartKey = `${entry.chart}@${entry.version}`;
      const bestBase = bestBaseByChart.get(chartKey);
      const startVariant = bestBase?.base ?? entry.start_variant;
      const withStartFields = {
        ...entry,
        start_variant: startVariant,
        start_base_readiness: bestBase?.user_readiness ?? baseReadinessByKey.get(`${chartKey}|${startVariant}`)?.user_readiness ?? "",
        start_command: bestBase?.command ?? baseReadinessByKey.get(`${chartKey}|${startVariant}`)?.command ?? "",
      };
      return {
        ...withStartFields,
        chart_page: `site/charts/${chartPageFileName(withStartFields)}`,
      };
    });
  const publicChartKeys = new Set(catalogEntries.map((entry) => `${entry.chart}|${entry.version}`));
  const publicChartSkills = chartSkills.filter((row) => publicChartKeys.has(`${row.chart}|${row.version}`));
  const publicChartEvidenceRouter = chartEvidenceRouter.filter((row) => publicChartKeys.has(`${row.chart}|${row.version}`));
  const publicMatrixRows = masterCatalogMatrix.filter((row) => publicChartKeys.has(`${row.chart}|${row.version}`));
  const proofGrade = top100.entries.filter((entry) => entry.proof_surface === "next80-proof-grade");
  const replacementByChart = new Map(latestReplacementDecisions.map((row) => [row.chart, row]));
  const latestActionByChart = new Map(latestActionQueue.map((row) => [row.chart, row]));
  const latestCandidates = refreshSurvival
    .filter((row) => row.refresh_state === "upstream-update-candidate")
    .map((row) => {
      const replacement = replacementByChart.get(row.chart);
      const replacementDecision =
        replacement?.candidate_freshness === "latest-upstream-aligned"
          ? replacement.replacement_decision
          : replacement?.candidate_freshness === "superseded-by-newer-upstream"
            ? "refresh-candidate-first"
            : "no-candidate-yet";
      const action = latestActionByChart.get(row.chart);
      return {
        chart: row.chart,
        currentVersion: row.current_version,
        candidateVersion: row.latest_version,
        proofStatus: row.candidate_proof,
        replacementDecision,
        action: action?.action ?? "",
        priority: action?.priority ?? "",
        nextAction: row.next_action,
      };
    });
  const catalog = {
    generatedBy: "scripts/generate-public-site.mjs",
    generatedAt,
    source: {
      top100: "data/top100-catalog-analysis/raw.json",
      top500: "data/top500-catalog-analysis/raw.json",
      latestCandidates: "data/refresh-survival/refreshes.csv",
      latestReplacementDecisions: "data/latest-top20-refresh/replacement-decisions/decisions.csv",
      latestActionQueue: "data/latest-top20-refresh/action-queue/queue.csv",
      runtimeWave: "data/runtime-gitops/wave1.csv",
      imageDigestSubjects: "data/image-digest-workdown/all-subjects.csv",
      nextTenGaps: "data/next-ten-waves/gap-review-wave.csv",
      statusDashboard: "data/status-dashboard/status.csv",
      activeProofQueue: "data/status-dashboard/active-proof-queue.csv",
      outcomeEvidenceContract: "data/outcome-evidence-contract/summary.md",
      baseReadiness: "data/top20-base-readiness/base-readiness.csv",
      extensionSlots: "data/extension-slots/extension-slots.csv",
      chartUseGuide: "data/chart-use-guide/chart-use-guide.csv",
      top100Readiness: "data/top100-readiness/readiness.csv",
      top100UserReadiness: "data/top100-user-readiness/readiness.csv",
      top100CoverageWorkQueue: "data/top100-coverage/work-queue.csv",
      usefulBaseDesignQueue: "data/useful-base-design-queue/summary.md",
      top100PromotionWave: "data/top100-promotion-wave/wave.csv",
      refreshSurvival: "data/refresh-survival/refreshes.csv",
      liveParityRerunPlan: "data/live-parity-rerun-plan/rerun-plan.csv",
      productionDisposition: "data/production-disposition/top20.csv",
      productionSupportDecisions: "data/production-support-decisions/decisions.csv",
      hardChartProductionPackets: "data/hard-chart-production-packets/summary.md",
      scanDisposition: "data/scan-disposition-workdown/workdown.csv",
      highFanout: "data/high-fanout-demo/prometheus-kps.csv",
      lifecycleRoutes: "data/lifecycle-routes/routes.json",
      lifecycleRouteActions: "data/lifecycle-route-actions/actions.json",
      lifecycleByVariant: "data/lifecycle-routes-by-variant/by-variant.json",
      chartSkills: "data/chart-skills/skills.json",
      chartEvidenceRouter: "data/chart-evidence-router/router.csv",
      masterCatalogMatrix: "data/master-catalog-matrix/matrix.csv",
      cubAdoptionCaveats: "data/cub-adoption-caveats/caveats.csv",
    },
    commandRoutes: commandRoutes(),
    top500Evidence: top500.summary,
    summary: {
      publicCatalogCharts: catalogEntries.length,
      catalogSupported: catalogEntries.filter((entry) => entry.proof_surface === "top20-catalog-supported").length,
      proofGrade: proofGrade.length,
      top500Rows: top500.summary.rows,
      top500MatchedProofs: top500.summary.currentRecipeRows,
      latestCandidates: latestCandidates.length,
      runtimeGitopsWave: runtimeWave.length,
      imageSubjectsNeedingResolution: imageSubjects.filter((row) => row.needs_resolution === "yes").length,
      nextTenGapRows: nextTenGaps.length,
      baseVariants: baseReadiness.length,
      startHereBaseVariants: baseReadiness.filter((row) => row.user_readiness === "start-here").length,
      top20ChartsWithExtensionSlots: extensionSlots.filter((row) => row.catalog_scope === "top20-catalog").length,
      top100ChartsWithExtensionSlots: extensionSlots.length,
      top100CoveragePromotionQueue: top100CoverageQueueCounts["promotion-review"] ?? 0,
      top100PromotionWaveRows: top100PromotionWave.length,
      top100CoverageUserVariantQueue: top100CoverageQueueCounts["user-shaped-variant"] ?? 0,
      top100CoverageDecisionQueue: top100CoverageQueueCounts["limitation-decision"] ?? 0,
      refreshCurrentRows: refreshSurvival.filter((row) => row.refresh_state === "current-proof-still-current").length,
      refreshUpdateCandidates: refreshSurvival.filter((row) => row.refresh_state === "upstream-update-candidate").length,
      refreshCandidatesWithProof: refreshSurvival.filter((row) => row.candidate_proof.includes("proof")).length,
      latestCandidatesAwaitingReplacementDecision: latestCandidates.filter((row) => row.replacementDecision === "not-decided").length,
      latestRefreshP0Rows: latestActionQueue.filter((row) => row.priority === "p0").length,
      top100ChartsWithLiveEvidence: top100ReadinessWithSupport.filter((row) =>
        ["live-helm-vs-confighub-parity", "gitops-oci-live", "local-kubernetes-live", "two-cluster-kind-parity"].includes(row.strongest_evidence),
      ).length,
      liveParityRerunRows: liveParityRerunPlan.length,
      liveParityRerunSemanticDefects: liveParityRerunPlan.filter((row) => row.reason.startsWith("parity:")).length,
      productionSupportedCharts: productionSupportDecisions.filter((row) => row.decision === "supported").length,
      productionSupersededCharts: productionSupportDecisions.filter((row) => row.decision === "superseded").length,
      productionRejectedCharts: productionSupportDecisions.filter((row) => row.decision === "rejected").length,
      productionDraftCharts: productionSupportDecisions.filter((row) => row.decision === "draft").length,
      productionReviewReadyCharts: productionDisposition.filter((row) => row.production_support === "production-review-ready").length,
      productionBlockedCharts: productionDisposition.filter((row) => row.production_support === "blocked").length,
      chartsWithAcceptedProductionDispositions: productionDisposition.filter((row) => dispositionCount(row.accepted_dispositions) > 0).length,
      highPriorityScanRows: scanDisposition.filter((row) => row.scanPriority === "high").length,
      mutableImageScanRows: scanDisposition.filter((row) => row.dispositionRoute === "fix-image-pin").length,
      privilegedInfrastructureScanRows: scanDisposition.filter((row) => row.dispositionRoute === "accept-or-split-privileged-infrastructure").length,
    },
    statusMetrics,
    activeProofQueue,
    catalogEntries,
    proofGradeEntries: proofGrade,
    latestCandidates,
    baseReadiness,
    extensionSlots,
    chartUseGuide,
    refreshSurvival,
    top100Readiness: top100ReadinessWithSupport,
    top100UserReadiness,
    liveParityRerunPlan,
    productionDisposition,
    productionSupportDecisions,
    scanDisposition,
    highFanout,
    lifecycleRoutes,
    lifecycleRouteActionSummary,
    lifecycleByVariant,
    matrixDisposition,
    chartSkills: publicChartSkills,
    chartEvidenceRouter: publicChartEvidenceRouter,
    cubAdoptionCaveats,
    masterCatalogMatrix: publicMatrixRows,
  };
  const chartPages = catalog.catalogEntries.map((entry) => ({
    fileName: chartPageFileName(entry),
    path: join(chartPagesRoot, chartPageFileName(entry)),
    html: chartPageHtml(catalog, entry),
  }));
  return {
    catalogJson: `${JSON.stringify(siteSafe(catalog), null, 2)}\n`,
    indexHtml: html(catalog),
    offeringHtml: offeringHtml(catalog),
    tryHtml: tryHtml(catalog),
    howItWorksHtml: howItWorksHtml(catalog),
    variantsHtml: variantsHtml(catalog),
    customAppsHtml: customAppsHtml(catalog),
    operationsHtml: operationsHtml(catalog),
    docsHtml: docsHtml(catalog),
    proofHtml: proofHtml(catalog),
    hardQuestionsHtml: hardQuestionsHtml(catalog),
    knownGapsHtml: knownGapsHtml(catalog),
    hooksHtml: hooksHtml(catalog),
    privateHtml: privateHtml(catalog),
    tiersRedirectHtml: tiersRedirectHtml(),
    journeyHtml: journeyHtml(catalog),
    day1OperationsHtml: legacyOperationsRedirectHtml(),
    chartIndexHtml: chartIndexHtml(catalog),
    chartPages,
    matrixHtml: readFileSync(join(repoRoot, "data", "master-catalog-matrix", "matrix.html"), "utf8"),
    readme: readme(),
  };
}

function generatedStamp(catalog, label) {
  return `<p class="generated"><b>Generated at:</b> ${escapeHtml(catalog.generatedAt)} UTC · source: committed helm-expt evidence for this ${escapeHtml(label)}.</p>`;
}

function topNav(base = ".") {
  const link = (path) => `${base}/${path}`;
  return `<div class="site-chrome"><div class="experiment-banner">THIS IS AN EXPERIMENTAL TEST PAGE AND NOT REAL</div><nav class="topbar"><a class="brand" href="${link("index.html")}">ConfigHub Cub Helm</a><span class="navlinks"><a href="${link("try.html")}">Get Started</a><a href="${link("charts/index.html")}">Helm Catalog</a><a href="${link("variants.html")}">Variants</a><a href="${link("journey.html")}">Apps</a><a href="${link("operations.html")}">Ops</a><a href="${link("docs.html")}">Docs</a><a href="${link("hard-questions.html")}">FAQ</a><a href="${link("private/")}">Upgrade</a></span></nav></div>`;
}

function matrixLaneDispositionCounts(rows) {
  const laneColumns = [
    "lane_render_parity",
    "lane_confighub_scan_ops",
    "lane_local_kind",
    "lane_lifecycle_observed",
    "lane_gitops_oci_live",
    "lane_live_dual_parity",
    "lane_two_cluster_kind",
  ];
  const counts = { pass: 0, watch: 0, blocked: 0, todo: 0, na: 0, blank: 0 };
  for (const row of rows) {
    for (const column of laneColumns) {
      const value = String(row[column] ?? "").trim();
      if (value === "yes") counts.pass += 1;
      else if (value === "watch") counts.watch += 1;
      else if (value === "no") counts.blocked += 1;
      else if (value === "todo") counts.todo += 1;
      else if (value === "n/a") counts.na += 1;
      else counts.blank += 1;
    }
  }
  counts.total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return counts;
}

function dispositionBar(counts) {
  const total = Math.max(1, counts.total ?? 0);
  const segment = (key, label) => {
    const value = counts[key] ?? 0;
    if (value === 0) return "";
    const width = Math.max(2, (value / total) * 100);
    return `<span class="${key}" style="width:${width.toFixed(2)}%" title="${escapeHtml(label)}: ${escapeHtml(String(value))}"></span>`;
  };
  return `<div class="disposition-bar" aria-label="Matrix lane disposition mix">
        ${segment("pass", "pass")}
        ${segment("watch", "watch")}
        ${segment("blocked", "blocked")}
        ${segment("todo", "not yet run")}
        ${segment("na", "not applicable")}
        ${segment("blank", "blank")}
      </div>`;
}

function html(catalog) {
  return parityFirstHomeHtml(catalog);
}

function parityFirstHomeHtml(catalog, label = "public catalog homepage") {
  const parityDemos = [
    {
      label: "Standard Redis",
      title: "Start with the smallest happy path",
      body: "Redis is the teaching chart. Start with ordinary Helm, then render the same chart path with cub installer so you can inspect the explicit objects before doing anything more complicated.",
      link: "./try.html",
      linkText: "Get started with Redis",
    },
    {
      label: "Serverless parity",
      title: "No account: Helm vs cub installer in two kind clusters",
      body: "This is the cleanest live parity idea: install regular Helm into one clean kind cluster, apply the cub installer output into another clean kind cluster, then compare the live object meaning.",
      link: "../data/live-kind-parity/summary.md",
      linkText: "Open two-cluster parity evidence",
    },
    {
      label: "Connected parity",
      title: "ConfigHub path: Helm vs ConfigHub OCI/GitOps",
      body: "This checks the connected path: ConfigHub publishes the rendered object set as OCI, a GitOps controller reconciles it, and the live result is compared with regular Helm.",
      link: "../data/live-helm-confighub-compare/summary.md",
      linkText: "Open live Helm-vs-ConfigHub evidence",
    },
    {
      label: "Your chart choice",
      title: "Pick any catalog chart and run the same parity question",
      body: "The point is not that Redis works. The useful test is whether the same chart, version, values, and base variant can be proved against regular Helm.",
      link: "./charts/index.html",
      linkText: "Choose a chart",
    },
    {
      label: "Quirks included",
      title: "Use kube-prometheus-stack for the hard case",
      body: "This is the serious example: CRDs, webhooks, and more. It shows where parity is enough and where live evidence is still needed.",
      link: "../docs/user/serious-chart-proof.md",
      linkText: "Open the serious chart guide",
    },
  ];
  const nextStepRows = [
    ["Apps", "Group charts and your own services into one app path.", "./journey.html"],
    ["Ops", "Release, observe, patch, and upgrade apps after they exist.", "./operations.html"],
    ["Upgrade", "Move into private catalogs, teams, approvals, and managed responsibility.", "./private/"],
  ];
  const journeySteps = [
    ["First", "See How It Works", "Get started with a Redis example and see standard Helm compared with cub installer.", "./try.html", "Get Started"],
    ["Second", "Pick a Helm Chart to Try", "Choose from the public Helm Catalog and open the chart page for variants, evidence, and actions.", "./charts/index.html", "Helm Catalog"],
    ["Then", "Manage Helm Variants", "Create customised variants of your chart, promote through environments, and manage target-specific choices before app delivery.", "./variants.html", "Variants"],
    ["Later", "Your Own Live Apps", "Combine public charts, custom app pieces, and stacks, then deploy and operate them once the app is running.", "./journey.html", "Apps"],
  ];
  const howItWorksRows = [
    ["Render", "Turn a Helm chart into plain Kubernetes files and compare them with Helm.", "../docs/user/how-it-works.md#1-render--the-recipe", "Read render"],
    ["Route", "Helm's hidden lifecycle steps (hooks) become visible steps you can see and check before they run.", "../docs/user/how-it-works.md#2-route--everything-not-in-the-recipe", "Read route"],
    ["Deliver", "Publish one OCI bundle and let the selected controller pull the same bytes.", "../docs/user/cub-deployment-path.md", "Read delivery"],
    ["Observe", "Check what happened in the cluster and show the result honestly.", "../docs/user/verification-lanes.md", "Read observation"],
  ];
  const limitCards = [
    ["A matching render is the first check.", "It means the ConfigHub package produced the same starting Kubernetes objects that Helm would have produced. It does not mean every cluster already has the secret, storage class, or cloud account the chart expects.", "../docs/user/target-prerequisites.md", "Read about cluster prerequisites"],
    ["Some charts need extra setup.", "A chart may create certificates, install CRDs, or wait for webhooks. We show those steps so you can see what has been observed and what must be prepared first.", "./charts/index.html#actions", "See chart actions"],
    ["Some custom choices need a new base.", "If a values file, overlay, secret mode, HA setting, or CRD choice changes what Helm would render, we should make a new base variant and prove that path. We should not quietly edit the result and pretend it is the same install.", "../docs/user/custom-overlays.md", "Read about custom overlays"],
    ["A warning is part of the answer.", "When the catalog says watch or blocked, it is telling you what still has to happen before you rely on that path. The aim is not an all-green wall. The aim is to show what works, what needs preparation, and what we refuse to hide.", "./matrix.html", "Open the catalog database"],
  ];
  const configHubIntroRows = [
    ["Unit", "A versioned Kubernetes object or config item that ConfigHub can diff, label, gate, deliver, and observe."],
    ["Space", "A working area that groups Units for one app, base, environment, customer, or target shape."],
    ["Component", "The app, service, platform package, or deployable capability being configured."],
    ["Variant", "Two related kinds: a base variant is a render-time Helm/recipe install shape; a derived ConfigHub variant is a post-render refinement of an uploaded base."],
    ["Target", "The place the desired state is meant to run, including its cluster assumptions, credentials, and facts."],
    ["OCI bundle", "The delivery artifact ConfigHub publishes so Argo, Flux, or a direct path can pull the same reviewed bytes."],
    ["Observation", "Using any tool to obtain live evidence about what actually happened after delivery, for example whether GitOps sync was achieved."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="home-hero">
    ${topNav(".")}
    <h1>Helm operations with ConfigHub and AI</h1>
    <p class="lead">Start by comparing ordinary Helm with <code>cub installer</code>. Then pick a chart, create variants, and move toward real apps with reviewable changes.</p>
    <div class="journey-flow" aria-label="Four-step product journey">
      ${journeySteps.map(([number, title, body, href, linkText], index) => `<a class="journey-step" href="${escapeHtml(href)}">
        <span class="kicker">${escapeHtml(number)}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
        <span class="go">${escapeHtml(linkText)}</span>
      </a>${index < journeySteps.length - 1 ? '<span class="journey-arrow" aria-hidden="true">&rarr;</span>' : ""}`).join("\n      ")}
    </div>
  </header>
  <main>
    <section aria-labelledby="quick-context">
      <h2 id="quick-context">Why This Exists</h2>
      <p>Helm works well until every real app needs one more tweak: a Secret model, a CRD choice, a customer overlay, or a pinned old version. The chart still works, but the customisation becomes hard to see.</p>
      <p><code>cub</code> is an open source configuration lifecycle and management tool from ConfigHub. This site shows Helm users how public charts can become explicit, reviewable config.</p>
      <p>We keep public Helm charts as the source, convert selected install paths into <a href="./try.html"><code>cub installer</code></a> recipes, and compare the result with ordinary Helm. When both paths get the same deployment, we call that <strong>parity</strong>. Then we can use ConfigHub and AI to make changes at scale without hiding what changed.</p>
    </section>

    <section aria-labelledby="what-is-confighub">
      <h2 id="what-is-confighub">What Is ConfigHub?</h2>
    <p>ConfigHub stores Kubernetes desired state as structured, versioned config. That means the YAML Helm would create is kept as data you can inspect. ConfigHub can then keep those objects as Units, create variants from them, and review exact changes. It can also publish OCI artifacts and compare what is live with what was intended.</p>
      <div class="vocab-table">${markdownLikeTable([
        ["Word", "Meaning"],
        ...configHubIntroRows,
      ])}</div>
      <style>
        .vocab-table th:first-child,
        .vocab-table td:first-child { width: 13ch; min-width: 13ch; white-space: nowrap; }
      </style>
      <p><a href="../docs/user/confighub-data-model.md">Open the data model guide</a> for the precise vocabulary.</p>
    </section>

    <section aria-labelledby="helm-problem">
      <h2 id="helm-problem">The Problem</h2>
      <p>Helm charts usually start simple. Then every app, team, and customer needs one more tweak: a different Secret model, an ingress rule, or a provider-specific values file. Those choices are reasonable, but the install path becomes harder to see.</p>
      <p>That is where many Helm pain points come from. Values sprawl, hidden defaults, and upgrade diffs can combine until nobody is sure what changed or why a live app broke.</p>
      <p>Our view is that the real problem is not Helm itself. The hard part is customization. Every useful chart becomes a set of variants, and those variants need to be visible, versioned, compared, tested, promoted, and observed.</p>
      <p>Once multiple charts, custom values, and configuration variants are used for platforms, apps, and real use cases, the work becomes harder to track. Some old versions may have to be pinned. Teams need to know what will break in the next upgrade, why a deployment failed unexpectedly, and which change is safe to promote next. We are here to help with that.</p>
    </section>

    <section aria-labelledby="control-value">
      <h2 id="control-value">The Value</h2>
      <p>ConfigHub adds control around those variants. A public Helm chart remains the source, but selected install paths become cub installer recipes and ConfigHub variants. The rendered Kubernetes objects are stored as explicit desired state, with versions, diffs, and live observations.</p>
      <div class="grid">
        <div class="card"><h3>Variant store</h3><p>Keep base variants, derived variants, and customer choices in one place instead of scattering them across values files and shell history.</p></div>
        <div class="card"><h3>Verified changes</h3><p>Compare against standard Helm, review exact object diffs, and keep receipts for what was rendered, delivered, and observed.</p></div>
        <div class="card"><h3>Desired state for live apps</h3><p>Use ConfigHub as the central place that describes what should be running, then deliver through OCI, GitOps controllers, or direct apply paths and observe what actually happened.</p></div>
        <div class="card"><h3>AI with guardrails</h3><p>AI can propose variants, explain diffs, and suggest patches. ConfigHub keeps those AI-assisted changes reviewed and reversible before they become live state.</p><p><a href="../docs/user/ai-assisted-helm-changes.md">Open the AI-assisted changes guide</a></p></div>
      </div>
    </section>

    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works">How It Works</h2>
      <p>The model has four moves: render, route, deliver, and observe. Each move has a plain job.</p>
      ${markdownLikeTable([
        ["Move", "What it means", "Go deeper"],
        ...howItWorksRows.map(([move, body, link, label]) => [move, body, `<a href="${link}">${escapeHtml(label)}</a>`]),
      ], { rawThirdColumn: true })}
      <p><a href="./how-it-works.html">Open the visual How It Works guide</a> for the four-move spine, hook visibility, one-OCI-bundle delivery, and the current disposition mix.</p>
    </section>

    <section aria-labelledby="parity-demos">
      <h2 id="parity-demos">1. Helm Parity</h2>
      <p>Start here, not with platform features. Each demo asks the same question at a different depth: does the cub installer or ConfigHub path reach the same result as regular Helm?</p>
      <p>Parity does not mean the app is ready for every real cluster or every operating process. It means the starting Kubernetes objects match what Helm would have produced for the same inputs.</p>
      <div class="catalog">
        ${parityDemos
          .map(
            (demo) => `<article class="card">
          <span class="kicker">${escapeHtml(demo.label)}</span>
          <h3>${escapeHtml(demo.title)}</h3>
          <p>${escapeHtml(demo.body)}</p>
          <p><a href="${escapeHtml(demo.link)}">${escapeHtml(demo.linkText)}</a></p>
        </article>`,
          )
          .join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="do-next">
      <h2 id="do-next">2. Customise Helm into Variants</h2>
      <p>Once parity is visible, the value is that rendered objects become explicit config. You can review them, create variants, promote apps, apply policy, and observe the live result.</p>
      ${markdownLikeTable([
        ["Capability", "What it means", "Where to look"],
        ...nextStepRows.map(([capability, body, link]) => [capability, body, `<a href="${link}">${link}</a>`]),
      ], { rawThirdColumn: true })}
    </section>

    <section aria-labelledby="limits">
      <h2 id="limits">3. Verifying What We Can And Cannot Do With This Model</h2>
      <p>Comparing with Helm is the start of the story, not the whole story. It answers one useful question: did this package produce the same starting Kubernetes objects that Helm would have produced?</p>
      <p>Real deployments can still need extra preparation. A chart may expect an existing Secret, a storage class, a cloud account, a CRD, a webhook, or a setup job. Those things should be visible before a user depends on the install path.</p>
      <div class="catalog">
        ${limitCards.map(([title, body, link, linkText]) => `<article class="card">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(body)}</p>
          <p><a href="${escapeHtml(link)}">${escapeHtml(linkText)}</a></p>
        </article>`).join("\n        ")}
      </div>
      <p>If you want to check the details, start with the chart page rather than the raw proof files. The chart page tells you which bases exist, what caveats apply, and where the deeper evidence lives.</p>
      <div class="grid">
        <div class="card"><h3>Check a chart</h3><p>Use the catalog when you want to know what choices exist for a specific Helm chart and which path is the best place to start.</p><p><a href="./charts/index.html">Open the Helm Catalog</a></p></div>
        <div class="card"><h3>Read the limits</h3><p>Use the FAQ and known-gaps guide when you want plain answers about hooks, upgrades, custom values, GitOps sync, and current rough edges.</p><p><a href="./hard-questions.html">Open the FAQ</a> · <a href="./known-gaps.html">Known gaps</a></p></div>
        <div class="card"><h3>Inspect the evidence</h3><p>The database and generated evidence are still available, but they are supporting material. They are for people who want to audit the claims behind a chart page.</p><p><a href="./docs.html">Docs</a> · <a href="./matrix.html">Database</a> · <a href="../data/README.md">Evidence index</a></p></div>
      </div>
      <p>If your chart does not behave the way the catalog says it should, <a href="https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml">send us the problem chart</a>. We will either make it work, explain what needs to be prepared first, or say clearly why that path is not covered yet.</p>
    </section>

    <section aria-labelledby="confighub">
      <h2 id="confighub">4. What Else Can I Do Using ConfigHub?</h2>
      <p>The public catalog is the first proof: we can keep Helm as the source, turn chosen install paths into explicit config, and check that the starting result still matches Helm. ConfigHub Server is where the same idea becomes a team workflow for real applications.</p>
      <p>Instead of treating each Helm install as a one-off command, teams can keep the desired state in one place, make variants deliberately, promote changes through environments, deliver through GitOps, and keep records of what happened.</p>
      <div class="grid">
        <div class="card"><h3>Private catalogs</h3><p>Bring your own charts, wrapper charts, platform bundles, and customer values into the same recipe and variant model.</p><p><a href="./private/">Upgrade</a></p></div>
        <div class="card"><h3>Apps and variants</h3><p>Represent an app, service, platform component, or stack as a family of named variants: base, dev, staging, prod, customer, region, or target.</p><p><a href="./journey.html">Open Apps</a></p></div>
        <div class="card"><h3>Promotions</h3><p>Move an approved change from one variant to another, preview the exact difference, and keep approvals attached to the change.</p><p><a href="./variants.html">Open Variants</a></p></div>
        <div class="card"><h3>Operations</h3><p>Scan, patch, approve, deliver, observe, upgrade, roll back, and ask fleet-wide questions after the app is running.</p><p><a href="./operations.html">Open Ops</a></p></div>
        <div class="card"><h3>AI with records</h3><p>Let AI propose changes, but keep the result reviewable: exact diffs, gates, receipts, delivery evidence, and a visible path back if something goes wrong.</p><p><a href="../docs/user/ai-assisted-helm-changes.md">AI-assisted changes</a></p></div>
      </div>
    </section>

  </main>
  <footer>
    Copyright ConfigHub Inc. Generated from committed helm-expt evidence. Latest chart versions and proved catalog versions are intentionally separate.
  </footer>
</body>
</html>
`;
}

function howItWorksHtml(catalog) {
  const counts = catalog.matrixDisposition;
  const routeActionTotal = catalog.lifecycleRouteActionSummary.total;
  const automaticRouteActions = catalog.lifecycleRouteActionSummary.automatic;
  const explainerRows = [
    ["How it works", "The hub for the four moves and all mechanism docs.", "../docs/user/how-it-works.md"],
    ["Data model", "Unit, space, target, worker, OCI bundle, target fact, route, and receipt.", "../docs/user/confighub-data-model.md"],
    ["Deployment path", "cub installer to ConfigHub Units to one OCI bundle to Argo, Flux, or cub-direct.", "../docs/user/cub-deployment-path.md"],
    ["GitOps adopter guide", "For Argo and Flux teams: keep the controller, change the source to one OCI bundle.", "../docs/user/gitops-adopter-guide.md"],
    ["Security end to end", "Secrets, delivery credentials, RBAC, scanning, and no silent privileged step.", "../docs/user/security-end-to-end.md"],
    ["Day-2 upgrade and rollback", "Staged, reviewed, rehearsed, observed changes with versioned rollback.", "../docs/user/day2-upgrade-rollback.md"],
  ];
  const refusalRows = [
    ["Never silent", `Every routed step must be shown. Current route actions marked automatic: ${automaticRouteActions}/${routeActionTotal}.`],
    ["Disposition is not green", `Current lane cells include ${counts.pass} pass, ${counts.watch} watch, ${counts.blocked} blocked, ${counts.todo} not yet run, and ${counts.na} not applicable.`],
    ["Proven versus in progress", "Argo from ConfigHub OCI is proven. Flux from OCI and cub-direct are still in progress until committed receipts exist."],
    ["Dry-run boundary", "<code>cub-scout compare three-way --dry-from</code> is shipped. <code>cub-scout object-set --dry-from</code> is forthcoming."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>How It Works · ConfigHub Helm Catalog</title>
  <style>${siteCss()}
    .move-spine { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 24px 0 8px; }
    .move-card { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); padding: 16px; }
    .move-card .kicker { display: block; color: var(--good); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .78rem; margin-bottom: 8px; }
    .move-card p { margin: 0; font-size: .92rem; }
    .move-section { border-top: 1px solid var(--line); padding-top: 26px; }
    .mini-visual { border: 1px solid var(--line); border-radius: 10px; background: var(--panel); padding: 14px; margin: 14px 0; }
    .parallel { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }
    .parallel .arrow, .oci-arrow { color: var(--muted); font-size: 1.4rem; text-align: center; }
    .node { border: 1px solid var(--line); border-radius: 8px; background: var(--surface); padding: 12px; min-height: 74px; }
    .node strong { display: block; margin-bottom: 4px; }
    .node p { margin: 0; font-size: .86rem; }
    .oci-visual { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: stretch; }
    .consumer-list { display: grid; gap: 8px; }
    .consumer { border: 1px solid var(--line); border-radius: 8px; background: var(--surface); padding: 10px; }
    .consumer .state { display: inline-block; border-radius: 999px; padding: 2px 7px; font-size: .72rem; margin-left: 6px; border: 1px solid var(--line); }
    .consumer .proven { color: #fff; background: var(--good); border-color: var(--good); }
    .consumer .coming { color: var(--muted); background: var(--panel); }
    .proof-frame { width: 100%; min-height: 420px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
    .disposition-bar { display: flex; width: 100%; height: 28px; overflow: hidden; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); margin: 14px 0 10px; }
    .disposition-bar span { display: block; height: 100%; }
    .disposition-bar .pass { background: var(--good); }
    .disposition-bar .watch { background: #f9ab00; }
    .disposition-bar .blocked { background: var(--bad); }
    .disposition-bar .todo { background: #8ab4f8; }
    .disposition-bar .na { background: #c8ced5; }
    .disposition-bar .blank { background: #edf0f3; }
    @media (max-width: 760px) {
      .move-spine, .parallel, .oci-visual { grid-template-columns: 1fr; }
      .parallel .arrow, .oci-arrow { display: none; }
    }
  </style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>How It Works</h1>
    ${generatedStamp(catalog, "how it works guide")}
    <p class="tagline">The model is four moves: render, route, deliver, observe. Each move makes a Helm install more visible without pretending every live case is already green.</p>
    <div class="move-spine" aria-label="Four-move spine">
      <div class="move-card"><span class="kicker">01</span><h3>Render</h3><p>Your chart becomes the same Kubernetes objects, proved object-for-object for the recorded recipe.</p></div>
      <div class="move-card"><span class="kicker">02</span><h3>Route</h3><p>Hooks, CRDs, target facts, and other quirks become explicit named steps.</p></div>
      <div class="move-card"><span class="kicker">03</span><h3>Deliver</h3><p>ConfigHub publishes one OCI bundle. Your chosen controller pulls the same bytes.</p></div>
      <div class="move-card"><span class="kicker">04</span><h3>Observe</h3><p>Receipts show the live result, including watch, blocked, and not-applicable states.</p></div>
    </div>
  </header>
  <main>
    <section class="move-section" aria-labelledby="render">
      <h2 id="render">1. Render</h2>
      <p><strong>Claim:</strong> under the same chart, values, base, and capability profile, the cub installer recipe preserves Helm's rendered object set. This proves the recipe, not that the target cluster is ready.</p>
      <div class="mini-visual parallel" aria-label="Helm and cub installer both render the same object set">
        <div class="node"><strong>Regular Helm</strong><p><code>helm template</code> or <code>helm install</code> produces a Kubernetes object set.</p></div>
        <div class="arrow">&rarr;</div>
        <div class="node"><strong>cub installer</strong><p>The recipe produces the same object set, with receipts and a repeatable package.</p></div>
      </div>
      <p><a href="../docs/user/how-it-works.md#1-render--the-recipe">Go deeper: render in the how-it-works hub</a> · <a href="../docs/reference/direct-cub-helm-model.md">direct cub/Helm model</a> · <a href="../docs/user/reading-the-matrix.md">reading the matrix</a></p>
    </section>

    <section class="move-section" aria-labelledby="route">
      <h2 id="route">2. Route</h2>
      <p><strong>Claim:</strong> anything Helm would otherwise hide as lifecycle behavior is made visible as a named route. Current route actions marked automatic: <strong>${escapeHtml(String(automaticRouteActions))}/${escapeHtml(String(routeActionTotal))}</strong>.</p>
      <iframe class="proof-frame" title="Visible versus silent hook proof" src="../data/hook-test-proof/visible-vs-silent.html"></iframe>
      <p><a href="../docs/user/chart-hooks-what-happens.md">Go deeper: chart hooks</a> · <a href="../docs/user/pathway-route-hooks-transparently.md">route hooks transparently</a> · <a href="../data/lifecycle-route-actions/summary.md">lifecycle route actions</a></p>
    </section>

    <section class="move-section" aria-labelledby="deliver">
      <h2 id="deliver">3. Deliver</h2>
      <p><strong>Claim:</strong> ConfigHub publishes the reviewed Units once as an OCI artifact. Argo, Flux, or kubectl/cub should consume the same bundle, but the proof states differ.</p>
      <div class="mini-visual oci-visual" aria-label="One OCI bundle consumed by three delivery paths">
        <div class="node"><strong>ConfigHub Units</strong><p>Reviewed desired state, labels, variants, gates, and receipts.</p></div>
        <div class="oci-arrow">&rarr;<br><code>OCI</code><br>&rarr;</div>
        <div class="consumer-list">
          <div class="consumer"><strong>Argo CD</strong><span class="state proven">proven</span><p>Committed end-to-end OCI receipts exist.</p></div>
          <div class="consumer"><strong>Flux</strong><span class="state coming">in progress</span><p>Documented design until committed receipts exist.</p></div>
          <div class="consumer"><strong>cub-direct</strong><span class="state proven">managed path proven</span><p>The managed applier handles CRD ordering, prune, and readable SSA conflicts.</p></div>
        </div>
      </div>
      <div class="card">
        <h3>Three adoption caveats we manage</h3>
        <p>These apply to the cub-direct path for every chart. They are not hidden as proof wins; they are the first-run friction points that must be handled before cub feels better than plain Helm.</p>
        ${markdownLikeTable([
          ["Caveat", "Managed path"],
          ...universalCubAdoptionRows(),
        ], { rawSecondColumn: true })}
        <p>Per-chart password and CRD heads-up: <a href="../data/cub-adoption-caveats/summary.html">cub adoption caveats</a>.</p>
      </div>
      <div class="card">
        <h3>What Argo or Flux points at</h3>
        <p>Keep your controller. The practical change is the source: point it at the ConfigHub OCI artifact instead of asking the controller to re-render Helm downstream.</p>
        <pre><code># Argo CD Application source
source:
  repoURL: oci://oci.hub.confighub.com:443/target/&lt;space&gt;/oci
  path: ./&lt;space&gt;

# Flux source
apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
spec:
  url: oci://oci.hub.confighub.com:443/target/&lt;space&gt;/oci
  secretRef:
    name: confighub-oci-creds</code></pre>
        <p>You should see the controller report its normal synced or healthy status after it pulls the same ConfigHub OCI bundle. In this public corpus, Argo-from-OCI has committed receipts; Flux-from-OCI remains in progress until equivalent receipts are committed.</p>
      </div>
      <p><a href="../docs/user/cub-deployment-path.md">Go deeper: cub deployment path</a> · <a href="../docs/user/gitops-adopter-guide.md">GitOps adopter guide</a></p>
    </section>

    <section class="move-section" aria-labelledby="observe">
      <h2 id="observe">4. Observe</h2>
      <p><strong>Claim:</strong> live evidence is reported as an honest disposition, not a green wall. Watch is not pass, blocked is not hidden, and not-applicable is counted separately.</p>
      ${dispositionBar(counts)}
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(String(counts.pass))}</strong><span>pass cells</span></div>
        <div class="metric"><strong>${escapeHtml(String(counts.watch))}</strong><span>watch cells</span></div>
        <div class="metric"><strong>${escapeHtml(String(counts.blocked))}</strong><span>blocked cells</span></div>
        <div class="metric"><strong>${escapeHtml(String(counts.todo))}</strong><span>not yet run</span></div>
        <div class="metric"><strong>${escapeHtml(String(counts.na))}</strong><span>not applicable</span></div>
      </div>
      <p><a href="../docs/user/verification-lanes.md">Go deeper: verification lanes</a> · <a href="../docs/user/what-we-refuse-to-claim.md">what we refuse to claim</a> · <a href="./matrix.html">open the matrix</a></p>
    </section>

    <section class="move-section" aria-labelledby="mechanisms">
      <h2 id="mechanisms">Mechanism Guides</h2>
      <p>These are the plain-English guide pages behind the four moves.</p>
      ${markdownLikeTable([
        ["Guide", "Use it for", "Open"],
        ...explainerRows.map(([guide, body, link]) => [guide, body, `<a href="${link}">${link}</a>`]),
      ], { rawThirdColumn: true })}
    </section>

    <section class="move-section" aria-labelledby="rails">
      <h2 id="rails">Honesty Rails</h2>
      ${markdownLikeTable([
        ["Rule", "Public-site wording"],
        ...refusalRows,
      ], { rawSecondColumn: true })}
    </section>
  </main>
  <footer>Generated from helm-expt proof data. This guide explains the public mental model; generated evidence remains the source for exact status.</footer>
</body>
</html>
`;
}

function legacyDashboardHtml(catalog) {
  const entries = catalog.catalogEntries;
  const metric = (name) => catalog.statusMetrics.find((row) => row.metric === name) ?? {};
  const counters = [
    ["Model-supported charts", metricValue(metric("maintained chart rows with model support"))],
    ["Top100 contract covered", metricValue(metric("covered by top100 contract"))],
    ["Render parity rows", metricValue(metric("render parity rows"))],
    ["Catalog-supported charts", metricValue(metric("catalog-supported charts"))],
    ["Proof-grade non-catalog", metricValue(metric("proof-grade non-catalog charts"))],
    ["Top20 update candidates", `${catalog.summary.refreshUpdateCandidates}/20`],
    ["Derived create receipts", metricValue(metric("derived variant live create receipts"))],
    ["GitOps/OCI live pass", metricValue(metric("GitOps/OCI live pass rows"))],
    ["Live parity pass", metricValue(metric("live Helm-vs-ConfigHub parity pass rows"))],
    ["Two-cluster parity pass", metricValue(metric("two-cluster kind parity pass rows"))],
  ];
  const statusRows = [
    "in-ConfigHub proof rows",
    "local live rows",
    "GitOps/OCI live pass rows",
    "live Helm-vs-ConfigHub parity pass rows",
    "two-cluster kind parity pass rows",
    "two-cluster semantic parity defect receipts",
    "derived variant live create receipts",
    "target-bound derived variant receipts",
    "hook route receipts present",
    "hook lifecycle observations present",
    "related lifecycle observation receipts passing",
    "hook routes still needing execution or observation",
    "not-scanned axes",
  ]
    .map((name) => metric(name))
    .filter((row) => row.metric);
  const baseReadinessCounts = countBy(catalog.baseReadiness, "user_readiness");
  const highFanoutRows = catalog.highFanout
    .filter((row) => ["default", "no-crds"].includes(row.base))
    .map((row) => [
      row.base,
      row.user_choice,
      row.render_parity,
      row.two_cluster_kind_parity,
      row.strict_live_configHub_argo === "not-selected" ? row.runtime_gitops_wave : row.strict_live_configHub_argo,
      row.production_status,
      row.next_hard_work,
    ]);
  const kpsProductionDecisionRows = [
    ["CRD ownership", "Decide whether the package owns Prometheus Operator CRDs or the target cluster owns compatible CRDs first."],
    ["Admission Secret", "Stage or manage monitoring/kube-prometheus-stack-admission before config-only delivery."],
    ["Webhook freshness", "Observe webhook, operator, and caBundle readiness after apply."],
    ["RBAC and scrape scope", "Approve the rendered cluster RBAC and monitoring blast radius for the target."],
    ["Scan and image posture", "Accept the findings for this infrastructure scope or create a hardened base."],
    ["Final live evidence", "Refresh target-scoped live parity, GitOps/OCI, and observation receipts before claiming production support."],
  ];
  const recommendedBaseRows = bestBaseRows(catalog.baseReadiness)
    .map((row) => [row.chart, row.base, row.user_readiness, row.command, row.why]);
  const top20ExtensionRows = catalog.extensionSlots
    .filter((row) => row.catalog_scope === "top20-catalog")
    .map((row) => [row.chart, row.surfaces, row.current_route]);
  const top100UserReadinessCounts = countBy(catalog.top100UserReadiness, "bucket");
  const chartUseCounts = countBy(catalog.chartUseGuide, "answer");
  const chartUsePreviewRows = [
    "yes-public-catalog",
    "not-yet-public-catalog-proof-ready",
    "not-yet-user-ready",
    "decision-needed-first",
  ].map((answer) => {
    const examples = catalog.chartUseGuide
      .filter((row) => row.answer === answer)
      .slice(0, 4)
      .map((row) => row.chart)
      .join(", ");
    return [answer, String(chartUseCounts[answer] ?? 0), chartUseMeaning(answer), examples];
  });
  const top100HardGapRows = hardGapRowsByBucket(catalog.top100Readiness);
  const top100UserReadinessRows = [
    ["ready-to-try", "Catalog-supported with a reviewed first base and live evidence."],
    ["works-with-target-prerequisites", "Works once the target provides a named prerequisite such as a Secret, StorageClass, or CRD ownership choice."],
    ["works-with-operator-review", "Render proof exists, but an operator should review the named lifecycle, hook, HA, or shape concern before relying on it."],
    ["needs-better-base-variant", "The mechanism is proven, but the useful install shape has not been built and reviewed yet."],
    ["not-ready-yet", "A named limitation needs a support, disclose, defer, or block decision before this catalog should vouch for it."],
  ].map(([bucket, meaning]) => [bucket, top100UserReadinessCounts[bucket] ?? 0, meaning]);
  const top100QueueRows = [
    ["Promotion review", "promote-after-review"],
    ["Needs useful variant", "needs-useful-variant"],
    ["Limitation decision", "limitation-decision-first"],
  ].map(([label, bucket]) => [
    label,
    catalog.top100Readiness
      .filter((row) => row.adoption_bucket === bucket)
      .slice(0, 5)
      .map((row) => row.chart)
      .join(", "),
  ]);
  const firstTimeRows = [
    ["Browse first", "Open the catalog, chart pages, proof status, and known gaps before trusting an install path.", "Free"],
    ["Inspect a render", "Use cub helm template when you only need to see the Kubernetes objects a chart produces.", "Free"],
    ["Try a public package", "Use cub installer setup for a maintained public base with rendered objects, receipts, scans, and local verification.", "Free or low-friction"],
    ["Upload when state matters", "Use cub installer upload when the reviewed objects should become ConfigHub Units for teams, approvals, or variants.", "Managed"],
    ["Operate after upload", "Use variants, diffs, scans, gates, promotions, GitOps/OCI handoff, observations, upgrades, rollbacks, and receipts.", "Managed or paid"],
  ];
  const userValueRows = [
    ["Pick a safe starting point", "Choose a reviewed base variant instead of guessing through a large values file."],
    ["See the real objects", "Review the rendered Kubernetes objects, object counts, CRDs, RBAC, Secrets model, and extension slots before install."],
    ["Build apps on the data", "Rendered objects are held as queryable data, so tools such as RBAC review can run across the catalog without a cluster or a fresh Helm render."],
    ["Make prerequisites explicit", "Target facts, lifecycle routes, hook dispositions, and controller-owned fields are named before they surprise the rollout."],
    ["Operate the same objects", "After upload, ConfigHub Units can be diffed, scanned, approved, promoted, observed, and audited."],
    ["Keep Helm semantics visible", "The selected live lane currently has zero semantic parity defects across committed Helm-vs-ConfigHub receipts."],
    ["Know the boundary", "Watch, blocked, refused, and not-yet-run rows stay visible instead of becoming hidden product claims."],
  ];
  const rerunCounts = countBy(catalog.liveParityRerunPlan, "lane");
  const rerunRows = catalog.activeProofQueue
    .slice(0, 10)
    .map((row) => [
      row.chart,
      row.base,
      row.current_result,
      row.next_step_type,
      row.reason,
      row.support_artifact,
    ]);
  const productionBlockers = [...flattenCounts(catalog.productionDisposition, "open_dispositions").entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([blocker, count]) => [blocker, String(count)]);
  const scanDispositionRoutes = Object.entries(countBy(catalog.scanDisposition, "dispositionRoute"))
    .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]))
    .map(([route, count]) => [route, String(count), scanRouteMeaning(route)]);
  const productionDispositionRows = catalog.productionDisposition
    .slice(0, 10)
    .map((row) => [
      `${row.chart}@${row.version}`,
      row.production_support,
      String(dispositionCount(row.accepted_dispositions)),
      String(dispositionCount(row.open_dispositions)),
      row.next_action,
    ]);
  const productionWorkstreamRows = supportDecisionWorkstreams(catalog.productionSupportDecisions);
  const stages = [
    ["1. Acquire and pin", "Lock chart source, dependencies, digests, and provenance."],
    ["2. Render and capture", "Run Helm under recorded inputs and prove render parity with cub installer."],
    ["3. Shape base variants", "Name the install shapes that change Helm inputs or object shape."],
    ["4. Scan and gate", "Scan the exact rendered objects and record allow, warn, or block decisions."],
    ["5. Settle prerequisites", "Record target facts, preflight needs, approvals, signatures, and delivery requirements."],
    ["6. Publish and deploy", "Publish or apply the approved object set and route lifecycle behavior."],
    ["7. Observe and operate", "Record live state, freshness, drift, promotion, upgrade, and rollback evidence."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header>
    ${topNav(".")}
    <h1>Use Helm charts. Ship ConfigHub variants.</h1>
    ${generatedStamp(catalog, "public catalog dashboard")}
    <p class="tagline">helm-expt ports popular public Helm charts to reviewed <code>cub installer</code> packages without changing the supported end-to-end semantics. The result is explicit config: named base variants, rendered objects, target prerequisites, scans, gates, live evidence, and a receipt behind every claim.</p>
    <div class="doors">
      <div class="door">
        <span class="kicker">Run it</span>
        <h3><a href="./try.html">Try the catalog in 5 minutes</a></h3>
        <p>Render, review, and apply Redis from the public catalog - locally, no account.</p>
        <pre><code>cub installer setup \\
  --pull packages/bitnami/redis/25.5.3 \\
  --base default --work-dir .tmp/redis \\
  --non-interactive --namespace redis</code></pre>
        <span class="go"><a href="./try.html">All three try paths →</a></span>
      </div>
      <div class="door">
        <span class="kicker">See the state</span>
        <h3><a href="./matrix.html">The whole catalog, one matrix</a></h3>
        <p>Every chart variant against every proof lane - render parity, ConfigHub, local live, GitOps, parity - colored by committed evidence. Grey means not yet run, never hidden.</p>
        <span class="go"><a href="./matrix.html">Open the status matrix →</a></span>
      </div>
      <div class="door">
        <span class="kicker">Check our honesty</span>
        <h3><a href="./hard-questions.html">FAQ for hard questions</a></h3>
        <p>Hooks, upgrades, custom values, target prerequisites, false-green sync, and what we still refuse to claim.</p>
        <span class="go"><a href="./hard-questions.html">Open the FAQ →</a></span>
      </div>
      <div class="door">
        <span class="kicker">Challenge it</span>
        <h3><a href="https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml">Send a problem chart</a></h3>
        <p>If a public chart, values file, hook, CRD, or live behavior does not work, send it to us. We will use it as a test case: either make the path work, explain what has to be prepared first, or say clearly why it is not covered yet.</p>
        <span class="go"><a href="https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml">Open the issue template →</a></span>
      </div>
    </div>
    <h2>What This Gives A Helm User</h2>
    <div class="grid">
      ${userValueRows.map(([title, body]) => `<div class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`).join("\n      ")}
    </div>
    <p><a href="https://artifacthub.io/" rel="noopener">Artifact Hub</a> answers what exists and who published it. <a href="https://helm.sh/" rel="noopener">Helm</a> renders and installs it. This catalog adds a per-chart, per-variant <strong>proof</strong> chain - rendered, uploaded, applied, observed, compared, with a receipt for each step.</p>
    <h2>The chain of proof</h2>
    <div class="chain">
      <a href="../docs/user/verify-it-yourself.md">Helm-equivalent render, byte-compared</a>
      <a href="../docs/user/helm-pain-points.md">Provenance, quirks &amp; hooks classified</a>
      <a href="./charts/index.html">Package + named base variants</a>
      <a href="../data/README.md">ConfigHub units, scans, safe ops</a>
      <a href="./matrix.html">Live observation on real clusters</a>
      <a href="../docs/user/live-parity.md">Helm-vs-ConfigHub parity receipts</a>
    </div>
    <h2>Where it goes from free</h2>
    <div class="tiers">
      <div class="tier"><span class="stage">tier 0</span><h3>Public catalog</h3><p>Top charts, proof-grade recipes and packages, with committed receipts that can be checked locally.</p><span class="badge now">available</span></div>
      <div class="tier"><span class="stage">tier 1</span><h3>Verified install</h3><p>Resolve, verify, apply, and record an in-cluster receipt - before any login.</p><span class="badge planned">planned</span></div>
      <div class="tier"><span class="stage">tier 2</span><h3>Catalog subscription</h3><p>Refresh cadence, CVE turnaround, and the attestation pack per variant.</p><span class="badge planned">planned</span></div>
      <div class="tier"><span class="stage">tier 3</span><h3>Private catalog</h3><p>The same render-scan-sign pipeline over your own charts and overlays.</p><span class="badge planned">planned</span></div>
      <div class="tier"><span class="stage">tier 4</span><h3>ConfigHub Server</h3><p>Fleet inventory, variants, promotions, gates, and live operations at estate scale.</p><span class="badge planned">planned</span></div>
    </div>
    <p>Private and managed boundaries are spelled out on the <a href="./private/">Private page</a>; planned tiers are plans, not shipped behavior - the <a href="../data/claims-register/summary.md">claims register</a> is the wording boundary.</p>
  </header>
  <main>
    <section aria-labelledby="first-time">
      <h2 id="first-time">First-Time Helm User Path</h2>
      <p>Start with the smallest step that answers your question. Direct Helm paths are for quick inspection. The public catalog is for maintained bases and proof. ConfigHub-managed workflows are for private inputs, teams, policies, approvals, variants, promotions, GitOps/OCI operations, full stacks, patch and upgrade services, and production support.</p>
      ${markdownLikeTable([
        ["Step", "What to do", "Boundary"],
        ...firstTimeRows,
      ])}
      <p>The extra value starts after rendering: reviewed objects can become Units, then day-1 variants, then day-2 operations with diffs, scans, gates, promotions, observations, and receipts.</p>
    </section>

    <section aria-labelledby="proof-counters">
      <h2 id="proof-counters">Proof Counters</h2>
      <div class="grid">
        ${counters.map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works">Seven-Stage Lifecycle</h2>
      <p>The catalog separates Helm rendering, variant choices, delivery, and live evidence so each claim can be checked at the right boundary.</p>
      <div class="stage-grid">
        ${stages.map(([title, body]) => `<div class="lane"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="serious-chart">
      <h2 id="serious-chart">Serious Chart Proof</h2>
      <p>Redis is the teaching chart. kube-prometheus-stack is the larger proof path because it combines object fanout, CRDs, webhooks, RBAC, generated facts, extension slots, target prerequisites, GitOps, and live observation boundaries.</p>
      ${markdownLikeTable([
        ["Base", "User choice", "Render", "Two-cluster kind", "OCI/GitOps", "Production", "Next hard work"],
        ...highFanoutRows,
      ])}
      <p>Production support for this chart is target-scoped. The checklist below is the short version of the generated high-fanout report.</p>
      ${markdownLikeTable([
        ["Decision", "What must be settled"],
        ...kpsProductionDecisionRows,
      ])}
      <p><a href="../data/high-fanout-demo/summary.md">Open the high-fanout proof-chain summary</a>, <a href="../docs/user/prometheus-high-fanout.md">read the KPS user guide</a>, or <a href="../docs/user/chain-of-proof.md">read the chain-of-proof guide</a>.</p>
    </section>

    <section aria-labelledby="command-choice">
      <h2 id="command-choice">Choose The Shortest Useful Command</h2>
      <p>The Helm command family is not one path. Use direct Helm commands for quick inspection or one-shot loading. Use cub installer when you want a maintained catalog entry with bases, receipts, scans, and live evidence.</p>
      ${markdownLikeTable([
        ["Goal", "Command path"],
        ...catalog.commandRoutes.map((row) => [row.goal, row.command]),
      ])}
      <p><a href="../docs/user/choosing-commands.md">Open the command-routing guide</a>.</p>
    </section>

    <section aria-labelledby="current-status">
      <h2 id="current-status">Current Status</h2>
      <p>The site uses the generated status dashboard. A partial or gap status means the exact lane still needs receipts, not that render parity failed.</p>
      ${markdownLikeTable([
        ["Metric", "Value", "Status"],
        ...statusRows.map((row) => [row.metric, metricValue(row), row.status]),
      ])}
      <p><a href="../data/status-dashboard/summary.md">Open the full status dashboard</a>.</p>
    </section>

    <section aria-labelledby="chart-use">
      <h2 id="chart-use">Can I Use This Chart?</h2>
      <p>The chart-use guide gives one practical answer per top-100 chart. It is the fastest route when a user already knows the chart name and wants to know whether to try the public catalog, promote after review, design a better base, or settle a limitation first.</p>
      ${markdownLikeTable([
        ["Answer", "Charts", "Meaning", "First examples"],
        ...chartUsePreviewRows,
      ])}
      <p><a href="../data/chart-use-guide/summary.md">Open the generated chart-use guide</a> or <a href="../data/chart-use-guide/chart-use-guide.csv">download the chart-use CSV</a>.</p>
    </section>

    <section aria-labelledby="trust-surfaces">
      <h2 id="trust-surfaces">Trust Surfaces</h2>
      <p>The catalog is designed to show non-pass evidence instead of hiding it. A strict live witness block must be routed through the watchlist or a named normalization rule before anyone claims parity for that row.</p>
      <div class="grid">
        <div class="card"><h3>Outcome evidence</h3><p><a href="../data/outcome-evidence-contract/summary.md">Open the outcome contract</a>.</p></div>
        <div class="card"><h3>What we refuse to claim</h3><p><a href="../docs/user/what-we-refuse-to-claim.md">Read the claim boundary</a>.</p></div>
        <div class="card"><h3>Why Synced is not working</h3><p><a href="../docs/user/why-synced-is-not-working.md">Read the false-green example</a>.</p></div>
        <div class="card"><h3>Why this does not collapse</h3><p><a href="../docs/user/why-this-does-not-collapse.md">Read the hook, quirk, and config-volume answer</a>.</p></div>
        <div class="card"><h3>Verify it yourself</h3><p><a href="../docs/user/verify-it-yourself.md">Run the checks yourself</a>.</p></div>
        <div class="card"><h3>Watchlist</h3><p><a href="../data/live-e2e/cub-scout-watchlist.md">Open strict witness findings</a>.</p></div>
        <div class="card"><h3>Normalization log</h3><p><a href="../data/live-e2e/normalization-rules.md">Open accepted live-witness normalization rules</a>.</p></div>
      </div>
    </section>

    <section aria-labelledby="production-readiness">
      <h2 id="production-readiness">Production Readiness Boundary</h2>
      <p>The top-20 charts are catalog-supported for the declared local-test scope. Production support is tracked separately. A review-ready chart has required dispositions closed, but still needs a final target-scoped support decision.</p>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(catalog.summary.productionSupportedCharts)}/${escapeHtml(catalog.productionSupportDecisions.length)}</strong><span>Supported target scopes</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.productionSupersededCharts + catalog.summary.productionRejectedCharts)}/${escapeHtml(catalog.productionSupportDecisions.length)}</strong><span>Closed, not supported</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.productionReviewReadyCharts)}/${escapeHtml(catalog.productionDisposition.length)}</strong><span>Production-review-ready charts</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.productionDraftCharts)}/${escapeHtml(catalog.productionSupportDecisions.length)}</strong><span>Draft support decisions</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.chartsWithAcceptedProductionDispositions)}/${escapeHtml(catalog.productionDisposition.length)}</strong><span>Charts with accepted dispositions</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.mutableImageScanRows)}/${escapeHtml(catalog.scanDisposition.length)}</strong><span>Mutable-image scan rows</span></div>
      </div>
      <p>Scan warnings are routed before production support is claimed. The current high-priority rows are security or privileged-infrastructure disposition work, not simple image-pin fixes.</p>
      <p>The final support queue is grouped by the decision that must happen next.</p>
      ${markdownLikeTable([
        ["Workstream", "Charts", "Next action"],
        ...productionWorkstreamRows,
      ])}
      ${markdownLikeTable([
        ["Scan route", "Charts", "Meaning"],
        ...scanDispositionRoutes,
      ])}
      ${markdownLikeTable([
        ["Open disposition", "Charts"],
        ...productionBlockers,
      ])}
      ${markdownLikeTable([
        ["Chart", "Production", "Accepted", "Open", "Next action"],
        ...productionDispositionRows,
      ])}
      <p><a href="../docs/user/production-support-decisions.md">Open the production support decision guide</a>, <a href="../data/hard-chart-production-packets/summary.md">open the hard-chart production packets</a>, <a href="../data/production-disposition/summary.md">open the full production disposition report</a>, or <a href="../data/scan-disposition-workdown/summary.md">open the scan disposition workdown</a>.</p>
    </section>

    <section aria-labelledby="live-rerun-plan">
      <h2 id="live-rerun-plan">Live Parity Rerun Plan</h2>
      <p>The live non-pass rows are work queues, not hidden failures. The rerun plan separates semantic parity defects from target prerequisites, runtime watch rows, hooks, and operating-policy decisions.</p>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(catalog.summary.liveParityRerunRows)}</strong><span>Rows in rerun queue</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.liveParityRerunSemanticDefects)}</strong><span>Semantic parity defects</span></div>
        <div class="metric"><strong>${escapeHtml(rerunCounts["configHub-oci-live-comparison"] ?? 0)}</strong><span>ConfigHub/OCI non-pass rows</span></div>
        <div class="metric"><strong>${escapeHtml(rerunCounts["two-cluster-kind-parity"] ?? 0)}</strong><span>Two-cluster rows to resolve</span></div>
      </div>
      ${markdownLikeTable([
        ["Chart", "Base", "Current", "Next step", "Reason", "Support artifact"],
        ...rerunRows,
      ])}
      <p><a href="../data/status-dashboard/active-proof-queue.csv">Open the active proof queue</a> or <a href="../data/live-parity-rerun-plan/summary.md">open the full live parity rerun plan</a>.</p>
    </section>

    <section aria-labelledby="top100-readiness">
      <h2 id="top100-readiness">Top-100 Readiness</h2>
      <p>The top-100 corpus is not one claim. It separates charts a Helm user can try now from charts that need target prerequisites, operator review, better base variants, or limitation decisions.</p>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(catalog.summary.top100ChartsWithLiveEvidence)}/100</strong><span>Charts with live evidence</span></div>
        <div class="metric"><strong>${escapeHtml(top100UserReadinessCounts["ready-to-try"] ?? 0)}/100</strong><span>Ready to try</span></div>
        <div class="metric"><strong>${escapeHtml(top100UserReadinessCounts["works-with-target-prerequisites"] ?? 0)}/100</strong><span>Need target input</span></div>
        <div class="metric"><strong>${escapeHtml(top100UserReadinessCounts["works-with-operator-review"] ?? 0)}/100</strong><span>Need operator review</span></div>
        <div class="metric"><strong>${escapeHtml(top100UserReadinessCounts["needs-better-base-variant"] ?? 0)}/100</strong><span>Need useful variants</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.top100CoveragePromotionQueue)}/80</strong><span>Strict promotion queue</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.top100PromotionWaveRows)}</strong><span>First strict promotion wave</span></div>
        <div class="metric"><strong>${escapeHtml(top100UserReadinessCounts["not-ready-yet"] ?? 0)}/100</strong><span>Not ready yet</span></div>
      </div>
      ${markdownLikeTable([
        ["User-readiness group", "Charts", "Meaning"],
        ...top100UserReadinessRows,
      ])}
      <p>Hard gaps are capability warnings, not automatic chart failures. Read them with the adoption bucket.</p>
      ${markdownLikeTable([
        ["Adoption bucket", "Rows", "With hard gaps", "Meaning"],
        ...top100HardGapRows,
      ])}
      ${markdownLikeTable([
        ["Queue", "First rows"],
        ...top100QueueRows,
      ])}
      <p><a href="../docs/user/top100-status.md">Open the plain-English top-100 status</a>, <a href="../data/top100-user-readiness/summary.md">open the user-readiness table</a>, <a href="../data/useful-base-design-queue/summary.md">open the useful-base design queue</a>, <a href="../data/top100-coverage/work-queue.md">open the strict coverage work queue</a>, <a href="../data/top100-promotion-wave/summary.md">open the first strict promotion wave</a>, or <a href="../data/top100-coverage/decisions-needed.md">open the limitation decision memos</a>.</p>
    </section>

    <section aria-labelledby="top500-evidence">
      <h2 id="top500-evidence">Top-500 Evidence Map</h2>
      <p>The top-500 data is reconnaissance plus proof indexing. It shows how common Helm quirks are and which popular charts already match current recipe/package evidence. It is not blanket certification.</p>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(catalog.top500Evidence.sourceScanned)}/${escapeHtml(catalog.top500Evidence.rows)}</strong><span>Source rows scanned</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.top500Evidence.currentRecipeRows)}/${escapeHtml(catalog.top500Evidence.rows)}</strong><span>Rows matched to current proofs</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.top500Evidence.noCurrentRecipeRows)}/${escapeHtml(catalog.top500Evidence.rows)}</strong><span>Reconnaissance only</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.top500Evidence.multiVariantProofs)}</strong><span>Matched multi-variant proofs</span></div>
      </div>
      ${markdownLikeTable([
        ["Signal", "Count", "Meaning"],
        ["catalog-supported", catalog.top500Evidence.catalogSupported, "Current public catalog entries in the matched top-500 evidence."],
        ["proof-grade", catalog.top500Evidence.proofGrade, "Matched charts with deterministic proof artifacts but not public catalog promotion."],
        ["different current version", catalog.top500Evidence.differentCurrentVersionRows, "A current recipe exists, but the source-scan row used a different version."],
        ["no current recipe proof", catalog.top500Evidence.noCurrentRecipeRows, "Backlog data only: create recipe, variants, scans, and receipts before product claims."],
      ])}
      <p><a href="../data/top500-catalog-analysis/summary.md">Open the full top-500 catalog analysis</a>.</p>
    </section>

    <section aria-labelledby="base-readiness">
      <h2 id="base-readiness">Which Base Should I Start With?</h2>
      <p>Each catalog chart has named base variants. The table below shows the recommended first base for each top-20 chart and whether that base is ready as a clean first path, needs extra proof, has related lifecycle evidence, or needs runtime/prerequisite review.</p>
      <div class="lanes">
        ${Object.entries(baseReadinessCounts)
          .map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`)
          .join("\n        ")}
      </div>
      ${markdownLikeTable([
        ["Status", "Meaning"],
        ...baseReadinessLabelRows(),
      ])}
      ${markdownLikeTable([
        ["Chart", "Recommended base", "Readiness", "Command", "Reason"],
        ...recommendedBaseRows,
      ])}
      <p><a href="../data/top20-base-readiness/summary.md">Open the full base-readiness table</a>.</p>
    </section>

    <section aria-labelledby="catalog">
      <h2 id="catalog">Catalog-Supported Charts</h2>
      <p>These entries are supported for the declared local-test scope. Production support is tracked separately by target-scoped decisions: supported, superseded, rejected, or draft.</p>
      <div class="catalog">
        ${entries.map(chartCard).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="latest">
      <h2 id="latest">Latest-Version Candidates</h2>
      <p>New upstream versions are tracked separately from supported catalog versions. Some rows have proof-complete retained candidates; some retained candidates have already been superseded by newer upstream releases; some rows need a new candidate first. No row replaces a pinned supported version until a target-scoped replacement decision records whether to replace, defer, or keep both versions.</p>
      ${markdownLikeTable([
        ["Chart", "Supported", "Latest upstream", "Candidate proof", "Action", "Priority"],
        ...catalog.latestCandidates.map((row) => [row.chart, row.currentVersion, row.candidateVersion, row.proofStatus, row.action, row.priority]),
      ])}
      <p><a href="../data/latest-top20-refresh/action-queue/summary.md">Open the latest refresh action queue</a>, <a href="../data/refresh-survival/summary.md">open the refresh survival report</a>, or <a href="../data/latest-top20-refresh/replacement-decisions/summary.md">open the retained candidate replacement-decision queue</a>.</p>
    </section>

    <section aria-labelledby="variants">
      <h2 id="variants">Variant Examples</h2>
      <p>These generated goldens show how catalog bases become downstream ConfigHub variants without hiding a Helm rerender.</p>
      <div class="catalog">
        <article class="card">
          <h3>Redis production variant</h3>
          <dl>
            <dt>From</dt><dd>redis/default</dd>
            <dt>Creates</dt><dd>redis/prod-us-east</dd>
            <dt>Model</dt><dd>Spaces, Units, labels, upstream links</dd>
            <dt>Proof</dt><dd><a href="../data/variant-goldens/redis-prod-us-east/README.md">Redis Creator golden</a></dd>
          </dl>
        </article>
        <article class="card">
          <h3>Managed overlay</h3>
          <dl>
            <dt>Chart</dt><dd>external-dns/external-dns</dd>
            <dt>Input</dt><dd>wrapper chart + platform values + customer overlay</dd>
            <dt>Model</dt><dd>render-time choices route to cub installer; post-render choices route to Creator</dd>
            <dt>Proof</dt><dd><a href="../data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md">ExternalDNS overlay golden</a></dd>
          </dl>
        </article>
      </div>
    </section>

    <section aria-labelledby="extension-slots">
      <h2 id="extension-slots">Extension Slots</h2>
      <p>Many Helm charts expose raw manifests, tpl snippets, config blocks, sidecars, or add-on slots. Supported bases keep those slots empty or controlled. If a user populates one, that should become a reviewed cub installer base with render parity, scans, gates, and receipts.</p>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(catalog.summary.top20ChartsWithExtensionSlots)}/20</strong><span>Top-20 charts with extension slots</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.top100ChartsWithExtensionSlots)}/100</strong><span>Top-100 charts with surfaced extension slots</span></div>
      </div>
      ${markdownLikeTable([
        ["Chart", "Example surfaces", "Route"],
        ...top20ExtensionRows,
      ])}
      <p><a href="../data/extension-slots/summary.md">Open the full extension-slot coverage report</a>.</p>
    </section>

    <section aria-labelledby="data">
      <h2 id="data">Generated Data</h2>
      <p>This static view is generated from repo artifacts. The machine-readable catalog is <a href="./catalog.json">catalog.json</a>.</p>
      <ul>
        <li><a href="../CATALOG.md">Root catalog</a></li>
        <li><a href="../data/top100-catalog-analysis/summary.md">Top-100 catalog analysis</a></li>
        <li><a href="../data/top500-catalog-analysis/summary.md">Top-500 catalog analysis</a></li>
        <li><a href="../data/refresh-survival/summary.md">Refresh survival and upgrade seed</a></li>
        <li><a href="../data/latest-top20-refresh/action-queue/summary.md">Latest refresh action queue</a></li>
        <li><a href="../data/latest-top20-refresh/promotion-readiness.md">Latest candidate promotion readiness</a></li>
        <li><a href="../data/latest-top20-refresh/promotion-work-orders.md">Latest candidate promotion work orders</a></li>
        <li><a href="../data/latest-top20-refresh/replacement-decisions/summary.md">Latest candidate replacement decisions</a></li>
        <li><a href="../data/runtime-gitops/summary.md">Runtime/GitOps first wave</a></li>
        <li><a href="../data/image-digest-workdown/summary.md">Image digest workdown</a></li>
        <li><a href="../data/scan-disposition-workdown/summary.md">Scan disposition workdown</a></li>
        <li><a href="../data/app-readiness/summary.md">App-readiness RBAC read-app</a></li>
        <li><a href="../data/preview-readiness/summary.md">Preview readiness</a></li>
        <li><a href="../data/cub-scout-diff/summary.md">cub-scout diff evidence</a></li>
        <li><a href="../data/outcome-evidence-contract/summary.md">Outcome evidence contract</a></li>
        <li><a href="../data/hard-chart-production-packets/summary.md">Hard-chart production packets</a></li>
        <li><a href="../data/next-ten-waves/summary.md">Next-ten execution waves</a></li>
        <li><a href="../data/chart-use-guide/summary.md">Chart use guide</a></li>
        <li><a href="../data/top20-base-readiness/summary.md">Top-20 base readiness</a></li>
        <li><a href="../docs/user/top100-status.md">Plain-English top-100 status</a></li>
        <li><a href="../data/top100-user-readiness/summary.md">Top-100 user readiness</a></li>
        <li><a href="../data/useful-base-design-queue/summary.md">Useful base design queue</a></li>
        <li><a href="../data/extension-slots/summary.md">Extension slot coverage</a></li>
        <li><a href="../data/lifecycle-observations/cert-manager-eso/summary.md">Cert-manager and External Secrets lifecycle observations</a></li>
      </ul>
    </section>
  </main>
  <footer>
    Generated from helm-expt proof data. Latest available chart versions and supported proof versions are intentionally shown separately.
  </footer>
</body>
</html>
`;
}

function offeringHtml(catalog) {
  return parityFirstHomeHtml(catalog, "public offering page");
}

function legacyOfferingHtml(catalog) {
  const metric = (name) => catalog.statusMetrics.find((row) => row.metric === name) ?? {};
  const top100UserReadinessCounts = countBy(catalog.top100UserReadiness, "bucket");
  const publicCounters = [
    ["Public catalog pages", `${catalog.summary.publicCatalogCharts}/100`],
    ["Recipe proofs", metricValue(metric("maintained chart rows with model support"))],
    ["Render parity", metricValue(metric("render parity rows"))],
    ["Local live receipts", metricValue(metric("local live rows"))],
    ["Two-cluster parity", metricValue(metric("two-cluster kind parity pass rows"))],
    ["Semantic defects", metricValue(metric("two-cluster semantic parity defect receipts"))],
  ];
  const proofRows = [
    ["Render parity", "Compare regular Helm rendering with the cub installer package output."],
    ["Exact object review", "Review the Kubernetes objects, not just the values file that may produce them."],
    ["Target prerequisites", "Record required CRDs, Secrets, StorageClasses, cloud credentials, or controller assumptions as explicit facts."],
    ["Lifecycle evidence", "Stage or route hook-like behavior and observe the target where a live claim is made."],
    ["Scans and gates", "Bind policy findings and decisions to the rendered object set."],
    ["Variants", "Use base variants for Helm render choices and derived ConfigHub variants for approved post-render changes."],
    ["Live evidence", "Record what a local cluster, GitOps controller, or observer actually saw."],
    ["Watchlists", "Keep target capability and lifecycle gaps visible instead of silently turning them green."],
  ];
  const freeRows = [
    ["Browse public catalog", "See chart versions, base variants, proof status, pain reports, and known gaps."],
    ["Inspect and template", "Use cub helm template and rendered-object views before committing to ConfigHub state."],
    ["Use public packages", "Run cub installer setup --pull <package> --base <base> for supported public bases."],
    ["Pull public artifacts", "Use public package or OCI artifacts where available without uploading private repo or production state."],
    ["Verify locally", "Check available signatures, digests, rendered objects, receipts, or chart-specific verifiers on your own machine."],
    ["Inspect proof", "Read receipts, rendered objects, Helm pain reports, and current status without trusting a screenshot."],
  ];
  const paidRows = [
    ["Private and custom catalogs", "Import wrapper charts, private values, customer overlays, private OCI sources, and team-specific catalogs."],
    ["Managed variants and teams", "Create environment, region, customer, and target variants with teams, approvals, policies, links, target facts, and receipts."],
    ["Fleet operations", "Bulk scan, patch, approve, promote, observe, and audit across many spaces or clusters."],
    ["GitOps and OCI operations", "Manage delivery handoffs, controller credentials, artifact access, observations, rollback evidence, and audit history."],
    ["Full-stack support", "Target-scoped production decisions, patch services, upgrade services, old-version support, SLAs, policies, and approvals."],
  ];
  const personaRows = [
    ["Platform engineer", "Wants a safer path from public Helm chart to approved cluster config."],
    ["App team", "Wants a simple install path that still allows dev/prod/customer variants."],
    ["Security reviewer", "Wants scans and gates on exact rendered objects before deployment."],
    ["SRE/operator", "Wants receipts for what was applied, observed, promoted, upgraded, or rolled back."],
    ["Catalog maintainer", "Wants to know which charts are ready, watch, blocked, or need better variants."],
  ];
  const frontierRows = [
    ["Field provenance", "Blast-radius prediction is scored by a generated accuracy harness: 13 measured cases, 13 passing, 0 failing, and 0 unmeasured value-source rows. The claim remains per measured case; not every rendered field in every chart has provenance."],
    ["Change authority", "ConfigHub records and gates operations; full per-field authority for every user or agent is not yet proven."],
    ["Live-to-desired flow", "Live observations are recorded; authorized live fixes flowing back into desired state are future product work."],
    ["Hook execution", "Hooks are inventoried, routed, observed, refused, or marked per-target; universal hook execution is not claimed."],
    ["Fleet propagation", "Derived variants, blast-radius cases, and promotion examples exist; complete fleet propagation is still being built."],
    ["Signatures as trust", "The claims register enforces reviewer guardrails: no evidence means no current claim, partial stays partial, and refused claims stay visible. Signatures still prove integrity and transport only within a named signer, authority, and verification context."],
  ];
  const pathRows = [
    ["Quick render", "See what a chart renders without ConfigHub state.", "cub helm template", "Free/direct"],
    ["One-shot upload", "Load one Helm render into ConfigHub Units quickly.", "cub helm install", "ConfigHub account"],
    ["Public catalog package", "Use a maintained base with render parity, receipts, scans, and proof.", "cub installer setup --pull <package> --base <base>", "Free for public packages"],
    ["Reviewed ConfigHub base", "Upload a reviewed rendered base before variants or approvals.", "cub installer upload", "ConfigHub account"],
    ["Derived operations", "Create environment, region, customer, or target variants after upload.", "cub variant create", "ConfigHub-managed"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ConfigHub Helm Catalog Offering</title>
  <style>
    ${siteCss()}
    .hero { padding-top: 56px; }
    .hero h1 { max-width: 900px; }
    .route { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 18px 0; }
    .route div { border: 1px solid var(--line); border-radius: 6px; padding: 10px; background: var(--panel); font-size: .92rem; }
    .split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    nav { color: var(--muted); margin-bottom: 24px; }
    @media (max-width: 900px) { .route, .split { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>Public Helm charts, in visible and verifiable stages.</h1>
    ${generatedStamp(catalog, "offering page")}
    <p class="tagline">We port popular public Helm charts to ConfigHub without changing the intended end-to-end semantics of the supported bases.</p>
    <p>Helm is still the renderer. ConfigHub turns the result into reviewed packages, named variants, rendered objects, scans, gates, receipts, and live evidence.</p>
    <pre>public Helm chart
-> cub installer recipe/package
-> named base variants
-> exact rendered Kubernetes objects
-> scans, gates, receipts
-> ConfigHub / OCI / GitOps / live observation</pre>
  </header>
  <main>
    <section aria-labelledby="problem">
      <h2 id="problem">The Problem We Are Solving</h2>
      <p>Helm users can usually install something. The harder problem is knowing exactly what was produced, whether the same thing was promoted, what changed between environments, whether the exact objects were scanned, and what the cluster actually observed after deployment.</p>
      <p>The catalog keeps the supported path close to the chart author's golden path, but makes each stage visible. That matters when humans or AI agents make changes: the recipe, variant, rendered objects, scans, gates, and live receipts show whether the change stayed on the path or created a new install shape that needs review.</p>
      <p>This is the Helm-facing slice of Generative GitOps: render once, hold the result as data, prove the boundaries, and keep GitOps delivery. The current catalog proves the import and staged lifecycle path; full field authority, fleet propagation, and authorized live-to-desired reconciliation remain product frontier work. <a href="../docs/user/generative-gitops-fit.md">Read the fit and limits</a>.</p>
      <p>Render parity is necessary, but it is only the starting point. It proves the cub installer path preserved Helm's intended object set for recorded inputs. The harder value is making target facts and lifecycle prerequisites explicit: staged CRDs, admission certificates, provider credentials, controller-owned fields, hook routes, and live observation boundaries.</p>
      <p>kube-prometheus-stack is the main example. Its no-CRDs base is not just a smaller YAML bundle; it is a contract that compatible CRDs and admission certificate material must already exist or be staged before config-only delivery. The catalog records that contract instead of treating a green render as a complete install.</p>
      ${markdownLikeTable([
        ["Frontier", "Current status"],
        ...frontierRows,
      ])}
      <div class="grid">
        ${personaRows.map(([title, body]) => `<div class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="offer">
      <h2 id="offer">What The Offering Is</h2>
      <p>A public catalog of maintained Helm-derived packages, plus a path into ConfigHub for teams that need private variants, approvals, policies, scans, GitOps/OCI delivery, fleet operations, and production receipts.</p>
      <p>The free public lane helps users browse, inspect, template, install supported public chart bases, pull public artifacts, and verify available signatures, digests, and receipts. The paid lane is for private charts, custom catalogs, teams, policies, approvals, bulk operations, promotions, GitOps/OCI operations, full stacks, patch services, upgrade services, and production support.</p>
      <div class="route">
        <div>1. Pick chart</div>
        <div>2. Pick base variant</div>
        <div>3. Render exact objects</div>
        <div>4. Review and verify</div>
        <div>5. Operate variants</div>
      </div>
      ${markdownLikeTable([
        ["Layer", "What it gives a Helm user"],
        ...proofRows,
      ])}
    </section>

    <section aria-labelledby="stages">
      <h2 id="stages">Start At Your Stage</h2>
      <p>Each stage asks for more trust and gives more value. Direct Helm paths answer immediate render or upload questions; the public catalog adds maintained bases and proof; ConfigHub-managed workflows add private inputs, teams, approvals, variants, and operations.</p>
      ${markdownLikeTable([
        ["Path", "Use it when", "Command or surface", "Boundary"],
        ...pathRows,
      ])}
      <p><a href="../docs/user/choose-your-path.md">Open the full route picker</a> for tutorial links, free/public boundaries, and ConfigHub-managed operations.</p>
    </section>

    <section aria-labelledby="two-uses">
      <h2 id="two-uses">Why This Helps</h2>
      <div class="split">
        <section class="card">
          <h3>Change safely</h3>
          <p>When a person or AI agent changes a chart input, base variant, or post-render ConfigHub variant, the pipeline can compare the exact object set, scan it, and show the receipt trail before the change is promoted.</p>
        </section>
        <section class="card">
          <h3>Stay on the supported path</h3>
          <p>Many Helm failures come from accidentally driving a chart away from the path its authors expected. The catalog makes supported bases explicit, records where a custom choice belongs, and flags target or lifecycle gaps before they become production surprises. It keeps the user on the right path and makes departures visible.</p>
        </section>
      </div>
      <p>For a day-2 example, read <a href="../docs/user/helm-upgrade-crash-example.md">how an opaque Helm upgrade becomes staged, reviewed, rehearsed, gated, and observed</a>.</p>
    </section>

    <section aria-labelledby="try">
      <h2 id="try">Try It Without A Big Commitment</h2>
      <p>The first path should feel closer to <code>helm install redis</code> than to a platform migration. Start with a public package and local verification. Use a ConfigHub account when you want managed state, private inputs, or production workflows.</p>
      <pre>cub installer setup --pull packages/bitnami/redis/25.5.3 \\
  --base default \\
  --work-dir .tmp/redis \\
  --non-interactive \\
  --namespace redis</pre>
      <div class="split">
        <section class="card">
          <h3>Low-friction public use</h3>
          ${simpleList(freeRows)}
        </section>
        <section class="card">
          <h3>ConfigHub-managed use</h3>
          ${simpleList(paidRows)}
        </section>
      </div>
    </section>

    <section aria-labelledby="status">
      <h2 id="status">What Is Proven Today</h2>
      <p>The repo is explicit about what is proven and what is still a watch or blocked item. A green render check does not become a production support claim.</p>
      <div class="grid">
        ${publicCounters.map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("\n        ")}
      </div>
      <p>Top-100 readiness is also separated by usefulness:</p>
      ${markdownLikeTable([
        ["Bucket", "Charts", "Meaning"],
        ["ready-to-try", top100UserReadinessCounts["ready-to-try"] ?? 0, "Catalog-supported with a reviewed first base and live evidence."],
        ["works-with-target-prerequisites", top100UserReadinessCounts["works-with-target-prerequisites"] ?? 0, "Works once the target provides the named prerequisite."],
        ["works-with-operator-review", top100UserReadinessCounts["works-with-operator-review"] ?? 0, "Render proof exists, but an operator should review the named concern first."],
        ["needs-better-base-variant", top100UserReadinessCounts["needs-better-base-variant"] ?? 0, "The useful install shape has not been built and reviewed yet."],
        ["not-ready-yet", top100UserReadinessCounts["not-ready-yet"] ?? 0, "A limitation needs a support, disclose, defer, or block decision."],
      ])}
      <p><a href="../docs/user/top100-status.md">Open the plain-English top-100 status</a> or <a href="../data/top100-user-readiness/summary.md">open the generated user-readiness table</a>.</p>
    </section>

    <section aria-labelledby="honesty">
      <h2 id="honesty">Why This Should Be Trusted</h2>
      <p>The catalog is designed to expose hard cases, not hide them. The latest strict cub-scout witness work found Kubernetes 1.30 CRD capability issues in cert-manager and External Secrets, plus a Grafana RBAC server-normalization watch item: workloads converged, but strict rendered-object/live parity stayed blocked until the target behavior is modeled or accepted.</p>
      <p>That is the point of the model. It tells the user what is true, what is watch, what is blocked, and what decision is needed next.</p>
      ${markdownLikeTable([
        ["Signal", "Current meaning"],
        ["PASS", "The stated lane met its contract."],
        ["WATCH", "The main path worked, but extra live state or a runtime condition needs review."],
        ["BLOCK", "The lane found a missing prerequisite, runtime failure, or target capability conflict."],
        ["Missing", "Backlog, not a failed chart."],
      ])}
    </section>

    <section aria-labelledby="challenge">
      <h2 id="challenge">Send A Problem Chart</h2>
      <p>If a public Helm chart breaks the model, or if the catalog output for a supported chart does not match the Helm behavior you expect, send the chart and the values that expose the problem.</p>
      <p>The expected response is a public fixture and a receipt: pass, watch, blocked, or refused with a named reason. Private charts, private values, production remediation, and fleet rollout work belong in managed ConfigHub workflows.</p>
      <p><a href="https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml">Open the problem chart issue template</a>.</p>
    </section>

    <section aria-labelledby="links">
      <h2 id="links">Where To Go Next</h2>
      <div class="grid">
        <div class="card"><h3>Browse the catalog</h3><p><a href="./index.html">Open the generated catalog dashboard</a>.</p></div>
        <div class="card"><h3>Check a chart</h3><p><a href="../data/chart-use-guide/summary.md">Open the chart-use guide</a>.</p></div>
        <div class="card"><h3>Try it</h3><p><a href="./try.html">Open the short try-now page</a>.</p></div>
        <div class="card"><h3>Choose a path</h3><p><a href="../docs/user/choose-your-path.md">Open the route picker</a>.</p></div>
        <div class="card"><h3>Pick a base variant</h3><p><a href="../data/top20-base-readiness/summary.md">Open top-20 base readiness</a>.</p></div>
        <div class="card"><h3>Read current proof status</h3><p><a href="../docs/user/current-proof-status.md">Open current proof status</a>.</p></div>
        <div class="card"><h3>Review an upgrade story</h3><p><a href="../docs/user/helm-upgrade-crash-example.md">Open the Helm upgrade crash example</a>.</p></div>
        <div class="card"><h3>Check the trust boundary</h3><p><a href="../docs/user/what-we-refuse-to-claim.md">Open what we refuse to claim</a>.</p></div>
        <div class="card"><h3>Verify it yourself</h3><p><a href="../docs/user/verify-it-yourself.md">Open verification commands</a>.</p></div>
        <div class="card"><h3>Understand production support</h3><p><a href="../docs/user/production-support-decisions.md">Open production support decisions</a>.</p></div>
        <div class="card"><h3>Choose the right command</h3><p><a href="../docs/user/choosing-commands.md">Open command routing</a>.</p></div>
      </div>
    </section>
  </main>
  <footer>
    Experimental public catalog proof. Production support requires a target-scoped decision and fresh receipts.
  </footer>
</body>
</html>
`;
}

function tryHtml(catalog) {
  const pathRows = [
    ["Normal Helm", "Use this if you want Helm to deploy Redis directly into a Kubernetes cluster.", "Kubernetes cluster required."],
    ["cub installer", "Use this if you want Redis rendered into explicit local config first, so it can be inspected and managed before delivery.", "No cluster or ConfigHub account required for the render."],
  ];
  const nextRows = [
    ["Exact Redis commands", "The full command table, expected output, catalog status, variants, caveats, and evidence links live on the Redis chart page.", "./charts/bitnami-redis-25-5-3.html"],
    ["Expected results and clusters", "Use this when you want to know what output to expect and when a Kubernetes cluster is needed.", "../docs/user/expected-results-and-clusters.md"],
    ["Choose another chart", "After Redis, pick a chart from the top-100 catalog and inspect its bases, variants, quirks, and actions.", "./charts/index.html"],
    ["Serious chart example", "Use kube-prometheus-stack later when you want to see CRDs, webhooks, target facts, and lifecycle prerequisites.", "./charts/prometheus-community-kube-prometheus-stack-85-3-3.html"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Try ConfigHub Helm Catalog</title>
  <style>
    ${siteCss()}
    .hero { padding-top: 56px; }
    .split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .path-card { border: 1px solid var(--line); border-radius: 10px; padding: 16px; background: var(--surface); }
    .path-card h3 { font-size: 1.08rem; }
    .step { border-left: 3px solid var(--accent); padding-left: 12px; margin: 20px 0; }
    @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>Get started with Redis</h1>
    <p>Redis is the smallest example on this site. It lets you compare a normal Helm install with the ConfigHub <code>cub installer</code> path without starting with a complicated chart.</p>
    <p>First, look at what Helm would install. Then use <code>cub installer</code> with the same Redis chart version and the same basic assumptions. The aim is simple: check that the ConfigHub path starts from the same Kubernetes objects that Helm would create.</p>
  </header>
  <main>
    <section aria-labelledby="choice">
      <h2 id="choice">Helm or cub installer?</h2>
      <p>There are two useful ways to look at the same Redis chart. Helm is the direct install path. <code>cub installer</code> is the path that renders the chart into files you can inspect and manage before delivery.</p>
      <div class="split">
        ${pathRows
          .map(
            ([title, body, boundary]) => `<section class="path-card">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(body)}</p>
          <p><strong>${escapeHtml(boundary)}</strong></p>
        </section>`,
          )
          .join("\n        ")}
      </div>
      <p>The exact commands and expected output belong on the Redis chart page, where they can sit beside the catalog status, variants, caveats, and evidence links.</p>
      <p><a href="./charts/bitnami-redis-25-5-3.html">Open the Redis chart page</a>.</p>
    </section>

    <section aria-labelledby="should-see">
      <h2 id="should-see">You should see something like this</h2>
      <p>With normal Helm, Redis should appear as a Helm release and Kubernetes objects in your chosen namespace. With cub installer, Redis should appear as rendered local manifests under the work directory. Some bases also write separated Secret material under <code>out/secrets</code>, so those values can be handled deliberately rather than hidden inside the main render.</p>
      <p>Use <a href="../docs/user/expected-results-and-clusters.md">Expected Results And Clusters</a> when you want the longer checklist for clusters, local files, ConfigHub upload, and live evidence.</p>
    </section>

    <section aria-labelledby="what-this-proves">
      <h2 id="what-this-proves">What This Shows</h2>
      <p>Redis answers the first question: can we use the ConfigHub path without changing the starting Kubernetes objects that Helm would have created? Once that is clear, later guides can show variants, ConfigHub upload, GitOps delivery, operations, and AI-assisted changes.</p>
      ${markdownLikeTable([
        ["Question", "Answer"],
        ["Does this replace Helm?", "No. Helm remains the source chart ecosystem and the control path."],
        ["Does cub installer deploy the app?", "Not by itself. It renders a reviewed package into explicit config first."],
        ["Do I need ConfigHub for this first step?", "No. ConfigHub comes later when you want Units, variants, approvals, OCI delivery, observations, and operations."],
        ["Where is the evidence?", "On chart pages, docs, and data surfaces. The Get Started page should stay human-first."],
      ])}
    </section>

    <section aria-labelledby="next">
      <h2 id="next">Where To Go Next</h2>
      <div class="grid">
        ${nextRows
          .map(
            ([title, body, href]) => `<div class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(href)}">Open</a></p></div>`,
          )
          .join("\n        ")}
      </div>
    </section>
  </main>
  <footer>
    The short path uses current commands only. Stronger production claims require fresh target-scoped receipts.
  </footer>
</body>
</html>
`;
}

function docsHtml(catalog) {
  const guideRows = [
    ["How it works", "Start with the four moves: render, route, deliver, observe.", "./how-it-works.html"],
    ["Try the catalog", "Run the short local path first.", "./try.html"],
    ["Choose a chart", "Browse public Helm chart snapshots and their available bases.", "./charts/index.html"],
    ["Create variants", "Decide whether a change is a base variant or a derived variant.", "./variants.html"],
    ["Apps", "Group charts and your own services into one app path.", "./journey.html"],
    ["Application examples", "Combine public charts with private app pieces.", "./custom-apps.html"],
    ["Ops", "Release, observe, patch, and upgrade after upload.", "./operations.html"],
    ["Answer hard questions", "Read direct answers about hooks, upgrades, limits, and refusals.", "./hard-questions.html"],
    ["Known gaps", "Watch findings the project surfaces deliberately instead of hiding.", "./known-gaps.html"],
    ["The data model", "Learn Unit, Space, target, route, and receipt.", "../docs/user/confighub-data-model.md"],
    ["Expected results and clusters", "See what output to expect and when a cluster is needed.", "../docs/user/expected-results-and-clusters.md"],
    ["Deployment path", "Follow cub installer to ConfigHub, OCI, and a controller.", "../docs/user/cub-deployment-path.md"],
    ["GitOps adopter guide", "Keep Argo or Flux and point it at one OCI bundle.", "../docs/user/gitops-adopter-guide.md"],
    ["Security end to end", "Understand secrets, credentials, and scanning.", "../docs/user/security-end-to-end.md"],
    ["Day-2 upgrade and rollback", "Review, rehearse, and observe changes before rollout.", "../docs/user/day2-upgrade-rollback.md"],
    ["Coming from Helm", "Map Helm flags to cub inputs.", "../docs/user/helm-to-cub-migration.md"],
    ["AI-assisted changes", "Let AI propose changes while ConfigHub keeps review and rollback clear.", "../docs/user/ai-assisted-helm-changes.md"],
    ["Broken chart triage", "Find whether a failure is render, target, lifecycle, or runtime.", "../docs/user/broken-chart-triage.md"],
    ["Known gaps we surface", "Read the current watch findings before trusting a path.", "../docs/user/known-gaps-we-surface.md"],
    ["Per-chart cub adoption caveats", "Where cub is rougher than plain Helm on first run, and how each caveat is managed.", "../data/cub-adoption-caveats/summary.html"],
    ["Custom overlays", "Map wrapper charts and customer values into the model.", "../docs/user/custom-overlays.md"],
    ["Verification lanes", "See what each check proves.", "../docs/user/verification-lanes.md"],
    ["Hook lifecycle strategy", "See how hooks become visible lifecycle steps.", "../docs/user/hook-lifecycle-strategy.md"],
  ];
  const dataRows = [
    ["Helm Catalog database", "Open the chart and variant matrix.", "./matrix.html"],
    ["Generated data index", "Open the generated data catalog.", "../data/README.md"],
    ["Status dashboard", "Current aggregate status and active proof queue.", "../data/status-dashboard/summary.md"],
    ["cub adoption caveats", "The 100-chart table for universal cub-direct caveats, shared placeholder passwords, and CRD first-ordering.", "../data/cub-adoption-caveats/summary.html"],
    ["Claims register", "What is backed, partial, planned, or refused.", "../data/claims-register/summary.md"],
    ["Deep proof page", "Proof lanes and sceptic-test routing for reviewers who want the full detail.", "./proof.html"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Docs · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>Docs</h1>
    <p>Start with the guides. Use the database and generated evidence only when you need exact status.</p>
  </header>
  <main>
    <section aria-labelledby="guides">
      <h2 id="guides">Guides</h2>
      ${markdownLikeTable([
        ["Guide", "What it helps with", "Open"],
        ...guideRows.map(([name, body, path]) => [name, body, `<a href="${path}">${escapeHtml(name)}</a>`]),
      ], { rawThirdColumn: true })}
    </section>

    <section aria-labelledby="database">
      <h2 id="database">Database And Evidence</h2>
      <p>The Helm Catalog page is the browsing surface. The matrix is the database of currently supported charts and variants. The generated data files are the underlying evidence.</p>
      ${markdownLikeTable([
        ["Surface", "What it helps with", "Open"],
        ...dataRows.map(([name, body, path]) => [name, body, `<a href="${path}">${escapeHtml(name)}</a>`]),
      ], { rawThirdColumn: true })}
    </section>
  </main>
  <footer>Generated from helm-expt catalog data. Use the Helm Catalog first, then the matrix and generated data when you need exact status.</footer>
</body>
</html>
`;
}

function proofHtml(catalog) {
  const metric = (name) => catalog.statusMetrics.find((row) => row.metric === name) ?? {};
  const proofCounters = [
    ["Render parity", metricValue(metric("render parity rows")), "Regular Helm output and cub installer package output match under recorded inputs."],
    ["In-ConfigHub proof", metricValue(metric("in-ConfigHub proof rows")), "Rendered objects have been uploaded, scanned, and exercised as ConfigHub Units."],
    ["Local live", metricValue(metric("local live rows")), "The package was applied to a local Kubernetes target and observed."],
    ["GitOps/OCI live", metricValue(metric("GitOps/OCI live pass rows")), "ConfigHub-published OCI was pulled and reconciled by Argo in a live run."],
    ["Live dual parity", metricValue(metric("live Helm-vs-ConfigHub parity pass rows")), "Regular Helm, ConfigHub direct apply, and ConfigHub OCI/Argo reached the same semantic object outcome."],
    ["Two-cluster kind parity", metricValue(metric("two-cluster kind parity pass rows")), "Regular Helm and cub installer were compared on two vanilla kind clusters."],
    ["Complete core lane", metricValue(metric("complete core lane rows")), "Rows with render, ConfigHub, local live, GitOps/OCI, live parity, and two-cluster evidence."],
    ["Semantic defects", metricValue(metric("ConfigHub/OCI semantic parity defect receipts")), "Committed live parity rows where ConfigHub and Helm disagree semantically."],
  ];
  const laneRows = [
    ["Render parity", "Does cub installer preserve the Helm object set for this chart/version/base?", "Helm render receipt and installer comparison.", "Per chart, version, base, values, capability profile, and flag profile."],
    ["ConfigHub proof", "Can the rendered objects become Units, scans, safe ops, and receipts?", "ConfigHub proof receipts, function scan receipts, safe-ops receipts.", "Does not prove a GitOps controller or workload health by itself."],
    ["Local live", "Does this package apply and converge on a Kubernetes target?", "Observation receipt, workload checks, PVC/CRD/secret evidence where relevant.", "Usually local kind; target-specific production support still needs scope."],
    ["GitOps/OCI live", "Can ConfigHub-published OCI be reconciled by Argo?", "Argo sync and health in the live parity receipt.", "A green sync is not enough unless runtime checks also pass."],
    ["Live dual parity", "Does regular Helm reach the same live outcome as ConfigHub delivery?", "Strict live Helm-vs-ConfigHub parity receipt.", "Selected rows only; absence is backlog, not a failed chart."],
    ["Two-cluster kind parity", "Does Helm on one vanilla kind cluster match installer output on another?", "Two-cluster parity receipt.", "Narrowest clean parity test; no ConfigHub/OCI proof unless separately recorded."],
    ["Lifecycle observation", "Are hooks, CRDs, webhooks, generated facts, or target prerequisites observed or routed?", "Lifecycle, hook, target-fact, and serious-chart receipts.", "Partial by design; some rows are routed, blocked, per-target, or refused."],
  ];
  const scepticRows = [
    ["Claims register", "Every public claim is backed, partial, planned, or refused.", "../data/claims-register/summary.md"],
    ["Blast-radius accuracy", "Predicted affected objects are scored against actual rerender diffs, including published failures.", "../data/blast-radius-accuracy/summary.md"],
    ["Synthetic torture suite", "Breaker charts land in named pass, refusal, or route outcomes; silent outcomes fail.", "../data/torture-suite/summary.md"],
    ["Environment matrix", "Renders are checked across timezone and locale cells for the measured corpus.", "../data/environment-matrix/summary.md"],
    ["Hook dispositions", "Hook-bearing top-100 charts have observed, routed, per-target, or recipe-needed dispositions.", "../data/hook-disposition/summary.md"],
    ["Master matrix", "Every chart/version/base row carries lane status, source links, production scope, and next action.", "./matrix.html"],
  ];
  const refusalRows = [
    ["No blanket chart support", "Every claim names chart, version, base, lane, and target profile."],
    ["No whole-values-space proof", "The catalog proves named bases. Custom values must be rendered, checked, and receipted."],
    ["No universal hook execution", "Hooks are inventoried and routed; execution is claimed only with live evidence."],
    ["No production claim from render parity", "Production support requires target-scoped decisions and fresh receipts."],
    ["No signature-as-safety shortcut", "Signatures prove origin/integrity. Scans, policies, and live evidence carry safety claims."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Proof · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>Proof, not promises.</h1>
    ${generatedStamp(catalog, "proof page")}
    <p class="tagline">This page explains what the catalog proves, what each lane means, and where the proof stops. It is intentionally narrower than a marketing claim.</p>
    <p>Render parity is the starting point. The stronger claim is staged: exact objects, ConfigHub Units, scans, live apply, GitOps/OCI reconciliation, semantic comparison with Helm, lifecycle routing, and observation receipts.</p>
  </header>
  <main>
    <section aria-labelledby="counters">
      <h2 id="counters">Current Proof Counters</h2>
      <div class="grid">
        ${proofCounters.map(([label, value, body]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)} · ${escapeHtml(body)}</span></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="lanes">
      <h2 id="lanes">What Each Lane Proves</h2>
      ${markdownLikeTable([
        ["Lane", "Question", "Evidence", "Limit"],
        ...laneRows,
      ])}
      <p>Use <a href="../docs/user/verification-lanes.md">Verification Lanes</a> for the command map and <a href="../docs/user/chain-of-proof.md">Chain Of Proof</a> for the boundary between repo evidence, ConfigHub, GitOps, and live observations.</p>
    </section>

    <section aria-labelledby="serious">
      <h2 id="serious">Serious Charts Are The Test</h2>
      <p>The hard cases are where the product has to earn trust: kube-prometheus-stack, cert-manager, External Secrets, Argo Workflows, Argo Rollouts, stateful databases, and charts with hooks, CRDs, webhooks, generated secrets, storage, or target facts.</p>
      <p>For these charts, a green render is not enough. The proof must say which prerequisites are required, which lifecycle route is selected, what the target observed, and whether the production scope is accepted, superseded, rejected, or still under review.</p>
      <div class="grid">
        <div class="card"><h3>kube-prometheus-stack</h3><p><a href="../docs/user/prometheus-high-fanout.md">High-fanout guide</a> and <a href="../data/hard-chart-production-packets/summary.md">production packet</a>.</p></div>
        <div class="card"><h3>Upgrade crash example</h3><p><a href="../docs/user/helm-upgrade-crash-example.md">How a high-risk Helm upgrade becomes staged, rehearsed, gated, and observed</a>.</p></div>
        <div class="card"><h3>cert-manager and ESO</h3><p><a href="../data/lifecycle-observations/cert-manager-eso/summary.md">Lifecycle observations</a> for CRDs, webhooks, and controller-populated fields.</p></div>
        <div class="card"><h3>Argo Workflows</h3><p>Hook-delivered CRDs routed through the <a href="../data/lifecycle-boundary/summary.md">lifecycle boundary</a>.</p></div>
        <div class="card"><h3>Argo Rollouts</h3><p>Default and no-crds bases now have live Helm-vs-ConfigHub parity receipts.</p></div>
        <div class="card"><h3>Hooks</h3><p><a href="../data/hook-disposition/summary.md">Top-100 hook dispositions</a> separate observed, routed, per-target, and recipe-needed rows.</p></div>
      </div>
    </section>

    <section aria-labelledby="sceptic">
      <h2 id="sceptic">Sceptic Tests</h2>
      <p>A sceptic with a breaking chart is useful QA. The rule is that a breaker becomes a fixture, a named refusal, or a routed gap; it should not disappear into prose.</p>
      <p>Use the <a href="https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml">problem chart issue template</a> to send a public chart, values file, or catalog mismatch.</p>
      ${markdownLikeTable([
        ["Surface", "What it answers", "Open"],
        ...scepticRows.map(([name, body, path]) => [name, body, `<a href="${path}">${path}</a>`]),
      ], { rawSecondColumn: false, rawThirdColumn: true })}
    </section>

    <section aria-labelledby="refusals">
      <h2 id="refusals">What This Does Not Claim</h2>
      ${markdownLikeTable([
        ["Refusal", "Why it matters"],
        ...refusalRows,
      ])}
      <p><a href="../docs/user/what-we-refuse-to-claim.md">Read the full refusal page</a> or <a href="../data/claims-register/summary.md">open the claims register</a>.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. A passing verifier means committed evidence is self-consistent; it does not replace fresh live evidence for a new target.</footer>
</body>
</html>
`;
}

function hardQuestionsHtml(catalog) {
  const metric = (name) => catalog.statusMetrics.find((row) => row.metric === name) ?? {};
  const top100UserReadinessCounts = countBy(catalog.top100UserReadiness, "bucket");
  const nonGreenPreview = catalog.activeProofQueue
    .slice(0, 8)
    .map((row) => [row.chart, row.base, row.current_result, row.next_step_type, row.reason]);
  const laterIssueUrl = "https://github.com/confighub/helm-expt/issues/1001";
  const proofCounters = [
    ["Render parity", metricValue(metric("render parity rows"))],
    ["In-ConfigHub proof", metricValue(metric("in-ConfigHub proof rows"))],
    ["Local live", metricValue(metric("local live rows"))],
    ["GitOps/OCI live pass", metricValue(metric("GitOps/OCI live pass rows"))],
    ["Live Helm-vs-ConfigHub parity pass", metricValue(metric("live Helm-vs-ConfigHub parity pass rows"))],
    ["Complete core lanes", metricValue(metric("complete core lane rows"))],
  ];
  const readinessCounters = [
    ["Ready to try", top100UserReadinessCounts["ready-to-try"] ?? 0],
    ["Needs target prerequisites", top100UserReadinessCounts["works-with-target-prerequisites"] ?? 0],
    ["Needs operator review", top100UserReadinessCounts["works-with-operator-review"] ?? 0],
    ["Needs a better base", top100UserReadinessCounts["needs-better-base-variant"] ?? 0],
  ];
  const faqSections = [
    {
      title: "Start Here",
      rows: [
        {
          status: "answered",
          question: "Is this just Helm with extra paperwork?",
          answer:
            "No. Helm still renders. The catalog turns selected render paths into durable cub installer packages with named bases, exact objects, scans, receipts, live evidence, and ConfigHub Units when uploaded.",
          links: [["Choosing commands", "../docs/user/choosing-commands.md"], ["Browse charts", "./charts/index.html"]],
        },
        {
          status: "answered",
          question: "Do I have to rewrite my charts?",
          answer:
            "No. The point is to keep using public Helm charts where they are already the right source, then make selected install paths explicit, reviewable, variant-aware, and observable.",
          links: [["Why this exists", "../docs/user/why-this-exists.md"], ["Creating variants", "../docs/user/creating-variants.md"]],
        },
        {
          status: "answered",
          question: "Does it only work for easy charts?",
          answer:
            "No. Redis teaches the path, but kube-prometheus-stack is the serious proof chart. It exercises CRDs, webhooks, RBAC, generated facts, extension slots, target prerequisites, upgrades, and live observations.",
          links: [["Serious chart proof", "../docs/user/serious-chart-proof.md"], ["kube-prometheus-stack page", "./charts/prometheus-community-kube-prometheus-stack-85-3-3.html"]],
        },
        {
          status: "answered",
          question: "What do the current generated counts say?",
          answer:
            "The current proof counters are generated from committed evidence. They are useful for orientation, but the matrix remains the source for chart-by-chart decisions.",
          extraHtml: `<div class="faq-metrics">${proofCounters
            .map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`)
            .join("")}</div>`,
          links: [["Master matrix", "./matrix.html"], ["Current proof status", "../docs/user/current-proof-status.md"]],
        },
      ],
    },
    {
      title: "How It Works",
      rows: [
        {
          status: "answered",
          question: "How does it actually work, end to end?",
          answer:
            "Four moves: render the chart into the exact objects (the recipe), route everything that is not in the recipe (hooks, CRD installs) as explicit named steps, deliver the recipe once as an OCI bundle that Argo, Flux, or kubectl all pull, and observe it live with receipts. Nothing privileged runs silently.",
          links: [["How it works", "../docs/user/how-it-works.md"], ["The data model", "../docs/user/confighub-data-model.md"]],
        },
        {
          status: "answered",
          question: "How is config delivered — and what about OCI and credentials?",
          answer:
            "ConfigHub publishes the Units once to an OCI bundle; Argo, Flux, and plain kubectl all pull the same artifact. OCI pull credentials are provisioned for Argo and copied (re-namespaced) for Flux — never printed, logged, or passed on a command line. Argo, Flux, and cub-direct all pull the same bundle and run a routed hook — proven by a committed receipt.",
          links: [["Deployment path", "../docs/user/cub-deployment-path.md"], ["GitOps adopter guide", "../docs/user/gitops-adopter-guide.md"]],
        },
        {
          status: "answered",
          question: "How do upgrades and rollback work?",
          answer:
            "An upgrade re-renders to a new recipe, is diffed against desired and live before it applies (the rehearsal), lands through the OCI bundle as the diff you reviewed, and is confirmed live by receipts. Units are versioned, so rollback is a config revert — with irreversible migration steps flagged as explicit routes, never run silently.",
          links: [["Day-2: upgrade & rollback", "../docs/user/day2-upgrade-rollback.md"], ["Why synced is not working", "../docs/user/why-synced-is-not-working.md"]],
        },
        {
          status: "answered",
          question: "What is a Unit, a space, or a target?",
          answer:
            "A Unit is ConfigHub's versioned atom of desired state; a space is the container that holds Units; a target is where they are delivered (the OCI target publishes the bundle). The data model page defines the whole vocabulary in one place.",
          links: [["The data model", "../docs/user/confighub-data-model.md"], ["How it works", "../docs/user/how-it-works.md"]],
        },
        {
          status: "answered",
          question: "I already run Argo or Flux — what changes?",
          answer:
            "You keep your controller. The only change is the source: instead of a git repo of Helm values re-rendered downstream, you point it at one OCI bundle ConfigHub publishes from reviewed Units. Hooks become explicit routes, not silent sync-phase steps.",
          links: [["GitOps adopter guide", "../docs/user/gitops-adopter-guide.md"], ["Deployment path", "../docs/user/cub-deployment-path.md"]],
        },
        {
          status: "answered",
          question: "What is safe for AI to change?",
          answer:
            "AI is safest when it proposes changes against explicit desired state: a new base, a derived variant, a policy change, or a patch that ConfigHub can diff, gate, and observe. AI should not silently rewrite live state or bypass the route that records what changed.",
          links: [["Creating variants", "../docs/user/creating-variants.md"], ["Change routing before OCI", "../docs/user/change-routing-before-oci.md"]],
        },
      ],
    },
    {
      title: "Hooks, Secrets, And Targets",
      rows: [
        {
          status: "answered",
          question: "What happens to Helm hooks?",
          answer:
            "Hooks are not treated as ordinary static YAML. A hook or hook-like behavior must be observed, routed, marked per-target, blocked, or refused. A known route tells a human, agent, or product surface what must happen. It is not the same as automatic execution.",
          links: [["ConfigHub Actions", "./charts/index.html#actions"], ["What happens to chart hooks", "../docs/user/chart-hooks-what-happens.md"]],
        },
        {
          status: "answered",
          question: "Where do Secrets and credentials live?",
          answer:
            "They should not be hidden inside ConfigHub by accident. The catalog separates generated Secrets, existing-Secret references, target facts, and runtime Secret lifecycle where the chart requires that distinction.",
          links: [["Security end to end", "../docs/user/security-end-to-end.md"], ["Secret lifecycle data", "../data/secret-lifecycle/summary.md"], ["Target prerequisites", "../docs/user/target-prerequisites.md"]],
        },
        {
          status: "answered",
          question: "What if the cluster is the wrong shape?",
          answer:
            "A green render is not enough. Some charts need CRDs, Secrets, or cloud identity that a generic cluster does not provide. When a chart needs more than a generic cluster, we mark it clearly and say what's missing.",
          links: [["Before rerun", "../docs/user/target-prerequisites-before-rerun.md"], ["Reading the matrix", "../docs/user/reading-the-matrix.md"]],
        },
        {
          status: "later",
          question: "Can every hook run automatically in the ConfigHub path?",
          answer:
            "Not yet. The project can route and observe hook-like lifecycle behavior where evidence exists. Universal automatic execution still needs per-route product support, executor ownership, and live evidence.",
          links: [["P1 backlog", laterIssueUrl], ["Lifecycle route actions", "../data/lifecycle-route-actions/summary.md"]],
        },
      ],
    },
    {
      title: "Parity, GitOps, And Upgrades",
      rows: [
        {
          status: "answered",
          question: "Can I trust a green GitOps sync?",
          answer:
            "Not by itself. Sync means the controller accepted the desired state. Workload convergence, target prerequisites, controller-owned fields, and semantic parity need separate evidence.",
          links: [["Why synced is not working", "../docs/user/why-synced-is-not-working.md"], ["Verification lanes", "../docs/user/verification-lanes.md"]],
        },
        {
          status: "answered",
          question: "What if a Helm upgrade caused a production crash?",
          answer:
            "The model breaks the upgrade into visible steps: old render, new render, object diff, and live checks. That reduces opaque upgrades. It does not promise crash-free production.",
          links: [["Upgrade crash example", "../docs/user/helm-upgrade-crash-example.md"], ["Blast-radius accuracy", "../data/blast-radius-accuracy/summary.md"]],
        },
        {
          status: "answered",
          question: "What should I do with non-green rows?",
          answer:
            "Use the matrix to read the reason. A watch, blocked, refused, or n/a cell can be the correct answer when the reason is named and linked.",
          links: [["Active proof queue", "../data/status-dashboard/active-proof-queue.csv"], ["Matrix", "./matrix.html"]],
        },
        {
          status: "later",
          question: "Can a live Kubernetes fix flow back into desired ConfigHub state?",
          answer:
            "Not as a shipped product path yet. The reverse-reconcile design defines authority, bounded write-back, attribution, and round-trip proof. The product still needs a gated command and live proof.",
          links: [["P1 backlog", laterIssueUrl], ["Reverse reconcile design", "../docs/user/reverse-reconcile-design.md"]],
        },
      ],
    },
    {
      title: "Values, Variants, And Catalog Scope",
      rows: [
        {
          status: "answered",
          question: "Can I bring my own values files or overlays?",
          answer:
            "Yes, but the route matters. If a choice changes Helm inputs or object shape, it belongs in a new installer base or import path. If it refines an uploaded object set, it belongs in a derived ConfigHub variant.",
          links: [["Custom overlays", "../docs/user/custom-overlays.md"], ["Change routing before OCI", "../docs/user/change-routing-before-oci.md"]],
        },
        {
          status: "answered",
          question: "Can I load my existing app, platform, stack, or live cluster?",
          answer:
            "Yes, but the first step should be read-only. Discover or import the existing app, show its sources, targets, objects, labels, and ownership, then decide whether it stays as imported Units, graduates to a recipe, or becomes a managed app graph.",
          links: [["Adopting existing apps", "../docs/user/adopting-existing-apps.md"], ["Apps guide", "./journey.html"]],
        },
        {
          status: "answered",
          question: "Which path should I take?",
          answer:
            "Use the public catalog when a reviewed base exists. Use plain Helm when the chart still needs a better base or limitation decision. Create a new installer base when Helm inputs change. Create a derived ConfigHub variant when the change is post-render. Ask for managed help when private charts, teams, approvals, fleet operations, or production responsibility enter the path.",
          links: [["Choose your path", "../docs/user/choose-your-path.md"], ["Chart-use guide", "../data/chart-use-guide/summary.md"]],
        },
        {
          status: "answered",
          question: "I know Helm flags. Why does cub reject --set or -f values.yaml?",
          answer:
            "cub installer uses declared inputs and named bases instead of Helm's free-form --set model. Today cub rejects those Helm habits safely, but the errors are still too opaque. Use the migration guide until the CLI teaches this directly.",
          links: [["Helm to cub migration", "../docs/user/helm-to-cub-migration.md"], ["Helm-migrant friction data", "../data/helm-habit-friction/summary.md"]],
        },
        {
          status: "watch",
          question: "Where would a Helm user go back to Helm today?",
          answer:
            "The adoption audit names the places where cub is currently worse than or more confusing than Helm on the common journey: defaults, one-value customization, cub-direct upgrades, CRD ordering, uninstall, and rollback ergonomics. The value is not hiding those gaps; it is managing them until they are solved.",
          links: [["Adoption audit", "../docs/planning/helm-vs-cub-adoption-audit.md"], ["Helm to cub migration", "../docs/user/helm-to-cub-migration.md"]],
        },
        {
          status: "answered",
          question: "How much of the top-100 is ready for a user?",
          answer:
            "The top-100 is intentionally bucketed rather than flattened into one claim. Some charts are ready to try, some need target prerequisites, some need operator review, and some need a better base.",
          extraHtml: `<div class="faq-metrics">${readinessCounters
            .map(([label, value]) => `<div class="metric"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`)
            .join("")}</div>`,
          links: [["Top-100 status", "../docs/user/top100-status.md"], ["Top-100 user readiness", "../data/top100-user-readiness/summary.md"]],
        },
        {
          status: "later",
          question: "Can the catalog prove every values combination for a chart?",
          answer:
            "No. Claims are per chart, version, base, values path, lane, and target profile. A new values file or overlay needs its own render, scan, receipts, and live evidence.",
          links: [["P1 backlog", laterIssueUrl], ["What we refuse to claim", "../docs/user/what-we-refuse-to-claim.md"]],
        },
        {
          status: "later",
          question: "Can every top-100 or top-500 chart become ready-to-run?",
          answer:
            "Not yet. The top-20 is strongest, the top-100 is increasingly legible, and the top-500 remains mostly analysis and triage data until more recipes, bases, and receipts are added.",
          links: [["P1 backlog", laterIssueUrl], ["Top-100 status", "../docs/user/top100-status.md"]],
        },
      ],
    },
    {
      title: "Trust, Free Use, And Challenges",
      rows: [
        {
          status: "answered",
          question: "What is free and what needs ConfigHub?",
          answer:
            "Public catalog browsing, local render checks, and public package setup are free or low-friction. Private catalogs, teams, approvals, application variants, promotions, fleet operations, and production responsibility are ConfigHub-managed.",
          links: [["Apps", "./journey.html"], ["Upgrade", "./private/"]],
        },
        {
          status: "answered",
          question: "What can we build once the objects are data?",
          answer:
            "Read-only tools can query the held rendered objects without a cluster or a fresh Helm render. The app-readiness proof is a small RBAC review app over the catalog data; production versions can become ConfigHub apps, policies, and review workflows.",
          links: [["App readiness", "../data/app-readiness/summary.md"], ["Ops", "./operations.html"]],
        },
        {
          status: "answered",
          question: "What should I do if this breaks on my chart?",
          answer:
            "Send the public chart and values that expose the problem. The expected response is a public fixture and a pass, watch, blocked, refused, or routed gap with evidence.",
          links: [["Problem chart issue template", "https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml"], ["P1 unanswered backlog", laterIssueUrl]],
        },
        {
          status: "answered",
          question: "My Helm chart broke. Can this help me triage it?",
          answer:
            "Use the broken-chart path: compare the render, check target prerequisites, check lifecycle routes, check image pulls, check controller sync versus workload health, then decide whether the issue is a recipe/model gap or a target/runtime gap.",
          links: [["Problem chart issue template", "https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml"], ["Reading the matrix", "../docs/user/reading-the-matrix.md"]],
        },
        {
          status: "later",
          question: "Are signatures enough to establish trust?",
          answer:
            "No. Signatures help integrity and transport. Trust also needs signer authority, policy context, scans, gates, and live evidence. Keep that boundary visible.",
          links: [["P1 backlog", laterIssueUrl], ["Claims register", "../data/claims-register/summary.md"]],
        },
      ],
    },
    {
      title: "Known Footguns We Surface",
      rows: [
        {
          status: "watch",
          question: "Do default bases generate fresh passwords?",
          answer:
            "Not always. The default-credential check found fixed placeholder credentials in five sampled default bases, including bases whose names imply generated passwords. That is useful for deterministic demos, but it stays watch until naming, warnings, and production routes make the behavior impossible to miss.",
          links: [["Default credential check", "../data/default-credential-check/summary.md"], ["Security end to end", "../docs/user/security-end-to-end.md"]],
        },
        {
          status: "watch",
          question: "Does cub-direct remove resources that disappear during an upgrade?",
          answer:
            "Plain kubectl apply does not prune. The no-controller cub-direct path can orphan removed resources unless it uses kubectl apply --prune with a safe selector/allowlist, or another explicit delete-set. Argo and Flux are not affected because they prune declaratively.",
          links: [["Prune gap proof", "../data/prune-gap-proof/summary.md"], ["Deployment path", "../docs/user/cub-deployment-path.md"]],
        },
        {
          status: "watch",
          question: "Can cub-direct first-install CRD charts without ordering?",
          answer:
            "Not safely yet. A plain apply of a bundle that contains both a CRD and a custom resource can apply the custom resource before the CRD is established. The no-controller path needs CRD-first ordering and a wait/retry step, or it should use a controller.",
          links: [["CRD ordering gap", "../data/crd-ordering-gap/summary.md"], ["Deployment path", "../docs/user/cub-deployment-path.md"]],
        },
        {
          status: "watch",
          question: "Does cub-scout catch every live drift?",
          answer:
            "No. The current live gap proof shows cub-scout detects replica drift but misses container environment-variable drift. Drift detection is valuable, but it must state field coverage until pod-spec coverage is complete.",
          links: [["Drift detection gap", "../data/drift-detection-gap/summary.md"], ["cub-scout day-1 preview", "../data/cub-scout-diff/summary.md"]],
        },
        {
          status: "watch",
          question: "What happens if someone manually edits a field and cub re-applies?",
          answer:
            "cub's managed delivery uses server-side apply. If someone edits the same field by hand, Kubernetes can block cub instead of silently overwriting the change. That can be safer, but the CLI must explain it and offer a clear reconcile or force path.",
          links: [["SSA conflict gap", "../data/ssa-conflict-gap/summary.md"], ["Adoption audit", "../docs/planning/helm-vs-cub-adoption-audit.md"]],
        },
      ],
    },
  ];
  const faqCard = (row) => {
    const statusLabel = row.status === "later" ? "P1 backlog" : row.status;
    const parts = [
      `<article class="faq-card ${escapeHtml(row.status)}">
        <div class="faq-head">
          <h3>${escapeHtml(row.question)}</h3>
          <span class="faq-status">${escapeHtml(statusLabel)}</span>
        </div>
        <p>${escapeHtml(row.answer)}</p>`,
    ];
    if (row.extraHtml) parts.push(`        ${row.extraHtml}`);
    if (row.links?.length) {
      parts.push(
        `        <p class="faq-links">${row.links
          .map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
          .join(" · ")}</p>`,
      );
    }
    parts.push("      </article>");
    return parts.join("\n");
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FAQ · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>FAQ for skeptical Helm users.</h1>
    <p>Short answers first. Each answer links to evidence or a tracked product gap. Questions that still need product work are marked as P1 backlog items and tracked in <a href="${laterIssueUrl}">hard-questions-for-later</a>.</p>
  </header>
  <main>
    ${faqSections
      .map(
        (section) => `<section aria-labelledby="${escapeHtml(section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">
      <h2 id="${escapeHtml(section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${escapeHtml(section.title)}</h2>
      <div class="faq-list">
        ${section.rows.map(faqCard).join("\n        ")}
      </div>
    </section>`,
      )
      .join("\n\n    ")}
  </main>
  <footer>Generated from helm-expt proof data. FAQ answers should route to evidence, not slogans.</footer>
</body>
</html>
`;
}

function knownGapsHtml(catalog) {
  const gaps = [
    [
      "Fixed placeholder credentials",
      "watch",
      "Repeatable demo credentials are useful for deterministic renders, but a base must not look like it generated a production secret when it ships a fixed placeholder.",
      "../data/default-credential-check/summary.md",
    ],
    [
      "cub-direct no prune",
      "watch",
      "Plain apply does not remove objects that disappear from desired state. Argo and Flux can prune; cub-direct needs a prune/delete-set path before clean upgrades are claimed.",
      "../data/prune-gap-proof/summary.md",
    ],
    [
      "cub-direct CRD ordering",
      "watch",
      "A first install that contains both CRDs and custom resources needs CRDs established before custom resources are applied, or it needs a controller that handles ordering.",
      "../data/crd-ordering-gap/summary.md",
    ],
    [
      "cub-scout drift field coverage",
      "watch",
      "Drift detection is useful only when field coverage is stated. The current receipt catches replica/image-style drift but misses container env-var drift.",
      "../data/drift-detection-gap/summary.md",
    ],
    [
      "SSA conflict ergonomics",
      "watch",
      "Server-side apply can protect a manual live edit by reporting a conflict where Helm would silently overwrite, but the product still needs a plain keep-live / accept-desired / force-with-receipt choice.",
      "../data/ssa-conflict-gap/summary.md",
    ],
    [
      "Helm-to-cub migration friction",
      "watch",
      "cub rejects normal Helm idioms safely today, but many errors are still too opaque for a Helm-fluent user. The migration guide is the current bridge.",
      "../data/helm-habit-friction/summary.md",
    ],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Known Gaps · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>Known Gaps We Surface</h1>
    ${generatedStamp(catalog, "known gaps page")}
    <p class="tagline">These are not hidden blemishes. They are exactly the kind of rough edges this project is meant to expose before a user trusts a path.</p>
  </header>
  <main>
    <section aria-labelledby="rule">
      <h2 id="rule">The Rule</h2>
      <p>If a path is awkward, incomplete, target-specific, or unsafe by default, the site should mark it <code>watch</code>, <code>blocked</code>, <code>refused</code>, or <code>n/a</code> with a reason. That is more useful than a green-looking demo that hides the hard part.</p>
      <p>Positive framing is allowed. Overclaiming is not. The evidence link is part of the product.</p>
    </section>

    <section aria-labelledby="gaps">
      <h2 id="gaps">Current Watch Findings</h2>
      ${markdownLikeTable([
        ["Finding", "Status", "Why it matters", "Evidence"],
        ...gaps.map(([name, status, body, href]) => [name, status, body, `<a href="${href}">${href}</a>`]),
      ], { rawFourthColumn: true })}
    </section>

    <section aria-labelledby="next">
      <h2 id="next">What A User Should Do</h2>
      <p>Use the chart page first. If a row is watch or blocked, follow its reason and evidence link. Use <a href="./hard-questions.html">FAQ</a> for the short answer, <a href="../docs/user/broken-chart-triage.md">Broken Chart Triage</a> for debugging, and the generated evidence when you need exact receipts.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. Watch findings are part of the trust model.</footer>
</body>
</html>
`;
}

function whoRunsVariantTables(c) {
  return c.variants.map((v) => {
    const rows = v.routes.map((r) => [
      `${r.quirk_class} (${r.route_name})`,
      r.whoRuns,
      r.delta === "kept" ? "—" : `${r.delta}${r.reason ? ` — ${r.reason}` : ""}`,
    ]);
    const heading = `${v.base}${v.requiredCrdCount ? ` — needs ${v.requiredCrdCount} CRDs supplied first` : ""}`;
    return `<h4>${escapeHtml(heading)}</h4>${markdownLikeTable([["Hook (route)", "After you deploy, who runs it?", "Change for this variant"], ...rows])}`;
  }).join("\n");
}

function hooksWhoRunsSection(catalog) {
  const charts = catalog.lifecycleByVariant ?? [];
  if (!charts.length) return "";
  const withVariants = charts.filter((c) => c.hasBuiltVariants);
  const flat = charts.filter((c) => !c.hasBuiltVariants);
  const chartBlock = (c) => `<div class="card"><h3>${escapeHtml(c.chart)}</h3>${whoRunsVariantTables(c)}</div>`;
  return `
    <section aria-labelledby="whoruns">
      <h2 id="whoruns">After You Deploy, Who Runs Each Hook?</h2>
      <p>Per chart and per built variant, in plain words. Render parity delivers the objects; each hook becomes a <strong>visible, named, receipted</strong> lifecycle step instead of a hidden Helm hook — run by your delivery pipeline (a GitOps PreSync/PostSync, a cub action, or an opt-in check), not by hand. The product does not auto-execute these yet (<code>automatic: false</code>); that, with a receipt, is the roadmap (<a href="https://github.com/confighub/helm-expt/issues/688">#688</a>). <a href="../data/lifecycle-routes-by-variant/by-variant.html">Open the standalone colored view</a> · <a href="../data/gitops-route-emission/emission.html">the GitOps step (Argo/Flux) per route</a> · <a href="../data/lifecycle-routes-by-variant/summary.md">data</a>.</p>
      ${withVariants.map(chartBlock).join("\n")}
      <h3>Charts without a per-variant difference yet</h3>
      <p>These have hook routes but no built variant that changes the hook behavior (a single base, or candidate/blocked with no built variants).</p>
      ${simpleList(flat.map((c) => [c.chart, c.note]))}
    </section>`;
}

function hooksHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=./charts/index.html#actions">
  <title>ConfigHub Actions · ConfigHub Helm Catalog</title>
</head>
<body>
  <p>Hooks and lifecycle behavior are now covered on the Helm Catalog page as <a href="./charts/index.html#actions">ConfigHub Actions</a>.</p>
</body>
</html>
`;
}

function privateHtml(catalog) {
  const metric = (name) => catalog.statusMetrics.find((row) => row.metric === name) ?? {};
  const tierRows = [
    ["Anonymous public", "Browse catalog, inspect supported variants, open proof, pull/download public artifacts where available.", "Static pages and public artifacts only; no private inputs, no managed compute, rate-limited artifact access."],
    ["Low-friction free", "Run public catalog packages, verify local receipts, optionally create a small public sandbox render.", "Account/rate limits when server resources, signatures, or stored receipts are used."],
    ["Catalog subscription", "Refresh cadence, CVE turnaround, hardened variants, digest inventory, attestation pack, old-version support.", "Paid SLA over public catalog artifacts and variants."],
    ["Private catalog", "Private charts, wrapper charts, platform values, customer overlays, internal stacks, private OCI sources.", "Managed import pipeline; not an anonymous/public-catalog guarantee."],
    ["ConfigHub Server", "Teams, policies, approvals, changesets, variants, promotions, GitOps/OCI, observations, fleet queries, audit.", "SaaS or enterprise/on-prem product surface."],
  ];
  const workRows = [
    ["Curious user", "Use cub helm template or the public site to inspect what a chart produces."],
    ["Fast ConfigHub adoption", "Use cub helm install to load a rendered chart into ConfigHub Units quickly."],
    ["Supported public catalog", "Use cub installer setup --pull <package> --base <base> for curated bases with receipts."],
    ["Trust-building proof", "Run kind/live parity commands to compare regular Helm with cub installer and ConfigHub delivery."],
    ["Ops", "Use ConfigHub variants, diffs, scans, changesets, approvals, OCI/GitOps, observations, upgrades, and rollbacks."],
  ];
  const commercialRows = [
    ["ConfigHub Actions", "Inventory and route hook-like lifecycle work publicly; paid support can provide target-scoped lifecycle execution, Argo jobs, preflight, or operator review."],
    ["Stacks", "Multiple recipes plus a custom app become one managed platform: for example monitoring, AI/RAG stacks, AICR, NIM, or customer platforms."],
    ["Bulk operations", "Bulk scan, patch, approve, promote, and observe across a fleet."],
    ["Legacy patches", "Maintain or patch older chart versions when upstream moved or broke compatibility."],
    ["Security and audit", "Signed artifacts, scan diffs, digest inventory, refresh SLAs, evidence packs, policy gates, and audit history."],
  ];
  const publicCounters = [
    ["Public catalog pages", `${catalog.summary.publicCatalogCharts}/100`],
    ["Top100 ready-to-try", metricValue(metric("catalog-supported charts"))],
    ["Render parity rows", metricValue(metric("render parity rows"))],
    ["Live parity rows", metricValue(metric("live Helm-vs-ConfigHub parity pass rows"))],
    ["Supported decisions", `${catalog.summary.productionSupportedCharts}/${catalog.productionSupportDecisions.length}`],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Private · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    ${topNav("..")}
    <h1>Private catalogs and managed operations.</h1>
    ${generatedStamp(catalog, "private page")}
    <p class="tagline">The free path must be genuinely useful: browse public charts, inspect variants, pull public artifacts where available, and verify proof locally. Paid starts when the service stores private inputs, creates private variants, runs managed workflows, or carries production responsibility.</p>
  </header>
  <main>
    <section aria-labelledby="public-value">
      <h2 id="public-value">Why Use The Free Public Catalog?</h2>
      <p>Public Helm charts are flexible, but the rendered result is often opaque. The free catalog gives a Helm user the supported base choices, exact objects, proof boundary, and known gaps before they install or promote anything.</p>
      <div class="grid">
        ${publicCounters.map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("\n        ")}
      </div>
      <p>Anonymous or low-friction use is better than browsing Helm charts alone because the catalog answers: which base should I start with, what objects does it create, what pain points are absorbed, what must my target provide, and what proof exists today?</p>
    </section>

    <section aria-labelledby="tiers">
      <h2 id="tiers">Tier Shape</h2>
      ${markdownLikeTable([
        ["Tier", "User value", "Boundary"],
        ...tierRows,
      ])}
    </section>

    <section aria-labelledby="journey">
      <h2 id="journey">ConfigHub Path</h2>
      <p>This page is the private and managed boundary reference. The step-by-step path a user actually walks - inspect, serverless try-out with no account, first sign-up, ConfigHub Server try-out, day-2 operations, and where paid begins - is on the <a href="../journey.html">Apps page</a>, with the exact command at each stage.</p>
      ${markdownLikeTable([
        ["Stage", "What happens"],
        ...workRows,
      ])}
      <p>That journey keeps the fast Helm paths as useful ancestors. <code>cub helm template</code> and <code>cub helm install</code> are quick actions. <code>cub installer</code> packages are durable product artifacts. ConfigHub applications are where teams, approvals, variants, and promotion become useful; operations are where day-1/day-2 work becomes durable.</p>
    </section>

    <section aria-labelledby="commercial">
      <h2 id="commercial">Commercial Workloads</h2>
      <p>The managed tier should focus on hard operational value, not merely rendering. The useful paid work is private data, production scope, fleet operations, lifecycle actions, old-version support, and audit evidence.</p>
      ${markdownLikeTable([
        ["Lane", "Managed value"],
        ...commercialRows,
      ])}
    </section>

    <section aria-labelledby="limits">
      <h2 id="limits">What Not To Sell Too Early</h2>
      <p>Do not sell universal Helm compatibility, universal hook execution, universal field provenance, or signature-as-safety. Sell the staged model: clear bases, explicit prerequisites, visible proof, target-scoped support, and managed operations where the public catalog stops.</p>
      <div class="grid">
        <div class="card"><h3>Support tiers</h3><p><a href="../../docs/user/product-support-tiers.md">Open product support tiers</a>.</p></div>
        <div class="card"><h3>Commercial model</h3><p><a href="../../docs/planning/verified-install-commercial-model.md">Open verified-install commercial model</a>.</p></div>
        <div class="card"><h3>Serverless plan</h3><p><a href="../../docs/planning/serverless-verified-install-plan.md">Open serverless verified-install plan</a>.</p></div>
        <div class="card"><h3>Claims register</h3><p><a href="../../data/claims-register/summary.md">Open current claim boundaries</a>.</p></div>
      </div>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. Commercial claims require product, support, key, policy, and SLA decisions beyond the public proof corpus.</footer>
</body>
</html>
`;
}

function tiersRedirectHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=./private/">
  <title>Private · ConfigHub Helm Catalog</title>
</head>
<body>
  <p>The tiers page moved to <a href="./private/">Private</a>.</p>
</body>
</html>
`;
}

function journeyHtml(catalog) {
  const appKinds = [
    ["Single chart app", "A public Helm chart from the catalog becomes a ConfigHub-managed app component."],
    ["Multi-chart stack", "Several chart bases are grouped as one deployable stack, for example app plus database."],
    ["Platform slice", "A platform team can group shared services such as ingress, policy, and more."],
    ["Custom app", "Your own Kubernetes objects or wrapper chart join the same app."],
    ["Existing app", "An app you already run can be represented as Units, then compared, promoted, and operated with receipts."],
  ];
  const appFlow = [
    ["Choose inputs", "Start from one or more proved chart/base entries, a managed variant, a platform stack, or a custom app source."],
    ["Load as Units", "Upload the rendered desired state into ConfigHub so the objects can be labeled, queried, diffed, and shared."],
    ["Group the app", "Use labels, components, and targets to describe what belongs together."],
    ["Promote or deliver", "Move the app through environments and publish the selected object set to GitOps/OCI when ready."],
    ["Hand off to Ops", "Once live, use the Ops guide for scans, patches, observation, upgrades, rollback, and fleet questions."],
  ];
  const entryRows = [
    ["Public Helm chart", "Choose a chart page, pick a base, then render or upload it.", "First public use."],
    ["Existing app or live cluster", "Start read-only: discover, inventory, and compare before adopting.", "Teams that already have Argo, Flux, or live resources."],
    ["Custom app from scratch", "Author or import Kubernetes objects, then create Units.", "Private apps beside public chart components."],
    ["Multi-chart platform or stack", "Group chart bases plus custom app Units with shared targets.", "Platform slices such as ingress, certs, and app services."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Apps Guide · ConfigHub Helm Catalog</title>
  <style>${siteCss()}
    .app-flow { counter-reset: appstep; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 16px 0; }
    .app-step { counter-increment: appstep; border: 1px solid var(--line); border-radius: 10px; padding: 14px; background: var(--surface); }
    .app-step::before { content: counter(appstep); display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; background: var(--good); color: #fff; font-weight: 700; font-size: .82rem; margin-bottom: 8px; }
    .app-step h3 { margin: 0 0 8px; }
    .app-step p { margin: 0; font-size: .9rem; }
    @media (max-width: 980px) { .app-flow { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 640px) { .app-flow { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>Apps Guide</h1>
    <p>An App groups several charts, and your own services, so a team can manage, review, and ship them together.</p>
    <p>A Unit is a tracked piece of config. A target is where the app will run. Use this guide when you want charts, custom objects, and targets to become one application path.</p>
  </header>
  <main>
    <section aria-labelledby="app-kinds">
      <h2 id="app-kinds">What Counts As An App?</h2>
      ${markdownLikeTable([
        ["Kind", "Meaning"],
        ...appKinds,
      ])}
    </section>

    <section aria-labelledby="entry">
      <h2 id="entry">Four Ways In</h2>
      <p>Apps covers day-0 and day-1 composition: choose the shape, load desired state, and prepare variants. Ops starts after that shape exists.</p>
      ${markdownLikeTable([
        ["Entry", "First move", "Use it for"],
        ...entryRows,
      ])}
    </section>

    <section aria-labelledby="app-flow">
      <h2 id="app-flow">The App Flow</h2>
      <div class="app-flow">
        ${appFlow.map(([title, body]) => `<div class="app-step"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="existing">
      <h2 id="existing">Can I Start From An Existing App?</h2>
      <p>Yes. Existing apps and live-cluster resources should enter through discovery or import first. The first result should be read-only: ConfigHub shows what it found, where it came from, and what the next safe decision is.</p>
      ${markdownLikeTable([
        ["Starting point", "First route", "You should see"],
        ["Argo CD app", "discover or import the Argo app", "source, target, rendered objects, and links are visible before changing delivery"],
        ["Flux HelmRelease or Kustomization", "discover or import Flux state", "controller source and target ownership are preserved"],
        ["Rendered YAML or KRM", "import as ConfigHub Units", "objects can be labeled, scanned, linked, and diffed"],
        ["Live cluster", "discover or import current resources", "inventory first, then explicit import or graduation decision"],
        ["Platform or stack", "represent several chart bases and custom app objects as one app", "components and targets show what belongs together"],
      ])}
      <div class="card">
        <h3>Start read-only</h3>
        <p>These commands should show discovery or import previews before ConfigHub changes delivery.</p>
        <pre><code>cub gitops discover --space my-space my-k8s-target
cub gitops import --space my-space my-k8s-target my-render-target \\
  --where-resource "metadata.namespace = 'argocd'"
kubectl get all -n payments -o yaml &gt; .tmp/payments.yaml
cub unit import payments-app .tmp/payments.yaml --dry-run</code></pre>
        <p>You should see the resources ConfigHub found or would import, plus the target and namespace context. At this stage the safe result is visibility, not a changed live deployment.</p>
      </div>
      <p>Only graduate an existing app to a <code>cub installer</code> recipe when it needs a maintained render path, future chart refreshes, and catalog-grade proof. See <a href="../docs/user/adopting-existing-apps.md">Adopting Existing Apps</a>.</p>
    </section>

    <section aria-labelledby="examples">
      <h2 id="examples">Example App Paths</h2>
      ${markdownLikeTable([
        ["Path", "What you are proving"],
        ["Redis app", "A single public chart can be rendered, uploaded as Units, varied by environment, and promoted."],
        ["Prometheus or kube-prometheus-stack", "A more serious chart can expose CRDs, webhooks, and target setup before app delivery."],
        ["Platform slice", "Ingress, policy, and app services can be grouped as a managed platform shape."],
        ["Custom app or stack", "Public chart components and private app objects can be represented together rather than treated as unrelated YAML."],
        ["Custom app", "A small custom app can sit beside chart-provided infrastructure, with the same variant and delivery path."],
        ["Existing app", "A live application can be brought under the same object, diff, promotion, and observation model."],
      ])}
      <p>These are app-level stories. The chart-level evidence still lives on the Helm Catalog pages and matrix.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. This guide explains application composition; operational proof and commercial boundaries live on their own guides.</footer>
</body>
</html>
`;
}

function variantsHtml(catalog) {
  const modelRows = [
    ["Component", "The app, service, platform package, or deployable capability being configured, such as redis or payments-api."],
    ["Variant", "One named configuration instance of a Component, such as base, dev, or prod-us."],
    ["Operational behavior", "`cub variant create` copies a base into a downstream variant. That link lets a later promotion know where the change came from."],
    ["Caveat", "Component groups related variants. Variant has stronger behavior because create and promote know how the copies are related."],
  ];
  const journeyRows = [
    ["Start from a base", "Pick a reviewed install shape from a chart page, such as Redis default or Prometheus server-only-ephemeral."],
    ["Upload to ConfigHub", "Once rendered, each object becomes a Unit, which means a tracked piece of config you can diff, label, and gate before it ships."],
    ["Create a derived variant", "Clone the uploaded base for each environment, region, or customer with `cub variant create`."],
    ["Preview and check", "Use Unit diffs and receipts to confirm the change stayed bounded."],
    ["Promote later changes", "Use `cub variant promote --dry-run -o mutations`, then promote through ConfigHub changesets and approvals."],
  ];
  const routeRows = [
    ["Choose a base variant", "Use when the choice changes what Helm renders.", "CRDs on/off, HA mode, or generated Secret vs existing Secret."],
    ["Create a derived variant", "Use after render when the change is about where or how the config is managed.", "prod-us-east from redis/default, region labels, or target binding."],
    ["Go back to the recipe", "Use when the change needs Helm to run again.", "A different values file, wrapper chart, or chart version."],
  ];
  const exampleRows = [
    ["Redis", "default and reuse-existing-secret are base variants because the Secret model changes rendered objects.", "./charts/bitnami-redis-25-5-3.html"],
    ["Prometheus", "server-only and production target variants show the base-to-derived split for a larger app.", "../docs/user/prometheus-overlay-promotion-example.md"],
    ["kube-prometheus-stack", "The serious chart shows why variants must carry target facts, lifecycle routes, and upgrade checks.", "./charts/prometheus-community-kube-prometheus-stack-85-3-3.html"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Variants · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>Variants</h1>
    <p>Helm starts by making files from a chart. We call this render. A base variant is a checked copy of those files. A derived variant is a later change in ConfigHub.</p>
  </header>
  <main>
    <section aria-labelledby="model">
      <h2 id="model">Component And Variant Model</h2>
      <p>ConfigHub groups related config by Component and Variant. A Component is what you ship. A Variant is one named version of it.</p>
      <pre><code>Component: payments-api

Variants:
  payments-api/base
  payments-api/dev
  payments-api/staging
  payments-api/prod-us
  payments-api/prod-eu</code></pre>
      ${markdownLikeTable([
        ["Term", "Meaning"],
        ...modelRows,
      ], { rawSecondColumn: true })}
      <p>This lets a team ask clear questions: what changed, where did it come from, and did it stay inside the approved boundary?</p>
    </section>

    <section aria-labelledby="choose">
      <h2 id="choose">Which Kind Of Variant?</h2>
      <p>You start from a base, then create variants for each environment or customer. The key question is whether Helm has to run again.</p>
      ${markdownLikeTable([
        ["Action", "Use it when", "Examples"],
        ...routeRows,
      ])}
    </section>

    <section aria-labelledby="journey">
      <h2 id="journey">Variant Journey</h2>
      ${markdownLikeTable([
        ["Step", "What happens"],
        ...journeyRows,
      ])}
      <p>The shipped commands are <code>cub installer</code>, <code>cub variant create</code>, Unit diffs, and <code>cub variant promote</code>.</p>
    </section>

    <section aria-labelledby="flow">
      <h2 id="flow">The Basic Flow</h2>
      <pre><code>cub installer setup --pull packages/bitnami/redis/25.5.3 --base default --work-dir .tmp/redis
cub installer upload --work-dir .tmp/redis --space helm-redis-default
cub variant create prod-us-east helm-redis-default --environment Prod --region us-east --target prod/prod-us-east
cub variant promote prod-us-east --dry-run -o mutations</code></pre>
      <p>You should see a source base, a derived variant, changed paths, and receipts. Product screens can simplify the language, while the data stays available for reviewers and agents.</p>
      <div class="card">
        <h3>You should see something like this</h3>
        <pre><code>created downstream variant
cloned Units linked to upstream Units
changed labels/target/gates only, unless an allowed mutation receipt says otherwise
promotion dry-run lists mutations before apply</code></pre>
      </div>
    </section>

    <section aria-labelledby="examples">
      <h2 id="examples">Examples</h2>
      ${markdownLikeTable([
        ["Example", "What it shows", "Open"],
        ...exampleRows.map(([name, body, path]) => [name, body, `<a href="${path}">${escapeHtml(name)}</a>`]),
      ], { rawThirdColumn: true })}
    </section>

    <section aria-labelledby="more">
      <h2 id="more">More Detail</h2>
      <p><a href="../docs/user/creating-variants.md">Creating variants</a> explains the doctrine. <a href="../docs/user/cub-variant-command-surface.md">cub variant command surface</a> tracks the command vocabulary. <a href="../data/variant-promotion/summary.md">Variant promotion receipts</a> show the current evidence.</p>
    </section>
  </main>
  <footer>Generated from helm-expt catalog data. Base variants are render-time choices; derived variants are post-render ConfigHub refinements.</footer>
</body>
</html>
`;
}

function customAppsHtml(catalog) {
  const pieceRows = [
    ["Public chart", "Start from a catalog base when a reviewed chart/version/base exists.", "Keeps the upstream Helm source visible."],
    ["Custom app", "Represent your own service as ConfigHub Units alongside chart Units.", "Lets the stack be scanned, diffed, promoted, and delivered together."],
    ["Wrapper chart or overlay values", "Use the recipe/import path when the overlay changes Helm render inputs.", "This creates or updates a base, not just a derived variant."],
    ["Environment or customer refinement", "Use derived variants when the change is post-render.", "Targets, labels, approvals, links, observation policy, and selected field transforms."],
    ["Private catalog", "Use ConfigHub-managed private paths when private sources, teams, SLAs, or production responsibility enter.", "This is the paid and managed boundary."],
  ];
  const proofRows = [
    ["ExternalDNS overlay", "Managed overlay golden for wrapper chart plus customer values.", "../data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md"],
    ["App readiness", "Read-only app queries over rendered catalog data.", "../data/app-readiness/summary.md"],
    ["Custom overlays guide", "Plain user guide for base plus overlay cases.", "../docs/user/custom-overlays.md"],
    ["Private paths", "Commercial and operational boundary for private catalogs.", "./private/"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Custom Apps &amp; Stacks · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>Custom Apps &amp; Stacks</h1>
    ${generatedStamp(catalog, "custom apps page")}
    <p class="tagline">A real app is often several public charts plus your own service, platform values, customer overlays, and target prerequisites. The model treats that as one desired-state graph without hiding which pieces are public, private, rendered, or post-render.</p>
  </header>
  <main>
    <section aria-labelledby="map">
      <h2 id="map">Where The Pieces Go</h2>
      ${markdownLikeTable([
        ["Piece", "Where it belongs", "Why"],
        ...pieceRows,
      ])}
    </section>

    <section aria-labelledby="day">
      <h2 id="day">Day 0 Or Day 1?</h2>
      <p>For a new app, multiple charts plus a custom service is Day 0 composition: define the first desired shape, render the bases, upload Units, and create the first target variant. For an app that already exists, the same work is Day 1 change management: import or discover the current shape, compare it with the desired shape, then make controlled refinements.</p>
    </section>

    <section aria-labelledby="proof">
      <h2 id="proof">Current Evidence</h2>
      ${markdownLikeTable([
        ["Surface", "What it shows", "Open"],
        ...proofRows.map(([name, body, path]) => [name, body, `<a href="${path}">${path}</a>`]),
      ], { rawThirdColumn: true })}
    </section>
  </main>
  <footer>Generated from helm-expt catalog data. Public charts, custom apps, and private overlays can share one graph, but private sources and production responsibility belong on the managed path.</footer>
</body>
</html>
`;
}

function operationsHtml(catalog) {
  const ops = [
    {
      title: "Diff before you ship",
      status: "available",
      boundary: "ConfigHub · free tier",
      action: "review the variant's object diff vs its base",
      code: null,
      get: "A variant is one named configuration of an app. Its object diff shows exactly which Kubernetes objects changed before anything is delivered. This is the opposite of a values file you have to mentally render.",
      see: ["change-routing-before-oci.md"],
    },
    {
      title: "Scan and gate",
      status: "available",
      boundary: "free locally · paid for managed policy",
      action: "function scans + safe-ops over rendered objects",
      code: null,
      get: "Run scans over the rendered objects for privilege, exposure, and deprecated APIs. A gate is a release stop: delivery waits until findings are accepted or waived with a named reason.",
      see: ["../data/external-scan-lane/summary.md"],
    },
    {
      title: "Release a prepared variant",
      status: "watch",
      boundary: "Apps SDLC · ConfigHub Server",
      action: "cub variant promote <space>",
      code: "cub variant promote <space> --dry-run -o mutations\ncub variant promote <space>",
      get: "Apps and Variants choose the base, derived variant, and target. We've proven this on Redis, NGINX, and kube-prometheus-stack: previewing the change, updating objects that changed, and adding new ones.",
      see: ["../data/variant-promotion/summary.md", "prometheus-overlay-promotion-example.md"],
    },
    {
      title: "Deliver via OCI + GitOps",
      status: "available",
      boundary: "free to run · standard Argo/Flux",
      action: "publish content-addressed OCI; a controller reconciles",
      code: null,
      get: "Publish the variant as an OCI artifact, which is a digest-pinned delivery bundle. Argo or Flux can pull that bundle and reconcile it. A green local apply is not the same as the controller reconciling; both are recorded separately.",
      see: ["chain-of-proof.md", "../data/runtime-gitops/summary.md"],
    },
    {
      title: "Observe the live result",
      status: "available",
      boundary: "cub-scout · bring your own cluster",
      action: "record live evidence after delivery",
      code: "cub-scout receipt verify \\\n  --file <rendered-objects.yaml> \\\n  --scope namespace/<namespace> \\\n  --predicate object-set-matches \\\n  --ttl 1h \\\n  --out .tmp/object-set.receipt.json\n\ncub-scout receipt validate .tmp/object-set.receipt.json",
      get: "After delivery, use observation to check what actually happened. The receipt should say what was checked, when it was checked, which namespace or target was observed, and whether the desired objects matched what the cluster reported.",
      see: ["verify-it-yourself.md", "why-synced-is-not-working.md"],
    },
    {
      title: "Rehearse rollback before you need it",
      status: "watch",
      boundary: "ConfigHub revisions · cub-scout rehearsal",
      action: "compare live state with a previous approved desired state",
      code: "cub unit diff <unit> --from=PreviousLiveRevisionNum --to=LiveRevisionNum\ncub-scout compare three-way --dry-from <previous-render.yaml>",
      get: "You should see the difference between the current live app and the previous approved state. Today this is a rehearse-and-review path; exact rollback automation depends on the app, target, and any irreversible lifecycle steps.",
      see: ["day2-upgrade-rollback.md", "cub-scout-diff-design.md"],
    },
  ];
  const seeLink = (ref) =>
    ref.startsWith("../")
      ? `<a href="${ref}">${escapeHtml(ref.replace(/^\.\.\//, "").replace(/\/summary\.md$/, ""))}</a>`
      : `<a href="../docs/user/${ref}">${escapeHtml(ref.replace(/\.md$/, ""))}</a>`;
  const cards = ops
    .map(
      (o) => `      <div class="op">
        <div class="ophead">
          <h3>${escapeHtml(o.title)}</h3>
          <span class="badge ${o.status === "watch" ? "watch" : o.status.startsWith("available") ? "now" : "planned"}">${escapeHtml(o.status)}</span>
        </div>
        <p class="opmeta"><code>${escapeHtml(o.action)}</code> · <span class="muted">${escapeHtml(o.boundary)}</span></p>
        ${o.code ? `<pre><code>${escapeHtml(o.code)}</code></pre>` : ""}
        <p>${o.get}</p>
        <p class="muted">See: ${o.see.map(seeLink).join(" · ")}</p>
      </div>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ops Guide · ConfigHub Helm Catalog</title>
  <style>${siteCss()}
    .op { border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin: 14px 0; }
    .ophead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .ophead h3 { margin: 0; font-size: 1.08rem; }
    .opmeta { margin: 6px 0 8px; }
    .badge { display: inline-block; border-radius: 999px; font-size: .72rem; padding: 2px 9px; border: 1px solid var(--line); white-space: nowrap; }
    .badge.now { color: #fff; background: var(--good); border-color: var(--good); }
    .badge.watch { color: #2d2300; background: #f9ab00; border-color: #f9ab00; }
    .badge.planned { color: var(--muted); background: var(--panel); }
    .muted { color: var(--muted); }
    @media (max-width: 600px) { .ophead { flex-direction: column; } }
  </style>
</head>
<body>
  <header class="hero">
    ${topNav(".")}
    <h1>Ops Guide</h1>
    <p>Use this guide for everything after an app exists: releasing, scanning, delivering, and watching it run.</p>
    <p>Use the <a href="./journey.html">Apps guide</a> to create the app shape. Use the <a href="./variants.html">Variants guide</a> to decide how a chart changes. This page is about operating those apps once they exist.</p>
  </header>
  <main>
    <section aria-labelledby="before-ops">
      <h2 id="before-ops">Before Ops</h2>
      <p>The app should already have a selected chart/base, any customised variants, and a target or delivery path. If those choices are still open, start with <a href="./charts/index.html">Helm Catalog</a>, <a href="./variants.html">Variants</a>, or <a href="./journey.html">Apps</a>.</p>
    </section>

    <section aria-labelledby="ops">
      <h2 id="ops">The operations</h2>
      <div class="card">
        <h3>Status legend</h3>
        <p><span class="badge now">available</span> runs today. <span class="badge watch">watch</span> has evidence plus a named limitation. Planned work needs product, key, policy, or SLA decisions beyond the public proof corpus.</p>
      </div>
${cards}
    </section>
    <section aria-labelledby="next">
      <h2 id="next">When Ops Becomes Managed Scope</h2>
      <p>When the work carries private inputs, production responsibility, multiple teams, policy, SLA, or fleet scale, the <a href="./private/">Upgrade guide</a> describes the managed boundary.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. Check each operation's status before relying on it.</footer>
</body>
</html>
`;
}

function legacyOperationsRedirectHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=./operations.html">
  <title>Ops · ConfigHub Helm Catalog</title>
</head>
<body>
  <p>The day-1 ops page moved to <a href="./operations.html">Ops</a>.</p>
</body>
</html>
`;
}

function chartIndexHtml(catalog) {
  const chartRowsHtml = catalog.catalogEntries
    .map((entry) => {
      const level = catalogLayerLabel(entry);
      const variants = entry.supported_variants || entry.candidate_variants || "see chart page";
      const status = entry.start_base_readiness || "see chart page";
      const production = productionSummaryForChart(catalog, entry)?.production_support ?? entry.production_readiness;
      const featureText = [
        entry.chart,
        entry.version,
        level,
        entry.start_variant,
        variants,
        status,
        production,
        entry.source_features,
        entry.not_yet_enabled,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const hasHooks = /hook/i.test(entry.source_features || "") || /hook/i.test(entry.not_yet_enabled || "");
      const hasCrds = /crd/i.test(entry.source_features || "") || /crd/i.test(variants);
      return `<tr data-chart-row data-level="${escapeHtml(level)}" data-status="${escapeHtml(status)}" data-hooks="${hasHooks ? "yes" : "no"}" data-crds="${hasCrds ? "yes" : "no"}" data-search="${escapeHtml(featureText)}">
        <td><a href="./${chartPageFileName(entry)}">${escapeHtml(entry.chart)}</a></td>
        <td>${escapeHtml(entry.version)}</td>
        <td>${escapeHtml(level)}</td>
        <td>${escapeHtml(entry.start_variant)}</td>
        <td>${escapeHtml(variants)}</td>
        <td>${escapeHtml(status)}</td>
        <td>${escapeHtml(production)}</td>
      </tr>`;
    })
    .join("\n");
  const lifecycleRoutes = catalog.lifecycleRoutes;
  const lifecycleChartCount = new Set(lifecycleRoutes.map((row) => `${row.chart}@${row.version}`)).size;
  const autoCount = lifecycleRoutes.filter((row) => isTruthyRouteFlag(row.safe_as_automatic)).length;
  const dispositionRows = Object.entries(countBy(lifecycleRoutes, "disposition")).map(([label, count]) => [
    label,
    String(count),
    dispositionMeaning(label),
  ]);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Helm Catalog · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header>
    ${topNav("..")}
    <h1>Helm Catalog</h1>
    <p>This is a directory of ${escapeHtml(String(catalog.top100UserReadiness.length))} Helm charts and how each behaves in ConfigHub.</p>
    <p>We snapshot public Helm repos and build a page for each chart. The top-20 have the strongest catalog evidence. The next-80 are proof-grade until promoted. The full database of charts and variants is in the <a href="../matrix.html">status matrix</a>. Contact us with suggestions and questions.</p>
  </header>
  <main>
    <section aria-labelledby="charts">
      <h2 id="charts">Chart Directory</h2>
      <div class="card">
        <label for="chart-filter"><strong>Search charts</strong></label>
        <input id="chart-filter" type="search" placeholder="redis, crd, hook, prometheus, proof-grade..." style="width:100%; margin:8px 0 12px; padding:10px; border:1px solid var(--line); border-radius:8px;">
        <div class="grid">
          <label>Catalog level<br><select id="level-filter"><option value="">any</option><option value="catalog-supported">catalog-supported</option><option value="proof-grade / machine-proof-only">proof-grade / machine-proof-only</option></select></label>
          <label>Start status<br><select id="status-filter"><option value="">any</option><option value="start-here">start-here</option><option value="render-only">render-only</option><option value="see chart page">see chart page</option></select></label>
          <label>Hooks<br><select id="hook-filter"><option value="">any</option><option value="yes">has hook/action signal</option><option value="no">no hook/action signal</option></select></label>
          <label>CRDs<br><select id="crd-filter"><option value="">any</option><option value="yes">has CRD signal</option><option value="no">no CRD signal</option></select></label>
        </div>
        <p class="mono" id="chart-filter-count" style="font-size:.86rem"></p>
      </div>
      <div class="card"><table id="chart-table">
        <thead><tr><th>Chart</th><th>Version</th><th>Catalog level</th><th>Start base</th><th>Supported or candidate bases</th><th>Start status</th><th>Production disposition</th></tr></thead>
        <tbody>
${chartRowsHtml}
        </tbody>
      </table></div>
      <script>
        (() => {
          const rows = Array.from(document.querySelectorAll("[data-chart-row]"));
          const text = document.getElementById("chart-filter");
          const level = document.getElementById("level-filter");
          const status = document.getElementById("status-filter");
          const hooks = document.getElementById("hook-filter");
          const crds = document.getElementById("crd-filter");
          const count = document.getElementById("chart-filter-count");
          const update = () => {
            const query = text.value.trim().toLowerCase();
            let visible = 0;
            for (const row of rows) {
              const ok =
                (!query || row.dataset.search.includes(query)) &&
                (!level.value || row.dataset.level === level.value) &&
                (!status.value || row.dataset.status === status.value) &&
                (!hooks.value || row.dataset.hooks === hooks.value) &&
                (!crds.value || row.dataset.crds === crds.value);
              row.style.display = ok ? "" : "none";
              if (ok) visible += 1;
            }
            count.textContent = visible + " of " + rows.length + " chart versions shown";
          };
          [text, level, status, hooks, crds].forEach((node) => node.addEventListener("input", update));
          update();
        })();
      </script>
    </section>

    <section aria-labelledby="actions">
      <h2 id="actions">Hooks and other actions in ConfigHub deployments</h2>
      <p>Some Helm charts use hooks or other lifecycle steps. We show those steps instead of hiding them.</p>
      <p>A chart page tells you whether an action is observed, routed, per-target, blocked, refused, or still needs a recipe. A route is useful guidance; it is not an automatic execution claim unless the route says so and evidence proves it.</p>
      ${markdownLikeTable([
        ["Disposition", "Rows", "Meaning"],
        ...dispositionRows,
      ])}
      <p>For a specific chart, open its chart page and read the action details beside the variant options. Deeper reference: <a href="../docs/user/chart-hooks-what-happens.md">what happens to chart hooks</a> and <a href="../docs/reference/what-hook-support-means.md">hook support vocabulary</a>.</p>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(lifecycleRoutes.length)}</strong><span>lifecycle route rows</span></div>
        <div class="metric"><strong>${escapeHtml(lifecycleChartCount)}</strong><span>chart/version lifecycle behaviors represented</span></div>
        <div class="metric"><strong>${escapeHtml(autoCount)}</strong><span>rows safe to present as automatic</span></div>
        <div class="metric"><strong><a href="../data/lifecycle-routes/summary.md">open</a></strong><span>machine-readable route contract</span></div>
      </div>
    </section>
  </main>
  <footer>Generated from helm-expt catalog data. Do not edit by hand.</footer>
</body>
</html>
`;
}

function catalogLayerLabel(entry) {
  if (entry.proof_surface === "top20-catalog-supported") return "catalog-supported";
  if (entry.proof_surface === "next80-proof-grade") return "proof-grade / machine-proof-only";
  return entry.catalog_status || entry.proof_surface || "unknown";
}

function executionModePlain(mode) {
  return {
    "product-executes": "Runs automatically",
    "user-executes": "You run it",
    "target-owned": "Your cluster runs it",
    "not-yet-executable": "Not automated yet",
  }[mode] ?? mode;
}

function evidenceDepthSummary(lanes) {
  const fullyPass = (status) => /^pass: \d+\/\d+$/.test(status);
  const proven = lanes.filter(([, status]) => fullyPass(status)).map(([name]) => name);
  const partial = lanes.filter(([, status]) => status.includes("pass:") && !fullyPass(status)).map(([name]) => name);
  const notYet = lanes.filter(([, status]) => !status.includes("pass:") && !/^n\/a: \d+\/\d+$/.test(status)).map(([name]) => name);
  const parts = [];
  if (proven.length) parts.push(`Fully proven: ${proven.join(", ")}.`);
  if (partial.length) parts.push(`Proven on some bases: ${partial.join(", ")}.`);
  if (notYet.length) parts.push(`Not yet tested: ${notYet.join(", ")} - a fresh cluster run would prove these.`);
  return parts.join(" ") || "No lane evidence recorded yet.";
}

function chartPageHtml(catalog, entry) {
  const chartKey = `${entry.chart}@${entry.version}`;
  const baseRows = catalog.baseReadiness.filter((row) => row.chart === chartKey);
  const matrixRows = catalog.masterCatalogMatrix
    .filter((row) => row.chart === entry.chart && row.version === entry.version)
    .sort(compareMatrixRows);
  const firstRunnableRow =
    matrixRows.find((row) => row.row_kind === "base" && row.variant === entry.start_variant) ??
    matrixRows.find((row) => row.row_kind === "base") ??
    matrixRows.find((row) => row.row_kind !== "source");
  const firstRunnableCommand = firstRunnableRow ? matrixRowRunPath(firstRunnableRow, entry) : "No runnable row recorded yet.";
  const firstRunnableReason =
    firstRunnableRow?.active_proof_reason ||
    firstRunnableRow?.variant_promotion_reason ||
    firstRunnableRow?.hard_gap ||
    entry.not_yet_enabled ||
    "No blocking reason recorded.";
  const teaching = chartTeachingHtml(entry);
  const production = productionSummaryForChart(catalog, entry);
  const support = catalog.productionSupportDecisions.find((row) => row.chart === entry.chart && row.version === entry.version);
  const chartUse = catalog.chartUseGuide.find((row) => row.chart === chartKey);
  const top100 = catalog.top100Readiness.find((row) => row.chart === chartKey);
  const userReadiness = catalog.top100UserReadiness.find((row) => row.chart === entry.chart && row.version === entry.version);
  const chartSkill = catalog.chartSkills.find((row) => row.chart === entry.chart && row.version === entry.version);
  const evidenceRoute = catalog.chartEvidenceRouter.find((row) => row.chart === entry.chart && row.version === entry.version);
  const extension = catalog.extensionSlots.find((row) => row.chart === chartKey);
  const adoptionCaveat =
    catalog.cubAdoptionCaveats.find((row) => row.chart === entry.chart && row.version === entry.version) ??
    catalog.cubAdoptionCaveats.find((row) => row.chart === entry.chart);
  const proofRows = baseRows.map((row) => [
    row.base,
    row.user_readiness,
    row.render_parity,
    row.in_confighub,
    row.local_live,
    row.gitops_oci_live,
    row.live_helm_vs_confighub_parity,
    row.two_cluster_kind_parity,
  ]);
  const proofMatrixRows = matrixRows
    .filter((row) => row.row_kind !== "source")
    .map((row) => [
      row.variant,
      row.row_status || row.customization_layer || "matrix row",
      row.lane_render_parity,
      row.lane_confighub_scan_ops,
      row.lane_local_kind,
      row.lane_gitops_oci_live,
      row.lane_live_dual_parity,
      row.lane_two_cluster_kind,
    ]);
  const proofEvidenceRows = proofRows.length ? proofRows : proofMatrixRows;
  const artifactRows = [
    ["Chart catalog", entry.catalog_path],
    ["Recipe", entry.recipe_path],
    ["Package", entry.package_path],
    ["Helm pain report", entry.helm_pain_report],
    ["Production disposition", "data/production-disposition/summary.md"],
    ["Support decision", support?.path ?? ""],
    [baseRows.length ? "Base readiness" : "Master matrix rows", baseRows.length ? "data/top20-base-readiness/summary.md" : "data/master-catalog-matrix/summary.md"],
    ["Chart skills", "data/chart-skills/summary.md"],
    ["Chart evidence router", "data/chart-evidence-router/summary.md"],
    ["Current proof status", "docs/user/current-proof-status.md"],
  ].filter(([, path]) => path);
  const openDispositions = splitDisposition(production?.open_dispositions);
  const acceptedDispositions = splitDisposition(production?.accepted_dispositions);
  const lanes = [
    ["Render parity", baseRows.length ? allBaseStatus(baseRows, "render_parity") : allBaseStatus(matrixRows.filter((row) => row.row_kind !== "source"), "lane_render_parity")],
    ["ConfigHub proof", baseRows.length ? allBaseStatus(baseRows, "in_confighub") : allBaseStatus(matrixRows.filter((row) => row.row_kind !== "source"), "lane_confighub_scan_ops")],
    ["Local live", baseRows.length ? allBaseStatus(baseRows, "local_live") : allBaseStatus(matrixRows.filter((row) => row.row_kind !== "source"), "lane_local_kind")],
    ["GitOps/OCI live", baseRows.length ? allBaseStatus(baseRows, "gitops_oci_live") : allBaseStatus(matrixRows.filter((row) => row.row_kind !== "source"), "lane_gitops_oci_live")],
    ["Live Helm-vs-ConfigHub", baseRows.length ? allBaseStatus(baseRows, "live_helm_vs_confighub_parity") : allBaseStatus(matrixRows.filter((row) => row.row_kind !== "source"), "lane_live_dual_parity")],
    ["Two-cluster kind", baseRows.length ? allBaseStatus(baseRows, "two_cluster_kind_parity") : allBaseStatus(matrixRows.filter((row) => row.row_kind !== "source"), "lane_two_cluster_kind")],
  ];
  const lifecycleRoutes = catalog.lifecycleRoutes.filter((row) => row.chart === entry.chart);
  const lifecycleRows = lifecycleRoutes.map((row) => [
    row.quirk_class,
    row.route_name,
    executionModePlain(row.execution_mode),
    (row.alternatives ?? []).map((alt) => alt.route).join(", ") || "-",
    isTruthyRouteFlag(row.safe_as_automatic) ? "yes" : "no",
  ]);
  const lifecycleByVariantEntry = (catalog.lifecycleByVariant ?? []).find((c) => c.chart === entry.chart);
  const skillRows = chartSkill?.applicable?.map((skill) => [
    `<a href="../../${escapeHtml(skill.doc)}">${escapeHtml(skill.title)}</a>`,
    skill.why,
  ]) ?? [];
  const factSheetRows = [
    ["User status", evidenceRoute?.user_status || userReadiness?.user_status || "not recorded"],
    ["Can I use it?", evidenceRoute?.chart_use_answer || "check the supported base and production boundary"],
    ["First base", evidenceRoute?.first_base || entry.start_variant],
    ["Current proof", evidenceRoute?.current_proof || entry.proof_status || "see proof lanes"],
    ["Coverage", evidenceRoute?.coverage_status || "see coverage evidence"],
    ["User must provide", evidenceRoute?.user_must_provide || userReadiness?.user_must_provide || "check target facts and base readiness"],
    ["ConfigHub/installer absorbs", evidenceRoute?.routed_or_absorbed || userReadiness?.confighub_absorbs || "rendered objects, receipts, and checks"],
    ["Next action", evidenceRoute?.next_action || top100?.next_action || support?.next_action || "none recorded"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(entry.chart)} ${escapeHtml(entry.version)} · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header>
    ${topNav("..")}
    <h1>${escapeHtml(entry.chart)}</h1>
    ${generatedStamp(catalog, "chart status page")}
    <p>This page tells you what ConfigHub knows about this Helm chart today: how to run it with <code>cub</code>, which variants are available, what evidence exists, and what is still watch or blocked.</p>
    <p class="mono" style="font-size:.85rem">ecosystem: <a href="https://artifacthub.io/packages/search?ts_query_web=${encodeURIComponent(entry.chart.split("/").at(-1))}&amp;kind=0" rel="noopener">find this chart on Artifact Hub</a> · <a href="https://helm.sh/docs/" rel="noopener">Helm docs</a> - discovery and tooling live upstream; this page adds the proof.</p>
    <p class="tagline">${escapeHtml(catalogLayerLabel(entry))} page for ${escapeHtml(entry.chart)}@${escapeHtml(entry.version)}.</p>
    <pre>${escapeHtml(entry.start_command || `cub installer setup --pull ${entry.package_path} --base ${entry.start_variant} --work-dir <tmp> --non-interactive`)}</pre>
  </header>
  <main>
    <section aria-labelledby="summary">
      <h2 id="summary">What To Use</h2>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(entry.start_variant)}</strong><span>Recommended first base</span></div>
        <div class="metric"><strong>${escapeHtml(entry.variant_count)}</strong><span>${entry.proof_surface === "next80-proof-grade" ? "Candidate base variants" : "Supported base variants"}</span></div>
        <div class="metric"><strong>${escapeHtml(entry.start_base_readiness || "see bases")}</strong><span>Start-base status</span></div>
        <div class="metric"><strong>${escapeHtml(production?.production_support ?? entry.production_readiness)}</strong><span>Production disposition</span></div>
      </div>
      <p>${escapeHtml(chartUse?.plain_english ?? "Use the public catalog entry, then check the exact base and proof lane before making a production claim.")}</p>
      ${markdownLikeTable([
        ["Question", "Answer"],
        ["Catalog level", catalogLayerLabel(entry)],
        ["Chart version", entry.version],
        ["Latest upstream seen", entry.latest_status === "update-available" ? `${entry.latest_version} (update candidate)` : entry.latest_version || "not checked"],
        [entry.proof_surface === "next80-proof-grade" ? "Candidate bases" : "Supported bases", entry.supported_variants || entry.candidate_variants || "see matrix rows"],
        ["Not yet enabled", entry.not_yet_enabled || "none recorded"],
        ["Namespace", entry.namespace || "chart default"],
      ])}
    </section>

    <section aria-labelledby="run-this">
      <h2 id="run-this">How Do I Run This Chart With cub?</h2>
      <p>Start with <strong>${escapeHtml(entry.start_variant)}</strong> unless a row below says this chart needs a different base or custom discussion. This command is generated from the current matrix and package metadata.</p>
      <div class="card">
        <h3>Recommended first command</h3>
        <p>${firstRunnableCommand}</p>
        <h3>You should see something like this</h3>
        <pre><code>cub installer setup ...
rendered manifests written under &lt;work-dir&gt;
use the chart option cards below to check pass, watch, blocked, and prerequisites</code></pre>
        <p><strong>Current row status:</strong> ${escapeHtml(firstRunnableRow?.row_status || entry.start_base_readiness || "unknown")} · <strong>Reason:</strong> ${escapeHtml(firstRunnableReason)}</p>
      </div>
    </section>

${teaching ? `\n    ${teaching}\n` : ""}

    <section aria-labelledby="matrix-options">
      <h2 id="matrix-options">Options From The Matrix</h2>
      <p>This is the chart-specific answer to: how do I run this chart with <code>cub</code>, and what are my options? Each card is one row from the master matrix for this chart/version. Runnable base rows show the installer command; candidate and derived rows show where the option sits in the flow.</p>
      <p class="mono" style="font-size:.86rem">${escapeHtml(matrixRows.length)} matrix row${matrixRows.length === 1 ? "" : "s"} for ${escapeHtml(entry.chart)}@${escapeHtml(entry.version)} · <a href="../matrix.html">open the full matrix</a></p>
      ${matrixRows.length ? `<div class="matrix-row-grid">${matrixRows.map((row) => matrixRowCard(row, entry)).join("")}</div>` : "<p>No matrix rows are recorded for this chart/version.</p>"}
    </section>

    ${chartAdoptionCaveatHtml(adoptionCaveat)}

    <section aria-labelledby="playbooks">
      <h2 id="playbooks">Operator Playbooks And Fact Sheet</h2>
      <p>This is the quick route for a human or agent: which operating playbook applies, what the current user-facing answer is, and what the next proof or product action would add.</p>
      ${skillRows.length
        ? markdownLikeTable([
            ["Playbook", "Why it applies"],
            ...skillRows,
          ], { rawFirstColumn: true })
        : "<p>No special operating playbook is assigned for this chart. Use the base readiness and proof lanes.</p>"}
      ${markdownLikeTable([
        ["Fact", "Current chart-level route"],
        ...factSheetRows,
      ])}
      <p>Source data: <a href="../../data/chart-skills/summary.md">chart skills</a> and <a href="../../data/chart-evidence-router/summary.md">chart evidence router</a>.</p>
    </section>

    <section aria-labelledby="proof">
      <h2 id="proof">Proof Lanes</h2>
      <p>Each lane proves a different outcome. Missing or non-pass rows are backlog or target-fit evidence; they do not change the render-parity result.</p>
      <p><strong>How much is proven, and what more testing would add:</strong> ${evidenceDepthSummary(lanes)}</p>
      ${markdownLikeTable([
        ["Lane", "Status across bases"],
        ...lanes,
      ])}
      ${markdownLikeTable([
        ["Base", "Readiness", "Render", "ConfigHub", "Local live", "GitOps/OCI", "Live parity", "Two-cluster kind"],
        ...proofEvidenceRows,
      ])}
    </section>

    <section aria-labelledby="quirks">
      <h2 id="quirks">Quirks And Inputs</h2>
      <p>${escapeHtml(userReadiness?.confighub_absorbs ?? "ConfigHub keeps the rendered objects, proof receipts, and support boundary explicit.")}</p>
      ${markdownLikeTable([
        ["Field", "Value"],
        ["Known quirks", userReadiness?.quirks || top100?.source_features || entry.source_features || "none surfaced"],
        ["User must provide", userReadiness?.user_must_provide || "check base readiness and target facts"],
        ["ConfigHub absorbs", userReadiness?.confighub_absorbs || "exact rendered objects, checks, receipts, and catalog evidence"],
        ["Extension slots", extension?.surfaces || "none surfaced in chart facts"],
        ["Extension route", extension?.current_route || "no extension-slot route recorded"],
      ])}
    </section>

    <section aria-labelledby="lifecycle">
      <h2 id="lifecycle">ConfigHub Actions</h2>
      <p>Each Helm hook or hook-like behavior becomes an explicit <strong>ConfigHub action</strong> — visible, named, and receipted instead of a hidden Helm hook. After you deploy, who runs each (per variant): your delivery pipeline — a GitOps PreSync/PostSync, a cub action, or an opt-in check — not by hand. No action is auto-executed today (<code>automatic: false</code>); that, with a receipt, is the roadmap (<a href="https://github.com/confighub/helm-expt/issues/688">#688</a>). See all charts on the <a href="./index.html#actions">Helm Catalog actions section</a> · <a href="../../data/lifecycle-routes-by-variant/by-variant.html">standalone view</a>.</p>
      ${lifecycleByVariantEntry
        ? whoRunsVariantTables(lifecycleByVariantEntry)
        : lifecycleRows.length
          ? markdownLikeTable([
              ["Behavior", "Route", "Who runs it", "Off-ramps", "Safe to automate?"],
              ...lifecycleRows,
            ])
          : "<p>No ConfigHub action route is attached to this chart page yet. That is not a claim that the upstream chart has no Helm hooks. It means the public catalog has no per-variant route to show here; check the Helm Catalog filters, the matrix, or send a problem chart if hook behavior should be modeled.</p>"}
    </section>

    <section aria-labelledby="production">
      <h2 id="production">Production Boundary</h2>
      <p>A green render or local live result is not a production support claim. Production support is target-scoped and uses the support-decision artifact when present.</p>
      ${markdownLikeTable([
        ["Field", "Value"],
        ["Production disposition", production?.production_support ?? entry.production_readiness],
        ["Target-scoped support decision", support?.decision ?? "not recorded"],
        ["Supported base", support?.supported_base ?? ""],
        ["Target scope", support?.target_scope ?? ""],
        ["Accepted dispositions", acceptedDispositions.join("; ") || "none recorded"],
        ["Open dispositions", openDispositions.join("; ") || "none"],
        ["Next action", support?.next_action || production?.next_action || top100?.next_action || ""],
      ])}
    </section>

    <section aria-labelledby="files">
      <h2 id="files">Files To Inspect</h2>
      ${markdownLikeTable([
        ["Artifact", "Path"],
        ...artifactRows.map(([label, path]) => [label, `<a href="../../${path}">${path}</a>`]),
      ], { rawSecondColumn: true })}
    </section>
  </main>
  <footer>Generated from helm-expt proof data. Check current receipts before making production claims.</footer>
</body>
</html>
`;
}

function compareMatrixRows(left, right) {
  const layerRank = new Map([
    ["F1", 1],
    ["F2a", 2],
    ["F2b", 3],
    ["F2c", 4],
    ["F3", 5],
    ["F4a", 6],
    ["F4b", 7],
  ]);
  const leftRank = layerRank.get(left.catalog_layer) ?? 99;
  const rightRank = layerRank.get(right.catalog_layer) ?? 99;
  if (leftRank !== rightRank) return leftRank - rightRank;
  const kind = left.row_kind.localeCompare(right.row_kind);
  if (kind !== 0) return kind;
  return left.variant.localeCompare(right.variant);
}

function chartTeachingHtml(entry) {
  if (entry.chart === "bitnami/redis" && entry.version === "25.5.3") {
    return `<section aria-labelledby="redis-teaching">
      <h2 id="redis-teaching">Redis Teaching Path</h2>
      <p>Redis is the gold-standard tutorial chart for this site. Use it to see the same chart through normal Helm, cub installer, and ConfigHub Units.</p>
      <div class="grid">
        <div class="card"><h3>Normal Helm</h3><pre><code>helm install redis bitnami/redis --version 25.5.3 --namespace redis --create-namespace</code></pre><p>You should see Helm create a Redis release and Kubernetes objects in the namespace.</p></div>
        <div class="card"><h3>cub installer</h3><pre><code>cub installer setup --pull packages/bitnami/redis/25.5.3 --base default --work-dir .tmp/demo/redis-default --non-interactive --namespace redis</code></pre><p>You should see rendered manifests in the work directory. If <code>out/secrets</code> exists, apply it before the main manifests for a local Kubernetes run.</p></div>
        <div class="card"><h3>ConfigHub</h3><pre><code>cub installer upload --work-dir .tmp/demo/redis-default --space helm-redis-default</code></pre><p>You should see labeled Redis Units in the ConfigHub Space. Variants and promotions start from those Units.</p></div>
      </div>
      <p><a href="../try.html">Open Get Started</a> · <a href="../../docs/user/expected-results-and-clusters.md">Expected results and clusters</a></p>
    </section>`;
  }
  if (entry.chart === "prometheus-community/kube-prometheus-stack") {
    return `<section aria-labelledby="kps-teaching">
      <h2 id="kps-teaching">Serious Chart Example</h2>
      <p>kube-prometheus-stack is the serious-chart exemplar. It is where the model has to deal with CRDs, webhooks, RBAC, generated facts, extension slots, target facts, upgrade checks, and live observations.</p>
      <div class="card">
        <h3>What to look for</h3>
        ${markdownLikeTable([
          ["Area", "Why it matters"],
          ["CRDs", "Render parity is not enough; CRD lifecycle and upgrades need explicit checks."],
          ["Webhooks", "Admission readiness and certificates are live lifecycle facts."],
          ["Target facts", "The target cluster shape affects whether the rendered objects can run."],
          ["Watch rows", "A non-green row can be the honest result when lifecycle evidence or target support is bounded."],
        ])}
      </div>
      <p><a href="../../docs/user/serious-chart-proof.md">Open serious chart proof</a> · <a href="../../data/hard-chart-production-packets/summary.md">Hard-chart packets</a></p>
    </section>`;
  }
  return "";
}

function matrixRowCard(row, entry) {
  const title = row.variant || "(unnamed)";
  const command = matrixRowRunPath(row, entry);
  const nextAction = row.active_proof_next_step || row.next_action || row.variant_promotion_next_action || row.candidate_required_before || "";
  const reason = row.active_proof_reason || row.variant_promotion_reason || row.hard_gap || "";
  const rowLinks = matrixRowLinks(row);
  const laneBadges = [
    ["R", "Render", row.lane_render_parity],
    ["C", "ConfigHub", row.lane_confighub_scan_ops],
    ["L", "Local", row.lane_local_kind],
    ["Y", "Lifecycle", row.lane_lifecycle_observed],
    ["G", "GitOps", row.lane_gitops_oci_live],
    ["P", "Live parity", row.lane_live_dual_parity],
    ["K", "Kind parity", row.lane_two_cluster_kind],
    ["V", "Promotion", row.variant_promotion],
  ];
  return `<article class="matrix-row-card">
        <div class="matrix-row-head">
          <div>
            <span class="row-layer">${escapeHtml(row.catalog_layer || "?")}</span>
            <h3>${escapeHtml(title)}</h3>
          </div>
          <span class="row-kind">${escapeHtml(row.row_kind || "row")}</span>
        </div>
        <p class="row-purpose">${escapeHtml(row.customization_layer || row.adoption_bucket || row.row_status || "matrix option")}</p>
        <dl>
          <dt>Status</dt><dd>${escapeHtml(row.row_status || "unknown")}${row.custom_discussion === "yes" ? " · custom discussion" : ""}</dd>
          <dt>How to run</dt><dd>${command}</dd>
          <dt>Evidence</dt><dd>${escapeHtml(row.strongest_evidence || row.outcome_level || "not recorded")}</dd>
          <dt>Hooks/actions</dt><dd>${escapeHtml(matrixHookSummary(row))}</dd>
          <dt>Who runs actions?</dt><dd>${escapeHtml(matrixActionOwnerSummary(row))}</dd>
          <dt>Next</dt><dd>${escapeHtml(nextAction || "No next action recorded.")}</dd>
          ${reason ? `<dt>Reason</dt><dd>${escapeHtml(reason)}</dd>` : ""}
        </dl>
        <div class="lane-strip" aria-label="Proof lanes for ${escapeHtml(title)}">
          ${laneBadges.map(([code, label, value]) => lanePill(code, label, value)).join("")}
        </div>
        ${rowLinks.length ? `<p class="row-links">${rowLinks.join(" · ")}</p>` : ""}
      </article>`;
}

function matrixRowRunPath(row, entry) {
  if (row.row_kind === "source") {
    return "Source chart. Choose an F2 base below before running the installer.";
  }
  if (row.row_kind === "candidate") {
    const required = row.candidate_required_before || row.next_action || "finish the candidate work order";
    return `Candidate option. Required before running: ${escapeHtml(required)}.`;
  }
  if (row.row_kind === "derived") {
    const parent = row.parent_base || "a reviewed base";
    const target = row.downstream_space || row.variant;
    return `Derived ConfigHub variant from ${escapeHtml(parent)}. Create or promote after uploading the base; target row: ${escapeHtml(target)}.`;
  }
  if (row.package_base_path) {
    const packagePath = row.package_base_path.replace(/\/bases\/[^/]+$/, "");
    const namespace = entry.namespace ? ` --namespace ${escapeHtml(entry.namespace)}` : "";
    return `<code>cub installer setup --pull ${escapeHtml(packagePath)} --base ${escapeHtml(row.variant)} --work-dir &lt;tmp&gt; --non-interactive${namespace}</code>`;
  }
  if (entry.package_path && row.variant && row.variant !== "(source)") {
    const namespace = entry.namespace ? ` --namespace ${escapeHtml(entry.namespace)}` : "";
    return `<code>cub installer setup --pull ${escapeHtml(entry.package_path)} --base ${escapeHtml(row.variant)} --work-dir &lt;tmp&gt; --non-interactive${namespace}</code>`;
  }
  return "Review the matrix row before running this option.";
}

function matrixHookSummary(row) {
  const parts = [];
  if (row.hook_count) parts.push(`${row.hook_count} source hook(s)`);
  if (row.hook_disposition) parts.push(row.hook_disposition);
  if (row.hook_live_status && row.hook_live_status !== "n/a") parts.push(`live: ${row.hook_live_status}`);
  if (row.lifecycle_route_contract && row.lifecycle_route_contract !== "n/a") {
    parts.push(`route: ${row.lifecycle_route_contract}`);
  }
  return parts.join("; ") || "n/a";
}

function matrixActionOwnerSummary(row) {
  const modes = String(row.lifecycle_route_execution_modes || "")
    .split(/[;,]/)
    .map((mode) => mode.trim())
    .filter(Boolean);
  if (!modes.length || modes.every((mode) => mode === "n/a")) {
    if (row.hook_disposition && row.hook_disposition !== "n/a") return "read the route receipt before delivery";
    return "n/a";
  }
  const labels = [...new Set(modes)].map(executionModePlain);
  const automatic = String(row.lifecycle_route_safe_automatic || "").toLowerCase();
  const suffix = automatic.includes("true") ? "automatic evidence present" : "automatic false until route execution has evidence";
  return `${labels.join(", ")}; ${suffix}`;
}

function matrixRowLinks(row) {
  const links = [];
  const maybe = (label, path) => {
    if (!path) return;
    links.push(`<a href="../../${escapeHtml(path)}">${escapeHtml(label)}</a>`);
  };
  maybe("catalog", row.recipe_catalog_path);
  maybe("variant", row.variant_path);
  maybe("package base", row.package_base_path);
  maybe("receipt", row.target_run_receipt || row.variant_promotion_evidence || row.active_proof_support_artifact);
  if (row.source_repository_url) links.push(`<a href="${escapeHtml(row.source_repository_url)}" rel="noopener">source repo</a>`);
  return links;
}

function lanePill(code, label, value) {
  const normalized = normalizeLaneValue(value);
  return `<span class="lane-pill ${escapeHtml(normalized)}" title="${escapeHtml(label)}: ${escapeHtml(value || "blank")}"><b>${escapeHtml(code)}</b><em>${escapeHtml(laneShortValue(value))}</em></span>`;
}

function normalizeLaneValue(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "blank";
  if (["yes", "pass", "proven", "supported"].includes(text)) return "yes";
  if (["watch", "proven-with-watch"].includes(text)) return "watch";
  if (["no", "blocked", "rejected"].includes(text)) return "no";
  if (["todo", "not-yet-run"].includes(text)) return "todo";
  if (text === "n/a") return "na";
  return "other";
}

function laneShortValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "blank";
  if (text === "n/a") return "n/a";
  if (text === "proven-with-watch") return "watch";
  return text;
}

function chartCard(entry) {
  const latestStatus = entry.latest_status === "update-available" ? "warn" : "good";
  const latestLabel =
    entry.latest_status === "update-available"
      ? `candidate ${entry.latest_version}`
      : entry.latest_status === "current"
        ? "current"
        : "not checked";
  return `<article class="card">
          <h3>${escapeHtml(entry.chart)}</h3>
          <span class="status good">${escapeHtml(entry.catalog_status)}</span>
          <span class="status ${latestStatus}">${escapeHtml(latestLabel)}</span>
          <dl>
            <dt>Supported version</dt><dd>${escapeHtml(entry.version)}</dd>
            <dt>Start variant</dt><dd>${escapeHtml(entry.start_variant)}</dd>
            <dt>Start status</dt><dd>${escapeHtml(entry.start_base_readiness || "see base-readiness table")}</dd>
            <dt>Variants</dt><dd>${escapeHtml(entry.supported_variants || entry.candidate_variants)}</dd>
            <dt>Chart page</dt><dd><a href="./charts/${escapeHtml(chartPageFileName(entry))}">Open public chart page</a></dd>
            <dt>Package</dt><dd><a href="../${escapeHtml(entry.package_path)}">${escapeHtml(entry.package_path)}</a></dd>
            <dt>Chart proof</dt><dd><a href="../${escapeHtml(entry.catalog_path)}">CATALOG.md</a></dd>
          </dl>
        </article>`;
}

function chartPageFileName(entry) {
  return `${entry.chart}-${entry.version}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") + ".html";
}

function productionSummaryForChart(catalog, entry) {
  return catalog.productionDisposition.find((row) => row.chart === entry.chart && row.version === entry.version);
}

function allBaseStatus(rows, field) {
  if (rows.length === 0) return "not recorded";
  const counts = countBy(rows, field);
  return Object.entries(counts)
    .map(([status, count]) => `${status}: ${count}/${rows.length}`)
    .join("; ");
}

function bestBaseRows(rows) {
  const byChart = new Map();
  for (const row of rows) {
    const current = byChart.get(row.chart);
    if (!current || compareBaseReadiness(row, current) < 0) byChart.set(row.chart, row);
  }
  return [...byChart.values()].sort((left, right) => left.chart.localeCompare(right.chart));
}

function compareBaseReadiness(left, right) {
  const readinessRank = new Map([
    ["start-here", 0],
    ["lifecycle-observed", 1],
    ["prerequisite-observed", 2],
    ["try-with-proof", 3],
    ["runtime-watch", 4],
    ["runtime-review-needed", 5],
    ["target-prerequisite-needed", 6],
    ["hook-lifecycle-review-needed", 7],
  ]);
  const leftRank = readinessRank.get(left.user_readiness) ?? 99;
  const rightRank = readinessRank.get(right.user_readiness) ?? 99;
  if (leftRank !== rightRank) return leftRank - rightRank;
  if (left.complete_core_lane_set !== right.complete_core_lane_set) return left.complete_core_lane_set === "yes" ? -1 : 1;
  if (left.recommended_first !== right.recommended_first) return left.recommended_first === "yes" ? -1 : 1;
  return left.base.localeCompare(right.base);
}

function baseReadinessLabelRows() {
  return [
    ["start-here", "Best current demo/catalog path for the declared scope."],
    ["try-with-proof", "Render parity and two-cluster parity pass, but broader lanes are still incomplete."],
    ["lifecycle-observed", "Lifecycle behavior has a committed observation receipt."],
    ["prerequisite-observed", "A target prerequisite is explicit and has observation evidence."],
    ["runtime-watch", "Object parity passed, but the live target did not fully settle during the run."],
    ["runtime-review-needed", "Runtime state needs investigation before the base is presented as easy."],
    ["target-prerequisite-needed", "The target must provide a prerequisite such as CRDs, APIs, Secrets, or storage."],
    ["hook-lifecycle-review-needed", "Helm hook or hook-like lifecycle behavior needs an explicit route and receipt."],
  ];
}

function universalCubAdoptionRows() {
  return [
    [
      "Customize with declared inputs or a base edit, not Helm --set",
      `cub rejects Helm flags instead of silently absorbing typos. Use <code>--input</code> for declared inputs, <code>--set-image</code> for declared images, or edit/author a base. See <a href="../docs/user/helm-to-cub-migration.md">Helm to cub migration</a>.`,
    ],
    [
      "cub-direct upgrades must prune removed objects",
      `Plain <code>kubectl apply</code> leaves orphans. Use the managed cub-direct applier, which prunes, or use Argo/Flux for controller-managed prune.`,
    ],
    [
      "server-side apply conflicts need a readable choice",
      `A manual live edit can conflict on re-apply. The managed applier surfaces the reconcile choice in plain words instead of letting a raw Kubernetes error be the user experience.`,
    ],
  ];
}

function chartAdoptionCaveatHtml(caveat) {
  if (!caveat) {
    return `<section aria-labelledby="adoption-caveats">
      <h2 id="adoption-caveats">Adoption Caveats Versus Plain Helm</h2>
      <p>No chart-specific password or CRD caveat is recorded for this chart. The three universal cub-direct caveats still apply: use declared inputs or bases instead of Helm <code>--set</code>, use managed prune for upgrades, and surface server-side-apply conflicts as an explicit reconcile choice.</p>
      <p><a href="../../data/cub-adoption-caveats/summary.html">Open the all-chart adoption caveats</a> · <a href="../../docs/user/helm-to-cub-migration.md">Helm to cub migration</a></p>
    </section>`;
  }
  const hasPassword = caveat.bakes_shared_password === "yes";
  const hasCrds = caveat.ships_crds === "yes";
  const rows = [
    ["Universal caveats", `Use declared inputs or bases instead of Helm <code>--set</code>; use managed cub-direct prune or Argo/Flux for upgrades; treat SSA conflicts as an explicit reconcile choice.`],
    [
      "Shared placeholder password",
      hasPassword
        ? `Yes. Password keys: <code>${escapeHtml(caveat.password_keys || "recorded")}</code>. Use base <code>${escapeHtml(caveat.password_fix_base || "existing-secret")}</code> and stage your own Secret. Example: <code>${escapeHtml(caveat.password_fix_command || "kubectl create secret ...")}</code>.`
        : "No shared placeholder password caveat recorded for this chart.",
    ],
    [
      "CRD first-ordering",
      hasCrds
        ? `Yes. ${escapeHtml(caveat.crd_count || "some")} CRD object(s) are recorded. Use the managed cub-direct applier, use Argo/Flux, or choose the separable CRD base ${caveat.crd_separable_base ? `<code>${escapeHtml(caveat.crd_separable_base)}</code>` : "when one is available"}.`
        : "No CRD first-ordering caveat recorded for this chart.",
    ],
  ];
  return `<section aria-labelledby="adoption-caveats">
      <h2 id="adoption-caveats">Adoption Caveats Versus Plain Helm</h2>
      <p>This is the chart-specific heads-up for places where cub can otherwise feel more confusing than plain Helm on the first run. These caveats are managed, but they are still visible.</p>
      ${markdownLikeTable([
        ["Caveat", "What to do"],
        ...rows,
      ], { rawSecondColumn: true })}
      <p><a href="../../data/cub-adoption-caveats/summary.html">Open the all-chart adoption caveats</a> · <a href="../../docs/user/helm-to-cub-migration.md">Helm to cub migration</a> · <a href="../../docs/user/cub-deployment-path.md">cub deployment path</a></p>
    </section>`;
}

function hardGapRowsByBucket(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const bucket = row.adoption_bucket || "unknown";
    const current = buckets.get(bucket) ?? { total: 0, withGap: 0 };
    current.total += 1;
    if (row.hard_gap && row.hard_gap !== "-") current.withGap += 1;
    buckets.set(bucket, current);
  }
  const order = ["try-from-public-catalog", "promote-after-review", "needs-useful-variant", "limitation-decision-first"];
  return [...buckets.entries()]
    .sort(([left], [right]) => {
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex) || left.localeCompare(right);
    })
    .map(([bucket, counts]) => [bucket, String(counts.total), String(counts.withGap), hardGapBucketMeaning(bucket)]);
}

function hardGapBucketMeaning(bucket) {
  return {
    "try-from-public-catalog": "Reviewed bases exist; gaps usually point to additional paths that still need support or disclosure.",
    "promote-after-review": "No named hard gap currently blocks promotion review.",
    "needs-useful-variant": "Add realistic variants first; use any gap to shape or disclose the variant boundary.",
    "limitation-decision-first": "The named gap blocks promotion until it is supported, disclosed, or deferred.",
  }[bucket] ?? "Review before promotion.";
}

function chartUseMeaning(answer) {
  return {
    "yes-public-catalog": "Use the public catalog entry, then check the exact base and lane.",
    "not-yet-public-catalog-proof-ready": "Proof and useful variants exist, but catalog promotion review is not done.",
    "not-yet-user-ready": "The current proof is too default-shaped; design a better base variant first.",
    "decision-needed-first": "A named capability gap must be supported, disclosed, deferred, or blocked first.",
  }[answer] ?? "Review before recommending.";
}

function commandRoutes() {
  return [
    {
      goal: "See what a chart renders without ConfigHub state.",
      command: "cub helm template",
      path: "direct-render",
    },
    {
      goal: "Load one Helm render into ConfigHub Units quickly.",
      command: "cub helm install",
      path: "one-shot-configHub-load",
    },
    {
      goal: "Adopt an existing Argo, Flux, KRM, or rendered-manifest app.",
      command: "cub gitops discover/import, cub unit import, or managed import",
      path: "existing-app-adoption",
    },
    {
      goal: "Use a maintained catalog entry with supported bases and proof.",
      command: "cub installer setup --pull <package> --base <base>",
      path: "maintained-catalog-base",
    },
    {
      goal: "Upload a reviewed rendered base into ConfigHub.",
      command: "cub installer upload",
      path: "reviewed-unit-upload",
    },
    {
      goal: "Create an environment, region, customer, or target variant after upload.",
      command: "cub variant create",
      path: "post-render-configHub-variant",
    },
  ];
}

function dispositionMeaning(value) {
  return {
    observed: "The selected lifecycle behavior has committed evidence.",
    routed: "The route, executor, and off-ramp are named; automatic execution is not implied.",
    "per-target": "The target class must choose or approve the route before a stronger claim.",
    refused: "The catalog deliberately does not support this behavior through the current path.",
    todo: "The behavior is known, but the route or evidence still needs work.",
  }[value] ?? "Review the lifecycle route contract before using this row.";
}

function executionModeMeaning(value) {
  return {
    "product-executes": "The product owns the lifecycle action and evidence must prove it.",
    "user-executes": "The user runs the lifecycle action explicitly, with receipts or checks where available.",
    "target-owned": "The Kubernetes target, GitOps controller, or another controller owns the behavior.",
    "not-yet-executable": "The route is modeled, but no executable product path is claimed yet.",
  }[value] ?? "Review the route contract before using this mode.";
}

function isTruthyRouteFlag(value) {
  return value === true || String(value).toLowerCase() === "yes";
}

function shortLifecycleEvidence(value) {
  const text = String(value ?? "");
  if (!text) return "";
  const first = text.split("|")[0].trim();
  return first.length > 120 ? `${first.slice(0, 117)}...` : first;
}

function metricValue(row) {
  if (!row?.metric) return "-";
  return row.total ? `${row.value}/${row.total}` : row.value;
}

function dispositionCount(value) {
  return splitDisposition(value).length;
}

function flattenCounts(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    for (const value of splitDisposition(row[field])) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

function splitDisposition(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function supportDecisionWorkstreams(rows) {
  const workstreams = [
    [
      "Supported scope evidence",
      rows.filter((row) => row.decision === "supported"),
      "Keep target-scoped evidence fresh before using the supported scope as a production example.",
    ],
    [
      "Image digest resolution or exception",
      rows.filter((row) => row.image_decision === "needs-image-digest-resolution-or-exception"),
      "Pin images by digest or record an explicit exception before production OCI support.",
    ],
    [
      "Scan scope decision",
      rows.filter((row) => row.scan_decision === "needs-scan-scope-decision"),
      "Record which scanner findings are accepted, fixed, or outside the supported target scope.",
    ],
    [
      "Security acceptance or hardened base",
      rows.filter((row) => row.scan_decision === "needs-security-acceptance-or-hardened-base"),
      "Accept current security findings for the target scope or create a narrower hardened base.",
    ],
    [
      "Lifecycle decision or observation",
      rows.filter((row) => ["needs-lifecycle-support-boundary", "route-selected-observation-needed"].includes(row.lifecycle_decision)),
      "Record the lifecycle boundary, or execute and observe the selected hook/lifecycle route.",
    ],
    [
      "Runtime or missing-lane decision",
      rows.filter((row) => ["needs-runtime-decision-before-final", "needs-missing-live-or-confighub-lanes-before-final", "needs-lifecycle-observation-before-final"].includes(row.live_evidence_decision)),
      "Close the runtime, missing-lane, or lifecycle-observation decision before refreshing final evidence.",
    ],
    [
      "Fresh target-scoped evidence",
      rows.filter((row) => row.live_evidence_decision === "needs-fresh-target-evidence-before-final"),
      "After scope and risk decisions are closed, refresh ConfigHub OCI/GitOps and live/e2e evidence for that exact scope.",
    ],
  ];
  return workstreams
    .filter(([, workstreamRows]) => workstreamRows.length > 0)
    .map(([label, workstreamRows, instruction]) => {
      const examples = workstreamRows
      .slice(0, 5)
      .map((row) => `${row.chart}@${row.version} (${row.supported_base || row.candidateBase || "base TBD"})`)
      .join("; ");
      const suffix = workstreamRows.length > 5 ? `; and ${workstreamRows.length - 5} more` : "";
      return [label, String(workstreamRows.length), `${instruction} ${examples}${suffix}`];
    });
}

function scanRouteMeaning(route) {
  return {
    "fix-image-pin": "Fix mutable image input in the supported base and regenerate proof.",
    "add-resource-policy": "Add resource requests/limits or keep the base scoped to local/test.",
    "harden-security-context": "Harden pod/container security settings or record explicit acceptance.",
    "accept-or-split-privileged-infrastructure": "Accept privileged infrastructure behavior or create a narrower hardened base.",
    "review-runtime-endpoints": "Confirm services/probes with runtime evidence or patch the supported base.",
    "accept-or-patch-pdb-policy": "Accept chart PDB behavior or add a reviewed patch.",
    "review-lifecycle-cleanup": "Set lifecycle cleanup policy for rendered Jobs.",
  }[route] ?? "Chart-specific scan review.";
}

function markdownLikeTable(rows, options = {}) {
  const [headers, ...body] = rows;
  return `<div class="card"><table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${body
          .map((row) => `<tr>${row.map((cell, index) => `<td>${formatTableCell(cell, index, options)}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table></div>
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border-bottom: 1px solid var(--line); text-align: left; padding: 8px; vertical-align: top; }
        td { overflow-wrap: anywhere; }
        th { color: var(--muted); font-weight: 600; }
      </style>`;
}

function formatTableCell(cell, index, options) {
  if (options.rawFirstColumn && index === 0) return String(cell ?? "");
  if (options.rawSecondColumn && index === 1) return String(cell ?? "");
  if (options.rawThirdColumn && index === 2) return String(cell ?? "");
  if (options.rawFourthColumn && index === 3) return String(cell ?? "");
  return escapeHtml(cell);
}

function plainTable(rows) {
  const [headers, ...body] = rows;
  return `<table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
}

function simpleList(rows) {
  return `<ul>${rows.map(([title, body]) => `<li><strong>${escapeHtml(title)}:</strong> ${escapeHtml(body)}</li>`).join("")}</ul>`;
}

function siteCss() {
  return `
    :root {
      color-scheme: light;
      --ink: #15191d;
      --muted: #5b6872;
      --line: #dde3e9;
      --panel: #f6f8fa;
      --accent: #0b6bcb;
      --good: #1e8e3e;
      --warn: #b06000;
      --bad: #d93025;
      --surface: #ffffff;
      --term: #0e1419;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--surface);
      line-height: 1.5;
      font-size: 15px;
    }
    header, main, footer { max-width: 1180px; margin: 0 auto; padding: 24px 20px; }
    .site-chrome {
      max-width: 1180px;
      margin: 0 auto 20px;
    }
    .topbar {
      position: sticky; top: 0; z-index: 50;
      display: flex; align-items: baseline; gap: 18px;
      max-width: 1180px; margin: 0; padding: 12px 0;
      background: rgba(255,255,255,.92); backdrop-filter: blur(6px);
      border-bottom: 1px solid var(--line);
      font-size: .92rem;
    }
    .topbar .brand {
      font-weight: 700; color: var(--ink); text-decoration: none; letter-spacing: 0;
    }
    .navlinks { display: flex; flex-wrap: wrap; gap: 14px; margin-left: auto; }
    .navlinks a { color: var(--muted); text-decoration: none; }
    .navlinks a:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
    header.hero { padding-top: 44px; padding-bottom: 8px; border-bottom: 0; }
    h1 { margin: 0 0 10px; font-size: clamp(1.7rem, 3.4vw, 2.9rem); line-height: 1.08; letter-spacing: 0; max-width: 950px; }
    h2 { margin: 40px 0 10px; font-size: 1.32rem; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 1rem; }
    p { max-width: 860px; color: var(--muted); }
    .generated {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: .9rem;
    }
    .experiment-banner {
      display: inline-block;
      margin: 0 0 8px;
      padding: 8px 12px;
      border: 1px solid #f0c36d;
      border-radius: 8px;
      background: #fff8e5;
      color: #6d4b00;
      font-weight: 700;
      letter-spacing: 0;
    }
    a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    code, pre, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    code { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; font-size: .92em; }
    pre {
      overflow-wrap: anywhere;
      padding: 13px 14px;
      border: 1px solid #1f2a33;
      border-radius: 8px;
      background: var(--term);
      color: #dcebfa;
      white-space: pre-wrap;
      font-size: .86rem;
      line-height: 1.55;
    }
    pre code { background: transparent; border: 0; padding: 0; color: inherit; }
    .lead, .tagline { font-size: 1.08rem; color: var(--ink); max-width: 880px; }
    .doors { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin: 26px 0 8px; }
    .door {
      border: 1px solid var(--line); border-radius: 10px; background: var(--surface);
      padding: 16px; display: flex; flex-direction: column; gap: 8px;
      transition: border-color .15s ease;
    }
    .door:hover { border-color: var(--accent); }
    .door .kicker { font-size: .78rem; text-transform: uppercase; letter-spacing: 0; color: var(--muted); }
    .door h3 { font-size: 1.06rem; margin: 0; }
    .door h3 a { color: var(--ink); text-decoration: none; }
    .door h3 a:hover { color: var(--accent); }
    .door p { font-size: .92rem; margin: 0; }
    .door pre { margin: 6px 0 0; }
    .door .go { margin-top: auto; font-size: .9rem; }
    .journey-flow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: stretch;
      gap: 10px;
      margin: 26px 0 8px;
    }
    .journey-step {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--ink);
      text-decoration: none;
      transition: border-color .15s ease;
    }
    .journey-step:hover { border-color: var(--accent); }
    .journey-step .kicker { font-size: .78rem; text-transform: uppercase; letter-spacing: 0; color: var(--muted); }
    .journey-step h3 { font-size: 1.06rem; margin: 0; }
    .journey-step p { font-size: .92rem; margin: 0; color: var(--muted); }
    .journey-step .go { margin-top: auto; font-size: .9rem; color: var(--accent); }
    .journey-arrow {
      align-self: center;
      color: var(--muted);
      font-size: 1.35rem;
      line-height: 1;
    }
    .chain { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; counter-reset: step; margin: 14px 0; }
    .chain a {
      counter-increment: step;
      border: 1px solid var(--line); border-radius: 8px; background: var(--panel);
      padding: 10px 10px 10px 12px; font-size: .85rem; color: var(--ink); text-decoration: none;
      position: relative;
    }
    .chain a:hover { border-color: var(--accent); }
    .chain a::before {
      content: counter(step, decimal-leading-zero);
      display: block; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .72rem; color: var(--good); margin-bottom: 4px;
    }
    .tiers { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
    .tier { border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: var(--surface); display: flex; flex-direction: column; gap: 6px; }
    .tier .stage { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .72rem; color: var(--muted); }
    .tier h3 { font-size: .98rem; }
    .tier p { font-size: .85rem; margin: 0; }
    .tier .badge { align-self: flex-start; border-radius: 999px; font-size: .72rem; padding: 2px 8px; border: 1px solid var(--line); }
    .tier .badge.now { color: #fff; background: var(--good); border-color: var(--good); }
    .tier .badge.planned { color: var(--muted); background: var(--panel); }
    .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .card, .metric, .lane {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      padding: 14px;
    }
    .metric { background: var(--panel); }
    .metric strong { display: block; font-size: 1.65rem; line-height: 1; color: var(--ink); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .metric span { display: block; margin-top: 7px; color: var(--muted); font-size: .82rem; }
    .catalog { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card dl { display: grid; grid-template-columns: 9.5rem 1fr; gap: 6px 10px; margin: 12px 0 0; }
    .card dt { color: var(--muted); }
    .card dd { margin: 0; }
    .faq-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: stretch; }
    .faq-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 100%;
    }
    .faq-card.later { border-color: #efca92; background: #fffdf8; }
    .faq-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .faq-head h3 { margin: 0; font-size: 1.04rem; }
    .faq-status {
      flex: 0 0 auto;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 8px;
      font-size: .76rem;
      color: var(--muted);
      background: var(--panel);
    }
    .faq-card.later .faq-status { color: var(--warn); border-color: #efca92; background: #fff8ed; }
    .faq-card p { max-width: none; margin: 0; }
    .faq-links { margin-top: auto; font-size: .88rem; }
    .faq-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .faq-card table { font-size: .82rem; }
    .status { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .8rem; border: 1px solid var(--line); }
    .status.good { color: var(--good); border-color: #9bd3b8; background: #f0fbf5; }
    .status.warn { color: var(--warn); border-color: #efca92; background: #fff8ed; }
    .matrix-row-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: stretch; }
    .matrix-row-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      padding: 14px;
      display: grid;
      grid-template-rows: auto auto 1fr auto auto;
      gap: 10px;
      min-height: 100%;
    }
    .matrix-row-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .matrix-row-head h3 { margin-top: 4px; overflow-wrap: anywhere; }
    .row-layer, .row-kind {
      display: inline-block;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .74rem;
      color: var(--muted);
      background: var(--panel);
      white-space: nowrap;
    }
    .row-purpose { margin: 0; font-size: .88rem; color: var(--muted); min-height: 2.6em; }
    .matrix-row-card dl { display: grid; grid-template-columns: 7rem 1fr; gap: 6px 10px; margin: 0; align-content: start; }
    .matrix-row-card dt { color: var(--muted); }
    .matrix-row-card dd { margin: 0; overflow-wrap: anywhere; }
    .lane-strip { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 5px; }
    .lane-pill {
      border: 1px solid var(--line);
      border-radius: 7px;
      min-height: 42px;
      padding: 5px 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      background: var(--panel);
      text-align: center;
      overflow: hidden;
    }
    .lane-pill b { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .77rem; line-height: 1; }
    .lane-pill em { font-style: normal; font-size: .66rem; line-height: 1.05; max-width: 100%; overflow-wrap: anywhere; }
    .lane-pill.yes { color: var(--good); border-color: #9bd3b8; background: #f0fbf5; }
    .lane-pill.watch { color: var(--warn); border-color: #efca92; background: #fff8ed; }
    .lane-pill.no { color: var(--bad); border-color: #f0aaa4; background: #fff3f2; }
    .lane-pill.todo { color: #335c87; border-color: #b5cbe1; background: #f0f6fc; }
    .lane-pill.na, .lane-pill.blank { color: var(--muted); background: #f3f4f6; }
    .row-links { margin: 0; font-size: .84rem; }
    .lanes, .stage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .lane { background: var(--panel); }
    .bar { height: 7px; border-radius: 999px; background: #e3e9ef; overflow: hidden; margin-top: 12px; }
    .bar span { display: block; height: 100%; background: var(--good); }
    table { border-collapse: collapse; width: 100%; font-size: .9rem; }
    th, td { border: 1px solid var(--line); padding: 6px 9px; text-align: left; vertical-align: top; }
    thead th { background: var(--panel); position: sticky; top: 49px; }
    footer { color: var(--muted); border-top: 1px solid var(--line); margin-top: 40px; font-size: .9rem; }
    @media (max-width: 980px) {
      .doors, .chain, .tiers, .grid, .catalog, .lanes, .matrix-row-grid, .faq-list { grid-template-columns: 1fr 1fr; }
      .journey-flow { grid-template-columns: 1fr; }
      .journey-arrow { display: none; }
      .faq-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      body { font-size: 16px; }
      header, main, footer { padding: 18px 14px; }
      .home-hero { padding-top: 14px; }
      h1 { font-size: 2rem; line-height: 1.12; margin-bottom: 12px; }
      h2 { margin-top: 30px; }
      p { max-width: none; }
      .lead, .tagline { font-size: 1rem; }
      .doors, .chain, .tiers, .grid, .catalog, .lanes, .matrix-row-grid, .faq-list, .faq-metrics { grid-template-columns: 1fr; }
      .card dl { grid-template-columns: 1fr; }
      .matrix-row-card dl { grid-template-columns: 1fr; }
      .lane-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .site-chrome { margin-bottom: 14px; }
      .experiment-banner {
        display: block;
        width: fit-content;
        max-width: 100%;
        padding: 7px 10px;
        font-size: .78rem;
        line-height: 1.25;
      }
      .topbar {
        position: static;
        display: block;
        padding: 9px 0 10px;
      }
      .topbar .brand {
        display: inline-block;
        margin-bottom: 9px;
      }
      .navlinks {
        margin-left: 0;
        display: flex;
        flex-wrap: nowrap;
        gap: 8px;
        overflow-x: auto;
        padding: 0 0 7px;
        -webkit-overflow-scrolling: touch;
      }
      .navlinks a {
        flex: 0 0 auto;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 5px 9px;
        background: var(--surface);
        white-space: nowrap;
      }
      .journey-flow { gap: 8px; margin-top: 18px; }
      .journey-step { padding: 13px; gap: 6px; }
      .journey-step h3 { font-size: 1rem; }
      .journey-step p { font-size: .9rem; }
      pre { font-size: .8rem; }
      table { display: block; overflow-x: auto; white-space: nowrap; }
    }
`;
}

function readme() {
  return `# Generated Public Site

This directory is generated from helm-expt catalog data.

\`\`\`sh
npm run site:generate
npm run site:verify
\`\`\`

Open \`site/index.html\` first for the public launch front door.
Open \`site/how-it-works.html\` for the four-move model: render, route, deliver, observe.
Open \`site/try.html\` for the short try-now page.
Open \`site/variants.html\` for base variants, derived variants, and promotion entry points.
Open \`site/journey.html\` for Apps: public charts, custom apps, stacks,
and platform groups from inspect, to no-account try-out, to managed variants
and promotion.
Open \`site/custom-apps.html\` for deeper application examples with custom apps,
multi-chart stacks, and overlays.
Open \`site/operations.html\` for Ops: scans, gates, delivery, observation, adoption,
upgrades, rollback, bulk patching, and fleet questions.
Open \`site/day1-operations.html\` only as a compatibility redirect to \`site/operations.html\`.
Open \`site/docs.html\` for the public documentation hub.
Open \`site/known-gaps.html\` for current watch findings the project surfaces deliberately.
Open \`site/hard-questions.html\` for the FAQ: hooks, upgrades,
custom values, target prerequisites, false-green sync, and refusal boundaries.
Open \`site/proof.html\` only as a deep reference for proof lanes, sceptic tests,
and refusal boundaries.
Open \`site/charts/index.html#actions\` for ConfigHub Actions, including hook
and lifecycle route dispositions. \`site/hooks.html\` only redirects there for
compatibility.
Open \`site/private/index.html\` for private catalogs, managed operations, and commercial boundaries.
Open \`site/tiers.html\` only as a compatibility redirect to \`site/private/index.html\`.
Open \`site/offering.html\` for the longer public offering page.
Open \`docs/user/choose-your-path.md\` for the direct render, one-shot upload,
public catalog, and ConfigHub operations route picker.
Open \`site/charts/index.html\` for the generated per-chart catalog pages.
Open \`docs/user/production-support-decisions.md\` for the plain-English
boundary between production-review-ready and production-supported.

Data source:

- \`data/top100-catalog-analysis/raw.json\`
- \`data/top500-catalog-analysis/raw.json\`
- \`data/latest-top20-refresh/promotion-readiness.csv\`
- \`data/runtime-gitops/wave1.csv\`
- \`data/image-digest-workdown/all-subjects.csv\`
- \`data/next-ten-waves/gap-review-wave.csv\`
- \`data/status-dashboard/status.csv\`
- \`data/status-dashboard/active-proof-queue.csv\`
- \`data/app-readiness/summary.md\`
- \`data/preview-readiness/summary.md\`
- \`data/cub-scout-diff/summary.md\`
- \`data/outcome-evidence-contract/summary.md\`
- \`data/top20-base-readiness/base-readiness.csv\`
- \`data/extension-slots/extension-slots.csv\`
- \`data/top100-readiness/readiness.csv\`
- \`data/top100-user-readiness/readiness.csv\`
- \`data/top100-coverage/work-queue.csv\`
- \`data/useful-base-design-queue/summary.md\`
- \`data/top100-promotion-wave/wave.csv\`
- \`data/refresh-survival/refreshes.csv\`
- \`data/live-parity-rerun-plan/rerun-plan.csv\`
- \`data/production-disposition/top20.csv\`
- \`data/production-support-decisions/decisions.csv\`
- \`data/hard-chart-production-packets/summary.md\`
- \`data/high-fanout-demo/prometheus-kps.csv\`
- \`docs/user/choosing-commands.md\`
- \`data/variant-goldens/redis-prod-us-east/\`
- \`data/managed-overlay-goldens/external-dns-customer-acme-prod/\`

Do not edit generated files in this directory by hand.
`;
}

function applySupportDecisionNextActions(rows, supportDecisions) {
  const byChart = new Map(supportDecisions.map((row) => [`${row.chart}@${row.version}`, row]));
  return rows.map((row) => {
    const support = byChart.get(row.chart);
    if (!support) return row;
    return {
      ...row,
      next_action: support.next_action,
      next_action_source: "production-support-decisions",
    };
  });
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

function countBy(rows, field) {
  const counts = {};
  for (const row of rows) {
    const key = row[field] || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function escapeHtml(value) {
  return siteText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function siteText(value) {
  return String(value ?? "").replaceAll("\u2014", "-");
}

function siteSafe(value) {
  if (Array.isArray(value)) return value.map((entry) => siteSafe(entry));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, siteSafe(entry)]));
  if (typeof value === "string") return siteText(value);
  return value;
}
