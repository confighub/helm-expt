#!/usr/bin/env node

import { spawnSync } from "node:child_process";
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
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set(["--run", "--generate", "--verify"]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-oci-roundtrip-proof.mjs --run
  node scripts/run-aicr-oci-roundtrip-proof.mjs --generate
  node scripts/run-aicr-oci-roundtrip-proof.mjs --verify`);
  process.exit(2);
}

const exampleRoot = join(
  repoRoot,
  "examples",
  "aicr",
  "eks-h100-training-kubeflow",
);
const renderedRoot = join(exampleRoot, "argocd-rendered");
const layoutRoot = join(exampleRoot, "oci-layouts", "argocd-config");
const layoutRef = `${layoutRoot}:0.14.0`;
const sourceDigest =
  "sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010";
const repository = "aicr-eks-h100-training-kubeflow-argocd-config";
const receiptPath = join(
  repoRoot,
  "runs",
  "aicr-oci-roundtrip-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "aicr-oci-roundtrip-proof",
  "summary.md",
);
const configHubOciHost = "oci.hub.confighub.com:443";
const expectedWaves = Array.from({ length: 16 }, (_, index) => index);

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
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-oci-roundtrip:generate`,
  );
  console.log("verified the AICR OCI round-trip proof");
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_SCRATCH_ORG === "1",
    "set HELM_EXPT_ALLOW_SCRATCH_ORG=1 to confirm this temporary live proof",
  );
  check(context, "set CUB_CONTEXT to an authenticated scratch organization");
  const contextInfo = cubJson(context, ["context", "get", context, "-o", "json"]);
  check(
    contextInfo.metadata?.organizationName !== "helm-catalog",
    "refusing to run this scratch proof in the maintained helm-catalog organization",
  );
  for (const [tool, args] of [
    ["cub", ["version"]],
    ["docker", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["oras", ["version"]],
    ["curl", ["--version"]],
  ]) {
    check(
      tryCommand(tool, args).ok,
      `${tool} is required for the AICR OCI round-trip proof`,
    );
  }

  const sourceDocs = sourceApplicationDocs();
  verifyApplicationSet(sourceDocs, "committed AICR configuration");
  const observedAt = new Date().toISOString();
  const runId = safeRunId(
    process.env.HELM_EXPT_PROOF_RUN_ID || observedAt,
  );
  const clusterName = `hx-aicr-oci-${runId}`;
  const clusterSpace = `${clusterName}-cluster`;
  const targetRef = `${clusterSpace}/oci`;
  const component = `hx-aicr-oci-${runId}`;
  const space = `${component}-base`;
  const registryName = `${component}-registry`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-aicr-oci-"));
  let registryStarted = false;
  let clusterStarted = false;
  let spaceCreated = false;
  let receipt;
  const cleanup = {
    baseSpace: "not-created",
    cluster: "not-created",
    clusterSpace: "not-created",
    registry: "not-started",
    localFiles: "pending",
  };

  try {
    check(
      !spacePresent(context, space),
      `refusing to reuse existing scratch Space ${space}`,
    );
    check(
      !clusterPresent(clusterName),
      `refusing to reuse existing kind cluster ${clusterName}`,
    );

    const registry = startRegistry(registryName);
    registryStarted = true;
    cleanup.registry = "pending";
    const inputReference = `${registry.host}/${repository}:0.14.0`;
    command("oras", [
      "cp",
      "--from-oci-layout",
      layoutRef,
      "--to-plain-http",
      inputReference,
    ], { timeout: 180_000 });
    const inputDigest = normalizeDigest(
      command("oras", [
        "resolve",
        "--plain-http",
        inputReference,
      ]).output,
    );
    check(
      inputDigest === sourceDigest,
      `temporary AICR OCI digest ${inputDigest} differs from ${sourceDigest}`,
    );

    clusterUp(context, clusterName);
    clusterStarted = true;
    cleanup.cluster = "pending";
    cleanup.clusterSpace = "pending";
    const target = cubJson(context, [
      "target",
      "get",
      "--space",
      clusterSpace,
      "oci",
      "-o",
      "json",
    ]).Target;
    check(target?.ProviderType === "OCI", `${targetRef} is not an OCI target`);

    cub(context, [
      "variant",
      "upload",
      "--component",
      component,
      "--variant",
      "base",
      "--space",
      space,
      "--granularity",
      "minimal",
      "--target",
      targetRef,
      "--label",
      "SourceType=aicr",
      "--label",
      "ResourceClass=system-configuration",
      "--layer",
      "Platform",
      "--owner",
      "Platform",
      "--change-desc",
      "Import the AICR v0.14.0 literal configuration OCI",
      `oci://${inputReference}`,
    ], { timeout: 420_000 });
    spaceCreated = true;
    cleanup.baseSpace = "pending";

    const imported = inspectImportedSpace(context, space, component);
    verifyApplicationSet(imported.docs, "ConfigHub base");
    check(
      canonicalDocs(imported.docs) === canonicalDocs(sourceDocs),
      "the ConfigHub base differs from the committed AICR Applications",
    );
    check(
      normalizeDigest(imported.space.Annotations?.ExternalSourceDigest)
        === sourceDigest,
      "ConfigHub did not record the input AICR OCI digest",
    );
    check(
      imported.space.ReleaseTargetID === target.TargetID,
      "the AICR base did not retain the release target",
    );

    const published = publishRelease(context, space);
    const pulled = pullConfigHubRelease({
      clusterName,
      space,
      manifestDigest: published.manifestDigest,
      sourceDocs,
      workRoot,
    });

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrOciRoundTripProofReceipt",
      metadata: {
        name: "aicr-eks-h100-training-kubeflow-v0-14-0",
      },
      spec: {
        observedAt,
        context: {
          organization: contextInfo.metadata?.organizationName ?? "unknown",
          purpose: "temporary source-neutral OCI round-trip proof",
        },
        input: {
          format: "AICR Argo CD literal configuration OCI",
          committedLayout: relativeRepo(layoutRoot),
          digest: sourceDigest,
          applicationCount: sourceDocs.length,
          syncWaves: expectedWaves,
          temporaryRegistry: true,
          anonymousLocalPull: "pass",
        },
        configHub: {
          base: {
            space,
            unit: component,
            spaceId: imported.space.SpaceID,
            unitId: imported.unit.UnitID,
            externalSourceDigest: normalizeDigest(
              imported.space.Annotations?.ExternalSourceDigest,
            ),
            sourceObjectsMatched: true,
            releaseTargetId: imported.space.ReleaseTargetID,
          },
          release: {
            ...published,
            resolvedManifestDigest: pulled.manifestDigest,
            pulledApplicationCount: pulled.applicationCount,
            sourceObjectsMatched: true,
            originAnnotationCount: pulled.originAnnotationCount,
            addedMetadata: pulled.addedMetadata,
          },
        },
        target: {
          shape: "throwaway cub-managed kind cluster with an OCI release target",
          provider: target.ProviderType,
          toolchain: target.ToolchainType,
          configurationApplied: false,
        },
        cleanup,
        limits: [
          "The input AICR OCI used a temporary local registry. Public Google Artifact Registry publication remains a separate receipt.",
          "The throwaway cluster supplied a ConfigHub release target and scoped OCI pull credential. The 17 Argo CD Applications were not applied to that cluster.",
          "This run did not reconcile the AICR stack, create an EKS cluster, use H100 nodes, or check workload health.",
          "The proof compares the 17 Kubernetes Application objects and permits only ConfigHub's confighub.com/origin annotation as added metadata.",
          "The temporary ConfigHub Space, cluster Space, kind cluster, registry, and local files were removed.",
        ],
      },
      status: {
        result: "pass",
        inputOci: "pass",
        configHubImport: "pass",
        configHubRelease: "pass",
        releasePull: "pass",
        exactApplicationSet: "pass",
        controllerReconciliation: "not-run",
        gpuWorkloadHealth: "not-run",
        claim: "ConfigHub imported the 17 exact Argo CD Applications from the AICR literal-configuration OCI and published a release OCI containing the same Kubernetes objects plus its origin annotation.",
      },
    };
  } finally {
    if (spaceCreated || spacePresent(context, space)) {
      cubTry(context, [
        "space",
        "delete",
        space,
        "--recursive-force",
        "--quiet",
      ], { timeout: 240_000 });
    }
    cleanup.baseSpace = spacePresent(context, space) ? "fail" : "pass";

    if (clusterStarted || clusterPresent(clusterName)) {
      clusterDown(context, clusterName);
    }
    cleanup.cluster = clusterPresent(clusterName) ? "fail" : "pass";
    cleanup.clusterSpace = spacePresent(context, clusterSpace) ? "fail" : "pass";

    if (registryStarted) {
      tryCommand("docker", ["stop", registryName], { timeout: 120_000 });
    }
    cleanup.registry = containerPresent(registryName) ? "fail" : "pass";

    rmSync(workRoot, { recursive: true, force: true });
    cleanup.localFiles = existsSync(workRoot) ? "fail" : "pass";
  }

  check(receipt, "the AICR OCI round-trip proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `AICR OCI round-trip cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(
    `wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`,
  );
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
  const portOutput = command("docker", [
    "port",
    name,
    "5000/tcp",
  ]).output.trim();
  const port = portOutput.match(/:(\d+)$/)?.[1] ?? "";
  check(port, `could not determine the temporary registry port from ${portOutput}`);
  const host = `localhost:${port}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (tryCommand("curl", ["-fsS", `http://${host}/v2/`]).ok) return { host };
    sleep(250);
  }
  throw new Error(`temporary registry ${host} did not become ready`);
}

