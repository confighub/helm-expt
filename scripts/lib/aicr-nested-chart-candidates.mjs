// The candidate table for the charts the retained AICR EKS training entries pin
// (scripts/lib/aicr-nested-charts-coverage.mjs). scripts/aicr-nested-charts-proof.mjs
// runs it through the generic declaration in scripts/nvidia-gpu-stack-proof.mjs,
// and scripts/generate-gpu-operator-packaged-lifecycle.mjs reads the lifecycle
// profiles at the end of this file for the three charts that render Helm hooks.
//
// Every chart version has a `default` base and one AICR base for each retained
// AICR entry that pins that exact version, rendered from the bytes of that
// entry's argocd-helm-bundle/NNN-<component>/values.yaml:
//
//   aicr-eks-training           one AICR entry pins the version, or both do with
//                               the same values bytes
//   aicr-eks-training-v0-20-0   both entries pin the version with different
//   aicr-eks-training-v1-0-0    values; one base for each
//
// The release name and namespace of every base are the ones the AICR
// Application uses (Argo CD names the Helm release after the Application), so an
// AICR base is the render AICR asks for and the bases of a version differ only
// by values. Where the AICR v0.20.0 entry retains a nested render of the
// component, the base is compared with it object for object, once the Helm hook
// objects the nested render also holds are set aside. The AICR v1.0.0 entry
// retains no nested render, so its bases are bound to the bundle's checksum list
// and its Application pin and are not compared with an AICR render.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./proof-common.mjs";

const deliveryLanes = ["regularHelm", "cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"];
const scriptPrefix = "aicr-nested-charts-coverage";
const nextAction = "publish and sign the package, then complete target-specific live qualification before production";

// The Prometheus Operator CRDs a base needs on the target come from the newest
// kube-prometheus-stack render the Catalog holds.
const prometheusOperatorCRDSource = {
  sourcePath: "../../../prometheus-community/kube-prometheus-stack/88.6.3/revisions/default/r001/rendered/release-objects.yaml",
  sourceVariant: "prometheus-community/kube-prometheus-stack@88.6.3/default",
};

const AICR_ENTRIES = {
  "v0.20.0": { release: "v0.20.0", directory: "eks-h100-training-kubeflow-v0-20-0", nestedRender: true },
  "v1.0.0": { release: "v1.0.0", directory: "eks-h100-training-kubeflow-v1-0-0", nestedRender: false },
};

// One AICR entry's claim on a chart: where its values, checksum list, Application
// and (for v0.20.0) nested-render receipt are. `nestedHookObjects` is the number
// of Helm hook objects the nested render holds; a base holds none of them.
function aicrBinding(release, component, application, { nestedHookObjects = 0, targetRevision } = {}) {
  const entry = AICR_ENTRIES[release];
  const root = `examples/aicr/${entry.directory}`;
  return {
    release,
    valuesPath: `${root}/argocd-helm-bundle/${component}/values.yaml`,
    nestedRenderReceiptPath: entry.nestedRender ? `${root}/nested-renders/${application}/receipt.yaml` : null,
    bundleChecksumsPath: `${root}/argocd-helm-bundle/checksums.txt`,
    bundleChecksumsEntry: `${component}/values.yaml`,
    applicationTemplatePath: `${root}/argocd-helm-bundle/templates/${application}.yaml`,
    ...(entry.nestedRender ? { nestedHookObjects } : {}),
    ...(targetRevision ? { targetRevision } : {}),
  };
}

const valuesOf = (binding) => readFileSync(join(repoRoot, binding.valuesPath), "utf8");

const comparedSentence = (binding) =>
  binding.nestedRenderReceiptPath
    ? `Its objects equal the AICR ${binding.release} nested render of the same archive, object for object${binding.nestedHookObjects ? `, once the ${binding.nestedHookObjects} Helm hook objects that render also holds are set aside` : ""}.`
    : `The AICR ${binding.release} entry retains these values and no render of this component, so this base is bound to the bundle's checksum list and its Application pin and is not compared with an AICR render.`;

// An AICR base. `bindings` is one binding, or two when both entries carry the
// same bytes. `what` says in a clause what the values do.
function aicrBase({ name, bindings, what, ...rest }) {
  const list = [bindings].flat();
  const valuesText = valuesOf(list[0]);
  for (const other of list.slice(1)) {
    if (valuesOf(other) !== valuesText) throw new Error(`${name}: ${other.valuesPath} differs from ${list[0].valuesPath}, so they need separate bases`);
  }
  const releases = list.map((binding) => `AICR ${binding.release}`).join(" and ");
  return {
    name,
    displayName: `${releases} EKS training values`,
    valuesText,
    valuesSummary: `the values the ${releases} EKS training ${list.length === 1 ? "entry supplies" : "entries supply"} (${list.map((binding) => binding.valuesPath).join(" and ")}): ${what}`,
    removedFromDefault: [],
    addedToDefault: [],
    changesNothingElse: false,
    aicr: list.length === 1 ? list[0] : list,
    aicrNote: list.map(comparedSentence).join(" "),
    ...rest,
  };
}

const ownCRDs = (names, purpose) => (baseName) =>
  names.map((name) => ({ name, sourceVariant: baseName, purpose, deliveryLanes, applyMode: "server-side" }));

const baseNote = (base) => `The ${base.name} base renders ${base.objects} objects with ${base.valuesSummary}. ${base.aicrNote ?? ""}`.trim();

// ---------------------------------------------------------------------------
// kai-scheduler
// ---------------------------------------------------------------------------

const kaiCRDs = [
  "bindrequests.scheduling.run.ai",
  "configs.kai.scheduler",
  "podgroups.scheduling.run.ai",
  "queues.scheduling.run.ai",
  "schedulingshards.kai.scheduler",
  "topologies.kai.scheduler",
];
const kaiQuestion =
  "The kai-config object that tells the operator which scheduler services to run is delivered by a Helm hook, and no base holds it, so should it be part of the base instead of a lifecycle action that nothing runs automatically?";
const kaiVersions = {
  "v0.14.1": {
    hooks: { "pre-install,pre-upgrade": 10, "post-delete": 4 },
    aicrHooks: { "pre-install,pre-upgrade": 10 },
    aicr: aicrBinding("v0.20.0", "011-kai-scheduler", "kai-scheduler", { nestedHookObjects: 10 }),
    aicrWhat: "every pod tolerating every taint, no runtime class set on GPU pods by the admission service, and the post-delete cleanup hook off",
    configDelivery:
      "The kai.scheduler/v1 Config object named kai-config is itself a pre-install and pre-upgrade hook object.",
  },
  "v0.16.9": {
    hooks: { "pre-install,pre-upgrade": 9, "post-install,post-upgrade": 5, "post-delete": 4 },
    aicrHooks: { "pre-install,pre-upgrade": 9, "post-install,post-upgrade": 5 },
    aicr: aicrBinding("v1.0.0", "011-kai-scheduler", "kai-scheduler"),
    aicrWhat: "the default queues named, every pod selected onto the system-worker node group and tolerating every taint, and the post-delete cleanup hook off",
    configDelivery:
      "The kai.scheduler/v1 Config object named kai-config is not a chart object at all in this version: a post-install and post-upgrade hook Job applies it with kubectl from a hook ConfigMap.",
  },
};
function kaiExpectations(version) {
  const row = kaiVersions[version];
  return {
    objects: 37,
    crds: kaiCRDs,
    dependencies: 0,
    hooks: row.hooks,
    openQuestions: [{ bases: ["default", "aicr-eks-training"], question: kaiQuestion }],
    configDelivery: row.configDelivery,
    bases: [
      aicrBase({
        name: "aicr-eks-training",
        bindings: row.aicr,
        what: row.aicrWhat,
        objects: 37,
        hooks: row.aicrHooks,
      }),
    ],
  };
}
const kaiHookSentence = (hooks) =>
  Object.entries(hooks)
    .map(([phase, count]) => `${count} ${phase.replace(",", " and ")}`)
    .join(", ");

