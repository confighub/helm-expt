// Shared extraction and rendering logic for the NIM model-profile generator.
//
// Three NIM model shapes are already retained in this repository, copied
// unmodified from NVIDIA's Apache-2.0 nim-deploy KServe subtree the same way
// the first described profile was. This module reads those two files per
// shape (the InferenceService and its ClusterServingRuntime), extracts the
// config-plane facts, asserts they agree with each other and with the pinned
// checksums, and returns the exact text of the profile record, the receipt,
// and the summary page as data. The generator and the verifier both call this
// module, so they cannot disagree: a generator that drifted from its verifier
// would just be two different sources of truth wearing one name.
//
// Everything here reads committed bytes only. No network, no cluster, no NGC
// contact, and no wall-clock time enters the output; the only date recorded
// anywhere is the source `retrievedAt` pinned in the retention receipt.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYamlText, relativeRepo, repoRoot, serializeYaml, sha256File } from "./proof-common.mjs";

const ENTRY_DIR = join("examples", "aicr", "kserve-nim-inference");
const UPSTREAM_DIR = join(ENTRY_DIR, "upstream");
const CHECKSUMS_PATH = join(ENTRY_DIR, "upstream-checksums.txt");
const RETENTION_RECEIPT_PATH = join(ENTRY_DIR, "retention-receipt.yaml");
const LICENSE_READ_DOC = "docs/planning/nim-ngc-license-read.md";

export const OUTPUT_ROOT = join("data", "aicr-nim-model-profiles");
export const PROFILES_DIR = join(OUTPUT_ROOT, "profiles");
export const RECEIPTS_DIR = join(OUTPUT_ROOT, "receipts");
export const SUMMARY_PATH = join(OUTPUT_ROOT, "summary.md");

// The mapping from a retained pair of files to the shape it describes is a
// selection nobody can derive; everything else below (the slug, the model
// format, the image, the GPU count, the storage URI, the license page) is
// read out of the two files themselves rather than repeated here, so this
// table cannot drift from what the files actually say.
export const TARGETS = [
  {
    modelShapeFile: join("kserve", "nim-models", "llama-3.1-70b-instruct_2xgpu_1.1.0.yaml"),
    servingRuntimeFile: join("kserve", "runtimes", "llama-3.1-70b-instruct-1.1.0.yaml"),
    kind: "llm",
  },
  {
    modelShapeFile: join("kserve", "nim-models", "mixtral-8x7b-instruct-v01_2xgpu_1.0.0.yaml"),
    servingRuntimeFile: join("kserve", "runtimes", "mixtral-8x7b-instruct-v01-1.0.0.yaml"),
    kind: "llm",
  },
  {
    modelShapeFile: join("kserve", "nim-models", "nv-embedqa-e5-v5_1xgpu_1.0.0.yaml"),
    servingRuntimeFile: join("kserve", "runtimes", "nv-embedqa-e5-v5-1.0.0.yaml"),
    kind: "embedding",
  },
];

function repoJoin(root, ...parts) {
  return join(root, ...parts);
}

// upstream-checksums.txt is a standard `sha256sum` listing: 64 hex characters,
// two spaces, then a path relative to `upstream/`.
function loadChecksums(root) {
  const path = repoJoin(root, CHECKSUMS_PATH);
  const text = readFileSync(path, "utf8");
  const map = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const match = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
    check(match, `${relativeRepo(path)}: malformed checksum line: ${JSON.stringify(line)}`);
    map.set(match[2], match[1]);
  }
  return map;
}

function loadSource(root) {
  const path = repoJoin(root, RETENTION_RECEIPT_PATH);
  const text = readFileSync(path, "utf8");
  const doc = readYamlText(text);
  check(doc.kind === "SourceRetentionReceipt", `${relativeRepo(path)}: expected kind SourceRetentionReceipt`);
  const source = doc.spec?.source ?? {};
  for (const field of ["name", "repository", "commit", "subtree", "license", "retrievedAt"]) {
    check(source[field], `${relativeRepo(path)}: source.${field} is missing`);
  }
  return {
    name: source.name,
    repository: source.repository,
    commit: source.commit,
    subtree: source.subtree,
    license: source.license,
    retrievedAt: source.retrievedAt,
  };
}

