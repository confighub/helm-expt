import { readFileSync } from "node:fs";

import { check, listFiles, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const roots = ["README.md", "CATALOG.md", "docs", "scripts", "recipes", "data", "runs"];
const files = roots.flatMap((root) => {
  const path = `${repoRoot}/${root}`;
  return root.endsWith(".md") ? [path] : listFiles(path);
});

const scanned = files.filter((file) => /\.(md|mjs|yaml|yml|json)$/.test(file));
const violations = [];
const oldVariantPattern = "template:{{." + "Source" + "EntitySlug" + "}}-" + "{{.Labels.Variant}}";

for (const file of scanned) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\bcub install(\s|$)/.test(line)) {
      violations.push(`${relativeRepo(file)}:${index + 1}: use cub installer, not cub install`);
    }
    if (/^\s*"install",\s*$/.test(line) || /^\s*-\s*"install"\s*$/.test(line)) {
      violations.push(`${relativeRepo(file)}:${index + 1}: command arrays must use "installer"`);
    }
    if (line.includes(oldVariantPattern)) {
      violations.push(`${relativeRepo(file)}:${index + 1}: use label-based variant space pattern`);
    }
  });
}

check(violations.length === 0, `installer command surface is stale:\n${violations.join("\n")}`);
console.log(`verified installer command surface across ${scanned.length} file(s)`);