const kaiScheduler = {
  repository: "kai-scheduler",
  repositoryURL: "oci://ghcr.io/kai-scheduler/kai-scheduler",
  name: "kai-scheduler",
  releaseName: "kai-scheduler",
  namespace: "kai-scheduler",
  scriptPrefix,
  nextAction,
  // The base already holds a Namespace object, kai-resource-reservation, and the
  // installer then adds none for the release namespace.
  supportObjects: [],
  versions: Object.fromEntries(Object.keys(kaiVersions).map((version) => [version, kaiExpectations(version)])),
  extraBases: (version, expected) => expected.bases,
  lifecycle: {
    root: "prerequisites/kai-scheduler-lifecycle",
    extras: "config-catalog/package-extras/kai-scheduler/kai-scheduler",
    note: (expected) =>
      `the bases are rendered with --no-hooks; the default base's values also render ${kaiHookSentence(expected.hooks)} Helm hook objects, and the aicr-eks-training base's values render ${kaiHookSentence(expected.bases[0].hooks)}. They are packaged under prerequisites/kai-scheduler-lifecycle with a lifecycle-actions.yaml record, and nothing runs them automatically. ${expected.configDelivery} Without it the operator starts and deploys no scheduler. No hook has been run on a cluster for this entry.`,
  },
  describe:
    "KAI Scheduler is a Kubernetes scheduler for GPU workloads. The chart installs the kai-operator, six CRDs, four PriorityClasses, two default Queues and a default SchedulingShard; the operator then deploys the scheduler services that a Config object names.",
  requiredCRDs: ownCRDs(
    kaiCRDs,
    "CRD included in this base; it must be established before Kubernetes accepts the rendered Queue and SchedulingShard objects and before the operator starts",
  ),
  targetFactNote:
    "the six CRDs must be established before the two Queue objects, the SchedulingShard and the operator; the kai-scheduler namespace must already exist, because the package creates only kai-resource-reservation; the Config object the operator needs is a packaged lifecycle action and is not part of the base",
  valueModel: [
    {
      path: "<Helm hooks>",
      disposition: "left-at-default",
      reason:
        "The chart delivers the kai-config Config object, a CRD upgrader Job and a topology migration Job through pre-install and pre-upgrade hooks, and from v0.16.9 applies the Config from a post-install hook Job. None is in a base.",
      note: "packaged as recorded lifecycle actions; the operator deploys no scheduler until the Config exists",
      evidence: "templates/kai-config.yaml, templates/hooks/pre, templates/hooks/post",
    },
    {
      path: "postCleanup.enabled",
      disposition: "variant-axis",
      reason: "True by chart default, which renders a post-delete cleanup Job with its ServiceAccount, ClusterRole and ClusterRoleBinding. The AICR values set it false.",
      note: "the aicr-eks-training base has no post-delete lifecycle action",
      evidence: "templates/hooks/post/post-delete-job.yaml, templates/rbac/post-delete-clusterrole.yaml",
    },
    {
      path: "<lookup results>",
      disposition: "default-render-captured",
      reason:
        "The chart asks the cluster whether the kai-resource-reservation Namespace and its ServiceAccount already exist and renders them only when they do not, and asks whether the cluster is OpenShift. An offline render answers no to all three, so the base holds the Namespace and the ServiceAccount and no OpenShift SecurityContextConstraints.",
      note: "a base rendered offline is the fresh-install, non-OpenShift render",
      evidence: "templates/services/resourcereservation-namespace.yaml, templates/services/resourcereservation-serviceaccount.yaml, templates/rbac/scc.yaml",
    },
    {
      path: "global.clusterAutoscaling",
      disposition: "left-at-default",
      reason: "False by chart default and in every base, so the scaling-pod Namespace does not render.",
      evidence: "templates/services/scalingpod-namespace.yaml",
    },
  ],
  notes: (version, expected) => [
    `With chart defaults kai-scheduler@${version} renders ${expected.objects} objects as release kai-scheduler in namespace kai-scheduler: six CRDs, ten ClusterRoles, nine ClusterRoleBindings, four PriorityClasses, the kai-operator Deployment and ServiceAccount, a second Namespace named kai-resource-reservation with a ServiceAccount and RoleBinding in it, two Queue objects and one SchedulingShard. It renders no Secret and no webhook configuration.`,
    `The same values also render Helm hook objects that no base holds: ${kaiHookSentence(expected.hooks)}. ${expected.configDelivery} The hook objects are packaged under prerequisites/kai-scheduler-lifecycle with a lifecycle-actions.yaml record. Nothing runs them automatically and none has been run on a cluster.`,
    ...expected.bases.map(baseNote),
    "The installer package adds no Namespace object for the release namespace, because the base already holds one, kai-resource-reservation. The kai-scheduler namespace must exist on the target before the base is applied.",
    "The Namespace, the two Queue objects and the SchedulingShard carry helm.sh/resource-policy: keep, so helm uninstall leaves them. A flattened copy has no such memory; deleting the delivered objects deletes them.",
    "The chart uses lookup three ways. It renders the kai-resource-reservation Namespace and ServiceAccount only when the cluster does not already have them, and it adds OpenShift settings when the cluster has the ClusterVersion CRD. The bases are the offline answers: Namespace and ServiceAccount present, no OpenShift settings.",
  ],
  caveats: [
    "A base alone installs the operator and deploys no scheduler. The Config object that names the services to run is in the packaged lifecycle files, and a person or a delivery workflow has to apply it.",
    "The operator, not this chart, creates the scheduler, binder, admission and other Deployments at run time, with their webhooks. None of those objects is in any base and none was observed.",
    "On OpenShift the chart renders different objects. These bases are not the OpenShift render.",
    "The hook Job images are the tags the chart renders. They are not pinned by digest here.",
  ],
};

// ---------------------------------------------------------------------------
// nodewright
// ---------------------------------------------------------------------------

const nodewrightVersions = {
  "v0.17.1": {
    namespace: "skyhook",
    objects: 18,
    crds: ["deploymentpolicies.skyhook.nvidia.com", "skyhooks.skyhook.nvidia.com"],
    aicr: aicrBinding("v0.20.0", "005-nodewright-operator", "nodewright-operator", { nestedHookObjects: 6 }),
    aicrWhat:
      "the full name overridden to skyhook-operator, the manager given CPU and memory requests and limits and tolerating every taint, and the namespace LimitRange defaults set",
    keepNote: "No object carries a keep annotation.",
  },
  "v0.19.0": {
    namespace: "nodewright",
    objects: 20,
    crds: [
      "deploymentpolicies.nodewright.nvidia.com",
      "deploymentpolicies.skyhook.nvidia.com",
      "nodewrights.nodewright.nvidia.com",
      "skyhooks.skyhook.nvidia.com",
    ],
    aicr: aicrBinding("v1.0.0", "005-nodewright-operator", "nodewright-operator"),
    aicrWhat:
      "the full name overridden to skyhook-operator, the manager given CPU and memory requests and limits, selected onto the system-worker node group and tolerating every taint, and the namespace LimitRange defaults set",
    keepNote:
      "The two nodewright.nvidia.com CRDs carry helm.sh/resource-policy: keep, so helm uninstall leaves them and the custom resources they hold. A flattened copy has no such memory; deleting the delivered objects deletes those CRDs and every Nodewright object with them.",
  },
};
const nodewrightHooks = { "pre-upgrade": 4, "pre-delete": 2 };
function nodewrightExpectations(version) {
  const row = nodewrightVersions[version];
  return {
    namespace: row.namespace,
    objects: row.objects,
    crds: row.crds,
    dependencies: 0,
    hooks: nodewrightHooks,
    keepNote: row.keepNote,
    bases: [
      aicrBase({
        name: "aicr-eks-training",
        bindings: row.aicr,
        what: row.aicrWhat,
        objects: row.objects,
        hooks: nodewrightHooks,
        // fullnameOverride renames most objects, so the base is not described as a delta of the default base.
        compareWithDefault: false,
        deltaNote:
          "the AICR values set fullnameOverride, which renames most objects, so this base is not described as objects added to or removed from the default base; it has the same number of objects and the same CRDs",
      }),
    ],
  };
}

