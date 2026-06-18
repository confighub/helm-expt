import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const siteRoot = join(repoRoot, "site");
const chartPagesRoot = join(siteRoot, "charts");
const indexPath = join(siteRoot, "index.html");
const offeringPath = join(siteRoot, "offering.html");
const tryPath = join(siteRoot, "try.html");
const proofPath = join(siteRoot, "proof.html");
const hardQuestionsPath = join(siteRoot, "hard-questions.html");
const hooksPath = join(siteRoot, "hooks.html");
const tiersPath = join(siteRoot, "tiers.html");
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
const chartSkillsJsonPath = join(repoRoot, "data", "chart-skills", "skills.json");
const chartEvidenceRouterPath = join(repoRoot, "data", "chart-evidence-router", "router.csv");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const generatedAt = new Date().toISOString();
  const site = buildSite(generatedAt);
  rmSync(chartPagesRoot, { recursive: true, force: true });
  write(indexPath, site.indexHtml);
  write(offeringPath, site.offeringHtml);
  write(tryPath, site.tryHtml);
  write(proofPath, site.proofHtml);
  write(hardQuestionsPath, site.hardQuestionsHtml);
  write(hooksPath, site.hooksHtml);
  write(tiersPath, site.tiersHtml);
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
  check(existsSync(proofPath), "site/proof.html is missing; run npm run site:generate");
  check(existsSync(hardQuestionsPath), "site/hard-questions.html is missing; run npm run site:generate");
  check(existsSync(hooksPath), "site/hooks.html is missing; run npm run site:generate");
  check(existsSync(tiersPath), "site/tiers.html is missing; run npm run site:generate");
  check(existsSync(journeyPath), "site/journey.html is missing; run npm run site:generate");
  check(existsSync(day1OperationsPath), "site/day1-operations.html is missing; run npm run site:generate");
  check(existsSync(chartIndexPath), "site/charts/index.html is missing; run npm run site:generate");
  check(existsSync(catalogJsonPath), "site/catalog.json is missing; run npm run site:generate");
  check(existsSync(readmePath), "site/README.md is missing; run npm run site:generate");
  check(existsSync(generatedAtPath), "site/generated-at.txt is missing; run npm run site:generate");
  check(readFileSync(indexPath, "utf8") === site.indexHtml, "site/index.html is stale");
  check(readFileSync(offeringPath, "utf8") === site.offeringHtml, "site/offering.html is stale");
  check(readFileSync(tryPath, "utf8") === site.tryHtml, "site/try.html is stale");
  check(readFileSync(proofPath, "utf8") === site.proofHtml, "site/proof.html is stale");
  check(readFileSync(hardQuestionsPath, "utf8") === site.hardQuestionsHtml, "site/hard-questions.html is stale");
  check(readFileSync(hooksPath, "utf8") === site.hooksHtml, "site/hooks.html is stale");
  check(readFileSync(tiersPath, "utf8") === site.tiersHtml, "site/tiers.html is stale");
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
  const chartSkills = existsSync(chartSkillsJsonPath) ? JSON.parse(readFileSync(chartSkillsJsonPath, "utf8")).charts : [];
  const chartEvidenceRouter = existsSync(chartEvidenceRouterPath) ? parseCsv(readFileSync(chartEvidenceRouterPath, "utf8")) : [];
  check(existsSync(hardChartPacketsSummaryPath), "data/hard-chart-production-packets/summary.md is missing; run npm run hard-charts:packets");
  const baseReadinessByKey = new Map(baseReadiness.map((row) => [`${row.chart}|${row.base}`, row]));
  const bestBaseByChart = new Map(bestBaseRows(baseReadiness).map((row) => [row.chart, row]));
  const top100ReadinessWithSupport = applySupportDecisionNextActions(top100Readiness, productionSupportDecisions);
  const catalogEntries = top100.entries
    .filter((entry) => entry.proof_surface === "top20-catalog-supported")
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
      chartSkills: "data/chart-skills/skills.json",
      chartEvidenceRouter: "data/chart-evidence-router/router.csv",
    },
    commandRoutes: commandRoutes(),
    top500Evidence: top500.summary,
    summary: {
      catalogSupported: catalogEntries.length,
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
    chartSkills: publicChartSkills,
    chartEvidenceRouter: publicChartEvidenceRouter,
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
    proofHtml: proofHtml(catalog),
    hardQuestionsHtml: hardQuestionsHtml(catalog),
    hooksHtml: hooksHtml(catalog),
    tiersHtml: tiersHtml(catalog),
    journeyHtml: journeyHtml(catalog),
    day1OperationsHtml: day1OperationsHtml(catalog),
    chartIndexHtml: chartIndexHtml(catalog),
    chartPages,
    matrixHtml: readFileSync(join(repoRoot, "data", "master-catalog-matrix", "matrix.html"), "utf8"),
    readme: readme(),
  };
}

function generatedStamp(catalog, label) {
  return `<p class="generated"><b>Generated at:</b> ${escapeHtml(catalog.generatedAt)} UTC · source: committed helm-expt evidence for this ${escapeHtml(label)}.</p>`;
}

