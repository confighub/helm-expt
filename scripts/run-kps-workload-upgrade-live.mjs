#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, sha256File, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const keep = process.argv.includes("--keep");

const chart = "prometheus-community/kube-prometheus-stack";
const helmChart = "kube-prometheus-stack";
const repositoryURL = "https://prometheus-community.github.io/helm-charts";
const release = "kube-prometheus-stack";
const fromVersion = "85.3.3";
const toVersion = "86.1.0";
const base = "default";
const namespace = "monitoring";
const runRoot = join(repoRoot, "runs", "serious-chart-reviews", "kube-prometheus-stack", "workload-upgrade-live", "latest");
const receiptPath = join(runRoot, "receipt.yaml");

if (mode === "--run") {
  runLive();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/run-kps-workload-upgrade-live.mjs --run [--keep]
  node scripts/run-kps-workload-upgrade-live.mjs --verify

This is a bounded live workload-upgrade rehearsal. It installs
kube-prometheus-stack ${fromVersion} into a fresh kind cluster with the
committed default values, waits for workloads to become Ready, upgrades the
same Helm release to ${toVersion}, waits again, records evidence, and deletes
the cluster.

It proves the regular Helm chart upgrade path for the recorded values and kind
profile. It does not prove ConfigHub upgrade orchestration, private overlays,
stored object migration beyond the exercised default objects, or production
support for other target scopes.`);
}

function runLive() {
  rmSync(runRoot, { recursive: true, force: true });
  mkdirSync(runRoot, { recursive: true });

  const cluster = `helm-expt-kps-workload-upgrade-${Date.now().toString(36).slice(-6)}`;
  const context = `kind-${cluster}`;
  const receipt = baseReceipt(cluster);
  const checks = receipt.spec.checks;
  let clusterCreated = false;

  const record = (name, fn) => {
    try {
      const detail = fn();
      checks.push({ name, result: "pass", ...detail });
    } catch (error) {
      checks.push({ name, result: "blocked", detail: error.message });
      throw error;
    }
  };

  try {
    record("helm-values-input", () => {
      const values = readYaml(join(repoRoot, "recipes", "prometheus-community", "kube-prometheus-stack", fromVersion, "effective-values.yaml"));
      check(values.kind === "EffectiveValues", "from-version effective-values artifact kind mismatch");
      writeYaml(join(runRoot, "values.yaml"), values.spec?.values ?? {});
      return {
        path: "values.yaml",
        source: `recipes/prometheus-community/kube-prometheus-stack/${fromVersion}/effective-values.yaml`,
        sourceSHA256: sha256File(join(repoRoot, "recipes", "prometheus-community", "kube-prometheus-stack", fromVersion, "effective-values.yaml")),
        ...evidence("values.yaml", "plain Helm values extracted from the committed EffectiveValues artifact"),
      };
    });

    record("kind-create", () => {
      const out = run("kind", ["create", "cluster", "--name", cluster, "--wait", "300s"], 720);
      clusterCreated = true;
      writeTextEvidence("kind-create.txt", `${out.stdout}${out.stderr}`);
      return evidence("kind-create.txt", "fresh kind cluster created for kube-prometheus-stack workload upgrade rehearsal");
    });

    record("namespace-create", () => {
      const out = kubectl(context, ["create", "namespace", namespace], 60);
      writeTextEvidence("namespace-create.txt", out);
      return evidence("namespace-create.txt", `created ${namespace} namespace`);
    });

    record("helm-install-from-version", () => {
      const out = runHelm([
        "upgrade",
        "--install",
        release,
        helmChart,
        "--repo",
        repositoryURL,
        "--version",
        fromVersion,
        "--namespace",
        namespace,
        "--values",
        join(runRoot, "values.yaml"),
        "--wait",
        "--timeout",
        "20m",
      ], 1500);
      writeTextEvidence("helm-install-85.3.3.txt", out);
      return evidence("helm-install-85.3.3.txt", `${fromVersion} Helm install completed with --wait`);
    });

    record("workloads-ready-after-install", () => {
      const pods = kubectl(context, ["-n", namespace, "get", "pods", "-o", "wide"], 120);
      writeTextEvidence("pods-after-install.txt", pods);
      const wait = kubectl(context, ["-n", namespace, "wait", "--for=condition=Ready", "pod", "--all", "--timeout=600s"], 660);
      writeTextEvidence("pods-ready-after-install.txt", wait);
      const workloads = workloadSnapshot(context, "workloads-after-install.txt");
      return {
        podCount: podCount(pods),
        workloadCount: workloads.count,
        evidence: [
          evidence("pods-after-install.txt", `${fromVersion} pods listed after install`),
          evidence("pods-ready-after-install.txt", `${fromVersion} pods reached Ready`),
          evidence("workloads-after-install.txt", `${fromVersion} workload snapshot after install`),
        ],
      };
    });

    record("helm-upgrade-to-version", () => {
      const out = runHelm([
        "upgrade",
        release,
        helmChart,
        "--repo",
        repositoryURL,
        "--version",
        toVersion,
        "--namespace",
        namespace,
        "--values",
        join(runRoot, "values.yaml"),
        "--wait",
        "--timeout",
        "20m",
      ], 1500);
      writeTextEvidence("helm-upgrade-86.1.0.txt", out);
      return evidence("helm-upgrade-86.1.0.txt", `${toVersion} Helm upgrade completed with --wait`);
    });

    record("workloads-ready-after-upgrade", () => {
      const pods = kubectl(context, ["-n", namespace, "get", "pods", "-o", "wide"], 120);
      writeTextEvidence("pods-after-upgrade.txt", pods);
      const wait = kubectl(context, ["-n", namespace, "wait", "--for=condition=Ready", "pod", "--all", "--timeout=600s"], 660);
      writeTextEvidence("pods-ready-after-upgrade.txt", wait);
      const workloads = workloadSnapshot(context, "workloads-after-upgrade.txt");
      return {
        podCount: podCount(pods),
        workloadCount: workloads.count,
        evidence: [
          evidence("pods-after-upgrade.txt", `${toVersion} pods listed after upgrade`),
          evidence("pods-ready-after-upgrade.txt", `${toVersion} pods reached Ready`),
          evidence("workloads-after-upgrade.txt", `${toVersion} workload snapshot after upgrade`),
        ],
      };
    });

    record("helm-history", () => {
      const out = runHelm(["history", release, "--namespace", namespace], 120);
      writeTextEvidence("helm-history.txt", out);
      return evidence("helm-history.txt", "Helm release history recorded after upgrade");
    });

    record("crds-after-upgrade", () => {
      const out = kubectl(context, ["get", "crd", "-o", "name"], 120);
      const monitoringCrds = out
        .split("\n")
        .filter((line) => line.includes("monitoring.coreos.com"))
        .sort()
        .join("\n");
      writeTextEvidence("monitoring-crds-after-upgrade.txt", monitoringCrds);
      return {
        monitoringCrdCount: monitoringCrds ? monitoringCrds.split("\n").length : 0,
        ...evidence("monitoring-crds-after-upgrade.txt", "monitoring.coreos.com CRDs present after workload upgrade"),
      };
    });
  } finally {
    if (clusterCreated && !keep) {
      const cleanup = run("kind", ["delete", "cluster", "--name", cluster], 300, false);
      writeTextEvidence("kind-delete.txt", `${cleanup.stdout}${cleanup.stderr}`);
      receipt.spec.run.cleanup = {
        result: cleanup.status === 0 ? "pass" : "blocked",
        detail: cleanup.status === 0 ? "deleted kind cluster" : `${cleanup.stdout}${cleanup.stderr}`.trim(),
        evidencePath: "kind-delete.txt",
        evidenceSHA256: sha256File(join(runRoot, "kind-delete.txt")),
      };
    } else if (clusterCreated) {
      receipt.spec.run.cleanup = { result: "kept", detail: `kept kind cluster ${cluster}` };
    }
    receipt.spec.result = checks.every((item) => item.result === "pass") && ["pass", "kept"].includes(receipt.spec.run.cleanup.result) ? "pass" : "blocked";
    writeYaml(receiptPath, receipt);
    console.log(`wrote ${relativeRepo(receiptPath)} result=${receipt.spec.result}`);
  }
}

function baseReceipt(cluster) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubePrometheusStackWorkloadLiveUpgradeReceipt",
    metadata: {
      name: `kps-workload-live-upgrade-${fromVersion}-to-${toVersion}`,
    },
    spec: {
      chart,
      base,
      fromVersion,
      toVersion,
      result: "blocked",
      observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      run: {
        mode: "single-kind-cluster-regular-helm-workload-upgrade-rehearsal",
        cluster,
        namespace,
        cleanup: { result: "not-run" },
      },
      basis: {
        crdLiveUpgradeReceipt: "runs/serious-chart-reviews/kube-prometheus-stack/crd-upgrade-live/latest/receipt.yaml",
        fromValues: `recipes/prometheus-community/kube-prometheus-stack/${fromVersion}/effective-values.yaml`,
        fromRender: `recipes/prometheus-community/kube-prometheus-stack/${fromVersion}/revisions/${base}/r001/rendered/release-objects.yaml`,
        toRender: `recipes/prometheus-community/kube-prometheus-stack/${toVersion}/revisions/${base}/r001/rendered/release-objects.yaml`,
      },
      claim:
        "Regular Helm can install kube-prometheus-stack 85.3.3 with the committed default values, converge the workloads, upgrade the same release to 86.1.0, and converge the workloads again on the tested kind profile.",
      notClaimed: [
        "ConfigHub upgrade orchestration",
        "private overlays or other values profiles",
        "production support for other target scopes",
        "stored-object migration beyond the default workload objects exercised by this run",
        "long-running soak, rollback, or certificate rotation behavior",
      ],
      checks: [],
    },
  };
}

function verify() {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run node scripts/run-kps-workload-upgrade-live.mjs --run`);
  const receipt = readYaml(receiptPath);
  check(receipt.kind === "KubePrometheusStackWorkloadLiveUpgradeReceipt", "KPS workload upgrade receipt kind mismatch");
  check(receipt.spec?.chart === chart, "KPS workload upgrade receipt chart mismatch");
  check(receipt.spec?.fromVersion === fromVersion, "KPS workload upgrade receipt fromVersion mismatch");
  check(receipt.spec?.toVersion === toVersion, "KPS workload upgrade receipt toVersion mismatch");
  check(receipt.spec?.base === base, "KPS workload upgrade receipt base mismatch");
  check(receipt.spec?.result === "pass", "KPS workload upgrade receipt did not pass");
  check(receipt.spec?.run?.cleanup?.result === "pass", "KPS workload upgrade cluster cleanup did not pass");
  for (const name of [
    "helm-values-input",
    "kind-create",
    "namespace-create",
    "helm-install-from-version",
    "workloads-ready-after-install",
    "helm-upgrade-to-version",
    "workloads-ready-after-upgrade",
    "helm-history",
    "crds-after-upgrade",
  ]) {
    const item = receipt.spec.checks.find((checkItem) => checkItem.name === name);
    check(Boolean(item), `KPS workload upgrade receipt missing check ${name}`);
    check(item.result === "pass", `KPS workload upgrade check ${name} did not pass`);
    verifyEvidence(item);
  }
  const installReady = receipt.spec.checks.find((item) => item.name === "workloads-ready-after-install");
  const upgradeReady = receipt.spec.checks.find((item) => item.name === "workloads-ready-after-upgrade");
  check(installReady?.podCount >= 6, "KPS install pod count too low");
  check(upgradeReady?.podCount >= 6, "KPS upgrade pod count too low");
  check(upgradeReady?.workloadCount >= 5, "KPS upgrade workload count too low");
  check(receipt.spec.checks.find((item) => item.name === "crds-after-upgrade")?.monitoringCrdCount === 10, "KPS monitoring CRD count mismatch after upgrade");
  console.log("verified KPS workload live upgrade receipt");
}

