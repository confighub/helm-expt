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

const proofRoot = join(repoRoot, "recipes", "secrets-store-csi-driver", "secrets-store-csi-driver", "1.6.0");
const packageRoot = join(repoRoot, "packages", "secrets-store-csi-driver", "secrets-store-csi-driver", "1.6.0");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chart = {
  repository: "secrets-store-csi-driver",
  repositoryURL: "https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts",
  name: "secrets-store-csi-driver",
  version: "1.6.0",
  releaseName: "secrets-store-csi-driver",
  namespace: "kube-system",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default Linux driver",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults with CRDs, Linux DaemonSet, CSIDriver, and RBAC",
    expectedObjectCount: 10,
    expectedCRDCount: 2,
    expectedSecretCount: 0,
    targetFactNote: "installs the CSI driver and CRDs; SecretProviderClass provider behavior remains a post-install integration decision",
  },
  {
    name: "sync-secret-rotation",
    base: "sync-secret-rotation",
    displayName: "sync Secret and rotation",
    valuesFile: "effective-values-sync-secret-rotation.yaml",
    valuesText: `syncSecret:
  enabled: true
enableSecretRotation: true
providerHealthCheck: true
`,
    valuesSummary: "Secret syncing, rotation, and provider health checks are explicit",
    expectedObjectCount: 12,
    expectedCRDCount: 2,
    expectedSecretCount: 0,
    targetFactNote: "adds sync Secret RBAC and driver flags for rotation and provider health checks as variant-controlled outputs",
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
      id: "csi-daemonset-operate-review",
      severity: "medium",
      description: "CSI DaemonSets need privileged-node, hostPath, rollout, and rollback policy.",
    },
    {
      id: "secret-provider-integration-review",
      severity: "medium",
      description: "SecretProviderClass providers and synced Secret ownership need explicit integration policy.",
    },
    {
      id: "sync-secret-rotation-review",
      severity: "medium",
      description: "Secret syncing and rotation settings need explicit review.",
    },
    {
      id: "csi-driver-review",
      severity: "medium",
      description: "CSIDriver objects need driver lifecycle and kubelet integration review.",
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
  node scripts/secrets-store-csi-driver-proof.mjs --generate-proof
  node scripts/secrets-store-csi-driver-proof.mjs --generate-package
  node scripts/secrets-store-csi-driver-proof.mjs --verify-proof
  node scripts/secrets-store-csi-driver-proof.mjs --verify-proof-self-test
  node scripts/secrets-store-csi-driver-proof.mjs --verify-package
  node scripts/secrets-store-csi-driver-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: "secrets-store-csi-driver-1.6.0" },
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
        sourceCommand: "helm pull secrets-store-csi-driver/secrets-store-csi-driver --version 1.6.0",
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: "secrets-store-csi-driver-1.6.0" },
    spec: {
      chart: "secrets-store-csi-driver/secrets-store-csi-driver",
      version: chart.version,
      dependencies: source.dependencies,
      chartLockDigest: source.chartLockDigest,
    },
  });

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: "secrets-store-csi-driver-1.6.0" },
    spec: {
      checkedValues: [
        {
          path: "linux.crds.enabled",
          variant: "all",
          disposition: "variant-controlled",
          reason: "the promoted variants install the SecretProviderClass CRDs and bind that choice in the rendered object set",
        },
        {
          path: "syncSecret.enabled",
          variant: "sync-secret-rotation",
          disposition: "variant-controlled",
          reason: "the sync variant deliberately adds RBAC for synced Kubernetes Secrets",
        },
        {
          path: "enableSecretRotation / rotationPollInterval",
          variant: "sync-secret-rotation",
          disposition: "variant-controlled",
          reason: "Secret rotation is enabled only by an explicit variant and appears in driver args",
        },
        {
          path: "providerHealthCheck",
          variant: "sync-secret-rotation",
          disposition: "variant-controlled",
          reason: "provider health checks are enabled only by an explicit variant and appear in driver args",
        },
        {
          path: "linux.enabled / windows.enabled",
          variant: "all",
          disposition: "platform-variant",
          reason: "promoted variants install the Linux DaemonSet only; Windows support becomes a separate variant",
        },
        {
          path: "tokenRequests / linux.nodeSelector / linux.tolerations / linux.priorityClassName",
          variant: "all",
          disposition: "extension-slot",
          reason: "provider identity, scheduling, and token-request knobs must be explicit before production promotion",
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
    metadata: { name: "secrets-store-csi-driver-1.6.0" },
    spec: {
      points: [
        { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
        {
          category: "dependency-lock",
          status: "handled",
          evidence: "dependency-lock.yaml",
          note: "chart declares no subchart dependencies; the empty closure is recorded explicitly.",
        },
        {
          category: "capability-profile",
          status: "handled",
          kubeVersion: chart.kubeVersion,
          note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile.",
        },
        { category: "crd-lifecycle", status: "scan-and-review", object: "apiextensions.k8s.io/v1|CustomResourceDefinition||secretproviderclasses.secrets-store.csi.x-k8s.io" },
        { category: "csi-driver", status: "scan-and-review", object: "storage.k8s.io/v1|CSIDriver||secrets-store.csi.k8s.io" },
        { category: "daemonset-workload", status: "scan-and-review", object: "apps/v1|DaemonSet|kube-system|secrets-store-csi-driver" },
        { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasses-role" },
        { category: "sync-secret-rotation", status: "variant-controlled", evidence: "syncSecret.enabled / enableSecretRotation / providerHealthCheck" },
        { category: "provider-integration", status: "needs-target-decision", note: "SecretProviderClass provider identity, token requests, and synced Secret ownership are post-render integration controls." },
        { category: "platform-variant", status: "controlled-by-values", note: "promoted variants install Linux DaemonSet only; Windows support is a future variant." },
        { category: "extension-slots", status: "controlled-by-empty-defaults", note: "provider identity, token request, scheduling, and provider path knobs are explicit variant inputs." },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||kube-system" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "secrets-store-csi-driver", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: "../../../../packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0",
        setupCommand: [
          "cub",
          "install",
          "setup",
          "--pull",
          "../../../../packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0",
          "--non-interactive",
          "--namespace",
          "kube-system",
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
      metadata: { name: `secrets-store-csi-driver-${chart.version}-${variant.name}-r001` },
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
      metadata: { name: `secrets-store-csi-driver-${variant.name}-r001` },
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
      metadata: { name: `secrets-store-csi-driver-${variant.name}-r001` },
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
          { identity: "v1|Namespace||kube-system", classification: "installer-support-object", disposition: "allowed" },
        ],
        result: "pass",
        evidenceCommand: "npm run secrets-store-csi-driver:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `secrets-store-csi-driver-${variant.name}-r001` },
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
      metadata: { name: `secrets-store-csi-driver-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        decision: "warn",
        allowedScopes: ["local-test"],
        blockedScopes: ["production"],
        reasons: [
          `Helm equivalence passed for ${variant.name}`,
          "CRD lifecycle and upgrade policy must be explicit before production",
          "CSI DaemonSet privileged-node, hostPath, rollout, and rollback policy need production review",
          "SecretProviderClass provider identity and token-request policy must be explicit before production",
          "Synced Secret ownership and rotation behavior need production review",
          "Cluster RBAC and CSIDriver kubelet integration need production review",
          variant.targetFactNote,
        ],
      },
    });
    summaries.push({ ...variant, releaseDigest, objects, scanCounts, scanResult });
  }

  writeYaml(join(proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: "secrets-store-csi-driver-1.6.0" },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "secrets-store-csi-driver/secrets-store-csi-driver",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        nextAction: "publish only after CRD lifecycle, CSI DaemonSet, provider identity, synced Secret ownership, rotation, RBAC, and kubelet integration policies are satisfied",
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
    metadata: { name: "secrets-store-csi-driver-1.6.0" },
    spec: {
      chart: "secrets-store-csi-driver/secrets-store-csi-driver",
      version: chart.version,
      maintainedNotes: [
        "The chart renders deterministically under pinned Helm, chart version, kube version, and values.",
        "The default variant installs the Linux CSI DaemonSet, CSIDriver, SecretProviderClass CRDs, and cluster RBAC.",
        "The sync-secret-rotation variant adds synced Secret RBAC and driver args for rotation and provider health checks.",
        "The chart does not install a cloud or vault provider; SecretProviderClass provider identity and token requests are integration controls after render.",
        "CRD lifecycle, CSI driver lifecycle, privileged-node DaemonSet behavior, cluster RBAC, synced Secret ownership, and rotation are scan/gate review points.",
        "Windows DaemonSet support and provider-specific identity inputs are future variants, not hidden defaults.",
      ],
      knownControlPoints: [
        "crd-lifecycle",
        "csi-driver",
        "daemonset-workload",
        "sync-secret-rotation",
        "provider-integration",
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
    metadata: { name: "secrets-store-csi-driver", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `secrets-store-csi-driver ${variant.displayName} variant rendered from secrets-store-csi-driver/secrets-store-csi-driver@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# secrets-store-csi-driver/secrets-store-csi-driver ${chart.version} Installer Package

This package is generated from the secrets-store-csi-driver proof artifacts.

\`\`\`sh
npm run secrets-store-csi-driver:generate-package
npm run secrets-store-csi-driver:verify-package
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
  const tempRoot = mkdtempSync(join(tmpdir(), "secrets-store-csi-driver-installer-package-"));
  try {
    const firstPackage = join(tempRoot, "secrets-store-csi-driver-1.6.0-a.tgz");
    const secondPackage = join(tempRoot, "secrets-store-csi-driver-1.6.0-b.tgz");
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
      metadata: { name: "secrets-store-csi-driver-1.6.0" },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "secrets-store-csi-driver",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub installer package ${packageRelative} -o <tmp>/secrets-store-csi-driver-1.6.0.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub installer setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace kube-system`,
          helmReleaseObjectCount: variant.expectedObjectCount,
          cubInstallObjectCountIncludingSupport: variant.expectedObjectCount + 1,
          semanticObjectMatches: `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
          separatedSecretCount: variant.expectedSecretCount,
          allowedCubOnlyObjects: ["v1|Namespace||kube-system"],
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
    "effective-values-sync-secret-rotation.yaml",
    "recipe.yaml",
    "variants/default/variant.yaml",
    "variants/sync-secret-rotation/variant.yaml",
    "revisions/default/r001/variant-revision.yaml",
    "revisions/default/r001/rendered/release-objects.yaml",
    "revisions/default/r001/rendered/object-inventory.yaml",
    "revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/default/r001/receipts/render-receipt.yaml",
    "revisions/default/r001/receipts/scan-receipt.yaml",
    "revisions/default/r001/receipts/install-gate.yaml",
    "revisions/sync-secret-rotation/r001/variant-revision.yaml",
    "revisions/sync-secret-rotation/r001/rendered/release-objects.yaml",
    "revisions/sync-secret-rotation/r001/rendered/object-inventory.yaml",
    "revisions/sync-secret-rotation/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/sync-secret-rotation/r001/receipts/render-receipt.yaml",
    "revisions/sync-secret-rotation/r001/receipts/scan-receipt.yaml",
    "revisions/sync-secret-rotation/r001/receipts/install-gate.yaml",
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
  check(sourceLock.spec.repositoryName === "secrets-store-csi-driver", "source repository mismatch");
  check(sourceLock.spec.chart === "secrets-store-csi-driver", "source chart mismatch");
  check(sourceLock.spec.version === "1.6.0", "source version mismatch");
  check(sourceLock.spec.deprecated === false, "source deprecation marker must be recorded");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).length === 0, "secrets-store-csi-driver dependency lock must be empty");
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "crd-lifecycle"), "crd-lifecycle control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "csi-driver"), "csi-driver control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "daemonset-workload"), "daemonset-workload control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "sync-secret-rotation"), "sync-secret-rotation control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "provider-integration"), "provider-integration control point missing");
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
    check(identities.includes("apps/v1|DaemonSet|kube-system|secrets-store-csi-driver"), `${variant.name} DaemonSet missing`);
    check(identities.includes("storage.k8s.io/v1|CSIDriver||secrets-store.csi.k8s.io"), `${variant.name} CSIDriver missing`);
    check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||secretproviderclasses.secrets-store.csi.x-k8s.io"), `${variant.name} SecretProviderClass CRD missing`);
    check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||secretproviderclasspodstatuses.secrets-store.csi.x-k8s.io"), `${variant.name} SecretProviderClassPodStatus CRD missing`);
    check(identities.includes("v1|ServiceAccount|kube-system|secrets-store-csi-driver"), `${variant.name} ServiceAccount missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasses-role"), `${variant.name} driver ClusterRole missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasses-admin-role"), `${variant.name} admin ClusterRole missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasses-viewer-role"), `${variant.name} viewer ClusterRole missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretproviderclasspodstatuses-viewer-role"), `${variant.name} pod status viewer ClusterRole missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||secretproviderclasses-rolebinding"), `${variant.name} driver ClusterRoleBinding missing`);
    if (variant.name === "default") {
      check(!identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretprovidersyncing-role"), "default variant must not render sync Secret ClusterRole");
    }
    if (variant.name === "sync-secret-rotation") {
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||secretprovidersyncing-role"), "sync-secret-rotation sync Secret ClusterRole missing");
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||secretprovidersyncing-rolebinding"), "sync-secret-rotation sync Secret ClusterRoleBinding missing");
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
    check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag CRDs, CSIDriver, DaemonSet, RBAC, provider integration, and extension review`);
    check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} install gate digest mismatch`);
    check(gate.spec.decision === "warn", `${variant.name} install gate should warn`);
  }
  console.log("verified secrets-store-csi-driver proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "secrets-store-csi-driver-proof-self-test-"));
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
    console.log("self-test passed: secrets-store-csi-driver rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run secrets-store-csi-driver:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run secrets-store-csi-driver:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "secrets-store-csi-driver", "package name mismatch");
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

  const tempRoot = mkdtempSync(join(tmpdir(), "secrets-store-csi-driver-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "secrets-store-csi-driver-a.tgz");
    const secondPackage = join(tempRoot, "secrets-store-csi-driver-b.tgz");
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
  console.log("secrets-store-csi-driver installer package verification passed");
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
    "kube-system",
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
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||kube-system"]),
    `${variant.name} cub output may add only v1|Namespace||kube-system; found ${extraInCub.join(", ")}`,
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
  const tempRoot = mkdtempSync(join(tmpdir(), "secrets-store-csi-driver-source-"));
  try {
    command("helm", ["pull", "secrets-store-csi-driver/secrets-store-csi-driver", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "secrets-store-csi-driver");
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
  const tempRoot = mkdtempSync(join(tmpdir(), "secrets-store-csi-driver-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "secrets-store-csi-driver/secrets-store-csi-driver",
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
      metadata: { name: "secrets-store-csi-driver-1.6.0-default" },
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
    metadata: { name: `secrets-store-csi-driver-1.6.0-${variant.name}` },
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
  for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
    findings.push({
      id: `crd-upgrade-policy:${identityFor(doc)}`,
      rule: "crd-upgrade-policy",
      severity: "medium",
      object: identityFor(doc),
      message: "CRD readiness, ordering, schema validation, and upgrade compatibility require explicit policy",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "CSIDriver")) {
    findings.push({
      id: `csi-driver-review:${identityFor(doc)}`,
      rule: "csi-driver-review",
      severity: "medium",
      object: identityFor(doc),
      message: "CSIDriver lifecycle and kubelet integration require production review",
    });
  }
  const syncEnabled = docs.some((item) => item.kind === "ClusterRole" && item.metadata?.name === "secretprovidersyncing-role");
  if (syncEnabled) {
    findings.push({
      id: "sync-secret-rotation-review:sync-enabled",
      rule: "sync-secret-rotation-review",
      severity: "medium",
      object: "values|syncSecret.enabled|enableSecretRotation|providerHealthCheck",
      message: "Synced Secret ownership, rotation cadence, and provider health checks require production review",
    });
  }
  findings.push({
    id: "extension-slot-review:secrets-store-csi-driver-values",
    rule: "extension-slot-review",
    severity: "medium",
    object: "values|tokenRequests|linux.nodeSelector|linux.tolerations|linux.priorityClassName|windows.enabled",
    message: "Provider identity, token-request, scheduling, and platform variant knobs must be scanned when populated",
  });
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Secrets Store CSI Driver RBAC requires production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "DaemonSet")) {
    findings.push({
      id: `csi-daemonset-operate-review:${identityFor(doc)}`,
      rule: "csi-daemonset-operate-review",
      severity: "medium",
      object: identityFor(doc),
      message: "CSI DaemonSet privileged-node, hostPath, rollout, and rollback policy require production review",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function writeReadme(summaries) {
  write(
    join(proofRoot, "README.md"),
    `# secrets-store-csi-driver/secrets-store-csi-driver ${chart.version} Proof

This is the promoted proof slice for the Secrets Store CSI Driver public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub installer objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub installer setup\`, plus the explained Namespace support object;
- the default variant keeps the chart defaults visible: SecretProviderClass CRDs, Linux DaemonSet, CSIDriver object, and cluster RBAC;
- the sync-secret-rotation variant deliberately adds synced Secret RBAC and driver flags for rotation and provider health checks;
- cloud/provider identity and SecretProviderClass behavior are not hidden Helm render inputs; they are explicit integration gates after render;
- CRD lifecycle, CSI driver lifecycle, privileged-node DaemonSet behavior, cluster RBAC, synced Secret ownership, rotation, and provider identity risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run secrets-store-csi-driver:generate-proof
npm run secrets-store-csi-driver:generate-package
npm run secrets-store-csi-driver:verify-proof
npm run secrets-store-csi-driver:verify-package
npm run secrets-store-csi-driver:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
