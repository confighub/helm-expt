#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const exampleRoot = join(repoRoot, "examples", "c3agent", "fleet-config");
const receiptPath = join(repoRoot, "runs", "c3agent-configuration-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "c3agent-configuration-proof", "summary.md");
const localOciReceiptPath = join(exampleRoot, "records", "local-oci-receipt.yaml");
const unitSlugs = ["c3agent-fleet", "c3agent-fleet-configmaps", "c3agent-fleet-namespaces"];

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run the summary generator`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run c3agent-config:proof:generate`,
  );
  console.log("verified c3agent configuration proof");
} else if (mode === "--self-test") {
  selfTest();
  console.log("verified c3agent configuration proof self-test");
} else {
  console.error(`Usage: node ${relativeRepo(import.meta.filename)} --run|--generate|--verify|--self-test`);
  process.exitCode = 2;
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim();
  check(context, "set CUB_CONTEXT to the authenticated helm-catalog context");
  for (const [tool, args] of [
    ["cub", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["oras", ["version"]],
    ["docker", ["version"]],
  ]) {
    check(tryCommand(tool, args).ok, `${tool} is required for the c3agent proof`);
  }
  const contextInfo = cubJson(context, ["context", "get", context, "-o", "json"]);
  check(contextInfo.metadata?.organizationName === "helm-catalog", "proof must use helm-catalog");

  const localReceipt = readYaml(localOciReceiptPath);
  const expected = environmentRecords();
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString());
  const prefix = `hx-c3agent-${runId}`;
  const spaces = {
    base: `${prefix}-base`,
    development: `${prefix}-dev`,
    staging: `${prefix}-staging`,
    production: `${prefix}-prod`,
  };
  const cluster = `${prefix}-cluster`;
  const registryName = `${prefix}-registry`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-c3agent-live-"));
  let registryStarted = false;
  let clusterStarted = false;
  let receipt;

  try {
    for (const space of Object.values(spaces)) {
      check(!spacePresent(context, space), `refusing to reuse existing Space ${space}`);
    }
    check(!clusterPresent(cluster), `refusing to reuse kind cluster ${cluster}`);

    const registry = startRegistry(registryName);
    registryStarted = true;
    const temporaryReference = `${registry.host}/c3agent/fleet:development`;
    command("oras", [
      "cp",
      "--from-oci-layout",
      "examples/c3agent/fleet-config/oci-layout:development",
      "--to-plain-http",
      temporaryReference,
    ]);
    const temporaryDigest = normalizeDigest(command("oras", [
      "resolve",
      "--plain-http",
      temporaryReference,
    ]).output);
    check(
      temporaryDigest === localReceipt.spec.digest,
      `temporary OCI digest ${temporaryDigest} differs from ${localReceipt.spec.digest}`,
    );

    clusterUp(context, cluster);
    clusterStarted = true;
    const target = cubJson(context, [
      "target",
      "get",
      "target",
      "--space",
      cluster,
      "-o",
      "json",
    ]).Target;
    check(target?.ProviderType === "OCI", `${cluster}/target is not an OCI target`);
    const targetRef = `${cluster}/target`;

    cub(context, [
      "variant",
      "upload",
      "--component",
      "c3agent-fleet",
      "--variant",
      "base",
      "--space",
      spaces.base,
      "--granularity",
      "minimal",
      "--owner",
      "ConfigHub",
      "--layer",
      "App",
      "--label",
      "Example=c3agent",
      "--change-desc",
      "Import the checked c3agent development configuration OCI",
      `oci://${temporaryReference}`,
    ], { timeout: 420_000 });

    variantCreate(context, "development", spaces.base, spaces.development, null);
    variantCreate(context, "staging", spaces.development, spaces.staging, null);
    variantCreate(context, "production", spaces.staging, spaces.production, targetRef);

    updateConfig(context, spaces.development, {
      MAX_BUDGET_USD: "8",
      MAX_CONCURRENT_TASKS: "3",
    }, "Prepare the reviewed staging budget and concurrency");
    const stagingPreview = promotionPreview(context, spaces.staging);
    check(stagingPreview.changed, "staging promotion preview reported no change");
    cub(context, [
      "variant",
      "promote",
      spaces.staging,
      "--change-desc",
      "Promote the reviewed c3agent settings to staging",
    ], { timeout: 420_000 });

    updateConfig(context, spaces.staging, {
      MAX_BUDGET_USD: "12.5",
      MAX_CONCURRENT_TASKS: "5",
      SCHEDULE_INTERVAL_SECONDS: "10",
    }, "Prepare the reviewed production budget, concurrency, and schedule");
    const productionPreview = promotionPreview(context, spaces.production);
    check(productionPreview.changed, "production promotion preview reported no change");
    cub(context, [
      "variant",
      "promote",
      spaces.production,
      "--change-desc",
      "Promote the reviewed c3agent settings to production",
    ], { timeout: 420_000 });

    const inspected = Object.fromEntries(
      Object.entries(spaces).map(([role, space]) => [role, inspectSpace(context, space)]),
    );
    check(sameStrings(inspected.base.unitSlugs, unitSlugs), "base Unit set changed");
    check(sameStrings(inspected.development.unitSlugs, unitSlugs), "development Unit set changed");
    check(sameStrings(inspected.staging.unitSlugs, unitSlugs), "staging Unit set changed");
    check(sameStrings(inspected.production.unitSlugs, unitSlugs), "production Unit set changed");
    check(
      sameStrings(changedUnits(inspected.base, inspected.development), ["c3agent-fleet-configmaps"]),
      "development changed more than the fleet ConfigMap",
    );
    check(
      sameStrings(changedUnits(inspected.development, inspected.staging), ["c3agent-fleet-configmaps"]),
      "staging final state changed more than the fleet ConfigMap relative to development",
    );
    check(
      inspected.staging.objectSetSha256 === inspected.production.objectSetSha256,
      `production object set ${inspected.production.objectSetSha256} differs from promoted staging ${inspected.staging.objectSetSha256}: ${describeObjectDiff(inspected.staging.documents, inspected.production.documents)}`,
    );
    checkConfig(inspected.base.config, expected.development);
    checkConfig(inspected.development.config, expected.staging);
    checkConfig(inspected.staging.config, expected.production);
    checkConfig(inspected.production.config, expected.production);

    const releaseResponse = cubJson(context, [
      "release",
      "publish",
      spaces.production,
      "-o",
      "json",
    ], { timeout: 420_000 });
    const release = releaseResponse.Release ?? releaseResponse;
    const releaseDigest = normalizeDigest(release.ManifestDigest);
    check(releaseDigest, "ConfigHub release returned no manifest digest");

    const argo = waitForArgo(cluster, spaces.production, releaseDigest);
    const kubernetes = inspectKubernetes(cluster, expected.production);
    check(argo.sync === "Synced" && argo.health === "Healthy", "Argo did not reconcile the c3agent objects");
    check(kubernetes.result === "pass", "the cluster object check did not pass");

    const versions = parseCubVersions(cub(context, ["version"]));
    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "C3AgentConfigurationProofReceipt",
      metadata: { name: "c3agent-disabled-fleet-promotion" },
      spec: {
        recordedAt: new Date().toISOString(),
        context: { name: context, organization: contextInfo.metadata.organizationName },
        tools: {
          cubClient: versions.client,
          configHubServer: versions.server,
          gitopsController: "Argo CD",
          kubernetesContext: `kind-${cluster}`,
        },
        source: {
          localOci: localReceipt.spec.reference,
          digest: localReceipt.spec.digest,
          objectSetSha256: localReceipt.spec.objectSetSha256,
          temporaryRegistryTransport: true,
          runtimeSourceRevision: expected.development.sourceRevision,
          runtimeImages: expected.development.images,
          runtimeImagesPublic: false,
        },
        configHub: {
          spaces,
          sourceDigestRecorded: inspected.base.externalSource.digest,
          unitSlugs,
          changedUnit: "c3agent-fleet-configmaps",
          development: inspected.development.config,
          staging: inspected.staging.config,
          production: inspected.production.config,
        },
        promotion: {
          stagingPreview,
          productionPreview,
          productionMatchesStaging: true,
          path: `${spaces.base} -> ${spaces.development} -> ${spaces.staging} -> ${spaces.production}`,
        },
        release: {
          id: String(release.ReleaseID ?? ""),
          manifestDigest: releaseDigest,
          bundleDigest: normalizeDigest(release.Digest),
          target: targetRef,
        },
        argo,
        kubernetes,
        lifecycle: {
          secretReference: "c3agent/c3agent-runtime-secrets",
          secretPresent: false,
          deploymentReplicas: 0,
          workloadReadiness: "not-run",
          agentTask: "not-run",
        },
        cleanup: {
          scratchSpaces: "deleted after receipt capture",
          cluster: "deleted after receipt capture",
          temporaryRegistry: "deleted after receipt capture",
        },
        limits: [
          "The c3agent source and runtime images are private. This is an advanced configuration example, not an anonymous starter package.",
          "The two Deployments stayed at zero replicas. Argo and Kubernetes reconciled the exact objects, but no c3agent process became ready and no agent task ran.",
          "The required Secret, PostgreSQL service, persistent storage, image pull credentials, and task-level RBAC review remain activation work.",
          "This proof used one local kind cluster and Argo CD. It does not prove Flux or a fleet rollout.",
        ],
      },
      status: {
        result: "pass",
        deterministicGeneration: "pass",
        configurationOciRoundTrip: "pass",
        configHubBase: "pass",
        variantsAndPromotion: "pass",
        releaseOci: "pass",
        argoObjectReconciliation: "pass",
        kubernetesObjectReconciliation: "pass",
        kubernetesWorkloadReadiness: "not-run",
        agentTask: "not-run",
        claim: "A digest-pinned, Secret-referencing c3agent configuration moved from a local OCI into a ConfigHub base, through development, staging, and production variants, into a ConfigHub release OCI, and through Argo CD to Kubernetes. The workload remained disabled and no agent task ran.",
      },
    };
    verifyReceipt(receipt);
  } finally {
    if (clusterStarted || clusterPresent(cluster)) clusterDown(context, cluster);
    for (const space of Object.values(spaces).reverse()) deleteSpace(context, space);
    if (registryStarted) tryCommand("docker", ["stop", registryName], { timeout: 120_000 });
    rmSync(workRoot, { recursive: true, force: true });
  }

  check(receipt, "c3agent proof did not complete");
  check(!clusterPresent(cluster), "c3agent proof cluster was not deleted");
  check(Object.values(spaces).every((space) => !spacePresent(context, space)), "a c3agent scratch Space remains");
  check(!containerPresent(registryName), "c3agent temporary registry remains");
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function environmentRecords() {
  const records = {};
  for (const environment of ["development", "staging", "production"]) {
    const intent = readYaml(join(exampleRoot, "records", `${environment}-source-and-intent.yaml`));
    const docs = parseDocs(readFileSync(join(exampleRoot, "rendered", environment, "release-objects.yaml"), "utf8"));
    const config = docs.find((doc) => doc.kind === "ConfigMap" && doc.metadata?.name === "coding-fleet-config");
    check(config, `${environment} rendered config is missing`);
    records[environment] = {
      values: config.data,
      objectSetSha256: intent.spec.output.objectSetSha256,
      sourceRevision: intent.spec.source.revision,
      images: intent.spec.runtimeImages,
    };
  }
  return records;
}

