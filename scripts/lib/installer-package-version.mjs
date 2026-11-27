// The version an installer package is written and published under.
//
// A package's version is its upstream chart's version with a leading v. A
// chart that writes its versions without the v gets one added, so
// traefik/traefik 41.4.0 would be packaged as v41.4.0, and a chart that already
// writes the v, such as jetstack/cert-manager v1.21.1, keeps it as it is.
//
// Packages that exist already keep the spelling they were made under. Their
// tags, digests, signatures and receipts are public, and pinned references to
// them would break if they were renamed. A package exists when the generated
// package index has a published row for it, or when its directory already
// holds an installer.yaml. Everything else is a new package and gets the v.
//
// Only installer.yaml metadata.version and the registry tag carry the v. The
// package directory stays named by the chart version,
// packages/<repo>/<chart>/<chart version>, because recipes, receipts and
// verifiers all find a package by its chart version.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import { readYaml, repoRoot } from "./proof-common.mjs";

export const INSTALLER_OCI_PACKAGE_INDEX = join(repoRoot, "data", "installer-oci-packages", "packages.json");

let publishedVersions;

export function withLeadingV(version) {
  const text = String(version ?? "");
  if (!text || text.startsWith("v")) return text;
  return `v${text}`;
}

// Published tags keyed by canonical package path, packages/<repo>/<chart>/<chart version>.
export function publishedInstallerPackageVersions() {
  if (!publishedVersions) {
    publishedVersions = new Map();
    if (existsSync(INSTALLER_OCI_PACKAGE_INDEX)) {
      const index = JSON.parse(readFileSync(INSTALLER_OCI_PACKAGE_INDEX, "utf8"));
      for (const row of index.packages ?? []) {
        if (row.publication_status !== "published-receipt") continue;
        const ref = String(row.installer_oci_ref ?? "");
        const tag = ref.slice(ref.lastIndexOf(":") + 1);
        if (row.package_path && tag) publishedVersions.set(String(row.package_path), tag);
      }
    }
  }
  return publishedVersions;
}

// The version to write into installer.yaml and to tag the package with.
// chartRef is <repo>/<chart>. packageRoot names the directory being generated
// when it is not the canonical one, as candidate and scratch roots are.
export function installerPackageVersion(chartRef, chartVersion, { packageRoot } = {}) {
  const canonical = canonicalPackagePath(chartRef, chartVersion);
  const published = publishedInstallerPackageVersions().get(canonical);
  if (published) return published;
  const roots = [join(repoRoot, canonical)];
  if (packageRoot) roots.unshift(isAbsolute(packageRoot) ? packageRoot : join(repoRoot, packageRoot));
  for (const root of roots) {
    const existing = existingInstallerVersion(root);
    if (existing) return existing;
  }
  return withLeadingV(chartVersion);
}

// What a verifier requires, from evidence that does not come from the
// installer.yaml being checked: the published spelling for a package that has
// been published, and the v rule for anything else.
export function requiredInstallerPackageVersion(chartRef, chartVersion) {
  return publishedInstallerPackageVersions().get(canonicalPackagePath(chartRef, chartVersion))
    ?? withLeadingV(chartVersion);
}

export function installerPackageVersionProblem(actual, chartRef, chartVersion) {
  const required = requiredInstallerPackageVersion(chartRef, chartVersion);
  if (String(actual ?? "") === required) return "";
  const published = publishedInstallerPackageVersions().has(canonicalPackagePath(chartRef, chartVersion));
  return published
    ? `${chartRef}@${chartVersion}: installer.yaml metadata.version is ${actual}, and the package was published as ${required}; a published package keeps its spelling`
    : `${chartRef}@${chartVersion}: installer.yaml metadata.version is ${actual}, and a new package is versioned ${required}, the chart version with a leading v`;
}

function canonicalPackagePath(chartRef, chartVersion) {
  return `packages/${chartRef}/${chartVersion}`;
}

function existingInstallerVersion(root) {
  const path = join(root, "installer.yaml");
  if (!existsSync(path)) return "";
  return String(readYaml(path)?.metadata?.version ?? "");
}
