// The NVIDIA GPU stack charts the project references that were not yet standalone
// Catalog entries, and how the Workshop Catalog checks each. The gpu-operator and
// nvsentinel versions are the ones the AICR recipes pin (v0.19.0, v0.20.0 and
// v1.0.0), plus neighbouring releases so a version-to-version object diff has both
// sides. Each entry below is one addition, addressed by its exact archive URL and
// SHA-256.
//
// `script` is the proof declaration that renders and packages the chart;
// `candidate` selects the entry inside scripts/nvidia-gpu-stack-proof.mjs.
// `ociManifestDigest` records the registry manifest the archive was pulled from on
// 2026-10-07. It is informational: the proof verifies the archive SHA-256, not the
// tag, so a moved tag fails the check instead of changing the entry.
// `lifecycle` names the generator that packages the chart's Helm hook objects as
// recorded lifecycle actions. `targetFacts` says the bases declare target facts,
// so the CRD bundle is synced into the package after it is generated.

const entry = (chart, version, url, sha256, script, extra = {}) =>
  Object.freeze({
    canonicalIdentity: `nvidia/${chart}`,
    repository: "nvidia",
    chart,
    version,
    url,
    sha256,
    script,
    ...extra,
    recipePath: `recipes/nvidia/${chart}/${version}`,
    packagePath: `packages/nvidia/${chart}/${version}`,
  });

const generic = "nvidia-gpu-stack-proof.mjs";
const gpuOperator = {
  lifecycle: "generate-gpu-operator-packaged-lifecycle.mjs",
  targetFacts: true,
};

export const NVIDIA_GPU_STACK_ADDITIONS = Object.freeze([
  // gpu-operator from the NGC Helm repository. Each SHA-256 equals the digest the
  // repository index listed for that version on 2026-10-07.
  entry("gpu-operator", "v25.10.1", "https://helm.ngc.nvidia.com/nvidia/charts/gpu-operator-v25.10.1.tgz", "9532cc4dd59248e0eb2a0cd4baa6a7e8ed4258b5d7588ae9c13f5c839482efe5", "gpu-operator-proof.mjs", gpuOperator),
  entry("gpu-operator", "v26.3.2", "https://helm.ngc.nvidia.com/nvidia/charts/gpu-operator-v26.3.2.tgz", "b6b7b7a6d40bb8420d50e46c1169c097028ad19a0457d32156568db8214af77f", "gpu-operator-proof.mjs", gpuOperator),
  // AICR v0.19.0 and v0.20.0 pin this archive (their nested-render receipts record the same SHA-256).
  entry("gpu-operator", "v26.3.3", "https://helm.ngc.nvidia.com/nvidia/charts/gpu-operator-v26.3.3.tgz", "59abb5852a24b3ae0ef757bfea3051f419acbf559ee5efd72f0672d28af56a68", "gpu-operator-proof.mjs", gpuOperator),
  // AICR v1.0.0 pins this version (examples/aicr/eks-h100-training-kubeflow-v1-0-0 names targetRevision 26.7.1). That
  // example retains values for it, but no nested-render receipt to check an AICR base against, so this version has the
  // default base only. Adding an AICR base for it is a separate decision.
  entry("gpu-operator", "v26.7.1", "https://helm.ngc.nvidia.com/nvidia/charts/gpu-operator-v26.7.1.tgz", "fdce4cba07db5ddb6dfd0bdf61276a44c24136f2b193bc6ebc81dd1b0f049777", "gpu-operator-proof.mjs", gpuOperator),
  // nvsentinel: AICR v0.19.0 pins v1.9.0, AICR v0.20.0 pins v1.20.0, AICR v1.0.0 pins v1.25.0 (the same example), and v1.26.0 was the latest release on 2026-10-07.
  entry("nvsentinel", "v1.9.0", "oci://ghcr.io/nvidia/nvsentinel:v1.9.0", "3f145e8ac66057f06ac434619abbe7aa24b384e63713fc0a55e7f47493335220", generic, {
    candidate: "nvsentinel",
    targetFacts: true,
    ociManifestDigest: "sha256:1c2dea5866972f53b4eed56e89119dc6eec0f3e287e96390fbbe8988644e68b3",
  }),
  entry("nvsentinel", "v1.20.0", "oci://ghcr.io/nvidia/nvsentinel:v1.20.0", "0e3c8836dfb2123e8cbf0e565ea51ed89bc2a913f90e20e23eb3032037c926e3", generic, {
    candidate: "nvsentinel",
    targetFacts: true,
    ociManifestDigest: "sha256:b5dfd2f6b0020ab869b312b0eab1d3df0ee25ed70079d88e946f0f24e799e583",
  }),
  entry("nvsentinel", "v1.25.0", "oci://ghcr.io/nvidia/nvsentinel:v1.25.0", "1c1889c6b908ab5fea088aac47e892e417ca29d8c347ef7f9b52ef5bcf593c59", generic, {
    candidate: "nvsentinel",
    targetFacts: true,
    ociManifestDigest: "sha256:0e01c4a5a92126ae2b23a77ec4d1d12d708734100735265c081326a4702ac305",
  }),
  entry("nvsentinel", "v1.26.0", "oci://ghcr.io/nvidia/nvsentinel:v1.26.0", "bba6a7bfd5a8dc27fe6157cdabb4f5b50a390cd657c79288f86bcd3b1994c68e", generic, {
    candidate: "nvsentinel",
    targetFacts: true,
    ociManifestDigest: "sha256:b5b05f216120c4155beba88fc52b8976d1753029b022f2aa65e25292282f9d05",
  }),
  // cluster-readiness-engine: the v0.6.0 release notes name this manifest digest as the published chart.
  entry("cluster-readiness-engine", "v0.6.0", "oci://ghcr.io/nvidia/cluster-readiness-engine:v0.6.0", "dc85e9cb4ec6b481f62315c5cff95cc4353b58dfa2a5ba86cb347fb509ee8a43", generic, {
    candidate: "cluster-readiness-engine",
    targetFacts: true,
    ociManifestDigest: "sha256:af20cf1d7827a35e60a539ef9f7fc8445e0def61f345e8bdb030afc76f01f6cf",
  }),
]);

export function nvidiaGpuStackAddition(chart, version) {
  return NVIDIA_GPU_STACK_ADDITIONS.find((item) => item.chart === chart && item.version === version) ?? null;
}
