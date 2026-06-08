// Prometheus proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const supportedChartVersion = "29.8.0";
const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? supportedChartVersion;

const chart = {
  repository: "prometheus-community",
  repositoryURL: "https://prometheus-community.github.io/helm-charts",
  name: "prometheus",
  version: chartVersion,
  releaseName: "prometheus",
  namespace: "monitoring",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default monitoring stack",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults with server, Alertmanager, exporters, PVC, and RBAC",
    expectedObjectCount: 23,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "installs the full bundled monitoring stack; scrape, storage, and alerting policy remain explicit operating decisions",
  },
  {
    name: "server-only-ephemeral",
    base: "server-only-ephemeral",
    displayName: "server only without persistence",
    valuesFile: "effective-values-server-only-ephemeral.yaml",
    valuesText: `alertmanager:
  enabled: false
kube-state-metrics:
  enabled: false
prometheus-node-exporter:
  enabled: false
prometheus-pushgateway:
  enabled: false
server:
  persistentVolume:
    enabled: false
`,
    valuesSummary: "only the Prometheus server is rendered and persistence is disabled",
    expectedObjectCount: 6,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "removes bundled components and PVC as a deliberate lightweight install variant",
  },
];

const scanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    { id: "mutable-image-tag", severity: "high", description: "Container image must use an immutable or non-latest tag." },
    { id: "service-selector-has-workload-match", severity: "high", description: "Service selector must match a rendered workload pod template." },
    { id: "workload-service-account-exists", severity: "high", description: "Workload serviceAccountName must reference a rendered ServiceAccount." },
    { id: "helm-hook-lifecycle-policy", severity: "medium", description: "Helm hook resources need explicit lifecycle policy." },
    { id: "dependency-lock-review", severity: "medium", description: "Chart dependencies need lock and provenance review." },
    { id: "generated-secret-ownership", severity: "medium", description: "Rendered Secrets need explicit ownership and observation policy." },
    { id: "crd-upgrade-policy", severity: "medium", description: "CRDs need explicit readiness, ordering, schema, and upgrade policy." },
    { id: "cluster-rbac-review", severity: "medium", description: "Cluster-scoped RBAC needs explicit review before production." },
    { id: "monitoring-workload-review", severity: "medium", description: "Monitoring workloads need rollout, storage, retention, and rollback policy." },
    { id: "scrape-config-review", severity: "medium", description: "Scrape configuration needs provenance and target-scope review." },
    { id: "storage-retention-review", severity: "medium", description: "Prometheus storage and retention settings need explicit review." },
    { id: "bundle-component-review", severity: "medium", description: "Bundled components need explicit dependency and ownership review." },
    { id: "extension-slot-review", severity: "medium", description: "tpl/raw extension slots need provenance and scan coverage." },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  packageName: "prometheus",
  supportObjects: ["v1|Namespace||monitoring"],
  expectedDependencyCount: 4,
  recordChartLockDigest: true,
  recordDeprecated: true,
  expectedDeprecated: false,
  valueModel: {
    checkedValues: [
      {
        path: "alertmanager.enabled / kube-state-metrics.enabled / prometheus-node-exporter.enabled / prometheus-pushgateway.enabled",
        variant: "server-only-ephemeral",
        disposition: "variant-controlled",
        reason: "the server-only variant deliberately removes bundled components and their RBAC/workloads",
      },
      {
        path: "server.persistentVolume.enabled",
        variant: "server-only-ephemeral",
        disposition: "variant-controlled",
        reason: "the server-only variant deliberately disables the Prometheus server PVC",
      },
      {
        path: "serverFiles / scrapeConfigs / extraScrapeConfigs",
        variant: "all",
        disposition: "scrape-config-review",
        reason: "scrape configuration is rendered into ConfigMaps and must be reviewable by variant",
      },
      {
        path: "server.remoteWrite / server.remoteRead",
        variant: "all",
        disposition: "data-egress-review",
        reason: "remote read/write endpoints must be explicit before production promotion",
      },
      {
        path: "server.statefulSet.enabled / server.replicaCount",
        variant: "all",
        disposition: "workload-shape-review",
        reason: "Deployment versus StatefulSet and replica count are core operational choices",
      },
      {
        path: "server.ingress.enabled / networkPolicy.enabled / server.podDisruptionBudget.enabled",
        variant: "all",
        disposition: "production-hardening-review",
        reason: "exposure, network, and disruption policy should be deliberate variants",
      },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    {
      category: "dependency-lock",
      status: "handled",
      evidence: "dependency-lock.yaml",
      note: "chart dependencies are locked and reviewed, including alertmanager, kube-state-metrics, node-exporter, and pushgateway.",
    },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile.",
    },
    { category: "bundle-dependencies", status: "scan-and-review", evidence: "dependency-lock.yaml" },
    { category: "monitoring-workloads", status: "scan-and-review", object: "apps/v1|Deployment|monitoring|prometheus-server" },
    { category: "storage-retention", status: "variant-controlled", object: "v1|PersistentVolumeClaim|monitoring|prometheus-server" },
    { category: "scrape-config", status: "scan-and-review", object: "v1|ConfigMap|monitoring|prometheus-server" },
    { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||prometheus-server" },
    { category: "component-selection", status: "variant-controlled", evidence: "alertmanager/kube-state-metrics/node-exporter/pushgateway values" },
    {
      category: "extension-slots",
      status: "controlled-by-empty-defaults",
      note: "extra scrape configs, remote read/write, ingress, network policy, PDB, and extra manifests are explicit variant inputs.",
    },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||monitoring" },
  ],
  dossier: {
    maintainedNotes: [
      "The chart renders deterministically under pinned Helm, chart version, kube version, and values.",
      "The default variant installs Prometheus server, Alertmanager, kube-state-metrics, node-exporter, pushgateway, server PVC, services, and cluster RBAC.",
      "The server-only-ephemeral variant disables bundled components and server persistence as deliberate variant-controlled outputs.",
      "Scrape config, remote read/write, ingress, network policy, PDB, and extra-manifest slots are extension surfaces that must be explicit before production.",
      "Bundled dependency ownership, storage/retention, workload rollout, and cluster RBAC are scan/gate review points.",
      "StatefulSet and HA behavior become future variants, not hidden defaults.",
    ],
    knownControlPoints: [
      "bundle-dependencies",
      "monitoring-workloads",
      "storage-retention",
      "scrape-config",
      "component-selection",
      "rbac-review",
      "extension-slots",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after component selection, scrape config, storage/retention, RBAC, workload exposure, and remote read/write policies are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the Prometheus public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "the default variant keeps the bundled monitoring stack visible: Prometheus server, Alertmanager, kube-state-metrics, node-exporter, pushgateway, server PVC, services, and cluster RBAC;",
      "the server-only-ephemeral variant deliberately removes bundled components and server persistence;",
      "scrape config, remote read/write, ingress, network policy, PDB, and extra manifests are not hidden Helm behavior; they are explicit variant/review surfaces;",
      "dependency ownership, storage/retention, workload rollout, cluster RBAC, and scrape-config risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Bundled component ownership and dependency policy must be explicit before production",
      "Prometheus scrape configuration and service discovery scope need production review",
      "Storage, retention, Alertmanager, and rollback policy need production review",
      "Cluster RBAC and workload exposure need production review",
      "Remote read/write, ingress, network policy, PDB, and extra-manifest slots must be reviewed when populated",
      variant.targetFactNote,
    ],
  }),
  scanExtra(docs) {
    const findings = [];
    const bundledComponents = docs.filter((item) =>
      ["prometheus-alertmanager", "prometheus-kube-state-metrics", "prometheus-prometheus-node-exporter", "prometheus-prometheus-pushgateway"].includes(
        item.metadata?.name,
      ),
    );
    if (bundledComponents.length) {
      findings.push({
        id: "bundle-component-review:default-components",
        rule: "bundle-component-review",
        severity: "medium",
        object: "values|alertmanager|kube-state-metrics|prometheus-node-exporter|prometheus-pushgateway",
        message: "Bundled monitoring component ownership and upgrade policy require production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "ConfigMap" && item.metadata?.name === "prometheus-server")) {
      findings.push({
        id: `scrape-config-review:${identityFor(doc)}`,
        rule: "scrape-config-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Prometheus scrape configuration, service discovery scope, and remote read/write settings require production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "PersistentVolumeClaim")) {
      findings.push({
        id: `storage-retention-review:${identityFor(doc)}`,
        rule: "storage-retention-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Prometheus storage, retention, and rollback policy require production review",
      });
    }
    findings.push({
      id: "extension-slot-review:prometheus-values",
      rule: "extension-slot-review",
      severity: "medium",
      object: "values|extraScrapeConfigs|scrapeConfigFiles|remoteWrite|remoteRead|extraManifests|ingress|networkPolicy|podDisruptionBudget",
      message: "Extra scrape, remote read/write, ingress, network policy, PDB, and extra-manifest slots must be scanned when populated",
    });
    for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
      findings.push({
        id: `cluster-rbac-review:${identityFor(doc)}`,
        rule: "cluster-rbac-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Prometheus RBAC requires production review",
      });
    }
    for (const doc of docs.filter((item) => ["DaemonSet", "Deployment", "StatefulSet"].includes(item.kind))) {
      findings.push({
        id: `monitoring-workload-review:${identityFor(doc)}`,
        rule: "monitoring-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Monitoring workload rollout, storage, retention, and rollback policy require production review",
      });
    }
    return findings;
  },
  verifyExtra({ controlPoints, perVariant, check }) {
    check(controlPoints.spec.points?.some((point) => point.category === "bundle-dependencies"), "bundle-dependencies control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "monitoring-workloads"), "monitoring-workloads control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "storage-retention"), "storage-retention control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "scrape-config"), "scrape-config control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "component-selection"), "component-selection control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "extension-slots"), "extension-slots control point missing");

    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|Deployment|monitoring|prometheus-server"), `${variant.name} server Deployment missing`);
      check(identities.includes("v1|ConfigMap|monitoring|prometheus-server"), `${variant.name} server ConfigMap missing`);
      check(identities.includes("v1|Service|monitoring|prometheus-server"), `${variant.name} server Service missing`);
      check(identities.includes("v1|ServiceAccount|monitoring|prometheus-server"), `${variant.name} server ServiceAccount missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||prometheus-server"), `${variant.name} server ClusterRole missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||prometheus-server"), `${variant.name} server ClusterRoleBinding missing`);
      if (variant.name === "default") {
        check(identities.includes("apps/v1|StatefulSet|monitoring|prometheus-alertmanager"), "default Alertmanager StatefulSet missing");
        check(identities.includes("apps/v1|Deployment|monitoring|prometheus-kube-state-metrics"), "default kube-state-metrics Deployment missing");
        check(identities.includes("apps/v1|DaemonSet|monitoring|prometheus-prometheus-node-exporter"), "default node-exporter DaemonSet missing");
        check(identities.includes("apps/v1|Deployment|monitoring|prometheus-prometheus-pushgateway"), "default pushgateway Deployment missing");
        check(identities.includes("v1|PersistentVolumeClaim|monitoring|prometheus-server"), "default server PVC missing");
      }
      if (variant.name === "server-only-ephemeral") {
        check(!identities.includes("apps/v1|StatefulSet|monitoring|prometheus-alertmanager"), "server-only-ephemeral must not render Alertmanager");
        check(!identities.includes("v1|PersistentVolumeClaim|monitoring|prometheus-server"), "server-only-ephemeral must not render server PVC");
      }
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag bundled components, scrape config, storage, RBAC, workloads, and extension review`);
    }
  },
});
