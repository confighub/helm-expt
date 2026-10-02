#!/usr/bin/env node
// NO-PERSONAL-NAMES gate.
//
// The repo keeps personal names out of committed files: prose says "a colleague",
// "the maintainer", or the issue number instead of naming a person. Sweeps removed
// the existing names (issues/PRs on 2026-07-03, committed files in PR #1102), but
// names kept creeping back because nothing failed when they did. This lane makes
// the policy permanent: it fails when any tracked file contains one of the swept
// first names, and prints the offending lines.
//
// Pull request text is in scope too. This repo squash-merges, so a pull
// request's title and description become the commit message on main, and that is
// how names reached main's history after the file sweeps. --pr-text checks both
// fields with the same pattern, so the two checks cannot drift.
//
// Scope notes:
//   - runs/ is in scope. It was exempt until the receipts were swept: they are
//     recorded evidence, and they are also served on the public site, so a home
//     path or an account address in one is published. The sweep rewrote a home
//     directory as $HOME, the form the other receipts already used, and an
//     account address as user@example.com. No gate hashed or byte-compared the
//     53 files it touched, and none needed a named exception. A new receipt
//     must be written the same way before it is committed. If one ever cannot
//     be, exclude that one file by path here with the reason; never the folder.
//   - This script is excluded from its own scan because it must hold the pattern.
//     Keep names out of its prose too. The pattern below is the only place a
//     name is written; the self-test builds its fixtures from it.
//   - git grep -E on macOS does not support \b word boundaries, so the file scan
//     uses -w. A bare first name matches; a longer identifier that merely
//     contains one (for example a GitHub handle) does not. The pull request
//     check applies the same whole-word, case-insensitive rule in JavaScript.
//
// Usage:
//   node scripts/verify-no-personal-names.mjs              # tracked files; exit 1 on any hit
//   node scripts/verify-no-personal-names.mjs --pr-text    # pull request title and body
//   node scripts/verify-no-personal-names.mjs --self-test  # the pull request matcher
//
// --pr-text reads the title and body from PR_TITLE and PR_BODY when PR_TITLE is
// set, and otherwise from the pull_request object in the event file that
// GITHUB_EVENT_PATH names. Pull request text is written by whoever opens the
// pull request, so a workflow must never interpolate it into a run: script.
// Reading the event file here means the workflow passes nothing at all.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const PATTERN = "alexis|jesper|brian|charlie";
const SELF = "scripts/verify-no-personal-names.mjs";
// What the file scan reads: every tracked file but this one. An exclusion added
// here must name one file and say why; the self-test fails on a folder.
const FILE_SCOPE = [".", `:(exclude)${SELF}`];

// Whole word and case-insensitive, matching what `git grep -wi` does for files:
// a name counts only when no letter, digit, or underscore touches it.
const WORD = new RegExp(`(?<![A-Za-z0-9_])(?:${PATTERN})(?![A-Za-z0-9_])`, "i");

// Returns one row per offending line, naming the field it came from.
function findNames(fields) {
  const hits = [];
  for (const [field, text] of Object.entries(fields)) {
    // A pull request body arrives with CRLF line endings; a null body is empty.
    const lines = String(text ?? "").split(/\r\n|\r|\n/);
    lines.forEach((line, index) => {
      if (WORD.test(line)) hits.push({ field, line: index + 1, text: line });
    });
  }
  return hits;
}

function report(hits) {
  // Each line is printed behind its field name, so text nobody here wrote can
  // never begin an output line and be read as a workflow command.
  for (const hit of hits) console.error(`${hit.field}:${hit.line}: ${hit.text}`);
  console.error("");
  console.error(`no-personal-names gate: ${hits.length} line(s) above name a person in the pull request title or body.`);
  console.error("This repo squash-merges, so that text becomes the commit message on main.");
  console.error("Edit the pull request and replace each name with neutral wording (the team / a colleague / the issue number).");
  console.error("Editing the title or description re-runs this check.");
}

function pullRequestText() {
  if (process.env.PR_TITLE !== undefined) {
    return { title: process.env.PR_TITLE, body: process.env.PR_BODY ?? "" };
  }
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error("no-personal-names gate: --pr-text needs PR_TITLE (and PR_BODY), or GITHUB_EVENT_PATH naming a pull_request event.");
    process.exit(2);
  }
  const pull = JSON.parse(readFileSync(eventPath, "utf8")).pull_request;
  if (!pull) {
    console.error("no-personal-names gate: the event file holds no pull_request object, so there is no text to check.");
    process.exit(2);
  }
  return { title: pull.title ?? "", body: pull.body ?? "" };
}

