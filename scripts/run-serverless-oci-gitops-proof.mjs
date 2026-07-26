#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
import { basename, join, relative } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(
  repoRoot,
  "runs",
  "serverless-oci-gitops-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "serverless-oci-gitops-proof",
  "summary.md",
);
const htmlPath = join(
  repoRoot,
  "data",
  "serverless-oci-gitops-proof",
  "summary.html",
);
const publicationReceiptPath = join(
  repoRoot,
  "runs",
  "installer-oci",
  "bitnami-nginx",
  "24.0.2",
  "installer-package-publication-receipt.yaml",
);
const pluginSource = join(homedir(), ".confighub", "plugins", "installer");
const chart = "bitnami/nginx";
const version = "24.0.2";
const base = "http-clusterip";
const namespace = "nginx";
const expectedObjectKinds = [
  "Deployment",
  "Namespace",
  "NetworkPolicy",
  "PodDisruptionBudget",
  "Service",
  "ServiceAccount",
];

if (mode === "--run") {
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  write(htmlPath, renderHtml(receipt));
  verifyReceipt(receipt);
  console.log(
    `wrote ${relativeRepo(receiptPath)}: ${receipt.status.result}`,
  );
  if (receipt.status.result !== "pass") process.exitCode = 1;
} else if (mode === "--verify") {
  check(
    existsSync(receiptPath),
    `${relativeRepo(receiptPath)} is missing; run npm run serverless-oci-gitops:proof`,
  );
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    existsSync(summaryPath)
      && readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run serverless-oci-gitops:proof`,
  );
  check(
    existsSync(htmlPath)
      && readFileSync(htmlPath, "utf8") === renderHtml(receipt),
    `${relativeRepo(htmlPath)} is stale; run npm run serverless-oci-gitops:proof`,
  );
  console.log("verified anonymous public-OCI to Flux proof");
} else {
  console.log(`Usage:
  node scripts/run-serverless-oci-gitops-proof.mjs --run
  node scripts/run-serverless-oci-gitops-proof.mjs --verify`);
}

function runProof() {
  const publication = readYaml(publicationReceiptPath);
  const sourceReference = String(publication.spec?.ref ?? "");
  const expectedSourceManifestDigest = publicationManifestDigest(publication);
  const expectedPackageLayerDigest = normalizeDigest(
    publication.spec?.package?.sha256,
  );
  const runId = `${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const clusterName = `hx-anon-oci-${runId}`;
  const registryName = `${clusterName}-registry`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-anonymous-oci-"));
  const kubeconfig = join(workRoot, "kubeconfig");
  const cleanup = {
    cluster: "not-created",
    registry: "not-created",
    localFiles: "pending",
  };
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AnonymousOciFluxProofReceipt",
    metadata: {
      name: `public-nginx-oci-work-oci-${runId}`,
    },
    spec: {
      observedAt: new Date().toISOString(),
      pathway: "OCI -> work -> OCI",
      source: {
        chart,
        version,
        base,
        reference: sourceReference,
        expectedManifestDigest: expectedSourceManifestDigest,
        expectedPackageLayerDigest,
        publicationReceipt: relativeRepo(publicationReceiptPath),
        anonymousManifestPull: "not-run",
      },
      localWork: {
        command: [
          "cub",
          "installer",
          "setup",
          "--pull",
          sourceReference,
          "--base",
          base,
          "--work-dir",
          "<temporary-work-dir>",
          "--non-interactive",
          "--namespace",
          namespace,
        ],
        configHubTokenFilePresent: null,
        configHubOrganization: "",
        objectCount: 0,
        objectKinds: [],
        filesSha256: "",
      },
      output: {
        reference: "",
        digest: "",
        anonymousPull: "not-run",
        pulledFilesMatched: false,
      },
      flux: {
        sourceReady: false,
        kustomizationReady: false,
        observedDigest: "",
        contentDigest: "",
        deployment: {
          namespace,
          name: "nginx",
          readyReplicas: 0,
          desiredReplicas: 1,
          image: "",
        },
      },
      run: {
        cluster: clusterName,
        registry: "temporary local registry with no authentication",
        cleanup,
      },
      limits: [
        "The output OCI used a temporary local registry. A permanently hosted public workbench remains separate work.",
        "This NGINX configuration has no Helm hooks or CRDs. Charts with lifecycle work need their recorded routes.",
        "This run did not create or use ConfigHub records, variants, approvals, or releases.",
      ],
    },
    status: {
      result: "blocked",
      claim: "",
      error: "",
    },
  };

  let registryStarted = false;
  let clusterStarted = false;
  try {
    verifyPublicationReceipt(publication);
    const isolated = prepareIsolatedCub(workRoot);
    const sourceDescriptor = anonymousSourceDescriptor(
      sourceReference,
      isolated.dockerConfigPath,
    );
    check(
      sourceDescriptor.digest === expectedSourceManifestDigest,
      "anonymous source manifest digest differs from the publication receipt",
    );
    receipt.spec.source.anonymousManifestPull = "pass";

    const rendered = renderPublicPackage({
      sourceReference,
      workRoot,
      isolated,
    });
    receipt.spec.localWork = {
      ...receipt.spec.localWork,
      configHubTokenFilePresent: isolated.tokenFilePresent,
      configHubOrganization: isolated.organizationId,
      objectCount: rendered.objectCount,
      objectKinds: rendered.objectKinds,
      filesSha256: rendered.filesSha256,
    };

    const registry = startRegistry(registryName);
    registryStarted = true;
    cleanup.registry = "pending";

    const output = pushAndPullOutput({
      bundleRoot: rendered.bundleRoot,
      pullRoot: join(workRoot, "pulled-output"),
      registryHost: registry.host,
      dockerConfigPath: isolated.dockerConfigPath,
    });
    receipt.spec.output = output;

    createCluster(clusterName, kubeconfig);
    clusterStarted = true;
    cleanup.cluster = "pending";
    const flux = reconcileWithFlux({
      clusterName,
      kubeconfig,
      registry,
      digest: output.digest,
    });
    receipt.spec.flux = flux;

    check(
      flux.observedDigest === output.digest,
      "Flux did not reconcile the output OCI digest",
    );
    check(
      flux.deployment.readyReplicas === flux.deployment.desiredReplicas,
      "NGINX did not reach its desired replica count",
    );

    receipt.status.result = "pass";
    receipt.status.claim = "Without a ConfigHub login, cub installer pulled the public NGINX installer OCI, wrote six Kubernetes objects, and packaged those files as a second OCI artifact. Flux pulled that exact output digest and NGINX reached one ready replica.";
  } catch (error) {
    receipt.status.error = sanitizeError(error);
  } finally {
    if (clusterStarted || clusterPresent(clusterName)) {
      tryCommand("kind", ["delete", "cluster", "--name", clusterName], {
        timeout: 240_000,
      });
    }
    cleanup.cluster = clusterPresent(clusterName) ? "fail" : "pass";

    if (registryStarted || dockerContainerPresent(registryName)) {
      tryCommand("docker", ["rm", "-f", registryName], { timeout: 120_000 });
    }
    cleanup.registry = dockerContainerPresent(registryName) ? "fail" : "pass";

    rmSync(workRoot, { recursive: true, force: true });
    cleanup.localFiles = existsSync(workRoot) ? "fail" : "pass";
  }

  if (!Object.values(cleanup).every((value) => value === "pass")) {
    receipt.status.result = "blocked";
    receipt.status.error = [
      receipt.status.error,
      `cleanup failed: ${JSON.stringify(cleanup)}`,
    ].filter(Boolean).join("; ");
  }
  return receipt;
}

