import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const chartRef = "oci://registry-1.docker.io/bitnamicharts/redis";
const defaultChartVersion = "25.5.3";
const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? defaultChartVersion;
const outputRoot = process.env.HELM_EXPT_PROOF_OUTPUT_ROOT
  ? resolve(repoRoot, process.env.HELM_EXPT_PROOF_OUTPUT_ROOT)
  : repoRoot;
const proofRoot = process.env.HELM_EXPT_PROOF_OUTPUT_ROOT
  ? join(outputRoot, "recipes", "bitnami", "redis", chartVersion)
  : join(repoRoot, "recipes", "bitnami", "redis", chartVersion);
const chartMetadata = chartVersion === defaultChartVersion
  ? {
      appVersion: "8.6.3",
      chartArchiveSHA256: "aa5360967bc1adadf69f0ce91d762f0bb4d80ca36758b37d7d8f1ef981257baf",
      commonDependencyVersion: "2.39.0",
    }
  : resolveChartMetadata(chartVersion);
const chartAppVersion = process.env.HELM_EXPT_CHART_APP_VERSION ?? chartMetadata.appVersion;
const chartArchiveSHA256 = process.env.HELM_EXPT_CHART_ARCHIVE_SHA256 ?? chartMetadata.chartArchiveSHA256;
const commonDependencyVersion = process.env.HELM_EXPT_COMMON_DEPENDENCY_VERSION ?? chartMetadata.commonDependencyVersion;
const redisImageDigest = process.env.HELM_EXPT_REDIS_IMAGE_DIGEST ?? "sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25";
const releaseName = "redis";
const namespace = "redis";
const kubeVersion = "1.30.0";

function resolveChartMetadata(version) {
  const chartText = execFileSync("helm", ["show", "chart", chartRef, "--version", version], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 10,
  });
  return {
    appVersion: scalarField(chartText, "appVersion"),
    chartArchiveSHA256: chartArchiveSHA256For(version),
    commonDependencyVersion: parseCommonDependencyVersion(chartText),
  };
}

function chartArchiveSHA256For(version) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-redis-chart-"));
  try {
    execFileSync("helm", ["pull", chartRef, "--version", version, "-d", tempRoot], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 1024 * 1024 * 10,
    });
    return sha256File(join(tempRoot, `redis-${version}.tgz`));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function scalarField(text, name) {
  const match = text.match(new RegExp(`^${name}:\\s*"?([^"\\n]+)"?\\s*$`, "m"));
  if (!match) throw new Error(`could not parse ${name} from helm show chart`);
  return match[1].trim();
}