function variantCreate(context, variant, upstream, space, target) {
  const args = [
    "variant",
    "create",
    variant,
    upstream,
    "--space-pattern",
    `template:${space}`,
    "--environment",
    title(variant),
    "--no-argo-app",
  ];
  if (target) {
    args.splice(args.length - 1, 1, "--target", target, "--namespace", "c3agent");
  }
  cub(context, args, { timeout: 420_000 });
}

function updateConfig(context, space, values, description) {
  for (const [key, value] of Object.entries(values)) {
    cub(context, [
      "function",
      "do",
      "--space",
      space,
      "--unit",
      "c3agent-fleet-configmaps",
      "set-string-path",
      "v1/ConfigMap",
      `data.${key}`,
      value,
      "--change-desc",
      description,
      "--wait",
    ], { timeout: 240_000 });
  }
}

function promotionPreview(context, space) {
  const result = tryCommand("cub", [
    "variant",
    "promote",
    space,
    "--dry-run",
    "-o",
    "mutations",
    "--context",
    context,
  ], { timeout: 240_000 });
  check(result.ok, `promotion preview failed for ${space}: ${result.error}`);
  const text = result.output.trim();
  return {
    changed: Boolean(text) && !/no (?:units|changes)/i.test(text),
    outputSha256: `sha256:${sha256(text)}`,
    outputLines: text ? text.split(/\r?\n/).length : 0,
  };
}