// Derived programmatically from the image reference, never from a hardcoded
// team map: nvcr.io/nim/<team>/<container>:<tag> becomes the NGC catalog page
// for that team's container.
export function ngcCatalogPageFor(image) {
  const match = image.match(/^nvcr\.io\/nim\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9.-]*):([a-zA-Z0-9._-]+)$/);
  check(match, `image is not a recognized nvcr.io/nim/<team>/<container>:<tag> reference: ${image}`);
  const [, team, container] = match;
  return `https://catalog.ngc.nvidia.com/orgs/nim/teams/${team}/containers/${container}`;
}

function extractFacts(root, target, checksums) {
  const shapeRepoPath = join(UPSTREAM_DIR, target.modelShapeFile);
  const runtimeRepoPath = join(UPSTREAM_DIR, target.servingRuntimeFile);
  const shapeAbsPath = repoJoin(root, shapeRepoPath);
  const runtimeAbsPath = repoJoin(root, runtimeRepoPath);
  check(existsSync(shapeAbsPath), `missing retained shape file: ${relativeRepo(shapeAbsPath)}`);
  check(existsSync(runtimeAbsPath), `missing retained runtime file: ${relativeRepo(runtimeAbsPath)}`);

  const shape = readYamlText(readFileSync(shapeAbsPath, "utf8"));
  const runtime = readYamlText(readFileSync(runtimeAbsPath, "utf8"));
  check(
    shape.apiVersion === "serving.kserve.io/v1beta1" && shape.kind === "InferenceService",
    `${relativeRepo(shapeAbsPath)}: expected an InferenceService`,
  );
  check(
    runtime.apiVersion === "serving.kserve.io/v1alpha1" && runtime.kind === "ClusterServingRuntime",
    `${relativeRepo(runtimeAbsPath)}: expected a ClusterServingRuntime`,
  );

  const slug = shape.metadata?.name;
  check(slug, `${relativeRepo(shapeAbsPath)}: metadata.name is missing`);

  const model = shape.spec?.predictor?.model ?? {};
  const modelFormat = model.modelFormat?.name;
  const servingRuntimeRef = model.runtime;
  const storageUri = model.storageUri;
  check(modelFormat, `${relativeRepo(shapeAbsPath)}: spec.predictor.model.modelFormat.name is missing`);
  check(servingRuntimeRef, `${relativeRepo(shapeAbsPath)}: spec.predictor.model.runtime is missing`);
  check(storageUri, `${relativeRepo(shapeAbsPath)}: spec.predictor.model.storageUri is missing`);

  const limitsGpu = model.resources?.limits?.["nvidia.com/gpu"];
  const requestsGpu = model.resources?.requests?.["nvidia.com/gpu"];
  check(limitsGpu, `${relativeRepo(shapeAbsPath)}: resources.limits["nvidia.com/gpu"] is missing`);
  check(requestsGpu, `${relativeRepo(shapeAbsPath)}: resources.requests["nvidia.com/gpu"] is missing`);
  const gpuLimitsEqualRequests = limitsGpu === requestsGpu;
  check(
    gpuLimitsEqualRequests,
    `${relativeRepo(shapeAbsPath)}: gpu limit ${limitsGpu} does not equal gpu request ${requestsGpu}`,
  );
  const gpuCount = Number.parseInt(limitsGpu, 10);
  check(Number.isInteger(gpuCount) && gpuCount > 0, `${relativeRepo(shapeAbsPath)}: gpu count did not parse to a positive integer`);

  const container = (runtime.spec?.containers ?? []).find((entry) => entry.name === "kserve-container");
  check(container, `${relativeRepo(runtimeAbsPath)}: no container named kserve-container`);
  const image = container.image;
  check(image, `${relativeRepo(runtimeAbsPath)}: container image is missing`);
  const imageIsTaggedReference = /^nvcr\.io\/.+:[^:@\s]+$/.test(image) && !image.includes("@sha256:");
  check(imageIsTaggedReference, `${relativeRepo(runtimeAbsPath)}: image is not a plain nvcr.io reference with a tag: ${image}`);

  const supportedFormats = runtime.spec?.supportedModelFormats ?? [];
  const matchedFormat = supportedFormats.find((entry) => String(entry.name ?? "").trim() === modelFormat.trim());
  check(
    matchedFormat,
    `${relativeRepo(runtimeAbsPath)}: no supportedModelFormats entry (trimmed) matches shape modelFormat "${modelFormat}"`,
  );
  const servingRuntimeMatches = String(servingRuntimeRef).trim() === String(runtime.metadata?.name ?? "").trim();
  check(
    servingRuntimeMatches,
    `${relativeRepo(shapeAbsPath)}: spec.predictor.model.runtime "${servingRuntimeRef}" does not match ${relativeRepo(runtimeAbsPath)} metadata.name "${runtime.metadata?.name}"`,
  );

  const imagePullSecretsRaw = runtime.spec?.imagePullSecrets ?? [];
  for (const entry of imagePullSecretsRaw) {
    check(
      typeof entry.name === "string" && Object.keys(entry).length === 1,
      `${relativeRepo(runtimeAbsPath)}: imagePullSecrets entry carries more than a name`,
    );
  }
  const imagePullSecrets = imagePullSecretsRaw.map((entry) => entry.name);
  check(imagePullSecrets.length > 0, `${relativeRepo(runtimeAbsPath)}: no imagePullSecrets are declared`);

  const envs = container.env ?? [];
  const secretKeyRefs = [];
  let noSecretValues = true;
  for (const env of envs) {
    if (env.valueFrom?.secretKeyRef) {
      const ref = env.valueFrom.secretKeyRef;
      check(
        typeof ref.name === "string" && typeof ref.key === "string",
        `${relativeRepo(runtimeAbsPath)}: env ${env.name} secretKeyRef is missing a name or key`,
      );
      if (env.value !== undefined) noSecretValues = false;
      secretKeyRefs.push({ envName: env.name, secretName: ref.name, key: ref.key });
    }
  }
  check(secretKeyRefs.length > 0, `${relativeRepo(runtimeAbsPath)}: no env var uses a secretKeyRef`);
  check(noSecretValues, `${relativeRepo(runtimeAbsPath)}: a secretKeyRef env var also carries a literal value`);

  const shapePinned = checksums.get(target.modelShapeFile.replaceAll("\\", "/"));
  const runtimePinned = checksums.get(target.servingRuntimeFile.replaceAll("\\", "/"));
  const checksumsAbsPath = repoJoin(root, CHECKSUMS_PATH);
  check(shapePinned, `${relativeRepo(checksumsAbsPath)}: no pinned checksum for ${target.modelShapeFile}`);
  check(runtimePinned, `${relativeRepo(checksumsAbsPath)}: no pinned checksum for ${target.servingRuntimeFile}`);
  const shapeObserved = sha256File(shapeAbsPath);
  const runtimeObserved = sha256File(runtimeAbsPath);
  const shapeShaMatchesPin = shapeObserved === shapePinned;
  const runtimeShaMatchesPin = runtimeObserved === runtimePinned;
  check(shapeShaMatchesPin, `${relativeRepo(shapeAbsPath)}: observed sha256 ${shapeObserved} does not match pinned ${shapePinned}`);
  check(runtimeShaMatchesPin, `${relativeRepo(runtimeAbsPath)}: observed sha256 ${runtimeObserved} does not match pinned ${runtimePinned}`);

  const checks = [
    {
      name: "serving-runtime-reference-matches-metadata-name",
      result: "pass",
      detail: `${relativeRepo(shapeAbsPath)} spec.predictor.model.runtime matches ${relativeRepo(runtimeAbsPath)} metadata.name.`,
    },
    {
      name: "model-format-matches-supported-format-trimmed",
      result: "pass",
      detail: `${relativeRepo(shapeAbsPath)} modelFormat matches a trimmed entry in ${relativeRepo(runtimeAbsPath)} supportedModelFormats.`,
    },
    {
      name: "gpu-limits-equal-requests",
      result: "pass",
      detail: `resources.limits and resources.requests both declare nvidia.com/gpu: "${limitsGpu}".`,
    },
    {
      name: "image-is-tagged-reference-not-digest",
      result: "pass",
      detail: `${image} names an nvcr.io repository and tag; it is configuration data and was never resolved to a digest.`,
    },
    {
      name: "secret-fields-carry-names-only-no-values",
      result: "pass",
      detail: "imagePullSecrets and every secretKeyRef carry a name (and key) only; no env var also carries a literal value.",
    },
    {
      name: "model-shape-sha256-matches-pin",
      result: "pass",
      detail: `sha256 of ${relativeRepo(shapeAbsPath)} matches the pin in ${relativeRepo(checksumsAbsPath)}.`,
    },
    {
      name: "serving-runtime-sha256-matches-pin",
      result: "pass",
      detail: `sha256 of ${relativeRepo(runtimeAbsPath)} matches the pin in ${relativeRepo(checksumsAbsPath)}.`,
    },
  ];

  return {
    slug,
    kind: target.kind,
    modelShapeFileRepo: relativeRepo(shapeAbsPath),
    servingRuntimeFileRepo: relativeRepo(runtimeAbsPath),
    modelShapeSha256: shapeObserved,
    servingRuntimeSha256: runtimeObserved,
    modelFormat,
    servingRuntime: servingRuntimeRef,
    image,
    gpuCount,
    storageUri,
    imagePullSecrets,
    secretKeyRefs,
    ngcCatalogPage: ngcCatalogPageFor(image),
    checks,
  };
}

