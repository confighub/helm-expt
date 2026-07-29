#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const chart = "prometheus-community/kube-prometheus-stack";
const version = "85.3.3";
const base = "no-crds";
const namespace = "monitoring";
const sourceReference =
  "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-kube-prometheus-stack:85.3.3";
const deliveryReference =
  "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-kube-prometheus-stack-staged:85.3.3-no-crds";
const deliveryRepository = deliveryReference.replace(/:[^/]+$/, "");
const packageRoot = join(
  repoRoot,
  "packages",
  "prometheus-community",
  "kube-prometheus-stack",
  version,
);
const lifecycleRoot = join(
  packageRoot,
  "prerequisites",
  "kube-prometheus-stack-lifecycle",
);
const sourcePublicationReceiptPath = join(
  repoRoot,
  "runs",
  "installer-oci",
  "prometheus-community-kube-prometheus-stack",
  version,
  "installer-package-publication-receipt.yaml",
);
const receiptPath = join(
  repoRoot,
  "runs",
  "kps-gitops-lifecycle-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "kps-gitops-lifecycle-proof",
  "summary.md",
);
const observationsRoot = join(
  repoRoot,
  "runs",
  "kps-gitops-lifecycle-proof",
  "observations",
);
const crdNames = [
  "alertmanagerconfigs.monitoring.coreos.com",
  "alertmanagers.monitoring.coreos.com",
  "podmonitors.monitoring.coreos.com",
  "probes.monitoring.coreos.com",
  "prometheusagents.monitoring.coreos.com",
  "prometheuses.monitoring.coreos.com",
  "prometheusrules.monitoring.coreos.com",
  "scrapeconfigs.monitoring.coreos.com",
  "servicemonitors.monitoring.coreos.com",
  "thanosrulers.monitoring.coreos.com",
];
const workloads = [
  ["deployment", "kube-prometheus-stack-grafana"],
  ["deployment", "kube-prometheus-stack-kube-state-metrics"],
  ["deployment", "kube-prometheus-stack-operator"],
  ["daemonset", "kube-prometheus-stack-prometheus-node-exporter"],
  ["statefulset", "alertmanager-kube-prometheus-stack-alertmanager"],
  ["statefulset", "prometheus-kube-prometheus-stack-prometheus"],
];
const controllerNames = ["argo", "flux"];
const stageNames = ["crds", "prepare", "workload", "finish"];

if (mode === "--run") {
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(
    `wrote ${relativeRepo(receiptPath)}: ${receipt.spec.result}`,
  );
  if (receipt.spec.result !== "pass") process.exitCode = 1;
} else if (mode === "--verify") {
  check(
    existsSync(receiptPath),
    `${relativeRepo(receiptPath)} is missing; run npm run kps:gitops-lifecycle:run`,
  );
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    existsSync(summaryPath)
      && readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run kps:gitops-lifecycle:generate`,
  );
  console.log("verified Kube Prometheus Stack Argo CD and Flux lifecycle proof");
} else if (mode === "--generate") {
  check(
    existsSync(receiptPath),
    `${relativeRepo(receiptPath)} is missing; run npm run kps:gitops-lifecycle:run`,
  );
  const receipt = readYaml(receiptPath);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`regenerated ${relativeRepo(summaryPath)}`);
} else {
  console.log(`Usage:
  node scripts/run-kps-gitops-lifecycle-proof.mjs --run
  node scripts/run-kps-gitops-lifecycle-proof.mjs --generate
  node scripts/run-kps-gitops-lifecycle-proof.mjs --verify`);
}

function runProof() {
  preflight();
  const observedAt = new Date().toISOString();
  const runId = `${observedAt.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-kps-gitops-"));
  const cleanup = {
    workDirectory: "pending",
    argoCluster: "not-created",
    fluxCluster: "not-created",
  };
  const receipt = initialReceipt({ observedAt, runId, cleanup });
  let rendered;
  let staged;
  try {
    console.log("Render the public no-crds package and verify cub installer's OCI output");
    rendered = renderPackage(workRoot);
    receipt.spec.source = {
      ...receipt.spec.source,
      ...rendered.receipt,
    };

    console.log("Build and publish one four-stage OCI artifact");
    staged = buildAndPublishStagedArtifact({ workRoot, rendered });
    receipt.spec.deliveryArtifact = staged.receipt;

    for (const controller of controllerNames) {
      const clusterName = `hx-kps-${controller}-${runId}`;
      console.log(`Run ${controller === "argo" ? "Argo CD" : "Flux"} on fresh cluster ${clusterName}`);
      const result = runController({
        controller,
        clusterName,
        workRoot,
        rendered,
        staged,
      });
      receipt.spec.controllers[controller] = result;
      cleanup[`${controller}Cluster`] = result.cleanup;
    }
  } catch (error) {
    receipt.spec.error = sanitizeError(error);
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
    cleanup.workDirectory = existsSync(workRoot) ? "fail" : "pass";
  }

  const controllerResults = controllerNames.map(
    (name) => receipt.spec.controllers[name]?.result ?? "not-run",
  );
  receipt.spec.result =
    receipt.spec.deliveryArtifact?.anonymousPull === "pass"
      && controllerResults.every((result) => result === "pass")
      ? "pass"
      : controllerResults.some((result) => result === "pass")
        ? "watch"
        : "blocked";
  receipt.spec.claim =
    receipt.spec.result === "pass"
      ? "cub installer rendered the public no-crds preset and verified its non-secret OCI output. One derived OCI then carried the exact rendered files plus four explicit lifecycle stages. Argo CD and Flux each pulled that same manifest digest on separate fresh clusters, ran the CRD and admission Jobs in order, and reached the checked workloads."
      : "The staged Kube Prometheus Stack delivery did not pass through both controllers; read the controller result and error before using this route.";
  return receipt;
}

function preflight() {
  for (const command of [
    "cub",
    "docker",
    "flux",
    "gcloud",
    "kind",
    "kubectl",
    "kustomize",
    "oras",
    "tar",
  ]) {
    check(commandExists(command), `${command} is required`);
  }
  check(
    existsSync(sourcePublicationReceiptPath),
    `${relativeRepo(sourcePublicationReceiptPath)} is missing`,
  );
  check(existsSync(lifecycleRoot), `${relativeRepo(lifecycleRoot)} is missing`);
  check(
    !liveParityRunning(),
    "a tests/live-helm-confighub-parity-test process is already running",
  );
  command("cub", ["auth", "get-token"], { redactOutput: true });
  const project = command("gcloud", ["config", "get-value", "project"]).trim();
  check(
    project === "nth-fort-499605-q5",
    `active gcloud project is ${project || "unset"}, expected nth-fort-499605-q5`,
  );
}

function initialReceipt({ observedAt, runId, cleanup }) {
  const publication = readYaml(sourcePublicationReceiptPath);
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubePrometheusStackGitOpsLifecycleReceipt",
    metadata: {
      name: `kube-prometheus-stack-85-3-3-no-crds-gitops-${runId}`,
    },
    spec: {
      chart,
      version,
      base,
      observedAt,
      result: "blocked",
      claim: "",
      source: {
        installerPackage: sourceReference,
        installerPackageManifestDigest: publicationManifestDigest(publication),
        publicationReceipt: relativeRepo(sourcePublicationReceiptPath),
      },
      deliveryArtifact: {
        reference: deliveryReference,
        digest: "",
        anonymousPull: "not-run",
      },
      controllers: {
        argo: { result: "not-run" },
        flux: { result: "not-run" },
      },
      cleanup,
      limits: [
        "This receipt covers a fresh install of the no-crds preset. It does not cover the 85.3.3 to 86.1.0 upgrade.",
        "The Alertmanager configuration Secret and a fresh Grafana credential were supplied separately to each target and were not put in OCI or the receipt.",
        "The staged artifact is a chart-specific delivery implementation. ConfigHub does not yet choose this route automatically.",
        "The public source installer package and the staged delivery OCI have different jobs: the source package offers preset choices; the staged OCI contains one selected result and its delivery order.",
      ],
    },
  };
}

