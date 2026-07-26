#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  canonicalObjectMaps,
  check,
  cubEnv,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set(["--run", "--generate", "--verify"]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/run-oci-deploy-stage-rollout-proof.mjs --run
  node scripts/run-oci-deploy-stage-rollout-proof.mjs --generate
  node scripts/run-oci-deploy-stage-rollout-proof.mjs --verify`);
  process.exit(2);
}

const sourcePath = join(
  repoRoot,
  "recipes",
  "bitnami",
  "nginx",
  "24.0.2",
  "revisions",
  "http-clusterip",
  "r001",
  "rendered",
  "release-objects.yaml",
);
const sourceRecordPath = join(
  repoRoot,
  "data",
  "base-variant-records",
  "records",
  "bitnami-nginx-24-0-2-http-clusterip.yaml",
);
const receiptPath = join(
  repoRoot,
  "runs",
  "oci-deploy-stage-rollout-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "oci-deploy-stage-rollout-proof",
  "summary.md",
);
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const layerType = "application/yaml";
const deployableLayerType = "application/vnd.oci.image.layer.v1.tar+gzip";
const configHubOciHost = "oci.hub.confighub.com:443";
const expectedImage = "registry-1.docker.io/bitnami/nginx@sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f";

if (mode === "--run") {
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  validateReceipt(receipt);
  console.log(
    `wrote OCI deploy-stage-rollout proof -> ${relativeRepo(receiptPath)} result=${receipt.status.result}`,
  );
  process.exit(0);
}

check(
  existsSync(receiptPath),
  `${relativeRepo(receiptPath)} is missing; run npm run oci-deploy-stage-rollout:run`,
);
const receipt = readYaml(receiptPath);
validateReceipt(receipt);
const summary = renderSummary(receipt);

if (mode === "--generate") {
  write(summaryPath, summary);
  console.log(`wrote OCI deploy-stage-rollout summary -> ${relativeRepo(summaryPath)}`);
} else {
  check(
    existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summary,
    `${relativeRepo(summaryPath)} is stale; run npm run oci-deploy-stage-rollout:generate`,
  );
  console.log("verified OCI deploy-stage-rollout proof");
}

function runProof() {
  assertScratchContext();
  const toolChecks = [
    ["cub", ["version"]],
    ["docker", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["oras", ["version"]],
  ];
  for (const [tool, args] of toolChecks) {
    const result = tryCommand(tool, args);
    check(result.ok, `${tool} is required for the OCI deploy-stage-rollout proof`);
  }

  const observedAt = new Date().toISOString();
  const suffix = `${observedAt.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const runName = `hx-oci-flow-${suffix}`;
  const clusterA = `${runName}-a`;
  const clusterB = `${runName}-b`;
  const clusterSpaceA = `${clusterA}-cluster`;
  const clusterSpaceB = `${clusterB}-cluster`;
  const targetA = `${clusterSpaceA}/oci`;
  const baseSpace = `${runName}-base`;
  const devSpace = `${runName}-dev`;
  const stagingSpace = `${runName}-staging`;
  const registryName = `${runName}-registry`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-oci-flow-"));
  const sourceYaml = readFileSync(sourcePath, "utf8");
  const sourceSha256 = sha256(sourceYaml);
  const sourceRecord = readYaml(sourceRecordPath);
  const createdSpaces = [];
  const clustersUp = [];
  let registryUp = false;
  let failure = "";

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "OciDeployStageRolloutReceipt",
    metadata: {
      name: "bitnami-nginx-24-0-2-http-clusterip",
    },
    spec: {
      observedAt,
      source: {
        type: "literal-kubernetes-oci",
        originalSource: "helm-catalog-base",
        chart: "bitnami/nginx",
        version: "24.0.2",
        presetConfig: "http-clusterip",
        sourceRecord: relativeRepo(sourceRecordPath),
        objects: relativeRepo(sourcePath),
        objectCount: sourceRecord.spec.configuration.objectCount,
        yamlSha256: sourceSha256,
        artifactType,
      },
      serverlessInput: {
        result: "not-run",
      },
      serverlessOutput: {
        result: "not-run",
      },
      configHub: {
        import: { result: "not-run" },
        chain: {
          path: "base -> development -> staging",
          result: "not-run",
        },
        change: {
          field: "Deployment/nginx spec.replicas",
          before: 1,
          after: 2,
          result: "not-run",
        },
        promotions: {
          development: { result: "not-run" },
          staging: { result: "not-run" },
        },
      },
      delivery: {
        passThrough: { result: "not-run" },
        development: { result: "not-run" },
        stagingRelease: { result: "not-run" },
        fleet: {
          size: 2,
          result: "not-run",
          targets: [],
        },
      },
      run: {
        clusterCommand: "cub cluster up",
        targetShape: "two throwaway cub-managed kind clusters with Argo CD",
        sourceRegistry: "temporary local OCI registry",
        organizationPurpose: "ephemeral scratch organization",
        cleanup: {
          sourceRegistry: "pending",
          baseSpace: "pending",
          developmentSpace: "pending",
          stagingSpace: "pending",
          clusterA: "pending",
          clusterB: "pending",
          localFiles: "pending",
        },
      },
      limits: [
        "The input and portable output OCI packages used a temporary local registry. Public Google Artifact Registry publication is a separate receipt.",
        "This proves one NGINX catalog configuration on two throwaway kind clusters, not every chart or production target.",
        "This test read Argo CD and Kubernetes status directly. It did not test ConfigHub's cluster observation feed.",
        "The test did not exercise hooks, CRDs, Secrets, or admission webhooks; those keep their separate lifecycle routes and receipts.",
        "ConfigHub's target-scoped OCI credential was not shared between clusters. The fleet consumed the portable anonymous OCI output instead.",
      ],
    },
    status: {
      result: "blocked",
      claim: "",
    },
  };

  try {
    const registry = startRegistry(registryName);
    registryUp = true;
    const inputOci = publishInputOci({
      workRoot,
      sourceYaml,
      registryHost: registry.host,
    });
    receipt.spec.serverlessInput = {
      result: "pass",
      reference: inputOci.reference,
      digest: inputOci.digest,
      anonymousLocalPull: "pass",
      pulledYamlSha256: inputOci.pulledYamlSha256,
      objectsMatched: true,
      note: "This local proof needs no ConfigHub server until the OCI is uploaded.",
    };

    clusterUp(clusterA);
    clustersUp.push(clusterA);

    cub([
      "variant",
      "upload",
      "--component",
      "nginx-oci-flow",
      "--variant",
      "base",
      "--space",
      baseSpace,
      "--granularity",
      "per-resource",
      "--target",
      targetA,
      "--label",
      "SourceType=literal-oci",
      "--layer",
      "App",
      "--owner",
      "Platform",
      inputOci.reference,
    ], { timeout: 420_000 });
    createdSpaces.push(baseSpace);
    const base = inspectWorkloadSpace(baseSpace, sourceYaml);
    check(base.objectsMatch, "ConfigHub base Units differ from the literal OCI input");
    check(base.deployment.replicas === 1, "base Deployment must begin with one replica");
    check(
      normalizeDigest(base.externalSourceDigest) === inputOci.digest,
      "ConfigHub did not record the input OCI digest",
    );
    receipt.spec.configHub.import = {
      result: "pass",
      space: baseSpace,
      externalSource: base.externalSource,
      externalSourceDigest: normalizeDigest(base.externalSourceDigest),
      unitCount: base.unitCount,
      kubernetesFieldsMatched: true,
      ignoredImporterMetadata: base.ignoredImporterMetadata,
      deploymentUnit: base.deploymentUnit,
    };

    const baseRelease = publishRelease(baseSpace);
    const passThroughPull = pullConfigHubRelease({
      clusterName: clusterA,
      space: baseSpace,
      manifestDigest: baseRelease.manifestDigest,
      expectedYaml: sourceYaml,
      workRoot,
    });
    receipt.spec.delivery.passThrough = {
      result: "pass",
      input: {
        reference: inputOci.reference,
        manifestDigest: inputOci.digest,
        objectCount: sourceRecord.spec.configuration.objectCount,
      },
      output: {
        ...baseRelease,
        resolvedManifestDigest: passThroughPull.manifestDigest,
        objectCount: passThroughPull.objectCount,
      },
      userKubernetesFieldsMatched: true,
      addedConfigHubMetadata: passThroughPull.addedConfigHubMetadata,
      note: "The OCI manifest digests differ because ConfigHub publishes its own release artifact. The specs and user-supplied metadata are unchanged; ConfigHub adds only its confighub.com/origin provenance annotation.",
    };

    cub([
      "variant",
      "create",
      "development",
      baseSpace,
      "--space-pattern",
      `template:${devSpace}`,
      "--environment",
      "Development",
      "--namespace",
      "nginx-development",
      "--target",
      targetA,
      "--wait",
    ], { timeout: 420_000 });
    createdSpaces.push(devSpace);
    cub([
      "variant",
      "create",
      "staging",
      devSpace,
      "--space-pattern",
      `template:${stagingSpace}`,
      "--environment",
      "Staging",
      "--namespace",
      "nginx-staging",
      "--target",
      targetA,
      "--wait",
    ], { timeout: 420_000 });
    createdSpaces.push(stagingSpace);
    const initialDev = inspectWorkloadSpace(devSpace);
    const initialStaging = inspectWorkloadSpace(stagingSpace);
    check(initialDev.deployment.replicas === 1, "development did not clone the one-replica base");
    check(initialDev.deployment.namespace === "nginx-development", "development namespace rewrite failed");
    check(initialStaging.deployment.replicas === 1, "staging did not clone development");
    check(initialStaging.deployment.namespace === "nginx-staging", "staging namespace rewrite failed");
    receipt.spec.configHub.chain = {
      path: "base -> development -> staging",
      result: "pass",
      base: variantLink(baseSpace),
      development: variantLink(devSpace),
      staging: variantLink(stagingSpace),
    };

    const devReleaseV1 = publishRelease(devSpace);
    const devApplication = addApplication({
      clusterName: clusterA,
      clusterSpace: clusterSpaceA,
      target: `${clusterSpaceA}/oci`,
      appName: "nginx-development",
      unitName: "nginx-development-app",
      workloadSpace: devSpace,
      namespace: "nginx-development",
      workRoot,
    });
    const devRuntimeV1 = waitForApplication({
      clusterName: clusterA,
      appName: "nginx-development",
      namespace: "nginx-development",
      replicas: 1,
    });
    check(devRuntimeV1.result === "pass", `development deployment did not become ready: ${devRuntimeV1.reason}`);
    receipt.spec.delivery.development = {
      result: "pass",
      release: devReleaseV1,
      application: devApplication,
      initialRuntime: devRuntimeV1,
    };

    cub([
      "run",
      "set-replicas",
      "--space",
      baseSpace,
      "--unit",
      base.deploymentUnit,
      "--replicas",
      "2",
      "--change-desc",
      "Increase the reviewed NGINX configuration from one replica to two",
      "--wait",
    ], { timeout: 240_000 });
    const changedBase = inspectWorkloadSpace(baseSpace);
    check(changedBase.deployment.replicas === 2, "base replica change did not persist");
    check(inspectWorkloadSpace(devSpace).deployment.replicas === 1, "development changed before promotion");
    check(inspectWorkloadSpace(stagingSpace).deployment.replicas === 1, "staging changed before promotion");
    receipt.spec.configHub.change.result = "pass";

    const devPromotion = promoteVariant({
      space: devSpace,
      beforeReplicas: 1,
      afterReplicas: 2,
      downstreamMustRemain: stagingSpace,
      description: "Promote the two-replica change from base to development",
    });
    receipt.spec.configHub.promotions.development = devPromotion;
    const devReleaseV2 = publishRelease(devSpace);
    const devRuntimeV2 = waitForApplication({
      clusterName: clusterA,
      appName: "nginx-development",
      namespace: "nginx-development",
      replicas: 2,
    });
    check(devRuntimeV2.result === "pass", `promoted development did not become ready: ${devRuntimeV2.reason}`);
    receipt.spec.delivery.development.promotedRelease = devReleaseV2;
    receipt.spec.delivery.development.promotedRuntime = devRuntimeV2;

    const stagingPromotion = promoteVariant({
      space: stagingSpace,
      beforeReplicas: 1,
      afterReplicas: 2,
      description: "Promote the reviewed development configuration to staging",
    });
    receipt.spec.configHub.promotions.staging = stagingPromotion;
    const staged = inspectWorkloadSpace(stagingSpace);
    check(staged.deployment.namespace === "nginx-staging", "staging lost its namespace during promotion");
    const stagingRelease = publishRelease(stagingSpace);
    receipt.spec.delivery.stagingRelease = {
      result: "pass",
      ...stagingRelease,
    };
    const portableRelease = publishSpaceOci({
      workRoot,
      space: stagingSpace,
      registryHost: registry.host,
      clusterRegistryHost: registry.clusterHost,
    });
    receipt.spec.serverlessOutput = {
      result: "pass",
      ...portableRelease,
      note: "The reviewed staging objects were exported as one anonymous OCI package. Pulling this package does not require a ConfigHub account.",
    };

    clusterUp(clusterB);
    clustersUp.push(clusterB);
    const fleetTargets = [];
    for (const [clusterName, clusterSpace] of [
      [clusterA, clusterSpaceA],
      [clusterB, clusterSpaceB],
    ]) {
      const application = addApplication({
        clusterName,
        clusterSpace,
        target: `${clusterSpace}/oci`,
        appName: "nginx-staging",
        unitName: "nginx-staging-app",
        workloadSpace: stagingSpace,
        sourceReference: portableRelease.clusterReference,
        anonymousOciHost: registry.clusterHost,
        namespace: "nginx-staging",
        workRoot,
      });
      const runtime = waitForApplication({
        clusterName,
        appName: "nginx-staging",
        namespace: "nginx-staging",
        replicas: 2,
      });
      check(runtime.result === "pass", `${clusterName} staging rollout did not pass: ${runtime.reason}`);
      fleetTargets.push({
        cluster: clusterName,
        clusterSpace,
        application,
        runtime,
      });
    }
    const revisions = new Set(
      fleetTargets.map((target) => normalizeDigest(target.runtime.revision)).filter(Boolean),
    );
    check(revisions.size === 1, "the two Argo controllers did not report the same OCI revision");
    const [controllerDigest = ""] = revisions;
    check(
      controllerDigest === portableRelease.digest,
      "Argo's staged revision differs from the portable OCI digest",
    );
    receipt.spec.delivery.fleet = {
      size: 2,
      result: "pass",
      sameReleaseDigest: true,
      digest: controllerDigest,
      targets: fleetTargets,
    };
    receipt.status.result = "pass";
    receipt.status.claim = "One literal Kubernetes OCI was imported and republished by ConfigHub with the same specs and user metadata plus a ConfigHub origin annotation, then promoted in sequence through development and staging, exported as one anonymous OCI package, and reconciled at the same digest by Argo CD on two clusters. Both NGINX Deployments reached two ready replicas.";
  } catch (error) {
    failure = sanitizeError(error);
    receipt.status.result = "blocked";
    receipt.status.claim = "The combined OCI deployment, promotion, and rollout proof did not complete.";
    receipt.status.error = failure;
  } finally {
    const cleanup = receipt.spec.run.cleanup;
    for (const [space, key] of [
      [stagingSpace, "stagingSpace"],
      [devSpace, "developmentSpace"],
      [baseSpace, "baseSpace"],
    ]) {
      if (createdSpaces.includes(space) || spacePresent(space)) {
        cubTry(["space", "delete", space, "--recursive-force"], { timeout: 240_000 });
      }
      cleanup[key] = waitUntil(() => !spacePresent(space), 20)
        ? "pass"
        : "fail";
    }
    for (const [clusterName, key] of [
      [clusterB, "clusterB"],
      [clusterA, "clusterA"],
    ]) {
      if (clustersUp.includes(clusterName) || clusterPresent(clusterName)) {
        clusterDown(clusterName);
      }
      cleanup[key] = waitUntil(() => clusterAbsent(clusterName), 30)
        ? "pass"
        : "fail";
    }
    if (registryUp || dockerContainerPresent(registryName)) {
      tryCommand("docker", ["rm", "-f", registryName], { timeout: 120_000 });
    }
    cleanup.sourceRegistry = dockerContainerPresent(registryName) ? "fail" : "pass";
    rmSync(workRoot, { recursive: true, force: true });
    cleanup.localFiles = [
      clusterKubeconfig(clusterA),
      clusterKubeconfig(clusterB),
      clusterEnv(clusterA),
      clusterEnv(clusterB),
    ].every((path) => !existsSync(path))
      ? "pass"
      : "fail";
  }

  const cleanupPass = Object.values(receipt.spec.run.cleanup).every((value) => value === "pass");
  if (!cleanupPass) {
    receipt.status.result = "blocked";
    receipt.status.error = [receipt.status.error, "scratch cleanup did not pass"].filter(Boolean).join("; ");
  }
  if (failure) console.error(`OCI deploy-stage-rollout proof blocked: ${failure}`);
  return receipt;
}