function clusterUp(context, name) {
  const result = tryCommand(
    "cub",
    ["cluster", "up", "--name", name, "--no-ports"],
    { env: cubEnvironment(context), timeout: 900_000 },
  );
  check(
    result.ok || clusterPresent(name),
    `cub cluster up failed for ${name}: ${result.error}`,
  );
}

function clusterDown(context, name) {
  const result = tryCommand(
    "cub",
    ["cluster", "down", "--name", name, "--force"],
    { env: cubEnvironment(context), timeout: 600_000 },
  );
  if (!result.ok && clusterPresent(name)) {
    tryCommand(
      "kind",
      ["delete", "cluster", "--name", name],
      { timeout: 180_000 },
    );
  }
  const clusterSpace = `${name}-cluster`;
  for (
    let attempt = 0;
    attempt < 3 && spacePresent(context, clusterSpace);
    attempt += 1
  ) {
    cubTry(context, [
      "space",
      "delete",
      clusterSpace,
      "--recursive-force",
      "--quiet",
    ], { timeout: 240_000 });
    sleep(1000);
  }
}

function inspectImportedSpace(context, space, unit) {
  const spaceResponse = cubJson(context, [
    "space",
    "get",
    space,
    "-o",
    "json",
  ]).Space;
  const unitResponse = cubJson(context, [
    "unit",
    "get",
    unit,
    "--space",
    space,
    "-o",
    "json",
  ]).Unit;
  const text = cub(context, [
    "unit",
    "data",
    unit,
    "--space",
    space,
  ]);
  return {
    space: spaceResponse,
    unit: unitResponse,
    docs: parseDocs(text).map((doc) =>
      pruneImporterMetadata(doc, "source", "", new Set())),
  };
}