function renderPackage(workRoot) {
  const renderRoot = join(workRoot, "render");
  const layoutRoot = join(workRoot, "cub-rendered-oci");
  const output = command("cub", [
    "installer",
    "setup",
    "--pull",
    sourceReference,
    "--base",
    base,
    "--work-dir",
    renderRoot,
    "--non-interactive",
    "--namespace",
    namespace,
    "--output-oci",
    layoutRoot,
  ], { timeout: 300_000 });
  const manifestDigest = matchDigest(output, /manifest:\s+(sha256:[a-f0-9]{64})/);
  const objectSetDigest = matchDigest(output, /objects:\s+(sha256:[a-f0-9]{64})/);
  check(output.includes("pull-back: verified"), "cub installer did not verify its OCI output");

  const manifestRoot = join(renderRoot, "out", "manifests");
  const secretRoot = join(renderRoot, "out", "secrets");
  const manifestFiles = yamlFiles(manifestRoot);
  const secretFiles = yamlFiles(secretRoot);
  check(manifestFiles.length === 113, `expected 113 non-secret files, found ${manifestFiles.length}`);
  check(secretFiles.length === 2, `expected 2 separated Secret files, found ${secretFiles.length}`);
  const objects = manifestFiles.flatMap((path) => parseDocs(readFileSync(path, "utf8")));
  check(objects.length === 113, `expected 113 non-secret objects, found ${objects.length}`);
  check(
    objects.every((object) => object.kind !== "Secret"),
    "cub rendered OCI input contains a Secret",
  );
  const namespaceFile = manifestFiles.find((path) => {
    const docs = parseDocs(readFileSync(path, "utf8"));
    return docs.some(
      (object) => object.kind === "Namespace" && object.metadata?.name === namespace,
    );
  });
  check(namespaceFile, "rendered output has no monitoring Namespace object");

  const localDescriptor = ociLayoutDescriptor(layoutRoot);
  check(
    localDescriptor.digest === manifestDigest,
    "local OCI layout digest differs from cub installer output",
  );
  const manifest = ociLayoutManifest(layoutRoot, manifestDigest);
  check(
    manifest.annotations?.["installer.confighub.com/object-set-digest"]
      === objectSetDigest,
    "local OCI object-set annotation differs from cub installer output",
  );
  check(
    manifest.annotations?.["installer.confighub.com/source-digest"]
      === publicationManifestDigest(readYaml(sourcePublicationReceiptPath)),
    "local OCI source digest differs from the public package receipt",
  );

  return {
    renderRoot,
    layoutRoot,
    manifestRoot,
    secretRoot,
    manifestFiles,
    secretFiles,
    namespaceFile,
    objects,
    receipt: {
      cubInstallerCommand: [
        "cub",
        "installer",
        "setup",
        "--pull",
        sourceReference,
        "--base",
        base,
        "--namespace",
        namespace,
        "--output-oci",
        "<temporary-local-layout>",
      ],
      renderedManifestCount: manifestFiles.length,
      separatedSecretCount: secretFiles.length,
      separatedSecrets: secretFiles.map((path) => secretDescription(path)),
      renderedOciManifestDigest: manifestDigest,
      renderedObjectSetDigest: objectSetDigest,
      renderedOciPullBack: "pass",
    },
  };
}

