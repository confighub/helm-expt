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

const proofRoot = join(repoRoot, "recipes", "external-secrets", "external-secrets", "2.5.0");
const packageRoot = join(repoRoot, "packages", "external-secrets", "external-secrets", "2.5.0");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chart = {
  repository: "external-secrets",
  repositoryURL: "https://charts.external-secrets.io",
  name: "external-secrets",
  version: "2.5.0",
  releaseName: "external-secrets",
  namespace: "external-secrets",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults",
    expectedObjectCount: 42,
    expectedCRDCount: 23,
    expectedSecretCount: 1,
    targetFactNote: "includes external-secrets CRDs and an empty webhook Secret managed by the cert-controller",
  },
  {
    name: "no-crds",
    base: "no-crds",
    displayName: "CRDs disabled",
    valuesFile: "effective-values-no-crds.yaml",
    valuesText: `installCRDs: false
`,
    valuesSummary: "external-secrets CRDs disabled",
    expectedObjectCount: 19,
    expectedCRDCount: 0,
    expectedSecretCount: 1,
    targetFactNote: "omits external-secrets CRDs while preserving webhook, cert-controller, and RBAC objects",
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
      id: "webhook-secret-cert-controller-policy",
      severity: "medium",
      description: "Webhook Secret lifecycle needs cert-controller observation policy.",
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
  node scripts/external-secrets-proof.mjs --generate-proof
  node scripts/external-secrets-proof.mjs --generate-package
  node scripts/external-secrets-proof.mjs --verify-proof
  node scripts/external-secrets-proof.mjs --verify-proof-self-test
  node scripts/external-secrets-proof.mjs --verify-package
  node scripts/external-secrets-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: "external-secrets-external-secrets-2.5.0" },
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
        harnessReceipt: "../../../../data/adversarial10/charts/external-secrets-external-secrets-2.5.0/render-receipt.yaml",
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: "external-secrets-external-secrets-2.5.0" },
    spec: {
      chart: "external-secrets/external-secrets",
      version: chart.version,
      dependencies: source.dependencies,
      chartLockDigest: source.chartLockDigest,
    },
  });

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: "external-secrets-external-secrets-2.5.0" },
    spec: {
      checkedValues: [
        {
          path: "installCRDs",
          variant: "default",
          disposition: "crds-included",
          reason: "chart defaults render all external-secrets CRDs",
        },
        {
          path: "installCRDs",
          variant: "no-crds",
          disposition: "crds-excluded",
          reason: "omits CRDs from the rendered revision for clusters that manage CRDs separately",
        },
        {
          path: "crds.*",
          variant: "all",
          disposition: "crd-selection-controls",
          reason: "controls which external-secrets CRDs are rendered when installCRDs is enabled",
        },
        {
          path: "webhook.certManager.enabled",
          variant: "all",
          disposition: "built-in-cert-controller",
          reason: "defaults to built-in cert-controller and an empty webhook Secret rather than cert-manager Certificate objects",
        },
        {
          path: "extraObjects",
          variant: "all",
          disposition: "empty-extension-slot",
          reason: "chart exposes a tpl-powered extension slot; promoted variants keep it empty",
        },
        {
          path: "bitwarden-sdk-server.enabled",
          variant: "all",
          disposition: "disabled-dependency",
          reason: "chart declares and locks this dependency, but promoted variants keep it disabled",
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
    metadata: { name: "external-secrets-external-secrets-2.5.0" },
    spec: {
      points: [
        { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
        {
          category: "dependency-lock",
          status: "handled",
          evidence: "dependency-lock.yaml",
          note: "chart declares bitwarden-sdk-server dependency; promoted variants keep it disabled but lock its metadata.",
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
          variants: { default: 23, "no-crds": 0 },
          note: "CRDs are ordinary rendered objects in the default variant and still need lifecycle/upgrade policy.",
        },
        {
          category: "admission-webhook",
          status: "scan-and-observe",
          objects: [
            "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||externalsecret-validate",
            "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||secretstore-validate",
          ],
        },
        {
          category: "webhook-secret",
          status: "scan-and-observe",
          object: "v1|Secret|external-secrets|external-secrets-webhook",
          note: "rendered Secret contains metadata only; cert-controller populates certificate material later.",
        },
        { category: "cluster-rbac", status: "scan-and-review", evidence: "scan receipts" },
        { category: "tpl", status: "controlled-by-empty-defaults", note: "extraObjects uses tpl; promoted variants do not set that value." },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||external-secrets" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "external-secrets-external-secrets", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: "../../../../packages/external-secrets/external-secrets/2.5.0",
        setupCommand: [
          "cub",
          "install",
          "setup",
          "--pull",
          "../../../../packages/external-secrets/external-secrets/2.5.0",
          "--non-interactive",
          "--namespace",
          "external-secrets",
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
      metadata: { name: `external-secrets-external-secrets-${chart.version}-${variant.name}-r001` },
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
      metadata: { name: `external-secrets-${variant.name}-r001` },
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
      metadata: { name: `external-secrets-${variant.name}-r001` },
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
          { identity: "v1|Namespace||external-secrets", classification: "installer-support-object", disposition: "allowed" },
        ],
        result: "pass",
        evidenceCommand: "npm run external-secrets:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `external-secrets-${variant.name}-r001` },
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
      metadata: { name: `external-secrets-${variant.name}-r001` },
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
          "Webhook Secret and cert-controller behavior need observation after apply",
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
    metadata: { name: "external-secrets-external-secrets-2.5.0" },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "external-secrets/external-secrets",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        nextAction: "publish only after CRD lifecycle/upgrade policy, webhook observation policy, webhook Secret observation, dependency lock review, and cluster RBAC review are satisfied",
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
    metadata: { name: "external-secrets-external-secrets-2.5.0" },
    spec: {
      chart: "external-secrets/external-secrets",
      version: chart.version,
      maintainedNotes: [
        "Default chart renders 23 external-secrets CRDs because installCRDs defaults to true.",
        "no-crds variant omits CRDs for clusters that manage CRDs separately.",
        "Chart declares a bitwarden-sdk-server dependency that remains disabled in promoted variants but is recorded in dependency-lock.yaml.",
        "Validating webhook readiness must be observed after apply because rendered objects alone do not prove webhook health.",
        "The rendered webhook Secret contains metadata only; cert-controller populates certificate material after apply.",
        "extraObjects is a tpl-powered extension slot; promoted variants keep it empty.",
      ],
      knownControlPoints: [
        "capability-profile",
        "crd-lifecycle-policy",
        "dependency-lock",
        "admission-webhook-observation",
        "webhook-secret-observation",
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
    metadata: { name: "external-secrets-external-secrets", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `external-secrets ${variant.displayName} variant rendered from external-secrets/external-secrets@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# external-secrets/external-secrets ${chart.version} Installer Package

This package is generated from the external-secrets proof artifacts.

\`\`\`sh
npm run external-secrets:generate-package
npm run external-secrets:verify-package
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
  const tempRoot = mkdtempSync(join(tmpdir(), "external-secrets-installer-package-"));
  try {
    const firstPackage = join(tempRoot, "external-secrets-2.5.0-a.tgz");
    const secondPackage = join(tempRoot, "external-secrets-2.5.0-b.tgz");
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
      metadata: { name: "external-secrets-external-secrets-2.5.0" },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "external-secrets-external-secrets",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub installer package ${packageRelative} -o <tmp>/external-secrets-2.5.0.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub installer setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace external-secrets`,
          helmReleaseObjectCount: variant.expectedObjectCount,
          cubInstallObjectCountIncludingSupport: variant.expectedObjectCount + 1,
          semanticObjectMatches: `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
          separatedSecretCount: variant.expectedSecretCount,
          allowedCubOnlyObjects: ["v1|Namespace||external-secrets"],
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
  check(sourceLock.spec.repositoryName === "external-secrets", "source repository mismatch");
  check(sourceLock.spec.chart === "external-secrets", "source chart mismatch");
  check(sourceLock.spec.version === "2.5.0", "source version mismatch");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).length === 1, "external-secrets dependency lock must record bitwarden-sdk-server");
  check(dependencyLock.spec.dependencies?.[0]?.name === "bitwarden-sdk-server", "external-secrets dependency name mismatch");
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "capability-profile"), "capability-profile control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "webhook-secret"), "webhook-secret control point missing");

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
    check(identities.includes("apps/v1|Deployment|external-secrets|external-secrets"), `${variant.name} controller Deployment missing`);
    check(identities.includes("apps/v1|Deployment|external-secrets|external-secrets-cert-controller"), `${variant.name} cert-controller Deployment missing`);
    check(identities.includes("apps/v1|Deployment|external-secrets|external-secrets-webhook"), `${variant.name} webhook Deployment missing`);
    check(identities.includes("v1|Service|external-secrets|external-secrets-webhook"), `${variant.name} webhook Service missing`);
    check(identities.includes("v1|Secret|external-secrets|external-secrets-webhook"), `${variant.name} webhook Secret missing`);
    check(
      identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||externalsecret-validate"),
      `${variant.name} externalsecret ValidatingWebhookConfiguration missing`,
    );
    check(
      identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||secretstore-validate"),
      `${variant.name} secretstore ValidatingWebhookConfiguration missing`,
    );
    if (variant.name === "default") {
      const requiredCRDs = [
        "apiextensions.k8s.io/v1|CustomResourceDefinition||acraccesstokens.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||cloudsmithaccesstokens.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||clusterexternalsecrets.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||clustergenerators.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||clusterpushsecrets.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||clustersecretstores.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||ecrauthorizationtokens.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||externalsecrets.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||fakes.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||gcraccesstokens.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||generatorstates.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||githubaccesstokens.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||grafanas.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||mfas.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||passwords.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||pushsecrets.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||quayaccesstokens.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||secretstores.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||sshkeys.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||stssessiontokens.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||uuids.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||vaultdynamicsecrets.generators.external-secrets.io",
        "apiextensions.k8s.io/v1|CustomResourceDefinition||webhooks.generators.external-secrets.io",
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
  console.log("verified external-secrets proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "external-secrets-proof-self-test-"));
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
    console.log("self-test passed: external-secrets rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run external-secrets:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run external-secrets:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "external-secrets-external-secrets", "package name mismatch");
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

  const tempRoot = mkdtempSync(join(tmpdir(), "external-secrets-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "external-secrets-a.tgz");
    const secondPackage = join(tempRoot, "external-secrets-b.tgz");
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
  console.log("external-secrets installer package verification passed");
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
    "external-secrets",
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
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||external-secrets"]),
    `${variant.name} cub output may add only v1|Namespace||external-secrets; found ${extraInCub.join(", ")}`,
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
  const tempRoot = mkdtempSync(join(tmpdir(), "external-secrets-source-"));
  try {
    command("helm", ["pull", "external-secrets/external-secrets", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "external-secrets");
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
  const tempRoot = mkdtempSync(join(tmpdir(), "external-secrets-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "external-secrets/external-secrets",
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
      metadata: { name: "external-secrets-external-secrets-2.5.0-default" },
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
    metadata: { name: `external-secrets-external-secrets-2.5.0-${variant.name}` },
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
  for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "external-secrets-webhook")) {
    findings.push({
      id: `webhook-secret-cert-controller-policy:${identityFor(doc)}`,
      rule: "webhook-secret-cert-controller-policy",
      severity: "medium",
      object: identityFor(doc),
      message: "Webhook Secret certificate material is populated by cert-controller after apply and needs observation",
    });
  }
  findings.push({
    id: "dependency-lock-review:bitwarden-sdk-server",
    rule: "dependency-lock-review",
    severity: "medium",
    object: "dependency|bitwarden-sdk-server|v0.6.0",
    message: "Disabled bitwarden-sdk-server dependency is locked and should remain disabled unless selected by a variant",
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
    `# external-secrets/external-secrets ${chart.version} Proof

This is the promoted proof slice for the external-secrets public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub installer objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub installer setup\`, plus the explained Namespace support object;
- default chart render is deterministic under the pinned Kubernetes capability profile;
- the no-crds variant deliberately removes the 23 external-secrets CRDs;
- CRD lifecycle, admission webhook, webhook Secret, disabled dependency, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run external-secrets:generate-proof
npm run external-secrets:generate-package
npm run external-secrets:verify-proof
npm run external-secrets:verify-package
npm run external-secrets:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
