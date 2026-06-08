// Secrets Store CSI Driver proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "secrets-store-csi-driver",
  repositoryURL: "https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts",
  name: "secrets-store-csi-driver",
  version: "1.6.0",
  releaseName: "secrets-store-csi-driver",
  namespace: "kube-system",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default Linux driver",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults with CRDs, Linux DaemonSet, CSIDriver, and RBAC",
    expectedObjectCount: 10,
    expectedCRDCount: 2,
    expectedSecretCount: 0,
    targetFactNote: "installs the CSI driver and CRDs; SecretProviderClass provider behavior remains a post-install integration decision",
  },
  {
    name: "sync-secret-rotation",
    base: "sync-secret-rotation",
    displayName: "sync Secret and rotation",
    valuesFile: "effective-values-sync-secret-rotation.yaml",
    valuesText: `syncSecret:
  enabled: true
enableSecretRotation: true
providerHealthCheck: true
`,
    valuesSummary: "Secret syncing, rotation, and provider health checks are explicit",
    expectedObjectCount: 12,
    expectedCRDCount: 2,
    expectedSecretCount: 0,
    targetFactNote: "adds sync Secret RBAC and driver flags for rotation and provider health checks as variant-controlled outputs",
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
    { id: "csi-daemonset-operate-review", severity: "medium", description: "CSI DaemonSets need privileged-node, hostPath, rollout, and rollback policy." },
    { id: "secret-provider-integration-review", severity: "medium", description: "SecretProviderClass providers and synced Secret ownership need explicit integration policy." },
    { id: "sync-secret-rotation-review", severity: "medium", description: "Secret syncing and rotation settings need explicit review." },
    { id: "csi-driver-review", severity: "medium", description: "CSIDriver objects need driver lifecycle and kubelet integration review." },
    { id: "extension-slot-review", severity: "medium", description: "tpl/raw extension slots need provenance and scan coverage." },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  packageName: "secrets-store-csi-driver",
  expectedDependencyCount: 0,
  recordChartLockDigest: true,
  recordDeprecated: true,
  expectedDeprecated: false,
  valueModel: {
    checkedValues: [
      { path: "linux.crds.enabled", variant: "all", disposition: "variant-controlled", reason: "the promoted variants install the SecretProviderClass CRDs and bind that choice in the rendered object set" },
      { path: "syncSecret.enabled", variant: "sync-secret-rotation", disposition: "variant-controlled", reason: "the sync variant deliberately adds RBAC for synced Kubernetes Secrets" },
      { path: "enableSecretRotation / rotationPollInterval", variant: "sync-secret-rotation", disposition: "variant-controlled", reason: "Secret rotation is enabled only by an explicit variant and appears in driver args" },
      { path: "providerHealthCheck", variant: "sync-secret-rotation", disposition: "variant-controlled", reason: "provider health checks are enabled only by an explicit variant and appear in driver args" },
      { path: "linux.enabled / windows.enabled", variant: "all", disposition: "platform-variant", reason: "promoted variants install the Linux DaemonSet only; Windows support becomes a separate variant" },
      { path: "tokenRequests / linux.nodeSelector / linux.tolerations / linux.priorityClassName", variant: "all", disposition: "extension-slot", reason: "provider identity, scheduling, and token-request knobs must be explicit before production promotion" },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart declares no subchart dependencies; the empty closure is recorded explicitly." },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile." },
    { category: "crd-lifecycle", status: "scan-and-review", object: "apiextensions.k8s.io/v1|CustomResourceDefinition||secretproviderclasses.secrets-store.csi.x-k8s.io" },
    { category: "csi-driver", status: "scan-and-review", object: "storage.k8s.io/v1|CSIDriver||secrets-store.csi.k8s.io" },
    { category: "daemonset-workload", status: "scan-and-review", object: "apps/v1|DaemonSet|kube-system|secrets-store-csi-driver" },
    { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasses-role" },
    { category: "sync-secret-rotation", status: "variant-controlled", evidence: "syncSecret.enabled / enableSecretRotation / providerHealthCheck" },
    { category: "provider-integration", status: "needs-target-decision", note: "SecretProviderClass provider identity, token requests, and synced Secret ownership are post-render integration controls." },
    { category: "platform-variant", status: "controlled-by-values", note: "promoted variants install Linux DaemonSet only; Windows support is a future variant." },
    { category: "extension-slots", status: "controlled-by-empty-defaults", note: "provider identity, token request, scheduling, and provider path knobs are explicit variant inputs." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||kube-system" },
  ],
  dossier: {
    maintainedNotes: [
      "The chart renders deterministically under pinned Helm, chart version, kube version, and values.",
      "The default variant installs the Linux CSI DaemonSet, CSIDriver, SecretProviderClass CRDs, and cluster RBAC.",
      "The sync-secret-rotation variant adds synced Secret RBAC and driver args for rotation and provider health checks.",
      "The chart does not install a cloud or vault provider; SecretProviderClass provider identity and token requests are integration controls after render.",
      "CRD lifecycle, CSI driver lifecycle, privileged-node DaemonSet behavior, cluster RBAC, synced Secret ownership, and rotation are scan/gate review points.",
      "Windows DaemonSet support and provider-specific identity inputs are future variants, not hidden defaults.",
    ],
    knownControlPoints: [
      "crd-lifecycle",
      "csi-driver",
      "daemonset-workload",
      "sync-secret-rotation",
      "provider-integration",
      "rbac-review",
      "extension-slots",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after CRD lifecycle, CSI DaemonSet, provider identity, synced Secret ownership, rotation, RBAC, and kubelet integration policies are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the Secrets Store CSI Driver public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "the default variant keeps the chart defaults visible: SecretProviderClass CRDs, Linux DaemonSet, CSIDriver object, and cluster RBAC;",
      "the sync-secret-rotation variant deliberately adds synced Secret RBAC and driver flags for rotation and provider health checks;",
      "cloud/provider identity and SecretProviderClass behavior are not hidden Helm render inputs; they are explicit integration gates after render;",
      "CRD lifecycle, CSI driver lifecycle, privileged-node DaemonSet behavior, cluster RBAC, synced Secret ownership, rotation, and provider identity risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "CRD lifecycle and upgrade policy must be explicit before production",
      "CSI DaemonSet privileged-node, hostPath, rollout, and rollback policy need production review",
      "SecretProviderClass provider identity and token-request policy must be explicit before production",
      "Synced Secret ownership and rotation behavior need production review",
      "Cluster RBAC and CSIDriver kubelet integration need production review",
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
    for (const doc of docs.filter((item) => item.kind === "CSIDriver")) {
      findings.push({
        id: `csi-driver-review:${identityFor(doc)}`,
        rule: "csi-driver-review",
        severity: "medium",
        object: identityFor(doc),
        message: "CSIDriver lifecycle and kubelet integration require production review",
      });
    }
    const syncEnabled = docs.some((item) => item.kind === "ClusterRole" && item.metadata?.name === "secretprovidersyncing-role");
    if (syncEnabled) {
      findings.push({
        id: "sync-secret-rotation-review:sync-enabled",
        rule: "sync-secret-rotation-review",
        severity: "medium",
        object: "values|syncSecret.enabled|enableSecretRotation|providerHealthCheck",
        message: "Synced Secret ownership, rotation cadence, and provider health checks require production review",
      });
    }
    findings.push({
      id: "extension-slot-review:secrets-store-csi-driver-values",
      rule: "extension-slot-review",
      severity: "medium",
      object: "values|tokenRequests|linux.nodeSelector|linux.tolerations|linux.priorityClassName|windows.enabled",
      message: "Provider identity, token-request, scheduling, and platform variant knobs must be scanned when populated",
    });
    for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
      findings.push({
        id: `cluster-rbac-review:${identityFor(doc)}`,
        rule: "cluster-rbac-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Secrets Store CSI Driver RBAC requires production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "DaemonSet")) {
      findings.push({
        id: `csi-daemonset-operate-review:${identityFor(doc)}`,
        rule: "csi-daemonset-operate-review",
        severity: "medium",
        object: identityFor(doc),
        message: "CSI DaemonSet privileged-node, hostPath, rollout, and rollback policy require production review",
      });
    }
    return findings;
  },
  verifyExtra({ controlPoints, perVariant, check }) {
    check(controlPoints.spec.points?.some((point) => point.category === "crd-lifecycle"), "crd-lifecycle control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "csi-driver"), "csi-driver control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "daemonset-workload"), "daemonset-workload control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "sync-secret-rotation"), "sync-secret-rotation control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "provider-integration"), "provider-integration control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "extension-slots"), "extension-slots control point missing");

    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|DaemonSet|kube-system|secrets-store-csi-driver"), `${variant.name} DaemonSet missing`);
      check(identities.includes("storage.k8s.io/v1|CSIDriver||secrets-store.csi.k8s.io"), `${variant.name} CSIDriver missing`);
      check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||secretproviderclasses.secrets-store.csi.x-k8s.io"), `${variant.name} SecretProviderClass CRD missing`);
      check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||secretproviderclasspodstatuses.secrets-store.csi.x-k8s.io"), `${variant.name} SecretProviderClassPodStatus CRD missing`);
      check(identities.includes("v1|ServiceAccount|kube-system|secrets-store-csi-driver"), `${variant.name} ServiceAccount missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasses-role"), `${variant.name} driver ClusterRole missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasses-admin-role"), `${variant.name} admin ClusterRole missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasses-viewer-role"), `${variant.name} viewer ClusterRole missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasspodstatuses-viewer-role"), `${variant.name} pod status viewer ClusterRole missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||secretproviderclasses-rolebinding"), `${variant.name} driver ClusterRoleBinding missing`);
      if (variant.name === "default") {
        check(!identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretprovidersyncing-role"), "default variant must not render sync Secret ClusterRole");
      }
      if (variant.name === "sync-secret-rotation") {
        check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretprovidersyncing-role"), "sync-secret-rotation sync Secret ClusterRole missing");
        check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||secretprovidersyncing-rolebinding"), "sync-secret-rotation sync Secret ClusterRoleBinding missing");
      }
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag CRDs, CSIDriver, DaemonSet, RBAC, provider integration, and extension review`);
    }
  },
});
