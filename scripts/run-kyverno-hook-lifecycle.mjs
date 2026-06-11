import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { check, cubEnv, readYaml, relativeRepo, repoRoot, sha256File, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const target = {
  chart: "kyverno/kyverno",
  version: "3.8.1",
  base: "default",
  namespace: "default",
  packagePath: "packages/kyverno/kyverno/3.8.1",
  recipePath: "recipes/kyverno/kyverno/3.8.1",
  inventoryPath: "recipes/kyverno/kyverno/3.8.1/revisions/default/r001/rendered/object-inventory.yaml",
  variantRevision: "recipes/kyverno/kyverno/3.8.1/revisions/default/r001/variant-revision.yaml",
  receiptPath: "runs/hook-lifecycle/kyverno-kyverno/default/latest/receipt.yaml",
};

const helmChart = {
  name: "kyverno",
  repo: "https://kyverno.github.io/kyverno/",
  release: "kyverno",
};

if (mode === "--run") {
  runTarget();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/run-kyverno-hook-lifecycle.mjs --run
  node scripts/run-kyverno-hook-lifecycle.mjs --verify`);
}

function runTarget() {
  const runRoot = join(repoRoot, "runs", "hook-lifecycle", "kyverno-kyverno", "default", "latest");
  rmSync(runRoot, { recursive: true, force: true });
  mkdirSync(runRoot, { recursive: true });

  const runId = Date.now().toString(36).slice(-6);
  const cluster = `hx-hook-kyverno-${runId}`;
  const context = `kind-${cluster}`;
  const workDir = mkdtempSync(join(tmpdir(), "helm-expt-kyverno-hook-"));
  const receipt = baseReceipt(cluster);
  const checks = receipt.spec.checks;
  let clusterCreated = false;
  let setupReady = false;
  let crdsReady = false;
  let manifestsReady = false;

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
          { timeout: 300, env: cubEnv() },
        );
        write(join(runRoot, "cub-installer-setup.txt"), out);
        return evidence("cub-installer-setup.txt", "rendered Kyverno cub installer package output");
      });
    }

    if (setupReady) {
      const crdsApplied = record("kubectl-apply-crds", () => {
        const manifestsDir = join(workDir, "out", "manifests");
        const crdFiles = manifestFiles(manifestsDir).filter((file) => file.includes("/customresourcedefinition-"));
        check(crdFiles.length === 22, `expected 22 Kyverno CRDs, found ${crdFiles.length}`);
        for (const crdFile of crdFiles) check(existsSync(crdFile), `${crdFile} is missing`);
        const out = kubectl(context, ["apply", "--server-side", ...crdFiles.flatMap((crdFile) => ["-f", crdFile])], 420);
        write(join(runRoot, "kubectl-apply-crds.txt"), out);
        return { ...evidence("kubectl-apply-crds.txt", "applied Kyverno CRDs before controllers using server-side apply"), crdCount: crdFiles.length };
      });

      crdsReady = crdsApplied && record("crds-established", () => {
        const crds = kyvernoCrds();
        check(crds.length === 22, `expected 22 Kyverno CRDs, found ${crds.length}`);
        const lines = [];
        for (const crd of crds) {
          const out = kubectl(context, ["wait", "--for=condition=Established", `crd/${crd}`, "--timeout=240s"], 270);
          lines.push(out.trim());
        }
        write(join(runRoot, "crds-established.txt"), `${lines.join("\n")}\n`);
        return { ...evidence("crds-established.txt", "all rendered Kyverno CRDs reached Established"), crdCount: crds.length };
      });
    }

    if (crdsReady) {
      manifestsReady = record("kubectl-apply-manifests", () => {
        const manifestsDir = join(workDir, "out", "manifests");
        const files = manifestFiles(manifestsDir).filter((file) => !file.includes("/customresourcedefinition-"));
        check(files.length > 0, `${manifestsDir} has no non-CRD YAML files`);
        const out = kubectl(context, ["apply", ...files.flatMap((file) => ["-f", file])], 420);
        write(join(runRoot, "kubectl-apply-manifests.txt"), out);
        return { ...evidence("kubectl-apply-manifests.txt", "applied Kyverno non-CRD manifest set after CRDs were established"), objectCount: files.length };
      });
    }

    if (manifestsReady) {
      for (const deployment of kyvernoDeployments()) {
        record(`deployment-ready:${deployment}`, () => {
          const out = kubectl(context, ["-n", target.namespace, "rollout", "status", `deployment/${deployment}`, "--timeout=420s"], 450);
          const file = `deployment-${deployment}-rollout.txt`;
          write(join(runRoot, file), out);
          return evidence(file, `${deployment} rolled out`);
        });
      }
    }

    if (manifestsReady) {
      record("admission-service-endpoints", () => {
        const out = kubectl(context, ["-n", target.namespace, "get", "endpoints", "kyverno-svc", "-o", "yaml"], 60);
        check(/addresses:/m.test(out), "kyverno-svc has no endpoint addresses");
        write(join(runRoot, "service-kyverno-svc-endpoints.yaml"), out);
        return evidence("service-kyverno-svc-endpoints.yaml", "Kyverno admission Service has ready endpoints");
      });
    }

    if (manifestsReady) {
      record("webhook-configurations-routed", () => {
        const observed = waitForWebhookConfigurations(context, 240_000);
        writeJson(join(runRoot, "webhook-configurations.json"), observed);
        return {
          ...evidence("webhook-configurations.json", "Kyverno webhook configurations point at Services and contain CA bundles"),
          webhookConfigurationCount: observed.length,
        };
      });
    }

    if (manifestsReady) {
      record("explicit-post-install-policy-check", () => {
        const policyPath = join(runRoot, "clusterpolicy-dry-run-input.yaml");
        write(policyPath, kyvernoClusterPolicy());
        const out = waitForPolicyServerDryRun(context, policyPath, 240_000);
        write(join(runRoot, "clusterpolicy-server-dry-run.yaml"), out);
        return evidence("clusterpolicy-server-dry-run.yaml", "server-side dry-run exercised Kyverno policy admission");
      });
    }

    if (manifestsReady) {
      record("post-upgrade-migration-hook-action", () => {
        const hookFile = renderHookManifest(runRoot, "hook-post-upgrade-migrate-resources.yaml", [
          "templates/hooks/post-upgrade-migrate-resources.yaml",
        ]);
        deleteJobs(context, ["kyverno-migrate-resources"]);
        const applyOut = kubectl(context, ["apply", "-f", hookFile], 240);
        write(join(runRoot, "post-upgrade-migration-hook-apply.txt"), applyOut);
        const waitOut = waitForJob(context, "kyverno-migrate-resources", "post-upgrade-migration-hook");
        return {
          detail: "rendered and executed Kyverno post-upgrade migration hook as an explicit lifecycle action",
          hookManifest: evidence("hook-post-upgrade-migrate-resources.yaml", "rendered upstream Kyverno post-upgrade migration hook"),
          applyEvidence: evidence("post-upgrade-migration-hook-apply.txt", "applied post-upgrade migration hook resources"),
          waitEvidence: waitOut,
        };
      });
    }

    if (manifestsReady) {
      record("pre-delete-scale-to-zero-policy-action", () => {
        const hookFile = renderHookManifest(runRoot, "hook-pre-delete-scale-to-zero.yaml", [
          "templates/hooks/pre-delete-scale-to-zero.yaml",
        ]);
        const scaleOut = kubectl(context, ["-n", target.namespace, "scale", "deployment", ...kyvernoDeployments(), "--replicas=0"], 180);
        write(join(runRoot, "pre-delete-scale-to-zero-policy.txt"), scaleOut);
        const scaled = observedDeploymentReplicas(context);
        writeJson(join(runRoot, "pre-delete-scaled-deployments.json"), scaled);
        check(scaled.every((deployment) => deployment.replicas === 0), "Kyverno pre-delete scale hook did not scale every controller Deployment to zero");
        return {
          detail: "rendered Kyverno pre-delete scale-to-zero hook and executed the equivalent explicit delete-cleanup policy action",
          hookManifest: evidence("hook-pre-delete-scale-to-zero.yaml", "rendered upstream Kyverno pre-delete scale-to-zero hook"),
          actionEvidence: evidence("pre-delete-scale-to-zero-policy.txt", "scaled Kyverno controller Deployments to zero as an explicit lifecycle policy"),
          scaledDeployments: scaled.length,
          scaledEvidence: evidence("pre-delete-scaled-deployments.json", "all Kyverno controller Deployments observed at zero replicas after pre-delete scale action"),
        };
      });
    }

    if (manifestsReady) {
      record("pre-delete-remove-webhooks-policy-action", () => {
        const hookFile = renderHookManifest(runRoot, "hook-pre-delete-remove-webhooks.yaml", [
          "templates/hooks/pre-delete-remove-webhooks.yaml",
        ]);
        const before = kyvernoWebhookConfigurations(context);
        writeJson(join(runRoot, "pre-delete-webhook-configurations-before-cleanup.json"), before);
        const deleteOut = deleteWebhookConfigurations(context, before);
        write(join(runRoot, "pre-delete-remove-webhooks-policy.txt"), deleteOut);
        const after = kyvernoWebhookConfigurations(context);
        writeJson(join(runRoot, "pre-delete-webhook-configurations-after-cleanup.json"), after);
        check(after.length === 0, `expected Kyverno webhook configurations to be removed, found ${after.map((item) => item.name).join(", ")}`);
        return {
          detail: "rendered Kyverno pre-delete remove-webhooks hook and executed the equivalent explicit delete-cleanup policy action",
          hookManifest: evidence("hook-pre-delete-remove-webhooks.yaml", "rendered upstream Kyverno pre-delete remove-webhooks hook"),
          beforeCleanupEvidence: evidence("pre-delete-webhook-configurations-before-cleanup.json", "Kyverno webhook configurations observed before explicit cleanup"),
          actionEvidence: evidence("pre-delete-remove-webhooks-policy.txt", "deleted Kyverno webhook configurations as an explicit lifecycle policy"),
          remainingWebhookConfigurations: after.length,
          cleanupEvidence: evidence("pre-delete-webhook-configurations-after-cleanup.json", "Kyverno webhook configurations removed after pre-delete cleanup action"),
        };
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
    metadata: { name: "kyverno-kyverno-default-install-and-test-lifecycle" },
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
        hookTypes: ["post-upgrade", "pre-delete", "test"],
        route: "explicit-lifecycle-actions-and-post-install-checks",
        claim: "The Helm test route is observed as explicit post-install checks. The post-upgrade migration hook is rendered from the upstream chart and executed as an explicit lifecycle action. The pre-delete cleanup hooks are rendered from the upstream chart and mapped to equivalent explicit delete-cleanup policy actions with committed evidence. This proves the pinned Kyverno 3.8.1 default-base lifecycle route in a fresh kind target; it does not claim cross-version Kyverno upgrade support or production uninstall policy.",
      },
      run: {
        mode: "single-kind-cluster-cub-installer-kyverno-hook-observation",
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
  check(existsSync(path), `${target.receiptPath} is missing; run npm run lifecycle:kyverno-hooks`);
  const receipt = readYaml(path);
  check(receipt.kind === "HookLifecycleObservationReceipt", "Kyverno hook lifecycle receipt kind mismatch");
  check(receipt.spec?.chart === target.chart, "Kyverno hook lifecycle chart mismatch");
  check(receipt.spec?.version === target.version, "Kyverno hook lifecycle version mismatch");
  check(receipt.spec?.base === target.base, "Kyverno hook lifecycle base mismatch");
  check(receipt.spec?.result === "pass", "Kyverno hook lifecycle did not pass");
  check(receipt.spec?.lifecycleModel?.route === "explicit-lifecycle-actions-and-post-install-checks", "Kyverno hook lifecycle route mismatch");
  check(receipt.spec?.run?.cleanup?.result === "pass", "Kyverno hook lifecycle cleanup did not pass");
  const checks = receipt.spec?.checks ?? [];
  const required = [
    "cub-installer-setup",
    "kubectl-apply-crds",
    "crds-established",
    "kubectl-apply-manifests",
    "deployment-ready:kyverno-admission-controller",
    "deployment-ready:kyverno-background-controller",
    "deployment-ready:kyverno-cleanup-controller",
    "deployment-ready:kyverno-reports-controller",
    "admission-service-endpoints",
    "webhook-configurations-routed",
    "explicit-post-install-policy-check",
    "post-upgrade-migration-hook-action",
    "pre-delete-scale-to-zero-policy-action",
    "pre-delete-remove-webhooks-policy-action",
  ];
  for (const name of required) {
    const item = checks.find((checkItem) => checkItem.name === name);
    check(Boolean(item), `Kyverno hook lifecycle missing check ${name}`);
    check(item.result === "pass", `Kyverno hook lifecycle check ${name} did not pass`);
    if (item.evidencePath) verifyEvidence(item);
  }
  const crdCheck = checks.find((item) => item.name === "crds-established");
  check(crdCheck?.crdCount === 22, "Kyverno hook lifecycle did not observe 22 CRDs");
  const webhookCheck = checks.find((item) => item.name === "webhook-configurations-routed");
  check(Number(webhookCheck?.webhookConfigurationCount ?? 0) >= 2, "Kyverno hook lifecycle did not observe webhook configurations");
  const scaleCheck = checks.find((item) => item.name === "pre-delete-scale-to-zero-policy-action");
  check(Number(scaleCheck?.scaledDeployments ?? 0) === kyvernoDeployments().length, "Kyverno pre-delete scale action did not observe all Deployments");
  const cleanupCheck = checks.find((item) => item.name === "pre-delete-remove-webhooks-policy-action");
  check(Number(cleanupCheck?.remainingWebhookConfigurations ?? -1) === 0, "Kyverno pre-delete cleanup did not remove webhook configurations");
  console.log("verified Kyverno hook lifecycle observation");
}

function verifyEvidence(item) {
  const path = join(repoRoot, "runs", "hook-lifecycle", "kyverno-kyverno", "default", "latest", item.evidencePath);
  check(existsSync(path), `missing evidence ${relativeRepo(path)}`);
  check(sha256File(path) === item.evidenceSHA256, `evidence SHA mismatch for ${relativeRepo(path)}`);
}

function evidence(path, detail) {
  const fullPath = join(repoRoot, "runs", "hook-lifecycle", "kyverno-kyverno", "default", "latest", path);
  return {
    detail,
    evidencePath: path,
    evidenceSHA256: sha256File(fullPath),
  };
}

function kyvernoCrds() {
  const inventory = readYaml(join(repoRoot, target.inventoryPath));
  return (inventory.spec?.objects ?? [])
    .filter((object) => object.kind === "CustomResourceDefinition")
    .map((object) => object.name)
    .sort();
}

function kyvernoDeployments() {
  return [
    "kyverno-admission-controller",
    "kyverno-background-controller",
    "kyverno-cleanup-controller",
    "kyverno-reports-controller",
  ];
}

function renderHookManifest(runRoot, fileName, showOnlyTemplates) {
  const out = must(
    "helm",
    [
      "template",
      helmChart.release,
      helmChart.name,
      "--repo",
      helmChart.repo,
      "--version",
      target.version,
      "--namespace",
      target.namespace,
      ...showOnlyTemplates.flatMap((templatePath) => ["--show-only", templatePath]),
    ],
    { timeout: 180 },
  );
  const path = join(runRoot, fileName);
  write(path, cleanCapturedYaml(out));
  return path;
}

function cleanCapturedYaml(text) {
  return `${text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n*$/, "")}\n`;
}

function deleteJobs(context, names) {
  const out = kubectl(context, ["-n", target.namespace, "delete", "job", ...names, "--ignore-not-found=true"], 120);
  return out;
}

function waitForJob(context, name, prefix) {
  const waitOut = kubectl(context, ["-n", target.namespace, "wait", "--for=condition=complete", `job/${name}`, "--timeout=420s"], 450);
  write(join(repoRoot, "runs", "hook-lifecycle", "kyverno-kyverno", "default", "latest", `${prefix}-wait.txt`), waitOut);
  const logs = kubectl(context, ["-n", target.namespace, "logs", `job/${name}`, "--all-containers=true"], 180);
  write(join(repoRoot, "runs", "hook-lifecycle", "kyverno-kyverno", "default", "latest", `${prefix}-logs.txt`), logs);
  return {
    wait: evidence(`${prefix}-wait.txt`, `${name} completed`),
    logs: evidence(`${prefix}-logs.txt`, `${name} logs captured`),
  };
}

function observedDeploymentReplicas(context) {
  const out = kubectl(context, ["-n", target.namespace, "get", "deploy", ...kyvernoDeployments(), "-o", "json"], 120);
  const list = JSON.parse(out);
  return (list.items ?? []).map((item) => ({
    name: item.metadata?.name,
    replicas: Number(item.spec?.replicas ?? 0),
    readyReplicas: Number(item.status?.readyReplicas ?? 0),
    availableReplicas: Number(item.status?.availableReplicas ?? 0),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function kyvernoWebhookConfigurationNames(context) {
  return kyvernoWebhookConfigurations(context).map((item) => item.name);
}

function kyvernoWebhookConfigurations(context) {
  const out = kubectl(context, ["get", "validatingwebhookconfiguration,mutatingwebhookconfiguration", "-o", "json"], 120);
  const list = JSON.parse(out);
  return (list.items ?? [])
    .map((item) => ({
      kind: item.kind,
      name: item.metadata?.name,
      apiVersion: item.apiVersion,
    }))
    .filter((item) => String(item.name ?? "").includes("kyverno"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function deleteWebhookConfigurations(context, webhooks) {
  const resources = webhooks.map((item) => {
    if (item.kind === "ValidatingWebhookConfiguration") return `validatingwebhookconfiguration/${item.name}`;
    if (item.kind === "MutatingWebhookConfiguration") return `mutatingwebhookconfiguration/${item.name}`;
    throw new Error(`unsupported webhook configuration kind ${item.kind}`);
  });
  if (resources.length === 0) return "no Kyverno webhook configurations to delete\n";
  return kubectl(context, ["delete", ...resources, "--ignore-not-found=true"], 180);
}

function waitForWebhookConfigurations(context, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    const result = run("kubectl", ["--context", context, "get", "validatingwebhookconfiguration,mutatingwebhookconfiguration", "-o", "json"], { timeout: 20 });
    if (result.status === 0) {
      try {
        const list = JSON.parse(result.stdout);
        const kyvernoItems = (list.items ?? [])
          .filter((item) => String(item.metadata?.name ?? "").includes("kyverno"))
          .map(summarizeWebhookConfiguration);
        const populatedItems = kyvernoItems.filter((item) => item.webhooks.length > 0);
        const ready = populatedItems.length >= 2 && populatedItems.every((item) =>
          item.webhooks.length > 0 && item.webhooks.every((webhook) => webhook.service.name && webhook.hasCaBundle),
        );
        if (ready) return kyvernoItems;
        last = result.stdout;
      } catch (error) {
        last = errorText(error);
      }
    } else {
      last = result.stderr || result.stdout;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  }
  throw new Error(`Kyverno webhook configurations did not become ready: ${last.slice(0, 1000)}`);
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

function kyvernoClusterPolicy() {
  return `apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: helm-expt-kyverno-lifecycle-check
spec:
  validationFailureAction: Audit
  background: false
  rules:
    - name: require-owner-label
      match:
        any:
          - resources:
              kinds:
                - Namespace
      validate:
        message: "namespace should carry an owner label"
        pattern:
          metadata:
            labels:
              owner: "?*"
`;
}

function waitForPolicyServerDryRun(context, policyPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    const result = run("kubectl", ["--context", context, "apply", "--dry-run=server", "-f", policyPath, "-o", "yaml"], { timeout: 60 });
    if (result.status === 0) return result.stdout;
    last = `${result.stdout}\n${result.stderr}`.trim();
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
  }
  throw new Error(`Kyverno policy server dry-run did not become available: ${last.slice(0, 1200)}`);
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function errorText(error) {
  return String(error?.stack || error?.message || error).slice(0, 4000);
}
