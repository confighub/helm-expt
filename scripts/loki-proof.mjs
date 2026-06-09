// Loki proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { execFileSync } from "node:child_process";
import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor, repoRoot } from "./lib/proof-common.mjs";

const chart = {
  repository: "grafana",
  repositoryURL: "https://grafana.github.io/helm-charts",
  name: "loki",
  version: "7.0.0",
  releaseName: "loki",
  namespace: "loki",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "single-binary-filesystem",
    base: "single-binary-filesystem",
    displayName: "single binary filesystem",
    valuesFile: "effective-values.yaml",
    valuesText: `deploymentMode: SingleBinary
loki:
  auth_enabled: false
  commonConfig:
    replication_factor: 1
  storage:
    type: filesystem
  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: filesystem
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
singleBinary:
  replicas: 1
read:
  replicas: 0
write:
  replicas: 0
backend:
  replicas: 0
`,
    valuesSummary: "single-binary Loki with filesystem storage and explicit schema config",
    expectedObjectCount: 19,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "avoids object storage by selecting SingleBinary with filesystem storage and a bounded local schema config",
  },
  {
    name: "simple-scalable-minio",
    base: "simple-scalable-minio",
    displayName: "simple scalable with MinIO",
    valuesFile: "effective-values-simple-scalable-minio.yaml",
    valuesText: `loki:
  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: s3
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
  storage:
    type: s3
    bucketNames:
      chunks: loki-chunks
      ruler: loki-ruler
      admin: loki-admin
    s3:
      endpoint: minio.loki.svc.cluster.local:9000
      s3ForcePathStyle: true
      insecure: true
      accessKeyId: loki
      secretAccessKey: loki-secret
  commonConfig:
    replication_factor: 1
read:
  replicas: 1
write:
  replicas: 1
backend:
  replicas: 1
minio:
  enabled: true
`,
    valuesSummary: "simple scalable Loki with one read/write/backend replica, explicit object-storage buckets, and MinIO enabled",
    expectedObjectCount: 33,
    expectedCRDCount: 0,
    expectedSecretCount: 1,
    targetFactNote: "satisfies required bucket names, uses one read/write/backend replica for a one-node local target, and renders the MinIO Secret as chart-owned test storage material",
  },
];

const scanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    { id: "mutable-image-tag", severity: "high", description: "Container image must use an immutable or non-latest tag." },
    { id: "service-selector-has-workload-match", severity: "high", description: "Service selector must match a rendered workload pod template." },
    { id: "workload-service-account-exists", severity: "high", description: "Workload serviceAccountName must reference a rendered ServiceAccount." },
    { id: "blocked-default-render", severity: "medium", description: "Chart defaults that cannot render need an explicit readiness blocker and suggested variants." },
    { id: "storage-config-required", severity: "medium", description: "Loki storage and schema configuration must be selected before render." },
    { id: "object-storage-policy", severity: "medium", description: "Object storage buckets, endpoints, and generated storage Secrets need explicit policy." },
    { id: "lifecycle-policy", severity: "medium", description: "Hooks and tests need explicit lifecycle mapping before production." },
    { id: "dependency-lock-review", severity: "medium", description: "Chart dependencies need lock and provenance review." },
    { id: "rendered-secret-ownership", severity: "medium", description: "Rendered Secrets need explicit ownership and observation policy." },
    { id: "cluster-rbac-review", severity: "medium", description: "Cluster-scoped RBAC needs explicit review before production." },
    { id: "stateful-workload-review", severity: "medium", description: "Stateful workloads need storage, upgrade, and rollback policy." },
    { id: "extension-slot-review", severity: "medium", description: "tpl/raw extension slots need provenance and scan coverage." },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  expectedDependencyCount: 3,
  recordChartLockDigest: true,
  semanticNormalizations: ["prune-null-fields", "loki-configmap-leading-blank-line-pruned-by-kustomize"],
  extraRequiredFiles: ["default-render-blocker.yaml"],
  extraProofDocuments: ({ source }) => [
    { path: "default-render-blocker.yaml", document: defaultRenderBlocker(source.defaultValuesSHA256) },
  ],
  extraEquivalenceClassifications: () => [
    {
      identity: "v1|ConfigMap|loki|loki",
      classification: "serialization-normalization",
      disposition: "allowed",
      note: "cub installer/kustomize removes one leading blank line from Loki config.yaml; parsed Loki config content is otherwise identical.",
    },
  ],
  allowedSemanticDiff({ key, helmObjectJson, cubObjectJson }) {
    if (key !== "v1|ConfigMap|loki|loki") return false;
    const helmObject = JSON.parse(helmObjectJson);
    const cubObject = JSON.parse(cubObjectJson);
    const helmConfig = helmObject.data?.["config.yaml"];
    const cubConfig = cubObject.data?.["config.yaml"];
    if (typeof helmConfig !== "string" || typeof cubConfig !== "string") return false;
    helmObject.data["config.yaml"] = helmConfig.replace(/^\n/, "");
    return JSON.stringify(helmObject) === JSON.stringify(cubObject);
  },
  valueModel: {
    checkedValues: [
      { path: "loki.storage.bucketNames.chunks", variant: "default", disposition: "required-before-render", reason: "chart default render fails until Loki storage buckets are selected" },
      { path: "loki.schemaConfig.configs", variant: "all-promoted", disposition: "variant-bound", reason: "Loki requires an explicit schema epoch and object-store mode for a usable rendered release" },
      { path: "deploymentMode", variant: "single-binary-filesystem", disposition: "topology-selected", reason: "selects a small single-binary topology instead of the default scalable topology" },
      { path: "singleBinary.replicas / read.replicas / write.replicas / backend.replicas", variant: "single-binary-filesystem", disposition: "topology-selected", reason: "keeps exactly one Loki StatefulSet active and disables distributed read/write/backend components" },
      { path: "loki.storage.type", variant: "single-binary-filesystem", disposition: "filesystem-storage", reason: "avoids external object storage for the small local-test variant" },
      { path: "loki.storage.type / loki.storage.s3 / loki.storage.bucketNames", variant: "simple-scalable-minio", disposition: "object-storage-bound", reason: "selects S3-compatible storage with explicit bucket names and endpoint" },
      { path: "read.replicas / write.replicas / backend.replicas / loki.commonConfig.replication_factor", variant: "simple-scalable-minio", disposition: "local-target-fit", reason: "keeps the scalable topology schedulable on a one-node local proof target while preserving read/write/backend components" },
      { path: "minio.enabled", variant: "simple-scalable-minio", disposition: "dependency-enabled", reason: "turns on the bundled MinIO dependency as a local-test object-store fixture" },
      { path: "grafana-agent-operator / rollout-operator / minio", variant: "all", disposition: "locked-dependency", reason: "chart dependency metadata is recorded in dependency-lock.yaml whether or not a dependency is enabled in a variant" },
      { path: "loki.config / loki.structuredConfig / extraObjects / extraContainers / extraEnv", variant: "all", disposition: "extension-slot", reason: "Loki exposes templated config and raw/extra manifest slots; promoted variants keep raw object slots empty" },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart declares MinIO, grafana-agent-operator, and rollout-operator dependencies; promoted variants lock their metadata." },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile." },
    { category: "blocked-default-render", status: "handled", evidence: "default-render-blocker.yaml", note: "The chart default fails before render because required storage bucket/schema inputs are missing; the proof records the blocker and supplies two bounded variants." },
    { category: "storage-config", status: "variant-controlled", evidence: "loki.storage + loki.schemaConfig", note: "Promoted variants bind storage mode, schemaConfig, and object-store settings before creating a rendered revision." },
    { category: "object-storage-policy", status: "variant-controlled", evidence: "simple-scalable-minio", note: "The MinIO variant renders a chart-owned object-store fixture and marks its Secret as review-required before production." },
    { category: "lifecycle-policy", status: "not-present-in-promoted-render", policy: "no-hooks", note: "Promoted Loki variants render with --no-hooks; hook or test enablement must map to lifecycle policy before production." },
    { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|loki|loki" },
    { category: "pvc-policy", status: "scan-and-review", note: "Loki and MinIO StatefulSets need storage, retention, upgrade, and rollback policy." },
    { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||loki-clusterrole" },
    { category: "tpl", status: "controlled-by-empty-defaults", note: "Loki config, structuredConfig, extraEnv, and raw object slots can use templating; promoted variants keep raw object slots empty." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||loki" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart rendering fails before object creation until loki.storage.bucketNames.chunks and schemaConfig are supplied.",
      "single-binary-filesystem selects SingleBinary topology, filesystem storage, and one Loki StatefulSet for local proof.",
      "simple-scalable-minio selects the scalable topology, one read/write/backend replica, explicit S3 bucket names, and the bundled MinIO dependency as a local object-store fixture.",
      "Chart dependency metadata records MinIO, grafana-agent-operator, and rollout-operator from Chart.lock.",
      "Promoted variants render no hook objects with --no-hooks; future hook or test enablement must map to lifecycle policy.",
      "Loki and MinIO render StatefulSets that need storage/upgrade/rollback policy before production.",
      "Loki config, structuredConfig, extraEnv, and raw object slots are template-powered extension surfaces; promoted variants keep raw object slots empty.",
    ],
    knownControlPoints: [
      "blocked-default-render",
      "storage-config",
      "object-storage-policy",
      "dependency-lock",
      "lifecycle-policy",
      "stateful-workload-policy",
      "pvc-policy",
      "cluster-rbac",
      "tpl-extension-slot",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    extraReadiness: { defaultRender: "blocked-with-recorded-mitigation" },
    nextAction: "publish only after storage/schema policy, dependency lock review, StatefulSet/PVC policy, object-store Secret ownership, lifecycle policy, and extension-slot review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the Loki public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart rendering is blocked until Loki storage bucket/schema values are supplied, and that blocker is recorded;",
      "the single-binary-filesystem variant provides the smallest local-test topology with filesystem storage;",
      "the simple-scalable-minio variant provides a one-node local object-storage path with explicit bucket names and a chart-owned MinIO fixture;",
      "storage/schema, dependency lock, object-store Secret, ClusterRole/RBAC, StatefulSet/PVC, lifecycle, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Default chart render blocker is recorded and avoided by this bounded variant",
      "Loki storage, schema, object-store, and StatefulSet policies need production review",
      "Any future hook or test enablement needs explicit lifecycle policy before production",
      "Raw/tpl extension slots must remain empty or be scanned as first-class variant inputs",
      variant.targetFactNote,
    ],
  }),
  scanExtra(docs) {
    const findings = [
      {
        id: "blocked-default-render:loki.storage.bucketNames.chunks",
        rule: "blocked-default-render",
        severity: "medium",
        object: "values|loki.storage.bucketNames.chunks",
        message: "Chart defaults cannot render until storage bucket and schema values are supplied",
      },
      {
        id: "storage-config-required:loki.schemaConfig",
        rule: "storage-config-required",
        severity: "medium",
        object: "values|loki.schemaConfig",
        message: "Loki storage mode and schema epoch are variant inputs that must be reviewed before production",
      },
      {
        id: "dependency-lock-review:loki-dependencies",
        rule: "dependency-lock-review",
        severity: "medium",
        object: "dependency|minio|grafana-agent-operator|rollout-operator",
        message: "Loki dependency metadata is locked before recipe publication",
      },
      {
        id: "object-storage-policy:minio",
        rule: "object-storage-policy",
        severity: "medium",
        object: "values|minio.enabled",
        message: "Object-store fixture, bucket names, endpoint, and Secret ownership need production policy",
      },
      {
        id: "lifecycle-policy:no-hooks",
        rule: "lifecycle-policy",
        severity: "medium",
        object: "renderer|--no-hooks",
        message: "Rendered proof excludes hooks/tests; future enablement must map to lifecycle policy",
      },
      {
        id: "extension-slot-review:loki-config-extra",
        rule: "extension-slot-review",
        severity: "medium",
        object: "values|loki.config|loki.structuredConfig|extraObjects",
        message: "Loki config and raw/tpl extension slots must be scanned when populated",
      },
    ];
    for (const doc of docs.filter((item) => item.kind === "Secret")) {
      findings.push({
        id: `rendered-secret-ownership:${identityFor(doc)}`,
        rule: "rendered-secret-ownership",
        severity: "medium",
        object: identityFor(doc),
        message: "Rendered Secret content and ownership must be explicit before production promotion",
      });
    }
    for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding"].includes(item.kind))) {
      findings.push({
        id: `cluster-rbac-review:${identityFor(doc)}`,
        rule: "cluster-rbac-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Cluster-scoped RBAC requires explicit review before production promotion",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "StatefulSet")) {
      findings.push({
        id: `stateful-workload-review:${identityFor(doc)}`,
        rule: "stateful-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Stateful workload requires storage, upgrade, and rollback policy",
      });
    }
    return findings;
  },
  verifyExtra({ root, dependencyLock, controlPoints, perVariant, check, readYaml, join }) {
    const defaultBlocker = readYaml(join(root, "default-render-blocker.yaml"));
    const dependencyNames = new Set((dependencyLock.spec.dependencies ?? []).map((dependency) => dependency.name));
    check(dependencyNames.has("minio"), "loki dependency lock missing minio");
    check(dependencyNames.has("grafana-agent-operator"), "loki dependency lock missing grafana-agent-operator");
    check(dependencyNames.has("rollout-operator"), "loki dependency lock missing rollout-operator");
    check(defaultBlocker.kind === "DefaultRenderBlocker", "default-render-blocker.yaml must be DefaultRenderBlocker");
    check(defaultBlocker.spec.result === "blocked", "default render blocker must record blocked result");
    check(String(defaultBlocker.spec.error ?? "").includes("loki.storage.bucketNames.chunks"), "default render blocker must record missing bucketNames.chunks");
    check(controlPoints.spec.points?.some((point) => point.category === "blocked-default-render"), "blocked-default-render control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "storage-config"), "storage-config control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "object-storage-policy"), "object-storage-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "lifecycle-policy"), "lifecycle-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "stateful-workload"), "stateful-workload control point missing");

    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|DaemonSet|loki|loki-canary"), `${variant.name} canary DaemonSet missing`);
      check(identities.includes("apps/v1|Deployment|loki|loki-gateway"), `${variant.name} gateway Deployment missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||loki-clusterrole"), `${variant.name} ClusterRole missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||loki-clusterrolebinding"), `${variant.name} ClusterRoleBinding missing`);
      check(identities.includes("v1|ConfigMap|loki|loki"), `${variant.name} Loki ConfigMap missing`);
      check(identities.includes("v1|ConfigMap|loki|loki-gateway"), `${variant.name} gateway ConfigMap missing`);
      check(identities.includes("v1|ConfigMap|loki|loki-runtime"), `${variant.name} runtime ConfigMap missing`);
      check(identities.includes("v1|ServiceAccount|loki|loki"), `${variant.name} ServiceAccount missing`);
      check(identities.includes("v1|ServiceAccount|loki|loki-canary"), `${variant.name} canary ServiceAccount missing`);
      check(identities.includes("v1|Service|loki|loki-canary"), `${variant.name} canary Service missing`);
      check(identities.includes("v1|Service|loki|loki-gateway"), `${variant.name} gateway Service missing`);
      check(identities.includes("v1|Service|loki|loki-memberlist"), `${variant.name} memberlist Service missing`);
      check(identities.includes("v1|Service|loki|loki-chunks-cache"), `${variant.name} chunks cache Service missing`);
      check(identities.includes("v1|Service|loki|loki-results-cache"), `${variant.name} results cache Service missing`);
      check(identities.includes("apps/v1|StatefulSet|loki|loki-chunks-cache"), `${variant.name} chunks cache StatefulSet missing`);
      check(identities.includes("apps/v1|StatefulSet|loki|loki-results-cache"), `${variant.name} results cache StatefulSet missing`);
      if (variant.name === "single-binary-filesystem") {
        check(identities.includes("apps/v1|StatefulSet|loki|loki"), "single-binary-filesystem StatefulSet missing");
        check(identities.includes("v1|Service|loki|loki"), "single-binary-filesystem main Service missing");
        check(identities.includes("v1|Service|loki|loki-headless"), "single-binary-filesystem headless Service missing");
      }
      if (variant.name === "simple-scalable-minio") {
        check(identities.includes("apps/v1|Deployment|loki|loki-read"), "simple-scalable-minio read Deployment missing");
        check(identities.includes("apps/v1|StatefulSet|loki|loki-backend"), "simple-scalable-minio backend StatefulSet missing");
        check(identities.includes("apps/v1|StatefulSet|loki|loki-write"), "simple-scalable-minio write StatefulSet missing");
        check(identities.includes("apps/v1|StatefulSet||loki-minio"), "simple-scalable-minio MinIO StatefulSet missing");
        check(identities.includes("v1|Secret||loki-minio"), "simple-scalable-minio MinIO Secret missing");
        check(identities.includes("v1|Service||loki-minio"), "simple-scalable-minio MinIO Service missing");
      }
      check(scan.spec.findingCounts.medium >= 5, `${variant.name} scan must flag default blocker, storage, dependency, lifecycle, stateful, RBAC, and extension review`);
    }
  },
});

function defaultRenderBlocker(defaultValuesSHA256) {
  const args = [
    "template",
    chart.releaseName,
    "grafana/loki",
    "--version",
    chart.version,
    "--namespace",
    chart.namespace,
    "--kube-version",
    chart.kubeVersion,
    "--include-crds",
    "--skip-tests",
    "--no-hooks",
  ];
  try {
    execFileSync("helm", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "DefaultRenderBlocker",
      metadata: { name: "grafana-loki-7.0.0-default" },
      spec: {
        result: "unexpected-pass",
        defaultValuesSHA256,
        command: `helm ${args.join(" ")}`,
        error: "",
      },
    };
  } catch (error) {
    return {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "DefaultRenderBlocker",
      metadata: { name: "grafana-loki-7.0.0-default" },
      spec: {
        result: "blocked",
        defaultValuesSHA256,
        command: `helm ${args.join(" ")}`,
        error: String(error.stderr ?? error.message ?? ""),
        mitigation: [
          "bind loki.schemaConfig.configs before render",
          "select filesystem or object storage before render",
          "bind loki.storage.bucketNames when object storage is selected",
        ],
      },
    };
  }
}
