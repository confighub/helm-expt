// Exact-artifact package proofs for the NVIDIA GPU stack charts that need no
// chart-specific machinery: nvsentinel, cluster-readiness-engine and
// k8s-nim-operator. gpu-operator has its own declaration
// (scripts/gpu-operator-proof.mjs) because its Helm hooks are packaged as
// lifecycle actions.
//
// Every chart has a default base, the chart-default render. nvsentinel also has
// no-pod-monitor, the one scenario its values.yaml documents without bringing in
// a datastore, and aicr-eks-training wherever the repository retains the values
// an AICR recipe supplies for that exact chart version.
//
// scripts/nvidia-gpu-stack-coverage.mjs supplies and independently verifies the
// exact artifact URL and SHA-256. This declaration never resolves a mutable tag
// or repository index without checking the archive bytes it returns.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runProofCli } from "./lib/proof-kit.mjs";
import { canonicalObjectMaps, identityFor, parseDocs, readYaml, repoRoot, sha256 } from "./lib/proof-common.mjs";
import { objectDelta } from "./lib/nvidia-gpu-stack-coverage.mjs";
import {
  aicrInferenceApplication,
  nimOperatorBases,
  nimOperatorChart,
  nimOperatorCRDs,
  nimOperatorExpectations,
  nimOperatorExtrasRoot,
  nimOperatorLifecycleRoot,
  nimOperatorReviewedVersions,
} from "./lib/k8s-nim-operator-bases.mjs";

const candidateName = process.env.HELM_EXPT_NVIDIA_GPU_STACK_CANDIDATE ?? "";
const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "";
const deliveryLanes = ["regularHelm", "cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"];

// The Prometheus Operator CRDs these charts need on the target come from the
// newest kube-prometheus-stack render the Catalog holds.
const prometheusOperatorCRDSource = {
  sourcePath: "../../../prometheus-community/kube-prometheus-stack/88.6.3/revisions/default/r001/rendered/release-objects.yaml",
  sourceVariant: "prometheus-community/kube-prometheus-stack@88.6.3/default",
};

// The cert-manager CRDs the NIM Operator admission controller needs on the
// target come from the newest cert-manager render the Catalog holds.
const certManagerCRDSource = {
  sourcePath: "../../../jetstack/cert-manager/v1.21.1/revisions/crds-enabled/r001/rendered/release-objects.yaml",
  sourceVariant: "jetstack/cert-manager@v1.21.1/crds-enabled",
};

const nvcreCRDs = [
  "bandwidthmeasurements.nvcre.nvidia.com",
  "certifications.nvcre.nvidia.com",
  "goodputmeasurements.nvcre.nvidia.com",
  "jobs.nvcre.nvidia.com",
  "logprofiles.nvcre.nvidia.com",
  "workflows.nvcre.nvidia.com",
  "workloadruns.nvcre.nvidia.com",
];

// The values an AICR recipe supplies to its nvsentinel Application, per chart
// version. Where the example retains a nested render, the base is compared with
// it. Where it retains only the bundle, the values bytes are checked against the
// bundle's checksum list and the chart version against its Application.
const aicrExample = (release, directory, { nestedRender }) => {
  const root = `examples/aicr/${directory}`;
  return {
    release,
    valuesPath: `${root}/argocd-helm-bundle/015-nvsentinel/values.yaml`,
    nestedRenderReceiptPath: nestedRender ? `${root}/nested-renders/nvsentinel/receipt.yaml` : null,
    bundleChecksumsPath: `${root}/argocd-helm-bundle/checksums.txt`,
    bundleChecksumsEntry: "015-nvsentinel/values.yaml",
    applicationTemplatePath: `${root}/argocd-helm-bundle/templates/nvsentinel.yaml`,
  };
};

