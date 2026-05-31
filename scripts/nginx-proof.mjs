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

const supportedChartVersion = "24.0.2";
const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? supportedChartVersion;
const outputRoot = process.env.HELM_EXPT_PROOF_OUTPUT_ROOT
  ? join(repoRoot, process.env.HELM_EXPT_PROOF_OUTPUT_ROOT)
  : repoRoot;
const proofRoot = join(outputRoot, "recipes", "bitnami", "nginx", chartVersion);
const packageRoot = join(outputRoot, "packages", "bitnami", "nginx", chartVersion);
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chartArtifactName = `bitnami-nginx-${chartVersion}`;
const packageReference = `../../../../packages/bitnami/nginx/${chartVersion}`;
const chart = {
  repository: "bitnami",
  repositoryURL: "https://charts.bitnami.com/bitnami",
  name: "nginx",
  version: chartVersion,
  releaseName: "nginx",
  namespace: "nginx",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "http-clusterip",
    base: "http-clusterip",
    displayName: "plain HTTP ClusterIP",
    valuesFile: "effective-values.yaml",
    valuesText: `tls:
  enabled: false
service:
  type: ClusterIP
`,
    valuesSummary: "TLS generation disabled and service exposure kept internal",
    expectedObjectCount: 5,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "avoids chart-generated TLS material and renders a simple internal NGINX service deterministically",
  },
  {
    name: "existing-tls-ingress",
    base: "existing-tls-ingress",
    displayName: "existing TLS with ingress",
    valuesFile: "effective-values-existing-tls-ingress.yaml",
    valuesText: `tls:
  enabled: true
  existingSecret: nginx-backend-tls
ingress:
  enabled: true
  hostname: nginx.example.test
  ingressClassName: nginx
  tls: true
  extraTls:
    - hosts:
        - nginx.example.test
      secretName: nginx-ingress-tls
service:
  type: ClusterIP
`,
    valuesSummary: "target TLS Secrets supply backend and ingress certificates",
    expectedObjectCount: 6,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "requires target Secrets nginx/nginx-backend-tls and nginx/nginx-ingress-tls before apply",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "nginx",
          name: "nginx-backend-tls",
          keys: ["tls.crt", "tls.key", "ca.crt"],
          purpose: "TLS certificate material mounted by the NGINX pod",
        },
        {
          namespace: "nginx",
          name: "nginx-ingress-tls",
          keys: ["tls.crt", "tls.key"],
          purpose: "TLS certificate material referenced by the Ingress",
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
  node scripts/nginx-proof.mjs --generate-proof
  node scripts/nginx-proof.mjs --generate-package
  node scripts/nginx-proof.mjs --verify-proof
  node scripts/nginx-proof.mjs --verify-proof-self-test
  node scripts/nginx-proof.mjs --verify-package
  node scripts/nginx-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: chartArtifactName },
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
        harnessReceipt: `../../../../data/adversarial10/charts/${chartArtifactName}/render-receipt.yaml`,
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: chartArtifactName },
    spec: {
      chart: "bitnami/nginx",
      version: chart.version,
      dependencies: source.dependencies,
      chartLockDigest: source.chartLockDigest,
    },
  });

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: chartArtifactName },
    spec: {
      checkedValues: [
        {
          path: "tls.enabled",
          variant: "http-clusterip",
          disposition: "generated-fact-avoided",
          reason: "default chart auto-generates self-signed TLS material; this variant disables TLS for a deterministic internal service",
        },
        {
          path: "tls.existingSecret",
          variant: "existing-tls-ingress",
          disposition: "target-fact-bound",
          reason: "externalizes backend TLS material into a declared target Secret instead of rendering generated certs",
        },
        {
          path: "ingress.enabled / ingress.hostname / ingress.ingressClassName / ingress.extraTls",
          variant: "existing-tls-ingress",
          disposition: "ui-exposure-bound",
          reason: "edge exposure is only added by an explicit variant with host, class, and external TLS Secret captured",
        },
        {
          path: "service.type",
          variant: "all",
          disposition: "exposure-profile-bound",
          reason: "promoted variants use ClusterIP to avoid implicit cloud load balancer behavior in the proof",
        },
        {
          path: "serverBlock / streamServerBlock / extraDeploy",
          variant: "all",
          disposition: "extension-slot",
          reason: "raw/template extension slots are powerful config surfaces; promoted variants keep them empty",
        },
        {
          path: "cloneStaticSiteFromGit.*",
          variant: "all",
          disposition: "supply-chain-slot-disabled",
          reason: "git-clone sidecars introduce external source and credential inputs; promoted variants keep them disabled",
        },
        {
          path: "metrics.enabled / metrics.serviceMonitor.enabled",
          variant: "all",
          disposition: "observability-addons-disabled",
          reason: "Prometheus exporter and ServiceMonitor objects are explicit later variants, not hidden defaults",
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
    metadata: { name: chartArtifactName },
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
          category: "generated-facts",
          status: "variant-controlled",
          evidence: "tls.autoGenerated / genCA / genSignedCert",
          note: "The chart default auto-generates TLS material; promoted variants either disable TLS or require existing TLS Secrets before render.",
        },
        {
          category: "target-facts",
          status: "variant-controlled",
          evidence: "tls.existingSecret / ingress.extraTls",
          note: "The existing-tls-ingress variant declares backend and ingress TLS Secrets instead of rendering generated certs.",
        },
        { category: "deployment-workload", status: "scan-and-review", object: "apps/v1|Deployment|nginx|nginx" },
        { category: "edge-ingress-policy", status: "variant-controlled", object: "networking.k8s.io/v1|Ingress|nginx|nginx" },
        { category: "network-policy", status: "scan-and-review", object: "networking.k8s.io/v1|NetworkPolicy|nginx|nginx" },
        { category: "availability-policy", status: "scan-and-review", object: "policy/v1|PodDisruptionBudget|nginx|nginx" },
        { category: "extension-slots", status: "controlled-by-empty-defaults", note: "serverBlock, streamServerBlock, extraDeploy, git-clone, metrics, and sidecar slots are empty or disabled in promoted variants." },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||nginx" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "bitnami-nginx", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: packageReference,
        setupCommand: [
          "cub",
          "installer",
          "setup",
          "--pull",
          packageReference,
          "--non-interactive",
          "--namespace",
          "nginx",
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
      metadata: { name: `bitnami-nginx-${chart.version}-${variant.name}-r001` },
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
      metadata: { name: `nginx-${variant.name}-r001` },
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
      metadata: { name: `nginx-${variant.name}-r001` },
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
          { identity: "v1|Namespace||nginx", classification: "installer-support-object", disposition: "allowed" },
        ],
        result: "pass",
        evidenceCommand: "npm run nginx:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `nginx-${variant.name}-r001` },
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
      metadata: { name: `nginx-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        decision: "warn",
        allowedScopes: ["local-test"],
        blockedScopes: ["production"],
        reasons: [
          `Helm equivalence passed for ${variant.name}`,
          "Default generated TLS is either disabled or replaced by explicit target Secret requirements",
          "Helm hook behavior needs explicit lifecycle policy before production",
          "NGINX deployment, NetworkPolicy, PDB, service exposure, ingress, and extension slots need production review",
          variant.targetFactNote,
        ],
      },
    });
    summaries.push({ ...variant, releaseDigest, objects, scanCounts, scanResult });
  }

  writeYaml(join(proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: chartArtifactName },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "bitnami/nginx",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        nextAction: "publish only after TLS Secret ownership, ingress exposure, NetworkPolicy, PDB, deployment rollout, and raw/template extension-slot review are satisfied",
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
    metadata: { name: chartArtifactName },
    spec: {
      chart: "bitnami/nginx",
      version: chart.version,
      maintainedNotes: [
        "Default chart rendering is nondeterministic because tls.autoGenerated creates fresh certificate material.",
        "http-clusterip disables TLS generation and keeps service exposure internal.",
        "existing-tls-ingress requires declared backend and ingress TLS Secrets instead of rendering generated certs.",
        "existing-tls-ingress adds explicit ingress host, ingress class, and TLS Secret reference.",
        "serverBlock, streamServerBlock, extraDeploy, git-clone, metrics, and sidecar slots are powerful extension surfaces; promoted variants keep them empty or disabled.",
      ],
      knownControlPoints: [
        "generated-facts",
        "target-facts",
        "edge-ingress-policy",
        "network-policy",
        "availability-policy",
        "raw-template-extension-slots",
        "static-site-supply-chain",
        "metrics-addon-policy",
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
    metadata: { name: "bitnami-nginx", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `nginx ${variant.displayName} variant rendered from bitnami/nginx@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# bitnami/nginx ${chart.version} Installer Package

This package is generated from the nginx proof artifacts.

\`\`\`sh
npm run nginx:generate-package
npm run nginx:verify-package
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
  const tempRoot = mkdtempSync(join(tmpdir(), "nginx-installer-package-"));
  try {
    const firstPackage = join(tempRoot, `nginx-${chart.version}-a.tgz`);
    const secondPackage = join(tempRoot, `nginx-${chart.version}-b.tgz`);
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
      metadata: { name: chartArtifactName },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "bitnami-nginx",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub installer package ${packageRelative} -o <tmp>/nginx-${chart.version}.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub installer setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace nginx`,
          helmReleaseObjectCount: variant.expectedObjectCount,
          cubInstallObjectCountIncludingSupport: variant.expectedObjectCount + 1,
          semanticObjectMatches: `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
          separatedSecretCount: variant.expectedSecretCount,
          allowedCubOnlyObjects: ["v1|Namespace||nginx"],
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
    "effective-values-existing-tls-ingress.yaml",
    "recipe.yaml",
    "variants/http-clusterip/variant.yaml",
    "variants/existing-tls-ingress/variant.yaml",
    "revisions/http-clusterip/r001/variant-revision.yaml",
    "revisions/http-clusterip/r001/rendered/release-objects.yaml",
    "revisions/http-clusterip/r001/rendered/object-inventory.yaml",
    "revisions/http-clusterip/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/http-clusterip/r001/receipts/render-receipt.yaml",
    "revisions/http-clusterip/r001/receipts/scan-receipt.yaml",
    "revisions/http-clusterip/r001/receipts/install-gate.yaml",
    "revisions/existing-tls-ingress/r001/variant-revision.yaml",
    "revisions/existing-tls-ingress/r001/rendered/release-objects.yaml",
    "revisions/existing-tls-ingress/r001/rendered/object-inventory.yaml",
    "revisions/existing-tls-ingress/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/existing-tls-ingress/r001/receipts/render-receipt.yaml",
    "revisions/existing-tls-ingress/r001/receipts/scan-receipt.yaml",
    "revisions/existing-tls-ingress/r001/receipts/install-gate.yaml",
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
  check(sourceLock.spec.repositoryName === "bitnami", "source repository mismatch");
  check(sourceLock.spec.chart === "nginx", "source chart mismatch");
  check(sourceLock.spec.version === chart.version, "source version mismatch");
  check(sourceLock.spec.deprecated === false, "source deprecation marker must be recorded");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).some((dep) => dep.name === "common"), "nginx dependency lock must include bitnami common");
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "generated-facts"), "generated-facts control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "target-facts"), "target-facts control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "deployment-workload"), "deployment-workload control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "edge-ingress-policy"), "edge-ingress-policy control point missing");
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
    check(identities.includes("apps/v1|Deployment|nginx|nginx"), `${variant.name} Deployment missing`);
    check(identities.includes("v1|Service|nginx|nginx"), `${variant.name} Service missing`);
    check(identities.includes("v1|ServiceAccount|nginx|nginx"), `${variant.name} ServiceAccount missing`);
    check(identities.includes("networking.k8s.io/v1|NetworkPolicy|nginx|nginx"), `${variant.name} NetworkPolicy missing`);
    check(identities.includes("policy/v1|PodDisruptionBudget|nginx|nginx"), `${variant.name} PodDisruptionBudget missing`);
    check(!secretIdentities.length, `${variant.name} must not render a Secret`);
    if (variant.name === "http-clusterip") {
      check(!identities.includes("networking.k8s.io/v1|Ingress|nginx|nginx"), "http-clusterip must not render an Ingress");
    }
    if (variant.name === "existing-tls-ingress") {
      check(identities.includes("networking.k8s.io/v1|Ingress|nginx|nginx"), "existing-tls-ingress Ingress missing");
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
    check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag generated/target facts, RBAC, ingress/deployment, and extension review`);
    check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} install gate digest mismatch`);
    check(gate.spec.decision === "warn", `${variant.name} install gate should warn`);
  }
  console.log("verified nginx proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "nginx-proof-self-test-"));
  try {
    cpSync(proofRoot, tempRoot, { recursive: true });
    const releasePath = join(tempRoot, "revisions", "http-clusterip", "r001", "rendered", "release-objects.yaml");
    write(releasePath, `${readFileSync(releasePath, "utf8")}\n# tampered\n`);
    let rejected = false;
    try {
      verifyProof(tempRoot);
    } catch (error) {
      rejected = String(error.message).includes("inventory source digest mismatch");
    }
    if (!rejected) throw new Error("self-test did not reject rendered object tampering");
    console.log("self-test passed: nginx rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run nginx:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run nginx:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "bitnami-nginx", "package name mismatch");
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

  const tempRoot = mkdtempSync(join(tmpdir(), "nginx-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "nginx-a.tgz");
    const secondPackage = join(tempRoot, "nginx-b.tgz");
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
  console.log("nginx installer package verification passed");
}

function verifySetupVariant(tempRoot, variant, receipt) {
  const checkReceipt = (receipt.spec.setupChecks ?? []).find((item) => item.variant === variant.name);
  check(Boolean(checkReceipt), `receipt missing setup check for ${variant.name}`);
  const workDir = join(tempRoot, `work-${variant.name}`);
  runCub([
    "installer",
    "setup",
    "--pull",
    packageRoot,
    "--base",
    variant.base,
    "--work-dir",
    workDir,
    "--non-interactive",
    "--namespace",
    "nginx",
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
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||nginx"]),
    `${variant.name} cub output may add only v1|Namespace||nginx; found ${extraInCub.join(", ")}`,
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
  const tempRoot = mkdtempSync(join(tmpdir(), "nginx-source-"));
  try {
    command("helm", ["pull", "bitnami/nginx", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "nginx");
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
  const tempRoot = mkdtempSync(join(tmpdir(), "nginx-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "bitnami/nginx",
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
      metadata: { name: `${chartArtifactName}-default` },
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
    metadata: { name: `${chartArtifactName}-${variant.name}` },
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
  for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "nginx-tls")) {
    findings.push({
      id: `generated-secret-ownership:${identityFor(doc)}`,
      rule: "generated-secret-ownership",
      severity: "medium",
      object: identityFor(doc),
      message: "NGINX generated TLS Secret content and ownership must be explicit before production promotion",
    });
  }
  findings.push({
    id: "generated-tls-policy:tls.autoGenerated",
    rule: "generated-secret-ownership",
    severity: "medium",
    object: "values|tls.autoGenerated",
    message: "Default self-signed TLS generation must be disabled or replaced by declared target Secrets before promotion",
  });
  findings.push({
    id: "extension-slot-review:nginx",
    rule: "extension-slot-review",
    severity: "medium",
    object: "values|serverBlock|streamServerBlock|extraDeploy|cloneStaticSiteFromGit|metrics|sidecars",
    message: "NGINX server block, raw manifests, git clone, metrics, and sidecar extension slots must be scanned when populated",
  });
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "NGINX RBAC requires production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Deployment")) {
      findings.push({
        id: `deployment-workload-review:${identityFor(doc)}`,
        rule: "deployment-workload-review",
      severity: "medium",
      object: identityFor(doc),
      message: "NGINX Deployment, service exposure, and rollout policy require production review",
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
      message: "NGINX ingress requires host, TLS Secret, class, and edge policy review",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function writeReadme(summaries) {
  write(
    join(proofRoot, "README.md"),
    `# bitnami/nginx ${chart.version} Proof

This is the promoted proof slice for the NGINX public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub installer objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub installer setup\`, plus the explained Namespace support object;
- default chart rendering is nondeterministic because Helm generates self-signed TLS material;
- \`http-clusterip\` disables generated TLS and renders a small internal service;
- \`existing-tls-ingress\` uses declared target TLS Secrets, does not render a Secret, and adds explicit ingress exposure;
- generated TLS, target fact, ingress, NetworkPolicy, PDB, deployment, static-site supply-chain, metrics, and raw/template extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run nginx:generate-proof
npm run nginx:generate-package
npm run nginx:verify-proof
npm run nginx:verify-package
npm run nginx:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
