import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocs, repoRoot } from "./lib/proof-common.mjs";
import { verifyTimoniVariantLinks, verifyTimoniHubReceiptIdentity } from "./lib/timoni-hub-identity.mjs";

export function testTimoniVariantLinks() {
  const receipt = parseDocs(readFileSync(join(repoRoot, "runs/timoni-redis-catalog-proof/confighub-receipt.yaml"), "utf8"))[0];
  const base = receipt.spec.base;
  const development = receipt.spec.development;
  const relationship = receipt.spec.variantRelationship;
  const normalized = (value) => ({ id: value.id, slug: value.slug, units: value.units.map((unit) => ({ ...unit, upstreamSpaceId: unit.upstreamSpaceId })) });
  assert.throws(() => verifyTimoniVariantLinks(normalized(base), normalized(development), relationship), /upstream Space is missing/);
  assert.doesNotThrow(() => verifyTimoniVariantLinks(normalized(base), normalized(development), relationship, { allowLegacyMissingSpaceId: true }));
  const liveDevelopment = normalized(development);
  liveDevelopment.units.forEach((unit) => { unit.upstreamSpaceId = base.id; });
  assert.doesNotThrow(() => verifyTimoniVariantLinks(normalized(base), liveDevelopment, relationship));

  for (const mutate of [
    (v) => { v.development.id = v.base.id; },
    (v) => { v.base.slug = "unrelated-base"; },
    (v) => { v.development.units[0].id = v.base.units[0].id; },
    (v) => { [v.development.units[0].upstreamUnitId, v.development.units[1].upstreamUnitId] = [v.development.units[1].upstreamUnitId, v.development.units[0].upstreamUnitId]; },
    (v) => { v.development.units[0].id = v.development.units[1].id; },
    (v) => { v.development.units[0].slug = v.development.units[1].slug; },
    (v) => { v.development.units[0].upstreamUnitId = "missing"; },
    (v) => { v.development.units[0].upstreamSpaceId = "wrong"; },
    (v) => { v.relationship.upstreamSpaceId = "wrong"; },
    (v) => { v.relationship.linkedUnits = 6; },
    (v) => { v.relationship.objectChange = "changed"; },
  ]) {
    const value = { base: structuredClone(normalized(base)), development: structuredClone(normalized(development)), relationship: structuredClone(relationship) };
    value.development.units.forEach((unit) => { unit.upstreamSpaceId = base.id; });
    mutate(value);
    assert.throws(() => verifyTimoniVariantLinks(value.base, value.development, value.relationship));
  }
  const wrongLegacy = normalized(development);
  wrongLegacy.units[0].upstreamSpaceId = "wrong";
  assert.throws(() => verifyTimoniVariantLinks(normalized(base), wrongLegacy, relationship, { allowLegacyMissingSpaceId: true }));
  const reference = parseDocs(readFileSync(join(repoRoot, "runs/timoni-redis-catalog-proof/public-oci-receipt.yaml"), "utf8"))[0].spec.artifact.immutableReference;
  const liveReceipt = structuredClone(receipt);
  liveReceipt.spec.development = liveDevelopment;
  assert.doesNotThrow(() => verifyTimoniHubReceiptIdentity(liveReceipt, reference));
  for (const mutate of [
    (v) => { v.spec.source.immutableReference = "oci://wrong.invalid/redis@sha256:" + "0".repeat(64); },
    (v) => { delete v.spec.source.immutableReference; },
    (v) => { v.status.kubernetesApply = "pass"; },
    (v) => { delete v.status.kubernetesApply; },
  ]) {
    const changed = structuredClone(liveReceipt);
    mutate(changed);
    assert.throws(() => verifyTimoniHubReceiptIdentity(changed, reference));
  }
  console.log("Timoni hub identity checks passed");

}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) testTimoniVariantLinks();