function buildAndPublishStagedArtifact({ workRoot, rendered }) {
  const stageRoot = join(workRoot, "staged-artifact");
  const crdsRoot = join(stageRoot, "stages", "crds");
  const prepareRoot = join(stageRoot, "stages", "prepare");
  const workloadRoot = join(stageRoot, "stages", "workload");
  const finishRoot = join(stageRoot, "stages", "finish");
  const companionRoot = join(stageRoot, ".confighub");
  for (const path of [
    crdsRoot,
    prepareRoot,
    workloadRoot,
    finishRoot,
    companionRoot,
  ]) {
    mkdirSync(path, { recursive: true });
  }

  copyFileSync(
    join(lifecycleRoot, "default-crds.yaml"),
    join(crdsRoot, "default-crds.yaml"),
  );
  copyFileSync(rendered.namespaceFile, join(crdsRoot, "namespace-monitoring.yaml"));
  writeKustomization(crdsRoot, [
    "namespace-monitoring.yaml",
    "default-crds.yaml",
  ], {
    "argocd.argoproj.io/sync-wave": "-3",
  });

  const support = transformedLifecycleDocs(
    join(lifecycleRoot, "hook-support.yaml"),
    "-2",
  );
  const createJob = transformedLifecycleDocs(
    join(lifecycleRoot, "admission-create-job.yaml"),
    "-1",
  );
  writeDocs(join(prepareRoot, "hook-support.yaml"), support);
  writeDocs(join(prepareRoot, "admission-create-job.yaml"), createJob);
  writeKustomization(prepareRoot, [
    "hook-support.yaml",
    "admission-create-job.yaml",
  ]);

  for (const sourcePath of rendered.manifestFiles) {
    if (sourcePath === rendered.namespaceFile) continue;
    copyFileSync(sourcePath, join(workloadRoot, basename(sourcePath)));
  }
  const workloadFiles = yamlFiles(workloadRoot).map((path) => basename(path));
  check(workloadFiles.length === 112, `expected 112 workload files, found ${workloadFiles.length}`);
  writeKustomization(workloadRoot, workloadFiles);

  const patchJob = transformedLifecycleDocs(
    join(lifecycleRoot, "admission-patch-job.yaml"),
    "1",
  );
  writeDocs(join(finishRoot, "admission-patch-job.yaml"), patchJob);
  writeKustomization(finishRoot, ["admission-patch-job.yaml"]);

  writeKustomization(stageRoot, stageNames.map((name) => `stages/${name}`));
  const routeRecord = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "StagedLifecycleDelivery",
    metadata: {
      name: "prometheus-community-kube-prometheus-stack-85-3-3-no-crds",
    },
    spec: {
      sourceInstallerPackage: sourceReference,
      sourceInstallerManifestDigest:
        publicationManifestDigest(readYaml(sourcePublicationReceiptPath)),
      selectedBase: base,
      cubRenderedOciManifestDigest:
        rendered.receipt.renderedOciManifestDigest,
      cubRenderedObjectSetDigest:
        rendered.receipt.renderedObjectSetDigest,
      stages: [
        {
          name: "crds",
          path: "stages/crds",
          purpose: "Create the monitoring Namespace and establish ten Prometheus Operator CRDs.",
        },
        {
          name: "prepare",
          path: "stages/prepare",
          purpose: "Run the chart's certificate creation Job before the workload.",
        },
        {
          name: "workload",
          path: "stages/workload",
          purpose: "Apply the exact 112 non-secret chart objects produced by cub installer.",
        },
        {
          name: "finish",
          path: "stages/finish",
          purpose: "Run the chart's webhook patch Job after the webhook objects exist.",
        },
      ],
      targetOwnedSecrets: rendered.secretFiles.map((path) => secretDescription(path)),
      controllers: {
        argoCD: "One Application builds the root kustomization. Sync-wave annotations order the four stages.",
        flux: "Four Kustomizations use dependsOn and the four stage paths.",
      },
      upgrade: "not-run",
    },
  };
  writeYaml(join(companionRoot, "route.yaml"), routeRecord);
  cpSync(
    join(rendered.renderRoot, "out", "spec"),
    join(companionRoot, "render"),
    { recursive: true },
  );
  write(
    join(stageRoot, "README.md"),
    `# Kube Prometheus Stack staged delivery

This OCI contains the \`${base}\` preset rendered by \`cub installer\` plus the
chart-specific CRD and admission-webhook work needed for a fresh install.

- Argo CD uses the root \`kustomization.yaml\` and its sync waves.
- Flux uses the four directories under \`stages/\` with \`dependsOn\`.
- The Alertmanager configuration and Grafana credential remain target-owned
  Secrets. They are not stored in this OCI.
- This artifact does not claim upgrade behavior.

Read \`.confighub/route.yaml\` for the source digests and exact stage purpose.
`,
  );

  command("kustomize", ["build", stageRoot], { timeout: 120_000 });
  const tarPath = join(workRoot, "kps-staged.tar.gz");
  command("tar", ["-czf", tarPath, "-C", stageRoot, "."]);
  const remote = stripOciScheme(deliveryReference);
  command("oras", [
    "push",
    "--artifact-type",
    "application/vnd.confighub.staged-kubernetes.v1+json",
    "--format",
    "json",
    "--annotation",
    `confighub.com/source-rendered-oci=${rendered.receipt.renderedOciManifestDigest}`,
    "--annotation",
    `confighub.com/source-object-set=${rendered.receipt.renderedObjectSetDigest}`,
    "--annotation",
    "confighub.com/lifecycle-stages=crds,prepare,workload,finish",
    "--annotation",
    "org.opencontainers.image.title=kube-prometheus-stack-85.3.3-no-crds-staged",
    remote,
    `${basename(tarPath)}:application/vnd.oci.image.layer.v1.tar+gzip`,
  ], { cwd: workRoot, timeout: 300_000 });
  const descriptor = remoteDescriptor(remote);
  const manifest = remoteManifest(`${remote}@${descriptor.digest}`);
  check(manifest.layers?.length === 1, "staged OCI must have one content layer");
  check(
    manifest.layers[0].mediaType === "application/vnd.oci.image.layer.v1.tar+gzip",
    "staged OCI layer is not Argo CD and Flux compatible",
  );
  check(
    manifest.annotations?.["confighub.com/source-rendered-oci"]
      === rendered.receipt.renderedOciManifestDigest,
    "staged OCI lost the source rendered-OCI digest",
  );
  const layerDigest = manifest.layers[0].digest;
  check(
    layerDigest === `sha256:${fileSha256(tarPath)}`,
    "staged OCI layer digest differs from the local archive",
  );

  const anonymousRoot = join(workRoot, "anonymous-pull");
  const registryConfig = join(workRoot, "anonymous-registry.json");
  writeFileSync(registryConfig, '{"auths":{}}\n', { mode: 0o600 });
  command("oras", [
    "pull",
    `${remote}@${descriptor.digest}`,
    "--registry-config",
    registryConfig,
    "-o",
    anonymousRoot,
  ], { timeout: 300_000 });
  const pulledArchive = join(anonymousRoot, basename(tarPath));
  check(existsSync(pulledArchive), "anonymous pull did not return the staged layer");
  check(
    fileSha256(pulledArchive) === fileSha256(tarPath),
    "anonymous pull changed the staged layer",
  );

  return {
    stageRoot,
    digest: descriptor.digest,
    remote,
    receipt: {
      reference: deliveryReference,
      digest: descriptor.digest,
      artifactType: manifest.artifactType,
      layerMediaType: manifest.layers[0].mediaType,
      layerDigest,
      archiveSha256: fileSha256(tarPath),
      anonymousPull: "pass",
      containsSecrets: false,
      stages: [
        { name: "crds", path: "stages/crds", objectCount: 11 },
        { name: "prepare", path: "stages/prepare", objectCount: 6 },
        { name: "workload", path: "stages/workload", objectCount: 112 },
        { name: "finish", path: "stages/finish", objectCount: 1 },
      ],
      totalObjects: 130,
      routeRecord: ".confighub/route.yaml",
    },
  };
}