function verifyPublicationReceipt(receipt) {
  check(
    receipt.kind === "InstallerPackagePublicationReceipt",
    "NGINX installer publication receipt kind changed",
  );
  check(
    receipt.spec?.ref
      === "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2",
    "NGINX installer publication reference changed",
  );
  check(
    publicationManifestDigest(receipt),
    "NGINX installer publication receipt has no manifest digest",
  );
  check(
    /^[0-9a-f]{64}$/.test(String(receipt.spec?.package?.sha256 ?? "")),
    "NGINX installer package digest changed",
  );
}

function publicationManifestDigest(receipt) {
  const match = String(receipt.spec?.outputs?.push ?? "").match(
    /manifest:\s*(sha256:[0-9a-f]{64})/,
  );
  return match?.[1] ?? "";
}

function prepareIsolatedCub(workRoot) {
  check(
    existsSync(join(pluginSource, "cub-plugin.yaml"))
      && existsSync(join(pluginSource, "bin", "installer")),
    "cub installer plugin is not installed",
  );
  const home = join(workRoot, "anonymous-home");
  const pluginTarget = join(home, ".confighub", "plugins", "installer");
  const dockerRoot = join(workRoot, "anonymous-docker");
  const dockerConfigPath = join(dockerRoot, "config.json");
  mkdirSync(join(pluginTarget, "bin"), { recursive: true });
  mkdirSync(dockerRoot, { recursive: true });
  copyFileSync(
    join(pluginSource, "cub-plugin.yaml"),
    join(pluginTarget, "cub-plugin.yaml"),
  );
  copyFileSync(
    join(pluginSource, "bin", "installer"),
    join(pluginTarget, "bin", "installer"),
  );
  chmodSync(join(pluginTarget, "bin", "installer"), 0o755);
  writeFileSync(dockerConfigPath, '{"auths":{}}\n');
  return {
    home,
    dockerConfigPath,
    tokenFilePresent: false,
    organizationId: "",
  };
}

