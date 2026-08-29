#!/usr/bin/env node
// The supply-drift journey, driven by the assistant, with a gate.
//
// A reviewer asks "do these version and digest records identify the same bytes?" An
// assistant answers by comparing the digest a recipe locked against the digest the
// publisher later served for the same version string. This proof gates that answer
// against the committed upstream-drift record, so the assistant cannot call two
// digests the same bytes when they differ, or the reverse. The comparison is the easy
// part; the gate is the safe part. Deterministic, no live cluster or registry.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  toYaml,
  trackedExists,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const scenarioPath = join(
  repoRoot,
  "config-catalog",
  "demonstrations",
  "ai-supply-drift.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-supply-drift");
const outputs = {
  facts: join(outputRoot, "drift-facts.yaml"),
  answer: join(outputRoot, "answer.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-supply-drift.mjs --generate
  node scripts/generate-ai-supply-drift.mjs --verify
  node scripts/generate-ai-supply-drift.mjs --self-test`);
  process.exit(1);
}

function parseCsv(text) {
  const parseLine = (line) => {
    const fields = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"') inQuote = !inQuote;
      else if (c === "," && !inQuote) {
        fields.push(cur);
        cur = "";
      } else cur += c;
    }
    fields.push(cur);
    return fields;
  };
  const lines = text.replace(/\r/g, "").trim().split("\n");
  const header = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = fields[i] ?? "";
    });
    return row;
  });
}

// Read the committed drift record and pull out the two digests recorded for one
// chart version. This is the ground truth the answer is gated on.
function deriveDrift(driftPath, chart, version) {
  check(trackedExists(driftPath), `drift record is committed: ${relativeRepo(driftPath)}`);
  const row = parseCsv(readFileSync(driftPath, "utf8")).find(
    (r) => r.chart === chart && r.version === version,
  );
  check(row, `the drift record has a row for ${chart} ${version}`);
  return {
    chart,
    version,
    retainedSha256: row.retained_sha256,
    republishedSha256: row.republished_sha256,
    sameBytes: row.retained_sha256 === row.republished_sha256,
    decision: row.decision,
  };
}

// The gate. The two digests and the same-bytes verdict must match the record, so the
// assistant cannot call a republished artifact the same bytes when its digest differs.
function gate(answer, facts) {
  check(
    answer.retainedSha256 === facts.retainedSha256,
    "answer.retainedSha256 matches the recorded retained digest",
  );
  check(
    answer.republishedSha256 === facts.republishedSha256,
    "answer.republishedSha256 matches the recorded republished digest",
  );
  check(
    answer.sameBytes === facts.sameBytes,
    `answer.sameBytes (${answer.sameBytes}) matches whether the two digests are equal (${facts.sameBytes})`,
  );
  check(
    answer.decision === facts.decision,
    `answer.decision "${answer.decision}" matches the recorded decision "${facts.decision}"`,
  );
}

function buildSummary(scenario, facts) {
  return `# Do these version and digest records identify the same bytes?

A reviewer asks about ${facts.chart} ${facts.version}. The assistant compares the
digest the recipe locked against the digest the publisher later served for the same
version string; the gate checks that against the committed upstream-drift record.

## The answer: ${facts.sameBytes ? "yes, same bytes" : "no, the version string was reused for different bytes"}

- The recipe locks \`${facts.retainedSha256.slice(0, 16)}...\`.
- The publisher later served \`${facts.republishedSha256.slice(0, 16)}...\` for the
  same version.
- The digests ${facts.sameBytes ? "match, so the records identify the same bytes" : "differ, so the same version string now names different bytes"}.

A version string is supposed to name one artifact. Here it does not, so the digest,
not the version, is what identifies the bytes. The recipe's decision is
\`${facts.decision}\`, which keeps the reviewed original bytes by pinning the retained
digest rather than following the republish.

## The gate

- The retained digest matches the record.
- The republished digest matches the record.
- The same-bytes verdict matches whether the two digests are equal.
- The decision matches the record.

The self-test mutates the answer two ways, calling the two digests the same bytes and
changing the retained digest, and confirms the gate rejects each. So the answer is the
assistant, and the drift record is the authority.

## The limit

This reads a committed record of digests already fetched and hashed. It does not fetch
the artifact live; the retained digest and the recorded republish are the evidence.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The drift facts the gate derived](./drift-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-supply-drift.yaml)
- [The upstream-drift record](../upstream-drift/summary.md)

Run:

\`\`\`bash
npm run ai-supply-drift:verify
npm run ai-supply-drift:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const driftPath = join(repoRoot, s.spec.driftRecord);
  const facts = deriveDrift(driftPath, s.spec.chart, s.spec.version);
  gate(s.spec.answer, facts);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiSupplyDriftReceipt",
    metadata: { name: s.metadata.name },
    spec: {
      question: s.spec.question,
      persona: s.spec.persona,
      chart: s.spec.chart,
      version: s.spec.version,
      source: { driftRecord: s.spec.driftRecord, sha256: sha256File(driftPath) },
      sameBytes: facts.sameBytes,
      decision: facts.decision,
      gate: {
        retainedMatch: true,
        republishedMatch: true,
        sameBytesMatch: true,
        decisionMatch: true,
      },
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiSupplyDriftFacts",
      metadata: { name: s.metadata.name },
      spec: facts,
    },
    answer: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiSupplyDriftAnswer",
      metadata: { name: s.metadata.name },
      spec: s.spec.answer,
    },
    receipt,
    summary: buildSummary(s, facts),
  };
}

function expectFailure(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  check(threw, message);
}

const report = build();

if (mode === "--generate") {
  writeYaml(outputs.facts, report.facts);
  writeYaml(outputs.answer, report.answer);
  writeYaml(outputs.receipt, report.receipt);
  write(outputs.summary, report.summary);
  console.log(`wrote AI supply-drift example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.answer, `${toYaml(report.answer)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI supply-drift example");
} else {
  const scenario = readYaml(scenarioPath);

  const claimSame = structuredClone(scenario);
  claimSame.spec.answer.sameBytes = true;
  expectFailure(
    () => build(claimSame),
    "same-bytes-when-different fixture unexpectedly passed the gate",
  );

  const wrongDigest = structuredClone(scenario);
  wrongDigest.spec.answer.retainedSha256 = "0".repeat(64);
  expectFailure(
    () => build(wrongDigest),
    "wrong retained digest fixture unexpectedly passed the gate",
  );

  console.log("ai supply-drift self-test passed");
}
