// Loads the browser build of `cub config diff` in Node, so the site generator
// and the tests run the same file a chart page runs. The record of the copy is
// scripts/site/vendor/config-diff.source.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

import { repoRoot } from "./proof-common.mjs";

export const VENDORED_DIFF_SOURCE = "scripts/site/config-diff-browser.js";
export const VENDORED_DIFF_RECORD = "scripts/site/vendor/config-diff.source.json";
export const VENDORED_DIFF_FIXTURES = "tests/fixtures/config-diff";

// The module reads the YAML parser from globalThis.jsyaml when a comparison
// runs, as it does on a page, so the parser is loaded the way a page loads it.
if (!globalThis.jsyaml) {
  vm.runInThisContext(readFileSync(join(repoRoot, "scripts/site/vendor/js-yaml-4.1.0.min.js"), "utf8"), {
    filename: "js-yaml-4.1.0.min.js",
  });
}

export { diffConfigFiles, sha256Of } from "../site/config-diff-browser.js";

export function vendoredDiffRecord() {
  return JSON.parse(readFileSync(join(repoRoot, VENDORED_DIFF_RECORD), "utf8"));
}

// The lines between the two markers, with their line endings, as hashed.
export function vendoredCore(text) {
  const begin = text.match(/^\/\/ BEGIN VENDORED CORE[^\n]*\n/m);
  const end = text.indexOf("// END VENDORED CORE\n");
  if (!begin || end < 0 || end < begin.index) return null;
  return text.slice(begin.index + begin[0].length, end);
}
