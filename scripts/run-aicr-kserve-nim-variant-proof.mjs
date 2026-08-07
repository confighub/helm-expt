#!/usr/bin/env node

// Live config-plane proof for the KServe NIM inference entry: import the
// retained deployment surfaces as a ConfigHub base variant, create development
// and staging variants, apply one reviewed autoscaling decision across every
// model shape with a dry-run preview first, and promote that reviewed change
// to staging.
//
// The change is a decision an inference platform team makes before anything
// runs: development model shapes should read from their own model cache volume
// rather than the shared one, so `storageUri` moves to a development-scoped
// persistent volume claim on every InferenceService. One reviewed change covers
// all sixteen model shapes at once, and the ten serving runtimes must come
// through untouched. That asymmetry is the point, and the receipt checks it
// exactly rather than asserting it.
//
// ConfigHub's search-replace matches inside stored string values, not raw YAML
// lines, so the searched value is the model cache reference itself.
//
// The license boundary holds live, exactly as it does in the import proof: the
// artifact carries only the retained Apache-2.0 configuration, no NGC surface
// is contacted, no image is pulled, and every variant's data is scanned for
// literal credential values. Gated images appear as references only.
//
// Boundary: config-plane only. The run starts no Kubernetes cluster, installs
// no KServe, and claims no serving behavior. Scratch Spaces and the temporary
// registry are removed at the end, and the receipt refuses to verify unless
// that cleanup passed.

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
const receiptPath = join(repoRoot, "runs", "aicr-kserve-nim-variant", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-kserve-nim-variant", "summary.md");
const repository = "aicr-kserve-nim-inference";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const MODEL_KIND = "InferenceService";
const RUNTIME_KIND = "ClusterServingRuntime";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-kserve-nim-variant-proof.mjs --run
  node scripts/run-aicr-kserve-nim-variant-proof.mjs --generate
  node scripts/run-aicr-kserve-nim-variant-proof.mjs --verify
  node scripts/run-aicr-kserve-nim-variant-proof.mjs --self-test`);
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
  check(
    existsSync(summaryPath),
    `${relativeRepo(summaryPath)} is missing; run npm run aicr-kserve-nim-variant:generate`,
  );
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-kserve-nim-variant:generate`,
  );
  console.log("verified the KServe NIM ConfigHub variant proof");
} else {
  selfTest();
  console.log("verified the KServe NIM variant receipt checks against fake surfaces");
}

// loadExpectations reads the committed retained surfaces the receipt must
// match. A root override exists only so the self-test can run against fake
// surfaces.
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
    return { file: relativeRepo(path).slice(`${relativeRepo(join(root, "upstream"))}/`.length), doc: docs[0] };
  });
  check(rows.length > 0, "the inference entry retains no deployment surfaces");
  const docs = rows.map((row) => row.doc);
  const kindCounts = countKinds(docs);
  const modelIdentities = docs.filter((doc) => doc.kind === MODEL_KIND).map(identity).sort();
  const runtimeIdentities = docs.filter((doc) => doc.kind === RUNTIME_KIND).map(identity).sort();
  return {
    platformDigest,
    rows,
    docs,
    documentCount: docs.length,
    kindCounts,
    modelIdentities,
    runtimeIdentities,
    canonicalDataSha256: sha256(canonicalDocs(docs)),
  };
}