function runController({
  controller,
  clusterName,
  workRoot,
  rendered,
  staged,
}) {
  const kubeconfig = join(
    homedir(),
    ".confighub",
    "clusters",
    `${clusterName}.kubeconfig`,
  );
  const result = {
    result: "blocked",
    cluster: clusterName,
    clusterType: "kind",
    sourceReference: deliveryReference,
    requestedDigest: staged.digest,
    observedDigest: "",
    targetOwnedSecrets: "not-run",
    stages: Object.fromEntries(
      stageNames.map((name) => [name, "not-run"]),
    ),
    runtime: {},
    cleanup: "pending",
  };
  let up = false;
  try {
    commandVisible("cub", ["cluster", "up", "--name", clusterName], {
      timeout: 900_000,
    });
    up = existsSync(kubeconfig);
    check(up, `cub cluster up did not create ${kubeconfig}`);
    stageTargetSecrets({ kubeconfig, rendered, workRoot, controller });
    result.targetOwnedSecrets = "pass";
    if (controller === "argo") {
      Object.assign(
        result,
        runArgo({ kubeconfig, staged, workRoot, clusterName }),
      );
    } else {
      Object.assign(
        result,
        runFlux({ kubeconfig, staged, workRoot, clusterName }),
      );
    }
    const runtime = observeRuntime({ kubeconfig, controller });
    result.runtime = runtime;
    result.result =
      result.observedDigest === staged.digest
        && Object.values(result.stages).every((stage) => stage === "pass")
        && runtime.result === "pass"
        ? "pass"
        : "watch";
    writeJson(
      join(observationsRoot, `${controller}-runtime.json`),
      runtime,
    );
  } catch (error) {
    result.error = sanitizeError(error);
  } finally {
    if (up || cubClusterPresent(clusterName)) {
      tryCommand("cub", ["cluster", "down", "--name", clusterName, "--force"], {
        timeout: 600_000,
      });
    }
    result.cleanup = cubClusterPresent(clusterName) ? "fail" : "pass";
  }
  return result;
}

