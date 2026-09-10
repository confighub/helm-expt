import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { repoRoot } from "./lib/proof-common.mjs";

const scratch = mkdtempSync(join(tmpdir(), "helm-expt-flux-test-"));
const example = "examples/timoni/flux-aio-2-9-4-0";
const evidence = "runs/timoni-flux-aio-source/2.9.4-0";
try {
  for (const path of [example, evidence, "scripts/lib"]) cpSync(join(repoRoot, path), join(scratch, path), { recursive: true });
  for (const name of ["generate-timoni-flux-aio.mjs", "transform-config-oci.mjs"]) cpSync(join(repoRoot, "scripts", name), join(scratch, "scripts", name));
  const run = (mode = "--verify", env = {}) => spawnSync(process.execPath, [join(scratch, "scripts/generate-timoni-flux-aio.mjs"), mode], { cwd: scratch, env: { ...process.env, ...env }, encoding: "utf8", timeout: 60000 });
  const valid = run();
  assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`);
  for (const [path, expected] of [
    [`${evidence}/manifest.json`, /retained manifest does not match/],
    [`${evidence}/module.tgz`, /module layer digest mismatch/],
    [`${evidence}/vendor.tgz`, /module\/vendor layer digest mismatch/],
    [`${example}/module/timoni.cue`, /workflow differs from source lock/],
    [`${example}/module/templates/config.cue`, /moduleConfig differs from source lock/],
    [`${example}/selected-values.cue`, /generation-receipt.yaml is stale/],
    [`${example}/rendered/release-objects.yaml`, /object-inventory.json is stale/],
  ]) {
    const target = join(scratch, path);
    const original = readFileSync(target);
    try {
      writeFileSync(target, Buffer.concat([original, Buffer.from("\n")]));
      const result = run();
      assert.notEqual(result.status, 0, `${path}: altered input was accepted`);
      assert.match(`${result.stdout}\n${result.stderr}`, expected);
    } finally {
      writeFileSync(target, original);
    }
  }
  const bin = join(scratch, "bin");
  mkdirSync(bin);
  const marker = join(scratch, "unexpected-timoni-build");
  const stub = join(bin, "timoni");
  writeFileSync(stub, `#!${process.execPath}\nif(process.argv[2] === "version") console.log("client: 9.9.9"); else require("node:fs").writeFileSync(${JSON.stringify(marker)}, "unexpected command");\n`, { mode: 0o755 });
  const before = readFileSync(join(scratch, example, "generation-receipt.yaml"));
  const mismatch = run("--generate", { TIMONI_BIN: stub });
  assert.notEqual(mismatch.status, 0);
  assert.match(`${mismatch.stdout}\n${mismatch.stderr}`, /client version differs/);
  assert.deepEqual(readFileSync(join(scratch, example, "generation-receipt.yaml")), before);
  assert.throws(() => readFileSync(marker), /ENOENT/);
  console.log("Flux static proof rejects altered manifest, layers, workflow, schema source, values, output and processor version");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
