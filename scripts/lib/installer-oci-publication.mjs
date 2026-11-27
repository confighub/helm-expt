import { existsSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot } from "./proof-common.mjs";
import {
  installerOciDigestRef,
  installerOciName,
  installerOciPackageTag,
  installerOciRef,
} from "./installer-oci.mjs";

export function installerOciPublication(chart, version, options = {}) {
  const { required = true } = options;
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
    // A version declared pending publication answers "not published yet"
    // rather than failing; anything else without a receipt still fails.
    check(
      !required || pendingPublicationRecipes().has(`recipes/${chart}/${version}`),
      `${relativeRepo(receiptPath)} is missing for ${chart}@${version}`,
    );
    return {
      published: false,
      tagRef,
      exactRef: "",
      manifestDigest: "",
      layerDigest: "",
      packageDigest: "",
      receiptPath: "",
    };
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

// Package versions that exist in packages/ and recipes/ but are not yet in the
// catalog registry, declared in data/package-updates/pending-publication.yaml.
// The nightly package update adds a new version there: it builds and checks
// the package, and a person merging it is what starts publication. Until the
// publication receipt exists, the catalog maps leave the version out instead
// of refusing it, because a catalog entry has to name a digest a user can
// pull. The register is a ratchet: a declared version that has its receipt,
// or no recipe, fails here until its entry is removed.
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
