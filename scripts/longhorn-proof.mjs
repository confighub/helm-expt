// Longhorn proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "longhorn",
  repositoryURL: "https://charts.longhorn.io",
  name: "longhorn",
  version: "1.11.2",
  releaseName: "longhorn",
  namespace: "longhorn-system",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default storage control plane",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults with CRDs, manager DaemonSet, driver deployer, UI, and storage settings",
    expectedObjectCount: 41,
    expectedCRDCount: 22,
    expectedSecretCount: 0,
    targetFactNote: "keeps default storage settings, pre-upgrade hooks excluded by render policy, and no UI ingress exposure",
  },
  {
    name: "ui-ingress",
    base: "ui-ingress",
    displayName: "UI ingress enabled",
    valuesFile: "effective-values-ui-ingress.yaml",
    valuesText: `ingress:
  enabled: true
  host: longhorn.example.test
  ingressClassName: nginx
  tls: false
`,
    valuesSummary: "default Longhorn plus an explicit UI Ingress",
    expectedObjectCount: 42,
    expectedCRDCount: 22,
    expectedSecretCount: 0,
    targetFactNote: "adds UI ingress exposure with host and ingress class made explicit before render",
  },
];

const scanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    { id: "mutable-image-tag", severity: "high", description: "Container image must use an immutable or non-latest tag." },
    { id: "service-selector-has-workload-match", severity: "high", description: "Service selector must match a rendered workload pod template." },
    { id: "workload-service-account-exists", severity: "high", description: "Workload serviceAccountName must reference a rendered ServiceAccount." },
    { id: "admission-webhook-requires-observation", severity: "medium", description: "Admission webhook availability must be observed after apply." },
    { id: "helm-hook-lifecycle-policy", severity: "medium", description: "Longhorn pre-upgrade hooks need an explicit lifecycle policy." },
    { id: "crd-upgrade-policy", severity: "medium", description: "CRDs need explicit readiness, ordering, schema, and upgrade policy." },
    { id: "cluster-rbac-review", severity: "medium", description: "Cluster-scoped RBAC needs explicit review before production." },
    { id: "privileged-storage-workload-review", severity: "medium", description: "Storage DaemonSets and host-level access need explicit target readiness policy." },
    { id: "ui-ingress-policy", severity: "medium", description: "Longhorn UI exposure needs ingress, TLS, and auth policy." },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  expectedDependencyCount: 0,
  valueModel: {
    checkedValues: [
      { path: "crds/*", variant: "default", disposition: "crds-included", reason: "Longhorn chart ships 22 CRDs and the proof renders them as ordinary objects with --include-crds" },
      { path: "ingress.enabled / ingress.host / ingress.ingressClassName / ingress.tls", variant: "ui-ingress", disposition: "ui-exposure-bound", reason: "UI exposure is only added by an explicit variant with host, ingress class, and TLS posture captured" },
      { path: "preUpgradeChecker.jobEnabled", variant: "all", disposition: "hook-excluded-by-render-policy", reason: "Longhorn pre-upgrade check is a Helm hook path and is excluded from rendered revisions by --no-hooks" },
      { path: "persistence.*", variant: "all", disposition: "storageclass-policy", reason: "default StorageClass, replica count, reclaim policy, and data engine settings are install-impacting inputs" },
      { path: "defaultSettings.*", variant: "all", disposition: "target-storage-policy", reason: "host paths, replica scheduling, backup targets, and node policies affect live storage behavior after install" },
      { path: "privateRegistry.*", variant: "all", disposition: "secret-or-target-fact-slot", reason: "registry credentials can create or reference Secrets and must be explicit in production variants" },
      { path: "longhornManager / longhornDriver / longhornUI tolerations and nodeSelectors", variant: "all", disposition: "target-placement-policy", reason: "storage components need target node readiness, toleration, and placement policy" },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart has no subchart dependencies" },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "render is bound to the named Kubernetes capability profile." },
    { category: "crd-policy", status: "variant-controlled", variants: { default: 22, "ui-ingress": 22 }, note: "Longhorn CRDs are ordinary rendered objects in both promoted variants and still need lifecycle/upgrade policy." },
    { category: "hook-policy", status: "handled-for-render", policy: "no-hooks", note: "pre-upgrade checker hooks are excluded from the render proof; lifecycle policy must handle them before production." },
    { category: "admission-webhook", status: "scan-and-observe", objects: ["v1|Service|longhorn-system|longhorn-admission-webhook", "v1|Service|longhorn-system|longhorn-recovery-backend"] },
    { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||longhorn-role" },
    { category: "privileged-storage-workload", status: "scan-and-review", object: "apps/v1|DaemonSet|longhorn-system|longhorn-manager" },
    { category: "storageclass-policy", status: "scan-and-review", object: "v1|ConfigMap|longhorn-system|longhorn-storageclass" },
    { category: "ui-ingress-policy", status: "variant-controlled", object: "networking.k8s.io/v1|Ingress|longhorn-system|longhorn-ingress" },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||longhorn-system" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart renders 22 Longhorn CRDs as ordinary rendered objects with --include-crds.",
      "default variant keeps UI ingress disabled and captures the storage control plane baseline.",
      "ui-ingress variant adds Longhorn UI exposure with host and ingress class explicitly captured.",
      "Longhorn pre-upgrade checks are hook paths and are excluded from rendered revisions by --no-hooks.",
      "Longhorn manager, driver deployer, admission/recovery services, StorageClass/default settings, and CRDs require target readiness and observation policy.",
    ],
    knownControlPoints: [
      "capability-profile",
      "crd-lifecycle-policy",
      "hook-lifecycle-policy",
      "admission-recovery-observation",
      "privileged-storage-workload",
      "storageclass-policy",
      "ui-ingress-policy",
      "cluster-rbac-scan",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after CRD lifecycle/upgrade policy, admission/recovery observation policy, pre-upgrade hook policy, privileged storage workload policy, UI ingress policy, and cluster RBAC review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the Longhorn public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart render is deterministic under the pinned Kubernetes capability profile;",
      "both variants render the 22 Longhorn CRDs as ordinary, digest-bound objects;",
      "the ui-ingress variant deliberately adds Longhorn UI exposure with host and ingress class captured before render;",
      "CRD lifecycle, pre-upgrade hook lifecycle, admission/recovery observation, cluster RBAC, privileged storage workload, StorageClass/default-setting, and UI ingress risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Longhorn CRD lifecycle and upgrade policy need production review",
      "Longhorn pre-upgrade hook behavior is excluded from render and needs lifecycle policy",
      "Admission/recovery services and privileged storage workloads need live observation policy",
      "Cluster RBAC, StorageClass/default settings, and UI ingress policy need production review",
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
    for (const doc of docs.filter((item) => item.kind === "Service" && ["longhorn-admission-webhook", "longhorn-recovery-backend"].includes(item.metadata?.name))) {
      findings.push({
        id: `admission-webhook-requires-observation:${identityFor(doc)}`,
        rule: "admission-webhook-requires-observation",
        severity: "medium",
        object: identityFor(doc),
        message: "Longhorn admission/recovery service availability must be observed after apply",
      });
    }
    for (const doc of docs.filter((item) => ["DaemonSet", "Deployment"].includes(item.kind) && String(item.metadata?.name ?? "").startsWith("longhorn"))) {
      findings.push({
        id: `privileged-storage-workload-review:${identityFor(doc)}`,
        rule: "privileged-storage-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Longhorn storage workloads need node, host path, privileged behavior, and observation policy",
      });
    }
    findings.push({
      id: "helm-hook-lifecycle-policy:longhorn-pre-upgrade",
      rule: "helm-hook-lifecycle-policy",
      severity: "medium",
      object: "helm-hook|Job|longhorn|pre-upgrade-checker",
      message: "Longhorn pre-upgrade checks are Helm hook paths excluded by --no-hooks and need lifecycle policy",
    });
    for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding"].includes(item.kind))) {
      findings.push({
        id: `cluster-rbac-review:${identityFor(doc)}`,
        rule: "cluster-rbac-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Cluster-scoped RBAC requires production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "ConfigMap" && ["longhorn-storageclass", "longhorn-default-setting"].includes(item.metadata?.name))) {
      findings.push({
        id: `storageclass-policy:${identityFor(doc)}`,
        rule: "privileged-storage-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Longhorn storage/default settings require target policy review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Ingress")) {
      findings.push({
        id: `ui-ingress-policy:${identityFor(doc)}`,
        rule: "ui-ingress-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "Longhorn UI exposure requires ingress, TLS, and auth policy",
      });
    }
    return findings;
  },
  verifyExtra({ controlPoints, perVariant, check }) {
    check(controlPoints.spec.points?.some((point) => point.category === "capability-profile"), "capability-profile control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "hook-policy"), "hook-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "privileged-storage-workload"), "privileged-storage-workload control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "ui-ingress-policy"), "ui-ingress-policy control point missing");

    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|DaemonSet|longhorn-system|longhorn-manager"), `${variant.name} manager DaemonSet missing`);
      check(identities.includes("apps/v1|Deployment|longhorn-system|longhorn-driver-deployer"), `${variant.name} driver deployer missing`);
      check(identities.includes("apps/v1|Deployment|longhorn-system|longhorn-ui"), `${variant.name} UI Deployment missing`);
      check(identities.includes("v1|Service|longhorn-system|longhorn-admission-webhook"), `${variant.name} admission webhook Service missing`);
      check(identities.includes("v1|Service|longhorn-system|longhorn-recovery-backend"), `${variant.name} recovery backend Service missing`);
      check(identities.includes("v1|Service|longhorn-system|longhorn-frontend"), `${variant.name} frontend Service missing`);
      check(identities.includes("v1|ConfigMap|longhorn-system|longhorn-default-setting"), `${variant.name} default setting ConfigMap missing`);
      check(identities.includes("v1|ConfigMap|longhorn-system|longhorn-storageclass"), `${variant.name} storageclass ConfigMap missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||longhorn-role"), `${variant.name} ClusterRole missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||longhorn-bind"), `${variant.name} ClusterRoleBinding missing`);
      check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||volumes.longhorn.io"), `${variant.name} volumes CRD missing`);
      check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||engines.longhorn.io"), `${variant.name} engines CRD missing`);
      check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||nodes.longhorn.io"), `${variant.name} nodes CRD missing`);
      if (variant.name === "default") {
        check(!identities.includes("networking.k8s.io/v1|Ingress|longhorn-system|longhorn-ingress"), "default must not render UI Ingress");
      }
      if (variant.name === "ui-ingress") {
        check(identities.includes("networking.k8s.io/v1|Ingress|longhorn-system|longhorn-ingress"), "ui-ingress Ingress missing");
      }
      check(scan.spec.findingCounts.medium >= 6, `${variant.name} scan must flag CRD/admission/hook/RBAC/storage/UI review`);
    }
  },
});