function startRegistry(name) {
  const started = tryCommand("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "-p",
    "127.0.0.1::5000",
    "registry:2",
  ], { timeout: 120_000 });
  check(started.ok, `could not start the temporary OCI registry: ${started.error}`);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const port = tryCommand("docker", ["port", name, "5000/tcp"]);
    const match = port.output.match(/127\.0\.0\.1:(\d+)/);
    if (match) {
      const host = `127.0.0.1:${match[1]}`;
      const ready = tryCommand("curl", ["-fsS", `http://${host}/v2/`]);
      if (ready.ok) {
        return {
          host,
          clusterHost: `host.docker.internal:${match[1]}`,
        };
      }
    }
    sleep(1000);
  }
  throw new Error("temporary OCI registry did not publish a host port");
}

function publishInputOci({ workRoot, sourceYaml, registryHost }) {
  const inputRoot = join(workRoot, "input");
  const pullRoot = join(workRoot, "pulled");
  const sourceFile = join(inputRoot, "release-objects.yaml");
  mkdirSync(inputRoot, { recursive: true });
  writeFileSync(sourceFile, sourceYaml);
  const reference = `oci://${registryHost}/bitnami-nginx-http-clusterip-config:24.0.2`;
  const registryReference = reference.replace(/^oci:\/\//, "");
  const pushed = command("oras", [
    "push",
    "--plain-http",
    "--artifact-type",
    artifactType,
    "--format",
    "json",
    registryReference,
    `release-objects.yaml:${layerType}`,
  ], { cwd: inputRoot, timeout: 180_000 });
  check(pushed.ok, `could not push the literal input OCI: ${pushed.error}`);
  const descriptor = command("oras", [
    "manifest",
    "fetch",
    "--plain-http",
    "--descriptor",
    registryReference,
  ], { timeout: 120_000 });
  check(descriptor.ok, `could not inspect the literal input OCI: ${descriptor.error}`);
  const digest = normalizeDigest(JSON.parse(descriptor.output).digest);
  check(digest, "literal input OCI has no manifest digest");
  const pulled = command("oras", [
    "pull",
    "--plain-http",
    "--output",
    pullRoot,
    `${registryReference}@${digest}`,
  ], { timeout: 120_000 });
  check(pulled.ok, `could not pull the literal input OCI: ${pulled.error}`);
  const pulledFile = join(pullRoot, "release-objects.yaml");
  check(existsSync(pulledFile), "pulled literal input OCI is missing release-objects.yaml");
  const pulledYaml = readFileSync(pulledFile, "utf8");
  const maps = canonicalObjectMaps(sourceYaml, pulledYaml);
  check(JSON.stringify(maps.helm) === JSON.stringify(maps.cub), "pulled input OCI objects differ from the source");
  return {
    reference,
    digest,
    pulledYamlSha256: sha256(pulledYaml),
  };
}

function publishSpaceOci({
  workRoot,
  space,
  registryHost,
  clusterRegistryHost,
}) {
  const outputRoot = join(workRoot, "portable-output");
  const pullRoot = join(workRoot, "portable-output-pulled");
  const outputFile = join(outputRoot, "release-objects.yaml");
  const bundleFile = join(outputRoot, "bundle.tar.gz");
  mkdirSync(outputRoot, { recursive: true });
  const exported = exportSpaceObjects(space);
  writeFileSync(outputFile, exported.yaml);
  command("tar", [
    "-czf",
    bundleFile,
    "release-objects.yaml",
  ], { cwd: outputRoot, timeout: 120_000 });
  const repository = "reviewed-nginx-staging";
  const localReference = `${registryHost}/${repository}:latest`;
  const pushed = command("oras", [
    "push",
    "--plain-http",
    "--artifact-type",
    artifactType,
    "--format",
    "json",
    localReference,
    `bundle.tar.gz:${deployableLayerType}`,
  ], { cwd: outputRoot, timeout: 180_000 });
  check(pushed.ok, `could not push the portable staging OCI: ${pushed.error}`);
  const descriptor = command("oras", [
    "manifest",
    "fetch",
    "--plain-http",
    "--descriptor",
    localReference,
  ], { timeout: 120_000 });
  check(descriptor.ok, `could not inspect the portable staging OCI: ${descriptor.error}`);
  const digest = normalizeDigest(JSON.parse(descriptor.output).digest);
  check(digest, "portable staging OCI has no manifest digest");
  const pulled = command("oras", [
    "pull",
    "--plain-http",
    "--output",
    pullRoot,
    `${registryHost}/${repository}@${digest}`,
  ], { timeout: 120_000 });
  check(pulled.ok, `could not pull the portable staging OCI: ${pulled.error}`);
  const pulledBundle = join(pullRoot, "bundle.tar.gz");
  check(existsSync(pulledBundle), "pulled portable staging OCI is missing bundle.tar.gz");
  command("tar", [
    "-xzf",
    pulledBundle,
    "-C",
    pullRoot,
  ], { timeout: 120_000 });
  const pulledFile = join(pullRoot, "release-objects.yaml");
  check(existsSync(pulledFile), "pulled portable staging OCI is missing release-objects.yaml");
  const pulledYaml = readFileSync(pulledFile, "utf8");
  const comparison = compareKubernetesObjects(exported.yaml, pulledYaml);
  check(comparison.matched, "pulled portable staging OCI differs from the staged ConfigHub Units");
  return {
    reference: `oci://${localReference}`,
    clusterReference: `oci://${clusterRegistryHost}/${repository}`,
    digest,
    objectCount: exported.objectCount,
    yamlSha256: sha256(exported.yaml),
    pulledYamlSha256: sha256(pulledYaml),
    objectsMatched: true,
  };
}

function exportSpaceObjects(space) {
  const docs = listUnitSlugs(space)
    .flatMap((slug) => parseDocs(cub(["unit", "data", slug, "--space", space])))
    .map((doc) => pruneImporterMetadata(doc, "ConfigHub", "", new Set()))
    .filter((doc) =>
      doc.apiVersion
      && doc.kind
      && doc.metadata?.name)
    .sort((left, right) => objectIdentity(left).localeCompare(objectIdentity(right)));
  check(docs.length > 0, `${space} has no Kubernetes objects to export`);
  return {
    objectCount: docs.length,
    yaml: `${docs.map((doc) => JSON.stringify(doc, null, 2)).join("\n---\n")}\n`,
  };
}

function pullConfigHubRelease({
  clusterName,
  space,
  manifestDigest,
  expectedYaml,
  workRoot,
}) {
  const registryConfig = registryConfigFromCluster(clusterName);
  const configPath = join(workRoot, `${space}-registry.json`);
  const pullRoot = join(workRoot, `${space}-release`);
  const extractedRoot = join(workRoot, `${space}-release-extracted`);
  writeFileSync(configPath, registryConfig, { mode: 0o600 });
  mkdirSync(pullRoot, { recursive: true });
  mkdirSync(extractedRoot, { recursive: true });
  const reference = `${configHubOciHost}/space/${space}@${manifestDigest}`;
  try {
    const resolved = command("oras", [
      "resolve",
      reference,
      "--registry-config",
      configPath,
    ]);
    const resolvedDigest = normalizeDigest(resolved.output);
    check(
      resolvedDigest === manifestDigest,
      "pulled ConfigHub release digest differs from cub release publish",
    );
    command("oras", [
      "pull",
      reference,
      "--registry-config",
      configPath,
      "--output",
      pullRoot,
    ], { timeout: 240_000 });
  } finally {
    rmSync(configPath, { force: true });
  }

  for (const path of filesUnder(pullRoot)) {
    if (!tryCommand("tar", ["-tf", path]).ok) continue;
    command("tar", ["-xf", path, "-C", extractedRoot]);
  }
  const documents = new Map();
  for (const path of [...filesUnder(pullRoot), ...filesUnder(extractedRoot)]) {
    let parsed = [];
    try {
      parsed = parseDocs(readFileSync(path, "utf8"));
    } catch {
      parsed = [];
    }
    for (const document of parsed) {
      if (!document.apiVersion || !document.kind || !document.metadata?.name) continue;
      documents.set(objectIdentity(document), document);
    }
  }
  check(documents.size > 0, "pulled ConfigHub release contains no Kubernetes objects");
  const pulledYaml = `${[...documents.values()]
    .sort((left, right) => objectIdentity(left).localeCompare(objectIdentity(right)))
    .map((document) => JSON.stringify(document, null, 2))
    .join("\n---\n")}\n`;
  const comparison = compareKubernetesObjects(expectedYaml, pulledYaml);
  check(
    comparison.matched,
    `ConfigHub pass-through release differs from the input OCI Kubernetes objects (${comparison.summary})`,
  );
  return {
    manifestDigest,
    objectCount: documents.size,
    addedConfigHubMetadata: comparison.ignoredMetadata,
  };
}

function registryConfigFromCluster(clusterName) {
  const retrieved = kubectlTry(clusterName, [
    "-n",
    "argocd",
    "get",
    "secret",
    "confighub-oci-creds",
    "-o",
    "json",
  ]);
  check(retrieved.ok, "ConfigHub OCI pull Secret was not found");
  let secret;
  try {
    secret = JSON.parse(retrieved.output);
  } catch {
    throw new Error("ConfigHub OCI pull Secret could not be parsed");
  }
  const data = secret.data ?? {};
  if (secret.type === "kubernetes.io/dockerconfigjson" && data[".dockerconfigjson"]) {
    return Buffer.from(data[".dockerconfigjson"], "base64").toString("utf8");
  }
  check(
    data.username && data.password,
    `unsupported ConfigHub OCI pull Secret shape (${Object.keys(data).sort().join(",") || "no data"})`,
  );
  const username = Buffer.from(data.username, "base64").toString("utf8");
  const password = Buffer.from(data.password, "base64").toString("utf8");
  return JSON.stringify({
    auths: {
      [configHubOciHost]: {
        username,
        password,
        auth: Buffer.from(`${username}:${password}`).toString("base64"),
      },
    },
  });
}

function filesUnder(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  }).sort();
}