function descriptionFor(fact) {
  const gpuWord = fact.gpuCount === 1 ? "one GPU" : `${fact.gpuCount} GPUs`;
  const kindPhrase = fact.kind === "embedding" ? "an embedding runtime rather than a chat model" : "a chat-completion model";
  return (
    `A generated model profile for the inference entry: ${kindPhrase} shaped for ` +
    `${gpuWord}, read from the same retained upstream commit as the first ` +
    "described profile. This record is configuration data about the shape; " +
    "it grants nothing and fetches nothing."
  );
}

function governingTermsPendingSentence(fact) {
  return (
    "The per-artifact governing terms for this image have not been read from " +
    `the NGC catalog page. Read them at deploy time from ${fact.ngcCatalogPage} ` +
    `and see ${LICENSE_READ_DOC} for how this catalog treats NIM licensing ` +
    "generally; per-artifact terms override any general statement recorded " +
    "elsewhere."
  );
}

function profileDocFor(fact) {
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "NIMModelProfileRecord",
    metadata: { name: fact.slug },
    spec: {
      description: descriptionFor(fact),
      modelShape: fact.slug,
      modelShapeFile: fact.modelShapeFileRepo,
      modelShapeSha256: fact.modelShapeSha256,
      servingRuntime: fact.servingRuntime,
      servingRuntimeFile: fact.servingRuntimeFileRepo,
      servingRuntimeSha256: fact.servingRuntimeSha256,
      image: fact.image,
      gpuCount: fact.gpuCount,
      storageUri: fact.storageUri,
      licensing: {
        imageRegistry:
          "nvcr.io is NGC-gated. The image is pulled only by the user's cluster with " +
          "the user's NGC API key under the user's own NVIDIA entitlement.",
        ngcCatalogPage: fact.ngcCatalogPage,
        governingTermsReadAt: null,
        governingTermsNamed: [],
        governingTerms: governingTermsPendingSentence(fact),
        licenseRead: LICENSE_READ_DOC,
      },
    },
    status: {
      result: "described-offline-terms-pending",
      imagePulled: false,
      modelFetched: false,
    },
  };
}

