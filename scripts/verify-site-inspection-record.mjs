#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot } from "./lib/proof-common.mjs";

const name = "bitnami-redis-25-5-3-default";
const recordPath = join(repoRoot, "site/records", `${name}.json`);
const chartPath = join(repoRoot, "site/charts/bitnami-redis-25-5-3.html");

const lookup = spawnSync(process.execPath, ["scripts/lookup-catalog-record.mjs", "--name", name], {
  cwd: repoRoot,
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 32,
});

check(!lookup.error, `cannot run lookup-catalog-record: ${lookup.error?.message ?? "unknown error"}`);
check(lookup.status === 0, `lookup-catalog-record failed: ${lookup.stderr.trim() || lookup.stdout.trim() || `exit ${lookup.status}`}`);

let expected;
let published;
try {
  expected = JSON.parse(lookup.stdout);
} catch {
  throw new Error("lookup-catalog-record did not return JSON");
}
try {
  published = JSON.parse(readFileSync(recordPath, "utf8"));
} catch {
  throw new Error(`cannot parse published inspection record: ${recordPath}`);
}

assert.deepStrictEqual(
  published,
  expected,
  "published inspection record must be the complete CatalogRecordLookup envelope returned by lookup-catalog-record",
);

const chartHtml = readFileSync(chartPath, "utf8");
const anchors = [...chartHtml.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)];
const recordAnchor = anchors.find(([anchor]) => {
  const href = /\bhref\s*=\s*(["'])\.\.\/records\/bitnami-redis-25-5-3-default\.json\1/i.test(anchor);
  const download = /\bdownload\s*=\s*(["'])record\.json\1/i.test(anchor);
  return href && download;
});
check(recordAnchor, "Redis chart must contain one record.json download anchor for its static inspection record");

function visibleText(fragment) {
  return fragment
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const guidance = [...chartHtml.matchAll(/<(?:p|li|dd)\b[^>]*>[\s\S]*?<\/(?:p|li|dd)>/gi)]
  .map(([element]) => visibleText(element))
  .find((text) => text.includes("data/base-variant-records/records.json")
    && text.includes("The Catalog hash identifies the record index, not the chart README."));
check(guidance, "Redis chart must visibly distinguish the records.json Catalog identity from the chart README");

console.log("site inspection record verified: exact lookup envelope, download anchor, and Catalog identity guidance");
