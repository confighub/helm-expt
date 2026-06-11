#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, parseDocs, relativeRepo, repoRoot, sha256File, toYaml, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const keep = process.argv.includes("--keep");

const chart = "prometheus-community/kube-prometheus-stack";
const fromVersion = "85.3.3";
const toVersion = "86.1.0";
const base = "default";
const namespace = "monitoring";
const runRoot = join(repoRoot, "runs", "serious-chart-reviews", "kube-prometheus-stack", "crd-upgrade-live", "latest");
const receiptPath = join(runRoot, "receipt.yaml");

if (mode === "--run") {
  runLive();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/run-kps-crd-upgrade-live.mjs --run [--keep]
  node scripts/run-kps-crd-upgrade-live.mjs --verify

This is a bounded live CRD upgrade rehearsal. It applies the committed
kube-prometheus-stack ${fromVersion} CRDs to a fresh kind cluster, applies the
committed ${toVersion} CRDs over them, waits for Established, and runs a
server-side dry-run against the upgraded monitoring API.

It does not install the kube-prometheus-stack workloads and does not claim
stored-object migration, controller compatibility, or a full Helm release
upgrade.`);
}

function runLive() {
  rmSync(runRoot, { recursive: true, force: true });
  mkdirSync(runRoot, { recursive: true });

  const cluster = `helm-expt-kps-crd-upgrade-${Date.now().toString(36).slice(-6)}`;
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
    record("rendered-crd-inputs", () => {
      const fromCrds = crdsFor(fromVersion);
      const toCrds = crdsFor(toVersion);
      check(fromCrds.length === 10, `expected 10 ${fromVersion} CRDs, found ${fromCrds.length}`);
      check(toCrds.length === 10, `expected 10 ${toVersion} CRDs, found ${toCrds.length}`);
      writeCrds("from-crds.yaml", fromCrds);
      writeCrds("to-crds.yaml", toCrds);
      return {
        fromCrdCount: fromCrds.length,
        toCrdCount: toCrds.length,
        inputs: [
          {
            path: renderPath(fromVersion),
            sha256: sha256File(join(repoRoot, renderPath(fromVersion))),
            detail: `${fromVersion} committed render containing source CRDs`,
          },
          {
            path: renderPath(toVersion),
            sha256: sha256File(join(repoRoot, renderPath(toVersion))),
            detail: `${toVersion} committed render containing target CRDs`,
          },
        ],
      };
    });

    record("kind-create", () => {
      const out = run("kind", ["create", "cluster", "--name", cluster, "--wait", "300s"], 720);
      clusterCreated = true;
      writeTextEvidence("kind-create.txt", out.stdout || out.stderr || "created\n");
      return evidence("kind-create.txt", "fresh kind cluster created for CRD upgrade rehearsal");
    });

    record("namespace-create", () => {
      const out = kubectl(context, ["create", "namespace", namespace], 60);
      writeTextEvidence("namespace-create.txt", out);
      return evidence("namespace-create.txt", `created ${namespace} namespace for server-side CR dry-run`);
    });

    record("apply-from-crds", () => {
      const out = kubectl(context, ["apply", "--server-side", "--force-conflicts", "-f", join(runRoot, "from-crds.yaml")], 420);
      writeTextEvidence("apply-from-crds.txt", out);
      return evidence("apply-from-crds.txt", `${fromVersion} CRDs applied with server-side apply`);
    });

    record("from-crds-established", () => {
      const out = waitAllCrdsEstablished(context, crdNamesFor(fromVersion));
      writeTextEvidence("from-crds-established.txt", out);
      return { ...evidence("from-crds-established.txt", `${fromVersion} CRDs reached Established`), crdCount: 10 };
    });

    record("server-dry-run-before-upgrade", () => {
      const out = kubectlInput(context, ["apply", "--dry-run=server", "-f", "-"], serviceMonitorSmokeYaml(), 60);
      writeTextEvidence("server-dry-run-before-upgrade.yaml", out);
      return evidence("server-dry-run-before-upgrade.yaml", "monitoring.coreos.com ServiceMonitor accepted before CRD upgrade");
    });

    record("crd-upgrade-diff", () => {
      const diff = run("kubectl", ["--context", context, "diff", "--server-side", "-f", join(runRoot, "to-crds.yaml")], 180, false);
      check([0, 1].includes(diff.status), `kubectl diff returned ${diff.status}`);
      writeTextEvidence("crd-upgrade-diff.txt", `${diff.stdout}${diff.stderr}`);
      return {
        diffExitCode: diff.status,
        ...evidence("crd-upgrade-diff.txt", `${toVersion} CRD server-side diff recorded before apply`),
      };
    });

    record("apply-to-crds", () => {
      const out = kubectl(context, ["apply", "--server-side", "--force-conflicts", "-f", join(runRoot, "to-crds.yaml")], 420);
      writeTextEvidence("apply-to-crds.txt", out);
      return evidence("apply-to-crds.txt", `${toVersion} CRDs applied over ${fromVersion} CRDs`);
    });

    record("to-crds-established", () => {
      const out = waitAllCrdsEstablished(context, crdNamesFor(toVersion));
      writeTextEvidence("to-crds-established.txt", out);
      return { ...evidence("to-crds-established.txt", `${toVersion} CRDs remained Established after upgrade apply`), crdCount: 10 };
    });

    record("server-dry-run-after-upgrade", () => {
      const out = kubectlInput(context, ["apply", "--dry-run=server", "-f", "-"], serviceMonitorSmokeYaml(), 60);
      writeTextEvidence("server-dry-run-after-upgrade.yaml", out);
      return evidence("server-dry-run-after-upgrade.yaml", "monitoring.coreos.com ServiceMonitor accepted after CRD upgrade");
    });
  } finally {
    if (clusterCreated && !keep) {
      const cleanup = run("kind", ["delete", "cluster", "--name", cluster], 300, false);
      receipt.spec.run.cleanup = {
        result: cleanup.status === 0 ? "pass" : "blocked",
        detail: cleanup.status === 0 ? "deleted kind cluster" : `${cleanup.stdout}${cleanup.stderr}`.trim(),
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
    kind: "KubePrometheusStackCrdLiveUpgradeReceipt",
    metadata: {
      name: `kps-crd-live-upgrade-${fromVersion}-to-${toVersion}`,
    },
    spec: {
      chart,
      base,
      fromVersion,
      toVersion,
      result: "blocked",
      observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      run: {
        mode: "single-kind-cluster-crd-upgrade-rehearsal",
        cluster,
        namespace,
        cleanup: { result: "not-run" },
      },
      basis: {
        deltaReceipt: `data/serious-chart-reviews/kps-crd-upgrade-delta-${fromVersion}-to-${toVersion}.yaml`,
        fromRender: renderPath(fromVersion),
        toRender: renderPath(toVersion),
      },
      claim:
        "The committed kube-prometheus-stack CRD desired-state upgrade can be applied to a fresh Kubernetes API server and the upgraded monitoring API accepts a server-side dry-run object.",
      notClaimed: [
        "full kube-prometheus-stack workload upgrade",
        "Prometheus Operator controller compatibility after upgrade",
        "stored-object migration or conversion behavior",
        "upgrade behavior for other values, bases, clusters, or private overlays",
      ],
      checks: [],
    },
  };
}

function verify() {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run node scripts/run-kps-crd-upgrade-live.mjs --run`);
  const receipt = JSON.parse(JSON.stringify(awaitableReadYaml(receiptPath)));
  check(receipt.kind === "KubePrometheusStackCrdLiveUpgradeReceipt", "KPS CRD upgrade receipt kind mismatch");
  check(receipt.spec?.chart === chart, "KPS CRD upgrade receipt chart mismatch");
  check(receipt.spec?.fromVersion === fromVersion, "KPS CRD upgrade receipt fromVersion mismatch");
  check(receipt.spec?.toVersion === toVersion, "KPS CRD upgrade receipt toVersion mismatch");
  check(receipt.spec?.base === base, "KPS CRD upgrade receipt base mismatch");
  check(receipt.spec?.result === "pass", "KPS CRD upgrade receipt did not pass");
  check(receipt.spec?.run?.cleanup?.result === "pass", "KPS CRD upgrade cluster cleanup did not pass");
  const inputCheck = receipt.spec.checks.find((item) => item.name === "rendered-crd-inputs");
  check(inputCheck?.fromCrdCount === 10, "from-version rendered input CRD count mismatch");
  check(inputCheck?.toCrdCount === 10, "to-version rendered input CRD count mismatch");
  for (const input of inputCheck.inputs ?? []) {
    const inputPath = join(repoRoot, input.path);
    check(existsSync(inputPath), `missing KPS CRD upgrade input ${input.path}`);
    check(sha256File(inputPath) === input.sha256, `KPS CRD upgrade input SHA mismatch for ${input.path}`);
  }
  for (const name of [
    "rendered-crd-inputs",
    "kind-create",
    "namespace-create",
    "apply-from-crds",
    "from-crds-established",
    "server-dry-run-before-upgrade",
    "crd-upgrade-diff",
    "apply-to-crds",
    "to-crds-established",
    "server-dry-run-after-upgrade",
  ]) {
    const item = receipt.spec.checks.find((checkItem) => checkItem.name === name);
    check(Boolean(item), `KPS CRD upgrade receipt missing check ${name}`);
    check(item.result === "pass", `KPS CRD upgrade check ${name} did not pass`);
    verifyEvidence(item);
  }
  check(receipt.spec.checks.find((item) => item.name === "from-crds-established")?.crdCount === 10, "from-version CRD count mismatch");
  check(receipt.spec.checks.find((item) => item.name === "to-crds-established")?.crdCount === 10, "to-version CRD count mismatch");
  console.log("verified KPS CRD live upgrade receipt");
}

