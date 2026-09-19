#!/usr/bin/env node
// Every container image the catalog's retained objects name, read from those objects
// and nothing else. A listing already says what an entry installs; this says what it
// would run, and whether each image is named by a digest or by a tag that can move.
//
// The read is offline and deterministic: the rendered object sets are committed, so
// this makes no network call and resolves no digest. What a tag answers to today is a
// live question, and `cub config check --images` is the tool that asks it.
//
// Usage:
//   node scripts/generate-catalog-images.mjs --generate
//   node scripts/generate-catalog-images.mjs --verify
//   node scripts/generate-catalog-images.mjs --self-test

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { check, readYamlText, repoRoot, trackedExists, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-catalog-images.mjs --generate
  node scripts/generate-catalog-images.mjs --verify
  node scripts/generate-catalog-images.mjs --self-test`);
  process.exit(2);
}

const catalogFile = "data/base-variant-records/records.json";
const outputFiles = {
  json: "data/catalog-images/images.json",
  csv: "data/catalog-images/images.csv",
  md: "data/catalog-images/summary.md",
};

// A reference is a registry path, optionally a tag, optionally a digest. Anything with
// a space, a template brace or a newline is some other string that happens to sit under
// an "image" key, and is left alone.
const REFERENCE = /^[a-z0-9][a-z0-9._:\-/]*(?:@sha256:[0-9a-f]{64})?$/;

export function isReference(value) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text.length > 300) return false;
  if (!REFERENCE.test(text)) return false;
  // A bare word is a name in some other sense; an image names a repository or a tag.
  return text.includes("/") || text.includes(":");
}

// Images sit under containers, initContainers and ephemeralContainers, and also
// directly on custom resources such as Prometheus and Alertmanager. Walking for the
// key rather than the shape finds both, and the reference test keeps the rest out.
export function imagesIn(node, found = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) imagesIn(item, found);
    return found;
  }
  if (!node || typeof node !== "object") return found;
  for (const [key, value] of Object.entries(node)) {
    if (key === "image" && isReference(value)) found.add(value.trim());
    else imagesIn(value, found);
  }
  return found;
}

export function pinned(reference) {
  return reference.includes("@sha256:");
}

function objectsPathFor(record) {
  const path = record.spec?.configuration?.objects;
  if (!path) return null;
  const full = join(repoRoot, path);
  if (!existsSync(full) || statSync(full).isDirectory()) return null;
  return path;
}

function buildRows() {
  const catalog = JSON.parse(readFileSync(join(repoRoot, catalogFile), "utf8"));
  const records = catalog.records ?? [];
  check(records.length > 0, "the base variant record index contains no records");
  const rows = [];
  for (const record of records) {
    const id = record.metadata?.name ?? "";
    const path = objectsPathFor(record);
    if (!path || !trackedExists(join(repoRoot, path))) {
      rows.push({ id, objects: path ?? null, read: false, images: [] });
      continue;
    }
    const docs = readYamlText(readFileSync(join(repoRoot, path), "utf8"));
    const found = [...imagesIn(docs)].sort();
    rows.push({
      id,
      objects: path,
      read: true,
      images: found.map((reference) => ({ reference, pinned: pinned(reference) })),
    });
  }
  return rows;
}

function buildOutputs(rows) {
  const read = rows.filter((row) => row.read);
  const all = read.flatMap((row) => row.images);
  const distinct = new Set(all.map((image) => image.reference));
  const summary = {
    entries: rows.length,
    entriesRead: read.length,
    entriesWithoutRetainedObjects: rows.length - read.length,
    imageReferences: all.length,
    distinctImages: distinct.size,
    pinnedByDigest: all.filter((image) => image.pinned).length,
    namedByTag: all.filter((image) => !image.pinned).length,
  };
  const json = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "CatalogImageIndex",
    source: catalogFile,
    method:
      "Read from each entry's committed rendered objects: every image key whose value is a registry reference, under containers, initContainers, ephemeralContainers or a custom resource.",
    boundary:
      "What the objects name, not what a registry holds. A tag can answer to different bytes later, and this index resolves nothing; cub config check --images asks the registry.",
    summary,
    entries: rows,
  };
  const csv = [
    "entry,image,pinned",
    ...rows.flatMap((row) => row.images.map((image) => `${row.id},${image.reference},${image.pinned ? "digest" : "tag"}`)),
  ].join("\n");
  const worst = rows
    .filter((row) => row.images.some((image) => !image.pinned))
    .sort((left, right) => right.images.length - left.images.length)
    .slice(0, 10);
  const md = [
    "# Container images in the catalog",
    "",
    `Read from the committed rendered objects of ${summary.entriesRead} of ${summary.entries} entries. ${summary.entriesWithoutRetainedObjects} entry(s) retain no single object file to read.`,
    "",
    `- ${summary.distinctImages} distinct images across ${summary.imageReferences} references.`,
    `- ${summary.pinnedByDigest} references are pinned by digest.`,
    `- ${summary.namedByTag} are named by a tag, which can answer to different bytes later.`,
    "",
    "This index says what the objects name. It resolves nothing: `cub config check <file> --images` asks the registry what a tag answers to now.",
    "",
    "## The entries naming the most images by tag",
    "",
    "| Entry | Images | By tag |",
    "| --- | ---: | ---: |",
    ...worst.map((row) => `| ${row.id} | ${row.images.length} | ${row.images.filter((image) => !image.pinned).length} |`),
    "",
  ].join("\n");
  return { [outputFiles.json]: `${JSON.stringify(json, null, 2)}\n`, [outputFiles.csv]: `${csv}\n`, [outputFiles.md]: md };
}

function selfTest() {
  check(isReference("bitnami/redis:latest"), "a tagged reference is an image");
  check(isReference("ghcr.io/team/app@sha256:" + "a".repeat(64)), "a digest reference is an image");
  check(!isReference("{{ .Values.image }}"), "a template is not an image");
  check(!isReference("a picture of a cat"), "prose is not an image");
  check(!isReference("nginx"), "a bare word is not an image reference");
  check(pinned("x/y@sha256:" + "0".repeat(64)) && !pinned("x/y:1.2.3"), "pinned reads the digest");
  const doc = [
    { kind: "Deployment", spec: { template: { spec: { initContainers: [{ image: "busybox:1.36" }], containers: [{ image: "app:1" }] } } } },
    { kind: "Prometheus", spec: { image: "quay.io/prometheus/prometheus:v3.0.0" } },
    { kind: "ConfigMap", data: { dashboard: "{\"image\": \"not a reference at all\"}" } },
  ];
  const found = [...imagesIn(doc)].sort();
  check(
    JSON.stringify(found) === JSON.stringify(["app:1", "busybox:1.36", "quay.io/prometheus/prometheus:v3.0.0"]),
    `walked images should be the three real ones, got ${JSON.stringify(found)}`,
  );
  console.log("catalog image index self-test passed: reference shape, digest pinning, and the walk");
}

if (mode === "--self-test") {
  selfTest();
} else {
  const outputs = buildOutputs(buildRows());
  if (mode === "--generate") {
    for (const [file, text] of Object.entries(outputs)) {
      write(join(repoRoot, file), text);
      console.log(`wrote ${file}`);
    }
  } else {
    for (const [file, text] of Object.entries(outputs)) {
      check(
        readFileSync(join(repoRoot, file), "utf8") === text,
        `${file} is stale; run node scripts/generate-catalog-images.mjs --generate`,
      );
    }
    const index = JSON.parse(outputs[outputFiles.json]);
    console.log(
      `verified the catalog image index: ${index.summary.distinctImages} distinct image(s), ${index.summary.pinnedByDigest} pinned by digest, ${index.summary.namedByTag} named by tag`,
    );
  }
}
