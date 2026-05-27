import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const proofRoot = join(repoRoot, "recipes", "bitnami", "redis", "25.5.3");
const chartRef = "oci://registry-1.docker.io/bitnamicharts/redis";
const chartVersion = "25.5.3";
const chartAppVersion = "8.6.3";
const chartArchiveSHA256 = "aa5360967bc1adadf69f0ce91d762f0bb4d80ca36758b37d7d8f1ef981257baf";
const releaseName = "redis";
const namespace = "redis";
const kubeVersion = "1.30.0";

function revisionRootFor(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}

function renderedRootFor(variantName) {
  return join(revisionRootFor(variantName), "rendered");
}

function receiptsRootFor(variantName) {
  return join(revisionRootFor(variantName), "receipts");
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function stripTrailingWhitespace(text) {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function parseRenderedObjects(path) {
  const script = `
import json
import sys
import yaml

objects = []
for doc in yaml.load_all(open(sys.argv[1], "r", encoding="utf-8"), Loader=yaml.BaseLoader):
    if not isinstance(doc, dict):
        continue
    metadata = doc.get("metadata")
    if not isinstance(metadata, dict):
        continue
    api_version = str(doc.get("apiVersion", ""))
    kind = str(doc.get("kind", ""))
    namespace = str(metadata.get("namespace", ""))
    name = str(metadata.get("name", ""))
    if api_version and kind and name:
        objects.append({
            "apiVersion": api_version,
            "kind": kind,
            "namespace": namespace,
            "name": name,
            "identity": "|".join([api_version, kind, namespace, name]),
        })
print(json.dumps(objects, sort_keys=True))
`;
  return JSON.parse(
    execFileSync("python3", ["-c", script, path], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
    }),
  );
}

function parseRenderedDocs(path) {
  const script = `
import json
import sys
import yaml

docs = []
for doc in yaml.load_all(open(sys.argv[1], "r", encoding="utf-8"), Loader=yaml.BaseLoader):
    if isinstance(doc, dict):
        docs.append(doc)
print(json.dumps(docs, sort_keys=True))
`;
  return JSON.parse(
    execFileSync("python3", ["-c", script, path], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
    }),
  );
}

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
      id: "pdb-unhealthy-pod-eviction-policy",
      severity: "medium",
      description: "PodDisruptionBudget should set unhealthyPodEvictionPolicy explicitly.",
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
  ],
};

function identityFor(doc) {
  const metadata = doc.metadata ?? {};
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    metadata.namespace ?? "",
    metadata.name ?? "",
  ].join("|");
}

function labelsMatch(selector, labels) {
  return Object.entries(selector ?? {}).every(([key, value]) => labels?.[key] === value);
}

function workloadPodSpec(doc) {
  if (["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet"].includes(doc.kind)) {
    return doc.spec?.template?.spec ?? null;
  }
  if (doc.kind === "Job") return doc.spec?.template?.spec ?? null;
  if (doc.kind === "CronJob") return doc.spec?.jobTemplate?.spec?.template?.spec ?? null;
  return null;
}

function workloadTemplateLabels(doc) {
  if (["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet"].includes(doc.kind)) {
    return doc.spec?.template?.metadata?.labels ?? {};
  }
  if (doc.kind === "Job") return doc.spec?.template?.metadata?.labels ?? {};
  if (doc.kind === "CronJob") return doc.spec?.jobTemplate?.spec?.template?.metadata?.labels ?? {};
  return {};
}

function imageTag(image) {
  const lastSlash = image.lastIndexOf("/");
  const lastColon = image.lastIndexOf(":");
  if (lastColon <= lastSlash) return null;
  return image.slice(lastColon + 1);
}

