import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, posix } from "node:path";

import { check, listFiles, readYaml, repoRoot, sha256, write } from "./lib/proof-common.mjs";
import { installerOciDigestRef, installerOciRef } from "./lib/installer-oci.mjs";
import { evaluateKubaraSiteLiveEvidence } from "./lib/kubara-site-live-evidence.mjs";
import {
  AICR_CPU_STARTER_LOCAL_OCI_DIGEST,
  AICR_CPU_STARTER_SOURCE_DIGEST,
  AICR_CPU_STARTER_SOURCE_OCI_REF,
  aicrCpuStarterIntentSha256,
  aicrCpuStarterRecords,
  aicrCpuStarterTryScript,
} from "./lib/aicr-cpu-starter-public.mjs";
import {
  CONFIGURATION_QUESTIONS,
  CONFIGURATION_QUESTION_RESEARCH,
} from "./lib/configuration-questions.mjs";

const siteRoot = join(repoRoot, "site");
const chartPagesRoot = join(siteRoot, "charts");
const indexPath = join(siteRoot, "index.html");
const offeringPath = join(siteRoot, "offering.html");
const tryPath = join(siteRoot, "try.html");
const tryAicrPath = join(siteRoot, "try-aicr.html");
const aicrCpuStarterPublicReceiptPath = join(
  repoRoot,
  "runs",
  "aicr-cpu-starter-public-proof",
  "receipt.yaml",
);
const configHubPath = join(siteRoot, "confighub.html");
const redisWalkthroughPath = join(siteRoot, "redis-walkthrough.html");
const serverlessPath = join(siteRoot, "serverless.html");
const howItWorksPath = join(siteRoot, "how-it-works.html");
const deploymentReferencePath = join(siteRoot, "deployment-reference.html");
const variantsPath = join(siteRoot, "variants.html");
const customAppsPath = join(siteRoot, "custom-apps.html");
const existingAppsPath = join(siteRoot, "existing-apps.html");
const aiPath = join(siteRoot, "ai.html");
const securityPath = join(siteRoot, "security.html");
const testingPath = join(siteRoot, "testing.html");
const kubaraPath = join(siteRoot, "kubara.html");
const entryPathReferencePath = join(siteRoot, "entry-path-reference.html");
const futurePath = join(siteRoot, "future.html");
const operationsPath = join(siteRoot, "operations.html");
const guidesPath = join(siteRoot, "guides.html");
const askPath = join(siteRoot, "ask.html");
const promotePath = join(siteRoot, "promote.html");
const ignoredValuesPath = join(siteRoot, "why-did-helm-ignore-my-values.html");
const upstreamVersionPath = join(siteRoot, "did-this-chart-version-change.html");
const bitnamiSuccessorPath = join(siteRoot, "did-your-bitnami-chart-stop-pulling.html");
const fluxArgoPath = join(siteRoot, "deploy-with-flux-or-argo.html");
const environmentDifferencePath = join(siteRoot, "why-do-dev-and-prod-differ.html");
const approvedClusterPath = join(siteRoot, "does-cluster-match-approved-config.html");
const challengePath = join(siteRoot, "challenge.html");
const comparePath = join(siteRoot, "compare.html");
const whatsNewPath = join(siteRoot, "whats-new.html");
const docsPath = join(siteRoot, "docs.html");
const docsReferencePath = join(siteRoot, "docs-reference.html");
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
const changesJsonPath = join(siteRoot, "changes.json");
const changesSchemaPath = join(siteRoot, "changes.schema.json");
const changesSchemaSourcePath = join(repoRoot, "schemas", "config-workshop-changes.schema.json");
const reviewSchemaPath = join(siteRoot, "review.schema.json");
const reviewSchemaSourcePath = join(repoRoot, "schemas", "config-workshop-review.schema.json");
const workshopResultSchemaPath = join(siteRoot, "workshop-result.schema.json");
const workshopResultSchemaSourcePath = join(repoRoot, "schemas", "config-workshop-result.schema.json");
const workshopCiReportSchemaPath = join(siteRoot, "workshop-ci-report.schema.json");
const workshopCiReportSchemaSourcePath = join(repoRoot, "schemas", "config-workshop-ci-report.schema.json");
const promotionReviewSchemaPath = join(siteRoot, "promotion-review.schema.json");
const promotionReviewSchemaSourcePath = join(repoRoot, "schemas", "config-workshop-promotion-review.schema.json");
const configurationDecisionSchemaPath = join(siteRoot, "configuration-decision.schema.json");
const configurationDecisionSchemaSourcePath = join(repoRoot, "schemas", "configuration-decision.schema.json");
const checkConfigScriptPath = join(siteRoot, "check-config.js");
const checkConfigScriptSourcePath = join(repoRoot, "scripts", "site", "check-config-browser.js");
const promoteConfigScriptPath = join(siteRoot, "promote-config.js");
const promoteConfigScriptSourcePath = join(repoRoot, "scripts", "site", "promote-config-browser.js");
const workshopYamlScriptPath = join(siteRoot, "config-workshop-yaml.js");
const workshopYamlScriptSourcePath = join(repoRoot, "scripts", "site", "config-workshop-yaml.js");
const jsYamlScriptPath = join(siteRoot, "js-yaml-4.1.0.min.js");
const jsYamlScriptSourcePath = join(repoRoot, "scripts", "site", "vendor", "js-yaml-4.1.0.min.js");
const jsYamlLicensePath = join(siteRoot, "js-yaml-4.1.0.LICENSE.txt");
const jsYamlLicenseSourcePath = join(repoRoot, "scripts", "site", "vendor", "js-yaml-4.1.0.LICENSE.txt");
const baseVariantRecordsJsonPath = join(siteRoot, "base-variant-records.json");
const baseVariantRecordsJsonSourcePath = join(repoRoot, "data", "base-variant-records", "records.json");
const baseVariantRecords = JSON.parse(
  readFileSync(baseVariantRecordsJsonSourcePath, "utf8"),
).records ?? [];
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
const catalogSharedChecksPath = join(repoRoot, "data", "catalog-shared-checks", "index.json");
const highFanoutPath = join(repoRoot, "data", "high-fanout-demo", "prometheus-kps.csv");
const hardChartPacketsSummaryPath = join(repoRoot, "data", "hard-chart-production-packets", "summary.md");
const lifecycleRoutesJsonPath = join(repoRoot, "data", "lifecycle-routes", "routes.json");
const lifecycleRouteActionsJsonPath = join(repoRoot, "data", "lifecycle-route-actions", "actions.json");
const helmRenderIntentsPath = join(repoRoot, "data", "helm-render-intents", "intents.csv");
const demoProgramPath = join(repoRoot, "data", "demo-program", "program.json");
// The AICR entries are retained starting configurations. Their records keep
// public package availability separate from later ConfigHub, delivery, and
// runtime results.
const platformEvidencePath = join(repoRoot, "data", "aicr-platform-evidence", "platform-evidence.json");
const helmCatalogReadmesPath = join(repoRoot, "data", "helm-catalog-readmes", "readmes.csv");
const installerOciCatalogPath = join(repoRoot, "data", "installer-oci-packages", "packages.csv");
const permanentLiteralOciReceiptPath = join(
  repoRoot,
  "runs",
  "anonymous-oci-transform-proof",
  "public-oci-receipt.yaml",
);
const applyPolicyProfilePath = join(repoRoot, "config-catalog", "policies", "catalog-standard.yaml");
const applyPolicyLiveReceiptPath = join(repoRoot, "data", "apply-policy-profiles", "live-helm-catalog.yaml");
const changeWorkflowEvidencePath = join(repoRoot, "config-catalog", "change-workflow-evidence.yaml");
const lifecycleByVariantJsonPath = join(repoRoot, "data", "lifecycle-routes-by-variant", "by-variant.json");
const gitopsRouteEmissionJsonPath = join(repoRoot, "data", "gitops-route-emission", "emission.json");
const chartSkillsJsonPath = join(repoRoot, "data", "chart-skills", "skills.json");
const chartEvidenceRouterPath = join(repoRoot, "data", "chart-evidence-router", "router.csv");
const masterCatalogMatrixPath = join(repoRoot, "data", "master-catalog-matrix", "matrix.csv");
const cubAdoptionCaveatsPath = join(repoRoot, "data", "cub-adoption-caveats", "caveats.csv");
const flatteningEvidencePath = join(repoRoot, "data", "flattening-safety", "evidence.csv");
const flatteningCoveragePath = join(repoRoot, "data", "flattening-safety", "witness-coverage.csv");
const upstreamDriftPath = join(repoRoot, "data", "upstream-drift", "drift.csv");
const runtimePathBoundariesPath = join(repoRoot, "config-catalog", "runtime-path-boundaries.yaml");
// The catalog grows. These were exact counts, so every chart added to the
// public catalog broke the site gate and read as a regression rather than as
// growth. They are floors now. What they still catch is the thing that matters,
// which is a component or a version quietly disappearing from the public
// surface, and the uniqueness and containment checks beside them stay exact.
const TOP100_EVIDENCE_COMPONENT_FLOOR = 100;
const PUBLIC_CATALOG_COMPONENT_FLOOR = 112;
const PUBLIC_CATALOG_VERSION_FLOOR = 139;
// These categories help people browse the Catalog. They describe what a chart
// is for, not how ready it is. A new retained component must be classified
// deliberately so it cannot disappear into a silent "other" bucket.
const CATALOG_COMPONENT_CATEGORIES = [
  { id: "security-secrets", label: "Security and secrets", pattern: /^(aqua\/trivy-operator|dex\/dex|external-secrets\/|falcosecurity\/|gatekeeper\/|hashicorp\/vault|jetstack\/|kyverno\/|oauth2-proxy\/|policy-reporter\/|sealed-secrets\/|secrets-store-csi-driver\/)/ },
  { id: "monitoring-logs", label: "Monitoring and logs", pattern: /^(elastic\/(filebeat|kibana|logstash|metricbeat)|fluent\/|grafana\/|jaegertracing\/|nats\/surveyor|open-telemetry\/|opencost\/|prometheus-community\/|vm\/)/ },
  { id: "networking-ingress", label: "Networking and ingress", pattern: /^(bitnami\/contour|coredns\/|external-dns\/|haproxytech\/|hashicorp\/consul|ingress-nginx\/|istio\/|linkerd\/|metallb\/|projectcalico\/|traefik\/)/ },
  { id: "storage-backup", label: "Storage and backup", pattern: /^(aws-ebs-csi-driver\/|longhorn\/|minio-operator\/|nfs-subdir-external-provisioner\/|rook-release\/|velero\/)/ },
  { id: "databases-messaging", label: "Databases and messaging", pattern: /^(bitnami\/(elasticsearch|memcached|mongodb|mysql|opensearch|postgresql|rabbitmq|redis|zookeeper)|cloudnative-pg\/|cloudpirates\/(rabbitmq|redis)|elastic\/eck-operator|nats\/(nack|nats)|percona\/|runix\/pgadmin4|strimzi\/|valkey\/)/ },
  { id: "delivery-automation", label: "Delivery and automation", pattern: /^(argo-cd\/|crossplane-stable\/|gitlab\/gitlab-runner|hashicorp\/terraform|stakater\/reloader)/ },
  { id: "cluster-operations", label: "Cluster operations", pattern: /^(autoscaler\/|aws-controllers-k8s\/|descheduler\/|fairwinds-stable\/|karpenter\/|kedacore\/|metrics-server\/|nvidia\/)/ },
  { id: "web-compute", label: "Web and compute", pattern: /^(bitnami\/(apache|nginx|phpmyadmin|spark)|cloudpirates\/nginx)/ },
];
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
const REDIS_INSTALLER_PUBLICATION_RECEIPT = readYaml(join(
  repoRoot,
  "runs/installer-oci/bitnami-redis/25.5.3/installer-package-publication-receipt.yaml",
));
const REDIS_INSTALLER_MANIFEST_DIGEST = REDIS_INSTALLER_PUBLICATION_RECEIPT?.spec?.outputs?.manifestDigest
  ?? String(REDIS_INSTALLER_PUBLICATION_RECEIPT?.spec?.outputs?.push ?? "").match(/manifest:\s+(sha256:[0-9a-f]{64})/)?.[1]
  ?? "";
check(REDIS_INSTALLER_MANIFEST_DIGEST, "Redis installer publication receipt has no manifest digest");
const REDIS_INSTALLER_PINNED_OCI_REF = installerOciDigestRef(
  REDIS_INSTALLER_OCI_REF,
  REDIS_INSTALLER_MANIFEST_DIGEST,
);
const REDIS_27_INSTALLER_PUBLICATION_RECEIPT = readYaml(join(
  repoRoot,
  "runs/installer-oci/bitnami-redis/27.0.0/installer-package-publication-receipt.yaml",
));
const REDIS_27_INSTALLER_MANIFEST_DIGEST = REDIS_27_INSTALLER_PUBLICATION_RECEIPT?.spec?.outputs?.manifestDigest
  ?? String(REDIS_27_INSTALLER_PUBLICATION_RECEIPT?.spec?.outputs?.push ?? "").match(/manifest:\s+(sha256:[0-9a-f]{64})/)?.[1]
  ?? "";
check(REDIS_27_INSTALLER_MANIFEST_DIGEST, "Redis 27 installer publication receipt has no manifest digest");
const REDIS_27_INSTALLER_PINNED_OCI_REF = installerOciDigestRef(
  REDIS_27_INSTALLER_OCI_REF,
  REDIS_27_INSTALLER_MANIFEST_DIGEST,
);
const REDIS_25_REUSE_RENDER_PATH = join(
  repoRoot,
  "recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml",
);
const REDIS_27_REUSE_RENDER_PATH = join(
  repoRoot,
  "recipes/bitnami/redis/27.0.0/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml",
);
const REDIS_IMAGE_DIGEST =
  "sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25";
const PROMETHEUS_INSTALLER_OCI_REF = installerOciRef("prometheus-community/prometheus", "29.8.0");
const PROMETHEUS_INSTALLER_PUBLICATION_RECEIPT = readYaml(join(
  repoRoot,
  "runs/installer-oci/prometheus-community-prometheus/29.8.0/installer-package-publication-receipt.yaml",
));
const PROMETHEUS_INSTALLER_MANIFEST_DIGEST = PROMETHEUS_INSTALLER_PUBLICATION_RECEIPT?.spec?.outputs?.manifestDigest
  ?? String(PROMETHEUS_INSTALLER_PUBLICATION_RECEIPT?.spec?.outputs?.push ?? "").match(/manifest:\s+(sha256:[0-9a-f]{64})/)?.[1]
  ?? "";
check(PROMETHEUS_INSTALLER_MANIFEST_DIGEST, "Prometheus installer publication receipt has no manifest digest");
const PROMETHEUS_INSTALLER_PINNED_OCI_REF = installerOciDigestRef(
  PROMETHEUS_INSTALLER_OCI_REF,
  PROMETHEUS_INSTALLER_MANIFEST_DIGEST,
);
const INSTALLER_OCI_AUTH_NOTE =
  "Public catalog package refs are published in Google Artifact Registry with anonymous read access. No ConfigHub account or Google registry login is needed for the local setup path.";
const CONFIGHUB_SIGNUP_URL = "https://hub.confighub.com";
const CONFIGHUB_ENTERPRISE_URL = "https://confighub.com";
const CONFIGHUB_BLOG_URL = "https://confighub.com/blog/";
const CONFIGHUB_DOCS_SETUP_URL = "https://docs.confighub.com/get-started/setup/";
const CONFIGHUB_TUTORIAL_URL = "https://docs.confighub.com/get-started/tutorial/";
const CONFIGHUB_COMPONENT_DOC_URL =
  "https://docs.confighub.com/background/concepts/component/";
const CONFIGHUB_VARIANT_DOC_URL =
  "https://docs.confighub.com/background/concepts/variant/";
const CONFIGHUB_TARGET_DOC_URL =
  "https://docs.confighub.com/background/entities/target/";
const CUB_CLI_INSTALL_COMMAND = "curl -fsSL https://hub.confighub.com/cub/install.sh | bash";
const INSTALLER_PLUGIN_INSTALL_COMMAND =
  "cub plugin install confighub/installer";
const CHECK_PLUGIN_INSTALL_COMMAND =
  "cub plugin install confighub/homebrew-tap@cub-scan-v0.7.3 --name scan";
const CHECK_RENDERED_FILES_COMMAND =
  "cub check --format json --output cub-check.json ./rendered";
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
  "cub installer is an open-source plugin for the cub CLI. cub installer setup pulls a catalog package and writes its Kubernetes files locally, leaving delivery to kubectl, Argo CD or Flux.";
const SITE_FEEDBACK_ISSUE_URL = "https://github.com/confighub/helm-expt/issues/new?template=site-feedback.yml";
const PROBLEM_CHART_ISSUE_URL = "https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml";
const GITHUB_BLOB_BASE_URL = "https://github.com/confighub/helm-expt/blob/main/";
const CHART_ALIASES = {
  "minio-operator/operator": ["minio/operator"],
  "minio-operator/tenant": ["minio/tenant"],
};
const COVERAGE_QUESTIONS = [
  ["retained_package", "Can I pull these exact package bytes again?"],
  ["chart_analysis", "What does this chart contain?"],
  ["render_parity", "Does the recorded render match Helm?"],
  ["values_diagnostics", "Did the supplied values change the render?"],
  ["lifecycle_observation", "Were hooks, CRDs, or setup steps checked?"],
  ["local_kubernetes", "Did this version run on a local Kubernetes cluster?"],
  ["gitops_oci", "Did an OCI delivery through GitOps run?"],
  ["live_parity", "Did Helm and ConfigHub reach the same live result?"],
  ["two_cluster", "Was the result compared on separate clusters?"],
  ["promotion", "Was a ConfigHub promotion tested?"],
  ["upstream_republish", "Did this version string point at changed upstream bytes?"],
];
// Single source for the public URL of the generated site; a future domain
// move is one edit here.
const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const sitemapPath = join(siteRoot, "sitemap.xml");
const robotsPath = join(siteRoot, "robots.txt");
const llmsPath = join(siteRoot, "llms.txt");
const agentSkillSourceRoot = join(repoRoot, "skills", "config-workshop");
const agentSkillPublishedRoot = join(siteRoot, ".well-known", "agent-skills", "config-workshop");
const agentSkillIndexPath = join(siteRoot, ".well-known", "agent-skills", "index.json");
const agentSkillFiles = [
  "SKILL.md",
  "references/processing-model.md",
  "references/task-playbook.md",
];
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
  tryAicrHtml: "try-aicr.html",
  configHubHtml: "confighub.html",
  redisWalkthroughHtml: "redis-walkthrough.html",
  serverlessHtml: "serverless.html",
  howItWorksHtml: "how-it-works.html",
  deploymentReferenceHtml: "deployment-reference.html",
  variantsHtml: "variants.html",
  customAppsHtml: "custom-apps.html",
  existingAppsHtml: "existing-apps.html",
  aiHtml: "ai.html",
  securityHtml: "security.html",
  pillarsHtml: "testing.html",
  kubaraHtml: "kubara.html",
  entryPathReferenceHtml: "entry-path-reference.html",
  futureHtml: "future.html",
  operationsHtml: "operations.html",
  guidesHtml: "guides.html",
  askHtml: "ask.html",
  promoteHtml: "promote.html",
  ignoredValuesHtml: "why-did-helm-ignore-my-values.html",
  upstreamVersionHtml: "did-this-chart-version-change.html",
  bitnamiSuccessorHtml: "did-your-bitnami-chart-stop-pulling.html",
  fluxArgoHtml: "deploy-with-flux-or-argo.html",
  environmentDifferenceHtml: "why-do-dev-and-prod-differ.html",
  approvedClusterHtml: "does-cluster-match-approved-config.html",
  challengeHtml: "challenge.html",
  compareHtml: "compare.html",
  whatsNewHtml: "whats-new.html",
  docsHtml: "docs.html",
  docsReferenceHtml: "docs-reference.html",
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
  "index.html": "Inspect and test configuration from Helm, AICR AI-infrastructure packages, OCI, or Kubernetes YAML, then keep it local or manage it in ConfigHub.",
  "offering.html": "Choose local public tools, a free ConfigHub account, or the commercial product according to the configuration work you need to do.",
  "try.html": "Render one public Redis catalog package and inspect its exact Kubernetes objects without contacting ConfigHub Server or Kubernetes.",
  "try-aicr.html": "Compare two GPU-node snapshots against their intended roles, or pull one public AICR configuration and write a local OCI without an account or cluster.",
  "confighub.html": "Use ConfigHub when you want shared configuration records, variants, approvals, promotions, and rollout history.",
  "redis-walkthrough.html": "Follow the full Redis example through public package pulls, Helm parity, OCI output, upgrade, promotion, rollout, and rollback.",
  "serverless.html": "Run a public catalog package with no account and no sign-in, and keep the rendered objects under your control.",
  "how-it-works.html": "Choose whether reviewed Kubernetes objects stay as local files, move through OCI, or become managed configuration in ConfigHub.",
  "deployment-reference.html": "Technical details for source records, base variants, routes, checks, ConfigHub changes, OCI delivery, and deployment limits.",
  "variants.html": "Same chart, but change one thing: when a values change is a new base variant and when it belongs in a derived ConfigHub variant.",
  "custom-apps.html": "Combine public charts and services your team owns, then review and release their Kubernetes configuration together.",
  "existing-apps.html": "Understand an application that already runs through Helm, Argo CD, Flux, or Kubernetes YAML before ConfigHub changes it.",
  "ai.html": "Install the Config Workshop agent skill, choose a configuration task, and keep exact objects, lifecycle work, checks, and limits visible.",
  "security.html": "Review the exact Kubernetes objects, their source, security checks, approvals, and delivery record before release.",
  "testing.html": "Find a tested starting configuration for a component, AI-infrastructure stack, or internal developer platform, then inspect the exact result before using it.",
  "kubara.html": "Build an internal developer platform from tested Catalog components, native Kubara configuration, and reviewed AI-assisted changes, then promote platform components, tools, and applications separately.",
  "entry-path-reference.html": "Detailed entry paths for Helm, AICR AI-infrastructure packages, existing OCI, and Kubernetes YAML, with commands and evidence links.",
  "future.html": "Separate Config Workshop results that can be used today from ideas that remain planned or only partly tested.",
  "operations.html": "Ops starts when an app already exists: see what changed, review diffs, and promote with gates and receipts.",
  "ask.html": "Investigate a new chart, values set, AICR recipe, OCI package, Kubernetes object set, or existing deployment, then retain the reviewed result.",
  "promote.html": "Compare current and proposed Kubernetes objects, see what changes, and choose the tests required before moving the change.",
  "why-did-helm-ignore-my-values.html": "Find values that Helm accepts but a chart does not use by comparing the rendered Kubernetes objects with and without each supplied key.",
  "did-this-chart-version-change.html": "Check whether an upstream publisher changed the package bytes behind an existing Helm chart version.",
  "did-your-bitnami-chart-stop-pulling.html": "Find a tested, verified successor for a Bitnami chart that no longer pulls anonymously, with each successor linked to its catalog entry.",
  "deploy-with-flux-or-argo.html": "Render any catalog chart to a Flux-native or Argo-native OCI with one command and no account, then reconcile it with the controller you already run.",
  "why-do-dev-and-prod-differ.html": "Record development and production as related configurations so their exact differences and promotion history remain visible.",
  "does-cluster-match-approved-config.html": "Compare approved configuration with live cluster state while keeping the current field-coverage limits visible.",
  "docs.html": "Find the technical instructions for the configuration or deployment step you are working on now.",
  "docs-reference.html": "Browse the complete technical guide and evidence index for Config Workshop and helm-expt.",
  "verification.html": "Choose one Config Workshop claim, run the matching check, and understand whether it uses committed evidence or creates a fresh live result.",
  "proof.html": "See how far each Config Workshop claim was tested, from a render comparison to ConfigHub, OCI, GitOps, and live Kubernetes.",
  "quirks.html": "Find the hooks, CRDs, Secrets, webhooks, cluster lookups, storage, and other setup a Helm chart still needs.",
  "hard-questions.html": "Find a direct answer about Helm compatibility, ConfigHub, hooks, CRDs, values, upgrades, free use, evidence, and current limits.",
  "known-gaps.html": "See which Config Workshop paths are not ready yet, why each limit matters, and what to do instead.",
  "compare.html": "What this answers versus helm template, kubectl diff, and Kustomize overlays, including who does not need it.",
  "whats-new.html": "The twenty newest receipts in the catalog, from the committed evidence-aging table.",
  "hooks.html": "The hooks page moved: hook and setup work now lives on the catalog page action cards.",
  "tiers.html": "The tiers page moved: commercial options now live on the private page.",
  "day1-operations.html": "The day-1 operations page moved: operations guidance now lives on the Ops page.",
  "private/index.html": "Choose SaaS or enterprise ConfigHub for private configuration, team workflows, policy, fleet operations, and production support.",
  "journey.html": "Apps on ConfigHub: install public charts, bring the applications your team owns, and keep approved changes through updates.",
  "charts/index.html": "Choose among 112 public components, all 139 retained package versions, and their packaged configurations without confusing publication proof with live runtime evidence.",
  "demo-org.html": "Open one ConfigHub demo Space, read its README, inspect its Kubernetes configuration, and then explore variants, promotions, checks, hooks, and CRDs.",
  "matrix.html": "The master catalog matrix: one row per chart, version, and base with lane dispositions, hooks, quirks, and next actions.",
  "d/docs/demo/kubara/single-platform.html": "Adopt Kubara v0.13.0 with ConfigHub through a linear four-cluster mini-IDP path that preserves Kubara catalogs, config, values overlays, hub-and-spoke topology, and Argo reconciliation.",
  "d/docs/demo/kubara/adoption.html": "Follow the complete six-step path from Kubara component selection through exact Git and OCI hand-off to a selected ConfigHub organization and application delivery.",
  "d/docs/demo/kubara/adoption-1-choose.html": "Choose exact platform components and wiring in Kubara without replacing its catalogs, config, values overrides, or service definitions.",
  "d/docs/demo/kubara/adoption-2-generate.html": "Run Kubara normally and prove that the official and ConfigHub-aligned catalog lanes generate the same platform bytes.",
  "d/docs/demo/kubara/adoption-3-git.html": "Prepare, scan, commit, and push one complete portable Kubara platform hand-off at an immutable Git revision.",
  "d/docs/demo/kubara/adoption-4-oci.html": "Import the exact Kubara Git revision deterministically and create immutable component/config OCI packages plus a platform index.",
  "d/docs/demo/kubara/adoption-5-confighub-org.html": "Materialize the recognizable Kubara topology in the organization selected by the user, then prove idempotence and zero residue in the declared audit scope.",
  "d/docs/demo/kubara/adoption-6-apps.html": "Deploy and promote applications through ConfigHub while Argo CD remains the cluster reconciler.",
  "d/docs/demo/kubara/checkpoints.html": "Inspect the status, scope, receipt, command, and limitation behind every Kubara plus ConfigHub benefit claim.",
  "d/docs/demo/kubara/gui-tour.html": "Follow a receipt-bound GUI walkthrough of the Kubara topology, component Catalog, applications, wiring, approvals, releases, matrix, and orphan audit.",
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
  write(tryAicrPath, site.tryAicrHtml);
  write(configHubPath, site.configHubHtml);
  write(redisWalkthroughPath, site.redisWalkthroughHtml);
  write(serverlessPath, site.serverlessHtml);
  write(howItWorksPath, site.howItWorksHtml);
  write(deploymentReferencePath, site.deploymentReferenceHtml);
  write(variantsPath, site.variantsHtml);
  write(customAppsPath, site.customAppsHtml);
  write(existingAppsPath, site.existingAppsHtml);
  write(aiPath, site.aiHtml);
  write(securityPath, site.securityHtml);
  write(testingPath, site.pillarsHtml);
  write(kubaraPath, site.kubaraHtml);
  write(entryPathReferencePath, site.entryPathReferenceHtml);
  write(futurePath, site.futureHtml);
  write(operationsPath, site.operationsHtml);
  write(guidesPath, site.guidesHtml);
  write(askPath, site.askHtml);
  write(promotePath, site.promoteHtml);
  write(ignoredValuesPath, site.ignoredValuesHtml);
  write(upstreamVersionPath, site.upstreamVersionHtml);
  write(bitnamiSuccessorPath, site.bitnamiSuccessorHtml);
  write(fluxArgoPath, site.fluxArgoHtml);
  write(environmentDifferencePath, site.environmentDifferenceHtml);
  write(approvedClusterPath, site.approvedClusterHtml);
  write(challengePath, site.challengeHtml);
  write(comparePath, site.compareHtml);
  write(whatsNewPath, site.whatsNewHtml);
  write(docsPath, site.docsHtml);
  write(docsReferencePath, site.docsReferenceHtml);
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
  write(changesJsonPath, site.changesJson);
  write(changesSchemaPath, site.changesSchemaJson);
  write(reviewSchemaPath, site.reviewSchemaJson);
  write(workshopResultSchemaPath, site.workshopResultSchemaJson);
  write(workshopCiReportSchemaPath, site.workshopCiReportSchemaJson);
  write(promotionReviewSchemaPath, site.promotionReviewSchemaJson);
  write(configurationDecisionSchemaPath, site.configurationDecisionSchemaJson);
  write(checkConfigScriptPath, site.checkConfigScript);
  write(promoteConfigScriptPath, site.promoteConfigScript);
  write(workshopYamlScriptPath, site.workshopYamlScript);
  write(jsYamlScriptPath, site.jsYamlScript);
  write(jsYamlLicensePath, site.jsYamlLicense);
  write(baseVariantRecordsJsonPath, site.baseVariantRecordsJson);
  write(readmePath, site.readme);
  write(sitemapPath, site.sitemapXml);
  write(robotsPath, site.robotsTxt);
  write(llmsPath, site.llmsTxt);
  for (const relative of agentSkillFiles) {
    write(
      join(agentSkillPublishedRoot, relative),
      readFileSync(join(agentSkillSourceRoot, relative), "utf8"),
    );
  }
  write(agentSkillIndexPath, `${JSON.stringify(agentSkillDiscoveryIndex(), null, 2)}\n`);
  write(generatedAtPath, `${generatedAt}\n`);
  if (site.missingMdTargets.length) {
    console.log(`markdown targets linked but not found in the repo (left as raw links): ${site.missingMdTargets.length}`);
    for (const target of site.missingMdTargets) console.log(`  - ${target}`);
  }
  console.log(`wrote public site outputs, ${site.chartPages.length} Catalog version page(s), ${site.docPages.length} rendered doc page(s), and ${site.presetScripts.length} base variant script(s)`);
} else if (mode === "--verify") {
  check(existsSync(generatedAtPath), "site/generated-at.txt is missing; run npm run site:generate");
  const site = buildSite(readFileSync(generatedAtPath, "utf8").trim());
  check(existsSync(indexPath), "site/index.html is missing; run npm run site:generate");
  check(existsSync(offeringPath), "site/offering.html is missing; run npm run site:generate");
  check(existsSync(tryPath), "site/try.html is missing; run npm run site:generate");
  check(existsSync(tryAicrPath), "site/try-aicr.html is missing; run npm run site:generate");
  check(existsSync(configHubPath), "site/confighub.html is missing; run npm run site:generate");
  check(existsSync(redisWalkthroughPath), "site/redis-walkthrough.html is missing; run npm run site:generate");
  check(existsSync(serverlessPath), "site/serverless.html is missing; run npm run site:generate");
  check(existsSync(howItWorksPath), "site/how-it-works.html is missing; run npm run site:generate");
  check(existsSync(deploymentReferencePath), "site/deployment-reference.html is missing; run npm run site:generate");
  check(existsSync(variantsPath), "site/variants.html is missing; run npm run site:generate");
  check(existsSync(customAppsPath), "site/custom-apps.html is missing; run npm run site:generate");
  check(existsSync(existingAppsPath), "site/existing-apps.html is missing; run npm run site:generate");
  check(existsSync(aiPath), "site/ai.html is missing; run npm run site:generate");
  check(existsSync(securityPath), "site/security.html is missing; run npm run site:generate");
  check(existsSync(testingPath), "site/testing.html is missing; run npm run site:generate");
  check(existsSync(kubaraPath), "site/kubara.html is missing; run npm run site:generate");
  check(existsSync(entryPathReferencePath), "site/entry-path-reference.html is missing; run npm run site:generate");
  check(existsSync(futurePath), "site/future.html is missing; run npm run site:generate");
  check(existsSync(operationsPath), "site/operations.html is missing; run npm run site:generate");
  check(existsSync(docsPath), "site/docs.html is missing; run npm run site:generate");
  check(existsSync(docsReferencePath), "site/docs-reference.html is missing; run npm run site:generate");
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
  check(existsSync(changesJsonPath), "site/changes.json is missing; run npm run site:generate");
  check(existsSync(reviewSchemaPath), "site/review.schema.json is missing; run npm run site:generate");
  check(existsSync(workshopResultSchemaPath), "site/workshop-result.schema.json is missing; run npm run site:generate");
  check(existsSync(workshopCiReportSchemaPath), "site/workshop-ci-report.schema.json is missing; run npm run site:generate");
  check(existsSync(promotionReviewSchemaPath), "site/promotion-review.schema.json is missing; run npm run site:generate");
  check(existsSync(configurationDecisionSchemaPath), "site/configuration-decision.schema.json is missing; run npm run site:generate");
  check(existsSync(checkConfigScriptPath), "site/check-config.js is missing; run npm run site:generate");
  check(existsSync(promoteConfigScriptPath), "site/promote-config.js is missing; run npm run site:generate");
  check(existsSync(workshopYamlScriptPath), "site/config-workshop-yaml.js is missing; run npm run site:generate");
  check(existsSync(jsYamlScriptPath), "site/js-yaml-4.1.0.min.js is missing; run npm run site:generate");
  check(existsSync(jsYamlLicensePath), "site/js-yaml-4.1.0.LICENSE.txt is missing; run npm run site:generate");
  check(existsSync(baseVariantRecordsJsonPath), "site/base-variant-records.json is missing; run npm run site:generate");
  check(existsSync(readmePath), "site/README.md is missing; run npm run site:generate");
  check(existsSync(generatedAtPath), "site/generated-at.txt is missing; run npm run site:generate");
  check(readFileSync(indexPath, "utf8") === site.indexHtml, "site/index.html is stale");
  check(readFileSync(offeringPath, "utf8") === site.offeringHtml, "site/offering.html is stale");
  check(readFileSync(tryPath, "utf8") === site.tryHtml, "site/try.html is stale");
  check(readFileSync(tryAicrPath, "utf8") === site.tryAicrHtml, "site/try-aicr.html is stale");
  check(readFileSync(configHubPath, "utf8") === site.configHubHtml, "site/confighub.html is stale");
  check(readFileSync(redisWalkthroughPath, "utf8") === site.redisWalkthroughHtml, "site/redis-walkthrough.html is stale");
  check(readFileSync(serverlessPath, "utf8") === site.serverlessHtml, "site/serverless.html is stale");
  check(readFileSync(howItWorksPath, "utf8") === site.howItWorksHtml, "site/how-it-works.html is stale");
  check(readFileSync(deploymentReferencePath, "utf8") === site.deploymentReferenceHtml, "site/deployment-reference.html is stale");
  check(readFileSync(variantsPath, "utf8") === site.variantsHtml, "site/variants.html is stale");
  check(readFileSync(customAppsPath, "utf8") === site.customAppsHtml, "site/custom-apps.html is stale");
  check(readFileSync(existingAppsPath, "utf8") === site.existingAppsHtml, "site/existing-apps.html is stale");
  check(readFileSync(aiPath, "utf8") === site.aiHtml, "site/ai.html is stale");
  check(readFileSync(securityPath, "utf8") === site.securityHtml, "site/security.html is stale");
  check(readFileSync(testingPath, "utf8") === site.pillarsHtml, "site/testing.html is stale");
  check(readFileSync(kubaraPath, "utf8") === site.kubaraHtml, "site/kubara.html is stale");
  check(readFileSync(entryPathReferencePath, "utf8") === site.entryPathReferenceHtml, "site/entry-path-reference.html is stale");
  check(readFileSync(futurePath, "utf8") === site.futureHtml, "site/future.html is stale");
  check(readFileSync(operationsPath, "utf8") === site.operationsHtml, "site/operations.html is stale");
  check(existsSync(guidesPath), "site/guides.html is missing; run npm run site:generate");
  check(readFileSync(guidesPath, "utf8") === site.guidesHtml, "site/guides.html is stale");
  check(existsSync(askPath), "site/ask.html is missing; run npm run site:generate");
  check(readFileSync(askPath, "utf8") === site.askHtml, "site/ask.html is stale");
  check(existsSync(promotePath), "site/promote.html is missing; run npm run site:generate");
  check(readFileSync(promotePath, "utf8") === site.promoteHtml, "site/promote.html is stale");
  check(existsSync(ignoredValuesPath), "site/why-did-helm-ignore-my-values.html is missing; run npm run site:generate");
  check(readFileSync(ignoredValuesPath, "utf8") === site.ignoredValuesHtml, "site/why-did-helm-ignore-my-values.html is stale");
  check(existsSync(upstreamVersionPath), "site/did-this-chart-version-change.html is missing; run npm run site:generate");
  check(readFileSync(upstreamVersionPath, "utf8") === site.upstreamVersionHtml, "site/did-this-chart-version-change.html is stale");
  check(existsSync(bitnamiSuccessorPath), "site/did-your-bitnami-chart-stop-pulling.html is missing; run npm run site:generate");
  check(readFileSync(bitnamiSuccessorPath, "utf8") === site.bitnamiSuccessorHtml, "site/did-your-bitnami-chart-stop-pulling.html is stale");
  check(existsSync(fluxArgoPath), "site/deploy-with-flux-or-argo.html is missing; run npm run site:generate");
  check(readFileSync(fluxArgoPath, "utf8") === site.fluxArgoHtml, "site/deploy-with-flux-or-argo.html is stale");
  check(existsSync(environmentDifferencePath), "site/why-do-dev-and-prod-differ.html is missing; run npm run site:generate");
  check(readFileSync(environmentDifferencePath, "utf8") === site.environmentDifferenceHtml, "site/why-do-dev-and-prod-differ.html is stale");
  check(existsSync(approvedClusterPath), "site/does-cluster-match-approved-config.html is missing; run npm run site:generate");
  check(readFileSync(approvedClusterPath, "utf8") === site.approvedClusterHtml, "site/does-cluster-match-approved-config.html is stale");
  check(existsSync(challengePath), "site/challenge.html is missing; run npm run site:generate");
  check(readFileSync(challengePath, "utf8") === site.challengeHtml, "site/challenge.html is stale");
  check(existsSync(comparePath), "site/compare.html is missing; run npm run site:generate");
  check(readFileSync(comparePath, "utf8") === site.compareHtml, "site/compare.html is stale");
  check(existsSync(whatsNewPath), "site/whats-new.html is missing; run npm run site:generate");
  check(readFileSync(whatsNewPath, "utf8") === site.whatsNewHtml, "site/whats-new.html is stale");
  check(readFileSync(docsPath, "utf8") === site.docsHtml, "site/docs.html is stale");
  check(readFileSync(docsReferencePath, "utf8") === site.docsReferenceHtml, "site/docs-reference.html is stale");
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
  check(readFileSync(changesJsonPath, "utf8") === site.changesJson, "site/changes.json is stale");
  check(existsSync(changesSchemaPath), "site/changes.schema.json is missing; run npm run site:generate");
  check(readFileSync(changesSchemaPath, "utf8") === site.changesSchemaJson, "site/changes.schema.json is stale");
  check(readFileSync(reviewSchemaPath, "utf8") === site.reviewSchemaJson, "site/review.schema.json is stale");
  check(readFileSync(workshopResultSchemaPath, "utf8") === site.workshopResultSchemaJson, "site/workshop-result.schema.json is stale");
  check(readFileSync(workshopCiReportSchemaPath, "utf8") === site.workshopCiReportSchemaJson, "site/workshop-ci-report.schema.json is stale");
  check(readFileSync(promotionReviewSchemaPath, "utf8") === site.promotionReviewSchemaJson, "site/promotion-review.schema.json is stale");
  check(readFileSync(configurationDecisionSchemaPath, "utf8") === site.configurationDecisionSchemaJson, "site/configuration-decision.schema.json is stale");
  check(readFileSync(checkConfigScriptPath, "utf8") === site.checkConfigScript, "site/check-config.js is stale");
  check(readFileSync(promoteConfigScriptPath, "utf8") === site.promoteConfigScript, "site/promote-config.js is stale");
  check(readFileSync(workshopYamlScriptPath, "utf8") === site.workshopYamlScript, "site/config-workshop-yaml.js is stale");
  check(readFileSync(jsYamlScriptPath, "utf8") === site.jsYamlScript, "site/js-yaml-4.1.0.min.js is stale");
  check(readFileSync(jsYamlLicensePath, "utf8") === site.jsYamlLicense, "site/js-yaml-4.1.0.LICENSE.txt is stale");
  check(readFileSync(baseVariantRecordsJsonPath, "utf8") === site.baseVariantRecordsJson, "site/base-variant-records.json is stale");
  check(readFileSync(readmePath, "utf8") === site.readme, "site/README.md is stale");
  check(existsSync(sitemapPath), "site/sitemap.xml is missing; run npm run site:generate");
  check(readFileSync(sitemapPath, "utf8") === site.sitemapXml, "site/sitemap.xml is stale");
  check(existsSync(robotsPath), "site/robots.txt is missing; run npm run site:generate");
  check(readFileSync(robotsPath, "utf8") === site.robotsTxt, "site/robots.txt is stale");
  check(existsSync(llmsPath), "site/llms.txt is missing; run npm run site:generate");
  check(readFileSync(llmsPath, "utf8") === site.llmsTxt, "site/llms.txt is stale");
  for (const relative of agentSkillFiles) {
    const source = join(agentSkillSourceRoot, relative);
    const published = join(agentSkillPublishedRoot, relative);
    check(existsSync(published), `site agent skill is missing ${relative}; run npm run site:generate`);
    check(readFileSync(published, "utf8") === readFileSync(source, "utf8"), `site agent skill is stale: ${relative}`);
  }
  check(existsSync(agentSkillIndexPath), "site agent skill discovery index is missing; run npm run site:generate");
  check(
    readFileSync(agentSkillIndexPath, "utf8") === `${JSON.stringify(agentSkillDiscoveryIndex(), null, 2)}\n`,
    "site agent skill discovery index is stale",
  );
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
  check(
    existsSync(aicrCpuStarterPublicReceiptPath),
    "runs/aicr-cpu-starter-public-proof/receipt.yaml is missing; run npm run aicr-starter-public:run",
  );
  const aicrCpuStarterPublicReceipt = readYaml(aicrCpuStarterPublicReceiptPath);
  check(aicrCpuStarterPublicReceipt.status?.result === "pass", "the anonymous AICR walkthrough is not pass");
  check(
    aicrCpuStarterPublicReceipt.spec?.execution?.configHubAccountUsed === false
      && aicrCpuStarterPublicReceipt.spec?.execution?.configHubServerContacted === false
      && aicrCpuStarterPublicReceipt.spec?.execution?.registryLoginUsed === false
      && aicrCpuStarterPublicReceipt.spec?.execution?.kubernetesClusterUsed === false,
    "the anonymous AICR walkthrough used an account, registry login, ConfigHub Server, or Kubernetes",
  );
  check(
    aicrCpuStarterPublicReceipt.spec?.source?.reference === AICR_CPU_STARTER_SOURCE_OCI_REF,
    "the anonymous AICR source reference changed",
  );
  check(
    aicrCpuStarterPublicReceipt.spec?.source?.manifestDigest === AICR_CPU_STARTER_SOURCE_DIGEST,
    "the anonymous AICR source digest changed",
  );
  check(aicrCpuStarterPublicReceipt.spec?.source?.objectCount === 17, "the anonymous AICR source count changed");
  check(
    aicrCpuStarterPublicReceipt.spec?.selection?.recordSha256 === aicrCpuStarterIntentSha256(),
    "the anonymous AICR source-and-intent record changed",
  );
  check(
    aicrCpuStarterPublicReceipt.spec?.selection?.objectCount === aicrCpuStarterRecords().length,
    "the anonymous AICR selection count changed",
  );
  check(
    aicrCpuStarterPublicReceipt.spec?.output?.manifestDigest === AICR_CPU_STARTER_LOCAL_OCI_DIGEST,
    "the anonymous AICR output digest changed",
  );
  check(aicrCpuStarterPublicReceipt.spec?.output?.pullBack === "pass", "the anonymous AICR OCI pull-back did not pass");
  check(
    aicrCpuStarterPublicReceipt.spec?.script?.sha256 === sha256(aicrCpuStarterTryScript(SITE_BASE_URL)),
    "the anonymous AICR receipt does not match the public script",
  );
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
  check(existsSync(catalogSharedChecksPath), "data/catalog-shared-checks/index.json is missing; run npm run catalog-shared-checks:generate");
  const catalogSharedChecks = JSON.parse(readFileSync(catalogSharedChecksPath, "utf8"));
  check(catalogSharedChecks.schemaVersion === "catalog-shared-check-index-v1", "the Catalog shared-check index schema changed");
  check(Array.isArray(catalogSharedChecks.entries) && catalogSharedChecks.entries.length > 0, "the Catalog shared-check index has no exact configuration results");
  const highFanout = parseCsv(readFileSync(highFanoutPath, "utf8"));
  const lifecycleRoutes = existsSync(lifecycleRoutesJsonPath) ? JSON.parse(readFileSync(lifecycleRoutesJsonPath, "utf8")).routes : [];
  const lifecycleRouteActions = existsSync(lifecycleRouteActionsJsonPath) ? JSON.parse(readFileSync(lifecycleRouteActionsJsonPath, "utf8")).actions : [];
  const helmRenderIntents = existsSync(helmRenderIntentsPath) ? parseCsv(readFileSync(helmRenderIntentsPath, "utf8")) : [];
  check(existsSync(demoProgramPath), "data/demo-program/program.json is missing; run npm run config-catalog");
  const demoProgram = JSON.parse(readFileSync(demoProgramPath, "utf8"));
  check(
    existsSync(platformEvidencePath),
    "data/aicr-platform-evidence/platform-evidence.json is missing; run npm run aicr-platform-evidence:generate",
  );
  const platformEvidence = JSON.parse(readFileSync(platformEvidencePath, "utf8"));
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
  const flatteningEvidence = existsSync(flatteningEvidencePath) ? parseCsv(readFileSync(flatteningEvidencePath, "utf8")) : [];
  const flatteningCoverage = existsSync(flatteningCoveragePath) ? parseCsv(readFileSync(flatteningCoveragePath, "utf8")) : [];
  const upstreamDrift = existsSync(upstreamDriftPath) ? parseCsv(readFileSync(upstreamDriftPath, "utf8")) : [];
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
        installer_oci_manifest_digest: installerOci?.manifest_digest ?? "",
        installer_oci_layer_digest: installerOci?.layer_digest ?? "",
        installer_oci_digest_pinned_ref: installerOci?.digest_pinned_ref ?? "",
        installer_oci_verify_command: installerOci?.verify_command ?? "",
        installer_oci_signature_status: installerOci?.signature_status ?? "unsigned",
        installer_oci_signature_receipt: installerOci?.signature_receipt ?? "",
        installer_oci_signature_bundle: installerOci?.signature_bundle ?? "",
        installer_oci_signature_verification_command: installerOci?.signature_verification_command ?? "",
        installer_oci_default_base: installerOci?.default_base ?? startVariant,
        installer_oci_bases: installerOci?.bases ?? "",
        chart_page: `site/charts/${chartPageFileName(withStartFields)}`,
      };
    });
  const licensesByChartVersion = new Map();
  for (const indexPath of listFiles(join(repoRoot, "recipes")).filter((file) => file.endsWith("/artifact-index.yaml"))) {
    const artifactIndex = readYaml(indexPath);
    const indexLicenses = artifactIndex.spec?.chart?.licenses;
    if (indexLicenses) {
      licensesByChartVersion.set(
        `${artifactIndex.spec.chart.ref}|${artifactIndex.spec.chart.version}`,
        indexLicenses,
      );
    }
  }
  // Chart-level license record: researched from each chart's own release
  // evidence and independently re-verified. Per-version artifact-index
  // licenses win when both exist; this record covers the rest, so every
  // catalog component can state its chart license with its evidence basis.
  const chartLicenseRecord = readYaml(join(repoRoot, "data", "chart-licenses", "chart-licenses.yaml"));
  const chartLicenseByChart = new Map();
  for (const record of chartLicenseRecord?.spec?.charts ?? []) {
    check(record.chart && record.spdx && record.spdx !== "unknown" && record.evidence?.url && record.evidence?.label,
      `data/chart-licenses/chart-licenses.yaml: entry ${record.chart ?? "?"} must carry spdx and evidence; assumed licenses are refused`);
    chartLicenseByChart.set(record.chart, record);
  }
  const chartLicensesResearchedAt = String(chartLicenseRecord?.metadata?.researchedAt ?? "");
  check(/^\d{4}-\d{2}-\d{2}$/.test(chartLicensesResearchedAt), "data/chart-licenses/chart-licenses.yaml must record researchedAt");
  const publicChartKeys = new Set(catalogEntries.map((entry) => `${entry.chart}|${entry.version}`));
  const retainedComponentNames = new Set(installerOciPackages.map((row) => row.chart));
  const catalogEntryComponentNames = catalogEntries.map((entry) => entry.chart);
  const evidenceComponentNameSet = new Set(catalogEntryComponentNames);
  const retainedVersionKeys = installerOciPackages.map((row) => `${row.chart}|${row.version}`);
  const retainedVersionKeySet = new Set(retainedVersionKeys);
  check(
    installerOciPackages.length >= PUBLIC_CATALOG_VERSION_FLOOR
      && new Set(retainedVersionKeys).size === installerOciPackages.length,
    `the public Catalog retains ${installerOciPackages.length} unique component/version packages, below the floor of ${PUBLIC_CATALOG_VERSION_FLOOR}`,
  );
  check(
    catalogEntries.length >= TOP100_EVIDENCE_COMPONENT_FLOOR
      && evidenceComponentNameSet.size === catalogEntries.length
      && [...evidenceComponentNameSet].every((name) => retainedComponentNames.has(name)),
    "the Top-100 evidence entries must remain unique and present in the retained component Catalog",
  );
  check(
    catalogEntries.every((entry) => retainedVersionKeySet.has(`${entry.chart}|${entry.version}`)),
    "every evidence-bearing Catalog version must remain present in the retained package inventory",
  );
  const publicationReceipts = installerOciPackages
    .map((row) => row.publication_receipt)
    .filter(Boolean);
  check(
    new Set(installerOciPackages.map((row) => row.installer_oci_ref)).size === installerOciPackages.length
      && new Set(publicationReceipts).size === publicationReceipts.length,
    "every retained Catalog version must have a unique OCI ref, and every publication receipt must belong to one version",
  );
  for (const row of installerOciPackages) verifyRetainedCatalogPackage(row);
  for (const row of installerOciPackages) {
    check(
      licensesByChartVersion.has(`${row.chart}|${row.version}`) || chartLicenseByChart.has(row.chart),
      `${row.chart}@${row.version}: every retained catalog version must carry a chart license from its artifact index or data/chart-licenses/chart-licenses.yaml`,
    );
  }
  // Succession record: the survey-picked replacements for components whose
  // upstream source availability changed. Every successor named here must be
  // a retained catalog component; picks that are not yet entries stay in
  // planned with their tracking issue. The measured upstream exposure comes
  // from the committed survey, never from an assumption.
  const successionRecord = readYaml(join(repoRoot, "data", "chart-successions", "chart-successions.yaml"));
  const chartSuccessions = new Map();
  const chartSuccessorOf = new Map();
  for (const succession of successionRecord?.spec?.successions ?? []) {
    check(retainedComponentNames.has(succession.replaces),
      `data/chart-successions: ${succession.replaces} is not a retained catalog component`);
    for (const successor of succession.successors ?? []) {
      check(retainedComponentNames.has(successor.chart),
        `data/chart-successions: successor ${successor.chart} is not a retained catalog component`);
      chartSuccessorOf.set(successor.chart, { replaces: succession.replaces, ...successor });
    }
    chartSuccessions.set(succession.replaces, succession);
  }
  const exposureSurvey = JSON.parse(readFileSync(join(repoRoot, "data", "bitnami-successors", "survey.json"), "utf8"));
  const upstreamExposureMeasuredAt = String(exposureSurvey?.measuredAt ?? "");
  check(/^\d{4}-\d{2}-\d{2}$/.test(upstreamExposureMeasuredAt), "data/bitnami-successors/survey.json must record measuredAt");
  const upstreamExposureByChart = new Map();
  for (const exposure of exposureSurvey?.exposure ?? []) {
    upstreamExposureByChart.set(`bitnami/${exposure.component}`, exposure);
  }
  const retainedOnlyComponentEntries = [...retainedComponentNames]
    .filter((chart) => !evidenceComponentNameSet.has(chart))
    .sort()
    .map((chart) => {
      const row = installerOciPackages
        .filter((candidate) => candidate.chart === chart)
        .sort((left, right) => String(right.version).localeCompare(String(left.version), undefined, {
          numeric: true,
          sensitivity: "base",
        }))[0];
      check(row, `${chart}: retained-only component has no package version`);
      return {
        ...row,
        start_variant: row.default_base,
        supported_variants: row.bases,
        candidate_variants: "",
        start_base_readiness: "see chart page",
        proof_surface: "retained-publication-only",
        catalog_status: "published-package-only",
        source_features: "",
        not_yet_enabled: "",
      };
    });
  const catalogComponents = [...catalogEntries, ...retainedOnlyComponentEntries]
    .sort((left, right) => left.chart.localeCompare(right.chart));
  check(
    catalogComponents.length >= PUBLIC_CATALOG_COMPONENT_FLOOR
      && new Set(catalogComponents.map((entry) => entry.chart)).size === catalogComponents.length
      && JSON.stringify(catalogComponents.map((entry) => entry.chart).sort()) === JSON.stringify([...retainedComponentNames].sort()),
    `the public Catalog exposes ${catalogComponents.length} unique component rows, below the floor of ${PUBLIC_CATALOG_COMPONENT_FLOOR}`,
  );
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
      catalogSharedChecks: "data/catalog-shared-checks/index.json",
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
      upstreamDrift: "data/upstream-drift/drift.csv",
    },
    commandRoutes: commandRoutes(),
    top500Evidence: top500.summary,
    summary: {
      publicCatalogComponents: catalogComponents.length,
      // Retained for existing catalog.json consumers; the public surface is component-first.
      publicCatalogCharts: catalogComponents.length,
      retainedPackageVersions: installerOciPackages.length,
      retainedPublishedPackageVersions: publicationReceipts.length,
      retainedComponents: retainedComponentNames.size,
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
    licensesByChartVersion,
    chartLicenseByChart,
    chartLicensesResearchedAt,
    chartSuccessions,
    chartSuccessorOf,
    upstreamExposureByChart,
    upstreamExposureMeasuredAt,
    catalogComponents,
    proofGradeEntries: proofGrade,
    latestCandidates,
    baseReadiness,
    flatteningEvidence,
    flatteningCoverage,
    extensionSlots,
    chartUseGuide,
    refreshSurvival,
    top100Readiness: top100ReadinessWithSupport,
    top100UserReadiness,
    liveParityRerunPlan,
    productionDisposition,
    productionSupportDecisions,
    scanDisposition,
    catalogSharedChecks,
    highFanout,
    lifecycleRoutes,
    lifecycleRouteActionSummary,
    helmRenderIntents,
    demoProgram,
    platformEvidence,
    helmCatalogReadmes,
    installerOciPackages,
    lifecycleByVariant,
    gitopsRouteEmission,
    matrixDisposition,
    chartSkills: publicChartSkills,
    chartEvidenceRouter: publicChartEvidenceRouter,
    cubAdoptionCaveats,
    masterCatalogMatrix: publicMatrixRows,
    upstreamDrift,
  };
  const changesEntries = buildChangesEntries(catalog);
  const changesByVersion = new Map(
    changesEntries.map((entry) => [`${entry.chart}|${entry.version}`, entry]),
  );
  const evidenceBearingChartPages = catalog.catalogEntries.map((entry) => ({
    fileName: chartPageFileName(entry),
    path: join(chartPagesRoot, chartPageFileName(entry)),
    html: chartPageHtml(catalog, entry, changesByVersion.get(`${entry.chart}|${entry.version}`)),
  }));
  const retainedOnlyChartPages = catalog.installerOciPackages
    .filter((row) => !publicChartKeys.has(`${row.chart}|${row.version}`))
    .map((row) => ({
      fileName: chartPageFileName(row),
      path: join(chartPagesRoot, chartPageFileName(row)),
      html: retainedVersionPageHtml(catalog, row, changesByVersion.get(`${row.chart}|${row.version}`)),
    }));
  check(
    retainedOnlyChartPages.length === catalog.installerOciPackages.length - evidenceBearingChartPages.length,
    `retained-only page count must close the exact version inventory; found ${retainedOnlyChartPages.length}`,
  );
  const chartPages = [...evidenceBearingChartPages, ...retainedOnlyChartPages]
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
  check(
    chartPages.length === catalog.installerOciPackages.length
      && new Set(chartPages.map((page) => page.fileName)).size === chartPages.length,
    "the public Catalog must generate one unique local detail page per retained package version",
  );
  const site = {
    catalogJson: `${JSON.stringify(siteSafe({ schema_version: "1", generatedBy: catalog.generatedBy, generatedAt: catalog.generatedAt, installerAvailability: INSTALLER_COMMAND_NOTE, ...catalog }), null, 2)}\n`,
    changesJson: buildChangesFeed(catalog, changesEntries),
    changesSchemaJson: readFileSync(changesSchemaSourcePath, "utf8"),
    reviewSchemaJson: readFileSync(reviewSchemaSourcePath, "utf8"),
    workshopResultSchemaJson: readFileSync(workshopResultSchemaSourcePath, "utf8"),
    workshopCiReportSchemaJson: readFileSync(workshopCiReportSchemaSourcePath, "utf8"),
    promotionReviewSchemaJson: readFileSync(promotionReviewSchemaSourcePath, "utf8"),
    configurationDecisionSchemaJson: readFileSync(configurationDecisionSchemaSourcePath, "utf8"),
    checkConfigScript: readFileSync(checkConfigScriptSourcePath, "utf8"),
    promoteConfigScript: readFileSync(promoteConfigScriptSourcePath, "utf8"),
    workshopYamlScript: readFileSync(workshopYamlScriptSourcePath, "utf8"),
    jsYamlScript: readFileSync(jsYamlScriptSourcePath, "utf8"),
    jsYamlLicense: readFileSync(jsYamlLicenseSourcePath, "utf8"),
    baseVariantRecordsJson: readFileSync(baseVariantRecordsJsonSourcePath, "utf8"),
    indexHtml: html(catalog),
    offeringHtml: calmPage(offeringHtml(catalog)),
    tryHtml: calmPage(tryHtml(catalog)),
    tryAicrHtml: calmPage(tryAicrHtml()),
    configHubHtml: calmPage(configHubHtml()),
    redisWalkthroughHtml: calmPage(redisWalkthroughHtml(catalog)),
    serverlessHtml: calmPage(serverlessHtml(catalog)),
    howItWorksHtml: calmPage(howItWorksHtml(catalog)),
    deploymentReferenceHtml: calmPage(deploymentReferenceHtml(catalog)),
    variantsHtml: calmPage(variantsHtml(catalog)),
    customAppsHtml: calmPage(customAppsHtml(catalog)),
    existingAppsHtml: calmPage(existingAppsHtml(catalog)),
    aiHtml: calmPage(aiHtml(catalog)),
    securityHtml: calmPage(securityHtml(catalog)),
    pillarsHtml: calmPage(examplesHtml(catalog)),
    kubaraHtml: calmPage(kubaraHtml(catalog)),
    entryPathReferenceHtml: calmPage(entryPathReferenceHtml(catalog)),
    futureHtml: calmPage(futureHtml(catalog)),
    operationsHtml: calmPage(operationsHtml(catalog)),
    guidesHtml: calmPage(guidesHtml(catalog)),
    askHtml: calmPage(askHtml()),
    promoteHtml: calmPage(promoteHtml()),
    ignoredValuesHtml: calmPage(ignoredValuesHtml()),
    upstreamVersionHtml: calmPage(upstreamVersionHtml()),
    bitnamiSuccessorHtml: calmPage(bitnamiSuccessorHtml()),
    fluxArgoHtml: calmPage(fluxArgoHtml()),
    environmentDifferenceHtml: calmPage(environmentDifferenceHtml()),
    approvedClusterHtml: calmPage(approvedClusterHtml()),
    challengeHtml: calmPage(challengeHtml(catalog)),
    compareHtml: calmPage(compareHtml(catalog)),
    whatsNewHtml: calmPage(whatsNewHtml(catalog)),
    docsHtml: calmPage(docsHtml(catalog)),
    docsReferenceHtml: calmPage(docsReferenceHtml(catalog)),
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
  const note = `<p class="install-cub-note">New to <code>cub</code>? <a href="${base}/try.html#install-cub">Install the cub CLI</a> first. Public catalog packages pull and render anonymously, and you sign in only once a command saves or changes ConfigHub data.</p>`;
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

function insertNoteBeforeContainingBlock(html, needleIndex, note) {
  const candidates = [];
  for (const tag of ["p", "table", "ul", "ol", "dl"]) {
    const start = html.lastIndexOf(`<${tag}`, needleIndex);
    if (start < 0) continue;
    const end = html.indexOf(`</${tag}>`, start);
    if (end >= needleIndex) candidates.push({ start, end, tag });
  }
  if (!candidates.length) return null;
  const container = candidates.sort((a, b) => b.start - a.start)[0];
  const insertAt = container.tag === "p"
    ? container.start
    : container.end + `</${container.tag}>`.length;
  return `${html.slice(0, insertAt)}${note}\n${html.slice(insertAt)}`;
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
  const inlineNeedle = html.indexOf("installer setup", headerEnd + 1);
  if (inlineNeedle >= 0) {
    const localInsertion = insertNoteBeforeContainingBlock(html, inlineNeedle, note);
    if (localInsertion) return localInsertion;
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

function githubEvidenceUrl(value) {
  const path = String(value ?? "").trim();
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${GITHUB_BLOB_BASE_URL}${path.replace(/^\.\//, "")}`;
}

function evidenceUrls(values, fallback = "") {
  const urls = [];
  for (const value of values.flatMap((item) => String(item ?? "").split(";"))) {
    const url = githubEvidenceUrl(value);
    if (url && !urls.includes(url)) urls.push(url);
  }
  if (!urls.length && fallback) urls.push(fallback);
  return urls.slice(0, 6);
}

function aggregateCoverage(rows, field, checkedValues = ["yes", "pass", "proven", "checked"]) {
  const values = rows.map((row) => String(row[field] ?? "").trim().toLowerCase()).filter(Boolean);
  if (!values.length) return "not_checked";
  const applicable = values.filter((value) => !["n/a", "not-applicable", "not-applicable-source"].includes(value));
  if (!applicable.length) return "not_applicable";
  const checked = applicable.filter((value) => checkedValues.includes(value)).length;
  if (checked === applicable.length) return "checked";
  if (checked > 0) return "partial";
  return "not_checked";
}

function coverageItem(status, values = [], fallback = "") {
  const urls = ["checked", "partial"].includes(status) ? evidenceUrls(values, fallback) : [];
  return { status, evidence_urls: urls };
}

function coverageStatusLabel(status) {
  return {
    checked: "Checked",
    partial: "Partly checked",
    not_checked: "Not checked",
    not_applicable: "Not applicable",
  }[status] ?? "Not checked";
}

function coverageEvidenceLabel(url) {
  const path = new URL(url).pathname;
  if (/installer-package-publication-receipt/i.test(path)) return "Package receipt";
  if (/variant-promotion-receipt/i.test(path)) return "Promotion receipt";
  if (/runtime-gitops/i.test(path)) return "GitOps receipt";
  if (/live-helm-confighub-compare/i.test(path)) return "Live comparison";
  if (/observation-receipt|live-kind-parity/i.test(path)) return "Cluster receipt";
  if (/source-lock/i.test(path)) return "Source lock";
  if (/\/CATALOG\.md$/i.test(path)) return "Chart guide";
  if (/helm-pain-report/i.test(path)) return "Chart review";
  if (/control-points/i.test(path)) return "Control points";
  if (/outcome-coverage/i.test(path)) return "Coverage record";
  if (/receipt/i.test(path)) return "Receipt";
  if (/render-intent/i.test(path)) return "Render record";
  if (/variant-revision/i.test(path)) return "Render result";
  if (/values-diagnostics/i.test(path)) return "Values report";
  if (/upstream-drift/i.test(path)) return "Drift record";
  if (url.includes("#proof")) return "Version results below";
  return "Evidence";
}

function coverageQuestionTable(coverageEntry) {
  if (!coverageEntry?.coverage) return "<p>No question coverage record exists for this version.</p>";
  const rows = COVERAGE_QUESTIONS.map(([family, question]) => {
    const item = coverageEntry.coverage[family] ?? { status: "not_checked", evidence_urls: [] };
    const urls = item.evidence_urls ?? [];
    const visibleUrls = urls.slice(0, 3);
    const labels = visibleUrls.map((url) => coverageEvidenceLabel(url));
    const labelTotals = new Map(labels.map((label) => [label, labels.filter((itemLabel) => itemLabel === label).length]));
    const labelSeen = new Map();
    const links = visibleUrls.map((url, index) => {
      const label = labels[index];
      const occurrence = (labelSeen.get(label) ?? 0) + 1;
      labelSeen.set(label, occurrence);
      const displayLabel = labelTotals.get(label) > 1 ? `${label} ${occurrence}` : label;
      return `<a href="${escapeHtml(url)}">${escapeHtml(displayLabel)}</a>`;
    });
    if (urls.length > 3) links.push(`<a href="../changes.json">All ${urls.length} evidence links</a>`);
    return [question, coverageStatusLabel(item.status), links.length ? links.join(" · ") : "No linked result"];
  });
  return `<div class="card"><table class="coverage-table">
        <thead><tr><th>Question</th><th>Status</th><th>Evidence</th></tr></thead>
        <tbody>${rows.map(([question, status, evidence]) => `<tr>
          <td data-label="Question">${escapeHtml(question)}</td>
          <td data-label="Status">${escapeHtml(status)}</td>
          <td data-label="Evidence">${evidence}</td>
        </tr>`).join("")}</tbody>
      </table></div>
      <style>
        @media (max-width: 640px) {
          table.coverage-table { display: block; white-space: normal; overflow: visible; }
          .coverage-table thead { display: none; }
          .coverage-table tbody { display: block; }
          .coverage-table tr {
            display: grid;
            grid-template-columns: minmax(7.5rem, .38fr) minmax(0, 1fr);
            gap: 4px 10px;
            padding: 11px 0;
            border-bottom: 1px solid var(--line);
          }
          .coverage-table tr:last-child { border-bottom: 0; }
          .coverage-table td { display: block; width: auto; padding: 0; border: 0; white-space: normal; }
          .coverage-table td:first-child { grid-column: 1 / -1; color: var(--ink); font-weight: 650; }
          .coverage-table td:nth-child(n + 2)::before {
            content: attr(data-label) ": ";
            color: var(--muted);
            font-weight: 600;
          }
        }
      </style>`;
}

function buildRetentionSummary(catalog) {
  const publishedRows = (catalog.installerOciPackages ?? []).filter(
    (row) => row.publication_status === "published-receipt" && row.publication_receipt,
  );
  const publicationDates = publishedRows.map((row) => {
    const receiptPath = join(repoRoot, row.publication_receipt);
    check(existsSync(receiptPath), `${row.chart}@${row.version}: publication receipt is missing`);
    const observedAt = readYaml(receiptPath)?.spec?.observedAt;
    check(observedAt && !Number.isNaN(Date.parse(observedAt)), `${row.chart}@${row.version}: publication receipt has no valid observedAt`);
    return observedAt;
  }).sort();
  const replacedPairs = (catalog.upstreamDrift ?? []).filter((row) => {
    const retained = String(row.retained_sha256 ?? "");
    const republished = String(row.republished_sha256 ?? "");
    return /^[a-f0-9]{64}$/.test(retained) && /^[a-f0-9]{64}$/.test(republished) && retained !== republished;
  });

  check(publicationDates.length === publishedRows.length, "every published package must have a dated receipt");
  check(replacedPairs.length === (catalog.upstreamDrift ?? []).length, "every upstream republish row must name two different byte digests");

  return {
    policy: "additive_only",
    retained_components: new Set((catalog.installerOciPackages ?? []).map((row) => row.chart)).size,
    retained_package_versions: (catalog.installerOciPackages ?? []).length,
    published_package_versions: publishedRows.length,
    oldest_publication_receipt_at: publicationDates[0],
    upstream_republished_version_pairs: replacedPairs.length,
    license_gate: "evidence_required_before_listing",
    license_evidence_as_of: catalog.chartLicensesResearchedAt,
    evidence_urls: {
      policy: githubEvidenceUrl("docs/reference/how-the-catalog-is-built.md"),
      packages: githubEvidenceUrl("data/installer-oci-packages/summary.md"),
      upstream_republishes: githubEvidenceUrl("data/upstream-drift/summary.md"),
      licenses: githubEvidenceUrl("data/chart-licenses/chart-licenses.yaml"),
    },
  };
}

function buildChangesEntries(catalog) {
  const matrixByVersion = new Map();
  for (const row of catalog.masterCatalogMatrix ?? []) {
    if (row.row_kind !== "base") continue;
    const key = `${row.chart}|${row.version}`;
    if (!matrixByVersion.has(key)) matrixByVersion.set(key, []);
    matrixByVersion.get(key).push(row);
  }
  const routerByVersion = new Map(
    (catalog.chartEvidenceRouter ?? []).map((row) => [`${row.chart}|${row.version}`, row]),
  );
  const driftByVersion = new Map(
    (catalog.upstreamDrift ?? []).map((row) => [`${row.repository}/${row.chart}|${row.version}`, row]),
  );

  return (catalog.installerOciPackages ?? [])
    .map((row) => {
      const key = `${row.chart}|${row.version}`;
      const matrixRows = matrixByVersion.get(key) ?? [];
      const router = routerByVersion.get(key);
      const drift = driftByVersion.get(key);
      const canonical = canonicalUrl(`charts/${chartPageFileName(row)}`);
      const proofSection = `${canonical}#proof`;
      const valuesDiagnostics = `recipes/${row.chart}/${row.version}/values-diagnostics.yaml`;
      const chartAnalysisStatus = router?.coverage_status === "covered"
        ? "checked"
        : router
          ? "partial"
          : "not_checked";
      const promotionStatus = aggregateCoverage(matrixRows, "variant_promotion_status", ["proven"]);

      return {
        chart: row.chart,
        version: row.version,
        aliases: CHART_ALIASES[row.chart] ?? [],
        digest: row.published_digest || (row.rendered_yaml_sha256s ?? "").split(";")[0] || "",
        canonical_url: canonical,
        package_oci_ref: row.installer_oci_ref,
        coverage: {
          retained_package: coverageItem(
            row.publication_status === "published-receipt" && row.publication_receipt ? "checked" : "not_checked",
            [row.publication_receipt],
            canonical,
          ),
          chart_analysis: coverageItem(chartAnalysisStatus, [router?.coverage_evidence], proofSection),
          render_parity: coverageItem(
            aggregateCoverage(matrixRows, "lane_render_parity"),
            matrixRows.flatMap((item) => [item.variant_revision_path, item.render_intent_path]),
            proofSection,
          ),
          values_diagnostics: coverageItem(
            existsSync(join(repoRoot, valuesDiagnostics)) ? "checked" : "not_checked",
            [valuesDiagnostics],
            proofSection,
          ),
          lifecycle_observation: coverageItem(
            aggregateCoverage(matrixRows, "lane_lifecycle_observed"),
            matrixRows.flatMap((item) => [item.lifecycle_route_contract_path, item.target_run_receipt]),
            proofSection,
          ),
          local_kubernetes: coverageItem(
            aggregateCoverage(matrixRows, "lane_local_kind"),
            matrixRows.map((item) => item.target_run_receipt),
            proofSection,
          ),
          gitops_oci: coverageItem(
            aggregateCoverage(matrixRows, "lane_gitops_oci_live"),
            [router?.runtime_gitops_receipts],
            proofSection,
          ),
          live_parity: coverageItem(
            aggregateCoverage(matrixRows, "lane_live_dual_parity"),
            [router?.live_compare_receipts],
            proofSection,
          ),
          two_cluster: coverageItem(
            aggregateCoverage(matrixRows, "lane_two_cluster_kind"),
            matrixRows.map((item) => item.target_run_receipt),
            proofSection,
          ),
          promotion: coverageItem(
            promotionStatus,
            matrixRows.map((item) => item.variant_promotion_evidence),
            proofSection,
          ),
          upstream_republish: coverageItem(
            drift ? "checked" : "not_checked",
            [drift?.republished_witness, drift?.retained_evidence],
            proofSection,
          ),
        },
      };
    })
    .sort((left, right) => left.chart.localeCompare(right.chart) || left.version.localeCompare(right.version));
}

function buildChangesFeed(catalog, entries = buildChangesEntries(catalog)) {
  return `${JSON.stringify({
    schema_version: "1",
    generated_at: catalog.generatedAt,
    retention: buildRetentionSummary(catalog),
    entries,
  }, null, 2)}\n`;
}

function pageTitle(html) {
  return (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "Config Workshop").trim();
}

function pageDescription(html, relPath) {
  const fromMap = PAGE_DESCRIPTIONS[relPath];
  if (fromMap) return fromMap;
  const subject = pageTitle(html).replace(/\s*·\s*Config Workshop$/, "");
  if (html.includes("data-retained-only-version=")) {
    return `${subject}: retained package configurations, exact OCI publication receipt, and an explicit boundary that publication proof is not runtime proof.`;
  }
  if (relPath.startsWith("d/")) {
    return `${subject}: a repository document from the helm-expt proof corpus, rendered for the site.`;
  }
  return `${subject}: chart status, base variants, rendered objects, and evidence in the Config Workshop catalog.`;
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

function agentSkillDiscoveryIndex() {
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: "config-workshop",
        description: "Inspect, compare, promote, and retain Kubernetes configuration with exact source records, objects, lifecycle work, checks, and limits.",
        type: "skill-md",
        url: `${SITE_BASE_URL}.well-known/agent-skills/config-workshop/SKILL.md`,
      },
    ],
  };
}

function buildLlmsTxt() {
  return `# Config Workshop (helm-expt)

> A public configuration catalog and test workshop. It retains exact source records, Kubernetes objects, lifecycle work, checks, and evidence for Helm, AICR, Timoni, OCI, YAML, and ConfigHub paths.

- [Config Workshop agent skill](${SITE_BASE_URL}.well-known/agent-skills/config-workshop/SKILL.md): installable instructions for resolving exact Catalog entries, checking user configuration, reviewing promotions, and keeping checks and limits visible.
- [Use Config Workshop with an AI agent](${SITE_BASE_URL}ai.html): installation, realistic tasks, machine records, and the boundary between a proposed change and a reviewed result.
- [Catalog JSON](${SITE_BASE_URL}catalog.json): machine-readable summary of the catalog: components, retained versions, packaged configurations, counts, and the repo data paths they come from.
- [Change feed](${SITE_BASE_URL}changes.json): exact chart versions, aliases, package digests, declared coverage, canonical pages, and evidence URLs.
- [Change feed schema](${SITE_BASE_URL}changes.schema.json): the versioned JSON Schema for changes.json.
- [Component Catalog](${SITE_BASE_URL}charts/): 112 components, all 139 retained package versions, their packaged configurations, and version-specific publication or readiness evidence.
- [Master catalog matrix](${SITE_BASE_URL}matrix.html): one row per chart, version, and base with lane dispositions, hooks, quirks, and next actions.
- [Generated at](${SITE_BASE_URL}generated-at.txt): the timestamp of the last site generation.
- [Official ConfigHub tutorial](${CONFIGHUB_TUTORIAL_URL}): the canonical product journey from one component through release, change, production, and promotion.
- [Try Redis](${SITE_BASE_URL}try.html): render and inspect one public Redis configuration with no ConfigHub Server or account.
- [Try AICR](${SITE_BASE_URL}try-aicr.html): anonymously pull one retained AICR configuration, verify the seven-file CPU-starter selection, and write a local OCI without a cluster or GPU.
- [Timoni Redis source entry](${SITE_BASE_URL}d/examples/timoni/redis-8-10-1/README.html): one immutable module, its typed options, seven exact objects, master-first lifecycle work, and current test limits.
- [Versus what you already use](${SITE_BASE_URL}compare.html): what this answers versus helm template, kubectl diff, and Kustomize, with the disqualifier stated.
- [What changed](${SITE_BASE_URL}whats-new.html): the twenty newest receipts, from the committed aging table.
- [Check my config](${SITE_BASE_URL}ask.html): investigate a new chart, values set, AICR recipe, OCI package, Kubernetes object set, or existing deployment; compare exact objects; and retain a review record.
- [Run shared local checks](${SITE_BASE_URL}ask.html#check-command): after a source tool has written Kubernetes YAML, install the released plugin and run \`cub check --format json --output cub-check.json ./rendered\`. It is local and advisory; it does not upload, apply, or prove target behavior.
- [Promote my config](${SITE_BASE_URL}promote.html): compare current and proposed Kubernetes objects in the browser, retain their hashes, and see which tests remain before staging or production.
- [Configuration review schema](${SITE_BASE_URL}review.schema.json): the versioned record linking a question, source, object hashes, comparison, checks, limits, and recommendation.
- [Complete workshop result schema](${SITE_BASE_URL}workshop-result.schema.json): one browser-local bundle containing the exact files, their hashes, completed checks, omitted checks, and local or managed next steps.
- [CI report schema](${SITE_BASE_URL}workshop-ci-report.schema.json): the bounded Markdown/JSON report derived from WorkshopResult for local CI, pull-request comments, and AI tools.
- [Promotion review schema](${SITE_BASE_URL}promotion-review.schema.json): the record linking current and proposed objects, source-aware field changes, lifecycle work, exact target results, and checks that have not run.
- [Configuration decision schema](${SITE_BASE_URL}configuration-decision.schema.json): the source-neutral record for accepted fixes, rejected findings, scoped exceptions, managed validation, approvals, promotion, delivery, and authority boundaries.
- [Completed NGINX decision chain](${SITE_BASE_URL}d/data/config-review-decision-chain/summary.html): six accepted fixes, one narrow exception, a retained ConfigHub decision Unit, development-to-staging promotion, and two Argo CD test results.
- [Base variant records](${SITE_BASE_URL}base-variant-records.json): source-neutral Catalog records joining each maintained base to its exact source, objects, OCI package, prerequisites, lifecycle routes, policy, and evidence status.
- [Why did Helm ignore my values?](${SITE_BASE_URL}why-did-helm-ignore-my-values.html): compare the render with and without each supplied values key.
- [Did this chart version change?](${SITE_BASE_URL}did-this-chart-version-change.html): compare current package bytes with retained digests.
- [Did your Bitnami chart stop pulling?](${SITE_BASE_URL}did-your-bitnami-chart-stop-pulling.html): find a tested, verified successor for a Bitnami chart that no longer pulls anonymously.
- [Deploy with Flux or Argo CD](${SITE_BASE_URL}deploy-with-flux-or-argo.html): render any catalog chart to a controller-native OCI with one command and no account.
- [Why do development and production differ?](${SITE_BASE_URL}why-do-dev-and-prod-differ.html): use related configurations and promotion history instead of copied values files.
- [Does the cluster match the approved configuration?](${SITE_BASE_URL}does-cluster-match-approved-config.html): compare desired and live objects within the field coverage named by the receipt.
- [Helm investigation reference](${SITE_BASE_URL}challenge.html): worked Helm evidence and the benchmark behind the shorter Check my config flow.
- [Detailed Redis walkthrough](${SITE_BASE_URL}redis-walkthrough.html): add Helm parity, Kubernetes, OCI, upgrade, promotion, delivery, and rollback.
- [Examples](${SITE_BASE_URL}testing.html): working examples for starting inputs, managed operations, platforms, and ConfigHub Apps.
- [Deployment](${SITE_BASE_URL}how-it-works.html): choose whether reviewed objects stay as files, move through OCI, or become managed ConfigHub configuration.
- [Docs](${SITE_BASE_URL}docs.html): find instructions for the configuration or deployment step you are doing now.
- [Technical deployment reference](${SITE_BASE_URL}deployment-reference.html): the detailed model for source records, routes, variants, checks, and delivery.
- [All technical references](${SITE_BASE_URL}docs-reference.html): the complete guide and evidence index.
- [Continue with ConfigHub](${SITE_BASE_URL}confighub.html): sign up, follow the official tutorial, or read the ConfigHub blog.
- [Detailed entry paths](${SITE_BASE_URL}entry-path-reference.html): commands and proof links for Helm, AICR, OCI, and Kubernetes YAML.
- [Kubara with ConfigHub](${SITE_BASE_URL}kubara.html): decide why to add ConfigHub without rewriting Kubara, then follow the same six-step buyer and implementation journey.
- [Kubara six-step tutorial](${SITE_BASE_URL}d/docs/demo/kubara/adoption.html): choose, generate, push to Git, create OCI, load the selected organization, and deploy applications while Argo CD remains the reconciler.
- [Repo README](https://github.com/confighub/helm-expt#readme): the proof corpus itself: recipes, receipts, verifiers, and how the evidence is produced.

## Machine contract

Use changes.json to resolve an exact chart and version. Its schema_version defines the field meanings.

Read coverage before citing a verdict. Missing coverage means we have not checked that claim.

Use the canonical chart URL and cite the evidence URLs. Page copy is a guide, while receipts hold the evidence.

Schema version 1 keeps existing field meanings stable. A breaking change uses a new major version.

The retention object is computed from committed package receipts, license evidence, and upstream-republish records. Normal catalog refreshes are additive. Do not infer that a version was checked before its oldest_publication_receipt_at value.

When upstream_republished_version_pairs is non-zero, use the linked drift evidence. A version string alone is not enough to identify those bytes.

When an entry is absent, render locally. Ask the user before filing a public issue.
`;
}

function splitFragment(value) {
  const query = value.indexOf("?");
  const hash = value.indexOf("#");
  const suffixStart = [query, hash]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  if (suffixStart === undefined) return [value, ""];
  return [value.slice(0, suffixStart), value.slice(suffixStart)];
}

// Anything carrying a URI scheme is a reference, not a path this site can
// resolve, so the check must recognise the shape rather than a list of schemes
// someone remembered. The list missed oci://, which is how several charts name
// their source registry, and those references read as broken relative links the
// moment a page had reason to show one.
function isExternalHref(value) {
  return /^([a-z][a-z0-9+.-]*:|#)/i.test(value);
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
  // A line break is the one tag repository markdown uses inside a table cell,
  // because a cell cannot hold a paragraph. Escaping it printed <br> as text in
  // every cell of the Kubara matrix, 121 times on one published page, which
  // turned the page that exists to keep four facts apart into markup soup. It
  // carries no attributes and no scripting, so it is allowed back through.
  // Code spans are already placeholders here, so a literal `<br>` in backticks
  // stays literal.
  out = out.replace(/&lt;br\s*\/?&gt;/g, "<br>");
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

function docPageCss(repoPath) {
  const mobileTableCss = isHumanGuideDoc(repoPath) ? `    @media (max-width: 700px) {
      .doc-body table { display: block; width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .doc-body th, .doc-body td { min-width: 10rem; }
    }
` : "";
  return `
    .doc-body table { border-collapse: collapse; margin: 14px 0; font-size: .9rem; }
    .doc-body th, .doc-body td { border: 1px solid var(--line); padding: 7px 10px; text-align: left; vertical-align: top; }
    .doc-body th { background: var(--panel); }
    .doc-body blockquote { border-left: 3px solid var(--line); margin: 14px 0; padding: 4px 14px; color: var(--muted); }
    .doc-body img { max-width: 100%; }
    .doc-body h2 { margin-top: 28px; }
${mobileTableCss}  `;
}

function docPageHtml(catalog, repoPath, markdown, renderedDocs) {
  const relPath = renderedDocRelPath(repoPath);
  const base = pageBasePrefix(relPath);
  const title = docTitleOf(markdown, repoPath);
  const renderedBody = renderMarkdownBody(markdown.replace(/^#\s+.+$/m, ""), repoPath, renderedDocs);
  const outDir = posix.dirname(`site/${relPath}`);
  const sourceHref = posix.relative(outDir, repoPath);
  const { lead, body } = docPageContent(repoPath, sourceHref, renderedBody);
  const sourceStamp = docGeneratedStamp(catalog, repoPath);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Config Workshop</title>
  <style>${siteCss()}${docPageCss(repoPath)}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(base)}
    <h1>${escapeHtml(title)}</h1>
    <p class="lead">${lead}</p>
  </header>
  <main>
${sourceStamp ? `    ${sourceStamp}\n` : ""}    <article class="doc-body">
${body}
    </article>
  </main>
  <footer><p>Generated from the committed markdown file <code>${escapeHtml(repoPath)}</code>. The source file is the authoritative version.</p></footer>
</body>
</html>
`;
}

function isHumanGuideDoc(repoPath) {
  return ["docs/user/", "docs/demo/", "docs/reference/"].some((prefix) => repoPath.startsWith(prefix));
}

function docPageContent(repoPath, sourceHref, body) {
  if (isHumanGuideDoc(repoPath)) {
    if (repoPath.endsWith("/confighub-proof-transcript.md")) {
      return {
        lead: `Exact commands and output from this recorded ConfigHub example. Use the transcript when you need to check what actually ran. <a href="${sourceHref}">View source markdown</a>.`,
        body,
      };
    }
    for (const match of body.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
      const text = match[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z0-9#]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length < 40) continue;
      if (/^(unofficial|experimental|status\b|owner\b|audience\b|scope\b|generated\b)/i.test(text)) continue;
      const start = match.index;
      const end = start + match[0].length;
      return {
        lead: `${match[1]} <a href="${sourceHref}">View source markdown</a>.`,
        body: `${body.slice(0, start)}${body.slice(end)}`,
      };
    }
  }
  return { lead: docPageLead(repoPath, sourceHref), body };
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
  if (isHumanGuideDoc(repoPath)) return "";
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

// Shared footer navigation. Surfaces the top-level pages the seven-item top nav
// leaves out (proof, verification, offering, what's new, the Flux and Argo
// entry, and more) so every page offers a next step, and carries the ConfigHub
// keep-a-result link on every page. Injected centrally for the top-level pages
// only; redirect stubs and generated doc or chart pages are left untouched.
function siteFooterCss() {
  return `  .site-footer { border-top: 1px solid var(--line); margin-top: 56px; background: var(--surface-2); }
  .site-footer-inner { max-width: 1080px; margin: 0 auto; padding: 28px 20px 36px; display: grid; grid-template-columns: repeat(4, 1fr) auto; gap: 22px 30px; }
  .site-footer .sf-group { display: flex; flex-direction: column; gap: 7px; }
  .site-footer .sf-h { font-family: var(--mono, ui-monospace, monospace); font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--faint); margin-bottom: 2px; }
  .site-footer a { text-decoration: none; color: var(--muted); font-size: .86rem; }
  .site-footer a:hover { color: var(--accent-ink, var(--ink)); }
  .site-footer .sf-cta a { color: var(--accent-ink, var(--ink)); font-weight: 600; }
  @media (max-width: 720px) { .site-footer-inner { grid-template-columns: 1fr 1fr; } }`;
}

function siteFooterNav(relPath) {
  const base = pageBasePrefix(relPath);
  const a = (path, label) => `<a href="${base}/${path}">${label}</a>`;
  const group = (heading, links) => `<div class="sf-group"><span class="sf-h">${heading}</span>${links.join("")}</div>`;
  return `<nav class="site-footer" aria-label="More of Config Workshop"><div class="site-footer-inner">`
    + group("Start", [a("testing.html", "Find a configuration"), a("ask.html", "Check my config"), a("promote.html", "Promote my config"), a("charts/index.html", "Catalog")])
    + group("Deploy", [a("deploy-with-flux-or-argo.html", "Deploy with Flux or Argo"), a("serverless.html", "Serverless"), a("kubara.html", "Build a platform"), a("operations.html", "Operations")])
    + group("Why trust it", [a("proof.html", "Proof"), a("verification.html", "Verification"), a("known-gaps.html", "Known gaps"), a("security.html", "Security")])
    + group("More", [a("docs.html", "Docs"), a("ai.html", "AI agents"), a("compare.html", "Compare"), a("whats-new.html", "What's new"), a("offering.html", "Offering")])
    + `<div class="sf-group sf-cta"><span class="sf-h">ConfigHub</span>${signupLink("footer", "Upload a result into ConfigHub")}${a("confighub.html", "Why ConfigHub")}</div>`
    + `</div></nav>`;
}

function injectSiteFooterNav(html, relPath) {
  if (PAGE_REDIRECT_TARGETS[relPath]) return html;
  if (html.includes('class="site-footer"')) return html;
  const withCss = html.includes("</style>")
    ? html.replace("</style>", `${siteFooterCss()}\n  </style>`)
    : html;
  const nav = siteFooterNav(relPath);
  return withCss.includes("</body>")
    ? withCss.replace("</body>", `${nav}\n</body>`)
    : `${withCss}\n${nav}`;
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
    finalized[key] = injectSiteFooterNav(finalizePage(site[key], relPath, docs.rendered), relPath);
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

// Every relative href/src and every absolute link back into this public site
// must resolve to a generated file or directory. Raw-markdown dead ends, stale
// public URLs, and depth bugs fail here.
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
      const publicSitePath = value.startsWith(SITE_BASE_URL)
        ? value.slice(SITE_BASE_URL.length) || "index.html"
        : null;
      if (isExternalHref(value) && publicSitePath === null) continue;
      const resolved = publicSitePath === null
        ? resolveRelativeHref(pageDir, value)
        : resolveRelativeHref(siteRoot, publicSitePath);
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
  console.log(`verified site relative and public-site links across ${htmlFiles.length} page(s) (${skippedRunLinks} runs/ proof pointer(s) not checked)`);
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
  return `<div class="site-chrome"><nav class="topbar"><a class="brand" href="${link("index.html")}" title="Home"><svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 1.5 14.5 7h-2v7H9.5v-4h-3v4H3.5V7h-2L8 1.5z"/></svg>Config Workshop</a><span class="site-purpose">AN EXPERIMENTAL TEST SITE FOR CONFIG TOOLS</span><span class="navlinks"><a href="${link("ai.html")}">AI agents</a><a href="${link("charts/index.html")}">Catalog</a><a href="${link("ask.html")}">Check my config</a><a href="${link("promote.html")}">Promote my config</a><a href="${link("how-it-works.html")}">Deployment</a><a href="${link("docs.html")}">Docs</a><a href="${link("confighub.html")}">ConfigHub</a></span></nav></div>`;
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

// Config Workshop homepage: the design-language home page (self-contained,
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
  .site-identity { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .wordmark { font-family: var(--mono); font-size: .84rem; color: var(--ink); font-weight: 640; display: inline-flex; align-items: center; gap: 9px; text-decoration: none; }
  .wordmark .sq { width: 15px; height: 15px; border-radius: 4px; background: var(--accent); }
  .site-purpose { font-family: var(--mono); font-size: .68rem; color: var(--faint); text-transform: uppercase; letter-spacing: 0; }
  .navlinks { display: flex; gap: 18px; font-size: .86rem; color: var(--muted); flex-wrap: wrap; }
  .navlinks a { text-decoration: none; color: var(--muted); }
  .navlinks a:hover { color: var(--accent-ink); }

  .hero-head { padding: 34px 0 0; border-top: 1px solid var(--line); }
  .hero-head h1 { font-size: clamp(2rem, 4.3vw, 3.05rem); font-weight: 780; letter-spacing: -.025em; line-height: 1.05; margin: 12px 0 0; max-width: none; }
  /* Top-aligned, not centred: the right column carries the terminal and two
     notes now, so centring dropped the lead half a screen below the headline
     and left a hole where the reader looks first. */
  .boundary-chip { display: inline-block; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.02em; padding: 3px 10px; border: 1px solid var(--line); border-radius: 999px; margin: 4px 0 0; }
  .hero { display: grid; grid-template-columns: 1.05fr .95fr; gap: 34px; align-items: start; padding: 22px 0 30px; }
  .hero h1 { font-size: clamp(2rem, 4.3vw, 3.05rem); font-weight: 780; letter-spacing: -.025em; line-height: 1.05; margin: 12px 0 16px; }
  .hero .lead { font-size: 1.08rem; color: var(--muted); margin: 0 0 22px; max-width: 46ch; }
  .cta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .qtable { width: 100%; border-collapse: collapse; margin: 18px 0 22px; font-size: .95rem; }
  .qtable th, .qtable td { text-align: left; vertical-align: top; padding: 10px 12px; border-top: 1px solid var(--line); }
  .qtable th { color: var(--muted); font-weight: 600; font-size: .82rem; letter-spacing: .02em; text-transform: uppercase; }
  .qtable td:first-child { font-weight: 650; white-space: nowrap; }
  .btn { font-family: var(--sans); font-size: .92rem; font-weight: 560; padding: 11px 18px; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; border: 1px solid transparent; }
  .btn.primary { background: var(--accent); color: #fff; }
  @media (prefers-color-scheme: dark){ .btn.primary { color: #04222c; font-weight: 640; } }
  :root[data-theme="dark"] .btn.primary { color: #04222c; font-weight: 640; }
  :root[data-theme="light"] .btn.primary { color: #fff; }
  .btn.ghost { border-color: var(--line-strong); color: var(--ink); background: var(--surface); }
  .btn.ghost:hover { border-color: var(--accent); }
  /* The third action is a different kind of thing from the first two. They are
     jobs a reader arrived with; this one is a way to understand the tool. Given
     equal weight it competed with them, so it reads as a link that happens to
     sit on the same line. */
  .btn.quiet { color: var(--muted); padding-left: 6px; padding-right: 6px; }
  .btn.quiet:hover { color: var(--ink); text-decoration: underline; }
  .sources { font-family: var(--mono); font-size: .74rem; color: var(--faint); display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .sources b { color: var(--muted); font-weight: 600; }

  .term { background: var(--term-bg); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); font-family: var(--mono); }
  /* The explanations belong against the command they explain. Left to the
     injectors both notes landed as bare paragraphs at the top of the first
     section, orphaned from the terminal they describe, which read as a layout
     accident. Do not write an HTML tag into this comment: an injector searches
     the rendered page for one, and it will inject into the stylesheet. */
  .hero-term { display: grid; gap: 13px; }
  .term-note { margin: 0; font-size: .84rem; line-height: 1.6; color: var(--muted); }
  .term-note b { color: var(--ink); font-weight: 650; }
  .term-note code { font-family: var(--mono); font-size: .95em; }
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

  .verbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
  .verb { border-top: 2px solid var(--line-strong); padding: 14px 14px 0 0; display: flex; flex-direction: column; gap: 8px; }
  .verb .n { font-family: var(--mono); font-size: .66rem; color: var(--faint); letter-spacing: .05em; }
  .verb h3 { margin: 0; font-size: 1.02rem; font-weight: 700; }
  .verb p { margin: 0; font-size: .82rem; color: var(--muted); line-height: 1.4; }
  .verb .route { font-family: var(--mono); font-size: .62rem; text-transform: uppercase; letter-spacing: .05em; color: var(--accent-ink); margin-top: auto; padding-top: 4px; }

  .routes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .route-card { border: 1px solid var(--line); border-radius: 13px; padding: 17px; background: var(--surface); box-shadow: var(--shadow); text-decoration: none; transition: border-color .15s ease; }
  .route-card:hover { border-color: var(--accent); }
  .route-card.mid { border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
  .route-card h3 { margin: 0 0 4px; font-size: .96rem; font-weight: 700; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .route-card .tag { font-family: var(--mono); font-size: .6rem; text-transform: uppercase; letter-spacing: .06em; color: var(--faint); border: 1px solid var(--line-strong); border-radius: 999px; padding: 2px 8px; }
  .route-card.mid .tag { color: var(--accent-ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
  .route-card p { margin: 6px 0 0; font-size: .84rem; color: var(--muted); line-height: 1.45; }
  .route-card .go { display: block; margin-top: 12px; color: var(--accent-ink); font-family: var(--mono); font-size: .68rem; text-transform: uppercase; }

  footer.foot { border-top: 1px solid var(--line); margin-top: 20px; padding: 26px 0 50px; }
  footer.foot .flip { font-size: 1.06rem; color: var(--ink); font-weight: 600; max-width: 54ch; margin: 0 0 10px; }
  footer.foot .sub { font-size: .82rem; color: var(--faint); margin: 0; }

  @media (max-width: 880px) {
    .hero { grid-template-columns: 1fr; gap: 24px; }
    .verbs { grid-template-columns: repeat(2, 1fr); }
    .routes { grid-template-columns: 1fr; }
  }
  @media (max-width: 520px) { .verbs { grid-template-columns: 1fr; } }

  /* --- quality floor: keyboard focus and reduced motion --- */
  a:focus-visible, button:focus-visible, input:focus-visible,
  select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 3px;
  }
  a:focus:not(:focus-visible) { outline: none; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .001ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
}

function configTestCentreHome(catalog) {
  const nextSteps = ["install-shape", "config-diff", "ignored-values", "custom-field"]
    .map((code, index) => ({
      code,
      number: String(index + 1).padStart(2, "0"),
      ...CONFIGURATION_QUESTIONS[code],
      observed: CONFIGURATION_QUESTION_RESEARCH.counts[code],
    }));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Config Workshop &middot; Understand and test your configuration</title>
  <style>${homeDesignCss()}</style>
</head>
<body>
  <div class="wrap">
    <div class="page">
      <header>
        <nav class="bar">
          <span class="site-identity"><a class="wordmark" href="./index.html"><span class="sq"></span>Config Workshop</a><span class="site-purpose">AN EXPERIMENTAL TEST SITE FOR CONFIG TOOLS</span></span>
          <span class="navlinks">
            <a href="./ai.html">AI agents</a>
            <a href="./charts/index.html">Catalog</a>
            <a href="./ask.html">Check my config</a>
            <a href="./promote.html">Promote my config</a>
            <a href="./how-it-works.html">Deployment</a>
            <a href="./docs.html">Docs</a>
            <a href="./confighub.html">ConfigHub</a>
          </span>
        </nav>
        <div class="hero-head">
          <span class="eyebrow">Helm first &middot; AICR, Timoni, OCI and YAML examples</span>
          <h1>See what your configuration will do</h1>
        </div>
        <div class="hero">
          <div>
            <p class="lead">Bring the configuration you or your AI just created. Config Workshop renders it to the exact Kubernetes objects it produces, compares them with a configuration you already trust, and gives you a reviewed result you can keep.</p>
            <p class="lead">It runs on your laptop, and you can start without an account. Keep what you approve as files or <a href="./promote.html">OCI</a>, or upload it to <a href="./confighub.html">ConfigHub</a> when your team needs a shared record.</p>
            <div class="cta-row">
              <a class="btn primary" href="./ask.html">Check my config</a>
              <a class="btn ghost" href="./testing.html#start">Find a configuration</a>
              <a class="btn quiet" href="./promote.html">Promote my config</a>
            </div>
          </div>
          <div class="hero-term">
          <div class="term" aria-label="The ladder: check a config free, certify a platform free, release by digest with an account">
            <div class="term-bar"><span class="d"></span><span class="d"></span><span class="d"></span><span class="t">one ladder &middot; free check &rarr; certified platform &rarr; governed release</span></div>
            <pre class="term-body"><code><span class="cmt"># free: what will this chart install?</span>
<span class="pr">$</span> cub config check redis
14 objects: 3 ConfigMap, 1 NetworkPolicy, 2 PodDisruptionBudget,
1 Secret, 3 Service, 2 ServiceAccount, 2 StatefulSet

<span class="cmt"># free: certify and render a whole platform</span>
<span class="pr">$</span> cub stack sandbox eks-inference
=> <span class="verdict">CERTIFIED</span>  130 objects from 8 digest-pinned certified bundles

<span class="cmt"># with an account: hold it as data, release by digest</span>
<span class="pr">$</span> cub variant upload <span class="k">--component</span> redis <span class="k">--variant</span> base redis.yaml
<span class="pr">$</span> cub release publish redis-app
Your Argo CD or Flux applies exactly the published digest: <span class="ok">verified</span></code></pre>
          </div>
          <p class="term-note"><b>Where these commands come from.</b> <code>cub variant upload</code> and <code>cub release publish</code> are ConfigHub itself. <code>cub config</code>, <code>cub app</code>, <code>cub stack</code>, and <code>cub fleet</code> are <a href="./d/docs/planning/custom-stacks-and-apps.html">proposed verbs</a> running today as a plugin prototype, with a receipt behind every run shown here. Underneath, the released <code>cub installer</code> does the packaging: see <a href="./how-it-works.html">Deployment</a>.</p>
          <p class="term-note"><b>Before you run it.</b> <a href="./try.html#install-cub">Install the cub CLI</a>. The <a href="./ask.html">browser check</a> needs nothing installed, and public catalog packages are open to anyone.</p>
          </div>
        </div>
      </header>

      <main>
        <section class="section">
          <span class="eyebrow">Six starting questions</span>
          <h2>What do you need help with?</h2>
          <p class="intro">Config Workshop is this demonstration site for ConfigHub, and <code>cub</code> is the ConfigHub command-line tool.</p>
          <p class="intro">Start with the question you have now. Each path gives you exact files, a result you can keep, and commands for continuing on your machine.</p>
          <form action="./charts/index.html" method="get" style="display:flex;gap:8px;max-width:520px;margin:0 0 16px"><input type="search" name="q" placeholder="Find a chart: redis, kube-prometheus-stack, traefik..." style="flex:1;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)"><button class="btn primary" type="submit">Search</button></form>
          <p class="intro"><strong>Without an account:</strong> render a configuration, inspect it, and keep the files or OCI. <strong>With ConfigHub:</strong> retain the accepted result, promote it, and compare it with live systems.</p>
          <div class="routes">
            <a class="route-card" href="./testing.html#start"><h3>1. I need a configuration <span class="tag">${catalog.summary.retainedComponents} components</span></h3><p>Choose the job you need done. Start from a tested configuration, an exact version, and the requirements already found. Every published version remains available from the public Catalog registry.</p><span class="go">Find a starting point &rarr;</span></a>
            <a class="route-card mid" href="./ask.html"><h3>2. I have a configuration. Is it right? <span class="tag">local check</span></h3><p>Bring values, YAML, OCI, or work made by AI. See the exact objects, the differences that matter, and the checks that did not run.</p><span class="go">Check my config &rarr;</span></a>
            <a class="route-card" href="./promote.html"><h3>3. I have an accepted configuration. Can I promote it? <span class="tag">compare first</span></h3><p>Compare the accepted result with staging or production. Check the destination and required setup before moving the exact revision.</p><span class="go">Promote my config &rarr;</span></a>
            <a class="route-card" href="./kubara.html"><h3>4. I want my own platform, with apps on it <span class="tag">recorded live</span></h3><p>Choose tested components and generate a Kubara platform. Govern it in ConfigHub, deploy applications through it, promote exact revisions, and roll back one target without touching its peer. Recorded live on four clusters, with receipts.</p><span class="go">Build the platform &rarr;</span></a>
            <a class="route-card" href="./deploy-with-flux-or-argo.html"><h3>5. I already run Flux or Argo CD <span class="tag">keep your reconciler</span></h3><p>Render a reviewed chart to a controller-native OCI with one command and no account, then reconcile it the way you do today. Receipts show each reconciler applying exactly the published digest, byte for byte, through a governed change.</p><span class="go">Keep your reconciler &rarr;</span></a>
            <a class="route-card" href="./d/docs/planning/stack-manifest-spec.html"><h3>6. I run many clusters. What needs attention? <span class="tag">fleet as data</span></h3><p>Declare which stacks and apps land on which clusters, then generate the whole fleet through the governed verbs. Its attention states come from the same queries the product renders: blocked gates, unreleased changes, and pending rollouts. Generated live, with receipts.</p><span class="go">See the fleet model &rarr;</span></a>
          </div>
          <p class="intro"><strong>The vocabulary:</strong> a <a href="./ask.html">config</a> is one chart. An <a href="./custom-apps.html">app</a> is a workload. A <a href="./d/docs/planning/stack-manifest-spec.html">stack</a> is a certified composition. A <a href="./d/docs/planning/stack-manifest-spec.html">fleet</a> is placement as data. One free look and one governed ladder, at every size.</p>
          <p class="intro"><strong>Upstream moved or vanished?</strong> If a chart no longer pulls anonymously, start from <a href="./did-your-bitnami-chart-stop-pulling.html">a tested successor</a>. If a version now points at different bytes, run <a href="./did-this-chart-version-change.html">the digest-drift check</a>.</p>
          <p class="intro"><a href="./confighub.html"><strong>Upload it into ConfigHub, release it, and promote it</strong></a> when the answer has to be shared, approved, and moved from development to production. Public config chains into your private org here, and the object digest travels with it.</p>
          <p class="intro"><strong>Running AI on GPUs?</strong> <a href="./try-aicr.html">Inspect a retained AI-platform configuration without a GPU</a>, or compare the GPU nodes you already run. The same review-and-evidence method you use for a Helm chart, applied to AI platforms.</p>
          <p class="intro"><strong>Additional paths:</strong> <a href="./testing.html#worked-stories">see six worked examples</a>, <a href="./try.html">run the short Redis example</a>, <a href="./d/docs/user/gitops-adopter-guide.html">choose a deployment method</a>, or <a href="./compare.html">compare this with existing tools</a>.</p>
        </section>

        <section class="section">
          <span class="eyebrow">Common questions</span>
          <h2>Four common Helm questions</h2>
          <p class="intro">These appeared most often in a review of 40 recent public Helm discussions. This is a small research sample, not customer or site usage data.</p>
          <div class="verbs">
            ${nextSteps.map((item) => `<div class="verb"><span class="n">${item.number}</span><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.answer)}</p><p><a href="./ask.html#${escapeHtml(item.code)}">Start this check &rarr;</a></p><span class="route">${item.observed} of ${CONFIGURATION_QUESTION_RESEARCH.sampleSize} discussions</span></div>`).join("\n            ")}
          </div>
          <div class="cta-row" style="margin-top:22px"><a class="btn ghost" href="./how-it-works.html">Choose a deployment path</a><a class="btn ghost" href="./confighub.html">See what ConfigHub adds</a></div>
        </section>

        <section class="section">
          <span class="eyebrow">Evidence</span>
          <h2>Check the result and the limits</h2>
          <p class="intro">A tested example names its source, its version, and the objects it produces, then records which checks ran against it. The page says which checks did not run, and known gaps stay visible.</p>
          <p class="intro">Four questions sit behind every result. Each one needs its own input and can only claim its own kind of answer, so we keep them apart rather than rolling them into a single verdict.</p>
          <table class="qtable">
            <thead><tr><th>Question</th><th>What it needs</th><th>What it can tell you</th></tr></thead>
            <tbody>
              <tr><td>What do I have?</td><td>Source files, an OCI, or a snapshot.</td><td>Source identity, contents, and differences you can see locally.</td></tr>
              <tr><td>What will it produce?</td><td>The source-native processor and its recorded choices.</td><td>The exact object set, and its identity.</td></tr>
              <tr><td>Can this destination accept it?</td><td>The candidate, plus current facts from the named destination.</td><td>API, CRD, Secret, policy and credential readiness for that destination.</td></tr>
              <tr><td>Did it work?</td><td>The exact delivered revision, deployed, with live evidence.</td><td>Controller, workload, drift and rollback results that were actually checked.</td></tr>
            </tbody>
          </table>
          <p class="intro">A missing prerequisite is reported as blocked or not-run. It is a different result from a configuration that failed, and we keep the two labelled apart.</p>
          <div class="cta-row"><a class="btn ghost" href="./ask.html">Check my config</a><a class="btn ghost" href="./verification.html">Open verification</a><a class="btn ghost" href="./known-gaps.html">Read known gaps</a></div>
        </section>
      </main>

      <footer class="foot">
        <p class="flip">You know the saying about not wanting to see how the sausage gets made. We show you the ingredients we can see before you install, and name the ones we cannot.</p>
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

function deploymentReferenceHtml(catalog) {
  const policyFacts = applyPolicyFacts();
  const sourceCoverage = policySourceCoverage(policyFacts);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Technical Deployment Reference · Config Workshop</title>
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
    <h1>Technical deployment reference</h1>
    <p class="lead">Use this page when you need the detailed model behind source records, rendered objects, routes, variants, checks, and OCI delivery.</p>
    <p>For the short decision path, start with <a href="./how-it-works.html">Choose how to deploy it</a>.</p>
    <p>Use the <a href="./try.html">short package exercise</a> to inspect one public package without a ConfigHub server, account, or cluster. Use the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "how-it-works")}">official ConfigHub tutorial</a> when you want to save, change, and promote configuration with your team.</p>
  </div>
</header>
<main>

  <h2>1 · Three ConfigHub terms</h2>
  <p>These terms describe what ConfigHub stores and where a configuration is intended to run.</p>
  <table class="gtable" style="display:table;table-layout:fixed;white-space:normal">
    <tr><th style="width:22%">Term</th><th>Meaning</th></tr>
    <tr><td><a href="${confighubOutboundUrl(CONFIGHUB_COMPONENT_DOC_URL, "deployment-terms")}"><strong>Component</strong></a></td><td>The software and all the configurations that belong to it.</td></tr>
    <tr><td><a href="${confighubOutboundUrl(CONFIGHUB_VARIANT_DOC_URL, "deployment-terms")}"><strong>Variant</strong></a></td><td>One complete configuration. A base is the shared starting point. A deployment variant is the configuration for an environment, region, customer, or other operating context.</td></tr>
    <tr><td><a href="${confighubOutboundUrl(CONFIGHUB_TARGET_DOC_URL, "deployment-terms")}"><strong>Target</strong></a></td><td>Where a deployment variant is intended to run. It is a delivery address, not a connection from ConfigHub into the cluster.</td></tr>
  </table>

  <h3>Four questions use different evidence</h3>
  <table class="gtable">
    <tr><th>Question</th><th>Required input</th><th>Boundary</th></tr>
    <tr><td><strong>What do I have?</strong></td><td>Source, exact files, OCI, or a snapshot.</td><td>No Catalog match or deployment is required. A live snapshot needs read access to what it measures.</td></tr>
    <tr><td><strong>What will it produce?</strong></td><td>The source-native processor and recorded choices, unless the source is already literal configuration.</td><td>No destination is required.</td></tr>
    <tr><td><strong>Can this destination accept it?</strong></td><td>The exact candidate and current facts from the named destination.</td><td>Destination access is required; deployment is not.</td></tr>
    <tr><td><strong>Did it work?</strong></td><td>The exact delivered revision and live evidence required by the claim.</td><td>The selected revision must be deployed.</td></tr>
  </table>
  <p>Every Catalog base records these answers separately. Missing prerequisites are blocked or not run, not failed conformance. <a href="./d/data/config-assessment-stages/summary.html">Open the cross-format cases</a>.</p>

  <h3>Why keep the rendered objects</h3>
  <p>ConfigHub keeps the exact objects you reviewed, so you can change one field later without re-running Helm. The full comparison with helm template, kubectl diff, and Kustomize lives on <a href="./compare.html">its own page</a>, with the honest boundary stated.</p>

  <h3 id="setting-sources">Where a setting belongs</h3>
  <p>There are four places to look. Keeping them separate answers both questions: what should control a setting, and what controls it now.</p>
  <table class="gtable">
    <tr><th>Place</th><th>Use it for</th><th>What happens on upgrade</th></tr>
    <tr><td><strong>Helm values</strong></td><td>Choose the base configuration: components, object count, storage mode, CRDs, ingress, Secret strategy, topology, or another choice that changes what Helm renders.</td><td>Change the recorded values and render a new base. The values profile remains linked to the objects it produced.</td></tr>
    <tr><td><strong>ConfigHub changes</strong></td><td>Change an exact field after render when the base is right but an environment, region, customer, policy, image, label, resource, or other object field must differ.</td><td>The edit is a Unit revision or derived variant. ConfigHub keeps it when the upgraded base does not change the same field. If both change that field, review the overlap before promotion.</td></tr>
    <tr><td><strong>Install work</strong></td><td>Provide Secrets, CRDs, target facts, hooks, setup jobs, certificates, or other work needed around the objects.</td><td>The prerequisite or route is checked again. It is not hidden as a Helm value or a ConfigHub edit.</td></tr>
    <tr><td><strong>Live cluster</strong></td><td>Observe what actually ran and compare it with the reviewed objects.</td><td>A live-only edit is drift. Record an intended fix in ConfigHub, or remove the drift.</td></tr>
  </table>
  <p><strong>One field should not have two silent owners.</strong> If a new Helm render and a ConfigHub revision both change the same field, review the overlap before promotion and choose the intended result.</p>

  <h3>When this helps</h3>
  <p>This becomes useful when Helm values are not enough, an upgrade changes more than expected, or a private chart is hard to review. Keep Helm as the source. Review the exact objects, record deliberate changes, and promote the same reviewed result instead of maintaining a permanent chart fork or a hard-to-follow overlay.</p>

  <h2>2 · Choose a starting configuration</h2>
  <p>The catalog covers the most-used charts. Each chart is rendered, checked against plain Helm, scanned, and given an honest status. Today's proven scope:</p>
  <div class="scope">
    <div class="count"><b>20</b><span>charts live-tested end to end</span></div>
    <div class="count"><b>${catalog.installerOciPackages.length}</b><span>retained published package versions</span></div>
    <div class="count"><b>2</b><span>reviewed bases per chart</span></div>
    <div class="count"><b>8</b><span>standard base shapes</span></div>
    <div class="count"><b>396</b><span>matrix rows tracked</span></div>
  </div>
  <p>Each chart page names a recommended starting configuration and any reviewed alternatives. These base variants use a fixed vocabulary that says what they change:</p>
  <p>Operators choose a vetted package release and a named base variant. They set only the small number of inputs that remain at install time. The catalog does not expose every Helm value again. It provides common paths that are reviewed, repeatable, and safe to reconcile across many installs.</p>
  <table class="gtable">
    <tr><th>Base configuration</th><th>What it changes</th></tr>
    <tr><td><code>default</code></td><td>The chart's named default render. It is a reference point, not automatically the configuration we recommend for installation.</td></tr>
    <tr><td><code>parameterized</code></td><td>The same object set as the default, with a small number of fields exposed as placeholders.</td></tr>
    <tr><td><code>existing-secret</code></td><td>Bring your own Secret instead of a generated one.</td></tr>
    <tr><td><code>no-crds</code></td><td>CRDs owned externally (by a controller or GitOps).</td></tr>
    <tr><td><code>ha</code></td><td>High-availability / scaled-out mode.</td></tr>
    <tr><td><code>ingress-tls</code></td><td>Exposed via ingress with TLS.</td></tr>
    <tr><td><code>minimal</code> · <code>tls</code></td><td>Lean install; or bring-your-own TLS material.</td></tr>
  </table>

  <h3>Three ways to create a base variant</h3>
  <p>ConfigHub can start from more than a Helm chart. Every maintained base has a <strong>source and intent record</strong>. It says where the objects came from and which choices produced them. It also records what remains to be supplied and which checks support the result. The role is standard, but the file matches the source instead of pretending every source is Helm.</p>
  <table class="gtable">
    <tr><th>Starting point</th><th>Source and intent record</th><th>How it enters ConfigHub</th></tr>
    <tr><td>Helm chart</td><td><code>HelmRenderIntent</code>: chart version, preset values, release context, source lock, literal objects, and known hooks or CRDs.</td><td>Render a <code>cub installer</code> package. Keep the files locally, write the selected preset as OCI with <code>--output-oci</code>, or upload either form as a base variant.</td></tr>
    <tr><td>AICR</td><td>A read-only GPU-node snapshot needs no recipe. Recipe-dependent generation records the AICR recipe, fixed component versions, remaining install-time inputs, generated bundle, checksums, and public OCI digest.</td><td>Use snapshot and diff to inspect existing nodes. For a selected platform, keep the generated source package for Argo CD and upload the separate literal configuration OCI as a base variant. The <a href="../docs/demo/aicr/eks-h100-training-kubeflow.md">AICR GPU platform example</a> shows the public packages, 17 exact Applications, development change, and staging promotion.</td></tr>
    <tr><td>Existing OCI</td><td>The input reference and digest, package role, object inventory, checks, and any recorded transformation.</td><td><code>cub variant upload --component &lt;name&gt; --variant base oci://...</code> creates the base Space and Units from the configuration bundle.</td></tr>
    <tr><td>Existing Kubernetes YAML</td><td>The source revision or path, file checksums, object inventory, checks, and later OCI or ConfigHub revision.</td><td><code>cub variant upload --component &lt;name&gt; --variant base &lt;files&gt;</code> creates the base Space and Units.</td></tr>
  </table>
  <p>The generated <a href="../data/base-variant-records/summary.md">base-variant records</a> use one record format for these sources. The record distinguishes a multi-preset source package OCI, a single literal configuration OCI, and the later ConfigHub release OCI used for delivery.</p>
  <p>Today, the source and intent role may use a source Unit, Space metadata plus a committed receipt, or a generated base-variant record. ConfigHub does not yet have one first-class source object for every format. The <a href="./d/docs/reference/config-catalog-doctrine.html">catalog doctrine</a> defines the role in full.</p>

  <h2>3 · See what ConfigHub keeps</h2>
  <p>Every retained configuration has a source and intent record. For Helm, that record is the <code>HelmRenderIntent</code>: chart, version, values, release context, source lock, and lifecycle choices. AICR keeps its native recipe and generation receipts. OCI and plain YAML keep equivalent source records without being mislabeled as recipes. ConfigHub retains the exact objects as a base variant and manages later variants from that base.</p>
  <p>After upload, use <code>cub k8s</code> to read the Kubernetes objects stored in ConfigHub:</p>
  <p class="install-cub-note">New to <code>cub</code>? <a href="./try.html#install-cub">Install the cub CLI</a> first. Commands that read ConfigHub Server data require you to sign in.</p>
  <pre><code>cub k8s types --space &lt;variant-space&gt;
cub k8s get deploy --space &lt;variant-space&gt;
cub k8s get all --space &lt;variant-space&gt; --show data</code></pre>
  <p class="quiet-line">These commands read desired configuration in ConfigHub. They do not read live cluster state.</p>
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
    <span class="ftag">SOURCE</span><span class="codetag">F1 · source</span>
    <h3>Record the source and choices</h3>
    <p>Record the source version, choices, and locks before producing Kubernetes objects. Helm and AICR call some of these source documents recipes. OCI and plain YAML use source records suited to those formats.</p>
  </div>

  <div class="fstage star">
    <span class="ftag">MATERIALIZE</span><span class="codetag">F2 · exact base</span>
    <h3>Produce or read the exact objects</h3>
    <p>A <strong>base variant</strong> is a <a href="./charts/index.html#base-variants">named render choice</a> such as default, no-crds, or ha. Its <strong>render intent</strong> records the chart version, values profile, namespace, capabilities, and source lock.</p>
    <p>Helm renders those inputs. AICR and Kubara generate or compose. Literal YAML and configuration OCI already contain objects, so this step only reads and checks them. The result is an exact Kubernetes object set with an inventory and digest.</p>
    <p>Make a new base variant when the source inputs should produce a different object set. Use a derived ConfigHub variant when one environment needs an exact field changed after render.</p>
    <p><strong>Redis example:</strong> the <code>default</code> base has an exact public package, <code>${REDIS_INSTALLER_PINNED_OCI_REF}</code>. Its <a href="../data/helm-render-intents/intents/bitnami-redis-25-5-3-default.yaml">render intent</a> records the Helm inputs. Its <a href="../recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml">release-objects.yaml</a> contains the full rendered output.</p>
    <p>The <a href="../recipes/bitnami/redis/25.5.3/revisions/default/r001/variant-revision.yaml">revision</a> binds that YAML to checksums. The <a href="../packages/bitnami/redis/25.5.3/bases/default/">package base</a> is the repository source for the base variant. Redis has no hook route; charts with hooks or CRDs record them in lifecycle routes and target facts. <a href="../data/helm-render-intents/summary.md">Open more render-intent examples</a>.</p>
  </div>

  <div class="fstage">
    <span class="ftag">IDENTIFY</span><span class="codetag">each digest has one role</span>
    <h3>Keep the identities separate</h3>
    <p>The base revision, exact object set, source OCI, ConfigHub Unit, and release OCI have different hashes. A receipt names both sides of a handoff and compares the objects. The Catalog does not treat unlike hashes as the same digest.</p>
  </div>

  <div class="fstage">
    <span class="ftag">LIFECYCLE</span><span class="codetag">F3 · requirements &amp; routes</span>
    <h3>Plan the work around ordinary apply</h3>
    <p>Helm can do more than produce ordinary YAML. A chart may install CRDs, run setup jobs, or generate Secrets. It can also require cloud identity, storage, or another existing cluster resource.</p>
    <p>We record the chosen approach for each chart with its inputs, output, tests, and receipts. A base can include its CRDs or leave them to the cluster. It can require a tested setup step or an existing target resource.</p>
    <p>The base records each requirement and a portable <strong>route intent</strong>. After a variant and destination are chosen, the route is resolved for direct apply, Argo CD, Flux, or another recorded runtime. A variant can change the requirements, so promotion checks them again.</p>
    <p>The delivery receipt records what ran. We call a route automatic only when the product ran it and the receipt proves the result.</p>
  </div>

  <div class="fstage star">
    <span class="ftag">OPERATE</span><span class="codetag">F4 · variants &amp; delivery</span>
    <h3>Change, promote, and deliver a reviewed variant</h3>
    <p>A <strong>derived variant</strong> changes a base after render. It can set the target, region, labels, or approvals, or edit an exact object field. Create one per environment from a single base.</p>
    <p>ConfigHub reviews, promotes, approves, and delivers the change. On upgrade, it keeps recorded changes that do not overlap changes in the new base. When both sides change the same field, the overlap must be reviewed before promotion.</p>
  </div>

  <h3>Variants and related records</h3>
  <table class="gtable">
    <tr><th>Word</th><th>What it is</th><th>Re-renders Helm?</th><th>Lives in</th></tr>
    <tr><td><strong>Source and intent</strong></td><td>The source version, choices, locks, and known lifecycle work. It may include a Helm or AICR recipe, but recipe is not the general term.</td><td>It tells the source tool what to produce</td><td>the repo and the package</td></tr>
    <tr><td><strong>Base variant</strong></td><td>One named, reviewed starting configuration such as default, no-crds, or ha. Changing the source choices means a new base variant.</td><td>Helm bases render once and are checked against Helm</td><td>the package; a root Space after upload</td></tr>
    <tr><td><strong>Exact configuration</strong></td><td>The frozen, checksummed Kubernetes objects produced or supplied for one revision.</td><td>No; the objects already exist</td><td>the retained revision and configuration OCI</td></tr>
    <tr><td><strong>Derived variant</strong></td><td>A change derived from a base: per-environment context or later edits, upstream link recorded.</td><td>No</td><td>ConfigHub</td></tr>
    <tr><td><strong>Resolved lifecycle route</strong></td><td>The actor, order, mechanism, checks, and failure rule for one exact variant, destination, and delivery runtime.</td><td>No</td><td>the promotion or release record, followed by delivery receipts</td></tr>
  </table>
  <p class="quiet-line">A source produces or supplies an exact base variant. ConfigHub can then compare, promote, approve, deliver, and observe that base and its derived variants.</p>

  <h3>Where Helm source records live today</h3>
  <p>Inside a ConfigHub org, you see Units, clones, revisions, and links. The authoritative Helm recipe lives in this repository and in the installer package. Existing Helm catalog Spaces also carry a plain data Unit named <code>recipe</code> beside the objects it produced. That Unit preserves the current demo contract; it is not the general name for every source format.</p>
  <table class="gtable">
    <tr><th></th><th>The recipe in this repo</th><th>The <code>recipe</code> unit in an org</th><th>A first-class source object (where this is heading)</th></tr>
    <tr><td><strong>What it is</strong></td><td>The authoritative source: chart pin, source lock, per-base values, revisions.</td><td>A generated record of one render's inputs, placed as data beside the output.</td><td>An executable source object: repository, chart, version, values, in one unit.</td></tr>
    <tr><td><strong>Carries the values?</strong></td><td>Yes; it is the values.</td><td>No; it points at them in the repo.</td><td>Yes, self-contained.</td></tr>
    <tr><td><strong>Who acts on it</strong></td><td>The catalog pipeline builds the package from it.</td><td>Nobody; the render already happened outside.</td><td>A worker renders it, and re-renders it when it changes.</td></tr>
    <tr><td><strong>Connected to its outputs?</strong></td><td>Through the repo's evidence chain.</td><td>Sits in the same Space, no link.</td><td>Linked to the units it rendered.</td></tr>
    <tr><td><strong>Authority</strong></td><td>Authoritative.</td><td>A copy; it can lag the repo.</td><td>Would become authoritative.</td></tr>
  </table>
  <p class="quiet-line">The current Helm <code>recipe</code> Unit records where the render came from, but it does not execute or re-render anything. A future source object would need to carry the values itself and link directly to the Units it produces.</p>

  <h2>4 · Understand why the records are separate</h2>
  <table class="gtable">
    <tr><th>We chose to…</th><th>…because</th></tr>
    <tr><td>Keep <strong>exact objects</strong> when the flattening verdict allows it</td><td>The desired configuration shows what should run. When source processing must happen later, the record says so and names the boundary.</td></tr>
    <tr><td><strong>Freeze</strong> the render instead of re-rendering</td><td>What you read is exactly what installs and what your controller delivers, with no re-render drift between review and runtime.</td></tr>
    <tr><td><strong>Name every route</strong> (hooks, CRDs, prereqs)</td><td>Every behaviour Helm handled outside normal objects still has to be owned, tested, skipped, or blocked. The catalog records that decision per base variant.</td></tr>
    <tr><td>Mark routes <strong>automatic: false</strong> until earned</td><td>Nothing is called automatic until the product actually runs the route and committed evidence proves it. No claim ahead of proof.</td></tr>
    <tr><td>Report each <strong>test result</strong> separately (synced ≠ working)</td><td>GitOps can say "Synced" while the workload is broken. Separate results show whether rendering, delivery, and the workload itself passed.</td></tr>
    <tr><td>Offer <strong>existing-secret</strong> bases</td><td>A default that ships a generated password installs green but breaks silently over GitOps (the pod can't find the Secret while Argo still says Synced). Bring-your-own is the safe path.</td></tr>
  </table>

  <h2>5 · Follow the recommended path</h2>
  <p>Take the smallest path that does the job, and grow only when you need to:</p>
  <table class="gtable">
    <tr><th>You want to…</th><th>Recommended path</th></tr>
    <tr><td>Just see the objects</td><td>Render and read them. No account, no cluster.</td></tr>
    <tr><td>Install one chart</td><td>Open its catalog page and use the recommended configuration shown there. Pass that base with <code>--base &lt;name&gt;</code>, or omit <code>--base</code> only when the package's selected default is the one you want.</td></tr>
    <tr><td>Run a database / anything with a password</td><td>Use the <code>existing-secret</code> base and supply the Secret yourself. Don't ship a generated one over GitOps.</td></tr>
    <tr><td>Change something after install</td><td>Make a <strong>derived variant</strong>. ConfigHub keeps non-conflicting recorded changes through upgrades and asks you to review same-field overlaps.</td></tr>
    <tr><td>Run dev / staging / prod</td><td>One base → many derived variants (per environment, region, customer). The base stays single; the instances live in ConfigHub.</td></tr>
    <tr><td>Already run Argo or Flux</td><td>Keep your controller. Publish once to OCI; point Argo/Flux at the same bundle.</td></tr>
  </table>

  <h3>Checks before apply</h3>
  <p>The same apply policy can protect configuration that started as Helm, AICR, <code>cub installer</code>, Kubara, Sveltos, or ordinary Kubernetes files. Schema, placeholder, and lifecycle-route checks block incomplete configuration. Ordinary workloads and AICR training runtimes receive checks for the fields they actually use. Production releases and system configuration keep those ${policyFacts.baselineChecks} checks and add one required approval.</p>
  <p>The source format does not decide the risk. A user workload, shared service, and cluster-wide configuration can all begin as Helm or YAML. The live demo applies ${policyFacts.baselineChecks} common tests to ${policyFacts.baselineSpaces} Spaces. It adds approval to ${policyFacts.approvalSpaces} Spaces: ${policyFacts.productionSpaces} production Spaces and ${policyFacts.systemConfigurationSpaces} system-configuration Spaces. The receipt includes every maintained starting format: ${sourceCoverage}. Read the <a href="../data/apply-policy-profiles/summary.md">policy profile and live receipt</a>. You can also run its verifier while logged into the <code>helm-catalog</code> org.</p>
  <p>The <a href="../data/operational-class-examples/summary.md">three worked examples</a> show how ownership changes the policy. An application team owns and promotes NGINX. A platform team introduces Kube Prometheus Stack as a shared service. Kubara is approved as cluster-wide platform configuration. Each example names the target, tests, rollout order, current result, and receipt.</p>

  <h3>Worked paths and Apps</h3>
  <p>The <a href="../docs/user/config-catalog-demonstrations.md">demonstration programme</a> tracks the Helm, AICR, cub installer, OCI, promotion, Kubara, and Sveltos paths. It also states which ConfigHub Apps work today and which remain partial or planned. The <a href="../docs/demo/hooks-crds/kube-prometheus-stack.md">Kube Prometheus Stack example</a> gives one complete chart-specific route plan. The <a href="../docs/demo/apps/rbac-review.md">RBAC review example</a> shows one exact permission correction. That correction is tested, approved, published as OCI, and delivered by Argo CD.</p>

  <h2>6 · Make the remaining decisions</h2>
  <p>Some choices depend on your cluster, Secrets, and policy. The chart page recommends a starting configuration and lists the alternatives. You make the final choice.</p>
  <div class="decide"><p><strong>Which base fits.</strong> The chart page recommends a starting configuration and explains alternatives such as <code>ha</code>, <code>no-crds</code>, or <code>existing-secret</code>. Read the trade-off before you choose.</p></div>
  <div class="decide"><p><strong>Namespace.</strong> Simple charts honour <code>--namespace</code>. Some complex charts embed a namespace in their objects and must install at their canonical one. The chart page says which.</p></div>
  <div class="decide"><p><strong>Image pinning.</strong> Some default bases ship a floating tag. For reproducible, digest-bound delivery, pin it: <code>--set-image NAME=repo/img@sha256:…</code>.</p></div>
  <div class="decide"><p><strong>Secrets.</strong> Bring your own via the <code>existing-secret</code> base and stage it out-of-band (ExternalSecrets, Vault, or <code>kubectl</code>). We can't invent your production secret.</p></div>
  <div class="decide"><p><strong>Prerequisites &amp; target facts.</strong> Some bases need a Secret, a CRD, a namespace, or a cluster value to exist <em>first</em>. Stage them before applying, or choose a base that includes them. Each one is listed, not assumed.</p></div>
  <div class="decide"><p><strong>When to use Helm directly.</strong> If a chart is not in the catalog, use <code>helm template</code> or <code>helm install</code> and record the chart, version, values, namespace, and release name. You can later upload the rendered files with <code>cub variant upload</code>.</p></div>

  <h2>7 · Check a claim</h2>
  <p>When a chart page says a path passes, is blocked, or is ready to try, that claim should be backed by files you can inspect. In this repo we call those checks <strong>verification</strong>. Some checks compare generated files on your machine; some use a fresh Kubernetes cluster.</p>
  <table class="gtable">
    <tr><th>Check file</th><th>Question it answers</th></tr>
    <tr><td><code>render-receipt</code></td><td>Did the same inputs produce the same Kubernetes objects twice?</td></tr>
    <tr><td><code>helm-equivalence-receipt</code></td><td>Does the cub render match plain <code>helm template</code> for this base variant?</td></tr>
    <tr><td><code>scan-receipt</code></td><td>What security findings were found in the rendered objects?</td></tr>
    <tr><td><code>install-gate</code></td><td>Is this render safe to try, does it need review, or is it blocked?</td></tr>
    <tr><td><code>object-inventory</code> · <code>variant-revision</code></td><td>Which exact Kubernetes objects and checksums belong to this render?</td></tr>
  </table>
  <p>For a Helm catalog entry, the checked path is <strong>source → render → record → route</strong>. Record the chart, version, values, and target assumptions. Render the objects and keep the checks with them. Then record lifecycle work such as hooks or CRD ordering. Other source formats follow the same stages, but they do not need a Helm recipe. Each live test reports its own result instead of contributing to one blanket success mark:</p>
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
    <tr><td>Run a fresh live test (<code>npm run kind-parity:run</code> / <code>live-parity:run</code>)</td><td>Yes</td><td>Helm vs cub, and OCI→Argo/Flux, on a throwaway cluster.</td></tr>
  </table>

  <h2>8 · Repeat the same result</h2>
  <p>Some catalog steps are pure computations that you can reproduce offline. Other steps touch a live cluster and cannot produce byte-identical results. The table states which type each step belongs to.</p>
  <table class="gtable">
    <tr><th>Stage</th><th>Idempotent?</th><th>Reproducible from source, no cluster?</th><th>Why</th></tr>
    <tr><td><strong>Render</strong> (Helm source → objects)</td><td class="yes">yes</td><td class="yes">yes, byte-identical</td><td>kustomize over the frozen upstream with pinned inputs; same inputs always give the same objects.</td></tr>
    <tr><td><strong>Record</strong> (receipts, checksums)</td><td class="yes">yes</td><td class="yes">yes</td><td>Just hashing and writing committed content, no live state.</td></tr>
    <tr><td><strong>Catalog / matrix / site views</strong></td><td class="yes">yes</td><td class="yes">yes</td><td>Re-derived from the committed source and intent records; stable joins, stable order.</td></tr>
    <tr><td><strong>Route</strong> (hooks / CRDs / prereqs)</td><td class="part">plan: yes</td><td class="part">plan: yes · run: no</td><td>Naming and classifying is pure; <em>running</em> a route touches a cluster and may have side effects.</td></tr>
    <tr><td><strong>Apply</strong> (kubectl)</td><td class="part">for listed objects</td><td class="no">no</td><td>Plain apply creates or updates the objects in the files. It does not remove an object merely because that object disappeared from the files.</td></tr>
    <tr><td><strong>Reconcile</strong> (Argo CD / Flux)</td><td class="part">when pruning is enabled</td><td class="no">no</td><td>A controller can converge additions, changes, and removals, but only with the appropriate prune setting enabled and tested.</td></tr>
    <tr><td><strong>Live cluster result</strong></td><td class="no">no</td><td class="no">no, not byte-deterministic</td><td>It observes a real cluster: pod scheduling, image pulls, controller timing. Each run is a new, point-in-time observation.</td></tr>
  </table>
  <p class="quiet-line">A <strong>rename or re-derivation regenerates offline</strong> from committed source. A <strong>fresh live result needs a cluster</strong>. Live runs are serial and use one temporary cluster at a time. <code>cub cluster up</code> creates that local kind cluster. <code>cub cluster down</code> removes it afterward. Render parity is not a live result, and a warning is not a pass.</p>

  <h2>9 · Deploy from ConfigHub</h2>
  <p>For the managed path, set the Space's release target and publish the reviewed Units as one immutable release OCI. Argo CD or Flux pulls those files and reconciles them. Neither controller renders the chart or source package again.</p>
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
  <p class="quiet-line">A small hook test shows that Argo CD and Flux can consume one ConfigHub release OCI and complete the same setup Job. A separate local test consumed the same artifact directly.</p>
  <p class="quiet-line">The first exact catalog result uses the <code>bitnami/nginx@24.0.2</code> <code>http-clusterip</code> base. <code>cub installer</code> reproduced its committed objects, and ConfigHub published them once. Argo CD and Flux reported the same release digest and a ready NGINX workload. The local test recorded the same result.</p>
  <p class="quiet-line">Read the <a href="../data/catalog-oci-delivery-proof/summary.md">plain-English result</a> or the <a href="../runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml">receipt</a>. Every other catalog configuration still needs its own receipt before its page can make that delivery claim.</p>
  <div class="honest">
    <h3>What a direct local apply still has to handle</h3>
    <p>The recorded direct path proves a first apply for one NGINX configuration. A reusable direct-delivery path also needs explicit behavior for these cases:</p>
    <ul>
      <li><strong>Generated passwords.</strong> A chart default may create a Secret that should not become a shared, repeatable credential. Choose an <code>existing-secret</code> preset when the chart supports one.</li>
      <li><strong>CRD ordering.</strong> Apply CRDs first, wait for them to become available, then apply the objects that use them.</li>
      <li><strong>Field conflicts and removals.</strong> Show who owns a conflicting field and define which removed objects may be pruned.</li>
    </ul>
    <p>The catalog records these requirements per preset. A path is called automatic only after a receipt shows that it performed the required work.</p>
  </div>

  <h2>10 · Review AI changes</h2>
  <h3>AI-assisted changes, with control</h3>
  <p>AI can make a change faster than a person can review it. An agent therefore edits the rendered files, not hidden live state. Before delivery, you inspect the exact diff, scan for secrets and bad settings, and record an approval. If a bad value gets through, you can restore an earlier revision. The AI proposes the change. A person or policy approves it. The cluster receives only the approved result.</p>

  <h2>11 · Read the status</h2>
  <p>This page is not a blanket promise that every chart, controller, hook, or cluster path is ready. It shows what has been checked, what still needs work, and what a user should do next.</p>
  <table class="gtable">
    <tr><th>Status or label</th><th>What it means</th></tr>
    <tr><td><code>pass</code></td><td>The named check has committed evidence. Open the receipt if you need to see exactly what was tested.</td></tr>
    <tr><td><code>watch</code></td><td>The path may be useful, but there is a named risk or prerequisite to read before you use it.</td></tr>
    <tr><td><code>blocked</code> or <code>refused</code></td><td>Do not use that catalog path yet. Choose another base variant, use Helm directly, or add the missing setup work.</td></tr>
    <tr><td><code>automatic</code></td><td>ConfigHub only uses this word when it runs the step and a receipt exists. Otherwise the page names who must run it.</td></tr>
    <tr><td>GitOps delivery</td><td>The fixture proves that Argo CD and Flux can consume a ConfigHub release OCI. The separate direct test checks artifact portability. Each catalog configuration remains unproved for a controller until its own receipt records the sync and workload result.</td></tr>
  </table>
  <p class="quiet-line"><a href="./try.html">Try Redis</a> · <a href="./charts/index.html">Browse the Catalog</a> · <a href="./verification.html">Check one claim</a></p>
</main>
<footer><p>Generated from committed helm-expt evidence. This guide explains the public mental model; generated evidence remains the source for exact status.</p></footer>
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
  <title>Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header>
    ${topNav(".")}
    <h1>Use Helm charts. Ship ConfigHub variants.</h1>
    <p class="tagline">helm-expt ports popular public Helm charts to reviewed <code>cub installer</code> packages without changing the supported end-to-end semantics. The result is explicit config: named base variants, rendered objects, target prerequisites, scans, gates, live evidence, and a receipt behind every claim.</p>
    <div class="doors">
      <div class="door">
        <span class="kicker">Run it</span>
        <h3><a href="./try.html">Try one package in 5 minutes</a></h3>
        <p>Render and inspect Redis locally. You do not need ConfigHub Server, a ConfigHub account, or a Kubernetes cluster.</p>
        <pre><code>cub installer setup \\
  --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
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
  const metric = (name) => catalog.statusMetrics.find((row) => row.metric === name) ?? {};
  const currentCounts = [
    ["Catalog components", `${catalog.summary.retainedComponents}`, `${catalog.summary.retainedPackageVersions} retained package versions with packaged configurations and recorded requirements, ${catalog.summary.retainedPublishedPackageVersions} of them published with a receipt.`],
    ["Helm render matches", metricValue(metric("render parity rows")), "Helm and cub installer produced the same objects from the recorded settings."],
    ["Stored in ConfigHub", metricValue(metric("in-ConfigHub proof rows")), "The rendered objects were uploaded and checked as ConfigHub Units."],
    ["Local Kubernetes runs", metricValue(metric("local live rows")), "The configuration was applied to a local target and observed."],
    ["OCI through GitOps", metricValue(metric("GitOps/OCI live pass rows")), "A GitOps controller pulled the reviewed OCI and reconciled it in a live run."],
  ];
  const publicRows = [
    ["Try a Catalog configuration", `<a href="./try.html">Try Redis</a>`, "Pull a public package, render it locally, and inspect the exact Kubernetes objects."],
    ["Bring a Helm chart and values", `<a href="./testing.html#bring-your-own">Review your own Helm input</a>`, "Use cub helm locally to render the chart without applying it."],
    ["Start with AICR, OCI, or YAML", `<a href="./testing.html">Choose a worked example</a>`, "Inspect the objects and source information before deciding where they go."],
    ["Check chart requirements", `<a href="./charts/index.html">Browse the Catalog</a>`, "See the recommended configuration, hooks, CRDs, Secrets, setup work, and evidence."],
  ];
  const managedRows = [
    ["Keep the reviewed result", "Store the exact Kubernetes objects and their source as shared, versioned configuration."],
    ["Change it with a team", "Review object diffs, keep revision history, run checks, and require approval where needed."],
    ["Create environments", "Make development, staging, production, region, or customer variants from one recorded base."],
    ["Promote and release", "Move a reviewed change between variants and publish OCI for Argo CD or Flux."],
    ["Operate applications and fleets", "Use saved configuration for upgrades, policy checks, rollout waves, and purpose-built Apps."],
  ];
  const commercialRows = [
    ["Private sources", "Use private charts, values, OCI packages, application objects, and internal catalogs."],
    ["Teams and policy", "Manage access, approvals, apply gates, audit history, and production responsibilities."],
    ["Fleet operations", "Query, patch, promote, release, and observe many applications or clusters."],
    ["Support", "Add target-specific production decisions, upgrade help, older-version support, and service commitments."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Choose How Much ConfigHub To Use · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Choose how much of ConfigHub to use</h1>
    <p class="lead">Start with local tools and public packages. Add a free ConfigHub account when you want to upload, change, promote, and release the reviewed configuration.</p>
    <p>Use the commercial product for private sources, teams, fleet operations, and production support.</p>
    <p>These tiers form one ladder of verbs. You check and deploy for free, upload, release, and promote with an account, then govern with the commercial product. <a href="./how-it-works.html#the-ladder">See the whole path as one ladder</a>.</p>
    ${humanLinks([["Try Redis", "./try.html"], ["Choose an example", "./testing.html"], ["Learn ConfigHub", "./confighub.html"]])}
  </header>
  <main>
    <section aria-labelledby="public">
      <h2 id="public">1. Start without ConfigHub Server</h2>
      <p>Everything below runs against your own machine. Pulling a public Catalog package is anonymous, so no ConfigHub account or registry login is involved.</p>
      ${markdownLikeTable([
        ["Task", "Start here", "What happens"],
        ...publicRows,
      ], { rawSecondColumn: true })}
      <p>The local tools work today. A hosted path without sign-in is planned rather than shipped. <a href="./serverless.html">Read what works without an account</a>.</p>
    </section>

    <section aria-labelledby="managed">
      <h2 id="managed">2. Add ConfigHub when the result must live and change</h2>
      <p>ConfigHub keeps reviewed Kubernetes configuration as shared data. Teams can change it, approve it, promote it, and publish releases for deployment.</p>
      ${markdownLikeTable([
        ["Need", "What ConfigHub adds"],
        ...managedRows,
      ])}
      <p>Follow the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "offering")}">official ConfigHub tutorial</a> for one component, a change, and a promotion to production.</p>
    </section>

    <section aria-labelledby="commercial">
      <h2 id="commercial">3. Govern with the commercial product for private and production work</h2>
      <p>ConfigHub is available as a hosted service you sign up for yourself, free to start, and as a standalone enterprise product.</p>
      ${markdownLikeTable([
        ["Need", "Commercial capability"],
        ...commercialRows,
      ])}
      <p>${signupLink("offering", "Sign up for ConfigHub")} or <a href="./private/">review the commercial options for users of this site</a>.</p>
    </section>

    <section aria-labelledby="current">
      <h2 id="current">4. Check what exists today</h2>
      <p>Each count covers one test, and the counts stay separate rather than adding up to a production claim.</p>
      <div class="grid">
        ${currentCounts.map(([label, value, body]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)} · ${escapeHtml(body)}</span></div>`).join("\n        ")}
      </div>
      <p><a href="./proof.html">See what has been tested</a> · <a href="./verification.html">Check one claim</a> · <a href="./known-gaps.html">See what is not ready yet</a></p>
    </section>

    <section aria-labelledby="missing">
      <h2 id="missing">5. Send a missing or broken public chart</h2>
      <p>If the Catalog is missing a public chart or configuration, or its output differs from Helm, send the chart and values that show the problem.</p>
      <p><a href="https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml">Open the problem chart issue template</a>.</p>
    </section>
  </main>
  <footer>Use the public paths first. Add ConfigHub when the configuration needs shared history, controlled change, promotion, or rollout.</footer>
</body>
</html>
`;
}

function legacyOfferingHtml(catalog) {
  const metric = (name) => catalog.statusMetrics.find((row) => row.metric === name) ?? {};
  const top100UserReadinessCounts = countBy(catalog.top100UserReadiness, "bucket");
  const publicCounters = [
    ["Component Catalog version pages", `${catalog.summary.retainedPackageVersions}`],
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
  <title>Config Workshop Offering</title>
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
    ${humanLinks([["Get started", "./try.html"], ["Choose a component", "./charts/index.html"], ["Read how it works", "./how-it-works.html"]])}
  </header>
  <main>
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
      <p>A public catalog of maintained Helm-derived packages, plus a ${signupLink("offering", "free ConfigHub account")} that lets you record changes to rendered config and compare them with later upgrades. Non-conflicting changes stay; same-field changes require review. The paid tier covers private charts, teams, policies, fleet operations, and production support.</p>
      <p>The free lane lets you browse, inspect, template, and install catalog chart bases without a ConfigHub account. With a ${signupLink("offering", "free account")} you can also record rendered-field changes, compare upgrades, and use basic variants, diffs, and scans. The paid lane covers private charts, custom catalogs, teams, policies, approvals, fleet operations, GitOps and OCI at scale, patch and upgrade services, and production support.</p>
      ${markdownLikeTable([
        ["What you get", "No account", "Free account", "Paid"],
        ["Browse, inspect, and template catalog charts", "Yes", "Yes", "Yes"],
        ["Install a chart base and read the exact objects", "Yes", "Yes", "Yes"],
        ["Record a rendered-field change and compare it with upgrades", "No", "Yes", "Yes"],
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
      <p>The first path is closer to <code>helm install redis</code> than to a platform migration. Start with a catalog package and local verification. A ${signupLink("offering", "ConfigHub account")} is free: use it to record config changes and compare them with later upgrades. The paid tier is for private inputs, teams, and production workflows.</p>
      <pre>cub installer setup --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
  --base reuse-existing-secret \\
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
<title>Try Redis · Config Workshop</title>
<style>${siteCss()}</style>
</head>
<body>
<header class="hero human-hero">
  ${topNav(".")}
  <h1>Try a simple example: Redis</h1>
  <p class="boundary-chip">Runs on your laptop</p>
  <p class="lead">Render one reviewed Redis configuration and read the 14 Kubernetes objects it produces. Thirteen come from the chart. The fourteenth is a Namespace that <code>cub</code> adds, which is the first thing worth looking at.</p>
  <p>Everything happens on your machine, so you can run this with no account and no cluster.</p>
  <p><b>Limits.</b> This renders and inspects. Nothing is applied. <a href="./confighub.html">Keep this reviewed result in ConfigHub</a> once you want to change it with your team or promote it between environments.</p>
</header>
<main>
  <section aria-labelledby="install-cub">
    <h2 id="install-cub">1. Install cub and the package plugin</h2>
    <p>Install the ConfigHub CLI. Then install the plugin that reads catalog packages.</p>
    <pre><code>${CUB_CLI_INSTALL_COMMAND}
export PATH="$HOME/.confighub/bin:$PATH"
${INSTALLER_PLUGIN_INSTALL_COMMAND}
cub installer version
kustomize version</code></pre>
    <p>The plugin release contains the program for your operating system. You do not need Go.</p>
    <p>If cub is already installed, run <code>cub upgrade</code> first. Upgrade the plugin separately with <code>cub plugin upgrade installer</code>.</p>
    <p>If <code>kustomize version</code> fails, follow the <a href="${KUSTOMIZE_INSTALL_URL}">official Kustomize installation instructions</a>.</p>
    ${installerCommandNoteHtml()}
  </section>

  <section aria-labelledby="render-package">
    <h2 id="render-package">2. Render the Redis package</h2>
    <p>The public package contains named Redis configurations. Select the configuration that expects you to provide a Kubernetes Secret before deployment.</p>
    <p><strong>Input:</strong> a Catalog installer OCI, pinned to the manifest digest in its publication receipt.<br><strong>Output:</strong> readable Kubernetes files plus a local configuration OCI at <code>./redis-25.oci</code>.</p>
    <pre><code>cub installer setup --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
    --base reuse-existing-secret \\
    --work-dir ./redis \\
    --namespace redis \\
    --non-interactive \\
    --output-oci ./redis-25.oci</code></pre>
    <p>The chart renders 13 objects. <code>cub installer</code> adds one explicit Namespace, so the output contains 14 manifest files and no Secret. It also writes a local OCI package.</p>
    <p>The command reads the OCI package back and checks that none of the objects changed. It reports <code>pull-back: verified</code> when the comparison passes.</p>
    <p><strong>Before deployment:</strong> create the required <code>redis-existing-secret</code> Secret in the target namespace. The Catalog records this requirement, and you create the credential yourself.</p>
  </section>

  <section aria-labelledby="inspect-result">
    <h2 id="inspect-result">3. Inspect the result</h2>
    <p>Read the selected configuration and its objects. Everything so far is local.</p>
    <pre><code>cat ./redis/out/spec/selection.yaml
ls ./redis/out/manifests
grep -R "^kind:" ./redis/out/manifests</code></pre>
    <p>The catalog keeps the source inputs beside the result. It also records the required Secret and the checks for this configuration.</p>
    <p>This Redis configuration has no CRD setup step. For a chart that lists CRDs, do not rely on one plain <code>kubectl apply</code>.</p>
    <p>Run the package's prerequisite script, or use its tested Argo CD or Flux route. The CRDs must be established before dependent objects are applied.</p>
    <p><a href="../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml">Read the full Kubernetes YAML</a> · <a href="../data/helm-render-intents/intents/bitnami-redis-25-5-3-reuse-existing-secret.yaml">Read the recorded inputs and requirements</a> · <a href="./d/data/redis-public-walkthrough-proof/summary.html">Read the anonymous run result</a></p>
  </section>

  <section aria-labelledby="finished">
    <h2 id="finished">You have finished the first example</h2>
    <p>You now have readable Kubernetes files and a local OCI package. Nothing has been applied to a cluster.</p>
    <p><strong>Next:</strong> <a href="./how-it-works.html#now-deploy">choose how to deploy the reviewed result</a>.</p>
    <p>For your own Helm values or an unexpected result, <a href="./ask.html">check your configuration with your AI assistant</a>.</p>
    <p>Other paths: <a href="./testing.html">choose a Helm, AICR, OCI, YAML, promotion, or fleet example</a>, <a href="./redis-walkthrough.html">continue the detailed Redis walkthrough</a>, or <a href="./confighub.html">keep the result in ConfigHub</a>.</p>
  </section>
</main>
<footer><p>The first three steps use no ConfigHub Server and no ConfigHub account.</p></footer>
</body>
</html>
`;
}

function tryAicrHtml() {
  const rows = aicrCpuStarterRecords()
    .map((record) => `<tr><td><code>${escapeHtml(record.name)}</code></td><td>${record.syncWave}</td></tr>`)
    .join("\n        ");
  const v020SourceCatalog = readYaml(join(
    repoRoot,
    "examples",
    "aicr",
    "eks-h100-training-kubeflow-v0-20-0",
    "source-catalog",
    "source-catalog-record.yaml",
  ));
  const v020Selection = v020SourceCatalog.spec.selection;
  const v020Dimensions = Object.entries(v020Selection.dimensions)
    .map(([name, value]) => `${name}=${value}`)
    .join(", ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Try AICR · Config Workshop</title>
<style>${siteCss()}</style>
</head>
<body>
<header class="hero human-hero">
  ${topNav(".")}
  <h1>Try AICR</h1>
  <p class="boundary-chip">Two independent starting paths</p>
  <p class="lead">Compare GPU nodes you already run, or inspect one retained AI-platform configuration without a GPU.</p>
  <p>The node comparison needs read access to a Kubernetes cluster and creates a temporary collector Job with its ServiceAccount and RBAC. It does not need an AICR recipe or deploy a platform bundle.</p>
  <p>The retained-configuration exercise is local. It needs no ConfigHub account, Kubernetes cluster, cloud account, GPU, or registry login.</p>
</header>
<main>
  <section aria-labelledby="aicr-questions">
    <h2 id="aicr-questions">Choose the question first</h2>
    ${markdownLikeTable([
      ["Question", "AICR path"],
      ["What do I have?", "Use snapshot and diff to report differences between existing GPU nodes. No recipe, bundle, or Catalog match is required."],
      ["What will it produce?", "Select a provider-curated AICR leaf variant and inspect the exact files it generates."],
      ["Can this destination accept it?", "Check that the destination matches the variant's GPU, network, cloud, controller, credential, API, and component requirements."],
      ["Did it work?", "Run recipe-dependent resource and runtime checks only after the declared components have been deployed."],
    ])}
  </section>

  <section id="aicr-node-state" aria-labelledby="aicr-node-state-title">
    <h2 id="aicr-node-state-title">Path A: compare existing GPU nodes</h2>
    <p>Use AICR's read-only path when the question is whether two nodes or two points in time differ. It records kernel command-line settings, modules, system services, GPU hardware, and other measured state as YAML.</p>
    <pre><code>aicr snapshot --output baseline.yaml
# select the other node or repeat after the change
aicr snapshot --output current.yaml
aicr diff --baseline baseline.yaml --target current.yaml --fail-on-drift</code></pre>
    <p>A difference is not automatically a fault. Missing <code>iommu=pt</code> or <code>nvidia_peermem</code> is an observation first. A node without Mellanox networking may correctly omit both settings; a variant intended for RDMA may require them.</p>
    <p>Choose the provider-curated source variant meant for that node's service, accelerator, operating system, workload intent, platform, and relevant hardware before deciding what should change. NVIDIA curates the built-in AICR variants. Other catalog providers can publish and review additional variants.</p>
    ${markdownLikeTable([
      ["Same observed target", "Result"],
      ["Assigned to standard networking", "Pass. The two RDMA settings do not apply."],
      ["Assigned to Mellanox RDMA", "Two findings: iommu=pt and nvidia_peermem."],
    ])}
    <p>The <a href="./d/docs/demo/aicr/snapshot-diff.html">complete snapshot walkthrough</a> includes a working local review command, a machine-readable result with both snapshot and profile hashes, optional local OCI output, and the commands that retain the review as non-deployable ConfigHub Units.</p>
    <p><code>expected-resources</code> answers a later question. It needs the selected variant and its declared components deployed. If those components are absent, record that check as blocked or not run; do not call it failed GPU conformance.</p>
    <p><a href="./d/data/aicr-snapshot-review/summary.html">Read the maintained result</a> · <a href="../data/aicr-snapshot-review/review.yaml">Open the complete review YAML</a> · <a href="https://github.com/NVIDIA/aicr/releases/tag/v0.20.0">Open the AICR v0.20.0 release</a> · <a href="./d/data/config-assessment-stages/summary.html">See the tested assessment boundaries</a></p>
  </section>

  <section aria-labelledby="retained-config-path">
    <h2 id="retained-config-path">Path B: inspect a retained configuration</h2>
    <p>This path reads a reviewed AICR-generated package. It does not inspect a live GPU node or prove that the selected platform runs.</p>
    ${markdownLikeTable([
      ["Layer", "What it means here"],
      ["Source variant", "The provider-curated AICR leaf selected before generation."],
      ["Retained base variant", "The exact generated objects, digest, requirements, and evidence kept by the Catalog or ConfigHub."],
      ["Derived ConfigHub variant", "A later environment or policy change linked to that retained base."],
    ])}
  </section>

  <section aria-labelledby="aicr-source-catalog">
    <h2 id="aicr-source-catalog">Where the selected configuration came from</h2>
    <p>The provider chooses the source variant. Config Workshop records that choice before it keeps the generated objects as a base. Later ConfigHub variants are changes to that retained base; they do not rewrite the provider's catalog record.</p>
    ${markdownLikeTable([
      ["Record", "Exact v0.20.0 value"],
      ["Provider", `${escapeHtml(v020SourceCatalog.spec.provider.name)} · <a href="${escapeHtml(v020SourceCatalog.spec.provider.identity)}">provider source</a>`],
      ["Provider catalog", `${escapeHtml(v020SourceCatalog.spec.catalog.name)} ${escapeHtml(v020SourceCatalog.spec.catalog.version)} · <code>${escapeHtml(v020SourceCatalog.spec.catalog.digest)}</code>`],
      ["Selected source variant", `<code>${escapeHtml(v020Selection.name)}</code> · ${escapeHtml(v020Dimensions)}`],
      ["Retained base", `<a href="./d/docs/demo/aicr/eks-h100-training-kubeflow-v0-20-0.html">17 exact Argo CD Applications plus source and lifecycle records</a>`],
      ["ConfigHub handoff", `<a href="../examples/aicr/eks-h100-training-kubeflow-v0-20-0/confighub-upload-receipt.yaml">The upload receipt carries the same provider, catalog digest, selected variant, and dimensions</a>`],
    ], { rawSecondColumn: true })}
    <p><a href="../examples/aicr/eks-h100-training-kubeflow-v0-20-0/source-catalog/source-catalog-record.yaml">Open the complete source-catalog record</a> · <a href="../data/base-variant-records/records/aicr-eks-h100-training-kubeflow-v0-20-0-argocd.yaml">Open the retained BaseVariantRecord</a>. Provider evidence applies to the selected source variant. ConfigHub evidence starts with the exact retained objects and records later changes, promotion, release, and delivery separately.</p>
  </section>

  <section aria-labelledby="install-oras">
    <h2 id="install-oras">1. Install ORAS</h2>
    <p>ORAS reads and writes OCI packages without running a container.</p>
    <pre><code>oras version</code></pre>
    <p>If that command fails, use the <a href="https://oras.land/docs/installation/">ORAS installation instructions</a>.</p>
  </section>

  <section aria-labelledby="run-aicr">
    <h2 id="run-aicr">2. Pull and check the configuration</h2>
    <p>Run one script. It uses an empty credential store for the public pull, checks the source digest, selects the seven reviewed files, and compares the local OCI with those files.</p>
    <pre><code>bash &lt;(curl -fsSL ${SITE_BASE_URL}sh/aicr-cpu-starter/try.sh)</code></pre>
    <p>Source: <code style="overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(AICR_CPU_STARTER_SOURCE_OCI_REF)}</code></p>
    <p>Recorded source digest: <code style="overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(AICR_CPU_STARTER_SOURCE_DIGEST)}</code></p>
  </section>

  <section aria-labelledby="inspect-aicr">
    <h2 id="inspect-aicr">3. Read what you received</h2>
    <p>The result contains seven Argo CD Application files, the source-and-intent record that explains the selection, and a local OCI containing the same seven files.</p>
    <pre><code>find ./aicr-cpu-starter/config/templates -maxdepth 1 -type f -print
cat ./aicr-cpu-starter/source-and-intent.yaml
oras manifest fetch --oci-layout ./aicr-cpu-starter/aicr-cpu-starter.oci:0.14.0</code></pre>
    <table>
      <thead><tr><th>Selected Application</th><th>Argo CD sync wave</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <p>Expected local OCI digest: <code style="overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(AICR_CPU_STARTER_LOCAL_OCI_DIGEST)}</code>.</p>
  </section>

  <section aria-labelledby="aicr-boundary">
    <h2 id="aicr-boundary">What the retained-configuration example proves</h2>
    <p>The public AICR configuration can be pulled without signing in. The seven selected Applications match their reviewed hashes, and the local OCI returns the same files.</p>
    <p>The CPU starter is a Config Workshop selection from an AICR-generated platform. It is not an upstream NVIDIA AICR recipe. It keeps the source files unchanged, including a <code>gp3</code> storage-class setting that must be changed before use on a cluster without that class.</p>
    <p>An AI can propose that change, but a checker decides whether to accept it. The recorded example keeps all seven Application identities, changes only <code>kube-prometheus-stack</code>, and changes only its StorageClass field. A second request also moves a namespace, so the checker refuses it and writes no candidate.</p>
    <p><a href="./d/data/aicr-platform-variant/summary.html">Compare the accepted and refused requests</a>.</p>
    <p><a href="./d/data/aicr-cpu-starter-public-proof/summary.html">Read the recorded anonymous run</a> · <a href="./d/docs/demo/aicr/cpu-starter.html">Read how the selection was made</a> · <a href="./d/data/vllm-cpu-starter-proof/summary.html">See the separate live CPU inference result</a></p>
    <p><a href="./d/docs/demo/aicr/eks-h100-training-kubeflow-v0-20-0.html">Open the AICR v0.20.0 starting configuration</a> to inspect the newest retained source variant, 17 exact Applications, all 16 nested source renders, and the separate Argo CD and Flux lifecycle plans. The records bind 409 local objects to exact chart, values, and output digests without claiming that a GPU target ran. <a href="./d/data/aicr-v0-20-0-route-resolution/summary.html">Read the nested and destination result</a>. <a href="./d/docs/demo/aicr/eks-h100-training-kubeflow-v0-19-0.html">The v0.19.0 entry</a> continues further into ConfigHub variants and release OCI.</p>
  </section>

  <section aria-labelledby="aicr-next">
    <h2 id="aicr-next">Choose what to do next</h2>
    <p>Keep the files and OCI locally, or <a href="./confighub.html">upload it into ConfigHub</a> when your team needs shared changes, environment variants, approvals, and promotion from development to production. That is the same account ladder every configuration climbs.</p>
    <p>To gate and move a change to this AI-platform configuration through environments, <a href="./promote.html">compare the exact object sets and promote the one that passed</a>.</p>
    <p>For deployment, <a href="./how-it-works.html#now-deploy">choose the controller or direct path that will consume the reviewed objects</a>. Do not apply this platform configuration until you have reviewed its component requirements and changed the recorded storage-class residue.</p>
    <p><a href="./testing.html#inference">Compare the other inference examples</a> · <a href="./try.html">Try the shorter Redis example</a></p>
  </section>
</main>
<footer><p>The retained-configuration path uses no ConfigHub Server, account, registry login, Kubernetes cluster, or GPU. The snapshot path needs cluster access but no recipe or selected platform deployment.</p></footer>
</body>
</html>
`;
}

function howItWorksHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Choose How To Deploy It · Config Workshop</title>
<style>${siteCss()}</style>
</head>
<body>
<header class="hero human-hero">
  ${topNav(".")}
  <h1>Choose how to deploy it</h1>
  <p class="lead">Come here after you have inspected the Kubernetes objects. They may have come from Helm, an AICR recipe for AI infrastructure, cub installer, OCI, or plain YAML.</p>
  <p>You can stop with local files, publish them directly as OCI, or upload them to ConfigHub and publish a reviewed release OCI later.</p>
  <p>ConfigHub stores your approved configuration and its history. Use it when you need to track changes across environments, require an approval before production, or roll back to a recorded release. <a href="./confighub.html">Start with what ConfigHub adds</a>.</p>
</header>
<main>
  <section aria-labelledby="keep">
    <h2 id="keep">1. Choose what happens next</h2>
    <h3 id="the-ladder">The whole path, one ladder</h3>
    <p>A configuration climbs the same ladder whatever it started as. The first rungs are free and need no account. The next need a ConfigHub account. The last is the commercial product. Each step is a real command or surface.</p>
    ${markdownLikeTable([
      ["Rung", "Verb", "What it does", "Command or surface"],
      ["Free", "check", "Inspect it: what it installs, whether it is right. No cluster.", "the Check"],
      ["Free", "deploy", "Run the reviewed OCI on the Argo CD or Flux you already run.", "cub installer"],
      ["Account", "upload", "Bring it into ConfigHub as a base. Public config chains into your private org here.", "cub variant upload"],
      ["Account", "release", "Publish an approved, immutable release with history, so the cluster pulls that instead of a hand-pushed bundle.", "cub release publish"],
      ["Account", "promote", "Move a reviewed change from development to production.", "cub variant promote"],
      ["Paid", "govern", "Run a stack under governance: approvals, releases, rollback, drift, a fleet view.", "the commercial product"],
    ])}
    <p>A stack adds two free rungs: <strong>certify</strong> checks that a whole composition holds together, and <strong>sandbox</strong> renders it for free with no infrastructure. See the <a href="./d/docs/planning/cub-noun-vocabulary.html">full noun and verb table</a>.</p>
    <h3 id="four-answers">Keep four answers separate</h3>
    ${markdownLikeTable([
      ["Question", "When it can be answered"],
      ["What do I have?", "Inspect the source, package, files, OCI, or snapshot. A Catalog match and deployment are not required."],
      ["What will it produce?", "Run the source processor locally, or read the exact objects when the source is already literal configuration."],
      ["Can this destination accept it?", "Check the exact candidate against the named destination before apply. This needs destination access, not a deployment."],
      ["Did it work?", "Check controller, resource, runtime, drift, and rollback results after the exact revision is deployed."],
    ])}
    <p>A blocked prerequisite means the later check never ran, which is a different result from a failed source or a failed workload.</p>
    <h3>Local files</h3>
    <p><strong>Works with kubectl alone.</strong> Keep readable Kubernetes files. Test them, apply them with kubectl, or commit them to Git.</p>
    <h3>OCI package</h3>
    <p><strong>Works with your registry and reconciler.</strong> Publish the reviewed files as a rendered OCI. Argo CD or Flux can pull the same objects you inspected. <a href="./serverless.html#change-oci">See the working no-account OCI-in, change, OCI-out example</a>.</p>
    <h3>ConfigHub</h3>
    <p>Upload the files or OCI as a base: the reviewed starting configuration. Make variants when an environment, region, or customer needs a different field.</p>
    <p>During an upgrade, non-conflicting recorded changes remain. Review a conflict when the new source render and a ConfigHub revision change the same field.</p>
    <p>These OCI artifacts have different jobs. A Catalog installer OCI is input to cub installer. A rendered OCI contains the exact local output. A ConfigHub release OCI contains reviewed revisions after required checks and approvals.</p>
    <p>Keep their identities separate. The object digest covers the exact Kubernetes object set, an OCI manifest digest identifies one registry manifest, and a release OCI digest identifies the approved release artifact. A receipt links the three records while they stay three different digests.</p>
    <p><strong>Before choosing a delivery path:</strong> check this exact chart's page for hooks, CRDs, pruning, and tested controller results. The named NGINX example has direct, Argo CD, and Flux receipts. Do not transfer those results to another chart.</p>
  </section>

  <section aria-labelledby="setup">
    <h2 id="setup">2. Record the source and required setup</h2>
    <p>Before deployment, every source must become exact Kubernetes objects. We call that step materialization. Helm renders a chart. AICR and Kubara generate or compose objects. Literal YAML and configuration OCI already contain the objects, so no transformation is needed.</p>
    ${markdownLikeTable([
      ["Source", "Materialization means"],
      ["Helm", "Render the chart and recorded values."],
      ["AICR", "A snapshot and diff report observed GPU-node differences without a recipe. Select the intended provider-curated leaf before deciding whether a difference is wrong. That leaf uses AICR's composition or generation step."],
      ["Timoni", "Build the pinned module or bundle with its typed values."],
      ["Kubara or another generator", "Run its declared generation or composition step."],
      ["Sveltos", "Read the literal Sveltos objects. Materialize each nested source separately."],
      ["Source OCI", "Pull it by digest, then run the processor it declares."],
      ["Configuration OCI", "Read the exact objects it already contains."],
      ["Plain YAML", "Parse and record the exact objects; no source transformation is needed."],
      ["ConfigHub Units", "Read the retained revision; it is already materialized."],
    ])}
    <p>Then decide whether those objects can stand alone. Keep them as flat configuration when they can. Keep them with recorded setup when CRDs, hooks, certificates, Secrets, or jobs must run too. Process the source later when it still depends on live data or behavior that cannot yet be carried safely.</p>
    <p>When processing must happen later, name the tool or controller that will run it and require a receipt from that exact run. For CRDs, the safe order is explicit: install the CRDs, wait until Kubernetes reports them established, then apply the objects that use them.</p>
    <p>Keep a source and intent record beside the objects. It identifies the source, version, choices, target assumptions, object digest, and checks. Record lifecycle routes separately because producing objects and running setup are different jobs. A route says who acts, in what order, and which result proves it ran.</p>
    <p>A catalog page names this work before deployment. It may include a tested step, require an existing resource, offer another configuration, or block the path.</p>
    <p><a href="./d/docs/user/confighub-data-model.html">Read the configuration processing model</a> · <a href="./d/docs/reference/flattening-alignment.html">Decide whether to flatten</a> · <a href="./d/docs/user/chart-hooks-what-happens.html">How chart hooks are handled</a> · <a href="./d/docs/demo/hooks-crds/kube-prometheus-stack.html">Hooks and CRDs example</a></p>
  </section>

  <section aria-labelledby="setting-sources">
    <h2 id="setting-sources">3. Decide where each change belongs</h2>
    <h3>Source inputs</h3>
    <p>Use them for a choice that changes the objects produced by Helm, AICR, or another source. Record the input and create a new base.</p>
    <h3>ConfigHub variant</h3>
    <p>Use it when an exact field differs by environment, region, customer, policy, or another operating decision. Change the stored object and review the diff.</p>
    <h3>Deployment setup</h3>
    <p>Use this for prerequisites and lifecycle work: Secrets, CRDs, hooks, certificates, jobs, and target capabilities. Record and check each required step.</p>
    <h3>Live cluster</h3>
    <p>Observe what is running and find drift. Record an intended correction before redeploying.</p>
    <p>Do not change the same field in both the source and ConfigHub. If both changed it, choose which value should be deployed.</p>
    <h3>Protection means three different things</h3>
    ${markdownLikeTable([
      ["Protection", "What it means"],
      ["Protected local field", "The environment variant owns this field. A source refresh does not overwrite it silently; overlapping changes require review."],
      ["Protected input", "A credential or other sensitive value stays outside portable configuration. The objects contain a reference or requirement instead."],
      ["Prune-protected resource", "The delivery path must not delete this object when it disappears from a later configuration. It does not protect individual fields."],
    ])}
  </section>

  <section aria-labelledby="deliver">
    <h2 id="deliver">4. Deliver the reviewed result</h2>
    <p>For a local test, apply the reviewed files with kubectl. For GitOps, let Argo CD or Flux pull the reviewed files from Git or OCI.</p>
    <p>With ConfigHub, publish a release OCI after any required checks and approvals. Argo CD or Flux then pulls that release.</p>
    <p><strong>Who does what:</strong> ConfigHub records the approved target assignment and publishes the release. Argo CD or Flux applies it. The controller and cluster report the live result.</p>
    <p>A ConfigHub target records where a variant should run, and it works without ConfigHub Server connecting directly to the cluster.</p>
    <p><code>kubectl apply</code> does not delete objects omitted from a later file set. Argo CD and Flux delete omitted objects only when pruning is enabled and tested.</p>
    <p>Plain <code>kubectl apply</code> also does not infer CRD order or wait for CRDs to become established. Run the chart's recorded prerequisite steps first, or use a controller route tested for that chart.</p>
    <p><a href="./known-gaps.html">Read the first-install CRD known gap</a> before using a direct apply path.</p>
    <p><strong>Checks inspect a candidate. Apply gates decide whether ConfigHub may apply it.</strong> A warning is recorded without stopping delivery; a blocking gate stops the apply. Production approval is a separate gate from schema and placeholder checks.</p>
    <pre><code>source receipt -> object receipt -> delivery receipt -> runtime receipt</code></pre>
    <p>Each receipt proves one boundary. The runtime receipt reports what happened after delivery; it does not prove that the source or object set was correct.</p>
    <p><a href="./d/docs/user/cub-deployment-path.html">Deployment commands</a> · <a href="./d/docs/user/gitops-adopter-guide.html">Argo CD and Flux guide</a> · <a href="./does-cluster-match-approved-config.html">What each path can prove</a> · <a href="./known-gaps.html">Current delivery gaps</a></p>
        ${nowDeployBlocksHtml()}
    </section>

  <section aria-labelledby="next">
    <h2 id="next">5. Next step</h2>
    <p>If the objects are changing, <a href="./promote.html">compare the current and proposed configuration first</a>. The browser review records what changed and the tests still required before staging or production.</p>
    <p>Open <a href="./docs.html">Docs</a> and pick the question closest to your current step; each answer opens the commands for it.</p>
    <p>Open <a href="./testing.html#managed">the managed examples</a> for promotion and OCI delivery, or <a href="./testing.html#platforms">the platform examples</a> for fleet rollouts. Use ConfigHub when you want shared configuration, approvals, and rollout history.</p>
    <p><a href="./docs.html">Find the right technical guide</a> · <a href="./confighub.html">Continue with ConfigHub</a> · <a href="./deployment-reference.html">Open the technical deployment reference</a></p>
  </section>
</main>
</body>
</html>
`;
}

function configHubHtml() {
  const localReceipt = readYaml(join(repoRoot, "runs/byo-helm-values-proof/receipt.yaml"));
  const publicReceipt = readYaml(join(repoRoot, "runs/byo-helm-values-proof/public-oci-receipt.yaml"));
  const uploadReceipt = readYaml(join(repoRoot, "runs/byo-helm-values-proof/confighub-upload-receipt.yaml"));
  const decisionReceipt = readYaml(join(repoRoot, "runs/config-review-decision-chain/receipt.yaml"));
  const objectCount = localReceipt?.spec?.baseline?.objectCount;
  const objectSetDigest = localReceipt?.spec?.reviewed?.objectSetSha256;
  const ociReference = publicReceipt?.spec?.artifact?.reference;
  const ociDigest = publicReceipt?.spec?.artifact?.digest;
  check(objectCount === 5, "ConfigHub handoff example must retain five reviewed objects");
  check(objectSetDigest === localReceipt?.spec?.output?.pulledObjectsSha256, "local OCI pull-back changed the reviewed object set");
  check(objectSetDigest === publicReceipt?.spec?.artifact?.objectSetSha256, "public OCI changed the reviewed object set");
  check(objectSetDigest === uploadReceipt?.spec?.objectSetSha256, "ConfigHub upload changed the reviewed object set");
  check(ociDigest === uploadReceipt?.spec?.source?.digest, "ConfigHub upload did not record the public OCI digest");
  check(ociDigest === uploadReceipt?.spec?.space?.externalSourceDigest, "saved ConfigHub base did not retain the public OCI digest");
  check(decisionReceipt?.status?.result === "pass", "ConfigHub decision example must have a passing live receipt");
  check(decisionReceipt?.spec?.decisionUnit?.includedInDeploymentRelease === false, "decision Unit must stay out of deployment releases");
  check(decisionReceipt?.spec?.decisionUnit?.recordedApprovals >= 1, "decision Unit must record approval of its exact revision");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Use ConfigHub · Config Workshop</title>
<style>${siteCss()}
  .handoff-proof { max-width: 880px; padding-left: 1.3rem; }
  .handoff-proof li { margin: 12px 0; }
  .handoff-proof code { overflow-wrap: anywhere; word-break: break-all; }
</style>
</head>
<body>
<header class="hero human-hero">
  ${topNav(".")}
  <h1>Upload a reviewed configuration into ConfigHub, then release and promote</h1>
  <p class="boundary-chip">Needs a ConfigHub account</p>
  <p class="lead">Uploading a reviewed configuration into ConfigHub is the step that needs an account. From there you release it so a cluster pulls it, and promote it across environments, with the source, checks, approvals, and history kept beside it.</p>
  <p>Use the Catalog or Check my config before you sign up. Continue here when your team needs the same answer tomorrow, in another environment, or after the next change.</p>
  <p>This is also where public configuration chains into your private org: a base you upload keeps sending you fixes while protection keeps the values you chose. ConfigHub shows exact diffs, promotes reviewed changes from development to production, and compares approved configuration with your clusters.</p>
  <p><a class="button primary" href="${confighubOutboundUrl(CONFIGHUB_SIGNUP_URL, "confighub-page")}">Upload a reviewed result into ConfigHub</a> <a class="button secondary" href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "confighub-page")}">Open the tutorial</a></p>
</header>
<main>
  <section aria-labelledby="managed-result">
    <h2 id="managed-result">1. What ConfigHub adds</h2>
    <p>The account path is three steps: upload, release, and promote. <strong>Upload</strong> brings the reviewed configuration into ConfigHub as a base, stored with its source and review record. <strong>Release</strong> publishes it so Argo CD or Flux pulls it. <strong>Promote</strong> moves a reviewed change from development to production, with the exact diff, the approval, and the history kept beside it.</p>
    <p><strong>Upload also chains public configuration into your private org.</strong> A base you upload can be public, pulled from a shared catalog, while your deployment stays private. When ConfigHub clones the public base into your deployment, links carry your private values into it, and protection keeps the values you chose. Later fixes to the public base, a patched image or a new version, flow down to everything you did not protect. That chaining is the value a plain registry cannot offer. If your CI already renders charts into YAML in git, <a href="./d/docs/user/ci-rendered-catalog-journey.html">the recorded journey</a> lands those exact files as governed data, receipted.</p>
    <p>ConfigHub keeps the four answers connected without treating them as interchangeable.</p>
    <p>It links the source to the materialized objects, the destination check to one target, and the post-deployment result to one exact release. A retained object or a published OCI stays exactly that, and never counts as a destination or live pass.</p>
    ${markdownLikeTable([
      ["Question", "What ConfigHub retains"],
      ["What do I have?", "The source identity, imported files, exact object records, and their history."],
      ["What will it produce?", "The source and intent, materialized objects, object identity, and recorded transformation."],
      ["Can this destination accept it?", "Checks against one named destination, tied to the exact candidate and current destination facts."],
      ["Did it work?", "Results for the exact delivered revision, target, time, and claim that was checked."],
    ])}
  </section>
  <section aria-labelledby="exact-handoff">
    <h2 id="exact-handoff">2. See one exact handoff</h2>
    <p>A worked NGINX example starts with AI-written Helm values. The review keeps the requested three replicas, removes six risky settings, and produces ${escapeHtml(String(objectCount))} Kubernetes objects.</p>
    <p>We calculate one hash from those objects at each step, so matching hashes mean the objects came through unchanged.</p>
    <ol class="handoff-proof">
      <li><strong>Review locally.</strong> The ${escapeHtml(String(objectCount))} objects have object-set hash <code>${escapeHtml(objectSetDigest)}</code>.</li>
      <li><strong>Publish the OCI.</strong> Pulling <code>${escapeHtml(ociReference)}</code> back produces the same object-set hash. The OCI digest is <code>${escapeHtml(ociDigest)}</code>.</li>
      <li><strong>Upload the base to ConfigHub.</strong> ConfigHub reads back the same ${escapeHtml(String(objectCount))} objects with the same object-set hash, and records the same OCI digest as their source.</li>
      <li><strong>Record the decision.</strong> A separate, non-deployable Unit says how each finding was handled. Six fixes were accepted. One remaining emptyDir finding is accepted only for the exact development and staging demonstration, excludes production, and has a review date. ConfigHub records approval of that exact decision revision.</li>
    </ol>
    <p>The matching hashes show that the handoff preserves the reviewed objects. The decision record answers a different question: what did we fix, what did we accept for now, and where may this result run? Read the <a href="./d/data/config-review-decision-chain/summary.html">complete decision, promotion, and delivery chain</a>.</p>
    <p>Open the <a href="./d/data/byo-helm-values-review/public-and-confighub.html">plain-English handoff record</a>, the <a href="https://github.com/confighub/helm-expt/blob/main/runs/byo-helm-values-proof/public-oci-receipt.yaml">public OCI receipt</a>, or the <a href="https://github.com/confighub/helm-expt/blob/main/runs/byo-helm-values-proof/confighub-upload-receipt.yaml">ConfigHub upload receipt</a>.</p>
    <p><a href="./ask.html#check-files">Check my config</a> now downloads <code>candidate.yaml</code> and <code>workshop-review.json</code>. Its handoff commands upload the objects with <code>cub variant upload</code> and attach both file hashes. The commands also create a <code>Provider None</code> review Unit in the same Space. Provider None keeps the review beside the configuration without placing it in a deployment release.</p>
    <p>If your own Claude, Codex, or other assistant is already running, the same page builds a prompt for it. The prompt checks the downloaded files, asks before writing to ConfigHub, runs the handoff, and reads the stored result back.</p>
  </section>
  <section id="promotion" aria-labelledby="continue-work">
    <h2 id="continue-work">3. Continue from the retained answer</h2>
    <p>Start with the public <a href="./promote.html">Promote my config</a> comparison. ConfigHub is the next step when the same proposed object hash must move through named environments with approvals, release digests, and target results.</p>
    ${markdownLikeTable([
      ["Job", "What ConfigHub keeps", "Start here"],
      ["Compare development and production", "Both variants, their source relationship, and exact object diff.", `<a href="./why-do-dev-and-prod-differ.html">Compare environments</a>`],
      ["Promote and publish", "The reviewed change, approval, promotion result, and immutable release OCI.", `<a href="./testing.html#managed">Promotion and OCI examples</a>`],
      ["Roll back", "The prior object revision or release digest. External effects remain outside the rollback claim.", `<a href="./redis-walkthrough.html">Redis promotion and rollback</a>`],
      ["Compare desired with live", "The approved desired objects and a separately dated live observation.", `<a href="./does-cluster-match-approved-config.html">Desired and live comparison</a>`],
      ["Roll out to a fleet", "The selected targets, waves, approvals, and result for every target.", `<a href="./testing.html#platforms">Fleet examples</a>`],
    ], { rawThirdColumn: true })}
  </section>
  <section aria-labelledby="review-tutorial">
    <h2 id="review-tutorial">4. Continue with the official tutorial</h2>
    <p><a href="${confighubOutboundUrl(CONFIGHUB_SIGNUP_URL, "confighub-page")}">Create a ConfigHub account</a> when you are ready to save a reviewed configuration. Then continue with the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "confighub-page")}">official tutorial</a> to create a development deployment, make a change, add production, and promote the reviewed result.</p>
    <p><a href="${confighubOutboundUrl(CONFIGHUB_BLOG_URL, "confighub-page")}">Read the ConfigHub blog</a> for product ideas, technical explanations, and worked stories.</p>
    <p><a href="./how-it-works.html">Review the deployment choices</a> · <a href="./docs.html">Find technical instructions</a></p>
  </section>
</main>
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
<title>Detailed Redis Walkthrough · Config Workshop</title>
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
  <p class="boundary-chip">Runs on your laptop</p>
    <p class="lead">Use one Redis example from first render to major upgrade. The public steps need no ConfigHub account. Pull Redis 25.5.3 and inspect its 14 Kubernetes objects. Compare them with Helm, write them as OCI, then update the selected configuration to 27.0.0. Sign in when you want to record a change, compare it with an upgrade, promote it, and record a rollback.</p>
    <div class="steps-line">You'll: <span><b>pull Redis</b> &rarr;</span> <span><b>read and verify it</b> &rarr;</span> <span><b>write OCI</b> &rarr;</span> <span><b>upgrade the same selection</b> &rarr;</span> <span><b>review one stored change</b></span></div>
  </div>
</header>
<main>
  <p><a href="./try.html">Use the short Try page</a> if you only want the first local package run.</p>
  <h2 id="install-cub">Install cub and the installer plugin</h2>
  <p>The catalog commands use <code>cub installer</code>, a released open-source plugin. Install the cub CLI, install the plugin from its GitHub release, and make sure <code>kustomize</code> is available:</p>
  <pre><code>${CUB_CLI_INSTALL_COMMAND}
export PATH="$HOME/.confighub/bin:$PATH"
${INSTALLER_PLUGIN_INSTALL_COMMAND}
cub installer version
kustomize version</code></pre>
  <p>The cub installation script puts the CLI at <code>~/.confighub/bin/cub</code>. <code>cub plugin install</code> downloads the release for your operating system and architecture. If cub is already installed, run <code>cub upgrade</code> first. Upgrade the plugin separately with <code>cub plugin upgrade installer</code>. If <code>kustomize version</code> fails, use the <a href="${KUSTOMIZE_INSTALL_URL}">official kustomize installation instructions</a>; Go is not required to install cub installer. If you installed an early source build with no recorded source, run <code>cub plugin uninstall installer</code> once, then repeat the install command above. Full cub setup notes are in the <a href="${confighubOutboundUrl(CONFIGHUB_DOCS_SETUP_URL, "try")}">ConfigHub docs</a>.</p>
  <p>The catalog paths on this page run on your laptop and need no sign-in anywhere.</p>
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
cub installer setup --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
    --base reuse-existing-secret --work-dir ./redis \\
    --non-interactive --namespace redis \\
    --output-oci ./redis-25.oci

# Read the files before deciding whether to deploy.
ls ./redis/out/manifests
cat ./redis/out/spec/selection.yaml</code></pre>
  <p>The command writes 14 Kubernetes objects and no Secret. The password remains outside the files and OCI. The output ends with <code>pull-back: verified</code> because cub reads the OCI back and compares its object-set digest before reporting success.</p>
  <p>Open the <a href="../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml">full rendered Redis YAML</a>, the <a href="../data/helm-render-intents/intents/bitnami-redis-25-5-3-reuse-existing-secret.yaml">recorded Helm inputs and prerequisites</a>, or the <a href="./d/data/redis-public-walkthrough-proof/summary.html">anonymous 25.5.3 to 27.0.0 walkthrough proof</a>.</p>

  <h3>Install only after you have read it</h3>
  <p>If you want a live test, use a throwaway cluster. The generated script creates a fresh password in a separate Kubernetes Secret. It applies the 14 files, waits for Redis, and tells you how to remove the cluster afterward.</p>
  <pre><code>kind create cluster
bash &lt;(curl -fsSL ${SITE_BASE_URL}sh/bitnami-redis-25-5-3/reuse-existing-secret/try.sh)</code></pre>
  <p>The <a href="./d/data/serverless-install-parity-proof/summary.html">live parity proof</a> ran normal Helm and this cub path on a clean cluster. The 13 chart objects matched field for field, cub added the explicit Namespace, and both Redis installations became ready and answered <code>PING</code>.</p>

  <h3>Helm combines render and install. cub separates them.</h3>
  <div class="rapply">
    <div class="box"><div class="n">1 · RENDER</div><h3>Read and verify it</h3><p><code>cub installer setup</code> writes the exact files to <code>./redis/out/manifests</code>. With <code>--output-oci</code>, it also writes those non-secret objects as OCI and checks the result by pulling it back.</p></div>
    <div class="box"><div class="n">2 · DELIVER</div><h3>Then choose where it goes</h3><p>Use <code>kubectl apply</code>, commit the files for GitOps, or push the rendered OCI for Argo CD or Flux. The separate Redis Secret remains under your normal secret-management process.</p></div>
  </div>
  <div class="callout"><p><strong>What is <code>--pull</code>?</strong> It points cub at an installer package. For a public chart, first check that its page links a publication receipt. Then use the package's <code>oci://</code> reference. cub pulls the package into the work directory and writes <code>out/spec</code> and <code>out/manifests</code>. Repository maintainers can use the local <code>packages/...</code> path while a reference is still marked assigned.</p></div>
  <div class="callout"><p><strong>Registry access today.</strong> ${escapeHtml(INSTALLER_OCI_AUTH_NOTE)}</p></div>

  <h2>2 · Upgrade the same Redis configuration</h2>
  <p>Now move the same work directory from Redis chart 25.5.3 to 27.0.0. With no account, cub can retain the package selection and inputs it knows about. The recorded ConfigHub proof also checks one specific post-render change: a replica count that the newer base does not change.</p>
  <div class="two">
    <div class="box">
      <h3>No account: the package choice stays</h3>
      <p class="tag">no ConfigHub account</p>
      <pre><code># Re-enter the same work directory with the newer public package.
cub installer setup --pull ${REDIS_27_INSTALLER_PINNED_OCI_REF} \\
    --work-dir ./redis --reuse --non-interactive --namespace redis \\
    --output-oci ./redis-27.oci

cat ./redis/out/spec/selection.yaml
# base: reuse-existing-secret</code></pre>
      <p>The selected existing-Secret base is retained. The newer output contains Redis 8.8.0 and chart 27.0.0, still as 14 non-secret objects, and the second OCI is pulled back and verified. This does not claim that an arbitrary hand edit survives without ConfigHub.</p>
    </div>
    <div class="box">
      <h3>With a ${signupLink("try", "free account")}: review a stored change</h3>
      <p class="tag">${signupLink("try", "free account")}</p>
      <pre><code># Record the 25.5.3 objects.
cub installer upload --work-dir ./redis --space my-redis \\
    --component redis-upgrade --variant base

# Record one exact change in ConfigHub: two Redis replicas.
cub k8s get sts --space my-redis
cub run set-replicas --space my-redis \\
    --unit &lt;replica-statefulset-unit&gt; --replicas 2 \\
    --change-desc "Keep two Redis replicas through chart upgrades" --wait

# Pull 27.0.0. setup reads upload.yaml; plan shows the comparison.
cub installer setup --pull ${REDIS_27_INSTALLER_PINNED_OCI_REF} \\
    --work-dir ./redis --reuse --non-interactive --namespace redis
cub installer plan --work-dir ./redis
cub installer upload --work-dir ./redis --yes</code></pre>
      <p>The recorded run upgraded the chart from 25.5.3 to 27.0.0 and Redis from 8.6.3 to 8.8.0. The newer base did not change <code>spec.replicas</code>, so the recorded value remained two. A change to a field that the newer base also changes must be reviewed in the plan before upload. <code>setup</code> re-enters from <code>upload.yaml</code>, and <code>upload</code> compares the new package output with the recorded Units.</p>
    </div>
  </div>

  <h3>What the managed run did after the upgrade</h3>
  <p>The <a href="./d/data/redis-upgrade-app-proof/summary.html">Redis upgrade and rollback proof</a> continued the same example. It identified development and staging as the affected environments and promoted them in order. It published one reviewed OCI and reconciled that digest on two Argo CD clusters. Both Redis installations became ready and answered <code>PONG</code>. It then restored the exact pre-upgrade revisions, published a rollback OCI, and verified both clusters again.</p>
  <p>The proof also records its limits. The promotion dry run produced no readable mutation output. The portable OCI used a temporary registry. The rollback restored desired Kubernetes objects, not database data.</p>

  <h2>3 · See why the Redis base matters</h2>
  <p>The Redis <code>default</code> catalog base is retained as an explicit static-password demonstration. Its rendered YAML contains credential material, so the chart page warns against treating it as a production default. The recommended <code>reuse-existing-secret</code> base used above contains no Secret object and names the Secret that must exist at delivery time.</p>
  <pre><code># Compare the two choices without touching a cluster.
cub installer setup --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
    --base default --work-dir ./redis-static \\
    --non-interactive --namespace redis
grep -R "kind: Secret" ./redis-static/out/manifests

grep -R "kind: Secret" ./redis/out/manifests
# no match: reuse-existing-secret keeps the credential outside the files</code></pre>
  <p>This is the sort of choice the catalog records for people and agents. It does not pretend that every chart has one universal answer. For another common case, take a chart and values file produced by AI and <a href="./testing.html#bring-your-own">review the exact rendered objects before applying them</a>.</p>

  <h2>4 · Already on Argo or Flux? Write OCI directly</h2>
  <p>If your cluster pulls from an OCI registry, give <code>--output-oci</code> a registry reference instead of a local path. The installer pushes the same 14 non-secret Redis objects you inspected. It records the source package and selected base. It then reads the artifact back and verifies its object-set digest. Registry write access is the only additional requirement.</p>
  <pre><code>cub installer setup --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
    --base reuse-existing-secret --work-dir ./redis \\
    --non-interactive --namespace redis \\
    --output-oci oci://&lt;your-registry&gt;/redis:v1</code></pre>
  <p>The <a href="./d/data/serverless-oci-gitops-proof/summary.html">live no-account NGINX proof</a> runs this exact installer output path against a temporary registry. Flux reconciled the recorded output digest and the Deployment reached its desired replica count.</p>

  <h2>What we checked</h2>
  <p>The Redis steps above are backed by separate receipts. A render check does not stand in for a Kubernetes run, an OCI delivery, or an upgrade test.</p>
  <table class="gtable">
    <tr><th>Check</th><th>What it shows</th></tr>
    <tr><td><a href="./d/data/redis-public-walkthrough-proof/summary.html">Public Redis walkthrough</a></td><td>Anonymous pulls of 25.5.3 and 27.0.0, 14 non-secret objects at each version, the same selected base after upgrade, and both local OCI outputs pulled back and verified.</td></tr>
    <tr><td><a href="./d/data/serverless-install-parity-proof/summary.html">Same live install as Helm</a></td><td>Helm and cub produced the same 13 Redis chart objects; cub added the explicit Namespace; both live installations became ready and answered <code>PING</code>.</td></tr>
    <tr><td><a href="./d/data/serverless-oci-gitops-proof/summary.html">Rendered OCI reaches Flux</a></td><td>For a separate NGINX preset, <code>cub installer setup --output-oci</code> wrote and verified the artifact, Flux reconciled its digest, and the workload reached 1/1 ready replicas.</td></tr>
    <tr><td><a href="./d/data/redis-upgrade-app-proof/summary.html">Managed upgrade and rollback</a></td><td>A post-render Redis replica edit stayed through the 25.5.3 to 27.0.0 upgrade, moved through two environments, reached two Argo CD clusters at one digest, and was restored by exact revision.</td></tr>
  </table>

  <h2>Check it yourself</h2>
  <p>The first command checks the committed receipt. The second repeats the public no-account run against the current registry packages. Neither command touches Kubernetes.</p>
  <pre><code>npm run redis-public-walkthrough:verify
npm run redis-public-walkthrough:run</code></pre>
  <p class="quiet-line">The Verification page lets you run the checks yourself, read the evidence we've recorded, or start a fresh live test.</p>

  ${productDocsPointer("try")}
  <p class="closing-line">Try the public Redis walkthrough first. When you are ready to use your own example, bring a chart and values file that you or an AI produced. The <a href="./testing.html#bring-your-own">bring-your-own path</a> renders it, reports exact object and field findings, keeps the changes you actually wanted, and builds a reviewed OCI.</p>
  <p class="quiet-line"><a href="./how-it-works.html">Deployment</a> · <a href="./charts/bitnami-redis-25-5-3.html">Redis chart page</a> · <a href="./testing.html#bring-your-own">Check my config</a> · <a href="./demo-org.html">The demo org</a> · <a href="./verification.html">Open verification</a></p>
</main>
<footer><p>The public steps need no ConfigHub account. Managed changes, promotion, and rollback use ConfigHub.</p></footer>
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
  <title>Work without an account · Config Workshop</title>
  <style>${siteCss()}${installPageCss()}</style>
</head>
<body>
  <header class="hero human-hero install-hero">
    ${topNav(".")}
    <div class="install-hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">All local, no sign-in</p>
        <h1>Work without an account</h1>
  <p class="boundary-chip">Runs on your laptop</p>
        <p class="lead">Everything on this page runs on your laptop. You can render any public catalog package, edit its fields, and push an OCI bundle without signing in to anything.</p>
        <p>Inspect the objects and prerequisites, keep them as files, or write the non-secret objects to OCI. A cluster is needed only when you choose to deploy them.</p>
        <div class="chips" aria-label="What this path needs"><span>local or CI</span><span>no ConfigHub Server</span><span>no account</span></div>
      </div>
      <div class="terminal-card" aria-label="Redis install comparison">
        <div class="terminal-title">redis → redis</div>
        <pre class="terminal-body"><code><span class="term-comment"># before either install: provide the password separately</span>
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
<span class="term-prompt">$</span> cub installer setup --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
    --base reuse-existing-secret --namespace redis \\
    --work-dir ./redis --non-interactive \\
    --output-oci ./redis-rendered.oci
<span class="term-prompt">$</span> kubectl apply -f ./redis/out/manifests -n redis</code></pre>
      </div>
    </div>
    <p class="caption">The preset's rendered objects have a committed Helm-equivalence receipt. Run the Helm and cub lanes on separate throwaway clusters when you want to compare the live result.</p>
  </header>
  <main>
    <section class="narrow-section callout-section" aria-labelledby="package-note">
      <h2 id="package-note">1. Pull a public catalog package</h2>
      <p>It points cub at an installer package: a reviewed chart/version with bases, recorded inputs, rendered objects, and proof links. For public catalog charts, use the package's <code>oci://</code> ref after the chart page shows a publication receipt. cub pulls that package into the work directory, then writes <code>out/spec</code> and <code>out/manifests</code>. In this repo, maintainers may also use the local <code>packages/...</code> source path while a ref is still marked assigned.</p>
      <p>${escapeHtml(INSTALLER_OCI_AUTH_NOTE)}</p>
    </section>

    <section class="narrow-section" aria-labelledby="where-it-fits">
      <h2 id="where-it-fits">2. Choose a no-account task</h2>
      <p>You can use them before an OCI package is built, after you pull one, or between an input package and an output package.</p>
      <div class="step-grid">
        <div class="card"><h3>Build OCI from local configuration</h3><p>Inspect and test a chart, recipe, installer package, or set of Kubernetes files. Then build an OCI package.</p></div>
        <div class="card"><h3>Inspect an OCI package</h3><p>Pull a public OCI package to inspect its objects, run checks, or compare it with another version.</p></div>
        <div class="card"><h3>Change an OCI package</h3><p>Pull a package, test or edit the exact objects, and build a new package. Publishing it to a registry requires registry credentials.</p></div>
      </div>
      <p>Here, work means inspect, explain, test, scan, compare, or edit. It can run as a local command or in CI today. A public hosted service that can do this work without signing in is planned, but not yet shipped.</p>
    </section>

    <section class="narrow-section" aria-labelledby="change-oci">
      <h2 id="change-oci">3. Change an existing OCI without signing in</h2>
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
      <h2 id="how">4. Render a Helm package before applying it</h2>
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
      <h2 id="gitops">5. Deliver the OCI with Argo CD or Flux</h2>
      <p>Already running Argo CD or Flux from an OCI registry? Give <code>--output-oci</code> a registry reference. The installer pushes the non-secret objects, reads the artifact back, and checks the object-set digest before returning.</p>
      <div class="terminal-card">
        <div class="terminal-title">redis → OCI</div>
        <pre class="terminal-body"><code><span class="term-prompt">$</span> cub installer setup --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
    --base reuse-existing-secret --namespace redis \\
    --work-dir ./redis --non-interactive \\
    --output-oci oci://&lt;your-registry&gt;/redis:v1
<span class="term-prompt">$</span> flux create source oci redis --url=oci://&lt;your-registry&gt;/redis --tag=v1 --interval=30s
<span class="term-prompt">$</span> flux create kustomization redis --source=OCIRepository/redis --path=./ --prune=true</code></pre>
      </div>
      <p>The <a href="./d/data/serverless-oci-gitops-proof/summary.html">live NGINX proof</a> uses this installer output path with no ConfigHub token. Flux reconciled the exact output digest and the workload reached 1/1 ready replicas. The <a href="./d/data/serverless-install-parity-proof/summary.html">Redis comparison</a> independently verifies a local rendered OCI and full Helm parity for the existing-Secret configuration.</p>
    </section>

    <section class="narrow-section" aria-labelledby="edges">
      <h2 id="edges">6. Read the current limits</h2>
      <p><strong>The chart's normal default carries password material in its rendered Secret.</strong> The catalog recommends <code>reuse-existing-secret</code> instead. That preset names the Secret the target must provide, and the rendered OCI contains no password.</p>
      <p><strong><code>kubectl</code> does not wait for the namespace.</strong> Create the namespace first. A controller such as Argo or Flux can order this for you.</p>
      <p><strong><code>cub installer push</code> publishes the multi-preset source package.</strong> Users pull that package with <code>cub installer setup --pull</code>. The separate <code>--output-oci</code> artifact contains one selected preset's exact non-secret Kubernetes objects for Argo CD, Flux, or another OCI consumer.</p>
      <p>A chart with hooks, admission webhooks, or its own CRDs needs more than a render. Its chart page says which lifecycle steps apply.</p>
      <p><a href="./try.html">Open Get Started</a> · <a href="../docs/user/serverless-mode.md">Read the source guide</a></p>
    </section>
  </main>
  <footer><p>Generated from committed helm-expt evidence. These examples need neither ConfigHub Server nor an account. ${signupLink("serverless", "Save the configuration in ConfigHub")} when it needs shared variants, approvals, or a fleet rollout.</p></footer>
</body>
</html>
`;
}

function docsReferenceHtml(catalog) {
  const stageRows = [
    ["1. Choose", "Start with Helm, AICR, existing OCI, or Kubernetes YAML.", "<a href=\"./testing.html\">Examples</a>", "No"],
    ["2. Inspect", "Create exact Kubernetes objects and read them before delivery.", "<a href=\"./try.html\">Try Redis</a>", "No"],
    ["3. Record", "Store one reviewed configuration and release it.", `<a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "docs-stages")}">Official tutorial</a>`, "Yes"],
    ["4. Change", "Add development and production configurations.", `<a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "docs-stages")}">Official tutorial</a>`, "Yes"],
    ["5. Promote", "Move a reviewed change from its base through development and production.", `<a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "docs-stages")}">Official tutorial</a>`, "Yes"],
  ];
  const startRows = [
    ["Learn ConfigHub", `<a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "docs-start")}">Official tutorial</a>`, "Set up a cluster. Install and release one component. Change it, add production, and promote the change."],
    ["Try Redis without an account", `<a href="./try.html">Try Redis</a>`, "Render one reviewed Redis configuration. Inspect the files and local OCI without ConfigHub Server."],
    ["Try AICR without an account", `<a href="./try-aicr.html">Try AICR</a>`, "Pull one public AICR configuration, reproduce the seven-Application CPU starter, verify every file, and write a local OCI without a cluster or GPU."],
    ["Follow the complete Redis example", `<a href="./redis-walkthrough.html">Detailed Redis walkthrough</a>`, "Add Helm parity, Kubernetes, a major upgrade, promotion, two-cluster delivery, and rollback."],
    ["Check or promote your own config", `<a href="./ask.html">Check my config</a>`, "Compare exact objects in your browser, carry Catalog lifecycle facts into the review, then continue to a source-aware promotion plan."],
    ["Use your AI agent", `<a href="./ai.html">AI agents</a>`, "Install the Config Workshop skill, choose one task, and keep source records, exact objects, lifecycle work, checks, and limits visible."],
    ["Choose a worked example", `<a href="./testing.html">Examples</a>`, "Start with Helm, AICR, OCI, or YAML. Continue with ConfigHub only when you want saved configuration and managed operations."],
    ["Start or adopt a Kubara platform", `<a href="./kubara.html">Kubara with ConfigHub</a>`, "Generate one small native Kubara development platform, or bring an existing platform through Git and OCI. Keep Kubara as composer and Argo CD as reconciler."],
    ["Follow configuration to deployment", `<a href="./how-it-works.html">Deployment</a>`, "See where each tool fits, where settings belong, and how a reviewed result reaches a cluster."],
    ["See every source and App demonstration", `<a href="../docs/user/config-catalog-demonstrations.md">Demonstration record</a>`, "See the exact example that ran, its result, and the work still needed for broader support."],
    ["Choose a public component", `<a href="./charts/index.html">Component Catalog</a>`, "Pick an exact retained package version, then read its packaged configurations, output, hooks, CRDs, setup work, and evidence."],
    ["Open the demo org", `<a href="./demo-org.html">Demo org</a>`, "See the same examples inside Hub. Each Space has a short README and the Kubernetes YAML for that example."],
    ["Use an App on ConfigHub", `<a href="./journey.html">Apps</a>`, "Use saved configuration for upgrade review, hooks and CRDs, RBAC review, fleet rollout, or AI change review."],
    ["Check a claim", `<a href="./verification.html">Check one claim</a>`, "Choose the command that answers your question and see whether it uses saved evidence or a fresh run."],
    ["Read the limits", `<a href="./hard-questions.html">FAQ</a>`, "Hooks, CRDs, upgrades, generated secrets, AI changes, rollback, and current gaps."],
    ["Know when managed help begins", `<a href="./private/">Upgrade</a>`, "Private sources, production support, teams, policies, fleet operations, and commercial boundaries."],
  ];
  const guideRows = [
    ["Official ConfigHub tutorial", "Set up a cluster, install and release one component, make a change, add production, and promote the change.", CONFIGHUB_TUTORIAL_URL],
    ["Examples", "Choose a starting input, then see working promotion, delivery, platform, policy, and App examples.", "./testing.html"],
    ["Detailed entry paths", "Commands and proof links for Helm, AICR, existing OCI, and Kubernetes YAML.", "./entry-path-reference.html"],
    ["Deployment", "Start with Helm, AICR, OCI, or YAML, then inspect, manage, promote, and deploy the reviewed result.", "./how-it-works.html"],
    ["Config catalog demonstrations", "The maintained paths for Helm, AICR, cub installer, public OCI work, Kubara, and Sveltos, followed by variants, promotions, policy, and five ConfigHub Apps.", "../docs/user/config-catalog-demonstrations.md"],
    ["Config catalog doctrine", "The anonymous-to-managed boundary, four OCI package roles, base variants, fleet delivery, policy rules, and AI maintenance rules.", "../docs/reference/config-catalog-doctrine.md"],
    ["When to flatten configuration", "Choose exact objects, exact objects with recorded setup, or late source processing for one source, configuration, and target.", "../docs/reference/flattening-alignment.md"],
    ["Check and promote with AI", "Use the browser-local Check and Promote records with your own assistant, source-aware field attribution, exact target results, and an optional ConfigHub handoff.", "../docs/user/check-and-promote-with-ai.md"],
    ["Anonymous browser check", "Inspect rendered YAML, compare exact objects, run static checks, and download one complete result for your own AI or CI without signing in.", "../docs/user/anonymous-browser-workshop.md"],
    ["Anonymous OCI work in CI", "A GitHub Actions run with no ConfigHub credentials pulls a public package, renders and checks its objects, creates an OCI layout, and pulls the same objects back.", "../data/anonymous-oci-ci-proof/summary.md"],
    ["Anonymous OCI change", "Pull five public NGINX objects without credentials, change only the replica count, store the source and check records, and pull the new local OCI back for comparison.", "../data/anonymous-oci-transform-proof/summary.md"],
    ["Redis public walkthrough", "Pull Redis 25.5.3 and 27.0.0 anonymously, retain the selected existing-Secret base, keep Secrets out of both object sets, and verify both local OCI outputs by pulling them back.", "../data/redis-public-walkthrough-proof/summary.md"],
    ["OCI import, promotion, and two-cluster rollout", "One live run imports exact Kubernetes objects from OCI, promotes a change through development and staging, exports one deployable OCI, and records exact-object and convergence receipts on two Argo CD clusters.", "../data/oci-deploy-stage-rollout-proof/summary.md"],
    ["Redis upgrade, promotion, and rollback", "A live chart upgrade keeps a post-render replica change, moves through development and staging, reaches two Argo CD clusters, then restores the exact pre-upgrade revisions and checks both clusters again.", "../data/redis-upgrade-app-proof/summary.md"],
    ["AICR EKS H100 example", "AICR selects and orders a GPU platform. Two public OCI artifacts carry the source package and 17 exact Argo CD Applications. ConfigHub stores the Applications as a base, changes one Grafana Secret reference in development, and promotes that result to staging.", "../docs/demo/aicr/eks-h100-training-kubeflow.md"],
    ["AICR anonymous CPU starter", "Pull the retained AICR configuration without credentials, select and hash-check seven Applications, then write and verify a local OCI without contacting ConfigHub or Kubernetes.", "../data/aicr-cpu-starter-public-proof/summary.md"],
    ["AICR OCI round trip", "A live OCI-to-ConfigHub-to-OCI test imports 17 AICR-generated Argo CD Applications, publishes a ConfigHub release, pulls it back, and compares every object without claiming a GPU rollout.", "../data/aicr-oci-roundtrip-proof/summary.md"],
    ["AI change review proof", "ConfigHub reports a mutable nested AICR image, blocks an inline API key, clears the reviewed candidate, requires approval, and leaves ordinary Deployment checks off the custom resource.", "../data/ai-change-review-live-proof/summary.md"],
    ["Gated answer: what will this install", "An assistant answers the most common question from a metrics-server render, and a gate holds the answer to the exact objects and prerequisites so it cannot invent or omit one.", "../data/ai-install-shape/summary.md"],
    ["Gated answer: candidate versus production", "An assistant diffs two Redis releases, and a gate holds the answer to the exact object diff, one removed Secret and two changed StatefulSets.", "../data/ai-config-diff/summary.md"],
    ["Gated answer: why a set value did nothing", "An assistant says which supplied Redis values reached the render and which were ignored, and the gate confirms each against the render.", "../data/ai-ignored-values/summary.md"],
    ["Gated answer: upgrade risk", "An assistant judges a Redis 25 to 27 upgrade by removed, immutable, and image changes, and the gate holds the verdict to what the two renders show.", "../data/ai-upgrade-risk/summary.md"],
    ["Review to promotion handoff", "A check reads the live promotion receipt and confirms the governed Redis promotion carried the same reviewed bytes through development and staging in order.", "../data/ai-promotion-handoff/summary.md"],
    ["Gated answer: hooks and CRDs", "An assistant lists the Kube Prometheus Stack CRDs, the custom resources that need them first, and the admission webhooks that need a caBundle, and a gate holds each claim to the render.", "../data/ai-lifecycle-work/summary.md"],
    ["Gated answer: where a fleet image runs", "An assistant places a Redis image-digest change across four environments, and a gate holds it to the fleet matrix, including the one environment an override shields.", "../data/ai-fleet-image/summary.md"],
    ["Gated answer: must I fork for a missing field", "An assistant proposes the smallest post-render edit instead of a fork, and a gate confirms the edit targets a real Redis object and adds a field the render does not already carry.", "../data/ai-custom-field/summary.md"],
    ["Gated answer: roll back to exact revisions", "A check reads the live rollback receipt and confirms a retained change set restored 14 Redis units to their exact pre-upgrade revisions, back to the prior chart version.", "../data/ai-rollback-history/summary.md"],
    ["Gated answer: same version, same bytes", "An assistant compares a recipe's locked digest against the digest a publisher later served for the same version, and a gate holds the same-bytes verdict to the upstream-drift record.", "../data/ai-supply-drift/summary.md"],
    ["RBAC review example", "Find unnecessary Secret access, make one exact Role change, require approval, publish the reviewed objects as OCI, and let Argo CD deliver the result.", "../docs/demo/apps/rbac-review.md"],
    ["RBAC permissions report", "Review broad RBAC rules across committed default chart renders without needing a cluster or running Helm again.", "../data/app-readiness/summary.md"],
    ["Kubara with ConfigHub", "The buyer landing page: what stays Kubara, what ConfigHub adds, the six adoption steps, measured benefits, current proof status, GUI tour, and honest boundaries.", "./kubara.html"],
    ["Kubara six-step adoption tutorial", "Choose components, generate with Kubara, push the complete Git hand-off, create immutable OCI, load the selected ConfigHub organization, and deploy applications through Argo CD.", "../docs/demo/kubara/adoption.md"],
    ["Kubara + ConfigHub technical mini-IDP", "The complete maintainer-grade v0.13.0 runbook: four clusters, seven platform roles, two apps, exact catalog generation, Git/OCI import, matrix, wiring, faithful hub-spoke delivery, and receipt-gated ConfigHub platform surfaces.", "../docs/demo/kubara/single-platform.md"],
    ["Historical Kubara v0.12.0 compatibility proof", "Retained read-only evidence for the one-cluster generation, OCI route, Argo bootstrap, and dated live result. It is not a command path for the current Kubara organization.", "../docs/demo/kubara/local-platform.md"],
    ["Sveltos Kyverno fleet example", "A two-wave result: ConfigHub approves a pilot and one selector expansion at different OCI digests, then Argo CD and Sveltos deliver Kyverno to one staging cluster and later to both.", "../docs/demo/sveltos/kyverno-fleet.md"],
    ["Hooks and CRDs example", "Kube Prometheus Stack install order, eight checked route records, Argo CD and Flux choices, live evidence, and what remains manual.", "../docs/demo/hooks-crds/kube-prometheus-stack.md"],
    ["Try Redis", "Render and inspect one reviewed Redis configuration without ConfigHub Server or a ConfigHub account.", "./try.html"],
    ["Try AICR", "Pull and verify one AICR-derived seven-Application configuration without a ConfigHub account, cluster, cloud account, or GPU.", "./try-aicr.html"],
    ["Detailed Redis walkthrough", "Add Helm parity, Kubernetes, OCI, a major upgrade, promotion, two-cluster delivery, and rollback.", "./redis-walkthrough.html"],
    ["Check one claim", "Choose one project check, see what it proves, and learn whether it needs a cluster.", "./verification.html"],
    ["AI agents", "Install the Config Workshop skill for known Catalog questions, your own configuration, promotion review, and cross-format source inspection.", "./ai.html"],
    ["Choose a component", "Browse component pages, retained versions, packaged configurations, known risks, and first-use advice.", "./charts/index.html"],
    ["Live ConfigHub example guides", "README pages for live demo Spaces. Each guide says why the Space exists and what to inspect first.", "../data/helm-catalog-readmes/summary.md"],
    ["Installer package OCI refs", "The package refs users pull with cub installer setup --pull oci://..., and how they differ from ConfigHub delivery OCI.", "../docs/user/installer-oci-packages.md"],
    ["Inspect an OCI package", "One command that identifies the package role, resolves its digest, and reports the exact Kubernetes objects and obvious lifecycle work it contains.", "../docs/user/inspect-oci-package.md"],
    ["Change an OCI package", "Change one field in a literal Kubernetes OCI, run checks, keep its source records, and build a new local OCI without a ConfigHub account.", "../docs/user/transform-oci-package.md"],
    ["Helm base variants and values", "Why the catalog supports useful chart-specific base variants instead of claiming every values combination.", "../docs/user/helm-presets-and-values.md"],
    ["Chart setup and lifecycle work", "Find the hooks, CRDs, webhooks, generated values, storage, and RBAC a chart still needs.", "./quirks.html"],
    ["Create variants", "When to make a new Helm-rendered base, and when to make a ConfigHub version after render.", "./variants.html"],
    ["Apps", "Use configuration saved in ConfigHub for upgrade review, hooks and CRDs, RBAC review, fleet rollout, and AI change review.", "./journey.html"],
    ["Combine charts and your service", "Put public charts and services your team owns into one reviewed application release.", "./custom-apps.html"],
    ["Understand an existing app", "Start read-only from Argo CD, Flux, rendered YAML, live cluster state, or a Helm release.", "./existing-apps.html"],
    ["Ops", "Release, observe, patch, and upgrade after the files are recorded.", "./operations.html"],
    ["Review security before release", "Review exact objects, Secrets, checks, approvals, OCI delivery, and the limits of each result.", "./security.html"],
    ["Current and planned work", "Separate results you can use today from ideas that remain planned or partly tested.", "./future.html"],
    ["Find a direct answer", "Direct answers about hooks, upgrades, AI changes, free use, and current limits.", "./hard-questions.html"],
    ["See what is not ready yet", "Current limitations, their effect, and the safest action available now.", "./known-gaps.html"],
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
    ["Verification checks", "See which checks cover rendering, ConfigHub upload, delivery, live state, or a two-cluster comparison.", "../docs/user/verification-lanes.md"],
    ["Hook lifecycle strategy", "How chart hooks become visible work with status and receipts.", "../docs/user/hook-lifecycle-strategy.md"],
  ];
  const dataRows = [
    ["Catalog data", "The chart and variant matrix.", "./matrix.html"],
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
    ["Check one claim", "Choose the right project command for one question.", "./verification.html"],
    ["See what has been tested", "Compare render, ConfigHub, OCI, GitOps, and live Kubernetes test coverage.", "./proof.html"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>All Technical References · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>All technical references</h1>
    <p class="lead">This is the complete guide and evidence index. Use the shorter <a href="./docs.html">Docs page</a> when you need help with one current task.</p>
    <p>Use this index for deeper product behavior, repository work, generated evidence, and exact proof records.</p>
    ${humanLinks([["Official tutorial", CONFIGHUB_TUTORIAL_URL], ["Try Redis", "./try.html"], ["Examples", "./testing.html"], ["Check one claim", "./verification.html"]])}
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
      <h2 id="chart-evidence">How to read chart evidence</h2>
      <p>Start from the public chart page. Do not start from a generated package folder unless you already know what you are looking for.</p>
      ${markdownLikeTable([
        ["Step", "Open", "What you learn"],
        ["1", "Chart page", "Which base variants are supported and what still needs work."],
        ["2", "Full rendered YAML", "The Kubernetes objects captured from one base variant. This is the output of the render."],
        ["3", "Render intent", "The Helm chart version, values, namespace, release name, capability profile, source lock, output path, and evidence links."],
        ["4", "Hooks, CRDs, and setup work", "The route decisions for chart behavior that is not just static YAML."],
        ["5", "Check one claim", "The commands and receipts that back a claim."],
      ])}
    </section>

    <section aria-labelledby="technical-words">
      <h2 id="technical-words">How this site uses technical words</h2>
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

    <section aria-labelledby="example-materials">
      <h2 id="example-materials">Where example materials live</h2>
      <p>The <a href="./testing.html">Examples page</a> explains what to run. Use this table when you need the source, stored record, or published package behind an example.</p>
      ${markdownLikeTable([
        ["Place", "What belongs there"],
        ["This website", "Short explanations, worked examples, chart pages, and links to current proof."],
        ["GitHub", "Source configuration, generators, scripts, checks, receipts, and every file used to make the website."],
        ["The ConfigHub helm-catalog organization", `Persistent demo Spaces. Each Space has one README Unit that explains its purpose and the Units it contains. <a href="./demo-org.html">Open the demo-org guide</a>.`],
        ["Public OCI registry", "Stable starting packages and reviewed public outputs. Each permanent artifact has a role, digest, source record, guide, and publication receipt."],
        ["ConfigHub release OCI", "Approved outputs from managed Spaces for Argo CD, Flux, or another recorded delivery path."],
        ["Temporary proof registry", "Short-lived artifacts used by one receipt. The site does not advertise them as permanent packages."],
      ], { rawSecondColumn: true })}
      <p><a href="./entry-path-reference.html">Open the detailed entry-path reference</a> for commands, OCI roles, source-to-OCI automation, hooks, CRDs, and proof links.</p>
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
      <h2 id="database">Verification and evidence</h2>
      <p>Each chart page gives the short answer: what can I try, and what should I watch first? The matrix and generated data are for review work. They show where the chart answer came from: render inputs, test results, receipts, known gaps, and claim status.</p>
      ${markdownLikeTable([
        ["Evidence", "What it helps with", "Open"],
        ...dataRows.map(([name, body, path]) => [name, body, `<a href="${path}">${escapeHtml(name)}</a>`]),
      ], { rawThirdColumn: true })}
    </section>
  </main>
  <footer>Generated from helm-expt catalog data. Use the main guides first, then the matrix and generated data when you need exact status.</footer>
</body>
</html>
`;
}

// The comparison every persona asked for and the site never answered: what is
// this versus helm template, kubectl diff, and Kustomize overlays. The honest
// answer includes the disqualifier, because publishing who should not use this
// is what makes the rest believable. Rows are jobs, not features, and the tools
// are treated as things this works with rather than competes against.
function compareHtml() {
  const rows = [
    ["See what a chart will create, before any cluster exists",
      "Yes. This is the job it does.",
      "No. It diffs against a live cluster, so it needs one.",
      "No. Overlays patch objects you already have.",
      "Same answer as helm template, plus the catalog's recorded hazards for 112 charts: hooks, CRDs, lookups, generated secrets."],
    ["Diff a values change before applying it",
      "Yes, by rendering twice and diffing yourself.",
      "Yes, against what the cluster runs now.",
      "Yes, between overlays.",
      "The same two-render diff, plus committed worked examples with the numbers already in them."],
    ["Know a published package did not change under you",
      "No. helm pull fetches today's bytes and keeps no history.",
      "No.",
      "No.",
      "Yes. Packages are retained at pinned digests, and the drift record caught two publishers republishing under unchanged version strings."],
    ["Keep an exact record of what shipped, per environment",
      "Partly. Releases live in cluster Secrets and re-render from templates.",
      "No.",
      "Partly, if your Git discipline is perfect and nobody edits live.",
      "Yes, with ConfigHub: immutable releases at exact digests, per variant, with revision history."],
    ["Roll back to exactly what ran before",
      "Helm can return to a stored release revision, but that alone does not prove that external effects were reversed.",
      "No.",
      "Git revert re-renders; the old rendered state is not kept.",
      "ConfigHub can restore a recorded desired object set. The bounded Redis proof does this on two test clusters; it does not reverse database migrations, cloud resources, or other external effects."],
    ["Require an approval bound to an exact revision",
      "No.",
      "No.",
      "PR review approves a diff, not a revision a cluster converges to.",
      "Yes, with ConfigHub: approving yesterday's revision authorizes nothing about today's."],
  ];
  const rowsHtml = rows.map(([job, helm, kdiff, kust, here]) => `<tr><td><strong>${job}</strong></td><td>${helm}</td><td>${kdiff}</td><td>${kust}</td><td>${here}</td></tr>`).join("\n        ");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Versus what you already use &middot; Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Versus what you already use</h1>
    <p class="lead">You already have helm template, kubectl diff, and Kustomize, and they are good tools. This page says what each one answers, what none of them answer, and who does not need us at all.</p>
    <p><strong>If you are one person with three charts and you already read your helm template output, you do not need this site.</strong> Bookmark the catalog for the day a chart misbehaves, and carry on.</p>
  </header>
  <main>
    <section aria-labelledby="jobs">
      <h2 id="jobs">Six jobs, four tools</h2>
      <div class="card" style="overflow-x: auto;"><table>
        <thead><tr><th>The job</th><th>helm template</th><th>kubectl diff</th><th>Kustomize overlays</th><th>This catalog, and ConfigHub where marked</th></tr></thead>
        <tbody>
        ${rowsHtml}
        </tbody>
      </table></div>
      <p>The first two rows work with no account. The last three need ConfigHub because they depend on shared history. A local tool cannot answer questions about changes that it has never recorded.</p>
    </section>

    <section aria-labelledby="works-with">
      <h2 id="works-with">This works with your tools, not instead of them</h2>
      <p>The catalog renders Helm charts to plain Kubernetes objects. You can patch those objects with Kustomize exactly as you do today, keep reviewing PRs, and keep your reconciler. Nothing here replaces your overlays or wants to own your YAML. If you arrived expecting a Kustomize replacement, this is not one, and you can stop reading here.</p>
      <p>Two worked artifacts to take with you either way: <a href="./d/docs/user/example-rendered-diff.html">one real rendered diff between two chart versions</a>, computed from committed renders, and <a href="./d/docs/user/ci-render-check.html">a local CI report</a> that turns the same checked result into Markdown or JSON. GitHub Actions is one optional place to post it.</p>
    </section>
  </main>
  <footer>The fastest way to check any claim in the table is the receipt behind it. Start with the drift record and the upgrade proof.</footer>
</body>
</html>
`;
}

// What changed recently, rendered from the committed receipt-aging table so the
// page is deterministic and dated rather than a hand-maintained list that rots.
function whatsNewHtml() {
  const csv = readFileSync(join(repoRoot, "data", "receipt-aging", "aging.csv"), "utf8");
  const rows = parseCsv(csv);
  check(rows.length > 100, "receipt-aging table looks truncated; refusing to render What's new from it");
  check(rows[0].receipt && rows[0].family && rows[0].age_days !== undefined, "receipt-aging columns changed; update whatsNewHtml");
  const recent = [...rows]
    .filter((row) => row.recorded)
    .sort((left, right) => Number(left.age_days) - Number(right.age_days))
    .slice(0, 20);
  const items = recent.map((row) => `<tr><td class="mono">${escapeHtml(String(row.recorded).slice(0, 10))}</td><td>${escapeHtml(row.family)}</td><td class="mono" style="overflow-wrap: anywhere;">${escapeHtml(row.receipt)}</td></tr>`).join("\n        ");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>What changed &middot; Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>What changed recently</h1>
    <p class="lead">The twenty newest receipts in the catalog, straight from the committed evidence-aging table. A returning visitor can tell in one look whether anything moved since last time.</p>
    <p>For the machine-readable version, <a href="./changes.json">changes.json</a> lists every chart, version, and digest. The <a href="./d/data/receipt-aging/summary.html">full aging record</a> dates every receipt and names the oldest in each family, including ours.</p>
  </header>
  <main>
    <section aria-labelledby="recent">
      <h2 id="recent">Twenty newest receipts</h2>
      <div class="card" style="overflow-x: auto;"><table>
        <thead><tr><th>Recorded</th><th>Proof family</th><th>Receipt</th></tr></thead>
        <tbody>
        ${items}
        </tbody>
      </table></div>
      <p>Charts added and versions retained appear here as their receipts land. Gaps closed appear as the lane that was red going green in the verify chain.</p>
    </section>
  </main>
  <footer>Generated from data/receipt-aging/aging.csv. If this page looks stale, the aging table is what to regenerate.</footer>
</body>
</html>
`;
}


// Every render path ends with delivery. The persona study's strongest causal
// signal: every run that reached a deploy document converted, and the reader
// who could not find one deployed by hand. The manifests are complete rather
// than fragments, and the registry push that must happen first is stated.
function nowDeployBlocksHtml() {
  return `<h3 id="now-deploy">Now deploy it, three ways</h3>
      <p><strong>Runs on your laptop until the apply:</strong> pushing the rendered layout to a registry needs only registry credentials, not a ConfigHub account.</p>
      <p>First, put the rendered bundle somewhere a controller can pull: <code>flux push artifact oci://REGISTRY/redis-rendered:v1 --path ./redis/out/manifests --source local --revision v1</code> (or <code>oras cp</code> the local layout).</p>
      <p><strong>kubectl</strong></p>
      <pre><code>kubectl apply -f ./redis/out/manifests/</code></pre>
      <p><strong>Flux</strong></p>
      <pre><code>apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata: { name: redis-rendered, namespace: flux-system }
spec:
  interval: 5m
  url: oci://REGISTRY/redis-rendered
  ref: { tag: v1 }
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata: { name: redis-rendered, namespace: flux-system }
spec:
  interval: 10m
  sourceRef: { kind: OCIRepository, name: redis-rendered }
  path: "."
  prune: true
  wait: true</code></pre>
      <p><strong>Argo CD (3.x with OCI sources enabled)</strong></p>
      <pre><code>apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: redis-rendered, namespace: argocd }
spec:
  project: default
  source:
    repoURL: oci://REGISTRY/redis-rendered
    targetRevision: v1
    path: .
  destination: { server: https://kubernetes.default.svc, namespace: redis }
  syncPolicy:
    syncOptions: [CreateNamespace=true]</code></pre>
      <p>Pruning and CRD ordering differ per path. The <a href="./d/docs/user/gitops-adopter-guide.html">GitOps adopter guide</a> has the tested details; the <a href="./d/data/crd-ordering-gap/summary.html">CRD ordering record</a> shows the failure you avoid.</p>`;
}

function askHtml() {
  const questionEntries = Object.entries(CONFIGURATION_QUESTIONS)
    .sort(([codeA, itemA], [codeB, itemB]) => {
      const countDifference = CONFIGURATION_QUESTION_RESEARCH.counts[codeB] - CONFIGURATION_QUESTION_RESEARCH.counts[codeA];
      return countDifference || itemA.label.localeCompare(itemB.label);
    });
  const options = [
    ["common", "Common questions"],
    ["additional", "More questions"],
  ].map(([group, label]) => `<optgroup label="${label}">${questionEntries
    .filter(([, item]) => item.group === group)
    .map(([code, item]) => `<option value="${escapeHtml(code)}">${escapeHtml(item.label)}</option>`)
    .join("")}</optgroup>`).join("");
  const questionRows = questionEntries
    .map(([code, item]) => [
      CONFIGURATION_QUESTION_RESEARCH.counts[code],
      `<a href="#${escapeHtml(code)}">${escapeHtml(item.label)}</a>`,
      item.answer,
    ]);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Check my config &middot; Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Is my configuration right?</h1>
    <p id="question-context" hidden><strong id="question-context-text"></strong></p>
    <p class="lead">&ldquo;Here is the chart and values my AI produced. Compare them with the chart defaults, any matching Catalog record I provide, and what I run now. Tell me what matters, then give me a reviewed result I can keep.&rdquo;</p>
    <p>Use this page for your own chart, values, new version, or unexpected result. Use the <a href="./charts/index.html">Catalog</a> when we have already tested the exact chart and version.</p>
    <p><strong>In the website:</strong> compare rendered Kubernetes YAML in this browser, with no AI needed, or build local instructions for the AI assistant you already use. Render your chart with <code>helm template</code> first, then paste the objects. Download the exact objects, findings, file hashes, and checks that did not run.</p>
    <p><strong>On the command line:</strong> render or extract the same objects with <code>cub helm</code>, <code>cub installer</code>, or the source tool named by the example. Run <code>cub check</code> on those files for the shared local configuration checks. The page gives you copyable commands for keeping the same files and hashes in ConfigHub.</p>
    <p><strong>Checking private configuration?</strong> Keep the chart, values, and output on your machine. Do not upload private files; this page does not upload them for you. Keep secrets out of the form, AI prompt, and any public issue.</p>
    <p>Keep the result locally, publish the reviewed objects as OCI, or retain the same result in ConfigHub when a team needs history and promotion.</p>
    <p><strong>Already accepted a result?</strong> <a href="./promote.html">Compare the exact current result with the candidate for the next stage</a>. The promotion review shows what changed, what blocks the move, and which destination checks have not run.</p>
    <p>Doing this regularly? <a href="./ai.html">Install the Config Workshop agent skill</a> so your assistant follows the same version, evidence, lifecycle, and safety rules.</p>
    <p><button class="button primary" id="load-example" type="button">See an illustrative object review</button> <a class="button secondary" href="#build-prompt">Start with my chart and values</a> <a class="button secondary" href="#check-files">I have rendered YAML</a></p>
    <details>
      <summary><strong>Other common jobs</strong></summary>
      <p><a href="./testing.html#bring-your-own">Render and inspect without applying</a> · <a href="./promote.html">Compare development and production</a> · <a href="./d/docs/user/chart-hooks-what-happens.html">Handle hooks and CRD ordering</a> · <a href="./known-gaps.html">Read delivery limits</a></p>
    </details>
  </header>
  <main>
    <section aria-labelledby="check-scope">
      <h2 id="check-scope">What this page can answer</h2>
      ${markdownLikeTable([
        ["Question", "What happens here"],
        ["What do I have?", "The page inventories and compares the exact rendered objects you provide. A local assistant can also inspect the source, values, or package."],
        ["What will it produce?", "Helm, AICR, Timoni, or another source tool runs on your machine. The browser checks its output; it does not run the source processor."],
        ["Can this destination accept it?", "Not from browser files alone. Run a destination check with the exact candidate and current target facts."],
        ["Did it work?", "Not before deployment. Record controller, resource, runtime, drift, and rollback results after the exact revision is delivered."],
      ])}
      <p>Already comparing GPU nodes rather than a deployable configuration? <a href="./try-aicr.html">Use AICR snapshot and diff</a>. That read-only path needs cluster access but no recipe or bundle deployment.</p>
    </section>
    <section aria-labelledby="build-prompt">
      <h2 id="build-prompt">Start with a chart and values</h2>
      <p>Choose one question. This form does not upload a values file or render Helm in your browser. It builds instructions for the Claude, Codex, or other AI assistant already running on your machine. The assistant runs Helm locally, records the inputs, and compares the exact objects.</p>
      <div class="card">
        <p><label for="question-type"><strong>Choose a question</strong></label><br>
          <select id="question-type" style="width:100%;padding:10px;margin-top:6px">${options}</select></p>
        <p><label for="question"><strong>Add detail to the question</strong> <span style="color:var(--muted)">(optional)</span></label><br>
          <textarea id="question" rows="3" style="width:100%;padding:10px;margin-top:6px" placeholder="For example: Why did replicas stay at one after I set replicaCount to three?"></textarea></p>
        <div class="grid">
          <p><label for="chart"><strong>Chart</strong></label><br>
            <input id="chart" type="text" style="width:100%;padding:10px;margin-top:6px" placeholder="bitnami/redis"></p>
          <p><label for="version"><strong>Version or version pair</strong></label><br>
            <input id="version" type="text" style="width:100%;padding:10px;margin-top:6px" placeholder="25.5.3 or 25.5.3 -> 27.0.0"></p>
        </div>
        <p><a id="catalog-search-from-form" href="./charts/index.html">Search the Catalog for this chart and version</a>. Use a tested record when one exists; keep investigating locally when it does not.</p>
        <p><label for="values-summary"><strong>Values, flags, or symptoms</strong> <span style="color:var(--muted)">(optional, remove secrets)</span></label><br>
          <textarea id="values-summary" rows="5" style="width:100%;padding:10px;margin-top:6px" placeholder="Namespace, release name, values keys, error text, or the change you expected"></textarea></p>
        <details style="margin:18px 0">
          <summary><strong>Optional comparison: add what you run today</strong></summary>
          <p>Compare the candidate with an older version, an installed Helm release, local YAML, OCI, Git, or live Kubernetes output. Everything stays on your machine.</p>
          <p><label for="comparison-source"><strong>Existing configuration</strong></label><br>
            <select id="comparison-source" style="width:100%;padding:10px;margin-top:6px">
              <option value="none">No comparison; check the candidate by itself</option>
              <option value="chart-version">Another chart version</option>
              <option value="helm-release">Installed Helm release</option>
              <option value="local-files">Local YAML files</option>
              <option value="oci">OCI package</option>
              <option value="git">Git path or revision</option>
              <option value="live-cluster">Live Kubernetes objects</option>
            </select></p>
          <p><label for="comparison-reference"><strong>Where to find it</strong></label><br>
            <textarea id="comparison-reference" rows="3" style="width:100%;padding:10px;margin-top:6px" placeholder="For example: 25.5.3, ./current-yaml, oci://..., Git revision and path, or cluster context and namespace"></textarea></p>
          <div id="helm-release-context" hidden>
            <p>For an installed Helm release, add both fields below. The prompt will read Helm's status, values, manifest, hooks, history, and stored release record.</p>
            <div class="grid">
              <p><label for="release"><strong>Existing release name</strong></label><br>
                <input id="release" type="text" style="width:100%;padding:10px;margin-top:6px" placeholder="my-release"></p>
              <p><label for="namespace"><strong>Existing namespace</strong></label><br>
                <input id="namespace" type="text" style="width:100%;padding:10px;margin-top:6px" placeholder="my-namespace"></p>
            </div>
            <p><a href="./d/docs/user/existing-helm-release-diagnostic.html">Read the existing-release commands</a>.</p>
          </div>
        </details>
        <p><label for="source-visibility"><strong>Can the source be discussed publicly?</strong></label><br>
          <select id="source-visibility" style="width:100%;padding:10px;margin-top:6px">
            <option value="public">Yes, it is a public chart</option>
            <option value="private">No, keep this investigation private</option>
          </select></p>
        <button class="button primary" id="build-prompt-button" type="button">Build instructions for my AI</button>
      </div>
    </section>

    <section id="prompt-result" aria-labelledby="run-prompt" hidden>
      <h2 id="run-prompt">Run the investigation on your machine</h2>
      <p>Paste this into the assistant you already use. It runs Helm and ordinary shell tools locally, writes the candidate and comparison objects to files, and returns a short <code>WORKSHOP FINDING</code>. This site does not receive the prompt or answer.</p>
      <textarea id="prompt-output" rows="28" readonly style="width:100%;padding:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.45"></textarea>
      <p><button class="button primary" id="copy-prompt" type="button">Copy prompt</button> <span id="copy-status" role="status" style="color:var(--muted)"></span></p>
      <p>When the assistant finishes, return with <code>candidate.yaml</code>, the optional comparison file, and its final <code>WORKSHOP FINDING</code> block.</p>
      <p><a class="button secondary" href="#check-files">I am back with the rendered files</a></p>
    </section>

    <section id="check-command" aria-labelledby="check-command-title">
      <h2 id="check-command-title">Run the shared checks on your machine</h2>
      <p>Use this after Helm, AICR, OCI, or another source tool has written Kubernetes YAML. The command checks the exact files on your machine. It does not upload them, contact ConfigHub, or apply them to a cluster.</p>
      <pre><code>${CHECK_PLUGIN_INSTALL_COMMAND}
${CHECK_RENDERED_FILES_COMMAND}</code></pre>
      <p><code>cub-check.json</code> records stable finding IDs and the pinned pattern bundle used for the check. Keep it beside the rendered files and their digest. The result is advisory: cluster admission, hooks, CRDs, workload health, upgrade behavior, and rollback still need their own checks.</p>
      <p><a href="./d/data/config-workshop-command-contract/summary.html">See the same three jobs through the website and released <code>cub</code> commands</a>. The Helm and plain-YAML examples use the same <code>WorkshopResult</code> record and carry one canonical object-set hash into the ConfigHub upload.</p>
    </section>

    <section aria-labelledby="completed-decision">
      <h2 id="completed-decision">See what a completed review looks like</h2>
      <p>In the worked NGINX case, the proposed values produced six local findings and an unwanted public LoadBalancer. The reviewed result fixes six problems and keeps one emptyDir finding visible under a narrow, dated exception for development and staging only.</p>
      <p>The same record then follows the accepted objects into ConfigHub, through a development-to-staging promotion, and into two Argo CD test deployments. Each step says what it proves and what it does not prove.</p>
      <p><a class="button secondary" href="./d/data/config-review-decision-chain/summary.html">Open the completed review</a></p>
      <p>For a lifecycle-heavy upgrade, read the <a href="./d/data/kps-confighub-lifecycle-promotion/summary.html">Kube Prometheus Stack 85.3.3 to 86.1.0 destination result</a>. It checks namespaces, CRDs, server-side apply, prerequisites, approval, release OCI, and Argo CD separately.</p>
    </section>

    <section id="check-files" aria-labelledby="check-files-title">
      <h2 id="check-files-title">Or: Check rendered objects in this browser</h2>
      <p>Add the exact rendered candidate. Add a second object set when you want to compare it with defaults, an older version, production, OCI, Git, or exported live objects.</p>
      <p>Helm, AICR, and Timoni must produce their Kubernetes objects locally first. This browser checks those objects; it does not run the source tool.</p>
      <p>The browser records object identities and hashes, reports added, removed, and changed objects, and checks a short list of common manifest risks. This is a first check, not a Helm render, Kubernetes schema check, admission test, hook run, or live health test.</p>
      <p><strong>The checks on this page run in your browser.</strong> This page does not send your files to an AI service. You may use your own Claude, Codex, or other AI assistant to investigate findings or propose fixes. Check its proposed commands, objects, and evidence before accepting them.</p>
      <p><strong>Do not add credentials or Secret values.</strong> Keep private source names and paths local. The optional public Catalog proposal is only for material you are allowed to publish.</p>
      <div class="card">
        <div class="grid">
          <p><label for="source-type"><strong>Starting format</strong></label><br>
            <select id="source-type" style="width:100%;padding:10px;margin-top:6px">
              <option value="helm">Helm chart and values</option>
              <option value="aicr">AICR generated configuration</option>
              <option value="timoni">Timoni module or bundle</option>
              <option value="oci">OCI package</option>
              <option value="kubernetes-yaml">Kubernetes YAML</option>
              <option value="existing-release">Existing release or deployment</option>
              <option value="mixed">More than one source</option>
              <option value="unknown">Unknown</option>
            </select></p>
          <p><label for="source-reference"><strong>Source reference</strong></label><br>
            <input id="source-reference" type="text" style="width:100%;padding:10px;margin-top:6px" placeholder="Chart, Git revision, OCI digest, or local path"></p>
        </div>
        <h3>Candidate objects</h3>
        <p><input id="candidate-file" type="file" accept=".yaml,.yml,text/yaml,application/yaml"> <input id="candidate-name" type="text" value="candidate.yaml" aria-label="Candidate file name" style="padding:8px"></p>
        <textarea id="candidate-yaml" rows="14" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="Paste rendered Kubernetes YAML, or choose a local file above."></textarea>
        <h3>Comparison objects <span style="color:var(--muted);font-weight:400">(optional)</span></h3>
        <p><input id="comparison-file" type="file" accept=".yaml,.yml,text/yaml,application/yaml"> <input id="comparison-name" type="text" value="comparison.yaml" aria-label="Comparison file name" style="padding:8px"></p>
        <textarea id="comparison-yaml" rows="10" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="Paste chart defaults, a prior version, production, or another exact object set."></textarea>
        <details style="margin:18px 0">
          <summary><strong>Add a Catalog source and intent record</strong></summary>
          <p>If the candidate starts from a Catalog configuration, add its <code>BaseVariantRecord</code>. It connects the source, rendered objects, OCI package, prerequisites, lifecycle routes, policy, and evidence status.</p>
          <p><input id="check-source-record-file" type="file" accept=".json,.yaml,.yml,application/json,text/yaml"></p>
          <textarea id="check-source-record" rows="8" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="Paste a Catalog BaseVariantRecord as JSON or YAML."></textarea>
        </details>
        <details style="margin:18px 0">
          <summary><strong>Add the result from <code>cub check</code></strong> <span style="color:var(--muted);font-weight:400">(optional)</span></summary>
          <p>Run the shared checks on the same candidate files, then add <code>cub-check.json</code>. The page accepts it only when its object count and object-set hash match these exact objects. The result remains local advisory evidence; ConfigHub validation is a separate managed check.</p>
          <p><input id="cub-check-file" type="file" accept=".json,application/json"></p>
          <textarea id="cub-check-result" rows="8" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="Paste cub-check.json here."></textarea>
          <p id="cub-check-status" role="status" style="color:var(--muted)">You can add a local check result for this candidate.</p>
        </details>
        <p><label for="assistant-finding"><strong>Assistant's WORKSHOP FINDING</strong> <span style="color:var(--muted)">(optional)</span></label><br>
          <textarea id="assistant-finding" rows="10" style="width:100%;padding:10px;margin-top:6px" placeholder="Paste the final WORKSHOP FINDING block here."></textarea></p>
        <button class="button primary" id="run-browser-check" type="button">Check these objects</button>
      </div>
    </section>

    <section id="review-result" aria-labelledby="review-result-title" hidden>
      <h2 id="review-result-title">Keep or share the reviewed result</h2>
      <div id="browser-check-summary" class="card"></div>
      <h3>Hooks, CRDs, and required setup</h3>
      <ul id="check-lifecycle-work"></ul>
      <p>This browser check does not search the Catalog automatically. Find a matching chart record, then add its source and intent record above when you want the result to include known prerequisites and lifecycle work.</p>
      <p><a class="button secondary" id="catalog-lookup" href="./charts/index.html">Find matching Catalog records</a></p>
      <h3>Download one complete result</h3>
      <p><code>workshop-result.json</code> contains the exact candidate YAML, optional comparison and Catalog record, the browser review, any matching <code>cub check</code> result, and every file hash. Keep it locally or give it to the AI and CI tools you already use.</p>
      <p><strong>Only completed checks count as evidence. Everything else is not checked and cannot support a safety claim.</strong></p>
      <p><strong>Complete result hash:</strong> <code id="workshop-result-digest" style="overflow-wrap:anywhere;word-break:break-all"></code></p>
      <p><button class="button primary" id="download-workshop-result" type="button">Download complete result</button></p>
      <p><a href="./d/docs/user/ci-render-check.html">Create a pull-request report from this result</a>. The same local command works for Helm, OCI, AICR, Timoni, and literal YAML after each source has produced exact Kubernetes objects.</p>
      <p><a class="button primary" href="./confighub.html">See how to keep this in ConfigHub</a> <a class="button secondary" href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "ask-reviewed-result")}">Open the ConfigHub tutorial</a> <a class="button secondary" href="./known-gaps.html">See what this check does not prove</a></p>
      <details>
        <summary><strong>Open the complete result</strong></summary>
        <textarea id="workshop-result-output" rows="18" readonly style="width:100%;padding:10px;margin-top:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea>
      </details>
      <p><a href="./workshop-result.schema.json">Read the WorkshopResult schema</a>.</p>
      <h4>Download individual files</h4>
      <p>The separate review record links the question, source identity, object hashes, comparison, findings, and checks that did not run. Keep it beside the reviewed YAML.</p>
      <textarea id="review-record-output" rows="18" readonly style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea>
      <p><button class="button primary" id="download-review" type="button">Download review record</button> <button class="button secondary" id="download-candidate" type="button">Download candidate YAML</button></p>
      <p><button class="button secondary" id="continue-to-promotion" type="button">Test this result for promotion</button></p>
      <p>A saved object set can restore the configuration that was delivered. It cannot undo database migrations, cloud resources, or other external effects. Live comparison is a separate check after delivery. <a href="./redis-walkthrough.html">Read the upgrade and rollback walkthrough</a> before claiming that a rollback will restore the exact release.</p>
      <p><a href="./review.schema.json">Read the ConfigurationReview schema</a>.</p>

      <h3>Keep this reviewed result in ConfigHub</h3>
      <p>ConfigHub stores the exact Kubernetes objects you approved. It keeps the review record and any matching local check result beside them without adding those evidence files to a deployment release. Local findings remain advisory; ConfigHub records its own validation against the stored revision.</p>
      <p><strong>Candidate file hash:</strong> <code id="handoff-candidate-digest"></code><br><strong>Accepted object-set hash:</strong> <code id="handoff-object-set-digest"></code></p>
      <p>The file hash identifies the exact bytes you reviewed. The object-set hash identifies the Kubernetes objects across file names and document order. The upload records both identities and the review hash on the saved configuration.</p>
      <p>If the candidate contains a Kubernetes Secret, stage that Secret separately. <code>cub variant upload</code> deliberately does not upload rendered Secret data.</p>
      <p><label for="component-slug"><strong>Component name</strong></label><br>
        <input id="component-slug" type="text" style="width:100%;max-width:520px;padding:10px;margin-top:6px" placeholder="my-service"></p>
      <textarea id="handoff-command" rows="14" readonly style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea>
      <p><button class="button primary" id="copy-handoff" type="button">Copy commands to keep this result</button> <span id="handoff-copy-status" role="status" style="color:var(--muted)"></span></p>

      <h4>Use your own AI assistant</h4>
      <p>If Claude, Codex, or another assistant is already running on your machine, download the candidate and review record above. Then copy these instructions into that assistant. It will inspect the same files, ask before writing to ConfigHub, run the generated commands, and read the stored objects back.</p>
      <textarea id="ai-handoff-prompt" rows="18" readonly style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea>
      <p><button class="button secondary" id="copy-ai-handoff" type="button">Copy handoff for my AI</button> <span id="ai-handoff-copy-status" role="status" style="color:var(--muted)"></span></p>
      <p><a href="./confighub.html">See how ConfigHub keeps this result</a>.</p>

      <h3>Optional: propose a public Catalog case</h3>
      <p>Use this only for a public source when the Catalog is missing the case or its answer is wrong. GitHub opens with a short chart, version, and question link. Paste the copied finding or review record, remove private data, and include reproduction commands.</p>
      <button class="button secondary" id="file-public-question" type="button">Propose this public case</button>
      <p id="public-handoff-status" role="status" style="color:var(--muted)"></p>
      <p>A maintainer must reproduce and classify the case before it becomes a Catalog entry. Rendering alone does not make it known-good.</p>
      <p><a href="./d/data/challenge-intake/summary.html">See the public intake totals and response process</a>.</p>
    </section>

    <section aria-labelledby="questions-we-answer">
      <h2 id="questions-we-answer">Questions people are asking</h2>
      <p>We reviewed 40 recent public Helm discussions before starting outreach. The counts describe that small research sample; they are not customer or site usage totals.</p>
      <p>Choose the question closest to the decision you need to make. Each link selects it in the form above.</p>
      ${markdownLikeTable([
        ["Recent discussions", "Question", "What the answer should contain"],
        ...questionRows,
      ], { rawSecondColumn: true, firstColumnWidthCh: 10 })}
    </section>

    <section aria-labelledby="public-question-decisions">
      <h2 id="public-question-decisions">What happens to a public question</h2>
      <p>Submit only a public chart after you have a useful local result. We aim to acknowledge a complete report within two business days.</p>
      <p>Within seven days, we aim to post one clear outcome. It may be a Catalog entry, a named warning, a refusal, or a request for more evidence.</p>
      <p><a href="./d/data/challenge-intake/summary.html">See current question totals and outcomes</a> · <a href="./d/docs/reference/question-intake-operation.html">Read the response process</a></p>
    </section>

    <section aria-labelledby="next-jobs">
      <h2 id="next-jobs">What happens next</h2>
      ${markdownLikeTable([
        ["Result", "Next step"],
        ["The Catalog already covers the case", "Use its retained package, useful configuration, setup instructions, and evidence."],
        ["The review finds a values problem", "Correct the value and render again. Keep the new object hash with the review."],
        ["The review finds a credential surprise", "Do not deploy it. Replace the literal or placeholder with an existing Secret, then check the reviewed objects again. <a href=\"./d/data/apply-policy-functional-proof/summary.html\">See one NGINX configuration go from local finding to ConfigHub gate to promotion</a>, <a href=\"./charts/index.html\">find configurations that use existing Secrets</a>, or <a href=\"./known-gaps.html\">read the credential limitation</a>."],
        ["The render is surprising", "Do not deploy it yet. Compare it with the defaults and the configuration you run now, correct the cause, then render and check it again."],
        ["The chart does not expose the required field", "Keep the chart when possible and record the smallest object change as a ConfigHub variant."],
        ["The configuration needs hooks, CRDs, Secrets, or setup work", "Choose an explicit owner and order. Use only a delivery route whose evidence covers that work."],
        ["The result should remain portable", "Keep the YAML and review record locally, or <a href=\"./how-it-works.html#now-deploy\">publish the reviewed files as OCI</a>."],
        ["A team needs history, promotion, or rollout", "<a href=\"./confighub.html\">Save the reviewed result in ConfigHub</a>, then create variants, approve changes, publish releases, and compare desired with live state."],
      ], { rawSecondColumn: true })}
      <p><strong>Additional references:</strong> <a href="./challenge.html">Helm investigation details</a> · <a href="./d/docs/user/chart-hooks-what-happens.html">hooks and CRD setup</a> · <a href="./known-gaps.html">delivery limitations</a> · <a href="./verification.html">checks and publication receipts</a> · <a href="./testing.html#platforms">promotion and fleet examples</a></p>
    </section>
  </main>
  <footer>This page runs in your browser. It has no telemetry and sends nothing until you choose a public GitHub issue.</footer>
  <script id="configuration-question-data" type="application/json">${JSON.stringify(CONFIGURATION_QUESTIONS)}</script>
  <script id="configuration-check-settings" type="application/json">${JSON.stringify({ issueUrl: PROBLEM_CHART_ISSUE_URL, maxIssueUrlLength: 1800 })}</script>
  <script src="./js-yaml-4.1.0.min.js"></script>
  <script src="./config-workshop-yaml.js"></script>
  <script src="./check-config.js"></script>
</body>
</html>
`;
}

function redisRenderWithReplicaOverride(path) {
  const source = readFileSync(path, "utf8");
  const marker = "# Source: redis/templates/replicas/application.yaml";
  const start = source.indexOf(marker);
  check(start >= 0, `${path} is missing the Redis replica StatefulSet`);
  const end = source.indexOf("\n---", start);
  const sectionEnd = end >= 0 ? end : source.length;
  const section = source.slice(start, sectionEnd);
  check(/^  replicas: 3\s*$/m.test(section), `${path} does not have the expected three-replica catalog render`);
  const changed = section.replace(/^  replicas: 3\s*$/m, "  replicas: 2");
  check(changed !== section, `${path} replica override did not apply`);
  return `${source.slice(0, start)}${changed}${source.slice(sectionEnd)}`;
}

function promoteHtml() {
  const measuredPromotion = readYaml(join(repoRoot, "runs", "measured-promotion-proof", "receipt.yaml"));
  const measuredRows = measuredPromotion.spec.tests.map((candidate) => `<tr><td><code>${escapeHtml(candidate.id)}</code></td><td>${candidate.successfulRequests}/${candidate.requests}</td><td>${candidate.readyReplicas}</td><td>${candidate.checks.destinationCapacity ? "Pass" : "Blocked"}</td><td>${candidate.id === measuredPromotion.spec.decision.selected ? "Selected" : candidate.result === "pass" ? "Passed, not selected" : "Not promoted"}</td></tr>`).join("");
  const changeWorkflowEvidence = readYaml(changeWorkflowEvidencePath);
  const changeWorkflowRows = (changeWorkflowEvidence.spec?.rows ?? []).map((row) => {
    const links = (row.evidence ?? [])
      .map((item) => `<a href="./d/${escapeHtml(item.path.replace(/\.md$/, ".html"))}">${escapeHtml(item.label)}</a>`)
      .join(" · ");
    return [
      `<strong>${escapeHtml(row.need)}</strong>`,
      `<strong>${escapeHtml(row.status)}</strong>`,
      `${escapeHtml(row.result)}<br>${links}<br><span style="color:var(--muted)">${escapeHtml(row.limit)}</span>`,
    ];
  });
  check(changeWorkflowRows.length === 8, "change workflow evidence must contain eight requirements");
  const exampleData = JSON.stringify({
    currentSourceYaml: readFileSync(REDIS_25_REUSE_RENDER_PATH, "utf8"),
    currentYaml: redisRenderWithReplicaOverride(REDIS_25_REUSE_RENDER_PATH),
    candidateSourceYaml: readFileSync(REDIS_27_REUSE_RENDER_PATH, "utf8"),
    candidateYaml: redisRenderWithReplicaOverride(REDIS_27_REUSE_RENDER_PATH),
    sourceRecord: readYaml(join(repoRoot, "data/base-variant-records/records/bitnami-redis-27-0-0-reuse-existing-secret.yaml")),
  }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Promote my config &middot; Config Workshop</title>
  <style>${siteCss()}</style>
  <script defer src="./js-yaml-4.1.0.min.js"></script>
  <script defer src="./config-workshop-yaml.js"></script>
  <script defer src="./promote-config.js"></script>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Can I promote this configuration?</h1>
    <p id="promotion-context" hidden><strong id="promotion-context-text"></strong></p>
    <p class="lead">Compare what you run now with the exact configuration you want to move. See what the next environment would receive, what still needs testing, and whether any target has a current result.</p>
    <p>Comparing here is free and previews the move. Promoting the reviewed change for real is the account step, run with <code>cub variant promote</code>.</p>
    <p>The same process applies to a platform component, a developer tool, or an application. Each can move independently while ConfigHub checks what the destination already uses.</p>
    <p>An upgrade fails when it changes an immutable StatefulSet field, removes an object, or needs setup that has yet to run. Compare the Kubernetes objects before production receives them.</p>
    <p><strong>In the website:</strong> compare the current and proposed object sets. Add staging results and download a review bound to both file hashes.</p>
    <p><strong>On the command line:</strong> create those object sets with Helm, AICR, OCI, or another source tool. Then use the generated <code>cub variant</code> commands to preview and run the managed promotion.</p>
    <p><a href="./d/data/config-workshop-command-contract/summary.html">See the website and command-line contract</a> for one Helm result and one plain-YAML result. Both keep the accepted object-set hash before the ConfigHub dry run.</p>
    <p>Once you accept a change, <a href="./deploy-with-flux-or-argo.html">reconcile the exact release onto the Flux or Argo you already run</a>.</p>
    <p id="promotion-intro-detail">The comparison runs in your browser. Your files are not uploaded, and you do not need an account. <b>Limits.</b> This compares object sets. Helm stays unrun, no cluster is contacted, and nothing is tested or promoted. A finished Redis review loads automatically so you can see the result before adding your own files.</p>
    <p><button class="button primary" id="use-own-yaml" type="button">Compare my rendered YAML</button> <button class="button secondary" id="load-redis-promotion" type="button">Reload the Redis example</button></p>
  </header>
  <main>
    <section aria-labelledby="promotion-scope">
      <h2 id="promotion-scope">What a promotion review answers</h2>
      ${markdownLikeTable([
        ["Question", "Promotion answer"],
        ["What do I have?", "The exact current and proposed object sets, their identities, and their differences."],
        ["What will it produce?", "Materialize both sources before using this page. The browser compares the output; it does not run Helm, AICR, Timoni, or another processor."],
        ["Can this destination accept it?", "Add current destination checks for the same proposed digest. Without them, the answer remains not run."],
        ["Did it work?", "Add staging or live results only after the exact revision has been deployed. One passing target does not cover another target."],
      ])}
    </section>
    <section id="promotion-result" aria-labelledby="promotion-result-title" hidden>
      <h2 id="promotion-result-title">1. Promotion review</h2>
      <p class="stat-strip"><strong id="promotion-status"></strong> &middot; <span id="promotion-counts"></span></p>
      <div style="max-width:100%;overflow-x:auto"><table style="min-width:640px">
        <tbody>
          <tr><th>Exact configuration</th><td id="promotion-exact-answer"></td></tr>
          <tr><th>Next stage</th><td id="promotion-stage-answer"></td></tr>
          <tr><th>What blocks it</th><td id="promotion-blocker-answer"></td></tr>
          <tr><th>Current result</th><td id="promotion-current-answer"></td></tr>
        </tbody>
      </table></div>
      <p id="example-note" hidden><strong>Redis example:</strong> both inputs use the catalog's <code>reuse-existing-secret</code> configuration. The default configuration is not used because it can generate or reuse a password during rendering. Both inputs also contain the recorded change from three replicas to two. This comparison contains the chart's 13 Kubernetes objects; <code>cub installer</code> adds the explicit Namespace as the fourteenth deployable object.</p>
      <h3>What changes</h3>
      <ul id="what-changes"></ul>
      <h3>What stays the same</h3>
      <ul id="what-stays"></ul>
      <h3>Before this reaches the destination</h3>
      <ul id="destination-preflight"></ul>
      <div id="source-aware-result" hidden>
        <h3>Where the changes came from</h3>
        <p id="source-aware-summary"></p>
        <details>
          <summary><strong>Show the most relevant field changes</strong></summary>
          <div style="max-width:100%;overflow-x:auto"><table style="min-width:640px">
            <thead><tr><th>Source</th><th>Object and field</th><th>Result</th></tr></thead>
            <tbody id="source-aware-rows"></tbody>
          </table></div>
          <p id="source-aware-note" style="color:var(--muted)"></p>
        </details>
        <p><a href="./d/docs/reference/promotion-diff-classes.html">How to read inherited, overridden, upstream-added, and no-op changes</a>.</p>
      </div>
      <h3>Hooks, CRDs, and required setup</h3>
      <ul id="lifecycle-work"></ul>
      <h3>What you should test</h3>
      <ul id="tests-required"></ul>
      <h3>Target results</h3>
      <p id="target-summary"></p>
      <div style="max-width:100%;overflow-x:auto"><table style="min-width:640px">
        <thead><tr><th>Target</th><th>Result</th><th>Digest</th><th>Note</th></tr></thead>
        <tbody id="target-result-rows"></tbody>
      </table></div>
      <h3>What to do next</h3>
      <ul id="next-actions"></ul>
      <p><strong>Current file:</strong> <code id="current-digest" style="overflow-wrap:anywhere;word-break:break-all"></code><br><strong>Proposed file:</strong> <code id="candidate-digest" style="overflow-wrap:anywhere;word-break:break-all"></code></p>
      <p>These hashes identify the files compared in this browser. Use the proposed hash in staging and production so a later render cannot quietly replace the reviewed result.</p>
      <p><button class="button primary" id="download-promotion-review" type="button">Download the review</button> <button class="button secondary" id="download-promotion-current" type="button">Download current YAML</button> <button class="button secondary" id="download-promotion-candidate" type="button">Download proposed YAML</button></p>
      <details>
        <summary><strong>Open the review record</strong></summary>
        <textarea id="promotion-review-output" rows="18" readonly style="width:100%;padding:10px;margin-top:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea>
      </details>
      <p><a href="./promotion-review.schema.json">Read the PromotionReview schema</a>.</p>

      <h3>Use your own AI assistant</h3>
      <p>Download both YAML files and the review record. Then give this prompt to Claude, Codex, or the assistant you already use. It asks the assistant to work locally, explain the object changes, and keep untested claims visible.</p>
      <p><a href="./ai.html">Install the Config Workshop agent skill</a> when you want these checks and reporting rules available for repeated reviews.</p>
      <textarea id="ai-promotion-prompt" rows="16" readonly style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea>
      <p><button class="button secondary" id="copy-ai-promotion" type="button">Copy the AI review prompt</button> <span id="ai-promotion-copy-status" role="status" style="color:var(--muted)"></span></p>

      <h3>Keep and run the promotion in ConfigHub</h3>
      <p>The browser review stops before deployment. Preview commands do not change ConfigHub. The write commands are separate so you can run them only after the preview, destination checks, and approval pass.</p>
      <div class="grid">
        <p><label for="confighub-component"><strong>Component</strong></label><br><input id="confighub-component" type="text" value="redis" style="width:100%;padding:10px;margin-top:6px"></p>
        <p><label for="confighub-base-space"><strong>Base Space</strong></label><br><input id="confighub-base-space" type="text" value="redis-base" style="width:100%;padding:10px;margin-top:6px"></p>
      </div>
      <div class="grid">
        <p><label for="confighub-granularity"><strong>Unit layout</strong></label><br><select id="confighub-granularity" style="width:100%;padding:10px;margin-top:6px"><option value="minimal">minimal</option><option value="per-resource">per-resource</option><option value="per-file">per-file</option></select></p>
        <p><label for="confighub-namespace"><strong>Recorded namespace</strong> <span style="color:var(--muted);font-weight:400">(optional)</span></label><br><input id="confighub-namespace" type="text" value="" placeholder="Repeat the namespace used for the first upload" style="width:100%;padding:10px;margin-top:6px"></p>
      </div>
      <p><label for="confighub-destination-spaces"><strong>Downstream Spaces</strong></label><br><input id="confighub-destination-spaces" type="text" value="redis-staging" style="width:100%;padding:10px;margin-top:6px"></p>
      <p class="small">If a downstream Space does not exist, the preview shows its one-time creation command as a comment. Create it, then run the preview again before using the write commands.</p>
      <h4>Preview</h4>
      <textarea id="confighub-promotion-preview" rows="10" readonly style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea>
      <p><button class="button primary" id="copy-confighub-preview" type="button">Copy preview commands</button> <span id="confighub-preview-copy-status" role="status" style="color:var(--muted)"></span></p>
      <h4>Run after approval</h4>
      <textarea id="confighub-promotion-run" rows="16" readonly style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></textarea>
      <p><button class="button secondary" id="copy-confighub-run" type="button">Copy write commands</button> <span id="confighub-run-copy-status" role="status" style="color:var(--muted)"></span> <a class="button secondary" href="./redis-walkthrough.html">See the complete Redis run</a></p>
      <p><a href="./d/data/redis-upgrade-app-proof/summary.html">Open the Redis promotion, two-cluster rollout, and rollback evidence</a> · <a href="./charts/bitnami-redis-25-5-3.html">Redis 25.5.3</a> · <a href="./charts/bitnami-redis-27-0-0.html">Redis 27.0.0</a></p>

      <h3>Test candidates, then promote the one that passed</h3>
      <p>A configuration can answer a smoke test and still be wrong for its destination. This recorded NGINX run tested three exact object sets. The destination required two ready replicas, so the one-replica candidate was not promoted. Two and three replicas passed; the stated rule selected the smaller one.</p>
      <div style="max-width:100%;overflow-x:auto"><table style="min-width:640px">
        <thead><tr><th>Candidate</th><th>HTTP</th><th>Ready replicas</th><th>Destination</th><th>Decision</th></tr></thead>
        <tbody>${measuredRows}</tbody>
      </table></div>
      <p>The selected object hash stayed the same in the ConfigHub base, staging, and production. Argo CD then used the ConfigHub release digest and Kubernetes reported two ready replicas.</p>
      <p><a href="./d/docs/user/test-candidates-before-promotion.html"><strong>Read the worked example</strong></a> · <a href="./d/data/measured-promotion-proof/summary.html">Check the recorded result</a></p>

      <h3>A difficult upgrade: Kube Prometheus Stack</h3>
      <p><strong>Question:</strong> can the <code>no-crds</code> configuration move from 85.3.3 to 86.1.0 without breaking CRD ordering, webhook setup, or namespaces?</p>
      <p>The checked candidate keeps 130 Kubernetes objects. The upgrade changes 111 of them. ConfigHub retains the current objects as a base and the candidate as a staging variant. Approval is required. ConfigHub publishes an exact release OCI for each version.</p>
      <div style="max-width:100%;overflow-x:auto"><table style="min-width:640px">
        <thead><tr><th>Destination check</th><th>Recorded result</th></tr></thead>
        <tbody>
          <tr><td>Namespaces</td><td>Pass: five Services remain in <code>kube-system</code>; monitoring objects remain in <code>monitoring</code>.</td></tr>
          <tr><td>Prerequisites</td><td>Pass: two target-owned Secrets and ten established CRDs.</td></tr>
          <tr><td>Setup work</td><td>Pass: both completed setup Jobs were replaced and the webhook certificate handoff was checked.</td></tr>
          <tr><td>Delivery</td><td>Pass: Argo CD reconciled both exact ConfigHub release digests using server-side apply for the large CRDs.</td></tr>
          <tr><td>Runtime</td><td>Pass: six workloads, the operator endpoint, and Kubernetes admission checks.</td></tr>
        </tbody>
      </table></div>
      <p>This proves one chart, one version pair, one Argo CD path and one test target. <b>Limits.</b> Rollback, a long soak, automatic route selection and any untested cluster all remain unproven.</p>
      <p><a href="./d/data/kps-confighub-lifecycle-promotion/summary.html"><strong>Read the result</strong></a> · <a href="${GITHUB_BLOB_BASE_URL}examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/promotion-review.yaml">Open the promotion review</a> · <a href="${GITHUB_BLOB_BASE_URL}examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/lifecycle-route.yaml">Open the destination route</a> · <a href="./charts/prometheus-community-kube-prometheus-stack-85-3-3.html">85.3.3 chart page</a> · <a href="./charts/prometheus-community-kube-prometheus-stack-86-1-0.html">86.1.0 chart page</a></p>

      <h3 id="rollback-release">Roll back the selected release</h3>
      <p>Keep the previous approved object set and release digest. Rehearse the reverse comparison in staging, then publish that recorded object set again if the rollback is approved. The Redis proof restores one bounded desired-object release on two test clusters. <b>Limits.</b> Database migrations, cloud resources and other external effects stay where they are.</p>
      <p><a href="./d/data/redis-upgrade-app-proof/summary.html">Check the bounded Redis rollback result</a> · <a href="./redis-walkthrough.html">Follow the walkthrough</a></p>
    </section>

    <section id="promotion-inputs" aria-labelledby="promotion-inputs-title">
      <h2 id="promotion-inputs-title">2. What are you changing?</h2>
      <p>Choose the job, then add the current and proposed Kubernetes YAML. Use two Catalog configurations, two Helm or AICR outputs, two configuration OCI packages, or exported YAML from the current and proposed environments. Materialize each source first so you compare the objects that will actually be delivered.</p>
      <div class="card">
        <div class="grid">
          <p><label for="change-type"><strong>Change</strong></label><br>
            <select id="change-type" style="width:100%;padding:10px;margin-top:6px">
              <option value="upgrade">Upgrade a chart or package</option>
              <option value="settings">Change some settings</option>
              <option value="environment">Move a tested configuration</option>
            </select></p>
          <p><label for="destination"><strong>Where is it going?</strong></label><br>
            <textarea id="destination" rows="3" style="width:100%;padding:10px;margin-top:6px" placeholder="One or more environment, cluster, or target names"></textarea></p>
        </div>
        <h3>Current configuration</h3>
        <p class="small">For example: the rendered objects that development or production uses now.</p>
        <p><input id="current-file" type="file" accept=".yaml,.yml,text/yaml,application/yaml"> <input id="current-label" type="text" value="current.yaml" aria-label="Current configuration name" style="padding:8px"></p>
        <textarea id="current-yaml" rows="10" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="Paste or choose the Kubernetes YAML you use now."></textarea>
        <h3>Proposed configuration</h3>
        <p class="small">For example: the rendered objects from the new chart version or settings you want to move next.</p>
        <p><input id="candidate-file" type="file" accept=".yaml,.yml,text/yaml,application/yaml"> <input id="candidate-label" type="text" value="candidate.yaml" aria-label="Proposed configuration name" style="padding:8px"></p>
        <textarea id="candidate-yaml" rows="10" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="Paste or choose the Kubernetes YAML you want to move."></textarea>
        <details style="margin:18px 0">
          <summary><strong>Explain which changes came from the source and which are later edits</strong></summary>
          <p>Add the render before later edits for each side. For Helm, these are the old and new chart renders. The browser can then separate chart or values changes from ConfigHub or environment changes.</p>
          <h4>Current source render</h4>
          <p><input id="current-source-file" type="file" accept=".yaml,.yml,text/yaml,application/yaml"></p>
          <textarea id="current-source-yaml" rows="8" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="The old chart or package render, before later edits."></textarea>
          <h4>Proposed source render</h4>
          <p><input id="candidate-source-file" type="file" accept=".yaml,.yml,text/yaml,application/yaml"></p>
          <textarea id="candidate-source-yaml" rows="8" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="The new chart or package render, before later edits."></textarea>
          <h4>Catalog source and intent record</h4>
          <p>Add a <code>BaseVariantRecord</code> when this configuration comes from the Catalog. It carries the exact source, rendered objects, OCI reference, prerequisites, routes, policy, and evidence status.</p>
          <p><input id="source-record-file" type="file" accept=".json,.yaml,.yml,application/json,text/yaml"></p>
          <textarea id="source-record" rows="8" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="Paste a Catalog BaseVariantRecord as JSON or YAML."></textarea>
        </details>
        <details style="margin:18px 0">
          <summary><strong>Add staging or fleet results</strong></summary>
          <p>Use one line per target: <code>name | pass, watch, blocked, or not-run | note | candidate digest</code>. A partial fleet stays partial, because one passing target says nothing about the rest.</p>
          <textarea id="target-results" rows="6" style="width:100%;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace" placeholder="staging-eu | pass | rollout healthy | sha256:...&#10;prod-us | not-run | waiting for approval |"></textarea>
        </details>
        <button class="button primary" id="compare-promotion" type="button">Build a promotion review</button>
      </div>
    </section>

    <section aria-labelledby="promotion-boundary">
      <h2 id="promotion-boundary">3. What this page can decide</h2>
      <p>This page compares exact object sets and records their hashes. If you add both source renders, it separates source changes from later edits. If you add a Catalog record, it carries the known hooks, CRDs, prerequisites, and evidence into the review.</p>
      <p><b>Limits.</b> It compares objects and stops there. Helm stays unrun, Kubernetes is never contacted, and hooks, CRDs, application tests and rollback all remain outside it. Target results count only when you add the result for the same proposed digest. ConfigHub is where the accepted configuration, downstream variants, approvals, release OCI, and live results can remain connected.</p>
      <h3>For a fleet rollout</h3>
      <p>The intended sequence is: choose targets by label, preview the exact target list, publish to a small wave, inspect every result, then continue or stop. The browser records target results, while selecting clusters and pausing or resuming a live wave stay outside it. Use the <a href="./d/docs/demo/sveltos/kyverno-fleet.html">Sveltos fleet example</a> for the current two-wave proof; managed pause and resume controls remain planned.</p>
      <p><a href="./d/docs/user/chart-hooks-what-happens.html">Check hooks, CRDs, and setup order</a> · <a href="./verification.html">Check current evidence</a> · <a href="./docs.html#promotion">Promotion instructions</a> · <a href="./known-gaps.html">Known gaps</a></p>
    </section>

    <section aria-labelledby="change-workflow-evidence">
      <h2 id="change-workflow-evidence">4. What has run</h2>
      <p>These results show what the current examples prove. A partial result means that some parts have run, but the complete workflow has not.</p>
      ${markdownLikeTable([
        ["Need", "Status", "Result and limit"],
        ...changeWorkflowRows,
      ], { rawFirstColumn: true, rawSecondColumn: true, rawThirdColumn: true, firstColumnWidthCh: 22 })}
      <p><a href="./confighub.html"><strong>Upload a reviewed result into ConfigHub</strong></a> when you need ordered stages, approvals, release OCI, promotion history, and current observations to remain connected.</p>
    </section>
  </main>
  <script id="promotion-example-data" type="application/json">${exampleData}</script>
</body>
</html>
`;
}

function driftQuestionPageHtml({ title, lead, boundary, example, evidence, action, actionHref, actionLabel = "Start this check" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} &middot; Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>${escapeHtml(title)}</h1>
    <p class="lead">${lead}</p>
    <p><strong>${escapeHtml(boundary)}</strong></p>
  </header>
  <main>
    <section aria-labelledby="example">
      <h2 id="example">See one example</h2>
      ${example}
    </section>
    <section aria-labelledby="evidence">
      <h2 id="evidence">Check the record</h2>
      ${evidence}
    </section>
    <section aria-labelledby="next-action">
      <h2 id="next-action">Do this next</h2>
      <p>${action}</p>
      <p><a class="button primary" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a></p>
    </section>
  </main>
  <footer>One question, one checked example, and one next action.</footer>
</body>
</html>`;
}

function ignoredValuesHtml() {
  return driftQuestionPageHtml({
    title: "Why did Helm ignore my values?",
    lead: "Helm accepts keys that a chart never reads. Test each value you supplied by rendering once with it and once without it, then compare the Kubernetes objects.",
    boundary: "Runs on your laptop. No ConfigHub account or cluster is required.",
    example: `<p>Redis 27.0.0 accepts the misspelled key <code>auth.passwrod</code>. The baseline and changed renders have the same object-set hash, so the key changed nothing and Helm gave no warning.</p><pre><code>auth:
  passwrod: wrong-key-is-ignored</code></pre><p>This record proves that one key on one chart version. It does not claim that every possible Redis value has been tested.</p>`,
    evidence: `<p><a href="${GITHUB_BLOB_BASE_URL}recipes/bitnami/redis/27.0.0/values-diagnostics.yaml">Open the Redis values diagnostic</a>. It records both render hashes, the no-change result, and the limit of the check.</p>`,
    action: "Choose the ignored-values question, add your chart and values, and run the generated comparison locally.",
    actionHref: "./ask.html#ignored-values",
  });
}

function upstreamVersionHtml() {
  return driftQuestionPageHtml({
    title: "Did this chart version change upstream?",
    lead: "A version string is only a label. Record the package digest when you review a chart, then compare that digest with later downloads of the same version.",
    boundary: "Runs on your laptop. No ConfigHub account or cluster is required.",
    example: `<p>The catalog found two version labels that later pointed at different bytes. For <code>fairwinds-stable/goldilocks@10.3.0</code>, the retained package starts <code>9498a6f49cde</code>; the republished package starts <code>3e51ce8032b0</code>.</p><p>The catalog keeps the reviewed package and records the newer bytes separately. It does not silently replace the package behind earlier evidence.</p>`,
    evidence: `<p><a href="./d/data/upstream-drift/summary.html">Open the upstream change record</a>. It links the retained publication receipt and the witness for the republished package.</p>`,
    action: "Choose the supply-drift question and check the current digest against the retained record.",
    actionHref: "./ask.html#supply-drift",
  });
}

function fluxArgoHtml() {
  return driftQuestionPageHtml({
    title: "Do you already run Flux or Argo CD?",
    lead: "Keep reconciling. ConfigHub is the reviewed write in front of your registry. Two reviewed components already reconcile from a public URL with no account, and any other chart renders the same way.",
    boundary: "The published components and the render need no account. Your controller reconciles the output the way it does today.",
    example: `<p>Two reviewed components are already published to the public namespace. Point Flux at one with no account, and it reconciles.</p>
      <pre><code>flux create source oci nginx \\
  --url=oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx-rendered --tag=24.0.2
flux create kustomization nginx --source=OCIRepository/nginx --path="." --prune=true</code></pre>
      <p>This is proven end to end. Flux fetched digest <code>sha256:ac21cf32</code> from the public URL and the nginx workload reached ready, in a cluster with no ConfigHub credentials. Redis is published the same way at <code>bitnami-redis-rendered:25.5.3</code>; provide its existing Secret before it reconciles.</p>
      <p>For any other catalog chart, render your own controller-native OCI and push it to a registry you control.</p>
      <pre><code>cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2@sha256:7cf08c0348a32d577ffa0e16069ec6c2510ce773b372008d25b938f9546c5f67 \\
  --base http-clusterip --output-oci oci://YOUR-REGISTRY/reviewed-nginx:24.0.2</code></pre>
      <p>Argo CD reads the same output through an OCI <code>Application</code>, and kubectl applies the same files. A registry as source of truth records who pushed an artifact and when. It does not record whether the bytes were reviewed, or what objects change at the next version. Those are <a href="./did-this-chart-version-change.html">the digest-drift check</a> and <a href="./ask.html">the render diff</a>.</p>
      <p>You can <a href="./promote.html">review a change before it reconciles</a>, then <a href="./kubara.html">build or govern a whole platform</a>, with Flux still the reconciler.</p>`,
    evidence: `<p>Four receipts back this path, all anonymous. <a href="${GITHUB_BLOB_BASE_URL}runs/rendered-oci-publish-proof/receipt.yaml">Flux reconciled the public nginx artifact and the workload reached ready, with no credential</a>. <a href="${GITHUB_BLOB_BASE_URL}runs/anonymous-oci-ci-proof/receipt.yaml">A job with no ConfigHub login pulled the public package</a>. <a href="${GITHUB_BLOB_BASE_URL}runs/serverless-oci-gitops-proof/receipt.yaml">Flux pulled a rendered output and the workload reached ready</a>. <a href="./d/data/catalog-oci-delivery-proof/summary.html">Argo CD, Flux, and kubectl consumed one digest</a>. The full manifests are on the <a href="./how-it-works.html#now-deploy">deploy page</a>.</p>`,
    action: "Reconcile the published nginx component, or render any other chart and hand the output to the Flux or Argo you already run.",
    actionHref: "./how-it-works.html#now-deploy",
    actionLabel: "See the deploy manifests",
  });
}

function bitnamiSuccessorHtml() {
  // Rank-one picks from the committed successor survey, each linked to its
  // catalog entry where one exists. The survey is the source of truth; this
  // page summarizes and points at it, so the measured detail never drifts.
  const picks = [
    ["redis", "redis (CloudPirates)", "Apache-2.0", "plain chart", "./charts/cloudpirates-redis-0-34-11.html"],
    ["nginx", "nginx (CloudPirates)", "Apache-2.0", "OCI chart", "./charts/cloudpirates-nginx-0-16-1.html"],
    ["postgresql", "CloudNativePG operator, with its companion cluster chart", "Apache-2.0", "operator", "./charts/cloudnative-pg-cloudnative-pg-0-28-2.html"],
    ["mongodb", "Percona Operator for MongoDB", "Apache-2.0", "operator", "./charts/percona-psmdb-operator-1-22-0.html"],
    ["rabbitmq", "rabbitmq (CloudPirates)", "Apache-2.0", "OCI chart", "./charts/cloudpirates-rabbitmq-0-21-13.html"],
    ["mysql", "Oracle MySQL Operator for Kubernetes", "UPL-1.0", "operator", "./d/data/bitnami-successors/successors.html"],
  ];
  const rows = picks.map(([component, pick, license, shape, href]) =>
    [`<code>${escapeHtml(component)}</code>`, `<a href="${href}">${escapeHtml(pick)}</a>`, escapeHtml(license), escapeHtml(shape)]);
  const table = markdownLikeTable([["Bitnami chart", "Verified successor", "License", "Shape"], ...rows], { rawFirstColumn: true, rawSecondColumn: true });
  return driftQuestionPageHtml({
    title: "Did your Bitnami chart stop pulling?",
    lead: "Bitnami moved its catalog behind a paid tier, so several pinned charts now refuse an anonymous fetch. For six common components there is a tested, verified successor you can pull today.",
    boundary: "Runs on your laptop. No ConfigHub account or cluster is required.",
    example: `<p>On 2026-08-08 an anonymous fetch of the pinned Bitnami packages returned HTTP 403 for four of six. The catalog keeps the reviewed bytes it already locked, and it names a successor for each component. Every candidate and every source status was measured live and re-verified by a second pass.</p>
      ${table}
      <p>Each successor is a real catalog entry with its own rendered objects, license, and prerequisites. The chart shape often differs from Bitnami, so values need remapping; migration stays separate reviewed work per component, not a silent swap.</p>`,
    evidence: `<p><a href="./d/data/bitnami-successors/successors.html">Open the successor survey</a>. It records the measured source status for every candidate, the ranked alternates behind each pick, and the license and publisher of each one.</p>`,
    action: "Open the successor for the component you lost, read its exact objects and prerequisites, then plan the values remap.",
    actionHref: "./charts/index.html?q=cloudpirates",
    actionLabel: "Find a successor in the Catalog",
  });
}

function environmentDifferenceHtml() {
  return driftQuestionPageHtml({
    title: "Why do development and production differ?",
    lead: "Store development and production as related configurations. Then every intentional difference has a field diff and every promotion has a revision record.",
    boundary: "Needs a ConfigHub account. A cluster is needed only when you deploy the result.",
    example: `<p>In the checked NGINX example, development changed <code>spec.replicas</code> from three to four. Staging stayed at three until that exact change was promoted. The staging namespace remained unchanged.</p><p>The receipt records the base, development, and staging revisions instead of asking someone to reconstruct the change from copied values files.</p>`,
    evidence: `<p><a href="${GITHUB_BLOB_BASE_URL}runs/byo-helm-values-promotion-proof/receipt.yaml">Open the development-to-staging promotion receipt</a>. Its limits say that this is one field promotion; rollback and fleet rollout are separate checks.</p>`,
    action: "Follow the ConfigHub tutorial to create a development configuration, make one change, and promote it to production.",
    actionHref: CONFIGHUB_TUTORIAL_URL,
  });
}

function approvedClusterHtml() {
  const boundaries = readYaml(runtimePathBoundariesPath);
  const paths = boundaries?.spec?.paths ?? [];
  check(
    paths.map((path) => path.id).join(",") === "local-files,kubectl,gitops,confighub-gitops",
    "runtime path boundary record must cover local files, kubectl, GitOps, and ConfigHub plus GitOps in order",
  );
  for (const path of paths) {
    for (const key of ["label", "liveComparison", "removals", "conflicts", "greenMeans", "boundary"]) {
      check(typeof path[key] === "string" && path[key].trim(), `runtime path ${path.id} is missing ${key}`);
    }
  }
  const coverage = boundaries?.spec?.currentFieldCoverage ?? {};
  check(coverage.result === "watch", "runtime field coverage must remain watch until the missing field is covered");
  check(coverage.detected === "spec.replicas", "runtime field coverage lost its detected replica field");
  check(coverage.missed === "container environment variables", "runtime field coverage lost its missed environment-variable field");
  const pathCards = `<div class="catalog">${paths
    .map(
      (path) => `<div class="card">
        <h4>${escapeHtml(path.label)}</h4>
        <p>${escapeHtml(path.boundary)}</p>
        <p><strong>Live comparison:</strong> ${escapeHtml(path.liveComparison)}</p>
        <p><strong>Removal:</strong> ${escapeHtml(path.removals)}</p>
        <p><strong>Conflicts:</strong> ${escapeHtml(path.conflicts)}</p>
        <p><strong>A green result means:</strong> ${escapeHtml(path.greenMeans)}</p>
      </div>`,
    )
    .join("")}</div>`;
  return driftQuestionPageHtml({
    title: "Does the cluster match what we approved?",
    lead: "Compare the reviewed desired objects with the objects reported by the cluster. Read the field coverage before treating a clean result as a match.",
    boundary: "Needs a ConfigHub account and a Kubernetes cluster for a standing comparison.",
    example: `<p>Our live gap test changed replicas and a container environment variable. The current comparison found the replica change but missed the environment-variable change.</p><p>That makes this result a warning, not a pass. A clean report covers only the fields named by the receipt.</p><h3>What each path can tell you</h3>${pathCards}`,
    evidence: `<p><a href="${GITHUB_BLOB_BASE_URL}${escapeHtml(coverage.receipt)}">Open the live drift receipt</a>. The <a href="./d/${escapeHtml(boundaries.spec.relatedEvidence.liveFieldCoverage.replace(/\.md$/, ".html"))}">plain-English summary</a> shows the detected field and the missed field.</p><p><a href="./d/${escapeHtml(boundaries.spec.relatedEvidence.pruning.replace(/\.md$/, ".html"))}">Check removal behavior</a> and <a href="./d/${escapeHtml(boundaries.spec.relatedEvidence.conflicts.replace(/\.md$/, ".html"))}">check field conflicts</a> separately.</p>`,
    action: "Read the current gap before you choose a desired-versus-live check for production.",
    actionHref: "./known-gaps.html",
    actionLabel: "Read the current limitation",
  });
}

// The challenge page is the detailed evidence layer for Check my config.
// It explains the six question families and the benchmark that shaped them.
function challengeHtml() {
  const GH = "https://github.com/confighub/helm-expt/blob/main/";
  const NEW_ISSUE = PROBLEM_CHART_ISSUE_URL;
  const promptText = `I have a Helm chart problem. Chart: &lt;repo/chart@version&gt;. My values: &lt;paste, secrets removed&gt;.

1. Render it exactly as installed: helm template rel &lt;chart&gt; --version &lt;v&gt; -f values.yaml --include-crds
2. List every object it creates. Flag Helm hooks and their phases, lookup() calls,
   admission webhooks, secrets generated at render time, and CRDs shipped or required.
3. For each values key I set, re-render without it and diff. Name every key that changes nothing.
4. Fetch https://confighub.github.io/helm-expt/site/changes.json and check whether this chart
   and version have a checked entry. If they do, open
   https://confighub.github.io/helm-expt/site/charts/index.html?q=&lt;chart&gt; and compare your
   findings against the recorded verdicts. Where you disagree, say why, and prefer the
   receipt to your own guess.
5. If there is no entry, say so, and with my approval file the chart at
   ${NEW_ISSUE}
   with the chart, version, and everything you found, so it gets a checked entry with receipts.`;
  const questions = [
    {
      heading: "What exactly will this install, and what must already exist?",
      note: "Rendering answers the first half in a minute. The second half, the Secrets, CRDs and namespaces that must be staged first, is where installs actually fail.",
      evidence: `Every catalog entry lists its prerequisites with the <a href="./charts/index.html">packaged configuration</a>; the recorded <a href="./d/data/webhook-cert-lifecycle/summary.html">webhook certificate lifecycle</a> shows the staged-versus-converged evidence per pinned chart.`,
    },
    {
      heading: "Which of my values keys change nothing?",
      note: "Helm accepts unknown keys silently, so a typo ships without a warning. Step 3 of the prompt tests every key you set, on your chart, today.",
      evidence: `Our <a href="${GH}recipes/bitnami/redis/27.0.0/values-diagnostics.yaml">values diagnostics</a> prove the mechanism with digest-identical renders around a deliberate typo.`,
    },
    {
      heading: "Will this upgrade destroy anything?",
      note: "Immutable selector changes, renamed resources that orphan state, and changed volumeClaimTemplates surface at apply time, in production, unless somebody diffs the renders first.",
      evidence: `We keep both sides of upgrade pairs committed, for example kube-prometheus-stack <a href="${GH}recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/release-objects.yaml">85.3.3</a> and <a href="${GH}recipes/prometheus-community/kube-prometheus-stack/87.19.2/revisions/default/r001/rendered/release-objects.yaml">87.19.2</a>, so the destructive diff is computable before Friday.`,
    },
    {
      heading: "What breaks without Helm&#39;s lifecycle: hooks, webhooks, CRD ordering?",
      note: "GitOps applies do not run hooks. Whether the chart still converges is a live question, not a render question.",
      evidence: `The <a href="./d/data/crd-ordering-gap/summary.html">CRD ordering record</a> and the <a href="./d/data/webhook-cert-lifecycle/summary.html">webhook lifecycle evidence</a> answer it per chart, from real runs.`,
    },
    {
      heading: "Are these the bytes somebody actually reviewed?",
      note: "Publishers republish under unchanged version strings; our sweep caught two doing it. This one cannot be answered after the fact, and it cannot be backfilled: every day without a pinned digest is a day you cannot audit later. Start today, with or without us: <code>helm pull</code> plus <code>sha256sum</code> committed to git is a real start; <code>cub installer setup --pull</code> gives you the receipt form.",
      evidence: `The <a href="./d/data/upstream-drift/summary.html">upstream drift record</a> holds both digest pairs from the 2026-08-07 sweep.`,
    },
    {
      heading: "What ran before, and can I get back to it exactly?",
      note: "helm rollback re-renders from templates. If you need the recorded revisions you actually ran, they have to exist, and Helm does not keep them.",
      evidence: `The <a href="./d/data/redis-upgrade-app-proof/summary.html">upgrade and rollback proof</a> shows a post-install edit surviving an upgrade and a rollback restoring an exact recorded revision.`,
    },
  ];
  const questionsHtml = questions.map((q, i) => `<h3>${i + 1}. ${q.heading}</h3>
      <p>${q.note}</p>
      <p><strong>Checked evidence:</strong> ${q.evidence}</p>`).join("\n      ");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Helm investigation reference &middot; Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Check a Helm answer against retained evidence</h1>
    <p class="lead">A capable assistant can render a chart and explain what it sees. This page adds version-specific package records, known limits, and receipts for facts that depend on history or a live run.</p>
    <p>For a shorter prompt built around your exact question, start with <a href="./ask.html">Check my config</a>. This page keeps the full six-question reference and the benchmark behind it.</p>
  </header>
  <main>
    <section aria-labelledby="the-prompt">
      <h2 id="the-prompt">The prompt</h2>
      <p>Copy it whole. Replace the placeholders. Keep secrets out of the values you paste.</p>
      <pre style="border: 1px solid var(--line); border-radius: 10px; padding: 16px; overflow-x: auto; white-space: pre-wrap;"><code>${promptText}</code></pre>
      <p>Steps 1 to 3 run on your laptop and need no account anywhere. Step 4 reads this site&#39;s public data. Step 5 files a public GitHub issue, with your approval, using the <a href="${NEW_ISSUE}">problem-chart template</a>.</p>
    </section>

    <section aria-labelledby="six-questions">
      <h2 id="six-questions">Six questions worth asking</h2>
      <p>These are what the prompt is really asking, and why each one matters. Where we hold checked evidence, it is linked.</p>
      ${questionsHtml}
    </section>

    <section aria-labelledby="send-chart">
      <h2 id="send-chart">Why send us a chart?</h2>
      <p>A filed chart becomes a checked entry: rendered objects, prerequisites, hooks and CRDs, a flattening verdict, and receipts behind each claim. You get an answer you can verify instead of one you have to trust, and every assistant that reads this catalog afterwards gets ground truth for that chart. The catalog grows from real problems rather than from our guesses.</p>
      <p><a href="${NEW_ISSUE}">File a problem chart</a>. Public charts only, and strip secrets from any values you include.</p>
    </section>

    <section aria-labelledby="the-benchmark">
      <h2 id="the-benchmark">The benchmark behind this page</h2>
      <p>Two rounds, eighteen questions, one capable assistant raced against our committed receipts. Round one, static chart facts: the assistant scored 96.7% in under a minute per chart, which is why the prompt above trusts it to do the rendering. Round two, questions about time, live state, and history: twelve of eighteen needed records the assistant could not produce, which is why step 4 checks the catalog.</p>
      <p>Zero fabricated receipts across both rounds. Two near-misses where confident answers outran the evidence, both documented. The full run data is committed in <a href="${GH}data/ai-benchmark/">data/ai-benchmark</a>, so this page&#39;s own claims are checkable.</p>
      <p><strong>Runs on your laptop:</strong> the prompt&#39;s render and values checks, and every catalog pull. <strong>Needs a ConfigHub account:</strong> variants, approvals, and the revision history that makes rollback-to-exact answerable. <strong>Needs an account and a cluster:</strong> the standing fleet record that binds what should run to what actually reports.</p>
    </section>
  </main>
  <footer>Every checked-evidence link above traces to a committed receipt. When your assistant disagrees with one, we want to hear about that too.</footer>
</body>
</html>
`;
}

// The three teaching surfaces used to sit under three different names, and one
// of them was called "Try Redis" in the navigation, which only parses if you
// already know Redis is our example chart. To a visitor it reads as an offer of
// Redis itself. This page gives them one door and puts them in order of how much
// of an afternoon they cost.
function guidesHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Guides · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Learn this by doing it</h1>
    <p class="lead">Three guides, shortest first. Each one runs real commands against real packages, so you finish with output you can check rather than a description of what would happen.</p>
    <p>The first runs entirely on your laptop. The later two use <a href="./confighub.html">ConfigHub</a> and a cluster where the flow being shown requires them, and each says so before it asks. If you want instructions for a step you are already on, read the <a href="./docs.html">Docs</a> instead.</p>
  </header>
  <main>
    <section aria-labelledby="short">
      <h2 id="short">Run a short example</h2>
      <p>The shortest one. Pull one public package, render it locally, and read the exact Kubernetes objects it produces. Everything stays on your machine, well away from <a href="./confighub.html">ConfigHub</a> Server and Kubernetes, so it is the fastest way to see what the tool does.</p>
      <p><a href="./try.html">Open the short example</a></p>
    </section>

    <section aria-labelledby="examples">
      <h2 id="examples">Work through an example like yours</h2>
      <p>Start from your own Helm values, an AICR recipe for AI infrastructure, an existing OCI package, or Kubernetes YAML. Each example carries the commands and the evidence for one worked flow, from promotions through to fleet rollouts and policy checks.</p>
      <p><a href="./testing.html">Open Helm, AICR, OCI, YAML, promotion, and fleet examples</a></p>
    </section>

    <section aria-labelledby="walkthrough">
      <h2 id="walkthrough">Follow one package end to end</h2>
      <p>The longest guide. It takes a single Redis configuration through pulling, inspecting and verifying it, then changes and upgrades it, and shows what stays the same across versions.</p>
      <p><a href="./redis-walkthrough.html">Open the detailed walkthrough</a></p>
    </section>

    <section aria-labelledby="after">
      <h2 id="after">After a guide</h2>
      <p>Choose where the reviewed result goes on the <a href="./how-it-works.html">Deployment</a> page, find a configuration to start from in the <a href="./charts/index.html">Catalog</a>, or read <a href="./known-gaps.html">what is not ready yet</a>.</p>
      <p>Need to compare identities? <a href="./how-it-works.html">Deployment</a> separates the Kubernetes object-set digest, the OCI manifest digest, and the ConfigHub release OCI digest. They identify different records.</p>
      <p>Some steps in the later two guides store the result in <a href="./confighub.html">ConfigHub</a>. Read <a href="./confighub.html">what ConfigHub adds</a> to see why a reviewed configuration becomes a shared record when your team needs changes, approvals, promotion, and rollout, and <a href="./serverless.html">how far you get without an account</a> if you would rather not.</p>
    </section>
  </main>
  <footer>Each guide runs real commands and ends with output you can check. Start with the short one.</footer>
</body>
</html>
`;
}

function docsHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Docs · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Find instructions for the step you are doing</h1>
    <p class="lead">Choose the question closest to your current work. Each link opens the commands, example, or evidence you need.</p>
    <p>Use these guides for the commands behind every supported input format, and for ConfigHub.</p>
  </header>
  <main>
    <section aria-labelledby="start">
      <h2 id="start">Start with a configuration</h2>
      <h3 id="four-answers">First choose the answer you need</h3>
      <p>The same questions apply to every input format, from a Helm chart to plain Kubernetes YAML. Choose the question you need before choosing a command.</p>
      ${markdownLikeTable([
        ["Question", "What you need", "What it does not prove"],
        ["What do I have?", "The source, snapshot, package, or exact files.", "What a source tool will generate, or whether a destination can run it."],
        ["What will it produce?", "The source inputs and the exact materialization command, or literal objects where materialization is a no-op.", "Whether a named destination has the required APIs, credentials, hardware, and lifecycle setup."],
        ["Can this destination accept it?", "The exact candidate and current facts from the named destination.", "That the configuration has been deployed or works at runtime."],
        ["Did it work?", "The exact delivered revision and the live result required by the claim.", "Results for another revision, destination, or untested behavior."],
      ])}
      <p>A missing prerequisite marks the unanswered stage <strong>blocked</strong> or <strong>not run</strong>, which is a gap in coverage rather than a failure of the source or its result.</p>
      <h3><a href="./try.html">Can I try one simple package?</a></h3>
      <p>Try Redis for a short local exercise with no server, cluster, or account.</p>
      <h3><a href="./try-aicr.html">Can I try one AICR configuration without a GPU?</a></h3>
      <p>Pull and verify the seven-Application CPU starter, then write it as a local OCI without ConfigHub or Kubernetes.</p>
      <h3><a href="./charts/index.html">Which public configuration should I use?</a></h3>
      <p>Use the Component Catalog to choose a component and exact retained package version, then inspect its packaged configurations, required setup, and evidence.</p>
      <h3><a href="./testing.html">How do I bring my own input?</a></h3>
      <p>Worked Examples covers your own Helm values, an AICR recipe, or plain Kubernetes YAML.</p>
      <h3><a href="./ask.html">How do I check my own Helm values or a result I do not understand?</a></h3>
      <p>Build a local prompt for the AI assistant you already use. Private charts and values stay on your machine.</p>
      <h3><a href="./kubara.html">How do I add ConfigHub to an existing Kubara platform?</a></h3>
      <p>Keep Kubara's component selection and generated topology, with Argo reconciliation intact, while following one six-step adoption tutorial with explicit evidence checkpoints.</p>
    </section>

    <section aria-labelledby="prepare">
      <h2 id="prepare">Prepare it for deployment</h2>
      <h3><a href="./how-it-works.html">Where should the files live?</a></h3>
      <p>Deployment explains the local files, OCI, and ConfigHub choices in one sequence.</p>
      <h3><a href="./how-it-works.html#now-deploy">How do I turn reviewed files into a deployable OCI?</a></h3>
      <p>Choose the local OCI or ConfigHub release path, then let Argo CD or Flux pull the reviewed objects.</p>
      <h3><a href="./d/docs/user/chart-hooks-what-happens.html">What happens to hooks and CRDs?</a></h3>
      <p>See how required setup is recorded and ordered, then tested or marked blocked.</p>
      <h3><a href="./d/docs/user/helm-presets-and-values.html">Should I change the source input or the rendered object?</a></h3>
      <p>Use this guide to decide whether a change belongs in Helm values or in the stored Kubernetes objects.</p>
      <h3><a href="./d/docs/user/gitops-adopter-guide.html">How do Argo CD and Flux receive it?</a></h3>
      <p>The GitOps guide explains how controllers pull reviewed Kubernetes objects from Git or OCI.</p>
    </section>

    <section aria-labelledby="manage">
      <h2 id="manage">Change or operate saved configuration</h2>
      <h3><a href="./d/docs/user/variants-after-upload.html">How do I make environment variants?</a></h3>
      <p>Create, compare, and promote development and production variants.</p>
      <h3 id="promotion"><a href="./promote.html">How do I test a change before promotion?</a></h3>
      <p>Compare the exact current result with the candidate for the next stage. The review shows what changed, what blocks the move, and what still needs a staging test.</p>
      <h3><a href="../docs/user/day2-upgrade-story.md">How do I upgrade and roll back?</a></h3>
      <p>The day-2 upgrade story: diff the value model first, check control points and immutable fields, then upgrade rendered bundles by digest. The <a href="./redis-walkthrough.html">Redis walkthrough</a> shows one full upgrade, promotion, and rollback.</p>
      <h3><a href="./journey.html">What can a ConfigHub App automate?</a></h3>
      <p>Apps on ConfigHub includes upgrade, RBAC, and fleet examples, among others.</p>
      <h3><a href="./testing.html#platforms">How do I roll a change through a fleet?</a></h3>
      <p>Open the Kubara and Sveltos examples for platform configuration, cluster assignments, and rollout evidence.</p>
      <h3><a href="./existing-apps.html">How do I start from an existing application?</a></h3>
      <p>Start read-only from GitOps, Helm, or a live cluster.</p>
      <h3><a href="./d/docs/user/image-registry-migration.html">What if an upstream registry or its terms change?</a></h3>
      <p>Repoint image references across environments with the digest intact, promote the change environment by environment, and prove where it landed.</p>
    </section>

    <section aria-labelledby="check">
      <h2 id="check">Check a result or solve a problem</h2>
      <h3><a href="./ask.html#check-command">How do I run the shared checks on rendered files?</a></h3>
      <p>Install the released check plugin, run <code>cub check</code> locally, and keep its JSON result with the exact files and digest. No ConfigHub account or server is required.</p>
      <h3><a href="./verification.html">How do I check a result?</a></h3>
      <p>Find the command that checks generated Kubernetes files, a saved test record, or a live cluster.</p>
      <h3><a href="./does-cluster-match-approved-config.html">How complete is the live drift check?</a></h3>
      <p>See which fields the current drift check covers and which differences it can still miss.</p>
      <h3><a href="./known-gaps.html">What is not working yet?</a></h3>
      <p>Read the named limitations and the evidence behind them.</p>
      <h3><a href="./d/docs/user/broken-chart-triage.html">Why did a chart fail?</a></h3>
      <p>Separate source, render, setup, target, and runtime failures.</p>
      <h3><a href="./hard-questions.html">What are the difficult questions?</a></h3>
      <p>The FAQ answers questions about safety, upgrades, and current limits, among others.</p>
    </section>

    <section aria-labelledby="continue">
      <h2 id="continue">More references</h2>
      <p><a href="./docs-reference.html">Browse all technical references</a> for every guide, evidence table, and generated data source.</p>
      <p><a href="./confighub.html">Continue with ConfigHub</a> when your team needs shared variants, approvals, and rollout history.</p>
    </section>
  </main>
  <footer>Choose the guide for the work in front of you. Use the full reference index only when you need deeper detail.</footer>
</body>
</html>
`;
}

function verificationHtml(catalog) {
  const commandRows = [
    ["What known configuration risks appear in these rendered objects?", `<code>${CHECK_PLUGIN_INSTALL_COMMAND}</code><br><code>cub check --format json --output cub-check.json ./rendered</code>`, "No", "A local advisory result with stable finding IDs and the pinned pattern bundle. It is not a cluster or runtime test."],
    ["Are the generated pages, docs, and data current?", "<code>npm run site:verify</code><br><code>npm run docs:verify</code><br><code>npm run data:index:verify</code>", "No", "Generated files match the committed source and data."],
    ["Does the Redis tutorial produce the expected files?", "<code>npm run redis:verify-install:render -- ...</code>", "No", "A user's local render matches the recorded chart, configuration, and package."],
    ["Does the complete repository agree with itself?", "<code>npm run verify</code>", "No cluster by default", "The committed catalog, generated files, receipts, and docs are consistent."],
    ["Do Helm and cub installer reach the same result?", "<code>npm run kind-parity:run -- ...</code>", "Yes, kind", "Helm and cub installer are compared on two new kind clusters."],
    ["Are the saved two-cluster results still consistent?", "<code>npm run kind-parity:verify</code>", "No", "The committed receipts still agree with their summaries."],
    ["Does the ConfigHub and OCI path work live?", "<code>npm run live-parity:run -- ...</code>", "Yes, kind plus ConfigHub and OCI", "One recorded configuration is tested through ConfigHub, OCI, and Kubernetes."],
    ["Do the result labels still have the same meaning?", "<code>npm run lane-tests:verify</code>", "No", "The test matrix and its pass, watch, blocked, and not-run meanings are valid."],
    ["Is this cub-scout receipt intact?", "<code>cub-scout receipt validate &lt;receipt.json&gt;</code>", "No", "The receipt's fingerprint and structure validate locally."],
  ];
  const routeRows = [
    ["Render", "Turn the chart and its recorded settings into the exact Kubernetes objects.", "The object set matches the expected Helm result."],
    ["Record", "Keep the source, settings, objects, diffs, checks, and receipts together.", "A reviewer can explain the result and repeat the check."],
    ["Route", "State how hooks, CRDs, Secrets, setup jobs, target requirements, and GitOps delivery are handled.", "Required work is assigned, tested, blocked, or marked as not yet run."],
  ];
  const topicRows = [
    [`<a href="../docs/user/verification.md">Verification docs</a>`, "The canonical docs landing page for proof commands and render-record-route."],
    [`<a href="../docs/user/verify-it-yourself.md">Verify It Yourself</a>`, "The practical command list for offline checks, rendered installs, parity receipts, and cub-scout receipts."],
    [`<a href="../docs/user/verification-lanes.md">Verification Lanes</a>`, "What each type of test proves and what it does not prove."],
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
  <title>Check One Claim · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Check one claim</h1>
    <p class="lead">Choose the result you want to check, then run the matching command. These commands test this project's published results; they do not install your application.</p>
    <p>Some checks read evidence already committed to the repository. Others create clusters and produce a new live result. The table tells you which kind you are about to run.</p>
    <p>A claim is checked only when the named command or receipt covers it. Everything else is <strong>not checked</strong>, even when a nearby test passed.</p>
    ${humanLinks([["Choose a command", "#start-question"], ["See current results", "./proof.html"], ["Read known gaps", "./known-gaps.html"]])}
  </header>
  <main>
    <section aria-labelledby="start-question">
      <h2 id="start-question">1. Choose the question and command</h2>
      <h3 id="four-questions">First decide which answer you need</h3>
      <p>Inspection, materialization, destination checks, and post-deployment checks use different inputs. A result from one stage does not pass the next stage.</p>
      ${markdownLikeTable([
        ["Question", "Minimum input", "Deployment needed?"],
        ["What do I have?", "The source, package, snapshot, or files to inspect.", "No"],
        ["What will it produce?", "Source inputs plus its native tool, or literal objects where this step is a no-op.", "No"],
        ["Can this destination accept it?", "The exact candidate plus current destination facts.", "No"],
        ["Did it work?", "The exact delivered revision plus the live evidence required by the claim.", "Yes"],
      ])}
      <p>Keep <strong>evidence state</strong> separate from <strong>result state</strong>. For example, an AICR resource check cannot run when the selected components were never deployed. That stage is blocked or not run; it is not a failed GPU or configuration result.</p>
      <h3>Choose the matching command</h3>
      <p>Use the smallest check that answers it. A generated-file check confirms repository consistency. A live check tests one recorded configuration again and may create clusters and receipts.</p>
      ${markdownLikeTable([
        ["Question", "Command or page", "Needs cluster?", "What it proves"],
        ...commandRows,
      ], { rawSecondColumn: true })}
    </section>

    <section aria-labelledby="product-vs-proof">
      <h2 id="product-vs-proof">2. Tell product commands from project checks</h2>
      <div class="grid">
        <div class="card"><h3>Product commands</h3><p><code>cub</code>, <code>helm</code>, <code>kubectl</code>, Argo, and Flux render, install, deliver, or manage configuration.</p></div>
        <div class="card"><h3>Project checks</h3><p><code>npm run ...</code> checks this repository's generated files, receipts, and summaries, among other records.</p></div>
        <div class="card"><h3>Complete project check</h3><p><code>npm run verify</code> checks the whole repository. Use it before publishing or reviewing a large change.</p></div>
      </div>
    </section>

    <section aria-labelledby="render-record-route">
      <h2 id="render-record-route">3. See what render, record, and route mean</h2>
      <p>The Kubernetes YAML shows what would run. The source record explains how it was produced. Lifecycle records explain work such as hooks, CRDs, Secrets, and setup jobs.</p>
      ${markdownLikeTable([
        ["Move", "Meaning", "What gets checked"],
        ...routeRows,
      ])}
    </section>

    <section aria-labelledby="fresh-committed">
      <h2 id="fresh-committed">4. Choose saved evidence or a fresh run</h2>
      <div class="grid">
        <div class="card"><h3>Saved evidence</h3><p>Already in the repository. Use it to review a claim and confirm that summaries still match their receipts and data.</p></div>
        <div class="card"><h3>Fresh evidence</h3><p>Created by a new run. It may create kind clusters, use ConfigHub, publish OCI artifacts, wait for Argo or Flux, and write receipts.</p></div>
        <div class="card"><h3>Run live checks one at a time</h3><p>Do not overlap fresh live checks. Keep clusters, credentials, and receipts separate.</p></div>
      </div>
    </section>

    <section aria-labelledby="subtopics">
      <h2 id="subtopics">5. Open detailed instructions</h2>
      ${markdownLikeTable([
        ["Topic", "Use it for"],
        ...topicRows,
      ], { rawFirstColumn: true })}
    </section>
  </main>
  <footer>Generated from committed helm-expt evidence. Project checks test claims; product commands perform the Helm and ConfigHub work.</footer>
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
    tpl: ["Template evaluation", "The chart runs Helm templates inside values or snippets. The catalog keeps the final objects and any intended extension points."],
    capabilities: ["Kubernetes capabilities", "The render changes according to the Kubernetes APIs it expects. The recorded configuration pins those API capabilities."],
    "cluster-rbac": ["Cluster RBAC", "The chart creates cluster-wide permissions. The objects are visible before delivery and can be reviewed or gated."],
    "stateful-storage": ["Stateful storage", "The chart creates StatefulSets, PVCs, or storage-related objects. These need target-fit and upgrade care."],
    "generated-facts": ["Generated values", "The chart needs a generated password, certificate, or name. The catalog records the value or says who must supply it."],
    lookup: ["Cluster lookups", "The render reads live cluster data. The catalog records the value used, or names the limitation when it cannot."],
    crds: ["CRDs", "The chart includes custom resource definitions or depends on them. We track whether CRDs are installed, omitted, staged, or observed."],
    webhooks: ["Webhooks", "The chart installs admission or conversion webhooks. We track certificate lifecycle, readiness, and server-side behavior separately from render parity."],
    hooks: ["Helm hooks", "The chart runs work before or after normal resources. The chart page says who runs that work and whether it has been tested."],
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
  <title>Helm Setup And Lifecycle Work · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Find the setup a Helm chart still needs</h1>
    <p class="lead">Rendered YAML does not explain every requirement. A chart may still need CRDs, a Secret, a webhook certificate, storage, cluster data, or a hook to run at the right time.</p>
    <p>Use this page to understand those requirements, then open the exact chart page to see what has been recorded and tested.</p>
    ${humanLinks([["Browse charts", "./charts/index.html"], ["See hook and CRD example", "./d/docs/demo/hooks-crds/kube-prometheus-stack.html"], ["Open matrix", "./matrix.html"]])}
  </header>
  <main>
    <section aria-labelledby="how">
      <h2 id="how">1. Check the chart page first</h2>
      <p>Choose the chart and configuration you plan to use. Its page lists required setup, lifecycle work, current gaps, and the next action.</p>
      <p>Use the table below when a term is unfamiliar. Use the matrix when you need the exact status for one chart version and configuration.</p>
    </section>

    <section aria-labelledby="list">
      <h2 id="list">2. Understand each extra requirement</h2>
      ${markdownLikeTable([
        ["Requirement", "What it means", "Charts", "Configurations", "Examples"],
        ...quirkRows,
      ], { rawFifthColumn: true })}
    </section>

    <section aria-labelledby="important">
      <h2 id="important">3. Check what remains before deployment</h2>
      <p><strong>A matching render is only the first check.</strong> The cluster may still need CRDs, a Secret, webhook readiness, storage, cloud identity, or a controller.</p>
      <p><strong>A recorded hook does not mean it runs automatically.</strong> The chart page must say who runs it and link the result when that path has been tested.</p>
      <p><strong>A watch or blocked result needs action.</strong> Follow the stated setup, decision, or evidence link before deployment.</p>
    </section>
  </main>
  <footer>Generated from committed helm-expt evidence. Use the chart page and matrix for exact status.</footer>
</body>
</html>
`;
}

function proofHtml(catalog) {
  const metric = (name) => catalog.statusMetrics.find((row) => row.metric === name) ?? {};
  const proofCounters = [
    ["Helm render match", metricValue(metric("render parity rows")), "Helm and cub installer produced the same objects from the recorded settings."],
    ["Stored in ConfigHub", metricValue(metric("in-ConfigHub proof rows")), "The objects were uploaded and checked as ConfigHub Units."],
    ["Local Kubernetes run", metricValue(metric("local live rows")), "The configuration was applied to a local Kubernetes target and observed."],
    ["OCI through Argo CD", metricValue(metric("GitOps/OCI live pass rows")), "Argo CD pulled a ConfigHub release OCI and reconciled it in a live run."],
    ["Helm and ConfigHub live match", metricValue(metric("live Helm-vs-ConfigHub parity pass rows")), "Helm and the ConfigHub delivery paths reached the same live object result."],
    ["Two-cluster Helm and cub match", metricValue(metric("two-cluster kind parity pass rows")), "Helm and cub installer were compared on two new kind clusters."],
    ["All core checks", metricValue(metric("complete core lane rows")), "The recorded configuration has render, ConfigHub, local, OCI, live comparison, and two-cluster evidence."],
    ["Object differences found", metricValue(metric("ConfigHub/OCI semantic parity defect receipts")), "A committed live comparison found different Kubernetes object content."],
  ];
  const laneRows = [
    ["Render comparison", "Did cub installer preserve the Helm object set?", "Helm render receipt and installer comparison.", "Applies only to the recorded chart, version, configuration, values, and Kubernetes capabilities."],
    ["ConfigHub storage and checks", "Were the rendered objects uploaded and checked as Units?", "ConfigHub, scan, and safe-operation receipts.", "Does not prove GitOps delivery or workload health."],
    ["Local Kubernetes run", "Did the configuration apply and become ready on Kubernetes?", "Observation and workload receipts, with PVC, CRD, or Secret checks where needed.", "Usually uses local kind; production needs its own target scope."],
    ["Argo CD and OCI run", "Did Argo CD pull and reconcile the ConfigHub release OCI?", "Argo CD sync, health, and live observation receipt.", "A green sync is not enough unless the runtime checks also pass."],
    ["Helm and ConfigHub live comparison", "Did Helm and ConfigHub reach the same live result?", "Live Helm-versus-ConfigHub comparison receipt.", "Available for selected configurations; no receipt means not yet tested."],
    ["Two-cluster Helm and cub comparison", "Did Helm on one new kind cluster match cub installer on another?", "Two-cluster comparison receipt.", "Does not prove ConfigHub or OCI unless a separate result records them."],
    ["Hooks and prerequisites", "Were hooks, CRDs, webhooks, generated values, and target requirements handled?", "Lifecycle, hook, target, and serious-chart receipts.", "Some configurations still need a user decision, a target-specific step, or more work."],
  ];
  const scepticRows = [
    ["Claims register", "Every public claim is backed, partial, planned, or refused.", "../data/claims-register/summary.md"],
    ["Blast-radius accuracy", "Predicted affected objects are scored against actual rerender diffs, including published failures.", "../data/blast-radius-accuracy/summary.md"],
    ["Synthetic torture suite", "Breaker charts land in named pass, refusal, or route outcomes; silent outcomes fail.", "../data/torture-suite/summary.md"],
    ["Environment checks", "The project checks whether timezone or locale changes the rendered objects in the tested examples.", "../data/environment-matrix/summary.md"],
    ["Hook handling", "Charts with hooks show whether the hook was observed, given an explicit route, left to the target, or still needs chart-specific work.", "../data/hook-disposition/summary.md"],
    ["Master matrix", "Every chart/version/base row carries test status, source links, production scope, and next action.", "./matrix.html"],
  ];
  const refusalRows = [
    ["No blanket chart support", "Every claim names chart, version, base, test, and target profile."],
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
  <title>See What Has Been Tested · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>See what has been tested</h1>
    <p class="lead">A render comparison, a ConfigHub upload, an OCI delivery, and a live Kubernetes run answer different questions. Use this page to see how far each claim was tested.</p>
    <p>Every result names its scope: one chart, one values file, one test environment. Open the matrix for the exact configuration and the receipt for the exact test.</p>
    ${humanLinks([["Check one claim", "./verification.html"], ["Read the matrix", "./matrix.html"], ["Read known gaps", "./known-gaps.html"]])}
  </header>
  <main>
    <section aria-labelledby="counters">
      <h2 id="counters">1. Read the current counts</h2>
      <p>Each count answers a separate question. Production use still needs a target-specific decision and current evidence.</p>
      <div class="grid">
        ${proofCounters.map(([label, value, body]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)} · ${escapeHtml(body)}</span></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="lanes">
      <h2 id="lanes">2. See what each test covers</h2>
      ${markdownLikeTable([
        ["Test", "Question", "Evidence", "Limit"],
        ...laneRows,
      ])}
      <p>Use <a href="./verification.html">Check one claim</a> for the command map. <a href="../docs/user/verification-lanes.md">Verification Lanes</a> explains test meanings. <a href="../docs/user/chain-of-proof.md">Chain Of Proof</a> separates repository, ConfigHub, GitOps, and live evidence.</p>
    </section>

    <section aria-labelledby="serious">
      <h2 id="serious">3. Check the harder charts</h2>
      <p>Hard charts are where mistakes hurt. Examples include kube-prometheus-stack and cert-manager, and any chart with hooks, CRDs, or webhooks. Generated Secrets, storage, and target requirements add their own risks.</p>
      <p>This is the expert and SRE problem. Before a fleet change ships, someone must know what it touches and what the cluster must provide. They also need the check, delivery, and live results.</p>
      <p>For these charts, a green render is not enough. The page must name the prerequisites, lifecycle route, target observation, and production review status.</p>
      <div class="grid">
        <div class="card"><h3>kube-prometheus-stack</h3><p><a href="../docs/user/prometheus-high-fanout.md">High-fanout guide</a> and <a href="../data/hard-chart-production-packets/summary.md">production packet</a>.</p></div>
        <div class="card"><h3>Upgrade crash example</h3><p><a href="../docs/user/helm-upgrade-crash-example.md">How a high-risk Helm upgrade becomes staged, gated, and observed</a>.</p></div>
        <div class="card"><h3>cert-manager and ESO</h3><p><a href="../data/lifecycle-observations/cert-manager-eso/summary.md">Lifecycle observations</a> for CRDs, webhooks, and controller-populated fields.</p></div>
        <div class="card"><h3>Argo Workflows</h3><p>Hook-delivered CRDs routed through the <a href="../data/lifecycle-boundary/summary.md">lifecycle boundary</a>.</p></div>
        <div class="card"><h3>Argo Rollouts</h3><p>Default and no-crds bases now have live Helm-vs-ConfigHub parity receipts.</p></div>
        <div class="card"><h3>Hooks</h3><p><a href="../data/hook-disposition/summary.md">Top-100 hook results</a> say whether each hook was observed, assigned to a delivery path, depends on a specific cluster, or still needs chart-specific work.</p></div>
      </div>
    </section>

    <section aria-labelledby="sceptic">
      <h2 id="sceptic">4. Find tests designed to expose failure</h2>
      <p>You still need to test on your own cluster before production. The contributor doctrine behind these tests is part of <a href="./d/docs/reference/how-the-catalog-is-built.html">how the catalog is built</a>.</p>
      <p>Use the <a href="https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml">problem chart issue template</a> to send a public chart, values file, or catalog mismatch.</p>
      ${markdownLikeTable([
        ["Test or record", "What it answers", "Open"],
        ...scepticRows.map(([name, body, path]) => [name, body, `<a href="${path}">Open ${escapeHtml(name)}</a>`]),
      ], { rawSecondColumn: false, rawThirdColumn: true })}
    </section>

    <section aria-labelledby="refusals">
      <h2 id="refusals">5. See what this project does not claim</h2>
      ${markdownLikeTable([
        ["Refusal", "Why it matters"],
        ...refusalRows,
      ])}
      <p><a href="../docs/user/what-we-refuse-to-claim.md">Read the full refusal page</a> or <a href="../data/claims-register/summary.md">open the claims register</a>.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. What a passing verifier does and does not mean is part of <a href="./d/docs/reference/how-the-catalog-is-built.html">how the catalog is built</a>.</footer>
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
      title: "1. Start with the basics",
      rows: [
	        {
	          status: "answered",
	          question: "Is this just Helm with extra paperwork?",
	          answer:
	            "No. You keep your Helm charts and values. The Catalog adds tested starting configurations and shows their exact Kubernetes objects. ConfigHub stores the reviewed objects, the approvals, and the release history.",
	          links: [["Choosing commands", "../docs/user/choosing-commands.md"], ["Browse charts", "./charts/index.html"]],
	        },
	        {
	          status: "answered",
	          question: "Do I have to rewrite my charts?",
	          answer:
	            "No. Keep your charts, values, templates, and current delivery tools. This project helps you inspect and manage the objects they produce.",
	          links: [["Why this exists", "../docs/user/why-this-exists.md"], ["Creating variants", "../docs/user/creating-variants.md"]],
	        },
	        {
	          status: "answered",
	          question: "How is cub installer different from cub helm?",
	          answer:
	            "cub helm starts with any chart and values. It can render locally or record the rendered base and Helm source in ConfigHub. cub installer starts with a maintained Catalog package containing named configurations and requirements. Both are optional preparation tools.",
	          links: [["Official tutorial", CONFIGHUB_TUTORIAL_URL], ["cub helm plugin", "https://github.com/confighub/cub-helm"], ["cub installer plugin", "https://github.com/confighub/installer"]],
	        },
		        {
		          status: "answered",
		          question: "Do you support every Helm values combination?",
		          answer:
		            "No. A chart can expose too many combinations to test as one claim. The Catalog covers common operating choices with chart-specific base variants. Examples include no-CRDs, existing Secret, server-only, HA, and internal service.",
	          links: [["Helm base variants and values", "../docs/user/helm-presets-and-values.md"], ["Helm render intents", "../docs/user/helm-render-intents.md"]],
	        },
		        {
		          status: "answered",
		          question: "Isn't that case-specific?",
		          answer:
		            "Yes. That is deliberate because Helm charts have different operating choices. AI can help update the configurations across versions, but tests decide what the Catalog accepts.",
	          links: [["Component Catalog", "./charts/index.html"], ["AI and the catalog", "./ai.html"]],
	        },
		        {
		          status: "answered",
		          question: "What is a base variant?",
		          answer:
		            "A base variant is one supported configuration for one chart version. It records the Helm values and render settings, keeps the Kubernetes YAML, and names extra install work.",
	          links: [["Base variant explanation", "./charts/index.html#base-variants"], ["Creating variants", "../docs/user/creating-variants.md"]],
	        },
	        {
	          status: "answered",
	          question: "Does it only work for easy charts?",
          answer:
            "No. Redis teaches the basic path. The kube-prometheus-stack example covers CRDs, webhooks, RBAC, generated values, cluster requirements, upgrades, and live checks.",
          links: [["Serious chart proof", "../docs/user/serious-chart-proof.md"], ["kube-prometheus-stack page", "./charts/prometheus-community-kube-prometheus-stack-85-3-3.html"]],
        },
        {
          status: "answered",
          question: "What do the current generated counts say?",
          answer:
            "The counts come from committed test results. Use them for orientation, then open the matrix for the exact chart, version, and configuration.",
          extraHtml: `<div class="faq-metrics">${proofCounters
            .map(([label, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`)
            .join("")}</div>`,
          links: [["Master matrix", "./matrix.html"], ["Current proof status", "../docs/user/current-proof-status.md"]],
        },
      ],
    },
    {
      title: "2. Follow the configuration into ConfigHub",
      rows: [
		        {
		          status: "answered",
		          question: "How does it actually work, end to end?",
		          answer:
		            "Choose a chart configuration and record its Helm values and render settings. Inspect the Kubernetes YAML and handle its required setup. ConfigHub can then store, change, approve, and release the reviewed objects. Delivery and live checks remain separate recorded steps.",
	          links: [["Detailed mechanism guide", "../docs/user/how-it-works.md"], ["The data model", "../docs/user/confighub-data-model.md"]],
	        },
	        {
	          status: "answered",
	          question: "How is config delivered, and what about OCI and credentials?",
	          answer:
	            "ConfigHub publishes the reviewed Units in one Space as a release OCI. Argo CD or Flux pulls it without rendering Helm again. A separate direct local test checks that the same artifact is portable. A hook fixture proves the mechanism, and an NGINX receipt proves one catalog base at one digest. Other bases need their own receipts. cub cluster up installs the Argo CD pull credential. The Flux test copies it into flux-system without printing it.",
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
          links: [["The data model", "../docs/user/confighub-data-model.md"], ["Detailed mechanism guide", "../docs/user/how-it-works.md"]],
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
      title: "3. Handle hooks, Secrets, and cluster requirements",
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
	          links: [["Chart setup and lifecycle work", "./quirks.html"], ["Target prerequisites", "../docs/user/target-prerequisites.md"]],
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
          question: "What if the cluster is missing something the configuration needs?",
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
      title: "4. Check delivery, upgrades, and live results",
      rows: [
	        {
	          status: "answered",
	          question: "Can one change roll out across a whole fleet safely?",
	          answer:
	            "Yes, within recorded bounds. The fleet record predicts which objects a base change touches in each environment. Environments shielded by their own override are marked. A live receipt shows one reviewed edit fanned out to three environments, each behind its own approval. Beyond the recorded fleets, no claim is made.",
	          links: [["Fleet blast radius", "../data/blast-radius-fleet/summary.md"], ["Bulk operations receipt", "../data/sveltos-bulk-ops/summary.md"]],
	        },
        {
          status: "answered",
          question: "Can I trust a green GitOps sync?",
          answer:
            "Not by itself. Sync means the controller accepted the desired state. Workload convergence, target prerequisites, controller-owned fields, and semantic parity need separate evidence.",
          links: [["Why synced is not working", "../docs/user/why-synced-is-not-working.md"], ["Verification checks", "../docs/user/verification-lanes.md"]],
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
      title: "5. Understand values, variants, and Catalog coverage",
      rows: [
        {
          status: "answered",
          question: "Can I bring my own values files or overlays?",
          answer:
            "Yes, but the route matters. If a choice changes Helm inputs or the objects Helm renders, it belongs in a new base variant or import path. If it changes fields after upload, it belongs in a derived ConfigHub variant.",
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
            "No. Claims are per chart, version, base, values path, test, and target profile. A new values file or overlay needs its own render, scan, receipts, and live evidence.",
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
      title: "6. Understand free use and the evidence",
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
          question: "What happens when a chart's upstream source changes its terms?",
          answer:
            "Retained versions stay pullable from this catalog's own registry, with their receipts unchanged. The full retention reasoning is recorded in how the catalog is built.",
          links: [["How the catalog is built", "./d/docs/reference/how-the-catalog-is-built.html"], ["Registry migration guide", "./d/docs/user/image-registry-migration.html"], ["Component Catalog", "./charts/index.html"]],
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
      title: "7. Read current limitations",
      rows: [
	        {
	          status: "answered",
	          question: "Can ConfigHub replace every production operator decision?",
	          answer:
	            "No. Some decisions stay with a person, and the records say which. Every production disposition names its decision and its owner. Charts that need a custom discussion are marked in the matrix rather than automated over.",
	          links: [["Production dispositions", "../data/production-disposition/summary.md"], ["Master catalog matrix", "./matrix.html"]],
	        },
	        {
	          status: "answered",
	          question: "Do default bases generate fresh passwords?",
	          answer:
	            "No. Keep credential material outside the render. For affected charts, the package default now uses an existing Secret and renders no shared password. The page gives you a command to create fresh Secret material before apply. Fixed-password demo bases are explicit, non-default choices. The published check covers 12 selected defaults with known credential behavior; it is not a catalog-wide credential audit.",
          links: [["Default credential check", "../data/default-credential-check/summary.md"], ["Security end to end", "../docs/user/security-end-to-end.md"]],
        },
        {
          status: "watch",
          question: "Does cub-direct remove resources that disappear during an upgrade?",
          answer:
            "Plain kubectl apply does not prune. The no-controller cub-direct path can orphan removed resources unless it uses kubectl apply --prune with a safe selector or allowlist, or another explicit delete-set. Argo CD and Flux can remove omitted objects only when pruning is enabled. Argo CD automated pruning is off by default; a Flux Kustomization uses spec.prune: true.",
          links: [["Prune gap proof", "../data/prune-gap-proof/summary.md"], ["Deployment path", "../docs/user/cub-deployment-path.md"], ["Argo CD pruning", "https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/#automatic-pruning"], ["Flux pruning", "https://fluxcd.io/flux/components/kustomize/kustomizations/#prune"]],
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
  <title>FAQ · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
	  <header class="hero human-hero">
	    ${topNav(".")}
	    <h1>Find a direct answer</h1>
	    <p class="lead">Use this FAQ when one question blocks your next step. It covers Helm compatibility, ConfigHub, hooks, CRDs, values, upgrades, free use, and current limits.</p>
    <p>Each answer says what works, what remains limited, and where to check the evidence.</p>
    ${humanLinks([["Try Redis", "./try.html"], ["Find chart setup", "./quirks.html"], ["Read known gaps", "./known-gaps.html"]])}
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
  <footer>Generated from helm-expt proof data. Each answer links to its supporting guide, result, or current gap.</footer>
</body>
</html>
`;
}

function knownGapsHtml(catalog) {
  const gaps = [
    [
      "Fixed placeholder credentials",
      "Blocks production use of those renders",
      "Some deterministic demo renders contain a fixed placeholder. A placeholder must never be presented as a generated production credential. The current check covers 12 selected defaults with known credential behavior, not the whole Catalog.",
      "Choose an existing-Secret configuration and supply your own Secret for real use.",
      "../data/default-credential-check/summary.md",
      "Permanent boundary: a placeholder never becomes a credential. The existing-Secret bases are the fix.",
    ],
    [
      "cub-direct no prune",
      "Plan around it",
      "Plain apply does not remove an object when it disappears from the desired configuration.",
      "Enable and verify pruning in Argo CD or Flux, or delete the object explicitly during the upgrade.",
      "../data/prune-gap-proof/summary.md",
      "Permanent boundary of plain apply. Argo CD and Flux pruning are the tested paths.",
    ],
    [
      "cub-direct CRD ordering",
      "Plan around it",
      "Kubernetes must establish a CRD before it can accept objects that use that CRD.",
      "Install and wait for the CRDs first, or use a tested Argo CD or Flux ordering path.",
      "../data/crd-ordering-gap/summary.md",
      "Permanent boundary of cub-direct. The ordered Argo CD and Flux paths are tested.",
    ],
    [
      "cub-scout drift field coverage",
      "Treat results as partial",
      "The current drift check finds changes to replicas and images, but it does not find every container environment-variable change.",
      "Treat the result as partial and inspect environment variables separately.",
      "../data/drift-detection-gap/summary.md",
      "Being extended. Environment-variable coverage is open work.",
    ],
    [
      "SSA conflict ergonomics",
      "Slows you down",
      "Server-side apply reports a conflict instead of silently overwriting a manual live edit, but the resolution workflow is still awkward.",
      "Stop and choose whether the live or desired value should win. Record the decision before retrying.",
      "../data/ssa-conflict-gap/summary.md",
      "Being improved. The conflict is correct; the resolution workflow is the work.",
    ],
    [
      "Helm-to-cub migration friction",
      "Slows you down",
      "cub safely rejects some normal Helm usage, but several error messages still do not explain the required change clearly.",
      "Use the migration guide. Keep using Helm for a case when the safe cub path is unclear.",
      "../data/helm-habit-friction/summary.md",
      "Being improved, message by message.",
    ],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Delivery Limitations · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Delivery limitations and known gaps</h1>
    <p class="lead">Check this page before choosing a delivery path. Each row names a current limitation, explains how it could affect a deployment, and gives the safest next step.</p>
    <p>A <code>watch</code> result means the path needs a decision or more work. It is not a pass, and it does not mean every use of the chart fails.</p>
    ${humanLinks([["Check one delivery result", "./verification.html"], ["See current results", "./proof.html"], ["Read FAQ", "./hard-questions.html"], ["Report a problem chart", "https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml"]])}
  </header>
  <main>
    <section aria-labelledby="gaps">
      <h2 id="gaps">1. Read the current delivery limits</h2>
      ${markdownLikeTable([
        ["Problem", "Severity", "What it means, and what to do now", "Fix or boundary", "Evidence"],
        ...gaps.map(([name, severity, body, action, href, disposition]) => [name, severity, `${body}<br><strong>Do now:</strong> ${action}`, disposition, `<a href="${href}">Open evidence</a>`]),
      ], { rawFifthColumn: true, rawThirdColumn: true })}
    </section>

    <section aria-labelledby="next">
      <h2 id="next">2. Check the exact chart and configuration</h2>
      <p>Open the chart page and find the configuration you plan to use. Follow any <code>watch</code> or <code>blocked</code> reason before you deploy it.</p>
      <p>Prune protection means that a delivery path deliberately keeps an existing object when it disappears from the next configuration. It does not protect a field from being changed.</p>
      <p>Use <a href="./hard-questions.html">FAQ</a> for a short answer. Use <a href="../docs/user/broken-chart-triage.md">Broken Chart Triage</a> when a render or install fails. Open the evidence link when you need the exact command and receipt.</p>
    </section>
  </main>
  <footer>Generated from helm-expt proof data. A watch finding names work or a decision that still remains.</footer>
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
  <title>Hooks And Actions · Config Workshop</title>
</head>
<body>
  <p>Hooks and lifecycle behavior are now covered in the Component Catalog as <a href="./charts/index.html#actions">hooks and actions</a>.</p>
</body>
</html>
`;
}

function privateHtml(catalog) {
  const tierRows = [
    ["Self-sign-up SaaS", "Use the hosted ConfigHub service with your team.", "Sign up online."],
    ["Standalone enterprise", "Run ConfigHub for private platforms and production operations.", "Contact ConfigHub about deployment and support."],
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
  <title>Private · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav("..")}
    <h1>Choose SaaS or enterprise ConfigHub</h1>
    <p class="lead">Use the public tools without ConfigHub Server for local work. Add a commercial ConfigHub product when your team needs to keep private configuration, review changes together, or operate releases over time.</p>
    <p>ConfigHub is available as a <a href="${confighubOutboundUrl(CONFIGHUB_SIGNUP_URL, "private")}">hosted service you sign up for yourself</a> and as a <a href="${confighubOutboundUrl(CONFIGHUB_ENTERPRISE_URL, "private")}">standalone enterprise product</a>.</p>
  </header>
  <main>
    <section aria-labelledby="why-upgrade">
      <h2 id="why-upgrade">1 · Decide whether you need an account</h2>
      <p>You do not need an account to try public catalog packages, inspect rendered objects, or run the public checks.</p>
      <p>Add ConfigHub when you want to save and share the reviewed result. It also adds environment versions, approvals, and operating history.</p>
    </section>

    <section aria-labelledby="tiers">
      <h2 id="tiers">2 · Choose SaaS or enterprise</h2>
      ${markdownLikeTable([
        ["Option", "Use it for", "Next step"],
        ...tierRows,
      ])}
    </section>

    <section aria-labelledby="journey">
      <h2 id="journey">3 · See what ConfigHub adds</h2>
      <p>The public tools produce configuration you can inspect and keep as files or OCI. ConfigHub keeps that configuration as shared data so a team can change, approve, promote, publish, and observe it.</p>
      ${markdownLikeTable([
        ["Need", "How ConfigHub helps"],
        ...workRows,
      ])}
    </section>

    <section aria-labelledby="commercial">
      <h2 id="commercial">4 · Review the product scope</h2>
      <p>These are the main commercial product areas for users who start with Helm, AICR, OCI, or Kubernetes YAML.</p>
      ${markdownLikeTable([
        ["Area", "Benefit"],
        ...commercialRows,
      ])}
      <p>Availability can differ between SaaS and enterprise editions. Check with ConfigHub for current product, support, policy, and service details.</p>
    </section>

    <section aria-labelledby="more">
      <h2 id="more">5 · Read the supporting detail</h2>
      <p>These project records explain support, commercial planning, no-server work, and the limits of current claims.</p>
      <div class="grid">
        <div class="card"><h3>Support tiers</h3><p><a href="../../docs/user/product-support-tiers.md">Open product support tiers</a>.</p></div>
        <div class="card"><h3>Commercial model</h3><p><a href="../../docs/planning/verified-install-commercial-model.md">Open verified-install commercial model</a>.</p></div>
        <div class="card"><h3>Serverless plan</h3><p><a href="../../docs/planning/serverless-verified-install-plan.md">Open serverless verified-install plan</a>.</p></div>
        <div class="card"><h3>Claims register</h3><p><a href="../../data/claims-register/summary.md">Open current claim boundaries</a>.</p></div>
      </div>
    </section>
  </main>
  <footer>Generated from helm-expt evidence. Check with ConfigHub for current product, support, policy, and service details.</footer>
</body>
</html>
`;
}

function demoOrgHtml(catalog) {
  const policyFacts = applyPolicyFacts();
  const sourceCoverage = policySourceCoverage(policyFacts);
  const keepRows = [
    ["bitnami/redis", "default, reuse-existing-secret", "An upgrade from 25.5.3 to 27.0.0 through reconciliation and promotion, while staging keeps its local change."],
    ["argo-cd/argo-cd", "default, no-crds", "The same chart with CRDs included or left for the cluster or another controller to manage."],
    ["hashicorp/vault", "dev-mode, default, ha-raft-ui", "Three operating configurations for one chart."],
    ["ingress-nginx/ingress-nginx", "default, internal-clusterip, admission-disabled", "Three ways to handle admission webhook certificate setup."],
    ["prometheus-community/prometheus", "default, server-only-ephemeral", "A small server-only configuration compared with the chart default."],
    ["prometheus-community/kube-prometheus-stack", "no-crds", "A complex chart with eight recorded lifecycle routes."],
    ["grafana/grafana", "existing-secret-ingress, static-passwords", "A target-provided Secret compared with the fixed shared-password demonstration."],
    ["bitnami/mysql", "existing-secret, static-passwords", "Compare an externally supplied Secret with the fixed shared-password demonstration. The static-passwords base is not safe for production."],
    ["bitnami/rabbitmq", "existing-secret, static-passwords", "A chart configuration with no separate lifecycle action to run."],
    ["bitnami/nginx", "http-clusterip, existing-tls-ingress", "Four environment configurations from one base, with one environment intentionally on an older version."],
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
  <title>Live ConfigHub Examples · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
    <header class="hero human-hero">
      ${topNav(".")}
      <h1>Explore the live ConfigHub demo</h1>
      <p class="lead">Open one Space in the <code>helm-catalog</code> demo org. Read its README, inspect the Kubernetes configuration, and look at its revision history.</p>
      <p>After that first example, use this page to explore environment variants, promotions, checks, hooks, and CRDs. The org contains ten charts chosen to explain those jobs.</p>
    ${humanLinks([["Open README index", "../data/helm-catalog-readmes/summary.md"], ["Browse Catalog", "./charts/index.html"], ["Build an App", "./journey.html"]])}
  </header>
  <main>
      <section aria-labelledby="readmes">
        <h2 id="readmes">1. Open one Space and read its README</h2>
        <p>A Space holds one saved configuration and its history. Every maintained example Space has one README that explains why the example exists, what to open, what it shows, and where to find the evidence.</p>
        <p>Open ${signupLink("demo-org-readmes", "hub.confighub.com")}, choose the <code>helm-catalog</code> org, and open a Space. Start with its README Unit.</p>
        <p>You can read the same material without signing in through the <a href="../data/helm-catalog-readmes/summary.md">demo org README index</a>.</p>
      ${markdownLikeTable([
        ["README kind", "Spaces"],
        ...readmeCountRows,
        ["total", String(readmeRows.length)],
      ])}
      <p class="quiet-line">Space counts as of ${escapeHtml(String(catalog.generatedAt).slice(0, 10))} (UTC), from the committed README data for the <code>helm-catalog</code> org.</p>
    </section>

      <section aria-labelledby="helpers">
        <h2 id="helpers">2. See the records that explain the configuration</h2>
        <p>Each maintained example includes the records needed to understand its source, inspect its Kubernetes objects, and see which checks apply. Hooks, CRDs, setup jobs, and other lifecycle records appear only when that configuration needs them.</p>
      ${markdownLikeTable([
        ["Helper", "What it answers", "When it is added"],
        ["One README", "Why does this Space exist, what should I open, and what does the example prove?", "Every maintained example"],
        ["Source and intent record", "Where did these objects come from, which choices produced them, what remains to be supplied, and which checks exist?", "Every maintained base"],
        ["Exact configuration objects", "What would ConfigHub review, change, approve, and deliver?", "Every maintained configuration Space"],
        ["Policy profile", "Which checks run before apply, and does this Space require approval?", "Every managed configuration Space"],
        ["Prerequisite and lifecycle records", "Who handles Secrets, CRDs, hooks, setup jobs, controller features, or target facts?", "Only when the exact configuration needs them"],
      ])}
        <p>The source and intent record answers one question: where did this configuration come from, and which choices produced it? Helm uses <code>HelmRenderIntent</code>. AICR, OCI, and plain YAML use records suited to their own source format.</p>
        <p>Today, that information may live in a source Unit, Space metadata with a receipt, or a generated base-variant record. ConfigHub does not yet have one source object that covers every format.</p>
        <h3>New examples follow the same rule</h3>
        <p>Every new maintained catalog example gets the common records above. It also gets the prerequisite and lifecycle records that apply to that exact configuration.</p>
        <p>An arbitrary upload does not gain facts that ConfigHub cannot know. Generic checks can attach automatically. The source adapter or a reviewed catalog addition must supply the source details and any chart-specific lifecycle work. Missing information remains a named gap.</p>
        <p>Temporary experiments and legacy Spaces are not counted as conforming until their common and applicable helper records pass the same checks. Read the <a href="./d/docs/reference/config-catalog-doctrine.html">catalog doctrine</a> for the full rule.</p>
    </section>

      <section aria-labelledby="config-as-data">
        <h2 id="config-as-data">3. Query and change the saved Kubernetes objects</h2>
        <p>A Helm chart produces Kubernetes objects, but its templates can hide the final answer to ordinary operating questions.</p>
        <ul>
          <li>Which namespaces are missing a policy?</li>
          <li>Who can read Secrets?</li>
          <li>What changed between staging and production?</li>
          <li>Where does a risky setting appear across the fleet?</li>
        </ul>
        <p>The demo org stores the rendered Kubernetes YAML as versioned Units in a Space. ConfigHub can search, compare, review, and deliver those Units. The README explains their source and the purpose of the Space.</p>
        <p>When you find a problem, you change the same object that you inspected. ConfigHub records that change as a revision before delivery.</p>
        <p>With cub v0.2.7 or later, you can query those stored objects across the org:</p>
        <p class="install-cub-note">New to <code>cub</code>? <a href="./try.html#install-cub">Install the cub CLI</a> first. Sign in and select the <code>helm-catalog</code> org before you run these commands.</p>
        <pre><code>cub k8s types --space "*"
cub k8s get deploy --space "*"
cub k8s get crd --space "*"</code></pre>
        <p class="quiet-line">These commands read desired configuration in ConfigHub. They do not read live cluster state.</p>
    </section>

      <section aria-labelledby="what">
        <h2 id="what">4. Choose another example by problem</h2>
        <p>Each row below starts with one supported Helm configuration stored as readable Kubernetes Units. Choose the problem you want to understand, then open that Space and its README.</p>
        <p>Each maintained example Space has a README, rendered objects, identifying labels, and policy tests. Helm preset Spaces also have a current <code>HelmRenderIntent</code> Unit. An example adds prerequisite, lifecycle, render-history, or test-result Units only when they help explain that configuration.</p>
      ${markdownLikeTable([
        ["Chart", "Base variants", "What this example demonstrates"],
        ...keepRows,
      ])}
        <p class="quiet-line">The org uses ten charts so each example can include variants, promotions, and supporting evidence. The <a href="./charts/index.html">catalog pages</a> retain 112 components and 139 exact package versions; the Top-100 entries carry the richer readiness evidence.</p>
    </section>

      <section aria-labelledby="exhibits">
        <h2 id="exhibits">5. Follow a change through variants and promotions</h2>
        <p>These worked examples show how one saved configuration changes over time. Open the named Spaces and inspect each Unit's Revisions tab. The components view groups the Spaces by chart.</p>
        <p><strong>The version ladder.</strong> Open <code>bitnami-redis-base</code>, <code>-staging</code>, and <code>-prod</code>. Staging has a local setting of two replicas. The base moved from chart 25.5.3 to 27.0.0, then the change was promoted. The staging revision history shows both the upgrade and the retained replica setting.</p>
        <p><strong>The fleet.</strong> Open the four <code>bitnami-nginx-fleet</code> Spaces for dev, staging, prod-us, and prod-eu. One base change was promoted to all environments. Prod-eu still reports one pending upstream Unit. Dev and staging keep local replica counts while receiving the shared image change. Both production Spaces require approval.</p>
        <p>The base also moved its NGINX image to an internal registry without changing the digest. The <a href="./d/docs/user/image-registry-migration.html">walkthrough and receipt</a> show the commands and revision history. This proves the stored ConfigHub records. It does not prove Kubernetes delivery.</p>
        <p><strong>The secrets story.</strong> The two mysql Spaces differ in exactly one decision: a staged external credential versus a generated one. Diff any unit across the pair to see precisely what the safer choice changes.</p>
        <p><strong>The CRD split.</strong> The two argo-cd Spaces show the chart with and without bundled CRDs. The no-crds Space states that the cluster owns them. A live test showed that applying custom resources before their CRDs fails. Applying CRDs first and waiting for them succeeds. The Space's <code>ProofReceipt</code> label links to that result.</p>
        <p><strong>The hooks.</strong> <code>hook-probe-base</code> contains a Job with visible Argo CD hook annotations. Argo CD and Flux each pulled the same OCI fixture and completed the Job. A separate direct local test did the same. The <code>ProofReceipt</code> and <code>DeliveryReceipt</code> labels link to the evidence.</p>
        <p><strong>Local changes and new releases.</strong> Open <code>hashicorp-vault-demo-base</code> and its dev, staging, and production variants. Dev added a cost label. Staging uses two replicas, and production uses three.</p>
        <p>The base later added telemetry and release-track annotations. Staging and production received them while keeping their replica settings. Dev had changed the same annotations map, so promotion kept the dev map and skipped the base annotations. Two recorded reconcile revisions added them afterward. The revision history shows both cases.</p>
        <p><strong>A staged rollout.</strong> Staging first received a real audience environment variable. The base later added the same variable as <code>confighubplaceholder</code> and added a shared issuer. Promotion kept staging's real value and delivered the issuer. The <code>vet-placeholders</code> policy prevents the placeholder from reaching a cluster.</p>
        <p>The promotion also copied the new <code>render-record</code> Unit from the base into staging. The <a href="https://github.com/confighub/helm-expt/tree/main/runs/promote-silent-skip-proof">promotion receipt</a> records the complete test.</p>
        <p><strong>Records for information ConfigHub does not yet model directly.</strong> ConfigHub does not yet have separate object types for source recipes, render events, links back to source, or lifecycle routes. The org keeps this information in ordinary Units, Links, and labels. Section 7 shows exactly where to find it.</p>
    </section>

      <section aria-labelledby="live-proof">
        <h2 id="live-proof">6. Check what ran on Kubernetes</h2>
        <p>These three examples ran on real clusters. Each receipt records the command, observations, result, and limit.</p>
        <p><strong>The hook delivery test.</strong> ConfigHub published one OCI bundle containing a ConfigMap and a migration Job. Argo CD and Flux pulled that artifact on separate throwaway kind clusters and completed the Job. A separate direct local test pulled the same artifact and completed the Job.</p>
        <p>This test covers one setup Job on one recorded test environment. It does not cover every chart, hook type, or production environment.</p>
        <p><strong>The CRD ordering test.</strong> Direct apply first tried to create a custom resource before its CRD was established. Kubernetes refused the custom resource with the recorded error. Applying the CRD first and waiting for it fixed the installation. A separate receipt records the chart-specific order through Argo CD and Flux.</p>
        <p><strong>The Kube Prometheus Stack lifecycle test.</strong> A direct run rendered catalog package 85.3.3 and verified its chart objects. It applied ten CRDs first, ran the certificate and webhook Jobs, tested the webhook and six workloads, then removed temporary Jobs. A second direct test upgraded that default package to 86.1.0 through the same ordered route and retained the admission Secret.</p>
        <p>Separate clusters ran the Argo CD and Flux paths. Each installed the 85.3.3 no-crds OCI and upgraded to 86.1.0. Both controllers replaced the completed setup Jobs and passed the runtime tests after upgrade. ConfigHub does not yet select this route automatically.</p>
      <p class="quiet-line">The receipts are committed in the repo (<a href="https://github.com/confighub/helm-expt/tree/main/runs/oci-hook-delivery-proof"><code>runs/oci-hook-delivery-proof</code></a>, <a href="https://github.com/confighub/helm-expt/tree/main/runs/crd-ordering-gap"><code>runs/crd-ordering-gap</code></a>, <a href="https://github.com/confighub/helm-expt/tree/main/runs/kps-lifecycle-route-proof"><code>runs/kps-lifecycle-route-proof</code></a>, <a href="https://github.com/confighub/helm-expt/tree/main/runs/kps-default-package-upgrade-proof"><code>runs/kps-default-package-upgrade-proof</code></a>, and <a href="https://github.com/confighub/helm-expt/tree/main/runs/kps-gitops-lifecycle-proof"><code>runs/kps-gitops-lifecycle-proof</code></a>) and summarized under <code>data/</code>. Each throwaway cluster was deleted after its run.</p>
    </section>

      <section aria-labelledby="sketches">
        <h2 id="sketches">7. See how hooks, CRDs, and source records are represented</h2>
        <p>The demo org uses ordinary Units, Links, and labels to record source details and lifecycle work. ConfigHub does not yet model these as separate product objects.</p>
        <p>You can inspect and query these records, but they are working examples rather than new ConfigHub entities.</p>
      ${markdownLikeTable([
        ["Question", "What ConfigHub stores today", "Demo record", "Where to look"],
        ["Which source and choices produced this configuration?", "An ordinary Unit containing the chart, version, values, and required setup. ConfigHub does not yet recognize it as a separate source type.", "The recipe Unit in every chart Space", "Open any chart Space, then open the recipe Unit's Data tab"],
        ["What was rendered, when, and which Units were produced?", "The installer renders on the client, so ConfigHub receives the finished Units but no native render event.", "A render-record Unit with the chart, configuration, renderer, time, and output count", "Open the render-record Unit in hashicorp-vault-demo-base"],
        ["How do rendered objects link back to their source?", "Links currently describe apply order, not source history.", "One example rendered-from-recipe Link. The render-record covers the full object set.", "Open the links for statefulset-vault-vault in hashicorp-vault-demo-base"],
        ["What must happen around the ordinary objects?", "Ordinary Units and labels hold the hook, CRD, setup, and target decisions. ConfigHub has no native lifecycle-route object yet.", "Eight LifecycleRoute Units with the phase, executor, alternatives, evidence, and delivery results", "Open route-sketch-kube-prometheus-stack"],
      ])}
        <p>Each record matches committed repo data. The top-level chart route remains <code>automatic: false</code>. Direct, Argo CD, Flux, and upgrade implementations have separate evidence.</p>
      <h3 id="kps-routes">Eight kube-prometheus-stack lifecycle steps</h3>
      <p>A lifecycle record describes work that ordinary rendered objects do not perform. Five records come from Helm hook behavior. The remaining three cover CRD order, target facts, and webhook readiness.</p>
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
        <h2 id="checks">8. See which checks can stop an apply</h2>
        <p>Every policy-covered Space has ${policyFacts.baselineChecks} common tests. Schema, placeholder, and lifecycle tests can stop incomplete configuration. Workloads and AICR training runtimes receive tests for the fields they use. Production releases and system configuration also require approval before apply.</p>
      ${markdownLikeTable([
        ["Where", "Can block apply", "Warns without blocking"],
        ["Every policy-covered Space", "Invalid schema; unresolved placeholder; an attached lifecycle route that lacks its required scope or evidence", "An ordinary workload image without a digest; a long-running workload without declared readiness and liveness probes"],
        ["AICR training configuration", "An AI API key written directly instead of referring to a named Secret", "A training image without a digest"],
        ["Production and system configuration", "All applicable checks above, plus one recorded approval", "All applicable warnings above"],
      ])}
        <p>The lifecycle check validates a route that is present. It does not guess that a missing route means no lifecycle work exists. The source and intent record and chart review must first identify any hooks, CRDs, setup jobs, or target prerequisites.</p>
        <p>The same policy can cover Helm, AICR, Kubara, Sveltos, or ordinary YAML after ConfigHub stores the objects.</p>
        <p>The live org has ${policyFacts.baselineSpaces} Spaces on common tests and ${policyFacts.approvalSpaces} on the approval policy. The approval set contains ${policyFacts.productionSpaces} production Spaces and ${policyFacts.systemConfigurationSpaces} system-configuration Spaces. These Spaces include ${sourceCoverage}. Each records its policy profile and starting format.</p>
        <p><code>npm run helm-org:verify</code> and <code>npm run helm-org:policy:verify</code> compare the live org with committed catalog and policy receipts.</p>
        <p class="quiet-line">The builder and receipts live under <a href="https://github.com/confighub/helm-expt/tree/main/data/helm-org"><code>data/helm-org/</code></a>. The org is named <code>helm-catalog</code> and is member-visible today. Other readers can use the committed receipts, these pages, and the walkthroughs.</p>
    </section>

      <section aria-labelledby="next">
        <h2 id="next">9. Repeat the pattern with your own app</h2>
        <p>You can use the same steps for your own application. Upload it, create staging and production variants, promote a change, then deliver it through OCI. Your existing GitOps controller can apply the result.</p>
        <p>The <a href="./variants.html">Variants page</a> explains where each change belongs. The <a href="./d/docs/user/variants-after-upload.html">command walkthrough</a> shows how to create and promote variants. The <a href="./journey.html">Apps page</a> explains how to combine your applications with catalog components.</p>
    </section>
  </main>
  <footer><p>Generated from committed helm-expt evidence and the committed org receipts. The demo org shows the mechanism; production claims still come only from receipts.</p></footer>
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
  <title>Private · Config Workshop</title>
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
    ["An imported application", "An application first found in Argo, Flux, rendered YAML, a Helm release, or a live cluster, then saved in ConfigHub."],
  ];
  const appFlow = [
    ["Choose saved configuration", "Select the component, base, and environment variant that the App will operate."],
    ["Show the proposed change", "Turn the request into exact Kubernetes object changes that a reviewer can read."],
    ["Run the checks", "Scan the changed objects, stopping wherever a required check or approval is still missing."],
    ["Publish the release", "Create the approved OCI release for Argo CD, Flux, or another delivery path."],
    ["Check the result", "Compare the desired objects with what the cluster reports and record the outcome."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Build a ConfigHub App · Config Workshop</title>
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
    <h1>Build an App from saved configuration</h1>
  <p class="boundary-chip">Needs a ConfigHub account</p>
    <p class="lead">Use this page after configuration is saved in ConfigHub. An App performs one repeated job, such as reviewing an upgrade, checking RBAC, or rolling a platform change across clusters.</p>
  <p>Configuration gets saved by uploading it from an <a href="./testing.html">example</a> or your own package, which needs a free ConfigHub account. Nothing on this page works before that upload, and everything works after it.</p>
    <p>New to ConfigHub? Follow the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "apps")}">official tutorial</a> to install, change, and promote one component. Use the <a href="./testing.html">Examples page</a> when your starting point is Helm, AICR, OCI, or YAML.</p>
    <p>An App reads the exact Kubernetes objects and proposes a change. It runs the checks, waits for approval, then publishes a release and records what happened. AI can help along the way, while the reviewed objects and the policy result decide what ships.</p>
    <p class="quiet-line"><a href="./demo-org.html">The demo org</a> shows catalog configurations, variant trees, promotions, and apply gates in ConfigHub.</p>
  </header>
  <main>
    <section aria-labelledby="app-kinds">
      <h2 id="app-kinds">1. Confirm what the App operates</h2>
      <p>An application is the set of Kubernetes objects your team operates together. That might be one chart, several charts, or your own files, and it can be imported from a system you already run.</p>
      ${markdownLikeTable([
        ["Kind", "Meaning"],
        ...appKinds,
      ])}
    </section>

    <section aria-labelledby="entry">
      <h2 id="entry">2. Confirm the configuration is saved</h2>
      <p>An App operates configuration that ConfigHub already stores. You should be able to open the component, base, environment variant, and exact Kubernetes objects before the App proposes a change.</p>
      <p>If the configuration is not saved yet, use <a href="./testing.html">Examples</a> to start from Helm, AICR, or YAML. If the application already runs in Argo CD, Flux, or a cluster, follow <a href="./existing-apps.html">Record an existing application</a> to inspect it before upload.</p>
      <p>The <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "apps-saved-config")}">official tutorial</a> shows the shortest ConfigHub path from one component to a promoted variant.</p>
    </section>

    <section aria-labelledby="app-flow">
      <h2 id="app-flow">3. Follow the normal order</h2>
      <p>Start from the saved objects and show the proposed change. Run the required checks, publish the approved release, then check what happened on the cluster.</p>
      <div class="app-flow">
        ${appFlow.map(([title, body]) => `<div class="app-step"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`).join("\n        ")}
      </div>
    </section>

    <section aria-labelledby="examples">
      <h2 id="examples">4. See common uses</h2>
      ${markdownLikeTable([
        ["Example", "What ConfigHub helps with"],
        ["Redis app", "One public chart can be rendered from a base variant, checked, changed for each environment, and released again."],
        ["Prometheus or kube-prometheus-stack", "A chart with CRDs, webhooks, and prerequisites can use base variants that say what the target must provide before release."],
        ["Platform services", "Ingress, certificates, policy, monitoring, and logging can be grouped with the application that depends on them."],
        ["Your service plus chart services", "Your own service can sit beside a database, queue, cache, or monitoring chart."],
        ["Existing app", "An application already in a cluster can be inventoried first, then brought under review when you are ready."],
        ["AI-suggested change", "AI can propose a values change or file edit. ConfigHub shows the exact diff and checks before it is approved."],
      ])}
      <p>The <a href="../data/redis-upgrade-app-proof/summary.md">Redis upgrade and rollback proof</a> follows one complete run from chart 25.5.3 to 27.0.0 and back. A two-replica edit stays in place while the candidate moves through development and staging. Two Argo CD clusters run the candidate and rollback OCI releases.</p>
      <p>The <a href="../data/rbac-review-live-proof/summary.md">RBAC review proof</a> starts with a service account that can read Secrets unnecessarily. It records one precise correction in ConfigHub, requires approval, publishes the approved objects as OCI, and lets Argo CD deliver them to an isolated cluster. Secret access is gone while ConfigMap access still works.</p>
      <p>Component and chart evidence still lives in the Component Catalog. This page explains how those components become part of applications your team runs.</p>
    </section>

    <section aria-labelledby="app-program">
      <h2 id="app-program">5. Open the working demonstrations</h2>
      <p>Each row has one checked example with committed evidence. The final column says what is still needed before the same result can be offered more generally.</p>
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
    ["Variant", "One named configuration of that component: base, dev, staging, prod-us, prod-eu, or customer-a."],
    ["Base variant", "A configuration rendered from Helm. Use it when values, chart version, CRDs, storage, HA mode, or Secret strategy change the Kubernetes objects."],
    ["Derived variant", "A ConfigHub configuration made from an existing base. Use it for environment, region, target, labels, approvals, and scoped post-render changes."],
    ["Promotion", "A controlled way to carry a reviewed change from one variant to another, with a preview before anything is applied."],
  ];
  const journeyRows = [
    ["Choose a base", "Pick the closest tested configuration from the chart page."],
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
  <title>Where a change belongs · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Decide where a change belongs</h1>
  <p class="boundary-chip">Needs a ConfigHub account</p>
    <p class="lead">Use this page after a Helm chart has become a shared base in ConfigHub. It answers one question: should a change rebuild the base, or belong to one environment?</p>
  <p>A chart becomes a shared base when you upload its reviewed render, which needs a free ConfigHub account. The <a href="./testing.html">examples page</a> shows the upload; come back here once it has run.</p>
    <p>A variant is one named configuration of the same component, such as development, staging or production, and it can equally be a region or a customer.</p>
    <p>If the change affects what Helm renders, change the Helm source and rebuild the base. If it changes one environment after render, use a derived ConfigHub variant.</p>
  </header>
  <main>
    <section aria-labelledby="model">
      <h2 id="model">1. See the model</h2>
      <p>A component is the software being shipped. A variant is one named configuration of that component.</p>
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
      <p>The team can then answer four questions. Which configuration are we using, where did it come from, what changed, and is it safe to promote?</p>
    </section>

    <section aria-labelledby="choose">
      <h2 id="choose">2. Decide where the change belongs</h2>
      <p>Ask whether Helm would render different Kubernetes objects. That one question decides where the change belongs.</p>
      ${markdownLikeTable([
        ["Action", "Use it when", "Examples"],
        ...routeRows,
      ])}
    </section>

    <section aria-labelledby="journey">
      <h2 id="journey">3. Follow a safe flow</h2>
      <p>A good variant flow stays plain. Choose the base, name the variants that exist in the real world, preview the change, then promote only what was reviewed.</p>
      ${markdownLikeTable([
        ["Step", "What happens"],
        ...journeyRows,
      ])}
      <p>Today you use <code>cub installer</code>, <code>cub variant create</code>, Unit diffs, and <code>cub variant promote</code>. The same changes remain available for review in ConfigHub.</p>
      <p>For the exact commands with the why behind each flag, read <a href="../docs/user/variants-after-upload.md">After upload: create a variant and promote changes</a>. It starts where a base variant's <code>confighub.sh</code> ends.</p>
    </section>

    <section aria-labelledby="flow">
      <h2 id="flow">4. Run the commands</h2>
      <pre><code>cub installer setup --pull ${REDIS_INSTALLER_PINNED_OCI_REF} --base reuse-existing-secret --work-dir ./redis-reviewed
cub installer upload --work-dir ./redis-reviewed --space helm-redis-base
cub variant create prod-us-east helm-redis-base --environment Prod --region us-east --target prod/prod-us-east
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
      <h2 id="examples">5. Open worked examples</h2>
      <p>These examples show the same rule in different chart shapes.</p>
      ${markdownLikeTable([
        ["Example", "What it shows", "Open"],
        ...exampleRows.map(([name, body, path]) => [name, body, `<a href="${path}">${escapeHtml(name)}</a>`]),
      ], { rawThirdColumn: true })}
    </section>

    <section aria-labelledby="more">
      <h2 id="more">6. Read the details</h2>
      <p><a href="../docs/user/creating-variants.md">Creating variants</a> explains the rules. <a href="../docs/user/cub-variant-command-surface.md">cub variant commands</a> lists the current commands. <a href="../data/variant-promotion/summary.md">Variant promotion receipts</a> show the current evidence.</p>
    </section>
  </main>
  <footer>Generated from helm-expt catalog data. Base variants are render-time choices; derived variants are post-render ConfigHub refinements.</footer>
</body>
</html>
`;
}

function customAppsHtml(catalog) {
  const pieceRows = [
    ["Public chart", "Start from a tested Catalog configuration when one fits.", "The upstream Helm source remains visible."],
    ["Your service", "Store its Kubernetes objects beside the chart objects.", "The complete application can be reviewed and released together."],
    ["Wrapper chart or values overlay", "Update the recorded Helm source when it changes the render.", "ConfigHub can show which base render produced the objects."],
    ["Environment or customer setting", "Use a ConfigHub variant when the change happens after render.", "Each environment keeps a small, visible difference from its base."],
    ["Purpose-built App", "Use a focused tool when direct YAML editing is too broad.", "The App can provide domain checks, previews, and an explicit commit step."],
    ["Private source", "Use a managed ConfigHub path for private inputs and production responsibility.", "Access, support, and operational history stay with the team."],
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
  <title>Combine Charts And Your Service · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Combine charts and your own service</h1>
    <p class="lead">Use this page when one application includes public charts, Kubernetes objects your team owns, and settings for several environments.</p>
    <p>ConfigHub stores those objects together. Your team can review, change, promote, and release the complete application without losing each component's source.</p>
    ${humanLinks([["See App examples", "./testing.html#apps"], ["Build an App", "./journey.html"], ["Learn ConfigHub", "./confighub.html"]])}
  </header>
  <main>
    <section aria-labelledby="map">
      <h2 id="map">1. Decide where each piece belongs</h2>
      <p>A change to Helm values belongs in the recorded Helm source and produces a new base render. A change to saved Kubernetes objects belongs in a ConfigHub variant. Keep private source and production responsibility in a managed workflow.</p>
      ${markdownLikeTable([
        ["Piece", "Where it belongs", "Why"],
        ...pieceRows,
      ])}
    </section>

    <section aria-labelledby="day">
      <h2 id="day">2. Start new, or record what already runs</h2>
      <p>For a new application, render the chart configurations, add your service objects, upload the complete set, and create the first environment variant.</p>
      <p>For an existing application, first record its current objects and compare them with the desired configuration. Make the first managed change only after the two match or the intended difference is clear.</p>
      <p>A purpose-built App can help with one domain. For example, an RBAC App can answer access questions and propose guarded edits without giving an agent unrestricted YAML access.</p>
    </section>

    <section aria-labelledby="proof">
      <h2 id="proof">3. Open working examples</h2>
      ${markdownLikeTable([
        ["Example", "What it shows", "Open"],
        ...proofRows.map(([name, body, path]) => [name, body, `<a href="${path}">Open ${escapeHtml(name)}</a>`]),
      ], { rawThirdColumn: true })}
    </section>
  </main>
  <footer>Generated from helm-expt catalog data. Public charts and owned services can form one release while keeping their sources visible.</footer>
</body>
</html>
`;
}

function existingAppsHtml(catalog) {
  const routes = [
    ["Argo CD or Flux app", "Record its source, rendered objects, namespace, health, and sync state.", "Keep controller delivery unchanged while you compare the saved configuration."],
    ["Rendered YAML", "Group the files that belong to one application and list their objects.", "Check names, namespaces, Secrets, CRDs, and hooks before ConfigHub manages them."],
    ["Live cluster", "Record what is running, who owns it, what changed, and which cluster services it needs.", "Treat live state as evidence. Do not automatically make it the desired configuration."],
    ["Helm release", "Record the chart, version, values, release name, and rendered objects.", "Decide whether the first ConfigHub base must match it exactly or contain an intended change."],
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
  <title>Understand An Existing App · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Understand an existing app before changing it</h1>
    <p class="lead">Use this page when an application already runs through Helm, Argo CD, Flux, or Kubernetes YAML. Start read-only and record what exists.</p>
    <p>After the current objects and their owners are clear, decide which configuration ConfigHub should keep and which delivery system should remain in control.</p>
    ${humanLinks([["Choose a starting point", "#start"], ["See worked examples", "./testing.html"], ["Learn ConfigHub", "./confighub.html"]])}
  </header>
  <main>
    <section aria-labelledby="start">
      <h2 id="start">1. Start from the system that owns it today</h2>
      <p>Existing systems carry history. Old chart versions, local patches and hand-created Secrets accumulate, and so do controller-generated fields and cluster-specific assumptions. ConfigHub makes those facts visible before it tries to manage anything.</p>
      <p>The first safe outcome is an inventory and a comparison, which is why nothing is deployed at this stage.</p>
      ${markdownLikeTable([
        ["Starting point", "What to record first", "What stays unchanged"],
        ...routes,
      ])}
    </section>

    <section aria-labelledby="checklist">
      <h2 id="checklist">2. Record the facts before making a change</h2>
      ${markdownLikeTable([
        ["Check", "Why it matters"],
        ...checks,
      ])}
    </section>

    <section aria-labelledby="next">
      <h2 id="next">3. Choose the first managed step</h2>
      <div class="grid">
        <div class="card"><h3>Bring a CI-rendered catalog</h3><p>If your CI already renders charts into YAML in git, land those exact files as governed data. The receipt shows nothing is lost, and your reconciler keeps pulling the same way.</p><p><a href="d/docs/user/ci-rendered-catalog-journey.html">Follow the recorded journey</a></p></div><div class="card"><h3>Match the current app</h3><p>Capture Helm's status, values and manifest, along with its hooks and history. Then create or select a base that matches the reviewed object set.</p><p><a href="../docs/user/existing-helm-release-diagnostic.md">Check an existing Helm release</a> &middot; <a href="../docs/user/adopting-existing-apps.md">Existing app guide</a></p></div>
        <div class="card"><h3>Create a managed variant</h3><p>Once you trust the base, a derived variant carries the refinements for one environment, region or customer.</p><p><a href="./variants.html">Variants</a></p></div>
        <div class="card"><h3>Move into operations</h3><p>After upload, scans and approvals run against the stored objects, and the operations records follow from there.</p><p><a href="./operations.html">Operate saved configuration</a></p></div>
      </div>
    </section>
  </main>
  <footer>Record and compare the current application before ConfigHub changes or delivers it.</footer>
</body>
</html>
`;
}

function aiHtml(catalog) {
  const taskRows = [
    ["Find a known answer", "What will bitnami/redis 25.5.3 install, and what must exist first?", "The exact Catalog version, objects, lifecycle work, checks, and limits."],
    ["Check my configuration", "Here is the chart and values my AI produced. Compare them with the defaults and tell me what matters.", "A local render, normalized comparison, findings, and a reviewed result you can keep."],
    ["Review a promotion", "Can I move this staging configuration to production?", "Current and candidate digests, destination differences, lifecycle work, and tests still required."],
    ["Inspect another source", "Build the retained Timoni Redis 8.10.1 source and tell me what plain YAML leaves out.", "The module digest, typed options, seven exact objects, ordered lifecycle, and current limits."],
  ];
  const catalogRows = [
    ["Read source behavior", "Inspect versions, values or typed options, templates, generated objects, hooks, CRDs, tests, waits, prerequisites, and destination assumptions."],
    ["Propose useful configurations", "Suggest chart-specific or source-specific starting choices. The generator and recorded checks decide what enters the Catalog."],
    ["Investigate failures", "Separate input errors, missing target setup, lifecycle work, controller results, and workload health."],
    ["Maintain explanations", "Turn exact records and receipts into short instructions while keeping links to the underlying evidence."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI with review and evidence · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Use Config Workshop with your AI agent</h1>
    <p class="lead">Give Claude, Codex, or another coding agent one configuration question. The Config Workshop skill finds exact Catalog records and the lifecycle work to check. It returns a result you can review.</p>
    <p>The agent may propose commands or changes, and you see the source, the Kubernetes objects and the diff before any of it is applied or uploaded. The checks and the stated limits come with it.</p>
  </header>
  <main>
    <section aria-labelledby="install-skill">
      <h2 id="install-skill">1. Install the Config Workshop skill</h2>
      <p>Install it in the project where your agent is working. The open Agent Skills installer supports Codex, Claude Code, Cursor, and other coding agents.</p>
      <pre><code>npx skills add https://github.com/confighub/helm-expt/tree/main/skills/config-workshop</code></pre>
      <p>You can also <a href="./.well-known/agent-skills/config-workshop/SKILL.md">read the skill first</a>. It holds no credentials and applies nothing. Private files stay on your machine and Secret values are redacted. It pins versions and digests, reports any check it skipped, and previews a change before making it.</p>
    </section>

    <section aria-labelledby="tasks">
      <h2 id="tasks">2. Ask for one result</h2>
      <h3 id="four-ai-questions">Keep the four answers separate</h3>
      <p>An agent helps at every stage, though it cannot supply the input a stage needs. Tell it to report missing work as blocked or not run, rather than promoting a nearby result into a pass.</p>
      ${markdownLikeTable([
        ["Question", "What AI can do", "Required input"],
        ["What do I have?", "Read and explain a source, snapshot, package, or exact object set.", "The material to inspect. A Catalog entry is optional."],
        ["What will it produce?", "Run the source-native tool, retain its inputs, and compare the exact output.", "The source and intent. A destination is optional."],
        ["Can this destination accept it?", "Run checks against current APIs, CRDs, Secrets, policies, controllers, credentials, and hardware.", "The exact candidate and access to the named destination."],
        ["Did it work?", "Read controller, resource, workload, runtime, drift, and rollback evidence.", "The exact revision must have been deployed, and the required live check must have run."],
      ])}
      <p>For AICR, <code>snapshot</code> and <code>diff</code> inspect existing GPU nodes without a recipe or Catalog match. A recipe-dependent <code>expected-resources</code> check applies only after those components have been deployed.</p>
      <p>Start with the job in front of you. Include the exact version or digest when you know it.</p>
      ${markdownLikeTable([
        ["Task", "Example request", "What the agent should return"],
        ...taskRows,
      ])}
      <p><a href="./ask.html">Check my config</a> builds a local prompt and browser review. <a href="./promote.html">Promote my config</a> compares current and proposed objects. Neither page uploads your files.</p>
      <p><strong>For an upgrade or environment move:</strong> open <a href="./promote.html">Promote my config</a>, compare the two object sets, download the promotion review, and copy its AI review prompt. The prompt keeps the destination checks and tests that have not run in the answer.</p>
      <p>After the source tool writes Kubernetes YAML, the agent can run the same released local checker a person uses:</p>
      <pre><code>${CHECK_PLUGIN_INSTALL_COMMAND}
${CHECK_RENDERED_FILES_COMMAND}</code></pre>
      <p><code>cub check</code> is advisory and does not apply configuration. The agent must keep its result with the exact object digest and list target or live checks that did not run.</p>
    </section>

    <section aria-labelledby="records">
      <h2 id="records">3. Keep the answer tied to records</h2>
      <p>The skill reads the same public files as the site, and treats page copy or an agent's explanation as neither.</p>
      ${markdownLikeTable([
        ["Record", "What it answers"],
        ["changes.json", "Which exact Helm package version and digest did you ask about, and which areas have evidence?"],
        ["base-variant-records.json", "Where did the configuration come from, which exact objects were produced, and what lifecycle, ownership, OCI, and delivery records exist?"],
        ["review and promotion records", "Which files were compared, which checks ran, and what remains before the result moves?"],
        ["linked receipts", "What command or live run produced a claim, for which object digest and target?"],
      ])}
      <p>Missing coverage means the claim is unchecked. A successful render proves the objects are well formed, while cluster admission, controller convergence and workload health remain open, along with upgrade and rollback.</p>
    </section>

    <section aria-labelledby="sources">
      <h2 id="sources">4. Use the same steps across source formats</h2>
      <p>Helm renders a chart. Timoni builds a module or bundle. AICR and Kubara compose or generate configuration. Literal YAML and configuration OCI already contain exact objects. Config Workshop records which operation happened instead of calling every source a Helm recipe.</p>
      ${markdownLikeTable([
        ["Step", "Question"],
        ["Source and intent", "Which source, version, digest, values or typed choices, and target assumptions were selected?"],
        ["Materialize", "Which exact Kubernetes objects did that source produce?"],
        ["Flatten", "Can those objects be kept literally without losing behavior?"],
        ["Lifecycle and route", "Who handles hooks, CRDs, tests, waits, setup Jobs, Secrets, and destination requirements, and in what order?"],
        ["Retain and deliver", "Will the reviewed result stay as files, become OCI, or be kept as ConfigHub data and released through Argo CD or Flux?"],
      ])}
      <p><a href="./.well-known/agent-skills/config-workshop/references/processing-model.md">Read the agent processing model</a> · <a href="./deployment-reference.html">Read the human deployment reference</a></p>
    </section>

    <section aria-labelledby="timoni-example">
      <h2 id="timoni-example">5. Compare one non-Helm source</h2>
      <p>The first Timoni entry retains Redis 8.10.1 at an immutable module digest. It records the typed options, selected defaults, seven exact Kubernetes objects, the master-first apply order, the optional test Job, and the destination requirements.</p>
      <p>The current record proves a local, cluster-free build, an anonymous pull of the immutable public OCI, and a ConfigHub base with a linked development variant. It does not claim a Kubernetes apply, health check, upgrade, rollback, or GitOps delivery.</p>
      <p><a href="../examples/timoni/redis-8-10-1/README.md">Open the Timoni Redis record</a> · <a href="../data/helm-catalog-readmes/spaces/timoni-redis-8-10-1-base/README.md">Read the ConfigHub base guide</a> · <a href="../data/helm-catalog-readmes/spaces/timoni-redis-8-10-1-dev/README.md">Read the development variant</a> · <a href="../data/timoni-redis-catalog-proof/summary.md">Check the proof and limits</a> · <a href="./charts/index.html?q=redis#charts">Compare it with Helm Redis configurations</a></p>
    </section>

    <section aria-labelledby="confighub-review">
      <h2 id="confighub-review">6. Upload a reviewed result into ConfigHub</h2>
      <p>Use ConfigHub when the accepted objects need team history, approvals, and comparison with live systems. The handoff should keep the same object digest visible before and after upload.</p>
      <p>One recorded AICR example starts with an unsafe proposal: too many H100 nodes, a mutable image, and an inline API key. ConfigHub stores the corrected object, runs the applicable checks, and requires approval before an OCI dry run. It does not claim the target-specific GPU limit was enforced by the same policy.</p>
      <p><a href="../data/ai-change-review-live-proof/summary.md">Read the checked result and its limits</a> · <a href="./confighub.html">Continue with ConfigHub</a></p>
    </section>

    <section aria-labelledby="catalog-maintenance">
      <h2 id="catalog-maintenance">7. How agents help maintain the Catalog</h2>
      <p>Agents read source behaviour, propose starting configurations and generate checks. They also investigate failures and explain receipts. Whatever they write is reviewed against committed data before it appears as a Catalog claim.</p>
      ${markdownLikeTable([
        ["Agent task", "Required record"],
        ...catalogRows,
      ])}
      <p><a href="../data/agent-skill-evaluations/summary.md">Read the fresh-agent evaluation</a> · <a href="./verification.html">Run the verification commands</a> · <a href="./guides.html">Open technical guides</a></p>
    </section>
  </main>
  <footer>Use AI to investigate and propose. Keep the reviewed configuration as the release record.</footer>
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
  <title>Review Security Before Release · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Review security before release</h1>
    <p class="lead">Use this page to see where security checks fit. The public Catalog reports what a chart does rather than certifying it as secure.</p>
    <p>It gives you the exact Kubernetes objects, their source, and the checks recorded against them. Your team makes the security decision and keeps it with the same object set.</p>
    ${humanLinks([["Read known gaps", "./known-gaps.html"], ["See current results", "./proof.html"], ["Open security guide", "../docs/user/security-end-to-end.md"]])}
  </header>
  <main>
    <section aria-labelledby="why">
      <h2 id="why">1. Inspect the objects and their source</h2>
      <p>Helm values hide security choices that only show up once the chart is rendered. Generated passwords, broad RBAC and privileged containers are the common ones. Image tags, CRDs, webhooks and controller behaviour hide there too.</p>
      <p>Review those choices in the rendered objects. ConfigHub can keep the recorded decision with the same object set.</p>
    </section>

    <section aria-labelledby="controls">
      <h2 id="controls">2. Apply checks before delivery</h2>
      ${markdownLikeTable([
        ["Area", "What to record or check"],
        ...rows,
      ])}
    </section>

    <section aria-labelledby="limits">
      <h2 id="limits">3. Read the limits of each result</h2>
      <p>Some evidence is partial by design. A digest proves integrity inside a known trust chain, and says nothing outside one. A scan finding still needs a human decision. A clean render tells you the objects are well formed, while cloud identity, storage and runtime policy at the target remain unchecked.</p>
      <div class="grid">
        <div class="card"><h3>Security guide</h3><p><a href="../docs/user/security-end-to-end.md">Open security end to end</a></p></div>
        <div class="card"><h3>Known caveats</h3><p><a href="../data/cub-adoption-caveats/summary.html">Open per-chart cub adoption caveats</a></p></div>
        <div class="card"><h3>Claims register</h3><p><a href="../data/claims-register/summary.md">Open backed, partial, planned, and refused claims</a></p></div>
      </div>
    </section>
  </main>
  <footer>A security result applies only to the objects, checks, and target scope named by its evidence.</footer>
</body>
</html>
`;
}

function catalogPathfinderHtml(root) {
  const href = (path) => `${root}/${path}`;
  return `<section aria-labelledby="catalog-paths">
      <h2 id="catalog-paths">1 · Choose your path</h2>
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
        ["Deliver", `<a href="${href("operations.html#ops")}">Publish OCI for Argo CD or Flux; test the same artifact locally</a>`],
        ["Operate", `<a href="${href("operations.html#fleet-record")}">Track changes and live results across a fleet</a>`],
        ["Build an App", `<a href="${href("journey.html#app-program")}">Use saved configuration for a repeated operational job</a>`],
      ], { rawSecondColumn: true })}
    </section>`;
}

function loadKubaraSiteFacts() {
  const parity = readYaml(join(repoRoot, "examples", "kubara", "current-platform", "catalog-parity-receipt.yaml"));
  const generation = readYaml(join(repoRoot, "examples", "kubara", "current-platform", "generation-receipt.yaml"));
  const coverage = readYaml(join(repoRoot, "data", "kubara-catalog-1.1-full-coverage", "receipt.yaml"));
  const contract = readYaml(join(repoRoot, "data", "kubara-release-acceptance", "contract.yaml"));
  const matrix = JSON.parse(readFileSync(join(repoRoot, "data", "kubara-platform-matrix", "matrix.json"), "utf8"));
  const wiring = JSON.parse(readFileSync(join(repoRoot, "data", "kubara-wiring", "graph.json"), "utf8"));
  const miniIdpPath = join(repoRoot, "runs", "kubara-mini-idp-reconcile", "receipt.yaml");
  const miniIdp = existsSync(miniIdpPath) ? readYaml(miniIdpPath) : null;
  const reconcileRuns = miniIdp?.spec?.reconcileRuns ?? [];
  const noOpRun = [...reconcileRuns].reverse().find((run) => run?.result === "pass" && run?.idempotentNoop === true && Number(run?.actionCount) === 0);
  const selectorReplacements = miniIdp?.spec?.immutableSelectorReplacements ?? [];
  const generatedFiles = Number(parity.spec?.comparison?.fileCount ?? 0);
  const live = evaluateKubaraSiteLiveEvidence({ root: repoRoot });
  return {
    generatedFiles,
    renders: Number(generation.spec?.platform?.renderCount ?? 0),
    clusters: Number(contract.spec?.adoption?.clusters ?? 0),
    roles: Number(contract.spec?.adoption?.selectedPlatformRoles ?? 0),
    applications: contract.spec?.adoption?.applications ?? [],
    matrixCells: Number(contract.spec?.adoption?.desiredMatrixRows ?? 0),
    curatedLinks: Number(contract.spec?.adoption?.reconcilerPlan?.needsProvidesLinks ?? 0),
    catalogComponents: Number(coverage.spec?.finalCatalog?.componentCount ?? coverage.status?.finalComponentCount ?? 0),
    catalogVersions: Number(coverage.spec?.finalCatalog?.versionCount ?? coverage.status?.finalVersionCount ?? 0),
    selections: coverage.spec?.selections?.length ?? 0,
    wiringFacts: Number(wiring.spec?.summary?.facts ?? 0),
    noOpReadCommands: Number(noOpRun?.performance?.confighub?.reads?.commands ?? 0),
    noOpSubprocessCalls: Number(noOpRun?.performance?.subprocesses?.calls ?? miniIdp?.spec?.execution?.performance?.commands?.calls ?? 0),
    noOpMutationAttempts: Number(noOpRun?.performance?.confighub?.mutations?.attempts ?? 0),
    noOpArgoSyncRequests: Number(noOpRun?.performance?.argo?.syncRequests ?? 0),
    noOpWallMs: Number(noOpRun?.performance?.wallElapsedMs ?? miniIdp?.spec?.execution?.performance?.wallElapsedMs ?? 0),
    selectorReplacements: selectorReplacements.length,
    retainedSelectorMigrationPvcs: selectorReplacements.reduce((total, item) => total + (item?.retainedPVCs?.length ?? 0), 0),
    deterministicParityCurrent: parity.status?.result === "pass"
      && parity.spec?.comparison?.mode === "path-and-byte-for-byte"
      && parity.spec?.comparison?.differences?.length === 0
      && generatedFiles === 135
      && generation.kind === "KubaraCurrentPlatformGenerationReceipt"
      && generation.spec?.tools?.kubaraVersion === "v0.13.0"
      && Number(generation.spec?.platform?.renderCount) === 13
      && Number(generation.spec?.outputs?.generatedFileCount) === generatedFiles,
    catalogCurrent: coverage.status?.result === "pass"
      && Number(coverage.status?.finalComponentCount) === 103
      && Number(coverage.status?.finalVersionCount) === 130
      && Number(coverage.status?.exactSelectionCount) === 18
      && coverage.status?.oldRootsByteIdentical === true,
    faithfulCurrent: live.faithful.current,
    miniIdpCurrent: live.miniIdp.current,
    orphanCurrent: live.orphan.current,
    performanceCurrent: live.performance.current,
    matrixCurrent: live.matrix.current,
    wiringCurrent: live.wiring.current,
    guiCurrent: live.gui.current,
    guiRequired: live.gui.required,
    currentLive: live.current,
    liveReasons: live.reasons,
  };
}

function kubaraHtml(catalog) {
  const facts = loadKubaraSiteFacts();
  const currentLive = facts.currentLive;
  const badge = (passed, yes, no) => `<strong style="display:inline-block;padding:3px 8px;border:1px solid ${passed ? "var(--good)" : "var(--warn)"};border-radius:999px;background:var(--panel);color:${passed ? "var(--good)" : "var(--warn)"}">${escapeHtml(passed ? yes : no)}</strong>`;
  const steps = [
    ["1", "Choose components and wiring", "Keep Kubara catalogs, config.yaml, values overlays, and service definitions.", "../docs/demo/kubara/adoption-1-choose.md"],
    ["2", "Run Kubara", "Generate the familiar platform, add-ons, ApplicationSets, overrides, and wiring.", "../docs/demo/kubara/adoption-2-generate.md"],
    ["3", "Push the complete hand-off to Git", "Prepare, scan, commit, and push one exact portable platform revision.", "../docs/demo/kubara/adoption-3-git.md"],
    ["4", "Import the Git revision and create OCI", "Publish immutable component/config packages plus a digest-bound platform index.", "../docs/demo/kubara/adoption-4-oci.md"],
    ["5", "Load the selected ConfigHub organization", "Materialize the recognizable topology, apply twice, and prove zero residue in the declared scope.", "../docs/demo/kubara/adoption-5-confighub-org.md"],
    ["6", "Deploy applications", "Promote, approve, release, and roll back; local Argo reconciles only the exact ConfigHub-authorized digest.", "../docs/demo/kubara/adoption-6-apps.md"],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Build an internal developer platform with Kubara &middot; Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    ${audienceLabel("For platform teams")}
    <h1>Build an internal developer platform</h1>
    <p class="lead">Choose the services your developers need to build and run AI-assisted tools and applications. The Catalog supplies tested component versions and known requirements. AI can help with the selection and settings. The starter writes native Kubara configuration for you to review before Kubara generates the platform files.</p>
    <p><strong>Kubara composes; ConfigHub governs; Argo reconciles.</strong></p>
    <p>Keep platform components, developer tools, and applications as related but separately versioned configuration. ConfigHub retains and promotes each of them. Test a platform-component revision when shared services change, a tool revision when the developer experience changes, and an app revision when an application changes.</p>
    <p>You can stop with Kubara's Git output and OCI packages. Add ConfigHub when the platform or its applications need shared variants, approvals, promotion, rollback, or a live fleet view. Argo CD remains the reconciler.</p>
    <p>If you already run a platform on Flux or Argo, <a href="./deploy-with-flux-or-argo.html">point ConfigHub at the fleet you have</a> and add identity, approvals, and rollback with your reconciler unchanged.</p>
    <p>The implementation lives in <a href="https://github.com/confighub/kubara-confighub"><strong>confighub/kubara-confighub</strong></a>.</p>
  </header>
  <main>
    ${generatedStamp(catalog, "Kubara buyer journey")}
    <section aria-labelledby="kubara-run-yourself">
      <h3 id="kubara-run-yourself" style="font-size:1.25rem">Run this yourself</h3>
      <p>Three rungs, smallest first. Each one is a real command or a recorded walkthrough, and every claim behind them links a committed receipt.</p>
      <div class="card">
        <h3>A cluster with delivery wired, in minutes</h3>
        <pre><code>cub cluster up --name demo --space demo-cluster</code></pre>
        <p>One command creates a temporary kind cluster, installs Argo CD, and wires it to a ConfigHub Space. Needs a ConfigHub account and Docker; the cluster runs on your laptop.</p>
        <h3>The whole platform, with applications flowing through it</h3>
        <p>The six-step journey below runs Kubara's own output through ConfigHub, from import to approved promotion and recorded rollback. The implementation, commands, and receipts live in <a href="https://github.com/confighub/kubara-confighub">confighub/kubara-confighub</a>, and each step links its walkthrough.</p>
        <h3>Give your agent this prompt</h3>
        <pre style="border: 1px solid var(--line); border-radius: 10px; padding: 16px; overflow-x: auto; white-space: pre-wrap;"><code>I am building or operating an internal developer platform on Kubernetes.
My platform components: &lt;list them, for example cert-manager, traefik, metrics-server, kube-prometheus-stack&gt;.

1. Fetch https://confighub.github.io/helm-expt/site/changes.json and check which of my
   components have a checked entry in this catalog.
2. For each covered component, open its catalog page and compare my configuration with
   the recorded objects, prerequisites, hooks, CRDs, and license before I install it.
3. For each component with no entry, say so plainly, and with my approval file it at
   https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml
   so it gets a checked entry with receipts.
4. Then read https://confighub.github.io/helm-expt/site/kubara.html and tell me which
   of my components the recorded platform journey already covers.</code></pre>
        <p>Steps 1 and 2 read public data. Step 3 files a public issue with your approval, and an uncovered component becomes a checked entry with receipts.</p>
      </div>
      <p><strong>Why hand any of this to an agent?</strong> Our committed two-round benchmark measured where agents are already strong and where they cannot be. A bare agent with a shell answered static chart questions at 96.7 percent. Twelve of eighteen questions about time, live state, and accountability needed records the agent could not produce. The toolchain carries day one; the records carry every day after. <a href="./challenge.html">The benchmark and the full prompt live on the challenge page</a>, and the run data is committed in <a href="https://github.com/confighub/helm-expt/tree/main/data/ai-benchmark">data/ai-benchmark</a>.</p>
    </section>
    <section aria-labelledby="kubara-starter">
      <h2 id="kubara-starter">1. Choose services for your developers</h2>
      <p>This example uses four ordinary platform services and records one optional runtime image. Use the links to check each component, then change the comma-separated service list to suit your platform.</p>
      ${markdownLikeTable([
        ["Job", "Selected component", "Catalog page"],
        ["Certificates", "cert-manager", '<a href="./charts/jetstack-cert-manager-v1-21-0.html">jetstack/cert-manager 1.21.0</a>'],
        ["Cluster metrics", "metrics-server", '<a href="./charts/metrics-server-metrics-server-3-13-1.html">metrics-server 3.13.1</a>'],
        ["Ingress", "traefik", '<a href="./charts/traefik-traefik-41-0-2.html">Traefik 41.0.2</a>'],
        ["Monitoring", "kube-prometheus-stack", '<a href="./charts/prometheus-community-kube-prometheus-stack-87-19-2.html">kube-prometheus-stack 87.19.2</a>'],
      ], { rawThirdColumn: true })}
      <pre><code>git clone https://github.com/confighub/kubara-confighub.git
cd kubara-confighub
npm run kubara-platform:start -- \\
  --name inference-platform \\
  --repository https://github.com/acme/platform.git \\
  --services cert-manager,metrics-server,traefik,kube-prometheus-stack \\
  --runtime-image vllm=vllm/vllm-openai-cpu:v0.27.1-arm64@sha256:e6745d7ba6610f637c6f22fc06cd730342e50245b6c46767235600483adfbbde \\
  --output ../my-platform</code></pre>
      <p>Replace <code>https://github.com/acme/platform.git</code> with the HTTPS Git repository where you will keep the generated platform.</p>
      <p>The command needs Node.js. It does not contact ConfigHub Server, an OCI registry, or Kubernetes.</p>
      <p><strong>Website to command line:</strong> choose and inspect components here, then run the command with those exact component names. Give the generated files to your AI assistant when you want help with a change; review its file diff before running Kubara again.</p>
      <p><a href="https://github.com/confighub/kubara-confighub/tree/main/examples/kubara/inference-platform"><strong>Open the exact generated example</strong></a> · <a href="https://github.com/confighub/kubara-confighub/tree/main/examples/kubara/starter-platform">Open the smaller three-service starter</a></p>
      <h3>2. Review what the starter wrote</h3>
      ${markdownLikeTable([
        ["File", "Why it exists"],
        ["config.yaml", "The native Kubara selection: cluster, catalogs, enabled services, and ordinary settings."],
        ["source-and-intent.yaml", "The Kubara source, exact component versions and packages, Catalog links, intended cluster, and checks still required."],
        ["runtime-images.yaml", "The digest-pinned application or model-server images selected beside the platform. Kubara does not deploy this record, and an image is not a complete application."],
        ["README.md and checksums.txt", "The next commands and hashes for every generated starter file."],
      ])}
      <h3>3. Generate and inspect the platform</h3>
      <p>Review the generated <code>.env.example</code>, create a private <code>.env</code>, and replace every placeholder. Do not commit the private file. Then run Kubara:</p>
      <pre><code>kubara --work-dir . --config-file config.yaml --env-file .env generate --helm</code></pre>
      <p>Review the generated Kubernetes files and the required CRDs, hooks, setup Jobs, Secrets, certificate issuers, storage classes, and APIs. The Catalog links explain the known behavior of each selected chart, but the final check must use this platform's generated output and intended cluster.</p>
      <h3>4. Choose where the reviewed result goes</h3>
      <p>Keep the generated platform in Git, or compile its exact revision into component OCI packages plus a digest-bound platform index. Neither choice needs a ConfigHub account. Use ConfigHub when you want retained platform versions, environment variants, approvals, promotion, release OCI, rollback, or live fleet comparison.</p>
      <p><a href="../docs/demo/kubara/adoption-4-oci.md"><strong>Package the reviewed Git revision as OCI</strong></a> · <a href="../docs/demo/kubara/adoption.md">Continue through ConfigHub and Argo CD</a> · <a href="../docs/reference/flattening-alignment.md">See what can be flattened</a></p>
      <p><a href="../docs/demo/kubara/gui-tour.md">See the four-cluster result</a> · <a href="../docs/demo/kubara/checkpoints.md">Check the evidence</a> · <a href="../docs/demo/kubara/single-platform.md">Open the technical runbook</a></p>
      <p><a href="../docs/demo/kubara/adoption-6-apps.md"><strong>See two applications added, promoted, released, and checked on the platform</strong></a>.</p>
    </section>
    <section aria-labelledby="benefits">
      <h2 id="benefits">Benefits with explicit acceptance evidence</h2>
      <p>Each status pill reads one of three ways. A <strong>current live</strong> pill means a current live run accepted the benefit, and some name the exact result, such as a passed performance gate or zero audited residue. A <strong>current deterministic</strong> pill means committed deterministic evidence accepts it, without a live run. Any other wording means the deterministic contract still holds while its live acceptance is absent, stale, or not yet accepted.</p>
      ${markdownLikeTable([
        ["Benefit", "Evidence or acceptance target", "Status"],
        ["No rewrite", `${facts.generatedFiles} path-and-byte-identical generated files from Kubara's official and ConfigHub-aligned catalog lanes; ${facts.renders} deterministic effective renders.`, badge(facts.deterministicParityCurrent, "current deterministic", "check required")],
        ["A stronger component Catalog", `The Kubara catalog 1.1 coverage run closed at ${facts.catalogComponents} components and ${facts.catalogVersions} retained versions, with all ${facts.selections} exact Kubara selections kept under additive-only retention. The Catalog has grown since; the pages above carry its current size of 112 components and 139 retained versions.`, badge(facts.catalogCurrent, "current deterministic", "check required")],
        ["Recognizable platform shape", `${facts.clusters} clusters, ${facts.roles} platform roles, ${facts.applications.length} applications, faithful and adapted delivery identities, with Argo CD retained.`, badge(facts.faithfulCurrent && facts.miniIdpCurrent, "current live", "faithful or adapted receipt needs refresh")],
        ["Upgrade-safe retained workloads", `${facts.selectorReplacements || 16} exact journaled immutable-selector replacements, including four PostgreSQL StatefulSets whose bound PVC identities are retained.`, badge(facts.miniIdpCurrent && facts.selectorReplacements === 16 && facts.retainedSelectorMigrationPvcs === 4, "current live", "live migration receipt required")],
        ["Fleet visibility", `${facts.matrixCells} component/application cells, ${facts.curatedLinks} curated native Link intents, and ${facts.wiringFacts} extracted wiring facts kept as the full engineering view.`, badge(facts.miniIdpCurrent && facts.matrixCurrent && facts.wiringCurrent, "current live", "desired state only")],
        ["Repeatable delivery", "The retained four-cluster proof includes exact release heads, healthy applications, and an immediate zero-action apply.", badge(facts.miniIdpCurrent, "current live", "live receipt required")],
        ["Measured reconciliation cost", facts.noOpReadCommands > 0 ? `The current no-op made ${facts.noOpMutationAttempts} ConfigHub mutation attempts and ${facts.noOpArgoSyncRequests} Argo sync requests, while recording ${facts.noOpReadCommands} ConfigHub CLI read commands, ${facts.noOpSubprocessCalls} total subprocess calls, and about ${Math.round(facts.noOpWallMs / 1000)} seconds. The fixture regression target is met; this is not a raw-Kubara comparison, HTTP-round-trip count, or service-level promise.` : "No source-current no-op measurement is available.", badge(facts.performanceCurrent, "performance gate passed", facts.miniIdpCurrent ? "measured; performance gate not accepted" : "live performance receipt required")],
        ["Clean governed inventory", "A separate audit must prove exact ConfigHub inventory, no Argo-prunable resources, and no unclassified, dangling, or UID-stale audited durable workloads. It does not claim a complete inventory of every Kubernetes type.", badge(facts.orphanCurrent, "current live: audited residue zero", "live receipt required: scoped residue audit")],
      ], { rawThirdColumn: true })}
      <p data-kubara-live-evidence="${currentLive ? "current" : "gated"}">The status is generated from an exact evidence chain, component by component. ${currentLive ? "The complete faithful, adapted, performance, matrix, wiring, orphan, and six-frame GUI chain is accepted." : "Some current live evidence may already pass, but the complete publishable chain is still gated."} Missing or inconsistent faithful, source-digest mini-IDP, performance, matrix, wiring, orphan, or GUI evidence stays visible instead of becoming a green marketing claim.</p>
    </section>
    <section aria-labelledby="composition-evidence">
      <h3 id="composition-evidence">The composition, as evidence</h3>
      <p>Each component in a stack carries a <a href="./d/data/certified-bundles/summary.html">certified-bundle receipt</a> that names what it is and how it may be flattened, and the <a href="./d/data/certified-bundles/eks-inference-stack.html">eight-bundle EKS inference platform</a> is one worked example. A single composition verdict over the whole stack, checking closure, single-owner, CRD and API-version compatibility, and conflicts, is <a href="./d/docs/planning/composition-certification.html">proposed</a>, not yet a shipped gate. Today the wiring facts above are the report, not a pass or fail.</p>
    </section>
    <section aria-labelledby="stays-adds">
      <h2 id="stays-adds">What stays Kubara, and what ConfigHub adds</h2>
      ${markdownLikeTable([
        ["Kubara stays", "ConfigHub adds"],
        ["Ordered catalogs, ServiceDefinitions, config.yaml, values overlays, generated platform files, hub/spoke intent", "A component-first Catalog and retained exact versions; deployable variants and configurations follow each component, while Kubara keeps per-platform selection and wiring"],
        ["Git as the portable platform hand-off", "One immutable OCI package per reusable/effective configuration plus a digest-bound platform index"],
        ["Argo CD as the cluster reconciler", "A governance and release plane that selects the exact digest before local Argo receives it"],
      ])}
    </section>
    <section aria-labelledby="delivery-authority">
      <h3 id="delivery-authority">Make latest discoverable, not deployable</h3>
      <p>The adapted lane keeps <code>targetRevision: latest</code> as a discovery address but leaves automated sync off. On the automated path, mutable latest cannot race past approval, promotion, or rollback, and ConfigHub selects the exact OCI digest before Argo CD receives it. Blocking a privileged human or a manual Argo sync needs your own RBAC or admission control.</p>
      <details style="margin:18px 0">
        <summary><strong>The exact mechanism, step by step</strong></summary>
        <p>The adapted lane retains <code>targetRevision: latest</code> as the ConfigHub OCI discovery address, but leaves <code>spec.syncPolicy.automated</code> absent from every managed Application. Pinned argobot v0.1.6 runs with <code>ARGO_SYNC_MODE=kubernetes</code>, <code>ARGO_NAMESPACE=argocd</code>, and <code>ARGO_REFRESH_TYPE=hard</code>, so it refreshes but cannot deploy.</p>
        <p>ConfigHub revalidates the authoritative release and submits <code>operation.sync.revision=&lt;ManifestDigest&gt;</code> with Kubernetes UID/resourceVersion compare-and-set only when no Argo operation is active. This is the governed improvement: mutable latest cannot race past approval, promotion, or rollback, while Argo remains the local reconciler.</p>
        <p>The authority check inventories Applications across the whole cluster: all managed Applications must live in <code>argocd</code>, and the adapted lane permits zero ApplicationSets. Retained <code>release-N</code> Tags expose contiguous history, but the exact OCI <code>ManifestDigest</code> remains deployment authority. Client opening and closing checks plus the no-auto fence stop a rejected raced Release from deploying through this managed path. Atomic rejection of the Release record requires server-side publish preconditions.</p>
        <p>Production approval uses the Unit slug and server <code>HeadRevisionNum</code>. Authoritative reads before and after must preserve the Unit ID, observed numeric head, and <code>DataHash</code>, and the gate must clear exactly once. That is bracketed exact-head evidence; it is not a claim that the approval API accepts a numeric compare-and-set token.</p>
        <p>The retained fleet records 16 exact, one-time immutable-selector replacements. Its v1 history honestly retains 12 earlier reviewed-preflight triggers and four resource-failure recovery triggers; completed history is not rewritten. For every new attempt, the v2 policy requires an attempted exact-revision Argo operation to record and digest-bind the matching terminal resource failure before deletion. Every old UID/resourceVersion and reviewed selector transition is journaled; the replacement must be healthy. The four PostgreSQL StatefulSet migrations retain the same bound PVC UID and volume identity. This is an allowlisted migration contract, not broad delete authority.</p>
      </details>
    </section>
    <section aria-labelledby="six-steps">
      <h2 id="six-steps">One adoption journey, in the user's order</h2>
      <p>The preparer, scanner, package verifier, binding lock, and receipt checks are checkpoints inside these steps. They never replace the six actions a Kubara user understands.</p>
      <ol>
        ${steps.map(([number, title, detail, href]) => `<li><p><a href="${href}"><strong>${number}. ${escapeHtml(title)}</strong></a><br>${escapeHtml(detail)}</p></li>`).join("\n        ")}
      </ol>
      <p><a href="../docs/demo/kubara/adoption.md"><strong>Open the complete tutorial and its checkpoints</strong></a>.</p>
    </section>
    <section aria-labelledby="see-it">
      <h2 id="see-it">What we show in ConfigHub</h2>
      <ol>
        <li>The source-bound platform contract and familiar hub/spoke identity.</li>
        <li>The component-first Catalog, retained versions, and selected instances.</li>
        <li>Faithful Kubara and adapted ConfigHub delivery lanes side by side.</li>
        <li>hx-web and Cubbychat across development, staging, and two production targets.</li>
        <li>Curated native <code>NeedsProvides</code> Links, followed by the full extracted graph.</li>
        <li>Exact-head production approval, promotion, departure, rollback, release, OCI digest history, and the visible no-auto-sync authority boundary.</li>
        <li>The 16 journaled selector migrations, including four retained PostgreSQL PVC identities.</li>
        <li>The 36-cell matrix: desired placement/version/departure, ConfigHub release digest, Argo observed revision/sync/health, and Kubernetes desired/ready counts remain separate; missing runtime evidence is <code>Unknown</code>.</li>
        <li>The separate exact ConfigHub and scoped Argo/workload residue result.</li>
      </ol>
      <p>${currentLive ? "The exact faithful, mini-IDP, performance, orphan, matrix, wiring, and six-frame GUI evidence set is source-current and mutually consistent." : "The deterministic story is current. Live and GUI claims remain gated. Faithful, mini-IDP, performance, health, orphan, matrix, wiring, and all six published screenshots must match this source."}</p>
      <p><a href="../docs/demo/kubara/gui-tour.md#pre-capture-gate">Run the screenshot-free pre-capture gate</a> before opening the browser. Publish exactly six real, source-current frames. Their atomic GUI receipt must bind the source and organization. It must also bind faithful, mini-IDP, orphan, matrix, wiring, image digests, capture times, visible identities, and claim boundaries. Never substitute placeholders or mocked screenshots.</p>
      <p><a href="../docs/demo/kubara/gui-tour.md">Follow the receipt-bound GUI tour</a>.</p>
    </section>
    <section aria-labelledby="boundaries">
      <h2 id="boundaries">The honest boundaries</h2>
      <ul>
        <li>This is deterministic adoption, not an AI rewrite. Ordinary catalog and configuration updates may still be required.</li>
        <li>The user explicitly selects the organization. Targets and the local delivery runtime are current prerequisites; the importer does not silently create or guess them.</li>
        <li>Secrets and target-owned facts stay outside the portable Git and OCI payloads.</li>
        <li>Desired state, current live state, historical evidence, OCI publication, and production support remain distinct claims.</li>
        <li>The exact-digest evidence controls the managed automated path. Blocking privileged human or manual Argo sync additionally requires separate RBAC or admission proof.</li>
        <li>The current no-op records ${facts.noOpReadCommands} ConfigHub CLI read commands and ${facts.noOpSubprocessCalls} total subprocess calls. It completes in about ${Math.round(facts.noOpWallMs / 1000)} seconds, with ${facts.noOpMutationAttempts === 0 ? "zero" : facts.noOpMutationAttempts} ConfigHub mutation attempts and ${facts.noOpArgoSyncRequests === 0 ? "zero" : facts.noOpArgoSyncRequests} Argo sync requests. The fixture regression target is met. CLI commands are not HTTP round trips; this is not a raw-Kubara comparison or a service-level promise.</li>
        <li>The retained four-cluster organization is live-proved. A clean import into a fresh user-selected organization is still a separate graduation gate.</li>
      </ul>
      <p><strong>live receipt required</strong> means a deterministic contract exists but its current live acceptance chain is absent or stale.</p>
    </section>
    <section aria-labelledby="detail">
      <h3 id="detail">Keep all the detail</h3>
      <p>The concise buyer journey does not replace the engineering material. Use the <a href="../docs/demo/kubara/single-platform.md">complete mini-IDP and maintainer runbook</a>, <a href="../examples/kubara/git-import/README.md">importer contract</a>, <a href="../docs/demo/kubara/platform-evidence.md">matrix and wiring evidence</a>, and <a href="../docs/demo/kubara/reconciliation-performance.md">performance analysis</a>.</p>
      <p>The example is accepted only after a clean-checkout import into a fresh user-selected organization passes twice. The orphan count must be zero, one application must be healthy, and every published screenshot must be receipt-bound.</p>
    </section>
  </main>
  <footer>Every claim is scoped to the named Kubara source, version, catalogs, ConfigHub organization, delivery path, and receipt.</footer>
</body>
</html>`;
}

function inferenceFamilyTable(root) {
  const href = (path) => `${root}/${path}`;
  return markdownLikeTable([
    ["Start here", "What it gives you", "What you need", "What we checked"],
    [
      `<a href="${href("d/examples/inference/vllm-cpu-starter/README.html")}"><strong>Run one small model on CPU</strong></a>`,
      "A pinned vLLM server, a pinned public Qwen model, and one OpenAI-compatible request.",
      "An ARM64 Kubernetes cluster with 4 CPUs and 10 GiB available. No GPU, cloud account, ConfigHub account, or model credential.",
      `ConfigHub retained the two changed Units, published OCI, Argo CD pulled the same digest, the pod became ready, and the model answered. <a href="${href("d/data/vllm-cpu-starter-proof/summary.html")}">Read the proof</a>.`,
    ],
    [
      `<a href="${href("try-aicr.html")}"><strong>Inspect GPU state or an AICR platform</strong></a>`,
      `Use snapshot and diff for existing GPU nodes without a recipe, or anonymously pull the retained AICR platform and select a reviewed seven-Application CPU starter. <a href="${href("d/docs/demo/aicr/cpu-starter.html")}">Read the detailed configuration record</a>.`,
      "Snapshot needs read access to a Kubernetes cluster. The retained-configuration path needs only ORAS and a laptop; no GPU, cloud account, NGC key, ConfigHub account, registry login, or cluster.",
      `The retained path checks the source digest, seven selected file hashes, source-and-intent record, local OCI digest, and pull-back comparison. <a href="${href("d/data/aicr-cpu-starter-public-proof/summary.html")}">Read the anonymous run</a>. Snapshot findings, configuration inspection, destination checks, and model inference remain separate results.`,
    ],
    [
      `<a href="${href("d/docs/demo/aicr/eks-h100-inference-nim.html")}"><strong>Plan NVIDIA NIM serving</strong></a>`,
      `Choose the <a href="${href("d/docs/demo/aicr/eks-h100-inference-nim.html")}">AICR platform</a> or a <a href="${href("d/docs/demo/aicr/kserve-nim-inference.html")}">specific KServe model shape</a>.`,
      "AWS or equivalent GPU capacity and NGC access to run the model images. Reading the retained configuration needs neither.",
      "Sources, versions, model shapes, credentials boundary, ConfigHub changes, and config-plane delivery are checked. No NIM container or model ran.",
    ],
    [
      `<a href="${href("d/data/certified-bundles/eks-inference-stack.html")}"><strong>Build the full EKS inference platform</strong></a>`,
      "Eight ordered bundles for ACK, networking, EKS, Karpenter, the GPU runtime, and inference workloads.",
      "A ConfigHub account for the configuration sandbox. AWS and GPU capacity for the real cloud path.",
      `All eight source bundles, the ConfigHub sandbox, one promoted change, Argo CD delivery, and the separate CPU model request are checked. AWS and NVIDIA GPU execution remain open. <a href="https://github.com/confighub/eks-inference">Open the plugin</a>.`,
    ],
  ], {
    rawFirstColumn: true,
    rawSecondColumn: true,
    rawThirdColumn: true,
    rawFourthColumn: true,
  });
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
  <title>Worked Examples · Config Workshop</title>
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
    <h1>Find a starting configuration</h1>
  <p class="boundary-chip">Runs on your laptop</p>
    <p class="tagline">Start with the job you need done. Choose a tested component or platform example, then inspect the exact configuration before you use it.</p>
    <p>The Config Workshop Catalog keeps exact versions, useful configurations, known requirements, and the evidence behind each result. It exists so you do not have to repeat the same investigation for every chart or package.</p>
    <p>Each example names the question it answers. It may inspect a source, produce objects, check a destination, or report what happened after deployment. Later answers are never inferred from earlier ones.</p>
    <p>If you already have a chart, values, YAML, or OCI, use <a href="./ask.html">Check my config</a>. The advanced examples below continue into promotion, fleet rollout, and repeated operational jobs.</p>
  </header>
  <main id="examples-content">
    <span id="catalog-starting-points"></span>
    <span id="catalog-next-jobs"></span>
    <span id="aicr-platform"></span>
    <section aria-labelledby="start">
      <h2 id="start">1. What do you need?</h2>
      <h3 id="example-boundary">Read the result before choosing an example</h3>
      ${markdownLikeTable([
        ["Question", "What an example must show"],
        ["What do I have?", "The source, snapshot, package, OCI, or exact files that were inspected."],
        ["What will it produce?", "The source-native command and exact output, or a recorded no-op for literal configuration."],
        ["Can this destination accept it?", "The named destination, current facts, exact candidate, and checks that ran."],
        ["Did it work?", "The exact delivered revision and the controller, resource, workload, runtime, drift, or rollback evidence actually collected."],
      ])}
      <p>An example may answer only one or two questions. Later stages remain blocked or not run until their required input exists.</p>
      <p>Choose the closest job. Each link opens a tested starting point or the shortest current path to one.</p>
      ${markdownLikeTable([
        ["I need", "Start here"],
        ["A database or cache", `<a href="./try.html"><strong>Try the Redis configuration.</strong></a> Render it locally, read the 14 objects, and check the recorded Helm match and install requirements.`],
        ["Cluster monitoring", `<a href="./charts/index.html?q=kube-prometheus-stack"><strong>Find Kube Prometheus Stack.</strong></a> Compare exact versions, CRD choices, hooks, prerequisites, and delivery evidence.`],
        ["Ingress and certificates", `<a href="./charts/index.html?q=ingress-nginx"><strong>Start with ingress-nginx</strong></a>, then <a href="./charts/index.html?q=cert-manager">add cert-manager</a>. The Catalog records the setup work that rendered YAML does not explain.`],
        ["AI inference", `<a href="./try-aicr.html"><strong>Start with AICR.</strong></a> Compare existing GPU nodes without a recipe, or inspect the exact CPU-starter Applications and OCI without an account, cluster, or GPU. Then continue to the NIM and EKS examples below.`],
        ["An internal developer platform", `<a href="./kubara.html"><strong>Build a small platform with Catalog components, Kubara, and AI.</strong></a> Review native Kubara configuration, generate Git and OCI outputs, then retain and promote platform components, developer tools, and applications separately in ConfigHub.`],
        ["A chart or configuration I already have", `<a href="./ask.html"><strong>Check my config.</strong></a> Bring the values, YAML, OCI, or work made by AI. Compare it with defaults, Catalog records, or what you run now.`],
      ], { rawSecondColumn: true })}
      <p>Missing the component or use case you need? <a href="${SITE_FEEDBACK_ISSUE_URL}">Tell us what you are trying to run</a>.</p>

      <h3 id="worked-stories">Six worked examples</h3>
      <p>Choose the question closest to yours. Each example links the result to the files and evidence that support it.</p>
      ${markdownLikeTable([
        ["Question", "Worked example", "Result"],
        [
          "What will this package install?",
          `<a href="./try.html"><strong>Inspect Redis without an account</strong></a>`,
          `Render 14 Kubernetes objects, keep password material out of the package, and compare the result with Helm. <a href="./d/data/serverless-install-parity-proof/summary.html">Check the live comparison</a>.`,
        ],
        [
          "What did AI-written values change?",
          `<a href="./ask.html#ai-values"><strong>Review an NGINX values file</strong></a>`,
          `Keep the requested three replicas, correct six risky settings, and retain five reviewed objects as files or OCI. <a href="./d/data/byo-helm-values-review/summary.html">Read the review</a>.`,
        ],
        [
          "Can I promote the reviewed change?",
          `<a href="./promote.html"><strong>Move NGINX from development to staging</strong></a>`,
          `Compare three and four replicas, promote the exact revision in ConfigHub, publish OCI, and record four ready replicas through Argo CD. <a href="./d/data/byo-helm-values-promotion-proof/summary.html">Check the promotion</a>.`,
        ],
        [
          "How should hooks and CRDs run?",
          `<a href="./d/docs/demo/hooks-crds/kube-prometheus-stack.html"><strong>Install and upgrade Kube Prometheus Stack</strong></a>`,
          `Install CRDs before dependent objects, replace the setup Job when required, and keep separate Argo CD and Flux results. <a href="./d/data/kps-gitops-lifecycle-proof/summary.html">Check the lifecycle proof</a>.`,
        ],
        [
          "Can I build a platform from tested parts?",
          `<a href="./kubara.html"><strong>Build a Kubara platform</strong></a>`,
          `Choose Catalog components, generate native Kubara configuration, and carry the reviewed Git and OCI result into ConfigHub. The page shows which platform and live checks are current.`,
        ],
        [
          "Can I inspect AI infrastructure without a GPU?",
          `<a href="./try-aicr.html"><strong>Inspect the AICR CPU starter</strong></a>`,
          `Pull seven exact Argo CD Applications, verify every file, and write a local OCI without an account, cluster, cloud account, or GPU. <a href="./d/data/aicr-cpu-starter-public-proof/summary.html">Check the anonymous run</a>.`,
        ],
      ], { rawSecondColumn: true, rawThirdColumn: true })}

      <h2 id="simple-example">2. Try a simple example: Redis</h2>
      <h3 id="see-first">See what Redis installs, before you install it</h3>
      <p>Turn the published Redis package into the exact Kubernetes files it produces. You need no account, no login, and no cluster.</p>
      <div class="terminal-card">
        <div class="terminal-title">redis package &rarr; exact Kubernetes files</div>
        <pre class="terminal-body"><code><span class="term-prompt">$</span> cub installer setup \\
    --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
    --base reuse-existing-secret \\
    --work-dir ./redis \\
    --non-interactive \\
    --namespace redis

Base: reuse-existing-secret; components: []
Namespace: redis
Rendered 14 manifest(s) to ./redis/out/manifests
Rendered 0 secret(s)</code></pre>
      </div>
      <p>Read the 14 files in <code>./redis/out/manifests</code>. The package holds no password. You supply the Secret <code>redis/redis-existing-secret</code> yourself.</p>
      <p>These 14 files were checked against Helm's own output and matched. See the <a href="./redis-walkthrough.html">detailed Redis walkthrough</a> for the recorded parity, upgrade, and rollback evidence.</p>
      <p>To keep an edit to the files as well, the same objects go into ConfigHub. There you change a value, move it from development to staging, and roll it back. <a href="./confighub.html">Keep the result in ConfigHub</a>.</p>
      <p>If you do not want Redis, choose the input you have below. Every path ends with exact files and a checked result.</p>
      <p>Each example includes the source files and the evidence behind its result.</p>
      ${markdownLikeTable([
        ["What you have", "Start with this example"],
        [
          "A ready-made Helm package",
          `<a href="./try.html"><strong>Start with Redis.</strong></a> Render 14 objects and check the recorded Helm match and install requirements.<br><a href="./redis-walkthrough.html">Detailed walkthrough</a> · <a href="./charts/bitnami-redis-25-5-3.html">Package and evidence</a> · <a href="https://github.com/confighub/helm-expt/tree/main/recipes/bitnami/redis/25.5.3">GitHub source</a> · <a href="./d/data/helm-catalog-readmes/spaces/bitnami-redis-25-5-3-reuse-existing-secret/README.html">ConfigHub example</a>`,
        ],
        [
          "Your own Helm chart and values",
          `<a href="./ask.html#ai-values"><strong>Check the chart and values your AI produced.</strong></a> Render locally with <code>cub helm</code>, compare exact objects, and keep a review record. The worked NGINX case keeps the requested change and corrects six risky settings.<br><a href="#bring-your-own">Commands</a> · <a href="./d/data/byo-helm-values-review/summary.html">NGINX review</a> · <a href="./d/data/byo-helm-values-review/public-and-confighub.html">OCI publication</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/byo-helm-values">GitHub source</a> · <a href="./d/data/helm-catalog-readmes/spaces/byo-nginx-ai-values-24-0-2-reviewed/README.html">ConfigHub example</a>`,
        ],
        [
          "An AICR recipe or inference stack",
          `<a href="./try-aicr.html"><strong>Choose an AICR question.</strong></a> Compare GPU-node snapshots without a recipe, or pull and verify the seven-Application CPU starter without an account, cluster, or GPU. Then compare the real CPU model request, NIM, and full EKS paths below.<br><a href="./d/docs/demo/aicr/eks-h100-training-kubeflow-v0-20-0.html">AICR v0.20 H100 training starting configuration</a> · <a href="./d/docs/demo/aicr/eks-h100-training-kubeflow-v0-19-0.html">v0.19 managed stages</a>`,
        ],
        [
          "A Timoni module",
          `<a href="./ai.html#timoni-example"><strong>Inspect the Timoni Redis example.</strong></a> Compare its immutable module source, typed options, seven exact objects, lifecycle order, public OCI, and ConfigHub base and development variant.<br><a href="./d/data/helm-catalog-readmes/spaces/timoni-redis-8-10-1-base/README.html">Base guide</a> · <a href="./d/data/helm-catalog-readmes/spaces/timoni-redis-8-10-1-dev/README.html">Development variant</a> · <a href="./d/data/timoni-redis-catalog-proof/summary.html">Proof and limits</a>`,
        ],
        [
          "An existing OCI package",
          `<a href="./d/docs/user/inspect-oci-package.html"><strong>Inspect the OCI.</strong></a> Extract its exact objects, <a href="./ask.html#check-files">compare them in the browser</a>, or <a href="./d/docs/user/transform-oci-package.html">change one field</a>. Pull the result back and compare it before publishing.<br><a href="./d/data/anonymous-oci-transform-proof/summary.html">Transform proof</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/anonymous-oci-transform">GitHub source</a> · <a href="./d/data/literal-config-examples/summary.html">Publication and import proof</a> · <a href="./d/data/helm-catalog-readmes/spaces/existing-oci-nginx-replicas-4/README.html">ConfigHub example</a>`,
        ],
        [
          "Kubernetes YAML or an existing app",
          `<a href="./ask.html#check-files"><strong>Check or compare the YAML in the browser.</strong></a> Keep the review beside the files, then follow the <a href="./existing-apps.html">existing-app guide</a> to upload four ordinary Kubernetes objects and read them back unchanged.<br><a href="./d/data/literal-config-examples/summary.html">Exact import proof</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/plain-yaml/acme-web">GitHub fixture</a> · <a href="./d/data/helm-catalog-readmes/spaces/plain-yaml-acme-web-base/README.html">ConfigHub example</a>. The official tutorial continues into change, release, production, and promotion.`,
        ],
      ], { rawSecondColumn: true })}

      <h3 id="inference">Get inference running</h3>
      <p>Choose the row that answers your immediate question. The first path runs a model on ordinary ARM64 hardware. The later paths explain larger AI platforms without claiming that their GPU workloads have run here.</p>
      ${inferenceFamilyTable(".")}

      <h3 id="agent-fleet">Review an AI agent fleet before it runs</h3>
      <p>An agent service has settings for its model, runtime images, budget, concurrency, credentials, storage, and access. The c3agent example turns those choices into ten exact Kubernetes objects without storing a credential or starting the service.</p>
      <p>The recorded test kept one base configuration. It changed only the fleet settings for staging and production. The accepted result was promoted, published as OCI, and reconciled by Argo CD on Kubernetes. Both Deployments stayed at zero replicas. This proves the configuration and delivery path, not the private c3agent runtime or an agent task.</p>
      <p><a href="./d/docs/demo/c3agent/fleet-config.html"><strong>Read the c3agent walkthrough</strong></a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/c3agent/fleet-config">Open the source files</a> · <a href="./d/data/c3agent-configuration-proof/summary.html">Check the live proof</a></p>

      <h3 id="bring-your-own">Bring your own Helm chart and values</h3>
      <p>Start with one question on <a href="./ask.html#ai-values">Check my config</a>. Its local prompt records the chart inputs and renders the exact objects. It compares them with defaults and, when you add the relevant records, with the Catalog or what you run today. It then gives you a review record to keep.</p>
      <p><strong>This path uses the separate <code>cub-helm</code> plugin for an arbitrary chart.</strong> <code>cub installer</code> reads maintained Catalog packages; <code>cub helm</code> works from a chart and values you supply.</p>
      <p>Use <code>cub helm</code> for a chart that can render without live cluster lookups or target-specific Kubernetes capabilities. Preview it locally first. This command does not contact ConfigHub Server or Kubernetes.</p>
      <div class="terminal-card">
        <div class="terminal-title">your chart → exact Kubernetes files</div>
        <pre class="terminal-body"><code><span class="term-prompt">$</span> cub plugin install confighub/cub-helm
<span class="term-prompt">$</span> cub helm template myapp &lt;chart-ref&gt; \\
    --version &lt;chart-version&gt; \\
    --namespace &lt;namespace&gt; \\
    --values ./my-values.yaml \\
    --output-dir ./out</code></pre>
      </div>
      <p>Read the files in <code>./out</code>. Check images, credentials, permissions, storage, CRDs, and any hooks reported by the command.</p>
      <p>If you omit <code>--namespace</code>, cub uses <code>confighubplaceholder</code> until a deployment variant supplies the real namespace.</p>
      <p>Hooks are omitted unless you add <code>--include-hooks</code>. A chart that requires live <code>lookup</code> results or target-specific capabilities needs a different recorded render path.</p>
      <p>The <a href="./d/data/byo-helm-values-review/summary.html">worked NGINX review</a> starts with AI-written values. It keeps the requested replica count and corrects six settings before deployment.</p>
      <p>When the result is ready for a team, sign in and record it in ConfigHub:</p>
      <pre><code>cub auth login
cub helm install myapp &lt;chart-ref&gt; \\
  --version &lt;chart-version&gt; \\
  --namespace &lt;namespace&gt; \\
  --values ./my-values.yaml</code></pre>
      <p>This does not apply the chart to Kubernetes. ConfigHub stores the rendered objects in <code>myapp-base</code>. It stores the chart, version, and values in <code>myapp-helm</code>.</p>
      <p><code>cub helm install</code> drops Helm hooks by default. <code>--include-hooks</code> stores them as ordinary resources, but it does not run Helm's hook lifecycle.</p>
      <p>CRDs are included unless you use <code>--skip-crds</code>. Your delivery path must install them before resources that depend on them.</p>
      <p>Change the Helm source when chart values should rebuild the shared base. Change a ConfigHub variant when one environment needs a field after render. Do not set the same field in both places.</p>
      <p><a href="https://github.com/confighub/cub-helm/blob/main/docs/guide.md">Read the cub helm guide</a> · <a href="./how-it-works.html#setting-sources">See where settings belong</a> · <a href="./entry-path-reference.html#bring-your-own">Open the detailed example</a></p>
    </section>

    <section aria-labelledby="start-modes">
      <h2 id="start-modes">3. Choose how to run a starting example</h2>
      <h3>Local or CI — available now</h3>
      <p>Use public tools and packages without ConfigHub Server or an account. Public catalog packages also need no Google registry login.</p>
      <h3>Hosted without sign-in — available for rendered YAML</h3>
      <p><a href="./ask.html#check-files">Check my config</a> can inventory and compare rendered Kubernetes YAML in your browser. The files are not uploaded. It does not render a chart, pull OCI, contact Kubernetes, or run live tests.</p>
      <h3>ConfigHub — available now</h3>
      <p>Save the reviewed objects and work with a team. An account is required. Follow the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "examples")}">official tutorial</a>.</p>
      <p>These three choices apply to starting examples. The examples below use ConfigHub Server because their job is to manage saved configuration.</p>
    </section>

    <section aria-labelledby="managed">
      <h2 id="managed">4. Continue in ConfigHub</h2>
      <p>ConfigHub keeps reviewed Kubernetes configuration as shared data. Teams can change it, approve it, promote it, and publish releases for deployment.</p>
      ${markdownLikeTable([
        ["Job", "Working example", "Where to go"],
        ["Save and change", "Upload reviewed objects as a base variant. Make an exact development or customer change without changing the source chart.", `<a href="./variants.html">Variants</a> · <a href="./d/docs/user/variants-after-upload.html">Command walkthrough</a>`],
        ["Promote", worked(pathways, "promotions").result, `<a href="./promote.html"><strong>Compare my next change</strong></a> · <a href="./d/data/byo-helm-values-promotion-proof/summary.html">BYO Helm promotion</a> · <a href="./redis-walkthrough.html">Redis promotion and rollback</a>`],
        ["Deliver through OCI", worked(pathways, "oci-delivery").result, `<a href="./operations.html">Delivery guide</a> · <a href="./d/data/oci-deploy-stage-rollout-proof/summary.html">Argo CD and Flux proof</a>`],
        ["Apply checks and approvals", "Schema, placeholder, and lifecycle-route checks can block bad configuration. Image and probe checks warn. Selected production and system configuration also requires approval.", `<a href="./d/data/apply-policy-functional-proof/summary.html">Functional proof</a> · <a href="./d/data/apply-policy-profiles/summary.html">Policy assignments</a>`],
      ], { rawSecondColumn: true, rawThirdColumn: true })}
    </section>

    <section aria-labelledby="platforms">
      <h2 id="platforms">5. Build or roll out a platform</h2>
      <p><a href="./kubara.html"><strong>Build a small Kubara platform from tested Catalog components.</strong></a> Choose services, record optional digest-pinned runtime images, and review the native Kubara config before generation. The advanced examples below continue into ConfigHub and a fleet.</p>
      <p>A platform team runs the same components on many clusters. Tools like Kubara and Sveltos build these platforms. Sveltos installs one component across a group of clusters. Kubara describes a whole platform at once and generates its files.</p>
      <p>ConfigHub does the same job for both. It stores the result, checks it, and moves a change from one environment to the next. You cannot run a whole fleet in a web page, so each row links a walkthrough and the recorded evidence.</p>
      ${markdownLikeTable([
        ["Example", "What has run", "Open"],
        ["Kubara", "Choose components and custom runtime images, generate the platform with Kubara, then keep reviewed versions and fleet operations in ConfigHub.", `<a href="./kubara.html"><strong>Build a platform</strong></a> · <a href="./d/docs/demo/kubara/adoption.html">Six-step adoption tutorial</a> · <a href="./d/docs/demo/kubara/gui-tour.html">GUI tour</a> · <a href="./d/docs/demo/kubara/checkpoints.html">Evidence checkpoints</a> · <a href="./d/docs/demo/kubara/single-platform.html">Technical mini-IDP runbook</a> · <a href="./d/examples/kubara/git-import/README.html">Importer reference</a> · <a href="./d/docs/demo/kubara/platform-evidence.html">Matrix and wiring evidence</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/kubara/current-platform">Ordinary Kubara output</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/kubara/prepared-current-platform">Prepared importer handoff</a> · <a href="https://github.com/confighub/helm-expt/blob/main/examples/kubara/prepared-current-platform/preparation-receipt.yaml">Preparation receipt</a> · <a href="https://github.com/confighub/helm-expt/blob/main/examples/kubara/current-platform/catalog-parity-receipt.yaml">Catalog parity receipt</a> · <a href="./d/docs/demo/kubara/local-platform.html">Historical v0.12 proof</a>`],
        ["Sveltos", worked(pathways, "sveltos").result, `<a href="./d/docs/demo/sveltos/kyverno-fleet.html">Walkthrough</a> · <a href="https://github.com/confighub/helm-expt/tree/main/examples/sveltos/kyverno-fleet">GitHub source</a> · <a href="./d/data/sveltos-oci-delivery-proof/summary.html">Proof</a> · <a href="./d/data/helm-catalog-readmes/spaces/sveltos-kyverno-fleet-3-8-1-staging/README.html">Space guide</a>`],
      ], { rawSecondColumn: true, rawThirdColumn: true })}
      <h3 id="kubara-app">An internal developer platform with apps on it</h3>
      <p><strong>ConfigHub simplifies Kubara without making it fundamentally different.</strong> Kubara's catalogs, <code>config.yaml</code>, values overlays, generated components, and hub-and-spoke model remain recognizable. ConfigHub adds exact component retention, semantic review, approvals, promotion, rollback, a component-by-cluster matrix with explicit live or unknown state, and visible wiring. Argo CD still reconciles.</p>
      <p>The current Kubara source selects seven platform roles across one hub and three spokes. The <a href="./kubara.html">Kubara page</a> holds the architecture, the exact observation boundaries, and what the receipts do and do not prove.</p>
      <p><a href="./kubara.html"><strong>Start with the Kubara buyer journey</strong></a> · <a href="./d/docs/demo/kubara/adoption.html">Follow the six-step tutorial</a> · <a href="./d/docs/demo/kubara/platform-evidence.html">Open the matrix and wiring evidence</a>.</p>
    </section>

    <section aria-labelledby="apps">
      <h3 id="apps">6. Use saved configuration for a repeated job</h3>
      <p>Each row has a working example. The final column says what is still needed before the same result can be offered more generally.</p>
      ${markdownLikeTable([
        ["App", "Working example", "Open", "Still to build"],
        ...appRows,
      ], { rawSecondColumn: true, rawThirdColumn: true, rawFourthColumn: true })}
      <p><a href="./journey.html">Read how Apps use saved configuration</a>.</p>
    </section>
  </main>
  <footer>Example status is scoped to the named source, version, configuration, delivery path, and receipt.</footer>
</body>
</html>
`;
}

function entryPathReferenceHtml(catalog) {
  const permanentLiteralOciReceipt = readYaml(permanentLiteralOciReceiptPath);
  const permanentLiteralOciRef =
    permanentLiteralOciReceipt.spec.artifact.immutableReference;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Entry Path Reference · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Detailed entry paths</h1>
    <p class="tagline">This reference keeps the commands and evidence links for Helm, AICR AI-infrastructure packages, OCI, and Kubernetes YAML. Start with the shorter <a href="./testing.html">Examples page</a> if you have not chosen a path yet.</p>
    <p><code>cub installer</code> reads maintained catalog packages. <code>cub helm</code> works with an arbitrary chart and values. These are preparation tools, not separate ConfigHub journeys.</p>
  </header>
  <main>
    ${catalogPathfinderHtml(".")}
    <section aria-labelledby="work-mode">
      <h2 id="work-mode">2 · Choose where the work runs</h2>
      ${markdownLikeTable([
        ["Choice", "What it means", "Status"],
        ["Local, no server", "Run tools on your machine or in CI. Public package pulls need no sign-in.", "Available"],
        ["Hosted, no sign-in", "Inspect and compare rendered Kubernetes YAML in the browser. The files stay on the user's machine.", "Available for object inventory, selected manifest checks, and object comparison"],
        ["ConfigHub", `Record, change, release, and promote the result. Continue with the <a href="${confighubOutboundUrl(CONFIGHUB_TUTORIAL_URL, "testing")}">official tutorial</a>.`, "Available; account required"],
      ], { rawSecondColumn: true })}
      <p>These choices apply before configuration is saved. Chart rendering, OCI pulls, cluster checks, and deeper analysis still run locally or in CI. Managed variants, promotions, Apps, gates, and fleet examples use ConfigHub Server.</p>
    </section>
    <section aria-labelledby="bring-your-own">
      <h2 id="bring-your-own">3 · Helm: bring your own chart and values</h2>
      <p>Use <code>cub helm</code> when you have an arbitrary chart and values. Start with the chart version, values, namespace, and release name your team intends to use.</p>
      <p>Install the plugin once. Then render to files without contacting ConfigHub Server or Kubernetes:</p>
      <pre><code>cub plugin install confighub/cub-helm

cub helm template &lt;release&gt; &lt;chart&gt; \\
  --version &lt;version&gt; \\
  --namespace &lt;namespace&gt; \\
  --values &lt;values.yaml&gt; \\
  --output-dir ./out</code></pre>
      <p>Read the Kubernetes objects, then compare them with the chart defaults and any matching base variants in the catalog. Check image changes, placeholder or embedded credentials, broad RBAC, privileged settings, CRDs, hooks, webhooks, storage, and required target resources before applying anything.</p>
      <p><code>cub helm</code> reports hooks it leaves out and writes chart CRDs as separate files. A chart that depends on live cluster lookups needs another path.</p>
      <p>If the result is ready to share, record both the objects and their Helm inputs in ConfigHub:</p>
      <pre><code>cub auth login
cub helm install &lt;release&gt; &lt;chart&gt; \\
  --version &lt;version&gt; \\
  --namespace &lt;namespace&gt; \\
  --values &lt;values.yaml&gt;</code></pre>
      <p>This command does not apply to Kubernetes. It creates a base Space for the rendered objects and a Helm Space for the chart, version, namespace, and values.</p>
      <p>Change the Helm source when chart values should rebuild the shared base. Change a ConfigHub variant when one environment needs a field after render. Do not set the same field in both places.</p>
      <p><a href="https://github.com/confighub/cub-helm/blob/main/docs/guide.md">Read the cub helm guide</a> · <a href="./how-it-works.html#setting-sources">See where settings belong</a></p>
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
      <h2 id="aicr-platform">4 · AICR: start with a platform package</h2>
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
      <h3>Retained AI platform configurations</h3>
      <p>The Catalog keeps exact AICR versions and derived examples side by side. A published entry can be pulled and inspected as a starting configuration. Each row also shows how many later steps have receipts, so public OCI publication is not confused with ConfigHub promotion, delivery, or runtime. The table is generated from <a href="../data/aicr-platform-evidence/summary.md">the entry record</a>.</p>
      ${markdownLikeTable([
        ["Shape", "Provenance", "Rungs with receipts"],
        ...catalog.platformEvidence.spec.entries.map((entry) => [
          `<a href="../${entry.paths.page}">${escapeHtml(entry.title)}</a>`,
          escapeHtml(entry.provenance),
          `${entry.ladder.climbedCount} · <code>${escapeHtml(entry.platformDigest.slice(0, 19))}…</code>`,
        ]),
      ], { rawFirstColumn: true, rawSecondColumn: true, rawThirdColumn: true })}
      <p>Open an entry to see its source, public OCI, ConfigHub, delivery, and runtime status, with a separate receipt for each completed step. A Catalog record does not by itself mean that the workload ran on a GPU.</p>
    </section>

    <section aria-labelledby="existing-oci-change">
      <h2 id="existing-oci-change">5 · OCI: start with an existing package</h2>
      <p>Inspect the OCI first so you know whether it contains a source chart, a cub installer package, or exact Kubernetes objects. A source package must be rendered before it can become a deployable configuration. A literal configuration can be changed directly.</p>
      <pre><code>npm run oci:transform -- oci://REGISTRY/REPOSITORY@sha256:DIGEST \
  --object Deployment/example \
  --namespace example \
  --field spec.replicas \
  --value 4 \
  --output oci-layout:./changed-example:reviewed</code></pre>
      <p>The command changes only the field you name. It records the input digest, the old and new values, and every check result inside the new OCI. It then pulls the new image back and compares the files. Existing companion records are kept if you change the output again.</p>
      <p>The <a href="../data/anonymous-oci-transform-proof/summary.md">public NGINX proof</a> pulls five objects without credentials and changes only the replica count. It names the required external Secret and verifies the output digest and object set. The command first writes a local OCI. The reviewed result was then published deliberately as <code>${permanentLiteralOciRef}</code>.</p>
      <p>The <a href="../data/literal-config-examples/summary.md">publication and import record</a> proves an anonymous pull of that digest and checks its three companion records. It also shows that ConfigHub stored the same five Kubernetes objects without rerendering Helm.</p>
    </section>

    <section aria-labelledby="plain-yaml">
      <h2 id="plain-yaml">6 · YAML: start with plain Kubernetes files</h2>
      <p>The <a href="../examples/plain-yaml/acme-web/README.md">plain YAML fixture</a> contains one Namespace, ConfigMap, Deployment, and Service. There is no chart and no render step.</p>
      <pre><code>cub variant upload \
  --component plain-yaml-acme-web \
  --variant base \
  --space plain-yaml-acme-web-base \
  --granularity per-resource \
  examples/plain-yaml/acme-web</code></pre>
      <p>The focused receipt reads the four ConfigHub Units back and compares them with the four files. The object-set hashes match. Open the <a href="../data/literal-config-examples/summary.md">plain YAML and OCI summary</a> or the <a href="../data/helm-catalog-readmes/spaces/plain-yaml-acme-web-base/README.md">README used inside the demo Space</a>.</p>
      <p>This receipt stops after import. It does not claim a Kubernetes deployment or replace the official ConfigHub tutorial for variants, releases, and promotion.</p>
    </section>

    <section aria-labelledby="source-to-oci">
      <h2 id="source-to-oci">7 · Automate source-to-OCI</h2>
      <p>Yes, for catalog packages and other recorded paths. The public CI example pulls a pinned installer package and renders one base. It tests the result and builds a literal configuration OCI. It then pulls the OCI back and verifies its objects against the reviewed files. The run needs no ConfigHub credentials.</p>
      <p>The NGINX example follows the same pattern for supplied Helm values: render, review, build OCI, pull it back, and compare the exact object set. <a href="../data/byo-helm-values-review/public-and-confighub.md">Open its OCI and ConfigHub record</a>.</p>
      <p>The reviewed OCI change is also kept as a permanent public package rather than only a temporary proof artifact. <a href="../data/literal-config-examples/summary.md">Open its publication and ConfigHub import record</a>.</p>
      <p>The AICR example publishes two artifacts because they have different jobs: Argo CD reads the generated source chart; ConfigHub imports the literal 17-Application configuration. <a href="../examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml">Open the public OCI receipt</a>.</p>
      <p><a href="../data/anonymous-oci-ci-proof/summary.md">Read the CI source-to-OCI proof</a>, <a href="../data/anonymous-oci-transform-proof/summary.md">the anonymous OCI-to-OCI change proof</a>, and <a href="../data/serverless-oci-gitops-proof/summary.md">the local OCI-to-Flux proof</a>. Each receipt records the input and output digests and the steps that ran.</p>
      <p>The same building blocks work for a private chart. We do not yet provide one public service that performs the complete analysis and publication path. Target-specific Secrets, cloud accounts, storage, and lifecycle work still need explicit inputs and decisions.</p>
    </section>

    <section aria-labelledby="shared-rules">
      <h2 id="shared-rules">8 · See what all paths have in common</h2>
      <h3 id="pillar-fewer">Most choices are made and checked before you install</h3>
      <p>A reviewed package fixes most settings at build time. What remains should be small, typed, and recorded. Fewer variables means fewer ways to be wrong and less to test at deployment time. The Helm catalog is moving toward this model. The AICR example records its remaining inputs, publishes both OCI artifacts for anonymous pull, imports the literal configuration into ConfigHub, and promotes one reviewed change. Controller delivery and a live GPU-cluster result remain open.</p>
      <p><a href="./charts/bitnami-redis-25-5-3.html">See the small set of install-time values on a chart page</a>.</p>

      <h3 id="pillar-proof">You can read the proof before you ship</h3>
      <p>Each catalog entry links to the evidence that exists for it: render checks, object inventories, scans, local installs, delivery receipts, and live observations. Not every entry has every test result, so the chart page reports pass, watch, blocked, or not run separately. Bad configuration can also be caught as data before apply, using schema, placeholder, diff, and target checks.</p>
      <p><a href="./verification.html">Read the proof commands and how to run them yourself</a>.</p>

      <h3 id="pillar-messy">Hooks, CRDs, and setup work are listed</h3>
      <p>Hooks, CRDs, ordering, and generated Secrets do not disappear. The catalog records each chart-specific decision and who must perform the work. It also records the result for each delivery path. The public Kube Prometheus Stack package includes its lifecycle files. Receipts cover anonymous pull, direct fresh install, and the no-CRDs upgrade from 85.3.3 to 86.1.0 through Argo CD and Flux. ConfigHub does not yet select that route automatically, and a missing receipt remains visible.</p>
      <p><a href="./charts/prometheus-community-kube-prometheus-stack-85-3-3.html">See the routes on a chart that ships CRDs</a>.</p>

      <h3 id="pillar-reverse">You can reverse a change, not only keep it</h3>
      <p>ConfigHub keeps every revision as data, so you can restore a prior desired state without rebuilding it by hand. Each base variant records the exact objects it produced. This restores Kubernetes configuration; it does not reverse database changes, migrations, or other external effects.</p>
      <p><a href="./how-it-works.html">See how configuration is kept as data you can restore</a>.</p>

      <h3 id="pillar-installer">You do not need to learn cub installer first</h3>
      <p>cub installer is how you pull a package and write its files locally. It is one open source tool alongside Helm and OCI, and you can read everything above without it. When you want to run a package, it is there. When you only want to know whether a package is safe, the evidence stands on its own.</p>

      <h3 id="pillar-policy">The checks follow the configuration</h3>
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
    ["Delivery tests", "Recorded Argo CD and OCI results, plus selected live comparisons and observations."],
    ["Failure and limit tests", "Known gaps, fuzzing, dry-run checks, drift findings, and cases this project refuses to claim."],
  ];
  const futureRows = [
    ["Private catalogs", "Bring private charts, wrapper charts, and customer overlays into the same model."],
    ["Fleet operations", "Promote, patch, scan, and observe many variants with a clear blast radius."],
    ["Accept a live fix", "Bring an authorized live change back into the saved configuration after policy and round-trip checks pass."],
    ["AI agents", "Use AI to propose app and ops changes while ConfigHub keeps evidence, gates, and rollback records."],
    ["Broader AICR and NIM coverage", "Extend the current AICR OCI, import, and promotion example to more recipes and a live GPU deployment."],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Current Work And Planned Work · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="hero human-hero">
    ${topNav(".")}
    <h1>Separate current work from planned work</h1>
    <p class="lead">Use this page to tell which Config Workshop results you can inspect today and which ideas still need product work or broader testing.</p>
    <p>Plans can explain the direction, but only current evidence supports a current claim.</p>
    ${humanLinks([["See current results", "./proof.html"], ["Read known gaps", "./known-gaps.html"], ["See ConfigHub options", "./private/"]])}
  </header>
  <main>
    <section aria-labelledby="now">
      <h2 id="now">1. Use what exists today</h2>
      ${markdownLikeTable([
        ["Area", "Current state"],
        ...nowRows,
      ])}
    </section>

    <section aria-labelledby="next">
      <h2 id="next">2. Review what remains planned</h2>
      ${markdownLikeTable([
        ["Idea", "What would make it useful"],
        ...futureRows,
      ])}
    </section>

    <section aria-labelledby="guardrails">
      <h2 id="guardrails">3. Check the status before relying on a claim</h2>
      <p>A planned idea is not shipped behavior. Current results use explicit status words: pass, watch, blocked, refused, not applicable, and planned.</p>
      <p>Open the evidence or known gap before relying on a result for a new chart, target, or production environment.</p>
      <div class="grid">
        <div class="card"><h3>Upgrade path</h3><p><a href="./private/">Private catalogs and managed operations</a></p></div>
        <div class="card"><h3>Claims register</h3><p><a href="../data/claims-register/summary.md">Open current claim status</a></p></div>
        <div class="card"><h3>Refusals</h3><p><a href="../docs/user/what-we-refuse-to-claim.md">Open what we refuse to claim</a></p></div>
      </div>
    </section>
  </main>
  <footer>Plans describe direction. Current evidence describes what this project has tested.</footer>
</body>
</html>
`;
}

function operationsHtml(catalog) {
  const ops = [
    {
      title: "Diff before you ship",
      status: "available",
      boundary: "ConfigHub account",
      action: "compare a variant with its base",
      code: null,
      get: "A variant is one named configuration of an app. Its object diff shows exactly which Kubernetes objects changed before anything is delivered. This is the opposite of a values file you have to mentally render.",
      see: ["change-routing-before-oci.md", "day2-upgrade-story.md"],
    },
    {
      title: "Scan and gate",
      status: "available",
      boundary: "local checks; managed policy",
      action: "scan rendered objects and stop unsafe releases",
      code: null,
      get: "Run scans over the rendered objects for privilege, exposure and deprecated APIs. A gate is a release stop, so delivery waits until each finding is accepted or waived with a named reason.",
      see: ["../data/external-scan-lane/summary.md"],
    },
    {
      title: "Release a prepared variant",
      status: "watch",
      boundary: "ConfigHub Server",
      action: "preview, then promote a variant",
      code: "cub variant promote <space> --dry-run -o mutations\ncub variant promote <space>",
      get: "Apps and Variants choose the base, derived variant, and target. We've proven this on Redis, NGINX, and kube-prometheus-stack: previewing the change, updating objects that changed, and adding new ones.",
      see: ["../data/variant-promotion/summary.md", "prometheus-overlay-promotion-example.md"],
    },
    {
      title: "Deliver via OCI + GitOps",
      status: "available",
      boundary: "Argo CD or Flux",
      action: "publish OCI for a GitOps controller",
      code: null,
      get: "Publish the variant as an OCI artifact, which is a digest-pinned delivery bundle that Argo or Flux pulls and reconciles. A green local apply and a reconciled controller are different events, so both are recorded separately.",
      see: ["chain-of-proof.md", "../data/runtime-gitops/summary.md"],
    },
    {
      title: "Observe the live result",
      status: "available",
      boundary: "your cluster",
      action: "check the cluster after delivery",
      code: "cub-scout receipt verify \\\n  --file <rendered-objects.yaml> \\\n  --scope namespace/<namespace> \\\n  --predicate object-set-matches \\\n  --ttl 1h \\\n  --out .tmp/object-set.receipt.json\n\ncub-scout receipt validate .tmp/object-set.receipt.json",
      get: "After delivery, check what actually happened. The receipt names the check, time, namespace or target, and whether the cluster matched the desired objects.",
      see: ["verify-it-yourself.md", "why-synced-is-not-working.md"],
    },
    {
      title: "Rehearse rollback before you need it",
      status: "watch",
      boundary: "ConfigHub revisions and a live check",
      action: "compare live state with a previous approved revision",
      code: "cub unit diff <unit> --from=PreviousLiveRevisionNum --to=LiveRevisionNum\ncub-scout compare three-way --dry-from <previous-render.yaml>",
      get: "You see the difference between the current live app and the previous approved state. Today this is a rehearse-and-review path, because exact rollback automation depends on the app, the target, and any lifecycle step that cannot be undone.",
      see: ["day2-upgrade-story.md", "day2-upgrade-rollback.md", "cub-scout-diff-design.md"],
    },
  ];
  const seeLabels = new Map([
    ["change-routing-before-oci.md", "Where changes belong"],
    ["../data/external-scan-lane/summary.md", "Security scan results"],
    ["../data/variant-promotion/summary.md", "Promotion results"],
    ["prometheus-overlay-promotion-example.md", "Prometheus promotion example"],
    ["chain-of-proof.md", "How tests support each claim"],
    ["../data/runtime-gitops/summary.md", "GitOps test results"],
    ["verify-it-yourself.md", "Check it yourself"],
    ["why-synced-is-not-working.md", "Why a sync check is not enough"],
    ["day2-upgrade-story.md", "The day-2 upgrade story"],
    ["day2-upgrade-rollback.md", "Upgrade and rollback guide"],
    ["cub-scout-diff-design.md", "Three-way comparison design"],
  ]);
  const seeLink = (ref) => {
    const href = ref.startsWith("../") ? ref : `../docs/user/${ref}`;
    return `<a href="${href}">${escapeHtml(seeLabels.get(ref) ?? ref.replace(/\.md$/, ""))}</a>`;
  };
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
  <title>Operate saved configuration · Config Workshop</title>
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
    <h1>Operate saved configuration</h1>
  <p class="boundary-chip">Needs an account and a cluster</p>
    <p class="lead">Use this page after an application and its target already exist. It shows how to review a change, approve it, deliver it, and check the live result.</p>
    <p>ConfigHub keeps the desired configuration and revision history. OCI carries a reviewed release to Argo CD or Flux. Live checks show what reached the cluster.</p>
    <p>If you have not chosen a configuration yet, start with the Catalog, Variants, or Apps pages.</p>
  </header>
  <main>
    <section aria-labelledby="before-ops">
      <h2 id="before-ops">1. Check the starting point</h2>
      <p>The application needs a reviewed configuration, any environment changes, and a target or delivery path. If those choices are still open, start with the <a href="./charts/index.html">Component Catalog</a>, <a href="./variants.html">Variants</a>, or <a href="./journey.html">Apps</a>.</p>
    </section>

    <section aria-labelledby="ops">
      <h2 id="ops">2. Choose an operation</h2>
      <div class="card">
        <h3>Status legend</h3>
        <p><span class="badge now">available</span> runs today. <span class="badge watch">watch</span> has evidence plus a named limitation. Planned work still needs a product, policy, support, or service decision.</p>
        <p>A green GitOps sync tells you the controller accepted the manifest, which is a smaller claim than a working application. Where the claim depends on live state, use observation receipts.</p>
      </div>
${cards}
    </section>

    <section aria-labelledby="fleet-record">
      <h2 id="fleet-record">3. Keep a fleet record</h2>
      <p>The fleet use case begins when a platform team needs to know what many clusters should run and whether each cluster matches that record.</p>
      <p><strong>Use one visible sequence:</strong> choose the approved configuration, select targets by label, and preview the exact target list.</p>
      <p>Publish to a small wave, then inspect every target before continuing. The <a href="./d/docs/demo/sveltos/kyverno-fleet.html">Sveltos example</a> records two waves. Managed pause and resume controls are still planned.</p>
      <p>A useful record says: this cluster, customer, or environment should run this package release, this preset, these allowed inputs, this target, and these approval gates. The package fixes most choices ahead of time. Only a small, restricted set of settings remains at install time, so an upgrade does not become another free-form Helm exercise.</p>
      <table>
        <thead><tr><th>Fleet area</th><th>Who usually owns it</th><th>What ConfigHub records</th></tr></thead>
        <tbody>
          <tr><td>User workloads</td><td>Application teams</td><td>The approved app variant, target, inputs, policy gates, and release history.</td></tr>
          <tr><td>System services</td><td>Platform operators</td><td>Shared services such as DNS, monitoring, ingress, and storage, with controlled upgrades across clusters.</td></tr>
          <tr><td>System configuration</td><td>Cluster or fleet systems</td><td>Opt-in platform components such as GPU, network, security, and operator configuration, reconciled from a signed-off package and fleet record.</td></tr>
        </tbody>
      </table>
      <p>Read the <a href="../data/operational-class-examples/summary.md">three checked examples</a> for their owners, targets, checks, rollout order, and current evidence. They cover NGINX, Kube Prometheus Stack, and a Kubara platform configuration.</p>
      <p>This is why the site keeps separating package OCI from delivery OCI. The package is the vetted release you start from. The delivery artifact is what a controller reconciles after ConfigHub has recorded the desired state.</p>
    </section>

    <section aria-labelledby="next">
      <h2 id="next">4. Govern with the commercial product when needed</h2>
      <p>When the work carries private inputs, production responsibility, multiple teams, policy, SLA, or fleet scale, the <a href="./private/">Upgrade guide</a> describes what the commercial product governs.</p>
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
  <title>Ops · Config Workshop</title>
</head>
<body>
  <p>The day-1 operations page moved to <a href="./operations.html">Operate saved configuration</a>.</p>
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

function retainedInstallerRows(catalog, chart) {
  return catalog.installerOciPackages
    .filter((row) => row.chart === chart)
    .sort((left, right) => String(right.version).localeCompare(String(left.version), undefined, {
      numeric: true,
      sensitivity: "base",
    }));
}

function verifyRetainedCatalogPackage(row) {
  check(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(row.chart), `retained Catalog chart identity is unsafe: ${row.chart}`);
  check(/^v?[0-9][A-Za-z0-9.+_-]*$/.test(row.version), `${row.chart}: retained Catalog version is unsafe: ${row.version}`);
  check(row.package_path === `packages/${row.chart}/${row.version}`, `${row.chart}@${row.version}: package path is not canonical`);
  check(row.installer_yaml === `${row.package_path}/installer.yaml`, `${row.chart}@${row.version}: installer path is not canonical`);
  check(existsSync(join(repoRoot, row.installer_yaml)), `${row.chart}@${row.version}: retained installer package is missing`);
  check(
    (row.publication_status === "published-receipt" || row.publication_status === "assigned-ref")
      && /^oci:\/\/[^\s/@]+(?:\/[^\s/@]+)+:[^\s/@:]+$/.test(row.installer_oci_ref)
      && row.installer_oci_ref.endsWith(`:${row.version}`)
      && !row.installer_oci_ref.includes("@"),
    `${row.chart}@${row.version}: retained OCI publication identity is unsafe or incomplete`,
  );
  // A version can be retained before it is published. Such a row holds a
  // reserved ref and must claim nothing else; the catalog page says so in
  // words. Everything below applies to versions that do claim publication.
  if (row.publication_status === "assigned-ref") {
    check(
      !row.publication_receipt
        && !row.published_digest
        && !row.manifest_digest
        && !row.layer_digest
        && !row.digest_pinned_ref
        && !row.verify_command
        && row.signature_status === "unsigned"
        && !row.signature_receipt
        && !row.signature_bundle
        && !row.signature_verification_command,
      `${row.chart}@${row.version}: an unpublished version must not carry publication or verification data`,
    );
    verifyRetainedCatalogConfigurations(row);
    return;
  }
  check(
    row.publication_receipt.startsWith("runs/installer-oci/")
      && !row.publication_receipt.split("/").includes("..")
      && existsSync(join(repoRoot, row.publication_receipt)),
    `${row.chart}@${row.version}: publication receipt path is unsafe or missing`,
  );
  const receipt = readYaml(join(repoRoot, row.publication_receipt));
  check(receipt.kind === "InstallerPackagePublicationReceipt", `${row.chart}@${row.version}: publication receipt kind drifted`);
  check(receipt.spec?.ref === row.installer_oci_ref, `${row.chart}@${row.version}: receipt OCI ref differs from the catalog row`);
  check(receipt.spec?.package?.path === row.package_path, `${row.chart}@${row.version}: receipt package path differs from the catalog row`);
  check(receipt.spec?.package?.sha256 === row.published_digest, `${row.chart}@${row.version}: receipt package digest differs from the catalog row`);
  const pushOutput = String(receipt.spec?.outputs?.push ?? "");
  const layerDigest = receipt.spec?.outputs?.layerDigest
    ?? pushOutput.match(/layer:\s+(sha256:[0-9a-f]{64})/)?.[1]
    ?? "";
  const manifestDigest = receipt.spec?.outputs?.manifestDigest
    ?? pushOutput.match(/manifest:\s+(sha256:[0-9a-f]{64})/)?.[1]
    ?? "";
  check(layerDigest === `sha256:${row.published_digest}`, `${row.chart}@${row.version}: receipt layer digest differs from the exact package`);
  check(/^sha256:[0-9a-f]{64}$/.test(manifestDigest), `${row.chart}@${row.version}: receipt manifest digest is invalid`);
  check(row.manifest_digest === manifestDigest, `${row.chart}@${row.version}: catalog manifest digest differs from its receipt`);
  check(row.layer_digest === layerDigest, `${row.chart}@${row.version}: catalog layer digest differs from its receipt`);
  check(
    row.digest_pinned_ref === installerOciDigestRef(row.installer_oci_ref, manifestDigest),
    `${row.chart}@${row.version}: catalog exact OCI ref differs from its receipt`,
  );
  check(
    row.setup_command.includes(`--pull ${row.digest_pinned_ref} `),
    `${row.chart}@${row.version}: published setup command uses a mutable OCI ref`,
  );
  check(
    row.inspect_command === `cub installer inspect ${row.digest_pinned_ref} --json`
      && row.verify_command === row.inspect_command,
    `${row.chart}@${row.version}: published verification command is incomplete`,
  );
  check(
    /^[0-9a-f]{64}$/.test(receipt.spec?.outputs?.inspectJSONCanonicalSHA256 ?? receipt.spec?.outputs?.inspectJSONSHA256 ?? ""),
    `${row.chart}@${row.version}: receipt inspect digest is invalid`,
  );
  check(row.signature_status === "signed-receipt", `${row.chart}@${row.version}: published package is not signed`);
  check(
    row.signature_receipt.startsWith("runs/installer-oci-signatures/")
      && existsSync(join(repoRoot, row.signature_receipt)),
    `${row.chart}@${row.version}: signature receipt path is unsafe or missing`,
  );
  check(
    row.signature_bundle.startsWith("runs/installer-oci-signatures/")
      && existsSync(join(repoRoot, row.signature_bundle)),
    `${row.chart}@${row.version}: signature bundle path is unsafe or missing`,
  );
  const signatureReceipt = readYaml(join(repoRoot, row.signature_receipt));
  check(signatureReceipt.kind === "InstallerPackageSignatureReceipt", `${row.chart}@${row.version}: signature receipt kind drifted`);
  check(signatureReceipt.spec?.subject?.tagReference === row.installer_oci_ref, `${row.chart}@${row.version}: signature receipt ref differs`);
  check(signatureReceipt.spec?.subject?.manifestDigest === manifestDigest, `${row.chart}@${row.version}: signature receipt manifest differs`);
  check(signatureReceipt.spec?.verification?.command === row.signature_verification_command, `${row.chart}@${row.version}: signature verification command differs`);
  verifyRetainedCatalogConfigurations(row);
}

function verifyRetainedCatalogConfigurations(row) {
  const configurations = String(row.bases ?? "").split(";").filter(Boolean);
  const installer = readYaml(join(repoRoot, row.installer_yaml));
  const installerBases = Array.isArray(installer.spec?.bases) ? installer.spec.bases : [];
  const installerConfigurations = installerBases.map((base) => base.name).filter(Boolean);
  const installerDefault = installerBases.find((base) => base.default)?.name
    ?? installerConfigurations[0]
    ?? "default";
  check(
    configurations.length === Number(row.base_count)
      && new Set(configurations).size === configurations.length
      && configurations.includes(row.default_base)
      && JSON.stringify(configurations) === JSON.stringify(installerConfigurations)
      && row.default_base === installerDefault
      && installerBases.every((base) =>
        base.path === `bases/${base.name}`
          && existsSync(join(repoRoot, row.package_path, base.path))),
    `${row.chart}@${row.version}: packaged configuration inventory is inconsistent`,
  );
}

function retainedCatalogVersionCell(catalog, entry) {
  const rows = retainedInstallerRows(catalog, entry.chart);
  check(rows.length > 0, `${entry.chart}: retained installer package inventory is empty`);
  return rows.map((row) => {
    const href = `./${chartPageFileName(row)}`;
    const receiptHref = `https://github.com/confighub/helm-expt/blob/main/${row.publication_receipt}`;
    const identity = `${row.chart}@${row.version}`;
    const title = `retained published package; ${row.installer_oci_ref}`;
    const label = row.version === entry.version
      ? `<strong>${escapeHtml(row.version)}</strong>`
      : escapeHtml(row.version);
    return `<span data-retained-version-record="${escapeHtml(identity)}"><a data-retained-version="${escapeHtml(identity)}" href="${escapeHtml(href)}" title="${escapeHtml(title)}">${label}</a> <a data-publication-receipt="${escapeHtml(identity)}" href="${escapeHtml(receiptHref)}" rel="noopener" style="font-size:.8rem">receipt</a></span>`;
  }).join("<br>");
}

// The configuration names are the most useful strings on the row and used to be
// inert text, so the one link in the cell was the version receipt and the eye
// landed on words it could not click. Each name now opens the chart page's
// option cards.
function retainedCatalogConfigurationsCell(catalog, entry) {
  const rows = retainedInstallerRows(catalog, entry.chart);
  const page = `./${chartPageFileName(entry)}#matrix-options`;
  return rows.map((row) => {
    const configurations = String(row.bases ?? "").split(";").filter(Boolean);
    const label = configurations.length === 1 ? "configuration" : "configurations";
    const identity = `${row.chart}@${row.version}`;
    const links = configurations
      .map((name) => `<a href="${page}">${escapeHtml(name)}</a>`)
      .join(", ");
    return `<span data-packaged-configurations="${escapeHtml(identity)}" data-configuration-count="${configurations.length}"><strong>${escapeHtml(row.version)}</strong>: ${links}<br><span style="color:var(--muted);font-size:.85rem">${configurations.length} packaged ${label}</span></span>`;
  }).join("<br>");
}

// Whether a configuration survives being shipped as plain rendered YAML is the
// hardest fact the catalog holds about it, and it was reachable only by opening
// the chart page. The verdict is recorded per configuration, so the column
// reports it that way rather than collapsing a version to one answer.
function flatteningVerdictSearchText(catalog, entry) {
  const repository = String(entry.chart || "").split("/")[0];
  const name = String(entry.chart || "").split("/").slice(1).join("/");
  const row = (catalog.flatteningEvidence || []).find(
    (candidate) =>
      candidate.repository === repository &&
      candidate.chart === name &&
      candidate.version === entry.version,
  );
  return String(row?.decided_lanes || "").trim();
}

function flatteningVerdictCell(catalog, entry) {
  const repository = String(entry.chart || "").split("/")[0];
  const name = String(entry.chart || "").split("/").slice(1).join("/");
  const row = (catalog.flatteningEvidence || []).find(
    (candidate) =>
      candidate.repository === repository &&
      candidate.chart === name &&
      candidate.version === entry.version,
  );
  const decided = String(row?.decided_lanes || "").trim();
  if (!decided) return `<span data-flattening="undecided" style="color:var(--muted)">No verdict yet. Undecided is not the same as safe.</span>`;
  const parts = decided.split(";").map((part) => part.trim()).filter(Boolean);
  const lines = parts.map((part) => {
    const [base, verdict] = part.split(":").map((piece) => (piece || "").trim());
    return `${escapeHtml(base)}: <strong>${escapeHtml(verdict)}</strong>`;
  }).join("<br>");
  return `<span data-flattening="decided">${lines}</span>`;
}

function installerOciRefForEntry(entry) {
  return entry.installer_oci_ref || installerOciRef(entry.chart, entry.version);
}

function installerOciPullRefForEntry(entry) {
  return entry.installer_oci_digest_pinned_ref || installerOciRefForEntry(entry);
}

function installerOciStatusText(entry) {
  if (entry.installer_oci_publication_status === "published-receipt") return "publication receipt recorded";
  return "assigned public ref; publication receipt not committed yet";
}

function installerOciSignatureStatusText(entry) {
  if (entry.installer_oci_signature_status === "signed-receipt") return "publisher signature recorded and verified";
  return "publisher signature not recorded";
}

function installerPackageSignatureHtml({ status, command, receipt, bundle }) {
  if (status !== "signed-receipt" || !command) {
    return `<p><strong>Publisher signature:</strong> not recorded. A publication receipt alone does not identify who published the package.</p>`;
  }
  return `<details>
        <summary><strong>Verify the package publisher</strong></summary>
        <p>Run this command with <code>cosign</code>. It checks the expected publisher, the exact manifest digest, and the package annotations.</p>
        <pre><code>${escapeHtml(command)}</code></pre>
        <p>A valid signature identifies who signed these package bytes. It does not show that the configuration is suitable for your cluster; use this page's checks and setup instructions for that decision.</p>
        <p><a href="../../${escapeHtml(receipt)}">Signature receipt</a> · <a href="../../${escapeHtml(bundle)}">Sigstore bundle</a> · <a href="../d/docs/reference/installer-package-signing.html">How signature verification works</a></p>
      </details>`;
}

function firstPathCell(entry, row) {
  const variant = row?.variant && row.variant !== "(source)" ? row.variant : entry.start_variant || "choose base";
  const page = `./${chartPageFileName(entry)}#matrix-options`;
  let note = "Open the chart page for the command and option cards.";
  if (row?.row_kind === "candidate") note = "Candidate path; model the base before using it.";
  else if (row?.row_kind === "derived") note = "Derived ConfigHub variant; upload the base first.";
  else if (row?.row_kind === "base") {
    note = entry.proof_surface === "top20-catalog-supported"
      ? "Recommended configuration to try first."
      : "Available configuration. Read the chart page before use.";
  }
  return `<a href="${escapeHtml(page)}"><strong>${escapeHtml(variant)}</strong></a><br><span style="color:var(--muted);font-size:.9rem">${escapeHtml(note)}</span>`;
}

function catalogReadiness(entry, row) {
  if (entry.proof_surface === "retained-publication-only") {
    return {
      id: "package-published-review-before-use",
      label: "Package published; review before use",
      detail: "This exact package is published. Its runtime checks are not complete.",
    };
  }
  if (row?.row_kind === "candidate") {
    return {
      id: "not-ready-yet",
      label: "Not ready yet",
      detail: "This is a planned configuration, not a runnable package.",
    };
  }
  if (entry.proof_surface === "top20-catalog-supported") {
    return {
      id: "ready-to-try",
      label: "Ready to try",
      detail: "This is one of the strongest public starting points.",
    };
  }
  if (entry.proof_surface === "next80-proof-grade") {
    return {
      id: "review-before-use",
      label: "Review before use",
      detail: "Checks exist, but this chart still needs chart-specific review.",
    };
  }
  return {
    id: "not-ready-yet",
    label: "Not ready yet",
    detail: "Open the chart page to see what remains.",
  };
}

function catalogUseCell(entry, row) {
  const readiness = catalogReadiness(entry, row);
  return `<strong>${escapeHtml(readiness.label)}</strong><br><span style="color:var(--muted);font-size:.9rem">${escapeHtml(readiness.detail)}</span>`;
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
  if (entry.proof_surface === "retained-publication-only") {
    return "Publication is verified; target prerequisites and runtime behavior still require review.";
  }
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

function catalogBaseOptionsCell(rows) {
  const bases = rows.filter((row) => row.row_kind === "base");
  const visible = bases.map((row) => row.variant).filter(Boolean).slice(0, 4);
  return bases.length
    ? `${bases.length} configuration${bases.length === 1 ? "" : "s"}: ${visible.join(", ")}${bases.length > visible.length ? ", ..." : ""}`
    : "Open the chart page.";
}

function catalogComponentCategory(chart) {
  const matches = CATALOG_COMPONENT_CATEGORIES.filter((category) => category.pattern.test(chart));
  check(matches.length === 1, `${chart}: expected exactly one public Catalog category, found ${matches.length}`);
  return matches[0];
}

function renderedObjectsPathFromRevision(revisionPath) {
  if (!revisionPath) return "";
  return revisionPath.replace(/variant-revision\.yaml$/, "rendered/release-objects.yaml");
}

function chartIndexHtml(catalog) {
  const retention = buildRetentionSummary(catalog);
  const chartRowsHtml = catalog.catalogComponents
    .map((entry) => {
      const matrixRows = matrixRowsForCatalogEntry(catalog, entry);
      const firstRow = firstCatalogBaseRow(matrixRows, entry);
      const retainedRows = retainedInstallerRows(catalog, entry.chart);
      const category = catalogComponentCategory(entry.chart);
      const variants = entry.supported_variants || entry.candidate_variants || "";
      const status = entry.start_base_readiness || "see chart page";
      const readiness = catalogReadiness(entry, firstRow);
      const featureText = [
        entry.chart,
        entry.version,
        readiness.label,
        category.label,
        entry.start_variant,
        entry.supported_variants,
        entry.candidate_variants,
        status,
        entry.source_features,
        entry.not_yet_enabled,
        catalog.licensesByChartVersion?.get(`${entry.chart}|${entry.version}`)?.chart?.spdx
          ?? catalog.chartLicenseByChart?.get(entry.chart)?.spdx,
        ...retainedRows.flatMap((row) => [row.version, row.bases, row.installer_oci_ref]),
        // So a reader can filter by the answer as well as read it: searching
        // "flatten-with-routes" or "safe-to-flatten" narrows the table.
        flatteningVerdictSearchText(catalog, entry),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const hasHooks =
        /hook/i.test(entry.source_features || "") ||
        /hook/i.test(entry.not_yet_enabled || "") ||
        matrixRows.some((row) => Number(row.hook_count || 0) > 0 || String(row.lifecycle_route_contract || "n/a") !== "n/a");
      const hasCrds = /crd/i.test(entry.source_features || "") || /crd/i.test(variants) || matrixRows.some((row) => /crd/i.test(row.quirk_features || ""));
      const evidenceSurface = entry.proof_surface === "retained-publication-only" ? "publication-only" : "readiness-evidence";
      const succession = catalog.chartSuccessions?.get(entry.chart);
      const successorRole = catalog.chartSuccessorOf?.get(entry.chart);
      let successionNote = "";
      if (succession?.successors?.length) {
        const links = succession.successors.map((successor) => `<a href="${componentPageHref(catalog, successor.chart)}">${escapeHtml(successor.chart)}</a>`).join(" · ");
        successionNote = `<br><span style="color:var(--muted);font-size:.85rem">Successors recorded: ${links}</span>`;
      } else if (succession?.planned?.length) {
        successionNote = `<br><span style="color:var(--muted);font-size:.85rem">Successor picked, not yet a catalog entry</span>`;
      } else if (successorRole) {
        successionNote = `<br><span style="color:var(--muted);font-size:.85rem">Successor to <a href="${componentPageHref(catalog, successorRole.replaces)}">${escapeHtml(successorRole.replaces)}</a></span>`;
      }
      return `<tr data-chart-row data-kind="helm-chart" data-evidence-surface="${evidenceSurface}" data-readiness="${escapeHtml(readiness.id)}" data-category="${escapeHtml(category.id)}" data-status="${escapeHtml(status)}" data-hooks="${hasHooks ? "yes" : "no"}" data-crds="${hasCrds ? "yes" : "no"}" data-search="${escapeHtml(featureText)}">
        <td><a href="./${chartPageFileName(entry)}">${escapeHtml(entry.chart)}</a><br><span style="color:var(--muted);font-size:.85rem">${escapeHtml(category.label)}</span>${successionNote}</td>
        <td>${retainedCatalogVersionCell(catalog, entry)}</td>
        <td>${firstPathCell(entry, firstRow)}</td>
        <td>${catalogUseCell(entry, firstRow)}</td>
        <td>${watchFirstCell(entry, matrixRows, firstRow)}</td>
        <td>${flatteningVerdictCell(catalog, entry)}</td>
        <td>${retainedCatalogConfigurationsCell(catalog, entry)}</td>
      </tr>`;
    })
    .join("\n");

// The AICR entries are catalog entries, and until now the Catalog page did not
// mention them once. A reader told to bring "an AICR recipe for AI" arrived at
// the Catalog, searched, and found nothing — the entries were reachable only
// through a demo link on the Examples page. This renders them from the same
// register the entry-naming gate checks, so the list cannot drift from the
// entries that actually exist.
function aicrCatalogRows() {
  const register = readYaml(join(repoRoot, "examples/aicr/claims/entry-names.yaml"));
  const entries = register?.spec?.entries ?? [];
  check(entries.length > 0, "AICR entry register has no entries; the Catalog would list none");
  const needs = {
    "cpu-starter": "Nothing. No GPU, no cloud account, no NGC key.",
    "eks-h100-training-kubeflow": "AWS and GPU capacity to run it. Reading it costs nothing.",
    "eks-h100-training-kubeflow-v0-18-0": "AWS and GPU capacity to run it. Reading it costs nothing.",
    "eks-h100-training-kubeflow-v0-19-0": "Reading and local verification need no cloud account or GPU. Running it needs EKS and H100 capacity.",
    "eks-h100-training-kubeflow-v0-20-0": "Pulling and inspection need no ConfigHub account, cloud account, or GPU. Running it needs EKS and H100 capacity.",
    "eks-h100-inference-nim": "AWS, GPU capacity, and NGC access for the model images.",
    "kserve-nim-inference": "AWS, GPU capacity, and NGC access for the model images.",
  };
  const builds = {
    "cpu-starter": "The platform spine without accelerators.",
    "eks-h100-training-kubeflow": "EKS, H100 nodes, Kubeflow, and a training job.",
    "eks-h100-training-kubeflow-v0-18-0": "The same training platform, regenerated four minor versions later.",
    "eks-h100-training-kubeflow-v0-19-0": "The training platform with public OCI, ConfigHub variants, and a release OCI.",
    "eks-h100-training-kubeflow-v0-20-0": "The newest retained training platform, with public source and literal-configuration OCI.",
    "eks-h100-inference-nim": "A cluster that can serve NIM models.",
    "kserve-nim-inference": "The exact shape one model runs in.",
  };
  return entries.map((entry) => {
    const id = String(entry.id);
    const page = `../d/${String(entry.page).replace(/\.md$/, ".html")}`;
    const version = String(entry.retainedVersion);
    const search = [id, "aicr", "ai platform", version, builds[id] ?? "", needs[id] ?? "", (entry.names ?? []).join(" ")]
      .join(" ")
      .toLowerCase();
    return `<tr data-chart-row data-kind="ai-platform" data-level="" data-status="" data-hooks="" data-crds="" data-search="${escapeHtml(search)}">
        <td><a href="${page}">${escapeHtml(id)}</a><br><span style="color:var(--muted);font-size:.85rem">AI platform entry, from an AICR recipe</span></td>
        <td class="mono">${escapeHtml(version)}</td>
        <td><a href="${page}">Read the entry</a></td>
        <td>${escapeHtml(builds[id] ?? "An AI platform entry.")}</td>
        <td>${escapeHtml(needs[id] ?? "")}</td>
        <td><span style="color:var(--muted)">Flattening is decided per generated layer. A retained wrapper can be flat while nested charts or other sources are processed later.</span></td>
        <td>Retained exactly as generated. <a href="../d/docs/demo/aicr/index.html">How these entries work</a></td>
      </tr>`;
  }).join("\n");
}

function aicrEntriesSection() {
  const register = readYaml(join(repoRoot, "examples/aicr/claims/entry-names.yaml"));
  const entries = register?.spec?.entries ?? [];
  check(entries.length > 0, "AICR entry register has no entries; the Catalog section would be empty");
  const rows = entries.map((entry) => {
    const page = `../d/${String(entry.page).replace(/\.md$/, ".html")}`;
    const names = (entry.names ?? []).map((name) => escapeHtml(name)).join(", ");
    return `<tr><td><a href="${page}">${escapeHtml(entry.id)}</a></td><td class="mono">${escapeHtml(String(entry.retainedVersion))}</td><td>${names}</td></tr>`;
  }).join("\n            ");
  return `<section id="aicr" data-aicr-entries aria-labelledby="aicr-title">
      <h2 id="aicr-title">AI infrastructure configurations</h2>
      <p>Use this section when your starting point is a model runtime or a complete AI platform rather than one Helm chart. Start with the smallest path that answers your question.</p>
      <p>Already have GPU nodes? <code>aicr snapshot</code> and <code>aicr diff</code> report how their current state differs without a recipe, bundle, or matching Catalog entry. A difference is not automatically a fault. Compare each node with the provider-curated source variant intended for its hardware and workload before deciding what should change. <a href="../try-aicr.html">Open the AICR starting paths</a>.</p>
      ${inferenceFamilyTable("..")}
      <h3>Retained AICR entries</h3>
      <p>Each AICR entry names the provider-curated source variant, exact version, generated files, pinned digest, and evidence for its claims. NVIDIA curates the built-in catalog; another catalog provider can publish and review additional variants.</p>
      <div class="card"><table>
        <thead><tr><th>Entry</th><th>Retained version</th><th>Also called</th></tr></thead>
        <tbody>
            ${rows}
        </tbody>
      </table></div>
      <p><a href="../d/docs/demo/aicr/index.html">Open the full AICR catalog index</a> for the retained recipes, versions, and proof details.</p>
    </section>`;
}

function timoniEntrySection() {
  return `<section id="timoni" aria-labelledby="timoni-title">
      <h3 id="timoni-title">Timoni Redis</h3>
      <p>The first Timoni entry uses Redis so you can compare it with the Helm Redis configurations above. The inputs are different, but the Catalog asks the same questions: which immutable source was selected, which objects did it produce, what lifecycle work sits around those objects, and what has actually been tested?</p>
      ${markdownLikeTable([
        ["Entry", "What is retained", "Current result"],
        ["Redis 8.10.1 default", "Immutable module digest, typed options, selected defaults, seven exact objects, master-first apply order, optional test, and destination requirements.", "Cluster-free build and anonymous OCI pull passed. A ConfigHub base and linked development variant exist. Kubernetes apply, health, upgrade, rollback, and GitOps have not run."],
      ])}
      <p><a href="../../examples/timoni/redis-8-10-1/README.md">Read the Timoni Redis entry</a> · <a href="../../data/helm-catalog-readmes/spaces/timoni-redis-8-10-1-base/README.md">Read the ConfigHub base guide</a> · <a href="../../data/helm-catalog-readmes/spaces/timoni-redis-8-10-1-dev/README.md">Read the development variant</a> · <a href="../../data/timoni-redis-catalog-proof/summary.md">Check the proof and limits</a> · <a href="../../data/base-variant-records/records/timoni-redis-8-10-1-default.yaml">Open its source-neutral Catalog record</a> · <a href="./index.html?q=redis#charts">Compare Helm Redis entries</a></p>
    </section>`;
}

  const catalogContextHtml = `<section aria-labelledby="catalog-summary">
      <h2 id="catalog-summary">What stays available</h2>
      <p>The catalog retains ${retention.retained_package_versions} exact package versions across ${retention.retained_components} components. ${retention.published_package_versions} have a dated registry receipt; the oldest current receipt is from ${retention.oldest_publication_receipt_at.slice(0, 10)}. A new review adds a version. It does not silently replace an older package.</p>
      <p>We have caught ${retention.upstream_republished_version_pairs} cases where an upstream publisher changed the bytes behind an existing version string. The catalog keeps the reviewed bytes and records both digests so you can see the change. <a href="../d/data/upstream-drift/summary.html">Read those cases</a>.</p>
      <p>A chart is listed only after its license evidence is recorded. Normal refreshes are additive. If a legal or factual correction is required, the change must be named rather than hidden. <a href="../d/docs/reference/how-the-catalog-is-built.html">Read the retention policy</a>.</p>
      <h3>What each catalog entry contains</h3>
      <p>Every version has a local detail page for its package, configurations, and receipt. The bold version in each row is the one summarized by that row's readiness and evidence. Retained-only version pages prove publication and inspect identity; they do not inherit another version's readiness or live proof.</p>
      <h3 id="base-variants">Why the catalog offers several configurations</h3>
      <p>A Helm chart can expose hundreds of values. The catalog provides tested starting configurations for common choices, such as existing Secrets, high availability, or separately managed CRDs.</p>
      <p>We call each starting configuration a base variant. Its page records the Helm values, rendered YAML, required setup, and evidence for that choice.</p>
      <p>Useful choices differ by chart. Redis, Argo CD, and kube-prometheus-stack do not need the same starting configurations.</p>
      <p><a href="../how-it-works.html#setting-sources">See where Helm values, later ConfigHub changes, install work, and live state belong</a>.</p>
      <p>Every maintained entry uses the same <a href="../d/docs/user/model-and-vocabulary.html">configuration processing model</a>. The generated <a href="../d/data/base-variant-records/summary.html">alignment report</a> shows which records have complete flattening, ownership, and destination-route evidence and which still have gaps.</p>
    </section>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Component Catalog · Config Workshop</title>
  <style>${siteCss()}
    #chart-table { table-layout: fixed; }
    #chart-table th, #chart-table td { width: 16.6667%; white-space: normal; }
  </style>
</head>
<body>
  <header>
    ${topNav("..")}
    <h1>Find a Tested Configuration</h1>
  <p class="boundary-chip">Runs on your laptop</p>
    <p class="lead">Choose a tested starting configuration for a Helm component, a typed module, or an AI infrastructure stack.</p>
    <p>Each entry separates four answers: what the source contains, what it produces, whether a named destination can accept it, and what happened after deployment.</p>
    <p>Helm is the largest section. Each chart page shows the values, rendered Kubernetes objects, required setup, checks, and known limits. The AI infrastructure section starts with a CPU model and continues into AICR, NIM, and EKS.</p>
    <p>A new review adds a version instead of replacing the package you already used.</p>
    <p>If your chart, version, or question is missing, <a href="../ask.html">check your own configuration</a>. A useful public result can become a new Catalog configuration, test, or named warning.</p>
    <p>Already chose a configuration? <a href="../promote.html">Compare its next version or environment before it moves</a>.</p>
  </header>
  <main>
    <section aria-labelledby="charts">
      <h2 id="charts">Search Helm Configurations</h2>
      <h3 id="catalog-questions">Read each result correctly</h3>
      <p>The Catalog can give you a source and exact objects without a cluster. Destination and live answers appear only when the required target or deployment evidence exists.</p>
      ${markdownLikeTable([
        ["Question", "What the Catalog shows", "What it needs"],
        ["What do I have?", "The exact source, version, choices, package, files, or snapshot.", "No Catalog match, destination, or deployment is required."],
        ["What will it produce?", "The exact materialized Kubernetes objects and their identity.", "The source-native processor, unless the source is already literal configuration."],
        ["Can this destination accept it?", "A check of APIs, CRDs, Secrets, policies, controllers, hardware, and lifecycle work for one named destination.", "Destination access; the candidate does not need to be deployed."],
        ["Did it work?", "The recorded controller, resource, workload, runtime, drift, and rollback results that were actually checked.", "The exact selected revision must have been deployed."],
      ])}
      <p>Pick a chart and version. Its page shows the package digest, available configurations, and the evidence attached to that exact version.</p>
      <div class="card">
        <label for="chart-filter"><strong>Search Helm charts</strong></label>
        <input id="chart-filter" type="search" placeholder="component, version, configuration, CRD..." style="width:100%; margin:8px 0 12px; padding:10px; border:1px solid var(--line); border-radius:8px;">
        <div class="grid">
          <label>Readiness<br><select id="level-filter"><option value="">All</option><option value="ready-to-try">Ready to try</option><option value="review-before-use">Review before use</option><option value="package-published-review-before-use">Package published; review before use</option><option value="not-ready-yet">Not ready yet</option></select></label>
          <label>Workload category<br><select id="category-filter"><option value="">All</option>${CATALOG_COMPONENT_CATEGORIES.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.label)}</option>`).join("")}</select></label>
          <label>First configuration<br><select id="status-filter"><option value="">All</option><option value="start-here">Recommended first path</option><option value="render-only">Rendering checked; read page</option><option value="see chart page">Read chart page</option></select></label>
          <label>Hooks<br><select id="hook-filter"><option value="">All</option><option value="yes">Needs lifecycle review</option><option value="no">No hook signal recorded</option></select></label>
          <label>CRDs<br><select id="crd-filter"><option value="">All</option><option value="yes">Includes or needs CRDs</option><option value="no">No CRD signal recorded</option></select></label>
        </div>
        <p><strong>Ready to try</strong> entries have maintained starting configurations and stronger public examples. <strong>Review before use</strong> entries have checks but need more chart-specific review. <strong>Package published; review before use</strong> confirms the exact package is available but does not claim that its runtime checks are complete. <strong>Not ready yet</strong> marks a planned path that is not runnable.</p>
        <p class="mono" id="chart-filter-count" style="font-size:.9rem"></p>
        <p>Chart not listed here? Any public chart still renders locally with no account: <code>helm template rel &lt;chart&gt; -f your-values.yaml --include-crds</code>. <a href="../ask.html">Check one question about the result</a>, then choose whether to report a public finding for Catalog review.</p>
      </div>
      <div class="card"><table id="chart-table">
        <thead><tr><th>Component</th><th>Retained published package versions</th><th>Start here</th><th>Status</th><th>Check first</th><th>Flattens as plain YAML?</th><th>Packaged configurations by version</th></tr></thead>
        <tbody>
${chartRowsHtml}
        </tbody>
      </table></div>
      <script>
        (() => {
          const rows = Array.from(document.querySelectorAll("[data-chart-row]"));
          const text = document.getElementById("chart-filter");
          const level = document.getElementById("level-filter");
          const category = document.getElementById("category-filter");
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
                (!level.value || row.dataset.readiness === level.value) &&
                (!category.value || row.dataset.category === category.value) &&
                (!status.value || row.dataset.status === status.value) &&
                (!hooks.value || row.dataset.hooks === hooks.value) &&
                (!crds.value || row.dataset.crds === crds.value);
              row.style.display = ok ? "" : "none";
              if (ok) visible += 1;
            }
            if (visible === 0) {
              count.innerHTML = 'No Helm chart matches these filters. <a href="../ask.html">Check your chart and values locally</a>, then tell us if the result should become a Catalog entry.';
            } else {
              count.textContent = visible + " of " + rows.length + " Helm charts shown; ${catalog.summary.retainedPackageVersions} retained package versions remain available";
            }
          };
          // A filtered view is worth sharing, so the query lives in the URL:
          // charts/index.html?q=eks-inference lands on those rows directly.
          const controls = [["q", text], ["level", level], ["category", category], ["status", status], ["hooks", hooks], ["crds", crds]];
          const params = new URLSearchParams(window.location.search);
          for (const [name, node] of controls) {
            const value = params.get(name);
            if (value) node.value = value;
          }
          const remember = () => {
            const next = new URLSearchParams(window.location.search);
            for (const [name, node] of controls) {
              const value = String(node.value || "").trim();
              if (value) next.set(name, value);
              else next.delete(name);
            }
            const query = next.toString();
            history.replaceState(null, "", query ? "?" + query + window.location.hash : window.location.pathname + window.location.hash);
          };
          [text, level, category, status, hooks, crds].forEach((node) => node.addEventListener("input", () => { update(); remember(); }));
          update();
        })();
      </script>
    </section>

    ${catalogContextHtml}

    ${aicrEntriesSection()}

    ${timoniEntrySection()}

    <section aria-labelledby="actions">
      <h2 id="actions">How the catalog handles required setup</h2>
      <p>Helm charts often include work outside the main rendered objects: CRDs, hooks, setup jobs, generated Secrets, cloud accounts, and resources that must already exist in the target cluster.</p>
      <p>The chart page names that work before you choose a configuration. It may offer a no-CRDs option, require an existing Secret, include a tested setup step, or block an unsafe path.</p>
      <p><a href="../../docs/user/chart-hooks-what-happens.md">Read what happens to chart hooks</a> · <a href="../../docs/reference/what-hook-support-means.md">Read the detailed support terms</a></p>
    </section>

    <section aria-labelledby="after-catalog">
      <h2 id="after-catalog">After you choose</h2>
      <p>Open the chart page and follow its first command. Inspect the generated objects and required setup before you decide where they should run.</p>
      <p>Choosing several components for a platform? <a href="../kubara.html"><strong>Build a small Kubara platform</strong></a> from tested Catalog entries, with optional digest-pinned runtime images recorded beside it.</p>
      <p><a href="../how-it-works.html">Choose how to deploy the reviewed configuration</a>.</p>
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

function catalogReadinessLabel(entry) {
  return catalogReadiness(entry).label;
}

function catalogStartStatusLabel(value) {
  return {
    "start-here": "Recommended first path",
    "render-only": "Rendering checked; read the chart page",
    "runtime-watch": "Use with care; check the live limits",
    "see chart page": "Read the chart page",
  }[value] ?? humanizeReasonToken(value || "Status not recorded");
}

function productionStatusLabel(value) {
  return {
    "production-review-ready": "Ready for a target-specific production review",
    "blocked-by-current-scan-gate": "Blocked by the current scan gate",
  }[value] ?? humanizeReasonToken(value || "Status not recorded");
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
  return parts.join(" ") || "No test results are recorded yet.";
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
  const packaged = packagedRequirementDescription(requirement);
  if (packaged) return packaged;
  const suggestedSource = String(requirement.suggestedSource ?? "").trim();
  if (!suggestedSource) return "Create or confirm this before apply.";
  const namespace = String(requirement.namespace ?? "").trim();
  const namespaceStep = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(namespace)
    && suggestedSource.startsWith(`kubectl -n ${namespace} `)
    ? `<code>kubectl create namespace ${escapeHtml(namespace)} --dry-run=client -o yaml | kubectl apply -f -</code><br>`
    : "";
  return `${namespaceStep}<code>${escapeHtml(suggestedSource)}</code>`;
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
  const aicrScriptRelPath = "sh/aicr-cpu-starter/try.sh";
  const scripts = [{
    relPath: aicrScriptRelPath,
    path: join(siteRoot, aicrScriptRelPath),
    content: aicrCpuStarterTryScript(SITE_BASE_URL),
  }];
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
// objects, image references, lifecycle routes, and completed checks. Every
// figure comes from committed data, so the strip renders only what exists.
function chartStatStrip(catalog, entry, firstRunnableRow) {
  const variant = firstRunnableRow?.variant || entry.start_variant;
  if (!variant) return "";
  const objects = countRenderedObjects(entry, variant);
  const images = extractBaseImages(entry, variant).length;
  const routes = Number.parseInt(firstRunnableRow?.lifecycle_route_count || "0", 10) || 0;
  const intent = catalog.helmRenderIntents.find((candidate) =>
    candidate.chart === entry.chart
      && candidate.version === entry.version
      && candidate.base === variant) ?? null;
  const prerequisites = Number(intent?.target_requirement_count || 0);
  const laneKeys = Object.keys(firstRunnableRow || {}).filter((key) => key.startsWith("lane_"));
  const laneValues = laneKeys.map((key) => firstRunnableRow[key]);
  const lanesScored = laneValues.filter((value) => value === "yes" || value === "no").length;
  const lanesPassing = laneValues.filter((value) => value === "yes").length;
  const stats = [];
  if (objects) stats.push(`<strong>${objects}</strong> rendered objects`);
  stats.push(`<strong>${images}</strong> image${images === 1 ? "" : "s"}`);
  if (intent) stats.push(`<strong>${prerequisites}</strong> target prerequisite${prerequisites === 1 ? "" : "s"}`);
  stats.push(`<strong>${routes}</strong> hook or setup route${routes === 1 ? "" : "s"}`);
  if (lanesScored) stats.push(`<strong>${lanesPassing}/${lanesScored}</strong> checks passing`);
  return `<p class="stat-strip">${variant} configuration: ${stats.join(" · ")}. These counts come from the linked test records.</p>`;
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
    ["Target used", escapeHtml(chartPageText(targetParts.join("; ") || "not recorded"))],
    ["Observed result", `<strong>${escapeHtml(spec.observedResult || "not recorded")}</strong>`],
    ["What passed", passed.length ? passed.map((item) => escapeHtml(chartPageText(item))).join("<br>") : "No passed checks listed."],
    ["What the result means", escapeHtml(chartPageText(remaining))],
  ];
  if (spec.previousObservation?.detail) {
    rows.push(["Earlier result", escapeHtml(chartPageText(spec.previousObservation.detail))]);
  }
  if (boundaries.length) {
    rows.push(["What this does not prove", boundaries.map((item) => escapeHtml(chartPageText(item))).join("<br>")]);
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

// One-line chart license statement for a page header. Per-version artifact
// index licenses win; the researched chart-level record covers the rest and
// names its evidence basis and read date.
function chartLicenseLineHtml(catalog, chart, version) {
  const versionLicenses = catalog.licensesByChartVersion?.get(`${chart}|${version}`);
  if (versionLicenses) {
    return `<p>Licenses: chart <strong>${escapeHtml(versionLicenses.chart.spdx)}</strong> (${escapeHtml(versionLicenses.chart.evidence)})${(versionLicenses.images ?? []).length ? `; images: ${versionLicenses.images.map((image) => `${escapeHtml(image.component)} <strong>${escapeHtml(image.spdx)}</strong>${image.note ? ` (${escapeHtml(image.note)})` : ""}`).join("; ")}` : ""}.</p>`;
  }
  const record = catalog.chartLicenseByChart?.get(chart);
  if (!record) return "";
  const conflictNote = record.conflict ? " One source states it differently; the committed record keeps both statements." : "";
  return `<p>Licenses: chart <strong>${escapeHtml(record.spdx)}</strong> (<a href="https://github.com/confighub/helm-expt/blob/main/data/chart-licenses/chart-licenses.yaml">${escapeHtml(record.evidence.label)}, read ${escapeHtml(catalog.chartLicensesResearchedAt)}</a>).${conflictNote} This describes the chart templates, not the packaged application images.</p>`;
}

// Canonical catalog page for a component, for cross-linking successions.
function componentPageHref(catalog, chart) {
  const component = catalog.catalogComponents?.find((entry) => entry.chart === chart);
  return component ? `./${chartPageFileName(component)}` : "./index.html";
}

// Succession callout for a chart page header. Both directions render: a
// component with recorded successors names them, and a successor names what
// it can replace. Successions are recommendations to evaluate, not automatic
// replacements. The upstream-exposure sentence states only the measured
// fact and its date.
function successionCalloutHtml(catalog, chart) {
  const succession = catalog.chartSuccessions?.get(chart);
  const successorRole = catalog.chartSuccessorOf?.get(chart);
  const exposure = catalog.upstreamExposureByChart?.get(chart);
  const sentences = [];
  if (exposure && Number(exposure.httpStatus) >= 400) {
    sentences.push(`The pinned upstream source download for this component returned HTTP ${escapeHtml(String(exposure.httpStatus))} when measured on ${escapeHtml(catalog.upstreamExposureMeasuredAt)}. The retained packages and publications recorded here stay pullable from this catalog's registry.`);
  }
  if (succession?.successors?.length) {
    const links = succession.successors
      .map((successor) => `<a href="${componentPageHref(catalog, successor.chart)}">${escapeHtml(successor.chart)}</a> (${escapeHtml(successor.shape)}; ${escapeHtml(successor.note)})`)
      .join(" · ");
    sentences.push(`Recorded successors: ${links}. These are recommendations to evaluate, not automatic replacements.`);
  }
  if (succession && !succession.successors?.length && succession.planned?.length) {
    sentences.push(`The successor survey picked ${succession.planned.map((plan) => `${escapeHtml(plan.name)} (${escapeHtml(plan.note)})`).join("; ")}.`);
  }
  if (successorRole) {
    sentences.push(`This component is recorded as a successor to <a href="${componentPageHref(catalog, successorRole.replaces)}">${escapeHtml(successorRole.replaces)}</a>. ${escapeHtml(successorRole.note)}`);
  }
  if (!sentences.length) return "";
  sentences.push(`Read the <a href="../d/data/bitnami-successors/successors.html">successor survey</a> and the <a href="../d/docs/user/image-registry-migration.html">registry migration guide</a>.`);
  return `<div class="card" data-succession-note><p>${sentences.join(" ")}</p></div>`;
}

function sharedLocalChecksSectionHtml(catalog, entry) {
  const checks = (catalog.catalogSharedChecks?.entries ?? [])
    .filter((check) => check.chart === entry.chart && check.version === entry.version)
    .sort((left, right) => left.base.localeCompare(right.base));
  if (!checks.length) return "";
  const scanner = catalog.catalogSharedChecks.scanner;
  const rows = checks.map((check) => {
    const severities = [
      check.severityCounts.critical ? `${check.severityCounts.critical} critical` : "",
      check.severityCounts.warning ? `${check.severityCounts.warning} warning` : "",
      check.severityCounts.info ? `${check.severityCounts.info} info` : "",
    ].filter(Boolean).join(", ");
    const findingNames = check.findings.slice(0, 3).map((finding) => escapeHtml(finding.name));
    const result = check.findingCount === 0
      ? "<strong>No finding from this ruleset</strong>"
      : `<strong>${escapeHtml(String(check.findingCount))} advisory finding${check.findingCount === 1 ? "" : "s"}</strong><br>${escapeHtml(severities)}${findingNames.length ? `<br>${findingNames.join("<br>")}` : ""}`;
    return [
      `<code>${escapeHtml(check.base)}</code>`,
      result,
      `${escapeHtml(String(check.objectCount))} objects<br><code>${escapeHtml(check.objectSetSHA256)}</code>`,
      escapeHtml(check.scanTime.slice(0, 10)),
      `<a href="../../${escapeHtml(check.sharedReceiptPath)}">Full <code>cub check</code> result</a><br><a href="../../${escapeHtml(check.renderPath)}">Exact YAML</a><br><a href="../../${escapeHtml(check.catalogReceiptPath)}">Separate Catalog review</a>`,
    ];
  });
  return `<section aria-labelledby="shared-local-checks">
      <h2 id="shared-local-checks">Local Configuration Checks</h2>
      <p>We ran <code>${escapeHtml(scanner.command)} ${escapeHtml(scanner.version)}</code> against the exact rendered objects for every configuration below. The result is advisory: read each finding and decide whether it matters for your target.</p>
      <details>
        <summary>Scanner and ruleset identity</summary>
        <p>Pattern bundle: <code>${escapeHtml(scanner.bundleVersion)}</code><br>Bundle manifest: <code>sha256:${escapeHtml(scanner.bundleManifestSHA256)}</code><br>Risk catalog: <code>sha256:${escapeHtml(scanner.catalogSHA256)}</code></p>
      </details>
      ${markdownLikeTable([
        ["Configuration", "Advisory result", "Exact input", "Checked", "Evidence"],
        ...rows,
      ], { rawFirstColumn: true, rawSecondColumn: true, rawThirdColumn: true, rawFourthColumn: true, rawFifthColumn: true })}
      <p><strong>What this does not check:</strong> hook execution, CRD readiness, target Secrets and cloud services, admission behavior, workload health, or rollback. The linked Catalog review covers chart-specific source and operating questions. ConfigHub validation and approval are separate managed controls.</p>
      <p><a href="../d/data/catalog-shared-checks/summary.html">Read all shared check results and the mapping to Catalog rules</a>.</p>
    </section>`;
}

function configurationDecisionExampleHtml(entry) {
  if (entry.chart !== "bitnami/nginx" || entry.version !== "24.0.2") return "";
  return `
    <section aria-labelledby="configuration-decision-example">
      <h2 id="configuration-decision-example">From a finding to a retained decision</h2>
      <p>A worked configuration for this chart starts with AI-written values. It records what each local finding meant, the fixes that were accepted, and one remaining emptyDir finding that is allowed only for an exact development and staging test.</p>
      <p>The reviewed objects, decision, ConfigHub validation, approval, promotion, and Argo CD results remain separate records. That makes it clear which checks were local advice, which controls ConfigHub evaluated, and which targets actually ran.</p>
      <p><a href="../d/data/config-review-decision-chain/summary.html">Read the complete worked decision</a> · <a href="../configuration-decision.schema.json">Open the decision schema</a></p>
    </section>`;
}

function baseVariantRecordFor(chart, version, base) {
  return baseVariantRecords.find((record) =>
    record.metadata?.labels?.component === chart
      && record.metadata?.labels?.sourceVersion === version
      && record.metadata?.labels?.base === base) ?? null;
}

function assessmentStateText(stage) {
  const labels = {
    available: "Available to inspect",
    pass: "Checked: passed",
    watch: "Checked: review the limit",
    fail: "Checked: failed",
    pending: "Answer pending",
    "not-run": "Not run",
    blocked: "Blocked",
    "not-applicable": "Not applicable",
  };
  const result = labels[stage.resultState] ?? sentenceCase(stage.resultState);
  const evidence = {
    completed: "evidence recorded",
    pending: "evidence pending",
    "not-run": "no run recorded",
    blocked: "evidence blocked",
    "not-applicable": "no evidence required",
  }[stage.evidenceState] ?? sentenceCase(stage.evidenceState);
  return `${result}<br><span class="small">${escapeHtml(evidence)}</span>`;
}

function assessmentQuestionsHtml(record) {
  if (!record) {
    return `<section aria-labelledby="assessment-questions">
      <h2 id="assessment-questions">Four Separate Questions</h2>
      <p>No source-neutral assessment record is available for this exact configuration. Do not infer destination or live results from the package page.</p>
    </section>`;
  }
  const rows = record.spec.assessment.stages.map((stage) => [
    `<strong>${escapeHtml(stage.question)}</strong>`,
    escapeHtml(stage.answer),
    [
      `Destination access: ${stage.destinationAccessRequired ? "yes" : "no"}`,
      `Selected configuration deployed: ${stage.deploymentRequired ? "yes" : "no"}`,
    ].join("<br>"),
    assessmentStateText(stage),
  ]);
  return `<section aria-labelledby="assessment-questions">
    <h2 id="assessment-questions">Four Separate Questions</h2>
    <p>Inspecting a source, producing objects, checking a destination, and checking a live result are different jobs. A Catalog match is useful for comparison but is not required. A missing destination or deployment is shown as not run or blocked, not as a failed configuration.</p>
    ${markdownLikeTable([
      ["Question", "Current answer", "What it needs", "Status"],
      ...rows,
    ], {
      rawFirstColumn: true,
      rawSecondColumn: true,
      rawThirdColumn: true,
      rawFourthColumn: true,
    })}
    <p><a href="${GITHUB_BLOB_BASE_URL}data/base-variant-records/records/${escapeHtml(record.metadata.name)}.yaml">Open the complete assessment, source, lifecycle, and evidence record</a>.</p>
  </section>`;
}

function retainedVersionPageHtml(catalog, row, coverageEntry) {
  const identity = `${row.chart}@${row.version}`;
  const assessmentRecord = baseVariantRecordFor(row.chart, row.version, row.default_base);
  const kpsManagedPromotion = identity === "prometheus-community/kube-prometheus-stack@86.1.0";
  const configurations = String(row.bases ?? "").split(";").filter(Boolean);
  const published = row.publication_status === "published-receipt";
  const receipt = published ? readYaml(join(repoRoot, row.publication_receipt)) : null;
  const pushOutput = String(receipt?.spec?.outputs?.push ?? "");
  const manifestDigest = receipt?.spec?.outputs?.manifestDigest
    ?? pushOutput.match(/manifest:\s+(sha256:[0-9a-f]{64})/)?.[1]
    ?? "";
  const layerDigest = row.layer_digest || (published ? `sha256:${row.published_digest}` : "");
  const digestPinnedRef = row.digest_pinned_ref
    || (published && manifestDigest ? installerOciDigestRef(row.installer_oci_ref, manifestDigest) : "");
  const packageSignatureHtml = installerPackageSignatureHtml({
    status: row.signature_status,
    command: row.signature_verification_command,
    receipt: row.signature_receipt,
    bundle: row.signature_bundle,
  });
  const componentVersions = retainedInstallerRows(catalog, row.chart);
  const evidenceEntry = catalog.catalogEntries.find((entry) => entry.chart === row.chart);
  const evidenceVersionNote = evidenceEntry
    ? `The component row's readiness, caveats, and live evidence describe only its bold version. For that separate evidence, open the <a href="./${chartPageFileName(evidenceEntry)}">${escapeHtml(evidenceEntry.version)} evidence page</a>.`
    : "This component has no separate evidence-bearing version yet, so no other version's readiness applies here. The publication receipt above carries the whole current claim.";
  const versionLinks = componentVersions.map((candidate) => {
    const label = candidate.version === row.version
      ? `<strong>${escapeHtml(candidate.version)}</strong>`
      : escapeHtml(candidate.version);
    return `<a href="./${chartPageFileName(candidate)}">${label}</a>`;
  }).join(" · ");
  const configurationList = configurations
    .map((configuration) => `<li><code>${escapeHtml(configuration)}</code>${configuration === row.default_base ? " - package default" : ""}</li>`)
    .join("\n        ");
  const requirementSummary = Number(row.external_requires_count) > 0
    ? `The installer metadata records ${escapeHtml(row.external_requires_count)} external-requirement reference${Number(row.external_requires_count) === 1 ? "" : "s"} across these configurations. Inspect the package before choosing a base.`
    : "The installer metadata records no external-requirement references for these configurations. You must still review the rendered objects and target policy.";
  const rowLicenses = catalog.licensesByChartVersion?.get(`${row.chart}|${row.version}`);
  const licenseLine = chartLicenseLineHtml(catalog, row.chart, row.version);
  const packagedImageRows = String(row.rendered_yaml_paths ?? "").split(";").filter(Boolean).map((path) => {
    const base = path.match(/\/bases\/([^/]+)\//)?.[1] ?? "unrecorded base";
    const images = new Set();
    try {
      const rendered = readFileSync(join(repoRoot, path), "utf8");
      for (const match of rendered.matchAll(/^\s*(?:-\s+)?image:\s*["']?([^"'\n]+?)["']?\s*$/gm)) {
        const image = match[1].trim();
        if (image && !image.includes("{{")) images.add(image);
      }
    } catch {
      return null;
    }
    return [base, [...images].sort()];
  }).filter(Boolean);
  const packagedImagesSection = packagedImageRows.length
    ? `<section aria-labelledby="images-pulled">
      <h2 id="images-pulled">Images This Chart Pulls</h2>
      <p>Every reference below is read from the committed package bases, so what you see is what the packaged manifests name.${(rowLicenses?.images ?? []).length ? " The image licenses recorded at the top of this page describe these references." : ""}</p>
      ${markdownLikeTable([
        ["Packaged base", "Image references"],
        ...packagedImageRows.map(([base, images]) => [base, images.length ? images.map((image) => `<code>${escapeHtml(image)}</code>`).join("<br>") : "No image reference appears in this base's packaged manifests."]),
      ], { rawSecondColumn: true })}
    </section>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(row.chart)} ${escapeHtml(row.version)} retained package · Config Workshop</title>
  <style>${siteCss()}</style>
</head>
<body data-retained-only-version="${escapeHtml(identity)}"${kpsManagedPromotion ? ' data-bounded-runtime-proof="managed-promotion"' : ""}>
  <header>
    ${topNav("..")}
    <h1>${escapeHtml(row.chart)}</h1>
    <p class="lead">Inspect the retained package for ${escapeHtml(identity)}, its packaged configurations, and ${published ? "its exact publication receipt" : "its reserved public reference"}.</p>
    <p>${published
      ? kpsManagedPromotion
        ? "The publication receipt proves that the named package was published and inspected at the recorded digests. A separate managed promotion proof covers this package as the 86.1.0 candidate from 85.3.3 through ConfigHub and Argo CD on one test target; it is not a general production-readiness claim."
        : "This page proves that the named package was published and inspected at the recorded digests. It does not claim Argo CD sync, Kubernetes health, production readiness, or another version's test result."
      : "This version is retained and packaged, and its public reference is reserved, but it has not been published yet, so there is no publication receipt to show. This page claims nothing about publication, Argo CD sync, Kubernetes health, or production readiness."}</p>
    <p class="tagline">${published ? "Publication proof: recorded" : "Publication proof: not yet earned"} · ${kpsManagedPromotion ? "managed upgrade proof: recorded for 85.3.3 to 86.1.0" : "runtime proof: not inherited"}.</p>
    ${licenseLine}
    ${successionCalloutHtml(catalog, row.chart)}
    <p><a class="button primary" href="../promote.html?chart=${encodeURIComponent(row.chart)}&current=${encodeURIComponent(row.version)}&base=${encodeURIComponent(row.default_base)}">Plan an upgrade or promotion</a></p>
    <p><a href="./index.html">Back to the Component Catalog</a> · component versions: ${versionLinks}</p>
  </header>
  <main>
    <section aria-labelledby="retained-page-summary">
      <h2 id="retained-page-summary">What this page gives you</h2>
      <p>This is a human-readable detail page for one retained package version. It keeps the package, base names, exact OCI identity, and ${published ? "publication receipt" : "publication status"} reachable without pretending this retained-only version has the richer readiness evidence attached to the bold version in the component row.</p>
      <div id="setting-sources" class="card">
        <h3>Where its settings and observations live</h3>
        <p>Each packaged configuration records Helm-derived files and installer metadata. Later ConfigHub changes belong in governed variants. Target prerequisites and live observations remain separate facts; this publication receipt does not turn them into passes.</p>
      </div>
    </section>

    ${assessmentQuestionsHtml(assessmentRecord)}

    <section aria-labelledby="try-retained-chart">
      <h2 id="try-retained-chart">Try This Chart</h2>
      <p>Inspect the exact package first, then choose one of the packaged configurations. The version remains readable in the reference, and the manifest digest prevents the registry from returning different package bytes. The setup command renders files locally; it does not apply them to Kubernetes.</p>
      <pre><code>${escapeHtml(row.verify_command || row.inspect_command)}
${escapeHtml(row.setup_command)}</code></pre>
      <p><strong>Run shared local configuration checks</strong> after the package has written its Kubernetes YAML:</p>
      <pre><code>${CHECK_PLUGIN_INSTALL_COMMAND}
cub check --format json --output cub-check.json &lt;work-dir&gt;/out/manifests</code></pre>
      <p>The check is advisory and does not apply anything.</p>
      <p>Version tag: <code>${escapeHtml(row.installer_oci_ref)}</code></p>
      ${digestPinnedRef ? `<p>Exact package: <code>${escapeHtml(digestPinnedRef)}</code></p>
      <p>The manifest digest comes from the committed publication receipt. <code>cub installer</code> refuses the pull if that exact manifest is not available.</p>` : ""}
      ${packageSignatureHtml}
    </section>

    <section aria-labelledby="retained-configurations">
      <h2 id="retained-configurations">Available Configurations</h2>
      <ul>
        ${configurationList}
      </ul>
      <p>The section below says what these configurations expect you to provide.</p>
    </section>

    ${sharedLocalChecksSectionHtml(catalog, row)}
    ${flatteningSectionHtml(catalog, row)}
    ${packagedImagesSection}
    <section aria-labelledby="retained-tests">
      <h2 id="retained-tests">What Has Been Tested</h2>
      <p>Choose the question you care about. <strong>Not checked</strong> means this catalog has no version-specific result; it is not a pass.</p>
      ${coverageQuestionTable(coverageEntry)}
      <p>${published
        ? `The committed publication receipt binds this package path and OCI ref to layer <code>${escapeHtml(layerDigest)}</code> and manifest <code>${escapeHtml(manifestDigest)}</code>, and records an inspect-result digest.`
        : "Nothing has been published for this version, so no publication receipt exists and no digest is bound. The package itself is committed and can be inspected from this repository."}</p>
      ${published
        ? `<p>You can check a pull yourself: the inspect command under Try This Chart prints the package's manifest and layer digests, and they must equal the receipted values above. If they differ, do not use the pulled package.</p>`
        : ""}
      ${kpsManagedPromotion
        ? `<p><strong>Bounded version-specific result:</strong> ConfigHub retained 85.3.3 as the base and this 86.1.0 package as the staging candidate, required approval, published exact release OCI digests, and delivered both through Argo CD. The destination checks covered source namespaces, two target-owned Secrets, ten CRDs, two replacement setup Jobs, server-side apply, six workloads, the operator endpoint, and Kubernetes admission. <a href="../d/data/kps-confighub-lifecycle-promotion/summary.html">Read the complete result and its limits</a>.</p><p>This does not prove rollback, long soak, automatic route selection, or a standalone fresh install of 86.1.0.</p>`
        : `<p><strong>No version-specific runtime result is claimed here.</strong> ${evidenceVersionNote}</p>`}
    </section>

    <section aria-labelledby="retained-requirements">
      <h2 id="retained-requirements">What You Must Provide</h2>
      <p>${requirementSummary}</p>
      <p>Choose a namespace and target deliberately, supply any listed Secret, CRD, storage, API, or cloud prerequisite, and inspect the rendered YAML before delivery.</p>
    </section>

    <section aria-labelledby="retained-production">
      <h2 id="retained-production">Before Production</h2>
      <p>Run target-specific policy, lifecycle, upgrade, and workload checks. A successful package publication and inspect result does not establish production support or live convergence.</p>
    </section>

    <section aria-labelledby="retained-files">
      <h2 id="retained-files">Source And Evidence Files</h2>
      ${markdownLikeTable([
        ["Record", "Open"],
        ["Retained package source", `<a href="https://github.com/confighub/helm-expt/tree/main/${escapeHtml(row.package_path)}">${escapeHtml(row.package_path)}</a>`],
        ["Installer metadata", `<a href="../../${escapeHtml(row.installer_yaml)}">${escapeHtml(row.installer_yaml)}</a>`],
        ["Publication receipt", `<a href="../../${escapeHtml(row.publication_receipt)}">${escapeHtml(row.publication_receipt)}</a>`],
        ["Publisher signature", `<a href="../../${escapeHtml(row.signature_receipt)}">${escapeHtml(row.signature_receipt)}</a>`],
        ["Sigstore bundle", `<a href="../../${escapeHtml(row.signature_bundle)}">${escapeHtml(row.signature_bundle)}</a>`],
        ["Version tag", `<code>${escapeHtml(row.installer_oci_ref)}</code>`],
        ["Exact OCI ref", `<code>${escapeHtml(digestPinnedRef)}</code>`],
        ["Layer digest", `<code>${escapeHtml(layerDigest)}</code>`],
        ["Manifest digest", `<code>${escapeHtml(manifestDigest)}</code>`],
      ], { rawSecondColumn: true })}
    </section>
  </main>
  <footer>Generated from the retained installer package and its committed publication receipt. Publication proof is not runtime proof.</footer>
</body>
</html>
`;
}

// What the packaged chart contains, and whether anyone has decided it is safe
// to ship flattened. Evidence and verdict are different claims, so the page
// says which it has. A chart with evidence and no decided lane reads as
// undecided rather than as safe.
function flatteningSectionHtml(catalog, entry) {
  const repository = String(entry.chart || "").split("/")[0];
  const name = String(entry.chart || "").split("/").slice(1).join("/");
  const row = (catalog.flatteningEvidence || []).find(
    (candidate) =>
      candidate.repository === repository &&
      candidate.chart === name &&
      candidate.version === entry.version,
  );
  if (!row) {
    const coverage = (catalog.flatteningCoverage || []).find(
      (candidate) =>
        candidate.repository === repository &&
        candidate.chart === name &&
        candidate.version === entry.version,
    );
    if (!coverage || ["scanned", "current"].includes(coverage.status)) return "";
    const why =
      coverage.status === "hash-mismatch"
        ? `Upstream now publishes different bytes under this same version string, so this catalog did not scan them. It keeps the bytes it locked, and records both digests and how to fetch the republished package, in the <a href="../../data/upstream-drift/summary.md">upstream drift record</a>.`
        : `The pinned package could not be fetched when the scan ran, so nothing was inspected. The recorded reason is: ${escapeHtml(String(coverage.detail || "no reason recorded"))}.`;
    return `
    <section aria-labelledby="flattening">
      <h2 id="flattening">What This Chart Contains</h2>
      <p>This version has no scan of its packaged chart, so this page reports nothing about what shipping it as plain rendered YAML would lose. ${why}</p>
      <p>Missing evidence is not a safety finding in either direction. Read the <a href="../../data/flattening-safety/evidence.md">catalog-wide evidence</a> for the versions that do carry a scan.</p>
    </section>
`;
  }

  const constructs = [
    ["Helm hooks", row.hooks, "Hook Jobs never fire, or fire under a different hook dialect."],
    ["Keep policy", row.keep_policy, "A reconciler prunes what Helm promised to keep."],
    ["Cluster lookups", row.lookup, "The chart reads the cluster while rendering, so a render without one is valid but wrong."],
    ["Webhook configuration", row.webhooks, "An empty certificate bundle makes admission fail closed."],
    ["Capability branching", row.capabilities, "The chart chooses apiVersions from the cluster it renders against."],
    ["Generated credentials", row.generated_secrets, "Every render mints new values, and a shared artifact would freeze one draw."],
    ["Custom resource definitions", row.crd_documents, "Per-file delivery can race the definitions the resources depend on."],
    ["Condition-gated subcharts", row.gated_subcharts, "What renders depends on which conditions the values switch on."],
    ["Test hooks", row.test_hooks, "Test resources would ship to a cluster that never asked for them."],
  ].filter(([, count]) => Number(count) > 0);

  const lanes = String(row.decided_lanes || "").trim();
  const laneLine = lanes
    ? `<p>A flattening-safety verdict has decided this version: <strong>${escapeHtml(lanes)}</strong>. The verdict records one disposition per construct and names any companion artifact a flattened bundle must ship.</p>`
    : `<p>No flattening-safety verdict has decided this version yet, so this page reports what the chart contains and stops there. Undecided is not the same as safe.</p>`;

  const body = constructs.length
    ? markdownLikeTable(
        [
          ["Construct", "Found", "Why it matters when a chart ships as plain YAML"],
          ...constructs.map(([label, count, why]) => [label, String(count), why]),
        ],
        { rawSecondColumn: false },
      )
    : `<p>The scan found none of the constructs that render-time flattening loses, which is what makes a chart cheap to certify.</p>`;

  return `
    <section aria-labelledby="flattening">
      <h2 id="flattening">What This Chart Contains</h2>
      <p>Shipping a chart as plain rendered YAML is faster and simpler, and it silently drops anything Helm was going to do afterwards. This section reports what a scan of the packaged chart found, across ${escapeHtml(String(row.scanned_files))} files.</p>
      ${body}
      ${laneLine}
      <p>A construct being present does not make a chart unflattenable. Most are switched on or off by values, and a verdict records which ones the base you choose actually reaches. Read the <a href="../../data/flattening-safety/evidence.md">catalog-wide evidence</a> for how common each one is.</p>
    </section>
`;
}

function chartPageHtml(catalog, entry, coverageEntry) {
  const chartKey = `${entry.chart}@${entry.version}`;
  const isReadyToTry = entry.proof_surface === "top20-catalog-supported";
  const baseRows = catalog.baseReadiness.filter((row) => row.chart === chartKey);
  const matrixRows = catalog.masterCatalogMatrix
    .filter((row) => row.chart === entry.chart && row.version === entry.version)
    .sort(compareMatrixRows);
  const firstRunnableRow =
    matrixRows.find((row) => row.row_kind === "base" && row.variant === entry.start_variant) ??
    matrixRows.find((row) => row.row_kind === "base") ??
    matrixRows.find((row) => row.row_kind !== "source");
  const firstBaseAssessmentRecord = firstRunnableRow
    ? baseVariantRecordFor(entry.chart, entry.version, firstRunnableRow.variant)
    : null;
  const firstRunnableCommand = firstRunnableRow ? matrixRowRunPath(firstRunnableRow, entry) : "No runnable row recorded yet.";
  const firstRunnableScriptDir = firstRunnableRow ? presetScriptDir(entry, firstRunnableRow) : null;
  const installerPackageOciRef = installerOciRefForEntry(entry);
  const installerPackageStatus = installerOciStatusText(entry);
  const installerPackageSignatureStatus = installerOciSignatureStatusText(entry);
  const entryPublicationReceipt = entry.installer_oci_publication_receipt
    ? readYaml(join(repoRoot, entry.installer_oci_publication_receipt))
    : null;
  const entryManifestDigest = entryPublicationReceipt?.spec?.outputs?.manifestDigest
    ?? String(entryPublicationReceipt?.spec?.outputs?.push ?? "").match(/manifest:\s+(sha256:[0-9a-f]{64})/)?.[1]
    ?? "";
  const entryDigestPinnedRef = entry.installer_oci_digest_pinned_ref
    || (entryManifestDigest ? installerOciDigestRef(installerPackageOciRef, entryManifestDigest) : "");
  const installerPackagePullRef = entryDigestPinnedRef || installerPackageOciRef;
  const installerPublicationReceiptLink = entry.installer_oci_publication_receipt
    ? `<a href="../../${escapeHtml(entry.installer_oci_publication_receipt)}">open the exact publication receipt</a>`
    : "no publication receipt is committed";
  const installerPackageSignature = installerPackageSignatureHtml({
    status: entry.installer_oci_signature_status,
    command: entry.installer_oci_signature_verification_command,
    receipt: entry.installer_oci_signature_receipt,
    bundle: entry.installer_oci_signature_bundle,
  });
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
  const kpsDefaultPackageUpgradeProofPath =
    entry.chart === "prometheus-community/kube-prometheus-stack"
      && ["85.3.3", "86.1.0"].includes(entry.version)
      ? "data/kps-default-package-upgrade-proof/summary.md"
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
  const kpsConfigHubPromotionPath =
    entry.chart === "prometheus-community/kube-prometheus-stack"
      && ["85.3.3", "86.1.0"].includes(entry.version)
      ? "data/kps-confighub-lifecycle-promotion/summary.md"
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
    ["Installer OCI publication receipt", entry.installer_oci_publication_receipt],
    ["Helm pain report", entry.helm_pain_report],
    ["Production review records", "data/production-disposition/summary.md"],
    ["Support decision", support?.path ?? ""],
    [baseRows.length ? "Base readiness" : "Master matrix rows", baseRows.length ? "data/top20-base-readiness/summary.md" : "data/master-catalog-matrix/summary.md"],
    ["Chart skills", "data/chart-skills/summary.md"],
    ["Chart evidence router", "data/chart-evidence-router/summary.md"],
    ["Current test status", "docs/user/current-proof-status.md"],
    [gitOpsReview ? "Cluster runtime review" : "", gitOpsReview ? gitOpsReviewPath : ""],
    [kpsLifecycleProofPath ? "Direct hooks and CRDs lifecycle proof (default)" : "", kpsLifecycleProofPath],
    [kpsNoCrdsLifecycleProofPath ? "Direct hooks and CRDs lifecycle proof (no-crds)" : "", kpsNoCrdsLifecycleProofPath],
    [kpsDefaultPackageUpgradeProofPath ? "Direct default-package upgrade proof" : "", kpsDefaultPackageUpgradeProofPath],
    [kpsGitOpsLifecycleProofPath ? "Argo CD and Flux lifecycle proof (no-crds)" : "", kpsGitOpsLifecycleProofPath],
    [kpsConfigHubPromotionPath ? "ConfigHub lifecycle promotion proof (no-crds)" : "", kpsConfigHubPromotionPath],
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
  const chartNeedsCrdHandling = JSON.stringify({ packageRequirements, lifecycleRoutes, lifecycleByVariantEntry, adoptionCaveat })
    .toLowerCase()
    .includes("crd");
  const chartHasCredentialStartingPoint = matrixRows.some((row) => /password|secret|credential/i.test(String(row.variant || "")));
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
    ["User status", humanizeReasonToken(evidenceRoute?.user_status || userReadiness?.user_status || "Status not recorded")],
    ["Can I use it?", chartUseMeaning(evidenceRoute?.chart_use_answer || "")],
    ["First base", evidenceRoute?.first_base || entry.start_variant],
    ["Exact installer package", installerPackagePullRef],
    ["Tests completed", chartPageText(humanizeReasonList(evidenceRoute?.current_proof || entry.proof_status || "See the test results"))],
    ["Coverage", humanizeReasonList(evidenceRoute?.coverage_status || "See coverage evidence")],
    ["You must provide", chartPageText(cleanPageActionText(evidenceRoute?.user_must_provide || userReadiness?.user_must_provide || "Check the target requirements and configuration status"))],
    ["What the tools record", chartPageText(cleanPageActionText(evidenceRoute?.routed_or_absorbed || userReadiness?.confighub_absorbs || "Rendered objects, test records, and checks"))],
    ["Next action", chartPageText(cleanPageActionText(evidenceRoute?.next_action || top100?.next_action || support?.next_action || "None recorded"))],
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(entry.chart)} ${escapeHtml(entry.version)} · Config Workshop</title>
  <style>${siteCss()}
    body :not(pre) > code { white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
    .matrix-row-card .row-layer { font-family: inherit; white-space: normal; }
    .matrix-row-card .lane-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .matrix-row-card .lane-pill b { font-family: inherit; line-height: 1.1; }
    @media (max-width: 640px) {
      .matrix-row-card .lane-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <header>
    ${topNav("..")}
    <h1>${escapeHtml(entry.chart)}</h1>
    <p class="boundary-chip">Runs on your laptop</p>
    <p class="lead">${isReadyToTry ? "Choose a tested starting configuration" : "Review a recorded configuration"} for ${escapeHtml(entry.chart)}@${escapeHtml(entry.version)}. Read its exact Kubernetes objects, required setup, and current evidence before you deploy it.</p>
    <p>${isReadyToTry ? "Start with" : "The first recorded configuration is"} <strong>${escapeHtml(entry.start_variant)}</strong>. ${isReadyToTry ? "The page also shows other recorded choices." : "Read its status before use; it is not yet a polished public example."} The page does not claim every possible values combination.</p>
    <p><strong>Evidence labels:</strong> Pass has a linked result. Watch names a limit to check. Blocked means do not use that path yet.</p>
    <p class="mono" style="font-size:.9rem">Upstream: <a href="https://artifacthub.io/packages/search?ts_query_web=${encodeURIComponent(entry.chart.split("/").at(-1))}&amp;kind=0" rel="noopener">find this chart on Artifact Hub</a> · <a href="https://helm.sh/docs/" rel="noopener">Helm documentation</a>. This page adds checked configurations and test results.</p>
    <p class="tagline">Catalog readiness: ${escapeHtml(catalogReadinessLabel(entry))}.</p>
    ${chartLicenseLineHtml(catalog, entry.chart, entry.version)}
    ${successionCalloutHtml(catalog, entry.chart)}
    <p><a class="button primary" href="../ask.html?question_code=install-shape&amp;chart=${encodeURIComponent(entry.chart)}&amp;version=${encodeURIComponent(entry.version)}">Check this chart and version</a> <a class="button secondary" href="#run-this">Try the package</a> <a class="button secondary" href="../promote.html?chart=${encodeURIComponent(entry.chart)}&amp;current=${encodeURIComponent(entry.version)}&amp;base=${encodeURIComponent(entry.start_variant)}">Plan an upgrade or promotion</a></p>
    <p>Already reviewed the result? <a href="../confighub.html">Keep it in ConfigHub</a> when you need history, variants, approvals, or delivery.</p>
  </header>
  <main>
    <section aria-labelledby="pillars-here">
      <h2 id="pillars-here">What this page gives you</h2>
      <p>Every chart page follows the same order. Choose a configuration, inspect its objects and setup work, then read the tests that have run. <a href="../testing.html">Open the worked examples</a>.</p>
      <div class="grid">
        <div class="card"><h3><a href="#render-record-route">Most choices are made before you install</a></h3><p>The package fixes and checks almost everything at build time. What you set is small and typed.</p></div>
        <div class="card"><h3><a href="#proof">You can read the test results</a></h3><p>Open the saved results for the Helm comparison, live install, and delivery checks.</p></div>
        <div class="card"><h3><a href="#lifecycle">See hooks, CRDs, and setup work</a></h3><p>The page names the work and says which delivery path has actually run.</p></div>
      </div>
    </section>

    <section aria-labelledby="summary">
      <h2 id="summary">What To Use</h2>
      ${chartStatStrip(catalog, entry, firstRunnableRow)}
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(entry.start_variant)}</strong><span>${isReadyToTry ? "Recommended first base variant" : "First recorded base variant"}</span></div>
        <div class="metric"><strong>${escapeHtml(entry.variant_count)}</strong><span>${entry.proof_surface === "next80-proof-grade" ? "Candidate base variants" : "Supported base variants"}</span></div>
        <div class="metric"><strong>${escapeHtml(isReadyToTry ? catalogStartStatusLabel(entry.start_base_readiness) : "Review before use")}</strong><span>First-configuration status</span></div>
        <div class="metric"><strong>${escapeHtml(productionStatusLabel(production?.production_support ?? entry.production_readiness))}</strong><span>Production status</span></div>
      </div>
      <p>${escapeHtml(chartPageText(chartUse?.plain_english ?? "Start with the recommended configuration. Before production, confirm that its tests cover your target."))}</p>
      ${markdownLikeTable([
        ["Question", "Answer"],
        ["Catalog readiness", catalogReadinessLabel(entry)],
        ["Chart version", entry.version],
        ["Exact installer package", installerPackagePullRef],
        ["OCI publication status", installerPackageStatus],
        ["Publisher signature", installerPackageSignatureStatus],
        ["Latest upstream seen", entry.latest_status === "update-available" ? `${entry.latest_version} (update candidate)` : entry.latest_version || "not checked"],
        [entry.proof_surface === "next80-proof-grade" ? "Candidate base variants" : "Supported base variants", entry.supported_variants || entry.candidate_variants || "see matrix rows"],
        ["Not yet available", chartPageText(entry.not_yet_enabled) || "None recorded"],
        ["Namespace", entry.namespace || "chart default"],
      ])}
    </section>

    ${assessmentQuestionsHtml(firstBaseAssessmentRecord)}

    <section aria-labelledby="setting-sources">
      <h2 id="setting-sources">Where This Chart's Settings Come From</h2>
      ${settingSourceRows.length
        ? markdownLikeTable([
            ["Base variant", "Helm values", "ConfigHub changes", "Install work"],
            ...settingSourceRows,
          ], { rawSecondColumn: true })
        : "<p>No runnable base has a recorded setting source yet.</p>"}
      <p><strong>Upgrade rule:</strong> if a new Helm render and a ConfigHub revision both change the same field, review the overlap before promotion. The values profile shows the Helm side; Unit revision history shows the ConfigHub side.</p>
      <p><a href="../../docs/user/helm-presets-and-values.md#where-each-setting-lives">Read the full values-versus-ConfigHub rule</a>. For the staging commands behind each prerequisite, open the <a href="../d/data/target-prerequisite-actions/summary.html">prerequisite action packets</a>.</p>
    </section>

    ${flatteningSectionHtml(catalog, entry)}
    <section aria-labelledby="render-record-route">
      <h2 id="render-record-route">What The Starting Configuration Records</h2>
      <p>A base variant is a starting configuration we have already rendered and checked. Pick the one whose trade-off you want; the table below shows what each one changes.</p>
      <p>The ${firstBaseRecordLink} connects those Helm inputs to the Kubernetes objects, remaining requirements, hooks, CRDs, checks, and OCI status. Open it when you need the complete starting record rather than only the rendered YAML.</p>
      <p>Open the ${firstRenderedObjectsLink} to read the actual manifest output. The render record and setup section explain the inputs, tests, CRDs, hooks, and other work around it.</p>
      <p>If new Helm values create a useful starting configuration, record another base variant with its own inputs and checks. If one environment changes a field after rendering, record that change in a ConfigHub variant.</p>
      ${markdownLikeTable([
        ["Key", "Where to look first", "What it means"],
        ["Package users pull", `<code>${escapeHtml(installerPackagePullRef)}</code>`, `The exact installer package for this chart version. The version tag is readable, and the manifest digest makes a published pull immutable. ${INSTALLER_OCI_AUTH_NOTE}`],
        ["Required before apply", packageRequirementTableRows.map(([name, source]) => `${escapeHtml(name)}${source ? `<br>${source}` : ""}`).join("<br>"), "External resources the recommended base variant expects, such as an existing Secret, namespace, CRD, or target fact."],
        ["Kubernetes objects", firstRenderedObjectsLink, "The full YAML captured from this base variant. It is the output of the render."],
        ["Render record", firstRenderIntentLink, "The Helm inputs and evidence links that explain how the output was produced."],
        ["Complete starting record", firstBaseRecordLink, "The record that connects the Helm inputs, Kubernetes objects, remaining requirements, setup work, checks, and OCI status."],
        ["Hooks, CRDs, and setup work", `<a href="#lifecycle">this page's setup section</a>`, "Instructions and decisions for hooks, CRDs, generated Secrets, setup jobs, cluster requirements, or blockers."],
      ], { rawSecondColumn: true })}
      <div class="grid">
        <div class="card"><h3>Choose base variant</h3><p>Pick the supported Helm configuration for this chart: default, no-CRDs, existing Secret, HA, server-only, or another listed option.</p></div>
        <div class="card"><h3>Record inputs</h3><p>Keep the values, namespace, release name, source lock, ${firstRenderIntentLink}, full YAML output, package base, test results, and setup instructions together.</p></div>
        <div class="card"><h3>Handle chart extras</h3><p>CRDs, hooks, setup jobs, external Secrets, target facts, and webhook certificates are recorded as chart-specific choices. Some are included in a base variant, some need a setup step, and some are blocked until there is a safe path.</p></div>
      </div>
      <p><a href="../../docs/user/helm-render-intents.md">How render intents work</a> · <a href="../../data/helm-render-intents/summary.md">All generated render intents</a> · <a href="../../data/base-variant-records/summary.md">All base variant records</a></p>
    </section>

    <section aria-labelledby="run-this">
      <h2 id="run-this">Try This Chart</h2>
      <p>${isReadyToTry ? `Start with <strong>${escapeHtml(entry.start_variant)}</strong>.` : `Review <strong>${escapeHtml(entry.start_variant)}</strong> before use.`} If a card says review or preparation is needed, treat that as a real limit rather than a ready install.</p>
      <div class="card">
        <h3>Package image</h3>
        <p><strong>Exact package:</strong> <code>${escapeHtml(installerPackagePullRef)}</code><br><span style="color:var(--muted);font-size:.9rem">${escapeHtml(installerPackageStatus)} · ${installerPublicationReceiptLink}</span></p>
        ${entryDigestPinnedRef ? `<p>Readable version tag: <code>${escapeHtml(installerPackageOciRef)}</code>. The package is pinned so a republished tag cannot change what you get. The command below uses the exact manifest digest, so <code>cub installer</code> refuses different package bytes.</p>
        <h3>Check the package identity</h3>
        <pre><code>${escapeHtml(entry.installer_oci_verify_command || `cub installer inspect ${entryDigestPinnedRef} --json`)}</code></pre>
        <h3>Read how each configuration was made</h3>
        <pre><code>${escapeHtml(`cub installer pull '${installerPackagePullRef}' --work-dir ./package-review\nless ./package-review/package/records/README.md`)}</code></pre>
        <p>The package's <code>records/</code> directory connects every base to its source choices, Helm render intent, Kubernetes objects, prerequisites, lifecycle work, and checks. These are supporting records, not Kubernetes objects.</p>` : ""}
        ${installerPackageSignature}
        <p>${escapeHtml(INSTALLER_OCI_AUTH_NOTE)}</p>
        <h3>${isReadyToTry ? "Recommended first command" : "First recorded command"}</h3>
        <p>${firstRunnableCommand}</p>
        ${firstRunnableScriptDir ? `<details title="Additional scripts: apply it or upload it"><summary><strong>Advanced: apply it or upload it</strong></summary><p>Run the whole sequence as one script, prerequisites included: <a href="../${firstRunnableScriptDir}/try.sh">try.sh</a> renders and applies to Kubernetes without an account; <a href="../${firstRunnableScriptDir}/confighub.sh">confighub.sh</a> renders and uploads to your ConfigHub Space.</p><p><strong>Before you run <code>try.sh</code>:</strong> it changes your current kubectl context. It runs the named prerequisites and applies the rendered objects. Read it first and use a disposable test cluster. <code>confighub.sh</code> does not apply anything to Kubernetes.</p></details>` : ""}${firstHubReadmePath ? `
        <p>This preset is also shown in the live <code>helm-catalog</code> demo org. <a href="../../${escapeHtml(firstHubReadmePath)}">Read the demo README</a> to see why that Space exists, what problem it demonstrates, and what to inspect first.</p>` : ""}
        <h3>You should see something like this</h3>
        <pre><code>cub installer setup ...
rendered manifests written under &lt;work-dir&gt;
use the chart option cards below to check pass, watch, blocked, and prerequisites</code></pre>
        <p><strong>Current status:</strong> ${escapeHtml(firstRunnableRow ? matrixRowStatusLabel(firstRunnableRow) : entry.start_base_readiness || "unknown")} · <strong>Reason:</strong> ${escapeHtml(firstRunnableDisplayReason)}</p>
      </div>
    </section>

    <section aria-labelledby="after-render">
      <h2 id="after-render">After You Render It</h2>
      <p>The first command writes files and does not apply them. Read the objects and setup requirements, then choose the next job.</p>
      ${markdownLikeTable([
        ["Job", "Next step"],
        ["Render and inspect without applying", `<a href="#run-this">Run the recommended <code>cub installer setup</code> command above</a>.`],
        ["Run shared local configuration checks", `<code>${CHECK_PLUGIN_INSTALL_COMMAND}</code><br><code>cub check --format json --output cub-check.json &lt;work-dir&gt;/out/manifests</code>. The check is advisory and does not apply anything.`],
        ["Apply the rendered manifests with kubectl, or publish reviewed objects as OCI", `<a href="../how-it-works.html#now-deploy">Publish reviewed objects as OCI or apply the manifests with kubectl</a>.`],
        ["Save the reviewed result for a team", `<a href="../confighub.html">Save and upload the reviewed result to ConfigHub</a> for shared history, exact diffs, and approvals.`],
        ["Compare development and production, audit an exact diff, promote, or roll back", `<a href="../promote.html#promotion-inputs">Build a promotion review</a> or <a href="../promote.html#rollback-release">read the bounded rollback example</a>.`],
        ["Assign the configuration to clusters and operate a small fleet", `<a href="../operations.html#fleet-record">Choose targets, preview a wave, and inspect every result</a>.`],
        ["Check delivery limits", `<a href="../known-gaps.html">Read the current limits before choosing kubectl, Argo CD, or Flux</a>.`],
        ...(chartNeedsCrdHandling ? [["Handle CRDs on the first install", `<a href="../known-gaps.html">Read the CRD ordering risk and first-install guide</a>, then check <a href="#lifecycle">this chart's recorded owner and route</a>.`]] : []),
        ...(chartHasCredentialStartingPoint ? [["Fix placeholder or static credentials", `<a href="../known-gaps.html">Use an existing Secret or another reviewed credential path before production</a>.`]] : []),
      ], { rawSecondColumn: true })}
    </section>

${teaching ? `\n    ${teaching}\n` : ""}

    <section aria-labelledby="matrix-options">
      <h2 id="matrix-options">Available Configurations</h2>
      <p>Each card is one available way to use this chart in the catalog. Some cards are runnable base variants. Others are candidate paths, derived variants, or review notes that explain what still has to be prepared.</p>
      <p class="small"><strong>Checks:</strong> Each card names what was checked and says whether it passed, needs review, was blocked, was not run, or was not needed.</p>
      <p class="mono" style="font-size:.9rem">${escapeHtml(matrixRows.length)} matrix row${matrixRows.length === 1 ? "" : "s"} for ${escapeHtml(entry.chart)}@${escapeHtml(entry.version)} · <a href="../matrix.html">open the full matrix</a></p>
      ${matrixRows.length ? `<div class="matrix-row-grid">${matrixRows.map((row) => matrixRowCard(row, entry, catalog)).join("")}</div>` : "<p>No matrix rows are recorded for this chart/version.</p>"}
    </section>

    ${sharedLocalChecksSectionHtml(catalog, entry)}${configurationDecisionExampleHtml(entry)}
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
      <h2 id="playbooks">Advice And Current Status</h2>
      <p>Use this section to see which chart-specific guides apply, what you must provide, and what work remains.</p>
      ${skillRows.length
        ? markdownLikeTable([
            ["Playbook", "Why it applies"],
            ...skillRows,
          ], { rawFirstColumn: true })
        : "<p>No special operating guide is assigned for this chart. Use the configuration status and test results on this page.</p>"}
      ${markdownLikeTable([
        ["Question", "Current answer"],
        ...factSheetRows,
      ])}
      <p>The source data lives in <a href="../../data/chart-skills/summary.md">chart skills</a> and <a href="../../data/chart-evidence-router/summary.md">chart evidence router</a>.</p>
    </section>

    <section aria-labelledby="proof">
      <h2 id="proof">What Has Been Tested</h2>
      <p>Choose the question you care about. <strong>Not checked</strong> means this catalog has no version-specific result; it is not a pass.</p>
      ${coverageQuestionTable(coverageEntry)}
      <p><strong>How much is proven, and what more testing would add:</strong> ${evidenceDepthSummary(lanes)}</p>
      ${markdownLikeTable([
        ["Base", "Readiness", "Render", "ConfigHub", "Local live", "GitOps/OCI", "Live parity", "Two-cluster kind"],
        ...proofEvidenceRows,
      ])}
    </section>${gitOpsReview ? `\n\n    ${gitOpsRuntimeReviewHtml(gitOpsReview, gitOpsReviewPath)}` : ""}

    <section aria-labelledby="quirks">
      <h2 id="quirks">What You Must Provide</h2>
      <p>${escapeHtml(chartPageText(userReadiness?.confighub_absorbs ?? "ConfigHub records the rendered objects, test results, and current limits."))}</p>
      ${markdownLikeTable([
        ["Field", "Value"],
        ["Known quirks", chartPageText(humanizeReasonList(userReadiness?.quirks || top100?.source_features || entry.source_features || "None identified"))],
        ["You must provide", chartPageText(userReadiness?.user_must_provide || "Check the configuration status and target requirements")],
        ["What ConfigHub records", chartPageText(userReadiness?.confighub_absorbs || "Exact rendered objects, checks, test results, and catalog evidence")],
        ["Optional chart inputs", chartPageText(humanizeReasonList(extension?.surfaces || "None identified in the chart facts"))],
        ["How optional inputs are handled", chartPageText(humanizeReasonList(extension?.current_route || "No handling rule is recorded"))],
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
${kpsLifecycleProofPath ? `      <p><strong>Public package lifecycle:</strong> both 85.3.3 catalog bases passed fresh installs on separate, new kind clusters. The default base matched 124 checked chart objects; the no-crds base matched 114. Each run applied ten CRDs first, ran the chart's certificate and webhook patch Jobs, checked six workloads, and cleaned up. Argo CD and Flux then installed the 85.3.3 no-crds staged OCI and upgraded it to the 86.1.0 staged digest on separate clusters. Both replaced the completed setup Jobs and passed the runtime checks after upgrade. Open the <a href="../../${kpsLifecycleProofPath}">default direct receipt</a>${kpsNoCrdsLifecycleProofPath ? `, the <a href="../../${kpsNoCrdsLifecycleProofPath}">no-crds direct receipt</a>` : ""}${kpsPublicPackageProofPath ? `, the <a href="../../${kpsPublicPackageProofPath}">anonymous pull proof</a>` : ""}${kpsGitOpsLifecycleProofPath ? `, or the <a href="../../${kpsGitOpsLifecycleProofPath}">Argo CD and Flux proof</a>` : ""}. The controller receipt is limited to this version pair and does not prove rollback, long soak, or automatic ConfigHub route selection.</p>` : kpsGitOpsLifecycleProofPath ? `      <p><strong>Tested upgrade target:</strong> the 86.1.0 package carries its own checked CRDs and admission setup files. Argo CD and Flux each upgraded the 85.3.3 no-crds staged OCI to the 86.1.0 staged digest, replaced both completed setup Jobs, and passed the runtime checks. This is a bounded upgrade result, not a standalone 86.1.0 fresh-install claim. Open the <a href="../../${kpsGitOpsLifecycleProofPath}">Argo CD and Flux proof</a>.</p>` : ""}${kpsConfigHubPromotionPath ? `      <p><strong>Managed promotion:</strong> ConfigHub retained 85.3.3 as the base and 86.1.0 as the staging variant, required approval, published an exact release OCI for each, and delivered both through Argo CD. The destination check preserved the chart's <code>monitoring</code> and <code>kube-system</code> namespaces, supplied the two recorded Secrets, established ten CRDs, replaced two setup Jobs, and used server-side apply for the large CRDs. <a href="../../${kpsConfigHubPromotionPath}">Read the ConfigHub promotion result</a>. It covers this exact version pair and test target; rollback and automatic route selection have not run.</p>` : ""}
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
              : "<p>No chart-specific action is attached to this page yet. That is not a claim that the upstream chart has no hooks or setup work. It means the public catalog has no per-chart-base variant action to show here; check the catalog filters, the matrix, or send a problem chart if hook behavior should be modeled.</p>"}
    </section>

    <section aria-labelledby="production">
      <h2 id="production">Before Production</h2>
      <p>A green render or local live result is not a production support claim. Production support is target-scoped and uses the support-decision artifact when present.</p>
      ${markdownLikeTable([
        ["Field", "Value"],
        ["Production review status", productionStatusLabel(production?.production_support ?? entry.production_readiness)],
        ["Target-scoped support decision", support?.decision ?? "not recorded"],
        ["Supported base", support?.supported_base ?? ""],
        ["Target scope", humanTargetScope(support?.target_scope)],
        ["Accepted limits", chartPageText(acceptedDispositions.join("; ")) || "None recorded"],
        ["Open policy decisions", chartPageText(openDispositions.join("; ")) || "None recorded for this policy checklist"],
        ["Next action", chartPageText(support?.next_action || production?.next_action || top100?.next_action || "")],
      ])}
    </section>

    <section aria-labelledby="files">
      <h2 id="files">Source And Evidence Files</h2>
      ${markdownLikeTable([
        ["Artifact", "Path"],
        ...artifactRows.map(([label, path]) => [label, `<a href="../../${path}">${path}</a>`]),
      ], { rawSecondColumn: true })}
    </section>
  </main>
  <footer><p>Generated from the catalog data and linked test results. Check the current evidence before using a configuration in production.</p></footer>
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
        ["Did the checks catch the surprise?", `<a href="../../data/apply-policy-functional-proof/summary.md">Yes. Local <code>cub check</code> found the literal API key, ConfigHub recorded a blocking gate on those same five objects, and the Secret-backed result cleared that check</a>.`],
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
        <div class="card"><h3>cub installer</h3><pre><code>cub installer setup --pull ${REDIS_INSTALLER_PINNED_OCI_REF} \\
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
        <div class="card"><h3>cub installer</h3><pre><code>cub installer setup --pull ${PROMETHEUS_INSTALLER_PINNED_OCI_REF} --base server-only-ephemeral --work-dir ./prometheus-server-only --non-interactive --namespace monitoring</code></pre><p>You should see rendered manifests in the work directory, ready to inspect before delivery.</p></div>
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
          ["CRDs", "CRDs must be installed and upgraded in the right order. A matching render does not prove that."],
          ["Webhooks", "Admission webhooks need working certificates and must be ready before dependent resources are applied."],
          ["Cluster requirements", "Storage, APIs, and other cluster capabilities determine whether the objects can run."],
          ["Watch results", "A Watch result tells you which deployment question is still open."],
        ])}
      </div>
      <p>${entry.version === "85.3.3" ? "The public package has run that full fresh-install sequence. A separate isolated client pulled the same package with no ConfigHub account or registry login and received all nine lifecycle files. The <code>default</code> base then upgraded through the same direct package route to 86.1.0, retained the admission Secret, reran the lifecycle steps, and reached all six checked workloads. The <code>no-crds</code> base also ran from one staged OCI digest through Argo CD and Flux on separate fresh clusters, then upgraded to the 86.1.0 staged digest." : "The 86.1.0 public package carries its own checked CRDs and admission setup files. An isolated client pulled and rendered it without a ConfigHub account or registry login. It served as the tested target for both the direct <code>default</code> package upgrade and the <code>no-crds</code> Argo CD and Flux upgrade from 85.3.3. This does not claim a standalone 86.1.0 fresh install."} ConfigHub does not yet select the route automatically. These receipts do not prove rollback or long-running soak.</p>
      <p><a href="../../data/kps-lifecycle-route-proof/summary.md">Open the package lifecycle proof</a> · <a href="../../data/kps-default-package-upgrade-proof/summary.md">Open the direct upgrade proof</a> · <a href="../../data/kps-gitops-lifecycle-proof/summary.md">Open the Argo CD and Flux proof</a> · <a href="../../data/kps-public-package-proof/summary.md">Check the anonymous pull</a> · <a href="../../docs/demo/hooks-crds/kube-prometheus-stack.md">Read the hooks and CRDs guide</a> · <a href="../../docs/user/serious-chart-proof.md">Open serious chart proof</a></p>
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

function matrixLayerLabel(layer) {
  const labels = {
    F1: "F1 · Source chart",
    F2a: "F2a · Chart default",
    F2b: "F2b · Helm-rendered base",
    F2c: "F2c · Planned base",
    F3: "F3 · Required setup",
    F4a: "F4a · ConfigHub variant",
    F4b: "F4b · Targeted variant",
  };
  return labels[layer] || layer || "Unclassified option";
}

function matrixRowPurpose(row) {
  const purposes = {
    F1: "Pinned upstream chart and version",
    F2a: "Runnable base variant made from the chart defaults",
    F2b: "Runnable base variant made with different Helm values",
    F2c: "Planned base variant; not runnable yet",
    F3: "A prerequisite or target value needed before deployment",
    F4a: "ConfigHub variant derived from a catalog base",
    F4b: "ConfigHub variant with a recorded deployment target",
  };
  const purpose = purposes[row.catalog_layer]
    || (row.customization_layer ? humanizeReasonList(row.customization_layer) : "Catalog option");
  return row.custom_discussion === "yes" ? `${purpose}; review needed` : purpose;
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
    "ha (curated proof lane - bespoke teaching needed)": "The catalog has not yet tested a realistic high-availability configuration for this chart.",
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
    const scope = String(intent.target_fact_review_scope || "").trim();
    return scope
      ? `The support review found no separate target prerequisite for ${scope}`
      : "The support review found no separate target prerequisite for its recorded scope.";
  }
  const actions = Number(intent.target_fact_action_count || 0);
  if (actions > 0) {
    return `${actions} live test record${actions === 1 ? "" : "s"} found missing setup, but this base does not yet record what the target must provide. Add the prerequisite to the base and rerun the test.`;
  }
  return "This base has not yet been reviewed for required Secrets, CRDs, namespaces, values, storage services, external APIs, or target topology. Record what it needs, or record that nothing extra is required.";
}

function targetReviewEvidenceLabel(path) {
  if (/support-decision\.yaml$/i.test(path)) return "Support decision";
  if (/fresh-target-evidence-/i.test(path)) return "Target evidence";
  return coverageEvidenceLabel(githubEvidenceUrl(path));
}

function renderTargetContract(intent) {
  const summary = escapeHtml(targetContractText(intent));
  const evidence = String(intent?.target_fact_review_evidence || "")
    .split(";")
    .map((path) => path.trim())
    .filter(Boolean);
  if (!evidence.length) return summary;
  const links = evidence.map((path) =>
    `<a href="${escapeHtml(githubEvidenceUrl(path))}">${escapeHtml(targetReviewEvidenceLabel(path))}</a>`
  ).join(" · ");
  return `${summary} Evidence: ${links}.`;
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
  return chartPageText(humanizeReasonList(reason)) || "No blocking reason recorded.";
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
    ["Helm output", row.lane_render_parity],
    ["Saved in ConfigHub", row.lane_confighub_scan_ops],
    ["Local cluster", row.lane_local_kind],
    ["Setup route", row.lane_lifecycle_observed],
    ["GitOps and OCI", row.lane_gitops_oci_live],
    ["Live Helm comparison", row.lane_live_dual_parity],
    ["Two clusters", row.lane_two_cluster_kind],
    ["Promotion", row.variant_promotion],
  ];
  return `<article class="matrix-row-card">
        <div class="matrix-row-head">
          <div>
            <span class="row-layer">${escapeHtml(matrixLayerLabel(row.catalog_layer))}</span>
            <h3>${escapeHtml(title)}</h3>
          </div>
          <span class="row-kind">${escapeHtml(matrixRowKindLabel(row.row_kind))}</span>
        </div>
        <p class="row-purpose">${escapeHtml(chartPageText(matrixRowPurpose(row)))}</p>
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
          <dt>Prerequisites</dt><dd>${renderTargetContract(renderIntent)}</dd>` : ""}
          <dt>Next</dt><dd>${escapeHtml(chartPageText(humanNextAction))}</dd>
          ${humanReason ? `<dt>Reason</dt><dd>${escapeHtml(chartPageText(humanReason))}</dd>` : ""}
        </dl>
        <div class="lane-strip" aria-label="Checks for ${escapeHtml(title)}">
          ${laneBadges.map(([label, value]) => lanePill(label, value)).join("")}
        </div>${renderIntent && Number(renderIntent.target_requirement_count || 0) > 0 && normalizeLaneValue(row.lane_lifecycle_observed) === "na"
          ? "<p class=\"small\"><strong>Prerequisites still apply.</strong> &ldquo;Not needed&rdquo; under Setup route means there is no separate hook or setup runner for this configuration; it does not remove the prerequisite listed above.</p>"
          : ""}
        ${rowLinks.length ? `<p class="row-links">${rowLinks.join(" · ")}</p>` : ""}
      </article>`;
}

function cleanPageActionText(value) {
  return String(value ?? "").replace(/\b([a-z][a-z-]*): unknown\b/g, (_match, action) => {
    const label = UNKNOWN_ACTION_LABELS[action];
    return label ?? action.replaceAll("-", " ");
  });
}

function chartPageText(value) {
  return String(value ?? "")
    .replaceAll("\u2014", "-")
    .replace(/source rows are upstream chart inputs[;,]?\s*not server[- ]side promotion evidence/gi, "This is the chart source. Choose a configuration before checking deployment or promotion")
    .replace(/server[- ]side promotion receipt passed\.?/gi, "Promotion was tested and recorded in ConfigHub.")
    .replace(/choose whether ([^;]+) is in production scope;\s*close or document its render[- ]only live[- ]readiness issue first\.?/gi, (_match, configuration) => `Decide whether ${configuration} is suitable for production. Resolve or document its outstanding live deployment check first.`)
    .replace(/candidate rows are planning rows;\s*not server[- ]side promotion evidence\.?/gi, "This is a planned option. Promotion has not been tested for it.")
    .replace(/promotion depends on upstream and downstream ConfigHub Spaces;\s*the ConfigHub proof lane is missing\.?/gi, "Promotion needs source and destination ConfigHub Spaces. It has not been tested for this configuration.")
    .replace(/server[- ]side promotion did not prove changed unit catch up and added unit cloning\.?/gi, "The promotion test did not prove that changed and newly added configuration reached the destination.")
    .replace(/server[- ]side promotion mechanics passed;\s*but changeset[- ]bound promote failed and required the no[- ]changeset fallback\.?/gi, "Basic promotion worked, but promotion tied to a ConfigHub ChangeSet failed. The test used a fallback without a ChangeSet.")
    .replace(/choose or create an F2 base before rendering or deploying/gi, "Choose a chart configuration before rendering or deploying")
    .replace(/choose or create an F2 base before server[- ]side variant promotion applies/gi, "Choose a chart configuration before using ConfigHub promotion")
    .replace(/check the exact base and lane/gi, "check the exact configuration and its tests")
    .replace(/ha \(curated proof lane - bespoke teaching needed\)/gi, "A realistic high-availability configuration has not yet been tested for this chart")
    .replace(/ha \(curated tests - bespoke teaching needed\)/gi, "A realistic high-availability configuration has not yet been tested for this chart")
    .replace(/The mechanism works, but the current base is too default-shaped to be a good user offer\./gi, "The basic checks pass, but the catalog still needs a useful starting configuration for this chart.")
    .replace(/- \(no open gap: recommended capabilities built or n\/a; quirks modeled - level 2\)/gi, "No specific missing capability is recorded. The first configuration still needs review.")
    .replace(/proof grade ready for promotion review/gi, "Tests complete; ready for catalog review")
    .replace(/proof grade needs user shaped variant/gi, "The basic checks passed, but this chart still needs a useful reviewed configuration")
    .replace(/proof[- ]grade/gi, "checked")
    .replace(/user[- ]shaped variants?/gi, (match) => match.toLowerCase().endsWith("s") ? "useful reviewed configurations" : "useful reviewed configuration")
    .replace(/your wanted install shape/gi, "the chart settings you need")
    .replace(/useful operating shape/gi, "useful starting configuration")
    .replace(/normal cloud ingress controller shape/gi, "normal cloud ingress controller configuration")
    .replace(/too default-shaped/gi, "too close to the chart default")
    .replace(/default-shaped/gi, "close to the chart default")
    .replace(/proof lanes?/gi, "tests")
    .replace(/live\/e2e observation lane/gi, "live end-to-end evidence")
    .replace(/re render via the recipe lane/gi, "render again from the recorded recipe")
    .replace(/then realize variant\+revision\+package base/gi, "then create the configuration, revision, and package base")
    .replace(/extension slot provenance and scan policy/gi, "optional input sources and scan policy")
    .replace(/scan\/gate warning disposition/gi, "warning review and apply-gate policy")
    .replace(/target fact preflight/gi, "cluster requirement checks before deployment")
    .replace(/generated fact ownership/gi, "ownership of generated values")
    .replace(/hook and lifecycle phase policy/gi, "hook and setup order")
    .replace(/storage backup restore and rollback policy/gi, "storage backup, restore, and rollback policy")
    .replace(/extension slots routed to reviewed bases/gi, "optional chart inputs handled by reviewed base configurations")
    .replace(/extension slots/gi, "optional chart inputs")
    .replace(/production disposition/gi, "production review")
    .replace(/kind proof rig/gi, "kind test cluster")
    .replace(/all three live legs/gi, "all three deployment paths")
    .replace(/\blive legs\b/gi, "deployment paths")
    .replace(/\blive leg\b/gi, "deployment path")
    .replace(/\bproof rig\b/gi, "test cluster")
    .replace(/the same runtime boundary/gi, "the same result")
    .replace(/curated proof lane - bespoke teaching needed/gi, "a realistic high-availability configuration has not yet been tested")
    .replace(/\bConfigHub absorbs\b/g, "ConfigHub records")
    .replace(/\bdispositions\b/gi, "decisions")
    .replace(/\bdisposition\b/gi, "decision")
    .replace(/\blanes\b/gi, "tests")
    .replace(/\blane\b/gi, "test")
    .replace(/\bshape\b/gi, "configuration")
    .replace(/\s+/g, " ")
    .trim();
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
  return `cub installer setup --pull ${installerOciPullRefForEntry(entry)} --base ${variant} --work-dir ${presetWorkDir(entry, row)} --non-interactive${namespace}`;
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

function lanePill(label, value) {
  const normalized = normalizeLaneValue(value);
  return `<span class="lane-pill ${escapeHtml(normalized)}" title="Recorded value: ${escapeHtml(value || "blank")}"><b>${escapeHtml(label)}</b><em>${escapeHtml(laneStatusLabel(value))}</em></span>`;
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

function laneStatusLabel(value) {
  const normalized = normalizeLaneValue(value);
  const labels = {
    yes: "Passed",
    watch: "Review",
    no: "Blocked",
    todo: "Not run",
    na: "Not needed",
    blank: "No record",
  };
  return labels[normalized] || humanizeReasonToken(value || "No record");
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
  if (accepted.length) rows.push(["Checks and policies already reviewed", accepted.map((item) => chartPageText(item)).join("; ")]);
  if (open.length) rows.push(["Checks and policies still open", open.map((item) => chartPageText(item)).join("; ")]);
  if (production.lifecycle_policy_basis && production.lifecycle_policy_basis !== "none") {
    rows.push(["Why this lifecycle status is shown", lifecyclePolicyBasisText(production.lifecycle_policy_basis)]);
  }
  if (production.lifecycle_observation_receipts) {
    rows.push(["Lifecycle test records", namedPathLinks(production.lifecycle_observation_receipts, "Open lifecycle record")]);
  }
  if (production.production_disposition_receipts) {
    rows.push(["Production review records", namedPathLinks(production.production_disposition_receipts, "Open review record")]);
  }
  return rows;
}

function lifecyclePolicyBasisText(value) {
  const text = String(value || "");
  const noHooks = text.includes("recipe-hook-policy:no-hooks");
  const observations = text.match(/lifecycle-observations:(\d+)\/(\d+)/);
  if (noHooks && observations) {
    return `The recipe records no separate Helm hooks, and ${observations[1]} of ${observations[2]} lifecycle checks passed.`;
  }
  if (noHooks) return "The recipe records no separate Helm hook that needs its own action.";
  return chartPageText(humanizeReasonList(text));
}

function namedPathLinks(value, label) {
  const paths = splitDisposition(value);
  return paths
    .map((path, index) => `<a href="../../${escapeHtml(path)}">${escapeHtml(`${label}${paths.length === 1 ? "" : ` ${index + 1}`}`)}</a>`)
    .join("<br>");
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
      `Plain <code>kubectl apply</code> leaves removed objects behind. Enable and test pruning in Argo CD or Flux, or use a direct path whose ownership and pruning behavior have their own receipt.`,
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
      <p>No chart-specific password or CRD caveat is recorded for this chart. For direct delivery, define how removed objects are pruned and how field conflicts are resolved. Argo CD and Flux can own those reconciliation jobs when their delivery path and pruning settings are recorded for the selected preset.</p>
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
    ["Universal caveats", `Use declared inputs or bases instead of Helm <code>--set</code>. For direct delivery, define pruning and field-conflict behavior. Use Argo CD or Flux when that controller path and its pruning settings are recorded for the selected preset.`],
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
    "yes-public-catalog": "Use the public catalog entry, then check the exact configuration and its tests.",
    "not-yet-public-catalog-proof-ready": "Tests and useful configurations exist, but the catalog review is not finished.",
    "not-yet-user-ready": "The current configuration is too close to the chart default; design a more useful starting configuration first.",
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
      display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap;
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
    .topbar .site-purpose {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--muted);
      font-size: .68rem;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .navlinks { display: flex; flex-wrap: wrap; gap: 14px; margin-left: auto; }
    .navlinks a { color: var(--muted); text-decoration: none; }
    .navlinks a:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
    @media (max-width: 720px) {
      .topbar .site-purpose { order: 1; }
      .topbar .navlinks { order: 2; flex-basis: 100%; margin-left: 0; }
    }
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
      .topbar .site-purpose {
        display: block;
        margin: 0 0 9px;
        line-height: 1.4;
      }
      .navlinks {
        margin-left: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 0 7px;
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

  /* --- quality floor: keyboard focus and reduced motion --- */
  a:focus-visible, button:focus-visible, input:focus-visible,
  select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 3px;
  }
  a:focus:not(:focus-visible) { outline: none; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .001ms !important;
      scroll-behavior: auto !important;
    }
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
  
  /* --- quality floor: keyboard focus and reduced motion --- */
  a:focus-visible, button:focus-visible, input:focus-visible,
  select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 3px;
  }
  a:focus:not(:focus-visible) { outline: none; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .001ms !important;
      scroll-behavior: auto !important;
    }
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
Open \`site/how-it-works.html\` to choose where reviewed configuration lives and how it reaches Kubernetes.
Open \`site/deployment-reference.html\` for the detailed source, render, route, variant, check, and delivery model.
Open \`site/try.html\` for the short Redis example.
Open \`site/ask.html\` to check a new configuration and keep its review record.
Open \`site/promote.html\` to compare current and proposed objects before staging or production.
Open \`site/configuration-decision.schema.json\` for the source-neutral record that
connects findings to accepted fixes, rejected findings, or narrow exceptions and
keeps local checks separate from ConfigHub validation, approval, promotion, and delivery.
Open \`site/d/data/config-review-decision-chain/summary.html\` for one complete
NGINX example from AI-written values through a retained decision, promotion, and Argo CD tests.
Open \`site/base-variant-records.json\` for the Catalog source-and-intent index used by
the Check and Promote pages. Open \`site/promotion-review.schema.json\` for the
browser promotion record.
Open \`site/testing.html\` for working starting, managed, platform, and App examples.
Open \`site/kubara.html\` for the Kubara buyer story, six adoption steps, GUI path,
evidence status, and full technical references.
Open \`site/confighub.html\` to sign up, follow the official tutorial, or read the blog.
Open \`site/entry-path-reference.html\` for detailed Helm, AICR, OCI, and YAML commands.
Open \`site/variants.html\` for base variants, derived variants, and promotion entry points.
Open \`site/journey.html\` for Apps that use configuration already saved in ConfigHub.
Open \`site/custom-apps.html\` for deeper application examples with custom apps,
multi-chart stacks, and overlays.
Open \`site/existing-apps.html\` for adopting existing Helm, Argo, Flux,
rendered YAML, or live-cluster state without taking over too early.
Open \`site/ai.html\` to install the Config Workshop agent skill and use it for
Catalog questions, local configuration checks, promotion reviews, and source-format inspection.
Open \`site/security.html\` for security, provenance, Secrets, scans, and evidence limits.
Open \`site/future.html\` for roadmap and managed ideas that should not be
confused with shipped public evidence.
Open \`site/operations.html\` for Ops: scans, gates, delivery, observation, adoption,
upgrades, rollback, bulk patching, and fleet questions.
Open \`site/day1-operations.html\` only as a compatibility redirect to \`site/operations.html\`.
Open \`site/docs.html\` to find instructions for the step or problem in front of you.
Open \`site/docs-reference.html\` for the complete technical guide and evidence index.
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
Open \`site/charts/index.html\` for the Component Catalog and all retained package-version pages.
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
