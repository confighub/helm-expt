#!/usr/bin/env node
// NO-PERSONAL-NAMES gate.
//
// The repo keeps personal names out of committed files: prose says "a colleague",
// "the maintainer", or the issue number instead of naming a person. Sweeps removed
// the existing names (issues/PRs on 2026-07-03, committed files in PR #1102), but
// names kept creeping back because nothing failed when they did. This lane makes
// the policy permanent: it fails when any tracked file outside runs/ contains one
// of the swept first names, and prints the offending lines.
//
// Scope notes:
//   - runs/ is exempt on purpose. Receipts are recorded evidence and the sweeps
//     deliberately left them untouched.
//   - This script is excluded from its own scan because it must hold the pattern.
//     Keep names out of its prose too.
//   - git grep -E on macOS does not support \b word boundaries, so the match uses
//     -w. A bare first name matches; a longer identifier that merely contains one
//     (for example a GitHub handle) does not.
//
// Usage:
//   node scripts/verify-no-personal-names.mjs   # exit 1 on any hit
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const PATTERN = "alexis|jesper|brian";
const SELF = "scripts/verify-no-personal-names.mjs";

const res = spawnSync(
  "git",
  ["grep", "-nwiE", PATTERN, "--", ".", ":(exclude)runs", `:(exclude)${SELF}`],
  { cwd: repoRoot, encoding: "utf8" },
);

if (res.error) throw res.error;

if (res.status === 1) {
  console.log("no-personal-names gate: clean (all tracked files outside runs/)");
  process.exit(0);
}

if (res.status === 0) {
  const lines = res.stdout.trim().split("\n");
  console.error(res.stdout.trim());
  console.error("");
  console.error(`no-personal-names gate: ${lines.length} line(s) above name a person in committed files.`);
  console.error("Replace each name with neutral phrasing (a colleague / the maintainer / the issue number).");
  console.error("runs/ receipts are exempt as recorded evidence; every other tracked file is in scope.");
  process.exit(1);
}

console.error(res.stderr.trim() || `git grep exited with status ${res.status}`);
process.exit(2);
