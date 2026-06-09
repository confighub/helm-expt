#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  check,
  difference,
  identityFor,
  listYamlFiles,
  parseDocs,
  relativeRepo,
  repoRoot,
  sha256,
  sha256File,
  writeYaml,
} from "./lib/proof-common.mjs";
import { runCubScoutLiveReceipts } from "./lib/cub-scout-live.mjs";
import { loadInstallChecks, supportedInstallCheckCharts } from "./lib/install-checks.mjs";

class UsageError extends Error {}

const args = process.argv.slice(2);
const stage = optionValue("--stage");
const chart = optionValue("--chart");
const base = optionValue("--base") ?? "default";
const outputDir = resolve(repoRoot, optionValue("--output-dir") ?? ".tmp/verify-install");

if (args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(0);
}

try {
  requiredOption("--stage");
  requiredOption("--chart");
  if (!["render", "cluster", "confighub"].includes(stage)) {
    throw new UsageError(`unsupported verify-install stage: ${stage}`);
  }
  const { spec, variant } = loadInstallChecks(chart, base);

  if (stage === "render") verifyRender({ spec, variant });
  if (stage === "cluster") verifyCluster({ spec, variant });
  if (stage === "confighub") verifyConfigHub({ variant });
} catch (error) {
  if (error instanceof UsageError) {
    console.error(error.message);
    console.error("");
    printUsage();
    process.exitCode = 1;
    process.exit();
  }
  writeFailureReceipt(error);
  console.error(`FAIL ${verifierLabel(stage)} ${chart} ${base}`);
  console.error(error.message);
  process.exitCode = 1;
}

