#!/usr/bin/env node
// The "must I fork it?" journey, driven by the assistant, with a gate.
//
// An application team asks "the chart does not expose the field I need. Must I fork
// it?" An assistant answers no, and proposes the smallest post-render edit instead.
// This proof gates that answer against the committed render, so the edit must target
// a real named container, add a field the container does not already carry, and
// change only that object in an in-memory application. Deterministic, no live cluster.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

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
function objectHash(object) {
  return createHash("sha256").update(JSON.stringify(object)).digest("hex");
}

function atPath(object, location) {
  let current = object;
  for (const part of String(location).split(".")) {
    if (current && typeof current === "object") current = current[part];
    else return undefined;
  }
  return current;
}

function diffPaths(before, after, path = "") {
  if (Object.is(before, after)) return [];
  if (!before || !after || typeof before !== "object" || typeof after !== "object"
    || Array.isArray(before) !== Array.isArray(after)) return [path];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => diffPaths(before[key], after[key], Array.isArray(before)
    ? `${path}[${key}]`
    : path ? `${path}.${key}` : key));
}

function deriveEdit(renderPath, edit) {
  check(trackedExists(renderPath), `render is committed: ${relativeRepo(renderPath)}`);
  const docs = parseDocs(readFileSync(renderPath, "utf8")).filter(
    (d) => d && d.kind && d.metadata?.name,
  );
  const target = docs.find((d) => identity(d) === edit.targetObject) ?? null;

  const location = atPath(target, edit.location);
  const locationExists = Array.isArray(location);
  const containerIndex = locationExists
    ? location.findIndex((candidate) => candidate?.name === edit.containerName)
    : -1;
  const container = containerIndex >= 0 ? location[containerIndex] : null;
  const containerExists = containerIndex >= 0;
  const keyPresent = containerExists && edit.key in container;

  const applied = structuredClone(docs);
  const appliedTarget = applied.find((d) => identity(d) === edit.targetObject) ?? null;
  const appliedLocation = atPath(appliedTarget, edit.location);
  const appliedContainer = Array.isArray(appliedLocation)
    ? appliedLocation.find((candidate) => candidate?.name === edit.containerName) ?? null
    : null;
  if (appliedContainer) appliedContainer[edit.key] = edit.value;
  const changedObjects = docs
    .filter((doc, index) => objectHash(doc) !== objectHash(applied[index]))
    .map(identity);
  const changedPaths = target && appliedTarget ? diffPaths(target, appliedTarget) : [];

  return {
    targetObject: edit.targetObject,
    targetExists: target !== null,
    location: edit.location,
    locationExists,
    containerName: edit.containerName,
    containerIndex,
    containerExists,
    key: edit.key,
    keyPresent,
    existingKeysAtLocation:
      containerExists
        ? Object.keys(container).sort()
        : [],
    applied: {
      changedObjects,
      changedObjectCount: changedObjects.length,
      unchangedObjectCount: docs.length - changedObjects.length,
      changedPaths,
    },
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
    facts.locationExists,
    `the container list ${answer.edit.location} exists on ${answer.edit.targetObject}`,
  );
  check(
    facts.containerExists,
    `the named container ${answer.edit.containerName} exists at ${answer.edit.location}`,
  );
  check(
    !facts.keyPresent,
    `the field "${answer.edit.key}" is not already present on ${answer.edit.containerName}, so the edit adds it`,
  );
  check(
    facts.applied.changedObjects.length === 1
      && facts.applied.changedObjects[0] === answer.edit.targetObject,
    "applying the edit changes exactly its target object",
  );
  check(
    facts.applied.changedPaths.length === 1
      && facts.applied.changedPaths[0] === `${answer.edit.location}[${facts.containerIndex}].${answer.edit.key}`,
    "applying the edit changes exactly the requested container field",
  );
  check(answer.fork === false, "the answer concludes that no fork is needed");
}

