#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  canonicalObjectMaps,
  check,
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
if (!["--run", "--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-kps-lifecycle-route-proof.mjs --run
  node scripts/run-kps-lifecycle-route-proof.mjs --generate
  node scripts/run-kps-lifecycle-route-proof.mjs --verify`);
  process.exit(2);
}

const chart = "prometheus-community/kube-prometheus-stack";
const chartVersion = "85.3.3";
const releaseName = "kube-prometheus-stack";
const namespace = "monitoring";
const sourceLockPath = join(
  repoRoot,
  "recipes",
  "prometheus-community",
  "kube-prometheus-stack",
  chartVersion,
  "source-lock.yaml",
);
const renderedObjectsPath = join(
  repoRoot,
  "recipes",
  "prometheus-community",
  "kube-prometheus-stack",
  chartVersion,
  "revisions",
  "default",
  "r001",
  "rendered",
  "release-objects.yaml",
);
const receiptPath = join(
  repoRoot,
  "runs",
  "kps-lifecycle-route-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "kps-lifecycle-route-proof",
  "summary.md",
);
const createJobName = "kube-prometheus-stack-admission-create";
const patchJobName = "kube-prometheus-stack-admission-patch";
const admissionSecretName = "kube-prometheus-stack-admission";
const operatorDeployment = "kube-prometheus-stack-operator";

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  check(
    existsSync(receiptPath),
    `${relativeRepo(receiptPath)} is missing; run the live proof`,
  );
  check(
    existsSync(summaryPath),
    `${relativeRepo(summaryPath)} is missing; run the generator`,
  );
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale`,
  );
  console.log("verified the kube-prometheus-stack lifecycle route proof");
}

