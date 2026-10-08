// The literal configuration OCI artifact of one NIMService variant, and the
// receipt that says it was published.
//
// The artifact follows the certified-bundle shape the Catalog already
// publishes for Helm entries (scripts/publish-certified-bundles.mjs): one
// tar+gzip layer under the artifact type
// application/vnd.confighub.config.bundle.v1, with the exact objects at the
// root and the route files under routes/. It holds the variant's retained
// sample file and its two route files, and nothing else. No image and no model
// weight is read, and neither could be: every staged path is a committed YAML
// file named by the entry.
//
// Everything here is built in this process from committed bytes. The tar, the
// gzip container and the manifest are written byte by byte, so the digests are
// the same on every machine and with every tool version. Nothing in this
// module contacts a registry. scripts/publish-nimservice-variants.mjs does the
// pushing, and only when the maintainer asks.
//
// A variant counts as published only when a tracked receipt exists whose
// digests equal the ones computed here. A receipt for other bytes is refused.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { gunzipSync } from "node:zlib";

import { check, readYamlText, repoRoot, serializeYaml, trackedExists } from "./proof-common.mjs";

export const NIMSERVICE_BUNDLE_REGISTRY = "europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles";
export const NIMSERVICE_BUNDLE_ARTIFACT_TYPE = "application/vnd.confighub.config.bundle.v1";
export const NIMSERVICE_BUNDLE_LAYER_TYPE = "application/vnd.oci.image.layer.v1.tar+gzip";
export const NIMSERVICE_PUBLICATION_RECEIPT_KIND = "NimServiceVariantPublicationReceipt";
export const NIMSERVICE_PUBLICATION_PLAN_KIND = "NimServiceVariantLiteralConfigPlan";
export const NIMSERVICE_PUBLICATION_RECEIPT_ROOT = "runs/nimservice-variants";
export const NIMSERVICE_PUBLICATION_PLAN_FILE = "literal-config-oci.yaml";
export const NIMSERVICE_PUBLISHED_STATUS = "published-with-receipt";
// The artifact is small text. A staged file above this size is not a sample or
// a route file, and the build refuses it.
export const NIMSERVICE_STAGED_FILE_MAX_BYTES = 256 * 1024;

const OCI_MANIFEST_TYPE = "application/vnd.oci.image.manifest.v1+json";
const OCI_EMPTY_CONFIG_TYPE = "application/vnd.oci.empty.v1+json";
const OCI_EMPTY_CONFIG = Buffer.from("{}");
const CREATED_ANNOTATION = "1970-01-01T00:00:00Z";

// One spelling of a value whatever order its keys were written or read in. A
// receipt is written as YAML and read back with its keys sorted, so a plain
// JSON comparison of the two would call a faithful receipt different.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");
const digestOf = (data) => `sha256:${sha256Hex(data)}`;

export function nimServicePublicationReceiptRel(recordName) {
  return `${NIMSERVICE_PUBLICATION_RECEIPT_ROOT}/${recordName}/publication-receipt.yaml`;
}

export function nimServicePublicationPlanRel(entry) {
  return `${entry.entryRel.replace(/\/[^/]+$/, "")}/${NIMSERVICE_PUBLICATION_PLAN_FILE}`;
}

// --- tar, gzip and manifest, written byte by byte -------------------------

function tarHeader(name, size) {
  check(Buffer.byteLength(name) <= 100, `the staged path ${name} is longer than a ustar name field`);
  const header = Buffer.alloc(512, 0);
  const field = (text, offset, length) => header.write(text, offset, length, "latin1");
  field(name, 0, 100);
  field("0000644\0", 100, 8);
  field("0000000\0", 108, 8);
  field("0000000\0", 116, 8);
  field(`${size.toString(8).padStart(11, "0")}\0`, 124, 12);
  field("00000000000\0", 136, 12);
  field("        ", 148, 8);
  field("0", 156, 1);
  field("ustar\0", 257, 6);
  field("00", 263, 2);
  let sum = 0;
  for (const byte of header) sum += byte;
  field(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return header;
}

// A ustar archive of the given files, in path order, owned by 0:0 at time 0.
export function deterministicTar(files) {
  const parts = [];
  for (const file of [...files].sort((left, right) => (left.path < right.path ? -1 : 1))) {
    parts.push(tarHeader(`./${file.path}`, file.data.length), file.data);
    const padding = (512 - (file.data.length % 512)) % 512;
    if (padding > 0) parts.push(Buffer.alloc(padding, 0));
  }
  parts.push(Buffer.alloc(1024, 0));
  return Buffer.concat(parts);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

// A gzip container whose deflate stream is stored blocks only. A compressor
// chooses its matches by CPU and by library version, so compressed bytes are
// not the same everywhere. Stored blocks are. The files are a few kilobytes.
export function deterministicGzip(data) {
  const parts = [Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0x03])];
  let offset = 0;
  do {
    const length = Math.min(0xffff, data.length - offset);
    const final = offset + length >= data.length ? 1 : 0;
    const head = Buffer.alloc(5);
    head.writeUInt8(final, 0);
    head.writeUInt16LE(length, 1);
    head.writeUInt16LE(~length & 0xffff, 3);
    parts.push(head, data.subarray(offset, offset + length));
    offset += length;
  } while (offset < data.length);
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(data), 0);
  trailer.writeUInt32LE(data.length >>> 0, 4);
  parts.push(trailer);
  return Buffer.concat(parts);
}