function anonymousSourceDescriptor(reference, dockerConfigPath) {
  const result = command("oras", [
    "manifest",
    "fetch",
    "--registry-config",
    dockerConfigPath,
    "--descriptor",
    stripOci(reference),
  ], { timeout: 120_000 });
  return JSON.parse(result);
}

function renderPublicPackage({ sourceReference, workRoot, isolated }) {
  const installerWork = join(workRoot, "installer");
  const env = anonymousEnv(isolated);
  command("cub", [
    "installer",
    "setup",
    "--pull",
    sourceReference,
    "--base",
    base,
    "--work-dir",
    installerWork,
    "--non-interactive",
    "--namespace",
    namespace,
  ], { env, timeout: 240_000 });

  const contexts = JSON.parse(command("cub", [
    "context",
    "list",
    "-o",
    "json",
  ], { env, timeout: 30_000 }));
  const context = contexts[0] ?? {};
  const tokenRoot = join(isolated.home, ".confighub", "tokens");
  const tokenFiles = existsSync(tokenRoot) ? listFiles(tokenRoot) : [];
  isolated.tokenFilePresent = tokenFiles.length > 0;
  isolated.organizationId = String(context.coordinate?.organizationID ?? "");
  check(!isolated.tokenFilePresent, "isolated cub home unexpectedly contains a token");
  check(!isolated.organizationId, "isolated cub context unexpectedly names an organization");
  check(!context.coordinate?.user, "isolated cub context unexpectedly names a user");

  const manifestsRoot = join(installerWork, "out", "manifests");
  check(existsSync(manifestsRoot), "cub installer produced no manifests directory");
  const manifestFiles = readdirSync(manifestsRoot)
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  const docs = manifestFiles.flatMap((name) =>
    parseDocs(readFileSync(join(manifestsRoot, name), "utf8")));
  const objectKinds = docs.map((doc) => doc.kind).sort();
  check(docs.length === 6, `expected 6 rendered NGINX objects, found ${docs.length}`);
  check(
    JSON.stringify(objectKinds) === JSON.stringify([...expectedObjectKinds].sort()),
    `rendered NGINX object kinds changed: ${objectKinds.join(", ")}`,
  );

  const bundleRoot = join(workRoot, "reviewed-files");
  mkdirSync(bundleRoot, { recursive: true });
  for (const name of manifestFiles) {
    cpSync(join(manifestsRoot, name), join(bundleRoot, name));
  }
  writeFileSync(
    join(bundleRoot, "kustomization.yaml"),
    `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
${manifestFiles.map((name) => `  - ${name}\n`).join("")}`,
  );
  return {
    bundleRoot,
    objectCount: docs.length,
    objectKinds,
    filesSha256: inventoryDigest(bundleRoot),
  };
}