const candidates = {
  nvsentinel: {
    repositoryURL: "oci://ghcr.io/nvidia",
    name: "nvsentinel",
    releaseName: "nvsentinel",
    namespace: "nvsentinel",
    // objects: rendered objects with chart defaults. dependencies: entries in the
    // packaged Chart.lock, which is what the dependency lock records.
    versions: {
      "v1.9.0": { objects: 21, crds: [], dependencies: 15, aicr: { ...aicrExample("v0.19.0", "eks-h100-training-kubeflow-v0-19-0", { nestedRender: true }), objects: 20 } },
      "v1.20.0": { objects: 22, crds: [], dependencies: 16, aicr: { ...aicrExample("v0.20.0", "eks-h100-training-kubeflow-v0-20-0", { nestedRender: true }), objects: 21 } },
      "v1.25.0": { objects: 22, crds: [], dependencies: 16, aicr: { ...aicrExample("v1.0.0", "eks-h100-training-kubeflow-v1-0-0", { nestedRender: false }), objects: 21 } },
      // No retained AICR example pins v1.26.0, so it has no AICR base.
      "v1.26.0": { objects: 22, crds: [], dependencies: 16 },
    },
    // Bases beyond the chart-default one. Each lists the objects it removes from
    // the default base and whether it still renders the PodMonitor.
    extraBases: (version, expected) => [
      {
        name: "no-pod-monitor",
        displayName: "no PodMonitor, for a cluster without the Prometheus Operator",
        valuesText: "podMonitor:\n  enabled: false\n",
        valuesSummary:
          "chart defaults with podMonitor.enabled false, which the chart's values.yaml gives for a cluster that scrapes with standard Prometheus annotations instead of the Prometheus Operator; the PodMonitor does not render, so no Prometheus Operator CRD is needed",
        objects: expected.objects - 1,
        podMonitor: false,
        requiredCRDs: [],
        removedFromDefault: ["monitoring.coreos.com/v1|PodMonitor||nvsentinel"],
        changesNothingElse: true,
        targetFactNote: "this base needs no CRD on the target; the rendered objects carry no namespace, so they must be applied into the nvsentinel namespace",
      },
      ...(expected.aicr
        ? [
            {
              name: "aicr-eks-training",
              displayName: "AICR EKS training values",
              valuesText: readFileSync(join(repoRoot, expected.aicr.valuesPath), "utf8"),
              valuesSummary: `the values the AICR ${expected.aicr.release} EKS training recipe supplies (${expected.aicr.valuesPath}): the metrics-access NetworkPolicy off and the labeler Deployment tolerating every taint${version === "v1.25.0" ? ", the labeler selected onto the system-worker node group, and the syslog health monitor given four checks and NIC driver patterns" : ""}`,
              objects: expected.aicr.objects,
              podMonitor: true,
              removedFromDefault: ["networking.k8s.io/v1|NetworkPolicy||metrics-access"],
              changesNothingElse: false,
              aicr: expected.aicr,
            },
          ]
        : []),
    ],
    describe: "NVSentinel is NVIDIA's GPU node health monitoring system. With chart defaults it runs the GPU health monitors, the syslog health monitors, the labeler, the metadata collector and the platform connectors.",
    requiredCRDs: () => [
      {
        name: "podmonitors.monitoring.coreos.com",
        ...prometheusOperatorCRDSource,
        purpose: "Prometheus Operator PodMonitor CRD required before Kubernetes accepts the rendered PodMonitor object; the chart does not ship it",
        deliveryLanes,
      },
    ],
    targetFactNote:
      "the target must already have the Prometheus Operator PodMonitor CRD; the rendered objects carry no namespace, so they must be applied into the nvsentinel namespace",
    valueModel: [
      {
        path: "podMonitor.enabled",
        disposition: "default-render-captured",
        reason: "True by chart default, so the render contains one monitoring.coreos.com/v1 PodMonitor. The chart ships no Prometheus Operator CRD.",
        note: "recorded as a target fact with a packaged copy of the CRD",
        evidence: "templates/podMonitor.yaml",
      },
      {
        path: "global.<component>.enabled",
        disposition: "default-render-captured",
        reason:
          "Each subchart is gated by its own global flag. Chart defaults turn on the GPU health monitor, the syslog health monitor, the labeler and the metadata collector, and leave the datastore, remediation, janitor, preflight and lifecycle components off.",
        note: "the lookups, generated credentials, webhooks, keep annotations, namespace creation and CRDs the packaged chart contains all sit in components the defaults leave off",
        evidence: "Chart.yaml dependencies (one condition per subchart), values.yaml global block",
      },
      {
        path: "nodeConditionCleanup.enabled",
        disposition: "default-render-captured",
        reason: "False by chart default, so the post-upgrade cleanup hook does not render.",
        note: "turning it on adds a Helm hook Job and its RBAC; that would need a recorded lifecycle action",
        evidence: "templates/node-condition-cleanup-hook.yaml",
      },
    ],
    notes: (version, expected) => [
      `With chart defaults nvsentinel@${version} renders ${expected.objects} objects: no CRDs, no Secrets, no Helm hooks.`,
      `The no-pod-monitor base sets podMonitor.enabled false and renders ${expected.objects - 1} objects: the default base without its PodMonitor, and no other difference. The chart adds no scrape annotation in its place, so a Prometheus that discovers pods by annotation needs them added.`,
      ...(expected.aicr
        ? [
            expected.aicr.nestedRenderReceiptPath
              ? `The aicr-eks-training base renders ${expected.aicr.objects} objects with the bytes of ${expected.aicr.valuesPath}, the values the AICR ${expected.aicr.release} recipe supplies. Its objects equal the AICR nested render of the same archive, object for object.`
              : `The aicr-eks-training base renders ${expected.aicr.objects} objects with the bytes of ${expected.aicr.valuesPath}, the values the AICR ${expected.aicr.release} recipe supplies. The values bytes match the bundle's own checksum list and its Application pins this chart version. That example retains no nested render of this component, so this base is not compared with an AICR render.`,
          ]
        : []),
      "No namespaced object in the render carries metadata.namespace, because the chart templates leave it to Helm. A flattened copy must be applied into the nvsentinel namespace.",
      "The platform-connectors DaemonSet refers to a ConfigMap named mongodb-config and a Secret named mongo-app-client-cert-secret that the default render does not contain. Both references are marked optional, so Kubernetes starts the pods without them.",
      "The installer round trip drops one leading blank line from TOML files held in the syslog-health-monitor-config ConfigMap. The equivalence check admits only that whitespace difference, in that one ConfigMap, and compares everything else exactly.",
      `The packaged Chart.lock lists ${expected.dependencies} dependencies and Chart.yaml lists more; the lock digest is the same in every reviewed version, so the lock is older than the chart. The dependency lock here records the Chart.lock list as packaged.`,
    ],
    caveats: [
      "The GPU health monitor DaemonSets connect to a DCGM service in the gpu-operator namespace (nvidia-dcgm.gpu-operator.svc:5555). The GPU Operator provides it when DCGM is enabled; this chart does not install it.",
      "The GPU health monitor, syslog health monitor and metadata collector DaemonSets select nodes by nvsentinel.dgxc.nvidia.com labels, so they run no pods on nodes without those labels. The platform-connectors DaemonSet has no node selector and runs on every node.",
      "Chart defaults leave the datastore and the remediation components off, so this base detects and reports faults and does not quarantine, drain or remediate nodes.",
      "The AICR recipes install this chart with their own values. The default base is the chart-default render; the aicr-eks-training base, where a version has one, is the render with the retained AICR values.",
      "The chart's values.yaml also documents an internal MongoDB or PostgreSQL datastore and the remediation components that need one. Those bring lookup-or-generate credentials, keep-annotated volumes, setup Jobs, webhooks and CRDs, so they are not offered as bases here; each would need its own review.",
    ],
  },
  "cluster-readiness-engine": {
    repositoryURL: "oci://ghcr.io/nvidia",
    name: "cluster-readiness-engine",
    // The upstream release notes install the chart as release nvcre in namespace nvcre.
    releaseName: "nvcre",
    namespace: "nvcre",
    versions: {
      "v0.6.0": { objects: 43, crds: nvcreCRDs, dependencies: 0 },
    },
    describe:
      "The NVIDIA Cluster Readiness Engine is a controller that certifies GPU clusters by running training and communication workloads and reporting the nodes that fail.",
    requiredCRDs: () => [
      ...nvcreCRDs.map((name) => ({
        name,
        sourceVariant: "default",
        purpose:
          name === "logprofiles.nvcre.nvidia.com"
            ? "CRD included in this base; it must be established before Kubernetes accepts the four rendered LogProfile objects"
            : "CRD included in this base and applied before the controller that reconciles it",
        deliveryLanes,
        applyMode: "server-side",
      })),
      {
        name: "servicemonitors.monitoring.coreos.com",
        ...prometheusOperatorCRDSource,
        purpose: "Prometheus Operator ServiceMonitor CRD required before Kubernetes accepts the rendered ServiceMonitor object; the chart does not ship it",
        deliveryLanes,
        applyMode: "server-side",
      },
    ],
    targetFactNote:
      "the seven nvcre.nvidia.com CRDs must be established before the four LogProfile objects, and the target must already have the Prometheus Operator ServiceMonitor CRD",
    valueModel: [
      {
        path: "metrics.serviceMonitor.enabled",
        disposition: "default-render-captured",
        reason: "True by chart default, so the render contains one monitoring.coreos.com/v1 ServiceMonitor labelled release: prometheus. The chart ships no Prometheus Operator CRD.",
        note: "recorded as a target fact with a packaged copy of the CRD",
        evidence: "templates/metrics-monitor.yaml, values.yaml metrics.serviceMonitor",
      },
      {
        path: "manager.image.tag / manager.image.digest",
        disposition: "default-render-captured",
        reason: "Both empty by chart default, so the manager image falls back to the chart appVersion tag.",
        note: "the upstream release notes publish the signed image index digest; this base does not pin it",
        evidence: "values.yaml manager.image, templates/deployment.yaml",
      },
    ],
    notes: (version, expected) => [
      `With chart defaults cluster-readiness-engine@${version} renders ${expected.objects} objects as release nvcre in namespace nvcre: ${expected.crds.length} CRDs, four cluster-scoped LogProfile objects of one of those CRDs, the manager Deployment, its RBAC, a metrics Service and a ServiceMonitor. It renders no Secrets and no Helm hooks.`,
      "The packaged chart contains no lookup, no .Capabilities branch, no generated credential, no webhook configuration and no subchart.",
      "The manager ClusterRole grants access to trainer.kubeflow.org, resource.k8s.io and resource.nvidia.com resources. This chart installs none of those APIs.",
      "The upstream v0.6.0 release notes name the chart's registry manifest digest; scripts/lib/nvidia-gpu-stack-coverage.mjs records the same digest beside the archive SHA-256.",
    ],
    caveats: [
      "This entry has the default base only. The chart's values.yaml documents no alternative deployment scenario: its switches are a PodDisruptionBudget and the ServiceMonitor, and no retained AICR recipe installs this chart.",
      "Installing the controller certifies nothing by itself. A certification run needs GPU nodes and the workload APIs the controller drives, which this chart does not install.",
      "Three of the CRDs are large. Their JSON forms are between 160 and 230 kilobytes, close to the 262144-byte limit that client-side kubectl apply puts on the last-applied annotation, so the target facts ask for server-side apply.",
    ],
  },
  "k8s-nim-operator": {
    repositoryURL: nimOperatorChart.repositoryURL,
    name: nimOperatorChart.name,
    releaseName: nimOperatorChart.releaseName,
    namespace: nimOperatorChart.namespace,
    versions: Object.fromEntries(
      nimOperatorReviewedVersions.map((version) => {
        const row = nimOperatorExpectations(version);
        return [version, { objects: row.objects, crds: [...nimOperatorCRDs], dependencies: row.dependencies, hooks: row.hooks, aicr: row.aicr ?? null }];
      }),
    ),
    // The Helm hook objects are packaged beside the bases by
    // scripts/generate-gpu-operator-packaged-lifecycle.mjs --chart k8s-nim-operator.
    lifecycle: { root: nimOperatorLifecycleRoot, extras: nimOperatorExtrasRoot },
    describe:
      "The NVIDIA NIM Operator manages NVIDIA NIM and NeMo microservices through nine custom resources. With chart defaults it installs the operator, its RBAC, a metrics Service and those nine CRDs, and deploys no model.",
    extraBases: (version) =>
      nimOperatorBases(version)
        .filter((base) => base.name !== "default")
        .map((base) => ({
          name: base.name,
          displayName: base.displayName,
          valuesText: base.valuesText,
          valuesSummary: base.valuesSummary,
          objects: base.objects,
          removedFromDefault: [],
          addedToDefault: base.addedToDefault,
          changesNothingElse: false,
          aicr: base.aicr,
          requiredCRDs: [
            ...candidates["k8s-nim-operator"].requiredCRDs(base.name),
            ...["certificates.cert-manager.io", "issuers.cert-manager.io"].map((name) => ({
              name,
              ...certManagerCRDSource,
              purpose:
                "cert-manager CRD required before Kubernetes accepts the rendered Certificate and Issuer objects; the chart does not ship it, and cert-manager itself must be running to issue the webhook certificate",
              deliveryLanes,
              applyMode: "server-side",
            })),
          ],
          targetFactNote:
            "the nine apps.nvidia.com CRDs must be established before the operator starts; the target must already run cert-manager, which issues the admission webhook certificate and injects its CA; the four pre-upgrade hook objects are a packaged lifecycle action, not part of the base",
        })),
    requiredCRDs: (baseName) =>
      nimOperatorCRDs.map((name) => ({
        name,
        sourceVariant: baseName,
        purpose: "CRD included in this base and applied before the operator that reconciles it",
        deliveryLanes,
        applyMode: "server-side",
      })),
    targetFactNote:
      "the nine apps.nvidia.com CRDs must be established before the operator starts; the four pre-upgrade hook objects are a packaged lifecycle action, not part of the base",
    valueModel: [
      {
        path: "operator.upgradeCRD",
        disposition: "left-at-default",
        reason:
          "True by chart default and in every base. It renders a pre-upgrade hook: a Job that applies the CRD files inside the operator image, with its own ServiceAccount, ClusterRole and ClusterRoleBinding.",
        note: "Helm does not upgrade CRDs from a chart's crds directory, so this hook is how the chart moves its CRDs forward on helm upgrade; the four objects are packaged as a recorded lifecycle action",
        evidence: "templates/upgrade_crd.yaml",
      },
      {
        path: "operator.admissionController.enabled",
        disposition: "variant-axis",
        reason:
          "False by chart default. When true it renders a ValidatingWebhookConfiguration, a webhook Service and, in cert-manager mode, a Certificate and an Issuer, and it mounts the certificate Secret into the operator.",
        note: "the aicr-eks-inference base of 3.1.0 turns it on; the chart's values.yaml says cert-manager must be installed beforehand",
        evidence: "templates/admission-controller.yaml, templates/deployment.yaml, values.yaml operator.admissionController",
      },
      {
        path: "dynamo.enabled",
        disposition: "left-at-default",
        reason:
          "False by chart default and in every base. It gates both vendored subcharts, dynamo-platform and dynamo-crds, so no Dynamo object and no Dynamo CRD renders.",
        note: "every lookup, generated credential, keep annotation, webhook and extra CRD the packaged archive contains outside the operator's own templates sits in those subcharts",
        evidence: "Chart.yaml dependencies (both with condition dynamo.enabled), Chart.lock",
      },
      {
        path: "nfd.nodeFeatureRules.deviceID",
        disposition: "left-at-default",
        reason: "False by chart default, so no NodeFeatureRule renders and the base needs no Node Feature Discovery CRD.",
        note: "turning it on adds an nfd.k8s-sigs.io custom resource and with it a CRD precondition",
        evidence: "templates/node-feature-rule.yaml",
      },
    ],
    notes: (version, expected) => [
      `With chart defaults k8s-nim-operator@${version} renders ${expected.objects} objects as release k8s-nim-operator in namespace nvidia-nim: nine CRDs from the chart's crds directory, the operator Deployment, its ServiceAccount, RBAC and a metrics Service. It renders no Secret and no instance of its own custom resources.`,
      "The same values also render four Helm hook objects, all pre-upgrade: a Job that applies the CRD files inside the operator image, with its ServiceAccount, ClusterRole and ClusterRoleBinding. The bases are rendered with --no-hooks, and the four objects are packaged under prerequisites/k8s-nim-operator-lifecycle with a lifecycle-actions.yaml record. Nothing runs them automatically and none has been run on a cluster.",
      "The release name and namespace are the ones the AICR NIM inference recipes use. NVIDIA's own install instructions name both nim-operator.",
      "The operator Deployment, ServiceAccount, Role, RoleBinding and metrics Service carry no metadata.namespace, because the chart templates leave it to Helm. A flattened copy must be applied into the nvidia-nim namespace.",
      `The packaged Chart.lock lists ${expected.dependencies} dependencies, dynamo-platform and dynamo-crds, both gated by dynamo.enabled, which every base leaves false.`,
      "The chart archive was pulled anonymously from the NGC Helm repository. The operator image is nvcr.io/nvidia/cloud-native/k8s-nim-operator, with imagePullPolicy Always. The NIM model images the operator later pulls need an NGC key; nothing in this entry deploys one.",
      ...(expected.aicr
        ? [
            `The aicr-eks-inference base renders ${expected.aicr.objects} objects with the values the AICR ${expected.aicr.release} NIM inference recipes carry inline in ${expected.aicr.applicationPath}, which pins this chart version. It adds the admission webhook, its Service, a cert-manager Certificate and a self-signed Issuer to the default base, and changes the operator Deployment. That example retains no nested render of this component, so this base is not compared with an AICR render.`,
          ]
        : []),
    ],
    caveats: [
      "Installing the operator deploys no NIM. A NIMService or NIMCache needs GPU nodes, an NGC key for the model image, and storage, and none of those is part of this entry.",
      "No NIMService sample, NIM model chart or NGC-gated artifact is packaged here.",
      "The CRDs are large. Client-side kubectl apply can exceed the last-applied annotation limit, so the target facts ask for server-side apply.",
      "With the admission controller on, the two validating webhooks have failurePolicy Fail and the operator mounts the certificate Secret that cert-manager issues. Until that Secret exists the operator pod cannot start, and until the operator answers, NIMCache and NIMService writes are rejected.",
    ],
  },
};

