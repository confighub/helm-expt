#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
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
if (!["--run", "--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-kps-lifecycle-route-proof.mjs --run --base default
  node scripts/run-kps-lifecycle-route-proof.mjs --run --base no-crds
  node scripts/run-kps-lifecycle-route-proof.mjs --generate
  node scripts/run-kps-lifecycle-route-proof.mjs --verify`);
  process.exit(2);
}

const chart = "prometheus-community/kube-prometheus-stack";
const chartVersion = "85.3.3";
const bases = ["default", "no-crds"];
const requestedBase = argumentValue("--base") || "default";
check(
  bases.includes(requestedBase),
  `--base must be one of: ${bases.join(", ")}`,
);
const namespace = "monitoring";
const sourceLockPath = join(
  repoRoot,
  "recipes",
  "prometheus-community",
  "kube-prometheus-stack",
  chartVersion,
  "source-lock.yaml",
);
const packageRoot = join(
  repoRoot,
  "packages",
  "prometheus-community",
  "kube-prometheus-stack",
  chartVersion,
);
const packagedLifecycleRelative = join(
  "prerequisites",
  "kube-prometheus-stack-lifecycle",
);
const packagedLifecycleRoot = join(packageRoot, packagedLifecycleRelative);
const packagedGenerationReceiptPath = join(
  packagedLifecycleRoot,
  "generation-receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "kps-lifecycle-route-proof",
  "summary.md",
);
const gitOpsLifecycleReceiptPath = join(
  repoRoot,
  "runs",
  "kps-gitops-lifecycle-proof",
  "receipt.yaml",
);
const defaultUpgradeReceiptPath = join(
  repoRoot,
  "runs",
  "kps-default-package-upgrade-proof",
  "receipt.yaml",
);
const createJobName = "kube-prometheus-stack-admission-create";
const patchJobName = "kube-prometheus-stack-admission-patch";
const admissionSecretName = "kube-prometheus-stack-admission";
const operatorDeployment = "kube-prometheus-stack-operator";

if (mode === "--run") {
  run(requestedBase);
} else if (mode === "--generate") {
  const receipts = readAndVerifyReceipts();
  writeRouteReceipts(receipts);
  write(summaryPath, renderSummary(receipts));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  const receipts = readAndVerifyReceipts();
  check(
    existsSync(summaryPath),
    `${relativeRepo(summaryPath)} is missing; run the generator`,
  );
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipts),
    `${relativeRepo(summaryPath)} is stale`,
  );
  verifyRouteReceipts(receipts);
  console.log("verified the kube-prometheus-stack lifecycle route proof");
}

function run(base) {
  check(
    process.env.HELM_EXPT_ALLOW_LIVE_KPS_LIFECYCLE_PROOF === "1",
    "set HELM_EXPT_ALLOW_LIVE_KPS_LIFECYCLE_PROOF=1 to confirm this live proof",
  );
  for (const [tool, args] of [
    ["cub", ["installer", "version"]],
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
  const installRoot = join(workRoot, "install");
  const lifecycleReceiptPath = join(workRoot, "lifecycle-action-receipt.yaml");
  const renderedObjectsPath = renderedObjectsPathFor(base);
  const receiptPath = receiptPathFor(base);
  const cleanup = {
    cluster: "not-created",
    localFiles: "pending",
  };
  let clusterCreated = false;
  let receipt;

  try {
    phase("rendering the local installer package");
    must(
      "cub",
      [
        "installer",
        "setup",
        "--pull",
        relativeRepo(packageRoot),
        "--base",
        base,
        "--work-dir",
        installRoot,
        "--non-interactive",
        "--namespace",
        namespace,
      ],
      { timeout: 300_000, maxBuffer: 256 * 1024 * 1024 },
    );

    const copiedPackageRoot = join(installRoot, "package");
    const copiedLifecycleRoot = join(
      copiedPackageRoot,
      packagedLifecycleRelative,
    );
    const crdsPath = join(copiedLifecycleRoot, "default-crds.yaml");
    const hookSupportPath = join(copiedLifecycleRoot, "hook-support.yaml");
    const createJobPath = join(copiedLifecycleRoot, "admission-create-job.yaml");
    const patchJobPath = join(copiedLifecycleRoot, "admission-patch-job.yaml");
    const preparePath = join(copiedLifecycleRoot, "prepare.sh");
    const finishPath = join(copiedLifecycleRoot, "finish.sh");
    for (const path of [
      crdsPath,
      hookSupportPath,
      createJobPath,
      patchJobPath,
      preparePath,
      finishPath,
    ]) {
      check(existsSync(path), `the rendered package is missing ${path}`);
    }

    const generationReceipt = readYaml(packagedGenerationReceiptPath);
    check(
      generationReceipt.spec?.chartPackageSha256 === expectedPackageSha,
      "the packaged lifecycle files do not match source-lock.yaml",
    );

    const renderedDocs = [
      ...readYamlDocuments(join(installRoot, "out", "manifests")),
      ...readYamlDocuments(join(installRoot, "out", "secrets")),
    ];
    const ordinaryDocs = renderedDocs.filter(
      (doc) => objectIdentity(doc) !== "v1|Namespace||monitoring",
    );
    const supportObjects = renderedDocs.filter(
      (doc) => objectIdentity(doc) === "v1|Namespace||monitoring",
    );
    const crdDocs = parseDocs(readFileSync(crdsPath, "utf8"));
    const supportDocs = parseDocs(readFileSync(hookSupportPath, "utf8"));
    const createJobs = parseDocs(readFileSync(createJobPath, "utf8"));
    const patchJobs = parseDocs(readFileSync(patchJobPath, "utf8"));
    const hookDocs = [...supportDocs, ...createJobs, ...patchJobs];

    const committedYaml = readFileSync(renderedObjectsPath, "utf8");
    const expectedOrdinaryObjects = parseDocs(committedYaml).length;
    check(
      renderedDocs.length === expectedOrdinaryObjects + 1,
      `expected ${expectedOrdinaryObjects + 1} package output objects, found ${renderedDocs.length}`,
    );
    check(
      ordinaryDocs.length === expectedOrdinaryObjects,
      `expected ${expectedOrdinaryObjects} chart objects, found ${ordinaryDocs.length}`,
    );
    check(supportObjects.length === 1, "expected one package-created Namespace");
    check(hookDocs.length === 7, `expected seven hook objects, found ${hookDocs.length}`);
    check(crdDocs.length === 10, `expected ten CRDs, found ${crdDocs.length}`);
    check(createJobs.length === 1, "expected one admission-create Job");
    check(patchJobs.length === 1, "expected one admission-patch Job");
    check(supportDocs.length === 5, "expected five hook support objects");

    const ordinaryYaml = yamlDocuments(ordinaryDocs);
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
      `the package output differs from the 124 committed objects: ${semanticDiffs.slice(0, 3).join(", ")}`,
    );

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

    phase("running the package's pre-install certificate step");
    must("bash", [preparePath, namespace], {
      timeout: 360_000,
      env: { KUBECONFIG: kubeconfig },
    });
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

    phase("applying the package's rendered Secrets and manifests");
    const secretsRoot = join(installRoot, "out", "secrets");
    if (existsSync(secretsRoot)) kubectlApply(kubeconfig, secretsRoot);
    kubectlApply(kubeconfig, join(installRoot, "out", "manifests"));
    waitForWorkload(kubeconfig, "deployment", operatorDeployment);

    phase("running the package's post-install webhook step");
    must("bash", [finishPath, namespace], {
      timeout: 420_000,
      env: {
        KUBECONFIG: kubeconfig,
        HELM_EXPT_LIFECYCLE_RECEIPT: lifecycleReceiptPath,
        KPS_LIFECYCLE_BASE: base,
      },
    });
    const lifecycleReceipt = readYaml(lifecycleReceiptPath);
    check(
      lifecycleReceipt.spec?.result === "pass"
        && lifecycleReceipt.spec?.base === base
        && lifecycleReceipt.spec?.matchingWebhookCABundles === 3
        && lifecycleReceipt.spec?.operatorEndpointReady === true
        && lifecycleReceipt.spec?.serverDryRun === "pass",
      "the packaged lifecycle script did not write a complete passing receipt",
    );

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

    phase("checking the package's hook cleanup");
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
        name: `kube-prometheus-stack-${chartVersion}-${base}-package-install`,
      },
      spec: {
        chart,
        version: chartVersion,
        base,
        deliveryPath: "cub-installer-package-direct-apply",
        recordedAt,
        result: "pass",
        source: {
          sourceLock: relativeRepo(sourceLockPath),
          chartPackageSha256: expectedPackageSha,
          chartPackageBytes: Number(sourceLock.spec.packageBytes),
          installerPackage: relativeRepo(packageRoot),
          installerYamlSha256: sha256File(join(packageRoot, "installer.yaml")),
          packagedLifecycleGenerationReceipt: relativeRepo(
            packagedGenerationReceiptPath,
          ),
          packagedLifecycleGenerationReceiptSha256: sha256File(
            packagedGenerationReceiptPath,
          ),
          renderedObjects: relativeRepo(renderedObjectsPath),
        },
        render: {
          packageOutputObjects: renderedDocs.length,
          ordinaryObjects: ordinaryDocs.length,
          hookObjects: hookDocs.length,
          crds: crdDocs.length,
          supportObjects: supportObjects.map(objectIdentity),
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
          packagedLifecycleReceipt: lifecycleReceipt.spec,
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
          "This receipt covers one fresh installer-package installation on one local kind cluster.",
          "It does not prove the Argo CD or Flux implementation of these chart-specific routes.",
          "It does not prove the 85.3.3 to 86.1.0 upgrade route.",
          "The package carries chart-specific lifecycle steps and the direct runner executes them explicitly; ConfigHub does not yet choose this route automatically.",
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
  console.log(`wrote ${relativeRepo(receiptPath)}`);
  if (bases.every((name) => existsSync(receiptPathFor(name)))) {
    const receipts = readAndVerifyReceipts();
    writeRouteReceipts(receipts);
    write(summaryPath, renderSummary(receipts));
    console.log(`wrote ${relativeRepo(summaryPath)}`);
  }
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "KubePrometheusStackLifecycleRouteReceipt",
    "lifecycle receipt kind changed",
  );
  const spec = receipt.spec;
  const base = spec?.base;
  check(
    spec?.chart === chart
      && spec?.version === chartVersion
      && bases.includes(base),
    "lifecycle receipt source changed",
  );
  const renderedObjectsPath = renderedObjectsPathFor(base);
  const committedYaml = readFileSync(renderedObjectsPath, "utf8");
  const expectedOrdinaryObjects = parseDocs(committedYaml).length;
  check(
    spec.deliveryPath === "cub-installer-package-direct-apply"
      && spec.result === "pass",
    "the installer-package lifecycle route did not pass",
  );
  check(
    spec.source?.chartPackageSha256
      === readYaml(sourceLockPath).spec?.packageSHA256,
    "lifecycle receipt chart digest differs from source-lock.yaml",
  );
  check(
    spec.render?.packageOutputObjects === expectedOrdinaryObjects + 1
      && spec.render?.ordinaryObjects === expectedOrdinaryObjects
      && spec.render?.hookObjects === 7
      && spec.render?.crds === 10
      && sameSet(
        spec.render?.supportObjects ?? [],
        ["v1|Namespace||monitoring"],
      )
      && spec.render?.exactCommittedOrdinaryObjects === true
      && spec.render?.committedObjectSetSha256 === sha256(committedYaml),
    "installer-package render counts or parity changed",
  );
  check(
    spec.source?.installerPackage === relativeRepo(packageRoot)
      && spec.source?.installerYamlSha256
        === sha256File(join(packageRoot, "installer.yaml"))
      && spec.source?.packagedLifecycleGenerationReceipt
        === relativeRepo(packagedGenerationReceiptPath)
      && spec.source?.packagedLifecycleGenerationReceiptSha256
        === sha256File(packagedGenerationReceiptPath)
      && spec.source?.renderedObjects === relativeRepo(renderedObjectsPath),
    "the recorded installer package or lifecycle generation receipt changed",
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
      && spec.execution?.preInstallJob?.image?.includes("@sha256:")
      && spec.execution?.postInstallJob?.image?.includes("@sha256:")
      && spec.execution?.hookCleanup?.result === "pass",
    "the hook create, patch, or cleanup result did not pass",
  );
  check(
    spec.execution?.packagedLifecycleReceipt?.result === "pass"
      && spec.execution?.packagedLifecycleReceipt?.base === base
      && spec.execution?.packagedLifecycleReceipt?.matchingWebhookCABundles === 3
      && spec.execution?.packagedLifecycleReceipt?.operatorEndpointReady === true
      && spec.execution?.packagedLifecycleReceipt?.serverDryRun === "pass"
      && spec.execution?.packagedLifecycleReceipt?.temporaryResourcesRemoved === true,
    "the receipt written by the packaged lifecycle script is incomplete",
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

function renderSummary(receipts) {
  const resultRows = receipts
    .map((receipt) => {
      const spec = receipt.spec;
      const upgrade = aggregateUpgradeRoute(receipt);
      return `| \`${spec.base}\` | ${spec.render.ordinaryObjects} | ${spec.execution.crds.established} | ${spec.execution.workloads.length} | ${upgrade.result} | ${spec.result} | [receipt](../../${relativeRepo(receiptPathFor(spec.base))}) |`;
    })
    .join("\n");
  const sections = receipts
    .map((receipt) => renderReceiptSection(receipt))
    .join("\n");
  return `# Kube Prometheus Stack lifecycle route proof

These tests install kube-prometheus-stack 85.3.3 from its local \`cub installer\` package. The package contains the checked Kubernetes objects plus the CRDs and admission-webhook work that regular Helm runs around them.

Both catalog bases were tested on new kind clusters. Each package output matched its committed catalog render. The runner then applied ten CRDs, created the admission certificate, applied the workload, patched the webhooks, checked the running system, and removed the temporary Jobs and RBAC objects.

The upgrade routes are separate tests. The \`default\` package moved from 85.3.3 to 86.1.0 through the direct package route. The \`no-crds\` package moved through the four-stage Argo CD and Flux route. [Open the detailed default-package upgrade result](../kps-default-package-upgrade-proof/summary.md).

| Base | Checked chart objects | Established CRDs | Ready workloads | Upgrade route | Fresh install | Evidence |
| --- | ---: | ---: | ---: | --- | --- | --- |
${resultRows}

## What this proves

The package can perform this chart's fresh-install work in the recorded order for both catalog bases. It uses the chart's own certificate and patch Jobs. The checked manifest set is unchanged. The two upgrade receipts show the same CRD, certificate, workload, webhook, runtime, and cleanup order for the named version pair.

## What remains

- The \`default\` upgrade has not been repeated through Argo CD or Flux.
- Rollback and long-running checks remain separate work.
- ConfigHub records the route but does not yet choose and execute it automatically.

${sections}`;
}

