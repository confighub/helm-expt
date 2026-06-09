import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  check,
  parseDocs,
  parseObjects,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  toYaml,
  write,
} from "./lib/proof-common.mjs";
import { loadTargetFactsForRevision, runCubScoutLiveReceipts } from "./lib/cub-scout-live.mjs";

const clusterName = optionValue("--cluster") ?? "helm-expt-redis";
const contextName = `kind-${clusterName}`;
const mode = process.argv[2] ?? "--help";
const selectedSlug = optionValue("--chart");
const selectedFromRank = numberOption("--from-rank");
const selectedToRank = numberOption("--to-rank");
const continueOnFail = process.argv.includes("--continue-on-fail");
const summaryRoot = join(repoRoot, "data", "live-e2e");
const redisReceiptPath = join(repoRoot, "runs", "redis-local-kind", "latest", "observation-receipt.yaml");

const targets = [
  {
    rank: 2,
    slug: "metrics-server",
    chart: "metrics-server/metrics-server",
    version: "3.13.0",
    namespace: "kube-system",
    variant: "default",
    revision: "recipes/metrics-server/metrics-server/3.13.0/revisions/default/r001/variant-revision.yaml",
    rendered: "recipes/metrics-server/metrics-server/3.13.0/revisions/default/r001/rendered/release-objects.yaml",
    waits: [{ kind: "deployment", name: "metrics-server", namespace: "kube-system" }],
    objectChecks: [{ kind: "apiservice", name: "v1beta1.metrics.k8s.io" }],
  },
  {
    rank: 3,
    slug: "ingress-nginx",
    chart: "ingress-nginx/ingress-nginx",
    version: "4.15.1",
    namespace: "ingress-nginx",
    variant: "internal-clusterip",
    revision: "recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/internal-clusterip/r001/variant-revision.yaml",
    rendered: "recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/internal-clusterip/r001/rendered/release-objects.yaml",
    waits: [{ kind: "deployment", name: "ingress-nginx-controller", namespace: "ingress-nginx" }],
  },
  {
    rank: 4,
    slug: "cert-manager",
    chart: "jetstack/cert-manager",
    version: "v1.20.2",
    namespace: "cert-manager",
    variant: "crds-enabled",
    revision: "recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/variant-revision.yaml",
    rendered: "recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml",
    waits: [
      { kind: "deployment", name: "cert-manager", namespace: "cert-manager" },
      { kind: "deployment", name: "cert-manager-cainjector", namespace: "cert-manager" },
      { kind: "deployment", name: "cert-manager-webhook", namespace: "cert-manager" },
    ],
  },
  {
    rank: 5,
    slug: "external-secrets",
    chart: "external-secrets/external-secrets",
    version: "2.5.0",
    namespace: "external-secrets",
    variant: "default",
    revision: "recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/variant-revision.yaml",
    rendered: "recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/rendered/release-objects.yaml",
  },
  {
    rank: 6,
    slug: "argo-cd",
    chart: "argo-cd/argo-cd",
    version: "9.5.15",
    namespace: "argocd",
    variant: "default",
    revision: "recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/variant-revision.yaml",
    rendered: "recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/rendered/release-objects.yaml",
    supportSecrets: [
      {
        type: "generic",
        name: "argocd-redis",
        namespace: "argocd",
        literals: { auth: "confighub-argocd-redis-password" },
        reason: "Argo CD built-in Redis expects the hard-coded argocd-redis Secret when hooks are excluded",
      },
    ],
  },
  {
    rank: 7,
    slug: "kube-prometheus-stack",
    chart: "prometheus-community/kube-prometheus-stack",
    version: "85.3.3",
    namespace: "monitoring",
    variant: "default",
    revision: "recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/variant-revision.yaml",
    rendered: "recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/release-objects.yaml",
    supportSecrets: [
      {
        type: "tls-files",
        name: "kube-prometheus-stack-admission",
        namespace: "monitoring",
        certKey: "cert",
        keyKey: "key",
        commonName: "kube-prometheus-stack-operator.monitoring.svc",
        reason: "Prometheus Operator admission webhook TLS Secret is normally created by Helm hook lifecycle",
      },
    ],
    waits: [
      { kind: "daemonset", name: "kube-prometheus-stack-prometheus-node-exporter", namespace: "monitoring" },
      { kind: "deployment", name: "kube-prometheus-stack-grafana", namespace: "monitoring" },
      { kind: "deployment", name: "kube-prometheus-stack-kube-state-metrics", namespace: "monitoring" },
      { kind: "deployment", name: "kube-prometheus-stack-operator", namespace: "monitoring" },
      { kind: "statefulset", name: "alertmanager-kube-prometheus-stack-alertmanager", namespace: "monitoring" },
      { kind: "statefulset", name: "prometheus-kube-prometheus-stack-prometheus", namespace: "monitoring" },
    ],
  },
  {
    rank: 8,
    slug: "postgresql",
    chart: "bitnami/postgresql",
    version: "18.6.7",
    namespace: "postgresql",
    variant: "generated-passwords",
    revision: "recipes/bitnami/postgresql/18.6.7/revisions/generated-passwords/r001/variant-revision.yaml",
    rendered: "recipes/bitnami/postgresql/18.6.7/revisions/generated-passwords/r001/rendered/release-objects.yaml",
    needsDefaultStorageClass: true,
    waits: [{ kind: "statefulset", name: "postgresql", namespace: "postgresql" }],
    pvcSelector: "app.kubernetes.io/instance=postgresql",
  },
  {
    rank: 9,
    slug: "rabbitmq",
    chart: "bitnami/rabbitmq",
    version: "16.0.14",
    namespace: "rabbitmq",
    variant: "generated-passwords",
    revision: "recipes/bitnami/rabbitmq/16.0.14/revisions/generated-passwords/r001/variant-revision.yaml",
    rendered: "recipes/bitnami/rabbitmq/16.0.14/revisions/generated-passwords/r001/rendered/release-objects.yaml",
    needsDefaultStorageClass: true,
    waits: [{ kind: "statefulset", name: "rabbitmq", namespace: "rabbitmq" }],
    pvcSelector: "app.kubernetes.io/instance=rabbitmq",
  },
  {
    rank: 10,
    slug: "loki",
    chart: "grafana/loki",
    version: "7.0.0",
    namespace: "loki",
    variant: "single-binary-filesystem",
    revision: "recipes/grafana/loki/7.0.0/revisions/single-binary-filesystem/r001/variant-revision.yaml",
    rendered: "recipes/grafana/loki/7.0.0/revisions/single-binary-filesystem/r001/rendered/release-objects.yaml",
    needsDefaultStorageClass: true,
  },
  {
    rank: 11,
    slug: "longhorn",
    chart: "longhorn/longhorn",
    version: "1.11.2",
    namespace: "longhorn-system",
    variant: "default",
    revision: "recipes/longhorn/longhorn/1.11.2/revisions/default/r001/variant-revision.yaml",
    rendered: "recipes/longhorn/longhorn/1.11.2/revisions/default/r001/rendered/release-objects.yaml",
    needsDefaultStorageClass: true,
  },
  {
    rank: 12,
    slug: "vault",
    chart: "hashicorp/vault",
    version: "0.32.0",
    namespace: "vault",
    variant: "dev-mode",
    revision: "recipes/hashicorp/vault/0.32.0/revisions/dev-mode/r001/variant-revision.yaml",
    rendered: "recipes/hashicorp/vault/0.32.0/revisions/dev-mode/r001/rendered/release-objects.yaml",
    waits: [
      { kind: "deployment", name: "vault-agent-injector", namespace: "vault" },
      {
        kind: "pod",
        namespace: "vault",
        selector: "app.kubernetes.io/instance=vault,component=server",
        condition: "phase",
        value: "Running",
        name: "vault-server-pod",
      },
    ],
  },
  {
    rank: 13,
    slug: "secrets-store-csi-driver",
    chart: "secrets-store-csi-driver/secrets-store-csi-driver",
    version: "1.6.0",
    namespace: "kube-system",
    variant: "default",
    revision: "recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/revisions/default/r001/variant-revision.yaml",
    rendered: "recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/revisions/default/r001/rendered/release-objects.yaml",
  },
  {
    rank: 14,
    slug: "prometheus",
    chart: "prometheus-community/prometheus",
    version: "29.8.0",
    namespace: "monitoring",
    variant: "server-only-ephemeral",
    revision: "recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/variant-revision.yaml",
    rendered: "recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/rendered/release-objects.yaml",
  },
  {
    rank: 15,
    slug: "grafana",
    chart: "grafana/grafana",
    version: "10.5.15",
    namespace: "grafana",
    variant: "generated-passwords",
    revision: "recipes/grafana/grafana/10.5.15/revisions/generated-passwords/r001/variant-revision.yaml",
    rendered: "recipes/grafana/grafana/10.5.15/revisions/generated-passwords/r001/rendered/release-objects.yaml",
  },
  {
    rank: 16,
    slug: "mysql",
    chart: "bitnami/mysql",
    version: "14.0.3",
    namespace: "mysql",
    variant: "generated-passwords",
    revision: "recipes/bitnami/mysql/14.0.3/revisions/generated-passwords/r001/variant-revision.yaml",
    rendered: "recipes/bitnami/mysql/14.0.3/revisions/generated-passwords/r001/rendered/release-objects.yaml",
    needsDefaultStorageClass: true,
    waits: [{ kind: "statefulset", name: "mysql", namespace: "mysql" }],
    pvcSelector: "app.kubernetes.io/instance=mysql",
  },
  {
    rank: 17,
    slug: "mongodb",
    chart: "bitnami/mongodb",
    version: "19.0.7",
    namespace: "mongodb",
    variant: "generated-passwords",
    revision: "recipes/bitnami/mongodb/19.0.7/revisions/generated-passwords/r001/variant-revision.yaml",
    rendered: "recipes/bitnami/mongodb/19.0.7/revisions/generated-passwords/r001/rendered/release-objects.yaml",
    needsDefaultStorageClass: true,
  },
  {
    rank: 18,
    slug: "nginx",
    chart: "bitnami/nginx",
    version: "24.0.2",
    namespace: "nginx",
    variant: "http-clusterip",
    revision: "recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/variant-revision.yaml",
    rendered: "recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml",
    waits: [{ kind: "deployment", name: "nginx", namespace: "nginx" }],
  },
  {
    rank: 19,
    slug: "tempo",
    chart: "grafana/tempo",
    version: "1.24.4",
    namespace: "tempo",
    variant: "local-persistent",
    revision: "recipes/grafana/tempo/1.24.4/revisions/local-persistent/r001/variant-revision.yaml",
    rendered: "recipes/grafana/tempo/1.24.4/revisions/local-persistent/r001/rendered/release-objects.yaml",
    needsDefaultStorageClass: true,
    needsStorageClass: "local-path",
  },
  {
    rank: 20,
    slug: "consul",
    chart: "hashicorp/consul",
    version: "2.0.0",
    namespace: "consul",
    variant: "default-control-plane",
    revision: "recipes/hashicorp/consul/2.0.0/revisions/default-control-plane/r001/variant-revision.yaml",
    rendered: "recipes/hashicorp/consul/2.0.0/revisions/default-control-plane/r001/rendered/release-objects.yaml",
    needsDefaultStorageClass: true,
  },
];

