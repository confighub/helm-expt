#!/usr/bin/env node
// Checks that data/ghcr-packages/built-elsewhere.yaml lists every package in
// ghcr.io/confighub/packages that another repository builds, so the catalog
// lists every ConfigHub package and the publisher never takes a name that is
// already someone else's.
//
// GitHub's package API names the repository each package belongs to. Reading
// it needs a GitHub token that can read the organization's packages: `gh` uses
// the caller's, and a workflow passes GITHUB_TOKEN.
//
// Usage:
//   node scripts/refresh-registry-packages.mjs --check

import { execFileSync } from "node:child_process";

import { builtElsewhere } from "./lib/ghcr-packages.mjs";

const THIS_REPOSITORY = "confighub/helm-expt";

const [mode = "--check"] = process.argv.slice(2);
if (mode !== "--check") {
  console.error("Usage: node scripts/refresh-registry-packages.mjs --check");
  process.exit(2);
}

const output = execFileSync(
  "gh",
  ["api", "--paginate", "/orgs/confighub/packages?package_type=container&per_page=100", "--jq", '.[] | select(.name | startswith("packages/")) | "\\(.name) \\(.repository.full_name // "")"'],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
const registry = new Map(
  output.split("\n").filter(Boolean).map((line) => {
    const [name, repository] = line.split(" ");
    return [name.replace(/^packages\//, ""), repository || "(no repository)"];
  }),
);

const listed = new Map(builtElsewhere().map((entry) => [entry.name, entry.builtBy]));
const problems = [];
for (const [name, repository] of registry) {
  if (repository === THIS_REPOSITORY) continue;
  if (!listed.has(name)) problems.push(`${name} is built by ${repository} and is not in data/ghcr-packages/built-elsewhere.yaml`);
  else if (listed.get(name) !== repository) problems.push(`${name} is built by ${repository}; data/ghcr-packages/built-elsewhere.yaml says ${listed.get(name)}`);
}
for (const name of listed.keys()) {
  if (!registry.has(name)) problems.push(`${name} is in data/ghcr-packages/built-elsewhere.yaml and not in ghcr.io/confighub/packages`);
}

const ours = [...registry.values()].filter((repository) => repository === THIS_REPOSITORY).length;
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`ghcr.io/confighub/packages holds ${registry.size} packages: ${ours} built here and ${listed.size} built elsewhere, all listed.`);
