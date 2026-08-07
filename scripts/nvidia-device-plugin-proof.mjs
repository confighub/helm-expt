// nvidia-device-plugin proof.
//
// Chart-specific declaration only. All generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs and is shared across every chart proof. The CLI surface
// is unchanged:
//   node scripts/nvidia-device-plugin-proof.mjs --generate-proof|--generate-package|
//        --verify-proof|--verify-proof-self-test|--verify-package|--compare
//
// The exact upstream artifact is pinned by environment at generate AND verify time:
//   HELM_EXPT_CHART_ARTIFACT_URL=https://nvidia.github.io/k8s-device-plugin/nvidia-device-plugin-0.19.3.tgz
//   HELM_EXPT_CHART_ARTIFACT_SHA256=8f01067500e712508fe55fe060b6f895814dc7efc1cb96323db2ce4f777f6e96

import { runProofCli } from "./lib/proof-kit.mjs";

const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "0.19.3";
const chart = {
  repository: "nvidia",
  repositoryURL: "https://nvidia.github.io/k8s-device-plugin",
  name: "nvidia-device-plugin",
  version: chartVersion,
  releaseName: "nvidia-device-plugin",
  namespace: "gpu-operator",
  kubeVersion: "1.31.0",
};

const versionExpectations = {
  "0.19.3": { defaultObjects: 5, eksInferenceObjects: 5, nfdEnabledObjects: 26 },
};
const expected = versionExpectations[chart.version];
if (!expected) throw new Error(`nvidia-device-plugin ${chart.version} needs reviewed version-specific assertions`);

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default",
    valuesFile: "effective-values.yaml",
    valuesText: `# Chart defaults. No overrides: this base audits the chart exactly as shipped.
`,
    valuesSummary: "chart defaults, subchart gate closed, safe-to-flatten verdict",
    expectedObjectCount: expected.defaultObjects,
  },
  {
    name: "eks-inference",
    base: "eks-inference",
    displayName: "eks-inference platform scheduling",
    valuesFile: "effective-values-eks-inference.yaml",
    valuesText: `# NVIDIA Kubernetes device plugin.
#
# WHY THIS COMPONENT EXISTS: the EKS-optimized AL2023 accelerated AMIs ship the
# NVIDIA driver and container toolkit but NOT the device plugin. Without it no
# node ever advertises the nvidia.com/gpu extended resource, so a pod requesting
# a GPU stays Pending forever — and Karpenter, seeing an unschedulable pod it
# cannot satisfy, will not launch a node either. The failure looks like
# "Karpenter is broken" and is nothing of the sort.
#
# It is a separate component from \`karpenter\` because the two are independently
# useful: Karpenter without this for CPU-only pools, this without Karpenter on
# managed nodegroups. It is separate from \`inference-workloads\` because it is
# platform — deleting your models must not stop GPUs being schedulable.

# The GPU NodePools taint every node they create. The plugin is a DaemonSet and
# has to run ON those nodes, so it must tolerate the taints — including the
# H200-specific one. A plugin that does not tolerate them never runs, the node
# never advertises its GPUs, and the node sits idle and expensive.
tolerations:
  - key: nvidia.com/gpu
    operator: Exists
    effect: NoSchedule
  - key: eks-inference.confighub.com/h200
    operator: Exists
    effect: NoSchedule

# Only schedule where there is actually NVIDIA hardware. Without this the
# DaemonSet lands on every node, including the arm64 system nodegroup, and
# crash-loops where there is no GPU to manage.
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: eks-inference.confighub.com/accelerator
              operator: Exists

# Fail loudly rather than quietly degrade if the driver is missing or the NVML
# library cannot be loaded — the most common symptom of an AMI/plugin mismatch.
failOnInitError: true
`,
    valuesSummary: "producer values: platform taints and labels for scheduling, failOnInitError true",
    expectedObjectCount: expected.eksInferenceObjects,
  },
  {
    name: "nfd-enabled",
    base: "nfd-enabled",
    displayName: "eks-inference plus node-feature-discovery",
    valuesFile: "effective-values-nfd-enabled.yaml",
    valuesText: `# NVIDIA Kubernetes device plugin.
#
# WHY THIS COMPONENT EXISTS: the EKS-optimized AL2023 accelerated AMIs ship the
# NVIDIA driver and container toolkit but NOT the device plugin. Without it no
# node ever advertises the nvidia.com/gpu extended resource, so a pod requesting
# a GPU stays Pending forever — and Karpenter, seeing an unschedulable pod it
# cannot satisfy, will not launch a node either. The failure looks like
# "Karpenter is broken" and is nothing of the sort.
#
# It is a separate component from \`karpenter\` because the two are independently
# useful: Karpenter without this for CPU-only pools, this without Karpenter on
# managed nodegroups. It is separate from \`inference-workloads\` because it is
# platform — deleting your models must not stop GPUs being schedulable.

# The GPU NodePools taint every node they create. The plugin is a DaemonSet and
# has to run ON those nodes, so it must tolerate the taints — including the
# H200-specific one. A plugin that does not tolerate them never runs, the node
# never advertises its GPUs, and the node sits idle and expensive.
tolerations:
  - key: nvidia.com/gpu
    operator: Exists
    effect: NoSchedule
  - key: eks-inference.confighub.com/h200
    operator: Exists
    effect: NoSchedule

# Only schedule where there is actually NVIDIA hardware. Without this the
# DaemonSet lands on every node, including the arm64 system nodegroup, and
# crash-loops where there is no GPU to manage.
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: eks-inference.confighub.com/accelerator
              operator: Exists

# Fail loudly rather than quietly degrade if the driver is missing or the NVML
# library cannot be loaded — the most common symptom of an AMI/plugin mismatch.
failOnInitError: true

# Derived for the nfd-enabled base: open the node-feature-discovery gate the
# producer leaves closed, so the subchart renders and its lifecycle behavior
# becomes part of the audited bundle.
nfd:
  enabled: true
`,
    valuesSummary: "the eks-inference values plus nfd.enabled true; renders the full node-feature-discovery stack including the visible post-delete prune set and three NodeFeature CRDs",
    expectedObjectCount: expected.nfdEnabledObjects,
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
  receiptSlug: "nvidia-device-plugin",
  scriptPrefix: "nvidia-device-plugin",
  // Hooks stay visible: the nfd-enabled base renders the node-feature-discovery
  // post-delete prune objects as part of the audited object set.
  renderFlags: ["--include-crds"],
  hookPolicy: "hooks-rendered-visible",
  // Exactly one vendored dependency: node-feature-discovery 0.17.3.
  expectedDependencyCount: 1,
  // single cub-only support object (the created Namespace)
  supportObjects: [`v1|Namespace||${chart.namespace}`],
  packageTransformers: [
    {
      description: "Set the namespace on every namespaced resource.",
      invocations: [{ name: "set-namespace", args: ["{{ .Namespace }}"] }],
      toolchain: "Kubernetes/YAML",
      whereResource: "",
    },
  ],
  valueModel: {
    checkedValues: [
      {
        path: "nfd.enabled",
        disposition: "variant-axis",
        reason: "The chart default leaves the node-feature-discovery gate closed. The nfd-enabled base opens it and the render grows from 5 to 26 objects, pulling in a post-delete cleanup Job and three NodeFeature CRDs.",
        note: "the nfd-enabled base carries the flatten-with-routes verdict, the other two bases stay safe-to-flatten",
        evidence: "Chart.yaml:5 (condition nfd.enabled,gfd.enabled), effective-values-nfd-enabled.yaml (nfd.enabled: true)",
      },
      {
        path: "gfd.enabled",
        disposition: "left-at-default",
        reason: "Second arm of the same subchart condition and the gate for the gpu-feature-discovery DaemonSet. It stays false in all three audited bases.",
        note: "opening it re-triggers the nfd-enabled routes plus a privileged GFD DaemonSet that no base here audits",
        evidence: "values.yaml:107, templates/daemonset-gfd.yml:15, Chart.yaml:5",
      },
      {
        path: "devicePlugin.enabled",
        disposition: "left-at-default",
        reason: "Gates both the main device-plugin DaemonSet and the MPS control-daemon DaemonSet. True by default and true in every base.",
        note: "both DaemonSets render in all three bases",
        evidence: "values.yaml:104, templates/daemonset-device-plugin.yml:15, templates/daemonset-mps-control-daemon.yml:14",
      },
      {
        path: "failOnInitError",
        disposition: "overridden-in-audited-bases",
        reason: "Null by chart default. The eks-inference and nfd-enabled bases set it true so the plugin fails loudly on a driver or NVML mismatch instead of degrading quietly.",
        note: "renders as the FAIL_ON_INIT_ERROR env var",
        evidence: "values.yaml:32, effective-values-eks-inference.yaml (failOnInitError: true), templates/daemonset-device-plugin.yml:142",
      },
      {
        path: "tolerations",
        disposition: "overridden-deliberately",
        reason: "The chart ships CriticalAddonsOnly plus nvidia.com/gpu tolerations. The eks-inference and nfd-enabled bases replace the whole array with nvidia.com/gpu and eks-inference.confighub.com/h200, which drops the CriticalAddonsOnly entry because Helm value arrays replace rather than merge.",
        note: "the replacement-not-merge behavior is recorded as a footgun for derived values",
        evidence: "values.yaml:86-93, effective-values-eks-inference.yaml tolerations block, revisions/eks-inference/r001/rendered/release-objects.yaml",
      },
      {
        path: "affinity",
        disposition: "overridden-deliberately",
        reason: "The chart-default nodeAffinity keys are NFD-published labels (feature.node.kubernetes.io/pci-10de.present and friends) plus the manual nvidia.com/gpu.present escape hatch. The eks-inference and nfd-enabled bases replace it with a single eks-inference.confighub.com/accelerator Exists match.",
        note: "the default base's affinity depends on labels the default base does not install",
        evidence: "values.yaml:64-85, effective-values-eks-inference.yaml affinity block, revisions/eks-inference/r001/rendered/release-objects.yaml",
      },
      {
        path: "allowDefaultNamespace",
        disposition: "left-at-default",
        reason: "False by default, and the chart hard-fails a render whose release namespace is default. It also fails outright if .Values.namespace is set. Every base renders with the namespace pinned to gpu-operator so the guard never fires.",
        note: "the render must always pass an explicit namespace",
        evidence: "values.yaml:46, templates/validation.yml:4-11 (.Values.namespace rejection) and templates/validation.yml:41-48 (Release.Namespace default guard)",
      },
      {
        path: "config.name / config.map",
        disposition: "unused-extension-slot",
        reason: "Both empty in every base, so no plugin ConfigMap renders. The validation template enforces that at most one of the two is ever set, and that a multi-entry map names a default.",
        note: "validation guards the slot in all audited bases",
        evidence: "values.yaml:20-28, templates/validation.yml:25-31, templates/configmap.yml:1",
      },
      {
        path: "image.repository / image.tag",
        disposition: "left-at-default",
        reason: "The tag is empty and falls back to the chart appVersion, so every base runs nvcr.io/nvidia/k8s-device-plugin:v0.19.3.",
        note: "single image across default and eks-inference, plus the NFD image in nfd-enabled",
        evidence: "values.yaml:49-53, revisions/eks-inference/r001/rendered/release-objects.yaml",
      },
      {
        path: "priorityClassName",
        disposition: "left-at-default",
        reason: "Defaults to system-node-critical and renders on both DaemonSets in every base.",
        note: "marks the plugin as a critical add-on",
        evidence: "values.yaml:99, templates/daemonset-device-plugin.yml:42-43",
      },
      {
        path: "mps.enableHostPID",
        disposition: "left-at-default",
        reason: "True by default, so the MPS control-daemon pod runs with hostPID: true in every base. The template swaps to shareProcessNamespace when it is false.",
        note: "a host-namespace privilege worth flagging in review even though the DaemonSet is label-gated idle on most clusters",
        evidence: "values.yaml:158, templates/daemonset-mps-control-daemon.yml:54-58",
      },
      {
        path: "runtimeClassName",
        disposition: "left-at-default",
        reason: "Null by default and unset in every base, so no runtimeClassName renders on either DaemonSet.",
        note: "clusters that expose the NVIDIA runtime through a RuntimeClass must set it or the plugin cannot reach the GPUs",
        evidence: "values.yaml:101, templates/daemonset-device-plugin.yml:44-46 (equivalent guard also in the MPS template)",
      },
      {
        path: "migStrategy",
        disposition: "left-at-default",
        reason: "Null in every base. The helpers derive whether MIG monitor devices are added from this value and from any config.map entries.",
        note: "no MIG behavior is audited here",
        evidence: "values.yaml:31, templates/_helpers.tpl:138-152",
      },
    ],
  },
  controlPoints: [
    {
      category: "source-lock",
      status: "handled",
      evidence: "source-lock.yaml",
      note: "source-lock.yaml pins the exact artifact https://nvidia.github.io/k8s-device-plugin/nvidia-device-plugin-0.19.3.tgz with sha256 8f01067500e712508fe55fe060b6f895814dc7efc1cb96323db2ce4f777f6e96, resolution artifact-addressed. The same packageSHA256 appears in all three variant-revision digest inputs. Exact-artifact pinning is env-only (HELM_EXPT_CHART_ARTIFACT_URL and HELM_EXPT_CHART_ARTIFACT_SHA256) and the same env must be exported at verify time.",
    },
    {
      category: "dependency-lock",
      status: "handled",
      evidence: "dependency-lock.yaml",
      note: "the chart carries exactly one vendored dependency, node-feature-discovery 0.17.3 (Chart.yaml:3-8, Chart.lock present in the package), gated by the condition nfd.enabled,gfd.enabled",
    },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note: "all three variants pin kubeVersion 1.31.0 with an empty apiVersions list. The chart's own floor is kubeVersion >= 1.10.0-0 (Chart.yaml:11). No Capabilities probes exist in the package.",
    },
    {
      category: "lifecycle-policy",
      status: "attention-required",
      policy: "hooks-rendered-visible",
      note: "all three variants declare hookPolicy hooks-rendered-visible and the render runs without --no-hooks. In the nfd-enabled base four hook-annotated post-delete documents render visibly (ServiceAccount, ClusterRole, ClusterRoleBinding, and Job, all named nvidia-device-plugin-node-feature-discovery-prune). The flattening verdict assigns that base a post-delete lifecycle route executed by the delivery runtime, and the route must cover all four prune objects, not just the Job.",
    },
    {
      category: "crd-policy",
      status: "split-by-base",
      note: "default and eks-inference render zero CRDs because the gate is closed. nfd-enabled renders three NodeFeature CRDs (nodefeatures, nodefeaturegroups, nodefeaturerules in nfd.k8s-sigs.io) and its verdict requires a CRD ordering declaration to ship with the bundle. Renders include CRDs in every variant via --include-crds.",
    },
    {
      category: "namespace",
      status: "handled-with-guard",
      note: "the chart creates no Namespace and every base renders into gpu-operator. templates/validation.yml hard-fails a default-namespace render unless allowDefaultNamespace=true and rejects .Values.namespace outright, so the render always needs an explicit --namespace. The installer's default supportObjects entry v1|Namespace||gpu-operator covers the missing Namespace object.",
    },
    {
      category: "credentials-secrets",
      status: "none-present",
      note: "no Secrets render in any base, generated-secrets and lookup are absent, and imagePullSecrets stays empty. expectedSecretCount is 0 for every variant.",
    },
    {
      category: "extension-slots",
      status: "open-unused",
      note: "the config.name/config.map ConfigMap slot is empty in every base so no plugin ConfigMap renders, with validation enforcing one-of. gfd.enabled and the pre-wired nfd.master/nfd.worker config blocks (values.yaml:119-145) are further closed slots that only matter when the subchart gate opens.",
    },
    {
      category: "installer-support-object",
      status: "handled",
      object: `v1|Namespace||${chart.namespace}`,
    },
  ],
  dossier: {
    maintainedNotes: [
      "Three audited bases render into namespace gpu-operator with release name nvidia-device-plugin at kubeVersion 1.31.0: default and eks-inference render 5 objects each, nfd-enabled renders 26.",
      "Chart 0.19.3 (appVersion 0.19.3) vendors one dependency, node-feature-discovery 0.17.3, behind the condition nfd.enabled,gfd.enabled; both gates are off by chart default.",
      "Every base runs nvcr.io/nvidia/k8s-device-plugin:v0.19.3; the nfd-enabled base adds registry.k8s.io/nfd/node-feature-discovery:v0.17.3.",
      "The chart's one weird thing is the MPS control-daemon DaemonSet. It renders unconditionally whenever devicePlugin.enabled is true, but pins itself to nodes labeled nvidia.com/mps.capable=true, so on most clusters it exists as a permanently zero-pod DaemonSet running with hostPID.",
      "The chart-default nodeAffinity keys are NFD-published labels, yet the default base ships no NFD; scheduling under chart defaults relies on an out-of-band NFD install or the manual nvidia.com/gpu.present=true label.",
      "The chart refuses to render into the default namespace (templates/validation.yml hard-fails unless allowDefaultNamespace=true) and rejects any .Values.namespace override outright.",
      "nfd-enabled renders four hook-annotated post-delete documents as visible objects (ServiceAccount, ClusterRole, ClusterRoleBinding, and Job, all named nvidia-device-plugin-node-feature-discovery-prune) plus three NodeFeature CRDs; default and eks-inference render no hooks and no CRDs.",
      "The witness records zero lookups, zero Capabilities probes, zero generated Secrets, zero webhooks, zero namespace creation, and zero test hooks across the whole package.",
    ],
    knownControlPoints: [
      "subchart-gate",
      "post-delete-lifecycle-route",
      "crd-ordering",
      "namespace-guard",
      "capability-profile",
      "toleration-replacement",
      "mps-node-label-gate",
    ],
    extra: {
      caveats: [
        "Opening nfd.enabled or gfd.enabled moves the base to flatten-with-routes; the bundle must then carry the post-delete lifecycle route covering all four prune hook documents plus the CRD ordering declaration, and the 5-object verdicts do not cover it.",
        "The eks-inference tolerations and affinity assume that platform's node taints and labels (eks-inference.confighub.com/h200 and eks-inference.confighub.com/accelerator); on any other cluster the DaemonSets schedule nowhere and the plugin silently protects nothing.",
        "Overriding tolerations replaces the whole array and drops the chart-default CriticalAddonsOnly toleration; deliberate in the audited bases, a footgun for derived values.",
        "runtimeClassName stays null in every base; clusters that expose the NVIDIA runtime through a RuntimeClass must set it or the plugin container cannot see the GPUs.",
        "GPU nodes are a scheduling prerequisite, not an install prerequisite; the chart installs cleanly on a GPU-less cluster and simply runs zero pods, which is why no externalRequires entry claims them.",
        "The default base's affinity depends on NFD labels it does not install; that mirrors the nvidia NFD gate caveat recorded in the verdicts.",
      ],
    },
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction:
      "flatten the default and eks-inference bundles as-is; promote the nfd-enabled bundle only with the post-delete lifecycle route covering all four prune hook documents and the CRD ordering declaration attached",
  },
  readme: {
    intro:
      "This recipe audits the NVIDIA device plugin chart at version 0.19.3. The plugin makes GPU nodes advertise the nvidia.com/gpu resource; without it a GPU pod stays Pending forever and the failure masquerades as an autoscaler bug. The default base renders the chart exactly as shipped, the eks-inference base retargets scheduling to that platform's node taints and labels and turns on failOnInitError, and the nfd-enabled base opens the node-feature-discovery gate the producer leaves closed. The chart refuses to render into the default namespace, and every base here renders into gpu-operator.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "all three renders are deterministic under the pinned Kubernetes capability profile and the exact pinned upstream artifact;",
      "the default and eks-inference bases render 5 objects each with no hooks, CRDs, Secrets, or lookups, matching their safe-to-flatten verdicts;",
      "the nfd-enabled base renders 26 objects with hooks visible, so the post-delete prune set (ServiceAccount, ClusterRole, ClusterRoleBinding, Job) and the three NodeFeature CRDs are audited objects rather than hidden Helm behavior.",
    ],
  },
  installGate: (variant) => {
    const reasons = [
      `Helm equivalence passed for ${variant.name}`,
      "Cluster-scoped RBAC needs production review",
      "GPU nodes are a scheduling prerequisite, not an install prerequisite: on a GPU-less cluster the DaemonSets simply run zero pods",
    ];
    if (variant.name === "eks-inference" || variant.name === "nfd-enabled") {
      reasons.push(
        "tolerations and affinity assume the eks-inference platform node taints and labels; on other clusters the DaemonSets schedule nowhere",
      );
    }
    if (variant.name === "nfd-enabled") {
      reasons.push(
        "flatten-with-routes verdict: the bundle must carry the post-delete lifecycle route covering all four prune hook documents and the CRD ordering declaration before promotion",
      );
    }
    return { decision: "warn", reasons };
  },
  // Chart-specific verify assertions that the generic kit cannot infer.
  verifyExtra({ controlPoints, perVariant, check }) {
    check(
      controlPoints.spec.points?.some((point) => point.category === "lifecycle-policy" && point.policy === "hooks-rendered-visible"),
      "lifecycle-policy control point missing",
    );
    check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
    for (const variant of variants) {
      const { identities } = perVariant.get(variant.name);
      check(identities.includes("apps/v1|DaemonSet|gpu-operator|nvidia-device-plugin"), `${variant.name} device-plugin DaemonSet missing`);
      check(
        identities.includes("apps/v1|DaemonSet|gpu-operator|nvidia-device-plugin-mps-control-daemon"),
        `${variant.name} MPS control-daemon DaemonSet missing`,
      );
      check(
        identities.includes("v1|ServiceAccount|gpu-operator|nvidia-device-plugin-service-account"),
        `${variant.name} ServiceAccount missing`,
      );
      const crdCount = identities.filter((identity) => identity.includes("|CustomResourceDefinition|")).length;
      if (variant.name === "nfd-enabled") {
        check(crdCount === 3, "nfd-enabled must render exactly three NodeFeature CRDs");
        for (const prune of [
          "batch/v1|Job|gpu-operator|nvidia-device-plugin-node-feature-discovery-prune",
          "v1|ServiceAccount|gpu-operator|nvidia-device-plugin-node-feature-discovery-prune",
          "rbac.authorization.k8s.io/v1|ClusterRole||nvidia-device-plugin-node-feature-discovery-prune",
          "rbac.authorization.k8s.io/v1|ClusterRoleBinding||nvidia-device-plugin-node-feature-discovery-prune",
        ]) {
          check(identities.includes(prune), `nfd-enabled post-delete prune object missing: ${prune}`);
        }
      } else {
        check(crdCount === 0, `${variant.name} must render no CRDs`);
        check(!identities.some((identity) => identity.includes("node-feature-discovery")), `${variant.name} must not render the NFD subchart`);
      }
    }
  },
});
