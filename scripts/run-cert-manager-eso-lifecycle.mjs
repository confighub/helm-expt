import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import { check, cubEnv, parseDocs, readYaml, relativeRepo, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--summary";
const all = process.argv.includes("--all");
const chartOption = optionValue("--chart");
const baseOption = optionValue("--base");
const outputRoot = join(repoRoot, "data", "lifecycle-observations", "cert-manager-eso");

const targets = [
  {
    chart: "jetstack/cert-manager",
    version: "v1.20.2",
    base: "default",
    namespace: "cert-manager",
    packagePath: "packages/jetstack/cert-manager/v1.20.2",
    recipePath: "recipes/jetstack/cert-manager/v1.20.2",
    variantRevision: "recipes/jetstack/cert-manager/v1.20.2/revisions/default/r001/variant-revision.yaml",
    renderedPath: "recipes/jetstack/cert-manager/v1.20.2/revisions/default/r001/rendered/release-objects.yaml",
    externalCrdsFrom: "recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml",
    deployments: ["cert-manager", "cert-manager-cainjector", "cert-manager-webhook"],
    webhookConfigurations: [
      { kind: "mutatingwebhookconfiguration", name: "cert-manager-webhook" },
      { kind: "validatingwebhookconfiguration", name: "cert-manager-webhook" },
    ],
    dryRunObject: certManagerIssuer(),
    lifecycleModel: {
      crdPolicy: "external-crds-required",
      hookPolicy: "startupapicheck-becomes-post-apply-api-dry-run",
      controllerOwnedFields: ["admission webhook caBundle"],
    },
  },
  {
    chart: "jetstack/cert-manager",
    version: "v1.20.2",
    base: "crds-enabled",
    namespace: "cert-manager",
    packagePath: "packages/jetstack/cert-manager/v1.20.2",
    recipePath: "recipes/jetstack/cert-manager/v1.20.2",
    variantRevision: "recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/variant-revision.yaml",
    renderedPath: "recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml",
    deployments: ["cert-manager", "cert-manager-cainjector", "cert-manager-webhook"],
    webhookConfigurations: [
      { kind: "mutatingwebhookconfiguration", name: "cert-manager-webhook" },
      { kind: "validatingwebhookconfiguration", name: "cert-manager-webhook" },
    ],
    dryRunObject: certManagerIssuer(),
    lifecycleModel: {
      crdPolicy: "crds-rendered-by-base-variant",
      hookPolicy: "startupapicheck-becomes-post-apply-api-dry-run",
      controllerOwnedFields: ["admission webhook caBundle"],
    },
  },
  {
    chart: "external-secrets/external-secrets",
    version: "2.5.0",
    base: "default",
    namespace: "external-secrets",
    packagePath: "packages/external-secrets/external-secrets/2.5.0",
    recipePath: "recipes/external-secrets/external-secrets/2.5.0",
    variantRevision: "recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/variant-revision.yaml",
    renderedPath: "recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/rendered/release-objects.yaml",
    deployments: ["external-secrets", "external-secrets-cert-controller", "external-secrets-webhook"],
    webhookConfigurations: [
      { kind: "validatingwebhookconfiguration", name: "secretstore-validate" },
      { kind: "validatingwebhookconfiguration", name: "externalsecret-validate" },
    ],
    webhookSecret: { namespace: "external-secrets", name: "external-secrets-webhook", requiredDataKeys: ["tls.crt", "tls.key"] },
    dryRunObject: externalSecretStore(),
    lifecycleModel: {
      crdPolicy: "crds-rendered-by-base-variant",
      hookPolicy: "no-helm-hook",
      controllerOwnedFields: ["webhook Secret certificate data", "admission webhook caBundle"],
    },
  },
  {
    chart: "external-secrets/external-secrets",
    version: "2.5.0",
    base: "no-crds",
    namespace: "external-secrets",
    packagePath: "packages/external-secrets/external-secrets/2.5.0",
    recipePath: "recipes/external-secrets/external-secrets/2.5.0",
    variantRevision: "recipes/external-secrets/external-secrets/2.5.0/revisions/no-crds/r001/variant-revision.yaml",
    renderedPath: "recipes/external-secrets/external-secrets/2.5.0/revisions/no-crds/r001/rendered/release-objects.yaml",
    externalCrdsFrom: "recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/rendered/release-objects.yaml",
    deployments: ["external-secrets", "external-secrets-cert-controller", "external-secrets-webhook"],
    webhookConfigurations: [
      { kind: "validatingwebhookconfiguration", name: "secretstore-validate" },
      { kind: "validatingwebhookconfiguration", name: "externalsecret-validate" },
    ],
    webhookSecret: { namespace: "external-secrets", name: "external-secrets-webhook", requiredDataKeys: ["tls.crt", "tls.key"] },
    dryRunObject: externalSecretStore(),
    lifecycleModel: {
      crdPolicy: "external-crds-required",
      hookPolicy: "no-helm-hook",
      controllerOwnedFields: ["webhook Secret certificate data", "admission webhook caBundle"],
    },
  },
];

if (mode === "--run") {
  const selected = selectedTargets();
  for (const target of selected) runTarget(target);
  writeSummary();
} else if (mode === "--summary") {
  writeSummary();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/run-cert-manager-eso-lifecycle.mjs --run --all
  node scripts/run-cert-manager-eso-lifecycle.mjs --run --chart jetstack/cert-manager --base crds-enabled
  node scripts/run-cert-manager-eso-lifecycle.mjs --summary
  node scripts/run-cert-manager-eso-lifecycle.mjs --verify`);
}

function selectedTargets() {
  if (all) return targets;
  check(chartOption, "--chart is required unless --all is set");
  check(baseOption, "--base is required unless --all is set");
  const target = targets.find((item) => item.chart === chartOption && item.base === baseOption);
  check(Boolean(target), `unknown lifecycle target ${chartOption}/${baseOption}`);
  return [target];
}

function runTarget(target) {
  const runRoot = join(repoRoot, receiptPath(target).replace(/\/receipt\.yaml$/, ""));
  mkdirSync(runRoot, { recursive: true });
  const rig = `hx-life-${slug(target.chart).slice(0, 10)}-${target.base.slice(0, 10)}-${shortHash(`${target.chart}/${target.base}`)}-${Date.now().toString(36).slice(-4)}`;
  const cluster = rig;
  const context = `kind-${cluster}`;
  const kubeconfig = join(runRoot, "kubeconfig");
  const workDir = join(tmpdir(), `helm-expt-lifecycle-${rig}`);
  const receipt = baseReceipt(target, cluster);
  const checks = receipt.spec.checks;
  let clusterCreated = false;

  const record = (name, fn) => {
    try {
      const detail = fn();
      checks.push({ name, result: "pass", detail: String(detail ?? "pass").slice(0, 2000) });
      return true;
    } catch (error) {
      checks.push({ name, result: "blocked", detail: errorText(error) });
      return false;
    }
  };

  try {
    record("kind-create", () => {
      must("kind", ["create", "cluster", "--name", cluster, "--kubeconfig", kubeconfig, "--wait", "300s"], { timeout: 720 });
      clusterCreated = true;
      return "created fresh kind cluster";
    });

    if (clusterCreated && target.externalCrdsFrom) {
      record("external-crds", () => {
        const crds = crdDocs(target.externalCrdsFrom);
        check(crds.length > 0, `${target.externalCrdsFrom} has no CRDs`);
        const crdPath = join(runRoot, "external-crds.yaml");
        writeYaml(crdPath, { apiVersion: "v1", kind: "List", items: crds });
        kubectl(kubeconfig, context, ["apply", "--server-side", "--force-conflicts", "-f", crdPath], 300);
        waitCrdsEstablished(kubeconfig, context, crds.map((doc) => doc.metadata.name));
        receipt.spec.externalCrds = { source: target.externalCrdsFrom, count: crds.length, names: crds.map((doc) => doc.metadata.name).sort() };
        return `applied and established ${crds.length} external CRDs`;
      });
    }

    if (clusterCreated) {
      record("cub-installer-setup", () => {
        must(
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
          { timeout: 360, env: cubEnv() },
        );
        return `rendered package to ${workDir}`;
      });
    }

    if (clusterCreated) {
      record("kubectl-apply", () => {
        applyInstallerOutput(kubeconfig, context, target.namespace, workDir, runRoot);
        return "applied cub installer output";
      });
    }

    if (clusterCreated) {
      for (const deployment of target.deployments) {
        record(`deployment-ready:${deployment}`, () => {
          kubectl(kubeconfig, context, ["-n", target.namespace, "rollout", "status", `deployment/${deployment}`, "--timeout=240s"], 270);
          return "rollout complete";
        });
      }
    }

    if (clusterCreated) {
      const renderedCrds = crdDocs(target.renderedPath);
      receipt.spec.renderedCrds = { count: renderedCrds.length, names: renderedCrds.map((doc) => doc.metadata.name).sort() };
      const crdNames = target.externalCrdsFrom ? crdDocs(target.externalCrdsFrom).map((doc) => doc.metadata.name) : renderedCrds.map((doc) => doc.metadata.name);
      if (crdNames.length > 0) {
        record("crds-established", () => {
          waitCrdsEstablished(kubeconfig, context, crdNames);
          return `${crdNames.length} CRDs established`;
        });
      }
    }

    if (clusterCreated) {
      for (const item of target.webhookConfigurations) {
        record(`webhook-ca-bundle:${item.name}`, () => {
          waitWebhookCaBundles(kubeconfig, context, item.kind, item.name);
          return "all webhook clientConfig.caBundle fields are non-empty";
        });
      }
    }

    if (clusterCreated && target.webhookSecret) {
      record(`webhook-secret-data:${target.webhookSecret.name}`, () => {
        const keys = waitSecretData(kubeconfig, context, target.webhookSecret);
        receipt.spec.controllerOwnedFields.webhookSecretDataKeys = keys;
        return `Secret data keys: ${keys.join(",")}`;
      });
    }

    if (clusterCreated) {
      record("server-dry-run-api-object", () => {
        const objectPath = join(runRoot, "server-dry-run-object.json");
        writeFileSync(objectPath, `${JSON.stringify(target.dryRunObject, null, 2)}\n`);
        kubectl(kubeconfig, context, ["apply", "--dry-run=server", "-f", objectPath], 120);
        return `${target.dryRunObject.kind}/${target.dryRunObject.metadata.name} accepted by server dry-run`;
      });
    }
  } finally {
    if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
    if (clusterCreated) {
      const cleanup = run("kind", ["delete", "cluster", "--name", cluster, "--kubeconfig", kubeconfig], { timeout: 300 });
      receipt.spec.run.cleanup = {
        result: cleanup.status === 0 ? "pass" : "blocked",
        detail: `${cleanup.stdout}\n${cleanup.stderr}`.trim(),
      };
    }
    receipt.spec.result = checks.every((item) => item.result === "pass") && receipt.spec.run.cleanup.result === "pass" ? "pass" : "blocked";
    writeYaml(join(repoRoot, receiptPath(target)), receipt);
    console.log(`wrote ${receiptPath(target)} result=${receipt.spec.result}`);
  }
}

function baseReceipt(target, cluster) {
  const renderedObjects = parseDocs(readFileSync(join(repoRoot, target.renderedPath), "utf8"));
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "LifecycleObservationReceipt",
    metadata: {
      name: `${slug(target.chart)}-${target.base}-lifecycle`,
    },
    spec: {
      chart: target.chart,
      version: target.version,
      base: target.base,
      result: "blocked",
      observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      package: { path: target.packagePath },
      recipe: { path: target.recipePath },
      variantRevision: target.variantRevision,
      renderedObjectCount: renderedObjects.length,
      lifecycleModel: target.lifecycleModel,
      controllerOwnedFields: {},
      run: {
        mode: "single-kind-cluster-cub-installer-lifecycle-observation",
        cluster,
        namespace: target.namespace,
        cleanup: { result: "not-run" },
      },
      checks: [],
    },
  };
}

function applyInstallerOutput(kubeconfig, context, namespace, workDir, runRoot) {
  const namespaceDoc = must("kubectl", ["--kubeconfig", kubeconfig, "--context", context, "create", "namespace", namespace, "--dry-run=client", "-o", "yaml"]);
  const namespacePath = join(runRoot, "namespace.yaml");
  write(namespacePath, namespaceDoc);
  kubectl(kubeconfig, context, ["apply", "-f", namespacePath], 120);

  const secretsDir = join(workDir, "out", "secrets");
  if (hasYamlFiles(secretsDir)) kubectl(kubeconfig, context, ["apply", "-f", secretsDir], 120);

  const manifestsDir = join(workDir, "out", "manifests");
  check(hasYamlFiles(manifestsDir), `${manifestsDir} has no YAML files`);
  kubectl(kubeconfig, context, ["apply", "--server-side", "--force-conflicts", "-f", manifestsDir], 300);
}

function waitCrdsEstablished(kubeconfig, context, names) {
  for (const name of names) {
    kubectl(kubeconfig, context, ["wait", "--for=condition=Established", `crd/${name}`, "--timeout=180s"], 210);
  }
}

function waitWebhookCaBundles(kubeconfig, context, kind, name) {
  waitFor(`${kind}/${name} caBundle`, () => {
    const item = JSON.parse(kubectl(kubeconfig, context, ["get", kind, name, "-o", "json"], 60));
    const webhooks = item.webhooks ?? [];
    check(webhooks.length > 0, `${kind}/${name} has no webhooks`);
    const missing = webhooks.filter((webhook) => !webhook.clientConfig?.caBundle);
    check(missing.length === 0, `${kind}/${name} missing caBundle for ${missing.map((webhook) => webhook.name).join(",")}`);
    return true;
  });
}

function waitSecretData(kubeconfig, context, secret) {
  let keys = [];
  waitFor(`secret/${secret.name} data`, () => {
    const item = JSON.parse(kubectl(kubeconfig, context, ["-n", secret.namespace, "get", "secret", secret.name, "-o", "json"], 60));
    keys = Object.keys(item.data ?? {}).sort();
    const missing = secret.requiredDataKeys.filter((key) => !keys.includes(key));
    check(missing.length === 0, `${secret.namespace}/${secret.name} missing data keys: ${missing.join(",")}`);
    return true;
  });
  return keys;
}

function waitFor(label, fn, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (fn()) return;
    } catch (error) {
      lastError = error;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
  }
  throw new Error(`${label} did not become ready: ${errorText(lastError)}`);
}

function crdDocs(path) {
  return parseDocs(readFileSync(join(repoRoot, path), "utf8")).filter((doc) => doc.kind === "CustomResourceDefinition");
}

function certManagerIssuer() {
  return {
    apiVersion: "cert-manager.io/v1",
    kind: "Issuer",
    metadata: { name: "lifecycle-check", namespace: "cert-manager" },
    spec: { selfSigned: {} },
  };
}

function externalSecretStore() {
  return {
    apiVersion: "external-secrets.io/v1",
    kind: "SecretStore",
    metadata: { name: "lifecycle-check", namespace: "external-secrets" },
    spec: {
      provider: {
        fake: {
          data: [
            {
              key: "/lifecycle/check",
              value: "ok",
            },
          ],
        },
      },
    },
  };
}

function writeSummary() {
  mkdirSync(outputRoot, { recursive: true });
  const rows = targets.map((target) => {
    const path = join(repoRoot, receiptPath(target));
    if (!existsSync(path)) {
      return {
        chart: target.chart,
        version: target.version,
        base: target.base,
        result: "not-run",
        crd_policy: target.lifecycleModel.crdPolicy,
        hook_policy: target.lifecycleModel.hookPolicy,
        receipt: receiptPath(target),
      };
    }
    const receipt = readYaml(path);
    return {
      chart: target.chart,
      version: target.version,
      base: target.base,
      result: receipt.spec?.result,
      crd_policy: receipt.spec?.lifecycleModel?.crdPolicy,
      hook_policy: receipt.spec?.lifecycleModel?.hookPolicy,
      receipt: receiptPath(target),
    };
  });
  const counts = new Map();
  for (const row of rows) counts.set(row.result, (counts.get(row.result) ?? 0) + 1);
  write(join(outputRoot, "summary.csv"), toCsv(rows));
  write(
    join(outputRoot, "summary.md"),
    `# Cert-Manager And External Secrets Lifecycle Observations

This lane checks the lifecycle mechanisms that a config-only Helm import cannot
prove from rendered YAML alone: CRD ownership, post-apply API readiness,
webhook CA bundle injection, and controller-populated webhook Secret data.

\`\`\`text
pass: ${counts.get("pass") ?? 0}
blocked: ${counts.get("blocked") ?? 0}
not-run: ${counts.get("not-run") ?? 0}
\`\`\`

| Chart | Base | Result | CRD policy | Hook/lifecycle policy | Receipt |
| --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.result} | ${row.crd_policy} | ${row.hook_policy} | ${row.receipt} |`).join("\n")}
`,
  );
  console.log(`wrote ${relativeRepo(join(outputRoot, "summary.md"))}`);
}

function verify() {
  for (const target of targets) {
    const path = join(repoRoot, receiptPath(target));
    check(existsSync(path), `${receiptPath(target)} is missing; run npm run lifecycle:cert-manager-eso -- --all`);
    const receipt = readYaml(path);
    const context = `${target.chart}@${target.version}/${target.base}`;
    check(receipt.kind === "LifecycleObservationReceipt", `${context}: kind mismatch`);
    check(receipt.spec?.chart === target.chart, `${context}: chart mismatch`);
    check(receipt.spec?.version === target.version, `${context}: version mismatch`);
    check(receipt.spec?.base === target.base, `${context}: base mismatch`);
    check(receipt.spec?.result === "pass" || receipt.spec?.result === "blocked", `${context}: invalid result`);
    check(Array.isArray(receipt.spec?.checks) && receipt.spec.checks.length >= 5, `${context}: missing checks`);
    if (receipt.spec.result === "pass") {
      check(receipt.spec.checks.every((item) => item.result === "pass"), `${context}: pass receipt has failed check`);
      check(receipt.spec?.run?.cleanup?.result === "pass", `${context}: cleanup did not pass`);
    }
  }
  const expectedSummary = captureSummary();
  check(readFileSync(join(outputRoot, "summary.csv"), "utf8") === expectedSummary.csv, "lifecycle summary.csv is stale");
  check(readFileSync(join(outputRoot, "summary.md"), "utf8") === expectedSummary.md, "lifecycle summary.md is stale");
  console.log("verified cert-manager and external-secrets lifecycle observations");
}

function captureSummary() {
  const rows = targets.map((target) => {
    const path = join(repoRoot, receiptPath(target));
    const receipt = existsSync(path) ? readYaml(path) : null;
    return {
      chart: target.chart,
      version: target.version,
      base: target.base,
      result: receipt?.spec?.result ?? "not-run",
      crd_policy: receipt?.spec?.lifecycleModel?.crdPolicy ?? target.lifecycleModel.crdPolicy,
      hook_policy: receipt?.spec?.lifecycleModel?.hookPolicy ?? target.lifecycleModel.hookPolicy,
      receipt: receiptPath(target),
    };
  });
  const counts = new Map();
  for (const row of rows) counts.set(row.result, (counts.get(row.result) ?? 0) + 1);
  return {
    csv: toCsv(rows),
    md: `# Cert-Manager And External Secrets Lifecycle Observations