function anonymousEnv(isolated) {
  const env = {
    ...process.env,
    HOME: isolated.home,
    DOCKER_CONFIG: isolated.dockerConfigPath.replace(/\/config\.json$/, ""),
    CONFIGHUB_AGENT: "1",
  };
  for (const name of [
    "CUB_CONTEXT",
    "CONFIGHUB_CONTEXT",
    "CONFIGHUB_TOKEN",
    "CONFIGHUB_ACCESS_TOKEN",
  ]) {
    delete env[name];
  }
  return env;
}

function startRegistry(name) {
  command("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "-p",
    "127.0.0.1::5000",
    "registry:2",
  ], { timeout: 120_000 });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const port = tryCommand("docker", ["port", name, "5000/tcp"]);
    const match = port.output.match(/127\.0\.0\.1:(\d+)/);
    if (match) {
      const ready = tryCommand("curl", [
        "-fsS",
        `http://127.0.0.1:${match[1]}/v2/`,
      ]);
      if (ready.ok) {
        return {
          host: `127.0.0.1:${match[1]}`,
          clusterHost: `host.docker.internal:${match[1]}`,
        };
      }
    }
    sleep(1000);
  }
  throw new Error("temporary OCI registry did not become ready");
}

function pushAndPullOutput({
  bundleRoot,
  pullRoot,
  registryHost,
  dockerConfigPath,
}) {
  const repository = "reviewed-nginx";
  const reference = `oci://${registryHost}/${repository}:24.0.2`;
  const env = {
    ...process.env,
    DOCKER_CONFIG: dockerConfigPath.replace(/\/config\.json$/, ""),
  };
  command("flux", [
    "push",
    "artifact",
    reference,
    `--path=${bundleRoot}`,
    "--source",
    "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2",
    "--revision",
    "catalog@sha1:2ad752b92ec7fe256da54a2b86fc0afde30d1f9",
    "--reproducible",
    "--insecure-registry",
    "--output",
    "json",
  ], { env, timeout: 180_000 });
  const descriptor = JSON.parse(command("oras", [
    "manifest",
    "fetch",
    "--plain-http",
    "--registry-config",
    dockerConfigPath,
    "--descriptor",
    stripOci(reference),
  ], { timeout: 120_000 }));
  const digest = normalizeDigest(descriptor.digest);
  check(digest, "output OCI has no manifest digest");

  mkdirSync(pullRoot, { recursive: true });
  command("flux", [
    "pull",
    "artifact",
    `${reference.split(":24.0.2")[0]}@${digest}`,
    "--output",
    pullRoot,
    "--insecure-registry",
  ], { env, timeout: 180_000 });
  check(
    inventoryDigest(pullRoot) === inventoryDigest(bundleRoot),
    "files pulled from the output OCI differ from the reviewed files",
  );
  return {
    reference,
    digest,
    anonymousPull: "pass",
    pulledFilesMatched: true,
    filesSha256: inventoryDigest(bundleRoot),
  };
}

function createCluster(name, kubeconfig) {
  command("kind", [
    "create",
    "cluster",
    "--name",
    name,
    "--wait",
    "120s",
  ], { timeout: 300_000 });
  const config = command("kind", ["get", "kubeconfig", "--name", name]);
  writeFileSync(kubeconfig, config);
}