function objectIdentity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function inspectWorkloadSpace(space, expectedYaml = "") {
  const spaceResponse = cubJson(["space", "get", space, "-o", "json"]);
  const unitSlugs = listUnitSlugs(space);
  const unitData = unitSlugs.map((slug) => cub(["unit", "data", slug, "--space", space]));
  const combined = unitData.join("\n---\n");
  const docs = parseDocs(combined);
  const deployment = docs.find(
    (doc) => doc.kind === "Deployment" && doc.metadata?.name === "nginx",
  );
  check(deployment, `${space} has no Deployment/nginx`);
  const deploymentUnit = unitSlugs.find((slug, index) =>
    parseDocs(unitData[index]).some(
      (doc) => doc.kind === "Deployment" && doc.metadata?.name === "nginx",
    ));
  check(deploymentUnit, `${space} has no Unit containing Deployment/nginx`);
  const comparison = expectedYaml
    ? compareKubernetesObjects(expectedYaml, combined)
    : null;
  return {
    unitCount: unitSlugs.length,
    unitSlugs,
    deploymentUnit,
    deployment: {
      namespace: String(deployment.metadata?.namespace ?? ""),
      replicas: Number(deployment.spec?.replicas ?? 1),
      image: String(deployment.spec?.template?.spec?.containers?.[0]?.image ?? ""),
    },
    objectsMatch: comparison?.matched,
    ignoredImporterMetadata: comparison?.ignoredMetadata ?? [],
    externalSource: String(spaceResponse.Space?.Annotations?.ExternalSource ?? ""),
    externalSourceDigest: String(
      spaceResponse.Space?.Annotations?.ExternalSourceDigest ?? "",
    ),
    upgradableUnitCount: Number(spaceResponse.UpgradableUnitCount ?? 0),
  };
}

