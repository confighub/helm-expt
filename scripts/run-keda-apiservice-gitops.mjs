#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, parseDocs, readYaml, relativeRepo, repoRoot, sha256, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const chart = "kedacore/keda";
const version = "2.19.0";
const base = "default";
const packagePath = "packages/kedacore/keda/2.19.0";
const recipePath = "recipes/kedacore/keda/2.19.0";
const renderedPath = "recipes/kedacore/keda/2.19.0/revisions/default/r001/rendered/release-objects.yaml";
const receiptPath = "data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml";
const namespace = "default";
const apiServiceName = "v1beta1.external.metrics.k8s.io";
const apiQueryPath = "/apis/external.metrics.k8s.io/v1beta1";

if (mode === "--run") {
  runLiveWitness();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/run-keda-apiservice-gitops.mjs --run
  node scripts/run-keda-apiservice-gitops.mjs --verify`);
}

function runLiveWitness() {
  const startedAt = new Date();
  const suffix = Date.now().toString(36).slice(-6);
  const rig = `codex-keda-api-${suffix}`;
  const clusterSpace = `${rig}-cluster`;
  const workloadSpace = `${rig}-keda-apiservice`;
  const target = `${clusterSpace}/oci`;
  const kubeconfig = join(process.env.HOME, ".confighub", "clusters", `${rig}.kubeconfig`);
  const context = `kind-${rig}`;
  const workdir = join(tmpdir(), `helm-expt-keda-api-${suffix}`);
  const appName = "keda-apiservice";
  const appFile = join(tmpdir(), `helm-expt-keda-app-${suffix}.json`);
  const receipt = baseReceipt({ rig, clusterSpace, workloadSpace, target, kubeconfig, context, workdir, appName, startedAt });

  const record = (name, fn) => {
    console.log(`START ${name}`);
    try {
      const detail = fn();
      receipt.spec.checks.push({ name, result: "pass", detail: String(detail ?? "pass").slice(0, 4000) });
      console.log(`PASS ${name}: ${String(detail ?? "pass").slice(0, 240)}`);
      return true;
    } catch (error) {
      receipt.spec.checks.push({ name, result: "blocked", detail: errorText(error) });
      receipt.spec.result = "blocked";
      console.log(`BLOCKED ${name}: ${errorText(error).split("\n")[0]}`);
      return false;
    }
  };

  try {
    record("rig-up", () => {
      mustUncaptured("cub", ["cluster", "up", "--name", rig], 900);
      return `cub cluster ${rig} created`;
    });

    if (!lastCheckPassed(receipt, "rig-up")) return finish(receipt);

    record("render", () => {
      rmSync(workdir, { recursive: true, force: true });
      must("cub", ["installer", "setup", "--pull", join(repoRoot, packagePath), "--base", base, "--work-dir", workdir, "--non-interactive", "--namespace", namespace], 240);
      const manifestDir = join(workdir, "out", "manifests");
      const docs = loadManifestDir(manifestDir);
      const namespaces = [...new Set(docs.map((doc) => doc.metadata?.namespace).filter(Boolean))].sort();
      const allowed = new Set(["default", "kube-system"]);
      check(namespaces.every((item) => allowed.has(item)), `unexpected namespaces in KEDA render: ${namespaces.join(", ")}`);
      const apiServices = docs.filter((doc) => doc.kind === "APIService").map((doc) => doc.metadata?.name).filter(Boolean);
      check(apiServices.includes(apiServiceName), `rendered KEDA manifests missing APIService ${apiServiceName}`);
      receipt.spec.render = {
        manifestDirectory: `${workdir}/out/manifests`,
        durableRenderedObjectSet: renderedPath,
        namespaces,
        objectCount: docs.length,
        apiServices,
      };
      return `rendered ${docs.length} object(s); namespaces=${namespaces.join(",")}; apiServices=${apiServices.join(",")}`;
    });

    record("confighub-upload", () => {
      must("cub", ["installer", "upload", "--work-dir", workdir, "--space", workloadSpace, "--target", target], 420);
      return `uploaded KEDA units to ${workloadSpace}`;
    });

    record("confighub-apply-units", () => {
      const unitsText = must("cub", ["unit", "list", "--space", workloadSpace], 120);
      const units = unitsText
        .split("\n")
        .map((line) => line.trim().split(/\s+/)[0])
        .filter((unit) => unit && unit !== "NAME" && unit !== "installer-record");
      check(units.length > 0, `no workload units listed in ${workloadSpace}`);
      must("cub", ["unit", "apply", "--space", workloadSpace, "--unit", units.join(",")], 240);
      receipt.spec.confighub.workloadUnitsApplied = units.length;
      return `applied ${units.length} workload unit(s)`;
    });

    record("argo-application", () => {
      const app = {
        apiVersion: "argoproj.io/v1alpha1",
        kind: "Application",
        metadata: { name: appName, namespace: "argocd" },
        spec: {
          project: "default",
          source: {
            repoURL: `oci://oci.hub.confighub.com:443/target/${clusterSpace}/oci`,
            targetRevision: "latest",
            path: `./${workloadSpace}`,
          },
          destination: { server: "https://kubernetes.default.svc", namespace },
          syncPolicy: {
            automated: { selfHeal: true, prune: true },
            syncOptions: ["ServerSideApply=true", "CreateNamespace=true"],
          },
        },
      };
      writeFileSync(appFile, JSON.stringify(app, null, 2));
      runCommand("cub", ["unit", "create", "--space", clusterSpace, `${appName}-app`, appFile, "--target", target], 120);
      must("cub", ["unit", "apply", "--space", clusterSpace, "--unit", `${appName}-app`], 180);
      kubectl(kubeconfig, context, ["annotate", "application", clusterSpace, "-n", "argocd", "argocd.argoproj.io/refresh=hard", "--overwrite"], 60);
      return `created and applied Argo Application unit ${appName}-app`;
    });

    record("argo-sync", () => {
      const observed = waitForArgo(kubeconfig, context, appName, 600);
      receipt.spec.gitops.applications.push(observed);
      check(observed.sync === "Synced", `Argo sync=${observed.sync}`);
      check(observed.health === "Healthy", `Argo health=${observed.health}`);
      receipt.spec.oci = {
        repoURL: `oci://oci.hub.confighub.com:443/target/${clusterSpace}/oci`,
        path: `./${workloadSpace}`,
        targetRevision: "latest",
        revision: observed.revision,
      };
      return `app ${appName}: sync=${observed.sync} health=${observed.health} revision=${observed.revision}`;
    });

    record("runtime-workloads", () => {
      const deployments = JSON.parse(kubectl(kubeconfig, context, ["get", "deploy", "-n", namespace, "-o", "json"], 60));
      const items = deployments.items.map((item) => ({
        name: item.metadata.name,
        readyReplicas: item.status.readyReplicas ?? 0,
        replicas: item.status.replicas ?? 0,
        availableReplicas: item.status.availableReplicas ?? 0,
        image: item.spec.template.spec.containers.map((container) => container.image).join(","),
      })).sort((left, right) => left.name.localeCompare(right.name));
      check(items.length === 3, `expected 3 KEDA deployments, found ${items.length}`);
      for (const item of items) check(item.readyReplicas === item.replicas && item.replicas > 0, `${item.name} ready ${item.readyReplicas}/${item.replicas}`);
      receipt.spec.runtime.deployments = items;
      return items.map((item) => `${item.name} ${item.readyReplicas}/${item.replicas}`).join("; ");
    });

    record("apiservice-available", () => {
      const doc = JSON.parse(kubectl(kubeconfig, context, ["get", "apiservice", apiServiceName, "-o", "json"], 60));
      const condition = (doc.status?.conditions ?? []).find((item) => item.type === "Available") ?? {};
      const result = {
        name: apiServiceName,
        available: condition.status === "True",
        conditionStatus: condition.status ?? "",
        conditionReason: condition.reason ?? "",
        conditionMessage: condition.message ?? "",
      };
      check(result.available, `${apiServiceName} Available=${result.conditionStatus || "missing"} ${result.conditionReason}`);
      receipt.spec.runtime.apiService = result;
      return `${apiServiceName} Available=True`;
    });

    record("aggregated-api-query", () => {
      const query = kubectl(kubeconfig, context, ["get", "--raw", apiQueryPath], 60);
      const parsed = JSON.parse(query);
      check(parsed.kind === "APIResourceList", `unexpected aggregated API response kind ${parsed.kind}`);
      receipt.spec.runtime.aggregatedApiQuery = {
        path: apiQueryPath,
        result: "pass",
        kind: parsed.kind,
        groupVersion: parsed.groupVersion,
        resourceCount: (parsed.resources ?? []).length,
        responseSHA256: sha256(query),
      };
      return `${apiQueryPath} returned ${parsed.kind} with ${(parsed.resources ?? []).length} resource(s)`;
    });

    receipt.spec.result = receipt.spec.checks.every((item) => item.result === "pass") ? "pass" : "blocked";
  } finally {
    const teardown = runCommand("cub", ["cluster", "down", "--name", rig, "--force"], 600);
    receipt.spec.run.teardown = {
      result: teardown.status === 0 ? "pass" : "blocked",
      detail: `${teardown.stdout}\n${teardown.stderr}`.trim().slice(0, 4000),
    };
    const clusters = runCommand("kind", ["get", "clusters"], 60);
    receipt.spec.run.postTeardownKindClusters = clusters.stdout.trim();
    if (clusters.stdout.split("\n").filter(Boolean).includes(rig)) receipt.spec.result = "blocked";
    rmSync(workdir, { recursive: true, force: true });
  }

  finish(receipt);
}

