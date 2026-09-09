// Shared extraction and rendering logic for the NIM model-profile generator.
//
// Sixteen NIM model shapes are retained in this repository, copied
// unmodified from NVIDIA's Apache-2.0 nim-deploy KServe subtree the same way
// the first described profile was. One of them, the smallest current-
// generation shape, already has its own hand-authored profile; this module
// derives its target set from the kserve-nim-inference entry's digest-bound
// member index (every `role: model-shape` member, in index order) and skips
// that one shape. For each of the other fifteen it reads two files (the
// InferenceService and its ClusterServingRuntime), extracts the config-plane
// facts, asserts they agree with each other and with the pinned checksums,
// and returns the exact text of the profile record, the receipt, and the
// summary page as data. The generator and the verifier both call this
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

const DIGEST_INDEX_PATH = join(ENTRY_DIR, "digest-index", "platform-index.json");
const PRE_EXISTING_PROFILE_PATH = join(ENTRY_DIR, "profile", "model-profile.yaml");

function repoJoin(root, ...parts) {
  return join(root, ...parts);
}

// Target discovery reads the kserve-nim-inference entry's digest-bound
// member index rather than naming files in a table: every `role:
// model-shape` member, in index order, is a target except the one shape that
// already has its own hand-authored profile. A target's serving-runtime file
// is resolved the same way the candidate-and-readiness view resolves it:
// read the shape's own `spec.predictor.model.runtime`, then find the one
// `role: serving-runtime` member whose file's own `metadata.name` matches
// it, failing closed on zero or on more than one match. Everything else
// (the model format, the image, the GPU count, the storage URI, the license
// page, and the kind of runtime) is read out of the two files themselves
// rather than repeated here.

function loadDigestIndexMembers(root) {
  const path = repoJoin(root, DIGEST_INDEX_PATH);
  check(existsSync(path), `missing digest index: ${relativeRepo(path)}`);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  check(doc.kind === "AICRPlatformDigestIndex", `${relativeRepo(path)}: expected kind AICRPlatformDigestIndex`);
  const members = doc.spec?.members;
  check(Array.isArray(members) && members.length > 0, `${relativeRepo(path)}: spec.members is missing or empty`);
  return members;
}

// A digest index member's sourceFile is repo-rooted under the entry
// directory and always begins with "upstream/"; the file fields this module
// reads with are relative to UPSTREAM_DIR instead, so this strips that
// shared prefix.
function upstreamRelativeFile(sourceFile, digestIndexPathRepo) {
  const prefix = "upstream/";
  check(sourceFile.startsWith(prefix), `${digestIndexPathRepo}: member sourceFile is not under upstream/: ${sourceFile}`);
  return sourceFile.slice(prefix.length);
}

function buildServingRuntimeFileIndex(root, runtimeMembers, digestIndexPathRepo) {
  const byName = new Map();
  for (const member of runtimeMembers) {
    const fileRel = upstreamRelativeFile(member.sourceFile, digestIndexPathRepo);
    const absPath = repoJoin(root, UPSTREAM_DIR, fileRel);
    check(existsSync(absPath), `missing retained serving-runtime file: ${relativeRepo(absPath)}`);
    const doc = readYamlText(readFileSync(absPath, "utf8"));
    check(
      doc.apiVersion === "serving.kserve.io/v1alpha1" && doc.kind === "ClusterServingRuntime",
      `${relativeRepo(absPath)}: expected a ClusterServingRuntime`,
    );
    const name = String(doc.metadata?.name ?? "").trim();
    check(name, `${relativeRepo(absPath)}: metadata.name is missing`);
    check(!byName.has(name), `two retained serving-runtime files share metadata.name ${name}`);
    byName.set(name, fileRel);
  }
  return byName;
}

