// metrics-server proof.
//
// Chart-specific declaration only. All generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs and is shared across every chart proof. The CLI surface
// is unchanged:
//   node scripts/metrics-server-proof.mjs --generate-proof|--generate-package|
//        --verify-proof|--verify-proof-self-test|--verify-package|--compare

import { runProofCli } from "./lib/proof-kit.mjs";

const chart = {
  repository: "metrics-server",
  repositoryURL: "https://kubernetes-sigs.github.io/metrics-server/",
  name: "metrics-server",
  version: "3.13.0",
  releaseName: "metrics-server",
  namespace: "kube-system",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default",
    valuesFile: "effective-values.yaml",
    valuesText: `args:
  - --kubelet-insecure-tls
`,
    valuesSummary: "chart defaults plus explicit kind-compatible kubelet TLS flag",
    expectedObjectCount: 9,
    targetFactNote: "uses metrics-server runtime-generated serving cert; Helm generated-cert path is inactive",
  },
  {
    name: "external-tls-ca",
    base: "external-tls-ca",
    displayName: "external TLS with explicit CA",
    valuesFile: "effective-values-external-tls-ca.yaml",
    valuesText: `tls:
  type: existingSecret
  existingSecret:
    name: metrics-server-tls
    lookup: false
apiService:
  insecureSkipTLSVerify: false
  caBundle: confighub-metrics-server-ca
`,
    valuesSummary: "target Secret plus explicit APIService CA bundle",
    expectedObjectCount: 9,
    targetFactNote: "requires target Secret kube-system/metrics-server-tls with tls.crt and tls.key",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "kube-system",
          name: "metrics-server-tls",
          keys: ["tls.crt", "tls.key"],
          purpose: "metrics-server serving certificate",
        },
      ],
    },
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
      id: "apiservice-requires-observation",
      severity: "medium",
      description: "APIService availability must be observed after apply.",
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
  supportObjects: [`v1|Namespace||${chart.namespace}`],
  valueModel: {
    checkedValues: [
      {
        path: "tls.type",
        variant: "default",
        disposition: "chart-default-runtime-cert",
        reason: "default chart uses metrics-server runtime-generated serving certificate, so Helm generated cert helpers are inactive",
      },
      {
        path: "tls.type",
        variant: "external-tls-ca",
        disposition: "target-secret-reference",
        reason: "uses externally managed TLS Secret instead of Helm-generated certificate material",
      },
      {
        path: "tls.existingSecret.name",
        variant: "external-tls-ca",
        disposition: "target-secret-reference",
        reason: "records Secret name without storing secret material",
      },
      {
        path: "tls.existingSecret.lookup",
        variant: "external-tls-ca",
        disposition: "disabled-lookup",
        reason: "prevents cluster-sourced lookup from changing the rendered revision",
      },
      {
        path: "apiService.caBundle",
        variant: "external-tls-ca",
        disposition: "explicit-ca-input",
        reason: "binds APIService trust input into the rendered variant revision",
      },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart has no subchart dependencies" },
    {
      category: "generated-facts",
      status: "avoided-by-current-variants",
      evidence: "variants/default/variant.yaml and variants/external-tls-ca/variant.yaml",
      note: "tls.type=helm would use genSelfSignedCert and lookup; it is intentionally not promoted until generated-fact receipts are formalized.",
    },
    {
      category: "target-facts",
      status: "required-for-external-tls-ca",
      evidence: "variants/external-tls-ca/variant.yaml",
      required: [
        { kind: "Secret", namespace: "kube-system", name: "metrics-server-tls", keys: ["tls.crt", "tls.key"] },
      ],
    },
    { category: "lookup", status: "avoided", note: "external-tls-ca sets tls.existingSecret.lookup=false; default keeps lookup path inactive" },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion },
    { category: "hook-policy", status: "handled", policy: "no-hooks" },
    { category: "apiservice", status: "needs-observation", object: "apiregistration.k8s.io/v1|APIService||v1beta1.metrics.k8s.io" },
    { category: "cluster-rbac", status: "scan-and-review", evidence: "scan receipts" },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||kube-system" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart renders APIService with insecureSkipTLSVerify=true and lets metrics-server generate its serving certificate at runtime.",
      "tls.type=helm activates Helm lookup and genSelfSignedCert; do not promote that path until generated-fact receipts are formalized.",
      "external-tls-ca variant moves TLS material to a target Secret and binds APIService caBundle into effective values.",
      "APIService readiness must be observed after apply because a rendered object alone does not prove aggregated API health.",
    ],
    knownControlPoints: [
      "generated-facts",
      "recipe-target-facts",
      "capability-profile",
      "operate-observation",
      "cluster-rbac-scan",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after APIService observation policy and cluster RBAC review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the metrics-server public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart render is deterministic under the pinned Kubernetes capability profile;",
      "the existing-secret TLS path avoids Helm lookup and generated certificate material by making the target Secret explicit;",
      "APIService and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "APIService availability needs a fresh observation receipt after apply",
      "Cluster-scoped RBAC needs production review",
      variant.targetFactNote,
    ],
  }),
  // Chart-specific verify assertions that the generic kit cannot infer.
  verifyExtra({ root, controlPoints, perVariant, check, readYaml, readFileSync, join }) {
    check(controlPoints.spec.points?.some((point) => point.category === "generated-facts"), "generated-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "apiservice"), "apiservice control point missing");
    for (const variant of variants) {
      const { identities, releasePath, scan } = perVariant.get(variant.name);
      check(identities.includes("apiregistration.k8s.io/v1|APIService||v1beta1.metrics.k8s.io"), `${variant.name} APIService missing`);
      check(identities.includes("apps/v1|Deployment|kube-system|metrics-server"), `${variant.name} Deployment missing`);
      check(scan.spec.findingCounts.medium >= 2, `${variant.name} scan must flag APIService and RBAC review`);
      if (variant.name === "external-tls-ca") {
        const variantDoc = readYaml(join(root, "variants", "external-tls-ca", "variant.yaml"));
        const requiredSecret = variantDoc.spec.targetFacts?.requiredSecrets?.[0];
        check(requiredSecret?.name === "metrics-server-tls", "external-tls-ca target Secret mismatch");
        check(requiredSecret?.keys?.includes("tls.crt"), "external-tls-ca tls.crt key missing");
        check(requiredSecret?.keys?.includes("tls.key"), "external-tls-ca tls.key key missing");
        check(readFileSync(releasePath, "utf8").includes("caBundle: Y29uZmlnaHViLW1ldHJpY3Mtc2VydmVyLWNh"), "external-tls-ca caBundle missing");
        check(readFileSync(releasePath, "utf8").includes("secretName: metrics-server-tls"), "external-tls-ca secretName missing");
      }
    }
  },
});
