#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const root = join(repoRoot, "examples", "aicr", "eks-h100-training-kubeflow");
const receiptPath = join(root, "argocd-oci-receipt.yaml");
const sourceRoot = join(root, "argocd-helm-bundle");
const renderedRoot = join(root, "argocd-rendered");
const sourceChecksumsPath = join(sourceRoot, "checksums.txt");
const renderedChecksumsPath = join(renderedRoot, "checksums.txt");
const sourceManifestPath = join(root, "local-argocd-source-oci-manifest.json");
const renderedManifestPath = join(root, "local-argocd-config-oci-manifest.json");
const sourceLayoutRoot = join(root, "oci-layouts", "argocd-source");
const renderedLayoutRoot = join(root, "oci-layouts", "argocd-config");

for (const path of [
  receiptPath,
  sourceChecksumsPath,
  renderedChecksumsPath,
  sourceManifestPath,
  renderedManifestPath,
  join(sourceLayoutRoot, "index.json"),
  join(renderedLayoutRoot, "index.json"),
]) {
  check(existsSync(path), `missing AICR Argo CD evidence: ${relative(repoRoot, path)}`);
}

const receipt = readYaml(receiptPath);
check(receipt.spec?.deployer === "argocd-helm", "AICR Argo CD receipt must use argocd-helm");
check(receipt.spec?.source?.version === "v0.14.0", "AICR Argo CD receipt must pin v0.14.0");

const sourceFileCount = verifyChecksums(sourceRoot, sourceChecksumsPath, "Argo CD source bundle");
const renderedFileCount = verifyChecksums(renderedRoot, renderedChecksumsPath, "rendered Argo CD bundle");
check(sourceFileCount === 54, `expected 54 source bundle files, found ${sourceFileCount}`);
check(renderedFileCount === 17, `expected 17 rendered Application files, found ${renderedFileCount}`);

const allPortableText = [
  ...listFiles(sourceRoot).filter((path) => path !== sourceChecksumsPath),
  ...listFiles(renderedRoot).filter((path) => path !== renderedChecksumsPath),
].map((path) => readFileSync(path, "utf8")).join("\n");
check(!allPortableText.includes("/Users/"), "portable AICR Argo CD evidence contains a workstation path");
check(!allPortableText.includes("localhost:5001"), "portable AICR Argo CD evidence contains the local registry");
check(!allPortableText.includes("YOUR_ORG/YOUR_REPO"), "portable AICR Argo CD evidence contains a placeholder");

const sourceCommand = receipt.spec?.commands?.generateSourceBundle ?? [];
for (const required of [
  "--deployer",
  "argocd-helm",
  "--storage-class",
  "gp3",
  "--accelerated-node-selector",
  "nvidia.com/gpu.present=true",
  "--workload-selector",
  "app.kubernetes.io/part-of=training",
]) {
  check(sourceCommand.includes(required), `AICR Argo CD generation command is missing ${required}`);
}

const chart = readYaml(join(sourceRoot, "Chart.yaml"));
check(chart.name === "aicr-eks-h100-training-kubeflow-argocd", "AICR Argo CD chart name changed");
check(String(chart.version) === "0.14.0", "AICR Argo CD chart version changed");
const chartValues = readYaml(join(sourceRoot, "values.yaml"));
check(chartValues.repoURL === "", "AICR Argo CD source chart must keep repoURL dynamic");
check(chartValues.targetRevision === "", "AICR Argo CD source chart must keep targetRevision dynamic");

const renderedPaths = listFiles(renderedRoot)
  .filter((path) => path.endsWith(".yaml"))
  .sort();
const applications = renderedPaths.map((path) => ({ path, object: readYaml(path) }));
for (const { path, object } of applications) {
  check(object.apiVersion === "argoproj.io/v1alpha1", `${basename(path)} apiVersion changed`);
  check(object.kind === "Application", `${basename(path)} must contain an Argo CD Application`);
  check(object.metadata?.namespace === "argocd", `${basename(path)} must live in argocd`);
}

