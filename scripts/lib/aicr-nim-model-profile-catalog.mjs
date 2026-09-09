// Shared extraction and rendering logic for the NIM model-profile candidate
// catalog: a decision-neutral view over the 16 `role: model-shape` members of
// the kserve-nim-inference entry's digest-bound member index. It answers one
// question per shape, "how ready is this candidate," without deciding
// anything about the shape's own future: whether a shape later becomes its
// own top-level catalog entry, or stays a member surfaced under the KServe
// platform, is a call for a later increment against this table. This module
// adds no register entry, changes no catalog count, and writes no website
// surface; it is a derived view over files this repository already commits.
//
// The generator and the verifier both call this module, so they cannot
// disagree the way a generator that drifted from its verifier could.
// Everything here reads committed bytes only: no network, no cluster, no NGC
// contact, and no wall-clock time enters the output.
//
// Retained sha256 choice: each row's `retainedSha256` is the digest index
// member's own `payloadSha256`, read directly from
// examples/aicr/kserve-nim-inference/digest-index/platform-index.json. That
// is the sha256 of the digest index's committed JSON payload wrapper for the
// shape (already pinned and produced by scripts/generate-aicr-digest-index.mjs),
// not a fresh sha256 of the raw upstream YAML recomputed here. Recomputing
// the raw file's sha256 would just duplicate a value the digest index already
// commits and verifies elsewhere; reading it is the same "read committed
// bytes, do not restate them" discipline the rest of this catalog follows.

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { check, readYamlText, relativeRepo, repoRoot } from "./proof-common.mjs";
import { OUTPUT_ROOT, PROFILES_DIR, RECEIPTS_DIR } from "./aicr-nim-model-profiles.mjs";

const ENTRY_DIR = join("examples", "aicr", "kserve-nim-inference");
const PLATFORM = basename(ENTRY_DIR);
const DIGEST_INDEX_PATH = join(ENTRY_DIR, "digest-index", "platform-index.json");
const PRE_EXISTING_PROFILE_PATH = join(ENTRY_DIR, "profile", "model-profile.yaml");

export const CSV_PATH = join(OUTPUT_ROOT, "candidates.csv");
export const MD_PATH = join(OUTPUT_ROOT, "candidates.md");
export const HTML_PATH = join(OUTPUT_ROOT, "candidates.html");

const CSV_HEADERS = [
  "slug",
  "model_family",
  "gpu_profile",
  "gpu_count",
  "image",
  "platform",
  "retained_sha256",
  "role",
  "has_profile_record",
  "has_receipt",
  "terms_read",
];

// A model-shape slug always ends in its GPU profile segment: a digit count,
// a literal "x", then a GPU tag ("gpu" generic, or a product name such as
// "a100"/"h100"). Everything before that segment is the model family. This
// is read out of the slug itself rather than kept in a lookup table, the
// same way the rest of this catalog's lineage prefers deriving over
// restating.
const GPU_PROFILE_PATTERN = /^(.+)-(\d+x[a-z0-9]+)$/i;

function deriveFamilyAndGpuProfile(slug) {
  const match = slug.match(GPU_PROFILE_PATTERN);
  check(match, `model-shape slug does not end in a <count>x<tag> GPU profile segment: ${slug}`);
  const [, modelFamily, gpuProfile] = match;
  return { modelFamily, gpuProfile: gpuProfile.toLowerCase() };
}

function readYamlFile(path) {
  return readYamlText(readFileSync(path, "utf8"));
}

function loadDigestIndex(root) {
  const path = join(root, DIGEST_INDEX_PATH);
  check(existsSync(path), `missing digest index: ${relativeRepo(path)}`);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  check(doc.kind === "AICRPlatformDigestIndex", `${relativeRepo(path)}: expected kind AICRPlatformDigestIndex`);
  const members = doc.spec?.members;
  check(Array.isArray(members) && members.length > 0, `${relativeRepo(path)}: spec.members is missing or empty`);
  return { path, members };
}