function inspectSpace(context, space) {
  const spaceRecord = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  const units = cubJson(context, ["unit", "list", "--space", space, "-o", "json"])
    .map((row) => row.Unit)
    .sort((left, right) => left.Slug.localeCompare(right.Slug));
  const configDocs = parseDocs(cub(context, [
    "unit",
    "data",
    "c3agent-fleet-configmaps",
    "--space",
    space,
  ]));
  const config = configDocs.find((doc) => doc.kind === "ConfigMap" && doc.metadata?.name === "coding-fleet-config");
  check(config, `${space} does not contain coding-fleet-config`);
  const allDocs = units.flatMap((unit) => parseDocs(cub(context, [
    "unit",
    "data",
    unit.Slug,
    "--space",
    space,
  ])));
  const rawSource = spaceRecord.Annotations?.["confighub.com/external-source"];
  const sources = rawSource ? JSON.parse(rawSource) : [];
  return {
    slug: space,
    unitSlugs: units.map((unit) => unit.Slug),
    unitHashes: units.map((unit) => ({ slug: unit.Slug, dataHash: unit.DataHash })),
    objectSetSha256: hashDocuments(allDocs),
    documents: allDocs,
    config: config.data,
    externalSource: sources[0] ?? {},
  };
}

function checkConfig(observed, expected) {
  for (const key of ["AGENT_IMAGE", "AGENT_MODEL", "MAX_BUDGET_USD", "MAX_CONCURRENT_TASKS", "SCHEDULE_INTERVAL_SECONDS"]) {
    check(String(observed[key]) === String(expected.values[key]), `${key} differs from the expected environment record`);
  }
}

