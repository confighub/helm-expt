#!/usr/bin/env node

// Measure the gap between what the catalog retains and what upstream ships.
//
// The retained-versions story only works if the gap is measured rather than
// discovered. A catalog that retains an exact version is making a deliberate
// choice, and a deliberate choice needs a number next to it: how many releases
// behind, how many days, and how fast the project moves.
//
// The pages have been saying AICR ships "roughly every two weeks". That was
// read off a release page by hand once. Here it is computed from a committed
// snapshot of the release list, so it stops being folklore.
//
// --run is the only mode that reaches the network. It fetches the release list
// and writes a snapshot with the moment it was taken. Everything after that,
// including the gate, reads the committed snapshot offline. Ages are measured
// against the snapshot's own timestamp rather than the clock, so the record is
// stable until someone takes a new snapshot on purpose.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const RELEASES_URL = "https://api.github.com/repos/NVIDIA/aicr/releases?per_page=30";
const snapshotPath = join(repoRoot, "data", "aicr-upstream-watch", "releases.json");
const summaryPath = join(repoRoot, "data", "aicr-upstream-watch", "summary.md");
const evidencePath = join(repoRoot, "data", "aicr-platform-evidence", "platform-evidence.json");
const namingPath = join(repoRoot, "examples", "aicr", "claims", "entry-names.yaml");

const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-aicr-upstream-watch.mjs --run
  node scripts/generate-aicr-upstream-watch.mjs --generate
  node scripts/generate-aicr-upstream-watch.mjs --verify`);
  process.exit(2);
}

if (mode === "--run") {
  const snapshot = await fetchSnapshot();
  write(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  const report = analyse(snapshot);
  write(summaryPath, renderSummary(report));
  console.log(
    `snapshot taken at ${snapshot.observedAt}: upstream is at ${report.latest.tag}, the catalog holds ${report.newestRetained.tag}, ${report.releasesBehind} release(s) behind`,
  );
} else if (mode === "--generate") {
  const report = analyse(readSnapshot());
  write(summaryPath, renderSummary(report));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  const report = analyse(readSnapshot());
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-upstream-watch:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(report),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-upstream-watch:generate`,
  );
  console.log(
    `verified the upstream watch: ${report.retained.length} retained version(s) against ${report.releases.length} upstream release(s), ${report.releasesBehind} behind as of ${report.observedAt}`,
  );
}

async function fetchSnapshot() {
  const response = await fetch(RELEASES_URL, {
    headers: { accept: "application/vnd.github+json", "user-agent": "helm-expt-aicr-upstream-watch" },
  });
  check(response.ok, `the release list request failed with ${response.status}`);
  const body = await response.json();
  check(Array.isArray(body) && body.length > 0, "the release list came back empty");
  return {
    schemaVersion: 1,
    source: RELEASES_URL,
    observedAt: new Date().toISOString(),
    releases: body
      .filter((release) => !release.draft)
      .map((release) => ({
        tag: release.tag_name,
        publishedAt: release.published_at,
        prerelease: Boolean(release.prerelease),
      }))
      .sort((left, right) => (left.publishedAt < right.publishedAt ? 1 : -1)),
  };
}

function readSnapshot() {
  check(existsSync(snapshotPath), `${relativeRepo(snapshotPath)} is missing; run npm run aicr-upstream-watch:run`);
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  check(snapshot.observedAt, `${relativeRepo(snapshotPath)} records no observation time`);
  check((snapshot.releases ?? []).length > 0, `${relativeRepo(snapshotPath)} lists no releases`);
  return snapshot;
}

// The retained versions are read from the naming register and cross-checked
// against the published evidence record, so this lane cannot disagree with
// either about what the catalog holds.
function retainedVersions() {
  const register = readYaml(namingPath);
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  const byId = new Map((evidence.spec?.entries ?? []).map((entry) => [entry.id, entry]));
  const rows = [];
  for (const entry of register.spec?.entries ?? []) {
    const published = byId.get(entry.id);
    if (!published) continue;
    const upstream = published.upstream ?? {};
    if (upstream.name !== "NVIDIA AICR") continue;
    check(
      upstream.version === entry.retainedVersion,
      `${entry.id}: the naming register says ${entry.retainedVersion} and the evidence record says ${upstream.version}`,
    );
    rows.push({ entry: entry.id, version: entry.retainedVersion, provenance: published.provenance });
  }
  check(rows.length > 0, "no retained AICR versions were found to compare against upstream");
  return rows;
}