const nodewright = {
  repository: "nvidia",
  repositoryURL: "oci://ghcr.io/nvidia/nodewright/charts",
  name: "nodewright",
  releaseName: "nodewright-operator",
  namespace: "nodewright",
  scriptPrefix,
  nextAction,
  versions: Object.fromEntries(Object.keys(nodewrightVersions).map((version) => [version, nodewrightExpectations(version)])),
  extraBases: (version, expected) => expected.bases,
  lifecycle: {
    root: "prerequisites/nodewright-lifecycle",
    extras: "config-catalog/package-extras/nvidia/nodewright",
    note: () =>
      "the bases are rendered with --no-hooks; every base's values also render 4 pre-upgrade and 2 pre-delete Helm hook objects. They are packaged under prerequisites/nodewright-lifecycle with a lifecycle-actions.yaml record, and nothing runs them automatically. No hook has been run on a cluster for this entry.",
  },
  describe:
    "NodeWright, formerly Skyhook, is an NVIDIA operator that applies packages and configuration to cluster nodes from custom resources. The chart installs the operator, its CRDs, RBAC, two Services, a mutating and a validating webhook configuration, a NetworkPolicy, a LimitRange and a PodDisruptionBudget.",
  requiredCRDs: (baseName, version) =>
    ownCRDs(nodewrightVersions[version].crds, "CRD included in this base and applied before the operator that reconciles it")(baseName),
  targetFactNote:
    "the CRDs must be established before the operator starts; the operator mints its own webhook certificate at run time, and until it has, the webhook configurations reject writes to its custom resources; the pre-upgrade and pre-delete hook objects are packaged lifecycle actions, not part of the base",
  valueModel: [
    {
      path: "webhook.enable",
      disposition: "left-at-default",
      reason:
        "True by chart default and in every base. It renders a MutatingWebhookConfiguration and a ValidatingWebhookConfiguration with failurePolicy Fail and no CA bundle, and a pre-delete Job that removes them.",
      note: "the operator creates the certificate Secret and fills in the CA bundle at run time; nothing is generated at render time",
      evidence: "templates/mutating-webhook.yaml, templates/validating-webhook.yaml, templates/deployment.yaml, templates/cleanup-webhook-job.yaml",
    },
    {
      path: "fullnameOverride",
      disposition: "variant-axis",
      reason: "Empty by chart default. The AICR values set it to skyhook-operator, which renames most objects.",
      note: "the aicr-eks-training base keeps the object names AICR's nodewright-customizations component expects",
      evidence: "templates/_helpers.tpl",
    },
    {
      path: "<Helm hooks>",
      disposition: "left-at-default",
      reason:
        "Every base's values render a pre-upgrade Job that deletes the operator Deployment when its immutable selector would change, with a ServiceAccount, Role and RoleBinding, and two pre-delete Jobs: one deletes every custom resource of the operator's kinds and one removes the webhook configurations and the certificate Secret.",
      note: "packaged as recorded lifecycle actions, none automatic and none run",
      evidence: "templates/selector-migration-job.yaml, templates/cleanup-skyhooks-job.yaml, templates/cleanup-webhook-job.yaml",
    },
  ],
  notes: (version, expected) => [
    `With chart defaults nodewright@${version} renders ${expected.objects} objects as release nodewright-operator in namespace ${expected.namespace}, the release name and namespace the AICR entry that pins this version uses: ${expected.crds.length} CRDs from the chart's templates directory, the controller-manager Deployment, its ServiceAccount and RBAC, a metrics Service and a webhook Service, a MutatingWebhookConfiguration and a ValidatingWebhookConfiguration, a NetworkPolicy, a LimitRange and a PodDisruptionBudget. It renders no Secret.`,
    "The same values also render six Helm hook objects that no base holds: four pre-upgrade (the selector-migration Job with its ServiceAccount, Role and RoleBinding) and two pre-delete Jobs. They are packaged under prerequisites/nodewright-lifecycle with a lifecycle-actions.yaml record. Nothing runs them automatically and none has been run on a cluster.",
    ...expected.bases.map(baseNote),
    "The webhook configurations carry no CA bundle. The operator mints a self-signed serving certificate at run time, stores it in a Secret named webhook-cert and writes the CA into both configurations. That Secret is not in any base.",
    expected.keepNote,
    "The PodDisruptionBudget carries no metadata.namespace, because the chart template leaves it to Helm. A flattened copy must be applied into the release namespace.",
    "The chart contains no lookup, no .Capabilities branch, no generated credential and no subchart.",
  ],
  caveats: [
    "Installing the operator changes no node. A node is changed only when a Skyhook or Nodewright custom resource names packages for it, and none is part of this entry.",
    "The webhooks have failurePolicy Fail. Until the operator is running and has written its CA bundle, the API server rejects writes to the operator's custom resources.",
    "The pre-delete hook that deletes every custom resource of the operator's kinds exists so finalizers are released while the operator still runs. A flattened delete that skips it can leave custom resources stuck on their finalizers.",
    "The hook Jobs use a public kubectl image by tag. It is not pinned by digest here.",
    "The AICR entries install a second component, nodewright-customizations, that creates the custom resources. It is AICR's own chart and is not part of this entry.",
  ],
};

// ---------------------------------------------------------------------------
// dra-driver-nvidia-gpu
// ---------------------------------------------------------------------------

const draCRDs = ["computedomaincliques.resource.nvidia.com", "computedomains.resource.nvidia.com"];
const draDefaultQuestion =
  "The chart refuses to render its own defaults, so the default base sets resources.gpus.enabled false: is that the right meaning of default for this entry, or should the entry have no default base?";
const draApiQuestion =
  "The DeviceClass objects are rendered as resource.k8s.io/v1, which Kubernetes serves from 1.34, although the chart accepts 1.32: does the Catalog need bases for clusters that serve only v1beta1 or v1beta2?";
const draVersions = {
  "0.4.1": {
    aicr: aicrBinding("v0.20.0", "014-nvidia-dra-driver-gpu", "nvidia-dra-driver-gpu"),
    gpuOperator: "v26.3.3",
  },
  "0.5.0": {
    aicr: aicrBinding("v1.0.0", "014-nvidia-dra-driver-gpu", "nvidia-dra-driver-gpu"),
    gpuOperator: "v26.7.1",
  },
};
function draExpectations(version) {
  const row = draVersions[version];
  return {
    objects: 21,
    crds: draCRDs,
    dependencies: 0,
    defaultBase: {
      displayName: "GPU allocation off, because the chart refuses to render its own defaults",
      valuesText: "resources:\n  gpus:\n    enabled: false\n",
      valuesSummary:
        "chart defaults with resources.gpus.enabled false; the chart's own defaults do not render, because the chart refuses resources.gpus.enabled true unless gpuResourcesEnabledOverride is also set",
    },
    openQuestions: [
      { bases: ["default"], question: draDefaultQuestion },
      { bases: ["default", "gpu-resources", "aicr-eks-training"], question: draApiQuestion },
    ],
    bases: [
      {
        name: "gpu-resources",
        displayName: "GPU allocation through DRA, for nodes without the standard GPU device plugin",
        valuesText: "gpuResourcesEnabledOverride: true\n",
        valuesSummary:
          "chart defaults with gpuResourcesEnabledOverride true, which the chart requires before it will render resources.gpus.enabled true; the chart's values.yaml and its refusal message say this driver must then not share a node with the standard GPU device plugin",
        objects: 24,
        removedFromDefault: [],
        addedToDefault: [
          "resource.k8s.io/v1|DeviceClass||gpu.nvidia.com",
          "resource.k8s.io/v1|DeviceClass||mig.nvidia.com",
          "resource.k8s.io/v1|DeviceClass||vfio.gpu.nvidia.com",
        ],
        changesNothingElse: false,
      },
      aicrBase({
        name: "aicr-eks-training",
        bindings: row.aicr,
        what: `GPU allocation off and ComputeDomains on, the name overridden to nvidia-dra-driver-gpu, the driver root set to /run/nvidia/driver, the kubelet plugin selected onto nodes labelled nvidia.com/gpu.present, every pod tolerating every taint and annotated with gpu-operator chart version ${row.gpuOperator}`,
        objects: 21,
        compareWithDefault: false,
        deltaNote:
          "the AICR values set nameOverride and fullnameOverride, which rename most objects, so this base is not described as objects added to or removed from the default base; like the default base it has resources.gpus.enabled false, the same number of objects and the same CRDs",
      }),
    ],
  };
}

