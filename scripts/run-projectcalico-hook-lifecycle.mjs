import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { check, cubEnv, readYaml, relativeRepo, repoRoot, sha256File, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const target = {
  chart: "projectcalico/tigera-operator",
  version: "v3.32.0",
  base: "default",
  namespace: "default",
  packagePath: "packages/projectcalico/tigera-operator/v3.32.0",
  recipePath: "recipes/projectcalico/tigera-operator/v3.32.0",
  variantRevision: "recipes/projectcalico/tigera-operator/v3.32.0/revisions/default/r001/variant-revision.yaml",
  receiptPath: "runs/hook-lifecycle/projectcalico-tigera-operator/default/latest/receipt.yaml",
};

if (mode === "--run") {
  runTarget();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/run-projectcalico-hook-lifecycle.mjs --run
  node scripts/run-projectcalico-hook-lifecycle.mjs --verify`);
}

function runTarget() {
  const runRoot = join(repoRoot, "runs", "hook-lifecycle", "projectcalico-tigera-operator", "default", "latest");
  rmSync(runRoot, { recursive: true, force: true });
  mkdirSync(runRoot, { recursive: true });

  const runId = Date.now().toString(36).slice(-6);
  const cluster = `hx-hook-calico-${runId}`;
  const context = `kind-${cluster}`;
  const workDir = mkdtempSync(join(tmpdir(), "helm-expt-projectcalico-hook-"));
  const receipt = baseReceipt(cluster);
  const checks = receipt.spec.checks;
  let clusterCreated = false;
  let setupReady = false;
  let operatorReady = false;
  let crdsReady = false;
  let customResourcesReady = false;

  const record = (name, fn) => {
    try {
      const detail = fn();
      checks.push({ name, result: "pass", ...detail });
      return true;
    } catch (error) {
      checks.push({ name, result: "blocked", detail: errorText(error) });
      return false;
    }
  };

  try {
    record("kind-create", () => {
      must("kind", ["create", "cluster", "--name", cluster, "--wait", "180s"], { timeout: 300 });
      clusterCreated = true;
      return { detail: "created fresh kind cluster" };
    });

    if (clusterCreated) {
      setupReady = record("cub-installer-setup", () => {
        const out = must(
          "cub",
          [
            "installer",
            "setup",
            "--pull",
            join(repoRoot, target.packagePath),
            "--base",
            target.base,
            "--work-dir",
            workDir,
            "--non-interactive",
            "--namespace",
            target.namespace,
          ],
          { timeout: 240, env: cubEnv() },
        );
        write(join(runRoot, "cub-installer-setup.txt"), out);
        return evidence("cub-installer-setup.txt", "rendered Project Calico cub installer package output");
      });
    }

    if (setupReady) {
      record("kubectl-apply-operator-prerequisites", () => {
        const files = manifestFiles(join(workDir, "out", "manifests")).filter((file) => !isOperatorCustomResource(file));
        check(files.length === 7, `expected 7 operator prerequisite manifests, found ${files.length}`);
        const out = kubectl(context, ["apply", ...files.flatMap((file) => ["-f", file])], 180);
        write(join(runRoot, "kubectl-apply-operator-prerequisites.txt"), out);
        return { ...evidence("kubectl-apply-operator-prerequisites.txt", "applied operator namespace, RBAC, ServiceAccount, and Deployment"), objectCount: files.length };
      });
    }

    if (setupReady) {
      operatorReady = record("operator-deployment-ready", () => {
        const out = kubectl(context, ["-n", target.namespace, "rollout", "status", "deployment/tigera-operator", "--timeout=420s"], 450);
        write(join(runRoot, "deployment-tigera-operator-rollout.txt"), out);
        return evidence("deployment-tigera-operator-rollout.txt", "tigera-operator Deployment rolled out");
      });
    }

    if (operatorReady) {
      crdsReady = record("operator-crds-established", () => {
        const lines = waitForOperatorCrds(context, 360_000);
        write(join(runRoot, "operator-crds-established.txt"), `${lines.join("\n")}\n`);
        return { ...evidence("operator-crds-established.txt", "operator-managed CRDs required by the rendered custom resources reached Established"), crdCount: operatorCrds().length };
      });
    }

    if (crdsReady) {
      customResourcesReady = record("kubectl-apply-custom-resources", () => {
        const files = manifestFiles(join(workDir, "out", "manifests")).filter(isOperatorCustomResource);
        check(files.length === 4, `expected 4 operator custom resource manifests, found ${files.length}`);
        const out = kubectl(context, ["apply", ...files.flatMap((file) => ["-f", file])], 180);
        write(join(runRoot, "kubectl-apply-custom-resources.txt"), out);
        return { ...evidence("kubectl-apply-custom-resources.txt", "applied APIServer, Goldmane, Installation, and Whisker after the operator CRDs existed"), objectCount: files.length };
      });
    }

    if (customResourcesReady) {
      record("custom-resources-accepted", () => {
        const out = kubectl(context, ["get", "apiservers.operator.tigera.io,goldmanes.operator.tigera.io,installations.operator.tigera.io,whiskers.operator.tigera.io", "-o", "yaml"], 60);
        write(join(runRoot, "custom-resources-accepted.yaml"), out);
        return evidence("custom-resources-accepted.yaml", "rendered operator custom resources were accepted by the live API server");
      });
    }

    if (customResourcesReady) {
      record("render-pre-delete-hook-job", () => {
        const out = must(
          "helm",
          [
            "template",
            "tigera-operator",
            "projectcalico/tigera-operator",
            "--version",
            target.version,
            "--namespace",
            target.namespace,
            "--show-only",
            "templates/tigera-operator/00-uninstall.yaml",
          ],
          { timeout: 180 },
        );
        check(out.includes("helm.sh/hook: pre-delete"), "rendered hook Job is missing pre-delete annotation");
        check(out.includes("args: [\"-pre-delete\"]"), "rendered hook Job is missing -pre-delete argument");
        write(join(runRoot, "pre-delete-hook-job.yaml"), out);
        return evidence("pre-delete-hook-job.yaml", "rendered upstream Helm pre-delete hook Job for explicit lifecycle execution");
      });
    }

    if (customResourcesReady) {
      record("execute-pre-delete-cleanup-job", () => {
        const hookJobPath = join(runRoot, "pre-delete-hook-job.yaml");
        const applyOut = kubectl(context, ["apply", "-f", hookJobPath], 120);
        const waitOut = kubectl(context, ["-n", target.namespace, "wait", "--for=condition=complete", "job/tigera-operator-uninstall", "--timeout=420s"], 450);
        const logsOut = kubectl(context, ["-n", target.namespace, "logs", "job/tigera-operator-uninstall"], 180);
        write(join(runRoot, "pre-delete-hook-job-apply.txt"), applyOut);
        write(join(runRoot, "pre-delete-hook-job-complete.txt"), waitOut);
        write(join(runRoot, "pre-delete-hook-job-logs.txt"), logsOut);
        return evidence("pre-delete-hook-job-complete.txt", "explicit pre-delete cleanup Job completed");
      });
    }

    if (customResourcesReady) {
      record("custom-resources-after-cleanup-job", () => {
        const out = kubectl(context, ["get", "apiservers.operator.tigera.io,goldmanes.operator.tigera.io,installations.operator.tigera.io,whiskers.operator.tigera.io", "-o", "yaml", "--ignore-not-found"], 60);
        write(join(runRoot, "custom-resources-after-cleanup-job.yaml"), out);
        return evidence("custom-resources-after-cleanup-job.yaml", "captured remaining operator custom resources after the pre-delete cleanup Job");
      });
    }

    if (setupReady) {
      record("delete-rendered-objects", () => {
        const files = manifestFiles(join(workDir, "out", "manifests")).filter((file) => !file.endsWith("/namespace-default.yaml"));
        const out = kubectl(context, ["delete", ...files.flatMap((file) => ["-f", file]), "--ignore-not-found", "--wait=false"], 180);
        write(join(runRoot, "kubectl-delete-rendered-objects.txt"), out);
        return evidence("kubectl-delete-rendered-objects.txt", "deleted rendered package objects after explicit cleanup action");
      });
    }
  } finally {
    if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
    if (clusterCreated) {
      const cleanup = run("kind", ["delete", "cluster", "--name", cluster], { timeout: 300 });
      receipt.spec.run.cleanup = {
        result: cleanup.status === 0 ? "pass" : "blocked",
        detail: cleanup.status === 0 ? "deleted kind cluster" : `${cleanup.stdout}\n${cleanup.stderr}`.trim(),
      };
    }
    receipt.spec.result = checks.every((item) => item.result === "pass") && receipt.spec.run.cleanup.result === "pass" ? "pass" : "blocked";
    writeYaml(join(repoRoot, target.receiptPath), receipt);
    console.log(`wrote ${target.receiptPath} result=${receipt.spec.result}`);
  }
}

function baseReceipt(cluster) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HookLifecycleObservationReceipt",
    metadata: { name: "projectcalico-tigera-operator-default-delete-lifecycle" },
    spec: {
      chart: target.chart,
      version: target.version,
      base: target.base,
      result: "blocked",
      observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      package: { path: target.packagePath },
      recipe: { path: target.recipePath },
      variantRevision: target.variantRevision,
      lifecycleModel: {
        hookTypes: ["pre-delete"],
        route: "explicit-delete-cleanup-action",
        claim: "The Helm pre-delete hook is treated as an explicit delete cleanup action. The run observes operator bootstrap, operator-managed CRD establishment, rendered custom resource acceptance, execution of the upstream pre-delete cleanup Job, and package object deletion in a fresh kind target. This does not claim production uninstall safety for every target state.",
      },
      run: {
        mode: "single-kind-cluster-cub-installer-projectcalico-delete-lifecycle-observation",
        cluster,
        namespace: target.namespace,
        cleanup: { result: "not-run" },
      },
      checks: [],
    },
  };
}

function verify() {
  const path = join(repoRoot, target.receiptPath);
  check(existsSync(path), `${target.receiptPath} is missing; run npm run lifecycle:projectcalico-hooks`);
  const receipt = readYaml(path);
  check(receipt.kind === "HookLifecycleObservationReceipt", "Project Calico hook lifecycle receipt kind mismatch");
  check(receipt.spec?.chart === target.chart, "Project Calico hook lifecycle chart mismatch");
  check(receipt.spec?.version === target.version, "Project Calico hook lifecycle version mismatch");
  check(receipt.spec?.base === target.base, "Project Calico hook lifecycle base mismatch");
  check(receipt.spec?.result === "pass", "Project Calico hook lifecycle did not pass");
  check(receipt.spec?.lifecycleModel?.route === "explicit-delete-cleanup-action", "Project Calico hook lifecycle route mismatch");
  check(receipt.spec?.run?.cleanup?.result === "pass", "Project Calico hook lifecycle cleanup did not pass");
  const checks = receipt.spec?.checks ?? [];
  for (const name of [
    "cub-installer-setup",
    "kubectl-apply-operator-prerequisites",
    "operator-deployment-ready",
    "operator-crds-established",
    "kubectl-apply-custom-resources",
    "custom-resources-accepted",
    "render-pre-delete-hook-job",
    "execute-pre-delete-cleanup-job",
    "custom-resources-after-cleanup-job",
    "delete-rendered-objects",
  ]) {
    const item = checks.find((checkItem) => checkItem.name === name);
    check(Boolean(item), `Project Calico hook lifecycle missing check ${name}`);
    check(item.result === "pass", `Project Calico hook lifecycle check ${name} did not pass`);
    if (item.evidencePath) verifyEvidence(item);
  }
  const crdCheck = checks.find((item) => item.name === "operator-crds-established");
  check(crdCheck?.crdCount === 4, "Project Calico hook lifecycle did not observe 4 operator CRDs");
  const hookRenderCheck = checks.find((item) => item.name === "render-pre-delete-hook-job");
  check(Boolean(hookRenderCheck?.evidencePath), "Project Calico hook render evidence missing");
  console.log("verified Project Calico hook lifecycle observation");
}

function verifyEvidence(item) {
  const path = join(repoRoot, "runs", "hook-lifecycle", "projectcalico-tigera-operator", "default", "latest", item.evidencePath);
  check(existsSync(path), `missing evidence ${relativeRepo(path)}`);
  check(sha256File(path) === item.evidenceSHA256, `evidence SHA mismatch for ${relativeRepo(path)}`);
}

function evidence(path, detail) {
  const fullPath = join(repoRoot, "runs", "hook-lifecycle", "projectcalico-tigera-operator", "default", "latest", path);
  return {
    detail,
    evidencePath: path,
    evidenceSHA256: sha256File(fullPath),
  };
}

function operatorCrds() {
  return [
    "apiservers.operator.tigera.io",
    "goldmanes.operator.tigera.io",
    "installations.operator.tigera.io",
    "whiskers.operator.tigera.io",
  ];
}

function waitForOperatorCrds(context, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const remaining = new Set(operatorCrds());
  const lines = [];
  let last = "";
  while (Date.now() < deadline && remaining.size > 0) {
    for (const crd of [...remaining]) {
      const get = run("kubectl", ["--context", context, "get", `crd/${crd}`, "-o", "name"], { timeout: 20 });
      if (get.status !== 0) {
        last = get.stderr || get.stdout;
        continue;
      }
      const wait = run("kubectl", ["--context", context, "wait", "--for=condition=Established", `crd/${crd}`, "--timeout=30s"], { timeout: 45 });
      if (wait.status === 0) {
        lines.push(wait.stdout.trim());
        remaining.delete(crd);
      } else {
        last = wait.stderr || wait.stdout;
      }
    }
    if (remaining.size > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  }
  if (remaining.size > 0) {
    throw new Error(`operator CRDs did not become established: ${[...remaining].join(", ")}; last=${last.slice(0, 1000)}`);
  }
  return lines.sort();
}

function isOperatorCustomResource(path) {
  return [
    "apiserver-default.yaml",
    "goldmane-default.yaml",
    "installation-default.yaml",
    "whisker-default.yaml",
  ].some((name) => path.endsWith(`/${name}`));
}

function hasYamlFiles(path) {
  return existsSync(path) && readdirSync(path).some((name) => name.endsWith(".yaml") || name.endsWith(".yml"));
}

function manifestFiles(path) {
  check(hasYamlFiles(path), `${path} has no YAML files`);
  return readdirSync(path)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort()
    .map((name) => join(path, name));
}

function kubectl(context, args, timeout = 120) {
  return must("kubectl", ["--context", context, ...args], { timeout });
}

function must(cmd, args, options = {}) {
  const result = run(cmd, args, options);
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`.trim());
  return result.stdout;
}

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    timeout: (options.timeout ?? 120) * 1000,
    maxBuffer: 1024 * 1024 * 100,
  });
}

function errorText(error) {
  return String(error?.stack || error?.message || error).slice(0, 4000);
}