function analyse(snapshot) {
  const releases = snapshot.releases.filter((release) => !release.prerelease);
  const retained = retainedVersions();
  const byTag = new Map(releases.map((release) => [release.tag, release]));

  // A retained version upstream no longer lists is worth catching. It means a
  // release was pulled, and every receipt naming it deserves a second look.
  const missing = retained.filter((row) => !byTag.has(row.version));
  check(
    missing.length === 0,
    `these retained versions are not in the upstream release list: ${missing.map((row) => `${row.entry} at ${row.version}`).join(", ")}`,
  );

  const retainedTags = new Set(retained.map((row) => row.version));
  const newestRetained = releases.find((release) => retainedTags.has(release.tag));
  const latest = releases[0];
  const newer = releases.filter((release) => release.publishedAt > newestRetained.publishedAt);

  // Cadence, computed rather than repeated. Measured over minor releases only:
  // this project publishes several tags on one day, so the median across every
  // tag is a day and says nothing about how fast the platform moves. The
  // question a retained version cares about is when the next minor lands.
  const minors = releases.filter((release) => /^v\d+\.\d+\.0$/.test(release.tag));
  check(minors.length > 2, "the snapshot holds too few minor releases to measure a cadence");
  const gaps = minors
    .slice(0, -1)
    .map((release, index) => days(minors[index + 1].publishedAt, release.publishedAt))
    .sort((left, right) => left - right);
  const median = gaps[Math.floor(gaps.length / 2)];

  return {
    observedAt: snapshot.observedAt,
    source: snapshot.source,
    releases,
    retained,
    latest,
    newestRetained,
    releasesBehind: newer.length,
    daysBehind: days(newestRetained.publishedAt, latest.publishedAt),
    snapshotAgeDays: days(latest.publishedAt, snapshot.observedAt),
    cadenceDays: median,
    cadenceSample: gaps.length,
    minorReleases: minors.length,
  };
}

function renderSummary(report) {
  const retainedRows = report.retained
    .map((row) => {
      const release = report.releases.find((entry) => entry.tag === row.version);
      const behind = report.releases.filter((entry) => entry.publishedAt > release.publishedAt).length;
      return `| \`${row.entry}\` | ${row.provenance} | ${row.version} | ${release.publishedAt.slice(0, 10)} | ${behind} |`;
    })
    .join("\n");

  const recentRows = report.releases
    .slice(0, 6)
    .map((release) => {
      const held = report.retained.some((row) => row.version === release.tag);
      return `| ${release.tag} | ${release.publishedAt.slice(0, 10)} | ${held ? "retained" : "not retained"} |`;
    })
    .join("\n");

  const fortnightly = Math.abs(report.cadenceDays - 14) <= 2;
  const cadenceLine = `The median gap between minor releases is **${report.cadenceDays} days**, over ${report.cadenceSample} intervals across ${report.minorReleases} minor releases in this snapshot. The pages have been saying AICR ships roughly every two weeks, which ${fortnightly ? "the measurement supports" : "the measurement does not support"}. It was read off a release page by hand once and repeated since. It is derived now, so it can be wrong out loud rather than quietly.`;

  const headline = report.releasesBehind === 0
    ? `The catalog's newest retained version is upstream's newest release. There is no gap to report today, which is a fact with a date on it rather than a permanent state.`
    : `The catalog's newest retained version is ${report.releasesBehind} release(s) and ${report.daysBehind} days behind upstream's newest.`;

  return `# How far behind upstream the retained AICR versions are

**UNOFFICIAL/EXPERIMENTAL.** The snapshot is taken by
\`npm run aicr-upstream-watch:run\`, which is the only step that reaches the
network. The summary is rendered by \`npm run aicr-upstream-watch:generate\`
and checked offline by \`npm run aicr-upstream-watch:verify\`.

Retaining an exact version is a deliberate choice, and a deliberate choice
needs a number next to it. This measures the gap instead of leaving it to be
discovered when someone happens to look at a release page.

Everything below is measured against the snapshot's own timestamp,
**${report.observedAt}**, rather than against the clock. The record stays stable
until someone takes a new snapshot on purpose, and a stale snapshot is visible
as a date rather than hidden behind a moving number.

## The gap today

${headline}

| Entry | Provenance | AICR version | Released | Releases published since |
| --- | --- | --- | --- | --- |
${retainedRows}

A derived entry carries the version of the entry it came from, so it moves when
that entry moves rather than on its own. Listing it here keeps the row count
equal to the number of entries whose freshness depends on an AICR release.

## Recent upstream releases

| Release | Published | In the catalog |
| --- | --- | --- |
${recentRows}

## The cadence is computed now

${cadenceLine}

The measurement covers minor releases only. This project publishes several tags
on one day, so a median across every tag would be a day and would say nothing
about how fast the platform moves. What a retained version cares about is when
the next minor lands.

That number is what makes retention a decision rather than neglect. A version
retained today falls a release behind within about ${report.cadenceDays} days whatever
anyone intends, and the catalog's answer is to retain deliberately and record
the distance rather than chase the tag.

## What this does not do

It does not decide anything. A gap is not a defect, and closing one costs a new
entry with its own receipts, which
[the refresh brief](../../docs/planning/aicr-version-refresh-brief.md) works
out in full. This lane exists so that decision is made against a measured
number.

It also says nothing about what changed between versions. That is
[the version diff](../aicr-version-diff/summary.md), which compares the
retained entries byte for byte.

The snapshot is a record of what upstream listed at one moment, taken from
${report.source}. No cluster, no organization, and no GPU workload is involved,
and nothing here downloads or runs an upstream artifact.
`;
}
