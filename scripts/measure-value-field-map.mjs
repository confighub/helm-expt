#!/usr/bin/env node
// Measures which rendered Kubernetes field each Helm value controls, by
// changing one value at a time, re-rendering with `helm template`, and diffing
// the parsed objects field by field.
//
// It reuses the render contract of record-blast-radius-case.mjs (same helm
// flags as the recorded render receipt, the effective-values wrapper unwrapped
// from spec.values, object identity apiVersion|kind|namespace|name, dotted
// field paths) and writes entries in the ValueSourceMap shape used by
// recipes/bitnami/redis/25.5.3/value-source-map.yaml. It differs in one way on
// purpose: record-blast-radius-case.mjs scores one value that a map already
// names, while this script produces the map by trying every value.
//
// Needs network + helm for the chart pull. It never touches ConfigHub or a
// cluster.
//
//   node scripts/measure-value-field-map.mjs <repo>/<chart>/<version> --base <variant> --out <dir> [--jobs 4] [--limit N] [--pairs]
//
// Output is sorted and deterministic apart from timing.json.

import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { check, parseDocs, readYaml, readYamlText, repoRoot, sha256, writeYaml } from "./lib/proof-common.mjs";

const execFileAsync = promisify(execFile);

function usage() {
  console.log("usage: node scripts/measure-value-field-map.mjs <repo>/<chart>/<version> --base <variant> --out <dir> [--jobs 4] [--limit N] [--pairs]");
}

function parseArgs(argv) {
  const chartPath = argv[0];
  if (!chartPath || chartPath.startsWith("--")) return null;
  const args = { chartPath, base: null, out: null, jobs: 4, limit: Infinity, pairs: false };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--base") args.base = argv[++i];
    else if (argv[i] === "--out") args.out = resolve(argv[++i]);
    else if (argv[i] === "--jobs") args.jobs = Number(argv[++i]);
    else if (argv[i] === "--limit") args.limit = Number(argv[++i]);
    else if (argv[i] === "--pairs") args.pairs = true;
  }
  return args.base && args.out ? args : null;
}

// ---------- small helpers ----------

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}
const stable = (value) => JSON.stringify(sortKeys(value));
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const isMap = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function normalizeRelease(text) {
  return `${text.split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n*$/, "")}\n`;
}

// Helm value coalescing: maps merge recursively, lists and scalars replace, a
// null in the overlay deletes the key.
function mergeValues(base, overlay) {
  const out = clone(base) ?? {};
  for (const [key, value] of Object.entries(overlay ?? {})) {
    if (value === null) delete out[key];
    else if (isMap(value) && isMap(out[key])) out[key] = mergeValues(out[key], value);
    else out[key] = clone(value);
  }
  return out;
}

// ---------- value paths ----------

function pathLabel(segments) {
  let out = "";
  for (const seg of segments) {
    if (typeof seg === "number") out += `[${seg}]`;
    else out += `${out ? "." : ""}${seg.replaceAll(".", "\\.")}`;
  }
  return out;
}

// Leaves: scalars and null; empty maps and empty lists (nothing below them to
// reach); non-empty lists are descended element by element (tolerations[0].key).
function enumerateLeaves(value, segments = [], out = []) {
  if (isMap(value) && Object.keys(value).length) {
    for (const key of Object.keys(value).sort()) enumerateLeaves(value[key], [...segments, key], out);
  } else if (Array.isArray(value) && value.length) {
    value.forEach((item, index) => enumerateLeaves(item, [...segments, index], out));
  } else {
    out.push({ segments, path: pathLabel(segments), value });
  }
  return out;
}

function getAt(root, segments) {
  return segments.reduce((node, seg) => (node === undefined || node === null ? undefined : node[seg]), root);
}

function setAt(root, segments, value) {
  const copy = clone(root);
  let node = copy;
  for (const seg of segments.slice(0, -1)) node = node[seg];
  node[segments[segments.length - 1]] = value;
  return copy;
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "list";
  if (isMap(value)) return "map";
  return typeof value;
}

// One perturbation per attempt, type preserving. A later attempt only runs when
// the earlier one failed to render or showed nothing.
function attemptsFor(value) {
  switch (typeOf(value)) {
    case "string": return [value === "" ? "fm-probe" : `${value}-fm`];
    case "number": return [value + 1];
    case "boolean": return [!value];
    case "null": return [1, "fm-probe"];
    case "map": return [{ "fm-probe": "fm-probe" }];
    case "list": return [[{ name: "fm-probe" }], ["fm-probe"]];
    default: return [];
  }
}

// ---------- object fields ----------

function identityOf(doc) {
  const md = doc.metadata ?? {};
  return [doc.apiVersion ?? "", doc.kind ?? "", md.namespace ?? "", md.name ?? ""].join("|");
}

function objectMap(text) {
  const map = new Map();
  for (const doc of parseDocs(text)) {
    const identity = identityOf(doc);
    if (!identity.replaceAll("|", "")) continue;
    check(!map.has(identity), `duplicate object identity in render: ${identity}`);
    map.set(identity, doc);
  }
  return map;
}

