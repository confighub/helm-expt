import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { check, listFiles, relativeRepo, repoRoot } from "./lib/proof-common.mjs";
import { verifyMaintainedInstallerCommands } from "./verify-installer-consumer-commands.mjs";

const roots = ["README.md", "CATALOG.md", "docs", "scripts", "recipes", "packages", "data", "runs"];
const files = roots.flatMap((root) => {
  const path = `${repoRoot}/${root}`;
  return root.endsWith(".md") ? [path] : listFiles(path);
});

const scanned = files.filter((file) => /\.(md|mjs|yaml|yml|json)$/.test(file));
const violations = [];
const oldVariantPattern = "template:{{." + "Source" + "EntitySlug" + "}}-" + "{{.Labels.Variant}}";
const bundledInstallerClaim = "The public cub CLI includes " + "cub installer";
const removedSetupMergeFlag = "--merge-" + "external-source";

for (const file of scanned) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\bcub install(\s|$)/.test(line)) {
      violations.push(`${relativeRepo(file)}:${index + 1}: use cub installer, not cub install`);
    }
    if (
      (/\[\s*["']cub["']\s*,\s*["']install["']/.test(line) || (
        (/^\s*"install",\s*$/.test(line) || /^\s*-\s*"install"\s*$/.test(line)) &&
        previousCommandItemIsCub(lines, index)
      ))
    ) {
      violations.push(`${relativeRepo(file)}:${index + 1}: command arrays must use "installer"`);
    }
    if (line.includes(oldVariantPattern)) {
      violations.push(`${relativeRepo(file)}:${index + 1}: use label-based variant space pattern`);
    }
    if (line.includes(bundledInstallerClaim)) {
      violations.push(`${relativeRepo(file)}:${index + 1}: cub installer is a plugin, not part of the cub binary`);
    }
    if (
      line.includes("cub plugin install confighub/installer")
      && line.includes("--force")
    ) {
      violations.push(`${relativeRepo(file)}:${index + 1}: current cub plugin install has no --force flag`);
    }
    if (line.includes(removedSetupMergeFlag)) {
      violations.push(
        `${relativeRepo(file)}:${index + 1}: installer setup no longer accepts the removed setup merge flag; setup re-enters from upload.yaml and upload performs the merge`,
      );
    }
  });
}

check(violations.length === 0, `installer command surface is stale:\n${violations.join("\n")}`);
verifyMaintainedInstallerCommands();
for (const [script, mode] of [
  ["scripts/generate-installer-package-signatures.mjs", "--verify"],
  ["scripts/verify-installer-oci-index-signature.mjs", "--verify"],
]) {
  execFileSync(process.execPath, [script, mode], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    maxBuffer: 1024 * 1024 * 64,
  });
}
console.log(`verified installer command surface across ${scanned.length} file(s)`);

function previousCommandItemIsCub(lines, index) {
  for (let cursor = index - 1; cursor >= 0 && cursor >= index - 5; cursor -= 1) {
    const prior = lines[cursor].trim();
    if (!prior || prior === "[" || prior === "args:" || prior === "command:" || prior === "command: [") continue;
    return /^["']cub["'],?$/.test(prior) || /^-\s*["']cub["']$/.test(prior);
  }
  return false;
}