function reconcileWithFlux({
  clusterName,
  kubeconfig,
  registry,
  digest,
}) {
  const env = {
    ...process.env,
    KUBECONFIG: kubeconfig,
  };
  command("flux", [
    "install",
    "--components=source-controller,kustomize-controller",
  ], { env, timeout: 300_000 });
  kubectl(kubeconfig, [
    "-n",
    "flux-system",
    "rollout",
    "status",
    "deployment/source-controller",
    "--timeout=180s",
  ]);
  kubectl(kubeconfig, [
    "-n",
    "flux-system",
    "rollout",
    "status",
    "deployment/kustomize-controller",
    "--timeout=180s",
  ]);

  const sourceName = "reviewed-nginx";
  command("flux", [
    "create",
    "source",
    "oci",
    sourceName,
    `--url=oci://${registry.clusterHost}/reviewed-nginx`,
    `--digest=${digest}`,
    "--insecure",
    "--interval=30s",
    "--namespace=flux-system",
    "--timeout=3m",
  ], { env, timeout: 300_000 });
  command("flux", [
    "create",
    "kustomization",
    sourceName,
    `--source=OCIRepository/${sourceName}`,
    "--path=./",
    "--prune=true",
    "--interval=30s",
    "--namespace=flux-system",
    "--timeout=4m",
  ], { env, timeout: 360_000 });

  let state = {
    sourceReady: false,
    kustomizationReady: false,
    observedDigest: "",
    contentDigest: "",
    deployment: {
      namespace,
      name: "nginx",
      readyReplicas: 0,
      desiredReplicas: 1,
      image: "",
    },
  };
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const source = kubectlTry(kubeconfig, [
      "-n",
      "flux-system",
      "get",
      "ocirepository",
      sourceName,
      "-o",
      "json",
    ]);
    const kustomization = kubectlTry(kubeconfig, [
      "-n",
      "flux-system",
      "get",
      "kustomization",
      sourceName,
      "-o",
      "json",
    ]);
    const deployment = kubectlTry(kubeconfig, [
      "-n",
      namespace,
      "get",
      "deployment",
      "nginx",
      "-o",
      "json",
    ]);
    const sourceObject = source.ok ? JSON.parse(source.output) : {};
    const kustomizationObject = kustomization.ok
      ? JSON.parse(kustomization.output)
      : {};
    const deploymentObject = deployment.ok ? JSON.parse(deployment.output) : {};
    state = {
      sourceReady: conditionTrue(sourceObject, "Ready"),
      kustomizationReady: conditionTrue(kustomizationObject, "Ready"),
      observedDigest: normalizeDigest(
        String(sourceObject.status?.artifact?.revision ?? "")
          .match(/sha256:[0-9a-f]{64}/)?.[0],
      ),
      contentDigest: normalizeDigest(sourceObject.status?.artifact?.digest),
      deployment: {
        namespace,
        name: "nginx",
        readyReplicas: Number(deploymentObject.status?.readyReplicas ?? 0),
        desiredReplicas: Number(deploymentObject.spec?.replicas ?? 1),
        image: String(
          deploymentObject.spec?.template?.spec?.containers?.[0]?.image ?? "",
        ),
      },
    };
    if (
      state.sourceReady
      && state.kustomizationReady
      && state.observedDigest === digest
      && state.deployment.readyReplicas === state.deployment.desiredReplicas
    ) {
      return state;
    }
    sleep(5000);
  }
  throw new Error(
    `Flux did not converge: ${JSON.stringify(state)}`,
  );
}

function conditionTrue(object, type) {
  return object.status?.conditions?.some(
    (condition) => condition.type === type && condition.status === "True",
  ) ?? false;
}

