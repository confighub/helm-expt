#!/usr/bin/env node

// Turn the AICR lanes' refusals into evidence rather than errors.
//
// Every AICR checker already self-tests its own refusals. Those tests call the
// checker's internals against fixtures the checker builds, which proves the
// logic and proves nothing about the shipped command. They also live inside
// the thing they test, so a reader who wants to know what the catalog refuses
// has to read six scripts and trust six sets of fixtures.
//
// This lane runs the shipped commands, unmodified, against a throwaway git
// worktree of this repository carrying a change a contributor could plausibly
// propose. It records what every lane said about every candidate, so the
// record shows which rule caught a shape and, just as usefully, which rules
// let it pass. Two candidates must be accepted, because a set of lanes that
// refused everything would produce the same refusals while proving nothing.
//
// The corpus is data. It lives at examples/aicr/refusal-corpus/candidates.yaml
// and is hand-authored. Everything this lane writes lives under
// data/aicr-refusal-corpus, so no generated tree contains a file a person
// maintains.
//
// Nothing here needs a cluster, an organization, or a network. Every candidate
// is a change to committed configuration bytes, and no credential named in the
// corpus is real.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  toYaml,
  write,
} from "./lib/proof-common.mjs";

const corpusPath = join(repoRoot, "examples", "aicr", "refusal-corpus", "candidates.yaml");
const receiptPath = join(repoRoot, "runs", "aicr-refusal-corpus", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-refusal-corpus", "summary.md");

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-refusal-receipts.mjs --run
  node scripts/run-aicr-refusal-receipts.mjs --generate
  node scripts/run-aicr-refusal-receipts.mjs --verify
  node scripts/run-aicr-refusal-receipts.mjs --self-test`);
  process.exit(2);
}

if (mode === "--run") {
  const corpus = loadCorpus();
  const { results, commit } = evaluate(corpus);
  judge(corpus, results);
  writeReceipt(corpus, results, commit);
  write(summaryPath, renderSummary(corpus, results));
  console.log(
    `ran ${results.length} candidate(s) through ${corpus.matrixLanes.length} lanes and wrote ${relativeRepo(receiptPath)}`,
  );
} else if (mode === "--generate") {
  const corpus = loadCorpus();
  const results = readResults();
  judge(corpus, results);
  write(summaryPath, renderSummary(corpus, results));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const corpus = loadCorpus();
  const results = readResults();
  judge(corpus, results);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-refusal-corpus:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(corpus, results),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-refusal-corpus:generate`,
  );
  const refused = results.filter((row) => row.verdict === "refused").length;
  console.log(
    `verified ${results.length} refusal-corpus candidate(s): ${refused} refused as declared, ${results.length - refused} accepted as declared`,
  );
} else {
  selfTest();
  console.log("verified the refusal-corpus evaluator against fake corpora");
}