function receiptDocFor(fact, source, checksumsPathRepo, retentionReceiptPathRepo) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "NIMModelShapeReceipt",
    metadata: { name: fact.slug },
    spec: {
      modelShape: fact.slug,
      source: {
        name: source.name,
        repository: source.repository,
        commit: source.commit,
        subtree: source.subtree,
        license: source.license,
        retrievedAt: source.retrievedAt,
        retentionReceipt: retentionReceiptPathRepo,
      },
      files: [
        {
          path: fact.modelShapeFileRepo,
          role: "modelShape",
          pinnedSha256: fact.modelShapeSha256,
          observedSha256: fact.modelShapeSha256,
          checksumsFile: checksumsPathRepo,
        },
        {
          path: fact.servingRuntimeFileRepo,
          role: "servingRuntime",
          pinnedSha256: fact.servingRuntimeSha256,
          observedSha256: fact.servingRuntimeSha256,
          checksumsFile: checksumsPathRepo,
        },
      ],
      facts: {
        modelFormat: fact.modelFormat,
        servingRuntime: fact.servingRuntime,
        image: fact.image,
        gpuCount: fact.gpuCount,
        storageUri: fact.storageUri,
        imagePullSecrets: fact.imagePullSecrets,
        secretKeyRefs: fact.secretKeyRefs,
      },
      checks: fact.checks,
      boundary: {
        configPlaneOnly: true,
        imagesPulled: false,
        ngcContacted: false,
        modelsFetched: false,
        secretValuesIncluded: false,
        statement:
          `This receipt describes retained configuration only for the ${fact.slug} ` +
          "shape. No NIM container ran, no model was fetched, and no NGC surface " +
          "was contacted to produce it.",
      },
    },
    status: {
      result: "described-offline",
    },
  };
}