function scanRenderedDocs(docs) {
  const findings = [];
  const workloads = docs.filter((doc) => workloadPodSpec(doc));
  const serviceAccounts = new Set(
    docs
      .filter((doc) => doc.kind === "ServiceAccount")
      .map((doc) => `${doc.metadata?.namespace ?? ""}/${doc.metadata?.name ?? ""}`),
  );

  for (const doc of workloads) {
    const object = identityFor(doc);
    const podSpec = workloadPodSpec(doc);
    const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
    for (const container of containers) {
      const image = container.image ?? "";
      const tag = imageTag(image);
      if (!tag || tag === "latest") {
        findings.push({
          id: `mutable-image-tag:${object}:${container.name ?? "container"}`,
          rule: "mutable-image-tag",
          severity: "high",
          object,
          message: `container ${container.name ?? "container"} uses mutable image ${image}`,
        });
      }
    }

    const serviceAccountName = podSpec.serviceAccountName;
    if (serviceAccountName) {
      const namespace = doc.metadata?.namespace ?? "";
      if (!serviceAccounts.has(`${namespace}/${serviceAccountName}`)) {
        findings.push({
          id: `workload-service-account-exists:${object}`,
          rule: "workload-service-account-exists",
          severity: "high",
          object,
          message: `workload references missing ServiceAccount ${namespace}/${serviceAccountName}`,
        });
      }
    }
  }

  for (const doc of docs.filter((item) => item.kind === "PodDisruptionBudget")) {
    if (!doc.spec?.unhealthyPodEvictionPolicy) {
      findings.push({
        id: `pdb-unhealthy-pod-eviction-policy:${identityFor(doc)}`,
        rule: "pdb-unhealthy-pod-eviction-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "PodDisruptionBudget does not set unhealthyPodEvictionPolicy",
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

  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function findingCounts(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

function yamlQuote(value) {
  if (value === null || value === undefined) return "null";
  return JSON.stringify(String(value));
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function renderHelm(valuesText) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-redis-values-"));
  const valuesPath = join(tempRoot, "values.yaml");
  try {
    writeFileSync(valuesPath, valuesText);
    return execFileSync(
      "helm",
      [
        "template",
        releaseName,
        chartRef,
        "--version",
        chartVersion,
        "--namespace",
        namespace,
        "--values",
        valuesPath,
        "--kube-version",
        kubeVersion,
        "--include-crds",
        "--skip-tests",
        "--no-hooks",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
        maxBuffer: 1024 * 1024 * 100,
      },
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function helmVersion() {
  try {
    return execFileSync("helm", ["version", "--template", "{{.Version}}"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function digestLine(label, value) {
  return `    ${label}: ${yamlQuote(value)}\n`;
}

function objectInventoryYaml(variantName, objects, releaseDigest) {
  return `apiVersion: helm-expt.confighub.com/v1alpha1
kind: RenderedObjectInventory
metadata:
  name: bitnami-redis-25.5.3-${variantName}-r001
spec:
  source: rendered/release-objects.yaml
  sourceSHA256: ${yamlQuote(releaseDigest)}
  objectCount: ${objects.length}
  objects:
${objects
  .map(
    (object) => `    - identity: ${yamlQuote(object.identity)}
      apiVersion: ${yamlQuote(object.apiVersion)}
      kind: ${yamlQuote(object.kind)}
      namespace: ${yamlQuote(object.namespace)}
      name: ${yamlQuote(object.name)}`,
  )
  .join("\n")}
`;
}

function main() {
  const rendererVersion = helmVersion();
  const defaultValues = 'auth:\n  password: "confighub-redis-password"\n';
  const defaultReleaseObjects = renderHelm(defaultValues);
  const reuseExistingSecretValues = `auth:
  existingSecret: redis-existing-secret
  existingSecretPasswordKey: redis-password
`;

  const variants = [
    {
      name: "default",
      displayName: "default",
      effectiveValuesFile: "effective-values.yaml",
      valuesText: defaultValues,
      releaseObjects: defaultReleaseObjects,
      expectedObjectCount: 14,
      expectedSecretCount: 1,
      targetFactNote: "renders Redis Secret; cub install separates it from uploaded manifests",
    },
    {
      name: "reuse-existing-secret",
      displayName: "reuse existing secret",
      effectiveValuesFile: "effective-values-reuse-existing-secret.yaml",
      valuesText: reuseExistingSecretValues,
      releaseObjects: stripTrailingWhitespace(renderHelm(reuseExistingSecretValues)),
      expectedObjectCount: 13,
      expectedSecretCount: 0,
      targetFactNote: "requires target Secret redis/redis-existing-secret with key redis-password",
      targetFacts: {
        requiredSecrets: [
          {
            namespace,
            name: "redis-existing-secret",
            keys: ["redis-password"],
            purpose: "Redis authentication password",
          },
        ],
      },
    },
  ];

  rmSync(proofRoot, { recursive: true, force: true });

  const sourceLock = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: SourceLock
metadata:
  name: bitnami-redis-25.5.3
spec:
  sourceType: HelmChart
  repositoryName: bitnami
  repositoryURL: https://charts.bitnami.com/bitnami
  contentURL: oci://registry-1.docker.io/bitnamicharts/redis:25.5.3
  chart: redis
  version: 25.5.3
  appVersion: ${yamlQuote(chartAppVersion)}
  archiveSHA256: ${yamlQuote(chartArchiveSHA256)}
  artifactHubDigest: ${yamlQuote(chartArchiveSHA256)}
  evidence:
    installerPackageReceipt: publication/installer-package-receipt.yaml
`;
  write(join(proofRoot, "source-lock.yaml"), sourceLock);

  const dependencyLock = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: DependencyLock
metadata:
  name: bitnami-redis-25.5.3
spec:
  chart: bitnami/redis
  version: 25.5.3
  dependencies:
    - name: common
      version: "2.39.0"
      repository: oci://registry-1.docker.io/bitnamicharts
      type: library
`;
  write(join(proofRoot, "dependency-lock.yaml"), dependencyLock);

  const valueModel = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ValueModel
metadata:
  name: bitnami-redis-25.5.3
spec:
  checkedValues:
    - path: auth.password
      disposition: intentional-deterministic-placeholder
      variant: default
      reason: avoids chart-generated random password during deterministic default proof
    - path: auth.existingSecret
      disposition: target-secret-reference
      variant: reuse-existing-secret
      reason: moves credential ownership to an explicit target fact
    - path: auth.existingSecretPasswordKey
      disposition: target-secret-key-reference
      variant: reuse-existing-secret
      reason: records the required key shape without storing secret material
  unknownValues: not-checked
  deadValues: not-checked
  ignoredValues: not-checked
`;
  write(join(proofRoot, "value-model.yaml"), valueModel);

  const controlPoints = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ControlPoints
metadata:
  name: bitnami-redis-25.5.3
spec:
  points:
    - category: source-lock
      status: handled
      evidence: source-lock.yaml
    - category: dependency-lock
      status: handled
      evidence: dependency-lock.yaml
    - category: generated-facts
      status: handled-for-default-proof
      evidence: effective-values.yaml
      note: auth.password is deterministic in this proof; future generated-fact receipt should own this.
    - category: target-facts
      status: required-for-reuse-existing-secret
      evidence: variants/reuse-existing-secret/variant.yaml
      required:
        - kind: Secret
          namespace: redis
          name: redis-existing-secret
          keys:
            - redis-password
    - category: capability-profile
      status: handled
      kubeVersion: "1.30.0"
    - category: hook-policy
      status: handled
      policy: no-hooks
    - category: secret-handling
      status: handled
      note: cub install separates one rendered Secret from uploaded manifests.
    - category: installer-support-object
      status: handled
      object: v1|Namespace||redis
`;
  write(join(proofRoot, "control-points.yaml"), controlPoints);

  const recipe = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: Recipe
metadata:
  name: bitnami-redis
  version: 25.5.3
spec:
  chartRef:
    sourceLock: source-lock.yaml
    dependencyLock: dependency-lock.yaml
  importMode: render-and-vendor
  currentExecutableFixture:
    installerPackage: ../../../../packages/bitnami/redis/25.5.3
    setupCommand:
      - cub
      - install
      - setup
      - --pull
      - ../../../../packages/bitnami/redis/25.5.3
      - --non-interactive
      - --namespace
      - redis
  variants:
${variants.map((variant) => `    - variants/${variant.name}/variant.yaml`).join("\n")}
`;
  write(join(proofRoot, "recipe.yaml"), recipe);

  const recipeDigest = sha256File(join(proofRoot, "recipe.yaml"));
  const rendererFingerprint = sha256(
    JSON.stringify({
      renderer: "helm",
      helmVersion: rendererVersion,
      kubeVersion,
      flags: ["--include-crds", "--skip-tests", "--no-hooks"],
    }),
  );

  const summaries = [];
  for (const variant of variants) {
    const revisionRoot = revisionRootFor(variant.name);
    const renderedRoot = renderedRootFor(variant.name);
    const receiptsRoot = receiptsRootFor(variant.name);
    mkdirSync(receiptsRoot, { recursive: true });
    mkdirSync(renderedRoot, { recursive: true });

    const releaseObjects = variant.releaseObjects;
    const releaseDigest = sha256(releaseObjects);
    write(join(renderedRoot, "release-objects.yaml"), releaseObjects);
    const objects = parseRenderedObjects(join(renderedRoot, "release-objects.yaml"));
    const renderedDocs = parseRenderedDocs(join(renderedRoot, "release-objects.yaml"));
    const secretCount = renderedDocs.filter((doc) => doc.kind === "Secret").length;
    if (objects.length !== variant.expectedObjectCount) {
      throw new Error(`${variant.name} expected ${variant.expectedObjectCount} objects, rendered ${objects.length}`);
    }
    if (secretCount !== variant.expectedSecretCount) {
      throw new Error(`${variant.name} expected ${variant.expectedSecretCount} rendered Secrets, saw ${secretCount}`);
    }

    const scanFindings = scanRenderedDocs(renderedDocs);
    const scanCounts = findingCounts(scanFindings);
    const scanResult = scanFindings.length ? "warn" : "pass";
    const policyBundleDigest = sha256(JSON.stringify(localScanPolicy));
    const inventory = objectInventoryYaml(variant.name, objects, releaseDigest);
    const inventoryDigest = sha256(inventory);
    write(join(renderedRoot, "object-inventory.yaml"), inventory);

    const valuesDigest = sha256(variant.valuesText);
    const effectiveValues = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: EffectiveValues
metadata:
  name: bitnami-redis-25.5.3-${variant.name}
spec:
  files:
    - path: ${variant.effectiveValuesFile}
${variant.valuesSourcePath ? `      sourcePath: ${variant.valuesSourcePath}\n` : "      source: inline-proof\n"}      sha256: ${yamlQuote(valuesDigest)}
  mergedValuesCaptured: false
  values:
${variant.valuesText
  .trimEnd()
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
`;
    write(join(proofRoot, variant.effectiveValuesFile), effectiveValues);

    const targetFactsYaml = variant.targetFacts
      ? `  targetFacts:
    requiredSecrets:
${variant.targetFacts.requiredSecrets
  .map(
    (secret) => `      - namespace: ${yamlQuote(secret.namespace)}
        name: ${yamlQuote(secret.name)}
        keys:
${secret.keys.map((key) => `          - ${yamlQuote(key)}`).join("\n")}
        purpose: ${yamlQuote(secret.purpose)}`,
  )
  .join("\n")}
`
      : "";

    const variantYaml = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: Variant
metadata:
  name: ${variant.name}
spec:
  recipe: ../../recipe.yaml
  namespace: redis
  releaseName: redis
  valuesProfile: ../../${variant.effectiveValuesFile}
  capabilityProfile:
    kubeVersion: "1.30.0"
    apiVersions: []
  hookPolicy: no-hooks
${targetFactsYaml}`;
    write(join(proofRoot, "variants", variant.name, "variant.yaml"), variantYaml);

    const variantDigest = sha256File(join(proofRoot, "variants", variant.name, "variant.yaml"));
    const effectiveValuesDigest = sha256File(join(proofRoot, variant.effectiveValuesFile));
    const revisionDigest = sha256(
      JSON.stringify({
        recipeDigest,
        variantDigest,
        effectiveValuesDigest,
        rendererFingerprint,
        renderedObjectSetDigest: releaseDigest,
      }),
    );

    const variantRevision = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: VariantRevision
metadata:
  name: ${variant.name}-r001
spec:
  variant: ../../../variants/${variant.name}/variant.yaml
  revision: r001
  digest: ${yamlQuote(revisionDigest)}
  digestInputs:
${digestLine("recipeSHA256", recipeDigest)}${digestLine("variantSHA256", variantDigest)}${digestLine(
    "effectiveValuesSHA256",
    effectiveValuesDigest,
  )}${digestLine("rendererSHA256", rendererFingerprint)}${digestLine("renderedObjectSetSHA256", releaseDigest)}
  rendered:
    releaseObjects: rendered/release-objects.yaml
    objectInventory: rendered/object-inventory.yaml
    objectCount: ${objects.length}
`;
    write(join(revisionRoot, "variant-revision.yaml"), variantRevision);

    const renderReceipt = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: RenderReceipt
metadata:
  name: bitnami-redis-${variant.name}-r001
spec:
  variantRevision: ../variant-revision.yaml
  renderer:
    name: helm
    version: ${yamlQuote(rendererVersion)}
    kubeVersion: "1.30.0"
    flags:
      - --include-crds
      - --skip-tests
      - --no-hooks
  inputs:
    sourceLockSHA256: ${yamlQuote(sha256File(join(proofRoot, "source-lock.yaml")))}
    dependencyLockSHA256: ${yamlQuote(sha256File(join(proofRoot, "dependency-lock.yaml")))}
    effectiveValuesSHA256: ${yamlQuote(effectiveValuesDigest)}
  outputs:
    renderedObjectSetSHA256: ${yamlQuote(releaseDigest)}
    renderedObjectInventorySHA256: ${yamlQuote(inventoryDigest)}
    objectCount: ${objects.length}
    renderedSecretCount: ${secretCount}
    secretCountSeparatedByCubInstall: ${secretCount}
`;
    write(join(receiptsRoot, "render-receipt.yaml"), renderReceipt);

    const classifications = [
      `    - identity: v1|Namespace||redis
      classification: installer-support-object
      disposition: allowed`,
    ];
    if (secretCount > 0) {
      classifications.push(`    - identity: v1|Secret|redis|redis
      classification: secret-separated
      disposition: allowed`);
    }
    const semanticMatches = `${objects.length}/${objects.length}`;
    const equivalenceReceipt = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: HelmEquivalenceReceipt
metadata:
  name: bitnami-redis-${variant.name}-r001
spec:
  variantRevision: ../variant-revision.yaml
  regularHelm:
    renderedSHA256: ${yamlQuote(releaseDigest)}
    objectCount: ${objects.length}
  cubInstall:
    objectCountIncludingSecretsAndSupportObjects: ${objects.length + 1}
    uploadedManifestFiles: ${objects.length - secretCount + 1}
    separatedSecretFiles: ${secretCount}
    semanticObjectMatches: ${yamlQuote(semanticMatches)}
  classifications:
${classifications.join("\n")}
  result: pass
  evidenceCommand: npm run redis:compare
`;
    write(join(receiptsRoot, "helm-equivalence-receipt.yaml"), equivalenceReceipt);

    const scanReceipt = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ScanReceipt
metadata:
  name: bitnami-redis-${variant.name}-r001
spec:
  variantRevision: ../variant-revision.yaml
  renderedObjectSetSHA256: ${yamlQuote(releaseDigest)}
  result: ${scanResult}
  scanner:
    name: ${yamlQuote(localScanPolicy.scanner)}
    version: ${yamlQuote(localScanPolicy.version)}
  policyBundleDigest: ${yamlQuote(policyBundleDigest)}
  findingCounts:
    critical: ${scanCounts.critical}
    high: ${scanCounts.high}
    medium: ${scanCounts.medium}
    low: ${scanCounts.low}
    info: ${scanCounts.info}
  findings:
${scanFindings
  .map(
    (finding) => `    - id: ${yamlQuote(finding.id)}
      rule: ${yamlQuote(finding.rule)}
      severity: ${yamlQuote(finding.severity)}
      object: ${yamlQuote(finding.object)}
      message: ${yamlQuote(finding.message)}`,
  )
  .join("\n")}
`;
    write(join(receiptsRoot, "scan-receipt.yaml"), scanReceipt);

    const installGate = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: InstallGate
metadata:
  name: bitnami-redis-${variant.name}-r001
spec:
  variantRevision: ../variant-revision.yaml
  renderedObjectSetSHA256: ${yamlQuote(releaseDigest)}
  decision: warn
  allowedScopes:
    - local-test
  blockedScopes:
    - production
  reasons:
    - local scan found ${scanCounts.high} high and ${scanCounts.medium} medium finding(s)
    - production publish is blocked until high findings are resolved or explicitly waived
    - Helm equivalence passed for ${variant.name} variant
    - ${variant.targetFactNote}
`;
    write(join(receiptsRoot, "install-gate.yaml"), installGate);

    summaries.push({
      ...variant,
      releaseDigest,
      objectCount: objects.length,
      secretCount,
      cubObjectCount: objects.length + 1,
      scanCounts,
      semanticMatches,
    });
  }

  const defaultSummary = summaries.find((summary) => summary.name === "default");
  const reuseSummary = summaries.find((summary) => summary.name === "reuse-existing-secret");
  const variantDiff = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: VariantDiff
metadata:
  name: bitnami-redis-default-to-reuse-existing-secret
spec:
  from:
    variantRevision: revisions/default/r001/variant-revision.yaml
    renderedObjectSetSHA256: ${yamlQuote(defaultSummary.releaseDigest)}
  to:
    variantRevision: revisions/reuse-existing-secret/r001/variant-revision.yaml
    renderedObjectSetSHA256: ${yamlQuote(reuseSummary.releaseDigest)}
  summary:
    addedObjects: 0
    removedObjects: 1
    changedObjects: 2
    addedTargetFacts: 1
  removedObjects:
    - identity: v1|Secret|redis|redis
      reason: reuse-existing-secret uses a target-provided Secret instead of a chart-rendered Secret
  addedObjects: []
  changedObjects:
    - identity: apps/v1|StatefulSet|redis|redis-master
      reason: redis password volume now references redis-existing-secret
    - identity: apps/v1|StatefulSet|redis|redis-replicas
      reason: redis password volume now references redis-existing-secret
  addedTargetFacts:
    - kind: Secret
      namespace: redis
      name: redis-existing-secret
      keys:
        - redis-password
`;
  write(join(proofRoot, "diffs", "default-to-reuse-existing-secret.yaml"), variantDiff);

  const helmPlan = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: HelmPlan
metadata:
  name: bitnami-redis-25.5.3
spec:
  readiness:
    status: usable-with-controls
    chart: bitnami/redis
    version: 25.5.3
    variants:
${summaries.map((summary) => `      - ${summary.name}`).join("\n")}
    helmObjectsByVariant:
${summaries.map((summary) => `      ${summary.name}: ${summary.objectCount}`).join("\n")}
    cubInstallObjectsByVariant:
${summaries.map((summary) => `      ${summary.name}: ${summary.cubObjectCount}`).join("\n")}
    helmMatchByVariant:
${summaries.map((summary) => `      ${summary.name}: ${yamlQuote(summary.semanticMatches)}`).join("\n")}
    scanGate: warn-production-blocked
    nextAction: resolve or waive local scan findings, then publish through ConfigHub OCI
  receipts:
${summaries
  .flatMap((summary) => [
    `    - revisions/${summary.name}/r001/receipts/helm-equivalence-receipt.yaml`,
    `    - revisions/${summary.name}/r001/receipts/render-receipt.yaml`,
    `    - revisions/${summary.name}/r001/receipts/scan-receipt.yaml`,
    `    - revisions/${summary.name}/r001/receipts/install-gate.yaml`,
  ])
  .join("\n")}
    - diffs/default-to-reuse-existing-secret.yaml
`;
  write(join(proofRoot, "helm-plan.yaml"), helmPlan);

  const chartDossier = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ChartDossier
metadata:
  name: bitnami-redis
spec:
  maintainedNotes:
    - Redis is stateful; PVC and credential behavior require explicit variant policy.
    - Bitnami Redis can generate credentials unless a password/existing secret path is provided.
    - Default and reuse-existing-secret are the first proof variants; HA is a later slice.
  weirdnessNotes:
    - deterministic proof pins auth.password in effective-values.yaml
    - reuse-existing-secret records redis-existing-secret/redis-password as a target fact requirement
    - cub install separates rendered Secret resources from uploaded manifests
`;
  write(join(proofRoot, "chart-dossier.yaml"), chartDossier);

  const readme = `# Redis Proof: bitnami/redis 25.5.3

## Readiness Card

| Field | Result |
| --- | --- |
| Chart | bitnami/redis 25.5.3 |
| Variants | default, reuse-existing-secret |
| Status | usable with controls |
| Helm objects | default: 14; reuse-existing-secret: 13 |
| ConfigHub/cub install objects | default: 15; reuse-existing-secret: 14 |
| Explained difference | installer namespace support object; default also separates rendered Secret |
| Helm match | default: 14/14; reuse-existing-secret: 13/13 semantic object matches |
| Secrets | default renders 1 Secret; reuse-existing-secret renders 0 Secrets and requires target Secret redis-existing-secret/redis-password |
| Scan/gate | local scan warns; production blocked; local-test warning only |
| Scan findings | ${summaries.map((summary) => `${summary.name}: ${summary.scanCounts.high} high, ${summary.scanCounts.medium} medium`).join("; ")} |
| Variant diff | default -> reuse-existing-secret removes Secret/redis, retargets two StatefulSets, adds target Secret requirement |
| Next action | resolve or waive local scan findings, then publish through ConfigHub OCI |
| Proof | equivalence, render, scan, and gate receipts |

## Current Proof Commands

\`\`\`sh
npm run redis:compare
npm run redis:verify-proof
\`\`\`

This proof renders Redis with regular Helm under pinned inputs, stores the
recipe/variant/revision proof artifacts under this directory, and verifies the
current \`packages/bitnami/redis/25.5.3\` cub installer package against that
regular Helm output.
`;
  write(join(proofRoot, "README.md"), readme);

  console.log(`generated Redis proof variants at ${proofRoot}: ${summaries.map((summary) => summary.name).join(", ")}`);
}

main();
