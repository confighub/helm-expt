#!/usr/bin/env node
// Prints the Helm chart repositories the catalog pins, one "name<TAB>url" per
// line, for a caller that needs a populated local repo index (the weekly
// refresh workflow runs `helm repo add` over this list before asking
// `helm search repo` what the latest published version is).
//
// The list is derived from every recipe's source-lock rather than kept in a
// second place, so adding a chart cannot leave the refresh lane looking at a
// repository it never indexed. OCI-addressed charts are skipped: `helm repo
// add` does not accept an oci:// reference, and those charts are resolved by
// digest rather than by index lookup.
//
// Usage:
//   node scripts/print-chart-repositories.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { listFiles, repoRoot } from "./lib/proof-common.mjs";

const repositories = new Map();

for (const path of listFiles(join(repoRoot, "recipes"))) {
  if (!path.endsWith("/source-lock.yaml")) continue;
  const text = readFileSync(path, "utf8");
  const name = text.match(/^\s*repositoryName:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
  const url = text.match(/^\s*repositoryURL:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
  if (!name || !url) continue;
  if (!url.startsWith("http://") && !url.startsWith("https://")) continue;
  if (!repositories.has(name)) repositories.set(name, url);
}

const rows = [...repositories.entries()].sort(([left], [right]) => (left < right ? -1 : 1));
for (const [name, url] of rows) process.stdout.write(`${name}\t${url}\n`);
