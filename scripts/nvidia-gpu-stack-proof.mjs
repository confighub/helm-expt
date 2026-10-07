// Exact-artifact package proofs for the NVIDIA GPU stack charts that render with
// chart defaults and need no chart-specific machinery: nvsentinel and
// cluster-readiness-engine. gpu-operator has its own declaration
// (scripts/gpu-operator-proof.mjs) because it has a second base and Helm hooks.
//
// scripts/nvidia-gpu-stack-coverage.mjs supplies and independently verifies the
// exact artifact URL and SHA-256. This declaration never resolves a mutable tag
// or repository index without checking the archive bytes it returns.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor, parseDocs, readYaml } from "./lib/proof-common.mjs";

const candidateName = process.env.HELM_EXPT_NVIDIA_GPU_STACK_CANDIDATE ?? "";
const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "";
const deliveryLanes = ["regularHelm", "cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"];

// The Prometheus Operator CRDs these charts need on the target come from the
// newest kube-prometheus-stack render the Catalog holds.
const prometheusOperatorCRDSource = {
  sourcePath: "../../../prometheus-community/kube-prometheus-stack/88.6.3/revisions/default/r001/rendered/release-objects.yaml",
  sourceVariant: "prometheus-community/kube-prometheus-stack@88.6.3/default",
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

const candidates = {
  nvsentinel: {
    repositoryURL: "oci://ghcr.io/nvidia",
    name: "nvsentinel",
    releaseName: "nvsentinel",
    namespace: "nvsentinel",
    // objects: rendered objects with chart defaults. dependencies: entries in the
    // packaged Chart.lock, which is what the dependency lock records.
    versions: {
      "v1.9.0": { objects: 21, crds: [], dependencies: 15 },
      "v1.20.0": { objects: 22, crds: [], dependencies: 16 },
      "v1.25.0": { objects: 22, crds: [], dependencies: 16 },
      "v1.26.0": { objects: 22, crds: [], dependencies: 16 },
    },
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
      "No namespaced object in the render carries metadata.namespace, because the chart templates leave it to Helm. A flattened copy must be applied into the nvsentinel namespace.",
      "The platform-connectors DaemonSet refers to a ConfigMap named mongodb-config and a Secret named mongo-app-client-cert-secret that the default render does not contain. Both references are marked optional, so Kubernetes starts the pods without them.",
      "The installer round trip drops one leading blank line from TOML files held in the syslog-health-monitor-config ConfigMap. The equivalence check admits only that whitespace difference, in that one ConfigMap, and compares everything else exactly.",
      `The packaged Chart.lock lists ${expected.dependencies} dependencies and Chart.yaml lists more; the lock digest is the same in every reviewed version, so the lock is older than the chart. The dependency lock here records the Chart.lock list as packaged.`,
    ],
    caveats: [
      "The GPU health monitor DaemonSets connect to a DCGM service in the gpu-operator namespace (nvidia-dcgm.gpu-operator.svc:5555). The GPU Operator provides it when DCGM is enabled; this chart does not install it.",
      "The GPU health monitor, syslog health monitor and metadata collector DaemonSets select nodes by nvsentinel.dgxc.nvidia.com labels, so they run no pods on nodes without those labels. The platform-connectors DaemonSet has no node selector and runs on every node.",
      "Chart defaults leave the datastore and the remediation components off, so this base detects and reports faults and does not quarantine, drain or remediate nodes.",
      "The AICR recipes install this chart with their own values. This base is the chart-default render, not the AICR one.",
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
      "Installing the controller certifies nothing by itself. A certification run needs GPU nodes and the workload APIs the controller drives, which this chart does not install.",
      "Three of the CRDs are large. Their JSON forms are between 160 and 230 kilobytes, close to the 262144-byte limit that client-side kubectl apply puts on the last-applied annotation, so the target facts ask for server-side apply.",
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

const variant = {
  name: "default",
  base: "default",
  displayName: "chart defaults",
  valuesFile: "effective-values.yaml",
  valuesText: "",
  valuesSummary: "chart defaults",
  expectedObjectCount: expected.objects,
  expectedCRDCount: expected.crds.length,
  expectedSecretCount: 0,
  targetFacts: { requiredCRDs: selected.requiredCRDs() },
  targetFactNote: selected.targetFactNote,
};

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
  variants: [variant],
  scanPolicy,
  scriptPrefix: "nvidia-gpu-stack-coverage",
  receiptSlug: selected.name,
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
    ],
    unknownValues: "not-exhaustively-checked-by-nvidia-gpu-stack-coverage-proof",
    deadValues: "not-exhaustively-checked-by-nvidia-gpu-stack-coverage-proof",
    ignoredValues: "not-exhaustively-checked-by-nvidia-gpu-stack-coverage-proof",
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", dependencyCount: expected.dependencies },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion },
    { category: "lifecycle-policy", status: "handled", policy: "no-hooks", note: "the chart-default render contains no Helm hook object, with or without --no-hooks" },
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
    knownControlPoints: ["source-lock", "dependency-lock", "capability-profile", "target-facts", "production-readiness-review"],
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
      "the chart-default configuration renders deterministically and the installer package preserves the rendered object set;",
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
    const row = perVariant.get("default");
    const docs = parseDocs(readFileSync(row.releasePath, "utf8"));
    check(docs.length === expected.objects, `${candidateName} object count mismatch`);
    const crds = docs
      .filter((doc) => doc.kind === "CustomResourceDefinition")
      .map((doc) => doc.metadata?.name)
      .sort();
    check(JSON.stringify(crds) === JSON.stringify([...expected.crds].sort()), `${candidateName} CRD set mismatch: ${crds.join(", ")}`);
    check(!docs.some((doc) => doc.kind === "Secret"), `${candidateName} must render no Secret`);
    check(!docs.some((doc) => doc.metadata?.annotations?.["helm.sh/hook"]), `${candidateName} must render no Helm hook object`);
    check(!docs.some((doc) => doc.kind === "Job"), `${candidateName} must render no Job`);
    check((dependencyLock.spec?.dependencies ?? []).length === expected.dependencies, `${candidateName} dependency count mismatch`);
    const variantDoc = readYaml(join(root, "variants", "default", "variant.yaml"));
    const declared = (variantDoc.spec?.targetFacts?.requiredCRDs ?? []).map((crd) => crd.name);
    // Every custom resource in the render must have its CRD either in the render or declared as a target fact.
    const builtinGroups = new Set(["", "apps", "batch", "rbac.authorization.k8s.io", "networking.k8s.io", "policy", "apiextensions.k8s.io"]);
    for (const doc of docs) {
      const group = String(doc.apiVersion ?? "").includes("/") ? String(doc.apiVersion).split("/")[0] : "";
      if (builtinGroups.has(group)) continue;
      check(
        declared.some((name) => name.endsWith(`.${group}`) && name.startsWith(`${String(doc.kind).toLowerCase()}`)),
        `${candidateName} renders ${doc.kind} (${group}) with no declared CRD target fact`,
      );
    }
    for (const name of expected.crds) check(declared.includes(name), `${candidateName} target facts must declare rendered CRD ${name}`);
    if (candidateName === "nvsentinel") {
      check(
        docs.every((doc) => !doc.metadata?.namespace),
        "nvsentinel render is recorded as namespace-less; a namespaced object changes that note",
      );
      const monitors = docs.filter((doc) => doc.kind === "PodMonitor");
      check(monitors.length === 1, "nvsentinel must render exactly one PodMonitor");
    }
    if (candidateName === "cluster-readiness-engine") {
      const profiles = docs.filter((doc) => doc.kind === "LogProfile");
      check(profiles.length === 4 && profiles.every((doc) => !doc.metadata?.namespace), "cluster-readiness-engine must render four cluster-scoped LogProfile objects");
      check(docs.filter((doc) => doc.kind === "ServiceMonitor").length === 1, "cluster-readiness-engine must render exactly one ServiceMonitor");
    }
  },
});

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