function summaryFor(facts, checksumsPathRepo, retentionReceiptPathRepo) {
  const rows = facts.map(
    (fact) =>
      `| \`${fact.slug}\` | ${fact.kind === "embedding" ? "embedding" : "chat completion"} | \`${fact.modelFormat}\` | \`${fact.image}\` | ${fact.gpuCount} |`,
  );

  return `# Three generated NIM model profiles from the retained KServe subtree

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-nim-model-profiles:generate\` and checked by
\`npm run aicr-nim-model-profiles:verify\`. Both read the same two files per
shape, under \`${UPSTREAM_DIR.replaceAll("\\", "/")}/\`, pinned in
\`${checksumsPathRepo}\` and provenanced by \`${retentionReceiptPathRepo}\`.

This increment proves the generation-and-receipt mechanics end to end on
real, license-cleared bytes. It reads three NIM model shapes that were
already retained from NVIDIA's Apache-2.0 nim-deploy KServe subtree, at
commit \`${facts[0]?.sourceCommit ?? ""}\`, and writes one model-profile
record plus one receipt for each. It creates no new catalog entry and
changes no count; the three shapes generate alongside the existing
\`kserve-nim-inference\` entry's own first described profile.

| Model shape | Kind | Model format | Image | GPU count |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

Each profile records its retained source files by repo-rooted path and by
sha256, and each receipt names the consistency checks that ran: the serving
runtime name cross-checked between the InferenceService and its
ClusterServingRuntime, the model format cross-checked the same way with
whitespace trimmed (the \`nv-embedqa-e5-v5\` runtime's
\`supportedModelFormats\` entry carries a leading-space typo upstream), the
GPU limit checked against the GPU request, the image reference checked as a
tagged \`nvcr.io\` reference rather than a resolved digest, every
\`imagePullSecrets\` and \`secretKeyRef\` entry checked for a name with no
literal value beside it, and both source files' sha256 checked against the
pin in \`${checksumsPathRepo}\`.

## What ran and what did not

Every check above ran offline against the two committed files per shape. No
image was pulled, no model weight moved, no NGC catalog page was fetched by
this generator, and no cluster or GPU took part. The receipts record that
boundary directly: \`configPlaneOnly: true\`, \`imagesPulled: false\`,
\`ngcContacted: false\`, \`modelsFetched: false\`, and
\`secretValuesIncluded: false\`.

## The NGC governing terms are pending a human read

None of these three profiles names governing terms. Each one sets
\`governingTermsReadAt\` to \`null\` and \`governingTermsNamed\` to an empty
list, and its \`governingTerms\` sentence points at its derived NGC catalog
page and at \`${LICENSE_READ_DOC}\`. That is a deliberate gap rather than an
oversight: nobody has read those three catalog pages by hand yet, the way
the first described profile's terms were read on 2026-08-07. Reading them
is the one step a person still has to take before any of these three
shapes is treated the way that first profile is.

## Regenerate and verify

\`\`\`sh
npm run aicr-nim-model-profiles:generate
npm run aicr-nim-model-profiles:verify
\`\`\`
`;
}

// The pure function the generator and the verifier both call. It reads
// committed bytes only under `root`, asserts every consistency rule inline
// via `check`, and returns the exact text every output file must hold.
export function buildReport(root = repoRoot) {
  const checksums = loadChecksums(root);
  const source = loadSource(root);
  const checksumsPathRepo = relativeRepo(repoJoin(root, CHECKSUMS_PATH));
  const retentionReceiptPathRepo = relativeRepo(repoJoin(root, RETENTION_RECEIPT_PATH));
  const facts = TARGETS.map((target) => extractFacts(root, target, checksums));
  const slugs = new Set();
  for (const fact of facts) {
    check(!slugs.has(fact.slug), `two targets produced the same slug: ${fact.slug}`);
    slugs.add(fact.slug);
  }

  const profiles = facts.map((fact) => ({
    slug: fact.slug,
    path: repoJoin(root, PROFILES_DIR, `${fact.slug}.yaml`),
    yaml: serializeYaml(profileDocFor(fact)),
  }));
  const receipts = facts.map((fact) => ({
    slug: fact.slug,
    path: repoJoin(root, RECEIPTS_DIR, `${fact.slug}.yaml`),
    yaml: serializeYaml(receiptDocFor(fact, source, checksumsPathRepo, retentionReceiptPathRepo)),
  }));

  return {
    facts,
    profiles,
    receipts,
    summaryPath: repoJoin(root, SUMMARY_PATH),
    summaryMd: summaryFor(
      facts.map((fact) => ({ ...fact, sourceCommit: source.commit })),
      checksumsPathRepo,
      retentionReceiptPathRepo,
    ),
  };
}
