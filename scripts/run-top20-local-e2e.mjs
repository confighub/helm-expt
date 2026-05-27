import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  parseObjects,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
} from "./lib/proof-common.mjs";

const clusterName = optionValue("--cluster") ?? "helm-expt-redis";
const contextName = `kind-${clusterName}`;
const mode = process.argv[2] ?? "--help";
const selectedSlug = optionValue("--chart");
const targets = [
  {
    slug: "nginx",
    chart: "bitnami/nginx",
    version: "24.0.2",
    namespace: "nginx",
    variant: "http-clusterip",
    revision: "recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/variant-revision.yaml",
    rendered: "recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml",
    waits: [{ kind: "deployment", name: "nginx", namespace: "nginx", type: "rollout" }],
  },
  {
    slug: "metrics-server",
    chart: "metrics-server/metrics-server",
    version: "3.13.0",
    namespace: "kube-system",
    variant: "default",
    revision: "recipes/metrics-server/metrics-server/3.13.0/revisions/default/r001/variant-revision.yaml",
    rendered: "recipes/metrics-server/metrics-server/3.13.0/revisions/default/r001/rendered/release-objects.yaml",
    waits: [{ kind: "deployment", name: "metrics-server", namespace: "kube-system", type: "rollout" }],
    objectChecks: [{ kind: "apiservice", name: "v1beta1.metrics.k8s.io" }],
  },
  {
    slug: "postgresql",
    chart: "bitnami/postgresql",
    version: "18.6.7",
    namespace: "postgresql",
    variant: "generated-passwords",
    revision: "recipes/bitnami/postgresql/18.6.7/revisions/generated-passwords/r001/variant-revision.yaml",
    rendered: "recipes/bitnami/postgresql/18.6.7/revisions/generated-passwords/r001/rendered/release-objects.yaml",
    needsDefaultStorageClass: true,
    waits: [{ kind: "statefulset", name: "postgresql", namespace: "postgresql", type: "rollout" }],
    pvcSelector: "app.kubernetes.io/instance=postgresql",
  },
  {
    slug: "ingress-nginx",
    chart: "ingress-nginx/ingress-nginx",
    version: "4.15.1",
    namespace: "ingress-nginx",
    variant: "admission-disabled",
    revision: "recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/admission-disabled/r001/variant-revision.yaml",
    rendered: "recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/admission-disabled/r001/rendered/release-objects.yaml",
    waits: [{ kind: "deployment", name: "ingress-nginx-controller", namespace: "ingress-nginx", type: "rollout" }],
  },
  {
    slug: "cert-manager",
    chart: "jetstack/cert-manager",
    version: "v1.20.2",
    namespace: "cert-manager",
    variant: "crds-enabled",
    revision: "recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/variant-revision.yaml",
    rendered: "recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml",
    waits: [
      { kind: "deployment", name: "cert-manager", namespace: "cert-manager", type: "rollout" },
      { kind: "deployment", name: "cert-manager-cainjector", namespace: "cert-manager", type: "rollout" },
      { kind: "deployment", name: "cert-manager-webhook", namespace: "cert-manager", type: "rollout" },
    ],
    crdMinimum: 6,
  },
];