if (process.argv.includes("--self-test")) {
  // Fixtures come from the pattern, so no name is written a second time.
  const names = PATTERN.split("|");
  const [first] = names;
  const cases = [
    ["clean text", { title: "ci: check pull request text", body: "The team asked for this in #1102.\r\nA colleague reviewed it." }, []],
    ["a name in the title", { title: `docs: notes from ${first}`, body: "Nothing here." }, ["title:1"]],
    ["a name in the body", { title: "docs: notes", body: `First line.\r\nThanks to ${first.toUpperCase()} for the review.\r\nLast line.` }, ["body:2"]],
    ["a handle that merely contains a name", { title: `docs: thank @${first}dev`, body: `Reviewed by x${first}, ${first}_bot and ${first}42.` }, []],
    ["a missing body", { title: "docs: notes", body: null }, []],
    ...names.map((name, index) => [`pattern entry ${index + 1} as a whole word`, { title: "docs: notes", body: `(${name[0].toUpperCase()}${name.slice(1)}) said so.` }, ["body:1"]]),
  ];
  const failures = [];
  for (const [label, fields, expected] of cases) {
    const actual = findNames(fields).map((hit) => `${hit.field}:${hit.line}`);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${label}: expected [${expected.join(", ")}], found [${actual.join(", ")}]`);
    }
  }
  // The file scan once excluded all of runs/. A folder exclusion would hide
  // every receipt in it again, so an exclusion has to be a single tracked file.
  const excluded = FILE_SCOPE.filter((spec) => spec.startsWith(":(exclude)")).map((spec) => spec.slice(":(exclude)".length));
  if (FILE_SCOPE[0] !== "." || excluded.length !== FILE_SCOPE.length - 1) failures.push("the file scan no longer starts from every tracked file");
  for (const path of excluded) {
    const listed = spawnSync("git", ["ls-files", "--", path], { cwd: repoRoot, encoding: "utf8" }).stdout.trim().split("\n");
    if (listed.length !== 1 || listed[0] !== path) failures.push(`the file scan excludes ${path}, which is not exactly one tracked file`);
  }
  if (failures.length) {
    for (const failure of failures) console.error(`no-personal-names self-test failed: ${failure}`);
    process.exit(1);
  }
  console.log(`self-test passed: the file scan covers every tracked file except ${excluded.join(", ")}, and excludes no folder`);
  console.log(`self-test passed: ${cases.length} pull request text cases (clean text, a name in the title, a name in the body, a handle that contains a name, a missing body, and each of ${names.length} pattern entries)`);
  process.exit(0);
}

if (process.argv.includes("--pr-text")) {
  const fields = pullRequestText();
  const hits = findNames(fields);
  if (hits.length) {
    report(hits);
    process.exit(1);
  }
  const bodyLines = String(fields.body ?? "").split(/\r\n|\r|\n/).length;
  console.log(`no-personal-names gate: clean (pull request title, and ${bodyLines} line(s) of body)`);
  process.exit(0);
}

const res = spawnSync(
  "git",
  ["grep", "-nwiE", PATTERN, "--", ...FILE_SCOPE],
  { cwd: repoRoot, encoding: "utf8" },
);

if (res.error) throw res.error;

if (res.status === 1) {
  console.log("no-personal-names gate: clean (all tracked files, including the receipts under runs/)");
  process.exit(0);
}

if (res.status === 0) {
  const lines = res.stdout.trim().split("\n");
  console.error(res.stdout.trim());
  console.error("");
  console.error(`no-personal-names gate: ${lines.length} line(s) above name a person in committed files.`);
  console.error("Replace each name with neutral phrasing (a colleague / the maintainer / the issue number).");
  console.error("In a receipt under runs/, write a home directory as $HOME and an account address as user@example.com.");
  console.error("Every tracked file is in scope, including the receipts under runs/.");
  process.exit(1);
}

console.error(res.stderr.trim() || `git grep exited with status ${res.status}`);
process.exit(2);