// The files in a layer this module wrote, read back from its bytes.
export function readLayerFiles(layer) {
  const tar = gunzipSync(layer);
  const files = [];
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("latin1").replace(/\0.*$/, "");
    const size = parseInt(header.subarray(124, 135).toString("latin1"), 8);
    files.push({ path: name.replace(/^\.\//, ""), data: Buffer.from(tar.subarray(offset + 512, offset + 512 + size)) });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

// --- the artifact of one variant ------------------------------------------

// The files the artifact holds and where each comes from. This is the whole
// list. A reader that wants to add a file has to change this function.
export function nimServiceStagedSources(entry) {
  return [
    { path: basename(entry.fileRel), source: entry.fileRel, role: "exact objects" },
    { path: `routes/${basename(entry.operatorRouteRel)}`, source: entry.operatorRouteRel, role: "route: operator-first ordering" },
    { path: `routes/${basename(entry.secretRouteRel)}`, source: entry.secretRouteRel, role: "route: user-supplied Secrets" },
  ];
}

// Build the artifact from committed bytes. readText returns the text of a
// repo-relative path, so the generator can pass route files it has just
// rendered and has not yet written.
export function buildNimServiceArtifact(entry, { root = repoRoot, readText } = {}) {
  const read = readText ?? ((rel) => readFileSync(join(root, rel), "utf8"));
  const stagedFiles = nimServiceStagedSources(entry).map((file) => {
    check(/\.ya?ml$/.test(file.source), `${entry.recordName}: the staged file ${file.source} is not a YAML file`);
    const data = Buffer.from(read(file.source), "utf8");
    check(
      data.length > 0 && data.length <= NIMSERVICE_STAGED_FILE_MAX_BYTES,
      `${entry.recordName}: the staged file ${file.source} is ${data.length} bytes, outside what a sample or a route file can be`,
    );
    return { ...file, data, bytes: data.length, sha256: sha256Hex(data) };
  });
  check(
    stagedFiles[0].sha256 === entry.fileSha256,
    `${entry.recordName}: the staged objects are not the retained sample bytes at ${entry.fileRel}`,
  );
  const bundleName = entry.recordName;
  const tag = `upstream-${entry.source.commit.slice(0, 12)}`;
  const repository = `${NIMSERVICE_BUNDLE_REGISTRY}/${bundleName}`;
  const layer = deterministicGzip(deterministicTar(stagedFiles));
  const layerDigest = digestOf(layer);
  const manifest = Buffer.from(JSON.stringify({
    schemaVersion: 2,
    mediaType: OCI_MANIFEST_TYPE,
    artifactType: NIMSERVICE_BUNDLE_ARTIFACT_TYPE,
    config: { mediaType: OCI_EMPTY_CONFIG_TYPE, digest: digestOf(OCI_EMPTY_CONFIG), size: OCI_EMPTY_CONFIG.length },
    layers: [{
      mediaType: NIMSERVICE_BUNDLE_LAYER_TYPE,
      digest: layerDigest,
      size: layer.length,
      annotations: { "org.opencontainers.image.title": `${bundleName}.tar.gz` },
    }],
    annotations: { "org.opencontainers.image.created": CREATED_ANNOTATION },
  }));
  const manifestDigest = digestOf(manifest);
  return {
    recordName: entry.recordName,
    slug: entry.slug,
    bundleName,
    tag,
    repository,
    reference: `${repository}:${tag}`,
    immutableReference: `${repository}@${manifestDigest}`,
    artifactType: NIMSERVICE_BUNDLE_ARTIFACT_TYPE,
    stagedFiles,
    layer,
    layerDigest,
    layerBytes: layer.length,
    manifest,
    manifestDigest,
    objectSetSha256: `sha256:${entry.objectSetSha256}`,
    sourceFileSha256: `sha256:${entry.fileSha256}`,
    receiptRel: nimServicePublicationReceiptRel(entry.recordName),
    planRel: nimServicePublicationPlanRel(entry),
  };
}

const stagedRows = (artifact) => artifact.stagedFiles.map((file) => ({
  path: file.path,
  source: file.source,
  role: file.role,
  sha256: `sha256:${file.sha256}`,
  bytes: file.bytes,
}));

// The committed statement of what would be pushed. It is generated beside the
// entry's other files, so the local digest is on record before any push and
// the publisher can refuse bytes that differ from it.
export function nimServicePublicationPlanDoc(entry, artifact) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: NIMSERVICE_PUBLICATION_PLAN_KIND,
    metadata: { name: entry.recordName },
    spec: {
      catalogEntry: "nimservice",
      variant: entry.slug,
      artifactType: artifact.artifactType,
      plannedReference: artifact.reference,
      manifestDigest: artifact.manifestDigest,
      layerDigest: artifact.layerDigest,
      layerBytes: artifact.layerBytes,
      layerMediaType: NIMSERVICE_BUNDLE_LAYER_TYPE,
      objectSetSha256: artifact.objectSetSha256,
      stagedFiles: stagedRows(artifact),
      contents: {
        statement: "The artifact holds the retained sample file and its two route files. It holds no container image, no model weight and no Secret value.",
        nvidiaImagesOrWeights: false,
        secretValues: false,
      },
      publication: {
        receipt: artifact.receiptRel,
        rule: "The variant is published only when that receipt is tracked and its digests equal the ones in this file. This file does not say whether it is.",
        publisher: "scripts/publish-nimservice-variants.mjs",
      },
    },
  };
}

// The layout a registry copy reads. The blobs are the bytes built above, so
// the pushed manifest digest is the one already on record.
export function writeNimServiceOciLayout(artifact, dir) {
  mkdirSync(join(dir, "blobs", "sha256"), { recursive: true });
  const blob = (data) => writeFileSync(join(dir, "blobs", "sha256", sha256Hex(data)), data);
  blob(OCI_EMPTY_CONFIG);
  blob(artifact.layer);
  blob(artifact.manifest);
  writeFileSync(join(dir, "oci-layout"), JSON.stringify({ imageLayoutVersion: "1.0.0" }));
  writeFileSync(join(dir, "index.json"), JSON.stringify({
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.index.v1+json",
    manifests: [{
      mediaType: OCI_MANIFEST_TYPE,
      digest: artifact.manifestDigest,
      size: artifact.manifest.length,
      annotations: { "org.opencontainers.image.ref.name": artifact.tag },
    }],
  }));
  return `${dir}:${artifact.tag}`;
}

export function nimServicePublicationReceiptDoc(artifact, { observedAt, pushCommand, anonymousPull }) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: NIMSERVICE_PUBLICATION_RECEIPT_KIND,
    metadata: { name: artifact.recordName },
    spec: {
      plan: artifact.planRel,
      reference: artifact.reference,
      immutableReference: artifact.immutableReference,
      artifactType: artifact.artifactType,
      manifestDigest: artifact.manifestDigest,
      layerDigest: artifact.layerDigest,
      layerBytes: artifact.layerBytes,
      objectSetSha256: artifact.objectSetSha256,
      sourceFileSha256: artifact.sourceFileSha256,
      stagedFiles: stagedRows(artifact),
      contents: { nvidiaImagesOrWeights: false, secretValues: false },
      push: { result: "pass", command: pushCommand },
      anonymousPull,
      signature: "none. The Catalog does not sign certified configuration bundles.",
      observedAt,
    },
    status: { result: "pass" },
  };
}

