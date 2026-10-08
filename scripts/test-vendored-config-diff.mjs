#!/usr/bin/env node
// Runs the browser build of `cub config diff` in Node on fixed pairs of
// retained files and compares each result, field for field, with a committed
// fixture. A fixture is the output of `cub config diff --summary --json` for
// the same pair, so CI checks the vendored code without calling cub.
//
//   node scripts/test-vendored-config-diff.mjs                  fixtures only
//   node scripts/test-vendored-config-diff.mjs --against-cub    also call the installed cub
//   node scripts/test-vendored-config-diff.mjs --write-fixtures rewrite the fixtures from the installed cub
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot } from "./lib/proof-common.mjs";
import { VENDORED_DIFF_FIXTURES, diffConfigFiles, sha256Of } from "./lib/vendored-config-diff.mjs";

const mode = process.argv[2] ?? "";
check(["", "--against-cub", "--write-fixtures"].includes(mode), "usage: test-vendored-config-diff.mjs [--against-cub|--write-fixtures]");
const index = JSON.parse(readFileSync(join(repoRoot, VENDORED_DIFF_FIXTURES, "pairs.json"), "utf8"));
check(index.pairs.length >= 4, "the vendored diff test needs at least four fixed pairs");

// The plugin is local and reads two files. It contacts nothing.
const cubDiff = (pair) => JSON.parse(execFileSync("cub", ["config", "diff", pair.before, pair.after, "--summary", "--json"], {
  cwd: repoRoot,
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 200,
}));

const summaryText = (summary) => `${summary.added} added, ${summary.removed} removed, ${summary.changed} changed, ${summary.unchanged} unchanged`;

for (const pair of index.pairs) {
  const fixturePath = join(repoRoot, VENDORED_DIFF_FIXTURES, pair.fixture);
  if (mode === "--write-fixtures") writeFileSync(fixturePath, `${JSON.stringify(cubDiff(pair), null, 2)}\n`);
  const before = readFileSync(join(repoRoot, pair.before));
  const after = readFileSync(join(repoRoot, pair.after));
  const result = await diffConfigFiles(before, after, true);
  const expected = JSON.parse(readFileSync(fixturePath, "utf8"));
  // deepStrictEqual compares every field, and it tells a missing key from null.
  assert.deepStrictEqual(result, expected, `${pair.name}: the vendored diff differs from its fixture`);
  assert.equal(JSON.stringify(result), JSON.stringify(expected), `${pair.name}: the vendored diff orders its fields differently from its fixture`);
  // Without the kind summary the result is the same, less that one field.
  const { kindSummary, ...plain } = expected;
  assert.deepStrictEqual(await diffConfigFiles(before, after), plain, `${pair.name}: the result without a kind summary differs`);
  // The digests in the result are the digests of the file bytes.
  assert.equal(result.before.sha256, await sha256Of(before), `${pair.name}: the before digest is not the file digest`);
  assert.equal(summaryText(result.summary), pair.summary, `${pair.name}: the summary changed`);
  if (mode === "--against-cub") {
    assert.deepStrictEqual(result, cubDiff(pair), `${pair.name}: the vendored diff differs from the installed cub config diff`);
  }
  console.log(`  ${pair.name}: ${summaryText(result.summary)}`);
}

// A Secret value never appears in a result. It becomes a short hash, which the
// adapter computes with Web Crypto in a second pass over the core.
const secret = (value) => Buffer.from(`apiVersion: v1\nkind: Secret\nmetadata:\n  name: s\n  namespace: n\nstringData:\n  password: ${value}\n`);
const sealed = await diffConfigFiles(secret("first-value"), secret("second-value"));
const field = sealed.changes[0].fields[0];
assert.equal(field.path, "/stringData/password");
// The expected hash comes from node:crypto, as the source file computes it.
const sealedAs = (value) => `<redacted sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12)}>`;
assert.equal(field.before, sealedAs("first-value"), "the sealed value is not the hash cub config diff prints");
assert.equal(field.after, sealedAs("second-value"));
assert.notEqual(field.before, field.after);
assert.ok(!JSON.stringify(sealed).includes("first-value") && !JSON.stringify(sealed).includes("0000000000"), "a Secret value or a placeholder digest reached the result");

// Two comparisons that overlap do not read each other's digests.
const [left, right] = await Promise.all([
  diffConfigFiles(secret("a"), secret("b")),
  diffConfigFiles(secret("c"), secret("d")),
]);
assert.notEqual(left.changes[0].fields[0].before, right.changes[0].fields[0].before);

console.log(`vendored config diff test: ${index.pairs.length} pairs match their fixtures${mode === "--against-cub" ? " and the installed cub config diff" : ""}${mode === "--write-fixtures" ? " (fixtures rewritten)" : ""}`);
