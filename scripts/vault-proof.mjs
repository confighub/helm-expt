// Vault proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "hashicorp",
  repositoryURL: "https://helm.releases.hashicorp.com",
  name: "vault",
  version: "0.32.0",
  releaseName: "vault",
  namespace: "vault",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "dev-mode",
    base: "dev-mode",
    displayName: "dev server without init/unseal",
    valuesFile: "effective-values-dev-mode.yaml",
    valuesText: `server:
  dev:
    enabled: true
  dataStorage:
    enabled: false
`,
    valuesSummary: "Vault dev server starts initialized and unsealed for local proof/demo use",
    expectedObjectCount: 11,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "dev-mode is a local/demo base only; production still needs explicit init/unseal, recovery material, TLS, and storage policy",
  },
  {
    name: "default",
    base: "default",
    displayName: "default server with injector",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults with server StatefulSet and injector webhook",
    expectedObjectCount: 12,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "requires explicit post-install init/unseal and TLS posture decisions before production",
  },
  {
    name: "ha-raft-ui",
    base: "ha-raft-ui",
    displayName: "HA Raft with UI",
    valuesFile: "effective-values-ha-raft-ui.yaml",
    valuesText: `server:
  ha:
    enabled: true
    raft:
      enabled: true
ui:
  enabled: true
`,
    valuesSummary: "HA Raft storage and UI service are explicit",
    expectedObjectCount: 18,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "adds HA discovery, Raft storage, PDB, active/standby services, and UI exposure as variant-controlled outputs",
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
    { id: "vault-workload-operate-review", severity: "medium", description: "Vault workloads need rollout, persistence, init/unseal, and rollback policy." },
    { id: "admission-webhook-review", severity: "medium", description: "Admission webhooks need explicit failure policy, certificate, and observation policy." },
    { id: "service-exposure-review", severity: "medium", description: "Vault API/UI services need explicit exposure and TLS policy." },
    { id: "vault-tls-posture-review", severity: "medium", description: "Vault TLS disabled/enabled posture must be explicit before production." },
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
  expectedDeprecated: false,
  valueModel: {
    checkedValues: [
      { path: "server.ha.enabled / server.ha.raft.enabled", variant: "ha-raft-ui", disposition: "variant-controlled", reason: "the HA variant deliberately changes Vault from standalone file storage to integrated Raft storage" },
      { path: "ui.enabled", variant: "ha-raft-ui", disposition: "service-exposure-bound", reason: "UI exposure is added only by an explicit variant and appears as a rendered Service" },
      { path: "server.dev.enabled", variant: "dev-mode", disposition: "local-demo-only", reason: "dev-mode starts Vault initialized and unsealed for local proof/demo use; it is not a production support path" },
      { path: "global.tlsDisable / server.standalone.config / server.ha.config", variant: "all", disposition: "security-posture-review", reason: "the rendered Vault listener TLS posture must be reviewed before production promotion" },
      { path: "server.dataStorage.enabled / server.auditStorage.enabled", variant: "all", disposition: "stateful-storage-review", reason: "Vault storage, audit storage, and PVC behavior are part of the variant and install gate" },
      { path: "server.extraEnvironmentVars / server.extraSecretEnvironmentVars / server.extraVolumes / server.extraInitContainers", variant: "all", disposition: "extension-slot", reason: "Vault extension and Secret injection slots must be explicit before production promotion" },
      { path: "injector.enabled / injector.failurePolicy", variant: "all", disposition: "admission-webhook-review", reason: "the injector admission webhook is rendered by default and must be reviewed as an operating control point" },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart declares no subchart dependencies; the empty closure is recorded explicitly." },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile." },
    { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|vault|vault" },
    { category: "admission-webhook", status: "scan-and-review", object: "admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||vault-agent-injector-cfg" },
    { category: "service-exposure", status: "variant-controlled", object: "v1|Service|vault|vault-ui" },
    { category: "tls-posture", status: "scan-and-review", evidence: "v1|ConfigMap|vault|vault-config" },
    { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||vault-agent-injector-clusterrole" },
    { category: "operate-policy", status: "scan-and-review", note: "Vault init, unseal, seal migration, and recovery material are post-render operating controls." },
    { category: "extension-slots", status: "controlled-by-empty-defaults", note: "extra environment, Secret, volume, plugin, init, and sidecar slots are empty in promoted variants." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||vault" },
  ],
  dossier: {
    maintainedNotes: [
      "The chart renders deterministically under pinned Helm, chart version, kube version, and values.",
      "The default variant keeps the chart defaults: standalone Vault server, injector webhook, and TLS disabled in the rendered Vault config.",
      "The ha-raft-ui variant enables integrated Raft HA and the UI Service as deliberate variant-controlled outputs.",
      "The dev-mode variant uses the upstream chart's dev server path for local proof and demos; it starts without init/unseal and is not a production support claim.",
      "The chart does not initialize or unseal Vault; init/unseal and recovery material are operating controls, not hidden render inputs.",
      "Injector webhook, cluster RBAC, TLS posture, storage, and service exposure are scan/gate review points.",
      "extra environment, Secret, volume, plugin, init, and sidecar extension slots are powerful config surfaces; promoted variants keep them empty.",
    ],
    knownControlPoints: [
      "stateful-workload",
      "admission-webhook",
      "tls-posture",
      "service-exposure",
      "operate-policy",
      "rbac-review",
      "extension-slots",
      "secret-extension-slots",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after TLS posture, init/unseal operating policy, storage/HA policy, injector webhook policy, RBAC review, service exposure, and Secret/extension-slot review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the Vault public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "the default variant keeps the chart defaults visible: Vault StatefulSet, injector webhook, ClusterRole permissions, services, and TLS-disabled listener config;",
      "the ha-raft-ui variant deliberately enables integrated Raft HA and UI exposure;",
      "the dev-mode variant deliberately uses the upstream local dev server path so Vault can be tried without pretending init/unseal is solved;",
      "init, unseal, recovery material, and seal migration are not hidden Helm render inputs; they are post-render operating controls;",
      "TLS posture, injector webhook, RBAC, service exposure, StatefulSet storage, and Secret/env extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Vault TLS posture must be approved before production",
      "Vault init, unseal, recovery, and seal-migration operating policy must be explicit before production",
      "Vault StatefulSet storage, HA, and rollback policy need production review",
      "Injector webhook, RBAC, service exposure, and Secret/extension slots need production review",
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
    for (const doc of docs.filter((item) => item.kind === "ConfigMap" && item.metadata?.name === "vault-config")) {
      const configText = Object.values(doc.data ?? {}).join("\n");
      if (configText.includes("tls_disable = 1")) {
        findings.push({
          id: `vault-tls-posture-review:${identityFor(doc)}`,
          rule: "vault-tls-posture-review",
          severity: "medium",
          object: identityFor(doc),
          message: "Vault listener TLS is disabled in rendered config and must be explicitly approved before production promotion",
        });
      }
    }
    for (const doc of docs.filter((item) => item.kind === "MutatingWebhookConfiguration")) {
      findings.push({
        id: `admission-webhook-review:${identityFor(doc)}`,
        rule: "admission-webhook-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Vault injector admission webhook requires certificate, failure policy, and observation review",
      });
    }
    findings.push({
      id: "extension-slot-review:vault-values",
      rule: "extension-slot-review",
      severity: "medium",
      object: "values|server.extraEnvironmentVars|server.extraSecretEnvironmentVars|server.extraVolumes|server.extraInitContainers|server.sidecarContainers",
      message: "Vault Secret/env, volume, plugin, init, and sidecar extension slots must be scanned when populated",
    });
    for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
      findings.push({
        id: `cluster-rbac-review:${identityFor(doc)}`,
        rule: "cluster-rbac-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Vault RBAC requires production review",
      });
    }
    for (const doc of docs.filter((item) => ["Deployment", "StatefulSet"].includes(item.kind))) {
      findings.push({
        id: `vault-workload-operate-review:${identityFor(doc)}`,
        rule: "vault-workload-operate-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Vault workload rollout, storage, init/unseal, and rollback policy require production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Service" && ["vault", "vault-active", "vault-standby", "vault-ui"].includes(item.metadata?.name))) {
      findings.push({
        id: `service-exposure-review:${identityFor(doc)}`,
        rule: "service-exposure-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Vault API/UI service exposure requires explicit network and TLS policy",
      });
    }
    return findings;
  },
  verifyExtra({ controlPoints, perVariant, check }) {
    check(controlPoints.spec.points?.some((point) => point.category === "stateful-workload"), "stateful-workload control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "tls-posture"), "tls-posture control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "service-exposure"), "service-exposure control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "operate-policy"), "operate-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "extension-slots"), "extension-slots control point missing");

    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|StatefulSet|vault|vault"), `${variant.name} StatefulSet missing`);
      check(identities.includes("apps/v1|Deployment|vault|vault-agent-injector"), `${variant.name} injector Deployment missing`);
      check(identities.includes("admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||vault-agent-injector-cfg"), `${variant.name} injector webhook missing`);
      check(identities.includes("v1|Service|vault|vault"), `${variant.name} Service missing`);
      check(identities.includes("v1|Service|vault|vault-internal"), `${variant.name} internal Service missing`);
      check(identities.includes("v1|Service|vault|vault-agent-injector-svc"), `${variant.name} injector Service missing`);
      check(identities.includes("v1|ServiceAccount|vault|vault"), `${variant.name} ServiceAccount missing`);
      check(identities.includes("v1|ServiceAccount|vault|vault-agent-injector"), `${variant.name} injector ServiceAccount missing`);
      if (variant.name === "dev-mode") {
        check(!identities.includes("v1|ConfigMap|vault|vault-config"), "dev-mode must not render standalone vault-config ConfigMap");
      } else {
        check(identities.includes("v1|ConfigMap|vault|vault-config"), `${variant.name} ConfigMap missing`);
      }
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||vault-agent-injector-clusterrole"), `${variant.name} injector ClusterRole missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||vault-agent-injector-binding"), `${variant.name} injector ClusterRoleBinding missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||vault-server-binding"), `${variant.name} server ClusterRoleBinding missing`);
      if (variant.name !== "ha-raft-ui") {
        check(!identities.includes("v1|Service|vault|vault-ui"), `${variant.name} must not render UI Service`);
        check(!identities.includes("rbac.authorization.k8s.io/v1|Role|vault|vault-discovery-role"), `${variant.name} must not render HA discovery Role`);
      }
      if (variant.name === "ha-raft-ui") {
        check(identities.includes("v1|Service|vault|vault-ui"), "ha-raft-ui UI Service missing");
        check(identities.includes("v1|Service|vault|vault-active"), "ha-raft-ui active Service missing");
        check(identities.includes("v1|Service|vault|vault-standby"), "ha-raft-ui standby Service missing");
        check(identities.includes("rbac.authorization.k8s.io/v1|Role|vault|vault-discovery-role"), "ha-raft-ui discovery Role missing");
        check(identities.includes("rbac.authorization.k8s.io/v1|RoleBinding|vault|vault-discovery-rolebinding"), "ha-raft-ui discovery RoleBinding missing");
        check(identities.includes("policy/v1|PodDisruptionBudget|vault|vault"), "ha-raft-ui PodDisruptionBudget missing");
      }
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag TLS, webhook, RBAC, workload, service exposure, and extension review`);
    }
  },
});
