import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createBoundedTextCache } from "./lib/bounded-text-cache.mjs";
import { readYaml, readYamlText } from "./lib/proof-common.mjs";

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

console.log("verified bounded YAML text cache: fresh values, current bytes, failed parses, eviction, and size bounds");
