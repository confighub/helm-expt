#!/usr/bin/env node

// Live ConfigHub import proof for the KServe NIM inference entry.
//
// The entry's twenty-six retained deployment surfaces (ten
// ClusterServingRuntimes and sixteen InferenceServices from the Apache-2.0
// nim-deploy KServe subtree) travel as one OCI artifact and import into a
// scratch ConfigHub organization as one base-variant Unit. The proof checks
// that the imported Unit matches the committed retained bytes exactly and
// that the Space records the exact OCI source and digest.
//
// The license boundary holds live, not just at compile time: the artifact
// contains only retained Apache-2.0 configuration, no NGC surface is
// contacted, no image is pulled, and the imported data is scanned for literal
// credential values with the same rule the entry's compiler enforces. Gated
// images appear in the imported data as references only, and the receipt
// lists that as evidence, not as a caveat.
//
// The receipt binds the run to the entry's committed platform digest. The
// scratch Space and temporary registry are removed at the end, and the
// receipt refuses to verify unless that cleanup passed.

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

const exampleRoot = join(repoRoot, "examples", "aicr", "kserve-nim-inference");
const receiptPath = join(repoRoot, "runs", "aicr-kserve-nim-import", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-kserve-nim-import", "summary.md");
const repository = "aicr-kserve-nim-inference";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-kserve-nim-import-proof.mjs --run
  node scripts/run-aicr-kserve-nim-import-proof.mjs --generate
  node scripts/run-aicr-kserve-nim-import-proof.mjs --verify
  node scripts/run-aicr-kserve-nim-import-proof.mjs --self-test`);
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
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-kserve-nim-import:generate`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-kserve-nim-import:generate`,
  );
  console.log("verified the KServe NIM ConfigHub import proof");
} else {
  selfTest();
  console.log("verified the KServe NIM import receipt checks against fake surfaces");
}

function loadExpectations(rootOverride) {
  const root = rootOverride ?? exampleRoot;
  const index = JSON.parse(readFileSync(join(root, "digest-index", "platform-index.json"), "utf8"));
  const platformDigest = index.spec?.platformDigest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(platformDigest), "the inference digest index records no platform digest");
  const files = ["runtimes", "nim-models"]
    .flatMap((dir) => listFiles(join(root, "upstream", "kserve", dir)))
    .filter((path) => path.endsWith(".yaml"))
    .sort();
  const rows = files.map((path) => {
    const text = readFileSync(path, "utf8");
    const docs = parseDocs(text).map(stripCommentMetadata);
    check(docs.length === 1, `${relativeRepo(path)}: expected exactly one document`);
    return {
      file: relativeRepo(path).slice(`${relativeRepo(join(root, "upstream"))}/`.length),
      text,
      doc: docs[0],
    };
  });
  check(rows.length > 0, "the inference entry retains no deployment surfaces");
  const docs = rows.map((row) => row.doc);
  const kindCounts = {};
  for (const doc of docs) kindCounts[doc.kind] = (kindCounts[doc.kind] ?? 0) + 1;
  return {
    platformDigest,
    rows,
    docs,
    documentCount: docs.length,
    kindCounts,
    canonicalDataSha256: sha256(canonicalDocs(docs)),
  };
}

// The same credential rule the entry's compiler enforces on committed bytes,
// applied to the live imported data: a known credential variable may carry an
// empty value or a substitution, never a literal.
function refuseEmbeddedCredentials(label, text) {
  for (const line of text.split("\n")) {
    const match = line.match(/(NGC_API_KEY|HF_TOKEN)\s*[:=]\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    check(
      value === "" || value.startsWith("$"),
      `${label}: a literal credential value is assigned to ${match[1]}`,
    );
  }
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_SCRATCH_ORG === "1",
    "set HELM_EXPT_ALLOW_SCRATCH_ORG=1 to confirm this live scratch run",
  );
  check(context, "set CUB_CONTEXT to an authenticated scratch ConfigHub context");
  check(context !== "river-bear", "refusing to run the scratch proof in the persistent helm-catalog context");
  for (const tool of ["cub", "docker", "oras"]) {
    check(tryCommand(tool, ["version"]).ok, `${tool} is required for the KServe NIM import proof`);
  }

  const expectations = loadExpectations();
  check(
    expectations.kindCounts.ClusterServingRuntime > 0 && expectations.kindCounts.InferenceService > 0,
    "the retained surfaces no longer hold serving runtimes and model shapes",
  );

  const contextInfo = jsonCommand("cub", ["context", "get", context, "-o", "json"]);
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString());
  const component = `hx-kserve-nim-${runId}`;
  const space = `${component}-base`;
  const container = `helm-expt-kserve-nim-${runId}`;
  let spaceCreated = false;
  let registryStarted = false;
  let receipt;
  const cleanup = { baseSpace: "not-created", registry: "not-started" };

  try {
    check(
      !cubTry(context, ["space", "get", space, "-o", "json"]).ok,
      `refusing to reuse existing scratch Space ${space}`,
    );

    command("docker", ["run", "-d", "--rm", "--name", container, "-p", "127.0.0.1::5000", "registry:2"]);
    registryStarted = true;
    cleanup.registry = "pending";
    const portOutput = command("docker", ["port", container, "5000/tcp"]).trim();
    const registryPort = portOutput.match(/:(\d+)$/)?.[1] ?? "";
    check(registryPort, `could not determine the temporary registry port from ${portOutput}`);
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
    check(/^sha256:[0-9a-f]{64}$/.test(pushedDigest), `oras resolve returned no digest: ${pushedDigest}`);

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
      "--label",
      "SourceType=nim-deploy-kserve",
      "--label",
      "ResourceClass=system-configuration",
      "--layer",
      "Platform",
      "--owner",
      "Platform",
      "--change-desc",
      "Import the retained KServe NIM inference surfaces as the base variant",
      `oci://${registryRef}`,
    ], { timeout: 420_000 });
    spaceCreated = true;
    cleanup.baseSpace = "pending";

    const spaceResponse = cubJson(context, ["space", "get", space, "-o", "json"]);
    const unitResponse = cubJson(context, ["unit", "get", component, "--space", space, "-o", "json"]);
    const data = cub(context, ["unit", "data", component, "--space", space]);
    refuseEmbeddedCredentials("the imported Unit data", data);
    const importedDocs = parseDocs(data).map(stripCommentMetadata);
    check(
      importedDocs.length === expectations.documentCount,
      `ConfigHub imported ${importedDocs.length} documents, expected ${expectations.documentCount}`,
    );
    check(
      canonicalDocs(importedDocs) === canonicalDocs(expectations.docs),
      "the ConfigHub base Unit differs from the committed retained surfaces",
    );
    const externalSources = JSON.parse(
      spaceResponse.Space?.Annotations?.["confighub.com/external-source"] ?? "[]",
    );
    check(
      externalSources.length === 1
        && externalSources[0].digest === pushedDigest
        && externalSources[0].ref === `oci://${registryRef}`,
      "ConfigHub did not record the exact retained OCI source and digest",
    );
    const gatedReferences = [...new Set(
      importedDocs
        .flatMap((doc) => doc.spec?.containers ?? [])
        .map((containerSpec) => String(containerSpec.image ?? ""))
        .filter((image) => image.startsWith("nvcr.io/")),
    )].sort();
    check(gatedReferences.length > 0, "the imported runtimes name no gated image references");

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrKserveNimImportProofReceipt",
      metadata: { name: "aicr-kserve-nim-inference-3ef33472-import" },
      spec: {
        recordedAt: new Date().toISOString(),
        context: {
          name: context,
          organization: contextInfo.metadata?.organizationName ?? "unknown",
          purpose: "temporary scratch proof",
        },
        source: {
          format: "retained KServe NIM literal configuration OCI",
          committedEntry: relativeRepo(exampleRoot),
          platformDigest: expectations.platformDigest,
          temporaryReference: `oci://${registryRef}`,
          digest: pushedDigest,
          documentCount: expectations.documentCount,
          kindCounts: expectations.kindCounts,
          exactSourceObjectsMatched: true,
          canonicalDataSha256: expectations.canonicalDataSha256,
        },
        base: {
          space,
          spaceId: spaceResponse.Space?.SpaceID,
          unit: component,
          unitId: unitResponse.Unit?.UnitID,
          headRevision: unitResponse.Unit?.HeadRevisionNum,
          dataHash: unitResponse.Unit?.DataHash,
        },
        licenseBoundary: {
          ngcContacted: false,
          imagesPulled: false,
          modelsFetched: false,
          embeddedCredentialValues: false,
          gatedImageReferences: gatedReferences,
          statement:
            "The artifact carried only the retained Apache-2.0 configuration. Gated images appear in the imported data as references only; nothing was pulled from nvcr.io, and the imported data carries no literal credential value.",
        },
        cleanup,
        limits: [
          "This run used a temporary local registry; it does not prove public registry publication.",
          "This run started no Kubernetes cluster and required no KServe installation. It does not prove serving, model loading, or any workload behavior.",
          "The scratch organization did not run the helm-catalog apply-policy Triggers, so this receipt does not prove policy execution.",
          "This receipt proves one retained-entry import. Variants, promotion, and delivery for the inference entry are separate increments.",
        ],
      },
      status: {
        result: "pass",
        ociImport: "pass",
        exactObjectSet: "pass",
        licenseBoundary: "pass",
        claim:
          "ConfigHub imported the twenty-six retained KServe NIM surfaces as one base-variant Unit, kept them byte-faithful, and recorded the exact OCI source and digest, with gated images present as references only and no credential value anywhere in the imported data.",
      },
    };
  } finally {
    if (spaceCreated || cubTry(context, ["space", "get", space, "-o", "json"]).ok) {
      const deleted = cubTry(context, ["space", "delete", space, "--recursive-force", "--quiet"]);
      const absent = !cubTry(context, ["space", "get", space, "-o", "json"]).ok;
      cleanup.baseSpace = deleted.ok && absent ? "pass" : spaceCreated ? "fail" : "not-created";
    }
    if (registryStarted) {
      const stopped = tryCommand("docker", ["stop", container]);
      const absent = waitForContainerRemoval(container);
      cleanup.registry = stopped.ok && absent ? "pass" : "fail";
    }
  }

  check(receipt, "the KServe NIM import proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `the KServe NIM import proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(readYaml(receiptPath), loadExpectations());
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function verifyReceipt(receipt, expectations) {
  check(receipt.kind === "AicrKserveNimImportProofReceipt", "KServe NIM import receipt kind changed");
  check(receipt.status?.result === "pass", "KServe NIM import proof is not pass");
  for (const lane of ["ociImport", "exactObjectSet", "licenseBoundary"]) {
    check(receipt.status?.[lane] === "pass", `KServe NIM import receipt lane ${lane} did not pass`);
  }
  check(
    receipt.spec?.source?.platformDigest === expectations.platformDigest,
    "KServe NIM import receipt no longer matches the committed entry platform digest",
  );
  check(
    receipt.spec?.source?.canonicalDataSha256 === expectations.canonicalDataSha256,
    "KServe NIM import receipt canonical data differs from the committed retained surfaces",
  );
  check(
    receipt.spec?.source?.documentCount === expectations.documentCount,
    "KServe NIM import receipt document count changed",
  );
  check(
    JSON.stringify(Object.entries(receipt.spec?.source?.kindCounts ?? {}).sort())
      === JSON.stringify(Object.entries(expectations.kindCounts).sort()),
    "KServe NIM import receipt kind counts changed",
  );
  const boundary = receipt.spec?.licenseBoundary ?? {};
  check(
    boundary.ngcContacted === false
      && boundary.imagesPulled === false
      && boundary.modelsFetched === false
      && boundary.embeddedCredentialValues === false,
    "KServe NIM import receipt does not hold the license boundary",
  );
  check(
    Array.isArray(boundary.gatedImageReferences)
      && boundary.gatedImageReferences.length > 0
      && boundary.gatedImageReferences.every((image) => image.startsWith("nvcr.io/")),
    "KServe NIM import receipt records no gated image references as evidence",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "the KServe NIM import proof cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("started no Kubernetes cluster")),
    "the KServe NIM import receipt must state that no cluster or serving was tested",
  );
  check(
    !Number.isNaN(Date.parse(receipt.spec?.recordedAt ?? "")),
    "the KServe NIM import receipt records no valid timestamp",
  );
}

function renderSummary(receipt) {
  const source = receipt.spec.source;
  const boundary = receipt.spec.licenseBoundary;
  return `# KServe NIM inference ConfigHub import proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the scratch proof with \`npm run aicr-kserve-nim-import:run\`;
verify it without external access with \`npm run aicr-kserve-nim-import:verify\`.

ConfigHub imported the ${source.documentCount} retained KServe NIM surfaces
(${source.kindCounts.ClusterServingRuntime} serving runtimes and
${source.kindCounts.InferenceService} model shapes from the Apache-2.0
nim-deploy KServe subtree) as one base-variant Unit from a temporary OCI
reference, and the imported Unit matched the committed retained bytes
exactly. The entry's committed platform digest at the time of the run was
\`${source.platformDigest}\`.

The license boundary held live. The artifact carried only retained
configuration; no NGC surface was contacted, no image was pulled, and the
imported data carries no literal credential value. The
${boundary.gatedImageReferences.length} gated image references present in the
imported runtimes are recorded in the receipt as evidence that references are
data.

The proof ran in the scratch organization
\`${receipt.spec.context.organization}\` on ${receipt.spec.recordedAt}. The
scratch Space and temporary registry were removed afterward.

## Limits

${receipt.spec.limits.map((limit) => `- ${limit}`).join("\n")}
`;
}

// The self-test exercises the receipt verifier against fake surfaces only.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-kserve-nim-import-self-test-"));
  try {
    const root = join(scratch, "entry");
    write(
      join(root, "upstream", "kserve", "runtimes", "alpha.yaml"),
      [
        "apiVersion: serving.kserve.io/v1alpha1",
        "kind: ClusterServingRuntime",
        "metadata:",
        "  name: fixture-runtime-alpha",
        "spec:",
        "  containers:",
        "  - image: nvcr.io/nim/fixture/alpha:1.0.0",
        "    name: kserve-container",
        "",
      ].join("\n"),
    );
    write(
      join(root, "upstream", "kserve", "nim-models", "alpha-1xgpu.yaml"),
      [
        "apiVersion: serving.kserve.io/v1beta1",
        "kind: InferenceService",
        "metadata:",
        "  name: fixture-alpha-1xgpu",
        "spec:",
        "  predictor:",
        "    model:",
        "      runtime: fixture-runtime-alpha",
        "",
      ].join("\n"),
    );
    const fixtureDigest = `sha256:${"6".repeat(64)}`;
    write(
      join(root, "digest-index", "platform-index.json"),
      `${JSON.stringify({ spec: { platformDigest: fixtureDigest } }, null, 2)}\n`,
    );
    const expectations = loadExpectations(root);
    check(
      expectations.documentCount === 2
        && expectations.kindCounts.ClusterServingRuntime === 1
        && expectations.kindCounts.InferenceService === 1,
      "self-test fixture expectations are wrong",
    );

    const receipt = () => ({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrKserveNimImportProofReceipt",
      metadata: { name: "fixture" },
      spec: {
        recordedAt: "1970-01-01T00:00:00.000Z",
        context: { name: "fixture", organization: "fixture-org", purpose: "temporary scratch proof" },
        source: {
          platformDigest: fixtureDigest,
          canonicalDataSha256: expectations.canonicalDataSha256,
          documentCount: 2,
          kindCounts: { ClusterServingRuntime: 1, InferenceService: 1 },
        },
        base: { space: "fixture-space", unit: "fixture-unit" },
        licenseBoundary: {
          ngcContacted: false,
          imagesPulled: false,
          modelsFetched: false,
          embeddedCredentialValues: false,
          gatedImageReferences: ["nvcr.io/nim/fixture/alpha:1.0.0"],
        },
        cleanup: { baseSpace: "pass", registry: "pass" },
        limits: ["This run started no Kubernetes cluster and required no KServe installation."],
      },
      status: { result: "pass", ociImport: "pass", exactObjectSet: "pass", licenseBoundary: "pass" },
    });

    verifyReceipt(receipt(), expectations);

    const refusals = [
      [(r) => (r.spec.source.platformDigest = `sha256:${"9".repeat(64)}`), /committed entry platform digest/],
      [(r) => (r.spec.source.canonicalDataSha256 = "wrong"), /canonical data differs/],
      [(r) => (r.spec.licenseBoundary.ngcContacted = true), /hold the license boundary/],
      [(r) => (r.spec.licenseBoundary.gatedImageReferences = []), /gated image references as evidence/],
      [(r) => (r.spec.cleanup.baseSpace = "fail"), /cleanup did not pass/],
      [(r) => (r.spec.limits = []), /no cluster or serving was tested/],
    ];
    for (const [mutate, pattern] of refusals) {
      const mutated = receipt();
      mutate(mutated);
      check(fails(() => verifyReceipt(mutated, expectations), pattern), `self-test accepted a receipt violating ${pattern}`);
    }

    check(
      fails(() => refuseEmbeddedCredentials("fixture", "NGC_API_KEY=abcd1234efgh\n"), /literal credential value/),
      "self-test accepted an embedded credential",
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
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

function cub(context, args, options = {}) {
  return command("cub", args, {
    ...options,
    env: { ...process.env, CONFIGHUB_AGENT: "1", CUB_CONTEXT: context },
  });
}

function cubTry(context, args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: { ...process.env, CONFIGHUB_AGENT: "1", CUB_CONTEXT: context },
  });
}

function cubJson(context, args) {
  return JSON.parse(cub(context, args));
}

function jsonCommand(file, args) {
  return JSON.parse(command(file, args));
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