// loadCorpus reads the hand-authored corpus and refuses a corpus that could
// not mean what it says, before any candidate runs.
function loadCorpus(path = corpusPath) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
  const doc = readYaml(path);
  check(doc.kind === "RefusalCorpus", `${relativeRepo(path)}: expected kind RefusalCorpus`);
  const spec = doc.spec ?? {};
  const matrixLanes = spec.matrixLanes ?? [];
  const extraLanes = spec.extraLanes ?? [];
  const rules = spec.rules ?? [];
  const candidates = spec.candidates ?? [];
  check(matrixLanes.length > 0, `${relativeRepo(path)}: no matrix lanes are declared`);
  check(candidates.length > 0, `${relativeRepo(path)}: no candidates are declared`);
  check(spec.boundary?.configPlaneOnly === true, `${relativeRepo(path)}: the corpus does not declare the config-plane boundary`);
  check(spec.boundary?.gpuWorkloadsProven === false, `${relativeRepo(path)}: the corpus does not disclaim GPU workload proof`);

  const laneById = new Map();
  for (const lane of [...matrixLanes, ...extraLanes]) {
    check(lane.id && Array.isArray(lane.command), `${relativeRepo(path)}: a lane declares no id or command`);
    check(!laneById.has(lane.id), `${relativeRepo(path)}: two lanes share the id ${lane.id}`);
    laneById.set(lane.id, lane);
  }
  const ruleById = new Map();
  for (const rule of rules) {
    check(rule.id && rule.lane && rule.statement, `${relativeRepo(path)}: a rule declares no id, lane, or statement`);
    check(laneById.has(rule.lane), `${relativeRepo(path)}: rule ${rule.id} names the unknown lane ${rule.lane}`);
    check(!ruleById.has(rule.id), `${relativeRepo(path)}: two rules share the id ${rule.id}`);
    ruleById.set(rule.id, rule);
  }

  const seen = new Set();
  for (const candidate of candidates) {
    check(candidate.id, `${relativeRepo(path)}: a candidate declares no id`);
    check(!seen.has(candidate.id), `${relativeRepo(path)}: two candidates share the id ${candidate.id}`);
    seen.add(candidate.id);
    check(
      ["accepted", "refused"].includes(candidate.expect),
      `${relativeRepo(path)}: candidate ${candidate.id} declares no expected verdict`,
    );
    check(candidate.proposal, `${relativeRepo(path)}: candidate ${candidate.id} does not say what a contributor proposed`);
    if (candidate.expect === "refused") {
      check(ruleById.has(candidate.rule), `${relativeRepo(path)}: candidate ${candidate.id} names the unknown rule ${candidate.rule}`);
      check(candidate.messageContains, `${relativeRepo(path)}: candidate ${candidate.id} declares no expected message`);
      const lane = candidate.lane ?? ruleById.get(candidate.rule).lane;
      check(laneById.has(lane), `${relativeRepo(path)}: candidate ${candidate.id} names the unknown lane ${lane}`);
    } else {
      check(!candidate.rule, `${relativeRepo(path)}: candidate ${candidate.id} is expected to be accepted but names a rule`);
    }
    for (const mutation of candidate.mutations ?? []) {
      check(
        ["appendLine", "replaceOnce", "rehashChecksumRow"].includes(mutation.op),
        `${relativeRepo(path)}: candidate ${candidate.id} uses the unknown mutation ${mutation.op}`,
      );
    }
  }

  // A rule nobody exercises is a claim with nothing behind it.
  const exercised = new Set(candidates.filter((row) => row.rule).map((row) => row.rule));
  const unexercised = [...ruleById.keys()].filter((id) => !exercised.has(id));
  check(
    unexercised.length === 0,
    `${relativeRepo(path)}: ${unexercised.join(", ")} declared but no candidate exercises them`,
  );
  check(
    candidates.some((row) => row.expect === "accepted"),
    `${relativeRepo(path)}: every candidate is expected to be refused, so the corpus cannot tell refusal from rejection`,
  );

  return { path, matrixLanes, extraLanes, laneById, rules, ruleById, candidates, boundary: spec.boundary };
}

// applyMutation edits the throwaway worktree. Every op fails loudly when its
// target is missing, so a corpus that has drifted from the tree stops the run
// instead of quietly testing nothing.
function applyMutation(root, candidateId, mutation) {
  const path = join(root, mutation.path ?? "");
  if (mutation.op === "appendLine") {
    check(existsSync(path), `candidate ${candidateId}: ${mutation.path} does not exist`);
    writeFileSync(path, `${readFileSync(path, "utf8")}${mutation.line}\n`);
    return;
  }
  if (mutation.op === "replaceOnce") {
    check(existsSync(path), `candidate ${candidateId}: ${mutation.path} does not exist`);
    const text = readFileSync(path, "utf8");
    check(
      text.includes(mutation.find),
      `candidate ${candidateId}: ${mutation.path} does not contain ${JSON.stringify(mutation.find)}`,
    );
    writeFileSync(path, text.replace(mutation.find, mutation.replace));
    return;
  }
  const checksumsPath = join(root, mutation.checksums);
  check(existsSync(checksumsPath), `candidate ${candidateId}: ${mutation.checksums} does not exist`);
  check(existsSync(path), `candidate ${candidateId}: ${mutation.path} does not exist`);
  const digest = sha256(readFileSync(path));
  const suffix = `  ${mutation.key}`;
  const lines = readFileSync(checksumsPath, "utf8").split("\n");
  const index = lines.findIndex((line) => line.endsWith(suffix));
  check(index !== -1, `candidate ${candidateId}: ${mutation.checksums} has no row for ${mutation.key}`);
  lines[index] = `${digest}${suffix}`;
  writeFileSync(checksumsPath, lines.join("\n"));
}

