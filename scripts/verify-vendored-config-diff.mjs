#!/usr/bin/env node
// Fails when the vendored copy of the `cub config diff` core differs from the
// hash its record names. The copy runs in a reader's browser and in the site
// generator, so a quiet edit would make the site's diff a different
// computation from the command the page names.
//
//   node scripts/verify-vendored-config-diff.mjs
//   node scripts/verify-vendored-config-diff.mjs --self-test
//   node scripts/verify-vendored-config-diff.mjs --upstream <cub-workshop checkout>
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot, sha256 } from "./lib/proof-common.mjs";
import { VENDORED_DIFF_RECORD, VENDORED_DIFF_SOURCE, vendoredCore, vendoredDiffRecord } from "./lib/vendored-config-diff.mjs";

const args = process.argv.slice(2);
const record = vendoredDiffRecord();

// Every way the copy can drift from its record, as a list of findings.
function findings(text) {
  const out = [];
  const core = vendoredCore(text);
  if (core === null) return [`${VENDORED_DIFF_SOURCE}: the BEGIN and END markers around the vendored core are missing`];
  if (sha256(core) !== record.core.sha256) {
    out.push(`${VENDORED_DIFF_SOURCE}: the vendored core hashes to ${sha256(core)}, and ${VENDORED_DIFF_RECORD} records ${record.core.sha256}`);
  }
  const [first, last] = record.core.lines.split("-").map(Number);
  if (core.split("\n").length - 1 !== last - first + 1) {
    out.push(`${VENDORED_DIFF_SOURCE}: the vendored core has ${core.split("\n").length - 1} lines, and the record names lines ${record.core.lines}`);
  }
  const header = text.slice(0, text.indexOf("// BEGIN VENDORED CORE"));
  for (const [label, value] of [
    ["source commit", record.source.commit],
    ["source file SHA-256", record.source.sha256],
    ["core SHA-256", record.core.sha256],
  ]) {
    if (!header.includes(value)) out.push(`${VENDORED_DIFF_SOURCE}: the header does not state the ${label} ${value}`);
  }
  if (!header.includes(`lines ${first} to ${last}`)) out.push(`${VENDORED_DIFF_SOURCE}: the header does not state lines ${first} to ${last}`);
  // The adapter may not reach for anything a browser lacks.
  const outside = text.replace(core, "");
  if (/\bfrom\s+["']node:|\brequire\(/.test(outside)) out.push(`${VENDORED_DIFF_SOURCE}: the adapter imports a Node module`);
  return out;
}

const text = readFileSync(join(repoRoot, VENDORED_DIFF_SOURCE), "utf8");

if (args[0] === "--self-test") {
  check(findings(text).length === 0, "the self-test needs a clean copy to start from");
  const core = vendoredCore(text);
  const cases = [
    ["one changed character in the core", text.replace(core, core.replace("operation: 'replace'", "operation: 'replaced'"))],
    ["one removed line in the core", text.replace(core, core.split("\n").slice(1).join("\n"))],
    ["a missing marker", text.replace("// END VENDORED CORE\n", "")],
    ["a header that names another commit", text.replace(record.source.commit, "0".repeat(40))],
    ["an adapter that imports node:crypto", text.replace("const encoder", 'import { createHash } from "node:crypto";\nconst encoder')],
  ];
  for (const [name, tampered] of cases) {
    check(tampered !== text, `self-test case did not change the file: ${name}`);
    check(findings(tampered).length > 0, `the gate did not catch ${name}`);
  }
  console.log(`vendored config diff self-test: the gate caught ${cases.length} tampered copies`);
  process.exit(0);
}

const found = findings(text);
check(
  sha256(readFileSync(join(repoRoot, record.yamlParser.vendoredAs))) === record.yamlParser.sha256,
  `${record.yamlParser.vendoredAs} differs from the parser the record names`,
);
const published = join(repoRoot, record.publishedAs);
if (existsSync(published) && readFileSync(published, "utf8") !== text) {
  found.push(`${record.publishedAs} differs from ${VENDORED_DIFF_SOURCE}: run npm run site:generate`);
}

// With a checkout of the source repository, also prove the record against it.
const upstreamAt = args.indexOf("--upstream");
if (upstreamAt >= 0) {
  const checkout = args[upstreamAt + 1];
  check(checkout && existsSync(checkout), "--upstream needs the path of a cub-workshop checkout");
  const show = (path) => execFileSync("git", ["-C", checkout, "show", `${record.source.commit}:${path}`], { encoding: "utf8", maxBuffer: 1024 * 1024 * 20 });
  const source = show(record.source.path);
  if (sha256(source) !== record.source.sha256) found.push(`upstream ${record.source.path} at ${record.source.commit} hashes to ${sha256(source)}, and the record names ${record.source.sha256}`);
  const [first, last] = record.core.lines.split("-").map(Number);
  const lines = source.split("\n").slice(first - 1, last).join("\n") + "\n";
  if (lines !== vendoredCore(text)) found.push(`the vendored core is not lines ${record.core.lines} of upstream ${record.source.path} at ${record.source.commit}`);
  if (sha256(show(record.yamlParser.sourcePath)) !== record.yamlParser.sha256) found.push(`upstream ${record.yamlParser.sourcePath} differs from the vendored YAML parser`);
}

check(found.length === 0, `vendored config diff check failed:\n${found.map((line) => `  - ${line}`).join("\n")}`);
console.log(`verified the vendored cub config diff core against ${VENDORED_DIFF_RECORD} (${record.source.commit.slice(0, 7)}, lines ${record.core.lines}${upstreamAt >= 0 ? ", and against the upstream checkout" : ""})`);
