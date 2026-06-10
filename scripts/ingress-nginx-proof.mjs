// ingress-nginx proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged:
//   node scripts/ingress-nginx-proof.mjs --generate-proof|--generate-package|
//        --verify-proof|--verify-proof-self-test|--verify-package|--compare

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor, parseDocs } from "./lib/proof-common.mjs";

const chart = {
  repository: "ingress-nginx",
  repositoryURL: "https://kubernetes.github.io/ingress-nginx",
  name: "ingress-nginx",
  version: "4.15.1",
  releaseName: "ingress-nginx",
  namespace: "ingress-nginx",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults",
    expectedObjectCount: 11,
    targetFactNote:
      "keeps admission webhook object, excludes Helm hook jobs from the rendered revision, and stages the admission Secret as an installer-side lifecycle target fact for live parity",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "ingress-nginx",
          name: "ingress-nginx-admission",
          keys: ["cert", "key", "ca"],
          purpose: "admission webhook certificate normally created by Helm hook jobs",
          deliveryLanes: ["cubInstallerApply"],
        },
      ],
    },
  },
  {
    name: "admission-disabled",
    base: "admission-disabled",
    displayName: "admission webhook disabled",
    valuesFile: "effective-values-admission-disabled.yaml",
    valuesText: `controller:
  admissionWebhooks:
    enabled: false
`,
    valuesSummary: "controller admission webhook disabled",
    expectedObjectCount: 9,
    targetFactNote: "removes the admission Service and ValidatingWebhookConfiguration from the rendered revision",
  },
  {
    name: "internal-clusterip",
    base: "internal-clusterip",
    displayName: "internal ClusterIP controller",
    valuesFile: "effective-values-internal-clusterip.yaml",
    valuesText: `controller:
  admissionWebhooks:
    enabled: false
  service:
    type: ClusterIP
`,
    valuesSummary: "admission webhook disabled and controller Service set to ClusterIP",
    expectedObjectCount: 9,
    targetFactNote: "uses an internal ClusterIP Service for targets without an external LoadBalancer",
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
    { id: "helm-hook-lifecycle-policy", severity: "medium", description: "Helm hook jobs need an explicit lifecycle policy." },
    { id: "cluster-rbac-review", severity: "medium", description: "Cluster-scoped RBAC needs explicit review before production." },
  ],
};

function ingressLifecyclePolicy() {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "LifecyclePolicy",
    metadata: {
      name: "ingress-nginx-ingress-nginx-4.15.1",
      chart: "ingress-nginx/ingress-nginx",
      version: chart.version,
    },
    spec: {
      summary:
        "The default ingress-nginx base preserves the admission webhook objects rendered by Helm, but Helm hook Jobs that create and patch the webhook certificate are not part of the rendered object set. Production use needs an explicit lifecycle route and fresh observation receipt.",
      bases: {
        default: {
          status: "route-selected-observation-needed",
          selectedLiveParityRoute:
            "The two-cluster parity harness stages ingress-nginx/ingress-nginx-admission as an installer-side target fact, while regular Helm continues to create it through Helm hooks.",
          renderedObjects: [
            "v1|Service|ingress-nginx|ingress-nginx-controller-admission",
            "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||ingress-nginx-admission",
          ],
          omittedHelmHookObjects: [
            "admission-create Job",
            "admission-patch Job",
          ],
          observedFailureWhenMissingLifecycle:
            "MountVolume.SetUp failed for volume webhook-cert: secret ingress-nginx-admission not found.",
          supportedRoutes: [
            {
              route: "run-equivalent-webhook-cert-lifecycle",
              description:
                "Create and patch the admission webhook certificate Secret before or during apply, then observe the webhook Service and ValidatingWebhookConfiguration.",
              requiredReceipts: [
                "lifecycle-operation-receipt",
                "admission-webhook-observation-receipt",
                "secret-preflight-receipt",
              ],
            },
            {
              route: "use-target-certificate-provider",
              description:
                "Use a target-approved certificate provider, such as cert-manager, and record the Secret, CA bundle, and webhook readiness evidence.",
              requiredReceipts: [
                "target-fact-receipt",
                "admission-webhook-observation-receipt",
              ],
            },
            {
              route: "choose-non-webhook-base",
              description:
                "Use admission-disabled or internal-clusterip when the target does not need the ingress-nginx admission webhook.",
              requiredReceipts: [
                "variant-selection-receipt",
              ],
            },
          ],
          mustObserve: [
            "Secret ingress-nginx/ingress-nginx-admission exists with tls.crt, tls.key, and ca",
            "ValidatingWebhookConfiguration ingress-nginx-admission has caBundle populated",
            "Service ingress-nginx/ingress-nginx-controller-admission has ready endpoints",
            "controller Deployment is available after the webhook certificate route runs",
          ],
        },
        admissionDisabled: {
          status: "webhook-not-rendered",
          renderedObjects: [],
          note: "This base deliberately removes the admission Service and ValidatingWebhookConfiguration.",
          requiredReceipts: [
            "variant-selection-receipt",
          ],
        },
        internalClusterIP: {
          status: "webhook-not-rendered",
          renderedObjects: [],
          note: "This base deliberately removes the admission webhook and changes the controller Service to ClusterIP for local or internal targets.",
          requiredReceipts: [
            "variant-selection-receipt",
          ],
        },
      },
      notProvenBy: [
        "render parity alone",
        "presence of a ValidatingWebhookConfiguration alone",
        "one kubectl apply without the webhook certificate lifecycle route",
      ],
    },
  };
}