function verifyRender({ spec, variant }) {
  const workDir = resolve(repoRoot, requiredOption("--work-dir"));
  const namespace = optionValue("--namespace") ?? spec.canonicalNamespace;
  const canonicalPath = join(repoRoot, variant.renderedObjects);
  const equivalenceReceipt = loadYaml(variant.helmEquivalenceReceipt);
  check(existsSync(workDir), `work dir does not exist: ${workDir}`);
  check(existsSync(canonicalPath), `canonical rendered objects missing: ${canonicalPath}`);
  check(
    equivalenceReceipt.spec?.regularHelm?.objectCount === variant.expected.helmObjects,
    `${variant.name} Helm object count disagrees with install-checks.yaml`,
  );
  check(
    equivalenceReceipt.spec?.regularHelm?.renderedSHA256 === sha256File(canonicalPath),
    `${variant.name} canonical rendered SHA disagrees with helm-equivalence receipt`,
  );

  const userFiles = userRenderFiles(workDir);
  check(userFiles.length > 0, `no rendered YAML files found under ${workDir}`);

  const canonicalText = readFileSync(canonicalPath, "utf8");
  const userText = userFiles.map((file) => readFileSync(file, "utf8")).join("\n---\n");
  const canonicalMap = objectMap(parseDocs(canonicalText), spec.canonicalNamespace, spec.canonicalNamespace);
  const userMap = objectMap(parseDocs(userText), namespace, spec.canonicalNamespace);
  const canonicalKeys = new Set(Object.keys(canonicalMap));
  const userKeys = new Set(Object.keys(userMap));
  const allowedExtra = new Set(
    (variant.expected.allowedCubOnlyObjects ?? []).map((item) =>
      [item.apiVersion ?? "", item.kind ?? "", item.namespace ?? "", item.name ?? ""].join("|"),
    ),
  );

  const missingFromUser = difference(canonicalKeys, userKeys);
  const unexpectedExtra = difference(userKeys, canonicalKeys).filter((key) => !allowedExtra.has(key));
  const semanticDiffs = [];
  for (const key of canonicalKeys) {
    if (userMap[key] && userMap[key] !== canonicalMap[key]) semanticDiffs.push(key);
  }

  const receiptDir = receiptDirFor(variant.name);
  mkdirSync(receiptDir, { recursive: true });
  if (missingFromUser.length || unexpectedExtra.length || semanticDiffs.length) {
    const diffPath = writeRenderDiff(receiptDir, {
      canonicalMap,
      userMap,
      canonicalKeys,
      missingFromUser,
      unexpectedExtra,
      semanticDiffs,
    });
    const error = new Error(`user render does not match canonical ${chart} ${variant.name}; diff: ${pathForReceipt(diffPath)}`);
    error.diffPath = pathForReceipt(diffPath);
    throw error;
  }

  const receiptPath = join(receiptDir, "render-receipt.yaml");
  const userComparableDigest = sha256(stableStringify(pickKeys(userMap, [...canonicalKeys])));
  const extraObjects = difference(userKeys, canonicalKeys);
  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "UserInstallRenderReceipt",
    metadata: { name: `bitnami-redis-${variant.name}-user-render` },
    spec: {
      chart,
      variant: variant.name,
      base: variant.base,
      variantRevision: variant.variantRevision,
      verifier: { name: "verify-install", stage: "render", version: "0.1.0" },
      userWorkDir: pathForReceipt(workDir),
      namespace,
      canonicalNamespace: spec.canonicalNamespace,
      canonicalRenderedObjects: variant.renderedObjects,
      canonicalRenderedObjectSetSHA256: equivalenceReceipt.spec.regularHelm.renderedSHA256,
      userRenderedFileCount: userFiles.length,
      userRenderedFiles: userFiles.map(pathForReceipt),
      userRenderedBytesSHA256: sha256(userText),
      userComparableObjectSetSHA256: userComparableDigest,
      semanticObjectMatches: `${canonicalKeys.size}/${canonicalKeys.size}`,
      allowedExtraObjects: extraObjects,
      checks: [
        { name: "canonical-rendered-objects-present", result: "pass" },
        { name: "user-rendered-yaml-present", result: "pass", count: userFiles.length },
        { name: "no-canonical-objects-missing", result: "pass" },
        { name: "no-unexpected-extra-objects", result: "pass" },
        { name: "semantic-object-match", result: "pass", count: canonicalKeys.size },
      ],
      result: "pass",
    },
  };
  writeYaml(receiptPath, receipt);

  console.log(`PASS ${verifierLabel("render")} ${chart} ${variant.name}`);
  console.log(`render matches canonical: ${equivalenceReceipt.spec.regularHelm.renderedSHA256}`);
  console.log(`canonical objects: ${canonicalKeys.size}`);
  console.log(`user objects: ${userKeys.size}`);
  console.log(`semantic object matches: ${canonicalKeys.size}/${canonicalKeys.size}`);
  if (extraObjects.length) console.log(`allowed extra objects: ${extraObjects.join(", ")}`);
  console.log(`receipt: ${pathForReceipt(receiptPath)}`);
}

