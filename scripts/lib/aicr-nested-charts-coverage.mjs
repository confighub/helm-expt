// The charts the two retained AICR EKS training entries pin
// (examples/aicr/eks-h100-training-kubeflow-v0-20-0 and -v1-0-0) that were not
// yet standalone Catalog entries at the pinned version. A chart held only as a
// nested source inside an AICR entry is not a Catalog entry, so each is added
// here at every version those two entries pin, addressed by its exact archive
// URL and SHA-256.
//
// Seven charts were not in the Catalog at all: kai-scheduler, nodewright,
// dra-driver-nvidia-gpu, kubeflow-trainer, node-feature-discovery,
// aws-efa-k8s-device-plugin and k8s-ephemeral-storage-metrics. Three were in the
// Catalog at another version: aws-ebs-csi-driver, kube-prometheus-stack and
// prometheus-operator-crds. Two of the seven, node-feature-discovery and
// aws-efa-k8s-device-plugin, are held out below until their licence is recorded.
//
// Every archive was pulled with no registry credentials on 2026-10-08. Where the
// AICR v0.20.0 entry retains a nested-render receipt for the chart, the SHA-256
// here equals the one that receipt records. kai-scheduler v0.16.9, nodewright
// v0.19.0 and dra-driver-nvidia-gpu 0.5.0 are pinned only by the AICR v1.0.0
// entry, which retains no nested render, so their SHA-256 is the digest of the
// archive the tag returned on that day; `ociManifestDigest` records the registry
// manifest it came from. The proof verifies the archive SHA-256, not the tag, so
// a moved tag fails the check instead of changing the entry.
//
// `script` is the proof declaration that renders and packages the chart, and
// `candidate` selects the entry inside scripts/lib/aicr-nested-chart-candidates.mjs.
// `lifecycle` names the generator that packages the chart's Helm hook objects as
// recorded lifecycle actions. `targetFacts` says the bases declare target facts,
// so the CRD bundle is synced into the package after it is generated.
//
// scripts/nvidia-gpu-stack-coverage.mjs --set aicr-nested-charts runs this list.

const entry = (repository, chart, version, url, sha256, script, extra = {}) =>
  Object.freeze({
    canonicalIdentity: `${repository}/${chart}`,
    repository,
    chart,
    version,
    url,
    sha256,
    script,
    ...extra,
    recipePath: `recipes/${repository}/${chart}/${version}`,
    packagePath: `packages/${repository}/${chart}/${version}`,
  });

const generic = "aicr-nested-charts-proof.mjs";
const hooks = { lifecycle: "generate-gpu-operator-packaged-lifecycle.mjs", targetFacts: true };

