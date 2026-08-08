#!/usr/bin/env node
// Records the charts where upstream republished a version string under
// different bytes, and what the catalog decided to do about each one.
//
// A version string is supposed to name one artifact. When a publisher reuses it
// for different bytes, anyone who pinned the version has a choice to make, and
// the choice deserves to be recorded rather than resolved silently. The catalog
// keeps the bytes it locked, marked retained-exact, because every proof it
// holds was produced from those bytes and re-pinning would quietly invalidate
// them. It also records the republished bytes, with their digest and a witness
// of their contents, so the newer artifact is available and inspectable rather
// than merely mentioned.
//
// Output is a pure function of the committed witnesses, source locks, and the
// witness-coverage report. The republished witnesses themselves are recorded by
// scripts/scan-flattening-witness.mjs with a name suffix and a package note.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const OUT_DIR = join(repoRoot, "data", "upstream-drift");
const WITNESS_DIR = join(repoRoot, "data", "flattening-safety", "witnesses");
const COVERAGE = join(repoRoot, "data", "flattening-safety", "witness-coverage.csv");

// The catalog's decision per drifted entry. Recorded here rather than inferred,
// because retaining bytes upstream no longer serves is a policy choice.
const DECISIONS = {
  "fairwinds-stable/goldilocks/10.3.0": {
    decision: "retained-exact",
    rationale:
      "The catalog keeps the bytes it locked. Its rendered objects, package receipt, and published installer package were all produced from them, so re-pinning would invalidate that evidence without changing what any consumer already installed.",
  },
  "fairwinds-stable/vpa/4.11.0": {
    decision: "retained-exact",
    rationale:
      "The catalog keeps the bytes it locked, for the same reason as its sibling chart: the recorded proofs describe those bytes, and a silent re-pin would leave them describing something else.",
  },
};

function driftRows() {
  check(existsSync(COVERAGE), "witness coverage is missing; run npm run flattening-witnesses");
  const lines = readFileSync(COVERAGE, "utf8").trim().split("\n");
  const header = lines[0].split(",");
  const rows = [];
  for (const line of lines.slice(1)) {
    // The detail column is quoted and may contain commas.
    const cells = line.match(/(".*?"|[^,]*)(,|$)/g).map((cell) => cell.replace(/,$/, "").replace(/^"|"$/g, ""));
    const row = Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]));
    if (row.status !== "hash-mismatch") continue;

    const key = `${row.repository}/${row.chart}/${row.version}`;
    const decision = DECISIONS[key];
    check(decision, `no recorded decision for drifted entry ${key}`);

    const lockPath = join(repoRoot, row.recipe, "source-lock.yaml");
    const lockText = readFileSync(lockPath, "utf8");
    const retained =
      lockText.match(/packageSHA256:\s*"?([a-f0-9]{64})"?/)?.[1] ??
      lockText.match(/archiveSHA256:\s*"?([a-f0-9]{64})"?/)?.[1];
    const repositoryUrl = lockText.match(/repositoryURL:\s*"?([^"\n]+)"?/)?.[1]?.trim();

    const republishedWitnessRel = `data/flattening-safety/witnesses/${row.repository}-${row.chart}-${row.version}-republished.yaml`;
    const republishedPath = join(repoRoot, `${republishedWitnessRel}`);
    check(
      existsSync(republishedPath),
      `${key} drifted but no republished witness exists at ${republishedWitnessRel}`,
    );
    const republished = readYaml(republishedPath).spec;

    rows.push({
      recipe: row.recipe,
      repository: row.repository,
      chart: row.chart,
      version: row.version,
      retainedSha256: retained,
      republishedSha256: republished.package.sha256,
      decision: decision.decision,
      rationale: decision.rationale,
      repositoryUrl,
      republishedWitness: republishedWitnessRel,
      republishedScannedFiles: republished.scannedFiles,
      retainedEvidence: `${row.recipe}/publication/installer-package-receipt.yaml`,
    });
  }
  return rows.sort((left, right) => (left.recipe < right.recipe ? -1 : 1));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  const header =
    "recipe,repository,chart,version,decision,retained_sha256,republished_sha256,republished_witness,retained_evidence";
  return `${[
    header,
    ...rows.map((row) =>
      [
        row.recipe,
        row.repository,
        row.chart,
        row.version,
        row.decision,
        row.retainedSha256,
        row.republishedSha256,
        row.republishedWitness,
        row.retainedEvidence,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n")}\n`;
}

