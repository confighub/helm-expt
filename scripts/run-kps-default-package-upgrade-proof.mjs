#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  canonicalObjectMaps,
  check,
  listFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  sha256File,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--run", "--generate", "--verify"].includes(mode), "use --run, --generate, or --verify");

const chart = "prometheus-community/kube-prometheus-stack";
const currentVersion = "85.3.3";
const candidateVersion = "86.1.0";
const base = "default";
const namespace = "monitoring";
const admissionSecret = "kube-prometheus-stack-admission";
const receiptPath = join(repoRoot, "runs", "kps-default-package-upgrade-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "kps-default-package-upgrade-proof", "summary.md");
const workloads = [
  ["deployment", "kube-prometheus-stack-grafana"],
  ["deployment", "kube-prometheus-stack-kube-state-metrics"],
  ["deployment", "kube-prometheus-stack-operator"],
  ["daemonset", "kube-prometheus-stack-prometheus-node-exporter"],
  ["statefulset", "alertmanager-kube-prometheus-stack-alertmanager"],
  ["statefulset", "prometheus-kube-prometheus-stack-prometheus"],
];

if (mode === "--run") {
  check(
    process.env.HELM_EXPT_ALLOW_KPS_DEFAULT_PACKAGE_UPGRADE === "1",
    "set HELM_EXPT_ALLOW_KPS_DEFAULT_PACKAGE_UPGRADE=1 to run this live proof",
  );
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)}: ${receipt.spec.result}`);
} else {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  if (mode === "--generate") {
    write(summaryPath, renderSummary(receipt));
    console.log(`regenerated ${relativeRepo(summaryPath)}`);
  } else {
    check(
      existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === renderSummary(receipt),
      `${relativeRepo(summaryPath)} is stale`,
    );
    console.log("verified the Kube Prometheus Stack default package upgrade proof");
  }
}

function runProof() {
  for (const [tool, args] of [
    ["cub", ["installer", "version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
  ]) check(command(tool, args).ok, `${tool} is required`);
  check(!liveProofRunning(), "another live Helm or Kube Prometheus Stack proof is running");

  const observedAt = new Date().toISOString();
  const runId = observedAt.replace(/[-:.TZ]/g, "").slice(0, 14);
  const clusterName = `hx-kps-default-upgrade-${runId}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-kps-default-upgrade-"));
  const kubeconfig = join(workRoot, "kubeconfig");
  const cleanup = { cluster: "not-created", localFiles: "pending" };
  let clusterCreated = false;
  const receipt = initialReceipt({ observedAt, clusterName, cleanup });

  try {
    phase(`rendering ${currentVersion} and ${candidateVersion} from the local installer packages`);
    const current = materializeVersion(currentVersion, workRoot);
    const candidate = materializeVersion(candidateVersion, workRoot);
    receipt.spec.source.current = current.record;
    receipt.spec.source.candidate = candidate.record;
    receipt.spec.comparison = compareObjectSets(current.ordinaryYaml, candidate.ordinaryYaml);

    phase("creating a throwaway kind cluster");
    must("kind", [
      "create", "cluster", "--name", clusterName,
      "--kubeconfig", kubeconfig, "--wait", "180s",
    ], { timeout: 300_000 });
    clusterCreated = true;
    cleanup.cluster = "pending";

    phase(`installing ${currentVersion} through the package lifecycle route`);
    receipt.spec.install = runRoute({
      materialized: current,
      kubeconfig,
      phaseName: "install",
    });
    const secretBefore = kubectlJson(kubeconfig, [
      "-n", namespace, "get", `secret/${admissionSecret}`, "-o", "json",
    ]);

    phase(`upgrading to ${candidateVersion} through the package lifecycle route`);
    receipt.spec.upgrade = runRoute({
      materialized: candidate,
      kubeconfig,
      phaseName: "upgrade",
    });
    const secretAfter = kubectlJson(kubeconfig, [
      "-n", namespace, "get", `secret/${admissionSecret}`, "-o", "json",
    ]);
    check(secretBefore.metadata?.uid === secretAfter.metadata?.uid, "the upgrade replaced the retained admission Secret");
    receipt.spec.upgrade.admissionSecretRetained = true;

    const operator = kubectlJson(kubeconfig, [
      "-n", namespace, "get", "deployment/kube-prometheus-stack-operator", "-o", "json",
    ]);
    const chartLabel = String(operator.metadata?.labels?.chart ?? "");
    check(chartLabel.includes(candidateVersion), `operator chart label did not advance to ${candidateVersion}: ${chartLabel || "missing"}`);
    receipt.spec.upgrade.operatorChartLabel = chartLabel;
    receipt.spec.result = "pass";
  } catch (error) {
    receipt.spec.error = sanitizeError(error);
    throw error;
  } finally {
    if (clusterCreated) {
      const deleted = command("kind", ["delete", "cluster", "--name", clusterName], { timeout: 240_000 });
      cleanup.cluster = deleted.ok ? "pass" : "failed";
    }
    rmSync(workRoot, { recursive: true, force: true });
    cleanup.localFiles = existsSync(workRoot) ? "failed" : "pass";
  }

  check(cleanup.cluster === "pass", "the proof cluster was not deleted");
  return receipt;
}