function runLane(root, lane) {
  const result = spawnSync("node", lane.command, { cwd: root, encoding: "utf8" });
  const lines = `${result.stdout ?? ""}${result.stderr ?? ""}`.split("\n").map((line) => line.trim()).filter(Boolean);
  const error = lines.find((line) => /^[A-Za-z]*Error: /.test(line));
  return {
    lane: lane.id,
    verdict: result.status === 0 ? "accepted" : "refused",
    message: (error ? error.replace(/^[A-Za-z]*Error: /, "") : lines[lines.length - 1] ?? "").slice(0, 400),
  };
}

// evaluate runs every candidate in a detached worktree of the current commit,
// so the repository the author is working in is never mutated. The commit is
// recorded, because a run describes the tree it ran against and an uncommitted
// change is not in it.
function evaluate(corpus) {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-refusal-corpus-"));
  const root = join(scratch, "tree");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  execFileSync("git", ["worktree", "add", "--detach", root, head], { cwd: repoRoot, stdio: "pipe" });
  const reset = () => {
    execFileSync("git", ["checkout", "--", "."], { cwd: root, stdio: "pipe" });
    execFileSync("git", ["clean", "-fdq"], { cwd: root, stdio: "pipe" });
  };
  try {
    const results = [];
    for (const candidate of corpus.candidates) {
      reset();
      for (const mutation of candidate.mutations ?? []) applyMutation(root, candidate.id, mutation);
      const lanes = corpus.matrixLanes.map((lane) => runLane(root, lane));
      const namedLane = candidate.rule ? candidate.lane ?? corpus.ruleById.get(candidate.rule).lane : null;
      if (namedLane && !lanes.some((row) => row.lane === namedLane)) {
        // An extra lane writes, so it runs last and only for the candidate
        // that names it.
        lanes.push(runLane(root, corpus.laneById.get(namedLane)));
      }
      const decisive = namedLane ? lanes.find((row) => row.lane === namedLane) : null;
      results.push({
        candidate: candidate.id,
        verdict: lanes.some((row) => row.verdict === "refused") ? "refused" : "accepted",
        decisiveLane: namedLane,
        decisiveMessage: decisive ? decisive.message : "",
        lanes,
      });
    }
    reset();
    return { results, commit: head };
  } finally {
    execFileSync("git", ["worktree", "remove", "--force", root], { cwd: repoRoot, stdio: "pipe" });
    rmSync(scratch, { recursive: true, force: true });
  }
}

