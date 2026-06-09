// kube-prometheus-stack proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged. Supports the multi-version
// harness env overrides (HELM_EXPT_CHART_VERSION / HELM_EXPT_PROOF_OUTPUT_ROOT) via
// the kit.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "prometheus-community",
  repositoryURL: "https://prometheus-community.github.io/helm-charts",
  name: "kube-prometheus-stack",
  version: "85.3.3",
  releaseName: "kube-prometheus-stack",
  namespace: "monitoring",
  kubeVersion: "1.30.0",
};

const prometheusOperatorCRDs = [
  "alertmanagerconfigs.monitoring.coreos.com",
  "alertmanagers.monitoring.coreos.com",
  "podmonitors.monitoring.coreos.com",
  "probes.monitoring.coreos.com",
  "prometheusagents.monitoring.coreos.com",
  "prometheuses.monitoring.coreos.com",
  "prometheusrules.monitoring.coreos.com",
  "scrapeconfigs.monitoring.coreos.com",
  "servicemonitors.monitoring.coreos.com",
  "thanosrulers.monitoring.coreos.com",
];

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default with Grafana password bound",
    valuesFile: "effective-values.yaml",
    valuesText: `grafana:
  adminPassword: confighub-grafana-admin-password
`,
    valuesSummary: "default stack with Grafana admin password bound as a generated fact",
    expectedObjectCount: 124,
    expectedCRDCount: 10,
    expectedSecretCount: 2,
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "monitoring",
          name: "kube-prometheus-stack-admission",
          keys: ["cert", "key"],
          purpose: "Prometheus Operator admission webhook TLS material normally created by Helm hook lifecycle",
          deliveryLanes: ["cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"],
        },
      ],
    },
    targetFactNote: "includes Prometheus Operator CRDs, Grafana, webhook configurations, generated Grafana admin password binding, and config-only webhook TLS target facts",
  },
  {
    name: "no-crds",
    base: "no-crds",
    displayName: "CRDs disabled",
    valuesFile: "effective-values-no-crds.yaml",
    valuesText: `crds:
  enabled: false
grafana:
  adminPassword: confighub-grafana-admin-password
`,
    valuesSummary: "CRDs disabled with Grafana admin password bound",
    expectedObjectCount: 114,
    expectedCRDCount: 0,
    expectedSecretCount: 2,
    targetFacts: {
      requiredCRDs: prometheusOperatorCRDs.map((name) => ({
        name,
        sourceVariant: "default",
        purpose: "Prometheus Operator CRD managed outside this no-crds base",
        deliveryLanes: ["regularHelm", "cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"],
      })),
      requiredSecrets: [
        {
          namespace: "monitoring",
          name: "kube-prometheus-stack-admission",
          keys: ["cert", "key"],
          purpose: "Prometheus Operator admission webhook TLS material normally created by Helm hook lifecycle",
          deliveryLanes: ["cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"],
        },
      ],
    },
    targetFactNote: "omits Prometheus Operator CRDs while preserving Grafana, webhooks, RBAC, rules, ServiceMonitors, required target CRDs, and config-only webhook TLS target facts",
  },
];

const scanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    {
      id: "mutable-image-tag",
      severity: "high",
      description: "Container image must use an immutable or non-latest tag.",
    },
    {
      id: "service-selector-has-workload-match",
      severity: "high",
      description: "Service selector must match a rendered workload pod template.",
    },
    {
      id: "workload-service-account-exists",
      severity: "high",
      description: "Workload serviceAccountName must reference a rendered ServiceAccount.",
    },
    {
      id: "admission-webhook-requires-observation",
      severity: "medium",
      description: "Admission webhook availability must be observed after apply.",
    },
    {
      id: "generated-secret-ownership",
      severity: "medium",
      description: "Rendered Secrets with generated material need explicit ownership and observation policy.",
    },
    {
      id: "dependency-lock-review",
      severity: "medium",
      description: "Disabled chart dependencies still need lock and provenance review.",
    },
    {
      id: "crd-upgrade-policy",
      severity: "medium",
      description: "CRDs need explicit readiness, ordering, schema, and upgrade policy.",
    },
    {
      id: "cluster-rbac-review",
      severity: "medium",
      description: "Cluster-scoped RBAC needs explicit review before production.",
    },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  // single cub-only support object (the created Namespace)
  supportObjects: ["v1|Namespace||monitoring"],
  expectedDependencyCount: 5,
  recordChartLockDigest: true,
  dependencyLockChart: "prometheus-community/kube-prometheus-stack",
  // Pre-existing quirk preserved: the original artifact name doubles the chart name
  // (kube-prometheus-stack-kube-prometheus-stack) rather than repo-name. Drives both
  // packageName and lockName.
  packageName: "kube-prometheus-stack-kube-prometheus-stack",
  // kps's committed helm-equivalence receipts prune both null fields and empty metadata maps.
  semanticNormalizations: ["prune-null-fields", "prune-empty-metadata-maps"],
  valueModel: {
    checkedValues: [
      {
        path: "grafana.adminPassword",
        variant: "default",
        disposition: "generated-fact-bound",
        reason: "Grafana subchart generates a random admin password by default; this proof binds it before render",
      },
      {
        path: "grafana.adminPassword",
        variant: "no-crds",
        disposition: "generated-fact-bound",
        reason: "The no-crds variant keeps Grafana enabled and binds the same generated fact before render",
      },
      {
        path: "crds.enabled",
        variant: "default",
        disposition: "crds-included",
        reason: "chart defaults render all Prometheus Operator CRDs",
      },
      {
        path: "crds.enabled",
        variant: "no-crds",
        disposition: "crds-excluded",
        reason: "omits CRDs from the rendered revision for clusters that manage CRDs separately",
      },
      {
        path: "crds.*",
        variant: "all",
        disposition: "crd-selection-controls",
        reason: "controls Prometheus Operator CRD rendering",
      },
      {
        path: "prometheusOperator.admissionWebhooks.*",
        variant: "all",
        disposition: "admission-webhook-policy",
        reason: "controls Prometheus Operator admission webhook objects and patch-job hook policy",
      },
      {
        path: "additionalPrometheusRulesMap / prometheus.prometheusSpec.additionalScrapeConfigs / extraManifests",
        variant: "all",
        disposition: "empty-extension-slot",
        reason: "chart exposes tpl/raw monitoring extension slots; promoted variants keep them empty",
      },
      {
        path: "grafana.enabled / kubeStateMetrics.enabled / nodeExporter.enabled",
        variant: "all",
        disposition: "umbrella-dependency-selection",
        reason: "umbrella chart dependencies remain enabled in promoted variants and are recorded in dependency-lock.yaml",
      },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    {
      category: "dependency-lock",
      status: "handled",
      evidence: "dependency-lock.yaml",
      note: "chart declares CRD, kube-state-metrics, node-exporter, Grafana, and windows-exporter dependencies; promoted variants lock their metadata.",
    },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note: "OpenShift and ServiceMonitor branches are bound to the named Kubernetes capability profile.",
    },
    {
      category: "crd-policy",
      status: "variant-controlled-and-target-fact",
      variants: { default: 10, "no-crds": 0 },
      note: "CRDs are ordinary rendered objects in the default variant; no-crds records those same CRDs as target prerequisites.",
    },
    {
      category: "admission-webhook",
      status: "target-fact-and-observe",
      objects: [
        "admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||kube-prometheus-stack-admission",
        "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||kube-prometheus-stack-admission",
      ],
      note: "Config-only delivery must stage the kube-prometheus-stack-admission Secret because Helm normally creates the TLS material through hook lifecycle.",
    },
    {
      category: "generated-facts",
      status: "variant-controlled",
      evidence: "grafana.adminPassword",
      note: "Both promoted variants bind Grafana admin password before render so Helm output is deterministic.",
    },
    { category: "cluster-rbac", status: "scan-and-review", evidence: "scan receipts" },
    {
      category: "tpl",
      status: "controlled-by-empty-defaults",
      note: "Prometheus/Grafana rules, scrape configs, datasource config, and extraManifests can use templating; promoted variants keep raw slots empty.",
    },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||monitoring" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart render is nondeterministic unless grafana.adminPassword is bound before render.",
      "default variant binds grafana.adminPassword and renders 10 Prometheus Operator CRDs.",
      "no-crds variant omits CRDs for clusters that manage CRDs separately and records those CRDs as target facts.",
      "Chart declares CRD, kube-state-metrics, node-exporter, Grafana, and windows-exporter dependencies and records them in dependency-lock.yaml.",
      "Config-only delivery stages the kube-prometheus-stack-admission TLS Secret as a target fact; regular Helm creates that material through hook lifecycle.",
      "Admission webhook readiness must still be observed after apply because rendered objects plus staged Secret do not prove webhook health.",
      "CRD manifests include YAML enum scalars such as bare equals signs; the proof parser handles these as scalar strings.",
      "Rules, scrape configs, datasource config, and extraManifests are tpl/raw extension slots; promoted variants keep raw slots empty.",
    ],
    knownControlPoints: [
      "capability-profile",
      "crd-lifecycle-policy",
      "generated-facts",
      "dependency-lock",
      "admission-webhook-observation",
      "cluster-rbac-scan",
      "tpl-extension-slot",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after CRD lifecycle/upgrade policy, webhook observation policy, generated Grafana credential policy, dependency lock review, and cluster RBAC review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the kube-prometheus-stack public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart render becomes deterministic when grafana.adminPassword is bound before render;",
      "the no-crds variant deliberately removes the 10 Prometheus Operator CRDs;",
      "CRD lifecycle, admission webhook, generated Grafana credential, umbrella dependency, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "CRD install/upgrade behavior needs explicit lifecycle policy before production",
      "Admission webhook availability needs a fresh observation receipt after apply",
      "Grafana admin password binding must be owned by generated-fact policy before production",
      "Cluster-scoped RBAC needs production review",
      variant.targetFactNote,
    ],
  }),
  // Chart-specific scan rules: admission webhooks, CRDs, the generated Grafana
  // Secret, and the static umbrella dependency-lock finding. (mutable-image-tag,
  // service-selector, workload-service-account, and cluster-rbac-review come from the kit.)
  scanExtra(docs) {
    const findings = [];
    for (const doc of docs.filter((item) => item.kind === "ValidatingWebhookConfiguration")) {
      findings.push({
        id: `admission-webhook-requires-observation:${identityFor(doc)}`,
        rule: "admission-webhook-requires-observation",
        severity: "medium",
        object: identityFor(doc),
        message: "Admission webhook availability must be observed after apply",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
      findings.push({
        id: `crd-upgrade-policy:${identityFor(doc)}`,
        rule: "crd-upgrade-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "CRD readiness, ordering, schema validation, and upgrade compatibility require explicit policy",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "kube-prometheus-stack-grafana")) {
      findings.push({
        id: `generated-secret-ownership:${identityFor(doc)}`,
        rule: "generated-secret-ownership",
        severity: "medium",
        object: identityFor(doc),
        message: "Grafana admin credential is bound before render and needs explicit ownership before production promotion",
      });
    }
    findings.push({
      id: "dependency-lock-review:umbrella",
      rule: "dependency-lock-review",
      severity: "medium",
      object: "dependency|crds,kube-state-metrics,prometheus-node-exporter,grafana,prometheus-windows-exporter",
      message: "Umbrella chart dependencies are locked before recipe publication",
    });
    return findings;
  },
  // Chart-specific verify assertions the generic kit cannot infer.
  verifyExtra({ controlPoints, dependencyLock, variants, perVariant, check }) {
    for (const dependencyName of ["crds", "kube-state-metrics", "prometheus-node-exporter", "grafana", "prometheus-windows-exporter"]) {
      check(
        dependencyLock.spec.dependencies?.some((dependency) => dependency.name === dependencyName),
        `kube-prometheus-stack dependency ${dependencyName} missing`,
      );
    }
    check(controlPoints.spec.points?.some((point) => point.category === "capability-profile"), "capability-profile control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "generated-facts"), "generated-facts control point missing");
    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|Deployment|monitoring|kube-prometheus-stack-operator"), `${variant.name} operator Deployment missing`);
      check(identities.includes("apps/v1|Deployment|monitoring|kube-prometheus-stack-grafana"), `${variant.name} Grafana Deployment missing`);
      check(identities.includes("apps/v1|Deployment|monitoring|kube-prometheus-stack-kube-state-metrics"), `${variant.name} kube-state-metrics Deployment missing`);
      check(identities.includes("apps/v1|DaemonSet|monitoring|kube-prometheus-stack-prometheus-node-exporter"), `${variant.name} node-exporter DaemonSet missing`);
      check(identities.includes("v1|Service|monitoring|kube-prometheus-stack-operator"), `${variant.name} operator Service missing`);
      check(identities.includes("v1|Service|monitoring|kube-prometheus-stack-grafana"), `${variant.name} Grafana Service missing`);
      check(identities.includes("v1|Secret|monitoring|kube-prometheus-stack-grafana"), `${variant.name} Grafana Secret missing`);
      check(identities.includes("monitoring.coreos.com/v1|Prometheus|monitoring|kube-prometheus-stack-prometheus"), `${variant.name} Prometheus custom resource missing`);
      check(identities.includes("monitoring.coreos.com/v1|Alertmanager|monitoring|kube-prometheus-stack-alertmanager"), `${variant.name} Alertmanager custom resource missing`);
      check(
        identities.includes("admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||kube-prometheus-stack-admission"),
        `${variant.name} MutatingWebhookConfiguration missing`,
      );
      check(
        identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||kube-prometheus-stack-admission"),
        `${variant.name} ValidatingWebhookConfiguration missing`,
      );
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag CRD/admission/secret/RBAC review`);
      if (variant.name === "default") {
        const requiredCRDs = [
          "apiextensions.k8s.io/v1|CustomResourceDefinition||alertmanagerconfigs.monitoring.coreos.com",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||alertmanagers.monitoring.coreos.com",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||podmonitors.monitoring.coreos.com",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||probes.monitoring.coreos.com",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||prometheusagents.monitoring.coreos.com",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||prometheuses.monitoring.coreos.com",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||prometheusrules.monitoring.coreos.com",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||scrapeconfigs.monitoring.coreos.com",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||servicemonitors.monitoring.coreos.com",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||thanosrulers.monitoring.coreos.com",
        ];
        for (const identity of requiredCRDs) check(identities.includes(identity), `missing CRD ${identity}`);
      }
      if (variant.name === "no-crds") {
        check(!crdIdentities.length, "no-crds must not render CRDs");
      }
    }
  },
});
