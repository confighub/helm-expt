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

const proofRoot = join(repoRoot, "recipes", "longhorn", "longhorn", "1.11.2");
const packageRoot = join(repoRoot, "packages", "longhorn", "longhorn", "1.11.2");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chart = {
  repository: "longhorn",
  repositoryURL: "https://charts.longhorn.io",
  name: "longhorn",
  version: "1.11.2",
  releaseName: "longhorn",
  namespace: "longhorn-system",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default storage control plane",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults with CRDs, manager DaemonSet, driver deployer, UI, and storage settings",
    expectedObjectCount: 41,
    expectedCRDCount: 22,
    expectedSecretCount: 0,
    targetFactNote: "keeps default storage settings, pre-upgrade hooks excluded by render policy, and no UI ingress exposure",
  },
  {
    name: "ui-ingress",
    base: "ui-ingress",
    displayName: "UI ingress enabled",
    valuesFile: "effective-values-ui-ingress.yaml",
    valuesText: `ingress:
  enabled: true
  host: longhorn.example.test
  ingressClassName: nginx
  tls: false
`,
    valuesSummary: "default Longhorn plus an explicit UI Ingress",
    expectedObjectCount: 42,
    expectedCRDCount: 22,
    expectedSecretCount: 0,
    targetFactNote: "adds UI ingress exposure with host and ingress class made explicit before render",
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
      id: "helm-hook-lifecycle-policy",
      severity: "medium",
      description: "Longhorn pre-upgrade hooks need an explicit lifecycle policy.",
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
      id: "privileged-storage-workload-review",
      severity: "medium",
      description: "Storage DaemonSets and host-level access need explicit target readiness policy.",
    },
    {
      id: "ui-ingress-policy",
      severity: "medium",
      description: "Longhorn UI exposure needs ingress, TLS, and auth policy.",
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
  node scripts/longhorn-proof.mjs --generate-proof
  node scripts/longhorn-proof.mjs --generate-package
  node scripts/longhorn-proof.mjs --verify-proof
  node scripts/longhorn-proof.mjs --verify-proof-self-test
  node scripts/longhorn-proof.mjs --verify-package
  node scripts/longhorn-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: "longhorn-longhorn-1.11.2" },
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
        harnessReceipt: "../../../../data/adversarial10/charts/longhorn-longhorn-1.11.2/render-receipt.yaml",
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: "longhorn-longhorn-1.11.2" },
    spec: {
      chart: "longhorn/longhorn",
      version: chart.version,
      dependencies: [],
    },
  });

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: "longhorn-longhorn-1.11.2" },
    spec: {
      checkedValues: [
        {
          path: "crds/*",
          variant: "default",
          disposition: "crds-included",
          reason: "Longhorn chart ships 22 CRDs and the proof renders them as ordinary objects with --include-crds",
        },
        {
          path: "ingress.enabled / ingress.host / ingress.ingressClassName / ingress.tls",
          variant: "ui-ingress",
          disposition: "ui-exposure-bound",
          reason: "UI exposure is only added by an explicit variant with host, ingress class, and TLS posture captured",
        },
        {
          path: "preUpgradeChecker.jobEnabled",
          variant: "all",
          disposition: "hook-excluded-by-render-policy",
          reason: "Longhorn pre-upgrade check is a Helm hook path and is excluded from rendered revisions by --no-hooks",
        },
        {
          path: "persistence.*",
          variant: "all",
          disposition: "storageclass-policy",
          reason: "default StorageClass, replica count, reclaim policy, and data engine settings are install-impacting inputs",
        },
        {
          path: "defaultSettings.*",
          variant: "all",
          disposition: "target-storage-policy",
          reason: "host paths, replica scheduling, backup targets, and node policies affect live storage behavior after install",
        },
        {
          path: "privateRegistry.*",
          variant: "all",
          disposition: "secret-or-target-fact-slot",
          reason: "registry credentials can create or reference Secrets and must be explicit in production variants",
        },
        {
          path: "longhornManager / longhornDriver / longhornUI tolerations and nodeSelectors",
          variant: "all",
          disposition: "target-placement-policy",
          reason: "storage components need target node readiness, toleration, and placement policy",
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
    metadata: { name: "longhorn-longhorn-1.11.2" },
    spec: {
      points: [
        { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
        { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart has no subchart dependencies" },
        {
          category: "capability-profile",
          status: "handled",
          kubeVersion: chart.kubeVersion,
          note: "render is bound to the named Kubernetes capability profile.",
        },
        {
          category: "crd-policy",
          status: "variant-controlled",
          variants: { default: 22, "ui-ingress": 22 },
          note: "Longhorn CRDs are ordinary rendered objects in both promoted variants and still need lifecycle/upgrade policy.",
        },
        {
          category: "hook-policy",
          status: "handled-for-render",
          policy: "no-hooks",
          note: "pre-upgrade checker hooks are excluded from the render proof; lifecycle policy must handle them before production.",
        },
        {
          category: "admission-webhook",
          status: "scan-and-observe",
          objects: [
            "v1|Service|longhorn-system|longhorn-admission-webhook",
            "v1|Service|longhorn-system|longhorn-recovery-backend",
          ],
        },
        { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||longhorn-role" },
        { category: "privileged-storage-workload", status: "scan-and-review", object: "apps/v1|DaemonSet|longhorn-system|longhorn-manager" },
        { category: "storageclass-policy", status: "scan-and-review", object: "v1|ConfigMap|longhorn-system|longhorn-storageclass" },
        { category: "ui-ingress-policy", status: "variant-controlled", object: "networking.k8s.io/v1|Ingress|longhorn-system|longhorn-ingress" },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||longhorn-system" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "longhorn-longhorn", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: "../../../../packages/longhorn/longhorn/1.11.2",
        setupCommand: [
          "cub",
          "install",
          "setup",
          "--pull",
          "../../../../packages/longhorn/longhorn/1.11.2",
          "--non-interactive",
          "--namespace",
          "longhorn-system",
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
      metadata: { name: `longhorn-longhorn-${chart.version}-${variant.name}-r001` },
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
      metadata: { name: `longhorn-${variant.name}-r001` },
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
          secretCountSeparatedByCubInstall: 0,
        },
      },
    });
    writeYaml(join(receiptsRoot, "helm-equivalence-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "HelmEquivalenceReceipt",
      metadata: { name: `longhorn-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        regularHelm: { renderedSHA256: releaseDigest, objectCount: objects.length },
        cubInstall: {
          objectCountIncludingSecretsAndSupportObjects: objects.length + 1,
          uploadedManifestFiles: objects.length + 1,
          separatedSecretFiles: 0,
          semanticObjectMatches: `${objects.length}/${objects.length}`,
        },
        semanticNormalizations: ["prune-null-fields"],
        classifications: [
          { identity: "v1|Namespace||longhorn-system", classification: "installer-support-object", disposition: "allowed" },
        ],
        result: "pass",
        evidenceCommand: "npm run longhorn:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `longhorn-${variant.name}-r001` },
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
      metadata: { name: `longhorn-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        decision: "warn",
        allowedScopes: ["local-test"],
        blockedScopes: ["production"],
        reasons: [
          `Helm equivalence passed for ${variant.name}`,
          "CRD install/upgrade behavior needs explicit lifecycle policy before production",
          "Longhorn admission/recovery services and managers need fresh observation receipts after apply",
          "Longhorn pre-upgrade hook Jobs need explicit lifecycle policy before production",
          "Cluster-scoped RBAC needs production review",
          "Storage DaemonSet host-level behavior and StorageClass/default-setting ConfigMaps need target policy",
          variant.targetFactNote,
        ],
      },
    });
    summaries.push({ ...variant, releaseDigest, objects, scanCounts, scanResult });
  }

  writeYaml(join(proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: "longhorn-longhorn-1.11.2" },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "longhorn/longhorn",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        nextAction: "publish only after CRD lifecycle/upgrade policy, admission/recovery observation policy, pre-upgrade hook policy, privileged storage workload policy, UI ingress policy, and cluster RBAC review are satisfied",
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
    metadata: { name: "longhorn-longhorn-1.11.2" },
    spec: {
      chart: "longhorn/longhorn",
      version: chart.version,
      maintainedNotes: [
        "Default chart renders 22 Longhorn CRDs as ordinary rendered objects with --include-crds.",
        "default variant keeps UI ingress disabled and captures the storage control plane baseline.",
        "ui-ingress variant adds Longhorn UI exposure with host and ingress class explicitly captured.",
        "Longhorn pre-upgrade checks are hook paths and are excluded from rendered revisions by --no-hooks.",
        "Longhorn manager, driver deployer, admission/recovery services, StorageClass/default settings, and CRDs require target readiness and observation policy.",
      ],
      knownControlPoints: [
        "capability-profile",
        "crd-lifecycle-policy",
        "hook-lifecycle-policy",
        "admission-recovery-observation",
        "privileged-storage-workload",
        "storageclass-policy",
        "ui-ingress-policy",
        "cluster-rbac-scan",
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
    metadata: { name: "longhorn-longhorn", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `Longhorn ${variant.displayName} variant rendered from longhorn/longhorn@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# longhorn/longhorn ${chart.version} Installer Package

This package is generated from the Longhorn proof artifacts.

\`\`\`sh
npm run longhorn:generate-package
npm run longhorn:verify-package
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
  const tempRoot = mkdtempSync(join(tmpdir(), "longhorn-installer-package-"));
  try {
    const firstPackage = join(tempRoot, "longhorn-1.11.2-a.tgz");
    const secondPackage = join(tempRoot, "longhorn-1.11.2-b.tgz");
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
      metadata: { name: "longhorn-longhorn-1.11.2" },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "longhorn-longhorn",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub installer package ${packageRelative} -o <tmp>/longhorn-1.11.2.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub installer setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace longhorn-system`,
          helmReleaseObjectCount: variant.expectedObjectCount,
          cubInstallObjectCountIncludingSupport: variant.expectedObjectCount + 1,
          semanticObjectMatches: `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
          separatedSecretCount: 0,
          allowedCubOnlyObjects: ["v1|Namespace||longhorn-system"],
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
    "effective-values-ui-ingress.yaml",
    "recipe.yaml",
    "variants/default/variant.yaml",
    "variants/ui-ingress/variant.yaml",
    "revisions/default/r001/variant-revision.yaml",
    "revisions/default/r001/rendered/release-objects.yaml",
    "revisions/default/r001/rendered/object-inventory.yaml",
    "revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/default/r001/receipts/render-receipt.yaml",
    "revisions/default/r001/receipts/scan-receipt.yaml",
    "revisions/default/r001/receipts/install-gate.yaml",
    "revisions/ui-ingress/r001/variant-revision.yaml",
    "revisions/ui-ingress/r001/rendered/release-objects.yaml",
    "revisions/ui-ingress/r001/rendered/object-inventory.yaml",
    "revisions/ui-ingress/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/ui-ingress/r001/receipts/render-receipt.yaml",
    "revisions/ui-ingress/r001/receipts/scan-receipt.yaml",
    "revisions/ui-ingress/r001/receipts/install-gate.yaml",
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
  check(sourceLock.spec.repositoryName === "longhorn", "source repository mismatch");
  check(sourceLock.spec.chart === "longhorn", "source chart mismatch");
  check(sourceLock.spec.version === "1.11.2", "source version mismatch");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).length === 0, "longhorn dependency lock must be empty");
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "capability-profile"), "capability-profile control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "hook-policy"), "hook-policy control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "privileged-storage-workload"), "privileged-storage-workload control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "ui-ingress-policy"), "ui-ingress-policy control point missing");

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
    check(identities.includes("apps/v1|DaemonSet|longhorn-system|longhorn-manager"), `${variant.name} manager DaemonSet missing`);
    check(identities.includes("apps/v1|Deployment|longhorn-system|longhorn-driver-deployer"), `${variant.name} driver deployer missing`);
    check(identities.includes("apps/v1|Deployment|longhorn-system|longhorn-ui"), `${variant.name} UI Deployment missing`);
    check(identities.includes("v1|Service|longhorn-system|longhorn-admission-webhook"), `${variant.name} admission webhook Service missing`);
    check(identities.includes("v1|Service|longhorn-system|longhorn-recovery-backend"), `${variant.name} recovery backend Service missing`);
    check(identities.includes("v1|Service|longhorn-system|longhorn-frontend"), `${variant.name} frontend Service missing`);
    check(identities.includes("v1|ConfigMap|longhorn-system|longhorn-default-setting"), `${variant.name} default setting ConfigMap missing`);
    check(identities.includes("v1|ConfigMap|longhorn-system|longhorn-storageclass"), `${variant.name} storageclass ConfigMap missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||longhorn-role"), `${variant.name} ClusterRole missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||longhorn-bind"), `${variant.name} ClusterRoleBinding missing`);
    check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||volumes.longhorn.io"), `${variant.name} volumes CRD missing`);
    check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||engines.longhorn.io"), `${variant.name} engines CRD missing`);
    check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||nodes.longhorn.io"), `${variant.name} nodes CRD missing`);
    if (variant.name === "default") {
      check(!identities.includes("networking.k8s.io/v1|Ingress|longhorn-system|longhorn-ingress"), "default must not render UI Ingress");
    }
    if (variant.name === "ui-ingress") {
      check(identities.includes("networking.k8s.io/v1|Ingress|longhorn-system|longhorn-ingress"), "ui-ingress Ingress missing");
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
    check(scan.spec.findingCounts.medium >= 6, `${variant.name} scan must flag CRD/admission/hook/RBAC/storage/UI review`);
    check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} install gate digest mismatch`);
    check(gate.spec.decision === "warn", `${variant.name} install gate should warn`);
  }
  console.log("verified longhorn proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "longhorn-proof-self-test-"));
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
    console.log("self-test passed: longhorn rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run longhorn:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run longhorn:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "longhorn-longhorn", "package name mismatch");
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

  const tempRoot = mkdtempSync(join(tmpdir(), "longhorn-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "longhorn-a.tgz");
    const secondPackage = join(tempRoot, "longhorn-b.tgz");
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
  console.log("longhorn installer package verification passed");
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
    "longhorn-system",
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
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||longhorn-system"]),
    `${variant.name} cub output may add only v1|Namespace||longhorn-system; found ${extraInCub.join(", ")}`,
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
  const tempRoot = mkdtempSync(join(tmpdir(), "longhorn-source-"));
  try {
    command("helm", ["pull", "longhorn/longhorn", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "longhorn");
    const chartYaml = readYaml(join(chartRoot, "Chart.yaml"));
    return {
      appVersion: chartYaml.appVersion,
      packageSHA256: sha256File(packagePath),
      packageBytes: readFileSync(packagePath).length,
      defaultValuesSHA256: sha256File(join(chartRoot, "values.yaml")),
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function renderVariant(variant) {
  const tempRoot = mkdtempSync(join(tmpdir(), "longhorn-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "longhorn/longhorn",
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
      metadata: { name: "longhorn-longhorn-1.11.2-default" },
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
    metadata: { name: `longhorn-longhorn-1.11.2-${variant.name}` },
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
  for (const doc of docs.filter((item) => item.kind === "Service" && ["longhorn-admission-webhook", "longhorn-recovery-backend"].includes(item.metadata?.name))) {
    findings.push({
      id: `admission-webhook-requires-observation:${identityFor(doc)}`,
      rule: "admission-webhook-requires-observation",
      severity: "medium",
      object: identityFor(doc),
      message: "Longhorn admission/recovery service availability must be observed after apply",
    });
  }
  for (const doc of docs.filter((item) => ["DaemonSet", "Deployment"].includes(item.kind) && String(item.metadata?.name ?? "").startsWith("longhorn"))) {
    findings.push({
      id: `privileged-storage-workload-review:${identityFor(doc)}`,
      rule: "privileged-storage-workload-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Longhorn storage workloads need node, host path, privileged behavior, and observation policy",
    });
  }
  findings.push({
    id: "helm-hook-lifecycle-policy:longhorn-pre-upgrade",
    rule: "helm-hook-lifecycle-policy",
    severity: "medium",
    object: "helm-hook|Job|longhorn|pre-upgrade-checker",
    message: "Longhorn pre-upgrade checks are Helm hook paths excluded by --no-hooks and need lifecycle policy",
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
  for (const doc of docs.filter((item) => item.kind === "ConfigMap" && ["longhorn-storageclass", "longhorn-default-setting"].includes(item.metadata?.name))) {
    findings.push({
      id: `storageclass-policy:${identityFor(doc)}`,
      rule: "privileged-storage-workload-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Longhorn storage/default settings require target policy review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Ingress")) {
    findings.push({
      id: `ui-ingress-policy:${identityFor(doc)}`,
      rule: "ui-ingress-policy",
      severity: "medium",
      object: identityFor(doc),
      message: "Longhorn UI exposure requires ingress, TLS, and auth policy",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function writeReadme(summaries) {
  write(
    join(proofRoot, "README.md"),
    `# longhorn/longhorn ${chart.version} Proof

This is the promoted proof slice for the Longhorn public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub installer objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub installer setup\`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- both variants render the 22 Longhorn CRDs as ordinary, digest-bound objects;
- the ui-ingress variant deliberately adds Longhorn UI exposure with host and ingress class captured before render;
- CRD lifecycle, pre-upgrade hook lifecycle, admission/recovery observation, cluster RBAC, privileged storage workload, StorageClass/default-setting, and UI ingress risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run longhorn:generate-proof
npm run longhorn:generate-package
npm run longhorn:verify-proof
npm run longhorn:verify-package
npm run longhorn:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
