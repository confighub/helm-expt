// cert-manager proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged. Supports the multi-version
// harness env overrides (HELM_EXPT_CHART_VERSION / HELM_EXPT_PROOF_OUTPUT_ROOT) via
// the kit.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "v1.20.2";
const chart = {
  repository: "jetstack",
  repositoryURL: "https://charts.jetstack.io",
  name: "cert-manager",
  version: chartVersion,
  releaseName: "cert-manager",
  namespace: "cert-manager",
  kubeVersion: "1.30.0",
};

const versionExpectations = {
  "v1.20.2": { defaultObjects: 42, crdsObjects: 48 },
  "v1.21.0": { defaultObjects: 40, crdsObjects: 46 },
};
const expected = versionExpectations[chart.version];
if (!expected) throw new Error(`cert-manager ${chart.version} needs reviewed version-specific assertions`);

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults",
    expectedObjectCount: expected.defaultObjects,
    expectedCRDCount: 0,
    targetFactNote: "keeps webhook objects and excludes the Helm startup API check hook Job from the rendered revision",
  },
  {
    name: "crds-enabled",
    base: "crds-enabled",
    displayName: "CRDs enabled",
    valuesFile: "effective-values-crds-enabled.yaml",
    valuesText: `crds:
  enabled: true
`,
    valuesSummary: "cert-manager CRDs included",
    expectedObjectCount: expected.crdsObjects,
    expectedCRDCount: 6,
    targetFactNote: "adds the six cert-manager CRDs to the rendered revision",
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
      id: "helm-hook-lifecycle-policy",
      severity: "medium",
      description: "Helm hook jobs need an explicit lifecycle policy.",
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
  supportObjects: ["v1|Namespace||cert-manager"],
  expectedDependencyCount: 0,
  valueModel: {
    checkedValues: [
      {
        path: "crds.enabled",
        variant: "default",
        disposition: "crds-excluded",
        reason: "chart defaults do not render cert-manager CRDs",
      },
      {
        path: "crds.enabled",
        variant: "crds-enabled",
        disposition: "crds-included",
        reason: "renders the six cert-manager CRDs as part of the approved revision",
      },
      {
        path: "installCRDs",
        variant: "all",
        disposition: "deprecated-crd-switch-not-used",
        reason: "uses crds.enabled rather than the deprecated installCRDs switch",
      },
      {
        path: "startupapicheck.enabled",
        variant: "all",
        disposition: "hook-excluded-by-render-policy",
        reason: "startup API check is a Helm post-install hook and is excluded from the rendered revision by --no-hooks",
      },
      {
        path: "extraObjects",
        variant: "all",
        disposition: "empty-extension-slot",
        reason: "chart exposes a tpl-powered extension slot; promoted variants keep it empty",
      },
      {
        path: "image.digest",
        variant: "all",
        disposition: "not-set",
        reason: "default image references use chart appVersion tags, not digests",
      },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart has no subchart dependencies" },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note: "render is bound to the named Kubernetes capability profile even though this chart version does not branch on .Capabilities.",
    },
    {
      category: "crd-policy",
      status: "variant-controlled",
      variants: { default: 0, "crds-enabled": 6 },
      note: "CRDs are ordinary rendered objects only in the crds-enabled variant and still need lifecycle/upgrade policy.",
    },
    {
      category: "hook-policy",
      status: "handled-for-render",
      policy: "no-hooks",
      note: "startup API check Job is a Helm post-install hook and is excluded from the render proof; lifecycle policy must handle it before production.",
    },
    {
      category: "admission-webhook",
      status: "scan-and-observe",
      objects: [
        "admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||cert-manager-webhook",
        "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||cert-manager-webhook",
      ],
    },
    { category: "cluster-rbac", status: "scan-and-review", evidence: "scan receipts" },
    { category: "tpl", status: "controlled-by-empty-defaults", note: "extraObjects uses tpl; promoted variants do not set that value." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||cert-manager" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart does not render CRDs because crds.enabled defaults to false.",
      "crds-enabled variant renders six cert-manager CRDs as ordinary rendered objects.",
      "startup API check is a Helm post-install hook and is excluded from the rendered revision by --no-hooks.",
      "Mutating and validating webhook readiness must be observed after apply because rendered objects alone do not prove webhook health.",
      "extraObjects is a tpl-powered extension slot; promoted variants keep it empty.",
    ],
    knownControlPoints: [
      "capability-profile",
      "crd-lifecycle-policy",
      "hook-lifecycle-policy",
      "admission-webhook-observation",
      "cluster-rbac-scan",
      "tpl-extension-slot",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after CRD lifecycle/upgrade policy, webhook observation policy, hook policy, and cluster RBAC review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the cert-manager public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart render is deterministic under the pinned Kubernetes capability profile;",
      "the crds-enabled variant deliberately adds the six cert-manager CRDs;",
      "CRD lifecycle, admission webhook, Helm hook lifecycle, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "CRD install/upgrade behavior needs explicit lifecycle policy before production",
      "Admission webhook availability needs a fresh observation receipt after apply",
      "Helm startup API check hook Job needs explicit lifecycle policy before production",
      "Cluster-scoped RBAC needs production review",
      variant.targetFactNote,
    ],
  }),
  // Chart-specific scan rules: admission webhooks, CRDs, and the excluded
  // startup API check Helm hook. (mutable-image-tag, service-selector,
  // workload-service-account, and cluster-rbac-review come from the kit.)
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
    for (const doc of docs.filter((item) => item.kind === "MutatingWebhookConfiguration")) {
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
    findings.push({
      id: "helm-hook-lifecycle-policy:cert-manager-startupapicheck",
      rule: "helm-hook-lifecycle-policy",
      severity: "medium",
      object: "helm-hook|Job|cert-manager|cert-manager-startupapicheck",
      message: "cert-manager startup API check is a Helm post-install hook excluded by --no-hooks and needs lifecycle policy",
    });
    return findings;
  },
  // Chart-specific verify assertions the generic kit cannot infer.
  verifyExtra({ controlPoints, perVariant, check }) {
    check(controlPoints.spec.points?.some((point) => point.category === "capability-profile"), "capability-profile control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "hook-policy"), "hook-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(identities.includes("apps/v1|Deployment|cert-manager|cert-manager"), `${variant.name} controller Deployment missing`);
      check(identities.includes("apps/v1|Deployment|cert-manager|cert-manager-cainjector"), `${variant.name} cainjector Deployment missing`);
      check(identities.includes("apps/v1|Deployment|cert-manager|cert-manager-webhook"), `${variant.name} webhook Deployment missing`);
      check(identities.includes("v1|Service|cert-manager|cert-manager-webhook"), `${variant.name} webhook Service missing`);
      check(
        identities.includes("admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||cert-manager-webhook"),
        `${variant.name} MutatingWebhookConfiguration missing`,
      );
      check(
        identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||cert-manager-webhook"),
        `${variant.name} ValidatingWebhookConfiguration missing`,
      );
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag CRD/admission/hook/RBAC review`);
      if (variant.name === "default") {
        check(!crdIdentities.length, "default must not render CRDs");
      }
      if (variant.name === "crds-enabled") {
        const requiredCRDs = [
          "apiextensions.k8s.io/v1|CustomResourceDefinition||certificaterequests.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||certificates.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||challenges.acme.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||clusterissuers.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||issuers.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||orders.acme.cert-manager.io",
        ];
        for (const identity of requiredCRDs) check(identities.includes(identity), `missing CRD ${identity}`);
      }
    }
  },
});