function runArgo({ kubeconfig, staged, workRoot }) {
  const applicationName = "kps-staged";
  const application = {
    apiVersion: "argoproj.io/v1alpha1",
    kind: "Application",
    metadata: {
      name: applicationName,
      namespace: "argocd",
    },
    spec: {
      project: "default",
      source: {
        repoURL: deliveryRepository,
        targetRevision: staged.digest,
        path: ".",
      },
      destination: {
        server: "https://kubernetes.default.svc",
        namespace,
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
        },
        syncOptions: [
          "CreateNamespace=true",
          "ServerSideApply=true",
        ],
      },
    },
  };
  const path = join(workRoot, "argo-application.yaml");
  writeYaml(path, application);
  kubectl(kubeconfig, ["apply", "-f", path]);
  kubectl(kubeconfig, [
    "-n",
    "argocd",
    "annotate",
    "application",
    applicationName,
    "argocd.argoproj.io/refresh=hard",
    "--overwrite",
  ]);
  const observed = waitFor("Argo CD Application to sync", 900_000, () => {
    const object = kubectlJson(kubeconfig, [
      "-n",
      "argocd",
      "get",
      "application",
      applicationName,
      "-o",
      "json",
    ]);
    const sync = object.status?.sync?.status;
    const health = object.status?.health?.status;
    const revision = String(object.status?.sync?.revision ?? "");
    const phase = object.status?.operationState?.phase;
    const done =
      sync === "Synced"
      && health === "Healthy"
      && revision.includes(staged.digest)
      && (!phase || phase === "Succeeded");
    return done ? object : null;
  });
  writeJson(join(observationsRoot, "argo-application.json"), observed);
  return {
    controller: "Argo CD",
    application: applicationName,
    sync: observed.status?.sync?.status,
    health: observed.status?.health?.status,
    operation: observed.status?.operationState?.phase ?? "none",
    observedDigest: digestFromText(observed.status?.sync?.revision),
    stages: {
      crds: "pass",
      prepare: jobCompleted(kubeconfig, "kube-prometheus-stack-admission-create")
        ? "pass"
        : "blocked",
      workload: "pass",
      finish: jobCompleted(kubeconfig, "kube-prometheus-stack-admission-patch")
        ? "pass"
        : "blocked",
    },
  };
}

function runFlux({ kubeconfig, staged, workRoot }) {
  commandVisible("flux", [
    "install",
    "--kubeconfig",
    kubeconfig,
    "--components",
    "source-controller,kustomize-controller",
  ], { timeout: 600_000 });
  const sourceName = "kps-staged";
  const docs = [
    {
      apiVersion: "source.toolkit.fluxcd.io/v1",
      kind: "OCIRepository",
      metadata: { name: sourceName, namespace: "flux-system" },
      spec: {
        interval: "1m",
        url: deliveryRepository,
        ref: { digest: staged.digest },
      },
    },
    ...stageNames.map((stage, index) => ({
      apiVersion: "kustomize.toolkit.fluxcd.io/v1",
      kind: "Kustomization",
      metadata: {
        name: `kps-${stage}`,
        namespace: "flux-system",
      },
      spec: {
        interval: "1m",
        retryInterval: "20s",
        path: `./stages/${stage}`,
        prune: true,
        wait: true,
        timeout: stage === "workload" ? "10m" : "5m",
        sourceRef: {
          kind: "OCIRepository",
          name: sourceName,
        },
        ...(index > 0
          ? {
            dependsOn: [
              { name: `kps-${stageNames[index - 1]}` },
            ],
          }
          : {}),
      },
    })),
  ];
  const path = join(workRoot, "flux-stages.yaml");
  writeDocs(path, docs);
  kubectl(kubeconfig, ["apply", "-f", path]);
  commandVisible("flux", [
    "--kubeconfig",
    kubeconfig,
    "-n",
    "flux-system",
    "reconcile",
    "source",
    "oci",
    sourceName,
    "--timeout",
    "300s",
  ], { timeout: 360_000 });
  for (const stage of stageNames) {
    commandVisible("flux", [
      "--kubeconfig",
      kubeconfig,
      "-n",
      "flux-system",
      "reconcile",
      "kustomization",
      `kps-${stage}`,
      "--with-source",
      "--timeout",
      stage === "workload" ? "10m" : "5m",
    ], { timeout: stage === "workload" ? 660_000 : 360_000 });
  }
  const source = kubectlJson(kubeconfig, [
    "-n",
    "flux-system",
    "get",
    "ocirepository",
    sourceName,
    "-o",
    "json",
  ]);
  const kustomizations = kubectlJson(kubeconfig, [
    "-n",
    "flux-system",
    "get",
    "kustomizations",
    "-o",
    "json",
  ]);
  writeJson(join(observationsRoot, "flux-source.json"), source);
  writeJson(join(observationsRoot, "flux-kustomizations.json"), kustomizations);
  const stages = Object.fromEntries(stageNames.map((stage) => {
    const object = kustomizations.items?.find(
      (item) => item.metadata?.name === `kps-${stage}`,
    );
    return [stage, readyCondition(object) ? "pass" : "blocked"];
  }));
  const revision = String(source.status?.artifact?.revision ?? "");
  check(revision.includes(staged.digest), `Flux source revision ${revision} does not contain ${staged.digest}`);
  return {
    controller: "Flux",
    source: sourceName,
    sourceReady: readyCondition(source),
    sourceRevision: revision,
    sourceContentDigest: source.status?.artifact?.digest ?? "",
    observedDigest: digestFromText(revision),
    stages,
  };
}

