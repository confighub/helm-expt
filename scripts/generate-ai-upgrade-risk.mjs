#!/usr/bin/env node
// The upgrade journey, driven by the assistant, with a gate.
//
// An application team asks "can I upgrade this chart without breaking production?"
// An assistant answers by naming the breaking signals between two version renders:
// removed objects, immutable-field changes, and image changes. This proof gates that
// answer against the two committed renders, so the risk verdict cannot invent a
// hazard or miss one. The reading is the easy part; the gate is the safe part.
// Deterministic, no live cluster.

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
  "ai-upgrade-risk.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-upgrade-risk");
const outputs = {
  facts: join(outputRoot, "render-facts.yaml"),
  answer: join(outputRoot, "answer.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-upgrade-risk.mjs --generate
  node scripts/generate-ai-upgrade-risk.mjs --verify
  node scripts/generate-ai-upgrade-risk.mjs --self-test`);
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

// The fields Kubernetes will not let an upgrade change in place.
function immutableFields(doc) {
  if (doc.kind === "StatefulSet") {
    return {
      selector: doc.spec?.selector ?? null,
      serviceName: doc.spec?.serviceName ?? null,
      volumeClaimTemplates: (doc.spec?.volumeClaimTemplates ?? []).map((v) => ({
        name: v.metadata?.name ?? null,
        resources: v.spec?.resources ?? null,
      })),
    };
  }
  if (doc.kind === "Deployment" || doc.kind === "DaemonSet") {
    return { selector: doc.spec?.selector ?? null };
  }
  return null;
}

function images(doc) {
  const podSpec = doc.spec?.template?.spec;
  if (!podSpec) return null;
  return [...(podSpec.initContainers ?? []), ...(podSpec.containers ?? [])]
    .map((c) => c.image)
    .sort();
}

// Derive the breaking signals between the current and candidate renders. These are
// the ground truth the risk verdict is gated on.
function deriveRisk(currentPath, candidatePath) {
  const current = loadObjects(currentPath);
  const candidate = loadObjects(candidatePath);
  const J = (x) => JSON.stringify(x);

  const removed = [...current.keys()].filter((k) => !candidate.has(k)).sort();
  const immutableChanges = [];
  const imageChanges = [];
  for (const [k, a] of current) {
    const b = candidate.get(k);
    if (!b) continue;
    const ia = immutableFields(a);
    if (ia && J(ia) !== J(immutableFields(b))) immutableChanges.push(k);
    const imgA = images(a);
    if (imgA && J(imgA) !== J(images(b))) imageChanges.push(k);
  }
  immutableChanges.sort();
  imageChanges.sort();
  const verdict =
    removed.length || immutableChanges.length || imageChanges.length
      ? "elevated"
      : "low";
  return {
    currentCount: current.size,
    candidateCount: candidate.size,
    removed,
    immutableChanges,
    imageChanges,
    verdict,
  };
}

// The gate. Each breaking-signal list and the verdict must match the derived risk
// exactly, so the assistant cannot invent a hazard or miss one.
function gate(answer, facts) {
  for (const key of ["removed", "immutableChanges", "imageChanges"]) {
    const claimed = [...(answer[key] ?? [])].sort();
    check(
      JSON.stringify(claimed) === JSON.stringify(facts[key]),
      `answer.${key} matches the derived risk exactly (no invented or missed hazard)`,
    );
  }
  check(
    answer.verdict === facts.verdict,
    `answer.verdict "${answer.verdict}" matches the derived verdict "${facts.verdict}"`,
  );
}

function buildSummary(scenario, facts) {
  const r = scenario.spec.render;
  const none = (list) => (list.length ? list.join(", ") : "none");
  return `# Can I upgrade this chart without breaking production?

An application team asks a spine question in the demand sample. Production runs
${r.current.label} and the candidate is ${r.candidate.label}, both committed renders
of ${r.chart}. The assistant does the easy part, naming the breaking signals; the
gate does the safe part, refusing to invent a hazard or miss one.

## The verdict: ${facts.verdict}

- Objects removed by the upgrade: ${none(facts.removed)}.
- Objects whose immutable fields change (selector, service name, volume claim
  templates): ${none(facts.immutableChanges)}.
- Objects whose container image changes: ${none(facts.imageChanges)}.

None of the breaking signals fire, so the upgrade applies in place. The candidate
still changes objects, but only in ways Kubernetes accepts on a running workload,
which is why the live Upgrade App proof reconciled the same upgrade on two clusters
without recreation.

## The gate

- Every removed, immutable-changed, and image-changed object the answer lists is
  present in the derived risk.
- Every such object the derivation finds is present in the answer.
- The verdict matches the derived verdict, so a low-risk upgrade cannot be reported
  as elevated, or the reverse.

The self-test mutates the answer three ways, an invented immutable change, an
invented removed object, and a flipped verdict, and confirms the gate rejects each.
So the answer is the assistant, and the two renders are the authority.

## The limit

This reads two committed desired-configuration renders. It does not run the upgrade
or inspect a live cluster, and it does not judge in-application data migrations,
which object comparison cannot see.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The risk facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-upgrade-risk.yaml)
- [Current render](../../${r.current.path})
- [Candidate render](../../${r.candidate.path})
- [The live Upgrade App proof](../redis-upgrade-app-proof/summary.md)

Run:

\`\`\`bash
npm run ai-upgrade-risk:verify
npm run ai-upgrade-risk:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const currentPath = join(repoRoot, s.spec.render.current.path);
  const candidatePath = join(repoRoot, s.spec.render.candidate.path);
  const facts = deriveRisk(currentPath, candidatePath);
  gate(s.spec.answer, facts);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiUpgradeRiskReceipt",
    metadata: { name: s.metadata.name },
    spec: {
      question: s.spec.question,
      persona: s.spec.persona,
      chart: s.spec.render.chart,
      current: {
        label: s.spec.render.current.label,
        path: s.spec.render.current.path,
        sha256: sha256File(currentPath),
        objectCount: facts.currentCount,
      },
      candidate: {
        label: s.spec.render.candidate.label,
        path: s.spec.render.candidate.path,
        sha256: sha256File(candidatePath),
        objectCount: facts.candidateCount,
      },
      risk: {
        removed: facts.removed.length,
        immutableChanges: facts.immutableChanges.length,
        imageChanges: facts.imageChanges.length,
        verdict: facts.verdict,
      },
      gate: {
        removedMatch: true,
        immutableMatch: true,
        imageMatch: true,
        verdictMatch: true,
      },
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiUpgradeRiskRenderFacts",
      metadata: { name: s.metadata.name },
      spec: facts,
    },
    answer: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiUpgradeRiskAnswer",
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
  console.log(`wrote AI upgrade-risk example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.answer, `${toYaml(report.answer)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI upgrade-risk example");
} else {
  const scenario = readYaml(scenarioPath);

  const inventedImmutable = structuredClone(scenario);
  inventedImmutable.spec.answer.immutableChanges = [
    "apps/v1|StatefulSet|redis|redis-master",
  ];
  expectFailure(
    () => build(inventedImmutable),
    "invented immutable-change fixture unexpectedly passed the gate",
  );

  const inventedRemoved = structuredClone(scenario);
  inventedRemoved.spec.answer.removed = ["v1|Secret|redis|redis"];
  expectFailure(
    () => build(inventedRemoved),
    "invented removed-object fixture unexpectedly passed the gate",
  );

  const flippedVerdict = structuredClone(scenario);
  flippedVerdict.spec.answer.verdict = "elevated";
  expectFailure(
    () => build(flippedVerdict),
    "flipped-verdict fixture unexpectedly passed the gate",
  );

  console.log("ai upgrade-risk self-test passed");
}
