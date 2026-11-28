import { existsSync } from "node:fs";
import { join } from "node:path";

import { ghcrPackageIdentity, ghcrPackagePublication } from "./ghcr-packages.mjs";
import { check, readYaml, relativeRepo, repoRoot } from "./proof-common.mjs";
import {
  installerOciDigestRef,
  installerOciName,
  installerOciPackageTag,
  installerOciRef,
} from "./installer-oci.mjs";

// Where a chart version's installer package is published, read from the
// committed receipts.
//
// A version is published when a receipt records it on GHCR
// (runs/ghcr-packages/<name>/<tag>.yaml) or in the earlier Google registry
// (runs/installer-oci/<name>/<tag>/installer-package-publication-receipt.yaml).
// GHCR is where `cub package install <name>:<tag>` looks a package up, so a
// GHCR receipt makes GHCR the reference every consumer names, and the Google
// copy, when there is one, is kept as the earlier location. The two are
// different bytes: the GHCR build carries the published name and tag in its
// installer.yaml.
export function installerOciPublication(chart, version, options = {}) {
  const { required = true } = options;
  const ghcr = ghcrPackagePublication(chart, version);
  const earlier = earlierPublication(chart, version);
  const identity = ghcrPackageIdentity(chart, version);

  if (!ghcr && !earlier.published) {
    // A version declared pending publication answers "not published yet"
    // rather than failing; anything else without a receipt still fails.
    check(
      !required || pendingPublicationRecipes().has(`recipes/${chart}/${version}`),
      `${chart}@${version} has no publication receipt: run node scripts/publish-ghcr-packages.mjs --observe to record its GHCR publication`,
    );
    return {
      published: false,
      registry: "",
      tagRef: identity ? `oci://${identity.reference}` : earlier.tagRef,
      exactRef: "",
      manifestDigest: "",
      layerDigest: "",
      packageDigest: "",
      receiptPath: "",
      packageName: identity?.name ?? "",
      packageTag: identity?.tag ?? "",
      installCommand: "",
      verifyCommand: "",
      earlier: null,
    };
  }

  const earlierLocation = earlier.published
    ? {
      tagRef: earlier.tagRef,
      exactRef: earlier.exactRef,
      manifestDigest: earlier.manifestDigest,
      layerDigest: earlier.layerDigest,
      packageDigest: earlier.packageDigest,
      receiptPath: earlier.receiptPath,
    }
    : null;
  if (ghcr) {
    return {
      published: true,
      registry: "ghcr",
      tagRef: ghcr.tagRef,
      exactRef: ghcr.exactRef,
      manifestDigest: ghcr.manifestDigest,
      layerDigest: ghcr.layerDigest,
      packageDigest: earlier.packageDigest,
      receiptPath: ghcr.receiptPath,
      packageName: ghcr.name,
      packageTag: ghcr.tag,
      installCommand: ghcr.installCommand,
      verifyCommand: ghcr.verifyCommand,
      earlier: earlierLocation,
    };
  }
  return {
    ...earlier,
    registry: "earlier",
    packageName: identity?.name ?? "",
    packageTag: identity?.tag ?? "",
    installCommand: "",
    verifyCommand: "",
    earlier: null,
  };
}

