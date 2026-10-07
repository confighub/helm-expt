// The NVIDIA GPU stack charts the project references that were not yet standalone
// Catalog entries, and how the Workshop Catalog checks each. The gpu-operator and
// nvsentinel versions are the ones the AICR recipes pin (v0.19.0, v0.20.0 and
// v1.0.0), plus neighbouring releases so a version-to-version object diff has both
// sides. k8s-nim-operator is held at the version the AICR NIM inference recipes
// pin and at the latest release. Each entry below is one addition, addressed by its exact archive URL and
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
//
// The bases of each version are declared with its proof: scripts/lib/gpu-operator-bases.mjs,
// scripts/lib/k8s-nim-operator-bases.mjs and scripts/nvidia-gpu-stack-proof.mjs.

import { canonicalObjectMaps } from "./proof-common.mjs";

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
  // AICR v1.0.0 pins this version (examples/aicr/eks-h100-training-kubeflow-v1-0-0 names targetRevision 26.7.1). Its
  // aicr-eks-training base uses the values that example retains; the example has no nested render to compare with.
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
  // k8s-nim-operator from the NGC Helm repository, pulled anonymously on 2026-10-07. Each SHA-256 equals the digest the
  // repository index listed for that version. The AICR NIM inference recipes pin 3.1.0; 3.1.2 was the latest release.
  entry("k8s-nim-operator", "3.1.0", "https://helm.ngc.nvidia.com/nvidia/charts/k8s-nim-operator-3.1.0.tgz", "2d333ae76a17d687cd7987454d194378b8709eaefe11a675b01f92ee5bb99a47", generic, {
    candidate: "k8s-nim-operator",
    lifecycle: "generate-gpu-operator-packaged-lifecycle.mjs",
    targetFacts: true,
  }),
  entry("k8s-nim-operator", "3.1.2", "https://helm.ngc.nvidia.com/nvidia/charts/k8s-nim-operator-3.1.2.tgz", "ebb31e27b4a62d22ac10a24083ff21a340e48030b1ac4c1e7b99b24318f8f92a", generic, {
    candidate: "k8s-nim-operator",
    lifecycle: "generate-gpu-operator-packaged-lifecycle.mjs",
    targetFacts: true,
  }),
]);

// Discovery roles for these charts, in the vocabulary of scripts/lib/catalog-roles.mjs.
// A role assignment is keyed by a base-variant record and that record's
// configuration digest, and base-variant records exist only after publication.
// So the classification is kept here, and scripts/assign-nvidia-gpu-stack-roles.mjs
// writes it into data/catalog-roles/assignments.json once the records exist.
// A role is discovery only: it claims no readiness, compatibility or support.
export const NVIDIA_GPU_STACK_ROLES = Object.freeze({
  "gpu-operator": {
    role: "gpu",
    componentType: "operator",
    rationale:
      "The Deployment installs the GPU Operator and a ClusterPolicy that tells it which driver, toolkit and device-plugin workloads to run on GPU nodes; it supplies no GPU hardware.",
  },
  nvsentinel: {
    role: "gpu",
    componentType: "agent",
    rationale:
      "The node DaemonSets watch GPU and system-log health and report faults; as retained they quarantine or repair nothing, and they supply no GPU capacity.",
  },
  "cluster-readiness-engine": {
    role: "gpu",
    componentType: "operator",
    rationale:
      "The Deployment installs a controller that certifies GPU clusters from Certification custom resources; it certifies nothing until one is created on a cluster with GPU nodes.",
  },
  "k8s-nim-operator": {
    role: "gpu",
    componentType: "operator",
    rationale:
      "The Deployment installs the NIM Operator, which runs GPU inference microservices from NIMService and NIMCache custom resources; it deploys no model, and a model still needs GPU nodes and an NGC key.",
  },
});

export function nvidiaGpuStackAddition(chart, version) {
  return NVIDIA_GPU_STACK_ADDITIONS.find((item) => item.chart === chart && item.version === version) ?? null;
}

// JSON-pointer paths at which two parsed objects differ.
export function changedPaths(left, right, path = "") {
  if (left === right) return [];
  const leftIsObject = left !== null && typeof left === "object";
  const rightIsObject = right !== null && typeof right === "object";
  if (!leftIsObject || !rightIsObject || Array.isArray(left) !== Array.isArray(right)) return [path || "/"];
  if (Array.isArray(left)) {
    const paths = [];
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      if (index >= left.length || index >= right.length) paths.push(`${path}/${index}`);
      else paths.push(...changedPaths(left[index], right[index], `${path}/${index}`));
    }
    return paths;
  }
  const paths = [];
  for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    const next = `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
    if (!(key in left) || !(key in right)) paths.push(next);
    else paths.push(...changedPaths(left[key], right[key], next));
  }
  return paths;
}

const isPlain = (value) => value === undefined || value === null || typeof value !== "object";

function valueAt(object, pointer) {
  let current = object;
  for (const token of pointer.split("/").slice(1)) {
    if (current === null || typeof current !== "object") return undefined;
    current = current[token.replaceAll("~1", "/").replaceAll("~0", "~")];
  }
  return current;
}

// What differs between two rendered object sets: identities only in the first,
// identities only in the second, and for each object in both, the fields that moved.
export function objectDelta(fromYaml, toYaml) {
  const maps = canonicalObjectMaps(fromYaml, toYaml);
  const from = maps.helm;
  const to = maps.cub;
  const removed = Object.keys(from).filter((key) => !(key in to)).sort();
  const added = Object.keys(to).filter((key) => !(key in from)).sort();
  const changed = Object.keys(from)
    .filter((key) => key in to && from[key] !== to[key])
    .sort()
    .map((key) => {
      const left = JSON.parse(from[key]);
      const right = JSON.parse(to[key]);
      const paths = changedPaths(left, right);
      // For a field that holds a plain value on either side, record both values.
      const values = Object.fromEntries(
        paths
          .map((path) => [path, { from: valueAt(left, path), to: valueAt(right, path) }])
          .filter(([, pair]) => isPlain(pair.from) && isPlain(pair.to) && (pair.from !== undefined || pair.to !== undefined)),
      );
      return { key, paths, values };
    });
  return { fromCount: Object.keys(from).length, toCount: Object.keys(to).length, removed, added, changed };
}
