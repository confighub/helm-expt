#!/usr/bin/env node

// Report how old the evidence is.
//
// Every proof in this repository writes a receipt, and a receipt is a claim
// about one moment. The catalog is careful about whether a claim is true and
// says nothing about whether it is recent. A delivery proof from June and one
// from this morning read exactly the same on the page.
//
// This measures the age of every committed receipt and publishes it. Two
// choices keep the record honest.
//
// Ages are measured against the newest receipt in the corpus rather than the
// clock. That makes the output a pure function of committed bytes, so the gate
// cannot go stale overnight, and it asks the more useful question anyway:
// old compared to what else this repository knows.
//
// A receipt carrying no date at all is counted rather than failed. There are
// hundreds, they belong to work this lane did not write, and turning that into
// a red build would either block everyone or get suppressed. Instead the count
// is recorded as a baseline and the lane refuses when it grows. Evidence that
// cannot age is a gap the repository can close deliberately, and until then it
// is visible and cannot get quietly worse.
//
// Everything runs offline against committed bytes.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const summaryPath = join(repoRoot, "data", "receipt-aging", "summary.md");
const csvPath = join(repoRoot, "data", "receipt-aging", "aging.csv");
const baselinePath = join(repoRoot, "data", "receipt-aging", "undated-baseline.txt");

// Receipts across this repository record their moment under several names.
// Reading whichever one a receipt uses is the point: a lane that only knew one
// spelling would report a gap that is really a naming difference.
const DATE_FIELD = /^\s*([A-Za-z]+(?:At|Date)|date|timestamp)\s*:\s*"?(\d{4}-\d{2}-\d{2}[^"\s]*)/gm;
const BUCKETS = [
  { label: "0 to 30 days", limit: 30 },
  { label: "31 to 90 days", limit: 90 },
  { label: "91 to 180 days", limit: 180 },
  { label: "over 180 days", limit: Infinity },
];

