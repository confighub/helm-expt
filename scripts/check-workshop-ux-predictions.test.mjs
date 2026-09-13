import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";

const script = new URL("./check-workshop-ux-predictions.mjs", import.meta.url);
const roots = [];

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "ux-predictions-"));
  roots.push(root);
  return root;
}

function writePredictions(root, entries) {
  const trial = join(root, "trial");
  mkdirSync(trial, { recursive: true });
  writeFileSync(join(trial, "predictions.json"), JSON.stringify(entries));
  return join(trial, "predictions.json");
}

function run(root) {
  const result = spawnSync(process.execPath, [script.pathname, "--root", root], { encoding: "utf8" });
  return { ...result, json: JSON.parse(result.stdout) };
}

function goodEntry(overrides = {}) {
  return {
    command: "cub stack certify ./stack.yaml --json",
    predictedExit: 1,
    predictedField: "certified: false",
    actualExit: 1,
    actualField: "certified: false",
    predictedAt: "2026-09-13T10:00:00.000Z",
    ranAt: "2026-09-13T10:00:05.000Z",
    ...overrides,
  };
}

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test("accepts a well-formed predictions file, including an honest mismatch", () => {
  const root = tempRoot();
  writePredictions(root, [goodEntry(), goodEntry({ predictedExit: 0, actualExit: 1 })]);
  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.json.passed, true);
});

test("rejects predictedAt equal to ranAt", () => {
  const root = tempRoot();
  writePredictions(root, [goodEntry({ predictedAt: "2026-09-13T10:00:00.000Z", ranAt: "2026-09-13T10:00:00.000Z" })]);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.equal(result.json.passed, false);
  assert.ok(result.json.findings.some((f) => f.code === "prediction-not-before-run"));
});

test("rejects an entry missing predictedField", () => {
  const root = tempRoot();
  const entry = goodEntry();
  delete entry.predictedField;
  writePredictions(root, [entry]);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.equal(result.json.passed, false);
  assert.ok(result.json.findings.some((f) => f.code === "missing-field" && f.message.includes("predictedField")));
});

test("accepts an empty predictions array", () => {
  const root = tempRoot();
  writePredictions(root, []);
  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.json.passed, true);
});

test("reports no predictions to verify when none exist", () => {
  const root = tempRoot();
  const result = run(root);
  assert.equal(result.status, 0);
  assert.equal(result.json.passed, true);
  assert.ok(result.json.findings.some((f) => f.code === "no-predictions"));
});

test("rejects an empty predictedField", () => {
  const root = tempRoot();
  writePredictions(root, [goodEntry({ predictedField: "   " })]);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.findings.some((f) => f.code === "empty-predicted-field"));
});

test("rejects the wrong type for a required field", () => {
  const root = tempRoot();
  writePredictions(root, [goodEntry({ predictedExit: "1" })]);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.ok(result.json.findings.some((f) => f.code === "wrong-type"));
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
