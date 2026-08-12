#!/usr/bin/env node

// Run one slice of the verify chain.
//
// The chain is a single `&&` sequence of a few hundred gates. Run end to end it
// takes long enough that putting it on every pull request would be a tax rather
// than a safety net, and the alternative was leaving most of it out of CI,
// which is how a lane went red on main while every pull request stayed green.
//
// Every step in the chain is a read-only check over committed bytes, so the
// order they run in carries no meaning. That makes the chain shardable: this
// splits it deterministically and runs one slice, and CI runs the slices in
// parallel. The whole chain still runs on every pull request; it just stops
// taking an hour of wall clock to do it.
//
// The split is by position rather than by name, so a gate added anywhere lands
// in a shard without anyone assigning it. A step that is never assigned to a
// shard would be a step nobody runs, which is the failure this exists to fix,
// so the shard count is checked against the step count rather than assumed.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const readFlag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};

// The reason-matching rule is the one piece of logic here that is not obvious,
// and getting it wrong in either direction is expensive: too strict and every
// declared-red lane fails the run, too loose and the check is theatre. So it is
// exercised directly rather than only through a shard run.
if (args.includes("--self-test")) {
  const cases = [
    // A register entry truncated mid-word still matches the real message.
    ["data/top20-base-readiness/base-readiness.csv is stale; run npm run top20:base-readi",
      "Error: data/top20-base-readiness/base-readiness.csv is stale; run npm run top20:base-readiness\n", true],
    // Whitespace and case differences do not matter.
    ["summary is STALE", "  Error:   summary is stale\n", true],
    // A different failure does not match, which is the case this exists for.
    ["external scan results are stale; the committed results and a fresh kube-linter run disagree",
      "Error: external scan lane currently requires kube-linter\n", false],
    // An empty reason never matches, so an entry cannot pass by saying nothing.
    ["", "Error: anything at all\n", false],
    // An absolute path in the gate's output does not stop the entry matching,
    // so nobody has to paraphrase a message to keep it machine-independent.
    ["data/quirk-coverage/coverage.csv is stale; run npm run quirk-coverage",
      "Error: /home/runner/work/helm-expt/helm-expt/data/quirk-coverage/coverage.csv is stale; run npm run quirk-coverage\n",
      true, "/home/runner/work/helm-expt/helm-expt"],
  ];
  for (const [recorded, output, expected, root] of cases) {
    const actual = reasonMatches(recorded, output, root ?? repoRoot);
    check(actual === expected, `reasonMatches(${JSON.stringify(recorded.slice(0, 40))}) returned ${actual}, expected ${expected}`);
  }
  console.log(`self-test passed: ${cases.length} reason-matching cases, including a truncated entry and a mismatched failure`);
  process.exit(0);
}

const shard = Number(readFlag("--shard"));
const total = Number(readFlag("--of"));
const listOnly = args.includes("--list");
// Two selections rather than one chain, because a handful of steps need a
// command-line tool and the rest need nothing installed. Splitting them keeps
// the shards runnable on a bare runner and pays the install cost once.
const withoutCli = args.includes("--without-cli");
const onlyCli = args.includes("--only-cli");
check(!(withoutCli && onlyCli), "--without-cli and --only-cli ask for opposite things");
// Some gates were already failing when this runner was written, on main, with
// nothing in CI to notice. Failing the build on all of them at once would have
// meant either not turning CI on or turning it on red, so they are declared
// instead. A declared gate that fails is reported and survives; a declared gate
// that passes fails the run, because a register that only grows is a list of
// excuses rather than a ratchet.
const allowKnownRed = args.includes("--allow-known-red");

if (!Number.isInteger(shard) || !Number.isInteger(total)) {
  console.error(`Usage:
  node scripts/run-verify-shard.mjs --shard <n> --of <m>
  node scripts/run-verify-shard.mjs --shard 1 --of 6 --list`);
  process.exit(2);
}

const allSteps = chainSteps();
const cliSteps = cliDependentSteps(allSteps);
const steps = withoutCli
  ? allSteps.filter((step) => !cliSteps.has(step))
  : onlyCli
    ? allSteps.filter((step) => cliSteps.has(step))
    : allSteps;
check(total > 0, "the shard count must be positive");
check(shard >= 1 && shard <= total, `shard ${shard} is outside 1..${total}`);
check(steps.length >= total, `the chain has ${steps.length} steps, fewer than the ${total} shards asked for`);

// Round-robin rather than contiguous blocks. The chain is roughly grouped by
// subject, and slow gates cluster, so contiguous slices would leave one shard
// carrying most of the time.
const mine = steps.filter((_, index) => index % total === shard - 1);
check(mine.length > 0, `shard ${shard} of ${total} has no steps`);

if (listOnly) {
  console.log(mine.join("\n"));
  process.exit(0);
}

const selection = withoutCli
  ? ` (${cliSteps.size} gates needing a command-line tool run in their own job)`
  : onlyCli
    ? " (only the gates needing a command-line tool)"
    : "";