const selected = candidates[candidateName];
if (!selected) {
  throw new Error(`HELM_EXPT_NVIDIA_GPU_STACK_CANDIDATE must be one of ${Object.keys(candidates).join(", ")}`);
}
const expected = selected.versions[chartVersion];
if (!expected) {
  throw new Error(
    `${candidateName} has reviewed versions ${Object.keys(selected.versions).join(", ")}; received ${chartVersion || "<unset>"}`,
  );
}

const chart = {
  repository: "nvidia",
  repositoryURL: selected.repositoryURL,
  name: selected.name,
  version: chartVersion,
  releaseName: selected.releaseName,
  namespace: selected.namespace,
  kubeVersion: "1.31.0",
};

const defaultVariant = {
  name: "default",
  base: "default",
  displayName: "chart defaults",
  valuesFile: "effective-values.yaml",
  valuesText: "",
  valuesSummary: "chart defaults",
  expectedObjectCount: expected.objects,
  expectedCRDCount: expected.crds.length,
  expectedSecretCount: 0,
  podMonitor: true,
  targetFacts: { requiredCRDs: selected.requiredCRDs("default") },
  targetFactNote: selected.targetFactNote,
};

const requiredCRDsFor = (base) => base.requiredCRDs ?? selected.requiredCRDs(base.name);

