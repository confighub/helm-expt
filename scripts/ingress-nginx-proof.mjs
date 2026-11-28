// ingress-nginx proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged:
//   node scripts/ingress-nginx-proof.mjs --generate-proof|--generate-package|
//        --verify-proof|--verify-proof-self-test|--verify-package|--compare

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor, parseDocs } from "./lib/proof-common.mjs";

// 4.15.1 is the last ingress-nginx chart version: the upstream repository is
// archived. Its published default base cannot start the controller under
// ConfigHub, so it is corrected as package revision 1, 4.15.1-r1, published
// beside it. HELM_EXPT_PACKAGE_REVISION=1 builds and checks the revision; unset,
// this declaration builds and checks 4.15.1 as it was published.
const packageRevision = Number(process.env.HELM_EXPT_PACKAGE_REVISION ?? "0");
if (packageRevision) {
  // The revision is rendered from the exact archive the published 4.15.1 locked.
  process.env.HELM_EXPT_CHART_ARTIFACT_URL ??=
    "https://github.com/kubernetes/ingress-nginx/releases/download/helm-chart-4.15.1/ingress-nginx-4.15.1.tgz";
  process.env.HELM_EXPT_CHART_ARTIFACT_SHA256 ??= "3eff0bd18151d6e6b1c441463410571443dda1ac78292cb189346628de784f0c";
  process.env.HELM_EXPT_PROOF_COMMANDS ??= ["--generate-proof", "--generate-package", "--verify-proof", "--verify-package"]
    .map((flag) => `HELM_EXPT_PACKAGE_REVISION=${packageRevision} node scripts/ingress-nginx-proof.mjs ${flag}`)
    .join("\n");
}

// The controller mounts the Secret ingress-nginx-admission, which the chart
// creates with two Helm hook Jobs: one creates the certificate Secret, the
// other writes its CA into the ValidatingWebhookConfiguration. A render without
// hooks drops them, and ConfigHub never uploads a rendered Secret, so the
// controller waits for the Secret forever. From revision 1 the default base
// keeps the Jobs and their RBAC, with three changes made by the base's
// kustomization: the RBAC objects lose their hook annotations and become
// ordinary resources; the Jobs become Argo CD Sync hooks, so they run on every
// sync without waiting for the controller's LoadBalancer Service to be healthy,
// which on a cluster without load balancers it never is; and the Jobs lose
// ttlSecondsAfterFinished: 0, so a tool that applies them as ordinary Jobs does
// not see them vanish and run them again.
const keepsAdmissionJobs = packageRevision >= 1;
const admissionRBACKinds = ["ServiceAccount", "Role", "RoleBinding", "ClusterRole", "ClusterRoleBinding"];
const admissionJobs = ["ingress-nginx-admission-create", "ingress-nginx-admission-patch"];
const admissionBasePatches = [
  {
    target: { kind: `(${admissionRBACKinds.join("|")})`, name: "ingress-nginx-admission" },
    patch: `- op: remove
  path: /metadata/annotations/helm.sh~1hook
- op: remove
  path: /metadata/annotations/helm.sh~1hook-delete-policy
`,
  },
  {
    target: { kind: "Job", name: `(${admissionJobs.join("|")})` },
    patch: `- op: remove
  path: /metadata/annotations/helm.sh~1hook
- op: remove
  path: /metadata/annotations/helm.sh~1hook-delete-policy
- op: add
  path: /metadata/annotations/argocd.argoproj.io~1hook
  value: Sync
- op: add
  path: /metadata/annotations/argocd.argoproj.io~1hook-delete-policy
  value: BeforeHookCreation
- op: remove
  path: /spec/ttlSecondsAfterFinished
`,
  },
];

// What the default base's kustomization changes in an admission hook object,
// applied to the Helm render, so a cub render can be checked against it.
function patchedAdmissionObject(object) {
  const copy = structuredClone(object);
  const annotations = { ...(copy.metadata?.annotations ?? {}) };
  delete annotations["helm.sh/hook"];
  delete annotations["helm.sh/hook-delete-policy"];
  if (copy.kind === "Job") {
    annotations["argocd.argoproj.io/hook"] = "Sync";
    annotations["argocd.argoproj.io/hook-delete-policy"] = "BeforeHookCreation";
    delete copy.spec.ttlSecondsAfterFinished;
  }
  if (Object.keys(annotations).length) copy.metadata.annotations = annotations;
  else delete copy.metadata.annotations;
  return copy;
}