// The earlier Google registry publication of a chart version, when its
// receipt exists.
function earlierPublication(chart, version) {
  const tagRef = installerOciRef(chart, version);
  const receiptPath = join(
    repoRoot,
    "runs",
    "installer-oci",
    installerOciName(chart),
    installerOciPackageTag(chart, version),
    "installer-package-publication-receipt.yaml",
  );

  if (!existsSync(receiptPath)) {
    return { published: false, tagRef, exactRef: "", manifestDigest: "", layerDigest: "", packageDigest: "", receiptPath: "" };
  }

  const receipt = readYaml(receiptPath);
  const receiptRef = String(receipt?.spec?.ref ?? "");
  const packageDigest = String(receipt?.spec?.package?.sha256 ?? "");
  const pushOutput = String(receipt?.spec?.outputs?.push ?? "");
  const manifestDigest = String(
    receipt?.spec?.outputs?.manifestDigest
      ?? pushOutput.match(/manifest:\s+(sha256:[0-9a-f]{64})/u)?.[1]
      ?? "",
  );
  const layerDigest = String(
    receipt?.spec?.outputs?.layerDigest
      ?? pushOutput.match(/layer:\s+(sha256:[0-9a-f]{64})/u)?.[1]
      ?? "",
  );

  check(receiptRef === tagRef, `${relativeRepo(receiptPath)} ref does not match ${tagRef}`);
  check(/^[0-9a-f]{64}$/u.test(packageDigest), `${relativeRepo(receiptPath)} has no valid package digest`);
  check(/^sha256:[0-9a-f]{64}$/u.test(manifestDigest), `${relativeRepo(receiptPath)} has no valid manifest digest`);
  check(/^sha256:[0-9a-f]{64}$/u.test(layerDigest), `${relativeRepo(receiptPath)} has no valid layer digest`);
  check(layerDigest === `sha256:${packageDigest}`, `${relativeRepo(receiptPath)} layer and package digests differ`);

  return {
    published: true,
    tagRef,
    exactRef: installerOciDigestRef(tagRef, manifestDigest),
    manifestDigest,
    layerDigest,
    packageDigest,
    receiptPath: relativeRepo(receiptPath),
  };
}

export function installerOciConsumerRef(chart, version, options = {}) {
  const publication = installerOciPublication(chart, version, options);
  return publication.exactRef || publication.tagRef;
}

// Package versions that exist in packages/ and recipes/ but are not yet
// published, declared in data/package-updates/pending-publication.yaml. The
// nightly package update adds a new version there: it builds and checks the
// package, and merging it is what starts publication to GHCR. Until a
// publication receipt exists, the catalog maps leave the version out instead
// of refusing it, because a catalog entry has to name a digest a user can
// pull. The next nightly run records the GHCR receipt and takes the version
// off the register. The register is a ratchet: a declared version that has a
// receipt, or no recipe, fails here until its entry is removed.
export const PENDING_PUBLICATION_REGISTER = join(repoRoot, "data", "package-updates", "pending-publication.yaml");

let pendingRecipes;

export function pendingPublicationRecipes() {
  if (pendingRecipes) return pendingRecipes;
  pendingRecipes = new Set();
  if (!existsSync(PENDING_PUBLICATION_REGISTER)) return pendingRecipes;
  const register = readYaml(PENDING_PUBLICATION_REGISTER);
  check(register?.kind === "PackagesPendingPublication", `${relativeRepo(PENDING_PUBLICATION_REGISTER)}: expected kind PackagesPendingPublication`);
  for (const entry of register.spec?.packages ?? []) {
    const chart = String(entry.chart ?? "");
    const version = String(entry.version ?? "");
    const recipe = `recipes/${chart}/${version}`;
    check(/^[a-z0-9.-]+\/[a-z0-9.-]+$/.test(chart) && version, `${relativeRepo(PENDING_PUBLICATION_REGISTER)}: bad entry ${JSON.stringify(entry)}`);
    check(existsSync(join(repoRoot, recipe, "recipe.yaml")), `${relativeRepo(PENDING_PUBLICATION_REGISTER)} declares ${chart}@${version}, which has no recipe`);
    check(existsSync(join(repoRoot, "packages", chart, version, "installer.yaml")), `${relativeRepo(PENDING_PUBLICATION_REGISTER)} declares ${chart}@${version}, which has no package`);
    check(
      !installerOciPublication(chart, version, { required: false }).published,
      `${chart}@${version} is published; remove it from ${relativeRepo(PENDING_PUBLICATION_REGISTER)}`,
    );
    pendingRecipes.add(recipe);
  }
  return pendingRecipes;
}

export function isPendingPublication(recipeRoot) {
  return pendingPublicationRecipes().has(relativeRepo(recipeRoot));
}