function materializeVersion(version, workRoot) {
  const packageRoot = packageRootFor(version);
  const sourceLockPath = sourceLockPathFor(version);
  const sourceLock = readYaml(sourceLockPath);
  check(sourceLock.spec?.chart === "kube-prometheus-stack", `${version} source lock chart changed`);
  check(sourceLock.spec?.version === version, `${version} source lock version changed`);
  check(/^[a-f0-9]{64}$/.test(sourceLock.spec?.packageSHA256 ?? ""), `${version} source package digest is missing`);

  const installRoot = join(workRoot, `render-${version}`);
  must("cub", [
    "installer", "setup", "--pull", relativeRepo(packageRoot),
    "--base", base, "--work-dir", installRoot,
    "--non-interactive", "--namespace", namespace,
  ], { timeout: 300_000, maxBuffer: 256 * 1024 * 1024 });

  const lifecycleRoot = join(installRoot, "package", "prerequisites", "kube-prometheus-stack-lifecycle");
  const paths = {
    crds: join(lifecycleRoot, "default-crds.yaml"),
    prepare: join(lifecycleRoot, "prepare.sh"),
    finish: join(lifecycleRoot, "finish.sh"),
  };
  for (const path of Object.values(paths)) check(existsSync(path), `${version} package is missing ${path}`);

  const renderedDocs = [
    ...readYamlDocuments(join(installRoot, "out", "manifests")),
    ...readYamlDocuments(join(installRoot, "out", "secrets")),
  ];
  const ordinaryDocs = renderedDocs.filter((doc) => objectIdentity(doc) !== "v1|Namespace||monitoring");
  const supportObjects = renderedDocs.filter((doc) => objectIdentity(doc) === "v1|Namespace||monitoring");
  const committedPath = renderedObjectsPathFor(version);
  const committedYaml = readFileSync(committedPath, "utf8");
  const committedDocs = parseDocs(committedYaml);
  check(ordinaryDocs.length === committedDocs.length, `${version} package object count differs from the committed render`);
  check(supportObjects.length === 1, `${version} package did not add exactly one monitoring Namespace`);
  const ordinaryYaml = yamlDocuments(ordinaryDocs);
  const semantic = canonicalObjectMaps(ordinaryYaml, committedYaml);
  const identities = new Set([...Object.keys(semantic.helm), ...Object.keys(semantic.cub)]);
  const differences = [...identities].filter((identity) => semantic.helm[identity] !== semantic.cub[identity]);
  check(differences.length === 0, `${version} package differs from the committed render: ${differences.slice(0, 3).join(", ")}`);

  const crdDocs = parseDocs(readFileSync(paths.crds, "utf8"));
  check(crdDocs.length === 10, `${version} lifecycle route has ${crdDocs.length} CRDs instead of 10`);
  const workloadDocs = renderedDocs.filter((doc) => doc.kind !== "CustomResourceDefinition");
  const workloadPath = join(workRoot, `workload-${version}.yaml`);
  write(workloadPath, `${yamlDocuments(workloadDocs)}\n`);
  const lifecycleReceiptPath = join(workRoot, `lifecycle-${version}.yaml`);

  return {
    version,
    packageRoot,
    installRoot,
    paths,
    workloadPath,
    lifecycleReceiptPath,
    crdNames: crdDocs.map((doc) => doc.metadata.name).sort(),
    ordinaryYaml,
    record: {
      version,
      package: relativeRepo(packageRoot),
      installerYamlSHA256: sha256File(join(packageRoot, "installer.yaml")),
      sourceLock: relativeRepo(sourceLockPath),
      sourcePackageSHA256: sourceLock.spec.packageSHA256,
      committedRender: relativeRepo(committedPath),
      committedRenderSHA256: sha256(committedYaml),
      objectCount: ordinaryDocs.length,
      crdCount: crdDocs.length,
      supportObjectCount: supportObjects.length,
    },
  };
}