const variants = [
  defaultVariant,
  ...(selected.extraBases?.(chartVersion, expected) ?? []).map((base) => ({
    name: base.name,
    base: base.name,
    displayName: base.displayName,
    valuesFile: `effective-values-${base.name}.yaml`,
    valuesText: base.valuesText,
    valuesSummary: base.valuesSummary,
    expectedObjectCount: base.objects,
    expectedCRDCount: expected.crds.length,
    expectedSecretCount: 0,
    podMonitor: base.podMonitor,
    removedFromDefault: base.removedFromDefault ?? [],
    addedToDefault: base.addedToDefault ?? [],
    changesNothingElse: base.changesNothingElse,
    aicr: base.aicr ?? null,
    // A base that renders no custom resource and no CRD needs no CRD on the target.
    ...(requiredCRDsFor(base).length ? { targetFacts: { requiredCRDs: requiredCRDsFor(base) } } : {}),
    targetFactNote: base.targetFactNote ?? selected.targetFactNote,
  })),
];

const scanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    { id: "mutable-image-tag", severity: "high", description: "Container images must not use latest or an untagged reference." },
    { id: "service-selector-has-workload-match", severity: "high", description: "Service selectors must match a rendered workload." },
    { id: "workload-service-account-exists", severity: "high", description: "Workload ServiceAccounts must be rendered." },
    { id: "crd-upgrade-policy", severity: "medium", description: "CRDs require explicit ownership and upgrade policy." },
    { id: "cluster-rbac-review", severity: "medium", description: "Cluster-scoped RBAC requires production review." },
    { id: "privileged-workload-review", severity: "medium", description: "Privileged or host-namespace workloads require production review." },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  scriptPrefix: "nvidia-gpu-stack-coverage",
  receiptSlug: selected.name,
  ...(selected.lifecycle
    ? { packageExtraPaths: ({ ctx }) => [{ source: `${selected.lifecycle.extras}/${ctx.chart.version}`, destination: selected.lifecycle.root }] }
    : {}),
  expectedDependencyCount: expected.dependencies,
  recordChartLockDigest: expected.dependencies > 0,
  semanticNormalizations: [
    "prune-null-fields",
    ...(selected.name === "nvsentinel" ? ["nvsentinel-configmap-leading-blank-line-pruned-by-kustomize"] : []),
  ],
  allowedSemanticDiff({ key, helmObjectJson, cubObjectJson }) {
    if (selected.name !== "nvsentinel") return false;
    return leadingBlankLineOnly(key, helmObjectJson, cubObjectJson);
  },
  valueModel: {
    checkedValues: [
      {
        path: "<chart defaults>",
        variant: "default",
        disposition: "default-render-captured",
        reason: "the exact chart-default render of the locked archive is captured",
      },
      ...selected.valueModel,
      ...variants
        .filter((item) => item.name !== "default")
        .map((item) => ({
          path: `<${item.name} values>`,
          variant: item.name,
          disposition: "variant-axis",
          reason: item.valuesSummary,
          note: `differs from the default base by ${[
            ...(item.removedFromDefault.length ? [`removing ${item.removedFromDefault.join(", ")}`] : []),
            ...(item.addedToDefault.length ? [`adding ${item.addedToDefault.join(", ")}`] : []),
          ].join(" and ")}${item.changesNothingElse ? " and nothing else" : " and by the fields those values reach"}; the proof checks the removed and added sets`,
        })),
    ],
    unknownValues: "not-exhaustively-checked-by-nvidia-gpu-stack-coverage-proof",
    deadValues: "not-exhaustively-checked-by-nvidia-gpu-stack-coverage-proof",
    ignoredValues: "not-exhaustively-checked-by-nvidia-gpu-stack-coverage-proof",
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", dependencyCount: expected.dependencies },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion },
    selected.lifecycle
      ? {
          category: "lifecycle-policy",
          status: "attention-required",
          policy: "no-hooks",
          note: `the bases are rendered with --no-hooks; every base's values also render ${Object.entries(expected.hooks).map(([phase, count]) => `${count} ${phase}`).join(", ")} Helm hook objects. They are packaged under ${selected.lifecycle.root} with a lifecycle-actions.yaml record, and nothing runs them automatically. No hook has been run on a cluster for this entry.`,
        }
      : { category: "lifecycle-policy", status: "handled", policy: "no-hooks", note: "no base's render contains a Helm hook object, with or without --no-hooks" },
    ...(expected.crds.length
      ? [{ category: "crd-lifecycle", status: "review-required", count: expected.crds.length }]
      : []),
    {
      category: "target-facts",
      status: "review-required",
      note: selected.targetFactNote,
    },
    {
      category: "catalog-coverage",
      status: "packaged-with-controls",
      note: "exact source and deterministic package are retained; publication, live qualification and production support remain separate gates",
    },
  ],
  dossier: {
    maintainedNotes: [
      `This package is the exact ${selected.name}@${chart.version} chart, locked by archive URL and SHA-256.`,
      ...selected.notes(chart.version, expected),
      "The retained root proves exact source bytes, deterministic rendering, and deterministic ConfigHub installer packaging. It does not claim publication, live convergence, or production support.",
    ],
    knownControlPoints: [
      "source-lock",
      "dependency-lock",
      "capability-profile",
      ...(selected.lifecycle ? ["helm-hook-lifecycle-actions"] : []),
      "target-facts",
      "production-readiness-review",
    ],
    extra: { caveats: selected.caveats },
  },
  plan: {
    status: "packaged-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish and sign the package, then complete target-specific live qualification on a GPU target before production",
  },
  readme: {
    intro: `This is the exact-artifact ConfigHub component package for ${selected.name}@${chart.version}. ${selected.describe}`,
    proves: [
      "the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;",
      "every base renders deterministically and the installer package preserves the rendered object set;",
      "retention here does not imply publication, live convergence, or production support.",
    ],
  },
  installGate: (item) => ({
    decision: "warn",
    allowedScopes: ["catalog-selection", "local-test"],
    blockedScopes: ["production"],
    reasons: [
      `Helm equivalence passed for ${item.name}`,
      "the exact artifact and deterministic installer package are retained; the package is not published and no live run is recorded",
      item.targetFactNote,
    ],
  }),
  scanExtra(docs) {
    const findings = [];
    for (const doc of docs) {
      const identity = identityFor(doc);
      if (doc.kind === "CustomResourceDefinition") {
        findings.push({
          id: `crd-upgrade-policy:${identity}`,
          rule: "crd-upgrade-policy",
          severity: "medium",
          object: identity,
          message: "CRD ownership and upgrade behavior require production review",
        });
      }
      const podSpec = doc.spec?.template?.spec;
      if (podSpec && ["DaemonSet", "Deployment", "StatefulSet"].includes(doc.kind)) {
        const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
        const privileged = containers.some((container) => container.securityContext?.privileged === true);
        if (privileged || podSpec.hostPID || podSpec.hostNetwork || podSpec.hostIPC) {
          findings.push({
            id: `privileged-workload-review:${identity}`,
            rule: "privileged-workload-review",
            severity: "medium",
            object: identity,
            message: "Workload runs privileged or in a host namespace and requires production review",
          });
        }
      }
    }
    return findings;
  },
  verifyExtra({ root, dependencyLock, perVariant, check }) {
    check((dependencyLock.spec?.dependencies ?? []).length === expected.dependencies, `${candidateName} dependency count mismatch`);
    const defaultText = readFileSync(perVariant.get("default").releasePath, "utf8");
    // Every custom resource in a render must have its CRD either in the render or declared as a target fact.
    const builtinGroups = new Set(["", "apps", "batch", "rbac.authorization.k8s.io", "networking.k8s.io", "policy", "apiextensions.k8s.io", "admissionregistration.k8s.io"]);
    for (const item of variants) {
      const row = perVariant.get(item.name);
      const releaseText = readFileSync(row.releasePath, "utf8");
      const docs = parseDocs(releaseText);
      check(docs.length === item.expectedObjectCount, `${candidateName} ${item.name} object count mismatch`);
      const crds = docs
        .filter((doc) => doc.kind === "CustomResourceDefinition")
        .map((doc) => doc.metadata?.name)
        .sort();
      check(JSON.stringify(crds) === JSON.stringify([...expected.crds].sort()), `${candidateName} ${item.name} CRD set mismatch: ${crds.join(", ")}`);
      check(!docs.some((doc) => doc.kind === "Secret"), `${candidateName} ${item.name} must render no Secret`);
      check(!docs.some((doc) => doc.metadata?.annotations?.["helm.sh/hook"]), `${candidateName} ${item.name} must render no Helm hook object`);
      check(!docs.some((doc) => doc.kind === "Job"), `${candidateName} ${item.name} must render no Job`);
      const variantDoc = readYaml(join(root, "variants", item.name, "variant.yaml"));
      const declared = (variantDoc.spec?.targetFacts?.requiredCRDs ?? []).map((crd) => crd.name);
      for (const doc of docs) {
        const group = String(doc.apiVersion ?? "").includes("/") ? String(doc.apiVersion).split("/")[0] : "";
        if (builtinGroups.has(group)) continue;
        check(
          declared.some((name) => name.endsWith(`.${group}`) && name.startsWith(`${String(doc.kind).toLowerCase()}`)),
          `${candidateName} ${item.name} renders ${doc.kind} (${group}) with no declared CRD target fact`,
        );
      }
      for (const name of expected.crds) check(declared.includes(name), `${candidateName} ${item.name} target facts must declare rendered CRD ${name}`);
      if (candidateName === "nvsentinel") {
        check(
          docs.every((doc) => !doc.metadata?.namespace),
          `nvsentinel ${item.name} render is recorded as namespace-less; a namespaced object changes that note`,
        );
        const monitors = docs.filter((doc) => doc.kind === "PodMonitor");
        check(monitors.length === (item.podMonitor ? 1 : 0), `nvsentinel ${item.name} must render ${item.podMonitor ? "exactly one" : "no"} PodMonitor`);
        if (!item.podMonitor) check(declared.length === 0, `nvsentinel ${item.name} renders no custom resource and must declare no CRD target fact`);
      }
      if (candidateName === "cluster-readiness-engine") {
        const profiles = docs.filter((doc) => doc.kind === "LogProfile");
        check(profiles.length === 4 && profiles.every((doc) => !doc.metadata?.namespace), "cluster-readiness-engine must render four cluster-scoped LogProfile objects");
        check(docs.filter((doc) => doc.kind === "ServiceMonitor").length === 1, "cluster-readiness-engine must render exactly one ServiceMonitor");
      }
      if (item.name === "default") continue;
      // A base says which objects it removes from the default base; the render must agree.
      const delta = objectDelta(defaultText, releaseText);
      check(
        JSON.stringify(delta.added) === JSON.stringify([...item.addedToDefault].sort()),
        `${candidateName} ${item.name} must add exactly ${item.addedToDefault.join(", ") || "nothing"} to the default base; added ${delta.added.join(", ")}`,
      );
      check(
        JSON.stringify(delta.removed) === JSON.stringify([...item.removedFromDefault].sort()),
        `${candidateName} ${item.name} must remove exactly ${item.removedFromDefault.join(", ") || "nothing"} from the default base; removed ${delta.removed.join(", ")}`,
      );
      if (item.changesNothingElse) {
        check(delta.changed.length === 0, `${candidateName} ${item.name} must change no object that stays; found ${delta.changed.map((entry) => entry.key).join(", ")}`);
      }
      if (item.aicr) verifyAicrBinding({ item, releaseText, check });
    }
  },
});

