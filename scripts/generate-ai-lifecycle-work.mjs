#!/usr/bin/env node
// The lifecycle journey, driven by the assistant, with a gate.
//
// A GitOps operator asks "how should Argo CD or Flux handle this chart's hooks and
// CRDs?" An assistant answers by naming the CRDs, the custom resources that need
// them first, the admission webhooks that need a caBundle, and any Helm hooks. This
// proof gates that answer against the committed render, so it cannot invent lifecycle
// work or miss it. The reading is the easy part; the gate is the safe part.
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
  "ai-lifecycle-work.yaml",
);
const outputRoot = join(repoRoot, "data", "ai-lifecycle-work");
const outputs = {
  facts: join(outputRoot, "render-facts.yaml"),
  answer: join(outputRoot, "answer.yaml"),
  receipt: join(outputRoot, "receipt.yaml"),
  summary: join(outputRoot, "summary.md"),
};

if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-ai-lifecycle-work.mjs --generate
  node scripts/generate-ai-lifecycle-work.mjs --verify
  node scripts/generate-ai-lifecycle-work.mjs --self-test`);
  process.exit(1);
}

const sortedMap = (obj) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))),
  );

// Read the render and derive the lifecycle work it carries: the CRDs, the custom
// resources that depend on them, the admission webhooks that need a caBundle, and
// any Helm hooks. This is the ground truth the answer is gated on.
function deriveLifecycle(renderPath) {
  check(trackedExists(renderPath), `render is committed: ${relativeRepo(renderPath)}`);
  const docs = parseDocs(readFileSync(renderPath, "utf8")).filter(
    (d) => d && d.kind && d.metadata?.name,
  );
  check(docs.length > 0, "render parsed to at least one object");

  const crdDocs = docs.filter((d) => d.kind === "CustomResourceDefinition");
  const crds = crdDocs.map((d) => d.metadata.name).sort();
  const crdGroups = new Set(crdDocs.map((d) => d.spec?.group).filter(Boolean));

  const customResources = {};
  for (const d of docs) {
    const group = String(d.apiVersion ?? "").split("/")[0];
    if (crdGroups.has(group)) {
      customResources[d.kind] = (customResources[d.kind] ?? 0) + 1;
    }
  }

  const webhooksNeedingCaBundle = docs
    .filter((d) => String(d.kind).endsWith("WebhookConfiguration"))
    .filter((d) => (d.webhooks ?? []).some((w) => !w.clientConfig?.caBundle))
    .map((d) => `${d.kind}/${d.metadata.name}`)
    .sort();

  const hooks = docs
    .filter((d) => d.metadata?.annotations?.["helm.sh/hook"])
    .map((d) => `${d.kind}/${d.metadata.name}`)
    .sort();

  return {
    crds,
    customResources,
    crdBeforeCr: Object.keys(customResources).length > 0,
    webhooksNeedingCaBundle,
    hooks,
  };
}

// The gate. Every piece of lifecycle work the answer names must be present in the
// render, and every piece the render carries must be in the answer.
function gate(answer, facts) {
  check(
    JSON.stringify([...(answer.crds ?? [])].sort()) === JSON.stringify(facts.crds),
    "answer.crds matches the render's CRDs exactly",
  );
  check(
    sortedMap(answer.customResources ?? {}) === sortedMap(facts.customResources),
    "answer.customResources matches the render's custom resources by kind and count",
  );
  check(
    answer.crdBeforeCr === facts.crdBeforeCr,
    `answer.crdBeforeCr (${answer.crdBeforeCr}) matches whether the render has custom resources of its CRDs (${facts.crdBeforeCr})`,
  );
  check(
    JSON.stringify([...(answer.webhooksNeedingCaBundle ?? [])].sort()) ===
      JSON.stringify(facts.webhooksNeedingCaBundle),
    "answer.webhooksNeedingCaBundle matches the render's admission webhooks with an empty caBundle",
  );
  check(
    JSON.stringify([...(answer.hooks ?? [])].sort()) === JSON.stringify(facts.hooks),
    "answer.hooks matches the render's Helm hook objects",
  );
}

function buildSummary(scenario, facts) {
  const crCount = Object.values(facts.customResources).reduce((a, b) => a + b, 0);
  const crBreakdown = Object.entries(facts.customResources)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  const hookLine = facts.hooks.length
    ? facts.hooks.join(", ")
    : "none in this render, so the admission caBundle is not filled by a Helm hook here";
  return `# How should Argo CD or Flux handle this chart's hooks and CRDs?