const draDriver = {
  repository: "dra-driver-nvidia",
  repositoryURL: "oci://registry.k8s.io/dra-driver-nvidia/charts",
  name: "dra-driver-nvidia-gpu",
  releaseName: "nvidia-dra-driver-gpu",
  namespace: "nvidia-dra-driver",
  // The chart requires Kubernetes 1.32 or later; resource.k8s.io/v1, which the render uses, is served from 1.34.
  kubeVersion: "1.34.0",
  scriptPrefix,
  nextAction: "publish and sign the package, then complete target-specific live qualification on a GPU target that serves resource.k8s.io/v1 before production",
  versions: Object.fromEntries(Object.keys(draVersions).map((version) => [version, draExpectations(version)])),
  extraBases: (version, expected) => expected.bases,
  describe:
    "The DRA Driver for NVIDIA GPUs lets workloads claim NVIDIA devices through Kubernetes Dynamic Resource Allocation. The chart installs a controller Deployment, a kubelet plugin DaemonSet, their RBAC, two CRDs, DeviceClass objects and a ValidatingAdmissionPolicy with its binding.",
  requiredCRDs: ownCRDs(draCRDs, "CRD included in this base and applied before the controller that reconciles it"),
  targetFactNote:
    "the two resource.nvidia.com CRDs must be established before the controller starts; the target must serve resource.k8s.io/v1, which Kubernetes does from 1.34, or it rejects the DeviceClass objects",
  valueModel: [
    {
      path: "resources.gpus.enabled / gpuResourcesEnabledOverride",
      disposition: "variant-axis",
      reason:
        "resources.gpus.enabled is true by chart default and the chart then fails to render unless gpuResourcesEnabledOverride is also true. The default base sets resources.gpus.enabled false; the gpu-resources base sets the override.",
      note: "with GPU allocation on, the chart says this driver must not share a node with the standard GPU device plugin",
      evidence: "templates/validation.yaml, values.yaml resources.gpus and gpuResourcesEnabledOverride",
    },
    {
      path: "resourceApiVersion",
      disposition: "left-at-default",
      reason:
        "Empty by chart default and in every base, so the chart picks the newest resource.k8s.io version the render's capability set reports. An offline Helm render reports v1, so the DeviceClass objects are resource.k8s.io/v1.",
      note: "a cluster that serves only v1beta1 or v1beta2 rejects these objects; Helm against that cluster would have rendered the older version",
      evidence: "templates/_helpers.tpl, values.yaml resourceApiVersion",
    },
    {
      path: "webhook.enabled",
      disposition: "left-at-default",
      reason: "False by chart default and in every base, so no ValidatingWebhookConfiguration renders and no webhook certificate is needed.",
      evidence: "templates/validatingwebhookconfiguration.yaml, templates/validation.yaml",
    },
  ],
  notes: (version, expected) => [
    `dra-driver-nvidia-gpu@${version} does not render with chart defaults: templates/validation.yaml stops the render while resources.gpus.enabled is true and gpuResourcesEnabledOverride is false. The default base sets resources.gpus.enabled false and renders ${expected.objects} objects as release nvidia-dra-driver-gpu in namespace nvidia-dra-driver: two CRDs, two DeviceClass objects for ComputeDomain channels and daemons, the controller Deployment, the kubelet plugin DaemonSet, three ServiceAccounts, RBAC, and a ValidatingAdmissionPolicy with its binding. It renders no Secret, no webhook configuration and no Helm hook.`,
    ...expected.bases.map(baseNote),
    "The bases are rendered for Kubernetes 1.34.0. The DeviceClass objects are resource.k8s.io/v1 in every base. The chart chooses that version from the API versions the render reports, and an offline Helm render reports v1 whatever --kube-version says, so the same bytes render for 1.32 through 1.35.",
    "The chart contains no lookup, no generated credential, no keep annotation, no Namespace template and no subchart. Its capability branches choose the resource.k8s.io version and add OpenShift RBAC when the cluster has SecurityContextConstraints, which an offline render does not report.",
  ],
  caveats: [
    "The kubelet plugin needs NVIDIA drivers on the node. The AICR values point it at /run/nvidia/driver, the path the GPU Operator's driver container uses; chart defaults use the host root.",
    "With resources.gpus.enabled true the driver publishes GPUs itself and must not run beside the standard GPU device plugin on the same node. The gpu-resources base does not check that.",
    "Nothing in this entry creates a ResourceClaim or a ComputeDomain. Installing the driver allocates nothing by itself.",
  ],
};

// ---------------------------------------------------------------------------
// kubeflow-trainer
// ---------------------------------------------------------------------------

const trainerCRDs = [
  "clustertrainingruntimes.trainer.kubeflow.org",
  "jobsets.jobset.x-k8s.io",
  "trainingruntimes.trainer.kubeflow.org",
  "trainjobs.trainer.kubeflow.org",
];
const trainerQuestion =
  "Two webhook certificate Secrets render with empty data and the controllers fill them in at run time, so does a delivery that applies the base again overwrite the certificates the controllers wrote?";
const trainerUnreadKeys =
  "Several keys in the AICR values, among them crds, manager.metrics, manager.leaderElection and webhook.enabled, are not defined in the chart's values.yaml; the render differs from the default base only in the two controller Deployments";
const kubeflowTrainer = {
  repository: "kubeflow",
  repositoryURL: "oci://ghcr.io/kubeflow/charts",
  name: "kubeflow-trainer",
  releaseName: "kubeflow-trainer",
  namespace: "kubeflow",
  scriptPrefix,
  nextAction,
  // The installer round trip drops one leading blank line from the configuration
  // file held in this ConfigMap. The equivalence check admits only that.
  leadingBlankLineConfigMaps: ["v1|ConfigMap|kubeflow|jobset-controller-config"],
  versions: {
    "2.2.0": {
      objects: 28,
      crds: trainerCRDs,
      secrets: 2,
      dependencies: 2,
      openQuestions: [{ bases: ["default", "aicr-eks-training-v0-20-0", "aicr-eks-training-v1-0-0"], question: trainerQuestion }],
      bases: [
        aicrBase({
          name: "aicr-eks-training-v0-20-0",
          bindings: aicrBinding("v0.20.0", "012-kubeflow-trainer", "kubeflow-trainer"),
          what: `the full name set to kubeflow-trainer, the manager given resource requests and limits and tolerating every taint, and the JobSet controller tolerating every taint. ${trainerUnreadKeys}`,
          objects: 28,
        }),
        aicrBase({
          name: "aicr-eks-training-v1-0-0",
          bindings: aicrBinding("v1.0.0", "012-kubeflow-trainer", "kubeflow-trainer"),
          what: `the v0.20.0 values with the manager and the JobSet controller also selected onto the system-worker node group, and jobset.install written in place of jobset.enabled. ${trainerUnreadKeys}`,
          objects: 28,
        }),
      ],
    },
  },
  extraBases: (version, expected) => expected.bases,
  describe:
    "Kubeflow Trainer runs distributed training jobs from TrainJob custom resources. The chart installs the trainer controller manager and, as a subchart, the JobSet controller, with four CRDs, their RBAC, Services, ConfigMaps, four webhook configurations and two empty webhook certificate Secrets.",
  requiredCRDs: ownCRDs(trainerCRDs, "CRD included in this base and applied before the controllers that reconcile it"),
  targetFactNote:
    "the four CRDs must be established before the two controllers start; each controller writes its own webhook certificate into a Secret the base creates empty, and until it has, the webhook configurations reject writes to its custom resources",
  valueModel: [
    {
      path: "jobset.install",
      disposition: "left-at-default",
      reason: "True by chart default and in every base, so the vendored JobSet subchart renders: its CRD, controller, webhooks and an empty certificate Secret.",
      note: "a cluster that already runs JobSet would get a second copy; that scenario is not offered as a base",
      evidence: "Chart.yaml dependencies (jobset with condition jobset.install), charts/jobset",
    },
    {
      path: "dataCache.enabled",
      disposition: "left-at-default",
      reason: "False by chart default and in every base, so the LeaderWorkerSet subchart and the data cache runtime do not render.",
      evidence: "Chart.yaml dependencies (lws with condition dataCache.enabled,dataCache.lws.install), values.yaml dataCache",
    },
    {
      path: "runtimes.defaultEnabled",
      disposition: "left-at-default",
      reason: "False by chart default and in every base, so no ClusterTrainingRuntime object renders.",
      note: "the AICR entries add their runtimes through their own kubeflow-trainer-post component, which is not part of this entry",
      evidence: "templates/runtimes, values.yaml runtimes",
    },
    {
      path: "jobset.prometheus.enable",
      disposition: "left-at-default",
      reason: "False by chart default and in every base. Turning it on makes the JobSet subchart fail the render unless the capability set reports the ServiceMonitor API, which an offline render does not.",
      evidence: "charts/jobset/templates/prometheus/service_monitor.yaml",
    },
  ],
  notes: (version, expected) => [
    `With chart defaults kubeflow-trainer@${version} renders ${expected.objects} objects as release kubeflow-trainer in namespace kubeflow: four CRDs, two controller Deployments (the trainer manager and JobSet), two ServiceAccounts, RBAC, three Services, three ConfigMaps, two MutatingWebhookConfigurations, two ValidatingWebhookConfigurations and two Secrets. It renders no Helm hook.`,
    "The two Secrets, kubeflow-trainer-webhook-cert and jobset-webhook-server-cert, render with four empty data keys each. Each controller generates its own serving certificate at run time, writes it into its Secret and writes the CA into its webhook configurations, which render with no CA bundle. Nothing is generated at render time.",
    ...expected.bases.map(baseNote),
    "The packaged Chart.yaml lists two dependencies, jobset 0.11.0 and lws 0.8.0, and the archive vendors both. The archive has no Chart.lock, so the dependency lock records the Chart.yaml list.",
    "The chart contains no lookup, no generated credential, no keep annotation and no Namespace template.",
    "The installer round trip drops one leading blank line from the YAML configuration file held in the jobset-controller-config ConfigMap. A YAML parser ignores that line. The equivalence check admits only that whitespace difference, in that one ConfigMap, and compares everything else exactly.",
  ],
  caveats: [
    "The trainer webhooks have failurePolicy Fail. Until the manager has written its certificate, the API server rejects TrainJob, TrainingRuntime and ClusterTrainingRuntime writes.",
    "A delivery that re-applies the two Secrets with their empty data can erase the certificates the controllers wrote. Whether a given delivery path does that was not observed.",
    "No training runtime is installed. A TrainJob needs a TrainingRuntime or ClusterTrainingRuntime, and none is part of this entry.",
  ],
};

