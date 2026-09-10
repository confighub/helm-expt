import { sha256 } from "./proof-common.mjs";

const MAX_RECORDS = 10_000;
const MAX_SELECTED_BYTES = 256 * 1024;
const DIGEST_RE = /^(?:sha256:)?[a-f0-9]{64}$/;

export function lookupCatalogRecord(document, request) {
  const query = validateRequest(request);
  const records = validateDocument(document);
  const record = records.find((candidate) => candidate.metadata.name === query.name);
  if (!record) {
    return {
      status: "not-found",
      name: query.name,
      expectedConfigurationDigest: query.expectedConfigurationDigest ?? null,
    };
  }
  const observedDigest = normalizeDigest(record.spec?.configuration?.digest);
  if (!observedDigest || typeof record.spec?.configuration?.digestRole !== "string" || !record.spec.configuration.digestRole) {
    throw new Error("selected catalog record has no valid configuration digest and role");
  }
  if (query.expectedConfigurationDigest && observedDigest !== query.expectedConfigurationDigest) {
    return {
      status: "digest-mismatch",
      name: query.name,
      expectedConfigurationDigest: query.expectedConfigurationDigest,
      observedConfigurationDigest: observedDigest,
      configurationDigestRole: record.spec.configuration.digestRole,
    };
  }
  const serialized = canonicalString(record);
  if (Buffer.byteLength(serialized, "utf8") > MAX_SELECTED_BYTES) {
    throw new Error("selected catalog record exceeds the size limit");
  }
  return {
    status: "found",
    name: query.name,
    configurationDigestRole: record.spec.configuration.digestRole,
    selectedRecordSha256: `sha256:${sha256(serialized)}`,
    record: structuredClone(record),
  };
}

function validateDocument(document) {
  if (!document || Array.isArray(document) || !Array.isArray(document.records)) {
    throw new Error("catalog document must contain a records array");
  }
  if (document.records.length > MAX_RECORDS) throw new Error("catalog record count exceeds the limit");
  assertPlainJson(document, new Set(), "catalog document");
  const names = new Set();
  for (const record of document.records) {
    if (!record || Array.isArray(record) || typeof record.metadata?.name !== "string" || !record.metadata.name) {
      throw new Error("catalog record has a malformed metadata name");
    }
    if (names.has(record.metadata.name)) throw new Error("catalog records contain duplicate names");
    names.add(record.metadata.name);
  }
  return document.records;
}

function validateRequest(request) {
  assertPlainJson(request, new Set(), "lookup request");
  if (!request || Array.isArray(request) || typeof request.name !== "string" || !request.name) {
    throw new Error("lookup request requires a name");
  }
  const allowed = new Set(["name", "expectedConfigurationDigest"]);
  if (Object.keys(request).some((key) => !allowed.has(key))) throw new Error("lookup request contains an unknown field");
  const expected = request.expectedConfigurationDigest;
  if (expected !== undefined && (typeof expected !== "string" || !DIGEST_RE.test(expected))) {
    throw new Error("lookup request digest is invalid");
  }
  return {
    name: request.name,
    ...(expected === undefined ? {} : { expectedConfigurationDigest: normalizeDigest(expected) }),
  };
}

function normalizeDigest(value) {
  if (typeof value !== "string" || !DIGEST_RE.test(value)) return null;
  return value.replace(/^sha256:/, "");
}

function canonicalString(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function assertPlainJson(value, seen, label, depth = 0) {
  if (depth > 100) throw new Error(`${label} exceeds the nesting limit`);
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new Error(`${label} contains a non-finite number`);
  }
  if (typeof value !== "object") throw new Error(`${label} is not JSON-compatible`);
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${label} is not a plain JSON object`);
  }
  if (seen.has(value)) throw new Error(`${label} contains a cycle`);
  seen.add(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) assertPlainJson(child, seen, label, depth + 1);
  seen.delete(value);
}