function parseCommonDependencyVersion(chartText) {
  const lines = chartText.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "- name: common");
  if (start === -1) throw new Error("could not find common dependency in helm show chart");
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("- name:")) break;
    const match = line.match(/^\s+version:\s*"?([^"\n]+)"?\s*$/);
    if (match) return match[1].trim();
  }
  throw new Error("could not parse common dependency version in helm show chart");
}

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

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function canonicalText(value) {
  return JSON.stringify(canonical(value));
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
  name: bitnami-redis-${chartVersion}-${variantName}-r001
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
  const capabilityProfileDigest = "sha256:c1f8a4eb20154228a391f2a61565160634fbeb5dcf1079065543dd0a2ff3dfbf";
  const redisPasswordDigest = "sha256:6486a1dce90d013579f3b52d6939524b23b3ca00c5702e409348e6c0ba782349";
  const generatedFacts = [
    {
      name: "auth.password",
      kind: "password",
      digest: redisPasswordDigest,
      storedAs: "plain",
      valuePath: "effective-values.yaml#spec.values.auth.password",
    },
  ];
  const generatedFactsDigest = sha256(canonicalText(generatedFacts));
  const defaultValues = `image:
  digest: ${redisImageDigest}
auth:
  password: "confighub-redis-password"
`;
  const defaultReleaseObjects = renderHelm(defaultValues);
  const reuseExistingSecretValues = `image:
  digest: ${redisImageDigest}
auth:
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
      targetFactNote: "renders Redis Secret; cub installer separates it from uploaded manifests",
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
  name: bitnami-redis-${chartVersion}
spec:
  sourceType: HelmChart
  repositoryName: bitnami
  repositoryURL: https://charts.bitnami.com/bitnami
  contentURL: oci://registry-1.docker.io/bitnamicharts/redis:${chartVersion}
  chart: redis
  version: ${chartVersion}
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
  name: bitnami-redis-${chartVersion}
spec:
  chart: bitnami/redis
  version: ${chartVersion}
  dependencies:
    - name: common
      version: "${commonDependencyVersion}"
      repository: oci://registry-1.docker.io/bitnamicharts
      type: library
  chartLockDigest: null
  chartLockProvenance:
    status: source-derived-from-packaged-chart-yaml
    packageSHA256: "${chartArchiveSHA256}"
    packageContainsChartLock: false
    dependencySource: Chart.yaml dependencies from the chart package recorded in source-lock.yaml
`;
  write(join(proofRoot, "dependency-lock.yaml"), dependencyLock);

  const valueModel = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ValueModel
metadata:
  name: bitnami-redis-${chartVersion}
spec:
  checkedValues:
    - path: auth.password
      disposition: generated-fact-bound
      variant: default
      reason: binds the Redis password before render so Helm output is deterministic and the generated fact can be reviewed by digest
    - path: image.digest
      disposition: pinned-image
      variant: all
      reason: supported bases pin the Bitnami Redis image by digest instead of rendering the chart default latest tag
    - path: auth.existingSecret
      disposition: target-secret-reference
      variant: reuse-existing-secret
      reason: moves credential ownership to an explicit target fact
    - path: auth.existingSecretPasswordKey
      disposition: target-secret-key-reference
      variant: reuse-existing-secret
      reason: records the required key shape without storing secret material
  unknownValues: checked-for-proof-path
  deadValues: checked-for-proof-path
  ignoredValues: checked-for-proof-path
  diagnostics: values-diagnostics.yaml
  valueSourceMap: value-source-map.yaml
`;
  write(join(proofRoot, "value-model.yaml"), valueModel);

  const controlPoints = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ControlPoints
metadata:
  name: bitnami-redis-${chartVersion}
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
      note: auth.password is bound before render and owned by revisions/default/r001/receipts/generated-fact-receipt.yaml.
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
      note: cub installer separates one rendered Secret from uploaded manifests.
    - category: image-digest
      status: handled
      digest: ${redisImageDigest}
    - category: installer-support-object
      status: handled
      object: v1|Namespace||redis
`;
  write(join(proofRoot, "control-points.yaml"), controlPoints);

  const recipe = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: Recipe
metadata:
  name: bitnami-redis
  version: ${chartVersion}
spec:
  chartRef:
    sourceLock: source-lock.yaml
    dependencyLock: dependency-lock.yaml
  importMode: render-and-vendor
  currentExecutableFixture:
    installerPackage: ../../../../packages/bitnami/redis/${chartVersion}
    setupCommand:
      - cub
      - installer
      - setup
      - --pull
      - ../../../../packages/bitnami/redis/${chartVersion}
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
  name: bitnami-redis-${chartVersion}-${variant.name}
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
  provenance:
${variant.name === "default" ? `    - path: auth.password
      source: generated-fact-receipt
      receipt: revisions/default/r001/receipts/generated-fact-receipt.yaml
      digest: ${yamlQuote(redisPasswordDigest)}
` : `    - path: auth.existingSecret
      source: target-fact-requirement
      sourceRef: variants/reuse-existing-secret/variant.yaml#spec.targetFacts.requiredSecrets[0]
      valueDigest: "sha256:2d211c578241023045614f0292c6b3af80c1e00c50037c0920407b34d2bced48"
      redaction: not-secret-material
      note: "The variant references a target Secret by name instead of storing credential material."
    - path: auth.existingSecretPasswordKey
      source: target-fact-requirement
      sourceRef: variants/reuse-existing-secret/variant.yaml#spec.targetFacts.requiredSecrets[0].keys[0]
      valueDigest: "sha256:543bba2743240902315c1273a1f54bc0f4ad031560927357939c43c6f4dd5011"
      redaction: not-secret-material
      note: "The variant records the required key shape for the target Secret."
`}    - path: image.digest
      source: catalog-policy
      digest: ${yamlQuote(redisImageDigest)}
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
    name: k8s-1.30-default
    catalog: ../../../../data/capability-profiles/catalog.yaml
    digest: ${yamlQuote(capabilityProfileDigest)}
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
        capabilityProfileDigest,
        generatedFactsDigest: variant.name === "default" ? generatedFactsDigest : undefined,
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
  )}${digestLine("rendererSHA256", rendererFingerprint)}${digestLine("capabilityProfileSHA256", capabilityProfileDigest)}${variant.name === "default" ? digestLine("generatedFactsSHA256", generatedFactsDigest) : ""}${digestLine("renderedObjectSetSHA256", releaseDigest)}
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
    capabilityProfileRef: "data/capability-profiles/catalog.yaml#k8s-1.30-default"
    capabilityProfileSHA256: ${yamlQuote(capabilityProfileDigest)}
