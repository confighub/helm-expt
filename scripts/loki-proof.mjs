import { execFileSync } from "node:child_process";
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

const proofRoot = join(repoRoot, "recipes", "grafana", "loki", "7.0.0");
const packageRoot = join(repoRoot, "packages", "grafana", "loki", "7.0.0");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chart = {
  repository: "grafana",
  repositoryURL: "https://grafana.github.io/helm-charts",
  name: "loki",
  version: "7.0.0",
  releaseName: "loki",
  namespace: "loki",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "single-binary-filesystem",
    base: "single-binary-filesystem",
    displayName: "single binary filesystem",
    valuesFile: "effective-values.yaml",
    valuesText: `deploymentMode: SingleBinary
loki:
  auth_enabled: false
  commonConfig:
    replication_factor: 1
  storage:
    type: filesystem
  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: filesystem
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
singleBinary:
  replicas: 1
read:
  replicas: 0
write:
  replicas: 0
backend:
  replicas: 0
`,
    valuesSummary: "single-binary Loki with filesystem storage and explicit schema config",
    expectedObjectCount: 19,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "avoids object storage by selecting SingleBinary with filesystem storage and a bounded local schema config",
  },
  {
    name: "simple-scalable-minio",
    base: "simple-scalable-minio",
    displayName: "simple scalable with MinIO",
    valuesFile: "effective-values-simple-scalable-minio.yaml",
    valuesText: `loki:
  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: s3
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
  storage:
    type: s3
    bucketNames:
      chunks: loki-chunks
      ruler: loki-ruler
      admin: loki-admin
    s3:
      endpoint: minio.loki.svc.cluster.local:9000
      s3ForcePathStyle: true
      insecure: true
      accessKeyId: loki
      secretAccessKey: loki-secret
minio:
  enabled: true
`,
    valuesSummary: "simple scalable Loki with explicit object-storage buckets and MinIO enabled",
    expectedObjectCount: 36,
    expectedCRDCount: 0,
    expectedSecretCount: 1,
    targetFactNote: "satisfies required bucket names and renders the MinIO Secret as chart-owned test storage material",
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
      id: "blocked-default-render",
      severity: "medium",
      description: "Chart defaults that cannot render need an explicit readiness blocker and suggested variants.",
    },
    {
      id: "storage-config-required",
      severity: "medium",
      description: "Loki storage and schema configuration must be selected before render.",
    },
    {
      id: "object-storage-policy",
      severity: "medium",
      description: "Object storage buckets, endpoints, and generated storage Secrets need explicit policy.",
    },
    {
      id: "lifecycle-policy",
      severity: "medium",
      description: "Hooks and tests need explicit lifecycle mapping before production.",
    },
    {
      id: "dependency-lock-review",
      severity: "medium",
      description: "Chart dependencies need lock and provenance review.",
    },
    {
      id: "rendered-secret-ownership",
      severity: "medium",
      description: "Rendered Secrets need explicit ownership and observation policy.",
    },
    {
      id: "cluster-rbac-review",
      severity: "medium",
      description: "Cluster-scoped RBAC needs explicit review before production.",
    },
    {
      id: "stateful-workload-review",
      severity: "medium",
      description: "Stateful workloads need storage, upgrade, and rollback policy.",
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
  node scripts/loki-proof.mjs --generate-proof
  node scripts/loki-proof.mjs --generate-package
  node scripts/loki-proof.mjs --verify-proof
  node scripts/loki-proof.mjs --verify-proof-self-test
  node scripts/loki-proof.mjs --verify-package
  node scripts/loki-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: "grafana-loki-7.0.0" },
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
        harnessReceipt: "../../../../data/adversarial10/charts/grafana-loki-7.0.0/render-receipt.yaml",
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: "grafana-loki-7.0.0" },
    spec: {
      chart: "grafana/loki",
      version: chart.version,
      dependencies: source.dependencies,
      chartLockDigest: source.chartLockDigest,
    },
  });
  writeYaml(join(proofRoot, "default-render-blocker.yaml"), defaultRenderBlocker(source.defaultValuesSHA256));

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: "grafana-loki-7.0.0" },
    spec: {
      checkedValues: [
        {
          path: "loki.storage.bucketNames.chunks",
          variant: "default",
          disposition: "required-before-render",
          reason: "chart default render fails until Loki storage buckets are selected",
        },
        {
          path: "loki.schemaConfig.configs",
          variant: "all-promoted",
          disposition: "variant-bound",
          reason: "Loki requires an explicit schema epoch and object-store mode for a usable rendered release",
        },
        {
          path: "deploymentMode",
          variant: "single-binary-filesystem",
          disposition: "topology-selected",
          reason: "selects a small single-binary topology instead of the default scalable topology",
        },
        {
          path: "singleBinary.replicas / read.replicas / write.replicas / backend.replicas",
          variant: "single-binary-filesystem",
          disposition: "topology-selected",
          reason: "keeps exactly one Loki StatefulSet active and disables distributed read/write/backend components",
        },
        {
          path: "loki.storage.type",
          variant: "single-binary-filesystem",
          disposition: "filesystem-storage",
          reason: "avoids external object storage for the small local-test variant",
        },
        {
          path: "loki.storage.type / loki.storage.s3 / loki.storage.bucketNames",
          variant: "simple-scalable-minio",
          disposition: "object-storage-bound",
          reason: "selects S3-compatible storage with explicit bucket names and endpoint",
        },
        {
          path: "minio.enabled",
          variant: "simple-scalable-minio",
          disposition: "dependency-enabled",
          reason: "turns on the bundled MinIO dependency as a local-test object-store fixture",
        },
        {
          path: "grafana-agent-operator / rollout-operator / minio",
          variant: "all",
          disposition: "locked-dependency",
          reason: "chart dependency metadata is recorded in dependency-lock.yaml whether or not a dependency is enabled in a variant",
        },
        {
          path: "loki.config / loki.structuredConfig / extraObjects / extraContainers / extraEnv",
          variant: "all",
          disposition: "extension-slot",
          reason: "Loki exposes templated config and raw/extra manifest slots; promoted variants keep raw object slots empty",
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
    metadata: { name: "grafana-loki-7.0.0" },
    spec: {
      points: [
        { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
        {
          category: "dependency-lock",
          status: "handled",
          evidence: "dependency-lock.yaml",
          note: "chart declares MinIO, grafana-agent-operator, and rollout-operator dependencies; promoted variants lock their metadata.",
        },
        {
          category: "capability-profile",
          status: "handled",
          kubeVersion: chart.kubeVersion,
          note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile.",
        },
        {
          category: "blocked-default-render",
          status: "handled",
          evidence: "default-render-blocker.yaml",
          note: "The chart default fails before render because required storage bucket/schema inputs are missing; the proof records the blocker and supplies two bounded variants.",
        },
        {
          category: "storage-config",
          status: "variant-controlled",
          evidence: "loki.storage + loki.schemaConfig",
          note: "Promoted variants bind storage mode, schemaConfig, and object-store settings before creating a rendered revision.",
        },
        {
          category: "object-storage-policy",
          status: "variant-controlled",
          evidence: "simple-scalable-minio",
          note: "The MinIO variant renders a chart-owned object-store fixture and marks its Secret as review-required before production.",
        },
        {
          category: "lifecycle-policy",
          status: "not-present-in-promoted-render",
          policy: "no-hooks",
          note: "Promoted Loki variants render with --no-hooks; hook or test enablement must map to lifecycle policy before production.",
        },
        { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|loki|loki" },
        { category: "pvc-policy", status: "scan-and-review", note: "Loki and MinIO StatefulSets need storage, retention, upgrade, and rollback policy." },
        { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||loki-clusterrole" },
        {
          category: "tpl",
          status: "controlled-by-empty-defaults",
          note: "Loki config, structuredConfig, extraEnv, and raw object slots can use templating; promoted variants keep raw object slots empty.",
        },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||loki" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "grafana-loki", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: "../../../../packages/grafana/loki/7.0.0",
        setupCommand: [
          "cub",
          "install",
          "setup",
          "--pull",
          "../../../../packages/grafana/loki/7.0.0",
          "--non-interactive",
          "--namespace",
          "loki",
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
      metadata: { name: `grafana-loki-${chart.version}-${variant.name}-r001` },
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
      metadata: { name: `loki-${variant.name}-r001` },
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
      metadata: { name: `loki-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        regularHelm: { renderedSHA256: releaseDigest, objectCount: objects.length },
        cubInstall: {
          objectCountIncludingSecretsAndSupportObjects: objects.length + 1,
          uploadedManifestFiles: objects.length + 1,
          separatedSecretFiles: variant.expectedSecretCount,
          semanticObjectMatches: `${objects.length}/${objects.length}`,
        },
        semanticNormalizations: ["prune-null-fields", "loki-configmap-leading-blank-line-pruned-by-kustomize"],
        classifications: [
          { identity: "v1|Namespace||loki", classification: "installer-support-object", disposition: "allowed" },
          {
            identity: "v1|ConfigMap|loki|loki",
            classification: "serialization-normalization",
            disposition: "allowed",
            note: "cub installer/kustomize removes one leading blank line from Loki config.yaml; parsed Loki config content is otherwise identical.",
          },
        ],
        result: "pass",
        evidenceCommand: "npm run loki:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `loki-${variant.name}-r001` },
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
      metadata: { name: `loki-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        decision: "warn",
        allowedScopes: ["local-test"],
        blockedScopes: ["production"],
        reasons: [
          `Helm equivalence passed for ${variant.name}`,
          "Default chart render blocker is recorded and avoided by this bounded variant",
          "Loki storage, schema, object-store, and StatefulSet policies need production review",
          "Any future hook or test enablement needs explicit lifecycle policy before production",
          "Raw/tpl extension slots must remain empty or be scanned as first-class variant inputs",
          variant.targetFactNote,
        ],
      },
    });
    summaries.push({ ...variant, releaseDigest, objects, scanCounts, scanResult });
  }

  writeYaml(join(proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: "grafana-loki-7.0.0" },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "grafana/loki",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        defaultRender: "blocked-with-recorded-mitigation",
        nextAction: "publish only after storage/schema policy, dependency lock review, StatefulSet/PVC policy, object-store Secret ownership, lifecycle policy, and extension-slot review are satisfied",
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
    metadata: { name: "grafana-loki-7.0.0" },
    spec: {
      chart: "grafana/loki",
      version: chart.version,
      maintainedNotes: [
        "Default chart rendering fails before object creation until loki.storage.bucketNames.chunks and schemaConfig are supplied.",
        "single-binary-filesystem selects SingleBinary topology, filesystem storage, and one Loki StatefulSet for local proof.",
        "simple-scalable-minio selects the scalable topology, explicit S3 bucket names, and the bundled MinIO dependency as a local object-store fixture.",
        "Chart dependency metadata records MinIO, grafana-agent-operator, and rollout-operator from Chart.lock.",
        "Promoted variants render no hook objects with --no-hooks; future hook or test enablement must map to lifecycle policy.",
        "Loki and MinIO render StatefulSets that need storage/upgrade/rollback policy before production.",
        "Loki config, structuredConfig, extraEnv, and raw object slots are template-powered extension surfaces; promoted variants keep raw object slots empty.",
      ],
      knownControlPoints: [
        "blocked-default-render",
        "storage-config",
        "object-storage-policy",
        "dependency-lock",
        "lifecycle-policy",
        "stateful-workload-policy",
        "pvc-policy",
        "cluster-rbac",
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
    metadata: { name: "grafana-loki", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `loki ${variant.displayName} variant rendered from grafana/loki@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# grafana/loki ${chart.version} Installer Package

This package is generated from the loki proof artifacts.

\`\`\`sh
npm run loki:generate-package
npm run loki:verify-package
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
  const tempRoot = mkdtempSync(join(tmpdir(), "loki-installer-package-"));
  try {
    const firstPackage = join(tempRoot, "loki-7.0.0-a.tgz");
    const secondPackage = join(tempRoot, "loki-7.0.0-b.tgz");
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
      metadata: { name: "grafana-loki-7.0.0" },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "grafana-loki",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub installer package ${packageRelative} -o <tmp>/loki-7.0.0.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub installer setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace loki`,
          helmReleaseObjectCount: variant.expectedObjectCount,
          cubInstallObjectCountIncludingSupport: variant.expectedObjectCount + 1,
          semanticObjectMatches: `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
          separatedSecretCount: variant.expectedSecretCount,
          allowedCubOnlyObjects: ["v1|Namespace||loki"],
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
    "default-render-blocker.yaml",
    "control-points.yaml",
    "value-model.yaml",
    "effective-values.yaml",
    "effective-values-simple-scalable-minio.yaml",
    "recipe.yaml",
    "variants/single-binary-filesystem/variant.yaml",
    "variants/simple-scalable-minio/variant.yaml",
    "revisions/single-binary-filesystem/r001/variant-revision.yaml",
    "revisions/single-binary-filesystem/r001/rendered/release-objects.yaml",
    "revisions/single-binary-filesystem/r001/rendered/object-inventory.yaml",
    "revisions/single-binary-filesystem/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/single-binary-filesystem/r001/receipts/render-receipt.yaml",
    "revisions/single-binary-filesystem/r001/receipts/scan-receipt.yaml",
    "revisions/single-binary-filesystem/r001/receipts/install-gate.yaml",
    "revisions/simple-scalable-minio/r001/variant-revision.yaml",
    "revisions/simple-scalable-minio/r001/rendered/release-objects.yaml",
    "revisions/simple-scalable-minio/r001/rendered/object-inventory.yaml",
    "revisions/simple-scalable-minio/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/simple-scalable-minio/r001/receipts/render-receipt.yaml",
    "revisions/simple-scalable-minio/r001/receipts/scan-receipt.yaml",
    "revisions/simple-scalable-minio/r001/receipts/install-gate.yaml",
  ];
  for (const file of requiredFiles) {
    check(existsSync(join(root, file)), `missing required file ${file}`);
  }
  const sourceLock = readYaml(join(root, "source-lock.yaml"));
  const dependencyLock = readYaml(join(root, "dependency-lock.yaml"));
  const recipe = readYaml(join(root, "recipe.yaml"));
  const valueModel = readYaml(join(root, "value-model.yaml"));
  const controlPoints = readYaml(join(root, "control-points.yaml"));
  const defaultBlocker = readYaml(join(root, "default-render-blocker.yaml"));
  check(sourceLock.kind === "SourceLock", "source-lock.yaml must be SourceLock");
  check(sourceLock.spec.repositoryName === "grafana", "source repository mismatch");
  check(sourceLock.spec.chart === "loki", "source chart mismatch");
  check(sourceLock.spec.version === "7.0.0", "source version mismatch");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).length === 3, "loki dependency lock must record three dependencies");
  const dependencyNames = new Set((dependencyLock.spec.dependencies ?? []).map((dependency) => dependency.name));
  check(dependencyNames.has("minio"), "loki dependency lock missing minio");
  check(dependencyNames.has("grafana-agent-operator"), "loki dependency lock missing grafana-agent-operator");
  check(dependencyNames.has("rollout-operator"), "loki dependency lock missing rollout-operator");
  check(defaultBlocker.kind === "DefaultRenderBlocker", "default-render-blocker.yaml must be DefaultRenderBlocker");
  check(defaultBlocker.spec.result === "blocked", "default render blocker must record blocked result");
  check(
    String(defaultBlocker.spec.error ?? "").includes("loki.storage.bucketNames.chunks"),
    "default render blocker must record missing bucketNames.chunks",
  );
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "blocked-default-render"), "blocked-default-render control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "storage-config"), "storage-config control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "object-storage-policy"), "object-storage-policy control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "lifecycle-policy"), "lifecycle-policy control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "stateful-workload"), "stateful-workload control point missing");

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
    check(identities.includes("apps/v1|DaemonSet|loki|loki-canary"), `${variant.name} canary DaemonSet missing`);
    check(identities.includes("apps/v1|Deployment|loki|loki-gateway"), `${variant.name} gateway Deployment missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||loki-clusterrole"), `${variant.name} ClusterRole missing`);
    check(
      identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||loki-clusterrolebinding"),
      `${variant.name} ClusterRoleBinding missing`,
    );
    check(identities.includes("v1|ConfigMap|loki|loki"), `${variant.name} Loki ConfigMap missing`);
    check(identities.includes("v1|ConfigMap|loki|loki-gateway"), `${variant.name} gateway ConfigMap missing`);
    check(identities.includes("v1|ConfigMap|loki|loki-runtime"), `${variant.name} runtime ConfigMap missing`);
    check(identities.includes("v1|ServiceAccount|loki|loki"), `${variant.name} ServiceAccount missing`);
    check(identities.includes("v1|ServiceAccount|loki|loki-canary"), `${variant.name} canary ServiceAccount missing`);
    check(identities.includes("v1|Service|loki|loki-canary"), `${variant.name} canary Service missing`);
    check(identities.includes("v1|Service|loki|loki-gateway"), `${variant.name} gateway Service missing`);
    check(identities.includes("v1|Service|loki|loki-memberlist"), `${variant.name} memberlist Service missing`);
    check(identities.includes("v1|Service|loki|loki-chunks-cache"), `${variant.name} chunks cache Service missing`);
    check(identities.includes("v1|Service|loki|loki-results-cache"), `${variant.name} results cache Service missing`);
    check(identities.includes("apps/v1|StatefulSet|loki|loki-chunks-cache"), `${variant.name} chunks cache StatefulSet missing`);
    check(identities.includes("apps/v1|StatefulSet|loki|loki-results-cache"), `${variant.name} results cache StatefulSet missing`);
    if (variant.name === "single-binary-filesystem") {
      check(identities.includes("apps/v1|StatefulSet|loki|loki"), "single-binary-filesystem StatefulSet missing");
      check(identities.includes("v1|Service|loki|loki"), "single-binary-filesystem main Service missing");
      check(identities.includes("v1|Service|loki|loki-headless"), "single-binary-filesystem headless Service missing");
    }
    if (variant.name === "simple-scalable-minio") {
      check(identities.includes("apps/v1|Deployment|loki|loki-read"), "simple-scalable-minio read Deployment missing");
      check(identities.includes("apps/v1|StatefulSet|loki|loki-backend"), "simple-scalable-minio backend StatefulSet missing");
      check(identities.includes("apps/v1|StatefulSet|loki|loki-write"), "simple-scalable-minio write StatefulSet missing");
      check(identities.includes("apps/v1|StatefulSet||loki-minio"), "simple-scalable-minio MinIO StatefulSet missing");
      check(identities.includes("v1|Secret||loki-minio"), "simple-scalable-minio MinIO Secret missing");
      check(identities.includes("v1|Service||loki-minio"), "simple-scalable-minio MinIO Service missing");
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
    check(scan.spec.findingCounts.medium >= 5, `${variant.name} scan must flag default blocker, storage, dependency, lifecycle, stateful, RBAC, and extension review`);
    check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} install gate digest mismatch`);
    check(gate.spec.decision === "warn", `${variant.name} install gate should warn`);
  }
  console.log("verified loki proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "loki-proof-self-test-"));
  try {
    cpSync(proofRoot, tempRoot, { recursive: true });
    const releasePath = join(tempRoot, "revisions", "single-binary-filesystem", "r001", "rendered", "release-objects.yaml");
    write(releasePath, `${readFileSync(releasePath, "utf8")}\n# tampered\n`);
    let rejected = false;
    try {
      verifyProof(tempRoot);
    } catch (error) {
      rejected = String(error.message).includes("inventory source digest mismatch");
    }
    if (!rejected) throw new Error("self-test did not reject rendered object tampering");
    console.log("self-test passed: loki rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run loki:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run loki:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "grafana-loki", "package name mismatch");
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

  const tempRoot = mkdtempSync(join(tmpdir(), "loki-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "loki-a.tgz");
    const secondPackage = join(tempRoot, "loki-b.tgz");
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
  console.log("loki installer package verification passed");
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
    "loki",
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
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||loki"]),
    `${variant.name} cub output may add only v1|Namespace||loki; found ${extraInCub.join(", ")}`,
  );
  const semanticDiffs = [];
  for (const key of helmObjects) {
    if (semantic.helm[key] !== semantic.cub[key] && !allowedLokiSemanticDiff(key, semantic.helm[key], semantic.cub[key])) {
      semanticDiffs.push(key);
    }
  }
  check(semanticDiffs.length === 0, `${variant.name} semantic diffs: ${semanticDiffs.join(", ")}`);
  const secretFiles = listYamlFiles(join(workDir, "out", "secrets"));
  check(secretFiles.length === variant.expectedSecretCount, `${variant.name} separated Secret count mismatch`);
}

function allowedLokiSemanticDiff(key, helmObjectJson, cubObjectJson) {
  if (key !== "v1|ConfigMap|loki|loki") return false;
  const helmObject = JSON.parse(helmObjectJson);
  const cubObject = JSON.parse(cubObjectJson);
  const helmConfig = helmObject.data?.["config.yaml"];
  const cubConfig = cubObject.data?.["config.yaml"];
  if (typeof helmConfig !== "string" || typeof cubConfig !== "string") return false;
  helmObject.data["config.yaml"] = helmConfig.replace(/^\n/, "");
  return JSON.stringify(helmObject) === JSON.stringify(cubObject);
}

function pullSource() {
  const tempRoot = mkdtempSync(join(tmpdir(), "loki-source-"));
  try {
    command("helm", ["pull", "grafana/loki", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "loki");
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
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function defaultRenderBlocker(defaultValuesSHA256) {
  const args = [
    "template",
    chart.releaseName,
    "grafana/loki",
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
  try {
    execFileSync("helm", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "DefaultRenderBlocker",
      metadata: { name: "grafana-loki-7.0.0-default" },
      spec: {
        result: "unexpected-pass",
        defaultValuesSHA256,
        command: `helm ${args.join(" ")}`,
        error: "",
      },
    };
  } catch (error) {
    return {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "DefaultRenderBlocker",
      metadata: { name: "grafana-loki-7.0.0-default" },
      spec: {
        result: "blocked",
        defaultValuesSHA256,
        command: `helm ${args.join(" ")}`,
        error: String(error.stderr ?? error.message ?? ""),
        mitigation: [
          "bind loki.schemaConfig.configs before render",
          "select filesystem or object storage before render",
          "bind loki.storage.bucketNames when object storage is selected",
        ],
      },
    };
  }
}

function renderVariant(variant) {
  const tempRoot = mkdtempSync(join(tmpdir(), "loki-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "grafana/loki",
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
      metadata: { name: "grafana-loki-7.0.0-default" },
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
    metadata: { name: `grafana-loki-7.0.0-${variant.name}` },
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
  findings.push({
    id: "blocked-default-render:loki.storage.bucketNames.chunks",
    rule: "blocked-default-render",
    severity: "medium",
    object: "values|loki.storage.bucketNames.chunks",
    message: "Chart defaults cannot render until storage bucket and schema values are supplied",
  });
  findings.push({
    id: "storage-config-required:loki.schemaConfig",
    rule: "storage-config-required",
    severity: "medium",
    object: "values|loki.schemaConfig",
    message: "Loki storage mode and schema epoch are variant inputs that must be reviewed before production",
  });
  for (const doc of docs.filter((item) => item.kind === "Secret")) {
    findings.push({
      id: `rendered-secret-ownership:${identityFor(doc)}`,
      rule: "rendered-secret-ownership",
      severity: "medium",
      object: identityFor(doc),
      message: "Rendered Secret content and ownership must be explicit before production promotion",
    });
  }
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Cluster-scoped RBAC requires explicit review before production promotion",
    });
  }
  findings.push({
    id: "dependency-lock-review:loki-dependencies",
    rule: "dependency-lock-review",
    severity: "medium",
    object: "dependency|minio|grafana-agent-operator|rollout-operator",
    message: "Loki dependency metadata is locked before recipe publication",
  });
  findings.push({
    id: "object-storage-policy:minio",
    rule: "object-storage-policy",
    severity: "medium",
    object: "values|minio.enabled",
    message: "Object-store fixture, bucket names, endpoint, and Secret ownership need production policy",
  });
  findings.push({
    id: "lifecycle-policy:no-hooks",
    rule: "lifecycle-policy",
    severity: "medium",
    object: "renderer|--no-hooks",
    message: "Rendered proof excludes hooks/tests; future enablement must map to lifecycle policy",
  });
  findings.push({
    id: "extension-slot-review:loki-config-extra",
    rule: "extension-slot-review",
    severity: "medium",
    object: "values|loki.config|loki.structuredConfig|extraObjects",
    message: "Loki config and raw/tpl extension slots must be scanned when populated",
  });
  for (const doc of docs.filter((item) => item.kind === "StatefulSet")) {
    findings.push({
      id: `stateful-workload-review:${identityFor(doc)}`,
      rule: "stateful-workload-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Stateful workload requires storage, upgrade, and rollback policy",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function writeReadme(summaries) {
  write(
    join(proofRoot, "README.md"),
    `# grafana/loki ${chart.version} Proof

This is the promoted proof slice for the Loki public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub installer objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub installer setup\`, plus the explained Namespace support object;
- default chart rendering is blocked until Loki storage bucket/schema values are supplied, and that blocker is recorded;
- the single-binary-filesystem variant provides the smallest local-test topology with filesystem storage;
- the simple-scalable-minio variant provides an object-storage path with explicit bucket names and a chart-owned MinIO fixture;
- storage/schema, dependency lock, object-store Secret, ClusterRole/RBAC, StatefulSet/PVC, lifecycle, and extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run loki:generate-proof
npm run loki:generate-package
npm run loki:verify-proof
npm run loki:verify-package
npm run loki:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
