// gpu-operator proof.
//
// Chart-specific declaration only. All generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs and is shared across every chart proof. The CLI surface
// is unchanged:
//   node scripts/gpu-operator-proof.mjs --generate-proof|--generate-package|
//        --verify-proof|--verify-proof-self-test|--verify-package|--compare
//
// The exact upstream artifact is pinned by environment at generate AND verify time.
// scripts/nvidia-gpu-stack-coverage.mjs supplies it for every reviewed version:
//   HELM_EXPT_CHART_VERSION=v26.3.3
//   HELM_EXPT_CHART_ARTIFACT_URL=https://helm.ngc.nvidia.com/nvidia/charts/gpu-operator-v26.3.3.tgz
//   HELM_EXPT_CHART_ARTIFACT_SHA256=59abb5852a24b3ae0ef757bfea3051f419acbf559ee5efd72f0672d28af56a68
//
// Each base holds the ordinary objects the chart renders, CRDs included. The Helm
// hook objects the same values render are not in the base: Helm runs them at
// upgrade and delete time, never as part of an install. They are packaged beside
// the base as recorded lifecycle actions by
// scripts/generate-gpu-operator-packaged-lifecycle.mjs.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runProofCli } from "./lib/proof-kit.mjs";
import { canonicalObjectMaps, identityFor, parseDocs, readYaml, repoRoot, sha256 } from "./lib/proof-common.mjs";
import {
  AICR_NESTED_RENDER_RECEIPT_PATH,
  AICR_VALUES_PATH,
  gpuOperatorBases,
  gpuOperatorChart,
  gpuOperatorExpectations,
  packageExtrasRoot,
  packagedLifecycleRoot,
} from "./lib/gpu-operator-bases.mjs";

const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "v26.3.3";
const chart = { ...gpuOperatorChart, version: chartVersion };
const reviewed = gpuOperatorExpectations(chart.version);
const bases = gpuOperatorBases(chart.version);
const deliveryLanes = ["regularHelm", "cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"];

const hookSummary = (expected) =>
  Object.entries(expected.hooks)
    .map(([phase, count]) => `${count} ${phase}`)
    .join(", ");

const variants = bases.map((base) => {
  const aicr = base.name === "aicr-eks-training";
  return {
    name: base.name,
    base: base.name,
    displayName: aicr ? "AICR EKS training values" : "chart defaults",
    valuesFile: aicr ? "effective-values-aicr-eks-training.yaml" : "effective-values.yaml",
    valuesText: base.valuesText,
    valuesSummary: aicr
      ? `the values the AICR EKS training recipe supplies (${AICR_VALUES_PATH}): node-feature-discovery off, driver ${base.expected.driverVersion}, a dcgm-exporter metrics ConfigMap`
      : `chart defaults: the bundled node-feature-discovery on, driver ${base.expected.driverVersion}`,
    expectedObjectCount: base.expected.objects,
    expectedCRDCount: base.expected.crds.length,
    expectedSecretCount: 0,
    expectedCRDs: base.expected.crds,
    expectedDriverVersion: base.expected.driverVersion,
    expectedHooks: base.expected.hooks,
    targetFacts: {
      requiredCRDs: base.expected.crds.map((name) => ({
        name,
        sourceVariant: base.name,
        purpose:
          name === "clusterpolicies.nvidia.com"
            ? "gpu-operator CRD included in this base; it must be established before Kubernetes accepts the rendered ClusterPolicy object"
            : "CRD included in this base and applied before the workloads that use it",
        deliveryLanes,
      })),
    },
    targetFactNote: aicr
      ? `the ${base.expected.crds.length} CRDs must be established before the ClusterPolicy object; node-feature-discovery is off in this base, so the target must already run it; the pre-upgrade hook is a packaged lifecycle action, not part of the base`
      : `the ${base.expected.crds.length} CRDs must be established before the ClusterPolicy object; the ${base.hookObjectCount} Helm hook objects (${hookSummary(base.expected)}) are packaged lifecycle actions, not part of the base`,
  };
});

const scanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    { id: "mutable-image-tag", severity: "high", description: "Container images must not use latest or an untagged reference." },
    { id: "service-selector-has-workload-match", severity: "high", description: "Service selectors must match a rendered workload." },
    { id: "workload-service-account-exists", severity: "high", description: "Workload ServiceAccounts must be rendered." },
    { id: "crd-upgrade-policy", severity: "medium", description: "CRDs require explicit ownership and upgrade policy." },
    { id: "cluster-rbac-review", severity: "medium", description: "Cluster-scoped RBAC requires production review." },
    { id: "operator-managed-operands", severity: "medium", description: "A custom resource that makes an operator create privileged workloads requires review of those workloads, which no render shows." },
  ],
};

const baseCountNote = bases
  .map((base) => `${base.name} renders ${base.expected.objects} objects (${base.expected.crds.length} CRDs) and ${base.hookObjectCount} Helm hook objects`)
  .join("; ");

runProofCli({
  chart,
  variants,
  scanPolicy,
  receiptSlug: "gpu-operator",
  scriptPrefix: "gpu-operator",
  // Exactly one vendored dependency: node-feature-discovery, gated by nfd.enabled.
  expectedDependencyCount: 1,
  recordChartLockDigest: true,
  // single cub-only support object (the created Namespace)
  supportObjects: [`v1|Namespace||${chart.namespace}`],
  packageExtraPaths: ({ ctx }) => [
    { source: `${packageExtrasRoot}/${ctx.chart.version}`, destination: packagedLifecycleRoot },
  ],
  packageReadme: ({ ctx }) => `# ${ctx.chartRef} ${ctx.chart.version} Installer Package

This package is generated from the gpu-operator proof artifacts. It has not been
published or run on a cluster.

${variants.map((variant) => `- \`${variant.base}\` holds ${variant.expectedObjectCount} objects, ${variant.expectedCRDCount} of them CRDs: ${variant.valuesSummary}.`).join("\n")}