// Flattens one object into dotted field paths. A list whose elements are all
// maps with distinct string `name` values is keyed by name (the ValueSourceMap
// style: volumes[redis-password]); any other list is keyed by index.
function flatten(value, prefix = "", out = new Map()) {
  if (isMap(value) && Object.keys(value).length) {
    for (const key of Object.keys(value).sort()) flatten(value[key], prefix ? `${prefix}.${key}` : key, out);
  } else if (Array.isArray(value) && value.length) {
    const named = value.every((item) => isMap(item) && typeof item.name === "string") && new Set(value.map((item) => item.name)).size === value.length;
    value.forEach((item, index) => flatten(item, `${prefix}[${named ? item.name : index}]`, out));
  } else {
    out.set(prefix, Array.isArray(value) ? "[]" : isMap(value) ? "{}" : value);
  }
  return out;
}

function brief(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// Pairs objects across two renders. Same identity pairs directly. Objects whose
// name changed are paired in three steps so a rename reads as field changes
// instead of a remove plus an add: (1) a kind with exactly one leftover on each
// side pairs, and its name change is learned as a substitution (karpenter ->
// fm-probe); (2) other leftovers pair when the learned substitution maps one
// name onto the other; (3) what remains pairs by name similarity only when it
// is close. Anything still unpaired is a real add or remove.
function pairObjects(base, other) {
  const pairs = [];
  const removed = [...base.keys()].filter((id) => !other.has(id)).sort();
  const added = [...other.keys()].filter((id) => !base.has(id)).sort();
  for (const id of [...base.keys()].filter((id) => other.has(id))) pairs.push([id, id]);
  const kindOf = (id) => id.split("|").slice(0, 2).join("|");
  const nameOf = (id) => id.split("|")[3];
  const stillRemoved = new Set(removed);
  const stillAdded = new Set(added);
  const take = (r, a) => {
    pairs.push([r, a]);
    stillRemoved.delete(r);
    stillAdded.delete(a);
  };
  const substitutions = new Set();
  for (const kind of [...new Set(removed.map(kindOf))].sort()) {
    const rs = removed.filter((id) => kindOf(id) === kind);
    const as = added.filter((id) => kindOf(id) === kind);
    if (rs.length === 1 && as.length === 1) {
      take(rs[0], as[0]);
      if (nameOf(rs[0]) && nameOf(as[0])) substitutions.add(`${nameOf(rs[0])}\u0000${nameOf(as[0])}`);
    }
  }
  for (const r of [...stillRemoved].sort()) {
    for (const sub of [...substitutions].sort()) {
      const [from, to] = sub.split("\u0000");
      const wanted = nameOf(r).replace(from, to);
      const match = [...stillAdded].sort().find((a) => kindOf(a) === kindOf(r) && nameOf(a) === wanted);
      if (match) {
        take(r, match);
        break;
      }
    }
  }
  const candidates = [];
  for (const r of stillRemoved) {
    for (const a of stillAdded) {
      if (kindOf(r) !== kindOf(a)) continue;
      candidates.push({ r, a, dist: levenshtein(nameOf(r), nameOf(a)), limit: Math.max(nameOf(r).length, nameOf(a).length) / 2 });
    }
  }
  candidates.sort((x, y) => x.dist - y.dist || cmp(x.r, y.r) || cmp(x.a, y.a));
  for (const c of candidates) if (stillRemoved.has(c.r) && stillAdded.has(c.a) && c.dist <= c.limit) take(c.r, c.a);
  return { pairs, removed: [...stillRemoved].sort(), added: [...stillAdded].sort() };
}

// Structural diff of two parsed objects, emitting field paths in the same
// notation as flatten() and named after the baseline side. Lists of maps keyed
// by `name` match by name; a leftover pair whose contents are otherwise nearly
// identical (renameSimilarity >= 0.8) is a rename, so renaming a container reads
// as one changed field instead of a removed container plus an added one.
const namedList = (list) => list.length > 0 && list.every((item) => isMap(item) && typeof item.name === "string") && new Set(list.map((item) => item.name)).size === list.length;

function renameSimilarity(x, y) {
  const fx = flatten(x);
  const fy = flatten(y);
  fx.delete("name");
  fy.delete("name");
  const total = Math.max(fx.size, fy.size);
  if (!total) return 0;
  let same = 0;
  for (const [k, v] of fx) if (fy.has(k) && stable(fy.get(k)) === stable(v)) same++;
  return same / total;
}

function diffNode(a, b, path, out) {
  const aContainer = (isMap(a) || Array.isArray(a)) && (Array.isArray(a) ? a.length : Object.keys(a).length) > 0;
  const bContainer = (isMap(b) || Array.isArray(b)) && (Array.isArray(b) ? b.length : Object.keys(b).length) > 0;
  if (!aContainer && !bContainer) {
    const av = Array.isArray(a) ? "[]" : isMap(a) ? "{}" : a;
    const bv = Array.isArray(b) ? "[]" : isMap(b) ? "{}" : b;
    if (stable(av) !== stable(bv)) out.push({ field: path, kind: "changed", before: brief(av), after: brief(bv) });
    return;
  }
  if (aContainer && bContainer && isMap(a) && isMap(b)) {
    for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const child = path ? `${path}.${key}` : key;
      if (!(key in b)) for (const [f, v] of flatten(a[key], child)) out.push({ field: f, kind: "removed", before: brief(v) });
      else if (!(key in a)) for (const [f, v] of flatten(b[key], child)) out.push({ field: f, kind: "added", after: brief(v) });
      else diffNode(a[key], b[key], child, out);
    }
    return;
  }
  if (aContainer && bContainer && Array.isArray(a) && Array.isArray(b)) {
    const labelA = namedList(a);
    const labelB = namedList(b);
    const label = (list, named, index) => (named ? list[index].name : index);
    if (labelA && labelB) {
      const bByName = new Map(b.map((item, i) => [item.name, i]));
      const aNames = new Set(a.map((item) => item.name));
      const lostA = a.map((item, i) => i).filter((i) => !bByName.has(a[i].name));
      const newB = b.map((item, i) => i).filter((i) => !aNames.has(b[i].name));
      // A removed and an added element pair as a rename only when everything but
      // the name is mostly unchanged, so remove-one/add-one stays a remove and an add.
      const positional = new Map();
      if (lostA.length === newB.length) {
        lostA.forEach((ai, k) => {
          if (renameSimilarity(a[ai], b[newB[k]]) >= 0.8) positional.set(ai, newB[k]);
        });
      }
      const usedB = new Set(positional.values());
      a.forEach((item, i) => {
        const j = bByName.has(item.name) ? bByName.get(item.name) : positional.get(i);
        const child = `${path}[${item.name}]`;
        if (j === undefined) for (const [f, v] of flatten(item, child)) out.push({ field: f, kind: "removed", before: brief(v) });
        else diffNode(item, b[j], child, out);
      });
      b.forEach((item, j) => {
        if (aNames.has(item.name) || usedB.has(j)) return;
        for (const [f, v] of flatten(item, `${path}[${item.name}]`)) out.push({ field: f, kind: "added", after: brief(v) });
      });
      return;
    }
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const child = `${path}[${i < a.length ? label(a, labelA, i) : i}]`;
      if (i >= b.length) for (const [f, v] of flatten(a[i], child)) out.push({ field: f, kind: "removed", before: brief(v) });
      else if (i >= a.length) for (const [f, v] of flatten(b[i], child)) out.push({ field: f, kind: "added", after: brief(v) });
      else diffNode(a[i], b[i], child, out);
    }
    return;
  }
  // One side is a container and the other is not (or the container types differ).
  if (aContainer) for (const [f, v] of flatten(a, path)) out.push({ field: f, kind: "removed", before: brief(v) });
  else out.push({ field: path, kind: "removed", before: brief(Array.isArray(a) ? "[]" : isMap(a) ? "{}" : a) });
  if (bContainer) for (const [f, v] of flatten(b, path)) out.push({ field: f, kind: "added", after: brief(v) });
  else out.push({ field: path, kind: "added", after: brief(Array.isArray(b) ? "[]" : isMap(b) ? "{}" : b) });
}