function runRoute({ materialized, kubeconfig, phaseName }) {
  kubectlGeneratedApply(kubeconfig, [
    "create", "namespace", namespace, "--dry-run=client", "-o", "yaml",
  ]);
  kubectl(kubeconfig, [
    "apply", "--server-side", "--force-conflicts", "-f", materialized.paths.crds,
  ], { timeout: 420_000 });
  for (const name of materialized.crdNames) {
    kubectl(kubeconfig, ["wait", "--for=condition=Established", `crd/${name}`, "--timeout=180s"]);
  }

  must("bash", [materialized.paths.prepare, namespace], {
    timeout: 360_000,
    env: { KUBECONFIG: kubeconfig },
  });
  const secret = kubectlJson(kubeconfig, [
    "-n", namespace, "get", `secret/${admissionSecret}`, "-o", "json",
  ]);
  const secretKeys = Object.keys(secret.data ?? {}).sort();
  check(sameSet(secretKeys, ["ca", "cert", "key"]), `${phaseName} admission Secret keys differ`);

  kubectl(kubeconfig, [
    "apply", "--server-side", "--force-conflicts", "-f", materialized.workloadPath,
  ], { timeout: 600_000 });
  waitForWorkload(kubeconfig, "deployment", "kube-prometheus-stack-operator");
  must("bash", [materialized.paths.finish, namespace], {
    timeout: 420_000,
    env: {
      KUBECONFIG: kubeconfig,
      HELM_EXPT_LIFECYCLE_RECEIPT: materialized.lifecycleReceiptPath,
      KPS_LIFECYCLE_BASE: base,
    },
  });
  const lifecycle = readYaml(materialized.lifecycleReceiptPath);
  check(lifecycle.spec?.result === "pass", `${phaseName} lifecycle receipt did not pass`);
  check(lifecycle.spec?.matchingWebhookCABundles === 3, `${phaseName} webhook CA bundles differ`);
  check(lifecycle.spec?.operatorEndpointReady === true, `${phaseName} operator endpoint is not ready`);
  check(lifecycle.spec?.serverDryRun === "pass", `${phaseName} server dry-run did not pass`);

  const workloadResults = workloads.map(([kind, name]) => {
    waitForWorkload(kubeconfig, kind, name);
    return { kind, name, namespace, result: "pass" };
  });
  for (const job of [
    "kube-prometheus-stack-admission-create",
    "kube-prometheus-stack-admission-patch",
  ]) check(!kubectlTry(kubeconfig, ["-n", namespace, "get", `job/${job}`]).ok, `${phaseName} left ${job} behind`);

  return {
    result: "pass",
    version: materialized.version,
    route: [
      { order: 10, name: "crds-first", result: "pass", count: materialized.crdNames.length },
      { order: 20, name: "admission-secret", result: "pass", keys: secretKeys },
      { order: 30, name: "workload", result: "pass", objects: materialized.record.objectCount },
      { order: 40, name: "webhook-patch", result: "pass", matchingCABundles: 3 },
      { order: 50, name: "runtime", result: "pass", workloads: workloadResults.length },
      { order: 60, name: "hook-cleanup", result: "pass", jobsRemoved: 2 },
    ],
    lifecycleReceipt: lifecycle.spec,
    workloads: workloadResults,
  };
}

