// Integration test: requires cub locally, but no registry or cluster access.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readYaml, repoRoot } from "./lib/proof-common.mjs";

const scratch = mkdtempSync(join(tmpdir(), "variant-facts-test-"));
try {
  const chart = "bitnami/redis/25.5.3";
  const recipe = join(scratch, "recipes", chart);
  const pkg = join(scratch, "packages", chart);
  cpSync(join(repoRoot, "recipes", chart), recipe, { recursive: true });
  cpSync(join(repoRoot, "packages", chart), pkg, { recursive: true });
  cpSync(join(repoRoot, "scripts/lib"), join(scratch, "scripts/lib"), { recursive: true });
  for (const file of ["generate-variant-proof.mjs", "sync-installer-target-facts.mjs"])
    cpSync(join(repoRoot, "scripts", file), join(scratch, "scripts", file));
  const bin = join(scratch, "bin");
  mkdirSync(bin);
  // Replay a committed Helm render, isolating this test to the real generator,
  // package builder, target-facts synchronizer and cub setup collector.
  const render = join(recipe, "revisions/reuse-existing-secret/r001/rendered/release-objects.yaml");
  const stub = `#!${process.execPath}\nimport fs from 'node:fs';\nif (process.argv[2] === 'template') process.stdout.write(fs.readFileSync(${JSON.stringify(render)}, 'utf8'));\nelse if (process.argv[2] !== 'repo') process.exit(1);\n`;
  writeFileSync(join(bin, "helm"), stub, { mode: 0o755 });
  const variant = "required-secret-fixture";
  const result = spawnSync(process.execPath, [join(scratch, "scripts/generate-variant-proof.mjs"), chart, variant,
    "--base", "reuse-existing-secret", "--set", "auth.existingSecret=redis-existing-auth"], {
    cwd: scratch, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: "utf8", timeout: 180000,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const facts = readYaml(join(recipe, "variants", variant, "variant.yaml")).spec.targetFacts.requiredSecrets;
  assert.ok(facts.length > 0);
  const installer = readYaml(join(pkg, "installer.yaml"));
  const base = installer.spec.bases.find((base) => base.name === variant);
  for (const secret of facts) {
    assert.ok(base.externalRequires.some((requirement) => requirement.namespace === secret.namespace && requirement.suggestedSource.includes(secret.name)));
  }
  const receipt = readYaml(join(recipe, "publication/installer-package-receipt.yaml"));
  const setup = receipt.spec.setupChecks.find((item) => item.variant === variant);
  assert.equal(setup.targetFactMode, "collector-facts");
  assert.equal(setup.targetFactsBound, true);
  assert.ok(receipt.spec.package.sourceFiles.some((item) => item.path === "collector/target-facts.sh"));
  // Independently invoke the mandatory gate after generation; it executes cub
  // setup and compares collected Secret facts, source-file hashes and sizes.
  const verify = spawnSync(process.execPath, [join(scratch, "scripts/sync-installer-target-facts.mjs"), "--verify", "--recipe", `recipes/${chart}`], {
    cwd: scratch, encoding: "utf8", timeout: 180000,
  });
  assert.equal(verify.status, 0, `${verify.stdout}\n${verify.stderr}`);
  console.log("variant generator retains inferred prerequisites in the package, collector and digest-bound receipt");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