function stageTargetSecrets({ kubeconfig, rendered, workRoot, controller }) {
  kubectl(kubeconfig, [
    "create",
    "namespace",
    namespace,
    "--dry-run=client",
    "-o",
    "yaml",
  ], {
    transformOutput: (yaml) =>
      kubectl(kubeconfig, ["apply", "-f", "-"], { input: yaml }),
  });
  const secrets = rendered.secretFiles.flatMap((path) =>
    parseDocs(readFileSync(path, "utf8")),
  );
  check(secrets.length === 2, "expected two target-owned Secret objects");
  for (const secret of secrets) {
    check(secret.kind === "Secret", "separated target object is not a Secret");
    if (secret.metadata?.name === "kube-prometheus-stack-grafana") {
      const password =
        `throwaway-kps-gitops-${randomBytes(18).toString("hex")}`;
      secret.data = {
        ...secret.data,
        "admin-user": Buffer.from("admin").toString("base64"),
        "admin-password": Buffer.from(password).toString("base64"),
      };
    }
  }
  const path = join(workRoot, `${controller}-target-secrets.yaml`);
  writeDocs(path, secrets);
  chmodSync(path, 0o600);
  try {
    kubectl(kubeconfig, ["apply", "-f", path], { redactOutput: true });
  } finally {
    rmSync(path, { force: true });
  }
  for (const secret of secrets) {
    const name = secret.metadata?.name;
    kubectl(kubeconfig, [
      "-n",
      namespace,
      "get",
      `secret/${name}`,
      "-o",
      "name",
    ], { redactOutput: true });
  }
}

