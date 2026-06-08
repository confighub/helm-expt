// mysql proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "bitnami",
  repositoryURL: "https://charts.bitnami.com/bitnami",
  name: "mysql",
  version: "14.0.3",
  releaseName: "mysql",
  namespace: "mysql",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "generated-passwords",
    base: "generated-passwords",
    displayName: "generated passwords",
    valuesFile: "effective-values.yaml",
    valuesText: `global:
  security:
    allowInsecureImages: true
auth:
  rootPassword: confighub-mysql-root-password
  password: confighub-mysql-user-password
  replicationPassword: confighub-mysql-replication-password
image:
  repository: bitnamilegacy/mysql
`,
    valuesSummary: "MySQL root, user, and replication passwords bound as generated facts; image repository pinned to the still-pullable Bitnami legacy mirror with explicit image-substitution policy",
    expectedObjectCount: 8,
    expectedCRDCount: 0,
    expectedSecretCount: 1,
    targetFactNote: "uses persisted generated facts for auth.rootPassword, auth.password, and auth.replicationPassword and renders the chart Secret deterministically",
  },
  {
    name: "existing-secret",
    base: "existing-secret",
    displayName: "existing Secret",
    valuesFile: "effective-values-existing-secret.yaml",
    valuesText: `global:
  security:
    allowInsecureImages: true
auth:
  existingSecret: mysql-auth
image:
  repository: bitnamilegacy/mysql
`,
    valuesSummary: "target Secret supplies MySQL credentials; image repository pinned to the still-pullable Bitnami legacy mirror with explicit image-substitution policy",
    expectedObjectCount: 7,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "requires target Secret mysql/mysql-auth with MySQL password keys before apply",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "mysql",
          name: "mysql-auth",
          keys: ["mysql-root-password", "mysql-password", "mysql-replication-password"],
          purpose: "MySQL root, user, and replication passwords",
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
      { path: "auth.password", variant: "generated-passwords", disposition: "generated-fact-bound", reason: "the chart can generate a user password; this variant binds it before render" },
      { path: "auth.replicationPassword", variant: "generated-passwords", disposition: "generated-fact-bound", reason: "the chart can generate a replication password; this variant binds it before render" },
      { path: "auth.existingSecret", variant: "existing-secret", disposition: "target-fact-bound", reason: "externalizes the credential into a declared target Secret instead of rendering a Secret" },
      { path: "auth.secretKeys.adminPasswordKey", variant: "existing-secret", disposition: "target-secret-key", reason: "documents the expected key in the target Secret" },
      { path: "primary.persistence.enabled", variant: "all", disposition: "stateful-storage-enabled", reason: "chart defaults create a StatefulSet with volume claim templates" },
      { path: "architecture", variant: "all", disposition: "standalone", reason: "promoted variants keep standalone architecture; replication becomes a later variant" },
      { path: "common", variant: "all", disposition: "locked-dependency", reason: "chart declares the Bitnami common dependency and records it in dependency-lock.yaml" },
      { path: "primary.initdb.scripts / primary.extendedConfiguration", variant: "all", disposition: "empty-extension-slot", reason: "MySQL exposes tpl/config extension slots; promoted variants keep them empty" },
    ],
  },
  dependencyLockChart: "bitnami/mysql",
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart declares the Bitnami common dependency; promoted variants lock its metadata." },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile." },
    { category: "generated-facts", status: "variant-controlled", evidence: "auth.rootPassword + auth.password + auth.replicationPassword", note: "The generated-passwords variant binds all generated password fields before render so Helm output is deterministic." },
    { category: "target-facts", status: "variant-controlled", evidence: "auth.existingSecret", note: "The existing-secret variant declares the target Secret instead of rendering one." },
    { category: "hook-policy", status: "handled-for-render", policy: "no-hooks", note: "Chart source contains Helm hooks; the proof render excludes hooks and lifecycle policy must handle them before production." },
    { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|mysql|mysql" },
    { category: "pvc-policy", status: "scan-and-review", note: "StatefulSet volumeClaimTemplates need storage, retention, upgrade, and rollback policy." },
    { category: "tpl", status: "controlled-by-empty-defaults", note: "initdb and extended configuration slots use templating; promoted variants do not populate them." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||mysql" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart rendering is nondeterministic unless auth.rootPassword, auth.password, and auth.replicationPassword are bound before render.",
      "generated-passwords variant persists all three password fields as generated facts and renders the Secret deterministically.",
      "existing-secret variant does not render a Secret and instead declares mysql/mysql-auth as a target fact.",
      "Chart declares the Bitnami common dependency and records it in dependency-lock.yaml.",
      "Chart source contains Helm hook annotations; the rendered proof excludes hooks and keeps lifecycle policy explicit.",
      "MySQL renders a StatefulSet with volumeClaimTemplates and needs storage/upgrade/rollback policy.",
      "initdb and extended configuration are template-powered extension slots; promoted variants keep them empty.",
    ],
    knownControlPoints: [
      "generated-facts",
      "target-facts",
      "dependency-lock",
      "hook-lifecycle-policy",
      "stateful-workload-policy",
      "pvc-policy",
      "tpl-extension-slot",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after generated fact or target fact binding, hook lifecycle policy, dependency lock review, StatefulSet/PVC policy, and extension-slot review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the MySQL public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart rendering is nondeterministic until generated credentials are bound;",
      "the generated-passwords variant persists auth.rootPassword, auth.password, and auth.replicationPassword before render;",
      "the existing-secret variant uses a declared target Secret and does not render a Secret;",
      "generated fact, target fact, Helm hook lifecycle, dependency lock, StatefulSet/PVC, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Generated credential handling needs explicit generated fact or target fact policy before production",
      "Helm hook behavior needs explicit lifecycle policy before production",
      "MySQL StatefulSet and volumeClaimTemplates need storage, upgrade, and rollback policy",
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
    for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "mysql")) {
      findings.push({
        id: `generated-secret-ownership:${identityFor(doc)}`,
        rule: "generated-secret-ownership",
        severity: "medium",
        object: identityFor(doc),
        message: "MySQL Secret content and ownership must be explicit before production promotion",
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
  verifyExtra({ controlPoints, dependencyLock, perVariant, check }) {
    check(dependencyLock.spec.dependencies?.[0]?.name === "common", "mysql dependency name mismatch");
    check(controlPoints.spec.points?.some((point) => point.category === "generated-facts"), "generated-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "target-facts"), "target-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "hook-policy"), "hook-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "stateful-workload"), "stateful-workload control point missing");
    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|StatefulSet|mysql|mysql"), `${variant.name} StatefulSet missing`);
      check(identities.includes("v1|Service|mysql|mysql"), `${variant.name} primary Service missing`);
      check(identities.includes("v1|Service|mysql|mysql-headless"), `${variant.name} headless Service missing`);
      check(identities.includes("v1|ServiceAccount|mysql|mysql"), `${variant.name} ServiceAccount missing`);
      check(identities.includes("networking.k8s.io/v1|NetworkPolicy|mysql|mysql"), `${variant.name} NetworkPolicy missing`);
      check(identities.includes("policy/v1|PodDisruptionBudget|mysql|mysql"), `${variant.name} PodDisruptionBudget missing`);
      check(identities.includes("v1|ConfigMap|mysql|mysql"), `${variant.name} ConfigMap missing`);
      if (variant.name === "generated-passwords") {
        check(identities.includes("v1|Secret|mysql|mysql"), "generated-passwords Secret missing");
      }
      if (variant.name === "existing-secret") {
        check(!secretIdentities.length, "existing-secret must not render a Secret");
      }
      check(scan.spec.findingCounts.medium >= 3, `${variant.name} scan must flag generated/target facts, dependency, hooks, and stateful review`);
    }
  },
});