The chart also renders Helm hook objects. Helm runs them when a release is
upgraded or deleted, so they are not in the bases. They are kept in
\`${packagedLifecycleRoot}\`, and \`${packagedLifecycleRoot}/lifecycle-actions.yaml\`
records when each one applies. Nothing runs them automatically.

Regenerate and check every reviewed version with:

\`\`\`sh
npm run nvidia-gpu-stack-coverage:generate -- --only gpu-operator
npm run nvidia-gpu-stack-coverage:verify -- --only gpu-operator
\`\`\`
`,
  valueModel: {
    checkedValues: [
      {
        path: "driver.version",
        disposition: "variant-axis",
        reason:
          "The NVIDIA driver version. It lands at exactly one place in the rendered objects: ClusterPolicy cluster-policy, field /spec/driver/version.",
        note: `this chart version defaults to ${reviewed.bases.default.driverVersion}${reviewed.bases["aicr-eks-training"] ? `; the aicr-eks-training base sets ${reviewed.bases["aicr-eks-training"].driverVersion}` : ""}; the proof asserts the rendered value for every base`,
        evidence: "templates/clusterpolicy.yaml (spec.driver.version from .Values.driver.version); templates/nvidiadriver.yaml reads the same value but renders only when driver.nvidiaDriverCRD.enabled is true, which no base sets",
      },
      {
        path: "nfd.enabled",
        disposition: "variant-axis",
        reason:
          "Gates the vendored node-feature-discovery subchart. On by chart default. It adds the NFD workloads, their RBAC, three NodeFeature CRDs and the post-delete prune hook.",
        note: "the aicr-eks-training base turns it off because the AICR recipe installs node-feature-discovery as its own component",
        evidence: "Chart.yaml dependencies (condition nfd.enabled), charts/node-feature-discovery/templates/post-delete-job.yaml",
      },
      {
        path: "operator.upgradeCRD",
        disposition: "left-at-default",
        reason:
          "True by chart default and in every base. It renders a pre-upgrade hook: a Job that applies the CRD files inside the operator image, with its own ServiceAccount, ClusterRole and ClusterRoleBinding.",
        note: "Helm does not upgrade CRDs from a chart's crds directory, so this hook is how the chart moves its CRDs forward on helm upgrade",
        evidence: "templates/upgrade_crd.yaml",
      },
      {
        path: "operator.cleanupCRD",
        disposition: "left-at-default",
        reason:
          "False by chart default and in every base. When true it renders a pre-delete Job that deletes the CRDs and adds helm.sh/resource-policy: keep to the ClusterPolicy.",
        note: "no base renders the cleanup Job or the keep annotation",
        evidence: "templates/cleanup_crd.yaml, templates/clusterpolicy.yaml",
      },
      {
        path: "driver.nvidiaDriverCRD.enabled",
        disposition: "left-at-default",
        reason: "False in every base, so no NVIDIADriver object renders and the ClusterPolicy alone carries the driver settings.",
        note: "turning it on moves the driver settings, including driver.version, into an NVIDIADriver object",
        evidence: "templates/nvidiadriver.yaml",
      },
      ...(chart.version === "v26.7.1"
        ? [
            {
              path: "gpuCluster.deployCR",
              disposition: "left-at-default",
              reason:
                "False by chart default, so no GPUCluster object renders. The chart still renders the gpuclusters.nvidia.com CRD, two compute-domain CRDs and an unconditional pre-delete Job that removes a chart-managed GPUCluster if one exists.",
              note: "the pre-delete Job runs with the chart's ordinary gpu-operator ServiceAccount, so it must run before the base objects are deleted",
              evidence: "templates/gpucluster.yaml, templates/cleanup_gpucluster.yaml",
            },
          ]
        : []),
    ],
    unknownValues: "not-exhaustively-checked-by-nvidia-gpu-stack-coverage-proof",
    deadValues: "not-exhaustively-checked-by-nvidia-gpu-stack-coverage-proof",
    ignoredValues: "not-exhaustively-checked-by-nvidia-gpu-stack-coverage-proof",
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", dependencyCount: 1 },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note:
        chart.version === "v26.7.1"
          ? "the packaged chart has one .Capabilities check, in templates/validations.yaml, and it runs only when gpuCluster.deployCR is true; no base sets it, so the render does not depend on the pinned Kubernetes version or API list"
          : "the packaged chart has no .Capabilities branch, so the render does not depend on the pinned Kubernetes version",
    },
    {
      category: "lifecycle-policy",
      status: "attention-required",
      policy: "no-hooks",
      note: `the bases are rendered with --no-hooks; ${baseCountNote}. The hook objects are packaged under ${packagedLifecycleRoot} with a lifecycle-actions.yaml record, and nothing runs them automatically. No hook has been run on a cluster for this entry.`,
    },
    {
      category: "crd-lifecycle",
      status: "review-required",
      count: reviewed.bases.default.crds.length,
      note: "the bases include their CRDs, and each base records them as target facts with a packaged CRD bundle so they can be established before the ClusterPolicy object is applied",
    },
    {
      category: "operator-managed-operands",
      status: "review-required",
      note: "the ClusterPolicy object tells the operator which driver, container toolkit, device plugin, DCGM and validator workloads to create on GPU nodes. Those privileged DaemonSets are created at run time and appear in no render.",
    },
    {
      category: "catalog-coverage",
      status: "packaged-with-controls",
      note: "exact source and deterministic package are retained; publication, live qualification and production support remain separate gates",
    },
    { category: "installer-support-object", status: "handled", object: `v1|Namespace||${chart.namespace}` },
  ],
  dossier: {
    maintainedNotes: [
      `This package is the exact gpu-operator@${chart.version} chart from the NGC Helm repository, locked by archive URL and SHA-256.`,
      `With the release name gpu-operator in namespace gpu-operator: ${baseCountNote}.`,
      `The chart vendors one dependency, node-feature-discovery ${reviewed.nfdVersion}, gated by nfd.enabled.`,
      `driver.version lands at ClusterPolicy cluster-policy /spec/driver/version and nowhere else in the rendered objects. Rendering the locked archive twice with only driver.version changed, on 2026-10-07, changed that one field and nothing else, hook objects included.`,
      "The retained root proves exact source bytes, deterministic rendering, and deterministic ConfigHub installer packaging. It does not claim publication, live convergence, GPU scheduling, or production support.",
      ...(reviewed.bases["aicr-eks-training"]
        ? [
            `The aicr-eks-training base renders with the bytes of ${AICR_VALUES_PATH}. Its objects equal the ordinary objects of the AICR nested-render receipt for the same archive, and that receipt's other four objects are the pre-upgrade hook set.`,
          ]
        : []),
    ],
    knownControlPoints: [
      "source-lock",
      "dependency-lock",
      "crd-ordering",
      "helm-hook-lifecycle-actions",
      "operator-managed-operands",
      "target-facts",
      "production-readiness-review",
    ],
    extra: {
      caveats: [
        "Applying a base installs the operator and its ClusterPolicy. GPU nodes are a scheduling prerequisite, not an install prerequisite: without them the operator runs and its operands schedule nowhere.",
        "The default driver.version follows the chart version, so moving between chart versions can change the driver. Set driver.version explicitly to hold it.",
        "With nfd.enabled false the operator still selects nodes by node-feature-discovery labels, so the target must run node-feature-discovery itself.",
        "The pre-upgrade Job applies the CRD files baked into the operator image. A delivery tool that applies the CRDs in the base itself does the same work, and should not also run the Job unless it means to.",
        "The post-delete prune Job removes node-feature-discovery labels, annotations and taints from every node. Applied as an ordinary object at install time it would do that immediately.",
      ],
    },
  },
  plan: {
    status: "packaged-with-controls",
    scanGate: "warn-production-blocked",
    nextAction:
      "publish and sign the package, then run the CRD-first install, the upgrade action and the delete action on a GPU target before recording any lifecycle route as observed",
  },
  readme: {
    intro: `This recipe audits the NVIDIA GPU Operator chart at ${chart.version}, taken from the NGC Helm repository by exact archive URL and SHA-256. The operator installs and manages the driver, container toolkit, device plugin and monitoring workloads that GPU nodes need. Each base holds the ordinary objects the chart renders; the Helm hook objects are packaged separately as recorded lifecycle actions.`,
    proves: [
      "the version-specific upstream artifact and SHA are locked without a mutable Helm index lookup;",
      "every base renders deterministically and the installer package preserves the rendered object set, plus the explained Namespace support object;",
      "the rendered driver version of every base is the one this recipe records, at ClusterPolicy /spec/driver/version;",
      "no base contains a Helm hook object;",
      "retention here does not imply publication, live convergence, GPU scheduling, or production support.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    allowedScopes: ["catalog-selection", "local-test"],
    blockedScopes: ["production"],
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "the exact artifact and deterministic installer package are retained; the package is not published and no live run is recorded",
      "the ClusterPolicy makes the operator create privileged operand workloads that no render shows",
      variant.targetFactNote,
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
      if (doc.kind === "ClusterPolicy") {
        findings.push({
          id: `operator-managed-operands:${identity}`,
          rule: "operator-managed-operands",
          severity: "medium",
          object: identity,
          message: "The operator creates privileged driver and toolkit workloads from this object at run time; they are not in the rendered object set",
        });
      }
    }
    return findings;
  },
  // Chart-specific verify assertions that the generic kit cannot infer.
  verifyExtra({ root, controlPoints, dependencyLock, perVariant, check }) {
    check(
      controlPoints.spec.points?.some((point) => point.category === "lifecycle-policy" && point.policy === "no-hooks"),
      "lifecycle-policy control point missing",
    );
    const dependencies = dependencyLock.spec?.dependencies ?? [];
    check(
      dependencies.length === 1 && dependencies[0].name === "node-feature-discovery" && dependencies[0].version === reviewed.nfdVersion,
      `gpu-operator ${chart.version} must vendor node-feature-discovery ${reviewed.nfdVersion}`,
    );
    for (const variant of variants) {
      const row = perVariant.get(variant.name);
      const releaseText = readFileSync(row.releasePath, "utf8");
      const docs = parseDocs(releaseText);
      const crds = docs
        .filter((doc) => doc.kind === "CustomResourceDefinition")
        .map((doc) => doc.metadata?.name)
        .sort();
      check(JSON.stringify(crds) === JSON.stringify(variant.expectedCRDs), `${variant.name} CRD set mismatch: ${crds.join(", ")}`);
      check(
        !docs.some((doc) => doc.metadata?.annotations?.["helm.sh/hook"]),
        `${variant.name} base must not contain Helm hook objects`,
      );
      check(!docs.some((doc) => doc.kind === "Job"), `${variant.name} base must not contain a Job`);
      check(!docs.some((doc) => doc.kind === "Secret"), `${variant.name} base must not contain a Secret`);
      const policies = docs.filter((doc) => doc.kind === "ClusterPolicy");
      check(policies.length === 1 && policies[0].metadata?.name === "cluster-policy", `${variant.name} must render one ClusterPolicy named cluster-policy`);
      check(
        policies[0].spec?.driver?.version === variant.expectedDriverVersion,
        `${variant.name} ClusterPolicy /spec/driver/version must be ${variant.expectedDriverVersion}; found ${policies[0].spec?.driver?.version}`,
      );
      check(
        !policies[0].metadata?.annotations?.["helm.sh/resource-policy"],
        `${variant.name} ClusterPolicy must not carry a resource-policy annotation`,
      );
      check(row.identities.includes("apps/v1|Deployment|gpu-operator|gpu-operator"), `${variant.name} operator Deployment missing`);
      const nfdRendered = row.identities.some((identity) => identity.includes("node-feature-discovery"));
      check(
        nfdRendered === (variant.name !== "aicr-eks-training"),
        `${variant.name} node-feature-discovery rendering does not match the base definition`,
      );
      const variantDoc = readYaml(join(root, "variants", variant.name, "variant.yaml"));
      const declared = (variantDoc.spec?.targetFacts?.requiredCRDs ?? []).map((crd) => crd.name).sort();
      check(JSON.stringify(declared) === JSON.stringify(variant.expectedCRDs), `${variant.name} target facts must declare exactly the rendered CRDs`);

      if (variant.name === "aicr-eks-training") verifyAicrBinding({ variant, releaseText, row, check });
    }
  },
});

