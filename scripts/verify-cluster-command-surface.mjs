import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

import {
  check,
  listFiles,
  relativeRepo,
  repoRoot,
} from "./lib/proof-common.mjs";

const roots = [
  "README.md",
  "CATALOG.md",
  "WEBSITE_UX_TEST.md",
  "docs/user",
  "docs/reference",
  "experimental",
  "recipes",
  "scripts",
  "site/charts",
  "site/d/docs/reference",
  "site/d/docs/user",
  "site/d/tests",
  "tests",
];
const allowedExtensions = new Set(["", ".html", ".js", ".json", ".md", ".mjs", ".py", ".sh", ".yaml", ".yml"]);
const topLevelSiteFiles = readdirSync(join(repoRoot, "site"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => join(repoRoot, "site", entry.name));
const files = [...topLevelSiteFiles, ...roots.flatMap((root) => {
  const path = join(repoRoot, root);
  return extname(root) ? [path] : listFiles(path);
})];
const scanned = files.filter(
  (file) => allowedExtensions.has(extname(file))
    && relativeRepo(file) !== "scripts/verify-cluster-command-surface.mjs",
);
const violations = [];

for (const file of scanned) {
  const repoPath = relativeRepo(file);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const withoutHistoricalTargetClass = line.replaceAll("cub-lk-kind-vanilla", "");
    if (/\bcub lk(?:\s|$)/.test(line)) {
      violations.push(`${relativeRepo(file)}:${index + 1}: use cub cluster, not cub lk`);
    }
    if (!repoPath.startsWith("scripts/") && withoutHistoricalTargetClass.includes("cub-lk")) {
      violations.push(
        `${repoPath}:${index + 1}: cub-lk is retired; only the historical cub-lk-kind-vanilla receipt value may remain`,
      );
    }
    if (line.includes(".confighub/lk")) {
      violations.push(
        `${relativeRepo(file)}:${index + 1}: kubeconfigs now live under .confighub/clusters`,
      );
    }
    if (/oci\.hub\.confighub\.com(?::443)?\/target\//.test(line)) {
      violations.push(
        `${repoPath}:${index + 1}: current OCI consumers use a Space release at /space/<space>; /target/.../oci is historical`,
      );
    }
    if (
      /\[\s*["']cub["']\s*,\s*["']lk["']\s*,\s*["'](?:up|down|list)["']/.test(line)
      || /\[\s*["']lk["']\s*,\s*["'](?:up|down|list)["']/.test(line)
    ) {
      violations.push(
        `${relativeRepo(file)}:${index + 1}: command arrays must use the cluster subcommand`,
      );
    }
  });
}

check(
  violations.length === 0,
  `cluster command surface is stale:\n${violations.join("\n")}`,
);
console.log(`verified cub cluster command surface across ${scanned.length} file(s)`);