// ---------------------------------------------------------------------------
// node-feature-discovery
// ---------------------------------------------------------------------------

const nfdCRDs = ["nodefeaturegroups.nfd.k8s-sigs.io", "nodefeaturerules.nfd.k8s-sigs.io", "nodefeatures.nfd.k8s-sigs.io"];
const nfdTopologyCRD = "noderesourcetopologies.topology.node.k8s.io";
const nfdTopologyObjects = [
  `apiextensions.k8s.io/v1|CustomResourceDefinition||${nfdTopologyCRD}`,
  "apps/v1|DaemonSet|node-feature-discovery|nfd-node-feature-discovery-topology-updater",
  "rbac.authorization.k8s.io/v1|ClusterRoleBinding||nfd-node-feature-discovery-topology-updater",
  "rbac.authorization.k8s.io/v1|ClusterRole||nfd-node-feature-discovery-topology-updater",
  "v1|ConfigMap|node-feature-discovery|nfd-node-feature-discovery-topology-updater-conf",
  "v1|ServiceAccount|node-feature-discovery|nfd-node-feature-discovery-topology-updater",
];
const nfdHooks = { "post-delete": 4 };
const nfdAicr = (name, release, what, extra = {}) =>
  aicrBase({
    name,
    bindings: aicrBinding(release, "004-nfd", "nfd", { nestedHookObjects: 4 }),
    what,
    objects: 23,
    crds: [...nfdCRDs, nfdTopologyCRD],
    hooks: nfdHooks,
    addedToDefault: nfdTopologyObjects,
    requiredCRDs: ownCRDs([...nfdCRDs, nfdTopologyCRD], "CRD included in this base and applied before the components that use it")(name),
    ...extra,
  });
const nodeFeatureDiscovery = {
  repository: "node-feature-discovery",
  repositoryURL: "https://kubernetes-sigs.github.io/node-feature-discovery/charts",
  name: "node-feature-discovery",
  releaseName: "nfd",
  namespace: "node-feature-discovery",
  scriptPrefix,
  nextAction,
  versions: {
    "0.19.0": {
      objects: 17,
      crds: nfdCRDs,
      dependencies: 0,
      hooks: nfdHooks,
      bases: [
        nfdAicr(
          "aicr-eks-training-v0-20-0",
          "v0.20.0",
          "the topology updater on with its CRD and resource requests and limits, and the master, worker, garbage collector and topology updater tolerating every taint",
        ),
        nfdAicr(
          "aicr-eks-training-v1-0-0",
          "v1.0.0",
          "the v0.20.0 values with the master and the garbage collector also selected onto the system-worker node group",
        ),
      ],
    },
  },
  extraBases: (version, expected) => expected.bases,
  lifecycle: {
    root: "prerequisites/node-feature-discovery-lifecycle",
    extras: "config-catalog/package-extras/node-feature-discovery/node-feature-discovery",
    note: () =>
      "the bases are rendered with --no-hooks; every base's values also render 4 post-delete Helm hook objects. They are packaged under prerequisites/node-feature-discovery-lifecycle with a lifecycle-actions.yaml record, and nothing runs them automatically. No hook has been run on a cluster for this entry.",
  },
  describe:
    "Node Feature Discovery detects hardware features and system configuration on each node and publishes them as node labels. With chart defaults it runs the master, a worker on every node and the garbage collector, and installs three CRDs.",
  requiredCRDs: ownCRDs(nfdCRDs, "CRD included in this base and applied before the components that use it"),
  targetFactNote:
    "the CRDs must be established before the master and the workers start; the four post-delete hook objects are a packaged lifecycle action, not part of the base",
  valueModel: [
    {
      path: "topologyUpdater.enable / topologyUpdater.createCRDs",
      disposition: "variant-axis",
      reason:
        "Both false by chart default. The AICR values turn both on, which adds the topology updater DaemonSet, its ServiceAccount, ClusterRole, ClusterRoleBinding and ConfigMap, and the NodeResourceTopology CRD.",
      note: "the two AICR bases hold those six objects; the default base does not",
      evidence: "templates/topologyupdater.yaml, templates/topologyupdater-crds.yaml, templates/clusterrole.yaml, values.yaml topologyUpdater",
    },
    {
      path: "postDeleteCleanup",
      disposition: "left-at-default",
      reason:
        "True by chart default and in every base. It renders a post-delete hook: a Job that removes the labels, annotations, taints and extended resources NFD put on nodes, with its ServiceAccount, ClusterRole and ClusterRoleBinding.",
      note: "packaged as a recorded lifecycle action, not automatic and not run",
      evidence: "templates/post-delete-job.yaml",
    },
  ],
  notes: (version, expected) => [
    `With chart defaults node-feature-discovery@${version} renders ${expected.objects} objects as release nfd in namespace node-feature-discovery, the names the AICR entries use: three CRDs from the chart's crds directory, the master Deployment, the worker DaemonSet, the garbage collector Deployment, three ServiceAccounts, two ConfigMaps and RBAC. It renders no Secret and no webhook configuration.`,
    "The same values also render four post-delete Helm hook objects that no base holds: the prune Job with its ServiceAccount, ClusterRole and ClusterRoleBinding. They are packaged under prerequisites/node-feature-discovery-lifecycle with a lifecycle-actions.yaml record. Nothing runs them automatically and none has been run on a cluster.",
    ...expected.bases.map(baseNote),
    "The chart contains no lookup, no .Capabilities branch, no generated credential, no keep annotation, no Namespace template and no subchart.",
    "The gpu-operator chart vendors this chart as a subchart. A cluster that takes the gpu-operator default base already runs node-feature-discovery; this entry is for running it separately, as the AICR entries do with the gpu-operator's own copy turned off.",
  ],
  caveats: [
    "A flattened delete that skips the post-delete action leaves the node labels, annotations, taints and extended resources NFD created.",
    "The topology updater in the AICR bases reads the kubelet's pod resources socket on every node and runs with host access.",
    "The hook Job image is the tag the chart renders. It is not pinned by digest here.",
  ],
};

// ---------------------------------------------------------------------------
// aws-efa-k8s-device-plugin
// ---------------------------------------------------------------------------

