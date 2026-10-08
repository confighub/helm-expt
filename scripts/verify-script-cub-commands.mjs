#!/usr/bin/env node
// Checks the `cub` commands that scripts under scripts/ build from literals
// against the committed snapshot of the CLI's own --help text
// (tests/cub-help-surface.json). It reads files only and never runs cub.
//
// The reader-facing gates (verify-variant-command-surface.mjs and
// verify-installer-command-surface.mjs) check what a reader is told to run.
// This gate checks what the lane scripts run. A live lane runs against a
// server only by hand, so nothing else in the verify chain would notice that
// a script still passes a flag the CLI dropped.
//
//   node scripts/verify-script-cub-commands.mjs               # check every script
//   node scripts/verify-script-cub-commands.mjs --self-test   # check the checker
//
// An invocation whose words are not literals (cub(context, args), a computed
// subcommand) is skipped and counted. A line that names a removed command on
// purpose carries a "cub-surface-ignore: <reason>" comment.
import { check } from "./lib/proof-common.mjs";
import { loadSnapshot } from "./lib/cub-command-surface.mjs";
import { scanScriptSource, scanScripts } from "./lib/cub-script-invocations.mjs";

function selfTest() {
  const snapshot = loadSnapshot();
  const scan = (source) => scanScriptSource("self-test.mjs", source, snapshot);
  const detail = (source) => scan(source).violations.map((item) => item.detail);

  // The shapes the lane scripts use for an upload, and the flags they lost.
  check(
    detail(`cub(context, ["variant", "upload", "--component", c, "--granularity", "minimal", dir]);`).join() ===
      "cub variant upload has no flag --granularity",
    "self-test: a dropped upload flag in cub(context, [...]) was not found",
  );
  check(
    detail(`cub("variant", "upload", "--component", c, "--label", "a=b", dir);`).join() ===
      "cub variant upload has no flag --label",
    "self-test: a dropped upload flag in a variadic call was not found",
  );
  check(
    detail(`execFileSync("cub", ["revision", "list", "--space", s, "--by-unit-id", id]);`).join() ===
      "cub revision list has no flag --by-unit-id",
    "self-test: a dropped revision flag in execFileSync was not found",
  );
  check(
    detail(`const args = ["variant", "upload", "--component", c];\nif (x) args.push("--granularity", "per-file");`).join() ===
      "cub variant upload has no flag --granularity",
    "self-test: a flag pushed onto an upload list was not found",
  );
  check(
    detail(`cub(["unit", "approve", "--space", s, slug]);`).join() === 'cub unit has no subcommand "approve"',
    "self-test: a removed subcommand was not found",
  );
  check(
    detail(`cub(["unit", exists ? "update" : "create", "--space", s, "--granularity", "x"]);`).join() ===
      'cub unit update has no flag --granularity,cub unit create has no flag --granularity',
    "self-test: both words of a conditional subcommand were not checked",
  );
  check(
    detail("cub([\n  \"variant\",\n  \"upload\",\n  `--space-label=${x}`,\n  \"--unit-annotation\", \"a=b\",\n  \"--space\", s,\n]);").length === 0,
    "self-test: current upload flags were refused",
  );

  // Current commands pass, and other tools that share a word with cub do not.
  check(detail(`cub(context, ["variant", "upload", "--component", c, "--unit-label", "a=b", "oci://x"]);`).length === 0, "self-test: a current upload was refused");
  check(detail(`run("docker", ["run", "-d", "--rm", "--name", n, "registry:2"]);`).length === 0, "self-test: a docker run was read as cub");
  check(detail(`kube(["config", "view", "--raw"]);`).length === 0, "self-test: a kubectl config view was read as cub");
  check(detail(`const headers = ["space", "kind", "title"];`).length === 0, "self-test: a list of column names was read as cub");

  // A list the gate cannot read is counted, not guessed at.
  const skipped = scan(`cub(context, args);\ncub(context, [...parts]);`);
  check(skipped.violations.length === 0 && skipped.stats.skipped >= 1, "self-test: an unreadable invocation was not counted as skipped");
  const checked = scan(`cub(context, ["unit", "list", "--space", s]);`);
  check(checked.stats.checked === 1 && checked.stats.skipped === 0, "self-test: a readable invocation was not counted as checked");
  console.log("verified the script cub-command gate on 13 self-test cases");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const { snapshot, violations, totals } = scanScripts();
  const lines = violations.map((item) => `${item.file}:${item.line}: ${item.detail}`);
  check(
    violations.length === 0,
    `scripts run cub commands that cub ${snapshot.cub.version} does not have. Fix the call, or, when the script runs only against a CLI that has it, say so with a "cub-surface-ignore: <reason>" comment. The snapshot is tests/cub-help-surface.json; refresh it with node scripts/generate-cub-help-surface.mjs --write only when the CLI has changed:\n${lines.join("\n")}`,
  );
  console.log(
    `verified cub commands in ${totals.files} script file(s) against the help of cub ${snapshot.cub.version}: ` +
      `${totals.argumentLists} argument list(s) checked, ${totals.argumentListsSkipped} skipped (words not literal), ` +
      `${totals.shellLines} shell-string command(s) checked; ${totals.waived} line(s) waived by comment, ${totals.exempt.length} file(s) exempt by listed rule`,
  );
}