function compareKubernetesObjects(expectedYaml, actualYaml) {
  const ignoredMetadata = new Set();
  const objectMap = (yaml, side) => {
    const docs = parseDocs(yaml);
    return Object.fromEntries(docs.map((doc) => {
      const cleaned = pruneImporterMetadata(doc, side, "", ignoredMetadata);
      const metadata = cleaned.metadata ?? {};
      const identity = [
        cleaned.apiVersion ?? "",
        cleaned.kind ?? "",
        metadata.namespace ?? "",
        metadata.name ?? "",
      ].join("|");
      return [identity, cleaned];
    }));
  };
  const expected = objectMap(expectedYaml, "source");
  const actual = objectMap(actualYaml, "ConfigHub");
  const identities = [...new Set([
    ...Object.keys(expected),
    ...Object.keys(actual),
  ])].sort();
  const missing = identities.filter(
    (identity) => expected[identity] && !actual[identity],
  );
  const extra = identities.filter(
    (identity) => !expected[identity] && actual[identity],
  );
  const changed = identities.filter(
    (identity) =>
      expected[identity]
      && actual[identity]
      && canonicalJson(expected[identity]) !== canonicalJson(actual[identity]),
  );
  const changedFields = Object.fromEntries(changed.map((identity) => [
    identity,
    differencePaths(expected[identity], actual[identity]).slice(0, 12),
  ]));
  const annotationKeys = Object.fromEntries(changed.map((identity) => [
    identity,
    {
      source: Object.keys(expected[identity]?.metadata?.annotations ?? {}).sort(),
      configHub: Object.keys(actual[identity]?.metadata?.annotations ?? {}).sort(),
    },
  ]));
  const matched = missing.length === 0 && extra.length === 0 && changed.length === 0;
  return {
    matched,
    ignoredMetadata: [...ignoredMetadata].sort(),
    missing,
    extra,
    changed,
    changedFields,
    annotationKeys,
    summary: [
      `missing=${missing.join(",") || "none"}`,
      `extra=${extra.join(",") || "none"}`,
      `changed=${changed.join(",") || "none"}`,
      `fields=${JSON.stringify(changedFields)}`,
      `annotationKeys=${JSON.stringify(annotationKeys)}`,
    ].join("; "),
  };
}