function waitForArgo(cluster, application, digest) {
  let last = {};
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const result = kubectlTry(cluster, ["get", "application", application, "-n", "argocd", "-o", "json"]);
    if (result.ok) {
      const app = JSON.parse(result.output);
      last = {
        application,
        sync: app.status?.sync?.status ?? "",
        health: app.status?.health?.status ?? "",
        operation: app.status?.operationState?.phase ?? "",
        revision: normalizeDigest(app.status?.sync?.revision),
      };
      if (last.sync === "Synced" && last.health === "Healthy" && last.revision === digest) return last;
    }
    sleep(4000);
  }
  throw new Error(`Argo did not converge: ${JSON.stringify(last)}`);
}

function inspectKubernetes(cluster, expected) {
  const config = kubectlJson(cluster, ["get", "configmap", "coding-fleet-config", "-n", "c3agent", "-o", "json"]);
  checkConfig(config.data, expected);
  const deployments = kubectlJson(cluster, ["get", "deployments", "-n", "c3agent", "-l", "fleet=coding-fleet", "-o", "json"]).items;
  const pods = kubectlJson(cluster, ["get", "pods", "-n", "c3agent", "-l", "fleet=coding-fleet", "-o", "json"]).items;
  const secret = kubectlTry(cluster, ["get", "secret", "c3agent-runtime-secrets", "-n", "c3agent", "-o", "name"]);
  check(deployments.length === 2, "cluster must contain two disabled Deployments");
  check(deployments.every((item) => item.spec?.replicas === 0), "a c3agent Deployment was activated");
  check(pods.length === 0, "a c3agent Pod ran in the bounded configuration proof");
  check(!secret.ok, "the proof unexpectedly created credential material");
  return {
    result: "pass",
    namespace: "c3agent",
    objectCount: kubectlJson(cluster, ["get", "all,role,rolebinding,configmap,serviceaccount", "-n", "c3agent", "-o", "json"]).items.length,
    config: config.data,
    deploymentCount: deployments.length,
    desiredReplicas: deployments.reduce((total, item) => total + (item.spec?.replicas ?? 0), 0),
    podCount: pods.length,
    secretPresent: false,
  };
}

