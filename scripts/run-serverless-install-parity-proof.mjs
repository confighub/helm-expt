#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { copyInstalledCubPlugin } from "./lib/installed-cub-plugin.mjs";

import {
  canonicalObjectMaps,
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
  "serverless-install-parity-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "serverless-install-parity-proof",
  "summary.md",
);
const htmlPath = join(
  repoRoot,
  "data",
  "serverless-install-parity-proof",
  "summary.html",
);
const publicationReceiptPath = join(
  repoRoot,
  "runs",
  "installer-oci",
  "bitnami-redis",
  "25.5.3",
  "installer-package-publication-receipt.yaml",
);
const chart = "bitnami/redis";
const version = "25.5.3";
const base = "reuse-existing-secret";
const sourceChart = "oci://registry-1.docker.io/bitnamicharts/redis";
const releaseName = "redis";
const comparisonNamespace = "redis";
const helmNamespace = "helm-redis";
const cubNamespace = "redis";
const existingSecretName = "redis-existing-secret";
const existingSecretKey = "redis-password";
const imageDigest =
  "sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25";
const valuesText = `image:
  digest: ${imageDigest}
auth:
  existingSecret: ${existingSecretName}
  existingSecretPasswordKey: ${existingSecretKey}
`;

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
    `${relativeRepo(receiptPath)} is missing; run npm run serverless-install-parity:proof`,
  );
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    existsSync(summaryPath)
      && readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run serverless-install-parity:proof`,
  );
  check(
    existsSync(htmlPath)
      && readFileSync(htmlPath, "utf8") === renderHtml(receipt),
    `${relativeRepo(htmlPath)} is stale; run npm run serverless-install-parity:proof`,
  );
  console.log("verified anonymous Redis render and install parity proof");
} else {
  console.log(`Usage:
  node scripts/run-serverless-install-parity-proof.mjs --run
  node scripts/run-serverless-install-parity-proof.mjs --verify`);
}

function runProof() {
  const publication = readYaml(publicationReceiptPath);
  verifyPublicationReceipt(publication);
  const sourceReference = String(publication.spec.ref);
  const expectedSourceManifestDigest = publicationManifestDigest(publication);
  const runId =
    `${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const clusterName = `hx-redis-parity-${runId}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-redis-parity-"));
  const kubeconfig = join(workRoot, "kubeconfig");
  const cleanup = {
    cluster: "not-created",
    localFiles: "pending",
  };
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "ServerlessInstallParityProofReceipt",
    metadata: {
      name: `redis-existing-secret-${runId}`,
    },
    spec: {
      observedAt: new Date().toISOString(),
      source: {
        chart,
        version,
        base,
        installerPackage: sourceReference,
        expectedManifestDigest: expectedSourceManifestDigest,
        anonymousManifestPull: "not-run",
        helmChart: `${sourceChart}:${version}`,
      },
      render: {
        namespace: comparisonNamespace,
        values: {
          imageDigest,
          existingSecret: existingSecretName,
          existingSecretPasswordKey: existingSecretKey,
        },
        helmObjectCount: 0,
        cubObjectCount: 0,
        semanticObjectMatches: "0/0",
        semanticDiffs: [],
        cubOnlyObjects: [],
        renderedOci: {
          destination: "temporary local OCI layout",
          manifestDigest: "",
          objectSetDigest: "",
          pullBack: "not-run",
          pulledObjectSetMatched: false,
        },
      },
      anonymousClient: {
        isolatedHome: true,
        blankRegistryCredentials: true,
        configHubTokenFilePresent: null,
        configHubOrganization: "",
        configHubUser: "",
      },
      live: {
        cluster: clusterName,
        helm: emptyLiveLane(helmNamespace),
        cub: emptyLiveLane(cubNamespace),
      },
      run: {
        cleanup,
      },
      limits: [
        "The rendered OCI was written to a temporary local OCI layout. The separate NGINX proof publishes a rendered OCI to a registry and lets Flux apply that exact digest.",
        "The multi-preset installer package also contains a clearly labeled static-password demo base. This run selected reuse-existing-secret; its rendered files and rendered OCI contain no password.",
        "This Redis base has no Helm hooks or CRDs. Charts that need lifecycle work use their recorded prerequisite and route contracts.",
        "This run did not create ConfigHub records, variants, approvals, promotions, or releases.",
      ],
    },
    status: {
      result: "blocked",
      claim: "",
      error: "",
    },
  };

  let clusterStarted = false;
  try {
    const isolated = prepareIsolatedCub(workRoot);
    const sourceDescriptor = anonymousSourceDescriptor(
      sourceReference,
      isolated.dockerConfigPath,
    );
    check(
      sourceDescriptor.digest === expectedSourceManifestDigest,
      "anonymous installer-package digest differs from the publication receipt",
    );
    receipt.spec.source.anonymousManifestPull = "pass";

    const valuesPath = join(workRoot, "redis-values.yaml");
    writeFileSync(valuesPath, valuesText);
    const helmYaml = renderHelm(valuesPath, comparisonNamespace);
    const rendered = renderWithCub({
      sourceReference,
      workRoot,
      isolated,
    });
    receipt.spec.anonymousClient = {
      ...receipt.spec.anonymousClient,
      configHubTokenFilePresent: isolated.tokenFilePresent,
      configHubOrganization: isolated.organizationId,
      configHubUser: isolated.userId,
    };

    const comparison = compareRenders(helmYaml, rendered.yaml);
    receipt.spec.render = {
      ...receipt.spec.render,
      helmObjectCount: comparison.helmObjectCount,
      cubObjectCount: comparison.cubObjectCount,
      semanticObjectMatches:
        `${comparison.semanticMatches}/${comparison.helmObjectCount}`,
      semanticDiffs: comparison.semanticDiffs,
      cubOnlyObjects: comparison.cubOnlyObjects,
      renderedOci: rendered.oci,
    };
    check(
      comparison.semanticDiffs.length === 0,
      `cub output differs from Helm: ${comparison.semanticDiffs.join(", ")}`,
    );
    check(
      JSON.stringify(comparison.cubOnlyObjects)
        === JSON.stringify([`v1|Namespace||${comparisonNamespace}`]),
      `unexpected cub-only objects: ${comparison.cubOnlyObjects.join(", ")}`,
    );

    createCluster(clusterName, kubeconfig);
    clusterStarted = true;
    cleanup.cluster = "pending";
    const password = randomBytes(32).toString("base64url");

    createNamespace(kubeconfig, helmNamespace);
    createSecret(kubeconfig, helmNamespace, password);
    helmInstall(kubeconfig, valuesPath);

    applyCubRender(kubeconfig, rendered.manifestsRoot, password);

    receipt.spec.live.helm = waitForRedis(kubeconfig, helmNamespace);
    receipt.spec.live.cub = waitForRedis(kubeconfig, cubNamespace);
    check(
      receipt.spec.live.helm.result === "pass",
      "the Helm Redis lane did not become ready and answer PING",
    );
    check(
      receipt.spec.live.cub.result === "pass",
      "the cub Redis lane did not become ready and answer PING",
    );

    receipt.status.result = "pass";
    receipt.status.claim =
      "With no ConfigHub account or registry login, cub installer pulled the public Redis package and rendered the recommended existing-Secret base. Its 13 chart objects matched Helm field-for-field; cub added only the explicit Namespace. The installer wrote and verified a rendered OCI, and both the Helm and cub lanes reached a ready Redis that answered PING.";
  } catch (error) {
    receipt.status.error = sanitizeError(error);
  } finally {
    if (clusterStarted || clusterPresent(clusterName)) {
      tryCommand("kind", ["delete", "cluster", "--name", clusterName], {
        timeout: 240_000,
      });
    }
    cleanup.cluster = clusterPresent(clusterName) ? "fail" : "pass";

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
    "Redis installer publication receipt kind changed",
  );
  check(
    receipt.spec?.ref
      === "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3",
    "Redis installer publication reference changed",
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(publicationManifestDigest(receipt)),
    "Redis installer publication receipt has no manifest digest",
  );
}

function publicationManifestDigest(receipt) {
  return String(receipt.spec?.outputs?.push ?? "")
    .match(/manifest:\s*(sha256:[0-9a-f]{64})/)?.[1] ?? "";
}

function prepareIsolatedCub(workRoot) {
  const home = join(workRoot, "anonymous-home");
  const dockerRoot = join(workRoot, "anonymous-docker");
  const dockerConfigPath = join(dockerRoot, "config.json");
  copyInstalledCubPlugin({
    commandName: "installer",
    home,
    pluginName: "installer",
  });
  mkdirSync(dockerRoot, { recursive: true });
  writeFileSync(dockerConfigPath, '{"auths":{}}\n');
  return {
    home,
    dockerConfigPath,
    tokenFilePresent: false,
    organizationId: "",
    userId: "",
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

function anonymousSourceDescriptor(reference, dockerConfigPath) {
  return JSON.parse(command("oras", [
    "manifest",
    "fetch",
    "--registry-config",
    dockerConfigPath,
    "--descriptor",
    stripOci(reference),
  ], { timeout: 120_000 }));
}

function renderHelm(valuesPath, namespace) {
  return command("helm", [
    "template",
    releaseName,
    sourceChart,
    "--version",
    version,
    "--namespace",
    namespace,
    "--values",
    valuesPath,
    "--kube-version",
    "1.30.0",
    "--include-crds",
    "--skip-tests",
    "--no-hooks",
  ], { timeout: 240_000 });
}

function renderWithCub({
  sourceReference,
  workRoot,
  isolated,
}) {
  const installerWork = join(workRoot, "installer");
  const ociLayout = join(workRoot, "redis-rendered.oci");
  const env = anonymousEnv(isolated);
  const output = command("cub", [
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
    comparisonNamespace,
    "--output-oci",
    ociLayout,
  ], { env, timeout: 300_000 });

  const contexts = JSON.parse(command("cub", [
    "context",
    "list",
    "-o",
    "json",
  ], { env, timeout: 30_000 }));
  const context = contexts[0] ?? {};
  const tokenRoot = join(isolated.home, ".confighub", "tokens");
  isolated.tokenFilePresent =
    existsSync(tokenRoot) && listFiles(tokenRoot).length > 0;
  isolated.organizationId =
    String(context.coordinate?.organizationID ?? "");
  isolated.userId = String(context.coordinate?.user ?? "");
  check(
    !isolated.tokenFilePresent,
    "isolated cub home unexpectedly contains a token",
  );
  check(
    !isolated.organizationId,
    "isolated cub context unexpectedly names an organization",
  );
  check(
    !isolated.userId,
    "isolated cub context unexpectedly names a user",
  );

  const manifestsRoot = join(installerWork, "out", "manifests");
  check(
    existsSync(manifestsRoot),
    "cub installer produced no manifests directory",
  );
  const yaml = readYamlDirectory(manifestsRoot);
  const docs = parseDocs(yaml);
  check(docs.length === 14, `expected 14 cub objects, found ${docs.length}`);
  check(
    !existsSync(join(installerWork, "out", "secrets"))
      || listYamlFiles(join(installerWork, "out", "secrets")).length === 0,
    "the existing-Secret base unexpectedly rendered credential material",
  );

  const index = JSON.parse(readFileSync(join(ociLayout, "index.json"), "utf8"));
  const descriptor = index.manifests?.[0] ?? {};
  const objectSetDigest =
    String(descriptor.annotations?.[
      "installer.confighub.com/object-set-digest"
    ] ?? "");
  check(
    /^sha256:[0-9a-f]{64}$/.test(descriptor.digest ?? ""),
    "rendered OCI manifest digest is missing",
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(objectSetDigest),
    "rendered OCI object-set digest is missing",
  );
  check(
    output.includes("pull-back: verified"),
    "cub installer did not report a verified rendered-OCI pull-back",
  );

  const pulledYaml = pullRenderedOci(ociLayout, workRoot);
  const pulledComparison = canonicalObjectMaps(yaml, pulledYaml);
  check(
    JSON.stringify(pulledComparison.helm)
      === JSON.stringify(pulledComparison.cub),
    "objects pulled from the rendered OCI differ from the reviewed files",
  );

  return {
    manifestsRoot,
    yaml,
    oci: {
      destination: "temporary local OCI layout",
      manifestDigest: descriptor.digest,
      objectSetDigest,
      pullBack: "verified",
      pulledObjectSetMatched: true,
    },
  };
}

function pullRenderedOci(ociLayout, workRoot) {
  const pulled = join(workRoot, "pulled-rendered-oci");
  const extracted = join(pulled, "extracted");
  mkdirSync(pulled, { recursive: true });
  mkdirSync(extracted, { recursive: true });
  command("oras", [
    "pull",
    "--oci-layout",
    `${ociLayout}:latest`,
    "--output",
    pulled,
  ], { timeout: 120_000 });
  const archive = join(pulled, "rendered-manifests.tar.gz");
  check(existsSync(archive), "rendered OCI has no manifest layer");
  command("tar", ["-xzf", archive, "-C", extracted], {
    timeout: 120_000,
  });
  return readYamlDirectory(join(extracted, "manifests"));
}

function compareRenders(helmYaml, cubYaml) {
  const semantic = canonicalObjectMaps(helmYaml, cubYaml);
  const helmKeys = Object.keys(semantic.helm).sort();
  const cubKeys = Object.keys(semantic.cub).sort();
  const semanticDiffs = helmKeys.filter(
    (key) => semantic.helm[key] !== semantic.cub[key],
  );
  const cubOnlyObjects = cubKeys.filter((key) => !(key in semantic.helm));
  const missingObjects = helmKeys.filter((key) => !(key in semantic.cub));
  semanticDiffs.push(...missingObjects);
  return {
    helmObjectCount: helmKeys.length,
    cubObjectCount: cubKeys.length,
    semanticMatches:
      helmKeys.filter((key) => semantic.helm[key] === semantic.cub[key]).length,
    semanticDiffs: [...new Set(semanticDiffs)].sort(),
    cubOnlyObjects,
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
  writeFileSync(
    kubeconfig,
    command("kind", ["get", "kubeconfig", "--name", name]),
  );
}

function createNamespace(kubeconfig, namespace) {
  kubectl(kubeconfig, ["create", "namespace", namespace]);
}

function createSecret(kubeconfig, namespace, password) {
  kubectl(kubeconfig, [
    "-n",
    namespace,
    "create",
    "secret",
    "generic",
    existingSecretName,
    `--from-literal=${existingSecretKey}=${password}`,
  ]);
}

function helmInstall(kubeconfig, valuesPath) {
  command("helm", [
    "--kubeconfig",
    kubeconfig,
    "install",
    releaseName,
    sourceChart,
    "--version",
    version,
    "--namespace",
    helmNamespace,
    "--values",
    valuesPath,
  ], { timeout: 300_000 });
}

function applyCubRender(kubeconfig, manifestsRoot, password) {
  kubectl(kubeconfig, [
    "apply",
    "-f",
    join(manifestsRoot, `namespace-${cubNamespace}.yaml`),
  ]);
  createSecret(kubeconfig, cubNamespace, password);
  kubectl(kubeconfig, ["apply", "-f", manifestsRoot]);
}

function waitForRedis(kubeconfig, namespace) {
  const result = emptyLiveLane(namespace);
  const master = waitForStatefulSet(
    kubeconfig,
    namespace,
    "redis-master",
    1,
  );
  const replicas = waitForStatefulSet(
    kubeconfig,
    namespace,
    "redis-replicas",
    3,
  );
  result.masterReady = master.ready;
  result.masterDesired = master.desired;
  result.replicasReady = replicas.ready;
  result.replicasDesired = replicas.desired;
  if (
    master.ready === master.desired
    && replicas.ready === replicas.desired
  ) {
    const ping = tryCommand("kubectl", [
      "--kubeconfig",
      kubeconfig,
      "-n",
      namespace,
      "exec",
      "redis-master-0",
      "--",
      "sh",
      "-ec",
      'REDISCLI_AUTH="$(cat /opt/bitnami/redis/secrets/redis-password)" redis-cli -h 127.0.0.1 ping',
    ], { timeout: 60_000 });
    result.ping = ping.ok && ping.output.trim().endsWith("PONG")
      ? "PONG"
      : "failed";
  }
  result.result =
    result.masterReady === result.masterDesired
      && result.replicasReady === result.replicasDesired
      && result.ping === "PONG"
      ? "pass"
      : "blocked";
  return result;
}

function waitForStatefulSet(
  kubeconfig,
  namespace,
  name,
  expectedReplicas,
) {
  let state = { ready: 0, desired: expectedReplicas };
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const response = tryCommand("kubectl", [
      "--kubeconfig",
      kubeconfig,
      "-n",
      namespace,
      "get",
      "statefulset",
      name,
      "-o",
      "json",
    ], { timeout: 30_000 });
    if (response.ok) {
      const object = JSON.parse(response.output);
      state = {
        ready: Number(object.status?.readyReplicas ?? 0),
        desired: Number(object.spec?.replicas ?? expectedReplicas),
      };
      if (state.ready === state.desired) return state;
    }
    sleep(5000);
  }
  return state;
}

function emptyLiveLane(namespace) {
  return {
    namespace,
    existingSecretCreatedBeforeInstall: true,
    masterReady: 0,
    masterDesired: 1,
    replicasReady: 0,
    replicasDesired: 3,
    ping: "not-run",
    result: "not-run",
  };
}

function verifyReceipt(receipt) {
  const publication = readYaml(publicationReceiptPath);
  verifyPublicationReceipt(publication);
  check(
    receipt.kind === "ServerlessInstallParityProofReceipt",
    "serverless Redis receipt kind changed",
  );
  check(
    receipt.status?.result === "pass",
    "serverless Redis proof is not pass",
  );
  check(
    receipt.spec?.source?.chart === chart
      && receipt.spec?.source?.version === version
      && receipt.spec?.source?.base === base,
    "serverless Redis source changed",
  );
  check(
    receipt.spec?.source?.installerPackage === publication.spec.ref,
    "serverless Redis source differs from its publication receipt",
  );
  check(
    receipt.spec?.source?.expectedManifestDigest
      === publicationManifestDigest(publication),
    "serverless Redis source digest differs from its publication receipt",
  );
  check(
    receipt.spec?.source?.anonymousManifestPull === "pass",
    "Redis installer package was not checked anonymously",
  );
  check(
    receipt.spec?.render?.helmObjectCount === 13,
    "Redis Helm object count changed",
  );
  check(
    receipt.spec?.render?.cubObjectCount === 14,
    "Redis cub object count changed",
  );
  check(
    receipt.spec?.render?.semanticObjectMatches === "13/13",
    "Redis semantic object parity changed",
  );
  check(
    receipt.spec?.render?.semanticDiffs?.length === 0,
    "Redis render has semantic differences",
  );
  check(
    JSON.stringify(receipt.spec?.render?.cubOnlyObjects)
      === JSON.stringify([`v1|Namespace||${comparisonNamespace}`]),
    "Redis cub-only support object changed",
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(
      receipt.spec?.render?.renderedOci?.manifestDigest ?? "",
    ),
    "rendered Redis OCI manifest digest is missing",
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(
      receipt.spec?.render?.renderedOci?.objectSetDigest ?? "",
    ),
    "rendered Redis OCI object-set digest is missing",
  );
  check(
    receipt.spec?.render?.renderedOci?.pullBack === "verified"
      && receipt.spec?.render?.renderedOci?.pulledObjectSetMatched === true,
    "rendered Redis OCI pull-back is not verified",
  );
  check(
    receipt.spec?.anonymousClient?.isolatedHome === true
      && receipt.spec?.anonymousClient?.blankRegistryCredentials === true
      && receipt.spec?.anonymousClient?.configHubTokenFilePresent === false
      && !receipt.spec?.anonymousClient?.configHubOrganization
      && !receipt.spec?.anonymousClient?.configHubUser,
    "the Redis proof did not establish an anonymous client",
  );
  for (const lane of ["helm", "cub"]) {
    const live = receipt.spec?.live?.[lane];
    check(live?.result === "pass", `${lane} Redis lane is not pass`);
    check(
      live?.masterReady === live?.masterDesired
        && live?.replicasReady === live?.replicasDesired
        && live?.ping === "PONG",
      `${lane} Redis lane did not become ready and answer PING`,
    );
  }
  check(
    receipt.spec?.run?.cleanup?.cluster === "pass"
      && receipt.spec?.run?.cleanup?.localFiles === "pass",
    "serverless Redis proof cleanup did not pass",
  );
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  const render = spec.render;
  const helm = spec.live.helm;
  const cub = spec.live.cub;
  return `# Redis: Helm and cub produce the same working result

This live test starts with the public Redis installer package and its recommended \`${base}\` preset. It uses a fresh client with no ConfigHub token, organization, user, or registry login.

**Result: ${receipt.status.result}.** ${receipt.status.claim}

## What was compared

| Check | Result |
| --- | --- |
| Public installer package | \`${spec.source.installerPackage}\` |
| Published package digest | \`${spec.source.expectedManifestDigest}\` |
| Helm inputs | Redis ${version}; pinned image digest; existing Secret \`${existingSecretName}\` key \`${existingSecretKey}\` |
| Helm chart objects | ${render.helmObjectCount} |
| cub objects | ${render.cubObjectCount}: the same ${render.helmObjectCount} chart objects plus an explicit Namespace |
| Full object comparison | ${render.semanticObjectMatches}; no differing fields |
| Rendered OCI | \`${render.renderedOci.manifestDigest}\` |
| Rendered OCI object set | \`${render.renderedOci.objectSetDigest}\` |
| OCI pull-back | ${render.renderedOci.pullBack}; pulled objects matched the files |
| ConfigHub account | not used |

## What ran

| Lane | Master | Replicas | Redis command | Result |
| --- | --- | --- | --- | --- |
| Helm install | ${helm.masterReady}/${helm.masterDesired} ready | ${helm.replicasReady}/${helm.replicasDesired} ready | ${helm.ping} | ${helm.result} |
| cub render, then kubectl apply | ${cub.masterReady}/${cub.masterDesired} ready | ${cub.replicasReady}/${cub.replicasDesired} ready | ${cub.ping} | ${cub.result} |

Both namespaces received a freshly generated \`${existingSecretName}\` before the workloads were installed. The selected preset, rendered files, rendered OCI, and receipt stored no password. The multi-preset source package also carries a clearly labeled static-password demo base for comparison; this run did not select it.

The rendered OCI in this test was a temporary local layout. The companion [NGINX OCI-to-Flux proof](../serverless-oci-gitops-proof/summary.md) publishes a rendered OCI to a registry and verifies that Flux applies its exact digest.

Receipt: \`${relativeRepo(receiptPath)}\`.
`;
}