function differencePaths(expected, actual, path = "") {
  if (canonicalJson(expected) === canonicalJson(actual)) return [];
  if (
    expected === null
    || actual === null
    || typeof expected !== "object"
    || typeof actual !== "object"
    || Array.isArray(expected) !== Array.isArray(actual)
  ) {
    return [path || "/"];
  }
  if (Array.isArray(expected)) {
    const paths = [];
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      if (index >= expected.length || index >= actual.length) {
        paths.push(`${path}/${index}`);
      } else {
        paths.push(...differencePaths(expected[index], actual[index], `${path}/${index}`));
      }
    }
    return paths;
  }
  const keys = [...new Set([
    ...Object.keys(expected),
    ...Object.keys(actual),
  ])].sort();
  return keys.flatMap((key) => {
    const childPath = `${path}/${key}`;
    if (!(key in expected) || !(key in actual)) return [childPath];
    return differencePaths(expected[key], actual[key], childPath);
  });
}

function pruneImporterMetadata(value, side, path, ignoredMetadata) {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      pruneImporterMetadata(item, side, `${path}/${index}`, ignoredMetadata));
  }
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("$comment$")) {
      if (side === "ConfigHub") ignoredMetadata.add(`${path}/${key}` || `/${key}`);
      continue;
    }
    if (
      side === "ConfigHub"
      && path === "/metadata/annotations"
      && key === "confighub.com/origin"
    ) {
      ignoredMetadata.add(`${path}/${key}`);
      continue;
    }
    const cleaned = pruneImporterMetadata(
      child,
      side,
      `${path}/${key}`,
      ignoredMetadata,
    );
    if (
      key === "annotations"
      && path === "/metadata"
      && cleaned
      && typeof cleaned === "object"
      && !Array.isArray(cleaned)
      && Object.keys(cleaned).length === 0
    ) {
      continue;
    }
    if (cleaned !== null && cleaned !== undefined) result[key] = cleaned;
  }
  return result;
}

