#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  check,
  listFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
} from "./lib/proof-common.mjs";

const root = join(
  repoRoot,
  "examples",
  "aicr",
  "eks-h100-training-kubeflow-v0-19-0",
);
const sourceRoot = join(root, "argocd-helm-bundle");
const renderedRoot = join(root, "argocd-rendered");
const receipt = readYaml(join(root, "generation-receipt.yaml"));
const flatteningVerdictPath = join(root, "flattening-safety-verdict.yaml");
const platformIndexPath = join(root, "digest-index", "platform-index.json");
const nestedSummaryPath = join(repoRoot, "data", "aicr-v0-19-0-nested-sources", "summary.md");
const expected = receipt.spec?.processing?.transport ?? {};

verifySourceChecksums();
verifySourceLayout();
verifyConfigurationLayout();
verifyFreshRender();
verifyFlatteningVerdict();
console.log("verified the AICR v0.19.0 source chart and exact-configuration OCI layouts");

function readLayout(name, expectedDigest) {
  const layoutRoot = join(root, "oci-layouts", name);
  const index = JSON.parse(readFileSync(join(layoutRoot, "index.json"), "utf8"));
  check(index.manifests?.length === 1, `${name}: expected one tagged manifest`);
  const descriptor = index.manifests[0];
  check(descriptor.digest === expectedDigest, `${name}: layout digest changed`);
  check(
    descriptor.annotations?.["org.opencontainers.image.ref.name"] === "0.19.0",
    `${name}: layout tag changed`,
  );
  const manifestPath = join(
    layoutRoot,
    "blobs",
    "sha256",
    descriptor.digest.replace("sha256:", ""),
  );
  const manifestBytes = readFileSync(manifestPath);
  check(`sha256:${sha256(manifestBytes)}` === descriptor.digest, `${name}: manifest blob changed`);
  return {
    layoutRoot,
    manifest: JSON.parse(manifestBytes.toString("utf8")),
  };
}

function verifySourceChecksums() {
  const rows = readChecksumFile(join(sourceRoot, "checksums.txt"));
  const files = listFiles(sourceRoot)
    .filter((path) => basename(path) !== "checksums.txt")
    .map((path) => relativeRepo(path).slice(`${relativeRepo(sourceRoot)}/`.length))
    .sort();
  check(
    JSON.stringify(files) === JSON.stringify([...rows.keys()].sort()),
    "source chart files differ from checksums.txt",
  );
  for (const [file, digest] of rows) {
    check(
      sha256(readFileSync(join(sourceRoot, file))) === digest,
      `source chart checksum changed: ${file}`,
    );
  }
}