function publishRelease(context, space) {
  const response = cubJson(context, [
    "release",
    "publish",
    space,
    "-o",
    "json",
  ], { timeout: 300_000 });
  const release = response.Release ?? response.release ?? response;
  const manifestDigest = normalizeDigest(
    release.ManifestDigest ?? release.manifestDigest,
  );
  check(manifestDigest, `${space} release publish returned no manifest digest`);
  return {
    space,
    reference: `oci://${configHubOciHost}/space/${space}:latest`,
    manifestDigest,
    bundleDigest: normalizeDigest(release.Digest ?? release.digest),
    releaseId: String(release.ReleaseID ?? release.releaseId ?? ""),
  };
}

function pullConfigHubRelease({
  clusterName,
  space,
  manifestDigest,
  sourceDocs,
  workRoot,
}) {
  const registryConfig = registryConfigFromCluster(clusterName);
  const configPath = join(workRoot, "registry.json");
  const pullRoot = join(workRoot, "release");
  const extractRoot = join(workRoot, "release-extracted");
  writeFileSync(configPath, registryConfig, { mode: 0o600 });
  mkdirSync(pullRoot, { recursive: true });
  mkdirSync(extractRoot, { recursive: true });
  const reference = `${configHubOciHost}/space/${space}@${manifestDigest}`;
  try {
    const resolved = normalizeDigest(command("oras", [
      "resolve",
      reference,
      "--registry-config",
      configPath,
    ], { timeout: 120_000 }).output);
    check(
      resolved === manifestDigest,
      `resolved ConfigHub digest ${resolved} differs from ${manifestDigest}`,
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
    command("tar", ["-xf", path, "-C", extractRoot]);
  }
  const documents = new Map();
  for (const path of [...filesUnder(pullRoot), ...filesUnder(extractRoot)]) {
    let parsed = [];
    try {
      parsed = parseDocs(readFileSync(path, "utf8"));
    } catch {
      parsed = [];
    }
    for (const document of parsed) {
      if (!document.apiVersion || !document.kind || !document.metadata?.name) {
        continue;
      }
      documents.set(identity(document), document);
    }
  }
  const pulledDocs = [...documents.values()]
    .sort((left, right) => identity(left).localeCompare(identity(right)));
  verifyApplicationSet(pulledDocs, "pulled ConfigHub release");
  const ignored = new Set();
  const normalizedPulled = pulledDocs.map((doc) =>
    pruneImporterMetadata(doc, "ConfigHub", "", ignored));
  check(
    canonicalDocs(normalizedPulled) === canonicalDocs(sourceDocs),
    "the ConfigHub release OCI differs from the input AICR Applications",
  );
  const addedMetadata = [...ignored].sort();
  const allowedMetadata = new Set([
    "/metadata/annotations/confighub.com/origin",
  ]);
  check(
    addedMetadata.every((path) =>
      allowedMetadata.has(path) || path.endsWith("/$comment$head$")),
    `the ConfigHub release added unexpected metadata: ${addedMetadata.join(", ")}`,
  );
  const originAnnotationCount = pulledDocs.filter(
    (doc) => doc.metadata?.annotations?.["confighub.com/origin"],
  ).length;
  check(
    originAnnotationCount === sourceDocs.length,
    `expected ${sourceDocs.length} origin annotations, found ${originAnnotationCount}`,
  );
  return {
    manifestDigest,
    applicationCount: pulledDocs.length,
    originAnnotationCount,
    addedMetadata,
  };
}

function registryConfigFromCluster(clusterName) {
  const result = tryCommand("kubectl", [
    "--kubeconfig",
    clusterKubeconfig(clusterName),
    "--context",
    `kind-${clusterName}`,
    "-n",
    "argocd",
    "get",
    "secret",
    "confighub-oci-creds",
    "-o",
    "json",
  ], { timeout: 120_000 });
  check(result.ok, "the ConfigHub OCI pull Secret was not found");
  const secret = JSON.parse(result.output);
  const data = secret.data ?? {};
  if (
    secret.type === "kubernetes.io/dockerconfigjson"
    && data[".dockerconfigjson"]
  ) {
    return Buffer.from(data[".dockerconfigjson"], "base64").toString("utf8");
  }
  check(
    data.username && data.password,
    `unsupported ConfigHub OCI pull Secret shape (${Object.keys(data).sort().join(",") || "no data"})`,
  );
  const username = Buffer.from(data.username, "base64").toString("utf8");
  const password = Buffer.from(data.password, "base64").toString("utf8");
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  return JSON.stringify({
    auths: {
      [configHubOciHost]: { auth },
    },
  });
}

function sourceApplicationDocs() {
  return filesUnder(renderedRoot)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")))
    .map((doc) => pruneImporterMetadata(doc, "source", "", new Set()));
}

function verifyApplicationSet(docs, label) {
  check(docs.length === 17, `${label} must contain 17 Argo CD Applications`);
  check(
    docs.every(
      (doc) =>
        doc.apiVersion === "argoproj.io/v1alpha1"
        && doc.kind === "Application"
        && doc.metadata?.namespace === "argocd",
    ),
    `${label} contains an object that is not an Argo CD Application in argocd`,
  );
  const waves = docs
    .filter((doc) => doc.metadata?.name !== "aicr-stack")
    .map((doc) =>
      Number(doc.metadata?.annotations?.["argocd.argoproj.io/sync-wave"]))
    .sort((left, right) => left - right);
  check(
    JSON.stringify(waves) === JSON.stringify(expectedWaves),
    `${label} sync waves changed`,
  );
}

function canonicalDocs(docs) {
  return JSON.stringify(
    docs
      .map((doc) => ({
        identity: identity(doc),
        document: canonicalValue(doc),
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

function pruneImporterMetadata(value, side, path, ignored) {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      pruneImporterMetadata(item, side, `${path}/${index}`, ignored));
  }
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("$comment$")) {
      if (side === "ConfigHub") ignored.add(`${path}/${key}` || `/${key}`);
      continue;
    }
    if (
      side === "ConfigHub"
      && path === "/metadata/annotations"
      && key === "confighub.com/origin"
    ) {
      ignored.add(`${path}/${key}`);
      continue;
    }
    const cleaned = pruneImporterMetadata(
      child,
      side,
      `${path}/${key}`,
      ignored,
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
    if (cleaned !== undefined && cleaned !== null) result[key] = cleaned;
  }
  return result;
}

function identity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function filesUnder(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function cub(context, args, options = {}) {
  return command("cub", args, {
    ...options,
    env: cubEnvironment(context),
  }).output;
}

function cubTry(context, args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: cubEnvironment(context),
  });
}

function cubJson(context, args, options = {}) {
  return JSON.parse(cub(context, args, options));
}

function cubEnvironment(context) {
  return {
    ...process.env,
    CONFIGHUB_AGENT: "1",
    CUB_CONTEXT: context,
  };
}

function spacePresent(context, space) {
  return cubTry(context, ["space", "get", space, "-o", "json"]).ok;
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function containerPresent(name) {
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

function clusterKubeconfig(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.kubeconfig`);
}

function command(file, args, options = {}) {
  const result = tryCommand(file, args, options);
  if (!result.ok) {
    throw new Error(
      `${file} ${args.slice(0, 4).join(" ")} failed: ${result.error}`,
    );
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
    // Inline flag groups are non-capturing, so the $1 this replacement uses was
    // always empty and the key name was dropped along with the value. They are
    // also newer than the Node this runs on in CI, where the expression throws
    // and takes the whole redaction with it. A capturing group with the i flag
    // does what the line always meant.
    .replace(/\b(password|token|secret)\s*[:=]\s*\S+/gi, "$1=<redacted>")
    .replace(/[A-Za-z0-9_-]{40,}/g, "<redacted-long-value>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function safeRunId(value) {
  const compact = String(value).replace(/\D/g, "").slice(0, 14);
  check(
    compact.length >= 8,
    "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits",
  );
  return compact;
}

function sleep(milliseconds) {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    milliseconds,
  );
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "AicrOciRoundTripProofReceipt",
    "AICR OCI round-trip receipt kind changed",
  );
  check(receipt.status?.result === "pass", "AICR OCI round-trip is not pass");
  check(
    receipt.spec?.input?.digest === sourceDigest
      && receipt.spec.input.applicationCount === 17
      && JSON.stringify(receipt.spec.input.syncWaves)
        === JSON.stringify(expectedWaves),
    "AICR input evidence changed",
  );
  check(
    receipt.spec?.configHub?.base?.sourceObjectsMatched === true
      && receipt.spec.configHub.base.externalSourceDigest === sourceDigest,
    "AICR ConfigHub import did not pass",
  );
  const release = receipt.spec?.configHub?.release;
  check(
    /^sha256:[a-f0-9]{64}$/.test(release?.manifestDigest ?? "")
      && release.manifestDigest === release.resolvedManifestDigest
      && release.pulledApplicationCount === 17
      && release.sourceObjectsMatched === true
      && release.originAnnotationCount === 17,
    "AICR ConfigHub release round trip did not pass",
  );
  check(
    (release.addedMetadata ?? []).every((path) =>
      path === "/metadata/annotations/confighub.com/origin"
      || path.endsWith("/$comment$head$")),
    "AICR release contains unexpected added metadata",
  );
  check(
    receipt.spec?.target?.configurationApplied === false
      && receipt.status?.controllerReconciliation === "not-run"
      && receipt.status?.gpuWorkloadHealth === "not-run",
    "AICR receipt overstates live delivery",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every(
      (result) => result === "pass",
    ),
    "AICR OCI round-trip cleanup did not pass",
  );
  const serialized = JSON.stringify(receipt);
  check(
    !serialized.includes("@confighub.com"),
    "AICR OCI receipt contains a user identity",
  );
  check(
    !serialized.includes("ch_"),
    "AICR OCI receipt contains a ConfigHub credential",
  );
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  const release = spec.configHub.release;
  return `# AICR OCI in, ConfigHub, OCI out

This live test starts with the 17 Argo CD Application objects generated from the
AICR EKS H100 training recipe. The objects are already stored in a literal
configuration OCI. The test imports that OCI into a temporary ConfigHub base,
publishes a ConfigHub release OCI, pulls the release back, and compares every
Kubernetes object with the input.

## Result

**${receipt.status.result}.** ${receipt.status.claim}

| Step | Result | What was checked |
| --- | --- | --- |
| Read the AICR input OCI | ${receipt.status.inputOci} | ${spec.input.applicationCount} Applications at \`${spec.input.digest}\`; sync waves 0 through 15. |
| Import the base into ConfigHub | ${receipt.status.configHubImport} | ConfigHub recorded the source digest and stored the same 17 Applications. |
| Publish a ConfigHub release OCI | ${receipt.status.configHubRelease} | \`${release.manifestDigest}\`. |
| Pull the release back | ${receipt.status.releasePull} | The resolved digest matched the published digest. |
| Compare the objects | ${receipt.status.exactApplicationSet} | All 17 Applications matched. ConfigHub added its origin annotation to each object. |
| Apply the Applications | ${receipt.status.controllerReconciliation} | Not attempted. |
| Check an EKS or GPU workload | ${receipt.status.gpuWorkloadHealth} | Not attempted. |

## What this proves

- A literal configuration OCI produced from AICR can become a ConfigHub base.
- ConfigHub can publish that base as a release OCI.
- Pulling the ConfigHub release returns the same 17 Argo CD Applications, with
  ConfigHub's \`confighub.com/origin\` annotation added for provenance.
- The input and output OCI digests differ because they are separate artifacts.
  Object comparison, not digest equality, proves that the Kubernetes configuration
  stayed the same.

## What it does not prove

${spec.limits.map((limit) => `- ${limit}`).join("\n")}

## Evidence

- [Live receipt](../../runs/aicr-oci-roundtrip-proof/receipt.yaml)
- [AICR source and local OCI receipt](../../examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml)
- [AICR ConfigHub upload receipt](../../examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml)
- [AICR demonstration guide](../../docs/demo/aicr/eks-h100-training-kubeflow.md)
`;
}
