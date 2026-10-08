// The comparison behind `cub config diff`, vendored for the browser.
//
// Source: https://github.com/confighub/cub-workshop, lib/config-diff.mjs
// Commit: 55c51a67db2c9517e21bd3286207e28ff1a78ed3
// Source file SHA-256: b131f6963dcc2ee598621574c9e6e64db0846ca01aa9b92685b709062dc0f713
// Vendored core: lines 6 to 128 of that file, byte for byte.
// Vendored core SHA-256: 9265ab17a157ef8b00171384f24ec58ae939aac210e5a1a4208a432dae4578b1
// YAML parser: js-yaml 4.1.0, the same bytes as lib/yaml.cjs at that commit.
// License: MIT, as the source repository.
//
// The record of this copy is scripts/site/vendor/config-diff.source.json, and
// `npm run site:config-diff:verify` fails when the core below differs from it.
// Do not edit between the two markers. Take a new copy and update the record.
//
// The adapter replaces the five lines the source file opens with. Those lines
// import node:fs, node:module and node:crypto, load the YAML parser, and define
// a synchronous hash. A browser has none of the three modules, and Web Crypto
// hashes asynchronously. The adapter therefore hashes before and after the
// core runs. The core itself stays synchronous and unchanged.

// The page loads js-yaml as a classic script before this module runs.
const yaml = {
  loadAll: (text, options) => globalThis.jsyaml.loadAll(text, options),
  get JSON_SCHEMA() { return globalThis.jsyaml.JSON_SCHEMA; },
};
const encoder = new TextEncoder();
// Node keeps a byte order mark when it decodes a Buffer, so this does too.
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

export async function sha256Of(bytes) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

// File bytes as the core reads them: text for the parser, and a digest that
// was computed before the core ran.
class HashedBytes {
  constructor(bytes, sha256) { this.bytes = bytes; this.sha256 = sha256; }
  toString() { return decoder.decode(this.bytes); }
}

// The core hashes each Secret value while it runs. The first run records the
// values it wanted hashed, and the second run finds their digests here.
let knownDigests = new Map();
let wantedDigests = new Set();
const UNKNOWN_DIGEST = `sha256:${"0".repeat(64)}`;
const Buffer = { from: (text) => ({ text }) };
const hash = (value) => {
  if (value instanceof HashedBytes) return value.sha256;
  const known = knownDigests.get(value.text);
  if (known) return known;
  wantedDigests.add(value.text);
  return UNKNOWN_DIGEST;
};

// BEGIN VENDORED CORE (cub-workshop 55c51a6, lib/config-diff.mjs, lines 6 to 128)
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function check(ok, message) { if (!ok) throw new Error(message); }
function normalize(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { check(Number.isFinite(value), 'non-finite numbers are not supported'); return value; }
  check(value && typeof value === 'object', 'configuration contains a non-JSON value');
  check(!ancestors.has(value), 'cyclic YAML aliases are not supported');
  ancestors.add(value);
  const normalized = Array.isArray(value) ? value.map((v) => normalize(v, ancestors)) : Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalize(value[k], ancestors)]));
  ancestors.delete(value);
  return normalized;
}
function objects(bytes, label) {
  let docs;
  try { docs = yaml.loadAll(bytes.toString(), { schema: yaml.JSON_SCHEMA }); }
  catch (error) { throw new Error(`${label}: invalid YAML (${error.reason ?? 'parse failed'})`); }
  const map = new Map();
  for (const doc of docs) {
    if (doc === null || doc === undefined) continue; // Empty document separators.
    check(object(doc) && object(doc.metadata), `${label}: every document must be a Kubernetes object with metadata`);
    for (const [field, value] of [['apiVersion',doc.apiVersion],['kind',doc.kind],['metadata.name',doc.metadata.name]]) check(typeof value === 'string' && value.length > 0, `${label}: ${field} must be a nonempty string`);
    check(doc.metadata.namespace === undefined || typeof doc.metadata.namespace === 'string', `${label}: metadata.namespace must be a string when supplied`);
    const identity = { apiVersion: doc.apiVersion, kind: doc.kind, namespace: doc.metadata.namespace ?? null, name: doc.metadata.name };
    const key = JSON.stringify(Object.values(identity));
    check(!map.has(key), `${label}: duplicate object ${key}`);
    map.set(key, { identity, value: normalize(doc) });
  }
  check(map.size > 0, `${label}: no Kubernetes objects found`);
  return map;
}
const escape = (key) => key.replaceAll('~','~0').replaceAll('/','~1');
// Kubernetes keys many lists by name: containers, env, volumes, ports, volumeClaimTemplates.
// When every item of a list on both sides is a map with its own distinct name, the list
// is read as a map from name to item, so one changed field in one container is reported
// as that field and not as the whole list. Any other list is still one value, order included.
// An item is named by its own name, or as an embedded object by metadata.name
// (volumeClaimTemplates).
const nameOf = (item) => !object(item) ? null : typeof item.name === 'string' && item.name ? item.name
  : object(item.metadata) && typeof item.metadata.name === 'string' && item.metadata.name ? item.metadata.name : null;
const named = (list) => Array.isArray(list) && list.length > 0
  && list.every((item) => nameOf(item) !== null)
  && new Set(list.map(nameOf)).size === list.length;