const awsEfa = {
  repository: "eks",
  repositoryURL: "https://aws.github.io/eks-charts",
  name: "aws-efa-k8s-device-plugin",
  releaseName: "aws-efa",
  namespace: "kube-system",
  scriptPrefix,
  nextAction: "publish and sign the package, then complete target-specific live qualification on EFA-capable EC2 instances before production",
  versions: {
    "v0.5.29": {
      objects: 1,
      crds: [],
      dependencies: 0,
      bases: [
        aicrBase({
          name: "aicr-eks-training",
          bindings: [
            aicrBinding("v0.20.0", "002-aws-efa", "aws-efa", { targetRevision: "0.5.29" }),
            aicrBinding("v1.0.0", "002-aws-efa", "aws-efa", { targetRevision: "0.5.29" }),
          ],
          what: "the full name set to aws-efa-k8s-device-plugin, the DaemonSet selected onto nodes labelled nvidia.com/gpu.present and tolerating every taint, the image named explicitly, resource requests set, and the container security context tightened",
          objects: 1,
          removedFromDefault: ["apps/v1|DaemonSet||aws-efa-aws-efa-k8s-device-plugin"],
          addedToDefault: ["apps/v1|DaemonSet||aws-efa-k8s-device-plugin"],
        }),
      ],
    },
  },
  extraBases: (version, expected) => expected.bases,
  describe:
    "The AWS EFA Kubernetes device plugin advertises Elastic Fabric Adapter interfaces on EC2 nodes as the extended resource vpc.amazonaws.com/efa. The chart is one DaemonSet.",
  requiredCRDs: () => [],
  targetFactNote:
    "this base needs no CRD on the target; the DaemonSet carries no namespace, so it must be applied into kube-system; the image is in a regional Amazon ECR registry that needs AWS credentials to pull",
  valueModel: [
    {
      path: "fullnameOverride",
      disposition: "variant-axis",
      reason: "Empty by chart default, so the default base names the DaemonSet after the release and the chart: aws-efa-aws-efa-k8s-device-plugin. The AICR values set it to aws-efa-k8s-device-plugin.",
      evidence: "templates/_helpers.tpl, templates/daemonset.yaml",
    },
    {
      path: "supportedInstanceLabels / nodeSelector",
      disposition: "variant-axis",
      reason:
        "Chart defaults select nodes by a long list of EFA-capable EC2 instance types in a node affinity. The AICR values replace the label keys and values with nodeGroup and nvidia.com/gpu.present, and add a node selector on nvidia.com/gpu.present.",
      note: "the default base runs on EFA-capable instance types; the AICR base runs on nodes the GPU Operator has labelled",
      evidence: "values.yaml supportedInstanceLabels, templates/daemonset.yaml",
    },
  ],
  notes: (version, expected) => [
    `With chart defaults aws-efa-k8s-device-plugin@${version} renders ${expected.objects} object as release aws-efa: one DaemonSet. It renders no CRD, no Secret, no RBAC and no Helm hook.`,
    "The archive's Chart.yaml names the version v0.5.29 and the application version v0.5.20. The AICR Applications ask for 0.5.29, which Helm resolves to this archive; the archive SHA-256 equals the one the AICR v0.20.0 nested-render receipt records.",
    ...expected.bases.map(baseNote),
    "The DaemonSet carries no metadata.namespace, because the chart template leaves it to Helm. A flattened copy must be applied into kube-system.",
    "The chart contains no lookup, no .Capabilities branch, no generated credential, no hook and no subchart.",
  ],
  caveats: [
    "The image is 602401143452.dkr.ecr.us-west-2.amazonaws.com/eks/aws-efa-k8s-device-plugin:v0.5.20, in an Amazon ECR registry that is regional and needs AWS credentials. An EKS node in us-west-2 can pull it; another region or another cloud needs the image reference changed.",
    "The pod runs on the host network and mounts the kubelet device plugin directory. It does nothing useful on a node without EFA interfaces.",
  ],
  verifyBase: ({ item, docs, check }) => {
    check(docs.every((doc) => !doc.metadata?.namespace), `aws-efa-k8s-device-plugin ${item.name} render is recorded as namespace-less; a namespaced object changes that note`);
  },
};

// ---------------------------------------------------------------------------
// k8s-ephemeral-storage-metrics
// ---------------------------------------------------------------------------

const serviceMonitorCRD = [
  {
    name: "servicemonitors.monitoring.coreos.com",
    ...prometheusOperatorCRDSource,
    purpose: "Prometheus Operator ServiceMonitor CRD required before Kubernetes accepts the rendered ServiceMonitor object; the chart does not ship it",
    deliveryLanes,
    applyMode: "server-side",
  },
];
const ephemeralStorageMetrics = {
  repository: "k8s-ephemeral-storage-metrics",
  repositoryURL: "https://jmcgrath207.github.io/k8s-ephemeral-storage-metrics/chart",
  name: "k8s-ephemeral-storage-metrics",
  releaseName: "k8s-ephemeral-storage-metrics",
  namespace: "monitoring",
  scriptPrefix,
  nextAction,
  versions: {
    "1.19.2": {
      objects: 6,
      crds: [],
      dependencies: 0,
      bases: [
        aicrBase({
          name: "aicr-eks-training-v0-20-0",
          bindings: aicrBinding("v0.20.0", "010-k8s-ephemeral-storage-metrics", "k8s-ephemeral-storage-metrics"),
          what: "the ServiceMonitor labelled for the kube-prometheus-stack release, seven metrics named, and the pod tolerating every taint",
          objects: 6,
          requiredCRDs: serviceMonitorCRD,
        }),
        aicrBase({
          name: "aicr-eks-training-v1-0-0",
          bindings: aicrBinding("v1.0.0", "010-k8s-ephemeral-storage-metrics", "k8s-ephemeral-storage-metrics"),
          what: "the v0.20.0 values with the pod also selected onto the system-worker node group",
          objects: 6,
          requiredCRDs: serviceMonitorCRD,
        }),
      ],
    },
  },
  extraBases: (version, expected) => expected.bases,
  describe:
    "k8s-ephemeral-storage-metrics exports each pod's ephemeral storage use as Prometheus metrics, read from the kubelet. The chart is a Deployment, its ServiceAccount, a ClusterRole and binding, a Service and a ServiceMonitor.",
  requiredCRDs: () => serviceMonitorCRD,
  targetFactNote:
    "the target must already have the Prometheus Operator ServiceMonitor CRD, which the chart does not ship",
  valueModel: [
    {
      path: "prometheus.enable",
      disposition: "default-render-captured",
      reason: "True by chart default and in every base, so the render contains one monitoring.coreos.com/v1 ServiceMonitor. The chart ships no Prometheus Operator CRD.",
      note: "recorded as a target fact with a packaged copy of the CRD",
      evidence: "templates/metrics.yaml, values.yaml prometheus",
    },
    {
      path: "deploy_type",
      disposition: "left-at-default",
      reason: "Deployment by chart default and in every base. The chart can also run as a DaemonSet; that is not offered as a base.",
      evidence: "templates/DeployType.yaml, values.yaml deploy_type",
    },
  ],
  notes: (version, expected) => [
    `With chart defaults k8s-ephemeral-storage-metrics@${version} renders ${expected.objects} objects as release k8s-ephemeral-storage-metrics in namespace monitoring, the names the AICR entries use: a Deployment, a ServiceAccount, a ClusterRole, a ClusterRoleBinding, a Service and a ServiceMonitor. It renders no CRD, no Secret and no Helm hook.`,
    ...expected.bases.map(baseNote),
    "The chart contains no lookup, no .Capabilities branch, no generated credential, no keep annotation, no webhook, no Namespace template and no subchart.",
    "The chart is published by a single maintainer under the MIT licence. Its Chart.yaml states the licence in an Artifact Hub annotation.",
  ],
  caveats: [
    "The ClusterRole lets the pod read node stats through the API server's node proxy for every node.",
    "Whether a Prometheus scrapes the ServiceMonitor depends on that Prometheus's selectors. The AICR values label it for a release named kube-prometheus-stack; chart defaults label it for kube-prometheus-stack as well.",
  ],
};

// ---------------------------------------------------------------------------
// aws-ebs-csi-driver
// ---------------------------------------------------------------------------