function verifyReceipt(receipt) {
  check(receipt.kind === "C3AgentConfigurationProofReceipt", "c3agent receipt has the wrong kind");
  check(receipt.status?.result === "pass", "c3agent receipt did not pass");
  for (const key of [
    "deterministicGeneration",
    "configurationOciRoundTrip",
    "configHubBase",
    "variantsAndPromotion",
    "releaseOci",
    "argoObjectReconciliation",
    "kubernetesObjectReconciliation",
  ]) {
    check(receipt.status[key] === "pass", `c3agent ${key} did not pass`);
  }
  check(receipt.status.kubernetesWorkloadReadiness === "not-run", "receipt overclaims workload readiness");
  check(receipt.status.agentTask === "not-run", "receipt overclaims an agent task");
  check(receipt.spec.lifecycle?.deploymentReplicas === 0, "receipt does not keep the workload disabled");
  check(receipt.spec.lifecycle?.secretPresent === false, "receipt claims a Secret value was present");
  check(receipt.spec.source?.runtimeImagesPublic === false, "receipt claims private images are public");
  check(/^sha256:[a-f0-9]{64}$/.test(receipt.spec.source?.digest ?? ""), "source OCI digest is invalid");
  check(/^sha256:[a-f0-9]{64}$/.test(receipt.spec.release?.manifestDigest ?? ""), "release digest is invalid");
  check(receipt.spec.argo?.revision === receipt.spec.release?.manifestDigest, "Argo used another release digest");
  check(receipt.spec.kubernetes?.desiredReplicas === 0, "Kubernetes ran a c3agent Deployment");
  check(receipt.spec.kubernetes?.podCount === 0, "Kubernetes ran a c3agent Pod");
  check(receipt.spec.promotion?.productionMatchesStaging === true, "production does not match promoted staging");
  check(
    (receipt.spec.limits ?? []).some((line) => line.includes("no c3agent process")),
    "receipt does not state the runtime boundary",
  );
}

function selfTest() {
  check(existsSync(receiptPath), "run the c3agent proof before its self-test");
  const original = readYaml(receiptPath);
  for (const mutation of [
    (value) => { value.status.agentTask = "pass"; },
    (value) => { value.spec.lifecycle.secretPresent = true; },
    (value) => { value.spec.argo.revision = `sha256:${"0".repeat(64)}`; },
  ]) {
    const candidate = structuredClone(original);
    mutation(candidate);
    let rejected = false;
    try {
      verifyReceipt(candidate);
    } catch {
      rejected = true;
    }
    check(rejected, "a false c3agent proof claim was accepted");
  }
}