function verifyCluster({ spec, variant }) {
  const namespace = requiredOption("--namespace");
  const context = optionValue("--context");
  const password = optionValue("--password") ?? variant.clusterChecks.redisPing.passwordDefault;
  const receiptDir = receiptDirFor(variant.name);
  mkdirSync(receiptDir, { recursive: true });

  const kubectlObjectsPath = join(receiptDir, "kubectl-objects.txt");
  const pongPath = join(receiptDir, "redis-pong.txt");
  const checks = [];

  for (const statefulset of variant.clusterChecks.statefulsets) {
    kubectl([
      "-n",
      namespace,
      "rollout",
      "status",
      `statefulset/${statefulset.name}`,
      "--timeout=300s",
    ], context);
    const json = JSON.parse(kubectl(["-n", namespace, "get", "statefulset", statefulset.name, "-o", "json"], context));
    check(
      Number(json.status?.readyReplicas ?? 0) === Number(statefulset.readyReplicas),
      `${statefulset.name} ready replicas mismatch: expected ${statefulset.readyReplicas}, got ${json.status?.readyReplicas ?? 0}`,
    );
    const secretRefs = collectSecretRefNames(json);
    check(
      secretRefs.includes(variant.clusterChecks.redisAuthSecretName),
      `${statefulset.name} does not reference expected Redis auth Secret ${variant.clusterChecks.redisAuthSecretName}`,
    );
    checks.push({
      name: `statefulset-${statefulset.name}-rollout`,
      result: "pass",
      object: `apps/v1|StatefulSet|${namespace}|${statefulset.name}`,
      readyReplicas: statefulset.readyReplicas,
      authSecret: variant.clusterChecks.redisAuthSecretName,
    });
  }

  kubectl(["-n", namespace, "get", "secret", variant.clusterChecks.redisAuthSecretName, "-o", "json"], context);
  checks.push({
    name: "redis-auth-secret-present",
    result: "pass",
    object: `v1|Secret|${namespace}|${variant.clusterChecks.redisAuthSecretName}`,
  });

  for (const object of variant.clusterChecks.forbiddenObjects ?? []) {
    const objectNamespace = object.namespace === spec.canonicalNamespace ? namespace : object.namespace;
    const result = tryKubectl(["-n", objectNamespace, "get", object.kind.toLowerCase(), object.name, "-o", "name"], context);
    check(
      !result.ok,
      `forbidden object is present for ${variant.name}: ${object.apiVersion}|${object.kind}|${objectNamespace}|${object.name}`,
    );
    checks.push({
      name: "forbidden-object-absent",
      result: "pass",
      object: `${object.apiVersion}|${object.kind}|${objectNamespace}|${object.name}`,
    });
  }

  const pvcSpec = variant.clusterChecks.persistentVolumeClaims;
  const pvcJson = JSON.parse(kubectl(["-n", namespace, "get", "pvc", "-l", pvcSpec.selector, "-o", "json"], context));
  const boundPVCs = (pvcJson.items ?? []).filter((item) => item.status?.phase === "Bound");
  check(
    boundPVCs.length === Number(pvcSpec.boundCount),
    `bound PVC count mismatch: expected ${pvcSpec.boundCount}, got ${boundPVCs.length}`,
  );
  checks.push({ name: "redis-pvcs-bound", result: "pass", count: boundPVCs.length, selector: pvcSpec.selector });

  const targetFacts = {};
  const defaultStorageClass = readDefaultStorageClass(context);
  if (defaultStorageClass) {
    targetFacts.defaultStorageClass = { name: defaultStorageClass, status: "observed" };
  }

  const requiredSecret = variant.targetFacts?.requiredSecrets?.[0];
  if (requiredSecret) {
    const secretJson = JSON.parse(kubectl(["-n", namespace, "get", "secret", requiredSecret.name, "-o", "json"], context));
    const keys = Object.keys(secretJson.data ?? {}).sort();
    for (const key of requiredSecret.keys ?? []) {
      check(keys.includes(key), `required Secret ${namespace}/${requiredSecret.name} missing key ${key}`);
    }
    const redactedSecret = {
      apiVersion: secretJson.apiVersion,
      kind: secretJson.kind,
      metadata: { namespace, name: secretJson.metadata?.name },
      keys,
    };
    const secretEvidencePath = join(receiptDir, "required-secret-redacted.yaml");
    writeYaml(secretEvidencePath, redactedSecret);
    targetFacts.requiredSecret = {
      namespace,
      name: requiredSecret.name,
      keys: requiredSecret.keys,
      status: "observed",
      evidencePath: basename(secretEvidencePath),
      evidenceSHA256: sha256File(secretEvidencePath),
    };
    checks.push({ name: "target-secret-present", result: "pass", object: `v1|Secret|${namespace}|${requiredSecret.name}` });
  }

  const pong = kubectl([
    "-n",
    namespace,
    "exec",
    `statefulset/${variant.clusterChecks.redisPing.statefulset}`,
    "--",
    "redis-cli",
    "--no-auth-warning",
    "-a",
    password,
    "ping",
  ], context);
  writeFileSync(pongPath, pong);
  check(pong.includes("PONG"), `Redis PING did not return PONG:\n${pong}`);
  checks.push({
    name: "redis-ping",
    result: "pass",
    evidencePath: basename(pongPath),
    evidenceSHA256: sha256File(pongPath),
  });

  const objects = kubectl([
    "-n",
    namespace,
    "get",
    variant.clusterChecks.inventoryResources,
    "-l",
    "app.kubernetes.io/instance=redis",
    "-o",
    "wide",
  ], context);
  writeFileSync(kubectlObjectsPath, objects);

  const canonicalPath = join(repoRoot, variant.renderedObjects);
  const cubScout = runCubScoutLiveReceipts({
    runDir: receiptDir,
    renderedPath: canonicalPath,
    namespace,
    context,
    targetFacts: variant.targetFacts ?? {},
  });
  checks.push(...cubScout.checks);

  const receiptPath = join(receiptDir, "cluster-receipt.yaml");
  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "UserInstallObservationReceipt",
    metadata: { name: `bitnami-redis-${variant.name}-user-cluster` },
    spec: {
      chart,
      variant: variant.name,
      base: variant.base,
      variantRevision: variant.variantRevision,
      renderedObjectSetSHA256: sha256File(canonicalPath),
      observer: { name: "verify-install", stage: "cluster", version: "0.1.0", method: "kubectl" },
      target: { context: context ?? "current-context", namespace },
      observedAt: new Date().toISOString(),
      freshnessTTL: "1h",
      targetFacts,
      cubScout: {
        status: cubScout.status,
        source: cubScout.source,
        supportsTtl: cubScout.supportsTtl,
        supportsNoExtras: cubScout.supportsNoExtras,
        reason: cubScout.reason,
      },
      checks,
      kubectlObjects: { path: basename(kubectlObjectsPath), sha256: sha256File(kubectlObjectsPath) },
      result: "pass",
    },
  };
  writeYaml(receiptPath, receipt);

  console.log(`PASS ${verifierLabel("cluster")} ${chart} ${variant.name}`);
  console.log(`namespace: ${namespace}`);
  console.log(`context: ${context ?? "current-context"}`);
  console.log("checks: statefulsets, PVCs, Redis PING");
  console.log(`receipt: ${pathForReceipt(receiptPath)}`);
}