export const AICR_NESTED_CHART_ADDITIONS = Object.freeze([
  // kai-scheduler: AICR v0.20.0 pins v0.14.1 and AICR v1.0.0 pins v0.16.9.
  entry("kai-scheduler", "kai-scheduler", "v0.14.1", "oci://ghcr.io/kai-scheduler/kai-scheduler/kai-scheduler:v0.14.1", "7ae052b56e752975eeac0ebb5de381f5eadf51207872c95f98eefd2901c4be4e", generic, {
    candidate: "kai-scheduler",
    ...hooks,
    ociManifestDigest: "sha256:84d78050c5f0028298bcfa8c4a7210488e0b37c0d95f64a28d58d1258c762f7e",
  }),
  entry("kai-scheduler", "kai-scheduler", "v0.16.9", "oci://ghcr.io/kai-scheduler/kai-scheduler/kai-scheduler:v0.16.9", "2f2f8080729c530fab41c5bc24717dfb29c9d5b39963c5eb9d82d10e96f8ab9d", generic, {
    candidate: "kai-scheduler",
    ...hooks,
    ociManifestDigest: "sha256:7447f89caa98f1ac60829d2e584f3d84c18029ef634b1cb4db017fce1b80ea66",
  }),
  // nodewright (formerly Skyhook): AICR v0.20.0 pins v0.17.1 and AICR v1.0.0 pins v0.19.0.
  entry("nvidia", "nodewright", "v0.17.1", "oci://ghcr.io/nvidia/nodewright/charts/nodewright:v0.17.1", "a75b0b3183e091e13207cd9b7693e0e612ea178bac8970398e101c7b9f2b4854", generic, {
    candidate: "nodewright",
    ...hooks,
    ociManifestDigest: "sha256:60690039b1257c6d9253da581036a20800a4e767849debb37c30b05d5b5bdf17",
  }),
  entry("nvidia", "nodewright", "v0.19.0", "oci://ghcr.io/nvidia/nodewright/charts/nodewright:v0.19.0", "24c507791b3fd10cd4fba44831e621d98a7f9faa7833a81add0357bf2d7307ff", generic, {
    candidate: "nodewright",
    ...hooks,
    ociManifestDigest: "sha256:ee6fc840dbe22d0db7e4e080ef411c4f3dbf54257ae6ff523f938335103c26bd",
  }),
  // dra-driver-nvidia-gpu: AICR v0.20.0 pins 0.4.1 and AICR v1.0.0 pins 0.5.0.
  entry("dra-driver-nvidia", "dra-driver-nvidia-gpu", "0.4.1", "oci://registry.k8s.io/dra-driver-nvidia/charts/dra-driver-nvidia-gpu:0.4.1", "c1c316f6bdcfe5fed3ff649cff1b43be50d27d0cb1aaf9d29e7bdca1eaa331ce", generic, {
    candidate: "dra-driver-nvidia-gpu",
    targetFacts: true,
    ociManifestDigest: "sha256:7a00373fdef1025f27ebb1d353719446bbbe6ec4697e9a503c5ffd7e4f1525dd",
  }),
  entry("dra-driver-nvidia", "dra-driver-nvidia-gpu", "0.5.0", "oci://registry.k8s.io/dra-driver-nvidia/charts/dra-driver-nvidia-gpu:0.5.0", "c7ca3dc31a6fa8b85c6fd5ee40948cf8d9162e32f20db9fc085113b4035e8b35", generic, {
    candidate: "dra-driver-nvidia-gpu",
    targetFacts: true,
    ociManifestDigest: "sha256:47e43e3fbcaf525accef5b5ad14d87e80e19ef1549839495dcb0eabd06ff3bbe",
  }),
  // Both AICR entries pin the versions below.
  entry("kubeflow", "kubeflow-trainer", "2.2.0", "oci://ghcr.io/kubeflow/charts/kubeflow-trainer:2.2.0", "34191da2886a91d9effb0543087ef0ad19b870b094c336c2ca34f474cba0030e", generic, {
    candidate: "kubeflow-trainer",
    targetFacts: true,
    ociManifestDigest: "sha256:332c2e6a31e7497af6bafa5aa44b07f17709d5555e9ee9a16a1b95e1c389d478",
  }),
  // The repository index at https://jmcgrath207.github.io/k8s-ephemeral-storage-metrics/chart lists this URL and this digest for 1.19.2.
  entry("k8s-ephemeral-storage-metrics", "k8s-ephemeral-storage-metrics", "1.19.2", "https://github.com/jmcgrath207/k8s-ephemeral-storage-metrics/releases/download/1.19.2/k8s-ephemeral-storage-metrics-1.19.2.tgz", "50efd37764505551f24752c3806e63458be775fc8c10fb1c68fe1f62b5ed4cf1", generic, {
    candidate: "k8s-ephemeral-storage-metrics",
    targetFacts: true,
  }),
  // Already Catalog entries at another version.
  entry("aws-ebs-csi-driver", "aws-ebs-csi-driver", "2.59.0", "https://github.com/kubernetes-sigs/aws-ebs-csi-driver/releases/download/helm-chart-aws-ebs-csi-driver-2.59.0/aws-ebs-csi-driver-2.59.0.tgz", "adb1961abcced2b66c49d4f64885d63b2fd824310c8d4f99c52c7d2c0193b118", generic, {
    candidate: "aws-ebs-csi-driver",
  }),
  // kube-prometheus-stack 84.4.0 is declared with the generic proof, not with kube-prometheus-stack-proof.mjs; the
  // candidate says why. Its AICR bases take their CRD bundle from the prometheus-operator-crds 28.0.1 entry below.
  entry("prometheus-community", "kube-prometheus-stack", "84.4.0", "https://github.com/prometheus-community/helm-charts/releases/download/kube-prometheus-stack-84.4.0/kube-prometheus-stack-84.4.0.tgz", "87bac65f32a358eeb52bda426cff20dd2fe3f1b61babe0b35866392bdd2721dd", generic, {
    candidate: "kube-prometheus-stack",
    ...hooks,
  }),
  entry("prometheus-community", "prometheus-operator-crds", "28.0.1", "https://github.com/prometheus-community/helm-charts/releases/download/prometheus-operator-crds-28.0.1/prometheus-operator-crds-28.0.1.tgz", "bc011e24c1e053955c11b0648cf73a4204bf0f8883d9427d7c50f4553dfd0129", generic, {
    candidate: "prometheus-operator-crds",
    targetFacts: true,
  }),
]);

