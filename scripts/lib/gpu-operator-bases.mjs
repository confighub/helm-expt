// The reviewed gpu-operator chart versions and bases, shared by the proof
// declaration (scripts/gpu-operator-proof.mjs) and the packaged lifecycle
// generator (scripts/generate-gpu-operator-packaged-lifecycle.mjs) so both render
// the same inputs.
//
// Every held chart version has these bases:
//
//   default                           chart defaults
//   driver-<version>                  only driver.version changed, once for each
//                                     driver version that is the chart default of
//                                     another held chart version
//   preinstalled-driver               driver.enabled false
//   preinstalled-driver-and-toolkit   driver.enabled false, toolkit.enabled false
//   external-nfd                      nfd.enabled false
//
// The last three are deployment scenarios NVIDIA's GPU Operator documentation
// describes: the NVIDIA driver already on the nodes, the driver and the container
// toolkit already on the nodes, and Node Feature Discovery already running in
// the cluster. Each changes only the keys named above, and every key was read
// from that chart version's own values.yaml.
//
// A driver-<version> base answers one question: what changes in the rendered
// objects when only the driver version moves. It says nothing about whether
// that driver works with that chart version or with any operating system.
// Nobody checked that here, and each such base says so.
//
// The aicr-eks-training base uses, byte for byte, the values an AICR recipe
// supplies to its gpu-operator Application. v26.3.3 takes them from the AICR
// v0.20.0 example and is checked against that example's nested-render receipt.
// v26.7.1 takes them from the AICR v1.0.0 example, which retains the values but
// no nested render, so that base is bound to the values bytes only.

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

// One row per reviewed version. `objects` counts the ordinary objects the chart
// defaults render (CRDs included, Helm hooks excluded). `nfdObjects` counts the
// ordinary objects that leave when nfd.enabled is false, three of them CRDs.
// `hooks` counts the hook-annotated objects chart defaults render, keyed by Helm
// hook phase; the post-delete set belongs to node-feature-discovery.
// `driverVersion` is the chart default, which lands at ClusterPolicy
// /spec/driver/version. `aicr` binds the aicr-eks-training base to retained AICR
// values, with the object count those values render.
const reviewed = {
  "v25.10.1": {
    nfdVersion: "0.18.2",
    objects: 24,
    nfdObjects: 15,
    crds: [...nvidiaCRDs, ...nfdCRDs],
    hooks: { "pre-upgrade": 4, "post-delete": 4 },
    driverVersion: "580.105.08",
  },
  "v26.3.2": {
    nfdVersion: "0.18.3",
    objects: 24,
    nfdObjects: 15,
    crds: [...nvidiaCRDs, ...nfdCRDs],
    hooks: { "pre-upgrade": 4, "post-delete": 4 },
    driverVersion: "580.126.20",
  },
  "v26.3.3": {
    nfdVersion: "0.18.3",
    objects: 24,
    nfdObjects: 15,
    crds: [...nvidiaCRDs, ...nfdCRDs],
    hooks: { "pre-upgrade": 4, "post-delete": 4 },
    driverVersion: "580.126.20",
    aicr: {
      release: "v0.20.0",
      valuesPath: "examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/009-gpu-operator/values.yaml",
      nestedRenderReceiptPath: "examples/aicr/eks-h100-training-kubeflow-v0-20-0/nested-renders/gpu-operator/receipt.yaml",
      objects: 10,
      driverVersion: "580.173.02",
    },
  },
  "v26.7.1": {
    nfdVersion: "0.19.0",
    objects: 27,
    nfdObjects: 15,
    crds: [...nvidiaCRDs, ...nfdCRDs, ...draCRDs],
    hooks: { "pre-upgrade": 4, "pre-delete": 1, "post-delete": 4 },
    driverVersion: "595.91.07",
    aicr: {
      release: "v1.0.0",
      valuesPath: "examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/009-gpu-operator/values.yaml",
      nestedRenderReceiptPath: null,
      // With no nested render to compare, the values are bound to the bundle's own
      // checksum list and the chart version to the bundle's Application template.
      bundleChecksumsPath: "examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/checksums.txt",
      bundleChecksumsEntry: "009-gpu-operator/values.yaml",
      applicationTemplatePath: "examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/templates/gpu-operator.yaml",
      applicationTargetRevision: "26.7.1",
      objects: 13,
      driverVersion: "580.173.02",
    },
  },
};