// judge compares what the corpus declared against what the lanes did. It is a
// pure function of two values so the self-test can drive it with fake results.
function judge(corpus, results) {
  check(results.length === corpus.candidates.length, "the receipt records a different number of candidates than the corpus declares");
  for (const candidate of corpus.candidates) {
    const row = results.find((entry) => entry.candidate === candidate.id);
    check(row, `the receipt records no result for candidate ${candidate.id}`);
    check(
      row.verdict === candidate.expect,
      `candidate ${candidate.id} was declared ${candidate.expect} and the lanes returned ${row.verdict}`,
    );
    if (candidate.expect === "accepted") {
      const refusers = row.lanes.filter((lane) => lane.verdict === "refused").map((lane) => lane.lane);
      check(refusers.length === 0, `candidate ${candidate.id} was declared accepted but ${refusers.join(", ")} refused it`);
      continue;
    }
    const expectedLane = candidate.lane ?? corpus.ruleById.get(candidate.rule).lane;
    check(
      row.decisiveLane === expectedLane,
      `candidate ${candidate.id} names lane ${expectedLane} and the receipt records ${row.decisiveLane}`,
    );
    const decisive = row.lanes.find((lane) => lane.lane === expectedLane);
    check(decisive, `candidate ${candidate.id} has no result for lane ${expectedLane}`);
    check(
      decisive.verdict === "refused",
      `candidate ${candidate.id} expects ${expectedLane} to refuse it, and that lane accepted it`,
    );
    check(
      decisive.message.includes(candidate.messageContains),
      `candidate ${candidate.id} expects ${expectedLane} to say ${JSON.stringify(candidate.messageContains)}, and it said ${JSON.stringify(decisive.message)}`,
    );
  }
}

function readResults() {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run npm run aicr-refusal-corpus:run`);
  const receipt = readYaml(receiptPath);
  check(receipt.kind === "RefusalCorpusReceipt", `${relativeRepo(receiptPath)}: expected kind RefusalCorpusReceipt`);
  const corpusDigest = receipt.spec?.corpus?.sha256 ?? "";
  check(
    corpusDigest === sha256(readFileSync(corpusPath)),
    `${relativeRepo(receiptPath)} records a different corpus than ${relativeRepo(corpusPath)}; run npm run aicr-refusal-corpus:run`,
  );
  return receipt.spec?.results ?? [];
}

// The receipt records when the run happened, so its evidence can be aged
// alongside every other receipt rather than sitting outside that count.
function writeReceipt(corpus, results, commit) {
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "RefusalCorpusReceipt",
    metadata: { name: "aicr-refusal-corpus" },
    spec: {
      claim:
        "Every candidate in the AICR refusal corpus was run through the shipped lanes in a throwaway worktree, and each returned the verdict the corpus declared, including two candidates that had to be accepted.",
      boundary: corpus.boundary,
      corpus: { path: relativeRepo(corpusPath), sha256: sha256(readFileSync(corpusPath)) },
      observedAt: new Date().toISOString(),
      tree: {
        commit,
        note: "Each candidate ran in a throwaway worktree of this commit, so the run describes committed bytes rather than an author's working tree.",
      },
      lanes: corpus.matrixLanes.map((lane) => ({ id: lane.id, command: `node ${lane.command.join(" ")}` })),
      results,
    },
  };
  write(receiptPath, toYaml(receipt));
}

function renderSummary(corpus, results) {
  const laneIds = corpus.matrixLanes.map((lane) => lane.id);
  const header = ["| Candidate | Declared | Verdict | Caught by |", "| --- | --- | --- | --- |"];
  const rows = corpus.candidates.map((candidate) => {
    const row = results.find((entry) => entry.candidate === candidate.id);
    const refusers = row.lanes.filter((lane) => lane.verdict === "refused").map((lane) => lane.lane);
    return `| \`${candidate.id}\` | ${candidate.expect} | ${row.verdict} | ${refusers.length ? refusers.map((id) => `\`${id}\``).join(", ") : "nothing, as declared"} |`;
  });

  const matrixHeader = [`| Candidate | ${laneIds.join(" | ")} |`, `| --- | ${laneIds.map(() => "---").join(" | ")} |`];
  const matrixRows = corpus.candidates.map((candidate) => {
    const row = results.find((entry) => entry.candidate === candidate.id);
    const cells = laneIds.map((id) => {
      const lane = row.lanes.find((entry) => entry.lane === id);
      if (!lane) return "not run";
      return lane.verdict === "refused" ? "refused" : "accepted";
    });
    return `| \`${candidate.id}\` | ${cells.join(" | ")} |`;
  });

  const ruleRows = corpus.rules.map((rule) => {
    const candidates = corpus.candidates.filter((row) => row.rule === rule.id).map((row) => `\`${row.id}\``);
    return `| \`${rule.id}\` | \`${rule.lane}\` | ${candidates.join(", ")} |`;
  });

  const messages = corpus.candidates
    .filter((candidate) => candidate.expect === "refused")
    .map((candidate) => {
      const row = results.find((entry) => entry.candidate === candidate.id);
      return `- \`${candidate.id}\`, refused by \`${row.decisiveLane}\`:\n  > ${row.decisiveMessage}`;
    });

  const refusedRows = results.filter((row) => row.verdict === "refused");
  const wideGuard = corpus.matrixLanes[0].id;
  const caughtByWideGuard = refusedRows.filter((row) =>
    row.lanes.some((lane) => lane.lane === wideGuard && lane.verdict === "refused"),
  ).length;
  const missedByWideGuard = refusedRows
    .filter((row) => !row.lanes.some((lane) => lane.lane === wideGuard && lane.verdict === "refused"))
    .map((row) => `\`${row.candidate}\``);

  return `# What the AICR lanes refuse

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-refusal-corpus:generate\` and checked by
\`npm run aicr-refusal-corpus:verify\`. The corpus this reads is hand-authored
at \`${relativeRepo(corpusPath)}\`, and the run that
produced these verdicts is recorded at \`${relativeRepo(receiptPath)}\`.

Each candidate below is a change someone could reasonably propose to an AICR
entry. Every one was applied to a throwaway worktree of the commit under test
and run through the shipped commands, unmodified. Two candidates had to be accepted,
because lanes that refused everything would look identical to lanes that
refused the right things.

${[...header, ...rows].join("\n")}

## Which lane said what

A refusal is more informative when you can also see what stayed quiet. This
matrix is the same run, per lane.

${[...matrixHeader, ...matrixRows].join("\n")}

The pattern in that matrix is worth reading rather than skimming.
\`${wideGuard}\` guards the widest surface, and it caught ${caughtByWideGuard} of the
${refusedRows.length} refused candidates on its own. The ${missedByWideGuard.length} it did not catch are
${missedByWideGuard.join(" and ")}. Both of those
are internally consistent changes rather than drift, which is exactly the case
a checksum cannot see and a rule has to.

## The rules and what exercises them

Every rule declared in the corpus has a candidate behind it. The loader refuses
a corpus where a rule has none, so this table cannot silently go empty.

| Rule | Lane | Exercised by |
| --- | --- | --- |
${ruleRows.join("\n")}

## What each refusal actually said

${messages.join("\n")}

## What this proves and what it does not

It proves the shipped commands refuse these shapes today, and that they accept
changes outside the surfaces they claim to guard. It does not prove the corpus
is complete. A shape nobody thought to propose is not covered, and the honest
reading of a green run here is that the listed rules hold, not that the entries
are unbreakable.

Everything ran offline against committed configuration bytes. No cluster, no
organization, and no network took part, and no credential named in the corpus
is real.
`;
}

