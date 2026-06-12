import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  toYaml,
  workloadPodSpec,
  workloadTemplateLabels,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const kubeVersion = "1.30.0";
const helmVersion = command("helm", ["version", "--short"]).trim();
const args = process.argv.slice(2);
const generate = args.includes("--generate");
const verify = args.includes("--verify");

if (!generate && !verify) {
  console.log(`Usage:
  node scripts/realize-useful-base-rerenders.mjs --generate
  node scripts/realize-useful-base-rerenders.mjs --verify`);
  process.exit(1);
}

const targets = [
  {
    chart: "prometheus-community/prometheus-node-exporter",
    repository: "prometheus-community",
    name: "prometheus-node-exporter",
    version: "4.55.0",
    base: "cluster-metrics-readonly",
    namespace: "default",
    releaseName: "prometheus-node-exporter",
    userJob: "Expose node-exporter metrics with an explicit Prometheus Operator ServiceMonitor.",
    values: {
      prometheus: {
        monitor: {
          enabled: true,
          additionalLabels: {
            release: "prometheus",
          },
        },
      },
    },
    targetFacts: {
      requiredCRDs: [
        {
          name: "servicemonitors.monitoring.coreos.com",
          sourcePath: "../../../prometheus-community/prometheus-operator-crds/29.0.0/revisions/default/r001/rendered/release-objects.yaml",
          sourceVariant: "prometheus-community/prometheus-operator-crds@29.0.0/default",
          purpose: "Prometheus Operator ServiceMonitor CRD required by the cluster-metrics-readonly ServiceMonitor object",
          deliveryLanes: ["regularHelm", "cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"],
        },
      ],
    },
    expectedAddedObjects: ["monitoring.coreos.com/v1|ServiceMonitor|default|prometheus-node-exporter"],
  },
];

if (generate) {
  for (const target of targets) realize(target);
  console.log(`realized ${targets.length} useful base rerender(s)`);
}

for (const target of targets) verifyTarget(target);
console.log(`verified ${targets.length} useful base rerender(s)`);