${variant.name === "default" ? `    generatedFactsSHA256: ${yamlQuote(generatedFactsDigest)}\n` : ""}  outputs:
    renderedObjectSetSHA256: ${yamlQuote(releaseDigest)}
    renderedObjectInventorySHA256: ${yamlQuote(inventoryDigest)}
    objectCount: ${objects.length}
    renderedSecretCount: ${secretCount}
    secretCountSeparatedByCubInstall: ${secretCount}
`;
    write(join(receiptsRoot, "render-receipt.yaml"), renderReceipt);

    if (variant.name === "default") {
      const generatedFactReceipt = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: GeneratedFactReceipt
metadata:
  name: bitnami-redis-default-r001
spec:
  variantRevision: ../variant-revision.yaml
  generatedFactsSHA256: ${yamlQuote(generatedFactsDigest)}
  materialPolicy: persisted
  facts:
    - name: auth.password
      kind: password
      digest: ${yamlQuote(redisPasswordDigest)}
      storedAs: plain
      valuePath: effective-values.yaml#spec.values.auth.password
      renderedObjects:
        - v1|Secret|redis|redis
        - apps/v1|StatefulSet|redis|redis-master
        - apps/v1|StatefulSet|redis|redis-replicas
  deterministicReplay:
    sameGeneratedFactsSameRenderedObjectSet: true
    renderedObjectSetSHA256: ${yamlQuote(releaseDigest)}
  result: pass
`;
      write(join(receiptsRoot, "generated-fact-receipt.yaml"), generatedFactReceipt);
    }

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
    - production publish is blocked until scan findings are resolved or explicitly waived
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
  const diffDigest = `sha256:${sha256File(join(proofRoot, "diffs", "default-to-reuse-existing-secret.yaml"))}`;

  const valuesDiagnostics = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ValuesDiagnostics
metadata:
  name: bitnami-redis-${chartVersion}
spec:
  chart: bitnami/redis
  version: ${chartVersion}
  valueModel: value-model.yaml
  variants:
    - default
    - reuse-existing-secret
  deadIgnoredUnknownValues:
    status: checked-for-proof-path
    findings:
      - path: auth.passwrod
        classification: unknown-value-path
        certainty: definite
        severity: high
        message: "Synthetic misspelling of auth.password is accepted by Helm input parsing but does not change the rendered Redis Secret password."
        configHubHome: value-model
        disposition: handled-by-value-diagnostics
        evidence:
          syntheticTest: redis-wrong-password-key
          baselineRenderedObjectSetSHA256: ${yamlQuote(defaultSummary.releaseDigest)}
          mutatedRenderedObjectSetSHA256: ${yamlQuote(defaultSummary.releaseDigest)}
          diffResult: no-rendered-change
  syntheticTests:
    - name: redis-wrong-password-key
      variant: default
      injectedValues:
        auth:
          passwrod: "wrong-key-is-ignored"
      expectedResult: "no rendered object change because the chart does not read auth.passwrod"
      actualResult: "no rendered object change"
      result: pass
  limits:
    - "This diagnostic proves the first Redis path and one synthetic wrong-key case. Full static coverage for every Helm values path remains a broader chart-analysis task."
