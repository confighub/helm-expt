import assert from "node:assert/strict";

export function verifyTimoniVariantLinks(base, development, relationship, { allowLegacyMissingSpaceId = false } = {}) {
  space(base, "base");
  space(development, "development");
  fail(base.slug === "timoni-redis-8-10-1-base" && development.slug === "timoni-redis-8-10-1-dev", "expected Space slugs");
  fail(base.id !== development.id && base.slug !== development.slug, "base and development identities must differ");
  fail(relationship && relationship.upstreamSpaceId === base.id && relationship.downstreamSpaceId === development.id, "relationship Space identities");
  fail(Number.isInteger(relationship.linkedUnits) && relationship.linkedUnits === 7, "relationship linked unit count");
  fail(relationship.objectChange === "none", "relationship objectChange");
  const baseBySlug = units(base, "base");
  const devBySlug = units(development, "development");
  fail(baseBySlug.size === 7 && devBySlug.size === 7, "exactly seven Units per Space");
  const baseIds = new Set([...baseBySlug.values()].map((unit) => unit.id));
  for (const [slug, unit] of devBySlug) {
    fail(!baseIds.has(unit.id), `development Unit ${slug} reuses a base Unit ID`);
    const source = baseBySlug.get(slug);
    fail(source, `development Unit ${slug} has no base Unit`);
    fail(unit.upstreamUnitId === source.id, `development Unit ${slug} upstream Unit`);
    if (unit.upstreamSpaceId == null) fail(allowLegacyMissingSpaceId, `development Unit ${slug} upstream Space is missing`);
    else fail(unit.upstreamSpaceId === base.id, `development Unit ${slug} upstream Space`);
  }
  return { baseSpaceId: base.id, developmentSpaceId: development.id, linkedUnits: 7, objectChange: "none" };
}

function space(value, label) {
  fail(value && string(value.id) && string(value.slug), `${label} Space identity`);
}

function units(spaceValue, label) {
  fail(Array.isArray(spaceValue.units), `${label} Units`);
  const ids = new Set(), slugs = new Set(), bySlug = new Map();
  for (const unit of spaceValue.units) {
    fail(unit && string(unit.id) && string(unit.slug), `${label} Unit identity`);
    fail(!ids.has(unit.id) && !slugs.has(unit.slug), `${label} Unit IDs/slugs must be unique`);
    ids.add(unit.id); slugs.add(unit.slug); bySlug.set(unit.slug, unit);
  }
  return bySlug;
}

function string(value) { return typeof value === "string" && value.trim().length > 0; }
function fail(condition, message) { assert.ok(condition, `Timoni variant link verification failed: ${message}`); }

export function verifyTimoniHubReceiptIdentity(receipt, immutableReference, options = {}) {
  fail(string(immutableReference) && receipt.spec?.source?.immutableReference === immutableReference, "literal OCI reference");
  fail(receipt.status?.kubernetesApply === "not-run", "Kubernetes apply boundary");
  return verifyTimoniVariantLinks(receipt.spec.base, receipt.spec.development, receipt.spec.variantRelationship, options);
}