This lane checks the lifecycle mechanisms that a config-only Helm import cannot
prove from rendered YAML alone: CRD ownership, post-apply API readiness,
webhook CA bundle injection, and controller-populated webhook Secret data.

\`\`\`text
pass: ${counts.get("pass") ?? 0}
blocked: ${counts.get("blocked") ?? 0}
not-run: ${counts.get("not-run") ?? 0}
\`\`\`

| Chart | Base | Result | CRD policy | Hook/lifecycle policy | Receipt |
| --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.result} | ${row.crd_policy} | ${row.hook_policy} | ${row.receipt} |`).join("\n")}
`,
  };
}

function receiptPath(target) {
  return `runs/lifecycle-observations/cert-manager-eso/${slug(target.chart)}-${target.base}/receipt.yaml`;
}

function hasYamlFiles(path) {
  return existsSync(path) && readdirSync(path).some((name) => name.endsWith(".yaml") || name.endsWith(".yml"));
}

function kubectl(kubeconfig, context, args, timeout = 120) {
  return must("kubectl", ["--kubeconfig", kubeconfig, "--context", context, ...args], { timeout });
}

function must(cmd, args, options = {}) {
  const result = run(cmd, args, options);
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`.trim());
  }
  return result.stdout;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    timeout: options.timeout ? options.timeout * 1000 : undefined,
    maxBuffer: 1024 * 1024 * 100,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function shortHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 5);
}

function slug(value) {
  return String(value).replaceAll("/", "-");
}

function errorText(error) {
  if (!error) return "";
  return String(error.stack || error.message || error).slice(0, 4000);
}

function toCsv(rows) {
  const headers = ["chart", "version", "base", "result", "crd_policy", "hook_policy", "receipt"];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