function verifyReceipt(receipt) {
  const publication = readYaml(publicationReceiptPath);
  verifyPublicationReceipt(publication);
  check(
    receipt.kind === "AnonymousOciFluxProofReceipt",
    "anonymous OCI proof receipt kind changed",
  );
  check(receipt.status?.result === "pass", "anonymous OCI proof is not pass");
  check(receipt.spec?.pathway === "OCI -> work -> OCI", "anonymous OCI pathway changed");
  check(receipt.spec?.source?.chart === chart, "anonymous OCI chart changed");
  check(receipt.spec?.source?.version === version, "anonymous OCI chart version changed");
  check(receipt.spec?.source?.base === base, "anonymous OCI base changed");
  check(
    receipt.spec?.source?.reference === publication.spec.ref,
    "anonymous OCI source reference differs from its publication receipt",
  );
  check(
    receipt.spec?.source?.expectedManifestDigest
      === publicationManifestDigest(publication),
    "anonymous OCI source manifest differs from its publication receipt",
  );
  check(
    receipt.spec?.source?.expectedPackageLayerDigest
      === normalizeDigest(publication.spec.package.sha256),
    "anonymous OCI package layer differs from its publication receipt",
  );
  check(
    receipt.spec?.source?.anonymousManifestPull === "pass",
    "public input OCI was not pulled anonymously",
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(
      receipt.spec?.source?.expectedManifestDigest ?? "",
    ),
    "public input OCI manifest digest is missing",
  );
  check(
    receipt.spec?.localWork?.configHubTokenFilePresent === false,
    "anonymous cub home contains a ConfigHub token",
  );
  check(
    receipt.spec?.localWork?.configHubOrganization === "",
    "anonymous cub home names a ConfigHub organization",
  );
  check(
    receipt.spec?.localWork?.objectCount === 6,
    "anonymous render must contain six NGINX objects",
  );
  check(
    JSON.stringify(receipt.spec?.localWork?.objectKinds)
      === JSON.stringify([...expectedObjectKinds].sort()),
    "anonymous render object kinds changed",
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(receipt.spec?.output?.digest ?? ""),
    "output OCI digest is missing",
  );
  check(
    receipt.spec?.output?.anonymousPull === "pass",
    "output OCI anonymous pull is not pass",
  );
  check(
    receipt.spec?.output?.pulledFilesMatched === true,
    "output OCI files do not match the reviewed files",
  );
  check(
    receipt.spec?.output?.filesSha256 === receipt.spec?.localWork?.filesSha256,
    "output OCI file inventory differs from local work",
  );
  check(receipt.spec?.flux?.sourceReady === true, "Flux OCI source is not ready");
  check(
    receipt.spec?.flux?.kustomizationReady === true,
    "Flux Kustomization is not ready",
  );
  check(
    receipt.spec?.flux?.observedDigest === receipt.spec.output.digest,
    "Flux observed a different OCI digest",
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(receipt.spec?.flux?.contentDigest ?? ""),
    "Flux content digest is missing",
  );
  check(
    receipt.spec?.flux?.deployment?.readyReplicas === 1
      && receipt.spec?.flux?.deployment?.desiredReplicas === 1,
    "NGINX did not reach 1/1 replicas",
  );
  check(
    receipt.spec?.flux?.deployment?.image
      === "registry-1.docker.io/bitnami/nginx@sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f",
    "NGINX runtime image changed",
  );
  check(
    Object.values(receipt.spec?.run?.cleanup ?? {}).every(
      (value) => value === "pass",
    ),
    "anonymous OCI proof cleanup did not pass",
  );
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  return `# Public OCI in, reviewed files, OCI out

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from a live receipt. Run \`npm run serverless-oci-gitops:proof\` to repeat it, or \`npm run serverless-oci-gitops:proof:verify\` to check the committed result.

This run started with the public ${spec.source.chart}@${spec.source.version} installer package. \`cub installer\` pulled it using an empty registry credential file and an isolated cub home with no ConfigHub token. It rendered the \`${spec.source.base}\` configuration as ${spec.localWork.objectCount} Kubernetes objects.

The rendered files were then packaged as a second OCI artifact. Flux pulled the exact digest from that artifact and applied it to a throwaway cluster. NGINX reached ${spec.flux.deployment.readyReplicas}/${spec.flux.deployment.desiredReplicas} ready replicas.

| Check | Result |
| --- | --- |
| Public installer OCI pulled without registry credentials | ${spec.source.anonymousManifestPull} |
| ConfigHub token present | ${spec.localWork.configHubTokenFilePresent ? "yes" : "no"} |
| Rendered objects | ${spec.localWork.objectCount}: ${spec.localWork.objectKinds.join(", ")} |
| Output OCI pulled back and compared with the reviewed files | ${spec.output.pulledFilesMatched ? "pass" : "fail"} |
| Output digest | \`${spec.output.digest}\` |
| Flux OCI source | ${spec.flux.sourceReady ? "ready" : "not ready"} |
| Flux Kustomization | ${spec.flux.kustomizationReady ? "ready" : "not ready"} |
| Flux-observed digest matches output | ${spec.flux.observedDigest === spec.output.digest ? "pass" : "fail"} |
| NGINX | ${spec.flux.deployment.readyReplicas}/${spec.flux.deployment.desiredReplicas} ready |
| Cleanup | ${Object.values(spec.run.cleanup).every((value) => value === "pass") ? "pass" : "fail"} |

This proves the temporary, no-account \`OCI -> work -> OCI -> Flux\` path for this NGINX configuration. It does not prove a permanently hosted output service, and it does not cover charts whose hooks or CRDs need lifecycle routes.

- Input publication receipt: \`${spec.source.publicationReceipt}\`
- Live receipt: \`runs/serverless-oci-gitops-proof/receipt.yaml\`
`;
}

