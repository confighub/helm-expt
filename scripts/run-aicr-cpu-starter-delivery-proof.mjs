#!/usr/bin/env node

// Live config-plane delivery proof for the CPU starter on kind.
//
// The starter's seven derived Argo CD Applications travel as one OCI artifact
// (the doctrine's single transport), get pulled back byte-faithful, and are
// applied to a throwaway kind cluster running a pinned Argo CD. The proof
// claims config-plane delivery only, and it proves the boundary instead of
// asserting it: none of the Applications carries an automated sync policy, the
// controller is given time to observe them and starts zero sync operations,
// and every component destination namespace is checked to be absent. The
// governed configuration arrived; nothing beyond it happened.
//
// The receipt binds the run to the starter's committed platform digest and the
// training entry's digest behind it. The throwaway cluster, registry, and
// working files are removed at the end, and the receipt refuses to verify
// unless that cleanup passed. No ConfigHub organization is involved in this
// receipt; the ConfigHub import and variant story is the separate variant
// proof next to this one.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
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

const exampleRoot = join(repoRoot, "examples", "aicr", "cpu-starter");
const receiptPath = join(repoRoot, "runs", "aicr-cpu-starter-delivery", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-cpu-starter-delivery", "summary.md");
const repository = "aicr-cpu-starter";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const argoVersion = "v3.4.5";
const argoManifestUrl = `https://raw.githubusercontent.com/argoproj/argo-cd/${argoVersion}/manifests/install.yaml`;
const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-cpu-starter-delivery-proof.mjs --run
  node scripts/run-aicr-cpu-starter-delivery-proof.mjs --generate
  node scripts/run-aicr-cpu-starter-delivery-proof.mjs --verify
  node scripts/run-aicr-cpu-starter-delivery-proof.mjs --self-test`);
  process.exit(2);
}

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-starter-delivery:generate`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-starter-delivery:generate`,
  );
  console.log("verified the CPU starter kind delivery proof");
} else {
  selfTest();
  console.log("verified the CPU starter delivery receipt checks against fake surfaces");
}

function loadExpectations(rootOverride) {
  const root = rootOverride ?? exampleRoot;
  const index = JSON.parse(readFileSync(join(root, "digest-index", "platform-index.json"), "utf8"));
  const platformDigest = index.spec?.platformDigest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(platformDigest), "the starter digest index records no platform digest");
  const derivedFrom = index.spec?.derivedFrom ?? {};
  const renderedRoot = join(root, "argocd-rendered");
  const files = listFiles(join(renderedRoot, "templates"))
    .filter((path) => path.endsWith(".yaml"))
    .sort();
  const rows = files.map((path) => {
    const text = readFileSync(path, "utf8");
    const docs = parseDocs(text).map(stripCommentMetadata);
    check(docs.length === 1, `${relativeRepo(path)}: expected exactly one document`);
    return { file: relativeRepo(path), sha256: sha256(text), doc: docs[0] };
  });
  check(rows.length > 0, "the starter has no rendered Applications");
  const docs = rows.map((row) => row.doc);
  const waves = docs
    .map((doc) => Number(doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION]))
    .sort((left, right) => left - right);
  const destinations = [...new Set(
    docs
      .map((doc) => String(doc.spec?.destination?.namespace ?? ""))
      .filter((namespace) => namespace && namespace !== "argocd"),
  )].sort();
  return {
    platformDigest,
    derivedFrom,
    rows,
    docs,
    applicationCount: docs.length,
    waves,
    destinations,
    automatedPolicyPresent: docs.some((doc) => doc.spec?.syncPolicy?.automated !== undefined),
    canonicalDataSha256: sha256(canonicalDocs(docs)),
  };
}

function run() {
  check(
    process.env.HELM_EXPT_ALLOW_KIND_CLUSTER === "1",
    "set HELM_EXPT_ALLOW_KIND_CLUSTER=1 to confirm this throwaway kind cluster run",
  );
  for (const [tool, args] of [
    ["docker", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["oras", ["version"]],
    ["curl", ["--version"]],
  ]) {
    check(tryCommand(tool, args).ok, `${tool} is required for the delivery proof`);
  }

  const expectations = loadExpectations();
  check(expectations.applicationCount === 7, "the committed starter no longer holds seven Applications");

  const observedAt = new Date().toISOString();
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || observedAt);
  const clusterName = `hx-aicr-starter-del-${runId}`;
  const container = `helm-expt-starter-del-${runId}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-starter-delivery-"));
  const kubeconfigPath = join(workRoot, "kubeconfig");
  let registryStarted = false;
  let clusterStarted = false;
  let receipt;
  const cleanup = { cluster: "not-created", registry: "not-started", localFiles: "pending" };

  try {
    check(
      !command("kind", ["get", "clusters"]).split("\n").includes(clusterName),
      `refusing to reuse existing kind cluster ${clusterName}`,
    );

    command("docker", ["run", "-d", "--rm", "--name", container, "-p", "127.0.0.1::5000", "registry:2"]);
    registryStarted = true;
    cleanup.registry = "pending";
    const portOutput = command("docker", ["port", container, "5000/tcp"]).trim();
    const registryPort = portOutput.match(/:(\d+)$/)?.[1] ?? "";
    check(registryPort, `could not determine the temporary registry port from ${portOutput}`);
    const registry = `localhost:${registryPort}`;
    waitForRegistry(registry);

    const registryRef = `${registry}/${repository}:0.14.0`;
    const renderedRoot = join(exampleRoot, "argocd-rendered");
    const templateFiles = expectations.rows.map((row) =>
      row.file.slice(`${relativeRepo(renderedRoot)}/`.length),
    );
    command(
      "oras",
      [
        "push",
        "--plain-http",
        "--artifact-type",
        artifactType,
        registryRef,
        ...templateFiles.map((file) => `${file}:application/yaml`),
      ],
      { cwd: renderedRoot },
    );
    const pushedDigest = command("oras", ["resolve", "--plain-http", registryRef]).trim();
    check(/^sha256:[0-9a-f]{64}$/.test(pushedDigest), `oras resolve returned no digest: ${pushedDigest}`);

    const pulledRoot = join(workRoot, "pulled");
    command("oras", ["pull", "--plain-http", "--output", pulledRoot, registryRef]);
    for (const [position, file] of templateFiles.entries()) {
      const pulled = join(pulledRoot, file);
      check(existsSync(pulled), `the OCI pull is missing ${file}`);
      check(
        sha256(readFileSync(pulled, "utf8")) === expectations.rows[position].sha256,
        `the OCI transport changed ${file}`,
      );
    }

    command("kind", ["create", "cluster", "--name", clusterName, "--kubeconfig", kubeconfigPath, "--wait", "180s"], {
      timeout: 420_000,
    });
    clusterStarted = true;
    cleanup.cluster = "pending";
    const kubectl = (args, options = {}) =>
      command("kubectl", ["--kubeconfig", kubeconfigPath, ...args], { timeout: 360_000, ...options });

    kubectl(["create", "namespace", "argocd"]);
    // Server-side apply: the ApplicationSet CRD exceeds kubectl's client-side
    // 262144-byte annotation cap, the same quirk the training entry's root
    // Application documents for chart CRDs.
    kubectl(["apply", "--server-side", "-n", "argocd", "-f", argoManifestUrl], { timeout: 300_000 });
    kubectl(["wait", "--for=condition=Established", "crd/applications.argoproj.io", "--timeout=120s"]);
    kubectl(["-n", "argocd", "rollout", "status", "deployment/argocd-repo-server", "--timeout=300s"]);

    // The retained Applications carry upstream automated sync policies, so a
    // running application controller would start delivering workloads the
    // moment they land. Hold the controller at zero replicas for the entire
    // run: acceptance is proven, and delivery cannot begin until a human
    // scales the controller up. Automatic stays false until earned.
    kubectl(["-n", "argocd", "scale", "statefulset", "argocd-application-controller", "--replicas=0"]);
    kubectl([
      "-n",
      "argocd",
      "wait",
      "--for=delete",
      "pod",
      "-l",
      "app.kubernetes.io/name=argocd-application-controller",
      "--timeout=120s",
    ]);

    kubectl(["apply", "-f", join(pulledRoot, "templates")]);

    const readApplication = (name) =>
      JSON.parse(kubectl(["get", "application", name, "-n", "argocd", "-o", "json"]));
    const assertAccepted = (label) => {
      for (const doc of expectations.docs) {
        const live = readApplication(doc.metadata.name);
        check(
          live.metadata?.annotations?.[SYNC_WAVE_ANNOTATION]
            === doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION],
          `${label}: ${doc.metadata.name} lost its sync-wave annotation`,
        );
        check(
          stableJson(live.spec) === stableJson(doc.spec),
          `${label}: the cluster's ${doc.metadata.name} spec differs from the committed starter`,
        );
        check(
          live.status?.operationState === undefined,
          `${label}: ${doc.metadata.name} shows a sync operation; the no-sync boundary broke`,
        );
      }
    };
    assertAccepted("on apply");

    // Let the cluster settle, then prove nothing acted: the controller is
    // still at zero replicas, no Application shows a sync operation, and no
    // component destination namespace exists.
    const settleSeconds = 30;
    for (let elapsed = 0; elapsed < settleSeconds; elapsed += 5) command("sleep", ["5"]);
    assertAccepted(`after ${settleSeconds}s settle`);
    const controllerScale = JSON.parse(
      kubectl(["-n", "argocd", "get", "statefulset", "argocd-application-controller", "-o", "json"]),
    );
    check(
      controllerScale.spec?.replicas === 0 && (controllerScale.status?.replicas ?? 0) === 0,
      "the application controller did not stay at zero replicas",
    );
    for (const namespace of expectations.destinations) {
      check(
        !tryCommand("kubectl", ["--kubeconfig", kubeconfigPath, "get", "namespace", namespace]).ok,
        `component namespace ${namespace} exists; something delivered workloads`,
      );
    }

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrCpuStarterDeliveryProofReceipt",
      metadata: { name: "aicr-cpu-starter-v0-14-0-delivery" },
      spec: {
        observedAt,
        input: {
          format: "derived CPU starter literal configuration OCI",
          committedEntry: relativeRepo(exampleRoot),
          starterPlatformDigest: expectations.platformDigest,
          derivedFromEntry: expectations.derivedFrom.entry,
          derivedFromPlatformDigest: expectations.derivedFrom.platformDigest,
          temporaryReference: `oci://${registryRef}`,
          digest: pushedDigest,
          applicationCount: expectations.applicationCount,
          syncWaves: expectations.waves,
          transportByteFaithful: true,
          canonicalDataSha256: expectations.canonicalDataSha256,
        },
        cluster: {
          shape: "throwaway kind cluster with an isolated kubeconfig",
          creationCommand: "kind create cluster",
          argoCd: {
            version: argoVersion,
            installManifest: argoManifestUrl,
            method: "pinned upstream manifest applied as a cluster prerequisite",
          },
        },
        delivery: {
          applied: true,
          appliedFrom: "the pulled OCI artifact, not the checkout",
          applicationsAccepted: expectations.applicationCount,
          applicationSpecsMatched: true,
          syncWavesPreserved: true,
          automatedSyncPolicyPresent: expectations.automatedPolicyPresent,
          controllerHeldAtZero: true,
          syncOperationsObserved: 0,
          settleSeconds: 30,
          componentNamespacesAbsent: expectations.destinations,
          workloadsDelivered: false,
        },
        cleanup,
        limits: [
          "This run proves config-plane delivery only: the Applications were accepted and no sync started. It claims no application sync, no workload behavior, and no component health.",
          "The retained Applications carry upstream automated sync policies, so the application controller was deliberately held at zero replicas for the entire run. Delivery cannot begin until a human scales the controller up; automatic stays false until earned.",
          "This run used a temporary local registry; it does not prove public registry publication.",
          "No ConfigHub organization was involved in this run; the ConfigHub import and reviewed-change story is the separate variant proof receipt.",
        ],
      },
      status: {
        result: "pass",
        ociTransport: "pass",
        clusterUp: "pass",
        argoCdInstall: "pass",
        applicationsAccepted: "pass",
        noSyncStarted: "pass",
        boundaryProven: "pass",
        claim:
          "The seven derived CPU starter Applications traveled as one OCI artifact, arrived byte-faithful, and were accepted with the real Argo CD CRDs on a throwaway kind cluster. The application controller was held at zero replicas, zero sync operations appeared, and every component namespace stayed absent: the governed configuration arrived, and nothing beyond it happened.",
      },
    };
  } finally {
    if (clusterStarted) {
      const deleted = tryCommand("kind", ["delete", "cluster", "--name", clusterName]);
      const gone = !command("kind", ["get", "clusters"]).split("\n").includes(clusterName);
      cleanup.cluster = deleted.ok && gone ? "pass" : "fail";
    }
    if (registryStarted) {
      const stopped = tryCommand("docker", ["stop", container]);
      const absent = waitForContainerRemoval(container);
      cleanup.registry = stopped.ok && absent ? "pass" : "fail";
    }
    try {
      rmSync(workRoot, { recursive: true, force: true });
      cleanup.localFiles = existsSync(workRoot) ? "fail" : "pass";
    } catch {
      cleanup.localFiles = "fail";
    }
  }

  check(receipt, "the CPU starter delivery proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `the CPU starter delivery proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(readYaml(receiptPath), loadExpectations());
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function verifyReceipt(receipt, expectations) {
  check(receipt.kind === "AicrCpuStarterDeliveryProofReceipt", "CPU starter delivery receipt kind changed");
  check(receipt.status?.result === "pass", "CPU starter delivery proof is not pass");
  for (const lane of [
    "ociTransport",
    "clusterUp",
    "argoCdInstall",
    "applicationsAccepted",
    "noSyncStarted",
    "boundaryProven",
  ]) {
    check(receipt.status?.[lane] === "pass", `CPU starter delivery receipt lane ${lane} did not pass`);
  }
  check(
    receipt.spec?.input?.starterPlatformDigest === expectations.platformDigest,
    "CPU starter delivery receipt no longer matches the committed starter platform digest",
  );
  check(
    receipt.spec?.input?.derivedFromPlatformDigest === expectations.derivedFrom.platformDigest,
    "CPU starter delivery receipt no longer matches the training-entry derivation digest",
  );
  check(
    receipt.spec?.input?.canonicalDataSha256 === expectations.canonicalDataSha256,
    "CPU starter delivery receipt canonical data differs from the committed starter files",
  );
  check(
    receipt.spec?.input?.applicationCount === expectations.applicationCount,
    "CPU starter delivery receipt Application count changed",
  );
  check(
    JSON.stringify(receipt.spec?.input?.syncWaves) === JSON.stringify(expectations.waves),
    "CPU starter delivery receipt sync waves changed",
  );
  check(
    receipt.spec?.input?.transportByteFaithful === true,
    "CPU starter delivery receipt does not record a byte-faithful OCI transport",
  );
  const delivery = receipt.spec?.delivery ?? {};
  check(
    delivery.applied === true
      && delivery.applicationsAccepted === expectations.applicationCount
      && delivery.applicationSpecsMatched === true
      && delivery.syncWavesPreserved === true,
    "CPU starter delivery acceptance evidence is incomplete",
  );
  check(
    delivery.automatedSyncPolicyPresent === expectations.automatedPolicyPresent
      && delivery.controllerHeldAtZero === true
      && delivery.syncOperationsObserved === 0
      && delivery.workloadsDelivered === false,
    "CPU starter delivery receipt does not prove the no-sync boundary",
  );
  check(
    JSON.stringify(delivery.componentNamespacesAbsent) === JSON.stringify(expectations.destinations),
    "CPU starter delivery receipt namespace-absence evidence does not cover every component destination",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "the CPU starter delivery proof cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("config-plane delivery only")),
    "the CPU starter delivery receipt must state the config-plane-only boundary",
  );
  check(
    !Number.isNaN(Date.parse(receipt.spec?.observedAt ?? "")),
    "the CPU starter delivery receipt records no valid timestamp",
  );
}

function renderSummary(receipt) {
  const input = receipt.spec.input;
  const delivery = receipt.spec.delivery;
  return `# CPU starter kind delivery proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the throwaway-cluster proof with
\`npm run aicr-starter-delivery:run\`; verify it without external access with
\`npm run aicr-starter-delivery:verify\`.

The seven derived CPU starter Applications traveled as one OCI artifact from a
temporary local registry, were pulled back byte-faithful, and were applied to
a throwaway kind cluster running Argo CD ${receipt.spec.cluster.argoCd.version}
from the pinned upstream manifest. All ${delivery.applicationsAccepted}
Applications were accepted with their specs and sync-waves intact.

The boundary was proven, not asserted. The retained Applications carry
upstream automated sync policies, so the application controller was held at
zero replicas for the entire run: after a ${delivery.settleSeconds}-second
settle it was still at zero, ${delivery.syncOperationsObserved} sync
operations appeared, and every component destination namespace
(${delivery.componentNamespacesAbsent.join(", ")}) stayed absent. Delivery
cannot begin until a human scales the controller up. The governed
configuration arrived; nothing beyond it happened.

The starter's committed platform digest at the time of the run was
\`${input.starterPlatformDigest}\`, derived from the training entry's
\`${input.derivedFromPlatformDigest}\`. The run happened on
${receipt.spec.observedAt}; the cluster, registry, and working files were
removed afterward.

## Limits

${receipt.spec.limits.map((limit) => `- ${limit}`).join("\n")}
`;
}

// The self-test exercises the receipt verifier against fake surfaces only.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-starter-delivery-self-test-"));
  try {
    const root = join(scratch, "starter");
    const template = [
      "apiVersion: argoproj.io/v1alpha1",
      "kind: Application",
      "metadata:",
      "  annotations:",
      `    ${SYNC_WAVE_ANNOTATION}: "0"`,
      "  name: fixture-component",
      "  namespace: argocd",
      "spec:",
      "  destination:",
      "    namespace: fixture-namespace",
      "    server: https://kubernetes.default.svc",
      "  source:",
      "    chart: fixture-component",
      "    repoURL: https://charts.invalid/fixture",
      "    targetRevision: 1.2.3",
      "",
    ].join("\n");
    write(join(root, "argocd-rendered", "templates", "fixture-component.yaml"), template);
    const fixtureDigest = `sha256:${"6".repeat(64)}`;
    const trainingDigest = `sha256:${"7".repeat(64)}`;
    write(
      join(root, "digest-index", "platform-index.json"),
      `${JSON.stringify({
        spec: {
          platformDigest: fixtureDigest,
          derivedFrom: { entry: "fixture-training", platformDigest: trainingDigest },
        },
      }, null, 2)}\n`,
    );
    const expectations = loadExpectations(root);
    check(
      expectations.applicationCount === 1
        && JSON.stringify(expectations.destinations) === JSON.stringify(["fixture-namespace"]),
      "self-test fixture expectations are wrong",
    );

    const receipt = () => ({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrCpuStarterDeliveryProofReceipt",
      metadata: { name: "fixture" },
      spec: {
        observedAt: "1970-01-01T00:00:00.000Z",
        input: {
          starterPlatformDigest: fixtureDigest,
          derivedFromPlatformDigest: trainingDigest,
          canonicalDataSha256: expectations.canonicalDataSha256,
          applicationCount: 1,
          syncWaves: [0],
          transportByteFaithful: true,
        },
        cluster: { argoCd: { version: argoVersion } },
        delivery: {
          applied: true,
          applicationsAccepted: 1,
          applicationSpecsMatched: true,
          syncWavesPreserved: true,
          automatedSyncPolicyPresent: false,
          controllerHeldAtZero: true,
          syncOperationsObserved: 0,
          settleSeconds: 30,
          componentNamespacesAbsent: ["fixture-namespace"],
          workloadsDelivered: false,
        },
        cleanup: { cluster: "pass", registry: "pass", localFiles: "pass" },
        limits: ["This run proves config-plane delivery only: nothing synced."],
      },
      status: {
        result: "pass",
        ociTransport: "pass",
        clusterUp: "pass",
        argoCdInstall: "pass",
        applicationsAccepted: "pass",
        noSyncStarted: "pass",
        boundaryProven: "pass",
      },
    });

    verifyReceipt(receipt(), expectations);

    const refusals = [
      [(r) => (r.spec.input.starterPlatformDigest = `sha256:${"9".repeat(64)}`), /committed starter platform digest/],
      [(r) => (r.spec.input.canonicalDataSha256 = "not-the-sha"), /canonical data differs/],
      [(r) => (r.spec.delivery.syncOperationsObserved = 1), /no-sync boundary/],
      [(r) => (r.spec.delivery.controllerHeldAtZero = false), /no-sync boundary/],
      [(r) => (r.spec.delivery.automatedSyncPolicyPresent = true), /no-sync boundary/],
      [(r) => (r.spec.delivery.componentNamespacesAbsent = []), /namespace-absence evidence/],
      [(r) => (r.spec.cleanup.cluster = "fail"), /cleanup did not pass/],
      [(r) => (r.spec.input.transportByteFaithful = false), /byte-faithful OCI transport/],
      [(r) => (r.spec.limits = []), /config-plane-only boundary/],
    ];
    for (const [mutate, pattern] of refusals) {
      const mutated = receipt();
      mutate(mutated);
      check(fails(() => verifyReceipt(mutated, expectations), pattern), `self-test accepted a receipt violating ${pattern}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function stripCommentMetadata(value) {
  if (Array.isArray(value)) return value.map(stripCommentMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("$comment$"))
      .map(([key, child]) => [key, stripCommentMetadata(child)]),
  );
}

function canonicalDocs(docs) {
  return JSON.stringify(
    docs
      .map((doc) => ({ identity: identity(doc), document: doc }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );
}

function identity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function waitForRegistry(registry) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (tryCommand("curl", ["-fsS", `http://${registry}/v2/`]).ok) return;
    command("sleep", ["0.25"]);
  }
  throw new Error(`temporary registry ${registry} did not become ready`);
}

function waitForContainerRemoval(container) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const name = command("docker", [
      "ps",
      "-a",
      "--filter",
      `name=^/${container}$`,
      "--format",
      "{{.Names}}",
    ]).trim();
    if (!name) return true;
    command("sleep", ["0.1"]);
  }
  return false;
}

function command(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });
}

function tryCommand(file, args, options = {}) {
  try {
    return { ok: true, out: command(file, args, options) };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
    };
  }
}

function safeRunId(value) {
  const compact = String(value)
    .replace(/\D/g, "")
    .slice(0, 14);
  check(compact.length >= 8, "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits");
  return compact;
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
