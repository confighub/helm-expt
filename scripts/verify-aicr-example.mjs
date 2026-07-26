#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const root = join(repoRoot, "examples", "aicr", "eks-h100-training-kubeflow");
const configPath = join(root, "aicr.yaml");
const recipePath = join(root, "recipe.yaml");
const receiptPath = join(root, "generation-receipt.yaml");
const gitBundleRoot = join(root, "flux-bundle");
const ociBundleRoot = join(root, "flux-oci-bundle");
const gitChecksumsPath = join(gitBundleRoot, "checksums.txt");
const ociChecksumsPath = join(ociBundleRoot, "checksums.txt");
const gitSourcePath = join(gitBundleRoot, "sources", "gitrepo-github-com-your-org-your-repo.yaml");
const localOciManifestPath = join(root, "local-oci-manifest.json");

for (const path of [
  configPath,
  recipePath,
  receiptPath,
  gitChecksumsPath,
  ociChecksumsPath,
  gitSourcePath,
  localOciManifestPath,
]) {
  check(existsSync(path), `missing AICR example file: ${relative(repoRoot, path)}`);
}

const config = readYaml(configPath);
const recipe = readYaml(recipePath);
const receipt = readYaml(receiptPath);
const criteria = config.spec?.recipe?.criteria ?? {};

check(config.apiVersion === "aicr.nvidia.com/v1alpha1", "AICRConfig apiVersion changed");
check(config.kind === "AICRConfig", "AICRConfig kind changed");
check(receipt.spec?.source?.version === "v0.14.0", "AICR receipt must pin v0.14.0");
check(
  receipt.spec?.source?.commit === "0479e45e3ee4ea04d3fff55fd9160843d161c03c",
  "AICR receipt must pin the v0.14.0 release commit",
);
check(
  receipt.spec?.source?.releaseAsset?.sha256
    === "0d48b8835660891a6ca7c0df3290d6241d2fd76daa01c6cdf65a808401e6cf8d",
  "AICR release asset checksum changed",
);
check(
  receipt.spec?.source?.binarySha256
    === "84c5f5d6052bb3daa0839702e6e3abc0a6fe9669293cd3ab66b41892b3c59a9c",
  "AICR binary checksum changed",
);
for (const [key, value] of Object.entries(criteria)) {
  check(receipt.spec?.criteria?.[key] === value, `AICR receipt criteria differ for ${key}`);
}

const recipeCriteria = recipe.metadata?.criteria ?? recipe.spec?.criteria ?? {};
for (const [key, value] of Object.entries(criteria)) {
  if (recipeCriteria[key] !== undefined) {
    check(String(recipeCriteria[key]) === String(value), `AICR recipe criteria differ for ${key}`);
  }
}

const gitFileCount = verifyBundleChecksums(gitBundleRoot, gitChecksumsPath, "Git-oriented");
const ociFileCount = verifyBundleChecksums(ociBundleRoot, ociChecksumsPath, "OCI-oriented");
check(gitFileCount === 34, `expected 34 Git-oriented bundle files, found ${gitFileCount}`);
check(ociFileCount === 35, `expected 35 OCI-oriented bundle files, found ${ociFileCount}`);

const bundleArgs = receipt.spec?.commands?.bundle ?? [];
requireCommandArguments(bundleArgs, [
  "--deployer",
  "flux",
  "--storage-class",
  "gp3",
  "--accelerated-node-selector",
  "nvidia.com/gpu.present=true",
  "--workload-selector",
  "app.kubernetes.io/part-of=training",
], "Git-oriented bundle");

const ociBundleArgs = receipt.spec?.commands?.ociBundle ?? [];
requireCommandArguments(ociBundleArgs, [
  "--deployer",
  "flux",
  "--output",
  "oci://localhost:5001/aicr-eks-h100-training-kubeflow:v0.14.0",
  "--plain-http",
  "--image-refs",
  "oci-image-ref.txt",
  "--storage-class",
  "gp3",
  "--accelerated-node-selector",
  "nvidia.com/gpu.present=true",
  "--workload-selector",
  "app.kubernetes.io/part-of=training",
], "OCI-oriented bundle");

const placeholderGitRepository = "https://github.com/YOUR_ORG/YOUR_REPO.git";
check(
  receipt.spec?.generationInputs?.gitBundleRepositoryUrl === placeholderGitRepository,
  "AICR receipt must record the generated Git repository placeholder",
);
check(
  readFileSync(gitSourcePath, "utf8").includes(`url: ${placeholderGitRepository}`),
  "AICR GitRepository placeholder changed without updating the receipt",
);
check(!bundleArgs.includes("--repo"), "AICR receipt claims --repo was supplied for the placeholder bundle");
check(receipt.status?.deployableBundle === false, "AICR placeholder bundle must not be marked deployable");
check(receipt.status?.placeholderGitRepository === true, "AICR placeholder status must remain visible");

const ociBundleText = listFiles(ociBundleRoot)
  .filter((path) => !path.endsWith("checksums.txt"))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
check(!ociBundleText.includes("YOUR_ORG/YOUR_REPO"), "OCI-oriented bundle contains the Git placeholder");
check(!ociBundleText.includes("/Users/"), "OCI-oriented bundle contains a local workstation path");
check(
  !listFiles(join(ociBundleRoot, "sources")).some((path) => path.includes("gitrepo-")),
  "OCI-oriented bundle must not depend on a generated GitRepository",
);

