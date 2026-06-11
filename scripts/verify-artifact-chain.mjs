import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
} from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");

if (selfTest) {
  runSelfTest();
} else {
  const result = verifyCurrentArtifactChain(repoRoot);
  check(result.recipeCount >= 100, `expected at least 100 recipe roots, found ${result.recipeCount}`);
  check(result.packageCount >= 100, `expected at least 100 installer packages, found ${result.packageCount}`);
  console.log(`verified current artifact chain for ${result.recipeCount} recipe(s) and ${result.packageCount} package(s)`);
}

function verifyCurrentArtifactChain(root, expectedCount = null) {
  const recipeRoots = listFiles(join(root, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
  const packageInstallers = listFiles(join(root, "packages")).filter((file) => file.endsWith("/installer.yaml")).sort();

  if (expectedCount !== null) {
    check(recipeRoots.length === expectedCount, `expected ${expectedCount} recipe roots, found ${recipeRoots.length}`);
    check(packageInstallers.length === expectedCount, `expected ${expectedCount} installer packages, found ${packageInstallers.length}`);
  }

  for (const recipeRoot of recipeRoots) verifyRecipeRoot(recipeRoot, root);

  return { recipeCount: recipeRoots.length, packageCount: packageInstallers.length };
}

function verifyRecipeRoot(recipeRoot, root) {
  for (const relative of [
    "README.md",
    "helm-plan.yaml",
    "chart-dossier.yaml",
    "source-lock.yaml",
    "dependency-lock.yaml",
    "control-points.yaml",
    "value-model.yaml",
    "recipe.yaml",
    "publication/installer-package-receipt.yaml",
  ]) {
    check(existsSync(join(recipeRoot, relative)), `${relativeRepo(recipeRoot)} missing ${relative}`);
  }

  const recipe = readYaml(join(recipeRoot, "recipe.yaml"));
  const packageReceipt = readYaml(join(recipeRoot, "publication", "installer-package-receipt.yaml"));
  const fixturePath = recipe.spec?.currentExecutableFixture?.installerPackage;
  check(Boolean(fixturePath), `${relativeRepo(recipeRoot)} missing currentExecutableFixture.installerPackage`);
  check(
    fixturePath.startsWith("packages/") || fixturePath.startsWith("../../../../packages/"),
    `${relativeRepo(recipeRoot)} fixture must point at current packages/ path`,
  );
  const fixtureRoot = resolvePath(root, recipeRoot, fixturePath);
  check(existsSync(join(fixtureRoot, "installer.yaml")), `${relativeRepo(recipeRoot)} fixture package is missing installer.yaml`);

  const packagePath = packageReceipt.spec?.package?.path;
  check(Boolean(packagePath), `${relativeRepo(recipeRoot)} package receipt missing package.path`);
  check(packagePath.startsWith("packages/"), `${relativeRepo(recipeRoot)} package receipt must use repo-relative packages/ path`);
  const packageRoot = join(root, packagePath);
  check(existsSync(join(packageRoot, "installer.yaml")), `${relativeRepo(recipeRoot)} package receipt path is missing installer.yaml`);
  check(
    resolve(packageRoot) === resolve(fixtureRoot),
    `${relativeRepo(recipeRoot)} fixture path and package receipt path point at different packages`,
  );

  const installer = readYaml(join(packageRoot, "installer.yaml"));
  check(installer.kind === "Package", `${relativeRepo(packageRoot)} installer.yaml must be a Package`);
  verifyPackageReceipt(recipeRoot, packageRoot, packageReceipt);

  for (const variantPath of recipe.spec?.variants ?? []) {
    check(existsSync(join(recipeRoot, variantPath)), `${relativeRepo(recipeRoot)} missing variant ${variantPath}`);
  }

  const revisionFiles = listFiles(join(recipeRoot, "revisions"))
    .filter((file) => file.endsWith("/variant-revision.yaml"))
    .sort();
  check(revisionFiles.length > 0, `${relativeRepo(recipeRoot)} must have at least one variant revision`);
  for (const revisionFile of revisionFiles) verifyRevision(recipeRoot, dirname(revisionFile));
}

function verifyPackageReceipt(recipeRoot, packageRoot, receipt) {
  check(receipt.kind === "InstallerPackageReceipt", `${relativeRepo(recipeRoot)} publication receipt kind mismatch`);
  for (const file of receipt.spec?.package?.sourceFiles ?? []) {
    const path = join(packageRoot, file.path);
    check(existsSync(path), `${relativeRepo(recipeRoot)} package receipt references missing file ${file.path}`);
    check(sha256File(path) === file.sha256, `${relativeRepo(recipeRoot)} package source SHA mismatch for ${file.path}`);
    check(readFileSync(path).length === Number(file.bytes), `${relativeRepo(recipeRoot)} package byte length mismatch for ${file.path}`);
  }
}

function verifyRevision(recipeRoot, revisionRoot) {
  const paths = {
    revision: join(revisionRoot, "variant-revision.yaml"),
    release: join(revisionRoot, "rendered", "release-objects.yaml"),
    inventory: join(revisionRoot, "rendered", "object-inventory.yaml"),
    equivalence: join(revisionRoot, "receipts", "helm-equivalence-receipt.yaml"),
    render: join(revisionRoot, "receipts", "render-receipt.yaml"),
    scan: join(revisionRoot, "receipts", "scan-receipt.yaml"),
    gate: join(revisionRoot, "receipts", "install-gate.yaml"),
  };
  for (const [name, path] of Object.entries(paths)) {
    check(existsSync(path), `${relativeRepo(recipeRoot)} missing ${name} artifact under ${relativeRepo(revisionRoot)}`);
  }

  const releaseSHA = sha256File(paths.release);
  const sourceLockSHA = sha256File(join(recipeRoot, "source-lock.yaml"));
  const dependencyLockSHA = sha256File(join(recipeRoot, "dependency-lock.yaml"));
  const revision = readYaml(paths.revision);
  const inventory = readYaml(paths.inventory);
  const equivalence = readYaml(paths.equivalence);
  const render = readYaml(paths.render);
  const scan = readYaml(paths.scan);
  const gate = readYaml(paths.gate);

  check(
    revision.spec?.digestInputs?.renderedObjectSetSHA256 === releaseSHA,
    `${relativeRepo(revisionRoot)} variant revision rendered digest mismatch`,
  );
  check(inventory.spec?.sourceSHA256 === releaseSHA, `${relativeRepo(revisionRoot)} inventory source digest mismatch`);
  check(
    render.spec?.outputs?.renderedObjectSetSHA256 === releaseSHA,
    `${relativeRepo(revisionRoot)} render receipt digest mismatch`,
  );
  check(
    render.spec?.inputs?.sourceLockSHA256 === sourceLockSHA,
    `${relativeRepo(revisionRoot)} render receipt source-lock digest mismatch`,
  );
  check(
    render.spec?.inputs?.dependencyLockSHA256 === dependencyLockSHA,
    `${relativeRepo(revisionRoot)} render receipt dependency-lock digest mismatch`,
  );
  check(
    render.spec?.outputs?.deterministicAcrossTwoLocalRenders !== false,
    `${relativeRepo(revisionRoot)} render receipt marks render as non-deterministic`,
  );
  check(
    equivalence.spec?.regularHelm?.renderedSHA256 === releaseSHA,
    `${relativeRepo(revisionRoot)} Helm equivalence digest mismatch`,
  );
  check(equivalence.spec?.result === "pass", `${relativeRepo(revisionRoot)} Helm equivalence did not pass`);
  check(scan.spec?.renderedObjectSetSHA256 === releaseSHA, `${relativeRepo(revisionRoot)} scan digest mismatch`);
  check(gate.spec?.renderedObjectSetSHA256 === releaseSHA, `${relativeRepo(revisionRoot)} install gate digest mismatch`);
}

function resolvePath(root, base, path) {
  if (path.startsWith("packages/")) return join(root, path);
  return resolve(base, path);
}

function runSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-current-chain-"));
  try {
    const sourceRecipe = join(repoRoot, "recipes", "bitnami", "redis", "25.5.3");
    const sourcePackage = join(repoRoot, "packages", "bitnami", "redis", "25.5.3");
    const tempRecipe = join(tempRoot, "recipes", "bitnami", "redis", "25.5.3");
    const tempPackage = join(tempRoot, "packages", "bitnami", "redis", "25.5.3");
    cpSync(sourceRecipe, tempRecipe, { recursive: true });
    cpSync(sourcePackage, tempPackage, { recursive: true });
    writeFileSync(join(tempPackage, "README.md"), `${readFileSync(join(tempPackage, "README.md"), "utf8")}\n# tampered\n`);
    try {
      verifyRecipeRoot(tempRecipe, tempRoot);
    } catch (error) {
      if (String(error.message).includes("package source SHA mismatch")) {
        console.log("self-test passed: package source tampering is rejected");
        return;
      }
      throw error;
    }
    throw new Error("self-test unexpectedly passed after package source tampering");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
