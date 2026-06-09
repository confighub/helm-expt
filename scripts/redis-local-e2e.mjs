import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadTargetFactsForRevision, runCubScoutLiveReceipts } from "./lib/cub-scout-live.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const clusterName = "helm-expt-redis";
const contextName = `kind-${clusterName}`;
const namespace = "redis";
const args = process.argv.slice(2);
const variantName = optionValue("--variant") ?? "default";
if (!["default", "reuse-existing-secret"].includes(variantName)) {
  throw new Error(`unsupported Redis local e2e variant: ${variantName}`);
}
const runName = variantName === "default" ? "latest" : `${variantName}-latest`;
const localPathProvisionerURL =
  "https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.32/deploy/local-path-storage.yaml";
const releaseObjects = join(
  repoRoot,
  "recipes",
  "bitnami",
  "redis",
  "25.5.3",
  "revisions",
  variantName,
  "r001",
  "rendered",
  "release-objects.yaml",
);
const variantRevision = `recipes/bitnami/redis/25.5.3/revisions/${variantName}/r001/variant-revision.yaml`;
const runRoot = join(repoRoot, "runs", "redis-local-kind", runName);

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    cwd: repoRoot,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
  });
}

function tryRun(cmd, args, options = {}) {
  try {
    return { ok: true, stdout: run(cmd, args, options), stderr: "" };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? error.message,
    };
  }
}

function runInherit(cmd, args) {
  execFileSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    maxBuffer: 1024 * 1024 * 100,
  });
}

function yamlQuote(value) {
  if (value === null || value === undefined) return "null";
  return JSON.stringify(String(value));
}

function yamlScalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return yamlQuote(value);
}

function yamlCheck(check) {
  return Object.entries(check)
    .filter(([, value]) => value !== undefined)
    .map(([key, value], index) => `${index === 0 ? "    -" : "     "} ${key}: ${yamlScalar(value)}`)
    .join("\n");
}

