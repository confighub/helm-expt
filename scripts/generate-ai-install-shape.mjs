#!/usr/bin/env node
// The entry journey, driven by the assistant, with a gate.
//
// A Helm newcomer asks the most common question in the demand sample: "What will
// this install, and what must already exist?" An assistant answers it from a
// render. This proof gates that answer against the render so it cannot invent an
// object or a prerequisite, and cannot omit one either. The answer is the AI-easy
// part; the gate is the same custody discipline that makes the other apps safe. It
// is deterministic and reads a committed render, so it needs no live cluster.

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
  "ai-install-shape.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-install-shape");
const outputs = {
  facts: join(outputRoot, "render-facts.yaml"),
  answer: join(outputRoot, "answer.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-install-shape.mjs --generate
  node scripts/generate-ai-install-shape.mjs --verify
  node scripts/generate-ai-install-shape.mjs --self-test`);
  process.exit(1);
}

function identity(doc) {
  const api = doc.apiVersion ?? "";
  const kind = doc.kind ?? "";
  const ns = doc.metadata?.namespace ?? "";
  const name = doc.metadata?.name ?? "";
  return `${api}|${kind}|${ns}|${name}`;
}

// Read the committed render and derive, mechanically, what it installs and what it
// depends on but does not create. This is the ground truth the answer is gated on.
function deriveFacts(renderPath) {
  check(trackedExists(renderPath), `render is committed: ${relativeRepo(renderPath)}`);
  const docs = parseDocs(readFileSync(renderPath, "utf8")).filter(
    (d) => d && d.kind && d.metadata?.name,
  );
  check(docs.length > 0, "render parsed to at least one object");

  const installs = docs.map(identity).sort();

  const createdNamespaces = new Set(
    docs.filter((d) => d.kind === "Namespace").map((d) => d.metadata?.name),
  );
  const usedNamespaces = new Set(
    docs.map((d) => d.metadata?.namespace).filter((ns) => ns && ns.length > 0),
  );
  const namespacePrereqs = [...usedNamespaces]
    .filter((ns) => !createdNamespaces.has(ns))
    .sort();

  const apiServices = docs
    .filter((d) => d.kind === "APIService")
    .map((d) => d.metadata?.name)
    .sort();

  const clusterRbac = docs.some(
    (d) => d.kind === "ClusterRole" || d.kind === "ClusterRoleBinding",
  );

  const createdRoleKeys = new Set(
    docs
      .filter((d) => d.kind === "Role" || d.kind === "ClusterRole")
      .map((d) => `${d.kind}/${d.metadata?.name}`),
  );
  const danglingRoleRefs = [];
  for (const d of docs) {
    if ((d.kind === "RoleBinding" || d.kind === "ClusterRoleBinding") && d.roleRef) {
      const key = `${d.roleRef.kind}/${d.roleRef.name}`;
      if (!createdRoleKeys.has(key) && !danglingRoleRefs.includes(key)) {
        danglingRoleRefs.push(key);
      }
    }
  }
  danglingRoleRefs.sort();

  const absent = {
    Secret: !docs.some((d) => d.kind === "Secret"),
    CustomResourceDefinition: !docs.some(
      (d) => d.kind === "CustomResourceDefinition",
    ),
    Storage: !docs.some(
      (d) => d.kind === "PersistentVolumeClaim" || d.kind === "StorageClass",
    ),
    "helm-hook": !docs.some((d) =>
      Object.keys(d.metadata?.annotations ?? {}).includes("helm.sh/hook"),
    ),
    "setup-Job": !docs.some((d) => d.kind === "Job"),
  };

  // The prerequisite kinds the render actually supports, each with its evidence.
  const supported = {};
  if (namespacePrereqs.length > 0)
    supported["namespace-exists"] = namespacePrereqs;
  if (apiServices.length > 0) supported["api-extension"] = apiServices;
  if (danglingRoleRefs.length > 0)
    supported["preexisting-role"] = danglingRoleRefs;
  if (clusterRbac) supported["cluster-rbac"] = true;

  return {
    objectCount: docs.length,
    installs,
    namespacePrereqs,
    apiServices,
    clusterRbac,
    danglingRoleRefs,
    absent,
    supported,
  };
}

// The gate. Every claim the assistant makes must be grounded in the render, every
// prerequisite the render implies must be covered, and nothing absent may be
// claimed. Any violation throws.
function gate(answer, facts) {
  // 1. Grounded and complete objects: the answer lists exactly what the render has.
  const claimed = [...(answer.installs ?? [])].sort();
  check(
    JSON.stringify(claimed) === JSON.stringify(facts.installs),
    "answer.installs matches the rendered object set exactly (no invented or missing object)",
  );

  // 2. No hallucinated prerequisite: every kind the answer asserts is supported.
  for (const p of answer.prerequisites ?? []) {
    check(
      Object.prototype.hasOwnProperty.call(facts.supported, p.kind),
      `prerequisite "${p.kind}" is supported by the render`,
    );
    if (p.kind === "namespace-exists") {
      for (const ns of p.namespaces ?? []) {
        check(
          facts.namespacePrereqs.includes(ns),
          `namespace prerequisite "${ns}" is used but not created by the render`,
        );
      }
    }
  }

  // 3. Complete prerequisites: every kind the render supports is covered.
  const answered = new Set((answer.prerequisites ?? []).map((p) => p.kind));
  for (const kind of Object.keys(facts.supported)) {
    check(
      answered.has(kind),
      `the answer covers the "${kind}" prerequisite the render implies`,
    );
  }

  // 4. No hallucinated class: every reassurance is genuinely absent.
  for (const cls of answer.doesNotRequire ?? []) {
    check(
      facts.absent[cls] === true,
      `"does not require ${cls}" is true in the render`,
    );
  }
}

function buildSummary(scenario, facts) {
  const nsList = facts.namespacePrereqs.join(", ");
  const roleList = facts.danglingRoleRefs.join(", ");
  const apiList = facts.apiServices.join(", ");
  return `# What will this install, and what must already exist?

A Helm newcomer asks the most common question in the demand sample. The assistant
answers it from the committed render of ${scenario.spec.render.chart} ${scenario.spec.render.version},
and this proof gates the answer against that render. The assistant does the easy
part, the reading and the plain answer; the gate does the safe part, refusing any
object or prerequisite the render does not support, and refusing to omit one.

## What it installs

${facts.objectCount} objects, taken exactly from the render. The answer may not add
or drop one.

## What must already exist

- The ${nsList} namespace is used by the objects but is not created by the render, so
  it must already exist.
- The render registers an aggregated API (${apiList}), so the API aggregation layer
  must be available.
- The bindings reference roles the render does not create (${roleList}), so those
  must already exist.
- The render installs cluster-scoped RBAC, so the installer needs permission to
  create it.

## What it does not require

Secrets, CustomResourceDefinitions, persistent storage, Helm hooks, and setup Jobs
are all absent from the render, so the answer states plainly that none are needed.
The gate checks each of these is genuinely absent, so the reassurance cannot be a
guess.

## The gate

- The listed objects match the rendered set exactly, with no invented or missing
  object.
- Every prerequisite the answer asserts is supported by the render.
- Every prerequisite the render implies is covered by the answer.
- Every "does not require" line is true in the render.

The self-test mutates the answer three ways, an invented object, an invented Secret
prerequisite, and a dropped namespace prerequisite, and confirms the gate rejects
each. So the answer is the assistant, and the render is the authority.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The render facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-install-shape.yaml)
- [The render](../../${scenario.spec.render.path})

Run:

\`\`\`bash
npm run ai-install-shape:verify
npm run ai-install-shape:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const renderPath = join(repoRoot, s.spec.render.path);
  const facts = deriveFacts(renderPath);
  gate(s.spec.answer, facts);

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiInstallShapeReceipt",
    metadata: { name: s.metadata.name },
    spec: {
      question: s.spec.question,
      persona: s.spec.persona,
      render: {
        chart: s.spec.render.chart,
        version: s.spec.render.version,
        path: s.spec.render.path,
        sha256: sha256File(renderPath),
        objectCount: facts.objectCount,
      },
      gate: {
        objectsMatch: true,
        prerequisitesGrounded: true,
        prerequisitesComplete: true,
        absenceHonest: true,
      },
      prerequisiteKinds: Object.keys(facts.supported).sort(),
      absent: facts.absent,
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiInstallShapeRenderFacts",
      metadata: { name: s.metadata.name },
      spec: facts,
    },
    answer: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiInstallShapeAnswer",
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
  console.log(`wrote AI install-shape example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.answer, `${toYaml(report.answer)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI install-shape example");
} else {
  const scenario = readYaml(scenarioPath);

  const invented = structuredClone(scenario);
  invented.spec.answer.installs = [
    ...invented.spec.answer.installs,
    "v1|Secret|kube-system|invented-secret",
  ];
  expectFailure(
    () => build(invented),
    "invented object fixture unexpectedly passed the gate",
  );

  const hallucinatedPrereq = structuredClone(scenario);
  hallucinatedPrereq.spec.answer.prerequisites = [
    ...hallucinatedPrereq.spec.answer.prerequisites,
    { kind: "secret-required", detail: "a Secret that the render never references" },
  ];
  expectFailure(
    () => build(hallucinatedPrereq),
    "hallucinated prerequisite fixture unexpectedly passed the gate",
  );

  const droppedPrereq = structuredClone(scenario);
  droppedPrereq.spec.answer.prerequisites =
    droppedPrereq.spec.answer.prerequisites.filter(
      (p) => p.kind !== "namespace-exists",
    );
  expectFailure(
    () => build(droppedPrereq),
    "dropped namespace prerequisite fixture unexpectedly passed the gate",
  );

  console.log("ai install-shape self-test passed");
}