function renderSummary(receipt) {
  const source = receipt.spec.source;
  const promotion = receipt.spec.promotion;
  return `# c3agent configuration, promotion, and delivery proof

This test began with a disabled c3agent fleet configuration. The three private
runtime images were pinned by digest and the Kubernetes objects referred to a
Secret without containing any credential value.

The development configuration was packed as local OCI, imported as a ConfigHub
base, changed in development, promoted to staging, changed again, promoted to
production, published as a ConfigHub release OCI, and reconciled by Argo CD on a
throwaway kind cluster.

## What passed

| Step | Result | Evidence |
| --- | --- | --- |
| Generate exact objects | ${receipt.status.deterministicGeneration} | Ten objects; object set \`${source.objectSetSha256}\`. |
| Pack and pull local OCI | ${receipt.status.configurationOciRoundTrip} | \`${source.digest}\`. |
| Keep a ConfigHub base | ${receipt.status.configHubBase} | Three Kubernetes Units retained the same OCI source digest. |
| Promote settings | ${receipt.status.variantsAndPromotion} | ${promotion.path}. |
| Publish release OCI | ${receipt.status.releaseOci} | \`${receipt.spec.release.manifestDigest}\`. |
| Reconcile through Argo CD | ${receipt.status.argoObjectReconciliation} | ${receipt.spec.argo.sync} and ${receipt.spec.argo.health} at the same digest. |
| Reconcile Kubernetes objects | ${receipt.status.kubernetesObjectReconciliation} | Two Deployments present with zero desired replicas; no Pods and no Secret. |
| Start c3agent | ${receipt.status.kubernetesWorkloadReadiness} | Deliberately outside this test. |
| Run an agent task | ${receipt.status.agentTask} | Deliberately outside this test. |

## The reviewed changes

| Environment | Max tasks | Max budget | Poll interval |
| --- | ---: | ---: | ---: |
| Development | ${receipt.spec.configHub.development.MAX_CONCURRENT_TASKS} | ${receipt.spec.configHub.development.MAX_BUDGET_USD} | ${receipt.spec.configHub.development.SCHEDULE_INTERVAL_SECONDS}s |
| Staging | ${receipt.spec.configHub.staging.MAX_CONCURRENT_TASKS} | ${receipt.spec.configHub.staging.MAX_BUDGET_USD} | ${receipt.spec.configHub.staging.SCHEDULE_INTERVAL_SECONDS}s |
| Production | ${receipt.spec.configHub.production.MAX_CONCURRENT_TASKS} | ${receipt.spec.configHub.production.MAX_BUDGET_USD} | ${receipt.spec.configHub.production.SCHEDULE_INTERVAL_SECONDS}s |

Only the fleet ConfigMap changed. The image selections, Services, RBAC, and
disabled Deployment definitions stayed the same.

## What this does not prove

${receipt.spec.limits.map((line) => `- ${line}`).join("\n")}

The source configuration and local proof are in
\`examples/c3agent/fleet-config/\`. The full machine receipt is
\`runs/c3agent-configuration-proof/receipt.yaml\`.
`;
}

function startRegistry(name) {
  command("docker", ["run", "-d", "--rm", "--name", name, "-p", "127.0.0.1::5000", "registry:2"]);
  const portOutput = command("docker", ["port", name, "5000/tcp"]).output.trim();
  const port = portOutput.match(/:(\d+)$/)?.[1];
  check(port, `could not determine registry port from ${portOutput}`);
  const host = `localhost:${port}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (tryCommand("curl", ["-fsS", `http://${host}/v2/`]).ok) return { host };
    sleep(250);
  }
  throw new Error(`temporary registry ${host} did not become ready`);
}

function clusterUp(context, name) {
  const result = tryCommand("cub", [
    "cluster", "up", "--name", name, "--no-ports", "--context", context,
  ], { timeout: 900_000 });
  check(result.ok, `cub cluster up failed: ${result.error}`);
  check(clusterPresent(name), `kind cluster ${name} is missing`);
  check(spacePresent(context, name), `cluster Space ${name} is missing`);
  check(spacePresent(context, `${name}-argo-apps`), `Argo apps Space ${name}-argo-apps is missing`);
}

function clusterDown(context, name) {
  const result = tryCommand("cub", [
    "cluster", "down", "--name", name, "--delete-config", "--force", "--context", context,
  ], { timeout: 600_000 });
  if (!result.ok && clusterPresent(name)) {
    tryCommand("kind", ["delete", "cluster", "--name", name], { timeout: 180_000 });
  }
  for (const space of [`${name}-argo-apps`, `argobot-${name}`, `${name}-cluster`, name]) deleteSpace(context, space);
}

function deleteSpace(context, space) {
  if (!spacePresent(context, space)) return;
  tryCommand("cub", [
    "space", "delete", space, "--recursive-force", "--quiet", "--context", context,
  ], { timeout: 300_000 });
}