const ebsStorageClass = "storage.k8s.io/v1|StorageClass||ebs-csi-default-sc";
const ebsWindowsNode = "apps/v1|DaemonSet|kube-system|ebs-csi-node-windows";
const awsEbsCsiDriver = {
  repository: "aws-ebs-csi-driver",
  repositoryURL: "https://kubernetes-sigs.github.io/aws-ebs-csi-driver",
  name: "aws-ebs-csi-driver",
  releaseName: "aws-ebs-csi-driver",
  namespace: "kube-system",
  // The chart adds a feature gate and a CSIDriver field from Kubernetes 1.33. The AICR nested render has both.
  kubeVersion: "1.33.0",
  scriptPrefix,
  nextAction: "publish and sign the package, then complete target-specific live qualification on an AWS target before production",
  versions: {
    "2.59.0": {
      objects: 19,
      crds: [],
      dependencies: 0,
      bases: [
        aicrBase({
          name: "aicr-eks-training-v0-20-0",
          bindings: aicrBinding("v0.20.0", "001-aws-ebs-csi-driver", "aws-ebs-csi-driver"),
          what: "a default StorageClass on, the Windows node DaemonSet off, the controller and node pods tolerating every taint, service account names and resource requests and limits set",
          objects: 19,
          removedFromDefault: [ebsWindowsNode],
          addedToDefault: [ebsStorageClass],
        }),
        aicrBase({
          name: "aicr-eks-training-v1-0-0",
          bindings: aicrBinding("v1.0.0", "001-aws-ebs-csi-driver", "aws-ebs-csi-driver"),
          what: "the v0.20.0 values with the controller also selected onto the system-worker node group",
          objects: 19,
          removedFromDefault: [ebsWindowsNode],
          addedToDefault: [ebsStorageClass],
        }),
      ],
    },
  },
  extraBases: (version, expected) => expected.bases,
  describe:
    "The Amazon EBS CSI driver provisions and attaches EBS volumes for Kubernetes workloads. The chart installs a controller Deployment, node DaemonSets, a CSIDriver object, ServiceAccounts, RBAC and a PodDisruptionBudget.",
  requiredCRDs: () => [],
  targetFactNote:
    "this base needs no CRD on the target; it is rendered for Kubernetes 1.33 or later, and the controller needs AWS permissions to manage EBS volumes, which the chart does not grant",
  valueModel: [
    {
      path: "<Kubernetes version>",
      disposition: "default-render-captured",
      reason:
        "From Kubernetes 1.33 the chart adds the MutableCSINodeAllocatableCount feature gate to the controller and nodeAllocatableUpdatePeriodSeconds to the CSIDriver. The bases are rendered for 1.33.0 and hold both.",
      note: "a render for 1.32 or earlier differs at those two fields; the AICR nested render, made with Helm's own default version, has both",
      evidence: "templates/controller.yaml, templates/csidriver.yaml",
    },
    {
      path: "defaultStorageClass.enabled",
      disposition: "variant-axis",
      reason: "False by chart default. The AICR values turn it on, which adds a StorageClass named ebs-csi-default-sc annotated as the cluster default.",
      note: "a cluster that already has a default StorageClass then has two",
      evidence: "templates/ebs-csi-default-sc.yaml, values.yaml defaultStorageClass",
    },
    {
      path: "node.enableWindows",
      disposition: "variant-axis",
      reason: "True by chart default, which renders a second node DaemonSet for Windows nodes. The AICR values turn it off.",
      evidence: "templates/node-windows.yaml",
    },
  ],
  notes: (version, expected) => [
    `With chart defaults aws-ebs-csi-driver@${version} renders ${expected.objects} objects as release aws-ebs-csi-driver in namespace kube-system, the names the AICR entries use: the controller Deployment, a Linux and a Windows node DaemonSet, the CSIDriver object, two ServiceAccounts, five ClusterRoles, five ClusterRoleBindings, a Role, a RoleBinding and a PodDisruptionBudget. It renders no CRD and no Secret, and no Helm hook once the chart's helm test Pod is left out.`,
    "The bases are rendered for Kubernetes 1.33.0, not the 1.30.0 that the 2.60.1 entry of this chart uses. The chart renders two more fields from 1.33, and the AICR nested render of this archive has them.",
    ...expected.bases.map(baseNote),
    "The chart's snapshot sidecar and its VolumeSnapshotClass objects render only when the capability set reports the snapshot.storage.k8s.io API. An offline render does not, so no base holds them.",
    "The chart contains no lookup, no generated credential, no keep annotation, no webhook, no Namespace template and no subchart. Its one Helm hook is a helm test Pod, which the bases leave out.",
  ],
  caveats: [
    "The controller needs AWS credentials with permission to create, attach and delete EBS volumes, usually through IAM Roles for Service Accounts or EKS Pod Identity. Nothing in this entry provides them.",
    "The AICR bases make ebs-csi-default-sc the default StorageClass. On a cluster that already has a default, two defaults exist until one is changed.",
    "A CSIDriver object's spec is largely immutable. Moving between chart versions that change it means deleting and recreating the object, which this entry does not do.",
  ],
};

// ---------------------------------------------------------------------------
// prometheus-operator-crds
// ---------------------------------------------------------------------------

const prometheusCRDs = [
  "alertmanagerconfigs.monitoring.coreos.com",
  "alertmanagers.monitoring.coreos.com",
  "podmonitors.monitoring.coreos.com",
  "probes.monitoring.coreos.com",
  "prometheusagents.monitoring.coreos.com",
  "prometheuses.monitoring.coreos.com",
  "prometheusrules.monitoring.coreos.com",
  "scrapeconfigs.monitoring.coreos.com",
  "servicemonitors.monitoring.coreos.com",
  "thanosrulers.monitoring.coreos.com",
];
const prometheusOperatorCRDs = {
  repository: "prometheus-community",
  repositoryURL: "https://prometheus-community.github.io/helm-charts",
  name: "prometheus-operator-crds",
  releaseName: "prometheus-operator-crds",
  namespace: "monitoring",
  scriptPrefix,
  nextAction,
  versions: {
    "28.0.1": {
      objects: 10,
      crds: prometheusCRDs,
      dependencies: 1,
      bases: [
        aicrBase({
          name: "aicr-eks-training",
          bindings: [
            aicrBinding("v0.20.0", "007-prometheus-operator-crds", "prometheus-operator-crds"),
            aicrBinding("v1.0.0", "007-prometheus-operator-crds", "prometheus-operator-crds"),
          ],
          what: "one key, enabled: true, which the chart does not read, so the render equals the default base",
          objects: 10,
          changesNothingElse: true,
          requiredCRDs: ownCRDs(prometheusCRDs, "CRD included in this base; the entry exists to install it")("aicr-eks-training"),
        }),
      ],
    },
  },
  extraBases: (version, expected) => expected.bases,
  describe:
    "prometheus-operator-crds installs the ten Prometheus Operator CRDs, version v0.90.1, and nothing else, so the CRDs can be managed apart from the operator.",
  requiredCRDs: ownCRDs(prometheusCRDs, "CRD included in this base; the entry exists to install it"),
  targetFactNote:
    "the ten CRDs are the whole base; they are large, so they need server-side apply, and a cluster that already has these CRDs from another source gets them replaced",
  valueModel: [
    {
      path: "enabled",
      disposition: "left-at-default",
      reason: "The AICR values set enabled: true. The chart's values.yaml has no such key and no template reads it, so it changes nothing.",
      note: "the aicr-eks-training base equals the default base object for object, and the proof checks that",
      evidence: "values.yaml, charts/crds/templates",
    },
    {
      path: "crds.<name>.enabled",
      disposition: "left-at-default",
      reason: "Every CRD is on by chart default and in every base.",
      evidence: "charts/crds/values.yaml",
    },
  ],
  notes: (version, expected) => [
    `With chart defaults prometheus-operator-crds@${version} renders ${expected.objects} objects: the ten monitoring.coreos.com CRDs of Prometheus Operator v0.90.1, from the templates of its crds subchart. It renders nothing else: no workload, no RBAC, no Secret and no Helm hook.`,
    "The CRDs are cluster-scoped, so the release namespace changes no object. The bases use monitoring, the namespace the AICR entries use.",
    ...expected.bases.map(baseNote),
    "The packaged Chart.lock lists one dependency, the crds subchart vendored in the archive with an empty repository.",
    "The AICR entries install this chart before kube-prometheus-stack 84.4.0 and set crds.enabled false there, so these are the CRDs that stack uses.",
  ],
  caveats: [
    "This entry installs no operator. The CRDs do nothing until a Prometheus Operator runs.",
    "Deleting the delivered objects deletes the CRDs and with them every ServiceMonitor, PrometheusRule and other custom resource of these kinds in the cluster.",
    "The CRDs are large. Client-side kubectl apply can exceed the last-applied annotation limit, so the target facts ask for server-side apply.",
  ],
};

export const AICR_NESTED_CHART_CANDIDATES = Object.freeze({
  "kai-scheduler": kaiScheduler,
  nodewright,
  "dra-driver-nvidia-gpu": draDriver,
  "kubeflow-trainer": kubeflowTrainer,
  "node-feature-discovery": nodeFeatureDiscovery,
  "aws-efa-k8s-device-plugin": awsEfa,
  "k8s-ephemeral-storage-metrics": ephemeralStorageMetrics,
  "aws-ebs-csi-driver": awsEbsCsiDriver,
  "prometheus-operator-crds": prometheusOperatorCRDs,
});

// The open questions an entry carries, per base. An entry with a question is
// marked watch once its base-variant record exists.
export function aicrNestedChartOpenQuestions(chart, version, base) {
  const candidate = Object.values(AICR_NESTED_CHART_CANDIDATES).find((item) => item.name === chart);
  return (candidate?.versions?.[version]?.openQuestions ?? [])
    .filter((row) => row.bases.includes(base))
    .map((row) => row.question);
}

