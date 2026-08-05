import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { listFiles, repoRoot } from "./proof-common.mjs";
import { KUBARA_CATALOG_1_1_ADDITIONS } from "./kubara-catalog-1-1-full-coverage.mjs";
import { KUBARA_CATALOG_ADDITIONS } from "./kubara-catalog-release.mjs";

// Additive Kubara recipe roots are immutable inputs after promotion.  Catalog
// status, indexes, and human-readable maps are derived views, so generating a
// release must not write those views back into a promoted recipe tree.  Keep
// them in a deterministic overlay while every other recipe retains its
// historical in-place layout.
export const CATALOG_DERIVED_VIEW_ROOT = join(
  repoRoot,
  "data",
  "kubara-catalog-release",
  "recipe-views",
);

const immutableRecipeKeys = new Set([
  ...KUBARA_CATALOG_ADDITIONS,
  ...KUBARA_CATALOG_1_1_ADDITIONS.map((item) => `${item.canonicalIdentity}/${item.version}`),
]);

export function recipeRoots() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
}

export function immutableCatalogRecipeRoot(recipeRoot) {
  return immutableRecipeKeys.has(recipeKey(recipeRoot));
}

export function catalogDerivedPath(recipeRoot, fileName) {
  if (!immutableCatalogRecipeRoot(recipeRoot)) return join(recipeRoot, fileName);
  return join(CATALOG_DERIVED_VIEW_ROOT, "recipes", recipeKey(recipeRoot), fileName);
}

export function catalogDerivedPaths(fileName, { existingOnly = false } = {}) {
  const paths = recipeRoots().map((root) => catalogDerivedPath(root, fileName));
  return existingOnly ? paths.filter(existsSync) : paths;
}

function recipeKey(recipeRoot) {
  const relativePath = relative(join(repoRoot, "recipes"), recipeRoot).replaceAll("\\", "/");
  if (!relativePath || relativePath.startsWith("../")) {
    throw new Error(`${recipeRoot}: expected a recipe root beneath ${join(repoRoot, "recipes")}`);
  }
  return relativePath;
}
