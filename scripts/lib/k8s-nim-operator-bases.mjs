// The reviewed k8s-nim-operator chart versions and bases, shared by the proof
// declaration (scripts/nvidia-gpu-stack-proof.mjs) and the packaged lifecycle
// generator (scripts/generate-gpu-operator-packaged-lifecycle.mjs) so both render
// the same inputs.
//
// The chart is the NVIDIA NIM Operator from the NGC Helm repository. Every held
// version has a default base, the chart-default render. 3.1.0 also has
// aicr-eks-inference: the values the AICR NIM inference recipes supply inline to
// their k8s-nim-operator Application, which pins 3.1.0.
//
// The release name and namespace are the ones those AICR Applications use
// (k8s-nim-operator in nvidia-nim), for every base, so the AICR base is the
// render AICR asks for and the bases of a version differ only by values.
// NVIDIA's own install instructions name both nim-operator.
//
// Nothing here needs an NGC key. The chart archive pulls anonymously, and no
// NIMService, NIMCache or model chart is part of this entry.

import { join } from "node:path";

import { readYaml, repoRoot } from "./proof-common.mjs";

export const nimOperatorChart = Object.freeze({
  repository: "nvidia",
  repositoryURL: "https://helm.ngc.nvidia.com/nvidia",
  name: "k8s-nim-operator",
  releaseName: "k8s-nim-operator",
  namespace: "nvidia-nim",
  kubeVersion: "1.31.0",
});

export const nimOperatorLifecycleRoot = "prerequisites/k8s-nim-operator-lifecycle";
export const nimOperatorExtrasRoot = "config-catalog/package-extras/nvidia/k8s-nim-operator";

export const nimOperatorCRDs = Object.freeze([
  "nemocustomizers.apps.nvidia.com",
  "nemodatastores.apps.nvidia.com",
  "nemoentitystores.apps.nvidia.com",
  "nemoevaluators.apps.nvidia.com",
  "nemoguardrails.apps.nvidia.com",
  "nimbuilds.apps.nvidia.com",
  "nimcaches.apps.nvidia.com",
  "nimpipelines.apps.nvidia.com",
  "nimservices.apps.nvidia.com",
]);

// The AICR NIM inference recipes carry the operator's values inline in the
// rendered Argo CD Application. Three retained examples carry the same bytes;
// the first is the binding, and its checksum list covers the Application file.
const aicrInference = {
  release: "v0.14.0",
  applicationPath: "examples/aicr/eks-h100-inference-nim/argocd-rendered/templates/k8s-nim-operator.yaml",
  checksumsPath: "examples/aicr/eks-h100-inference-nim/argocd-rendered/checksums.txt",
  checksumsEntry: "templates/k8s-nim-operator.yaml",
};

// One row per reviewed version. `objects` counts the ordinary objects chart
// defaults render (the nine CRDs included, Helm hooks excluded). `hooks` counts
// the hook-annotated objects, keyed by Helm hook phase: the pre-upgrade Job that
// applies the CRD files inside the operator image, with its ServiceAccount,
// ClusterRole and ClusterRoleBinding. `dependencies` counts the Chart.lock
// entries: dynamo-platform and dynamo-crds, both gated by dynamo.enabled, which
// is false by default and in every base.
const reviewed = {
  "3.1.0": { objects: 17, hooks: { "pre-upgrade": 4 }, dependencies: 2, aicr: { ...aicrInference, objects: 21 } },
  "3.1.2": { objects: 17, hooks: { "pre-upgrade": 4 }, dependencies: 2 },
};

export const nimOperatorReviewedVersions = Object.freeze(Object.keys(reviewed));

export function nimOperatorExpectations(version) {
  const row = reviewed[version];
  if (!row) throw new Error(`k8s-nim-operator ${version} needs reviewed version-specific assertions`);
  return row;
}

export function aicrInferenceApplication(binding) {
  return readYaml(join(repoRoot, binding.applicationPath));
}

// The objects the AICR values add to the default base: the admission webhook
// and the cert-manager objects that give it a certificate.
export const nimOperatorAdmissionObjects = Object.freeze([
  "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||k8s-nim-operator-validating-webhook-configuration",
  "cert-manager.io/v1|Certificate|nvidia-nim|k8s-nim-operator-serving-cert",
  "cert-manager.io/v1|Issuer|nvidia-nim|k8s-nim-operator-selfsigned-issuer",
  "v1|Service|nvidia-nim|k8s-nim-operator-webhook-service",
]);