if (mode === "--run") {
  const selected = selectedTargets();
  ensureCluster();
  for (const target of selected) runTarget(target);
} else if (mode === "--verify") {
  const selected = selectedTargets();
  for (const target of selected) verifyTarget(target);
  console.log(`verified ${selected.length} top20 local kind e2e receipt(s)`);
} else {
  console.log(`Usage:
  node scripts/run-top20-local-e2e.mjs --run --chart nginx
  node scripts/run-top20-local-e2e.mjs --run --all
  node scripts/run-top20-local-e2e.mjs --verify --all`);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function selectedTargets() {
  if (process.argv.includes("--all")) return targets;
  if (selectedSlug) {
    const target = targets.find((item) => item.slug === selectedSlug);
    check(Boolean(target), `unknown local e2e chart ${selectedSlug}`);
    return [target];
  }
  return targets.filter((target) => existingReceiptPath(target));
}

function runTarget(target) {
  const runRoot = runRootFor(target);
  mkdirSync(runRoot, { recursive: true });
  const renderedPath = join(repoRoot, target.rendered);
  check(existsSync(renderedPath), `${target.slug} rendered object file missing`);
  const renderedDigest = sha256File(renderedPath);
  const revision = readYaml(join(repoRoot, target.revision));
  check(
    revision.spec?.digestInputs?.renderedObjectSetSHA256 === renderedDigest,
    `${target.slug} rendered digest mismatch before local e2e`,
  );

  const objectCount = parseObjects(readFileSync(renderedPath, "utf8")).length;
  if (target.needsDefaultStorageClass) ensureDefaultStorageClass();
  ensureNamespace(target.namespace, runRoot);
  const applyLog = kubectl(["apply", "--server-side", "--force-conflicts", "-f", renderedPath]);
  writeFileSync(join(runRoot, "kubectl-apply.txt"), applyLog);

  const checks = [
    {
      name: "server-side-apply",
      result: "pass",
      evidencePath: "kubectl-apply.txt",
      evidenceSHA256: sha256File(join(runRoot, "kubectl-apply.txt")),
    },
  ];
  for (const wait of target.waits ?? []) {
    const output = kubectl(["-n", wait.namespace, "rollout", "status", `${wait.kind}/${wait.name}`, "--timeout=300s"]);
    const evidencePath = `${wait.kind}-${wait.name}-rollout.txt`;
    writeFileSync(join(runRoot, evidencePath), output);
    checks.push({
      name: `${wait.kind}-${wait.name}-rollout`,
      result: "pass",
      object: `${wait.kind}/${wait.name}`,
      evidencePath,
      evidenceSHA256: sha256File(join(runRoot, evidencePath)),
    });
  }
  for (const objectCheck of target.objectChecks ?? []) {
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
  if (target.pvcSelector) {
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
  if (target.crdMinimum) {
    const crdJson = kubectl(["get", "crd", "-o", "json"]);
    const evidencePath = "crd-status.json";
    writeFileSync(join(runRoot, evidencePath), crdJson);
    const crds = (JSON.parse(crdJson).items ?? []).filter((item) => item.metadata?.labels?.["app.kubernetes.io/instance"] === "cert-manager");
    check(crds.length >= target.crdMinimum, `${target.slug} expected at least ${target.crdMinimum} CRDs`);
    checks.push({
      name: "crds-present",
      result: "pass",
      count: crds.length,
      evidencePath,
      evidenceSHA256: sha256File(join(runRoot, evidencePath)),
    });
  }

  const objects = kubectl(["-n", target.namespace, "get", "all,pvc,pdb,configmap,secret,serviceaccount", "-o", "wide"]);
  writeFileSync(join(runRoot, "kubectl-objects.txt"), objects);
  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ObservationReceipt",
    metadata: { name: `${target.slug}-${target.variant}-local-kind` },
    spec: {
      variantRevision: target.revision,
      renderedObjectSetSHA256: renderedDigest,
      observer: {
        name: "top20-local-e2e",
        version: "0.1.0",
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
      result: "pass",
      chart: target.chart,
      chartVersion: target.version,
      variant: target.variant,
      renderedObjectCount: objectCount,
      checks,
      kubectlObjects: {
        path: "kubectl-objects.txt",
        sha256: sha256File(join(runRoot, "kubectl-objects.txt")),
      },
    },
  };
  writeFileSync(join(runRoot, "observation-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`wrote ${relativeRepo(join(runRoot, "observation-receipt.json"))}`);
}

function verifyTarget(target) {
  const receiptPath = join(runRootFor(target), "observation-receipt.json");
  check(existsSync(receiptPath), `${target.slug} missing local e2e observation receipt`);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  check(receipt.kind === "ObservationReceipt", `${target.slug} receipt kind mismatch`);
  check(receipt.spec?.result === "pass", `${target.slug} local e2e must pass`);
  check(receipt.spec?.chart === target.chart, `${target.slug} chart mismatch`);
  check(receipt.spec?.variant === target.variant, `${target.slug} variant mismatch`);
  check(receipt.spec?.target?.name === clusterName, `${target.slug} target cluster mismatch`);
  check(receipt.spec?.target?.context === contextName, `${target.slug} target context mismatch`);
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

function runRootFor(target) {
  return join(repoRoot, "runs", "top20-local-kind", `${target.slug}-${target.variant}`);
}

function existingReceiptPath(target) {
  return existsSync(join(runRootFor(target), "observation-receipt.json"));
}
