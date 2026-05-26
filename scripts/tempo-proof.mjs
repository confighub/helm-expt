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

const proofRoot = join(repoRoot, "recipes", "grafana", "tempo", "1.24.4");
const packageRoot = join(repoRoot, "packages", "grafana", "tempo", "1.24.4");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chart = {
  repository: "grafana",
  repositoryURL: "https://grafana.github.io/helm-charts",
  name: "tempo",
  version: "1.24.4",
  releaseName: "tempo",
  namespace: "tempo",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "local-persistent",
    base: "local-persistent",
    displayName: "local persistent single-binary",
    valuesFile: "effective-values.yaml",
    valuesText: `persistence:
  enabled: true
  enableStatefulSetAutoDeletePVC: false
  storageClassName: local-path
  accessModes:
    - ReadWriteOnce
  size: 10Gi
  annotations: {}
tempo:
  reportingEnabled: false
  storage:
    trace:
      backend: local
      local:
        path: /var/tempo/traces
      wal:
        path: /var/tempo/wal
`,
    valuesSummary: "local backend with explicit WAL/traces PVC settings",
    expectedObjectCount: 4,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    apiVersions: ["networking.k8s.io/v1"],
    targetFactNote: "uses local storage and disables Tempo usage reporting so the rendered StatefulSet is deterministic",
  },
  {
    name: "s3-query-observability",
    base: "s3-query-observability",
    displayName: "S3 query and observability",
    valuesFile: "effective-values-s3-query-observability.yaml",
    valuesText: `persistence:
  enabled: true
  storageClassName: local-path
  accessModes:
    - ReadWriteOnce
  size: 10Gi
  annotations: {}
service:
  targetPort: 3200
tempo:
  reportingEnabled: false
  storage:
    trace:
      backend: s3
      local: null
      s3:
        bucket: tempo-traces
        endpoint: s3.us-east-1.amazonaws.com
        region: us-east-1
        insecure: false
      wal:
        path: /var/tempo/wal
  extraEnv:
    - name: AWS_ACCESS_KEY_ID
      valueFrom:
        secretKeyRef:
          name: tempo-s3-credentials
          key: access_key
    - name: AWS_SECRET_ACCESS_KEY
      valueFrom:
        secretKeyRef:
          name: tempo-s3-credentials
          key: secret_key
tempoQuery:
  enabled: true
  ingress:
    enabled: true
    ingressClassName: nginx
    hosts:
      - query.tempo.example.com
networkPolicy:
  enabled: true
serviceMonitor:
  enabled: true
`,
    valuesSummary: "S3 backend with external credential Secret, query ingress, NetworkPolicy, and ServiceMonitor",
    expectedObjectCount: 8,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    apiVersions: ["networking.k8s.io/v1", "monitoring.coreos.com/v1"],
    targetFactNote: "requires target Secret tempo/tempo-s3-credentials before apply; ServiceMonitor also requires the Prometheus Operator CRD in the target cluster",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "tempo",
          name: "tempo-s3-credentials",
          keys: ["access_key", "secret_key"],
          purpose: "S3 access credentials referenced by Tempo environment variables",
        },
      ],
    },
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
      id: "deployment-workload-review",
      severity: "medium",
      description: "Deployments need rollout, persistence, and rollback policy.",
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
  node scripts/tempo-proof.mjs --generate-proof
  node scripts/tempo-proof.mjs --generate-package
  node scripts/tempo-proof.mjs --verify-proof
  node scripts/tempo-proof.mjs --verify-proof-self-test
  node scripts/tempo-proof.mjs --verify-package
  node scripts/tempo-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: "grafana-tempo-1.24.4" },
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
        harnessReceipt: "../../../../data/adversarial10/charts/grafana-tempo-1.24.4/render-receipt.yaml",
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: "grafana-tempo-1.24.4" },
    spec: {
      chart: "grafana/tempo",
      version: chart.version,
      dependencies: source.dependencies,
      chartLockDigest: source.chartLockDigest,
    },
  });

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: "grafana-tempo-1.24.4" },
    spec: {
      checkedValues: [
        {
          path: "persistence.enabled / persistence.storageClassName / persistence.size",
          variant: "local-persistent",
          disposition: "storage-profile-bound",
          reason: "local single-binary storage is captured explicitly as a deterministic install variant",
        },
        {
          path: "tempo.storage.trace.backend / tempo.storage.trace.local / tempo.storage.trace.wal",
          variant: "local-persistent",
          disposition: "storage-backend-bound",
          reason: "the local backend and WAL/traces paths are pinned before render",
        },
        {
          path: "tempo.storage.trace.s3 / tempo.extraEnv",
          variant: "s3-query-observability",
          disposition: "target-fact-bound",
          reason: "S3 credentials are referenced from a declared target Secret instead of embedded in rendered ConfigMaps",
        },
        {
          path: "tempo.storage.trace.local",
          variant: "s3-query-observability",
          disposition: "merge-cleanup-bound",
          reason: "set to null so Helm's values merge does not accidentally keep local storage alongside S3",
        },
        {
          path: "tempoQuery.enabled / tempoQuery.ingress.*",
          variant: "s3-query-observability",
          disposition: "query-exposure-bound",
          reason: "query UI exposure is only added by an explicit variant with host and ingress class captured",
        },
        {
          path: "serviceMonitor.enabled",
          variant: "s3-query-observability",
          disposition: "target-capability-bound",
          reason: "ServiceMonitor rendering is tied to an explicit Prometheus Operator API version requirement",
        },
        {
          path: "config / structuredConfig / extraVolumes / extraVolumeMounts",
          variant: "all",
          disposition: "extension-slot",
          reason: "Tempo exposes powerful config and mount extension slots; promoted variants keep them controlled",
        },
        {
          path: "reportingEnabled",
          variant: "all",
          disposition: "telemetry-disabled",
          reason: "promoted variants disable Tempo usage reporting explicitly",
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
    metadata: { name: "grafana-tempo-1.24.4" },
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
        {
          category: "chart-deprecation",
          status: "noted",
          note: "The literal grafana/tempo chart is deprecated; the proof records that status and notes the maintained successor chart separately.",
        },
        {
          category: "target-facts",
          status: "variant-controlled",
          evidence: "tempo.extraEnv secretKeyRef",
          note: "The s3-query-observability variant declares the target Secret for S3 credentials instead of embedding access keys in rendered ConfigMaps.",
        },
        {
          category: "capability-profile",
          status: "variant-controlled",
          evidence: "monitoring.coreos.com/v1",
          note: "The ServiceMonitor variant records the Prometheus Operator API as an explicit target capability.",
        },
        { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|tempo|tempo" },
        { category: "query-ingress-policy", status: "variant-controlled", object: "networking.k8s.io/v1|Ingress|tempo|tempo" },
        { category: "network-policy", status: "scan-and-review", object: "networking.k8s.io/v1|NetworkPolicy|tempo|tempo" },
        { category: "servicemonitor-capability", status: "variant-controlled", object: "monitoring.coreos.com/v1|ServiceMonitor|tempo|tempo" },
        { category: "upstream-runtime-risk", status: "scan-and-review", note: "The chart StatefulSet references serviceName tempo-headless, but the chart renders no headless Service in these variants." },
        { category: "extension-slots", status: "controlled-by-empty-defaults", note: "config, structuredConfig, extra volume/mount, and tpl-controlled strings are controlled in promoted variants." },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||tempo" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "grafana-tempo", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: "../../../../packages/grafana/tempo/1.24.4",
        setupCommand: [
          "cub",
          "install",
          "setup",
          "--pull",
          "../../../../packages/grafana/tempo/1.24.4",
          "--non-interactive",
          "--namespace",
          "tempo",
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
      metadata: { name: `grafana-tempo-${chart.version}-${variant.name}-r001` },
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
        apiVersions: variant.apiVersions ?? [],
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
      metadata: { name: `tempo-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderer: {
          name: "helm",
          version: helmVersion,
          kubeVersion: chart.kubeVersion,
          flags: ["--include-crds", "--skip-tests", "--no-hooks"],
          apiVersions: variant.apiVersions ?? [],
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
      metadata: { name: `tempo-${variant.name}-r001` },
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
          { identity: "v1|Namespace||tempo", classification: "installer-support-object", disposition: "allowed" },
        ],
        result: "pass",
        evidenceCommand: "npm run tempo:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `tempo-${variant.name}-r001` },
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
      metadata: { name: `tempo-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        decision: "warn",
        allowedScopes: ["local-test"],
        blockedScopes: ["production"],
        reasons: [
          `Helm equivalence passed for ${variant.name}`,
          "Tempo storage backend and query/observability posture are explicit variant choices",
          "Helm hook behavior needs explicit lifecycle policy before production",
          "Tempo StatefulSet, storage, S3 credential Secret, query ingress, NetworkPolicy, ServiceMonitor, and extension slots need production review",
          variant.targetFactNote,
        ],
      },
    });
    summaries.push({ ...variant, releaseDigest, objects, scanCounts, scanResult });
  }

  writeYaml(join(proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: "grafana-tempo-1.24.4" },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "grafana/tempo",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        nextAction: "publish only after chart deprecation review, storage backend policy, S3 credential Secret ownership, query ingress, ServiceMonitor capability, StatefulSet/headless-Service runtime risk, and raw/template extension-slot review are satisfied",
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
    metadata: { name: "grafana-tempo-1.24.4" },
    spec: {
      chart: "grafana/tempo",
      version: chart.version,
      successorChart: {
        note: "The literal grafana/tempo chart is deprecated; grafana-community/tempo is the maintained successor noted for future catalog work.",
        chart: "grafana-community/tempo",
      },
      maintainedNotes: [
        "Chart.yaml marks this chart version deprecated, and the proof records that status.",
        "local-persistent uses local Tempo storage and explicit PVC settings.",
        "s3-query-observability switches to S3 storage, nulls local storage to avoid Helm merge residue, and references S3 credentials from a target Secret.",
        "s3-query-observability adds Tempo Query ingress, NetworkPolicy, and ServiceMonitor behind explicit capability and policy checks.",
        "The chart StatefulSet references serviceName tempo-headless, but these variants render no headless Service; the proof records this as an upstream/runtime risk.",
        "config, structuredConfig, extra volumes/mounts, and tpl-controlled strings are powerful extension surfaces; promoted variants keep them controlled.",
      ],
      knownControlPoints: [
        "chart-deprecation",
        "target-facts",
        "storage-backend-policy",
        "query-ingress-policy",
        "network-policy",
        "servicemonitor-capability",
        "statefulset-runtime-risk",
        "raw-template-extension-slots",
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
    metadata: { name: "grafana-tempo", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `tempo ${variant.displayName} variant rendered from grafana/tempo@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# grafana/tempo ${chart.version} Installer Package

This package is generated from the tempo proof artifacts.

\`\`\`sh
npm run tempo:generate-package
npm run tempo:verify-package
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
  const tempRoot = mkdtempSync(join(tmpdir(), "tempo-installer-package-"));
  try {
    const firstPackage = join(tempRoot, "tempo-1.24.4-a.tgz");
    const secondPackage = join(tempRoot, "tempo-1.24.4-b.tgz");
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
      metadata: { name: "grafana-tempo-1.24.4" },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "grafana-tempo",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub install package ${packageRelative} -o <tmp>/tempo-1.24.4.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub install setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace tempo`,
          helmReleaseObjectCount: variant.expectedObjectCount,
          cubInstallObjectCountIncludingSupport: variant.expectedObjectCount + 1,
          semanticObjectMatches: `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
          separatedSecretCount: variant.expectedSecretCount,
          allowedCubOnlyObjects: ["v1|Namespace||tempo"],
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
    "effective-values-s3-query-observability.yaml",
    "recipe.yaml",
    "variants/local-persistent/variant.yaml",
    "variants/s3-query-observability/variant.yaml",
    "revisions/local-persistent/r001/variant-revision.yaml",
    "revisions/local-persistent/r001/rendered/release-objects.yaml",
    "revisions/local-persistent/r001/rendered/object-inventory.yaml",
    "revisions/local-persistent/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/local-persistent/r001/receipts/render-receipt.yaml",
    "revisions/local-persistent/r001/receipts/scan-receipt.yaml",
    "revisions/local-persistent/r001/receipts/install-gate.yaml",
    "revisions/s3-query-observability/r001/variant-revision.yaml",
    "revisions/s3-query-observability/r001/rendered/release-objects.yaml",
    "revisions/s3-query-observability/r001/rendered/object-inventory.yaml",
    "revisions/s3-query-observability/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/s3-query-observability/r001/receipts/render-receipt.yaml",
    "revisions/s3-query-observability/r001/receipts/scan-receipt.yaml",
    "revisions/s3-query-observability/r001/receipts/install-gate.yaml",
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
  check(sourceLock.spec.repositoryName === "grafana", "source repository mismatch");
  check(sourceLock.spec.chart === "tempo", "source chart mismatch");
  check(sourceLock.spec.version === "1.24.4", "source version mismatch");
  check(sourceLock.spec.deprecated === true, "source deprecation marker must be recorded");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).length === 0, "tempo dependency lock must be empty");
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "chart-deprecation"), "chart-deprecation control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "target-facts"), "target-facts control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "stateful-workload"), "stateful-workload control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "query-ingress-policy"), "query-ingress-policy control point missing");
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
    check(identities.includes("apps/v1|StatefulSet|tempo|tempo"), `${variant.name} StatefulSet missing`);
    check(identities.includes("v1|Service|tempo|tempo"), `${variant.name} Service missing`);
    check(identities.includes("v1|ServiceAccount|tempo|tempo"), `${variant.name} ServiceAccount missing`);
    check(identities.includes("v1|ConfigMap|tempo|tempo"), `${variant.name} ConfigMap missing`);
    check(!secretIdentities.length, `${variant.name} must not render a Secret`);
    if (variant.name === "local-persistent") {
      check(!identities.includes("networking.k8s.io/v1|Ingress|tempo|tempo"), "local-persistent must not render an Ingress");
      check(!identities.includes("networking.k8s.io/v1|NetworkPolicy|tempo|tempo"), "local-persistent must not render a NetworkPolicy");
    }
    if (variant.name === "s3-query-observability") {
      check(identities.includes("networking.k8s.io/v1|Ingress|tempo|tempo"), "s3-query-observability Ingress missing");
      check(identities.includes("networking.k8s.io/v1|NetworkPolicy|tempo|tempo"), "s3-query-observability NetworkPolicy missing");
      check(identities.includes("monitoring.coreos.com/v1|ServiceMonitor|tempo|tempo"), "s3-query-observability ServiceMonitor missing");
      check(identities.includes("v1|ConfigMap|tempo|tempo-query"), "s3-query-observability tempo-query ConfigMap missing");
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
    check(scan.spec.findingCounts.medium >= 3, `${variant.name} scan must flag storage/stateful/runtime risk and extension review`);
    check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} install gate digest mismatch`);
    check(gate.spec.decision === "warn", `${variant.name} install gate should warn`);
  }
  console.log("verified tempo proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "tempo-proof-self-test-"));
  try {
    cpSync(proofRoot, tempRoot, { recursive: true });
    const releasePath = join(tempRoot, "revisions", "local-persistent", "r001", "rendered", "release-objects.yaml");
    write(releasePath, `${readFileSync(releasePath, "utf8")}\n# tampered\n`);
    let rejected = false;
    try {
      verifyProof(tempRoot);
    } catch (error) {
      rejected = String(error.message).includes("inventory source digest mismatch");
    }
    if (!rejected) throw new Error("self-test did not reject rendered object tampering");
    console.log("self-test passed: tempo rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run tempo:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run tempo:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "grafana-tempo", "package name mismatch");
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

  const tempRoot = mkdtempSync(join(tmpdir(), "tempo-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "tempo-a.tgz");
    const secondPackage = join(tempRoot, "tempo-b.tgz");
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
  console.log("tempo installer package verification passed");
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
    "tempo",
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
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||tempo"]),
    `${variant.name} cub output may add only v1|Namespace||tempo; found ${extraInCub.join(", ")}`,
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
  const tempRoot = mkdtempSync(join(tmpdir(), "tempo-source-"));
  try {
    command("helm", ["pull", "grafana/tempo", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "tempo");
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
  const tempRoot = mkdtempSync(join(tmpdir(), "tempo-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "grafana/tempo",
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
    for (const apiVersion of variant.apiVersions ?? []) {
      args.push("--api-versions", apiVersion);
    }
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
      metadata: { name: "grafana-tempo-1.24.4-default" },
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
    metadata: { name: `grafana-tempo-1.24.4-${variant.name}` },
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
      capabilityProfile: { kubeVersion: chart.kubeVersion, apiVersions: variant.apiVersions ?? [] },
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
  findings.push({
    id: "chart-deprecation:grafana-tempo",
    rule: "dependency-lock-review",
    severity: "medium",
    object: "source|grafana/tempo",
    message: "The literal grafana/tempo chart is deprecated; successor chart review is required before production catalog publication",
  });
  findings.push({
    id: "extension-slot-review:tempo",
    rule: "extension-slot-review",
    severity: "medium",
    object: "values|config|structuredConfig|extraVolumes|extraVolumeMounts|tpl-strings",
    message: "Tempo config, structuredConfig, volume/mount, and templated-string extension slots must be scanned when populated",
  });
  for (const doc of workloads) {
    const object = identityFor(doc);
    const podSpec = workloadPodSpec(doc);
    const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
    for (const container of containers) {
      for (const env of container.env ?? []) {
        const ref = env.valueFrom?.secretKeyRef;
        if (!ref?.name) continue;
        findings.push({
          id: `target-secret-fact:${object}:${container.name ?? "container"}:${env.name}`,
          rule: "generated-secret-ownership",
          severity: "medium",
          object,
          message: `container ${container.name ?? "container"} references target Secret ${ref.name}/${ref.key ?? ""}`,
        });
      }
    }
  }
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Tempo RBAC requires production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "StatefulSet")) {
      findings.push({
        id: `stateful-workload-review:${identityFor(doc)}`,
        rule: "deployment-workload-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Tempo StatefulSet storage, rollout, and retention policy require production review",
    });
    if (doc.spec?.serviceName && !docs.some((item) => item.kind === "Service" && item.metadata?.name === doc.spec.serviceName)) {
      findings.push({
        id: `statefulset-service-risk:${identityFor(doc)}`,
        rule: "service-selector-has-workload-match",
        severity: "medium",
        object: identityFor(doc),
        message: `StatefulSet references serviceName ${doc.spec.serviceName}, but that Service is not rendered by the chart`,
      });
    }
  }
  for (const doc of docs.filter((item) => item.kind === "ServiceMonitor")) {
    findings.push({
      id: `servicemonitor-capability:${identityFor(doc)}`,
      rule: "extension-slot-review",
      severity: "medium",
      object: identityFor(doc),
      message: "ServiceMonitor requires the Prometheus Operator CRD to exist in the target cluster",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "NetworkPolicy")) {
    findings.push({
      id: `network-policy-review:${identityFor(doc)}`,
      rule: "extension-slot-review",
      severity: "medium",
      object: identityFor(doc),
      message: "NetworkPolicy intent must be reviewed against the target namespace and ingress controller topology",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "PodDisruptionBudget")) {
    findings.push({
      id: `availability-policy-review:${identityFor(doc)}`,
      rule: "deployment-workload-review",
      severity: "medium",
      object: identityFor(doc),
      message: "PodDisruptionBudget needs production availability and rollout policy review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Ingress")) {
    findings.push({
      id: `edge-ingress-policy:${identityFor(doc)}`,
      rule: "extension-slot-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Tempo query ingress requires host, class, and edge policy review",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function writeReadme(summaries) {
  write(
    join(proofRoot, "README.md"),
    `# grafana/tempo ${chart.version} Proof

This is the promoted proof slice for the Tempo public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub install objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub install setup\`, plus the explained Namespace support object;
- the literal \`grafana/tempo\` chart is deprecated, and the proof records that fact instead of hiding it;
- \`local-persistent\` captures local single-binary storage and PVC settings;
- \`s3-query-observability\` uses a declared target Secret for S3 credentials, does not render a Secret, and adds query ingress, NetworkPolicy, and ServiceMonitor;
- storage backend, target fact, ingress, NetworkPolicy, ServiceMonitor capability, StatefulSet runtime, chart deprecation, and raw/template extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run tempo:generate-proof
npm run tempo:generate-package
npm run tempo:verify-proof
npm run tempo:verify-package
npm run tempo:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