runProofCli({
  chart,
  variants,
  scanPolicy,
  extraRequiredFiles: ["lifecycle-policy.yaml"],
  extraProofDocuments: () => [{ path: "lifecycle-policy.yaml", document: ingressLifecyclePolicy() }],
  supportObjects: [`v1|Namespace||${chart.namespace}`],
  packageTransformers: [
    {
      toolchain: "Kubernetes/YAML",
      whereResource: "",
      description: "Set the namespace on every namespaced resource.",
      invocations: [{ name: "set-namespace", args: ["{{ .Namespace }}"] }],
    },
  ],
  valueModel: {
    checkedValues: [
      {
        path: "controller.admissionWebhooks.enabled",
        variant: "default",
        disposition: "admission-webhook-enabled",
        reason: "default chart renders ValidatingWebhookConfiguration and admission Service",
      },
      {
        path: "controller.admissionWebhooks.enabled",
        variant: "admission-disabled",
        disposition: "admission-webhook-disabled",
        reason: "removes admission Service and ValidatingWebhookConfiguration from the rendered revision",
      },
      {
        path: "controller.admissionWebhooks.enabled",
        variant: "internal-clusterip",
        disposition: "admission-webhook-disabled",
        reason: "keeps the internal target base free of admission hook and webhook objects",
      },
      {
        path: "controller.service.type",
        variant: "admission-disabled",
        disposition: "public-load-balancer-service",
        reason: "keeps the chart's default LoadBalancer Service shape for targets that provide external load balancers",
      },
      {
        path: "controller.service.type",
        variant: "internal-clusterip",
        disposition: "internal-service-target-fit",
        reason: "uses ClusterIP for local/internal targets where LoadBalancer external IP assignment is not available",
      },
      {
        path: "controller.image.digest",
        variant: "all",
        disposition: "immutable-image-reference",
        reason: "default image includes registry, tag, and digest",
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
      note: "service appProtocol and autoscaling branches are bound to the named Kubernetes capability profile.",
    },
    { category: "hook-policy", status: "handled-for-render", policy: "no-hooks", note: "admission patch Jobs are Helm hooks and are excluded from the render proof; lifecycle policy must handle them before production." },
    {
      category: "target-facts",
      status: "required-for-default-live-parity",
      evidence: "variants/default/variant.yaml",
      required: [
        { kind: "Secret", namespace: "ingress-nginx", name: "ingress-nginx-admission", keys: ["cert", "key", "ca"], deliveryLanes: ["cubInstallerApply"] },
      ],
    },
    { category: "admission-webhook", status: "variant-controlled", object: "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||ingress-nginx-admission" },
    { category: "cluster-rbac", status: "scan-and-review", evidence: "scan receipts" },
    { category: "tpl", status: "controlled-by-empty-defaults", note: "chart has tpl extension points; promoted variants do not set those values." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||ingress-nginx" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart renders an admission Service and ValidatingWebhookConfiguration.",
      "Admission certificate create/patch Jobs are Helm hooks and are excluded from the rendered revision by --no-hooks.",
      "For live parity, the installer leg stages the admission Secret as a target fact; regular Helm continues to create it through hook execution.",
      "admission-disabled variant removes the admission Service and ValidatingWebhookConfiguration from the rendered revision.",
      "internal-clusterip variant also changes the controller Service from LoadBalancer to ClusterIP for local/internal targets.",
      "Admission webhook readiness must be observed after apply because a rendered object alone does not prove webhook health.",
    ],
    knownControlPoints: [
      "capability-profile",
      "hook-lifecycle-policy",
      "admission-webhook-observation",
      "cluster-rbac-scan",
      "tpl-extension-slot",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after admission webhook lifecycle/observation policy and cluster RBAC review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the ingress-nginx public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart render is deterministic under the pinned Kubernetes capability profile;",
      "the admission-disabled variant deliberately removes admission webhook objects;",
      "the internal-clusterip variant keeps the admission-disabled object set and fits targets without external LoadBalancer assignment;",
      "admission webhook, Helm hook lifecycle, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Admission webhook availability needs a fresh observation receipt after apply",
      "Helm admission hook jobs need explicit lifecycle policy before production",
      "Cluster-scoped RBAC needs production review",
      variant.targetFactNote,
    ],
  }),
  // Chart-specific scan rules: admission webhook observation + hook lifecycle.
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
      findings.push({
        id: `helm-hook-lifecycle-policy:${identityFor(doc)}`,
        rule: "helm-hook-lifecycle-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "Ingress admission certificate hook jobs need explicit lifecycle policy before production",
      });
    }
    return findings;
  },
  // Chart-specific verify assertions the generic kit cannot infer.
  verifyExtra({ root, controlPoints, perVariant, check, readYaml, readFileSync, join }) {
    const lifecyclePolicy = readYaml(join(root, "lifecycle-policy.yaml"));
    check(lifecyclePolicy.kind === "LifecyclePolicy", "lifecycle-policy.yaml must be a LifecyclePolicy");
    check(lifecyclePolicy.spec.bases.default?.status === "route-selected-observation-needed", "default lifecycle status mismatch");
    check(
      lifecyclePolicy.spec.bases.default?.observedFailureWhenMissingLifecycle?.includes("ingress-nginx-admission"),
      "default lifecycle failure evidence must name the admission Secret",
    );
    check(
      lifecyclePolicy.spec.bases.default?.supportedRoutes?.some((route) => route.route === "run-equivalent-webhook-cert-lifecycle"),
      "webhook cert lifecycle route missing",
    );
    check(
      lifecyclePolicy.spec.bases.default?.selectedLiveParityRoute?.includes("target fact"),
      "default lifecycle selected live parity route missing",
    );
    check(
      lifecyclePolicy.spec.bases.default?.mustObserve?.some((item) => item.includes("caBundle")),
      "webhook caBundle observation missing",
    );
    check(lifecyclePolicy.spec.bases.admissionDisabled?.status === "webhook-not-rendered", "admission-disabled lifecycle status mismatch");
    check(lifecyclePolicy.spec.bases.internalClusterIP?.status === "webhook-not-rendered", "internal-clusterip lifecycle status mismatch");
    check(lifecyclePolicy.spec.notProvenBy.includes("render parity alone"), "render parity limitation must be explicit");
    check(controlPoints.spec.points?.some((point) => point.category === "capability-profile"), "capability-profile control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "hook-policy"), "hook-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
    for (const variant of variants) {
      const { releasePath, identities, scan } = perVariant.get(variant.name);
      const docs = parseDocs(readFileSync(releasePath, "utf8"));
      check(identities.includes("apps/v1|Deployment|ingress-nginx|ingress-nginx-controller"), `${variant.name} Deployment missing`);
      check(identities.includes("networking.k8s.io/v1|IngressClass||nginx"), `${variant.name} IngressClass missing`);
      if (variant.name === "default") {
        check(identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||ingress-nginx-admission"), "default ValidatingWebhookConfiguration missing");
        check(identities.includes("v1|Service|ingress-nginx|ingress-nginx-controller-admission"), "default admission Service missing");
        const variantDoc = readYaml(join(root, "variants", "default", "variant.yaml"));
        const requiredSecret = variantDoc.spec.targetFacts?.requiredSecrets?.find((item) => item.name === "ingress-nginx-admission");
        check(requiredSecret?.deliveryLanes?.includes("cubInstallerApply"), "default admission Secret must be staged for installer live parity only");
      }
      if (variant.name === "admission-disabled") {
        check(!identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||ingress-nginx-admission"), "admission-disabled must not render ValidatingWebhookConfiguration");
        check(!identities.includes("v1|Service|ingress-nginx|ingress-nginx-controller-admission"), "admission-disabled must not render admission Service");
      }
      if (variant.name === "internal-clusterip") {
        const service = docs.find((object) => identityFor(object) === "v1|Service|ingress-nginx|ingress-nginx-controller");
        check(Boolean(service), "internal-clusterip controller Service missing");
        check(service.spec?.type === "ClusterIP", "internal-clusterip controller Service must be ClusterIP");
        check(!identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||ingress-nginx-admission"), "internal-clusterip must not render ValidatingWebhookConfiguration");
        check(!identities.includes("v1|Service|ingress-nginx|ingress-nginx-controller-admission"), "internal-clusterip must not render admission Service");
      }
      if (variant.name === "admission-disabled") {
        const service = docs.find((object) => identityFor(object) === "v1|Service|ingress-nginx|ingress-nginx-controller");
        check(Boolean(service), "admission-disabled controller Service missing");
        check(service.spec?.type === "LoadBalancer", "admission-disabled controller Service must remain LoadBalancer");
      }
      check(scan.spec.findingCounts.medium >= 2, `${variant.name} scan must flag admission/RBAC review`);
    }
  },
});
