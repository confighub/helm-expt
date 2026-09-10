import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("../scripts/lookup-catalog-record.mjs", import.meta.url));
const bytes = readFileSync(new URL("../data/base-variant-records/records.json", import.meta.url));
const catalog = JSON.parse(bytes);
const record = catalog.records.find((r) => r.metadata.name === "bitnami-redis-25-5-3-default");
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", cwd: "/", timeout: 10000 });

test("exact lookup works outside the repo and preserves the complete record and byte identity", () => {
  const result = run("--name", record.metadata.name, "--configuration-digest", `sha256:${record.spec.configuration.digest}`);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.record, record);
  assert.equal(output.catalog.sha256, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  assert.equal(output.recordSchema, "schemas/base-variant-record.schema.json");
  assert.equal(output.record.spec.inputs.installTimeStatus, "not-yet-declared");
  assert.equal(output.record.spec.assessment.stages.find((s) => s.id === "destination").resultState, "not-run");
});

test("missing and digest mismatch are structured distinct non-success results without substitution", () => {
  const missing = run("--name", "not-a-catalog-entry");
  assert.equal(missing.status, 3);
  assert.equal(JSON.parse(missing.stdout).status, "not-found");
  assert.equal("record" in JSON.parse(missing.stdout), false);
  const mismatch = run("--name", record.metadata.name, "--configuration-digest", "f".repeat(64));
  assert.equal(mismatch.status, 4);
  const output = JSON.parse(mismatch.stdout);
  assert.equal(output.status, "digest-mismatch");
  assert.equal(output.configurationDigestRole, record.spec.configuration.digestRole);
  assert.equal("record" in output, false);
});

test("malformed and duplicate arguments fail without echoing request values", () => {
  for (const args of [[], ["--name"], ["--name", record.metadata.name, "--name", "secret-value"], ["--name", record.metadata.name, "--latest", "secret-value"], ["--name", record.metadata.name, "--configuration-digest", "secret-value"], ["--help", "--name", record.metadata.name]]) {
    const result = run(...args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.equal(JSON.parse(result.stderr).error.code, "invalid-request-or-catalog");
    assert.doesNotMatch(result.stderr, /secret-value/);
  }
  assert.equal(run("--help").status, 0);
});