function renderReceiptSection(receipt) {
  const spec = receipt.spec;
  const routes = {
    ...spec.routes,
    "upgrade-action-with-receipt": aggregateUpgradeRoute(receipt),
  };
  const routeRows = Object.entries(routes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, route]) => `| \`${name}\` | ${route.result} | ${route.automatic ? "yes, in the direct script" : "no"} | ${route.observation ?? route.reason} |`)
    .join("\n");
  const workloadRows = spec.execution.workloads
    .map((item) => `| ${item.kind} | \`${item.name}\` | ${item.result} |`)
    .join("\n");
  return `## ${spec.base}

| Route | Direct result | Automatic | What happened |
| --- | --- | --- | --- |
${routeRows}

| Workload kind | Name | Result |
| --- | --- | --- |
${workloadRows}

Receipt: [\`${relativeRepo(receiptPathFor(spec.base))}\`](../../${relativeRepo(receiptPathFor(spec.base))}).
`;
}

function readAndVerifyReceipts() {
  return bases.map((base) => {
    const path = receiptPathFor(base);
    check(
      existsSync(path),
      `${relativeRepo(path)} is missing; run the live proof for --base ${base}`,
    );
    const receipt = readYaml(path);
    verifyReceipt(receipt);
    return receipt;
  });
}

