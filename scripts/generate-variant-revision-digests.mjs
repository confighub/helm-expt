// A variant revision records the digests of the files it was rendered from.
// Until now only ten charts had that record checked, by the useful-base wave
// lane, and only on the alias half of each pair. Everything else was unchecked,
// so an edit to a variant left its revision describing a file that no longer
// existed and nothing said so.
//
// This lane reads every revision in the catalog and puts each one in one of
// four states. A record is attached when both recorded digests match the files
// they name. It is stale when the variant digest names something the variant
// file no longer is. It is frozen when it is stale and the file sits inside the
// pinned Kubara release baseline, where correcting it would rewrite evidence
// someone already pulled. It is absent when the revision records no variant
// digest at all, which is a real gap and not a passing state.
//
// The lane refuses on any stale record it is allowed to fix, and refuses when
// the number of frozen or absent records grows. Neither is silently accepted.
// Both carry the next action next to them, because a record that says nothing
// must not read as a record that had nothing to say.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { check, readYaml, repoRoot, sha256, sha256File, write } from "./lib/proof-common.mjs";
import { releaseBaselineFiles } from "./lib/kubara-catalog-release.mjs";

const args = process.argv.slice(2);
const generate = args.includes("--generate");
const verify = args.includes("--verify");
if (!generate && !verify) usage();

// Every absent record today comes from a variant whose revision was written
// before the render pipeline recorded digest inputs. Closing them needs a real
// re-render, which needs Helm, so they are carried rather than invented. The
// count may fall and must never rise.
const ABSENT_CEILING = 44;

// Every stale record found so far is inside the pinned release baseline, so the
// honest count of what this lane may fix today is zero. The ceiling records
// that as a fact rather than leaving it to be rediscovered, and it must fall as
// releases re-pin rather than rise.
const FROZEN_CEILING = 26;

const baseline = releaseBaselineFiles(repoRoot);
check(baseline.ok, `release baseline is unreadable, so a frozen record cannot be told from a fixable one: ${baseline.reason ?? ""}`);

const outputPaths = {
  digests: "data/variant-revision-digests/digests.csv",
  summary: "data/variant-revision-digests/summary.md",
};

const records = collectRecords();
const stale = records.filter((record) => record.state === "stale");
const frozen = records.filter((record) => record.state === "frozen");
const absent = records.filter((record) => record.state === "absent");
const attached = records.filter((record) => record.state === "attached");

if (generate) {
  for (const record of stale) rewriteRecord(record);
  const refreshed = collectRecords();
  check(
    refreshed.every((record) => record.state !== "stale"),
    `re-derivation left ${refreshed.filter((record) => record.state === "stale").length} stale record(s)`,
  );
  write(join(repoRoot, outputPaths.digests), csv(refreshed));
  write(join(repoRoot, outputPaths.summary), summary(refreshed));
  console.log(
    `re-derived ${stale.length} stale variant revision digest(s); ${refreshed.filter((r) => r.state === "attached").length} attached, ${refreshed.filter((r) => r.state === "frozen").length} frozen by the release baseline, ${refreshed.filter((r) => r.state === "absent").length} absent`,
  );
} else {
  for (const record of stale) {
    console.error(`stale: ${record.path} records ${short(record.recordedVariant)} for a variant file that is ${short(record.actualVariant)}`);
  }
  check(stale.length === 0, `${stale.length} variant revision(s) record a digest their variant file no longer has; run npm run variant-revision-digests`);
  check(
    frozen.length <= FROZEN_CEILING,
    `${frozen.length} variant revision(s) inside the pinned release baseline record a stale digest, above the recorded ceiling of ${FROZEN_CEILING}; a record that is frozen and wrong must be re-recorded by a release, not added to`,
  );
  check(
    absent.length <= ABSENT_CEILING,
    `${absent.length} variant revision(s) record no variant digest, above the recorded ceiling of ${ABSENT_CEILING}; a new revision must record its digest inputs`,
  );
  assertFresh(outputPaths.digests, csv(records));
  assertFresh(outputPaths.summary, summary(records));
  console.log(
    `verified ${records.length} variant revision digest record(s): ${attached.length} attached, ${frozen.length} frozen by the release baseline, ${absent.length} absent, 0 stale`,
  );
}