// Held out. A chart enters the Catalog only after its chart licence and the
// source of that licence are recorded (data/chart-licenses/chart-licenses.yaml).
// Neither archive below states a licence: no LICENSE file, no licence field or
// annotation in Chart.yaml, and no licence header in any file. This change was
// made offline apart from the chart archives, so the upstream repository
// LICENSE was not read. Both archives pulled anonymously and both were rendered,
// packaged and verified; the commits that added and then removed their recipes
// and packages are in this branch's history, and the candidate declarations
// are still in scripts/lib/aicr-nested-chart-candidates.mjs. To bring one back,
// read the LICENSE at the release tag, add its licence row, move its entry
// into the list above, and run --generate --only <chart>.
export const AICR_NESTED_CHART_HELD = Object.freeze([
  {
    ...entry("node-feature-discovery", "node-feature-discovery", "0.19.0", "https://github.com/kubernetes-sigs/node-feature-discovery/releases/download/v0.19.0/node-feature-discovery-chart-0.19.0.tgz", "9e93b360e6167b782759026de40ba9d68d44c3e8b0b53b735592ad48fd3339ad", generic, {
      candidate: "node-feature-discovery",
      ...hooks,
    }),
    reason:
      "the chart licence is not recorded: the archive states none, and the LICENSE of kubernetes-sigs/node-feature-discovery at tag v0.19.0 was not read",
  },
  {
    // The archive's Chart.yaml names the version v0.5.29. The AICR Applications ask for 0.5.29, which Helm resolves to it.
    ...entry("eks", "aws-efa-k8s-device-plugin", "v0.5.29", "https://aws.github.io/eks-charts/aws-efa-k8s-device-plugin-v0.5.29.tgz", "078610ef669714f39be77d133674c7721fb3ca123213b3d6b16938c8c0d2e034", generic, {
      candidate: "aws-efa-k8s-device-plugin",
    }),
    reason: "the chart licence is not recorded: the archive states none, and the LICENSE of aws/eks-charts was not read",
  },
]);

// Discovery roles, in the vocabulary of scripts/lib/catalog-roles.mjs (cache,
// database, ingress, certificates, metrics, logs, secrets, queue, gpu), only
// where that vocabulary honestly fits. A role is discovery only: it claims no
// readiness, compatibility or support. A chart with no row here gets no role.
//
// No role: kai-scheduler (a scheduler), nodewright (node configuration),
// kubeflow-trainer (training jobs), aws-ebs-csi-driver (storage) and
// prometheus-operator-crds (CRDs only, no workload). The vocabulary has no word
// for any of them.
//
// A role assignment is keyed by a base-variant record and that record's
// configuration digest, and base-variant records exist only after publication.
// scripts/assign-nvidia-gpu-stack-roles.mjs --set aicr-nested-charts writes
// these once the records exist.
export const AICR_NESTED_CHART_ROLES = Object.freeze({
  "kube-prometheus-stack": {
    role: "metrics",
    componentType: "operator",
    rationale:
      "The retained operator and Prometheus custom resource describe an operator-managed monitoring stack; the operator cannot start until the admission Secret exists, and the CRDs and target readiness still require checks.",
  },
  "k8s-ephemeral-storage-metrics": {
    role: "metrics",
    componentType: "agent",
    rationale:
      "The Deployment exports each pod's ephemeral storage use as Prometheus metrics; it stores and queries nothing, and needs a Prometheus that scrapes its ServiceMonitor.",
  },
  "dra-driver-nvidia-gpu": {
    role: "gpu",
    componentType: "agent",
    rationale:
      "The kubelet plugin DaemonSet publishes NVIDIA devices to Kubernetes through Dynamic Resource Allocation; with GPU allocation off, as in the default and AICR bases, it publishes ComputeDomain devices only; it supplies no GPU hardware and no driver.",
  },
});

export function aicrNestedChartAddition(chart, version) {
  return AICR_NESTED_CHART_ADDITIONS.find((item) => item.chart === chart && item.version === version) ?? null;
}
