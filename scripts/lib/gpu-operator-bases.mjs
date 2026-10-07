// The reviewed gpu-operator chart versions and bases, shared by the proof
// declaration (scripts/gpu-operator-proof.mjs) and the packaged lifecycle
// generator (scripts/generate-gpu-operator-packaged-lifecycle.mjs) so both render
// the same inputs.
//
// The aicr-eks-training base uses, byte for byte, the values the AICR recipe
// supplies to its gpu-operator Application. Only v26.3.3 has it, because that is
// the only gpu-operator version with AICR values retained in this repository.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./proof-common.mjs";

export const gpuOperatorChart = Object.freeze({
  repository: "nvidia",
  repositoryURL: "https://helm.ngc.nvidia.com/nvidia",
  name: "gpu-operator",
  releaseName: "gpu-operator",
  namespace: "gpu-operator",
  kubeVersion: "1.31.0",
});

export const AICR_VALUES_PATH =
  "examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/009-gpu-operator/values.yaml";
export const AICR_NESTED_RENDER_RECEIPT_PATH =
  "examples/aicr/eks-h100-training-kubeflow-v0-20-0/nested-renders/gpu-operator/receipt.yaml";

export const packagedLifecycleRoot = "prerequisites/gpu-operator-lifecycle";
export const packageExtrasRoot = "config-catalog/package-extras/nvidia/gpu-operator";

const nvidiaCRDs = ["clusterpolicies.nvidia.com", "nvidiadrivers.nvidia.com"];
const nfdCRDs = [
  "nodefeaturegroups.nfd.k8s-sigs.io",
  "nodefeaturerules.nfd.k8s-sigs.io",
  "nodefeatures.nfd.k8s-sigs.io",
];
const draCRDs = [
  "computedomaincliques.resource.nvidia.com",
  "computedomains.resource.nvidia.com",
  "gpuclusters.nvidia.com",
];

// One row per reviewed version. `objects` counts the ordinary rendered objects
// (CRDs included, Helm hooks excluded). `hooks` counts the hook-annotated
// objects the same values render, keyed by Helm hook phase. `driverVersion` is
// the value that lands at ClusterPolicy /spec/driver/version.
const reviewed = {
  "v25.10.1": {
    nfdVersion: "0.18.2",
    bases: {
      default: { objects: 24, crds: [...nvidiaCRDs, ...nfdCRDs], hooks: { "pre-upgrade": 4, "post-delete": 4 }, driverVersion: "580.105.08" },
    },
  },
  "v26.3.2": {
    nfdVersion: "0.18.3",
    bases: {
      default: { objects: 24, crds: [...nvidiaCRDs, ...nfdCRDs], hooks: { "pre-upgrade": 4, "post-delete": 4 }, driverVersion: "580.126.20" },
    },
  },
  "v26.3.3": {
    nfdVersion: "0.18.3",
    bases: {
      default: { objects: 24, crds: [...nvidiaCRDs, ...nfdCRDs], hooks: { "pre-upgrade": 4, "post-delete": 4 }, driverVersion: "580.126.20" },
      "aicr-eks-training": { objects: 10, crds: [...nvidiaCRDs], hooks: { "pre-upgrade": 4 }, driverVersion: "580.173.02" },
    },
  },
  "v26.7.1": {
    nfdVersion: "0.19.0",
    bases: {
      default: {
        objects: 27,
        crds: [...nvidiaCRDs, ...nfdCRDs, ...draCRDs],
        hooks: { "pre-upgrade": 4, "pre-delete": 1, "post-delete": 4 },
        driverVersion: "595.91.07",
      },
    },
  },
};

export const gpuOperatorReviewedVersions = Object.freeze(Object.keys(reviewed));

export function gpuOperatorExpectations(version) {
  const row = reviewed[version];
  if (!row) throw new Error(`gpu-operator ${version} needs reviewed version-specific assertions`);
  return row;
}

export function aicrValuesText() {
  return readFileSync(join(repoRoot, AICR_VALUES_PATH), "utf8");
}

// The bases of one version, in package order. The first is the package default.
export function gpuOperatorBases(version) {
  const row = gpuOperatorExpectations(version);
  return Object.entries(row.bases).map(([name, expected]) => ({
    name,
    expected: { ...expected, crds: [...expected.crds].sort() },
    valuesText: name === "aicr-eks-training" ? aicrValuesText() : "",
    hookObjectCount: Object.values(expected.hooks).reduce((sum, count) => sum + count, 0),
  }));
}
