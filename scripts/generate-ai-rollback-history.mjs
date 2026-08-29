#!/usr/bin/env node
// The rollback journey, checked against a real rollback.
//
// An operator asks "can I roll back to exactly what ran before?" An assistant answers
// yes, and points at the retained revisions to restore. This proof gates that answer
// against the committed receipt of the live Upgrade App rollback, so the claim must
// match a real rollback: the exact target version, the exact number of restored
// units, and a completed change set. It reads a real rollback rather than modelling
// one. Deterministic, no live cluster.

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
  "ai-rollback-history.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-rollback-history");
const outputs = {
  facts: join(outputRoot, "rollback-facts.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-rollback-history.mjs --generate
  node scripts/generate-ai-rollback-history.mjs --verify
  node scripts/generate-ai-rollback-history.mjs --self-test`);
  process.exit(1);
}

function deriveRollback(receiptPath) {
  check(
    trackedExists(receiptPath),
    `rollback receipt is committed: ${relativeRepo(receiptPath)}`,
  );
  const receipt = readYaml(receiptPath);
  const rollback = receipt.spec?.configHub?.rollback ?? {};
  const restored = rollback.restoredUnits ?? [];
  return {
    changeSet: rollback.changeSet ?? "",
    changeSetState: rollback.changeSetState ?? "",
    fromVersion: rollback.chartVersionBefore ?? null,
    toVersion: rollback.chartVersionAfter ?? null,
    restoredUnitCount: rollback.restoredUnitCount ?? null,
    unchangedUnitCount: rollback.unchangedUnitCount ?? null,
    restoredRevisions: [
      ...new Set(restored.map((u) => u.rollbackRevision).filter((r) => r != null)),
    ].sort((a, b) => a - b),
  };
}

// The gate. The claimed rollback must match the recorded one: the exact target
// version, the exact number of restored units, and a completed change set.
function gate(scenario, rb) {
  const claim = scenario.spec.rollback;
  check(
    rb.toVersion === claim.toVersion,
    `rollback restores to version ${rb.toVersion}, the claimed target ${claim.toVersion}`,
  );
  check(
    rb.fromVersion === claim.fromVersion,
    `rollback starts from version ${rb.fromVersion}, the claimed ${claim.fromVersion}`,
  );
  check(
    rb.restoredUnitCount === claim.restoredUnitCount,
    `rollback restored ${rb.restoredUnitCount} units, the claimed ${claim.restoredUnitCount}`,
  );
  check(
    rb.changeSetState === "Closed",
    `the rollback change set is complete (state ${rb.changeSetState})`,
  );
  check(
    rb.changeSet === claim.changeSet,
    `the rollback used change set "${rb.changeSet}", the claimed "${claim.changeSet}"`,
  );
}

function buildSummary(scenario, rb) {
  return `# Can I roll back to exactly what ran before?

An operator asks a spine question about ${scenario.spec.chart}. The assistant answers
yes and points at the retained revisions; the gate checks that against the committed
receipt of the live Upgrade App rollback, so the answer rests on a rollback that
actually ran.

## The answer: yes, to exact revisions

- A retained change set, \`${rb.changeSet}\`, restored ${rb.restoredUnitCount} units
  to their exact pre-upgrade revisions (revision ${rb.restoredRevisions.join(", ")}),
  moving the chart from ${rb.fromVersion} back to ${rb.toVersion}.
- The change set is ${rb.changeSetState}, and ${rb.unchangedUnitCount} unit that did
  not change was left alone.
- The restored result was published as its own immutable OCI and reconciled on the
  same two clusters, so the rollback is exact objects, not a fresh re-render.

## The gate

- The rollback restores to the claimed target version.
- It restores the claimed number of units.
- Its change set is complete.
- It is the claimed change set.

The self-test mutates the claim three ways, a wrong target version, a wrong restored
count, and a wrong change set, and confirms the gate rejects each. So the claim is the
answer, and the rollback receipt is the authority.

## The limit

This restores the desired Kubernetes objects to exact prior revisions. It does not
reverse database data or an irreversible migration, which object rollback cannot see.
The live run and its two-cluster evidence are the Upgrade App proof this points to.

## Open the evidence

- [The rollback facts the gate derived](./rollback-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-rollback-history.yaml)
- [The live Upgrade App rollback](../redis-upgrade-app-proof/summary.md)

Run:

\`\`\`bash
npm run ai-rollback-history:verify
npm run ai-rollback-history:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const receiptPath = join(repoRoot, s.spec.receipt);
  const rb = deriveRollback(receiptPath);
  gate(s, rb);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiRollbackHistoryReceipt",
    metadata: { name: s.metadata.name },
    spec: {
      question: s.spec.question,
      persona: s.spec.persona,
      chart: s.spec.chart,
      source: { receipt: s.spec.receipt, receiptSha256: sha256File(receiptPath) },
      rollback: {
        changeSet: rb.changeSet,
        changeSetState: rb.changeSetState,
        fromVersion: rb.fromVersion,
        toVersion: rb.toVersion,
        restoredUnitCount: rb.restoredUnitCount,
        restoredRevisions: rb.restoredRevisions,
      },
      gate: {
        targetVersionMatch: true,
        restoredCountMatch: true,
        changeSetComplete: true,
      },
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiRollbackHistoryFacts",
      metadata: { name: s.metadata.name },
      spec: rb,
    },
    receipt,
    summary: buildSummary(s, rb),
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
  writeYaml(outputs.receipt, report.receipt);
  write(outputs.summary, report.summary);
  console.log(`wrote AI rollback-history example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI rollback-history example");
} else {
  const scenario = readYaml(scenarioPath);

  const wrongVersion = structuredClone(scenario);
  wrongVersion.spec.rollback.toVersion = "26.0.0";
  expectFailure(
    () => build(wrongVersion),
    "wrong target version fixture unexpectedly passed the gate",
  );

  const wrongCount = structuredClone(scenario);
  wrongCount.spec.rollback.restoredUnitCount = 99;
  expectFailure(
    () => build(wrongCount),
    "wrong restored count fixture unexpectedly passed the gate",
  );

  const wrongChangeSet = structuredClone(scenario);
  wrongChangeSet.spec.rollback.changeSet = "not-the-real-changeset";
  expectFailure(
    () => build(wrongChangeSet),
    "wrong change set fixture unexpectedly passed the gate",
  );

  console.log("ai rollback-history self-test passed");
}