function realize(target) {
  const recipeRoot = join(repoRoot, "recipes", target.repository, target.name, target.version);
  const packageRoot = join(repoRoot, "packages", target.repository, target.name, target.version);
  const baseRoot = join(packageRoot, "bases", target.base);
  const revisionRoot = join(recipeRoot, "revisions", target.base, "r001");
  const renderedRoot = join(revisionRoot, "rendered");
  const receiptsRoot = join(revisionRoot, "receipts");

  check(readYaml(join(recipeRoot, "source-lock.yaml")).spec.ref === target.chart, `${target.chart} source lock mismatch`);
  check(readYaml(join(recipeRoot, "source-lock.yaml")).spec.version === target.version, `${target.chart} version mismatch`);

  const render = renderHelm(target);
  check(render.firstDigest === render.secondDigest, `${target.chart} ${target.base} render is not deterministic`);
  const releaseObjects = render.first;
  const releaseDigest = render.firstDigest;
  const docs = parseDocs(releaseObjects);
  const objects = parseObjects(releaseObjects);
  const defaultObjects = parseObjects(readFileSync(join(recipeRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml"), "utf8"));
  const addedObjects = difference(new Set(objects.map((object) => object.identity)), new Set(defaultObjects.map((object) => object.identity)));
  check(
    target.expectedAddedObjects.every((identity) => addedObjects.includes(identity)),
    `${target.chart} ${target.base} did not add expected object(s); added ${addedObjects.join(", ")}`,
  );

  rmSync(baseRoot, { recursive: true, force: true });
  rmSync(revisionRoot, { recursive: true, force: true });
  mkdirSync(baseRoot, { recursive: true });
  mkdirSync(renderedRoot, { recursive: true });
  mkdirSync(receiptsRoot, { recursive: true });

  writeYaml(join(recipeRoot, `effective-values-${target.base}.yaml`), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "EffectiveValues",
    metadata: {
      name: `${artifactName(target)}-${target.base}`,
      labels: labelsFor(target, target.base),
    },
    spec: {
      files: [
        {
          path: `effective-values-${target.base}.yaml`,
          source: "useful-base-rerender",
          sha256: sha256(toYaml(target.values) + "\n"),
        },
      ],
      mergedValuesCaptured: false,
      values: target.values,
    },
  });

  writeYaml(join(recipeRoot, "variants", target.base, "variant.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Variant",
    metadata: {
      name: target.base,
      labels: {
        ...labelsFor(target, target.base),
        "helm-expt.confighub.com/useful-base-status": "values-profile-rerender",
      },
    },
    spec: {
      recipe: "../../recipe.yaml",
      namespace: target.namespace,
      releaseName: target.releaseName,
      valuesProfile: `../../effective-values-${target.base}.yaml`,
      capabilityProfile: { kubeVersion, apiVersions: [] },
      hookPolicy: "no-hooks",
      targetFacts: target.targetFacts,
      usefulBase: {
        realizationStrategy: "values-profile-rerender",
        userJob: target.userJob,
        renderTimeChoices: ["prometheus.monitor.enabled", "prometheus.monitor.additionalLabels"],
        addedObjects,
      },
    },
  });

  updateRecipe(target);
  updateCatalogStatus(target);
  updateInstaller(target);

  writeYaml(join(baseRoot, "kustomization.yaml"), {
    apiVersion: "kustomize.config.k8s.io/v1beta1",
    kind: "Kustomization",
    resources: ["upstream.yaml"],
  });
  write(join(baseRoot, "upstream.yaml"), releaseObjects);

  const packageResult = packageAndSetupCheck(target, packageRoot, target.base, releaseObjects, objects.length);
  const scanFindings = scanDocs(docs);
  const scanCounts = findingCounts(scanFindings);
  const policyBundleDigest = sha256(JSON.stringify(localScanPolicy()));

  write(join(renderedRoot, "release-objects.yaml"), releaseObjects);
  writeYaml(join(renderedRoot, "object-inventory.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "RenderedObjectInventory",
    metadata: { name: `${artifactName(target)}-${target.base}-r001`, labels: labelsFor(target, target.base) },
    spec: {
      source: "rendered/release-objects.yaml",
      sourceSHA256: releaseDigest,
      objectCount: objects.length,
      objects,
    },
  });

  const recipeDigest = sha256File(join(recipeRoot, "recipe.yaml"));
  const variantDigest = sha256File(join(recipeRoot, "variants", target.base, "variant.yaml"));
  const effectiveValuesDigest = sha256File(join(recipeRoot, `effective-values-${target.base}.yaml`));
  const rendererFingerprint = rendererSHA();
  const revisionDigest = sha256(
    JSON.stringify({
      recipeDigest,
      variantDigest,
      effectiveValuesDigest,
      rendererFingerprint,
      releaseDigest,
    }),
  );
  writeYaml(join(revisionRoot, "variant-revision.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantRevision",
    metadata: { name: `${target.base}-r001`, labels: labelsFor(target, target.base) },
    spec: {
      variant: `../../../variants/${target.base}/variant.yaml`,
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
    metadata: { name: `${artifactName(target)}-${target.base}-r001`, labels: labelsFor(target, target.base) },
    spec: {
      variantRevision: "../variant-revision.yaml",
      renderer: {
        name: "helm",
        version: helmVersion,
        kubeVersion,
        flags: ["--include-crds", "--skip-tests", "--no-hooks", "-f"],
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
        secretCountSeparatedByCubInstall: packageResult.separatedSecretCount,
      },
    },
  });

  writeYaml(join(receiptsRoot, "helm-equivalence-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmEquivalenceReceipt",
    metadata: { name: `${artifactName(target)}-${target.base}-r001`, labels: labelsFor(target, target.base) },
    spec: {
      variantRevision: "../variant-revision.yaml",
      regularHelm: { renderedSHA256: releaseDigest, objectCount: objects.length },
      cubInstall: {
        objectCountIncludingSecretsAndSupportObjects: packageResult.cubObjectCount,
        uploadedManifestFiles: packageResult.uploadedManifestFiles,
        separatedSecretFiles: packageResult.separatedSecretCount,
        semanticObjectMatches: packageResult.semanticObjectMatches,
      },
      semanticNormalizations: ["prune-null-fields"],
      classifications: packageResult.extraInCub.map((identity) => ({
        identity,
        classification: "installer-support-object",
        disposition: "allowed",
      })),
      usefulBaseDelta: {
        sourceBase: "default",
        addedObjects,
        removedObjects: difference(new Set(defaultObjects.map((object) => object.identity)), new Set(objects.map((object) => object.identity))),
      },
      result: "pass",
      evidenceCommand: "node scripts/realize-useful-base-rerenders.mjs --verify",
    },
  });

  writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ScanReceipt",
    metadata: { name: `${artifactName(target)}-${target.base}-r001`, labels: labelsFor(target, target.base) },
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
    metadata: { name: `${artifactName(target)}-${target.base}-r001`, labels: labelsFor(target, target.base) },
    spec: {
      variantRevision: "../variant-revision.yaml",
      renderedObjectSetSHA256: releaseDigest,
      decision: scanFindings.length ? "warn" : "allow",
      allowedScopes: scanFindings.length ? ["local-test", "review"] : ["local-test", "review", "production-candidate"],
      blockedScopes: scanFindings.length ? ["production-without-review"] : [],
      reasons: [
        `regular Helm output matches cub installer setup for ${target.chart}@${target.version} ${target.base}`,
        `${objects.length} Helm objects are bound to renderedObjectSetSHA256`,
        `${target.base} is a values-profile rerender, not an alias of default`,
        scanFindings.length
          ? "rendered-object scan has review findings; see scan-receipt.yaml"
          : "rendered-object scan produced no findings in the local proof policy",
      ],
    },
  });

  updatePublicationReceipt(target, packageRoot, packageResult);
}

function verifyTarget(target) {
  const recipeRoot = join(repoRoot, "recipes", target.repository, target.name, target.version);
  const packageRoot = join(repoRoot, "packages", target.repository, target.name, target.version);
  const releasePath = join(recipeRoot, "revisions", target.base, "r001", "rendered", "release-objects.yaml");
  const releaseObjects = readFileSync(releasePath, "utf8");
  const releaseDigest = sha256File(releasePath);
  const objects = parseObjects(releaseObjects);
  const inventory = readYaml(join(recipeRoot, "revisions", target.base, "r001", "rendered", "object-inventory.yaml"));
  const revision = readYaml(join(recipeRoot, "revisions", target.base, "r001", "variant-revision.yaml"));
  const renderReceipt = readYaml(join(recipeRoot, "revisions", target.base, "r001", "receipts", "render-receipt.yaml"));
  const equivalence = readYaml(join(recipeRoot, "revisions", target.base, "r001", "receipts", "helm-equivalence-receipt.yaml"));
  const scan = readYaml(join(recipeRoot, "revisions", target.base, "r001", "receipts", "scan-receipt.yaml"));
  const gate = readYaml(join(recipeRoot, "revisions", target.base, "r001", "receipts", "install-gate.yaml"));
  const packageReceipt = readYaml(join(recipeRoot, "publication", "installer-package-receipt.yaml"));

  check(inventory.spec.sourceSHA256 === releaseDigest, `${target.chart} ${target.base} inventory digest mismatch`);
  check(inventory.spec.objectCount === objects.length, `${target.chart} ${target.base} inventory object count mismatch`);
  check(revision.spec.digestInputs.renderedObjectSetSHA256 === releaseDigest, `${target.chart} ${target.base} revision digest mismatch`);
  check(renderReceipt.spec.outputs.renderedObjectSetSHA256 === releaseDigest, `${target.chart} ${target.base} render receipt digest mismatch`);
  check(equivalence.spec.regularHelm.renderedSHA256 === releaseDigest, `${target.chart} ${target.base} equivalence digest mismatch`);
  check(equivalence.spec.result === "pass", `${target.chart} ${target.base} equivalence must pass`);
  check(scan.spec.renderedObjectSetSHA256 === releaseDigest, `${target.chart} ${target.base} scan digest mismatch`);
  check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${target.chart} ${target.base} gate digest mismatch`);
  check(readFileSync(join(packageRoot, "bases", target.base, "upstream.yaml"), "utf8") === releaseObjects, `${target.chart} ${target.base} package upstream mismatch`);

  const setupCheck = (packageReceipt.spec.setupChecks ?? []).find((check) => check.base === target.base);
  check(Boolean(setupCheck), `${target.chart} ${target.base} missing publication setup check`);
  const packageResult = packageAndSetupCheck(target, packageRoot, target.base, releaseObjects, objects.length);
  check(setupCheck.semanticObjectMatches === packageResult.semanticObjectMatches, `${target.chart} ${target.base} semantic match drift`);
  check(setupCheck.cubInstallObjectCountIncludingSupport === packageResult.cubObjectCount, `${target.chart} ${target.base} cub object count drift`);
  check(setupCheck.separatedSecretCount === packageResult.separatedSecretCount, `${target.chart} ${target.base} separated secret count drift`);
  for (const identity of target.expectedAddedObjects) {
    check(objects.some((object) => object.identity === identity), `${target.chart} ${target.base} missing expected rendered object ${identity}`);
  }
}

function renderHelm(target) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-useful-base-"));
  try {
    const valuesPath = join(tempRoot, "values.yaml");
    write(valuesPath, `${toYaml(target.values)}\n`);
    const args = [
      "template",
      target.releaseName,
      target.chart,
      "--version",
      target.version,
      "--namespace",
      target.namespace,
      "--kube-version",
      kubeVersion,
      "--include-crds",
      "--skip-tests",
      "--no-hooks",
      "-f",
      valuesPath,
    ];
    const first = normalize(command("helm", args));
    const second = normalize(command("helm", args));
    return { first, second, firstDigest: sha256(first), secondDigest: sha256(second) };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function packageAndSetupCheck(target, packageRoot, base, releaseObjects, expectedObjectCount) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-useful-base-package-"));
  try {
    const firstPackage = join(tempRoot, `${artifactName(target)}-${base}-a.tgz`);
    const secondPackage = join(tempRoot, `${artifactName(target)}-${base}-b.tgz`);
    runCub(["installer", "package", packageRoot, "-o", firstPackage]);
    runCub(["installer", "package", packageRoot, "-o", secondPackage]);
    check(sha256File(firstPackage) === sha256File(secondPackage), `${target.chart} package SHA changed across two local bundles`);

    const workDir = join(tempRoot, "work");
    runCub([
      "installer",
      "setup",
      "--pull",
      packageRoot,
      "--base",
      base,
      "--work-dir",
      workDir,
      "--non-interactive",
      "--namespace",
      target.namespace,
    ]);
    const cubFiles = objectFilesFromDirs([join(workDir, "out", "manifests"), join(workDir, "out", "secrets")]);
    const cubYaml = cubFiles.map((file) => file.yaml).join("\n---\n");
    const semantic = canonicalObjectMaps(releaseObjects, cubYaml);
    const helmObjects = new Set(Object.keys(semantic.helm));
    const cubObjects = new Set(Object.keys(semantic.cub));
    check(helmObjects.size === expectedObjectCount, `${target.chart} ${base} Helm object count mismatch`);
    const missingFromCub = difference(helmObjects, cubObjects);
    check(missingFromCub.length === 0, `${target.chart} ${base} cub output missing Helm object(s): ${missingFromCub.join(", ")}`);
    const extraInCub = difference(cubObjects, helmObjects);
    const allowedExtras = new Set([`v1|Namespace||${target.namespace}`]);
    const unexpectedExtras = extraInCub.filter((identity) => !allowedExtras.has(identity));
    check(unexpectedExtras.length === 0, `${target.chart} ${base} unexpected cub-only objects: ${unexpectedExtras.join(", ")}`);
    const semanticDiffs = [];
    for (const key of helmObjects) {
      if (semantic.helm[key] !== semantic.cub[key]) semanticDiffs.push(key);
    }
    check(semanticDiffs.length === 0, `${target.chart} ${base} semantic diffs: ${semanticDiffs.join(", ")}`);
    return {
      bundleSHA256: sha256File(firstPackage),
      cubObjectCount: cubObjects.size,
      uploadedManifestFiles: cubFiles.length,
      separatedSecretCount: listYamlFiles(join(workDir, "out", "secrets")).length,
      semanticObjectMatches: `${helmObjects.size}/${helmObjects.size}`,
      extraInCub,
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function updateRecipe(target) {
  const path = join(repoRoot, "recipes", target.repository, target.name, target.version, "recipe.yaml");
  const recipe = readYaml(path);
  const variants = new Set(recipe.spec.variants ?? []);
  variants.add(`variants/${target.base}/variant.yaml`);
  recipe.spec.variants = [...variants].sort((left, right) => sortDefaultFirst(left, right));
  writeYaml(path, recipe);
}

function updateCatalogStatus(target) {
  const path = join(repoRoot, "recipes", target.repository, target.name, target.version, "catalog-status.yaml");
  const status = readYaml(path);
  const candidates = new Set(status.spec?.candidateVariants ?? []);
  candidates.add(target.base);
  status.spec.candidateVariants = [...candidates].sort(sortDefaultFirst);
  status.spec.notes = [
    ...(status.spec.notes ?? []).filter((note) => !String(note).includes(`${target.base} is a values-profile rerender`)),
    `${target.base} is a values-profile rerender that changes Helm inputs; catalog support still requires selected live evidence and production disposition.`,
  ];
  writeYaml(path, status);
}

function updateInstaller(target) {
  const path = join(repoRoot, "packages", target.repository, target.name, target.version, "installer.yaml");
  const installer = readYaml(path);
  const bases = (installer.spec.bases ?? []).filter((base) => base.name !== target.base);
  bases.push({
    name: target.base,
    path: `bases/${target.base}`,
    description: `${target.chart} ${target.base} useful base rendered with Prometheus monitor values`,
  });
  installer.spec.bases = bases.sort((left, right) => sortDefaultFirst(left.name, right.name));
  writeYaml(path, installer);
}

function updatePublicationReceipt(target, packageRoot, packageResult) {
  const path = join(repoRoot, "recipes", target.repository, target.name, target.version, "publication", "installer-package-receipt.yaml");
  const receipt = readYaml(path);
  receipt.spec.package.sourceFiles = listFiles(packageRoot).map((file) => ({
    path: file.slice(packageRoot.length + 1),
    sha256: sha256File(file),
    bytes: readFileSync(file).length,
  })).sort((left, right) => left.path.localeCompare(right.path));
  receipt.spec.deterministicBundle.sha256 = packageResult.bundleSHA256;
  const setupChecks = (receipt.spec.setupChecks ?? []).filter((check) => check.base !== target.base);
  setupChecks.push({
    variant: target.base,
    base: target.base,
    command: `cub installer setup --pull ${relativeRepo(packageRoot)} --base ${target.base} --work-dir <tmp> --non-interactive --namespace ${target.namespace}`,
    helmReleaseObjectCount: parseObjects(readFileSync(join(packageRoot, "bases", target.base, "upstream.yaml"), "utf8")).length,
    cubInstallObjectCountIncludingSupport: packageResult.cubObjectCount,
    semanticObjectMatches: packageResult.semanticObjectMatches,
    separatedSecretCount: packageResult.separatedSecretCount,
    allowedCubOnlyObjects: packageResult.extraInCub,
  });
  receipt.spec.setupChecks = setupChecks.sort((left, right) => sortDefaultFirst(left.base, right.base));
  writeYaml(path, receipt);
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
  for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
    findings.push({
      id: `crd-lifecycle-review:${identityFor(doc)}`,
      rule: "crd-lifecycle-review",
      severity: "medium",
      object: identityFor(doc),
      message: "CRD lifecycle and upgrade behavior require review",
    });
  }
  for (const doc of docs.filter((item) => ["MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"].includes(item.kind))) {
    findings.push({
      id: `webhook-readiness-review:${identityFor(doc)}`,
      rule: "webhook-readiness-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Webhook certificate and readiness behavior require observation after apply",
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
  for (const doc of docs.filter((item) => item.kind === "Secret")) {
    findings.push({
      id: `rendered-secret-review:${identityFor(doc)}`,
      rule: "rendered-secret-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Rendered Secret material or references require review before production promotion",
    });
  }
  const seen = new Set();
  return findings
    .sort((left, right) => left.id.localeCompare(right.id))
    .filter((finding) => {
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
      { id: "crd-lifecycle-review", severity: "medium" },
      { id: "webhook-readiness-review", severity: "medium" },
      { id: "apiservice-requires-observation", severity: "medium" },
      { id: "rendered-secret-review", severity: "medium" },
      { id: "privileged-container-review", severity: "medium" },
      { id: "host-namespace-review", severity: "medium" },
    ],
  };
}

function rendererSHA() {
  return sha256(
    JSON.stringify({
      renderer: "helm",
      helmVersion,
      kubeVersion,
      flags: ["--include-crds", "--skip-tests", "--no-hooks", "-f"],
    }),
  );
}

function normalize(text) {
  return `${text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n*$/, "")}\n`;
}

function artifactName(target) {
  return `${target.repository}-${target.name}-${target.version}`.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function labelsFor(target, variant) {
  return {
    "confighub.io/chart-ref": target.chart,
    "confighub.io/chart-version": target.version,
    "confighub.io/proof-tier": "next80-full",
    "confighub.io/variant": variant,
  };
}

function sortDefaultFirst(left, right) {
  if (left === right) return 0;
  if (left === "default" || String(left).includes("/default/")) return -1;
  if (right === "default" || String(right).includes("/default/")) return 1;
  return String(left).localeCompare(String(right));
}