function verifyConfigHub({ variant }) {
  const space = requiredOption("--space");
  const confighubChecks = variant.confighubChecks;
  check(Boolean(confighubChecks), `${variant.name} has no confighubChecks in install-checks.yaml`);

  const rows = JSON.parse(
    execFileSync("cub", ["unit", "list", "--space", space, "-o", "json", "--select", "Labels"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 100,
    }),
  );
  const units = rows.map((row) => row.Unit).filter(Boolean);
  const requiredLabels = confighubChecks.requiredLabels ?? {};
  const labeledUnits = units.filter((unit) => labelsContain(unit.Labels ?? {}, requiredLabels));
  const installerRecord = units.find((unit) => unit.Slug === "installer-record" || unit.Labels?.Kind === "installer-record");

  check(
    units.length === Number(confighubChecks.expectedUnitCount),
    `ConfigHub Unit count mismatch: expected ${confighubChecks.expectedUnitCount}, got ${units.length}`,
  );
  check(
    labeledUnits.length === Number(confighubChecks.expectedVariantLabeledUnitCount),
    `ConfigHub variant-labeled Unit count mismatch: expected ${confighubChecks.expectedVariantLabeledUnitCount}, got ${labeledUnits.length}`,
  );
  if (confighubChecks.installerRecordRequired) {
    check(Boolean(installerRecord), "ConfigHub installer-record Unit is missing");
  }

  const receiptDir = receiptDirFor(variant.name);
  mkdirSync(receiptDir, { recursive: true });
  const receiptPath = join(receiptDir, "confighub-receipt.yaml");
  writeYaml(receiptPath, {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "UserInstallConfigHubReceipt",
    metadata: { name: `bitnami-redis-${variant.name}-user-confighub` },
    spec: {
      chart,
      variant: variant.name,
      base: variant.base,
      variantRevision: variant.variantRevision,
      verifier: { name: "verify-install", stage: "confighub", version: "0.1.0" },
      space,
      observedAt: new Date().toISOString(),
      requiredLabels,
      unitCount: units.length,
      expectedUnitCount: confighubChecks.expectedUnitCount,
      variantLabeledUnitCount: labeledUnits.length,
      expectedVariantLabeledUnitCount: confighubChecks.expectedVariantLabeledUnitCount,
      installerRecordPresent: Boolean(installerRecord),
      unitSlugs: units.map((unit) => unit.Slug).sort(),
      checks: [
        { name: "unit-count", result: "pass", count: units.length },
        { name: "required-labels", result: "pass", count: labeledUnits.length },
        { name: "installer-record-present", result: "pass", required: Boolean(confighubChecks.installerRecordRequired) },
      ],
      result: "pass",
    },
  });

  console.log(`PASS ${verifierLabel("confighub")} ${chart} ${variant.name}`);
  console.log(`space: ${space}`);
  console.log(`units: ${units.length}`);
  console.log(`variant-labeled units: ${labeledUnits.length}`);
  console.log(`receipt: ${pathForReceipt(receiptPath)}`);
}

