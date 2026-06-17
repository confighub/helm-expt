#!/usr/bin/env node
// Webhook / admission certificate lifecycle route runner.
//
// Many charts ship a pre-install Helm hook (Job or operator) that GENERATES a
// TLS serving Secret which the workload then mounts. ConfigHub's Helm->render
// import drops hooks, so a config-only apply never creates that Secret and the
// workload is stuck (CreateContainerConfigError / ContainerCreating). The
// honest product route is `generated-fact-staged-secret`: stage the serving
// certificate as an explicit declared target fact BEFORE apply, then observe
// that the workload converges. This proves ConfigHub can deliver the chart when
// the cert is modelled as a target fact instead of a hidden hook side effect.
//
// This runner:
//   1. generates a local self-signed certificate (NOT production CA material),
//   2. creates a kind cluster + stages the Secret the hook would have produced,
//   3. delegates the committed-render apply + convergence observation to
//      run-next80-local-live.mjs (the proven observation lane),
//   4. writes a WebhookCertLifecycleStagingReceipt next to the paired
//      observation receipt, recording the honest result (pass/blocked/fail).
//
//   node scripts/run-webhook-cert-lifecycle.mjs \
//     --chart <repo>/<chart>/<version> --base <variant> \
//     --secret-name <name> [--secret-namespace default] \
//     [--ca-key ca] [--cert-key cert] [--key-key key] \
//     [--cluster claude-helm-expt-certlc] [--keep-cluster]
//
// Honesty rules:
// - The staged certificate is a local self-signed cert; the receipt's
//   proofBoundary states this proves convergence with a staged fact, NOT
//   production CA trust, admission policy safety, or certificate rotation.
// - The result mirrors the real observation; a non-converging workload records
//   blocked/fail with the observed reason, never a fake pass.
// - Cluster hygiene: clusters must be claude-helm-expt- prefixed; only a
//   cluster this run created is deleted; the staged Secret is always removed.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, writeYaml } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const chartPath = optionValue("--chart");
const base = optionValue("--base") ?? "default";
const secretName = optionValue("--secret-name");
const secretNamespace = optionValue("--secret-namespace") ?? "default";
const caKey = optionValue("--ca-key") ?? "ca";
const certKey = optionValue("--cert-key") ?? "cert";
const keyKey = optionValue("--key-key") ?? "key";
const clusterName = optionValue("--cluster") ?? "claude-helm-expt-certlc";
const keepCluster = args.includes("--keep-cluster");

check(chartPath, "usage: --chart <repo>/<chart>/<version> --base <variant> --secret-name <name> [--secret-namespace default] [--ca-key ca --cert-key cert --key-key key]");
check(secretName, "missing --secret-name (the Secret the hook would have generated)");
check(clusterName.startsWith("claude-helm-expt-"), `refusing cluster ${clusterName}: claude lane clusters must be prefixed claude-helm-expt-`);

const recipeRoot = join(repoRoot, "recipes", chartPath);
check(existsSync(join(recipeRoot, "recipe.yaml")), `no recipe at recipes/${chartPath}`);
const renderedPath = join(repoRoot, "recipes", chartPath, "revisions", base, "r001", "rendered", "release-objects.yaml");
check(existsSync(renderedPath), `no committed render at ${relativeRepo(renderedPath)}`);

const chartParts = chartPath.split("/");
const version = chartParts.pop();
const chart = chartParts.join("/");
const slug = `${chartPath.replaceAll("/", "-")}-${base}`;
const context = `kind-${clusterName}`;
const observationReceiptRel = `runs/next80-local-kind/${slug}/observation-receipt.yaml`;
const stagingReceiptPath = join(repoRoot, "data", "webhook-cert-lifecycle", "receipts", `${slug.replaceAll(".", "-")}.yaml`);

const tmp = mkdtempSync(join(tmpdir(), "certlc-"));
const certPem = join(tmp, "cert.pem");
const keyPem = join(tmp, "key.pem");
let createdCluster = false;