function verifySourceLayout() {
  const expectedDigest = expected.sourcePackage?.digest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(expectedDigest), "source package digest is missing");
  const { layoutRoot, manifest } = readLayout("argocd-source", expectedDigest);
  check(
    manifest.config?.mediaType === "application/vnd.cncf.helm.config.v1+json",
    "source package has the wrong Helm config media type",
  );
  check(manifest.layers?.length === 1, "source package must contain one Helm chart layer");
  const layer = manifest.layers[0];
  check(
    layer.mediaType === "application/vnd.cncf.helm.chart.content.v1.tar+gzip",
    "source package has the wrong Helm chart layer type",
  );
  const layerPath = join(
    layoutRoot,
    "blobs",
    "sha256",
    layer.digest.replace("sha256:", ""),
  );
  const layerBytes = readFileSync(layerPath);
  check(`sha256:${sha256(layerBytes)}` === layer.digest, "source package chart layer changed");

  const work = mkdtempSync(join(tmpdir(), "helm-expt-aicr-v019-source-"));
  try {
    execFileSync("tar", ["-xzf", layerPath, "-C", work]);
    const extractedRoot = join(work, "aicr-eks-h100-training-kubeflow-argocd");
    const expectedFiles = listFiles(sourceRoot)
      .map((path) => relativeRepo(path).slice(`${relativeRepo(sourceRoot)}/`.length))
      .sort();
    const actualFiles = listFiles(extractedRoot)
      .map((path) => relativeRepo(path).slice(`${relativeRepo(extractedRoot)}/`.length))
      .sort();
    check(
      JSON.stringify(actualFiles) === JSON.stringify(expectedFiles),
      "the Helm chart OCI file inventory differs from the retained source chart",
    );
    for (const file of expectedFiles) {
      if (file === "Chart.yaml") {
        check(
          stableJson(readYaml(join(extractedRoot, file))) === stableJson(readYaml(join(sourceRoot, file))),
          "the Helm chart OCI carries different chart metadata",
        );
        continue;
      }
      check(
        sha256(readFileSync(join(extractedRoot, file))) === sha256(readFileSync(join(sourceRoot, file))),
        `the Helm chart OCI differs from the retained source chart at ${file}`,
      );
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function verifyConfigurationLayout() {
  const expectedDigest = expected.literalConfiguration?.digest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(expectedDigest), "literal configuration digest is missing");
  const { layoutRoot, manifest } = readLayout("argocd-config", expectedDigest);
  check(
    manifest.artifactType === "application/vnd.confighub.kubernetes.config.v1",
    "literal configuration has the wrong artifact type",
  );
  check(manifest.layers?.length === 17, "literal configuration must contain 17 YAML layers");
  const checksums = readChecksumFile(join(renderedRoot, "checksums.txt"));
  const seen = new Set();
  for (const layer of manifest.layers) {
    check(layer.mediaType === "application/yaml", "literal configuration contains a non-YAML layer");
    const title = layer.annotations?.["org.opencontainers.image.title"] ?? "";
    check(checksums.has(title), `literal configuration contains an unexpected layer: ${title}`);
    check(!seen.has(title), `literal configuration repeats ${title}`);
    seen.add(title);
    check(layer.digest === `sha256:${checksums.get(title)}`, `${title}: layer digest differs from checksums.txt`);
    const blob = readFileSync(join(layoutRoot, "blobs", "sha256", layer.digest.replace("sha256:", "")));
    check(sha256(blob) === checksums.get(title), `${title}: layer blob changed`);
    check(
      sha256(blob) === sha256(readFileSync(join(renderedRoot, title))),
      `${title}: OCI layer differs from the retained object file`,
    );
  }
  check(seen.size === checksums.size, "literal configuration omitted a rendered object file");
}

function verifyFreshRender() {
  const work = mkdtempSync(join(tmpdir(), "helm-expt-aicr-v019-render-"));
  try {
    execFileSync(
      "helm",
      ["template", "aicr-argocd", sourceRoot, "--namespace", "argocd", "--output-dir", work],
      { stdio: "ignore" },
    );
    const freshRoot = join(work, "aicr-eks-h100-training-kubeflow-argocd", "templates");
    const retained = applicationSet(join(renderedRoot, "templates"));
    const fresh = applicationSet(freshRoot);
    check(
      stableJson(fresh) === stableJson(retained),
      "a fresh Helm render of the retained source chart differs from the exact configuration",
    );
    const rootApplication = retained.find((doc) => doc.metadata?.name === "aicr-stack");
    check(rootApplication, "the exact configuration has no aicr-stack root Application");
    check(
      rootApplication.spec?.source?.repoURL ===
        "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd",
      "the root Application does not point at the versioned AICR source package",
    );
    check(rootApplication.spec?.source?.targetRevision === "0.19.0", "the root Application version changed");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function verifyFlatteningVerdict() {
  const verdict = readYaml(flatteningVerdictPath);
  const platformIndex = JSON.parse(readFileSync(platformIndexPath, "utf8"));
  const applications = applicationSet(join(renderedRoot, "templates"));
  const nestedApplications = applications
    .filter((doc) => doc.metadata?.name !== "aicr-stack")
    .map((doc) => doc.metadata?.name)
    .sort();
  const waves = new Set(
    applications
      .filter((doc) => doc.metadata?.name !== "aicr-stack")
      .map((doc) => doc.metadata?.annotations?.["argocd.argoproj.io/sync-wave"]),
  );
  check(verdict.kind === "FlatteningSafetyVerdict", "flattening verdict has the wrong kind");
  check(
    verdict.spec?.subject?.upstreamVersion === "v0.19.0",
    "flattening verdict is for a different AICR version",
  );
  check(
    verdict.spec?.subject?.platformDigest === platformIndex.spec?.platformDigest,
    "flattening verdict does not bind the exact platform digest",
  );
  check(
    verdict.spec?.verdict?.lane === "flatten-with-routes",
    "AICR wrapper must retain its ordering route",
  );
  check(
    stableJson(verdict.spec?.componentScope?.referencedCharts ?? [])
      === stableJson(nestedApplications),
    "flattening verdict does not name every nested Application source",
  );
  check(waves.size === 5, `expected five distinct component waves, found ${waves.size}`);
  check(
    verdict.spec?.dispositions?.some(
      (item) => item.class === "component-ordering"
        && item.finding === "present"
        && item.companionRequired === relativeRepo(join(root, "route-intent.yaml")),
    ),
    "flattening verdict does not bind component ordering to the route intent",
  );
  check(
    verdict.spec?.dispositions?.some(
      (item) => item.class === "nested-component-sources"
        && item.finding === "present"
        && item.evidence?.includes(relativeRepo(nestedSummaryPath)),
    ),
    "flattening verdict does not bind the retained nested-source renders",
  );
  for (const path of verdict.spec?.provenance?.generatedFrom ?? []) {
    check(existsPath(path), `flattening verdict points at missing ${path}`);
  }
}

function existsPath(path) {
  return existsSync(join(repoRoot, path));
}

function applicationSet(dir) {
  return listFiles(dir)
    .filter((path) => path.endsWith(".yaml"))
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")))
    .sort((left, right) => identity(left).localeCompare(identity(right)));
}

function identity(doc) {
  return [doc.apiVersion, doc.kind, doc.metadata?.namespace ?? "", doc.metadata?.name ?? ""].join("|");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readChecksumFile(path) {
  const rows = new Map();
  for (const line of readFileSync(path, "utf8").split("\n").filter(Boolean)) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    check(match, `${relativeRepo(path)}: cannot parse ${line}`);
    check(!rows.has(match[2]), `${relativeRepo(path)} repeats ${match[2]}`);
    rows.set(match[2], match[1]);
  }
  return rows;
}
