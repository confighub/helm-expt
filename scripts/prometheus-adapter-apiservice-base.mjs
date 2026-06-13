#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

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
  objectFilesFromDirs,
  parseDocs,
  parseObjects,
  readYaml,
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

const mode = process.argv[2] ?? "--generate";
const chart = {
  repository: "prometheus-community",
  repositoryURL: "https://prometheus-community.github.io/helm-charts",
  ref: "prometheus-community/prometheus-adapter",
  name: "prometheus-adapter",
  version: "5.3.0",
  releaseName: "prometheus-adapter",
  namespace: "default",
  proofTier: "next80-full",
};
const base = "apiservice-v1-capability";
const kubeVersion = "1.30.0";
const apiVersions = ["apiregistration.k8s.io/v1"];
const recipeRoot = join(repoRoot, "recipes", "prometheus-community", "prometheus-adapter", chart.version);
const packageRoot = join(repoRoot, "packages", "prometheus-community", "prometheus-adapter", chart.version);

if (mode === "--generate") {
  generate();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/prometheus-adapter-apiservice-base.mjs --generate
  node scripts/prometheus-adapter-apiservice-base.mjs --verify`);
}

function generate() {
  ensureRepo();
  const render = renderCandidate();
  check(render.deterministic, `${chart.ref}@${chart.version} ${base} did not render deterministically`);
  const releaseObjects = normalizeRelease(render.first);
  const releaseDigest = sha256(releaseObjects);
  const docs = parseDocs(releaseObjects);
  const objects = parseObjects(releaseObjects);
  check(objects.length === 11, `${base} expected 11 objects; found ${objects.length}`);
  check(
    objects.some((object) => object.identity === "apiregistration.k8s.io/v1|APIService||v1beta1.custom.metrics.k8s.io"),
    `${base} must render apiregistration.k8s.io/v1/APIService`,
  );
  check(
    !objects.some((object) => object.identity === "apiregistration.k8s.io/v1beta1|APIService||v1beta1.custom.metrics.k8s.io"),
    `${base} must not render apiregistration.k8s.io/v1beta1/APIService`,
  );

  writeVariant();
  updateRecipe();
  writePackageBase(releaseObjects);
  updateInstaller();
  writeRevisionArtifacts({ releaseObjects, releaseDigest, docs, objects });
  updateAllRevisionRecipeDigests();
  updateCatalogStatus();
  updateHelmPlan({ releaseDigest, objectCount: objects.length });
  updatePackageReceipt({ releaseObjects, objectCount: objects.length });
  verify();
  console.log(`generated ${chart.ref}@${chart.version} ${base}`);
}

function verify() {
  const variantPath = join(recipeRoot, "variants", base, "variant.yaml");
  const revisionRoot = join(recipeRoot, "revisions", base, "r001");
  const releasePath = join(revisionRoot, "rendered", "release-objects.yaml");
  const inventoryPath = join(revisionRoot, "rendered", "object-inventory.yaml");
  const packageBasePath = join(packageRoot, "bases", base, "upstream.yaml");
  const recipe = readYaml(join(recipeRoot, "recipe.yaml"));
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const variant = readYaml(variantPath);
  const inventory = readYaml(inventoryPath);
  const packageReceipt = readYaml(join(recipeRoot, "publication", "installer-package-receipt.yaml"));

  check(recipe.spec?.variants?.includes(`variants/${base}/variant.yaml`), "recipe is missing APIService capability base");
  check(installer.spec?.bases?.some((item) => item.name === base), "installer package is missing APIService capability base");
  check(variant.spec?.capabilityProfile?.apiVersions?.includes("apiregistration.k8s.io/v1"), "variant must declare APIService v1 capability");
  check(variant.spec?.usefulBase?.realizationStrategy === "capability-profile-rerender", "variant must record capability-profile rerender strategy");
  check(readFileSync(releasePath, "utf8") === readFileSync(packageBasePath, "utf8"), "package base must match rendered release objects");
  check(inventory.spec?.sourceSHA256 === sha256File(releasePath), "inventory source digest mismatch");
  check(
    (inventory.spec?.objects ?? []).some((object) => object.identity === "apiregistration.k8s.io/v1|APIService||v1beta1.custom.metrics.k8s.io"),
    "inventory must contain APIService v1 object",
  );
  verifyRevision(revisionRoot);
  verifyPackageReceipt(packageReceipt);
  const setup = runSetupAndCompare(readFileSync(releasePath, "utf8"), parseObjects(readFileSync(releasePath, "utf8")).length, base);
  const setupReceipt = (packageReceipt.spec?.setupChecks ?? []).find((item) => item.variant === base);
  check(Boolean(setupReceipt), "package receipt missing setup check for APIService capability base");
  check(setup.semanticObjectMatches === setupReceipt.semanticObjectMatches, "setup semantic match mismatch");
  check(setup.cubObjectCount === setupReceipt.cubInstallObjectCountIncludingSupport, "setup object count mismatch");
  check(setup.separatedSecretCount === setupReceipt.separatedSecretCount, "setup secret count mismatch");
  console.log(`verified ${chart.ref}@${chart.version} ${base}`);
}

function ensureRepo() {
  const result = spawnSync("helm", ["repo", "add", chart.repository, chart.repositoryURL], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  if (result.status !== 0 && !`${result.stderr}${result.stdout}`.includes("already exists")) {
    throw new Error(result.stderr || result.stdout);
  }
}

function renderCandidate() {
  const renderArgs = [
    "template",
    chart.releaseName,
    chart.ref,
    "--version",
    chart.version,
    "--namespace",
    chart.namespace,
    "--kube-version",
    kubeVersion,
    "--api-versions",
    "apiregistration.k8s.io/v1",
    "--include-crds",
    "--skip-tests",
    "--no-hooks",
  ];
  const first = command("helm", renderArgs);
  const second = command("helm", renderArgs);
  return { first, second, deterministic: sha256(first) === sha256(second) };
}

function normalizeRelease(text) {
  return `${text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n*$/, "")}\n`;
}

function writeVariant() {
  const defaultVariant = readYaml(join(recipeRoot, "variants", "default", "variant.yaml"));
  writeYaml(join(recipeRoot, "variants", base, "variant.yaml"), {
    ...defaultVariant,
    metadata: {
      ...(defaultVariant.metadata ?? {}),
      name: base,
      labels: {
        ...(defaultVariant.metadata?.labels ?? {}),
        "confighub.io/variant": base,
        "helm-expt.confighub.com/useful-base-status": "capability-profile-rerender",
      },
    },
    spec: {
      ...(defaultVariant.spec ?? {}),
      capabilityProfile: { kubeVersion, apiVersions },
      usefulBase: {
        realizationStrategy: "capability-profile-rerender",
        sourceBase: "default",
        userJob: "run Prometheus Adapter on Kubernetes targets that serve apiregistration.k8s.io/v1",
        renderTimeChoices: [
          "target Kubernetes API surface",
          "custom.metrics.k8s.io APIService compatibility",
          "cluster RBAC review",
        ],
        changedObjects: [
          {
            identity: "apiregistration.k8s.io/v1|APIService||v1beta1.custom.metrics.k8s.io",
            reason: "Helm selects the APIService v1 template branch when the capability profile includes apiregistration.k8s.io/v1.",
          },
        ],
        remainingBeforeCatalog: [
          "ConfigHub proof lane",
          "selected live lane",
          "APIService runtime contract",
          "production disposition",
        ],
        note: "This base changes the render-time capability profile so the chart emits a target-supported APIService API version.",
      },
    },
  });
}

function updateRecipe() {
  const path = join(recipeRoot, "recipe.yaml");
  const recipe = readYaml(path);
  const variants = new Set(recipe.spec?.variants ?? []);
  variants.add(`variants/${base}/variant.yaml`);
  recipe.spec.variants = [...variants].sort((left, right) => variantSort(left, right));
  writeYaml(path, recipe);
}

function writePackageBase(releaseObjects) {
  writeYaml(join(packageRoot, "bases", base, "kustomization.yaml"), {
    apiVersion: "kustomize.config.k8s.io/v1beta1",
    kind: "Kustomization",
    resources: ["upstream.yaml"],
  });
  write(join(packageRoot, "bases", base, "upstream.yaml"), releaseObjects);
}

function updateInstaller() {
  const path = join(packageRoot, "installer.yaml");
  const installer = readYaml(path);
  const bases = (installer.spec?.bases ?? []).filter((item) => item.name !== base);
  bases.push({
    name: base,
    path: `bases/${base}`,
    default: false,
    description: `${chart.ref} APIService v1 capability-profile base for Kubernetes targets that serve apiregistration.k8s.io/v1`,
  });
  installer.spec.bases = bases.sort((left, right) => baseSort(left.name, right.name));
  writeYaml(path, installer);
}

function writeRevisionArtifacts({ releaseObjects, releaseDigest, docs, objects }) {
  const revisionRoot = join(recipeRoot, "revisions", base, "r001");
  const renderedRoot = join(revisionRoot, "rendered");
  const receiptsRoot = join(revisionRoot, "receipts");
  const scanFindings = scanDocs(docs);
  const scanCounts = findingCounts(scanFindings);
  const policyBundleDigest = sha256(JSON.stringify(localScanPolicy()));
  const helmVersion = command("helm", ["version", "--short"]).trim();
  const recipeDigest = sha256File(join(recipeRoot, "recipe.yaml"));
  const variantDigest = sha256File(join(recipeRoot, "variants", base, "variant.yaml"));
  const effectiveValuesDigest = sha256File(join(recipeRoot, "effective-values.yaml"));
  const rendererFingerprint = rendererSHA(helmVersion);
  const revisionDigest = revisionSHA({ recipeDigest, variantDigest, effectiveValuesDigest, rendererFingerprint, releaseDigest });

  write(join(renderedRoot, "release-objects.yaml"), releaseObjects);
  writeYaml(join(renderedRoot, "object-inventory.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "RenderedObjectInventory",
    metadata: { name: `${artifactName()}-${base}-r001`, labels: proofLabels(base) },
    spec: {
      source: "rendered/release-objects.yaml",
      sourceSHA256: releaseDigest,
      objectCount: objects.length,
      objects,
    },
  });
  writeYaml(join(revisionRoot, "variant-revision.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantRevision",
    metadata: { name: `${base}-r001`, labels: proofLabels(base) },
    spec: {
      variant: `../../../variants/${base}/variant.yaml`,
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
  writeYaml(join(receiptsRoot, "render-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "RenderReceipt",
    metadata: { name: `${artifactName()}-${base}-r001`, labels: proofLabels(base) },
    spec: {
      variantRevision: "../variant-revision.yaml",
      renderer: {
        name: "helm",
        version: helmVersion,
        kubeVersion,
        apiVersions,
        flags: ["--include-crds", "--skip-tests", "--no-hooks"],
      },
      inputs: {
        sourceLockSHA256: sha256File(join(recipeRoot, "source-lock.yaml")),
        dependencyLockSHA256: sha256File(join(recipeRoot, "dependency-lock.yaml")),
        effectiveValuesSHA256: effectiveValuesDigest,
      },
      outputs: {
        renderedObjectSetSHA256: releaseDigest,
        renderedObjectInventorySHA256: sha256File(join(renderedRoot, "object-inventory.yaml")),
        deterministicAcrossTwoLocalRenders: true,
        objectCount: objects.length,
        renderedSecretCount: docs.filter((doc) => doc.kind === "Secret").length,
        secretCountSeparatedByCubInstall: 0,
      },
    },
  });
  writeYaml(join(receiptsRoot, "helm-equivalence-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmEquivalenceReceipt",
    metadata: { name: `${artifactName()}-${base}-r001`, labels: proofLabels(base) },
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
        { identity: `v1|Namespace||${chart.namespace}`, classification: "installer-support-object", disposition: "allowed" },
      ],
      result: "pass",
      evidenceCommand: "npm run prometheus-adapter:apiservice-base:verify",
    },
  });
  writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ScanReceipt",
    metadata: { name: `${artifactName()}-${base}-r001`, labels: proofLabels(base) },
    spec: {
      variantRevision: "../variant-revision.yaml",
      renderedObjectSetSHA256: releaseDigest,
      result: scanFindings.length ? "warn" : "pass",
      scanner: { name: localScanPolicy().scanner, version: localScanPolicy().version },
      policyBundleDigest,
      findingCounts: scanCounts,
      findings: scanFindings,
    },
  });
  writeYaml(join(receiptsRoot, "install-gate.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "InstallGate",
    metadata: { name: `${artifactName()}-${base}-r001`, labels: proofLabels(base) },
    spec: {
      variantRevision: "../variant-revision.yaml",
      renderedObjectSetSHA256: releaseDigest,
      decision: scanFindings.length ? "warn" : "allow",
      allowedScopes: scanFindings.length ? ["local-test", "review"] : ["local-test", "review", "production-candidate"],
      blockedScopes: scanFindings.length ? ["production-without-review"] : [],
      reasons: [
        `regular Helm output matches cub installer setup for ${chart.ref}@${chart.version} ${base}`,
        `${objects.length} Helm objects are bound to renderedObjectSetSHA256`,
        "capability profile renders apiregistration.k8s.io/v1/APIService for modern targets",
        scanFindings.length
          ? "rendered-object scan has review findings; see scan-receipt.yaml"
          : "rendered-object scan produced no findings in the local proof policy",
      ],
    },
  });
}

function updateAllRevisionRecipeDigests() {
  const recipeDigest = sha256File(join(recipeRoot, "recipe.yaml"));
  for (const variantName of ["default", "cluster-metrics-readonly", base]) {
    const revisionRoot = join(recipeRoot, "revisions", variantName, "r001");
    if (!existsSync(join(revisionRoot, "variant-revision.yaml"))) continue;
    const revision = readYaml(join(revisionRoot, "variant-revision.yaml"));
    const variantDigest = sha256File(join(recipeRoot, "variants", variantName, "variant.yaml"));
    const effectiveValuesDigest = sha256File(join(recipeRoot, "effective-values.yaml"));
    const renderedObjectSetSHA256 = sha256File(join(revisionRoot, "rendered", "release-objects.yaml"));
    const rendererSHA256 = revision.spec?.digestInputs?.rendererSHA256;
    revision.spec.digestInputs = {
      ...(revision.spec?.digestInputs ?? {}),
      recipeSHA256: recipeDigest,
      variantSHA256: variantDigest,
      effectiveValuesSHA256: effectiveValuesDigest,
      renderedObjectSetSHA256,
    };
    revision.spec.digest = revisionSHA({
      recipeDigest,
      variantDigest,
      effectiveValuesDigest,
      rendererFingerprint: rendererSHA256,
      releaseDigest: renderedObjectSetSHA256,
    });
    writeYaml(join(revisionRoot, "variant-revision.yaml"), revision);
  }
}

function updateCatalogStatus() {
  const path = join(recipeRoot, "catalog-status.yaml");
  const status = readYaml(path);
  const candidates = new Set(status.spec?.candidateVariants ?? []);
  candidates.add(base);
  status.spec.candidateVariants = [...candidates].sort(baseSort);
  status.spec.notes = [
    ...(status.spec.notes ?? []).filter((note) => !String(note).includes(base)),
    `${base} is a capability-profile rerender that emits apiregistration.k8s.io/v1/APIService; catalog support still requires ConfigHub proof, selected live evidence, APIService runtime contract, and production disposition.`,
  ];
  writeYaml(path, status);
}

function updateHelmPlan({ releaseDigest, objectCount }) {
  const path = join(recipeRoot, "helm-plan.yaml");
  const plan = readYaml(path);
  const variants = new Set(plan.spec?.readiness?.variants ?? []);
  variants.add(base);
  plan.spec.readiness.variants = [...variants].sort(baseSort);
  plan.spec.readiness.helmObjectsByVariant = {
    ...(plan.spec.readiness.helmObjectsByVariant ?? {}),
    [base]: objectCount,
  };
  plan.spec.readiness.cubInstallObjectsByVariant = {
    ...(plan.spec.readiness.cubInstallObjectsByVariant ?? {}),
    [base]: objectCount + 1,
  };
  plan.spec.readiness.helmMatchByVariant = {
    ...(plan.spec.readiness.helmMatchByVariant ?? {}),
    [base]: `${objectCount}/${objectCount}`,
  };
  plan.spec.readiness.renderedObjectSetSHA256ByVariant = {
    ...(plan.spec.readiness.renderedObjectSetSHA256ByVariant ?? {}),
    [base]: releaseDigest,
  };
  plan.spec.readiness.nextAction = "run ConfigHub proof, local live, live Helm-vs-ConfigHub parity, and APIService runtime contract for apiservice-v1-capability";
  const receipts = new Set(plan.spec?.receipts ?? []);
  for (const receipt of [
    `revisions/${base}/r001/receipts/helm-equivalence-receipt.yaml`,
    `revisions/${base}/r001/receipts/render-receipt.yaml`,
    `revisions/${base}/r001/receipts/scan-receipt.yaml`,
    `revisions/${base}/r001/receipts/install-gate.yaml`,
  ]) receipts.add(receipt);
  plan.spec.receipts = [...receipts];
  writeYaml(path, plan);
}

function updatePackageReceipt({ releaseObjects, objectCount }) {
  const receiptPath = join(recipeRoot, "publication", "installer-package-receipt.yaml");
  const receipt = readYaml(receiptPath);
  const packageCheck = packageAndSetupCheck(releaseObjects, objectCount, base);
  receipt.spec.package.sourceFiles = listFiles(packageRoot).map((file) => ({
    path: relative(packageRoot, file).replaceAll("\\", "/"),
    sha256: sha256File(file),
    bytes: readFileSync(file).length,
  }));
  receipt.spec.deterministicBundle = {
    ...(receipt.spec.deterministicBundle ?? {}),
    command: `cub installer package ${relativeRepo(packageRoot)} -o <tmp>/${artifactName()}.tgz`,
    sha256: packageCheck.bundleSHA256,
    byteIdenticalAcrossTwoLocalBundles: true,
  };
  const setupChecks = (receipt.spec.setupChecks ?? []).filter((item) => item.variant !== base);
  setupChecks.push({
    variant: base,
    base,
    command: `cub installer setup --pull ${relativeRepo(packageRoot)} --base ${base} --work-dir <tmp> --non-interactive --namespace ${chart.namespace}`,
    helmReleaseObjectCount: objectCount,
    cubInstallObjectCountIncludingSupport: packageCheck.cubObjectCount,
    semanticObjectMatches: packageCheck.semanticObjectMatches,
    separatedSecretCount: packageCheck.separatedSecretCount,
    allowedCubOnlyObjects: packageCheck.extraInCub,
    targetFactMode: "capability-profile",
    targetFactsBound: true,
  });
  receipt.spec.setupChecks = setupChecks.sort((left, right) => baseSort(left.variant, right.variant));
  writeYaml(receiptPath, receipt);
}

function packageAndSetupCheck(releaseObjects, objectCount, baseName) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-prom-adapter-base-"));
  try {
    const firstPackage = join(tempRoot, `${artifactName()}-a.tgz`);
    const secondPackage = join(tempRoot, `${artifactName()}-b.tgz`);
    runCub(["installer", "package", packageRoot, "-o", firstPackage]);
    runCub(["installer", "package", packageRoot, "-o", secondPackage]);
    const firstSHA = sha256File(firstPackage);
    check(firstSHA === sha256File(secondPackage), "cub installer package must be deterministic");
    check(readFileSync(firstPackage).equals(readFileSync(secondPackage)), "cub installer package bytes must be deterministic");
    return { bundleSHA256: firstSHA, ...runSetupAndCompare(releaseObjects, objectCount, baseName, tempRoot) };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runSetupAndCompare(releaseObjects, expectedObjectCount, baseName, tempRoot = null) {
  const ownedTempRoot = tempRoot ?? mkdtempSync(join(tmpdir(), "helm-expt-prom-adapter-verify-"));
  try {
    const workDir = join(ownedTempRoot, `work-${baseName}`);
    runCub([
      "installer",
      "setup",
      "--pull",
      packageRoot,
      "--base",
      baseName,
      "--work-dir",
      workDir,
      "--non-interactive",
      "--namespace",
      chart.namespace,
    ]);
    const cubFiles = objectFilesFromDirs([join(workDir, "out", "manifests"), join(workDir, "out", "secrets")]);
    const cubYaml = cubFiles.map((file) => file.yaml).join("\n---\n");
    const semantic = canonicalObjectMaps(releaseObjects, cubYaml);
    const helmObjects = new Set(Object.keys(semantic.helm));
    const cubObjects = new Set(Object.keys(semantic.cub));
    check(helmObjects.size === expectedObjectCount, "Helm object count mismatch");
    const missingFromCub = difference(helmObjects, cubObjects);
    check(missingFromCub.length === 0, `cub output missing Helm object(s): ${missingFromCub.join(", ")}`);
    const extraInCub = difference(cubObjects, helmObjects);
    const allowedExtras = new Set([`v1|Namespace||${chart.namespace}`]);
    const unexpectedExtras = extraInCub.filter((identity) => !allowedExtras.has(identity));
    check(unexpectedExtras.length === 0, `unexpected cub-only objects: ${unexpectedExtras.join(", ")}`);
    const semanticDiffs = [];
    for (const key of helmObjects) {
      if (semantic.helm[key] !== semantic.cub[key]) semanticDiffs.push(key);
    }
    check(semanticDiffs.length === 0, `semantic diffs: ${semanticDiffs.join(", ")}`);
    return {
      cubObjectCount: cubObjects.size,
      uploadedManifestFiles: cubFiles.length,
      separatedSecretCount: listYamlFiles(join(workDir, "out", "secrets")).length,
      semanticObjectMatches: `${helmObjects.size}/${helmObjects.size}`,
      extraInCub,
    };
  } finally {
    if (!tempRoot) rmSync(ownedTempRoot, { recursive: true, force: true });
  }
}

function verifyRevision(revisionRoot) {
  const releasePath = join(revisionRoot, "rendered", "release-objects.yaml");
  const releaseSHA = sha256File(releasePath);
  const revision = readYaml(join(revisionRoot, "variant-revision.yaml"));
  const inventory = readYaml(join(revisionRoot, "rendered", "object-inventory.yaml"));
  const render = readYaml(join(revisionRoot, "receipts", "render-receipt.yaml"));
  const equivalence = readYaml(join(revisionRoot, "receipts", "helm-equivalence-receipt.yaml"));
  const scan = readYaml(join(revisionRoot, "receipts", "scan-receipt.yaml"));
  const gate = readYaml(join(revisionRoot, "receipts", "install-gate.yaml"));
  check(revision.spec?.digestInputs?.renderedObjectSetSHA256 === releaseSHA, "revision rendered digest mismatch");
  check(inventory.spec?.sourceSHA256 === releaseSHA, "inventory rendered digest mismatch");
  check(render.spec?.outputs?.renderedObjectSetSHA256 === releaseSHA, "render receipt rendered digest mismatch");
  check(render.spec?.renderer?.apiVersions?.includes("apiregistration.k8s.io/v1"), "render receipt missing APIService v1 capability");
  check(equivalence.spec?.regularHelm?.renderedSHA256 === releaseSHA, "helm equivalence digest mismatch");
  check(equivalence.spec?.result === "pass", "helm equivalence must pass");
  check(scan.spec?.renderedObjectSetSHA256 === releaseSHA, "scan digest mismatch");
  check(gate.spec?.renderedObjectSetSHA256 === releaseSHA, "install gate digest mismatch");
}

function verifyPackageReceipt(receipt) {
  for (const file of receipt.spec?.package?.sourceFiles ?? []) {
    const path = join(packageRoot, file.path);
    check(existsSync(path), `package receipt references missing ${file.path}`);
    check(sha256File(path) === file.sha256, `package source SHA mismatch for ${file.path}`);
    check(readFileSync(path).length === Number(file.bytes), `package source byte mismatch for ${file.path}`);
  }
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-prom-adapter-package-verify-"));
  try {
    const output = join(tempRoot, `${artifactName()}.tgz`);
    runCub(["installer", "package", packageRoot, "-o", output]);
    check(sha256File(output) === receipt.spec?.deterministicBundle?.sha256, "deterministic bundle SHA mismatch");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
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
    if (podSpec.hostNetwork || podSpec.hostPID || podSpec.hostIPC) {
      findings.push({
        id: `host-namespace-review:${object}`,
        rule: "host-namespace-review",
        severity: "medium",
        object,
        message: "workload uses host namespace settings and needs production review",
      });
    }
    for (const container of containers) {
      if (container.securityContext?.privileged === true) {
        findings.push({
          id: `privileged-container-review:${object}:${container.name ?? "container"}`,
          rule: "privileged-container-review",
          severity: "medium",
          object,
          message: `container ${container.name ?? "container"} is privileged`,
        });
      }
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
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Cluster-scoped RBAC requires production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "APIService")) {
    findings.push({
      id: `apiservice-requires-observation:${identityFor(doc)}`,
      rule: "apiservice-requires-observation",
      severity: "medium",
      object: identityFor(doc),
      message: "APIService availability must be observed after apply",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return dedupeFindings(findings);
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) return false;
    seen.add(finding.id);
    return true;
  });
}

function localScanPolicy() {
  return {
    scanner: "helm-expt-local-rendered-object-scan",
    version: "0.2.0",
    rules: [
      { id: "mutable-image-tag", severity: "high" },
      { id: "service-selector-has-workload-match", severity: "high" },
      { id: "workload-service-account-exists", severity: "high" },
      { id: "cluster-rbac-review", severity: "medium" },
      { id: "apiservice-requires-observation", severity: "medium" },
      { id: "privileged-container-review", severity: "medium" },
      { id: "host-namespace-review", severity: "medium" },
    ],
  };
}

function rendererSHA(helmVersion) {
  return sha256(
    JSON.stringify({
      renderer: "helm",
      helmVersion,
      kubeVersion,
      apiVersions,
      flags: ["--include-crds", "--skip-tests", "--no-hooks"],
    }),
  );
}

function revisionSHA({ recipeDigest, variantDigest, effectiveValuesDigest, rendererFingerprint, releaseDigest }) {
  return sha256(JSON.stringify({ recipeDigest, variantDigest, effectiveValuesDigest, rendererFingerprint, releaseDigest }));
}

function proofLabels(variant = null) {
  return {
    "confighub.io/chart-ref": chart.ref,
    "confighub.io/chart-version": chart.version,
    "confighub.io/proof-tier": chart.proofTier,
    ...(variant ? { "confighub.io/variant": variant } : {}),
  };
}

function artifactName() {
  return `${chart.repository}-${chart.name}-${chart.version.replaceAll(".", "-")}`;
}

function baseSort(left, right) {
  if (left === "default") return -1;
  if (right === "default") return 1;
  return String(left).localeCompare(String(right));
}

function variantSort(left, right) {
  return baseSort(String(left).split("/")[1], String(right).split("/")[1]);
}