function awaitableReadYaml(path) {
  return JSON.parse(run("python3", ["-c", `import json,sys,yaml; print(json.dumps(yaml.safe_load(open(${JSON.stringify(path)})), sort_keys=True))`], 60).stdout);
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

function crdsFor(version) {
  return parseDocs(readFileSync(join(repoRoot, renderPath(version)), "utf8")).filter((doc) => doc.kind === "CustomResourceDefinition");
}

function crdNamesFor(version) {
  return crdsFor(version).map((doc) => doc.metadata.name).sort();
}

function renderPath(version) {
  return `recipes/prometheus-community/kube-prometheus-stack/${version}/revisions/${base}/r001/rendered/release-objects.yaml`;
}

function writeCrds(fileName, crds) {
  write(join(runRoot, fileName), `${crds.map((doc) => toYaml(doc)).join("\n---\n")}\n`);
}

function writeTextEvidence(fileName, text) {
  const normalized = `${String(text)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n*$/, "")}\n`;
  write(join(runRoot, fileName), normalized);
}

function waitAllCrdsEstablished(context, names) {
  return `${names.map((name) => kubectl(context, ["wait", "--for=condition=Established", `crd/${name}`, "--timeout=180s"], 210).trim()).join("\n")}\n`;
}

function serviceMonitorSmokeYaml() {
  return `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kps-crd-upgrade-smoke
  namespace: ${namespace}
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kps-crd-upgrade-smoke
  endpoints:
    - port: http
`;
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
  return result.stdout;
}

function kubectlInput(context, args, input, timeoutSeconds) {
  const result = spawnSync("kubectl", ["--context", context, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    input,
    maxBuffer: 1024 * 1024 * 200,
    timeout: timeoutSeconds * 1000,
  });
  if (result.status !== 0) throw new Error(`${result.stdout}${result.stderr}`.trim());
  return result.stdout;
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
