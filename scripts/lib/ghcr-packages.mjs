// Names, tags and staging for publishing the catalog's installer packages to
// ghcr.io/confighub/packages/<name>, the one place `cub package install <name>`
// looks a package up by name.
//
// The catalog keeps one directory per chart version under
// packages/<repo>/<chart>/<version>/. Each chart is published as one OCI
// repository, named by its chart name, with one tag per version: the chart
// version with a leading "v", as every ConfigHub package version is written.
// A package revision, packages/<repo>/<chart>/<version>-r<n>/, is tagged the
// same way, v<version>-r<n>.

import { cpSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { readYaml, readYamlText, repoRoot, trackedExists, writeYaml } from "./proof-common.mjs";

export const GHCR_PACKAGES_REGISTRY = "ghcr.io/confighub/packages";
export const GHCR_PACKAGES_WORKFLOW = ".github/workflows/packages-publish.yml";
export const GHCR_PACKAGES_IDENTITY_REGEXP = "^https://github.com/confighub/helm-expt/.github/workflows/packages-publish.yml@refs/heads/main$";
export const GHCR_PACKAGES_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
export const GHCR_PACKAGES_RECEIPT_ROOT = "runs/ghcr-packages";
export const GHCR_PACKAGES_RECEIPT_KIND = "GhcrPackagePublicationReceipt";

// Names other repositories already publish under ghcr.io/confighub/packages.
// GHCR ties a package name to the repository that first pushed it and refuses a
// push from any other repository, so a chart may never take one of these.
export const RESERVED_NAMES = new Set(["argobot", "argocd", "confighub", "flux", "k8sbot", "registrybot", "sveltos"]);

// Names chosen by hand where the chart's own name would mislead in a registry
// shared by every ConfigHub package. Argo CD from the argo-helm chart sits
// beside `argocd`, which is built from Argo CD's own install manifests and
// versioned by Argo CD rather than by the chart. The others are charts whose
// name says nothing without its repository.
export const NAME_OVERRIDES = new Map([
  ["argo-cd/argo-cd", "argo-cd-helm"],
  ["aws-controllers-k8s/ec2-chart", "ack-ec2-controller"],
  ["aws-controllers-k8s/eks-chart", "ack-eks-controller"],
  ["aws-controllers-k8s/iam-chart", "ack-iam-controller"],
  ["fairwinds-stable/vpa", "fairwinds-vpa"],
  ["hashicorp/terraform", "hashicorp-terraform"],
  ["istio/gateway", "istio-gateway"],
  ["minio-operator/operator", "minio-operator"],
  ["minio-operator/tenant", "minio-tenant"],
  ["nats/surveyor", "nats-surveyor"],
]);

const OCI_NAME = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function packagesRoot(root = repoRoot) {
  return join(root, "packages");
}

function isDir(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

// compareVersions orders chart versions as SemVer does, ignoring a leading "v".
// A prerelease sorts below its release. A package revision, <version>-r<n>
// (docs/reference/how-the-catalog-is-built.md), sorts above the version it
// corrects and below the next one.
export function compareVersions(left, right) {
  const parse = (value) => {
    const [core, suffix = ""] = String(value).replace(/^v/, "").split("+")[0].split(/-(.*)/s);
    const revision = /^r([1-9][0-9]*)$/.exec(suffix);
    return {
      parts: core.split(".").map((part) => Number.parseInt(part, 10) || 0),
      pre: revision ? "" : suffix,
      revision: revision ? Number(revision[1]) : 0,
    };
  };
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i += 1) {
    const diff = (a.parts[i] ?? 0) - (b.parts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (a.revision !== b.revision) return a.revision - b.revision;
  if (a.pre === b.pre) return 0;
  if (a.pre === "") return 1;
  if (b.pre === "") return -1;
  return a.pre < b.pre ? -1 : 1;
}

// catalogCharts lists every chart that has at least one packaged version, with
// its versions oldest first.
export function catalogCharts(root = repoRoot) {
  const charts = [];
  const base = packagesRoot(root);
  for (const repo of readdirSync(base).sort()) {
    if (!isDir(join(base, repo))) continue;
    for (const chart of readdirSync(join(base, repo)).sort()) {
      const chartDir = join(base, repo, chart);
      if (!isDir(chartDir)) continue;
      const versions = readdirSync(chartDir)
        .filter((version) => existsSync(join(chartDir, version, "installer.yaml")))
        .sort(compareVersions);
      if (versions.length === 0) continue;
      charts.push({ ref: `${repo}/${chart}`, repo, chart, dir: chartDir, versions, newest: versions.at(-1) });
    }
  }
  return charts;
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// shortNames gives each chart the name it is published and installed by: the
// chart's own name, unless a hand-chosen override applies, or the name is
// reserved or shared by charts from two repositories. Then it is
// <repo>-<chart>, the name the chart has always had in the catalog's registry.
export function shortNames(charts) {
  const byChart = new Map();
  for (const { chart } of charts) byChart.set(chart, (byChart.get(chart) ?? 0) + 1);
  const names = new Map();
  for (const { ref, repo, chart } of charts) {
    let name = NAME_OVERRIDES.get(ref);
    if (!name) {
      const plain = normalize(chart);
      name = byChart.get(chart) > 1 || RESERVED_NAMES.has(plain) ? normalize(`${repo}-${chart}`) : plain;
    }
    names.set(ref, name);
  }
  return names;
}

// nameProblems returns what is wrong with a set of names: an invalid OCI name,
// a reserved name, or two charts on one name.
export function nameProblems(names) {
  const problems = [];
  const owners = new Map();
  for (const [ref, name] of names) {
    if (!OCI_NAME.test(name)) problems.push(`${ref}: "${name}" is not a valid OCI repository name`);
    if (RESERVED_NAMES.has(name)) problems.push(`${ref}: "${name}" is published by another repository`);
    if (owners.has(name)) problems.push(`${ref}: "${name}" is already the name of ${owners.get(name)}`);
    owners.set(name, ref);
  }
  return problems;
}

export function ghcrTag(version) {
  return `v${String(version).replace(/^v/, "")}`;
}

// stagePackage copies a package version to dest and writes the two fields
// `cub package install` reads from installer.yaml: metadata.name, which names
// the installer record in the Space, and installerMetadata.version, which the
// record and `cub package show` report. The catalog's own files record the
// version as metadata.version, which the installer does not read.
export function stagePackage(source, dest, { name, tag }) {
  cpSync(source, dest, { recursive: true });
  const path = join(dest, "installer.yaml");
  const manifest = readYaml(path);
  const { version: _catalogVersion, ...metadata } = manifest.metadata ?? {};
  const { apiVersion, kind, metadata: _metadata, installerMetadata = {}, ...rest } = manifest;
  writeYaml(path, {
    apiVersion,
    kind,
    metadata: { ...metadata, name },
    installerMetadata: { ...installerMetadata, version: tag },
    ...rest,
  });
  return path;
}

// --- publication receipts ------------------------------------------------------
//
// A receipt under runs/ghcr-packages/<name>/<tag>.yaml records that the tag
// was read with no credentials at a manifest digest, and that the digest's
// signature verifies as the publish workflow on main. A version with a
// committed receipt is published: the Catalog names it by that digest. The
// receipt is written by `node scripts/publish-ghcr-packages.mjs --observe`,
// which needs no credential, so the nightly package job commits the receipts
// of whatever the publish workflow published since its last run.

export const ghcrPackageReceiptRel = (name, tag) => `${GHCR_PACKAGES_RECEIPT_ROOT}/${name}/${tag}.yaml`;

export function ghcrPackageInstallCommand(name, tag, space = "<space>") {
  return `cub package install ${name}:${tag} --space ${space}`;
}

export function ghcrPackageVerifyCommand(immutableReference) {
  return `cosign verify --certificate-identity-regexp '${GHCR_PACKAGES_IDENTITY_REGEXP}' --certificate-oidc-issuer ${GHCR_PACKAGES_OIDC_ISSUER} ${String(immutableReference).replace(/^oci:\/\//, "")}`;
}

let namesByChart;

// Where a chart version is published on GHCR, whether or not it is yet.
export function ghcrPackageIdentity(chartRef, version) {
  namesByChart ??= shortNames(catalogCharts());
  const name = namesByChart.get(chartRef);
  if (!name) return null;
  const tag = ghcrTag(version);
  const repository = `${GHCR_PACKAGES_REGISTRY}/${name}`;
  return { chart: chartRef, version: String(version), name, tag, repository, reference: `${repository}:${tag}`, packagePath: `packages/${chartRef}/${version}` };
}

export function ghcrPackageReceiptDoc(identity, { manifestDigest, layerDigest, observedAt, signature, anonymousPull }) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: GHCR_PACKAGES_RECEIPT_KIND,
    metadata: { name: identity.name },
    spec: {
      chart: identity.chart,
      version: identity.version,
      packagePath: identity.packagePath,
      tag: identity.tag,
      reference: identity.reference,
      immutableReference: `${identity.repository}@${manifestDigest}`,
      manifestDigest,
      layerDigest,
      installCommand: ghcrPackageInstallCommand(identity.name, identity.tag),
      publisher: GHCR_PACKAGES_WORKFLOW,
      signature,
      anonymousPull,
      observedAt,
    },
    status: { result: "pass" },
  };
}

const DIGEST = /^sha256:[0-9a-f]{64}$/;

// Why a receipt is not the receipt of this chart version. Empty when it is.
export function ghcrPackageReceiptProblems(receipt, identity) {
  const problems = [];
  const expect = (condition, message) => { if (!condition) problems.push(message); };
  const spec = receipt?.spec ?? {};
  expect(receipt?.kind === GHCR_PACKAGES_RECEIPT_KIND, `it is a ${receipt?.kind ?? "nothing"}, not a ${GHCR_PACKAGES_RECEIPT_KIND}`);
  expect(receipt?.metadata?.name === identity.name, `it names ${receipt?.metadata?.name}, and the package is ${identity.name}`);
  expect(spec.chart === identity.chart && String(spec.version) === identity.version, `it records ${spec.chart}@${spec.version}`);
  expect(spec.packagePath === identity.packagePath, `it records the package ${spec.packagePath}`);
  expect(spec.reference === identity.reference, `it records ${spec.reference}, and the package is ${identity.reference}`);
  expect(DIGEST.test(String(spec.manifestDigest ?? "")), "it records no valid manifest digest");
  expect(DIGEST.test(String(spec.layerDigest ?? "")), "it records no valid layer digest");
  expect(spec.immutableReference === `${identity.repository}@${spec.manifestDigest}`, "its immutable reference is not the repository at its manifest digest");
  expect(spec.anonymousPull?.result === "pass" && spec.anonymousPull?.digest === spec.manifestDigest, "it records no anonymous pull of that digest");
  expect(spec.signature?.result === "verified", "it records no verified signature");
  expect(spec.signature?.identityRegexp === GHCR_PACKAGES_IDENTITY_REGEXP && spec.signature?.issuer === GHCR_PACKAGES_OIDC_ISSUER, "its signature was not checked against the publish workflow identity");
  return problems;
}

// The GHCR publication of a chart version, read from its committed receipt,
// or null when none is committed. A receipt that is not this version's fails.
export function ghcrPackagePublication(chartRef, version, { root = repoRoot } = {}) {
  const identity = ghcrPackageIdentity(chartRef, version);
  if (!identity) return null;
  const rel = ghcrPackageReceiptRel(identity.name, identity.tag);
  const path = join(root, rel);
  if (!existsSync(path) || !trackedExists(path)) return null;
  const receipt = readYamlText(readFileSync(path, "utf8"));
  const problems = ghcrPackageReceiptProblems(receipt, identity);
  if (problems.length > 0) throw new Error(`${rel} is not a receipt of ${identity.reference}: ${problems.join("; ")}`);
  const { manifestDigest, layerDigest, immutableReference, observedAt } = receipt.spec;
  return {
    ...identity,
    tagRef: `oci://${identity.reference}`,
    exactRef: `oci://${identity.reference}@${manifestDigest}`,
    immutableReference,
    manifestDigest,
    layerDigest,
    receiptPath: rel,
    observedAt: String(observedAt ?? ""),
    installCommand: ghcrPackageInstallCommand(identity.name, identity.tag),
    verifyCommand: ghcrPackageVerifyCommand(immutableReference),
  };
}
