#!/usr/bin/env node
// Writes the companion files and the publication plan of one literal
// configuration bundle for every base of the four NVIDIA charts in the
// Catalog: cluster-readiness-engine, gpu-operator, k8s-nim-operator and
// nvsentinel.
//
//   node scripts/generate-nvidia-literal-bundles.mjs             write
//   node scripts/generate-nvidia-literal-bundles.mjs --verify    compare
//
// Every output is a pure function of committed files: the render intents, the
// retained renders and their inventories, the flattening verdicts, and the
// lifecycle actions and definition bundles the installer packages hold. There
// is no clock, no network and no cluster. Each plan records the manifest
// digest the committed bytes build, so the digest is on record before any
// push. Nothing here says whether a bundle is published. That is decided by a
// tracked receipt, which scripts/publish-nvidia-literal-bundles.mjs writes.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";
import {
  buildLiteralBundleArtifact,
  loadNvidiaLiteralBundleEntries,
  NVIDIA_LITERAL_BUNDLE_DATA_ROOT,
  nvidiaLiteralBundleOutputs,
} from "./lib/nvidia-literal-bundles.mjs";

const mode = process.argv[2] ?? "--generate";
check(["--generate", "--verify"].includes(mode), `unknown argument ${mode}. Use --generate or --verify`);

const entries = loadNvidiaLiteralBundleEntries();
// A second build from the same committed bytes must give the same digests. A
// digest that moves without its content moving makes every plan meaningless.
for (const entry of entries) {
  const again = buildLiteralBundleArtifact(entry);
  check(
    again.manifestDigest === entry.artifact.manifestDigest && again.layerDigest === entry.artifact.layerDigest,
    `${entry.recordName} built two different artifacts from the same bytes`,
  );
}
const outputs = nvidiaLiteralBundleOutputs(entries);
const owned = new Set(outputs.map((output) => output.rel));
const root = join(repoRoot, NVIDIA_LITERAL_BUNDLE_DATA_ROOT);
const leftovers = existsSync(root) ? listFiles(root).map(relativeRepo).filter((rel) => !owned.has(rel)) : [];
const routed = entries.filter((entry) => entry.lane === "flatten-with-routes").length;
const counts = `${entries.length} bases, ${routed} with routes and ${entries.length - routed} safe to flatten, ${outputs.length} files`;

if (mode === "--verify") {
  for (const output of outputs) {
    const path = join(repoRoot, output.rel);
    check(existsSync(path) && readFileSync(path, "utf8") === output.text, `${output.rel} is stale; run npm run nvidia-literal-bundles:generate`);
  }
  check(leftovers.length === 0, `${leftovers[0]} is not a file this generator writes; remove it or run npm run nvidia-literal-bundles:generate`);
  console.log(`verified NVIDIA literal configuration bundle plans: ${counts}; every artifact rebuilt to the digest its plan records`);
} else {
  for (const output of outputs) write(join(repoRoot, output.rel), output.text);
  check(leftovers.length === 0, `${leftovers[0]} is not a file this generator writes; remove it`);
  console.log(`wrote NVIDIA literal configuration bundle plans: ${counts}`);
}