function loadAuthoredSlug(root) {
  const path = repoJoin(root, PRE_EXISTING_PROFILE_PATH);
  check(existsSync(path), `missing pre-existing authored profile: ${relativeRepo(path)}`);
  const doc = readYamlText(readFileSync(path, "utf8"));
  const name = doc.metadata?.name;
  const modelShape = doc.spec?.modelShape;
  check(name, `${relativeRepo(path)}: metadata.name is missing`);
  check(modelShape, `${relativeRepo(path)}: spec.modelShape is missing`);
  check(name === modelShape, `${relativeRepo(path)}: metadata.name "${name}" does not match spec.modelShape "${modelShape}"`);
  return name;
}

// The pure discovery step behind buildReport: reads the digest index and the
// pre-existing authored profile, and returns one target (a shape file paired
// with its resolved runtime file) for each `role: model-shape` member that
// is not the authored shape, in index order.
function deriveTargets(root) {
  const digestIndexPath = repoJoin(root, DIGEST_INDEX_PATH);
  const digestIndexPathRepo = relativeRepo(digestIndexPath);
  const members = loadDigestIndexMembers(root);
  const shapeMembers = members.filter((member) => member.role === "model-shape");
  const runtimeMembers = members.filter((member) => member.role === "serving-runtime");
  check(shapeMembers.length > 0, `${digestIndexPathRepo}: no role: model-shape members found`);
  check(runtimeMembers.length > 0, `${digestIndexPathRepo}: no role: serving-runtime members found`);

  const runtimeFileByName = buildServingRuntimeFileIndex(root, runtimeMembers, digestIndexPathRepo);
  const authoredSlug = loadAuthoredSlug(root);

  const targets = [];
  for (const member of shapeMembers) {
    if (member.component === authoredSlug) continue;

    const shapeFileRel = upstreamRelativeFile(member.sourceFile, digestIndexPathRepo);
    const shapeAbsPath = repoJoin(root, UPSTREAM_DIR, shapeFileRel);
    check(existsSync(shapeAbsPath), `missing retained shape file: ${relativeRepo(shapeAbsPath)}`);
    const shape = readYamlText(readFileSync(shapeAbsPath, "utf8"));
    check(
      shape.apiVersion === "serving.kserve.io/v1beta1" && shape.kind === "InferenceService",
      `${relativeRepo(shapeAbsPath)}: expected an InferenceService`,
    );
    const slug = shape.metadata?.name;
    check(slug, `${relativeRepo(shapeAbsPath)}: metadata.name is missing`);
    check(
      slug === member.component,
      `${relativeRepo(shapeAbsPath)}: metadata.name "${slug}" does not match digest index component "${member.component}"`,
    );

    const runtimeRef = String(shape.spec?.predictor?.model?.runtime ?? "").trim();
    check(runtimeRef, `${relativeRepo(shapeAbsPath)}: spec.predictor.model.runtime is missing`);
    check(
      runtimeFileByName.has(runtimeRef),
      `${relativeRepo(shapeAbsPath)}: runtime "${runtimeRef}" matched 0 serving-runtime member(s) in ${digestIndexPathRepo}, expected exactly one`,
    );

    targets.push({ modelShapeFile: shapeFileRel, servingRuntimeFile: runtimeFileByName.get(runtimeRef) });
  }

  return { targets, authoredSlug, digestIndexPathRepo, modelShapeMemberCount: shapeMembers.length };
}