function verifyEvidence(item) {
  for (const evidenceItem of evidenceItems(item)) {
    const fullPath = join(runRoot, evidenceItem.evidencePath);
    check(existsSync(fullPath), `missing evidence ${relativeRepo(fullPath)}`);
    check(sha256File(fullPath) === evidenceItem.evidenceSHA256, `evidence SHA mismatch for ${relativeRepo(fullPath)}`);
  }
}

function evidenceItems(item) {
  if (Array.isArray(item.evidence)) return item.evidence;
  if (item.evidencePath) return [item];
  return [];
}

function workloadSnapshot(context, fileName) {
  const out = kubectl(context, ["-n", namespace, "get", "deploy,sts,ds", "-o", "wide"], 120);
  write(join(runRoot, fileName), out);
  const count = out
    .split("\n")
    .filter((line) => line && !line.startsWith("NAME"))
    .length;
  return { count };
}

function podCount(podsOutput) {
  return podsOutput
    .split("\n")
    .filter((line) => line && !line.startsWith("NAME"))
    .length;
}

function writeTextEvidence(fileName, text) {
  const normalized = `${String(text)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n*$/, "")}\n`;
  write(join(runRoot, fileName), normalized);
}

function evidence(path, detail) {
  const fullPath = join(runRoot, path);
  return {
    detail,
    evidencePath: path,
    evidenceSHA256: sha256File(fullPath),
  };
}

function kubectl(context, args, timeoutSeconds) {
  const result = run("kubectl", ["--context", context, ...args], timeoutSeconds);
  return `${result.stdout}${result.stderr}`;
}

function runHelm(args, timeoutSeconds) {
  const result = run("helm", args, timeoutSeconds);
  return `${result.stdout}${result.stderr}`;
}

function run(cmd, args, timeoutSeconds, fail = true) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
    timeout: timeoutSeconds * 1000,
  });
  if (fail && result.status !== 0) throw new Error(`${result.stdout}${result.stderr}`.trim());
  return result;
}
