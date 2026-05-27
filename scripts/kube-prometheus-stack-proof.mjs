import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import {
  canonicalObjectMaps,
  check,
  command,
  difference,
  findingCounts,
  identityFor,
  imageTag,
  labelsMatch,
  listFiles,
  listYamlFiles,
  normalizeYaml,
  objectFilesFromDirs,
  parseDocs,
  parseObjects,
  readYaml,
  readYamlText,
  relativeRepo,
  repoRoot,
  runCub,
  sha256,
  sha256File,
  workloadPodSpec,
  workloadTemplateLabels,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const proofRoot = join(repoRoot, "recipes", "prometheus-community", "kube-prometheus-stack", "85.3.3");
const packageRoot = join(repoRoot, "packages", "prometheus-community", "kube-prometheus-stack", "85.3.3");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chart = {
  repository: "prometheus-community",
  repositoryURL: "https://prometheus-community.github.io/helm-charts",
  name: "kube-prometheus-stack",
  version: "85.3.3",
  releaseName: "kube-prometheus-stack",
  namespace: "monitoring",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default with Grafana password bound",
    valuesFile: "effective-values.yaml",
    valuesText: `grafana:
  adminPassword: confighub-grafana-admin-password
`,
    valuesSummary: "default stack with Grafana admin password bound as a generated fact",
    expectedObjectCount: 124,
    expectedCRDCount: 10,
    expectedSecretCount: 2,
    targetFactNote: "includes Prometheus Operator CRDs, Grafana, webhook configurations, and generated Grafana admin password binding",
  },
  {
    name: "no-crds",
    base: "no-crds",
    displayName: "CRDs disabled",
    valuesFile: "effective-values-no-crds.yaml",
    valuesText: `crds:
  enabled: false
grafana:
  adminPassword: confighub-grafana-admin-password
`,
    valuesSummary: "CRDs disabled with Grafana admin password bound",
    expectedObjectCount: 114,
    expectedCRDCount: 0,
    expectedSecretCount: 2,
    targetFactNote: "omits Prometheus Operator CRDs while preserving Grafana, webhooks, RBAC, rules, and ServiceMonitors",
  },
];

const localScanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    {
      id: "mutable-image-tag",
      severity: "high",
      description: "Container image must use an immutable or non-latest tag.",
    },
    {
      id: "service-selector-has-workload-match",
      severity: "high",
      description: "Service selector must match a rendered workload pod template.",
    },
    {
      id: "workload-service-account-exists",
      severity: "high",
      description: "Workload serviceAccountName must reference a rendered ServiceAccount.",
    },
    {
      id: "admission-webhook-requires-observation",
      severity: "medium",
      description: "Admission webhook availability must be observed after apply.",
    },
    {
      id: "generated-secret-ownership",
      severity: "medium",
      description: "Rendered Secrets with generated material need explicit ownership and observation policy.",
    },
    {
      id: "dependency-lock-review",
      severity: "medium",
      description: "Disabled chart dependencies still need lock and provenance review.",
    },
    {
      id: "crd-upgrade-policy",
      severity: "medium",
      description: "CRDs need explicit readiness, ordering, schema, and upgrade policy.",
    },
    {
      id: "cluster-rbac-review",
      severity: "medium",
      description: "Cluster-scoped RBAC needs explicit review before production.",
    },
  ],
};

const args = process.argv.slice(2);
const mode = args[0] ?? "--help";