function summaryMd(rows) {
  const lines = [];
  lines.push("# When upstream republishes a version");
  lines.push("");
  lines.push(
    "A version string is supposed to name one artifact. These charts are the ones where a publisher reused a version string for different bytes, which the witness sweep found by verifying every fetched package against the hash its recipe locks.",
  );
  lines.push("");
  lines.push("| chart | version | decision | retained bytes | republished bytes |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.repository}/${row.chart} | ${row.version} | ${row.decision} | \`${row.retainedSha256.slice(0, 12)}\` | \`${row.republishedSha256.slice(0, 12)}\` |`,
    );
  }
  lines.push("");
  lines.push("## What retained-exact means here");
  lines.push("");
  lines.push(
    "The catalog keeps the bytes it locked. Every proof it holds for these charts, the rendered objects, the package receipt, and the published installer package, was produced from those bytes, so re-pinning would leave that evidence describing an artifact nobody reviewed. The lock stays, and the drift is recorded rather than resolved silently.",
  );
  lines.push("");
  for (const row of rows) {
    lines.push(`- **${row.repository}/${row.chart} ${row.version}.** ${row.rationale}`);
  }
  lines.push("");
  lines.push("## The republished bytes are available too");
  lines.push("");
  lines.push(
    "Retaining does not mean hiding the newer artifact. Each republished package is recorded with its digest and a witness of what it contains, so a consumer can inspect it, compare it, and fetch it deliberately. Verify the digest on arrival: the version string will not distinguish it from the retained one.",
  );
  lines.push("");
  for (const row of rows) {
    lines.push(`### ${row.repository}/${row.chart} ${row.version}`);
    lines.push("");
    lines.push("```sh");
    lines.push(`helm pull ${row.chart} --repo ${row.repositoryUrl} --version ${row.version}`);
    lines.push(`# expect sha256 ${row.republishedSha256}`);
    lines.push("```");
    lines.push("");
    lines.push(
      `Its contents are witnessed at \`${row.republishedWitness}\` across ${row.republishedScannedFiles} scanned files. The retained bytes keep their evidence at \`${row.retainedEvidence}\`.`,
    );
    lines.push("");
  }
  lines.push(
    "The flattening evidence view counts catalog entries, so it reads the retained witness and skips the republished one. Counting both would report one entry twice.",
  );
  lines.push("");
  lines.push("Regenerate with `npm run upstream-drift`. Verify with `npm run upstream-drift:verify`.");
  lines.push("");
  return lines.join("\n");
}

function buildAll() {
  const rows = driftRows();
  check(rows.length > 0, "no drifted entries found; the recorded decisions may be stale");
  return [
    { path: join(OUT_DIR, "drift.csv"), contents: toCsv(rows) },
    { path: join(OUT_DIR, "summary.md"), contents: summaryMd(rows) },
  ];
}

const outputs = buildAll();
if (mode === "--generate") {
  for (const output of outputs) write(output.path, output.contents);
  console.log(`wrote ${outputs.length} upstream-drift file(s)`);
} else if (mode === "--verify") {
  for (const output of outputs) {
    const rel = relativeRepo(output.path);
    check(existsSync(output.path), `${rel} is missing; run npm run upstream-drift`);
    check(
      readFileSync(output.path, "utf8") === output.contents,
      `${rel} is stale; run npm run upstream-drift`,
    );
  }
  console.log(`verified ${outputs.length} upstream-drift file(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-upstream-drift.mjs --generate
  node scripts/generate-upstream-drift.mjs --verify`);
}
