#!/usr/bin/env node

// Deterministically reconcile the current Kubara + ConfigHub mini-IDP.
//
// The required path is deliberately conventional: committed Kubara v0.13.0
// output is stored as ConfigHub Units, ConfigHub variants bind it to four
// persistent targets, and ConfigHub-owned Argo CD/argobot reconciles each
// target. No AI authoring or migration step is required.
//
// Modes:
//   --plan            validate local inputs and print the exact offline plan
//   --apply           reconcile the allowlisted live state and write a receipt
//   --verify          read-only comparison of live state with the plan
//   --receipt-verify  verify the committed live receipt without a login
//   --self-test       exercise restart-safe release decisions without live I/O
//
// Safety properties:
//   * live modes require the Kubara organization;
//   * every writable Space, Unit, Trigger, Filter, and Link is allowlisted;
//   * ConfigHub objects and hx-app-* clusters are never deleted by this script;
//   * exact workload Applications retain Kubara's bounded Argo prune behavior;
//   * one exact tracked namespace-move DaemonSet may be pruned only after
//     proving the old/new tracking identities and shared host-network binding;
//   * a completely absent cluster may be created with `cub cluster up`;
//   * partial state within one cluster is rejected; a complete ordered fleet
//     prefix resumes only from the exact write-ahead bootstrap journal;
//   * apply refuses to overlap the serial live-parity harness;
//   * PILOT_ACTIVE and other mutation-guard environment variables are ignored,
//     as explicitly requested for this example.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { performance } from "node:perf_hooks";

import {
  check,
  identityFor,
  parseDocs,
  readYaml,
  readYamlText,
  relativeRepo,
  repoRoot,
  sha256,
  sha256File,
  toYaml,
} from "./lib/proof-common.mjs";
import {
  PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS,
  PROTECTED_NAMESPACE_OWNERSHIP_POLICY,
  assertProtectedNamespaceDetachmentEvidence,
  classifyProtectedNamespaceOwnership,
  protectedNamespaceDetachPatch,
  protectedNamespaceDetachmentFor,
  selfTestProtectedNamespaceOwnership,
  validateProtectedNamespaceDetached,
} from "./lib/kubara-protected-namespace.mjs";
import {
  KIND_TRAEFIK_CONTRACTS,
  KIND_TRAEFIK_POLICY,
  assertKindTraefikLiveObjects,
  assertKindTraefikRenderedObjects,
  selfTestKindTraefikContract,
} from "./lib/kubara-kind-traefik.mjs";

const modes = new Set(["--plan", "--apply", "--verify", "--receipt-verify", "--self-test"]);
validateCliArgs();
const requestedModes = process.argv.filter((arg) => modes.has(arg));
check(requestedModes.length <= 1, `choose one mode: ${[...modes].join(", ")}`);
const mode = requestedModes[0] ?? "--plan";
const contextValue = optionValue("--context") || process.env.CUB_CONTEXT?.trim() || "";
let pinnedContextName = contextValue;
let contextArgs = contextValue ? ["--context", contextValue] : [];

const ORGANIZATION = "Kubara";
const ORGANIZATION_EXTERNAL_ID = "58b23b85-9699-4384-bd57-80ef695a1d58";
const ORGANIZATION_ENTITY_ID = "12c33fa8-00b1-4011-ad3e-19d56458b29c";
const CONFIGHUB_SERVER_URL = "https://hub.confighub.com";
const KUBARA_VERSION = "v0.13.0";
const CATALOG_VERSION = "1.1.0";
const MIN_CUB_VERSION = "0.2.11";
const EXAMPLE_COHORT = "kubara-v0.13.0";
const PRIOR_COHORT = "kubara-v0.12.0";
const CONTROL_SPACE = "hx-platform";
const APPROVAL_TRIGGER = "require-approval";
const APPROVAL_FILTER = "prod-approval";
const APPROVAL_GATE = `${CONTROL_SPACE}/${APPROVAL_TRIGGER}/vet-approvedby`;
const PROD_SAFETY_GATE = "prod-critical";
const SCENARIO_VERSION = "hx-web-promotion-v2";
const SCENARIO_STEPS = [
  "merge-bases-reset",
  "initial-rollout",
  "base-promotion",
  "prod-approval",
  "prod-a-rollback",
  "staging-departure",
  "departure-survives-promotion",
];
const LINK_REASON_ANNOTATION = "helm-expt.confighub.com/reason";
const CONFIGHUB_OCI_SPACE_PREFIX = "oci://oci.hub.confighub.com:443/space/";
const ARGO_PRUNE_POLICY = "Argo may prune only resources tracked by one of the 27 exact allowlisted deployment Applications; ConfigHub objects and persistent clusters are never deleted";
const ARGO_NAMESPACE_MOVE_POLICY = "one declared tracked DaemonSet may be deleted with UID/resourceVersion preconditions from its obsolete namespace only at the exact expected OCI revision and after Argo marks it requiresPruning, the same desired workload exists in the Kubara namespace, both tracking IDs match, both ConfigHub origins match, and the reviewed TCP/9100 host-network binding conflicts";
const ARGO_RETRY_POLICY = "persist one 90-minute convergence deadline and at most four sync-submission reservations per Application and OCI digest across restarts; observe an existing Argo operation without replacement for up to 60 minutes; wait for exact-revision health without resyncing for up to 30 minutes; reserve a new sync only after inactive terminal failure, OutOfSync, or wrong revision";
const ARGO_OPERATION_TIMEOUT_MS = 60 * 60 * 1000;
const ARGO_HEALTH_TIMEOUT_MS = 30 * 60 * 1000;
const ARGO_CONVERGENCE_TIMEOUT_MS = 90 * 60 * 1000;
const ARGO_MAX_SYNC_REQUESTS = 4;
const ARGO_OBSERVE_SECONDS = 5;
const NAMESPACE_MOVE_MIGRATION_ID = "hx-kps-main/node-exporter-default-to-kube-prometheus-stack/v1";
const ARGO_REVISION_POLICY = "accept only the exact latest ConfigHub OCI manifest digest reported by Argo; never use the bundle content digest as an OCI revision";
const INTERRUPTED_RELEASE_POLICY = "publish whenever any Unit head differs from its last applied revision; reuse the exact published release for metadata-only changes or ConfigHub's unchanged-bundle response; pass only the published OCI ManifestDigest to Argo";
const INTERRUPTED_SCENARIO_POLICY = "write ahead every ordered hx-web mutation as a nested transition with exact pre/post Unit, release, provenance, and UpgradeUnit checkpoints; bind approval to the exact refused heads and rollback to the exact initial-rollout revision; resume only an exact durable prefix and fail closed on every undeclared delta";
const PUBLISHED_RELEASE_SELECTION_POLICY = "filter Published = true server-side before selecting the highest ReleaseNum; withdrawn releases never satisfy currency or drive Argo";
const DELIVERY_ROOT_PUBLICATION_POLICY = "reconcile every declared Argo Application Unit first, then publish exactly one complete delivery-root release per cluster immediately before that cluster's first source Application converges; later Application Unit mutations are forbidden in that run";
const UNCHANGED_RELEASE_ERROR = "no changes were made since :latest bundle";
const GUI_IDENTITY_POLICY = "native Component, Owner, Variant, and Lane labels make the component-first Kubara catalog, faithful/adapted delivery choice, and definition-instance hub-spoke shape visible; the component-catalog-coverage Unit exposes the additive 103-component/130-version scope and all 18 Kubara selections; Kubara hub Argo and ConfigHub cluster-bootstrap Argo retain separate exact version provenance; public navigation annotations link complete evidence without claiming live health";
const PUBLIC_GUIDE_URL = "https://confighub.github.io/helm-expt/site/d/docs/demo/kubara/single-platform.html";
const PUBLIC_CATALOG_URL = "https://confighub.github.io/helm-expt/site/charts/";
const PUBLIC_CATALOG_COVERAGE_URL = "https://confighub.github.io/helm-expt/data/kubara-catalog-1.1-full-coverage/receipt.yaml";
const PUBLIC_MATRIX_URL = "https://confighub.github.io/helm-expt/data/kubara-platform-matrix/matrix.html";
const PUBLIC_WIRING_URL = "https://confighub.github.io/helm-expt/data/kubara-wiring/graph.html";
const PUBLIC_NAVIGATION_ANNOTATIONS = Object.freeze({
  "URL-Guide": PUBLIC_GUIDE_URL,
  "URL-Catalog": PUBLIC_CATALOG_URL,
  "URL-CatalogCoverage": PUBLIC_CATALOG_COVERAGE_URL,
  "URL-Matrix": PUBLIC_MATRIX_URL,
  "URL-Wiring": PUBLIC_WIRING_URL,
});
const MATRIX_PUBLICATION_PATH = "data/kubara-platform-matrix/matrix.json";
const RECEIPT_PATH = join(repoRoot, "runs", "kubara-mini-idp-reconcile", "receipt.yaml");
const OPERATION_JOURNAL_PATH = join(homedir(), ".confighub", "locks", "helm-expt-kubara-operation-journal.json");
const FAITHFUL_PROOF_SCRIPT = "scripts/run-kubara-faithful-hub-spoke-proof.mjs";
const FAITHFUL_FAILURE_PATH = "runs/kubara-faithful-hub-spoke/failure.yaml";
const FAITHFUL_ATTEMPT_PATH = "runs/kubara-faithful-hub-spoke/attempt.yaml";
const PRESERVED_FAITHFUL_CONTROL_UNITS = [
  {
    slug: "faithful-hub-spoke-plan",
    receiptKey: "planCheckAndApproval",
    role: "FaithfulLanePlan",
    proofPhase: "Plan",
  },
  {
    slug: "faithful-hub-spoke-attestation",
    receiptKey: "observedAttestation",
    role: "FaithfulLaneAttestation",
    proofPhase: "Observed",
  },
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let cachedCubVersions = null;
let cachedFaithfulReceipt = null;
const PROCESS_STARTED_AT_MS = performance.now();
const commandPerformance = new Map();
const canonicalYamlCache = new Map();
const canonicalYamlPerformance = {
  requests: 0,
  hits: 0,
  misses: 0,
  parseMs: 0,
};
let activeVerificationReadSnapshot = null;

process.once("exit", () => {
  const evidence = performanceEvidence(`${mode.replace(/^--/, "")}-process-exit`);
  process.stderr.write(`kubara-performance ${JSON.stringify(evidence)}\n`);
});

const paths = {
  config: "examples/kubara/current-platform/source/config.yaml",
  argoValues: "examples/kubara/current-platform/generated/platform-configs/hx-app-dev/helm/argo-cd/values.generated.yaml",
  argoAppSetTemplate: "examples/kubara/current-platform/generated/platform-components/helm/template-library/templates/argocd/_argo.appset.tpl",
  sourceLock: "examples/kubara/current-platform/source-lock.yaml",
  componentArtifacts: "examples/kubara/current-platform/component-artifacts.yaml",
  catalogFullCoverageReceipt: "data/kubara-catalog-1.1-full-coverage/receipt.yaml",
  generationReceipt: "examples/kubara/current-platform/generation-receipt.yaml",
  appSourceLock: "examples/kubara/current-platform/apps/source-lock.yaml",
  adapterOutput: "data/kubara-catalog-adapter/adapter-output.yaml",
  adapterReceipt: "data/kubara-catalog-adapter/receipt.yaml",
  desiredMatrix: "data/kubara-platform-matrix/desired-matrix.json",
  wiring: "data/kubara-wiring/graph.json",
  effectiveReceipt: "data/kubara-effective-renders/current-platform/receipt.yaml",
  qualificationReceipt: "runs/kubara-current-live-qualification/receipt.yaml",
  promotionReceipt: "data/kubara-catalog-refresh/current-root-promotion/receipt.yaml",
  faithfulReceipt: "runs/kubara-faithful-hub-spoke/receipt.yaml",
};

const requiredApplyEvidence = [
  paths.qualificationReceipt,
  paths.promotionReceipt,
  paths.catalogFullCoverageReceipt,
  paths.faithfulReceipt,
];

const FLEET = [
  target("dev", "hx-app-dev", "Dev", "local", "dev", "Hub"),
  target("staging", "hx-app-staging", "Staging", "local", "staging", "Spoke"),
  target("prod-a", "hx-app-prod-a", "Prod", "us-east", "prod", "Spoke"),
  target("prod-b", "hx-app-prod-b", "Prod", "us-west", "prod", "Spoke"),
];
const DEV = FLEET[0];

const EXPECTED_VERSIONS = {
  "argo-cd": "10.2.1",
  "cert-manager": "v1.21.0",
  "external-secrets": "2.8.0",
  "homer-dashboard": "0.1.0",
  "kube-prometheus-stack": "87.19.2",
  "prometheus-blackbox-exporter": "11.15.1",
  "metrics-server": "3.13.1",
  traefik: "41.0.2",
};
const ARGOBOT_VERSION = "v0.1.6";
const ARGOBOT_IMAGE = `ghcr.io/confighub/argobot:${ARGOBOT_VERSION}`;
const ARGOBOT_SOURCE_REF = "oci://ghcr.io/confighub/configs/argobot";
const ARGOBOT_SOURCE_DIGEST = "sha256:59962c4e80bccac0b69330ff2bec0bf0be8aa5e953bdcb6edf00387f1bcd0fce";

const ARGO_CD_DEFINITION_SPACE = "hx-argo-base";
const ARGO_CD_DEFINITION_UNIT = "argo-cd";
const ARGO_CD_EVIDENCE_UNIT = "kubara-argo-definition";
const ARGO_CD_PAYLOAD_KEY = `${CONTROL_SPACE}/${ARGO_CD_EVIDENCE_UNIT}`;
const KUBARA_ARGO_RUNTIME_VERSION = "v3.4.5";
const KUBARA_ARGO_RUNTIME_IMAGE = `quay.io/argoproj/argocd:${KUBARA_ARGO_RUNTIME_VERSION}`;
const ARGO_CD_RUNTIME_SPACE = "hx-argo-runtime-base";
const ARGO_CD_RUNTIME_UNIT = "argo-cd-runtime";
const ARGO_CD_RUNTIME_VERSION = "v3.4.6";
const ARGO_CD_RUNTIME_IMAGE = `quay.io/argoproj/argocd:${ARGO_CD_RUNTIME_VERSION}`;
const ARGO_CD_RUNTIME_PAYLOAD_KEY = `${ARGO_CD_RUNTIME_SPACE}/${ARGO_CD_RUNTIME_UNIT}`;
const ARGO_CD_RUNTIME_CONTAINER_PAIRS = Object.freeze([
  ["argocd-application-controller", "argocd-application-controller"],
  ["argocd-applicationset-controller", "argocd-applicationset-controller"],
  ["argocd-dex-server", "copyutil"],
  ["argocd-notifications-controller", "argocd-notifications-controller"],
  ["argocd-redis", "secret-init"],
  ["argocd-repo-server", "argocd-repo-server"],
  ["argocd-repo-server", "copyutil"],
  ["argocd-server", "argocd-server"],
]);

const CONTROL_UNITS = [
  controlUnit("platform-contract", paths.config, "AppConfig/YAML", "PlatformContract"),
  controlUnit("component-catalog-selection", paths.componentArtifacts, "AppConfig/YAML", "ComponentCatalogSelection"),
  controlUnit("component-catalog-coverage", paths.catalogFullCoverageReceipt, "AppConfig/YAML", "ComponentCatalogCoverage", true),
  controlUnit("catalog-adapter", paths.adapterOutput, "AppConfig/YAML", "CatalogAdapter"),
  controlUnit("catalog-adapter-receipt", paths.adapterReceipt, "AppConfig/YAML", "CatalogAdapterReceipt"),
  controlUnit("platform-matrix", paths.desiredMatrix, "AppConfig/JSON", "PlatformMatrixDesired"),
  controlUnit("wiring-ledger", paths.wiring, "AppConfig/JSON", "WiringLedger"),
  controlUnit("current-generation-receipt", paths.generationReceipt, "AppConfig/YAML", "GenerationReceipt"),
  controlUnit("current-live-qualification", paths.qualificationReceipt, "AppConfig/YAML", "QualificationReceipt", true),
  controlUnit("catalog-root-promotion", paths.promotionReceipt, "AppConfig/YAML", "CatalogPromotionReceipt", true),
  controlUnit("faithful-hub-spoke-receipt", paths.faithfulReceipt, "AppConfig/YAML", "FaithfulLaneReceipt", true),
  {
    slug: ARGO_CD_EVIDENCE_UNIT,
    source: "examples/kubara/current-platform/effective-renders/hx-app-dev/argo-cd/release-objects.yaml",
    toolchain: "Kubernetes/YAML",
    role: "KubaraDeliveryDefinition",
    requiredForApply: false,
  },
];

const SURFACES = [
  surface({
    prefix: "hx-kps-crds",
    component: "kube-prometheus-stack",
    destinationNamespace: "kube-prometheus-stack",
    version: EXPECTED_VERSIONS["kube-prometheus-stack"],
    role: "Lifecycle",
    part: "crds",
    targets: [DEV],
    materialize: ({ kps }) => renderDocuments(kps.filter((doc) => doc.kind === "CustomResourceDefinition")),
    order: 10,
    serverSideApply: true,
  }),
  surface({
    prefix: "hx-cm",
    component: "cert-manager",
    destinationNamespace: "cert-manager",
    version: EXPECTED_VERSIONS["cert-manager"],
    targets: FLEET,
    sourceFor: (item) => effectiveRender(item.cluster, "cert-manager"),
    order: 20,
    serverSideApply: true,
    ignoreInjectedCertificateData: true,
  }),
  surface({
    prefix: "hx-eso",
    component: "external-secrets",
    destinationNamespace: "external-secrets",
    version: EXPECTED_VERSIONS["external-secrets"],
    targets: [DEV],
    sourceFor: () => effectiveRender(DEV.cluster, "external-secrets"),
    order: 30,
    serverSideApply: true,
  }),
  surface({
    prefix: "hx-eso-store",
    component: "external-secrets",
    destinationNamespace: "external-secrets",
    version: EXPECTED_VERSIONS["external-secrets"],
    role: "Prerequisite",
    part: "cluster-secret-store",
    targets: [DEV],
    sourceFor: () => "examples/kubara/current-platform/target-facts/hx-app-dev/cluster-secret-store.yaml",
    order: 40,
  }),
  surface({
    prefix: "hx-eso-grafana-es",
    component: "external-secrets",
    kubaraService: "kube-prometheus-stack",
    destinationNamespace: "kube-prometheus-stack",
    version: EXPECTED_VERSIONS["external-secrets"],
    role: "Wiring",
    part: "grafana-admin-credentials",
    targets: [DEV],
    materialize: ({ kps }) => renderDocuments(kps.filter(
      (doc) => doc.kind === "ExternalSecret" || isKpsNamespace(doc),
    )),
    order: 45,
  }),
  surface({
    prefix: "hx-kps-main",
    component: "kube-prometheus-stack",
    bundledCatalogComponent: "prometheus-blackbox-exporter",
    bundledComponentVersion: EXPECTED_VERSIONS["prometheus-blackbox-exporter"],
    destinationNamespace: "kube-prometheus-stack",
    version: EXPECTED_VERSIONS["kube-prometheus-stack"],
    targets: [DEV],
    materialize: ({ kps }) => renderDocuments(
      kps.filter((doc) => !["CustomResourceDefinition", "ExternalSecret"].includes(doc.kind) && !isKpsNamespace(doc)),
    ),
    order: 50,
    serverSideApply: true,
    namespaceMovePrunes: [{
      migrationID: NAMESPACE_MOVE_MIGRATION_ID,
      apiVersion: "apps/v1",
      resource: "daemonset",
      kind: "DaemonSet",
      name: "kube-prometheus-stack-prometheus-node-exporter",
      fromNamespace: "default",
      conflictingBindings: ["TCP/9100"],
      reason: "hostNetwork TCP/9100 prevents the Kubara-namespace replacement from becoming healthy before PruneLast",
    }],
  }),
  surface({
    prefix: "hx-metrics",
    component: "metrics-server",
    destinationNamespace: "metrics-server",
    version: EXPECTED_VERSIONS["metrics-server"],
    targets: [DEV],
    sourceFor: () => effectiveRender(DEV.cluster, "metrics-server"),
    order: 60,
    serverSideApply: true,
  }),
  surface({
    prefix: "hx-traefik",
    component: "traefik",
    destinationNamespace: "traefik",
    version: EXPECTED_VERSIONS.traefik,
    targets: FLEET,
    sourceFor: (item) => effectiveRender(item.cluster, "traefik"),
    order: 70,
    serverSideApply: true,
  }),
  surface({
    prefix: "hx-homer",
    component: "homer-dashboard",
    destinationNamespace: "homer-dashboard",
    version: EXPECTED_VERSIONS["homer-dashboard"],
    targets: [DEV],
    sourceFor: () => effectiveRender(DEV.cluster, "homer-dashboard"),
    order: 80,
    serverSideApply: true,
  }),
];

const APP_FAMILIES = [
  appFamily({
    prefix: "hx-web",
    role: "Application",
    catalog: "ConfigHubApplications",
    version: "6784fb0834aa7dbbe12e3d7471e69c290df3e6ba810dc38b34ae33d3c1c05f7d",
    destinationNamespace: "hx-web",
    units: [
      appUnit("hx-web-namespace", "examples/kubara/current-platform/apps/hx-web/base/namespace.yaml"),
      appUnit("hx-web-deployment", "examples/kubara/current-platform/apps/hx-web/base/deployment.yaml", { scenario: true }),
      appUnit("hx-web-service", "examples/kubara/current-platform/apps/hx-web/base/service.yaml"),
    ],
    order: 90,
    scenario: true,
  }),
  appFamily({
    prefix: "hx-web-platform",
    component: "hx-web",
    part: "platform-binding",
    role: "PlatformBinding",
    catalog: "ConfigHubApplications",
    version: KUBARA_VERSION,
    destinationNamespace: "hx-web",
    units: [appUnit("hx-web-platform", [
      "examples/kubara/current-platform/apps/hx-web/platform/certificate.yaml",
      "examples/kubara/current-platform/apps/hx-web/platform/ingress.yaml",
    ])],
    order: 100,
  }),
  appFamily({
    prefix: "hx-cubbychat",
    component: "cubbychat",
    role: "Application",
    catalog: "ConfigHubApplications",
    version: "e9e76a076924d95897c3ede7a0f21cec523c4f6f",
    destinationNamespace: "cubbychat",
    units: [appUnit("hx-cubbychat", [
      "examples/kubara/current-platform/apps/cubbychat/base/namespace.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/credentials.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/postgres-service.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/postgres.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/backend-service.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/backend.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/frontend-service.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/frontend.yaml",
      "examples/kubara/current-platform/apps/cubbychat/platform/certificate.yaml",
      "examples/kubara/current-platform/apps/cubbychat/platform/ingress.yaml",
    ])],
    order: 110,
  }),
];

const OWNED_SPACE_LABELS = new Set([
  "ExampleCohort",
  "KubaraVersion",
  "CatalogVersion",
  "Cluster",
  "Environment",
  "Region",
  "Role",
  "Scope",
  "DefinitionScope",
  "Component",
  "ComponentSurface",
  "Owner",
  "KubaraComponent",
  "ComponentVersion",
  "RuntimeVersion",
  "RuntimeImage",
  "Part",
  "Layer",
  "SourceType",
  "Variant",
  "InstanceOf",
  "DefinitionSpace",
  "ClusterRole",
  "KubaraStage",
  "DeliveryMode",
  "Reconciler",
  "ControlPlane",
  "Catalog",
  "CatalogComponent",
  "BundledCatalogComponent",
  "BundledComponentVersion",
  "StartHere",
  "Lane",
]);

const OWNED_UNIT_LABELS = new Set([
  ...OWNED_SPACE_LABELS,
  "ApplicationKind",
  "CatalogComponents",
  "CatalogVersions",
  "KubaraSelections",
  "Retention",
  "SourceSpace",
  "PromotionUpstreamSpace",
]);

const OWNED_LINK_LABELS = new Set([
  "ExampleCohort",
  "KubaraVersion",
  "CatalogVersion",
  "Relationship",
  "ConsumerComponent",
  "ProviderComponent",
]);

const OWNED_PUBLIC_ANNOTATIONS = new Set(Object.keys(PUBLIC_NAVIGATION_ANNOTATIONS));
const START_HERE_CONTROL_UNITS = new Set([
  "platform-contract",
  "component-catalog-selection",
  "component-catalog-coverage",
  "platform-matrix",
  "wiring-ledger",
  "faithful-hub-spoke-receipt",
]);

const FAITHFUL_LANE_CONTROL_UNITS = new Set([
  "faithful-hub-spoke-receipt",
  ARGO_CD_EVIDENCE_UNIT,
]);

function target(suffix, cluster, environment, region, kubaraStage, clusterRole) {
  return { suffix, cluster, environment, region, kubaraStage, clusterRole };
}

function controlUnit(slug, source, toolchain, role, requiredForApply = false) {
  return { slug, source, toolchain, role, requiredForApply };
}

function surface(definition) {
  return {
    role: "Component",
    kubaraService: definition.component,
    acceptedHealth: ["Healthy"],
    serverSideApply: false,
    ignoreInjectedCertificateData: false,
    ...definition,
  };
}

function appUnit(slug, source, extra = {}) {
  return { slug, source: Array.isArray(source) ? source : [source], ...extra };
}

function appFamily(definition) {
  return {
    targets: FLEET,
    component: definition.prefix,
    part: "application",
    acceptedHealth: ["Healthy"],
    ...definition,
  };
}

function surfaceVariant(definition, targetVariant) {
  return definition.part ? `${definition.part}-${targetVariant}` : targetVariant;
}

function appFamilyVariant(definition, targetVariant) {
  return definition.part === "application"
    ? targetVariant
    : `${definition.part}-${targetVariant}`;
}

function effectiveRender(cluster, service) {
  return `examples/kubara/current-platform/effective-renders/${cluster}/${service}/release-objects.yaml`;
}

function isKpsNamespace(doc) {
  return doc.kind === "Namespace" && doc.metadata?.name === "kube-prometheus-stack";
}

function absolute(relative) {
  return join(repoRoot, relative);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  check(process.argv[index + 1], `${name} requires a value`);
  return process.argv[index + 1];
}

function validateCliArgs() {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (modes.has(arg)) continue;
    if (arg === "--context") {
      check(args[index + 1] && !args[index + 1].startsWith("--"), "--context requires a value");
      index += 1;
      continue;
    }
    check(false, `unknown argument ${arg}`);
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function renderDocuments(documents) {
  check(documents.length > 0, "refusing to materialize an empty Kubernetes Unit");
  return `${documents.map((doc) => toYaml(doc)).join("\n---\n")}\n`;
}

function joinedSource(pathsToJoin) {
  return `${pathsToJoin.map((item) => readFileSync(absolute(item), "utf8").trimEnd()).join("\n---\n")}\n`;
}

function expectedLabels(extra = {}) {
  return {
    ExampleCohort: EXAMPLE_COHORT,
    KubaraVersion: KUBARA_VERSION,
    CatalogVersion: CATALOG_VERSION,
    ...extra,
  };
}

function clusterIdentityLabels(item) {
  return {
    Cluster: item.cluster,
    Environment: item.environment,
    Region: item.region,
    ClusterRole: item.clusterRole,
    KubaraStage: item.kubaraStage,
  };
}

function deliveryIdentityLabels() {
  return {
    Lane: "Adapted",
    DeliveryMode: "ConfigHubOCI",
    Reconciler: "ClusterLocalArgo",
    ControlPlane: "ConfigHub",
  };
}

function definitionLabels(prefix, role, extra = {}) {
  return expectedLabels({
    Component: prefix,
    CatalogComponent: extra.CatalogComponent ?? extra.KubaraComponent ?? prefix,
    ...(extra.Catalog ? { Owner: extra.Owner ?? extra.Catalog } : {}),
    Layer: role.includes("Application") ? "App" : "Platform",
    Scope: "Fleet",
    DefinitionScope: "Base",
    Role: `${role}Definition`,
    Variant: "base",
    ControlPlane: "ConfigHub",
    ...extra,
  });
}

function instanceLabels(prefix, role, item, extra = {}) {
  return expectedLabels({
    Component: prefix,
    CatalogComponent: extra.CatalogComponent ?? extra.KubaraComponent ?? prefix,
    ...(extra.Catalog ? { Owner: extra.Owner ?? extra.Catalog } : {}),
    Layer: role.includes("Application") ? "App" : "Platform",
    ...clusterIdentityLabels(item),
    Role: `${role}Instance`,
    Variant: item.suffix,
    InstanceOf: prefix,
    DefinitionSpace: `${prefix}-base`,
    ...deliveryIdentityLabels(),
    ...extra,
  });
}

function controlUnitNavigation(slug) {
  if (!START_HERE_CONTROL_UNITS.has(slug)) return { labels: {}, annotations: {} };
  if (slug === "component-catalog-selection") {
    return {
      labels: { StartHere: "true" },
      annotations: { "URL-Guide": PUBLIC_GUIDE_URL, "URL-Catalog": PUBLIC_CATALOG_URL },
    };
  }
  if (slug === "component-catalog-coverage") {
    return {
      labels: {
        StartHere: "true",
        CatalogComponents: "103",
        CatalogVersions: "130",
        KubaraSelections: "18",
        Retention: "AdditiveOnly",
      },
      annotations: {
        "URL-Guide": PUBLIC_GUIDE_URL,
        "URL-Catalog": PUBLIC_CATALOG_URL,
        "URL-CatalogCoverage": PUBLIC_CATALOG_COVERAGE_URL,
      },
    };
  }
  if (slug === "platform-matrix") {
    return {
      labels: { StartHere: "true" },
      annotations: { "URL-Guide": PUBLIC_GUIDE_URL, "URL-Matrix": PUBLIC_MATRIX_URL },
    };
  }
  if (slug === "wiring-ledger") {
    return {
      labels: { StartHere: "true" },
      annotations: { "URL-Guide": PUBLIC_GUIDE_URL, "URL-Wiring": PUBLIC_WIRING_URL },
    };
  }
  return {
    labels: { StartHere: "true" },
    annotations: slug === "platform-contract"
      ? PUBLIC_NAVIGATION_ANNOTATIONS
      : { "URL-Guide": PUBLIC_GUIDE_URL },
  };
}

function managedUnitLabels({
  role,
  component,
  kubaraComponent = component,
  catalogComponent = kubaraComponent,
  componentVersion,
  catalog,
  variant,
  fleetItem = null,
  extra = {},
}) {
  return expectedLabels({
    Role: role,
    Component: component,
    ...(kubaraComponent ? { KubaraComponent: kubaraComponent } : {}),
    CatalogComponent: catalogComponent,
    ComponentVersion: componentVersion,
    Catalog: catalog,
    Owner: catalog,
    Variant: variant,
    ControlPlane: "ConfigHub",
    ...(fleetItem ? { ...clusterIdentityLabels(fleetItem), ...deliveryIdentityLabels() } : {}),
    ...extra,
  });
}

function sourceAnnotation(payload, sourcePaths, transform = "none") {
  const annotations = {
    // cub's repeated --annotation flag still uses its StringSlice parser, so
    // commas and additional equals signs inside a value are ambiguous. Keep
    // the stored provenance readable while using unambiguous separators.
    "confighub.com/source-path": sourcePaths.join(";"),
    "confighub.com/source-sha256": `sha256:${sha256(payload)}`,
    "confighub.com/source-transform": transform,
  };
  for (const [key, value] of Object.entries(annotations)) {
    assertCubAnnotationValue(key, value);
  }
  return annotations;
}

function argoCdRuntimeContract() {
  return `${toYaml({
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DeliveryRuntimeContract",
    metadata: { name: ARGO_CD_RUNTIME_UNIT },
    spec: {
      component: "argo-cd",
      lane: "Adapted",
      installedBy: "cub cluster up",
      scope: "cluster-local",
      runtimeVersion: ARGO_CD_RUNTIME_VERSION,
      runtimeImage: ARGO_CD_RUNTIME_IMAGE,
      targets: FLEET.map((item) => item.cluster),
      kubaraFaithfulDefinition: {
        space: ARGO_CD_DEFINITION_SPACE,
        unit: ARGO_CD_DEFINITION_UNIT,
        chartVersion: EXPECTED_VERSIONS["argo-cd"],
        runtimeVersion: KUBARA_ARGO_RUNTIME_VERSION,
        runtimeImage: KUBARA_ARGO_RUNTIME_IMAGE,
      },
      lineagePolicy: "cluster-local delivery is not an instance of the Kubara hub chart render",
      verificationPolicy: "the exact eight reviewed Argo CD workload/container pairs in every pinned target must equal runtimeImage",
    },
  })}\n`;
}

function materializeInputs() {
  const missing = [];
  for (const item of Object.values(paths)) {
    if (!existsSync(absolute(item))) missing.push(item);
  }
  for (const item of SURFACES) {
    for (const fleetItem of item.targets) {
      if (item.sourceFor) {
        const source = item.sourceFor(fleetItem);
        if (!existsSync(absolute(source))) missing.push(source);
      }
    }
  }
  for (const family of APP_FAMILIES) {
    for (const unit of family.units) {
      for (const source of unit.source) if (!existsSync(absolute(source))) missing.push(source);
    }
  }

  const kpsPath = effectiveRender(DEV.cluster, "kube-prometheus-stack");
  const kps = existsSync(absolute(kpsPath))
    ? parseDocs(readFileSync(absolute(kpsPath), "utf8"))
    : [];
  const payloads = new Map();
  const payload = (key, value, sourcePaths, toolchain = "Kubernetes/YAML", transform = "none") => {
    check(!payloads.has(key), `duplicate payload key ${key}`);
    const documents = toolchain === "Kubernetes/YAML" ? parseDocs(value) : [];
    const identities = documents.map(identityFor);
    const duplicateIdentities = identities.filter((identity, index) => identities.indexOf(identity) !== index);
    check(
      duplicateIdentities.length === 0,
      `${key}: duplicate Kubernetes resource identities: ${[...new Set(duplicateIdentities)].join(", ")}`,
    );
    payloads.set(key, {
      key,
      value,
      sourcePaths,
      toolchain,
      transform,
      sha256: sha256(value),
      objectCount: toolchain === "Kubernetes/YAML" ? documents.length : 1,
    });
  };

  if (kps.length) {
    check(kps.filter((doc) => doc.kind === "CustomResourceDefinition").length === 10, "current KPS render must contain 10 CRDs");
    check(kps.filter((doc) => doc.kind === "ExternalSecret").length === 1, "current KPS render must contain one Grafana ExternalSecret");
    check(kps.filter(isKpsNamespace).length === 1, "current KPS render must contain one kube-prometheus-stack Namespace");
  }

  for (const item of SURFACES) {
    for (const fleetItem of item.targets) {
      let value = "";
      let sourcePaths = [];
      let transform = "none";
      if (item.materialize && kps.length) {
        value = item.materialize({ kps });
        sourcePaths = [kpsPath];
        transform = item.part === "crds"
          ? "select-kind:CustomResourceDefinition"
          : item.part === "grafana-admin-credentials"
            ? "select-kind:Namespace/kube-prometheus-stack;ExternalSecret"
            : "exclude-kinds:CustomResourceDefinition;ExternalSecret;Namespace/kube-prometheus-stack";
      } else if (item.sourceFor) {
        const source = item.sourceFor(fleetItem);
        sourcePaths = [source];
        if (existsSync(absolute(source))) value = readFileSync(absolute(source), "utf8");
      }
      if (value) payload(`${item.prefix}/${fleetItem.suffix}`, value, sourcePaths, "Kubernetes/YAML", transform);
    }
  }

  for (const family of APP_FAMILIES) {
    for (const unit of family.units) {
      const value = unit.source.every((source) => existsSync(absolute(source)))
        ? joinedSource(unit.source)
        : "";
      if (!value) continue;
      if (unit.scenario) {
        const initialDocs = parseDocs(value);
        for (const stage of ["initial", "v1", "v2"]) {
          const transformed = hxWebPayload(initialDocs, { stage, target: null });
          payload(`${family.prefix}/base/${unit.slug}/${stage}`, transformed, unit.source, "Kubernetes/YAML", `hx-web-${stage}`);
        }
        payload(
          `${family.prefix}/staging/${unit.slug}/departure`,
          hxWebPayload(initialDocs, { stage: "departure", target: FLEET[1] }),
          unit.source,
          "Kubernetes/YAML",
          "hx-web-staging-departure",
        );
        for (const fleetItem of family.targets) {
          const transformed = hxWebPayload(initialDocs, { stage: "final", target: fleetItem });
          payload(`${family.prefix}/${fleetItem.suffix}/${unit.slug}/final`, transformed, unit.source, "Kubernetes/YAML", `hx-web-final-${fleetItem.suffix}`);
        }
      } else {
        payload(`${family.prefix}/base/${unit.slug}`, value, unit.source);
        for (const fleetItem of family.targets) payload(`${family.prefix}/${fleetItem.suffix}/${unit.slug}`, value, unit.source);
      }
    }
  }

  for (const control of CONTROL_UNITS) {
    if (!existsSync(absolute(control.source))) continue;
    const value = readFileSync(absolute(control.source), "utf8");
    payload(`${CONTROL_SPACE}/${control.slug}`, value, [control.source], control.toolchain);
  }

  payload(
    ARGO_CD_RUNTIME_PAYLOAD_KEY,
    argoCdRuntimeContract(),
    ["scripts/reconcile-kubara-mini-idp.mjs"],
    "AppConfig/YAML",
    "embedded-reviewed-runtime-contract",
  );

  return { missing: [...new Set(missing)].sort(), kps, payloads };
}

function hxWebPayload(initialDocs, { stage, target: fleetItem }) {
  const docs = structuredClone(initialDocs);
  const deployment = docs.find((doc) => doc.kind === "Deployment" && doc.metadata?.name === "hx-web");
  check(deployment, "hx-web deployment fixture is missing");
  deployment.metadata.annotations ??= {};
  const effectiveStage = stage === "final"
    ? fleetItem?.suffix === "prod-a"
      ? "initial"
      : fleetItem?.suffix === "prod-b"
        ? "v1"
        : "v2"
    : stage;
  if (effectiveStage !== "initial") {
    deployment.spec.replicas = 3;
    deployment.metadata.annotations["platform.confighub.com/revision"] = "promotion-v1";
  }
  if (effectiveStage === "v2") {
    deployment.metadata.annotations["platform.confighub.com/promotion"] = "promotion-v2";
  }
  if (["departure", "final"].includes(stage) && fleetItem?.suffix === "staging") {
    const container = deployment.spec?.template?.spec?.containers?.[0];
    check(container, "hx-web deployment has no first container");
    container.env ??= [];
    if (!container.env.some((entry) => entry.name === "SANDBOX_URL")) {
      container.env.push({
        name: "SANDBOX_URL",
        value: "http://sandbox.hx-web.svc:8080",
      });
    }
  }
  return renderDocuments(docs);
}

function buildPlan(inputs) {
  verifyLocalContract(inputs, { requireLiveEvidence: false });
  const spaces = [];
  const managedUnits = [];
  const deployments = [];

  spaces.push({
    slug: CONTROL_SPACE,
    type: "control",
    labels: expectedLabels({
      CatalogComponent: "platform-control",
      ComponentSurface: "platform-control",
      ComponentVersion: KUBARA_VERSION,
      Layer: "Platform",
      Scope: "Fleet",
      Role: "PlatformControl",
      SourceType: "Kubara+ConfigHub",
      Variant: "base",
      ControlPlane: "ConfigHub",
      Catalog: "ConfigHubControl",
      Owner: "ConfigHubControl",
      StartHere: "true",
    }),
    annotations: PUBLIC_NAVIGATION_ANNOTATIONS,
  });
  spaces.push({
    slug: ARGO_CD_DEFINITION_SPACE,
    type: "component-definition",
    labels: definitionLabels("argo-cd", "Component", {
      ComponentSurface: "argocd-delivery",
      KubaraComponent: "argo-cd",
      ComponentVersion: EXPECTED_VERSIONS["argo-cd"],
      RuntimeVersion: KUBARA_ARGO_RUNTIME_VERSION,
      RuntimeImage: KUBARA_ARGO_RUNTIME_IMAGE,
      Catalog: "KubaraBootstrap",
      Lane: "Faithful",
    }),
  });
  spaces.push({
    slug: ARGO_CD_RUNTIME_SPACE,
    type: "delivery-runtime-definition",
    labels: definitionLabels("argo-cd", "DeliveryRuntime", {
      ComponentSurface: "argocd-delivery-runtime",
      ComponentVersion: ARGO_CD_RUNTIME_VERSION,
      RuntimeVersion: ARGO_CD_RUNTIME_VERSION,
      RuntimeImage: ARGO_CD_RUNTIME_IMAGE,
      Catalog: "ConfigHubBootstrap",
      Lane: "Adapted",
    }),
  });
  for (const item of FLEET) {
    spaces.push({
      slug: item.cluster,
      type: "cluster-target",
      labels: expectedLabels({
        CatalogComponent: "cluster-target",
        ComponentSurface: "cluster-target",
        ComponentVersion: KUBARA_VERSION,
        Layer: "Platform",
        ...clusterIdentityLabels(item),
        Role: "ClusterTarget",
        Variant: item.suffix,
        Catalog: "ConfigHubControl",
        Owner: "ConfigHubControl",
        ...deliveryIdentityLabels(),
      }),
    });
    spaces.push({
      slug: `${item.cluster}-argo-apps`,
      type: "delivery-instance",
      labels: instanceLabels("argocd-delivery", "Delivery", item, {
        Component: "argo-cd",
        ComponentSurface: "argocd-delivery",
        InstanceOf: ARGO_CD_RUNTIME_UNIT,
        DefinitionSpace: ARGO_CD_RUNTIME_SPACE,
        CatalogComponent: "argo-cd",
        ComponentVersion: ARGO_CD_RUNTIME_VERSION,
        RuntimeVersion: ARGO_CD_RUNTIME_VERSION,
        RuntimeImage: ARGO_CD_RUNTIME_IMAGE,
        Catalog: "ConfigHubBootstrap",
      }),
    });
  }
  spaces.push({
    slug: "argobot-base",
    type: "delivery-definition",
    labels: definitionLabels("argobot", "Delivery", {
      ComponentSurface: "argobot",
      ComponentVersion: ARGOBOT_VERSION,
      Catalog: "ConfigHubDelivery",
    }),
  });
  for (const item of FLEET) {
    spaces.push({
      slug: `argobot-${item.cluster}`,
      type: "delivery-instance",
      labels: instanceLabels("argobot", "Delivery", item, {
        ComponentSurface: "argobot",
        ComponentVersion: ARGOBOT_VERSION,
        Catalog: "ConfigHubDelivery",
      }),
    });
  }

  for (const control of CONTROL_UNITS) {
    const content = inputs.payloads.get(`${CONTROL_SPACE}/${control.slug}`);
    const navigation = controlUnitNavigation(control.slug);
    const kubaraArgo = control.slug === ARGO_CD_EVIDENCE_UNIT;
    managedUnits.push({
      space: CONTROL_SPACE,
      slug: control.slug,
      role: control.role,
      payloadKey: content?.key ?? "",
      toolchain: control.toolchain,
      provider: "None",
      target: null,
      requiredForApply: control.requiredForApply,
      labels: managedUnitLabels({
        role: control.role,
        component: kubaraArgo ? "argo-cd" : control.slug,
        kubaraComponent: kubaraArgo ? "argo-cd" : control.slug,
        componentVersion: kubaraArgo ? EXPECTED_VERSIONS["argo-cd"] : KUBARA_VERSION,
        catalog: kubaraArgo ? "KubaraBootstrap" : "ConfigHubControl",
        variant: "base",
        extra: {
          ComponentSurface: control.slug,
          SourceType: "CommittedEvidence",
          ...(FAITHFUL_LANE_CONTROL_UNITS.has(control.slug) ? { Lane: "Faithful" } : {}),
          ...navigation.labels,
        },
      }),
      annotations: navigation.annotations,
    });
  }

  managedUnits.push({
    space: ARGO_CD_DEFINITION_SPACE,
    slug: ARGO_CD_DEFINITION_UNIT,
    role: "ComponentDefinition",
    payloadKey: ARGO_CD_PAYLOAD_KEY,
    toolchain: "Kubernetes/YAML",
    provider: null,
    target: null,
    labels: managedUnitLabels({
      role: "ComponentDefinition",
      component: "argo-cd",
      componentVersion: EXPECTED_VERSIONS["argo-cd"],
      catalog: "KubaraBootstrap",
      variant: "base",
      extra: {
        ComponentSurface: "argocd-delivery",
        SourceType: "CommittedEvidence",
        RuntimeVersion: KUBARA_ARGO_RUNTIME_VERSION,
        RuntimeImage: KUBARA_ARGO_RUNTIME_IMAGE,
        Lane: "Faithful",
      },
    }),
  });

  managedUnits.push({
    space: ARGO_CD_RUNTIME_SPACE,
    slug: ARGO_CD_RUNTIME_UNIT,
    role: "DeliveryRuntimeDefinition",
    payloadKey: ARGO_CD_RUNTIME_PAYLOAD_KEY,
    toolchain: "AppConfig/YAML",
    provider: "None",
    target: null,
    labels: managedUnitLabels({
      role: "DeliveryRuntimeDefinition",
      component: "argo-cd",
      kubaraComponent: null,
      catalogComponent: "argo-cd",
      componentVersion: ARGO_CD_RUNTIME_VERSION,
      catalog: "ConfigHubBootstrap",
      variant: "base",
      extra: {
        ComponentSurface: "argocd-delivery-runtime",
        SourceType: "ReviewedRuntimeContract",
        RuntimeVersion: ARGO_CD_RUNTIME_VERSION,
        RuntimeImage: ARGO_CD_RUNTIME_IMAGE,
        Lane: "Adapted",
      },
    }),
  });

  for (const item of SURFACES) {
    check(item.destinationNamespace, `${item.prefix}: destination namespace is required`);
    for (const migration of item.namespaceMovePrunes ?? []) {
      check(migration.apiVersion === "apps/v1", `${item.prefix}: namespace-move prune apiVersion must be apps/v1`);
      check(migration.resource === "daemonset" && migration.kind === "DaemonSet", `${item.prefix}: only an exact DaemonSet namespace-move prune is supported`);
      check(migration.name && migration.fromNamespace, `${item.prefix}: namespace-move prune identity is incomplete`);
      check(migration.fromNamespace !== item.destinationNamespace, `${item.prefix}: namespace-move prune source still matches the destination namespace`);
      check(
        stableJson(migration.conflictingBindings) === stableJson(["TCP/9100"]),
        `${item.prefix}: namespace-move prune must retain the reviewed TCP/9100 conflict`,
      );
      check(migration.reason, `${item.prefix}: namespace-move prune reason is required`);
    }
    const surfaceLabels = {
      Component: item.component,
      ComponentSurface: item.prefix,
      KubaraComponent: item.component,
      CatalogComponent: item.component,
      ComponentVersion: item.version,
      Catalog: "KubaraGeneral",
      Owner: "KubaraGeneral",
      ...(item.bundledCatalogComponent ? {
        BundledCatalogComponent: item.bundledCatalogComponent,
        BundledComponentVersion: item.bundledComponentVersion,
      } : {}),
      ...(item.part ? { Part: item.part } : {}),
    };
    spaces.push({
      slug: `${item.prefix}-base`,
      type: "component-definition",
      labels: definitionLabels(item.prefix, item.role, {
        ...surfaceLabels,
        Variant: surfaceVariant(item, "base"),
      }),
    });
    managedUnits.push({
      space: `${item.prefix}-base`,
      slug: item.prefix,
      role: `${item.role}Definition`,
      payloadKey: `${item.prefix}/${item.targets[0].suffix}`,
      toolchain: "Kubernetes/YAML",
      provider: null,
      target: null,
      labels: managedUnitLabels({
        role: `${item.role}Definition`,
        component: item.component,
        kubaraComponent: item.component,
        componentVersion: item.version,
        catalog: "KubaraGeneral",
        variant: surfaceVariant(item, "base"),
        extra: {
          ComponentSurface: item.prefix,
          ...(item.part ? { Part: item.part } : {}),
          ...(item.bundledCatalogComponent ? {
            BundledCatalogComponent: item.bundledCatalogComponent,
            BundledComponentVersion: item.bundledComponentVersion,
          } : {}),
        },
      }),
    });
    for (const fleetItem of item.targets) {
      const space = `${item.prefix}-${fleetItem.suffix}`;
      spaces.push({
        slug: space,
        type: "component-instance",
        upstreamSpace: `${item.prefix}-base`,
        target: `${fleetItem.cluster}/target`,
        prodProtected: fleetItem.environment === "Prod",
        labels: instanceLabels(item.prefix, item.role, fleetItem, {
          ...surfaceLabels,
          Variant: surfaceVariant(item, fleetItem.suffix),
        }),
      });
      managedUnits.push({
        space,
        slug: item.prefix,
        role: `${item.role}Instance`,
        payloadKey: `${item.prefix}/${fleetItem.suffix}`,
        toolchain: "Kubernetes/YAML",
        provider: null,
        target: `${fleetItem.cluster}/target`,
        upstream: `${item.prefix}-base/${item.prefix}`,
        prodProtected: fleetItem.environment === "Prod",
        labels: managedUnitLabels({
          role: `${item.role}Instance`,
          component: item.component,
          kubaraComponent: item.component,
          componentVersion: item.version,
          catalog: "KubaraGeneral",
          variant: surfaceVariant(item, fleetItem.suffix),
          fleetItem,
          extra: {
            ComponentSurface: item.prefix,
            ...(item.part ? { Part: item.part } : {}),
            ...(item.bundledCatalogComponent ? {
              BundledCatalogComponent: item.bundledCatalogComponent,
              BundledComponentVersion: item.bundledComponentVersion,
            } : {}),
          },
        }),
      });
      const protectedNamespaceOwnershipDetachment = protectedNamespaceDetachmentFor(
        fleetItem.cluster,
        space,
      );
      deployments.push({
        id: space,
        type: "platform",
        order: item.order,
        cluster: fleetItem.cluster,
        space,
        appSpace: `${fleetItem.cluster}-argo-apps`,
        appUnit: space,
        destinationNamespace: item.destinationNamespace,
        serverSideApply: item.serverSideApply,
        ignoreInjectedCertificateData: item.ignoreInjectedCertificateData,
        acceptedHealth: item.acceptedHealth,
        namespaceMovePrunes: item.namespaceMovePrunes ?? [],
        protectedNamespaceOwnershipDetachment:
          protectedNamespaceOwnershipDetachment?.migrationID ?? null,
      });
    }
  }

  for (const family of APP_FAMILIES) {
    check(family.destinationNamespace, `${family.prefix}: destination namespace is required`);
    spaces.push({
      slug: `${family.prefix}-base`,
      type: "app-definition",
      labels: definitionLabels(family.prefix, family.role, {
        Component: family.component,
        ComponentSurface: family.prefix,
        KubaraComponent: family.component,
        CatalogComponent: family.component,
        ComponentVersion: family.version,
        Catalog: family.catalog,
        Variant: appFamilyVariant(family, "base"),
      }),
    });
    for (const unit of family.units) {
      managedUnits.push({
        space: `${family.prefix}-base`,
        slug: unit.slug,
        role: `${family.role}Definition`,
        payloadKey: unit.scenario
          ? `${family.prefix}/base/${unit.slug}/v2`
          : `${family.prefix}/base/${unit.slug}`,
        initialPayloadKey: unit.scenario
          ? `${family.prefix}/base/${unit.slug}/initial`
          : "",
        toolchain: "Kubernetes/YAML",
        provider: null,
        target: null,
        labels: managedUnitLabels({
          role: `${family.role}Definition`,
          component: family.component,
          kubaraComponent: family.component,
          catalogComponent: family.component,
          componentVersion: family.version,
          catalog: family.catalog,
          variant: appFamilyVariant(family, "base"),
          extra: { ComponentSurface: family.prefix },
        }),
      });
    }
    for (let index = 0; index < family.targets.length; index += 1) {
      const fleetItem = family.targets[index];
      // Only the hx-web scenario is a promotion chain. Platform bindings and
      // ordinary applications are independent per-cluster instances of the
      // reusable definition, matching Kubara's definition/instance shape.
      const upstreamSpace = family.scenario
        ? index === 0
          ? `${family.prefix}-base`
          : index === 1
            ? `${family.prefix}-dev`
            : `${family.prefix}-staging`
        : `${family.prefix}-base`;
      const space = `${family.prefix}-${fleetItem.suffix}`;
      spaces.push({
        slug: space,
        type: "app-instance",
        upstreamSpace,
        target: `${fleetItem.cluster}/target`,
        prodProtected: fleetItem.environment === "Prod",
        labels: instanceLabels(family.prefix, family.role, fleetItem, {
          Component: family.component,
          ComponentSurface: family.prefix,
          KubaraComponent: family.component,
          CatalogComponent: family.component,
          ComponentVersion: family.version,
          Catalog: family.catalog,
          Variant: appFamilyVariant(family, fleetItem.suffix),
        }),
      });
      for (const unit of family.units) {
        managedUnits.push({
          space,
          slug: unit.slug,
          role: `${family.role}Instance`,
          payloadKey: unit.scenario
            ? `${family.prefix}/${fleetItem.suffix}/${unit.slug}/final`
            : `${family.prefix}/${fleetItem.suffix}/${unit.slug}`,
          initialPayloadKey: unit.scenario
            ? `${family.prefix}/base/${unit.slug}/initial`
            : "",
          toolchain: "Kubernetes/YAML",
          provider: null,
          target: `${fleetItem.cluster}/target`,
          upstream: `${upstreamSpace}/${unit.slug}`,
          prodProtected: fleetItem.environment === "Prod",
          labels: managedUnitLabels({
            role: `${family.role}Instance`,
            component: family.component,
            kubaraComponent: family.component,
            catalogComponent: family.component,
            componentVersion: family.version,
            catalog: family.catalog,
            variant: appFamilyVariant(family, fleetItem.suffix),
            fleetItem,
            extra: { ComponentSurface: family.prefix },
          }),
        });
      }
      deployments.push({
        id: space,
        type: "application",
        order: family.order,
        cluster: fleetItem.cluster,
        space,
        appSpace: `${fleetItem.cluster}-argo-apps`,
        appUnit: space,
        destinationNamespace: family.destinationNamespace,
        serverSideApply: false,
        acceptedHealth: family.acceptedHealth,
      });
    }
  }

  const links = buildLinks();
  const fleetOrder = new Map(FLEET.map((item, index) => [item.cluster, index]));
  spaces.sort((left, right) => left.slug.localeCompare(right.slug));
  managedUnits.sort((left, right) => `${left.space}/${left.slug}`.localeCompare(`${right.space}/${right.slug}`));
  deployments.sort((left, right) => (
    left.order - right.order
      || fleetOrder.get(left.cluster) - fleetOrder.get(right.cluster)
      || left.id.localeCompare(right.id)
  ));
  check(spaces.length === 55, `internal plan error: expected 55 Spaces, got ${spaces.length}`);
  check(new Set(spaces.map((item) => item.slug)).size === spaces.length, "internal plan has duplicate Spaces");
  check(new Set(managedUnits.map((item) => `${item.space}/${item.slug}`)).size === managedUnits.length, "internal plan has duplicate Units");
  check(new Set(links.map((item) => `${item.space}/${item.slug}`)).size === links.length, "internal plan has duplicate Links");
  const plannedProtectedNamespaceDetachments = deployments
    .map((item) => item.protectedNamespaceOwnershipDetachment)
    .filter(Boolean)
    .sort();
  check(
    stableJson(plannedProtectedNamespaceDetachments)
      === stableJson(PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS.map((item) => item.migrationID).sort()),
    "internal plan protected Namespace ownership detachments drifted",
  );
  const plan = { spaces, managedUnits, deployments, links };
  assertAppFamilyPlanConsistency(plan);
  return plan;
}

function buildLinks() {
  const links = [];
  const add = (
    space,
    slug,
    fromUnit,
    toSpace,
    toUnit,
    consumerComponent,
    providerComponent,
    reason,
  ) => {
    links.push({
      space,
      slug,
      fromUnit,
      toSpace,
      toUnit,
      updateType: "NeedsProvides",
      autoUpdate: false,
      reason,
      labels: expectedLabels({
        Relationship: "NeedsProvides",
        ConsumerComponent: consumerComponent,
        ProviderComponent: providerComponent,
      }),
    });
  };
  for (const item of FLEET) {
    add(`hx-web-${item.suffix}`, "needs-platform-binding", "hx-web-deployment", `hx-web-platform-${item.suffix}`, "hx-web-platform", "hx-web", "hx-web-platform", "workload uses its reviewed Certificate and Ingress binding");
    add(`hx-web-platform-${item.suffix}`, "needs-cert-manager", "hx-web-platform", `hx-cm-${item.suffix}`, "hx-cm", "hx-web-platform", "cert-manager", "Certificate requires cert-manager and ClusterIssuer");
    add(`hx-web-platform-${item.suffix}`, "needs-traefik", "hx-web-platform", `hx-traefik-${item.suffix}`, "hx-traefik", "hx-web-platform", "traefik", "Ingress selects the traefik ingress class");
    add(`hx-cubbychat-${item.suffix}`, "needs-cert-manager", "hx-cubbychat", `hx-cm-${item.suffix}`, "hx-cm", "cubbychat", "cert-manager", "Certificate requires cert-manager and ClusterIssuer");
    add(`hx-cubbychat-${item.suffix}`, "needs-traefik", "hx-cubbychat", `hx-traefik-${item.suffix}`, "hx-traefik", "cubbychat", "traefik", "Ingress selects the traefik ingress class");
  }
  add("hx-eso-store-dev", "needs-external-secrets", "hx-eso-store", "hx-eso-dev", "hx-eso", "external-secrets-store", "external-secrets", "ClusterSecretStore requires the ESO API and controller");
  add("hx-eso-grafana-es-dev", "needs-secret-store", "hx-eso-grafana-es", "hx-eso-store-dev", "hx-eso-store", "grafana-external-secret", "external-secrets-store", "Grafana ExternalSecret reads from the cluster store");
  add("hx-eso-grafana-es-dev", "needs-external-secrets", "hx-eso-grafana-es", "hx-eso-dev", "hx-eso", "grafana-external-secret", "external-secrets", "ExternalSecret requires the ESO API and controller");
  add("hx-kps-main-dev", "needs-monitoring-crds", "hx-kps-main", "hx-kps-crds-dev", "hx-kps-crds", "kube-prometheus-stack", "monitoring-crds", "monitoring resources require their lifecycle CRDs first");
  add("hx-kps-main-dev", "needs-grafana-secret", "hx-kps-main", "hx-eso-grafana-es-dev", "hx-eso-grafana-es", "kube-prometheus-stack", "grafana-external-secret", "Grafana consumes the ESO-owned admin Secret");
  return links;
}

function assertAppFamilyPlanConsistency(desired, familyFilter = APP_FAMILIES) {
  for (const family of familyFilter) {
    const baseSpace = `${family.prefix}-base`;
    for (let index = 0; index < family.targets.length; index += 1) {
      const fleetItem = family.targets[index];
      const space = `${family.prefix}-${fleetItem.suffix}`;
      const plannedSpace = desired.spaces.find((item) => item.slug === space);
      check(plannedSpace, `${space}: app-family Space is missing from the plan`);
      const expectedUpstream = family.scenario
        ? index === 0
          ? baseSpace
          : index === 1
            ? `${family.prefix}-dev`
            : `${family.prefix}-staging`
        : baseSpace;
      check(
        plannedSpace.upstreamSpace === expectedUpstream,
        `${space}: planned upstream ${plannedSpace.upstreamSpace ?? "missing"} differs from ${expectedUpstream}`,
      );
      const plannedUnits = desired.managedUnits.filter((item) => item.space === space);
      check(plannedUnits.length === family.units.length, `${space}: planned Unit inventory differs from the app family`);
      for (const unit of plannedUnits) {
        check(
          unit.upstream === `${expectedUpstream}/${unit.slug}`,
          `${space}/${unit.slug}: planned Unit upstream ${unit.upstream ?? "missing"} differs from ${expectedUpstream}/${unit.slug}`,
        );
      }
    }
  }
}

function verifyLocalContract(inputs, { requireLiveEvidence }) {
  const alwaysRequired = Object.values(paths).filter((item) => !requiredApplyEvidence.includes(item));
  const required = requireLiveEvidence ? Object.values(paths) : alwaysRequired;
  const missing = required.filter((item) => !existsSync(absolute(item)));
  check(missing.length === 0, `missing required Kubara mini-IDP inputs:\n- ${missing.join("\n- ")}`);

  const config = readYaml(absolute(paths.config));
  check(config.version === "v1alpha4", "current Kubara config must be v1alpha4");
  check(config.bootstrapCatalog === `oci://ghcr.io/kubara-io/catalogs/bootstrap:${CATALOG_VERSION}`, "bootstrap catalog reference drifted");
  check(config.clusters?.length === FLEET.length, `expected ${FLEET.length} clusters in current config`);
  for (const item of FLEET) {
    const cluster = config.clusters.find((entry) => entry.name === item.cluster);
    check(cluster, `${item.cluster} is missing from current Kubara config`);
    check(cluster.stage === item.suffix.replace(/-.*$/, "") || (item.environment === "Prod" && cluster.stage === "prod"), `${item.cluster} stage drifted`);
    check(cluster.catalogs?.includes(`oci://ghcr.io/kubara-io/catalogs/general:${CATALOG_VERSION}`), `${item.cluster} general catalog reference drifted`);
  }
  const hub = config.clusters.find((entry) => entry.type === "hub");
  check(hub?.name === DEV.cluster, "hx-app-dev must remain the Kubara hub");
  check(config.clusters.filter((entry) => entry.type === "spoke").length === 3, "current Kubara config must retain three spokes");

  const appSetTemplate = readFileSync(absolute(paths.argoAppSetTemplate), "utf8");
  check(
    appSetTemplate.includes("namespace: {{ default $app.name $app.namespace }}"),
    "Kubara ApplicationSet destination namespace default drifted",
  );
  const kubaraApps = readYaml(absolute(paths.argoValues))
    .bootstrapValues?.applicationSets?.["hx-app-dev-dev"]?.apps ?? {};
  for (const item of SURFACES) {
    const kubaraApp = kubaraApps[item.kubaraService];
    check(kubaraApp?.name, `${item.prefix}: Kubara service ${item.kubaraService} is missing from generated Argo values`);
    const kubaraNamespace = kubaraApp.namespace ?? kubaraApp.name;
    check(
      item.destinationNamespace === kubaraNamespace,
      `${item.prefix}: destination namespace ${item.destinationNamespace} does not match Kubara's ${kubaraNamespace}`,
    );
  }

  const artifacts = readYaml(absolute(paths.componentArtifacts));
  check(artifacts.spec?.exactVersionPolicy === "fail-if-missing", "component artifact policy must fail if an exact version is missing");
  check(artifacts.spec?.retentionPolicy === "additive-only", "component artifact retention must remain additive-only");
  const actualVersions = new Map();
  for (const item of artifacts.spec?.artifacts ?? []) {
    const name = item.canonicalIdentity.endsWith("prometheus-blackbox-exporter")
      ? "prometheus-blackbox-exporter"
      : item.service;
    actualVersions.set(name, String(item.version));
    check(/^[0-9a-f]{64}$/.test(String(item.sha256 ?? "")), `${item.canonicalIdentity} exact SHA is missing`);
  }
  for (const item of artifacts.spec?.firstParty ?? []) actualVersions.set(item.service, String(item.wrapperVersion));
  for (const [name, version] of Object.entries(EXPECTED_VERSIONS)) {
    check(actualVersions.get(name) === version, `${name} must remain selected at ${version}`);
  }

  const fullCatalogCoverage = readYaml(absolute(paths.catalogFullCoverageReceipt));
  check(
    fullCatalogCoverage.kind === "KubaraCatalogFullCoverageReceipt"
      && fullCatalogCoverage.spec?.finalCatalog?.componentCount === 103
      && fullCatalogCoverage.spec?.finalCatalog?.versionCount === 130
      && fullCatalogCoverage.spec?.selections?.length === 18
      && fullCatalogCoverage.status?.result === "pass"
      && fullCatalogCoverage.status?.oldRootsByteIdentical === true,
    "full Kubara catalogs 1.1.0 component coverage must remain a passing additive 103-component/130-version receipt",
  );

  const generation = readYaml(absolute(paths.generationReceipt));
  check(
    generation.status?.result === "offline-generation-and-render-pass"
      && generation.status?.kubaraGeneration === "pass"
      && generation.status?.catalogParity === "pass",
    "current Kubara generation receipt is not an offline generation/parity pass",
  );
  check(generation.spec?.tools?.kubaraVersion === KUBARA_VERSION, "generation receipt Kubara version drifted");
  check(generation.spec?.platform?.renderCount === 13, "generation receipt must retain 13 effective renders");

  const adapter = readYaml(absolute(paths.adapterReceipt));
  check(
    adapter.kind === "KubaraCatalogAdapterReceipt"
      && adapter.spec?.invariants?.sourceMutation === false
      && adapter.spec?.invariants?.aiRequired === false
      && adapter.spec?.invariants?.currentCatalogExportsAreFullBootstrapAndGeneralTrees === true,
    "catalog adapter receipt invariants are not satisfied",
  );
  const desiredMatrix = JSON.parse(readFileSync(absolute(paths.desiredMatrix), "utf8"));
  check(
    desiredMatrix.kind === "KubaraPlatformMatrix"
      && desiredMatrix.metadata?.name === "kubara-v0.13.0-current-four-cluster-desired"
      && desiredMatrix.spec?.profile?.evidenceLayer === "desired-only"
      && desiredMatrix.spec?.evidence?.kubaraVersion === KUBARA_VERSION
      && desiredMatrix.spec?.evidence?.catalogVersion === CATALOG_VERSION
      && desiredMatrix.spec?.evidence?.parsedObservationCells === 0
      && desiredMatrix.spec?.components?.length === 9
      && desiredMatrix.spec?.clusters?.length === FLEET.length
      && desiredMatrix.spec?.rows?.length === FLEET.length * 9
      && desiredMatrix.spec.rows.every(
        (row) => row.syncState === "Unknown" && row.observedVersion === "Unknown",
      ),
    "desired platform matrix must remain the 9×4 Kubara v0.13.0 desired-only contract with zero live observations",
  );
  const wiring = JSON.parse(readFileSync(absolute(paths.wiring), "utf8"));
  check(wiring.spec?.evidence?.kubaraVersion === KUBARA_VERSION, "primary wiring ledger is not current Kubara v0.13.0 evidence");

  check(
    !existsSync(absolute(FAITHFUL_FAILURE_PATH)),
    `${FAITHFUL_FAILURE_PATH} records a newer failed proof attempt; refusing stale faithful pass evidence`,
  );
  check(
    !existsSync(absolute(FAITHFUL_ATTEMPT_PATH)),
    `${FAITHFUL_ATTEMPT_PATH} records an active proof attempt; refusing stale faithful pass evidence`,
  );
  if (existsSync(absolute(paths.faithfulReceipt))) verifyFaithfulProof();

  if (requireLiveEvidence) {
    const qualification = readYaml(absolute(paths.qualificationReceipt));
    check(qualification.kind === "KubaraLiveQualificationSetReceipt", "current qualification receipt kind drifted");
    check(qualification.spec?.laneCount === 13 && qualification.status?.result === "pass", "all 13 current qualification lanes must pass");
    const promotion = readYaml(absolute(paths.promotionReceipt));
    check(promotion.kind === "KubaraCatalogRootPromotionReceipt", "current promotion receipt kind drifted");
    check(promotion.status?.result === "pass" && promotion.status?.historicalRootsPreserved === true, "current promotion must pass and retain historical roots");
    const faithful = verifyFaithfulProof();
    check(faithful.kind === "KubaraFaithfulHubSpokeProofReceipt", "faithful lane receipt kind drifted");
    check(faithful.status?.result === "pass", "faithful hub-spoke lane must pass before adapted fleet apply");
  }

  const appDocs = APP_FAMILIES.flatMap((family) => family.units.flatMap((unit) => unit.source.flatMap((source) => parseDocs(readFileSync(absolute(source), "utf8")))));
  for (const family of APP_FAMILIES) {
    const docs = family.units.flatMap((unit) => unit.source.flatMap((source) => parseDocs(readFileSync(absolute(source), "utf8"))));
    const namespaced = docs.filter((doc) => doc.metadata?.namespace);
    check(namespaced.length > 0, `${family.prefix}: application fixture has no namespaced objects`);
    check(
      namespaced.every((doc) => doc.metadata.namespace === family.destinationNamespace),
      `${family.prefix}: application fixture namespace does not match ${family.destinationNamespace}`,
    );
  }
  const images = appDocs.flatMap(imagesInDocument);
  check(images.length >= 4, "current app fixtures should expose four pinned workload images");
  for (const image of images) check(image.includes("@sha256:"), `app image is not digest pinned: ${image}`);

  verifyKindTraefikRenderedContracts();
  verifyHxWebPayloadContract(inputs);
}

function verifyKindTraefikRenderedContracts() {
  for (const contract of KIND_TRAEFIK_CONTRACTS) {
    const renderPath = absolute(
      `examples/kubara/current-platform/effective-renders/${contract.cluster}/traefik/release-objects.yaml`,
    );
    check(existsSync(renderPath), `${contract.cluster}: Traefik effective render is missing`);
    assertKindTraefikRenderedObjects(
      contract,
      parseDocs(readFileSync(renderPath, "utf8")),
    );
  }
}

function verifyFaithfulProof() {
  check(
    !existsSync(absolute(FAITHFUL_FAILURE_PATH)),
    `${FAITHFUL_FAILURE_PATH} records a newer failed proof attempt; refusing stale faithful pass evidence`,
  );
  check(
    !existsSync(absolute(FAITHFUL_ATTEMPT_PATH)),
    `${FAITHFUL_ATTEMPT_PATH} records an active proof attempt; refusing stale faithful pass evidence`,
  );
  if (cachedFaithfulReceipt) return cachedFaithfulReceipt;
  const result = tryCommand(process.execPath, [absolute(FAITHFUL_PROOF_SCRIPT), "--verify"]);
  check(result.ok, `full faithful hub-spoke verifier failed:\n${result.output}`);
  const faithful = readYaml(absolute(paths.faithfulReceipt));
  check(faithful.kind === "KubaraFaithfulHubSpokeProofReceipt", "faithful lane receipt kind drifted");
  check(faithful.status?.result === "pass", "faithful hub-spoke lane must pass before adapted fleet apply");
  cachedFaithfulReceipt = faithful;
  return faithful;
}

function verifyHxWebPayloadContract(inputs) {
  const deployment = (key) => parseDocs(inputs.payloads.get(key)?.value ?? "")
    .find((doc) => doc.kind === "Deployment" && doc.metadata?.name === "hx-web");
  const containerEnv = (doc) => doc?.spec?.template?.spec?.containers?.[0]?.env ?? [];
  const hasSandbox = (doc) => containerEnv(doc).some(
    (entry) => entry.name === "SANDBOX_URL" && entry.value === "http://sandbox.hx-web.svc:8080",
  );

  const base = deployment("hx-web/base/hx-web-deployment/v2");
  const dev = deployment("hx-web/dev/hx-web-deployment/final");
  const staging = deployment("hx-web/staging/hx-web-deployment/final");
  const prodA = deployment("hx-web/prod-a/hx-web-deployment/final");
  const prodB = deployment("hx-web/prod-b/hx-web-deployment/final");
  check([base, dev, staging, prodA, prodB].every(Boolean), "hx-web rollout payload set is incomplete");
  check(base.spec?.replicas === 3 && base.metadata?.annotations?.["platform.confighub.com/promotion"] === "promotion-v2", "hx-web base must end at promotion-v2 with three replicas");
  check(dev.spec?.replicas === 3 && dev.metadata?.annotations?.["platform.confighub.com/promotion"] === "promotion-v2" && !hasSandbox(dev), "hx-web dev final payload drifted");
  check(staging.spec?.replicas === 3 && staging.metadata?.annotations?.["platform.confighub.com/promotion"] === "promotion-v2" && hasSandbox(staging), "hx-web staging must retain only its SANDBOX_URL departure through promotion-v2");
  check(prodA.spec?.replicas === 2 && !prodA.metadata?.annotations?.["platform.confighub.com/revision"] && !hasSandbox(prodA), "hx-web prod-a must retain the one-target rollback without staging's departure");
  check(prodB.spec?.replicas === 3 && prodB.metadata?.annotations?.["platform.confighub.com/revision"] === "promotion-v1" && !prodB.metadata?.annotations?.["platform.confighub.com/promotion"] && !hasSandbox(prodB), "hx-web prod-b must remain on promotion-v1 without staging's departure");
}

function imagesInDocument(doc) {
  const podSpec = doc.kind === "Deployment" || doc.kind === "StatefulSet"
    ? doc.spec?.template?.spec
    : null;
  return [...(podSpec?.initContainers ?? []), ...(podSpec?.containers ?? [])]
    .map((container) => container.image)
    .filter(Boolean);
}

const inputs = materializeInputs();
const plan = buildPlan(inputs);

if (mode === "--plan") {
  printPlan(inputs, plan);
} else if (mode === "--apply") {
  verifyLocalContract(inputs, { requireLiveEvidence: true });
  applyPlan(inputs, plan);
} else if (mode === "--verify") {
  verifyLocalContract(inputs, { requireLiveEvidence: true });
  const observation = verifyLive(inputs, plan);
  console.log(`verified Kubara mini-IDP: ${observation.spaces.length} Spaces, ${observation.units.length} managed Units, ${observation.links.length} NeedsProvides Links`);
} else if (mode === "--receipt-verify") {
  verifyReceipt(inputs, plan);
} else {
  selfTestProtectedNamespaceOwnership();
  selfTestKindTraefikContract();
  selfTestPerformanceInstrumentation();
  selfTestReleaseRecovery();
  selfTestArgoConvergence();
  selfTestScenarioOperationEvidence();
  selfTestReceiptLinkEvidence(plan);
}

function printPlan(inputs, desired) {
  const missingApplyEvidence = requiredApplyEvidence.filter((item) => !existsSync(absolute(item)));
  const payloadRows = [...inputs.payloads.values()].map((item) => ({
    key: item.key,
    sha256: item.sha256,
    objectCount: item.objectCount,
    toolchain: item.toolchain,
    sourcePaths: item.sourcePaths,
    transform: item.transform,
  })).sort((left, right) => left.key.localeCompare(right.key));
  console.log(JSON.stringify({
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubaraMiniIDPReconcilePlan",
    metadata: { name: "kubara-v0-13-0-confighub-mini-idp" },
    spec: {
      organization: ORGANIZATION,
      execution: {
        organizationExternalID: ORGANIZATION_EXTERNAL_ID,
        organizationEntityID: ORGANIZATION_ENTITY_ID,
        serverURL: CONFIGHUB_SERVER_URL,
        deterministic: true,
        aiRequired: false,
        mutationGuardConsulted: false,
        destructiveOperations: [ARGO_PRUNE_POLICY, ARGO_NAMESPACE_MOVE_POLICY],
        persistentClustersPreserved: FLEET.map((item) => item.cluster),
        partialClusterStatePolicy: "fail-except-exact-journaled-prefix",
        serialLiveParityLock: true,
        unexpectedSpacePolicy: "fail-outside-exact-55-space-allowlist",
        unexpectedManagedUnitOrLinkPolicy: "fail",
        preservedControlUnitPolicy: "exact-receipt-bound-faithful-proof-units",
        argoApplicationContract: "allowlisted ConfigHub OCI source -> cluster-local API + Kubara destination namespace",
        argoRetryPolicy: ARGO_RETRY_POLICY,
        argoPrunePolicy: ARGO_PRUNE_POLICY,
        argoNamespaceMovePolicy: ARGO_NAMESPACE_MOVE_POLICY,
        protectedNamespaceOwnershipPolicy: PROTECTED_NAMESPACE_OWNERSHIP_POLICY,
        kindTraefikPolicy: KIND_TRAEFIK_POLICY,
        argoRevisionPolicy: ARGO_REVISION_POLICY,
        guiIdentityPolicy: GUI_IDENTITY_POLICY,
        interruptedScenarioPolicy: INTERRUPTED_SCENARIO_POLICY,
        interruptedReleasePolicy: INTERRUPTED_RELEASE_POLICY,
        publishedReleaseSelectionPolicy: PUBLISHED_RELEASE_SELECTION_POLICY,
        deliveryRootPublicationPolicy: DELIVERY_ROOT_PUBLICATION_POLICY,
        receiptRequiresZeroActionRerun: true,
        minimumCubVersion: `v${MIN_CUB_VERSION}`,
      },
      source: {
        kubaraVersion: KUBARA_VERSION,
        catalogVersion: CATALOG_VERSION,
        config: paths.config,
        componentArtifacts: paths.componentArtifacts,
        missingApplyEvidence,
      },
      counts: {
        spaces: desired.spaces.length,
        managedUnits: desired.managedUnits.length,
        preservedFaithfulControlUnits: PRESERVED_FAITHFUL_CONTROL_UNITS.length,
        deployments: desired.deployments.length,
        deliveryApplicationUnits: desired.deployments.length + (FLEET.length * 2),
        protectedNamespaceOwnershipDetachments: PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS.length,
        kindTraefikContracts: KIND_TRAEFIK_CONTRACTS.length,
        needsProvidesLinks: desired.links.length,
        payloads: payloadRows.length,
      },
      phases: [
        "preflight exact sources and live qualification receipts",
        "create or validate four persistent ConfigHub-owned Argo targets",
        "reconcile current contract, catalog, matrix, wiring, and lane evidence",
        "deliver lifecycle CRDs and platform prerequisites in dependency order",
        "retain protected default Namespaces while detaching only declared obsolete ownership metadata",
        "deliver the complete current Kubara component selection",
        "exercise hx-web promotion, prod approval, rollback, and staging departure",
        "deliver cubbychat and hx-web across all four clusters",
        "create visible NeedsProvides wiring Links",
        "verify ConfigHub state, Argo sync, workloads, and write the receipt",
        "rerun to prove zero-drift idempotence",
      ],
      spaces: desired.spaces,
      units: desired.managedUnits,
      preservedControlUnits: PRESERVED_FAITHFUL_CONTROL_UNITS.map((item) => ({
        ref: `${CONTROL_SPACE}/${item.slug}`,
        owner: "faithful-hub-spoke-proof",
        policy: "preserve-and-verify-against-current-pass-receipt",
      })),
      deployments: desired.deployments,
      protectedNamespaceOwnershipDetachments: PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS,
      deliveryApplicationUnits: plannedDeliveryApplicationIdentity(desired),
      links: desired.links,
      payloads: payloadRows,
    },
    status: {
      readyForApply: missingApplyEvidence.length === 0,
      missingApplyEvidence,
    },
  }, null, 2));
}

function command(binary, args, options = {}) {
  const verb = sanitizedCommandVerb(binary, args);
  const startedAt = performance.now();
  let failed = false;
  try {
    return execFileSync(binary, args, {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, CONFIGHUB_AGENT: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 200,
      timeout: options.timeout ?? 600_000,
      ...options,
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    recordCommandPerformance(verb, performance.now() - startedAt, failed);
  }
}

function sanitizedCommandVerb(binary, args) {
  const executable = basename(binary) === basename(process.execPath) ? "node" : safeMetricToken(basename(binary));
  if (executable === "cub") {
    let index = 0;
    while (index < args.length && args[index].startsWith("--")) {
      index += args[index] === "--context" || args[index] === "--space" ? 2 : 1;
    }
    const resource = safeMetricToken(args[index] ?? "command");
    const candidateVerb = args[index + 1];
    const action = candidateVerb && !candidateVerb.startsWith("-")
      ? safeMetricToken(candidateVerb)
      : "command";
    return action === "command" ? `cub.${resource}` : `cub.${resource}.${action}`;
  }
  if (executable === "kubectl") {
    const action = args.find((arg) => [
      "annotate", "delete", "get", "patch", "rollout", "wait",
    ].includes(arg));
    return `kubectl.${safeMetricToken(action ?? "command")}`;
  }
  if (executable === "kind") {
    return `kind.${safeMetricToken(args[0] ?? "command")}.${safeMetricToken(args[1] ?? "command")}`;
  }
  if (executable === "node") {
    const action = args.find((arg) => /^--[a-z0-9-]+$/i.test(arg));
    return `node.${safeMetricToken(action?.replace(/^--/, "") ?? "execute")}`;
  }
  if (executable === "pgrep") return "pgrep.scan";
  if (executable === "sleep") return "sleep.wait";
  return `${executable}.execute`;
}

function safeMetricToken(value) {
  const token = String(value ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return token || "command";
}

function recordCommandPerformance(verb, elapsedMs, failed) {
  const current = commandPerformance.get(verb) ?? {
    verb,
    calls: 0,
    failures: 0,
    totalMs: 0,
    maxMs: 0,
  };
  current.calls += 1;
  current.failures += failed ? 1 : 0;
  current.totalMs += elapsedMs;
  current.maxMs = Math.max(current.maxMs, elapsedMs);
  commandPerformance.set(verb, current);
}

function performanceEvidence(scope, bulkSnapshots = activeVerificationReadSnapshot?.evidence ?? null) {
  const byVerb = [...commandPerformance.values()]
    .sort((left, right) => left.verb.localeCompare(right.verb))
    .map((item) => ({
      verb: item.verb,
      calls: item.calls,
      failures: item.failures,
      totalMs: roundedMilliseconds(item.totalMs),
      maxMs: roundedMilliseconds(item.maxMs),
    }));
  return {
    schemaVersion: 1,
    scope,
    wallElapsedMs: roundedMilliseconds(performance.now() - PROCESS_STARTED_AT_MS),
    commands: {
      executionPolicy: "serial",
      calls: byVerb.reduce((sum, item) => sum + item.calls, 0),
      failures: byVerb.reduce((sum, item) => sum + item.failures, 0),
      totalMs: roundedMilliseconds(byVerb.reduce((sum, item) => sum + item.totalMs, 0)),
      byVerb,
    },
    canonicalYaml: {
      requests: canonicalYamlPerformance.requests,
      cacheHits: canonicalYamlPerformance.hits,
      cacheMisses: canonicalYamlPerformance.misses,
      cacheEntries: canonicalYamlCache.size,
      parseMs: roundedMilliseconds(canonicalYamlPerformance.parseMs),
    },
    bulkSnapshots: bulkSnapshots ?? {
      mode: "disabled-outside-read-only-verification",
      stability: "not-applicable",
      resources: [],
    },
  };
}

function roundedMilliseconds(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function performanceCheckpoint() {
  return {
    wallStartedAtMs: performance.now(),
    commands: new Map([...commandPerformance.entries()].map(([verb, item]) => [verb, {
      calls: item.calls,
      failures: item.failures,
      totalMs: item.totalMs,
    }])),
  };
}

function performancePhaseEvidence(name, checkpoint) {
  const byVerb = [];
  for (const [verb, current] of [...commandPerformance.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const prior = checkpoint.commands.get(verb) ?? { calls: 0, failures: 0, totalMs: 0 };
    const calls = current.calls - prior.calls;
    if (calls === 0) continue;
    byVerb.push({
      verb,
      calls,
      failures: current.failures - prior.failures,
      totalMs: roundedMilliseconds(current.totalMs - prior.totalMs),
    });
  }
  return {
    name,
    wallElapsedMs: roundedMilliseconds(performance.now() - checkpoint.wallStartedAtMs),
    commands: {
      executionPolicy: "serial",
      calls: byVerb.reduce((sum, item) => sum + item.calls, 0),
      failures: byVerb.reduce((sum, item) => sum + item.failures, 0),
      totalMs: roundedMilliseconds(byVerb.reduce((sum, item) => sum + item.totalMs, 0)),
      byVerb,
    },
  };
}

function assertPerformancePhaseEvidence(phase, prefix) {
  check(phase?.name === "apply-start-to-first-argo-convergence", `${prefix} name drifted`);
  check(Number.isFinite(phase.wallElapsedMs) && phase.wallElapsedMs >= 0, `${prefix} wall time is invalid`);
  check(phase.commands?.executionPolicy === "serial", `${prefix} command policy drifted`);
  const rows = phase.commands?.byVerb ?? [];
  check(Array.isArray(rows), `${prefix} command rows are invalid`);
  check(stableJson(rows.map((item) => item.verb)) === stableJson(rows.map((item) => item.verb).sort()), `${prefix} command rows are not sorted`);
  check(new Set(rows.map((item) => item.verb)).size === rows.length, `${prefix} command rows are duplicated`);
  for (const item of rows) {
    check(/^[a-z0-9-]+(?:\.[a-z0-9-]+){1,2}$/.test(item.verb ?? ""), `${prefix} contains a non-sanitized command verb`);
    check(Number.isInteger(item.calls) && item.calls > 0, `${prefix} ${item.verb} calls are invalid`);
    check(Number.isInteger(item.failures) && item.failures >= 0 && item.failures <= item.calls, `${prefix} ${item.verb} failures are invalid`);
    check(Number.isFinite(item.totalMs) && item.totalMs >= 0, `${prefix} ${item.verb} time is invalid`);
  }
  check(phase.commands.calls === rows.reduce((sum, item) => sum + item.calls, 0), `${prefix} call total is inconsistent`);
  check(phase.commands.failures === rows.reduce((sum, item) => sum + item.failures, 0), `${prefix} failure total is inconsistent`);
}

function assertPerformanceEvidence(evidence, prefix = "performance evidence") {
  check(evidence?.schemaVersion === 1, `${prefix} schema version drifted`);
  check(typeof evidence.scope === "string" && evidence.scope.length > 0, `${prefix} scope is missing`);
  check(Number.isFinite(evidence.wallElapsedMs) && evidence.wallElapsedMs >= 0, `${prefix} wall time is invalid`);
  check(evidence.commands?.executionPolicy === "serial", `${prefix} command execution is not serial`);
  const verbs = evidence.commands?.byVerb ?? [];
  check(Array.isArray(verbs), `${prefix} command verb rows are invalid`);
  check(
    verbs.every((item) => /^[a-z0-9-]+(?:\.[a-z0-9-]+){1,2}$/.test(item.verb ?? "")),
    `${prefix} contains a non-sanitized command verb`,
  );
  check(
    stableJson(verbs.map((item) => item.verb)) === stableJson(verbs.map((item) => item.verb).sort()),
    `${prefix} command verbs are not deterministic`,
  );
  check(new Set(verbs.map((item) => item.verb)).size === verbs.length, `${prefix} command verbs are duplicated`);
  check(
    evidence.commands.calls === verbs.reduce((sum, item) => sum + item.calls, 0),
    `${prefix} command call total is inconsistent`,
  );
  check(
    evidence.commands.failures === verbs.reduce((sum, item) => sum + item.failures, 0),
    `${prefix} command failure total is inconsistent`,
  );
  for (const item of verbs) {
    check(Number.isInteger(item.calls) && item.calls > 0, `${prefix} ${item.verb} call count is invalid`);
    check(Number.isInteger(item.failures) && item.failures >= 0 && item.failures <= item.calls, `${prefix} ${item.verb} failure count is invalid`);
    check(Number.isFinite(item.totalMs) && item.totalMs >= 0, `${prefix} ${item.verb} total time is invalid`);
    check(Number.isFinite(item.maxMs) && item.maxMs >= 0 && item.maxMs <= item.totalMs + 0.001, `${prefix} ${item.verb} max time is invalid`);
  }
  const yaml = evidence.canonicalYaml ?? {};
  check(Number.isInteger(yaml.requests) && yaml.requests >= 0, `${prefix} canonical YAML request count is invalid`);
  check(yaml.cacheHits + yaml.cacheMisses === yaml.requests, `${prefix} canonical YAML cache accounting is inconsistent`);
  check(Number.isInteger(yaml.cacheEntries) && yaml.cacheEntries === yaml.cacheMisses, `${prefix} canonical YAML entry count is inconsistent`);
  check(Number.isFinite(yaml.parseMs) && yaml.parseMs >= 0, `${prefix} canonical YAML parse time is invalid`);
  const bulk = evidence.bulkSnapshots ?? {};
  check(bulk.mode === "bracketed-organization-wide-read-only", `${prefix} bulk snapshot mode drifted`);
  check(bulk.stability === "pass", `${prefix} bulk snapshot stability did not pass`);
  check(
    stableJson((bulk.resources ?? []).map((item) => item.resource).sort()) === stableJson(["link", "release", "target", "unit"]),
    `${prefix} bulk snapshot resource coverage drifted`,
  );
  for (const item of bulk.resources) {
    check(Number.isInteger(item.rows) && item.rows >= 0, `${prefix} ${item.resource} row count is invalid`);
    check(item.listCalls === 2, `${prefix} ${item.resource} must use one initial and one final list call`);
    check(Number.isInteger(item.servedReads) && item.servedReads >= 0, `${prefix} ${item.resource} served-read count is invalid`);
  }
  const phases = evidence.phases ?? [];
  check(Array.isArray(phases) && phases.length <= 1, `${prefix} phase evidence is invalid`);
  for (const phase of phases) assertPerformancePhaseEvidence(phase, `${prefix} pre-Argo phase`);
}

function selfTestPerformanceInstrumentation() {
  const requestCount = canonicalYamlPerformance.requests;
  const hitCount = canonicalYamlPerformance.hits;
  const missCount = canonicalYamlPerformance.misses;
  const fixture = "performance-self-test: true\nitems:\n  - one\n  - two\n";
  const first = canonicalYamlDocument(fixture);
  const second = canonicalYamlDocument(fixture);
  check(first === second, "performance self-test: canonical YAML cache changed its value");
  check(canonicalYamlPerformance.requests === requestCount + 2, "performance self-test: canonical request accounting drifted");
  check(canonicalYamlPerformance.hits === hitCount + 1, "performance self-test: canonical cache did not record one hit");
  check(canonicalYamlPerformance.misses === missCount + 1, "performance self-test: canonical cache did not record one miss");
  const left = snapshotRows([
    { SpaceID: "space-b", UnitID: "unit-b", Slug: "b" },
    { SpaceID: "space-a", UnitID: "unit-a", Slug: "a" },
  ], ["SpaceID", "UnitID", "Slug"]);
  const right = snapshotRows([
    { SpaceID: "space-a", UnitID: "unit-a", Slug: "a" },
    { SpaceID: "space-b", UnitID: "unit-b", Slug: "b" },
  ], ["SpaceID", "UnitID", "Slug"]);
  check(stableJson(left) === stableJson(right), "performance self-test: snapshot canonicalization depends on row order");
  const resources = ["link", "release", "target", "unit"].map((resource) => ({
    resource,
    rows: 1,
    listCalls: 2,
    servedReads: 1,
  }));
  assertPerformanceEvidence({
    schemaVersion: 1,
    scope: "self-test",
    wallElapsedMs: 1,
    commands: { executionPolicy: "serial", calls: 0, failures: 0, totalMs: 0, byVerb: [] },
    canonicalYaml: { requests: 1, cacheHits: 0, cacheMisses: 1, cacheEntries: 1, parseMs: 0 },
    bulkSnapshots: {
      mode: "bracketed-organization-wide-read-only",
      stability: "pass",
      resources,
    },
    phases: [{
      name: "apply-start-to-first-argo-convergence",
      wallElapsedMs: 1,
      commands: { executionPolicy: "serial", calls: 0, failures: 0, totalMs: 0, byVerb: [] },
    }],
  }, "performance self-test evidence");
  console.log("Kubara mini-IDP performance instrumentation self-test passed");
}

function tryCommand(binary, args, options = {}) {
  try {
    return { ok: true, output: command(binary, args, options), status: 0 };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
      status: Number.isInteger(error.status) ? error.status : 1,
    };
  }
}

function cub(args, options = {}) {
  revalidatePinnedCubContextBeforeMutation(args);
  return command("cub", [...contextArgs, ...args], options);
}

function cubTry(args, options = {}) {
  revalidatePinnedCubContextBeforeMutation(args);
  return tryCommand("cub", [...contextArgs, ...args], options);
}

function cubJson(args) {
  return JSON.parse(cub([...args, "-o", "json"]));
}

function unwrapEntity(value, key) {
  return value?.[key] ?? value;
}

function unwrapRows(value, key) {
  const list = value?.[`${key}s`] ?? value?.[key.toLowerCase() + "s"] ?? value;
  check(Array.isArray(list), `cub ${key} list returned an unexpected shape`);
  return list.map((row) => row?.[key] ?? row);
}

function parseCubContext(text) {
  return {
    name: text.match(/^Context Name\s+(\S+)\s*$/mi)?.[1] ?? "",
    organizationExternalID: text.match(/^Organization ID\s+([0-9a-f-]+)\s*$/mi)?.[1] ?? "",
    organizationName: text.match(/^Organization Name\s+(.+?)\s*$/mi)?.[1] ?? "",
    serverURL: text.match(/^Server URL\s+(\S+)\s*$/mi)?.[1]?.replace(/\/$/, "") ?? "",
  };
}

function rawPinnedCub(args, options = {}) {
  return command("cub", [...contextArgs, ...args], options);
}

function assertPinnedKubaraTarget() {
  check(pinnedContextName, "cub context name was not pinned before live access");
  const coordinate = parseCubContext(rawPinnedCub(["context", "get"]));
  check(coordinate.name === pinnedContextName, `cub context name drifted from ${pinnedContextName} to ${coordinate.name || "unknown"}`);
  check(coordinate.organizationName === ORGANIZATION, `refusing cub organization ${coordinate.organizationName || "unknown"}; expected ${ORGANIZATION}`);
  check(
    coordinate.organizationExternalID === ORGANIZATION_EXTERNAL_ID,
    `refusing ConfigHub external organization ID ${coordinate.organizationExternalID || "unknown"}; expected ${ORGANIZATION_EXTERNAL_ID}`,
  );
  check(coordinate.serverURL === CONFIGHUB_SERVER_URL, `refusing ConfigHub server ${coordinate.serverURL || "unknown"}; expected ${CONFIGHUB_SERVER_URL}`);
  const organizations = JSON.parse(rawPinnedCub([
    "organization", "list",
    "--where", `ExternalID = '${ORGANIZATION_EXTERNAL_ID}'`,
    "--select", "DisplayName,ExternalID,OrganizationID",
    "-o", "json",
  ]));
  check(Array.isArray(organizations) && organizations.length === 1, `expected exactly one ${ORGANIZATION} Organization entity`);
  const organization = organizations[0]?.Organization ?? organizations[0];
  check(organization.DisplayName === ORGANIZATION, "ConfigHub Organization display name drifted");
  check(organization.ExternalID === ORGANIZATION_EXTERNAL_ID, "ConfigHub Organization external ID drifted");
  check(organization.OrganizationID === ORGANIZATION_ENTITY_ID, "ConfigHub Organization entity ID drifted");
  const control = tryCommand("cub", [...contextArgs, "space", "get", CONTROL_SPACE, "-o", "json"]);
  if (control.ok) {
    const space = unwrapEntity(JSON.parse(control.output), "Space");
    check(space.OrganizationID === ORGANIZATION_ENTITY_ID, `${CONTROL_SPACE}: organization entity ID drifted`);
  } else {
    check(/\b404\b|not[\s_-]*found/i.test(control.output), `${CONTROL_SPACE}: failed to verify organization ownership: ${control.output}`);
  }
  return coordinate;
}

function mutatingCubCommand(args) {
  const [resource, verb] = args;
  const pair = `${resource}/${verb ?? ""}`;
  const mutations = new Set([
    "cluster/up",
    "filter/create", "filter/update",
    "link/create", "link/update",
    "release/publish",
    "space/create", "space/update",
    "trigger/create", "trigger/update",
    "unit/approve", "unit/create", "unit/set-target", "unit/update",
    "variant/create", "variant/promote",
  ]);
  const reads = new Set([
    "filter/get",
    "link/list",
    "release/list",
    "space/get", "space/list",
    "target/get", "target/list",
    "trigger/get",
    "unit/data", "unit/get", "unit/list",
    "version/",
  ]);
  check(mutations.has(pair) || reads.has(pair), `unclassified cub command ${pair}; classify it before live use`);
  return mutations.has(pair);
}

function revalidatePinnedCubContextBeforeMutation(args) {
  if (mutatingCubCommand(args)) assertPinnedKubaraTarget();
}

function assertKubaraOrganization() {
  const initialArgs = pinnedContextName ? ["--context", pinnedContextName] : [];
  const initialText = command("cub", [...initialArgs, "context", "get"]);
  const initial = parseCubContext(initialText);
  check(initial.name, "active cub context name is unavailable");
  if (pinnedContextName) check(initial.name === pinnedContextName, `requested cub context ${pinnedContextName} resolved as ${initial.name}`);
  pinnedContextName = initial.name;
  contextArgs = ["--context", pinnedContextName];
  assertPinnedKubaraTarget();
  assertCubVersion();
  const json = tryCommand("cub", [...contextArgs, "context", "get", "-o", "json"]);
  if (json.ok) {
    const value = JSON.parse(json.output);
    const name = value.metadata?.organizationName
      ?? value.OrganizationName
      ?? value.organizationName;
    check(name === ORGANIZATION, `refusing to run in organization ${name ?? "unknown"}; expected ${ORGANIZATION}`);
  }
}

function assertCubVersion() {
  if (cachedCubVersions) return cachedCubVersions;
  const output = cub(["version"]);
  const client = output.match(/Client Version:[\s\S]*?Version:\s+v([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ?? "";
  const server = output.match(/Server Version:[\s\S]*?Version:\s+v([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ?? "";
  check(client && versionAtLeast(client, MIN_CUB_VERSION), `cub client v${client || "unknown"} is older than required v${MIN_CUB_VERSION}`);
  check(server && versionAtLeast(server, MIN_CUB_VERSION), `ConfigHub server v${server || "unknown"} is older than required v${MIN_CUB_VERSION}`);
  cachedCubVersions = { client: `v${client}`, server: `v${server}`, minimum: `v${MIN_CUB_VERSION}` };
  return cachedCubVersions;
}

function versionAtLeast(actual, minimum) {
  if (!/^\d+\.\d+\.\d+$/.test(actual) || !/^\d+\.\d+\.\d+$/.test(minimum)) return false;
  const left = actual.split(".").map(Number);
  const right = minimum.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return true;
}

function assertSerialLiveLock() {
  for (const pattern of [
    "scripts/run-kubara-live-qualification.mjs",
    "tests/live-helm-confighub-parity-test",
    "scripts/run-kubara-faithful-hub-spoke-proof.mjs",
  ]) {
    const processes = tryCommand("pgrep", ["-fl", pattern]);
    check(!processes.ok || !processes.output.trim(), `refusing to overlap a live Kubara proof (${pattern}):\n${processes.output}`);
  }
  const leaked = kindClusters().filter((name) => name.startsWith("helm-expt-parity-"));
  check(leaked.length === 0, `refusing to start with live-parity clusters present: ${leaked.join(", ")}`);
}

function acquireSerialLiveLock() {
  const lockPath = process.env.HELM_EXPT_LIVE_PARITY_LOCK
    ? resolve(process.env.HELM_EXPT_LIVE_PARITY_LOCK)
    : join(homedir(), ".confighub", "locks", "helm-expt-live-parity.lock");
  while (true) {
    try {
      mkdirSync(dirname(lockPath), { recursive: true });
      mkdirSync(lockPath);
      writeFileSync(join(lockPath, "owner.json"), `${JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
        command: process.argv.join(" "),
      }, null, 2)}\n`);
      return lockPath;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner = {};
      try {
        owner = JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8"));
      } catch {
        // An incomplete owner file is treated as live; never remove a lock
        // whose ownership cannot be proved stale.
      }
      if (Number.isInteger(owner.pid) && !processAlive(owner.pid)) {
        rmSync(lockPath, { recursive: true, force: true });
        continue;
      }
      check(false, `live parity lane is locked at ${lockPath}${owner.pid ? ` by pid ${owner.pid}` : ""}`);
    }
  }
}

function releaseSerialLiveLock(lockPath) {
  if (!lockPath) return;
  try {
    const owner = JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8"));
    if (owner.pid === process.pid) rmSync(lockPath, { recursive: true, force: true });
  } catch {
    // Never remove a lock whose ownership cannot be proved.
  }
}

function operationJournalHeader() {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubaraMiniIDPOperationJournal",
    organizationExternalID: ORGANIZATION_EXTERNAL_ID,
    organizationEntityID: ORGANIZATION_ENTITY_ID,
    serverURL: CONFIGHUB_SERVER_URL,
  };
}

function operationExecutionFingerprint() {
  const payloads = [...inputs.payloads.values()].map((item) => ({
    key: item.key,
    sha256: item.sha256,
  })).sort((left, right) => left.key.localeCompare(right.key));
  const executionContract = {
    reconcilerSha256: `sha256:${sha256File(absolute("scripts/reconcile-kubara-mini-idp.mjs"))}`,
    protectedNamespaceHelperSha256: `sha256:${sha256File(absolute("scripts/lib/kubara-protected-namespace.mjs"))}`,
    kindTraefikHelperSha256: `sha256:${sha256File(absolute("scripts/lib/kubara-kind-traefik.mjs"))}`,
    organization: {
      externalID: ORGANIZATION_EXTERNAL_ID,
      entityID: ORGANIZATION_ENTITY_ID,
      serverURL: CONFIGHUB_SERVER_URL,
    },
    fleet: FLEET.map((item) => ({ cluster: item.cluster, suffix: item.suffix })),
    deploymentOrder: plan.deployments.map((item) => ({
      cluster: item.cluster,
      space: item.space,
      appSpace: item.appSpace,
      appUnit: item.appUnit,
      order: item.order,
      destinationNamespace: item.destinationNamespace,
      protectedNamespaceOwnershipDetachment: item.protectedNamespaceOwnershipDetachment ?? null,
    })),
    protectedNamespaceOwnershipDetachments: PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS,
    policies: {
      argoPrune: ARGO_PRUNE_POLICY,
      namespaceMove: ARGO_NAMESPACE_MOVE_POLICY,
      protectedNamespaceOwnership: PROTECTED_NAMESPACE_OWNERSHIP_POLICY,
      kindTraefik: KIND_TRAEFIK_POLICY,
      retry: ARGO_RETRY_POLICY,
      revision: ARGO_REVISION_POLICY,
      interruptedRelease: INTERRUPTED_RELEASE_POLICY,
      interruptedScenario: INTERRUPTED_SCENARIO_POLICY,
      deliveryRootPublication: DELIVERY_ROOT_PUBLICATION_POLICY,
    },
  };
  return `sha256:${sha256(stableJson({ source: sourceEvidence(), payloads, executionContract }))}`;
}

function operationJournalFingerprintDisposition(journal, fingerprint) {
  if (journal.executionFingerprint === fingerprint) return "current";
  const convergenceInFlight = Object.keys(journal.convergence ?? {}).length > 0;
  const namespaceMoveInFlight = ["prepared", "delete-returned"].includes(journal.namespaceMove?.state);
  const protectedNamespaceDetachmentInFlight = Object.values(journal.protectedNamespaceDetachments ?? {})
    .some((item) => ["prepared", "patch-returned"].includes(item?.state));
  const scenarioInFlight = journal.scenario?.state === "started";
  const fleetBootstrapInFlight = journal.fleetBootstrap?.state === "started";
  return convergenceInFlight || namespaceMoveInFlight || protectedNamespaceDetachmentInFlight
    || scenarioInFlight || fleetBootstrapInFlight ? "blocked" : "rotate";
}

function readOperationJournal() {
  if (!existsSync(OPERATION_JOURNAL_PATH)) {
    return {
      ...operationJournalHeader(),
      executionFingerprint: operationExecutionFingerprint(),
      convergence: {},
      namespaceMove: null,
      protectedNamespaceDetachments: {},
      scenario: null,
      fleetBootstrap: null,
    };
  }
  let journal = null;
  try {
    journal = JSON.parse(readFileSync(OPERATION_JOURNAL_PATH, "utf8"));
  } catch (error) {
    check(false, `operation journal is unreadable at ${OPERATION_JOURNAL_PATH}: ${error.message}`);
  }
  const header = operationJournalHeader();
  for (const [key, value] of Object.entries(header)) {
    check(journal?.[key] === value, `operation journal ${key} drifted at ${OPERATION_JOURNAL_PATH}`);
  }
  check(journal.convergence && typeof journal.convergence === "object" && !Array.isArray(journal.convergence), "operation journal convergence map is invalid");
  if (journal.protectedNamespaceDetachments === undefined) journal.protectedNamespaceDetachments = {};
  check(
    journal.protectedNamespaceDetachments
      && typeof journal.protectedNamespaceDetachments === "object"
      && !Array.isArray(journal.protectedNamespaceDetachments),
    "operation journal protected Namespace detachment map is invalid",
  );
  if (journal.scenario === undefined) journal.scenario = null;
  check(journal.scenario === null || typeof journal.scenario === "object", "operation journal scenario entry is invalid");
  if (journal.fleetBootstrap === undefined) journal.fleetBootstrap = null;
  check(journal.fleetBootstrap === null || typeof journal.fleetBootstrap === "object", "operation journal fleet-bootstrap entry is invalid");
  const fingerprint = operationExecutionFingerprint();
  const disposition = operationJournalFingerprintDisposition(journal, fingerprint);
  check(
    disposition !== "blocked",
    "operation inputs changed while an Argo convergence, namespace move, protected Namespace ownership detachment, scenario transition, or fleet bootstrap is in flight",
  );
  if (disposition === "rotate") {
    journal.executionFingerprint = fingerprint;
    writeOperationJournal(journal);
  }
  return journal;
}

function writeOperationJournal(journal) {
  mkdirSync(dirname(OPERATION_JOURNAL_PATH), { recursive: true });
  const temp = `${OPERATION_JOURNAL_PATH}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, OPERATION_JOURNAL_PATH);
}

function updateOperationJournal(update) {
  const journal = readOperationJournal();
  update(journal);
  writeOperationJournal(journal);
  return journal;
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function kindClusters() {
  const result = tryCommand("kind", ["get", "clusters"]);
  check(result.ok, `kind get clusters failed: ${result.output}`);
  return result.output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort();
}

function clusterKubeconfig(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.kubeconfig`);
}

function clusterEnv(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.env`);
}

function observeKindTraefikDockerBindings() {
  return KIND_TRAEFIK_CONTRACTS.map((contract) => {
    const node = `${contract.cluster}-control-plane`;
    const result = tryCommand("docker", [
      "inspect", node,
      "--format", "{{json .NetworkSettings.Ports}}",
    ]);
    check(result.ok, `${contract.cluster}: cannot inspect kind control-plane port bindings: ${result.output}`);
    const bindings = JSON.parse(result.output);
    const ports = [contract.httpNodePort, contract.httpsNodePort].map((port) => {
      const rows = bindings[`${port}/tcp`] ?? [];
      check(rows.length > 0, `${contract.cluster}: Docker does not expose required TCP/${port}`);
      const loopbackReachable = rows.find(
        (item) => item.HostPort === String(port) && ["0.0.0.0", "127.0.0.1"].includes(item.HostIp),
      );
      check(loopbackReachable, `${contract.cluster}: Docker TCP/${port} is not mapped to host port ${port}`);
      return {
        containerPort: port,
        hostIP: loopbackReachable.HostIp,
        hostPort: Number(loopbackReachable.HostPort),
      };
    });
    return { cluster: contract.cluster, node, ports };
  });
}

function readSpaces() {
  return new Map(unwrapRows(cubJson(["space", "list", "--select", "Labels,Annotations,ReleaseTargetID,TriggerFilterID,TriggerIDs,WhereTrigger,DeleteGates"]), "Space")
    .map((space) => [space.Slug, space]));
}

function readUnitRows(space) {
  if (activeVerificationReadSnapshot) {
    activeVerificationReadSnapshot.evidenceByResource.get("unit").servedReads += 1;
    return [...(activeVerificationReadSnapshot.unitsBySpace.get(space) ?? [])];
  }
  const value = cubJson([
    "unit", "list", "--space", space,
    "--select", "Labels,Annotations,TargetID,UpstreamUnitID,DeleteGates,DestroyGates,ToolchainType,ProviderType,DataHash,HeadRevisionNum,LastAppliedRevisionNum,ApprovedBy,ApplyGates",
  ]);
  return unwrapRows(value, "Unit");
}

function readUnit(space, slug) {
  if (activeVerificationReadSnapshot) {
    activeVerificationReadSnapshot.evidenceByResource.get("unit").servedReads += 1;
    return activeVerificationReadSnapshot.unitsByRef.get(`${space}/${slug}`) ?? null;
  }
  const result = cubTry([
    "unit", "get", "--space", space, slug,
    "--select", "Labels,Annotations,TargetID,UpstreamUnitID,DeleteGates,DestroyGates,ToolchainType,ProviderType,DataHash,HeadRevisionNum,LastAppliedRevisionNum,ApprovedBy,ApplyGates",
    "-o", "json",
  ]);
  if (!result.ok) return null;
  return unwrapEntity(JSON.parse(result.output), "Unit");
}

function readTarget(space) {
  if (activeVerificationReadSnapshot) {
    activeVerificationReadSnapshot.evidenceByResource.get("target").servedReads += 1;
    return activeVerificationReadSnapshot.targetsBySpace.get(space) ?? null;
  }
  const result = cubTry(["target", "get", "--space", space, "target", "-o", "json"]);
  return result.ok ? unwrapEntity(JSON.parse(result.output), "Target") : null;
}

function readLinks(space) {
  if (activeVerificationReadSnapshot) {
    activeVerificationReadSnapshot.evidenceByResource.get("link").servedReads += 1;
    return [...(activeVerificationReadSnapshot.linksBySpace.get(space) ?? [])];
  }
  const result = cubJson([
    "link", "list", "--space", space,
    "--select", "FromUnitID,ToUnitID,ToSpaceID,UpdateType,AutoUpdate,Labels,Annotations,UpstreamLastMergedRevisionNum,DownstreamLastMergedRevisionNum",
  ]);
  return unwrapRows(result, "Link");
}

function beginVerificationReadSnapshot(spaces) {
  check(!activeVerificationReadSnapshot, "verification read snapshot is already active");
  const captured = captureOrganizationReadSnapshot(spaces);
  const resources = ["unit", "release", "link", "target"].map((resource) => ({
    resource,
    rows: captured.rowCounts[resource],
    listCalls: captured.listCalls[resource],
    servedReads: 0,
  }));
  activeVerificationReadSnapshot = {
    ...captured,
    evidenceByResource: new Map(resources.map((item) => [item.resource, item])),
    evidence: {
      mode: "bracketed-organization-wide-read-only",
      stability: "pending-final-snapshot",
      resources,
    },
  };
  return activeVerificationReadSnapshot;
}

function finishVerificationReadSnapshot(spaces) {
  check(activeVerificationReadSnapshot, "verification read snapshot is not active");
  const opening = activeVerificationReadSnapshot;
  const final = captureOrganizationReadSnapshot(spaces);
  activeVerificationReadSnapshot = null;
  for (const resource of opening.evidence.resources) {
    resource.listCalls += final.listCalls[resource.resource];
    check(
      resource.rows === final.rowCounts[resource.resource],
      `${resource.resource} organization-wide snapshot row count changed during verification`,
    );
  }
  const stable = opening.fingerprint === final.fingerprint;
  opening.evidence.stability = stable ? "pass" : "changed-during-verification";
  check(stable, "Unit, release, Link, or target state changed during read-only verification; retry against a quiescent organization");
  return opening.evidence;
}

function captureOrganizationReadSnapshot(spaces) {
  const slugBySpaceID = new Map([...spaces.values()].map((space) => [space.SpaceID, space.Slug]));
  const unitCapture = measuredOrganizationList("unit", () => unwrapRows(cubJson([
    "unit", "list", "--space", "*",
    "--select", "Labels,Annotations,TargetID,UpstreamUnitID,DeleteGates,DestroyGates,ToolchainType,ProviderType,DataHash,HeadRevisionNum,LastAppliedRevisionNum,ApprovedBy,ApplyGates",
  ]), "Unit"));
  const releaseCapture = measuredOrganizationList("release", () => unwrapRows(cubJson([
    "release", "list", "--space", "*",
    "--where", "Published = true",
    "--select", "SpaceID,Digest,ManifestDigest,ReleaseNum,CreatedAt",
  ]), "Release"));
  const linkCapture = measuredOrganizationList("link", () => unwrapRows(cubJson([
    "link", "list", "--space", "*",
    "--select", "SpaceID,FromUnitID,ToUnitID,ToSpaceID,UpdateType,AutoUpdate,Labels,Annotations,UpstreamLastMergedRevisionNum,DownstreamLastMergedRevisionNum",
  ]), "Link"));
  const targetCapture = measuredOrganizationList("target", () => unwrapRows(cubJson([
    "target", "list", "--space", "*",
    "--select", "SpaceID,ProviderType,ToolchainType,Annotations",
  ]), "Target"));
  const units = unitCapture.rows;
  const releases = releaseCapture.rows;
  const links = linkCapture.rows;
  const targets = targetCapture.rows;

  const unitsBySpace = groupRowsBySpace(units, slugBySpaceID, "Unit");
  const unitsByRef = new Map();
  for (const [space, rows] of unitsBySpace) {
    rows.sort((left, right) => left.Slug.localeCompare(right.Slug));
    for (const unit of rows) {
      const ref = `${space}/${unit.Slug}`;
      check(!unitsByRef.has(ref), `${ref}: organization snapshot returned duplicate Unit slugs`);
      unitsByRef.set(ref, unit);
    }
  }
  const releasesBySpace = groupRowsBySpace(releases, slugBySpaceID, "Release");
  for (const rows of releasesBySpace.values()) {
    rows.sort((left, right) => Number(right.ReleaseNum ?? 0) - Number(left.ReleaseNum ?? 0)
      || String(right.CreatedAt ?? "").localeCompare(String(left.CreatedAt ?? "")));
  }
  const linksBySpace = groupRowsBySpace(links, slugBySpaceID, "Link");
  for (const rows of linksBySpace.values()) rows.sort((left, right) => left.Slug.localeCompare(right.Slug));
  const targetsBySpace = new Map();
  for (const target of targets) {
    assertSnapshotRow(target, slugBySpaceID, "Target");
    if (target.Slug !== "target") continue;
    const space = slugBySpaceID.get(target.SpaceID);
    check(!targetsBySpace.has(space), `${space}: organization snapshot returned duplicate target slugs`);
    targetsBySpace.set(space, target);
  }
  const canonicalRows = {
    unit: snapshotRows(units, ["SpaceID", "UnitID", "Slug", "Labels", "Annotations", "TargetID", "UpstreamUnitID", "DeleteGates", "DestroyGates", "ToolchainType", "ProviderType", "DataHash", "HeadRevisionNum", "LastAppliedRevisionNum", "ApprovedBy", "ApplyGates"]),
    release: snapshotRows(releases, ["SpaceID", "ReleaseID", "Digest", "ManifestDigest", "ReleaseNum", "CreatedAt"]),
    link: snapshotRows(links, ["SpaceID", "LinkID", "Slug", "FromUnitID", "ToUnitID", "ToSpaceID", "UpdateType", "AutoUpdate", "UpstreamLastMergedRevisionNum", "DownstreamLastMergedRevisionNum", "Labels", "Annotations"]),
    target: snapshotRows(targets, ["SpaceID", "TargetID", "Slug", "ProviderType", "ToolchainType", "Annotations"]),
  };
  return {
    unitsBySpace,
    unitsByRef,
    releasesBySpace,
    linksBySpace,
    targetsBySpace,
    rowCounts: {
      unit: units.length,
      release: releases.length,
      link: links.length,
      target: targets.length,
    },
    listCalls: {
      unit: unitCapture.listCalls,
      release: releaseCapture.listCalls,
      link: linkCapture.listCalls,
      target: targetCapture.listCalls,
    },
    fingerprint: `sha256:${sha256(stableJson(canonicalRows))}`,
  };
}

function measuredOrganizationList(resource, read) {
  const verb = `cub.${resource}.list`;
  const before = commandPerformance.get(verb)?.calls ?? 0;
  const rows = read();
  const after = commandPerformance.get(verb)?.calls ?? 0;
  check(after - before === 1, `${resource}: organization snapshot did not issue exactly one measured list command`);
  return { rows, listCalls: after - before };
}

function groupRowsBySpace(rows, slugBySpaceID, resource) {
  const grouped = new Map();
  for (const row of rows) {
    assertSnapshotRow(row, slugBySpaceID, resource);
    const space = slugBySpaceID.get(row.SpaceID);
    if (!grouped.has(space)) grouped.set(space, []);
    grouped.get(space).push(row);
  }
  return grouped;
}

function assertSnapshotRow(row, slugBySpaceID, resource) {
  check(row.OrganizationID === ORGANIZATION_ENTITY_ID, `${resource} organization-wide snapshot escaped the pinned Kubara organization`);
  check(slugBySpaceID.has(row.SpaceID), `${resource} organization-wide snapshot references an unknown Space ID`);
}

function snapshotRows(rows, fields) {
  return rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null])))
    .sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
}

function expectedArgoApplicationSlugs(desired, fleetItem) {
  return [
    "root",
    `argobot-${fleetItem.cluster}`,
    ...desired.deployments
      .filter((deployment) => deployment.cluster === fleetItem.cluster)
      .map((deployment) => deployment.appUnit),
  ].sort();
}

function plannedDeliveryApplicationIdentity(desired) {
  return FLEET.flatMap((fleetItem) => expectedArgoApplicationSlugs(desired, fleetItem).map((slug) => ({
    ref: `${fleetItem.cluster}-argo-apps/${slug}`,
    labels: expectedArgoApplicationLabels(desired, fleetItem, slug),
  })));
}

function expectedArgoApplicationLabels(desired, fleetItem, unitSlug) {
  const appsSpace = `${fleetItem.cluster}-argo-apps`;
  if (unitSlug === "root") {
    return managedUnitLabels({
      role: "DeliveryApplication",
      component: "argo-cd",
      kubaraComponent: null,
      catalogComponent: "argo-cd",
      componentVersion: ARGO_CD_RUNTIME_VERSION,
      catalog: "ConfigHubBootstrap",
      variant: fleetItem.suffix,
      fleetItem,
      extra: {
        ComponentSurface: "argocd-delivery",
        ApplicationKind: "ClusterRoot",
        SourceSpace: appsSpace,
        InstanceOf: ARGO_CD_RUNTIME_UNIT,
        DefinitionSpace: ARGO_CD_RUNTIME_SPACE,
        RuntimeVersion: ARGO_CD_RUNTIME_VERSION,
        RuntimeImage: ARGO_CD_RUNTIME_IMAGE,
      },
    });
  }
  if (unitSlug === `argobot-${fleetItem.cluster}`) {
    return managedUnitLabels({
      role: "DeliveryApplication",
      component: "argobot",
      componentVersion: ARGOBOT_VERSION,
      catalog: "ConfigHubDelivery",
      variant: fleetItem.suffix,
      fleetItem,
      extra: {
        ComponentSurface: "argobot",
        ApplicationKind: "Argobot",
        SourceSpace: `argobot-${fleetItem.cluster}`,
        InstanceOf: "argobot",
        DefinitionSpace: "argobot-base",
      },
    });
  }
  const deployment = desired.deployments.find(
    (item) => item.cluster === fleetItem.cluster && item.appUnit === unitSlug,
  );
  check(deployment, `${appsSpace}/${unitSlug}: no planned deployment owns this Argo Application Unit`);
  const sourceSpace = desired.spaces.find((item) => item.slug === deployment.space);
  check(sourceSpace, `${appsSpace}/${unitSlug}: source Space ${deployment.space} is missing from the plan`);
  return managedUnitLabels({
    role: "DeliveryApplication",
    component: sourceSpace.labels.Component,
    kubaraComponent: sourceSpace.labels.KubaraComponent ?? sourceSpace.labels.Component,
    catalogComponent: sourceSpace.labels.CatalogComponent ?? sourceSpace.labels.KubaraComponent ?? sourceSpace.labels.Component,
    componentVersion: sourceSpace.labels.ComponentVersion ?? KUBARA_VERSION,
    catalog: sourceSpace.labels.Catalog ?? "ConfigHubDelivery",
    variant: sourceSpace.labels.Variant ?? fleetItem.suffix,
    fleetItem,
    extra: {
      ...(sourceSpace.labels.ComponentSurface ? {
        ComponentSurface: sourceSpace.labels.ComponentSurface,
      } : {}),
      ApplicationKind: deployment.type === "platform" ? "PlatformComponent" : "Application",
      SourceSpace: deployment.space,
      InstanceOf: sourceSpace.labels.InstanceOf ?? sourceSpace.labels.Component,
      DefinitionSpace: sourceSpace.labels.DefinitionSpace ?? sourceSpace.upstreamSpace,
      ...(sourceSpace.upstreamSpace ? { PromotionUpstreamSpace: sourceSpace.upstreamSpace } : {}),
      ...(sourceSpace.labels.BundledCatalogComponent ? {
        BundledCatalogComponent: sourceSpace.labels.BundledCatalogComponent,
        BundledComponentVersion: sourceSpace.labels.BundledComponentVersion,
      } : {}),
    },
  });
}

function assertDeliveryTopology(
  spaces,
  desired,
  { requireAllApplications = false, requireApplicationMetadata = false, fleet = FLEET } = {},
) {
  const argobotBaseRows = readUnitRows("argobot-base");
  check(
    stableJson(argobotBaseRows.map((unit) => unit.Slug).sort()) === stableJson(["argobot"]),
    `argobot-base: unsafe Unit inventory; expected only argobot, got ${argobotBaseRows.map((unit) => unit.Slug).sort().join(", ")}`,
  );
  const argobotBase = argobotBaseRows[0];
  check(argobotBase.ToolchainType === "Kubernetes/YAML", "argobot-base/argobot: toolchain drifted");
  check(!argobotBase.ProviderType, "argobot-base/argobot: provider must remain the default");
  check(!argobotBase.TargetID && !argobotBase.UpstreamUnitID, "argobot-base/argobot: base delivery Unit unexpectedly has a target or upstream");
  check(readLinks("argobot-base").length === 0, "argobot-base: unexpected Links present");
  let argobotSources = null;
  try {
    argobotSources = JSON.parse(spaces.get("argobot-base")?.Annotations?.["confighub.com/external-source"] ?? "null");
  } catch {
    check(false, "argobot-base: external-source annotation is not valid JSON");
  }
  check(
    Array.isArray(argobotSources)
      && argobotSources.length === 1
      && argobotSources[0]?.ref === ARGOBOT_SOURCE_REF
      && argobotSources[0]?.digest === ARGOBOT_SOURCE_DIGEST,
    "argobot-base: source OCI ref/digest differs from the exact reviewed delivery helper",
  );
  const argobotDeployment = parseDocs(cub(["unit", "data", "--space", "argobot-base", "argobot"]))
    .find((doc) => doc.kind === "Deployment" && doc.metadata?.name === "argobot");
  check(
    argobotDeployment?.spec?.template?.spec?.containers?.some((container) => container.image === ARGOBOT_IMAGE),
    `argobot-base/argobot: expected exact image ${ARGOBOT_IMAGE}`,
  );

  for (const fleetItem of fleet) {
    const clusterSpace = spaces.get(fleetItem.cluster);
    const appsSpaceSlug = `${fleetItem.cluster}-argo-apps`;
    const appsSpace = spaces.get(appsSpaceSlug);
    const argobotSpaceSlug = `argobot-${fleetItem.cluster}`;
    const argobotSpace = spaces.get(argobotSpaceSlug);
    check(clusterSpace && appsSpace && argobotSpace, `${fleetItem.cluster}: cluster delivery Spaces are incomplete`);

    const targetEntity = readTarget(fleetItem.cluster);
    check(targetEntity?.TargetID, `${fleetItem.cluster}/target: target is missing`);
    check(targetEntity.SpaceID === clusterSpace.SpaceID, `${fleetItem.cluster}/target: target belongs to a different Space`);
    check(targetEntity.ProviderType === "OCI", `${fleetItem.cluster}/target: expected OCI provider, got ${targetEntity.ProviderType ?? "missing"}`);
    check(targetEntity.ToolchainType === "Any", `${fleetItem.cluster}/target: expected Any toolchain, got ${targetEntity.ToolchainType ?? "missing"}`);
    check(
      targetEntity.Annotations?.["confighub.com/argo-apps-space"] === appsSpaceSlug,
      `${fleetItem.cluster}/target: Argo apps annotation does not name ${appsSpaceSlug}`,
    );
    check(appsSpace.ReleaseTargetID === targetEntity.TargetID, `${appsSpaceSlug}: release target is not ${fleetItem.cluster}/target`);
    check(argobotSpace.ReleaseTargetID === targetEntity.TargetID, `${argobotSpaceSlug}: release target is not ${fleetItem.cluster}/target`);

    const clusterUnits = readUnitRows(fleetItem.cluster);
    check(clusterUnits.length === 0, `${fleetItem.cluster}: cluster target Space must remain a pure namespace with no Units`);
    check(readLinks(fleetItem.cluster).length === 0, `${fleetItem.cluster}: cluster target Space must remain a pure namespace with no Links`);

    const allowedApps = expectedArgoApplicationSlugs(desired, fleetItem);
    const requiredApps = requireAllApplications
      ? allowedApps
      : ["root", `argobot-${fleetItem.cluster}`].sort();
    const appRows = readUnitRows(appsSpaceSlug);
    const actualApps = appRows.map((unit) => unit.Slug).sort();
    const unexpectedApps = actualApps.filter((slug) => !allowedApps.includes(slug));
    const missingApps = requiredApps.filter((slug) => !actualApps.includes(slug));
    check(unexpectedApps.length === 0, `${appsSpaceSlug}: refusing to publish unexpected Application Units: ${unexpectedApps.join(", ")}`);
    check(missingApps.length === 0, `${appsSpaceSlug}: required Application Units are missing: ${missingApps.join(", ")}`);
    for (const unit of appRows) {
      check(unit.ToolchainType === "Kubernetes/YAML", `${appsSpaceSlug}/${unit.Slug}: expected Kubernetes/YAML`);
      check(!unit.ProviderType, `${appsSpaceSlug}/${unit.Slug}: provider must remain the default`);
      check(unit.TargetID === targetEntity.TargetID, `${appsSpaceSlug}/${unit.Slug}: target is not ${fleetItem.cluster}/target`);
      if (requireApplicationMetadata) {
        const expectedLabels = expectedArgoApplicationLabels(desired, fleetItem, unit.Slug);
        check(mapMatches(unit.Labels, expectedLabels), `${appsSpaceSlug}/${unit.Slug}: semantic delivery labels drifted`);
        check(
          staleOwnedUnitLabels(unit.Labels, expectedLabels).length === 0,
          `${appsSpaceSlug}/${unit.Slug}: stale owned semantic delivery labels remain`,
        );
      }
    }
    assertBootstrapApplication(
      appsSpaceSlug,
      "root",
      appsSpaceSlug,
      appsSpaceSlug,
    );
    assertBootstrapApplication(
      appsSpaceSlug,
      `argobot-${fleetItem.cluster}`,
      `argobot-${fleetItem.cluster}`,
      argobotSpaceSlug,
    );
    check(readLinks(appsSpaceSlug).length === 0, `${appsSpaceSlug}: unexpected Links present`);

    const argobotRows = readUnitRows(argobotSpaceSlug);
    check(
      stableJson(argobotRows.map((unit) => unit.Slug).sort()) === stableJson(["argobot"]),
      `${argobotSpaceSlug}: unsafe Unit inventory; expected only argobot, got ${argobotRows.map((unit) => unit.Slug).sort().join(", ")}`,
    );
    const argobot = argobotRows[0];
    check(argobot.ToolchainType === "Kubernetes/YAML", `${argobotSpaceSlug}/argobot: toolchain drifted`);
    check(!argobot.ProviderType, `${argobotSpaceSlug}/argobot: provider must remain the default`);
    check(argobot.TargetID === targetEntity.TargetID, `${argobotSpaceSlug}/argobot: target is not ${fleetItem.cluster}/target`);
    check(argobot.UpstreamUnitID === argobotBase.UnitID, `${argobotSpaceSlug}/argobot: upstream is not argobot-base/argobot`);
    const argobotLinks = readLinks(argobotSpaceSlug);
    check(
      argobotLinks.length === 1
        && argobotLinks[0].Slug === "upgrade-argobot"
        && argobotLinks[0].UpdateType === "UpgradeUnit"
        && argobotLinks[0].FromUnitID === argobot.UnitID
        && argobotLinks[0].ToUnitID === argobotBase.UnitID
        && argobotLinks[0].ToSpaceID === spaces.get("argobot-base")?.SpaceID,
      `${argobotSpaceSlug}: argobot UpgradeUnit Link drifted`,
    );
  }
}

function assertBootstrapApplication(appSpace, unitSlug, applicationName, sourceSpace) {
  const docs = parseDocs(cub(["unit", "data", "--space", appSpace, unitSlug]));
  check(docs.length === 1 && docs[0].kind === "Application", `${appSpace}/${unitSlug}: expected one bootstrap Argo Application`);
  const app = docs[0];
  check(app.metadata?.name === applicationName, `${appSpace}/${unitSlug}: bootstrap Application metadata.name drifted`);
  check(app.metadata?.namespace === "argocd", `${appSpace}/${unitSlug}: bootstrap Application namespace is not argocd`);
  check(app.spec?.project === "default", `${appSpace}/${unitSlug}: bootstrap Application project is not default`);
  check(
    app.spec?.source?.repoURL === `${CONFIGHUB_OCI_SPACE_PREFIX}${sourceSpace}`
      && app.spec?.source?.targetRevision === "latest"
      && app.spec?.source?.path === ".",
    `${appSpace}/${unitSlug}: bootstrap Application source is not the allowlisted ConfigHub Space ${sourceSpace}`,
  );
  check(app.spec?.destination?.server === "https://kubernetes.default.svc", `${appSpace}/${unitSlug}: bootstrap Application destination is not cluster-local`);
  check(app.spec?.syncPolicy?.automated?.selfHeal === true, `${appSpace}/${unitSlug}: bootstrap Application is not self-healing`);
  check(app.spec?.syncPolicy?.automated?.prune !== true, `${appSpace}/${unitSlug}: bootstrap Application must not prune`);
  check(
    !(app.spec?.syncPolicy?.syncOptions ?? []).some((option) => String(option).startsWith("Replace=")),
    `${appSpace}/${unitSlug}: bootstrap Application must not use Replace`,
  );
}

function labelsArgs(labels) {
  return Object.entries(labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]);
}

function annotationsArgs(annotations) {
  return Object.entries(annotations).flatMap(([key, value]) => {
    assertCubAnnotationValue(key, value);
    return ["--annotation", `${key}=${value}`];
  });
}

function assertCubAnnotationValue(key, value) {
  check(
    !/[=,\r\n]/.test(String(value)),
    `annotation ${key} contains a cub CLI-ambiguous value`,
  );
}

function mapMatches(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual?.[key] === value);
}

function staleOwnedEntries(actual, expected, ownedKeys) {
  return [...ownedKeys].filter((key) => actual?.[key] !== undefined && expected[key] === undefined);
}

function staleOwnedLabels(actual, expected) {
  return staleOwnedEntries(actual, expected, OWNED_SPACE_LABELS);
}

function staleOwnedUnitLabels(actual, expected) {
  return staleOwnedEntries(actual, expected, OWNED_UNIT_LABELS);
}

function staleOwnedLinkLabels(actual, expected) {
  return staleOwnedEntries(actual, expected, OWNED_LINK_LABELS);
}

function staleOwnedPublicAnnotations(actual, expected) {
  return staleOwnedEntries(actual, expected, OWNED_PUBLIC_ANNOTATIONS);
}

function assertOwnedSpace(space, expected) {
  const cohort = space.Labels?.ExampleCohort;
  if (!cohort) {
    check(
      expected.type === "cluster-target" || expected.type === "delivery-instance" || expected.type === "delivery-definition",
      `refusing to adopt unowned Space ${space.Slug}`,
    );
    return;
  }
  check(
    [EXAMPLE_COHORT, PRIOR_COHORT].includes(cohort),
    `refusing to adopt ${space.Slug}: ExampleCohort=${cohort}`,
  );
}

function assertSpaceAllowlist(spaces, desired, { requireAll = false } = {}) {
  const allowed = new Set(desired.spaces.map((space) => space.slug));
  const unexpected = [...spaces.keys()].filter((slug) => !allowed.has(slug)).sort();
  check(unexpected.length === 0, `refusing unexpected ConfigHub Spaces outside the 55-Space mini-IDP allowlist: ${unexpected.join(", ")}`);
  if (requireAll) {
    const missing = [...allowed].filter((slug) => !spaces.has(slug)).sort();
    check(missing.length === 0, `expected ConfigHub Spaces are missing: ${missing.join(", ")}`);
  }
}

function materializePayloadFiles(inputs, root) {
  const files = new Map();
  for (const item of inputs.payloads.values()) {
    const filename = `${item.key.replaceAll(/[^a-zA-Z0-9._-]+/g, "-")}-${item.sha256.slice(0, 12)}.${item.toolchain === "AppConfig/JSON" ? "json" : "yaml"}`;
    const path = join(root, filename);
    writeFileSync(path, item.value, "utf8");
    files.set(item.key, path);
  }
  return files;
}

function applyPlan(inputs, desired) {
  assertKubaraOrganization();
  const lockPath = acquireSerialLiveLock();
  const priorNamespaceMoveEvidence = validatedPriorNamespaceMoveEvidence();
  const journalNamespaceMoveAttempt = validatedNamespaceMoveJournalAttempt();
  const priorProtectedNamespaceEvidence = validatedPriorProtectedNamespaceEvidence();
  const journalProtectedNamespaceAttempts = validatedProtectedNamespaceJournalAttempts();
  const scenarioJournal = validatedScenarioJournal();
  const fleetBootstrapJournal = validatedFleetBootstrapJournal();
  const namespaceMoveAttempts = new Map(
    priorNamespaceMoveEvidence.map((item) => [item.ref, { ...item, source: "receipt", state: "observed-gone" }]),
  );
  if (journalNamespaceMoveAttempt) {
    const prior = namespaceMoveAttempts.get(journalNamespaceMoveAttempt.ref);
    check(!prior || prior.uid === journalNamespaceMoveAttempt.uid, "receipt and operation journal namespace-move UIDs disagree");
    namespaceMoveAttempts.set(journalNamespaceMoveAttempt.ref, {
      ...journalNamespaceMoveAttempt,
      source: "journal",
    });
  }
  const protectedNamespaceAttempts = new Map(
    priorProtectedNamespaceEvidence.map((item) => [item.migrationID, { ...item, source: "receipt" }]),
  );
  for (const item of journalProtectedNamespaceAttempts) {
    const prior = protectedNamespaceAttempts.get(item.migrationID);
    check(
      !prior || prior.uid === item.uid,
      `${item.migrationID}: receipt and operation journal protected Namespace UIDs disagree`,
    );
    protectedNamespaceAttempts.set(item.migrationID, { ...item, source: "journal" });
  }
  const state = {
    actions: [],
    changedSpaces: new Set(),
    published: new Map(),
    deliveryRootReleases: new Map(),
    namespaceMoveAttempts,
    namespaceMoveEvidence: [
      ...priorNamespaceMoveEvidence,
      ...(journalNamespaceMoveAttempt?.state === "observed-gone" ? [journalNamespaceMoveAttempt] : []),
    ],
    protectedNamespaceAttempts,
    protectedNamespaceEvidence: [
      ...priorProtectedNamespaceEvidence,
      ...journalProtectedNamespaceAttempts.filter((item) => item.state === "observed-detached"),
    ],
    scenarioJournal,
    fleetBootstrapJournal,
    scenario: { mode: "retained-proven-history", steps: [] },
    performancePhaseStart: performanceCheckpoint(),
    performancePhases: [],
  };
  let workRoot = "";
  try {
    assertSerialLiveLock();
    preflightScenarioHistory(state);
    workRoot = mkdtempSync(join(tmpdir(), "helm-expt-kubara-mini-idp-"));
    const payloadFiles = materializePayloadFiles(inputs, workRoot);
    let spaces = readSpaces();
    assertSpaceAllowlist(spaces, desired);
    reconcileClusters(spaces, desired, state);
    state.kindTraefikDockerBindings = observeKindTraefikDockerBindings();
    spaces = readSpaces();
    for (const expected of desired.spaces) {
      const live = spaces.get(expected.slug);
      if (live) assertOwnedSpace(live, expected);
    }
    const preserveScenarioJournalState = Boolean(
      state.scenarioJournal
        && ["started", "completed"].includes(state.scenarioJournal.state)
        && !scenarioReceiptProvesHistory(),
    );
    const inFlightScenarioSpaces = preserveScenarioJournalState
      ? new Set(["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)])
      : new Set();
    ensureDefinitionSpaces(spaces, desired, state, {
      assertOnlySpaces: inFlightScenarioSpaces,
    });
    spaces = readSpaces();
    reconcileSpaceLabels(spaces, desired, state, {
      requireAll: false,
      assertOnlySpaces: inFlightScenarioSpaces,
    });
    reconcileApprovalPolicy(state, {
      assertOnly: preserveScenarioJournalState,
    });
    reconcileControlUnits(inputs, payloadFiles, desired, state);
    reconcileArgoCdDefinitions(inputs, payloadFiles, desired, state);
    reconcileDeliveryApplicationMetadata(desired, state, {
      assertOnlySourceSpaces: inFlightScenarioSpaces,
    });

    for (const surfaceDefinition of SURFACES) {
      reconcileSurface(surfaceDefinition, inputs, payloadFiles, desired, state);
    }
    for (const family of APP_FAMILIES.filter((item) => !item.scenario)) {
      reconcileAppFamily(family, inputs, payloadFiles, desired, state);
    }
    const hxWebScenarioStatus = materializeHxWebScenario(inputs, payloadFiles, desired, state);
    reconcileSpaceLabels(readSpaces(), desired, state, {
      assertOnlySpaces: inFlightScenarioSpaces,
    });
    reconcileProdPolicies(desired, state, {
      assertOnly: preserveScenarioJournalState,
    });
    reconcileDeliveryApplicationMetadata(desired, state, {
      requireAll: true,
      assertOnlySourceSpaces: inFlightScenarioSpaces,
    });
    for (const fleetItem of FLEET) {
      assertUnitAllowlist(
        `${fleetItem.cluster}-argo-apps`,
        expectedArgoApplicationSlugs(desired, fleetItem),
      );
    }
    for (const deployment of desired.deployments.filter((item) => item.type === "platform")) {
      deployOne(deployment, state);
      waitForSpecialPrerequisite(deployment);
    }
    reconcileHxWebScenario(inputs, payloadFiles, desired, state, hxWebScenarioStatus);

    reconcileSpaceLabels(readSpaces(), desired, state);
    reconcileProdPolicies(desired, state);
    // hx-web is published by its scenario state machine. The platform binding
    // and cubbychat follow once cert-manager, Traefik, and the workload service
    // they refer to exist.
    for (const deployment of desired.deployments.filter(
      (item) => item.type === "application" && !item.space.startsWith("hx-web-"),
    )) deployOne(deployment, state);
    for (const deployment of desired.deployments.filter(
      (item) => item.space.startsWith("hx-web-platform-"),
    )) deployOne(deployment, state);

    reconcileDeliveryApplicationMetadata(desired, state, { requireAll: true });
    assertPublishedDeliveryRootsRemainCurrent(state);
    reconcileLinks(desired, state);
    assertManagedLinkInventory(desired, { requireNeedsProvides: true });
    const observation = verifyLive(inputs, desired, { state });
    const receipt = buildReceipt(inputs, desired, observation, state);
    writeReceiptAtomically(receipt);
    if (receipt.status.idempotentRerunProven) {
      verifyReceipt(inputs, desired);
      console.log(
        `reconciled Kubara mini-IDP idempotently: ${state.actions.length} action(s), ${observation.spaces.length} Spaces, ${observation.units.length} managed Units, ${observation.links.length} NeedsProvides Links`,
      );
    } else {
      console.log(
        `reconciled Kubara mini-IDP: ${state.actions.length} action(s); rerun --apply to record the required zero-action idempotence proof`,
      );
    }
  } finally {
    if (workRoot) rmSync(workRoot, { recursive: true, force: true });
    releaseSerialLiveLock(lockPath);
  }
}

function recordAction(state, type, ref, detail = "") {
  state.actions.push({ type, ref, ...(detail ? { detail } : {}) });
}

function reconcileClusters(spaces, desired, state) {
  const local = new Set(kindClusters());
  const allowedClusters = new Set(FLEET.map((item) => item.cluster));
  for (const name of local) {
    if (name.startsWith("hx-app-") && !allowedClusters.has(name)) {
      check(false, `unexpected hx-app cluster ${name}; the exact cluster allowlist is ${[...allowedClusters].join(", ")}`);
    }
  }

  const initialStates = [];
  for (const item of FLEET) {
    const signals = {
      kind: local.has(item.cluster),
      kubeconfig: existsSync(clusterKubeconfig(item.cluster)),
      env: existsSync(clusterEnv(item.cluster)),
      clusterSpace: spaces.has(item.cluster),
      appsSpace: spaces.has(`${item.cluster}-argo-apps`),
      argobotSpace: spaces.has(`argobot-${item.cluster}`),
      target: Boolean(readTarget(item.cluster)),
    };
    const present = Object.values(signals).filter(Boolean).length;
    check(
      present === 0 || present === Object.keys(signals).length,
      `${item.cluster}: unsafe partial persistent-cluster state; refusing repair or deletion: ${stableJson(signals)}`,
    );
    initialStates.push({ item, absent: present === 0 });
  }
  const existingCount = initialStates.filter((entry) => !entry.absent).length;
  let bootstrap = state.fleetBootstrapJournal;
  const existingClusters = initialStates
    .filter((entry) => !entry.absent)
    .map((entry) => entry.item.cluster);
  if (bootstrap?.state === "started") {
    const allowedExisting = [
      ...bootstrap.createdClusters,
      ...(bootstrap.preparedCluster && existingClusters.includes(bootstrap.preparedCluster)
        ? [bootstrap.preparedCluster]
        : []),
    ];
    check(
      stableJson(existingClusters) === stableJson(allowedExisting),
      `fleet bootstrap live clusters are not the exact journaled prefix: journal=${allowedExisting.join(",") || "none"} live=${existingClusters.join(",") || "none"}`,
    );
    const guardedSpaces = desired.deployments
      .map((deployment) => deployment.space)
      .filter((slug, index, all) => all.indexOf(slug) === index)
      .sort();
    check(
      stableJson(guardedSpaces) === stableJson(bootstrap.guardedPublishedSourceSpaces),
      "fleet bootstrap source-Space inventory changed after the zero-release guard",
    );
    const activatedClusters = new Set(bootstrap.rootActivatedClusters);
    const guardedUnactivatedSpaces = desired.deployments
      .filter((deployment) => !activatedClusters.has(deployment.cluster))
      .map((deployment) => deployment.space)
      .filter((slug, index, all) => all.indexOf(slug) === index && spaces.has(slug));
    for (const slug of guardedUnactivatedSpaces) {
      check(
        !hasRelease(slug),
        `${slug}: refusing to resume partial fleet bootstrap after a source release was published`,
      );
    }
    if (bootstrap.preparedCluster && existingClusters.includes(bootstrap.preparedCluster)) {
      bootstrap = checkpointFleetBootstrapCluster(bootstrap.preparedCluster);
      state.fleetBootstrapJournal = bootstrap;
    }
  } else {
    check(
      existingCount === 0 || existingCount === FLEET.length,
      `mixed existing/missing persistent-cluster fleet lacks an exact write-ahead bootstrap journal (${existingCount}/${FLEET.length} complete)`,
    );
  }
  if (existingCount === 0 && !bootstrap) {
    check(!spaces.has("argobot-base"), "argobot-base exists without any complete allowlisted cluster; refusing partial repair");
    const guardedSpaces = desired.deployments
      .map((deployment) => deployment.space)
      .filter((slug, index, all) => all.indexOf(slug) === index)
      .sort();
    for (const deployment of desired.deployments) {
      if (!spaces.has(deployment.space)) continue;
      check(
        !hasRelease(deployment.space),
        `${deployment.space}: refusing zero-cluster bootstrap with a pre-existing published source release that automated child Applications could consume as :latest`,
      );
    }
    bootstrap = beginFleetBootstrapJournal(guardedSpaces);
    state.fleetBootstrapJournal = bootstrap;
  } else if (existingCount === FLEET.length) {
    check(spaces.has("argobot-base"), "argobot-base is missing while persistent clusters exist; refusing partial repair");
    assertDeliveryTopology(spaces, desired, {
      fleet: initialStates.filter((entry) => !entry.absent).map((entry) => entry.item),
    });
  } else {
    check(bootstrap?.state === "started", "partial fleet bootstrap lacks an active operation journal");
    check(spaces.has("argobot-base"), "argobot-base is missing while a journaled persistent cluster exists");
    assertDeliveryTopology(spaces, desired, {
      fleet: initialStates.filter((entry) => !entry.absent).map((entry) => entry.item),
    });
  }

  for (const { item, absent } of initialStates) {
    if (!absent) continue;
    check(bootstrap?.state === "started", `${item.cluster}: missing cluster lacks an active fleet-bootstrap journal`);
    bootstrap = prepareFleetBootstrapCluster(item.cluster);
    state.fleetBootstrapJournal = bootstrap;
    cub(["cluster", "up", "--name", item.cluster, "--space", item.cluster], { timeout: 1_200_000 });
    recordAction(state, "cluster-up", item.cluster, "created persistent kind + ConfigHub Argo target; no cleanup registered");
    const afterSpaces = readSpaces();
    const afterLocal = new Set(kindClusters());
    check(afterLocal.has(item.cluster), `${item.cluster}: kind cluster missing immediately after cluster up`);
    check(existsSync(clusterKubeconfig(item.cluster)), `${item.cluster}: kubeconfig missing immediately after cluster up`);
    check(existsSync(clusterEnv(item.cluster)), `${item.cluster}: env file missing immediately after cluster up`);
    check(
      afterSpaces.has(item.cluster)
        && afterSpaces.has(`${item.cluster}-argo-apps`)
        && afterSpaces.has(`argobot-${item.cluster}`)
        && Boolean(readTarget(item.cluster)),
      `${item.cluster}: ConfigHub target topology incomplete immediately after cluster up`,
    );
    bootstrap = checkpointFleetBootstrapCluster(item.cluster);
    state.fleetBootstrapJournal = bootstrap;
  }

  const refreshed = readSpaces();
  const refreshedClusters = new Set(kindClusters());
  for (const item of FLEET) {
    check(refreshedClusters.has(item.cluster), `${item.cluster}: kind cluster missing after cluster reconciliation`);
    check(existsSync(clusterKubeconfig(item.cluster)), `${item.cluster}: kubeconfig missing after cluster reconciliation`);
    check(existsSync(clusterEnv(item.cluster)), `${item.cluster}: env file missing after cluster reconciliation`);
    check(refreshed.has(item.cluster) && refreshed.has(`${item.cluster}-argo-apps`), `${item.cluster}: ConfigHub cluster Spaces missing after cluster reconciliation`);
    check(readTarget(item.cluster), `${item.cluster}: target missing after cluster reconciliation`);
  }
  for (const slug of ["argobot-base", ...FLEET.map((item) => `argobot-${item.cluster}`)]) {
    check(refreshed.has(slug), `${slug}: delivery Space missing after cluster reconciliation; refusing partial repair`);
  }
  assertDeliveryTopology(refreshed, desired);
  for (const item of FLEET) {
    const reachable = kubectlTry(item.cluster, ["get", "namespace", "kube-system", "-o", "name"]);
    check(reachable.ok && /namespace\/kube-system/.test(reachable.output), `${item.cluster}: kubeconfig/context does not reach the expected persistent kind cluster`);
    observeClusterLocalArgoRuntime(item.cluster);
  }
}

function ensureDefinitionSpaces(
  spaces,
  desired,
  state,
  { assertOnlySpaces = new Set() } = {},
) {
  const creatable = new Set(["control", "component-definition", "delivery-runtime-definition", "app-definition"]);
  for (const item of desired.spaces) {
    if (spaces.has(item.slug)) continue;
    if (!creatable.has(item.type)) continue;
    check(!assertOnlySpaces.has(item.slug), `${item.slug}: definition Space is missing during an in-flight hx-web scenario`);
    cub([
      "space", "create", item.slug,
      ...labelsArgs(item.labels),
      ...annotationsArgs(item.annotations ?? {}),
      "--quiet",
    ]);
    recordAction(state, "space-create", item.slug);
  }
}

function reconcileSpaceLabels(
  spaces,
  desired,
  state,
  { requireAll = true, assertOnlySpaces = new Set() } = {},
) {
  for (const item of desired.spaces) {
    const live = spaces.get(item.slug);
    if (!live && !requireAll) continue;
    check(live, `${item.slug}: expected Space is missing`);
    const expectedAnnotations = item.annotations ?? {};
    const staleLabels = staleOwnedLabels(live.Labels, item.labels);
    const staleAnnotations = staleOwnedPublicAnnotations(live.Annotations, expectedAnnotations);
    if (
      mapMatches(live.Labels, item.labels)
      && staleLabels.length === 0
      && mapMatches(live.Annotations, expectedAnnotations)
      && staleAnnotations.length === 0
    ) continue;
    check(!assertOnlySpaces.has(item.slug), `${item.slug}: owned Space metadata drifted during an in-flight hx-web scenario`);
    cub([
      "space", "update", "--patch", item.slug,
      ...labelsArgs(item.labels),
      ...staleLabels.flatMap((key) => ["--label", `${key}=-`]),
      ...annotationsArgs(expectedAnnotations),
      ...staleAnnotations.flatMap((key) => ["--annotation", `${key}=-`]),
      "--quiet",
    ]);
    recordAction(state, "space-metadata", item.slug);
  }
}

function reconcileApplicationUnitLabels(
  desired,
  fleetItem,
  unitSlug,
  state,
  { required = true, assertOnly = false, observedUnit = undefined } = {},
) {
  const appSpace = `${fleetItem.cluster}-argo-apps`;
  const unit = observedUnit === undefined ? readUnit(appSpace, unitSlug) : observedUnit;
  if (!unit && !required) return false;
  check(unit, `${appSpace}/${unitSlug}: Argo Application Unit is missing`);
  const expected = expectedArgoApplicationLabels(desired, fleetItem, unitSlug);
  const stale = staleOwnedUnitLabels(unit.Labels, expected);
  if (mapMatches(unit.Labels, expected) && stale.length === 0) return true;
  check(!assertOnly, `${appSpace}/${unitSlug}: delivery identity drifted during an in-flight hx-web scenario`);
  cub([
    "unit", "update", "--patch", "--space", appSpace, unitSlug,
    ...labelsArgs(expected),
    ...stale.flatMap((key) => ["--label", `${key}=-`]),
    "--change-desc", `Reconcile ${KUBARA_VERSION} delivery identity`,
    "--quiet",
  ]);
  recordAction(state, "argo-application-metadata", `${appSpace}/${unitSlug}`);
  state.changedSpaces.add(appSpace);
  return true;
}

function reconcileDeliveryApplicationMetadata(
  desired,
  state,
  { requireAll = false, assertOnlySourceSpaces = new Set() } = {},
) {
  for (const fleetItem of FLEET) {
    const appSpace = `${fleetItem.cluster}-argo-apps`;
    const observedBySlug = new Map(readUnitRows(appSpace).map((unit) => [unit.Slug, unit]));
    const requiredSlugs = ["root", `argobot-${fleetItem.cluster}`];
    for (const slug of expectedArgoApplicationSlugs(desired, fleetItem)) {
      const deployment = desired.deployments.find(
        (item) => item.cluster === fleetItem.cluster && item.appUnit === slug,
      );
      reconcileApplicationUnitLabels(desired, fleetItem, slug, state, {
        required: requireAll || requiredSlugs.includes(slug),
        assertOnly: Boolean(deployment && assertOnlySourceSpaces.has(deployment.space)),
        observedUnit: observedBySlug.get(slug) ?? null,
      });
    }
  }
}

function reconcileApprovalPolicy(state, { assertOnly = false } = {}) {
  const triggerResult = cubTry(["trigger", "get", "--space", CONTROL_SPACE, APPROVAL_TRIGGER, "-o", "json"]);
  if (!triggerResult.ok) {
    check(!assertOnly, `${CONTROL_SPACE}/${APPROVAL_TRIGGER}: approval Trigger is missing during an in-flight hx-web scenario`);
    cub([
      "trigger", "create", "--space", CONTROL_SPACE,
      APPROVAL_TRIGGER, "Mutation", "Kubernetes/YAML", "vet-approvedby", "1",
      "--description", "Production configuration requires one approval of the exact revision",
      "--quiet",
    ]);
    recordAction(state, "trigger-create", `${CONTROL_SPACE}/${APPROVAL_TRIGGER}`);
  } else {
    const trigger = unwrapEntity(JSON.parse(triggerResult.output), "Trigger");
    const argumentsMatch = stableJson(trigger.Arguments ?? []) === stableJson([
      { ParameterName: "num-approvers", Value: "1" },
    ]);
    if (
      trigger.Event !== "Mutation"
      || trigger.ToolchainType !== "Kubernetes/YAML"
      || trigger.FunctionName !== "vet-approvedby"
      || !argumentsMatch
      || trigger.Disabled === true
      || trigger.Validating !== true
      || Number(trigger.FailOpenAfter ?? 0) !== 0
    ) {
      check(!assertOnly, `${CONTROL_SPACE}/${APPROVAL_TRIGGER}: approval Trigger drifted during an in-flight hx-web scenario`);
      cub([
        "trigger", "update", "--space", CONTROL_SPACE,
        APPROVAL_TRIGGER, "Mutation", "Kubernetes/YAML", "vet-approvedby", "1",
        "--description", "Production configuration requires one approval of the exact revision",
        "--quiet",
      ]);
      recordAction(state, "trigger-update", `${CONTROL_SPACE}/${APPROVAL_TRIGGER}`);
    }
  }

  const where = "Space.Slug = 'hx-platform' AND FunctionName = 'vet-approvedby'";
  const filterResult = cubTry(["filter", "get", "--space", CONTROL_SPACE, APPROVAL_FILTER, "-o", "json"]);
  if (!filterResult.ok) {
    check(!assertOnly, `${CONTROL_SPACE}/${APPROVAL_FILTER}: approval Filter is missing during an in-flight hx-web scenario`);
    cub([
      "filter", "create", "--space", CONTROL_SPACE,
      APPROVAL_FILTER, "Trigger", "--where-field", where, "--quiet",
    ]);
    recordAction(state, "filter-create", `${CONTROL_SPACE}/${APPROVAL_FILTER}`);
  } else {
    const filter = unwrapEntity(JSON.parse(filterResult.output), "Filter");
    if (filter.From !== "Trigger" || filter.Where !== where) {
      check(!assertOnly, `${CONTROL_SPACE}/${APPROVAL_FILTER}: approval Filter drifted during an in-flight hx-web scenario`);
      cub([
        "filter", "update", "--space", CONTROL_SPACE,
        APPROVAL_FILTER, "Trigger", "--where-field", where, "--quiet",
      ]);
      recordAction(state, "filter-update", `${CONTROL_SPACE}/${APPROVAL_FILTER}`);
    }
  }
}

function reconcileControlUnits(inputs, payloadFiles, desired, state) {
  const expectedUnits = desired.managedUnits.filter((item) => item.space === CONTROL_SPACE);
  const expectedSlugs = expectedUnits.map((item) => item.slug).sort();
  const preservedSlugs = PRESERVED_FAITHFUL_CONTROL_UNITS.map((item) => item.slug).sort();
  const unexpected = readUnitRows(CONTROL_SPACE)
    .map((item) => item.Slug)
    .filter((slug) => !expectedSlugs.includes(slug) && !preservedSlugs.includes(slug))
    .sort();
  check(unexpected.length === 0, `${CONTROL_SPACE}: refusing unexpected control Units: ${unexpected.join(", ")}`);
  assertPreservedFaithfulControlUnits();
  for (const expected of expectedUnits) {
    if (expected.requiredForApply) check(expected.payloadKey, `${CONTROL_SPACE}/${expected.slug}: required evidence is missing`);
    if (!expected.payloadKey) continue;
    upsertUnit(expected, inputs, payloadFiles, state);
  }
  assertUnitAllowlist(CONTROL_SPACE, [...expectedSlugs, ...preservedSlugs]);
}

function reconcileArgoCdDefinitions(inputs, payloadFiles, desired, state) {
  for (const [space, slug] of [
    [ARGO_CD_DEFINITION_SPACE, ARGO_CD_DEFINITION_UNIT],
    [ARGO_CD_RUNTIME_SPACE, ARGO_CD_RUNTIME_UNIT],
  ]) {
    const expected = desired.managedUnits.find((item) => item.space === space && item.slug === slug);
    check(expected, `${space}/${slug}: definition is missing from the plan`);
    upsertUnit(expected, inputs, payloadFiles, state);
    assertUnitAllowlist(space, [slug]);
  }
}

function reconcileSurface(surfaceDefinition, inputs, payloadFiles, desired, state) {
  const baseSpace = `${surfaceDefinition.prefix}-base`;
  const baseUnit = desired.managedUnits.find((item) => item.space === baseSpace && item.slug === surfaceDefinition.prefix);
  upsertUnit(baseUnit, inputs, payloadFiles, state);
  assertUnitAllowlist(baseSpace, [surfaceDefinition.prefix]);
  for (const fleetItem of surfaceDefinition.targets) {
    const space = `${surfaceDefinition.prefix}-${fleetItem.suffix}`;
    ensureVariantSpace({
      space,
      upstreamSpace: baseSpace,
      variantName: fleetItem.suffix,
      fleetItem,
      prodProtected: fleetItem.environment === "Prod",
    }, state);
    const unit = desired.managedUnits.find((item) => item.space === space && item.slug === surfaceDefinition.prefix);
    upsertUnit(unit, inputs, payloadFiles, state);
    assertUnitAllowlist(space, [surfaceDefinition.prefix]);
    ensureArgoApplication(desired.deployments.find((item) => item.space === space), state);
  }
}

function reconcileAppFamily(family, inputs, payloadFiles, desired, state) {
  assertAppFamilyPlanConsistency(desired, [family]);
  const baseSpace = `${family.prefix}-base`;
  for (const unit of desired.managedUnits.filter((item) => item.space === baseSpace)) {
    upsertUnit(unit, inputs, payloadFiles, state);
  }
  assertUnitAllowlist(baseSpace, family.units.map((item) => item.slug));
  for (const fleetItem of family.targets) {
    const space = `${family.prefix}-${fleetItem.suffix}`;
    const plannedSpace = desired.spaces.find((item) => item.slug === space);
    check(plannedSpace?.upstreamSpace, `${space}: planned upstream Space is missing`);
    const upstreamSpace = plannedSpace.upstreamSpace;
    ensureVariantSpace({
      space,
      upstreamSpace,
      variantName: fleetItem.suffix,
      fleetItem,
      prodProtected: fleetItem.environment === "Prod",
    }, state);
    for (const unit of desired.managedUnits.filter((item) => item.space === space)) {
      upsertUnit(unit, inputs, payloadFiles, state);
    }
    assertUnitAllowlist(space, family.units.map((item) => item.slug));
    ensureArgoApplication(
      desired.deployments.find((item) => item.space === space),
      state,
    );
  }
}

function ensureVariantSpace(
  { space, upstreamSpace, variantName, fleetItem, prodProtected },
  state,
  { assertOnly = false } = {},
) {
  const existing = cubTry(["space", "get", space, "-o", "json"]);
  if (!existing.ok) {
    check(!assertOnly, `${space}: scenario variant is missing during in-flight recovery`);
    cub([
      "variant", "create", variantName, upstreamSpace,
      "--space-pattern", `template:${space}`,
      "--environment", fleetItem.environment,
      "--region", fleetItem.region,
      "--target", `${fleetItem.cluster}/target`,
      ...(prodProtected
        ? ["--unit-delete-gate", PROD_SAFETY_GATE, "--unit-destroy-gate", PROD_SAFETY_GATE]
        : []),
      "--wait", "--quiet",
    ], { timeout: 1_200_000 });
    recordAction(state, "variant-create", space, `upstream=${upstreamSpace} target=${fleetItem.cluster}/target`);
    state.changedSpaces.add(space);
    return;
  }
  const live = unwrapEntity(JSON.parse(existing.output), "Space");
  const cohort = live.Labels?.ExampleCohort;
  check(!cohort || [EXAMPLE_COHORT, PRIOR_COHORT].includes(cohort), `${space}: refuses foreign existing variant`);
  const target = readTarget(fleetItem.cluster);
  check(target?.TargetID, `${fleetItem.cluster}/target is missing`);
  if (live.ReleaseTargetID !== target.TargetID) {
    check(!assertOnly, `${space}: release target drifted during an in-flight hx-web scenario`);
    cub(["space", "update", "--patch", space, "--release-target", `${fleetItem.cluster}/target`, "--quiet"]);
    recordAction(state, "space-release-target", space, `${fleetItem.cluster}/target`);
    state.changedSpaces.add(space);
  }
}

function assertUnitAllowlist(space, expectedSlugs) {
  const actual = readUnitRows(space).map((item) => item.Slug).sort();
  const expected = [...expectedSlugs].sort();
  check(stableJson(actual) === stableJson(expected), `${space}: unsafe Unit inventory; expected ${expected.join(", ")}, got ${actual.join(", ")}`);
}

function assertPreservedFaithfulControlUnits() {
  const faithful = verifyFaithfulProof();
  const generatedSha256 = faithful.spec?.source?.currentExample?.generatedSha256;
  check(/^[a-f0-9]{64}$/.test(generatedSha256 ?? ""), "faithful proof generated SHA is missing");
  const rows = [];
  for (const expected of PRESERVED_FAITHFUL_CONTROL_UNITS) {
    const evidence = faithful.spec?.configHub?.[expected.receiptKey];
    const receiptUnit = evidence?.unit;
    const receiptApproval = evidence?.approval;
    const ref = `${CONTROL_SPACE}/${expected.slug}`;
    check(receiptUnit?.ref === ref, `${ref}: faithful receipt ownership reference drifted`);
    check(UUID_PATTERN.test(receiptUnit.id ?? ""), `${ref}: faithful receipt Unit ID is missing`);
    check(Number.isInteger(receiptUnit.headRevisionNum), `${ref}: faithful receipt head revision is missing`);
    check(/^[a-f0-9]{64}$/.test(receiptUnit.dataHash ?? ""), `${ref}: faithful receipt data hash is missing`);
    check(
      receiptApproval?.revision === receiptUnit.headRevisionNum
        && Number.isInteger(receiptApproval.recordedApprovals)
        && receiptApproval.recordedApprovals > 0,
      `${ref}: faithful receipt approval is not bound to its recorded head revision`,
    );

    const live = readUnit(CONTROL_SPACE, expected.slug);
    check(live, `${ref}: retained faithful proof Unit is missing`);
    check(live.UnitID === receiptUnit.id, `${ref}: Unit ID differs from the current faithful pass receipt`);
    check(live.HeadRevisionNum === receiptUnit.headRevisionNum, `${ref}: head revision differs from the current faithful pass receipt`);
    check(live.DataHash === receiptUnit.dataHash, `${ref}: data hash differs from the current faithful pass receipt`);
    check(live.ToolchainType === "AppConfig/YAML", `${ref}: toolchain must remain AppConfig/YAML`);
    check(live.ProviderType === "None", `${ref}: provider must remain None`);
    check(!live.TargetID && !live.UpstreamUnitID, `${ref}: faithful proof evidence must remain untargeted and without an upstream`);
    check(
      approvalCount(live.ApprovedBy) === receiptApproval.recordedApprovals,
      `${ref}: live head approvals differ from the current faithful pass receipt`,
    );
    check(mapMatches(live.Labels, {
      ExampleCohort: EXAMPLE_COHORT,
      KubaraVersion: KUBARA_VERSION,
      Role: expected.role,
      Topology: "HubSpoke",
      ProofPhase: expected.proofPhase,
    }), `${ref}: faithful proof ownership labels drifted`);
    check(mapMatches(live.Annotations, {
      "confighub.com/source-path": paths.config,
      "confighub.com/generated-sha256": `sha256:${generatedSha256}`,
    }), `${ref}: faithful proof provenance annotations drifted`);
    rows.push({
      ref,
      id: live.UnitID,
      headRevisionNum: live.HeadRevisionNum,
      dataHash: live.DataHash,
      approvalCount: approvalCount(live.ApprovedBy),
      owner: "faithful-hub-spoke-proof",
      policy: "preserved",
    });
  }
  return rows;
}

function assertManagedLinkInventory(desired, { requireNeedsProvides = false } = {}) {
  const spaces = readSpaces();
  const unitsBySpace = new Map();
  for (const unit of desired.managedUnits) {
    if (!unitsBySpace.has(unit.space)) unitsBySpace.set(unit.space, []);
    unitsBySpace.get(unit.space).push(unit);
  }
  for (const [space, units] of unitsBySpace) {
    const expectedUpgrade = new Map(units.filter((unit) => unit.upstream).map((unit) => [`upgrade-${unit.slug}`, unit]));
    const expectedNeedsProvides = new Map(desired.links.filter((link) => link.space === space).map((link) => [link.slug, link]));
    const allowedSlugs = new Set([...expectedUpgrade.keys(), ...expectedNeedsProvides.keys()]);
    const liveLinks = readLinks(space);
    const unexpected = liveLinks.filter((link) => !allowedSlugs.has(link.Slug)).map((link) => link.Slug).sort();
    check(unexpected.length === 0, `${space}: refusing unexpected Links: ${unexpected.join(", ")}`);

    for (const [slug, unit] of expectedUpgrade) {
      const link = liveLinks.find((item) => item.Slug === slug);
      check(link, `${space}/${slug}: required UpgradeUnit Link is missing`);
      const downstream = readUnit(space, unit.slug);
      const [upstreamSpace, upstreamSlug] = unit.upstream.split("/");
      const upstream = readUnit(upstreamSpace, upstreamSlug);
      check(downstream && upstream, `${space}/${slug}: UpgradeUnit endpoint is missing`);
      check(link.UpdateType === "UpgradeUnit", `${space}/${slug}: expected UpgradeUnit, got ${link.UpdateType ?? "missing"}`);
      check(link.AutoUpdate !== true, `${space}/${slug}: UpgradeUnit Link must not auto-update during the explicit promotion scenario`);
      check(link.FromUnitID === downstream.UnitID, `${space}/${slug}: downstream endpoint drifted`);
      check(link.ToUnitID === upstream.UnitID, `${space}/${slug}: upstream endpoint drifted`);
      check(link.ToSpaceID === spaces.get(upstreamSpace)?.SpaceID, `${space}/${slug}: upstream Space drifted`);
    }
    if (requireNeedsProvides) {
      for (const slug of expectedNeedsProvides.keys()) {
        check(liveLinks.some((link) => link.Slug === slug), `${space}/${slug}: required NeedsProvides Link is missing`);
      }
    }
  }
}

function upsertUnit(expected, inputs, payloadFiles, state, { payloadKey = expected.payloadKey } = {}) {
  check(expected, "internal error: missing expected Unit definition");
  const payload = inputs.payloads.get(payloadKey);
  check(payload, `${expected.space}/${expected.slug}: payload ${payloadKey} is missing`);
  const path = payloadFiles.get(payloadKey);
  const annotations = {
    ...sourceAnnotation(payload.value, payload.sourcePaths, payload.transform),
    ...(expected.annotations ?? {}),
  };
  let current = readUnit(expected.space, expected.slug);
  if (!current) {
    check(!expected.upstream, `${expected.space}/${expected.slug}: variant Unit is missing; refusing partial clone repair`);
    cub([
      "unit", "create", "--space", expected.space,
      expected.slug, path,
      "--toolchain", expected.toolchain,
      ...(expected.provider ? ["--provider", expected.provider] : []),
      ...labelsArgs(expected.labels),
      ...annotationsArgs(annotations),
      "--change-desc", `Reconcile ${KUBARA_VERSION} mini-IDP source`,
      "--quiet",
    ], { timeout: 1_200_000 });
    recordAction(state, "unit-create", `${expected.space}/${expected.slug}`, payloadKey);
    state.changedSpaces.add(expected.space);
    current = readUnit(expected.space, expected.slug);
    check(current, `${expected.space}/${expected.slug}: created Unit is not observable`);
  } else {
    check(current.ToolchainType === expected.toolchain, `${expected.space}/${expected.slug}: toolchain ${current.ToolchainType} cannot be safely adopted`);
    const actualProvider = current.ProviderType ?? null;
    const expectedProvider = expected.provider ?? null;
    check(actualProvider === expectedProvider, `${expected.space}/${expected.slug}: provider ${actualProvider ?? "default"} cannot be safely adopted; expected ${expectedProvider ?? "default"}`);
    if (expected.upstream) {
      const [upstreamSpace, upstreamSlug] = expected.upstream.split("/");
      const upstream = readUnit(upstreamSpace, upstreamSlug);
      check(upstream?.UnitID, `${expected.space}/${expected.slug}: expected upstream ${expected.upstream} is missing`);
      check(
        current.UpstreamUnitID === upstream.UnitID,
        `${expected.space}/${expected.slug}: unsafe upstream mismatch; expected ${expected.upstream}, refusing partial variant repair`,
      );
    }
    if (!sameUnitData(expected.toolchain, cub(["unit", "data", "--space", expected.space, expected.slug]), payload.value)) {
      cub([
        "unit", "update", "--space", expected.space,
        expected.slug, path,
        ...(expected.provider ? ["--provider", expected.provider] : []),
        "--change-desc", `Reconcile ${KUBARA_VERSION} mini-IDP source`,
        "--quiet",
      ], { timeout: 1_200_000 });
      recordAction(state, "unit-data", `${expected.space}/${expected.slug}`, payloadKey);
      state.changedSpaces.add(expected.space);
      current = readUnit(expected.space, expected.slug);
      check(current, `${expected.space}/${expected.slug}: updated Unit is not observable`);
    }
    const staleLabels = staleOwnedUnitLabels(current.Labels, expected.labels);
    const staleAnnotations = staleOwnedPublicAnnotations(current.Annotations, annotations);
    if (
      !mapMatches(current.Labels, expected.labels)
      || staleLabels.length > 0
      || !mapMatches(current.Annotations, annotations)
      || staleAnnotations.length > 0
      || (expected.provider && current.ProviderType !== expected.provider)
    ) {
      cub([
        "unit", "update", "--patch", "--space", expected.space,
        expected.slug,
        ...(expected.provider ? ["--provider", expected.provider] : []),
        ...labelsArgs(expected.labels),
        ...staleLabels.flatMap((key) => ["--label", `${key}=-`]),
        ...annotationsArgs(annotations),
        ...staleAnnotations.flatMap((key) => ["--annotation", `${key}=-`]),
        "--change-desc", `Reconcile ${KUBARA_VERSION} mini-IDP provenance`,
        "--quiet",
      ]);
      recordAction(state, "unit-metadata", `${expected.space}/${expected.slug}`);
      state.changedSpaces.add(expected.space);
    }
  }

  if (expected.target) {
    const targetEntity = readTarget(expected.target.split("/")[0]);
    check(targetEntity?.TargetID, `${expected.target}: target is missing`);
    if (current.TargetID !== targetEntity.TargetID) {
      cub(["unit", "set-target", "--space", expected.space, expected.slug, expected.target, "--quiet"]);
      recordAction(state, "unit-target", `${expected.space}/${expected.slug}`, expected.target);
      state.changedSpaces.add(expected.space);
    }
  } else if (current.TargetID) {
    cub(["unit", "set-target", "--space", expected.space, expected.slug, "-", "--quiet"]);
    recordAction(state, "unit-target-clear", `${expected.space}/${expected.slug}`);
    state.changedSpaces.add(expected.space);
  }

  if (expected.prodProtected) ensureUnitProtection(expected.space, expected.slug, state, current);
}

function upsertScenarioUnitAtomically(expected, inputs, payloadFiles, state, payloadKey) {
  check(expected, "internal error: missing expected scenario Unit definition");
  const ref = `${expected.space}/${expected.slug}`;
  const payload = inputs.payloads.get(payloadKey);
  const path = payloadFiles.get(payloadKey);
  check(payload && path, `${ref}: scenario payload ${payloadKey} is not materialized`);
  const live = readUnit(expected.space, expected.slug);
  check(live, `${ref}: scenario Unit is missing`);
  check(live.ToolchainType === expected.toolchain, `${ref}: scenario toolchain drifted`);
  check((live.ProviderType ?? null) === (expected.provider ?? null), `${ref}: scenario provider drifted`);
  if (expected.target) {
    const target = readTarget(expected.target.split("/")[0]);
    check(target?.TargetID && live.TargetID === target.TargetID, `${ref}: scenario target drifted`);
  } else check(!live.TargetID, `${ref}: untargeted scenario Unit gained a target`);
  if (expected.upstream) {
    const [upstreamSpace, upstreamSlug] = expected.upstream.split("/");
    const upstream = readUnit(upstreamSpace, upstreamSlug);
    check(upstream?.UnitID && live.UpstreamUnitID === upstream.UnitID, `${ref}: scenario upstream drifted`);
  } else check(!live.UpstreamUnitID, `${ref}: scenario definition gained an upstream`);

  const annotations = {
    ...sourceAnnotation(payload.value, payload.sourcePaths, payload.transform),
    ...(expected.annotations ?? {}),
  };
  const staleLabels = staleOwnedUnitLabels(live.Labels, expected.labels);
  const staleAnnotations = staleOwnedPublicAnnotations(live.Annotations, annotations);
  const dataMatches = sameUnitData(
    expected.toolchain,
    cub(["unit", "data", "--space", expected.space, expected.slug]),
    payload.value,
  );
  const metadataMatches = mapMatches(live.Labels, expected.labels)
    && staleLabels.length === 0
    && mapMatches(live.Annotations, annotations)
    && staleAnnotations.length === 0;
  if (dataMatches && metadataMatches) return;

  cub([
    "unit", "update", "--space", expected.space,
    expected.slug, path,
    ...(expected.provider ? ["--provider", expected.provider] : []),
    ...labelsArgs(expected.labels),
    ...staleLabels.flatMap((key) => ["--label", `${key}=-`]),
    ...annotationsArgs(annotations),
    ...staleAnnotations.flatMap((key) => ["--annotation", `${key}=-`]),
    "--change-desc", `Reconcile atomic ${SCENARIO_VERSION} transition ${payloadKey}`,
    "--quiet",
  ], { timeout: 1_200_000 });
  recordAction(state, "unit-data", ref, `${payloadKey}; atomic scenario data+provenance`);
  state.changedSpaces.add(expected.space);
}

function sameUnitData(toolchain, actual, expected) {
  if (toolchain === "Kubernetes/YAML") return canonicalDocuments(actual) === canonicalDocuments(expected);
  if (toolchain === "AppConfig/JSON") return stableJson(JSON.parse(actual)) === stableJson(JSON.parse(expected));
  return canonicalYamlDocument(actual) === canonicalYamlDocument(expected);
}

function canonicalDocuments(text) {
  return memoizedCanonicalYaml("documents", text, () => (
    parseDocs(text).sort((left, right) => identityFor(left).localeCompare(identityFor(right)))
  ));
}

function canonicalYamlDocument(text) {
  return memoizedCanonicalYaml("document", text, () => readYamlText(text));
}

function memoizedCanonicalYaml(kind, text, parse) {
  canonicalYamlPerformance.requests += 1;
  const digest = sha256(text);
  const key = `${kind}/${digest}`;
  const signature = {
    length: text.length,
    head: text.slice(0, 64),
    tail: text.slice(-64),
  };
  const cached = canonicalYamlCache.get(key);
  if (cached) {
    check(
      stableJson(cached.signature) === stableJson(signature),
      `canonical YAML cache collision for ${kind}/${digest}`,
    );
    canonicalYamlPerformance.hits += 1;
    return cached.value;
  }
  canonicalYamlPerformance.misses += 1;
  const startedAt = performance.now();
  const value = stableJson(parse());
  canonicalYamlPerformance.parseMs += performance.now() - startedAt;
  canonicalYamlCache.set(key, { signature, value });
  return value;
}

function gateEnabled(value, name) {
  if (Array.isArray(value)) return value.includes(name);
  return value?.[name] === true;
}

function ensureUnitProtection(space, slug, state, observedUnit = null) {
  const unit = observedUnit ?? readUnit(space, slug);
  check(unit, `${space}/${slug}: Unit is missing before protection reconciliation`);
  if (gateEnabled(unit.DeleteGates, PROD_SAFETY_GATE) && gateEnabled(unit.DestroyGates, PROD_SAFETY_GATE)) return;
  cub([
    "unit", "update", "--patch", "--space", space, slug,
    "--delete-gate", PROD_SAFETY_GATE,
    "--destroy-gate", PROD_SAFETY_GATE,
    "--change-desc", "Protect production mini-IDP configuration",
    "--quiet",
  ]);
  recordAction(state, "unit-protection", `${space}/${slug}`);
  state.changedSpaces.add(space);
}

function ensureArgoApplication(deployment, state, { assertOnly = false } = {}) {
  check(deployment, "internal error: deployment definition missing");
  const existing = readUnit(deployment.appSpace, deployment.appUnit);
  check(existing, `${deployment.appSpace}/${deployment.appUnit}: Argo Application Unit missing; refusing partial variant repair`);
  const targetEntity = readTarget(deployment.cluster);
  check(targetEntity?.TargetID, `${deployment.cluster}/target: target is missing`);
  check(existing.TargetID === targetEntity.TargetID, `${deployment.appSpace}/${deployment.appUnit}: target is not ${deployment.cluster}/target`);
  const fleetItem = FLEET.find((item) => item.cluster === deployment.cluster);
  check(fleetItem, `${deployment.cluster}: fleet identity is missing`);
  reconcileApplicationUnitLabels(plan, fleetItem, deployment.appUnit, state, {
    assertOnly,
    observedUnit: existing,
  });
  const currentData = cub(["unit", "data", "--space", deployment.appSpace, deployment.appUnit]);
  const docs = parseDocs(currentData);
  check(docs.length === 1 && docs[0].kind === "Application", `${deployment.appSpace}/${deployment.appUnit}: expected one Argo Application`);
  const app = docs[0];
  assertArgoApplicationContract(app, deployment, { allowMissingDestinationNamespace: true });
  app.spec ??= {};
  app.spec.destination = {
    server: "https://kubernetes.default.svc",
    namespace: deployment.destinationNamespace,
  };
  app.spec.syncPolicy = applicationSyncPolicy(deployment);
  if (deployment.ignoreInjectedCertificateData) {
    app.spec.ignoreDifferences = certificateIgnoreDifferences();
  } else delete app.spec.ignoreDifferences;
  const expected = renderDocuments([app]);
  if (sameUnitData("Kubernetes/YAML", currentData, expected)) return;
  check(!assertOnly, `${deployment.appSpace}/${deployment.appUnit}: Application contract drifted during an in-flight hx-web scenario`);
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-kubara-argo-app-"));
  try {
    const path = join(temp, `${deployment.appUnit}.yaml`);
    writeFileSync(path, expected, "utf8");
    cub([
      "unit", "update", "--space", deployment.appSpace,
      deployment.appUnit, path,
      "--change-desc", "Preserve Kubara destination, prune, and bounded retry semantics",
      "--quiet",
    ]);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  recordAction(state, "argo-application", `${deployment.appSpace}/${deployment.appUnit}`);
  state.changedSpaces.add(deployment.appSpace);
}

function certificateIgnoreDifferences() {
  return [
    {
      group: "admissionregistration.k8s.io",
      kind: "MutatingWebhookConfiguration",
      jqPathExpressions: [".webhooks[]?.clientConfig.caBundle"],
    },
    {
      group: "admissionregistration.k8s.io",
      kind: "ValidatingWebhookConfiguration",
      jqPathExpressions: [".webhooks[]?.clientConfig.caBundle"],
    },
  ];
}

function applicationSyncOptions(deployment) {
  return [
    "CreateNamespace=false",
    "PruneLast=true",
    "FailOnSharedResource=true",
    "RespectIgnoreDifferences=true",
    "ApplyOutOfSyncOnly=true",
    ...(deployment.serverSideApply ? ["ServerSideApply=true"] : []),
  ];
}

function applicationRetryPolicy() {
  return {
    limit: 5,
    backoff: {
      duration: "5s",
      factor: 2,
      maxDuration: "1m",
    },
  };
}

function applicationSyncPolicy(deployment) {
  return {
    automated: {
      prune: true,
      selfHeal: true,
      allowEmpty: true,
    },
    syncOptions: applicationSyncOptions(deployment),
    retry: applicationRetryPolicy(),
  };
}

function assertArgoApplicationContract(app, deployment, { allowMissingDestinationNamespace = false } = {}) {
  check(app.metadata?.name === deployment.appUnit, `${deployment.appSpace}/${deployment.appUnit}: Application metadata.name drifted`);
  check(app.metadata?.namespace === "argocd", `${deployment.appSpace}/${deployment.appUnit}: Application namespace is not argocd`);
  check(app.spec?.project === "default", `${deployment.appSpace}/${deployment.appUnit}: Application project is not default`);
  check(
    app.spec?.source?.repoURL === `${CONFIGHUB_OCI_SPACE_PREFIX}${deployment.space}`,
    `${deployment.appSpace}/${deployment.appUnit}: Application source is not the allowlisted ConfigHub Space ${deployment.space}`,
  );
  check(app.spec?.source?.targetRevision === "latest", `${deployment.appSpace}/${deployment.appUnit}: Application targetRevision is not latest`);
  check(app.spec?.source?.path === ".", `${deployment.appSpace}/${deployment.appUnit}: Application source path is not .`);
  check(
    app.spec?.destination?.server === "https://kubernetes.default.svc",
    `${deployment.appSpace}/${deployment.appUnit}: Application destination is not the cluster-local API`,
  );
  const actualNamespace = app.spec?.destination?.namespace;
  check(
    actualNamespace === deployment.destinationNamespace
      || (allowMissingDestinationNamespace && actualNamespace == null),
    `${deployment.appSpace}/${deployment.appUnit}: Application destination namespace is not ${deployment.destinationNamespace}`,
  );
}

function reconcileProdPolicies(desired, state, { requireAll = true, assertOnly = false } = {}) {
  const filter = unwrapEntity(cubJson(["filter", "get", "--space", CONTROL_SPACE, APPROVAL_FILTER]), "Filter");
  check(filter?.FilterID, `${CONTROL_SPACE}/${APPROVAL_FILTER}: filter ID is missing`);
  const trigger = unwrapEntity(cubJson(["trigger", "get", "--space", CONTROL_SPACE, APPROVAL_TRIGGER]), "Trigger");
  check(trigger?.TriggerID, `${CONTROL_SPACE}/${APPROVAL_TRIGGER}: trigger ID is missing`);
  const control = unwrapEntity(cubJson(["space", "get", CONTROL_SPACE]), "Space");
  check(control?.SpaceID, `${CONTROL_SPACE}: Space ID is missing`);
  const legacyControlWhere = `SpaceID = '${control.SpaceID}'`;
  const prodSpaces = desired.spaces.filter((item) => item.prodProtected);
  const knownSpaces = readSpaces();
  for (const expected of prodSpaces) {
    if (!knownSpaces.has(expected.slug) && !requireAll) continue;
    check(knownSpaces.has(expected.slug), `${expected.slug}: production Space is missing`);
    const live = unwrapEntity(cubJson(["space", "get", expected.slug]), "Space");
    const whereTrigger = live.WhereTrigger ?? "";
    const triggerFilterID = live.TriggerFilterID ?? "";
    const selectedTriggers = [...(live.TriggerIDs ?? [])].sort();
    const ownedFilterAttached = triggerFilterID === filter.FilterID && !whereTrigger;
    const triggerSelectionExact = stableJson(selectedTriggers) === stableJson([trigger.TriggerID]);
    const alreadyExact = ownedFilterAttached && triggerSelectionExact;
    const unconfigured = !triggerFilterID && !whereTrigger && selectedTriggers.length === 0;
    const legacyUpstreamSpaceID = expected.upstreamSpace
      ? knownSpaces.get(expected.upstreamSpace)?.SpaceID
      : null;
    const recognizedLegacyWheres = new Set([
      legacyControlWhere,
      ...(legacyUpstreamSpaceID ? [`SpaceID = '${legacyUpstreamSpaceID}'`] : []),
    ]);
    const recognizedLegacy = !triggerFilterID
      && recognizedLegacyWheres.has(whereTrigger)
      && selectedTriggers.every((id) => id === trigger.TriggerID);
    check(
      ownedFilterAttached || unconfigured || recognizedLegacy,
      `${expected.slug}: refusing to replace an unowned Trigger policy (${stableJson({ triggerFilterID, whereTrigger, selectedTriggers })})`,
    );
    if (!alreadyExact) {
      check(!assertOnly, `${expected.slug}: production policy drifted during an in-flight hx-web scenario`);
      if (!ownedFilterAttached) {
        cub([
          "space", "update", "--patch", expected.slug,
          "--trigger-filter", `${CONTROL_SPACE}/${APPROVAL_FILTER}`,
          "--where-trigger", "-",
          "--quiet",
        ]);
      }
      cub([
        "space", "update", "--patch", expected.slug,
        "--refresh-triggers", "--quiet",
      ]);
      recordAction(state, "approval-policy", expected.slug, `${CONTROL_SPACE}/${APPROVAL_FILTER}`);
    }
    const refreshed = unwrapEntity(cubJson(["space", "get", expected.slug]), "Space");
    check(refreshed.TriggerFilterID === filter.FilterID && !(refreshed.WhereTrigger ?? ""), `${expected.slug}: production approval Filter did not attach exactly`);
    check(stableJson([...(refreshed.TriggerIDs ?? [])].sort()) === stableJson([trigger.TriggerID]), `${expected.slug}: production Trigger selection is not exactly ${CONTROL_SPACE}/${APPROVAL_TRIGGER}`);
    for (const unit of readUnitRows(expected.slug)) {
      if (assertOnly) {
        check(
          gateEnabled(unit.DeleteGates, PROD_SAFETY_GATE)
            && gateEnabled(unit.DestroyGates, PROD_SAFETY_GATE),
          `${expected.slug}/${unit.Slug}: production protection drifted during an in-flight hx-web scenario`,
        );
      } else ensureUnitProtection(expected.slug, unit.Slug, state);
    }
  }
}

function scenarioMarkerStatus() {
  const spaces = readSpaces();
  const expected = ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)];
  const marked = expected.filter((slug) => spaces.get(slug)?.Labels?.ScenarioVersion === SCENARIO_VERSION);
  return { expected, marked, complete: marked.length === expected.length };
}

function scenarioSpacesMarked() {
  return scenarioMarkerStatus().complete;
}

function readPriorReceipt() {
  if (!existsSync(RECEIPT_PATH)) return null;
  try {
    return readYaml(RECEIPT_PATH);
  } catch (error) {
    check(false, `prior mini-IDP receipt is unreadable at ${RECEIPT_PATH}: ${error.message}`);
  }
}

function writeReceiptAtomically(receipt) {
  mkdirSync(dirname(RECEIPT_PATH), { recursive: true });
  const temp = `${RECEIPT_PATH}.${process.pid}.tmp`;
  writeFileSync(temp, toYaml(receipt), "utf8");
  renameSync(temp, RECEIPT_PATH);
}

function assertNamespaceMoveEvidenceRow(item, prefix = "namespace-move evidence", { requireComplete = true } = {}) {
  check(
    item.migrationID === NAMESPACE_MOVE_MIGRATION_ID
      && item.ref === "hx-app-dev/DaemonSet/default/kube-prometheus-stack-prometheus-node-exporter"
      && item.application === "hx-app-dev/hx-kps-main-dev"
      && item.apiVersion === "apps/v1"
      && item.kind === "DaemonSet"
      && item.name === "kube-prometheus-stack-prometheus-node-exporter"
      && item.fromNamespace === "default"
      && item.toNamespace === "kube-prometheus-stack",
    `${prefix} identity drifted`,
  );
  check(UUID_PATTERN.test(item.uid ?? ""), `${prefix} UID is missing`);
  const revision = item.state === "observed-gone" ? item.revisionAtDeletion : item.expectedRevision;
  check(/^sha256:[0-9a-f]{64}$/.test(revision ?? ""), `${prefix} authorization-time revision is invalid`);
  check(stableJson(item.conflictingBindings) === stableJson(["TCP/9100"]), `${prefix} binding drifted`);
  check(/^\d+$/.test(String(item.resourceVersion ?? "")), `${prefix} resourceVersion is invalid`);
  check(Number.isFinite(Date.parse(item.preparedAt ?? "")), `${prefix} preparedAt is invalid`);
  if (item.state === "observed-gone") {
    check(item.evidenceScope === "historical-migration-event", `${prefix} evidence scope drifted`);
    check(/^original-uid-gone(?:-replaced-by-[0-9a-f-]+)?$/.test(item.outcome ?? ""), `${prefix} outcome is invalid`);
    check(Number.isFinite(Date.parse(item.observedGoneAt ?? "")), `${prefix} observedGoneAt is invalid`);
  } else if (requireComplete) check(false, `${prefix} is not completed`);
  check(typeof item.reason === "string" && item.reason.length > 20, `${prefix} reviewed reason is missing`);
}

function validatedPriorNamespaceMoveEvidence() {
  const receipt = readPriorReceipt();
  if (!receipt) return [];
  const trusted = receipt.kind === "ConfigHubKubaraMiniIDPReconcileReceipt"
    && receipt.spec?.organization?.name === ORGANIZATION
    && receipt.spec?.organization?.externalID === ORGANIZATION_EXTERNAL_ID
    && receipt.spec?.organization?.entityID === ORGANIZATION_ENTITY_ID
    && receipt.spec?.organization?.serverURL === CONFIGHUB_SERVER_URL;
  if (!trusted) return [];
  const rows = receipt.spec?.namespaceMovePrunes ?? [];
  check(rows.length <= 1, "prior receipt retains more than one namespace-move DaemonSet prune");
  for (const item of rows) assertNamespaceMoveEvidenceRow(item, "prior receipt namespace-move prune");
  return rows;
}

function validatedNamespaceMoveJournalAttempt() {
  const item = readOperationJournal().namespaceMove;
  if (!item) return null;
  assertNamespaceMoveEvidenceRow(item, "operation journal namespace-move attempt", { requireComplete: false });
  check(/^\d+$/.test(String(item.resourceVersion ?? "")), "operation journal namespace-move resourceVersion is invalid");
  check(
    ["prepared", "delete-returned", "observed-gone"].includes(item.state),
    "operation journal namespace-move state is invalid",
  );
  check(Number.isFinite(Date.parse(item.preparedAt ?? "")), "operation journal namespace-move preparedAt is invalid");
  return item;
}

function protectedNamespaceContract(migrationID) {
  const contract = PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS.find(
    (item) => item.migrationID === migrationID,
  );
  check(contract, `unknown protected Namespace ownership migration ${migrationID}`);
  return contract;
}

function assertProtectedNamespaceCurrentObservation(item, contract, prefix = "protected Namespace current observation") {
  check(item?.migrationID === contract.migrationID, `${prefix}: migration identity drifted`);
  check(item.cluster === contract.cluster, `${prefix}: cluster drifted`);
  check(item.application === `${contract.cluster}/${contract.application}`, `${prefix}: Application drifted`);
  check(item.namespace === contract.retainedNamespace, `${prefix}: retained Namespace drifted`);
  check(item.replacementNamespace === contract.replacementNamespace, `${prefix}: replacement Namespace drifted`);
  check(item.sourceUnit === `${contract.spaceSlug}/${contract.unitSlug}`, `${prefix}: source Unit drifted`);
  check(UUID_PATTERN.test(item.uid ?? ""), `${prefix}: retained Namespace UID is invalid`);
  check(UUID_PATTERN.test(item.replacementUID ?? ""), `${prefix}: replacement Namespace UID is invalid`);
  check(item.state === "retained-clean", `${prefix}: retained Namespace state is not clean`);
  check(item.phase === "Active", `${prefix}: retained Namespace is not Active`);
  check(item.ownershipFieldsAbsent === true, `${prefix}: obsolete ownership fields remain`);
  check(item.replacementTrackingID === contract.replacementTrackingID, `${prefix}: replacement tracking identity drifted`);
  check(
    Number.isInteger(item.replacementOriginRevision)
      && item.replacementOriginRevision > contract.legacyOriginRevision,
    `${prefix}: replacement origin revision is not newer than the legacy origin`,
  );
  check(Number.isFinite(Date.parse(item.observedAt ?? "")), `${prefix}: observedAt is invalid`);
}

function validatedPriorProtectedNamespaceEvidence() {
  const receipt = readPriorReceipt();
  if (!receipt) return [];
  const trusted = receipt.kind === "ConfigHubKubaraMiniIDPReconcileReceipt"
    && receipt.spec?.organization?.name === ORGANIZATION
    && receipt.spec?.organization?.externalID === ORGANIZATION_EXTERNAL_ID
    && receipt.spec?.organization?.entityID === ORGANIZATION_ENTITY_ID
    && receipt.spec?.organization?.serverURL === CONFIGHUB_SERVER_URL;
  if (!trusted) return [];
  const rows = receipt.spec?.protectedNamespaceOwnershipDetachments ?? [];
  check(
    rows.length <= PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS.length,
    "prior receipt retains too many protected Namespace ownership detachments",
  );
  check(new Set(rows.map((item) => item.migrationID)).size === rows.length, "prior receipt duplicates a protected Namespace ownership migration");
  for (const item of rows) {
    assertProtectedNamespaceDetachmentEvidence(
      item,
      protectedNamespaceContract(item.migrationID),
    );
  }
  return rows;
}

function validatedProtectedNamespaceJournalAttempts() {
  const rows = Object.entries(readOperationJournal().protectedNamespaceDetachments ?? {})
    .map(([migrationID, item]) => {
      check(item?.migrationID === migrationID, `${migrationID}: protected Namespace journal key drifted`);
      assertProtectedNamespaceDetachmentEvidence(
        item,
        protectedNamespaceContract(migrationID),
        { requireComplete: false },
      );
      return item;
    })
    .sort((left, right) => left.migrationID.localeCompare(right.migrationID));
  check(
    rows.length <= PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS.length,
    "operation journal retains too many protected Namespace ownership attempts",
  );
  return rows;
}

function validatedScenarioJournal() {
  const item = readOperationJournal().scenario;
  if (!item) return null;
  if (item.version !== SCENARIO_VERSION) {
    check(item.state === "completed", "cannot migrate an in-flight hx-web scenario journal to a new version");
    updateOperationJournal((journal) => {
      journal.scenarioHistory ??= [];
      journal.scenarioHistory.push(item);
      journal.scenario = null;
    });
    return { state: "archived", archivedVersion: item.version, migrationApprovedByVersion: SCENARIO_VERSION };
  }
  check(
    item.sourceFingerprint === scenarioSourceFingerprint(),
    "operation journal hx-web source changed; review the new rollout contract and bump SCENARIO_VERSION before replay",
  );
  check(/^sha256:[0-9a-f]{64}$/.test(item.executionFingerprint ?? ""), "operation journal hx-web execution fingerprint is invalid");
  check(["started", "completed"].includes(item.state), "operation journal hx-web scenario state is invalid");
  check(Number.isFinite(Date.parse(item.startedAt ?? "")), "operation journal hx-web scenario start time is invalid");
  check(Array.isArray(item.completedSteps), "operation journal hx-web completed step list is invalid");
  check(
    item.completedSteps.every((step, index) => step === SCENARIO_STEPS[index]),
    "operation journal hx-web steps are not an exact ordered prefix",
  );
  check(Array.isArray(item.operationEvidence), "operation journal hx-web operation evidence is invalid");
  if (item.preparedStep) {
    check(
      item.preparedStep.id === SCENARIO_STEPS[item.completedSteps.length]
        && item.preparedStep.preCheckpoint
        && Number.isFinite(Date.parse(item.preparedStep.preparedAt ?? "")),
      "operation journal hx-web prepared step is invalid",
    );
    check(
      Array.isArray(item.preparedStep.completedTransitions)
        && item.preparedStep.completedTransitions.every((transition) => typeof transition === "string" && transition),
      "operation journal hx-web prepared transition prefix is invalid",
    );
    check(
      item.preparedStep.transitionCheckpoint && typeof item.preparedStep.transitionCheckpoint === "object",
      "operation journal hx-web prepared transition checkpoint is missing",
    );
    if (item.preparedStep.preparedTransition) {
      check(
        typeof item.preparedStep.preparedTransition.id === "string"
          && item.preparedStep.preparedTransition.preCheckpoint
          && Number.isFinite(Date.parse(item.preparedStep.preparedTransition.preparedAt ?? "")),
        "operation journal hx-web prepared nested transition is invalid",
      );
    }
  }
  check(item.checkpoint && typeof item.checkpoint === "object", "operation journal hx-web checkpoint is missing");
  check(Array.isArray(item.checkpoints), "operation journal hx-web checkpoint history is missing");
  check(
    item.checkpoints[0]?.id === "materialized"
      && item.completedSteps.every((step, index) => item.checkpoints[index + 1]?.id === step),
    "operation journal hx-web checkpoint history does not match completed steps",
  );
  if (item.state === "completed") {
    check(item.completedSteps.length === SCENARIO_STEPS.length, "completed hx-web scenario journal is missing steps");
    check(Number.isFinite(Date.parse(item.completedAt ?? "")), "completed hx-web scenario journal timestamp is invalid");
    check(
      scenarioOperationProofValid(item),
      "completed hx-web scenario journal lacks exact refusal, approval, or rollback evidence bound to its checkpoints",
    );
  }
  return item;
}

function validatedFleetBootstrapJournal() {
  const item = readOperationJournal().fleetBootstrap;
  if (!item) return null;
  check(["started", "completed"].includes(item.state), "operation journal fleet-bootstrap state is invalid");
  check(
    stableJson(item.expectedClusters) === stableJson(FLEET.map((fleetItem) => fleetItem.cluster)),
    "operation journal fleet-bootstrap allowlist drifted",
  );
  check(Array.isArray(item.createdClusters), "operation journal fleet-bootstrap checkpoint list is invalid");
  check(
    Array.isArray(item.guardedPublishedSourceSpaces)
      && item.guardedPublishedSourceSpaces.every((slug) => typeof slug === "string" && slug),
    "operation journal fleet-bootstrap guarded source inventory is invalid",
  );
  check(
    item.createdClusters.every((cluster, index) => cluster === item.expectedClusters[index]),
    "operation journal fleet-bootstrap checkpoints are not an exact ordered prefix",
  );
  if (item.preparedCluster) {
    check(
      item.preparedCluster === item.expectedClusters[item.createdClusters.length],
      "operation journal prepared fleet cluster is out of order",
    );
  }
  check(Array.isArray(item.rootActivatedClusters), "operation journal fleet-root activation prefix is invalid");
  check(
    item.createdClusters.length === item.expectedClusters.length || item.rootActivatedClusters.length === 0,
    "operation journal activated a fleet root before the full cluster fleet existed",
  );
  check(
    item.rootActivatedClusters.every((cluster, index) => cluster === item.expectedClusters[index]),
    "operation journal fleet-root activation checkpoints are not an exact ordered prefix",
  );
  check(Array.isArray(item.rootReleases), "operation journal fleet-root release evidence is invalid");
  check(
    item.rootReleases.length === item.rootActivatedClusters.length
      && item.rootReleases.every((release, index) => (
        release.cluster === item.rootActivatedClusters[index]
          && release.appSpace === `${release.cluster}-argo-apps`
          && Number.isInteger(release.releaseNum)
          && /^sha256:[0-9a-f]{64}$/.test(release.bundleDigest ?? "")
          && /^sha256:[0-9a-f]{64}$/.test(release.manifestDigest ?? "")
      )),
    "operation journal fleet-root release evidence does not match its activation prefix",
  );
  if (item.preparedRootCluster) {
    check(
      item.preparedRootCluster === item.expectedClusters[item.rootActivatedClusters.length],
      "operation journal prepared fleet root is out of order",
    );
  }
  check(Number.isFinite(Date.parse(item.startedAt ?? "")), "operation journal fleet-bootstrap start time is invalid");
  if (
    item.state === "started"
      && item.createdClusters.length === item.expectedClusters.length
      && !item.preparedCluster
      && item.rootActivatedClusters.length === item.expectedClusters.length
      && !item.preparedRootCluster
  ) {
    return completeFleetBootstrapJournal();
  }
  if (item.state === "completed") {
    check(
      item.createdClusters.length === item.expectedClusters.length
        && !item.preparedCluster
        && item.rootActivatedClusters.length === item.expectedClusters.length
        && !item.preparedRootCluster,
      "completed fleet-bootstrap journal is incomplete",
    );
    check(Number.isFinite(Date.parse(item.completedAt ?? "")), "operation journal fleet-bootstrap completion time is invalid");
  }
  return item;
}

function beginFleetBootstrapJournal(guardedSpaces) {
  const journal = updateOperationJournal((current) => {
    if (current.fleetBootstrap) return;
    current.fleetBootstrap = {
      state: "started",
      expectedClusters: FLEET.map((item) => item.cluster),
      createdClusters: [],
      preparedCluster: null,
      rootActivatedClusters: [],
      preparedRootCluster: null,
      rootReleases: [],
      guardedPublishedSourceSpaces: [...guardedSpaces].sort(),
      startedAt: new Date().toISOString(),
    };
  });
  return journal.fleetBootstrap;
}

function prepareFleetBootstrapCluster(cluster) {
  const journal = updateOperationJournal((current) => {
    const bootstrap = current.fleetBootstrap;
    check(bootstrap?.state === "started", `cannot prepare fleet bootstrap for ${cluster}`);
    const expected = bootstrap.expectedClusters[bootstrap.createdClusters.length];
    check(expected === cluster, `fleet bootstrap cluster ${cluster} is out of order; expected ${expected ?? "none"}`);
    check(!bootstrap.preparedCluster || bootstrap.preparedCluster === cluster, `another fleet cluster is already prepared: ${bootstrap.preparedCluster}`);
    bootstrap.preparedCluster = cluster;
  });
  return journal.fleetBootstrap;
}

function checkpointFleetBootstrapCluster(cluster) {
  const journal = updateOperationJournal((current) => {
    const bootstrap = current.fleetBootstrap;
    check(bootstrap?.state === "started" && bootstrap.preparedCluster === cluster, `fleet bootstrap cluster ${cluster} lacks write-ahead intent`);
    bootstrap.createdClusters.push(cluster);
    bootstrap.preparedCluster = null;
    bootstrap.updatedAt = new Date().toISOString();
  });
  return journal.fleetBootstrap;
}

function completeFleetBootstrapJournal() {
  const journal = updateOperationJournal((current) => {
    const bootstrap = current.fleetBootstrap;
    check(bootstrap?.state === "started", "fleet-bootstrap journal is not active at completion");
    check(
      bootstrap.createdClusters.length === bootstrap.expectedClusters.length
        && !bootstrap.preparedCluster
        && bootstrap.rootActivatedClusters.length === bootstrap.expectedClusters.length
        && !bootstrap.preparedRootCluster,
      "fleet-bootstrap journal cannot complete before all clusters and first delivery roots are active",
    );
    bootstrap.state = "completed";
    bootstrap.completedAt = new Date().toISOString();
  });
  return journal.fleetBootstrap;
}

function prepareFleetRootActivation(cluster) {
  const journal = updateOperationJournal((current) => {
    const bootstrap = current.fleetBootstrap;
    check(bootstrap?.state === "started", `cannot prepare fleet-root activation for ${cluster}`);
    check(bootstrap.createdClusters.length === bootstrap.expectedClusters.length, "cannot activate a fleet root before all persistent clusters exist");
    const expected = bootstrap.expectedClusters[bootstrap.rootActivatedClusters.length];
    check(expected === cluster, `fleet-root activation ${cluster} is out of order; expected ${expected ?? "none"}`);
    check(!bootstrap.preparedRootCluster || bootstrap.preparedRootCluster === cluster, `another fleet root is already prepared: ${bootstrap.preparedRootCluster}`);
    bootstrap.preparedRootCluster = cluster;
  });
  return journal.fleetBootstrap;
}

function checkpointFleetRootActivation(cluster, release) {
  const validated = validatedPublishedRelease(`${cluster}-argo-apps`, release, "fleet-root activation release");
  const evidence = {
    cluster,
    appSpace: `${cluster}-argo-apps`,
    releaseNum: Number(validated.ReleaseNum),
    bundleDigest: validated.Digest,
    manifestDigest: validated.ManifestDigest,
  };
  const journal = updateOperationJournal((current) => {
    const bootstrap = current.fleetBootstrap;
    check(
      bootstrap?.state === "started" && bootstrap.preparedRootCluster === cluster,
      `fleet-root activation ${cluster} lacks write-ahead intent`,
    );
    bootstrap.rootActivatedClusters.push(cluster);
    bootstrap.rootReleases.push(evidence);
    bootstrap.preparedRootCluster = null;
    bootstrap.updatedAt = new Date().toISOString();
    if (bootstrap.rootActivatedClusters.length === bootstrap.expectedClusters.length) {
      bootstrap.state = "completed";
      bootstrap.completedAt = new Date().toISOString();
    }
  });
  return journal.fleetBootstrap;
}

function beginScenarioJournal() {
  const checkpoint = scenarioCheckpoint();
  const journal = updateOperationJournal((current) => {
    if (current.scenario) return;
    current.scenario = {
      version: SCENARIO_VERSION,
      sourceFingerprint: scenarioSourceFingerprint(),
      executionFingerprint: operationExecutionFingerprint(),
      state: "started",
      completedSteps: [],
      operationEvidence: [],
      checkpoint,
      checkpoints: [{ id: "materialized", facts: checkpoint }],
      startedAt: new Date().toISOString(),
    };
  });
  return journal.scenario;
}

function scenarioSourceFingerprint() {
  const payloads = [...inputs.payloads.values()]
    .filter((item) => item.key.startsWith("hx-web/"))
    .map((item) => ({ key: item.key, sha256: item.sha256 }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const contract = {
    version: SCENARIO_VERSION,
    orderedSteps: SCENARIO_STEPS,
    approval: {
      trigger: APPROVAL_TRIGGER,
      filter: APPROVAL_FILTER,
      gate: APPROVAL_GATE,
      productionProtection: PROD_SAFETY_GATE,
      exactHeadRevision: true,
    },
    promotion: "explicit UpgradeUnit promotion with downstream departures preserved",
    rollback: "prod-a exact reviewed v1 payload -> restore the exact initial-rollout revision -> exact reviewed two-replica payload",
    stagingDeparture: "SANDBOX_URL survives promotion-v2",
    targets: FLEET.map((item) => ({ cluster: item.cluster, suffix: item.suffix })),
    payloads,
  };
  return `sha256:${sha256(stableJson(contract))}`;
}

function recordScenarioJournalStep(id, actions) {
  const checkpoint = scenarioCheckpoint();
  const journal = updateOperationJournal((current) => {
    const scenario = current.scenario;
    check(scenario?.version === SCENARIO_VERSION && scenario.state === "started", `cannot checkpoint hx-web scenario step ${id}`);
    const expected = SCENARIO_STEPS[scenario.completedSteps.length];
    check(expected === id, `hx-web scenario step ${id} is out of order; expected ${expected ?? "none"}`);
    check(scenario.preparedStep?.id === id, `hx-web scenario step ${id} lacks write-ahead intent`);
    check(!scenario.preparedStep.preparedTransition, `hx-web scenario step ${id} still has a prepared nested transition`);
    check(
      stableJson(checkpoint) === stableJson(scenario.preparedStep.transitionCheckpoint),
      `hx-web scenario step ${id} ended outside its last durable nested-transition checkpoint`,
    );
    scenario.completedSteps.push(id);
    scenario.checkpoint = checkpoint;
    scenario.checkpoints.push({ id, facts: checkpoint });
    delete scenario.preparedStep;
    scenario.updatedAt = new Date().toISOString();
  });
  return journal.scenario;
}

function prepareScenarioJournalStep(id) {
  const journal = updateOperationJournal((current) => {
    const scenario = current.scenario;
    check(scenario?.version === SCENARIO_VERSION && scenario.state === "started", `cannot prepare hx-web scenario step ${id}`);
    const expected = SCENARIO_STEPS[scenario.completedSteps.length];
    check(expected === id, `hx-web scenario step ${id} is out of order; expected ${expected ?? "none"}`);
    if (scenario.preparedStep) {
      check(scenario.preparedStep.id === id, `another hx-web scenario step is already prepared: ${scenario.preparedStep.id}`);
      return;
    }
    scenario.preparedStep = {
      id,
      preCheckpoint: scenario.checkpoint,
      transitionCheckpoint: scenario.checkpoint,
      completedTransitions: [],
      preparedTransition: null,
      preparedAt: new Date().toISOString(),
    };
  });
  return journal.scenario;
}

function scenarioOperationEvidence(actions) {
  return actions.filter((item) => [
    "variant-promote",
    "expected-approval-block",
    "unit-approve",
    "rollback",
  ].includes(item.type));
}

function runScenarioTransition(
  state,
  stepID,
  transitionID,
  mutate,
  assertPost,
  { recoveryEvidence = [] } = {},
) {
  let scenario = state.scenarioJournal;
  const preparedStep = scenario?.preparedStep;
  check(preparedStep?.id === stepID, `${stepID}/${transitionID}: scenario step is not prepared`);
  const completedIndex = preparedStep.completedTransitions.indexOf(transitionID);
  if (completedIndex >= 0) {
    check(
      completedIndex < preparedStep.completedTransitions.length,
      `${stepID}/${transitionID}: invalid completed transition index`,
    );
    return { journal: scenario, result: null, recovered: true, skipped: true };
  }
  check(
    !preparedStep.preparedTransition || preparedStep.preparedTransition.id === transitionID,
    `${stepID}/${transitionID}: another nested transition is prepared: ${preparedStep.preparedTransition?.id}`,
  );
  if (!preparedStep.preparedTransition) {
    const current = scenarioCheckpoint();
    check(
      stableJson(current) === stableJson(preparedStep.transitionCheckpoint),
      `${stepID}/${transitionID}: live state changed after the last durable nested-transition checkpoint`,
    );
    const updated = updateOperationJournal((journal) => {
      const step = journal.scenario?.preparedStep;
      check(step?.id === stepID && !step.preparedTransition, `${stepID}/${transitionID}: cannot write nested-transition intent`);
      step.preparedTransition = {
        id: transitionID,
        preCheckpoint: current,
        preparedAt: new Date().toISOString(),
      };
    });
    scenario = updated.scenario;
    state.scenarioJournal = scenario;
  }

  const transition = scenario.preparedStep.preparedTransition;
  const before = transition.preCheckpoint;
  let current = scenarioCheckpoint();
  let result = null;
  let recovered = stableJson(current) !== stableJson(before);
  const actionOffset = state.actions.length;
  if (!recovered) {
    result = mutate();
    current = scenarioCheckpoint();
  }
  assertPost(before, current, { recovered, result });
  const rawEvidence = recovered
    ? (typeof recoveryEvidence === "function"
      ? recoveryEvidence(before, current)
      : recoveryEvidence)
    : scenarioOperationEvidence(state.actions.slice(actionOffset));
  const evidence = rawEvidence.map((item) => ({
    ...item,
    ...(recovered && !item.detail
      ? { detail: `recovered exact ${stepID}/${transitionID} post-state from write-ahead intent` }
      : {}),
    transitionID: item.transitionID ?? `${stepID}/${transitionID}`,
  }));
  const updated = updateOperationJournal((journal) => {
    const step = journal.scenario?.preparedStep;
    check(
      step?.id === stepID && step.preparedTransition?.id === transitionID,
      `${stepID}/${transitionID}: nested-transition write-ahead intent disappeared`,
    );
    check(
      stableJson(step.preparedTransition.preCheckpoint) === stableJson(before),
      `${stepID}/${transitionID}: nested-transition pre-checkpoint changed`,
    );
    step.completedTransitions.push(transitionID);
    step.transitionCheckpoint = current;
    step.preparedTransition = null;
    journal.scenario.operationEvidence.push(...evidence);
    journal.scenario.updatedAt = new Date().toISOString();
  });
  state.scenarioJournal = updated.scenario;
  return { journal: updated.scenario, result, recovered, skipped: false };
}

function completeScenarioJournal() {
  const checkpoint = scenarioCheckpoint();
  const journal = updateOperationJournal((current) => {
    const scenario = current.scenario;
    check(scenario?.version === SCENARIO_VERSION, "hx-web scenario journal is missing at completion");
    check(scenario.completedSteps.length === SCENARIO_STEPS.length, "hx-web scenario cannot complete before every step");
    scenario.state = "completed";
    scenario.checkpoint = checkpoint;
    const finalCheckpoint = scenario.checkpoints.find((item) => item.id === "final-normalized");
    if (finalCheckpoint) finalCheckpoint.facts = checkpoint;
    else scenario.checkpoints.push({ id: "final-normalized", facts: checkpoint });
    scenario.completedAt ??= new Date().toISOString();
  });
  return journal.scenario;
}

function scenarioCheckpoint() {
  const spaces = ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)];
  const liveSpaces = readSpaces();
  const units = [];
  for (const space of spaces) {
    for (const unit of readUnitRows(space).sort((left, right) => left.Slug.localeCompare(right.Slug))) {
      units.push({
        ref: `${space}/${unit.Slug}`,
        id: unit.UnitID,
        headRevisionNum: unit.HeadRevisionNum,
        lastAppliedRevisionNum: unit.LastAppliedRevisionNum,
        dataHash: unit.DataHash,
        targetID: unit.TargetID ?? null,
        upstreamUnitID: unit.UpstreamUnitID ?? null,
        toolchain: unit.ToolchainType,
        provider: unit.ProviderType ?? null,
        ownedLabels: Object.fromEntries([...OWNED_UNIT_LABELS]
          .filter((key) => unit.Labels?.[key] !== undefined)
          .sort()
          .map((key) => [key, unit.Labels[key]])),
        ownedAnnotations: Object.fromEntries([...OWNED_PUBLIC_ANNOTATIONS]
          .filter((key) => unit.Annotations?.[key] !== undefined)
          .sort()
          .map((key) => [key, unit.Annotations[key]])),
        deleteGates: unit.DeleteGates ?? {},
        destroyGates: unit.DestroyGates ?? {},
        approvalCount: approvalCount(unit.ApprovedBy),
        applyGates: unit.ApplyGates ?? {},
      });
    }
  }
  const releases = FLEET.map((item) => {
    const space = `hx-web-${item.suffix}`;
    const release = latestRelease(space);
    return {
      space,
      releaseNum: release?.ReleaseNum ?? null,
      bundleDigest: release?.Digest ?? null,
      manifestDigest: release?.ManifestDigest ?? null,
    };
  });
  const upgradeLinks = FLEET.flatMap((item) => readLinks(`hx-web-${item.suffix}`)
    .filter((link) => link.UpdateType === "UpgradeUnit")
    .map((link) => ({
      ref: `hx-web-${item.suffix}/${link.Slug}`,
      id: link.LinkID,
      fromUnitID: link.FromUnitID,
      toUnitID: link.ToUnitID,
      toSpaceID: link.ToSpaceID,
      updateType: link.UpdateType,
      autoUpdate: link.AutoUpdate === true,
      upstreamLastMergedRevisionNum: link.UpstreamLastMergedRevisionNum,
      downstreamLastMergedRevisionNum: link.DownstreamLastMergedRevisionNum,
    }))).sort((left, right) => left.ref.localeCompare(right.ref));
  return {
    sourceFingerprint: scenarioSourceFingerprint(),
    units,
    releases,
    upgradeLinks,
    spaceMarkers: spaces.map((slug) => ({
      slug,
      scenarioVersion: liveSpaces.get(slug)?.Labels?.ScenarioVersion ?? null,
    })),
  };
}

function assertScenarioCheckpoint(expected) {
  check(
    stableJson(scenarioCheckpoint()) === stableJson(expected),
    "hx-web live Unit heads, approvals, data hashes, releases, or UpgradeUnit merge bases changed after the last durable scenario checkpoint",
  );
}

// Preliminary ownership check only. This never authorizes a resumed mutation;
// each prepared nested transition below must still prove its exact full pre or
// reviewed post checkpoint before it can advance the journal.
function assertScenarioRecoveryIdentity(expected) {
  const current = scenarioCheckpoint();
  const immutableUnits = (facts) => facts.units.map((unit) => ({
    ref: unit.ref,
    id: unit.id,
    targetID: unit.targetID,
    upstreamUnitID: unit.upstreamUnitID,
    toolchain: unit.toolchain,
    provider: unit.provider,
    ownedLabels: unit.ownedLabels,
  }));
  const immutableLinks = (facts) => facts.upgradeLinks.map((link) => ({
    ref: link.ref,
    id: link.id,
    fromUnitID: link.fromUnitID,
    toUnitID: link.toUnitID,
    toSpaceID: link.toSpaceID,
    updateType: link.updateType,
    autoUpdate: link.autoUpdate,
  }));
  check(
    stableJson(immutableUnits(current)) === stableJson(immutableUnits(expected))
      && stableJson(immutableLinks(current)) === stableJson(immutableLinks(expected)),
    "hx-web immutable Unit identity, target, lineage, labels, or UpgradeUnit endpoints changed during a prepared scenario step",
  );
}

function scenarioCheckpointMaps(checkpoint) {
  return {
    units: new Map(checkpoint.units.map((item) => [item.ref, item])),
    releases: new Map(checkpoint.releases.map((item) => [item.space, item])),
    links: new Map(checkpoint.upgradeLinks.map((item) => [item.ref, item])),
    markers: new Map((checkpoint.spaceMarkers ?? []).map((item) => [item.slug, item])),
  };
}

function approvalEvidenceFromCheckpoints(before, after, space) {
  const left = scenarioCheckpointMaps(before).units;
  const right = scenarioCheckpointMaps(after).units;
  const approvedHeads = before.units
    .filter((item) => item.ref.startsWith(`${space}/`) && checkpointHasApprovalGate(item))
    .map((item) => {
      const current = right.get(item.ref);
      return {
        ref: item.ref,
        id: item.id,
        headRevisionNum: item.headRevisionNum,
        dataHash: item.dataHash,
        approvalCountBefore: item.approvalCount,
        approvalCountAfter: current?.approvalCount,
      };
    })
    .sort((leftItem, rightItem) => leftItem.ref.localeCompare(rightItem.ref));
  return { type: "unit-approve", ref: space, approvedHeads };
}

function rollbackEvidenceFromUnits(source, result, restored) {
  return {
    type: "rollback",
    ref: source.ref,
    unitID: source.id,
    restoredRevisionNum: restored.headRevisionNum,
    restoredDataHash: restored.dataHash,
    sourceHeadRevisionNum: source.headRevisionNum,
    sourceDataHash: source.dataHash,
    resultHeadRevisionNum: result.headRevisionNum,
    resultDataHash: result.dataHash,
  };
}

function scenarioOperationProofValid(scenario) {
  try {
    const checkpoints = new Map(
      (scenario?.checkpoints ?? []).map((item) => [item.id, item.facts]),
    );
    const initial = checkpoints.get("initial-rollout");
    const approved = checkpoints.get("prod-approval");
    const rolledBack = checkpoints.get("prod-a-rollback");
    if (!initial || !approved || !rolledBack) return false;
    const initialUnits = scenarioCheckpointMaps(initial).units;
    const approvedUnits = scenarioCheckpointMaps(approved).units;
    const rolledBackUnits = scenarioCheckpointMaps(rolledBack).units;
    const evidence = scenario?.operationEvidence ?? [];
    const headIdentity = (item) => ({
      ref: item.ref,
      id: item.id,
      headRevisionNum: Number(item.headRevisionNum),
      dataHash: item.dataHash,
    });

    for (const space of ["hx-web-prod-a", "hx-web-prod-b"]) {
      const refusal = evidence.find(
        (item) => item.type === "expected-approval-block"
          && item.ref === space
          && item.transitionID === `base-promotion/${space}-approval-refusal`,
      );
      const approval = evidence.find(
        (item) => item.type === "unit-approve"
          && item.ref === space
          && item.transitionID === `prod-approval/${space}-approve-v1`,
      );
      if (!refusal?.refusedHeads?.length || !approval?.approvedHeads?.length) return false;
      const refusedHeads = refusal.refusedHeads.map(headIdentity).sort((a, b) => a.ref.localeCompare(b.ref));
      const approvedHeads = approval.approvedHeads.map(headIdentity).sort((a, b) => a.ref.localeCompare(b.ref));
      if (stableJson(approvedHeads) !== stableJson(refusedHeads)) return false;
      for (const item of approval.approvedHeads) {
        const checkpointUnit = approvedUnits.get(item.ref);
        if (
          !checkpointUnit
            || checkpointUnit.id !== item.id
            || Number(checkpointUnit.headRevisionNum) !== Number(item.headRevisionNum)
            || checkpointUnit.dataHash !== item.dataHash
            || Number(item.approvalCountAfter) !== Number(item.approvalCountBefore) + 1
            || Number(checkpointUnit.approvalCount) !== Number(item.approvalCountAfter)
            || checkpointHasApprovalGate(checkpointUnit)
        ) return false;
      }
    }

    const ref = "hx-web-prod-a/hx-web-deployment";
    const rollback = evidence.find(
      (item) => item.type === "rollback"
        && item.ref === ref
        && item.transitionID === "prod-a-rollback/prod-a-restore-previous",
    );
    const initialUnit = initialUnits.get(ref);
    const sourceUnit = approvedUnits.get(ref);
    const finalUnit = rolledBackUnits.get(ref);
    if (!rollback || !initialUnit || !sourceUnit || !finalUnit) return false;
    return rollback.unitID === initialUnit.id
      && rollback.unitID === sourceUnit.id
      && rollback.unitID === finalUnit.id
      && Number(rollback.restoredRevisionNum) === Number(initialUnit.headRevisionNum)
      && rollback.restoredDataHash === initialUnit.dataHash
      && Number(rollback.sourceHeadRevisionNum) === Number(sourceUnit.headRevisionNum)
      && rollback.sourceDataHash === sourceUnit.dataHash
      && Number(rollback.resultHeadRevisionNum) === Number(rollback.sourceHeadRevisionNum) + 1
      && rollback.resultDataHash === rollback.restoredDataHash
      && Number(finalUnit.headRevisionNum) >= Number(rollback.resultHeadRevisionNum)
      && Number(finalUnit.headRevisionNum) <= Number(rollback.resultHeadRevisionNum) + 1
      && finalUnit.dataHash === rollback.resultDataHash;
  } catch {
    return false;
  }
}

function assertScenarioDeltaScope(
  before,
  after,
  { unitRefs = [], releaseSpaces = [], linkRefs = [], markerSpaces = [] } = {},
) {
  check(after.sourceFingerprint === before.sourceFingerprint, "hx-web scenario source fingerprint changed inside a transition");
  const left = scenarioCheckpointMaps(before);
  const right = scenarioCheckpointMaps(after);
  for (const [kind, allowedValues] of [
    ["units", unitRefs],
    ["releases", releaseSpaces],
    ["links", linkRefs],
    ["markers", markerSpaces],
  ]) {
    const allowed = new Set(allowedValues);
    check(
      stableJson([...left[kind].keys()]) === stableJson([...right[kind].keys()]),
      `hx-web ${kind} inventory changed inside a prepared transition`,
    );
    for (const [ref, expected] of left[kind]) {
      if (allowed.has(ref)) continue;
      check(
        stableJson(right[kind].get(ref)) === stableJson(expected),
        `${ref}: changed outside the prepared hx-web transition scope`,
      );
    }
  }
}

function assertScenarioMarkerPost(before, after, space) {
  assertScenarioDeltaScope(before, after, { markerSpaces: [space] });
  const prior = scenarioCheckpointMaps(before).markers.get(space);
  const current = scenarioCheckpointMaps(after).markers.get(space);
  check(prior && current, `${space}: scenario marker checkpoint is missing`);
  check(current.scenarioVersion === SCENARIO_VERSION, `${space}: scenario marker was not set to ${SCENARIO_VERSION}`);
}

function scenarioUnitImmutable(row) {
  return {
    ref: row.ref,
    id: row.id,
    targetID: row.targetID,
    upstreamUnitID: row.upstreamUnitID,
    toolchain: row.toolchain,
    provider: row.provider,
    ownedLabels: row.ownedLabels,
    deleteGates: row.deleteGates,
    destroyGates: row.destroyGates,
  };
}

function checkpointHasApprovalGate(unit) {
  return Object.keys(unit?.applyGates ?? {}).some(
    (key) => key.includes("require-approval") || key === APPROVAL_GATE,
  );
}

function assertScenarioUnitIdentity(before, after) {
  check(
    stableJson(scenarioUnitImmutable(after)) === stableJson(scenarioUnitImmutable(before)),
    `${before.ref}: immutable Unit identity changed inside a prepared hx-web transition`,
  );
}

function expectedOwnedAnnotations(expected, payloadKey) {
  const payload = inputs.payloads.get(payloadKey);
  check(payload, `${expected.space}/${expected.slug}: missing reviewed payload ${payloadKey}`);
  const annotations = {
    ...sourceAnnotation(payload.value, payload.sourcePaths, payload.transform),
    ...(expected.annotations ?? {}),
  };
  return Object.fromEntries([...OWNED_PUBLIC_ANNOTATIONS]
    .filter((key) => annotations[key] !== undefined)
    .sort()
    .map((key) => [key, annotations[key]]));
}

function scenarioExpectedUnit(space, slug) {
  const expected = plan.managedUnits.find((item) => item.space === space && item.slug === slug);
  check(expected, `${space}/${slug}: missing planned hx-web Unit`);
  return expected;
}

function assertScenarioUpsertPost(before, after, space, slug, payloadKey) {
  const ref = `${space}/${slug}`;
  assertScenarioDeltaScope(before, after, { unitRefs: [ref] });
  const left = scenarioCheckpointMaps(before).units.get(ref);
  const right = scenarioCheckpointMaps(after).units.get(ref);
  assertScenarioUnitIdentity(left, right);
  const delta = Number(right.headRevisionNum) - Number(left.headRevisionNum);
  check(delta >= 0 && delta <= 1, `${ref}: atomic reviewed upsert advanced the head by ${delta}, expected at most one exact revision`);
  check(right.lastAppliedRevisionNum === left.lastAppliedRevisionNum, `${ref}: upsert changed the applied revision before publication`);
  const expected = scenarioExpectedUnit(space, slug);
  assertManagedSourceUnitContract(expected, payloadKey);
  check(
    stableJson(right.ownedAnnotations) === stableJson(expectedOwnedAnnotations(expected, payloadKey)),
    `${ref}: checkpointed provenance does not match ${payloadKey}`,
  );
  if (delta === 0) {
    for (const key of ["dataHash", "approvalCount", "applyGates"]) {
      check(stableJson(right[key]) === stableJson(left[key]), `${ref}: ${key} changed during a zero-head-delta upsert`);
    }
  } else if (expected.prodProtected) {
    check(
      right.approvalCount === 0 && checkpointHasApprovalGate(right),
      `${ref}: new production head is not bound to its approval gate`,
    );
  } else {
    check(
      right.approvalCount === 0 && !checkpointHasApprovalGate(right),
      `${ref}: new non-production head gained unexpected approval state`,
    );
  }
}

function assertScenarioPromotionPost(before, after, space, deploymentPayloadKey) {
  const unitRefs = plan.managedUnits.filter((item) => item.space === space).map((item) => `${space}/${item.slug}`);
  const linkRefs = readLinks(space)
    .filter((item) => item.UpdateType === "UpgradeUnit")
    .map((item) => `${space}/${item.Slug}`);
  assertScenarioDeltaScope(before, after, { unitRefs, linkRefs });
  const left = scenarioCheckpointMaps(before);
  const right = scenarioCheckpointMaps(after);
  assertHxWebSpacePayloads(inputs, plan, space, deploymentPayloadKey);
  for (const ref of unitRefs) {
    const prior = left.units.get(ref);
    const current = right.units.get(ref);
    assertScenarioUnitIdentity(prior, current);
    const delta = Number(current.headRevisionNum) - Number(prior.headRevisionNum);
    check(delta >= 0 && delta <= 1, `${ref}: one promotion advanced the head by ${delta}, expected zero or one revision`);
    check(current.lastAppliedRevisionNum === prior.lastAppliedRevisionNum, `${ref}: promotion changed the applied revision before publication`);
    if (delta === 0) {
      check(
        stableJson(current) === stableJson(prior),
        `${ref}: promotion changed Unit facts without advancing the head`,
      );
    }
  }
  const unitsByID = new Map(after.units.map((item) => [item.id, item]));
  for (const ref of linkRefs) {
    const prior = left.links.get(ref);
    const current = right.links.get(ref);
    check(prior && current, `${ref}: UpgradeUnit Link disappeared during promotion`);
    const immutable = (item) => ({
      ref: item.ref,
      id: item.id,
      fromUnitID: item.fromUnitID,
      toUnitID: item.toUnitID,
      toSpaceID: item.toSpaceID,
      updateType: item.updateType,
      autoUpdate: item.autoUpdate,
    });
    check(stableJson(immutable(current)) === stableJson(immutable(prior)), `${ref}: UpgradeUnit identity changed during promotion`);
    check(
      current.upstreamLastMergedRevisionNum === unitsByID.get(current.toUnitID)?.headRevisionNum
        && current.downstreamLastMergedRevisionNum === unitsByID.get(current.fromUnitID)?.headRevisionNum,
      `${ref}: promotion did not bind the merge base to the exact post-promotion heads`,
    );
  }
}

function assertScenarioApprovalPost(before, after, space, { allowNoop = false } = {}) {
  const unitRefs = before.units.filter((item) => item.ref.startsWith(`${space}/`)).map((item) => item.ref);
  assertScenarioDeltaScope(before, after, { unitRefs });
  const left = scenarioCheckpointMaps(before).units;
  const right = scenarioCheckpointMaps(after).units;
  let approved = 0;
  for (const ref of unitRefs) {
    const prior = left.get(ref);
    const current = right.get(ref);
    assertScenarioUnitIdentity(prior, current);
    for (const key of ["headRevisionNum", "lastAppliedRevisionNum", "dataHash", "ownedAnnotations"]) {
      check(stableJson(current[key]) === stableJson(prior[key]), `${ref}: ${key} changed during approval`);
    }
    if (checkpointHasApprovalGate(prior)) {
      check(!checkpointHasApprovalGate(current), `${ref}: approval gate remains after exact-head approval`);
      check(current.approvalCount === prior.approvalCount + 1, `${ref}: approval count did not advance exactly once`);
      approved += 1;
    } else {
      check(stableJson(current) === stableJson(prior), `${ref}: ungated Unit changed during approval`);
    }
  }
  check(approved > 0 || (allowNoop && stableJson(after) === stableJson(before)), `${space}: approval transition had no exact gated heads`);
}

function assertScenarioReleasePost(before, after, space, sourcePayloadKeys) {
  const unitRefs = before.units.filter((item) => item.ref.startsWith(`${space}/`)).map((item) => item.ref);
  assertScenarioDeltaScope(before, after, { unitRefs, releaseSpaces: [space] });
  const left = scenarioCheckpointMaps(before);
  const right = scenarioCheckpointMaps(after);
  const hadUnreleasedHeads = unitRefs.some((ref) => {
    const unit = left.units.get(ref);
    return Number(unit.headRevisionNum) !== Number(unit.lastAppliedRevisionNum);
  });
  for (const ref of unitRefs) {
    const prior = left.units.get(ref);
    const current = right.units.get(ref);
    assertScenarioUnitIdentity(prior, current);
    for (const key of ["headRevisionNum", "dataHash", "ownedAnnotations", "approvalCount", "applyGates"]) {
      check(stableJson(current[key]) === stableJson(prior[key]), `${ref}: ${key} changed during publication`);
    }
    check(current.lastAppliedRevisionNum === current.headRevisionNum, `${ref}: publication did not apply the exact current head`);
  }
  const priorRelease = left.releases.get(space);
  const currentRelease = right.releases.get(space);
  if (hadUnreleasedHeads || !priorRelease.releaseNum) {
    check(
      Number(currentRelease.releaseNum) === Number(priorRelease.releaseNum ?? 0) + 1,
      `${space}: publication did not create exactly one next release`,
    );
  } else {
    check(
      stableJson(currentRelease) === stableJson(priorRelease),
      `${space}: reusable publication unexpectedly changed the latest release`,
    );
  }
  check(/^sha256:[0-9a-f]{64}$/.test(currentRelease.bundleDigest ?? ""), `${space}: published bundle digest is invalid`);
  check(/^sha256:[0-9a-f]{64}$/.test(currentRelease.manifestDigest ?? ""), `${space}: published manifest digest is invalid`);
  assertReleaseBoundary(space, { sourcePayloadKeys });
}

function assertScenarioRollbackRestorePost(before, after, restoredRevision) {
  const space = "hx-web-prod-a";
  const slug = "hx-web-deployment";
  const ref = `${space}/${slug}`;
  assertScenarioDeltaScope(before, after, { unitRefs: [ref] });
  const left = scenarioCheckpointMaps(before).units.get(ref);
  const right = scenarioCheckpointMaps(after).units.get(ref);
  assertScenarioUnitIdentity(left, right);
  check(
    restoredRevision?.id === right.id
      && Number.isInteger(restoredRevision.headRevisionNum)
      && restoredRevision.dataHash === right.dataHash,
    `${ref}: rollback result is not bound to the exact initial-rollout revision and data hash`,
  );
  check(Number(right.headRevisionNum) === Number(left.headRevisionNum) + 1, `${ref}: rollback did not create exactly one restore revision`);
  check(right.lastAppliedRevisionNum === left.lastAppliedRevisionNum, `${ref}: rollback changed the applied revision before publication`);
  const expected = scenarioExpectedUnit(space, slug);
  check(
    hxWebUnitMatchesPayload(inputs, space, slug, "hx-web/prod-a/hx-web-deployment/final"),
    `${ref}: rollback data is not the exact reviewed two-replica payload`,
  );
  check(
    stableJson(right.ownedAnnotations) === stableJson(expectedOwnedAnnotations(expected, "hx-web/base/hx-web-deployment/initial")),
    `${ref}: restore did not recover the exact reviewed predecessor provenance`,
  );
  check(right.approvalCount === 0 && checkpointHasApprovalGate(right), `${ref}: restored production head is not awaiting exact-head approval`);
}

function assertScenarioMergeCurrentPost(before, after, linkRef) {
  assertScenarioDeltaScope(before, after, { linkRefs: [linkRef] });
  const left = scenarioCheckpointMaps(before).links.get(linkRef);
  const right = scenarioCheckpointMaps(after).links.get(linkRef);
  check(left && right, `${linkRef}: UpgradeUnit Link is missing`);
  const immutable = (item) => ({
    ref: item.ref,
    id: item.id,
    fromUnitID: item.fromUnitID,
    toUnitID: item.toUnitID,
    toSpaceID: item.toSpaceID,
    updateType: item.updateType,
    autoUpdate: item.autoUpdate,
  });
  check(stableJson(immutable(right)) === stableJson(immutable(left)), `${linkRef}: UpgradeUnit identity changed during make-current`);
  const unitsByID = new Map(after.units.map((item) => [item.id, item]));
  check(
    right.upstreamLastMergedRevisionNum === unitsByID.get(right.toUnitID)?.headRevisionNum
      && right.downstreamLastMergedRevisionNum === unitsByID.get(right.fromUnitID)?.headRevisionNum,
    `${linkRef}: make-current did not bind both exact Unit heads`,
  );
}

function scenarioReceiptProvesHistory() {
  const receipt = readPriorReceipt();
  if (!receipt) return false;
  const scenario = receipt.kind === "ConfigHubKubaraMiniIDPReconcileReceipt"
    ? receipt.spec?.rolloutScenario
    : null;
  if (scenario?.version !== SCENARIO_VERSION) return false;
  if (scenario?.sourceFingerprint !== scenarioSourceFingerprint()) return false;
  if (!["pending-idempotence", "pass"].includes(receipt.status?.result)) return false;
  const runs = receipt.spec?.reconcileRuns ?? [];
  if (!runs.length || !runs.every(
    (run) => run.result === "pass" && run.executionFingerprint === operationExecutionFingerprint(),
  )) return false;
  if (!runs.some((run) => run.idempotentNoop === false && run.actionCount > 0)) return false;
  const spaces = readSpaces();
  if (receipt.spec?.organization?.entityID !== spaces.get(CONTROL_SPACE)?.OrganizationID) return false;
  const receiptSpaces = new Map((receipt.spec?.spaces ?? []).map((space) => [space.slug, space.id]));
  for (const slug of ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)]) {
    if (receiptSpaces.get(slug) !== spaces.get(slug)?.SpaceID) return false;
  }
  for (const [name, evidence] of Object.entries(sourceEvidence())) {
    const stored = receipt.spec?.source?.files?.[name];
    if (stored?.path !== evidence.path || stored?.sha256 !== evidence.sha256) return false;
  }
  const expectedSteps = SCENARIO_STEPS.slice(1);
  return expectedSteps.every((id) => (scenario.steps ?? []).some((item) => item.id === id && item.result === "pass"))
    && scenarioOperationProofValid(scenario);
}

function preflightScenarioHistory(state) {
  const priorReceipt = readPriorReceipt();
  const receiptProven = scenarioReceiptProvesHistory();
  const markerStatus = scenarioMarkerStatus();
  const recoverableJournal = state.scenarioJournal
    && state.scenarioJournal.version === SCENARIO_VERSION
    && ["started", "completed"].includes(state.scenarioJournal.state);
  const reviewedVersionMigration = state.scenarioJournal?.state === "archived";
  check(
    !priorReceipt || receiptProven || recoverableJournal || reviewedVersionMigration,
    "preflight refused an existing hx-web receipt that is not trusted for the current fleet/source",
  );
  check(
    markerStatus.marked.length === 0 || receiptProven || recoverableJournal || reviewedVersionMigration,
    "preflight refused hx-web scenario markers without a trusted receipt or durable recovery journal",
  );
}

function materializeHxWebScenario(inputs, payloadFiles, desired, state) {
  const family = APP_FAMILIES.find((item) => item.prefix === "hx-web");
  const baseSpace = "hx-web-base";
  const baseUnits = desired.managedUnits.filter((item) => item.space === baseSpace);
  const markerStatus = scenarioMarkerStatus();
  const priorReceipt = readPriorReceipt();
  const receiptProven = scenarioReceiptProvesHistory();
  const recoverableJournal = state.scenarioJournal
    && state.scenarioJournal.version === SCENARIO_VERSION
    && ["started", "completed"].includes(state.scenarioJournal.state);
  const reviewedVersionMigration = state.scenarioJournal?.state === "archived";
  check(
    markerStatus.marked.length === 0 || markerStatus.complete || receiptProven || recoverableJournal || reviewedVersionMigration,
    `partial hx-web scenario markers found in ${markerStatus.marked.join(", ")}; refusing history replay`,
  );
  const alreadyProven = receiptProven;
  check(
    !priorReceipt || alreadyProven || recoverableJournal || reviewedVersionMigration,
    "an existing hx-web receipt is not trusted for the current fleet/source and no durable recovery journal exists",
  );
  check(
    markerStatus.marked.length === 0 || alreadyProven || recoverableJournal || reviewedVersionMigration,
    "hx-web scenario markers exist without a trusted atomic receipt or durable journal; refusing destructive history replay",
  );
  const preserveJournalState = Boolean(recoverableJournal && !alreadyProven);
  if (preserveJournalState) {
    if (state.scenarioJournal.preparedStep) {
      assertScenarioRecoveryIdentity(state.scenarioJournal.preparedStep.preCheckpoint);
    } else assertScenarioCheckpoint(state.scenarioJournal.checkpoint);
  }

  for (const expected of baseUnits) {
    if (preserveJournalState) {
      check(readUnit(expected.space, expected.slug), `${expected.space}/${expected.slug}: journaled hx-web Unit is missing`);
    } else {
      upsertUnit(expected, inputs, payloadFiles, state, {
        payloadKey: alreadyProven || !expected.initialPayloadKey
          ? expected.payloadKey
          : expected.initialPayloadKey,
      });
    }
  }
  assertUnitAllowlist(baseSpace, family.units.map((item) => item.slug));

  for (let index = 0; index < family.targets.length; index += 1) {
    const fleetItem = family.targets[index];
    const upstreamSpace = index === 0
      ? baseSpace
      : index === 1
        ? "hx-web-dev"
        : "hx-web-staging";
    const space = `hx-web-${fleetItem.suffix}`;
    ensureVariantSpace({
      space,
      upstreamSpace,
      variantName: fleetItem.suffix,
      fleetItem,
      prodProtected: fleetItem.environment === "Prod",
    }, state, { assertOnly: preserveJournalState });
    for (const expected of desired.managedUnits.filter((item) => item.space === space)) {
      if (preserveJournalState) {
        check(readUnit(expected.space, expected.slug), `${expected.space}/${expected.slug}: journaled hx-web Unit is missing`);
      } else {
        upsertUnit(expected, inputs, payloadFiles, state, {
          payloadKey: alreadyProven || !expected.initialPayloadKey
            ? expected.payloadKey
            : expected.initialPayloadKey,
        });
      }
    }
    assertUnitAllowlist(space, family.units.map((item) => item.slug));
    ensureArgoApplication(
      desired.deployments.find((item) => item.space === space),
      state,
      { assertOnly: preserveJournalState },
    );
  }
  return { alreadyProven, journal: state.scenarioJournal };
}

function reconcileHxWebScenario(inputs, payloadFiles, desired, state, scenarioStatus) {
  const baseUnits = desired.managedUnits.filter((item) => item.space === "hx-web-base");
  const { alreadyProven } = scenarioStatus;
  assertManagedLinkInventory(desired);
  if (alreadyProven) {
    state.scenario = {
      mode: "retained-proven-history",
      version: SCENARIO_VERSION,
      steps: verifyHxWebFinalState(inputs),
    };
    for (const deployment of desired.deployments.filter(
      (item) => item.type === "application" && /^hx-web-(dev|staging|prod-a|prod-b)$/.test(item.space),
    )) deployOne(deployment, state);
    reconcileScenarioMarkers(state);
    return;
  }

  let scenarioJournal = state.scenarioJournal?.state === "archived"
    ? beginScenarioJournal()
    : state.scenarioJournal ?? beginScenarioJournal();
  state.scenarioJournal = scenarioJournal;
  state.scenario = {
    mode: scenarioJournal.state === "completed" ? "recovered-completed-history" : "executed",
    version: SCENARIO_VERSION,
    steps: [],
    operationEvidence: [...scenarioJournal.operationEvidence],
  };
  const scenarioStep = (id, operation) => {
    if (scenarioJournal.completedSteps.includes(id)) {
      state.scenario.steps.push({ id, result: "pass", recoveredFromJournal: true });
      return;
    }
    if (scenarioJournal.preparedStep) {
      check(scenarioJournal.preparedStep.id === id, `hx-web prepared step ${scenarioJournal.preparedStep.id} does not match ${id}`);
    } else {
      assertScenarioCheckpoint(scenarioJournal.checkpoint);
      scenarioJournal = prepareScenarioJournalStep(id);
      state.scenarioJournal = scenarioJournal;
    }
    const actionOffset = state.actions.length;
    let transitionCursor = 0;
    const transition = (transitionID, mutate, assertPost, options = {}) => {
      const completed = state.scenarioJournal.preparedStep.completedTransitions;
      if (transitionCursor < completed.length) {
        check(
          completed[transitionCursor] === transitionID,
          `${id}: nested transition order drifted at ${transitionID}; expected ${completed[transitionCursor]}`,
        );
      } else {
        check(
          transitionCursor === completed.length,
          `${id}/${transitionID}: nested transition is not the next exact prefix entry`,
        );
      }
      transitionCursor += 1;
      const outcome = runScenarioTransition(state, id, transitionID, mutate, assertPost, options);
      scenarioJournal = outcome.journal;
      return outcome;
    };
    operation(transition);
    check(
      transitionCursor === state.scenarioJournal.preparedStep.completedTransitions.length,
      `${id}: operation did not replay the complete nested-transition prefix`,
    );
    state.scenario.steps.push({ id, result: "pass" });
    scenarioJournal = recordScenarioJournalStep(id, state.actions.slice(actionOffset));
    state.scenarioJournal = scenarioJournal;
    state.scenario.operationEvidence = [...scenarioJournal.operationEvidence];
  };

  const scenarioDeployments = desired.deployments.filter(
    (item) => item.type === "application" && /^hx-web-(dev|staging|prod-a|prod-b)$/.test(item.space),
  );
  const deploymentFor = (space) => {
    const deployment = scenarioDeployments.find((item) => item.space === space);
    check(deployment, `${space}: hx-web deployment plan is missing`);
    return deployment;
  };
  const assertDeliveryRootReusable = (deployment) => {
    assertReleaseBoundary(deployment.appSpace);
    check(!spaceHasUnreleasedHeads(deployment.appSpace), `${deployment.appSpace}: delivery root changed inside the hx-web scenario`);
    return validatedPublishedRelease(deployment.appSpace, latestRelease(deployment.appSpace), "scenario delivery-root release");
  };
  const scenarioUpsert = (transition, id, space, slug, payloadKey) => transition(
    id,
    () => upsertScenarioUnitAtomically(
      scenarioExpectedUnit(space, slug),
      inputs,
      payloadFiles,
      state,
      payloadKey,
    ),
    (before, after) => assertScenarioUpsertPost(before, after, space, slug, payloadKey),
  );
  const scenarioPromote = (transition, id, space, beforePayloadKey, afterPayloadKey) => transition(
    id,
    () => {
      assertHxWebSpacePayloads(inputs, desired, space, beforePayloadKey);
      cub([
        "variant", "promote", space,
        "--change-desc", `Promote ${SCENARIO_VERSION} while preserving downstream departures`,
        "--quiet",
      ], { timeout: 1_200_000 });
      recordAction(state, "variant-promote", space);
      state.changedSpaces.add(space);
    },
    (before, after) => assertScenarioPromotionPost(before, after, space, afterPayloadKey),
    { recoveryEvidence: [{ type: "variant-promote", ref: space }] },
  );
  const scenarioApprove = (transition, id, space, { allowNoop = false } = {}) => transition(
    id,
    () => approveOutstanding(space, state),
    (before, after) => assertScenarioApprovalPost(before, after, space, { allowNoop }),
    {
      recoveryEvidence: (before, after) => [approvalEvidenceFromCheckpoints(before, after, space)],
    },
  );
  const scenarioPublish = (transition, id, space, deploymentPayloadKey) => {
    const deployment = deploymentFor(space);
    assertDeliveryRootReusable(deployment);
    const sourcePayloadKeys = { "hx-web-deployment": deploymentPayloadKey };
    transition(
      id,
      () => publishRelease(space, state, { sourcePayloadKeys }),
      (before, after) => assertScenarioReleasePost(before, after, space, sourcePayloadKeys),
    );
    const release = validatedPublishedRelease(space, latestRelease(space), "scenario source release");
    convergeDeploymentApplication(deployment, state, releaseManifestDigest(release));
  };
  const assertRefusedHeadsCurrent = (space) => {
    const refusal = state.scenarioJournal.operationEvidence.findLast(
      (item) => item.type === "expected-approval-block" && item.ref === space,
    );
    check(refusal?.refusedHeads?.length > 0, `${space}: exact release-refusal head evidence is missing`);
    const currentByRef = new Map(readUnitRows(space).map((unit) => [`${space}/${unit.Slug}`, unit]));
    for (const refused of refusal.refusedHeads) {
      const current = currentByRef.get(refused.ref);
      check(
        current?.UnitID === refused.id
          && current.HeadRevisionNum === refused.headRevisionNum
          && current.DataHash === refused.dataHash,
        `${refused.ref}: current head is not the exact head refused before approval`,
      );
    }
  };

  scenarioStep("merge-bases-reset", (transition) => {
    for (const fleetItem of FLEET) {
      const space = `hx-web-${fleetItem.suffix}`;
      for (const unit of desired.managedUnits.filter((item) => item.space === space && item.upstream)) {
        const slug = `upgrade-${unit.slug}`;
        const ref = `${space}/${slug}`;
        transition(
          `${fleetItem.suffix}-${slug}`,
          () => {
            cub(["link", "update", slug, "--space", space, "--patch", "--make-current", "--quiet"]);
            recordAction(state, "scenario-merge-base-reset", ref, "baseline heads marked current before deterministic replay");
          },
          (before, after) => assertScenarioMergeCurrentPost(before, after, ref),
        );
      }
    }
  });

  scenarioStep("initial-rollout", (transition) => {
    for (const deployment of scenarioDeployments) {
      const { space } = deployment;
      assertHxWebSpacePayloads(inputs, desired, space, "hx-web/base/hx-web-deployment/initial");
      if (space.includes("prod-")) scenarioApprove(transition, `${space}-approve`, space);
      scenarioPublish(transition, `${space}-publish`, space, "hx-web/base/hx-web-deployment/initial");
    }
  });

  scenarioStep("base-promotion", (transition) => {
    scenarioUpsert(transition, "base-v1", "hx-web-base", "hx-web-deployment", "hx-web/base/hx-web-deployment/v1");
    for (const deployment of scenarioDeployments) {
      const { space } = deployment;
      scenarioPromote(
        transition,
        `${space}-promote-v1`,
        space,
        "hx-web/base/hx-web-deployment/initial",
        "hx-web/base/hx-web-deployment/v1",
      );
      scenarioUpsert(transition, `${space}-v1-provenance`, space, "hx-web-deployment", "hx-web/base/hx-web-deployment/v1");
      if (space.includes("prod-")) {
        const sourcePayloadKeys = { "hx-web-deployment": "hx-web/base/hx-web-deployment/v1" };
        transition(
          `${space}-approval-refusal`,
          () => assertReleaseBlockedByApproval(space, state, sourcePayloadKeys),
          (before, after) => check(
            stableJson(after) === stableJson(before),
            `${space}: expected approval refusal changed live ConfigHub state`,
          ),
        );
      } else {
        scenarioPublish(transition, `${space}-publish-v1`, space, "hx-web/base/hx-web-deployment/v1");
      }
    }
  });

  scenarioStep("prod-approval", (transition) => {
    for (const space of ["hx-web-prod-a", "hx-web-prod-b"]) {
      assertRefusedHeadsCurrent(space);
      scenarioApprove(transition, `${space}-approve-v1`, space);
      scenarioPublish(transition, `${space}-publish-v1`, space, "hx-web/base/hx-web-deployment/v1");
    }
  });

  scenarioStep("prod-a-rollback", (transition) => {
    const space = "hx-web-prod-a";
    const initialCheckpoint = state.scenarioJournal.checkpoints.find((item) => item.id === "initial-rollout")?.facts;
    const initialDeployment = initialCheckpoint?.units?.find((item) => item.ref === `${space}/hx-web-deployment`);
    check(
      initialDeployment?.id && Number.isInteger(initialDeployment.headRevisionNum),
      "prod-a rollback lacks its durable initial-rollout Unit revision",
    );
    transition(
      "prod-a-restore-previous",
      () => {
        check(
          hxWebUnitMatchesPayload(inputs, space, "hx-web-deployment", "hx-web/base/hx-web-deployment/v1"),
          "prod-a is not the exact reviewed v1 head before restore -1",
        );
        const sourceUnit = readUnit(space, "hx-web-deployment");
        check(sourceUnit, `${space}/hx-web-deployment: rollback source Unit is missing`);
        cub([
          "unit", "update", "--space", space, "hx-web-deployment",
          "--restore", String(initialDeployment.headRevisionNum),
          "--change-desc", "Demonstrate one-production-target rollback",
          "--quiet",
        ]);
        const restoredUnit = readUnit(space, "hx-web-deployment");
        check(restoredUnit, `${space}/hx-web-deployment: restored Unit is missing`);
        state.actions.push({
          ...rollbackEvidenceFromUnits(
            {
              ref: `${space}/hx-web-deployment`,
              id: sourceUnit.UnitID,
              headRevisionNum: sourceUnit.HeadRevisionNum,
              dataHash: sourceUnit.DataHash,
            },
            {
              ref: `${space}/hx-web-deployment`,
              id: restoredUnit.UnitID,
              headRevisionNum: restoredUnit.HeadRevisionNum,
              dataHash: restoredUnit.DataHash,
            },
            initialDeployment,
          ),
          detail: `restore exact initial-rollout revision ${initialDeployment.headRevisionNum} from reviewed v1 head`,
        });
        state.changedSpaces.add(space);
      },
      (before, after) => assertScenarioRollbackRestorePost(before, after, initialDeployment),
      {
        recoveryEvidence: (before, after) => {
          const ref = `${space}/hx-web-deployment`;
          return [rollbackEvidenceFromUnits(
            scenarioCheckpointMaps(before).units.get(ref),
            scenarioCheckpointMaps(after).units.get(ref),
            initialDeployment,
          )];
        },
      },
    );
    scenarioUpsert(
      transition,
      "prod-a-final-provenance",
      space,
      "hx-web-deployment",
      "hx-web/prod-a/hx-web-deployment/final",
    );
    scenarioApprove(transition, "prod-a-approve-rollback", space);
    scenarioPublish(transition, "prod-a-publish-rollback", space, "hx-web/prod-a/hx-web-deployment/final");
    const docs = parseDocs(cub(["unit", "data", "--space", space, "hx-web-deployment"]));
    check(docs.find((doc) => doc.kind === "Deployment")?.spec?.replicas === 2, "prod-a rollback did not restore two replicas");
  });

  scenarioStep("staging-departure", (transition) => {
    scenarioUpsert(
      transition,
      "staging-sandbox-departure",
      "hx-web-staging",
      "hx-web-deployment",
      "hx-web/staging/hx-web-deployment/departure",
    );
    scenarioPublish(
      transition,
      "staging-publish-departure",
      "hx-web-staging",
      "hx-web/staging/hx-web-deployment/departure",
    );
  });

  scenarioStep("departure-survives-promotion", (transition) => {
    scenarioUpsert(transition, "base-v2", "hx-web-base", "hx-web-deployment", "hx-web/base/hx-web-deployment/v2");
    for (const [space, beforePayloadKey, finalPayloadKey] of [
      ["hx-web-dev", "hx-web/base/hx-web-deployment/v1", "hx-web/dev/hx-web-deployment/final"],
      ["hx-web-staging", "hx-web/staging/hx-web-deployment/departure", "hx-web/staging/hx-web-deployment/final"],
    ]) {
      scenarioPromote(transition, `${space}-promote-v2`, space, beforePayloadKey, finalPayloadKey);
      scenarioUpsert(transition, `${space}-final-provenance`, space, "hx-web-deployment", finalPayloadKey);
      scenarioPublish(transition, `${space}-publish-final`, space, finalPayloadKey);
    }
    const finalSteps = verifyHxWebFinalState(inputs);
    check(finalSteps.every((item) => item.result === "pass"), "hx-web final scenario verification failed");

    // The promotion transitions prove merge behavior before normalization.
    // Normalize every committed provenance field through individually
    // checkpointed transitions, then publish/reconcile the exact final state.
    for (const expected of desired.managedUnits.filter(
      (item) => item.space === "hx-web-base" || /^hx-web-(dev|staging|prod-a|prod-b)$/.test(item.space),
    )) {
      scenarioUpsert(
        transition,
        `final-normalize-${expected.space}-${expected.slug}`,
        expected.space,
        expected.slug,
        expected.payloadKey,
      );
    }
    for (const deployment of scenarioDeployments) {
      if (deployment.space.includes("prod-")) {
        scenarioApprove(transition, `final-approve-${deployment.space}`, deployment.space, { allowNoop: true });
      }
      scenarioPublish(
        transition,
        `final-publish-${deployment.space}`,
        deployment.space,
        `hx-web/${deployment.space.slice("hx-web-".length)}/hx-web-deployment/final`,
      );
    }
    verifyHxWebFinalState(inputs);
    for (const space of ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)]) {
      transition(
        `scenario-marker-${space}`,
        () => {
          const live = readSpaces().get(space);
          if (live?.Labels?.ScenarioVersion === SCENARIO_VERSION) return;
          cub(["space", "update", "--patch", space, "--label", `ScenarioVersion=${SCENARIO_VERSION}`, "--quiet"]);
          recordAction(state, "scenario-marker", space, SCENARIO_VERSION);
        },
        (before, after) => assertScenarioMarkerPost(before, after, space),
      );
    }
  });

  scenarioJournal = completeScenarioJournal();
  state.scenarioJournal = scenarioJournal;
  state.scenario.operationEvidence = [...scenarioJournal.operationEvidence];
}

function reconcileScenarioMarkers(state) {
  const markedSpaces = readSpaces();
  for (const slug of ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)]) {
    if (markedSpaces.get(slug)?.Labels?.ScenarioVersion === SCENARIO_VERSION) continue;
    cub(["space", "update", "--patch", slug, "--label", `ScenarioVersion=${SCENARIO_VERSION}`, "--quiet"]);
    recordAction(state, "scenario-marker", slug, SCENARIO_VERSION);
  }
}

function hxWebUnitMatchesPayload(inputs, space, slug, payloadKey) {
  const payload = inputs.payloads.get(payloadKey);
  check(payload, `${space}/${slug}: reviewed hx-web payload ${payloadKey} is missing`);
  return sameUnitData(
    "Kubernetes/YAML",
    cub(["unit", "data", "--space", space, slug]),
    payload.value,
  );
}

function assertHxWebSpacePayloads(inputs, desired, space, deploymentPayloadKey) {
  for (const expected of desired.managedUnits.filter((item) => item.space === space)) {
    const payloadKey = expected.slug === "hx-web-deployment"
      ? deploymentPayloadKey
      : expected.payloadKey;
    check(
      hxWebUnitMatchesPayload(inputs, space, expected.slug, payloadKey),
      `${space}/${expected.slug}: live data is not the exact reviewed payload ${payloadKey}`,
    );
  }
}

function assertReleaseBlockedByApproval(space, state, sourcePayloadKeys = {}) {
  assertReleaseBoundary(space, { sourcePayloadKeys, approvalMode: "required" });
  const refusedHeads = readUnitRows(space)
    .filter(hasApprovalGate)
    .map((unit) => ({
      ref: `${space}/${unit.Slug}`,
      id: unit.UnitID,
      headRevisionNum: unit.HeadRevisionNum,
      dataHash: unit.DataHash,
    }))
    .sort((left, right) => left.ref.localeCompare(right.ref));
  check(refusedHeads.length > 0, `${space}: no exact gated heads exist before expected release refusal`);
  const result = cubTry(["release", "publish", space, "-o", "json"], { timeout: 1_200_000 });
  check(!result.ok, `${space}: production release unexpectedly published before approval`);
  check(
    /approval|apply.?gate|vet-approvedby/i.test(result.output),
    `${space}: release failed before approval without naming an approval gate: ${result.output.slice(0, 800)}`,
  );
  state.actions.push({
    type: "expected-approval-block",
    ref: space,
    detail: result.output.slice(0, 500),
    refusedHeads,
  });
}

function verifyHxWebFinalState(inputs) {
  const checks = [];
  const expectedBase = inputs.payloads.get("hx-web/base/hx-web-deployment/v2").value;
  const baseData = cub(["unit", "data", "--space", "hx-web-base", "hx-web-deployment"]);
  checks.push({
    id: "base-at-promotion-v2",
    result: sameUnitData("Kubernetes/YAML", baseData, expectedBase) ? "pass" : "fail",
  });
  for (const item of FLEET) {
    const space = `hx-web-${item.suffix}`;
    const actual = cub(["unit", "data", "--space", space, "hx-web-deployment"]);
    const expected = inputs.payloads.get(`hx-web/${item.suffix}/hx-web-deployment/final`).value;
    checks.push({
      id: `${item.suffix}-final-state`,
      result: sameUnitData("Kubernetes/YAML", actual, expected) ? "pass" : "fail",
      departure: item.suffix === "staging"
        ? "SANDBOX_URL"
        : item.suffix === "prod-a"
          ? "replicas=2 rollback"
          : "none",
    });
  }
  check(checks.every((item) => item.result === "pass"), `hx-web final scenario drift:\n${stableJson(checks)}`);
  return checks;
}

function approveOutstanding(space, state) {
  const rows = readUnitRows(space);
  const outstanding = rows.filter(hasApprovalGate);
  if (outstanding.length === 0) return;
  cub([
    "unit", "approve", "--space", space,
    ...outstanding.flatMap((unit) => ["--unit", unit.Slug]),
    "--revision", "HeadRevisionNum",
    "--wait", "--quiet",
  ]);
  const after = readUnitRows(space);
  const outstandingSlugs = new Set(outstanding.map((unit) => unit.Slug));
  check(after.filter((unit) => outstandingSlugs.has(unit.Slug)).every((unit) => !hasApprovalGate(unit)), `${space}: approval gate remained after approval`);
  const afterBySlug = new Map(after.map((unit) => [unit.Slug, unit]));
  state.actions.push({
    type: "unit-approve",
    ref: space,
    detail: `${outstanding.length} Unit(s)`,
    approvedHeads: outstanding.map((unit) => {
      const current = afterBySlug.get(unit.Slug);
      check(current?.UnitID === unit.UnitID, `${space}/${unit.Slug}: Unit identity changed during approval`);
      return {
        ref: `${space}/${unit.Slug}`,
        id: unit.UnitID,
        headRevisionNum: unit.HeadRevisionNum,
        dataHash: unit.DataHash,
        approvalCountBefore: approvalCount(unit.ApprovedBy),
        approvalCountAfter: approvalCount(current.ApprovedBy),
      };
    }).sort((left, right) => left.ref.localeCompare(right.ref)),
  });
}

function hasApprovalGate(unit) {
  return Object.keys(unit?.ApplyGates ?? {}).some(
    (key) => key.includes("require-approval") || key === APPROVAL_GATE,
  );
}

function approvalCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value ? 1 : 0;
}

function deployOne(deployment, state, { sourcePayloadKeys = {} } = {}) {
  ensureDeliveryRootPublished(deployment, state);
  if (deployment.space.includes("prod-")) approveOutstanding(deployment.space, state);
  const release = publishRelease(deployment.space, state, { sourcePayloadKeys });
  if (state.performancePhases.length === 0) {
    state.performancePhases.push(
      performancePhaseEvidence("apply-start-to-first-argo-convergence", state.performancePhaseStart),
    );
  }
  convergeDeploymentApplication(deployment, state, releaseManifestDigest(release));
}

function ensureDeliveryRootPublished(deployment, state) {
  if (state.deliveryRootReleases.has(deployment.cluster)) return;
  const release = publishDeliveryRoot(deployment, state);
  state.deliveryRootReleases.set(deployment.cluster, validatedPublishedRelease(
    deployment.appSpace,
    release,
    "cluster delivery-root release",
  ));
}

function assertPublishedDeliveryRootsRemainCurrent(state) {
  for (const fleetItem of FLEET) {
    const appSpace = `${fleetItem.cluster}-argo-apps`;
    check(state.deliveryRootReleases.has(fleetItem.cluster), `${fleetItem.cluster}: delivery-root release evidence is missing`);
    check(!spaceHasUnreleasedHeads(appSpace), `${appSpace}: Application metadata changed after the one cluster-root publication`);
  }
}

function publishDeliveryRoot(deployment, state) {
  let bootstrap = state.fleetBootstrapJournal;
  if (bootstrap?.state !== "started" || bootstrap.rootActivatedClusters.includes(deployment.cluster)) {
    return publishRelease(deployment.appSpace, state);
  }
  const expectedCluster = bootstrap.expectedClusters[bootstrap.rootActivatedClusters.length];
  check(
    expectedCluster === deployment.cluster,
    `${deployment.cluster}: first delivery-root activation is out of order; expected ${expectedCluster ?? "none"}`,
  );
  const sourceSpaces = plan.deployments
    .filter((item) => item.cluster === deployment.cluster)
    .map((item) => item.space)
    .filter((slug, index, all) => all.indexOf(slug) === index)
    .sort();
  const liveSpaces = readSpaces();
  for (const slug of sourceSpaces) {
    check(liveSpaces.has(slug), `${deployment.cluster}: source Space ${slug} is missing before first root activation`);
    check(
      !hasRelease(slug),
      `${deployment.cluster}: refusing first root activation because ${slug} already has a published :latest`,
    );
  }
  if (!bootstrap.preparedRootCluster) {
    check(
      !hasRelease(deployment.appSpace),
      `${deployment.appSpace}: unjournaled delivery-root release exists before first activation`,
    );
    bootstrap = prepareFleetRootActivation(deployment.cluster);
    state.fleetBootstrapJournal = bootstrap;
  } else {
    check(
      bootstrap.preparedRootCluster === deployment.cluster,
      `${deployment.cluster}: another first root activation is prepared: ${bootstrap.preparedRootCluster}`,
    );
  }
  const release = publishRelease(deployment.appSpace, state);
  bootstrap = checkpointFleetRootActivation(deployment.cluster, release);
  state.fleetBootstrapJournal = bootstrap;
  recordAction(state, "fleet-root-activate", deployment.appSpace, `manifest=${releaseManifestDigest(release)}`);
  return release;
}

function kubernetesResourceNotFound(output) {
  return /Error from server \(NotFound\):[\s\S]+\bnot found\b/i.test(String(output ?? ""));
}

function readLiveArgoApplication(deployment, { allowNotFound = false } = {}) {
  const result = kubectlTry(deployment.cluster, [
    "get", "application", deployment.space, "-n", "argocd", "-o", "json",
  ]);
  if (!result.ok && allowNotFound && kubernetesResourceNotFound(result.output)) return null;
  check(result.ok, `${deployment.cluster}/${deployment.space}: Argo Application is unavailable before sync`);
  return JSON.parse(result.output);
}

function waitForArgoApplicationContract(deployment) {
  let app = null;
  let contractError = "Application not observed";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    app = readLiveArgoApplication(deployment, { allowNotFound: true });
    if (!app) {
      command("sleep", ["2"]);
      continue;
    }
    try {
      assertArgoApplicationContract(app, deployment);
      return app;
    } catch (error) {
      contractError = error.message;
      command("sleep", ["2"]);
    }
  }
  check(false, `${deployment.cluster}/${deployment.space}: live Argo Application contract did not converge: ${contractError}`);
}

function deploymentApplicationAccepted(app, deployment, expectedRevision) {
  return app.status?.sync?.status === "Synced"
    && deployment.acceptedHealth.includes(app.status?.health?.status ?? "Unknown")
    && app.status?.sync?.revision === expectedRevision;
}

function argoConvergenceState(app, deployment, expectedRevision) {
  const phase = app.status?.operationState?.phase ?? "Unknown";
  if (app.operation || ["Running", "Terminating"].includes(phase)) return "active-operation";
  if (deploymentApplicationAccepted(app, deployment, expectedRevision)) return "accepted";
  if (
    ["Failed", "Error"].includes(phase)
      && operationStateRevision(app) === expectedRevision
  ) return "retryable";
  if (
    app.status?.sync?.status === "Synced"
      && app.status?.sync?.revision === expectedRevision
  ) return "health-pending";
  return "retryable";
}

function argoObservation(app) {
  return {
    sync: app.status?.sync?.status ?? "Unknown",
    health: app.status?.health?.status ?? "Unknown",
    phase: app.status?.operationState?.phase ?? "Unknown",
    revision: app.status?.sync?.revision ?? "Unknown",
    startedAt: app.status?.operationState?.startedAt ?? null,
    finishedAt: app.status?.operationState?.finishedAt ?? null,
    message: app.status?.operationState?.message
      ?? app.status?.conditions?.map((item) => item.message).join("; ")
      ?? "",
  };
}

function observedTimestamp(value, fallback, observedAt = fallback) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= observedAt
    ? parsed
    : fallback;
}

function operationStateRevision(app) {
  return app.status?.operationState?.syncResult?.revision ?? "";
}

function expectedRevisionTimestamp(app, expectedRevision, field, fallback, observedAt = fallback) {
  const statusRevision = operationStateRevision(app);
  if (statusRevision !== expectedRevision) return fallback;
  return observedTimestamp(app.status?.operationState?.[field], fallback, observedAt);
}

function convergencePhaseStartedAt(app, expectedRevision, field, firstObservedAt, previousStartedAt, observedAt) {
  const controllerStartedAt = expectedRevisionTimestamp(
    app,
    expectedRevision,
    field,
    firstObservedAt,
    observedAt,
  );
  return Math.max(firstObservedAt, previousStartedAt ?? firstObservedAt, controllerStartedAt);
}

function withinDeadline(startedAt, observedAt, timeout) {
  return Number.isFinite(startedAt)
    && Number.isFinite(observedAt)
    && Number.isFinite(timeout)
    && timeout >= 0
    && observedAt >= startedAt
    && observedAt - startedAt <= timeout;
}

function convergenceJournalKey(deployment, expectedRevision) {
  return `${deployment.cluster}/${deployment.space}@${expectedRevision}`;
}

function convergenceJournalEntry(deployment, expectedRevision, now, existing = null) {
  const key = convergenceJournalKey(deployment, expectedRevision);
  if (existing) {
    check(existing.application === `${deployment.cluster}/${deployment.space}`, `${key}: convergence journal Application drifted`);
    check(existing.expectedRevision === expectedRevision, `${key}: convergence journal revision drifted`);
    check(Number.isInteger(existing.syncReservations) && existing.syncReservations >= 0, `${key}: convergence journal sync reservation count is invalid`);
    check(Number.isFinite(Date.parse(existing.startedAt)), `${key}: convergence journal start time is invalid`);
    return existing;
  }
  return {
    application: `${deployment.cluster}/${deployment.space}`,
    expectedRevision,
    startedAt: new Date(now).toISOString(),
    syncReservations: 0,
    updatedAt: new Date(now).toISOString(),
  };
}

function beginConvergenceJournal(deployment, expectedRevision) {
  const key = convergenceJournalKey(deployment, expectedRevision);
  const now = Date.now();
  const journal = updateOperationJournal((current) => {
    current.convergence[key] = convergenceJournalEntry(
      deployment,
      expectedRevision,
      now,
      current.convergence[key],
    );
  });
  return { key, ...journal.convergence[key] };
}

function reserveConvergenceSync(key) {
  let reserved = 0;
  updateOperationJournal((journal) => {
    const entry = journal.convergence[key];
    check(entry, `${key}: convergence journal entry is missing before sync reservation`);
    check(entry.syncReservations < ARGO_MAX_SYNC_REQUESTS, `${key}: convergence journal exhausted sync reservations`);
    entry.syncReservations += 1;
    entry.updatedAt = new Date().toISOString();
    reserved = entry.syncReservations;
  });
  return reserved;
}

function clearConvergenceJournalEntry(journal, key) {
  delete journal.convergence[key];
}

function clearConvergenceJournal(key) {
  updateOperationJournal((journal) => {
    clearConvergenceJournalEntry(journal, key);
  });
}

function argoTrackingID(deployment, migration, namespace) {
  const group = migration.apiVersion.split("/")[0];
  return `${deployment.space}:${group}/${migration.kind}:${namespace}/${migration.name}`;
}

function hostNetworkBindings(workload) {
  const podSpec = workload.spec?.template?.spec ?? {};
  const bindings = [];
  for (const container of [...(podSpec.initContainers ?? []), ...(podSpec.containers ?? [])]) {
    for (const port of container.ports ?? []) {
      const protocol = port.protocol ?? "TCP";
      if (Number(port.hostPort) > 0) bindings.push(`${protocol}/${port.hostPort}`);
      if (podSpec.hostNetwork === true && Number(port.containerPort) > 0) {
        bindings.push(`${protocol}/${port.containerPort}`);
      }
    }
  }
  return [...new Set(bindings)].sort();
}

function trackedOriginSpace(workload) {
  try {
    return JSON.parse(workload.metadata?.annotations?.["confighub.com/origin"] ?? "{}").spaceSlug ?? "";
  } catch {
    return "";
  }
}

function retryableKubernetesCompareAndSet(output) {
  return /test failed|conflict|object has been modified|not[\s_-]*found/i.test(String(output ?? ""));
}

function deleteDaemonSetWithPreconditions(cluster, namespace, name, uid, resourceVersion) {
  const config = readYaml(clusterKubeconfig(cluster));
  const contextName = `kind-${cluster}`;
  const context = (config.contexts ?? []).find((item) => item.name === contextName)?.context;
  check(context?.cluster && context?.user, `${cluster}: kubeconfig context ${contextName} is incomplete`);
  const clusterConfig = (config.clusters ?? []).find((item) => item.name === context.cluster)?.cluster;
  const userConfig = (config.users ?? []).find((item) => item.name === context.user)?.user;
  check(clusterConfig?.server && clusterConfig?.["certificate-authority-data"], `${cluster}: kubeconfig cluster TLS data is incomplete`);
  const server = new URL(clusterConfig.server);
  check(
    server.protocol === "https:"
      && ["127.0.0.1", "localhost", "::1"].includes(server.hostname),
    `${cluster}: namespace-move precondition delete is restricted to a loopback kind API server`,
  );
  check(
    userConfig?.["client-certificate-data"] && userConfig?.["client-key-data"],
    `${cluster}: namespace-move precondition delete requires the declared kind client-certificate kubeconfig`,
  );
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-kubara-delete-"));
  try {
    const caPath = join(temp, "ca.crt");
    const certPath = join(temp, "client.crt");
    const keyPath = join(temp, "client.key");
    writeFileSync(caPath, Buffer.from(clusterConfig["certificate-authority-data"], "base64"), { mode: 0o600 });
    writeFileSync(certPath, Buffer.from(userConfig["client-certificate-data"], "base64"), { mode: 0o600 });
    writeFileSync(keyPath, Buffer.from(userConfig["client-key-data"], "base64"), { mode: 0o600 });
    const endpoint = `${server.toString().replace(/\/$/, "")}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/daemonsets/${encodeURIComponent(name)}`;
    return tryCommand("curl", [
      "--silent", "--show-error", "--fail-with-body",
      "--connect-timeout", "10", "--max-time", "120",
      "--request", "DELETE",
      "--header", "Content-Type: application/json",
      "--cacert", caPath,
      "--cert", certPath,
      "--key", keyPath,
      "--data", JSON.stringify({
        apiVersion: "v1",
        kind: "DeleteOptions",
        preconditions: { uid, resourceVersion },
        propagationPolicy: "Background",
      }),
      endpoint,
    ], { timeout: 130_000 });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function writeNamespaceMoveAttempt(item) {
  updateOperationJournal((journal) => {
    const existing = journal.namespaceMove;
    check(!existing || (existing.ref === item.ref && existing.uid === item.uid), "refusing to replace a different namespace-move journal attempt");
    journal.namespaceMove = item;
  });
}

function namespaceMoveCurrentObject(deployment, migration) {
  const result = kubectlTry(deployment.cluster, [
    "get", migration.resource, migration.name,
    "-n", migration.fromNamespace, "-o", "json",
  ]);
  if (!result.ok && kubernetesResourceNotFound(result.output)) return null;
  check(result.ok, `${deployment.cluster}: failed to inspect namespace-move journal resource`);
  return JSON.parse(result.output);
}

function completeNamespaceMoveAttempt(state, attempt, outcome) {
  const completed = {
    ...attempt,
    source: undefined,
    state: "observed-gone",
    evidenceScope: "historical-migration-event",
    revisionAtDeletion: attempt.expectedRevision,
    outcome,
    observedGoneAt: new Date().toISOString(),
  };
  delete completed.source;
  delete completed.expectedRevision;
  writeNamespaceMoveAttempt(completed);
  state.namespaceMoveAttempts.set(completed.ref, { ...completed, source: "journal" });
  if (!state.namespaceMoveEvidence.some((item) => item.ref === completed.ref && item.uid === completed.uid)) {
    state.namespaceMoveEvidence.push(completed);
  }
  return completed;
}

function recoverNamespaceMoveAttempt(deployment, migration, state) {
  const ref = `${deployment.cluster}/${migration.kind}/${migration.fromNamespace}/${migration.name}`;
  const attempt = state.namespaceMoveAttempts.get(ref);
  if (!attempt || attempt.source !== "journal") return null;
  const current = namespaceMoveCurrentObject(deployment, migration);
  if (attempt.state === "observed-gone") {
    check(current?.metadata?.uid !== attempt.uid, `${ref}: a UID recorded gone reappeared`);
    return attempt;
  }
  if (current?.metadata?.uid === attempt.uid) {
    return attempt;
  }
  const outcome = current
    ? `original-uid-gone-replaced-by-${current.metadata?.uid ?? "unknown"}`
    : "original-uid-gone";
  const completed = completeNamespaceMoveAttempt(state, attempt, outcome);
  recordAction(state, "argo-namespace-move-recovery", ref, `uid=${attempt.uid}; ${outcome}`);
  return completed;
}

function waitForNamespaceMoveUIDGone(deployment, migration, uid) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const current = namespaceMoveCurrentObject(deployment, migration);
    if (!current || current.metadata?.uid !== uid) {
      return current?.metadata?.uid
        ? `original-uid-gone-replaced-by-${current.metadata.uid}`
        : "original-uid-gone";
    }
    command("sleep", ["1"]);
  }
  check(false, `${deployment.cluster}: namespace-move UID ${uid} was not deleted within 2 minutes`);
}

function activeOperationMatchesExpectedRevision(app, expectedRevision) {
  const phase = app.status?.operationState?.phase ?? "Unknown";
  if (app.operation) return app.operation?.sync?.revision === expectedRevision;
  if (!["Running", "Terminating"].includes(phase)) return true;
  return operationStateRevision(app) === expectedRevision;
}

function pruneDeclaredNamespaceMoveBlockers(deployment, state, app, expectedRevision) {
  let changed = false;
  for (const migration of deployment.namespaceMovePrunes ?? []) {
    const ref = `${deployment.cluster}/${migration.kind}/${migration.fromNamespace}/${migration.name}`;
    const beforeRecovery = state.namespaceMoveAttempts.get(ref)?.state ?? "";
    const recovered = recoverNamespaceMoveAttempt(deployment, migration, state);
    if (recovered?.state === "observed-gone" && beforeRecovery !== "observed-gone") changed = true;
    if (
      app.status?.sync?.revision !== expectedRevision
        || !activeOperationMatchesExpectedRevision(app, expectedRevision)
    ) continue;
    const group = migration.apiVersion.split("/")[0];
    const staleStatus = (app.status?.resources ?? []).find(
      (item) => item.group === group
        && item.kind === migration.kind
        && item.namespace === migration.fromNamespace
        && item.name === migration.name
        && item.requiresPruning === true,
    );
    if (!staleStatus) continue;

    const obsoleteResult = kubectlTry(deployment.cluster, [
      "get", migration.resource, migration.name,
      "-n", migration.fromNamespace, "-o", "json",
    ]);
    if (!obsoleteResult.ok && kubernetesResourceNotFound(obsoleteResult.output)) continue;
    check(obsoleteResult.ok, `${deployment.cluster}: failed to inspect declared namespace-move blocker ${migration.fromNamespace}/${migration.name}`);

    const desiredStatus = (app.status?.resources ?? []).find(
      (item) => item.group === group
        && item.kind === migration.kind
        && item.namespace === deployment.destinationNamespace
        && item.name === migration.name
        && item.requiresPruning !== true,
    );
    if (!desiredStatus) continue;
    const desiredResult = kubectlTry(deployment.cluster, [
      "get", migration.resource, migration.name,
      "-n", deployment.destinationNamespace, "-o", "json",
    ]);
    if (!desiredResult.ok && kubernetesResourceNotFound(desiredResult.output)) continue;
    check(desiredResult.ok, `${deployment.cluster}: failed to inspect desired namespace-move replacement ${deployment.destinationNamespace}/${migration.name}`);

    const obsolete = JSON.parse(obsoleteResult.output);
    const desired = JSON.parse(desiredResult.output);
    check(obsolete.apiVersion === migration.apiVersion && obsolete.kind === migration.kind, `${deployment.cluster}: obsolete namespace-move blocker identity drifted`);
    check(desired.apiVersion === migration.apiVersion && desired.kind === migration.kind, `${deployment.cluster}: desired namespace-move replacement identity drifted`);
    check(
      obsolete.metadata?.name === migration.name
        && obsolete.metadata?.namespace === migration.fromNamespace
        && UUID_PATTERN.test(obsolete.metadata?.uid ?? ""),
      `${deployment.cluster}: obsolete namespace-move blocker metadata identity drifted`,
    );
    check(
      desired.metadata?.name === migration.name
        && desired.metadata?.namespace === deployment.destinationNamespace
        && UUID_PATTERN.test(desired.metadata?.uid ?? ""),
      `${deployment.cluster}: desired namespace-move replacement metadata identity drifted`,
    );
    check(
      obsolete.metadata?.annotations?.["argocd.argoproj.io/tracking-id"]
        === argoTrackingID(deployment, migration, migration.fromNamespace),
      `${deployment.cluster}: obsolete namespace-move blocker is not tracked by ${deployment.space}`,
    );
    check(
      desired.metadata?.annotations?.["argocd.argoproj.io/tracking-id"]
        === argoTrackingID(deployment, migration, deployment.destinationNamespace),
      `${deployment.cluster}: desired namespace-move replacement is not tracked by ${deployment.space}`,
    );
    check(
      trackedOriginSpace(obsolete) === deployment.space
        && trackedOriginSpace(desired) === deployment.space,
      `${deployment.cluster}: namespace-move resources do not share ConfigHub origin ${deployment.space}`,
    );
    const obsoleteBindings = hostNetworkBindings(obsolete);
    const desiredBindings = hostNetworkBindings(desired);
    const conflicts = obsoleteBindings.filter((binding) => desiredBindings.includes(binding));
    check(
      stableJson(conflicts) === stableJson(migration.conflictingBindings),
      `${deployment.cluster}: declared namespace-move blocker binding drifted from ${migration.conflictingBindings.join(",")}`,
    );

    const priorAttempt = state.namespaceMoveAttempts.get(ref);
    if (priorAttempt) {
      check(priorAttempt.source === "journal" && priorAttempt.uid === obsolete.metadata.uid && priorAttempt.state !== "observed-gone", `${ref}: declared one-time namespace-move blocker was already consumed or replaced`);
      check(priorAttempt.migrationID === migration.migrationID, `${ref}: prepared migration identity drifted`);
      check(priorAttempt.expectedRevision === expectedRevision, `${ref}: prepared migration OCI revision drifted`);
      check(priorAttempt.resourceVersion === obsolete.metadata.resourceVersion, `${ref}: prepared migration resourceVersion changed before deletion`);
    }
    check(obsolete.metadata?.resourceVersion, `${ref}: resourceVersion missing before precondition delete`);
    let attempt = {
      ...(priorAttempt ?? {}),
      migrationID: migration.migrationID,
      ref,
      uid: obsolete.metadata.uid,
      resourceVersion: obsolete.metadata.resourceVersion,
      application: `${deployment.cluster}/${deployment.space}`,
      expectedRevision,
      apiVersion: migration.apiVersion,
      kind: migration.kind,
      name: migration.name,
      fromNamespace: migration.fromNamespace,
      toNamespace: deployment.destinationNamespace,
      conflictingBindings: conflicts,
      reason: migration.reason,
      state: "prepared",
      preparedAt: priorAttempt?.preparedAt ?? new Date().toISOString(),
    };
    delete attempt.source;
    writeNamespaceMoveAttempt(attempt);
    state.namespaceMoveAttempts.set(ref, { ...attempt, source: "journal" });
    const deleted = deleteDaemonSetWithPreconditions(
      deployment.cluster,
      migration.fromNamespace,
      migration.name,
      obsolete.metadata.uid,
      obsolete.metadata.resourceVersion,
    );
    if (!deleted.ok && retryableKubernetesCompareAndSet(deleted.output)) {
      const current = namespaceMoveCurrentObject(deployment, migration);
      if (!current || current.metadata?.uid !== obsolete.metadata.uid) {
        const outcome = current?.metadata?.uid
          ? `original-uid-gone-replaced-by-${current.metadata.uid}`
          : "original-uid-gone";
        attempt = completeNamespaceMoveAttempt(state, attempt, outcome);
        recordAction(state, "argo-namespace-move-recovery", ref, `uid=${attempt.uid}; ${outcome}`);
        changed = true;
      }
      continue;
    }
    check(deleted.ok, `${ref}: UID/resourceVersion-preconditioned namespace-move deletion failed`);
    attempt = {
      ...attempt,
      state: "delete-returned",
      deleteReturnedAt: new Date().toISOString(),
    };
    writeNamespaceMoveAttempt(attempt);
    state.namespaceMoveAttempts.set(ref, { ...attempt, source: "journal" });
    const outcome = waitForNamespaceMoveUIDGone(deployment, migration, obsolete.metadata.uid);
    attempt = completeNamespaceMoveAttempt(state, attempt, outcome);
    recordAction(
      state,
      "argo-namespace-move-prune",
      ref,
      `uid=${obsolete.metadata.uid}; outcome=${outcome}; ${deployment.destinationNamespace}/${migration.name}; bindings=${conflicts.join(",")}; ${migration.reason}`,
    );
    changed = true;
  }
  return changed;
}

function writeProtectedNamespaceAttempt(item) {
  updateOperationJournal((journal) => {
    journal.protectedNamespaceDetachments ??= {};
    const existing = journal.protectedNamespaceDetachments[item.migrationID];
    check(
      !existing || existing.uid === item.uid,
      `${item.migrationID}: refusing to replace a different protected Namespace UID`,
    );
    journal.protectedNamespaceDetachments[item.migrationID] = item;
  });
}

function protectedNamespacePayloadContract(deployment, contract) {
  const unit = plan.managedUnits.find(
    (item) => item.space === deployment.space && item.slug === contract.unitSlug,
  );
  check(unit?.payloadKey, `${contract.migrationID}: deployment payload Unit is missing`);
  const payload = inputs.payloads.get(unit.payloadKey);
  check(payload, `${contract.migrationID}: deployment payload ${unit.payloadKey} is missing`);
  const namespaces = parseDocs(payload.value).filter((doc) => doc.apiVersion === "v1" && doc.kind === "Namespace");
  check(
    !namespaces.some((doc) => doc.metadata?.name === contract.retainedNamespace),
    `${contract.migrationID}: current payload still contains protected Namespace/${contract.retainedNamespace}`,
  );
  check(
    namespaces.filter((doc) => doc.metadata?.name === contract.replacementNamespace).length === 1,
    `${contract.migrationID}: current payload does not contain exactly one Namespace/${contract.replacementNamespace}`,
  );
}

function readProtectedNamespace(cluster, name) {
  const result = kubectlTry(cluster, ["get", "namespace", name, "-o", "json"]);
  if (!result.ok && kubernetesResourceNotFound(result.output)) return null;
  check(result.ok, `${cluster}: failed to inspect protected Namespace/${name}`);
  return JSON.parse(result.output);
}

function protectedNamespaceArgoStatus(app, name) {
  return (app.status?.resources ?? []).find(
    (item) => !item.group && item.kind === "Namespace" && item.name === name,
  ) ?? null;
}

function retainProtectedNamespaceEvidence(state, item) {
  state.protectedNamespaceAttempts.set(item.migrationID, { ...item, source: "journal" });
  const index = state.protectedNamespaceEvidence.findIndex(
    (existing) => existing.migrationID === item.migrationID,
  );
  if (index >= 0) state.protectedNamespaceEvidence[index] = item;
  else state.protectedNamespaceEvidence.push(item);
}

function completeProtectedNamespaceDetachment(state, attempt, retained, replacement, outcome) {
  const completed = {
    ...attempt,
    state: "observed-detached",
    outcome,
    evidenceScope: "historical-migration-event",
    resourceVersionAfter: retained.metadata.resourceVersion,
    replacementResourceVersionObserved: replacement.metadata.resourceVersion,
    observedDetachedAt: new Date().toISOString(),
  };
  delete completed.source;
  writeProtectedNamespaceAttempt(completed);
  retainProtectedNamespaceEvidence(state, completed);
  return completed;
}

function detachDeclaredProtectedNamespaceOwnership(deployment, state, app, expectedRevision) {
  if (!deployment.protectedNamespaceOwnershipDetachment) return false;
  const contract = protectedNamespaceContract(deployment.protectedNamespaceOwnershipDetachment);
  check(
    contract.cluster === deployment.cluster && contract.application === deployment.space,
    `${contract.migrationID}: protected Namespace contract does not match the deployment`,
  );
  if (
    app.status?.sync?.revision !== expectedRevision
      || !activeOperationMatchesExpectedRevision(app, expectedRevision)
  ) return false;

  protectedNamespacePayloadContract(deployment, contract);
  const replacementStatus = protectedNamespaceArgoStatus(app, contract.replacementNamespace);
  if (!replacementStatus || replacementStatus.requiresPruning === true || replacementStatus.status !== "Synced") {
    return false;
  }
  const retained = readProtectedNamespace(deployment.cluster, contract.retainedNamespace);
  const replacement = readProtectedNamespace(deployment.cluster, contract.replacementNamespace);
  check(retained, `${contract.migrationID}: protected Namespace/${contract.retainedNamespace} is missing`);
  if (!replacement) return false;
  const classification = classifyProtectedNamespaceOwnership(contract, retained, replacement);
  const prior = state.protectedNamespaceAttempts.get(contract.migrationID);

  if (prior?.state === "observed-detached") {
    validateProtectedNamespaceDetached(contract, prior.uid, retained, replacement);
    return false;
  }

  if (classification.state === "already-detached") {
    if (prior) {
      check(
        prior.source === "journal" && ["prepared", "patch-returned"].includes(prior.state),
        `${contract.migrationID}: incomplete ownership attempt has an invalid source or state`,
      );
      check(prior.uid === retained.metadata.uid, `${contract.migrationID}: retained Namespace UID changed during recovery`);
      check(prior.expectedRevision === expectedRevision, `${contract.migrationID}: recovery OCI revision drifted`);
    }
    const now = new Date().toISOString();
    const attempt = prior ?? {
      migrationID: contract.migrationID,
      cluster: contract.cluster,
      application: `${contract.cluster}/${contract.application}`,
      namespace: contract.retainedNamespace,
      replacementNamespace: contract.replacementNamespace,
      uid: retained.metadata.uid,
      replacementUID: replacement.metadata.uid,
      resourceVersionObserved: retained.metadata.resourceVersion,
      expectedRevision,
      state: "prepared",
      preparedAt: now,
    };
    const outcome = prior ? "detached-by-reconciler" : "already-detached";
    const completed = completeProtectedNamespaceDetachment(
      state,
      attempt,
      retained,
      replacement,
      outcome,
    );
    recordAction(
      state,
      prior ? "protected-namespace-detach-recovery" : "protected-namespace-already-detached",
      `${contract.cluster}/Namespace/${contract.retainedNamespace}`,
      `${contract.migrationID}; uid=${completed.uid}; outcome=${outcome}`,
    );
    return true;
  }

  const staleStatus = protectedNamespaceArgoStatus(app, contract.retainedNamespace);
  if (!staleStatus?.requiresPruning) return false;
  let attempt = prior;
  if (attempt) {
    check(attempt.source === "journal", `${contract.migrationID}: incomplete ownership attempt is not journal-owned`);
    check(attempt.uid === retained.metadata.uid, `${contract.migrationID}: retained Namespace UID changed before patch`);
    check(attempt.expectedRevision === expectedRevision, `${contract.migrationID}: prepared OCI revision drifted`);
    check(
      attempt.resourceVersionObserved === retained.metadata.resourceVersion,
      `${contract.migrationID}: protected Namespace resourceVersion changed before guarded patch`,
    );
    check(attempt.state === "prepared", `${contract.migrationID}: patch-returned state still has legacy ownership fields`);
  } else {
    attempt = {
      migrationID: contract.migrationID,
      cluster: contract.cluster,
      application: `${contract.cluster}/${contract.application}`,
      namespace: contract.retainedNamespace,
      replacementNamespace: contract.replacementNamespace,
      uid: retained.metadata.uid,
      replacementUID: replacement.metadata.uid,
      resourceVersionObserved: retained.metadata.resourceVersion,
      expectedRevision,
      state: "prepared",
      preparedAt: new Date().toISOString(),
      legacyTrackingID: contract.legacyTrackingID,
      legacyOrigin: classification.legacyOrigin,
    };
    writeProtectedNamespaceAttempt(attempt);
    state.protectedNamespaceAttempts.set(contract.migrationID, { ...attempt, source: "journal" });
  }

  const patched = kubectlTry(deployment.cluster, [
    "patch", "namespace", contract.retainedNamespace,
    "--type=json",
    "-p", JSON.stringify(protectedNamespaceDetachPatch(contract, classification)),
  ]);
  if (!patched.ok && retryableKubernetesCompareAndSet(patched.output)) {
    const current = readProtectedNamespace(deployment.cluster, contract.retainedNamespace);
    check(current, `${contract.migrationID}: protected Namespace disappeared during patch recovery`);
    const recovered = validateProtectedNamespaceDetached(contract, attempt.uid, current, replacement);
    const completed = completeProtectedNamespaceDetachment(
      state,
      attempt,
      current,
      replacement,
      "detached-by-reconciler",
    );
    recordAction(
      state,
      "protected-namespace-detach-recovery",
      `${contract.cluster}/Namespace/${contract.retainedNamespace}`,
      `${contract.migrationID}; uid=${completed.uid}; resourceVersion=${recovered.retainedResourceVersion}`,
    );
    return true;
  }
  check(patched.ok, `${contract.migrationID}: guarded protected Namespace ownership patch failed: ${patched.output}`);
  attempt = {
    ...attempt,
    state: "patch-returned",
    patchReturnedAt: new Date().toISOString(),
  };
  writeProtectedNamespaceAttempt(attempt);
  state.protectedNamespaceAttempts.set(contract.migrationID, { ...attempt, source: "journal" });
  const current = readProtectedNamespace(deployment.cluster, contract.retainedNamespace);
  check(current, `${contract.migrationID}: protected Namespace disappeared after patch`);
  validateProtectedNamespaceDetached(contract, attempt.uid, current, replacement);
  const completed = completeProtectedNamespaceDetachment(
    state,
    attempt,
    current,
    replacement,
    "detached-by-reconciler",
  );
  recordAction(
    state,
    "protected-namespace-ownership-detach",
    `${contract.cluster}/Namespace/${contract.retainedNamespace}`,
    `${contract.migrationID}; uid=${completed.uid}; four reviewed metadata fields removed; Namespace retained`,
  );
  return true;
}

function convergeDeploymentApplication(deployment, state, expectedRevision) {
  check(deployment, "internal error: deployment definition missing during Argo convergence");
  check(/^sha256:[0-9a-f]{64}$/.test(expectedRevision), `${deployment.space}: invalid expected ConfigHub revision ${expectedRevision}`);
  let firstApp = waitForArgoApplicationContract(deployment);
  const convergenceJournal = beginConvergenceJournal(deployment, expectedRevision);
  const firstObservedAt = Date.parse(convergenceJournal.startedAt);
  const convergenceStartedAt = firstObservedAt;
  let activeWaitStartedAt = null;
  let healthWaitStartedAt = null;
  let syncRequests = convergenceJournal.syncReservations;
  let last = { sync: "Unknown", health: "Unknown", phase: "Unknown", revision: "Unknown", message: "not observed" };
  while (true) {
    let app = firstApp ?? readLiveArgoApplication(deployment);
    firstApp = null;
    assertArgoApplicationContract(app, deployment);
    if (detachDeclaredProtectedNamespaceOwnership(deployment, state, app, expectedRevision)) {
      command("sleep", [String(ARGO_OBSERVE_SECONDS)]);
      app = readLiveArgoApplication(deployment);
      assertArgoApplicationContract(app, deployment);
    }
    if (pruneDeclaredNamespaceMoveBlockers(deployment, state, app, expectedRevision)) {
      command("sleep", [String(ARGO_OBSERVE_SECONDS)]);
      app = readLiveArgoApplication(deployment);
      assertArgoApplicationContract(app, deployment);
    }
    last = argoObservation(app);
    const disposition = argoConvergenceState(app, deployment, expectedRevision);
    if (disposition === "accepted") {
      clearConvergenceJournal(convergenceJournal.key);
      return last;
    }

    const now = Date.now();
    const convergenceElapsed = now - convergenceStartedAt;
    check(
      withinDeadline(convergenceStartedAt, now, ARGO_CONVERGENCE_TIMEOUT_MS),
      `${deployment.cluster}/${deployment.space}: overall Argo convergence exceeded ${ARGO_CONVERGENCE_TIMEOUT_MS / 60000} minutes; expected revision ${expectedRevision}, got ${stableJson({ ...last, elapsedSeconds: Math.floor(convergenceElapsed / 1000), syncRequests })}`,
    );
    if (disposition === "active-operation") {
      healthWaitStartedAt = null;
      activeWaitStartedAt = convergencePhaseStartedAt(
        app,
        expectedRevision,
        "startedAt",
        firstObservedAt,
        activeWaitStartedAt,
        now,
      );
      const elapsed = now - activeWaitStartedAt;
      check(
        withinDeadline(activeWaitStartedAt, now, ARGO_OPERATION_TIMEOUT_MS),
        `${deployment.cluster}/${deployment.space}: active Argo operation exceeded ${ARGO_OPERATION_TIMEOUT_MS / 60000} minutes without takeover; expected revision ${expectedRevision}, got ${stableJson({ ...last, elapsedSeconds: Math.floor(elapsed / 1000), syncRequests })}`,
      );
      command("sleep", [String(ARGO_OBSERVE_SECONDS)]);
      continue;
    }

    activeWaitStartedAt = null;
    if (disposition === "health-pending") {
      healthWaitStartedAt = convergencePhaseStartedAt(
        app,
        expectedRevision,
        "finishedAt",
        firstObservedAt,
        healthWaitStartedAt,
        now,
      );
      const elapsed = now - healthWaitStartedAt;
      check(
        withinDeadline(healthWaitStartedAt, now, ARGO_HEALTH_TIMEOUT_MS),
        `${deployment.cluster}/${deployment.space}: exact-revision health did not settle within ${ARGO_HEALTH_TIMEOUT_MS / 60000} minutes; no resync was submitted; expected health ${deployment.acceptedHealth.join("|")}, got ${stableJson({ ...last, elapsedSeconds: Math.floor(elapsed / 1000), syncRequests })}`,
      );
      command("sleep", [String(ARGO_OBSERVE_SECONDS)]);
      continue;
    }

    healthWaitStartedAt = null;
    check(
      syncRequests < ARGO_MAX_SYNC_REQUESTS,
      `${deployment.cluster}/${deployment.space}: exhausted ${ARGO_MAX_SYNC_REQUESTS} actual Argo sync requests; expected revision ${expectedRevision}, Synced, and health ${deployment.acceptedHealth.join("|")}, got ${stableJson(last)}`,
    );
    syncRequests = reserveConvergenceSync(convergenceJournal.key);
    requestArgoSyncIfNeeded(
      deployment,
      state,
      syncRequests,
      expectedRevision,
    );
    command("sleep", [String(ARGO_OBSERVE_SECONDS)]);
  }
}

function requestArgoSyncIfNeeded(deployment, state, syncAttempt, expectedRevision) {
  let app = waitForArgoApplicationContract(deployment);
  if (argoConvergenceState(app, deployment, expectedRevision) !== "retryable") return false;

  kubectl(deployment.cluster, [
    "annotate", "application", deployment.space, "-n", "argocd",
    "argocd.argoproj.io/refresh=hard", "--overwrite",
  ]);
  recordAction(state, "argo-hard-refresh", `${deployment.cluster}/${deployment.space}`, `sync attempt ${syncAttempt}`);
  let refreshProcessed = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    app = readLiveArgoApplication(deployment);
    if (!app.metadata?.annotations?.["argocd.argoproj.io/refresh"]) {
      refreshProcessed = true;
      break;
    }
    command("sleep", ["2"]);
  }
  check(refreshProcessed, `${deployment.cluster}/${deployment.space}: Argo hard refresh was not processed`);
  assertArgoApplicationContract(app, deployment);
  if (argoConvergenceState(app, deployment, expectedRevision) !== "retryable") return false;

  const operation = {
    initiatedBy: { username: "helm-expt-kubara-mini-idp" },
    sync: {
      revision: expectedRevision,
      prune: true,
      syncOptions: applicationSyncOptions(deployment),
    },
    retry: applicationRetryPolicy(),
  };
  check(app.metadata?.resourceVersion, `${deployment.cluster}/${deployment.space}: Application resourceVersion missing before sync compare-and-set`);
  const submitted = kubectlTry(deployment.cluster, [
    "patch", "application", deployment.space, "-n", "argocd",
    "--type=json", "--patch", JSON.stringify([
      { op: "test", path: "/metadata/resourceVersion", value: app.metadata.resourceVersion },
      { op: "add", path: "/operation", value: operation },
    ]),
  ]);
  if (!submitted.ok && retryableKubernetesCompareAndSet(submitted.output)) return false;
  check(submitted.ok, `${deployment.cluster}/${deployment.space}: failed to submit compare-and-set Argo sync operation`);
  recordAction(state, "argo-sync-request", `${deployment.cluster}/${deployment.space}`, `sync attempt ${syncAttempt}; Kubara prune semantics`);
  return true;
}

function spaceHasUnreleasedHeads(space) {
  const units = readUnitRows(space);
  check(units.length > 0, `${space}: cannot determine release currency without Units`);
  return units.some(
    (unit) => Number(unit.HeadRevisionNum ?? 0) !== Number(unit.LastAppliedRevisionNum ?? 0),
  );
}

function hasRelease(space) {
  const result = cubTry([
    "release", "list", "--space", space,
    "--where", "Published = true",
    "--select", "Digest,ManifestDigest,ReleaseNum,CreatedAt", "-o", "json",
  ]);
  check(result.ok, `${space}: failed to inspect published releases: ${result.output}`);
  return unwrapRows(JSON.parse(result.output), "Release").length > 0;
}

function publishRelease(space, state, { sourcePayloadKeys = {} } = {}) {
  const boundarySnapshot = assertReleaseBoundary(space, { sourcePayloadKeys, approvalMode: "clear" });
  const hasUnreleasedHeads = spaceHasUnreleasedHeads(space);
  const current = latestRelease(space);
  if (releasePublicationDecision({ hasUnreleasedHeads, hasPublishedRelease: Boolean(current) }) === "reuse") {
    state.changedSpaces.delete(space);
    check(
      stableJson(assertReleaseBoundary(space, { sourcePayloadKeys, approvalMode: "clear" })) === stableJson(boundarySnapshot),
      `${space}: release boundary changed while reusing the published release`,
    );
    return validatedPublishedRelease(space, current, "existing published release");
  }
  const result = cubTry(
    ["release", "publish", space, "-o", "json"],
    { timeout: 1_200_000 },
  );
  if (!result.ok) {
    check(
      isUnchangedReleaseResponse(result),
      `cub release publish ${space} failed: ${result.output}`,
    );
    const reused = latestRelease(space);
    check(reused, `${space}: ConfigHub reported an unchanged bundle but no published release exists`);
    check(
      !spaceHasUnreleasedHeads(space),
      `${space}: ConfigHub reported an unchanged bundle while Unit heads remain unreleased`,
    );
    state.changedSpaces.delete(space);
    check(
      stableJson(assertReleaseBoundary(space, { sourcePayloadKeys, approvalMode: "clear" })) === stableJson(boundarySnapshot),
      `${space}: release boundary changed during unchanged-release recovery`,
    );
    return validatedPublishedRelease(space, reused, "unchanged published release");
  }
  const value = JSON.parse(result.output);
  const release = unwrapEntity(value, "Release");
  const fallback = latestRelease(space);
  const bundleDigest = release?.Digest ?? release?.Release?.Digest ?? fallback?.Digest ?? "";
  const manifestDigest = release?.ManifestDigest
    ?? release?.Release?.ManifestDigest
    ?? fallback?.ManifestDigest
    ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(bundleDigest), `${space}: published bundle content digest is missing or invalid`);
  check(/^sha256:[0-9a-f]{64}$/.test(manifestDigest), `${space}: published OCI manifest digest is missing or invalid`);
  recordAction(state, "release-publish", space, `manifest=${manifestDigest}; bundle=${bundleDigest}`);
  state.published.set(space, { manifestDigest, bundleDigest });
  state.changedSpaces.delete(space);
  check(!spaceHasUnreleasedHeads(space), `${space}: release did not advance every Unit to its current head`);
  check(
    stableJson(assertReleaseBoundary(space, { sourcePayloadKeys, approvalMode: "clear" })) === stableJson(boundarySnapshot),
    `${space}: release boundary changed while publishing`,
  );
  return {
    ...(release ?? {}),
    Digest: bundleDigest,
    ManifestDigest: manifestDigest,
  };
}

function assertReleaseBoundary(space, { sourcePayloadKeys = {}, approvalMode = "clear" } = {}) {
  const expectedManagedUnits = plan.managedUnits.filter((item) => item.space === space);
  if (expectedManagedUnits.length > 0) {
    assertUnitAllowlist(space, expectedManagedUnits.map((item) => item.slug));
    const unexpectedOverrides = Object.keys(sourcePayloadKeys)
      .filter((slug) => !expectedManagedUnits.some((item) => item.slug === slug));
    check(
      unexpectedOverrides.length === 0,
      `${space}: release payload override names unknown Units: ${unexpectedOverrides.join(", ")}`,
    );
    for (const expected of expectedManagedUnits) {
      assertManagedSourceUnitContract(
        expected,
        sourcePayloadKeys[expected.slug] ?? expected.payloadKey,
      );
    }
    const liveUnits = readUnitRows(space);
    const gated = liveUnits.filter(hasApprovalGate);
    if (approvalMode === "required") {
      check(gated.length > 0, `${space}: expected an exact approval gate before the refused publication`);
    } else {
      check(gated.length === 0, `${space}: successful publication still has ${gated.length} approval-gated head(s)`);
    }
    assertManagedSourceSpaceContract(space, expectedManagedUnits);
    return releaseBoundarySnapshot(space);
  }
  const fleetItem = FLEET.find((item) => `${item.cluster}-argo-apps` === space);
  check(fleetItem, `${space}: release publication is outside the managed mini-IDP Space inventory`);
  assertUnitAllowlist(space, expectedArgoApplicationSlugs(plan, fleetItem));
  assertDeliveryTopology(readSpaces(), plan, {
    fleet: [fleetItem],
    requireAllApplications: true,
    requireApplicationMetadata: true,
  });
  for (const deployment of plan.deployments.filter((item) => item.cluster === fleetItem.cluster)) {
    const docs = parseDocs(cub(["unit", "data", "--space", deployment.appSpace, deployment.appUnit]));
    check(docs.length === 1 && docs[0].kind === "Application", `${deployment.appSpace}/${deployment.appUnit}: expected one release-boundary Application`);
    const app = docs[0];
    assertArgoApplicationContract(app, deployment);
    check(
      stableJson(app.spec?.syncPolicy) === stableJson(applicationSyncPolicy(deployment)),
      `${deployment.appSpace}/${deployment.appUnit}: sync policy drifted before fleet-root publication`,
    );
    const expectedIgnoreDifferences = deployment.ignoreInjectedCertificateData
      ? certificateIgnoreDifferences()
      : undefined;
    check(
      stableJson(app.spec?.ignoreDifferences) === stableJson(expectedIgnoreDifferences),
      `${deployment.appSpace}/${deployment.appUnit}: ignoreDifferences drifted before fleet-root publication`,
    );
  }
  return releaseBoundarySnapshot(space);
}

function assertManagedSourceSpaceContract(space, expectedUnits) {
  const expectedSpace = plan.spaces.find((item) => item.slug === space);
  check(expectedSpace, `${space}: managed source Space is absent from the plan`);
  const liveSpace = readSpaces().get(space);
  check(liveSpace, `${space}: managed source Space is missing`);
  if (expectedSpace.target) {
    const target = readTarget(expectedSpace.target.split("/")[0]);
    check(target?.TargetID, `${space}: expected release target ${expectedSpace.target} is missing`);
    check(liveSpace.ReleaseTargetID === target.TargetID, `${space}: Space release target drifted`);
  } else {
    check(!liveSpace.ReleaseTargetID, `${space}: untargeted definition Space gained a release target`);
  }

  const expectedUpgrade = new Map(expectedUnits
    .filter((unit) => unit.upstream)
    .map((unit) => [`upgrade-${unit.slug}`, unit]));
  const allowedNeedsProvides = new Set(plan.links.filter((link) => link.space === space).map((link) => link.slug));
  const liveLinks = readLinks(space);
  const unexpected = liveLinks.filter(
    (link) => !expectedUpgrade.has(link.Slug) && !allowedNeedsProvides.has(link.Slug),
  );
  check(unexpected.length === 0, `${space}: unexpected Link(s) at release boundary: ${unexpected.map((item) => item.Slug).join(", ")}`);
  for (const [slug, unit] of expectedUpgrade) {
    const link = liveLinks.find((item) => item.Slug === slug);
    check(link, `${space}/${slug}: required UpgradeUnit Link is missing at release boundary`);
    const downstream = readUnit(space, unit.slug);
    const [upstreamSpace, upstreamSlug] = unit.upstream.split("/");
    const upstream = readUnit(upstreamSpace, upstreamSlug);
    check(link.UpdateType === "UpgradeUnit" && link.AutoUpdate !== true, `${space}/${slug}: UpgradeUnit policy drifted`);
    check(link.FromUnitID === downstream?.UnitID && link.ToUnitID === upstream?.UnitID, `${space}/${slug}: UpgradeUnit endpoints drifted`);
  }
}

function assertManagedSourceUnitContract(expected, payloadKey) {
  const ref = `${expected.space}/${expected.slug}`;
  const payload = inputs.payloads.get(payloadKey);
  check(payload, `${ref}: reviewed release-boundary payload ${payloadKey} is missing`);
  const live = readUnit(expected.space, expected.slug);
  check(live, `${ref}: managed source Unit is missing at the release boundary`);
  check(live.ToolchainType === expected.toolchain, `${ref}: toolchain drifted at the release boundary`);
  check(
    (live.ProviderType ?? null) === (expected.provider ?? null),
    `${ref}: provider drifted at the release boundary`,
  );
  check(
    sameUnitData(
      expected.toolchain,
      cub(["unit", "data", "--space", expected.space, expected.slug]),
      payload.value,
    ),
    `${ref}: data is not the exact reviewed release-boundary payload ${payloadKey}`,
  );
  if (expected.target) {
    const target = readTarget(expected.target.split("/")[0]);
    check(target?.TargetID, `${ref}: expected target ${expected.target} is missing`);
    check(live.TargetID === target.TargetID, `${ref}: target drifted at the release boundary`);
  } else {
    check(!live.TargetID, `${ref}: untargeted source Unit gained a target at the release boundary`);
  }
  if (expected.upstream) {
    const [upstreamSpace, upstreamSlug] = expected.upstream.split("/");
    const upstream = readUnit(upstreamSpace, upstreamSlug);
    check(upstream?.UnitID, `${ref}: expected upstream ${expected.upstream} is missing`);
    check(live.UpstreamUnitID === upstream.UnitID, `${ref}: upstream drifted at the release boundary`);
  } else {
    check(!live.UpstreamUnitID, `${ref}: definition Unit gained an upstream at the release boundary`);
  }
  check(
    mapMatches(live.Labels, expected.labels)
      && staleOwnedUnitLabels(live.Labels, expected.labels).length === 0,
    `${ref}: owned identity labels drifted at the release boundary`,
  );
  const expectedAnnotations = {
    ...sourceAnnotation(payload.value, payload.sourcePaths, payload.transform),
    ...(expected.annotations ?? {}),
  };
  check(
    mapMatches(live.Annotations, expectedAnnotations)
      && staleOwnedPublicAnnotations(live.Annotations, expectedAnnotations).length === 0,
    `${ref}: owned provenance annotations drifted at the release boundary`,
  );
  if (expected.prodProtected) {
    check(
      gateEnabled(live.DeleteGates, PROD_SAFETY_GATE)
        && gateEnabled(live.DestroyGates, PROD_SAFETY_GATE),
      `${ref}: production delete/destroy protection drifted at the release boundary`,
    );
  } else {
    check(
      !gateEnabled(live.DeleteGates, PROD_SAFETY_GATE)
        && !gateEnabled(live.DestroyGates, PROD_SAFETY_GATE),
      `${ref}: non-production Unit gained the owned production safety gate`,
    );
  }
}

function releaseBoundarySnapshot(space) {
  return readUnitRows(space).map((unit) => ({
    slug: unit.Slug,
    id: unit.UnitID,
    headRevisionNum: unit.HeadRevisionNum,
    dataHash: unit.DataHash,
    targetID: unit.TargetID ?? null,
    upstreamUnitID: unit.UpstreamUnitID ?? null,
    toolchain: unit.ToolchainType,
    provider: unit.ProviderType ?? null,
    ownedLabels: Object.fromEntries([...OWNED_UNIT_LABELS]
      .filter((key) => unit.Labels?.[key] !== undefined)
      .sort()
      .map((key) => [key, unit.Labels[key]])),
  })).sort((left, right) => left.slug.localeCompare(right.slug));
}

function validatedPublishedRelease(space, release, description) {
  check(release, `${space}: ${description} is missing`);
  releaseManifestDigest(release);
  return release;
}

function releasePublicationDecision({ hasUnreleasedHeads, hasPublishedRelease }) {
  return !hasUnreleasedHeads && hasPublishedRelease ? "reuse" : "publish";
}

function isUnchangedReleaseResponse(result) {
  return result?.ok === false && String(result.output ?? "").includes(UNCHANGED_RELEASE_ERROR);
}

function selfTestReleaseRecovery() {
  check(
    releasePublicationDecision({ hasUnreleasedHeads: false, hasPublishedRelease: true }) === "reuse",
    "metadata-only changes must reuse the current published release",
  );
  for (const scenario of [
    { hasUnreleasedHeads: true, hasPublishedRelease: true },
    { hasUnreleasedHeads: false, hasPublishedRelease: false },
  ]) {
    check(releasePublicationDecision(scenario) === "publish", `release decision should publish: ${stableJson(scenario)}`);
  }
  check(
    isUnchangedReleaseResponse({ ok: false, output: `HTTP 400: ${UNCHANGED_RELEASE_ERROR}` }),
    "the exact ConfigHub unchanged-bundle response must be recoverable",
  );
  check(
    !isUnchangedReleaseResponse({ ok: false, output: "HTTP 500: registry unavailable" })
      && !isUnchangedReleaseResponse({ ok: true, output: UNCHANGED_RELEASE_ERROR }),
    "unrelated failures or successful output must not be classified as unchanged-bundle recovery",
  );
  console.log("Kubara mini-IDP release recovery self-test passed");
}

function selfTestScenarioOperationEvidence() {
  const refA = "hx-web-prod-a/hx-web-deployment";
  const refB = "hx-web-prod-b/hx-web-deployment";
  const idA = "11111111-1111-4111-8111-111111111111";
  const idB = "22222222-2222-4222-8222-222222222222";
  const hashInitial = "a".repeat(64);
  const hashPromoted = "b".repeat(64);
  const unit = (ref, id, headRevisionNum, dataHash, approvalCount = 0) => ({
    ref,
    id,
    headRevisionNum,
    lastAppliedRevisionNum: headRevisionNum,
    dataHash,
    approvalCount,
    applyGates: {},
  });
  const facts = (units) => ({
    sourceFingerprint: `sha256:${"c".repeat(64)}`,
    units,
    releases: [],
    upgradeLinks: [],
    spaceMarkers: [],
  });
  const scenario = {
    checkpoints: [
      { id: "initial-rollout", facts: facts([unit(refA, idA, 10, hashInitial, 1)]) },
      {
        id: "prod-approval",
        facts: facts([
          unit(refA, idA, 20, hashPromoted, 1),
          unit(refB, idB, 30, hashPromoted, 1),
        ]),
      },
      {
        id: "prod-a-rollback",
        facts: facts([
          unit(refA, idA, 22, hashInitial, 1),
          unit(refB, idB, 30, hashPromoted, 1),
        ]),
      },
    ],
    operationEvidence: [
      {
        type: "expected-approval-block",
        ref: "hx-web-prod-a",
        transitionID: "base-promotion/hx-web-prod-a-approval-refusal",
        refusedHeads: [{ ref: refA, id: idA, headRevisionNum: 20, dataHash: hashPromoted }],
      },
      {
        type: "expected-approval-block",
        ref: "hx-web-prod-b",
        transitionID: "base-promotion/hx-web-prod-b-approval-refusal",
        refusedHeads: [{ ref: refB, id: idB, headRevisionNum: 30, dataHash: hashPromoted }],
      },
      {
        type: "unit-approve",
        ref: "hx-web-prod-a",
        transitionID: "prod-approval/hx-web-prod-a-approve-v1",
        approvedHeads: [{
          ref: refA,
          id: idA,
          headRevisionNum: 20,
          dataHash: hashPromoted,
          approvalCountBefore: 0,
          approvalCountAfter: 1,
        }],
      },
      {
        type: "unit-approve",
        ref: "hx-web-prod-b",
        transitionID: "prod-approval/hx-web-prod-b-approve-v1",
        approvedHeads: [{
          ref: refB,
          id: idB,
          headRevisionNum: 30,
          dataHash: hashPromoted,
          approvalCountBefore: 0,
          approvalCountAfter: 1,
        }],
      },
      {
        type: "rollback",
        ref: refA,
        transitionID: "prod-a-rollback/prod-a-restore-previous",
        unitID: idA,
        restoredRevisionNum: 10,
        restoredDataHash: hashInitial,
        sourceHeadRevisionNum: 20,
        sourceDataHash: hashPromoted,
        resultHeadRevisionNum: 21,
        resultDataHash: hashInitial,
      },
    ],
  };
  check(scenarioOperationProofValid(scenario), "valid exact approval and rollback evidence was rejected");
  const drifted = JSON.parse(JSON.stringify(scenario));
  drifted.operationEvidence.find((item) => item.type === "rollback").restoredRevisionNum = 9;
  check(!scenarioOperationProofValid(drifted), "rollback evidence not bound to the initial-rollout revision was accepted");
  const mismatchedApproval = JSON.parse(JSON.stringify(scenario));
  mismatchedApproval.operationEvidence.find(
    (item) => item.transitionID === "prod-approval/hx-web-prod-a-approve-v1",
  ).approvedHeads[0].headRevisionNum = 19;
  check(!scenarioOperationProofValid(mismatchedApproval), "approval evidence not bound to the refused head was accepted");
  console.log("Kubara mini-IDP scenario evidence self-test passed");
}

function selfTestReceiptLinkEvidence(desired) {
  const rows = desired.links.map((expected, index) => ({
    ref: `${expected.space}/${expected.slug}`,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    from: `${expected.space}/${expected.fromUnit}`,
    to: `${expected.toSpace}/${expected.toUnit}`,
    updateType: expected.updateType,
    autoUpdate: expected.autoUpdate,
    reason: expected.reason,
    labels: expected.labels,
  }));
  assertReceiptLinkEvidence(rows, desired.links);

  const expectRefusal = (mutate, pattern, description) => {
    const candidate = JSON.parse(JSON.stringify(rows));
    mutate(candidate);
    let error = null;
    try {
      assertReceiptLinkEvidence(candidate, desired.links);
    } catch (caught) {
      error = caught;
    }
    check(error && pattern.test(error.message), `${description}: expected ${pattern}, got ${error?.message ?? "success"}`);
  };
  const workloadRef = "hx-web-dev/needs-platform-binding";
  const platformCertRef = "hx-web-platform-dev/needs-cert-manager";
  const platformIngressRef = "hx-web-platform-dev/needs-traefik";
  expectRefusal(
    (candidate) => { candidate.find((row) => row.ref === workloadRef).from = "hx-web-dev/wrong-workload"; },
    /downstream endpoint drifted/,
    "receipt workload-to-platform downstream endpoint mutation",
  );
  expectRefusal(
    (candidate) => { candidate.find((row) => row.ref === platformCertRef).to = "hx-traefik-dev/hx-traefik"; },
    /upstream endpoint drifted/,
    "receipt platform-to-cert-manager endpoint mutation",
  );
  expectRefusal(
    (candidate) => { candidate.find((row) => row.ref === platformIngressRef).reason = "generic dependency"; },
    /reason drifted/,
    "receipt platform-to-traefik reason mutation",
  );
  expectRefusal(
    (candidate) => { candidate[1] = { ...candidate[0], id: candidate[1].id }; },
    /duplicate Link/,
    "receipt duplicate Link mutation",
  );
  console.log("Kubara mini-IDP receipt Link evidence self-test passed");
}

function selfTestArgoConvergence() {
  const expectedRevision = `sha256:${"a".repeat(64)}`;
  const olderRevision = `sha256:${"b".repeat(64)}`;
  const deployment = {
    space: "test-app",
    acceptedHealth: ["Healthy"],
  };
  check(
    kubernetesResourceNotFound('Error from server (NotFound): applications.argoproj.io "test-app" not found')
      && !kubernetesResourceNotFound("Unable to connect to the server: connection refused")
      && !kubernetesResourceNotFound("the server could not find the requested resource"),
    "the clean-room waiter must retry only an exact Kubernetes object NotFound",
  );
  const fingerprintA = `sha256:${"d".repeat(64)}`;
  const fingerprintB = `sha256:${"e".repeat(64)}`;
  check(
    operationJournalFingerprintDisposition({ executionFingerprint: fingerprintA, convergence: {}, namespaceMove: null }, fingerprintB) === "rotate"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: {},
        namespaceMove: { state: "observed-gone" },
      }, fingerprintB) === "rotate"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: { active: {} },
        namespaceMove: null,
      }, fingerprintB) === "blocked"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: {},
        namespaceMove: { state: "prepared" },
      }, fingerprintB) === "blocked"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: {},
        namespaceMove: null,
        protectedNamespaceDetachments: { one: { state: "prepared" } },
      }, fingerprintB) === "blocked"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: {},
        namespaceMove: null,
        protectedNamespaceDetachments: { one: { state: "patch-returned" } },
      }, fingerprintB) === "blocked"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: {},
        namespaceMove: null,
        protectedNamespaceDetachments: { one: { state: "observed-detached" } },
      }, fingerprintB) === "rotate"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: {},
        namespaceMove: null,
        scenario: { state: "started" },
      }, fingerprintB) === "blocked"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: {},
        namespaceMove: null,
        scenario: { state: "completed" },
      }, fingerprintB) === "rotate"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: {},
        namespaceMove: null,
        scenario: null,
        fleetBootstrap: { state: "started" },
      }, fingerprintB) === "blocked"
      && operationJournalFingerprintDisposition({
        executionFingerprint: fingerprintA,
        convergence: {},
        namespaceMove: null,
        scenario: null,
        fleetBootstrap: { state: "completed" },
      }, fingerprintB) === "rotate",
    "operation-journal fingerprints must rotate only when no operation is in flight",
  );
  const app = ({
    sync = "OutOfSync",
    health = "Progressing",
    phase = "Failed",
    revision = olderRevision,
    operationStateRevision = revision,
    operation = false,
  } = {}) => ({
    ...(operation ? { operation: { sync: {} } } : {}),
    status: {
      sync: { status: sync, revision },
      health: { status: health },
      operationState: { phase, syncResult: { revision: operationStateRevision } },
    },
  });
  const acceptedApp = app({ sync: "Synced", health: "Healthy", phase: "Succeeded", revision: expectedRevision });
  check(
    argoConvergenceState(acceptedApp, deployment, expectedRevision) === "accepted",
    "exact-revision healthy Argo state must be accepted",
  );
  check(
    argoConvergenceState(app({
      sync: "Synced",
      health: "Healthy",
      phase: "Succeeded",
      revision: expectedRevision,
      operation: true,
    }), deployment, expectedRevision) === "active-operation",
    "an active operation must take precedence over stale accepted sync and health status",
  );
  check(
    argoConvergenceState(app({ phase: "Running" }), deployment, expectedRevision) === "active-operation"
      && argoConvergenceState(app({ phase: "Terminating" }), deployment, expectedRevision) === "active-operation"
      && argoConvergenceState(app({ phase: "Unknown", operation: true }), deployment, expectedRevision) === "active-operation",
    "running, terminating, or submitted Argo operations must be observed without replacement",
  );
  check(
    argoConvergenceState(app({ sync: "Synced", health: "Progressing", phase: "Succeeded", revision: expectedRevision }), deployment, expectedRevision) === "health-pending",
    "exact-revision health settling must not trigger a resync",
  );
  check(
    argoConvergenceState(app({ sync: "OutOfSync", phase: "Failed", revision: expectedRevision }), deployment, expectedRevision) === "retryable"
      && argoConvergenceState(app({ sync: "Synced", health: "Progressing", phase: "Failed", revision: expectedRevision }), deployment, expectedRevision) === "retryable"
      && argoConvergenceState(app({ sync: "Synced", health: "Progressing", phase: "Error", revision: expectedRevision }), deployment, expectedRevision) === "retryable"
      && argoConvergenceState(app({ sync: "Synced", health: "Healthy", phase: "Succeeded", revision: olderRevision }), deployment, expectedRevision) === "retryable",
    "inactive terminal failure, OutOfSync, or wrong-revision states must be retryable",
  );
  check(
    argoConvergenceState(app({
      sync: "Synced",
      health: "Progressing",
      phase: "Failed",
      revision: expectedRevision,
      operationStateRevision: olderRevision,
    }), deployment, expectedRevision) === "health-pending",
    "a historical failed operation must not resync a current exact revision that is only waiting for health",
  );
  const progressAccepted = { ...deployment, acceptedHealth: ["Healthy", "Progressing"] };
  check(
    argoConvergenceState(app({ sync: "Synced", health: "Progressing", phase: "Succeeded", revision: expectedRevision }), progressAccepted, expectedRevision) === "accepted",
    "declared Progressing acceptance must remain immediate",
  );
  const oldStart = "2026-08-04T20:00:00Z";
  const firstObservation = Date.parse("2026-08-04T20:30:00Z");
  const secondObservation = Date.parse("2026-08-04T20:45:00Z");
  const validLaterStart = "2026-08-04T20:40:00Z";
  const futureStart = "2026-08-04T21:00:00Z";
  check(
    observedTimestamp(oldStart, firstObservation) === Date.parse(oldStart)
      && observedTimestamp(futureStart, firstObservation) === firstObservation
      && observedTimestamp(validLaterStart, firstObservation, secondObservation) === Date.parse(validLaterStart)
      && observedTimestamp(futureStart, firstObservation, secondObservation) === firstObservation
      && observedTimestamp("not-a-date", firstObservation) === firstObservation,
    "Argo controller timestamps must be bounded by their observation and reject future or invalid values",
  );
  const operationAt = (revision, timestamp) => ({
    status: {
      operationState: {
        startedAt: timestamp,
        finishedAt: timestamp,
        syncResult: { revision },
      },
    },
  });
  const wrongRevisionOperation = operationAt(olderRevision, oldStart);
  const oldOperation = operationAt(expectedRevision, oldStart);
  const laterOperation = operationAt(expectedRevision, validLaterStart);
  const futureOperation = operationAt(expectedRevision, futureStart);
  check(
    expectedRevisionTimestamp(wrongRevisionOperation, expectedRevision, "startedAt", firstObservation) === firstObservation
      && expectedRevisionTimestamp(oldOperation, expectedRevision, "startedAt", firstObservation) === Date.parse(oldStart)
      && expectedRevisionTimestamp(laterOperation, expectedRevision, "startedAt", firstObservation, secondObservation) === Date.parse(validLaterStart)
      && expectedRevisionTimestamp(futureOperation, expectedRevision, "startedAt", firstObservation, secondObservation) === firstObservation,
    "Argo controller timestamps must be accepted only for the expected revision and at or before the current observation",
  );
  const phaseStart = (state, previous = null, field = "startedAt") => convergencePhaseStartedAt(
    state, expectedRevision, field, firstObservation, previous, secondObservation,
  );
  const firstPhaseStart = phaseStart(oldOperation);
  const laterPhaseStart = phaseStart(laterOperation, firstPhaseStart);
  check(
    firstPhaseStart === firstObservation
      && laterPhaseStart === Date.parse(validLaterStart)
      && phaseStart(futureOperation, laterPhaseStart) === laterPhaseStart
      && phaseStart(wrongRevisionOperation, laterPhaseStart) === laterPhaseStart
      && phaseStart(laterOperation, null, "finishedAt") === Date.parse(validLaterStart),
    "phase clocks must not predate persisted observation or move for future and wrong-revision controller timestamps",
  );
  const journalDeployment = { cluster: "test-cluster", space: "test-app" };
  const firstJournalEntry = convergenceJournalEntry(journalDeployment, expectedRevision, firstObservation);
  const restartedJournalEntry = convergenceJournalEntry(
    journalDeployment,
    expectedRevision,
    secondObservation,
    { ...firstJournalEntry, syncReservations: 2, updatedAt: new Date(secondObservation).toISOString() },
  );
  const persistedStartedAt = Date.parse(restartedJournalEntry.startedAt);
  check(
    Date.parse(firstJournalEntry.startedAt) === firstObservation
      && Date.parse(firstJournalEntry.startedAt) !== Date.parse(oldStart)
      && persistedStartedAt === firstObservation
      && restartedJournalEntry.syncReservations === 2,
    "convergence journals must start at first reconciler observation and retain that clock and reservations across restarts",
  );
  check(
    withinDeadline(persistedStartedAt, persistedStartedAt + ARGO_CONVERGENCE_TIMEOUT_MS, ARGO_CONVERGENCE_TIMEOUT_MS)
      && !withinDeadline(persistedStartedAt, persistedStartedAt + ARGO_CONVERGENCE_TIMEOUT_MS + 1, ARGO_CONVERGENCE_TIMEOUT_MS)
      && !withinDeadline(persistedStartedAt, persistedStartedAt - 1, ARGO_CONVERGENCE_TIMEOUT_MS)
      && withinDeadline(firstPhaseStart, secondObservation, ARGO_OPERATION_TIMEOUT_MS),
    "persisted convergence and phase deadlines must include the exact boundary and fail closed beyond it",
  );
  const acceptedKey = convergenceJournalKey(journalDeployment, expectedRevision);
  const survivorKey = "survivor";
  const acceptedCleanupJournal = {
    convergence: {
      [acceptedKey]: { ...firstJournalEntry, startedAt: new Date(firstObservation - ARGO_CONVERGENCE_TIMEOUT_MS - 1).toISOString() },
      [survivorKey]: { application: "test-cluster/survivor" },
    },
  };
  check(
    argoConvergenceState(acceptedApp, deployment, expectedRevision) === "accepted"
      && !withinDeadline(
        Date.parse(acceptedCleanupJournal.convergence[acceptedKey].startedAt),
        firstObservation,
        ARGO_CONVERGENCE_TIMEOUT_MS,
      ),
    "accepted exact state must remain recognizable even after its persisted deadline",
  );
  clearConvergenceJournalEntry(acceptedCleanupJournal, acceptedKey);
  check(
    !Object.hasOwn(acceptedCleanupJournal.convergence, acceptedKey)
      && Object.hasOwn(acceptedCleanupJournal.convergence, survivorKey),
    "accepted-state cleanup must remove only its exact convergence journal entry",
  );
  check(
    activeOperationMatchesExpectedRevision({
      operation: { sync: { revision: expectedRevision } },
      status: { operationState: { phase: "Running", syncResult: { revision: olderRevision } } },
    }, expectedRevision) === true
      && activeOperationMatchesExpectedRevision({
        operation: { sync: { revision: olderRevision } },
        status: { sync: { revision: expectedRevision }, operationState: { phase: "Running", syncResult: { revision: expectedRevision } } },
      }, expectedRevision) === false
      && activeOperationMatchesExpectedRevision({
        operation: { sync: {} },
        status: { sync: { revision: expectedRevision }, operationState: { phase: "Running", syncResult: { revision: expectedRevision } } },
      }, expectedRevision) === false,
    "namespace-move authorization must require the explicit active operation revision rather than historical sync status",
  );
  const workload = (namespace) => ({
    apiVersion: "apps/v1",
    kind: "DaemonSet",
    metadata: { namespace },
    spec: { template: { spec: { hostNetwork: true, containers: [{ ports: [{ protocol: "TCP", containerPort: 9100 }] }] } } },
  });
  check(
    stableJson(hostNetworkBindings(workload("default"))) === stableJson(["TCP/9100"])
      && hostNetworkBindings(workload("default")).some((binding) => hostNetworkBindings(workload("monitoring")).includes(binding)),
    "namespace-move pruning must prove an exact shared host-network binding",
  );
  const runtimeFixture = {
    items: [...new Set(ARGO_CD_RUNTIME_CONTAINER_PAIRS.map(([name]) => name))].map((name) => ({
      metadata: { name },
      spec: {
        template: {
          spec: {
            containers: ARGO_CD_RUNTIME_CONTAINER_PAIRS
              .filter(([workloadName]) => workloadName === name)
              .map(([, container]) => ({ name: container, image: ARGO_CD_RUNTIME_IMAGE })),
          },
        },
      },
    })),
  };
  const runtimeObservation = validateClusterLocalArgoRuntime("self-test", runtimeFixture);
  check(
    stableJson(runtimeObservation.references.map((row) => [row.workload, row.container]))
      === stableJson(ARGO_CD_RUNTIME_CONTAINER_PAIRS),
    "cluster-local Argo runtime evidence must retain the exact reviewed workload/container pairs",
  );
  const wrongRegistryFixture = JSON.parse(JSON.stringify(runtimeFixture));
  wrongRegistryFixture.items
    .find((item) => item.metadata.name === "argocd-repo-server")
    .spec.template.spec.containers
    .find((container) => container.name === "copyutil").image = "example.invalid/argocd:v3.4.6";
  let wrongRegistryError = null;
  try {
    validateClusterLocalArgoRuntime("self-test", wrongRegistryFixture);
  } catch (error) {
    wrongRegistryError = error;
  }
  check(
    wrongRegistryError?.message.includes("argocd-repo-server/copyutil")
      && wrongRegistryError.message.includes(ARGO_CD_RUNTIME_IMAGE),
    "cluster-local Argo runtime evidence must refuse a named container that drifts outside the expected registry",
  );
  console.log("Kubara mini-IDP Argo convergence self-test passed");
}

function releaseManifestDigest(release) {
  const bundleDigest = release?.Digest ?? release?.Release?.Digest ?? "";
  const manifestDigest = release?.ManifestDigest ?? release?.Release?.ManifestDigest ?? "";
  check(
    /^sha256:[0-9a-f]{64}$/.test(bundleDigest),
    `ConfigHub bundle content digest is missing or invalid: ${bundleDigest || "empty"}`,
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(manifestDigest),
    `ConfigHub OCI manifest digest is missing or invalid: ${manifestDigest || "empty"}`,
  );
  return manifestDigest;
}

function latestRelease(space) {
  if (activeVerificationReadSnapshot) {
    activeVerificationReadSnapshot.evidenceByResource.get("release").servedReads += 1;
    return activeVerificationReadSnapshot.releasesBySpace.get(space)?.[0] ?? null;
  }
  const rows = unwrapRows(cubJson([
    "release", "list", "--space", space,
    "--where", "Published = true",
    "--select", "Digest,ManifestDigest,ReleaseNum,CreatedAt",
  ]), "Release");
  return rows
    .sort((left, right) => Number(right.ReleaseNum ?? 0) - Number(left.ReleaseNum ?? 0)
      || String(right.CreatedAt ?? "").localeCompare(String(left.CreatedAt ?? "")))[0] ?? null;
}

function kubectl(cluster, args, options = {}) {
  return command("kubectl", [
    "--kubeconfig", clusterKubeconfig(cluster),
    "--context", `kind-${cluster}`,
    ...args,
  ], options);
}

function kubectlTry(cluster, args, options = {}) {
  return tryCommand("kubectl", [
    "--kubeconfig", clusterKubeconfig(cluster),
    "--context", `kind-${cluster}`,
    ...args,
  ], options);
}

function observeClusterLocalArgoRuntime(cluster) {
  const workloads = JSON.parse(kubectl(cluster, [
    "get", "deployment,statefulset", "-n", "argocd", "-o", "json",
  ]));
  return validateClusterLocalArgoRuntime(cluster, workloads);
}

function validateClusterLocalArgoRuntime(cluster, workloads) {
  const allContainers = [];
  for (const item of workloads.items ?? []) {
    for (const container of [
      ...(item.spec?.template?.spec?.initContainers ?? []),
      ...(item.spec?.template?.spec?.containers ?? []),
    ]) {
      allContainers.push({
        workload: item.metadata?.name,
        container: container.name,
        image: container.image,
      });
    }
  }
  const expectedWorkloads = [...new Set(ARGO_CD_RUNTIME_CONTAINER_PAIRS.map(([workload]) => workload))].sort();
  const observedWorkloads = [...new Set((workloads.items ?? []).map((item) => item.metadata?.name))].sort();
  check(
    stableJson(observedWorkloads) === stableJson(expectedWorkloads),
    `${cluster}: Argo CD workload inventory drifted: ${observedWorkloads.join(", ")}`,
  );
  const containersByPair = new Map();
  for (const item of allContainers) {
    const key = `${item.workload}/${item.container}`;
    check(!containersByPair.has(key), `${cluster}: duplicate Argo CD workload/container pair ${key}`);
    containersByPair.set(key, item);
  }
  const expectedPairKeys = new Set(ARGO_CD_RUNTIME_CONTAINER_PAIRS.map(([workload, container]) => `${workload}/${container}`));
  const references = ARGO_CD_RUNTIME_CONTAINER_PAIRS.map(([workload, container]) => {
    const key = `${workload}/${container}`;
    const item = containersByPair.get(key);
    check(item, `${cluster}: expected Argo CD workload/container pair ${key} is missing`);
    check(item.image === ARGO_CD_RUNTIME_IMAGE, `${cluster}: ${key} is ${item.image ?? "missing"}, expected ${ARGO_CD_RUNTIME_IMAGE}`);
    return item;
  });
  const unexpectedRuntimePairs = allContainers
    .filter((item) => String(item.image ?? "").startsWith("quay.io/argoproj/argocd:")
      && !expectedPairKeys.has(`${item.workload}/${item.container}`));
  check(
    unexpectedRuntimePairs.length === 0,
    `${cluster}: unexpected Argo CD runtime workload/container pairs: ${unexpectedRuntimePairs.map((item) => `${item.workload}/${item.container}`).join(", ")}`,
  );
  return {
    cluster,
    installedBy: "cub cluster up",
    version: ARGO_CD_RUNTIME_VERSION,
    image: ARGO_CD_RUNTIME_IMAGE,
    references,
  };
}

function waitForSpecialPrerequisite(deployment) {
  if (deployment.space === "hx-eso-store-dev") {
    kubectl(DEV.cluster, ["wait", "--for=condition=Ready", "clustersecretstore/hx-app-dev-dev", "--timeout=5m"]);
  }
  if (deployment.space === "hx-eso-grafana-es-dev") {
    kubectl(DEV.cluster, ["wait", "--for=condition=Ready", "externalsecret/grafana-admin-credentials-es", "-n", "kube-prometheus-stack", "--timeout=5m"]);
    const secret = JSON.parse(kubectl(DEV.cluster, ["get", "secret", "grafana-admin-credentials", "-n", "kube-prometheus-stack", "-o", "json"]));
    check(
      (secret.metadata?.ownerReferences ?? []).some(
        (owner) => owner.apiVersion === "external-secrets.io/v1"
          && owner.kind === "ExternalSecret"
          && owner.name === "grafana-admin-credentials-es"
          && owner.controller === true,
      ),
      "Grafana credentials Secret is not owned by the expected ExternalSecret",
    );
  }
}

function reconcileLinks(desired, state) {
  for (const expected of desired.links) {
    const existing = readLinks(expected.space).find((item) => item.Slug === expected.slug);
    if (!existing) {
      cub([
        "link", "create", "--space", expected.space,
        expected.slug, expected.fromUnit, expected.toUnit, expected.toSpace,
        "--update-type", "NeedsProvides",
        "--make-current",
        "--no-auto-update",
        "--annotation", `${LINK_REASON_ANNOTATION}=${expected.reason}`,
        ...labelsArgs(expected.labels),
        "--wait", "--quiet",
      ]);
      recordAction(state, "link-create", `${expected.space}/${expected.slug}`, `${expected.toSpace}/${expected.toUnit}`);
      continue;
    }
    const from = readUnit(expected.space, expected.fromUnit);
    const to = readUnit(expected.toSpace, expected.toUnit);
    const toSpace = unwrapEntity(cubJson(["space", "get", expected.toSpace]), "Space");
    check(from && to, `${expected.space}/${expected.slug}: endpoint Unit missing`);
    if (
      existing.FromUnitID !== from.UnitID
      || existing.ToUnitID !== to.UnitID
      || existing.ToSpaceID !== toSpace.SpaceID
      || existing.UpdateType !== "NeedsProvides"
      || existing.AutoUpdate === true
      || !mapMatches(existing.Labels, expected.labels)
      || staleOwnedLinkLabels(existing.Labels, expected.labels).length > 0
      || existing.Annotations?.[LINK_REASON_ANNOTATION] !== expected.reason
    ) {
      cub([
        "link", "update", "--space", expected.space,
        expected.slug, expected.fromUnit, expected.toUnit, expected.toSpace,
        "--update-type", "NeedsProvides",
        "--make-current",
        "--no-auto-update",
        "--annotation", `${LINK_REASON_ANNOTATION}=${expected.reason}`,
        ...labelsArgs(expected.labels),
        ...staleOwnedLinkLabels(existing.Labels, expected.labels)
          .flatMap((key) => ["--label", `${key}=-`]),
        "--wait", "--quiet",
      ]);
      recordAction(state, "link-update", `${expected.space}/${expected.slug}`, `${expected.toSpace}/${expected.toUnit}`);
    }
  }
}

function verifyLive(inputs, desired, { state = null } = {}) {
  assertKubaraOrganization();
  const findings = [];
  const spaces = readSpaces();
  beginVerificationReadSnapshot(spaces);
  const controlSpace = unwrapEntity(cubJson(["space", "get", CONTROL_SPACE]), "Space");
  check(controlSpace.OrganizationID === ORGANIZATION_ENTITY_ID, `${CONTROL_SPACE}: organization entity ID drifted from the pinned Kubara org`);
  assertSpaceAllowlist(spaces, desired, { requireAll: true });
  assertDeliveryTopology(spaces, desired, {
    requireAllApplications: true,
    requireApplicationMetadata: true,
  });
  assertManagedLinkInventory(desired, { requireNeedsProvides: true });
  const preservedControlUnits = assertPreservedFaithfulControlUnits();
  const localClusters = new Set(kindClusters());
  const targets = new Map();
  const deliveryRuntimes = [];
  for (const item of FLEET) {
    if (!localClusters.has(item.cluster)) findings.push(`${item.cluster}: kind cluster missing`);
    if (!existsSync(clusterKubeconfig(item.cluster))) findings.push(`${item.cluster}: kubeconfig missing`);
    if (!existsSync(clusterEnv(item.cluster))) findings.push(`${item.cluster}: env file missing`);
    if (localClusters.has(item.cluster) && existsSync(clusterKubeconfig(item.cluster))) {
      try {
        deliveryRuntimes.push(observeClusterLocalArgoRuntime(item.cluster));
      } catch (error) {
        findings.push(error.message);
      }
    }
    const targetEntity = readTarget(item.cluster);
    if (!targetEntity) findings.push(`${item.cluster}/target: missing`);
    else targets.set(item.cluster, targetEntity);
  }

  const spaceRows = [];
  for (const expected of desired.spaces) {
    const live = spaces.get(expected.slug);
    if (!live) {
      findings.push(`${expected.slug}: Space missing`);
      continue;
    }
    for (const [key, value] of Object.entries(expected.labels)) {
      if (live.Labels?.[key] !== value) findings.push(`${expected.slug}: label ${key}=${JSON.stringify(live.Labels?.[key])}, expected ${JSON.stringify(value)}`);
    }
    for (const key of staleOwnedLabels(live.Labels, expected.labels)) findings.push(`${expected.slug}: stale owned label ${key}`);
    const expectedAnnotations = expected.annotations ?? {};
    for (const [key, value] of Object.entries(expectedAnnotations)) {
      if (live.Annotations?.[key] !== value) findings.push(`${expected.slug}: annotation ${key} drifted`);
    }
    for (const key of staleOwnedPublicAnnotations(live.Annotations, expectedAnnotations)) findings.push(`${expected.slug}: stale owned navigation annotation ${key}`);
    spaceRows.push({
      slug: expected.slug,
      id: live.SpaceID,
      type: expected.type,
      labels: expected.labels,
      annotations: expectedAnnotations,
      releaseTargetID: live.ReleaseTargetID ?? null,
      triggerFilterID: live.TriggerFilterID ?? null,
    });
  }

  const unitRows = [];
  const expectedUnitsBySpace = new Map();
  for (const expected of desired.managedUnits) {
    if (!expected.payloadKey) {
      findings.push(`${expected.space}/${expected.slug}: planned payload missing`);
      continue;
    }
    if (!expectedUnitsBySpace.has(expected.space)) expectedUnitsBySpace.set(expected.space, []);
    expectedUnitsBySpace.get(expected.space).push(expected.slug);
    const live = readUnit(expected.space, expected.slug);
    if (!live) {
      findings.push(`${expected.space}/${expected.slug}: Unit missing`);
      continue;
    }
    const payload = inputs.payloads.get(expected.payloadKey);
    if (!payload) {
      findings.push(`${expected.space}/${expected.slug}: payload ${expected.payloadKey} missing`);
      continue;
    }
    if (live.ToolchainType !== expected.toolchain) findings.push(`${expected.space}/${expected.slug}: toolchain ${live.ToolchainType}, expected ${expected.toolchain}`);
    if ((live.ProviderType ?? null) !== (expected.provider ?? null)) findings.push(`${expected.space}/${expected.slug}: provider ${live.ProviderType ?? "default"}, expected ${expected.provider ?? "default"}`);
    if (!mapMatches(live.Labels, expected.labels)) findings.push(`${expected.space}/${expected.slug}: labels drifted`);
    for (const key of staleOwnedUnitLabels(live.Labels, expected.labels)) findings.push(`${expected.space}/${expected.slug}: stale owned label ${key}`);
    const annotations = {
      ...sourceAnnotation(payload.value, payload.sourcePaths, payload.transform),
      ...(expected.annotations ?? {}),
    };
    if (!mapMatches(live.Annotations, annotations)) findings.push(`${expected.space}/${expected.slug}: source annotations drifted`);
    for (const key of staleOwnedPublicAnnotations(live.Annotations, annotations)) findings.push(`${expected.space}/${expected.slug}: stale owned navigation annotation ${key}`);
    const liveData = cub(["unit", "data", "--space", expected.space, expected.slug]);
    if (!sameUnitData(expected.toolchain, liveData, payload.value)) findings.push(`${expected.space}/${expected.slug}: data drifted from ${expected.payloadKey}`);
    if (expected.target) {
      const cluster = expected.target.split("/")[0];
      if (live.TargetID !== targets.get(cluster)?.TargetID) findings.push(`${expected.space}/${expected.slug}: target drifted`);
    } else if (live.TargetID) {
      findings.push(`${expected.space}/${expected.slug}: base/control Unit unexpectedly has a target`);
    }
    if (expected.upstream) {
      const [upstreamSpace, upstreamSlug] = expected.upstream.split("/");
      const upstream = readUnit(upstreamSpace, upstreamSlug);
      if (!upstream || live.UpstreamUnitID !== upstream.UnitID) findings.push(`${expected.space}/${expected.slug}: upstream link is not ${expected.upstream}`);
    }
    if (expected.prodProtected) {
      if (!gateEnabled(live.DeleteGates, PROD_SAFETY_GATE)) findings.push(`${expected.space}/${expected.slug}: delete gate missing`);
      if (!gateEnabled(live.DestroyGates, PROD_SAFETY_GATE)) findings.push(`${expected.space}/${expected.slug}: destroy gate missing`);
    }
    unitRows.push({
      ref: `${expected.space}/${expected.slug}`,
      id: live.UnitID,
      role: expected.role,
      toolchain: live.ToolchainType,
      provider: live.ProviderType ?? null,
      targetID: live.TargetID ?? null,
      upstreamUnitID: live.UpstreamUnitID ?? null,
      headRevisionNum: live.HeadRevisionNum,
      dataHash: live.DataHash,
      sourceSha256: `sha256:${payload.sha256}`,
      labels: expected.labels,
      navigationAnnotations: expected.annotations ?? {},
    });
  }
  for (const [space, expectedSlugs] of expectedUnitsBySpace) {
    const actual = readUnitRows(space).map((item) => item.Slug).sort();
    const allowedSlugs = space === CONTROL_SPACE
      ? [...expectedSlugs, ...PRESERVED_FAITHFUL_CONTROL_UNITS.map((item) => item.slug)].sort()
      : expectedSlugs.sort();
    if (stableJson(actual) !== stableJson(allowedSlugs)) findings.push(`${space}: unexpected managed Unit inventory ${actual.join(", ")}`);
  }

  const policy = verifyPolicy(desired, findings);
  const linkRows = verifyLinks(desired, findings);
  const releases = [];
  const applications = [];
  for (const deployment of desired.deployments) {
    const release = latestRelease(deployment.space);
    const bundleDigest = release?.Digest ?? "";
    const manifestDigest = release?.ManifestDigest ?? "";
    const expectedRevision = manifestDigest;
    if (!release || !/^sha256:[0-9a-f]{64}$/.test(bundleDigest)) {
      findings.push(`${deployment.space}: published bundle content digest missing`);
    } else if (!/^sha256:[0-9a-f]{64}$/.test(manifestDigest)) {
      findings.push(`${deployment.space}: published OCI manifest digest missing`);
    } else {
      releases.push({
        space: deployment.space,
        id: release.ReleaseID,
        bundleDigest,
        manifestDigest,
        createdAt: release.CreatedAt,
      });
    }
    const appUnit = readUnit(deployment.appSpace, deployment.appUnit);
    if (!appUnit) {
      findings.push(`${deployment.appSpace}/${deployment.appUnit}: Argo Application Unit missing`);
      continue;
    }
    if (appUnit.TargetID !== targets.get(deployment.cluster)?.TargetID) {
      findings.push(`${deployment.appSpace}/${deployment.appUnit}: target drifted`);
    }
    const appDocs = parseDocs(cub(["unit", "data", "--space", deployment.appSpace, deployment.appUnit]));
    const app = appDocs[0];
    try {
      assertArgoApplicationContract(app, deployment);
    } catch (error) {
      findings.push(error.message);
    }
    const options = app?.spec?.syncPolicy?.syncOptions ?? [];
    if (options.some((item) => String(item).startsWith("Replace="))) findings.push(`${deployment.appSpace}/${deployment.appUnit}: Replace sync option remains`);
    const expectedOptions = applicationSyncOptions(deployment);
    if (stableJson(options) !== stableJson(expectedOptions)) findings.push(`${deployment.appSpace}/${deployment.appUnit}: sync options drifted from ${stableJson(expectedOptions)}`);
    const expectedSyncPolicy = applicationSyncPolicy(deployment);
    if (stableJson(app?.spec?.syncPolicy) !== stableJson(expectedSyncPolicy)) findings.push(`${deployment.appSpace}/${deployment.appUnit}: automated sync policy drifted`);
    const expectedDestination = {
      server: "https://kubernetes.default.svc",
      namespace: deployment.destinationNamespace,
    };
    if (stableJson(app?.spec?.destination) !== stableJson(expectedDestination)) findings.push(`${deployment.appSpace}/${deployment.appUnit}: destination contract drifted`);
    const ignoreDifferences = app?.spec?.ignoreDifferences ?? [];
    if (deployment.ignoreInjectedCertificateData && stableJson(ignoreDifferences) !== stableJson(certificateIgnoreDifferences())) findings.push(`${deployment.appSpace}/${deployment.appUnit}: certificate ignoreDifferences drifted`);
    if (!deployment.ignoreInjectedCertificateData && ignoreDifferences.length !== 0) findings.push(`${deployment.appSpace}/${deployment.appUnit}: unexpected ignoreDifferences`);
    const observed = readApplication(deployment.cluster, deployment.space);
    if (!observed.exists) {
      findings.push(`${deployment.cluster}/${deployment.space}: Argo Application missing`);
    } else {
      if (observed.sync !== "Synced") findings.push(`${deployment.cluster}/${deployment.space}: sync=${observed.sync}`);
      if (!deployment.acceptedHealth.includes(observed.health)) findings.push(`${deployment.cluster}/${deployment.space}: health=${observed.health}, expected ${deployment.acceptedHealth.join("|")}`);
      if (observed.revision !== expectedRevision) findings.push(`${deployment.cluster}/${deployment.space}: revision=${observed.revision}, expected ${expectedRevision}`);
    }
    applications.push({
      cluster: deployment.cluster,
      name: deployment.space,
      destinationNamespace: deployment.destinationNamespace,
      expectedRevision,
      observedRevision: observed.revision,
      syncState: observed.sync,
      healthState: observed.health,
      acceptedHealth: deployment.acceptedHealth,
      conditions: observed.conditions,
    });
  }

  const protectedNamespaces = observeProtectedNamespacePostconditions(findings);
  const kindTraefik = observeKindTraefikLive(findings);

  let scenario = [];
  try {
    for (const slug of ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)]) {
      if (spaces.get(slug)?.Labels?.ScenarioVersion !== SCENARIO_VERSION) findings.push(`${slug}: scenario marker ${SCENARIO_VERSION} missing`);
    }
    scenario = verifyHxWebFinalState(inputs);
  } catch (error) {
    findings.push(error.message);
  }
  const secretWiring = observeGrafanaSecretWiring(findings);
  const liveMatrix = observeLiveMatrix(inputs, desired, applications);
  for (const row of liveMatrix.rows.filter((item) => item.deliveryState === "delivered")) {
    if (row.syncState !== "Synced") findings.push(`matrix ${row.cluster}/${row.component}: sync=${row.syncState}`);
    if (row.readiness?.result === "fail") findings.push(`matrix ${row.cluster}/${row.component}: workloads not ready`);
  }

  const bulkSnapshots = finishVerificationReadSnapshot(spaces);
  const measuredPerformance = performanceEvidence(
    `${mode === "--apply" ? "apply" : "verify"}-process-through-live-verification`,
    bulkSnapshots,
  );
  measuredPerformance.phases = state?.performancePhases ?? [];
  check(findings.length === 0, `Kubara mini-IDP verification failed:\n- ${findings.join("\n- ")}`);
  return {
    organizationID: controlSpace.OrganizationID,
    spaces: spaceRows,
    units: unitRows,
    preservedControlUnits,
    links: linkRows,
    policy,
    releases,
    applications,
    protectedNamespaces,
    kindTraefik,
    deliveryRuntimes,
    scenario,
    secretWiring,
    liveMatrix,
    performance: measuredPerformance,
    clusters: FLEET.map((item) => ({
      name: item.cluster,
      environment: item.environment,
      region: item.region,
      kind: localClusters.has(item.cluster),
      kubeconfig: existsSync(clusterKubeconfig(item.cluster)),
      targetID: targets.get(item.cluster)?.TargetID ?? null,
      spaceID: spaces.get(item.cluster)?.SpaceID ?? null,
      appsSpaceID: spaces.get(`${item.cluster}-argo-apps`)?.SpaceID ?? null,
    })),
    actionCount: state?.actions.length ?? 0,
  };
}

function observeProtectedNamespacePostconditions(findings) {
  const rows = [];
  const observedAt = new Date().toISOString();
  for (const contract of PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS) {
    try {
      const retained = readProtectedNamespace(contract.cluster, contract.retainedNamespace);
      const replacement = readProtectedNamespace(contract.cluster, contract.replacementNamespace);
      check(retained, `${contract.migrationID}: protected Namespace/${contract.retainedNamespace} is missing`);
      check(replacement, `${contract.migrationID}: replacement Namespace/${contract.replacementNamespace} is missing`);
      const classification = classifyProtectedNamespaceOwnership(contract, retained, replacement);
      check(
        classification.state === "already-detached",
        `${contract.migrationID}: obsolete Kubara ownership still claims protected Namespace/${contract.retainedNamespace}`,
      );
      const row = {
        migrationID: contract.migrationID,
        cluster: contract.cluster,
        application: `${contract.cluster}/${contract.application}`,
        namespace: contract.retainedNamespace,
        replacementNamespace: contract.replacementNamespace,
        sourceUnit: `${contract.spaceSlug}/${contract.unitSlug}`,
        uid: classification.retainedUID,
        replacementUID: classification.replacementUID,
        state: "retained-clean",
        phase: retained.status?.phase,
        ownershipFieldsAbsent: true,
        replacementTrackingID: contract.replacementTrackingID,
        replacementOriginRevision: classification.replacementOrigin.revisionNum,
        observedAt,
      };
      assertProtectedNamespaceCurrentObservation(
        row,
        contract,
        `${contract.migrationID}: live protected Namespace postcondition`,
      );
      rows.push(row);
    } catch (error) {
      findings.push(error.message);
    }
  }
  return rows;
}

function observeKindTraefikLive(findings) {
  let dockerByCluster = new Map();
  try {
    dockerByCluster = new Map(
      observeKindTraefikDockerBindings().map((item) => [item.cluster, item]),
    );
  } catch (error) {
    findings.push(error.message);
  }
  const rows = [];
  const observedAt = new Date().toISOString();
  for (const contract of KIND_TRAEFIK_CONTRACTS) {
    try {
      const result = kubectlTry(contract.cluster, [
        "get",
        "service,deployment,ingress.networking.k8s.io,certificate.cert-manager.io",
        "-A", "-o", "json",
      ]);
      check(result.ok, `${contract.cluster}: cannot read the live Traefik/application endpoint contract: ${result.output}`);
      const evidence = assertKindTraefikLiveObjects(contract, JSON.parse(result.output));
      const docker = dockerByCluster.get(contract.cluster);
      check(docker, `${contract.cluster}: Docker NodePort evidence is missing`);
      const probes = evidence.applications.map((application) => {
        const host = `${application.id}.local`;
        const url = `http://127.0.0.1:${contract.httpNodePort}/`;
        const probe = tryCommand("curl", [
          "--noproxy", "*",
          "--silent", "--show-error", "--fail",
          "--connect-timeout", "3", "--max-time", "15",
          "--output", "/dev/null", "--write-out", "%{http_code}",
          "--header", `Host: ${host}`,
          url,
        ], { timeout: 20_000 });
        check(probe.ok, `${contract.cluster}/${application.id}: NodePort probe failed: ${probe.output}`);
        const statusCode = probe.output.trim();
        check(statusCode === "200", `${contract.cluster}/${application.id}: NodePort probe returned HTTP ${statusCode || "unknown"}`);
        return { application: application.id, hostHeader: host, url, statusCode: 200 };
      });
      rows.push({ ...evidence, docker, probes, observedAt });
    } catch (error) {
      findings.push(error.message);
    }
  }
  return rows;
}

function observeGrafanaSecretWiring(findings) {
  const read = (args, ref) => {
    const result = kubectlTry(DEV.cluster, [...args, "-o", "json"]);
    if (!result.ok) {
      findings.push(`${ref}: missing (${result.output.slice(0, 300)})`);
      return null;
    }
    return JSON.parse(result.output);
  };
  const ready = (resource) => (resource?.status?.conditions ?? []).some(
    (condition) => condition.type === "Ready" && condition.status === "True",
  );
  const store = read(["get", "clustersecretstore", "hx-app-dev-dev"], "ClusterSecretStore/hx-app-dev-dev");
  const externalSecret = read(
    ["get", "externalsecret", "grafana-admin-credentials-es", "-n", "kube-prometheus-stack"],
    "ExternalSecret/kube-prometheus-stack/grafana-admin-credentials-es",
  );
  const secret = read(
    ["get", "secret", "grafana-admin-credentials", "-n", "kube-prometheus-stack"],
    "Secret/kube-prometheus-stack/grafana-admin-credentials",
  );
  const owner = (secret?.metadata?.ownerReferences ?? []).find(
    (item) => item.apiVersion === "external-secrets.io/v1"
      && item.kind === "ExternalSecret"
      && item.name === "grafana-admin-credentials-es"
      && item.controller === true,
  );
  if (store && !ready(store)) findings.push("ClusterSecretStore/hx-app-dev-dev: Ready is not True");
  if (externalSecret && !ready(externalSecret)) findings.push("ExternalSecret/kube-prometheus-stack/grafana-admin-credentials-es: Ready is not True");
  if (externalSecret?.spec?.secretStoreRef?.kind !== "ClusterSecretStore" || externalSecret?.spec?.secretStoreRef?.name !== "hx-app-dev-dev") {
    findings.push("ExternalSecret/kube-prometheus-stack/grafana-admin-credentials-es: store reference drifted");
  }
  if (externalSecret?.spec?.target?.name !== "grafana-admin-credentials" || externalSecret?.spec?.target?.creationPolicy !== "Owner") {
    findings.push("ExternalSecret/kube-prometheus-stack/grafana-admin-credentials-es: target contract drifted");
  }
  if (secret && !owner) findings.push("Secret/kube-prometheus-stack/grafana-admin-credentials: ESO owner reference missing");
  for (const key of ["admin-user", "admin-password"]) {
    if (secret && !secret.data?.[key]) findings.push(`Secret/kube-prometheus-stack/grafana-admin-credentials: ${key} data missing`);
  }
  return {
    cluster: DEV.cluster,
    store: { name: "hx-app-dev-dev", ready: ready(store) },
    externalSecret: {
      namespace: "kube-prometheus-stack",
      name: "grafana-admin-credentials-es",
      ready: ready(externalSecret),
      storeRef: externalSecret?.spec?.secretStoreRef ?? null,
      target: externalSecret?.spec?.target?.name ?? null,
    },
    secret: {
      namespace: "kube-prometheus-stack",
      name: "grafana-admin-credentials",
      ownerKind: owner?.kind ?? null,
      ownerName: owner?.name ?? null,
      keysPresent: ["admin-user", "admin-password"].filter((key) => Boolean(secret?.data?.[key])).sort(),
    },
  };
}

function verifyPolicy(desired, findings) {
  const triggerResult = cubTry(["trigger", "get", "--space", CONTROL_SPACE, APPROVAL_TRIGGER, "-o", "json"]);
  const filterResult = cubTry(["filter", "get", "--space", CONTROL_SPACE, APPROVAL_FILTER, "-o", "json"]);
  if (!triggerResult.ok) findings.push(`${CONTROL_SPACE}/${APPROVAL_TRIGGER}: Trigger missing`);
  if (!filterResult.ok) findings.push(`${CONTROL_SPACE}/${APPROVAL_FILTER}: Filter missing`);
  if (!triggerResult.ok || !filterResult.ok) return {};
  const trigger = unwrapEntity(JSON.parse(triggerResult.output), "Trigger");
  const filter = unwrapEntity(JSON.parse(filterResult.output), "Filter");
  const triggerArgumentsExact = stableJson(trigger.Arguments ?? []) === stableJson([
    { ParameterName: "num-approvers", Value: "1" },
  ]);
  if (
    trigger.FunctionName !== "vet-approvedby"
    || trigger.Event !== "Mutation"
    || trigger.ToolchainType !== "Kubernetes/YAML"
    || !triggerArgumentsExact
    || trigger.Disabled === true
    || trigger.Validating !== true
    || Number(trigger.FailOpenAfter ?? 0) !== 0
  ) findings.push(`${CONTROL_SPACE}/${APPROVAL_TRIGGER}: Trigger definition drifted`);
  if (filter.From !== "Trigger" || filter.Where !== "Space.Slug = 'hx-platform' AND FunctionName = 'vet-approvedby'") findings.push(`${CONTROL_SPACE}/${APPROVAL_FILTER}: Filter definition drifted`);
  const productionSpaces = desired.spaces.filter((item) => item.prodProtected).map((item) => item.slug).sort();
  for (const slug of productionSpaces) {
    const space = unwrapEntity(cubJson(["space", "get", slug]), "Space");
    if (space.TriggerFilterID !== filter.FilterID) findings.push(`${slug}: production approval Filter not attached`);
    if (stableJson([...(space.TriggerIDs ?? [])].sort()) !== stableJson([trigger.TriggerID])) findings.push(`${slug}: approval Trigger selection is not exact`);
  }
  return {
    trigger: {
      ref: `${CONTROL_SPACE}/${APPROVAL_TRIGGER}`,
      id: trigger.TriggerID,
      function: trigger.FunctionName,
      arguments: trigger.Arguments,
    },
    filter: {
      ref: `${CONTROL_SPACE}/${APPROVAL_FILTER}`,
      id: filter.FilterID,
      where: filter.Where,
    },
    productionSpaces,
    gate: APPROVAL_GATE,
    deleteDestroyGate: PROD_SAFETY_GATE,
  };
}

function verifyLinks(desired, findings) {
  const rows = [];
  const spacesForLinkVerification = readSpaces();
  for (const expected of desired.links) {
    const live = readLinks(expected.space).find((item) => item.Slug === expected.slug);
    if (!live) {
      findings.push(`${expected.space}/${expected.slug}: NeedsProvides Link missing`);
      continue;
    }
    const from = readUnit(expected.space, expected.fromUnit);
    const to = readUnit(expected.toSpace, expected.toUnit);
    const toSpace = spacesForLinkVerification.get(expected.toSpace);
    if (!from || !to || !toSpace || live.FromUnitID !== from.UnitID || live.ToUnitID !== to.UnitID || live.ToSpaceID !== toSpace.SpaceID) findings.push(`${expected.space}/${expected.slug}: Link endpoint drifted`);
    if (live.UpdateType !== "NeedsProvides") findings.push(`${expected.space}/${expected.slug}: UpdateType=${live.UpdateType}`);
    if (live.AutoUpdate === true) findings.push(`${expected.space}/${expected.slug}: AutoUpdate must be false`);
    if (!mapMatches(live.Labels, expected.labels)) findings.push(`${expected.space}/${expected.slug}: semantic Link labels drifted`);
    for (const key of staleOwnedLinkLabels(live.Labels, expected.labels)) findings.push(`${expected.space}/${expected.slug}: stale owned Link label ${key}`);
    if (live.Annotations?.[LINK_REASON_ANNOTATION] !== expected.reason) findings.push(`${expected.space}/${expected.slug}: wiring reason drifted`);
    rows.push({
      ref: `${expected.space}/${expected.slug}`,
      id: live.LinkID,
      from: `${expected.space}/${expected.fromUnit}`,
      to: `${expected.toSpace}/${expected.toUnit}`,
      updateType: live.UpdateType,
      autoUpdate: live.AutoUpdate === true,
      reason: expected.reason,
      labels: expected.labels,
    });
  }
  return rows;
}

function readApplication(cluster, name) {
  const result = kubectlTry(cluster, ["get", "application", name, "-n", "argocd", "-o", "json"]);
  if (!result.ok) return { exists: false, sync: "Unknown", health: "Unknown", revision: "Unknown", conditions: [result.output.slice(0, 500)] };
  const value = JSON.parse(result.output);
  return {
    exists: true,
    sync: value.status?.sync?.status ?? "Unknown",
    health: value.status?.health?.status ?? "Unknown",
    revision: value.status?.sync?.revision ?? "Unknown",
    conditions: (value.status?.conditions ?? []).map((item) => ({ type: item.type, message: item.message })),
  };
}

function observeLiveMatrix(inputs, desired, applicationRows) {
  const applicationsByRef = new Map(applicationRows.map((item) => [`${item.cluster}/${item.name}`, item]));
  const componentDefinitions = [
    matrixComponent("argo-cd", EXPECTED_VERSIONS["argo-cd"], FLEET, [], { departure: "configHub-owned-argo-substitutes-kubara-wrapper", appNames: () => ["root"] }),
    matrixComponent("cert-manager", EXPECTED_VERSIONS["cert-manager"], FLEET, ["hx-cm"], { releaseInstance: "cert-manager", departure: "kind-self-signed-cluster-issuer" }),
    matrixComponent("external-secrets", EXPECTED_VERSIONS["external-secrets"], [DEV], ["hx-eso", "hx-eso-store", "hx-eso-grafana-es"], { releaseInstance: "external-secrets", departure: "kind-fake-provider-target-fact" }),
    matrixComponent("homer-dashboard", EXPECTED_VERSIONS["homer-dashboard"], [DEV], ["hx-homer"], { releaseInstance: "homer-dashboard" }),
    matrixComponent("kube-prometheus-stack", `${EXPECTED_VERSIONS["kube-prometheus-stack"]} + blackbox ${EXPECTED_VERSIONS["prometheus-blackbox-exporter"]}`, [DEV], ["hx-kps-crds", "hx-eso-grafana-es", "hx-kps-main"], { releaseInstance: "kube-prometheus-stack", departure: "crds-and-eso-secret-wiring-are-explicit-spaces" }),
    matrixComponent("metrics-server", EXPECTED_VERSIONS["metrics-server"], [DEV], ["hx-metrics"], { releaseInstance: "metrics-server" }),
    matrixComponent("traefik", EXPECTED_VERSIONS.traefik, FLEET, ["hx-traefik"], { releaseInstance: "traefik", departure: "kind-nodeport-with-configured-ingress-status" }),
    matrixComponent("hx-web", "digest-pinned fixture", FLEET, ["hx-web"], { namespace: "hx-web", departureFor: (item) => item.suffix === "staging" ? "staging-sandbox-url" : item.suffix === "prod-a" ? "one-target-rollback-replicas-2" : "none" }),
    matrixComponent("cubbychat", readYaml(absolute(paths.appSourceLock)).spec?.cubbychat?.upstream?.commit ?? "digest-pinned fixture", FLEET, ["hx-cubbychat"], { namespace: "cubbychat" }),
  ];
  const rows = [];
  for (const fleetItem of FLEET) {
    const workloads = clusterWorkloads(fleetItem.cluster);
    for (const component of componentDefinitions) {
      const selected = component.targets.some((item) => item.cluster === fleetItem.cluster);
      if (!selected) {
        rows.push({
          cluster: fleetItem.cluster,
          environment: fleetItem.environment,
          region: fleetItem.region,
          component: component.name,
          desiredVersion: component.desiredVersion,
          observedVersion: null,
          deliveryState: "not-selected",
          syncState: "NotApplicable",
          healthState: "NotApplicable",
          readiness: { result: "not-applicable", ready: 0, desired: 0 },
          departure: { id: "kubara-config-disabled", reason: "service is disabled for this cluster in the committed Kubara contract" },
          unknownReason: null,
        });
        continue;
      }
      const appNames = component.appNames
        ? component.appNames(fleetItem)
        : component.spacePrefixes.map((prefix) => `${prefix}-${fleetItem.suffix}`);
      const appStates = appNames.map((name) => applicationsByRef.get(`${fleetItem.cluster}/${name}`) ?? (name === "root" ? readApplication(fleetItem.cluster, name) : null)).filter(Boolean);
      const syncState = appStates.length && appStates.every((item) => item.syncState === "Synced" || item.sync === "Synced")
        ? "Synced"
        : distinct(appStates.map((item) => item.syncState ?? item.sync ?? "Unknown")).join("+") || "Unknown";
      const healthValues = appStates.map((item) => item.healthState ?? item.health ?? "Unknown");
      const healthState = healthValues.length && healthValues.every((item) => item === "Healthy")
        ? "Healthy"
        : distinct(healthValues).join("+") || "Unknown";
      const selectedWorkloads = selectComponentWorkloads(workloads, component);
      const readiness = readinessSummary(selectedWorkloads);
      const versions = observedWorkloadVersions(selectedWorkloads);
      const observedVersion = versions.length ? versions.join(" + ") : null;
      const departureId = component.departureFor?.(fleetItem) ?? component.departure ?? "none";
      const unknownReasons = [];
      if (!observedVersion) unknownReasons.push("selected version is pinned in ConfigHub provenance but not exposed by live workload labels");
      if (readiness.result === "unknown") unknownReasons.push("no matching Deployment, StatefulSet, or DaemonSet exposed readiness for this component");
      rows.push({
        cluster: fleetItem.cluster,
        environment: fleetItem.environment,
        region: fleetItem.region,
        component: component.name,
        desiredVersion: component.desiredVersion,
        observedVersion,
        deliveryState: "delivered",
        syncState,
        healthState,
        readiness,
        departure: departureId === "none" ? null : { id: departureId, reason: departureReason(departureId) },
        unknownReason: unknownReasons.length ? unknownReasons.join("; ") : null,
        evidence: {
          applications: appNames,
          workloadRefs: selectedWorkloads.map(workloadRef),
        },
      });
    }
  }
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubaraMiniIDPLiveMatrixObservation",
    desiredSource: paths.componentArtifacts,
    observationMode: "kubectl-and-confighub-live-read",
    rowCount: rows.length,
    rows,
  };
}

function matrixComponent(name, desiredVersion, targets, spacePrefixes, extra = {}) {
  return { name, desiredVersion, targets, spacePrefixes, ...extra };
}

function clusterWorkloads(cluster) {
  const result = kubectlTry(cluster, ["get", "deployment,statefulset,daemonset", "-A", "-o", "json"]);
  check(result.ok, `${cluster}: unable to read workload readiness: ${result.output}`);
  return JSON.parse(result.output).items ?? [];
}

function selectComponentWorkloads(workloads, component) {
  if (component.namespace) return workloads.filter((item) => item.metadata?.namespace === component.namespace);
  if (component.name === "argo-cd") return workloads.filter((item) => item.metadata?.namespace === "argocd");
  const instance = component.releaseInstance;
  if (!instance) return [];
  return workloads.filter((item) => {
    const labels = {
      ...(item.spec?.template?.metadata?.labels ?? {}),
      ...(item.metadata?.labels ?? {}),
    };
    return labels["app.kubernetes.io/instance"] === instance
      || labels.release === instance
      || labels["app.kubernetes.io/name"] === instance;
  });
}

function readinessSummary(workloads) {
  const statuses = workloads.map((item) => {
    if (item.kind === "Deployment") {
      const desired = item.spec?.replicas ?? 1;
      const ready = item.status?.availableReplicas ?? 0;
      return { ref: workloadRef(item), desired, ready, result: ready >= desired ? "pass" : "fail" };
    }
    if (item.kind === "StatefulSet") {
      const desired = item.spec?.replicas ?? 1;
      const ready = item.status?.readyReplicas ?? 0;
      return { ref: workloadRef(item), desired, ready, result: ready >= desired ? "pass" : "fail" };
    }
    const desired = item.status?.desiredNumberScheduled ?? 0;
    const ready = item.status?.numberReady ?? 0;
    return { ref: workloadRef(item), desired, ready, result: desired > 0 && ready >= desired ? "pass" : "fail" };
  });
  return {
    result: statuses.length === 0 ? "unknown" : statuses.every((item) => item.result === "pass") ? "pass" : "fail",
    ready: statuses.reduce((sum, item) => sum + item.ready, 0),
    desired: statuses.reduce((sum, item) => sum + item.desired, 0),
    workloads: statuses,
  };
}

function workloadRef(item) {
  return `${item.kind}/${item.metadata?.namespace ?? ""}/${item.metadata?.name ?? ""}`;
}

function observedWorkloadVersions(workloads) {
  const labels = [];
  for (const item of workloads) {
    const workloadLabels = {
      ...(item.spec?.template?.metadata?.labels ?? {}),
      ...(item.metadata?.labels ?? {}),
    };
    if (workloadLabels["helm.sh/chart"]) labels.push(workloadLabels["helm.sh/chart"]);
    else if (workloadLabels["app.kubernetes.io/version"]) labels.push(workloadLabels["app.kubernetes.io/version"]);
  }
  if (labels.length) return distinct(labels).sort();
  return distinct(workloads.flatMap((item) => [
    ...(item.spec?.template?.spec?.initContainers ?? []),
    ...(item.spec?.template?.spec?.containers ?? []),
  ].map((container) => container.image))).sort();
}

function distinct(values) {
  return [...new Set(values.filter(Boolean))];
}

function departureReason(id) {
  return {
    "configHub-owned-argo-substitutes-kubara-wrapper": `ConfigHub takes the hub role; each cluster keeps its local bootstrap Argo ${ARGO_CD_RUNTIME_VERSION}, explicitly separate from Kubara chart ${EXPECTED_VERSIONS["argo-cd"]} and its ${KUBARA_ARGO_RUNTIME_VERSION} render.`,
    "kind-self-signed-cluster-issuer": "The reproducible kind lane uses a self-signed ClusterIssuer instead of public ACME.",
    "kind-fake-provider-target-fact": "The demo uses ESO's fake provider; production must select a real backend without changing the wiring contract.",
    "crds-and-eso-secret-wiring-are-explicit-spaces": "CRD lifecycle and Grafana secret production are separately governed and visibly linked.",
    "kind-nodeport-with-configured-ingress-status": "The reproducible kind lane uses declared NodePorts and Traefik's configured cluster hostname, so Ingress status and Argo health converge without a cloud LoadBalancer controller.",
    "staging-sandbox-url": "Staging keeps its SANDBOX_URL departure through the second upstream promotion.",
    "one-target-rollback-replicas-2": "prod-a is intentionally rolled back to two replicas while prod-b remains at three.",
  }[id] ?? id;
}

function sourceEvidence() {
  return Object.fromEntries(Object.entries(paths).map(([name, relative]) => [name, {
    path: relative,
    sha256: existsSync(absolute(relative)) ? `sha256:${sha256File(absolute(relative))}` : null,
  }]));
}

function priorReceiptMatchesCurrentExecution(previous, currentSourceEvidence, observation) {
  if (
    previous?.kind !== "ConfigHubKubaraMiniIDPReconcileReceipt"
      || previous.spec?.organization?.name !== ORGANIZATION
      || previous.spec?.organization?.externalID !== ORGANIZATION_EXTERNAL_ID
      || previous.spec?.organization?.entityID !== observation.organizationID
      || previous.spec?.organization?.serverURL !== CONFIGHUB_SERVER_URL
      || previous.spec?.rolloutScenario?.sourceFingerprint !== scenarioSourceFingerprint()
  ) return false;
  for (const [name, evidence] of Object.entries(currentSourceEvidence)) {
    const stored = previous.spec?.source?.files?.[name];
    if (stored?.path !== evidence.path || stored?.sha256 !== evidence.sha256) return false;
  }
  const previousSpaces = new Map((previous.spec?.spaces ?? []).map((space) => [space.slug, space.id]));
  return observation.spaces.every((space) => previousSpaces.get(space.slug) === space.id)
    && previousSpaces.size === observation.spaces.length;
}

function assertKindTraefikEvidence(rows, prefix = "kind Traefik evidence") {
  check(rows.length === KIND_TRAEFIK_CONTRACTS.length, `${prefix}: four-cluster evidence is incomplete`);
  const byCluster = new Map(rows.map((item) => [item.cluster, item]));
  check(byCluster.size === rows.length, `${prefix}: cluster rows are duplicated`);
  for (const contract of KIND_TRAEFIK_CONTRACTS) {
    const row = byCluster.get(contract.cluster);
    check(row, `${prefix}: ${contract.cluster} row is missing`);
    check(row.hostname === contract.hostname, `${prefix}: ${contract.cluster} hostname drifted`);
    check(row.httpNodePort === contract.httpNodePort, `${prefix}: ${contract.cluster} HTTP NodePort drifted`);
    check(row.httpsNodePort === contract.httpsNodePort, `${prefix}: ${contract.cluster} HTTPS NodePort drifted`);
    check(row.service?.namespace === contract.namespace && row.service?.name === contract.serviceName, `${prefix}: ${contract.cluster} Service identity drifted`);
    check(row.service?.type === "NodePort", `${prefix}: ${contract.cluster} Service type drifted`);
    check(UUID_PATTERN.test(row.service?.uid ?? ""), `${prefix}: ${contract.cluster} Service UID is invalid`);
    check(typeof row.service?.clusterIP === "string" && row.service.clusterIP.length > 0, `${prefix}: ${contract.cluster} Service clusterIP is missing`);
    check(stableJson(row.service?.ports) === stableJson(contract.ports), `${prefix}: ${contract.cluster} Service ports drifted`);
    check(stableJson(row.service?.loadBalancerIngress) === "[]", `${prefix}: ${contract.cluster} stale LoadBalancer status remains`);
    check(row.deployment?.namespace === contract.namespace && row.deployment?.name === contract.deploymentName, `${prefix}: ${contract.cluster} Deployment identity drifted`);
    check(UUID_PATTERN.test(row.deployment?.uid ?? ""), `${prefix}: ${contract.cluster} Deployment UID is invalid`);
    check(row.deployment?.endpointArgument === contract.endpointArgument, `${prefix}: ${contract.cluster} endpoint argument drifted`);
    check(stableJson(row.deployment?.publishedServiceArguments) === "[]", `${prefix}: ${contract.cluster} publishedService remains`);
    const applications = new Map((row.applications ?? []).map((item) => [item.id, item]));
    check(applications.size === contract.applications.length, `${prefix}: ${contract.cluster} application endpoint evidence is incomplete`);
    for (const expected of contract.applications) {
      const application = applications.get(expected.id);
      check(application, `${prefix}: ${contract.cluster}/${expected.id} evidence is missing`);
      check(application.ingress?.hostname === contract.hostname, `${prefix}: ${contract.cluster}/${expected.id} Ingress status hostname drifted`);
      check(UUID_PATTERN.test(application.ingress?.uid ?? ""), `${prefix}: ${contract.cluster}/${expected.id} Ingress UID is invalid`);
      check(application.certificate?.ready === true, `${prefix}: ${contract.cluster}/${expected.id} Certificate is not Ready`);
      check(UUID_PATTERN.test(application.certificate?.uid ?? ""), `${prefix}: ${contract.cluster}/${expected.id} Certificate UID is invalid`);
    }
    check(
      stableJson(row.docker?.ports?.map((item) => [item.containerPort, item.hostPort]))
        === stableJson([[contract.httpNodePort, contract.httpNodePort], [contract.httpsNodePort, contract.httpsNodePort]]),
      `${prefix}: ${contract.cluster} Docker port bindings drifted`,
    );
    check(row.docker?.node === `${contract.cluster}-control-plane`, `${prefix}: ${contract.cluster} Docker node identity drifted`);
    check(
      row.docker.ports.every((item) => ["0.0.0.0", "127.0.0.1"].includes(item.hostIP)),
      `${prefix}: ${contract.cluster} Docker host binding is not reachable through loopback`,
    );
    const probes = new Map((row.probes ?? []).map((item) => [item.application, item]));
    check(probes.size === contract.applications.length, `${prefix}: ${contract.cluster} application probes are incomplete`);
    for (const expected of contract.applications) {
      const probe = probes.get(expected.id);
      check(
        probe?.hostHeader === `${expected.id}.local`
          && probe.url === `http://127.0.0.1:${contract.httpNodePort}/`
          && probe.statusCode === 200,
        `${prefix}: ${contract.cluster}/${expected.id} probe drifted`,
      );
    }
    check(Number.isFinite(Date.parse(row.observedAt ?? "")), `${prefix}: ${contract.cluster} observedAt is invalid`);
  }
}

function buildReceipt(inputs, desired, observation, state) {
  assertPerformanceEvidence(observation.performance, "live verification performance evidence");
  check(
    observation.performance.phases.length === 1,
    "live apply performance evidence must include the exact pre-Argo phase",
  );
  assertKindTraefikEvidence(observation.kindTraefik, "live kind Traefik evidence");
  const previous = readPriorReceipt();
  const currentSourceEvidence = sourceEvidence();
  const trustedPrevious = priorReceiptMatchesCurrentExecution(previous, currentSourceEvidence, observation);
  const currentExecutionFingerprint = operationExecutionFingerprint();
  const previousRuns = trustedPrevious
    ? (previous.spec?.reconcileRuns ?? []).filter(
        (item) => item.executionFingerprint === currentExecutionFingerprint,
      )
    : [];
  const run = {
    observedAt: new Date().toISOString(),
    executionFingerprint: currentExecutionFingerprint,
    actionCount: state.actions.length,
    result: "pass",
    idempotentNoop: state.actions.length === 0,
  };
  const recoveredChangedRun = !trustedPrevious
    && state.scenario.mode === "recovered-completed-history"
    && state.scenarioJournal?.state === "completed"
    && state.scenarioJournal?.executionFingerprint === currentExecutionFingerprint
    ? {
        observedAt: state.scenarioJournal.completedAt,
        executionFingerprint: currentExecutionFingerprint,
        actionCount: state.scenarioJournal.operationEvidence.length,
        result: "pass",
        idempotentNoop: false,
        recoveredFromOperationJournal: true,
      }
    : null;
  const allRuns = [
    ...previousRuns,
    ...(recoveredChangedRun ? [recoveredChangedRun] : []),
    run,
  ];
  const firstChangedRun = allRuns.find((item) => item.idempotentNoop === false && item.actionCount > 0) ?? null;
  const reconcileRuns = distinctRuns([
    ...(firstChangedRun ? [firstChangedRun] : []),
    ...allRuns.slice(-4),
  ]).slice(-5);
  const currentFingerprintRuns = allRuns.filter(
    (item) => item.result === "pass" && item.executionFingerprint === currentExecutionFingerprint,
  );
  const retainedNoopBaselineProven = currentFingerprintRuns.length >= 2
    && currentFingerprintRuns.slice(-2).every(
      (item) => item.idempotentNoop === true && item.actionCount === 0,
    );
  const changedThenNoopProven = Boolean(firstChangedRun) && run.idempotentNoop;
  const idempotentRerunProven = changedThenNoopProven || retainedNoopBaselineProven;
  const deterministicProofMode = changedThenNoopProven
    ? "changed-then-zero-action-rerun"
    : retainedNoopBaselineProven
      ? "two-zero-action-retained-baseline-observations"
      : "pending-second-observation";
  const priorScenario = trustedPrevious
    && previous.spec?.rolloutScenario?.version === SCENARIO_VERSION
    && previous.spec?.rolloutScenario?.sourceFingerprint === scenarioSourceFingerprint()
    ? previous.spec.rolloutScenario
    : null;
  const operationSteps = state.scenario.mode === "retained-proven-history" && priorScenario?.steps?.length
    ? priorScenario.steps
    : state.scenario.steps;
  const operationEvidence = state.scenario.mode === "retained-proven-history" && priorScenario?.operationEvidence?.length
    ? priorScenario.operationEvidence
    : state.scenario.operationEvidence ?? state.actions.filter((item) => [
        "variant-promote",
        "expected-approval-block",
        "unit-approve",
        "rollback",
      ].includes(item.type));
  const scenarioCheckpoints = state.scenarioJournal?.checkpoints ?? priorScenario?.checkpoints ?? [];
  check(
    scenarioOperationProofValid({ checkpoints: scenarioCheckpoints, operationEvidence }),
    "refusing to write a receipt without exact refusal, approval, and rollback evidence bound to scenario checkpoints",
  );
  const lastChangedActions = state.actions.length > 0
    ? state.actions
    : trustedPrevious ? previous.spec?.lastChangedActions ?? [] : [];
  const namespaceMoveEvidence = [];
  const seenNamespaceMoveUIDs = new Set();
  for (const item of state.namespaceMoveEvidence) {
    const key = `${item.ref ?? ""}/${item.uid ?? ""}`;
    if (seenNamespaceMoveUIDs.has(key)) continue;
    seenNamespaceMoveUIDs.add(key);
    namespaceMoveEvidence.push(item);
  }
  check(namespaceMoveEvidence.length <= 1, "more than one namespace-move DaemonSet prune was retained");
  const protectedNamespaceEvidenceByMigration = new Map();
  for (const item of state.protectedNamespaceEvidence) {
    const prior = protectedNamespaceEvidenceByMigration.get(item.migrationID);
    check(
      !prior || prior.uid === item.uid,
      `${item.migrationID}: retained protected Namespace evidence disagrees on the Namespace UID`,
    );
    protectedNamespaceEvidenceByMigration.set(item.migrationID, item);
  }
  const protectedNamespaceEvidence = PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS.map((contract) => {
    const item = protectedNamespaceEvidenceByMigration.get(contract.migrationID);
    check(item, `${contract.migrationID}: completed ownership-detachment evidence is missing`);
    assertProtectedNamespaceDetachmentEvidence(item, contract);
    const current = observation.protectedNamespaces.find((row) => row.migrationID === contract.migrationID);
    check(current, `${contract.migrationID}: current protected Namespace postcondition is missing`);
    check(current.uid === item.uid, `${contract.migrationID}: retained Namespace UID changed after ownership detachment`);
    return item;
  });
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ConfigHubKubaraMiniIDPReconcileReceipt",
    metadata: { name: "kubara-v0-13-0-confighub-mini-idp" },
    spec: {
      organization: {
        name: ORGANIZATION,
        externalID: ORGANIZATION_EXTERNAL_ID,
        entityID: observation.organizationID,
        serverURL: CONFIGHUB_SERVER_URL,
      },
      source: {
        kubaraVersion: KUBARA_VERSION,
        catalogVersion: CATALOG_VERSION,
        exactVersionPolicy: "fail-if-missing",
        retentionPolicy: "additive-only",
        files: currentSourceEvidence,
      },
      execution: {
        deterministic: true,
        aiRequired: false,
        mutationGuardConsulted: false,
        destructiveOperations: [ARGO_PRUNE_POLICY, ARGO_NAMESPACE_MOVE_POLICY],
        persistentClustersPreserved: FLEET.map((item) => item.cluster),
        partialClusterStatePolicy: "fail-except-exact-journaled-prefix",
        serialLiveParityLock: true,
        unexpectedSpacePolicy: "fail-outside-exact-55-space-allowlist",
        unexpectedManagedUnitOrLinkPolicy: "fail",
        preservedControlUnitPolicy: "exact-receipt-bound-faithful-proof-units",
        interruptedScenarioPolicy: INTERRUPTED_SCENARIO_POLICY,
        interruptedReleasePolicy: INTERRUPTED_RELEASE_POLICY,
        publishedReleaseSelectionPolicy: PUBLISHED_RELEASE_SELECTION_POLICY,
        deliveryRootPublicationPolicy: DELIVERY_ROOT_PUBLICATION_POLICY,
        receiptRequiresZeroActionRerun: true,
        performance: observation.performance,
        cub: cachedCubVersions,
        delivery: `ConfigHub variant/OCI -> ConfigHub cluster-bootstrap Argo CD ${ARGO_CD_RUNTIME_VERSION}/argobot`,
        argoApplicationContract: "allowlisted ConfigHub OCI source -> cluster-local API + Kubara destination namespace",
        argoRetryPolicy: ARGO_RETRY_POLICY,
        argoPrunePolicy: ARGO_PRUNE_POLICY,
        argoNamespaceMovePolicy: ARGO_NAMESPACE_MOVE_POLICY,
        protectedNamespaceOwnershipPolicy: PROTECTED_NAMESPACE_OWNERSHIP_POLICY,
        kindTraefikPolicy: KIND_TRAEFIK_POLICY,
        argoRevisionPolicy: ARGO_REVISION_POLICY,
        guiIdentityPolicy: GUI_IDENTITY_POLICY,
        topologyClaim: "ConfigHub takes the hub role; every cluster keeps a local reconciler",
      },
      counts: {
        spaces: observation.spaces.length,
        managedUnits: observation.units.length,
        preservedFaithfulControlUnits: observation.preservedControlUnits.length,
        deployments: desired.deployments.length,
        deliveryApplicationUnits: desired.deployments.length + (FLEET.length * 2),
        protectedNamespaceOwnershipDetachments: protectedNamespaceEvidence.length,
        kindTraefikContracts: observation.kindTraefik.length,
        releases: observation.releases.length,
        needsProvidesLinks: observation.links.length,
        liveMatrixRows: observation.liveMatrix.rowCount,
      },
      clusters: observation.clusters,
      controls: observation.units.filter((item) => item.ref.startsWith(`${CONTROL_SPACE}/`)),
      preservedControlUnits: observation.preservedControlUnits,
      namespaceMovePrunes: namespaceMoveEvidence,
      protectedNamespaceOwnershipDetachments: protectedNamespaceEvidence,
      protectedNamespaceOwnershipCurrent: observation.protectedNamespaces,
      kindTraefik: observation.kindTraefik,
      spaces: observation.spaces,
      units: observation.units,
      releases: observation.releases,
      applications: observation.applications,
      deliveryRuntimes: observation.deliveryRuntimes,
      deliveryApplicationUnits: plannedDeliveryApplicationIdentity(desired),
      guiNavigation: {
        scope: "identity-and-navigation-only",
        startHereSpace: CONTROL_SPACE,
        startHereControlUnits: [...START_HERE_CONTROL_UNITS].sort(),
        publicURLs: PUBLIC_NAVIGATION_ANNOTATIONS,
        ownedSpaceLabels: [...OWNED_SPACE_LABELS].sort(),
        ownedUnitLabels: [...OWNED_UNIT_LABELS].sort(),
        ownedLinkLabels: [...OWNED_LINK_LABELS].sort(),
        declaredNeedsProvidesLinks: observation.links.length,
        completeWiringGraphClaim: false,
        liveHealthClaim: false,
      },
      wiring: {
        sourceLedger: paths.wiring,
        updateType: "NeedsProvides",
        autoUpdate: false,
        links: observation.links,
        grafanaSecret: observation.secretWiring,
      },
      policy: observation.policy,
      rolloutScenario: {
        version: SCENARIO_VERSION,
        sourceFingerprint: scenarioSourceFingerprint(),
        mode: state.scenario.mode,
        steps: operationSteps,
        operationEvidence,
        checkpoints: scenarioCheckpoints,
        finalChecks: observation.scenario,
        claims: {
          basePromotion: "pass",
          productionApproval: "pass",
          oneProductionRollback: "pass",
          stagingDepartureSurvivedPromotion: "pass",
        },
      },
      liveMatrix: observation.liveMatrix,
      reconcileRuns,
      deterministicProofMode,
      lastActions: state.actions,
      lastChangedActions,
    },
    status: {
      result: idempotentRerunProven ? "pass" : "pending-idempotence",
      observedAt: run.observedAt,
      cleanRoomReproducible: false,
      cleanRoomClaim: "not asserted from this retained-org run; offline clean-room ordering is gated separately",
      deterministicReconciliationProven: idempotentRerunProven,
      idempotentRerunProven,
      fullCurrentSelectionDelivered: true,
      applicationsDelivered: ["hx-web", "cubbychat"],
      historicalCatalogRootsPreserved: true,
      limits: [
        "This is the adapted ConfigHub lane. The separate faithful-lane receipt proves Kubara's one-hub Argo topology against a spoke.",
        `ConfigHub cluster-bootstrap Argo CD ${ARGO_CD_RUNTIME_VERSION} and argobot replace Kubara's selected Argo chart ${EXPECTED_VERSIONS["argo-cd"]} (runtime ${KUBARA_ARGO_RUNTIME_VERSION}) in the adapted lane; the cluster-local reconciliation shape remains.`,
        "The kind proof uses a self-signed issuer and ESO's fake provider with demo credentials. Production adoption must select public/private PKI and a real secret backend.",
        "cub cluster up rolls back returned failures, but an abrupt process or host termination inside that multi-system command is fail-closed rather than automatically repaired; the reconciler resumes only fully complete journaled cluster prefixes and never deletes a partial persistent cluster.",
        "The reconciler replays promotion/rollback/departure history only for a clean or unmarked hx-web tree; marked reruns verify and reconcile the deterministic final state.",
      ],
    },
  };
}

function distinctRuns(runs) {
  const seen = new Set();
  return runs.filter((run) => {
    const key = `${run.executionFingerprint ?? ""}/${run.observedAt ?? ""}/${run.actionCount ?? ""}/${run.idempotentNoop ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assertReceiptLinkEvidence(rows, expectedLinks) {
  check(rows.length === expectedLinks.length, "receipt Link rows are incomplete");
  const rowsByRef = new Map();
  for (const row of rows) {
    check(!rowsByRef.has(row.ref), `${row.ref}: receipt contains a duplicate Link`);
    rowsByRef.set(row.ref, row);
  }
  for (const expected of expectedLinks) {
    const ref = `${expected.space}/${expected.slug}`;
    const row = rowsByRef.get(ref);
    check(row, `receipt is missing Link ${ref}`);
    check(UUID_PATTERN.test(row.id ?? ""), `${ref}: receipt Link ID missing`);
    check(row.updateType === "NeedsProvides" && row.autoUpdate === false, `${ref}: receipt Link semantics drifted`);
    check(row.from === `${expected.space}/${expected.fromUnit}`, `${ref}: receipt downstream endpoint drifted`);
    check(row.to === `${expected.toSpace}/${expected.toUnit}`, `${ref}: receipt upstream endpoint drifted`);
    check(row.reason === expected.reason, `${ref}: receipt wiring reason drifted`);
    check(stableJson(row.labels) === stableJson(expected.labels), `${ref}: receipt Link identity labels drifted`);
  }

  for (const item of FLEET) {
    const workload = rowsByRef.get(`hx-web-${item.suffix}/needs-platform-binding`);
    check(
      workload?.from === `hx-web-${item.suffix}/hx-web-deployment`
        && workload.to === `hx-web-platform-${item.suffix}/hx-web-platform`,
      `${item.cluster}: receipt must visibly bind hx-web to its reviewed platform Certificate/Ingress Unit`,
    );
    const certificate = rowsByRef.get(`hx-web-platform-${item.suffix}/needs-cert-manager`);
    check(
      certificate?.from === `hx-web-platform-${item.suffix}/hx-web-platform`
        && certificate.to === `hx-cm-${item.suffix}/hx-cm`,
      `${item.cluster}: receipt must visibly bind hx-web platform wiring to cert-manager`,
    );
    const ingress = rowsByRef.get(`hx-web-platform-${item.suffix}/needs-traefik`);
    check(
      ingress?.from === `hx-web-platform-${item.suffix}/hx-web-platform`
        && ingress.to === `hx-traefik-${item.suffix}/hx-traefik`,
      `${item.cluster}: receipt must visibly bind hx-web platform wiring to traefik`,
    );
  }
}

function verifyReceipt(inputs, desired) {
  check(existsSync(RECEIPT_PATH), `${relativeRepo(RECEIPT_PATH)} is missing; run --apply after all live prerequisites pass`);
  const receipt = readYaml(RECEIPT_PATH);
  check(receipt.kind === "ConfigHubKubaraMiniIDPReconcileReceipt", "mini-IDP receipt kind drifted");
  check(receipt.spec?.organization?.name === ORGANIZATION, "mini-IDP receipt organization drifted");
  check(receipt.spec?.organization?.externalID === ORGANIZATION_EXTERNAL_ID, "mini-IDP receipt organization external ID drifted");
  check(receipt.spec?.organization?.entityID === ORGANIZATION_ENTITY_ID, "mini-IDP receipt organization entity ID drifted");
  check(receipt.spec?.organization?.serverURL === CONFIGHUB_SERVER_URL, "mini-IDP receipt ConfigHub server drifted");
  check(receipt.spec?.source?.kubaraVersion === KUBARA_VERSION, "mini-IDP receipt Kubara version drifted");
  check(receipt.spec?.source?.catalogVersion === CATALOG_VERSION, "mini-IDP receipt catalog version drifted");
  check(receipt.spec?.source?.exactVersionPolicy === "fail-if-missing", "mini-IDP exact-version policy drifted");
  check(receipt.spec?.source?.retentionPolicy === "additive-only", "mini-IDP retention policy drifted");
  for (const [name, evidence] of Object.entries(sourceEvidence())) {
    const stored = receipt.spec?.source?.files?.[name];
    check(stored?.path === evidence.path, `mini-IDP receipt source path ${name} drifted`);
    check(stored?.sha256 === evidence.sha256, `mini-IDP receipt source digest ${name} is stale`);
  }
  check(
    !Object.values(receipt.spec?.source?.files ?? {}).some((item) => item?.path === MATRIX_PUBLICATION_PATH),
    `mini-IDP receipt must not source-digest receipt-derived publication ${MATRIX_PUBLICATION_PATH}`,
  );
  check(receipt.spec?.execution?.deterministic === true, "mini-IDP receipt must declare deterministic execution");
  check(receipt.spec?.execution?.aiRequired === false, "AI must not be required for mini-IDP reconciliation");
  check(receipt.spec?.execution?.mutationGuardConsulted === false, "mutation guard should remain outside this explicitly authorized reconciler");
  assertPerformanceEvidence(receipt.spec?.execution?.performance, "mini-IDP receipt performance evidence");
  check(
    receipt.spec.execution.performance.phases.length === 1,
    "mini-IDP receipt must retain the exact apply-start-to-first-Argo-convergence performance phase",
  );
  check(
    stableJson(receipt.spec?.execution?.destructiveOperations)
      === stableJson([ARGO_PRUNE_POLICY, ARGO_NAMESPACE_MOVE_POLICY]),
    "mini-IDP receipt Argo prune boundary drifted",
  );
  check(receipt.spec?.execution?.argoPrunePolicy === ARGO_PRUNE_POLICY, "mini-IDP receipt Argo prune policy drifted");
  check(receipt.spec?.execution?.argoNamespaceMovePolicy === ARGO_NAMESPACE_MOVE_POLICY, "mini-IDP receipt Argo namespace-move policy drifted");
  check(
    receipt.spec?.execution?.protectedNamespaceOwnershipPolicy === PROTECTED_NAMESPACE_OWNERSHIP_POLICY,
    "mini-IDP receipt protected Namespace ownership policy drifted",
  );
  check(receipt.spec?.execution?.kindTraefikPolicy === KIND_TRAEFIK_POLICY, "mini-IDP receipt kind Traefik policy drifted");
  check(receipt.spec?.execution?.argoRetryPolicy === ARGO_RETRY_POLICY, "mini-IDP receipt Argo retry policy drifted");
  check(receipt.spec?.execution?.argoRevisionPolicy === ARGO_REVISION_POLICY, "mini-IDP receipt Argo revision policy drifted");
  check(receipt.spec?.execution?.guiIdentityPolicy === GUI_IDENTITY_POLICY, "mini-IDP receipt GUI identity policy drifted");
  check(stableJson(receipt.spec?.execution?.persistentClustersPreserved) === stableJson(FLEET.map((item) => item.cluster)), "persistent cluster allowlist drifted");
  check(
    receipt.spec?.execution?.partialClusterStatePolicy === "fail-except-exact-journaled-prefix",
    "mini-IDP receipt no longer limits partial fleet recovery to an exact journaled prefix",
  );
  check(receipt.spec?.execution?.serialLiveParityLock === true, "mini-IDP receipt no longer records the shared serial live-parity lock");
  check(receipt.spec?.execution?.unexpectedSpacePolicy === "fail-outside-exact-55-space-allowlist", "mini-IDP receipt no longer enforces the exact Space allowlist");
  check(receipt.spec?.execution?.unexpectedManagedUnitOrLinkPolicy === "fail", "mini-IDP receipt no longer rejects unexpected managed Units or Links");
  check(
    receipt.spec?.execution?.preservedControlUnitPolicy === "exact-receipt-bound-faithful-proof-units",
    "mini-IDP receipt no longer binds its preserved faithful proof Units exactly",
  );
  check(receipt.spec?.execution?.receiptRequiresZeroActionRerun === true, "mini-IDP receipt no longer requires a zero-action rerun");
  check(
    receipt.spec?.execution?.interruptedReleasePolicy === INTERRUPTED_RELEASE_POLICY,
    "mini-IDP receipt no longer proves restart-safe release publication",
  );
  check(
    receipt.spec?.execution?.interruptedScenarioPolicy === INTERRUPTED_SCENARIO_POLICY,
    "mini-IDP receipt no longer proves checkpoint-bound scenario recovery",
  );
  check(
    receipt.spec?.execution?.publishedReleaseSelectionPolicy === PUBLISHED_RELEASE_SELECTION_POLICY,
    "mini-IDP receipt no longer excludes withdrawn releases server-side",
  );
  check(
    receipt.spec?.execution?.deliveryRootPublicationPolicy === DELIVERY_ROOT_PUBLICATION_POLICY,
    "mini-IDP receipt no longer binds one complete delivery-root publication per cluster",
  );
  check(receipt.spec?.execution?.cub?.minimum === `v${MIN_CUB_VERSION}`, "mini-IDP receipt cub minimum-version contract drifted");
  check(versionAtLeast(String(receipt.spec?.execution?.cub?.client ?? "").replace(/^v/, ""), MIN_CUB_VERSION), "mini-IDP receipt cub client is too old");
  check(versionAtLeast(String(receipt.spec?.execution?.cub?.server ?? "").replace(/^v/, ""), MIN_CUB_VERSION), "mini-IDP receipt ConfigHub server is too old");

  const counts = receipt.spec?.counts ?? {};
  check(counts.spaces === desired.spaces.length, `receipt has ${counts.spaces} Spaces, expected ${desired.spaces.length}`);
  check(counts.managedUnits === desired.managedUnits.length, `receipt has ${counts.managedUnits} Units, expected ${desired.managedUnits.length}`);
  check(
    counts.preservedFaithfulControlUnits === PRESERVED_FAITHFUL_CONTROL_UNITS.length,
    `receipt has ${counts.preservedFaithfulControlUnits} preserved faithful Units, expected ${PRESERVED_FAITHFUL_CONTROL_UNITS.length}`,
  );
  check(counts.deployments === desired.deployments.length, `receipt has ${counts.deployments} deployments, expected ${desired.deployments.length}`);
  check(
    counts.deliveryApplicationUnits === desired.deployments.length + (FLEET.length * 2),
    "receipt delivery Application Unit count drifted",
  );
  check(
    counts.protectedNamespaceOwnershipDetachments === PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS.length,
    "receipt protected Namespace ownership-detachment count drifted",
  );
  check(counts.kindTraefikContracts === KIND_TRAEFIK_CONTRACTS.length, "receipt kind Traefik contract count drifted");
  check(counts.releases === desired.deployments.length, `receipt has ${counts.releases} releases, expected ${desired.deployments.length}`);
  check(counts.needsProvidesLinks === desired.links.length, `receipt has ${counts.needsProvidesLinks} Links, expected ${desired.links.length}`);
  check(counts.liveMatrixRows === FLEET.length * 9, `receipt live matrix has ${counts.liveMatrixRows} rows, expected ${FLEET.length * 9}`);

  const deliveryRuntimes = receipt.spec?.deliveryRuntimes ?? [];
  check(deliveryRuntimes.length === FLEET.length, "receipt cluster-local Argo runtime observations are incomplete");
  for (const item of FLEET) {
    const runtime = deliveryRuntimes.find((row) => row.cluster === item.cluster);
    check(runtime?.installedBy === "cub cluster up", `${item.cluster}: receipt Argo installer provenance drifted`);
    check(runtime?.version === ARGO_CD_RUNTIME_VERSION, `${item.cluster}: receipt Argo runtime version drifted`);
    check(runtime?.image === ARGO_CD_RUNTIME_IMAGE, `${item.cluster}: receipt Argo runtime image drifted`);
    check(
      stableJson((runtime?.references ?? []).map((row) => [row.workload, row.container]))
        === stableJson(ARGO_CD_RUNTIME_CONTAINER_PAIRS)
        && runtime.references.every((row) => row.image === ARGO_CD_RUNTIME_IMAGE),
      `${item.cluster}: receipt does not bind the exact eight reviewed Argo workload/container pairs to ${ARGO_CD_RUNTIME_IMAGE}`,
    );
  }

  const namespaceMoveEvidence = receipt.spec?.namespaceMovePrunes ?? [];
  check(namespaceMoveEvidence.length <= 1, "receipt retains more than one namespace-move DaemonSet prune");
  for (const item of namespaceMoveEvidence) {
    assertNamespaceMoveEvidenceRow(item, "receipt namespace-move prune");
  }

  const protectedNamespaceEvidence = receipt.spec?.protectedNamespaceOwnershipDetachments ?? [];
  const protectedNamespaceCurrent = receipt.spec?.protectedNamespaceOwnershipCurrent ?? [];
  check(
    protectedNamespaceEvidence.length === PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS.length,
    "receipt protected Namespace ownership-detachment history is incomplete",
  );
  check(
    protectedNamespaceCurrent.length === PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS.length,
    "receipt protected Namespace current postconditions are incomplete",
  );
  const historicalByMigration = new Map(protectedNamespaceEvidence.map((item) => [item.migrationID, item]));
  const currentByMigration = new Map(protectedNamespaceCurrent.map((item) => [item.migrationID, item]));
  check(historicalByMigration.size === protectedNamespaceEvidence.length, "receipt duplicates protected Namespace history");
  check(currentByMigration.size === protectedNamespaceCurrent.length, "receipt duplicates protected Namespace current evidence");
  for (const contract of PROTECTED_NAMESPACE_OWNERSHIP_DETACHMENTS) {
    const historical = historicalByMigration.get(contract.migrationID);
    const current = currentByMigration.get(contract.migrationID);
    check(historical, `${contract.migrationID}: receipt ownership-detachment history is missing`);
    check(current, `${contract.migrationID}: receipt current protected Namespace evidence is missing`);
    assertProtectedNamespaceDetachmentEvidence(historical, contract);
    assertProtectedNamespaceCurrentObservation(current, contract, `${contract.migrationID}: receipt current postcondition`);
    check(current.uid === historical.uid, `${contract.migrationID}: receipt retained Namespace UID changed`);
  }
  assertKindTraefikEvidence(receipt.spec?.kindTraefik ?? [], "receipt kind Traefik evidence");

  const spaceRows = receipt.spec?.spaces ?? [];
  check(spaceRows.length === desired.spaces.length, "receipt Space rows are incomplete");
  const spacesBySlug = new Map(spaceRows.map((item) => [item.slug, item]));
  for (const expected of desired.spaces) {
    const row = spacesBySlug.get(expected.slug);
    check(row, `receipt is missing Space ${expected.slug}`);
    check(UUID_PATTERN.test(row.id ?? ""), `${expected.slug}: receipt Space ID missing`);
    check(stableJson(row.labels) === stableJson(expected.labels), `${expected.slug}: receipt labels drifted`);
    check(stableJson(row.annotations ?? {}) === stableJson(expected.annotations ?? {}), `${expected.slug}: receipt navigation annotations drifted`);
  }

  const unitRows = receipt.spec?.units ?? [];
  check(unitRows.length === desired.managedUnits.length, "receipt Unit rows are incomplete");
  const unitsByRef = new Map(unitRows.map((item) => [item.ref, item]));
  for (const expected of desired.managedUnits) {
    const ref = `${expected.space}/${expected.slug}`;
    const row = unitsByRef.get(ref);
    check(row, `receipt is missing Unit ${ref}`);
    check(UUID_PATTERN.test(row.id ?? ""), `${ref}: receipt Unit ID missing`);
    check(Number(row.headRevisionNum) > 0, `${ref}: receipt head revision missing`);
    const payload = inputs.payloads.get(expected.payloadKey);
    check(row.sourceSha256 === `sha256:${payload.sha256}`, `${ref}: receipt source digest drifted`);
    check(stableJson(row.labels) === stableJson(expected.labels), `${ref}: receipt Unit identity labels drifted`);
    check(
      stableJson(row.navigationAnnotations ?? {}) === stableJson(expected.annotations ?? {}),
      `${ref}: receipt Unit navigation annotations drifted`,
    );
  }

  const faithful = verifyFaithfulProof();
  const preservedRows = receipt.spec?.preservedControlUnits ?? [];
  check(
    preservedRows.length === PRESERVED_FAITHFUL_CONTROL_UNITS.length,
    "receipt preserved faithful control Unit rows are incomplete",
  );
  const preservedByRef = new Map(preservedRows.map((item) => [item.ref, item]));
  for (const expected of PRESERVED_FAITHFUL_CONTROL_UNITS) {
    const ref = `${CONTROL_SPACE}/${expected.slug}`;
    const evidence = faithful.spec?.configHub?.[expected.receiptKey];
    const row = preservedByRef.get(ref);
    check(row, `receipt is missing preserved faithful Unit ${ref}`);
    check(row.id === evidence?.unit?.id, `${ref}: preserved Unit ID is stale`);
    check(row.headRevisionNum === evidence?.unit?.headRevisionNum, `${ref}: preserved head revision is stale`);
    check(row.dataHash === evidence?.unit?.dataHash, `${ref}: preserved data hash is stale`);
    check(row.approvalCount === evidence?.approval?.recordedApprovals, `${ref}: preserved approval evidence is stale`);
    check(row.owner === "faithful-hub-spoke-proof" && row.policy === "preserved", `${ref}: preserved ownership policy drifted`);
  }

  const releaseRows = receipt.spec?.releases ?? [];
  check(releaseRows.length === desired.deployments.length, "receipt release rows are incomplete");
  for (const row of releaseRows) {
    check(/^sha256:[0-9a-f]{64}$/.test(row.bundleDigest ?? ""), `${row.space}: bundle content digest missing`);
    check(/^sha256:[0-9a-f]{64}$/.test(row.manifestDigest ?? ""), `${row.space}: OCI manifest digest missing`);
  }
  const releasesBySpace = new Map(releaseRows.map((row) => [row.space, row]));
  const appRows = receipt.spec?.applications ?? [];
  check(appRows.length === desired.deployments.length, "receipt Application rows are incomplete");
  const desiredApps = new Map(desired.deployments.map((item) => [`${item.cluster}/${item.space}`, item]));
  for (const row of appRows) {
    const expected = desiredApps.get(`${row.cluster}/${row.name}`);
    check(expected, `${row.cluster}/${row.name}: receipt Application is not in the desired plan`);
    check(row.destinationNamespace === expected.destinationNamespace, `${row.cluster}/${row.name}: receipt destination namespace drifted`);
    check(/^sha256:[0-9a-f]{64}$/.test(row.expectedRevision ?? ""), `${row.cluster}/${row.name}: receipt expected revision missing`);
    check(
      row.expectedRevision === releasesBySpace.get(row.name)?.manifestDigest,
      `${row.cluster}/${row.name}: receipt expected revision is not the release OCI ManifestDigest`,
    );
    check(row.observedRevision === row.expectedRevision, `${row.cluster}/${row.name}: receipt observed revision is not the expected ConfigHub release`);
    check(row.syncState === "Synced", `${row.cluster}/${row.name}: receipt sync is ${row.syncState}`);
    check((row.acceptedHealth ?? []).includes(row.healthState), `${row.cluster}/${row.name}: receipt health ${row.healthState} is outside accepted set`);
  }
  check(
    stableJson(receipt.spec?.deliveryApplicationUnits ?? [])
      === stableJson(plannedDeliveryApplicationIdentity(desired)),
    "receipt delivery Application Unit identity metadata drifted",
  );

  const links = receipt.spec?.wiring?.links ?? [];
  assertReceiptLinkEvidence(links, desired.links);
  const guiNavigation = receipt.spec?.guiNavigation ?? {};
  check(guiNavigation.scope === "identity-and-navigation-only", "receipt GUI navigation scope overclaims evidence");
  check(guiNavigation.startHereSpace === CONTROL_SPACE, "receipt GUI start Space drifted");
  check(
    stableJson(guiNavigation.startHereControlUnits) === stableJson([...START_HERE_CONTROL_UNITS].sort()),
    "receipt GUI start Unit set drifted",
  );
  check(stableJson(guiNavigation.publicURLs) === stableJson(PUBLIC_NAVIGATION_ANNOTATIONS), "receipt public GUI URLs drifted");
  check(guiNavigation.declaredNeedsProvidesLinks === desired.links.length, "receipt declared GUI Link count drifted");
  check(guiNavigation.completeWiringGraphClaim === false, "receipt must not claim a complete GUI wiring graph");
  check(guiNavigation.liveHealthClaim === false, "receipt GUI metadata must not claim live health");
  const grafanaSecret = receipt.spec?.wiring?.grafanaSecret;
  check(grafanaSecret?.store?.name === "hx-app-dev-dev" && grafanaSecret.store.ready === true, "receipt does not prove the Grafana ClusterSecretStore ready");
  check(
    grafanaSecret?.externalSecret?.name === "grafana-admin-credentials-es"
      && grafanaSecret.externalSecret.ready === true
      && grafanaSecret.externalSecret.storeRef?.kind === "ClusterSecretStore"
      && grafanaSecret.externalSecret.storeRef?.name === "hx-app-dev-dev"
      && grafanaSecret.externalSecret.target === "grafana-admin-credentials",
    "receipt does not prove the Grafana ExternalSecret wiring ready",
  );
  check(
    grafanaSecret?.secret?.ownerKind === "ExternalSecret"
      && grafanaSecret.secret.ownerName === "grafana-admin-credentials-es"
      && stableJson(grafanaSecret.secret.keysPresent) === stableJson(["admin-password", "admin-user"]),
    "receipt does not prove the Grafana Secret is ESO-owned with both credential keys",
  );

  const scenario = receipt.spec?.rolloutScenario ?? {};
  check(scenario.version === SCENARIO_VERSION, "receipt rollout scenario version drifted");
  check(scenario.sourceFingerprint === scenarioSourceFingerprint(), "receipt rollout scenario source fingerprint drifted");
  for (const id of ["initial-rollout", "base-promotion", "prod-approval", "prod-a-rollback", "staging-departure", "departure-survives-promotion"]) {
    check((scenario.steps ?? []).some((item) => item.id === id && item.result === "pass"), `receipt rollout step ${id} is missing`);
  }
  for (const space of ["hx-web-prod-a", "hx-web-prod-b"]) {
    const refusal = (scenario.operationEvidence ?? []).find(
      (item) => item.type === "expected-approval-block" && item.ref === space,
    );
    check(refusal?.refusedHeads?.length > 0, `receipt lacks exact pre-approval refused heads for ${space}`);
    for (const head of refusal.refusedHeads) {
      check(UUID_PATTERN.test(head.id ?? "") && Number(head.headRevisionNum) > 0 && /^[a-f0-9]{64}$/.test(head.dataHash ?? ""), `${head.ref}: refused-head evidence is invalid`);
    }
  }
  check(
    scenarioOperationProofValid(scenario),
    "receipt lacks exact refusal, approval, or rollback evidence bound to its rollout checkpoints",
  );
  const checkpoints = scenario.checkpoints ?? [];
  for (const id of ["materialized", "base-promotion", "prod-approval", "prod-a-rollback", "final-normalized"]) {
    const checkpoint = checkpoints.find((item) => item.id === id)?.facts;
    check(checkpoint?.sourceFingerprint === scenario.sourceFingerprint, `receipt rollout checkpoint ${id} is missing or source-unbound`);
    check(Array.isArray(checkpoint.units) && checkpoint.units.length > 0, `receipt rollout checkpoint ${id} lacks Unit facts`);
    check(Array.isArray(checkpoint.releases) && checkpoint.releases.length === FLEET.length, `receipt rollout checkpoint ${id} lacks release facts`);
    check(Array.isArray(checkpoint.upgradeLinks) && checkpoint.upgradeLinks.length > 0, `receipt rollout checkpoint ${id} lacks UpgradeUnit merge-base facts`);
    for (const unit of checkpoint.units) {
      check(UUID_PATTERN.test(unit.id ?? ""), `receipt rollout checkpoint ${id}/${unit.ref} Unit ID is invalid`);
      check(Number(unit.headRevisionNum) > 0 && /^[a-f0-9]{64}$/.test(unit.dataHash ?? ""), `receipt rollout checkpoint ${id}/${unit.ref} revision or data hash is invalid`);
    }
  }
  for (const [name, value] of Object.entries(scenario.claims ?? {})) check(value === "pass", `rollout claim ${name} is not pass`);
  check((scenario.finalChecks ?? []).length === 5 && scenario.finalChecks.every((item) => item.result === "pass"), "receipt final rollout checks are incomplete");

  const liveMatrix = receipt.spec?.liveMatrix;
  check(liveMatrix?.kind === "KubaraMiniIDPLiveMatrixObservation", "receipt live matrix kind drifted");
  check(liveMatrix?.observationMode === "kubectl-and-confighub-live-read", "receipt live matrix is not live evidence");
  check(liveMatrix?.rows?.length === FLEET.length * 9, "receipt live matrix row count drifted");
  for (const row of liveMatrix.rows) {
    check(FLEET.some((item) => item.cluster === row.cluster), `matrix row has unknown cluster ${row.cluster}`);
    check(typeof row.desiredVersion === "string" && row.desiredVersion, `${row.cluster}/${row.component}: desired version missing`);
    check(["delivered", "not-selected"].includes(row.deliveryState), `${row.cluster}/${row.component}: delivery state invalid`);
    if (row.deliveryState === "delivered") {
      check(row.syncState === "Synced", `${row.cluster}/${row.component}: matrix sync is ${row.syncState}`);
      check(row.readiness?.result !== "fail", `${row.cluster}/${row.component}: matrix readiness failed`);
      check(row.observedVersion !== undefined, `${row.cluster}/${row.component}: observedVersion field missing`);
      check(row.unknownReason !== undefined, `${row.cluster}/${row.component}: unknownReason field missing`);
    }
  }

  const runs = receipt.spec?.reconcileRuns ?? [];
  check(runs.length >= 2 && runs.every((item) => item.result === "pass"), "receipt must contain the initial reconciliation and a zero-action rerun");
  check(runs.every((item) => item.executionFingerprint === operationExecutionFingerprint()), "receipt reconcile runs do not share the current execution fingerprint");
  const changedThenNoop = runs.some((item) => item.idempotentNoop === false && item.actionCount > 0)
    && runs.at(-1)?.idempotentNoop === true;
  const retainedNoopBaseline = runs.length >= 2
    && runs.slice(-2).every((item) => item.idempotentNoop === true && item.actionCount === 0);
  check(changedThenNoop || retainedNoopBaseline, "receipt proves neither changed-then-noop reconciliation nor a two-observation retained no-op baseline");
  check(runs.at(-1)?.idempotentNoop === true && runs.at(-1)?.actionCount === 0, "receipt latest reconcile run is not an idempotent no-op");
  check(
    receipt.spec?.deterministicProofMode === (
      changedThenNoop
        ? "changed-then-zero-action-rerun"
        : "two-zero-action-retained-baseline-observations"
    ),
    "receipt deterministic proof mode does not match its run evidence",
  );
  check(receipt.status?.result === "pass", "mini-IDP receipt status is not pass");
  check(receipt.status?.cleanRoomReproducible === false, "retained-org receipt must not overclaim clean-room reproduction");
  check(receipt.status?.deterministicReconciliationProven === true, "mini-IDP receipt deterministic reconciliation proof is missing");
  check(receipt.status?.idempotentRerunProven === true, "mini-IDP receipt does not prove a zero-action rerun");
  check(receipt.status?.fullCurrentSelectionDelivered === true, "mini-IDP receipt does not claim the full current selection");
  check((receipt.status?.limits ?? []).length >= 5, "mini-IDP receipt limits are incomplete");
  console.log(`verified ${relativeRepo(RECEIPT_PATH)}: ${counts.spaces} Spaces, ${counts.managedUnits} Units, ${counts.releases} releases, ${counts.liveMatrixRows} live matrix rows`);
}
