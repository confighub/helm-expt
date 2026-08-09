#!/usr/bin/env node

// Measure how much of the catalog's upstream carries provenance at all.
//
// The AICR track proved a provenance chain end to end: a signature verified
// offline against pinned trust material, bound to bytes this repository holds.
// The obvious next question is how far that can reach. The catalog retains 139
// charts from 59 upstream repositories, and nobody has ever asked how many of
// them publish anything to verify.
//
// Helm's own answer is a provenance file. A publisher who signs a chart puts a
// detached signature next to the tarball, named after it with .prov appended.
// Its presence is a fact about the publisher rather than about us, and it is
// the precondition for any provenance claim the catalog could make about that
// chart.
//
// This asks that question once per retained chart and records the answer. It
// does not verify a signature: a .prov is signed with a PGP key the publisher
// distributes separately, and deciding which keys to trust is a policy question
// this survey exists to inform rather than to pre-empt.
//
// --run is the only mode that reaches the network. Everything after it, gate
// included, reads the committed snapshot offline.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const snapshotPath = join(repoRoot, "data", "upstream-provenance", "survey.json");
const summaryPath = join(repoRoot, "data", "upstream-provenance", "summary.md");
const csvPath = join(repoRoot, "data", "upstream-provenance", "provenance.csv");
const recipesRoot = join(repoRoot, "recipes");

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-upstream-provenance-survey.mjs --run
  node scripts/generate-upstream-provenance-survey.mjs --generate
  node scripts/generate-upstream-provenance-survey.mjs --verify`);
  process.exit(2);
}

if (mode === "--run") {
  const snapshot = await survey();
  write(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  const report = analyse(snapshot);
  write(summaryPath, renderSummary(report));
  write(csvPath, renderCsv(report));
  console.log(
    `surveyed ${report.total} retained chart(s) across ${report.repositories} upstream repositories: ${report.counts.signed} publish a provenance file, ${report.counts.unsigned} do not, ${report.counts.unknown} could not be reached`,
  );
} else if (mode === "--generate") {
  const report = analyse(readSnapshot());
  write(summaryPath, renderSummary(report));
  write(csvPath, renderCsv(report));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  const report = analyse(readSnapshot());
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run upstream-provenance:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(report),
    `${relativeRepo(summaryPath)} is stale; run npm run upstream-provenance:generate`,
  );
  check(
    readFileSync(csvPath, "utf8") === renderCsv(report),
    `${relativeRepo(csvPath)} is stale; run npm run upstream-provenance:generate`,
  );
  // The snapshot describes the charts this repository retains, so a chart
  // added or removed since makes it a record about a catalog that no longer
  // exists.
  const locks = sourceLocks().length;
  check(
    locks === report.total,
    `the survey covers ${report.total} charts and the catalog now retains ${locks}; run npm run upstream-provenance:run`,
  );
  console.log(
    `verified the upstream provenance survey of ${report.observedAt.slice(0, 10)}: ${report.counts.signed} of ${report.total} retained charts publish a provenance file`,
  );
}

// Every retained chart names its upstream in a source lock. Reading them is
// what keeps this survey a statement about the catalog rather than about a
// list someone typed.
function sourceLocks() {
  const rows = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name === "source-lock.yaml") rows.push(path);
    }
  };
  check(existsSync(recipesRoot), "recipes/ is missing");
  walk(recipesRoot);
  check(rows.length > 0, "no source locks were found under recipes/");
  return rows.sort().map((path) => {
    const spec = readYaml(path).spec ?? {};
    check(spec.repositoryURL, `${relativeRepo(path)} names no repository URL`);
    check(spec.chart && spec.version, `${relativeRepo(path)} names no chart and version`);
    return {
      lock: relativeRepo(path),
      repositoryURL: String(spec.repositoryURL).replace(/\/+$/, ""),
      chart: spec.chart,
      version: String(spec.version),
      sourceType: spec.sourceType ?? "",
    };
  });
}

async function fetchIndex(repositoryURL) {
  // An OCI repository has no index and no .prov convention. Saying so is more
  // useful than recording a failed HTTP request against a URL that was never
  // meant to answer one.
  if (repositoryURL.startsWith("oci://")) return { kind: "oci", entries: null };
  try {
    const response = await fetch(`${repositoryURL}/index.yaml`, {
      redirect: "follow",
      headers: { "user-agent": "helm-expt-upstream-provenance-survey" },
    });
    if (!response.ok) return { kind: "unreachable", status: response.status, entries: null };
    const text = await response.text();
    return { kind: "index", entries: parseIndex(text) };
  } catch (error) {
    return { kind: "unreachable", status: String(error.message).slice(0, 80), entries: null };
  }
}

// A Helm index is large and regular. Reading the two fields this survey needs
// with a line scan avoids parsing tens of megabytes of YAML per repository.
//
// The urls list is tracked by state rather than by pattern. An entry also
// carries home and sources URLs, and an earlier version of this scan collected
// those too, which silently answered the question about the wrong file for
// every chart whose sources are listed before its urls. The number that
// produced looked plausible, which is what made it worth fixing rather than
// shipping.
function parseIndex(text) {
  const entries = new Map();
  let chart = null;
  let version = null;
  let urls = [];
  let inUrls = false;
  const commit = () => {
    if (chart && version && urls.length) entries.set(`${chart}@${version}`, urls[0]);
  };
  const startEntry = () => {
    commit();
    version = null;
    urls = [];
    inUrls = false;
  };
  for (const line of text.split("\n")) {
    const chartMatch = line.match(/^  ([A-Za-z0-9][A-Za-z0-9._-]*):\s*$/);
    if (chartMatch) {
      startEntry();
      chart = chartMatch[1];
      continue;
    }
    // A new version entry in the list starts with "- " at the entry indent.
    if (/^  - \S/.test(line)) startEntry();
    if (/^\s+urls:\s*$/.test(line)) {
      inUrls = true;
      continue;
    }
    const listItem = line.match(/^\s+- (\S+)\s*$/);
    if (listItem) {
      if (inUrls) urls.push(listItem[1]);
      continue;
    }
    // Any other key ends the urls list.
    if (/^\s+[A-Za-z0-9_.-]+:/.test(line)) inUrls = false;
    const versionMatch = line.match(/^\s+version:\s*"?([^"\s]+)"?\s*$/);
    if (versionMatch) version = versionMatch[1];
  }
  commit();
  return entries;
}

async function head(url) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    return response.status;
  } catch (error) {
    return String(error.message).slice(0, 60);
  }
}

async function survey() {
  // A provenance claim that quietly disappears is worse than one never made,
  // so a publisher who stops signing has to leave a record rather than a
  // silence. The previous snapshot is the only thing that can notice.
  const previous = existsSync(snapshotPath)
    ? new Map(
        (JSON.parse(readFileSync(snapshotPath, "utf8")).charts ?? []).map((row) => [
          `${row.chart}@${row.version}`,
          row.provenance,
        ]),
      )
    : new Map();
  const locks = sourceLocks();
  const repositories = [...new Set(locks.map((row) => row.repositoryURL))].sort();
  const indexes = new Map();
  for (const repository of repositories) {
    indexes.set(repository, await fetchIndex(repository));
  }

  const charts = [];
  for (const lock of locks) {
    const index = indexes.get(lock.repositoryURL);
    if (index.kind !== "index") {
      charts.push({ ...lock, provenance: "unknown", reason: index.kind, detail: index.status ?? "" });
      continue;
    }
    const listed = index.entries.get(`${lock.chart}@${lock.version}`);
    if (!listed) {
      charts.push({ ...lock, provenance: "unknown", reason: "version-not-in-index", detail: "" });
      continue;
    }
    // An index may point at an OCI reference rather than a tarball. Bitnami's
    // does for every chart the catalog retains, which is the migration that
    // followed its repricing. The provenance convention is about a file beside
    // a tarball, so there is nothing to ask for, and saying that is more useful
    // than recording a failed request.
    if (listed.startsWith("oci://")) {
      charts.push({ ...lock, tarball: listed, provenance: "unknown", reason: "oci-hosted-chart", detail: "" });
      continue;
    }
    // Index entries may list a relative URL, which resolves against the
    // repository it came from.
    const url = listed.startsWith("http") ? listed : `${lock.repositoryURL}/${listed.replace(/^\/+/, "")}`;
    const status = await head(`${url}.prov`);
    // A 404 answers the question: the publisher put no provenance file there.
    // Anything else, including a 403, means the question went unanswered, and
    // an unanswered question is not a negative answer.
    const provenance = status === 200 ? "signed" : status === 404 ? "unsigned" : "unknown";
    charts.push({
      ...lock,
      tarball: url,
      provStatus: status,
      provenance,
      reason: status === 200 ? "provenance-file-published" : status === 404 ? "no-provenance-file" : `status-${status}`,
      detail: "",
    });
  }

  const changes = charts
    .filter((row) => {
      const before = previous.get(`${row.chart}@${row.version}`);
      return before !== undefined && before !== row.provenance;
    })
    .map((row) => ({
      chart: row.chart,
      version: row.version,
      from: previous.get(`${row.chart}@${row.version}`),
      to: row.provenance,
      reason: row.reason,
    }));

  return {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    changesSinceLastSurvey: changes,
    method:
      "For each retained chart, the upstream repository index was read for that exact version's tarball URL, and a HEAD request asked whether a Helm provenance file sits beside it. No signature was verified and nothing was downloaded.",
    repositories: repositories.length,
    charts,
  };
}

function readSnapshot() {
  check(existsSync(snapshotPath), `${relativeRepo(snapshotPath)} is missing; run npm run upstream-provenance:run`);
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  check(snapshot.observedAt, `${relativeRepo(snapshotPath)} records no observation time`);
  check((snapshot.charts ?? []).length > 0, `${relativeRepo(snapshotPath)} surveyed no charts`);
  return snapshot;
}

function analyse(snapshot) {
  const charts = [...snapshot.charts].sort((left, right) =>
    left.chart.localeCompare(right.chart) || left.version.localeCompare(right.version),
  );
  const counts = {
    signed: charts.filter((row) => row.provenance === "signed").length,
    unsigned: charts.filter((row) => row.provenance === "unsigned").length,
    unknown: charts.filter((row) => row.provenance === "unknown").length,
  };
  const byRepository = [...new Set(charts.map((row) => row.repositoryURL))].sort().map((repository) => {
    const rows = charts.filter((row) => row.repositoryURL === repository);
    return {
      repository,
      charts: rows.length,
      signed: rows.filter((row) => row.provenance === "signed").length,
      verdict:
        rows.every((row) => row.provenance === "signed")
          ? "signs every retained chart"
          : rows.some((row) => row.provenance === "signed")
            ? "signs some"
            : rows.every((row) => row.reason === "oci" || row.reason === "oci-hosted-chart")
              ? "OCI-hosted, no provenance convention"
              : rows.every((row) => row.provenance === "unknown")
                ? "could not be asked"
                : "publishes none",
    };
  });
  return {
    observedAt: snapshot.observedAt,
    method: snapshot.method,
    changes: snapshot.changesSinceLastSurvey ?? [],
    total: charts.length,
    repositories: byRepository.length,
    counts,
    charts,
    byRepository,
  };
}

function renderCsv(report) {
  const rows = report.charts.map((row) =>
    [row.chart, row.version, row.repositoryURL, row.provenance, row.reason].join(","),
  );
  return `chart,version,repository,provenance,reason\n${rows.join("\n")}\n`;
}

function renderSummary(report) {
  const signedRepos = report.byRepository.filter((row) => row.signed > 0);
  const unreachable = report.byRepository.filter((row) => row.verdict === "could not be reached");
  const repoRows = report.byRepository
    .map((row) => `| ${row.repository} | ${row.charts} | ${row.signed} | ${row.verdict} |`)
    .join("\n");
  const signedRows = report.charts
    .filter((row) => row.provenance === "signed")
    .map((row) => `| \`${row.chart}\` | ${row.version} | ${row.repositoryURL} |`)
    .join("\n");
  const share = Math.round((report.counts.signed / report.total) * 100);
  const reasons = new Map();
  for (const row of report.charts.filter((entry) => entry.provenance === "unknown")) {
    reasons.set(row.reason, (reasons.get(row.reason) ?? 0) + 1);
  }
  const reasonText = {
    oci: "sit in an OCI repository, which has no index and no provenance convention",
    "oci-hosted-chart": "are listed in an HTTP index that points at an OCI reference rather than a tarball, which is the migration that followed one publisher's repricing",
    "status-403": "answered with a refusal rather than an answer",
    unreachable: "sit in a repository whose index could not be read",
    "version-not-in-index": "name a version the current index no longer lists",
  };
  const unknownRows = [...reasons.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => `- **${count}** ${reasonText[reason] ?? reason}.`)
    .join("\n");
  const changeLine = report.changes.length
    ? `Since the previous survey, ${report.changes.length} chart(s) changed verdict: ${report.changes
        .map((row) => `\`${row.chart}\` ${row.version} moved from ${row.from} to ${row.to}`)
        .join("; ")}.`
    : "No chart has changed verdict since the previous survey. This is the first record for some of them, and a first record cannot show a change.";

  return `# How much of the catalog's upstream publishes provenance

