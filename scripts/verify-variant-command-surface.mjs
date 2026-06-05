import { readFileSync } from "node:fs";

import { check, listFiles, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const roots = ["README.md", "CATALOG.md", "docs", "scripts", "recipes", "data", "runs"];
const files = roots.flatMap((root) => {
  const path = `${repoRoot}/${root}`;
  return root.endsWith(".md") ? [path] : listFiles(path);
});

const scanned = files.filter((file) => /\.(md|mjs|yaml|yml|json)$/.test(file));
const currentSubcommands = new Set(["create"]);
const plannedContextPattern =
  /\b(ask|candidate|future|planned|missing product|not current|notcurrent|not local|not yet|not shipped|not available|does not|do not|product gap|product surfaces to add|roadmap|until implemented|until the CLI exposes|until it exists)\b/i;

const violations = [];

for (const file of scanned) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const context = [
      lines[index - 8],
      lines[index - 7],
      lines[index - 6],
      lines[index - 5],
      lines[index - 4],
      lines[index - 3],
      lines[index - 2],
      lines[index - 1],
      line,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/[*_`]/g, "");
    const commandPattern = /(?:^|[`'"\s])cub\s+variant\s+([a-z][\w-]*)\b/g;
    for (const match of line.matchAll(commandPattern)) {
      const subcommand = match[1];
      if (!currentSubcommands.has(subcommand) && !plannedContextPattern.test(context)) {
        violations.push(
          `${relativeRepo(file)}:${index + 1}: ${subcommand} is not a current variant subcommand`,
        );
      }
    }

    if (/\bcub\s+variant\s+create\b/.test(line) && /\s--extends(?:\s|=|$)/.test(line)) {
      violations.push(`${relativeRepo(file)}:${index + 1}: cub variant create does not use --extends`);
    }

    if (/\bcub\s+variant\s+create\b/.test(line) && /\s--space(?:\s|=|$)/.test(line)) {
      violations.push(`${relativeRepo(file)}:${index + 1}: cub variant create does not use --space`);
    }
  });
}

check(violations.length === 0, `variant command surface is stale:\n${violations.join("\n")}`);
console.log(`verified variant command surface across ${scanned.length} file(s)`);