function html(catalog) {
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
    <nav class="topbar"><a class="brand" href="./index.html">helm-expt</a><span class="navlinks"><a href="./try.html">Try now</a><a href="./journey.html">Journey</a><a href="./charts/index.html">Charts</a><a href="./matrix.html">Status matrix</a><a href="./hard-questions.html">Hard questions</a><a href="./proof.html">Proof</a><a href="./hooks.html">Hooks</a><a href="./tiers.html">Tiers</a><a href="../data/README.md">Evidence</a><a href="../docs/user/what-we-refuse-to-claim.md">Refusals</a><a href="../README.md">Repository</a></span></nav>
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
        <h3><a href="./hard-questions.html">Hard questions before trust</a></h3>
        <p>Hooks, upgrades, custom values, target prerequisites, false-green sync, and what we still refuse to claim.</p>
        <span class="go"><a href="./hard-questions.html">Questions → evidence →</a></span>
      </div>
      <div class="door">
        <span class="kicker">Challenge it</span>
        <h3><a href="https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml">Send a problem chart</a></h3>
        <p>If a public chart, values file, hook, CRD, or live behavior breaks the model, send it. The response should be a fixture, receipt, named refusal, or routed gap.</p>
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
    <p>Tier boundaries and what each one proves are spelled out on the <a href="./tiers.html">tiers page</a>; planned tiers are plans, not shipped behavior - the <a href="../data/claims-register/summary.md">claims register</a> is the wording boundary.</p>
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
  const metric = (name) => catalog.statusMetrics.find((row) => row.metric === name) ?? {};
  const top100UserReadinessCounts = countBy(catalog.top100UserReadiness, "bucket");
  const publicCounters = [
    ["Catalog charts", `${catalog.summary.catalogSupported}/20`],
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
    ["Field provenance", "Blast-radius prediction is scored by a generated accuracy harness: 13 measured cases, 9 passing, 4 failing, and 0 unmeasured value-source rows. The claim remains per measured case; not every rendered field in every chart has provenance."],
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
    <nav class="topbar"><a class="brand" href="./index.html">helm-expt</a><span class="navlinks"><a href="./try.html">Try now</a><a href="./journey.html">Journey</a><a href="./charts/index.html">Charts</a><a href="./matrix.html">Status matrix</a><a href="./hard-questions.html">Hard questions</a><a href="./proof.html">Proof</a><a href="./hooks.html">Hooks</a><a href="./tiers.html">Tiers</a><a href="../data/README.md">Evidence</a><a href="../docs/user/what-we-refuse-to-claim.md">Refusals</a><a href="../README.md">Repository</a></span></nav>
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
  const redis = catalog.catalogEntries.find((entry) => entry.chart === "bitnami/redis");
  const kps = catalog.catalogEntries.find((entry) => entry.chart === "prometheus-community/kube-prometheus-stack");
  const kpsReadiness = catalog.baseReadiness.find(
    (row) => row.chart === "prometheus-community/kube-prometheus-stack@85.3.3" && row.base === "default",
  );
  const redisReadiness = catalog.baseReadiness.find((row) => row.chart === "bitnami/redis@25.5.3" && row.base === "default");
  const quickRows = [
    ["Quick render", "Use cub helm template when you only need to inspect one chart render."],
    ["One-shot ConfigHub load", "Use cub helm install when you want one render as ConfigHub Units right away."],
    ["Public catalog package", "Use cub installer when you want a maintained public base with proof."],
    ["ConfigHub account", "Upload rendered objects as Units, create derived variants, and use managed proof workflows."],
    ["Live cluster", "Apply generated manifests or run the live lanes when you want Kubernetes evidence."],
  ];
  const expectedRows = [
    ["After setup", "cub installer --help shows the installer commands.", "You can pull and render a public package."],
    ["After Redis render", "redis:verify-install:render prints PASS and writes a receipt.", "Your local render matches the catalog contract."],
    ["After ConfigHub upload", "The ConfigHub Space contains labeled Redis Units and the verifier prints PASS.", "The rendered objects became reviewable ConfigHub config."],
    ["After live evidence", "The matrix or receipt shows pass, watch, blocked, or refused with a reason.", "The claim is bounded to the target and does not rely on a green render alone."],
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
    .step { border-left: 3px solid var(--accent); padding-left: 12px; margin: 20px 0; }
    @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="hero">
    <nav class="topbar"><a class="brand" href="./index.html">helm-expt</a><span class="navlinks"><a href="./try.html">Try now</a><a href="./journey.html">Journey</a><a href="./charts/index.html">Charts</a><a href="./matrix.html">Status matrix</a><a href="./hard-questions.html">Hard questions</a><a href="./proof.html">Proof</a><a href="./hooks.html">Hooks</a><a href="./tiers.html">Tiers</a><a href="../data/README.md">Evidence</a><a href="../docs/user/what-we-refuse-to-claim.md">Refusals</a><a href="../README.md">Repository</a></span></nav>
    <h1>Try the catalog in three short paths.</h1>
    ${generatedStamp(catalog, "try-now page")}
    <p class="tagline">Start without a big commitment. Use Redis for the simplest happy path, then inspect kube-prometheus-stack to see the model on a serious Helm chart.</p>
    ${markdownLikeTable([
      ["Path", "What it proves"],
      ...quickRows,
    ])}
    ${markdownLikeTable([
      ["Stage", "What to check", "Why it matters"],
      ...expectedRows,
    ])}
    <p><a href="../docs/user/choose-your-path.md">Open the route picker</a> if you are deciding between direct Helm commands, public catalog packages, and ConfigHub-managed operations.</p>
  </header>
  <main>
    <section aria-labelledby="setup">
      <h2 id="setup">Setup</h2>
      <p>Clone the repo and check the public corpus first. There are no npm dependencies.</p>
      <pre>git clone https://github.com/confighub/helm-expt.git
cd helm-expt
npm run site:verify
npm run docs:verify</pre>
      <p>Install the ConfigHub installer plugin before running package setup commands.</p>
      <pre>cub version
cub plugin install confighub/installer
cub installer --help</pre>
    </section>

    <section aria-labelledby="fastest">
      <h2 id="fastest">Path 0: Fastest Look, No Catalog Needed</h2>
      <p>If you only want to see what a chart renders, you do not need this repo at all. These are the direct fast paths; the catalog paths below add reviewed bases, receipts, and live evidence on top.</p>
      <pre># See the exact objects a chart produces. No ConfigHub account.
cub helm template

# Load one Helm render into ConfigHub Units. Needs an account.
cub helm install</pre>
      <p>The trade-off: fast paths give you this render, today. The catalog paths give you a named, maintained base with render parity against regular Helm, scans, and committed live receipts.</p>
    </section>

    <section aria-labelledby="redis">
      <h2 id="redis">Path 1: Redis Happy Path</h2>
      <p>Redis is the small teaching chart. It shows the chart to recipe to base variant to exact rendered objects path.</p>
      <div class="split">
        <section class="card">
          <h3>Catalog status</h3>
          ${plainTable([
            ["Field", "Value"],
            ["Chart", redis ? `${redis.chart}@${redis.version}` : "bitnami/redis@25.5.3"],
            ["Start base", redis?.start_variant ?? "default"],
            ["Readiness", redisReadiness?.user_readiness ?? "start-here"],
            ["Reason", redisReadiness?.why ?? "all core lanes plus two-cluster parity pass for this base"],
          ])}
        </section>
        <section class="card">
          <h3>Run</h3>
          <pre>cub installer setup \\
  --pull packages/bitnami/redis/25.5.3 \\
  --base default \\
  --work-dir .tmp/demo/redis-default \\
  --non-interactive \\
  --namespace redis

npm run redis:verify-install:render -- \\
  --base default \\
  --work-dir .tmp/demo/redis-default \\
  --namespace redis</pre>
        </section>
      </div>
      <p>Expected result: the render verifier prints PASS and writes a receipt under <code>.tmp/verify-install/</code>. That proves your rendered Redis objects match the catalog acceptance contract.</p>
    </section>

    <section aria-labelledby="confighub">
      <h2 id="confighub">Path 2: Upload To ConfigHub</h2>
      <p>Use this when you want to see the rendered objects as ConfigHub Units. This requires an authenticated ConfigHub context.</p>
      <pre>cub auth login
cub context get -o json
cub installer upload \\
  --work-dir .tmp/demo/redis-default \\
  --space helm-redis-default \\
  --component Redis \\
  --layer App \\
  --environment Demo \\
  --owner ConfigHubHelm \\
  --variant default \\
  --unit-label Component=Redis \\
  --unit-label HelmChart=bitnami-redis \\
  --unit-label HelmChartVersion=25.5.3 \\
  --unit-label Variant=default

npm run redis:verify-install:confighub -- \\
  --base default \\
  --space helm-redis-default</pre>
      <p>Expected result: ConfigHub shows a <code>helm-redis-default</code> Space with labeled Redis Units. Open ConfigHub, choose the Space, then inspect Units and labels.</p>
    </section>

    <section aria-labelledby="kps">
      <h2 id="kps">Path 3: Serious Chart Check</h2>
      <p>Use kube-prometheus-stack to see why the catalog is more than a Redis demo. It includes CRDs, webhooks, RBAC, generated facts, dependency locks, extension slots, and target prerequisites.</p>
      <p>The important question is not only whether the YAML matches Helm. Render parity is the baseline. The serious-chart path also shows target facts and lifecycle prerequisites: compatible CRDs, admission webhook certificate material, and live observation boundaries that must be explicit before a config-only install can be trusted.</p>
      <div class="split">
        <section class="card">
          <h3>Catalog status</h3>
          ${plainTable([
            ["Field", "Value"],
            ["Chart", kps ? `${kps.chart}@${kps.version}` : "prometheus-community/kube-prometheus-stack@85.3.3"],
            ["Start base", kps?.start_variant ?? "default"],
            ["Readiness", kpsReadiness?.user_readiness ?? "start-here"],
            ["Reason", kpsReadiness?.why ?? "all core lanes plus two-cluster parity pass for this base"],
          ])}
        </section>
        <section class="card">
          <h3>Run</h3>
          <pre>npm run kube-prometheus-stack:verify-proof
npm run kube-prometheus-stack:verify-package
npm run kube-prometheus-stack:compare</pre>
        </section>
      </div>
      <p>Expected result: the chart proof and package checks pass. This checks the committed proof and package for the serious chart. Use the full live lanes when you need fresh cluster evidence.</p>
    </section>

    <section aria-labelledby="next">
      <h2 id="next">Next</h2>
      <div class="grid">
        <div class="card"><h3>Full tutorial</h3><p><a href="../docs/user/tutorial-sequence.md">Open the tutorial sequence</a>.</p></div>
        <div class="card"><h3>Can I use this chart?</h3><p><a href="../data/chart-use-guide/summary.md">Open the chart-use guide</a>.</p></div>
        <div class="card"><h3>Current proof</h3><p><a href="../docs/user/current-proof-status.md">Open current proof status</a>.</p></div>
        <div class="card"><h3>Catalog</h3><p><a href="./index.html">Open the generated catalog dashboard</a>.</p></div>
        <div class="card"><h3>Base readiness</h3><p><a href="../data/top20-base-readiness/summary.md">Open top-20 base readiness</a>.</p></div>
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
    <nav class="topbar"><a class="brand" href="./index.html">helm-expt</a><span class="navlinks"><a href="./try.html">Try now</a><a href="./journey.html">Journey</a><a href="./charts/index.html">Charts</a><a href="./matrix.html">Status matrix</a><a href="./hard-questions.html">Hard questions</a><a href="./proof.html">Proof</a><a href="./hooks.html">Hooks</a><a href="./tiers.html">Tiers</a><a href="../data/README.md">Evidence</a><a href="../README.md">Repository</a></span></nav>
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
  const questionRows = [
    [
      "Is this just Helm with extra paperwork?",
      "No. Helm still renders. The catalog turns selected render paths into durable installer packages with named bases, exact objects, scans, receipts, live evidence, and ConfigHub Units when uploaded.",
      "Start with command routing, then inspect a chart page.",
      "../docs/user/choosing-commands.md",
    ],
    [
      "Do I have to rewrite my charts?",
      "No. The point is to keep using public Helm charts where they are already the right source, then make selected install paths explicit, reviewable, variant-aware, and observable.",
      "Open the mission and variant guides.",
      "../docs/user/why-this-exists.md",
    ],
    [
      "Does it only work for easy charts?",
      "No. Redis teaches the path, but kube-prometheus-stack is the serious proof chart. It exercises CRDs, webhooks, RBAC, generated facts, extension slots, target prerequisites, upgrades, and live observations.",
      "Open the serious chart guide and the high-fanout evidence.",
      "../docs/user/serious-chart-proof.md",
    ],
    [
      "What happens to Helm hooks?",
      "They are not treated as ordinary static YAML. A hook or hook-like behavior must be observed, routed, marked per-target, blocked, or refused. A known route is not the same as automatic execution.",
      "Open the hooks page and route contract.",
      "./hooks.html",
    ],
    [
      "Where do Secrets and credentials live?",
      "They should not be hidden inside ConfigHub by accident. The catalog separates generated Secrets, existing-Secret references, target facts, and runtime Secret lifecycle where the chart requires that distinction.",
      "Open the secret lifecycle and target prerequisite evidence.",
      "../data/secret-lifecycle/summary.md",
    ],
    [
      "What if the cluster is the wrong shape?",
      "A green render is not enough. Some charts need CRDs, Secrets, storage classes, cloud identity, multiple schedulable nodes, API capabilities, or controller behavior that a generic cluster does not provide.",
      "Open target prerequisites before rerun.",
      "../docs/user/target-prerequisites-before-rerun.md",
    ],
    [
      "What if an upgrade caused a production crash?",
      "The model breaks the upgrade into old render, new render, object diff, blast-radius evidence, lifecycle checks, target prerequisites, gates, rehearsals, and receipts. It reduces opaque upgrades; it does not promise crash-free production.",
      "Read the upgrade crash example.",
      "../docs/user/helm-upgrade-crash-example.md",
    ],
    [
      "Can I bring my own values files or overlays?",
      "Yes, but the route matters. If a choice changes Helm inputs or object shape, it belongs in a new installer base or import path. If it refines an uploaded object set, it belongs in a derived ConfigHub variant.",
      "Open the custom overlay and variant guides.",
      "../docs/user/custom-overlays.md",
    ],
    [
      "Can I trust a green GitOps sync?",
      "Not by itself. Sync means the controller accepted the desired state. Workload convergence, target prerequisites, controller-owned fields, and semantic parity need separate evidence.",
      "Read why synced is not working.",
      "../docs/user/why-synced-is-not-working.md",
    ],
    [
      "What if I already use Argo, Flux, or KRM?",
      "That is the expected production shape, not a reason to start over. Desired objects, ConfigHub Units, OCI publication, GitOps controller health, and live workload evidence stay separate.",
      "Open adopting existing apps.",
      "../docs/user/adopting-existing-apps.md",
    ],
    [
      "What is free and what needs ConfigHub?",
      "Public catalog browsing, local render checks, and public package setup are free or low-friction. Private catalogs, teams, approvals, variants, promotions, fleet operations, and production responsibility are ConfigHub-managed.",
      "Open the journey and tiers pages.",
      "./journey.html",
    ],
    [
      "What should I do if this breaks on my chart?",
      "Send the public chart and values that expose the problem. The expected response is a fixture, receipt, watch row, routed gap, or named refusal.",
      "Use the problem-chart issue template.",
      "https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml",
    ],
  ];
  const proofRows = [
    ["Render parity rows", metricValue(metric("render parity rows")), "The installer path preserved regular Helm output for recorded inputs."],
    ["In-ConfigHub proof rows", metricValue(metric("in-ConfigHub proof rows")), "Rendered objects became ConfigHub Units with scan and safe-op evidence."],
    ["Local live rows", metricValue(metric("local live rows")), "A Kubernetes target applied and observed the rendered objects."],
    ["GitOps/OCI live pass rows", metricValue(metric("GitOps/OCI live pass rows")), "A GitOps controller pulled and reconciled ConfigHub-published OCI evidence."],
    ["Live Helm-vs-ConfigHub parity pass rows", metricValue(metric("live Helm-vs-ConfigHub parity pass rows")), "Regular Helm and ConfigHub delivery reached the same semantic live outcome."],
    ["Complete core lane rows", metricValue(metric("complete core lane rows")), "Rows with the main evidence lanes complete."],
  ];
  const boundaryRows = [
    ["Whole chart support", "No. Claims are per chart, version, base, lane, and target profile."],
    ["Whole values-space support", "No. Custom values need their own render, scan, receipt, and live evidence."],
    ["Universal hook execution", "No. Hook behavior is routed and observed where evidence exists; universal automatic execution is not claimed."],
    ["Production from render parity", "No. Production needs a target-scoped decision and fresh evidence."],
    ["Signatures as safety", "No. Signatures help with integrity and transport. Scans, policy, authority, and live evidence carry safety claims."],
  ];
  const decisionRows = [
    ["Use public catalog", "A reviewed base exists and the chart-use guide says it is ready to try."],
    ["Use plain Helm for now", "The chart is in a top-100 bucket that needs a better base variant or a limitation decision before the catalog is a better first path."],
    ["Create a new installer base", "Your values, overlay, CRD choice, Secret mode, storage mode, ingress shape, or extension slot changes Helm render inputs or object shape."],
    ["Create a derived ConfigHub variant", "Your change refines an uploaded object set: target, labels, approval gates, observation policy, links, or approved post-render field fills."],
    ["Ask for managed support", "The path involves private charts, private values, production SLAs, fleet operations, or target-scoped support decisions."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hard questions · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    <nav class="topbar"><a class="brand" href="./index.html">helm-expt</a><span class="navlinks"><a href="./try.html">Try now</a><a href="./journey.html">Journey</a><a href="./charts/index.html">Charts</a><a href="./matrix.html">Status matrix</a><a href="./hard-questions.html">Hard questions</a><a href="./proof.html">Proof</a><a href="./hooks.html">Hooks</a><a href="./tiers.html">Tiers</a><a href="../data/README.md">Evidence</a><a href="../README.md">Repository</a></span></nav>
    <h1>Hard questions before you trust the catalog.</h1>
    ${generatedStamp(catalog, "hard questions page")}
    <p class="tagline">This page is for a skeptical Helm user, platform engineer, or reviewer. It answers what the project proves, where it is still partial, and how to decide whether to use the public catalog, plain Helm, a new base variant, or ConfigHub-managed operations.</p>
  </header>
  <main>
    <section aria-labelledby="questions">
      <h2 id="questions">Questions A Helm User Will Ask</h2>
      ${markdownLikeTable([
        ["Question", "Short answer", "What to inspect", "Open"],
        ...questionRows.map(([question, answer, inspect, href]) => [question, answer, inspect, `<a href="${href}">${href}</a>`]),
      ], { rawThirdColumn: false, rawFourthColumn: true })}
    </section>

    <section aria-labelledby="evidence">
      <h2 id="evidence">Evidence That Should Change Your Mind</h2>
      <p>The strongest argument is not that every cell is green. The strongest argument is that each claim has a lane, each non-green row has a reason, and hard charts force target facts and lifecycle prerequisites into the open.</p>
      ${markdownLikeTable([
        ["Surface", "Current value", "What it means"],
        ...proofRows,
      ])}
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(top100UserReadinessCounts["ready-to-try"] ?? 0)}/100</strong><span>Top-100 ready-to-try charts</span></div>
        <div class="metric"><strong>${escapeHtml(top100UserReadinessCounts["works-with-target-prerequisites"] ?? 0)}/100</strong><span>Need target prerequisites</span></div>
        <div class="metric"><strong>${escapeHtml(top100UserReadinessCounts["works-with-operator-review"] ?? 0)}/100</strong><span>Need operator review</span></div>
        <div class="metric"><strong>${escapeHtml(top100UserReadinessCounts["needs-better-base-variant"] ?? 0)}/100</strong><span>Need better base variants</span></div>
        <div class="metric"><strong>${escapeHtml(catalog.summary.liveParityRerunSemanticDefects)}</strong><span>Semantic live parity defects in rerun queue</span></div>
      </div>
    </section>

    <section aria-labelledby="boundaries">
      <h2 id="boundaries">Boundaries We Should Keep Visible</h2>
      ${markdownLikeTable([
        ["Claim someone might assume", "Actual boundary"],
        ...boundaryRows,
      ])}
      <p>Use <a href="../data/claims-register/summary.md">the claims register</a> for the machine-checked wording boundary and <a href="../docs/user/what-we-refuse-to-claim.md">what we refuse to claim</a> for the shorter user explanation.</p>
    </section>

    <section aria-labelledby="decision">
      <h2 id="decision">Which Path Should A User Take?</h2>
      ${markdownLikeTable([
        ["Path", "Use it when"],
        ...decisionRows,
      ])}
      <p>The matrix and chart-use guide are the practical routing surfaces: <a href="./matrix.html">master matrix</a>, <a href="../data/chart-use-guide/summary.md">chart-use guide</a>, and <a href="../docs/user/reading-the-matrix.md">how to read the matrix</a>.</p>
    </section>

    <section aria-labelledby="hard">
      <h2 id="hard">Current Non-Green Work Should Stay Legible</h2>
      <p>These rows are not hidden failures. They are the next proof work, with owner class and reason attached.</p>
      ${markdownLikeTable([
        ["Chart", "Base", "Current", "Next step", "Reason"],
        ...nonGreenPreview,
      ])}
      <p>Open <a href="../data/status-dashboard/active-proof-queue.csv">the active proof queue</a> for the full generated list.</p>
    </section>

    <section aria-labelledby="challenge">
      <h2 id="challenge">How To Challenge The Project</h2>
      <p>If a public chart, values file, CRD behavior, hook, live result, or catalog command breaks the model, file it with public reproduction steps. A good response is a new fixture, a receipt, a watch row, a routed gap, or a named refusal.</p>
      <p><a href="https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml">Send a problem chart</a>.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. Hard questions should route to evidence, not slogans.</footer>
</body>
</html>
`;
}

function hooksHtml(catalog) {
  const routes = catalog.lifecycleRoutes;
  const dispositionCounts = countBy(routes, "disposition");
  const executionCounts = countBy(routes, "execution_mode");
  const autoCount = routes.filter((row) => isTruthyRouteFlag(row.safe_as_automatic)).length;
  const chartCount = new Set(routes.map((row) => `${row.chart}@${row.version}`)).size;
  const dispositionRows = Object.entries(dispositionCounts).map(([label, count]) => [label, String(count), dispositionMeaning(label)]);
  const executionRows = Object.entries(executionCounts).map(([label, count]) => [label, String(count), executionModeMeaning(label)]);
  const routeRows = routes.map((row) => [
    `${row.chart}@${row.version}`,
    row.quirk_class,
    row.disposition,
    row.route_name,
    row.execution_mode,
    isTruthyRouteFlag(row.safe_as_automatic) ? "yes" : "no",
    shortLifecycleEvidence(row.evidence_or_next_action),
  ]);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hooks & Lifecycle · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    <nav class="topbar"><a class="brand" href="./index.html">helm-expt</a><span class="navlinks"><a href="./try.html">Try now</a><a href="./journey.html">Journey</a><a href="./charts/index.html">Charts</a><a href="./matrix.html">Status matrix</a><a href="./hard-questions.html">Hard questions</a><a href="./proof.html">Proof</a><a href="./hooks.html">Hooks</a><a href="./tiers.html">Tiers</a><a href="../data/README.md">Evidence</a><a href="../README.md">Repository</a></span></nav>
    <h1>Where do Helm hooks and lifecycle behavior go?</h1>
    ${generatedStamp(catalog, "hooks and lifecycle page")}
    <p class="tagline">The catalog does not pretend Helm hooks are ordinary static YAML. It names the lifecycle behavior, the route, who executes it, and whether the product executes it automatically.</p>
    <p>Today a routed behavior means the route and off-ramp are visible. It does not mean universal automatic hook execution. A row becomes automatic only when the execution mode is product-owned and evidence proves that path.</p>
  </header>
  <main>
    <section aria-labelledby="headline">
      <h2 id="headline">Current Lifecycle Route Contract</h2>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(routes.length)}</strong><span>route rows from committed lifecycle data</span></div>
        <div class="metric"><strong>${escapeHtml(chartCount)}</strong><span>chart/version lifecycle behaviors represented</span></div>
        <div class="metric"><strong>${escapeHtml(autoCount)}</strong><span>rows safe to present as automatic</span></div>
        <div class="metric"><strong><a href="../data/lifecycle-routes/summary.md">open</a></strong><span>machine-readable route contract</span></div>
        <div class="metric"><strong><a href="./matrix.html">matrix</a></strong><span>route signal beside each catalog row</span></div>
      </div>
      <p>The low automatic count is deliberate. It keeps the public claim honest while still making the route useful to humans and agents.</p>
    </section>

    <section aria-labelledby="meanings">
      <h2 id="meanings">Disposition Means Claim</h2>
      ${markdownLikeTable([
        ["Disposition", "Rows", "Meaning"],
        ...dispositionRows,
      ])}
      <p><a href="../docs/reference/what-hook-support-means.md">Read the reference vocabulary</a> for the exact claim and refusal attached to each word.</p>
    </section>

    <section aria-labelledby="execution">
      <h2 id="execution">Execution Mode Means Who Runs It</h2>
      ${markdownLikeTable([
        ["Execution mode", "Rows", "Meaning"],
        ...executionRows,
      ])}
      <p>This is the important split for Helm users. Helm may run a hook implicitly. The catalog must say whether ConfigHub runs it, the target owns it, the user runs it as an explicit lifecycle action, or the route is not executable yet.</p>
    </section>

    <section aria-labelledby="route">
      <h2 id="route">How To Read A Route</h2>
      ${simpleList([
        ["Quirk", "What kind of lifecycle behavior was found: hook phase, CRD install, target fact, webhook readiness, or a related class."],
        ["Route", "Where the behavior belongs: preflight, presync, managed action, target-owned controller behavior, post-apply observation, or refusal."],
        ["Off-ramp", "How a human or agent chooses an alternative route when the default is not right for the target."],
        ["Evidence", "A receipt path when observed, or the next action when the route is still todo, per-target, or blocked by prerequisite work."],
      ])}
    </section>

    <section aria-labelledby="rows">
      <h2 id="rows">Route Rows</h2>
      ${markdownLikeTable([
        ["Chart", "Quirk", "Disposition", "Route", "Execution", "Auto", "Evidence or next action"],
        ...routeRows,
      ])}
    </section>

    <section aria-labelledby="next">
      <h2 id="next">What To Do With This</h2>
      <div class="grid">
        <div class="card"><h3>Trying a chart</h3><p>Open the chart page or matrix row. If lifecycle behavior exists, check the route and executor before treating a green render as a live install claim.</p></div>
        <div class="card"><h3>Creating a base</h3><p>If the behavior changes rendered objects or Helm values, create a recipe/base variant. If it is post-render operation, route it through ConfigHub or a target-owned controller.</p></div>
        <div class="card"><h3>Using GitOps</h3><p>Use Argo or Flux only when the route says the controller owns that lifecycle step or the receipt proves the selected sync path.</p></div>
        <div class="card"><h3>Automating later</h3><p>Do not mark a route automatic until product execution and evidence exist. Until then, keep the explicit route and off-ramp visible.</p></div>
        <div class="card"><h3>Finding evidence</h3><p>Use <a href="../data/lifecycle-routes/routes.json">routes.json</a>, <a href="../data/lifecycle-routes/summary.md">summary.md</a>, and the chart page's Hooks &amp; Lifecycle section.</p></div>
      </div>
    </section>
  </main>
  <footer>Generated from helm-expt lifecycle route data. Route visibility is not an automatic execution claim.</footer>
</body>
</html>
`;
}

function tiersHtml(catalog) {
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
    ["Operations", "Use ConfigHub variants, diffs, scans, changesets, approvals, OCI/GitOps, observations, upgrades, and rollbacks."],
  ];
  const commercialRows = [
    ["Hooks and lifecycle", "Inventory and route hooks publicly; paid support can provide target-scoped lifecycle execution, Argo jobs, preflight, or operator review."],
    ["Stacks", "Multiple recipes become one managed platform: for example monitoring, AI/RAG stacks, AICR, NIM, or customer platforms."],
    ["Bulk operations", "Bulk scan, patch, approve, promote, and observe across a fleet."],
    ["Legacy patches", "Maintain or patch older chart versions when upstream moved or broke compatibility."],
    ["Security and audit", "Signed artifacts, scan diffs, digest inventory, refresh SLAs, evidence packs, policy gates, and audit history."],
  ];
  const publicCounters = [
    ["Public catalog charts", `${catalog.summary.catalogSupported}/20`],
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
  <title>Tiers · ConfigHub Helm Catalog</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero">
    <nav class="topbar"><a class="brand" href="./index.html">helm-expt</a><span class="navlinks"><a href="./try.html">Try now</a><a href="./journey.html">Journey</a><a href="./charts/index.html">Charts</a><a href="./matrix.html">Status matrix</a><a href="./hard-questions.html">Hard questions</a><a href="./proof.html">Proof</a><a href="./hooks.html">Hooks</a><a href="./tiers.html">Tiers</a><a href="../data/README.md">Evidence</a><a href="../README.md">Repository</a></span></nav>
    <h1>Free to inspect. Managed when it becomes your estate.</h1>
    ${generatedStamp(catalog, "tiers page")}
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
      <h2 id="journey">User Journey</h2>
      <p>This page is the tier and boundary reference. The step-by-step path a user actually walks - inspect, serverless try-out with no account, first sign-up, ConfigHub Server try-out, day-2 operations, and where paid begins - is on the <a href="./journey.html">Journey page</a>, with the exact command at each stage.</p>
      ${markdownLikeTable([
        ["Stage", "What happens"],
        ...workRows,
      ])}
      <p>That journey keeps the fast Helm paths as useful ancestors. <code>cub helm template</code> and <code>cub helm install</code> are quick actions. <code>cub installer</code> packages are durable product artifacts. ConfigHub operations are where teams, approvals, variants, and day-2 work become valuable.</p>
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
        <div class="card"><h3>Support tiers</h3><p><a href="../docs/user/product-support-tiers.md">Open product support tiers</a>.</p></div>
        <div class="card"><h3>Commercial model</h3><p><a href="../docs/planning/verified-install-commercial-model.md">Open verified-install commercial model</a>.</p></div>
        <div class="card"><h3>Serverless plan</h3><p><a href="../docs/planning/serverless-verified-install-plan.md">Open serverless verified-install plan</a>.</p></div>
        <div class="card"><h3>Claims register</h3><p><a href="../data/claims-register/summary.md">Open current claim boundaries</a>.</p></div>
      </div>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. Commercial claims require product, support, key, policy, and SLA decisions beyond the public proof corpus.</footer>
</body>
</html>
`;
}

function journeyHtml(catalog) {
  const startCommand = `cub installer setup --pull packages/bitnami/redis/25.5.3 \\
  --base default --work-dir .tmp/redis \\
  --non-interactive --namespace redis`;
  const stages = [
    {
      n: "0",
      badge: "free · no account",
      badgeClass: "now",
      title: "Inspect - see the objects before any cluster",
      action: "cub helm template <chart>",
      code: null,
      get: "The exact Kubernetes objects a chart produces, plus this catalog's per-variant proof boundary on the <a href=\"./matrix.html\">status matrix</a> and <a href=\"./charts/index.html\">chart pages</a>. No install, no login.",
      next: "Pick a chart you actually run, then take the serverless try-out below.",
    },
    {
      n: "1",
      badge: "free · no account",
      badgeClass: "now",
      title: "Serverless try-out - verified install on your own machine",
      action: "cub installer setup --pull <package> --base <base>",
      code: startCommand,
      get: "<code>cub installer</code> pulls the reviewed package, renders it locally, and verifies it against the committed receipts. You apply the rendered manifests with plain <code>kubectl</code>/kustomize, and an in-cluster receipt records what actually landed. The whole proof machinery travels to your laptop - nothing is uploaded, no account exists yet.",
      next: "When one machine and one render stop being enough - a teammate, an overlay, a policy, durable shared state - sign up.",
    },
    {
      n: "2",
      badge: "free tier · first sign-up",
      badgeClass: "now",
      title: "First sign-up - your rendered chart becomes ConfigHub Units",
      action: "cub helm install  /  cub installer upload",
      code: "cub auth login\ncub helm install <chart> ...\n# or, after cub installer setup:\ncub installer upload --work-dir .tmp/redis --space helm-redis-default",
      get: "An account turns rendered objects into <strong>ConfigHub Units</strong>: durable, queryable desired state you can diff, label, and share. Use <code>cub helm install</code> for a fast one-shot Helm-to-ConfigHub load. Use <code>cub installer upload</code> after a reviewed catalog render. A future import path can graduate a one-shot render into a durable recipe/package candidate; it is not a current command here.",
      next: "Try the managed graph itself: derived variants, scans, and pull-based delivery.",
    },
    {
      n: "3",
      badge: "ConfigHub Server · try-out",
      badgeClass: "now",
      title: "ConfigHub Server try-out - the managed desired-state graph",
      action: "cub variant create  ·  scan  ·  OCI + GitOps",
      code: "cub variant create prod-us-east <upstream-space> \\\n  --environment Prod --region us-east \\\n  --target <target-space>/<target> \\\n  --namespace <namespace>\ncub variant promote <variant-space> --dry-run -o mutations",
      get: "Day-1 managed value, hands-on: derived variants from a base, object diffs, function scans and safe-ops, staging and promotion, content-addressed OCI delivery that an Argo or Flux controller reconciles, adopting an app you already run, and bringing a custom or private app. There is a lot here - the <a href=\"./day1-operations.html\">day-1 operations page</a> walks each one with its command and its free/paid boundary. The graph - not a pile of YAML - is now the source of truth.",
      next: "Once day-1 is comfortable, run it like an estate: approvals, live observation, upgrades.",
    },
    {
      n: "4",
      badge: "ConfigHub Server · day-2",
      badgeClass: "now",
      title: "Next steps with ConfigHub - day-2 operations",
      action: "promote · gate · observe · upgrade · roll back",
      code: null,
      get: "Approvals and policy gates before apply; promotion across environments, regions, and customers from one base; live observation with receipts (Helm-vs-ConfigHub parity, GitOps health); upgrades and rollbacks; and fleet-wide queries - \"where does this image run, and who changed that field?\" This is where the per-install story becomes an estate story.",
      next: "Where production responsibility and scale begin, paid features carry the weight.",
    },
    {
      n: "5",
      badge: "paid · planned where noted",
      badgeClass: "planned",
      title: "Paid features - SLA, private catalog, estate scale",
      action: "subscription · private catalog · Server at scale",
      code: null,
      get: "What is bought is the SLA and the queries, not the bits. <strong>Catalog subscription:</strong> guaranteed refresh cadence, CVE-response turnaround, the attestation pack per variant (SBOM, scan receipts, digest inventory, signatures), hardened variants, and old-version support. <strong>Private catalog:</strong> your own charts, wrapper charts, and overlays through the same render-scan-sign pipeline. <strong>ConfigHub Server at estate scale:</strong> fleet inventory, authority on every change, the ledger, gates before apply, continuous observation. Each tier's claim is backed by a receipt the tier below can re-run.",
      next: "See the full tier shape and boundaries on the Tiers page.",
    },
  ];
  const checkRows = [
    [
      "0 Inspect",
      "Rendered Kubernetes objects, CRDs, RBAC, images, Secrets model, and chart page status are visible before install.",
      "No ConfigHub state exists yet. This is inspection, not a managed catalog entry.",
    ],
    [
      "1 Serverless try-out",
      "`cub installer setup` exits cleanly, rendered manifests exist under the work directory, and local apply/observe checks match the chosen chart guide.",
      "If a namespace, image, CRD, or target prerequisite is wrong, the first-run guide should say so plainly.",
    ],
    [
      "2 First sign-up",
      "ConfigHub shows Units for the rendered object set, with labels, component grouping, and a space you can query or share.",
      "`cub helm install` is one-shot. `cub installer upload` is the reviewed catalog path. Import is future product work.",
    ],
    [
      "3 Server try-out",
      "A derived Space is created from an upstream Space, diffs are reviewable, scans/gates run, and OCI/GitOps delivery has its own health evidence.",
      "A green sync is not enough; workload readiness and semantic parity are separate checks.",
    ],
    [
      "4 Day-2 operations",
      "Promotion, approval, patch, upgrade, rollback, and observation actions have changesets or receipts a team can review.",
      "This is where blast radius, target facts, hooks, and lifecycle routes matter most.",
    ],
    [
      "5 Paid features",
      "The paid boundary is private inputs, production responsibility, fleet scale, SLA, policy, or support cadence.",
      "Planned tiers stay planned until the claims register and product surface back them.",
    ],
  ];
  const cards = stages
    .map(
      (s) => `      <div class="jstage" id="s${s.n}">
        <div class="jnum">${s.n}</div>
        <div class="jbody">
          <span class="badge ${s.badgeClass}">${escapeHtml(s.badge)}</span>
          <h3>${escapeHtml(s.title)}</h3>
          <p class="jaction"><code>${escapeHtml(s.action)}</code></p>
          ${s.code ? `<pre><code>${escapeHtml(s.code)}</code></pre>` : ""}
          <p>${s.get}</p>
          <p class="jnext"><strong>Next →</strong> ${s.next}</p>
        </div>
      </div>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>User journey · ConfigHub Helm Catalog</title>
  <style>${siteCss()}
    .jstage { display: grid; grid-template-columns: 44px 1fr; gap: 16px; padding: 18px 0; border-top: 1px solid var(--line); }
    .jstage:first-of-type { border-top: 0; }
    .jnum { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 1.4rem; font-weight: 700; color: var(--good); }
    .jbody h3 { margin: 6px 0 8px; font-size: 1.12rem; }
    .jaction { margin: 0 0 8px; }
    .jbody .badge { display: inline-block; border-radius: 999px; font-size: .72rem; padding: 2px 9px; border: 1px solid var(--line); }
    .jbody .badge.now { color: #fff; background: var(--good); border-color: var(--good); }
    .jbody .badge.planned { color: var(--muted); background: var(--panel); }
    .jnext { color: var(--muted); font-size: .92rem; }
    .ladder { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 6px; margin: 14px 0 4px; }
    .ladder a { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 8px 10px; font-size: .8rem; color: var(--ink); text-decoration: none; text-align: center; }
    .ladder a:hover { border-color: var(--accent); }
    @media (max-width: 760px) { .ladder { grid-template-columns: 1fr 1fr 1fr; } }
  </style>
</head>
<body>
  <header class="hero">
    <nav class="topbar"><a class="brand" href="./index.html">helm-expt</a><span class="navlinks"><a href="./try.html">Try now</a><a href="./journey.html">Journey</a><a href="./charts/index.html">Charts</a><a href="./matrix.html">Status matrix</a><a href="./hard-questions.html">Hard questions</a><a href="./proof.html">Proof</a><a href="./hooks.html">Hooks</a><a href="./tiers.html">Tiers</a><a href="../data/README.md">Evidence</a><a href="../README.md">Repository</a></span></nav>
    <h1>From a one-line try-out to a managed estate.</h1>
    ${generatedStamp(catalog, "user journey")}
    <p class="tagline">One path, six stages. Each stage names the exact action, what you get, and whether it is free, needs an account, or is paid - so you always know where the proof boundary and the price boundary are. The free stages are genuinely useful on their own; nothing here is a teaser that stops working until you pay.</p>
    <div class="ladder">
      <a href="#s0">0 · Inspect</a>
      <a href="#s1">1 · Serverless try-out</a>
      <a href="#s2">2 · First sign-up</a>
      <a href="#s3">3 · Server try-out</a>
      <a href="#s4">4 · Day-2 ops</a>
      <a href="#s5">5 · Paid</a>
    </div>
  </header>
  <main>
    <section aria-labelledby="stages">
      <h2 id="stages">The path</h2>
${cards}
    </section>

    <section aria-labelledby="checks">
      <h2 id="checks">What to check after each stage</h2>
      <p>The journey is useful only if each step leaves something concrete behind. These are the user-facing checks, not a replacement for the generated evidence.</p>
      ${markdownLikeTable([
        ["Stage", "User should see", "Boundary to remember"],
        ...checkRows,
      ])}
    </section>

    <section aria-labelledby="boundary">
      <h2 id="boundary">Free, account, paid - the boundary in one table</h2>
      ${markdownLikeTable([
        ["Stage", "Boundary", "What it costs you"],
        ["0 Inspect", "free, no account", "nothing - public pages and cub helm template"],
        ["1 Serverless try-out", "free, no account", "nothing - runs entirely on your machine"],
        ["2 First sign-up", "free tier", "a ConfigHub account; no payment for first hands-on use"],
        ["3 Server try-out", "free tier (limits apply)", "account/rate limits when server compute or stored receipts are used"],
        ["4 Day-2 operations", "free tier → paid as scope grows", "paid begins with production responsibility, private inputs, or fleet scale"],
        ["5 Paid features", "paid (planned where noted)", "an SLA subscription, a private catalog, or the Server product"],
      ])}
      <p>The exact tier shape and what is deliberately <em>not</em> sold too early are on the <a href="./tiers.html">Tiers page</a>; the commercial model and the serverless plan are linked there. Planned features are described as plans, not shipped behavior - the <a href="../data/claims-register/summary.md">claims register</a> is the wording boundary.</p>
    </section>

    <section aria-labelledby="start">
      <h2 id="start">Start now</h2>
      <p>Stage 1 needs nothing but a cluster you can reach (a local kind cluster is fine) and the <code>cub</code> CLI:</p>
      <pre><code>${escapeHtml(startCommand)}</code></pre>
      <p><a href="./try.html">Full try-now walkthrough</a> · <a href="./charts/index.html">browse the catalog</a> · <a href="./matrix.html">check a chart's proof status first</a>.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. Free stages are usable without payment; paid and planned tiers require product, key, policy, and SLA decisions beyond the public proof corpus.</footer>
</body>
</html>
`;
}

function day1OperationsHtml(catalog) {
  const ops = [
    {
      title: "Create a derived variant",
      status: "available",
      boundary: "ConfigHub · free tier",
      action: "cub variant create <name> <upstream-space>",
      code: "cub variant create prod-us-east <upstream-space> \\\n  --environment Prod --region us-east \\\n  --target <target-space>/<target> \\\n  --namespace <namespace>",
      get: "A derived ConfigHub variant refines an uploaded base for a target, environment, region, or customer - without running Helm again and without a new installer base. This is the day-1 customization most teams need first.",
      see: ["creating-variants.md", "cub-variant-command-surface.md"],
    },
    {
      title: "Diff before you ship",
      status: "available",
      boundary: "ConfigHub · free tier",
      action: "review the variant's object diff vs its base",
      code: null,
      get: "Every derived variant carries an exact, reviewable object diff against the base it came from - so a reviewer sees precisely which objects and fields a change touches before anything is delivered. This is the opposite of a values file you have to mentally render.",
      see: ["change-routing-before-oci.md"],
    },
    {
      title: "Scan and gate",
      status: "available",
      boundary: "free locally · paid for managed policy",
      action: "function scans + safe-ops over rendered objects",
      code: null,
      get: "Run policy/function scans over the rendered objects (privilege, capabilities, exposure, deprecated APIs) and safe operations, and hold delivery behind a gate until findings are accepted or waived with a named reason. The scan receipts carry the safety-relevant findings; signing proves origin, not safety.",
      see: ["../data/external-scan-lane/summary.md"],
    },
    {
      title: "Stage and promote across environments",
      status: "watch",
      boundary: "ConfigHub Server",
      action: "cub variant promote <space>",
      code: "cub variant promote <space> --dry-run -o mutations\ncub variant promote <space>",
      get: "Promotion moves a downstream variant toward its upstream Space as a first-class ConfigHub operation. The current receipts prove the core mechanics on Redis, NGINX, and kube-prometheus-stack: preview, changed Unit catch-up, and newly added Unit cloning. The status is watch because the changeset-bound path currently hits a server error; use the matrix V column and variant-promotion status before treating it as a production gate.",
      see: ["../data/variant-promotion/summary.md", "prometheus-overlay-promotion-example.md"],
    },
    {
      title: "Deliver via OCI + GitOps",
      status: "available",
      boundary: "free to run · standard Argo/Flux",
      action: "publish content-addressed OCI; a controller reconciles",
      code: null,
      get: "Publish the variant as a content-addressed OCI artifact (digest-pinned), and let an Argo or Flux controller pull and reconcile it - pull-based, drift-resistant delivery with the artifact identity fixed. A green local apply is not the same as the controller reconciling; both are recorded separately.",
      see: ["chain-of-proof.md", "../data/runtime-gitops/summary.md"],
    },
    {
      title: "Adopt an app you already run",
      status: "available",
      boundary: "ConfigHub · free tier",
      action: "cub gitops discover  /  cub gitops import",
      code: "cub gitops discover\ncub gitops import <app>",
      get: "Existing Argo, Flux, KRM, rendered-manifest, and live-resource apps enter the model without a rewrite: discover what is running, import it to ConfigHub Units, and from there it gains the same variants, diffs, scans, and observation as a catalog chart.",
      see: ["adopting-existing-apps.md"],
    },
    {
      title: "Bring a custom or private app",
      status: "available locally · private catalog is paid",
      boundary: "free for your own charts · paid for managed private catalog",
      action: "wrapper charts, platform values, customer overlays, internal charts",
      code: null,
      get: "Your own charts - wrapper charts, platform values, customer overlay values, internal-only charts - run through the same render → scan → sign pipeline as the public catalog. Doing it on your machine is free; a managed private catalog (private OCI sources, private refresh SLAs) is the paid lane.",
      see: ["custom-overlays.md", "product-support-tiers.md"],
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
  <title>Day-1 operations · ConfigHub Helm Catalog</title>
  <style>${siteCss()}
    .op { border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin: 14px 0; }
    .ophead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .ophead h3 { margin: 0; font-size: 1.08rem; }
    .opmeta { margin: 6px 0 8px; }
    .op .badge { display: inline-block; border-radius: 999px; font-size: .72rem; padding: 2px 9px; border: 1px solid var(--line); white-space: nowrap; }
    .op .badge.now { color: #fff; background: var(--good); border-color: var(--good); }
    .op .badge.watch { color: #2d2300; background: #f9ab00; border-color: #f9ab00; }
    .op .badge.planned { color: var(--muted); background: var(--panel); }
    .muted { color: var(--muted); }
    @media (max-width: 600px) { .ophead { flex-direction: column; } }
  </style>
</head>
<body>
  <header class="hero">
    <nav class="topbar"><a class="brand" href="./index.html">helm-expt</a><span class="navlinks"><a href="./try.html">Try now</a><a href="./journey.html">Journey</a><a href="./charts/index.html">Charts</a><a href="./matrix.html">Status matrix</a><a href="./hard-questions.html">Hard questions</a><a href="./proof.html">Proof</a><a href="./hooks.html">Hooks</a><a href="./tiers.html">Tiers</a><a href="../data/README.md">Evidence</a><a href="../README.md">Repository</a></span></nav>
    <h1>Day-1 operations - the work between a first variant and a running estate.</h1>
    ${generatedStamp(catalog, "day-1 operations")}
    <p class="tagline">This is the expansion of <a href="./journey.html">journey</a> Stage 3. Once a rendered chart is in ConfigHub as Units, these are the day-1 operations a team actually performs - each with its command, what it gives you, and whether it is available, watch, planned, free, or paid. Available is green; watch is amber and names a current limitation; planned product lanes are grey and described as plans, not shipped behavior (the <a href="../data/claims-register/summary.md">claims register</a> is the wording boundary).</p>
  </header>
  <main>
    <section aria-labelledby="ops">
      <h2 id="ops">The operations</h2>
${cards}
    </section>
    <section aria-labelledby="next">
      <h2 id="next">Then: day-2 and beyond</h2>
      <p>When these are routine, the work becomes day-2 and estate-scale: approvals and policy gates before apply, live observation with receipts, upgrades and rollbacks, and fleet-wide queries. That is <a href="./journey.html#s4">Stage 4 of the journey</a>; where it carries production responsibility, the <a href="./tiers.html">paid tiers</a> take over.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. Available operations run today; watch operations have evidence plus a named limitation; planned lanes require product, key, policy, and SLA decisions beyond the public proof corpus.</footer>
</body>
</html>
`;
}

function chartIndexHtml(catalog) {
  const rows = catalog.catalogEntries.map((entry) => [
    `<a href="./${chartPageFileName(entry)}">${entry.chart}</a>`,
    entry.version,
    entry.start_variant,
    entry.supported_variants,
    entry.start_base_readiness || "see chart page",
    productionSummaryForChart(catalog, entry)?.production_support ?? entry.production_readiness,
  ]);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ConfigHub Helm Chart Pages</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header>
    <nav class="topbar"><a class="brand" href="../index.html">helm-expt</a><span class="navlinks"><a href="../try.html">Try now</a><a href="../journey.html">Journey</a><a href="./index.html">Charts</a><a href="../matrix.html">Status matrix</a><a href="../hard-questions.html">Hard questions</a><a href="../proof.html">Proof</a><a href="../hooks.html">Hooks</a><a href="../tiers.html">Tiers</a><a href="../../data/README.md">Evidence</a><a href="../../README.md">Repository</a></span></nav>
    <h1>Catalog Chart Pages</h1>
    ${generatedStamp(catalog, "chart index")}
    <p class="tagline">One public page per catalog-supported chart: base variants, proof lanes, production boundary, quirks, and artifact links.</p>
  </header>
  <main>
    <section aria-labelledby="charts">
      <h2 id="charts">Charts</h2>
      ${markdownLikeTable([
        ["Chart", "Version", "Start base", "Supported bases", "Start status", "Production disposition"],
        ...rows,
      ], { rawFirstColumn: true })}
    </section>
  </main>
  <footer>Generated from helm-expt catalog data. Do not edit by hand.</footer>
</body>
</html>
`;
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
  const production = productionSummaryForChart(catalog, entry);
  const support = catalog.productionSupportDecisions.find((row) => row.chart === entry.chart && row.version === entry.version);
  const chartUse = catalog.chartUseGuide.find((row) => row.chart === chartKey);
  const top100 = catalog.top100Readiness.find((row) => row.chart === chartKey);
  const userReadiness = catalog.top100UserReadiness.find((row) => row.chart === entry.chart && row.version === entry.version);
  const chartSkill = catalog.chartSkills.find((row) => row.chart === entry.chart && row.version === entry.version);
  const evidenceRoute = catalog.chartEvidenceRouter.find((row) => row.chart === entry.chart && row.version === entry.version);
  const extension = catalog.extensionSlots.find((row) => row.chart === chartKey);
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
  const artifactRows = [
    ["Chart catalog", entry.catalog_path],
    ["Recipe", entry.recipe_path],
    ["Package", entry.package_path],
    ["Helm pain report", entry.helm_pain_report],
    ["Production disposition", "data/production-disposition/summary.md"],
    ["Support decision", support?.path ?? ""],
    ["Top-20 base readiness", "data/top20-base-readiness/summary.md"],
    ["Chart skills", "data/chart-skills/summary.md"],
    ["Chart evidence router", "data/chart-evidence-router/summary.md"],
    ["Current proof status", "docs/user/current-proof-status.md"],
  ].filter(([, path]) => path);
  const openDispositions = splitDisposition(production?.open_dispositions);
  const acceptedDispositions = splitDisposition(production?.accepted_dispositions);
  const lanes = [
    ["Render parity", allBaseStatus(baseRows, "render_parity")],
    ["ConfigHub proof", allBaseStatus(baseRows, "in_confighub")],
    ["Local live", allBaseStatus(baseRows, "local_live")],
    ["GitOps/OCI live", allBaseStatus(baseRows, "gitops_oci_live")],
    ["Live Helm-vs-ConfigHub", allBaseStatus(baseRows, "live_helm_vs_confighub_parity")],
    ["Two-cluster kind", allBaseStatus(baseRows, "two_cluster_kind_parity")],
  ];
  const lifecycleRoutes = catalog.lifecycleRoutes.filter((row) => row.chart === entry.chart);
  const lifecycleRows = lifecycleRoutes.map((row) => [
    row.quirk_class,
    row.route_name,
    executionModePlain(row.execution_mode),
    (row.alternatives ?? []).map((alt) => alt.route).join(", ") || "-",
    isTruthyRouteFlag(row.safe_as_automatic) ? "yes" : "no",
  ]);
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
    <nav class="topbar"><a class="brand" href="../index.html">helm-expt</a><span class="navlinks"><a href="../try.html">Try now</a><a href="../journey.html">Journey</a><a href="./index.html">Charts</a><a href="../matrix.html">Status matrix</a><a href="../hard-questions.html">Hard questions</a><a href="../proof.html">Proof</a><a href="../hooks.html">Hooks</a><a href="../tiers.html">Tiers</a><a href="../../data/README.md">Evidence</a><a href="../../README.md">Repository</a></span></nav>
    <h1>${escapeHtml(entry.chart)}</h1>
    ${generatedStamp(catalog, "chart status page")}
    <p class="mono" style="font-size:.85rem">ecosystem: <a href="https://artifacthub.io/packages/search?ts_query_web=${encodeURIComponent(entry.chart.split("/").at(-1))}&amp;kind=0" rel="noopener">find this chart on Artifact Hub</a> · <a href="https://helm.sh/docs/" rel="noopener">Helm docs</a> - discovery and tooling live upstream; this page adds the proof.</p>
    <p class="tagline">Public catalog page for ${escapeHtml(entry.chart)}@${escapeHtml(entry.version)}.</p>
    <pre>${escapeHtml(entry.start_command || `cub installer setup --pull ${entry.package_path} --base ${entry.start_variant} --work-dir <tmp> --non-interactive`)}</pre>
  </header>
  <main>
    <section aria-labelledby="summary">
      <h2 id="summary">What To Use</h2>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(entry.start_variant)}</strong><span>Recommended first base</span></div>
        <div class="metric"><strong>${escapeHtml(entry.variant_count)}</strong><span>Supported base variants</span></div>
        <div class="metric"><strong>${escapeHtml(entry.start_base_readiness || "see bases")}</strong><span>Start-base status</span></div>
        <div class="metric"><strong>${escapeHtml(production?.production_support ?? entry.production_readiness)}</strong><span>Production disposition</span></div>
      </div>
      <p>${escapeHtml(chartUse?.plain_english ?? "Use the public catalog entry, then check the exact base and proof lane before making a production claim.")}</p>
      ${markdownLikeTable([
        ["Question", "Answer"],
        ["Supported version", entry.version],
        ["Latest upstream seen", entry.latest_status === "update-available" ? `${entry.latest_version} (update candidate)` : entry.latest_version || "not checked"],
        ["Supported bases", entry.supported_variants],
        ["Not yet enabled", entry.not_yet_enabled || "none recorded"],
        ["Namespace", entry.namespace || "chart default"],
      ])}
    </section>

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
        ...proofRows,
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
      <h2 id="lifecycle">Hooks &amp; Lifecycle Routes</h2>
      <p>Where each hook or hook-like behavior goes, who runs it, and whether the installer runs it automatically. No route is auto-executed today, so <strong>safe-to-automate stays <code>no</code></strong> until execution is the product's and proven. Details (optional): <a href="../../data/lifecycle-routes/summary.md">lifecycle-routes</a>.</p>
      ${lifecycleRows.length
        ? markdownLikeTable([
            ["Behavior", "Route", "Who runs it", "Off-ramps", "Safe to automate?"],
            ...lifecycleRows,
          ])
        : "<p>No hook or hook-like lifecycle behavior is recorded for this chart.</p>"}
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
    .topbar {
      position: sticky; top: 0; z-index: 50;
      display: flex; align-items: baseline; gap: 18px;
      max-width: 1180px; margin: 0 auto; padding: 12px 20px;
      background: rgba(255,255,255,.92); backdrop-filter: blur(6px);
      border-bottom: 1px solid var(--line);
      font-size: .92rem;
    }
    .topbar .brand {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-weight: 700; color: var(--ink); text-decoration: none; letter-spacing: 0;
    }
    .topbar .brand::before { content: "▣ "; color: var(--good); }
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
    .tagline { font-size: 1.08rem; color: var(--ink); max-width: 880px; }
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
    .status { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .8rem; border: 1px solid var(--line); }
    .status.good { color: var(--good); border-color: #9bd3b8; background: #f0fbf5; }
    .status.warn { color: var(--warn); border-color: #efca92; background: #fff8ed; }
    .lanes, .stage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .lane { background: var(--panel); }
    .bar { height: 7px; border-radius: 999px; background: #e3e9ef; overflow: hidden; margin-top: 12px; }
    .bar span { display: block; height: 100%; background: var(--good); }
    table { border-collapse: collapse; width: 100%; font-size: .9rem; }
    th, td { border: 1px solid var(--line); padding: 6px 9px; text-align: left; vertical-align: top; }
    thead th { background: var(--panel); position: sticky; top: 49px; }
    footer { color: var(--muted); border-top: 1px solid var(--line); margin-top: 40px; font-size: .9rem; }
    @media (max-width: 980px) {
      .doors, .chain, .tiers, .grid, .catalog, .lanes { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 640px) {
      .doors, .chain, .tiers, .grid, .catalog, .lanes { grid-template-columns: 1fr; }
      .card dl { grid-template-columns: 1fr; }
      .topbar { flex-wrap: wrap; }
      .navlinks { margin-left: 0; }
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
Open \`site/try.html\` for the short try-now page.
Open \`site/hard-questions.html\` for the skeptical user route: hooks, upgrades,
custom values, target prerequisites, false-green sync, and refusal boundaries.
Open \`site/proof.html\` for the proof lanes, sceptic tests, and refusal boundary.
Open \`site/hooks.html\` for hook and lifecycle route dispositions.
Open \`site/tiers.html\` for the free, authenticated, managed, and enterprise tier shape.
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
