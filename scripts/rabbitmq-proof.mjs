// RabbitMQ proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "bitnami",
  repositoryURL: "https://charts.bitnami.com/bitnami",
  name: "rabbitmq",
  version: "16.0.14",
  releaseName: "rabbitmq",
  namespace: "rabbitmq",
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
  password: confighub-rabbitmq-password
  erlangCookie: confighub-rabbitmq-erlang-cookie
image:
  repository: bitnamilegacy/rabbitmq
`,
    valuesSummary: "RabbitMQ password and Erlang cookie bound as generated facts; image repository pinned to the still-pullable Bitnami legacy mirror with explicit image-substitution policy",
    expectedObjectCount: 10,
    expectedCRDCount: 0,
    expectedSecretCount: 2,
    targetFactNote: "uses persisted generated facts for auth.password and auth.erlangCookie and renders chart Secrets deterministically",
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
  existingPasswordSecret: rabbitmq-auth
  existingErlangSecret: rabbitmq-erlang-cookie
image:
  repository: bitnamilegacy/rabbitmq
`,
    valuesSummary: "target Secrets supply RabbitMQ password and Erlang cookie; image repository pinned to the still-pullable Bitnami legacy mirror with explicit image-substitution policy",
    expectedObjectCount: 9,
    expectedCRDCount: 0,
    expectedSecretCount: 1,
    targetFactNote: "requires target Secrets rabbitmq/rabbitmq-auth and rabbitmq/rabbitmq-erlang-cookie before apply",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "rabbitmq",
          name: "rabbitmq-auth",
          keys: ["rabbitmq-password"],
          purpose: "RabbitMQ administrator password",
        },
        {
          namespace: "rabbitmq",
          name: "rabbitmq-erlang-cookie",
          keys: ["rabbitmq-erlang-cookie"],
          purpose: "RabbitMQ Erlang cookie for node clustering",
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
  expectedDependencyCount: 1,
  recordChartLockDigest: true,
  valueModel: {
    checkedValues: [
      { path: "auth.password", variant: "generated-passwords", disposition: "generated-fact-bound", reason: "default chart uses random password generation; this variant persists the generated value before render" },
      { path: "auth.erlangCookie", variant: "generated-passwords", disposition: "generated-fact-bound", reason: "default chart uses random Erlang cookie generation; this variant persists the generated value before render" },
      { path: "auth.existingPasswordSecret", variant: "existing-secret", disposition: "target-fact-bound", reason: "externalizes the credential into a declared target Secret instead of rendering a Secret" },
      { path: "auth.existingErlangSecret", variant: "existing-secret", disposition: "target-fact-bound", reason: "externalizes the Erlang cookie into a declared target Secret instead of rendering it in the chart Secret" },
      { path: "auth.existingSecretPasswordKey", variant: "existing-secret", disposition: "target-secret-key", reason: "documents the expected key in the target Secret" },
      { path: "persistence.enabled", variant: "all", disposition: "stateful-storage-enabled", reason: "chart defaults create a StatefulSet with volume claim templates" },
      { path: "architecture", variant: "all", disposition: "standalone", reason: "promoted variants keep the default single replica; clustered topology becomes a later variant" },
      { path: "common", variant: "all", disposition: "locked-dependency", reason: "chart declares the Bitnami common dependency and records it in dependency-lock.yaml" },
      { path: "initScripts / configuration / advancedConfiguration / extraDeploy", variant: "all", disposition: "empty-extension-slot", reason: "RabbitMQ exposes tpl/config/raw-object extension slots; promoted variants keep them empty" },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart declares the Bitnami common dependency; promoted variants lock its metadata." },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile." },
    { category: "generated-facts", status: "variant-controlled", evidence: "auth.password + auth.erlangCookie", note: "The generated-passwords variant binds the generated password and Erlang cookie before render so Helm output is deterministic." },
    { category: "target-facts", status: "variant-controlled", evidence: "auth.existingPasswordSecret + auth.existingErlangSecret", note: "The existing-secret variant declares target Secrets for password and Erlang cookie; it still renders the configuration Secret." },
    { category: "hook-policy", status: "not-present-in-promoted-render", policy: "no-hooks", note: "Promoted RabbitMQ variants render no hook objects with the pinned inputs; if enabled by future values, hooks must map to lifecycle policy before production." },
    { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|rabbitmq|rabbitmq" },
    { category: "pvc-policy", status: "scan-and-review", note: "StatefulSet volumeClaimTemplates need storage, retention, upgrade, and rollback policy." },
    { category: "tpl", status: "controlled-by-empty-defaults", note: "configuration, advancedConfiguration, initScripts, secret names, and extraDeploy can use templating; promoted variants keep raw extension slots empty." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||rabbitmq" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart rendering is nondeterministic unless auth.password is bound before render.",
      "Default chart rendering is also nondeterministic unless auth.erlangCookie is bound before render.",
      "generated-passwords variant persists auth.password and auth.erlangCookie as generated facts and renders chart Secrets deterministically.",
      "existing-secret variant does not render the credential Secret and instead declares rabbitmq/rabbitmq-auth and rabbitmq/rabbitmq-erlang-cookie as target facts.",
      "existing-secret variant still renders rabbitmq-config because configuration is chart-owned in both promoted variants.",
      "Chart declares the Bitnami common dependency and records it in dependency-lock.yaml.",
      "Promoted variants render no hook objects; future hook-producing values must map to lifecycle policy.",
      "RabbitMQ renders a StatefulSet with volumeClaimTemplates and needs storage/upgrade/rollback policy.",
      "configuration, advancedConfiguration, initScripts, secret names, and extraDeploy are template-powered extension surfaces; promoted variants keep raw slots empty.",
    ],
    knownControlPoints: [
      "generated-facts",
      "target-facts",
      "dependency-lock",
      "lifecycle-policy",
      "stateful-workload-policy",
      "pvc-policy",
      "clustering-policy",
      "tpl-extension-slot",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after generated fact or target fact binding, dependency lock review, StatefulSet/PVC policy, clustering policy, and extension-slot review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the RabbitMQ public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart rendering is nondeterministic until generated credentials and the Erlang cookie are bound;",
      "the generated-passwords variant persists auth.password and auth.erlangCookie before render;",
      "the existing-secret variant uses declared target Secrets for both generated values and still renders only chart-owned configuration;",
      "generated fact, target fact, dependency lock, StatefulSet/PVC, clustering, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Generated credential handling needs explicit generated fact or target fact policy before production",
      "Any future hook-producing values need explicit lifecycle policy before production",
      "RabbitMQ StatefulSet and volumeClaimTemplates need storage, upgrade, and rollback policy",
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
    for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "rabbitmq")) {
      findings.push({
        id: `generated-secret-ownership:${identityFor(doc)}`,
        rule: "generated-secret-ownership",
        severity: "medium",
        object: identityFor(doc),
        message: "RabbitMQ Secret content and ownership must be explicit before production promotion",
      });
    }
    findings.push({
      id: "dependency-lock-review:common",
      rule: "dependency-lock-review",
      severity: "medium",
      object: "dependency|common|2.31.3",
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
      id: "extension-slot-review:configuration-advanced-extra",
      rule: "extension-slot-review",
      severity: "medium",
      object: "values|configuration|advancedConfiguration|extraDeploy",
      message: "configuration, advancedConfiguration, initScripts, and extraDeploy slots must be scanned when populated",
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
  verifyExtra({ sourceLock, dependencyLock, controlPoints, perVariant, check }) {
    check(sourceLock.spec.appVersion === "4.1.3", "source appVersion mismatch");
    check((dependencyLock.spec.dependencies ?? []).length === 1, "rabbitmq dependency lock must record common");
    check(dependencyLock.spec.dependencies?.[0]?.name === "common", "rabbitmq dependency name mismatch");
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
      check(identities.includes("apps/v1|StatefulSet|rabbitmq|rabbitmq"), `${variant.name} StatefulSet missing`);
      check(identities.includes("v1|Service|rabbitmq|rabbitmq"), `${variant.name} main Service missing`);
      check(identities.includes("v1|Service|rabbitmq|rabbitmq-headless"), `${variant.name} headless Service missing`);
      check(identities.includes("v1|ServiceAccount|rabbitmq|rabbitmq"), `${variant.name} ServiceAccount missing`);
      check(identities.includes("networking.k8s.io/v1|NetworkPolicy|rabbitmq|rabbitmq"), `${variant.name} NetworkPolicy missing`);
      check(identities.includes("policy/v1|PodDisruptionBudget|rabbitmq|rabbitmq"), `${variant.name} PodDisruptionBudget missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|Role|rabbitmq|rabbitmq-endpoint-reader"), `${variant.name} Role missing`);
      check(
        identities.includes("rbac.authorization.k8s.io/v1|RoleBinding|rabbitmq|rabbitmq-endpoint-reader"),
        `${variant.name} RoleBinding missing`,
      );
      check(identities.includes("v1|Secret|rabbitmq|rabbitmq-config"), `${variant.name} config Secret missing`);
      if (variant.name === "generated-passwords") {
        check(identities.includes("v1|Secret|rabbitmq|rabbitmq"), "generated-passwords Secret missing");
      }
      if (variant.name === "existing-secret") {
        check(!identities.includes("v1|Secret|rabbitmq|rabbitmq"), "existing-secret must not render the credential Secret");
      }
      check(scan.spec.findingCounts.medium >= 3, `${variant.name} scan must flag generated/target facts, dependency, hooks, and stateful review`);
    }
  },
});