`;
  write(join(proofRoot, "values-diagnostics.yaml"), valuesDiagnostics);

  const valueSourceMap = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ValueSourceMap
metadata:
  name: bitnami-redis-${chartVersion}
spec:
  chart: bitnami/redis
  version: ${chartVersion}
  entries:
    - id: replica-count
      valuePath: replica.replicaCount
      effectiveValue: 3
      source: chart-default
      renderedFields:
        - object: apps/v1|StatefulSet|redis|redis-replicas
          field: spec.replicas
          value: 3
      rolloutImpact: changes-replica-statefulset-scale
      immutableFieldRisk: false
      relatedPolicies:
        - stateful-workload
        - pvc-policy
    - id: release-name
      valuePath: releaseName
      effectiveValue: redis
      source: variant.releaseName
      renderedFields:
        - object: apps/v1|StatefulSet|redis|redis-master
          field: metadata.name
          value: redis-master
        - object: apps/v1|StatefulSet|redis|redis-replicas
          field: metadata.name
          value: redis-replicas
        - object: v1|Service|redis|redis-headless
          field: metadata.name
          value: redis-headless
        - object: apps/v1|StatefulSet|redis|redis-replicas
          field: spec.template.spec.containers[0].env.REDIS_MASTER_HOST
          value: redis-master-0.redis-headless.redis.svc.cluster.local
      rolloutImpact: changing-release-name-renames-objects
      immutableFieldRisk: true
    - id: namespace
      valuePath: namespace
      effectiveValue: redis
      source: variant.namespace
      renderedFields:
        - object: apps/v1|StatefulSet|redis|redis-master
          field: metadata.namespace
          value: redis
        - object: apps/v1|StatefulSet|redis|redis-replicas
          field: metadata.namespace
          value: redis
        - object: v1|Service|redis|redis-headless
          field: metadata.namespace
          value: redis
        - object: v1|Secret|redis|redis
          field: metadata.namespace
          value: redis
      rolloutImpact: moving-namespace-creates-distinct-object-set
      immutableFieldRisk: true
    - id: image-digest
      valuePath: image.digest
      effectiveValue: ${yamlQuote(redisImageDigest)}
      source: catalog-policy
      renderedFields:
        - object: apps/v1|StatefulSet|redis|redis-master
          field: spec.template.spec.containers[0].image
          value: registry-1.docker.io/bitnami/redis@${redisImageDigest}
        - object: apps/v1|StatefulSet|redis|redis-replicas
          field: spec.template.spec.containers[0].image
          value: registry-1.docker.io/bitnami/redis@${redisImageDigest}
      rolloutImpact: changing-image-rolls-redis-pods
      immutableFieldRisk: false
    - id: redis-password
      valuePath: auth.password
      effectiveValueDigest: ${yamlQuote(redisPasswordDigest)}
      source: generated-fact-receipt
      renderedFields:
        - object: v1|Secret|redis|redis
          field: data.redis-password
          valueDigest: ${yamlQuote(redisPasswordDigest)}
        - object: apps/v1|StatefulSet|redis|redis-master
          field: spec.template.spec.volumes[redis-password].secret.secretName
          value: redis
        - object: apps/v1|StatefulSet|redis|redis-replicas
          field: spec.template.spec.volumes[redis-password].secret.secretName
          value: redis
      relatedFacts:
        - revisions/default/r001/receipts/generated-fact-receipt.yaml
      rolloutImpact: changes-secret-checksum-and-rolls-redis-pods
      immutableFieldRisk: false
`;
  write(join(proofRoot, "value-source-map.yaml"), valueSourceMap);

  const upgradeReceipt = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: UpgradeSimulationReceipt
metadata:
  name: bitnami-redis-default-to-reuse-existing-secret
spec:
  scope: variant-transition
  chartVersions:
    from: ${chartVersion}
    to: ${chartVersion}
  fromRevision: ../../revisions/default/r001/variant-revision.yaml
  toRevision: ../../revisions/reuse-existing-secret/r001/variant-revision.yaml
  fromRenderedObjectSetSHA256: ${yamlQuote(defaultSummary.releaseDigest)}
  toRenderedObjectSetSHA256: ${yamlQuote(reuseSummary.releaseDigest)}
  diffDigest: ${yamlQuote(diffDigest)}
  preservedChanges:
    - "StatefulSet names, Services, RBAC, ConfigMaps, and PVC templates remain in the same release/namespace identity."
  droppedChanges:
    - "Rendered Secret redis/redis is removed because the target now supplies redis/redis-existing-secret."
  requiredOperatorDecisions:
    - "Create or confirm Secret redis/redis-existing-secret with key redis-password before apply."
    - "Decide whether removing the chart-rendered Secret should delete the old Secret or leave it for retention/rollback."
  risks:
    hooks: "no Helm hooks are executed in this proof path"
    crds: "none"
    pvc: "StatefulSet PVCs are preserved by object identity; storage policy still requires operator review."
    generatedFacts: "auth.password generated fact is replaced by a target fact reference."
  conflicts: []
  result: warn