// Every way a receipt can fail to be the receipt of this artifact. An empty
// list means the receipt records a push and an anonymous pull of these bytes.
export function nimServicePublicationProblems(receipt, artifact) {
  const problems = [];
  const expect = (condition, message) => { if (!condition) problems.push(message); };
  const spec = receipt?.spec ?? {};
  expect(receipt?.kind === NIMSERVICE_PUBLICATION_RECEIPT_KIND, `it is not a ${NIMSERVICE_PUBLICATION_RECEIPT_KIND}`);
  expect(receipt?.metadata?.name === artifact.recordName, `it names ${receipt?.metadata?.name ?? "nothing"} and not ${artifact.recordName}`);
  expect(spec.manifestDigest === artifact.manifestDigest, `its manifest digest is ${spec.manifestDigest ?? "missing"}, and the committed bytes build ${artifact.manifestDigest}`);
  expect(spec.layerDigest === artifact.layerDigest && spec.layerBytes === artifact.layerBytes, `its layer is ${spec.layerDigest ?? "missing"}, and the committed bytes build ${artifact.layerDigest}`);
  expect(spec.reference === artifact.reference, `its reference is ${spec.reference ?? "missing"} and not ${artifact.reference}`);
  expect(spec.immutableReference === artifact.immutableReference, "its immutable reference does not pin the manifest digest");
  expect(spec.artifactType === artifact.artifactType, `its artifact type is ${spec.artifactType ?? "missing"}`);
  expect(spec.objectSetSha256 === artifact.objectSetSha256 && spec.sourceFileSha256 === artifact.sourceFileSha256, "its object-set or source-file digest is not the retained sample's");
  expect(canonical(spec.stagedFiles ?? []) === canonical(stagedRows(artifact)), "its staged files are not the sample and the two route files this variant has now");
  expect(spec.contents?.nvidiaImagesOrWeights === false && spec.contents?.secretValues === false, "it does not say the artifact holds no NVIDIA image, no weight and no Secret value");
  expect(spec.push?.result === "pass", "it records no passing push");
  const pull = spec.anonymousPull ?? {};
  expect(
    pull.result === "pass"
      && pull.manifestDigest === artifact.manifestDigest
      && pull.layerDigest === artifact.layerDigest
      && pull.filesMatched === artifact.stagedFiles.length,
    "it records no anonymous pull of this manifest that returned these files",
  );
  expect(/^\d{4}-\d{2}-\d{2}T/.test(String(spec.observedAt ?? "")), "it does not say when the pull was observed");
  expect(receipt?.status?.result === "pass", "its result is not pass");
  return problems;
}