function userRenderFiles(workDir) {
  const dirs = [join(workDir, "out/manifests"), join(workDir, "out/secrets")];
  const files = dirs.flatMap((dir) => listYamlFiles(dir));
  if (files.length) return files.sort();

  const fallbacks = [
    join(workDir, "release", "release-objects.yaml"),
    join(workDir, "out", "release-objects.yaml"),
    join(workDir, "release-objects.yaml"),
  ];
  return fallbacks.filter((file) => existsSync(file));
}

function objectMap(docs, fromNamespace, toNamespace) {
  const result = {};
  for (const doc of docs) {
    const normalized = normalizeDoc(doc, fromNamespace, toNamespace);
    const identity = identityFor(normalized);
    if (identity.replaceAll("|", "")) result[identity] = stableStringify(prune(normalized));
  }
  return result;
}

function normalizeDoc(doc, fromNamespace, toNamespace) {
  const clone = JSON.parse(JSON.stringify(doc));
  clone.metadata ??= {};
  if (clone.metadata.namespace === fromNamespace) clone.metadata.namespace = toNamespace;
  if (clone.kind === "Namespace" && clone.metadata.name === fromNamespace) clone.metadata.name = toNamespace;
  return clone;
}

function prune(value) {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(prune);
  if (typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const pruned = prune(item);
    if (pruned !== undefined) result[key] = pruned;
  }
  if (result.metadata && typeof result.metadata === "object") {
    for (const optionalMap of ["annotations", "labels"]) {
      if (stableStringify(result.metadata[optionalMap] ?? {}) === "{}") delete result.metadata[optionalMap];
    }
  }
  return result;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function pickKeys(map, keys) {
  const result = {};
  for (const key of keys.sort()) result[key] = map[key];
  return result;
}

function writeRenderDiff(receiptDir, details) {
  const diffPath = join(receiptDir, "render-diff.txt");
  const lines = [
    "--- canonical",
    "+++ user",
    `@@ chart=${chart} base=${base} @@`,
  ];
  if (details.missingFromUser.length) {
    lines.push("missing canonical objects:");
    for (const key of details.missingFromUser) lines.push(`- ${key}`);
  }
  if (details.unexpectedExtra.length) {
    lines.push("unexpected user objects:");
    for (const key of details.unexpectedExtra) lines.push(`+ ${key}`);
  }
  for (const key of details.semanticDiffs) {
    lines.push(`@@ ${key} @@`);
    lines.push(`- ${details.canonicalMap[key]}`);
    lines.push(`+ ${details.userMap[key]}`);
  }
  writeFileSync(diffPath, `${lines.join("\n")}\n`);
  return diffPath;
}

function labelsContain(labels, expected) {
  return Object.entries(expected).every(([key, value]) => String(labels[key] ?? "") === String(value));
}

function loadYaml(path) {
  const absolute = path.startsWith("/") ? path : join(repoRoot, path);
  return JSON.parse(execFileSync("python3", [
    "-c",
    `
import json, sys, yaml
with open(sys.argv[1], "r", encoding="utf-8") as handle:
    docs = [doc for doc in yaml.safe_load_all(handle) if doc is not None]
print(json.dumps(docs[0] if len(docs) == 1 else docs, sort_keys=True))
`,
    absolute,
  ], { encoding: "utf8" }));
}

function kubectl(kubectlArgs, context) {
  const fullArgs = context ? ["--context", context, ...kubectlArgs] : kubectlArgs;
  return execFileSync("kubectl", fullArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
  });
}