function initialReceipt({ observedAt, clusterName, cleanup }) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubePrometheusStackDefaultPackageUpgradeReceipt",
    metadata: { name: "kube-prometheus-stack-default-85-3-3-to-86-1-0" },
    spec: {
      chart,
      base,
      currentVersion,
      candidateVersion,
      observedAt,
      result: "blocked",
      execution: {
        path: "cub-installer-package-direct-apply",
        clusterType: "kind",
        clusterName,
        namespace,
      },
      source: { current: {}, candidate: {} },
      comparison: {},
      install: { result: "not-run" },
      upgrade: { result: "not-run" },
      cleanup,
      limits: [
        "This receipt covers the default 85.3.3 to 86.1.0 package route on one fresh kind cluster.",
        "It proves explicit CRD, certificate, workload, webhook, readiness, and cleanup steps through direct apply. It does not prove ConfigHub selects this route automatically.",
        "It does not prove Argo CD, Flux, rollback, long-running soak, data migration outside the exercised objects, or other versions and values.",
      ],
    },
  };
}

function verifyReceipt(receipt) {
  const spec = receipt.spec ?? {};
  check(receipt.kind === "KubePrometheusStackDefaultPackageUpgradeReceipt", "receipt kind changed");
  check(spec.chart === chart && spec.base === base, "receipt source changed");
  check(spec.currentVersion === currentVersion && spec.candidateVersion === candidateVersion, "receipt version pair changed");
  check(spec.result === "pass", "default package upgrade did not pass");
  check(spec.cleanup?.cluster === "pass" && spec.cleanup?.localFiles === "pass", "proof cleanup did not pass");
  check(spec.install?.result === "pass" && spec.upgrade?.result === "pass", "install or upgrade route did not pass");
  check(spec.upgrade?.admissionSecretRetained === true, "upgrade did not retain the admission Secret");
  check(String(spec.upgrade?.operatorChartLabel ?? "").includes(candidateVersion), "operator chart label does not show the candidate version");
  for (const side of ["current", "candidate"]) {
    const source = spec.source?.[side] ?? {};
    const version = side === "current" ? currentVersion : candidateVersion;
    check(source.version === version && source.objectCount > 0, `${side} source record is incomplete`);
    check(source.committedRenderSHA256 === sha256File(join(repoRoot, source.committedRender)), `${side} committed render changed`);
    check(source.installerYamlSHA256 === sha256File(join(repoRoot, source.package, "installer.yaml")), `${side} installer package changed`);
    check(source.sourcePackageSHA256 === readYaml(join(repoRoot, source.sourceLock)).spec?.packageSHA256, `${side} source lock changed`);
  }
  for (const stage of [spec.install, spec.upgrade]) {
    check(stage.route?.length === 6, `${stage.version} route does not have six ordered stages`);
    check(stage.route.every((item) => item.result === "pass"), `${stage.version} route contains a failed stage`);
    check(stage.workloads?.length === workloads.length, `${stage.version} workload count differs`);
  }
  check(spec.comparison?.changed > 0, "version comparison recorded no changed objects");
}

function compareObjectSets(currentYaml, candidateYaml) {
  const maps = canonicalObjectMaps(currentYaml, candidateYaml);
  const currentKeys = new Set(Object.keys(maps.helm));
  const candidateKeys = new Set(Object.keys(maps.cub));
  const added = [...candidateKeys].filter((key) => !currentKeys.has(key));
  const removed = [...currentKeys].filter((key) => !candidateKeys.has(key));
  const shared = [...currentKeys].filter((key) => candidateKeys.has(key));
  const changed = shared.filter((key) => maps.helm[key] !== maps.cub[key]);
  return {
    currentObjects: currentKeys.size,
    candidateObjects: candidateKeys.size,
    added: added.length,
    removed: removed.length,
    changed: changed.length,
    unchanged: shared.length - changed.length,
  };
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  return `# Kube Prometheus Stack default package upgrade

This test answers one question: can the maintained \`${base}\` package move from
\`${currentVersion}\` to \`${candidateVersion}\` while running the chart-specific
CRD and admission-webhook work in a visible order?

For this exact version pair and kind target, the result is **${spec.result}**.

## What ran

1. Render the two maintained installer packages and match each object set to its committed chart render.
2. Install ${spec.install.route[0].count} CRDs before the ${spec.install.route[2].objects} ${currentVersion} objects.
3. Create the admission Secret, apply the workload, patch the webhooks, check ${spec.install.route[4].workloads} workloads, and remove the temporary Jobs.
4. Apply the ${candidateVersion} CRDs, keep the existing admission Secret, apply the candidate objects, rerun the webhook step, and repeat the checks.

| Comparison | Count |
| --- | ---: |
| Current objects | ${spec.comparison.currentObjects} |
| Candidate objects | ${spec.comparison.candidateObjects} |
| Added | ${spec.comparison.added} |
| Removed | ${spec.comparison.removed} |
| Changed | ${spec.comparison.changed} |
| Unchanged | ${spec.comparison.unchanged} |

The operator reports chart label \`${spec.upgrade.operatorChartLabel}\` after the
upgrade. The admission Secret kept the same Kubernetes UID.

## Boundary

This is a direct package-route test on one throwaway kind cluster. It does not
claim that ConfigHub selects the route automatically, or that this default path
has been repeated through Argo CD, Flux, rollback, production, or other values.

Receipt: [\`${relativeRepo(receiptPath)}\`](../../${relativeRepo(receiptPath)}).
`;
}

