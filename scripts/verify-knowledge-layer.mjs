#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import assert from "node:assert/strict";
import { py } from "./lib/proof-common.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const knowledgeRoot = join(repoRoot, "knowledge");
const wikiRoot = join(knowledgeRoot, "wiki");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(path) {
  return readFileSync(path, "utf8");
}

function rel(path) {
  return relative(repoRoot, path).split("/").join("/");
}

for (const required of ["SCHEMA.md", "index.md", "log.md"]) {
  const path = join(knowledgeRoot, required);
  if (!existsSync(path)) fail(`missing ${rel(path)}`);
}

const schema = read(join(knowledgeRoot, "SCHEMA.md"));
for (const required of ["Authority Order", "Page Shape", "Index Rules", "Log Rules", "Freshness Rules"]) {
  if (!schema.includes(`## ${required}`)) fail(`knowledge/SCHEMA.md missing section: ${required}`);
}

const index = read(join(knowledgeRoot, "index.md"));
const log = read(join(knowledgeRoot, "log.md"));
if (!log.includes("## [")) fail("knowledge/log.md must contain at least one dated log entry");

const wikiFiles = readdirSync(wikiRoot)
  .filter((name) => name.endsWith(".md"))
  .sort();

if (wikiFiles.length < 5) fail(`expected at least 5 wiki pages, found ${wikiFiles.length}`);

const families = new Set(["rendered-manifests", "oci-sources", "d2-stacks", "app-of-apps", "overlays", "image-automation", "fleets", "helm-without-helm"]);
const shapes = new Set(["installer-package", "aicr-per-file", "flux-native-artifact", "none"]);
function validatePattern(front) {
  assert.ok(families.has(front.family), "unknown or missing pattern family");
  assert.ok(Array.isArray(front.shapes) && front.shapes.length && front.shapes.every((shape) => shapes.has(shape)), "invalid pattern shapes");
  assert.equal(new Set(front.shapes).size, front.shapes.length, "duplicate pattern shape");
  assert.ok(Array.isArray(front.assumes) && front.assumes.length && front.assumes.every((tag) => typeof tag === "string" && /^[a-z0-9-]+$/.test(tag)), "invalid assumption tags");
  assert.ok(Array.isArray(front.sources) && front.sources.length >= 2 && front.sources.length <= 3, "pattern needs two or three sources");
  for (const source of front.sources) {
    assert.equal(new URL(source.url).protocol, "https:", "source must be an HTTPS URL");
    assert.ok(typeof source.licence === "string" && source.licence.trim(), "source licence missing");
  }
  assert.ok(typeof front.run_with === "string" && front.run_with.trim() && !front.run_with.includes("\n"), "run_with must be one nonempty line");
}
const valid = { family: "oci-sources", shapes: ["flux-native-artifact"], assumes: ["registry"], sources: [{ url: "https://example.com/one", licence: "Apache-2.0" }, { url: "https://example.com/two", licence: "Apache-2.0" }], run_with: "example command" };
validatePattern(valid);
for (const changed of [{ family: "unknown" }, { shapes: ["unknown"] }, { shapes: [] }, { assumes: "registry" }, { sources: [] }, { sources: [{ url: "https://example.com/one", license: "Apache-2.0" }, valid.sources[1]] }, { run_with: "" }]) {
  assert.throws(() => validatePattern({ ...valid, ...changed }));
}
const seenFamilies = new Set();

for (const name of wikiFiles) {
  const path = join(wikiRoot, name);
  const text = read(path);
  const link = `./wiki/${name}`;
  if (!index.includes(`](${link})`)) fail(`knowledge/index.md does not list ${link}`);
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) fail(`${rel(path)} is missing front matter`);
  const front = py("import json, sys, yaml\nprint(json.dumps(yaml.load(sys.stdin.read(), Loader=yaml.BaseLoader)))", match[1]);
  if (!front || typeof front !== "object") fail(`${rel(path)} front matter must be a mapping`);
  if (typeof front.title !== "string" || !front.title.trim()) fail(`${rel(path)} missing title`);
  if (!["current", "draft", "needs-refresh"].includes(front.status)) fail(`${rel(path)} invalid status`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(front.last_reviewed ?? "")) fail(`${rel(path)} invalid last_reviewed`);
  if (front.family || (name.startsWith("delivery-") && name !== "delivery-patterns.md")) {
    try { validatePattern(front); } catch (error) { fail(`${rel(path)}: ${error.message}`); }
    if (seenFamilies.has(front.family)) fail(`duplicate delivery family: ${front.family}`);
    seenFamilies.add(front.family);
  }
  if ([...text.matchAll(/^# /gm)].length !== 1) fail(`${rel(path)} must have exactly one H1`);
  if (!text.includes("## Authoritative Sources")) fail(`${rel(path)} missing Authoritative Sources section`);
}

const indexedPages = [...index.matchAll(/\]\(\.\/wiki\/([^)]+\.md)\)/g)].map((match) => match[1]).sort();
const missingFiles = indexedPages.filter((name) => !wikiFiles.includes(name));
if (missingFiles.length) fail(`knowledge/index.md lists missing wiki pages: ${missingFiles.join(", ")}`);

console.log(`verified knowledge layer: ${wikiFiles.length} wiki page(s)`);