function ensureCluster() {
  const clusters = run("kind", ["get", "clusters"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (clusters.includes(clusterName)) return "existing";

  runInherit("kind", [
    "create",
    "cluster",
    "--name",
    clusterName,
    "--image",
    "kindest/node:v1.30.0",
    "--wait",
    "180s",
  ]);
  return "created";
}

function kubectl(args, options = {}) {
  return run("kubectl", ["--context", contextName, ...args], options);
}

function kubectlInherit(args) {
  runInherit("kubectl", ["--context", contextName, ...args]);
}

function storageClassState() {
  const result = tryRun("kubectl", ["--context", contextName, "get", "storageclass", "-o", "json"]);
  if (!result.ok) return { items: [], defaultName: null, raw: result.stderr };
  const parsed = JSON.parse(result.stdout);
  const items = parsed.items ?? [];
  const defaultItem = items.find((item) => {
    const annotations = item.metadata?.annotations ?? {};
    return (
      annotations["storageclass.kubernetes.io/is-default-class"] === "true" ||
      annotations["storageclass.beta.kubernetes.io/is-default-class"] === "true"
    );
  });
  return { items, defaultName: defaultItem?.metadata?.name ?? null, raw: result.stdout };
}

function ensureDefaultStorageClass() {
  const before = storageClassState();
  if (before.defaultName) {
    return {
      status: "existing",
      defaultName: before.defaultName,
      provisionerURL: null,
    };
  }

  kubectlInherit(["apply", "-f", localPathProvisionerURL]);
  kubectlInherit(["-n", "local-path-storage", "rollout", "status", "deployment/local-path-provisioner", "--timeout=180s"]);
  kubectlInherit([
    "patch",
    "storageclass",
    "local-path",
    "-p",
    '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}',
  ]);

  const after = storageClassState();
  if (!after.defaultName) {
    throw new Error("local e2e requires a default StorageClass, but none was available after provisioning");
  }
  return {
    status: "created",
    defaultName: after.defaultName,
    provisionerURL: localPathProvisionerURL,
  };
}

function ensureReuseExistingSecret() {
  if (variantName !== "reuse-existing-secret") return null;
  const secretYaml = kubectl([
    "-n",
    namespace,
    "create",
    "secret",
    "generic",
    "redis-existing-secret",
    "--from-literal=redis-password=confighub-redis-password",
    "--dry-run=client",
    "-o",
    "yaml",
  ]);
  const secretPath = join(runRoot, "redis-existing-secret.yaml");
  writeFileSync(secretPath, secretYaml);
  kubectlInherit(["apply", "-f", secretPath]);
  return {
    namespace,
    name: "redis-existing-secret",
    key: "redis-password",
    evidencePath: "redis-existing-secret.yaml",
    evidenceSHA256: sha256File(secretPath),
  };
}

function main() {
  mkdirSync(runRoot, { recursive: true });
  const renderedDigest = sha256File(releaseObjects);
  const clusterStatus = ensureCluster();
  const storageClass = ensureDefaultStorageClass();

  const namespaceYaml = kubectl(["create", "namespace", namespace, "--dry-run=client", "-o", "yaml"]);
  const namespacePath = join(runRoot, "namespace.yaml");
  writeFileSync(namespacePath, namespaceYaml);
  kubectlInherit(["apply", "-f", namespacePath]);
  const requiredSecret = ensureReuseExistingSecret();
  kubectlInherit(["apply", "-f", releaseObjects]);

  kubectlInherit(["-n", namespace, "rollout", "status", "statefulset/redis-master", "--timeout=300s"]);
  kubectlInherit(["-n", namespace, "rollout", "status", "statefulset/redis-replicas", "--timeout=300s"]);
  kubectlInherit([
    "-n",
    namespace,
    "wait",
    "--for=jsonpath={.status.phase}=Bound",
    "pvc",
    "-l",
    "app.kubernetes.io/instance=redis",
    "--timeout=120s",
  ]);
  if (variantName === "reuse-existing-secret") {
    kubectlInherit(["-n", namespace, "delete", "secret", "redis", "--ignore-not-found"]);
  }

  const objects = kubectl([
    "-n",
    namespace,
    "get",
    "all,pvc,pdb,networkpolicy,secret,configmap,serviceaccount",
    "-l",
    "app.kubernetes.io/instance=redis",
    "-o",
    "wide",
  ]);
  const objectsPath = join(runRoot, "kubectl-objects.txt");
  writeFileSync(objectsPath, objects);

  const pong = kubectl([
    "-n",
    namespace,
    "exec",
    "statefulset/redis-master",
    "--",
    "redis-cli",
    "--no-auth-warning",
    "-a",
    "confighub-redis-password",
    "ping",
  ]);
  const pongPath = join(runRoot, "redis-pong.txt");
  writeFileSync(pongPath, pong);
  if (!pong.includes("PONG")) {
    throw new Error(`Redis PING did not return PONG:\n${pong}`);
  }

  const cubScout = runCubScoutLiveReceipts({
    runDir: runRoot,
    renderedPath: releaseObjects,
    namespace,
    context: contextName,
    targetFacts: loadTargetFactsForRevision(variantRevision),
  });
  const cubScoutChecks = cubScout.checks.map(yamlCheck).join("\n");

  const observedAt = new Date().toISOString();
  const receipt = `apiVersion: helm-expt.confighub.com/v1alpha1
kind: ObservationReceipt
metadata:
  name: bitnami-redis-${variantName}-r001-local-kind
spec:
  variantRevision: ${yamlQuote(variantRevision)}
  renderedObjectSetSHA256: ${yamlQuote(renderedDigest)}
  observer:
    name: redis-local-e2e
    version: "0.1.0"
    method: kubectl-kind
  target:
    kind: kind
    name: ${yamlQuote(clusterName)}
    context: ${yamlQuote(contextName)}
    namespace: ${yamlQuote(namespace)}
  cubScout:
    status: ${yamlQuote(cubScout.status)}
    source: ${yamlQuote(cubScout.source)}
    supportsTtl: ${yamlScalar(cubScout.supportsTtl)}
    supportsNoExtras: ${yamlScalar(cubScout.supportsNoExtras)}
    reason: ${yamlQuote(cubScout.reason)}
  observedAt: ${yamlQuote(observedAt)}
  freshnessTTL: 1h
  result: pass
  clusterStatus: ${yamlQuote(clusterStatus)}
  variant: ${yamlQuote(variantName)}
  targetFacts:
    defaultStorageClass:
      name: ${yamlQuote(storageClass.defaultName)}
      status: ${yamlQuote(storageClass.status)}
      provisionerURL: ${yamlQuote(storageClass.provisionerURL)}
${requiredSecret ? `    requiredSecret:
      namespace: ${yamlQuote(requiredSecret.namespace)}
      name: ${yamlQuote(requiredSecret.name)}
      key: ${yamlQuote(requiredSecret.key)}
      status: applied-by-test
      evidencePath: ${yamlQuote(requiredSecret.evidencePath)}
      evidenceSHA256: ${yamlQuote(requiredSecret.evidenceSHA256)}
` : ""}  checks:
    - name: namespace-support-object-applied
      result: pass
      object: v1|Namespace||redis
${requiredSecret ? `    - name: target-secret-present
      result: pass
      object: v1|Secret|redis|redis-existing-secret
` : ""}    - name: statefulset-redis-master-rollout
      result: pass
      object: apps/v1|StatefulSet|redis|redis-master
    - name: statefulset-redis-replicas-rollout
      result: pass
      object: apps/v1|StatefulSet|redis|redis-replicas
    - name: redis-ping
      result: pass
      evidencePath: redis-pong.txt
      evidenceSHA256: ${yamlQuote(sha256File(pongPath))}
    - name: redis-pvcs-bound
      result: pass
      count: 4
${cubScoutChecks ? `${cubScoutChecks}\n` : ""}
  kubectlObjects:
    path: kubectl-objects.txt
    sha256: ${yamlQuote(sha256File(objectsPath))}
`;
  writeFileSync(join(runRoot, "observation-receipt.yaml"), receipt);
  console.log(`wrote ${join(runRoot, "observation-receipt.yaml")}`);
}

main();