function verify() {
  const full = join(repoRoot, receiptPath);
  check(existsSync(full), `${receiptPath} missing; run npm run keda:apiservice-gitops`);
  const receipt = readYaml(full);
  check(receipt.kind === "RuntimeGitOpsReceipt", `${receiptPath} kind mismatch`);
  check(receipt.spec?.chart === chart, `${receiptPath} chart mismatch`);
  check(receipt.spec?.version === version, `${receiptPath} version mismatch`);
  check(receipt.spec?.base === base, `${receiptPath} base mismatch`);
  check(receipt.spec?.result === "pass", `${receiptPath} must pass`);
  check(receipt.spec?.controller === "Argo CD OCI", `${receiptPath} controller mismatch`);
  check(receipt.spec?.runtime?.apiService?.available === true, `${receiptPath} APIService must be Available`);
  check(receipt.spec?.runtime?.aggregatedApiQuery?.result === "pass", `${receiptPath} aggregated API query must pass`);
  check((receipt.spec?.runtime?.deployments ?? []).length === 3, `${receiptPath} must record three KEDA deployments`);
  check((receipt.spec?.checks ?? []).some((item) => item.name === "aggregated-api-query" && item.result === "pass"), `${receiptPath} missing aggregated-api-query check`);
  check(receipt.spec?.run?.teardown?.result === "pass", `${receiptPath} teardown must pass`);
  console.log(`verified KEDA APIService GitOps receipt: ${receiptPath}`);
}

