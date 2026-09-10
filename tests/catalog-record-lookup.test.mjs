import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { lookupCatalogRecord } from "../scripts/lib/catalog-record-lookup.mjs";

const catalog = JSON.parse(readFileSync("data/base-variant-records/records.json", "utf8"));
const selected = catalog.records[0];

test("selects an exact committed record and preserves its complete content", () => {
  const result = lookupCatalogRecord(catalog, { name: selected.metadata.name });
  assert.equal(result.status, "found");
  assert.deepEqual(result.record, selected);
  assert.equal(result.configurationDigestRole, selected.spec.configuration.digestRole);
  assert.match(result.selectedRecordSha256, /^sha256:[0-9a-f]{64}$/);
});

test("normalizes an optional digest prefix and never returns a replacement on mismatch", () => {
  const digest = selected.spec.configuration.digest;
  const found = lookupCatalogRecord(catalog, { name: selected.metadata.name, expectedConfigurationDigest: `sha256:${digest}` });
  assert.equal(found.status, "found");
  const mismatch = lookupCatalogRecord(catalog, { name: selected.metadata.name, expectedConfigurationDigest: "0".repeat(64) });
  assert.equal(mismatch.status, "digest-mismatch");
  assert.equal("record" in mismatch, false);
});

test("returns structured not-found without fuzzy or latest matching", () => {
  const result = lookupCatalogRecord(catalog, { name: `${selected.metadata.name}-suffix` });
  assert.deepEqual(result, { status: "not-found", name: `${selected.metadata.name}-suffix`, expectedConfigurationDigest: null });
});

test("preserves records with differing digest roles as independent exact matches", () => {
  const left = { metadata: { name: "left" }, spec: { configuration: { digest: "a".repeat(64), digestRole: "inventory-file" } }, status: { level: "partial" } };
  const right = { metadata: { name: "right" }, spec: { configuration: { digest: "b".repeat(64), digestRole: "canonical-object-set" } }, status: { level: "available" } };
  assert.equal(lookupCatalogRecord({ records: [left, right] }, { name: "left" }).record.spec.configuration.digestRole, "inventory-file");
  assert.equal(lookupCatalogRecord({ records: [left, right] }, { name: "right" }).record.spec.configuration.digestRole, "canonical-object-set");
});

test("rejects malformed roots, requests, duplicates, cycles, and oversized selected records", () => {
  assert.throws(() => lookupCatalogRecord({}, { name: "x" }), /records array/);
  assert.throws(() => lookupCatalogRecord(catalog, { name: "x", latest: true }), /unknown field/);
  assert.throws(() => lookupCatalogRecord(catalog, { name: "x", expectedConfigurationDigest: "ABC" }), /digest is invalid/);
  assert.throws(() => lookupCatalogRecord({ records: [selected, structuredClone(selected)] }, { name: selected.metadata.name }), /duplicate names/);
  const cyclic = { records: [] }; cyclic.loop = cyclic;
  assert.throws(() => lookupCatalogRecord(cyclic, { name: "x" }), /cycle/);
  const large = { metadata: { name: "large" }, spec: { configuration: { digest: "c".repeat(64), digestRole: "source-file" } }, padding: "x".repeat(256 * 1024) };
  assert.throws(() => lookupCatalogRecord({ records: [large] }, { name: "large" }), /size limit/);
});

test("enforces the record count bound", () => {
  const records = Array.from({ length: 10001 }, (_, index) => ({ metadata: { name: `record-${index}` } }));
  assert.throws(() => lookupCatalogRecord({ records }, { name: "record-1" }), /record count/);
});

test("malformed selected digest or missing configuration is refused even without a requested pin", () => {
  for (const configuration of [undefined, {}, { digest: "bad", digestRole: "literal-yaml-file" }, { digest: "a".repeat(64) }]) {
    const record = { metadata: { name: "invalid" }, spec: { configuration: configuration ?? null } };
    assert.throws(() => lookupCatalogRecord({ records: [record] }, { name: "invalid" }), /valid configuration digest/);
  }
});

test("selected hash ignores key order and returned records cannot mutate the catalog", () => {
  const original = { metadata: { name: "same" }, spec: { configuration: { digest: "a".repeat(64), digestRole: "literal-yaml-file" } } };
  const reordered = { spec: original.spec, metadata: original.metadata };
  const left = lookupCatalogRecord({ records: [original] }, { name: "same" });
  const right = lookupCatalogRecord({ records: [reordered] }, { name: "same" });
  assert.equal(left.selectedRecordSha256, right.selectedRecordSha256);
  left.record.metadata.name = "edited";
  assert.equal(original.metadata.name, "same");
});
