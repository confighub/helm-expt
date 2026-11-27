// Names, tags and staging for publishing the catalog's installer packages to
// ghcr.io/confighub/packages/<name>, the one place `cub package install <name>`
// looks a package up by name.
//
// The catalog keeps one directory per chart version under
// packages/<repo>/<chart>/<version>/. Each chart is published as one OCI
// repository, named by its chart name, with one tag per version: the chart
// version with a leading "v", as every ConfigHub package version is written.

import { cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readYaml, repoRoot, writeYaml } from "./proof-common.mjs";

export const GHCR_PACKAGES_REGISTRY = "ghcr.io/confighub/packages";

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
// A prerelease sorts below its release.
export function compareVersions(left, right) {
  const parse = (value) => {
    const [core, pre = ""] = String(value).replace(/^v/, "").split("+")[0].split(/-(.*)/s);
    return { parts: core.split(".").map((part) => Number.parseInt(part, 10) || 0), pre };
  };
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i += 1) {
    const diff = (a.parts[i] ?? 0) - (b.parts[i] ?? 0);
    if (diff !== 0) return diff;
  }
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