function finish(receipt) {
  writeYaml(join(repoRoot, receiptPath), receipt);
  console.log(`${receipt.spec.result.toUpperCase()} ${receiptPath}`);
}

function baseReceipt({ rig, clusterSpace, workloadSpace, target, kubeconfig, context, workdir, appName, startedAt }) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "RuntimeGitOpsReceipt",
    metadata: { name: `kedacore-keda-default-apiservice-argo-oci-${rig}` },
    spec: {
      chart,
      version,
      base,
      packagePath,
      recipePath,
      controller: "Argo CD OCI",
      observedAt: startedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
      result: "blocked",
      run: {
        mode: "cub-cluster-argo-oci-apiservice-witness",
        rig,
        clusterSpace,
        workloadSpace,
        target,
        namespace,
        kubeContext: context,
        kubeconfig,
        workdir,
        appName,
      },
      sourceEvidence: {
        renderedObjectSet: renderedPath,
        twoClusterKindParity: "runs/live-kind-parity/kedacore-keda-default/receipt.yaml",
      },
      render: {},
      oci: {},
      gitops: { applications: [] },
      runtime: {},
      confighub: { workloadSpace },
      checks: [],
      notClaimed: [
        "catalog production support for KEDA",
        "provider ScaledObject behavior beyond the aggregated external metrics API discovery endpoint",
        "non-vanilla Kubernetes distributions",
      ],
    },
  };
}

function loadManifestDir(dir) {
  const docs = [];
  for (const file of listYamlFiles(dir)) {
    docs.push(...parseDocs(readFileSync(file, "utf8")));
  }
  return docs;
}

function listYamlFiles(dir) {
  if (!existsSync(dir)) return [];
  const result = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of JSON.parse(must("python3", ["-c", `import json, os; print(json.dumps([{"name": x, "isdir": os.path.isdir(os.path.join(${JSON.stringify(current)}, x))} for x in os.listdir(${JSON.stringify(current)})]))`], 30))) {
      const full = join(current, entry.name);
      if (entry.isdir) stack.push(full);
      else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) result.push(full);
    }
  }
  return result.sort();
}

function waitForArgo(kubeconfig, context, appName, seconds) {
  const deadline = Date.now() + seconds * 1000;
  let latest = { name: appName, namespace: "argocd", sync: "", health: "", revision: "" };
  while (Date.now() < deadline) {
    const out = runCommand("kubectl", ["--kubeconfig", kubeconfig, "--context", context, "get", "application", appName, "-n", "argocd", "-o", "json"], 30);
    if (out.status === 0) {
      const app = JSON.parse(out.stdout);
      latest = {
        name: appName,
        namespace: "argocd",
        sync: app.status?.sync?.status ?? "",
        health: app.status?.health?.status ?? "",
        revision: app.status?.sync?.revision ?? "",
      };
      if (latest.sync === "Synced" && latest.health === "Healthy") return latest;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000);
  }
  return latest;
}

function kubectl(kubeconfig, context, args, timeout) {
  return must("kubectl", ["--kubeconfig", kubeconfig, "--context", context, ...args], timeout);
}

function must(cmd, args, timeout) {
  const result = runCommand(cmd, args, timeout);
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function mustUncaptured(cmd, args, timeout) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: timeout * 1000,
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    stdio: "inherit",
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.error?.message ?? `exit ${result.status ?? 1}`}`);
  }
}

function runCommand(cmd, args, timeout) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: timeout * 1000,
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    maxBuffer: 1024 * 1024 * 100,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
}

function lastCheckPassed(receipt, name) {
  return receipt.spec.checks.find((item) => item.name === name)?.result === "pass";
}

function errorText(error) {
  return String(error?.stack || error?.message || error).slice(0, 4000);
}