// The aicr-eks-training base claims to be what the AICR recipe renders. That claim
// is checked against the recipe's own committed nested-render receipt: same
// archive, same values bytes, and the same objects once the hook set is set aside.
function verifyAicrBinding({ variant, releaseText, row, check }) {
  const receipt = readYaml(join(repoRoot, AICR_NESTED_RENDER_RECEIPT_PATH));
  check(receipt.spec?.values?.path === AICR_VALUES_PATH, "AICR nested-render receipt no longer names the bound values file");
  check(
    sha256(variant.valuesText) === receipt.spec?.values?.sha256,
    "aicr-eks-training values bytes differ from the AICR nested-render receipt",
  );
  check(
    receipt.spec?.sourceArtifact?.sha256 === (process.env.HELM_EXPT_CHART_ARTIFACT_SHA256 ?? "").replace(/^sha256:/, ""),
    "aicr-eks-training must use the chart archive the AICR nested-render receipt records",
  );
  const nestedText = readFileSync(join(repoRoot, receipt.spec.output.path), "utf8");
  const maps = canonicalObjectMaps(releaseText, nestedText);
  const baseKeys = Object.keys(maps.helm).sort();
  const nestedKeys = Object.keys(maps.cub).sort();
  check(baseKeys.length === row.identities.length, "aicr-eks-training object map is incomplete");
  for (const key of baseKeys) {
    check(maps.helm[key] === maps.cub[key], `aicr-eks-training object differs from the AICR nested render: ${key}`);
  }
  const hookKeys = nestedKeys.filter((key) => !baseKeys.includes(key));
  const hookDocs = parseDocs(nestedText).filter((doc) => hookKeys.includes(identityFor(doc)));
  check(
    hookDocs.length === variant.expectedHooks["pre-upgrade"]
      && hookDocs.every((doc) => doc.metadata?.annotations?.["helm.sh/hook"] === "pre-upgrade"),
    "the AICR nested render may differ from the aicr-eks-training base only by the pre-upgrade hook objects",
  );
}