function cub(context, args, options = {}) {
  const result = tryCommand("cub", [...args, "--context", context], options);
  check(result.ok, `cub ${args.slice(0, 3).join(" ")} failed: ${result.error}`);
  return result.output;
}

function cubJson(context, args, options = {}) {
  return JSON.parse(cub(context, args, options));
}

function spacePresent(context, space) {
  return tryCommand("cub", ["space", "get", space, "--quiet", "--context", context], { timeout: 60_000 }).ok;
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function containerPresent(name) {
  const result = tryCommand("docker", ["inspect", name]);
  return result.ok;
}

function kubectlJson(cluster, args) {
  const result = kubectlTry(cluster, args);
  check(result.ok, `kubectl ${args.slice(0, 4).join(" ")} failed: ${result.error}`);
  return JSON.parse(result.output);
}

function kubectlTry(cluster, args) {
  return tryCommand("kubectl", [
    "--kubeconfig", join(homedir(), ".confighub", "clusters", `${cluster}.kubeconfig`),
    "--context", `kind-${cluster}`,
    ...args,
  ], { timeout: 180_000 });
}

function command(file, args, options = {}) {
  const result = tryCommand(file, args, options);
  check(result.ok, `${file} ${args.slice(0, 4).join(" ")} failed: ${result.error}`);
  return result;
}

function tryCommand(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: repoRoot,
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    encoding: "utf8",
    input: options.input,
    timeout: options.timeout ?? 180_000,
    maxBuffer: 1024 * 1024 * 100,
  });
  return {
    ok: result.status === 0,
    output: result.stdout ?? "",
    error: [result.stderr, result.error?.message].filter(Boolean).join("\n").trim(),
  };
}

function changedUnits(left, right) {
  const leftMap = new Map(left.unitHashes.map((item) => [item.slug, item.dataHash]));
  const rightMap = new Map(right.unitHashes.map((item) => [item.slug, item.dataHash]));
  return [...new Set([...leftMap.keys(), ...rightMap.keys()])]
    .filter((slug) => leftMap.get(slug) !== rightMap.get(slug))
    .sort();
}

function normalizeDigest(value) {
  const match = String(value ?? "").match(/sha256:[a-f0-9]{64}/);
  return match?.[0] ?? "";
}

function hashDocuments(documents) {
  const ordered = [...documents]
    .sort((left, right) => objectIdentity(left).localeCompare(objectIdentity(right)))
    .map((document) => stableValue(document));
  return `sha256:${sha256(JSON.stringify(ordered))}`;
}

function objectIdentity(object) {
  return [object.apiVersion, object.kind, object.metadata?.namespace ?? "", object.metadata?.name ?? ""].join("|");
}

function describeObjectDiff(leftDocuments, rightDocuments) {
  const left = new Map(leftDocuments.map((document) => [objectIdentity(document), stableValue(document)]));
  const right = new Map(rightDocuments.map((document) => [objectIdentity(document), stableValue(document)]));
  const differences = [];
  for (const identity of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    collectDifferences(left.get(identity), right.get(identity), identity, differences);
    if (differences.length >= 12) break;
  }
  return differences.length ? differences.join(", ") : "no path-level difference found";
}

function collectDifferences(left, right, path, output) {
  if (output.length >= 12) return;
  if (JSON.stringify(left) === JSON.stringify(right)) return;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") {
    output.push(`${path}: ${JSON.stringify(left)} -> ${JSON.stringify(right)}`);
    return;
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    collectDifferences(left[key], right[key], `${path}.${key}`, output);
    if (output.length >= 12) return;
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function parseCubVersions(text) {
  return {
    client: text.match(/Client Version:[\s\S]*?Version:\s+(v[^\s]+)/)?.[1] ?? "",
    server: text.match(/Server Version:[\s\S]*?Version:\s+(v[^\s]+)/)?.[1] ?? "",
  };
}

function sameStrings(left, right) {
  return [...left].sort().join("\n") === [...right].sort().join("\n");
}

function safeRunId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12);
}

function title(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
