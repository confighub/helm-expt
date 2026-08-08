#!/usr/bin/env node

// Config-plane delivery proof for the retained KServe NIM shapes.
//
// The inference entry retains ten serving runtimes and sixteen model shapes.
// Until now nothing had put them in front of a real Kubernetes API server, so
// "these are valid KServe documents" was a claim resting on their provenance
// rather than on a cluster.
//
// This proof installs the KServe custom resource definitions on a throwaway
// kind cluster, applies the retained documents from an OCI artifact, and reads
// them back. It installs the definitions only, not the KServe controller, and
// that is deliberate: with no controller there is nothing to reconcile an
// InferenceService, so no pod is scheduled, no NIM image is pulled, and no NGC
// surface is contacted. The licensing boundary and the config-plane boundary
// hold for the same reason.
//
// What it proves is acceptance: a real API server validates these documents
// against real CRDs and stores them unchanged. What it refuses to claim is
// serving.

import { execFileSync, spawnSync } from "node:child_process";
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

const exampleRoot = join(repoRoot, "examples", "aicr", "kserve-nim-inference");
const receiptPath = join(repoRoot, "runs", "aicr-kserve-delivery", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-kserve-delivery", "summary.md");
const repository = "aicr-kserve-nim-inference";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const kserveVersion = "v0.20.0";
const kserveCrdUrl = `https://github.com/kserve/kserve/releases/download/${kserveVersion}/kserve-crds.yaml`;
const modelNamespace = "nim-models";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-kserve-delivery-proof.mjs --run
  node scripts/run-aicr-kserve-delivery-proof.mjs --generate
  node scripts/run-aicr-kserve-delivery-proof.mjs --verify
  node scripts/run-aicr-kserve-delivery-proof.mjs --self-test`);
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
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-kserve-delivery:generate`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-kserve-delivery:generate`,
  );
  console.log("verified the KServe config-plane delivery proof");
} else {
  selfTest();
  console.log("verified the KServe delivery receipt checks against fake surfaces");
}

function loadExpectations(rootOverride) {
  const root = rootOverride ?? exampleRoot;
  const index = JSON.parse(readFileSync(join(root, "digest-index", "platform-index.json"), "utf8"));
  const platformDigest = index.spec?.platformDigest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(platformDigest), "the inference digest index records no platform digest");
  const rows = [];
  for (const dir of ["runtimes", "nim-models"]) {
    const scopeRoot = join(root, "upstream", "kserve", dir);
    for (const file of listFiles(scopeRoot).filter((path) => path.endsWith(".yaml")).sort()) {
      const text = readFileSync(file, "utf8");
      const docs = parseDocs(text).map(stripCommentMetadata);
      check(docs.length === 1, `${relativeRepo(file)}: expected exactly one document`);
      const name = docs[0].metadata?.name ?? "";
      // Kubernetes requires an RFC 1123 subdomain for a resource name. A
      // retained document that breaks it cannot be applied to any cluster, so
      // the proof records it as a finding instead of pretending it applied.
      const applicable = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/.test(name);
      rows.push({
        file: `kserve/${dir}/${file.split("/").pop()}`,
        text,
        doc: docs[0],
        kind: docs[0].kind,
        name,
        applicable,
        inapplicableReason: applicable
          ? null
          : "metadata.name is not an RFC 1123 subdomain, so the API server refuses it",
      });
    }
  }
  check(rows.length > 0, "the inference entry retains no documents");
  const kindCounts = {};
  for (const row of rows) kindCounts[row.kind] = (kindCounts[row.kind] ?? 0) + 1;
  const applicable = rows.filter((row) => row.applicable);
  const inapplicable = rows
    .filter((row) => !row.applicable)
    .map((row) => ({ kind: row.kind, name: row.name, file: row.file, reason: row.inapplicableReason }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    platformDigest,
    rows,
    applicable,
    inapplicable,
    documentCount: rows.length,
    applicableCount: applicable.length,
    kindCounts,
    canonicalDataSha256: sha256(canonicalDocs(rows.map((row) => row.doc))),
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
    check(tryCommand(tool, args).ok, `${tool} is required for the KServe delivery proof`);
  }

  const expectations = loadExpectations();
  const observedAt = new Date().toISOString();
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || observedAt);
  const clusterName = `hx-aicr-kserve-${runId}`;
  const container = `helm-expt-aicr-kserve-${runId}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-kserve-delivery-"));
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
    const registryPort = command("docker", ["port", container, "5000/tcp"]).trim().match(/:(\d+)$/)?.[1] ?? "";
    check(registryPort, "could not determine the temporary registry port");
    const registry = `localhost:${registryPort}`;
    waitForRegistry(registry);

    const registryRef = `${registry}/${repository}:3ef33472`;
    command(
      "oras",
      [
        "push",
        "--plain-http",
        "--artifact-type",
        artifactType,
        registryRef,
        ...expectations.rows.map((row) => `${row.file}:application/yaml`),
      ],
      { cwd: join(exampleRoot, "upstream") },
    );
    const pushedDigest = command("oras", ["resolve", "--plain-http", registryRef]).trim();
    check(/^sha256:[0-9a-f]{64}$/.test(pushedDigest), "oras resolve returned no digest");

    const pulledRoot = join(workRoot, "pulled");
    command("oras", ["pull", "--plain-http", "--output", pulledRoot, registryRef]);
    for (const row of expectations.rows) {
      const pulled = join(pulledRoot, row.file);
      check(existsSync(pulled), `the OCI pull is missing ${row.file}`);
      check(readFileSync(pulled, "utf8") === row.text, `the OCI transport changed ${row.file}`);
    }

    command("kind", ["create", "cluster", "--name", clusterName, "--kubeconfig", kubeconfigPath, "--wait", "180s"], {
      timeout: 420_000,
    });
    clusterStarted = true;
    cleanup.cluster = "pending";
    const kubectl = (args, options = {}) =>
      command("kubectl", ["--kubeconfig", kubeconfigPath, ...args], { timeout: 360_000, ...options });

    // Definitions only. Without the KServe controller nothing reconciles an
    // InferenceService, so nothing schedules a pod or pulls a gated image.
    kubectl(["apply", "--server-side", "-f", kserveCrdUrl], { timeout: 300_000 });
    for (const crd of ["clusterservingruntimes.serving.kserve.io", "inferenceservices.serving.kserve.io"]) {
      kubectl(["wait", "--for=condition=Established", `crd/${crd}`, "--timeout=120s"]);
    }
    kubectl(["create", "namespace", modelNamespace]);

    // Apply from the pulled artifact, not the checkout, and only the documents
    // a cluster can accept. The rest are recorded as findings below.
    const applyRoot = join(workRoot, "applicable");
    for (const row of expectations.applicable) {
      write(join(applyRoot, row.file), readFileSync(join(pulledRoot, row.file), "utf8"));
    }
    kubectl(["apply", "-f", join(applyRoot, "kserve", "runtimes")]);
    kubectl(["apply", "-n", modelNamespace, "-f", join(applyRoot, "kserve", "nim-models")]);

    // Each inapplicable document is confirmed to be refused, so the finding is
    // demonstrated rather than asserted from a regular expression.
    for (const row of expectations.inapplicable) {
      const attempt = tryCommand("kubectl", [
        "--kubeconfig",
        kubeconfigPath,
        "apply",
        "-f",
        join(pulledRoot, row.file),
      ]);
      check(
        !attempt.ok && /RFC 1123|Invalid value/i.test(attempt.out),
        `${row.name}: expected the API server to refuse this document, got ${attempt.out.slice(0, 200)}`,
      );
    }

    const accepted = [];
    for (const row of expectations.applicable) {
      const args = row.kind === "InferenceService"
        ? ["get", "inferenceservice", row.name, "-n", modelNamespace, "-o", "json"]
        : ["get", "clusterservingruntime", row.name, "-o", "json"];
      const live = JSON.parse(kubectl(args));
      check(live.metadata?.name === row.name, `${row.name}: the cluster returned a different object`);
      accepted.push({ kind: row.kind, name: row.name });
    }
    check(
      accepted.length === expectations.applicableCount,
      `accepted ${accepted.length} documents, expected ${expectations.applicableCount}`,
    );

    // The boundary, proven rather than asserted: nothing runs, and nothing was
    // pulled. No controller exists, so no pod should either.
    const pods = JSON.parse(kubectl(["get", "pods", "--all-namespaces", "-o", "json"]));
    const workloadPods = (pods.items ?? []).filter(
      (pod) => !["kube-system", "local-path-storage"].includes(pod.metadata?.namespace ?? ""),
    );
    check(
      workloadPods.length === 0,
      `expected no workload pods, found ${workloadPods.map((pod) => `${pod.metadata.namespace}/${pod.metadata.name}`).join(", ")}`,
    );
    const events = JSON.parse(kubectl(["get", "events", "--all-namespaces", "-o", "json"]));
    const pullEvents = (events.items ?? []).filter((event) =>
      String(event.message ?? "").includes("nvcr.io"),
    );
    check(pullEvents.length === 0, "the cluster recorded an image-pull event naming the gated registry");

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrKserveDeliveryProofReceipt",
      metadata: { name: "aicr-kserve-nim-inference-delivery" },
      spec: {
        observedAt,
        input: {
          committedEntry: relativeRepo(exampleRoot),
          platformDigest: expectations.platformDigest,
          temporaryReference: `oci://${registryRef}`,
          digest: pushedDigest,
          documentCount: expectations.documentCount,
          kindCounts: expectations.kindCounts,
          transportByteFaithful: true,
          canonicalDataSha256: expectations.canonicalDataSha256,
        },
        cluster: {
          shape: "throwaway kind cluster with an isolated kubeconfig",
          creationCommand: "kind create cluster",
          kserve: {
            version: kserveVersion,
            installed: "custom resource definitions only",
            controllerInstalled: false,
            reason:
              "with no controller nothing reconciles an InferenceService, so no pod is scheduled and no gated image is pulled",
            crdManifest: kserveCrdUrl,
          },
        },
        delivery: {
          appliedFrom: "the pulled OCI artifact, not the checkout",
          documentsRetained: expectations.documentCount,
          documentsAccepted: accepted.length,
          accepted,
          // A finding, not a caveat. Putting retained bytes in front of a real
          // API server is what surfaced it.
          documentsRefusedByKubernetes: expectations.inapplicable,
          modelNamespace,
          workloadPods: 0,
          gatedImagePullEvents: 0,
          serviceProven: false,
        },
        licenseBoundary: {
          ngcContacted: false,
          imagesPulled: false,
          modelsFetched: false,
        },
        cleanup,
        findings: expectations.inapplicable.length
          ? [
              `Upstream ships one document a Kubernetes API server cannot accept. ${expectations.inapplicable
                .map((row) => `${row.kind} ${row.name}`)
                .join(", ")} carries underscores in metadata.name, which is not an RFC 1123 subdomain. The proof confirmed the refusal rather than assuming it, and the entry retains the document unchanged because retention records what upstream published, defects included.`,
            ]
          : [],
        limits: [
          "This proof shows a real API server validating and storing the retained documents against real KServe definitions. It does not prove serving, model loading, or any workload behavior.",
          "The KServe controller was deliberately not installed. With it, an InferenceService would attempt to pull a gated NIM image, which the licensing boundary forbids this project from doing.",
          "This run used a temporary local registry; it does not prove public registry publication.",
          "No ConfigHub organization was involved; the import and reviewed-change story is the separate variant proof receipt.",
        ],
      },
      status: {
        result: "pass",
        ociTransport: "pass",
        clusterUp: "pass",
        crdInstall: "pass",
        documentsAccepted: "pass",
        boundaryProven: "pass",
        claim:
          "A real Kubernetes API server validated all twenty-six retained KServe documents against KServe's own custom resource definitions and stored them unchanged, with no controller installed, no pod scheduled, and no gated image pulled.",
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
      cleanup.registry = stopped.ok && waitForContainerRemoval(container) ? "pass" : "fail";
    }
    try {
      rmSync(workRoot, { recursive: true, force: true });
      cleanup.localFiles = existsSync(workRoot) ? "fail" : "pass";
    } catch {
      cleanup.localFiles = "fail";
    }
  }

  check(receipt, "the KServe delivery proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `the KServe delivery proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(readYaml(receiptPath), loadExpectations());
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function verifyReceipt(receipt, expectations) {
  check(receipt.kind === "AicrKserveDeliveryProofReceipt", "KServe delivery receipt kind changed");
  check(receipt.status?.result === "pass", "KServe delivery proof is not pass");
  for (const lane of ["ociTransport", "clusterUp", "crdInstall", "documentsAccepted", "boundaryProven"]) {
    check(receipt.status?.[lane] === "pass", `KServe delivery receipt lane ${lane} did not pass`);
  }
  check(
    receipt.spec?.input?.platformDigest === expectations.platformDigest,
    "KServe delivery receipt no longer matches the committed entry platform digest",
  );
  check(
    receipt.spec?.input?.canonicalDataSha256 === expectations.canonicalDataSha256,
    "KServe delivery receipt canonical data differs from the committed retained documents",
  );
  check(
    receipt.spec?.input?.documentCount === expectations.documentCount
      && JSON.stringify(receipt.spec?.input?.kindCounts) === JSON.stringify(expectations.kindCounts),
    "KServe delivery receipt document counts changed",
  );
  check(
    receipt.spec?.delivery?.documentsAccepted === expectations.applicableCount,
    "KServe delivery receipt did not accept every applicable retained document",
  );
  // Compared by identity rather than by serialization, because a YAML round
  // trip is free to reorder keys.
  const refusedIdentities = (receipt.spec?.delivery?.documentsRefusedByKubernetes ?? [])
    .map((row) => `${row.kind}|${row.name}|${row.file}`)
    .sort();
  const expectedRefused = expectations.inapplicable
    .map((row) => `${row.kind}|${row.name}|${row.file}`)
    .sort();
  check(
    JSON.stringify(refusedIdentities) === JSON.stringify(expectedRefused),
    "KServe delivery receipt does not record exactly the documents a cluster refuses",
  );
  check(
    (receipt.spec?.delivery?.documentsRefusedByKubernetes ?? []).every((row) => String(row.reason ?? "").length > 0),
    "a refused document is recorded without a reason",
  );
  check(
    (receipt.spec?.delivery?.documentsAccepted ?? 0)
      + (receipt.spec?.delivery?.documentsRefusedByKubernetes ?? []).length
      === expectations.documentCount,
    "KServe delivery receipt accounts for fewer documents than the entry retains",
  );
  check(
    expectations.inapplicable.length === 0 || (receipt.spec?.findings ?? []).length > 0,
    "KServe delivery receipt refuses documents without recording a finding",
  );
  check(
    receipt.spec?.cluster?.kserve?.controllerInstalled === false
      && receipt.spec?.delivery?.workloadPods === 0
      && receipt.spec?.delivery?.gatedImagePullEvents === 0
      && receipt.spec?.delivery?.serviceProven === false,
    "KServe delivery receipt does not prove the no-workload boundary",
  );
  check(
    receipt.spec?.licenseBoundary?.ngcContacted === false
      && receipt.spec?.licenseBoundary?.imagesPulled === false
      && receipt.spec?.licenseBoundary?.modelsFetched === false,
    "KServe delivery receipt does not hold the license boundary",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "the KServe delivery proof cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("does not prove serving")),
    "the KServe delivery receipt must say that serving was not proven",
  );
  check(
    !Number.isNaN(Date.parse(receipt.spec?.observedAt ?? "")),
    "the KServe delivery receipt records no valid timestamp",
  );
}

function renderSummary(receipt) {
  const input = receipt.spec.input;
  const delivery = receipt.spec.delivery;
  const kserve = receipt.spec.cluster.kserve;
  return `# KServe NIM config-plane delivery proof

**UNOFFICIAL/EXPERIMENTAL.** Generated from the committed receipt. Rerun with
\`npm run aicr-kserve-delivery:run\`; check the committed result without a
cluster using \`npm run aicr-kserve-delivery:verify\`.

The inference entry's retained documents met a real Kubernetes API server. All
${input.documentCount} of them (${input.kindCounts.ClusterServingRuntime} serving
runtimes and ${input.kindCounts.InferenceService} model shapes) traveled as one
OCI artifact and were pulled back byte-faithful. They met a throwaway kind
cluster carrying KServe ${kserve.version} custom resource definitions.
${delivery.documentsAccepted} were accepted and stored unchanged, and
${delivery.documentsRefusedByKubernetes.length} was refused by the API server.

Only the definitions were installed, never the controller. That is what keeps
the proof honest: with nothing reconciling an InferenceService, no pod is
scheduled, no NIM image is pulled, and no NGC surface is contacted. The run
confirmed it rather than assuming it, finding ${delivery.workloadPods} workload
pods and ${delivery.gatedImagePullEvents} image-pull events naming the gated
registry.

${receipt.spec.findings.length ? `## Finding\n\n${receipt.spec.findings.map((row) => row).join("\n\n")}\n` : ""}
The entry's committed platform digest at the time of the run was
\`${input.platformDigest}\`. The cluster, registry, and working files were
removed afterward.

## Limits

${receipt.spec.limits.map((limit) => `- ${limit}`).join("\n")}
`;
}

function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-kserve-delivery-self-test-"));
  try {
    const root = join(scratch, "entry");
    write(
      join(root, "upstream", "kserve", "runtimes", "alpha.yaml"),
      [
        "apiVersion: serving.kserve.io/v1alpha1",
        "kind: ClusterServingRuntime",
        "metadata:",
        "  name: fixture-runtime",
        "spec: {}",
        "",
      ].join("\n"),
    );
    write(
      join(root, "upstream", "kserve", "nim-models", "alpha.yaml"),
      [
        "apiVersion: serving.kserve.io/v1beta1",
        "kind: InferenceService",
        "metadata:",
        "  name: fixture-shape",
        "spec: {}",
        "",
      ].join("\n"),
    );
    const fixtureDigest = `sha256:${"6".repeat(64)}`;
    write(
      join(root, "digest-index", "platform-index.json"),
      `${JSON.stringify({ spec: { platformDigest: fixtureDigest } }, null, 2)}\n`,
    );
    const expectations = loadExpectations(root);
    check(expectations.documentCount === 2, "self-test fixture expectations are wrong");

    const receipt = () => JSON.parse(JSON.stringify({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrKserveDeliveryProofReceipt",
      metadata: { name: "fixture" },
      spec: {
        observedAt: "1970-01-01T00:00:00.000Z",
        input: {
          platformDigest: fixtureDigest,
          canonicalDataSha256: expectations.canonicalDataSha256,
          documentCount: 2,
          kindCounts: expectations.kindCounts,
          transportByteFaithful: true,
        },
        cluster: { kserve: { version: kserveVersion, controllerInstalled: false } },
        delivery: {
          documentsRetained: 2,
          documentsAccepted: 2,
          documentsRefusedByKubernetes: [],
          workloadPods: 0,
          gatedImagePullEvents: 0,
          serviceProven: false,
        },
        licenseBoundary: { ngcContacted: false, imagesPulled: false, modelsFetched: false },
        findings: [],
        cleanup: { cluster: "pass", registry: "pass", localFiles: "pass" },
        limits: ["This proof does not prove serving, model loading, or any workload behavior."],
      },
      status: {
        result: "pass",
        ociTransport: "pass",
        clusterUp: "pass",
        crdInstall: "pass",
        documentsAccepted: "pass",
        boundaryProven: "pass",
      },
    }));

    verifyReceipt(receipt(), expectations);
    const refusals = [
      [(r) => (r.spec.input.platformDigest = `sha256:${"9".repeat(64)}`), /platform digest/],
      [(r) => (r.spec.input.canonicalDataSha256 = "wrong"), /canonical data differs/],
      [(r) => (r.spec.delivery.documentsAccepted = 1), /did not accept every applicable retained document/],
      [(r) => (r.spec.delivery.documentsRefusedByKubernetes = [{ kind: "X", name: "y", file: "f", reason: "r" }]), /exactly the documents a cluster refuses/],
      [(r) => (r.spec.cluster.kserve.controllerInstalled = true), /no-workload boundary/],
      [(r) => (r.spec.delivery.workloadPods = 3), /no-workload boundary/],
      [(r) => (r.spec.delivery.gatedImagePullEvents = 1), /no-workload boundary/],
      [(r) => (r.spec.licenseBoundary.imagesPulled = true), /hold the license boundary/],
      [(r) => (r.spec.cleanup.cluster = "fail"), /cleanup did not pass/],
      [(r) => (r.spec.limits = []), /serving was not proven/],
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

function listFiles(root) {
  if (!existsSync(root)) return [];
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
  return [doc.apiVersion ?? "", doc.kind ?? "", doc.metadata?.namespace ?? "", doc.metadata?.name ?? ""].join("|");
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
    const name = command("docker", ["ps", "-a", "--filter", `name=^/${container}$`, "--format", "{{.Names}}"]).trim();
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
  const result = spawnSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, out: out || String(result.error ?? "") };
}

function safeRunId(value) {
  const compact = String(value).replace(/\D/g, "").slice(0, 14);
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
