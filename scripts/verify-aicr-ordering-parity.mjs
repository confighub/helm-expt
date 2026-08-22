#!/usr/bin/env node

// Check that rendered sync-waves preserve the order AICR declared.
//
// The delivery proof holds the Argo application controller at zero replicas
// and says ordering is a decision the catalog has not earned. That was true
// while the only evidence for ordering was the sync-wave numbers in the
// rendered output, which are an artifact of rendering rather than a statement
// about dependencies.
//
// It is no longer the whole picture. Every AICR recipe carries an explicit
// deploymentOrder computed from the component dependency graph, and the
// retained recipes carry it too. This lane checks that the rendered
// sync-waves order those components exactly as the recipe declares, so the
// ordering our bundles carry is upstream's, not ours.
//
// Applications that render without appearing in deploymentOrder are recorded
// rather than ignored. They are the post-install companions and the platform
// root, and naming them is the difference between a match and a silent
// approximation.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";
const entries = [
  "eks-h100-training-kubeflow",
  "eks-h100-training-kubeflow-v0-18-0",
  "eks-h100-training-kubeflow-v0-19-0",
  "eks-h100-inference-nim",
];
const summaryPath = join(repoRoot, "data", "aicr-ordering-parity", "summary.md");

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/verify-aicr-ordering-parity.mjs --generate
  node scripts/verify-aicr-ordering-parity.mjs --verify
  node scripts/verify-aicr-ordering-parity.mjs --self-test`);
  process.exit(2);
}

if (mode === "--generate") {
  const results = entries.map((name) => checkEntry(join(repoRoot, "examples", "aicr", name)));
  write(summaryPath, renderSummary(results));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const results = entries.map((name) => checkEntry(join(repoRoot, "examples", "aicr", name)));
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-ordering:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(results),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-ordering:generate`,
  );
  const ordered = results.reduce((total, row) => total + row.orderedCount, 0);
  console.log(
    `verified that ${ordered} component orderings across ${results.length} entries match the order AICR declared`,
  );
} else {
  selfTest();
  console.log("verified the ordering-parity checker against fake surfaces");
}

