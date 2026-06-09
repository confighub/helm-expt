// mongodb proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged. Supports the multi-version
// harness env overrides via the kit.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "bitnami",
  repositoryURL: "https://charts.bitnami.com/bitnami",
  name: "mongodb",
  version: "19.0.7",
  releaseName: "mongodb",
  namespace: "mongodb",
  kubeVersion: "1.30.0",
};

const mongodbImageDigest = "sha256:594309a857f5254bc2ee6b5e538f680696f9c7e2bf20279ca3fec49f682de44e";

const variants = [
  {
    name: "generated-passwords",
    base: "generated-passwords",
    displayName: "generated passwords",
    valuesFile: "effective-values.yaml",
    valuesText: `image:
  digest: ${mongodbImageDigest}
auth:
  rootPassword: confighub-mongodb-root-password
`,
    valuesSummary: "MongoDB root password bound as a generated fact",
    expectedObjectCount: 8,
    expectedCRDCount: 0,
    expectedSecretCount: 1,
    targetFactNote: "uses a persisted generated fact for auth.rootPassword and renders the chart Secret deterministically",
  },
  {
    name: "existing-secret-replicaset",
    base: "existing-secret-replicaset",
    displayName: "existing Secret replica set",
    valuesFile: "effective-values-existing-secret-replicaset.yaml",
    valuesText: `architecture: replicaset
image:
  digest: ${mongodbImageDigest}
auth:
  existingSecret: mongodb-auth
`,
    valuesSummary: "target Secret supplies MongoDB credentials and replica-set key",
    expectedObjectCount: 10,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "requires target Secret mongodb/mongodb-auth with root password and replica-set key before apply",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "mongodb",
          name: "mongodb-auth",
          keys: ["mongodb-root-password", "mongodb-replica-set-key"],
          purpose: "MongoDB root password and replica-set key",
        },
      ],
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
    { id: "stateful-workload-review", severity: "medium", description: "Stateful workloads need storage, upgrade, and rollback policy." },
    { id: "extension-slot-review", severity: "medium", description: "tpl/raw extension slots need provenance and scan coverage." },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  supportObjects: [`v1|Namespace||${chart.namespace}`],
  expectedDependencyCount: 1,
  recordChartLockDigest: true,
  valueModel: {
    checkedValues: [
      { path: "auth.rootPassword", variant: "generated-passwords", disposition: "generated-fact-bound", reason: "default chart uses random root password generation; this variant persists the generated value before render" },
      { path: "auth.existingSecret", variant: "existing-secret-replicaset", disposition: "target-fact-bound", reason: "externalizes root password and replica-set key into a declared target Secret instead of rendering a Secret" },
      { path: "architecture", variant: "existing-secret-replicaset", disposition: "replicaset-variant", reason: "replica-set topology is explicit and visible as StatefulSet/headless Service outputs" },
      { path: "auth.existingSecret keys", variant: "existing-secret-replicaset", disposition: "target-secret-key", reason: "documents the expected root password and replica-set key in the target Secret" },
      { path: "image.digest", variant: "all", disposition: "pinned-image", reason: "supported bases pin the Bitnami MongoDB image by digest instead of rendering the chart default latest tag" },
      { path: "persistence.enabled", variant: "all", disposition: "storage-enabled", reason: "promoted variants render persistent storage and must bind storage/retention policy" },
      { path: "networkPolicy.enabled / podDisruptionBudget.enabled", variant: "all", disposition: "production-hardening-enabled", reason: "network policy and disruption controls are visible rendered objects" },
      { path: "common", variant: "all", disposition: "locked-dependency", reason: "chart declares the Bitnami common dependency and records it in dependency-lock.yaml" },
      { path: "primary.initdb.scripts / primary.extendedConfiguration", variant: "all", disposition: "empty-extension-slot", reason: "MongoDB exposes tpl/config extension slots; promoted variants keep them empty" },
    ],
  },
  dependencyLockChart: "bitnami/mongodb",
  packageTransformers: [
    {
      description: "Set the namespace on every namespaced resource.",
      invocations: [{ name: "set-namespace", args: ["{{ .Namespace }}"] }],
      toolchain: "Kubernetes/YAML",
      whereResource: "",
    },
  ],
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart declares the Bitnami common dependency; promoted variants lock its metadata." },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile." },
    { category: "generated-facts", status: "variant-controlled", evidence: "auth.rootPassword", note: "The generated-passwords variant binds the generated root password before render so Helm output is deterministic." },
    { category: "target-facts", status: "variant-controlled", evidence: "auth.existingSecret", note: "The existing-secret-replicaset variant declares the target Secret instead of rendering one." },
    { category: "image-digest", status: "handled", digest: mongodbImageDigest, note: "Supported bases pin the Bitnami MongoDB image by digest." },
    { category: "hook-policy", status: "handled-for-render", policy: "no-hooks", note: "Chart source contains Helm hooks; the proof render excludes hooks and lifecycle policy must handle them before production." },
    { category: "replicaset-topology", status: "variant-controlled", object: "apps/v1|StatefulSet|mongodb|mongodb" },
    { category: "workload-policy", status: "scan-and-review", note: "Deployment/StatefulSet workloads need storage, retention, upgrade, and rollback policy." },
    { category: "network-policy", status: "scan-and-review", object: "networking.k8s.io/v1|NetworkPolicy|mongodb|mongodb" },
    { category: "pdb-policy", status: "scan-and-review", object: "policy/v1|PodDisruptionBudget|mongodb|mongodb" },
    { category: "tpl", status: "controlled-by-empty-defaults", note: "initdb and extended configuration slots use templating; promoted variants do not populate them." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||mongodb" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart rendering is nondeterministic unless auth.rootPassword is bound before render.",
      "generated-passwords variant persists auth.rootPassword as a generated fact and renders the Secret deterministically.",
      "existing-secret-replicaset variant does not render a Secret and instead declares mongodb/mongodb-auth as a target fact.",
      "existing-secret-replicaset variant changes architecture to replicaset and renders primary plus arbiter StatefulSets.",
      "Supported bases pin the Bitnami MongoDB image by digest instead of rendering the chart default latest tag.",
      "Chart declares the Bitnami common dependency and records it in dependency-lock.yaml.",
      "Chart source contains Helm hook annotations; the rendered proof excludes hooks and keeps lifecycle policy explicit.",
      "MongoDB renders persistent storage, NetworkPolicy, and PDB objects that need production policy.",
      "initdb and extended configuration are template-powered extension slots; promoted variants keep them empty.",
    ],
    knownControlPoints: [
      "generated-facts",
      "target-facts",
      "dependency-lock",
      "hook-lifecycle-policy",
      "replicaset-topology",
      "workload-policy",
      "network-policy",
      "pdb-policy",
      "tpl-extension-slot",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after generated fact or target fact binding, hook lifecycle policy, dependency lock review, workload/storage policy, replica-set topology, and extension-slot review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the MongoDB public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart rendering is nondeterministic until the generated root password is bound;",
      "the generated-passwords variant persists auth.rootPassword before render;",
      "the existing-secret-replicaset variant uses a declared target Secret, does not render a Secret, and changes topology to replica set;",
      "both supported bases pin the MongoDB image digest instead of rendering a mutable latest tag;",
      "generated fact, target fact, Helm hook lifecycle, dependency lock, Deployment/StatefulSet storage, NetworkPolicy/PDB, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Generated credential handling needs explicit generated fact or target fact policy before production",
      "Helm hook behavior needs explicit lifecycle policy before production",
      "MongoDB Deployment/StatefulSet storage, upgrade, and rollback policy need production review",
      "Replica-set topology, arbiter behavior, NetworkPolicy, and PDB need production review",
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
    for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "mongodb")) {
      findings.push({
        id: `generated-secret-ownership:${identityFor(doc)}`,
        rule: "generated-secret-ownership",
        severity: "medium",
        object: identityFor(doc),
        message: "MongoDB Secret content and ownership must be explicit before production promotion",
      });
    }
    findings.push({
      id: "dependency-lock-review:common",
      rule: "dependency-lock-review",
      severity: "medium",
      object: "dependency|common|2.39.0",
      message: "Bitnami common dependency metadata is locked before recipe publication",
    });
    findings.push({
      id: "helm-hook-lifecycle-policy:source",
      rule: "helm-hook-lifecycle-policy",
      severity: "medium",
      object: "source|helm-hooks",
      message: "Chart source contains Helm hooks; rendered proof excludes hooks and production needs lifecycle policy",
    });
    findings.push({
      id: "extension-slot-review:initdb-configuration",
      rule: "extension-slot-review",
      severity: "medium",
      object: "values|primary.initdb.scripts",
      message: "initdb and extended configuration slots must be scanned when populated",
    });
    for (const doc of docs.filter((item) => ["Deployment", "StatefulSet"].includes(item.kind))) {
      findings.push({
        id: `stateful-workload-review:${identityFor(doc)}`,
        rule: "stateful-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "MongoDB workload requires storage, upgrade, and rollback policy",
      });
    }
    for (const doc of docs.filter((item) => ["PersistentVolumeClaim", "NetworkPolicy", "PodDisruptionBudget"].includes(item.kind))) {
      findings.push({
        id: `workload-policy:${identityFor(doc)}`,
        rule: "stateful-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "MongoDB storage, network, and disruption policy require production review",
      });
    }
    return findings;
  },
  verifyExtra({ controlPoints, dependencyLock, perVariant, check }) {
    check(dependencyLock.spec.dependencies?.[0]?.name === "common", "mongodb dependency name mismatch");
    check(controlPoints.spec.points?.some((point) => point.category === "generated-facts"), "generated-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "target-facts"), "target-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "hook-policy"), "hook-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "replicaset-topology"), "replicaset-topology control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "workload-policy"), "workload-policy control point missing");
    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("v1|ServiceAccount|mongodb|mongodb"), `${variant.name} ServiceAccount missing`);
      check(identities.includes("networking.k8s.io/v1|NetworkPolicy|mongodb|mongodb"), `${variant.name} NetworkPolicy missing`);
      check(identities.includes("policy/v1|PodDisruptionBudget|mongodb|mongodb"), `${variant.name} PodDisruptionBudget missing`);
      check(identities.includes("v1|ConfigMap|mongodb|mongodb-common-scripts"), `${variant.name} common scripts ConfigMap missing`);
      if (variant.name === "generated-passwords") {
        check(identities.includes("apps/v1|Deployment|mongodb|mongodb"), "generated-passwords Deployment missing");
        check(identities.includes("v1|Service|mongodb|mongodb"), "generated-passwords Service missing");
        check(identities.includes("v1|PersistentVolumeClaim|mongodb|mongodb"), "generated-passwords PVC missing");
        check(identities.includes("v1|Secret|mongodb|mongodb"), "generated-passwords Secret missing");
      }
      if (variant.name === "existing-secret-replicaset") {
        check(!secretIdentities.length, "existing-secret-replicaset must not render a Secret");
        check(identities.includes("apps/v1|StatefulSet|mongodb|mongodb"), "existing-secret-replicaset primary StatefulSet missing");
        check(identities.includes("apps/v1|StatefulSet|mongodb|mongodb-arbiter"), "existing-secret-replicaset arbiter StatefulSet missing");
        check(identities.includes("v1|Service|mongodb|mongodb-headless"), "existing-secret-replicaset headless Service missing");
        check(identities.includes("v1|Service|mongodb|mongodb-arbiter-headless"), "existing-secret-replicaset arbiter headless Service missing");
        check(identities.includes("v1|ConfigMap|mongodb|mongodb-scripts"), "existing-secret-replicaset scripts ConfigMap missing");
      }
      check(scan.spec.findingCounts.medium >= 3, `${variant.name} scan must flag generated/target facts, dependency, hooks, and stateful review`);
    }
  },
});