// The family is the first path segment under runs/. It groups a proof with its
// siblings without needing a list anyone has to maintain.
const familyOf = (path) => path.split("/")[1] ?? "runs";

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-receipt-aging.mjs --generate
  node scripts/generate-receipt-aging.mjs --verify`);
  process.exit(2);
}

const report = analyse();

if (mode === "--generate") {
  write(csvPath, renderCsv(report));
  write(summaryPath, renderSummary(report));
  write(baselinePath, `${report.undated.length}\n`);
  console.log(
    `wrote ${relativeRepo(summaryPath)}: ${report.dated.length} dated receipt(s), ${report.undated.length} without a date`,
  );
} else {
  check(existsSync(baselinePath), `${relativeRepo(baselinePath)} is missing; run npm run receipt-aging:generate`);
  const baseline = Number(readFileSync(baselinePath, "utf8").trim());
  check(Number.isInteger(baseline), `${relativeRepo(baselinePath)} does not hold a whole number`);
  // The ratchet. A new receipt with no date makes evidence that cannot age,
  // and the count is allowed to fall rather than rise.
  check(
    report.undated.length <= baseline,
    `${report.undated.length} receipts carry no date, above the recorded baseline of ${baseline}; give the new receipt a date field or run npm run receipt-aging:generate to lower the baseline deliberately`,
  );
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run receipt-aging:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(report),
    `${relativeRepo(summaryPath)} is stale; run npm run receipt-aging:generate`,
  );
  check(
    readFileSync(csvPath, "utf8") === renderCsv(report),
    `${relativeRepo(csvPath)} is stale; run npm run receipt-aging:generate`,
  );
  console.log(
    `verified receipt aging across ${report.total} committed receipt(s): newest ${report.newest.slice(0, 10)}, oldest ${report.oldest.slice(0, 10)}, ${report.undated.length} undated against a baseline of ${baseline}`,
  );
}

function trackedReceipts() {
  const output = execFileSync("git", ["ls-files", "--", "runs/"], { cwd: repoRoot, encoding: "utf8" });
  const files = output
    .split("\n")
    .filter((line) => line.endsWith("receipt.yaml") || line.endsWith("-receipt.yaml"))
    .sort();
  check(files.length > 0, "no committed receipts were found under runs/");
  return files;
}

function analyse() {
  const dated = [];
  const undated = [];
  for (const file of trackedReceipts()) {
    const absolute = join(repoRoot, file);
    if (!existsSync(absolute)) continue;
    const text = readFileSync(absolute, "utf8");
    DATE_FIELD.lastIndex = 0;
    const matches = [...text.matchAll(DATE_FIELD)];
    if (matches.length === 0) {
      undated.push(file);
      continue;
    }
    // The earliest recorded moment is the age of the evidence. A receipt that
    // also records a later verification is still evidence about the run.
    const stamps = matches.map((match) => match[2]).sort();
    dated.push({ file, family: familyOf(file), field: matches[0][1], recorded: stamps[0] });
  }
  check(dated.length > 0, "no committed receipt records a date");

  const sorted = [...dated].sort((left, right) => (left.recorded < right.recorded ? -1 : 1));
  const newest = sorted[sorted.length - 1].recorded;
  const oldest = sorted[0].recorded;
  const ageOf = (recorded) => Math.max(0, Math.round((Date.parse(newest) - Date.parse(recorded)) / 86400000));
  for (const row of dated) row.ageDays = ageOf(row.recorded);

  const buckets = BUCKETS.map((bucket, index) => {
    const lower = index === 0 ? -1 : BUCKETS[index - 1].limit;
    return {
      label: bucket.label,
      count: dated.filter((row) => row.ageDays > lower && row.ageDays <= bucket.limit).length,
    };
  });

  const families = [...new Set(dated.map((row) => row.family))].sort().map((family) => {
    const rows = dated.filter((row) => row.family === family).sort((left, right) => left.ageDays - right.ageDays);
    const ages = rows.map((row) => row.ageDays);
    return {
      family,
      count: rows.length,
      undated: undated.filter((file) => familyOf(file) === family).length,
      median: ages[Math.floor(ages.length / 2)],
      oldest: ages[ages.length - 1],
      newest: ages[0],
    };
  });

  const undatedFamilies = [...new Set(undated.map(familyOf))].sort().map((family) => ({
    family,
    count: undated.filter((file) => familyOf(file) === family).length,
  }));

  return {
    total: dated.length + undated.length,
    dated,
    undated,
    undatedFamilies,
    newest,
    oldest,
    buckets,
    families: families.sort((left, right) => right.median - left.median),
  };
}

function renderCsv(report) {
  const rows = [...report.dated]
    .sort((left, right) => right.ageDays - left.ageDays || left.file.localeCompare(right.file))
    .map((row) => `${row.file},${row.family},${row.field},${row.recorded},${row.ageDays}`);
  const undated = [...report.undated].sort().map((file) => `${file},${familyOf(file)},none,,`);
  return `receipt,family,date_field,recorded,age_days\n${[...rows, ...undated].join("\n")}\n`;
}

function renderSummary(report) {
  const bucketRows = report.buckets
    .map((bucket) => `| ${bucket.label} | ${bucket.count} |`)
    .join("\n");
  const familyRows = [...report.families]
    .sort((left, right) => right.count - left.count || right.median - left.median)
    .slice(0, 12)
    .map(
      (row) =>
        `| \`${row.family}\` | ${row.count} | ${row.median} | ${row.oldest} | ${row.undated || "none"} |`,
    )
    .join("\n");
  // One row per family. Hundreds of receipts share a run date, so a plain
  // oldest-first list would be ten rows from one afternoon.
  const seenFamilies = new Set();
  const oldestRows = [...report.dated]
    .sort((left, right) => right.ageDays - left.ageDays || left.file.localeCompare(right.file))
    .filter((row) => {
      if (seenFamilies.has(row.family)) return false;
      seenFamilies.add(row.family);
      return true;
    })
    .slice(0, 10)
    .map((row) => `| \`${row.family}\` | \`${row.file.split("/").pop()}\` | ${row.recorded.slice(0, 10)} | ${row.ageDays} |`)
    .join("\n");
  const undatedRows = report.undatedFamilies
    .map((row) => `| \`${row.family}\` | ${row.count} |`)
    .join("\n");
  const span = Math.round((Date.parse(report.newest) - Date.parse(report.oldest)) / 86400000);

  return `# How old the evidence is

**UNOFFICIAL/EXPERIMENTAL.** Generated by \`npm run receipt-aging:generate\`
and checked by \`npm run receipt-aging:verify\`. The full table is
[aging.csv](./aging.csv).

Every proof here writes a receipt, and a receipt is a claim about one moment.
The catalog is careful about whether a claim is true and has been silent about
whether it is recent. A delivery proof from months ago and one from this
morning read the same on the page.

Ages below are measured against the newest receipt in the repository,
**${report.newest.slice(0, 10)}**, rather than against the clock. That keeps this a
function of committed bytes, so it cannot go stale overnight, and it asks the
more useful question: old compared to what else this repository knows. The
oldest receipt is from ${report.oldest.slice(0, 10)}, so the evidence spans ${span} days.

## The spread

| Age | Receipts |
| --- | --- |
${bucketRows}

## The largest families

The twelve families holding the most receipts, with the median age of each. A
family whose evidence is uniformly old is a better prompt than any single
receipt, and the full table is in the CSV for the rest.

| Family | Dated receipts | Median age | Oldest | Undated |
| --- | --- | --- | --- | --- |
${familyRows}

## The oldest evidence, one family at a time

Hundreds of receipts share a run date, so listing the ten oldest files would
show ten rows from one afternoon. This is the oldest receipt in each of the ten
families whose evidence has aged furthest.

| Family | Receipt | Recorded | Age in days |
| --- | --- | --- | --- |
${oldestRows}

## Receipts that cannot age

${report.undated.length} of ${report.total} committed receipts record no date in any form.
Their evidence cannot be aged at all, which is a stronger problem than being
old, and it is invisible until someone counts.

| Family | Receipts with no date |
| --- | --- |
${undatedRows}

This lane does not fail on them. There are hundreds, they belong to work this
lane did not write, and a red build would either block everyone or get
suppressed. The count is recorded as a baseline instead, and the lane refuses
when it grows. A new receipt has to carry a date, and the existing gap can be
closed deliberately rather than all at once.

## What this does not say

An old receipt is not a wrong receipt. Everything here still verifies against
committed bytes, and a proof about a version nobody has changed is as true as
the day it ran. Age is a prompt to re-run, not a verdict, and deciding which
families deserve a re-run is a judgement this lane deliberately leaves open.

It also measures only what receipts say about themselves. A receipt whose
recorded date is wrong will be reported confidently and wrongly, which is worth
knowing before treating any of these numbers as a freshness guarantee.

Everything runs offline against committed bytes. No cluster, no organization,
and no network takes part.
`;
}