console.log(`running shard ${shard} of ${total}: ${mine.length} of ${steps.length} gates${selection}`);
const knownRed = allowKnownRed ? knownRedSteps(allSteps) : new Map();
let failed = null;
const stillRed = [];
const misdescribed = [];
const nowGreen = [];
for (const [index, step] of mine.entries()) {
  const expectedRed = knownRed.has(step);
  process.stdout.write(`\n[${shard}/${total} ${index + 1}/${mine.length}] ${step}${expectedRed ? " (known red)" : ""}\n`);
  let passed = true;
  let output = "";
  try {
    if (expectedRed) {
      // A declared-red step is the only one whose output is buffered, so its
      // recorded reason can be compared with the failure it actually produces.
      output = execFileSync("sh", ["-c", step], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      process.stdout.write(output);
    } else {
      execFileSync("sh", ["-c", step], { cwd: repoRoot, stdio: "inherit" });
    }
  } catch (error) {
    passed = false;
    if (expectedRed) {
      output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
      process.stdout.write(output);
    }
  }
  if (expectedRed) {
    if (passed) nowGreen.push(step);
    else {
      stillRed.push(step);
      if (!reasonMatches(knownRed.get(step).error, output)) {
        misdescribed.push({ step, recorded: knownRed.get(step).error, actual: firstErrorLine(output) });
      }
    }
    continue;
  }
  if (!passed) {
    // The first unexpected failure is the answer, and continuing past it would
    // bury it under the noise of everything that runs afterwards.
    failed = step;
    break;
  }
}

if (failed) {
  console.error(`\nshard ${shard} of ${total} failed at: ${failed}`);
  process.exit(1);
}
// A wrong reason is worse than no reason: it tells the next reader the lane has
// been diagnosed and closes the question. Two of the three lanes cleared on
// 2026-08-10 had recorded reasons that were simply untrue, and both pointed at
// expensive externally-blocked work while the real fix was cheap and local.
// See #1474.
if (misdescribed.length) {
  console.error("\nthese gates failed for a different reason than the register records:");
  for (const row of misdescribed) {
    console.error(`  ${row.step}`);
    console.error(`    register says: ${row.recorded}`);
    console.error(`    actually says: ${row.actual || "(no error line captured)"}`);
  }
  console.error("\nUpdate tests/verify-chain-known-red.yaml, or fix the lane. A reason nobody checks is how a lane stays red for months over something that was never true.");
  process.exit(1);
}
if (nowGreen.length) {
  console.error(
    `\nthese gates are declared as known red and now pass, so remove them from tests/verify-chain-known-red.yaml:\n  ${nowGreen.join("\n  ")}`,
  );
  process.exit(1);
}
const carried = stillRed.length ? `, carrying ${stillRed.length} known-red gate(s)` : "";
console.log(`\nshard ${shard} of ${total} passed ${mine.length - stillRed.length} gates${carried}`);

// The register names the steps that shell out. It is checked against the chain
// rather than trusted, because an entry naming a step the chain no longer has
// would quietly shrink what the offline shards cover.
function cliDependentSteps(steps) {
  const path = join(repoRoot, "tests", "verify-chain-cli-steps.yaml");
  const doc = readYaml(path);
  check(doc.kind === "VerifyChainCLISteps", `${relativeRepo(path)}: expected kind VerifyChainCLISteps`);
  const declared = (doc.spec?.steps ?? []).map((row) => row.step);
  check(declared.length > 0, `${relativeRepo(path)}: no steps are declared`);
  const known = new Set(steps);
  const stale = declared.filter((step) => !known.has(step));
  check(
    stale.length === 0,
    `${relativeRepo(path)} names steps the chain no longer has: ${stale.slice(0, 3).join("; ")}`,
  );
  return new Set(declared);
}

// The recorded reason is prose, and several entries are truncated mid-sentence,
// so the test is that the register's text appears in what the step printed
// rather than that the two are equal.
export function reasonMatches(recorded, output, root = repoRoot) {
  // Several gates report an absolute path, which differs between a laptop and a
  // runner. Without stripping it, a register entry could only match by
  // paraphrasing the message, and a paraphrase is exactly the unverified prose
  // this check exists to remove. Strip the root and an entry can record what
  // the gate really prints.
  const normalize = (value) => String(value ?? "")
    .split(`${root}/`).join("")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const reason = normalize(recorded);
  if (!reason) return false;
  return normalize(output).includes(reason);
}

function firstErrorLine(output) {
  const line = String(output ?? "").split("\n").find((row) => /^Error:/.test(row.trim()));
  return (line ?? String(output ?? "").split("\n").filter(Boolean).pop() ?? "").trim().slice(0, 200);
}


// The known-red register is checked against the chain the same way the CLI one
// is: an entry naming a step the chain no longer has would excuse something
// that no longer exists.
function knownRedSteps(steps) {
  const path = join(repoRoot, "tests", "verify-chain-known-red.yaml");
  if (!existsSync(path)) return new Map();
  const doc = readYaml(path);
  check(doc.kind === "VerifyChainKnownRed", `${relativeRepo(path)}: expected kind VerifyChainKnownRed`);
  const known = new Set(steps);
  const rows = new Map();
  for (const row of doc.spec?.steps ?? []) {
    check(row.step, `${relativeRepo(path)}: an entry declares no step`);
    check(row.error, `${relativeRepo(path)}: ${row.step} records no error, so nobody can tell what is broken`);
    check(known.has(row.step), `${relativeRepo(path)} names a step the chain no longer has: ${row.step}`);
    rows.set(row.step, row);
  }
  return rows;
}

function chainSteps() {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const chain = manifest.scripts?.verify;
  check(chain, "package.json declares no verify chain");
  const rows = chain
    .split("&&")
    .map((step) => step.trim())
    .filter(Boolean);
  check(rows.length > 1, "the verify chain has no steps to shard");
  return rows;
}