if (mode === "--run") {
  const selected = selectedTargets();
  ensureCluster();
  for (const target of selected) runTarget(target);
  writeSummary();
} else if (mode === "--verify") {
  const selected = selectedTargets({ requireAllByDefault: true });
  if (shouldIncludeRedis()) verifyRedisTop20();
  for (const target of selected) verifyTarget(target);
  console.log(`verified ${selected.length + (shouldIncludeRedis() ? 1 : 0)} top20 local kind e2e receipt(s)`);
} else if (mode === "--summary") {
  writeSummary();
} else {
  console.log(`Usage:
  node scripts/run-top20-local-e2e.mjs --run --chart nginx
  node scripts/run-top20-local-e2e.mjs --run --from-rank 3 --to-rank 20 --continue-on-fail
  node scripts/run-top20-local-e2e.mjs --run --all --continue-on-fail
  node scripts/run-top20-local-e2e.mjs --verify
  node scripts/run-top20-local-e2e.mjs --summary`);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function numberOption(name) {
  const value = optionValue(name);
  return value === null ? null : Number(value);
}

function selectedTargets({ onlyPassingReceiptsByDefault = false, requireAllByDefault = false } = {}) {
  let selected = targets;
  if (process.argv.includes("--all")) return targets;
  if (selectedSlug) {
    if (selectedSlug === "redis") return [];
    const target = targets.find((item) => item.slug === selectedSlug);
    check(Boolean(target), `unknown local e2e chart ${selectedSlug}`);
    return [target];
  }
  if (selectedFromRank !== null) selected = selected.filter((target) => target.rank >= selectedFromRank);
  if (selectedToRank !== null) selected = selected.filter((target) => target.rank <= selectedToRank);
  if (selectedFromRank !== null || selectedToRank !== null) return selected;
  if (requireAllByDefault) return targets;
  if (onlyPassingReceiptsByDefault) return targets.filter((target) => existingPassReceiptPath(target));
  return targets.filter((target) => existingReceiptPath(target));
}

function shouldIncludeRedis() {
  if (selectedSlug) return selectedSlug === "redis";
  if (selectedFromRank !== null && selectedFromRank > 1) return false;
  if (selectedToRank !== null && selectedToRank < 1) return false;
  return true;
}

function runTarget(target) {
  const runRoot = runRootFor(target);
  mkdirSync(runRoot, { recursive: true });
  const renderedPath = join(repoRoot, target.rendered);
  const checks = [];
  let stage = "preflight";
  try {
    check(existsSync(renderedPath), `${target.slug} rendered object file missing`);
    const renderedDigest = sha256File(renderedPath);
    const revision = readYaml(join(repoRoot, target.revision));
    check(
      revision.spec?.digestInputs?.renderedObjectSetSHA256 === renderedDigest,
      `${target.slug} rendered digest mismatch before local e2e`,
    );

    const renderedText = readFileSync(renderedPath, "utf8");
    const docs = parseDocs(renderedText);
    const objectCount = parseObjects(renderedText).length;
    if (target.needsDefaultStorageClass) ensureDefaultStorageClass();
    if (target.needsStorageClass) ensureNamedStorageClass(target.needsStorageClass, runRoot);
    stage = "namespace";
    ensureNamespace(target.namespace, runRoot);
    stage = "support-secrets";
    checks.push(...applySupportSecrets(target, runRoot));
    stage = "crd-bootstrap";
    checks.push(...bootstrapCrds(docs, runRoot));
    stage = "server-side-apply";
    const applyLog = kubectl(["apply", "--server-side", "--force-conflicts", "-f", renderedPath]);
    writeFileSync(join(runRoot, "kubectl-apply.txt"), applyLog);
    checks.push({
      name: "server-side-apply",
      result: "pass",
      evidencePath: "kubectl-apply.txt",
      evidenceSHA256: sha256File(join(runRoot, "kubectl-apply.txt")),
    });

    for (const wait of target.waits ?? workloadWaits(target, docs)) {
      stage = `${wait.kind}-${wait.name}-rollout`;
      const output = waitForObject(wait);
      const evidencePath = `${wait.kind}-${wait.name}-${wait.condition ?? "rollout"}.txt`;
      writeFileSync(join(runRoot, evidencePath), output);
      checks.push({
        name: `${wait.kind}-${wait.name}-${wait.condition ?? "rollout"}`,
        result: "pass",
        object: wait.selector ? `${wait.kind}/${wait.selector}` : `${wait.kind}/${wait.name}`,
        evidencePath,
        evidenceSHA256: sha256File(join(runRoot, evidencePath)),
      });
    }
    for (const objectCheck of target.objectChecks ?? []) {
      stage = `${objectCheck.kind}-${objectCheck.name}-exists`;
      const output = kubectl(["get", objectCheck.kind, objectCheck.name, "-o", "name"]);
      const evidencePath = `${objectCheck.kind}-${objectCheck.name}.txt`;
      writeFileSync(join(runRoot, evidencePath), output);
      checks.push({
        name: `${objectCheck.kind}-${objectCheck.name}-exists`,
        result: "pass",
        object: `${objectCheck.kind}/${objectCheck.name}`,
        evidencePath,
        evidenceSHA256: sha256File(join(runRoot, evidencePath)),
      });
    }
    for (const crd of renderedCrds(docs)) {
      stage = `crd-${crd.name}-exists`;
      const output = kubectl(["get", "crd", crd.name, "-o", "name"]);
      const evidencePath = `crd-${crd.name}.txt`;
      writeFileSync(join(runRoot, evidencePath), output);
      checks.push({
        name: "crd-exists",
        result: "pass",
        object: `customresourcedefinition/${crd.name}`,
        evidencePath,
        evidenceSHA256: sha256File(join(runRoot, evidencePath)),
      });
    }
    if (target.pvcSelector) {
      stage = "pvc-bound";
      const pvcJson = kubectl(["-n", target.namespace, "get", "pvc", "-l", target.pvcSelector, "-o", "json"]);
      const evidencePath = "pvc-status.json";
      writeFileSync(join(runRoot, evidencePath), pvcJson);
      const pvcs = JSON.parse(pvcJson).items ?? [];
      const bound = pvcs.filter((pvc) => pvc.status?.phase === "Bound").length;
      check(pvcs.length > 0, `${target.slug} did not create PVCs`);
      check(bound === pvcs.length, `${target.slug} has unbound PVCs`);
      checks.push({
        name: "pvc-bound",
        result: "pass",
        count: bound,
        evidencePath,
        evidenceSHA256: sha256File(join(runRoot, evidencePath)),
      });
    }

    stage = "object-inventory";
    const objects = kubectl(["-n", target.namespace, "get", "all,pvc,pdb,configmap,secret,serviceaccount", "-o", "wide"]);
    writeFileSync(join(runRoot, "kubectl-objects.txt"), objects);
    stage = "cub-scout-live-witness";
    const cubScout = runCubScoutLiveReceipts({
      runDir: runRoot,
      renderedPath,
      namespace: target.namespace,
      context: contextName,
      targetFacts: loadTargetFactsForRevision(target.revision),
    });
    checks.push(...cubScout.checks);
    writeReceipt({ target, renderedDigest, objectCount, checks, result: "pass" });
    console.log(`wrote ${relativeRepo(join(runRoot, "observation-receipt.json"))}`);
  } catch (error) {
    writeFailureReceipt({ target, checks, stage, error });
    console.error(`${target.slug} local e2e failed at ${stage}: ${error.message}`);
    if (!continueOnFail) throw error;
  }
}

function applySupportSecrets(target, runRoot) {
  const checks = [];
  for (const secret of target.supportSecrets ?? []) {
    if (secret.type === "generic") {
      const args = ["-n", secret.namespace, "create", "secret", "generic", secret.name];
      for (const [key, value] of Object.entries(secret.literals ?? {})) args.push(`--from-literal=${key}=${value}`);
      args.push("--dry-run=client", "-o", "yaml");
      const yaml = kubectl(args);
      const secretPath = join(runRoot, `support-secret-${secret.name}.yaml`);
      writeFileSync(secretPath, yaml);
      const applyOutput = kubectl(["apply", "-f", secretPath]);
      const evidencePath = `support-secret-${secret.name}.txt`;
      writeFileSync(join(runRoot, evidencePath), `${secret.reason}\n${applyOutput}`);
      checks.push({
        name: `support-secret-${secret.name}`,
        result: "pass",
        reason: secret.reason,
        evidencePath,
        evidenceSHA256: sha256File(join(runRoot, evidencePath)),
      });
      continue;
    }
    if (secret.type === "tls-files") {
      const keyPath = join(runRoot, `${secret.name}.key`);
      const certPath = join(runRoot, `${secret.name}.crt`);
      execFileSync(
        "openssl",
        [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-keyout",
          keyPath,
          "-out",
          certPath,
          "-days",
          "1",
          "-subj",
          `/CN=${secret.commonName}`,
        ],
        { cwd: repoRoot, stdio: "ignore" },
      );
      const yaml = kubectl([
        "-n",
        secret.namespace,
        "create",
        "secret",
        "generic",
        secret.name,
        `--from-file=${secret.certKey}=${certPath}`,
        `--from-file=${secret.keyKey}=${keyPath}`,
        "--dry-run=client",
        "-o",
        "yaml",
      ]);
      const secretPath = join(runRoot, `support-secret-${secret.name}.yaml`);
      writeFileSync(secretPath, yaml);
      const applyOutput = kubectl(["apply", "-f", secretPath]);
      const evidencePath = `support-secret-${secret.name}.txt`;
      writeFileSync(join(runRoot, evidencePath), `${secret.reason}\n${applyOutput}`);
      checks.push({
        name: `support-secret-${secret.name}`,
        result: "pass",
        reason: secret.reason,
        evidencePath,
        evidenceSHA256: sha256File(join(runRoot, evidencePath)),
      });
      continue;
    }
    throw new Error(`unknown support secret type ${secret.type}`);
  }
  return checks;
}

function waitForObject(wait) {
  if (wait.kind === "pod" && wait.condition === "phase") {
    return kubectl([
      "-n",
      wait.namespace,
      "wait",
      `--for=jsonpath={.status.phase}=${wait.value}`,
      "pod",
      "-l",
      wait.selector,
      "--timeout=300s",
    ]);
  }
  return kubectl(["-n", wait.namespace, "rollout", "status", `${wait.kind}/${wait.name}`, "--timeout=300s"]);
}

function verifyTarget(target) {
  const receiptPath = join(runRootFor(target), "observation-receipt.json");
  check(existsSync(receiptPath), `${target.slug} missing local e2e observation receipt`);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  check(receipt.kind === "ObservationReceipt", `${target.slug} receipt kind mismatch`);
  check(receipt.spec?.result === "pass", `${target.slug} local e2e must pass`);
  check(receipt.spec?.chart === target.chart, `${target.slug} chart mismatch`);
  check(receipt.spec?.variant === target.variant, `${target.slug} variant mismatch`);
  check(receipt.spec?.target?.kind === "kind", `${target.slug} target kind mismatch`);
  check(Boolean(receipt.spec?.target?.name), `${target.slug} target cluster missing`);
  check(Boolean(receipt.spec?.target?.context), `${target.slug} target context missing`);
  check(receipt.spec?.renderedObjectSetSHA256 === sha256File(join(repoRoot, target.rendered)), `${target.slug} rendered digest mismatch`);
  for (const checkItem of receipt.spec?.checks ?? []) {
    if (checkItem.evidencePath) {
      const evidencePath = join(runRootFor(target), checkItem.evidencePath);
      check(existsSync(evidencePath), `${target.slug} missing evidence ${checkItem.evidencePath}`);
      check(checkItem.evidenceSHA256 === sha256File(evidencePath), `${target.slug} evidence digest mismatch: ${checkItem.evidencePath}`);
    }
  }
  const objectsPath = join(runRootFor(target), receipt.spec?.kubectlObjects?.path ?? "");
  check(existsSync(objectsPath), `${target.slug} missing kubectl objects evidence`);
  check(receipt.spec.kubectlObjects.sha256 === sha256File(objectsPath), `${target.slug} kubectl objects digest mismatch`);
}

function verifyRedisTop20() {
  check(existsSync(redisReceiptPath), "redis missing local e2e observation receipt");
  const receipt = readYaml(redisReceiptPath);
  check(receipt.kind === "ObservationReceipt", "redis receipt kind mismatch");
  check(receipt.spec?.result === "pass", "redis local e2e must pass");
  check(receipt.spec?.variant === "default", "redis variant mismatch");
  check(receipt.spec?.target?.kind === "kind", "redis target kind mismatch");
  check(
    receipt.spec?.renderedObjectSetSHA256 ===
      sha256File(join(repoRoot, "recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml")),
    "redis rendered digest mismatch",
  );
  for (const checkItem of receipt.spec?.checks ?? []) {
    if (checkItem.evidencePath && checkItem.evidenceSHA256) {
      const evidencePath = join(dirname(redisReceiptPath), checkItem.evidencePath);
      check(existsSync(evidencePath), `redis missing evidence ${checkItem.evidencePath}`);
      check(checkItem.evidenceSHA256 === sha256File(evidencePath), `redis evidence digest mismatch: ${checkItem.evidencePath}`);
    }
  }
}

function bootstrapCrds(docs, runRoot) {
  const crds = docs.filter((doc) => doc.kind === "CustomResourceDefinition");
  if (crds.length === 0) return [];
  const crdPath = join(runRoot, "rendered-crds.yaml");
  writeFileSync(crdPath, `${crds.map((doc) => toYaml(doc)).join("\n---\n")}\n`);
  const applyOutput = kubectl(["apply", "--server-side", "--force-conflicts", "-f", crdPath]);
  writeFileSync(join(runRoot, "crd-bootstrap-apply.txt"), applyOutput);
  const checks = [{
    name: "crd-bootstrap-apply",
    result: "pass",
    count: crds.length,
    evidencePath: "crd-bootstrap-apply.txt",
    evidenceSHA256: sha256File(join(runRoot, "crd-bootstrap-apply.txt")),
  }];
  for (const crd of renderedCrds(docs)) {
    const output = kubectl(["wait", "--for=condition=Established", `crd/${crd.name}`, "--timeout=120s"]);
    const evidencePath = `crd-${crd.name}-established.txt`;
    writeFileSync(join(runRoot, evidencePath), output);
    checks.push({
      name: "crd-established",
      result: "pass",
      object: `customresourcedefinition/${crd.name}`,
      evidencePath,
      evidenceSHA256: sha256File(join(runRoot, evidencePath)),
    });
  }
  return checks;
}

function workloadWaits(target, docs) {
  const skip = new Set(target.skipWaitObjects ?? []);
  return docs
    .filter((doc) => ["Deployment", "StatefulSet", "DaemonSet"].includes(doc.kind))
    .map((doc) => ({
      kind: doc.kind.toLowerCase(),
      name: doc.metadata?.name,
      namespace: doc.metadata?.namespace || target.namespace,
    }))
    .filter((wait) => wait.name && !skip.has(`${wait.kind}/${wait.namespace}/${wait.name}`));
}

function renderedCrds(docs) {
  return docs
    .filter((doc) => doc.kind === "CustomResourceDefinition")
    .map((doc) => ({ name: doc.metadata?.name }))
    .filter((item) => item.name);
}

function writeReceipt({ target, renderedDigest, objectCount, checks, result, failure }) {
  const runRoot = runRootFor(target);
  const kubectlObjectsPath = join(runRoot, "kubectl-objects.txt");
  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ObservationReceipt",
    metadata: { name: `${target.slug}-${target.variant}-local-kind` },
    spec: {
      variantRevision: target.revision,
      renderedObjectSetSHA256: renderedDigest,
      observer: {
        name: "top20-local-e2e",
        version: "0.2.0",
        method: "kubectl-kind",
      },
      target: {
        kind: "kind",
        name: clusterName,
        context: contextName,
        namespace: target.namespace,
      },
      observedAt: new Date().toISOString(),
      freshnessTTL: "1h",
      result,
      chart: target.chart,
      chartVersion: target.version,
      rank: target.rank,
      variant: target.variant,
      renderedObjectCount: objectCount,
      checks,
      kubectlObjects: existsSync(kubectlObjectsPath)
        ? {
            path: "kubectl-objects.txt",
            sha256: sha256File(kubectlObjectsPath),
          }
        : undefined,
      failure,
    },
  };
  writeFileSync(join(runRoot, "observation-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
}

function writeFailureReceipt({ target, checks, stage, error }) {
  const runRoot = runRootFor(target);
  mkdirSync(runRoot, { recursive: true });
  const renderedPath = join(repoRoot, target.rendered);
  const renderedDigest = existsSync(renderedPath) ? sha256File(renderedPath) : "missing";
  const objectCount = existsSync(renderedPath) ? parseObjects(readFileSync(renderedPath, "utf8")).length : 0;
  const evidencePath = "failure.txt";
  writeFileSync(join(runRoot, evidencePath), `${String(error?.stack ?? error?.message ?? error)}\n`);
  const diagnostics = collectDiagnostics(target, runRoot);
  writeReceipt({
    target,
    renderedDigest,
    objectCount,
    checks,
    result: "fail",
    failure: {
      stage,
      message: String(error?.message ?? error),
      evidencePath,
      evidenceSHA256: sha256File(join(runRoot, evidencePath)),
      diagnostics,
    },
  });
}

function collectDiagnostics(target, runRoot) {
  const diagnostics = [];
  const namespacedObjects = safeKubectl(["-n", target.namespace, "get", "pods,pvc,statefulset,deployment,daemonset", "-o", "wide"]);
  if (namespacedObjects !== null) {
    const evidencePath = "diagnostics-namespaced-objects.txt";
    writeFileSync(join(runRoot, evidencePath), namespacedObjects);
    diagnostics.push({
      name: "namespaced-objects",
      evidencePath,
      evidenceSHA256: sha256File(join(runRoot, evidencePath)),
    });
  }
  const events = safeKubectl(["-n", target.namespace, "get", "events", "--sort-by=.lastTimestamp"]);
  if (events !== null) {
    const evidencePath = "diagnostics-events.txt";
    writeFileSync(join(runRoot, evidencePath), events);
    diagnostics.push({
      name: "events",
      evidencePath,
      evidenceSHA256: sha256File(join(runRoot, evidencePath)),
    });
  }
  const clusterObjects = safeKubectl(["get", "storageclass,mutatingwebhookconfiguration,validatingwebhookconfiguration", "-o", "wide"]);
  if (clusterObjects !== null) {
    const evidencePath = "diagnostics-cluster-objects.txt";
    writeFileSync(join(runRoot, evidencePath), clusterObjects);
    diagnostics.push({
      name: "cluster-objects",
      evidencePath,
      evidenceSHA256: sha256File(join(runRoot, evidencePath)),
    });
  }
  return diagnostics;
}

function writeSummary() {
  mkdirSync(summaryRoot, { recursive: true });
  const rows = [redisSummaryRow(), ...targets.map((target) => {
    const receiptPath = join(runRootFor(target), "observation-receipt.json");
    const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : null;
    return {
      rank: target.rank,
      chart: target.chart,
      version: target.version,
      variant: target.variant,
      result: receipt?.spec?.result ?? "not-started",
      cubScout: cubScoutStatus(receipt),
      cubScoutChecks: cubScoutCheckSummary(receipt),
      failureStage: receipt?.spec?.failure?.stage ?? "",
      receipt: receipt ? relativeRepo(receiptPath) : "",
    };
  })];
  const csv = toCsv(rows);
  const passCount = rows.filter((row) => row.result === "pass").length;
  const failCount = rows.filter((row) => row.result === "fail").length;
  const summary = `# Top-20 Local Kind Live/E2E

This report records live Kubernetes observation receipts for the top-20 chart
proof set. A passing row means the rendered ConfigHub/cub installer package output
was applied to a local kind cluster and the declared live checks passed. A
failing row is still useful evidence: it tells us exactly which production
disposition or local-kind limitation must be handled before we claim broader
support.

\`\`\`text
pass: ${passCount}
fail: ${failCount}
not-started: ${rows.length - passCount - failCount}
\`\`\`

| Rank | Chart | Variant | Result | cub-scout | cub-scout checks | Failure stage | Receipt |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.rank} | \`${row.chart}@${row.version}\` | ${row.variant} | ${row.result} | ${row.cubScout || "-"} | ${row.cubScoutChecks || "-"} | ${row.failureStage || "-"} | ${row.receipt || "-"} |`).join("\n")}
`;
  write(join(summaryRoot, "top20-local-kind.csv"), csv);
  write(join(summaryRoot, "summary.md"), summary);
  console.log(`wrote ${relativeRepo(join(summaryRoot, "top20-local-kind.csv"))}`);
  console.log(`wrote ${relativeRepo(join(summaryRoot, "summary.md"))}`);
}

function redisSummaryRow() {
  const receipt = existsSync(redisReceiptPath) ? readYaml(redisReceiptPath) : null;
  return {
    rank: 1,
    chart: "bitnami/redis",
    version: "25.5.3",
    variant: "default",
    result: receipt?.spec?.result ?? "not-started",
    cubScout: cubScoutStatus(receipt),
    cubScoutChecks: cubScoutCheckSummary(receipt),
    failureStage: "",
    receipt: receipt ? relativeRepo(redisReceiptPath) : "",
  };
}

function toCsv(rows) {
  const headers = ["rank", "chart", "version", "variant", "result", "cubScout", "cubScoutChecks", "failureStage", "receipt"];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function cubScoutStatus(receipt) {
  if (receipt?.spec?.cubScout?.status) return receipt.spec.cubScout.status;
  const checks = (receipt?.spec?.checks ?? []).filter((checkItem) => String(checkItem.name ?? "").startsWith("cub-scout-"));
  return checks.length ? "observed" : "";
}

function cubScoutCheckSummary(receipt) {
  const checks = (receipt?.spec?.checks ?? []).filter((checkItem) => String(checkItem.name ?? "").startsWith("cub-scout-"));
  if (!checks.length) return "";
  const passing = checks.filter((checkItem) => checkItem.result === "pass" && (!checkItem.verdict || checkItem.verdict === "PASS")).length;
  return `${passing}/${checks.length} pass`;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function ensureCluster() {
  const clusters = execFileSync("kind", ["get", "clusters"], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (clusters.includes(clusterName)) return;
  execFileSync("kind", ["create", "cluster", "--name", clusterName, "--image", "kindest/node:v1.30.0", "--wait", "180s"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

function ensureNamespace(namespace, runRoot) {
  if (namespace === "default" || namespace === "kube-system") return;
  const namespaceYaml = kubectl(["create", "namespace", namespace, "--dry-run=client", "-o", "yaml"]);
  writeFileSync(join(runRoot, "namespace.yaml"), namespaceYaml);
  kubectl(["apply", "-f", join(runRoot, "namespace.yaml")]);
}

function ensureDefaultStorageClass() {
  const state = JSON.parse(kubectl(["get", "storageclass", "-o", "json"]));
  const hasDefault = (state.items ?? []).some((item) => {
    const annotations = item.metadata?.annotations ?? {};
    return annotations["storageclass.kubernetes.io/is-default-class"] === "true";
  });
  if (hasDefault) return;
  kubectl(["apply", "-f", "https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.32/deploy/local-path-storage.yaml"]);
  kubectl(["-n", "local-path-storage", "rollout", "status", "deployment/local-path-provisioner", "--timeout=180s"]);
  kubectl(["patch", "storageclass", "local-path", "-p", '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}']);
}

function ensureNamedStorageClass(name, runRoot) {
  const state = JSON.parse(kubectl(["get", "storageclass", "-o", "json"]));
  if ((state.items ?? []).some((item) => item.metadata?.name === name)) return;
  if (name !== "local-path") throw new Error(`cannot create unknown storage class ${name}`);
  const storageClassPath = join(runRoot, "storageclass-local-path.yaml");
  writeFileSync(
    storageClassPath,
    `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-path
provisioner: rancher.io/local-path
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
`,
  );
  kubectl(["apply", "-f", storageClassPath]);
}

function kubectl(args) {
  const result = spawnSync("kubectl", ["--context", contextName, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  if (result.status !== 0) {
    throw new Error(`kubectl ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function safeKubectl(args) {
  const result = spawnSync("kubectl", ["--context", contextName, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  return result.status === 0 ? result.stdout : null;
}

function runRootFor(target) {
  return join(repoRoot, "runs", "top20-local-kind", `${target.slug}-${target.variant}`);
}

function existingReceiptPath(target) {
  return existsSync(join(runRootFor(target), "observation-receipt.json"));
}

function existingPassReceiptPath(target) {
  const receiptPath = join(runRootFor(target), "observation-receipt.json");
  if (!existsSync(receiptPath)) return false;
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  return receipt.spec?.result === "pass";
}