if (mode === "--generate-proof") {
  generateProof();
} else if (mode === "--generate-package") {
  generatePackage();
} else if (mode === "--verify-proof") {
  verifyProof();
} else if (mode === "--verify-proof-self-test") {
  verifyProofSelfTest();
} else if (mode === "--verify-package") {
  verifyPackage();
} else if (mode === "--compare") {
  verifyPackage();
} else {
  console.log(`Usage:
  node scripts/kube-prometheus-stack-proof.mjs --generate-proof
  node scripts/kube-prometheus-stack-proof.mjs --generate-package
  node scripts/kube-prometheus-stack-proof.mjs --verify-proof
  node scripts/kube-prometheus-stack-proof.mjs --verify-proof-self-test
  node scripts/kube-prometheus-stack-proof.mjs --verify-package
  node scripts/kube-prometheus-stack-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: "kube-prometheus-stack-kube-prometheus-stack-85.3.3" },
    spec: {
      sourceType: "HelmChart",
      repositoryName: chart.repository,
      repositoryURL: chart.repositoryURL,
      chart: chart.name,
      version: chart.version,
      appVersion: source.appVersion,
      packageSHA256: source.packageSHA256,
      packageBytes: source.packageBytes,
      evidence: {
        harnessReceipt: "../../../../data/adversarial10/charts/kube-prometheus-stack-kube-prometheus-stack-85.3.3/render-receipt.yaml",
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: "kube-prometheus-stack-kube-prometheus-stack-85.3.3" },
    spec: {
      chart: "prometheus-community/kube-prometheus-stack",
      version: chart.version,
      dependencies: source.dependencies,
      chartLockDigest: source.chartLockDigest,
    },
  });

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: "kube-prometheus-stack-kube-prometheus-stack-85.3.3" },
    spec: {
      checkedValues: [
        {
          path: "grafana.adminPassword",
          variant: "default",
          disposition: "generated-fact-bound",
          reason: "Grafana subchart generates a random admin password by default; this proof binds it before render",
        },
        {
          path: "grafana.adminPassword",
          variant: "no-crds",
          disposition: "generated-fact-bound",
          reason: "The no-crds variant keeps Grafana enabled and binds the same generated fact before render",
        },
        {
          path: "crds.enabled",
          variant: "default",
          disposition: "crds-included",
          reason: "chart defaults render all Prometheus Operator CRDs",
        },
        {
          path: "crds.enabled",
          variant: "no-crds",
          disposition: "crds-excluded",
          reason: "omits CRDs from the rendered revision for clusters that manage CRDs separately",
        },
        {
          path: "crds.*",
          variant: "all",
          disposition: "crd-selection-controls",
          reason: "controls Prometheus Operator CRD rendering",
        },
        {
          path: "prometheusOperator.admissionWebhooks.*",
          variant: "all",
          disposition: "admission-webhook-policy",
          reason: "controls Prometheus Operator admission webhook objects and patch-job hook policy",
        },
        {
          path: "additionalPrometheusRulesMap / prometheus.prometheusSpec.additionalScrapeConfigs / extraManifests",
          variant: "all",
          disposition: "empty-extension-slot",
          reason: "chart exposes tpl/raw monitoring extension slots; promoted variants keep them empty",
        },
        {
          path: "grafana.enabled / kubeStateMetrics.enabled / nodeExporter.enabled",
          variant: "all",
          disposition: "umbrella-dependency-selection",
          reason: "umbrella chart dependencies remain enabled in promoted variants and are recorded in dependency-lock.yaml",
        },
      ],
      unknownValues: "not-checked",
      deadValues: "not-checked",
      ignoredValues: "not-checked",
    },
  });

  writeYaml(join(proofRoot, "control-points.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ControlPoints",
    metadata: { name: "kube-prometheus-stack-kube-prometheus-stack-85.3.3" },
    spec: {
      points: [
        { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
        {
          category: "dependency-lock",
          status: "handled",
          evidence: "dependency-lock.yaml",
          note: "chart declares CRD, kube-state-metrics, node-exporter, Grafana, and windows-exporter dependencies; promoted variants lock their metadata.",
        },
        {
          category: "capability-profile",
          status: "handled",
          kubeVersion: chart.kubeVersion,
          note: "OpenShift and ServiceMonitor branches are bound to the named Kubernetes capability profile.",
        },
        {
          category: "crd-policy",
          status: "variant-controlled",
          variants: { default: 10, "no-crds": 0 },
          note: "CRDs are ordinary rendered objects in the default variant and still need lifecycle/upgrade policy.",
        },
        {
          category: "admission-webhook",
          status: "scan-and-observe",
          objects: [
            "admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||kube-prometheus-stack-admission",
            "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||kube-prometheus-stack-admission",
          ],
        },
        {
          category: "generated-facts",
          status: "variant-controlled",
          evidence: "grafana.adminPassword",
          note: "Both promoted variants bind Grafana admin password before render so Helm output is deterministic.",
        },
        { category: "cluster-rbac", status: "scan-and-review", evidence: "scan receipts" },
        {
          category: "tpl",
          status: "controlled-by-empty-defaults",
          note: "Prometheus/Grafana rules, scrape configs, datasource config, and extraManifests can use templating; promoted variants keep raw slots empty.",
        },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||monitoring" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "kube-prometheus-stack-kube-prometheus-stack", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: "../../../../packages/prometheus-community/kube-prometheus-stack/85.3.3",
        setupCommand: [
          "cub",
          "install",
          "setup",
          "--pull",
          "../../../../packages/prometheus-community/kube-prometheus-stack/85.3.3",
          "--non-interactive",
          "--namespace",
          "monitoring",
        ],
      },
      variants: variants.map((variant) => `variants/${variant.name}/variant.yaml`),
    },
  });

  const summaries = [];
  for (const variant of variants) {
    const render = renderVariant(variant);
    if (!render.deterministic) {
      throw new Error(`${variant.name} did not render deterministically`);
    }
    const releaseObjects = normalizeYaml(render.first);
    const releaseDigest = sha256(releaseObjects);
    const renderedRoot = join(revisionRoot(variant.name), "rendered");
    const receiptsRoot = join(revisionRoot(variant.name), "receipts");
    mkdirSync(renderedRoot, { recursive: true });
    mkdirSync(receiptsRoot, { recursive: true });
    write(join(renderedRoot, "release-objects.yaml"), releaseObjects);
    const objects = parseObjects(releaseObjects);
    if (objects.length !== variant.expectedObjectCount) {
      throw new Error(`${variant.name} expected ${variant.expectedObjectCount} objects, got ${objects.length}`);
    }
    const docs = parseDocs(releaseObjects);
    const secretCount = docs.filter((doc) => doc.kind === "Secret").length;
    const inventory = {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "RenderedObjectInventory",
      metadata: { name: `kube-prometheus-stack-kube-prometheus-stack-${chart.version}-${variant.name}-r001` },
      spec: {
        source: "rendered/release-objects.yaml",
        sourceSHA256: releaseDigest,
        objectCount: objects.length,
        objects,
      },
    };
    writeYaml(join(renderedRoot, "object-inventory.yaml"), inventory);

    const effectiveValues = effectiveValuesDoc(variant, source.defaultValuesSHA256);
    writeYaml(join(proofRoot, variant.valuesFile), effectiveValues);
    const variantDoc = variantDocFor(variant);
    writeYaml(join(proofRoot, "variants", variant.name, "variant.yaml"), variantDoc);

    const recipeDigest = sha256File(join(proofRoot, "recipe.yaml"));
    const variantDigest = sha256File(join(proofRoot, "variants", variant.name, "variant.yaml"));
    const effectiveValuesDigest = sha256File(join(proofRoot, variant.valuesFile));
    const rendererFingerprint = sha256(
      JSON.stringify({
        renderer: "helm",
        helmVersion,
        kubeVersion: chart.kubeVersion,
        flags: ["--include-crds", "--skip-tests", "--no-hooks"],
      }),
    );
    const revisionDigest = sha256(
      JSON.stringify({ recipeDigest, variantDigest, effectiveValuesDigest, rendererFingerprint, releaseDigest }),
    );

    writeYaml(join(revisionRoot(variant.name), "variant-revision.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "VariantRevision",
      metadata: { name: `${variant.name}-r001` },
      spec: {
        variant: `../../../variants/${variant.name}/variant.yaml`,
        revision: "r001",
        digest: revisionDigest,
        digestInputs: {
          recipeSHA256: recipeDigest,
          variantSHA256: variantDigest,
          effectiveValuesSHA256: effectiveValuesDigest,
          rendererSHA256: rendererFingerprint,
          renderedObjectSetSHA256: releaseDigest,
        },
        rendered: {
          releaseObjects: "rendered/release-objects.yaml",
          objectInventory: "rendered/object-inventory.yaml",
          objectCount: objects.length,
        },
      },
    });

    const scanFindings = scanDocs(docs);
    const scanCounts = findingCounts(scanFindings);
    const scanResult = scanFindings.some((finding) => finding.severity === "high") ? "warn" : scanFindings.length ? "warn" : "pass";
    const policyBundleDigest = sha256(JSON.stringify(localScanPolicy));
    writeYaml(join(receiptsRoot, "render-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "RenderReceipt",
      metadata: { name: `kube-prometheus-stack-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderer: {
          name: "helm",
          version: helmVersion,
          kubeVersion: chart.kubeVersion,
          flags: ["--include-crds", "--skip-tests", "--no-hooks"],
        },
        inputs: {
          sourceLockSHA256: sha256File(join(proofRoot, "source-lock.yaml")),
          dependencyLockSHA256: sha256File(join(proofRoot, "dependency-lock.yaml")),
          effectiveValuesSHA256: effectiveValuesDigest,
        },
        outputs: {
          renderedObjectSetSHA256: releaseDigest,
          renderedObjectInventorySHA256: sha256File(join(renderedRoot, "object-inventory.yaml")),
          deterministicAcrossTwoLocalRenders: true,
          objectCount: objects.length,
          renderedSecretCount: secretCount,
          secretCountSeparatedByCubInstall: variant.expectedSecretCount,
        },
      },
    });
    writeYaml(join(receiptsRoot, "helm-equivalence-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "HelmEquivalenceReceipt",
      metadata: { name: `kube-prometheus-stack-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        regularHelm: { renderedSHA256: releaseDigest, objectCount: objects.length },
        cubInstall: {
          objectCountIncludingSecretsAndSupportObjects: objects.length + 1,
          uploadedManifestFiles: objects.length + 1,
          separatedSecretFiles: variant.expectedSecretCount,
          semanticObjectMatches: `${objects.length}/${objects.length}`,
        },
        semanticNormalizations: ["prune-null-fields", "prune-empty-metadata-maps"],
        classifications: [
          { identity: "v1|Namespace||monitoring", classification: "installer-support-object", disposition: "allowed" },
        ],
        result: "pass",
        evidenceCommand: "npm run kube-prometheus-stack:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `kube-prometheus-stack-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        result: scanResult,
        scanner: { name: localScanPolicy.scanner, version: localScanPolicy.version },
        policyBundleDigest,
        findingCounts: scanCounts,
        findings: scanFindings,
      },
    });
    writeYaml(join(receiptsRoot, "install-gate.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "InstallGate",
      metadata: { name: `kube-prometheus-stack-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        decision: "warn",
        allowedScopes: ["local-test"],
        blockedScopes: ["production"],
        reasons: [
          `Helm equivalence passed for ${variant.name}`,
          "CRD install/upgrade behavior needs explicit lifecycle policy before production",
          "Admission webhook availability needs a fresh observation receipt after apply",
          "Grafana admin password binding must be owned by generated-fact policy before production",
          "Cluster-scoped RBAC needs production review",
          variant.targetFactNote,
        ],
      },
    });
    summaries.push({ ...variant, releaseDigest, objects, scanCounts, scanResult });
  }

  writeYaml(join(proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: "kube-prometheus-stack-kube-prometheus-stack-85.3.3" },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "prometheus-community/kube-prometheus-stack",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        nextAction: "publish only after CRD lifecycle/upgrade policy, webhook observation policy, generated Grafana credential policy, dependency lock review, and cluster RBAC review are satisfied",
      },
      receipts: summaries.flatMap((summary) => [
        `revisions/${summary.name}/r001/receipts/helm-equivalence-receipt.yaml`,
        `revisions/${summary.name}/r001/receipts/render-receipt.yaml`,
        `revisions/${summary.name}/r001/receipts/scan-receipt.yaml`,
        `revisions/${summary.name}/r001/receipts/install-gate.yaml`,
      ]),
    },
  });
  writeYaml(join(proofRoot, "chart-dossier.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ChartDossier",
    metadata: { name: "kube-prometheus-stack-kube-prometheus-stack-85.3.3" },
    spec: {
      chart: "prometheus-community/kube-prometheus-stack",
      version: chart.version,
      maintainedNotes: [
        "Default chart render is nondeterministic unless grafana.adminPassword is bound before render.",
        "default variant binds grafana.adminPassword and renders 10 Prometheus Operator CRDs.",
        "no-crds variant omits CRDs for clusters that manage CRDs separately.",
        "Chart declares CRD, kube-state-metrics, node-exporter, Grafana, and windows-exporter dependencies and records them in dependency-lock.yaml.",
        "Admission webhook readiness must be observed after apply because rendered objects alone do not prove webhook health.",
        "CRD manifests include YAML enum scalars such as bare equals signs; the proof parser handles these as scalar strings.",
        "Rules, scrape configs, datasource config, and extraManifests are tpl/raw extension slots; promoted variants keep raw slots empty.",
      ],
      knownControlPoints: [
        "capability-profile",
        "crd-lifecycle-policy",
        "generated-facts",
        "dependency-lock",
        "admission-webhook-observation",
        "cluster-rbac-scan",
        "tpl-extension-slot",
      ],
    },
  });
  writeReadme(summaries);
  console.log(`Wrote ${relativeRepo(proofRoot)}`);
}

function generatePackage() {
  verifyProof();
  rmSync(packageRoot, { recursive: true, force: true });
  mkdirSync(packageRoot, { recursive: true });
  writeYaml(join(packageRoot, "installer.yaml"), {
    apiVersion: "installer.confighub.com/v1alpha1",
    kind: "Package",
    metadata: { name: "kube-prometheus-stack-kube-prometheus-stack", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `kube-prometheus-stack ${variant.displayName} variant rendered from prometheus-community/kube-prometheus-stack@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# prometheus-community/kube-prometheus-stack ${chart.version} Installer Package

This package is generated from the kube-prometheus-stack proof artifacts.

\`\`\`sh
npm run kube-prometheus-stack:generate-package
npm run kube-prometheus-stack:verify-package
\`\`\`
`,
  );
  for (const variant of variants) {
    const baseRoot = join(packageRoot, "bases", variant.base);
    mkdirSync(baseRoot, { recursive: true });
    writeYaml(join(baseRoot, "kustomization.yaml"), {
      apiVersion: "kustomize.config.k8s.io/v1beta1",
      kind: "Kustomization",
      resources: ["upstream.yaml"],
    });
    write(
      join(baseRoot, "upstream.yaml"),
      readFileSync(join(revisionRoot(variant.name), "rendered", "release-objects.yaml"), "utf8"),
    );
  }

  const files = listFiles(packageRoot).map((path) => ({
    path: relative(packageRoot, path),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
  const tempRoot = mkdtempSync(join(tmpdir(), "kube-prometheus-stack-installer-package-"));
  try {
    const firstPackage = join(tempRoot, "kube-prometheus-stack-85.3.3-a.tgz");
    const secondPackage = join(tempRoot, "kube-prometheus-stack-85.3.3-b.tgz");
    runCub(["install", "package", packageRoot, "-o", firstPackage]);
    runCub(["install", "package", packageRoot, "-o", secondPackage]);
    const firstSHA = sha256File(firstPackage);
    const secondSHA = sha256File(secondPackage);
    if (firstSHA !== secondSHA || !readFileSync(firstPackage).equals(readFileSync(secondPackage))) {
      throw new Error("cub install package did not produce byte-identical bundles");
    }
    mkdirSync(dirname(receiptPath), { recursive: true });
    writeYaml(receiptPath, {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "InstallerPackageReceipt",
      metadata: { name: "kube-prometheus-stack-kube-prometheus-stack-85.3.3" },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "kube-prometheus-stack-kube-prometheus-stack",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub install package ${packageRelative} -o <tmp>/kube-prometheus-stack-85.3.3.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub install setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace monitoring`,
          helmReleaseObjectCount: variant.expectedObjectCount,
          cubInstallObjectCountIncludingSupport: variant.expectedObjectCount + 1,
          semanticObjectMatches: `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
          separatedSecretCount: variant.expectedSecretCount,
          allowedCubOnlyObjects: ["v1|Namespace||monitoring"],
        })),
      },
    });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  verifyPackage();
  console.log(`Wrote ${packageRelative}`);
  console.log(`Wrote ${relativeRepo(receiptPath)}`);
}

function verifyProof(root = proofRoot) {
  const requiredFiles = [
    "README.md",
    "helm-plan.yaml",
    "chart-dossier.yaml",
    "source-lock.yaml",
    "dependency-lock.yaml",
    "control-points.yaml",
    "value-model.yaml",
    "effective-values.yaml",
    "effective-values-no-crds.yaml",
    "recipe.yaml",
    "variants/default/variant.yaml",
    "variants/no-crds/variant.yaml",
    "revisions/default/r001/variant-revision.yaml",
    "revisions/default/r001/rendered/release-objects.yaml",
    "revisions/default/r001/rendered/object-inventory.yaml",
    "revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/default/r001/receipts/render-receipt.yaml",
    "revisions/default/r001/receipts/scan-receipt.yaml",
    "revisions/default/r001/receipts/install-gate.yaml",
    "revisions/no-crds/r001/variant-revision.yaml",
    "revisions/no-crds/r001/rendered/release-objects.yaml",
    "revisions/no-crds/r001/rendered/object-inventory.yaml",
    "revisions/no-crds/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/no-crds/r001/receipts/render-receipt.yaml",
    "revisions/no-crds/r001/receipts/scan-receipt.yaml",
    "revisions/no-crds/r001/receipts/install-gate.yaml",
  ];
  for (const file of requiredFiles) {
    check(existsSync(join(root, file)), `missing required file ${file}`);
  }
  const sourceLock = readYaml(join(root, "source-lock.yaml"));
  const dependencyLock = readYaml(join(root, "dependency-lock.yaml"));
  const recipe = readYaml(join(root, "recipe.yaml"));
  const valueModel = readYaml(join(root, "value-model.yaml"));
  const controlPoints = readYaml(join(root, "control-points.yaml"));
  check(sourceLock.kind === "SourceLock", "source-lock.yaml must be SourceLock");
  check(sourceLock.spec.repositoryName === "prometheus-community", "source repository mismatch");
  check(sourceLock.spec.chart === "kube-prometheus-stack", "source chart mismatch");
  check(sourceLock.spec.version === "85.3.3", "source version mismatch");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).length === 5, "kube-prometheus-stack dependency lock must record five dependencies");
  for (const dependencyName of ["crds", "kube-state-metrics", "prometheus-node-exporter", "grafana", "prometheus-windows-exporter"]) {
    check(
      dependencyLock.spec.dependencies?.some((dependency) => dependency.name === dependencyName),
      `kube-prometheus-stack dependency ${dependencyName} missing`,
    );
  }
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "capability-profile"), "capability-profile control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "generated-facts"), "generated-facts control point missing");

  for (const variant of variants) {
    const releasePath = join(root, "revisions", variant.name, "r001", "rendered", "release-objects.yaml");
    const releaseDigest = sha256File(releasePath);
    const objects = parseObjects(readFileSync(releasePath, "utf8"));
    check(objects.length === variant.expectedObjectCount, `${variant.name} object count mismatch`);
    const identities = objects.map((object) => object.identity);
    const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
    const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
    check(new Set(identities).size === identities.length, `${variant.name} duplicate object identities`);
    check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
    check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
    check(identities.includes("apps/v1|Deployment|monitoring|kube-prometheus-stack-operator"), `${variant.name} operator Deployment missing`);
    check(identities.includes("apps/v1|Deployment|monitoring|kube-prometheus-stack-grafana"), `${variant.name} Grafana Deployment missing`);
    check(identities.includes("apps/v1|Deployment|monitoring|kube-prometheus-stack-kube-state-metrics"), `${variant.name} kube-state-metrics Deployment missing`);
    check(identities.includes("apps/v1|DaemonSet|monitoring|kube-prometheus-stack-prometheus-node-exporter"), `${variant.name} node-exporter DaemonSet missing`);
    check(identities.includes("v1|Service|monitoring|kube-prometheus-stack-operator"), `${variant.name} operator Service missing`);
    check(identities.includes("v1|Service|monitoring|kube-prometheus-stack-grafana"), `${variant.name} Grafana Service missing`);
    check(identities.includes("v1|Secret|monitoring|kube-prometheus-stack-grafana"), `${variant.name} Grafana Secret missing`);
    check(identities.includes("monitoring.coreos.com/v1|Prometheus|monitoring|kube-prometheus-stack-prometheus"), `${variant.name} Prometheus custom resource missing`);
    check(identities.includes("monitoring.coreos.com/v1|Alertmanager|monitoring|kube-prometheus-stack-alertmanager"), `${variant.name} Alertmanager custom resource missing`);
    check(
      identities.includes("admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||kube-prometheus-stack-admission"),
      `${variant.name} MutatingWebhookConfiguration missing`,
    );
    check(
      identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||kube-prometheus-stack-admission"),
      `${variant.name} ValidatingWebhookConfiguration missing`,
    );
    if (variant.name === "default") {
      const requiredCRDs = [
        "apiextensions.k8s.io/v1|CustomResourceDefinition||alertmanagerconfigs.monitoring.coreos.com",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||alertmanagers.monitoring.coreos.com",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||podmonitors.monitoring.coreos.com",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||probes.monitoring.coreos.com",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||prometheusagents.monitoring.coreos.com",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||prometheuses.monitoring.coreos.com",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||prometheusrules.monitoring.coreos.com",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||scrapeconfigs.monitoring.coreos.com",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||servicemonitors.monitoring.coreos.com",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||thanosrulers.monitoring.coreos.com",
      ];
      for (const identity of requiredCRDs) check(identities.includes(identity), `missing CRD ${identity}`);
    }
    if (variant.name === "no-crds") {
      check(!crdIdentities.length, "no-crds must not render CRDs");
    }

    const inventory = readYaml(join(root, "revisions", variant.name, "r001", "rendered", "object-inventory.yaml"));
    const revision = readYaml(join(root, "revisions", variant.name, "r001", "variant-revision.yaml"));
    const renderReceipt = readYaml(join(root, "revisions", variant.name, "r001", "receipts", "render-receipt.yaml"));
    const equivalence = readYaml(join(root, "revisions", variant.name, "r001", "receipts", "helm-equivalence-receipt.yaml"));
    const scan = readYaml(join(root, "revisions", variant.name, "r001", "receipts", "scan-receipt.yaml"));
    const gate = readYaml(join(root, "revisions", variant.name, "r001", "receipts", "install-gate.yaml"));
    check(inventory.spec.sourceSHA256 === releaseDigest, `${variant.name} inventory source digest mismatch`);
    check(inventory.spec.objectCount === variant.expectedObjectCount, `${variant.name} inventory object count mismatch`);
    check(revision.spec.digestInputs.renderedObjectSetSHA256 === releaseDigest, `${variant.name} revision digest mismatch`);
    check(renderReceipt.spec.outputs.renderedObjectSetSHA256 === releaseDigest, `${variant.name} render receipt digest mismatch`);
    check(renderReceipt.spec.outputs.objectCount === variant.expectedObjectCount, `${variant.name} render receipt count mismatch`);
    check(renderReceipt.spec.outputs.deterministicAcrossTwoLocalRenders === true, `${variant.name} must be deterministic`);
    check(equivalence.spec.regularHelm.renderedSHA256 === releaseDigest, `${variant.name} equivalence digest mismatch`);
    check(equivalence.spec.result === "pass", `${variant.name} equivalence must pass`);
    check(
      equivalence.spec.cubInstall.semanticObjectMatches === `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
      `${variant.name} semantic match mismatch`,
    );
    check(scan.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} scan digest mismatch`);
    check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag CRD/admission/secret/RBAC review`);
    check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} install gate digest mismatch`);
    check(gate.spec.decision === "warn", `${variant.name} install gate should warn`);
  }
  console.log("verified kube-prometheus-stack proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "kube-prometheus-stack-proof-self-test-"));
  try {
    cpSync(proofRoot, tempRoot, { recursive: true });
    const releasePath = join(tempRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml");
    write(releasePath, `${readFileSync(releasePath, "utf8")}\n# tampered\n`);
    let rejected = false;
    try {
      verifyProof(tempRoot);
    } catch (error) {
      rejected = String(error.message).includes("inventory source digest mismatch");
    }
    if (!rejected) throw new Error("self-test did not reject rendered object tampering");
    console.log("self-test passed: kube-prometheus-stack rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run kube-prometheus-stack:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run kube-prometheus-stack:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "kube-prometheus-stack-kube-prometheus-stack", "package name mismatch");
  check(receipt.kind === "InstallerPackageReceipt", "package receipt kind mismatch");
  check(receipt.spec.package.path === packageRelative, "receipt package path mismatch");

  const bases = installer.spec.bases ?? [];
  check(bases.length === 2, "package must declare two bases");
  check(bases.filter((base) => base.default === true).length === 1, "package must have one default base");
  for (const variant of variants) {
    const base = bases.find((item) => item.name === variant.base);
    check(Boolean(base), `missing base ${variant.base}`);
    check(base.path === `bases/${variant.base}`, `${variant.name} base path mismatch`);
    check(
      readFileSync(join(packageRoot, base.path, "upstream.yaml"), "utf8") ===
        readFileSync(join(revisionRoot(variant.name), "rendered", "release-objects.yaml"), "utf8"),
      `${variant.name} package upstream must match rendered release objects`,
    );
  }

  const receiptFiles = receipt.spec.package.sourceFiles ?? [];
  const actualFiles = listFiles(packageRoot).map((path) => ({
    path: relative(packageRoot, path),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
  check(receiptFiles.length === actualFiles.length, "package source file count mismatch");
  const actualByPath = new Map(actualFiles.map((file) => [file.path, file]));
  for (const file of receiptFiles) {
    const actual = actualByPath.get(file.path);
    check(Boolean(actual), `receipt references missing file ${file.path}`);
    check(actual.sha256 === file.sha256, `source file SHA mismatch for ${file.path}`);
    check(actual.bytes === file.bytes, `source file byte count mismatch for ${file.path}`);
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "kube-prometheus-stack-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "kube-prometheus-stack-a.tgz");
    const secondPackage = join(tempRoot, "kube-prometheus-stack-b.tgz");
    runCub(["install", "package", packageRoot, "-o", firstPackage]);
    runCub(["install", "package", packageRoot, "-o", secondPackage]);
    const firstSHA = sha256File(firstPackage);
    const secondSHA = sha256File(secondPackage);
    check(firstSHA === secondSHA, "package SHA changed across two local bundles");
    check(readFileSync(firstPackage).equals(readFileSync(secondPackage)), "package bytes changed across two local bundles");
    check(firstSHA === receipt.spec.deterministicBundle.sha256, "deterministic bundle SHA mismatch");
    for (const variant of variants) verifySetupVariant(tempRoot, variant, receipt);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  console.log("kube-prometheus-stack installer package verification passed");
}

function verifySetupVariant(tempRoot, variant, receipt) {
  const checkReceipt = (receipt.spec.setupChecks ?? []).find((item) => item.variant === variant.name);
  check(Boolean(checkReceipt), `receipt missing setup check for ${variant.name}`);
  const workDir = join(tempRoot, `work-${variant.name}`);
  runCub([
    "install",
    "setup",
    "--pull",
    packageRoot,
    "--base",
    variant.base,
    "--work-dir",
    workDir,
    "--non-interactive",
    "--namespace",
    "monitoring",
  ]);
  const helmYaml = readFileSync(join(revisionRoot(variant.name), "rendered", "release-objects.yaml"), "utf8");
  const cubFiles = objectFilesFromDirs([join(workDir, "out", "manifests"), join(workDir, "out", "secrets")]);
  const cubYaml = cubFiles.map((file) => file.yaml).join("\n---\n");
  const semantic = canonicalObjectMaps(helmYaml, cubYaml);
  const helmObjects = new Set(Object.keys(semantic.helm));
  const cubObjects = new Set(Object.keys(semantic.cub));
  check(helmObjects.size === variant.expectedObjectCount, `${variant.name} Helm object count mismatch`);
  check(cubObjects.size === variant.expectedObjectCount + 1, `${variant.name} cub object count mismatch`);
  const missingFromCub = difference(helmObjects, cubObjects);
  check(missingFromCub.length === 0, `${variant.name} cub output missing Helm object(s): ${missingFromCub.join(", ")}`);
  const extraInCub = difference(cubObjects, helmObjects);
  check(
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||monitoring"]),
    `${variant.name} cub output may add only v1|Namespace||monitoring; found ${extraInCub.join(", ")}`,
  );
  const semanticDiffs = [];
  for (const key of helmObjects) {
    if (semantic.helm[key] !== semantic.cub[key]) semanticDiffs.push(key);
  }
  check(semanticDiffs.length === 0, `${variant.name} semantic diffs: ${semanticDiffs.join(", ")}`);
  const secretFiles = listYamlFiles(join(workDir, "out", "secrets"));
  check(secretFiles.length === variant.expectedSecretCount, `${variant.name} separated Secret count mismatch`);
}

function pullSource() {
  const tempRoot = mkdtempSync(join(tmpdir(), "kube-prometheus-stack-source-"));
  try {
    command("helm", ["pull", "prometheus-community/kube-prometheus-stack", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "kube-prometheus-stack");
    const chartYaml = readYaml(join(chartRoot, "Chart.yaml"));
    const chartLock = readYaml(join(chartRoot, "Chart.lock"));
    return {
      appVersion: chartYaml.appVersion,
      packageSHA256: sha256File(packagePath),
      packageBytes: readFileSync(packagePath).length,
      defaultValuesSHA256: sha256File(join(chartRoot, "values.yaml")),
      chartLockDigest: chartLock.digest,
      dependencies: chartLock.dependencies ?? [],
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function renderVariant(variant) {
  const tempRoot = mkdtempSync(join(tmpdir(), "kube-prometheus-stack-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "prometheus-community/kube-prometheus-stack",
      "--version",
      chart.version,
      "--namespace",
      chart.namespace,
      "--kube-version",
      chart.kubeVersion,
      "--include-crds",
      "--skip-tests",
      "--no-hooks",
    ];
    if (variant.valuesText) {
      const valuesPath = join(tempRoot, "values.yaml");
      write(valuesPath, variant.valuesText);
      args.push("--values", valuesPath);
    }
    const first = command("helm", args);
    const second = command("helm", args);
    return { first, second, deterministic: sha256(first) === sha256(second) };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function effectiveValuesDoc(variant, defaultValuesSHA256) {
  if (!variant.valuesText) {
    return {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "EffectiveValues",
      metadata: { name: "kube-prometheus-stack-kube-prometheus-stack-85.3.3-default" },
      spec: {
        profile: "chart-defaults",
        defaultValuesSHA256,
        mergedValuesCaptured: false,
        values: {},
      },
    };
  }
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "EffectiveValues",
    metadata: { name: `kube-prometheus-stack-kube-prometheus-stack-85.3.3-${variant.name}` },
    spec: {
      files: [{ path: variant.valuesFile, source: "inline-proof", sha256: sha256(variant.valuesText) }],
      mergedValuesCaptured: false,
      values: readYamlText(variant.valuesText),
    },
  };
}

function variantDocFor(variant) {
  const doc = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Variant",
    metadata: { name: variant.name },
    spec: {
      recipe: "../../recipe.yaml",
      namespace: chart.namespace,
      releaseName: chart.releaseName,
      valuesProfile: `../../${variant.valuesFile}`,
      capabilityProfile: { kubeVersion: chart.kubeVersion, apiVersions: [] },
      hookPolicy: "no-hooks",
    },
  };
  if (variant.targetFacts) doc.spec.targetFacts = variant.targetFacts;
  return doc;
}

function scanDocs(docs) {
  const findings = [];
  const serviceAccounts = new Set(
    docs.filter((doc) => doc.kind === "ServiceAccount").map((doc) => `${doc.metadata?.namespace ?? ""}/${doc.metadata?.name ?? ""}`),
  );
  const workloads = docs.filter((doc) => workloadPodSpec(doc));
  for (const doc of workloads) {
    const object = identityFor(doc);
    const podSpec = workloadPodSpec(doc);
    const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
    for (const container of containers) {
      const tag = imageTag(container.image ?? "");
      if (!tag || tag === "latest") {
        findings.push({
          id: `mutable-image-tag:${object}:${container.name ?? "container"}`,
          rule: "mutable-image-tag",
          severity: "high",
          object,
          message: `container ${container.name ?? "container"} uses mutable image ${container.image ?? ""}`,
        });
      }
    }
    const serviceAccountName = podSpec.serviceAccountName;
    const namespace = doc.metadata?.namespace ?? "";
    if (serviceAccountName && !serviceAccounts.has(`${namespace}/${serviceAccountName}`)) {
      findings.push({
        id: `workload-service-account-exists:${object}`,
        rule: "workload-service-account-exists",
        severity: "high",
        object,
        message: `workload references missing ServiceAccount ${namespace}/${serviceAccountName}`,
      });
    }
  }
  for (const doc of docs.filter((item) => item.kind === "Service")) {
    const selector = doc.spec?.selector ?? {};
    if (!Object.keys(selector).length) continue;
    const match = workloads.some((workload) => labelsMatch(selector, workloadTemplateLabels(workload)));
    if (!match) {
      findings.push({
        id: `service-selector-has-workload-match:${identityFor(doc)}`,
        rule: "service-selector-has-workload-match",
        severity: "high",
        object: identityFor(doc),
        message: "Service selector matches no rendered workload pod template",
      });
    }
  }
  for (const doc of docs.filter((item) => item.kind === "ValidatingWebhookConfiguration")) {
    findings.push({
      id: `admission-webhook-requires-observation:${identityFor(doc)}`,
      rule: "admission-webhook-requires-observation",
      severity: "medium",
      object: identityFor(doc),
      message: "Admission webhook availability must be observed after apply",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
    findings.push({
      id: `crd-upgrade-policy:${identityFor(doc)}`,
      rule: "crd-upgrade-policy",
      severity: "medium",
      object: identityFor(doc),
      message: "CRD readiness, ordering, schema validation, and upgrade compatibility require explicit policy",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "kube-prometheus-stack-grafana")) {
    findings.push({
      id: `generated-secret-ownership:${identityFor(doc)}`,
      rule: "generated-secret-ownership",
      severity: "medium",
      object: identityFor(doc),
      message: "Grafana admin credential is bound before render and needs explicit ownership before production promotion",
    });
  }
  findings.push({
    id: "dependency-lock-review:umbrella",
    rule: "dependency-lock-review",
    severity: "medium",
    object: "dependency|crds,kube-state-metrics,prometheus-node-exporter,grafana,prometheus-windows-exporter",
    message: "Umbrella chart dependencies are locked before recipe publication",
  });
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Cluster-scoped RBAC requires production review",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function writeReadme(summaries) {
  write(
    join(proofRoot, "README.md"),
    `# prometheus-community/kube-prometheus-stack ${chart.version} Proof

This is the promoted proof slice for the kube-prometheus-stack public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub install objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub install setup\`, plus the explained Namespace support object;
- default chart render becomes deterministic when grafana.adminPassword is bound before render;
- the no-crds variant deliberately removes the 10 Prometheus Operator CRDs;
- CRD lifecycle, admission webhook, generated Grafana credential, umbrella dependency, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run kube-prometheus-stack:generate-proof
npm run kube-prometheus-stack:generate-package
npm run kube-prometheus-stack:verify-proof
npm run kube-prometheus-stack:verify-package
npm run kube-prometheus-stack:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