const expectedNames = [
  "aicr-stack",
  "aws-ebs-csi-driver",
  "aws-efa",
  "cert-manager",
  "gpu-operator",
  "k8s-ephemeral-storage-metrics",
  "kai-scheduler",
  "kube-prometheus-stack",
  "kubeflow-trainer-post",
  "kubeflow-trainer",
  "nfd",
  "nodewright-customizations",
  "nodewright-operator",
  "nvidia-dra-driver-gpu",
  "nvsentinel",
  "prometheus-adapter",
  "prometheus-operator-crds",
].sort();
const actualNames = applications.map(({ object }) => object.metadata.name).sort();
check(JSON.stringify(actualNames) === JSON.stringify(expectedNames), "rendered Argo CD Application set changed");

const publicParentRepo = receipt.spec.renderInputs.repoURL;
const publicSourceRepo = `${publicParentRepo}/aicr-eks-h100-training-kubeflow-argocd`;
const parent = applications.find(({ object }) => object.metadata.name === "aicr-stack")?.object;
check(parent?.spec?.source?.repoURL === publicSourceRepo, "parent Application source OCI changed");
check(String(parent?.spec?.source?.targetRevision) === "0.14.0", "parent Application revision changed");
check(parent?.spec?.source?.path === ".", "parent Application must reconcile the chart root");

const children = applications.filter(({ object }) => object.metadata.name !== "aicr-stack");
const waves = children
  .map(({ object }) => Number(object.metadata?.annotations?.["argocd.argoproj.io/sync-wave"]))
  .sort((left, right) => left - right);
check(
  JSON.stringify(waves) === JSON.stringify(Array.from({ length: 16 }, (_, index) => index)),
  "AICR Argo CD sync waves must remain 0 through 15",
);

for (const [name, expectedPath] of [
  ["nodewright-customizations", "006-nodewright-customizations"],
  ["kubeflow-trainer-post", "013-kubeflow-trainer-post"],
]) {
  const application = children.find(({ object }) => object.metadata.name === name)?.object;
  check(application?.spec?.source?.repoURL === publicSourceRepo, `${name} source OCI changed`);
  check(application?.spec?.source?.path === expectedPath, `${name} local chart path changed`);
}

const sourceDigest = receipt.spec?.artifacts?.sourcePackage?.portableDigest;
const renderedDigest = receipt.spec?.artifacts?.literalConfiguration?.digest;
const sourceManifest = verifyLayout(sourceLayoutRoot, sourceManifestPath, sourceDigest, "source package");
const renderedManifest = verifyLayout(renderedLayoutRoot, renderedManifestPath, renderedDigest, "literal configuration");

check(
  sourceManifest.config?.mediaType === "application/vnd.cncf.helm.config.v1+json",
  "AICR Argo CD source OCI must use the Helm config media type",
);
check(
  sourceManifest.layers?.length === 1
    && sourceManifest.layers[0]?.mediaType === "application/vnd.cncf.helm.chart.content.v1.tar+gzip",
  "AICR Argo CD source OCI must contain one Helm chart layer",
);
check(
  sourceManifest.annotations?.["org.opencontainers.image.created"] === "1970-01-01T00:00:00Z",
  "AICR Argo CD source OCI must keep the fixed creation annotation",
);

check(
  renderedManifest.artifactType === "application/vnd.confighub.kubernetes.config.v1",
  "rendered AICR Argo CD OCI artifact type changed",
);
check(renderedManifest.layers?.length === 17, "rendered AICR Argo CD OCI must contain 17 YAML layers");
const renderedLayerTitles = [];
for (const layer of renderedManifest.layers) {
  check(layer.mediaType === "application/yaml", "rendered AICR Argo CD OCI contains a non-YAML layer");
  const title = layer.annotations?.["org.opencontainers.image.title"];
  check(typeof title === "string", "rendered AICR Argo CD OCI layer has no file title");
  const filePath = join(renderedRoot, title);
  check(existsSync(filePath), `rendered AICR Argo CD OCI names missing file ${title}`);
  check(`sha256:${hash(readFileSync(filePath))}` === layer.digest, `rendered OCI digest differs for ${title}`);
  renderedLayerTitles.push(title);
}
const expectedLayerTitles = renderedPaths.map((path) => relative(renderedRoot, path).replaceAll("\\", "/"));
check(
  JSON.stringify(renderedLayerTitles.sort()) === JSON.stringify(expectedLayerTitles.sort()),
  "rendered AICR Argo CD OCI layer inventory changed",
);

