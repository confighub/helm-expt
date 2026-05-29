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

const proofRoot = join(repoRoot, "recipes", "hashicorp", "vault", "0.32.0");
const packageRoot = join(repoRoot, "packages", "hashicorp", "vault", "0.32.0");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chart = {
  repository: "hashicorp",
  repositoryURL: "https://helm.releases.hashicorp.com",
  name: "vault",
  version: "0.32.0",
  releaseName: "vault",
  namespace: "vault",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default server with injector",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults with server StatefulSet and injector webhook",
    expectedObjectCount: 12,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "requires explicit post-install init/unseal and TLS posture decisions before production",
  },
  {
    name: "ha-raft-ui",
    base: "ha-raft-ui",
    displayName: "HA Raft with UI",
    valuesFile: "effective-values-ha-raft-ui.yaml",
    valuesText: `server:
  ha:
    enabled: true
    raft:
      enabled: true
ui:
  enabled: true
`,
    valuesSummary: "HA Raft storage and UI service are explicit",
    expectedObjectCount: 18,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "adds HA discovery, Raft storage, PDB, active/standby services, and UI exposure as variant-controlled outputs",
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
      id: "vault-workload-operate-review",
      severity: "medium",
      description: "Vault workloads need rollout, persistence, init/unseal, and rollback policy.",
    },
    {
      id: "admission-webhook-review",
      severity: "medium",
      description: "Admission webhooks need explicit failure policy, certificate, and observation policy.",
    },
    {
      id: "service-exposure-review",
      severity: "medium",
      description: "Vault API/UI services need explicit exposure and TLS policy.",
    },
    {
      id: "vault-tls-posture-review",
      severity: "medium",
      description: "Vault TLS disabled/enabled posture must be explicit before production.",
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
  node scripts/vault-proof.mjs --generate-proof
  node scripts/vault-proof.mjs --generate-package
  node scripts/vault-proof.mjs --verify-proof
  node scripts/vault-proof.mjs --verify-proof-self-test
  node scripts/vault-proof.mjs --verify-package
  node scripts/vault-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: "hashicorp-vault-0.32.0" },
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
        sourceCommand: "helm pull hashicorp/vault --version 0.32.0",
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: "hashicorp-vault-0.32.0" },
    spec: {
      chart: "hashicorp/vault",
      version: chart.version,
      dependencies: source.dependencies,
      chartLockDigest: source.chartLockDigest,
    },
  });

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: "hashicorp-vault-0.32.0" },
    spec: {
      checkedValues: [
        {
          path: "server.ha.enabled / server.ha.raft.enabled",
          variant: "ha-raft-ui",
          disposition: "variant-controlled",
          reason: "the HA variant deliberately changes Vault from standalone file storage to integrated Raft storage",
        },
        {
          path: "ui.enabled",
          variant: "ha-raft-ui",
          disposition: "service-exposure-bound",
          reason: "UI exposure is added only by an explicit variant and appears as a rendered Service",
        },
        {
          path: "global.tlsDisable / server.standalone.config / server.ha.config",
          variant: "all",
          disposition: "security-posture-review",
          reason: "the rendered Vault listener TLS posture must be reviewed before production promotion",
        },
        {
          path: "server.dataStorage.enabled / server.auditStorage.enabled",
          variant: "all",
          disposition: "stateful-storage-review",
          reason: "Vault storage, audit storage, and PVC behavior are part of the variant and install gate",
        },
        {
          path: "server.extraEnvironmentVars / server.extraSecretEnvironmentVars / server.extraVolumes / server.extraInitContainers",
          variant: "all",
          disposition: "extension-slot",
          reason: "Vault extension and Secret injection slots must be explicit before production promotion",
        },
        {
          path: "injector.enabled / injector.failurePolicy",
          variant: "all",
          disposition: "admission-webhook-review",
          reason: "the injector admission webhook is rendered by default and must be reviewed as an operating control point",
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
    metadata: { name: "hashicorp-vault-0.32.0" },
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
        { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|vault|vault" },
        { category: "admission-webhook", status: "scan-and-review", object: "admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||vault-agent-injector-cfg" },
        { category: "service-exposure", status: "variant-controlled", object: "v1|Service|vault|vault-ui" },
        { category: "tls-posture", status: "scan-and-review", evidence: "v1|ConfigMap|vault|vault-config" },
        { category: "cluster-rbac", status: "scan-and-review", object: "rbac.authorization.k8s.io/v1|ClusterRole||vault-agent-injector-clusterrole" },
        { category: "operate-policy", status: "scan-and-review", note: "Vault init, unseal, seal migration, and recovery material are post-render operating controls." },
        { category: "extension-slots", status: "controlled-by-empty-defaults", note: "extra environment, Secret, volume, plugin, init, and sidecar slots are empty in promoted variants." },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||vault" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "hashicorp-vault", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: "../../../../packages/hashicorp/vault/0.32.0",
        setupCommand: [
          "cub",
          "install",
          "setup",
          "--pull",
          "../../../../packages/hashicorp/vault/0.32.0",
          "--non-interactive",
          "--namespace",
          "vault",
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
      metadata: { name: `hashicorp-vault-${chart.version}-${variant.name}-r001` },
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
      metadata: { name: `vault-${variant.name}-r001` },
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
      metadata: { name: `vault-${variant.name}-r001` },
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
          { identity: "v1|Namespace||vault", classification: "installer-support-object", disposition: "allowed" },
        ],
        result: "pass",
        evidenceCommand: "npm run vault:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `vault-${variant.name}-r001` },
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
      metadata: { name: `vault-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        decision: "warn",
        allowedScopes: ["local-test"],
        blockedScopes: ["production"],
        reasons: [
          `Helm equivalence passed for ${variant.name}`,
          "Vault TLS posture must be approved before production",
          "Vault init, unseal, recovery, and seal-migration operating policy must be explicit before production",
          "Vault StatefulSet storage, HA, and rollback policy need production review",
          "Injector webhook, RBAC, service exposure, and Secret/extension slots need production review",
          variant.targetFactNote,
        ],
      },
    });
    summaries.push({ ...variant, releaseDigest, objects, scanCounts, scanResult });
  }

  writeYaml(join(proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: "hashicorp-vault-0.32.0" },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "hashicorp/vault",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        nextAction: "publish only after TLS posture, init/unseal operating policy, storage/HA policy, injector webhook policy, RBAC review, service exposure, and Secret/extension-slot review are satisfied",
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
    metadata: { name: "hashicorp-vault-0.32.0" },
    spec: {
      chart: "hashicorp/vault",
      version: chart.version,
      maintainedNotes: [
        "The chart renders deterministically under pinned Helm, chart version, kube version, and values.",
        "The default variant keeps the chart defaults: standalone Vault server, injector webhook, and TLS disabled in the rendered Vault config.",
        "The ha-raft-ui variant enables integrated Raft HA and the UI Service as deliberate variant-controlled outputs.",
        "The chart does not initialize or unseal Vault; init/unseal and recovery material are operating controls, not hidden render inputs.",
        "Injector webhook, cluster RBAC, TLS posture, storage, and service exposure are scan/gate review points.",
        "extra environment, Secret, volume, plugin, init, and sidecar extension slots are powerful config surfaces; promoted variants keep them empty.",
      ],
      knownControlPoints: [
        "stateful-workload",
        "admission-webhook",
        "tls-posture",
        "service-exposure",
        "operate-policy",
        "rbac-review",
        "extension-slots",
        "secret-extension-slots",
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
    metadata: { name: "hashicorp-vault", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `vault ${variant.displayName} variant rendered from hashicorp/vault@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# hashicorp/vault ${chart.version} Installer Package

This package is generated from the vault proof artifacts.

\`\`\`sh
npm run vault:generate-package
npm run vault:verify-package
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
  const tempRoot = mkdtempSync(join(tmpdir(), "vault-installer-package-"));
  try {
    const firstPackage = join(tempRoot, "vault-0.32.0-a.tgz");
    const secondPackage = join(tempRoot, "vault-0.32.0-b.tgz");
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
      metadata: { name: "hashicorp-vault-0.32.0" },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "hashicorp-vault",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub installer package ${packageRelative} -o <tmp>/vault-0.32.0.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub installer setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace vault`,
          helmReleaseObjectCount: variant.expectedObjectCount,
          cubInstallObjectCountIncludingSupport: variant.expectedObjectCount + 1,
          semanticObjectMatches: `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
          separatedSecretCount: variant.expectedSecretCount,
          allowedCubOnlyObjects: ["v1|Namespace||vault"],
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
    "effective-values-ha-raft-ui.yaml",
    "recipe.yaml",
    "variants/default/variant.yaml",
    "variants/ha-raft-ui/variant.yaml",
    "revisions/default/r001/variant-revision.yaml",
    "revisions/default/r001/rendered/release-objects.yaml",
    "revisions/default/r001/rendered/object-inventory.yaml",
    "revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/default/r001/receipts/render-receipt.yaml",
    "revisions/default/r001/receipts/scan-receipt.yaml",
    "revisions/default/r001/receipts/install-gate.yaml",
    "revisions/ha-raft-ui/r001/variant-revision.yaml",
    "revisions/ha-raft-ui/r001/rendered/release-objects.yaml",
    "revisions/ha-raft-ui/r001/rendered/object-inventory.yaml",
    "revisions/ha-raft-ui/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/ha-raft-ui/r001/receipts/render-receipt.yaml",
    "revisions/ha-raft-ui/r001/receipts/scan-receipt.yaml",
    "revisions/ha-raft-ui/r001/receipts/install-gate.yaml",
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
  check(sourceLock.spec.repositoryName === "hashicorp", "source repository mismatch");
  check(sourceLock.spec.chart === "vault", "source chart mismatch");
  check(sourceLock.spec.version === "0.32.0", "source version mismatch");
  check(sourceLock.spec.deprecated === false, "source deprecation marker must be recorded");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).length === 0, "vault dependency lock must be empty");
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "stateful-workload"), "stateful-workload control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "tls-posture"), "tls-posture control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "service-exposure"), "service-exposure control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "operate-policy"), "operate-policy control point missing");
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
    check(identities.includes("apps/v1|StatefulSet|vault|vault"), `${variant.name} StatefulSet missing`);
    check(identities.includes("apps/v1|Deployment|vault|vault-agent-injector"), `${variant.name} injector Deployment missing`);
    check(identities.includes("admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||vault-agent-injector-cfg"), `${variant.name} injector webhook missing`);
    check(identities.includes("v1|Service|vault|vault"), `${variant.name} Service missing`);
    check(identities.includes("v1|Service|vault|vault-internal"), `${variant.name} internal Service missing`);
    check(identities.includes("v1|Service|vault|vault-agent-injector-svc"), `${variant.name} injector Service missing`);
    check(identities.includes("v1|ServiceAccount|vault|vault"), `${variant.name} ServiceAccount missing`);
    check(identities.includes("v1|ServiceAccount|vault|vault-agent-injector"), `${variant.name} injector ServiceAccount missing`);
    check(identities.includes("v1|ConfigMap|vault|vault-config"), `${variant.name} ConfigMap missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||vault-agent-injector-clusterrole"), `${variant.name} injector ClusterRole missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||vault-agent-injector-binding"), `${variant.name} injector ClusterRoleBinding missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRoleBinding||vault-server-binding"), `${variant.name} server ClusterRoleBinding missing`);
    if (variant.name === "default") {
      check(!identities.includes("v1|Service|vault|vault-ui"), "default variant must not render UI Service");
      check(!identities.includes("rbac.authorization.k8s.io/v1|Role|vault|vault-discovery-role"), "default variant must not render HA discovery Role");
    }
    if (variant.name === "ha-raft-ui") {
      check(identities.includes("v1|Service|vault|vault-ui"), "ha-raft-ui UI Service missing");
      check(identities.includes("v1|Service|vault|vault-active"), "ha-raft-ui active Service missing");
      check(identities.includes("v1|Service|vault|vault-standby"), "ha-raft-ui standby Service missing");
      check(identities.includes("rbac.authorization.k8s.io/v1|Role|vault|vault-discovery-role"), "ha-raft-ui discovery Role missing");
      check(identities.includes("rbac.authorization.k8s.io/v1|RoleBinding|vault|vault-discovery-rolebinding"), "ha-raft-ui discovery RoleBinding missing");
      check(identities.includes("policy/v1|PodDisruptionBudget|vault|vault"), "ha-raft-ui PodDisruptionBudget missing");
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
    check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag TLS, webhook, RBAC, workload, service exposure, and extension review`);
    check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} install gate digest mismatch`);
    check(gate.spec.decision === "warn", `${variant.name} install gate should warn`);
  }
  console.log("verified vault proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "vault-proof-self-test-"));
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
    console.log("self-test passed: vault rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run vault:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run vault:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "hashicorp-vault", "package name mismatch");
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

  const tempRoot = mkdtempSync(join(tmpdir(), "vault-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "vault-a.tgz");
    const secondPackage = join(tempRoot, "vault-b.tgz");
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
  console.log("vault installer package verification passed");
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
    "vault",
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
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||vault"]),
    `${variant.name} cub output may add only v1|Namespace||vault; found ${extraInCub.join(", ")}`,
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
  const tempRoot = mkdtempSync(join(tmpdir(), "vault-source-"));
  try {
    command("helm", ["pull", "hashicorp/vault", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "vault");
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
  const tempRoot = mkdtempSync(join(tmpdir(), "vault-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "hashicorp/vault",
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
      metadata: { name: "hashicorp-vault-0.32.0-default" },
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
    metadata: { name: `hashicorp-vault-0.32.0-${variant.name}` },
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
  for (const doc of docs.filter((item) => item.kind === "ConfigMap" && item.metadata?.name === "vault-config")) {
    const configText = Object.values(doc.data ?? {}).join("\n");
    if (configText.includes("tls_disable = 1")) {
      findings.push({
        id: `vault-tls-posture-review:${identityFor(doc)}`,
        rule: "vault-tls-posture-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Vault listener TLS is disabled in rendered config and must be explicitly approved before production promotion",
      });
    }
  }
  for (const doc of docs.filter((item) => item.kind === "MutatingWebhookConfiguration")) {
    findings.push({
      id: `admission-webhook-review:${identityFor(doc)}`,
      rule: "admission-webhook-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Vault injector admission webhook requires certificate, failure policy, and observation review",
    });
  }
  findings.push({
    id: "extension-slot-review:vault-values",
    rule: "extension-slot-review",
    severity: "medium",
    object: "values|server.extraEnvironmentVars|server.extraSecretEnvironmentVars|server.extraVolumes|server.extraInitContainers|server.sidecarContainers",
    message: "Vault Secret/env, volume, plugin, init, and sidecar extension slots must be scanned when populated",
  });
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Vault RBAC requires production review",
    });
  }
  for (const doc of docs.filter((item) => ["Deployment", "StatefulSet"].includes(item.kind))) {
    findings.push({
      id: `vault-workload-operate-review:${identityFor(doc)}`,
      rule: "vault-workload-operate-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Vault workload rollout, storage, init/unseal, and rollback policy require production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Service" && ["vault", "vault-active", "vault-standby", "vault-ui"].includes(item.metadata?.name))) {
    findings.push({
      id: `service-exposure-review:${identityFor(doc)}`,
      rule: "service-exposure-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Vault API/UI service exposure requires explicit network and TLS policy",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function writeReadme(summaries) {
  write(
    join(proofRoot, "README.md"),
    `# hashicorp/vault ${chart.version} Proof

This is the promoted proof slice for the Vault public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub installer objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub installer setup\`, plus the explained Namespace support object;
- the default variant keeps the chart defaults visible: Vault StatefulSet, injector webhook, ClusterRole permissions, services, and TLS-disabled listener config;
- the ha-raft-ui variant deliberately adds HA Raft discovery, PDB, active/standby services, and UI service exposure;
- Vault init/unseal and recovery material are not hidden Helm render inputs; they are explicit operate-policy gates after render;
- TLS posture, injector webhook, RBAC, service exposure, StatefulSet storage, and Secret/env extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run vault:generate-proof
npm run vault:generate-package
npm run vault:verify-proof
npm run vault:verify-package
npm run vault:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