function checkEntry(entryRoot) {
  const recipePath = join(entryRoot, "recipe.yaml");
  check(existsSync(recipePath), `${relativeRepo(recipePath)} is missing; the entry retains no recipe`);
  const recipe = readYaml(recipePath);
  const declared = recipe.deploymentOrder ?? recipe.spec?.deploymentOrder ?? [];
  check(
    Array.isArray(declared) && declared.length > 0,
    `${relativeRepo(recipePath)}: the retained recipe declares no deploymentOrder`,
  );
  check(
    new Set(declared).size === declared.length,
    `${relativeRepo(recipePath)}: deploymentOrder names a component twice`,
  );

  const renderedRoot = join(entryRoot, "argocd-rendered", "templates");
  check(existsSync(renderedRoot), `${relativeRepo(renderedRoot)} is missing`);
  const waves = new Map();
  const unwaved = [];
  for (const file of listFiles(renderedRoot).filter((path) => path.endsWith(".yaml")).sort()) {
    const docs = parseDocs(readFileSync(file, "utf8"));
    check(docs.length === 1, `${relativeRepo(file)}: expected exactly one document`);
    const doc = docs[0];
    const name = doc.metadata?.name ?? "";
    check(name, `${relativeRepo(file)}: Application has no name`);
    const annotation = doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION];
    if (annotation === undefined) {
      unwaved.push(name);
      continue;
    }
    const wave = Number(annotation);
    check(Number.isInteger(wave), `${relativeRepo(file)}: sync-wave is not an integer`);
    check(!waves.has(name), `${relativeRepo(file)}: two Applications share the name ${name}`);
    waves.set(name, wave);
  }
  check(waves.size > 0, `${relativeRepo(renderedRoot)}: no waved Applications`);
  // Two Applications may share a wave. AICR v0.18.0 puts independent
  // components in one wave on purpose, so a shared wave is a statement that
  // they can deploy together rather than a defect.

  // Every declared component must render, or the recipe and the bundle
  // disagree about what the platform contains.
  const missing = declared.filter((name) => !waves.has(name));
  check(
    missing.length === 0,
    `${relativeRepo(recipePath)}: deploymentOrder names ${missing.join(", ")}, which the rendered output does not contain`,
  );

  // Every recipe carries the dependency edges its order was computed from, and
  // those edges are the claim worth checking. A component's wave has to come
  // after the wave of everything it depends on, whatever grouping upstream
  // chose. This holds for a strict sequence and for parallel groups alike,
  // which is what makes it the right check now that both exist.
  const dependencies = new Map();
  for (const component of recipe.componentRefs ?? []) {
    const name = component.name ?? component.chart;
    if (!name) continue;
    dependencies.set(name, component.dependencyRefs ?? []);
  }
  let edgeCount = 0;
  for (const [component, deps] of dependencies) {
    for (const dependency of deps) {
      edgeCount += 1;
      check(
        waves.has(component) && waves.has(dependency),
        `${relativeRepo(recipePath)}: ${component} depends on ${dependency}, and one of them renders without a sync-wave`,
      );
      check(
        waves.get(dependency) < waves.get(component),
        `${relativeRepo(entryRoot)}: ${component} is in wave ${waves.get(component)} and depends on ${dependency} in wave ${waves.get(dependency)}, so the rendered waves would run it too early`,
      );
      // deploymentOrder is upstream's own linearization of these edges, so it
      // has to respect them too. Checking it catches an order that disagrees
      // with the graph it claims to come from.
      const before = declared.indexOf(dependency);
      const after = declared.indexOf(component);
      check(
        before === -1 || after === -1 || before < after,
        `${relativeRepo(recipePath)}: deploymentOrder puts ${component} before ${dependency}, which it depends on`,
      );
    }
  }
  check(edgeCount > 0, `${relativeRepo(recipePath)}: the recipe declares no dependency edges to check`);

  const wavedOrder = [...waves.entries()].sort((left, right) => left[1] - right[1]).map(([name]) => name);
  const distinctWaves = new Set([...waves.values()]).size;
  // A version that gives every component its own wave is making the stronger
  // claim that the rendered order is exactly the declared one, and it is still
  // held to it. A version that groups components is not, and saying which
  // model an entry follows is more useful than forcing both into one rule.
  const orderModel = distinctWaves === waves.size ? "total order" : "parallel groups";
  if (orderModel === "total order") {
    const restricted = wavedOrder.filter((name) => declared.includes(name));
    check(
      JSON.stringify(restricted) === JSON.stringify(declared),
      `${relativeRepo(entryRoot)}: rendered sync-waves order components differently from the recipe (rendered: ${restricted.join(", ")})`,
    );
  }

  // Anything rendered but undeclared is a companion, and it is named rather
  // than quietly dropped from the comparison.
  const companions = wavedOrder.filter((name) => !declared.includes(name));
  return {
    entry: relativeRepo(entryRoot),
    name: entryRoot.split("/").pop(),
    orderModel,
    distinctWaves,
    edgeCount,
    orderedCount: declared.length,
    renderedCount: waves.size + unwaved.length,
    companions,
    roots: unwaved,
    first: declared[0],
    last: declared[declared.length - 1],
  };
}

function renderSummary(results) {
  const rows = results
    .map(
      (row) =>
        `| \`${row.name}\` | ${row.orderModel} | ${row.distinctWaves} | ${row.edgeCount} | ${row.orderedCount} | ${row.renderedCount} | ${row.companions.map((name) => `\`${name}\``).join(", ") || "none"} | ${row.roots.map((name) => `\`${name}\``).join(", ") || "none"} |`,
    )
    .join("\n");
  return `# AICR ordering parity

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-ordering:generate\` and checked by
\`npm run aicr-ordering:verify\`.

Every AICR recipe carries the dependency edges its deployment order was
computed from. This lane checks that the sync-waves in each entry's rendered
Argo CD Applications respect every one of those edges, so the ordering the
bundles carry is upstream's rather than an artifact of rendering. It checks
\`deploymentOrder\` against the same edges, because a declared order that
disagrees with the graph it came from is worth catching too.

| Entry | Order model | Distinct waves | Edges checked | Components ordered upstream | Applications rendered | Companions | Platform root |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

The order model column is the interesting one. AICR v0.14.0 gave every
component its own wave, which is a total order, and an entry in that model is
still held to the stronger claim that the rendered order equals the declared
one exactly. AICR v0.18.0 deploys independent components in parallel and puts
several in one wave, so the rendered output no longer carries a total order
and cannot be held to that claim. Both are checked against the dependency
edges, which is what the ordering was always meant to express.

This is why the check moved. A rule that only knew about total orders would
have refused the v0.18.0 entry for doing exactly what upstream now intends.

Companions are Applications that render without appearing in
\`deploymentOrder\`. They are the post-install partners of a component and the
platform root, and they are named here rather than dropped from the
comparison, because a match that quietly ignores rows is not a match.

This is what retires the caveat the delivery proof carried. That proof holds
the Argo application controller at zero replicas, which remains the right
choice for a config-plane proof, but the reason is now precise: the catalog
declines to run the sync, not that it lacks a defensible order. The order is
declared upstream and preserved here.
`;
}

