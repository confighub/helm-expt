#!/usr/bin/env node

// Renders, packages and checks the fourteen chart versions Kubara catalogs 3.0 pins
// that the Catalog did not yet hold at the exact version. Each addition runs its own
// proof declaration against the exact upstream archive, addressed by URL and SHA-256,
// so no mutable Helm repository index is consulted.
//
//   node scripts/kubara-catalog-3-0-coverage.mjs --list
//   node scripts/kubara-catalog-3-0-coverage.mjs --generate [--only <chart>]
//   node scripts/kubara-catalog-3-0-coverage.mjs --verify   [--only <chart>]
//
// --generate replaces only the recipe and package directories of the versions it
// names. It does not publish anything: OCI publication, signing and the derived
// catalog views are separate steps that need registry credentials.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot } from "./lib/proof-common.mjs";
import { KUBARA_CATALOG_3_0_ADDITIONS } from "./lib/kubara-catalog-3-0-coverage.mjs";

const args = process.argv.slice(2);
const mode = args[0] ?? "--verify";
const onlyIndex = args.indexOf("--only");
const only = onlyIndex === -1 ? null : args[onlyIndex + 1];
check(onlyIndex === -1 || (only && !only.startsWith("--")), "--only requires a chart name");
const items = KUBARA_CATALOG_3_0_ADDITIONS.filter((item) => !only || item.chart === only);
check(items.length > 0, `no Kubara 3.0 addition named ${only}`);

if (mode === "--list") {
  for (const item of items) console.log(`${item.canonicalIdentity}@${item.version}\t${item.script}\t${item.url}`);
} else if (mode === "--generate") {
  for (const item of items) {
    console.log(`generating ${item.canonicalIdentity}@${item.version}`);
    run(item, "--generate-proof");
    if (item.chart === "kube-prometheus-stack") lifecycle(item);
    run(item, "--generate-package");
    verifyOne(item);
  }
} else if (mode === "--verify") {
  for (const item of items) verifyOne(item);
} else {
  console.log("Usage: node scripts/kubara-catalog-3-0-coverage.mjs --list | --generate | --verify [--only <chart>]");
  process.exit(2);
}

function env(item) {
  return {
    ...process.env,
    HELM_EXPT_CHART_VERSION: item.version,
    HELM_EXPT_CHART_ARTIFACT_URL: item.url,
    HELM_EXPT_CHART_ARTIFACT_SHA256: item.sha256,
    ...(item.candidate ? { HELM_EXPT_KUBARA_CATALOG_3_0_CANDIDATE: item.candidate } : {}),
  };
}

function run(item, flag) {
  const result = spawnSync(process.execPath, [join("scripts", item.script), flag], { cwd: repoRoot, env: env(item), stdio: "inherit" });
  check(result.status === 0, `${item.canonicalIdentity}@${item.version}: ${item.script} ${flag} failed`);
}

// The packaged admission-webhook route is generated beside the recipe. It is not live
// qualified, so its README says so.
function lifecycle(item) {
  const result = spawnSync(
    process.execPath,
    ["scripts/generate-kps-packaged-lifecycle.mjs", "--generate", "--version", item.version],
    { cwd: repoRoot, env: { ...env(item), HELM_EXPT_PROOF_OFFLINE_CANDIDATE: "1" }, stdio: "inherit" },
  );
  check(result.status === 0, `${item.canonicalIdentity}@${item.version}: lifecycle generation failed`);
}

function verifyOne(item) {
  check(existsSync(join(repoRoot, item.recipePath)), `${item.recipePath} is missing`);
  check(existsSync(join(repoRoot, item.packagePath)), `${item.packagePath} is missing`);
  for (const flag of ["--verify-proof", "--verify-proof-self-test", "--verify-package"]) run(item, flag);
  console.log(`checked ${item.canonicalIdentity}@${item.version}`);
}
