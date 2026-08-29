#!/usr/bin/env node
// The "why did nothing change" journey, driven by the assistant, with a gate.
//
// A Helm user asks "I set a value. Why did the rendered object not change?" An
// assistant answers by saying which supplied values reached the render and which
// did not. This proof gates that answer against the committed render: a value
// called effective must appear in the render, and a value called ignored must not.
// The full method removes each key and re-renders; this is its deterministic slice,
// value reachability against one committed render. A supplied value whose literal
// never reaches the render was not used, which is the wrong-path or unexposed-field
// case the question is about. Deterministic, no live cluster.

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
  "ai-ignored-values.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-ignored-values");
const outputs = {
  facts: join(outputRoot, "render-facts.yaml"),
  answer: join(outputRoot, "answer.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-ignored-values.mjs --generate
  node scripts/generate-ai-ignored-values.mjs --verify
  node scripts/generate-ai-ignored-values.mjs --self-test`);
  process.exit(1);
}

function readRender(renderPath) {
  check(trackedExists(renderPath), `render is committed: ${relativeRepo(renderPath)}`);
  const text = readFileSync(renderPath, "utf8");
  check(text.length > 0, `render is non-empty: ${relativeRepo(renderPath)}`);
  return text;
}

// For each supplied value, does its literal reach the render? That is the ground
// truth the answer is gated on.
function deriveReach(supplied, renderText) {
  return supplied.map((v) => ({
    key: v.key,
    value: v.value,
    effect: v.effect,
    present: renderText.includes(v.value),
  }));
}

// The gate. An effective value must reach the render; an ignored value must not.
function gate(reach) {
  for (const r of reach) {
    if (r.effect === "effective") {
      check(
        r.present,
        `effective value "${r.value}" (${r.key}) appears in the render`,
      );
    } else if (r.effect === "ignored") {
      check(
        !r.present,
        `ignored value "${r.value}" (${r.key}) does not appear in the render`,
      );
    } else {
      check(false, `supplied value "${r.key}" has an unknown effect "${r.effect}"`);
    }
  }
}

function buildSummary(scenario, reach) {
  const effective = reach.filter((r) => r.effect === "effective");
  const ignored = reach.filter((r) => r.effect === "ignored");
  const line = (r) => {
    const hint = scenario.spec.answer.supplied.find((s) => s.key === r.key)?.correctPath;
    const tail = hint ? ` The correct path is \`${hint}\`.` : "";
    return `- \`${r.key}=${r.value}\`${tail}`;
  };
  return `# I set a value. Why did the rendered object not change?

A Helm user supplies values to ${scenario.spec.render.chart} and some do not take
effect. The assistant does the easy part, saying which values reached the render and
which did not; the gate does the safe part, refusing to call a value effective when
its literal is absent, or ignored when it is present.

## Reached the render

${effective.map(line).join("\n")}

## Did not reach the render, so they were ignored

${ignored.map(line).join("\n")}

Each ignored value was accepted by Helm but never used by the chart, because the key
is misspelled, on the wrong path, or a field the chart does not expose. Helm does not
warn, so the render simply does not change.

## The gate

- Every value the answer calls effective appears in the committed render.
- Every value the answer calls ignored is absent from the committed render.

The self-test flips one label each way, an effective value relabelled ignored and an
ignored value relabelled effective, and confirms the gate rejects both. So the answer
is the assistant, and the render is the authority.

## The limit

This proves reachability against one committed render. The full method removes each
key and re-renders to confirm the object set is unchanged. A value whose literal
never reaches the render was certainly not used; this slice is the deterministic part
of that method, with no live render.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The reachability facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-ignored-values.yaml)
- [The render](../../${scenario.spec.render.path})

Run:

\`\`\`bash
npm run ai-ignored-values:verify
npm run ai-ignored-values:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const renderPath = join(repoRoot, s.spec.render.path);
  const renderText = readRender(renderPath);
  const reach = deriveReach(s.spec.answer.supplied, renderText);
  gate(reach);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiIgnoredValuesReceipt",
    metadata: { name: s.metadata.name },
    spec: {
      question: s.spec.question,
      persona: s.spec.persona,
      render: {
        chart: s.spec.render.chart,
        path: s.spec.render.path,
        sha256: sha256File(renderPath),
      },
      counts: {
        effective: reach.filter((r) => r.effect === "effective").length,
        ignored: reach.filter((r) => r.effect === "ignored").length,
      },
      gate: {
        effectivePresent: true,
        ignoredAbsent: true,
      },
      method: "reachability-against-committed-render",
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiIgnoredValuesRenderFacts",
      metadata: { name: s.metadata.name },
      spec: { reach },
    },
    answer: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiIgnoredValuesAnswer",
      metadata: { name: s.metadata.name },
      spec: s.spec.answer,
    },
    receipt,
    summary: buildSummary(s, reach),
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
  console.log(`wrote AI ignored-values example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.answer, `${toYaml(report.answer)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI ignored-values example");
} else {
  const scenario = readYaml(scenarioPath);

  const flipEffective = structuredClone(scenario);
  const firstEffective = flipEffective.spec.answer.supplied.find(
    (v) => v.effect === "effective",
  );
  firstEffective.effect = "ignored";
  expectFailure(
    () => build(flipEffective),
    "effective-relabelled-ignored fixture unexpectedly passed the gate",
  );

  const flipIgnored = structuredClone(scenario);
  const firstIgnored = flipIgnored.spec.answer.supplied.find(
    (v) => v.effect === "ignored",
  );
  firstIgnored.effect = "effective";
  expectFailure(
    () => build(flipIgnored),
    "ignored-relabelled-effective fixture unexpectedly passed the gate",
  );

  console.log("ai ignored-values self-test passed");
}
