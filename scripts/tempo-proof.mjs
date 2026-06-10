// Tempo proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor, workloadPodSpec } from "./lib/proof-common.mjs";

const chart = {
  repository: "grafana",
  repositoryURL: "https://grafana.github.io/helm-charts",
  name: "tempo",
  version: "1.24.4",
  releaseName: "tempo",
  namespace: "tempo",
  kubeVersion: "1.30.0",
};

const serviceMonitorCRD = {
  name: "servicemonitors.monitoring.coreos.com",
  sourcePath: "../../../prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/release-objects.yaml",
  sourceVariant: "prometheus-community/kube-prometheus-stack@85.3.3/default",
  purpose: "Prometheus Operator ServiceMonitor CRD required by Tempo's ServiceMonitor object",
  deliveryLanes: ["regularHelm", "cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"],
};

const variants = [
  {
    name: "local-persistent",
    base: "local-persistent",
    displayName: "local persistent single-binary",
    valuesFile: "effective-values.yaml",
    valuesText: `persistence:
  enabled: true
  enableStatefulSetAutoDeletePVC: false
  storageClassName: standard
  accessModes:
    - ReadWriteOnce
  size: 10Gi
  annotations: {}
tempo:
  reportingEnabled: false
  storage:
    trace:
      backend: local
      local:
        path: /var/tempo/traces
      wal:
        path: /var/tempo/wal
`,
    valuesSummary: "local backend with explicit WAL/traces PVC settings and kind-compatible StorageClass",
    expectedObjectCount: 4,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    apiVersions: ["networking.k8s.io/v1"],
    targetFactNote: "uses local storage, the vanilla kind default StorageClass, and disables Tempo usage reporting so the rendered StatefulSet is deterministic",
  },
  {
    name: "s3-query-observability",
    base: "s3-query-observability",
    displayName: "S3 query and observability",
    valuesFile: "effective-values-s3-query-observability.yaml",
    valuesText: `persistence:
  enabled: true
  storageClassName: standard
  accessModes:
    - ReadWriteOnce
  size: 10Gi
  annotations: {}
service:
  targetPort: 3200
tempo:
  reportingEnabled: false
  storage:
    trace:
      backend: s3
      local: null
      s3:
        bucket: tempo-traces
        endpoint: s3.us-east-1.amazonaws.com
        region: us-east-1
        insecure: false
      wal:
        path: /var/tempo/wal
  extraEnv:
    - name: AWS_ACCESS_KEY_ID
      valueFrom:
        secretKeyRef:
          name: tempo-s3-credentials
          key: access_key
    - name: AWS_SECRET_ACCESS_KEY
      valueFrom:
        secretKeyRef:
          name: tempo-s3-credentials
          key: secret_key
tempoQuery:
  enabled: true
  ingress:
    enabled: true
    ingressClassName: nginx
    hosts:
      - query.tempo.example.com
networkPolicy:
  enabled: true
serviceMonitor:
  enabled: true
`,
    valuesSummary: "S3 backend with external credential Secret, object-store dependency, query ingress, NetworkPolicy, and ServiceMonitor",
    expectedObjectCount: 8,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    apiVersions: ["networking.k8s.io/v1", "monitoring.coreos.com/v1"],
    targetFactNote:
      "requires target Secret tempo/tempo-s3-credentials, pre-render S3 endpoint/bucket/region values, and the Prometheus Operator ServiceMonitor CRD before runtime readiness",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "tempo",
          name: "tempo-s3-credentials",
          keys: ["access_key", "secret_key"],
          purpose: "S3 access credentials referenced by Tempo environment variables",
        },
      ],
      requiredValues: [
        {
          path: "tempo.storage.trace.s3.endpoint",
          purpose: "S3-compatible endpoint that Tempo will write traces to",
          stage: "pre-render",
        },
        {
          path: "tempo.storage.trace.s3.bucket",
          purpose: "Existing bucket for Tempo trace blocks",
          stage: "pre-render",
        },
        {
          path: "tempo.storage.trace.s3.region",
          purpose: "Object-store region used with the selected endpoint and bucket",
          stage: "pre-render",
        },
      ],
      requiredCRDs: [serviceMonitorCRD],
    },
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
    { id: "deployment-workload-review", severity: "medium", description: "Deployments need rollout, persistence, and rollback policy." },
    { id: "extension-slot-review", severity: "medium", description: "tpl/raw extension slots need provenance and scan coverage." },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  expectedDependencyCount: 0,
  recordChartLockDigest: true,
  recordDeprecated: true,
  expectedDeprecated: true,
  valueModel: {
    checkedValues: [
      { path: "persistence.enabled / persistence.storageClassName / persistence.size", variant: "local-persistent", disposition: "storage-profile-bound", reason: "local single-binary storage and the kind-compatible StorageClass are captured explicitly as a deterministic install variant" },
      { path: "tempo.storage.trace.backend / tempo.storage.trace.local / tempo.storage.trace.wal", variant: "local-persistent", disposition: "storage-backend-bound", reason: "the local backend and WAL/traces paths are pinned before render" },
      { path: "tempo.storage.trace.s3 / tempo.extraEnv", variant: "s3-query-observability", disposition: "target-fact-bound", reason: "S3 endpoint, bucket, and region are pre-render target values, and credentials are referenced from a declared target Secret" },
      { path: "tempo.storage.trace.local", variant: "s3-query-observability", disposition: "merge-cleanup-bound", reason: "set to null so Helm's values merge does not accidentally keep local storage alongside S3" },
      { path: "tempoQuery.enabled / tempoQuery.ingress.*", variant: "s3-query-observability", disposition: "query-exposure-bound", reason: "query UI exposure is only added by an explicit variant with host and ingress class captured" },
      { path: "serviceMonitor.enabled", variant: "s3-query-observability", disposition: "target-capability-bound", reason: "ServiceMonitor rendering is tied to an explicit Prometheus Operator API version requirement" },
      { path: "config / structuredConfig / extraVolumes / extraVolumeMounts", variant: "all", disposition: "extension-slot", reason: "Tempo exposes powerful config and mount extension slots; promoted variants keep them controlled" },
      { path: "reportingEnabled", variant: "all", disposition: "telemetry-disabled", reason: "promoted variants disable Tempo usage reporting explicitly" },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart declares no subchart dependencies; the empty closure is recorded explicitly." },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile." },
    { category: "chart-deprecation", status: "noted", note: "The literal grafana/tempo chart is deprecated; the proof records that status and notes the maintained successor chart separately." },
    {
      category: "target-facts",
      status: "variant-controlled",
      evidence: "tempo.storage.trace.s3 and tempo.extraEnv secretKeyRef",
      note: "The s3-query-observability variant declares S3 endpoint, bucket, and region as pre-render values, and references credentials from a target Secret instead of embedding access keys in rendered ConfigMaps.",
    },
    { category: "object-store-runtime-prerequisite", status: "runtime-watch", evidence: "tempo.storage.trace.s3", note: "The S3 variant needs the declared endpoint, bucket, region, and credentials to be real before Tempo becomes ready; dummy credentials alone are not a live proof." },
    { category: "capability-profile", status: "variant-controlled", evidence: "monitoring.coreos.com/v1", note: "The ServiceMonitor variant records the Prometheus Operator API as an explicit target capability." },
    {
      category: "servicemonitor-crd-target-fact",
      status: "target-fact",
      object: "apiextensions.k8s.io/v1|CustomResourceDefinition||servicemonitors.monitoring.coreos.com",
      note: "The Tempo chart renders a ServiceMonitor when the API is declared, but the Prometheus Operator CRD must already exist in the target cluster.",
    },
    { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|tempo|tempo" },
    { category: "query-ingress-policy", status: "variant-controlled", object: "networking.k8s.io/v1|Ingress|tempo|tempo" },
    { category: "network-policy", status: "scan-and-review", object: "networking.k8s.io/v1|NetworkPolicy|tempo|tempo" },
    { category: "servicemonitor-capability", status: "variant-controlled", object: "monitoring.coreos.com/v1|ServiceMonitor|tempo|tempo" },
    { category: "upstream-runtime-risk", status: "scan-and-review", note: "The chart StatefulSet references serviceName tempo-headless, but the chart renders no headless Service in these variants." },
    { category: "extension-slots", status: "controlled-by-empty-defaults", note: "config, structuredConfig, extra volume/mount, and tpl-controlled strings are controlled in promoted variants." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||tempo" },
  ],
  dossier: {
    extra: {
      successorChart: {
        note: "The literal grafana/tempo chart is deprecated; grafana-community/tempo is the maintained successor noted for future catalog work.",
        chart: "grafana-community/tempo",
      },
    },
    maintainedNotes: [
      "Chart.yaml marks this chart version deprecated, and the proof records that status.",
      "local-persistent uses local Tempo storage and explicit PVC settings.",
      "s3-query-observability switches to S3 storage, nulls local storage to avoid Helm merge residue, records endpoint/bucket/region as pre-render target values, and references S3 credentials from a target Secret.",
      "s3-query-observability adds Tempo Query ingress, NetworkPolicy, and ServiceMonitor behind explicit capability and policy checks; the ServiceMonitor CRD is recorded as a target fact.",
      "The chart StatefulSet references serviceName tempo-headless, but these variants render no headless Service; the proof records this as an upstream/runtime risk.",
      "config, structuredConfig, extra volumes/mounts, and tpl-controlled strings are powerful extension surfaces; promoted variants keep them controlled.",
    ],
    knownControlPoints: [
      "chart-deprecation",
      "target-facts",
      "object-store-runtime-prerequisite",
      "storage-backend-policy",
      "query-ingress-policy",
      "network-policy",
      "servicemonitor-capability",
      "servicemonitor-crd-target-fact",
      "statefulset-runtime-risk",
      "raw-template-extension-slots",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after chart deprecation review, storage backend policy, reachable object-store proof for the declared endpoint/bucket/region, S3 credential Secret ownership, query ingress, ServiceMonitor capability, StatefulSet/headless-Service runtime risk, and raw/template extension-slot review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the Tempo public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "the literal `grafana/tempo` chart is deprecated, and the proof records that fact instead of hiding it;",
      "`local-persistent` captures local single-binary storage and PVC settings;",
      "`s3-query-observability` records S3 endpoint, bucket, and region as pre-render target values, uses a declared target Secret for S3 credentials, does not render a Secret, and adds query ingress, NetworkPolicy, and ServiceMonitor;",
      "`s3-query-observability` needs the declared object-store endpoint, bucket, region, and credentials for live readiness; this is recorded as a runtime prerequisite, not hidden as a Helm/ConfigHub mismatch;",
      "`s3-query-observability` records the Prometheus Operator ServiceMonitor CRD as a target prerequisite instead of hiding it in apply-time failure;",
      "storage backend, target fact, object-store runtime, ingress, NetworkPolicy, ServiceMonitor capability, StatefulSet runtime, chart deprecation, and raw/template extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Tempo storage backend and query/observability posture are explicit variant choices",
      "Helm hook behavior needs explicit lifecycle policy before production",
      "Tempo StatefulSet, storage, S3 credential Secret, query ingress, NetworkPolicy, ServiceMonitor, and extension slots need production review",
      variant.targetFactNote,
    ],
  }),
  scanExtra(docs) {
    const findings = [];
    for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
      findings.push({
        id: `crd-upgrade-policy:${identityFor(doc)}`,
        rule: "crd-upgrade-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "CRD readiness, ordering, schema validation, and upgrade compatibility require explicit policy",
      });
    }
    findings.push({
      id: "chart-deprecation:grafana-tempo",
      rule: "dependency-lock-review",
      severity: "medium",
      object: "source|grafana/tempo",
      message: "The literal grafana/tempo chart is deprecated; successor chart review is required before production catalog publication",
    });
    findings.push({
      id: "extension-slot-review:tempo",
      rule: "extension-slot-review",
      severity: "medium",
      object: "values|config|structuredConfig|extraVolumes|extraVolumeMounts|tpl-strings",
      message: "Tempo config, structuredConfig, volume/mount, and templated-string extension slots must be scanned when populated",
    });
    for (const doc of docs.filter((item) => workloadPodSpec(item))) {
      const object = identityFor(doc);
      const podSpec = workloadPodSpec(doc);
      const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
      for (const container of containers) {
        for (const env of container.env ?? []) {
          const ref = env.valueFrom?.secretKeyRef;
          if (!ref?.name) continue;
          findings.push({
            id: `target-secret-fact:${object}:${container.name ?? "container"}:${env.name}`,
            rule: "generated-secret-ownership",
            severity: "medium",
            object,
            message: `container ${container.name ?? "container"} references target Secret ${ref.name}/${ref.key ?? ""}`,
          });
        }
      }
    }
    for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
      findings.push({
        id: `cluster-rbac-review:${identityFor(doc)}`,
        rule: "cluster-rbac-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Tempo RBAC requires production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "StatefulSet")) {
      findings.push({
        id: `stateful-workload-review:${identityFor(doc)}`,
        rule: "deployment-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Tempo StatefulSet storage, rollout, and retention policy require production review",
      });
      if (doc.spec?.serviceName && !docs.some((item) => item.kind === "Service" && item.metadata?.name === doc.spec.serviceName)) {
        findings.push({
          id: `statefulset-service-risk:${identityFor(doc)}`,
          rule: "service-selector-has-workload-match",
          severity: "medium",
          object: identityFor(doc),
          message: `StatefulSet references serviceName ${doc.spec.serviceName}, but that Service is not rendered by the chart`,
        });
      }
    }
    for (const doc of docs.filter((item) => item.kind === "ServiceMonitor")) {
      findings.push({
        id: `servicemonitor-capability:${identityFor(doc)}`,
        rule: "extension-slot-review",
        severity: "medium",
        object: identityFor(doc),
        message: "ServiceMonitor requires the Prometheus Operator CRD to exist in the target cluster",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "NetworkPolicy")) {
      findings.push({
        id: `network-policy-review:${identityFor(doc)}`,
        rule: "extension-slot-review",
        severity: "medium",
        object: identityFor(doc),
        message: "NetworkPolicy intent must be reviewed against the target namespace and ingress controller topology",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "PodDisruptionBudget")) {
      findings.push({
        id: `availability-policy-review:${identityFor(doc)}`,
        rule: "deployment-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "PodDisruptionBudget needs production availability and rollout policy review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Ingress")) {
      findings.push({
        id: `edge-ingress-policy:${identityFor(doc)}`,
        rule: "extension-slot-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Tempo query ingress requires host, class, and edge policy review",
      });
    }
    return findings;
  },
  verifyExtra({ root, controlPoints, perVariant, check, readYaml, join }) {
    check(controlPoints.spec.points?.some((point) => point.category === "chart-deprecation"), "chart-deprecation control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "target-facts"), "target-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "object-store-runtime-prerequisite"), "object-store-runtime-prerequisite control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "servicemonitor-crd-target-fact"), "servicemonitor-crd-target-fact control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "stateful-workload"), "stateful-workload control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "query-ingress-policy"), "query-ingress-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "extension-slots"), "extension-slots control point missing");

    for (const variant of variants) {
      const { identities, renderReceipt, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(JSON.stringify(renderReceipt.spec.renderer.apiVersions ?? []) === JSON.stringify(variant.apiVersions ?? []), `${variant.name} renderer apiVersions mismatch`);
      check(identities.includes("apps/v1|StatefulSet|tempo|tempo"), `${variant.name} StatefulSet missing`);
      check(identities.includes("v1|Service|tempo|tempo"), `${variant.name} Service missing`);
      check(identities.includes("v1|ServiceAccount|tempo|tempo"), `${variant.name} ServiceAccount missing`);
      check(identities.includes("v1|ConfigMap|tempo|tempo"), `${variant.name} ConfigMap missing`);
      check(!secretIdentities.length, `${variant.name} must not render a Secret`);
      if (variant.name === "local-persistent") {
        check(!identities.includes("networking.k8s.io/v1|Ingress|tempo|tempo"), "local-persistent must not render an Ingress");
        check(!identities.includes("networking.k8s.io/v1|NetworkPolicy|tempo|tempo"), "local-persistent must not render a NetworkPolicy");
      }
      if (variant.name === "s3-query-observability") {
        const variantDoc = readYaml(join(root, "variants", "s3-query-observability", "variant.yaml"));
        const requiredValues = variantDoc.spec.targetFacts?.requiredValues ?? [];
        for (const path of [
          "tempo.storage.trace.s3.endpoint",
          "tempo.storage.trace.s3.bucket",
          "tempo.storage.trace.s3.region",
        ]) {
          const requiredValue = requiredValues.find((item) => item.path === path);
          check(requiredValue?.stage === "pre-render", `s3-query-observability ${path} target value must be pre-render`);
        }
        check(identities.includes("networking.k8s.io/v1|Ingress|tempo|tempo"), "s3-query-observability Ingress missing");
        check(identities.includes("networking.k8s.io/v1|NetworkPolicy|tempo|tempo"), "s3-query-observability NetworkPolicy missing");
        check(identities.includes("monitoring.coreos.com/v1|ServiceMonitor|tempo|tempo"), "s3-query-observability ServiceMonitor missing");
        check(identities.includes("v1|ConfigMap|tempo|tempo-query"), "s3-query-observability tempo-query ConfigMap missing");
      }
      check(scan.spec.findingCounts.medium >= 3, `${variant.name} scan must flag storage/stateful/runtime risk and extension review`);
    }
  },
});