function writeRouteReceipts(receipts) {
  for (const receipt of receipts) {
    writeYaml(routeReceiptPathFor(receipt.spec.base), routeReceiptFromRun(receipt));
  }
}

function verifyRouteReceipts(receipts) {
  for (const receipt of receipts) {
    const path = routeReceiptPathFor(receipt.spec.base);
    check(existsSync(path), `${relativeRepo(path)} is missing`);
    const expected = `${toYaml(routeReceiptFromRun(receipt))}\n`;
    check(
      readFileSync(path, "utf8") === expected,
      `${relativeRepo(path)} is stale`,
    );
  }
}

function routeReceiptFromRun(receipt) {
  const spec = receipt.spec;
  const runReceipt = relativeRepo(receiptPathFor(spec.base));
  const gitOpsReceipt = spec.base === "no-crds"
    && existsSync(gitOpsLifecycleReceiptPath)
    ? readYaml(gitOpsLifecycleReceiptPath)
    : null;
  const hasGitOpsUpgradeProof = gitOpsReceipt?.spec?.result === "pass"
    && gitOpsReceipt?.spec?.version === chartVersion
    && gitOpsReceipt?.spec?.upgradeVersion === "86.1.0"
    && ["argo", "flux"].every((controller) =>
      gitOpsReceipt?.spec?.controllers?.[controller]?.upgrade?.result === "pass");
  const defaultUpgradeReceipt = spec.base === "default"
    && existsSync(defaultUpgradeReceiptPath)
    ? readYaml(defaultUpgradeReceiptPath)
    : null;
  const hasDefaultUpgradeProof = defaultUpgradeReceipt?.kind
      === "KubePrometheusStackDefaultPackageUpgradeReceipt"
    && defaultUpgradeReceipt?.spec?.result === "pass"
    && defaultUpgradeReceipt?.spec?.base === "default"
    && defaultUpgradeReceipt?.spec?.currentVersion === chartVersion
    && defaultUpgradeReceipt?.spec?.candidateVersion === "86.1.0"
    && defaultUpgradeReceipt?.spec?.upgrade?.result === "pass"
    && defaultUpgradeReceipt?.spec?.upgrade?.route?.every((stage) => stage.result === "pass");
  const hasUpgradeProof = hasGitOpsUpgradeProof || hasDefaultUpgradeProof;
  const upgradeObservation = hasGitOpsUpgradeProof
    ? "Argo CD and Flux upgraded the no-crds preset from 85.3.3 to 86.1.0, reran the four ordered stages, replaced both hook Jobs, and passed the runtime checks."
    : "The direct package route upgraded the default preset from 85.3.3 to 86.1.0, established the updated CRDs, retained the admission Secret, reran the webhook step, checked six workloads, and removed the temporary Jobs.";
  const crdReason = spec.base === "default"
    ? "The package applies the locked CRDs before the chart objects that use them."
    : "The no-crds render omits CRDs, so the package applies the locked CRDs before the workload.";
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HookLifecycleRouteReceipt",
    metadata: {
      name: `prometheus-community-kube-prometheus-stack-${spec.base}-hook-route`,
    },
    spec: {
      chart,
      version: chartVersion,
      base: spec.base,
      result: "observed",
      selectedAt: spec.recordedAt.slice(0, 10),
      observedAt: spec.recordedAt,
      route: {
        summary: "The package runs CRD and admission-webhook setup as named steps around the checked Kubernetes objects.",
        phases: [
          observedRoutePhase(
            ["pre-install"],
            "preflight-or-presync-crd-apply",
            crdReason,
          ),
          observedRoutePhase(
            ["pre-install"],
            "preflight-or-presync",
            "The package runs the chart's certificate creation Job before applying the admission webhooks.",
          ),
          observedRoutePhase(
            ["pre-install"],
            "target-facts-or-preflight",
            "The certificate Job creates the required admission Secret with ca, cert, and key.",
          ),
          observedRoutePhase(
            ["pre-install", "post-install"],
            "preserve-ordering",
            "The direct runner applies CRDs, creates the certificate, applies the workload, and patches the webhooks in that order.",
          ),
          observedRoutePhase(
            ["post-install"],
            "postsync-check-or-observation",
            "The package runs the chart's webhook patch Job after the webhook objects exist.",
          ),
          observedRoutePhase(
            ["post-install"],
            "webhook-readiness-observation",
            "The run checks three CA bundles, the operator endpoint, a server dry-run, and six workloads.",
          ),
          observedRoutePhase(
            ["post-install"],
            "preserve-cleanup-policy",
            "The run removes both completed Jobs and their temporary RBAC objects.",
          ),
          hasUpgradeProof
            ? observedRoutePhase(
              ["pre-upgrade", "post-upgrade"],
              "upgrade-action-with-receipt",
              upgradeObservation,
            )
            : {
              hookTypes: ["pre-upgrade", "post-upgrade"],
              action: "upgrade-action-with-receipt",
              reason: "The fresh-install receipt does not test the 85.3.3 to 86.1.0 upgrade.",
              disposition: "todo",
              liveStatus: "not-run",
              executionMode: "not-yet-executable",
              nextAction: "Run the packaged route during an 85.3.3 to 86.1.0 upgrade and record the result.",
            },
        ],
      },
      evidence: [
        {
          path: runReceipt,
          claim: `A fresh ${spec.base} package install ran the CRD, certificate, webhook patch, readiness, and cleanup steps on a new kind cluster.`,
        },
        {
          path: relativeRepo(packagedGenerationReceiptPath),
          claim: "The packaged lifecycle files were extracted from the locked upstream chart and checked by digest.",
        },
        {
          path: relativeRepo(renderedObjectsPathFor(spec.base)),
          claim: "The ordinary package output matched this committed render.",
        },
        ...(hasGitOpsUpgradeProof
          ? [{
            path: relativeRepo(gitOpsLifecycleReceiptPath),
            claim: "Argo CD and Flux installed 85.3.3 and then upgraded to 86.1.0 from exact staged OCI digests, with the chart-specific lifecycle order and runtime checks recorded.",
          }]
          : []),
        ...(hasDefaultUpgradeProof
          ? [{
            path: relativeRepo(defaultUpgradeReceiptPath),
            claim: "The default package ran the explicit 85.3.3 to 86.1.0 upgrade route on kind, retained the admission Secret, and passed the CRD, webhook, workload, and cleanup checks.",
          }]
          : []),
      ],
      execution: {
        helmHooksExecutedByHelm: false,
        chartHookJobsExecutedByDirectRunner: true,
        runtimeObserved: true,
        productChoosesRouteAutomatically: false,
        observedRoute: {
          crdsEstablished: spec.execution.crds.established,
          admissionSecret: spec.execution.admissionSecret.result,
          matchingWebhookCABundles: spec.execution.webhookObservation.caBundlesPresent,
          workloadRollouts: spec.execution.workloads.length,
          hookCleanup: spec.execution.hookCleanup.result,
        },
        notes: [
          "The direct runner executes the package's chart-specific steps; ConfigHub does not yet select this route automatically.",
          ...(hasUpgradeProof
            ? [
              hasGitOpsUpgradeProof
                ? "The controller proof covers this exact no-crds version pair."
                : "The direct proof covers this exact default-package version pair.",
              "The upgrade evidence does not prove rollback, long soak, production, or automatic route selection.",
            ]
            : ["The upgrade and controller-specific paths remain separate proof work."]),
        ],
      },
      remainingWork: hasUpgradeProof
        ? [
          "Make ConfigHub select and run this chart-specific route automatically.",
          ...(hasDefaultUpgradeProof
            ? ["Repeat the default-package upgrade through Argo CD or Flux."]
            : []),
          "Add rollback and longer-running checks before making broader lifecycle claims.",
        ]
        : [
          "Run the same staged lifecycle through Argo CD and Flux.",
          "Test the 85.3.3 to 86.1.0 upgrade and record its cleanup behavior.",
        ],
    },
  };
}