function isAdmissionHookObject(object) {
  return (
    (admissionRBACKinds.includes(object.kind) && object.metadata?.name === "ingress-nginx-admission") ||
    (object.kind === "Job" && admissionJobs.includes(object.metadata?.name))
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

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
    ...(keepsAdmissionJobs
      ? {
          renderFlags: ["--include-crds", "--skip-tests"],
          hookPolicy: "keep-admission-jobs-as-argo-sync-hooks",
          expectedObjectCount: 18,
          basePatches: admissionBasePatches,
          targetFactNote:
            "keeps the admission webhook objects and the chart's certificate Jobs, which create the admission Secret and patch the webhook's CA in the cluster; Argo CD runs the Jobs as Sync hooks",
        }
      : {
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
        }),
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
      name: packageRevision ? `ingress-nginx-ingress-nginx-4.15.1-r${packageRevision}` : "ingress-nginx-ingress-nginx-4.15.1",
      chart: "ingress-nginx/ingress-nginx",
      version: chart.version,
      ...(packageRevision ? { packageRevision } : {}),
    },
    spec: {
      summary: keepsAdmissionJobs
        ? "The default ingress-nginx base keeps the admission webhook objects and the Helm hook Jobs that create and patch the webhook certificate. Argo CD runs the Jobs as Sync hooks. Production use still needs a fresh observation receipt."
        : "The default ingress-nginx base preserves the admission webhook objects rendered by Helm, but Helm hook Jobs that create and patch the webhook certificate are not part of the rendered object set. Production use needs an explicit lifecycle route and fresh observation receipt.",
      bases: {
        default: {
          ...(keepsAdmissionJobs
            ? {
                status: "certificate-jobs-kept-observation-needed",
                selectedLiveParityRoute:
                  "The default base keeps the chart's create and patch Jobs. Argo CD runs them as Sync hooks on every sync; a tool that applies them as ordinary Jobs runs them once.",
                renderedObjects: [
                  "v1|Service|ingress-nginx|ingress-nginx-controller-admission",
                  "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||ingress-nginx-admission",
                  "batch/v1|Job|ingress-nginx|ingress-nginx-admission-create",
                  "batch/v1|Job|ingress-nginx|ingress-nginx-admission-patch",
                ],
                omittedHelmHookObjects: [],
              }
            : {
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
              }),
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
  packageRevision,
  ...(packageRevision
    ? {
        packageReadme: ({ ctx }) => `# ${ctx.chartRef} ${ctx.chart.version} Installer Package

Package revision ${packageRevision} of ingress-nginx ${ctx.chart.chartVersion}, the last chart version upstream
published. It corrects the default base of the ${ctx.chart.chartVersion} package, which left out
the chart's admission certificate Jobs, so the controller waited for a Secret
nothing created. This default base keeps them as Argo CD Sync hooks. The
admission-disabled and internal-clusterip bases are unchanged.

Install it by naming the revision:

\`\`\`sh
cub package install ingress-nginx:v${ctx.chart.version} --space <space> --namespace ingress-nginx
\`\`\`

It is generated from the ingress-nginx proof artifacts:

\`\`\`sh
${process.env.HELM_EXPT_PROOF_COMMANDS}
\`\`\`
`,
      }
    : {}),
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
    ...(keepsAdmissionJobs
      ? [
          {
            category: "hook-policy",
            status: "variant-controlled",
            policy: "keep-admission-jobs-as-argo-sync-hooks",
            note: "the default base keeps the admission certificate Jobs and their RBAC; its kustomization makes the RBAC ordinary resources and the Jobs Argo CD Sync hooks. admission-disabled and internal-clusterip render without hooks.",
          },
          {
            category: "package-base-patch",
            status: "reviewed",
            evidence: "bases/default/kustomization.yaml in the package",
            note: "the only differences from the Helm render are the hook annotations and ttlSecondsAfterFinished of the seven admission hook objects; the package check compares every other field with Helm.",
          },
          {
            category: "target-facts",
            status: "not-required",
            note: "the default base's create Job makes the admission Secret in the cluster, so nothing is staged before sync.",
          },
        ]
      : [
          { category: "hook-policy", status: "handled-for-render", policy: "no-hooks", note: "admission patch Jobs are Helm hooks and are excluded from the render proof; lifecycle policy must handle them before production." },
          {
            category: "target-facts",
            status: "required-for-default-live-parity",
            evidence: "variants/default/variant.yaml",
            required: [
              { kind: "Secret", namespace: "ingress-nginx", name: "ingress-nginx-admission", keys: ["cert", "key", "ca"], deliveryLanes: ["cubInstallerApply"] },
            ],
          },
        ]),
    { category: "admission-webhook", status: "variant-controlled", object: "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||ingress-nginx-admission" },
    { category: "cluster-rbac", status: "scan-and-review", evidence: "scan receipts" },
    { category: "tpl", status: "controlled-by-empty-defaults", note: "chart has tpl extension points; promoted variants do not set those values." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||ingress-nginx" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart renders an admission Service and ValidatingWebhookConfiguration.",
      ...(keepsAdmissionJobs
        ? [
            "The default base keeps the admission certificate create/patch Jobs, which Argo CD runs as Sync hooks; the published 4.15.1 left them out, and its controller waited for the Secret they create.",
            "The default base's kustomization makes the Jobs' RBAC ordinary resources and removes ttlSecondsAfterFinished from the Jobs; nothing else differs from the Helm render.",
          ]
        : [
            "Admission certificate create/patch Jobs are Helm hooks and are excluded from the rendered revision by --no-hooks.",
            "For live parity, the installer leg stages the admission Secret as a target fact; regular Helm continues to create it through hook execution.",
          ]),
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
      ...(keepsAdmissionJobs
        ? ["the default base keeps the admission certificate Jobs, and differs from Helm only where its kustomization says;"]
        : []),
      "admission webhook, Helm hook lifecycle, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  // The default base's kustomization changes only the admission hook objects'
  // hook annotations and ttlSecondsAfterFinished; any other difference fails.
  allowedSemanticDiff: ({ helmObjectJson, cubObjectJson, variant }) => {
    if (!variant.basePatches?.length) return false;
    const helm = JSON.parse(helmObjectJson);
    if (!isAdmissionHookObject(helm)) return false;
    return canonicalJson(patchedAdmissionObject(helm)) === canonicalJson(JSON.parse(cubObjectJson));
  },
  extraEquivalenceClassifications: (variant) =>
    variant.basePatches?.length
      ? [
          ...admissionRBACKinds.map((kind) => ({
            identity: `${kind === "ServiceAccount" ? "v1" : "rbac.authorization.k8s.io/v1"}|${kind}|${kind.startsWith("Cluster") ? "" : "ingress-nginx"}|ingress-nginx-admission`,
            classification: "package-base-patch",
            disposition: "allowed",
            change: "hook annotations removed; an ordinary resource",
          })),
          ...admissionJobs.map((name) => ({
            identity: `batch/v1|Job|ingress-nginx|${name}`,
            classification: "package-base-patch",
            disposition: "allowed",
            change: "Helm hook annotations replaced by an Argo CD Sync hook; ttlSecondsAfterFinished removed",
          })),
        ]
      : [],
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Admission webhook availability needs a fresh observation receipt after apply",
      keepsAdmissionJobs
        ? "Admission certificate Jobs run as Argo CD Sync hooks; the webhook caBundle needs observation after apply"
        : "Helm admission hook jobs need explicit lifecycle policy before production",
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
    check(
      lifecyclePolicy.spec.bases.default?.status ===
        (keepsAdmissionJobs ? "certificate-jobs-kept-observation-needed" : "route-selected-observation-needed"),
      "default lifecycle status mismatch",
    );
    check(
      lifecyclePolicy.spec.bases.default?.observedFailureWhenMissingLifecycle?.includes("ingress-nginx-admission"),
      "default lifecycle failure evidence must name the admission Secret",
    );
    check(
      lifecyclePolicy.spec.bases.default?.supportedRoutes?.some((route) => route.route === "run-equivalent-webhook-cert-lifecycle"),
      "webhook cert lifecycle route missing",
    );
    check(
      lifecyclePolicy.spec.bases.default?.selectedLiveParityRoute?.includes(keepsAdmissionJobs ? "Sync hooks" : "target fact"),
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
        if (keepsAdmissionJobs) {
          for (const name of admissionJobs) check(identities.includes(`batch/v1|Job|ingress-nginx|${name}`), `default must keep the ${name} Job`);
          check(!variantDoc.spec.targetFacts, "default must not require the admission Secret: its Jobs create it");
          const hookObjects = docs.filter((doc) => isAdmissionHookObject(doc));
          check(hookObjects.length === 7, `default must render the 7 admission hook objects; found ${hookObjects.length}`);
        } else {
          const requiredSecret = variantDoc.spec.targetFacts?.requiredSecrets?.find((item) => item.name === "ingress-nginx-admission");
          check(requiredSecret?.deliveryLanes?.includes("cubInstallerApply"), "default admission Secret must be staged for installer live parity only");
        }
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