check(receipt.status?.sourceLocalPush === "pass", "AICR Argo CD source local push must stay recorded");
check(receipt.status?.sourceLocalPull === "pass", "AICR Argo CD source local pull must stay recorded");
check(receipt.status?.helmTemplate === "pass", "AICR Argo CD Helm render must stay recorded");
check(receipt.status?.renderedLocalPush === "pass", "AICR Argo CD config local push must stay recorded");
check(receipt.status?.renderedLocalPull === "pass", "AICR Argo CD config local pull must stay recorded");
for (const field of [
  "publicSourcePush",
  "publicSourcePull",
  "publicRenderedPush",
  "publicRenderedPull",
  "configHubUpload",
  "liveArgoReconciliation",
  "liveGpuReconciliation",
]) {
  check(receipt.status?.[field] === "not-run", `AICR Argo CD receipt must keep ${field} as not-run`);
}

console.log(
  `verified AICR Argo CD OCI example (${sourceFileCount} source files, ${renderedFileCount} Applications, 2 local OCI layouts)`,
);

function verifyChecksums(bundleRoot, checksumsPath, label) {
  const expected = new Map(
    readFileSync(checksumsPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const match = line.match(/^([a-f0-9]{64})  ([^/].*)$/);
        check(match, `invalid ${label} checksum line: ${line}`);
        check(!match[2].includes(".."), `${label} checksum escapes its root: ${match[2]}`);
        return [match[2], match[1]];
      }),
  );
  const files = listFiles(bundleRoot)
    .map((path) => relative(bundleRoot, path).replaceAll("\\", "/"))
    .filter((path) => path !== "checksums.txt")
    .sort();
  check(files.length === expected.size, `${label} checksum inventory size changed`);
  for (const path of files) {
    check(expected.has(path), `${label} checksum omits ${path}`);
    check(hash(readFileSync(join(bundleRoot, path))) === expected.get(path), `${label} checksum differs for ${path}`);
  }
  return files.length;
}

function verifyLayout(layoutRoot, manifestPath, expectedDigest, label) {
  const manifestBytes = readFileSync(manifestPath);
  check(`sha256:${hash(manifestBytes)}` === expectedDigest, `${label} manifest digest changed`);
  const index = JSON.parse(readFileSync(join(layoutRoot, "index.json"), "utf8"));
  check(index.manifests?.length === 1, `${label} OCI layout must contain one tagged manifest`);
  check(index.manifests[0]?.digest === expectedDigest, `${label} OCI layout index digest changed`);
  const manifestBlobPath = join(layoutRoot, "blobs", "sha256", expectedDigest.replace("sha256:", ""));
  check(existsSync(manifestBlobPath), `${label} OCI layout manifest blob is missing`);
  check(readFileSync(manifestBlobPath).equals(manifestBytes), `${label} standalone manifest differs from its OCI layout`);
  const manifest = JSON.parse(manifestBytes);
  for (const descriptor of [manifest.config, ...(manifest.layers ?? [])]) {
    const blobPath = join(layoutRoot, "blobs", "sha256", descriptor.digest.replace("sha256:", ""));
    check(existsSync(blobPath), `${label} OCI layout is missing ${descriptor.digest}`);
    const blob = readFileSync(blobPath);
    check(`sha256:${hash(blob)}` === descriptor.digest, `${label} OCI blob digest differs for ${descriptor.digest}`);
    check(blob.length === descriptor.size, `${label} OCI blob size differs for ${descriptor.digest}`);
  }
  return manifest;
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