function buildSummary(scenario, facts) {
  const e = scenario.spec.answer.edit;
  const inspection = scenario.spec.sourceInspection;
  const supplied = scenario.spec.suppliedValueCheck;
  return `# The values path I tried did not set the container field I need. Must I fork it?

An application team needs a field on ${scenario.spec.render.chart} that the chart
does not provide through the investigated values route. The assistant answers no,
and proposes the smallest post-render edit; the gate checks that the edit is real
and bound to the named Redis container.

## The answer: no fork

- Keep the chart unchanged.
- Add \`${e.key}: ${e.value}\` to the \`${e.containerName}\` container at
  \`${e.location}\` on \`${e.targetObject}\`.
- Applying that edit in memory changes exactly that StatefulSet and exactly one
  container field; the other ${facts.applied.unchangedObjectCount} rendered objects are unchanged.

## The gate

- The target object exists in the render.
- The container list and named \`${e.containerName}\` container exist at the requested
  location.
- The field is not already present on that container, so the edit is a real addition
  rather than a no-op or a collision.
- Applying the edit changes only the requested object and field in the committed render.
- The answer concludes no fork is needed.

The self-test rejects a missing target, an existing container field, a missing
container name, and a missing container-list location. So the answer is the
assistant, and the committed render is the authority for applicability.

## The limit

The source inspection used the archive pinned by
\`recipes/bitnami/redis/25.5.3/source-lock.yaml\` (SHA-256
\`${inspection.archiveSHA256}\`). Its \`${inspection.values.path}\` (SHA-256
\`${inspection.values.sha256}\`) has no \`${inspection.values.missingKey}\` key, and
its \`${inspection.template.path}\` (SHA-256 \`${inspection.template.sha256}\`) has no
\`${inspection.template.missingField}\` field. The template inserts
\`master.extraPodSpec\` at \`${inspection.template.extraPodSpecLocation}\`, before its
static named container, rather than as a container-field extension.

The controlled render with \`${supplied.key}=${supplied.value}\` has the same
\`${supplied.suppliedRenderSHA256}\` object-set SHA-256 and ${supplied.changedObjects.length}
changed objects as its bound baseline. This is a scoped observation about this input,
not proof that no other values route can reach the field. Inspect the chart values and
templates for the field you need; use values when a route exists, and use a post-render
edit when the selected route is not available and the edit is applicable. This static check does not test
cluster admission, deployment, upgrades or rollback.

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
  const sourceLock = readYaml(join(
    repoRoot,
    "recipes",
    "bitnami",
    "redis",
    "25.5.3",
    "source-lock.yaml",
  ));
  check(
    s.spec.sourceInspection.archiveSHA256 === sourceLock.spec.archiveSHA256,
    "the source inspection is bound to the Redis source-lock archive",
  );
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
      sourceInspection: s.spec.sourceInspection,
      suppliedValueCheck: {
        ...s.spec.suppliedValueCheck,
        method: "recorded controlled Helm render of the source archive with bound default values",
        scope: "one supplied-key render comparison; does not establish that no alternative values route exists",
      },
      gate: {
        targetExists: true,
        locationExists: true,
        containerExists: true,
        fieldAdded: true,
        appliedToOneObject: true,
        appliedToOneField: true,
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
  existingField.spec.answer.edit.key = "imagePullPolicy";
  expectFailure(
    () => build(existingField),
    "already-present field fixture unexpectedly passed the gate",
  );

  const missingContainer = structuredClone(scenario);
  missingContainer.spec.answer.edit.containerName = "does-not-exist";
  expectFailure(
    () => build(missingContainer),
    "missing named container fixture unexpectedly passed the gate",
  );

  const missingLocation = structuredClone(scenario);
  missingLocation.spec.answer.edit.location = "spec.template.spec.missingContainers";
  expectFailure(
    () => build(missingLocation),
    "missing container-list fixture unexpectedly passed the gate",
  );

  console.log("ai custom-field self-test passed");
}
