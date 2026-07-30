import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, posix } from "node:path";

import { check, readYaml, repoRoot, write } from "./lib/proof-common.mjs";
import { installerOciRef } from "./lib/installer-oci.mjs";

const siteRoot = join(repoRoot, "site");
const chartPagesRoot = join(siteRoot, "charts");
const indexPath = join(siteRoot, "index.html");
const offeringPath = join(siteRoot, "offering.html");
const tryPath = join(siteRoot, "try.html");
const redisWalkthroughPath = join(siteRoot, "redis-walkthrough.html");
const serverlessPath = join(siteRoot, "serverless.html");
const howItWorksPath = join(siteRoot, "how-it-works.html");
const variantsPath = join(siteRoot, "variants.html");
const customAppsPath = join(siteRoot, "custom-apps.html");
const existingAppsPath = join(siteRoot, "existing-apps.html");
const aiPath = join(siteRoot, "ai.html");
const securityPath = join(siteRoot, "security.html");
const testingPath = join(siteRoot, "testing.html");
const entryPathReferencePath = join(siteRoot, "entry-path-reference.html");
const futurePath = join(siteRoot, "future.html");
const operationsPath = join(siteRoot, "operations.html");
const docsPath = join(siteRoot, "docs.html");
const verificationPath = join(siteRoot, "verification.html");
const proofPath = join(siteRoot, "proof.html");
const quirksPath = join(siteRoot, "quirks.html");
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
const helmRenderIntentsPath = join(repoRoot, "data", "helm-render-intents", "intents.csv");
const demoProgramPath = join(repoRoot, "data", "demo-program", "program.json");
const helmCatalogReadmesPath = join(repoRoot, "data", "helm-catalog-readmes", "readmes.csv");
const installerOciCatalogPath = join(repoRoot, "data", "installer-oci-packages", "packages.csv");
const applyPolicyProfilePath = join(repoRoot, "config-catalog", "policies", "catalog-standard.yaml");
const applyPolicyLiveReceiptPath = join(repoRoot, "data", "apply-policy-profiles", "live-helm-catalog.yaml");
const lifecycleByVariantJsonPath = join(repoRoot, "data", "lifecycle-routes-by-variant", "by-variant.json");
const gitopsRouteEmissionJsonPath = join(repoRoot, "data", "gitops-route-emission", "emission.json");
const chartSkillsJsonPath = join(repoRoot, "data", "chart-skills", "skills.json");
const chartEvidenceRouterPath = join(repoRoot, "data", "chart-evidence-router", "router.csv");
const masterCatalogMatrixPath = join(repoRoot, "data", "master-catalog-matrix", "matrix.csv");
const cubAdoptionCaveatsPath = join(repoRoot, "data", "cub-adoption-caveats", "caveats.csv");
const UNKNOWN_ACTION_LABELS = {
  "create-namespace": "choose and create the target namespace",
  "install-crds": "install the chart's CRDs first",
  "operator-review": "complete the operator review",
  "provide-external-service": "provide the required external service",
  "stage-secret": "stage the required Secret",
  "unknown-preflight": "run the preflight checks",
};
const REDIS_INSTALLER_OCI_REF = installerOciRef("bitnami/redis", "25.5.3");
const REDIS_27_INSTALLER_OCI_REF = installerOciRef("bitnami/redis", "27.0.0");
const REDIS_IMAGE_DIGEST =
  "sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25";
const PROMETHEUS_INSTALLER_OCI_REF = installerOciRef("prometheus-community/prometheus", "29.8.0");
const INSTALLER_OCI_AUTH_NOTE =
  "Public catalog package refs are published in Google Artifact Registry with anonymous read access. No ConfigHub account or Google registry login is needed for the local setup path.";
const CONFIGHUB_SIGNUP_URL = "https://hub.confighub.com";
const CONFIGHUB_ENTERPRISE_URL = "https://confighub.com";
const CONFIGHUB_DOCS_SETUP_URL = "https://docs.confighub.com/get-started/setup/";
const CONFIGHUB_TUTORIAL_URL = "https://docs.confighub.com/get-started/tutorial/";
const CUB_CLI_INSTALL_COMMAND = "curl -fsSL https://hub.confighub.com/cub/install.sh | bash";
const INSTALLER_PLUGIN_INSTALL_COMMAND =
  "cub plugin install confighub/installer";
const KUSTOMIZE_INSTALL_URL =
  "https://kubectl.docs.kubernetes.io/installation/kustomize/";
const CATALOG_OCI_DELIVERY_RECEIPT =
  "runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml";
const CATALOG_OCI_DELIVERY_SUMMARY = "data/catalog-oci-delivery-proof/summary.md";
// Single source for what the public installer command does. Every page and
// generated script that shows the command must distinguish local rendering
// from delivery to Kubernetes. Keep this free of single quotes, percent signs,
// and backslashes; it is embedded in shell printf strings.
const INSTALLER_COMMAND_NOTE =
  "cub installer is a released, open-source plugin for the cub CLI. cub installer setup pulls a catalog package and writes its Kubernetes files locally. It does not apply those files to a cluster; use kubectl, Argo CD, or Flux for delivery.";
const SITE_FEEDBACK_ISSUE_URL = "https://github.com/confighub/helm-expt/issues/new?template=site-feedback.yml";
// Single source for the public URL of the generated site; a future domain
// move is one edit here.
const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const sitemapPath = join(siteRoot, "sitemap.xml");
const robotsPath = join(siteRoot, "robots.txt");
const llmsPath = join(siteRoot, "llms.txt");
const docPagesRoot = join(siteRoot, "d");
const demoOrgPath = join(siteRoot, "demo-org.html");

function confighubOutboundUrl(baseUrl, campaign) {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/?utm_source=helm-expt&amp;utm_medium=site&amp;utm_campaign=${campaign}`;
}

function signupLink(campaign, label) {
  return `<a href="${confighubOutboundUrl(CONFIGHUB_SIGNUP_URL, campaign)}">${label}</a>`;
}

function productDocsPointer(campaign) {
  return `<p>New to ConfigHub? Follow the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, campaign)}">official ConfigHub tutorial</a>. It covers one component, a release, a change, production, and promotion. This site provides the public catalog and its evidence.</p>`;
}

const SITE_PAGE_RELPATHS = {
  indexHtml: "index.html",
  offeringHtml: "offering.html",
  tryHtml: "try.html",
  redisWalkthroughHtml: "redis-walkthrough.html",
  serverlessHtml: "serverless.html",
  howItWorksHtml: "how-it-works.html",
  variantsHtml: "variants.html",
  customAppsHtml: "custom-apps.html",
  existingAppsHtml: "existing-apps.html",
  aiHtml: "ai.html",
  securityHtml: "security.html",
  pillarsHtml: "testing.html",
  entryPathReferenceHtml: "entry-path-reference.html",
  futureHtml: "future.html",
  operationsHtml: "operations.html",
  docsHtml: "docs.html",
  verificationHtml: "verification.html",
  proofHtml: "proof.html",
  quirksHtml: "quirks.html",
  hardQuestionsHtml: "hard-questions.html",
  knownGapsHtml: "known-gaps.html",
  hooksHtml: "hooks.html",
  privateHtml: "private/index.html",
  tiersRedirectHtml: "tiers.html",
  journeyHtml: "journey.html",
  day1OperationsHtml: "day1-operations.html",
  chartIndexHtml: "charts/index.html",
  demoOrgHtml: "demo-org.html",
  matrixHtml: "matrix.html",
};

// Redirect stubs: canonical points at the target and they stay out of the sitemap.
const PAGE_REDIRECT_TARGETS = {
  "hooks.html": "charts/index.html",
  "tiers.html": "private/index.html",
  "day1-operations.html": "operations.html",
};

// One sentence per page, drawn from the page's lead copy. Chart pages derive
// theirs from the page title.
const PAGE_DESCRIPTIONS = {
  "index.html": "Inspect and test configuration from Helm, AICR, OCI, or Kubernetes YAML, then keep it local or manage it in ConfigHub.",
  "offering.html": "Public Helm charts in visible and verifiable stages: keep the chart as the source and make the rendered config reviewable and safer to operate.",
  "try.html": "Render one public Redis catalog package, inspect its exact Kubernetes objects, and choose local, anonymous, or managed ConfigHub use.",
  "redis-walkthrough.html": "Follow the full Redis example through public package pulls, Helm parity, OCI output, upgrade, promotion, rollout, and rollback.",
  "serverless.html": "Run a public catalog package without ConfigHub Server. This example also needs no ConfigHub account, and keeps the rendered objects under your control.",
  "how-it-works.html": "The recipe is your source of truth: how render, record, and route stages keep a Helm chart reviewable through changes and upgrades.",
  "variants.html": "Same chart, but change one thing: when a values change is a new base variant and when it belongs in a derived ConfigHub variant.",
  "custom-apps.html": "Bring the applications your team owns alongside public charts so a release can move as one reviewed set.",
  "existing-apps.html": "Start read-only with your existing Argo or Flux apps and live clusters, then add review and receipts around what already runs.",
  "ai.html": "AI and the catalog: AI can suggest chart changes, but tests and receipts decide what lands.",
  "security.html": "Security and provenance across the catalog: Secrets handling, scans and gates, and the claims register.",
  "testing.html": "Working examples for Helm, AICR, OCI, Kubernetes YAML, promotions, delivery, platforms, and ConfigHub Apps.",
  "entry-path-reference.html": "Detailed entry paths for Helm, AICR, existing OCI, and Kubernetes YAML, with commands and proof links.",
  "future.html": "What exists in the public experiment today, and which managed ideas are roadmap on purpose.",
  "operations.html": "Ops starts when an app already exists: see what changed, review diffs, and promote with gates and receipts.",
  "docs.html": "The docs and FAQ index: start here for guides, verification notes, technical references, and per-chart cub adoption caveats.",
  "verification.html": "Verification for the catalog: product commands and proof commands, committed evidence and fresh live parity you can run yourself.",
  "proof.html": "How to read the proof corpus: receipts, scans, render records, and live evidence for each catalog chart.",
  "quirks.html": "Helm quirks in plain words: hooks, CRDs, generated Secrets, and the other extras charts leave around the edges.",
  "hard-questions.html": "Hard questions answered plainly: what breaks, what is safe for AI to change, and where the gaps are.",
  "known-gaps.html": "The gaps we surface on purpose, from fixed placeholder credentials to SSA conflict ergonomics.",
  "hooks.html": "The hooks page moved: hook and setup work now lives on the catalog page action cards.",
  "tiers.html": "The tiers page moved: commercial options now live on the private page.",
  "day1-operations.html": "The day-1 operations page moved: operations guidance now lives on the Ops page.",
  "private/index.html": "Upgrade to ConfigHub: the commercial edition for private charts, teams, policies, fleet operations, and production support.",
  "journey.html": "Apps on ConfigHub: install public charts, bring the applications your team owns, and keep approved changes through updates.",
  "charts/index.html": "The Helm Ops Catalog: pick a chart, choose a base variant, and read its rendered objects, checks, and evidence.",
  "demo-org.html": "The demo org: ten catalog charts living in a real ConfigHub organization, with version ladders, a fleet, secrets and CRD stories, and live checks.",
  "matrix.html": "The master catalog matrix: one row per chart, version, and base with lane dispositions, hooks, quirks, and next actions.",
};
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const generatedAt = process.env.HELM_EXPT_SITE_GENERATED_AT || new Date().toISOString();
  const site = buildSite(generatedAt);
  rmSync(chartPagesRoot, { recursive: true, force: true });
  rmSync(privateRoot, { recursive: true, force: true });
  rmSync(docPagesRoot, { recursive: true, force: true });
  rmSync(join(siteRoot, "sh"), { recursive: true, force: true });
  write(indexPath, site.indexHtml);
  write(offeringPath, site.offeringHtml);
  write(tryPath, site.tryHtml);
  write(redisWalkthroughPath, site.redisWalkthroughHtml);
  write(serverlessPath, site.serverlessHtml);
  write(howItWorksPath, site.howItWorksHtml);
  write(variantsPath, site.variantsHtml);
  write(customAppsPath, site.customAppsHtml);
  write(existingAppsPath, site.existingAppsHtml);
  write(aiPath, site.aiHtml);
  write(securityPath, site.securityHtml);
  write(testingPath, site.pillarsHtml);
  write(entryPathReferencePath, site.entryPathReferenceHtml);
  write(futurePath, site.futureHtml);
  write(operationsPath, site.operationsHtml);
  write(docsPath, site.docsHtml);
  write(verificationPath, site.verificationHtml);
  write(proofPath, site.proofHtml);
  write(quirksPath, site.quirksHtml);
  write(hardQuestionsPath, site.hardQuestionsHtml);
  write(knownGapsPath, site.knownGapsHtml);
  write(hooksPath, site.hooksHtml);
  write(tiersPath, site.tiersRedirectHtml);
  write(privateIndexPath, site.privateHtml);
  write(journeyPath, site.journeyHtml);
  write(day1OperationsPath, site.day1OperationsHtml);
  write(join(siteRoot, "matrix.html"), site.matrixHtml);
  write(chartIndexPath, site.chartIndexHtml);
  write(demoOrgPath, site.demoOrgHtml);
  for (const page of site.chartPages) write(page.path, page.html);
  for (const page of site.docPages) write(page.path, page.html);
  for (const script of site.presetScripts) write(script.path, script.content);
  write(catalogJsonPath, site.catalogJson);
  write(readmePath, site.readme);
  write(sitemapPath, site.sitemapXml);
  write(robotsPath, site.robotsTxt);
  write(llmsPath, site.llmsTxt);
  write(generatedAtPath, `${generatedAt}\n`);
  if (site.missingMdTargets.length) {
    console.log(`markdown targets linked but not found in the repo (left as raw links): ${site.missingMdTargets.length}`);
    for (const target of site.missingMdTargets) console.log(`  - ${target}`);
  }
  console.log(`wrote public site outputs, ${site.chartPages.length} chart page(s), ${site.docPages.length} rendered doc page(s), and ${site.presetScripts.length} base variant script(s)`);
} else if (mode === "--verify") {
  check(existsSync(generatedAtPath), "site/generated-at.txt is missing; run npm run site:generate");
  const site = buildSite(readFileSync(generatedAtPath, "utf8").trim());
  check(existsSync(indexPath), "site/index.html is missing; run npm run site:generate");
  check(existsSync(offeringPath), "site/offering.html is missing; run npm run site:generate");
  check(existsSync(tryPath), "site/try.html is missing; run npm run site:generate");
  check(existsSync(redisWalkthroughPath), "site/redis-walkthrough.html is missing; run npm run site:generate");
  check(existsSync(serverlessPath), "site/serverless.html is missing; run npm run site:generate");
  check(existsSync(howItWorksPath), "site/how-it-works.html is missing; run npm run site:generate");
  check(existsSync(variantsPath), "site/variants.html is missing; run npm run site:generate");
  check(existsSync(customAppsPath), "site/custom-apps.html is missing; run npm run site:generate");
  check(existsSync(existingAppsPath), "site/existing-apps.html is missing; run npm run site:generate");
  check(existsSync(aiPath), "site/ai.html is missing; run npm run site:generate");
  check(existsSync(securityPath), "site/security.html is missing; run npm run site:generate");
  check(existsSync(testingPath), "site/testing.html is missing; run npm run site:generate");
  check(existsSync(entryPathReferencePath), "site/entry-path-reference.html is missing; run npm run site:generate");
  check(existsSync(futurePath), "site/future.html is missing; run npm run site:generate");
  check(existsSync(operationsPath), "site/operations.html is missing; run npm run site:generate");
  check(existsSync(docsPath), "site/docs.html is missing; run npm run site:generate");
  check(existsSync(verificationPath), "site/verification.html is missing; run npm run site:generate");
  check(existsSync(proofPath), "site/proof.html is missing; run npm run site:generate");
  check(existsSync(quirksPath), "site/quirks.html is missing; run npm run site:generate");
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
  check(readFileSync(redisWalkthroughPath, "utf8") === site.redisWalkthroughHtml, "site/redis-walkthrough.html is stale");
  check(readFileSync(serverlessPath, "utf8") === site.serverlessHtml, "site/serverless.html is stale");
  check(readFileSync(howItWorksPath, "utf8") === site.howItWorksHtml, "site/how-it-works.html is stale");
  check(readFileSync(variantsPath, "utf8") === site.variantsHtml, "site/variants.html is stale");
  check(readFileSync(customAppsPath, "utf8") === site.customAppsHtml, "site/custom-apps.html is stale");
  check(readFileSync(existingAppsPath, "utf8") === site.existingAppsHtml, "site/existing-apps.html is stale");
  check(readFileSync(aiPath, "utf8") === site.aiHtml, "site/ai.html is stale");
  check(readFileSync(securityPath, "utf8") === site.securityHtml, "site/security.html is stale");
  check(readFileSync(testingPath, "utf8") === site.pillarsHtml, "site/testing.html is stale");
  check(readFileSync(entryPathReferencePath, "utf8") === site.entryPathReferenceHtml, "site/entry-path-reference.html is stale");
  check(readFileSync(futurePath, "utf8") === site.futureHtml, "site/future.html is stale");
  check(readFileSync(operationsPath, "utf8") === site.operationsHtml, "site/operations.html is stale");
  check(readFileSync(docsPath, "utf8") === site.docsHtml, "site/docs.html is stale");
  check(readFileSync(verificationPath, "utf8") === site.verificationHtml, "site/verification.html is stale");
  check(readFileSync(proofPath, "utf8") === site.proofHtml, "site/proof.html is stale");
  check(readFileSync(quirksPath, "utf8") === site.quirksHtml, "site/quirks.html is stale");
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
  check(existsSync(demoOrgPath), "site/demo-org.html is missing; run npm run site:generate");
  check(readFileSync(demoOrgPath, "utf8") === site.demoOrgHtml, "site/demo-org.html is stale");
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
  check(existsSync(sitemapPath), "site/sitemap.xml is missing; run npm run site:generate");
  check(readFileSync(sitemapPath, "utf8") === site.sitemapXml, "site/sitemap.xml is stale");
  check(existsSync(robotsPath), "site/robots.txt is missing; run npm run site:generate");
  check(readFileSync(robotsPath, "utf8") === site.robotsTxt, "site/robots.txt is stale");
  check(existsSync(llmsPath), "site/llms.txt is missing; run npm run site:generate");
  check(readFileSync(llmsPath, "utf8") === site.llmsTxt, "site/llms.txt is stale");
  const expectedDocPages = new Map(site.docPages.map((page) => [page.relPath, page]));
  const actualDocPages = [];
  const walkDocPages = (dir, prefix) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walkDocPages(full, `${prefix}${name}/`);
      else if (name.endsWith(".html")) actualDocPages.push(`${prefix}${name}`);
    }
  };
  walkDocPages(docPagesRoot, "d/");
  const expectedScripts = new Map(site.presetScripts.map((script) => [script.relPath, script]));
  const actualScripts = [];
  const walkScripts = (dir, prefix) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walkScripts(full, `${prefix}${name}/`);
      else if (name.endsWith(".sh")) actualScripts.push(`${prefix}${name}`);
    }
  };
  walkScripts(join(siteRoot, "sh"), "sh/");
  check(actualScripts.length === expectedScripts.size, `expected ${expectedScripts.size} base variant script(s) under site/sh/, found ${actualScripts.length}`);
  for (const relPath of actualScripts) check(expectedScripts.has(relPath), `unexpected base variant script site/${relPath}`);
  for (const [relPath, script] of expectedScripts) {
    check(existsSync(script.path), `site/${relPath} is missing; run npm run site:generate`);
    check(readFileSync(script.path, "utf8") === script.content, `site/${relPath} is stale`);
  }
  check(actualDocPages.length === expectedDocPages.size, `expected ${expectedDocPages.size} rendered doc page(s) under site/d/, found ${actualDocPages.length}`);
  for (const relPath of actualDocPages) check(expectedDocPages.has(relPath), `unexpected rendered doc page site/${relPath}`);
  for (const [relPath, page] of expectedDocPages) {
    check(existsSync(page.path), `site/${relPath} is missing; run npm run site:generate`);
    check(readFileSync(page.path, "utf8") === page.html, `site/${relPath} is stale`);
  }
  verifyInstallerCommandCopy();
  verifySiteLinks();
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
  const helmRenderIntents = existsSync(helmRenderIntentsPath) ? parseCsv(readFileSync(helmRenderIntentsPath, "utf8")) : [];
  check(existsSync(demoProgramPath), "data/demo-program/program.json is missing; run npm run config-catalog");
  const demoProgram = JSON.parse(readFileSync(demoProgramPath, "utf8"));
  const helmCatalogReadmes = existsSync(helmCatalogReadmesPath) ? parseCsv(readFileSync(helmCatalogReadmesPath, "utf8")) : [];
  check(existsSync(installerOciCatalogPath), "data/installer-oci-packages/packages.csv is missing; run npm run installer-oci:catalog");
  const installerOciPackages = parseCsv(readFileSync(installerOciCatalogPath, "utf8"));
  const installerOciByKey = new Map(installerOciPackages.map((row) => [`${row.chart}|${row.version}`, row]));
  const lifecycleRouteActionSummary = {
    total: lifecycleRouteActions.length,
    automatic: lifecycleRouteActions.filter((action) => action.automatic === true || action.automatic === "true").length,
  };
  const lifecycleByVariant = existsSync(lifecycleByVariantJsonPath) ? JSON.parse(readFileSync(lifecycleByVariantJsonPath, "utf8")).charts : [];
  const gitopsRouteEmission = existsSync(gitopsRouteEmissionJsonPath) ? JSON.parse(readFileSync(gitopsRouteEmissionJsonPath, "utf8")).charts : [];
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
      const installerOci = installerOciByKey.get(`${entry.chart}|${entry.version}`);
      return {
        ...withStartFields,
        installer_oci_ref: installerOci?.installer_oci_ref ?? installerOciRef(entry.chart, entry.version),
        installer_oci_publication_status: installerOci?.publication_status ?? "assigned-ref",
        installer_oci_publication_receipt: installerOci?.publication_receipt ?? "",
        installer_oci_default_base: installerOci?.default_base ?? startVariant,
        installer_oci_bases: installerOci?.bases ?? "",
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
      gitopsRouteEmission: "data/gitops-route-emission/emission.json",
      helmCatalogReadmes: "data/helm-catalog-readmes/readmes.csv",
      installerOciPackages: "data/installer-oci-packages/packages.csv",
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
    helmRenderIntents,
    demoProgram,
    helmCatalogReadmes,
    installerOciPackages,
    lifecycleByVariant,
    gitopsRouteEmission,
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
  const site = {
    catalogJson: `${JSON.stringify(siteSafe({ generatedBy: catalog.generatedBy, generatedAt: catalog.generatedAt, installerAvailability: INSTALLER_COMMAND_NOTE, ...catalog }), null, 2)}\n`,
    indexHtml: html(catalog),
    offeringHtml: calmPage(offeringHtml(catalog)),
    tryHtml: calmPage(tryHtml(catalog)),
    redisWalkthroughHtml: calmPage(redisWalkthroughHtml(catalog)),
    serverlessHtml: calmPage(serverlessHtml(catalog)),
    howItWorksHtml: calmPage(howItWorksHtml(catalog)),
    variantsHtml: calmPage(variantsHtml(catalog)),
    customAppsHtml: calmPage(customAppsHtml(catalog)),
    existingAppsHtml: calmPage(existingAppsHtml(catalog)),
    aiHtml: calmPage(aiHtml(catalog)),
    securityHtml: calmPage(securityHtml(catalog)),
    pillarsHtml: calmPage(examplesHtml(catalog)),
    entryPathReferenceHtml: calmPage(entryPathReferenceHtml(catalog)),
    futureHtml: calmPage(futureHtml(catalog)),
    operationsHtml: calmPage(operationsHtml(catalog)),
    docsHtml: calmPage(docsHtml(catalog)),
    verificationHtml: calmPage(verificationHtml(catalog)),
    proofHtml: calmPage(proofHtml(catalog)),
    quirksHtml: calmPage(quirksHtml(catalog)),
    hardQuestionsHtml: calmPage(hardQuestionsHtml(catalog)),
    knownGapsHtml: calmPage(knownGapsHtml(catalog)),
    hooksHtml: calmPage(hooksHtml(catalog)),
    privateHtml: calmPage(privateHtml(catalog)),
    tiersRedirectHtml: tiersRedirectHtml(),
    journeyHtml: calmPage(journeyHtml(catalog)),
    day1OperationsHtml: legacyOperationsRedirectHtml(),
    chartIndexHtml: chartIndexHtml(catalog),
    demoOrgHtml: calmPage(demoOrgHtml(catalog)),
    chartPages,
    matrixHtml: rebaseRelativeLinks(
      readFileSync(join(repoRoot, "data", "master-catalog-matrix", "matrix.html"), "utf8"),
      "data/master-catalog-matrix",
      "site",
    ),
    readme: readme(),
  };
  site.robotsTxt = buildRobotsTxt();
  site.llmsTxt = buildLlmsTxt();
  const finalized = finalizeSite(site, catalog);
  finalized.sitemapXml = buildSitemapXml(finalized.chartPages, finalized.docPages);
  finalized.presetScripts = buildPresetScripts(catalog);
  return finalized;
}

function generatedStamp(catalog, label) {
  return `<p class="generated"><b>Generated at:</b> ${escapeHtml(catalog.generatedAt)} UTC · source: committed helm-expt evidence for this ${escapeHtml(label)}.</p>`;
}

function calmPage(html) {
  return html
    .replace(/\n[ \t]*<\/style>/, `\n${calmPageCss().trimEnd()}\n  </style>`)
    .replace("<body>", '<body class="calm-page">');
}

function pageBasePrefix(relPath) {
  const depth = relPath.split("/").length - 1;
  return depth ? "../".repeat(depth).replace(/\/$/, "") : ".";
}

// Every page that shows a runnable cub command must carry an install step or a
// link to one (site/try.html#install-cub). Pages that already include the step
// or a link to it are left alone.
function injectInstallCubNote(html, relPath) {
  if (html.includes('id="install-cub"') || html.includes("try.html#install-cub")) return html;
  const base = pageBasePrefix(relPath);
  const note = `<p class="install-cub-note">New to <code>cub</code>? <a href="${base}/try.html#install-cub">Install the cub CLI</a> first. You can pull and render public catalog packages without an account. Commands that save or change ConfigHub data require you to sign in.</p>`;
  const headerEnd = html.indexOf("</header>");
  for (const match of html.matchAll(/<pre[^>]*>[\s\S]*?<\/pre>/g)) {
    if (match.index <= headerEnd) continue;
    if (!/\bcub /.test(match[0])) continue;
    return `${html.slice(0, match.index)}${note}\n  ${html.slice(match.index)}`;
  }
  const inlineCommandCub = /<code[^>]*>[^<]*\bcub /.test(html);
  const mainMatch = html.match(/<main[^>]*>/);
  if (inlineCommandCub && mainMatch) {
    const insertAt = mainMatch.index + mainMatch[0].length;
    return `${html.slice(0, insertAt)}\n  ${note}${html.slice(insertAt)}`;
  }
  return html;
}

// The one explanation of the installer command, shown wherever the command
// appears. The marker class lets pages place the note by hand and keeps the
// injector from adding a second copy.
function installerCommandNoteHtml() {
  return `<p class="install-cub-note installer-command-note"><strong>What this command does.</strong> ${escapeHtml(INSTALLER_COMMAND_NOTE)} The generated scripts stop before doing any work when the plugin or <code>kustomize</code> is missing.</p>`;
}

// Every page that shows the cub installer command must explain that setup
// renders locally and does not deliver to Kubernetes. Insert the note before
// the first command block, or at the top when the mention is inline only.
function injectInstallerCommandNote(html) {
  if (!html.includes("installer setup")) return html;
  if (html.includes("installer-command-note")) return html;
  const note = installerCommandNoteHtml();
  const headerEnd = html.indexOf("</header>");
  for (const match of html.matchAll(/<pre[^>]*>[\s\S]*?<\/pre>/g)) {
    if (match.index <= headerEnd) continue;
    if (!match[0].includes("installer setup")) continue;
    return `${html.slice(0, match.index)}${note}\n  ${html.slice(match.index)}`;
  }
  const mainMatch = html.match(/<main[^>]*>/);
  if (mainMatch) {
    const insertAt = mainMatch.index + mainMatch[0].length;
    return `${html.slice(0, insertAt)}\n  ${note}${html.slice(insertAt)}`;
  }
  return `${note}\n${html}`;
}

function canonicalUrl(relPath) {
  const target = PAGE_REDIRECT_TARGETS[relPath] ?? relPath;
  if (target === "index.html") return SITE_BASE_URL;
  return SITE_BASE_URL + target.replace(/index\.html$/, "");
}

function pageTitle(html) {
  return (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "Config Test Centre").trim();
}

function pageDescription(html, relPath) {
  const fromMap = PAGE_DESCRIPTIONS[relPath];
  if (fromMap) return fromMap;
  const subject = pageTitle(html).replace(/\s*·\s*Config Test Centre$/, "");
  if (relPath.startsWith("d/")) {
    return `${subject}: a repository document from the helm-expt proof corpus, rendered for the site.`;
  }
  return `${subject}: chart status, base variants, rendered objects, and evidence in the Config Test Centre catalog.`;
}

function injectHeadMeta(html, relPath) {
  const titleMatch = html.match(/<title>[^<]*<\/title>/);
  if (!titleMatch) return html;
  const title = pageTitle(html);
  const description = pageDescription(html, relPath);
  const canonical = canonicalUrl(relPath);
  const meta = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
  ].join("\n  ");
  const at = titleMatch.index + titleMatch[0].length;
  return `${html.slice(0, at)}\n  ${meta}${html.slice(at)}`;
}

function buildSitemapXml(chartPages, docPages = []) {
  const urls = new Set();
  for (const relPath of Object.values(SITE_PAGE_RELPATHS)) {
    if (PAGE_REDIRECT_TARGETS[relPath]) continue;
    urls.add(canonicalUrl(relPath));
  }
  for (const page of chartPages) urls.add(canonicalUrl(`charts/${page.fileName}`));
  for (const page of docPages) urls.add(canonicalUrl(page.relPath));
  const body = [...urls].sort().map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildRobotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_BASE_URL}sitemap.xml\n`;
}

function buildLlmsTxt() {
  return `# Config Test Centre (helm-expt)

> A public proof catalog: popular Helm charts turned into cub installer packages, with rendered objects, receipts, scans, and live evidence. Every page is generated from committed repo data.

- [Catalog JSON](${SITE_BASE_URL}catalog.json): machine-readable summary of the catalog: charts, base variants, packages, counts, and the repo data paths they come from.
- [Helm Ops Catalog](${SITE_BASE_URL}charts/): the catalog index, one page per chart version with base variants, rendered objects, and evidence links.
- [Master catalog matrix](${SITE_BASE_URL}matrix.html): one row per chart, version, and base with lane dispositions, hooks, quirks, and next actions.
- [Generated at](${SITE_BASE_URL}generated-at.txt): the timestamp of the last site generation.
- [Official ConfigHub tutorial](${CONFIGHUB_TUTORIAL_URL}): the canonical product journey from one component through release, change, production, and promotion.
- [Try one catalog package](${SITE_BASE_URL}try.html): render and inspect one public Redis configuration with no ConfigHub Server or account.
- [Detailed Redis walkthrough](${SITE_BASE_URL}redis-walkthrough.html): add Helm parity, Kubernetes, OCI, upgrade, promotion, delivery, and rollback.
- [Examples](${SITE_BASE_URL}testing.html): working examples for starting inputs, managed operations, platforms, and ConfigHub Apps.
- [Detailed entry paths](${SITE_BASE_URL}entry-path-reference.html): commands and proof links for Helm, AICR, OCI, and Kubernetes YAML.
- [Repo README](https://github.com/confighub/helm-expt#readme): the proof corpus itself: recipes, receipts, verifiers, and how the evidence is produced.
`;
}

function splitFragment(value) {
  const hash = value.indexOf("#");
  if (hash < 0) return [value, ""];
  return [value.slice(0, hash), value.slice(hash)];
}

function isExternalHref(value) {
  return /^(https?:|mailto:|data:|javascript:|#)/.test(value);
}

function resolveRelativeHref(baseDir, href) {
  const [pathPart, fragment] = splitFragment(href);
  if (!pathPart) return null;
  return { target: posix.normalize(posix.join(baseDir, pathPart)), fragment };
}

// The master matrix html is authored for data/master-catalog-matrix/; the site
// copy lives one directory higher, at site/, so every relative link in the
// byte copy pointed one level above the repo root. Re-base each relative link
// for the copy's location.
function rebaseRelativeLinks(html, fromDir, toDir) {
  return html.replace(/(href|src)="([^"]+)"/g, (whole, attr, value) => {
    if (isExternalHref(value)) return whole;
    const resolved = resolveRelativeHref(fromDir, value);
    if (!resolved || resolved.target.startsWith("..")) return whole;
    return `${attr}="${posix.relative(toDir, resolved.target)}${resolved.fragment}"`;
  });
}

function renderedDocRelPath(repoPath) {
  return `d/${repoPath.replace(/\.md$/, ".html")}`;
}

// Rewrite .md hrefs on a generated page to the rendered doc pages under
// site/d/. Targets outside the rendered set keep their original raw link.
function rewriteMdHrefs(html, pageRelPath, renderedDocs) {
  const pageDir = posix.dirname(`site/${pageRelPath}`);
  return html.replace(/href="([^"]+\.md(?:#[^"]*)?)"/g, (whole, value) => {
    if (isExternalHref(value)) return whole;
    const resolved = resolveRelativeHref(pageDir, value);
    if (!resolved || !renderedDocs.has(resolved.target)) return whole;
    // A rendered doc's own view-source link must keep pointing at the raw
    // markdown, not at the page itself.
    if (`site/${renderedDocRelPath(resolved.target)}` === `site/${pageRelPath}`) return whole;
    const out = posix.relative(pageDir, `site/${renderedDocRelPath(resolved.target)}`);
    return `href="${out}${resolved.fragment}"`;
  });
}

function headingSlug(text, used) {
  const base = text
    .toLowerCase()
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function resolveDocHref(href, docRepoPath, renderedDocs) {
  if (isExternalHref(href)) return href;
  const resolved = resolveRelativeHref(posix.dirname(docRepoPath), href);
  if (!resolved || resolved.target.startsWith("..")) return href;
  const outDir = posix.dirname(`site/${renderedDocRelPath(docRepoPath)}`);
  if (resolved.target.endsWith(".md") && renderedDocs.has(resolved.target)) {
    return posix.relative(outDir, `site/${renderedDocRelPath(resolved.target)}`) + resolved.fragment;
  }
  return posix.relative(outDir, resolved.target) + resolved.fragment;
}

function renderInlineMarkdown(text, docRepoPath, renderedDocs) {
  const codeSpans = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (whole, code) => {
    codeSpans.push(`<code>${code}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  out = out
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, alt, href) => `<img alt="${alt}" src="${resolveDocHref(href, docRepoPath, renderedDocs)}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, href) => `<a href="${resolveDocHref(href, docRepoPath, renderedDocs)}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=$|[\s).,;:!?])/g, "$1<i>$2</i>");
  return out.replace(/\u0000(\d+)\u0000/g, (whole, index) => codeSpans[Number(index)]);
}

function renderListBlock(lines, start, inline) {
  const items = [];
  let i = start;
  while (i < lines.length) {
    const match = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (!match) {
      if (items.length && lines[i].trim() && /^\s{2,}/.test(lines[i])) {
        items[items.length - 1].text += ` ${lines[i].trim()}`;
        i++;
        continue;
      }
      break;
    }
    items.push({ indent: match[1].length, ordered: /\d/.test(match[2][0]), text: match[3] });
    i++;
  }
  const built = buildNestedList(items, 0, items[0].indent, inline);
  return { html: built.html, next: i };
}

function buildNestedList(items, index, indent, inline) {
  const tag = items[index].ordered ? "ol" : "ul";
  let html = `<${tag}>`;
  let i = index;
  while (i < items.length && items[i].indent >= indent) {
    if (items[i].indent > indent) {
      const nested = buildNestedList(items, i, items[i].indent, inline);
      html = html.replace(/<\/li>$/, `${nested.html}</li>`);
      i = nested.next;
      continue;
    }
    html += `<li>${inline(items[i].text)}</li>`;
    i++;
  }
  html += `</${tag}>`;
  return { html, next: i };
}

function renderMarkdownBody(markdown, docRepoPath, renderedDocs) {
  const usedSlugs = new Map();
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  const inline = (text) => renderInlineMarkdown(text, docRepoPath, renderedDocs);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      const buffer = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) {
        buffer.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(`<pre><code>${escapeHtml(buffer.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const slug = headingSlug(text, usedSlugs);
      blocks.push(`<h${level} id="${slug}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const cells = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
      const header = cells(line);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        bodyRows.push(cells(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead>`;
      const tbody = bodyRows.length ? `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("\n")}</tbody>` : "";
      blocks.push(`<table>${thead}${tbody}</table>`);
      continue;
    }
    if (line.trimStart().startsWith(">")) {
      const buffer = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        buffer.push(lines[i].trimStart().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(`<blockquote><p>${inline(buffer.join(" ").trim())}</p></blockquote>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push("<hr>");
      i++;
      continue;
    }
    if (/^(\s*)([-*+]|\d+\.)\s+/.test(line)) {
      const list = renderListBlock(lines, i, inline);
      blocks.push(list.html);
      i = list.next;
      continue;
    }
    const buffer = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trimStart().startsWith(">") &&
      !/^\s*(```|~~~)/.test(lines[i])
    ) {
      buffer.push(lines[i].trim());
      i++;
    }
    blocks.push(`<p>${inline(buffer.join(" "))}</p>`);
  }
  return blocks.join("\n");
}

function docTitleOf(markdown, repoPath) {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim().replace(/`/g, "").replace(/\*\*/g, "");
  return repoPath.split("/").pop();
}

function docPageCss() {
  return `
    .doc-body table { border-collapse: collapse; margin: 14px 0; font-size: .9rem; }
    .doc-body th, .doc-body td { border: 1px solid var(--line); padding: 7px 10px; text-align: left; vertical-align: top; }
    .doc-body th { background: var(--panel); }
    .doc-body blockquote { border-left: 3px solid var(--line); margin: 14px 0; padding: 4px 14px; color: var(--muted); }
    .doc-body img { max-width: 100%; }
    .doc-body h2 { margin-top: 28px; }
  `;
}

function docPageHtml(catalog, repoPath, markdown, renderedDocs) {
  const relPath = renderedDocRelPath(repoPath);
  const base = pageBasePrefix(relPath);
  const title = docTitleOf(markdown, repoPath);
  const body = renderMarkdownBody(markdown.replace(/^#\s+.+$/m, ""), repoPath, renderedDocs);
  const outDir = posix.dirname(`site/${relPath}`);
  const sourceHref = posix.relative(outDir, repoPath);
  const lead = docPageLead(repoPath, sourceHref);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Config Test Centre</title>
  <style>${siteCss()}${docPageCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(base)}
    <h1>${escapeHtml(title)}</h1>
    <p class="lead">${lead}</p>
  </header>
  <main>
    ${docGeneratedStamp(catalog, repoPath)}
    <article class="doc-body">
${body}
    </article>
  </main>
  <footer><p>Generated from the committed markdown file <code>${escapeHtml(repoPath)}</code>. The source file is the authoritative version.</p></footer>
</body>
</html>
`;
}

function docPageLead(repoPath, sourceHref) {
  if (repoPath === "data/helm-catalog-readmes/summary.md") {
    return `The website index for the README pages used in the live <code>helm-catalog</code> demo org. <a href="${sourceHref}">View source markdown</a>.`;
  }
  if (repoPath.startsWith("data/helm-catalog-readmes/spaces/")) {
    return `This is the same README you will find in the matching demo Space in Hub. It explains why the Space exists, what problem it demonstrates, and what to inspect first. <a href="${sourceHref}">View source markdown</a>.`;
  }
  return `A repository document, rendered for the site. <a href="${sourceHref}">View source markdown</a>.`;
}

function docGeneratedLabel(repoPath) {
  if (repoPath === "data/helm-catalog-readmes/summary.md") return "demo org README index";
  if (repoPath.startsWith("data/helm-catalog-readmes/spaces/")) return "README for this demo Space";
  return "rendered repository document";
}

function docGeneratedStamp(catalog, repoPath) {
  if (repoPath === "data/helm-catalog-readmes/summary.md") {
    return `<p class="generated"><b>Generated at:</b> ${escapeHtml(catalog.generatedAt)} UTC · source: generated README index for the <code>helm-catalog</code> demo org.</p>`;
  }
  if (repoPath.startsWith("data/helm-catalog-readmes/spaces/")) {
    return `<p class="generated"><b>Generated at:</b> ${escapeHtml(catalog.generatedAt)} UTC · source: generated README for this demo Space, built from committed helm-expt evidence.</p>`;
  }
  return generatedStamp(catalog, docGeneratedLabel(repoPath));
}

function collectMdTargets(site) {
  const targets = new Set();
  const scan = (html, pageRelPath) => {
    const pageDir = posix.dirname(`site/${pageRelPath}`);
    for (const match of html.matchAll(/href="([^"]+\.md(?:#[^"]*)?)"/g)) {
      if (isExternalHref(match[1])) continue;
      const resolved = resolveRelativeHref(pageDir, match[1]);
      if (!resolved || resolved.target.startsWith("..") || resolved.target.startsWith("site/")) continue;
      targets.add(resolved.target);
    }
  };
  for (const [key, relPath] of Object.entries(SITE_PAGE_RELPATHS)) scan(site[key], relPath);
  for (const page of site.chartPages) scan(page.html, `charts/${page.fileName}`);
  return [...targets].sort();
}

function markdownLinkTargets(repoPath) {
  const markdown = readFileSync(join(repoRoot, repoPath), "utf8").replace(/```[\s\S]*?```/g, "");
  const targets = [];
  for (const match of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = match[1];
    if (isExternalHref(href)) continue;
    const resolved = resolveRelativeHref(posix.dirname(repoPath), href);
    if (!resolved || !resolved.target.endsWith(".md")) continue;
    if (resolved.target.startsWith("..") || resolved.target.startsWith("site/")) continue;
    if (!existsSync(join(repoRoot, resolved.target))) continue;
    targets.push(resolved.target);
  }
  return targets;
}

function buildDocPages(catalog, site) {
  const targets = collectMdTargets(site);
  const rendered = new Set(targets.filter((target) => existsSync(join(repoRoot, target))));
  // Close the set over doc-to-doc markdown links, so the site chrome never
  // drops away along a link chain between rendered documents.
  let frontier = [...rendered];
  while (frontier.length) {
    const next = [];
    for (const repoPath of frontier) {
      for (const target of markdownLinkTargets(repoPath)) {
        if (rendered.has(target)) continue;
        rendered.add(target);
        next.push(target);
      }
    }
    frontier = next;
  }
  const pages = [...rendered].sort().map((repoPath) => ({
    repoPath,
    relPath: renderedDocRelPath(repoPath),
    path: join(siteRoot, renderedDocRelPath(repoPath)),
    html: docPageHtml(catalog, repoPath, readFileSync(join(repoRoot, repoPath), "utf8"), rendered),
  }));
  return { pages, rendered, missing: targets.filter((target) => !rendered.has(target)) };
}

function finalizePage(html, relPath, renderedDocs = new Set()) {
  const withInstallNote = injectInstallCubNote(html, relPath);
  const withCommandNote = injectInstallerCommandNote(withInstallNote);
  const withMeta = injectHeadMeta(withCommandNote, relPath);
  return rewriteMdHrefs(withMeta, relPath, renderedDocs);
}

function finalizeSite(site, catalog) {
  const docs = buildDocPages(catalog, site);
  const finalized = { ...site };
  for (const [key, relPath] of Object.entries(SITE_PAGE_RELPATHS)) {
    finalized[key] = finalizePage(site[key], relPath, docs.rendered);
  }
  finalized.chartPages = site.chartPages.map((page) => ({
    ...page,
    html: finalizePage(page.html, `charts/${page.fileName}`, docs.rendered),
  }));
  finalized.docPages = docs.pages.map((page) => ({
    ...page,
    html: finalizePage(page.html, page.relPath, docs.rendered),
  }));
  finalized.missingMdTargets = docs.missing;
  return finalized;
}

// Every relative href/src in the generated site must resolve to a file or
// directory in the repository. Raw-markdown dead ends and depth bugs fail here.
function verifySiteLinks() {
  const htmlFiles = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".html")) htmlFiles.push(full);
    }
  };
  walk(siteRoot);
  const failures = [];
  let skippedRunLinks = 0;
  for (const file of htmlFiles) {
    const pageDir = posix.dirname(file);
    const html = readFileSync(file, "utf8");
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const value = match[1];
      if (isExternalHref(value)) continue;
      const resolved = resolveRelativeHref(pageDir, value);
      if (!resolved) continue;
      if (posix.relative(repoRoot, resolved.target).startsWith("runs/")) {
        // Receipt paths under runs/ come from proof data (for example the
        // master matrix receipt column) and run outputs are partially
        // ephemeral by design; the site must not rewrite proof pointers.
        skippedRunLinks += 1;
        continue;
      }
      if (!existsSync(resolved.target)) failures.push(`${posix.relative(repoRoot, file)} -> ${value}`);
    }
  }
  check(
    failures.length === 0,
    `site link check failed: ${failures.length} broken relative link(s), first ${Math.min(failures.length, 20)}:\n${failures.slice(0, 20).map((failure) => `  - ${failure}`).join("\n")}`,
  );
  console.log(`verified site relative links across ${htmlFiles.length} page(s) (${skippedRunLinks} runs/ proof pointer(s) not checked)`);
}

function verifyInstallerCommandCopy() {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(?:html|md|json|sh)$/.test(name)) files.push(full);
    }
  };
  walk(siteRoot);

  const forbiddenPhrases = [
    "not yet publicly available",
    "plugin that ships separately",
    "not in the public cub build",
    "standard cub " + "install script",
    "first binary release is not available yet",
    "source-repo --name installer",
  ];
  const staleCommand = "cub " + "install";
  const runnableStaleCommand = new RegExp(`(?:^|\\n)\\s*(?:\\$\\s*)?${staleCommand}(?!er\\b)(?=\\s|$)`);
  const failures = [];
  for (const file of files) {
    const relPath = posix.relative(repoRoot, file);
    const text = readFileSync(file, "utf8");
    for (const phrase of forbiddenPhrases) {
      if (text.toLowerCase().includes(phrase)) failures.push(`${relPath}: stale installer claim: ${phrase}`);
    }
    if (file.endsWith(".html")) {
      if (text.includes("installer setup") && !text.includes("installer-command-note")) {
        failures.push(`${relPath}: cub installer setup is shown without the command explanation`);
      }
      for (const code of text.matchAll(/<code[^>]*>([\s\S]*?)<\/code>/g)) {
        if (runnableStaleCommand.test(code[1])) {
          failures.push(`${relPath}: runnable example uses the stale installer command name`);
        }
      }
    }
    if (file.endsWith(".sh") && runnableStaleCommand.test(text)) {
      failures.push(`${relPath}: script uses the stale installer command name`);
    }
  }
  check(
    failures.length === 0,
    `site installer command check failed: ${failures.length} finding(s):\n${failures.slice(0, 40).map((failure) => `  - ${failure}`).join("\n")}`,
  );
  console.log(`verified cub installer wording across ${files.length} generated site file(s)`);
}

function topNav(base = ".") {
  const link = (path) => `${base}/${path}`;
  return `<div class="site-chrome"><nav class="topbar"><a class="brand" href="${link("index.html")}" title="Home"><svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 1.5 14.5 7h-2v7H9.5v-4h-3v4H3.5V7h-2L8 1.5z"/></svg>Config Test Centre</a><span class="navlinks"><a href="${link("try.html")}">Try it</a><a href="${link("charts/index.html")}">Catalog</a><a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "site-nav")}">Tutorial</a><a href="${link("how-it-works.html")}">How it works</a><a href="${link("docs.html")}">Docs</a>${signupLink("site-nav", "Sign in")}</span></nav></div>`;
}

function audienceLabel(text) {
  return `<p style="margin:0 0 8px;color:var(--good);font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0">${escapeHtml(text)}</p>`;
}

function humanLinks(links = []) {
  if (!links.length) return "";
  return `<p style="margin-top:14px;font-size:.9rem">${links.map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join(" · ")}</p>`;
}

function referenceStartHtml(body = "The rest of this page is reference material: commands, data links, proof notes, and edge cases.") {
  return `<section aria-labelledby="more-detail" style="border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:18px 0;margin-bottom:28px">
      <h2 id="more-detail" style="margin-top:0">More detail</h2>
      <p>${escapeHtml(body)}</p>
    </section>`;
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
  return configTestCentreHome(catalog);
}

function homeTerminalCss() {
  return `
    body.home .terminal-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--term);
      overflow: hidden;
    }
    body.home .terminal-card .terminal-title {
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,.12);
      color: #b7c3cf;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .78rem;
      background: #111922;
    }
    body.home .terminal-card .terminal-body {
      margin: 0;
      border: 0;
      border-radius: 0;
    }
`;
}

// Config Test Centre homepage: the design-language home page (self-contained,
// theme-aware). Replaces the old light-theme parity-first homepage.
function homeDesignCss() {
  return `
  :root {
    --bg: #e9edf0; --surface: #ffffff; --surface-2: #f3f6f8;
    --ink: #131a20; --muted: #56646f; --faint: #7d8b96;
    --line: #d5dde2; --line-strong: #bcc8d0;
    --accent: #0b6e8f; --accent-ink: #084f68;
    --pass: #1f8a4c; --pass-bg: #e4f3ea;
    --watch: #b5761a; --watch-bg: #f7ecd8;
    --blocked: #c53a3a; --blocked-bg: #f7e2e2;
    --term-bg: #0f1720; --term-ink: #d6e0e8;
    --shadow: 0 1px 2px rgba(16,32,45,.06), 0 8px 24px rgba(16,32,45,.05);
    --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d1319; --surface: #151d25; --surface-2: #1b242d;
      --ink: #e8eef3; --muted: #97a5b0; --faint: #71818d;
      --line: #253038; --line-strong: #33414c;
      --accent: #34a7c9; --accent-ink: #7fd0e6;
      --pass: #4bc07d; --pass-bg: #12291d;
      --watch: #e0a648; --watch-bg: #2c2213;
      --blocked: #ef7570; --blocked-bg: #2e1717;
      --term-bg: #0a1016; --term-ink: #d6e0e8;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
    }
  }
  :root[data-theme="dark"] {
    --bg: #0d1319; --surface: #151d25; --surface-2: #1b242d;
    --ink: #e8eef3; --muted: #97a5b0; --faint: #71818d;
    --line: #253038; --line-strong: #33414c;
    --accent: #34a7c9; --accent-ink: #7fd0e6;
    --pass: #4bc07d; --pass-bg: #12291d;
    --watch: #e0a648; --watch-bg: #2c2213;
    --blocked: #ef7570; --blocked-bg: #2e1717;
    --term-bg: #0a1016; --term-ink: #d6e0e8;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }
  :root[data-theme="light"] {
    --bg: #e9edf0; --surface: #ffffff; --surface-2: #f3f6f8;
    --ink: #131a20; --muted: #56646f; --faint: #7d8b96;
    --line: #d5dde2; --line-strong: #bcc8d0;
    --accent: #0b6e8f; --accent-ink: #084f68;
    --pass: #1f8a4c; --pass-bg: #e4f3ea;
    --watch: #b5761a; --watch-bg: #f7ecd8;
    --blocked: #c53a3a; --blocked-bg: #f7e2e2;
    --term-bg: #0f1720; --term-ink: #d6e0e8;
    --shadow: 0 1px 2px rgba(16,32,45,.06), 0 8px 24px rgba(16,32,45,.05);
  }
  * { box-sizing: border-box; }
  body { margin: 0; }
  .wrap { font-family: var(--sans); background: var(--bg); color: var(--ink); line-height: 1.55; -webkit-font-smoothing: antialiased; }
  .page { max-width: 1120px; margin: 0 auto; padding: 0 22px 8px; }
  .eyebrow { font-family: var(--mono); font-size: .68rem; letter-spacing: .14em; text-transform: uppercase; color: var(--faint); }
  h1,h2,h3 { text-wrap: balance; }
  a { color: inherit; }

  nav.bar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 0; flex-wrap: wrap; }
  .wordmark { font-family: var(--mono); font-size: .84rem; color: var(--ink); font-weight: 640; display: inline-flex; align-items: center; gap: 9px; text-decoration: none; }
  .wordmark .sq { width: 15px; height: 15px; border-radius: 4px; background: var(--accent); }
  .navlinks { display: flex; gap: 18px; font-size: .86rem; color: var(--muted); flex-wrap: wrap; }
  .navlinks a { text-decoration: none; color: var(--muted); }
  .navlinks a:hover { color: var(--accent-ink); }

  .hero { display: grid; grid-template-columns: 1.05fr .95fr; gap: 34px; align-items: center; padding: 34px 0 30px; border-top: 1px solid var(--line); }
  .hero h1 { font-size: clamp(2rem, 4.3vw, 3.05rem); font-weight: 780; letter-spacing: -.025em; line-height: 1.05; margin: 12px 0 16px; }
  .hero .lead { font-size: 1.08rem; color: var(--muted); margin: 0 0 22px; max-width: 46ch; }
  .cta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .btn { font-family: var(--sans); font-size: .92rem; font-weight: 560; padding: 11px 18px; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; border: 1px solid transparent; }
  .btn.primary { background: var(--accent); color: #fff; }
  @media (prefers-color-scheme: dark){ .btn.primary { color: #04222c; font-weight: 640; } }
  :root[data-theme="dark"] .btn.primary { color: #04222c; font-weight: 640; }
  :root[data-theme="light"] .btn.primary { color: #fff; }
  .btn.ghost { border-color: var(--line-strong); color: var(--ink); background: var(--surface); }
  .btn.ghost:hover { border-color: var(--accent); }
  .sources { font-family: var(--mono); font-size: .74rem; color: var(--faint); display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .sources b { color: var(--muted); font-weight: 600; }

  .term { background: var(--term-bg); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); font-family: var(--mono); }
  .term-bar { display: flex; align-items: center; gap: 7px; padding: 11px 14px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .term-bar .d { width: 10px; height: 10px; border-radius: 50%; background: #33414c; }
  .term-bar .t { margin-left: 8px; font-size: .72rem; color: #8595a2; }
  .term-body { padding: 15px 16px; font-size: .8rem; line-height: 1.85; color: var(--term-ink); white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
  .term-body .pr { color: #5fd0b0; }
  .term-body .ok { color: #5cc98d; } .term-body .warn { color: #e6b45a; } .term-body .cmt { color: #6b7b88; }
  .term-body .k { color: #8fd0e6; }
  .term-body .verdict { color: #e6b45a; font-weight: 600; }

  .section { padding: 34px 0; border-top: 1px solid var(--line); }
  .section > .eyebrow { display: block; margin-bottom: 6px; }
  .section h2 { font-size: clamp(1.4rem, 2.6vw, 1.85rem); font-weight: 740; letter-spacing: -.02em; margin: 0 0 6px; }
  .section .intro { color: var(--muted); font-size: 1rem; margin: 0 0 22px; max-width: 60ch; }

  .verbs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
  .verb { border: 1px solid var(--line); border-radius: 13px; padding: 16px; background: var(--surface); box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 8px; }
  .verb .n { font-family: var(--mono); font-size: .66rem; color: var(--faint); letter-spacing: .05em; }
  .verb h3 { margin: 0; font-size: 1.02rem; font-weight: 700; }
  .verb p { margin: 0; font-size: .82rem; color: var(--muted); line-height: 1.4; }
  .verb .route { font-family: var(--mono); font-size: .62rem; text-transform: uppercase; letter-spacing: .05em; color: var(--accent-ink); margin-top: auto; padding-top: 4px; }

  .conf-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .conf { border: 1px solid var(--line); border-radius: 12px; padding: 15px; background: var(--surface); box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 8px; }
  .conf .badge { align-self: flex-start; font-family: var(--mono); font-size: .7rem; font-weight: 600; padding: 3px 9px; border-radius: 999px; color: var(--pass); background: var(--pass-bg); }
  .conf .q { font-size: .92rem; font-weight: 660; }
  .conf .note { font-size: .8rem; color: var(--muted); line-height: 1.4; }

  .routes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .route-card { border: 1px solid var(--line); border-radius: 13px; padding: 17px; background: var(--surface); box-shadow: var(--shadow); }
  .route-card.mid { border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
  .route-card h3 { margin: 0 0 4px; font-size: .96rem; font-weight: 700; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .route-card .tag { font-family: var(--mono); font-size: .6rem; text-transform: uppercase; letter-spacing: .06em; color: var(--faint); border: 1px solid var(--line-strong); border-radius: 999px; padding: 2px 8px; }
  .route-card.mid .tag { color: var(--accent-ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
  .route-card p { margin: 6px 0 0; font-size: .84rem; color: var(--muted); line-height: 1.45; }

  footer.foot { border-top: 1px solid var(--line); margin-top: 20px; padding: 26px 0 50px; }
  footer.foot .flip { font-size: 1.06rem; color: var(--ink); font-weight: 600; max-width: 54ch; margin: 0 0 10px; }
  footer.foot .sub { font-size: .82rem; color: var(--faint); margin: 0; }

  @media (max-width: 880px) {
    .hero { grid-template-columns: 1fr; gap: 24px; }
    .verbs { grid-template-columns: repeat(2, 1fr); }
    .conf-grid { grid-template-columns: repeat(2, 1fr); }
    .routes { grid-template-columns: 1fr; }
  }
  @media (max-width: 520px) { .verbs { grid-template-columns: 1fr; } .conf-grid { grid-template-columns: 1fr; } }
`;
}

function configTestCentreHome(catalog) {
  const verbs = [
    ["01", "Understand", "Read what it installs and where it bites.", "open source"],
    ["02", "Test", "Is my config well-formed and safe?", "open source"],
    ["03", "Ask", "A concrete answer, cited to a receipt.", "open source"],
    ["04", "Vary", "Make a supported variant, keep it safe.", "free account to keep"],
    ["05", "Check my AI", "Grade what your agent produced.", "open source"],
  ];
  const confidences = [
    ["Safe to deploy?", "Well-formed, scans clean, e2e green, fits your cluster."],
    ["Deploys without disruption?", "CRDs first, hook phases, prerequisites present."],
    ["Rollback safe, no data loss?", "What is stateful, destroy-gates, blast radius."],
    ["Rollback will succeed?", "A prior good revision, recorded and restorable."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Config Test Centre &middot; Understand and test your configuration</title>
  <style>${homeDesignCss()}</style>
</head>
<body>
  <div class="wrap">
    <div class="page">
      <header>
        <nav class="bar">
          <a class="wordmark" href="./index.html"><span class="sq"></span>Config Test Centre</a>
          <span class="navlinks">
            <a href="./try.html">Try it</a>
            <a href="./charts/index.html">Catalog</a>
            <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "home-nav")}">Tutorial</a>
            <a href="./how-it-works.html">How it works</a>
            <a href="./docs.html">Docs</a>
            ${signupLink("home-nav", "Sign in")}
          </span>
        </nav>
        <div class="hero">
          <div>
            <span class="eyebrow">Helm &middot; AICR &middot; OCI packages</span>
            <h1>Simplify configuration testing and verification</h1>
            <p class="lead">Using configuration tools can be tricky. We are here to help.</p>
            <p class="lead">Read and test the exact Kubernetes objects before anything runs. Keep the reviewed result as files or OCI, or save it in ConfigHub so your team can change, promote, and roll it out. Start with a catalog package, your own Helm values, AICR, or an existing OCI.</p>
            <div class="cta-row">
              <a class="btn primary" href="./try.html">Run a catalog package</a>
              <a class="btn ghost" href="./testing.html#bring-your-own">Check my config</a>
            </div>
            <div class="sources"><b>starts with:</b> Helm charts &middot; AICR packages &middot; OCI &middot; Kubernetes YAML</div>
          </div>
          <div class="term" aria-label="Render a public package and write its Kubernetes objects as OCI">
            <div class="term-bar"><span class="d"></span><span class="d"></span><span class="d"></span><span class="t">catalog package &rarr; files + OCI &middot; no cluster touched</span></div>
            <pre class="term-body"><code><span class="pr">$</span> cub installer setup \\
  <span class="k">--pull</span> ${REDIS_INSTALLER_OCI_REF} \\
  <span class="k">--base</span> reuse-existing-secret \\
  <span class="k">--namespace</span> redis <span class="k">--work-dir</span> ./redis \\
  <span class="k">--non-interactive --output-oci</span> ./redis-rendered.oci

Rendered 14 manifest(s) to ./redis/out/manifests
Wrote rendered OCI ./redis-rendered.oci:latest
  objects:   sha256:... (14 manifest files)
  pull-back: <span class="ok">verified</span></code></pre>
          </div>
        </div>
        <div class="sources"><b>checked:</b> <a href="./d/data/redis-public-walkthrough-proof/summary.html">anonymous package pull, 14 non-secret objects, OCI pull-back, and the same selected base from Redis 25.5.3 to 27.0.0</a></div>
      </header>

      <main>
        <section class="section">
          <span class="eyebrow">Five simple things</span>
          <h2>What you can do</h2>
          <p class="intro">Look at what a package does, and whether it is safe, before you install it. Each verb works on a catalog package or on your own config. Every chart has a detailed playbook.</p>
          <div class="verbs">
            ${verbs.map(([n, name, desc, route]) => `<div class="verb"><span class="n">${n}</span><h3>${escapeHtml(name)}</h3><p>${escapeHtml(desc)}</p><span class="route">${escapeHtml(route)}</span></div>`).join("\n            ")}
          </div>
        </section>

        <section class="section">
          <span class="eyebrow">Config testing</span>
          <h2>Four things you can prove before you ship</h2>
          <p class="intro">Not claims &mdash; runnable checks, each recorded as a receipt you can open, and re-runnable as drift after install.</p>
          <div class="conf-grid">
            ${confidences.map(([q, note]) => `<div class="conf"><span class="badge">&#10003; provable</span><span class="q">${escapeHtml(q)}</span><span class="note">${escapeHtml(note)}</span></div>`).join("\n            ")}
          </div>
        </section>

        <section class="section">
          <span class="eyebrow">One resource, three depths</span>
          <h2>Test locally. Keep the result in the path.</h2>
          <p class="intro">Testing is the first step. The reviewed files can go straight to OCI for Argo CD or Flux. Put them in ConfigHub when you want a shared record that can be edited, promoted, approved, and rolled out.</p>
          <div class="routes">
            <div class="route-card"><h3>Open source <span class="tag">no server or account</span></h3><p>Inspect and test a catalog package or your own config. Keep the exact result as local files or write it to OCI for the delivery tools you already use.</p></div>
            <div class="route-card mid"><h3>ConfigHub server <span class="tag">free account</span></h3><p>Save the reviewed objects as shared data. Make environment variants, see exact diffs, promote a change, publish OCI, and check what reached each target.</p></div>
            <div class="route-card"><h3>Enterprise <span class="tag">paid</span></h3><p>Use private catalogs, team access, policy gates, and staged rollout across larger application and platform fleets.</p></div>
          </div>
        </section>
      </main>

      <footer class="foot">
        <p class="flip">You know the saying about not wanting to see how the sausage gets made. We are the place that shows you &mdash; every ingredient, before you eat.</p>
        <p class="sub">Public experimental evidence. Each result links to the command, receipt, or known gap behind it. <a href="${SITE_FEEDBACK_ISSUE_URL}">Send feedback</a>.</p>
      </footer>
    </div>
  </div>
</body>
</html>
`;
}

function applyPolicyFacts() {
  const profile = readYaml(applyPolicyProfilePath);
  const receipt = readYaml(applyPolicyLiveReceiptPath);
  return {
    baselineChecks: profile.spec.baseline.checks.length,
    baselineSpaces: receipt.spec.spaces.baseline.length,
    approvalSpaces: receipt.spec.spaces.approvalRequired.length,
    productionSpaces: receipt.spec.spaces.approvalReasons.production.length,
    systemConfigurationSpaces:
      receipt.spec.spaces.approvalReasons.systemConfiguration.length,
    sourceTypes: receipt.spec.spaces.sourceTypes ?? {},
  };
}

function policySourceCoverage(policyFacts) {
  const labels = {
    helm: "Helm",
    aicr: "AICR",
    "cub-installer": "cub installer",
    kubara: "Kubara",
    sveltos: "Sveltos",
    "rendered-config": "rendered Kubernetes config",
  };
  return Object.entries(policyFacts.sourceTypes)
    .map(([sourceType, spaces]) => `${labels[sourceType] ?? sourceType} ${spaces.length}`)
    .join(", ");
}

function howItWorksHtml(catalog) {
  const policyFacts = applyPolicyFacts();
  const sourceCoverage = policySourceCoverage(policyFacts);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>How It Works · Config Test Centre</title>
<style>${siteCss()}
.vs{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0;}
.vs .col{border:1px solid var(--line);border-radius:10px;padding:16px;background:var(--surface);}
.vs .col.helm{background:var(--panel);}
.vs h3{margin:0 0 8px;font-size:1rem;}
.vs ul{margin:0;padding-left:18px;}
.vs li{margin:4px 0;font-size:.9rem;color:var(--ink);}
.fstage{border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:8px;padding:14px 16px;margin:10px 0;background:var(--surface);}
.fstage .ftag{font-family:ui-monospace,monospace;font-size:.72rem;color:var(--muted);font-weight:700;letter-spacing:.03em;}
.fstage h3{margin:3px 0 6px;font-size:1.06rem;}
.fstage p{margin:0;font-size:.9rem;}
.fstage.star{border-left-color:var(--good);background:#f4faf5;}
.pill{display:inline-block;font-size:.72rem;color:var(--good);border:1px solid var(--good);border-radius:20px;padding:1px 8px;margin-left:6px;vertical-align:1px;}
.codetag{display:inline-block;font-family:ui-monospace,monospace;font-size:.72rem;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 6px;margin-left:6px;vertical-align:1px;}
.honest{border:1px solid #f0c36d;background:#fff8e5;border-radius:8px;padding:14px 16px;margin:16px 0;}
.honest h3{margin:0 0 6px;font-size:1rem;color:#6d4b00;}
.honest p,.honest li{color:#6d4b00;}
.decide{border:1px solid var(--line);border-left:3px solid var(--accent);background:var(--panel);border-radius:8px;padding:6px 16px;margin:14px 0;}
.counts,.scope{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:12px 0;}
.count{border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center;background:var(--surface);}
.count b{display:block;font-size:1.2rem;}
.count.pass b{color:var(--good);}.count.watch b{color:var(--warn);}.count.bad b{color:var(--bad);}
.count span{font-size:.72rem;color:var(--muted);}
.gtable{width:100%;border-collapse:collapse;margin:10px 0;font-size:.9rem;}
.gtable th,.gtable td{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top;}
.gtable th{background:var(--panel);}
.yes{color:var(--good);font-weight:700;}.no{color:var(--bad);font-weight:700;}.part{color:var(--warn);font-weight:700;}
em{font-style:italic;color:var(--ink);}
@media(max-width:760px){.vs,.counts,.scope{grid-template-columns:1fr;}}
</style>
</head>
<body>
<header class="hero">
  ${topNav(".")}
  <div class="hero-copy">
    <h1>How it works</h1>
    <p class="lead">Helm rebuilds your whole configuration from templates every time, so any change you made by hand is wiped on the next upgrade. We render the chart once into plain files, let you change anything afterward, and put your change back on every upgrade. This page explains the complete model. It covers the catalog, the recommended patterns, your choices, and the evidence behind each claim.</p>
    <p class="install-cub-note">The model has several concepts. Five important ones are shown below. There is a <a href="./d/docs/user/model-and-vocabulary.html">taxonomy of the additional terms</a>, and the <a href="./demo-org.html">demo org</a> has real examples.</p>
    <p><strong>Recipe, render, record, route.</strong> A recipe records the inputs. Rendering creates the exact objects. The record keeps the evidence with those objects. Routes describe the work that Helm leaves outside ordinary objects. Delivery sends the reviewed result onward, and observation reports what ran. Two layers support this process: Helm renders a base, then ConfigHub manages it. The catalog starts from a <a href="./charts/index.html#base-variants">base variant</a>, which is a supported way to run one chart version.</p>
    <p>New to ConfigHub? Follow the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "how-it-works")}">official tutorial</a>. Use the <a href="./try.html">short package exercise</a> when you only want to inspect one catalog package locally.</p>
    <p><strong>The simpler frame: OCI in, managed configuration, OCI out.</strong> Keep your Helm charts. The public tools support three paths: <code>work -&gt; OCI</code>, <code>OCI -&gt; work</code>, and <code>OCI -&gt; work -&gt; OCI</code>. Here, work means inspect, explain, test, scan, compare, or edit. <strong>Serverless</strong> means the work does not use ConfigHub Server; <strong>anonymous</strong> means it does not use a ConfigHub account. A local command or CI job can be both. Claim the configuration in ConfigHub when you want to save its history, make variants, require approval, promote changes, or roll it out to a fleet.</p>
    <p>The ready-made package path works now. <code>cub installer setup --output-oci</code> pulls one package and writes the selected Kubernetes files. It also writes the same non-secret objects as OCI. Before it returns, the installer pulls that OCI back and verifies the object-set digest. The <a href="./d/data/serverless-oci-gitops-proof/summary.html">live no-account NGINX proof</a> records the command, output digest, Flux result, and ready workload. The separate <a href="./d/data/anonymous-oci-ci-proof/summary.html">CI test</a> records the same public boundary in GitHub Actions.</p>
    <p>ConfigHub can sit inside an existing <code>Git -&gt; CI -&gt; OCI -&gt; Argo CD or Flux -&gt; Kubernetes</code> flow. It can first publish the same specs and user-supplied metadata, then make specific variants later. The ConfigHub release has its own OCI digest and adds <code>confighub.com/origin</code> for provenance. The <a href="./d/data/oci-deploy-stage-rollout-proof/summary.html">live OCI, promotion, and two-cluster test</a> records that unchanged pass-through. It also records a reviewed promotion and fingerprinted observations on both clusters. The <a href="./d/data/aicr-oci-roundtrip-proof/summary.html">AICR OCI round trip</a> proves the same object-preserving boundary for 17 generated Argo CD Applications. It does not claim controller or GPU health. <code>cub release publish</code> creates a ConfigHub Space release OCI. The same reviewed objects can also be packaged for anonymous or external consumers.</p>
    <p>The <a href="./d/data/oci-evidence-chains/summary.html">OCI evidence-chain index</a> follows one result through six checkpoints: source, reviewed configuration, ConfigHub record, output OCI, delivery, and live observation. It covers every supported starting format and shows <code>not-run</code> where a path stops. This makes it possible to see why two OCI digests differ and whether Argo CD or Flux actually consumed the output digest.</p>
  </div>
</header>
<main>

  <h2>1 · The core idea</h2>
  <p>Several tools can take part. Each one has a different job.</p>
  <table class="gtable">
    <tr><th>Item</th><th>Job</th></tr>
    <tr><td>Helm, AICR, or Kubernetes YAML</td><td>Supply the configuration you already have.</td></tr>
    <tr><td><code>cub installer</code>, <code>cub helm</code>, or CI</td><td>Prepare, render, or import the configuration.</td></tr>
    <tr><td>ConfigHub</td><td>Record, change, release, and promote the configuration.</td></tr>
    <tr><td>Argo CD, Flux, or Kubernetes</td><td>Deliver the reviewed configuration to a cluster.</td></tr>
  </table>
  <div class="vs">
    <div class="col helm">
      <h3>Helm: rebuilt from templates</h3>
      <ul>
        <li>Every setting has to be wired into the template up front.</li>
        <li>Need a setting the chart didn't expose? You're stuck, or you copy the whole chart.</li>
        <li><code>helm upgrade</code> rebuilds from the templates and <strong>overwrites</strong> what you changed.</li>
      </ul>
    </div>
    <div class="col">
      <h3>ConfigHub: kept as data you can query and edit</h3>
      <ul>
        <li>Render once to plain YAML Units you can read.</li>
        <li>Query the same records across apps and environments, without scraping clusters or hunting through templates first.</li>
        <li>Change <em>any</em> field afterward, by hand, a script, or an AI agent.</li>
        <li>The next upgrade <strong>keeps</strong> your change instead of wiping it.</li>
      </ul>
    </div>
  </div>

  <h3>Where a setting belongs</h3>
  <p>There are four places to look. Keeping them separate answers both questions: what should control a setting, and what controls it now.</p>
  <table class="gtable">
    <tr><th>Place</th><th>Use it for</th><th>What happens on upgrade</th></tr>
    <tr><td><strong>Helm values</strong></td><td>Choose the base shape: components, object count, storage mode, CRDs, ingress, Secret strategy, topology, or another choice that changes what Helm renders.</td><td>Change the recorded values and render a new base. The values profile remains linked to the objects it produced.</td></tr>
    <tr><td><strong>ConfigHub changes</strong></td><td>Change an exact field after render when the base is right but an environment, region, customer, policy, image, label, resource, or other object field must differ.</td><td>The edit is a Unit revision or derived variant. It is put back when the base is upgraded.</td></tr>
    <tr><td><strong>Install work</strong></td><td>Provide Secrets, CRDs, target facts, hooks, setup jobs, certificates, or other work needed around the objects.</td><td>The prerequisite or route is checked again. It is not hidden as a Helm value or a ConfigHub edit.</td></tr>
    <tr><td><strong>Live cluster</strong></td><td>Observe what actually ran and compare it with the reviewed objects.</td><td>A live-only edit is drift. Record an intended fix in ConfigHub, or remove the drift.</td></tr>
  </table>
  <p><strong>One field should not have two silent owners.</strong> If a new Helm render and a ConfigHub revision both change the same field, review the overlap before promotion and choose the intended result.</p>

  <h3>Where teams feel it</h3>
  <p><strong>Got values files?</strong> Helm gets painful when values are not enough. You may need to change rendered objects, policies, hooks, or surrounding resources. Keep Helm and render its objects as data. You can then make transparent variants instead of maintaining a permanent chart fork or hiding the result behind an overlay.</p>
  <p><strong>Upgrades and promotions?</strong> Even an unmodified chart can change many objects at once. Render the candidate before you approve it. Compare the old and new objects, test the variant, and review its receipts. Then promote the reviewed change toward production.</p>
  <p><strong>Private platform?</strong> Your teams may use many Helm features in their custom charts. The final YAML can still be hard to review before deployment or scan afterward. ConfigHub stores those renders as governed data. You can keep Argo CD or Flux and add approval, scanning, and observation around the exact objects.</p>
  <p><strong>Stop approving guesses.</strong> Preview one install, compare the difference between installs, then prove fleet changes with recorded data, diffs, gates, receipts, GitOps handoff, and live observations.</p>

  <h2>2 · The catalog: what's available</h2>
  <p>The catalog covers the most-used charts. Each chart is rendered, checked against plain Helm, scanned, and given an honest status. Today's proven scope:</p>
  <div class="scope">
    <div class="count"><b>20</b><span>charts live-tested end to end</span></div>
    <div class="count"><b>110</b><span>chart versions rendered</span></div>
    <div class="count"><b>2</b><span>reviewed bases per chart</span></div>
    <div class="count"><b>8</b><span>standard base shapes</span></div>
    <div class="count"><b>396</b><span>matrix rows tracked</span></div>
  </div>
  <p>Each chart ships a recommended <strong>default</strong> base variant plus one standard fork. The forks come from a fixed vocabulary, named by what they change, not bespoke per chart:</p>
  <p>Operators choose a vetted package release and a named base variant. They set only the small number of inputs that remain at install time. The catalog does not expose every Helm value again. It provides common paths that are reviewed, repeatable, and safe to reconcile across many installs.</p>
  <table class="gtable">
    <tr><th>Base shape</th><th>What it changes</th></tr>
    <tr><td><code>default</code></td><td>Honest out-of-the-box install; the recommended starting point.</td></tr>
    <tr><td><code>parameterized</code></td><td>Same shape as default, with fill-safe fields exposed as placeholders.</td></tr>
    <tr><td><code>existing-secret</code></td><td>Bring your own Secret instead of a generated one.</td></tr>
    <tr><td><code>no-crds</code></td><td>CRDs owned externally (by a controller or GitOps).</td></tr>
    <tr><td><code>ha</code></td><td>High-availability / scaled-out mode.</td></tr>
    <tr><td><code>ingress-tls</code></td><td>Exposed via ingress with TLS.</td></tr>
    <tr><td><code>minimal</code> · <code>tls</code></td><td>Lean install; or bring-your-own TLS material.</td></tr>
  </table>

  <h3>Three ways to create a base variant</h3>
  <p>ConfigHub can start from more than a Helm chart. The source stays attached to the literal configuration so a later reviewer can see what produced it and which choices remain.</p>
  <table class="gtable">
    <tr><th>Starting point</th><th>What you keep</th><th>How it enters ConfigHub</th></tr>
    <tr><td>Helm chart</td><td>The chart version, preset values, source lock, render intent, literal objects, and known hooks or CRDs.</td><td>Render a <code>cub installer</code> package. Keep the files locally, write the selected preset as OCI with <code>--output-oci</code>, or upload either form as a base variant.</td></tr>
    <tr><td>AICR</td><td>The AICR recipe, fixed component versions, remaining install-time inputs, generated bundle, checksums, and public OCI digest.</td><td>Keep the generated source package for Argo CD, and upload the separate literal configuration OCI as a base variant. The <a href="../docs/demo/aicr/eks-h100-training-kubeflow.md">AICR GPU platform example</a> shows the public packages, 17 exact Applications, development change, and staging promotion.</td></tr>
    <tr><td>Existing Kubernetes configuration</td><td>The original files and source reference.</td><td><code>cub variant upload &lt;files-or-oci-ref&gt;</code> creates the base Space and Units.</td></tr>
  </table>
  <p>The generated <a href="../data/base-variant-records/summary.md">base-variant records</a> use one common shape for these sources. The record distinguishes a multi-preset source package OCI, a single literal configuration OCI, and the later ConfigHub release OCI used for delivery.</p>

  <h2>3 · The lifecycle: recipe → render → record → route → change</h2>
  <p>A chart runs as two layers: <strong>how Helm renders it</strong> (recipe → base variant → render intent → rendered output) and <strong>how ConfigHub operates it</strong> afterward (managing variants). The source-neutral base-variant record joins those layers without replacing the Helm record. Here are the steps, each named for what it does. (The small grey codes are the catalog's own labels, if you read the matrix.)</p>
  <p>Inspect the evidence for a base variant in this order:</p>
  <ol>
    <li>Open the full rendered YAML.</li>
    <li>Open the render intent. It records the Helm inputs.</li>
    <li>Open the route records. They describe hooks, CRDs, setup jobs, required cluster facts, and other work outside ordinary objects.</li>
  </ol>
  <table class="gtable">
    <tr><th>What to open</th><th>What it tells you</th></tr>
    <tr><td><code>rendered/release-objects.yaml</code></td><td>The Kubernetes objects captured from one reviewed render. This is the output, not the whole model.</td></tr>
    <tr><td><code>HelmRenderIntent</code></td><td>The chart version, values profile, namespace, release name, capability profile, source lock, rendered output path, evidence links, and known route facts.</td></tr>
    <tr><td>Chart extras and routes</td><td>How this chart handles hooks, CRDs, setup jobs, generated Secrets, target prerequisites, GitOps handoff, blockers, or per-target decisions.</td></tr>
  </table>

  <div class="fstage">
    <span class="ftag">RECIPE</span><span class="codetag">F1 · source</span>
    <h3>The recipe: your source of truth</h3>
    <p>A recipe is the chart and version, the values you chose, the base you picked, and the locks, kept in git. It's the one place your intent lives. Nothing is rendered yet.</p>
  </div>

  <div class="fstage star">
    <span class="ftag">RENDER</span><span class="codetag">F2 · base → rendered output</span>
    <h3>Render: inputs first, then the frozen objects</h3>
    <p>A <strong>base variant</strong> is a <a href="./charts/index.html#base-variants">named render choice</a> such as default, no-crds, or ha. Its <strong>render intent</strong> records the inputs for that choice: chart version, values profile, namespace, capabilities, source lock. Rendering those inputs once produces the <strong>rendered output</strong>: the exact Kubernetes objects, frozen with a checksum. Intent first, then the captured output. The rendered output is never re-rendered. It is what you read before install, what we compare against plain Helm, and what your controller pulls unchanged. The <em>render boundary</em> is simple. Changing the object set makes a new base variant. Changing only the operating context needs no re-render.</p>
    <p><strong>Example:</strong> Redis <code>default</code> has a package users pull, <code>${REDIS_INSTALLER_OCI_REF}</code>; a <a href="../data/helm-render-intents/intents/bitnami-redis-25-5-3-default.yaml">render intent</a> that records the Helm inputs; and a full rendered YAML output, <a href="../recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml">release-objects.yaml</a>. The <a href="../recipes/bitnami/redis/25.5.3/revisions/default/r001/variant-revision.yaml">revision</a> binds that YAML to checksums, and the <a href="../packages/bitnami/redis/25.5.3/bases/default/">package base</a> is the repo source for that base variant. Redis has no hook route; charts with hooks or CRDs carry that context in lifecycle routes and target facts. For more examples, see <a href="../data/helm-render-intents/summary.md">the render-intent summary</a>.</p>
  </div>

  <div class="fstage">
    <span class="ftag">RECORD</span><span class="codetag">the proof bundle</span>
    <h3>Record: the evidence, kept with the render</h3>
    <p>We keep the evidence with each render. It includes checksums, Helm-equivalence evidence, a security scan, an install gate, diffs, and live observations where they exist. A later reviewer or agent can inspect the exact render and repeat the same test. The render intent is the compact, machine-readable index for this evidence.</p>
  </div>

  <div class="fstage">
    <span class="ftag">ROUTE</span><span class="codetag">F3 · prerequisites &amp; routes</span>
    <h3>Route: the work Helm leaves at the edges</h3>
    <p>Helm can do more than produce ordinary YAML. A chart may install CRDs, run setup jobs, or generate Secrets. It can also require cloud identity, storage, or another existing cluster resource.</p>
    <p>We record the right choice for each chart with its inputs, output, tests, and receipts. A base can include its CRDs or leave them to the cluster. It can require a tested setup step or an existing target resource. The catalog blocks the path when no safe default exists. A route records that decision and its evidence boundary. It is automatic only when the product runs it and a receipt proves the result.</p>
    <p>The render intent separates requirements declared by the base from follow-up actions learned in live tests. For a recorded lifecycle route, it also says what Argo CD does and what Flux does for that exact chart version and base.</p>
  </div>

  <div class="fstage star">
    <span class="ftag">CHANGE</span><span class="codetag">F4 · derived variant</span>
    <h3>Change: derive from a base, and ConfigHub manages it</h3>
    <p>A <strong>derived variant</strong> changes a base after render. It can set the target, region, labels, or approvals, or it can edit any field. Create one per environment from a single base. The next upgrade keeps those edits. ConfigHub manages the review, promotion, approval, and delivery. It also observes the live result. Managed is a property, not a separate kind; a base variant can also be managed. Helm cannot provide this post-render history by itself.</p>
  </div>

  <h3>The five words: Variants, in one picture</h3>
  <table class="gtable">
    <tr><th>Word</th><th>What it is</th><th>Re-renders Helm?</th><th>Lives in</th></tr>
    <tr><td><strong>Recipe</strong></td><td>The source of renders: chart, version, values, declared bases, declared routing intent.</td><td>It is what gets rendered</td><td>the repo and the package</td></tr>
    <tr><td><strong>Base variant</strong></td><td>A recipe rendered one named way (default, no-crds, ha…). Changing what gets installed means a new base variant.</td><td>Yes, once, and it's checked against Helm</td><td>the package; a root Space after upload</td></tr>
    <tr><td><strong>Rendered output</strong></td><td>The <em>frozen, checksummed objects</em> a rendering produced; with its render intent it forms the render record.</td><td>No, it's already rendered</td><td>the recipe's revisions</td></tr>
    <tr><td><strong>Derived variant</strong></td><td>A change derived from a base: per-environment context or later edits, upstream link recorded.</td><td>No</td><td>ConfigHub</td></tr>
  </table>
  <p class="quiet-line">Any of these can be <strong>managed</strong>: that's ConfigHub operating it (compare, promote, approve, deliver, observe), a property rather than a fifth kind. One sentence for the whole picture: a recipe renders into a base variant; a base variant clones into derived variants; promotions carry reviewed changes down.</p>

  <h3>Where the recipe lives, today and next</h3>
  <p>Inside a ConfigHub org, you see Units, clones, revisions, and links. The source recipe lives in this repository and in the package. Every catalog Space also carries a plain data Unit named <code>recipe</code>. It sits beside the objects that recipe produced. The table compares the three forms.</p>
  <table class="gtable">
    <tr><th></th><th>The recipe in this repo</th><th>The <code>recipe</code> unit in an org</th><th>A first-class source object (where this is heading)</th></tr>
    <tr><td><strong>What it is</strong></td><td>The authoritative source: chart pin, source lock, per-base values, revisions.</td><td>A generated record of one render's inputs, placed as data beside the output.</td><td>An executable source object: repository, chart, version, values, in one unit.</td></tr>
    <tr><td><strong>Carries the values?</strong></td><td>Yes; it is the values.</td><td>No; it points at them in the repo.</td><td>Yes, self-contained.</td></tr>
    <tr><td><strong>Who acts on it</strong></td><td>The catalog pipeline builds the package from it.</td><td>Nobody; the render already happened outside.</td><td>A worker renders it, and re-renders it when it changes.</td></tr>
    <tr><td><strong>Connected to its outputs?</strong></td><td>Through the repo's evidence chain.</td><td>Sits in the same Space, no link.</td><td>Linked to the units it rendered.</td></tr>
    <tr><td><strong>Authority</strong></td><td>Authoritative.</td><td>A copy; it can lag the repo.</td><td>Would become authoritative.</td></tr>
  </table>
  <p class="quiet-line">The <code>recipe</code> unit is the future source object with the machinery removed: a plaque in the seat where the engine goes. It marks the spot; it does not run. When source objects become first-class, this catalog's hundred recipes are ready to become real ones.</p>

  <h2>4 · The decisions, and why</h2>
  <table class="gtable">
    <tr><th>We chose to…</th><th>…because</th></tr>
    <tr><td>Keep config <strong>fully rendered</strong> (not templated)</td><td>So you can change any field after install and the change survives upgrades. And the proof is the desired config itself, not a side effect of running an engine.</td></tr>
    <tr><td><strong>Freeze</strong> the render instead of re-rendering</td><td>What you read is exactly what installs and what your controller delivers, with no re-render drift between review and runtime.</td></tr>
    <tr><td><strong>Name every route</strong> (hooks, CRDs, prereqs)</td><td>Every behaviour Helm handled outside normal objects still has to be owned, tested, skipped, or blocked. The catalog records that decision per base variant.</td></tr>
    <tr><td>Mark routes <strong>automatic: false</strong> until earned</td><td>Nothing is called automatic until the product actually runs the route and committed evidence proves it. No claim ahead of proof.</td></tr>
    <tr><td>Report an honest <strong>disposition</strong> (synced ≠ working)</td><td>GitOps can say "Synced" while the workload is broken. Separate lanes make the real problems explicit instead of hiding them behind one green tick.</td></tr>
    <tr><td>Offer <strong>existing-secret</strong> bases</td><td>A default that ships a generated password installs green but breaks silently over GitOps (the pod can't find the Secret while Argo still says Synced). Bring-your-own is the safe path.</td></tr>
  </table>

  <h2>5 · Recommended patterns</h2>
  <p>Take the smallest path that does the job, and grow only when you need to:</p>
  <table class="gtable">
    <tr><th>You want to…</th><th>Recommended path</th></tr>
    <tr><td>Just see the objects</td><td>Render and read them. No account, no cluster.</td></tr>
    <tr><td>Install one chart</td><td>Start at the chart's <code>default</code> base: <code>cub installer setup --pull &lt;installer OCI ref&gt; --base default</code>.</td></tr>
    <tr><td>Run a database / anything with a password</td><td>Use the <code>existing-secret</code> base and supply the Secret yourself. Don't ship a generated one over GitOps.</td></tr>
    <tr><td>Change something after install</td><td>Make a <strong>derived variant</strong>. It keeps your change through upgrades, no re-render.</td></tr>
    <tr><td>Run dev / staging / prod</td><td>One base → many derived variants (per environment, region, customer). The base stays single; the instances live in ConfigHub.</td></tr>
    <tr><td>Already run Argo or Flux</td><td>Keep your controller. Publish once to OCI; point Argo/Flux at the same bundle.</td></tr>
  </table>

  <h3>Checks before apply</h3>
  <p>The same apply policy can protect configuration that started as Helm, AICR, <code>cub installer</code>, Kubara, Sveltos, or ordinary Kubernetes files. Schema, placeholder, and lifecycle-route checks block incomplete configuration. Ordinary workloads and AICR training runtimes receive checks for the fields they actually use. Production releases and system configuration keep those ${policyFacts.baselineChecks} checks and add one required approval.</p>
  <p>The source format does not decide the risk. A user workload, shared service, and cluster-wide configuration can all begin as Helm or YAML. The live demo applies ${policyFacts.baselineChecks} common tests to ${policyFacts.baselineSpaces} Spaces. It adds approval to ${policyFacts.approvalSpaces} Spaces: ${policyFacts.productionSpaces} production Spaces and ${policyFacts.systemConfigurationSpaces} system-configuration Spaces. The receipt includes every maintained starting format: ${sourceCoverage}. Read the <a href="../data/apply-policy-profiles/summary.md">policy profile and live receipt</a>. You can also run its verifier while logged into the <code>helm-catalog</code> org.</p>
  <p>The <a href="../data/operational-class-examples/summary.md">three worked examples</a> show how ownership changes the policy. An application team owns and promotes NGINX. A platform team introduces Kube Prometheus Stack as a shared service. Kubara is approved as cluster-wide platform configuration. Each example names the target, tests, rollout order, current result, and receipt.</p>

  <h3>Worked paths and Apps</h3>
  <p>The <a href="../docs/user/config-catalog-demonstrations.md">demonstration programme</a> tracks the Helm, AICR, cub installer, OCI, promotion, Kubara, and Sveltos paths. It also states which ConfigHub Apps work today and which remain partial or planned. The <a href="../docs/demo/hooks-crds/kube-prometheus-stack.md">Kube Prometheus Stack example</a> gives one complete chart-specific route plan. The <a href="../docs/demo/apps/rbac-review.md">RBAC review example</a> shows one exact permission correction. That correction is tested, approved, published as OCI, and delivered by Argo CD.</p>

  <h2>6 · What's yours to decide</h2>
  <p>Some choices we can't make for you. They depend on <em>your</em> cluster, your secrets, your policy. We surface them clearly and recommend a default, but the call is yours. We guide; you decide.</p>
  <div class="decide"><p><strong>Which base fits.</strong> We recommend <code>default</code>, but you know whether you need <code>ha</code>, <code>no-crds</code>, or <code>existing-secret</code>. The catalog names the trade-off; you pick.</p></div>
  <div class="decide"><p><strong>Namespace.</strong> Simple charts honour <code>--namespace</code>. Some complex charts embed a namespace in their objects and must install at their canonical one. The chart page says which.</p></div>
  <div class="decide"><p><strong>Image pinning.</strong> Some default bases ship a floating tag. For reproducible, digest-bound delivery, pin it: <code>--set-image NAME=repo/img@sha256:…</code>.</p></div>
  <div class="decide"><p><strong>Secrets.</strong> Bring your own via the <code>existing-secret</code> base and stage it out-of-band (ExternalSecrets, Vault, or <code>kubectl</code>). We can't invent your production secret.</p></div>
  <div class="decide"><p><strong>Prerequisites &amp; target facts.</strong> Some bases need a Secret, a CRD, a namespace, or a cluster value to exist <em>first</em>. Stage them before applying, or choose a base that includes them. Each one is listed, not assumed.</p></div>
  <div class="decide"><p><strong>When to use Helm directly.</strong> If a chart is not in the catalog, use <code>helm template</code> or <code>helm install</code> and record the chart, version, values, namespace, and release name. You can later upload the rendered files with <code>cub variant upload</code>.</p></div>

  <h2>7 · How to check the claims</h2>
  <p>When a chart page says a path passes, is blocked, or is ready to try, that claim should be backed by files you can inspect. In this repo we call those checks <strong>verification</strong>. Some checks compare generated files on your machine; some use a fresh Kubernetes cluster.</p>
  <table class="gtable">
    <tr><th>Check file</th><th>Question it answers</th></tr>
    <tr><td><code>render-receipt</code></td><td>Did the same inputs produce the same Kubernetes objects twice?</td></tr>
    <tr><td><code>helm-equivalence-receipt</code></td><td>Does the cub render match plain <code>helm template</code> for this base variant?</td></tr>
    <tr><td><code>scan-receipt</code></td><td>What security findings were found in the rendered objects?</td></tr>
    <tr><td><code>install-gate</code></td><td>Is this render safe to try, does it need review, or is it blocked?</td></tr>
    <tr><td><code>object-inventory</code> · <code>variant-revision</code></td><td>Which exact Kubernetes objects and checksums belong to this render?</td></tr>
  </table>
  <p>The model has four steps: <strong>recipe → render → record → route</strong>. Lock the inputs, render the objects, keep the check files with them, and record the extra work Helm leaves around the edges. Live results are reported one lane at a time, not as one blanket success mark:</p>
  <div class="counts">
    <div class="count pass"><b>961</b><span>pass</span></div>
    <div class="count watch"><b>116</b><span>watch</span></div>
    <div class="count bad"><b>124</b><span>blocked</span></div>
    <div class="count"><b>87</b><span>not yet run</span></div>
    <div class="count"><b>1484</b><span>not applicable</span></div>
  </div>
  <p><strong>watch</strong> means read the warning first. <strong>blocked</strong> means do not use that path yet. <strong>not applicable</strong> means the test does not apply to that chart. You can verify the evidence three ways:</p>
  <table class="gtable">
    <tr><th>Way to check</th><th>Needs a cluster?</th><th>What it confirms</th></tr>
    <tr><td>Run the render check yourself (<code>npm run &lt;chart&gt;:verify-install:render</code>)</td><td>No</td><td>Your own render matches the catalog's recorded contract.</td></tr>
    <tr><td>Re-verify the committed evidence (<code>npm run verify</code>)</td><td>No</td><td>The receipts, hashes, and generated files are self-consistent.</td></tr>
    <tr><td>Run a fresh live lane (<code>npm run kind-parity:run</code> / <code>live-parity:run</code>)</td><td>Yes</td><td>Helm vs cub, and OCI→Argo/Flux, on a throwaway cluster.</td></tr>
  </table>

  <h2>8 · What's idempotent, what's deterministic, and why</h2>
  <p>Some catalog steps are pure computations that you can reproduce offline. Other steps touch a live cluster and cannot produce byte-identical results. The table states which type each step belongs to.</p>
  <table class="gtable">
    <tr><th>Stage</th><th>Idempotent?</th><th>Reproducible from source, no cluster?</th><th>Why</th></tr>
    <tr><td><strong>Render</strong> (recipe → objects)</td><td class="yes">yes</td><td class="yes">yes, byte-identical</td><td>kustomize over the frozen upstream with pinned inputs; same inputs always give the same objects.</td></tr>
    <tr><td><strong>Record</strong> (receipts, checksums)</td><td class="yes">yes</td><td class="yes">yes</td><td>Just hashing and writing committed content, no live state.</td></tr>
    <tr><td><strong>Catalog / matrix / site views</strong></td><td class="yes">yes</td><td class="yes">yes</td><td>Re-derived from the committed recipes; stable joins, stable order.</td></tr>
    <tr><td><strong>Route</strong> (hooks / CRDs / prereqs)</td><td class="part">plan: yes</td><td class="part">plan: yes · run: no</td><td>Naming and classifying is pure; <em>running</em> a route touches a cluster and may have side effects.</td></tr>
    <tr><td><strong>Apply</strong> (kubectl / Argo / Flux)</td><td class="yes">yes, apply + prune converges</td><td class="no">no</td><td>Declarative apply converges to the same state, but it's a live action on a cluster.</td></tr>
    <tr><td><strong>Live proof / disposition</strong></td><td class="no">no</td><td class="no">no, not byte-deterministic</td><td>It observes a real cluster: pod scheduling, image pulls, controller timing. Each run is a new, point-in-time observation.</td></tr>
  </table>
  <p class="quiet-line">A <strong>rename or re-derivation regenerates offline</strong> from committed source. A <strong>fresh live result needs a cluster</strong>. Live runs are serial and use one temporary cluster at a time. <code>cub cluster up</code> creates that local kind cluster. <code>cub cluster down</code> removes it afterward. Render parity is not a live result, and a warning is not a pass.</p>

  <h2>9 · Delivery: publish the reviewed Space once</h2>
  <p>Set the Space's release target, then publish the reviewed Units as one immutable release OCI. Argo CD, Flux, or a recorded direct-apply path can pull the same files. None of them renders the chart or source package again.</p>
  <pre><code>cub space update &lt;app-space&gt; --release-target &lt;cluster-space&gt;/oci
cub release publish &lt;app-space&gt;

# Argo CD Application source
source:
  repoURL: oci://oci.hub.confighub.com:443/space/&lt;app-space&gt;
  targetRevision: latest
  path: .

# Flux source
apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
spec:
  url: oci://oci.hub.confighub.com:443/space/&lt;app-space&gt;
  ref:
    tag: latest</code></pre>
  <p class="quiet-line">A small routed-hook fixture proves that three delivery methods can consume one ConfigHub release OCI and complete the same setup Job. The first exact catalog result uses the real <code>bitnami/nginx@24.0.2</code> <code>http-clusterip</code> preset. <code>cub installer</code> reproduced its committed objects, and ConfigHub published them once. Argo CD, Flux, and direct apply reported the same release digest and a ready NGINX workload. Read the <a href="../data/catalog-oci-delivery-proof/summary.md">plain-English result</a> or the <a href="../runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml">receipt</a>. Every other catalog configuration still needs its own receipt before its page can make that delivery claim.</p>
  <div class="honest">
    <h3>What direct apply still has to handle</h3>
    <p>The recorded direct path proves a first apply for one NGINX configuration. A reusable direct-delivery path also needs explicit behavior for these cases:</p>
    <ul>
      <li><strong>Generated passwords.</strong> A chart default may create a Secret that should not become a shared, repeatable credential. Choose an <code>existing-secret</code> preset when the chart supports one.</li>
      <li><strong>CRD ordering.</strong> Apply CRDs first, wait for them to become available, then apply the objects that use them.</li>
      <li><strong>Field conflicts and removals.</strong> Show who owns a conflicting field and define which removed objects may be pruned.</li>
    </ul>
    <p>The catalog records these requirements per preset. A path is called automatic only after a receipt shows that it performed the required work.</p>
  </div>

  <h2>10 · Letting AI make the changes, safely</h2>
  <h3>AI-assisted changes, with control</h3>
  <p>AI can make a change faster than a person can review it. An agent therefore edits the rendered files, not hidden live state. Before delivery, you inspect the exact diff, scan for secrets and bad settings, and record an approval. If a bad value gets through, you can restore an earlier revision. The AI proposes the change. A person or policy approves it. The cluster receives only the approved result.</p>

  <h2>11 · What the status words mean</h2>
  <p>This page is not a blanket promise that every chart, controller, hook, or cluster path is ready. It shows what has been checked, what still needs work, and what a user should do next.</p>
  <table class="gtable">
    <tr><th>Status or label</th><th>What it means</th></tr>
    <tr><td><code>pass</code></td><td>The named check has committed evidence. Open the receipt if you need to see exactly what was tested.</td></tr>
    <tr><td><code>watch</code></td><td>The path may be useful, but there is a named risk or prerequisite to read before you use it.</td></tr>
    <tr><td><code>blocked</code> or <code>refused</code></td><td>Do not use that catalog path yet. Choose another base variant, use Helm directly, or add the missing setup work.</td></tr>
    <tr><td><code>automatic</code></td><td>ConfigHub only uses this word when it runs the step and a receipt exists. Otherwise the page names who must run it.</td></tr>
    <tr><td>GitOps delivery</td><td>The three-consumer fixture proves the OCI delivery mechanism. Each catalog configuration remains unproved for a controller until its own receipt records the sync and workload result.</td></tr>
  </table>
  <p class="quiet-line"><a href="./try.html">Get started</a> · <a href="./charts/index.html">Browse the catalog</a> · <a href="./verification.html">Read the proofs</a></p>
</main>
<footer>${generatedStamp(catalog, "how it works guide")}<p>Generated from committed helm-expt evidence. This guide explains the public mental model; generated evidence remains the source for exact status.</p></footer>
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
    ["Inspect a render", "Use helm template for any chart, or cub installer setup for a catalog preset, when you only need to see the Kubernetes objects.", "Free"],
    ["Try a catalog package", "Use cub installer setup for a maintained catalog base with rendered objects, receipts, scans, and local verification.", "Free or low-friction"],
    ["Upload when state matters", "Use cub installer upload when the reviewed objects should become ConfigHub Units for variants, diffs, and later teams or approvals.", "Free account"],
    ["Operate after upload", "Use variants, diffs, scans, gates, promotions, GitOps/OCI handoff, observations, upgrades, rollbacks, and receipts.", "Free account, paid at scale"],
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
  <title>Config Test Centre</title>
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
        <h3><a href="./try.html">Try one package in 5 minutes</a></h3>
        <p>Render and inspect Redis locally. You do not need ConfigHub Server, a ConfigHub account, or a Kubernetes cluster.</p>
        <pre><code>cub installer setup \\
  --pull ${REDIS_INSTALLER_OCI_REF} \\
  --base reuse-existing-secret --work-dir ./redis \\
  --non-interactive --namespace redis \\
  --output-oci ./redis-25.oci</code></pre>
        <span class="go"><a href="./try.html">Open the short exercise →</a></span>
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
      <p>Prometheus is the public first-run chart. kube-prometheus-stack is the larger proof path because it combines object fanout, CRDs, webhooks, RBAC, generated facts, extension slots, target prerequisites, GitOps, and live observation boundaries.</p>
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
      <p>Many Helm charts expose raw manifests, tpl snippets, config blocks, sidecars, or add-on slots. Supported bases keep those slots empty or controlled. If a user populates one, make it a reviewed cub installer base with render parity, scans, gates, and receipts.</p>
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
        <li><a href="../data/app-readiness/summary.md">RBAC permissions in catalog charts</a></li>
        <li><a href="../data/rbac-review-live-proof/summary.md">Live RBAC correction proof</a></li>
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
  return legacyOfferingHtml(catalog);
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
    ["Inspect and template", "Use helm template or a catalog package's rendered-object views before committing to ConfigHub state."],
    ["Use catalog packages", "Run cub installer setup --pull oci://... --base <base> for supported catalog bases."],
    ["Pull package artifacts", "Use package or OCI artifacts where available without uploading private repo or production state."],
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
    ["New Helm user", "Wants to see what a chart will do before it creates Secrets, CRDs, RBAC, storage, or workloads in a cluster."],
    ["App team or GitOps operator", "Wants dev, staging, prod, region, and customer differences without values sprawl, fork pressure, or copy-paste promotion."],
    ["Platform SRE", "Wants blast-radius preview, prerequisites, receipts, and observation freshness before fleet changes ship."],
    ["Security reviewer", "Wants scans and gates on exact rendered objects before deployment."],
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
    ["Quick render", "See what any chart renders without ConfigHub state.", "helm template", "Free/direct"],
    ["One-shot upload", "Load rendered files or a literal configuration OCI into ConfigHub Units.", "cub variant upload <files-or-oci-ref>", "ConfigHub account"],
    ["Catalog package", "Use a maintained base with render parity, receipts, scans, and proof.", "cub installer setup --pull oci://... --base <base>", "No ConfigHub account or registry login for public package pulls"],
    ["Reviewed ConfigHub base", "Upload a reviewed rendered base before variants or approvals.", "cub installer upload", "ConfigHub account"],
    ["Derived operations", "Create environment, region, customer, or target variants after upload.", "cub variant create", "ConfigHub-managed"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Config Test Centre Offering</title>
  <style>${siteCss()}
    .hero { padding-top: 56px; }
    .hero h1 { max-width: 900px; }
    .route { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 18px 0; }
    .route div { border: 1px solid var(--line); border-radius: 6px; padding: 10px; background: var(--panel); font-size: .9rem; }
    .split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    nav { color: var(--muted); margin-bottom: 24px; }
    @media (max-width: 900px) { .route, .split { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Public Helm charts, in visible and verifiable stages.</h1>
    <p class="tagline">Keep Helm charts as the source. Use ConfigHub to make the rendered config visible, reviewable, and safer to operate.</p>
    ${humanLinks([["Get started", "./try.html"], ["Choose a chart", "./charts/index.html"], ["Read how it works", "./how-it-works.html"]])}
  </header>
  <main>
    ${generatedStamp(catalog, "offering page")}
    <section aria-labelledby="problem">
      <h2 id="problem">The Problem We Are Solving</h2>
      <p>Helm users can usually install something. The harder problem changes by audience: a new user cannot see what will land until after the install; an app team ends up with values-file sprawl and forks; a platform reviewer cannot prove blast radius, approvals, delivery, and live convergence at fleet scale.</p>
      <p>ConfigHub's answer is staged visibility: render first, turn common install shapes into named base variants, keep derived variants explicit, and attach scans, gates, receipts, GitOps handoff, and observations to the object set.</p>
      <p>The catalog keeps the supported path close to the chart author's golden path, but makes each stage visible. That matters when humans or AI agents make changes: the recipe, variant, rendered objects, scans, gates, and live receipts show whether the change stayed on the path or created a new install shape that needs review.</p>
      <p>This is the Helm-facing slice of Generative GitOps: render once, hold the result as data, show what was checked, and keep GitOps delivery. The current catalog proves the import and staged lifecycle path; full field authority, fleet propagation, and authorized live-to-desired reconciliation are not fully proven yet. <a href="../docs/user/generative-gitops-fit.md">Read the fit and limits</a>.</p>
      <p>Render parity is necessary, but it is only the starting point. It proves the cub installer path preserved Helm's intended object set for recorded inputs. The harder value is making target facts and lifecycle prerequisites explicit: staged CRDs, admission certificates, provider credentials, controller-owned fields, hook routes, and live observation boundaries.</p>
      <p>kube-prometheus-stack is the main example. Its no-CRDs base is not just a smaller YAML bundle; it is a contract that compatible CRDs and admission certificate material must already exist or be staged before config-only delivery. The catalog records that contract instead of treating a green render as a complete install.</p>
      ${markdownLikeTable([
        ["Current limit", "Current status"],
        ...frontierRows,
      ])}
      <div class="grid">
        ${personaRows.map(([title, body]) => `<div class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="offer">
      <h2 id="offer">What The Offering Is</h2>
      <p>A public catalog of maintained Helm-derived packages, plus a ${signupLink("offering", "free ConfigHub account")} that lets you edit the rendered config and keep your edits through upgrades. The paid tier covers private charts, teams, policies, fleet operations, and production support.</p>
      <p>The free lane lets you browse, inspect, template, and install catalog chart bases without a ConfigHub account. With a ${signupLink("offering", "free account")} you can also edit any rendered field and keep it through upgrades, plus basic variants, diffs, and scans. The paid lane covers private charts, custom catalogs, teams, policies, approvals, fleet operations, GitOps and OCI at scale, patch and upgrade services, and production support.</p>
      ${markdownLikeTable([
        ["What you get", "No account", "Free account", "Paid"],
        ["Browse, inspect, and template catalog charts", "Yes", "Yes", "Yes"],
        ["Install a chart base and read the exact objects", "Yes", "Yes", "Yes"],
        ["Edit a rendered field and keep it through upgrades", "No", "Yes", "Yes"],
        ["Environment variants, diffs, and scans", "No", "Basic", "Full"],
        ["Private charts and custom catalogs", "No", "No", "Yes"],
        ["Teams, policies, and approvals", "No", "No", "Yes"],
        ["Fleet operations, GitOps and OCI at scale", "No", "No", "Yes"],
        ["Patch and upgrade services, production support", "No", "No", "Yes"],
      ])}
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
      <p>The first path is closer to <code>helm install redis</code> than to a platform migration. Start with a catalog package and local verification. A ${signupLink("offering", "ConfigHub account")} is free: use it to edit the rendered config and keep your edits through upgrades. The paid tier is for private inputs, teams, and production workflows.</p>
      <pre>cub installer setup --pull ${REDIS_INSTALLER_OCI_REF} \\
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
        ["works-with-operator-review", top100UserReadinessCounts["works-with-operator-review"] ?? 0, "Render proof exists, but an operator needs to review the named concern first."],
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
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Try One Catalog Package · Config Test Centre</title>
<style>${siteCss()}</style>
</head>
<body>
<header class="hero human-hero">
  ${topNav(".")}
  <h1>Try one catalog package</h1>
  <p class="lead">Render one reviewed Redis configuration. Read the Kubernetes objects before you decide where they go.</p>
  <p>This exercise does not contact ConfigHub Server or Kubernetes. You do not need a ConfigHub account or a Google registry login.</p>
</header>
<main>
  <section aria-labelledby="install-cub">
    <h2 id="install-cub">1. Install cub and the package plugin</h2>
    <p>Install the ConfigHub CLI. Then install the plugin that reads catalog packages.</p>
    <pre><code>$ ${CUB_CLI_INSTALL_COMMAND}
$ export PATH="$HOME/.confighub/bin:$PATH"
$ ${INSTALLER_PLUGIN_INSTALL_COMMAND}
$ cub installer version
$ kustomize version</code></pre>
    <p>The plugin release contains the program for your operating system. You do not need Go.</p>
    <p>If <code>kustomize version</code> fails, follow the <a href="${KUSTOMIZE_INSTALL_URL}">official Kustomize installation instructions</a>.</p>
    ${installerCommandNoteHtml()}
  </section>

  <section aria-labelledby="render-package">
    <h2 id="render-package">2. Render the Redis package</h2>
    <p>The public package contains named Redis configurations. Select the configuration that uses a Secret supplied by the target.</p>
    <pre><code>$ cub installer setup --pull ${REDIS_INSTALLER_OCI_REF} \\
    --base reuse-existing-secret \\
    --work-dir ./redis \\
    --namespace redis \\
    --non-interactive \\
    --output-oci ./redis-25.oci</code></pre>
    <p><code>cub installer</code> writes 14 Kubernetes objects and no Secret. It also writes a local OCI image layout.</p>
    <p>The command reads the OCI output back and compares its object-set digest. It reports <code>pull-back: verified</code> when the comparison passes.</p>
  </section>

  <section aria-labelledby="inspect-result">
    <h2 id="inspect-result">3. Inspect the result</h2>
    <p>Read the selected configuration and its objects. Nothing has been applied to a cluster.</p>
    <pre><code>$ cat ./redis/out/spec/selection.yaml
$ ls ./redis/out/manifests
$ grep -R "^kind:" ./redis/out/manifests</code></pre>
    <p>The catalog keeps the source inputs beside the result. It also records the required Secret and the checks for this configuration.</p>
    <p><a href="../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml">Read the full Kubernetes YAML</a> · <a href="../data/helm-render-intents/intents/bitnami-redis-25-5-3-reuse-existing-secret.yaml">Read the recorded inputs and requirements</a> · <a href="./d/data/redis-public-walkthrough-proof/summary.html">Read the anonymous run result</a></p>
  </section>

  <section aria-labelledby="choose-next">
    <h2 id="choose-next">Choose what happens next</h2>
    <div class="grid">
      <div class="card">
        <h3>Local: no server</h3>
        <p>Pull public packages without signing in. Keep the files or OCI on your machine. Test them locally or in CI.</p>
        <p><a href="./serverless.html">Read the no-server guide</a></p>
      </div>
      <div class="card">
        <h3>Hosted: no sign-in</h3>
        <p>Inspect and test public configuration through a hosted service. This anonymous service is planned and is not released.</p>
        <p><a href="./future.html">Read the current status</a></p>
      </div>
      <div class="card">
        <h3>ConfigHub: sign in</h3>
        <p>Use ConfigHub when you want saved changes, releases, environments, and promotion.</p>
        <p><a class="button" href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "try")}">Continue with the official tutorial</a></p>
      </div>
    </div>
    <p>Public package and OCI pulls already work without registry login. The <a href="./d/data/anonymous-oci-ci-proof/summary.html">anonymous CI result</a> records that local path.</p>
  </section>

  <section aria-labelledby="other-inputs">
    <h2 id="other-inputs">Start with your own configuration</h2>
    <p>The same ConfigHub journey can start from other sources. Each path first gives you exact Kubernetes objects to inspect.</p>
    <div class="grid">
      <div class="card"><h3>Helm chart and values</h3><p>Render your chart and values without applying them. Compare the result with known catalog configurations.</p><p><a href="./testing.html#bring-your-own">Review Helm values</a></p></div>
      <div class="card"><h3>AICR</h3><p>Inspect the selected components, allowed install settings, and generated Argo CD Applications.</p><p><a href="./testing.html#aicr-platform">Open the AICR example</a></p></div>
      <div class="card"><h3>OCI or Kubernetes YAML</h3><p>Inspect the existing objects and record their source before you save or change them.</p><p><a href="./testing.html#catalog-starting-points">Choose an existing-config path</a></p></div>
    </div>
  </section>

  <section aria-labelledby="full-walkthrough">
    <h2 id="full-walkthrough">Need the complete Redis example?</h2>
    <p>The detailed walkthrough adds Helm parity, a live cluster, a major upgrade, ConfigHub promotion, two-cluster delivery, and rollback.</p>
    <p><a class="button" href="./redis-walkthrough.html">Open the detailed Redis walkthrough</a></p>
  </section>
</main>
<footer>${generatedStamp(catalog, "short catalog package guide")}<p>The first three steps use no ConfigHub Server and no ConfigHub account.</p></footer>
</body>
</html>
`;
}

function redisWalkthroughHtml(catalog) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Detailed Redis Walkthrough · Config Test Centre</title>
<style>${siteCss()}
.callout{border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:8px;background:var(--panel);padding:14px 16px;margin:16px 0;}
.callout p{margin:0;color:var(--ink);}
.steps-line{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 0;font-size:.9rem;color:var(--muted);}
.steps-line b{color:var(--accent);}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0;}
.two .box{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--surface);}
.two .box h3{margin:0 0 6px;font-size:1rem;}
.rapply{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0;}
.rapply .box{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--surface);}
.rapply .box .n{font-family:ui-monospace,monospace;font-size:.72rem;color:var(--good);}
.rapply .box h3{margin:2px 0 6px;font-size:1rem;}
.tag{font-size:.72rem;text-transform:uppercase;letter-spacing:.02em;color:var(--muted);}
.win{color:var(--good);font-weight:700;}
.gtable{width:100%;border-collapse:collapse;margin:10px 0;font-size:.9rem;}
.gtable th,.gtable td{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top;}
.gtable th{background:var(--panel);}
em{font-style:italic;color:var(--ink);}
@media(max-width:760px){.two,.rapply{grid-template-columns:1fr;}}
</style>
</head>
<body>
<header class="hero">
  ${topNav(".")}
  <div class="hero-copy">
    <h1>Detailed Redis walkthrough</h1>
    <p class="lead">Use one Redis example from first render to major upgrade. The public steps need no ConfigHub account. Pull Redis 25.5.3 and inspect its 14 Kubernetes objects. Compare them with Helm, write them as OCI, then update the selected configuration to 27.0.0. Sign in only when you want ConfigHub to keep an arbitrary object edit, promote it, and record a rollback.</p>
    <div class="steps-line">You'll: <span><b>pull Redis</b> &rarr;</span> <span><b>read and verify it</b> &rarr;</span> <span><b>write OCI</b> &rarr;</span> <span><b>upgrade without losing the choice</b> &rarr;</span> <span><b>see the managed payoff</b></span></div>
  </div>
</header>
<main>
  <p><a href="./try.html">Use the short Try page</a> if you only want the first local package run.</p>
  <h2 id="install-cub">Install cub and the installer plugin</h2>
  <p>The catalog commands use <code>cub installer</code>, a released open-source plugin. Install the cub CLI, install the plugin from its GitHub release, and make sure <code>kustomize</code> is available:</p>
  <pre><code>$ ${CUB_CLI_INSTALL_COMMAND}
$ export PATH="$HOME/.confighub/bin:$PATH"
$ ${INSTALLER_PLUGIN_INSTALL_COMMAND}
$ cub installer version
$ kustomize version</code></pre>
  <p>The cub installation script puts the CLI at <code>~/.confighub/bin/cub</code>. <code>cub plugin install</code> downloads the release for your operating system and architecture. If <code>kustomize version</code> fails, use the <a href="${KUSTOMIZE_INSTALL_URL}">official kustomize installation instructions</a>; Go is not required to install cub installer. For a later release, run <code>cub plugin upgrade installer</code>. If you installed an early source build with no recorded source, run <code>cub plugin uninstall installer</code> once, then repeat the install command above. Full cub setup notes are in the <a href="${confighubOutboundUrl(CONFIGHUB_DOCS_SETUP_URL, "try")}">ConfigHub docs</a>.</p>
  <p>No ConfigHub account is needed for the catalog paths on this page.</p>
  ${installerCommandNoteHtml()}

  <h2>The fastest first run</h2>
  <p>Five steps take you through the first run. They render the recommended Redis configuration and create its required Secret separately. They then apply the files to a throwaway cluster and show you what the cluster received.</p>
  <pre><code># 1. Install cub and its installer plugin once
# Use the install block immediately above.
cub installer version

# 2. A throwaway cluster (needs Docker; skip if you already have one)
kind create cluster

# 3. Render Redis without putting a password in the files, then install it
bash &lt;(curl -fsSL ${SITE_BASE_URL}sh/bitnami-redis-25-5-3/reuse-existing-secret/try.sh)

# 4. It is running
kubectl -n redis get pods

# 5. It is all files you can read; this one is what the cluster received
cat ./bitnami-redis-25-5-3-reuse-existing-secret/out/manifests/configmap-redis-redis-configuration.yaml</code></pre>
  <p>The script says what it does at every step. It generates a fresh password locally, creates <code>redis-existing-secret</code> in the throwaway cluster, and keeps that password out of the rendered package files. Every chart page links its own <code>try.sh</code>; base variants that need target resources name them instead of guessing. Clean up with <code>kind delete cluster</code>. The longer path below shows the same process next to plain Helm.</p>

  <h2 id="redis-walkthrough">1 · Pull, inspect, and verify Redis</h2>
  <p>Start without a cluster. Pull the public Redis package, select the existing-Secret configuration, write the Kubernetes files, and write the same non-secret objects as a local OCI image layout.</p>
  <p><code>reuse-existing-secret</code> is a <a href="./charts/index.html#base-variants">base variant</a>: a reviewed way to use the chart with its Helm inputs, rendered output, checks, and required Secret recorded together.</p>
  <pre><code># No ConfigHub account, Google registry login, or Kubernetes cluster.
$ cub installer setup --pull ${REDIS_INSTALLER_OCI_REF} \\
    --base reuse-existing-secret --work-dir ./redis \\
    --non-interactive --namespace redis \\
    --output-oci ./redis-25.oci

# Read the files before deciding whether to deploy.
$ ls ./redis/out/manifests
$ cat ./redis/out/spec/selection.yaml</code></pre>
  <p>The command writes 14 Kubernetes objects and no Secret. The password remains outside the files and OCI. The output ends with <code>pull-back: verified</code> because cub reads the OCI back and compares its object-set digest before reporting success.</p>
  <p>Open the <a href="../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml">full rendered Redis YAML</a>, the <a href="../data/helm-render-intents/intents/bitnami-redis-25-5-3-reuse-existing-secret.yaml">recorded Helm inputs and prerequisites</a>, or the <a href="./d/data/redis-public-walkthrough-proof/summary.html">anonymous 25.5.3 to 27.0.0 walkthrough proof</a>.</p>

  <h3>Install only after you have read it</h3>
  <p>If you want a live test, use a throwaway cluster. The generated script creates a fresh password in a separate Kubernetes Secret. It applies the 14 files, waits for Redis, and tells you how to remove the cluster afterward.</p>
  <pre><code>$ kind create cluster
$ bash &lt;(curl -fsSL ${SITE_BASE_URL}sh/bitnami-redis-25-5-3/reuse-existing-secret/try.sh)</code></pre>
  <p>The <a href="./d/data/serverless-install-parity-proof/summary.html">live parity proof</a> ran normal Helm and this cub path on a clean cluster. The 13 chart objects matched field for field, cub added the explicit Namespace, and both Redis installations became ready and answered <code>PING</code>.</p>

  <h3>Helm combines render and install. cub separates them.</h3>
  <div class="rapply">
    <div class="box"><div class="n">1 · RENDER</div><h3>Read and verify it</h3><p><code>cub installer setup</code> writes the exact files to <code>./redis/out/manifests</code>. With <code>--output-oci</code>, it also writes those non-secret objects as OCI and checks the result by pulling it back.</p></div>
    <div class="box"><div class="n">2 · DELIVER</div><h3>Then choose where it goes</h3><p>Use <code>kubectl apply</code>, commit the files for GitOps, or push the rendered OCI for Argo CD or Flux. The separate Redis Secret remains under your normal secret-management process.</p></div>
  </div>
  <div class="callout"><p><strong>What is <code>--pull</code>?</strong> It points cub at an installer package. For a public chart, first check that its page links a publication receipt. Then use the package's <code>oci://</code> reference. cub pulls the package into the work directory and writes <code>out/spec</code> and <code>out/manifests</code>. Repository maintainers can use the local <code>packages/...</code> path while a reference is still marked assigned.</p></div>
  <div class="callout"><p><strong>Registry access today.</strong> ${escapeHtml(INSTALLER_OCI_AUTH_NOTE)}</p></div>

  <h2>2 · Upgrade the same Redis configuration</h2>
  <p>Now move the same work directory from Redis chart 25.5.3 to 27.0.0. With no account, cub can retain the package selection and inputs it knows about. With ConfigHub, it can also retain a reviewed edit made directly to a Kubernetes object.</p>
  <div class="two">
    <div class="box">
      <h3>No account: the package choice stays</h3>
      <p class="tag">no ConfigHub account</p>
      <pre><code># Re-enter the same work directory with the newer public package.
$ cub installer setup --pull ${REDIS_27_INSTALLER_OCI_REF} \\
    --work-dir ./redis --reuse --non-interactive --namespace redis \\
    --output-oci ./redis-27.oci

$ cat ./redis/out/spec/selection.yaml
# base: reuse-existing-secret</code></pre>
      <p>The selected existing-Secret base is retained. The newer output contains Redis 8.8.0 and chart 27.0.0, still as 14 non-secret objects, and the second OCI is pulled back and verified. This does not claim that an arbitrary hand edit survives without ConfigHub.</p>
    </div>
    <div class="box">
      <h3>With a ${signupLink("try", "free account")}: a reviewed object edit stays</h3>
      <p class="tag">${signupLink("try", "free account")}</p>
      <pre><code># Record the 25.5.3 objects.
$ cub installer upload --work-dir ./redis --space my-redis

# Change the rendered replica StatefulSet from 3 replicas to 2.
$ edit ./redis/out/manifests/statefulset-redis-redis-replicas.yaml
$ cub installer plan --work-dir ./redis
$ cub installer upload --work-dir ./redis --yes

# Pull 27.0.0. setup reads upload.yaml; upload performs the merge.
$ cub installer setup --pull ${REDIS_27_INSTALLER_OCI_REF} \\
    --work-dir ./redis --reuse --non-interactive --namespace redis
$ cub installer plan --work-dir ./redis
$ cub installer upload --work-dir ./redis --yes</code></pre>
      <p>The recorded run upgraded the chart from 25.5.3 to 27.0.0 and Redis from 8.6.3 to 8.8.0. The replica count remained two. There is no removed setup flag to remember: <code>setup</code> re-enters from <code>upload.yaml</code>, and <code>upload</code> merges the new package output with the recorded Units.</p>
    </div>
  </div>

  <h3>What the managed run did after the upgrade</h3>
  <p>The <a href="./d/data/redis-upgrade-app-proof/summary.html">Redis upgrade and rollback proof</a> continued the same example. It identified development and staging as the affected environments and promoted them in order. It published one reviewed OCI and reconciled that digest on two Argo CD clusters. Both Redis installations became ready and answered <code>PONG</code>. It then restored the exact pre-upgrade revisions, published a rollback OCI, and verified both clusters again.</p>
  <p>The proof also records its limits. The promotion dry run produced no readable mutation output. The portable OCI used a temporary registry. The rollback restored desired Kubernetes objects, not database data.</p>

  <h2>3 · See why the Redis base matters</h2>
  <p>The Redis <code>default</code> catalog base is retained as an explicit static-password demonstration. Its rendered YAML contains credential material, so the chart page warns against treating it as a production default. The recommended <code>reuse-existing-secret</code> base used above contains no Secret object and names the Secret that must exist at delivery time.</p>
  <pre><code># Compare the two choices without touching a cluster.
$ cub installer setup --pull ${REDIS_INSTALLER_OCI_REF} \\
    --base default --work-dir ./redis-static \\
    --non-interactive --namespace redis
$ grep -R "kind: Secret" ./redis-static/out/manifests

$ grep -R "kind: Secret" ./redis/out/manifests
# no match: reuse-existing-secret keeps the credential outside the files</code></pre>
  <p>This is the sort of choice the catalog records for people and agents. It does not pretend that every chart has one universal answer. For another common case, take a chart and values file produced by AI and <a href="./testing.html#bring-your-own">review the exact rendered objects before applying them</a>.</p>

  <h2>4 · Already on Argo or Flux? Write OCI directly</h2>
  <p>If your cluster pulls from an OCI registry, give <code>--output-oci</code> a registry reference instead of a local path. The installer pushes the same 14 non-secret Redis objects you inspected. It records the source package and selected base. It then reads the artifact back and verifies its object-set digest. Registry write access is the only additional requirement.</p>
  <pre><code>$ cub installer setup --pull ${REDIS_INSTALLER_OCI_REF} \\
    --base reuse-existing-secret --work-dir ./redis \\
    --non-interactive --namespace redis \\
    --output-oci oci://&lt;your-registry&gt;/redis:v1</code></pre>
  <p>The <a href="./d/data/serverless-oci-gitops-proof/summary.html">live no-account NGINX proof</a> runs this exact installer output path against a temporary registry. Flux reconciled the recorded output digest and the Deployment reached its desired replica count.</p>

  <h2>What we checked</h2>
  <p>The Redis steps above are backed by separate receipts so one passing lane is not made to prove everything.</p>
  <table class="gtable">
    <tr><th>Check</th><th>What it shows</th></tr>
    <tr><td><a href="./d/data/redis-public-walkthrough-proof/summary.html">Public Redis walkthrough</a></td><td>Anonymous pulls of 25.5.3 and 27.0.0, 14 non-secret objects at each version, the same selected base after upgrade, and both local OCI outputs pulled back and verified.</td></tr>
    <tr><td><a href="./d/data/serverless-install-parity-proof/summary.html">Same live install as Helm</a></td><td>Helm and cub produced the same 13 Redis chart objects; cub added the explicit Namespace; both live installations became ready and answered <code>PING</code>.</td></tr>
    <tr><td><a href="./d/data/serverless-oci-gitops-proof/summary.html">Rendered OCI reaches Flux</a></td><td>For a separate NGINX preset, <code>cub installer setup --output-oci</code> wrote and verified the artifact, Flux reconciled its digest, and the workload reached 1/1 ready replicas.</td></tr>
    <tr><td><a href="./d/data/redis-upgrade-app-proof/summary.html">Managed upgrade and rollback</a></td><td>A post-render Redis replica edit stayed through the 25.5.3 to 27.0.0 upgrade, moved through two environments, reached two Argo CD clusters at one digest, and was restored by exact revision.</td></tr>
  </table>

  <h2>Check it yourself</h2>
  <p>The first command checks the committed receipt. The second repeats the public no-account run against the current registry packages. Neither command touches Kubernetes.</p>
  <pre><code>$ npm run redis-public-walkthrough:verify
$ npm run redis-public-walkthrough:run</code></pre>
  <p class="quiet-line">The Verification page lets you run the checks yourself, read the evidence we've recorded, or start a fresh live test.</p>

  ${productDocsPointer("try")}
  <p class="closing-line">Try the public Redis walkthrough first. When you are ready to use your own example, bring a chart and values file that you or an AI produced. The <a href="./testing.html#bring-your-own">bring-your-own path</a> renders it, reports exact object and field findings, keeps the changes you actually wanted, and builds a reviewed OCI.</p>
  <p class="quiet-line"><a href="./how-it-works.html">How it works (F1→F4)</a> · <a href="./charts/bitnami-redis-25-5-3.html">Redis chart page</a> · <a href="./testing.html#bring-your-own">Check my config</a> · <a href="./demo-org.html">The demo org</a> · <a href="./verification.html">Open verification</a></p>
</main>
<footer>${generatedStamp(catalog, "detailed Redis walkthrough")}<p>The public steps need no ConfigHub account. Managed changes, promotion, and rollback use ConfigHub.</p></footer>
</body>
</html>
`;
}

function serverlessHtml(catalog) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Serverless Mode · Config Test Centre</title>
  <style>${siteCss()}${installPageCss()}</style>
</head>
<body>
  <header class="hero human-hero install-hero">
    ${topNav(".")}
    <div class="install-hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Serverless mode</p>
        <h1>Run it without ConfigHub Server</h1>
        <p class="lead">This example is both serverless and anonymous: it uses neither ConfigHub Server nor a ConfigHub account. You can inspect the rendered objects and prerequisites, then keep them as files, apply them yourself, or write the non-secret objects to OCI.</p>
        <div class="chips" aria-label="What this path needs"><span>kind</span><span>any cluster</span><span>no ConfigHub account</span></div>
      </div>
      <div class="terminal-card" aria-label="Redis install comparison">
        <div class="terminal-title">redis → redis</div>
        <pre class="terminal-body"><code><span class="term-comment"># before either lane: provide the password separately</span>
<span class="term-prompt">$</span> kubectl create namespace redis
<span class="term-prompt">$</span> kubectl -n redis create secret generic redis-existing-secret \\
    --from-literal=redis-password="$(openssl rand -base64 32)"

<span class="term-comment"># plain Helm with the preset's recorded values</span>
<span class="term-prompt">$</span> helm install redis oci://registry-1.docker.io/bitnamicharts/redis \\
    --version 25.5.3 -n redis \\
    --set auth.existingSecret=redis-existing-secret \\
    --set auth.existingSecretPasswordKey=redis-password \\
    --set image.digest=sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25

<span class="term-comment"># or: render the reviewed package, write OCI, then apply</span>
<span class="term-prompt">$</span> cub installer setup --pull ${REDIS_INSTALLER_OCI_REF} \\
    --base reuse-existing-secret --namespace redis \\
    --work-dir ./out --non-interactive \\
    --output-oci ./redis-rendered.oci
<span class="term-prompt">$</span> kubectl apply -f ./out/manifests -n redis</code></pre>
      </div>
    </div>
    <p class="caption">The preset's rendered objects have a committed Helm-equivalence receipt. Run the Helm and cub lanes on separate throwaway clusters when you want to compare the live result.</p>
  </header>
  <main>
    <section class="narrow-section callout-section" aria-labelledby="package-note">
      <h2 id="package-note">What is <code>--pull</code>?</h2>
      <p>It points cub at an installer package: a reviewed chart/version with bases, recorded inputs, rendered objects, and proof links. For public catalog charts, use the package's <code>oci://</code> ref after the chart page shows a publication receipt. cub pulls that package into the work directory, then writes <code>out/spec</code> and <code>out/manifests</code>. In this repo, maintainers may also use the local <code>packages/...</code> source path while a ref is still marked assigned.</p>
      <p>${escapeHtml(INSTALLER_OCI_AUTH_NOTE)}</p>
    </section>

    <section class="narrow-section" aria-labelledby="where-it-fits">
      <h2 id="where-it-fits">Where the no-account tools fit</h2>
      <p>You can use them before an OCI package is built, after you pull one, or between an input package and an output package.</p>
      <div class="step-grid">
        <div class="card"><h3><code>work -&gt; OCI</code></h3><p>Inspect and test a chart, recipe, installer package, or set of Kubernetes files, then build an OCI package.</p></div>
        <div class="card"><h3><code>OCI -&gt; work</code></h3><p>Pull a public OCI package to inspect its objects, run checks, or compare it with another version.</p></div>
        <div class="card"><h3><code>OCI -&gt; work -&gt; OCI</code></h3><p>Pull a package, test or edit the exact objects, and build a new package. Registry publication is a separate authenticated step.</p></div>
      </div>
      <p>Here, work means inspect, explain, test, scan, compare, or edit. It can run as a local command or in CI today. A public hosted service that can do this work without signing in is planned, but not yet shipped.</p>
    </section>

    <section class="narrow-section" aria-labelledby="change-oci">
      <h2 id="change-oci">Change an existing OCI without signing in</h2>
      <p>When an OCI already contains exact Kubernetes objects, you can change one named field and create a checked replacement locally. This example changes only the NGINX replica count:</p>
      <div class="terminal-card">
        <div class="terminal-title">public OCI → checked local OCI</div>
        <pre class="terminal-body"><code><span class="term-prompt">$</span> npm run oci:transform -- \\
  oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/byo-nginx-ai-values@sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683 \\
  --object Deployment/nginx --namespace nginx \\
  --field spec.replicas --value 4 \\
  --output oci-layout:./nginx-replicas-4:reviewed</code></pre>
      </div>
      <p>The output contains the complete Kubernetes YAML, the input digest, the exact field change, and the check results. The command pulls the output back and compares it before reporting success. Existing source and change records are kept when the output is changed again.</p>
      <p><a href="./d/docs/user/transform-oci-package.html">Read the command guide</a> · <a href="./d/data/anonymous-oci-transform-proof/summary.html">See the public NGINX proof</a></p>
    </section>

    <section class="narrow-section" aria-labelledby="how">
      <h2 id="how">Helm hides one step. cub shows it.</h2>
  <p><code>helm install</code> renders and applies the chart in one command. The cub path splits that into render, inspect, then apply. The <a href="./d/data/serverless-install-parity-proof/summary.html">live Redis comparison</a> checks all 13 chart objects field-for-field, runs both deployments, and records <code>PONG</code> from each.</p>
      <div class="step-grid">
        <div class="card">
          <h3>1 · Render</h3>
          <p><code>cub installer setup</code> writes plain files under <code>./out/manifests</code>. The <code>reuse-existing-secret</code> preset records the Secret name and key the target must supply; it does not put password material in the rendered OCI.</p>
        </div>
        <div class="card">
          <h3>2 · Apply</h3>
          <p><code>kubectl apply</code> installs those files. Create the namespace first so the objects land where you expect.</p>
        </div>
      </div>
      <p><strong>Same render, same working result, visible before apply.</strong></p>
    </section>

    <section class="narrow-section" aria-labelledby="gitops">
      <h2 id="gitops">The other delivery: GitOps via OCI</h2>
      <p>Already running Argo CD or Flux from an OCI registry? Give <code>--output-oci</code> a registry reference. The installer pushes the non-secret objects, reads the artifact back, and checks the object-set digest before returning.</p>
      <div class="terminal-card">
        <div class="terminal-title">redis → OCI</div>
        <pre class="terminal-body"><code><span class="term-prompt">$</span> cub installer setup --pull ${REDIS_INSTALLER_OCI_REF} \\
    --base reuse-existing-secret --namespace redis \\
    --work-dir ./out --non-interactive \\
    --output-oci oci://&lt;your-registry&gt;/redis:v1
<span class="term-prompt">$</span> flux create source oci redis --url=oci://&lt;your-registry&gt;/redis --tag=v1 --interval=30s
<span class="term-prompt">$</span> flux create kustomization redis --source=OCIRepository/redis --path=./ --prune=true</code></pre>
      </div>
      <p>The <a href="./d/data/serverless-oci-gitops-proof/summary.html">live NGINX proof</a> uses this installer output path with no ConfigHub token. Flux reconciled the exact output digest and the workload reached 1/1 ready replicas. The <a href="./d/data/serverless-install-parity-proof/summary.html">Redis comparison</a> independently verifies a local rendered OCI and full Helm parity for the existing-Secret configuration.</p>
    </section>

    <section class="narrow-section" aria-labelledby="edges">
      <h2 id="edges">The edges, kept in plain sight</h2>
      <p><strong>The chart's normal default carries password material in its rendered Secret.</strong> The catalog recommends <code>reuse-existing-secret</code> instead. That preset names the Secret the target must provide, and the rendered OCI contains no password.</p>
      <p><strong><code>kubectl</code> does not wait for the namespace.</strong> Create the namespace first. A controller such as Argo or Flux can order this for you.</p>
      <p><strong><code>cub installer push</code> publishes the multi-preset source package.</strong> Users pull that package with <code>cub installer setup --pull</code>. The separate <code>--output-oci</code> artifact contains one selected preset's exact non-secret Kubernetes objects for Argo CD, Flux, or another OCI consumer.</p>
      <p>A chart with hooks, admission webhooks, or its own CRDs needs more than a render. Its chart page says which lifecycle steps apply.</p>
      <p><a href="./try.html">Open Get Started</a> · <a href="../docs/user/serverless-mode.md">Read the source guide</a></p>
    </section>
  </main>
  <footer>${generatedStamp(catalog, "serverless guide")}<p>Generated from committed helm-expt evidence. Serverless means this path does not depend on ConfigHub Server; anonymous means it uses no ConfigHub account. This example is both. Claim the configuration in ${signupLink("serverless", "ConfigHub")} when it needs saved history, shared variants, approvals, promotions, or fleet rollout.</p></footer>
</body>
</html>
`;
}

function docsHtml(catalog) {
  const stageRows = [
    ["1. Choose", "Start with Helm, AICR, existing OCI, or Kubernetes YAML.", "<a href=\"./testing.html\">Examples</a>", "No"],
    ["2. Inspect", "Create exact Kubernetes objects and read them before delivery.", "<a href=\"./try.html\">Try one catalog package</a>", "No"],
    ["3. Record", "Store one reviewed configuration and release it.", `<a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "docs-stages")}">Official tutorial</a>`, "Yes"],
    ["4. Change", "Add development and production configurations.", `<a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "docs-stages")}">Official tutorial</a>`, "Yes"],
    ["5. Promote", "Move a reviewed change from its base through development and production.", `<a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "docs-stages")}">Official tutorial</a>`, "Yes"],
  ];
  const startRows = [
    ["Learn ConfigHub", `<a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "docs-start")}">Official tutorial</a>`, "Set up a cluster. Install and release one component. Change it, add production, and promote the change."],
    ["Try a package without an account", `<a href="./try.html">Try one catalog package</a>`, "Render one reviewed Redis configuration. Inspect the files and local OCI without ConfigHub Server."],
    ["Follow the complete Redis example", `<a href="./redis-walkthrough.html">Detailed Redis walkthrough</a>`, "Add Helm parity, Kubernetes, a major upgrade, promotion, two-cluster delivery, and rollback."],
    ["Choose a worked example", `<a href="./testing.html">Examples</a>`, "Start with Helm, AICR, OCI, or YAML. Continue with ConfigHub only when you want saved configuration and managed operations."],
    ["Understand the model", `<a href="./how-it-works.html">How it works</a>`, "Render, record, and route: the short version of what ConfigHub adds to Helm."],
    ["See every source and App demonstration", `<a href="../docs/user/config-catalog-demonstrations.md">Demonstration record</a>`, "Separate the bounded example that ran from the broader product status and its remaining work."],
    ["Choose a public chart", `<a href="./charts/index.html">Helm Ops Catalog</a>`, "Pick a ready-to-use base variant and read its values, output, hooks, CRDs, setup work, and evidence."],
    ["Open the demo org", `<a href="./demo-org.html">Demo org</a>`, "See the same examples inside Hub. Each Space has a short README and the Kubernetes YAML for that example."],
    ["Use an App on ConfigHub", `<a href="./journey.html">Apps</a>`, "Use saved configuration for upgrade review, hooks and CRDs, RBAC review, fleet rollout, or AI change review."],
    ["Verify a claim", `<a href="./verification.html">Verification</a>`, "Choose the npm command that tests the claim instead of treating every result as the same thing."],
    ["Read the limits", `<a href="./hard-questions.html">FAQ</a>`, "Hooks, CRDs, upgrades, generated secrets, AI changes, rollback, and current gaps."],
    ["Know when managed help begins", `<a href="./private/">Upgrade</a>`, "Private sources, production support, teams, policies, fleet operations, and commercial boundaries."],
  ];
  const guideRows = [
    ["Official ConfigHub tutorial", "Set up a cluster, install and release one component, make a change, add production, and promote the change.", CONFIGHUB_TUTORIAL_URL],
    ["Examples", "Choose a starting input, then see working promotion, delivery, platform, policy, and App examples.", "./testing.html"],
    ["Detailed entry paths", "Commands and proof links for Helm, AICR, existing OCI, and Kubernetes YAML.", "./entry-path-reference.html"],
    ["How it works", "The short model: render the chart, record what produced it, and route the Helm work that is not a plain object.", "./how-it-works.html"],
    ["Config catalog demonstrations", "The maintained paths for Helm, AICR, cub installer, public OCI work, Kubara, and Sveltos, followed by variants, promotions, policy, and five ConfigHub Apps.", "../docs/user/config-catalog-demonstrations.md"],
    ["Config catalog doctrine", "The anonymous-to-managed boundary, four OCI package roles, base variants, fleet delivery, policy rules, and AI maintenance rules.", "../docs/reference/config-catalog-doctrine.md"],
    ["Anonymous OCI work in CI", "A GitHub Actions run with no ConfigHub credentials pulls a public package, renders and checks its objects, creates an OCI layout, and pulls the same objects back.", "../data/anonymous-oci-ci-proof/summary.md"],
    ["Anonymous OCI change", "Pull five public NGINX objects without credentials, change only the replica count, store the source and check records, and pull the new local OCI back for comparison.", "../data/anonymous-oci-transform-proof/summary.md"],
    ["Redis public walkthrough", "Pull Redis 25.5.3 and 27.0.0 anonymously, retain the selected existing-Secret base, keep Secrets out of both object sets, and verify both local OCI outputs by pulling them back.", "../data/redis-public-walkthrough-proof/summary.md"],
    ["OCI import, promotion, and two-cluster rollout", "One live run imports exact Kubernetes objects from OCI, promotes a change through development and staging, exports one deployable OCI, and records exact-object and convergence receipts on two Argo CD clusters.", "../data/oci-deploy-stage-rollout-proof/summary.md"],
    ["Redis upgrade, promotion, and rollback", "A live chart upgrade keeps a post-render replica change, moves through development and staging, reaches two Argo CD clusters, then restores the exact pre-upgrade revisions and checks both clusters again.", "../data/redis-upgrade-app-proof/summary.md"],
    ["AICR EKS H100 example", "AICR selects and orders a GPU platform. Two public OCI artifacts carry the source package and 17 exact Argo CD Applications. ConfigHub stores the Applications as a base, changes one Grafana Secret reference in development, and promotes that result to staging.", "../docs/demo/aicr/eks-h100-training-kubeflow.md"],
    ["AICR OCI round trip", "A live OCI-to-ConfigHub-to-OCI test imports 17 AICR-generated Argo CD Applications, publishes a ConfigHub release, pulls it back, and compares every object without claiming a GPU rollout.", "../data/aicr-oci-roundtrip-proof/summary.md"],
    ["AI change review proof", "ConfigHub reports a mutable nested AICR image, blocks an inline API key, clears the reviewed candidate, requires approval, and leaves ordinary Deployment checks off the custom resource.", "../data/ai-change-review-live-proof/summary.md"],
    ["RBAC review example", "Find unnecessary Secret access, make one exact Role change, require approval, publish the reviewed objects as OCI, and let Argo CD deliver the result.", "../docs/demo/apps/rbac-review.md"],
    ["RBAC permissions report", "Review broad RBAC rules across committed default chart renders without needing a cluster or running Helm again.", "../data/app-readiness/summary.md"],
    ["Kubara local platform example", "A real Kubara v0.12.0 generation, 77 rendered Argo CD bootstrap objects, lifecycle requirements, OCI layout, and current limits.", "../docs/demo/kubara/local-platform.md"],
    ["Sveltos Kyverno fleet example", "A two-wave result: ConfigHub approves a pilot and one selector expansion at different OCI digests, then Argo CD and Sveltos deliver Kyverno to one staging cluster and later to both.", "../docs/demo/sveltos/kyverno-fleet.md"],
    ["Hooks and CRDs example", "Kube Prometheus Stack install order, eight checked route records, Argo CD and Flux choices, live evidence, and what remains manual.", "../docs/demo/hooks-crds/kube-prometheus-stack.md"],
    ["Try one catalog package", "Render and inspect one reviewed Redis configuration without ConfigHub Server or a ConfigHub account.", "./try.html"],
    ["Detailed Redis walkthrough", "Add Helm parity, Kubernetes, OCI, a major upgrade, promotion, two-cluster delivery, and rollback.", "./redis-walkthrough.html"],
    ["Verification", "A landing page for npm checks, fresh live tests, committed receipts, and what each one proves.", "./verification.html"],
    ["AI and the catalog", "How AI helps build and test the catalog, and why tests and receipts decide what is true.", "./ai.html"],
    ["Choose a chart", "Browse public chart pages, ready-to-use base variants, known risks, and first-use advice.", "./charts/index.html"],
    ["Demo org examples", "The README pages for live Hub demo Spaces. Each one says why the Space exists, what problem it shows, and what to inspect first.", "../data/helm-catalog-readmes/summary.md"],
    ["Installer package OCI refs", "The package refs users pull with cub installer setup --pull oci://..., and how they differ from ConfigHub delivery OCI.", "../docs/user/installer-oci-packages.md"],
    ["Inspect an OCI package", "One command that identifies the package role, resolves its digest, and reports the exact Kubernetes objects and obvious lifecycle work it contains.", "../docs/user/inspect-oci-package.md"],
    ["Change an OCI package", "Change one field in a literal Kubernetes OCI, run checks, keep its source records, and build a new local OCI without a ConfigHub account.", "../docs/user/transform-oci-package.md"],
    ["Helm base variants and values", "Why the catalog supports useful chart-specific base variants instead of claiming every values combination.", "../docs/user/helm-presets-and-values.md"],
    ["Helm quirks", "A practical list of chart behavior that needs care: hooks, CRDs, webhooks, generated values, storage, and RBAC.", "./quirks.html"],
    ["Create variants", "When to make a new Helm-rendered base, and when to make a ConfigHub version after render.", "./variants.html"],
    ["Apps", "Use configuration saved in ConfigHub for upgrade review, hooks and CRDs, RBAC review, fleet rollout, and AI change review.", "./journey.html"],
    ["Application examples", "Examples that combine public charts with private application pieces.", "./custom-apps.html"],
    ["Existing Apps", "Start read-only from Argo, Flux, rendered YAML, live cluster state, or a Helm release.", "./existing-apps.html"],
    ["Ops", "Release, observe, patch, and upgrade after the files are recorded.", "./operations.html"],
    ["Security and provenance", "Secrets, credentials, scans, OCI delivery, and the limits of the current evidence.", "./security.html"],
    ["Future and managed ideas", "What exists now, what is roadmap, and what belongs in a managed service.", "./future.html"],
    ["Answer hard questions", "Direct answers about hooks, upgrades, AI changes, limits, and refusals.", "./hard-questions.html"],
    ["Known Gaps", "The known problems this project names instead of hiding.", "./known-gaps.html"],
    ["Model and taxonomy", "The five terms, the F1-F4 stages, and the same objects seen from plain Helm, Kustomize, and source-object viewpoints.", "../docs/user/model-and-vocabulary.md"],
    ["The data model", "Definitions for Space, Unit, target, route, and receipt.", "../docs/user/confighub-data-model.md"],
    ["Variants after upload", "The step-by-step cub variant walkthrough: create an environment variant, preview with a dry run, then promote reviewed changes.", "../docs/user/variants-after-upload.md"],
    ["App to live, end to end", "A plain app into ConfigHub, staging and prod variants, OCI to Argo delivery, and a staged rollout: the whole chain, run live.", "../docs/user/app-to-live-walkthrough.md"],
    ["Image registry migration", "Repoint a chart's image registry across a fleet with the digest intact, promote it environment by environment, and prove where it landed. Run live.", "../docs/user/image-registry-migration.md"],
    ["Expected results and clusters", "Which commands need a cluster and what output to expect.", "../docs/user/expected-results-and-clusters.md"],
    ["Deployment path", "How a cub installer package becomes files, a ConfigHub upload, an OCI bundle, or controller input.", "../docs/user/cub-deployment-path.md"],
    ["GitOps adopter guide", "How Argo and Flux teams can keep their controller and consume one reviewed OCI bundle.", "../docs/user/gitops-adopter-guide.md"],
    ["Security end to end", "Secrets, credentials, scan points, and what should never be printed or copied casually.", "../docs/user/security-end-to-end.md"],
    ["Day-2 upgrade and rollback", "How to review and rehearse an upgrade, then observe what happened.", "../docs/user/day2-upgrade-rollback.md"],
    ["Helm render intents", "The record behind a catalog base variant: chart version, values, namespace, release name, lifecycle routes, target prerequisites, and evidence links.", "../docs/user/helm-render-intents.md"],
    ["Coming from Helm", "How common Helm flags map to cub inputs.", "../docs/user/helm-to-cub-migration.md"],
    ["AI-assisted changes", "Let AI suggest a change, then review exact files, diffs, checks, and approval records.", "../docs/user/ai-assisted-helm-changes.md"],
    ["Broken chart triage", "Sort a failure into render, target, lifecycle, runtime, or unsupported behavior.", "../docs/user/broken-chart-triage.md"],
    ["Known gaps we surface", "Current watch findings and blockers before you trust a route.", "../docs/user/known-gaps-we-surface.md"],
    ["Per-chart cub adoption caveats", "Where cub is rougher than plain Helm on first run, and how each caveat is managed.", "../data/cub-adoption-caveats/summary.html"],
    ["Custom overlays", "Wrapper charts, customer values, and changes that go beyond normal values files.", "../docs/user/custom-overlays.md"],
    ["Verify it yourself", "Practical commands for local checks, rendered installs, parity receipts, and scout receipts.", "../docs/user/verify-it-yourself.md"],
    ["Verification lanes", "Which proof lane checks render, ConfigHub upload, delivery, live state, or two-cluster parity.", "../docs/user/verification-lanes.md"],
    ["Hook lifecycle strategy", "How chart hooks become visible work with status and receipts.", "../docs/user/hook-lifecycle-strategy.md"],
  ];
  const dataRows = [
    ["Helm Ops Catalog database", "The chart and variant matrix.", "./matrix.html"],
    ["Generated data index", "The generated data catalog for this repository.", "../data/README.md"],
    ["Status dashboard", "Current aggregate status and active proof queue.", "../data/status-dashboard/summary.md"],
    ["cub adoption caveats", "The 100-chart table for first-run caveats, placeholder passwords, and CRD ordering.", "../data/cub-adoption-caveats/summary.html"],
    ["Helm render intents", "One generated render-intent object per real base variant.", "../data/helm-render-intents/summary.md"],
    ["Base variant records", "Source-neutral records joining literal objects, source inputs, routes, policy, evidence, and OCI handoffs.", "../data/base-variant-records/summary.md"],
    ["Operational class examples", "Worked examples showing who owns a user workload, shared service, or system configuration, where it runs, which checks apply, and how it rolls out.", "../data/operational-class-examples/summary.md"],
    ["Apply policy profile", "The common checks, approval rules for production and system configuration, scope assertions, and self-test.", "../data/apply-policy-profiles/summary.md"],
    ["Hooks and CRDs App", "The Kube Prometheus Stack route plan, the proven hook fixture, and the live ApplyGate rejection receipt.", "../data/hooks-crds-app/summary.md"],
    ["Demonstration status", "Current status and evidence for the source pathways and five ConfigHub App examples.", "../data/demo-program/summary.md"],
    ["Demo org README files", "The README text for each current helm-catalog demo Space, plus the generated upload YAML.", "../data/helm-catalog-readmes/summary.md"],
    ["Installer OCI packages", "One row per package ref, setup command, package path, base list, and publication status.", "../data/installer-oci-packages/summary.md"],
    ["Claims register", "What is backed, partial, planned, or refused.", "../data/claims-register/summary.md"],
    ["Verification landing page", "Choose the right npm proof command.", "./verification.html"],
    ["Deep proof page", "Detailed proof lanes for reviewers who want the full evidence trail.", "./proof.html"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Docs · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Docs/FAQ</h1>
    <p class="lead">These pages are for technical users who want to try ConfigHub, understand how it works, and check the claims for themselves.</p>
    <p>Learn ConfigHub with the official tutorial. Use this site to inspect a catalog package, bring another source, or read the evidence.</p>
    ${humanLinks([["Official tutorial", CONFIGHUB_TUTORIAL_URL], ["Try one package", "./try.html"], ["Examples", "./testing.html"], ["Verification", "./verification.html"]])}
  </header>
  <main>
    <section aria-labelledby="start-here">
      <h2 id="start-here">Start Here</h2>
      <p>Choose what you want to do next and open the matching page.</p>
      ${productDocsPointer("docs")}
      ${markdownLikeTable([
        ["Task", "Open", "Why"],
        ...startRows,
      ], { rawSecondColumn: true })}
    </section>

    <section aria-labelledby="chart-evidence">
      <h2 id="chart-evidence">How To Read Chart Evidence</h2>
      <p>Start from the public chart page. Do not start from a generated package folder unless you already know what you are looking for.</p>
      ${markdownLikeTable([
        ["Step", "Open", "What you learn"],
        ["1", "Chart page", "Which base variants are supported and what still needs work."],
        ["2", "Full rendered YAML", "The Kubernetes objects captured from one base variant. This is the output of the render."],
        ["3", "Render intent", "The Helm chart version, values, namespace, release name, capability profile, source lock, output path, and evidence links."],
        ["4", "Hooks, CRDs, and setup work", "The route decisions for chart behavior that is not just static YAML."],
        ["5", "Verification", "The commands and receipts that back a claim."],
      ])}
    </section>

    <section aria-labelledby="technical-words">
      <h2 id="technical-words">How This Site Uses Technical Words</h2>
      <p>These words have specific jobs. Using them consistently makes the instructions and evidence easier to follow.</p>
      ${markdownLikeTable([
        ["Word", "Meaning"],
        ["Render", "Create Kubernetes objects from a recorded source and its inputs."],
        ["Inspect", "Read the objects or evidence."],
        ["Test", "Run a defined command or procedure."],
        ["Verify", "Compare a result with a recorded expectation, digest, or object set."],
        ["Review", "Decide whether a known change or result is acceptable."],
        ["Prove", "Produce an inspectable receipt for one scoped claim."],
      ])}
      <p>The <a href="./d/docs/user/model-and-vocabulary.html">model and vocabulary guide</a> defines base variants, render intents, Units, Spaces, routes, and receipts.</p>
    </section>

    <section aria-labelledby="agent-notes">
      <h2 id="agent-notes">Working In This Repository?</h2>
      <p>If you are an AI agent or maintainer changing <code>helm-expt</code>, use the repo notes instead of the public site. They list repo commands, recovery steps, verification commands, catalog read-only rules, and the human/agent docs rule.</p>
      <p><a href="../docs/agent/README.md">Open Agent And Operator Notes</a></p>
    </section>

    <section aria-labelledby="five-stages">
      <h2 id="five-stages">Five Stages</h2>
      <p>Most users start by previewing a chart. Add more when you need to save the inputs, share versions with a team, review changes, hand off to GitOps, or run releases.</p>
      ${markdownLikeTable([
        ["Stage", "What you do", "Command or page", "Needs ConfigHub?"],
        ...stageRows,
      ], { rawThirdColumn: true, firstColumnWidthCh: 12 })}
    </section>

    <section aria-labelledby="guides">
      <h2 id="guides">Technical Guides</h2>
      <p>Use these when you need the next level of detail after the main pages.</p>
      ${markdownLikeTable([
        ["Guide", "What it helps with", "Open"],
        ...guideRows.map(([name, body, path]) => [name, body, `<a href="${path}">${escapeHtml(name)}</a>`]),
      ], { rawThirdColumn: true })}
    </section>

    <section aria-labelledby="database">
      <h2 id="database">Verification And Evidence</h2>
      <p>Each chart page gives the short answer: what can I try, and what should I watch first? The matrix and generated data are for review work. They show where the chart answer came from: render inputs, test results, receipts, known gaps, and claim status.</p>
      ${markdownLikeTable([
        ["Surface", "What it helps with", "Open"],
        ...dataRows.map(([name, body, path]) => [name, body, `<a href="${path}">${escapeHtml(name)}</a>`]),
      ], { rawThirdColumn: true })}
    </section>
  </main>
  <footer>Generated from helm-expt catalog data. Use the main guides first, then the matrix and generated data when you need exact status.</footer>
</body>
</html>
`;
}

function verificationHtml(catalog) {
  const commandRows = [
    ["Generated site/docs/data", "<code>npm run site:verify</code><br><code>npm run docs:verify</code><br><code>npm run data:index:verify</code>", "No", "Generated surfaces match committed source and data."],
    ["Rendered tutorial output", "<code>npm run redis:verify-install:render -- ...</code>", "No", "A user's workdir render matches the expected chart/base/package contract."],
    ["Broad repo gate", "<code>npm run verify</code>", "No cluster by default", "The committed corpus, generated files, receipts, and docs are self-consistent."],
    ["Fresh Helm-vs-cub comparison", "<code>npm run kind-parity:run -- ...</code>", "Yes, kind", "Regular Helm and cub installer are compared on two vanilla kind clusters."],
    ["Committed kind receipts", "<code>npm run kind-parity:verify</code>", "No", "Existing two-cluster receipts and summaries remain internally consistent."],
    ["ConfigHub/OCI live lane", "<code>npm run live-parity:run -- ...</code>", "Yes, kind plus ConfigHub and OCI path", "The stricter live path for a committed recipe/base."],
    ["Lane semantics", "<code>npm run lane-tests:verify</code>", "No", "The lane matrix and its status vocabulary are still valid."],
    ["cub-scout receipt", "<code>cub-scout receipt validate &lt;receipt.json&gt;</code>", "No", "A receipt fingerprint and structure validate locally."],
  ];
  const routeRows = [
    ["Render", "Turn a chart, version, values, release name, namespace, and capability profile into exact Kubernetes objects.", "Object parity checks and rendered install checks."],
    ["Record", "Keep inputs, source lock, objects, diffs, receipts, scans, and observations with the chart configuration.", "A reviewer can see what changed and rerun the same check later."],
    ["Route", "Name the extras Helm leaves around the edges: hooks, CRDs, webhooks, generated facts, target prerequisites, Secrets, setup jobs, and GitOps handoff.", "Each extra is applied, observed, blocked, refused, or marked target-specific."],
  ];
  const topicRows = [
    [`<a href="../docs/user/verification.md">Verification docs</a>`, "The canonical docs landing page for proof commands and render-record-route."],
    [`<a href="../docs/user/verify-it-yourself.md">Verify It Yourself</a>`, "The practical command list for offline checks, rendered installs, parity receipts, and cub-scout receipts."],
    [`<a href="../docs/user/verification-lanes.md">Verification Lanes</a>`, "What each lane proves and what it does not prove."],
    [`<a href="../docs/user/choosing-commands.md">Choosing Commands</a>`, "When to use product commands versus repo verifiers."],
    [`<a href="../docs/user/expected-results-and-clusters.md">Expected Results And Clusters</a>`, "Which steps need a cluster and what output to expect."],
    [`<a href="../docs/user/outcomes-and-tests.md">Outcomes And Tests</a>`, "Which repo promises map to which test commands and CSVs."],
    [`<a href="../docs/user/live-parity.md">Live Parity</a>`, "How to read live Helm-vs-ConfigHub parity status."],
    [`<a href="../docs/user/chain-of-proof.md">Chain Of Proof</a>`, "Which boundary is proven by render, ConfigHub, delivery, and live observations."],
    [`<a href="../docs/user/what-we-refuse-to-claim.md">What We Refuse To Claim</a>`, "The refusal boundaries that keep proof language honest."],
    [`<a href="../docs/reference/two-cluster-parity-harness.md">Two-Cluster Harness</a>`, "The stricter Helm-vs-cub kind harness."],
    [`<a href="../tests/npm-scripts.md">NPM Script Catalog</a>`, "The full script catalog for maintainers."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Verification · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Verification</h1>
    <p class="lead">Use npm proof commands to check a claim. They are verification tools for this repo, not product install commands.</p>
    <p>Start with the question you need answered: generated site freshness, rendered tutorial output, committed receipts, or a fresh live parity run.</p>
    ${humanLinks([["Verify it yourself", "../docs/user/verify-it-yourself.md"], ["Verification lanes", "../docs/user/verification-lanes.md"], ["Proof page", "./proof.html"]])}
  </header>
  <main>
    ${generatedStamp(catalog, "verification page")}
    <section aria-labelledby="start-question">
      <h2 id="start-question">Start With The Question</h2>
      <p>Use the narrowest check that proves the claim. A passing generated-file check is useful, but it is not a fresh live test. A fresh live test is stronger for one row, but it can create clusters and receipts.</p>
      ${markdownLikeTable([
        ["Question", "Command or surface", "Needs cluster?", "What it proves"],
        ...commandRows,
      ], { rawSecondColumn: true })}
    </section>

    <section aria-labelledby="product-vs-proof">
      <h2 id="product-vs-proof">Product Commands And Proof Commands</h2>
      <div class="grid">
        <div class="card"><h3>Product commands</h3><p><code>cub</code>, <code>helm</code>, <code>kubectl</code>, Argo, and Flux render, install, deliver, or manage configuration.</p></div>
        <div class="card"><h3>Npm proof commands</h3><p><code>npm run ...</code> checks repo evidence: generated files, docs, data, tutorial renders, lane receipts, and proof summaries.</p></div>
        <div class="card"><h3>Full repo gate</h3><p><code>npm run verify</code> is a broad consistency gate. Use it before publishing or reviewing a large change, not as the first-user experience.</p></div>
      </div>
    </section>

    <section aria-labelledby="render-record-route">
      <h2 id="render-record-route">Recipe, Render, Record, Route</h2>
      <p>Flat YAML shows what would run. Verification adds the trail behind it and the routes around it, so hooks, CRDs, generated Secrets, setup jobs, and target prerequisites do not disappear.</p>
      ${markdownLikeTable([
        ["Move", "Meaning", "What gets checked"],
        ...routeRows,
      ])}
    </section>

    <section aria-labelledby="fresh-committed">
      <h2 id="fresh-committed">Fresh Evidence And Committed Evidence</h2>
      <div class="grid">
        <div class="card"><h3>Committed evidence</h3><p>Already in the repo. Use it to review a claim, publish generated pages, and confirm summaries still match receipts and CSVs.</p></div>
        <div class="card"><h3>Fresh evidence</h3><p>Created by a new run. It may create kind clusters, use ConfigHub, publish OCI artifacts, wait for Argo or Flux, or write receipts.</p></div>
        <div class="card"><h3>Run live lanes serially</h3><p>Do not overlap fresh live lanes. Keep clusters, namespaces, credentials, and receipts isolated.</p></div>
      </div>
    </section>

    <section aria-labelledby="subtopics">
      <h2 id="subtopics">Subtopics</h2>
      ${markdownLikeTable([
        ["Topic", "Use it for"],
        ...topicRows,
      ], { rawFirstColumn: true })}
    </section>
  </main>
  <footer>Generated from committed helm-expt evidence. Verification commands check claims; product commands perform the Helm and ConfigHub work.</footer>
</body>
</html>
`;
}

function quirksHtml(catalog) {
  const rows = catalog.masterCatalogMatrix.filter((row) => row.row_kind !== "source");
  const byQuirk = new Map();
  for (const row of rows) {
    for (const quirk of splitSemicolonList(row.quirk_features)) {
      if (!byQuirk.has(quirk)) byQuirk.set(quirk, { rows: 0, charts: new Set(), examples: [] });
      const item = byQuirk.get(quirk);
      item.rows += 1;
      item.charts.add(row.chart);
      if (item.examples.length < 4 && row.chart && !item.examples.some((example) => example.chart === row.chart)) {
        item.examples.push({ chart: row.chart, version: row.version });
      }
    }
  }
  const definitions = {
    tpl: ["Template evaluation", "The chart uses Helm templating inside values or snippets. We preserve the rendered result and keep extension slots visible."],
    capabilities: ["Kubernetes capabilities", "The render depends on Kubernetes API capabilities. The recipe pins a capability profile so the render is repeatable."],
    "cluster-rbac": ["Cluster RBAC", "The chart creates cluster-wide permissions. The objects are visible before delivery and can be reviewed or gated."],
    "stateful-storage": ["Stateful storage", "The chart creates StatefulSets, PVCs, or storage-related objects. These need target-fit and upgrade care."],
    "generated-facts": ["Generated facts", "The chart or recipe needs generated values such as passwords, certs, or names. We record those as facts instead of hiding them."],
    lookup: ["Cluster lookups", "The render can depend on live cluster data. We route that through target facts or a named limitation."],
    crds: ["CRDs", "The chart includes custom resource definitions or depends on them. We track whether CRDs are installed, omitted, staged, or observed."],
    webhooks: ["Webhooks", "The chart installs admission or conversion webhooks. We track certificate lifecycle, readiness, and server-side behavior separately from render parity."],
    hooks: ["Helm hooks", "The chart uses Helm hook behavior. Hooks are routed, observed, blocked, refused, or marked target-specific. They are not silently treated as ordinary static YAML."],
  };
  const quirkRows = Array.from(byQuirk.entries())
    .sort((a, b) => b[1].rows - a[1].rows || a[0].localeCompare(b[0]))
    .map(([quirk, item]) => {
      const [label, meaning] = definitions[quirk] ?? [quirk, "Tracked quirk from the catalog matrix."];
      const examples = item.examples
        .map((example) => `<a href="./charts/${chartPageFileName({ chart: example.chart, version: example.version })}">${escapeHtml(example.chart)}</a>`)
        .join(", ");
      return [label, meaning, String(item.charts.size), String(item.rows), examples || "see matrix"];
    });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Helm Quirks · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Helm Quirks</h1>
    <p class="lead">Render parity tells you ConfigHub preserved Helm's object set. Quirks tell you what still has to be true for those objects to work: CRDs, webhooks, generated values, cluster lookups, storage, RBAC, hooks, and target facts.</p>
    <p>This is the page for the “what will this chart assume?” question. Use it before trusting a green render or a green GitOps sync.</p>
    ${humanLinks([["Browse charts", "./charts/index.html"], ["Open matrix", "./matrix.html"]])}
  </header>
  <main>
    <section aria-labelledby="how">
      <h2 id="how">How To Use This Page</h2>
      <div class="grid">
        <div class="card"><h3>Start here</h3><p>Use this page to understand the words in the matrix. It explains what each quirk means, why it matters, and what the user or target must provide.</p></div>
        <div class="card"><h3>Then check a chart</h3><p>Open the Helm Ops Catalog or the matrix to see whether a specific chart and base has that quirk.</p></div>
        <div class="card"><h3>Then check the route</h3><p>For hooks, CRDs, webhooks, target facts, and generated facts, use the row's route, gap, and next-action fields to see what must happen before delivery.</p></div>
      </div>
      <p><a href="./charts/index.html">Open Helm Ops Catalog</a> · <a href="./matrix.html">Open status matrix</a> · <a href="../docs/reference/helm-quirk-support-matrix.md">Read the reference matrix</a></p>
    </section>

    <section aria-labelledby="list">
      <h2 id="list">Quirk List</h2>
      ${markdownLikeTable([
        ["Quirk", "What it means", "Charts", "Rows", "Example charts"],
        ...quirkRows,
      ], { rawFifthColumn: true })}
    </section>

    <section aria-labelledby="important">
      <h2 id="important">Important Boundaries</h2>
      <div class="grid">
        <div class="card"><h3>Render parity is not enough</h3><p>A chart can render the same objects as Helm and still need CRDs, a Secret, webhook readiness, storage, cloud identity, or a controller to be ready.</p></div>
        <div class="card"><h3>Hooks are explicit routes</h3><p>A hook route tells you what must happen. It is not a claim that every hook is automatically executed by the public catalog.</p></div>
        <div class="card"><h3>Watch is useful</h3><p>A watch or blocked row is not hidden failure. It is the catalog saying what remains to stage, observe, or decide.</p></div>
      </div>
    </section>
  </main>
  <footer>Generated from committed helm-expt evidence. Use the matrix for exact chart and variant status.</footer>
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
    ["No whole-values-space proof", "The catalog proves named bases. Custom values must be rendered, checked, and recorded with receipts."],
    ["No universal hook execution", "Hooks are inventoried and routed; execution is claimed only with live evidence."],
    ["No production claim from render parity", "Production support requires target-scoped decisions and fresh receipts."],
    ["No signature-as-safety shortcut", "Signatures prove origin/integrity. Scans, policies, and live evidence carry safety claims."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Proof · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>What We Checked</h1>
    <p class="tagline">Use this page to see which claims have evidence and which ones still need a chart, values file, or target-specific check.</p>
    <p>First we check that cub preserves Helm's objects. Then we track scans, approvals, delivery, live checks, and limits separately.</p>
    ${humanLinks([["Start with Verification", "./verification.html"], ["Read the matrix", "./matrix.html"], ["Read the claims register", "../data/claims-register/summary.md"]])}
  </header>
  <main>
    ${generatedStamp(catalog, "proof page")}
    <section aria-labelledby="counters">
      <h2 id="counters">Current Proof Counters</h2>
      <p>These counters are not one giant green badge. Each lane checks a different question, and production use still depends on target scope and fresh evidence.</p>
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
      <p>Use <a href="./verification.html">Verification</a> for the command map, <a href="../docs/user/verification-lanes.md">Verification Lanes</a> for lane meanings, and <a href="../docs/user/chain-of-proof.md">Chain Of Proof</a> for the boundary between repo evidence, ConfigHub, GitOps, and live observations.</p>
    </section>

    <section aria-labelledby="serious">
      <h2 id="serious">Serious Charts Are The Test</h2>
      <p>Hard charts are where mistakes hurt: kube-prometheus-stack, cert-manager, External Secrets, Argo Workflows, Argo Rollouts, stateful databases, and charts with hooks, CRDs, webhooks, generated secrets, storage, or target facts.</p>
      <p>This is the expert/SRE problem. Before a fleet change ships, someone needs to know what it touches, what the cluster must already provide, which checks passed, how it will be delivered, and what the live system reported afterward.</p>
      <p>For these charts, a green render is not enough. The page must say which prerequisites are required, which lifecycle route is selected, what the target observed, and whether the production scope is accepted, superseded, rejected, or still under review.</p>
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
      <p>A breaking chart is useful QA. It needs to become a test fixture, a named refusal, or a routed gap. It must not disappear into prose.</p>
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
	            "No. You keep Helm charts. The catalog adds ready-to-use base variants, recorded render inputs, generated output, scans, receipts, live evidence, and ConfigHub Units when uploaded.",
	          links: [["Choosing commands", "../docs/user/choosing-commands.md"], ["Browse charts", "./charts/index.html"]],
	        },
	        {
	          status: "answered",
	          question: "Do I have to rewrite my charts?",
	          answer:
	            "No. We do not ask you to abandon Helm charts for a new chart language. We help you make better choices with the charts you already use.",
	          links: [["Why this exists", "../docs/user/why-this-exists.md"], ["Creating variants", "../docs/user/creating-variants.md"]],
	        },
	        {
	          status: "answered",
	          question: "How is cub installer different from cub helm?",
	          answer:
	            "cub helm imports an arbitrary chart and values as a ConfigHub base. cub installer reads a maintained catalog package with named configurations and requirements. They are optional preparation tools. The official tutorial teaches the ConfigHub journey after that starting point.",
	          links: [["Official tutorial", CONFIGHUB_TUTORIAL_URL], ["cub helm plugin", "https://github.com/confighub/cub-helm"], ["cub installer plugin", "https://github.com/confighub/installer"]],
	        },
		        {
		          status: "answered",
		          question: "Do you support every Helm values combination?",
		          answer:
		            "No. A chart can expose too many combinations for one tested claim. The catalog covers common operating choices with chart-specific base variants. Examples include default, no-CRDs, existing Secret, server-only, HA, and internal service.",
	          links: [["Helm base variants and values", "../docs/user/helm-presets-and-values.md"], ["Helm render intents", "../docs/user/helm-render-intents.md"]],
	        },
		        {
		          status: "answered",
		          question: "Isn't that case-specific?",
		          answer:
		            "Yes. Helm charts differ, so the catalog records chart-specific base variants, tests, and notes. AI can help maintain those variants across chart versions. Tests and receipts determine what the catalog accepts.",
	          links: [["Helm Ops Catalog", "./charts/index.html"], ["AI and the catalog", "./ai.html"]],
	        },
		        {
		          status: "answered",
		          question: "What is a base variant?",
		          answer:
		            "A base variant is a supported Helm configuration for one chart version. It records the values and render inputs. It also captures the Kubernetes YAML and names any extra install work.",
	          links: [["Base variant explanation", "./charts/index.html#base-variants"], ["Creating variants", "../docs/user/creating-variants.md"]],
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
		            "Choose a chart and base variant, then record the values and render inputs. Render the YAML and handle any extra install work. Deliver the reviewed result and observe it live. Hooks, CRDs, setup jobs, Secrets, and cluster requirements remain separate decisions until evidence proves each one.",
	          links: [["How it works", "../docs/user/how-it-works.md"], ["The data model", "../docs/user/confighub-data-model.md"]],
	        },
	        {
	          status: "answered",
	          question: "How is config delivered, and what about OCI and credentials?",
	          answer:
	            "ConfigHub publishes the reviewed Units in one Space as a release OCI. Argo CD, Flux, or direct apply can use it without rendering Helm again. A hook fixture proves the mechanism. An NGINX receipt proves one catalog base through all three paths at one digest. Other bases need their own receipts. cub cluster up installs the Argo CD pull credential. The Flux test copies it into flux-system without printing it.",
          links: [["Deployment path", "../docs/user/cub-deployment-path.md"], ["Exact NGINX result", "../data/catalog-oci-delivery-proof/summary.md"], ["GitOps adopter guide", "../docs/user/gitops-adopter-guide.md"]],
        },
	        {
	          status: "answered",
	          question: "How do upgrades and rollback work?",
	          answer:
	            "ConfigHub compares the candidate with the Kubernetes objects you already reviewed. It publishes the approved result as OCI. Every Unit keeps its revision history. The Redis live test restored the exact pre-upgrade revisions and published a rollback OCI. It then tested both clusters again. This restores configuration, not database data. Irreversible migrations still need a chart-specific recovery plan.",
          links: [["Day-2: upgrade & rollback", "../docs/user/day2-upgrade-rollback.md"], ["Why synced is not working", "../docs/user/why-synced-is-not-working.md"]],
        },
	        {
	          status: "answered",
	          question: "What is a Unit, a space, or a target?",
	          answer:
	            "A Unit is one versioned desired-state record. A Space holds related Units. A Target defines where ConfigHub delivers them. An OCI Target publishes the Space as a bundle.",
          links: [["The data model", "../docs/user/confighub-data-model.md"], ["How it works", "../docs/user/how-it-works.md"]],
        },
	        {
	          status: "answered",
	          question: "I already run Argo or Flux. What changes?",
	          answer:
	            "You keep your controller. Point it at the OCI bundle that ConfigHub publishes from reviewed Units. The controller no longer rerenders Helm values from Git. Hooks become recorded routes with named execution steps.",
          links: [["GitOps adopter guide", "../docs/user/gitops-adopter-guide.md"], ["Deployment path", "../docs/user/cub-deployment-path.md"]],
        },
	        {
	          status: "answered",
	          question: "What is safe for AI to change?",
	          answer:
	            "Ask AI to propose a new base, derived variant, policy change, or object patch. ConfigHub can show the diff and require tests or approval. Do not let AI rewrite live state or bypass the recorded change path.",
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
		            "Hooks are not ordinary static YAML. Each chart page says whether to run setup, use a tested GitOps action, require a decision, or stop. A recorded route does not mean ConfigHub runs it automatically.",
	          links: [["Hooks and actions", "./charts/index.html#actions"], ["What happens to chart hooks", "../docs/user/chart-hooks-what-happens.md"]],
	        },
	        {
	          status: "answered",
	          question: "What about CRDs?",
	          answer:
	            "CRDs need an ownership decision. Some base variants include them. Some base variants leave them out because the target cluster or another controller owns them. If a chart needs CRDs before custom resources apply, the chart page should say that before you install.",
	          links: [["Helm quirks", "./quirks.html"], ["Target prerequisites", "../docs/user/target-prerequisites.md"]],
	        },
        {
          status: "answered",
          question: "Where do Secrets and credentials live?",
          answer:
            "Do not hide them inside ConfigHub by accident. The catalog separates generated Secrets, existing-Secret references, target facts, and runtime Secret lifecycle where the chart requires that distinction.",
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
            "Not as a shipped product path yet. The reverse-reconcile design defines authority, scoped write-back, attribution, and round-trip proof. The product still needs a gated command and live proof.",
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
            "Yes, but the route matters. If a choice changes Helm inputs or object shape, it belongs in a new base variant or import path. If it refines an uploaded object set, it belongs in a derived ConfigHub variant.",
          links: [["Helm base variants and values", "../docs/user/helm-presets-and-values.md"], ["Custom overlays", "../docs/user/custom-overlays.md"], ["Change routing before OCI", "../docs/user/change-routing-before-oci.md"]],
        },
	        {
	          status: "answered",
	          question: "Can I load my existing app, platform, stack, or live cluster?",
	          answer:
	            "Yes. Start with a read-only discovery or import. Review the sources, targets, objects, labels, and owners. Then keep the imported Units, create a recipe, or build a managed application.",
          links: [["Adopting existing apps", "../docs/user/adopting-existing-apps.md"], ["Apps guide", "./journey.html"]],
        },
        {
          status: "answered",
          question: "Which path should I take?",
          answer:
            "Use the public catalog when a reviewed base variant exists. Use plain Helm when the chart still needs a better base variant or limitation decision. Create a new base variant when Helm inputs change. Create a derived ConfigHub variant when the change is post-render. Ask for managed help when private charts, teams, approvals, fleet operations, or production responsibility enter the path.",
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
	            "The adoption audit lists places where cub is harder than Helm today. They include defaults, one-value changes, direct upgrades, CRD ordering, uninstall, and rollback. Use Helm when one of these gaps blocks a reliable cub path.",
          links: [["Adoption audit", "../docs/planning/helm-vs-cub-adoption-audit.md"], ["Helm to cub migration", "../docs/user/helm-to-cub-migration.md"]],
        },
	        {
	          status: "answered",
	          question: "How much of the top-100 is ready for a user?",
	          answer:
	            "The catalog does not make one claim for all 100 charts. Some are ready to try. Others need cluster prerequisites, operator review, or a better base.",
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
	            "Not yet. The top-20 has the strongest evidence. The top-100 has clearer readiness records. Most top-500 entries remain analysis and triage data until they gain recipes, bases, and receipts.",
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
            "Public catalog browsing, local render checks, and catalog package setup are free or low-friction. Private catalogs, teams, approvals, application variants, promotions, fleet operations, and production responsibility are ConfigHub-managed.",
          links: [["Apps", "./journey.html"], ["Upgrade", "./private/"]],
        },
	        {
	          status: "answered",
	          question: "What can we build once the objects are data?",
	          answer:
	            "The RBAC report tests every committed default render without a cluster or another Helm run. A live example removes unnecessary Secret access. It requires approval, publishes the reviewed objects as OCI, and verifies the Argo CD result on Kubernetes.",
          links: [["RBAC report", "../data/app-readiness/summary.md"], ["Live correction", "../data/rbac-review-live-proof/summary.md"]],
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
	            "Start by comparing the rendered objects. Inspect cluster prerequisites, lifecycle routes, image pulls, controller status, and workload health. Then classify the problem as a recipe gap or a cluster runtime gap.",
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
	          status: "answered",
	          question: "Do default bases generate fresh passwords?",
	          answer:
	            "No. Keep credential material outside the render. For affected charts, the package default now uses an existing Secret and renders no shared password. The page gives you a command to create fresh Secret material before apply. Fixed-password demo bases are explicit, non-default choices.",
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
            "Not safely yet. A plain apply of a bundle that contains both a CRD and a custom resource can apply the custom resource before the CRD is established. The no-controller path needs CRD-first ordering and a wait/retry step, or a controller that handles ordering.",
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
  <title>FAQ · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
	  <header class="hero human-hero">
	    ${topNav(".")}
	    <h1>FAQ for skeptical Helm users.</h1>
	    <p class="lead">This page answers the questions an engineer asks before trusting the model. What problem does it solve? What has evidence? What remains limited? When is plain Helm still the right tool?</p>
    <p>Each answer says what works today, what is still limited, and where to check the evidence.</p>
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
  <footer>Generated from helm-expt proof data. FAQ answers route to evidence, not slogans.</footer>
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
  <title>Known Gaps · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Known Gaps We Surface</h1>
    <p class="tagline">A hidden gap is operational risk. A named gap is a decision: fix it, route it, accept it, block it, or keep using Helm for that case.</p>
  </header>
  <main>
    ${generatedStamp(catalog, "known gaps page")}
    <section aria-labelledby="rule">
      <h2 id="rule">The Rule</h2>
      <p>If a path is awkward, incomplete, target-specific, or unsafe by default, the site marks it <code>watch</code>, <code>blocked</code>, <code>refused</code>, or <code>n/a</code> with a reason. That is more useful than a green-looking demo that hides the hard part.</p>
      <p>This is how the catalog helps operations work: it turns uncertainty into a next action instead of asking users to trust a slogan.</p>
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

function whoRunsVariantTables(c, emissionChart = null) {
  const showVersion = new Set(c.variants.map((variant) => variant.recipeVersion).filter(Boolean)).size > 1;
  return c.variants.map((v) => {
    const emissionVariant = emissionChart?.variants?.find((candidate) =>
      candidate.base === v.base && (!candidate.recipeVersion || candidate.recipeVersion === v.recipeVersion));
    const rows = v.routes.map((r) => {
      const emission = emissionVariant?.routes?.find((candidate) =>
        candidate.route_name === r.route_name && candidate.action_kind === r.action_kind);
      return [
        `${escapeHtml(`${r.quirk_class} (${r.route_name})`)}${r.operatingDetails ? `<br><span class="small">${escapeHtml(r.operatingDetails)}</span>` : ""}`,
        r.whoRuns,
        emission?.argo || "No Argo CD mapping recorded.",
        emission?.flux || "No Flux mapping recorded.",
        r.delta === "kept" ? "—" : `${r.delta}${r.reason ? ` — ${r.reason}` : ""}`,
      ];
    });
    const evidence = [...new Set(v.routes.flatMap((route) => splitDisposition(route.evidence)))];
    const nextActions = [...new Set(v.routes.map((route) => route.nextAction).filter(Boolean))];
    const version = showVersion && v.recipeVersion ? `@${v.recipeVersion}` : "";
    const crdHeading = v.requiredCrdCount
      ? v.packagedCrdCount === v.requiredCrdCount
        ? `: package applies ${v.requiredCrdCount} CRDs first`
        : `: needs ${v.requiredCrdCount} CRDs supplied first`
      : "";
    const heading = `${v.base}${version}${crdHeading}`;
    const evidenceLine = evidence.length || nextActions.length
      ? `<p class="small">${evidence.length ? `<strong>Evidence:</strong> ${pathLinks(evidence.join(";"))}` : ""}${evidence.length && nextActions.length ? "<br>" : ""}${nextActions.length ? `<strong>Next:</strong> ${escapeHtml(nextActions.join("; "))}` : ""}</p>`
      : "";
    return `<h4>${escapeHtml(heading)}</h4>${markdownLikeTable([["Hook or setup step", "Who handles it?", "Argo CD mapping", "Flux mapping", "Change for this variant"], ...rows], { rawFirstColumn: true })}${evidenceLine}`;
  }).join("\n");
}

function hooksWhoRunsSection(catalog) {
  const charts = catalog.lifecycleByVariant ?? [];
  if (!charts.length) return "";
  const withVariants = charts.filter((c) => c.hasBuiltVariants);
  const flat = charts.filter((c) => !c.hasBuiltVariants);
  const chartBlock = (c) => {
    const emission = (catalog.gitopsRouteEmission ?? []).find((candidate) => candidate.chart === c.chart);
    return `<div class="card"><h3>${escapeHtml(c.chart)}</h3>${whoRunsVariantTables(c, emission)}</div>`;
  };
  return `
    <section aria-labelledby="whoruns">
      <h2 id="whoruns">After You Deploy, Who Runs Each Hook?</h2>
      <p>Per chart and per built variant, in plain words. Render parity delivers the objects. Hooks still need an owner. This view lists each hook as a lifecycle step, then says whether it belongs to your delivery pipeline, a GitOps action where evidence exists, a cub action, an opt-in check, or a current blocker. The public product does not auto-execute these yet (<code>automatic: false</code>); automatic execution with receipts is tracked in <a href="https://github.com/confighub/helm-expt/issues/688">#688</a>. <a href="../data/lifecycle-routes-by-variant/by-variant.html">Open the standalone colored view</a> · <a href="../data/gitops-route-emission/emission.html">the GitOps step (Argo/Flux) per route</a> · <a href="../data/lifecycle-routes-by-variant/summary.md">data</a>.</p>
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
  <title>Hooks And Actions · Config Test Centre</title>
</head>
<body>
  <p>Hooks and lifecycle behavior are now covered on the Helm Ops Catalog page as <a href="./charts/index.html#actions">hooks and actions</a>.</p>
</body>
</html>
`;
}

function privateHtml(catalog) {
  const tierRows = [
    ["Public Helm site", "Browse chart pages, try catalog packages, inspect objects, and run public verification checks.", "No ConfigHub account needed."],
    ["Self-sign-up SaaS", "Store team configurations, manage versions, review diffs, and connect delivery workflows.", "Hosted ConfigHub account."],
    ["Standalone enterprise product", "Run ConfigHub for private charts, internal platforms, policy, audit, and production operations.", "Enterprise deployment and support."],
    ["Private catalog support", "Bring private charts, wrapper charts, platform values, customer overlays, and internal stacks.", "Commercial feature."],
    ["Production operations", "Use approvals, changesets, GitOps handoff, observations, fleet queries, and audit history.", "Commercial feature."],
  ];
  const workRows = [
    ["Teams and shared work", "Store chart configurations where teammates can find, review, and reuse them."],
    ["Private application delivery", "Use ConfigHub with your own charts, Kubernetes files, platform services, and release process."],
    ["Environment versions", "Manage development, staging, production, region, and customer versions without copying values files by hand."],
    ["Upgrade review", "Compare old and new rendered objects before a release reaches production."],
    ["Audit and support", "Keep a record of inputs, diffs, approvals, delivery, observations, and receipts."],
  ];
  const commercialRows = [
    ["Private Helm catalogs", "Use the same catalog model for charts and settings that cannot be public."],
    ["Application fleets", "Manage many customer, region, or environment versions from recorded inputs and exact diffs."],
    ["Hooks, CRDs, and setup work", "Make the extra Helm work visible so it can be checked, ordered, assigned, or automated."],
    ["Bulk operations", "Scan, patch, approve, promote, and observe many applications together."],
    ["Security and audit", "Keep signed artifacts, scan diffs, digest inventory, policy gates, and audit history."],
    ["Older chart versions", "Keep supporting older versions when upstream changes break your current deployment."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Private · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav("..")}
    <h1>Upgrade to ConfigHub</h1>
    <p class="lead">If you like ConfigHub, please use the commercial edition. It is available as a <a href="${confighubOutboundUrl(CONFIGHUB_ENTERPRISE_URL, "private")}">standalone enterprise product</a> and as a <a href="${confighubOutboundUrl(CONFIGHUB_SIGNUP_URL, "private")}">self-sign-up SaaS</a>.</p>
    <p>Below you will find some of the current and intended benefits of the commercial product for users of this Helm site.</p>
  </header>
  <main>
    ${generatedStamp(catalog, "private page")}
    <section aria-labelledby="why-upgrade">
      <h2 id="why-upgrade">Why Upgrade?</h2>
      <p>The public Helm site helps you try standard charts and understand what ConfigHub is doing. The commercial product is for private work: your charts, your applications, your teams, your approvals, and your production history.</p>
      <p>Use it when one chart becomes many configurations, when several people need to review a release, or when you need a durable record of what changed and why.</p>
    </section>

    <section aria-labelledby="tiers">
      <h2 id="tiers">Available Options</h2>
      ${markdownLikeTable([
        ["Option", "What it gives you", "Access"],
        ...tierRows,
      ])}
    </section>

    <section aria-labelledby="journey">
      <h2 id="journey">What The Commercial Product Helps With</h2>
      <p>Start with the free site when you want to inspect public charts. Move to ConfigHub when you want to keep those configurations, share them with a team, and manage releases over time.</p>
      ${markdownLikeTable([
        ["Need", "How ConfigHub helps"],
        ...workRows,
      ])}
    </section>

    <section aria-labelledby="commercial">
      <h2 id="commercial">Current And Intended Benefits</h2>
      <p>These are the main areas where the commercial product is meant to add value for Helm users.</p>
      ${markdownLikeTable([
        ["Area", "Benefit"],
        ...commercialRows,
      ])}
    </section>

    <section aria-labelledby="more">
      <h2 id="more">More Detail</h2>
      <p>These project notes describe the current support model, the commercial plan, and the claim boundaries behind this page.</p>
      <div class="grid">
        <div class="card"><h3>Support tiers</h3><p><a href="../../docs/user/product-support-tiers.md">Open product support tiers</a>.</p></div>
        <div class="card"><h3>Commercial model</h3><p><a href="../../docs/planning/verified-install-commercial-model.md">Open verified-install commercial model</a>.</p></div>
        <div class="card"><h3>Serverless plan</h3><p><a href="../../docs/planning/serverless-verified-install-plan.md">Open serverless verified-install plan</a>.</p></div>
        <div class="card"><h3>Claims register</h3><p><a href="../../data/claims-register/summary.md">Open current claim boundaries</a>.</p></div>
      </div>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. Commercial features depend on product, support, policy, and SLA decisions beyond the public proof corpus.</footer>
</body>
</html>
`;
}

function demoOrgHtml(catalog) {
  const policyFacts = applyPolicyFacts();
  const sourceCoverage = policySourceCoverage(policyFacts);
  const keepRows = [
    ["bitnami/redis", "default, reuse-existing-secret", "The version ladder: a living tree upgraded 25.5.3 to 27.0.0 through reconcile and promotion, with staging's local change preserved."],
    ["argo-cd/argo-cd", "default, no-crds", "The CRD split: the same chart with CRDs bundled or separated, side by side."],
    ["hashicorp/vault", "dev-mode, default, ha-raft-ui", "Variant diversity: three operating shapes of one chart."],
    ["ingress-nginx/ingress-nginx", "default, internal-clusterip, admission-disabled", "The admission-webhook certificate quirk, three ways."],
    ["prometheus-community/prometheus", "default, server-only-ephemeral", "The Get Started chart, as it lands in an org."],
    ["prometheus-community/kube-prometheus-stack", "no-crds", "The serious chart: eight recorded lifecycle routes in its recipe unit."],
    ["grafana/grafana", "existing-secret-ingress, static-passwords", "Secrets handled two ways."],
    ["bitnami/mysql", "existing-secret, static-passwords", "The secrets story: staged credential beside generated credential, diffable."],
    ["bitnami/rabbitmq", "existing-secret, static-passwords", "A recipe unit whose routing metadata honestly says: nothing to route."],
    ["bitnami/nginx", "http-clusterip, existing-tls-ingress", "The fleet: four environments from one base, one deliberately behind."],
  ];
  const readmeRows = catalog.helmCatalogReadmes ?? [];
  const readmeKindCounts = countBy(readmeRows, "kind");
  const readmeCountRows = ["preset", "environment", "fleet", "pilot", "route", "org"]
    .filter((kind) => readmeKindCounts[kind])
    .map((kind) => [kind, String(readmeKindCounts[kind])]);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>The Demo Org · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
    <header class="hero human-hero">
      ${topNav(".")}
      <h1>The catalog, living in a ConfigHub org</h1>
      <p class="lead">The chart pages show the evidence behind each catalog choice. The demo org shows what happens after you upload a chart configuration. You can inspect shared configuration, environment versions, promotions, policy tests, and revision history. It contains ten charts chosen for the problems they explain.</p>
    ${humanLinks([["Helm Ops Catalog", "./charts/index.html"], ["How it works", "./how-it-works.html"], ["Apps", "./journey.html"]])}
  </header>
  <main>
    ${generatedStamp(catalog, "demo org page")}
      <section aria-labelledby="readmes">
        <h2 id="readmes">Start With The README In Each Space</h2>
        <p>Every current Space in the live <code>helm-catalog</code> org has one README. It explains why the Space exists and which Helm problem it demonstrates. It also tells you what to open, what the example proves, and where to find supporting evidence.</p>
        <p>Open ${signupLink("demo-org-readmes", "hub.confighub.com")} and choose the <code>helm-catalog</code> org. Open a Space, then open its README.</p>
        <p>You can also read the same pages on this website. Start with the <a href="../data/helm-catalog-readmes/summary.md">demo org README index</a>.</p>
      ${markdownLikeTable([
        ["README kind", "Spaces"],
        ...readmeCountRows,
        ["total", String(readmeRows.length)],
      ])}
      <p class="quiet-line">Space counts as of ${escapeHtml(String(catalog.generatedAt).slice(0, 10))} (UTC), from the committed README data for the <code>helm-catalog</code> org.</p>
    </section>

      <section aria-labelledby="config-as-data">
        <h2 id="config-as-data">Why This Org Matters</h2>
        <p>A Helm chart is a program that produces Kubernetes objects. The templates can hide the final answer to ordinary operating questions.</p>
        <ul>
          <li>Which namespaces are missing a policy?</li>
          <li>Who can read Secrets?</li>
          <li>What changed between staging and production?</li>
          <li>Where does a risky setting appear across the fleet?</li>
        </ul>
        <p>The demo org stores rendered Kubernetes YAML as versioned Units in a Space. ConfigHub can search, compare, review, and deliver those Units. The README explains where they came from and why the Space exists.</p>
        <p>When you find a problem, you change the same object that you inspected. ConfigHub records that change as a revision before delivery.</p>
    </section>

      <section aria-labelledby="what">
        <h2 id="what">What is in the org</h2>
        <p>Each base variant below is a root Space containing one supported Helm render. Its Kubernetes YAML is stored as readable Units.</p>
        <p>Each Space has a README, rendered objects, identifying labels, route labels, and policy tests. Some deeper examples also include recipe, render-record, route, or proof Units.</p>
      ${markdownLikeTable([
        ["Chart", "Base variants", "The story it tells"],
        ...keepRows,
      ])}
        <p class="quiet-line">The org uses ten charts so each example can include variants, promotions, and supporting evidence. The <a href="./charts/index.html">catalog pages</a> contain evidence for all 100 charts.</p>
    </section>

      <section aria-labelledby="exhibits">
        <h2 id="exhibits">Seven things to look at</h2>
        <p>Each exhibit proves one limited claim. Open the named Spaces and inspect each Unit's Revisions tab. The components view groups the Spaces by chart.</p>
        <p><strong>The version ladder.</strong> Open <code>bitnami-redis-base</code>, <code>-staging</code>, and <code>-prod</code>. Staging has a local setting of two replicas. The base moved from chart 25.5.3 to 27.0.0, then the change was promoted. The staging revision history shows both the upgrade and the retained replica setting.</p>
        <p><strong>The fleet.</strong> Open the four <code>bitnami-nginx-fleet</code> Spaces for dev, staging, prod-us, and prod-eu. One base change was promoted to all environments. Prod-eu still reports one pending upstream Unit. Dev and staging keep local replica counts while receiving the shared image change. Both production Spaces require approval.</p>
        <p>The base also moved its NGINX image to an internal registry without changing the digest. The <a href="./d/docs/user/image-registry-migration.html">walkthrough and receipt</a> show the commands and revision history. This proves the stored ConfigHub records. It does not prove Kubernetes delivery.</p>
        <p><strong>The secrets story.</strong> The two mysql Spaces differ in exactly one decision: a staged external credential versus a generated one. Diff any unit across the pair to see precisely what the safer choice changes.</p>
        <p><strong>The CRD split.</strong> The two argo-cd Spaces show the chart with and without bundled CRDs. The no-crds Space states that the cluster owns them. A live test showed that applying custom resources before their CRDs fails. Applying CRDs first and waiting for them succeeds. The Space's <code>ProofReceipt</code> label links to that result.</p>
        <p><strong>The hooks.</strong> <code>hook-probe-base</code> contains a Job with visible Argo CD hook annotations. The same OCI fixture ran through Argo CD, Flux, and direct apply. The hook Job completed on the cluster in all three tests. The <code>ProofReceipt</code> and <code>DeliveryReceipt</code> labels link to the evidence.</p>
        <p><strong>Local changes and new releases.</strong> Open <code>hashicorp-vault-demo-base</code> and its dev, staging, and production variants. Dev added a cost label. Staging uses two replicas, and production uses three.</p>
        <p>The base later added telemetry and release-track annotations. Staging and production received them while keeping their replica settings. Dev had changed the same annotations map, so promotion kept the dev map and skipped the base annotations. Two recorded reconcile revisions added them afterward. The revision history shows both cases.</p>
        <p><strong>A staged rollout.</strong> Staging first received a real audience environment variable. The base later added the same variable as <code>confighubplaceholder</code> and added a shared issuer. Promotion kept staging's real value and delivered the issuer. The <code>vet-placeholders</code> policy prevents the placeholder from reaching a cluster.</p>
        <p>The promotion also copied the new <code>render-record</code> Unit from the base into staging. The <a href="https://github.com/confighub/helm-expt/tree/main/runs/promote-silent-skip-proof">promotion receipt</a> records the complete test.</p>
        <p><strong>Proposals for missing product objects.</strong> ConfigHub does not yet have separate entities for recipes, render events, render provenance, or lifecycle routes. The org represents these ideas with Units, Links, and labels. The sections below identify each proposal and its limits.</p>
    </section>

      <section aria-labelledby="live-proof">
        <h2 id="live-proof">What ran live, exactly</h2>
        <p>These three examples ran on real clusters. Each receipt records the command, observations, result, and limit.</p>
        <p><strong>The hook delivery test.</strong> ConfigHub published one OCI bundle containing a ConfigMap and a migration Job. Argo CD, Flux, and a direct apply path pulled that same artifact on a throwaway kind cluster. Each path created the workload and completed the Job.</p>
        <p>This test covers one routed fixture on one recorded rig. It does not cover every chart, hook type, or production environment.</p>
        <p><strong>The CRD ordering test.</strong> Direct apply first tried to create a custom resource before its CRD was established. Kubernetes refused the custom resource with the recorded error. Applying the CRD first and waiting for it fixed the installation. A separate receipt records the chart-specific order through Argo CD and Flux.</p>
        <p><strong>The Kube Prometheus Stack lifecycle test.</strong> A direct run rendered catalog package 85.3.3 and verified its chart objects. It applied ten CRDs first, ran the certificate and webhook Jobs, tested the webhook and six workloads, then removed temporary Jobs.</p>
        <p>Separate clusters ran the Argo CD and Flux paths. Each installed the 85.3.3 no-crds OCI and upgraded to 86.1.0. Both controllers replaced the completed setup Jobs and passed the runtime tests after upgrade. ConfigHub does not yet select this route automatically.</p>
      <p class="quiet-line">The receipts are committed in the repo (<a href="https://github.com/confighub/helm-expt/tree/main/runs/oci-hook-delivery-proof"><code>runs/oci-hook-delivery-proof</code></a>, <a href="https://github.com/confighub/helm-expt/tree/main/runs/crd-ordering-gap"><code>runs/crd-ordering-gap</code></a>, <a href="https://github.com/confighub/helm-expt/tree/main/runs/kps-lifecycle-route-proof"><code>runs/kps-lifecycle-route-proof</code></a>, and <a href="https://github.com/confighub/helm-expt/tree/main/runs/kps-gitops-lifecycle-proof"><code>runs/kps-gitops-lifecycle-proof</code></a>) and summarized under <code>data/</code>. Each throwaway cluster was deleted after its run.</p>
    </section>

      <section aria-labelledby="sketches">
        <h2 id="sketches">The sketches, explained</h2>
        <p>The catalog uses four ideas that are not ConfigHub entities today. The demo org represents them with ordinary Units, Links, and labels. You can open and query these proposals, but they are not shipped product features.</p>
      ${markdownLikeTable([
        ["The idea", "What the product has today", "The sketch standing in for it", "Where to look"],
        ["A recipe, the DRY source of a base variant: chart, version, declared inputs, and routing intent", "A plain Unit whose data happens to be recipe YAML; the server cannot tell it from a ConfigMap", "The recipe unit in every chart Space", "Any Space, unit recipe, data tab"],
        ["The act of rendering: who rendered what, from which recipe, when, producing which units", "Nothing. Rendering happens client-side in the installer; the server only sees the finished units arrive", "A render-record unit stating chart, base, renderer, time, and output count, marked status: sketch", "Space hashicorp-vault-demo-base, unit render-record"],
        ["Render provenance: an edge from every rendered unit back to its recipe", "Links exist, but they express apply-order dependencies between resources, not provenance", "One exemplar rendered-from-recipe Link, from the statefulset to the recipe. One rather than thirteen because the org's Link quota is nearly spent; the render-record describes the full set", "Space hashicorp-vault-demo-base, unit statefulset-vault-vault, links"],
        ["A lifecycle route as a thing: an addressable decision about behaviour that config alone cannot carry", "Rows in the repo's route data, labels on Spaces, annotations readable inside unit data. Real, but not product entities", "Eight LifecycleRoute units: seven chart lifecycle routes plus one explicit CRD-first route. Each stores its class, phase, executor, alternatives, evidence, and per-delivery implementation results.", "Space route-sketch-kube-prometheus-stack"],
      ])}
        <p>Each proposal Unit mirrors committed repo data. The top-level chart route remains <code>automatic: false</code>. Direct, Argo CD, Flux, and upgrade implementations have separate evidence.</p>
      <h3 id="kps-routes">The eight kube-prometheus-stack routes, one by one</h3>
      <p>A route records work that ordinary rendered objects do not perform. Five routes come from Helm hook behavior. The remaining three cover CRD order, target facts, and webhook readiness.</p>
      ${markdownLikeTable([
        ["Route", "Quirk it routes", "What it decides", "Execution"],
        ["crds-first", "ten bundled CRDs", "Apply and establish the CRDs before the chart's custom resources", "target-owned"],
        ["preflight-or-presync", "pre-install and pre-upgrade hooks", "Work the chart wants done before objects land runs as an explicit preflight or an Argo/Flux pre-sync step", "user-executes"],
        ["postsync-check-or-observation", "post-install and post-upgrade hooks", "Work the chart wants done after objects land runs as a post-sync check or a recorded observation", "user-executes"],
        ["upgrade-action-with-receipt", "upgrade-time hooks", "Upgrade-time actions run explicitly and leave a receipt, instead of firing invisibly mid-upgrade", "user-executes"],
        ["preserve-ordering", "hook weights", "Helm's numeric hook-weight ordering becomes explicit apply order or Argo sync-waves", "target-owned"],
        ["preserve-cleanup-policy", "hook delete-policy", "Hook resources Helm would silently delete after running are kept or removed by stated policy", "target-owned"],
        ["target-facts-or-preflight", "cluster lookups, not a hook", "Where the chart consults live cluster state, the answer comes from recorded target facts or an explicit preflight, not a hidden render-time lookup", "user-executes"],
        ["webhook-readiness-observation", "admission webhook readiness, not a hook", "The operator's admission webhook must be observed ready before dependent resources apply; an observation, not a timing gamble", "target-owned"],
      ])}
        <p class="quiet-line">Four routes are <em>user-executes</em>, and four are <em>target-owned</em>. Seven direct fresh-install implementations passed. Direct upgrade has not run. All eight chart-specific routes passed the recorded Argo CD and Flux install-and-upgrade path. ConfigHub does not yet select these routes automatically.</p>
    </section>

      <section aria-labelledby="checks">
        <h2 id="checks">The checks are live, and honest</h2>
        <p>Every policy-covered Space has ${policyFacts.baselineChecks} common tests. Schema, placeholder, and lifecycle-route tests can stop incomplete configuration. Workloads and AICR training runtimes receive tests for the fields they use. Production releases and system configuration also require approval before apply.</p>
        <p>The same policy can cover Helm, AICR, Kubara, Sveltos, or ordinary YAML after ConfigHub stores the objects.</p>
        <p>The live org has ${policyFacts.baselineSpaces} Spaces on common tests and ${policyFacts.approvalSpaces} on the approval policy. The approval set contains ${policyFacts.productionSpaces} production Spaces and ${policyFacts.systemConfigurationSpaces} system-configuration Spaces. These Spaces include ${sourceCoverage}. Each records its policy profile and starting format.</p>
        <p><code>npm run helm-org:verify</code> and <code>npm run helm-org:policy:verify</code> compare the live org with committed catalog and policy receipts.</p>
        <p class="quiet-line">The builder and receipts live under <a href="https://github.com/confighub/helm-expt/tree/main/data/helm-org"><code>data/helm-org/</code></a>. The org is named <code>helm-catalog</code> and is member-visible today. Other readers can use the committed receipts, these pages, and the walkthroughs.</p>
    </section>

      <section aria-labelledby="next">
        <h2 id="next">Do it with your own app</h2>
        <p>You can use the same steps for your own application. Upload it, create staging and production variants, promote a change, then deliver it through OCI. Your existing GitOps controller can apply the result.</p>
        <p>The <a href="./d/docs/user/variants-after-upload.html">variants walkthrough</a> explains each command and flag. The <a href="./journey.html">Apps page</a> explains how to combine your applications with catalog components.</p>
    </section>
  </main>
  <footer>${generatedStamp(catalog, "demo org page")}<p>Generated from committed helm-expt evidence and the committed org receipts. The demo org shows the mechanism; production claims still come only from receipts.</p></footer>
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
  <title>Private · Config Test Centre</title>
</head>
<body>
  <p>The tiers page moved to <a href="./private/">Private</a>.</p>
</body>
</html>
`;
}

function journeyHtml(catalog) {
  const appDemos = catalog.demoProgram.spec.apps;
  const appKinds = [
    ["One public chart", "A catalog chart such as Redis, Prometheus, ingress-nginx, or cert-manager that you want to install and keep updated."],
    ["Several charts", "A group of charts that must be released together, such as an application, database, cache, and monitoring."],
    ["Platform services", "Shared services such as ingress, certificates, policy, monitoring, logging, or identity."],
    ["Your own Kubernetes files", "Deployments, Services, ConfigMaps, Secrets, policies, and other objects written by your team."],
    ["Something already running", "An application that already exists in Argo, Flux, rendered YAML, a Helm release, or a live cluster."],
  ];
  const appFlow = [
    ["Start with something real", "Choose a catalog chart, an existing app, rendered YAML, a live namespace, or your own Kubernetes files."],
    ["Show the objects first", "List the files and Kubernetes objects before ConfigHub changes how anything is delivered."],
    ["Name what belongs together", "Group the objects that make up one application so a reviewer can see the whole thing."],
    ["Make versions", "Create development, staging, production, region, or customer versions without copying values files by hand."],
    ["Release and check it", "Send the approved files to GitOps or another delivery tool, then compare that with what the cluster reports."],
  ];
  const entryRows = [
    ["Catalog chart", "Pick a chart page, choose a base variant, and render the files.", "Trying a public chart first."],
    ["Existing Argo or Flux app", "Read the source, target, rendered objects, and current status.", "Teams that already use GitOps."],
    ["Rendered YAML", "Import the files and show which objects ConfigHub would manage.", "Applications already rendered by CI or Helm."],
    ["Live cluster", "Inventory what is running before making any change.", "Teams that need to understand an existing namespace."],
    ["Your own application", "Bring your Deployments, Services, ConfigMaps, and policies beside catalog charts.", "Private services and platform components."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Apps Guide · Config Test Centre</title>
  <style>${siteCss()}
    .app-flow { counter-reset: appstep; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 16px 0; }
    .app-step { counter-increment: appstep; border: 1px solid var(--line); border-radius: 10px; padding: 14px; background: var(--surface); }
    .app-step::before { content: counter(appstep); display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; background: var(--good); color: #fff; font-weight: 700; font-size: .78rem; margin-bottom: 8px; }
    .app-step h3 { margin: 0 0 8px; }
    .app-step p { margin: 0; font-size: .9rem; }
    @media (max-width: 980px) { .app-flow { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 640px) {
      .app-flow { grid-template-columns: 1fr; }
      main table, main tbody, main tr, main td { display: block; width: 100%; white-space: normal; }
      main thead { display: none; }
      main tr { padding: 10px 0; border-bottom: 1px solid var(--line); }
      main td { padding: 4px 6px; border: 0; font-size: .86rem; }
      main td:first-child { color: var(--ink); font-weight: 700; }
    }
  </style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Apps on ConfigHub</h1>
    <p class="lead">An App uses configuration already saved in ConfigHub to complete a repeated job, such as reviewing an upgrade, checking RBAC, or rolling a platform change across clusters.</p>
    <p>Start with the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "apps")}">official ConfigHub tutorial</a> if you have not yet installed, changed, and promoted one component. The <a href="./testing.html">Examples page</a> covers Helm, AICR, OCI, and YAML before they are saved.</p>
    <p>An App can then query the exact Kubernetes objects, propose a change, run the required checks, wait for approval, publish a release, and record the result. AI may help propose or explain a change. The reviewed objects and policy result still decide what can ship.</p>
    <p class="quiet-line"><a href="./demo-org.html">The demo org</a> shows catalog configurations, variant trees, promotions, and apply gates in ConfigHub.</p>
  </header>
  <main>
    <section aria-labelledby="app-kinds">
      <h2 id="app-kinds">What Counts As An Application?</h2>
      <p>An application is the set of Kubernetes objects your team operates together. It may be one chart, several charts, your own files, or something that is already running.</p>
      ${markdownLikeTable([
        ["Kind", "Meaning"],
        ...appKinds,
      ])}
    </section>

    <section aria-labelledby="entry">
      <h2 id="entry">Ways To Start</h2>
      <p>Start from the thing you already have. The first step is read-only: show the sources, files, objects, namespace, and owner before changing delivery.</p>
      ${markdownLikeTable([
        ["Entry", "First move", "Use it for"],
        ...entryRows,
      ])}
    </section>

    <section aria-labelledby="app-flow">
      <h2 id="app-flow">The Normal Order</h2>
      <p>Do not start by changing the cluster. Start by seeing the files, then group them, then make versions, then release.</p>
      <div class="app-flow">
        ${appFlow.map(([title, body]) => `<div class="app-step"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="existing">
      <h2 id="existing">Can I Start From An Existing App?</h2>
      <p>Yes. Start by reading it, not by replacing it. ConfigHub should show the source, target, namespace, objects, labels, and owner before it changes delivery.</p>
      ${markdownLikeTable([
        ["Starting point", "First action", "What you see"],
        ["Argo CD app", "Read or import the Argo app.", "Source repo, target cluster, namespace, rendered objects, and current sync status."],
        ["Flux HelmRelease or Kustomization", "Read or import the Flux object.", "Controller source, target namespace, rendered objects, and ownership."],
        ["Rendered YAML", "Import or preview the files.", "Objects, labels, namespaces, Secrets, CRDs, and likely review points."],
        ["Live cluster", "Inventory the namespace or selected objects.", "What is running now, who appears to own it, and what would need review before adoption."],
        ["Platform services", "Group related charts and files.", "Which shared services belong with the application and which are separate platform dependencies."],
      ])}
      <div class="card">
        <h3>Start read-only</h3>
        <p>These commands are preview commands. They show what ConfigHub finds or would import before anything changes in the cluster.</p>
        <pre><code>cub gitops discover --space my-space my-k8s-target
cub gitops import --space my-space my-k8s-target my-render-target \\
  --where-resource "metadata.namespace = 'argocd'"
kubectl get all -n payments -o yaml &gt; .tmp/payments.yaml
cub unit import payments-app .tmp/payments.yaml --dry-run</code></pre>
        <p>You see the resources, namespace, target, and source. At this stage nothing has been moved to ConfigHub delivery.</p>
      </div>
      <p>Only turn an existing app into a <code>cub installer</code> recipe when you want a maintained Helm render path, chart updates, and catalog-style checks. See <a href="../docs/user/adopting-existing-apps.md">Adopting Existing Apps</a>.</p>
    </section>

    <section aria-labelledby="examples">
      <h2 id="examples">Examples</h2>
      ${markdownLikeTable([
        ["Example", "What ConfigHub helps with"],
        ["Redis app", "One public chart can be rendered from a base variant, checked, changed for each environment, and released again."],
        ["Prometheus or kube-prometheus-stack", "A chart with CRDs, webhooks, and prerequisites can use base variants that say what the target must provide before release."],
        ["Platform services", "Ingress, certificates, policy, monitoring, and logging can be grouped with the application that depends on them."],
        ["Your service plus chart services", "Your own service can sit beside a database, queue, cache, or monitoring chart."],
        ["Existing app", "An application already in a cluster can be inventoried first, then brought under review when you are ready."],
        ["AI-suggested change", "AI can propose a values change or file edit. ConfigHub shows the exact diff and checks before it is approved."],
      ])}
      <p>The <a href="../data/redis-upgrade-app-proof/summary.md">Redis upgrade and rollback proof</a> follows one complete run from chart 25.5.3 to 27.0.0 and back. A two-replica edit stays in place, the candidate moves through development and staging, and two Argo CD clusters run both the candidate OCI and the separately published rollback OCI.</p>
      <p>The <a href="../data/rbac-review-live-proof/summary.md">RBAC review proof</a> starts with a service account that can read Secrets unnecessarily. It records one precise correction in ConfigHub, requires approval, publishes the approved objects as OCI, and lets Argo CD deliver them to an isolated cluster. Secret access is gone while ConfigMap access still works.</p>
      <p>Chart evidence still lives on the Helm Ops Catalog pages. This page explains how those charts become part of applications your team runs.</p>
    </section>

    <section aria-labelledby="app-program">
      <h2 id="app-program">Five working examples</h2>
      <p>Each row has a bounded example with committed evidence. The broader product capability remains partial until the missing work in the final column is complete.</p>
      ${markdownLikeTable([
        ["App", "What ran", "Broader status", "Still to build"],
        ...appDemos.map((demo) => [
          demo.name,
          demo.workedExample.result,
          demo.status,
          demo.workedExample.limit,
        ]),
      ])}
      <p><a href="../docs/user/config-catalog-demonstrations.md">Open the demonstration programme</a> for the steps, evidence, and current limit for every App.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. This page explains applications; operations, verification, and commercial boundaries live on their own pages.</footer>
</body>
</html>
`;
}

function variantsHtml(catalog) {
  const modelRows = [
    ["Component", "The thing you care about: Redis, ingress-nginx, payments-api, or a platform slice."],
    ["Variant", "One named shape of that thing: base, dev, staging, prod-us, prod-eu, or customer-a."],
    ["Base variant", "A Helm-rendered shape. Use it when values, chart version, CRDs, storage, HA mode, or Secret strategy change the Kubernetes objects."],
    ["Derived variant", "A ConfigHub-managed shape made from an existing base. Use it for environment, region, target, labels, approvals, and scoped post-render changes."],
    ["Promotion", "A controlled way to carry a reviewed change from one variant to another, with a preview before anything is applied."],
  ];
  const journeyRows = [
    ["Choose a base", "Pick the closest proved install shape from the chart page."],
    ["Load it into ConfigHub", "The rendered objects become managed config that can be named, compared, reviewed, and delivered."],
    ["Name the real-world variants", "Create the dev, staging, prod, region, or customer versions people actually use."],
    ["Preview the difference", "Look at the object and field changes before delivery. Small changes stay small."],
    ["Promote with a receipt", "Move a reviewed change forward only after the preview, gates, and receipts say what will happen."],
  ];
  const routeRows = [
    ["Make a base variant", "The choice changes the objects Helm would create.", "CRDs on or off, HA mode, generated Secret vs existing Secret, different values file."],
    ["Make a derived variant", "The object set is already right, but it needs to live in a different place or policy context.", "prod-us-east from a base, target binding, labels, approvals, observation policy."],
    ["Go back to the recipe", "The requested change belongs before render, not after it.", "New chart version, wrapper chart, customer overlay values, or a different rendered object set."],
  ];
  const exampleRows = [
    ["Redis", "Secret strategy changes the rendered objects, so it belongs in a base variant.", "./charts/bitnami-redis-25-5-3.html"],
    ["Prometheus", "A small server-only base can become environment-specific ConfigHub variants.", "../docs/user/prometheus-overlay-promotion-example.md"],
    ["kube-prometheus-stack", "A serious chart needs variants that carry target facts, lifecycle routes, and upgrade checks.", "./charts/prometheus-community-kube-prometheus-stack-85-3-3.html"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Variants · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Variants</h1>
    <p class="lead">Most Helm work starts with a simple request: use the same chart, but change one thing. Then dev, staging, prod, regions, and customers turn into values-file sprawl and fork pressure.</p>
    <p>ConfigHub makes those differences visible. A variant is one named configuration of the same component. It lets the team see which shape is being used, what changed, and whether the change stayed inside the approved boundary.</p>
    <p>The first decision is simple: does this change what Helm renders? If yes, make a base variant. If no, make a derived ConfigHub variant from an existing base.</p>
  </header>
  <main>
    <section aria-labelledby="model">
      <h2 id="model">The Model In One Picture</h2>
      <p>A component is the thing being shipped. A variant is one named shape of that thing.</p>
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
      <p>This gives the team plain questions to answer: which shape are we using, where did it come from, what changed, and is it safe to promote?</p>
    </section>

    <section aria-labelledby="choose">
      <h2 id="choose">The One Decision That Matters</h2>
      <p>Ask whether Helm would render different Kubernetes objects. That one question decides where the change belongs.</p>
      ${markdownLikeTable([
        ["Action", "Use it when", "Examples"],
        ...routeRows,
      ])}
    </section>

    <section aria-labelledby="journey">
      <h2 id="journey">A Good Variant Flow</h2>
      <p>A good variant flow is plain: choose the base, name the real-world variants, preview the change, then promote only what was reviewed.</p>
      ${markdownLikeTable([
        ["Step", "What happens"],
        ...journeyRows,
      ])}
      <p>The command surface today is <code>cub installer</code>, <code>cub variant create</code>, Unit diffs, and <code>cub variant promote</code>. Product screens can make this friendlier, but the same data remains available for review.</p>
      <p>For the exact commands with the why behind each flag, read <a href="../docs/user/variants-after-upload.md">After upload: create a variant and promote changes</a>. It starts where a base variant's <code>confighub.sh</code> ends.</p>
    </section>

    <section aria-labelledby="flow">
      <h2 id="flow">The Basic Flow</h2>
      <pre><code>cub installer setup --pull ${REDIS_INSTALLER_OCI_REF} --base default --work-dir .tmp/redis
cub installer upload --work-dir .tmp/redis --space helm-redis-default
cub variant create prod-us-east helm-redis-default --environment Prod --region us-east --target prod/prod-us-east
cub variant promote prod-us-east --dry-run -o mutations</code></pre>
      <p>You see a base, a downstream variant, the changed paths, and a preview before promotion.</p>
      <div class="card">
        <h3>Expected output</h3>
        <pre><code>created downstream variant
cloned Units linked to upstream Units
changed labels/target/gates only, unless an allowed mutation receipt says otherwise
promotion dry-run lists mutations before apply</code></pre>
      </div>
    </section>

    <section aria-labelledby="examples">
      <h2 id="examples">Examples</h2>
      <p>These examples show the same rule in different chart shapes.</p>
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
    ["Agentic app or plugin", "Build a domain-specific tool on top of ConfigHub data when raw YAML edits are too low-level.", "The tool provides domain semantics, guardrails, dry-run output, and explicit commit steps."],
    ["Private catalog", "Use ConfigHub-managed private paths when private sources, teams, SLAs, or production responsibility enter.", "This is the paid and managed boundary."],
  ];
  const proofRows = [
    ["ExternalDNS overlay", "Managed overlay golden for wrapper chart plus customer values.", "../data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md"],
    ["RBAC permissions report", "Broad permission checks over committed chart renders, with no cluster or fresh Helm run.", "../data/app-readiness/summary.md"],
    ["Live RBAC correction", "One exact permission change stored in ConfigHub, blocked until approval, then published as OCI and delivered by Argo CD to an isolated cluster.", "../data/rbac-review-live-proof/summary.md"],
    ["RBAC Manager for Agents", "Example CLI/plugin plus agent skills for Kubernetes RBAC inventory, who-can queries, findings, and guardrailed edits.", "https://github.com/confighub/examples/tree/main/rbac-manager-for-agents"],
    ["Custom overlays guide", "Plain user guide for base plus overlay cases.", "../docs/user/custom-overlays.md"],
    ["Private paths", "Commercial and operational boundary for private catalogs.", "./private/"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Custom Apps &amp; Stacks · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Custom Apps &amp; Stacks</h1>
    <p class="tagline">A real app is often several Helm charts plus your own service. The problem is keeping those pieces reviewable as one release instead of scattering them across repos, values files, and hand-written YAML.</p>
  </header>
  <main>
    ${generatedStamp(catalog, "custom apps page")}
    <section aria-labelledby="map">
      <h2 id="map">Where The Pieces Go</h2>
      <p>Use the same routing rule as the README: render-changing choices become reviewed bases; post-render refinements become derived ConfigHub variants; production and private inputs belong in managed workflows.</p>
      ${markdownLikeTable([
        ["Piece", "Where it belongs", "Why"],
        ...pieceRows,
      ])}
    </section>

    <section aria-labelledby="day">
      <h2 id="day">Day 0 Or Day 1?</h2>
      <p>For a new app, multiple charts plus a custom service is Day 0 composition: define the first desired shape, render the bases, upload Units, and create the first target variant. For an app that already exists, the same work is Day 1 change management: import or discover the current shape, compare it with the desired shape, then make controlled refinements.</p>
      <p>An agentic custom app can sit beside this path. For example, an RBAC app can read ConfigHub Units, answer Kubernetes-specific access questions, and produce guardrailed edits without asking an agent to patch YAML by hand.</p>
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

function existingAppsHtml(catalog) {
  const routes = [
    ["Argo or Flux app", "Start by reading the current source, rendered objects, target namespace, health, and sync state.", "Do not change delivery yet. Compare what exists with a catalog or recipe path first."],
    ["Rendered YAML", "Import or inspect the object set as desired state data.", "Check object identity, labels, namespaces, Secrets, CRDs, and hooks before trying to manage it."],
    ["Live cluster", "Use observation first: what is running, who owns it, what changed, and what target facts are required?", "Treat live state as evidence, not automatically as desired state."],
    ["Helm release", "Keep the chart, version, values, and release name as the starting facts.", "Then decide whether the first ConfigHub base matches that release exactly or intentionally differs."],
  ];
  const checks = [
    ["Identity", "Which chart, app, namespace, target, and owner does this belong to?"],
    ["Object set", "Which Deployments, Services, CRDs, RBAC, Secrets, ConfigMaps, and policies exist?"],
    ["Differences", "What does the catalog recipe render for the same chart and values?"],
    ["Prerequisites", "Which Secrets, storage classes, cloud identities, CRDs, and controllers must already exist?"],
    ["Control point", "What is the safest first managed change: observe only, create a base, create a derived variant, or promote a patch?"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Existing Apps · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Existing Apps</h1>
    <p class="tagline">If you already run Helm, Argo, Flux, or plain Kubernetes YAML, the first problem is ownership, not migration. Start read-only. First understand what exists. Then decide what ConfigHub will manage.</p>
  </header>
  <main>
    <section aria-labelledby="start">
      <h2 id="start">Start Read-Only</h2>
      <p>Existing systems often have history: old chart versions, local patches, hand-created Secrets, controller-generated fields, or cluster-specific assumptions. ConfigHub makes those facts visible before it tries to manage them.</p>
      <p>The first safe outcome is an inventory and comparison, not a changed live deployment.</p>
      ${markdownLikeTable([
        ["Starting point", "First route", "Boundary"],
        ...routes,
      ])}
    </section>

    <section aria-labelledby="checklist">
      <h2 id="checklist">What To Check First</h2>
      ${markdownLikeTable([
        ["Check", "Why it matters"],
        ...checks,
      ])}
    </section>

    <section aria-labelledby="next">
      <h2 id="next">Where This Leads</h2>
      <div class="grid">
        <div class="card"><h3>Match the current app</h3><p>Create or select a base that renders the same object set as the existing Helm release.</p><p><a href="../docs/user/adopting-existing-apps.md">Existing app guide</a></p></div>
        <div class="card"><h3>Create a managed variant</h3><p>Once the base is trusted, use a derived variant for environment, region, customer, or target-specific refinements.</p><p><a href="./variants.html">Variants</a></p></div>
        <div class="card"><h3>Move into operations</h3><p>After upload, use scans, approvals, delivery, observations, upgrades, and rollback records.</p><p><a href="./operations.html">Ops</a></p></div>
      </div>
    </section>
  </main>
  <footer>Existing-app adoption begins with observation and comparison. Management comes after the current state is understood.</footer>
</body>
</html>
`;
}

function aiHtml(catalog) {
  const catalogRows = [
    ["Read chart behavior", "AI helps inspect chart docs, values, templates, hooks, CRDs, defaults, and prerequisites so the catalog starts from the right questions."],
    ["Draft base variants", "AI can suggest useful chart-specific base variants, such as default, existing Secret, no-CRDs, server-only, HA, or production-like choices. The generator and receipts decide what is accepted."],
    ["Generate checks", "AI helps draft tests, summaries, and verifier commands. A page is not treated as true until committed data and verification commands back it."],
    ["Triage failures", "AI helps sort a failure into render input, target prerequisite, lifecycle route, runtime health, or unsupported chart behavior."],
    ["Explain evidence", "AI helps turn receipts, diffs, and generated data into plain English for chart pages and docs."],
  ];
  const taskRows = [
    ["Explain a diff", "Good fit", "AI can summarize which objects changed. Keep the actual diff visible as the record."],
    ["Create a variant", "Good fit with review", "AI can draft labels, targets, and transforms. A person or policy gate approves the exact result."],
    ["Patch a fleet", "Good fit with scope", "AI can draft the patch; ConfigHub shows which apps, variants, and objects it touches before rollout."],
    ["Triage a broken chart", "Good fit", "AI can help decide whether the problem is values, cluster prerequisites, lifecycle steps, image pulls, or runtime health."],
    ["Use a domain app", "Good fit", "Give the agent purpose-built commands, such as Kubernetes RBAC analysis, instead of raw YAML editing."],
    ["Change production live state directly", "Not the default path", "The safer path is propose, diff, approve, deliver, observe. Direct writes need clear authority, scope, and rollback."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI And The Catalog · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>AI And The Catalog</h1>
    <p>AI is useful here because Helm charts are too large to inspect by hand, one value at a time. We use agents to help read charts, propose useful <a href="./charts/index.html#base-variants">base variants</a>, write checks, and explain evidence.</p>
    <p>The rule is strict: AI can suggest, but tests and receipts decide. A catalog claim is not true because an agent wrote it; it is true when the rendered objects, generated data, and verification commands back it.</p>
    <p>This is also why the catalog uses base variants instead of claiming every values combination. AI can help maintain chart-specific choices across versions; verification decides which choices are ready to show users.</p>
  </header>
  <main>
    <section aria-labelledby="catalog">
      <h2 id="catalog">How AI Helps Build The Catalog</h2>
      <p>The main AI use today is not autonomous production change. It is catalog work: finding what a chart does, proposing safe starting points, generating checks, and turning evidence into language people can read.</p>
      ${markdownLikeTable([
        ["AI helps with", "How we keep it honest"],
        ...catalogRows,
      ])}
      <p><a href="./how-it-works.html">Read how render, record, and route work</a> · <a href="./verification.html">Check the verification commands</a></p>
    </section>

    <section aria-labelledby="user-agents">
      <h2 id="user-agents">When Users Bring AI</h2>
      <p>AI can also help a user propose Helm values, patches, variants, or fixes. ConfigHub makes that safer by turning the suggestion into exact Kubernetes objects, diffs, known extras, checks, and approvals before it reaches a cluster.</p>
      <p>If the suggestion changes what Helm renders, it should become a new or updated recorded <a href="./charts/index.html#base-variants">base variant</a>. If it edits an already-rendered object, it should become a reviewed ConfigHub change. Either way, the user sees the diff before release.</p>
      <p>The reviewed config remains the source of truth. AI explains and proposes; ConfigHub records and verifies.</p>
    </section>

    <section aria-labelledby="live-review">
      <h2 id="live-review">A Change We Checked In ConfigHub</h2>
      <p>The example starts with a proposed AICR training change that asks for eight H100 nodes even though the recorded target limit is four. It also replaces a pinned image with <code>latest</code> and leaves an API key placeholder. The reviewed file fixes all three problems.</p>
      <p>In the live run, ConfigHub read the nested AICR fields. It reported the mutable image and blocked the inline API key. The reviewed version cleared both checks. Ordinary Deployment image and probe checks did not run against either custom resource.</p>
      <p>ConfigHub stored the reviewed Kubernetes object, blocked a dry run until its exact head revision was approved, and allowed the same dry run to an OCI target after approval. Nothing was applied to Kubernetes. The four-node limit remains a separate target-specific check because the ConfigHub policy cannot yet read that recorded target fact.</p>
      <p><a href="../data/ai-change-review-live-proof/summary.md">Read the result and its limits</a>.</p>
    </section>

    <section aria-labelledby="tasks">
      <h2 id="tasks">Good AI Tasks</h2>
      ${markdownLikeTable([
        ["Task", "Fit", "Boundary"],
        ...taskRows,
      ])}
    </section>

    <section aria-labelledby="agentic-apps">
      <h2 id="agentic-apps">Agentic Custom Apps</h2>
      <p>A useful pattern is a small domain app that exposes higher-level operations to an agent while ConfigHub remains the configuration store. The app supplies the domain model, dry-run behavior, guardrails, and explicit commit path.</p>
      <p>ConfigHub's <a href="https://github.com/confighub/examples/tree/main/rbac-manager-for-agents">RBAC Manager for Agents</a> is a concrete example of that shape. It is a CLI/plugin with skills for RBAC inventory, effective-access queries, hygiene findings, guarded edits, fleet edits, and promotion. That is more differentiated than asking an agent to edit YAML directly.</p>
    </section>

    <section aria-labelledby="guides">
      <h2 id="guides">Guides And Evidence</h2>
      <div class="grid">
        <div class="card"><h3>How it works</h3><p>The core model renders the chart, records the evidence, routes the extras, then delivers and observes.</p><p><a href="./how-it-works.html">Open page</a></p></div>
        <div class="card"><h3>Verification</h3><p>Npm commands check generated pages, docs, data, render outputs, and live receipts.</p><p><a href="./verification.html">Open page</a></p></div>
        <div class="card"><h3>AI-assisted changes</h3><p>How AI can propose a Helm or ConfigHub change without bypassing review.</p><p><a href="../docs/user/ai-assisted-helm-changes.md">Open guide</a></p></div>
        <div class="card"><h3>Live change review</h3><p>A reviewed AICR object is stored in ConfigHub, blocked until approval, and dry-run again after approval.</p><p><a href="../data/ai-change-review-live-proof/summary.md">Open result</a></p></div>
        <div class="card"><h3>Broken chart triage</h3><p>How to decide whether a failure is render, target, lifecycle, runtime, or unsupported behavior.</p><p><a href="../docs/user/broken-chart-triage.md">Open guide</a></p></div>
        <div class="card"><h3>RBAC Manager for Agents</h3><p>A domain-specific custom app pattern built from a CLI plugin plus skills over ConfigHub data.</p><p><a href="https://github.com/confighub/examples/tree/main/rbac-manager-for-agents">Open example</a></p></div>
        <div class="card"><h3>Blast radius</h3><p>How value-source maps and scored receipts show which objects a change is expected to affect.</p><p><a href="../data/blast-radius-accuracy/summary.md">Open evidence</a></p></div>
      </div>
    </section>
  </main>
  <footer>AI must make Helm operations easier to understand, not less accountable.</footer>
</body>
</html>
`;
}

function securityHtml(catalog) {
  const rows = [
    ["Rendered objects", "Review the actual Kubernetes objects before delivery, not only values files."],
    ["Secrets", "Separate, reference, or require external Secrets where appropriate. Do not hide placeholder credentials."],
    ["Scans and gates", "Run policy and security checks against explicit desired state before delivery."],
    ["OCI delivery", "Publish a reviewed bundle so the controller pulls the same bytes that were checked."],
    ["Receipts", "Record what was rendered, delivered, observed, accepted, blocked, or refused."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Security And Provenance · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Security And Provenance</h1>
    <p class="tagline">The public catalog is not a security certification. It addresses a practical review problem: prove which objects were rendered, scanned, approved, delivered, and observed.</p>
  </header>
  <main>
    <section aria-labelledby="why">
      <h2 id="why">Why It Helps</h2>
      <p>Helm values can hide important security choices: generated passwords, broad RBAC, privileged containers, image tags, CRDs, webhooks, and controller behavior. ConfigHub does not make those choices disappear. It makes them visible enough to review and attaches decisions to the rendered object set.</p>
    </section>

    <section aria-labelledby="controls">
      <h2 id="controls">Controls</h2>
      ${markdownLikeTable([
        ["Area", "What the model gives you"],
        ...rows,
      ])}
    </section>

    <section aria-labelledby="limits">
      <h2 id="limits">Current Limits</h2>
      <p>Some evidence is partial by design. A digest proves integrity only inside a known trust chain. A scan finding needs a decision. A green render does not prove that the target has the right cloud identity, storage, or runtime policy.</p>
      <div class="grid">
        <div class="card"><h3>Security guide</h3><p><a href="../docs/user/security-end-to-end.md">Open security end to end</a></p></div>
        <div class="card"><h3>Known caveats</h3><p><a href="../data/cub-adoption-caveats/summary.html">Open per-chart cub adoption caveats</a></p></div>
        <div class="card"><h3>Claims register</h3><p><a href="../data/claims-register/summary.md">Open backed, partial, planned, and refused claims</a></p></div>
      </div>
    </section>
  </main>
  <footer>Security claims are only as strong as the evidence chain and target scope behind them.</footer>
</body>
</html>
`;
}

function catalogPathfinderHtml(root) {
  const href = (path) => `${root}/${path}`;
  return `<section aria-labelledby="catalog-paths">
      <h2 id="catalog-paths">Choose Your Path</h2>
      <p>Start with the configuration you already have. Each path first gives you exact Kubernetes objects to inspect.</p>
      <h3 id="catalog-starting-points">What do you have?</h3>
      ${markdownLikeTable([
        ["Starting point", "What you can do first"],
        ["Helm chart and values", `Choose a checked public configuration, or render your own chart and values without applying them.<br><a href="${href("charts/index.html#charts")}">Browse public charts</a> · <a href="${href("testing.html#bring-your-own")}">Review your own values</a>`],
        ["AICR recipe or bundle", `Inspect the selected components and the exact Argo CD Applications before saving or promoting them.<br><a href="${href("testing.html#aicr-platform")}">Open the AICR example</a>`],
        ["Existing OCI package", `Pull an OCI package, inspect or test its objects, and decide whether to build a checked replacement.<br><a href="${href("d/docs/user/inspect-oci-package.html")}">Inspect an OCI package</a> · <a href="${href("d/docs/user/transform-oci-package.html")}">Change a literal configuration OCI</a>`],
        ["Kubernetes YAML", `Start read-only, identify the objects that belong together, and decide what ConfigHub should manage.<br><a href="${href("existing-apps.html#start")}">Start from existing YAML</a>`],
      ], { rawSecondColumn: true })}
      <h3 id="catalog-next-jobs">What do you want to do next?</h3>
      ${markdownLikeTable([
        ["Job", "Where to continue"],
        ["Inspect and verify", `<a href="${href("testing.html")}">Inspect exact objects and inputs</a> · <a href="${href("verification.html")}">Check the evidence</a>`],
        ["Try a catalog package", `<a href="${href("try.html")}">Render one reviewed Redis configuration</a>`],
        ["Learn ConfigHub", `<a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "pathfinder")}">Follow the official tutorial</a>`],
        ["Upload and save", `<a href="${href("variants.html#flow")}">Record reviewed objects in ConfigHub</a>`],
        ["Customize", `<a href="${href("d/docs/user/transform-oci-package.html")}">Change one field in an OCI without signing in</a> · <a href="${href("variants.html#choose")}">Choose a ConfigHub base or derived variant</a>`],
        ["Promote", `<a href="${href("variants.html#journey")}">Move a reviewed change through environments</a>`],
        ["Deliver", `<a href="${href("operations.html#ops")}">Publish OCI for Argo CD, Flux, or direct apply</a>`],
        ["Operate", `<a href="${href("operations.html#fleet-record")}">Track changes and live results across a fleet</a>`],
        ["Build an App", `<a href="${href("journey.html#app-program")}">Use saved configuration for a repeated operational job</a>`],
      ], { rawSecondColumn: true })}
    </section>`;
}

function examplesHtml(catalog) {
  const pathways = new Map(catalog.demoProgram.spec.pathways.map((item) => [item.id, item]));
  const apps = new Map(catalog.demoProgram.spec.apps.map((item) => [item.id, item]));
  const worked = (collection, id) => {
    const item = collection.get(id);
    check(item?.workedExample?.status === "working", `example index is missing ${id}`);
    return item.workedExample;
  };
  const appRows = [
    ["upgrade-app", "./redis-walkthrough.html", "scripts/run-redis-upgrade-app-proof.mjs", "./d/data/redis-upgrade-app-proof/summary.html", "./d/data/helm-catalog-readmes/spaces/bitnami-redis-base/README.html"],
    ["hooks-crds-app", "./d/docs/demo/hooks-crds/kube-prometheus-stack.html", "scripts/generate-hooks-crds-app.mjs", "./d/data/kps-gitops-lifecycle-proof/summary.html", "./d/data/helm-catalog-readmes/spaces/route-sketch-kube-prometheus-stack/README.html"],
    ["rbac-review-app", "./d/docs/demo/apps/rbac-review.html", "examples/apps/rbac-review", "./d/data/rbac-review-live-proof/summary.html", ""],
    ["fleet-platform-app", "./d/docs/demo/sveltos/kyverno-fleet.html", "examples/sveltos/kyverno-fleet", "./d/data/sveltos-oci-delivery-proof/summary.html", "./d/data/helm-catalog-readmes/spaces/sveltos-kyverno-fleet-3-8-1-staging/README.html"],
    ["ai-change-review-app", "./d/docs/demo/apps/ai-change-review.html", "scripts/run-ai-change-review-live-proof.mjs", "./d/data/ai-change-review-live-proof/summary.html", ""],
  ].map(([id, guide, source, proof, space]) => {
    const app = apps.get(id);
    const example = worked(apps, id);
    const sourceUrl = `https://github.com/confighub/helm-expt/${source.includes(".") ? "blob" : "tree"}/main/${source}`;
    const spaceLink = space ? ` · <a href="${space}">Space guide</a>` : " · no permanent demo Space";
    return [
      app.name,
      example.result,
      `<a href="${guide}">Walkthrough</a> · <a href="${sourceUrl}">GitHub source</a> · <a href="${proof}">Proof</a>${spaceLink}`,
      example.limit,
    ];
  });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Examples · Config Test Centre</title>
  <style>${siteCss()}
    #examples-content table { white-space: normal; }
    #examples-content th, #examples-content td { min-width: 0; }
    @media (max-width: 700px) {
      #examples-content table,
      #examples-content tbody,
      #examples-content tr,
      #examples-content td { display: block; width: 100%; }
      #examples-content thead { display: none; }
      #examples-content tr { padding: 10px 0; border-bottom: 1px solid var(--line); }
      #examples-content td { padding: 4px 6px; border: 0; font-size: .86rem; }
      #examples-content td:first-child { color: var(--ink); font-weight: 700; }
    }
  </style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Examples</h1>
    <p class="tagline">Start with the configuration you already have. Each starting example produces exact Kubernetes objects. Inspect them before you keep them as files or OCI, or save them in ConfigHub.</p>
    <p>Later examples use ConfigHub Server. They show how a team changes, approves, promotes, delivers, and operates saved configuration.</p>
  </header>
  <main id="examples-content">
    <span id="catalog-starting-points"></span>
    <span id="catalog-next-jobs"></span>
    <span id="bring-your-own"></span>
    <span id="aicr-platform"></span>
    <section aria-labelledby="start">
      <h2 id="start">Starting examples</h2>
      <p>Choose one row. You do not need to understand the rest of the catalog first.</p>
      ${markdownLikeTable([
        ["What you have", "What the example does", "Start and proof", "ConfigHub and OCI"],
        [
          "A ready-made Helm package",
          "Pull Redis, render one preset configuration, inspect its objects, and check the recorded Helm parity and install requirements.",
          `<a href="./try.html">Short example</a> · <a href="./redis-walkthrough.html">Full walkthrough</a> · <a href="https://github.com/confighub/helm-expt/tree/main/recipes/bitnami/redis/25.5.3">GitHub source</a>`,
          `Public installer OCI. <a href="./charts/bitnami-redis-25-5-3.html">Open its reference and package details</a>.<br><a href="./d/data/helm-catalog-readmes/spaces/bitnami-redis-25-5-3-reuse-existing-secret/README.html">ConfigHub Space guide</a>`,
        ],
        [
          "Your own Helm chart and values",
          "Render the supplied chart and values without applying them. The worked review keeps the intended replica change and fixes six risky or weaker settings.",
          `<a href="./entry-path-reference.html#bring-your-own">Worked NGINX example</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/byo-helm-values">GitHub source</a> · <a href="./d/data/byo-helm-values-review/summary.html">Review and proof</a>`,
          `Public literal configuration OCI; exact reference is in the <a href="./d/data/byo-helm-values-review/public-and-confighub.html">publication record</a>.<br><a href="./d/data/helm-catalog-readmes/spaces/byo-nginx-ai-values-24-0-2-reviewed/README.html">ConfigHub Space guide</a>`,
        ],
        [
          "An AICR recipe or bundle",
          worked(pathways, "aicr").result,
          `<a href="./d/docs/demo/aicr/eks-h100-training-kubeflow.html">Walkthrough</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/aicr/eks-h100-training-kubeflow">GitHub source</a> · <a href="./d/data/aicr-oci-roundtrip-proof/summary.html">Round-trip proof</a>`,
          `Public source OCI plus public literal configuration OCI; digests are in the <a href="https://github.com/confighub/helm-expt/blob/main/examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml">publication receipt</a>.<br><a href="./d/data/helm-catalog-readmes/spaces/aicr-eks-h100-training-kubeflow-v0-14-0-argocd/README.html">ConfigHub Space guide</a>`,
        ],
        [
          "An existing OCI package",
          "Inspect its exact objects or change one named field, then pull the result back and compare it with the reviewed files.",
          `<a href="./d/docs/user/inspect-oci-package.html">Inspect OCI</a> · <a href="./d/docs/user/transform-oci-package.html">Change OCI</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/anonymous-oci-transform">GitHub source</a> · <a href="./d/data/anonymous-oci-transform-proof/summary.html">Proof</a>`,
          `The worked output OCI uses a temporary proof registry. Upload a reviewed literal configuration OCI when you want a permanent ConfigHub record.`,
        ],
        [
          "Kubernetes YAML or an existing app",
          "Inventory the objects first. Record their source and ownership before ConfigHub changes or delivers them.",
          `<a href="./existing-apps.html">Existing-app guide</a> · <a href="https://github.com/confighub/helm-expt/blob/main/docs/user/app-to-live-walkthrough.md">GitHub source</a> · <a href="./d/docs/user/app-to-live-walkthrough.html">YAML walkthrough</a>`,
          `No permanent public YAML fixture is claimed yet. The managed path starts when you upload the reviewed files to a ConfigHub Space.`,
        ],
      ], { rawSecondColumn: true, rawThirdColumn: true, rawFourthColumn: true })}
    </section>

    <section aria-labelledby="start-modes">
      <h2 id="start-modes">Where a starting example can run</h2>
      ${markdownLikeTable([
        ["Choice", "Available now?", "What it means"],
        ["Local or CI", "Yes", "No ConfigHub Server and no ConfigHub account. Public package pulls also need no Google registry login."],
        ["Hosted without sign-in", "Planned", "A public service will inspect open configuration without creating private history, variants, approvals, or releases."],
        ["ConfigHub", "Yes", `Save the reviewed objects, then follow the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "examples")}">official tutorial</a>. An account is required.`],
      ], { rawSecondColumn: true, rawThirdColumn: true })}
      <p>These three choices apply to starting examples. The examples below use ConfigHub Server because their job is to manage saved configuration.</p>
    </section>

    <section aria-labelledby="managed">
      <h2 id="managed">Continue in ConfigHub</h2>
      ${markdownLikeTable([
        ["Job", "Working example", "Where to go"],
        ["Save and change", "Upload reviewed objects as a base variant. Make an exact development or customer change without changing the source chart.", `<a href="./variants.html">Variants</a> · <a href="./d/docs/user/variants-after-upload.html">Command walkthrough</a>`],
        ["Promote", worked(pathways, "promotions").result, `<a href="./d/data/byo-helm-values-promotion-proof/summary.html">BYO Helm promotion</a> · <a href="./redis-walkthrough.html">Redis promotion and rollback</a>`],
        ["Deliver through OCI", worked(pathways, "oci-delivery").result, `<a href="./operations.html">Delivery guide</a> · <a href="./d/data/oci-deploy-stage-rollout-proof/summary.html">Argo CD and Flux proof</a>`],
        ["Apply checks and approvals", "Schema, placeholder, and lifecycle-route checks can block bad configuration. Image and probe checks warn. Selected production and system configuration also requires approval.", `<a href="./d/data/apply-policy-functional-proof/summary.html">Functional proof</a> · <a href="./d/data/apply-policy-profiles/summary.html">Policy assignments</a>`],
      ], { rawSecondColumn: true, rawThirdColumn: true })}
    </section>

    <section aria-labelledby="platforms">
      <h2 id="platforms">Platform and fleet examples</h2>
      ${markdownLikeTable([
        ["Example", "What has run", "Open"],
        ["Kubara", worked(pathways, "kubara").result, `<a href="./d/docs/demo/kubara/local-platform.html">Walkthrough</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/kubara/local-platform">GitHub source</a> · <a href="./d/data/kubara-oci-delivery-proof/summary.html">Proof</a> · <a href="./d/data/helm-catalog-readmes/spaces/kubara-local-platform-v0-12-0/README.html">Space guide</a>`],
        ["Sveltos", worked(pathways, "sveltos").result, `<a href="./d/docs/demo/sveltos/kyverno-fleet.html">Walkthrough</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/sveltos/kyverno-fleet">GitHub source</a> · <a href="./d/data/sveltos-oci-delivery-proof/summary.html">Proof</a> · <a href="./d/data/helm-catalog-readmes/spaces/sveltos-kyverno-fleet-3-8-1-staging/README.html">Space guide</a>`],
      ], { rawSecondColumn: true, rawThirdColumn: true })}
    </section>

    <section aria-labelledby="apps">
      <h2 id="apps">ConfigHub App examples</h2>
      <p>Each row has a working, bounded example. The final column says what is still missing from a general product capability.</p>
      ${markdownLikeTable([
        ["App", "Working example", "Open", "Still to build"],
        ...appRows,
      ], { rawSecondColumn: true, rawThirdColumn: true, rawFourthColumn: true })}
      <p><a href="./journey.html">Read how Apps use saved configuration</a>.</p>
    </section>

    <section aria-labelledby="locations">
      <h2 id="locations">Where the material lives</h2>
      ${markdownLikeTable([
        ["Place", "What belongs there"],
        ["This website", "Short explanations, starting points, chart pages, worked examples, and links to current proof."],
        ["GitHub", "Source configuration, generators, scripts, checks, receipts, and every file used to make the website."],
        ["The ConfigHub helm-catalog organization", `Persistent demo Spaces. Each Space has one README Unit that explains its purpose and the Units it contains. <a href="./demo-org.html">Open the demo-org guide</a>.`],
        ["Public OCI registry", "Stable starting packages and reviewed public outputs. Each permanent artifact must have a role, digest, source record, human guide, and publication receipt."],
        ["ConfigHub release OCI", "Approved outputs from managed Spaces for Argo CD, Flux, or another recorded delivery path."],
        ["Temporary proof registry", "Short-lived artifacts used by a receipt. The site must not advertise them as permanent packages."],
      ], { rawSecondColumn: true })}
      <p><a href="./entry-path-reference.html">Open the detailed entry-path reference</a> for commands, artifact distinctions, source-to-OCI automation, hooks, CRDs, and the full set of proof links.</p>
    </section>
  </main>
  <footer>Example status is scoped to the named source, version, configuration, delivery path, and receipt.</footer>
</body>
</html>
`;
}

function entryPathReferenceHtml(catalog) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Entry Path Reference · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Detailed entry paths</h1>
    <p class="tagline">This reference keeps the commands and proof links for Helm, AICR, OCI, and Kubernetes YAML. Start with the shorter <a href="./testing.html">Examples page</a> if you have not chosen a path yet.</p>
    <p><code>cub installer</code> reads maintained catalog packages. <code>cub helm</code> imports an arbitrary chart and values. These are preparation tools, not separate ConfigHub journeys.</p>
  </header>
  <main>
    ${catalogPathfinderHtml(".")}
    <section aria-labelledby="work-mode">
      <h2 id="work-mode">Choose where the work runs</h2>
      ${markdownLikeTable([
        ["Choice", "What it means", "Status"],
        ["Local, no server", "Run tools on your machine or in CI. Public package pulls need no sign-in.", "Available"],
        ["Hosted, no sign-in", "Inspect and test public configuration through an anonymous service.", "Planned"],
        ["ConfigHub", `Record, change, release, and promote the result. Continue with the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "testing")}">official tutorial</a>.`, "Available; account required"],
      ], { rawSecondColumn: true })}
      <p>These choices apply before configuration is saved. Public package and registry paths work now. The hosted anonymous service does not. Managed variants, promotions, Apps, gates, and fleet examples use ConfigHub Server.</p>
    </section>
    <section aria-labelledby="bring-your-own">
      <h2 id="bring-your-own">Bring your own chart and values</h2>
      <p>Start with the exact chart version, values files, namespace, release name, and Kubernetes version your team intends to use. This works for values written by your team or proposed by an AI. Render them to files without applying them:</p>
      <pre><code>helm template &lt;release&gt; &lt;chart&gt; \
  --version &lt;version&gt; \
  --namespace &lt;namespace&gt; \
  --values &lt;values.yaml&gt; \
  &gt; rendered.yaml</code></pre>
      <p>Read the Kubernetes objects, then compare them with the chart defaults and any matching base variants in the catalog. Check image changes, placeholder or embedded credentials, broad RBAC, privileged settings, CRDs, hooks, webhooks, storage, and required target resources before applying anything.</p>
      <p><strong>Worked example:</strong> a supplied NGINX values file asks for three replicas. It also embeds an API key, selects an unpinned image, and exposes a public LoadBalancer. Three container security settings are also weaker than the catalog baseline. The review keeps the three replicas, restores the security settings, and makes the Deployment use an existing Secret. Open the <a href="../data/byo-helm-values-review/summary.md">plain-English review</a>, the <a href="../examples/byo-helm-values/ai-values.yaml">supplied values</a>, the <a href="../examples/byo-helm-values/reviewed-values.yaml">reviewed values</a>, and the <a href="../data/byo-helm-values-review/reviewed-render.yaml">five reviewed Kubernetes objects</a>.</p>
      <p>The proof renders the locked chart and verifies that its baseline matches the catalog. It finds the six intended problems and packages the reviewed objects as OCI. Run it with <code>HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROOF=1 npm run byo-helm-values:run</code>. The <a href="../data/byo-helm-values-review/public-and-confighub.md">public OCI and ConfigHub record</a> shows which follow-on steps have run.</p>
      ${markdownLikeTable([
        ["Then what?", "Recorded result"],
        ["Deploy the reviewed result", `<a href="../data/byo-helm-values-deploy-proof/summary.md">Argo CD synced the ConfigHub release and NGINX reached 3/3 ready replicas</a>.`],
        ["Change development", `<a href="../data/byo-helm-values-promotion-proof/summary.md">The saved base stayed at three replicas while development changed to four</a>.`],
        ["Promote to staging", `<a href="../data/byo-helm-values-promotion-proof/summary.md">ConfigHub promoted the four-replica change and preserved the staging namespace</a>.`],
        ["Deploy staging", `<a href="../data/byo-helm-values-staging-deploy-proof/summary.md">Argo CD synced the promoted ConfigHub release and NGINX reached 4/4 ready replicas</a>.`],
      ], { rawSecondColumn: true })}
      <p>The target still has to provide the <code>ai-provider-credentials</code> Secret. Both live runs supplied a fake value separately and did not record it. This exact example has not run through Flux, rollback, a chart upgrade, or a fleet rollout. It also does not claim that one check can judge every private chart or arbitrary values file.</p>
    </section>

    <section aria-labelledby="aicr-platform">
      <h2 id="aicr-platform">Start with an AICR platform package</h2>
      <p>AICR selected 15 versioned components for an EKS H100 training platform and generated an Argo CD source package. We published that package and a second OCI containing the 17 exact Argo CD Applications. Both are public and passed anonymous pull checks at their recorded digests.</p>
      <p>ConfigHub imported the 17 Applications as one unchanged base. Development changes only the kube-prometheus-stack Application so Grafana reads its administrator credentials from a Secret owned by the target. A dry run named that Application and changed nothing. Staging then received the same reviewed configuration, while the other 16 Applications stayed unchanged.</p>
      ${markdownLikeTable([
        ["Open", "What it answers"],
        ["AICR guide", `<a href="../docs/demo/aicr/eks-h100-training-kubeflow.md">How the recipe became two public OCI artifacts and three ConfigHub Spaces</a>.`],
        ["Public OCI receipt", `<a href="../examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml">Which references and digests passed anonymous pulls</a>.`],
        ["Promotion receipt", `<a href="../examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml">Which Application changed, what the dry runs checked, and what reached staging</a>.`],
        ["Live Space guides", `<a href="../data/helm-catalog-readmes/spaces/aicr-eks-h100-training-kubeflow-v0-14-0-argocd/README.md">Base</a> · <a href="../data/helm-catalog-readmes/spaces/aicr-eks-h100-training-kubeflow-v0-14-0-argocd-development/README.md">development</a> · <a href="../data/helm-catalog-readmes/spaces/aicr-eks-h100-training-kubeflow-v0-14-0-argocd-staging/README.md">staging</a>.`],
      ], { rawSecondColumn: true })}
      <p>All three Spaces keep the catalog checks and required approval. The target must provide the Grafana Secret. This example has not run the Applications through Argo CD or proved an EKS GPU workload.</p>
    </section>

    <section aria-labelledby="existing-oci-change">
      <h2 id="existing-oci-change">Start with an existing OCI package</h2>
      <p>Inspect the OCI first so you know whether it contains a source chart, a cub installer package, or exact Kubernetes objects. A source package must be rendered before it can become a deployable configuration. A literal configuration can be changed directly.</p>
      <pre><code>npm run oci:transform -- oci://REGISTRY/REPOSITORY@sha256:DIGEST \
  --object Deployment/example \
  --namespace example \
  --field spec.replicas \
  --value 4 \
  --output oci-layout:./changed-example:reviewed</code></pre>
      <p>The command changes only the field you name. It records the input digest, the old and new values, and every check result inside the new OCI. It then pulls the new image back and compares the files. Existing companion records are kept if you change the output again.</p>
      <p>The <a href="../data/anonymous-oci-transform-proof/summary.md">public NGINX proof</a> pulls five objects without credentials and changes only the replica count. It names the required external Secret and verifies the output digest and object set. The output stays local until someone deliberately publishes, uploads, or deploys it.</p>
    </section>

    <section aria-labelledby="source-to-oci">
      <h2 id="source-to-oci">Can source-to-OCI be automated?</h2>
      <p>Yes, for catalog packages and other recorded paths. The public CI example pulls a pinned installer package and renders one base. It tests the result and builds a literal configuration OCI. It then pulls the OCI back and verifies its objects against the reviewed files. The run needs no ConfigHub credentials.</p>
      <p>The NGINX example follows the same pattern for supplied Helm values: render, review, build OCI, pull it back, and compare the exact object set. <a href="../data/byo-helm-values-review/public-and-confighub.md">Open its OCI and ConfigHub record</a>.</p>
      <p>The AICR example publishes two artifacts because they have different jobs: Argo CD reads the generated source chart; ConfigHub imports the literal 17-Application configuration. <a href="../examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml">Open the public OCI receipt</a>.</p>
      <p><a href="../data/anonymous-oci-ci-proof/summary.md">Read the CI source-to-OCI proof</a>, <a href="../data/anonymous-oci-transform-proof/summary.md">the anonymous OCI-to-OCI change proof</a>, and <a href="../data/serverless-oci-gitops-proof/summary.md">the local OCI-to-Flux proof</a>. Each receipt records the input and output digests and the steps that ran.</p>
      <p>The same building blocks work for a private chart. We do not yet provide one public service that performs the complete analysis and publication path. Target-specific Secrets, cloud accounts, storage, and lifecycle work still need explicit inputs and decisions.</p>
    </section>

    <section aria-labelledby="pillar-fewer">
      <h2 id="pillar-fewer">Most choices are made and checked before you install</h2>
      <p>A reviewed package fixes most settings at build time. What remains should be small, typed, and recorded. Fewer variables means fewer ways to be wrong and less to test at deployment time. The Helm catalog is moving toward that shape. The AICR example records its remaining inputs, publishes both OCI artifacts for anonymous pull, imports the literal configuration into ConfigHub, and promotes one reviewed change. Controller delivery and a live GPU-cluster result remain open.</p>
      <p><a href="./charts/bitnami-redis-25-5-3.html">See the small set of install-time values on a chart page</a>.</p>
    </section>

    <section aria-labelledby="pillar-proof">
      <h2 id="pillar-proof">You can read the proof before you ship</h2>
      <p>Each catalog entry links to the evidence that exists for it: render checks, object inventories, scans, local installs, delivery receipts, and live observations. Not every entry passes every lane, so the chart page reports pass, watch, blocked, or not run separately. Bad configuration can also be caught as data before apply, using schema, placeholder, diff, and target checks.</p>
      <p><a href="./verification.html">Read the proof commands and how to run them yourself</a>.</p>
    </section>

    <section aria-labelledby="pillar-messy">
      <h2 id="pillar-messy">Hooks, CRDs, and setup work are listed</h2>
      <p>Hooks, CRDs, ordering, and generated Secrets do not disappear. The catalog records each chart-specific decision and who must perform the work. It also records the result for each delivery path. The public Kube Prometheus Stack package includes its lifecycle files. Receipts cover anonymous pull, direct fresh install, and the no-CRDs upgrade from 85.3.3 to 86.1.0 through Argo CD and Flux. ConfigHub does not yet select that route automatically, and a missing receipt remains visible.</p>
      <p><a href="./charts/prometheus-community-kube-prometheus-stack-85-3-3.html">See the routes on a chart that ships CRDs</a>.</p>
    </section>

    <section aria-labelledby="pillar-reverse">
      <h2 id="pillar-reverse">You can reverse a change, not only keep it</h2>
      <p>ConfigHub keeps every revision as data, so you can restore a prior state without rebuilding it by hand. Each base variant records the exact objects it produced, so the state you return to is known and reproducible. Changing configuration is safe when going back is this cheap.</p>
      <p><a href="./how-it-works.html">See how configuration is kept as data you can restore</a>.</p>
    </section>

    <section aria-labelledby="pillar-installer">
      <h2 id="pillar-installer">You do not need to learn cub installer first</h2>
      <p>cub installer is how you pull a package and write its files locally. It is one open source tool alongside Helm and OCI, and you can read everything above without it. When you want to run a package, it is there. When you only want to know whether a package is safe, the evidence stands on its own.</p>
    </section>

    <section aria-labelledby="pillar-policy">
      <h2 id="pillar-policy">The checks follow the configuration</h2>
      <p>After Helm, AICR, Sveltos, or existing YAML becomes ConfigHub data, one apply-policy profile can protect it. Schema, placeholder, and lifecycle-route checks block incomplete configuration. Image digest and workload probe checks warn. Production releases and system configuration keep those checks and add one approval.</p>
      <p><a href="../data/apply-policy-profiles/summary.md">Read the policy, resource classes, and live assignments</a>.</p>
    </section>
  </main>
  <footer>Every claim on this page points at committed evidence in the catalog.</footer>
</body>
</html>
`;
}

function futureHtml(catalog) {
  const nowRows = [
    ["Top-100 catalog", "Public chart snapshots, chart pages, matrix rows, and per-chart caveats."],
    ["Variants", "Base variants and derived ConfigHub variants for selected chart paths."],
    ["Delivery evidence", "Argo OCI evidence for committed paths, plus live parity and observation lanes."],
    ["Sceptic tests", "Known gaps, fuzzing, dry-run checks, drift findings, and refusal boundaries."],
  ];
  const futureRows = [
    ["Private catalogs", "Bring private charts, wrapper charts, and customer overlays into the same model."],
    ["Fleet operations", "Promote, patch, scan, and observe many variants with a clear blast radius."],
    ["Reverse reconcile", "Accept an authorized live fix back into desired state only when policy and round-trip checks allow it."],
    ["AI agents", "Use AI to propose app and ops changes while ConfigHub keeps evidence, gates, and rollback records."],
    ["AICR, NIM, and stacks", "Apply the same recipe, variant, and evidence model to larger AI and platform stacks."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Future And Managed Ideas · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Future And Managed Ideas</h1>
    <p class="tagline">This page separates what exists now from what we want to build next. The hardest problems (fleet blast radius, governed promotion, and live-to-desired reconciliation) are real, but not all fully proven here.</p>
    <p>Use it as a roadmap boundary: useful direction, not a replacement for current evidence.</p>
  </header>
  <main>
    <section aria-labelledby="now">
      <h2 id="now">What Exists In The Public Experiment</h2>
      ${markdownLikeTable([
        ["Area", "Current state"],
        ...nowRows,
      ])}
    </section>

    <section aria-labelledby="next">
      <h2 id="next">What This Points Toward</h2>
      ${markdownLikeTable([
        ["Idea", "What would make it useful"],
        ...futureRows,
      ])}
    </section>

    <section aria-labelledby="guardrails">
      <h2 id="guardrails">Guardrails</h2>
      <p>Do not describe planned ideas as shipped behavior. The public experiment uses evidence-backed words: pass, watch, blocked, refused, not applicable, and planned.</p>
      <p>That honesty is part of the product story: expert users need to know which claims are strong today and which still need more work.</p>
      <div class="grid">
        <div class="card"><h3>Upgrade path</h3><p><a href="./private/">Private catalogs and managed operations</a></p></div>
        <div class="card"><h3>Claims register</h3><p><a href="../data/claims-register/summary.md">Open current claim status</a></p></div>
        <div class="card"><h3>Refusals</h3><p><a href="../docs/user/what-we-refuse-to-claim.md">Open what we refuse to claim</a></p></div>
      </div>
    </section>
  </main>
  <footer>Future and managed topics are useful only when they stay clearly separated from current evidence.</footer>
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
      get: "After delivery, use observation to check what actually happened. The receipt says what was checked, when it was checked, which namespace or target was observed, and whether the desired objects matched what the cluster reported.",
      see: ["verify-it-yourself.md", "why-synced-is-not-working.md"],
    },
    {
      title: "Rehearse rollback before you need it",
      status: "watch",
      boundary: "ConfigHub revisions · cub-scout rehearsal",
      action: "compare live state with a previous approved desired state",
      code: "cub unit diff <unit> --from=PreviousLiveRevisionNum --to=LiveRevisionNum\ncub-scout compare three-way --dry-from <previous-render.yaml>",
      get: "You see the difference between the current live app and the previous approved state. Today this is a rehearse-and-review path; exact rollback automation depends on the app, target, and any irreversible lifecycle steps.",
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
  <title>Ops Guide · Config Test Centre</title>
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
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Ops Guide</h1>
    <p class="lead">Ops starts when an app already exists and the next change matters. The problem is unknown blast radius: what changed, who approved it, what reached the cluster, and whether the live system actually converged.</p>
    <p>If you have not chosen a chart, base, or app shape yet, start with the catalog, variants, or apps pages. If you already have an app, use this page to review diffs, scan, gate, deliver, observe, upgrade, and recover.</p>
  </header>
  <main>
    <section aria-labelledby="before-ops">
      <h2 id="before-ops">Before Ops</h2>
      <p>The app needs a selected chart/base, any customised variants, and a target or delivery path. If those choices are still open, start with <a href="./charts/index.html">Helm Ops Catalog</a>, <a href="./variants.html">Variants</a>, or <a href="./journey.html">Apps</a>.</p>
    </section>

    <section aria-labelledby="fleet-record">
      <h2 id="fleet-record">Fleet Source Of Record</h2>
      <p>The strongest operations use case is not one person running one command for one workload. It is a platform team knowing what a whole fleet should run, then reconciling that desired record with the clusters.</p>
      <p>A useful record says: this cluster, customer, or environment should run this package release, this preset, these allowed inputs, this target, and these approval gates. The package fixes most choices ahead of time. The install-time surface stays small and restricted, so upgrades do not become another free-form Helm exercise.</p>
      <table>
        <thead><tr><th>Fleet area</th><th>Who usually owns it</th><th>What ConfigHub records</th></tr></thead>
        <tbody>
          <tr><td>User workloads</td><td>Application teams</td><td>The approved app variant, target, inputs, policy gates, and release history.</td></tr>
          <tr><td>System services</td><td>Platform operators</td><td>Shared services such as DNS, monitoring, ingress, and storage, with controlled upgrades across clusters.</td></tr>
          <tr><td>System configuration</td><td>Cluster or fleet systems</td><td>Opt-in platform components such as GPU, network, security, and operator configuration, reconciled from a signed-off package and fleet record.</td></tr>
        </tbody>
      </table>
      <p>Read the <a href="../data/operational-class-examples/summary.md">three checked examples</a> for the exact owner, target, checks, rollout order, and current evidence for an NGINX application, Kube Prometheus Stack, and a Kubara platform configuration.</p>
      <p>This is why the site keeps separating package OCI from delivery OCI. The package is the vetted release you start from. The delivery artifact is what a controller reconciles after ConfigHub has recorded the desired state.</p>
    </section>

    <section aria-labelledby="ops">
      <h2 id="ops">The operations</h2>
      <div class="card">
        <h3>Status legend</h3>
        <p><span class="badge now">available</span> runs today. <span class="badge watch">watch</span> has evidence plus a named limitation. Planned work needs product, key, policy, or SLA decisions beyond the public proof corpus.</p>
        <p>A green GitOps sync is not the same as a working application. Use observation receipts when the claim depends on live state.</p>
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
  <title>Ops · Config Test Centre</title>
</head>
<body>
  <p>The day-1 ops page moved to <a href="./operations.html">Ops</a>.</p>
</body>
</html>
`;
}

function matrixRowsForCatalogEntry(catalog, entry) {
  return catalog.masterCatalogMatrix
    .filter((row) => row.chart === entry.chart && row.version === entry.version)
    .sort(compareMatrixRows);
}

function firstCatalogBaseRow(rows, entry) {
  return (
    rows.find((row) => row.row_kind !== "source" && row.variant === entry.start_variant) ??
    rows.find((row) => row.row_kind === "base") ??
    rows.find((row) => row.row_kind !== "source") ??
    rows.find((row) => row.row_kind === "source")
  );
}

function sourceLockForEntry(entry) {
  if (!entry.recipe_path) return undefined;
  const sourceLockPath = entry.recipe_path.replace(/\/recipe\.yaml$/, "/source-lock.yaml");
  const absolutePath = join(repoRoot, sourceLockPath);
  if (!existsSync(absolutePath)) return undefined;
  return readYaml(absolutePath);
}

function artifactHubVersionUrl(lock) {
  const spec = lock?.spec ?? {};
  if (!spec.repositoryName || !spec.chart || !spec.version) return "";
  return `https://artifacthub.io/packages/helm/${encodeURIComponent(spec.repositoryName)}/${encodeURIComponent(spec.chart)}?version=${encodeURIComponent(spec.version)}`;
}

function publicCatalogVersionCell(entry, sourceRow) {
  const lock = sourceLockForEntry(entry);
  const href = artifactHubVersionUrl(lock) || sourceRow?.source_repository_url || "";
  const source = lock?.spec?.contentURL || lock?.spec?.repositoryURL || sourceRow?.source_content_url || sourceRow?.source_repository_url || "";
  const label = `${entry.version}`;
  if (!href) return escapeHtml(label);
  const title = source ? ` title="${escapeHtml(source)}"` : "";
  return `<a href="${escapeHtml(href)}" rel="noopener"${title}>${escapeHtml(label)}</a>`;
}

function installerOciRefForEntry(entry) {
  return entry.installer_oci_ref || installerOciRef(entry.chart, entry.version);
}

function installerOciStatusText(entry) {
  if (entry.installer_oci_publication_status === "published-receipt") return "publication receipt recorded";
  return "assigned public ref; publication receipt not committed yet";
}

function installerOciCell(entry) {
  return `<code>${escapeHtml(installerOciRefForEntry(entry))}</code><br><span style="color:var(--muted);font-size:.9rem">${escapeHtml(installerOciStatusText(entry))}</span>`;
}

function firstPathCell(entry, row) {
  const variant = row?.variant && row.variant !== "(source)" ? row.variant : entry.start_variant || "choose base";
  const page = `./${chartPageFileName(entry)}#matrix-options`;
  let note = "Open the chart page for the command and option cards.";
  if (row?.row_kind === "candidate") note = "Candidate path; model the base before using it.";
  else if (row?.row_kind === "derived") note = "Derived ConfigHub variant; upload the base first.";
  else if (row?.row_kind === "base") note = "Recommended base variant to try first.";
  return `<a href="${escapeHtml(page)}"><strong>${escapeHtml(variant)}</strong></a><br><span style="color:var(--muted);font-size:.9rem">${escapeHtml(note)}</span>`;
}

function catalogUseCell(entry, row) {
  if (row?.row_kind === "candidate") {
    return `<strong>Not ready yet</strong><br><span style="color:var(--muted);font-size:.9rem">This is a planned useful base, not a runnable package.</span>`;
  }
  if (entry.proof_surface === "top20-catalog-supported") {
    return `<strong>Ready to try</strong><br><span style="color:var(--muted);font-size:.9rem">This is one of the strongest public starting points.</span>`;
  }
  if (entry.proof_surface === "next80-proof-grade") {
    return `<strong>Review first</strong><br><span style="color:var(--muted);font-size:.9rem">Recipe and matrix data exist, but this is not a polished public demo yet.</span>`;
  }
  return `<strong>${escapeHtml(catalogLayerLabel(entry))}</strong><br><span style="color:var(--muted);font-size:.9rem">Open the chart page for current status.</span>`;
}

function featurePlain(feature) {
  const labels = {
    capabilities: "Kubernetes API capabilities",
    "cluster-rbac": "cluster RBAC",
    crds: "CRDs",
    "generated-facts": "generated facts",
    hook: "hooks",
    hooks: "hooks",
    lookup: "Helm lookup",
    "stateful-storage": "stateful storage",
    tpl: "tpl templates",
    webhooks: "webhooks",
  };
  return labels[feature] ?? humanizeReasonToken(feature);
}

function watchFirstCell(entry, rows, row) {
  const notes = [];
  const features = splitSemicolonList(entry.source_features).map(featurePlain).slice(0, 4);
  const hasHookSignal = rows.some((candidate) => Number(candidate.hook_count || 0) > 0 || String(candidate.lifecycle_route_contract || "n/a") !== "n/a");
  const hasCrdSignal = rows.some((candidate) => /crd/i.test(candidate.quirk_features || "") || /crd/i.test(candidate.next_action || ""));
  if (features.length) notes.push(features.join(", "));
  if (hasHookSignal && !features.some((feature) => /hook/i.test(feature))) notes.push("hooks or lifecycle actions");
  if (hasCrdSignal && !features.some((feature) => /CRD/.test(feature))) notes.push("CRDs");
  const rawReason = cleanPageActionText(row?.hard_gap || row?.active_proof_reason || "");
  const reason = humanizeReasonList(rawReason);
  if (reason && !isCatalogOverviewNoise(reason)) notes.push(reason);
  if (!notes.length) return "No special caveat shown in the catalog row.";
  return escapeHtml(notes.slice(0, 3).join("; "));
}

function isCatalogOverviewNoise(value) {
  const text = String(value || "").trim();
  return !text || /^None/i.test(text) || /^—/.test(text) || /curated proof lane/i.test(text) || /no open gap/i.test(text);
}

function configHubOptionsCell(entry, rows) {
  const bases = rows.filter((row) => row.row_kind === "base");
  const candidates = rows.filter((row) => row.row_kind === "candidate" || row.row_kind === "derived");
  const visible = bases.map((row) => row.variant).filter(Boolean).slice(0, 4);
  const baseText = bases.length
    ? `${bases.length} base option${bases.length === 1 ? "" : "s"}: ${visible.join(", ")}${bases.length > visible.length ? ", ..." : ""}`
    : entry.supported_variants || entry.candidate_variants || "Open chart page.";
  const suffix = candidates.length ? `<br><span style="color:var(--muted);font-size:.9rem">${escapeHtml(candidates.length)} candidate or derived path${candidates.length === 1 ? "" : "s"} also shown.</span>` : "";
  return `${escapeHtml(baseText)}${suffix}`;
}

function githubPackageUrlForEntry(entry, row) {
  if (row?.github_package_base_url) return row.github_package_base_url;
  if (entry.package_path && entry.start_variant) {
    return `https://github.com/confighub/helm-expt/tree/main/${entry.package_path}/bases/${entry.start_variant}`;
  }
  if (entry.package_path) return `https://github.com/confighub/helm-expt/tree/main/${entry.package_path}`;
  return "";
}

function renderedObjectsPathFromRevision(revisionPath) {
  if (!revisionPath) return "";
  return revisionPath.replace(/variant-revision\.yaml$/, "rendered/release-objects.yaml");
}

function githubRenderedObjectsUrlForRow(row) {
  const renderedPath = renderedObjectsPathFromRevision(row?.variant_revision_path);
  return renderedPath ? `https://github.com/confighub/helm-expt/blob/main/${renderedPath}` : "";
}

function githubRecipeUrlForEntry(entry, row) {
  if (row?.github_recipe_url) return row.github_recipe_url;
  const recipeRoot = entry.recipe_path?.replace(/\/recipe\.yaml$/, "");
  return recipeRoot ? `https://github.com/confighub/helm-expt/tree/main/${recipeRoot}` : "";
}

function yamlLinksCell(entry, row) {
  const packageUrl = githubPackageUrlForEntry(entry, row);
  const renderedUrl = githubRenderedObjectsUrlForRow(row);
  const recipeUrl = githubRecipeUrlForEntry(entry, row);
  const links = [installerOciCell(entry)];
  if (renderedUrl) links.push(`<a href="${escapeHtml(renderedUrl)}" rel="noopener">full YAML</a>`);
  if (packageUrl) links.push(`<a href="${escapeHtml(packageUrl)}" rel="noopener">source package base</a>`);
  if (recipeUrl) links.push(`<a href="${escapeHtml(recipeUrl)}" rel="noopener">recipe</a>`);
  return links.length ? links.join("<br>") : "Open chart page.";
}

function chartIndexHtml(catalog) {
  const publicCatalogPackageCount = catalog.installerOciPackages.filter((row) => row.public_catalog === "yes").length;
  const publishedPackageCount = catalog.installerOciPackages.filter((row) => row.publication_status === "published-receipt").length;
  const chartRowsHtml = catalog.catalogEntries
    .map((entry) => {
      const matrixRows = matrixRowsForCatalogEntry(catalog, entry);
      const sourceRow = matrixRows.find((row) => row.row_kind === "source");
      const firstRow = firstCatalogBaseRow(matrixRows, entry);
      const level = catalogLayerLabel(entry);
      const variants = entry.supported_variants || entry.candidate_variants || "";
      const status = entry.start_base_readiness || "see chart page";
      const featureText = [
        entry.chart,
        entry.version,
        level,
        entry.start_variant,
        entry.supported_variants,
        entry.candidate_variants,
        status,
        entry.source_features,
        entry.not_yet_enabled,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const hasHooks =
        /hook/i.test(entry.source_features || "") ||
        /hook/i.test(entry.not_yet_enabled || "") ||
        matrixRows.some((row) => Number(row.hook_count || 0) > 0 || String(row.lifecycle_route_contract || "n/a") !== "n/a");
      const hasCrds = /crd/i.test(entry.source_features || "") || /crd/i.test(variants) || matrixRows.some((row) => /crd/i.test(row.quirk_features || ""));
      return `<tr data-chart-row data-level="${escapeHtml(level)}" data-status="${escapeHtml(status)}" data-hooks="${hasHooks ? "yes" : "no"}" data-crds="${hasCrds ? "yes" : "no"}" data-search="${escapeHtml(featureText)}">
        <td><a href="./${chartPageFileName(entry)}">${escapeHtml(entry.chart)}</a></td>
        <td>${publicCatalogVersionCell(entry, sourceRow)}</td>
        <td>${firstPathCell(entry, firstRow)}</td>
        <td>${catalogUseCell(entry, firstRow)}</td>
        <td>${watchFirstCell(entry, matrixRows, firstRow)}</td>
        <td>${configHubOptionsCell(entry, matrixRows)}</td>
        <td>${yamlLinksCell(entry, firstRow)}</td>
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
  <title>Helm Ops Catalog · Config Test Centre</title>
  <style>${siteCss()}
    #chart-table { table-layout: fixed; }
    #chart-table th, #chart-table td { width: 14.2857%; white-space: normal; }
  </style>
</head>
<body>
  <header>
    ${topNav("..")}
    <h1>Helm Ops Catalog</h1>
    <p class="lead">Choose a checked configuration for a public Helm chart, or bring the chart and values your team has already made.</p>
    <p>The catalog keeps the Helm chart as the source. It shows the Kubernetes objects before installation, records the inputs that produced them, and names the CRDs, hooks, Secrets, setup work, and target requirements that ordinary rendered YAML does not explain.</p>
  </header>
  <main>
    ${catalogPathfinderHtml("..")}

    <section aria-labelledby="catalog-summary">
      <h2 id="catalog-summary">What the catalog contains</h2>
      <p><a href="../how-it-works.html">How the source, rendered objects, routes, variants, and OCI handoffs fit together</a> · <a href="../demo-org.html">Examples in the live ConfigHub demo org</a> · <a href="../../data/helm-catalog-readmes/summary.md">Demo README index</a></p>
      <p>The catalog currently has ${catalog.summary.publicCatalogCharts} public chart pages and ${publicCatalogPackageCount} public installer packages. Open the chart page before using its generated files: it keeps the ready-made configurations, package OCI, full YAML, render record, hooks and CRDs, test results, and current limits together. ${publishedPackageCount} tagged package refs have publication receipts.</p>
    </section>

    <section aria-labelledby="base-variants">
      <h2 id="base-variants">Base Variants, Not Every Values Combination</h2>
      <p>Helm charts can expose hundreds of values. The catalog does not pretend every combination is equally useful or safe. It provides base variants for common operating choices, records the values and render inputs, captures the rendered YAML, and shows the evidence for that choice.</p>
      <p>If your values file changes what Helm renders, it can become another base variant. If it only fills or refines already-rendered objects after upload, it belongs in a derived ConfigHub variant. If it needs a cluster, Secret, CRD owner, cloud account, or hook-like setup step, the chart page should say so before you install.</p>
      <p>Read each base variant in this order: full YAML output first, render context second, hooks/CRDs/setup work third. The YAML shows what Kubernetes would receive; the context and routes explain how that output was produced and what has to happen around it.</p>
      ${markdownLikeTable([
        ["Public word", "Repo word", "Meaning"],
        ["base variant", "Base variant", "A named Helm render choice such as default, no-CRDs, existing Secret, HA, or server-only."],
        ["Full rendered YAML output", "rendered/release-objects.yaml", "The Kubernetes objects produced by one base variant. This is the manifest file you can open and read."],
        ["Render context", "Render intent, revision, routes, receipts", "The inputs, checksums, hook/CRD decisions, target facts, and evidence around that YAML output."],
        ["Chart extras", "Routes, target facts, lifecycle rows", "CRDs, hooks, setup jobs, generated Secrets, cloud accounts, and existing cluster resources that need a decision."],
      ])}
      <h3>Helm values or a ConfigHub change?</h3>
      ${markdownLikeTable([
        ["Put it here", "When to use it", "Where the record appears"],
        ["Helm values", "The choice changes what Helm renders: components, object shape or count, storage, CRDs, ingress, Secret strategy, hooks, or topology.", "The base variant's linked values profile and render intent."],
        ["ConfigHub change", "The rendered base is right, but an exact field should differ for an environment, region, customer, policy, or later operational decision.", "The Unit revision history or derived variant after upload."],
        ["Install work", "The chart needs a Secret, CRD, hook, setup job, certificate, cloud account, or target fact.", "The chart page's prerequisites and route records."],
        ["Live cluster", "You need to check what is running.", "An observation or drift result; live state does not silently become desired configuration."],
      ])}
      <p>If a new Helm render and a ConfigHub revision both change the same field, review the overlap before promotion. The chart page links the Helm values and base output; Hub revision history shows the later ConfigHub changes.</p>
      <p>The model is deliberately chart-specific. A useful base variant for Redis is different from a useful base variant for Argo CD or kube-prometheus-stack. That is why the catalog stores evidence per chart, version, base variant, lane, and target scope. For the deeper reference, read <a href="../../docs/user/helm-presets-and-values.md">Helm Base Variants And Values</a>.</p>
    </section>

    <section aria-labelledby="charts">
      <h2 id="charts">Chart Directory</h2>
      <div class="card">
        <h3>How to read this table</h3>
        <p>Pick a chart, check the pinned upstream version, then open the chart page for the exact command. The right-hand columns tell you the first base variant to try, whether this is a strong public starting point or a proof-grade entry, what to check before use, which ConfigHub options exist, and where to read the generated output.</p>
        <p>This is not a leaderboard. A watch or blocked row can be the most useful answer when it names a prerequisite, lifecycle route, or target decision.</p>
      </div>
      <div class="card">
        <label for="chart-filter"><strong>Search charts</strong></label>
        <input id="chart-filter" type="search" placeholder="redis, crd, hook, prometheus, proof-grade..." style="width:100%; margin:8px 0 12px; padding:10px; border:1px solid var(--line); border-radius:8px;">
        <div class="grid">
          <label>Catalog level<br><select id="level-filter"><option value="">any</option><option value="catalog-supported">catalog-supported</option><option value="proof-grade / machine-proof-only">proof-grade / machine-proof-only</option></select></label>
          <label>Start status<br><select id="status-filter"><option value="">any</option><option value="start-here">start-here</option><option value="render-only">render-only</option><option value="see chart page">see chart page</option></select></label>
          <label>Hooks<br><select id="hook-filter"><option value="">any</option><option value="yes">has hook/action signal</option><option value="no">no hook/action signal</option></select></label>
          <label>CRDs<br><select id="crd-filter"><option value="">any</option><option value="yes">has CRD signal</option><option value="no">no CRD signal</option></select></label>
        </div>
        <p class="mono" id="chart-filter-count" style="font-size:.9rem"></p>
      </div>
      <div class="card"><table id="chart-table">
        <thead><tr><th>Chart</th><th>Version @ Public Catalog</th><th>First base variant</th><th>Can I use it today?</th><th>Watch first</th><th>ConfigHub options</th><th>Package OCI and evidence</th></tr></thead>
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
      <h2 id="actions">Hooks, CRDs, And Other Chart Extras</h2>
      <p>Helm charts often include work outside the main rendered objects: CRDs, hooks, setup jobs, generated Secrets, cloud accounts, and resources that must already exist in the target cluster.</p>
      <p>We help you make the right choice for how to customize and adapt each chart, then track that choice with recorded inputs, generated output, tests, and receipts. The chart-specific answer may be: keep CRDs in the base variant, offer a no-CRDs base variant, run a tested setup step, use a GitOps action where evidence exists, require an existing Secret or target resource, or block the path when there is no safe default.</p>
      <p>A chart page tells you whether an action is observed, routed, per-target, blocked, refused, or still needs a recipe. A route is a named piece of work and its evidence boundary. It is not an automatic execution claim unless the route says so and evidence proves it.</p>
      ${markdownLikeTable([
        ["Disposition", "Rows", "Meaning"],
        ...dispositionRows,
      ])}
      <p>For a specific chart, open its chart page and read the action details beside the variant options. Deeper reference: <a href="../../docs/user/chart-hooks-what-happens.md">what happens to chart hooks</a> and <a href="../../docs/reference/what-hook-support-means.md">hook support vocabulary</a>.</p>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(lifecycleRoutes.length)}</strong><span>lifecycle route rows</span></div>
        <div class="metric"><strong>${escapeHtml(lifecycleChartCount)}</strong><span>chart/version lifecycle behaviors represented</span></div>
        <div class="metric"><strong>${escapeHtml(autoCount)}</strong><span>rows safe to present as automatic</span></div>
        <div class="metric"><strong><a href="../../data/lifecycle-routes/summary.md">open</a></strong><span>machine-readable route contract</span></div>
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
  const passFraction = (status) => {
    const match = String(status).match(/\b(?:pass|yes):\s*(\d+)\/(\d+)/);
    return match ? { passed: Number(match[1]), total: Number(match[2]) } : { passed: 0, total: 0 };
  };
  const proven = lanes
    .filter(([, status]) => {
      const { passed, total } = passFraction(status);
      return total > 0 && passed === total;
    })
    .map(([name]) => name);
  const partial = lanes
    .filter(([, status]) => {
      const { passed, total } = passFraction(status);
      return passed > 0 && passed < total;
    })
    .map(([name]) => name);
  const notYet = lanes
    .filter(([, status]) => {
      const { passed } = passFraction(status);
      return passed === 0 && !/^n\/a: \d+\/\d+$/.test(status);
    })
    .map(([name]) => name);
  const parts = [];
  if (proven.length) parts.push(`Fully proven: ${proven.join(", ")}.`);
  if (partial.length) parts.push(`Proven on some bases: ${partial.join(", ")}.`);
  if (notYet.length) parts.push(`Not yet tested: ${notYet.join(", ")} - a fresh cluster run would prove these.`);
  return parts.join(" ") || "No lane evidence recorded yet.";
}

function packageRequirementsForBase(entry, variant) {
  if (!entry.package_path) return [];
  const installerPath = join(repoRoot, entry.package_path, "installer.yaml");
  if (!existsSync(installerPath)) return [];
  const installer = readYaml(installerPath);
  const bases = installer.spec?.bases ?? [];
  const base =
    bases.find((candidate) => candidate.name === variant) ??
    bases.find((candidate) => candidate.default) ??
    bases[0];
  return Array.isArray(base?.externalRequires) ? base.externalRequires : [];
}

function packageRequirementsForEntry(entry) {
  return packageRequirementsForBase(entry, entry.start_variant);
}

function packageLifecycleActionsForBase(entry, variant) {
  if (!entry.package_path) return [];
  const packageRoot = join(repoRoot, entry.package_path);
  if (!existsSync(packageRoot)) return [];
  const candidates = [];
  const visit = (root) => {
    for (const name of readdirSync(root)) {
      const path = join(root, name);
      if (statSync(path).isDirectory()) {
        visit(path);
      } else if (name === "lifecycle-actions.yaml") {
        candidates.push(path);
      }
    }
  };
  visit(packageRoot);
  if (!candidates.length) return [];
  check(
    candidates.length === 1,
    `${entry.package_path} contains more than one lifecycle-actions.yaml`,
  );
  const contract = readYaml(candidates[0]);
  check(
    contract.kind === "PackagedLifecycleActions",
    `${candidates[0]} must be a PackagedLifecycleActions document`,
  );
  const bases = contract.spec?.bases ?? [];
  const base =
    bases.find((candidate) => candidate.name === variant)
    ?? bases.find((candidate) => candidate.default)
    ?? bases[0];
  const actions = Array.isArray(base?.actions) ? base.actions : [];
  for (const action of actions) {
    if (!action.script) continue;
    const scriptPath = packagedRequirementPath(`package://${action.script}`);
    check(scriptPath, `${candidates[0]} contains an unsafe lifecycle script path`);
    check(
      existsSync(join(packageRoot, scriptPath)),
      `${entry.package_path}/${scriptPath} is missing`,
    );
  }
  return actions;
}

function groupPackageRequirements(requirements) {
  const groups = new Map();
  for (const requirement of requirements) {
    const kind = String(requirement.name ?? requirement.kind ?? "required input").split(/\s+/, 1)[0];
    const key = [
      kind,
      requirement.suggestedSource ?? "",
      requirement.applyMode ?? "",
      requirement.namespace ?? "",
    ].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(requirement);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function packageRequirementGroupLabel(group) {
  if (group.length === 1) return group[0].name || group[0].kind || "Required target input";
  const firstKind = String(group[0].name ?? group[0].kind ?? "input").split(/\s+/, 1)[0];
  const plural = firstKind === "CRD"
    ? "CRDs"
    : firstKind === "Secret"
      ? "Secrets"
      : firstKind === "Namespace"
        ? "Namespaces"
        : `${firstKind}s`;
  return `${group.length} ${plural}`;
}

// Per-base variant scripts. Each runnable base variant row ships try.sh (render locally,
// prerequisites in order, kubectl apply) and confighub.sh (render locally,
// upload to the user's Space). Both are emitted from the same data as the
// chart page command cards, so page copy and scripts cannot diverge.
function presetVariantSlug(row) {
  return String(row.variant || "default")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function presetScriptDir(entry, row) {
  if (["source", "candidate", "derived"].includes(row.row_kind)) return null;
  if (!(row.package_base_path || (entry.package_path && row.variant && row.variant !== "(source)"))) return null;
  const stem = chartPageFileName(entry).replace(/\.html$/, "");
  return `sh/${stem}/${presetVariantSlug(row)}`;
}

function shellStepText(value) {
  return String(value ?? "").replace(/["`$\\]/g, "").replace(/\s+/g, " ").trim();
}

function isRunnableRequirementCommand(value) {
  const command = String(value ?? "").trim();
  if (!command || /[<>]/.test(command)) return false;
  return /^(kubectl|helm|bash|sh|cub|flux|argocd|curl)\b/.test(command);
}

function packagedRequirementPath(value) {
  const match = /^package:\/\/([a-zA-Z0-9._/-]+)$/.exec(String(value ?? "").trim());
  if (!match || match[1].split("/").includes("..")) return "";
  return match[1];
}

function packagedRequirementDescription(requirement) {
  const path = packagedRequirementPath(requirement.suggestedSource);
  if (!path) return "";
  if (String(requirement.name ?? "").startsWith("CRD ")) {
    const applyDetail = requirement.applyMode === "server-side-force-conflicts"
      ? "refreshes the locked CRDs with the chart's server-side, force-conflicts apply mode"
      : "applies missing CRDs server-side";
    const ownershipDetail = requirement.applyMode === "server-side-force-conflicts"
      ? "The generated try script runs this step before the workload and waits for every CRD to become established."
      : "The generated try script leaves existing CRDs under their current owner and waits for them before the workload.";
    return `Included in the OCI package as <code>${escapeHtml(path)}</code>. It ${applyDetail}. ${ownershipDetail}`;
  }
  if (String(requirement.name ?? "").startsWith("Secret ")) {
    return `Included in the OCI package as <code>${escapeHtml(path)}</code>. The generated try script leaves complete existing Secrets under their current owner; otherwise it runs the packaged setup action and checks every required key before the workload.`;
  }
  return `Included in the OCI package as <code>${escapeHtml(path)}</code>. Read the recorded requirement and packaged source before applying the workload.`;
}

function requirementSourceHtml(requirement) {
  return packagedRequirementDescription(requirement) ||
    (requirement.suggestedSource
      ? `<code>${escapeHtml(requirement.suggestedSource)}</code>`
      : "Create or confirm this before apply.");
}

function requirementSourcePlain(requirement) {
  const path = packagedRequirementPath(requirement.suggestedSource);
  if (path) return `included in the package as ${path}`;
  return requirement.suggestedSource
    ? `suggested: ${String(requirement.suggestedSource).replace(/\s+/g, " ")}`
    : "";
}

function presetScriptPreamble(entry, row, purposeLines) {
  const pageUrl = `${SITE_BASE_URL}charts/${chartPageFileName(entry)}`;
  return [
    "#!/usr/bin/env bash",
    `# ${entry.chart} ${entry.version} - base variant: ${row.variant}`,
    ...purposeLines.map((line) => `# ${line}`),
    "# Generated by scripts/generate-public-site.mjs from the committed package",
    `# data for this base variant. Chart page: ${pageUrl}`,
    "set -euo pipefail",
    "",
    "say() { printf '\\n>> %s\\n' \"$*\"; }",
    "",
    "if ! command -v cub >/dev/null 2>&1; then",
    `  printf 'cub is not installed. Install the cub CLI with:\\n  ${CUB_CLI_INSTALL_COMMAND.replace(/'/g, "")}\\nthen add ~/.confighub/bin to your PATH and re-run this script.\\n' >&2`,
    "  exit 1",
    "fi",
    "",
    "# Installer is a cub plugin. Check it before this script does any work.",
    "if ! cub installer --help >/dev/null 2>&1; then",
    `  printf 'The cub installer plugin is missing. Follow ${SITE_BASE_URL}try.html#install-cub, then re-run this script.\\n' >&2`,
    "  exit 1",
    "fi",
    "",
    "if ! command -v kustomize >/dev/null 2>&1; then",
    `  printf 'kustomize is missing. Follow ${SITE_BASE_URL}try.html#install-cub, then re-run this script.\\n' >&2`,
    "  exit 1",
    "fi",
  ];
}

function presetTryScript(entry, row) {
  const workDir = presetWorkDir(entry, row);
  const setup = installerSetupCommand(entry.package_path, row.variant, entry, row);
  const requirements = packageRequirementsForBase(entry, row.variant);
  const lifecycleActions = packageLifecycleActionsForBase(entry, row.variant);
  const namespaces = [...new Set([entry.namespace, ...requirements.map((requirement) => requirement.namespace)].filter(Boolean))];
  const remainingRequirements = requirements.filter(
    (requirement) => !(String(requirement.name ?? "").startsWith("Namespace ") && requirement.namespace),
  );
  const packagedRequirements = remainingRequirements.filter((requirement) =>
    Boolean(packagedRequirementPath(requirement.suggestedSource)),
  );
  const packagedCrdRequirements = packagedRequirements.filter((requirement) =>
    String(requirement.name ?? "").startsWith("CRD "),
  );
  const lines = presetScriptPreamble(entry, row, [
    "Path: pull the package, render this base variant locally, read the objects,",
    "then apply them with kubectl. No ConfigHub account is needed.",
  ]);
  lines.push(
    "",
    "if ! command -v kubectl >/dev/null 2>&1; then",
    "  printf 'kubectl is required for the apply step.\\n' >&2",
    "  exit 1",
    "fi",
    "",
    `say "Pull the package and render the ${row.variant} base variant into ${workDir}"`,
    setup,
    "",
    'say "Read what was rendered; nothing has touched the cluster yet"',
    `ls ${workDir}/out/manifests`,
  );
  if (packagedCrdRequirements.length) {
    lines.push(
      "",
      "wait_for_crd() {",
      '  crd_name="$1"',
      '  deadline=$(( $(date +%s) + 180 ))',
      '  until kubectl get "crd/${crd_name}" >/dev/null 2>&1; do',
      '    if [ "$(date +%s)" -ge "$deadline" ]; then',
      '      printf "CRD %s did not appear within 180 seconds.\\n" "$crd_name" >&2',
      "      return 1",
      "    fi",
      "    sleep 2",
      "  done",
      '  kubectl wait --for=condition=Established --timeout=120s "crd/${crd_name}"',
      "}",
    );
  }
  for (const namespace of namespaces) {
    lines.push(
      "",
      `say "Ensure the ${namespace} namespace exists"`,
      `kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`,
    );
  }
  const runnable = remainingRequirements.filter((requirement) =>
    !packagedRequirements.includes(requirement) &&
    isRunnableRequirementCommand(requirement.suggestedSource),
  );
  const manual = remainingRequirements.filter(
    (requirement) =>
      !packagedRequirements.includes(requirement) &&
      !runnable.includes(requirement),
  );
  const packagedByPath = new Map();
  for (const requirement of packagedRequirements) {
    const path = packagedRequirementPath(requirement.suggestedSource);
    const group = packagedByPath.get(path) ?? [];
    group.push(requirement);
    packagedByPath.set(path, group);
  }
  for (const [path, groupedRequirements] of packagedByPath.entries()) {
    const crdNames = groupedRequirements
      .map((requirement) => /^CRD\s+(.+)$/.exec(String(requirement.name ?? ""))?.[1])
      .filter(Boolean);
    const forceCrdConflicts = groupedRequirements.some(
      (requirement) => requirement.applyMode === "server-side-force-conflicts",
    );
    const secretRequirements = groupedRequirements
      .map((requirement) => {
        const match = /^Secret\s+([^/]+)\/([^\s]+)(?:\s+keys?\s+(.+))?$/.exec(String(requirement.name ?? ""));
        if (!match) return null;
        return {
          namespace: match[1],
          name: match[2],
          keys: match[3] ? match[3].split(",").filter(Boolean) : [],
        };
      })
      .filter(Boolean);
    if (crdNames.length) {
      const applyCommand = path.endsWith("/kustomization.yaml")
        ? `kubectl apply --server-side${forceCrdConflicts ? " --force-conflicts" : ""} -k ${workDir}/package/${posix.dirname(path)}`
        : `kubectl apply --server-side${forceCrdConflicts ? " --force-conflicts" : ""} -f ${workDir}/package/${path}`;
      if (forceCrdConflicts) {
        const label = crdNames.length === 1
          ? `Apply the locked ${crdNames[0]} CRD before the workload`
          : `Apply the ${crdNames.length} locked CRDs before the workload`;
        lines.push(
          "",
          `say "${shellStepText(label)}"`,
          applyCommand,
        );
      } else {
        const label = crdNames.length === 1
          ? `Check the ${crdNames[0]} CRD included with this package`
          : `Check ${crdNames.length} CRDs included with this package`;
        lines.push(
          "",
          `say "${shellStepText(label)}"`,
          "missing_crds=0",
        );
        for (const crdName of crdNames) {
          lines.push(
            `if ! kubectl get crd/${crdName} >/dev/null 2>&1; then`,
            "  missing_crds=1",
            "fi",
          );
        }
        lines.push(
          'if [ "$missing_crds" -eq 1 ]; then',
          `  ${applyCommand}`,
          "else",
          '  say "The required CRDs already exist; leave them under their current owner"',
          "fi",
        );
      }
      for (const crdName of crdNames) {
        lines.push(`wait_for_crd ${crdName}`);
      }
    }
    if (secretRequirements.length) {
      const secretLabel = secretRequirements.length === 1
        ? `Check the ${secretRequirements[0].namespace}/${secretRequirements[0].name} Secret required by this base`
        : `Check ${secretRequirements.length} Secrets required by this base`;
      const secretNamespaces = [...new Set(
        secretRequirements.map((secret) => secret.namespace),
      )].sort();
      lines.push(
        "",
        `say "${shellStepText(secretLabel)}"`,
        "missing_packaged_secrets=0",
      );
      for (const secret of secretRequirements) {
        lines.push(
          `if ! kubectl -n ${secret.namespace} get secret/${secret.name} >/dev/null 2>&1; then`,
          "  missing_packaged_secrets=1",
          "fi",
        );
        for (const key of secret.keys) {
          const jsonPathKey = key.replaceAll(".", "\\.");
          lines.push(
            `if [ -z "$(kubectl -n ${secret.namespace} get secret/${secret.name} -o "jsonpath={.data.${jsonPathKey}}" 2>/dev/null)" ]; then`,
            "  missing_packaged_secrets=1",
            "fi",
          );
        }
      }
      lines.push(
        'if [ "$missing_packaged_secrets" -eq 1 ]; then',
      );
      if (path.endsWith(".sh")) {
        for (const namespace of secretNamespaces) {
          lines.push(`  bash ${workDir}/package/${path} ${namespace}`);
        }
      } else {
        lines.push(
          path.endsWith("/kustomization.yaml")
            ? `  kubectl apply -k ${workDir}/package/${posix.dirname(path)}`
            : `  kubectl apply -f ${workDir}/package/${path}`,
        );
      }
      lines.push(
        "else",
        '  say "The required Secrets already exist and contain every recorded key; leave them under their current owner"',
        "fi",
      );
      for (const secret of secretRequirements) {
        lines.push(`kubectl -n ${secret.namespace} get secret/${secret.name} >/dev/null`);
        for (const key of secret.keys) {
          const jsonPathKey = key.replaceAll(".", "\\.");
          lines.push(
            `test -n "$(kubectl -n ${secret.namespace} get secret/${secret.name} -o "jsonpath={.data.${jsonPathKey}}")"`,
          );
        }
      }
    }
    if (!crdNames.length && !secretRequirements.length) {
      lines.push(
        "",
        `printf 'The packaged prerequisite ${shellStepText(path)} has no supported CRD or Secret requirement type. Read the chart page before applying.\\n' >&2`,
        "exit 1",
      );
    }
  }
  for (const requirement of runnable) {
    const label = shellStepText(requirement.name || requirement.kind || "required target input");
    lines.push(
      "",
      `say "Requirement before apply: ${label}"`,
      `if ! ${String(requirement.suggestedSource).trim()}; then`,
      "  printf '!! The requirement command failed. If the resource already exists, review it and re-run; otherwise fix the error above.\\n' >&2",
      "  exit 1",
      "fi",
    );
  }
  if (manual.length) {
    // Requirements recorded as templates (or without a command) need real
    // values from the user; stop once with all of them, and let a re-run
    // with REQUIREMENTS_READY=1 continue past this gate.
    lines.push(
      "",
      'if [ "${REQUIREMENTS_READY:-0}" != "1" ]; then',
      "  cat >&2 <<'EOF_REQUIREMENTS'",
      "This base variant needs resources you must create with your own values first:",
      ...manual.flatMap((requirement) => {
        const label = String(requirement.name || requirement.kind || "required target input").replace(/\s+/g, " ").trim();
        const suggested = String(requirement.suggestedSource ?? "").trim();
        return suggested ? [`  - ${label}`, `    ${suggested}`] : [`  - ${label} (no command recorded; see the chart page)`];
      }),
      "Complete these prerequisites before applying the rendered objects.",
      "Replace any <...> placeholders with values or files for your environment.",
      "When the resources exist, re-run with:",
      "  REQUIREMENTS_READY=1 bash try.sh",
      "EOF_REQUIREMENTS",
      "  exit 1",
      "fi",
    );
  }
  lines.push(
    "",
    `if [ -d ${workDir}/out/secrets ]; then`,
    '  say "Apply rendered Secrets first"',
    `  kubectl apply -f ${workDir}/out/secrets`,
    "fi",
    "",
    'say "Apply the rendered objects"',
    `kubectl apply -f ${workDir}/out/manifests`,
  );
  for (const action of lifecycleActions.filter(
    (candidate) =>
      candidate.invokedBy === "generated-try-script"
      && ["post-apply", "observe"].includes(candidate.phase),
  )) {
    const scriptPath = packagedRequirementPath(`package://${action.script ?? ""}`);
    check(scriptPath, `${entry.chart} ${row.variant} has no runnable lifecycle script`);
    lines.push(
      "",
      `say "${shellStepText(action.name || "Run the packaged lifecycle check")}"`,
      `bash ${workDir}/package/${scriptPath} ${entry.namespace}`,
    );
  }
  lines.push(
    "",
    lifecycleActions.length > 0
      ? `say "Done. The cluster received exactly the files in ${workDir}/out, with the packaged lifecycle steps checked."`
      : `say "Done. The cluster received exactly the files in ${workDir}/out."`,
    "",
  );
  return lines.join("\n");
}

function presetConfigHubScript(entry, row) {
  const workDir = presetWorkDir(entry, row);
  const setup = installerSetupCommand(entry.package_path, row.variant, entry, row);
  const requirements = packageRequirementsForBase(entry, row.variant);
  const chartShort = entry.chart.split("/").pop();
  const spaceSlug = `helm-${chartShort}-${row.variant}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const lines = presetScriptPreamble(entry, row, [
    "Path: render this base variant locally, then upload the objects to your",
    "ConfigHub Space as Units you can edit, diff, and deliver.",
    "Needs a ConfigHub account: run cub auth login once before this script.",
  ]);
  lines.push(
    "",
    `SPACE="\${CUB_SPACE:-${spaceSlug}}"`,
    "",
    'say "Check ConfigHub auth"',
    "if ! cub auth status >/dev/null 2>&1; then",
    "  printf 'Not logged in. Run: cub auth login\\nThen re-run this script.\\n' >&2",
    "  exit 1",
    "fi",
    "",
    `say "Render the ${row.variant} base variant into ${workDir}"`,
    setup,
    "",
    `say "Upload the rendered objects to Space \${SPACE} (created on first upload)"`,
    `cub installer upload --work-dir ${workDir} --space "\${SPACE}"`,
    "",
    'say "Uploaded. See your Units:"',
    `printf '  cub unit list --space %s\\n  or open https://hub.confighub.com and find that Space.\\n' "\${SPACE}"`,
    "",
    'say "Next: create an environment variant and promote reviewed changes"',
    `printf '  Walkthrough with the why behind each flag:\\n  ${SITE_BASE_URL}d/docs/user/variants-after-upload.html\\n'`,
  );
  if (requirements.length) {
    lines.push(
      "",
      "# Before applying this base variant from ConfigHub to a cluster, it still needs:",
      ...requirements.map((requirement) => {
        const source = requirementSourcePlain(requirement);
        return `#   - ${String(requirement.name || requirement.kind || "required target input").replace(/\s+/g, " ")}${source ? ` (${source})` : ""}`;
      }),
    );
  }
  lines.push("");
  return lines.join("\n");
}

function buildPresetScripts(catalog) {
  const scripts = [];
  const seen = new Set();
  for (const entry of catalog.catalogEntries) {
    const rows = catalog.masterCatalogMatrix
      .filter((row) => row.chart === entry.chart && row.version === entry.version)
      .sort(compareMatrixRows);
    for (const row of rows) {
      const dir = presetScriptDir(entry, row);
      if (!dir || seen.has(dir)) continue;
      seen.add(dir);
      scripts.push(
        { relPath: `${dir}/try.sh`, path: join(siteRoot, dir, "try.sh"), content: presetTryScript(entry, row) },
        { relPath: `${dir}/confighub.sh`, path: join(siteRoot, dir, "confighub.sh"), content: presetConfigHubScript(entry, row) },
      );
    }
  }
  return scripts;
}

// Image references per base variant, extracted from the reviewed rendered
// output (the newest revision's release-objects.yaml). Empty when a variant
// has no recipe revision on disk; the section renders only what exists.
function extractBaseImages(entry, variant) {
  const revisionsDir = join(repoRoot, "recipes", entry.chart, entry.version, "revisions", variant);
  try {
    const revisions = readdirSync(revisionsDir).filter((name) => /^r\d+$/.test(name)).sort();
    if (!revisions.length) return [];
    const rendered = readFileSync(join(revisionsDir, revisions[revisions.length - 1], "rendered", "release-objects.yaml"), "utf8");
    const images = new Set();
    for (const match of rendered.matchAll(/^\s*(?:-\s+)?image:\s*["']?([^"'\n]+?)["']?\s*$/gm)) {
      const image = match[1].trim();
      if (image && !image.includes("{{")) images.add(image);
    }
    return [...images].sort();
  } catch {
    return [];
  }
}

// Count the Kubernetes objects in a base variant's reviewed rendered output.
function countRenderedObjects(entry, variant) {
  const revisionsDir = join(repoRoot, "recipes", entry.chart, entry.version, "revisions", variant);
  try {
    const revisions = readdirSync(revisionsDir).filter((name) => /^r\d+$/.test(name)).sort();
    if (!revisions.length) return 0;
    const rendered = readFileSync(join(revisionsDir, revisions[revisions.length - 1], "rendered", "release-objects.yaml"), "utf8");
    return (rendered.match(/^kind:\s*\S+/gm) || []).length;
  } catch {
    return 0;
  }
}

// One row of extracted numbers for a chart's starting base variant: rendered
// objects, image references, lifecycle routes, and proof lanes passing. Every
// figure comes from committed data, so the strip renders only what exists.
function chartStatStrip(entry, firstRunnableRow) {
  const variant = firstRunnableRow?.variant || entry.start_variant;
  if (!variant) return "";
  const objects = countRenderedObjects(entry, variant);
  const images = extractBaseImages(entry, variant).length;
  const routes = Number.parseInt(firstRunnableRow?.lifecycle_route_count || "0", 10) || 0;
  const laneKeys = Object.keys(firstRunnableRow || {}).filter((key) => key.startsWith("lane_"));
  const laneValues = laneKeys.map((key) => firstRunnableRow[key]);
  const lanesScored = laneValues.filter((value) => value === "yes" || value === "no").length;
  const lanesPassing = laneValues.filter((value) => value === "yes").length;
  const stats = [];
  if (objects) stats.push(`<strong>${objects}</strong> rendered objects`);
  stats.push(`<strong>${images}</strong> image${images === 1 ? "" : "s"}`);
  stats.push(`<strong>${routes}</strong> lifecycle route${routes === 1 ? "" : "s"}`);
  if (lanesScored) stats.push(`<strong>${lanesPassing}/${lanesScored}</strong> proof lanes passing`);
  return `<p class="stat-strip">${variant} base variant: ${stats.join(" · ")}. Every number is extracted from committed data.</p>`;
}

function humanTargetScope(scope) {
  return String(scope ?? "").replace(
    "cub-lk-kind-vanilla",
    "vanilla kind (historical receipt)",
  );
}

function gitOpsRuntimeReviewHtml(review, reviewPath) {
  const spec = review?.spec;
  if (!spec) return "";
  const targetProfile = spec.targetProfile ?? {};
  const targetParts = [
    spec.targetShape,
    targetProfile.name && !String(spec.targetShape ?? "").includes(targetProfile.name) ? `profile: ${targetProfile.name}` : "",
    targetProfile.sourcePackage ? `installed from ${targetProfile.sourcePackage}${targetProfile.sourceBase ? `/${targetProfile.sourceBase}` : ""}` : "",
  ].filter(Boolean);
  const passed = Array.isArray(spec.passed) ? spec.passed : [];
  const boundaries = Array.isArray(spec.notClaimed) ? spec.notClaimed : [];
  const remaining =
    spec.watch?.summary ??
    spec.diagnosis?.summary ??
    "No separate limitation is recorded in this review.";
  const rows = [
    ["Base variant", escapeHtml(spec.base || "not recorded")],
    ["Target used", escapeHtml(targetParts.join("; ") || "not recorded")],
    ["Observed result", `<strong>${escapeHtml(spec.observedResult || "not recorded")}</strong>`],
    ["What passed", passed.length ? passed.map((item) => escapeHtml(item)).join("<br>") : "No passed checks listed."],
    ["What the result means", escapeHtml(remaining)],
  ];
  if (spec.previousObservation?.detail) {
    rows.push(["Earlier result", escapeHtml(spec.previousObservation.detail)]);
  }
  if (boundaries.length) {
    rows.push(["What this does not prove", boundaries.map((item) => escapeHtml(item)).join("<br>")]);
  }
  rows.push(["Full review and receipt", `<a href="../../${escapeHtml(reviewPath)}">Open the runtime review</a>${spec.receipt ? ` · <a href="../../${escapeHtml(spec.receipt)}">open the live receipt</a>` : ""}`]);
  return `<section aria-labelledby="runtime-review">
      <h2 id="runtime-review">What We Tested On A Cluster</h2>
      <p>This is the result of a real run for one base variant on one recorded target setup. It does not silently extend the result to other bases or clusters.</p>
      ${markdownLikeTable([
        ["Question", "Recorded answer"],
        ...rows,
      ], { rawSecondColumn: true })}
    </section>`;
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
  const firstRunnableCommandText = firstRunnableRow ? matrixRowRunPath(firstRunnableRow, entry, { html: false }) : "No runnable row recorded yet.";
  const firstRunnableScriptDir = firstRunnableRow ? presetScriptDir(entry, firstRunnableRow) : null;
  const installerPackageOciRef = installerOciRefForEntry(entry);
  const installerPackageStatus = installerOciStatusText(entry);
  const firstRunnableReason = cleanPageActionText(
    firstRunnableRow?.active_proof_reason ||
    firstRunnableRow?.variant_promotion_reason ||
    firstRunnableRow?.hard_gap ||
    entry.not_yet_enabled ||
    "No blocking reason recorded.",
  );
  const teaching = chartTeachingHtml(entry);
  const production = productionSummaryForChart(catalog, entry);
  const support = catalog.productionSupportDecisions.find((row) => row.chart === entry.chart && row.version === entry.version);
  const chartUse = catalog.chartUseGuide.find((row) => row.chart === chartKey);
  const top100 = catalog.top100Readiness.find((row) => row.chart === chartKey);
  const userReadiness = catalog.top100UserReadiness.find((row) => row.chart === entry.chart && row.version === entry.version);
  const chartSkill = catalog.chartSkills.find((row) => row.chart === entry.chart && row.version === entry.version);
  const evidenceRoute = catalog.chartEvidenceRouter.find((row) => row.chart === entry.chart && row.version === entry.version);
  const gitOpsReviewPath = `${posix.dirname(entry.recipe_path)}/gitops-runtime-review.yaml`;
  const gitOpsReview = existsSync(join(repoRoot, gitOpsReviewPath))
    ? readYaml(join(repoRoot, gitOpsReviewPath))
    : null;
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
    .filter((row) => row.row_kind === "base")
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
  const firstRenderIntent = catalog.helmRenderIntents.find((row) => row.chart === entry.chart && row.version === entry.version && row.base === entry.start_variant)
    ?? catalog.helmRenderIntents.find((row) => row.chart === entry.chart && row.version === entry.version);
  const settingSourceRows = matrixRows
    .filter((row) => row.row_kind === "base")
    .map((row) => {
      const intent = renderIntentForRow(catalog, row);
      return [
        row.variant,
        intent ? renderIntentValuesLink(intent) : "Not recorded for this row.",
        intent
          ? "None in the catalog base. Later edits appear in ConfigHub Unit revision history or a derived variant."
          : "No runnable catalog base exists yet.",
        intent ? renderIntentInstallWorkSummary(intent) : "Not recorded for this row.",
      ];
    });
  const firstRunnableDisplayReason = currentPathReason(
    firstRunnableRow,
    firstRenderIntent,
    firstRunnableReason,
  );
  const firstHubReadmePath = firstRunnableRow ? helmCatalogReadmePath(catalog, entry.chart, entry.version, firstRunnableRow.variant) : "";
  const firstRenderIntentLink = firstRenderIntent?.intent_path
    ? `<a href="../../${escapeHtml(firstRenderIntent.intent_path)}">${escapeHtml(firstRenderIntent.base)} render intent</a>`
    : `<a href="../../data/helm-render-intents/summary.md">render-intent summary</a>`;
  const firstRenderedObjectsPath = firstRenderIntent?.rendered_objects_path || renderedObjectsPathFromRevision(firstRunnableRow?.variant_revision_path);
  const firstRenderedObjectsLink = firstRenderedObjectsPath
    ? `<a href="../../${escapeHtml(firstRenderedObjectsPath)}">full rendered YAML</a>`
    : `<a href="../../data/helm-render-intents/summary.md">render-output summary</a>`;
  const lifecycleByVariantChart = (catalog.lifecycleByVariant ?? []).find((candidate) => candidate.chart === entry.chart);
  const lifecycleVariants = lifecycleByVariantChart?.variants?.filter((candidate) =>
    !candidate.recipeVersion || candidate.recipeVersion === entry.version) ?? [];
  const lifecycleByVariantEntry = lifecycleVariants.length
    ? { ...lifecycleByVariantChart, variants: lifecycleVariants }
    : null;
  const firstLifecycleRoutes =
    lifecycleVariants.find((candidate) => candidate.base === firstRunnableRow?.variant)?.routes ??
    lifecycleVariants[0]?.routes ??
    [];
  const firstBaseRecordPath = firstRunnableRow
    ? `data/base-variant-records/records/${helmRenderIntentFileName(firstRunnableRow.chart, firstRunnableRow.version, firstRunnableRow.variant)}`
    : "";
  const firstBaseRecordLink = firstBaseRecordPath && existsSync(join(repoRoot, firstBaseRecordPath))
    ? `<a href="../../${escapeHtml(firstBaseRecordPath)}">${escapeHtml(firstRunnableRow.variant)} base-variant record</a>`
    : `<a href="../../data/base-variant-records/summary.md">base-variant record index</a>`;
  const kpsLifecycleProofPath =
    entry.chart === "prometheus-community/kube-prometheus-stack"
      && entry.version === "85.3.3"
      ? "runs/kps-lifecycle-route-proof/receipt.yaml"
      : "";
  const kpsNoCrdsLifecycleProofPath =
    entry.chart === "prometheus-community/kube-prometheus-stack"
      && entry.version === "85.3.3"
      ? "runs/kps-lifecycle-route-proof/no-crds-receipt.yaml"
      : "";
  const kpsPublicPackageProofPath =
    entry.chart === "prometheus-community/kube-prometheus-stack"
      && entry.version === "85.3.3"
      ? "data/kps-public-package-proof/summary.md"
      : "";
  const kpsGitOpsLifecycleProofPath =
    entry.chart === "prometheus-community/kube-prometheus-stack"
      && ["85.3.3", "86.1.0"].includes(entry.version)
      ? "data/kps-gitops-lifecycle-proof/summary.md"
      : "";
  const argoWorkflowsGuidePath =
    entry.chart === "argo-cd/argo-workflows"
      && entry.version === "1.0.14"
      ? "docs/demo/hooks-crds/argo-workflows.md"
      : "";
  const packageRequirements = packageRequirementsForEntry(entry);
  const packageRequirementRows = groupPackageRequirements(packageRequirements).map((group) => [
    packageRequirementGroupLabel(group),
    requirementSourceHtml(group[0]),
  ]);
  const packageRequirementTableRows = packageRequirementRows.length
    ? packageRequirementRows
    : [["None recorded for the recommended base variant.", "No separate setup command recorded."]];
  const basePrerequisiteRows = matrixRows
    .filter((row) => row.row_kind === "base")
    .flatMap((row) => groupPackageRequirements(packageRequirementsForBase(entry, row.variant)).map((group) => [
      row.variant,
      packageRequirementGroupLabel(group),
      requirementSourceHtml(group[0]),
      `<a href="../../data/helm-render-intents/intents/${helmRenderIntentFileName(row.chart, row.version, row.variant)}">full render intent</a>`,
    ]));
  const artifactRows = [
    ["Chart catalog", entry.catalog_path],
    ["Helm render intents", "data/helm-render-intents/summary.md"],
    ["Base variant records", "data/base-variant-records/summary.md"],
    ["First render intent", firstRenderIntent?.intent_path ?? ""],
    ["First base variant record", firstBaseRecordPath],
    ["Full rendered YAML", firstRenderedObjectsPath ?? ""],
    ["Demo README for first preset", firstHubReadmePath],
    ["Recipe", entry.recipe_path],
    ["Package", entry.package_path],
    ["Installer OCI package catalog", "data/installer-oci-packages/summary.md"],
    ["Helm pain report", entry.helm_pain_report],
    ["Production disposition", "data/production-disposition/summary.md"],
    ["Support decision", support?.path ?? ""],
    [baseRows.length ? "Base readiness" : "Master matrix rows", baseRows.length ? "data/top20-base-readiness/summary.md" : "data/master-catalog-matrix/summary.md"],
    ["Chart skills", "data/chart-skills/summary.md"],
    ["Chart evidence router", "data/chart-evidence-router/summary.md"],
    ["Current proof status", "docs/user/current-proof-status.md"],
    [gitOpsReview ? "Cluster runtime review" : "", gitOpsReview ? gitOpsReviewPath : ""],
    [kpsLifecycleProofPath ? "Direct hooks and CRDs lifecycle proof (default)" : "", kpsLifecycleProofPath],
    [kpsNoCrdsLifecycleProofPath ? "Direct hooks and CRDs lifecycle proof (no-crds)" : "", kpsNoCrdsLifecycleProofPath],
    [kpsGitOpsLifecycleProofPath ? "Argo CD and Flux lifecycle proof (no-crds)" : "", kpsGitOpsLifecycleProofPath],
    [argoWorkflowsGuidePath ? "Argo Workflows CRD guide" : "", argoWorkflowsGuidePath],
    [
      entry.chart === "bitnami/nginx" && entry.version === "24.0.2"
        ? "Exact NGINX three-path delivery receipt"
        : "",
      entry.chart === "bitnami/nginx" && entry.version === "24.0.2"
        ? CATALOG_OCI_DELIVERY_RECEIPT
        : "",
    ],
  ].filter(([, path]) => path);
  const openDispositions = splitDisposition(production?.open_dispositions);
  const acceptedDispositions = splitDisposition(production?.accepted_dispositions);
  const lanes = [
    ["Render parity", baseRows.length ? allBaseStatus(baseRows, "render_parity") : allBaseStatus(matrixRows.filter((row) => row.row_kind === "base"), "lane_render_parity")],
    ["ConfigHub proof", baseRows.length ? allBaseStatus(baseRows, "in_confighub") : allBaseStatus(matrixRows.filter((row) => row.row_kind === "base"), "lane_confighub_scan_ops")],
    ["Local live", baseRows.length ? allBaseStatus(baseRows, "local_live") : allBaseStatus(matrixRows.filter((row) => row.row_kind === "base"), "lane_local_kind")],
    ["GitOps/OCI live", baseRows.length ? allBaseStatus(baseRows, "gitops_oci_live") : allBaseStatus(matrixRows.filter((row) => row.row_kind === "base"), "lane_gitops_oci_live")],
    ["Live Helm-vs-ConfigHub", baseRows.length ? allBaseStatus(baseRows, "live_helm_vs_confighub_parity") : allBaseStatus(matrixRows.filter((row) => row.row_kind === "base"), "lane_live_dual_parity")],
    ["Two-cluster kind", baseRows.length ? allBaseStatus(baseRows, "two_cluster_kind_parity") : allBaseStatus(matrixRows.filter((row) => row.row_kind === "base"), "lane_two_cluster_kind")],
  ];
  const lifecycleRoutes = catalog.lifecycleRoutes.filter((row) => row.chart === entry.chart && (!row.version || row.version === entry.version));
  const lifecycleRows = lifecycleRoutes.map((row) => [
    row.quirk_class,
    row.route_name,
    executionModePlain(row.execution_mode),
    (row.alternatives ?? []).map((alt) => alt.route).join(", ") || "-",
    isTruthyRouteFlag(row.safe_as_automatic) ? "yes" : "no",
  ]);
  const gitopsRouteEmissionChart = (catalog.gitopsRouteEmission ?? []).find((candidate) => candidate.chart === entry.chart);
  const gitopsRouteEmissionVariants = gitopsRouteEmissionChart?.variants?.filter((variant) =>
    !variant.recipeVersion || variant.recipeVersion === entry.version) ?? [];
  const gitopsRouteEmissionEntry = gitopsRouteEmissionVariants.length
    ? { ...gitopsRouteEmissionChart, variants: gitopsRouteEmissionVariants }
    : null;
  const lifecyclePolicyRows = lifecyclePolicyTableRows(readLifecyclePolicy(entry.recipe_path));
  const dispositionActionRows = productionDispositionActionRows(production);
  const skillRows = chartSkill?.applicable?.map((skill) => [
    `<a href="../../${escapeHtml(skill.doc)}">${escapeHtml(skill.title)}</a>`,
    skill.why,
  ]) ?? [];
  const factSheetRows = [
    ["User status", evidenceRoute?.user_status || userReadiness?.user_status || "not recorded"],
    ["Can I use it?", evidenceRoute?.chart_use_answer || "check the supported base and production boundary"],
    ["First base", evidenceRoute?.first_base || entry.start_variant],
    ["Installer package OCI", installerPackageOciRef],
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
  <title>${escapeHtml(entry.chart)} ${escapeHtml(entry.version)} · Config Test Centre</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header>
    ${topNav("..")}
    <h1>${escapeHtml(entry.chart)}</h1>
    <p>This page exists so you do not have to guess your way through this Helm chart. It shows the useful ways we know how to run it, the Kubernetes YAML each choice produces, and the evidence behind the current claim.</p>
    <p>Start by choosing a <a href="./index.html#base-variants">base variant</a>. A base variant is a supported Helm configuration such as default, no-CRDs, existing Secret, HA, or server-only.</p>
    <p>The page does not claim every values combination for this chart. It shows the supported base variants we have recorded, what problem each one solves, and the chart-specific work that still needs a decision.</p>
    <p>Use it to choose the first useful base variant, read the exact objects, catch prerequisites or classic errors, and see what is proven before you install or promote anything.</p>
    <p>Pass means backed by evidence. Watch or blocked means the limit is named so you can decide what to do next.</p>
    <p class="mono" style="font-size:.9rem">ecosystem: <a href="https://artifacthub.io/packages/search?ts_query_web=${encodeURIComponent(entry.chart.split("/").at(-1))}&amp;kind=0" rel="noopener">find this chart on Artifact Hub</a> · <a href="https://helm.sh/docs/" rel="noopener">Helm docs</a> - discovery and tooling live upstream; this page adds the proof.</p>
    <p class="tagline">${escapeHtml(catalogLayerLabel(entry))} page for ${escapeHtml(entry.chart)}@${escapeHtml(entry.version)}.</p>
    <pre>${escapeHtml(firstRunnableCommandText)}</pre>
  </header>
  <main>
    <section aria-labelledby="pillars-here">
      <h2 id="pillars-here">Three ways this page helps you test</h2>
      <p>The same three things hold for every package in the catalog, Helm charts and OCI packages alike. <a href="../testing.html">Why this makes configuration easier to test</a>.</p>
      <div class="grid">
        <div class="card"><h3><a href="#render-record-route">Most choices are made before you install</a></h3><p>The package fixes and checks almost everything at build time. What you set is small and typed.</p></div>
        <div class="card"><h3><a href="#proof">You can read the proof</a></h3><p>Render parity, live install, and delivery, recorded as receipts you can open.</p></div>
        <div class="card"><h3><a href="#lifecycle">See hooks, CRDs, and setup work</a></h3><p>The page names the work and says which delivery path has actually run.</p></div>
      </div>
    </section>

    <section aria-labelledby="summary">
      <h2 id="summary">What To Use</h2>
      ${chartStatStrip(entry, firstRunnableRow)}
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(entry.start_variant)}</strong><span>Recommended first base variant</span></div>
        <div class="metric"><strong>${escapeHtml(entry.variant_count)}</strong><span>${entry.proof_surface === "next80-proof-grade" ? "Candidate base variants" : "Supported base variants"}</span></div>
        <div class="metric"><strong>${escapeHtml(entry.start_base_readiness || "see bases")}</strong><span>Start-base status</span></div>
        <div class="metric"><strong>${escapeHtml(production?.production_support ?? entry.production_readiness)}</strong><span>Production disposition</span></div>
      </div>
      <p>${escapeHtml(chartUse?.plain_english ?? "Use the public catalog entry, then check the exact base and proof lane before making a production claim.")}</p>
      ${markdownLikeTable([
        ["Question", "Answer"],
        ["Catalog level", catalogLayerLabel(entry)],
        ["Chart version", entry.version],
        ["Installer package OCI", installerPackageOciRef],
        ["OCI publication status", installerPackageStatus],
        ["Latest upstream seen", entry.latest_status === "update-available" ? `${entry.latest_version} (update candidate)` : entry.latest_version || "not checked"],
        [entry.proof_surface === "next80-proof-grade" ? "Candidate base variants" : "Supported base variants", entry.supported_variants || entry.candidate_variants || "see matrix rows"],
        ["Not yet enabled", entry.not_yet_enabled || "none recorded"],
        ["Namespace", entry.namespace || "chart default"],
      ])}
    </section>

    <section aria-labelledby="setting-sources">
      <h2 id="setting-sources">Where This Chart's Settings Come From</h2>
      <p>Helm values define each base render. ConfigHub changes begin after upload and are recorded against the rendered objects. Secrets, CRDs, hooks, and setup jobs are listed separately because they are install work, not hidden settings. Live cluster state is observed separately and does not silently become the desired configuration.</p>
      ${settingSourceRows.length
        ? markdownLikeTable([
            ["Base variant", "Helm values", "ConfigHub changes", "Install work"],
            ...settingSourceRows,
          ], { rawSecondColumn: true })
        : "<p>No runnable base has a recorded setting source yet.</p>"}
      <p><strong>Upgrade rule:</strong> if a new Helm render and a ConfigHub revision both change the same field, review the overlap before promotion. The values profile shows the Helm side; Unit revision history shows the ConfigHub side.</p>
      <p><a href="../../docs/user/helm-presets-and-values.md#where-each-setting-lives">Read the full values-versus-ConfigHub rule</a>.</p>
    </section>

    <section aria-labelledby="render-record-route">
      <h2 id="render-record-route">What A Base Variant Records</h2>
      <p>A base variant solves the first Helm problem: which chart inputs should we use, and what Kubernetes objects do they produce? Each base variant records the Helm chart version, values profile, namespace, release name, capability profile, source lock, generated output, and evidence lanes.</p>
      <p>The ${firstBaseRecordLink} joins those Helm facts to the literal objects, remaining target inputs, hooks and CRDs, apply policy, and OCI handoffs. It is the short record to open when you need the whole base rather than only its rendered YAML.</p>
      <p>Open the ${firstRenderedObjectsLink} to read the actual manifest output. Then use the render intent, receipts, and chart-extras section to see the inputs, checks, and CRD/hook/setup decisions around it.</p>
      <p>If your values file creates a new useful operating shape, it should become another base variant with its own recorded inputs and checks. If it only changes an already-rendered field after upload, it belongs in a derived ConfigHub variant that can be reviewed and kept through upgrades.</p>
      ${markdownLikeTable([
        ["Key", "Where to look first", "What it means"],
        ["Package users pull", `<code>${escapeHtml(installerPackageOciRef)}</code>`, `The installer package OCI ref for this chart version. After publication, it contains the available bases and package metadata. ${INSTALLER_OCI_AUTH_NOTE}`],
        ["Required before apply", packageRequirementTableRows.map(([name, source]) => `${escapeHtml(name)}${source ? `<br>${source}` : ""}`).join("<br>"), "External resources the recommended base variant expects, such as an existing Secret, namespace, CRD, or target fact."],
        ["Kubernetes objects", firstRenderedObjectsLink, "The full YAML captured from this base variant. It is the output of the render."],
        ["Render record", firstRenderIntentLink, "The Helm inputs and evidence links that explain how the output was produced."],
        ["Base variant record", firstBaseRecordLink, "The source-neutral record that joins the Helm record, literal objects, remaining inputs, routes, policy, and OCI status."],
        ["Hooks, CRDs, and setup work", `<a href="#lifecycle">this page's chart-extras section</a>`, "The route decisions for non-plain-YAML work: hooks, CRDs, generated Secrets, setup jobs, target facts, or blockers."],
      ], { rawSecondColumn: true })}
      <div class="grid">
        <div class="card"><h3>Choose base variant</h3><p>Pick the supported Helm configuration for this chart: default, no-CRDs, existing Secret, HA, server-only, or another listed option.</p></div>
        <div class="card"><h3>Record inputs</h3><p>Keep the values profile, namespace, release name, source lock, ${firstRenderIntentLink}, full YAML output, package base, proof lanes, and route context together.</p></div>
        <div class="card"><h3>Handle chart extras</h3><p>CRDs, hooks, setup jobs, external Secrets, target facts, and webhook certificates are recorded as chart-specific choices. Some are included in a base variant, some need a setup step, and some are blocked until there is a safe path.</p></div>
      </div>
      <p><a href="../../docs/user/helm-render-intents.md">How render intents work</a> · <a href="../../data/helm-render-intents/summary.md">All generated render intents</a> · <a href="../../data/base-variant-records/summary.md">All base variant records</a></p>
    </section>

    <section aria-labelledby="run-this">
      <h2 id="run-this">How To Try This Chart</h2>
      <p>Start with <strong>${escapeHtml(entry.start_variant)}</strong> unless a card below explains that another base variant is a better first path. If a card says review or preparation is needed, treat that as a real limit rather than a ready install.</p>
      <div class="card">
        <h3>Package image</h3>
        <p><code>${escapeHtml(installerPackageOciRef)}</code><br><span style="color:var(--muted);font-size:.9rem">${escapeHtml(installerPackageStatus)}</span></p>
        <p>${escapeHtml(INSTALLER_OCI_AUTH_NOTE)}</p>
        <h3>Recommended first command</h3>
        <p>${firstRunnableCommand}</p>
        ${firstRunnableScriptDir ? `<p>Or run the whole sequence as one script, prerequisites included: <a href="../${firstRunnableScriptDir}/try.sh">try.sh</a> (render and apply, no account) · <a href="../${firstRunnableScriptDir}/confighub.sh">confighub.sh</a> (render and upload to your ConfigHub Space).</p>` : ""}${firstHubReadmePath ? `
        <p>This preset is also shown in the live <code>helm-catalog</code> demo org. <a href="../../${escapeHtml(firstHubReadmePath)}">Read the demo README</a> to see why that Space exists, what problem it demonstrates, and what to inspect first.</p>` : ""}
        <h3>You should see something like this</h3>
        <pre><code>cub installer setup ...
rendered manifests written under &lt;work-dir&gt;
use the chart option cards below to check pass, watch, blocked, and prerequisites</code></pre>
        <p><strong>Current status:</strong> ${escapeHtml(firstRunnableRow ? matrixRowStatusLabel(firstRunnableRow) : entry.start_base_readiness || "unknown")} · <strong>Reason:</strong> ${escapeHtml(firstRunnableDisplayReason)}</p>
      </div>
    </section>

${teaching ? `\n    ${teaching}\n` : ""}

    <section aria-labelledby="matrix-options">
      <h2 id="matrix-options">Base Variants And Options</h2>
      <p>Each card is one available way to use this chart in the catalog. Some cards are runnable base variants. Others are candidate paths, derived variants, or review notes that explain what still has to be prepared.</p>
      <p class="small"><strong>Check labels:</strong> R = render parity, C = ConfigHub proof, L = local cluster, Y = lifecycle actions, G = GitOps/OCI, P = live Helm-vs-ConfigHub parity, K = two-cluster kind parity, V = variant promotion.</p>
      <p class="mono" style="font-size:.9rem">${escapeHtml(matrixRows.length)} matrix row${matrixRows.length === 1 ? "" : "s"} for ${escapeHtml(entry.chart)}@${escapeHtml(entry.version)} · <a href="../matrix.html">open the full matrix</a></p>
      ${matrixRows.length ? `<div class="matrix-row-grid">${matrixRows.map((row) => matrixRowCard(row, entry, catalog)).join("")}</div>` : "<p>No matrix rows are recorded for this chart/version.</p>"}
    </section>

    ${(() => {
      const imageRows = matrixRows
        .filter((row) => row.row_kind === "base")
        .map((row) => [row.variant, extractBaseImages(entry, row.variant)])
        .filter(([, images]) => images.length);
      if (!imageRows.length) return "";
      return `<section aria-labelledby="images-pulled">
      <h2 id="images-pulled">Images This Chart Pulls</h2>
      <p>Every reference below comes from the reviewed rendered output. What you see is what the cluster pulls. These references are data: you can change a registry or pin a digest with a recorded edit, and prove the change landed in every environment.</p>
      ${markdownLikeTable([
        ["Base variant", "Images"],
        ...imageRows.map(([variant, images]) => [variant, images.map((image) => `<code>${escapeHtml(image)}</code>`).join("<br>")]),
      ], { rawSecondColumn: true })}
    </section>`;
    })()}

    ${chartAdoptionCaveatHtml(adoptionCaveat, packageRequirements, firstLifecycleRoutes)}

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
      <p>The source data lives in <a href="../../data/chart-skills/summary.md">chart skills</a> and <a href="../../data/chart-evidence-router/summary.md">chart evidence router</a>.</p>
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
    </section>${gitOpsReview ? `\n\n    ${gitOpsRuntimeReviewHtml(gitOpsReview, gitOpsReviewPath)}` : ""}

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
      <h2 id="lifecycle">Hooks, CRDs, And Setup Work</h2>
      <p>Some Helm charts need work before, during, or after apply: CRDs, hooks, setup jobs, webhook certificates, migrations, generated Secrets, or checks. For each chart, the catalog should make the choice clear: include it in the base variant, split it into a separate base variant, run a setup step, use a GitOps action where evidence exists, require an existing target resource, or block it when there is no safe default.</p>${basePrerequisiteRows.length ? `
      <h3>What each base needs before apply</h3>
      <p>These requirements come from the same base definition as the rendered objects. The render intent keeps the chart inputs, required Secrets or CRDs, lifecycle routes, and evidence together.</p>
      ${markdownLikeTable([
        ["Base variant", "Required resource", "How to provide it", "Full record"],
        ...basePrerequisiteRows,
      ], { rawThirdColumn: true, rawFourthColumn: true })}` : ""}
      <p>If no route is shown, that does not prove the upstream chart has no hooks. It means the public catalog has no chart-specific action to show yet; check the matrix or send a problem chart if hook behavior should be modeled. Direct apply, Argo CD, Flux, and upgrade implementations are tracked separately. One passing implementation does not prove the others.</p>
${kpsLifecycleProofPath ? `      <p><strong>Public package lifecycle:</strong> both 85.3.3 catalog bases passed fresh installs on separate, new kind clusters. The default base matched 124 checked chart objects; the no-crds base matched 114. Each run applied ten CRDs first, ran the chart's certificate and webhook patch Jobs, checked six workloads, and cleaned up. Argo CD and Flux then installed the 85.3.3 no-crds staged OCI and upgraded it to the 86.1.0 staged digest on separate clusters. Both replaced the completed setup Jobs and passed the runtime checks after upgrade. Open the <a href="../../${kpsLifecycleProofPath}">default direct receipt</a>${kpsNoCrdsLifecycleProofPath ? `, the <a href="../../${kpsNoCrdsLifecycleProofPath}">no-crds direct receipt</a>` : ""}${kpsPublicPackageProofPath ? `, the <a href="../../${kpsPublicPackageProofPath}">anonymous pull proof</a>` : ""}${kpsGitOpsLifecycleProofPath ? `, or the <a href="../../${kpsGitOpsLifecycleProofPath}">Argo CD and Flux proof</a>` : ""}. The controller receipt is limited to this version pair and does not prove rollback, long soak, or automatic ConfigHub route selection.</p>` : kpsGitOpsLifecycleProofPath ? `      <p><strong>Tested upgrade target:</strong> the 86.1.0 package carries its own checked CRDs and admission setup files. Argo CD and Flux each upgraded the 85.3.3 no-crds staged OCI to the 86.1.0 staged digest, replaced both completed setup Jobs, and passed the runtime checks. This is a bounded upgrade result, not a standalone 86.1.0 fresh-install claim. Open the <a href="../../${kpsGitOpsLifecycleProofPath}">Argo CD and Flux proof</a>.</p>` : ""}
      ${lifecycleByVariantEntry
        ? whoRunsVariantTables(lifecycleByVariantEntry, gitopsRouteEmissionEntry)
        : lifecycleRows.length
          ? markdownLikeTable([
              ["Behavior", "Route", "Who runs it", "Off-ramps", "Safe to automate?"],
              ...lifecycleRows,
            ])
          : lifecyclePolicyRows.length
            ? markdownLikeTable([
                ["Base or route", "Status", "What must be shown"],
                ...lifecyclePolicyRows,
              ])
            : dispositionActionRows.length
              ? markdownLikeTable([
                  ["Modeled action area", "Current status"],
                  ...dispositionActionRows,
                ], { rawSecondColumn: true })
              : "<p>No chart-specific action is attached to this page yet. That is not a claim that the upstream chart has no hooks or setup work. It means the public catalog has no per-chart-base variant action to show here; check the Helm Ops Catalog filters, the matrix, or send a problem chart if hook behavior should be modeled.</p>"}
    </section>

    <section aria-labelledby="production">
      <h2 id="production">Production Boundary</h2>
      <p>A green render or local live result is not a production support claim. Production support is target-scoped and uses the support-decision artifact when present.</p>
      ${markdownLikeTable([
        ["Field", "Value"],
        ["Production disposition", production?.production_support ?? entry.production_readiness],
        ["Target-scoped support decision", support?.decision ?? "not recorded"],
        ["Supported base", support?.supported_base ?? ""],
        ["Target scope", humanTargetScope(support?.target_scope)],
        ["Accepted dispositions", acceptedDispositions.join("; ") || "none recorded"],
        ["Open policy dispositions", openDispositions.join("; ") || "none recorded for this policy checklist"],
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
  <footer>${generatedStamp(catalog, "chart status page")}<p>Generated from helm-expt proof data. Check current receipts before making production claims.</p></footer>
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
  if (entry.chart === "bitnami/nginx" && entry.version === "24.0.2") {
    return `<section aria-labelledby="nginx-byo-teaching">
      <h2 id="nginx-byo-teaching">Bring Your Own Values</h2>
      <p>This worked example starts with a NGINX values file supplied by a person or coding agent. The requested change is three replicas. The same file also embeds an API key, removes the checked image digest, exposes a public LoadBalancer, and weakens three container security settings.</p>
      <p>The review keeps the three replicas, restores the checked settings, and changes the Deployment to use an existing Secret. The proof freshly renders the locked chart, matches the catalog baseline, reports the six intended findings, packages the five reviewed objects as OCI, pulls them anonymously, and imports the same object set into ConfigHub. A live run then deploys that result through Argo CD. Development changes to four replicas, ConfigHub promotes the change to staging, and a second live run reaches 4/4 ready replicas.</p>
      ${markdownLikeTable([
        ["Question", "Answer in this example"],
        ["What do I start with?", `<a href="../../examples/byo-helm-values/ai-values.yaml">The supplied values file</a> and the locked NGINX 24.0.2 chart.`],
        ["What changed?", `<a href="../../data/byo-helm-values-review/summary.md">The plain-English review</a> and <a href="../../data/byo-helm-values-review/review.yaml">structured findings</a>.`],
        ["What would Kubernetes receive?", `<a href="../../data/byo-helm-values-review/reviewed-render.yaml">Five reviewed objects</a>.`],
        ["Can I use OCI?", `<a href="../../data/byo-helm-values-review/public-and-confighub.md">The public digest, anonymous pull, and ConfigHub import record</a>.`],
        ["Did the reviewed result run?", `<a href="../../data/byo-helm-values-deploy-proof/summary.md">Yes. Argo CD synced it and NGINX reached 3/3 ready replicas</a>.`],
        ["Can I change and promote it?", `<a href="../../data/byo-helm-values-promotion-proof/summary.md">Yes. The base stayed at three replicas; development changed to four; staging received the promoted revision</a>.`],
        ["Did staging run?", `<a href="../../data/byo-helm-values-staging-deploy-proof/summary.md">Yes. Argo CD synced the promoted release and NGINX reached 4/4 ready replicas</a>.`],
        ["What remains?", "The target Secret is still supplied separately. Flux, rollback, chart upgrade, and fleet rollout have not run for this configuration."],
      ], { rawSecondColumn: true })}
      <p>Repeat the local proof with <code>HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROOF=1 npm run byo-helm-values:run</code>.</p>
    </section>`;
  }
  if (entry.chart === "bitnami/redis" && entry.version === "25.5.3") {
    return `<section aria-labelledby="redis-teaching">
      <h2 id="redis-teaching">Redis Proof Slice</h2>
      <p>Redis is a compact example of a decision that matters before install. The chart's normal default renders password material. The catalog recommends <code>reuse-existing-secret</code>, which records the Secret name and key but keeps the password out of the rendered files and OCI.</p>
      <div class="grid">
        <div class="card"><h3>Normal Helm</h3><pre><code>kubectl create namespace redis
kubectl -n redis create secret generic redis-existing-secret \\
  --from-literal=redis-password="$(openssl rand -base64 32)"
helm install redis oci://registry-1.docker.io/bitnamicharts/redis \\
  --version 25.5.3 --namespace redis \\
  --set auth.existingSecret=redis-existing-secret \\
  --set auth.existingSecretPasswordKey=redis-password \\
  --set image.digest=${REDIS_IMAGE_DIGEST}</code></pre><p>Helm receives the password from a Secret created separately.</p></div>
        <div class="card"><h3>cub installer</h3><pre><code>cub installer setup --pull ${REDIS_INSTALLER_OCI_REF} \\
  --base reuse-existing-secret --work-dir ./redis-reviewed \\
  --non-interactive --namespace redis \\
  --output-oci ./redis-rendered.oci</code></pre><p>You can inspect the 13 chart objects before apply. cub adds an explicit Namespace and writes the same non-secret object set as OCI.</p></div>
        <div class="card"><h3>ConfigHub</h3><pre><code>cub installer upload --work-dir ./redis-reviewed \\
  --space helm-redis-reviewed</code></pre><p>Upload when you want the objects kept as Units for variants, diffs, promotions, and later releases.</p></div>
      </div>
      <p><a href="../../data/serverless-install-parity-proof/summary.md">See the 13/13 live Helm comparison</a> · <a href="../try.html">Open Get Started</a> · <a href="../../docs/user/expected-results-and-clusters.md">Expected results and clusters</a></p>
    </section>`;
  }
  if (entry.chart === "prometheus-community/prometheus" && entry.version === "29.8.0") {
    return `<section aria-labelledby="prometheus-teaching">
      <h2 id="prometheus-teaching">Prometheus Teaching Path</h2>
      <p>Use Prometheus when you want a familiar public chart without starting with Bitnami image questions. The <code>server-only-ephemeral</code> base is the small teaching path; the default base remains in the catalog for broader chart coverage.</p>
      <div class="grid">
        <div class="card"><h3>Normal Helm</h3><pre><code>helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/prometheus --version 29.8.0 --namespace monitoring --create-namespace</code></pre><p>You should see Helm create a Prometheus release and Kubernetes objects in the namespace.</p></div>
        <div class="card"><h3>cub installer</h3><pre><code>cub installer setup --pull ${PROMETHEUS_INSTALLER_OCI_REF} --base server-only-ephemeral --work-dir ./prometheus-server-only --non-interactive --namespace monitoring</code></pre><p>You should see rendered manifests in the work directory, ready to inspect before delivery.</p></div>
        <div class="card"><h3>ConfigHub</h3><pre><code>cub installer upload --work-dir ./prometheus-server-only --space helm-prometheus-server-only</code></pre><p>You should see Prometheus Units in ConfigHub. Derived variants can start from that uploaded base.</p></div>
      </div>
      <p><a href="../try.html">Open Get Started</a> · <a href="../../docs/user/expected-results-and-clusters.md">Expected results and clusters</a></p>
    </section>`;
  }
  if (entry.chart === "prometheus-community/kube-prometheus-stack") {
    return `<section aria-labelledby="kps-teaching">
      <h2 id="kps-teaching">Serious Chart Example</h2>
      <p>kube-prometheus-stack is the serious-chart example. Its fresh install needs ten CRDs, certificate setup, webhook patching, ordinary Kubernetes objects, readiness checks, and cleanup in a particular order.</p>
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
      <p>${entry.version === "85.3.3" ? "The public package has run that full fresh-install sequence. A separate isolated client pulled the same package with no ConfigHub account or registry login and received all nine lifecycle files. The <code>no-crds</code> base also ran from one staged OCI digest through Argo CD and Flux on separate fresh clusters, then upgraded to the 86.1.0 staged digest. Both controllers reran the ordered stages, replaced the completed setup Jobs, and reached the six checked workloads after upgrade." : "The 86.1.0 public package carries its own checked CRDs and admission setup files. An isolated client pulled and rendered it without a ConfigHub account or registry login. It then served as the tested upgrade target for the 85.3.3 <code>no-crds</code> staged OCI through both Argo CD and Flux. This does not claim a standalone 86.1.0 fresh install."} ConfigHub does not yet select the route automatically, and the receipt does not prove rollback or long-running soak.</p>
      <p><a href="../../data/kps-lifecycle-route-proof/summary.md">Open the package lifecycle proof</a> · <a href="../../data/kps-gitops-lifecycle-proof/summary.md">Open the Argo CD and Flux proof</a> · <a href="../../data/kps-public-package-proof/summary.md">Check the anonymous pull</a> · <a href="../../docs/demo/hooks-crds/kube-prometheus-stack.md">Read the hooks and CRDs guide</a> · <a href="../../docs/user/serious-chart-proof.md">Open serious chart proof</a></p>
    </section>`;
  }
  if (entry.chart === "argo-cd/argo-workflows" && entry.version === "1.0.14") {
    return `<section aria-labelledby="argo-workflows-teaching">
      <h2 id="argo-workflows-teaching">Argo Workflows CRDs</h2>
      <p>The normal Helm install runs a hook that downloads eight full CRD files from GitHub and applies them before the controller and server. Those CRDs are not in the ordinary rendered release, so another delivery path has to replace that step deliberately.</p>
      <p>The catalog package contains the exact eight files used by this chart version. Their source URLs and digests are recorded. The no-account script applies them with the same server-side, force-conflicts mode as the Helm hook, waits for them to become established, and then applies the ordinary objects.</p>
      ${markdownLikeTable([
        ["Choice", "What happens"],
        ["<code>default</code>", "Uses the full upstream CRD schemas. The package applies the locked CRD bundle before the workloads."],
        ["<code>minimal-crds</code>", "Renders eight smaller CRDs as ordinary objects. This avoids the hook but uses looser schemas that preserve unknown fields."],
        ["Argo CD or Flux", "Ordering still needs its own controller-specific proof. The direct package result does not claim either controller ran this step automatically."],
      ], { rawFirstColumn: true })}
      <p>Two clean kind clusters checked the direct path: Helm ran its real hook in one, the catalog package ran its CRD action in the other, all eight live CRD specifications matched, the 19 ordinary objects matched, and both workloads became ready.</p>
      <p><a href="../../docs/demo/hooks-crds/argo-workflows.md">Read the plain-English guide and repeat the test</a> · <a href="../../runs/live-kind-parity/argo-cd-argo-workflows-default/receipt.yaml">Open the receipt</a></p>
    </section>`;
  }
  return "";
}

function matrixRowKindLabel(kind) {
  const labels = {
    source: "Source",
    base: "Base",
    candidate: "Candidate",
    derived: "Variant",
  };
  return labels[kind] || "Option";
}

function matrixRowPurpose(row) {
  if (row.custom_discussion === "yes") return "Needs human review before use";
  if (row.row_kind === "source") return "Upstream chart source";
  if (row.row_kind === "candidate") return "Candidate path, not ready yet";
  if (row.row_kind === "derived") return "Derived ConfigHub variant";
  if (row.catalog_layer === "F2b") return "Runnable base variant";
  if (row.customization_layer) return humanizeReasonList(row.customization_layer);
  if (row.adoption_bucket) return humanizeReasonList(row.adoption_bucket);
  return "Catalog option";
}

function matrixRowStatusLabel(row) {
  const raw = String(row.row_status || "").trim();
  const labels = {
    real: "Available in the catalog",
    "real-needs-work": "Needs more work before this is a ready path",
    candidate: "Candidate path",
    "candidate-custom-discussion": "Candidate path",
    planned: "Planned path",
    watch: "Watch: visible but not fully proved",
    blocked: "Blocked until the named issue is resolved",
  };
  const base = labels[raw] || (raw ? humanizeReasonList(raw) : "Status not recorded");
  return row.custom_discussion === "yes" ? `${base}; human review needed` : base;
}

function matrixEvidenceLabel(value) {
  const raw = String(value || "").trim();
  const labels = {
    "derived-variant-clone": "ConfigHub variant clone evidence",
    "target-bound-derived": "Target-bound derived variant receipt",
    "live-parity": "Live Helm-vs-ConfigHub comparison receipt",
    "render-parity": "Helm render parity receipt",
    "in-confighub-proof": "ConfigHub upload and variant receipt",
    "source-lock": "Pinned chart source and dependency lock",
    "candidate-plan": "Planning evidence only",
    "not recorded": "No evidence recorded yet",
  };
  return labels[raw] || (raw ? humanizeReasonList(raw) : "No evidence recorded yet");
}

function humanizeNextAction(value) {
  const text = String(value || "").trim();
  const labels = {
    "target-bound-derived-variant": "Create this as a ConfigHub variant after the base has been uploaded.",
    "derived-variant-target-bound": "Use the derived-variant receipt for this downstream target.",
    "keep receipt fresh when the upstream base changes": "Refresh the receipt when the upstream base changes.",
    "keep the target-bound derived variant receipt fresh when the source base or target changes": "Refresh the receipt when the source base or target changes.",
  };
  return labels[text] || humanizeReasonList(text);
}

function humanizeReasonList(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((item) => humanizeReasonToken(item.trim()))
    .filter(Boolean)
    .join("; ");
}

function humanizeReasonToken(token) {
  const labels = {
    "namespace-mutation-not-yet-modeled": "Namespace changes are not modeled for this variant yet.",
    "redis-secret-delivery-not-yet-modeled": "Redis Secret delivery is not modeled for this variant yet.",
    "not-applicable-derived-variant": "This check does not apply to a derived variant.",
    "target-bound-derived-variant": "This is a target-bound derived variant.",
    "derived-target-variant": "This is a downstream target variant.",
    "derived-variant": "Derived variant.",
    "try-from-public-catalog": "Try from the public catalog.",
    "generated-facts": "Generated facts.",
    "cluster-rbac": "Cluster RBAC.",
    "stateful-storage": "Stateful storage.",
  };
  if (!token || token === "-") return "";
  return labels[token] || sentenceCase(token.replaceAll("_", " ").replaceAll("-", " "));
}

function sentenceCase(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function renderIntentForRow(catalog, row) {
  if (row.row_kind !== "base") return null;
  return catalog.helmRenderIntents.find((intent) =>
    intent.chart === row.chart
      && intent.version === row.version
      && intent.base === row.variant) ?? null;
}

function renderIntentValuesLink(intent) {
  const path = String(intent?.values_profile || "").trim();
  if (!path) return "No values profile is recorded.";
  return `<a href="../../${escapeHtml(path)}">${escapeHtml(path.split("/").at(-1))}</a>`;
}

function renderIntentInstallWorkSummary(intent) {
  const prerequisites = Number(intent?.target_requirement_count || 0);
  const routes = Number(intent?.lifecycle_route_count || 0);
  const parts = [];
  if (prerequisites > 0) {
    parts.push(`${prerequisites} prerequisite${prerequisites === 1 ? "" : "s"}`);
  }
  if (routes > 0) {
    parts.push(`${routes} hook or setup route${routes === 1 ? "" : "s"}`);
  }
  if (parts.length) return `${parts.join(" and ")} recorded.`;
  if (
    intent?.lifecycle_contract_state === "no-route-required"
    && intent?.target_fact_contract_state === "no-target-facts-required"
  ) {
    return "No separate install work is required.";
  }
  return "No separate work is recorded; read the prerequisite and lifecycle status before assuming none is needed.";
}

function lifecycleContractText(intent, packagedActions = []) {
  if (!intent) return "No render-intent record is available for this base.";
  if (intent.lifecycle_contract_state === "attached") {
    const count = Number(intent.lifecycle_route_count || 0);
    return `${count} chart-specific lifecycle route${count === 1 ? " is" : "s are"} recorded. The full record separates direct, Argo CD, and Flux handling and says which paths have actually run.`;
  }
  if (packagedActions.length > 0) {
    return `The package contains ${packagedActions.length === 1 ? "a setup action" : `${packagedActions.length} setup actions`} that the generated try script runs before apply. Controller-specific execution is claimed only when that path has its own receipt.`;
  }
  if (intent.lifecycle_contract_state === "no-route-required") {
    return "The current review found no separate hook or setup route for this base.";
  }
  if (Number(intent.lifecycle_route_count || 0) > 0) {
    return `${intent.lifecycle_contract_reason} Run the lifecycle checks for this chart version before treating the routes as current proof.`;
  }
  return `${intent.lifecycle_contract_reason} Decide how the work should run with direct commands, Argo CD, and Flux, then record the result.`;
}

function targetContractText(intent) {
  if (!intent) return "No render-intent record is available for this base.";
  if (["attached", "attached-with-observed-actions"].includes(intent.target_fact_contract_state)) {
    const requirements = Number(intent.target_requirement_count || 0);
    const actions = Number(intent.target_fact_action_count || 0);
    return `${requirements} prerequisite${requirements === 1 ? " is" : "s are"} declared for this base${actions ? `, with ${actions} follow-up action record${actions === 1 ? "" : "s"} from live tests` : ""}. Each prerequisite says whether it must be checked before render or before apply.`;
  }
  if (intent.target_fact_contract_state === "no-target-facts-required") {
    return "This base explicitly records that it needs no separate target prerequisite.";
  }
  const actions = Number(intent.target_fact_action_count || 0);
  if (actions > 0) {
    return `${actions} live test record${actions === 1 ? "" : "s"} found missing setup, but this base does not yet record what the target must provide. Add the prerequisite to the base and rerun the test.`;
  }
  return "This base has not yet been reviewed for required Secrets, CRDs, namespaces, values, storage services, external APIs, or target topology. Record what it needs, or record that nothing extra is required.";
}

function resolvedPrerequisiteQueue(row, intent, reason) {
  return Boolean(
    row
    && intent
    && row.lane_live_dual_parity === "yes"
    && ["attached", "attached-with-observed-actions"].includes(intent.target_fact_contract_state)
    && /target-prerequisite|CRDs? missing/i.test(String(reason ?? "")),
  );
}

function currentPathReason(row, intent, reason) {
  if (resolvedPrerequisiteQueue(row, intent, reason)) {
    return "The required CRD setup is now recorded, and the end-to-end Helm and ConfigHub comparison passed. The older two-cluster test still needs to be repeated with that setup.";
  }
  return humanizeReasonList(reason) || "No blocking reason recorded.";
}

function currentPathNextAction(row, intent, nextAction, reason) {
  if (resolvedPrerequisiteQueue(row, intent, reason)) {
    return "Repeat the older two-cluster test with the recorded setup.";
  }
  return humanizeNextAction(nextAction || "No next action recorded.");
}

function matrixRowCard(row, entry, catalog) {
  const title = row.variant || "(unnamed)";
  const command = matrixRowRunPath(row, entry);
  const scriptDir = presetScriptDir(entry, row);
  const scriptLinks = scriptDir
    ? `<a href="../${scriptDir}/try.sh">try.sh</a> renders, settles the prerequisites in order, and applies with kubectl; <a href="../${scriptDir}/confighub.sh">confighub.sh</a> renders and uploads to your ConfigHub Space.`
    : "";
  const nextAction = cleanPageActionText(row.active_proof_next_step || row.next_action || row.variant_promotion_next_action || row.candidate_required_before || "");
  const reason = cleanPageActionText(row.active_proof_reason || row.variant_promotion_reason || row.hard_gap || "");
  const rowLinks = matrixRowLinks(row, catalog);
  const renderIntent = renderIntentForRow(catalog, row);
  const packagedActions = packagedSetupActions(entry, row);
  const humanReason = reason ? currentPathReason(row, renderIntent, reason) : "";
  const humanNextAction = currentPathNextAction(row, renderIntent, nextAction, reason);
  const renderIntentLink = renderIntent?.intent_path
    ? ` <a href="../../${escapeHtml(renderIntent.intent_path)}">Open the full record.</a>`
    : "";
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
          <span class="row-kind">${escapeHtml(matrixRowKindLabel(row.row_kind))}</span>
        </div>
        <p class="row-purpose">${escapeHtml(matrixRowPurpose(row))}</p>
        <dl>
          <dt>Status</dt><dd>${escapeHtml(matrixRowStatusLabel(row))}</dd>${renderIntent ? `
          <dt>Helm values</dt><dd>${renderIntentValuesLink(renderIntent)}</dd>
          <dt>ConfigHub changes</dt><dd>None in this catalog base. After upload, read Unit revision history or the derived variant.</dd>` : ""}
          <dt>How to run</dt><dd>${command}</dd>${scriptLinks ? `
          <dt>Scripts</dt><dd>${scriptLinks}</dd>` : ""}
          <dt>Evidence</dt><dd>${escapeHtml(matrixEvidenceLabel(row.strongest_evidence || row.outcome_level || ""))}</dd>
          <dt>Hooks/actions</dt><dd>${escapeHtml(matrixHookSummary(row, packagedActions))}</dd>
          <dt>Who runs actions?</dt><dd>${escapeHtml(matrixActionOwnerSummary(row, packagedActions))}</dd>${renderIntent ? `
          <dt>Lifecycle record</dt><dd>${escapeHtml(lifecycleContractText(renderIntent, packagedActions))}${renderIntentLink}</dd>
          <dt>Prerequisites</dt><dd>${escapeHtml(targetContractText(renderIntent))}</dd>` : ""}
          <dt>Next</dt><dd>${escapeHtml(humanNextAction)}</dd>
          ${humanReason ? `<dt>Reason</dt><dd>${escapeHtml(humanReason)}</dd>` : ""}
        </dl>
        <div class="lane-strip" aria-label="Proof lanes for ${escapeHtml(title)}">
          ${laneBadges.map(([code, label, value]) => lanePill(code, label, value)).join("")}
        </div>
        ${rowLinks.length ? `<p class="row-links">${rowLinks.join(" · ")}</p>` : ""}
      </article>`;
}

function cleanPageActionText(value) {
  return String(value ?? "").replace(/\b([a-z][a-z-]*): unknown\b/g, (_match, action) => {
    const label = UNKNOWN_ACTION_LABELS[action];
    return label ?? action.replaceAll("-", " ");
  });
}

function matrixRowRunPath(row, entry, options = {}) {
  const htmlOutput = options.html !== false;
  const format = (text) => htmlOutput ? `<code>${escapeHtml(text)}</code>` : text;
  if (row.row_kind === "source") {
    return "This is the upstream chart source. Choose a base card below before running the installer.";
  }
  if (row.row_kind === "candidate") {
    const required = row.candidate_required_before || row.next_action || "finish the candidate work order";
    return `Not ready to run yet. First: ${escapeHtml(humanizeNextAction(cleanPageActionText(required)))}.`;
  }
  if (row.row_kind === "derived") {
    const parent = row.parent_base || "a reviewed base";
    const target = row.downstream_space || row.variant;
    return `A ConfigHub variant based on ${escapeHtml(parent)} for ${escapeHtml(target)}. Upload the base first, then create or promote this variant in ConfigHub.`;
  }
  if (row.package_base_path) {
    const packagePath = row.package_base_path.replace(/\/bases\/[^/]+$/, "");
    return format(installerSetupCommand(packagePath, row.variant, entry, row));
  }
  if (entry.package_path && row.variant && row.variant !== "(source)") {
    return format(installerSetupCommand(entry.package_path, row.variant, entry, row));
  }
  return "Review the matrix row before running this option.";
}

function installerSetupCommand(packagePath, variant, entry, row) {
  void packagePath;
  const namespace = entry.namespace ? ` --namespace ${entry.namespace}` : "";
  return `cub installer setup --pull ${installerOciRefForEntry(entry)} --base ${variant} --work-dir ${presetWorkDir(entry, row)} --non-interactive${namespace}`;
}

function presetStem(entry, row) {
  return `${entry.chart}-${entry.version}-${row.variant || entry.start_variant || "default"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function presetWorkDir(entry, row) {
  return `./${presetStem(entry, row)}`;
}

function packagedSetupActions(entry, row) {
  const requirementScripts = packageRequirementsForBase(entry, row.variant)
      .map((requirement) => packagedRequirementPath(requirement.suggestedSource))
      .filter((path) => path.endsWith(".sh"));
  const lifecycleScripts = packageLifecycleActionsForBase(entry, row.variant)
    .map((action) => packagedRequirementPath(`package://${action.script ?? ""}`))
    .filter((path) => path.endsWith(".sh"));
  return [...new Set([...requirementScripts, ...lifecycleScripts])];
}

function matrixHookSummary(row, packagedActions = []) {
  const parts = [];
  if (row.hook_count) {
    const hookCount = Number(row.hook_count);
    parts.push(`${row.hook_count} source hook${hookCount === 1 ? "" : "s"}`);
  }
  if (row.hook_disposition) parts.push(`hook route: ${row.hook_disposition}`);
  if (row.hook_live_status && row.hook_live_status !== "n/a") {
    parts.push(`live action receipt: ${row.hook_live_status}`);
  }
  if (row.lifecycle_route_contract && row.lifecycle_route_contract !== "n/a") {
    const routeCount = Number(row.lifecycle_route_count || 0);
    parts.push(routeCount > 0
      ? `${routeCount} recorded lifecycle route${routeCount === 1 ? "" : "s"}`
      : "lifecycle route needs review");
  }
  if (packagedActions.length > 0) {
    parts.push(`packaged setup: ${packagedActions.join(", ")}`);
  }
  return parts.join("; ") || "No separate hook or action for this row.";
}

function splitSemicolonList(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item && item !== "-");
}

function matrixActionOwnerSummary(row, packagedActions = []) {
  const modes = String(row.lifecycle_route_execution_modes || "")
    .split(/[;,]/)
    .map((mode) => mode.trim())
    .filter(Boolean);
  if (!modes.length || modes.every((mode) => mode === "n/a")) {
    if (packagedActions.length > 0) {
      if (
        row.chart === "prometheus-community/kube-prometheus-stack"
        && row.version === "85.3.3"
      ) {
        return "The generated try script runs each packaged step at its recorded point. The no-crds base also has linked Argo CD and Flux receipts.";
      }
      return "The generated try script runs each packaged step at its recorded point. Argo CD and Flux need their own recorded route.";
    }
    if (row.hook_disposition && row.hook_disposition !== "n/a") return "read the route receipt before delivery";
    return "No separate action runner for this row.";
  }
  const labels = [...new Set(modes)].map((mode) => {
    const [name, count] = mode.split(":");
    const label = {
      "target-owned": "Kubernetes or the delivery controller",
      "user-executes": "You or your delivery pipeline",
      "confighub-executes": "ConfigHub",
    }[name] ?? executionModePlain(name);
    return count ? `${label} (${count})` : label;
  });
  const automatic = String(row.lifecycle_route_safe_automatic || "").toLowerCase();
  const suffix = automatic.includes("true")
    ? "the automatic run has a receipt"
    : "the full record shows which delivery paths have receipts";
  return `${labels.join(", ")}; ${suffix}`;
}

function matrixRowLinks(row, catalog) {
  const links = [];
  const maybe = (label, path) => {
    if (!path) return;
    links.push(`<a href="../../${escapeHtml(path)}">${escapeHtml(label)}</a>`);
  };
  if (row.row_kind === "base") {
    maybe("Demo README", helmCatalogReadmePath(catalog, row.chart, row.version, row.variant));
  }
  maybe("catalog", row.recipe_catalog_path);
  maybe("variant", row.variant_path);
  maybe("full YAML", renderedObjectsPathFromRevision(row.variant_revision_path));
  if (row.row_kind === "base" && row.chart && row.version && row.variant) {
    maybe("render intent", `data/helm-render-intents/intents/${helmRenderIntentFileName(row.chart, row.version, row.variant)}`);
    const baseRecordPath = `data/base-variant-records/records/${helmRenderIntentFileName(row.chart, row.version, row.variant)}`;
    if (existsSync(join(repoRoot, baseRecordPath))) maybe("base record", baseRecordPath);
    if (
      row.chart === "bitnami/nginx"
      && row.version === "24.0.2"
      && row.variant === "http-clusterip"
    ) {
      maybe("Argo, Flux, and direct receipt", CATALOG_OCI_DELIVERY_RECEIPT);
    }
  }
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
            <dt>Package OCI</dt><dd><code>${escapeHtml(installerOciRefForEntry(entry))}</code></dd>
            <dt>Source package</dt><dd><a href="../${escapeHtml(entry.package_path)}">${escapeHtml(entry.package_path)}</a></dd>
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

function helmRenderIntentFileName(chart, version, base) {
  return `${chart}-${version}-${base}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") + ".yaml";
}

function helmCatalogReadmeSlug(chart, version, base) {
  return `${chart}-${version}-${base}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function helmCatalogReadmePath(catalog, chart, version, base) {
  if (!chart || !version || !base) return "";
  const slug = helmCatalogReadmeSlug(chart, version, base);
  const row = (catalog.helmCatalogReadmes ?? []).find((item) => item.space === slug);
  return row?.source_path ?? "";
}

function productionSummaryForChart(catalog, entry) {
  return catalog.productionDisposition.find((row) => row.chart === entry.chart && row.version === entry.version);
}

function readLifecyclePolicy(recipePath) {
  if (!recipePath) return null;
  const path = join(repoRoot, recipePath, "lifecycle-policy.yaml");
  if (!existsSync(path)) return null;
  try {
    return readYaml(path);
  } catch {
    return null;
  }
}

function lifecyclePolicyTableRows(policy) {
  const bases = policy?.spec?.bases ?? {};
  const rows = [];
  for (const [base, detail] of Object.entries(bases)) {
    const status = detail?.status ?? "recorded";
    for (const route of detail?.supportedRoutes ?? []) {
      rows.push([
        `${base}: ${route.route}`,
        status,
        [route.description, evidenceNeededText(route.evidenceNeeded)].filter(Boolean).join(" "),
      ]);
    }
    if (!(detail?.supportedRoutes ?? []).length && (detail?.evidenceNeeded ?? []).length) {
      rows.push([
        base,
        status,
        evidenceNeededText(detail.evidenceNeeded),
      ]);
    }
  }
  return rows;
}

function evidenceNeededText(items) {
  if (!items?.length) return "";
  return `Evidence still needed before claiming this route: ${items.join(", ")}.`;
}

function productionDispositionActionRows(production) {
  if (!production) return [];
  const rows = [];
  const accepted = splitDisposition(production.accepted_dispositions);
  const open = splitDisposition(production.open_dispositions);
  if (accepted.length) rows.push(["Accepted action areas", accepted.join("; ")]);
  if (open.length) rows.push(["Open action areas", open.join("; ")]);
  if (production.lifecycle_policy_basis && production.lifecycle_policy_basis !== "none") {
    rows.push(["Lifecycle basis", escapeHtml(production.lifecycle_policy_basis)]);
  }
  if (production.lifecycle_observation_receipts) {
    rows.push(["Lifecycle observations", pathLinks(production.lifecycle_observation_receipts)]);
  }
  if (production.production_disposition_receipts) {
    rows.push(["Disposition receipts", pathLinks(production.production_disposition_receipts)]);
  }
  return rows;
}

function pathLinks(value) {
  return splitDisposition(value)
    .map((path) => `<a href="../../${escapeHtml(path)}">${escapeHtml(path)}</a>`)
    .join("<br>");
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
      "Direct-apply upgrades need an explicit prune rule",
      `Plain <code>kubectl apply</code> leaves removed objects behind. Use Argo CD or Flux for controller-managed pruning, or use a direct path whose ownership and pruning behavior have their own receipt.`,
    ],
    [
      "server-side apply conflicts need a readable choice",
      `A manual live edit can conflict on re-apply. A direct path must show who owns the field and let the operator choose which value should win.`,
    ],
  ];
}

function chartAdoptionCaveatHtml(caveat, requirements = [], routes = []) {
  const packagedCrds = requirements.filter((requirement) =>
    String(requirement.name ?? "").startsWith("CRD ")
    && Boolean(packagedRequirementPath(requirement.suggestedSource)),
  );
  const crdRoute = routes.find((route) =>
    route.quirk_class === "crd-install"
    || route.route_name?.includes("crd")
    || /\bCRDs?\b/.test(route.operatingDetails ?? ""),
  );
  if (!caveat && !packagedCrds.length && !crdRoute) {
    return `<section aria-labelledby="adoption-caveats">
      <h2 id="adoption-caveats">First-Run Caveats</h2>
      <p>No chart-specific password or CRD caveat is recorded for this chart. For direct delivery, define how removed objects are pruned and how field conflicts are resolved. Argo CD and Flux can own those reconciliation jobs when their delivery path is recorded for the selected preset.</p>
      <p><a href="../../data/cub-adoption-caveats/summary.html">Open the all-chart adoption caveats</a> · <a href="../../docs/user/helm-to-cub-migration.md">Helm to cub migration</a></p>
    </section>`;
  }
  const hasPassword = caveat?.bakes_shared_password === "yes";
  const hasCrds = caveat?.ships_crds === "yes" || packagedCrds.length > 0 || Boolean(crdRoute);
  const crdInstruction = packagedCrds.length
    ? `Yes. ${packagedCrds.length} CRD${packagedCrds.length === 1 ? "" : "s"} must exist first. The public package contains the bootstrap, and its generated <code>try.sh</code> applies it and waits for the CRDs before installing the main objects.`
    : crdRoute
      ? `Yes. ${escapeHtml(crdRoute.operatingDetails || "Follow the recorded CRD setup step before applying the main objects.")}`
      : `Yes. ${escapeHtml(caveat?.crd_count || "Some")} CRD object(s) are recorded. Follow the preset's recorded route: apply CRDs first and wait, use a controller-specific ordering rule, or choose the separable CRD base ${caveat?.crd_separable_base ? `<code>${escapeHtml(caveat.crd_separable_base)}</code>` : "when one is available"}.`;
  const rows = [
    ["Universal caveats", `Use declared inputs or bases instead of Helm <code>--set</code>. For direct delivery, define pruning and field-conflict behavior. Use Argo CD or Flux when that controller path is recorded for the selected preset.`],
    [
      "Shared placeholder password",
      hasPassword
        ? `Yes. Password keys: <code>${escapeHtml(caveat?.password_keys || "recorded")}</code>. Use base <code>${escapeHtml(caveat?.password_fix_base || "existing-secret")}</code> and stage your own Secret. Example: <code>${escapeHtml(caveat?.password_fix_command || "kubectl create secret ...")}</code>.`
        : "No shared placeholder password caveat recorded for this chart.",
    ],
    [
      "CRD first-ordering",
      hasCrds
        ? crdInstruction
        : "No CRD first-ordering caveat recorded for this chart.",
    ],
  ];
  return `<section aria-labelledby="adoption-caveats">
      <h2 id="adoption-caveats">First-Run Caveats</h2>
      <p>Some chart paths need a small preparation step before the cub path feels as smooth as Helm. We show those steps here so the first run does not surprise you.</p>
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
      command: "helm template",
      path: "direct-render",
    },
    {
      goal: "Load rendered files or a literal configuration OCI into ConfigHub Units.",
      command: "cub variant upload <files-or-oci-ref>",
      path: "one-shot-configHub-load",
    },
    {
      goal: "Adopt an existing Argo, Flux, KRM, or rendered-manifest app.",
      command: "cub gitops discover/import, cub unit import, or managed import",
      path: "existing-app-adoption",
    },
    {
      goal: "Use a maintained catalog entry with supported bases and proof.",
      command: "cub installer setup --pull oci://... --base <base>",
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
  const firstColumnRule = options.firstColumnWidthCh
    ? `\n        th:first-child, td:first-child { min-width: ${Number(options.firstColumnWidthCh).toFixed(0)}ch; }`
    : "";
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
        th { color: var(--muted); font-weight: 600; }${firstColumnRule}
      </style>`;
}

function formatTableCell(cell, index, options) {
  if (options.rawFirstColumn && index === 0) return String(cell ?? "");
  if (options.rawSecondColumn && index === 1) return String(cell ?? "");
  if (options.rawThirdColumn && index === 2) return String(cell ?? "");
  if (options.rawFourthColumn && index === 3) return String(cell ?? "");
  if (options.rawFifthColumn && index === 4) return String(cell ?? "");
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

function homePageCss() {
  return `
    .install-compare {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0;
    }
    .home-hero {
      padding: 20px 20px;
    }
    .home-hero .experiment-banner {
      padding: 6px 10px;
      font-size: .82rem;
    }
    .home-hero .lead {
      max-width: 830px;
      font-size: 1.03rem;
    }
    .home-hero .secondary-lead {
      color: var(--muted);
      font-size: .96rem;
    }
    .home-hero .home-terminal {
      margin-top: 22px;
      max-width: 900px;
    }
    .term-catch {
      display: inline-block;
      width: 100%;
      margin: 2px 0;
      padding: 2px 6px;
      border-left: 3px solid #f0c36d;
      background: rgba(240,195,109,.18);
      color: #ffe3a1;
      font-weight: 700;
    }
    .terminal-caption {
      margin: 0;
      padding: 10px 14px;
      border-top: 1px solid var(--line);
      background: var(--panel);
      color: var(--muted);
      font-size: .9rem;
    }
    .ai-proof {
      margin-top: 14px;
      max-width: 760px;
      color: #374151;
      font-size: .96rem;
    }
    .value-callout {
      margin: 18px 0 0;
      padding: 16px 18px;
      max-width: 760px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      text-align: center;
    }
    .value-callout p {
      margin: 0;
      max-width: none;
      color: var(--ink);
      font-size: 1rem;
      line-height: 1.4;
      font-weight: 600;
    }
    .value-callout p + p {
      margin-top: 3px;
      padding-top: 0;
      border-top: 0;
    }
    .audience-block {
      max-width: 920px;
      margin-top: 24px;
    }
    .start-block {
      margin-top: 32px;
    }
    .start-block h2 {
      margin-top: 0;
      font-size: 2.1rem;
      line-height: 1.08;
    }
    .audience-block h2 {
      margin-top: 0;
      font-size: 2.1rem;
      line-height: 1.08;
    }
    .audience-note {
      margin-top: 16px;
      padding: 0 0 0 12px;
      border-left: 2px solid var(--line);
      background: transparent;
      color: var(--ink);
    }
    .audience-frame {
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      color: #374151;
      font-weight: 600;
    }
    .home-list {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 22px;
      margin-top: 18px;
    }
    .home-list-item {
      border-top: 1px solid var(--line);
      padding-top: 14px;
    }
    .home-list-item h3 {
      margin: 0 0 6px;
    }
    .home-list-item p {
      margin: 0;
      font-size: .9rem;
    }
    .home-list-item p + p {
      margin-top: 8px;
    }
    .home-hero .journey-flow {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      align-items: start;
      gap: 22px;
      margin: 24px 0 8px;
    }
    .home-hero .journey-step {
      border: 0;
      border-top: 1px solid var(--line);
      border-radius: 0;
      background: transparent;
      padding: 14px 0 0;
      gap: 7px;
      transition: none;
    }
    .home-hero .journey-step:hover {
      border-color: var(--line);
    }
    .home-hero .journey-step:hover h3 {
      color: var(--accent);
    }
    .home-hero .journey-step .go {
      margin-top: 4px;
    }
    .home-hero .journey-arrow {
      display: none;
    }
    @media (max-width: 980px) {
      .home-list { grid-template-columns: 1fr 1fr; }
      .home-hero .journey-flow { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .install-compare { grid-template-columns: 1fr; }
      .home-list { grid-template-columns: 1fr; }
      .home-hero .journey-step { padding: 12px 0 0; }
    }
  `;
}

function siteCss() {
  return `
    :root {
      color-scheme: light dark;
      --ink: #131a20;
      --muted: #56646f;
      --line: #d5dde2;
      --panel: #f3f6f8;
      --accent: #0b6e8f;
      --good: #1f8a4c;
      --warn: #b5761a;
      --bad: #c53a3a;
      --surface: #ffffff;
      --term: #0e1419;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --ink: #e8eef3; --muted: #97a5b0; --line: #253038; --panel: #151d25;
        --accent: #34a7c9; --good: #4bc07d; --warn: #e0a648; --bad: #ef7570; --surface: #0d1319;
      }
    }
    :root[data-theme="dark"] {
      --ink: #e8eef3; --muted: #97a5b0; --line: #253038; --panel: #151d25;
      --accent: #34a7c9; --good: #4bc07d; --warn: #e0a648; --bad: #ef7570; --surface: #0d1319;
    }
    :root[data-theme="light"] {
      --ink: #131a20; --muted: #56646f; --line: #d5dde2; --panel: #f3f6f8;
      --accent: #0b6e8f; --good: #1f8a4c; --warn: #b5761a; --bad: #c53a3a; --surface: #ffffff;
    }
    * { box-sizing: border-box; }
    input, select, textarea { background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; }
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
      background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(6px);
      border-bottom: 1px solid var(--line);
      font-size: .9rem;
    }
    .topbar .brand {
      font-weight: 700; color: var(--ink); text-decoration: none; letter-spacing: 0;
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 11px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
    }
    .topbar .brand:hover { color: var(--accent); border-color: var(--accent); }
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
    .experiment-banner a {
      color: inherit;
      text-decoration: underline;
    }
    .install-cub-note {
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
      font-size: .9rem;
      line-height: 1.55;
    }
    pre code { background: transparent; border: 0; padding: 0; color: inherit; }
    .lead, .tagline { font-size: 1.08rem; color: var(--ink); max-width: 880px; }
    .stat-strip { font-size: .9rem; color: var(--muted); background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; margin: 0 0 16px; }
    .stat-strip strong { color: var(--ink); }
    .hero-copy {
      max-width: 880px;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 20px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 9px 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      letter-spacing: 0;
    }
    .button.primary {
      color: #fff;
      background: var(--accent);
      border-color: var(--accent);
    }
    .button.secondary {
      color: var(--ink);
      background: var(--surface);
    }
    .button:hover {
      text-decoration: none;
      filter: brightness(.98);
    }
    .home-terminal {
      margin-top: 26px;
      width: 100%;
      max-width: 1080px;
    }
    .light-grid {
      margin-top: 16px;
    }
    .closing-line {
      margin-top: 18px;
      color: var(--ink);
      font-weight: 600;
    }
    .quiet-line {
      font-size: .9rem;
      color: var(--muted);
    }
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
    .door p { font-size: .9rem; margin: 0; }
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
    .journey-step p { font-size: .9rem; margin: 0; color: var(--muted); }
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
      padding: 10px 10px 10px 12px; font-size: .9rem; color: var(--ink); text-decoration: none;
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
    .tier h3 { font-size: 1.06rem; }
    .tier p { font-size: .9rem; margin: 0; }
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
    .metric span { display: block; margin-top: 7px; color: var(--muted); font-size: .78rem; }
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
    .faq-head h3 { margin: 0; font-size: 1.06rem; }
    .faq-status {
      flex: 0 0 auto;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 8px;
      font-size: .72rem;
      color: var(--muted);
      background: var(--panel);
    }
    .faq-card.later .faq-status { color: var(--warn); border-color: #efca92; background: #fff8ed; }
    .faq-card p { max-width: none; margin: 0; }
    .faq-links { margin-top: auto; font-size: .9rem; }
    .faq-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .faq-card table { font-size: .78rem; }
    .status { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .78rem; border: 1px solid var(--line); }
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
      font-size: .72rem;
      color: var(--muted);
      background: var(--panel);
      white-space: nowrap;
    }
    .row-purpose { margin: 0; font-size: .9rem; color: var(--muted); min-height: 2.6em; }
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
    .lane-pill b { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .72rem; line-height: 1; }
    .lane-pill em { font-style: normal; font-size: .72rem; line-height: 1.05; max-width: 100%; overflow-wrap: anywhere; }
    .lane-pill.yes { color: var(--good); border-color: #9bd3b8; background: #f0fbf5; }
    .lane-pill.watch { color: var(--warn); border-color: #efca92; background: #fff8ed; }
    .lane-pill.no { color: var(--bad); border-color: #f0aaa4; background: #fff3f2; }
    .lane-pill.todo { color: #335c87; border-color: #b5cbe1; background: #f0f6fc; }
    .lane-pill.na, .lane-pill.blank { color: var(--muted); background: #f3f4f6; }
    @media (prefers-color-scheme: dark) {
      .lane-pill.yes { border-color: #1f5a3a; background: #12291d; }
      .lane-pill.watch { border-color: #5a4a1e; background: #2c2213; }
      .lane-pill.no { border-color: #5a2a28; background: #2e1717; }
      .lane-pill.todo { color: #7fb0d8; border-color: #2b3f52; background: #16222e; }
      .lane-pill.na, .lane-pill.blank { background: #1b242d; }
    }
    :root[data-theme="dark"] .lane-pill.yes { border-color: #1f5a3a; background: #12291d; }
    :root[data-theme="dark"] .lane-pill.watch { border-color: #5a4a1e; background: #2c2213; }
    :root[data-theme="dark"] .lane-pill.no { border-color: #5a2a28; background: #2e1717; }
    :root[data-theme="dark"] .lane-pill.todo { color: #7fb0d8; border-color: #2b3f52; background: #16222e; }
    :root[data-theme="dark"] .lane-pill.na, :root[data-theme="dark"] .lane-pill.blank { background: #1b242d; }
    .row-links { margin: 0; font-size: .9rem; }
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
      pre { font-size: .85rem; }
      table { display: block; overflow-x: auto; white-space: nowrap; }
    }
`;
}

function calmPageCss() {
  return `
    .calm-page header.hero { padding-bottom: 18px; border-bottom: 1px solid var(--line); }
    .calm-page main section { padding-top: 8px; }
    .calm-page .grid, .calm-page .catalog, .calm-page .lanes, .calm-page .stage-grid, .calm-page .faq-list {
      gap: 22px;
      align-items: start;
    }
    .calm-page .card,
    .calm-page .metric,
    .calm-page .lane,
    .calm-page .faq-card,
    .calm-page .door,
    .calm-page .tier,
    .calm-page .matrix-row-card,
    .calm-page .move-card,
    .calm-page .node,
    .calm-page .consumer,
    .calm-page .app-step,
    .calm-page .op,
    .calm-page .route div,
    .calm-page .callout-section {
      border: 0;
      border-top: 1px solid var(--line);
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      padding: 14px 0 0;
    }
    .calm-page .metric strong { font-size: 1.4rem; }
    .calm-page .metric strong,
    .calm-page .kicker,
    .calm-page .eyebrow,
    .calm-page .generated,
    .calm-page .tier .stage,
    .calm-page .chain a::before,
    .calm-page .faq-status,
    .calm-page .row-layer,
    .calm-page .row-kind,
    .calm-page .lane-pill b,
    .calm-page .terminal-title {
      font-family: inherit;
    }
    .calm-page p code,
    .calm-page li code,
    .calm-page td code,
    .calm-page th code,
    .calm-page dd code,
    .calm-page .mono-line code {
      font-family: inherit;
      font-size: .92em;
    }
    .calm-page pre,
    .calm-page pre code,
    .calm-page .terminal-body,
    .calm-page .terminal-body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .calm-page .metric span,
    .calm-page .card p,
    .calm-page .lane p,
    .calm-page .faq-card p,
    .calm-page .op p {
      max-width: none;
    }
    .calm-page .faq-card.later { background: transparent; border-color: var(--line); }
    .calm-page .mini-visual,
    .calm-page .proof-frame {
      border-radius: 0;
      background: transparent;
      border-color: var(--line);
    }
    .calm-page .chain a,
    .calm-page .button.secondary,
    .calm-page .chips span {
      border-radius: 6px;
      background: transparent;
    }
    .calm-page .route,
    .calm-page .app-flow,
    .calm-page .move-spine {
      gap: 22px;
    }
  `;
}

function installPageCss() {
  return `
    .install-hero-grid {
      display: block;
      max-width: 1080px;
      margin: 0 auto;
    }
    .install-hero .hero-copy {
      max-width: 60ch;
      margin: 0 auto;
      text-align: center;
    }
    .eyebrow {
      margin: 0 0 10px;
      color: var(--accent);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
      font-size: .78rem;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .chips span {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 10px;
      color: var(--muted);
      background: var(--panel);
      font-size: .9rem;
    }
    .install-hero .terminal-card {
      margin-top: 28px;
      width: 100%;
    }
    .caption {
      margin: 18px auto 0;
      max-width: 60ch;
      text-align: center;
      color: var(--ink);
      font-weight: 600;
    }
    .narrow-section {
      max-width: 760px;
      margin: 48px auto 0;
      padding-top: 32px;
      border-top: 1px solid var(--line);
    }
    .narrow-section p { max-width: 60ch; }
    .callout-section {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 20px;
      background: var(--panel);
    }
    .callout-section h2 { margin-top: 0; }
    .step-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0;
    }
    .terminal-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--term);
      overflow: hidden;
    }
    .terminal-title {
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,.12);
      color: #b7c3cf;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .78rem;
      background: #111922;
    }
    .terminal-body {
      margin: 0;
      border: 0;
      border-radius: 0;
      background: var(--term);
    }
    .term-catch {
      display: inline-block;
      width: 100%;
      margin: 2px 0;
      padding: 2px 6px;
      border-left: 3px solid #f0c36d;
      background: rgba(240,195,109,.18);
      color: #ffe3a1;
      font-weight: 700;
    }
    .term-comment { color: #7f8b96; }
    .term-prompt { color: #78d99d; font-weight: 700; }
    .mono-line {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: .9rem;
      overflow-wrap: anywhere;
    }
    @media (max-width: 640px) {
      .step-grid { grid-template-columns: 1fr; }
      .narrow-section { margin-top: 34px; padding-top: 24px; }
      .callout-section { padding: 16px; }
      .install-hero .hero-copy { text-align: left; }
      .caption { text-align: left; }
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
Open \`site/how-it-works.html\` for the recipe, render, record, and route model.
Open \`site/try.html\` for the short try-now page.
Open \`site/testing.html\` for working starting, managed, platform, and App examples.
Open \`site/entry-path-reference.html\` for detailed Helm, AICR, OCI, and YAML commands.
Open \`site/variants.html\` for base variants, derived variants, and promotion entry points.
Open \`site/journey.html\` for Apps that use configuration already saved in ConfigHub.
Open \`site/custom-apps.html\` for deeper application examples with custom apps,
multi-chart stacks, and overlays.
Open \`site/existing-apps.html\` for adopting existing Helm, Argo, Flux,
rendered YAML, or live-cluster state without taking over too early.
Open \`site/ai.html\` for AI-assisted operations with ConfigHub review and evidence.
Open \`site/security.html\` for security, provenance, Secrets, scans, and evidence limits.
Open \`site/future.html\` for roadmap and managed ideas that should not be
confused with shipped public evidence.
Open \`site/operations.html\` for Ops: scans, gates, delivery, observation, adoption,
upgrades, rollback, bulk patching, and fleet questions.
Open \`site/day1-operations.html\` only as a compatibility redirect to \`site/operations.html\`.
Open \`site/docs.html\` for the public documentation hub.
Open \`../docs/user/installer-oci-packages.md\` for the catalog package OCI refs
that users pull with \`cub installer setup --pull oci://...\`.
${INSTALLER_COMMAND_NOTE}
Open \`site/verification.html\` for npm proof commands, fresh versus committed
evidence, and render-record-route.
Open \`site/d/data/helm-catalog-readmes/summary.html\` for the website-rendered
README index for the live \`helm-catalog\` demo org.
Open \`site/known-gaps.html\` for current watch findings the project surfaces deliberately.
Open \`site/hard-questions.html\` for the FAQ: hooks, upgrades,
custom values, target prerequisites, false-green sync, and refusal boundaries.
Open \`site/proof.html\` only as a deep reference for proof lanes, sceptic tests,
and refusal boundaries.
Open \`site/quirks.html\` for the short guide to chart quirks such as hooks,
CRDs, webhooks, generated facts, lookups, storage, and RBAC.
Open \`site/charts/index.html#actions\` for hooks and actions, including hook
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