function canonicalJson(value) {
  if (value === undefined) return "";
  const parsed = value;
  if (Array.isArray(parsed)) return `[${parsed.map(canonicalJson).join(",")}]`;
  if (parsed && typeof parsed === "object") {
    return `{${Object.keys(parsed).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(parsed[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(parsed);
}

function variantLink(space) {
  const response = cubJson(["space", "get", space, "-o", "json"]);
  return {
    space,
    variant: String(response.Space?.Labels?.Variant ?? ""),
    environment: String(response.Space?.Labels?.Environment ?? ""),
    upstreamSpaceId: String(response.Space?.Annotations?.UpstreamSpaceID ?? ""),
    releaseTargetId: String(response.Space?.ReleaseTargetID ?? ""),
  };
}

function promoteVariant({
  space,
  beforeReplicas,
  afterReplicas,
  downstreamMustRemain = "",
  description,
}) {
  const before = inspectWorkloadSpace(space);
  check(before.deployment.replicas === beforeReplicas, `${space} changed before promotion`);
  check(before.upgradableUnitCount === 1, `${space} should have one pending upstream Unit`);
  const downstreamBefore = downstreamMustRemain
    ? inspectWorkloadSpace(downstreamMustRemain).deployment.replicas
    : null;
  const preview = cub([
    "variant",
    "promote",
    space,
    "--dry-run",
    "-o",
    "mutations",
  ], { timeout: 240_000 });
  const afterPreview = inspectWorkloadSpace(space);
  check(afterPreview.deployment.replicas === beforeReplicas, `${space} dry run changed stored data`);
  if (downstreamMustRemain) {
    check(
      inspectWorkloadSpace(downstreamMustRemain).deployment.replicas === downstreamBefore,
      `${downstreamMustRemain} changed before its own promotion`,
    );
  }
  cub([
    "variant",
    "promote",
    space,
    "--change-desc",
    description,
  ], { timeout: 300_000 });
  const after = inspectWorkloadSpace(space);
  check(after.deployment.replicas === afterReplicas, `${space} promotion did not apply the replica change`);
  check(after.upgradableUnitCount === 0, `${space} still has a pending upstream Unit after promotion`);
  return {
    result: "pass",
    space,
    preview: "pass",
    previewOutputSha256: sha256(preview),
    previewLeftStoredDataUnchanged: true,
    beforeReplicas,
    afterReplicas,
    pendingBefore: before.upgradableUnitCount,
    pendingAfter: after.upgradableUnitCount,
  };
}

function publishRelease(space) {
  const response = cubJson(["release", "publish", space, "-o", "json"], {
    timeout: 300_000,
  });
  const release = response.Release ?? response.release ?? response;
  const manifestDigest = normalizeDigest(
    release.ManifestDigest ?? release.manifestDigest,
  );
  check(manifestDigest, `${space} release publish returned no manifest digest`);
  return {
    space,
    reference: `oci://oci.hub.confighub.com:443/space/${space}:latest`,
    manifestDigest,
    bundleDigest: normalizeDigest(release.Digest ?? release.digest),
    releaseId: String(release.ReleaseID ?? release.releaseId ?? ""),
  };
}

function addApplication({
  clusterName,
  clusterSpace,
  target,
  appName,
  unitName,
  workloadSpace,
  sourceReference = "",
  anonymousOciHost = "",
  namespace,
  workRoot,
}) {
  const appPath = join(workRoot, `${clusterName}-${appName}.yaml`);
  writeFileSync(appPath, applicationYaml({
    appName,
    workloadSpace,
    sourceReference,
    namespace,
  }));
  if (anonymousOciHost) {
    configureAnonymousOci(clusterName, anonymousOciHost, workRoot);
  }
  const existing = cubTry(["unit", "get", unitName, "--space", clusterSpace, "-o", "json"]);
  if (existing.ok) {
    cub([
      "unit",
      "update",
      "--space",
      clusterSpace,
      unitName,
      appPath,
      "--change-desc",
      `Point ${appName} at ${workloadSpace}`,
    ], { timeout: 180_000 });
  } else {
    cub([
      "unit",
      "create",
      "--space",
      clusterSpace,
      unitName,
      appPath,
      "--target",
      target,
      "--change-desc",
      `Create ${appName} from ${workloadSpace}`,
    ], { timeout: 180_000 });
  }
  const rootRelease = publishRelease(clusterSpace);
  kubectl(clusterName, [
    "annotate",
    "application",
    clusterSpace,
    "-n",
    "argocd",
    "argocd.argoproj.io/refresh=hard",
    "--overwrite",
  ]);
  return {
    name: appName,
    unit: `${clusterSpace}/${unitName}`,
    source: sourceReference || `oci://oci.hub.confighub.com:443/space/${workloadSpace}`,
    destinationNamespace: namespace,
    clusterRootReleaseDigest: rootRelease.manifestDigest,
  };
}

function configureAnonymousOci(clusterName, registryHost, workRoot) {
  const secretPath = join(workRoot, `${clusterName}-anonymous-oci.yaml`);
  writeFileSync(secretPath, `apiVersion: v1
kind: Secret
metadata:
  name: helm-expt-anonymous-oci
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repo-creds
type: Opaque
stringData:
  url: oci://${registryHost}
  type: oci
  enableOCI: "true"
  insecureOCIForceHttp: "true"
`);
  kubectl(clusterName, ["apply", "-f", secretPath]);
}

function waitForApplication({
  clusterName,
  appName,
  namespace,
  replicas,
}) {
  let last = {
    sync: "",
    health: "",
    revision: "",
    ready: 0,
    available: 0,
    observedGenerationMatches: false,
    image: "",
  };
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const app = kubectlTry(clusterName, [
      "get",
      "application",
      appName,
      "-n",
      "argocd",
      "-o",
      "json",
    ]);
    const deployment = kubectlTry(clusterName, [
      "get",
      "deployment",
      "nginx",
      "-n",
      namespace,
      "-o",
      "json",
    ]);
    if (app.ok && deployment.ok) {
      const appObject = JSON.parse(app.output);
      const deploymentObject = JSON.parse(deployment.output);
      last = {
        sync: String(appObject.status?.sync?.status ?? ""),
        health: String(appObject.status?.health?.status ?? ""),
        revision: String(appObject.status?.sync?.revision ?? ""),
        ready: Number(deploymentObject.status?.readyReplicas ?? 0),
        available: Number(deploymentObject.status?.availableReplicas ?? 0),
        observedGenerationMatches:
          deploymentObject.status?.observedGeneration
          === deploymentObject.metadata?.generation,
        image: String(
          deploymentObject.spec?.template?.spec?.containers?.[0]?.image ?? "",
        ),
      };
      if (
        last.sync === "Synced"
        && last.health === "Healthy"
        && last.ready === replicas
        && last.available === replicas
        && last.observedGenerationMatches
        && last.image === expectedImage
      ) {
        return {
          result: "pass",
          namespace,
          application: appName,
          sync: last.sync,
          health: last.health,
          revision: normalizeDigest(last.revision),
          deployment: {
            name: "nginx",
            replicas: `${last.ready}/${replicas}`,
            available: last.available,
            observedGenerationMatches: true,
            image: last.image,
          },
        };
      }
    }
    sleep(5000);
  }
  return {
    result: "blocked",
    namespace,
    application: appName,
    reason: `sync=${last.sync || "missing"}; health=${last.health || "missing"}; ready=${last.ready}/${replicas}; available=${last.available}; observedGenerationMatches=${last.observedGenerationMatches}; image=${last.image || "missing"}`,
  };
}