function packageRootFor(version) {
  return join(repoRoot, "packages", "prometheus-community", "kube-prometheus-stack", version);
}

function sourceLockPathFor(version) {
  return join(repoRoot, "recipes", "prometheus-community", "kube-prometheus-stack", version, "source-lock.yaml");
}

function renderedObjectsPathFor(version) {
  return join(
    repoRoot, "recipes", "prometheus-community", "kube-prometheus-stack", version,
    "revisions", base, "r001", "rendered", "release-objects.yaml",
  );
}

function readYamlDocuments(root) {
  if (!existsSync(root)) return [];
  return listFiles(root)
    .filter((path) => /\.ya?ml$/i.test(path))
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")));
}

function yamlDocuments(docs) {
  return docs.map((doc) => toYaml(doc)).join("\n---\n");
}

function objectIdentity(doc) {
  return [doc.apiVersion ?? "", doc.kind ?? "", doc.metadata?.namespace ?? "", doc.metadata?.name ?? ""].join("|");
}

function sameSet(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function phase(message) {
  console.log(`\n[kps default upgrade] ${message}`);
}

function command(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    input: options.input,
    timeout: options.timeout ?? 120_000,
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
  });
  return { ok: result.status === 0, status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function must(file, args, options = {}) {
  const result = command(file, args, options);
  check(result.ok, `${file} ${args.join(" ")} failed: ${sanitizeError(result.stderr || result.stdout)}`);
  return result;
}

function kubectl(kubeconfig, args, options = {}) {
  return must("kubectl", ["--kubeconfig", kubeconfig, ...args], options);
}

function kubectlTry(kubeconfig, args, options = {}) {
  return command("kubectl", ["--kubeconfig", kubeconfig, ...args], options);
}

function kubectlJson(kubeconfig, args) {
  return JSON.parse(kubectl(kubeconfig, args).stdout);
}

function kubectlGeneratedApply(kubeconfig, args) {
  const generated = kubectl(kubeconfig, args).stdout;
  kubectl(kubeconfig, ["apply", "-f", "-"], { input: generated });
}

function waitForWorkload(kubeconfig, kind, name) {
  const resource = `${kind}/${name}`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (kubectlTry(kubeconfig, ["-n", namespace, "get", resource, "-o", "name"]).ok) break;
    sleep(5);
  }
  kubectl(kubeconfig, ["-n", namespace, "rollout", "status", resource, "--timeout=600s"], { timeout: 660_000 });
}

function sleep(seconds) {
  spawnSync("sleep", [String(seconds)]);
}

function liveProofRunning() {
  const result = command("pgrep", [
    "-f",
    "live-helm-confighub-parity-test|run-kps-(crd|workload)-upgrade-live|run-kps-lifecycle-route-proof|run-kps-default-package-upgrade-proof|run-kps-confighub-lifecycle-promotion",
  ]);
  return result.ok && result.stdout.trim().split("\n").some((line) => line.trim() && Number(line.trim()) !== process.pid);
}

function sanitizeError(value) {
  return String(value?.message ?? value ?? "")
    .replace(/[A-Za-z0-9_=-]{40,}/g, "<redacted>")
    .trim()
    .slice(0, 2000);
}
