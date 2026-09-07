// Exercise the real CLI in a disposable repository; no retained status is edited.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readYaml, repoRoot } from "./lib/proof-common.mjs";
import { KUBARA_CATALOG_ADDITIONS } from "./lib/kubara-catalog-release.mjs";

const scratch = mkdtempSync(join(tmpdir(), "catalog-status-initialization-"));
try {
  cpSync(join(repoRoot, "scripts/lib"), join(scratch, "scripts/lib"), { recursive: true });
  cpSync(join(repoRoot, "scripts/generate-catalog-status.mjs"), join(scratch, "scripts/generate-catalog-status.mjs"));
  const run = (...args) => spawnSync(process.execPath, [join(scratch, "scripts/generate-catalog-status.mjs"), ...args], {
    cwd: scratch, encoding: "utf8", timeout: 30000,
  });
  const passes = (...args) => {
    const result = run(...args);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  };
  const fixture = (key) => {
    const root = join(scratch, "recipes", key);
    mkdirSync(root, { recursive: true });
    const [repository, chart, version] = key.split("/");
    const write = (file, data) => writeFileSync(join(root, file), JSON.stringify(data));
    write("recipe.yaml", { metadata: { labels: { "confighub.io/proof-tier": "next80-full" } }, spec: { variants: ["variants/default/variant.yaml"] } });
    write("source-lock.yaml", { spec: { ref: `${repository}/${chart}`, version } });
    write("helm-plan.yaml", { spec: { readiness: { chart: `${repository}/${chart}`, version } } });
    return root;
  };

  const fresh = fixture("example/new-chart/1.0.0");
  const unrelated = fixture("example/other-chart/1.0.0");
  passes("--generate", "--recipe", "recipes/example/new-chart/1.0.0");
  const freshPath = join(fresh, "catalog-status.yaml");
  const freshStatus = readYaml(freshPath);
  assert.equal(freshStatus.spec.review.lastReviewed, null);
  assert.equal(freshStatus.spec.review.humanReviewRequired, true);
  assert.equal(freshStatus.spec.review.productReviewRequired, true);
  assert.equal(freshStatus.spec.status, "proof-grade");
  assert.deepEqual(freshStatus.spec.supportedVariants, []);
  assert.equal(existsSync(join(unrelated, "catalog-status.yaml")), false);
  const first = readFileSync(freshPath, "utf8");
  passes("--generate", "--recipe", "recipes/example/new-chart/1.0.0");
  assert.equal(readFileSync(freshPath, "utf8"), first);
  passes("--verify", "--recipe", "recipes/example/new-chart/1.0.0");

  const retainedKey = "argo-cd/argo-workflows/1.0.14";
  const retainedRoot = join(scratch, "recipes", retainedKey);
  mkdirSync(retainedRoot, { recursive: true });
  for (const file of ["recipe.yaml", "source-lock.yaml", "helm-plan.yaml", "catalog-status.yaml"]) {
    cpSync(join(repoRoot, "recipes", retainedKey, file), join(retainedRoot, file));
  }
  const retainedPath = join(retainedRoot, "catalog-status.yaml");
  const retainedBytes = readFileSync(retainedPath, "utf8");
  assert.ok(readYaml(retainedPath).spec.notes.some((note) => note.includes("controller-default-reviewed is a realized useful-base alias")));
  passes("--generate", "--recipe", `recipes/${retainedKey}`);
  assert.equal(readFileSync(retainedPath, "utf8"), retainedBytes);

  const blocked = readYaml(retainedPath);
  blocked.spec.status = "blocked";
  blocked.spec.review.lastReviewed = null;
  writeFileSync(retainedPath, JSON.stringify(blocked));
  const blockedBytes = readFileSync(retainedPath, "utf8");
  passes("--generate");
  assert.equal(readFileSync(retainedPath, "utf8"), blockedBytes);
  assert.equal(readYaml(retainedPath).spec.status, "blocked");
  blocked.spec.version = "wrong-version";
  writeFileSync(retainedPath, JSON.stringify(blocked));
  const mismatch = run("--generate", "--recipe", `recipes/${retainedKey}`);
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /does not identify/);
  assert.notEqual(run("--verify", "--recipe", `recipes/${retainedKey}`).status, 0);

  // Exercise the global path with enough complete roots to pass its inventory
  // preconditions. Disable only recursive self-test bootstrap in this fixture.
  writeFileSync(join(scratch, "scripts/test-catalog-status-initialization.mjs"), "// Self-test bootstrap already exercised by the parent.\n");
  for (let index = 0; index < 100; index++) fixture(`inventory/chart-${index}/1.0.0`);
  for (const repository of readdirSync(join(scratch, "recipes"))) {
    for (const chart of readdirSync(join(scratch, "recipes", repository))) {
      const version = readdirSync(join(scratch, "recipes", repository, chart))[0];
      const actualRoot = join(scratch, "packages", repository, chart, version);
      mkdirSync(actualRoot, { recursive: true });
      writeFileSync(join(actualRoot, "installer.yaml"), "{}");
    }
  }
  const globalMismatch = run("--verify");
  assert.notEqual(globalMismatch.status, 0);
  assert.match(globalMismatch.stderr, /does not identify/);

  const immutableKey = KUBARA_CATALOG_ADDITIONS[0];
  const immutableRoot = fixture(immutableKey);
  passes("--generate", "--recipe", `recipes/${immutableKey}`);
  assert.equal(existsSync(join(immutableRoot, "catalog-status.yaml")), false);
  assert.equal(existsSync(join(scratch, "data/kubara-catalog-release/recipe-views/recipes", immutableKey, "catalog-status.yaml")), true);

  assert.notEqual(run("--generate", "--recipe").status, 0);
  assert.notEqual(run("--generate", "--recipe", "recipes").status, 0);
  const outside = join(scratch, "outside");
  mkdirSync(outside);
  symlinkSync(outside, join(scratch, "recipes/escaped"));
  assert.notEqual(run("--generate", "--recipe", "recipes/escaped").status, 0);
  console.log("catalog status initialization: unknown review date, retained notes/blocked state, bounded selection and immutable overlays verified");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
