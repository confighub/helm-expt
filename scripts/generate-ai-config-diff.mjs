#!/usr/bin/env node
// The compare journey, driven by the assistant, with a gate.
//
// The second most common question in the demand sample is "how is this candidate
// different from production?" An assistant answers it by comparing two renders. This
// proof gates that answer against the two committed renders, so the claimed diff
// cannot invent a change, miss one, or misclassify an add, a remove, and a change.
// The compare is the easy part; the gate is the safe part. Deterministic, no live
// cluster.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  parseDocs,
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
  "ai-config-diff.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-config-diff");
const outputs = {
  facts: join(outputRoot, "render-facts.yaml"),
  answer: join(outputRoot, "answer.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-config-diff.mjs --generate
  node scripts/generate-ai-config-diff.mjs --verify
  node scripts/generate-ai-config-diff.mjs --self-test`);
  process.exit(1);
}

function identity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function loadObjects(renderPath) {
  check(trackedExists(renderPath), `render is committed: ${relativeRepo(renderPath)}`);
  const docs = parseDocs(readFileSync(renderPath, "utf8")).filter(
    (d) => d && d.kind && d.metadata?.name,
  );
  check(docs.length > 0, `render parsed to at least one object: ${relativeRepo(renderPath)}`);
  return new Map(docs.map((d) => [identity(d), d]));
}

// Diff two renders by object identity and content. Added, removed, and changed are
// the ground truth the answer is gated on.
function deriveDiff(prodPath, candPath) {
  const prod = loadObjects(prodPath);
  const cand = loadObjects(candPath);
  const added = [...cand.keys()].filter((k) => !prod.has(k)).sort();
  const removed = [...prod.keys()].filter((k) => !cand.has(k)).sort();
  const changed = [...prod.keys()]
    .filter(
      (k) =>
        cand.has(k) &&
        JSON.stringify(prod.get(k)) !== JSON.stringify(cand.get(k)),
    )
    .sort();
  const unchangedCount = [...prod.keys()].filter(
    (k) => cand.has(k) && JSON.stringify(prod.get(k)) === JSON.stringify(cand.get(k)),
  ).length;
  return {
    productionCount: prod.size,
    candidateCount: cand.size,
    added,
    removed,
    changed,
    unchangedCount,
  };
}

// The gate. The claimed diff must match the derived diff exactly, so the assistant
// cannot invent, miss, or misclassify a change.
function gate(answer, facts) {
  for (const key of ["added", "removed", "changed"]) {
    const claimed = [...(answer[key] ?? [])].sort();
    check(
      JSON.stringify(claimed) === JSON.stringify(facts[key]),
      `answer.${key} matches the derived diff exactly (no invented, missed, or misclassified change)`,
    );
  }
}

function buildSummary(scenario, facts) {
  const r = scenario.spec.render;
  const removedList = facts.removed.length ? facts.removed.join(", ") : "none";
  const changedList = facts.changed.length ? facts.changed.join(", ") : "none";
  const addedList = facts.added.length ? facts.added.join(", ") : "none";
  return `# How is this candidate different from production?

An application team asks the second most common question in the demand sample. The
candidate is ${r.candidate.label}, and production is ${r.production.label}, both
committed renders of ${r.chart}. The assistant does the easy part, the compare and
the plain summary; the gate does the safe part, refusing any change the two renders
do not support and refusing to miss one.

## The difference

- Production renders ${facts.productionCount} objects, the candidate renders ${facts.candidateCount}.
- Added: ${addedList}.
- Removed: ${removedList}.
- Changed: ${changedList}.
- Unchanged: ${facts.unchangedCount}.

The candidate stops generating the in-cluster Secret and reads an existing one
instead, so the generated Secret is removed and the two StatefulSets change to
reference it. Everything else is identical. This is a desired-configuration diff of
two exact object sets, kept separate from any live-cluster drift.

## The gate

- Every added, removed, and changed object the answer lists is present in the diff
  of the two renders.
- Every added, removed, and changed object the diff produces is present in the
  answer.
- Nothing is misclassified, so a changed object cannot be reported as added, and an
  unchanged object cannot be reported as changed.

The self-test mutates the answer three ways, an invented added object, a dropped
removed object, and an unchanged object relabelled as changed, and confirms the gate
rejects each. So the answer is the assistant, and the two renders are the authority.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The diff facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-config-diff.yaml)
- [Production render](../../${r.production.path})
- [Candidate render](../../${r.candidate.path})

Run:

\`\`\`bash
npm run ai-config-diff:verify
npm run ai-config-diff:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const prodPath = join(repoRoot, s.spec.render.production.path);
  const candPath = join(repoRoot, s.spec.render.candidate.path);
  const facts = deriveDiff(prodPath, candPath);
  gate(s.spec.answer, facts);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiConfigDiffReceipt",
    metadata: { name: s.metadata.name },
    spec: {
      question: s.spec.question,
      persona: s.spec.persona,
      chart: s.spec.render.chart,
      production: {
        label: s.spec.render.production.label,
        path: s.spec.render.production.path,
        sha256: sha256File(prodPath),
        objectCount: facts.productionCount,
      },
      candidate: {
        label: s.spec.render.candidate.label,
        path: s.spec.render.candidate.path,
        sha256: sha256File(candPath),
        objectCount: facts.candidateCount,
      },
      diff: {
        added: facts.added.length,
        removed: facts.removed.length,
        changed: facts.changed.length,
        unchanged: facts.unchangedCount,
      },
      gate: {
        addedMatch: true,
        removedMatch: true,
        changedMatch: true,
      },
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiConfigDiffRenderFacts",
      metadata: { name: s.metadata.name },
      spec: facts,
    },
    answer: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiConfigDiffAnswer",
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
  console.log(`wrote AI config-diff example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.answer, `${toYaml(report.answer)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI config-diff example");
} else {
  const scenario = readYaml(scenarioPath);

  const invented = structuredClone(scenario);
  invented.spec.answer.added = [
    ...invented.spec.answer.added,
    "v1|ConfigMap|redis|invented-configmap",
  ];
  expectFailure(
    () => build(invented),
    "invented added object fixture unexpectedly passed the gate",
  );

  const dropped = structuredClone(scenario);
  dropped.spec.answer.removed = [];
  expectFailure(
    () => build(dropped),
    "dropped removed object fixture unexpectedly passed the gate",
  );

  const misclassified = structuredClone(scenario);
  misclassified.spec.answer.changed = [
    ...misclassified.spec.answer.changed,
    "v1|Service|redis|redis-headless",
  ];
  expectFailure(
    () => build(misclassified),
    "unchanged-as-changed fixture unexpectedly passed the gate",
  );

  console.log("ai config-diff self-test passed");
}