function renderHtml(receipt) {
  const spec = receipt.spec;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Public OCI in, reviewed files, OCI out</title></head>
<body>
<main>
<h1>Public OCI in, reviewed files, OCI out</h1>
<p>${escapeHtml(receipt.status.claim)}</p>
<table>
<tr><th>Input</th><td>${escapeHtml(spec.source.reference)}</td></tr>
<tr><th>Rendered objects</th><td>${spec.localWork.objectCount}</td></tr>
<tr><th>Output digest</th><td><code>${escapeHtml(spec.output.digest)}</code></td></tr>
<tr><th>Flux</th><td>${spec.flux.sourceReady && spec.flux.kustomizationReady ? "ready" : "not ready"}</td></tr>
<tr><th>NGINX</th><td>${spec.flux.deployment.readyReplicas}/${spec.flux.deployment.desiredReplicas} ready</td></tr>
</table>
<p>The output registry was temporary. Hooks, CRDs, and permanently hosted output are outside this receipt.</p>
</main>
</body>
</html>
`;
}

function inventoryDigest(root) {
  const inventory = listFiles(root)
    .map((path) => {
      const contents = readFileSync(path);
      return {
        path: relative(root, path).replaceAll("\\", "/"),
        sha256: sha256(contents),
        size: contents.length,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  return normalizeDigest(sha256(JSON.stringify(inventory)));
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function normalizeDigest(value) {
  if (!value) return "";
  const text = String(value);
  return text.startsWith("sha256:") ? text : `sha256:${text}`;
}

function stripOci(reference) {
  return reference.replace(/^oci:\/\//, "");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function command(program, args, {
  cwd = repoRoot,
  env = process.env,
  timeout = 120_000,
} = {}) {
  return execFileSync(program, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    maxBuffer: 1024 * 1024 * 100,
  });
}

function tryCommand(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 120_000,
    maxBuffer: 1024 * 1024 * 100,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function kubectl(kubeconfig, args) {
  return command("kubectl", ["--kubeconfig", kubeconfig, ...args], {
    timeout: 180_000,
  });
}

function kubectlTry(kubeconfig, args) {
  return tryCommand("kubectl", ["--kubeconfig", kubeconfig, ...args], {
    timeout: 180_000,
  });
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function dockerContainerPresent(name) {
  const result = tryCommand("docker", [
    "ps",
    "-a",
    "--filter",
    `name=^/${name}$`,
    "--format",
    "{{.Names}}",
  ]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function sanitizeError(error) {
  return String(error?.stderr ?? error?.message ?? error)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