// An aicr-eks-training base claims to be what an AICR recipe renders. Where the
// AICR example retains a nested render, the claim is checked against its receipt:
// same archive, same values bytes, same objects. In every case the values bytes
// must match the bundle's own checksum list, and the bundle's Application must
// pin this chart version.
function verifyAicrBinding({ item, releaseText, check }) {
  const binding = item.aicr;
  if (binding.applicationPath) {
    // The values are carried inline in a rendered Argo CD Application. The
    // Application must still pin this chart, version, release name and namespace,
    // its file must match the example's checksum list, and the base's values must
    // be the inline text.
    const application = aicrInferenceApplication(binding);
    const source = application.spec?.source ?? {};
    check(
      source.chart === selected.name
        && String(source.targetRevision) === chartVersion
        && source.repoURL === selected.repositoryURL
        && application.metadata?.name === selected.releaseName
        && application.spec?.destination?.namespace === selected.namespace,
      `the AICR Application no longer pins ${selected.name} ${chartVersion} as ${selected.releaseName} in ${selected.namespace}`,
    );
    check(
      item.valuesText === `${String(source.helm?.values).replace(/\n*$/, "")}\n`,
      `${item.name} values differ from the values inline in the AICR Application`,
    );
    const checksums = readFileSync(join(repoRoot, binding.checksumsPath), "utf8");
    check(
      checksums.split("\n").includes(`${sha256(readFileSync(join(repoRoot, binding.applicationPath)))}  ${binding.checksumsEntry}`),
      `${binding.applicationPath} differs from the AICR example checksum list`,
    );
    return;
  }
  const checksums = readFileSync(join(repoRoot, binding.bundleChecksumsPath), "utf8");
  check(
    checksums.split("\n").includes(`${sha256(item.valuesText)}  ${binding.bundleChecksumsEntry}`),
    `${item.name} values bytes differ from the AICR bundle checksum list`,
  );
  const application = readFileSync(join(repoRoot, binding.applicationTemplatePath), "utf8");
  check(
    new RegExp(`^\\s*chart: ${selected.name}$`, "m").test(application)
      && new RegExp(`^\\s*targetRevision: ${chartVersion.replaceAll(".", "\\.")}$`, "m").test(application),
    `the AICR Application no longer pins ${selected.name} ${chartVersion}`,
  );
  if (!binding.nestedRenderReceiptPath) return;
  const receipt = readYaml(join(repoRoot, binding.nestedRenderReceiptPath));
  check(receipt.spec?.values?.path === binding.valuesPath, "AICR nested-render receipt no longer names the bound values file");
  check(sha256(item.valuesText) === receipt.spec?.values?.sha256, `${item.name} values bytes differ from the AICR nested-render receipt`);
  check(
    receipt.spec?.sourceArtifact?.sha256 === (process.env.HELM_EXPT_CHART_ARTIFACT_SHA256 ?? "").replace(/^sha256:/, ""),
    `${item.name} must use the chart archive the AICR nested-render receipt records`,
  );
  const maps = canonicalObjectMaps(releaseText, readFileSync(join(repoRoot, receipt.spec.output.path), "utf8"));
  const baseKeys = Object.keys(maps.helm).sort();
  check(
    JSON.stringify(baseKeys) === JSON.stringify(Object.keys(maps.cub).sort()),
    `${item.name} object set differs from the AICR nested render`,
  );
  for (const key of baseKeys) check(maps.helm[key] === maps.cub[key], `${item.name} object differs from the AICR nested render: ${key}`);
}