function renderHtml(receipt) {
  const spec = receipt.spec;
  const render = spec.render;
  const helm = spec.live.helm;
  const cub = spec.live.cub;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redis: Helm and cub produce the same working result</title>
  <style>
    body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
    main{max-width:900px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 .45rem}h2{font-size:1.05rem;margin-top:1.6rem}
    .lead{font-size:1rem;color:#3d444d}.result{background:#dafbe1;border-left:4px solid #1a7f37;padding:.75rem 1rem}
    table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de}
    th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #d8dee4;vertical-align:top}
    th{background:#f0f3f6}tr:last-child td{border-bottom:0}code{font-size:.88em;overflow-wrap:anywhere}
    .note{color:#57606a}a{color:#0969da}
  </style>
</head>
<body>
<main>
  <h1>Redis: Helm and cub produce the same working result</h1>
  <p class="lead">This live test uses the public Redis package and the recommended <code>${base}</code> preset. The client has no ConfigHub token, organization, user, or registry login.</p>
  <p class="result"><strong>${escapeHtml(receipt.status.result)}.</strong> ${escapeHtml(receipt.status.claim)}</p>
  <h2>What was compared</h2>
  <table>
    <tbody>
      <tr><th>Public installer package</th><td><code>${escapeHtml(spec.source.installerPackage)}</code></td></tr>
      <tr><th>Published package digest</th><td><code>${escapeHtml(spec.source.expectedManifestDigest)}</code></td></tr>
      <tr><th>Helm inputs</th><td>Redis ${version}; pinned image digest; existing Secret <code>${existingSecretName}</code> key <code>${existingSecretKey}</code></td></tr>
      <tr><th>Full object comparison</th><td>${render.semanticObjectMatches}; no differing fields. cub adds one explicit Namespace.</td></tr>
      <tr><th>Rendered OCI</th><td><code>${render.renderedOci.manifestDigest}</code></td></tr>
      <tr><th>Rendered OCI object set</th><td><code>${render.renderedOci.objectSetDigest}</code></td></tr>
      <tr><th>OCI pull-back</th><td>${render.renderedOci.pullBack}; pulled objects matched the files</td></tr>
      <tr><th>ConfigHub account</th><td>not used</td></tr>
    </tbody>
  </table>
  <h2>What ran</h2>
  <table>
    <thead><tr><th>Lane</th><th>Master</th><th>Replicas</th><th>Redis command</th><th>Result</th></tr></thead>
    <tbody>
      <tr><td>Helm install</td><td>${helm.masterReady}/${helm.masterDesired} ready</td><td>${helm.replicasReady}/${helm.replicasDesired} ready</td><td>${helm.ping}</td><td>${helm.result}</td></tr>
      <tr><td>cub render, then kubectl apply</td><td>${cub.masterReady}/${cub.masterDesired} ready</td><td>${cub.replicasReady}/${cub.replicasDesired} ready</td><td>${cub.ping}</td><td>${cub.result}</td></tr>
    </tbody>
  </table>
  <p>Both namespaces received a freshly generated <code>${existingSecretName}</code> before install. The selected preset, rendered files, rendered OCI, and receipt stored no password. The multi-preset source package also carries a clearly labeled static-password demo base for comparison; this run did not select it.</p>
  <p class="note">The rendered OCI in this test was a temporary local layout. The companion NGINX proof publishes a rendered OCI to a registry and lets Flux apply its exact digest.</p>
</main>
</body>
</html>
`;
}

function readYamlDirectory(root) {
  return listYamlFiles(root)
    .map((name) => readFileSync(join(root, name), "utf8"))
    .join("\n---\n");
}

function listYamlFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort();
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, name.name);
    if (name.isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files;
}

function kubectl(kubeconfig, args) {
  return command("kubectl", ["--kubeconfig", kubeconfig, ...args], {
    timeout: 300_000,
  });
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"], {
    timeout: 30_000,
  });
  return result.ok
    && result.output.split(/\r?\n/).map((item) => item.trim()).includes(name);
}

function stripOci(reference) {
  return reference.replace(/^oci:\/\//, "");
}

function command(commandName, args, options = {}) {
  return execFileSync(commandName, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 120_000,
    maxBuffer: 1024 * 1024 * 200,
  });
}

function tryCommand(commandName, args, options = {}) {
  try {
    return {
      ok: true,
      output: command(commandName, args, options),
    };
  } catch (error) {
    return {
      ok: false,
      output: [
        error.stdout?.toString() ?? "",
        error.stderr?.toString() ?? "",
        error.message ?? String(error),
      ].filter(Boolean).join("\n"),
    };
  }
}

function sanitizeError(error) {
  return [
    error.stdout?.toString() ?? "",
    error.stderr?.toString() ?? "",
    error.message ?? String(error),
  ]
    .filter(Boolean)
    .join("\n")
    .replaceAll(/\s+/g, " ")
    .slice(0, 1000);
}

function sleep(milliseconds) {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    milliseconds,
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
