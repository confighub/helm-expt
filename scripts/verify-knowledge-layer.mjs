#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

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

if (wikiFiles.length < 5 || wikiFiles.length > 8) {
  fail(`expected 5-8 seed wiki pages, found ${wikiFiles.length}`);
}

for (const name of wikiFiles) {
  const path = join(wikiRoot, name);
  const text = read(path);
  const link = `./wiki/${name}`;
  if (!index.includes(`](${link})`)) fail(`knowledge/index.md does not list ${link}`);
  if (!/^---\n[\s\S]*?\n---\n/.test(text)) fail(`${rel(path)} is missing front matter`);
  for (const field of ["title:", "status:", "last_reviewed:"]) {
    if (!text.slice(0, 300).includes(field)) fail(`${rel(path)} front matter missing ${field}`);
  }
  if (!/^# /m.test(text)) fail(`${rel(path)} is missing an H1`);
  if (!text.includes("## Authoritative Sources")) fail(`${rel(path)} missing Authoritative Sources section`);
}

const indexedPages = [...index.matchAll(/\]\(\.\/wiki\/([^)]+\.md)\)/g)].map((match) => match[1]).sort();
const missingFiles = indexedPages.filter((name) => !wikiFiles.includes(name));
if (missingFiles.length) fail(`knowledge/index.md lists missing wiki pages: ${missingFiles.join(", ")}`);

console.log(`verified knowledge layer: ${wikiFiles.length} wiki page(s)`);

