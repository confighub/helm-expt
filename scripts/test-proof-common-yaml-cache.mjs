import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createBoundedTextCache } from "./lib/bounded-text-cache.mjs";
import { readYaml, readYamlFiles, readYamlText, readYamlTexts, repoRoot } from "./lib/proof-common.mjs";

const semanticInputs = [
  "",
  "value: true\ncount: 7\nratio: 1.5\n",
  "value: first\n---\nvalue: second\n",
  "base: &base\n  enabled: true\ncopy: *base\n",
  "value: !!value x\n",
];
const freshProofCommon = await import(`./lib/proof-common.mjs?fresh=${Date.now()}`);
const baseline = semanticInputs.map((text) => freshProofCommon.readYamlText(text));
const batched = readYamlTexts(semanticInputs, { maxItems: 2, maxBytes: 20 });
assert.deepStrictEqual(batched, baseline);
assert.throws(() => readYamlTexts([], { maxItems: 0 }));
assert.throws(() => readYamlTexts([], { maxBytes: 0 }));
assert.throws(() => readYamlTexts([], { maxItems: Infinity }));
assert.throws(() => readYamlTexts([], { maxBytes: -1 }));
const oversized = "value: " + "x".repeat(100) + "\n";
assert.deepStrictEqual(readYamlTexts([oversized], { maxBytes: 1 }), [freshProofCommon.readYamlText(oversized)]);
const duplicateBatch = readYamlTexts(["items: [one]\n", "items: [one]\n"]);
duplicateBatch[0].items.push("mutated");
assert.deepStrictEqual(duplicateBatch[1], { items: ["one"] });
const duplicateNegativeZero = readYamlTexts(["value: -0.0\n", "value: -0.0\n"]);
assert(Object.is(duplicateNegativeZero[0].value, -0));
assert(Object.is(duplicateNegativeZero[1].value, -0));
assert.throws(() => readYamlTexts(["!!python/object/apply:os.system ['echo unsafe']\n"]));
assert.throws(() => readYamlTexts(["value: [unterminated"]));
const changedPath = mkdtempSync(join(tmpdir(), "helm-expt-yaml-batch-"));
try {
  const firstPath = join(changedPath, "input.yaml");
  const originalMtime = new Date("2020-01-01T00:00:00Z");
  writeFileSync(firstPath, "value: old\n");
  utimesSync(firstPath, originalMtime, originalMtime);
  const firstBatch = readYamlFiles([firstPath]);
  writeFileSync(firstPath, "value: new\n");
  utimesSync(firstPath, originalMtime, originalMtime);
  const secondBatch = readYamlFiles([firstPath]);
  assert.deepStrictEqual(firstBatch.get(firstPath), { value: "old" });
  assert.deepStrictEqual(secondBatch.get(firstPath), { value: "new" });
} finally {
  rmSync(changedPath, { recursive: true, force: true });
}

const first = readYamlText("value: 1\nitems:\n  - one\n");
const second = readYamlText("value: 1\nitems:\n  - one\n");
assert.notStrictEqual(first, second);
first.items.push("mutated");
assert.deepStrictEqual(second, { value: 1, items: ["one"] });
const third = readYamlText("value: 1\nitems:\n  - one\n");
assert.deepStrictEqual(third, { value: 1, items: ["one"] });
const negativeZero = readYamlText("value: -0.0\nnested:\n  - -0.0\n");
const repeatedNegativeZero = readYamlText("value: -0.0\nnested:\n  - -0.0\n");
assert(Object.is(negativeZero.value, -0));
assert(Object.is(negativeZero.nested[0], -0));
assert(Object.is(repeatedNegativeZero.value, -0));
assert(Object.is(repeatedNegativeZero.nested[0], -0));
assert.throws(() => readYamlText("value: [unterminated"));

const root = mkdtempSync(join(tmpdir(), "helm-expt-yaml-cache-"));
try {
  const path = join(root, "input.yaml");
  writeFileSync(path, "value: old\n");
  const originalMtime = new Date("2020-01-01T00:00:00Z");
  utimesSync(path, originalMtime, originalMtime);
  assert.deepStrictEqual(readYaml(path), { value: "old" });
  writeFileSync(path, "value: new\n");
  utimesSync(path, originalMtime, originalMtime);
  assert.deepStrictEqual(readYaml(path), { value: "new" });
} finally {
  rmSync(root, { recursive: true, force: true });
}

let parseCount = 0;
const cache = createBoundedTextCache({ maxEntries: 2, maxBytes: 30 });
const parse = (text) => {
  parseCount += 1;
  if (text === "invalid") throw new Error("invalid input");
  return { text };
};
assert.deepStrictEqual(cache.get("a", () => parse("a")), { text: "a" });
assert.deepStrictEqual(cache.get("a", () => parse("a")), { text: "a" });
assert.equal(parseCount, 1);
assert.throws(() => cache.get("invalid", () => parse("invalid")), /invalid input/);
assert.throws(() => cache.get("invalid", () => parse("invalid")), /invalid input/);
assert.equal(parseCount, 3);
cache.get(Buffer.from("bytes"), () => parse("bytes"));
cache.get(Buffer.from("bytes"), () => parse("bytes"));
assert.equal(parseCount, 5);
cache.get("b", () => parse("b"));
cache.get("c", () => parse("c"));
assert.equal(cache.size, 2);
assert(cache.bytes <= 30);
cache.get("a", () => parse("a"));
assert.equal(parseCount, 8);
const large = "x".repeat(21);
cache.get(large, () => parse(large));
cache.get(large, () => parse(large));
assert.equal(parseCount, 10);

let budgetParseCount = 0;
const budgetCache = createBoundedTextCache({ maxEntries: 10, maxBytes: 30 });
const parseBudget = (text) => {
  budgetParseCount += 1;
  return { text };
};
budgetCache.get("aaaaa", () => parseBudget("aaaaa"));
budgetCache.get("bbbbb", () => parseBudget("bbbbb"));
assert.equal(budgetCache.size, 1);
assert(budgetCache.bytes <= 30);
budgetCache.get("aaaaa", () => parseBudget("aaaaa"));
assert.equal(budgetParseCount, 3);

const reviewSelfTest = spawnSync(process.execPath, ["scripts/run-catalog-promotion-review.mjs", "--self-test"], {
  cwd: repoRoot, encoding: "utf8",
});
assert.equal(reviewSelfTest.status, 0, reviewSelfTest.stderr || reviewSelfTest.stdout);

console.log("verified bounded YAML text cache: fresh values, current bytes, failed parses, eviction, and size bounds");
