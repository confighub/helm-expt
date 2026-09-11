import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";
import { lookupCatalogRecord } from "./lib/catalog-record-lookup.mjs";

const script = new URL("./check-workshop-ux-handoff.mjs", import.meta.url);
const fixtureCatalog = new URL("../data/base-variant-records/records.json", import.meta.url);
const roots = [];

function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ux-handoff-"));
  roots.push(root);
  const trial = join(root, "trial");
  mkdirSync(trial);
  const catalogBytes = readFileSync(fixtureCatalog);
  const catalog = JSON.parse(catalogBytes);
  const recordName = catalog.records[0].metadata.name;
  const lookup = lookupCatalogRecord(catalog, { name: recordName });
  const envelope = { apiVersion: "catalog.confighub.com/v1alpha1", kind: "CatalogRecordLookup", catalog: { path: "data/base-variant-records/records.json", sha256: `sha256:${sha(catalogBytes)}` }, recordSchema: "schemas/base-variant-record.schema.json", ...lookup };
  const catalogPath = join(root, "catalog.json");
  writeFileSync(catalogPath, catalogBytes);
  writeFileSync(join(trial, "record.json"), JSON.stringify(envelope));
  writeFileSync(join(trial, "result.md"), "result\n");
  writeFileSync(join(trial, "trial-log.md"), "log\n");
  return { root, trial, catalogPath, catalogBytes, recordName, envelope };
}

function run(item, extra = []) {
  const before = new Map([item.catalogPath, ...["record.json", "result.md", "trial-log.md"].map((name) => join(item.trial, name))].filter(existsSync).map((path) => [path, readFileSync(path)]));
  const result = spawnSync(process.execPath, [script.pathname, "--trial-dir", item.trial, "--catalog", item.catalogPath, "--catalog-sha256", sha(item.catalogBytes), "--record-name", item.recordName, ...extra], { encoding: "utf8" });
  for (const [path, bytes] of before) assert.deepEqual(readFileSync(path), bytes, "checker must not change an input artifact");
  return { ...result, json: JSON.parse(result.stdout) };
}

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test("accepts a complete actual lookup envelope without writing artifacts", () => {
  const item = fixture();
  const recordBefore = readFileSync(join(item.trial, "record.json"));
  const result = run(item);
  assert.equal(result.status, 0);
  assert.equal(result.json.passed, true);
  assert.deepEqual(readFileSync(join(item.trial, "record.json")), recordBefore);
});

test("rejects missing report or log", () => {
  for (const name of ["result.md", "trial-log.md"]) {
    const item = fixture();
    unlinkSync(join(item.trial, name));
    const result = run(item);
    assert.equal(result.status, 1);
    assert.equal(result.json.passed, false);
  }
});

test("rejects whitespace-only report", () => {
  const item = fixture();
  writeFileSync(join(item.trial, "result.md"), " \n\t ");
  assert.equal(run(item).status, 1);
});

test("rejects an oversized trial artifact before reading it", () => {
  const item = fixture();
  truncateSync(join(item.trial, "trial-log.md"), 2 * 1024 * 1024 + 1);
  assert.equal(run(item).status, 1);
});

test("rejects a renamed record, wrong kind, and altered render intent", () => {
  for (const change of [
    (e) => { e.name = "another-record"; },
    (e) => { e.kind = "SomeOtherLookup"; },
    (e) => { e.record.spec.processing.materialization.method = "wrong-render-intent"; },
  ]) {
    const item = fixture();
    change(item.envelope);
    writeFileSync(join(item.trial, "record.json"), JSON.stringify(item.envelope));
    assert.equal(run(item).status, 1);
  }
});

test("rejects modified record hash or catalog hash", () => {
  for (const change of [
    (e) => { e.selectedRecordSha256 = "sha256:" + "0".repeat(64); },
    (e) => { e.catalog.sha256 = "sha256:" + "0".repeat(64); },
  ]) {
    const item = fixture();
    change(item.envelope);
    writeFileSync(join(item.trial, "record.json"), JSON.stringify(item.envelope));
    assert.equal(run(item).status, 1);
  }
});

test("rejects catalog bytes changed after the requested pin was made", () => {
  const item = fixture();
  writeFileSync(item.catalogPath, Buffer.concat([item.catalogBytes, Buffer.from(" ")]));
  const result = run(item);
  assert.equal(result.status, 1);
  assert.equal(result.json.findings[0].code, "requested-catalog-hash-mismatch");
});

test("rejects an artifact symlink that escapes the trial directory", () => {
  const item = fixture();
  const outside = join(item.root, "outside.md");
  writeFileSync(outside, "outside\n");
  unlinkSync(join(item.trial, "result.md"));
  symlinkSync(outside, join(item.trial, "result.md"));
  assert.equal(run(item).status, 1);
});

test("rejects duplicate options as malformed arguments", () => {
  const item = fixture();
  const result = run(item, ["--record-name", item.recordName]);
  assert.equal(result.status, 2);
  assert.equal(result.json.findings[0].code, "invalid-arguments");
});

test("rejects missing options as malformed arguments", () => {
  const item = fixture();
  const result = spawnSync(process.execPath, [script.pathname, "--trial-dir", item.trial], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).findings[0].code, "invalid-arguments");
});

test("rejects an unknown option as malformed arguments", () => {
  const item = fixture();
  const result = run(item, ["--unexpected", "value"]);
  assert.equal(result.status, 2);
  assert.equal(result.json.findings[0].code, "invalid-arguments");
});