// A model shape's kind is read out of its own model format name rather than
// kept in a lookup table: the two retrieval-style formats name themselves
// "embedqa" and "rerankqa"; everything else is a chat-completion model.
function deriveKind(modelFormat) {
  const lower = modelFormat.toLowerCase();
  if (lower.includes("embedqa")) return "embedding";
  if (lower.includes("rerankqa")) return "rerank";
  return "llm";
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
    kind: deriveKind(modelFormat),
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

function kindPhraseFor(kind) {
  if (kind === "embedding") return "an embedding runtime rather than a chat model";
  if (kind === "rerank") return "a reranking runtime rather than a chat model";
  return "a chat-completion model";
}

function descriptionFor(fact) {
  const gpuWord = fact.gpuCount === 1 ? "one GPU" : `${fact.gpuCount} GPUs`;
  const kindPhrase = kindPhraseFor(fact.kind);
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

function kindLabel(kind) {
  if (kind === "embedding") return "embedding";
  if (kind === "rerank") return "reranking";
  return "chat completion";
}

function summaryFor(facts, checksumsPathRepo, retentionReceiptPathRepo, context) {
  const { authoredSlug, digestIndexPathRepo, modelShapeMemberCount, sourceCommit } = context;
  const rows = facts.map(
    (fact) => `| \`${fact.slug}\` | ${kindLabel(fact.kind)} | \`${fact.modelFormat}\` | \`${fact.image}\` | ${fact.gpuCount} |`,
  );

  return `# ${facts.length} generated NIM model profiles from the retained KServe subtree

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-nim-model-profiles:generate\` and checked by
\`npm run aicr-nim-model-profiles:verify\`. Both read the same two files per
shape, under \`${UPSTREAM_DIR.replaceAll("\\", "/")}/\`, pinned in
\`${checksumsPathRepo}\` and provenanced by \`${retentionReceiptPathRepo}\`.

The kserve-nim-inference entry's digest-bound member index,
\`${digestIndexPathRepo}\`,
carries ${modelShapeMemberCount} \`role: model-shape\` members, all read from
the same retained upstream commit \`${sourceCommit}\` of NVIDIA's
Apache-2.0 nim-deploy KServe subtree. One of them, \`${authoredSlug}\`,
already had its own hand-authored model profile before this generator
existed; this generator leaves that shape alone and writes nothing for it.
It writes one model-profile record plus one receipt for each of the other
${facts.length} shapes, so every retained shape now carries a profile. It
creates no new catalog entry and changes no count.

| Model shape | Kind | Model format | Image | GPU count |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

Each profile records its retained source files by repo-rooted path and by
sha256, and each receipt names the consistency checks that ran: the serving
runtime name cross-checked between the InferenceService and its
ClusterServingRuntime, the model format cross-checked the same way with
whitespace trimmed (two of the ten retained runtime files, \`nv-embedqa-e5-v5\`
and \`nv-rerankqa-mistral-4b-v3\`, carry a leading-space typo in their
\`supportedModelFormats\` entry upstream), the GPU limit checked against the
GPU request, the image reference checked as a tagged \`nvcr.io\` reference
rather than a resolved digest, every \`imagePullSecrets\` and
\`secretKeyRef\` entry checked for a name with no literal value beside it,
and both source files' sha256 checked against the pin in
\`${checksumsPathRepo}\`.

## What ran and what did not

Every check above ran offline against the two committed files per shape. No
image was pulled, no model weight moved, no NGC catalog page was fetched by
this generator, and no cluster or GPU took part. The receipts record that
boundary directly: \`configPlaneOnly: true\`, \`imagesPulled: false\`,
\`ngcContacted: false\`, \`modelsFetched: false\`, and
\`secretValuesIncluded: false\`.

## The NGC governing terms are pending a human read

None of these ${facts.length} profiles names governing terms. Each one sets
\`governingTermsReadAt\` to \`null\` and \`governingTermsNamed\` to an empty
list, and its \`governingTerms\` sentence points at its derived NGC catalog
page and at \`${LICENSE_READ_DOC}\`. That is a deliberate gap rather than an
oversight: nobody has read these catalog pages by hand yet, the way
\`${authoredSlug}\`'s terms were read on 2026-08-07. Reading them is the one
step a person still has to take before any of these ${facts.length} shapes
is treated the way that first profile is.

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
  const { targets, authoredSlug, digestIndexPathRepo, modelShapeMemberCount } = deriveTargets(root);
  const facts = targets.map((target) => extractFacts(root, target, checksums));
  const slugs = new Set();
  for (const fact of facts) {
    check(!slugs.has(fact.slug), `two targets produced the same slug: ${fact.slug}`);
    check(fact.slug !== authoredSlug, `target derivation did not skip the authored shape ${authoredSlug}`);
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
    summaryMd: summaryFor(facts, checksumsPathRepo, retentionReceiptPathRepo, {
      authoredSlug,
      digestIndexPathRepo,
      modelShapeMemberCount,
      sourceCommit: source.commit,
    }),
  };
}