try {
  // 1. Self-signed certificate (its own CA): ca == cert for a self-signed leaf.
  run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-keyout", keyPem, "-out", certPem,
    "-days", "3650", "-nodes", "-subj", `/CN=${secretName}.${secretNamespace}.svc`]);

  // 2. kind cluster + staged Secret (the hook output, as a declared target fact).
  if (!kindClusters().includes(clusterName)) {
    console.log(`creating kind cluster ${clusterName}...`);
    run("kind", ["create", "cluster", "--name", clusterName, "--wait", "60s"]);
    createdCluster = true;
  }
  if (secretNamespace !== "default" && secretNamespace !== "kube-system" && !tryRun("kubectl", ["--context", context, "get", "namespace", secretNamespace])) {
    run("kubectl", ["--context", context, "create", "namespace", secretNamespace]);
  }
  const secretYaml = run("kubectl", ["create", "secret", "generic", secretName, "-n", secretNamespace,
    `--from-file=${caKey}=${certPem}`, `--from-file=${certKey}=${certPem}`, `--from-file=${keyKey}=${keyPem}`,
    "--dry-run=client", "-o", "yaml"]);
  execFileSync("kubectl", ["--context", context, "apply", "-f", "-"], { cwd: repoRoot, input: secretYaml, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  console.log(`staged Secret ${secretNamespace}/${secretName} (keys ${caKey},${certKey},${keyKey})`);

  // 3. Delegate the committed-render apply + convergence observation to the
  //    proven local-live lane, reusing the cluster where the Secret is staged.
  tryRun("node", ["scripts/run-next80-local-live.mjs", "--chart", chartPath, "--variant", base, "--cluster", clusterName, "--keep-cluster"]);
} finally {
  // 4. Always remove the staged Secret; remove the cluster only if we made it.
  tryRun("kubectl", ["--context", context, "delete", "secret", secretName, "-n", secretNamespace, "--ignore-not-found", "--wait=false"]);
  if (createdCluster && !keepCluster) {
    console.log(`deleting kind cluster ${clusterName}...`);
    tryRun("kind", ["delete", "cluster", "--name", clusterName]);
  }
  rmSync(tmp, { recursive: true, force: true });
}

// 5. Read the paired observation and write the staging receipt with the honest result.
check(existsSync(join(repoRoot, observationReceiptRel)), `observation lane did not produce ${observationReceiptRel}`);
const observation = readYaml(join(repoRoot, observationReceiptRel));
const result = observation.spec?.result ?? "fail";

// Record the staged Secret in the paired observation receipt as well, so the
// matrix-facing receipt carries an honest, consistent trail (mirrors how
// stagedTargetFactCRDs is recorded): this convergence required a staged fact.
if (observation.spec && !Array.isArray(observation.spec.stagedTargetFactSecrets)) {
  observation.spec.stagedTargetFactSecrets = [{ namespace: secretNamespace, name: secretName, keys: [caKey, certKey, keyKey], generation: "local-self-signed-certificate" }];
  writeYaml(join(repoRoot, observationReceiptRel), observation);
}

writeYaml(stagingReceiptPath, {
  apiVersion: "helm-expt.confighub.com/v1alpha1",
  kind: "WebhookCertLifecycleStagingReceipt",
  metadata: { name: `${slug}-webhook-cert-staging` },
  spec: {
    chart,
    version,
    base,
    result,
    observedAt: new Date().toISOString(),
    route: "generated-fact-staged-secret",
    stagedSecret: { namespace: secretNamespace, name: secretName, keys: [caKey, certKey, keyKey] },
    generation: { method: "local-self-signed-certificate", secretMaterialCommitted: false },
    pairedObservation: { receipt: observationReceiptRel, result, target: clusterName, namespace: secretNamespace },
    proofBoundary: [
      "Proves an explicit staged serving certificate Secret can replace a hidden chart lifecycle side effect for this local kind target.",
      "Does not claim production CA trust, admission policy safety, certificate rotation, or long-term serving certificate management.",
    ],
  },
});
console.log(`${result.toUpperCase()} ${chartPath} ${base}: staged ${secretNamespace}/${secretName} -> ${relativeRepo(stagingReceiptPath)}`);
if (result !== "pass") process.exitCode = result === "blocked" ? 3 : 2;

function kindClusters() {
  return (tryCapture("kind", ["get", "clusters"]) ?? "").split("\n").filter(Boolean);
}
function run(cmd, cmdArgs) {
  return execFileSync(cmd, cmdArgs, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 50 });
}
function tryRun(cmd, cmdArgs) {
  try { run(cmd, cmdArgs); return true; } catch { return false; }
}
function tryCapture(cmd, cmdArgs) {
  try { return run(cmd, cmdArgs); } catch { return null; }
}
function optionValue(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}