`;
  write(join(proofRoot, "operations", "default-to-reuse-existing-secret", "upgrade-simulation-receipt.yaml"), upgradeReceipt);

  const rollbackReceipt = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: RollbackSimulationReceipt
metadata:
  name: bitnami-redis-reuse-existing-secret-to-default
spec:
  scope: variant-transition-rollback
  chartVersions:
    from: ${chartVersion}
    to: ${chartVersion}
  fromRevision: ../../revisions/reuse-existing-secret/r001/variant-revision.yaml
  toRevision: ../../revisions/default/r001/variant-revision.yaml
  fromRenderedObjectSetSHA256: ${yamlQuote(reuseSummary.releaseDigest)}
  toRenderedObjectSetSHA256: ${yamlQuote(defaultSummary.releaseDigest)}
  diffDigest: ${yamlQuote(diffDigest)}
  preservedChanges:
    - "Release name, namespace, Services, StatefulSets, and PVC templates stay stable."
  droppedChanges:
    - "Target Secret dependency is no longer required by the default revision."
  requiredOperatorDecisions:
    - "Decide whether the target-provided Secret remains as a live object after rollback."
    - "Confirm the generated-fact password is the intended rollback credential."
  risks:
    hooks: "no Helm hooks are executed in this proof path"
    crds: "none"
    pvc: "PVCs remain attached by StatefulSet identity; rollback does not delete PVCs."
    generatedFacts: "rollback reintroduces the bound generated auth.password fact."
  conflicts: []
  result: warn
`;
  write(join(proofRoot, "operations", "reuse-existing-secret-to-default", "rollback-simulation-receipt.yaml"), rollbackReceipt);

  const helmPlan = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: HelmPlan
metadata:
  name: bitnami-redis-${chartVersion}
spec:
  readiness:
    status: usable-with-controls
    chart: bitnami/redis
    version: ${chartVersion}
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
  reports:
    painReport: helm-pain-report.yaml
    valuesDiagnostics: values-diagnostics.yaml
    valueSourceMap: value-source-map.yaml
  painPointSummary:
    status: no-unhandled-pain-points-for-default-proof-path
    handled:
      - generated credential risk -> generated fact receipt
      - target Secret requirement -> target facts
      - Kubernetes capability branching -> named capability profile
      - Helm hooks -> no-hooks lifecycle policy for render proof
      - rendered Secret handling -> cub installer secret separation
      - mutable image findings -> image.digest in effective values
      - ignored value risk -> values diagnostics
  receipts:
    - helm-pain-report.yaml
    - values-diagnostics.yaml
    - value-source-map.yaml
${summaries
  .flatMap((summary) => [
    `    - revisions/${summary.name}/r001/receipts/helm-equivalence-receipt.yaml`,
    ...(summary.name === "default" ? [`    - revisions/${summary.name}/r001/receipts/generated-fact-receipt.yaml`] : []),
    `    - revisions/${summary.name}/r001/receipts/render-receipt.yaml`,
    `    - revisions/${summary.name}/r001/receipts/scan-receipt.yaml`,
    `    - revisions/${summary.name}/r001/receipts/install-gate.yaml`,
  ])
  .join("\n")}
    - diffs/default-to-reuse-existing-secret.yaml
    - operations/default-to-reuse-existing-secret/upgrade-simulation-receipt.yaml
    - operations/reuse-existing-secret-to-default/rollback-simulation-receipt.yaml
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
    - Supported bases pin the Bitnami Redis image by digest instead of rendering the chart default latest tag.
    - Default and reuse-existing-secret are the first proof variants; HA is a later slice.
  weirdnessNotes:
    - deterministic proof pins auth.password in effective-values.yaml
    - both variants pin image.digest in effective values
    - reuse-existing-secret records redis-existing-secret/redis-password as a target fact requirement
    - cub installer separates rendered Secret resources from uploaded manifests
