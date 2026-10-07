import { readFileSync } from "node:fs";

import { check, listFiles, relativeRepo, repoRoot } from "./lib/proof-common.mjs";
import { coreGroups, formatViolations, scanReaderFacingSources } from "./lib/cub-command-surface.mjs";

// Reader-facing sources are checked against the committed snapshot of the
// CLI's own --help text. This never runs cub: CI installs an older CLI.
const surface = scanReaderFacingSources({ unknownCommands: true });
const core = coreGroups(surface.snapshot);
const coreViolations = surface.violations.filter((item) => item.kind === "command" || core.has(item.command.split(" ")[1]));

const roots = ["README.md", "CATALOG.md", "docs", "scripts", "recipes", "data"];
const files = roots.flatMap((root) => {
  const path = `${repoRoot}/${root}`;
  return root.endsWith(".md") ? [path] : listFiles(path);
});

const scanned = files.filter((file) => /\.(md|mjs|yaml|yml|json)$/.test(file));
const currentSubcommands = new Set(surface.snapshot.commands.variant.subcommands);
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
      lines[index + 1],
      lines[index + 2],
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
check(
  coreViolations.length === 0,
  `reader-facing sources show cub commands that cub ${surface.snapshot.cub.version} does not have. Fix the source, or refresh tests/cub-help-surface.json with node scripts/generate-cub-help-surface.mjs --write when the CLI has changed:\n${formatViolations(coreViolations)}`,
);
console.log(`verified variant command surface across ${scanned.length} file(s)`);
console.log(
  `verified cub commands in ${surface.scanned.length} reader-facing file(s) against the help of cub ${surface.snapshot.cub.version}; ${surface.exempt.length} historical file(s) exempt by listed rule`,
);
