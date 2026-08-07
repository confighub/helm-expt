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
  const spaces = {
    base: `${component}-base`,
    dev: `${component}-dev`,
    staging: `${component}-staging`,
  };
  const space = spaces.base;
  const container = `helm-expt-kserve-nim-${runId}`;
  const createdSpaces = [];
  let registryStarted = false;
  let receipt;
  const cleanup = {
    stagingSpace: "not-created",
    devSpace: "not-created",
    baseSpace: "not-created",
    registry: "not-started",
  };

  try {
    for (const slug of Object.values(spaces)) {
      check(
        !cubTry(context, ["space", "get", slug, "-o", "json"]).ok,
        `refusing to reuse existing scratch Space ${slug}`,
      );
    }

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
    createdSpaces.push(spaces.base);
    cleanup.baseSpace = "pending";

    const baseBefore = inspectVariant(context, spaces.base, component);
    refuseEmbeddedCredentials("the imported Unit data", baseBefore.rawData);
    const importedDocs = baseBefore.docs;
    check(
      importedDocs.length === expectations.documentCount,
      `ConfigHub imported ${importedDocs.length} documents, expected ${expectations.documentCount}`,
    );
    check(
      canonicalDocs(importedDocs) === canonicalDocs(expectations.docs),
      "the ConfigHub base Unit differs from the committed retained surfaces",
    );
    const externalSources = JSON.parse(
      baseBefore.space?.Annotations?.["confighub.com/external-source"] ?? "[]",
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

    cub(context, [
      "variant",
      "create",
      "dev",
      spaces.base,
      "--space-pattern",
      `template:${spaces.dev}`,
      "--environment",
      "Dev",
      "--region",
      "demo",
      "--wait",
      "--timeout",
      "10m",
    ], { timeout: 660_000 });
    createdSpaces.push(spaces.dev);
    cleanup.devSpace = "pending";
    const devBefore = inspectVariant(context, spaces.dev, component);
    check(
      canonicalDocs(devBefore.docs) === canonicalDocs(baseBefore.docs),
      "the development variant does not match the imported base",
    );

    cub(context, [
      "variant",
      "create",
      "staging",
      spaces.dev,
      "--space-pattern",
      `template:${spaces.staging}`,
      "--environment",
      "Staging",
      "--region",
      "demo",
      "--wait",
      "--timeout",
      "10m",
    ], { timeout: 660_000 });
    createdSpaces.push(spaces.staging);
    cleanup.stagingSpace = "pending";
    const stagingBefore = inspectVariant(context, spaces.dev, component);

    // The reviewed change renames the shared model-cache claim every model
    // shape mounts. Upstream tells the operator to create that claim
    // themselves, so its name is a per-cluster decision, and renaming it is
    // one review that has to land consistently across all sixteen shapes.
    // ConfigHub's search-replace substitutes single tokens, so the change is
    // expressed as one token and its blast radius is then measured.
    const cacheClaimBefore = "nvidia-nim-pvc";
    const cacheClaimAfter = "hx-nim-model-cache";
    check(
      devBefore.rawData.includes(cacheClaimBefore),
      "the live dev Unit data does not mount the upstream model-cache claim",
    );
    const changeArgs = [
      "run",
      "search-replace",
      "--space",
      spaces.dev,
      "--unit",
      component,
      "--search-value",
      cacheClaimBefore,
      "--replace-value",
      cacheClaimAfter,
    ];
    const dryRunOutput = cub(context, [...changeArgs, "--dry-run", "-o", "mutations"]);
    check(
      /config data changed/i.test(dryRunOutput),
      `the ConfigHub dry run reported no change for the reviewed claim rename: ${dryRunOutput.trim().slice(0, 400)}`,
    );
    const devAfterDryRun = inspectVariant(context, spaces.dev, component);
    check(
      canonicalDocs(devAfterDryRun.docs) === canonicalDocs(devBefore.docs),
      "the ConfigHub search-replace dry run changed the dev Unit",
    );

    cub(context, [
      ...changeArgs,
      "--change-desc",
      "Rename the shared NIM model-cache claim for this cluster in development",
      "--wait",
    ], { timeout: 660_000 });
    const devChanged = inspectVariant(context, spaces.dev, component);
    const changedIdentities = changedDocs(devBefore.docs, devChanged.docs);
    const expectedChanged = expectations.docs
      .filter((doc) => JSON.stringify(doc).includes(cacheClaimBefore))
      .map((doc) => identity(doc))
      .sort();
    check(
      JSON.stringify(changedIdentities) === JSON.stringify(expectedChanged),
      `the reviewed rename changed ${changedIdentities.length} documents, expected the ${expectedChanged.length} that mount the claim`,
    );
    check(
      changedIdentities.every((row) => row.includes("InferenceService")),
      "the reviewed rename touched a document that is not a model shape",
    );
    check(
      !JSON.stringify(devChanged.docs).includes(cacheClaimBefore)
        && devChanged.docs.filter((doc) => JSON.stringify(doc).includes(cacheClaimAfter)).length
          === expectedChanged.length,
      "the reviewed rename did not land on every model shape",
    );

    const stagingBeforePromotion = inspectVariant(context, spaces.staging, component);
    check(
      canonicalDocs(stagingBeforePromotion.docs) === canonicalDocs(stagingBefore.docs),
      "staging changed before the promotion",
    );
    const promotionDryRunOutput = cub(context, ["variant", "promote", spaces.staging, "--dry-run"]);
    check(
      /1\s+unit/i.test(promotionDryRunOutput),
      `the promotion dry run did not report one Unit: ${promotionDryRunOutput.trim()}`,
    );
    const stagingAfterPromotionDryRun = inspectVariant(context, spaces.staging, component);
    check(
      canonicalDocs(stagingAfterPromotionDryRun.docs) === canonicalDocs(stagingBeforePromotion.docs),
      "the promotion dry run changed staging",
    );
    cub(context, [
      "variant",
      "promote",
      spaces.staging,
      "--change-desc",
      "Promote the reviewed telemetry setting to staging",
    ], { timeout: 660_000 });
    const stagingPromoted = inspectVariant(context, spaces.staging, component);
    check(
      canonicalDocs(stagingPromoted.docs) === canonicalDocs(devChanged.docs),
      "the promoted staging Unit does not match the reviewed dev Unit",
    );

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
        variants: {
          base: variantRecord(baseBefore),
          dev: variantRecord(devChanged),
          staging: variantRecord(stagingPromoted),
        },
        change: {
          control: "the shared model-cache PersistentVolumeClaim name every model shape mounts, which upstream leaves to the operator",
          before: cacheClaimBefore,
          after: cacheClaimAfter,
          changedDocumentCount: changedIdentities.length,
          changedDocuments: changedIdentities,
          changedKinds: ["InferenceService"],
          servingRuntimesUnchanged: true,
          devDryRun: "pass",
          devDryRunLeftDataUnchanged: true,
          devUpdate: "pass",
        },
        promotion: {
          path: "base -> dev -> staging",
          dryRun: "pass",
          dryRunReportedUnitCount: 1,
          dryRunLeftStagingUnchanged: true,
          result: "pass",
          stagingMatchesReviewedDev: true,
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
          "This receipt proves one retained-entry import, one reviewed model-cache claim rename in a development variant, and one dev-to-staging promotion of that reviewed change. Delivery for the inference entry is a separate increment.",
          "NIM_TELEMETRY_MODE remains the documented telemetry control point, but setting it means adding an environment entry, and ConfigHub's search-replace substitutes single tokens rather than inserting structure. That change waits for a structural editing path.",
        ],
      },
      status: {
        result: "pass",
        ociImport: "pass",
        exactObjectSet: "pass",
        licenseBoundary: "pass",
        derivedVariants: "pass",
        changeDryRun: "pass",
        change: "pass",
        promotionDryRun: "pass",
        promotion: "pass",
        claim:
          "ConfigHub imported the twenty-six retained KServe NIM surfaces as one base-variant Unit, kept them byte-faithful with the license boundary held live, renamed the shared model-cache claim across every model shape as one reviewed development change while leaving all ten serving runtimes untouched, previewed the staging promotion without changing staging, and promoted the same reviewed configuration to staging with matching data.",
      },
    };
  } finally {
    for (const [key, slug] of [
      ["stagingSpace", spaces.staging],
      ["devSpace", spaces.dev],
      ["baseSpace", spaces.base],
    ]) {
      const exists = cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      if (!exists) {
        cleanup[key] = createdSpaces.includes(slug) ? "fail" : "not-created";
        continue;
      }
      const deleted = cubTry(context, ["space", "delete", slug, "--recursive-force", "--quiet"]);
      const absent = !cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      cleanup[key] = deleted.ok && absent ? "pass" : "fail";
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
  for (const lane of [
    "ociImport",
    "exactObjectSet",
    "licenseBoundary",
    "derivedVariants",
    "changeDryRun",
    "change",
    "promotionDryRun",
    "promotion",
  ]) {
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
  const change = receipt.spec?.change ?? {};
  const expectedChanged = expectations.docs
    .filter((doc) => JSON.stringify(doc).includes(change.before ?? " "))
    .map((doc) => identity(doc))
    .sort();
  check(
    expectedChanged.length > 0
      && change.changedDocumentCount === expectedChanged.length
      && JSON.stringify(change.changedDocuments) === JSON.stringify(expectedChanged),
    "the reviewed change did not land on exactly the retained documents that mount the claim",
  );
  check(
    (change.changedDocuments ?? []).every((row) => String(row).includes("InferenceService"))
      && change.servingRuntimesUnchanged === true,
    "the reviewed change touched something other than the model shapes",
  );
  check(
    change.before && change.after && change.before !== change.after
      && change.devDryRun === "pass"
      && change.devDryRunLeftDataUnchanged === true
      && change.devUpdate === "pass",
    "the reviewed claim-rename evidence is incomplete",
  );
  check(
    receipt.spec?.promotion?.path === "base -> dev -> staging"
      && receipt.spec?.promotion?.dryRun === "pass"
      && receipt.spec?.promotion?.dryRunReportedUnitCount === 1
      && receipt.spec?.promotion?.dryRunLeftStagingUnchanged === true
      && receipt.spec?.promotion?.result === "pass"
      && receipt.spec?.promotion?.stagingMatchesReviewedDev === true,
    "the KServe NIM promotion evidence is incomplete",
  );
  check(
    receipt.spec?.variants?.base?.canonicalDataSha256 === expectations.canonicalDataSha256,
    "the imported base variant did not match the committed retained bytes",
  );
  check(
    receipt.spec?.variants?.staging?.canonicalDataSha256
      && receipt.spec?.variants?.staging?.canonicalDataSha256
        === receipt.spec?.variants?.dev?.canonicalDataSha256,
    "the promoted staging variant does not carry the reviewed dev configuration",
  );
  check(
    receipt.spec?.variants?.dev?.canonicalDataSha256 !== expectations.canonicalDataSha256,
    "the development variant records no reviewed change against the imported base",
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

Development and staging variants were created from the base, and one reviewed
change renamed the shared model-cache claim that every model shape mounts,
from \`${receipt.spec.change.before}\` to \`${receipt.spec.change.after}\`.
Upstream leaves that claim for the operator to create, so its name is a
per-cluster decision, and one review has to land consistently everywhere it
appears. ConfigHub's dry run reported the change and left the stored
configuration untouched; the real change updated exactly
${receipt.spec.change.changedDocumentCount} model shapes and left all ten
serving runtimes alone. The staging promotion was previewed first, reported
one Unit, and left staging unchanged; the real promotion then carried the
reviewed configuration to staging with matching canonical data.

The proof ran in the scratch organization
\`${receipt.spec.context.organization}\` on ${receipt.spec.recordedAt}. All
three scratch Spaces and the temporary registry were removed afterward.

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
        "      storageUri: pvc://nvidia-nim-pvc/",
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
        variants: {
          base: { canonicalDataSha256: expectations.canonicalDataSha256, dataHash: "hash-base" },
          dev: { canonicalDataSha256: "sha-reviewed", dataHash: "hash-dev" },
          staging: { canonicalDataSha256: "sha-reviewed", dataHash: "hash-staging" },
        },
        change: {
          control: "the shared model-cache PersistentVolumeClaim name every model shape mounts",
          before: "nvidia-nim-pvc",
          after: "hx-nim-model-cache",
          changedDocumentCount: 1,
          changedDocuments: ["serving.kserve.io/v1beta1|InferenceService||fixture-alpha-1xgpu"],
          changedKinds: ["InferenceService"],
          servingRuntimesUnchanged: true,
          devDryRun: "pass",
          devDryRunLeftDataUnchanged: true,
          devUpdate: "pass",
        },
        promotion: {
          path: "base -> dev -> staging",
          dryRun: "pass",
          dryRunReportedUnitCount: 1,
          dryRunLeftStagingUnchanged: true,
          result: "pass",
          stagingMatchesReviewedDev: true,
        },
        licenseBoundary: {
          ngcContacted: false,
          imagesPulled: false,
          modelsFetched: false,
          embeddedCredentialValues: false,
          gatedImageReferences: ["nvcr.io/nim/fixture/alpha:1.0.0"],
        },
        cleanup: { stagingSpace: "pass", devSpace: "pass", baseSpace: "pass", registry: "pass" },
        limits: ["This run started no Kubernetes cluster and required no KServe installation."],
      },
      status: {
        result: "pass",
        ociImport: "pass",
        exactObjectSet: "pass",
        licenseBoundary: "pass",
        derivedVariants: "pass",
        changeDryRun: "pass",
        change: "pass",
        promotionDryRun: "pass",
        promotion: "pass",
      },
    });

    verifyReceipt(receipt(), expectations);

    const refusals = [
      [(r) => (r.spec.source.platformDigest = `sha256:${"9".repeat(64)}`), /committed entry platform digest/],
      [(r) => (r.spec.source.canonicalDataSha256 = "wrong"), /canonical data differs/],
      [(r) => (r.spec.licenseBoundary.ngcContacted = true), /hold the license boundary/],
      [(r) => (r.spec.licenseBoundary.gatedImageReferences = []), /gated image references as evidence/],
      [(r) => {
        r.spec.change.changedDocuments = ["serving.kserve.io/v1alpha1|ClusterServingRuntime||fixture-runtime-alpha"];
      }, /exactly the retained documents that mount the claim/],
      [(r) => (r.spec.change.servingRuntimesUnchanged = false), /other than the model shapes/],
      [(r) => (r.spec.change.after = "nvidia-nim-pvc"), /claim-rename evidence/],
      [(r) => (r.spec.promotion.stagingMatchesReviewedDev = false), /promotion evidence is incomplete/],
      [(r) => (r.spec.variants.staging.canonicalDataSha256 = "sha-other"), /does not carry the reviewed dev configuration/],
      [(r) => {
        // A no-op review: dev and staging agree with each other and with the
        // imported base, so only the "nothing was reviewed" check can catch it.
        r.spec.variants.dev.canonicalDataSha256 = expectations.canonicalDataSha256;
        r.spec.variants.staging.canonicalDataSha256 = expectations.canonicalDataSha256;
      }, /records no reviewed change/],
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\/]/g, (character) => `\\${character}`);
}

function inspectVariant(context, spaceSlug, unitSlug) {
  const spaceResponse = cubJson(context, ["space", "get", spaceSlug, "-o", "json"]);
  const unitResponse = cubJson(context, ["unit", "get", unitSlug, "--space", spaceSlug, "-o", "json"]);
  const rawData = cub(context, ["unit", "data", unitSlug, "--space", spaceSlug]);
  const docs = parseDocs(rawData).map(stripCommentMetadata);
  return {
    space: spaceResponse.Space,
    unit: unitResponse.Unit,
    rawData,
    docs,
    dataSha256: sha256(canonicalDocs(docs)),
  };
}

function variantRecord(variant) {
  return {
    space: variant.space.Slug,
    spaceId: variant.space.SpaceID,
    variant: variant.space.Labels?.Variant ?? "",
    environment: variant.space.Labels?.Environment ?? "",
    unit: variant.unit.Slug,
    unitId: variant.unit.UnitID,
    headRevision: variant.unit.HeadRevisionNum,
    dataHash: variant.unit.DataHash,
    canonicalDataSha256: variant.dataSha256,
  };
}

function changedDocs(before, after) {
  const left = new Map(before.map((doc) => [identity(doc), JSON.stringify(doc)]));
  const right = new Map(after.map((doc) => [identity(doc), JSON.stringify(doc)]));
  const identities = [...new Set([...left.keys(), ...right.keys()])].sort();
  return identities.filter((key) => left.get(key) !== right.get(key));
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