function diffRenders(base, other) {
  const { pairs, removed, added } = pairObjects(base, other);
  const renamed = [];
  const changed = [];
  for (const [bid, oid] of pairs.sort((x, y) => cmp(x[0], y[0]))) {
    if (bid !== oid) renamed.push({ from: bid, to: oid });
    const fields = [];
    diffNode(base.get(bid), other.get(oid), "", fields);
    if (fields.length) changed.push({ object: bid, fields: fields.sort((x, y) => cmp(x.field, y.field) || cmp(x.kind, y.kind)) });
  }
  return { objectsAdded: added, objectsRemoved: removed, objectsRenamed: renamed, objectsChanged: changed };
}

const hasEffect = (d) => d.objectsAdded.length + d.objectsRemoved.length + d.objectsRenamed.length + d.objectsChanged.length > 0;

// ---------- rendering ----------

async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }));
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return usage();
  const { chartPath, base, out, jobs, limit, pairs } = args;
  const started = Date.now();
  mkdirSync(out, { recursive: true });
  const work = join(out, "work");
  mkdirSync(work, { recursive: true });

  // 1. Inputs, exactly as recorded.
  const recipeRoot = join(repoRoot, "recipes", chartPath);
  const sourceLock = readYaml(join(recipeRoot, "source-lock.yaml")).spec;
  const variant = readYaml(join(recipeRoot, "variants", base, "variant.yaml")).spec;
  const revisions = readdirSync(join(recipeRoot, "revisions", base)).filter((n) => /^r\d+$/.test(n)).sort();
  const revisionDir = join(recipeRoot, "revisions", base, revisions[revisions.length - 1]);
  const revision = readYaml(join(revisionDir, "variant-revision.yaml")).spec;
  const receipt = readYaml(join(revisionDir, "receipts", "render-receipt.yaml")).spec;
  const valuesDoc = readYaml(resolve(recipeRoot, "variants", base, variant.valuesProfile));
  const effective = valuesDoc.spec.values;
  const namespace = variant.namespace;
  const releaseName = variant.releaseName;
  const kubeVersion = receipt.renderer.kubeVersion;
  const flags = receipt.renderer.flags;
  const helmArgs = (chartFile, valuesFile) => ["template", releaseName, chartFile, "--namespace", namespace, "--kube-version", kubeVersion, ...flags, "--values", valuesFile];

  // 2. Pull the pinned chart and check the package digest against the source lock.
  const pkgDir = join(work, "pkg");
  mkdirSync(pkgDir, { recursive: true });
  const archive = join(pkgDir, `${sourceLock.chart}-${sourceLock.version}.tgz`);
  if (!existsSync(archive)) {
    const source = sourceLock.exactArtifact?.url ?? `${sourceLock.repositoryURL}/${sourceLock.chart}`;
    const pull = source.startsWith("oci://")
      ? ["pull", source, "--version", String(sourceLock.version), "-d", pkgDir]
      : ["pull", sourceLock.chart, "--repo", sourceLock.repositoryURL, "--version", String(sourceLock.version), "-d", pkgDir];
    execFileSync("helm", pull, { stdio: ["ignore", "pipe", "inherit"] });
  }
  const packageSha = sha256(readFileSync(archive));
  check(packageSha === sourceLock.packageSHA256, `package sha ${packageSha} does not match source lock ${sourceLock.packageSHA256}`);
  const chartDefaults = readYamlText(execFileSync("helm", ["show", "values", archive], { encoding: "utf8" }));
  const merged = mergeValues(chartDefaults, effective);

  const renderTimes = [];
  let renderCount = 0;
  let secondPassRenders = 0; // renders spent on contexts for values that showed nothing alone
  async function render(values, tag, apiVersions = []) {
    const valuesFile = join(work, `values-${tag}.json`);
    writeFileSync(valuesFile, JSON.stringify(values));
    const t0 = Date.now();
    renderCount++;
    if (/-(c\d+|g|ga|api)(-|$)/.test(tag) || tag.startsWith("off-")) secondPassRenders++;
    try {
      const { stdout } = await execFileAsync("helm", [...helmArgs(archive, valuesFile), ...apiVersions.flatMap((v) => ["--api-versions", v])], { maxBuffer: 200 * 1024 * 1024 });
      renderTimes.push(Date.now() - t0);
      return { ok: true, text: normalizeRelease(stdout), objects: null };
    } catch (error) {
      renderTimes.push(Date.now() - t0);
      const line = String(error.stderr ?? error.message).split("\n").find((l) => l.trim()) ?? "helm failed";
      return { ok: false, error: line.trim().slice(0, 300) };
    }
  }
  const parsed = (r) => (r.objects ??= objectMap(r.text));

  // 3. Baseline against the retained objects and the recorded digest.
  const effectiveFile = join(work, "values-effective.json");
  writeFileSync(effectiveFile, JSON.stringify(effective));
  const baseline = await render(effective, "effective");
  check(baseline.ok, `baseline render failed: ${baseline.error}`);
  const committedText = normalizeRelease(readFileSync(join(revisionDir, revision.rendered.releaseObjects), "utf8"));
  const committed = objectMap(committedText);
  const baseObjects = parsed(baseline);
  const sameIdentities = committed.size === baseObjects.size && [...committed.keys()].every((id) => baseObjects.has(id));
  const sameObjects = sameIdentities && [...committed.keys()].every((id) => stable(committed.get(id)) === stable(baseObjects.get(id)));
  const baselineCheck = {
    objectCount: baseObjects.size,
    committedObjectCount: committed.size,
    identitiesEqual: sameIdentities,
    parsedObjectsEqual: sameObjects,
    renderedSha256: sha256(baseline.text),
    recordedDigest: revision.digestInputs.renderedObjectSetSHA256,
    digestEqual: sha256(baseline.text) === revision.digestInputs.renderedObjectSetSHA256,
    byteIdentical: baseline.text === committedText,
    packageSha256: packageSha,
    kubeVersion,
    flags,
  };
  writeFileSync(join(out, "baseline-check.json"), `${JSON.stringify(baselineCheck, null, 2)}\n`);
  check(sameObjects && baselineCheck.digestEqual, `baseline does not match the retained render; see ${join(out, "baseline-check.json")}`);

  // Sanity: the full merged values file must reproduce the baseline, because
  // every perturbation below is applied to the full merged values.
  const mergedRender = await render(merged, "merged");
  check(mergedRender.ok && mergedRender.text === baseline.text, "rendering the full merged values does not reproduce the baseline");

  // 4. Leaves.
  const leaves = enumerateLeaves(merged).slice(0, limit);
  const leafKinds = {};
  for (const leaf of leaves) leafKinds[typeOf(leaf.value)] = (leafKinds[typeOf(leaf.value)] ?? 0) + 1;
  const effectiveLeafPaths = new Set(enumerateLeaves(effective).map((l) => l.path));

  // Gate candidates for the conditional re-test: false booleans named enabled/create.
  const gates = leaves.filter((l) => l.value === false && /^(enabled|create)$/.test(String(l.segments[l.segments.length - 1])));

  // 5. One value at a time.
  async function probe(root, rootObjects, segments, tag, apiVersions = []) {
    const attempts = [];
    for (const [index, candidate] of attemptsFor(getAt(root, segments)).entries()) {
      const r = await render(setAt(root, segments, candidate), `${tag}-a${index}`, apiVersions);
      if (!r.ok) {
        attempts.push({ perturbedValue: candidate, outcome: "render-failed", error: r.error });
        continue;
      }
      const diff = diffRenders(rootObjects, parsed(r));
      attempts.push({ perturbedValue: candidate, outcome: hasEffect(diff) ? "effect" : "no-effect", diff: hasEffect(diff) ? diff : undefined });
      if (hasEffect(diff)) break;
    }
    return attempts;
  }

  // API versions the templates test with Capabilities.APIVersions.Has. The recorded
  // render passes none, so anything gated on them cannot show in the first pass.
  const extractDir = join(work, "chart");
  mkdirSync(extractDir, { recursive: true });
  execFileSync("tar", ["-xzf", archive, "-C", extractDir]);
  const tplDir = join(extractDir, sourceLock.chart, "templates");
  const capabilityVersions = new Set();
  const referenced = new Set();
  for (const file of readdirSync(tplDir).sort()) {
    const text = readFileSync(join(tplDir, file), "utf8");
    for (const m of text.matchAll(/APIVersions\.Has\s+"([^"]+)"/g)) capabilityVersions.add(m[1]);
    for (const m of text.matchAll(/\.Values((?:\.[A-Za-z_][A-Za-z0-9_]*)+)/g)) referenced.add(m[1].slice(1));
  }
  const builtinApis = new Set(["policy/v1"]); // present in helm template's default capability set
  const extraApis = [...capabilityVersions].filter((v) => !builtinApis.has(v)).sort();

  // "Off" values: false booleans, empty maps/lists/strings, nulls. A value that shows
  // nothing alone may only matter when one of these is switched on (for example
  // sidecarVolumeMounts only renders when sidecarContainer is non-empty).
  const offLeaves = leaves.filter((l) => l.value === false || l.value === null || l.value === "" || (isMap(l.value) && !Object.keys(l.value).length) || (Array.isArray(l.value) && !l.value.length));
  const offContexts = new Map(); // path -> Promise<{ values, objects } | null>
  function offContext(leaf) {
    if (!offContexts.has(leaf.path)) {
      offContexts.set(leaf.path, (async () => {
        const candidate = attemptsFor(leaf.value)[0];
        const values = setAt(merged, leaf.segments, candidate);
        const r = await render(values, `off-${leaf.path.replace(/[^A-Za-z0-9]+/g, "_")}`);
        return r.ok ? { values, objects: parsed(r), setTo: candidate } : null;
      })());
    }
    return offContexts.get(leaf.path);
  }

  const results = await pool(leaves, jobs, async (leaf, index) => {
    const tag = `v${String(index).padStart(3, "0")}`;
    const attempts = await probe(merged, baseObjects, leaf.segments, tag);
    let conditionalOn = null;
    let finalAttempts = attempts;
    let status = attempts.some((a) => a.outcome === "effect") ? "effect" : attempts.some((a) => a.outcome === "no-effect") ? "no-effect" : "render-failed";
    const secondPass = [];
    if (status !== "effect") {
      // Second perturbation, three escalating contexts. Each compares against that
      // context's own render, so only this value's effect is measured.
      // (a) the chart's own gates (enabled/create) whose parent path contains this value.
      const own = leaf.segments.map(String);
      const tryContext = async (label, ctxValues, ctxObjects, ctxApis, conditional) => {
        const ctxAttempts = await probe(ctxValues, ctxObjects, leaf.segments, `${tag}-c${secondPass.length}`, ctxApis);
        secondPass.push({ context: label, outcomes: ctxAttempts.map((a) => a.outcome) });
        if (ctxAttempts.some((a) => a.outcome === "effect")) {
          conditionalOn = conditional;
          finalAttempts = ctxAttempts;
          status = "effect";
          return true;
        }
        return false;
      };
      for (const gate of gates) {
        const gateParent = gate.segments.slice(0, -1).map(String);
        if (!gateParent.every((seg, i) => own[i] === seg) || gate.path === leaf.path) continue;
        const ctx = setAt(merged, gate.segments, true);
        const r = await render(ctx, `${tag}-g`);
        if (r.ok && (await tryContext(`${gate.path}=true`, ctx, parsed(r), [], { values: [{ path: gate.path, setTo: true }] }))) break;
      }
      // (b) API versions the templates look for, alone and together with the gate.
      if (status !== "effect" && extraApis.length) {
        const r = await render(merged, `${tag}-api`, extraApis);
        if (r.ok && (await tryContext(`api-versions ${extraApis.join(",")}`, merged, parsed(r), extraApis, { apiVersions: extraApis }))) { /* done */ }
        if (status !== "effect") {
          for (const gate of gates) {
            const gateParent = gate.segments.slice(0, -1).map(String);
            if (!gateParent.every((seg, i) => own[i] === seg) || gate.path === leaf.path) continue;
            const ctx = setAt(merged, gate.segments, true);
            const rg = await render(ctx, `${tag}-ga`, extraApis);
            if (rg.ok && (await tryContext(`${gate.path}=true + api-versions ${extraApis.join(",")}`, ctx, parsed(rg), extraApis, { values: [{ path: gate.path, setTo: true }], apiVersions: extraApis }))) break;
          }
        }
      }
      // (c) pairwise: switch on one other off value at a time.
      if (status !== "effect") {
        for (const other of offLeaves) {
          if (other.path === leaf.path) continue;
          const ctx = await offContext(other);
          if (ctx && (await tryContext(`${other.path}=${brief(ctx.setTo)}`, ctx.values, ctx.objects, [], { values: [{ path: other.path, setTo: ctx.setTo }] }))) break;
        }
      }
    }
    return { leaf, status, conditionalOn, attempts: finalAttempts, firstPassAttempts: attempts, secondPassContexts: secondPass.length };
  });

  // 6. Entries (sorted by value path).
  const entries = results.map(({ leaf, status, conditionalOn, attempts, firstPassAttempts, secondPassContexts }) => {
    const hit = attempts.find((a) => a.outcome === "effect");
    const diff = hit?.diff;
    const fieldCount = diff ? diff.objectsChanged.reduce((n, o) => n + o.fields.length, 0) : 0;
    return {
      valuePath: leaf.path,
      type: typeOf(leaf.value),
      baselineValue: leaf.value,
      source: effectiveLeafPaths.has(leaf.path) ? "effective-values" : "chart-default",
      status,
      needsSecondPerturbation: firstPassAttempts.length > 1 || (firstPassAttempts[0]?.outcome !== "effect") || conditionalOn !== null,
      conditionalOn,
      secondPassContextsTried: secondPassContexts,
      attempts: attempts.map(({ perturbedValue, outcome, error }) => ({ perturbedValue, outcome, ...(error ? { error } : {}) })),
      objectsAdded: diff?.objectsAdded ?? [],
      objectsRemoved: diff?.objectsRemoved ?? [],
      objectsRenamed: diff?.objectsRenamed ?? [],
      objectsChanged: diff?.objectsChanged ?? [],
      fieldChangeCount: fieldCount,
    };
  }).sort((a, b) => cmp(a.valuePath, b.valuePath));

  // 6b. Optional interaction check (--pairs): for every pair of values that had an
  // effect alone, perturb both at once and compare the joint change set with the
  // union of the two single change sets. A difference means the values interact
  // (one masks the other, or together they reach something neither reaches alone).
  let pairReport = null;
  if (pairs) {
    const pairStart = Date.now();
    const rendersBefore = renderCount;
    const signature = (diff) => new Set([
      ...diff.objectsAdded.map((id) => `+${id}`),
      ...diff.objectsRemoved.map((id) => `-${id}`),
      ...diff.objectsRenamed.map((r) => `~${r.from}>${r.to}`),
      ...diff.objectsChanged.flatMap((o) => o.fields.map((f) => `${o.object}|${f.field}|${f.kind}|${f.after ?? ""}`)),
    ]);
    const singles = results
      .filter((r) => r.status === "effect" && !r.conditionalOn)
      .map((r) => ({ leaf: r.leaf, value: r.attempts.find((a) => a.outcome === "effect"), sig: signature(r.attempts.find((a) => a.outcome === "effect").diff) }))
      .sort((a, b) => cmp(a.leaf.path, b.leaf.path));
    const combos = [];
    for (let i = 0; i < singles.length; i++) for (let j = i + 1; j < singles.length; j++) combos.push([singles[i], singles[j]]);
    const outcomes = await pool(combos, jobs, async ([p, q], index) => {
      const values = setAt(setAt(merged, p.leaf.segments, p.value.perturbedValue), q.leaf.segments, q.value.perturbedValue);
      const r = await render(values, `pair-${index}`);
      if (!r.ok) return { a: p.leaf.path, b: q.leaf.path, interaction: "joint-render-failed", error: r.error };
      const joint = signature(diffRenders(baseObjects, parsed(r)));
      const union = new Set([...p.sig, ...q.sig]);
      const missing = [...union].filter((x) => !joint.has(x)).sort();
      const extra = [...joint].filter((x) => !union.has(x)).sort();
      return missing.length || extra.length ? { a: p.leaf.path, b: q.leaf.path, interaction: "differs-from-union", missingFromJoint: missing.length, extraInJoint: extra.length, sampleMissing: missing.slice(0, 3), sampleExtra: extra.slice(0, 3) } : null;
    });
    const interacting = outcomes.filter(Boolean).sort((x, y) => cmp(x.a, y.a) || cmp(x.b, y.b));
    const involved = new Set(interacting.flatMap((x) => [x.a, x.b]));
    pairReport = { valuesTested: singles.length, pairsTested: combos.length, rendersForPairs: renderCount - rendersBefore, interactingPairs: interacting.length, valuesInvolvedInAnInteraction: involved.size, jointRenderFailures: interacting.filter((x) => x.interaction === "joint-render-failed").length, interacting };
    writeFileSync(join(out, "pair-interactions.json"), `${JSON.stringify(pairReport, null, 2)}\n`);
    writeFileSync(join(out, "timing-pairs.json"), `${JSON.stringify({ pairWallClockMs: Date.now() - pairStart, pairRenders: pairReport.rendersForPairs, parallelJobs: jobs }, null, 2)}\n`);
  }

  // 7. Invert: every baseline field and which values reached it.
  const baselineFields = new Map(); // "identity :: field" -> {object, field}
  for (const [identity, doc] of [...baseObjects.entries()].sort((a, b) => cmp(a[0], b[0]))) {
    for (const field of flatten(doc).keys()) baselineFields.set(`${identity} :: ${field}`, { object: identity, field, reachedBy: new Set(), objectLevel: new Set() });
  }
  const objectReach = new Map([...baseObjects.keys()].map((id) => [id, new Set()]));
  for (const entry of entries) {
    for (const obj of entry.objectsChanged) {
      objectReach.get(obj.object)?.add(entry.valuePath); // objects born in a second-pass context are not baseline objects
      for (const f of obj.fields) {
        if (f.kind === "added") continue;
        baselineFields.get(`${obj.object} :: ${f.field}`)?.reachedBy.add(entry.valuePath);
      }
    }
    for (const id of entry.objectsRemoved) {
      objectReach.get(id)?.add(entry.valuePath);
      for (const rec of baselineFields.values()) if (rec.object === id) rec.objectLevel.add(entry.valuePath);
    }
  }
  const isCrd = (id) => id.split("|")[1] === "CustomResourceDefinition";
  const fieldRows = [...baselineFields.values()].map((r) => ({ object: r.object, field: r.field, reachedByFieldLevel: [...r.reachedBy].sort(), reachedByObjectRemoval: [...r.objectLevel].sort() }));
  const reachedAny = (r) => r.reachedByFieldLevel.length + r.reachedByObjectRemoval.length > 0;
  const tally = (rows) => ({
    fields: rows.length,
    reachedByAtLeastOneValue: rows.filter(reachedAny).length,
    reachedByFieldLevelChange: rows.filter((r) => r.reachedByFieldLevel.length > 0).length,
    reachedOnlyByObjectRemoval: rows.filter((r) => r.reachedByFieldLevel.length === 0 && r.reachedByObjectRemoval.length > 0).length,
    notReachedByAnyValue: rows.filter((r) => !reachedAny(r)).length,
    reachedByMoreThanOneValue: rows.filter((r) => new Set([...r.reachedByFieldLevel, ...r.reachedByObjectRemoval]).size > 1).length,
  });
  const nonCrdRows = fieldRows.filter((r) => !isCrd(r.object));
  const crdRows = fieldRows.filter((r) => isCrd(r.object));

  const countStatus = (s) => entries.filter((e) => e.status === s).length;
  const summary = {
    chart: chartPath,
    base,
    renderContext: { namespace, releaseName, kubeVersion, flags },
    baseline: baselineCheck,
    leafPathCount: leaves.length,
    leafKinds: Object.fromEntries(Object.entries(leafKinds).sort()),
    valuesFromEffectiveValues: entries.filter((e) => e.source === "effective-values").length,
    effect: countStatus("effect"),
    noEffect: countStatus("no-effect"),
    renderFailed: countStatus("render-failed"),
    renders: { total: 0, firstPassIncludingBaseline: 0, secondPassContexts: 0 },
    effectAtFirstAttempt: entries.filter((e) => e.status === "effect" && !e.conditionalOn && e.attempts.length === 1).length,
    effectAtLaterAttemptSameContext: entries.filter((e) => e.status === "effect" && !e.conditionalOn && e.attempts.length > 1).length,
    valuesChangingExistingBaselineFields: entries.filter((e) => e.objectsChanged.some((o) => o.fields.some((f) => f.kind !== "added")) || e.objectsRemoved.length).length,
    valuesOnlyAddingFieldsOrObjects: entries.filter((e) => e.status === "effect" && !(e.objectsChanged.some((o) => o.fields.some((f) => f.kind !== "added")) || e.objectsRemoved.length)).length,
    effectOnlyAfterSecondPerturbation: entries.filter((e) => e.status === "effect" && e.needsSecondPerturbation).length,
    effectOnlyUnderCondition: entries.filter((e) => e.conditionalOn).length,
    changedObjectSet: entries.filter((e) => e.objectsAdded.length || e.objectsRemoved.length || e.objectsRenamed.length).length,
    valuesAddingObjects: entries.filter((e) => e.objectsAdded.length).length,
    valuesRemovingObjects: entries.filter((e) => e.objectsRemoved.length).length,
    valuesRenamingObjects: entries.filter((e) => e.objectsRenamed.length).length,
    baselineObjects: { total: baseObjects.size, crd: [...baseObjects.keys()].filter(isCrd).length, reachedByAtLeastOneValue: [...objectReach.values()].filter((s) => s.size).length },
    baselineFields: { all: tally(fieldRows), excludingCrds: tally(nonCrdRows), crdsOnly: tally(crdRows) },
    templateReferencedPathsNotInDefaults: [],
  };

  // 8. Template-referenced value paths that the merged defaults do not contain.
  const known = new Set();
  for (const leaf of enumerateLeaves(merged)) {
    const parts = leaf.segments.filter((s) => typeof s === "string");
    for (let i = 1; i <= parts.length; i++) known.add(parts.slice(0, i).join("."));
  }
  summary.templateReferencedPathsNotInDefaults = [...referenced].filter((p) => !known.has(p)).sort();
  summary.templateReferencedPathCount = referenced.size;
  summary.renders = { total: renderCount - (pairReport?.rendersForPairs ?? 0), firstPassIncludingBaseline: renderCount - secondPassRenders - (pairReport?.rendersForPairs ?? 0), secondPassContexts: secondPassRenders };
  if (pairReport) summary.pairInteractions = { valuesTested: pairReport.valuesTested, pairsTested: pairReport.pairsTested, interactingPairs: pairReport.interactingPairs, valuesInvolvedInAnInteraction: pairReport.valuesInvolvedInAnInteraction, jointRenderFailures: pairReport.jointRenderFailures };
  summary.capabilityApiVersionsTestedByTemplates = extraApis;
  summary.offValuesUsedAsPairwiseContexts = offLeaves.length;

  // 9. Write results.
  const mapDoc = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueSourceMap",
    metadata: { name: `${chartPath.replaceAll("/", "-")}-${base}-measured` },
    spec: {
      chart: `${sourceLock.repositoryName}/${sourceLock.chart}`,
      version: String(sourceLock.version),
      measurement: {
        method: "one-value-at-a-time-rerender-diff",
        note: "renderedFields lists baseline fields whose rendered value changed or disappeared when only this value was perturbed. fieldsAdded, objectsAdded, objectsRemoved and objectsRenamed are listed separately. rolloutImpact and immutableFieldRisk are not measured and are omitted.",
        helm: { flags, kubeVersion, namespace, releaseName },
      },
      entries: entries.filter((e) => e.status === "effect").map((e) => ({
        id: e.valuePath,
        valuePath: e.valuePath,
        effectiveValue: e.baselineValue,
        source: e.source,
        ...(e.conditionalOn ? { conditionalOn: e.conditionalOn } : {}),
        perturbedValue: e.attempts.find((a) => a.outcome === "effect").perturbedValue,
        renderedFields: e.objectsChanged.flatMap((o) => o.fields.filter((f) => f.kind !== "added").map((f) => ({ object: o.object, field: f.field, value: f.before, ...(f.kind === "changed" ? { perturbedTo: f.after } : { removed: true }) }))),
        fieldsAdded: e.objectsChanged.flatMap((o) => o.fields.filter((f) => f.kind === "added").map((f) => ({ object: o.object, field: f.field, value: f.after }))),
        objectsAdded: e.objectsAdded,
        objectsRemoved: e.objectsRemoved,
        objectsRenamed: e.objectsRenamed,
      })),
    },
  };
  // 9b. The same data in the field_origin_map shape of cub-gen (dry_path, wet_path,
  // source_path, transform, confidence), for baseline fields only. wet_path uses
  // cub-gen's Kind/seg/seg notation, which carries no object name or namespace.
  const cubGenWetPath = (identity, field) => {
    const protectedField = field.replace(/[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[A-Za-z0-9._-]+/g, (m) => m.replaceAll(".", "\u0001"));
    return `${identity.split("|")[1]}/${protectedField.split(".").join("/").replaceAll("\u0001", ".")}`;
  };
  const originMap = [];
  for (const e of entries.filter((x) => x.status === "effect")) {
    const perturbed = e.attempts.find((a) => a.outcome === "effect").perturbedValue;
    const needle = typeof perturbed === "string" ? perturbed : JSON.stringify(perturbed);
    for (const o of e.objectsChanged) {
      for (const f of o.fields) {
        if (f.kind === "added" || !baselineFields.has(`${o.object} :: ${f.field}`)) continue;
        const after = f.kind === "changed" ? String(f.after) : "";
        const transform = f.kind === "removed" ? "helm-measured:removed" : after === needle ? "helm-measured:identity" : after.includes(needle) ? "helm-measured:embedded" : "helm-measured:derived";
        originMap.push({
          dry_path: `values.${e.valuePath}`,
          wet_path: cubGenWetPath(o.object, f.field),
          source_path: e.source === "chart-default" ? `<helm-default>:values.${e.valuePath}` : `${variant.valuesProfile.split("/").pop()}:${e.valuePath}`,
          source_layer: e.source,
          transform: e.conditionalOn ? `${transform}:conditional` : transform,
          confidence: e.conditionalOn ? 0.7 : 1.0,
          object: o.object,
        });
      }
    }
  }
  originMap.sort((x, y) => cmp(x.dry_path, y.dry_path) || cmp(x.object, y.object) || cmp(x.wet_path, y.wet_path));
  const wetKeys = originMap.map((r) => r.wet_path);
  summary.cubGenShape = {
    entries: originMap.length,
    distinctDryPaths: new Set(originMap.map((r) => r.dry_path)).size,
    distinctWetPathsInCubGenNotation: new Set(wetKeys).size,
    distinctWetFieldsWithObjectIdentity: new Set(originMap.map((r) => `${r.object} :: ${r.wet_path}`)).size,
    transformCounts: Object.fromEntries([...new Set(originMap.map((r) => r.transform))].sort().map((t) => [t, originMap.filter((r) => r.transform === t).length])),
  };
  writeFileSync(join(out, "field-origin-map.cubgen-shape.json"), `${JSON.stringify(originMap, null, 2)}\n`);

  writeFileSync(join(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(join(out, "value-effects.json"), `${JSON.stringify(entries, null, 2)}\n`);
  writeFileSync(join(out, "field-inverse.json"), `${JSON.stringify(fieldRows.filter(reachedAny), null, 2)}\n`);
  writeFileSync(join(out, "field-inverse-unreached-counts.json"), `${JSON.stringify(Object.fromEntries([...baseObjects.keys()].sort().map((id) => [id, { fields: fieldRows.filter((r) => r.object === id).length, unreached: fieldRows.filter((r) => r.object === id && !reachedAny(r)).length }])), null, 2)}\n`);
  writeYaml(join(out, "value-source-map.measured.yaml"), mapDoc);
  const wall = Date.now() - started;
  const sorted = [...renderTimes].sort((a, b) => a - b);
  writeFileSync(join(out, "timing.json"), `${JSON.stringify({ wallClockMs: wall, renders: renderCount, parallelJobs: jobs, renderMsMedian: sorted[Math.floor(sorted.length / 2)], renderMsMax: sorted[sorted.length - 1], renderMsTotalSerialEquivalent: renderTimes.reduce((a, b) => a + b, 0) }, null, 2)}\n`);
  console.log(`values ${summary.leafPathCount}: effect ${summary.effect}, no-effect ${summary.noEffect}, render-failed ${summary.renderFailed}; renders ${renderCount}; wall ${(wall / 1000).toFixed(1)}s`);
  console.log(`fields (non-CRD) reached ${summary.baselineFields.excludingCrds.reachedByAtLeastOneValue}/${summary.baselineFields.excludingCrds.fields}; all ${summary.baselineFields.all.reachedByAtLeastOneValue}/${summary.baselineFields.all.fields}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
