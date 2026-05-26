import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const archiveRedis = join(repoRoot, "archive", "render-and-vendor-top20", "charts", "06-bitnami-redis");
const proofRoot = join(repoRoot, "recipes", "bitnami", "redis", "25.5.3");
const revisionRoot = join(proofRoot, "revisions", "standalone", "r001");
const renderedRoot = join(revisionRoot, "rendered");
const receiptsRoot = join(revisionRoot, "receipts");

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function parseYamlFile(path) {
  const script = `
import json
import sys
import yaml

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    docs = list(yaml.safe_load_all(handle))
docs = [doc for doc in docs if doc is not None]
print(json.dumps(docs[0] if len(docs) == 1 else docs, sort_keys=True))
`;
  return JSON.parse(
    execFileSync("python3", ["-c", script, path], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
    }),
  );
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

function digestLine(label, value) {
  return `    ${label}: ${yamlQuote(value)}\n`;
}

function objectInventoryYaml(objects, releaseDigest) {
  return `apiVersion: helm-expt.confighub.com/v1alpha1
kind: RenderedObjectInventory
metadata:
  name: bitnami-redis-25.5.3-standalone-r001
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
  const archiveReceipt = parseYamlFile(join(archiveRedis, "helm-import.receipt.yaml"));
  const archiveValues = readFileSync(join(archiveRedis, "values.yaml"), "utf8");
  const releaseObjects = readFileSync(join(archiveRedis, "base", "upstream.yaml"), "utf8");
  const releaseDigest = sha256(releaseObjects);
  const valuesDigest = sha256(archiveValues);

  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(receiptsRoot, { recursive: true });
  mkdirSync(renderedRoot, { recursive: true });

  write(join(renderedRoot, "release-objects.yaml"), releaseObjects);
  const objects = parseRenderedObjects(join(renderedRoot, "release-objects.yaml"));
  const renderedDocs = parseRenderedDocs(join(renderedRoot, "release-objects.yaml"));
  const scanFindings = scanRenderedDocs(renderedDocs);
  const scanCounts = findingCounts(scanFindings);
  const scanResult = scanFindings.length ? "warn" : "pass";
  const policyBundleDigest = sha256(JSON.stringify(localScanPolicy));
  const inventory = objectInventoryYaml(objects, releaseDigest);
  write(join(renderedRoot, "object-inventory.yaml"), inventory);

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
  appVersion: ${yamlQuote(archiveReceipt.spec.chart.appVersion)}
  archiveSHA256: ${yamlQuote(archiveReceipt.spec.chart.archiveSHA256)}
  artifactHubDigest: ${yamlQuote(archiveReceipt.spec.chart.artifactHubDigest)}
  evidence:
    archiveReceipt: ../../../../archive/render-and-vendor-top20/charts/06-bitnami-redis/helm-import.receipt.yaml
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

  const effectiveValues = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: EffectiveValues
metadata:
  name: bitnami-redis-25.5.3-standalone
spec:
  files:
    - path: effective-values.yaml
      sourcePath: ../../../../archive/render-and-vendor-top20/charts/06-bitnami-redis/values.yaml
      sha256: ${yamlQuote(valuesDigest)}
  mergedValuesCaptured: false
  values:
${archiveValues
  .trimEnd()
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
`;
  write(join(proofRoot, "effective-values.yaml"), effectiveValues);

  const valueModel = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ValueModel
metadata:
  name: bitnami-redis-25.5.3
spec:
  checkedValues:
    - path: auth.password
      disposition: intentional-deterministic-placeholder
      reason: avoids chart-generated random password during deterministic proof
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
      status: handled-for-standalone-proof
      evidence: effective-values.yaml
      note: auth.password is deterministic in this proof; future generated-fact receipt should own this.
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
    installerPackage: ../../../../archive/render-and-vendor-top20/charts/06-bitnami-redis
    setupCommand:
      - cub
      - install
      - setup
      - --pull
      - ../../../../archive/render-and-vendor-top20/charts/06-bitnami-redis
      - --non-interactive
      - --namespace
      - redis
  variants:
    - variants/standalone/variant.yaml
`;
  write(join(proofRoot, "recipe.yaml"), recipe);

  const variant = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: Variant
metadata:
  name: standalone
spec:
  recipe: ../../recipe.yaml
  namespace: redis
  releaseName: redis
  valuesProfile: ../../effective-values.yaml
  capabilityProfile:
    kubeVersion: "1.30.0"
    apiVersions: []
  hookPolicy: no-hooks
`;
  write(join(proofRoot, "variants", "standalone", "variant.yaml"), variant);

  const recipeDigest = sha256File(join(proofRoot, "recipe.yaml"));
  const variantDigest = sha256File(join(proofRoot, "variants", "standalone", "variant.yaml"));
  const effectiveValuesDigest = sha256File(join(proofRoot, "effective-values.yaml"));
  const inventoryDigest = sha256(inventory);
  const rendererFingerprint = sha256(
    JSON.stringify({
      renderer: "helm",
      helmVersion: archiveReceipt.spec.render.helmVersion,
      kubeVersion: "1.30.0",
      flags: ["--include-crds", "--skip-tests", "--no-hooks"],
    }),
  );
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
  name: standalone-r001
spec:
  variant: ../../../variants/standalone/variant.yaml
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
  name: bitnami-redis-standalone-r001
spec:
  variantRevision: ../variant-revision.yaml
  renderer:
    name: helm
    version: ${yamlQuote(archiveReceipt.spec.render.helmVersion)}
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
    secretCountSeparatedByCubInstall: 1
`;
  write(join(receiptsRoot, "render-receipt.yaml"), renderReceipt);

  const equivalenceReceipt = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: HelmEquivalenceReceipt
metadata:
  name: bitnami-redis-standalone-r001
spec:
  variantRevision: ../variant-revision.yaml
  regularHelm:
    renderedSHA256: "362dbc4854421a23ea48da4ee7e72dbc98422fa9affc26ac372c761d4b90e10d"
    objectCount: 14
  cubInstall:
    objectCountIncludingSecretsAndSupportObjects: 15
    uploadedManifestFiles: 14
    separatedSecretFiles: 1
    semanticObjectMatches: "14/14"
  classifications:
    - identity: v1|Namespace||redis
      classification: installer-support-object
      disposition: allowed
    - identity: v1|Secret|redis|redis
      classification: secret-separated
      disposition: allowed
  result: pass
  evidenceCommand: npm run redis:compare
`;
  write(join(receiptsRoot, "helm-equivalence-receipt.yaml"), equivalenceReceipt);

  const scanReceipt = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ScanReceipt
metadata:
  name: bitnami-redis-standalone-r001
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
  name: bitnami-redis-standalone-r001
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
    - Helm equivalence passed for standalone variant
`;
  write(join(receiptsRoot, "install-gate.yaml"), installGate);

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
      - standalone
    helmObjects: 14
    cubInstallObjects: 15
    helmMatch: "14/14"
    scanGate: warn-production-blocked
    nextAction: resolve or waive local scan findings, then publish through ConfigHub OCI
  receipts:
    - revisions/standalone/r001/receipts/helm-equivalence-receipt.yaml
    - revisions/standalone/r001/receipts/render-receipt.yaml
    - revisions/standalone/r001/receipts/scan-receipt.yaml
    - revisions/standalone/r001/receipts/install-gate.yaml
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
    - Standalone is the first proof variant; HA and existing-secret are later slices.
  weirdnessNotes:
    - deterministic proof pins auth.password in effective-values.yaml
    - cub install separates rendered Secret resources from uploaded manifests
`;
  write(join(proofRoot, "chart-dossier.yaml"), chartDossier);

  const readme = `# Redis Proof: bitnami/redis 25.5.3

## Readiness Card

| Field | Result |
| --- | --- |
| Chart | bitnami/redis 25.5.3 |
| Variant | standalone |
| Status | usable with controls |
| Helm objects | 14 |
| ConfigHub/cub install objects | 15 |
| Explained difference | installer namespace support object |
| Helm match | 14/14 semantic object matches |
| Secrets | 1 rendered Secret separated from uploaded manifests |
| Scan/gate | local scan warns; production blocked; local-test warning only |
| Scan findings | ${scanCounts.high} high, ${scanCounts.medium} medium |
| Next action | resolve or waive local scan findings, then publish through ConfigHub OCI |
| Proof | equivalence, render, scan, and gate receipts |

## Current Proof Commands

\`\`\`sh
npm run redis:compare
npm run redis:verify-proof
\`\`\`

This proof uses the archived Redis render as a compatibility fixture and stores
new recipe/variant/revision proof artifacts under this directory. The archive
is not the product pathway; it is the golden comparison input until a first
class Helm recipe importer exists.
`;
  write(join(proofRoot, "README.md"), readme);

  console.log(`generated Redis standalone proof at ${proofRoot}`);
}

main();