function applicationYaml({
  appName,
  workloadSpace,
  sourceReference = "",
  namespace,
}) {
  const repoUrl = sourceReference
    || `oci://oci.hub.confighub.com:443/space/${workloadSpace}`;
  return `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${appName}
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ${repoUrl}
    targetRevision: latest
    path: .
  destination:
    server: https://kubernetes.default.svc
    namespace: ${namespace}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
`;
}

function clusterUp(name) {
  const result = spawnSync(
    "cub",
    ["cluster", "up", "--name", name, "--no-ports"],
    {
      cwd: repoRoot,
      env: cubEnv(),
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 900_000,
      maxBuffer: 1024 * 1024 * 50,
    },
  );
  check(
    result.status === 0 || clusterPresent(name),
    `cub cluster up failed for ${name}: ${sanitizeError(result.stderr)}`,
  );
}

function clusterDown(name) {
  const result = tryCommand(
    "cub",
    ["cluster", "down", "--name", name, "--force"],
    { timeout: 600_000, env: cubEnv() },
  );
  if (!result.ok && clusterPresent(name)) {
    tryCommand("kind", ["delete", "cluster", "--name", name], {
      timeout: 180_000,
    });
  }
  if (spacePresent(`${name}-cluster`)) {
    for (let attempt = 0; attempt < 3 && spacePresent(`${name}-cluster`); attempt += 1) {
      cubTry(["space", "delete", `${name}-cluster`, "--recursive-force"], {
        timeout: 240_000,
      });
      sleep(1000);
    }
  }
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function clusterAbsent(name) {
  return !clusterPresent(name)
    && !spacePresent(`${name}-cluster`)
    && !existsSync(clusterKubeconfig(name))
    && !existsSync(clusterEnv(name));
}

function clusterKubeconfig(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.kubeconfig`);
}

function clusterEnv(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.env`);
}

function kubectl(clusterName, args) {
  return command(
    "kubectl",
    [
      "--kubeconfig",
      clusterKubeconfig(clusterName),
      "--context",
      `kind-${clusterName}`,
      ...args,
    ],
    { timeout: 120_000 },
  );
}

function kubectlTry(clusterName, args) {
  return tryCommand(
    "kubectl",
    [
      "--kubeconfig",
      clusterKubeconfig(clusterName),
      "--context",
      `kind-${clusterName}`,
      ...args,
    ],
    { timeout: 120_000 },
  );
}

function listUnitSlugs(space) {
  const response = cubJson(["unit", "list", "--space", space, "-o", "json"]);
  const rows = Array.isArray(response) ? response : response.Units ?? response.units ?? [];
  const slugs = rows
    .map((row) => row.Unit?.Slug ?? row.unit?.slug ?? row.Slug ?? row.slug)
    .filter(Boolean)
    .sort();
  check(slugs.length > 0, `${space} has no Units`);
  return slugs;
}

function spacePresent(space) {
  return cubTry(["space", "get", space, "-o", "json"]).ok;
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
  return result.ok && result.output.trim() === name;
}

function assertScratchContext() {
  check(
    process.env.HELM_EXPT_ALLOW_SCRATCH_ORG === "1",
    "set HELM_EXPT_ALLOW_SCRATCH_ORG=1 to acknowledge that this creates and removes scratch ConfigHub Spaces and clusters",
  );
  check(
    process.env.CUB_CONTEXT,
    "set CUB_CONTEXT to an authenticated scratch organization context",
  );
  const context = cub(["context", "get"]);
  check(
    !context.includes("helm-catalog"),
    "refusing to run the scratch proof in the maintained helm-catalog organization",
  );
}

function cub(args, options = {}) {
  const result = command("cub", args, {
    ...options,
    env: cubEnv(),
  });
  if (!result.ok) throw new Error(`cub ${args.slice(0, 3).join(" ")} failed: ${result.error}`);
  return result.output;
}

function cubTry(args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: cubEnv(),
  });
}

function cubJson(args, options = {}) {
  const output = cub(args, options);
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`cub returned invalid JSON for ${args.slice(0, 3).join(" ")}`);
  }
}

function command(file, args, options = {}) {
  const result = tryCommand(file, args, options);
  if (!result.ok) {
    throw new Error(`${file} ${args.slice(0, 4).join(" ")} failed: ${result.error}`);
  }
  return result;
}

function tryCommand(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 120_000,
    maxBuffer: 1024 * 1024 * 100,
  });
  return {
    ok: result.status === 0,
    output: result.stdout ?? "",
    error: sanitizeError(
      result.error?.message
      ?? result.stderr
      ?? result.stdout
      ?? `exit ${result.status}`,
    ),
  };
}

function normalizeDigest(value) {
  return String(value ?? "").match(/sha256:[a-f0-9]{64}/)?.[0] ?? "";
}

function sanitizeError(value) {
  return String(value ?? "")
    .replace(/(?i:password|token|secret)\s*[:=]\s*\S+/g, "$1=<redacted>")
    .replace(/[A-Za-z0-9_-]{40,}/g, "<redacted-long-value>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sleep(milliseconds) {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    milliseconds,
  );
}

function waitUntil(predicate, tries, gapMs = 1000) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (predicate()) return true;
    sleep(gapMs);
  }
  return predicate();
}

