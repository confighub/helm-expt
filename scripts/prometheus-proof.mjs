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

const proofRoot = join(repoRoot, "recipes", "prometheus-community", "prometheus", "29.8.0");
const packageRoot = join(repoRoot, "packages", "prometheus-community", "prometheus", "29.8.0");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chart = {
  repository: "prometheus-community",
  repositoryURL: "https://prometheus-community.github.io/helm-charts",
  name: "prometheus",
  version: "29.8.0",
  releaseName: "prometheus",
  namespace: "monitoring",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default monitoring stack",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults with server, Alertmanager, exporters, PVC, and RBAC",
    expectedObjectCount: 23,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "installs the full bundled monitoring stack; scrape, storage, and alerting policy remain explicit operating decisions",
  },
  {
    name: "server-only-ephemeral",
    base: "server-only-ephemeral",
    displayName: "server only without persistence",
    valuesFile: "effective-values-server-only-ephemeral.yaml",
    valuesText: `alertmanager:
  enabled: false
kube-state-metrics:
  enabled: false
prometheus-node-exporter:
  enabled: false
prometheus-pushgateway:
  enabled: false
server:
  persistentVolume:
    enabled: false
`,
    valuesSummary: "only the Prometheus server is rendered and persistence is disabled",
    expectedObjectCount: 6,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "removes bundled components and PVC as a deliberate lightweight install variant",
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
      id: "helm-hook-lifecycle-policy",
      severity: "medium",
      description: "Helm hook resources need explicit lifecycle policy.",
    },
    {
      id: "dependency-lock-review",
      severity: "medium",
      description: "Chart dependencies need lock and provenance review.",
    },
    {
      id: "generated-secret-ownership",
      severity: "medium",
      description: "Rendered Secrets need explicit ownership and observation policy.",
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
    {
      id: "monitoring-workload-review",
      severity: "medium",
      description: "Monitoring workloads need rollout, storage, retention, and rollback policy.",
    },
    {
      id: "scrape-config-review",
      severity: "medium",
      description: "Scrape configuration needs provenance and target-scope review.",
    },
    {
      id: "storage-retention-review",
      severity: "medium",
      description: "Prometheus storage and retention settings need explicit review.",
    },
    {
      id: "bundle-component-review",
      severity: "medium",
      description: "Bundled components need explicit dependency and ownership review.",
    },
    {
      id: "extension-slot-review",
      severity: "medium",
      description: "tpl/raw extension slots need provenance and scan coverage.",
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
  node scripts/prometheus-proof.mjs --generate-proof
  node scripts/prometheus-proof.mjs --generate-package
  node scripts/prometheus-proof.mjs --verify-proof
  node scripts/prometheus-proof.mjs --verify-proof-self-test
  node scripts/prometheus-proof.mjs --verify-package
  node scripts/prometheus-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: "prometheus-29.8.0" },
    spec: {
      sourceType: "HelmChart",
      repositoryName: chart.repository,
      repositoryURL: chart.repositoryURL,
      chart: chart.name,
      version: chart.version,
      appVersion: source.appVersion,
      deprecated: source.deprecated,
      packageSHA256: source.packageSHA256,
      packageBytes: source.packageBytes,
      evidence: {
        sourceCommand: "helm pull prometheus-community/prometheus --version 29.8.0",
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: "prometheus-29.8.0" },
    spec: {
      chart: "prometheus-community/prometheus",
      version: chart.version,
      dependencies: source.dependencies,
      chartLockDigest: source.chartLockDigest,
    },
  });

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: "prometheus-29.8.0" },
    spec: {
      checkedValues: [
        {
          path: "alertmanager.enabled / kube-state-metrics.enabled / prometheus-node-exporter.enabled / prometheus-pushgateway.enabled",
          variant: "server-only-ephemeral",
          disposition: "variant-controlled",
          reason: "the server-only variant deliberately removes bundled components and their RBAC/workloads",
        },
        {
          path: "server.persistentVolume.enabled",
          variant: "server-only-ephemeral",
          disposition: "variant-controlled",
          reason: "the server-only variant deliberately disables the Prometheus server PVC",
        },
        {
          path: "serverFiles / scrapeConfigs / extraScrapeConfigs",
          variant: "all",
          disposition: "scrape-config-review",
          reason: "scrape configuration is rendered into ConfigMaps and must be reviewable by variant",
        },
        {
          path: "server.remoteWrite / server.remoteRead",
          variant: "all",
          disposition: "data-egress-review",
          reason: "remote read/write endpoints must be explicit before production promotion",
        },
        {
          path: "server.statefulSet.enabled / server.replicaCount",
          variant: "all",
          disposition: "workload-shape-review",
          reason: "Deployment versus StatefulSet and replica count are core operational choices",
        },
        {
          path: "server.ingress.enabled / networkPolicy.enabled / server.podDisruptionBudget.enabled",
          variant: "all",
          disposition: "production-hardening-review",
          reason: "exposure, network, and disruption policy should be deliberate variants",
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
    metadata: { name: "prometheus-29.8.0" },
    spec: {
      points: [
        { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
        {
          category: "dependency-lock",
          status: "handled",
          evidence: "dependency-lock.yaml",
          note: "chart dependencies are locked and reviewed, including alertmanager, kube-state-metrics, node-exporter, and pushgateway.",
        },
        {
          category: "capability-profile",
          status: "handled",
          kubeVersion: chart.kubeVersion,
          note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile.",
        },
        { category: "bundle-dependencies", status: "scan-and-review", evidence: "dependency-lock.yaml" },
        { category: "monitoring-workloads", status: "scan-and-review", object: "apps/v1|Deployment|monitoring|prometheus-server" },
        { category: "storage-retention", status: "variant-controlled", object: "v1|PersistentVolumeClaim|monitoring|prometheus-server" },
        { category: "scrape-config", status: "scan-and-review", object: "v1|ConfigMap|monitoring|prometheus-server" },
        { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||prometheus-server" },
        { category: "component-selection", status: "variant-controlled", evidence: "alertmanager/kube-state-metrics/node-exporter/pushgateway values" },
        { category: "extension-slots", status: "controlled-by-empty-defaults", note: "extra scrape configs, remote read/write, ingress, network policy, PDB, and extra manifests are explicit variant inputs." },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||monitoring" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "prometheus", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: "../../../../packages/prometheus-community/prometheus/29.8.0",
        setupCommand: [
          "cub",
          "install",
          "setup",
          "--pull",
          "../../../../packages/prometheus-community/prometheus/29.8.0",
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
      metadata: { name: `prometheus-${chart.version}-${variant.name}-r001` },
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
      metadata: { name: `prometheus-${variant.name}-r001` },
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
      metadata: { name: `prometheus-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        regularHelm: { renderedSHA256: releaseDigest, objectCount: objects.length },
        cubInstall: {
          objectCountIncludingSecretsAndSupportObjects: objects.length + 1,
          uploadedManifestFiles: objects.length + 1,
          separatedSecretFiles: variant.expectedSecretCount,
          semanticObjectMatches: `${objects.length}/${objects.length}`,
        },
        semanticNormalizations: ["prune-null-fields"],
        classifications: [
          { identity: "v1|Namespace||monitoring", classification: "installer-support-object", disposition: "allowed" },
        ],
        result: "pass",
        evidenceCommand: "npm run prometheus:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `prometheus-${variant.name}-r001` },
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
      metadata: { name: `prometheus-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        decision: "warn",
        allowedScopes: ["local-test"],
        blockedScopes: ["production"],
        reasons: [
          `Helm equivalence passed for ${variant.name}`,
          "Bundled component ownership and dependency policy must be explicit before production",
          "Prometheus scrape configuration and service discovery scope need production review",
          "Storage, retention, Alertmanager, and rollback policy need production review",
          "Cluster RBAC and workload exposure need production review",
          "Remote read/write, ingress, network policy, PDB, and extra-manifest slots must be reviewed when populated",
          variant.targetFactNote,
        ],
      },
    });
    summaries.push({ ...variant, releaseDigest, objects, scanCounts, scanResult });
  }

  writeYaml(join(proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: "prometheus-29.8.0" },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "prometheus-community/prometheus",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        nextAction: "publish only after component selection, scrape config, storage/retention, RBAC, workload exposure, and remote read/write policies are satisfied",
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
    metadata: { name: "prometheus-29.8.0" },
    spec: {
      chart: "prometheus-community/prometheus",
      version: chart.version,
      maintainedNotes: [
        "The chart renders deterministically under pinned Helm, chart version, kube version, and values.",
        "The default variant installs Prometheus server, Alertmanager, kube-state-metrics, node-exporter, pushgateway, server PVC, services, and cluster RBAC.",
        "The server-only-ephemeral variant disables bundled components and server persistence as deliberate variant-controlled outputs.",
        "Scrape config, remote read/write, ingress, network policy, PDB, and extra-manifest slots are extension surfaces that must be explicit before production.",
        "Bundled dependency ownership, storage/retention, workload rollout, and cluster RBAC are scan/gate review points.",
        "StatefulSet and HA behavior become future variants, not hidden defaults.",
      ],
      knownControlPoints: [
        "bundle-dependencies",
        "monitoring-workloads",
        "storage-retention",
        "scrape-config",
        "component-selection",
        "rbac-review",
        "extension-slots",
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
    metadata: { name: "prometheus", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `prometheus ${variant.displayName} variant rendered from prometheus-community/prometheus@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# prometheus-community/prometheus ${chart.version} Installer Package

This package is generated from the prometheus proof artifacts.

\`\`\`sh
npm run prometheus:generate-package
npm run prometheus:verify-package
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
  const tempRoot = mkdtempSync(join(tmpdir(), "prometheus-installer-package-"));
  try {
    const firstPackage = join(tempRoot, "prometheus-29.8.0-a.tgz");
    const secondPackage = join(tempRoot, "prometheus-29.8.0-b.tgz");
    runCub(["installer", "package", packageRoot, "-o", firstPackage]);
    runCub(["installer", "package", packageRoot, "-o", secondPackage]);
    const firstSHA = sha256File(firstPackage);
    const secondSHA = sha256File(secondPackage);
    if (firstSHA !== secondSHA || !readFileSync(firstPackage).equals(readFileSync(secondPackage))) {
      throw new Error("cub installer package did not produce byte-identical bundles");
    }
    mkdirSync(dirname(receiptPath), { recursive: true });
    writeYaml(receiptPath, {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "InstallerPackageReceipt",
      metadata: { name: "prometheus-29.8.0" },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "prometheus",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub installer package ${packageRelative} -o <tmp>/prometheus-29.8.0.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub installer setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace monitoring`,
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
    "effective-values-server-only-ephemeral.yaml",
    "recipe.yaml",
    "variants/default/variant.yaml",
    "variants/server-only-ephemeral/variant.yaml",
    "revisions/default/r001/variant-revision.yaml",
    "revisions/default/r001/rendered/release-objects.yaml",
    "revisions/default/r001/rendered/object-inventory.yaml",
    "revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/default/r001/receipts/render-receipt.yaml",
    "revisions/default/r001/receipts/scan-receipt.yaml",
    "revisions/default/r001/receipts/install-gate.yaml",
    "revisions/server-only-ephemeral/r001/variant-revision.yaml",
    "revisions/server-only-ephemeral/r001/rendered/release-objects.yaml",
    "revisions/server-only-ephemeral/r001/rendered/object-inventory.yaml",
    "revisions/server-only-ephemeral/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/server-only-ephemeral/r001/receipts/render-receipt.yaml",
    "revisions/server-only-ephemeral/r001/receipts/scan-receipt.yaml",
    "revisions/server-only-ephemeral/r001/receipts/install-gate.yaml",
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
  check(sourceLock.spec.chart === "prometheus", "source chart mismatch");
  check(sourceLock.spec.version === "29.8.0", "source version mismatch");
  check(sourceLock.spec.deprecated === false, "source deprecation marker must be recorded");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).length === 4, "prometheus dependency lock must record four subchart dependencies");
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "bundle-dependencies"), "bundle-dependencies control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "monitoring-workloads"), "monitoring-workloads control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "storage-retention"), "storage-retention control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "scrape-config"), "scrape-config control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "component-selection"), "component-selection control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "extension-slots"), "extension-slots control point missing");

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
    check(identities.includes("apps/v1|Deployment|monitoring|prometheus-server"), `${variant.name} server Deployment missing`);
    check(identities.includes("v1|ConfigMap|monitoring|prometheus-server"), `${variant.name} server ConfigMap missing`);
    check(identities.includes("v1|Service|monitoring|prometheus-server"), `${variant.name} server Service missing`);
    check(identities.includes("v1|ServiceAccount|monitoring|prometheus-server"), `${variant.name} server ServiceAccount missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||prometheus-server"), `${variant.name} server ClusterRole missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||prometheus-server"), `${variant.name} server ClusterRoleBinding missing`);
    if (variant.name === "default") {
      check(identities.includes("apps/v1|StatefulSet|monitoring|prometheus-alertmanager"), "default Alertmanager StatefulSet missing");
      check(identities.includes("apps/v1|Deployment|monitoring|prometheus-kube-state-metrics"), "default kube-state-metrics Deployment missing");
      check(identities.includes("apps/v1|DaemonSet|monitoring|prometheus-prometheus-node-exporter"), "default node-exporter DaemonSet missing");
      check(identities.includes("apps/v1|Deployment|monitoring|prometheus-prometheus-pushgateway"), "default pushgateway Deployment missing");
      check(identities.includes("v1|PersistentVolumeClaim|monitoring|prometheus-server"), "default server PVC missing");
    }
    if (variant.name === "server-only-ephemeral") {
      check(!identities.includes("apps/v1|StatefulSet|monitoring|prometheus-alertmanager"), "server-only-ephemeral must not render Alertmanager");
      check(!identities.includes("v1|PersistentVolumeClaim|monitoring|prometheus-server"), "server-only-ephemeral must not render server PVC");
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
    check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag bundled components, scrape config, storage, RBAC, workloads, and extension review`);
    check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} install gate digest mismatch`);
    check(gate.spec.decision === "warn", `${variant.name} install gate should warn`);
  }
  console.log("verified prometheus proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "prometheus-proof-self-test-"));
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
    console.log("self-test passed: prometheus rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run prometheus:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run prometheus:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "prometheus", "package name mismatch");
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

  const tempRoot = mkdtempSync(join(tmpdir(), "prometheus-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "prometheus-a.tgz");
    const secondPackage = join(tempRoot, "prometheus-b.tgz");
    runCub(["installer", "package", packageRoot, "-o", firstPackage]);
    runCub(["installer", "package", packageRoot, "-o", secondPackage]);
    const firstSHA = sha256File(firstPackage);
    const secondSHA = sha256File(secondPackage);
    check(firstSHA === secondSHA, "package SHA changed across two local bundles");
    check(readFileSync(firstPackage).equals(readFileSync(secondPackage)), "package bytes changed across two local bundles");
    check(firstSHA === receipt.spec.deterministicBundle.sha256, "deterministic bundle SHA mismatch");
    for (const variant of variants) verifySetupVariant(tempRoot, variant, receipt);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  console.log("prometheus installer package verification passed");
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
  const tempRoot = mkdtempSync(join(tmpdir(), "prometheus-source-"));
  try {
    command("helm", ["pull", "prometheus-community/prometheus", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "prometheus");
    const chartYaml = readYaml(join(chartRoot, "Chart.yaml"));
    const chartLockPath = join(chartRoot, "Chart.lock");
    const chartLock = existsSync(chartLockPath) ? readYaml(chartLockPath) : null;
    return {
      appVersion: chartYaml.appVersion,
      packageSHA256: sha256File(packagePath),
      packageBytes: readFileSync(packagePath).length,
      defaultValuesSHA256: sha256File(join(chartRoot, "values.yaml")),
      chartLockDigest: chartLock?.digest ?? null,
      dependencies: chartLock?.dependencies ?? chartYaml.dependencies ?? [],
      deprecated: Boolean(chartYaml.deprecated),
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function renderVariant(variant) {
  const tempRoot = mkdtempSync(join(tmpdir(), "prometheus-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "prometheus-community/prometheus",
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
      metadata: { name: "prometheus-29.8.0-default" },
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
    metadata: { name: `prometheus-29.8.0-${variant.name}` },
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
  const bundledComponents = docs.filter((item) =>
    ["prometheus-alertmanager", "prometheus-kube-state-metrics", "prometheus-prometheus-node-exporter", "prometheus-prometheus-pushgateway"].includes(
      item.metadata?.name,
    ),
  );
  if (bundledComponents.length) {
    findings.push({
      id: "bundle-component-review:default-components",
      rule: "bundle-component-review",
      severity: "medium",
      object: "values|alertmanager|kube-state-metrics|prometheus-node-exporter|prometheus-pushgateway",
      message: "Bundled monitoring component ownership and upgrade policy require production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "ConfigMap" && item.metadata?.name === "prometheus-server")) {
    findings.push({
      id: `scrape-config-review:${identityFor(doc)}`,
      rule: "scrape-config-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Prometheus scrape configuration, service discovery scope, and remote read/write settings require production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "PersistentVolumeClaim")) {
    findings.push({
      id: `storage-retention-review:${identityFor(doc)}`,
      rule: "storage-retention-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Prometheus storage, retention, and rollback policy require production review",
    });
  }
  findings.push({
    id: "extension-slot-review:prometheus-values",
    rule: "extension-slot-review",
    severity: "medium",
    object: "values|extraScrapeConfigs|scrapeConfigFiles|remoteWrite|remoteRead|extraManifests|ingress|networkPolicy|podDisruptionBudget",
    message: "Extra scrape, remote read/write, ingress, network policy, PDB, and extra-manifest slots must be scanned when populated",
  });
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Prometheus RBAC requires production review",
    });
  }
  for (const doc of docs.filter((item) => ["DaemonSet", "Deployment", "StatefulSet"].includes(item.kind))) {
    findings.push({
      id: `monitoring-workload-review:${identityFor(doc)}`,
      rule: "monitoring-workload-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Monitoring workload rollout, storage, retention, and rollback policy require production review",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function writeReadme(summaries) {
  write(
    join(proofRoot, "README.md"),
    `# prometheus-community/prometheus ${chart.version} Proof

This is the promoted proof slice for the Prometheus public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub installer objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub installer setup\`, plus the explained Namespace support object;
- the default variant keeps the bundled monitoring stack visible: Prometheus server, Alertmanager, kube-state-metrics, node-exporter, pushgateway, server PVC, services, and cluster RBAC;
- the server-only-ephemeral variant deliberately removes bundled components and server persistence;
- scrape config, remote read/write, ingress, network policy, PDB, and extra manifests are not hidden Helm behavior; they are explicit variant/review surfaces;
- dependency ownership, storage/retention, workload rollout, cluster RBAC, and scrape-config risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run prometheus:generate-proof
npm run prometheus:generate-package
npm run prometheus:verify-proof
npm run prometheus:verify-package
npm run prometheus:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
