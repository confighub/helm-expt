import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { check, cubEnv, readYaml, relativeRepo, repoRoot, sha256File, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const target = {
  chart: "fluent/fluent-bit",
  version: "0.57.6",
  base: "default",
  namespace: "default",
  packagePath: "packages/fluent/fluent-bit/0.57.6",
  recipePath: "recipes/fluent/fluent-bit/0.57.6",
  variantRevision: "recipes/fluent/fluent-bit/0.57.6/revisions/default/r001/variant-revision.yaml",
  receiptPath: "runs/hook-lifecycle/fluent-fluent-bit/default/latest/receipt.yaml",
};

if (mode === "--run") {
  runTarget();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/run-fluent-bit-hook-lifecycle.mjs --run
  node scripts/run-fluent-bit-hook-lifecycle.mjs --verify`);
}

function runTarget() {
  const runRoot = join(repoRoot, "runs", "hook-lifecycle", "fluent-fluent-bit", "default", "latest");
  rmSync(runRoot, { recursive: true, force: true });
  mkdirSync(runRoot, { recursive: true });

  const runId = Date.now().toString(36).slice(-6);
  const cluster = `hx-hook-fluent-bit-${runId}`;
  const context = `kind-${cluster}`;
  const workDir = mkdtempSync(join(tmpdir(), "helm-expt-fluent-bit-hook-"));
  const receipt = baseReceipt(cluster);
  const checks = receipt.spec.checks;
  let clusterCreated = false;

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
      record("cub-installer-setup", () => {
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
        return evidence("cub-installer-setup.txt", "rendered cub installer package output");
      });
    }

    if (clusterCreated) {
      record("kubectl-apply", () => {
        const manifestsDir = join(workDir, "out", "manifests");
        check(hasYamlFiles(manifestsDir), `${manifestsDir} has no YAML files`);
        const out = kubectl(context, ["apply", "-f", manifestsDir], 180);
        write(join(runRoot, "kubectl-apply.txt"), out);
        return evidence("kubectl-apply.txt", "applied cub installer manifests");
      });
    }

    if (clusterCreated) {
      record("daemonset-ready", () => {
        const out = kubectl(context, ["-n", target.namespace, "rollout", "status", "daemonset/fluent-bit", "--timeout=240s"], 270);
        write(join(runRoot, "daemonset-fluent-bit-rollout.txt"), out);
        return evidence("daemonset-fluent-bit-rollout.txt", "fluent-bit DaemonSet rolled out");
      });
    }

    if (clusterCreated) {
      record("service-endpoints", () => {
        const out = kubectl(context, ["-n", target.namespace, "get", "endpoints", "fluent-bit", "-o", "yaml"], 60);
        check(/addresses:/m.test(out), "fluent-bit Service has no endpoint addresses");
        write(join(runRoot, "service-fluent-bit-endpoints.yaml"), out);
        return evidence("service-fluent-bit-endpoints.yaml", "fluent-bit Service has ready endpoints");
      });
    }

    if (clusterCreated) {
      record("explicit-post-install-health-check", () => {
        const port = 12020 + Math.floor(Math.random() * 1000);
        const stdoutPath = join(runRoot, "port-forward.stdout.txt");
        const stderrPath = join(runRoot, "port-forward.stderr.txt");
        const child = spawn(
          "kubectl",
          ["--context", context, "-n", target.namespace, "port-forward", "svc/fluent-bit", `${port}:2020`],
          { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        try {
          const health = waitForHttp(`http://127.0.0.1:${port}/api/v2/health`);
          write(join(runRoot, "fluent-bit-health.json"), health);
          return {
            ...evidence("fluent-bit-health.json", "fluent-bit health endpoint returned ok"),
            health: JSON.parse(health),
          };
        } finally {
          child.kill("SIGTERM");
          writeFileSync(stdoutPath, stdout);
          writeFileSync(stderrPath, stderr);
        }
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
    metadata: { name: "fluent-fluent-bit-default-test-hook-lifecycle" },
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
        hookTypes: ["test"],
        route: "explicit-post-install-check",
        claim: "The Helm test hook is treated as an explicit post-install health check against the installed Service.",
      },
      run: {
        mode: "single-kind-cluster-cub-installer-hook-observation",
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
  check(existsSync(path), `${target.receiptPath} is missing; run npm run lifecycle:fluent-bit-test-hook`);
  const receipt = readYaml(path);
  check(receipt.kind === "HookLifecycleObservationReceipt", "Fluent Bit hook lifecycle receipt kind mismatch");
  check(receipt.spec?.chart === target.chart, "Fluent Bit hook lifecycle chart mismatch");
  check(receipt.spec?.version === target.version, "Fluent Bit hook lifecycle version mismatch");
  check(receipt.spec?.base === target.base, "Fluent Bit hook lifecycle base mismatch");
  check(receipt.spec?.result === "pass", "Fluent Bit hook lifecycle did not pass");
  check(receipt.spec?.lifecycleModel?.route === "explicit-post-install-check", "Fluent Bit hook lifecycle route mismatch");
  check(receipt.spec?.run?.cleanup?.result === "pass", "Fluent Bit hook lifecycle cleanup did not pass");
  const checks = receipt.spec?.checks ?? [];
  for (const name of ["cub-installer-setup", "kubectl-apply", "daemonset-ready", "service-endpoints", "explicit-post-install-health-check"]) {
    const item = checks.find((checkItem) => checkItem.name === name);
    check(Boolean(item), `Fluent Bit hook lifecycle missing check ${name}`);
    check(item.result === "pass", `Fluent Bit hook lifecycle check ${name} did not pass`);
    if (item.evidencePath) verifyEvidence(item);
  }
  const health = checks.find((item) => item.name === "explicit-post-install-health-check")?.health;
  check(health?.status === "ok", "Fluent Bit health endpoint did not return status ok");
  console.log("verified Fluent Bit hook lifecycle observation");
}

function verifyEvidence(item) {
  const path = join(repoRoot, "runs", "hook-lifecycle", "fluent-fluent-bit", "default", "latest", item.evidencePath);
  check(existsSync(path), `missing evidence ${relativeRepo(path)}`);
  check(sha256File(path) === item.evidenceSHA256, `evidence SHA mismatch for ${relativeRepo(path)}`);
}

function evidence(path, detail) {
  const fullPath = join(repoRoot, "runs", "hook-lifecycle", "fluent-fluent-bit", "default", "latest", path);
  return {
    detail,
    evidencePath: path,
    evidenceSHA256: sha256File(fullPath),
  };
}

function waitForHttp(url, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    const result = run("curl", ["-fsS", url], { timeout: 5 });
    if (result.status === 0) return result.stdout;
    lastError = result.stderr || result.stdout;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error(`health endpoint did not become ready: ${lastError}`);
}

function hasYamlFiles(path) {
  return existsSync(path) && readdirSync(path).some((name) => name.endsWith(".yaml") || name.endsWith(".yml"));
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
