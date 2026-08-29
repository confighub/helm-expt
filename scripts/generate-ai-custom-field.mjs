#!/usr/bin/env node
// The "must I fork it?" journey, driven by the assistant, with a gate.
//
// An application team asks "the chart does not expose the field I need. Must I fork
// it?" An assistant answers no, and proposes the smallest post-render edit instead.
// This proof gates that answer against the committed render, so the edit must target
// a real object and must add a field the render does not already carry. The proposal
// is the easy part; the gate is the safe part. Deterministic, no live cluster.
//
// The premise, that the chart exposes no value for this field, is stated, not gated,
// because a values schema is out of scope here. What the gate proves is that the
// workaround is real, so the answer to "must I fork it?" is grounded.

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
  "ai-custom-field.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-custom-field");
const outputs = {
  facts: join(outputRoot, "render-facts.yaml"),
  answer: join(outputRoot, "answer.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-custom-field.mjs --generate
  node scripts/generate-ai-custom-field.mjs --verify
  node scripts/generate-ai-custom-field.mjs --self-test`);
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

// Read the render and derive whether the proposed post-render edit is applicable:
// does the target object exist, and is the field already present where the edit
// would add it? This is the ground truth the answer is gated on.
function deriveEdit(renderPath, edit) {
  check(trackedExists(renderPath), `render is committed: ${relativeRepo(renderPath)}`);
  const docs = parseDocs(readFileSync(renderPath, "utf8")).filter(
    (d) => d && d.kind && d.metadata?.name,
  );
  const target = docs.find((d) => identity(d) === edit.targetObject) ?? null;

  let container = target;
  for (const part of String(edit.location).split(".")) {
    if (container && typeof container === "object") container = container[part];
    else {
      container = undefined;
      break;
    }
  }
  const locationExists = container !== undefined && container !== null;
  const keyPresent =
    locationExists && typeof container === "object" && edit.key in container;

  return {
    targetObject: edit.targetObject,
    targetExists: target !== null,
    location: edit.location,
    locationExists,
    key: edit.key,
    keyPresent,
    existingKeysAtLocation:
      locationExists && typeof container === "object"
        ? Object.keys(container).sort()
        : [],
  };
}

// The gate. The edit must target a real object and add a field the render does not
// already carry, so the "no fork" answer rests on a real workaround.
function gate(answer, facts) {
  check(
    facts.targetExists,
    `the target object ${answer.edit.targetObject} exists in the render`,
  );
  check(
    !facts.keyPresent,
    `the field "${answer.edit.key}" is not already present at ${answer.edit.location}, so the edit adds it`,
  );
  check(answer.fork === false, "the answer concludes that no fork is needed");
}

function buildSummary(scenario, facts) {
  const e = scenario.spec.answer.edit;
  return `# The chart does not expose the field I need. Must I fork it?

An application team needs a field on ${scenario.spec.render.chart} that the chart
exposes no value for. The assistant answers no, and proposes the smallest post-render
edit; the gate checks that the edit is real, so the answer rests on something the
render supports.

## The answer: no fork

- Keep the chart unchanged.
- Add \`${e.key}: ${e.value}\` at \`${e.location}\` on the object
  \`${e.targetObject}\`.
- That object exists in the render, and the field is not already there, so the edit
  adds exactly one field to one object and nothing else.

On an upgrade, this one-field edit is checked for overlap against the new render, so
a later chart change to the same object is not lost silently.

## The gate

- The target object exists in the render.
- The field is not already present where the edit would add it, so the edit is a real
  addition rather than a no-op or a collision.
- The answer concludes no fork is needed.

The self-test mutates the answer two ways, an edit that targets a missing object and
an edit that adds a field the render already carries, and confirms the gate rejects
each. So the answer is the assistant, and the render is the authority.

## The limit

Whether the chart exposes a value for this field is the premise, not something this
proof checks, because that needs the chart's values schema. What the gate proves is
that the post-render workaround is real, which is what "must I fork it?" turns on.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The edit facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-custom-field.yaml)
- [The render](../../${scenario.spec.render.path})

Run:

\`\`\`bash
npm run ai-custom-field:verify
npm run ai-custom-field:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const renderPath = join(repoRoot, s.spec.render.path);
  const facts = deriveEdit(renderPath, s.spec.answer.edit);
  gate(s.spec.answer, facts);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiCustomFieldReceipt",
    metadata: { name: s.metadata.name },
    spec: {
      question: s.spec.question,
      persona: s.spec.persona,
      render: {
        chart: s.spec.render.chart,
        path: s.spec.render.path,
        sha256: sha256File(renderPath),
      },
      edit: s.spec.answer.edit,
      gate: {
        targetExists: true,
        fieldAdded: true,
        noFork: true,
      },
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiCustomFieldRenderFacts",
      metadata: { name: s.metadata.name },
      spec: facts,
    },
    answer: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiCustomFieldAnswer",
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
  console.log(`wrote AI custom-field example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.answer, `${toYaml(report.answer)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI custom-field example");
} else {
  const scenario = readYaml(scenarioPath);

  const missingTarget = structuredClone(scenario);
  missingTarget.spec.answer.edit.targetObject =
    "apps/v1|StatefulSet|redis|does-not-exist";
  expectFailure(
    () => build(missingTarget),
    "missing target object fixture unexpectedly passed the gate",
  );

  const existingField = structuredClone(scenario);
  existingField.spec.answer.edit.key = "checksum/secret";
  expectFailure(
    () => build(existingField),
    "already-present field fixture unexpectedly passed the gate",
  );

  console.log("ai custom-field self-test passed");
}
