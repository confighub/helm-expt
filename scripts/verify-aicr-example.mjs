#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const root = join(repoRoot, "examples", "aicr", "eks-h100-training-kubeflow");
const configPath = join(root, "aicr.yaml");
const recipePath = join(root, "recipe.yaml");
const receiptPath = join(root, "generation-receipt.yaml");
const bundleRoot = join(root, "flux-bundle");
const checksumsPath = join(bundleRoot, "checksums.txt");
const gitSourcePath = join(bundleRoot, "sources", "gitrepo-github-com-your-org-your-repo.yaml");

for (const path of [configPath, recipePath, receiptPath, checksumsPath, gitSourcePath]) {
  check(existsSync(path), `missing AICR example file: ${relative(repoRoot, path)}`);
}

const config = readYaml(configPath);
const recipe = readYaml(recipePath);
const receipt = readYaml(receiptPath);
const criteria = config.spec?.recipe?.criteria ?? {};

check(config.apiVersion === "aicr.nvidia.com/v1alpha1", "AICRConfig apiVersion changed");
check(config.kind === "AICRConfig", "AICRConfig kind changed");
check(receipt.spec?.source?.version === "v0.14.0", "AICR receipt must pin v0.14.0");
for (const [key, value] of Object.entries(criteria)) {
  check(receipt.spec?.criteria?.[key] === value, `AICR receipt criteria differ for ${key}`);
}

const recipeCriteria = recipe.metadata?.criteria ?? recipe.spec?.criteria ?? {};
for (const [key, value] of Object.entries(criteria)) {
  if (recipeCriteria[key] !== undefined) {
    check(String(recipeCriteria[key]) === String(value), `AICR recipe criteria differ for ${key}`);
  }
}

const expectedChecksums = new Map(
  readFileSync(checksumsPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})  (.+)$/);
      check(match, `invalid AICR checksum line: ${line}`);
      return [match[2], match[1]];
    }),
);

for (const [path, expected] of expectedChecksums) {
  const absolute = join(bundleRoot, path);
  check(existsSync(absolute), `AICR checksum points at missing ${path}`);
  const actual = createHash("sha256").update(readFileSync(absolute)).digest("hex");
  check(actual === expected, `AICR checksum differs for ${path}`);
}

const generatedFiles = listFiles(bundleRoot)
  .map((path) => relative(bundleRoot, path).replaceAll("\\", "/"))
  .filter((path) => path !== "checksums.txt")
  .sort();
check(
  generatedFiles.length === expectedChecksums.size
    && generatedFiles.every((path) => expectedChecksums.has(path)),
  "AICR bundle contains an unrecorded or missing generated file",
);

const bundleArgs = receipt.spec?.commands?.bundle ?? [];
for (const required of [
  "--deployer",
  "flux",
  "--storage-class",
  "gp3",
  "--accelerated-node-selector",
  "nvidia.com/gpu.present=true",
  "--workload-selector",
  "app.kubernetes.io/part-of=training",
]) {
  check(bundleArgs.includes(required), `AICR bundle receipt is missing ${required}`);
}

const placeholderGitRepository = "https://github.com/YOUR_ORG/YOUR_REPO.git";
check(
  receipt.spec?.installTimeInputs?.gitRepositoryUrl === placeholderGitRepository,
  "AICR receipt must record the generated Git repository placeholder",
);
check(
  readFileSync(gitSourcePath, "utf8").includes(`url: ${placeholderGitRepository}`),
  "AICR GitRepository placeholder changed without updating the receipt",
);
check(!bundleArgs.includes("--repo"), "AICR receipt claims --repo was supplied for the placeholder bundle");
check(receipt.status?.deployableBundle === false, "AICR placeholder bundle must not be marked deployable");
check(receipt.status?.placeholderGitRepository === true, "AICR placeholder status must remain visible");
check(receipt.status?.configHubUpload === "not-run", "AICR example must not claim an unrecorded ConfigHub upload");
check(receipt.status?.liveReconciliation === "not-run", "AICR example must not claim an unrecorded live reconciliation");

console.log(`verified AICR v0.14.0 example (${expectedChecksums.size} generated file checksum(s))`);

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