// nvsentinel's syslog health monitor ConfigMap holds TOML files whose text starts
// with a blank line. The installer round trip (kustomize) drops that one leading
// newline. TOML ignores blank lines, so the difference is serialization only, but
// it is a byte difference, so it is admitted narrowly: only this ConfigMap, only a
// data value, and only when the two strings are identical once a single leading
// newline is removed from the Helm side. Everything else stays strict.
function leadingBlankLineOnly(key, helmObjectJson, cubObjectJson) {
  if (key !== "v1|ConfigMap||syslog-health-monitor-config") return false;
  const helmObject = JSON.parse(helmObjectJson);
  const cubObject = JSON.parse(cubObjectJson);
  const helmData = helmObject.data ?? {};
  const cubData = cubObject.data ?? {};
  if (JSON.stringify(Object.keys(helmData).sort()) !== JSON.stringify(Object.keys(cubData).sort())) return false;
  for (const [name, value] of Object.entries(helmData)) {
    if (typeof value !== "string" || typeof cubData[name] !== "string") return false;
    if (value === cubData[name]) continue;
    if (value.replace(/^\n/, "") !== cubData[name]) return false;
    cubData[name] = value;
  }
  cubObject.data = cubData;
  return JSON.stringify(helmObject) === JSON.stringify(cubObject);
}