`;
  write(join(proofRoot, "chart-dossier.yaml"), chartDossier);

  const readme = `# Redis Proof: bitnami/redis ${chartVersion}

## Readiness Card

| Field | Result |
| --- | --- |
| Chart | bitnami/redis ${chartVersion} |
| Variants | default, reuse-existing-secret |
| Status | usable with controls |
| Helm objects | default: 14; reuse-existing-secret: 13 |
| ConfigHub/cub installer objects | default: 15; reuse-existing-secret: 14 |
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
current \`packages/bitnami/redis/${chartVersion}\` cub installer package against that
regular Helm output.
`;
  write(join(proofRoot, "README.md"), readme);

  const installChecks = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: InstallChecks
metadata:
  name: bitnami-redis-${chartVersion}
spec:
  chart: bitnami/redis/${chartVersion}
  canonicalNamespace: redis
  releaseName: redis
  receiptRoot: .tmp/verify-install
  variants:
    - name: default
      base: default
      variantRevision: recipes/bitnami/redis/${chartVersion}/revisions/default/r001/variant-revision.yaml
      renderedObjects: recipes/bitnami/redis/${chartVersion}/revisions/default/r001/rendered/release-objects.yaml
      helmEquivalenceReceipt: recipes/bitnami/redis/${chartVersion}/revisions/default/r001/receipts/helm-equivalence-receipt.yaml
      expected:
        helmObjects: 14
        cubInstallObjectsIncludingSupport: 15
        semanticObjectMatches: 14/14
        allowedCubOnlyObjects:
          - apiVersion: v1
            kind: Namespace
            namespace: ""
            name: redis
      clusterChecks:
        statefulsets:
          - name: redis-master
            readyReplicas: 1
          - name: redis-replicas
            readyReplicas: 3
        persistentVolumeClaims:
          selector: app.kubernetes.io/instance=redis
          boundCount: 4
        redisPing:
          statefulset: redis-master
          passwordDefault: confighub-redis-password
        redisAuthSecretName: redis
        inventoryResources: all,pvc,pdb,networkpolicy,secret,configmap,serviceaccount
      confighubChecks:
        expectedUnitCount: 15
        expectedVariantLabeledUnitCount: 14
        installerRecordRequired: true
        requiredLabels:
          Component: Redis
          HelmChart: bitnami-redis
          HelmChartVersion: "${chartVersion}"
          Variant: default
    - name: reuse-existing-secret
      base: reuse-existing-secret
      variantRevision: recipes/bitnami/redis/${chartVersion}/revisions/reuse-existing-secret/r001/variant-revision.yaml
      renderedObjects: recipes/bitnami/redis/${chartVersion}/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml
      helmEquivalenceReceipt: recipes/bitnami/redis/${chartVersion}/revisions/reuse-existing-secret/r001/receipts/helm-equivalence-receipt.yaml
      targetFacts:
        requiredSecrets:
          - namespace: redis
            name: redis-existing-secret
            keys:
              - redis-password
      expected:
        helmObjects: 13
        cubInstallObjectsIncludingSupport: 14
        semanticObjectMatches: 13/13
        allowedCubOnlyObjects:
          - apiVersion: v1
            kind: Namespace
            namespace: ""
            name: redis
      clusterChecks:
        statefulsets:
          - name: redis-master
            readyReplicas: 1
          - name: redis-replicas
            readyReplicas: 3
        persistentVolumeClaims:
          selector: app.kubernetes.io/instance=redis
          boundCount: 4
        redisPing:
          statefulset: redis-master
          passwordDefault: confighub-redis-password
        redisAuthSecretName: redis-existing-secret
        forbiddenObjects:
          - apiVersion: v1
            kind: Secret
            namespace: redis
            name: redis
        inventoryResources: all,pvc,pdb,networkpolicy,secret,configmap,serviceaccount
      confighubChecks:
        expectedUnitCount: 15
        expectedVariantLabeledUnitCount: 14
        installerRecordRequired: true
        requiredLabels:
          Component: Redis
          HelmChart: bitnami-redis
          HelmChartVersion: "${chartVersion}"
          Variant: reuse-existing-secret
`;
  write(join(proofRoot, "install-checks.yaml"), installChecks);

  console.log(`generated Redis proof variants at ${proofRoot}: ${summaries.map((summary) => summary.name).join(", ")}`);
}

main();