const byName = (list) => Object.fromEntries(list.map((item) => [nameOf(item), item]));
function fields(before, after, path = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (named(before) && named(after)) return fields(byName(before), byName(after), path);
  if (!object(before) || !object(after)) return [{ path, operation: 'replace', before, after }];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap((key) => {
    const next = `${path}/${escape(key)}`;
    if (!Object.hasOwn(before,key)) return [{ path: next, operation: 'add', after: after[key] }];
    if (!Object.hasOwn(after,key)) return [{ path: next, operation: 'remove', before: before[key] }];
    return fields(before[key], after[key], next);
  });
}
// A Secret's values never leave this command. Each one is replaced by a short hash of
// itself, so a review still shows that a value changed, and whether two values match.
const SECRET_FIELDS = ['data', 'stringData'];
const sealed = (value) => `<redacted ${hash(Buffer.from(JSON.stringify(value))).slice(0, 19)}>`;
function sealSecret(value) {
  if (!object(value)) return value;
  const out = { ...value };
  for (const key of SECRET_FIELDS) {
    if (object(value[key])) out[key] = Object.fromEntries(Object.entries(value[key]).map(([k, v]) => [k, sealed(v)]));
  }
  return out;
}
function sealField(field) {
  const [top, key] = field.path.split('/').slice(1);
  const seal = (v) => field.path === '' ? sealSecret(v)
    : !SECRET_FIELDS.includes(top) ? v
    : key === undefined ? (object(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sealed(x)])) : sealed(v))
    : sealed(v);
  const out = { ...field };
  if (Object.hasOwn(field, 'before')) out.before = seal(field.before);
  if (Object.hasOwn(field, 'after')) out.after = seal(field.after);
  return out;
}
function kindSummary(before, after) {
  const counts = new Map();
  for (const { identity } of before.values()) {
    const key = `${identity.apiVersion}\u0000${identity.kind}`;
    const entry = counts.get(key) ?? { apiVersion: identity.apiVersion, kind: identity.kind, before: 0, after: 0 };
    entry.before++;
    counts.set(key, entry);
  }
  for (const { identity } of after.values()) {
    const key = `${identity.apiVersion}\u0000${identity.kind}`;
    const entry = counts.get(key) ?? { apiVersion: identity.apiVersion, kind: identity.kind, before: 0, after: 0 };
    entry.after++;
    counts.set(key, entry);
  }
  return [...counts.values()]
    .map((entry) => ({ ...entry, delta: entry.after - entry.before }))
    .sort((left, right) => left.apiVersion < right.apiVersion ? -1 : left.apiVersion > right.apiVersion ? 1
      : left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0);
}
export function diffConfigs(beforeBytes, afterBytes, includeKindSummary = false) {
  const before = objects(beforeBytes, 'before'); const after = objects(afterBytes, 'after');
  let unchanged = 0;
  const changes = [];
  for (const key of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const old = before.get(key); const next = after.get(key);
    if (!old) changes.push({ object: next.identity, change: 'added', fields: [{ path: '', operation: 'add', after: next.value }] });
    else if (!next) changes.push({ object: old.identity, change: 'removed', fields: [{ path: '', operation: 'remove', before: old.value }] });
    else {
      const edits = fields(old.value,next.value);
      if (edits.length) changes.push({ object: old.identity, change: 'changed', fields: edits });
      else unchanged++;
    }
  }
  for (const c of changes) if (c.object.kind === 'Secret') c.fields = c.fields.map(sealField);
  const result = {
    schemaVersion: 1, scope: 'local-configuration-diff',
    before: { sha256: hash(beforeBytes), objectCount: before.size },
    after: { sha256: hash(afterBytes), objectCount: after.size },
    equal: changes.length === 0,
    summary: { added: changes.filter((c)=>c.change==='added').length, removed: changes.filter((c)=>c.change==='removed').length, changed: changes.filter((c)=>c.change==='changed').length, unchanged },
    changes, comparison: 'Object identity includes API version and explicit namespace; mapping and document order ignored, lists of uniquely named items compared item by item by name, every other list compared as a whole value, missing and null distinct. No Kubernetes defaulting or schema interpretation. Secret data and stringData values are replaced by a short hash of each value.',
    notChecked: ['Kubernetes schema or admission validity', 'upstream merge and protected-field preservation', 'target readiness or live drift', 'application availability'],
  };
  if (includeKindSummary) result.kindSummary = kindSummary(before, after);
  return result;
}
// END VENDORED CORE

// The same result as `cub config diff --json`, and with includeKindSummary the
// same result as `cub config diff --summary --json`. Both arguments are the
// bytes of a file, as an ArrayBuffer or a Uint8Array.
export async function diffConfigFiles(beforeBytes, afterBytes, includeKindSummary = false) {
  const wrap = async (bytes) => {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return new HashedBytes(view, await sha256Of(view));
  };
  const before = await wrap(beforeBytes);
  const after = await wrap(afterBytes);
  const digests = new Map();
  const run = () => {
    // No await happens between these lines and the end of the core, so two
    // comparisons that overlap cannot read each other's digests.
    knownDigests = digests;
    wantedDigests = new Set();
    const result = diffConfigs(before, after, includeKindSummary);
    return { result, wanted: wantedDigests };
  };
  let { result, wanted } = run();
  if (wanted.size > 0) {
    for (const text of wanted) digests.set(text, await sha256Of(encoder.encode(text)));
    ({ result, wanted } = run());
    check(wanted.size === 0, "a Secret value was left without a digest");
  }
  return result;
}