function observeRuntime({ kubeconfig, controller }) {
  const crds = crdNames.map((name) => {
    kubectl(kubeconfig, [
      "wait",
      "--for=condition=Established",
      "--timeout=180s",
      `crd/${name}`,
    ]);
    return { name, established: true };
  });
  for (const [kind, name] of workloads) {
    kubectl(kubeconfig, [
      "-n",
      namespace,
      "rollout",
      "status",
      `${kind}/${name}`,
      "--timeout=600s",
    ], { timeout: 660_000 });
  }
  const secret = kubectlJson(kubeconfig, [
    "-n",
    namespace,
    "get",
    "secret/kube-prometheus-stack-admission",
    "-o",
    "json",
  ]);
  const secretKeys = Object.keys(secret.data ?? {}).sort();
  for (const key of ["ca", "cert", "key"]) {
    check(secretKeys.includes(key), `admission Secret is missing ${key}`);
  }
  const secretCa = secret.data.ca;
  const bundles = [
    ...webhookBundles(
      kubectlJson(kubeconfig, [
        "get",
        "mutatingwebhookconfiguration/kube-prometheus-stack-admission",
        "-o",
        "json",
      ]),
    ),
    ...webhookBundles(
      kubectlJson(kubeconfig, [
        "get",
        "validatingwebhookconfiguration/kube-prometheus-stack-admission",
        "-o",
        "json",
      ]),
    ),
  ];
  check(bundles.length === 3, `expected three webhook CA bundles, found ${bundles.length}`);
  check(
    bundles.every((bundle) => bundle && bundle === secretCa),
    "webhook CA bundles do not all match the admission Secret",
  );
  const endpoint = kubectlJson(kubeconfig, [
    "-n",
    namespace,
    "get",
    "endpoints/kube-prometheus-stack-operator",
    "-o",
    "json",
  ]);
  const endpointAddresses = (endpoint.subsets ?? [])
    .flatMap((subset) => subset.addresses ?? [])
    .length;
  check(endpointAddresses > 0, "operator endpoint has no ready address");
  const dryRunPath = join(
    tmpdir(),
    `kps-gitops-dry-run-${controller}-${process.pid}.yaml`,
  );
  write(dryRunPath, `apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kps-gitops-lifecycle-probe
  namespace: ${namespace}
spec:
  groups:
    - name: kps-gitops-lifecycle-probe
      rules:
        - alert: KpsGitOpsLifecycleProbe
          expr: vector(1)
`);
  try {
    kubectl(kubeconfig, [
      "apply",
      "--server-side",
      "--dry-run=server",
      "-f",
      dryRunPath,
    ]);
  } finally {
    rmSync(dryRunPath, { force: true });
  }
  const workloadRecords = workloads.map(([kind, name]) => ({
    kind,
    name,
    namespace,
    ready: true,
  }));
  return {
    result: "pass",
    crds,
    admissionSecret: {
      namespace,
      name: "kube-prometheus-stack-admission",
      keys: secretKeys.filter((key) => ["ca", "cert", "key"].includes(key)),
    },
    matchingWebhookCABundles: bundles.length,
    operatorEndpointAddresses: endpointAddresses,
    serverDryRun: "pass",
    jobs: {
      admissionCreate: jobCompleted(
        kubeconfig,
        "kube-prometheus-stack-admission-create",
      ),
      admissionPatch: jobCompleted(
        kubeconfig,
        "kube-prometheus-stack-admission-patch",
      ),
    },
    workloads: workloadRecords,
  };
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "KubePrometheusStackGitOpsLifecycleReceipt",
    "receipt kind is wrong",
  );
  check(
    ["pass", "watch", "blocked"].includes(receipt.spec?.result),
    "receipt result is invalid",
  );
  check(receipt.spec?.chart === chart, "receipt chart is wrong");
  check(receipt.spec?.version === version, "receipt version is wrong");
  check(receipt.spec?.base === base, "receipt base is wrong");
  check(
    /^sha256:[a-f0-9]{64}$/.test(receipt.spec?.source?.renderedOciManifestDigest ?? ""),
    "receipt has no cub rendered-OCI digest",
  );
  check(
    /^sha256:[a-f0-9]{64}$/.test(receipt.spec?.source?.renderedObjectSetDigest ?? ""),
    "receipt has no cub object-set digest",
  );
  check(
    /^sha256:[a-f0-9]{64}$/.test(receipt.spec?.deliveryArtifact?.digest ?? ""),
    "receipt has no staged delivery digest",
  );
  check(
    receipt.spec?.deliveryArtifact?.containsSecrets === false,
    "staged delivery OCI must exclude Secrets",
  );
  check(
    receipt.spec?.deliveryArtifact?.stages?.map((stage) => stage.name).join(",")
      === stageNames.join(","),
    "receipt lifecycle stages are incomplete or out of order",
  );
  for (const controller of controllerNames) {
    const row = receipt.spec?.controllers?.[controller];
    check(row, `receipt has no ${controller} result`);
    if (receipt.spec.result === "pass") {
      check(row.result === "pass", `${controller} did not pass`);
      check(
        row.requestedDigest === receipt.spec.deliveryArtifact.digest,
        `${controller} requested a different OCI digest`,
      );
      check(
        row.observedDigest === receipt.spec.deliveryArtifact.digest,
        `${controller} observed a different OCI digest`,
      );
      check(
        Object.values(row.stages ?? {}).every((status) => status === "pass"),
        `${controller} did not pass all four lifecycle stages`,
      );
      check(row.runtime?.result === "pass", `${controller} runtime did not pass`);
      check(row.cleanup === "pass", `${controller} cluster was not removed`);
    }
  }
  if (receipt.spec.result === "pass") {
    check(
      receipt.spec?.deliveryArtifact?.anonymousPull === "pass",
      "staged OCI did not pass anonymous pull",
    );
    check(
      receipt.spec?.cleanup?.workDirectory === "pass",
      "temporary work directory was not removed",
    );
  }
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  const rows = controllerNames.map((name) => {
    const row = spec.controllers[name] ?? {};
    const stages = stageNames
      .map((stage) => `${stage}: ${row.stages?.[stage] ?? "not-run"}`)
      .join("; ");
    return `| ${name === "argo" ? "Argo CD" : "Flux"} | ${row.observedDigest ? `\`${row.observedDigest}\`` : "not observed"} | ${stages} | ${row.runtime?.result ?? "not-run"} | ${row.result ?? "not-run"} |`;
  }).join("\n");
  return `# Kube Prometheus Stack through Argo CD and Flux

This is a fresh-install test of the public
\`${chart}@${version}\` \`${base}\` preset. The result is
**${spec.result}**.

\`cub installer setup --output-oci\` first wrote and read back the selected
non-secret configuration. That output contained ${spec.source.renderedManifestCount}
files at object-set digest
\`${spec.source.renderedObjectSetDigest}\`.

A chart-specific step then added the work Helm normally performs around those
objects. One public OCI at
\`${spec.deliveryArtifact.reference}@${spec.deliveryArtifact.digest}\`
contains four paths:

1. \`stages/crds\` creates the Namespace and establishes ten CRDs.
2. \`stages/prepare\` runs the chart's certificate creation Job.
3. \`stages/workload\` applies the 112 non-secret chart objects.
4. \`stages/finish\` runs the chart's webhook patch Job.

Argo CD uses sync waves from the root kustomization. Flux uses one
\`OCIRepository\` and four \`Kustomization\` objects joined with \`dependsOn\`.
They ran on separate fresh clusters and requested the same OCI manifest digest.

| Controller | Digest observed | Stage results | Runtime checks | Result |
| --- | --- | --- | --- | --- |
${rows}

Each passing runtime result means the ten CRDs were Established, the chart's
create and patch Jobs completed, the admission Secret contained \`ca\`,
\`cert\`, and \`key\`, all three webhook CA bundles matched, the operator
Service had a ready endpoint, a server-side dry run passed, and the six named
workloads were ready.

## Secrets

The rendered OCI and the staged delivery OCI contain no Secret objects. The
Alertmanager configuration Secret and a fresh Grafana credential were supplied
separately to each throwaway cluster. Their names and required keys are recorded;
their values are not.

## Limits

- This is a fresh-install receipt, not an upgrade receipt.
- It proves this chart, version, preset, artifact digest, and the two named
  controller paths. It does not prove every Helm hook.
- The route is explicit and repeatable, but ConfigHub does not yet select it
  automatically.
- Receipt: \`${relativeRepo(receiptPath)}\`.
`;
}

function transformedLifecycleDocs(path, wave) {
  return parseDocs(readFileSync(path, "utf8")).map((object) => {
    const annotations = { ...(object.metadata?.annotations ?? {}) };
    for (const key of [
      "helm.sh/hook",
      "helm.sh/hook-delete-policy",
      "helm.sh/hook-weight",
    ]) {
      delete annotations[key];
    }
    annotations["argocd.argoproj.io/sync-wave"] = wave;
    object.metadata = {
      ...(object.metadata ?? {}),
      annotations,
    };
    return object;
  });
}

function writeKustomization(root, resources, commonAnnotations = {}) {
  const object = {
    apiVersion: "kustomize.config.k8s.io/v1beta1",
    kind: "Kustomization",
    resources,
    ...(Object.keys(commonAnnotations).length > 0
      ? { commonAnnotations }
      : {}),
  };
  writeYaml(join(root, "kustomization.yaml"), object);
}

