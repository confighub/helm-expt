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
  "eks-h100-training-kubeflow-v0-20-0",
);
const sourceRoot = join(root, "argocd-helm-bundle");
const renderedRoot = join(root, "argocd-rendered");
const receipt = readYaml(join(root, "generation-receipt.yaml"));
const flatteningVerdictPath = join(root, "flattening-safety-verdict.yaml");
const platformIndexPath = join(root, "digest-index", "platform-index.json");
const sourceCatalogPath = join(root, "source-catalog", "source-catalog-record.yaml");
const routeIntentPath = join(root, "route-intent.yaml");
const fieldPolicyPath = join(root, "field-policy-assessment.yaml");
const publicReceiptPath = join(root, "public-oci-receipt.yaml");
const publicSummaryPath = join(root, "public-oci-summary.md");
const ociReceiptPath = join(root, "argocd-oci-receipt.yaml");
const expected = receipt.spec?.processing?.transport ?? {};

verifySourceChecksums();
verifySourceLayout();
verifyConfigurationLayout();
verifyFreshRender();
verifyFlatteningVerdict();
verifySupportingRecords();
console.log("verified the AICR v0.20.0 source chart and exact-configuration OCI layouts");

function readLayout(name, expectedDigest) {
  const layoutRoot = join(root, "oci-layouts", name);
  const index = JSON.parse(readFileSync(join(layoutRoot, "index.json"), "utf8"));
  check(index.manifests?.length === 1, `${name}: expected one tagged manifest`);
  const descriptor = index.manifests[0];
  check(descriptor.digest === expectedDigest, `${name}: layout digest changed`);
  check(
    descriptor.annotations?.["org.opencontainers.image.ref.name"] === "0.20.0",
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

  const work = mkdtempSync(join(tmpdir(), "helm-expt-aicr-v020-source-"));
  try {
    execFileSync("tar", ["-xzf", layerPath, "-C", work]);
    const extractedRoot = join(work, "aicr-bundle");
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
  const work = mkdtempSync(join(tmpdir(), "helm-expt-aicr-v020-render-"));
  try {
    execFileSync(
      "helm",
      [
        "template",
        "aicr-argocd",
        sourceRoot,
        "--namespace",
        "argocd",
        "--set",
        "repoURL=oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow",
        "--output-dir",
        work,
      ],
      { stdio: "ignore" },
    );
    const freshRoot = join(work, "aicr-bundle", "templates");
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
        "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow/aicr-bundle",
      "the root Application does not point at the versioned AICR source package",
    );
    check(rootApplication.spec?.source?.targetRevision === "0.20.0", "the root Application version changed");
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
    verdict.spec?.subject?.upstreamVersion === "v0.20.0",
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
        && item.gap === "https://github.com/confighub/helm-expt/issues/1615",
    ),
    "flattening verdict does not name the unfinished nested-source work",
  );
  for (const path of verdict.spec?.provenance?.generatedFrom ?? []) {
    check(existsPath(path), `flattening verdict points at missing ${path}`);
  }
}