// ---------------------------------------------------------------------------
// Lifecycle profiles for scripts/generate-gpu-operator-packaged-lifecycle.mjs
// ---------------------------------------------------------------------------

// Where scripts/sync-installer-target-facts.mjs writes a base's CRD bundle.
function crdBundlePath(baseName) {
  const slug = String(baseName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `prerequisites/target-facts/${slug}-crds.yaml`;
}

// The bases of one version in package order, in the shape the lifecycle
// generator reads: values, ordinary object count, CRDs and hook counts by phase.
function lifecycleBases(candidate, version) {
  const expected = candidate.versions[version];
  if (!expected) throw new Error(`${candidate.name} ${version} needs reviewed version-specific assertions`);
  const rows = [
    { name: "default", valuesText: expected.defaultBase?.valuesText ?? "", objects: expected.objects, crds: expected.crds, hooks: expected.hooks },
    ...expected.bases.map((base) => ({
      name: base.name,
      valuesText: base.valuesText,
      objects: base.objects,
      crds: base.crds ?? expected.crds,
      hooks: base.hooks ?? expected.hooks,
    })),
  ];
  return rows.map((row) => ({
    name: row.name,
    valuesText: row.valuesText,
    expected: { objects: row.objects, crds: [...row.crds].sort(), hooks: row.hooks },
    hookObjectCount: Object.values(row.hooks).reduce((sum, count) => sum + count, 0),
  }));
}

const lifecycleProfile = (candidate, { title, preApply, actionFor, readmeIntro }) =>
  Object.freeze({
    chartName: candidate.name,
    title,
    chart: {
      repository: candidate.repository,
      releaseName: candidate.releaseName,
      namespace: candidate.namespace,
      kubeVersion: candidate.kubeVersion ?? "1.31.0",
    },
    chartFor: (version) => ({
      repository: candidate.repository,
      releaseName: candidate.releaseName,
      namespace: candidate.versions[version]?.namespace ?? candidate.namespace,
      kubeVersion: candidate.kubeVersion ?? "1.31.0",
    }),
    reviewedVersions: Object.keys(candidate.versions),
    bases: (version) => lifecycleBases(candidate, version),
    lifecycleRoot: candidate.lifecycle.root,
    extrasRoot: candidate.lifecycle.extras,
    crdBundlePath,
    preApply,
    actionFor,
    readmeIntro,
  });

const hookIntro = (chart, when) =>
  `The ${chart} chart renders more than the objects a base holds. It also\nrenders Helm hook objects, which Helm runs ${when}. They are\nkept here, apart from the base, because applying them as ordinary objects would\nrun them at the wrong time.`;

export const AICR_NESTED_CHART_LIFECYCLE_PROFILES = Object.freeze([
  lifecycleProfile(kaiScheduler, {
    title: "KAI Scheduler",
    preApply: (base) => ({
      name: `Install and establish the ${base.expected.crds.length} CRDs before the other objects`,
      detail:
        "The base holds two Queue objects and a SchedulingShard, which Kubernetes rejects until their CRDs are established, and the operator watches all six kinds as soon as it starts. The bundle holds exactly the CRDs this base renders.",
    }),
    actionFor(phase, base, version) {
      if (phase === "pre-install,pre-upgrade") {
        const holdsConfig = version === "v0.14.1";
        return {
          name: holdsConfig
            ? "Before an install or an upgrade, move the CRDs forward, migrate topologies and apply the Config"
            : "Before an install or an upgrade, move the CRDs forward and migrate topologies",
          detail: `Helm runs these in hook-weight order before it applies the chart's objects. The crd-upgrader Job applies the CRD files inside its image, with the kai-scheduler-crd-manager ServiceAccount and its ClusterRole and ClusterRoleBinding. The topology-migration Job runs a script from a hook ConfigMap that copies Kueue Topology objects, where a cluster has them, to KAI Topology objects, with its own ServiceAccount, ClusterRole and ClusterRoleBinding. ${
            holdsConfig
              ? "This file also holds the kai.scheduler/v1 Config object named kai-config, which tells the operator which scheduler services to run. It is required on a first install: the operator deploys no scheduler until it exists."
              : "The kai-config Config object is not in this file; the post-install action applies it."
          } A workflow that applies this base's CRD bundle first does the crd-upgrader's work. Helm deletes the Jobs when they succeed; a workflow that applies them must delete them itself.`,
        };
      }
      if (phase === "post-install,post-upgrade") {
        return {
          name: "After an install or an upgrade, apply the Config that tells the operator what to run",
          detail:
            "In this chart version the kai-config Config object is not a chart object. This Job applies it with kubectl apply --server-side from the kai-config-manifest hook ConfigMap, using the kai-config-deployer ServiceAccount and its ClusterRole and ClusterRoleBinding. It is required on a first install: the operator deploys no scheduler until the Config exists. A workflow may instead apply the Config manifest held in that ConfigMap directly.",
        };
      }
      if (phase === "post-delete") {
        return {
          name: "After a delete, remove what the operator created",
          detail:
            "The post-delete-cleanup Job deletes the Deployments the operator created in the release namespace and the kai-config Config object, with its own ServiceAccount, ClusterRole and ClusterRoleBinding. It renders only while postCleanup.enabled is true, which is the chart default; the AICR values turn it off. A flattened delete that skips it leaves the operator-created Deployments and the Config. The keep-annotated Namespace, Queues and SchedulingShard are deleted with the base instead of kept.",
        };
      }
      throw new Error(`kai-scheduler hook phase ${phase} has no reviewed lifecycle action`);
    },
    readmeIntro: hookIntro("kai-scheduler", "before and after an install or an upgrade and after a delete"),
  }),
  lifecycleProfile(nodewright, {
    title: "NodeWright",
    preApply: (base) => ({
      name: `Install and establish the ${base.expected.crds.length} CRDs before the operator starts`,
      detail:
        "The operator Deployment watches these custom resources as soon as it starts. The bundle holds exactly the CRDs this base renders. No object in the base is an instance of them, so nothing is rejected if they arrive late, but the operator cannot work until they are established.",
    }),
    actionFor(phase) {
      if (phase === "pre-upgrade") {
        return {
          name: "Before an upgrade, delete the operator Deployment if its selector would change",
          detail:
            "A Deployment's selector is immutable. This Job compares the live controller-manager Deployment's selector with the one the new chart renders and deletes the Deployment when they differ, so the upgrade can create it again. It runs with its own ServiceAccount, Role and RoleBinding. A workflow that applies a newer base over an older one must run these four objects first, wait for the Job to complete, then delete them; otherwise the apply fails on the immutable field.",
        };
      }
      if (phase === "pre-delete") {
        return {
          name: "Before a delete, remove the custom resources and the webhook configurations",
          detail:
            "Two Jobs run while the operator is still there. One deletes every custom resource of the operator's kinds, so the operator can release their finalizers. The other deletes the mutating and validating webhook configurations and the certificate Secret the operator created. Both use the controller-manager ServiceAccount. A flattened delete that skips them can leave custom resources stuck on finalizers and a webhook configuration pointing at a Service that no longer exists.",
        };
      }
      throw new Error(`nodewright hook phase ${phase} has no reviewed lifecycle action`);
    },
    readmeIntro: hookIntro("nodewright", "before an upgrade and before a delete"),
  }),
  lifecycleProfile(nodeFeatureDiscovery, {
    title: "Node Feature Discovery",
    preApply: (base) => ({
      name: `Install and establish the ${base.expected.crds.length} CRDs before the master and the workers start`,
      detail:
        "The workers write NodeFeature objects and the master reads NodeFeatureRule objects as soon as they start. The bundle holds exactly the CRDs this base renders. No object in the base is an instance of them.",
    }),
    actionFor(phase) {
      if (phase === "post-delete") {
        return {
          name: "After a delete, remove what NFD put on the nodes",
          detail:
            "The prune Job runs nfd-master with -prune, which removes the labels, annotations, taints and extended resources NFD created on every node, with its own ServiceAccount, ClusterRole and ClusterRoleBinding. A workflow that deletes this base must apply these four objects afterwards, wait for the Job to complete, then delete them. Skipping it leaves the node labels in place.",
        };
      }
      throw new Error(`node-feature-discovery hook phase ${phase} has no reviewed lifecycle action`);
    },
    readmeIntro: hookIntro("node-feature-discovery", "after a release is deleted"),
  }),
]);