**UNOFFICIAL/EXPERIMENTAL.** The snapshot is taken by
\`npm run upstream-provenance:run\`, which is the only step that reaches the
network. The summary is rendered by \`npm run upstream-provenance:generate\`
and checked offline by \`npm run upstream-provenance:verify\`. The full table
is [provenance.csv](./provenance.csv).

The AICR track proved a provenance chain end to end: a signature verified
offline against pinned trust material, bound to bytes this repository holds.
The obvious next question is how far that can reach, and nobody had asked it.
This asks once per retained chart.

Surveyed **${report.observedAt.slice(0, 10)}**. ${report.method}

## The answer

**${report.counts.signed} of ${report.total} retained charts** publish a Helm provenance file, which is
${share}% of the catalog. ${report.counts.unsigned} publish none, and ${report.counts.unknown} could not be asked, mostly
because their charts are hosted in a way this convention does not cover.

That number is the ceiling on any provenance claim the catalog could make by
this mechanism. It is not a criticism of the publishers who sign nothing:
signing a Helm chart is uncommon, and most of this catalog's upstreams have
never done it.

## By upstream repository

${signedRepos.length} of ${report.repositories} upstream repositories sign at least one retained chart.

| Repository | Retained charts | Signed | Verdict |
| --- | --- | --- | --- |
${repoRows}

## The charts that could carry a provenance claim today

${signedRows || "| none | | |"}

## What this does not do

It does not verify a signature. A Helm provenance file is signed with a PGP key
the publisher distributes separately, and deciding which keys to trust is a
policy question this survey exists to inform rather than to pre-empt. Presence
is a fact about the publisher; trust is a decision about them.

It also asks only about Helm's own provenance mechanism. A publisher might sign
container images, or attest builds, without signing the chart, and none of that
would appear here. What this measures is the provenance a chart consumer can
check at the point they pull the chart.

## Why the rest could not be asked

${unknownRows}

An unanswered question is not a negative answer, so none of these count as
unsigned. The OCI rows are the interesting ones: a chart served from a registry
carries no file beside a tarball, so provenance there would have to come from a
registry-native signature rather than from this mechanism.

## When a publisher stops signing

${changeLine}

A provenance claim that quietly disappears is worse than one never made. Each
run compares its answers against the previous snapshot and records every chart
whose verdict moved, so a publisher who stops signing leaves a record rather
than a silence. That is the only way this survey can carry a claim over time
rather than describing one afternoon.

Everything in the verify path runs offline against committed bytes. Nothing was
downloaded, no signature was made, and no cluster or organization took part.
`;
}