// The self-test builds fake entries so every refusal runs without touching
// the committed ones. The fixtures carry dependency edges, because the edges
// are what the lane now checks.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-ordering-self-test-"));
  try {
    const app = (name, wave) =>
      [
        "apiVersion: argoproj.io/v1alpha1",
        "kind: Application",
        "metadata:",
        ...(wave === null ? [] : ["  annotations:", `    ${SYNC_WAVE_ANNOTATION}: "${wave}"`]),
        `  name: ${name}`,
        "  namespace: argocd",
        "spec: {}",
        "",
      ].join("\n");

    const build = (name, order, apps, components) => {
      const root = join(scratch, name);
      write(
        join(root, "recipe.yaml"),
        `${JSON.stringify({
          deploymentOrder: order,
          componentRefs: components.map(([componentName, deps]) => ({ name: componentName, dependencyRefs: deps })),
        })}\n`,
      );
      for (const [appName, wave] of apps) {
        write(join(root, "argocd-rendered", "templates", `${appName}.yaml`), app(appName, wave));
      }
      return root;
    };

    const totalOrder = build(
      "total-order",
      ["alpha", "beta", "gamma"],
      [["alpha", 0], ["beta", 1], ["gamma", 2], ["beta-post", 3], ["root", null]],
      [["alpha", []], ["beta", ["alpha"]], ["gamma", ["beta"]]],
    );
    const result = checkEntry(totalOrder);
    check(
      result.orderModel === "total order"
        && result.edgeCount === 2
        && JSON.stringify(result.companions) === JSON.stringify(["beta-post"])
        && JSON.stringify(result.roots) === JSON.stringify(["root"]),
      "self-test baseline did not classify the total-order fixture",
    );

    // Independent components sharing one wave is the v0.18.0 shape, and it
    // has to be accepted rather than refused for not being a sequence.
    const parallel = build(
      "parallel",
      ["alpha", "beta", "gamma"],
      [["alpha", 1], ["beta", 1], ["gamma", 5], ["root", null]],
      [["alpha", []], ["beta", []], ["gamma", ["alpha", "beta"]]],
    );
    const grouped = checkEntry(parallel);
    check(
      grouped.orderModel === "parallel groups" && grouped.distinctWaves === 2 && grouped.edgeCount === 2,
      "self-test did not accept independent components sharing a wave",
    );

    const tooEarly = build(
      "too-early",
      ["alpha", "beta"],
      [["alpha", 5], ["beta", 1]],
      [["alpha", []], ["beta", ["alpha"]]],
    );
    check(
      fails(() => checkEntry(tooEarly), /depends on alpha in wave 5, so the rendered waves would run it too early/),
      "self-test accepted a component scheduled before something it depends on",
    );

    const badOrder = build(
      "bad-order",
      ["beta", "alpha"],
      [["alpha", 1], ["beta", 5]],
      [["alpha", []], ["beta", ["alpha"]]],
    );
    check(
      fails(() => checkEntry(badOrder), /deploymentOrder puts beta before alpha, which it depends on/),
      "self-test accepted a declared order that contradicts the dependency edges",
    );

    const shuffled = build(
      "shuffled",
      ["alpha", "beta", "gamma"],
      [["alpha", 0], ["gamma", 1], ["beta", 2]],
      [["alpha", []], ["beta", ["alpha"]], ["gamma", ["alpha"]]],
    );
    check(
      fails(() => checkEntry(shuffled), /order components differently from the recipe/),
      "self-test accepted sync-waves that reorder the declared components under a total order",
    );

    const missing = build(
      "missing",
      ["alpha", "beta", "absent"],
      [["alpha", 0], ["beta", 1]],
      [["alpha", []], ["beta", ["alpha"]]],
    );
    check(
      fails(() => checkEntry(missing), /which the rendered output does not contain/),
      "self-test accepted a declared component that never renders",
    );

    const noEdges = build("no-edges", ["alpha"], [["alpha", 0]], [["alpha", []]]);
    check(
      fails(() => checkEntry(noEdges), /declares no dependency edges to check/),
      "self-test accepted a recipe with no dependency edges",
    );

    const noOrder = build("no-order", [], [["alpha", 0]], [["alpha", []]]);
    check(
      fails(() => checkEntry(noOrder), /declares no deploymentOrder/),
      "self-test accepted a recipe with no declared order",
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