function collectRecords() {
  const rows = [];
  for (const recipeRoot of recipeRoots()) {
    const revisionsRoot = join(recipeRoot, "revisions");
    if (!existsSync(revisionsRoot)) continue;
    for (const variantName of readdirSync(revisionsRoot).sort()) {
      const variantRoot = join(revisionsRoot, variantName);
      if (!statSync(variantRoot).isDirectory()) continue;
      for (const revisionName of readdirSync(variantRoot).sort()) {
        const revisionRoot = join(variantRoot, revisionName);
        const revisionPath = join(revisionRoot, "variant-revision.yaml");
        if (!existsSync(revisionPath)) continue;
        rows.push(describeRecord(recipeRoot, variantName, revisionName, revisionRoot, revisionPath));
      }
    }
  }
  return rows.sort((left, right) => left.path.localeCompare(right.path));
}

function describeRecord(recipeRoot, variantName, revisionName, revisionRoot, revisionPath) {
  const revision = readYaml(revisionPath);
  const inputs = revision.spec?.digestInputs ?? {};
  const variantPath = join(recipeRoot, "variants", variantName, "variant.yaml");
  const releasePath = join(revisionRoot, "rendered", "release-objects.yaml");
  const actualVariant = existsSync(variantPath) ? sha256File(variantPath) : "";
  const actualRelease = existsSync(releasePath) ? sha256File(releasePath) : "";
  const recordedVariant = inputs.variantSHA256 ?? "";
  const recordedRelease = inputs.renderedObjectSetSHA256 ?? "";
  const renderMatches = Boolean(recordedRelease) && recordedRelease === actualRelease;
  let state = "attached";
  let nextAction = "";
  if (!recordedVariant) {
    state = "absent";
    nextAction = "re-render this variant through the proof kit so the revision records its digest inputs";
  } else if (recordedVariant !== actualVariant) {
    state = "stale";
    nextAction = renderMatches
      ? "re-derive the recorded digests from the current variant file"
      : "re-render this variant, because its rendered object set no longer matches the record either";
  }
  const path = relative(repoRoot, revisionPath).replaceAll("\\", "/");
  if (state === "stale" && baseline.has(path)) {
    state = "frozen";
    nextAction =
      "leave the record alone and re-record it in the next Kubara catalog release, because this file is inside the pinned release baseline";
  }
  return {
    path,
    chart: `${relative(join(repoRoot, "recipes"), recipeRoot).replaceAll("\\", "/")}`,
    variant: variantName,
    revision: revisionName,
    state,
    render_state: recordedRelease ? (renderMatches ? "matches" : "stale") : "absent",
    next_action: nextAction,
    recordedVariant,
    actualVariant,
    revisionPath,
    variantPath,
    reproducesComposite: reproducesComposite(revision),
  };
}

// The composite digest is written the same way by every producer, as a hash of
// the five recorded inputs. Re-deriving a record is only safe when its stored
// composite still reproduces from its own stored inputs, because that is the
// evidence that this producer wrote it and no other rule applies.
function compositeFor(inputs) {
  return sha256(
    JSON.stringify({
      recipeDigest: inputs.recipeSHA256,
      variantDigest: inputs.variantSHA256,
      effectiveValuesDigest: inputs.effectiveValuesSHA256,
      rendererFingerprint: inputs.rendererSHA256,
      releaseDigest: inputs.renderedObjectSetSHA256,
    }),
  );
}

function reproducesComposite(revision) {
  return compositeFor(revision.spec?.digestInputs ?? {}) === revision.spec?.digest;
}

function rewriteRecord(record) {
  check(
    record.render_state === "matches",
    `${record.path} cannot be re-derived: its rendered object set does not match the record, so the variant needs a real re-render`,
  );
  check(
    record.reproducesComposite,
    `${record.path} cannot be re-derived: its stored composite digest does not reproduce from its own inputs`,
  );
  const text = readFileSync(record.revisionPath, "utf8");
  const revision = readYaml(record.revisionPath);
  const inputs = { ...(revision.spec?.digestInputs ?? {}), variantSHA256: record.actualVariant };
  const rewritten = text
    .replace(record.recordedVariant, record.actualVariant)
    .replace(revision.spec.digest, compositeFor(inputs));
  check(rewritten !== text, `${record.path} was not rewritten`);
  write(record.revisionPath, rewritten);
}