// Where scripts/sync-installer-target-facts.mjs writes a base's CRD bundle.
function crdBundlePath(baseName) {
  const slug = String(baseName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `prerequisites/target-facts/${slug}-crds.yaml`;
}

// The bases of one version, in package order. The first is the package default.
export function nimOperatorBases(version) {
  const row = nimOperatorExpectations(version);
  const bases = [
    {
      name: "default",
      displayName: "chart defaults",
      valuesText: "",
      valuesSummary: "chart defaults: the operator, its RBAC and metrics Service and the nine CRDs; the admission controller and the Dynamo subcharts off",
      objects: row.objects,
    },
  ];
  if (row.aicr) {
    const application = aicrInferenceApplication(row.aicr);
    bases.push({
      name: "aicr-eks-inference",
      displayName: "AICR EKS NIM inference values",
      valuesText: `${String(application.spec.source.helm.values).replace(/\n*$/, "")}\n`,
      valuesSummary: `the values the AICR ${row.aicr.release} NIM inference recipes supply inline (${row.aicr.applicationPath}): the admission controller on with a cert-manager self-signed issuer, the operator tolerating every taint with no node affinity, Dynamo off`,
      objects: row.aicr.objects,
      addedToDefault: [...nimOperatorAdmissionObjects],
      // CRDs this base needs that the chart does not ship. The package carries a copy.
      externalCRDs: ["certificates.cert-manager.io", "issuers.cert-manager.io"],
      aicr: row.aicr,
    });
  }
  return bases.map((base) => ({
    ...base,
    valuesFile: base.name === "default" ? "effective-values.yaml" : `effective-values-${base.name}.yaml`,
    expected: { objects: base.objects, crds: [...nimOperatorCRDs].sort(), hooks: row.hooks },
    hookObjectCount: Object.values(row.hooks).reduce((sum, count) => sum + count, 0),
  }));
}

// What scripts/generate-gpu-operator-packaged-lifecycle.mjs needs to package this
// chart's Helm hook objects as recorded lifecycle actions.
export const nimOperatorLifecycleProfile = Object.freeze({
  chartName: "k8s-nim-operator",
  title: "NIM Operator",
  chart: nimOperatorChart,
  reviewedVersions: nimOperatorReviewedVersions,
  bases: nimOperatorBases,
  lifecycleRoot: nimOperatorLifecycleRoot,
  extrasRoot: nimOperatorExtrasRoot,
  crdBundlePath,
  preApply: (base) => ({
    name: `Install and establish the ${base.expected.crds.length} CRDs before the operator starts`,
    detail: base.externalCRDs
      ? "The operator Deployment watches these custom resources as soon as it starts, and cannot work until they are established. The bundle holds the CRDs this base renders and a copy of the two cert-manager CRDs its Certificate and Issuer need. cert-manager itself must already be running on the target; the bundle does not install it."
      : "The operator Deployment watches these custom resources as soon as it starts. The bundle holds exactly the CRDs this base renders. No object in the base is an instance of them, so nothing is rejected if they arrive late, but the operator cannot work until they are established.",
  }),
  actionFor(phase) {
    if (phase === "pre-upgrade") {
      return {
        name: "Before an upgrade, move the CRDs to the new version",
        detail:
          "Helm does not upgrade CRDs from a chart's crds directory, so the chart ships this Job: it applies the CRD files inside the new operator image, with its own ServiceAccount, ClusterRole and ClusterRoleBinding. A workflow that applies this base's CRD bundle before the other objects does the same work and should skip the Job. A workflow that leaves CRDs alone must run these four objects first, wait for the Job to complete, then delete them.",
      };
    }
    throw new Error(`k8s-nim-operator hook phase ${phase} has no reviewed lifecycle action`);
  },
  readmeIntro:
    "The k8s-nim-operator chart renders more than the objects a base holds. It also\nrenders Helm hook objects, which Helm runs when a release is upgraded. They are\nkept here, apart from the base, because applying them as ordinary objects would\nrun them at install time.",
});
