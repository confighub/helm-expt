// external-secrets proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged. Supports the multi-version
// harness env overrides (HELM_EXPT_CHART_VERSION / HELM_EXPT_PROOF_OUTPUT_ROOT) via
// the kit.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "external-secrets",
  repositoryURL: "https://charts.external-secrets.io",
  name: "external-secrets",
  version: "2.5.0",
  releaseName: "external-secrets",
  namespace: "external-secrets",
  kubeVersion: "1.30.0",
};

const externalSecretsCRDs = [
  "acraccesstokens.generators.external-secrets.io",
  "cloudsmithaccesstokens.generators.external-secrets.io",
  "clusterexternalsecrets.external-secrets.io",
  "clustergenerators.generators.external-secrets.io",
  "clusterpushsecrets.external-secrets.io",
  "clustersecretstores.external-secrets.io",
  "ecrauthorizationtokens.generators.external-secrets.io",
  "externalsecrets.external-secrets.io",
  "fakes.generators.external-secrets.io",
  "gcraccesstokens.generators.external-secrets.io",
  "generatorstates.generators.external-secrets.io",
  "githubaccesstokens.generators.external-secrets.io",
  "grafanas.generators.external-secrets.io",
  "mfas.generators.external-secrets.io",
  "passwords.generators.external-secrets.io",
  "pushsecrets.external-secrets.io",
  "quayaccesstokens.generators.external-secrets.io",
  "secretstores.external-secrets.io",
  "sshkeys.generators.external-secrets.io",
  "stssessiontokens.generators.external-secrets.io",
  "uuids.generators.external-secrets.io",
  "vaultdynamicsecrets.generators.external-secrets.io",
  "webhooks.generators.external-secrets.io",
];

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults",
    expectedObjectCount: 42,
    expectedCRDCount: 23,
    expectedSecretCount: 1,
    targetFactNote: "includes external-secrets CRDs and an empty webhook Secret managed by the cert-controller",
  },
  {
    name: "no-crds",
    base: "no-crds",
    displayName: "CRDs disabled",
    valuesFile: "effective-values-no-crds.yaml",
    valuesText: `installCRDs: false
`,
    valuesSummary: "external-secrets CRDs disabled",
    expectedObjectCount: 19,
    expectedCRDCount: 0,
    expectedSecretCount: 1,
    targetFacts: {
      requiredCRDs: externalSecretsCRDs.map((name) => ({
        name,
        sourceVariant: "default",
        purpose: "External Secrets CRD managed outside this no-crds base",
        deliveryLanes: ["regularHelm", "cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"],
      })),
    },
    targetFactNote:
      "omits external-secrets CRDs while preserving webhook, cert-controller, and RBAC objects; target clusters must already provide the External Secrets CRDs",
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
      id: "webhook-secret-cert-controller-policy",
      severity: "medium",
      description: "Webhook Secret lifecycle needs cert-controller observation policy.",
    },
    {
      id: "dependency-lock-review",
      severity: "medium",
      description: "Disabled chart dependencies still need lock and provenance review.",
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
  supportObjects: ["v1|Namespace||external-secrets"],
  expectedDependencyCount: 1,
  recordChartLockDigest: true,
  valueModel: {
    checkedValues: [
      {
        path: "installCRDs",
        variant: "default",
        disposition: "crds-included",
        reason: "chart defaults render all external-secrets CRDs",
      },
      {
        path: "installCRDs",
        variant: "no-crds",
        disposition: "crds-excluded",
        reason: "omits CRDs from the rendered revision for clusters that manage CRDs separately",
      },
      {
        path: "crds.*",
        variant: "all",
        disposition: "crd-selection-controls",
        reason: "controls which external-secrets CRDs are rendered when installCRDs is enabled",
      },
      {
        path: "webhook.certManager.enabled",
        variant: "all",
        disposition: "built-in-cert-controller",
        reason: "defaults to built-in cert-controller and an empty webhook Secret rather than cert-manager Certificate objects",
      },
      {
        path: "extraObjects",
        variant: "all",
        disposition: "empty-extension-slot",
        reason: "chart exposes a tpl-powered extension slot; promoted variants keep it empty",
      },
      {
        path: "bitwarden-sdk-server.enabled",
        variant: "all",
        disposition: "disabled-dependency",
        reason: "chart declares and locks this dependency, but promoted variants keep it disabled",
      },
    ],
  },
  dependencyLockChart: "external-secrets/external-secrets",
  packageTransformers: [
    {
      toolchain: "Kubernetes/YAML",
      whereResource: "",
      description: "Set the namespace on every namespaced resource.",
      invocations: [{ name: "set-namespace", args: ["{{ .Namespace }}"] }],
    },
    {
      toolchain: "Kubernetes/YAML",
      whereResource:
        "ConfigHub.ResourceType IN ('rbac.authorization.k8s.io/v1/ClusterRoleBinding', 'rbac.authorization.k8s.io/v1/RoleBinding')",
      description: "Keep RBAC subject namespaces aligned with the selected install namespace.",
      invocations: [{ name: "yq-i", args: ['.subjects[]?.namespace = "{{ .Namespace }}"'] }],
    },
    {
      toolchain: "Kubernetes/YAML",
      whereResource: "ConfigHub.ResourceType = 'apps/v1/Deployment'",
      description: "Keep external-secrets webhook certificate controller namespace references aligned.",
      invocations: [
        {
          name: "yq-i",
          args: [
            '(.spec.template.spec.containers[] | select(.name == "cert-controller").args[3]) = "--service-namespace={{ .Namespace }}"',
          ],
        },
        {
          name: "yq-i",
          args: [
            '(.spec.template.spec.containers[] | select(.name == "cert-controller").args[5]) = "--secret-namespace={{ .Namespace }}"',
          ],
        },
        {
          name: "yq-i",
          args: [
            '(.spec.template.spec.containers[] | select(.name == "webhook").args[2]) = "--dns-name=external-secrets-webhook.{{ .Namespace }}.svc"',
          ],
        },
      ],
    },
    {
      toolchain: "Kubernetes/YAML",
      whereResource: "ConfigHub.ResourceType = 'admissionregistration.k8s.io/v1/ValidatingWebhookConfiguration'",
      description: "Keep admission webhook service references aligned with the selected install namespace.",
      invocations: [{ name: "yq-i", args: ['.webhooks[].clientConfig.service.namespace = "{{ .Namespace }}"'] }],
    },
  ],
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    {
      category: "dependency-lock",
      status: "handled",
      evidence: "dependency-lock.yaml",
      note: "chart declares bitwarden-sdk-server dependency; promoted variants keep it disabled but lock its metadata.",
    },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note: "OpenShift and ServiceMonitor branches are bound to the named Kubernetes capability profile.",
    },
    {
      category: "crd-policy",
      status: "variant-controlled-and-target-fact",
      variants: { default: 23, "no-crds": 0 },
      note: "CRDs are ordinary rendered objects in the default variant and required target facts for the no-crds variant.",
    },
    {
      category: "admission-webhook",
      status: "scan-and-observe",
      objects: [
        "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||externalsecret-validate",
        "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||secretstore-validate",
      ],
    },
    {
      category: "webhook-secret",
      status: "scan-and-observe",
      object: "v1|Secret|external-secrets|external-secrets-webhook",
      note: "rendered Secret contains metadata only; cert-controller populates certificate material later.",
    },
    { category: "cluster-rbac", status: "scan-and-review", evidence: "scan receipts" },
    { category: "tpl", status: "controlled-by-empty-defaults", note: "extraObjects uses tpl; promoted variants do not set that value." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||external-secrets" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart renders 23 external-secrets CRDs because installCRDs defaults to true.",
      "no-crds variant omits CRDs for clusters that manage CRDs separately and records those CRDs as target facts.",
      "Chart declares a bitwarden-sdk-server dependency that remains disabled in promoted variants but is recorded in dependency-lock.yaml.",
      "Validating webhook readiness must be observed after apply because rendered objects alone do not prove webhook health.",
      "The rendered webhook Secret contains metadata only; cert-controller populates certificate material after apply.",
      "extraObjects is a tpl-powered extension slot; promoted variants keep it empty.",
    ],
    knownControlPoints: [
      "capability-profile",
      "crd-lifecycle-policy",
      "dependency-lock",
      "admission-webhook-observation",
      "webhook-secret-observation",
      "cluster-rbac-scan",
      "tpl-extension-slot",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after CRD lifecycle/upgrade policy, webhook observation policy, webhook Secret observation, dependency lock review, and cluster RBAC review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the external-secrets public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart render is deterministic under the pinned Kubernetes capability profile;",
      "the no-crds variant deliberately removes the 23 external-secrets CRDs;",
      "CRD lifecycle, admission webhook, webhook Secret, disabled dependency, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "CRD install/upgrade behavior needs explicit lifecycle policy before production",
      "Admission webhook availability needs a fresh observation receipt after apply",
      "Webhook Secret and cert-controller behavior need observation after apply",
      "Cluster-scoped RBAC needs production review",
      variant.targetFactNote,
    ],
  }),
  // Chart-specific scan rules: admission webhooks, CRDs, the cert-controller webhook
  // Secret, and the disabled bitwarden-sdk-server dependency. (mutable-image-tag,
  // service-selector, workload-service-account, and cluster-rbac-review come from the kit.)
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
    for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
      findings.push({
        id: `crd-upgrade-policy:${identityFor(doc)}`,
        rule: "crd-upgrade-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "CRD readiness, ordering, schema validation, and upgrade compatibility require explicit policy",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "external-secrets-webhook")) {
      findings.push({
        id: `webhook-secret-cert-controller-policy:${identityFor(doc)}`,
        rule: "webhook-secret-cert-controller-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "Webhook Secret certificate material is populated by cert-controller after apply and needs observation",
      });
    }
    findings.push({
      id: "dependency-lock-review:bitwarden-sdk-server",
      rule: "dependency-lock-review",
      severity: "medium",
      object: "dependency|bitwarden-sdk-server|v0.6.0",
      message: "Disabled bitwarden-sdk-server dependency is locked and should remain disabled unless selected by a variant",
    });
    return findings;
  },
  // Chart-specific verify assertions the generic kit cannot infer.
  verifyExtra({ controlPoints, dependencyLock, perVariant, check }) {
    check(dependencyLock.spec.dependencies?.[0]?.name === "bitwarden-sdk-server", "external-secrets dependency name mismatch");
    check(controlPoints.spec.points?.some((point) => point.category === "capability-profile"), "capability-profile control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "webhook-secret"), "webhook-secret control point missing");
    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|Deployment|external-secrets|external-secrets"), `${variant.name} controller Deployment missing`);
      check(identities.includes("apps/v1|Deployment|external-secrets|external-secrets-cert-controller"), `${variant.name} cert-controller Deployment missing`);
      check(identities.includes("apps/v1|Deployment|external-secrets|external-secrets-webhook"), `${variant.name} webhook Deployment missing`);
      check(identities.includes("v1|Service|external-secrets|external-secrets-webhook"), `${variant.name} webhook Service missing`);
      check(identities.includes("v1|Secret|external-secrets|external-secrets-webhook"), `${variant.name} webhook Secret missing`);
      check(
        identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||externalsecret-validate"),
        `${variant.name} externalsecret ValidatingWebhookConfiguration missing`,
      );
      check(
        identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||secretstore-validate"),
        `${variant.name} secretstore ValidatingWebhookConfiguration missing`,
      );
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag CRD/admission/secret/RBAC review`);
      if (variant.name === "default") {
        const requiredCRDs = [
          ...externalSecretsCRDs.map((name) => `apiextensions.k8s.io/v1|CustomResourceDefinition||${name}`),
        ];
        for (const identity of requiredCRDs) check(identities.includes(identity), `missing CRD ${identity}`);
      }
      if (variant.name === "no-crds") {
        check(!crdIdentities.length, "no-crds must not render CRDs");
      }
    }
  },
});