function run() {
  check(
    process.env.HELM_EXPT_ALLOW_LIVE_KPS_LIFECYCLE_PROOF === "1",
    "set HELM_EXPT_ALLOW_LIVE_KPS_LIFECYCLE_PROOF=1 to confirm this live proof",
  );
  for (const [tool, args] of [
    ["helm", ["version", "--short"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
  ]) {
    check(command(tool, args).ok, `${tool} is required for this proof`);
  }

  const sourceLock = readYaml(sourceLockPath);
  check(sourceLock.spec?.chart === "kube-prometheus-stack", "source lock chart changed");
  check(sourceLock.spec?.version === chartVersion, "source lock version changed");
  const expectedPackageSha = sourceLock.spec?.packageSHA256;
  check(/^[a-f0-9]{64}$/.test(expectedPackageSha ?? ""), "source lock package digest is missing");

  const recordedAt = new Date().toISOString();
  const runId = recordedAt
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)
    .toLowerCase();
  const clusterName = `hx-kps-route-${runId}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-kps-route-"));
  const kubeconfig = join(workRoot, "kubeconfig");
  const chartArchive = join(workRoot, `kube-prometheus-stack-${chartVersion}.tgz`);
  const crdsPath = join(workRoot, "crds.yaml");
  const hookSupportPath = join(workRoot, "hook-support.yaml");
  const createJobPath = join(workRoot, "admission-create-job.yaml");
  const patchJobPath = join(workRoot, "admission-patch-job.yaml");
  const cleanup = {
    cluster: "not-created",
    localFiles: "pending",
  };
  let clusterCreated = false;
  let receipt;

  try {
    phase("pulling the locked chart");
    must(
      "helm",
      [
        "pull",
        chart,
        "--version",
        chartVersion,
        "--destination",
        workRoot,
      ],
      { timeout: 180_000 },
    );
    check(existsSync(chartArchive), "helm pull did not produce the expected chart archive");
    check(
      sha256File(chartArchive) === expectedPackageSha,
      "the pulled chart archive does not match source-lock.yaml",
    );
    check(
      statSync(chartArchive).size === Number(sourceLock.spec.packageBytes),
      "the pulled chart archive byte count does not match source-lock.yaml",
    );

    phase("rendering ordinary objects and Helm hook resources");
    const rendered = must(
      "helm",
      [
        "template",
        releaseName,
        chartArchive,
        "--namespace",
        namespace,
        "--include-crds",
        "--skip-tests",
        "--set",
        "grafana.adminPassword=confighub-grafana-admin-password",
      ],
      { timeout: 180_000, maxBuffer: 256 * 1024 * 1024 },
    ).stdout;
    const docs = parseDocs(rendered);
    const hookDocs = docs.filter(isHook);
    const ordinaryDocs = docs.filter((doc) => !isHook(doc));
    const crdDocs = ordinaryDocs.filter(
      (doc) => doc.kind === "CustomResourceDefinition",
    );
    const createJobs = hookDocs.filter(
      (doc) => doc.kind === "Job" && doc.metadata?.name === createJobName,
    );
    const patchJobs = hookDocs.filter(
      (doc) => doc.kind === "Job" && doc.metadata?.name === patchJobName,
    );
    const supportDocs = hookDocs.filter((doc) => doc.kind !== "Job");

    check(docs.length === 131, `expected 131 rendered objects, found ${docs.length}`);
    check(
      ordinaryDocs.length === 124,
      `expected 124 ordinary objects, found ${ordinaryDocs.length}`,
    );
    check(hookDocs.length === 7, `expected seven hook objects, found ${hookDocs.length}`);
    check(crdDocs.length === 10, `expected ten CRDs, found ${crdDocs.length}`);
    check(createJobs.length === 1, "expected one admission-create Job");
    check(patchJobs.length === 1, "expected one admission-patch Job");
    check(supportDocs.length === 5, "expected five hook support objects");

    const ordinaryYaml = yamlDocuments(ordinaryDocs);
    const committedYaml = readFileSync(renderedObjectsPath, "utf8");
    const semantic = canonicalObjectMaps(ordinaryYaml, committedYaml);
    const semanticKeys = new Set([
      ...Object.keys(semantic.helm),
      ...Object.keys(semantic.cub),
    ]);
    const semanticDiffs = [...semanticKeys].filter(
      (key) => semantic.helm[key] !== semantic.cub[key],
    );
    check(
      semanticDiffs.length === 0,
      `the live render differs from the 124 committed objects: ${semanticDiffs.slice(0, 3).join(", ")}`,
    );

    writeFileSync(crdsPath, `${yamlDocuments(crdDocs)}\n`);
    writeFileSync(hookSupportPath, `${yamlDocuments(supportDocs)}\n`);
    writeFileSync(createJobPath, `${yamlDocuments(createJobs)}\n`);
    writeFileSync(patchJobPath, `${yamlDocuments(patchJobs)}\n`);

    phase("creating a throwaway kind cluster");
    must(
      "kind",
      [
        "create",
        "cluster",
        "--name",
        clusterName,
        "--kubeconfig",
        kubeconfig,
        "--wait",
        "180s",
      ],
      { timeout: 300_000 },
    );
    clusterCreated = true;
    cleanup.cluster = "pending";

    kubectl(kubeconfig, [
      "create",
      "namespace",
      namespace,
      "--dry-run=client",
      "-o",
      "yaml",
    ], { pipeToKubectlApply: true });

    phase("applying ten CRDs and waiting for Established");
    kubectlApply(kubeconfig, crdsPath);
    const crdNames = crdDocs.map((doc) => doc.metadata.name).sort();
    for (const crdName of crdNames) {
      kubectl(kubeconfig, [
        "wait",
        "--for=condition=Established",
        `crd/${crdName}`,
        "--timeout=180s",
      ]);
    }

    phase("running the chart's pre-install certificate Job");
    kubectlApply(kubeconfig, hookSupportPath);
    kubectlApply(kubeconfig, createJobPath);
    kubectl(kubeconfig, [
      "-n",
      namespace,
      "wait",
      "--for=condition=complete",
      `job/${createJobName}`,
      "--timeout=300s",
    ]);
    const secret = kubectlJson(kubeconfig, [
      "-n",
      namespace,
      "get",
      "secret",
      admissionSecretName,
      "-o",
      "json",
    ]);
    const secretKeys = Object.keys(secret.data ?? {}).sort();
    check(
      sameSet(secretKeys, ["ca", "cert", "key"]),
      `the admission Secret has unexpected keys: ${secretKeys.join(", ")}`,
    );

    phase("applying the 124 ordinary rendered objects");
    kubectlApply(kubeconfig, renderedObjectsPath);
    waitForWorkload(kubeconfig, "deployment", operatorDeployment);

    phase("running the chart's post-install webhook patch Job");
    kubectlApply(kubeconfig, patchJobPath);
    kubectl(kubeconfig, [
      "-n",
      namespace,
      "wait",
      "--for=condition=complete",
      `job/${patchJobName}`,
      "--timeout=300s",
    ]);

    const mutatingWebhook = kubectlJson(kubeconfig, [
      "get",
      "mutatingwebhookconfiguration",
      admissionSecretName,
      "-o",
      "json",
    ]);
    const validatingWebhook = kubectlJson(kubeconfig, [
      "get",
      "validatingwebhookconfiguration",
      admissionSecretName,
      "-o",
      "json",
    ]);
    const caBundles = [
      ...(mutatingWebhook.webhooks ?? []),
      ...(validatingWebhook.webhooks ?? []),
    ].map((webhook) => webhook.clientConfig?.caBundle ?? "");
    check(caBundles.length === 3, `expected three webhook entries, found ${caBundles.length}`);
    check(caBundles.every(Boolean), "one or more webhook CA bundles are empty");
    check(
      caBundles.every((bundle) => bundle === secret.data.ca),
      "the webhook CA bundle does not match the admission Secret",
    );

    const endpoints = kubectlJson(kubeconfig, [
      "-n",
      namespace,
      "get",
      "endpoints",
      operatorDeployment,
      "-o",
      "json",
    ]);
    const endpointAddresses = (endpoints.subsets ?? [])
      .flatMap((subset) => subset.addresses ?? [])
      .map((address) => address.ip)
      .filter(Boolean);
    check(endpointAddresses.length > 0, "the operator webhook Service has no ready endpoint");

    const dryRunRule = `apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: lifecycle-route-probe
  namespace: ${namespace}
spec:
  groups:
    - name: lifecycle-route-probe
      rules:
        - alert: LifecycleRouteProbe
          expr: vector(1)
`;
    kubectl(kubeconfig, [
      "apply",
      "--server-side",
      "--dry-run=server",
      "-f",
      "-",
    ], { input: dryRunRule });

    const workloadResults = [];
    for (const workload of [
      ["daemonset", "kube-prometheus-stack-prometheus-node-exporter"],
      ["deployment", "kube-prometheus-stack-grafana"],
      ["deployment", "kube-prometheus-stack-kube-state-metrics"],
      ["deployment", operatorDeployment],
      ["statefulset", "alertmanager-kube-prometheus-stack-alertmanager"],
      ["statefulset", "prometheus-kube-prometheus-stack-prometheus"],
    ]) {
      waitForWorkload(kubeconfig, workload[0], workload[1]);
      workloadResults.push({
        kind: workload[0],
        name: workload[1],
        namespace,
        result: "pass",
      });
    }

    phase("applying the chart's hook cleanup policy");
    kubectl(kubeconfig, [
      "-n",
      namespace,
      "delete",
      "job",
      createJobName,
      patchJobName,
      "--ignore-not-found",
      "--wait=true",
    ]);
    kubectl(kubeconfig, [
      "delete",
      "-f",
      hookSupportPath,
      "--ignore-not-found",
      "--wait=true",
    ]);
    check(
      !kubectlTry(kubeconfig, [
        "-n",
        namespace,
        "get",
        "job",
        createJobName,
      ]).ok
        && !kubectlTry(kubeconfig, [
          "-n",
          namespace,
          "get",
          "job",
          patchJobName,
        ]).ok,
      "the successful hook Jobs were not removed",
    );

    const routeResults = {
      "crds-first": directResult(
        "Applied ten CRDs and waited for Established before dependent objects.",
      ),
      "preflight-or-presync": directResult(
        "Ran the chart's admission-create Job and observed the ca, cert, and key Secret.",
      ),
      "target-facts-or-preflight": directResult(
        "Created the chart-required admission Secret through the recorded pre-install Job.",
      ),
      "preserve-ordering": directResult(
        "Executed CRDs, certificate creation, ordinary objects, and webhook patching in order.",
      ),
      "postsync-check-or-observation": directResult(
        "Ran the chart's admission-patch Job after the webhook objects existed.",
      ),
      "webhook-readiness-observation": directResult(
        "Observed three matching CA bundles, a ready operator endpoint, and a successful server dry-run.",
      ),
      "preserve-cleanup-policy": directResult(
        "Removed the successful hook Jobs and their temporary RBAC support objects.",
      ),
      "upgrade-action-with-receipt": {
        result: "not-run",
        automatic: false,
        reason: "This receipt covers a fresh install only; chart upgrade behavior remains unproved.",
      },
    };

    receipt = {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "KubePrometheusStackLifecycleRouteReceipt",
      metadata: {
        name: `kube-prometheus-stack-${chartVersion}-default-direct-install`,
      },
      spec: {
        chart,
        version: chartVersion,
        base: "default",
        deliveryPath: "direct-apply",
        recordedAt,
        result: "pass",
        source: {
          sourceLock: relativeRepo(sourceLockPath),
          chartPackageSha256: expectedPackageSha,
          chartPackageBytes: Number(sourceLock.spec.packageBytes),
          renderedObjects: relativeRepo(renderedObjectsPath),
        },
        render: {
          totalObjectsWithHooks: docs.length,
          ordinaryObjects: ordinaryDocs.length,
          hookObjects: hookDocs.length,
          crds: crdDocs.length,
          exactCommittedOrdinaryObjects: true,
          committedObjectSetSha256: sha256(committedYaml),
        },
        execution: {
          clusterType: "kind",
          clusterName,
          namespace,
          crds: {
            names: crdNames,
            established: crdNames.length,
            result: "pass",
          },
          hookSupportObjects: supportDocs.map(objectIdentity).sort(),
          preInstallJob: {
            name: createJobName,
            image: createJobs[0].spec?.template?.spec?.containers?.[0]?.image,
            result: "pass",
          },
          admissionSecret: {
            name: admissionSecretName,
            namespace,
            keys: secretKeys,
            result: "pass",
          },
          ordinaryApply: {
            objectCount: ordinaryDocs.length,
            result: "pass",
          },
          postInstallJob: {
            name: patchJobName,
            image: patchJobs[0].spec?.template?.spec?.containers?.[0]?.image,
            result: "pass",
          },
          webhookObservation: {
            mutatingEntries: (mutatingWebhook.webhooks ?? []).length,
            validatingEntries: (validatingWebhook.webhooks ?? []).length,
            caBundlesPresent: caBundles.length,
            caBundlesMatchSecret: true,
            readyEndpointAddresses: endpointAddresses.length,
            serverDryRun: "pass",
            result: "pass",
          },
          workloads: workloadResults,
          hookCleanup: {
            jobsDeleted: [createJobName, patchJobName],
            supportObjectsDeleted: supportDocs.map(objectIdentity).sort(),
            result: "pass",
          },
        },
        routes: routeResults,
        cleanup,
        limits: [
          "This receipt covers one fresh direct-apply installation on one local kind cluster.",
          "It does not prove the Argo CD or Flux implementation of these chart-specific routes.",
          "It does not prove the 85.3.3 to 86.1.0 upgrade route.",
          "The chart's own hook Jobs were rendered from the locked upstream chart and run explicitly; ConfigHub did not choose the route automatically.",
        ],
      },
    };
  } finally {
    if (clusterCreated) {
      const deleted = command(
        "kind",
        ["delete", "cluster", "--name", clusterName],
        { timeout: 240_000 },
      );
      cleanup.cluster = deleted.ok ? "pass" : "failed";
    }
    rmSync(workRoot, { recursive: true, force: true });
    cleanup.localFiles = "pass";
  }

  check(receipt, "the lifecycle route proof did not produce a receipt");
  check(cleanup.cluster === "pass", "the kind cluster cleanup did not pass");
  receipt.spec.cleanup = cleanup;
  verifyReceipt(receipt);
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(receiptPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "KubePrometheusStackLifecycleRouteReceipt",
    "lifecycle receipt kind changed",
  );
  const spec = receipt.spec;
  check(
    spec?.chart === chart
      && spec?.version === chartVersion
      && spec?.base === "default",
    "lifecycle receipt source changed",
  );
  check(
    spec.deliveryPath === "direct-apply" && spec.result === "pass",
    "the direct lifecycle route did not pass",
  );
  check(
    spec.source?.chartPackageSha256
      === readYaml(sourceLockPath).spec?.packageSHA256,
    "lifecycle receipt chart digest differs from source-lock.yaml",
  );
  check(
    spec.render?.ordinaryObjects === 124
      && spec.render?.hookObjects === 7
      && spec.render?.crds === 10
      && spec.render?.exactCommittedOrdinaryObjects === true,
    "lifecycle receipt render counts or parity changed",
  );
  check(
    spec.execution?.crds?.established === 10
      && spec.execution?.crds?.result === "pass",
    "ten established CRDs were not recorded",
  );
  check(
    sameSet(
      spec.execution?.admissionSecret?.keys ?? [],
      ["ca", "cert", "key"],
    )
      && spec.execution?.admissionSecret?.result === "pass",
    "the admission Secret evidence is incomplete",
  );
  check(
    spec.execution?.preInstallJob?.result === "pass"
      && spec.execution?.postInstallJob?.result === "pass"
      && spec.execution?.hookCleanup?.result === "pass",
    "the hook create, patch, or cleanup result did not pass",
  );
  check(
    spec.execution?.webhookObservation?.caBundlesPresent === 3
      && spec.execution?.webhookObservation?.caBundlesMatchSecret === true
      && spec.execution?.webhookObservation?.readyEndpointAddresses > 0
      && spec.execution?.webhookObservation?.serverDryRun === "pass",
    "the webhook readiness evidence is incomplete",
  );
  check(
    (spec.execution?.workloads ?? []).length === 6
      && spec.execution.workloads.every((item) => item.result === "pass"),
    "the six workload checks did not pass",
  );
  const routes = spec.routes ?? {};
  const expectedRoutes = [
    "crds-first",
    "preflight-or-presync",
    "target-facts-or-preflight",
    "preserve-ordering",
    "postsync-check-or-observation",
    "webhook-readiness-observation",
    "preserve-cleanup-policy",
    "upgrade-action-with-receipt",
  ];
  check(
    sameSet(Object.keys(routes), expectedRoutes),
    "lifecycle receipt route set changed",
  );
  for (const routeName of expectedRoutes.slice(0, -1)) {
    check(
      routes[routeName]?.result === "pass"
        && routes[routeName]?.automatic === true,
      `${routeName} is not recorded as a passing direct implementation`,
    );
  }
  check(
    routes["upgrade-action-with-receipt"]?.result === "not-run"
      && routes["upgrade-action-with-receipt"]?.automatic === false,
    "the unproved upgrade route must remain not-run",
  );
  check(
    spec.cleanup?.cluster === "pass"
      && spec.cleanup?.localFiles === "pass",
    "lifecycle proof cleanup did not pass",
  );
  check(
    (spec.limits ?? []).some((item) => item.includes("does not prove the Argo CD or Flux")),
    "the controller-delivery limit is missing",
  );
  check(
    (spec.limits ?? []).some((item) => item.includes("does not prove the 85.3.3 to 86.1.0 upgrade")),
    "the upgrade limit is missing",
  );
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  const routeRows = Object.entries(spec.routes)
    .map(([name, route]) => `| \`${name}\` | ${route.result} | ${route.automatic ? "yes, in the direct script" : "no"} | ${route.observation ?? route.reason} |`)
    .join("\n");
  const workloadRows = spec.execution.workloads
    .map((item) => `| ${item.kind} | \`${item.name}\` | ${item.result} |`)
    .join("\n");
  return `# Kube Prometheus Stack lifecycle route proof

This example runs the extra work that regular Helm normally performs around kube-prometheus-stack 85.3.3. It uses the locked upstream chart, the committed \`default\` render, and one throwaway kind cluster.

The run rendered 124 ordinary Kubernetes objects and seven Helm hook objects. The 124 ordinary objects matched the committed catalog render exactly. The script then:

1. applied ten CRDs and waited for each one to become Established;
2. ran the chart's admission certificate creation Job;
3. checked that the resulting Secret contained \`ca\`, \`cert\`, and \`key\`;
4. applied the 124 ordinary objects;
5. ran the chart's webhook patch Job;
6. checked all three webhook CA bundles, the operator endpoint, a server dry-run, and six workloads;
7. removed the successful hook Jobs and their temporary RBAC objects.

Overall result: **${spec.result}**.

## Route results

| Route | Direct result | Automatic | What happened |
| --- | --- | --- | --- |
${routeRows}

## Workloads

| Kind | Name | Result |
| --- | --- | --- |
${workloadRows}

## What this proves

The direct script can perform the fresh-install lifecycle for this chart and version in the recorded order. It uses the chart's own certificate and patch Jobs rather than inventing a generic replacement. The ordinary manifest set remains the checked catalog render.

## What remains

${spec.limits.map((item) => `- ${item}`).join("\n")}

Receipt: [\`${relativeRepo(receiptPath)}\`](../../${relativeRepo(receiptPath)}).
`;
}

