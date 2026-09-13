import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";

const script = new URL("./check-workshop-ux-recovery.mjs", import.meta.url);
const roots = [];

function sha(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "ux-recovery-"));
  roots.push(root);
  return root;
}

// Builds: <root>/incompatible/refusal.json + refusal-hashes.json, and
// optionally a sibling recovery directory holding its own result.
function buildFixture(root, { recoveryDirName = "recovered", recoveryFileName = "recovery.json", tamperAfterHashing = false, skipRecovery = false } = {}) {
  const incompatible = join(root, "incompatible");
  mkdirSync(incompatible, { recursive: true });
  const refusalPath = join(incompatible, "refusal.json");
  writeFileSync(refusalPath, JSON.stringify({ certified: false, reason: "external-secrets.io/v1beta1 not served" }));
  const recordedHash = sha(readFileSync(refusalPath));
  writeFileSync(join(incompatible, "refusal-hashes.json"), JSON.stringify({ "refusal.json": recordedHash }));
  if (tamperAfterHashing) {
    writeFileSync(refusalPath, JSON.stringify({ certified: false, reason: "external-secrets.io/v1beta1 not served", tampered: true }));
  }
  if (!skipRecovery) {
    const recoveryDir = join(root, recoveryDirName);
    mkdirSync(recoveryDir, { recursive: true });
    writeFileSync(join(recoveryDir, recoveryFileName), JSON.stringify({ certified: true }));
  }
  return { incompatible, refusalPath };
}

function run(root) {
  const result = spawnSync(process.execPath, [script.pathname, "--root", root], { encoding: "utf8" });
  return { ...result, json: JSON.parse(result.stdout) };
}

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test("accepts a preserved refusal with a separately named recovery", () => {
  const root = tempRoot();
  buildFixture(root);
  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.json.passed, true);
});

test("rejects a refusal whose bytes changed after the hash was recorded", () => {
  const root = tempRoot();
  buildFixture(root, { tamperAfterHashing: true });
  const result = run(root);
  assert.equal(result.status, 1);
  assert.equal(result.json.passed, false);
  assert.ok(result.json.findings.some((f) => f.code === "refusal-tampered"));
});

test("rejects a refusal with no sibling recovery directory", () => {
  const root = tempRoot();
  buildFixture(root, { skipRecovery: true });
  const result = run(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.findings.some((f) => f.code === "missing-recovery-sibling"));
});

test("rejects a recovery file that reuses the refusal's exact filename", () => {
  const root = tempRoot();
  buildFixture(root, { recoveryFileName: "refusal.json" });
  const result = run(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.findings.some((f) => f.code === "recovery-reuses-filename"));
});

test("reports no refusal artifacts to verify when none exist", () => {
  const root = tempRoot();
  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.json.passed, true);
  assert.ok(result.json.findings.some((f) => f.code === "no-refusals"));
});

test("detects a refusal by certified:false content even without 'refusal' in the filename", () => {
  const root = tempRoot();
  const dir = join(root, "incompatible");
  mkdirSync(dir, { recursive: true });
  const resultPath = join(dir, "result.json");
  writeFileSync(resultPath, JSON.stringify({ certified: false }));
  writeFileSync(join(dir, "refusal-hashes.json"), JSON.stringify({ "result.json": sha(readFileSync(resultPath)) }));
  const recoveryDir = join(root, "recovered");
  mkdirSync(recoveryDir, { recursive: true });
  writeFileSync(join(recoveryDir, "recovery.json"), JSON.stringify({ certified: true }));
  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.json.passed, true);
});

test("verifies against the default runs/workshop-ux root when none exists", () => {
  const result = spawnSync(process.execPath, [script.pathname, "--verify"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.passed, true);
});

test("rejects an unknown option as malformed arguments", () => {
  const result = spawnSync(process.execPath, [script.pathname, "--unexpected", "value"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).findings[0].code, "invalid-arguments");
});