function verifySupportingRecords() {
  const sourceCatalog = readYaml(sourceCatalogPath);
  check(sourceCatalog.kind === "SourceCatalogRecord", "source catalog record has the wrong kind");
  check(
    sourceCatalog.spec?.provider?.role === "source-catalog-curator",
    "source catalog record does not name the provider's curation role",
  );
  check(
    sourceCatalog.spec?.selectedSourceVariant?.name === "h100-eks-ubuntu-training-kubeflow",
    "source catalog record selects a different source variant",
  );
  check(
    sourceCatalog.status?.sourceCatalogRetained === true
      && sourceCatalog.status?.selectedVariantReproducible === true
      && sourceCatalog.status?.runtimeProven === false,
    "source catalog record overstates or omits its retained-source status",
  );

  const routeIntent = readYaml(routeIntentPath);
  check(routeIntent.kind === "PlatformRouteIntent", "route intent has the wrong kind");
  check(routeIntent.status?.configurationGenerated === true, "route intent omits the generated configuration");
  check(routeIntent.status?.routesExecuted === false, "route intent must not claim route execution");
  check(routeIntent.status?.runtimeProven === false, "route intent must not claim runtime proof");
  check(
    routeIntent.spec?.routes?.some(
      (route) => route.id === "downstream-chart-lifecycle"
        && route.status === "not-yet-materialized-for-v0.20.0",
    ),
    "route intent does not name the unfinished nested lifecycle work",
  );

  const fieldPolicy = readYaml(fieldPolicyPath);
  check(fieldPolicy.kind === "SourceFieldPolicyAssessment", "field policy assessment has the wrong kind");
  check(fieldPolicy.status?.configPlaneOnly === true, "field policy assessment is not bounded to config-plane work");
  check(fieldPolicy.status?.targetContacted === false, "field policy assessment must not claim target contact");
  check(fieldPolicy.status?.gpuWorkloadRun === false, "field policy assessment must not claim a GPU run");

  check(receipt.status?.generated === true, "generation receipt does not record generation");
  check(receipt.status?.localOciLayoutsVerified === true, "generation receipt does not record local OCI verification");
  check(receipt.status?.upstreamSignatureVerified === true, "generation receipt does not record source signature verification");
  check(receipt.status?.binaryAttestationVerified === true, "generation receipt does not record binary verification");
  check(receipt.status?.sbomAttestationVerified === true, "generation receipt does not record SBOM verification");
  check(
    receipt.spec?.provenance?.verifiedReceipt === "runs/aicr-provenance-v0-20-0/receipt.yaml",
    "generation receipt does not link the provenance receipt",
  );
  check(existsPath(receipt.spec.provenance.verifiedReceipt), "linked provenance receipt is missing");
  const published = existsSync(publicReceiptPath);
  check(
    receipt.spec?.processing?.transport?.publicStatus === (published ? "pass" : "not-run"),
    "generation receipt publication status disagrees with the public receipt",
  );
  check(
    receipt.status?.publicOciPublication === (published ? "pass" : "not-run"),
    "generation receipt public OCI result disagrees with the public receipt",
  );
  check(receipt.status?.published === (published ? true : undefined), "generation receipt published flag changed");
  for (const key of [
    "configHubUpload",
    "promotion",
    "configHubReleaseOci",
    "argoCdDelivery",
    "fluxDelivery",
    "eksH100Runtime",
  ]) {
    check(receipt.status?.[key] === "not-run", `generation receipt must keep ${key} at not-run`);
  }
  if (published) verifyPublicationRecords();

  verifyRetainedManifest(
    "argocd-source",
    join(root, "local-argocd-source-oci-manifest.json"),
    expected.sourcePackage?.digest,
  );
  verifyRetainedManifest(
    "argocd-config",
    join(root, "local-argocd-config-oci-manifest.json"),
    expected.literalConfiguration?.digest,
  );
}

function verifyPublicationRecords() {
  const source = expected.sourcePackage;
  const configuration = expected.literalConfiguration;
  const publicReceipt = readYaml(publicReceiptPath);
  check(publicReceipt.kind === "PublicOciReceipt", "public OCI receipt has the wrong kind");
  check(publicReceipt.status?.result === "pass", "public OCI receipt is not pass");
  check(publicReceipt.status?.anonymousPull === "pass", "public OCI receipt does not record anonymous pull");
  for (const [name, artifact] of [
    ["sourcePackage", source],
    ["literalConfiguration", configuration],
  ]) {
    const observed = publicReceipt.spec?.artifacts?.[name];
    check(observed?.reference === artifact?.publicTarget, `${name}: public reference changed`);
    check(observed?.digest === artifact?.digest, `${name}: public digest changed`);
    check(observed?.authenticatedPush === "pass", `${name}: authenticated push is not pass`);
    check(observed?.anonymousPull === "pass", `${name}: anonymous pull is not pass`);
  }
  check(existsSync(publicSummaryPath), "public OCI summary is missing");

  const ociReceipt = readYaml(ociReceiptPath);
  check(ociReceipt.kind === "OciArtifactReceipt", "OCI artifact receipt has the wrong kind");
  check(ociReceipt.status?.result === "pass", "OCI artifact receipt is not pass");
  for (const key of [
    "publicSourcePush",
    "publicSourcePull",
    "publicRenderedPush",
    "publicRenderedPull",
  ]) {
    check(ociReceipt.status?.[key] === "pass", `OCI artifact receipt must record ${key} as pass`);
  }
  check(ociReceipt.status?.liveArgoReconciliation === "not-run", "OCI publication must not claim Argo CD delivery");
  check(ociReceipt.status?.liveGpuReconciliation === "not-run", "OCI publication must not claim GPU runtime");
}

function verifyRetainedManifest(layoutName, retainedPath, expectedDigest) {
  const retained = readFileSync(retainedPath);
  check(`sha256:${sha256(retained)}` === expectedDigest, `${layoutName}: retained manifest digest changed`);
  const { manifest } = readLayout(layoutName, expectedDigest);
  check(
    stableJson(JSON.parse(retained.toString("utf8"))) === stableJson(manifest),
    `${layoutName}: retained manifest differs from the local OCI layout`,
  );
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