function tryKubectl(kubectlArgs, context) {
  try {
    return { ok: true, stdout: kubectl(kubectlArgs, context), stderr: "" };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? error.message,
    };
  }
}

function collectSecretRefNames(value, names = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectSecretRefNames(item, names);
    return [...names].sort();
  }
  if (!value || typeof value !== "object") return [...names].sort();
  if (value.secretKeyRef?.name) names.add(value.secretKeyRef.name);
  if (value.secretRef?.name) names.add(value.secretRef.name);
  if (value.secret?.secretName) names.add(value.secret.secretName);
  for (const item of Object.values(value)) collectSecretRefNames(item, names);
  return [...names].sort();
}

function readDefaultStorageClass(context) {
  try {
    const parsed = JSON.parse(kubectl(["get", "storageclass", "-o", "json"], context));
    const item = (parsed.items ?? []).find((storageClass) => {
      const annotations = storageClass.metadata?.annotations ?? {};
      return (
        annotations["storageclass.kubernetes.io/is-default-class"] === "true" ||
        annotations["storageclass.beta.kubernetes.io/is-default-class"] === "true"
      );
    });
    return item?.metadata?.name ?? null;
  } catch {
    return null;
  }
}

function receiptDirFor(variantName) {
  return join(outputDir, "bitnami-redis-25.5.3", variantName);
}

function pathForReceipt(path) {
  const absolute = resolve(path);
  return absolute.startsWith(repoRoot) ? relativeRepo(absolute) : absolute;
}

function writeFailureReceipt(error) {
  try {
    const variantName = base || "unknown";
    const receiptDir = receiptDirFor(variantName);
    mkdirSync(receiptDir, { recursive: true });
    writeYaml(join(receiptDir, `${stage || "unknown"}-receipt.yaml`), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "UserInstallFailureReceipt",
      metadata: { name: `${chart.replaceAll("/", "-")}-${variantName}-user-${stage || "unknown"}-failed` },
      spec: {
        chart,
        variant: variantName,
        verifier: { name: "verify-install", stage: stage || "unknown", version: "0.1.0" },
        observedAt: new Date().toISOString(),
        result: "fail",
        error: error.message,
        diffPath: error.diffPath,
      },
    });
  } catch {
    // If even failure receipt writing fails, keep the original error visible.
  }
}

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function requiredOption(name) {
  const value = optionValue(name);
  if (!value) throw new UsageError(`missing required option ${name}`);
  return value;
}

function printUsage() {
  const supported = supportedInstallCheckCharts();
  console.error(`Usage:
  npm run redis:verify-install:render -- --base default --work-dir <installer-work-dir> --namespace redis
  npm run redis:verify-install:cluster -- --base default --context <kubectl-context> --namespace redis
  npm run redis:verify-install:confighub -- --base default --space <confighub-space>

Lower-level generic form, for charts that have an install-checks.yaml:
  npm run verify-install:render -- --chart bitnami/redis/25.5.3 --base default --work-dir <installer-work-dir> --namespace redis

Options:
  --chart       Chart/version to verify. Requires recipes/<repo>/<chart>/<version>/install-checks.yaml.
                Currently available: ${supported.length ? supported.join(", ") : "none"}
  --base        Catalog variant/package base. Default: default
  --work-dir    Required for render. Directory produced by cub installer setup
  --namespace   Required for cluster; optional for render namespace remapping
  --context     Optional kubectl context for cluster checks
  --space       Required for ConfigHub Unit checks
  --output-dir  Receipt output directory. Default: .tmp/verify-install
`);
}

function verifierLabel(labelStage) {
  if (chart === "bitnami/redis/25.5.3") return `redis:verify-install:${labelStage}`;
  return `verify-install:${labelStage ?? "unknown"}`;
}