function writeDocs(path, docs) {
  write(
    path,
    `${docs.map((doc) => toYaml(doc)).join("\n---\n")}\n`,
  );
}

function writeJson(path, value) {
  write(path, `${JSON.stringify(value, null, 2)}\n`);
}

function command(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1", ...(options.env ?? {}) },
    input: options.input,
    maxBuffer: 1024 * 1024 * 200,
    timeout: options.timeout ?? 120_000,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    const detail = options.redactOutput ? "(output redacted)" : sanitizeError(output);
    throw new Error(`${file} ${args.join(" ")} failed: ${detail}`);
  }
  if (options.transformOutput) return options.transformOutput(result.stdout ?? "");
  return result.stdout ?? "";
}

function commandVisible(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1", ...(options.env ?? {}) },
    stdio: "inherit",
    timeout: options.timeout ?? 120_000,
  });
  if (result.status !== 0) {
    throw new Error(`${file} ${args.join(" ")} failed with status ${result.status}`);
  }
}

function tryCommand(file, args, options = {}) {
  try {
    return { ok: true, output: command(file, args, options) };
  } catch (error) {
    return { ok: false, output: sanitizeError(error) };
  }
}

function kubectl(kubeconfig, args, options = {}) {
  return command("kubectl", ["--kubeconfig", kubeconfig, ...args], {
    ...options,
    timeout: options.timeout ?? 300_000,
  });
}

function kubectlJson(kubeconfig, args) {
  return JSON.parse(kubectl(kubeconfig, args));
}

function commandExists(name) {
  return spawnSync("which", [name], { encoding: "utf8" }).status === 0;
}

function liveParityRunning() {
  const result = spawnSync("pgrep", [
    "-f",
    "tests/live-helm-confighub-parity-test",
  ], { encoding: "utf8" });
  if (result.status !== 0) return false;
  const pids = String(result.stdout ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number)
    .filter((pid) => pid !== process.pid);
  return pids.some((pid) => {
    const commandLine = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
    }).stdout ?? "";
    return commandLine.includes("tests/live-helm-confighub-parity-test");
  });
}

function yamlFiles(root) {
  const files = [];
  const walk = (path) => {
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) walk(child);
      else if (/\.ya?ml$/i.test(name)) files.push(child);
    }
  };
  if (existsSync(root)) walk(root);
  return files.sort();
}

function secretDescription(path) {
  const secret = parseDocs(readFileSync(path, "utf8"))[0];
  return {
    namespace: secret.metadata?.namespace ?? "",
    name: secret.metadata?.name ?? "",
    keys: Object.keys(secret.data ?? {}).sort(),
  };
}

function publicationManifestDigest(receipt) {
  const digest = receipt.spec?.manifest?.digest
    ?? receipt.spec?.manifestDigest
    ?? receipt.spec?.digest
    ?? String(receipt.spec?.outputs?.push ?? "").match(
      /manifest:\s+(sha256:[a-f0-9]{64})/,
    )?.[1];
  check(
    /^sha256:[a-f0-9]{64}$/.test(digest ?? ""),
    `${relativeRepo(sourcePublicationReceiptPath)} has no manifest digest`,
  );
  return digest;
}

function ociLayoutDescriptor(layoutRoot) {
  const index = JSON.parse(readFileSync(join(layoutRoot, "index.json"), "utf8"));
  const descriptor = index.manifests?.[0];
  check(descriptor?.digest, "local OCI layout has no manifest descriptor");
  return descriptor;
}

function ociLayoutManifest(layoutRoot, digest) {
  const path = join(layoutRoot, "blobs", "sha256", digest.split(":")[1]);
  return JSON.parse(readFileSync(path, "utf8"));
}

function remoteDescriptor(reference) {
  return JSON.parse(command("oras", ["manifest", "fetch", "--descriptor", reference]));
}

function remoteManifest(reference) {
  return JSON.parse(command("oras", ["manifest", "fetch", reference]));
}

function stripOciScheme(reference) {
  return reference.replace(/^oci:\/\//, "");
}

function fileSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function matchDigest(text, pattern) {
  const match = text.match(pattern);
  check(match, `command output did not contain ${pattern}`);
  return match[1];
}

function digestFromText(value) {
  return String(value ?? "").match(/sha256:[a-f0-9]{64}/)?.[0] ?? "";
}

function readyCondition(object) {
  return (object?.status?.conditions ?? []).some(
    (condition) => condition.type === "Ready" && condition.status === "True",
  );
}

function jobCompleted(kubeconfig, name) {
  const result = tryCommand("kubectl", [
    "--kubeconfig",
    kubeconfig,
    "-n",
    namespace,
    "get",
    `job/${name}`,
    "-o",
    "jsonpath={.status.succeeded}",
  ]);
  return result.ok && String(result.output).trim() === "1";
}

function webhookBundles(object) {
  return (object.webhooks ?? []).map(
    (webhook) => webhook.clientConfig?.caBundle ?? "",
  );
}

function waitFor(label, timeoutMs, fn) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const value = fn();
      if (value) return value;
    } catch (error) {
      lastError = sanitizeError(error);
    }
    sleep(5000);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError}` : ""}`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function cubClusterPresent(name) {
  const result = tryCommand("cub", ["cluster", "list"]);
  return result.ok && result.output.includes(name);
}

function sanitizeError(value) {
  return String(value?.message ?? value ?? "")
    .replaceAll(homedir(), "$HOME")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/password["=: ]+\S+/gi, "password=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}
