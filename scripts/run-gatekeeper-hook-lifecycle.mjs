import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { check, cubEnv, readYaml, relativeRepo, repoRoot, sha256File, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const target = {
  chart: "gatekeeper/gatekeeper",
  version: "3.22.2",
  base: "default",
  namespace: "default",
  packagePath: "packages/gatekeeper/gatekeeper/3.22.2",
  recipePath: "recipes/gatekeeper/gatekeeper/3.22.2",
  inventoryPath: "recipes/gatekeeper/gatekeeper/3.22.2/revisions/default/r001/rendered/object-inventory.yaml",
  variantRevision: "recipes/gatekeeper/gatekeeper/3.22.2/revisions/default/r001/variant-revision.yaml",
  receiptPath: "runs/hook-lifecycle/gatekeeper-gatekeeper/default/latest/receipt.yaml",
};

if (mode === "--run") {
  runTarget();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/run-gatekeeper-hook-lifecycle.mjs --run
  node scripts/run-gatekeeper-hook-lifecycle.mjs --verify`);
}

function runTarget() {
  const runRoot = join(repoRoot, "runs", "hook-lifecycle", "gatekeeper-gatekeeper", "default", "latest");
  rmSync(runRoot, { recursive: true, force: true });
  mkdirSync(runRoot, { recursive: true });

  const runId = Date.now().toString(36).slice(-6);
  const cluster = `hx-hook-gatekeeper-${runId}`;
  const context = `kind-${cluster}`;
  const workDir = mkdtempSync(join(tmpdir(), "helm-expt-gatekeeper-hook-"));
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
        return evidence("cub-installer-setup.txt", "rendered Gatekeeper cub installer package output");
      });
    }

    if (clusterCreated) {
      record("kubectl-apply-separated-secrets", () => {
        const secretsDir = join(workDir, "out", "secrets");
        check(hasYamlFiles(secretsDir), `${secretsDir} has no YAML files`);
        const out = kubectl(context, ["apply", "-f", secretsDir], 120);
        write(join(runRoot, "kubectl-apply-secrets.txt"), out);
        return evidence("kubectl-apply-secrets.txt", "applied separated Gatekeeper Secret prerequisite");
      });
    }

    if (clusterCreated) {
      record("kubectl-apply-manifests", () => {
        const manifestsDir = join(workDir, "out", "manifests");
        check(hasYamlFiles(manifestsDir), `${manifestsDir} has no YAML files`);
        const out = kubectl(context, ["apply", "-f", manifestsDir], 240);
        write(join(runRoot, "kubectl-apply-manifests.txt"), out);
        return evidence("kubectl-apply-manifests.txt", "applied Gatekeeper cub installer manifests");
      });
    }

    if (clusterCreated) {
      record("crds-established", () => {
        const crds = gatekeeperCrds();
        check(crds.length === 17, `expected 17 Gatekeeper CRDs, found ${crds.length}`);
        const lines = [];
        for (const crd of crds) {
          const out = kubectl(context, ["wait", "--for=condition=Established", `crd/${crd}`, "--timeout=180s"], 210);
          lines.push(out.trim());
        }
        write(join(runRoot, "crds-established.txt"), `${lines.join("\n")}\n`);
        return { ...evidence("crds-established.txt", "all rendered Gatekeeper CRDs reached Established"), crdCount: crds.length };
      });
    }

    if (clusterCreated) {
      record("controller-manager-ready", () => {
        const out = kubectl(context, ["-n", target.namespace, "rollout", "status", "deployment/gatekeeper-controller-manager", "--timeout=300s"], 330);
        write(join(runRoot, "deployment-gatekeeper-controller-manager-rollout.txt"), out);
        return evidence("deployment-gatekeeper-controller-manager-rollout.txt", "Gatekeeper controller manager rolled out");
      });
    }

    if (clusterCreated) {
      record("audit-ready", () => {
        const out = kubectl(context, ["-n", target.namespace, "rollout", "status", "deployment/gatekeeper-audit", "--timeout=300s"], 330);
        write(join(runRoot, "deployment-gatekeeper-audit-rollout.txt"), out);
        return evidence("deployment-gatekeeper-audit-rollout.txt", "Gatekeeper audit deployment rolled out");
      });
    }

    if (clusterCreated) {
      record("webhook-service-endpoints", () => {
        const out = kubectl(context, ["-n", target.namespace, "get", "endpoints", "gatekeeper-webhook-service", "-o", "yaml"], 60);
        check(/addresses:/m.test(out), "gatekeeper-webhook-service has no endpoint addresses");
        write(join(runRoot, "service-gatekeeper-webhook-endpoints.yaml"), out);
        return evidence("service-gatekeeper-webhook-endpoints.yaml", "Gatekeeper webhook Service has ready endpoints");
      });
    }

    if (clusterCreated) {
      record("webhook-secret-populated", () => {
        const secret = waitForJson(context, ["-n", target.namespace, "get", "secret", "gatekeeper-webhook-server-cert", "-o", "json"], (json) => {
          const data = json.data ?? {};
          return Boolean(data["tls.crt"] && data["tls.key"]);
        }, 180_000);
        writeJson(join(runRoot, "secret-gatekeeper-webhook-server-cert.json"), redactSecret(secret));
        return evidence("secret-gatekeeper-webhook-server-cert.json", "Gatekeeper controller populated webhook TLS Secret keys");
      });
    }

    if (clusterCreated) {
      record("webhook-configurations-routed", () => {
        const names = ["gatekeeper-mutating-webhook-configuration", "gatekeeper-validating-webhook-configuration"];
        const observed = {};
        for (const name of names) {
          const config = waitForJson(context, ["get", webhookKind(name), name, "-o", "json"], (json) => {
            const webhooks = json.webhooks ?? [];
            return webhooks.length > 0 && webhooks.every((webhook) => Boolean(webhook.clientConfig?.service?.name && webhook.clientConfig?.caBundle));
          }, 180_000);
          observed[name] = summarizeWebhookConfiguration(config);
        }
        writeJson(join(runRoot, "webhook-configurations.json"), observed);
        return evidence("webhook-configurations.json", "Gatekeeper webhook configurations point at the rendered Service and contain CA bundles");
      });
    }

    if (clusterCreated) {
      record("admission-server-dry-run", () => {
        const out = waitForKubectl(context, ["create", "namespace", "gatekeeper-lifecycle-check", "--dry-run=server", "-o", "yaml"], 180_000);
        write(join(runRoot, "admission-server-dry-run.yaml"), out);
        return evidence("admission-server-dry-run.yaml", "server-side dry-run exercised the live admission path");
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
    metadata: { name: "gatekeeper-gatekeeper-default-install-lifecycle" },
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
        hookTypes: ["pre-install", "pre-upgrade"],
        route: "preflight-or-presync-install-observation",
        claim: "The fresh-install route observes the separated Secret prerequisite, CRD establishment, controller readiness, webhook service readiness, controller-populated TLS material, and server-side admission dry-run. It does not claim Gatekeeper upgrade-hook behavior.",
      },
      run: {
        mode: "single-kind-cluster-cub-installer-install-lifecycle-observation",
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
  check(existsSync(path), `${target.receiptPath} is missing; run npm run lifecycle:gatekeeper-hooks`);
  const receipt = readYaml(path);
  check(receipt.kind === "HookLifecycleObservationReceipt", "Gatekeeper hook lifecycle receipt kind mismatch");
  check(receipt.spec?.chart === target.chart, "Gatekeeper hook lifecycle chart mismatch");
  check(receipt.spec?.version === target.version, "Gatekeeper hook lifecycle version mismatch");
  check(receipt.spec?.base === target.base, "Gatekeeper hook lifecycle base mismatch");
  check(receipt.spec?.result === "pass", "Gatekeeper hook lifecycle did not pass");
  check(receipt.spec?.lifecycleModel?.route === "preflight-or-presync-install-observation", "Gatekeeper hook lifecycle route mismatch");
  check(receipt.spec?.run?.cleanup?.result === "pass", "Gatekeeper hook lifecycle cleanup did not pass");
  const checks = receipt.spec?.checks ?? [];
  for (const name of [
    "cub-installer-setup",
        "kubectl-apply-separated-secrets",
        "kubectl-apply-manifests",
    "crds-established",
    "controller-manager-ready",
    "audit-ready",
    "webhook-service-endpoints",
    "webhook-secret-populated",
    "webhook-configurations-routed",
    "admission-server-dry-run",
  ]) {
    const item = checks.find((checkItem) => checkItem.name === name);
    check(Boolean(item), `Gatekeeper hook lifecycle missing check ${name}`);
    check(item.result === "pass", `Gatekeeper hook lifecycle check ${name} did not pass`);
    if (item.evidencePath) verifyEvidence(item);
  }
  const crdCheck = checks.find((item) => item.name === "crds-established");
  check(crdCheck?.crdCount === 17, "Gatekeeper hook lifecycle did not observe 17 CRDs");
  console.log("verified Gatekeeper hook lifecycle observation");
}

function verifyEvidence(item) {
  const path = join(repoRoot, "runs", "hook-lifecycle", "gatekeeper-gatekeeper", "default", "latest", item.evidencePath);
  check(existsSync(path), `missing evidence ${relativeRepo(path)}`);
  check(sha256File(path) === item.evidenceSHA256, `evidence SHA mismatch for ${relativeRepo(path)}`);
}

function evidence(path, detail) {
  const fullPath = join(repoRoot, "runs", "hook-lifecycle", "gatekeeper-gatekeeper", "default", "latest", path);
  return {
    detail,
    evidencePath: path,
    evidenceSHA256: sha256File(fullPath),
  };
}

function gatekeeperCrds() {
  const inventory = readYaml(join(repoRoot, target.inventoryPath));
  return (inventory.spec?.objects ?? [])
    .filter((object) => object.kind === "CustomResourceDefinition")
    .map((object) => object.name)
    .sort();
}

function webhookKind(name) {
  return name.includes("mutating") ? "mutatingwebhookconfiguration" : "validatingwebhookconfiguration";
}

function redactSecret(secret) {
  const data = secret.data ?? {};
  return {
    apiVersion: secret.apiVersion,
    kind: secret.kind,
    metadata: {
      name: secret.metadata?.name,
      namespace: secret.metadata?.namespace,
      creationTimestamp: secret.metadata?.creationTimestamp,
    },
    type: secret.type,
    dataKeys: Object.keys(data).sort(),
    hasTlsCrt: Boolean(data["tls.crt"]),
    hasTlsKey: Boolean(data["tls.key"]),
    redacted: true,
  };
}

function summarizeWebhookConfiguration(config) {
  return {
    apiVersion: config.apiVersion,
    kind: config.kind,
    metadata: {
      name: config.metadata?.name,
      creationTimestamp: config.metadata?.creationTimestamp,
      generation: config.metadata?.generation,
    },
    webhooks: (config.webhooks ?? []).map((webhook) => ({
      name: webhook.name,
      failurePolicy: webhook.failurePolicy,
      service: {
        name: webhook.clientConfig?.service?.name,
        namespace: webhook.clientConfig?.service?.namespace,
        path: webhook.clientConfig?.service?.path,
        port: webhook.clientConfig?.service?.port,
      },
      hasCaBundle: Boolean(webhook.clientConfig?.caBundle),
    })),
    redacted: true,
  };
}

function waitForJson(context, args, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    const result = run("kubectl", ["--context", context, ...args], { timeout: 20 });
    if (result.status === 0) {
      try {
        const json = JSON.parse(result.stdout);
        if (predicate(json)) return json;
        last = result.stdout;
      } catch (error) {
        last = errorText(error);
      }
    } else {
      last = result.stderr || result.stdout;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  throw new Error(`condition did not become true for kubectl ${args.join(" ")}: ${last.slice(0, 1000)}`);
}

function waitForKubectl(context, args, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    const result = run("kubectl", ["--context", context, ...args], { timeout: 30 });
    if (result.status === 0) return result.stdout;
    last = result.stderr || result.stdout;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  }
  throw new Error(`condition did not become true for kubectl ${args.join(" ")}: ${last.slice(0, 1000)}`);
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function errorText(error) {
  return String(error?.stack || error?.message || error).slice(0, 4000);
}