// One ClusterServingRuntime file per `role: serving-runtime` member, indexed
// by the file's own metadata.name (not by the member's `component` label),
// because that is the name a shape's spec.predictor.model.runtime field
// actually references.
function buildRuntimeIndex(root, runtimeMembers) {
  const byName = new Map();
  for (const member of runtimeMembers) {
    const path = join(root, ENTRY_DIR, member.sourceFile);
    check(existsSync(path), `missing retained serving-runtime file: ${relativeRepo(path)}`);
    const doc = readYamlFile(path);
    check(
      doc.apiVersion === "serving.kserve.io/v1alpha1" && doc.kind === "ClusterServingRuntime",
      `${relativeRepo(path)}: expected a ClusterServingRuntime`,
    );
    const name = String(doc.metadata?.name ?? "").trim();
    check(name, `${relativeRepo(path)}: metadata.name is missing`);
    const container = (doc.spec?.containers ?? []).find((entry) => entry.name === "kserve-container");
    check(container, `${relativeRepo(path)}: no container named kserve-container`);
    const image = container.image;
    check(typeof image === "string" && image.startsWith("nvcr.io/"), `${relativeRepo(path)}: container image is not an nvcr.io reference`);
    check(!byName.has(name), `two retained serving-runtime files share metadata.name ${name}`);
    byName.set(name, { member, path: relativeRepo(path), image });
  }
  return byName;
}

let cachedPreExistingProfile;
function preExistingProfileDoc(root) {
  if (cachedPreExistingProfile !== undefined) return cachedPreExistingProfile;
  const path = join(root, PRE_EXISTING_PROFILE_PATH);
  cachedPreExistingProfile = existsSync(path) ? { path, doc: readYamlFile(path) } : null;
  return cachedPreExistingProfile;
}

// A shape's readiness gate for `hasProfileRecord` looks in two places: the
// generated profiles directory this catalog's sibling increment writes
// (data/aicr-nim-model-profiles/profiles/<slug>.yaml), and the one
// pre-existing profile the entry shipped with
// (examples/aicr/kserve-nim-inference/profile/model-profile.yaml). Both are
// matched by metadata.name against the shape's own slug, never by a
// hardcoded slug list.
function resolveProfileRecord(root, slug) {
  const generatedPath = join(root, PROFILES_DIR, `${slug}.yaml`);
  if (existsSync(generatedPath)) {
    const doc = readYamlFile(generatedPath);
    check(doc.metadata?.name === slug, `${relativeRepo(generatedPath)}: metadata.name does not match its filename slug`);
    return doc;
  }
  const preExisting = preExistingProfileDoc(root);
  if (preExisting && preExisting.doc.metadata?.name === slug) return preExisting.doc;
  return null;
}

function hasReceiptFor(root, slug) {
  return existsSync(join(root, RECEIPTS_DIR, `${slug}.yaml`));
}