A GitOps operator asks a spine question about ${scenario.spec.render.chart}. The
assistant does the easy part, naming the lifecycle work; the gate does the safe part,
refusing to invent lifecycle work or miss it, by checking every claim against the
render.

## The lifecycle work

- **CRDs, applied first:** ${facts.crds.length}. They must be applied and become
  Established before any custom resource, or the custom resources fail to apply. In
  Argo CD this is an early sync wave with server-side apply and a wait; in Flux it is
  a dependency on the CRD Kustomization.
- **Custom resources, applied after:** ${crCount} (${crBreakdown}). Each uses one of
  the CRDs above, which is why the ordering matters.
- **Admission webhooks needing a caBundle:** ${facts.webhooksNeedingCaBundle.length}.
  They ship with an empty caBundle, so the controller reconciler must fill it before
  the webhook can admit anything, from the operator's self-signed certificate or
  cert-manager.
- **Helm hooks:** ${hookLine}.

## The gate

- The listed CRDs match the render's CRDs exactly.
- The custom resources match the render by kind and count.
- The CRD-before-custom-resource ordering claim matches whether the render actually
  contains custom resources of those CRDs.
- The admission webhooks needing a caBundle match the render's webhooks with an empty
  caBundle.
- The Helm hooks match the render's hook objects.

The self-test mutates the answer three ways, an invented CRD, a wrong custom-resource
count, and an invented Helm hook, and confirms the gate rejects each. So the answer
is the assistant, and the render is the authority.

## The limit

This reads one committed render. It reports the lifecycle work present in the objects,
not the runtime behavior of applying them, which the live hook and CRD lifecycle
proofs cover separately.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The lifecycle facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-lifecycle-work.yaml)
- [The render](../../${scenario.spec.render.path})

Run:

\`\`\`bash
npm run ai-lifecycle-work:verify
npm run ai-lifecycle-work:self-test
\`\`\`
`;
}

function build(scenario) {
  const s = scenario ?? readYaml(scenarioPath);
  const renderPath = join(repoRoot, s.spec.render.path);
  const facts = deriveLifecycle(renderPath);
  gate(s.spec.answer, facts);

  const crCount = Object.values(facts.customResources).reduce((a, b) => a + b, 0);
  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AiLifecycleWorkReceipt",
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
        crds: facts.crds.length,
        customResources: crCount,
        webhooksNeedingCaBundle: facts.webhooksNeedingCaBundle.length,
        hooks: facts.hooks.length,
      },
      gate: {
        crdsMatch: true,
        customResourcesMatch: true,
        orderingMatch: true,
        webhooksMatch: true,
        hooksMatch: true,
      },
      result: "pass",
    },
  };

  return {
    scenario: s,
    facts: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiLifecycleWorkRenderFacts",
      metadata: { name: s.metadata.name },
      spec: facts,
    },
    answer: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "AiLifecycleWorkAnswer",
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
  console.log(`wrote AI lifecycle-work example -> ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  const check2 = (path, expected) => {
    const actual = readFileSync(path, "utf8");
    check(actual === expected, `${relativeRepo(path)} matches regenerated content`);
  };
  check2(outputs.facts, `${toYaml(report.facts)}\n`);
  check2(outputs.answer, `${toYaml(report.answer)}\n`);
  check2(outputs.receipt, `${toYaml(report.receipt)}\n`);
  check2(outputs.summary, report.summary);
  console.log("verified AI lifecycle-work example");
} else {
  const scenario = readYaml(scenarioPath);

  const inventedCrd = structuredClone(scenario);
  inventedCrd.spec.answer.crds = [
    ...inventedCrd.spec.answer.crds,
    "invented.monitoring.coreos.com",
  ];
  expectFailure(
    () => build(inventedCrd),
    "invented CRD fixture unexpectedly passed the gate",
  );

  const wrongCount = structuredClone(scenario);
  wrongCount.spec.answer.customResources.ServiceMonitor = 999;
  expectFailure(
    () => build(wrongCount),
    "wrong custom-resource count fixture unexpectedly passed the gate",
  );

  const inventedHook = structuredClone(scenario);
  inventedHook.spec.answer.hooks = ["Job/invented-hook"];
  expectFailure(
    () => build(inventedHook),
    "invented hook fixture unexpectedly passed the gate",
  );

  console.log("ai lifecycle-work self-test passed");
}
