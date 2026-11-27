// Reviewed per-version expectations for a proof declaration.
//
// A proof declaration keeps a table of the object counts a person reviewed for
// each chart version it renders:
//
//   const versionExpectations = {
//     "10.7.0": { defaultObjects: 55, noCrdsObjects: 52 },
//   };
//
// A version missing from the table is refused, because a count nobody looked
// at is not a check. That stays true. What this adds is a way for an
// unattended job to propose an entry instead of stopping: with
// HELM_EXPT_RECORD_EXPECTATIONS=1, a version missing from the table renders
// anyway, each count is taken from what the render produced, and the new entry
// is written into the declaration's table, next to the previous versions'. The
// entry is then an observation, not a review. It becomes a review when the
// person merging the pull request that carries it reads it against the entry
// above it and accepts it. scripts/package-updates.mjs puts the old and new
// counts side by side in that pull request.
//
// Versions already in the table are never re-recorded: their counts are
// checked exactly as before, with or without the variable.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RECORD = Symbol("reviewed-expectations:record");
const pending = [];

export function recordingExpectations() {
  return process.env.HELM_EXPT_RECORD_EXPECTATIONS === "1";
}

// The reviewed expectations for one version. `label` names the chart in the
// refusal; `declarationURL` is the declaration's import.meta.url, the file a
// recorded entry is written into.
export function reviewedExpectations(label, version, table, declarationURL) {
  if (Object.hasOwn(table, version)) return table[version];
  if (!recordingExpectations()) {
    throw new Error(`${label} ${version} needs reviewed version-specific assertions`);
  }
  // The new entry must answer every count the newest reviewed entry answers.
  // A count the render cannot produce (a base the new version no longer has,
  // say) leaves the entry unwritten and the run failed.
  const versions = Object.keys(table);
  const newest = versions.length ? table[versions[versions.length - 1]] : {};
  const entry = { label, version, path: fileURLToPath(declarationURL), keys: Object.keys(newest), observed: new Map() };
  pending.push(entry);
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== "string") return undefined;
        if (!entry.keys.includes(key)) entry.keys.push(key);
        return { [RECORD]: entry, key };
      },
    },
  );
}

export function isRecordedExpectation(value) {
  return Boolean(value && typeof value === "object" && value[RECORD]);
}

// Records what the render produced for an expectation that is being recorded,
// and returns the observed value so the caller can carry on with a number.
export function observeExpectation(value, observed) {
  const entry = value[RECORD];
  const previous = entry.observed.get(value.key);
  if (previous !== undefined && previous !== observed) {
    throw new Error(`${entry.label} ${entry.version}: ${value.key} was observed as both ${previous} and ${observed}`);
  }
  entry.observed.set(value.key, observed);
  return observed;
}

// Writes every recorded entry into its declaration's table. A key the
// declaration read but the render never produced a value for is a count this
// mode cannot observe, so nothing is written and the run fails.
export function flushRecordedExpectations() {
  for (const entry of pending.splice(0)) {
    const missing = entry.keys.filter((key) => !entry.observed.has(key));
    if (missing.length) {
      throw new Error(
        `${entry.label} ${entry.version}: cannot record ${missing.join(", ")}; add the entry to versionExpectations by hand`,
      );
    }
    const line = `  ${JSON.stringify(entry.version)}: { ${entry.keys.map((key) => `${key}: ${entry.observed.get(key)}`).join(", ")} },`;
    writeFileSync(entry.path, insertTableEntry(readFileSync(entry.path, "utf8"), entry.version, line));
    console.log(`recorded unreviewed expectations for ${entry.label} ${entry.version}: ${line.trim()}`);
  }
}

// Inserts `line` as the last entry of `const versionExpectations = { ... };`.
export function insertTableEntry(source, version, line) {
  const start = source.indexOf("const versionExpectations = {");
  if (start === -1) throw new Error("the declaration has no `const versionExpectations = {` table");
  const end = source.indexOf("\n};", start);
  if (end === -1) throw new Error("the versionExpectations table is not closed by a line reading `};`");
  if (source.slice(start, end).includes(`${JSON.stringify(version)}:`)) {
    throw new Error(`the versionExpectations table already has ${version}`);
  }
  return `${source.slice(0, end)}\n${line}${source.slice(end)}`;
}