// The publication state of one variant. A receipt counts only when Git tracks
// it, because runs/ is ignored and an untracked receipt never reaches a pull
// request. A tracked receipt that does not match the committed bytes is an
// error and not a quiet "not published".
export function loadNimServicePublication(entry, { root = repoRoot, artifact = buildNimServiceArtifact(entry, { root }) } = {}) {
  const receiptRel = artifact.receiptRel;
  const receiptPath = join(root, receiptRel);
  if (!existsSync(receiptPath) || !trackedExists(receiptPath)) return { published: false, artifact, receiptRel };
  const text = readFileSync(receiptPath, "utf8");
  const receipt = readYamlText(text);
  const problems = nimServicePublicationProblems(receipt, artifact);
  check(
    problems.length === 0,
    `${receiptRel} is not a valid publication receipt for ${artifact.recordName}: ${problems.join("; ")}. Publish these bytes again or remove the receipt`,
  );
  return {
    published: true,
    artifact,
    receipt,
    receiptRel,
    receiptSha256: digestOf(text),
    observedReference: `oci://${artifact.reference}@${artifact.manifestDigest}`,
  };
}

// What delivery.literalConfigOci of a NIMService record must be. The record
// builder writes this object and the guards compare against it, so a record
// can say published only with the reference, digests and receipt of a valid
// publication, and must say not published without one.
export const NIMSERVICE_NOT_PUBLISHED_NOTE = "This variant has not been packaged or pushed as a literal configuration OCI.";
export function expectedNimServiceLiteralConfigOci(publication) {
  if (!publication?.published) return { status: "not-published", note: NIMSERVICE_NOT_PUBLISHED_NOTE };
  const artifact = publication.artifact;
  return {
    status: NIMSERVICE_PUBLISHED_STATUS,
    observedReference: publication.observedReference,
    manifestDigest: artifact.manifestDigest,
    layerDigest: artifact.layerDigest,
    objectSetSha256: artifact.objectSetSha256,
    receipt: publication.receiptRel,
    receiptSha256: publication.receiptSha256,
    plan: artifact.planRel,
    routes: artifact.stagedFiles
      .filter((file) => file.role.startsWith("route:"))
      .map((file) => ({ path: file.source, sha256: `sha256:${file.sha256}`, role: file.role })),
    note: "The artifact holds the exact objects and the two route files, and an anonymous pull returned them. No route has been executed, and no NVIDIA image or weight is in it.",
  };
}

// The same rule as one sentence of refusal, or an empty string when the
// record's literalConfigOci is exactly what the publication state allows.
export function nimServiceLiteralConfigOciProblem(name, actual, publication) {
  const expected = expectedNimServiceLiteralConfigOci(publication);
  if (canonical(actual ?? {}) === canonical(expected)) return "";
  if (publication?.published) {
    return `${name}: ${publication.receiptRel} records a publication of ${publication.artifact.manifestDigest}, and delivery.literalConfigOci does not carry exactly that reference, those digests and that receipt`;
  }
  return `${name}: delivery.literalConfigOci says ${actual?.status ?? "nothing"}${actual?.manifestDigest ? ` with ${actual.manifestDigest}` : ""}, and no tracked publication receipt for ${publication?.artifact?.manifestDigest ?? "this variant"} exists at ${publication?.receiptRel ?? "runs/nimservice-variants"}`;
}

export { serializeYaml as serializeNimServiceYaml };