const rootKustomization = readYaml(join(ociBundleRoot, "kustomization.yaml"));
const rootResources = rootKustomization.resources ?? [];
for (const component of ["nodewright-customizations", "kubeflow-trainer-post"]) {
  const artifactGeneratorPath = `${component}/artifactgenerator.yaml`;
  check(rootResources.includes(artifactGeneratorPath), `root kustomization omits ${artifactGeneratorPath}`);

  const artifactGenerator = readYaml(join(ociBundleRoot, artifactGeneratorPath));
  check(artifactGenerator.kind === "ArtifactGenerator", `${component} must use ArtifactGenerator`);
  check(
    artifactGenerator.apiVersion === "source.extensions.fluxcd.io/v1beta1",
    `${component} ArtifactGenerator apiVersion changed`,
  );
  const source = artifactGenerator.spec?.sources?.[0] ?? {};
  check(source.kind === "OCIRepository", `${component} ArtifactGenerator source must be OCIRepository`);
  check(source.name === "aicr-bundle", `${component} ArtifactGenerator source must be named aicr-bundle`);

  const helmRelease = readYaml(join(ociBundleRoot, component, "helmrelease.yaml"));
  const chartRef = helmRelease.spec?.chartRef ?? {};
  check(chartRef.kind === "ExternalArtifact", `${component} HelmRelease must use ExternalArtifact`);
  check(
    chartRef.name === `${component}-chart`,
    `${component} HelmRelease points at an unexpected ExternalArtifact`,
  );
}

const portableChecksumsSha256 = hash(readFileSync(ociChecksumsPath));
check(
  receipt.spec?.oci?.portableChecksumsSha256 === portableChecksumsSha256,
  "portable OCI bundle checksum manifest digest changed",
);
check(
  receipt.spec?.oci?.normalization?.checksumPaths?.file === "checksums.txt",
  "AICR receipt must name the normalized checksum file",
);
check(
  receipt.spec?.oci?.normalization?.textFormatting?.files?.includes("gpu-operator/helmrelease.yaml"),
  "AICR receipt must name the generated file with normalized trailing spaces",
);
check(
  receipt.spec?.oci?.fluxRequirements?.minimumVersion === "v2.7.0",
  "AICR OCI Flux requirement must remain explicit",
);
check(
  receipt.spec?.oci?.fluxRequirements?.controllers?.includes("source-watcher"),
  "AICR OCI receipt must require source-watcher",
);
check(
  receipt.spec?.oci?.fluxRequirements?.featureGates?.includes("ExternalArtifact=true on helm-controller"),
  "AICR OCI receipt must require the ExternalArtifact feature gate",
);
check(
  receipt.spec?.oci?.fluxRequirements?.source?.name === "aicr-bundle",
  "AICR OCI receipt must name the matching Flux OCIRepository",
);

const localOciManifestBytes = readFileSync(localOciManifestPath);
const localOciManifest = JSON.parse(localOciManifestBytes);
const localManifestDigest = `sha256:${hash(localOciManifestBytes)}`;
check(
  receipt.spec?.oci?.localManifestDigest === localManifestDigest,
  "recorded AICR local OCI manifest digest changed",
);
check(
  localOciManifest.artifactType === "application/vnd.nvidia.aicr.artifact",
  "AICR local OCI artifact type changed",
);
check(
  localOciManifest.layers?.length === 1,
  "AICR local OCI artifact must contain one generated bundle layer",
);
check(
  receipt.spec?.oci?.localLayerDigest === localOciManifest.layers[0]?.digest,
  "recorded AICR local OCI layer digest changed",
);
check(receipt.status?.ociBundleGenerated === true, "AICR OCI bundle generation must stay recorded");
check(receipt.status?.portableSourceBundle === true, "portable AICR OCI source bundle must stay recorded");
check(receipt.status?.localOciPush === "pass", "AICR local OCI push must stay recorded");
check(receipt.status?.localOciPull === "pass", "AICR local OCI pull must stay recorded");
check(receipt.status?.publicOciPush === "not-run", "AICR example must not claim a public OCI push");
check(receipt.status?.publicOciPull === "not-run", "AICR example must not claim a public OCI pull");
check(receipt.status?.configHubUpload === "not-run", "AICR example must not claim an unrecorded ConfigHub upload");
check(receipt.status?.liveReconciliation === "not-run", "AICR example must not claim an unrecorded live reconciliation");

console.log(
  `verified AICR v0.14.0 example (${gitFileCount} Git-oriented and ${ociFileCount} OCI-oriented bundle files)`,
);

function verifyBundleChecksums(bundleRoot, checksumsPath, label) {
  const expectedChecksums = new Map(
    readFileSync(checksumsPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const match = line.match(/^([a-f0-9]{64})  ([^/].*)$/);
        check(match, `invalid ${label} AICR checksum line: ${line}`);
        check(!match[2].includes(".."), `${label} checksum escapes the bundle root: ${match[2]}`);
        return [match[2], match[1]];
      }),
  );

  for (const [path, expected] of expectedChecksums) {
    const absolute = join(bundleRoot, path);
    check(existsSync(absolute), `${label} AICR checksum points at missing ${path}`);
    const actual = hash(readFileSync(absolute));
    check(actual === expected, `${label} AICR checksum differs for ${path}`);
  }

  const generatedFiles = listFiles(bundleRoot)
    .map((path) => relative(bundleRoot, path).replaceAll("\\", "/"))
    .filter((path) => path !== "checksums.txt")
    .sort();
  check(
    generatedFiles.length === expectedChecksums.size
      && generatedFiles.every((path) => expectedChecksums.has(path)),
    `${label} AICR bundle contains an unrecorded or missing generated file`,
  );
  return generatedFiles.length;
}

function requireCommandArguments(args, requiredArguments, label) {
  for (const required of requiredArguments) {
    check(args.includes(required), `${label} AICR receipt is missing ${required}`);
  }
}

function hash(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