// The self-test drives the loader and the judge with fake corpora, so the
// evaluator's own refusals run without a worktree or a lane.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-refusal-corpus-self-test-"));
  try {
    const base = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "RefusalCorpus",
      metadata: { name: "fixture" },
      spec: {
        boundary: { configPlaneOnly: true, gpuWorkloadsProven: false },
        matrixLanes: [{ id: "alpha", command: ["scripts/fixture.mjs", "--verify"], guards: "fixture" }],
        extraLanes: [],
        rules: [{ id: "fixture-rule", lane: "alpha", statement: "fixture" }],
        candidates: [
          { id: "control", expect: "accepted", proposal: "fixture", mutations: [] },
          {
            id: "tripwire",
            expect: "refused",
            rule: "fixture-rule",
            messageContains: "fixture refused",
            proposal: "fixture",
            mutations: [{ op: "appendLine", path: "fixture.yaml", line: "x" }],
          },
        ],
      },
    };
    const writeCorpus = (name, mutate) => {
      const value = JSON.parse(JSON.stringify(base));
      mutate(value);
      const path = join(scratch, `${name}.yaml`);
      writeFileSync(path, `${JSON.stringify(value)}\n`);
      return path;
    };
    const fails = (fn, pattern) => {
      try {
        fn();
        return false;
      } catch (error) {
        return pattern.test(String(error.message));
      }
    };

    const goodPath = writeCorpus("good", () => {});
    const good = loadCorpus(goodPath);
    check(good.candidates.length === 2, "self-test did not load the fixture corpus");

    const goodResults = [
      { candidate: "control", verdict: "accepted", decisiveLane: null, decisiveMessage: "", lanes: [{ lane: "alpha", verdict: "accepted", message: "ok" }] },
      { candidate: "tripwire", verdict: "refused", decisiveLane: "alpha", decisiveMessage: "fixture refused this", lanes: [{ lane: "alpha", verdict: "refused", message: "fixture refused this" }] },
    ];
    judge(good, goodResults);

    check(
      fails(() => loadCorpus(writeCorpus("unexercised", (value) => {
        value.spec.rules.push({ id: "orphan-rule", lane: "alpha", statement: "fixture" });
      })), /orphan-rule declared but no candidate exercises them/),
      "self-test accepted a rule no candidate exercises",
    );
    check(
      fails(() => loadCorpus(writeCorpus("all-refused", (value) => {
        value.spec.candidates = value.spec.candidates.filter((row) => row.expect === "refused");
      })), /cannot tell refusal from rejection/),
      "self-test accepted a corpus with no accepted candidate",
    );
    check(
      fails(() => loadCorpus(writeCorpus("unknown-lane", (value) => {
        value.spec.rules[0].lane = "missing";
      })), /names the unknown lane missing/),
      "self-test accepted a rule naming an unknown lane",
    );
    check(
      fails(() => loadCorpus(writeCorpus("unknown-mutation", (value) => {
        value.spec.candidates[1].mutations = [{ op: "rewriteHistory", path: "x" }];
      })), /uses the unknown mutation rewriteHistory/),
      "self-test accepted an unknown mutation op",
    );
    check(
      fails(() => loadCorpus(writeCorpus("no-boundary", (value) => {
        value.spec.boundary.gpuWorkloadsProven = true;
      })), /does not disclaim GPU workload proof/),
      "self-test accepted a corpus claiming GPU workload proof",
    );

    check(
      fails(() => judge(good, [goodResults[0], { ...goodResults[1], verdict: "accepted", lanes: [{ lane: "alpha", verdict: "accepted", message: "ok" }] }]),
        /was declared refused and the lanes returned accepted/),
      "self-test accepted a candidate the lanes let through",
    );
    check(
      fails(() => judge(good, [{ ...goodResults[0], verdict: "refused", lanes: [{ lane: "alpha", verdict: "refused", message: "no" }] }, goodResults[1]]),
        /was declared accepted and the lanes returned refused/),
      "self-test accepted a control candidate the lanes refused",
    );
    check(
      fails(() => judge(good, [goodResults[0], { ...goodResults[1], decisiveMessage: "something else", lanes: [{ lane: "alpha", verdict: "refused", message: "something else" }] }]),
        /expects alpha to say/),
      "self-test accepted a refusal with the wrong message",
    );
    check(
      fails(() => judge(good, [goodResults[0]]), /records a different number of candidates/),
      "self-test accepted a receipt missing a candidate",
    );

    // A mutation whose target is missing must stop the run rather than
    // silently testing an unchanged tree.
    check(
      fails(() => applyMutation(scratch, "fixture", { op: "replaceOnce", path: "absent.yaml", find: "a", replace: "b" }),
        /absent.yaml does not exist/),
      "self-test accepted a mutation against a missing file",
    );
    writeFileSync(join(scratch, "present.yaml"), "hello\n");
    check(
      fails(() => applyMutation(scratch, "fixture", { op: "replaceOnce", path: "present.yaml", find: "absent-token", replace: "b" }),
        /does not contain "absent-token"/),
      "self-test accepted a mutation whose token is absent",
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