function aggregateUpgradeRoute(receipt) {
  const phase = routeReceiptFromRun(receipt).spec.route.phases.find(
    (item) => item.action === "upgrade-action-with-receipt",
  );
  return phase?.disposition === "observed"
    ? { result: "pass", automatic: false, observation: phase.reason }
    : receipt.spec.routes["upgrade-action-with-receipt"];
}

function observedRoutePhase(hookTypes, action, reason) {
  return {
    hookTypes,
    action,
    reason,
    disposition: "observed",
    liveStatus: "observed",
    executionMode: "user-executes",
  };
}

function renderedObjectsPathFor(base) {
  return join(
    repoRoot,
    "recipes",
    "prometheus-community",
    "kube-prometheus-stack",
    chartVersion,
    "revisions",
    base,
    "r001",
    "rendered",
    "release-objects.yaml",
  );
}

function receiptPathFor(base) {
  return join(
    repoRoot,
    "runs",
    "kps-lifecycle-route-proof",
    base === "default" ? "receipt.yaml" : `${base}-receipt.yaml`,
  );
}

function routeReceiptPathFor(base) {
  return join(
    repoRoot,
    "data",
    "hook-lifecycle",
    "receipts",
    "prometheus-community-kube-prometheus-stack",
    base,
    "latest.yaml",
  );
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  check(process.argv[index + 1], `${name} requires a value`);
  return process.argv[index + 1];
}

function directResult(observation) {
  return {
    result: "pass",
    automatic: true,
    executor: "scripts/run-kps-lifecycle-route-proof.mjs",
    observation,
  };
}

function yamlDocuments(docs) {
  return docs.map((doc) => toYaml(doc)).join("\n---\n");
}

function readYamlDocuments(root) {
  check(existsSync(root), `${root} is missing`);
  return listFiles(root)
    .filter((path) => /\.ya?ml$/i.test(path))
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")));
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
    env: { ...process.env, ...(options.env ?? {}) },
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