// The same credential rule the entry's compiler enforces on committed bytes,
// applied to every variant's live data: a known credential variable may carry
// an empty value or a substitution, never a literal.
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
    check(tryCommand(tool, ["version"]).ok, `${tool} is required for the KServe NIM variant proof`);
  }

  const expectations = loadExpectations();
  check(
    expectations.kindCounts[RUNTIME_KIND] > 0 && expectations.kindCounts[MODEL_KIND] > 0,
    "the retained surfaces no longer hold serving runtimes and model shapes",
  );

  const contextInfo = jsonCommand("cub", ["context", "get", context, "-o", "json"]);
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString());
  const component = `hx-nim-variant-${runId}`;
  const spaces = { base: `${component}-base`, dev: `${component}-dev`, staging: `${component}-staging` };
  const container = `helm-expt-nim-variant-${runId}`;
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
      spaces.base,
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
    refuseEmbeddedCredentials("the imported base Unit data", baseBefore.data);
    verifySurfaceSet(baseBefore.docs, expectations, "base");
    check(
      canonicalDocs(baseBefore.docs) === canonicalDocs(expectations.docs),
      "the ConfigHub base Unit differs from the committed retained surfaces",
    );
    const externalSources = JSON.parse(
      baseBefore.space.Annotations?.["confighub.com/external-source"] ?? "[]",
    );
    check(
      externalSources.length === 1
        && externalSources[0].digest === pushedDigest
        && externalSources[0].ref === `oci://${registryRef}`,
      "ConfigHub did not record the exact retained OCI source and digest",
    );
    const gatedReferences = gatedImageReferences(baseBefore.docs);
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
      `the development variant does not match the uploaded base (${changedDocs(baseBefore.docs, devBefore.docs).join(", ") || "no changed identity"})`,
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
    const stagingBefore = inspectVariant(context, spaces.staging, component);
    check(
      canonicalDocs(stagingBefore.docs) === canonicalDocs(devBefore.docs),
      "the staging variant does not match the development variant it was created from",
    );

    // The searched value is read from the live data rather than the committed
    // file, so the change cannot depend on how ConfigHub reserialized the YAML.
    // ConfigHub's search-replace matches inside stored string values, which is
    // why the reference itself is searched rather than a whole YAML line.
    const storageUris = [...new Set(
      devBefore.docs
        .filter((doc) => doc.kind === MODEL_KIND)
        .map((doc) => String(doc.spec?.predictor?.model?.storageUri ?? "")),
    )];
    check(
      storageUris.length === 1 && storageUris[0].startsWith("pvc://"),
      `expected one shared model cache reference in the development data, found ${storageUris.join(", ") || "none"}`,
    );
    const searchValue = storageUris[0];
    const replaceValue = searchValue.replace(/\/?$/, "").replace(/$/, "-dev/");
    check(
      devBefore.docs.filter((doc) => JSON.stringify(doc).includes(searchValue)).length
        === expectations.modelIdentities.length,
      "the shared model cache reference does not appear in exactly the model shapes",
    );

    const changeArgs = [
      "run",
      "search-replace",
      "--space",
      spaces.dev,
      "--unit",
      component,
      "--search-value",
      searchValue,
      "--replace-value",
      replaceValue,
    ];
    const dryRunOutput = cub(context, [...changeArgs, "--dry-run", "-o", "mutations"]);
    if (process.env.HELM_EXPT_PROOF_DEBUG === "1") {
      console.error(`--- dry run output ---\n${dryRunOutput}\n--- end dry run output ---`);
    }
    check(
      !/No new changes/i.test(dryRunOutput) && /Mutations for unit/i.test(dryRunOutput),
      `ConfigHub dry run reported no mutation for the model cache reference: ${dryRunOutput.trim()}`,
    );
    // The preview names each affected resource and the exact field it would
    // update, so the receipt records that it covered every model shape rather
    // than merely that it printed something.
    const previewedShapes = expectations.modelIdentities.filter((modelIdentity) => {
      const name = modelIdentity.split("|").pop();
      return dryRunOutput.includes(`InferenceService /${name}`);
    });
    check(
      previewedShapes.length === expectations.modelIdentities.length,
      `the dry run previewed ${previewedShapes.length} of ${expectations.modelIdentities.length} model shapes`,
    );
    check(
      dryRunOutput.includes("spec.predictor.model.storageUri"),
      "the dry run did not name the model cache field it would update",
    );
    const devAfterDryRun = inspectVariant(context, spaces.dev, component);
    check(
      canonicalDocs(devAfterDryRun.docs) === canonicalDocs(devBefore.docs),
      "ConfigHub search-replace dry run changed the dev Unit",
    );

    cub(context, [
      ...changeArgs,
      "--change-desc",
      "Point development model shapes at their own model cache volume",
      "--wait",
    ], { timeout: 660_000 });
    const devChanged = inspectVariant(context, spaces.dev, component);
    refuseEmbeddedCredentials("the changed development Unit data", devChanged.data);
    const changedIdentities = changedDocs(devBefore.docs, devChanged.docs);
    check(
      JSON.stringify(changedIdentities) === JSON.stringify(expectations.modelIdentities),
      `the reviewed change must touch every model shape and nothing else; it touched ${changedIdentities.length} of ${expectations.modelIdentities.length}`,
    );
    assertStorageUri(devChanged.docs, replaceValue, "dev");
    check(
      canonicalKinds(devChanged.docs, RUNTIME_KIND) === canonicalKinds(devBefore.docs, RUNTIME_KIND),
      "the reviewed change altered a serving runtime",
    );
    check(
      JSON.stringify(gatedImageReferences(devChanged.docs)) === JSON.stringify(gatedReferences),
      "the reviewed change altered a gated image reference",
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
      "Promote the reviewed scale-to-zero decision to staging",
    ], { timeout: 660_000 });
    const stagingPromoted = inspectVariant(context, spaces.staging, component);
    assertStorageUri(stagingPromoted.docs, replaceValue, "staging");
    check(
      canonicalDocs(stagingPromoted.docs) === canonicalDocs(devChanged.docs),
      "the promoted staging Unit does not match the reviewed dev Unit",
    );

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrKserveNimVariantProofReceipt",
      metadata: { name: "aicr-kserve-nim-inference-3ef33472-variant" },
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
          control: "spec.predictor.model.storageUri",
          intent: "development model shapes read from their own model cache volume",
          before: searchValue,
          after: replaceValue,
          searchValue,
          replaceValue,
          changedResourceCount: changedIdentities.length,
          changedKind: MODEL_KIND,
          unchangedKind: RUNTIME_KIND,
          unchangedResourceCount: expectations.runtimeIdentities.length,
          devDryRun: "pass",
          devDryRunReportedMutations: true,
          devDryRunPreviewedResourceCount: previewedShapes.length,
          devDryRunNamedTheField: true,
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
          gatedReferencesUnchangedByTheChange: true,
          statement:
            "The artifact carried only the retained Apache-2.0 configuration. Gated images appear in every variant as references only, the reviewed change left those references untouched, nothing was pulled from nvcr.io, and no variant's data carries a literal credential value.",
        },
        cleanup,
        limits: [
          "This run used a temporary local registry; it does not prove public registry publication.",
          "This run started no Kubernetes cluster and installed no KServe. It does not prove serving, model loading, or any workload behavior.",
          "The scratch organization did not run the helm-catalog apply-policy Triggers, so this receipt does not prove policy execution.",
          "This receipt proves one retained-entry import, one reviewed model cache change across every model shape in a development variant, and one dev-to-staging promotion of that reviewed change.",
          "The development model cache volume is named in configuration only. This run created no PersistentVolumeClaim and does not prove that the volume exists.",
        ],
      },
      status: {
        result: "pass",
        ociImport: "pass",
        exactObjectSet: "pass",
        derivedVariant: "pass",
        changeDryRun: "pass",
        change: "pass",
        promotionDryRun: "pass",
        promotion: "pass",
        licenseBoundary: "pass",
        claim:
          "ConfigHub imported the retained KServe NIM surfaces as a base variant, kept them byte-faithful, applied one reviewed model-cache decision that changed every model shape and no serving runtime after a dry run that reported the mutation and changed nothing, and promoted the same reviewed configuration to staging with matching data.",
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

  check(receipt, "the KServe NIM variant proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `the KServe NIM variant proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(readYaml(receiptPath), loadExpectations());
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function verifySurfaceSet(docs, expectations, label) {
  check(
    docs.length === expectations.documentCount,
    `${label} must contain ${expectations.documentCount} retained surfaces`,
  );
  check(
    canonicalCounts(countKinds(docs)) === canonicalCounts(expectations.kindCounts),
    `${label} kind counts changed`,
  );
}

function assertStorageUri(docs, expected, label) {
  const models = docs.filter((doc) => doc.kind === MODEL_KIND);
  check(models.length > 0, `${label} holds no model shapes`);
  for (const model of models) {
    const storageUri = model.spec?.predictor?.model?.storageUri;
    check(
      storageUri === expected,
      `${label} model shape ${model.metadata?.name} reads from ${storageUri}, expected ${expected}`,
    );
  }
}

function countKinds(docs) {
  const counts = {};
  for (const doc of docs) counts[doc.kind] = (counts[doc.kind] ?? 0) + 1;
  return counts;
}

// ConfigHub returns the documents in its own order, so counts are compared by
// sorted entries rather than by object key order.
function canonicalCounts(counts) {
  return JSON.stringify(Object.entries(counts ?? {}).sort(([left], [right]) => left.localeCompare(right)));
}

function gatedImageReferences(docs) {
  return [...new Set(
    docs
      .flatMap((doc) => doc.spec?.containers ?? [])
      .map((containerSpec) => String(containerSpec.image ?? ""))
      .filter((image) => image.startsWith("nvcr.io/")),
  )].sort();
}

function canonicalKinds(docs, kind) {
  return canonicalDocs(docs.filter((doc) => doc.kind === kind));
}

function inspectVariant(context, spaceSlug, unitSlug) {
  const spaceResponse = cubJson(context, ["space", "get", spaceSlug, "-o", "json"]);
  const unitResponse = cubJson(context, ["unit", "get", unitSlug, "--space", spaceSlug, "-o", "json"]);
  const data = cub(context, ["unit", "data", unitSlug, "--space", spaceSlug]);
  const docs = parseDocs(data).map(stripCommentMetadata);
  return {
    space: spaceResponse.Space,
    unit: unitResponse.Unit,
    fromLink: unitResponse.FromLink?.[0] ?? null,
    data,
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
    upstreamRevision: variant.unit.UpstreamRevisionNum ?? null,
    upstreamUnitId: variant.unit.UpstreamUnitID ?? null,
    upgradeLinkId: variant.fromLink?.LinkID ?? null,
    dataHash: variant.unit.DataHash,
    canonicalDataSha256: variant.dataSha256,
  };
}

function verifyReceipt(receipt, expectations) {
  check(receipt.kind === "AicrKserveNimVariantProofReceipt", "KServe NIM variant receipt kind changed");
  check(receipt.status?.result === "pass", "KServe NIM variant proof is not pass");
  for (const lane of [
    "ociImport",
    "exactObjectSet",
    "derivedVariant",
    "changeDryRun",
    "change",
    "promotionDryRun",
    "promotion",
    "licenseBoundary",
  ]) {
    check(receipt.status?.[lane] === "pass", `KServe NIM variant receipt lane ${lane} did not pass`);
  }
  check(
    receipt.spec?.source?.platformDigest === expectations.platformDigest,
    "KServe NIM variant receipt no longer matches the committed platform digest",
  );
  check(
    receipt.spec?.source?.canonicalDataSha256 === expectations.canonicalDataSha256,
    "KServe NIM variant receipt canonical data differs from the committed retained surfaces",
  );
  check(
    receipt.spec?.source?.documentCount === expectations.documentCount,
    "KServe NIM variant receipt document count changed",
  );
  check(
    canonicalCounts(receipt.spec?.source?.kindCounts) === canonicalCounts(expectations.kindCounts),
    "KServe NIM variant receipt kind counts changed",
  );
  check(
    receipt.spec?.variants?.base?.canonicalDataSha256 === expectations.canonicalDataSha256,
    "the imported base variant did not match the committed retained bytes",
  );
  check(
    receipt.spec?.variants?.dev?.dataHash
      && receipt.spec?.variants?.dev?.dataHash !== receipt.spec?.variants?.base?.dataHash,
    "the development variant records no reviewed change against the base",
  );
  check(
    receipt.spec?.change?.control === "spec.predictor.model.storageUri"
      && String(receipt.spec?.change?.before ?? "").startsWith("pvc://")
      && String(receipt.spec?.change?.after ?? "").startsWith("pvc://")
      && receipt.spec?.change?.before !== receipt.spec?.change?.after,
    "the KServe NIM change no longer records the model cache decision",
  );
  check(
    receipt.spec?.change?.changedResourceCount === expectations.modelIdentities.length
      && receipt.spec?.change?.changedKind === MODEL_KIND,
    "the reviewed change must cover every model shape",
  );
  check(
    receipt.spec?.change?.unchangedResourceCount === expectations.runtimeIdentities.length
      && receipt.spec?.change?.unchangedKind === RUNTIME_KIND,
    "the reviewed change must leave every serving runtime alone",
  );
  check(
    receipt.spec?.change?.devDryRun === "pass"
      && receipt.spec?.change?.devDryRunReportedMutations === true
      && receipt.spec?.change?.devDryRunNamedTheField === true
      && receipt.spec?.change?.devDryRunLeftDataUnchanged === true
      && receipt.spec?.change?.devUpdate === "pass",
    "the KServe NIM dev change evidence is incomplete",
  );
  check(
    receipt.spec?.change?.devDryRunPreviewedResourceCount === expectations.modelIdentities.length,
    "the KServe NIM dry run did not preview every model shape",
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
    receipt.spec?.variants?.staging?.canonicalDataSha256
      && receipt.spec?.variants?.staging?.canonicalDataSha256
        === receipt.spec?.variants?.dev?.canonicalDataSha256,
    "the promoted staging variant does not carry the reviewed dev configuration",
  );
  const boundary = receipt.spec?.licenseBoundary ?? {};
  check(
    boundary.ngcContacted === false
      && boundary.imagesPulled === false
      && boundary.modelsFetched === false
      && boundary.embeddedCredentialValues === false
      && boundary.gatedReferencesUnchangedByTheChange === true,
    "the KServe NIM variant receipt does not hold the license boundary",
  );
  check(
    Array.isArray(boundary.gatedImageReferences)
      && boundary.gatedImageReferences.length > 0
      && boundary.gatedImageReferences.every((reference) => reference.startsWith("nvcr.io/")),
    "the KServe NIM variant receipt must record the gated image references it saw",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "the KServe NIM variant proof cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("started no Kubernetes cluster")),
    "the KServe NIM variant receipt must say that no cluster delivery was tested",
  );
  check(
    !Number.isNaN(Date.parse(receipt.spec?.recordedAt ?? "")),
    "the KServe NIM variant receipt records no valid timestamp",
  );
}

function renderSummary(receipt) {
  const source = receipt.spec.source;
  const change = receipt.spec.change;
  return `# KServe NIM inference ConfigHub variant proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the scratch proof with \`npm run aicr-kserve-nim-variant:run\`;
verify it without external access with \`npm run aicr-kserve-nim-variant:verify\`.

ConfigHub imported the ${source.documentCount} retained inference surfaces as a
base variant from a temporary OCI reference and kept them byte-faithful: the
base Unit's canonical data matched the committed files exactly, and the Space
recorded the exact source reference and digest. The entry's committed platform
digest at the time of the run was \`${source.platformDigest}\`.

Development and staging variants were created from the base, and one reviewed
decision was applied in development. Model shapes read from their own model
cache volume, so \`${change.control}\` moved from \`${change.before}\` to
\`${change.after}\`. That single change covered every one of the
${change.changedResourceCount} model shapes and left all ${change.unchangedResourceCount} serving runtimes
byte-identical. ConfigHub previewed it first: the dry run named all
${change.devDryRunPreviewedResourceCount} affected model shapes and the exact field it would update, and
it left the stored configuration unchanged.

The staging promotion was previewed first: the dry run reported one Unit and
left staging unchanged. The real promotion then copied the reviewed development
configuration to staging, and the two variants recorded the same canonical data.

The license boundary held for the whole run. Gated NGC images appear in every
variant as references only, the reviewed change left those references untouched,
nothing was pulled from \`nvcr.io\`, and no variant's data carries a literal
credential value.

The proof ran in the scratch organization \`${receipt.spec.context.organization}\`
on ${receipt.spec.recordedAt}. All three scratch Spaces and the temporary
registry were removed afterward.

## Limits

${receipt.spec.limits.map((limit) => `- ${limit}`).join("\n")}
`;
}

// The self-test exercises the receipt verifier against fake surfaces only: a
// fake inference tree with its own digest index, and a fake receipt consistent
// with it. It proves the verifier accepts the consistent receipt and refuses
// digest, canonical-data, change-scope, boundary, and cleanup regressions.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-nim-variant-self-test-"));
  try {
    const root = join(scratch, "inference");
    write(
      join(root, "upstream", "kserve", "runtimes", "fixture-runtime.yaml"),
      [
        "apiVersion: serving.kserve.io/v1alpha1",
        "kind: ClusterServingRuntime",
        "metadata:",
        "  name: fixture-runtime",
        "spec:",
        "  containers:",
        "  - image: nvcr.io/nim/fixture/model:1.0.0",
        "    name: kserve-container",
        "",
      ].join("\n"),
    );
    write(
      join(root, "upstream", "kserve", "nim-models", "fixture-model.yaml"),
      [
        "apiVersion: serving.kserve.io/v1beta1",
        "kind: InferenceService",
        "metadata:",
        "  name: fixture-model",
        "spec:",
        "  predictor:",
        "    minReplicas: 1",
        "    model:",
        "      runtime: fixture-runtime",
        "      storageUri: pvc://fixture-cache/",
        "",
      ].join("\n"),
    );
    const fixtureDigest = `sha256:${"4".repeat(64)}`;
    write(
      join(root, "digest-index", "platform-index.json"),
      `${JSON.stringify({ spec: { platformDigest: fixtureDigest } }, null, 2)}\n`,
    );
    const expectations = loadExpectations(root);
    check(expectations.documentCount === 2, "self-test fixture expectations are wrong");
    check(expectations.modelIdentities.length === 1, "self-test fixture holds the wrong model count");

    const receipt = () => ({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrKserveNimVariantProofReceipt",
      metadata: { name: "fixture" },
      spec: {
        recordedAt: "1970-01-01T00:00:00.000Z",
        context: { name: "fixture", organization: "fixture-org", purpose: "temporary scratch proof" },
        source: {
          platformDigest: fixtureDigest,
          canonicalDataSha256: expectations.canonicalDataSha256,
          documentCount: expectations.documentCount,
          kindCounts: expectations.kindCounts,
        },
        variants: {
          base: { dataHash: "hash-base", canonicalDataSha256: expectations.canonicalDataSha256 },
          dev: { dataHash: "hash-dev", canonicalDataSha256: "sha-reviewed" },
          staging: { dataHash: "hash-staging", canonicalDataSha256: "sha-reviewed" },
        },
        change: {
          control: "spec.predictor.model.storageUri",
          before: "pvc://fixture-cache/",
          after: "pvc://fixture-cache-dev/",
          changedResourceCount: 1,
          changedKind: MODEL_KIND,
          unchangedResourceCount: 1,
          unchangedKind: RUNTIME_KIND,
          devDryRun: "pass",
          devDryRunReportedMutations: true,
          devDryRunPreviewedResourceCount: 1,
          devDryRunNamedTheField: true,
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
          gatedImageReferences: ["nvcr.io/nim/fixture/model:1.0.0"],
          gatedReferencesUnchangedByTheChange: true,
        },
        cleanup: { stagingSpace: "pass", devSpace: "pass", baseSpace: "pass", registry: "pass" },
        limits: ["This run started no Kubernetes cluster. It does not prove delivery."],
      },
      status: {
        result: "pass",
        ociImport: "pass",
        exactObjectSet: "pass",
        derivedVariant: "pass",
        changeDryRun: "pass",
        change: "pass",
        promotionDryRun: "pass",
        promotion: "pass",
        licenseBoundary: "pass",
      },
    });

    verifyReceipt(receipt(), expectations);

    const refusals = [
      [(r) => (r.spec.source.platformDigest = `sha256:${"9".repeat(64)}`), /committed platform digest/],
      [(r) => (r.spec.source.canonicalDataSha256 = "not-the-sha"), /canonical data differs/],
      [(r) => (r.spec.change.changedResourceCount = 0), /cover every model shape/],
      [(r) => (r.spec.change.unchangedResourceCount = 0), /leave every serving runtime alone/],
      [(r) => (r.spec.change.after = r.spec.change.before), /model cache decision/],
      [(r) => (r.spec.change.devDryRunReportedMutations = false), /dev change evidence is incomplete/],
      [(r) => (r.spec.change.devDryRunPreviewedResourceCount = 0), /preview every model shape/],
      [(r) => (r.spec.cleanup.devSpace = "fail"), /cleanup did not pass/],
      [(r) => (r.spec.variants.dev.dataHash = "hash-base"), /records no reviewed change/],
      [(r) => (r.spec.promotion.stagingMatchesReviewedDev = false), /promotion evidence is incomplete/],
      [(r) => (r.spec.variants.staging.canonicalDataSha256 = "sha-other"), /does not carry the reviewed dev configuration/],
      [(r) => (r.spec.licenseBoundary.imagesPulled = true), /hold the license boundary/],
      [(r) => (r.spec.licenseBoundary.gatedReferencesUnchangedByTheChange = false), /hold the license boundary/],
      [(r) => (r.spec.licenseBoundary.gatedImageReferences = []), /record the gated image references/],
      [(r) => (r.spec.limits = []), /no cluster delivery/],
    ];
    for (const [mutate, pattern] of refusals) {
      const mutated = receipt();
      mutate(mutated);
      check(
        fails(() => verifyReceipt(mutated, expectations), pattern),
        `self-test accepted a receipt violating ${pattern}`,
      );
    }

    // The credential rule must refuse a literal value and accept the shapes the
    // retained surfaces actually use.
    check(
      fails(() => refuseEmbeddedCredentials("fixture", "  NGC_API_KEY: nvapi-literal"), /literal credential value/),
      "the credential scan accepted a literal key",
    );
    refuseEmbeddedCredentials("fixture", "  NGC_API_KEY: \n  HF_TOKEN: $SUBSTITUTED");
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

function changedDocs(before, after) {
  const left = docMap(before);
  const right = docMap(after);
  const identities = [...new Set([...left.keys(), ...right.keys()])].sort();
  return identities.filter((identityKey) => left.get(identityKey) !== right.get(identityKey));
}

function docMap(docs) {
  return new Map(docs.map((doc) => [identity(doc), JSON.stringify(doc)]));
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