function validateReceipt(receipt) {
  check(
    receipt.kind === "OciDeployStageRolloutReceipt",
    "OCI deploy-stage-rollout receipt kind changed",
  );
  check(receipt.status?.result === "pass", "OCI deploy-stage-rollout proof is not pass");
  check(receipt.spec?.serverlessInput?.result === "pass", "literal OCI input did not pass");
  check(receipt.spec?.serverlessOutput?.result === "pass", "portable OCI output did not pass");
  check(receipt.spec?.configHub?.import?.result === "pass", "ConfigHub OCI import did not pass");
  check(
    receipt.spec?.configHub?.chain?.path === "base -> development -> staging"
      && receipt.spec?.configHub?.chain?.result === "pass",
    "variant chain did not pass",
  );
  check(receipt.spec?.configHub?.change?.result === "pass", "reviewed change did not pass");
  check(
    receipt.spec?.configHub?.promotions?.development?.result === "pass"
      && receipt.spec?.configHub?.promotions?.staging?.result === "pass",
    "sequential promotions did not pass",
  );
  check(
    receipt.spec?.delivery?.passThrough?.result === "pass"
      && receipt.spec.delivery.passThrough.userKubernetesFieldsMatched === true
      && receipt.spec.delivery.passThrough.input.objectCount
        === receipt.spec.delivery.passThrough.output.objectCount
      && receipt.spec.delivery.passThrough.output.manifestDigest
        === receipt.spec.delivery.passThrough.output.resolvedManifestDigest
      && receipt.spec.delivery.passThrough.addedConfigHubMetadata
        .includes("/metadata/annotations/confighub.com/origin")
      && receipt.spec.delivery.passThrough.addedConfigHubMetadata
        .every((path) =>
          path === "/metadata/annotations/confighub.com/origin"
          || path.endsWith("/$comment$head$")),
    "congruent ConfigHub OCI pass-through did not pass",
  );
  check(receipt.spec?.delivery?.development?.result === "pass", "development delivery did not pass");
  check(receipt.spec?.delivery?.stagingRelease?.result === "pass", "staging release did not pass");
  check(
    receipt.spec?.delivery?.fleet?.result === "pass"
      && receipt.spec?.delivery?.fleet?.size === 2
      && receipt.spec?.delivery?.fleet?.sameReleaseDigest === true
      && receipt.spec?.delivery?.fleet?.digest === receipt.spec?.serverlessOutput?.digest
      && receipt.spec?.delivery?.fleet?.targets?.length === 2,
    "two-target rollout did not pass",
  );
  for (const target of receipt.spec.delivery.fleet.targets) {
    check(target.runtime?.result === "pass", `${target.cluster} runtime did not pass`);
    check(target.runtime?.sync === "Synced", `${target.cluster} Argo was not Synced`);
    check(target.runtime?.health === "Healthy", `${target.cluster} Argo was not Healthy`);
    check(
      target.runtime?.deployment?.replicas === "2/2",
      `${target.cluster} did not reach two ready replicas`,
    );
  }
  check(
    Object.values(receipt.spec?.run?.cleanup ?? {}).every((value) => value === "pass"),
    "OCI deploy-stage-rollout cleanup did not pass",
  );
  check(
    !JSON.stringify(receipt).match(/\bcub\s+(?:lk|install)\b/),
    "OCI deploy-stage-rollout receipt contains a retired command",
  );
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  const passThrough = spec.delivery.passThrough;
  const passThroughEvidence = passThrough.result === "pass"
    ? `Input \`${passThrough.input.manifestDigest}\`; ConfigHub output \`${passThrough.output.manifestDigest}\`; ${passThrough.output.objectCount} objects kept the same specs and user metadata. ConfigHub added \`confighub.com/origin\`.`
    : "The unchanged-output comparison did not complete.";
  const fleetRows = spec.delivery.fleet.targets
    .map((target) => `| \`${target.cluster}\` | ${target.runtime.sync} | ${target.runtime.health} | \`${target.runtime.revision}\` | ${target.runtime.deployment.replicas} | ${target.runtime.result} |`)
    .join("\n");
  return `# One OCI deployed, promoted, and rolled out to two clusters

This is one continuous live test. It starts with literal Kubernetes objects in
an OCI artifact. ConfigHub imports those objects without running Helm and keeps
a \`base -> development -> staging\` chain. The reviewed staging objects are
then exported as one anonymous OCI package. Argo CD pulls that exact package on
two clusters.

## Result

**${receipt.status.result}.** ${receipt.status.claim}

| Step | Result | Evidence |
| --- | --- | --- |
| Build and pull the literal input OCI | ${spec.serverlessInput.result} | \`${spec.serverlessInput.digest}\`; pulled objects matched the committed NGINX catalog base. |
| Import the OCI into ConfigHub | ${spec.configHub.import.result} | ${spec.configHub.import.unitCount} Units; source digest recorded; Kubernetes fields matched. The receipt names the internal comment marker ignored during comparison. |
| Publish the same configuration from ConfigHub | ${passThrough.result} | ${passThroughEvidence} |
| Create the environment chain | ${spec.configHub.chain.result} | \`${spec.configHub.chain.path}\`. |
| Change one reviewed field | ${spec.configHub.change.result} | Deployment replicas changed from ${spec.configHub.change.before} to ${spec.configHub.change.after}. |
| Promote to development | ${spec.configHub.promotions.development.result} | The preview changed nothing. After promotion, development had no pending upstream change. |
| Promote to staging | ${spec.configHub.promotions.staging.result} | The preview changed nothing. After promotion, staging had no pending upstream change. |
| Publish the ConfigHub staging release | ${spec.delivery.stagingRelease.result} | \`${spec.delivery.stagingRelease.manifestDigest}\`. |
| Export the portable OCI | ${spec.serverlessOutput.result} | ${spec.serverlessOutput.objectCount} objects; \`${spec.serverlessOutput.digest}\`; anonymous pull. |
| Roll out to two clusters | ${spec.delivery.fleet.result} | Both controllers reported the portable OCI digest and both workloads became ready. |

## Live controller feedback

| Cluster | Argo sync | Argo health | OCI revision | Ready replicas | Result |
| --- | --- | --- | --- | --- | --- |
${fleetRows}

## What this proves

- An existing literal OCI can enter ConfigHub without rerunning Helm.
- ConfigHub can publish its first release with the same specs and user-supplied
  metadata. The output has its own OCI digest and adds the
  \`confighub.com/origin\` provenance annotation.
- ConfigHub can keep one base and advance a reviewed change through development
  and staging in sequence.
- ConfigHub can publish its own staged release, while the same reviewed objects
  can also leave as a portable OCI package.
- Two Argo CD controllers can pull the same portable OCI digest and report live
  workload health.

## What this does not prove

${spec.limits.map((limit) => `- ${limit}`).join("\n")}

The run removed both kind clusters, their ConfigHub cluster Spaces, the three
workload Spaces, the temporary registry, and the generated local files.

- Receipt: [\`${relativeRepo(receiptPath)}\`](../../${relativeRepo(receiptPath)})
- Source record: [\`${spec.source.sourceRecord}\`](../../${spec.source.sourceRecord})
- Literal objects: [\`${spec.source.objects}\`](../../${spec.source.objects})
`;
}