function directResult(observation) {
  return {
    result: "pass",
    automatic: true,
    executor: "scripts/run-kps-lifecycle-route-proof.mjs",
    observation,
  };
}

function isHook(doc) {
  return Boolean(doc.metadata?.annotations?.["helm.sh/hook"]);
}

function yamlDocuments(docs) {
  return docs.map((doc) => toYaml(doc)).join("\n---\n");
}

function objectIdentity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function sameSet(left, right) {
  return left.length === right.length
    && left.every((item) => right.includes(item));
}

function command(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    input: options.input,
    timeout: options.timeout ?? 120_000,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function must(file, args, options = {}) {
  const result = command(file, args, options);
  check(
    result.ok,
    `${file} ${args.join(" ")} failed: ${sanitizedMessage(result)}`,
  );
  return result;
}

function kubectl(kubeconfig, args, options = {}) {
  if (options.pipeToKubectlApply) {
    const generated = must(
      "kubectl",
      ["--kubeconfig", kubeconfig, ...args],
      options,
    );
    return must(
      "kubectl",
      ["--kubeconfig", kubeconfig, "apply", "-f", "-"],
      { ...options, input: generated.stdout },
    );
  }
  return must(
    "kubectl",
    ["--kubeconfig", kubeconfig, ...args],
    options,
  );
}

function kubectlTry(kubeconfig, args, options = {}) {
  return command(
    "kubectl",
    ["--kubeconfig", kubeconfig, ...args],
    options,
  );
}

function kubectlApply(kubeconfig, path) {
  return kubectl(kubeconfig, [
    "apply",
    "--server-side",
    "--force-conflicts",
    "-f",
    path,
  ], { timeout: 300_000 });
}

function kubectlJson(kubeconfig, args) {
  const result = kubectl(kubeconfig, args);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`kubectl did not return JSON for ${args.join(" ")}`);
  }
}

function waitForWorkload(kubeconfig, kind, name) {
  kubectl(kubeconfig, [
    "-n",
    namespace,
    "wait",
    "--for=create",
    `${kind}/${name}`,
    "--timeout=300s",
  ], { timeout: 330_000 });
  kubectl(kubeconfig, [
    "-n",
    namespace,
    "rollout",
    "status",
    `${kind}/${name}`,
    "--timeout=300s",
  ], { timeout: 330_000 });
}

function sanitizedMessage(result) {
  return `${result.stderr || result.stdout || `exit ${result.status}`}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function phase(message) {
  console.log(`\n[kps lifecycle] ${message}`);
}