function recipeRoots() {
  const roots = [];
  const recipesRoot = join(repoRoot, "recipes");
  for (const owner of readdirSync(recipesRoot).sort()) {
    const ownerRoot = join(recipesRoot, owner);
    if (!statSync(ownerRoot).isDirectory()) continue;
    for (const chart of readdirSync(ownerRoot).sort()) {
      const chartRoot = join(ownerRoot, chart);
      if (!statSync(chartRoot).isDirectory()) continue;
      for (const version of readdirSync(chartRoot).sort()) {
        const versionRoot = join(chartRoot, version);
        if (!statSync(versionRoot).isDirectory()) continue;
        if (existsSync(join(versionRoot, "recipe.yaml"))) roots.push(versionRoot);
      }
    }
  }
  return roots;
}

function csv(rows) {
  const headers = ["path", "chart", "variant", "revision", "state", "render_state", "next_action"];
  const body = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")).join("\n");
  return `${headers.join(",")}\n${body}\n`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function summary(rows) {
  const attachedRows = rows.filter((row) => row.state === "attached");
  const absentRows = rows.filter((row) => row.state === "absent");
  const staleRows = rows.filter((row) => row.state === "stale");
  const frozenRows = rows.filter((row) => row.state === "frozen");
  const absentCharts = [...new Set(absentRows.map((row) => row.chart))].sort();
  const frozenCharts = [...new Set(frozenRows.map((row) => row.chart))].sort();
  return `# Variant Revision Digest Records

Generated. Do not edit by hand.

A variant revision names the digests of the files it was rendered from. This
lane reads every revision in the catalog and reports whether that record still
describes the files it points at.

## Summary

~~~text
revisions: ${rows.length}
attached: ${attachedRows.length}
stale: ${staleRows.length}
frozen by the release baseline: ${frozenRows.length}
absent: ${absentRows.length}
frozen ceiling: ${FROZEN_CEILING}
absent ceiling: ${ABSENT_CEILING}
~~~

## What each state means

Attached means both recorded digests match the files they name, so the record
still describes real bytes.

Stale means the revision records a variant digest that the variant file no
longer has, and this lane is allowed to correct it. The lane refuses on any
stale record.

Frozen means the record is wrong and must stay that way for now, because the
file sits inside the pinned Kubara release baseline. Two rules meet there and
only one can win. A record must describe the file it points at, and a published
release must stay byte for byte what it published. The release wins, because
correcting a record inside it would rewrite evidence someone already pulled.
These records get re-recorded when a release re-pins the baseline, and the lane
refuses if their number grows.

Every wrong record found so far came from an edit that declared target
prerequisites or renamed a variant, neither of which changes a rendered object
set, and no rendered digest has ever gone stale.

Absent means the revision records no variant digest at all. These revisions
were written before the render pipeline recorded digest inputs. Closing one
needs a real re-render rather than a recomputation, so they are carried as an
actionable gap with the next action written next to each row. The count may
fall and the lane refuses if it rises, so a new revision cannot join them.

## Charts holding frozen records

${frozenCharts.length ? frozenCharts.map((chart) => `- ${chart}`).join("\n") : "None."}

## Charts holding absent records

${absentCharts.length ? absentCharts.map((chart) => `- ${chart}`).join("\n") : "None."}

Machine-readable form:

- [digests.csv](./digests.csv)

Regenerate:

~~~sh
npm run variant-revision-digests
npm run variant-revision-digests:verify
~~~
`;
}

function assertFresh(relativePath, expected) {
  const path = join(repoRoot, relativePath);
  check(existsSync(path), `${relativePath} is missing; run npm run variant-revision-digests`);
  check(readFileSync(path, "utf8") === expected, `${relativePath} is stale; run npm run variant-revision-digests`);
}

function short(digest) {
  return digest ? `${digest.slice(0, 12)}...` : "nothing";
}

function usage() {
  console.log(`Usage:
  node scripts/generate-variant-revision-digests.mjs --generate
  node scripts/generate-variant-revision-digests.mjs --verify`);
  process.exit(1);
}
