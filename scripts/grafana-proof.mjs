// grafana proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "grafana",
  repositoryURL: "https://grafana.github.io/helm-charts",
  name: "grafana",
  version: "10.5.15",
  releaseName: "grafana",
  namespace: "grafana",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "generated-passwords",
    base: "generated-passwords",
    displayName: "generated passwords",
    valuesFile: "effective-values.yaml",
    valuesText: `adminPassword: confighub-grafana-admin-password
`,
    valuesSummary: "Grafana admin password bound as a generated fact",
    expectedObjectCount: 9,
    expectedCRDCount: 0,
    expectedSecretCount: 1,
    targetFactNote: "uses a persisted generated fact for adminPassword and renders the chart Secret deterministically",
  },
  {
    name: "existing-secret-ingress",
    base: "existing-secret-ingress",
    displayName: "existing Secret with ingress",
    valuesFile: "effective-values-existing-secret-ingress.yaml",
    valuesText: `admin:
  existingSecret: grafana-admin
  userKey: admin-user
  passwordKey: admin-password
ingress:
  enabled: true
  ingressClassName: nginx
  hosts:
    - grafana.example.test
  tls: []
`,
    valuesSummary: "target Secret supplies Grafana admin credentials and UI ingress is explicit",
    expectedObjectCount: 9,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "requires target Secret grafana/grafana-admin and exposes UI through grafana.example.test ingress",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "grafana",
          name: "grafana-admin",
          keys: ["admin-user", "admin-password"],
          purpose: "Grafana administrator username and password",
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
    { id: "deployment-workload-review", severity: "medium", description: "Deployments need rollout, persistence, and rollback policy." },
    { id: "extension-slot-review", severity: "medium", description: "tpl/raw extension slots need provenance and scan coverage." },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  supportObjects: [`v1|Namespace||${chart.namespace}`],
  recordChartLockDigest: true,
  recordDeprecated: true,
  expectedDeprecated: true,
  valueModel: {
    checkedValues: [
      { path: "adminPassword", variant: "generated-passwords", disposition: "generated-fact-bound", reason: "default chart uses random admin password generation; this variant persists the generated value before render" },
      { path: "admin.existingSecret / admin.userKey / admin.passwordKey", variant: "existing-secret-ingress", disposition: "target-fact-bound", reason: "externalizes Grafana admin credentials into a declared target Secret" },
      { path: "ingress.enabled / ingress.hosts / ingress.ingressClassName", variant: "existing-secret-ingress", disposition: "ui-exposure-bound", reason: "UI exposure is only added by an explicit variant with host and ingress class captured" },
      { path: "persistence.enabled", variant: "all", disposition: "deployment-storage-disabled", reason: "promoted variants keep persistence disabled; PVC-backed Grafana becomes a later variant" },
      { path: "datasources / dashboardProviders / dashboards / plugins", variant: "all", disposition: "extension-slot", reason: "Grafana provisioning and plugin slots are powerful config surfaces; promoted variants keep them empty" },
      { path: "sidecar.*", variant: "all", disposition: "collector-disabled", reason: "sidecar collectors can read ConfigMaps/Secrets; promoted variants keep sidecars disabled" },
      { path: "envRenderSecret / extraSecretMounts / envFromSecret", variant: "all", disposition: "secret-extension-slot", reason: "Grafana exposes additional Secret/env injection paths that must be explicit before production" },
    ],
  },
  dependencyLockChart: "grafana/grafana",
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart declares no subchart dependencies; the empty closure is recorded explicitly." },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile." },
    { category: "generated-facts", status: "variant-controlled", evidence: "adminPassword", note: "The generated-passwords variant binds the generated Grafana admin password before render so Helm output is deterministic." },
    { category: "target-facts", status: "variant-controlled", evidence: "admin.existingSecret", note: "The existing-secret-ingress variant declares the target Secret instead of rendering one." },
    { category: "deployment-workload", status: "scan-and-review", object: "apps/v1|Deployment|grafana|grafana" },
    { category: "ui-ingress-policy", status: "variant-controlled", object: "networking.k8s.io/v1|Ingress|grafana|grafana" },
    { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||grafana-clusterrole" },
    { category: "extension-slots", status: "controlled-by-empty-defaults", note: "datasource, dashboard, plugin, sidecar, and Secret/env slots are empty in promoted variants." },
    { category: "chart-deprecation", status: "noted", note: "Chart.yaml marks this chart version as deprecated; the proof records the fact but still verifies the public chart output." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||grafana" },
  ],
  dossier: {
    maintainedNotes: [
      "Chart.yaml marks this chart version deprecated, and the proof records that status.",
      "Default chart rendering is nondeterministic unless adminPassword is bound before render.",
      "generated-passwords variant persists adminPassword as a generated fact and renders the Secret deterministically.",
      "existing-secret-ingress variant does not render a Secret and instead declares grafana/grafana-admin as a target fact.",
      "existing-secret-ingress variant adds explicit UI ingress host and ingress class.",
      "Datasource, dashboard, plugin, sidecar, and Secret/env injection slots are powerful extension surfaces; promoted variants keep them empty.",
    ],
    knownControlPoints: [
      "generated-facts",
      "target-facts",
      "chart-deprecation",
      "rbac-review",
      "ui-ingress-policy",
      "provisioning-extension-slots",
      "sidecar-policy",
      "secret-extension-slots",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after generated fact or target fact binding, chart deprecation review, RBAC review, UI ingress policy, and provisioning/sidecar/Secret extension-slot review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the Grafana public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "this chart version is marked deprecated upstream, and the proof records that risk explicitly;",
      "default chart rendering is nondeterministic until the admin password is bound;",
      "the generated-passwords variant persists adminPassword before render;",
      "the existing-secret-ingress variant uses a declared target Secret, does not render a Secret, and adds explicit UI ingress exposure;",
      "generated fact, target fact, RBAC, UI ingress, deployment, sidecar, provisioning, and Secret/env extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Generated credential handling needs explicit generated fact or target fact policy before production",
      "Helm hook behavior needs explicit lifecycle policy before production",
      "Grafana deployment, RBAC, provisioning, and UI exposure need production review",
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
    for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "grafana")) {
      findings.push({
        id: `generated-secret-ownership:${identityFor(doc)}`,
        rule: "generated-secret-ownership",
        severity: "medium",
        object: identityFor(doc),
        message: "Grafana admin Secret content and ownership must be explicit before production promotion",
      });
    }
    findings.push({
      id: "extension-slot-review:provisioning",
      rule: "extension-slot-review",
      severity: "medium",
      object: "values|datasources|dashboardProviders|dashboards|plugins|sidecar|envRenderSecret",
      message: "Grafana provisioning, plugin, sidecar, and Secret/env extension slots must be scanned when populated",
    });
    for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
      findings.push({
        id: `cluster-rbac-review:${identityFor(doc)}`,
        rule: "cluster-rbac-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Grafana RBAC requires production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Deployment")) {
      findings.push({
        id: `deployment-workload-review:${identityFor(doc)}`,
        rule: "deployment-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Grafana Deployment, persistence choice, and rollout policy require production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Ingress")) {
      findings.push({
        id: `ui-ingress-policy:${identityFor(doc)}`,
        rule: "extension-slot-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Grafana UI ingress requires host, TLS, and auth policy",
      });
    }
    return findings;
  },
  verifyExtra({ sourceLock, controlPoints, dependencyLock, perVariant, check }) {
    check(sourceLock.spec.deprecated === true, "source deprecation marker must be recorded");
    check((dependencyLock.spec.dependencies ?? []).length === 0, "grafana dependency lock must be empty");
    check(controlPoints.spec.points?.some((point) => point.category === "generated-facts"), "generated-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "target-facts"), "target-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "deployment-workload"), "deployment-workload control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "ui-ingress-policy"), "ui-ingress-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "extension-slots"), "extension-slots control point missing");
    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|Deployment|grafana|grafana"), `${variant.name} Deployment missing`);
      check(identities.includes("v1|Service|grafana|grafana"), `${variant.name} Service missing`);
      check(identities.includes("v1|ServiceAccount|grafana|grafana"), `${variant.name} ServiceAccount missing`);
      check(identities.includes("v1|ConfigMap|grafana|grafana"), `${variant.name} ConfigMap missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||grafana-clusterrole"), `${variant.name} ClusterRole missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||grafana-clusterrolebinding"), `${variant.name} ClusterRoleBinding missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|Role|grafana|grafana"), `${variant.name} Role missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|RoleBinding|grafana|grafana"), `${variant.name} RoleBinding missing`);
      if (variant.name === "generated-passwords") {
        check(identities.includes("v1|Secret|grafana|grafana"), "generated-passwords Secret missing");
      }
      if (variant.name === "existing-secret-ingress") {
        check(!secretIdentities.length, "existing-secret-ingress must not render a Secret");
        check(identities.includes("networking.k8s.io/v1|Ingress|grafana|grafana"), "existing-secret-ingress Ingress missing");
      }
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag generated/target facts, RBAC, ingress/deployment, and extension review`);
    }
  },
});