export const gpuOperatorReviewedVersions = Object.freeze(Object.keys(reviewed));

// The driver versions that are the chart default of at least one held chart version.
export const gpuOperatorHeldDriverVersions = Object.freeze(
  [...new Set(Object.values(reviewed).map((row) => row.driverVersion))].sort(),
);

export const DRIVER_SUPPORT_NOT_CHECKED =
  "driver support for this chart version and for any operating system was not checked";

// Where scripts/sync-installer-target-facts.mjs writes a base's CRD bundle inside
// the package. It replaces every run of other characters in the base name with a
// dash, so driver-580.126.20 becomes driver-580-126-20-crds.yaml.
export function crdBundlePath(baseName) {
  const slug = String(baseName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `prerequisites/target-facts/${slug}-crds.yaml`;
}

export function gpuOperatorExpectations(version) {
  const row = reviewed[version];
  if (!row) throw new Error(`gpu-operator ${version} needs reviewed version-specific assertions`);
  return row;
}

const withoutNfd = (row) => ({
  objects: row.objects - row.nfdObjects,
  crds: row.crds.filter((name) => !nfdCRDs.includes(name)),
  hooks: Object.fromEntries(Object.entries(row.hooks).filter(([phase]) => phase !== "post-delete")),
});

// The bases of one version, in package order. The first is the package default.
// `kind` is default, driver, scenario or aicr. `policy` holds the ClusterPolicy
// fields the proof asserts for the base. `nfd` says whether the bundled
// node-feature-discovery renders.
export function gpuOperatorBases(version) {
  const row = gpuOperatorExpectations(version);
  const full = { objects: row.objects, crds: row.crds, hooks: row.hooks };
  const policy = { driverVersion: row.driverVersion, driverEnabled: true, toolkitEnabled: true };
  const bases = [
    {
      name: "default",
      kind: "default",
      displayName: "chart defaults",
      valuesText: "",
      valuesSummary: `chart defaults: the bundled node-feature-discovery on, driver ${row.driverVersion}`,
      nfd: true,
      ...full,
      policy,
    },
    ...gpuOperatorHeldDriverVersions
      .filter((driverVersion) => driverVersion !== row.driverVersion)
      .map((driverVersion) => {
        const from = Object.entries(reviewed)
          .filter(([, other]) => other.driverVersion === driverVersion)
          .map(([otherVersion]) => otherVersion);
        return {
          name: `driver-${driverVersion}`,
          kind: "driver",
          displayName: `driver ${driverVersion} (${DRIVER_SUPPORT_NOT_CHECKED})`,
          valuesText: `driver:\n  version: "${driverVersion}"\n`,
          valuesSummary: `chart defaults with only driver.version changed, from ${row.driverVersion} to ${driverVersion}, the default driver of chart ${from.join(" and ")}; ${DRIVER_SUPPORT_NOT_CHECKED}`,
          changedValues: ["driver.version"],
          driverDefaultOf: from,
          nfd: true,
          ...full,
          policy: { ...policy, driverVersion },
        };
      }),
    {
      name: "preinstalled-driver",
      kind: "scenario",
      displayName: "pre-installed NVIDIA driver",
      valuesText: "driver:\n  enabled: false\n",
      valuesSummary:
        "the NVIDIA driver is already installed on the GPU nodes: driver.enabled false, so the operator deploys no driver; everything else is chart defaults",
      changedValues: ["driver.enabled"],
      targetNeeds: "the GPU nodes must already have the NVIDIA driver installed",
      nfd: true,
      ...full,
      policy: { ...policy, driverEnabled: false },
    },
    {
      name: "preinstalled-driver-and-toolkit",
      kind: "scenario",
      displayName: "pre-installed NVIDIA driver and container toolkit",
      valuesText: "driver:\n  enabled: false\ntoolkit:\n  enabled: false\n",
      valuesSummary:
        "the NVIDIA driver and the NVIDIA Container Toolkit are already installed on the GPU nodes: driver.enabled false and toolkit.enabled false, so the operator deploys neither; everything else is chart defaults",
      changedValues: ["driver.enabled", "toolkit.enabled"],
      targetNeeds: "the GPU nodes must already have the NVIDIA driver and the NVIDIA Container Toolkit installed",
      nfd: true,
      ...full,
      policy: { ...policy, driverEnabled: false, toolkitEnabled: false },
    },
    {
      name: "external-nfd",
      kind: "scenario",
      displayName: "Node Feature Discovery already in the cluster",
      valuesText: "nfd:\n  enabled: false\n",
      valuesSummary:
        "Node Feature Discovery already runs in the cluster: nfd.enabled false, so the bundled node-feature-discovery, its three CRDs and its post-delete prune hook do not render; everything else is chart defaults",
      changedValues: ["nfd.enabled"],
      targetNeeds: "the target must already run Node Feature Discovery",
      nfd: false,
      ...withoutNfd(row),
      policy,
    },
  ];
  if (row.aicr) {
    bases.push({
      name: "aicr-eks-training",
      kind: "aicr",
      displayName: "AICR EKS training values",
      valuesText: readFileSync(join(repoRoot, row.aicr.valuesPath), "utf8"),
      valuesSummary: `the values the AICR ${row.aicr.release} EKS training recipe supplies (${row.aicr.valuesPath}): node-feature-discovery off, driver ${row.aicr.driverVersion}, a dcgm-exporter metrics ConfigMap`,
      targetNeeds: "the target must already run Node Feature Discovery",
      aicr: row.aicr,
      nfd: false,
      ...withoutNfd(row),
      objects: row.aicr.objects,
      policy: { ...policy, driverVersion: row.aicr.driverVersion },
    });
  }
  return bases.map((base) => ({
    ...base,
    valuesFile: base.name === "default" ? "effective-values.yaml" : `effective-values-${base.name}.yaml`,
    expected: {
      objects: base.objects,
      crds: [...base.crds].sort(),
      hooks: base.hooks,
      driverVersion: base.policy.driverVersion,
    },
    hookObjectCount: Object.values(base.hooks).reduce((sum, count) => sum + count, 0),
  }));
}

// What scripts/generate-gpu-operator-packaged-lifecycle.mjs needs to package this
// chart's Helm hook objects as recorded lifecycle actions. The wording of each
// action is the recorded route for a delivery workflow that applies rendered
// objects instead of running Helm.
export const gpuOperatorLifecycleProfile = Object.freeze({
  chartName: "gpu-operator",
  title: "GPU Operator",
  chart: gpuOperatorChart,
  reviewedVersions: gpuOperatorReviewedVersions,
  bases: gpuOperatorBases,
  lifecycleRoot: packagedLifecycleRoot,
  extrasRoot: packageExtrasRoot,
  crdBundlePath,
  preApply: (base) => ({
    name: `Install and establish the ${base.expected.crds.length} CRDs before the ClusterPolicy object`,
    detail:
      "Kubernetes rejects the rendered ClusterPolicy until clusterpolicies.nvidia.com is established. The bundle holds exactly the CRDs this base renders.",
  }),
  actionFor(phase) {
    if (phase === "pre-upgrade") {
      return {
        name: "Before an upgrade, move the CRDs to the new version",
        detail:
          "Helm does not upgrade CRDs from a chart's crds directory, so the chart ships this Job: it applies the CRD files inside the new operator image, with its own ServiceAccount, ClusterRole and ClusterRoleBinding. A workflow that applies this base's CRD bundle before the other objects does the same work and should skip the Job. A workflow that leaves CRDs alone must run these four objects first, wait for the Job to complete, then delete them.",
      };
    }
    if (phase === "pre-delete") {
      return {
        name: "Before deleting, remove a chart-managed GPUCluster and wait for it to go",
        detail:
          "The Job deletes the chart-managed GPUCluster object and waits until it is gone, so the operator can drain workloads under its finalizer while it is still running. It uses the base's own gpu-operator ServiceAccount, so run it and wait for it before deleting the base objects. It does nothing when no GPUCluster exists, which is the case for this base as rendered.",
      };
    }
    if (phase === "post-delete") {
      return {
        name: "After deleting, prune node-feature-discovery labels from the nodes",
        detail:
          "The Job runs nfd-master -prune, which removes node-feature-discovery labels, annotations and taints from every node, with its own ServiceAccount, ClusterRole and ClusterRoleBinding. Apply the four objects only after the base objects are deleted, wait for the Job to complete, then delete them. Never apply them with the base: at install time the prune would run immediately.",
      };
    }
    throw new Error(`gpu-operator hook phase ${phase} has no reviewed lifecycle action`);
  },
  readmeIntro:
    "The gpu-operator chart renders more than the objects a base holds. It also\nrenders Helm hook objects, which Helm runs when a release is upgraded or\ndeleted. They are kept here, apart from the base, because applying them as\nordinary objects would run them at install time.",
});
