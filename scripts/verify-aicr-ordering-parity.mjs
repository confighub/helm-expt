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
const entries = ["eks-h100-training-kubeflow", "eks-h100-inference-nim"];
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
  const duplicateWaves = [...waves.values()].filter((wave, index, all) => all.indexOf(wave) !== index);
  check(duplicateWaves.length === 0, `${relativeRepo(renderedRoot)}: two Applications share a sync-wave`);

  // Every declared component must render, or the recipe and the bundle
  // disagree about what the platform contains.
  const missing = declared.filter((name) => !waves.has(name));
  check(
    missing.length === 0,
    `${relativeRepo(recipePath)}: deploymentOrder names ${missing.join(", ")}, which the rendered output does not contain`,
  );

  // The waved order, restricted to declared components, must equal the
  // declared order exactly.
  const wavedOrder = [...waves.entries()].sort((left, right) => left[1] - right[1]).map(([name]) => name);
  const restricted = wavedOrder.filter((name) => declared.includes(name));
  check(
    JSON.stringify(restricted) === JSON.stringify(declared),
    `${relativeRepo(entryRoot)}: rendered sync-waves order components differently from the recipe (rendered: ${restricted.join(", ")})`,
  );

  // Anything rendered but undeclared is a companion, and it is named rather
  // than quietly dropped from the comparison.
  const companions = wavedOrder.filter((name) => !declared.includes(name));
  return {
    entry: relativeRepo(entryRoot),
    name: entryRoot.split("/").pop(),
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
        `| \`${row.name}\` | ${row.orderedCount} | ${row.renderedCount} | ${row.companions.map((name) => `\`${name}\``).join(", ") || "none"} | ${row.roots.map((name) => `\`${name}\``).join(", ") || "none"} |`,
    )
    .join("\n");
  return `# AICR ordering parity

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-ordering:generate\` and checked by
\`npm run aicr-ordering:verify\`.

Every AICR recipe carries an explicit \`deploymentOrder\` computed from the
component dependency graph. This lane checks that the sync-waves in each
entry's rendered Argo CD Applications order those components exactly as the
recipe declares, so the ordering the bundles carry is upstream's rather than
an artifact of rendering.

| Entry | Components ordered upstream | Applications rendered | Companions | Platform root |
| --- | --- | --- | --- | --- |
${rows}

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
// the committed ones.
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

    const build = (name, order, apps) => {
      const root = join(scratch, name);
      write(join(root, "recipe.yaml"), `${JSON.stringify({ deploymentOrder: order })}\n`);
      for (const [appName, wave] of apps) {
        write(join(root, "argocd-rendered", "templates", `${appName}.yaml`), app(appName, wave));
      }
      return root;
    };

    const good = build("good", ["alpha", "beta", "gamma"], [
      ["alpha", 0], ["beta", 1], ["gamma", 2], ["beta-post", 3], ["root", null],
    ]);
    const result = checkEntry(good);
    check(
      result.orderedCount === 3
        && JSON.stringify(result.companions) === JSON.stringify(["beta-post"])
        && JSON.stringify(result.roots) === JSON.stringify(["root"]),
      "self-test baseline did not classify companions and roots",
    );

    const shuffled = build("shuffled", ["alpha", "beta", "gamma"], [
      ["alpha", 0], ["gamma", 1], ["beta", 2],
    ]);
    check(
      fails(() => checkEntry(shuffled), /order components differently from the recipe/),
      "self-test accepted sync-waves that reorder the declared components",
    );

    const missing = build("missing", ["alpha", "beta", "absent"], [["alpha", 0], ["beta", 1]]);
    check(
      fails(() => checkEntry(missing), /which the rendered output does not contain/),
      "self-test accepted a declared component that never renders",
    );

    const duplicateWave = build("duplicate-wave", ["alpha", "beta"], [["alpha", 0], ["beta", 0]]);
    check(
      fails(() => checkEntry(duplicateWave), /share a sync-wave/),
      "self-test accepted two Applications sharing a wave",
    );

    const noOrder = build("no-order", [], [["alpha", 0]]);
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