function extractCandidate(root, shapeMember, runtimeIndexByName) {
  const path = join(root, ENTRY_DIR, shapeMember.sourceFile);
  check(existsSync(path), `missing retained model-shape file: ${relativeRepo(path)}`);
  const doc = readYamlFile(path);
  check(
    doc.apiVersion === "serving.kserve.io/v1beta1" && doc.kind === "InferenceService",
    `${relativeRepo(path)}: expected an InferenceService`,
  );

  const slug = doc.metadata?.name;
  check(slug, `${relativeRepo(path)}: metadata.name is missing`);
  check(
    slug === shapeMember.component,
    `${relativeRepo(path)}: metadata.name "${slug}" does not match digest index component "${shapeMember.component}"`,
  );

  const model = doc.spec?.predictor?.model ?? {};
  const runtimeRef = String(model.runtime ?? "").trim();
  check(runtimeRef, `${relativeRepo(path)}: spec.predictor.model.runtime is missing`);

  const limitsGpu = model.resources?.limits?.["nvidia.com/gpu"];
  const requestsGpu = model.resources?.requests?.["nvidia.com/gpu"];
  check(limitsGpu, `${relativeRepo(path)}: resources.limits["nvidia.com/gpu"] is missing`);
  check(requestsGpu, `${relativeRepo(path)}: resources.requests["nvidia.com/gpu"] is missing`);
  check(limitsGpu === requestsGpu, `${relativeRepo(path)}: gpu limit ${limitsGpu} does not equal gpu request ${requestsGpu}`);
  const gpuCount = Number.parseInt(limitsGpu, 10);
  check(Number.isInteger(gpuCount) && gpuCount > 0, `${relativeRepo(path)}: gpu count did not parse to a positive integer`);

  // Resolve the runtime reference to exactly one serving-runtime member by
  // its file's own metadata.name; a Map already enforces the "at most one"
  // half of that (two files sharing a name fail closed in buildRuntimeIndex
  // above), so only the "at least one" half needs asserting here.
  check(
    runtimeIndexByName.has(runtimeRef),
    `${relativeRepo(path)}: runtime "${runtimeRef}" matched 0 serving-runtime member(s), expected exactly one`,
  );
  const runtime = runtimeIndexByName.get(runtimeRef);

  const { modelFamily, gpuProfile } = deriveFamilyAndGpuProfile(slug);
  check(
    Number.parseInt(gpuProfile, 10) === gpuCount,
    `${relativeRepo(path)}: gpu profile "${gpuProfile}" derived from the slug disagrees with gpuCount ${gpuCount}`,
  );

  check(/^[0-9a-f]{64}$/.test(shapeMember.payloadSha256 ?? ""), `digest index member for ${slug} has no valid payloadSha256`);

  const profileDoc = resolveProfileRecord(root, slug);
  const hasProfileRecord = profileDoc !== null;
  const termsRead = hasProfileRecord ? profileDoc.spec?.licensing?.governingTermsReadAt != null : false;
  const hasReceipt = hasReceiptFor(root, slug);

  return {
    slug,
    modelFamily,
    gpuProfile,
    gpuCount,
    image: runtime.image,
    platform: PLATFORM,
    retainedSha256: shapeMember.payloadSha256,
    role: shapeMember.role,
    hasProfileRecord,
    hasReceipt,
    termsRead,
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCamel(header) {
  return header.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function renderCsv(candidates) {
  const rows = candidates.map((candidate) => CSV_HEADERS.map((header) => csvCell(candidate[toCamel(header)])).join(","));
  return `${CSV_HEADERS.join(",")}\n${rows.join("\n")}\n`;
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function renderMarkdown(candidates, counts, digestIndexPathRepo) {
  const rows = candidates.map(
    (candidate) =>
      `| \`${candidate.slug}\` | \`${candidate.modelFamily}\` | \`${candidate.gpuProfile}\` | ${candidate.gpuCount} | \`${candidate.image}\` | ${yesNo(candidate.hasProfileRecord)} | ${yesNo(candidate.hasReceipt)} | ${yesNo(candidate.termsRead)} |`,
  );

  return `# NIM model-shape candidates from the KServe digest index

This is a candidate-and-readiness view over the ${counts.total} candidates
that carry \`role: model-shape\` in the kserve-nim-inference entry's
digest-bound member index, \`${digestIndexPathRepo}\`. It reads each
candidate's source InferenceService and its matched ClusterServingRuntime,
then checks three readiness gates against the files this repository already
commits: whether a model-profile record exists for the shape, whether a
retention receipt exists for it, and whether its governing terms have been
read from NGC.

Of the ${counts.total} candidates, ${counts.profiled} carry a model-profile
record. ${counts.receipted} of those also carry a retention receipt, and
governing terms have been read for ${counts.termsRead} of them. The gradient
is deliberate: a profile record can exist before a receipt backs it, and a
receipt can exist before anyone reads the per-artifact license terms.

This view is decision-neutral. It adds no register entry, creates no catalog
entry, and changes no catalog count. Whether each shape later becomes its own
top-level catalog entry, or stays a member surfaced under the KServe
platform, is a decision for a later increment to make against this table.

## Candidates

| Slug | Model family | GPU profile | GPU count | Image | Profile record | Receipt | Terms read |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Regenerate and verify

\`\`\`sh
npm run aicr-nim-model-profile-catalog:generate
npm run aicr-nim-model-profile-catalog:verify
\`\`\`
`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function gateCell(value) {
  return `<td class="gate ${value ? "yes" : "no"}">${value ? "yes" : "no"}</td>`;
}

function renderHtml(candidates, counts, digestIndexPathRepo) {
  const rows = candidates
    .map(
      (candidate) =>
        `<tr><td><code>${escapeHtml(candidate.slug)}</code></td><td><code>${escapeHtml(candidate.modelFamily)}</code></td><td><code>${escapeHtml(candidate.gpuProfile)}</code></td><td class="n">${candidate.gpuCount}</td><td><code>${escapeHtml(candidate.image)}</code></td>${gateCell(candidate.hasProfileRecord)}${gateCell(candidate.hasReceipt)}${gateCell(candidate.termsRead)}</tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>NIM model-shape candidates</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#1b1f23}h1{font-size:20px}p.note{color:#57606a;font-size:13px;max-width:64em}table{border-collapse:collapse;margin:10px 0;font-size:12.5px}th,td{border:1px solid #d0d7de;padding:5px 9px;text-align:left;vertical-align:top}th{background:#f6f8fa}td.n{text-align:right}td.gate{text-align:center;font-weight:600}td.gate.yes{background:#dafbe1;color:#116329}td.gate.no{background:#f6f8fa;color:#8c959f}footer{margin-top:16px;color:#57606a;font-size:12px}</style></head><body>
<h1>NIM model-shape candidates from the KServe digest index</h1>
<p class="note">A decision-neutral readiness view over the ${counts.total} <code>role: model-shape</code> members of <code>${escapeHtml(digestIndexPathRepo)}</code>. ${counts.profiled} of ${counts.total} carry a model-profile record, ${counts.receipted} of those also carry a retention receipt, and governing terms have been read for ${counts.termsRead} of them. This view adds no register entry and changes no catalog count.</p>
<table><tr><th>Slug</th><th>Model family</th><th>GPU profile</th><th>GPU count</th><th>Image</th><th>Profile record</th><th>Receipt</th><th>Terms read</th></tr>${rows}</table>
<footer>Generated by <code>npm run aicr-nim-model-profile-catalog:generate</code> from committed bytes only; no network, cluster, or NGC contact took part.</footer>
</body></html>
`;
}

// The pure function the generator and the verifier both call. It reads
// committed bytes only under `root` and returns the exact text every output
// file must hold, plus the candidate rows and their gate counts.
export function buildCatalog(root = repoRoot) {
  const { path: digestIndexPath, members } = loadDigestIndex(root);
  const digestIndexPathRepo = relativeRepo(digestIndexPath);

  const shapeMembers = members.filter((member) => member.role === "model-shape");
  const runtimeMembers = members.filter((member) => member.role === "serving-runtime");
  check(shapeMembers.length > 0, `${digestIndexPathRepo}: no role: model-shape members found`);
  check(runtimeMembers.length > 0, `${digestIndexPathRepo}: no role: serving-runtime members found`);

  const runtimeIndexByName = buildRuntimeIndex(root, runtimeMembers);
  const candidates = shapeMembers.map((member) => extractCandidate(root, member, runtimeIndexByName));

  const slugs = new Set();
  for (const candidate of candidates) {
    check(!slugs.has(candidate.slug), `two candidates produced the same slug: ${candidate.slug}`);
    slugs.add(candidate.slug);
  }

  const counts = {
    total: candidates.length,
    profiled: candidates.filter((candidate) => candidate.hasProfileRecord).length,
    receipted: candidates.filter((candidate) => candidate.hasReceipt).length,
    termsRead: candidates.filter((candidate) => candidate.termsRead).length,
  };

  return {
    candidates,
    counts,
    modelShapeMemberCount: shapeMembers.length,
    digestIndexPathRepo,
    csvPath: join(root, CSV_PATH),
    csvText: renderCsv(candidates),
    mdPath: join(root, MD_PATH),
    mdText: renderMarkdown(candidates, counts, digestIndexPathRepo),
    htmlPath: join(root, HTML_PATH),
    htmlText: renderHtml(candidates, counts, digestIndexPathRepo),
  };
}
