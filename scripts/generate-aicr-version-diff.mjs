#!/usr/bin/env node

// Record what changed between retained AICR versions, as data.
//
// Every retained entry was generated from the same criteria, so adjacent
// versions can be compared without deleting history. The top-level fields
// remain the original v0.14.0 -> v0.18.0 transition because numeric-claim
// records already cite those paths. Adjacent transitions are retained in
// `transitions`; `latest` remains the newest-pair alias.
//
// Writing that comparison as prose would put a second copy of the facts next
// to the entries, and copies rot. This computes it from the committed bytes of
// both entries on every run, so the record cannot drift from the entries it
// describes.
//
// Everything runs offline against committed bytes. No cluster, no network.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, parseDocs, readYaml, relativeRepo, repoRoot, sha256, write } from "./lib/proof-common.mjs";
import { reviewDisruption } from "./lib/config-disruption-review.mjs";

const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";
const retained = [
  "eks-h100-training-kubeflow",
  "eks-h100-training-kubeflow-v0-18-0",
  "eks-h100-training-kubeflow-v0-19-0",
  "eks-h100-training-kubeflow-v0-20-0",
  "h100-eks-ubuntu-training-kubeflow",
];
const entryCache = new Map();
const summaryPath = join(repoRoot, "data", "aicr-version-diff", "summary.md");
const recordPath = join(repoRoot, "data", "aicr-version-diff", "diff.json");

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-aicr-version-diff.mjs --generate
  node scripts/generate-aicr-version-diff.mjs --verify`);
  process.exit(2);
}

const transitions = retained.slice(0, -1).map((entry, index) => compare(entry, retained[index + 1]));
const historical = transitions[0];
const latest = transitions.at(-1);
const diff = {
  schemaVersion: 3,
  retained: retained.map((id) => {
    const entry = readEntry(id);
    return { entry: entry.id, version: entry.version, commit: entry.commit };
  }),
  ...historical,
  latest,
  transitions,
  inputs: Object.fromEntries(retained.map((entry) => [entry, inputManifest(entry)])),
  inputComparisons: retained.slice(0, -1).map((entry, index) => inputComparison(entry, retained[index + 1])),
  objectComparisons: retained.slice(0, -1).map((entry, index) => objectComparison(entry, retained[index + 1])),
};
if (mode === "--generate") {
  write(recordPath, `${JSON.stringify(diff, null, 2)}\n`);
  write(summaryPath, renderSummary(diff));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  check(existsSync(recordPath), `${relativeRepo(recordPath)} is missing; run npm run aicr-version-diff:generate`);
  check(
    readFileSync(recordPath, "utf8") === `${JSON.stringify(diff, null, 2)}\n`,
    `${relativeRepo(recordPath)} is stale; run npm run aicr-version-diff:generate`,
  );
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(diff),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-version-diff:generate`,
  );
  console.log(
    `verified ${diff.retained.length} retained AICR versions; latest transition ${latest.from.version} -> ${latest.to.version} changes ${latest.components.changed.length} of ${latest.components.compared} component Applications`,
  );
}

function readEntry(name) {
  if (entryCache.has(name)) return entryCache.get(name);
  const root = join(repoRoot, "examples", "aicr", name);
  check(existsSync(root), `${relativeRepo(root)} is missing`);
  const receipt = readYaml(join(root, "generation-receipt.yaml"));
  const recipe = readYaml(join(root, "recipe.yaml"));
  const renderedRoot = join(root, "argocd-rendered", "templates");
  const applications = new Map();
  const applicationObjects = new Map();
  for (const file of readdirSync(renderedRoot).filter((entry) => entry.endsWith(".yaml")).sort()) {
    const docs = parseDocs(readFileSync(join(renderedRoot, file), "utf8"));
    check(docs.length === 1, `${name}/${file}: expected exactly one document`);
    const doc = docs[0];
    check(doc.apiVersion === "argoproj.io/v1alpha1" && doc.kind === "Application" && typeof doc.metadata?.name === "string" && doc.metadata.name, `${name}/${file}: expected a named Argo CD Application`);
    const wave = doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION];
    const applicationName = doc.metadata?.name ?? file;
    check(!applications.has(applicationName), `${name}: duplicate rendered Application ${applicationName}`);
    applications.set(applicationName, {
      wave: wave === undefined ? null : Number(wave),
      chart: doc.spec?.source?.chart ?? null,
      targetRevision: doc.spec?.source?.targetRevision ?? null,
      repoURL: doc.spec?.source?.repoURL ?? null,
    });
    applicationObjects.set(applicationName, doc);
  }
  const entry = {
    id: name,
    version: receipt.spec?.source?.version ?? "",
    commit: receipt.spec?.source?.commit ?? "",
    deploymentOrder: recipe.deploymentOrder ?? [],
    components: (recipe.componentRefs ?? []).map((component) => component.name ?? component.chart).filter(Boolean),
    recipeApiVersion: recipe.apiVersion ?? "",
    recipeSha256: sha256(readFileSync(join(root, "recipe.yaml"))),
    healthCheckComponents: (recipe.componentRefs ?? []).filter((component) => Boolean(component.healthCheckAsserts)).length,
    healthCheckBytes: (recipe.componentRefs ?? []).reduce(
      (total, component) => total + Buffer.byteLength(component.healthCheckAsserts ?? ""),
      0,
    ),
    healthChecks: new Map(
      (recipe.componentRefs ?? [])
        .filter((component) => Boolean(component.healthCheckAsserts))
        .map((component) => {
          const text = component.healthCheckAsserts;
          return [component.name ?? component.chart, {
            sha256: sha256(Buffer.from(text)),
            bytes: Buffer.byteLength(text),
            assertTimeout: text.match(/assert:\s*([^\s]+)/)?.[1] ?? null,
            daemonSetChecks: [...new Set(
              [...text.matchAll(/kind:\s*DaemonSet[\s\S]*?name:\s*([^\s]+)/g)]
                .map((match) => match[1]),
            )],
          }];
        }),
    ),
    selectedProfile: recipe.metadata?.selectedProfile ?? null,
    applications,
    applicationObjects,
    criteria: receipt.spec?.sourceAndIntent?.criteria ?? receipt.spec?.criteria ?? null,
    generationInputs: receipt.spec?.sourceAndIntent?.generationInputs ?? receipt.spec?.generationInputs ?? null,
  };
  entryCache.set(name, entry);
  return entry;
}

function inputManifest(name) {
  const root = join(repoRoot, "examples", "aicr", name);
  const receiptPath = join(root, "generation-receipt.yaml");
  const recipePath = join(root, "recipe.yaml");
  const applicationsRoot = join(root, "argocd-rendered", "templates");
  const applications = {};
  for (const file of readdirSync(applicationsRoot).filter((entry) => entry.endsWith(".yaml")).sort()) {
    const path = join(applicationsRoot, file);
    applications[relativeRepo(path)] = sha256(readFileSync(path));
  }
  return {
    generationReceipt: { path: relativeRepo(receiptPath), sha256: sha256(readFileSync(receiptPath)) },
    recipe: { path: relativeRepo(recipePath), sha256: sha256(readFileSync(recipePath)) },
    applications,
  };
}

function inputComparison(fromId, toId) {
  const from = readEntry(fromId);
  const to = readEntry(toId);
  return {
    from: { entry: from.id, version: from.version, criteria: from.criteria, generationInputs: from.generationInputs },
    to: { entry: to.id, version: to.version, criteria: to.criteria, generationInputs: to.generationInputs },
    criteriaIdentical: from.criteria === null || to.criteria === null ? null : stableJson(from.criteria) === stableJson(to.criteria),
    generationInputsIdentical: from.generationInputs === null || to.generationInputs === null ? null : stableJson(from.generationInputs) === stableJson(to.generationInputs),
  };
}

function objectComparison(fromId, toId) {
  const from = readEntry(fromId);
  const to = readEntry(toId);
  return {
    from: { entry: from.id, version: from.version },
    to: { entry: to.id, version: to.version },
    review: reviewDisruption([...from.applicationObjects.values()], [...to.applicationObjects.values()]),
  };
}

function compare(fromId, toId) {
  const from = readEntry(fromId);
  const to = readEntry(toId);
  check(from.version && to.version, "both entries must record the AICR version they were generated with");
  check(from.version !== to.version, "the two entries record the same version, so there is nothing to compare");

  const names = [...new Set([...from.applications.keys(), ...to.applications.keys()])].sort();
  const changed = [];
  const unchanged = [];
  for (const name of names) {
    const left = from.applications.get(name);
    const right = to.applications.get(name);
    if (!left || !right) {
      changed.push({
        component: name,
        change: left ? "removed" : "added",
        from: left ?? null,
        to: right ?? null,
      });
      continue;
    }
    const versionMoved = left.targetRevision !== right.targetRevision;
    const waveMoved = left.wave !== right.wave;
    if (!versionMoved && !waveMoved) {
      unchanged.push(name);
      continue;
    }
    changed.push({
      component: name,
      change: versionMoved && waveMoved ? "version and wave" : versionMoved ? "version" : "wave",
      from: { targetRevision: left.targetRevision, wave: left.wave },
      to: { targetRevision: right.targetRevision, wave: right.wave },
    });
  }

  const waveValues = (entry) =>
    [...entry.applications.values()].map((row) => row.wave).filter((wave) => wave !== null);
  const distinct = (entry) => new Set(waveValues(entry)).size;
  const healthCheckNames = [...new Set([...from.healthChecks.keys(), ...to.healthChecks.keys()])].sort();
  const healthCheckChanges = healthCheckNames
    .map((component) => ({
      component,
      from: from.healthChecks.get(component) ?? null,
      to: to.healthChecks.get(component) ?? null,
    }))
    .filter((row) => stableJson(row.from) !== stableJson(row.to));

  return {
    from: { entry: from.id, version: from.version, commit: from.commit },
    to: { entry: to.id, version: to.version, commit: to.commit },
    recipe: {
      apiVersionBefore: from.recipeApiVersion,
      apiVersionAfter: to.recipeApiVersion,
      sha256Before: from.recipeSha256,
      sha256After: to.recipeSha256,
      healthCheckComponentsBefore: from.healthCheckComponents,
      healthCheckComponentsAfter: to.healthCheckComponents,
      healthCheckBytesBefore: from.healthCheckBytes,
      healthCheckBytesAfter: to.healthCheckBytes,
      selectedProfileBefore: from.selectedProfile,
      selectedProfileAfter: to.selectedProfile,
      healthCheckChanges,
    },
    shape: {
      componentsBefore: from.components.length,
      componentsAfter: to.components.length,
      componentSetIdentical: JSON.stringify([...from.components].sort()) === JSON.stringify([...to.components].sort()),
      applicationsBefore: from.applications.size,
      applicationsAfter: to.applications.size,
      deploymentOrderIdentical: JSON.stringify(from.deploymentOrder) === JSON.stringify(to.deploymentOrder),
      distinctWavesBefore: distinct(from),
      distinctWavesAfter: distinct(to),
    },
    components: { compared: names.length, changed, unchanged },
  };
}

function transitionSummary(transition, note) {
  const rows = transition.components.changed.map((row) => {
    const before = row.from ? `${row.from.targetRevision ?? "n/a"} in wave ${row.from.wave ?? "none"}` : "absent";
    const after = row.to ? `${row.to.targetRevision ?? "n/a"} in wave ${row.to.wave ?? "none"}` : "absent";
    return `| \`${row.component}\` | ${row.change} | ${before} | ${after} |`;
  });
  const versionMoves = transition.components.changed.filter((row) => row.change.includes("version")).length;
  const waveMoves = transition.components.changed.filter((row) => row.change.includes("wave")).length;
  const unchangedCount = transition.components.unchanged.length;
  const setLine = `The component set is ${transition.shape.componentSetIdentical ? "identical" : "different"} and the declared deployment order is ${transition.shape.deploymentOrderIdentical ? "identical" : "different"}.`;
  const movedLine = `${versionMoves} components changed the chart version they pull, and ${waveMoves} changed the wave they deploy in.`;
  const unchangedLine = unchangedCount === 1
    ? `One of the ${transition.components.compared} rendered Applications is unchanged in both version and wave.`
    : `${unchangedCount} of the ${transition.components.compared} rendered Applications are unchanged in both version and wave.`;
  const healthRows = transition.recipe.healthCheckChanges.map((row) => {
    const before = row.from
      ? `${row.from.assertTimeout ?? "default timeout"}; ${row.from.daemonSetChecks.length} DaemonSet checks`
      : "not present";
    const after = row.to
      ? `${row.to.assertTimeout ?? "default timeout"}; ${row.to.daemonSetChecks.length} DaemonSet checks`
      : "not present";
    return `| \`${row.component}\` | ${before} | ${after} |`;
  });

  return `## ${transition.from.version} to ${transition.to.version}

| | ${transition.from.version} | ${transition.to.version} |
| --- | --- | --- |
| Components in the recipe | ${transition.shape.componentsBefore} | ${transition.shape.componentsAfter} |
| Argo CD Applications | ${transition.shape.applicationsBefore} | ${transition.shape.applicationsAfter} |
| Distinct sync-waves | ${transition.shape.distinctWavesBefore} | ${transition.shape.distinctWavesAfter} |
| Components with embedded health checks | ${transition.recipe.healthCheckComponentsBefore} | ${transition.recipe.healthCheckComponentsAfter} |

${setLine} ${movedLine}

| Component | What moved | ${transition.from.version} | ${transition.to.version} |
| --- | --- | --- | --- |
${rows.length > 0 ? rows.join("\n") : "| None | no chart-version or wave change | n/a | n/a |"}

${unchangedLine}

${healthRows.length > 0 ? `### Health-check changes

| Component | ${transition.from.version} | ${transition.to.version} |
| --- | --- | --- |
${healthRows.join("\n")}
` : "No embedded health-check definition changed in this transition.\n"}

${note}
`;
}

function renderSummary(diff) {
  const historical = diff.transitions[0];
  const nvsentinelHealth = diff.transitions.find((transition) => transition.from.version === "v0.19.0" && transition.to.version === "v0.20.0")?.recipe.healthCheckChanges.find((row) => row.component === "nvsentinel");
  check(nvsentinelHealth, "the v0.19.0 to v0.20.0 comparison must retain the NVSentinel health-check change");
  const v021Inputs = diff.inputComparisons.find((comparison) => comparison.from.version === "v0.20.0" && comparison.to.version === "v0.21.0");
  check(v021Inputs, "the v0.20.0 to v0.21.0 input comparison is required");
  const v021Objects = diff.objectComparisons.find((comparison) => comparison.from.version === "v0.20.0" && comparison.to.version === "v0.21.0");
  const v021Changed = v021Objects.review.objects.filter((object) => object.changeType !== "unchanged").length;
  const notes = new Map([
    ["v0.14.0->v0.18.0", `The sync-wave count fell from ${historical.shape.distinctWavesBefore} to ${historical.shape.distinctWavesAfter}. v0.18.0 began grouping independent components into parallel waves. That change is why the ordering verifier checks dependency edges instead of requiring one unique wave per component.`],
    ["v0.19.0->v0.20.0", `NVSentinel moves from v1.9.0 to v1.20.0. Its check now tests the driver-labelled DaemonSets as well as the labeler Deployment and pods. The overall assert timeout changes from ${nvsentinelHealth.from.assertTimeout} to ${nvsentinelHealth.to.assertTimeout}, so a stalled DaemonSet reports its failure sooner. The optional zero-desired cases remain excluded. These are retained source changes; this comparison does not claim that the check ran on EKS.`],
    ["v0.20.0->v0.21.0", `The full-object comparison finds ${v021Changed} changed Application objects, including changes outside chart versions and waves. The v0.21.0 entry is an existing overlay-generator output with its own pinned source receipt and generation inputs. The local generation repoURL changes from ${v021Inputs.from.generationInputs.repoURL} to ${v021Inputs.to.generationInputs.repoURL}; this is an input difference, not an upstream AICR change. This comparison uses the committed recipe and rendered Application bytes; it does not claim identical local generation inputs, downstream chart rerenders, publication, or runtime behavior.`],
  ]);

  return `# What changed across retained AICR versions

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-version-diff:generate\` and checked by
\`npm run aicr-version-diff:verify\`. Every number here is computed from the
committed bytes of all retained entries, so the version tables cannot drift
from the recipes and Application objects they describe.

The catalog retains ${diff.retained.map((entry) => entry.version).join(", ")} side by side.
The entries use comparable EKS, H100, Ubuntu, training, and Kubeflow criteria;
each entry's generation receipt and input hashes are recorded separately in the
machine report.
Earlier entries remain available when a new one is added.

${diff.transitions.map((transition) => transitionSummary(transition, notes.get(`${transition.from.version}->${transition.to.version}`) ?? "This transition is computed from the retained committed entry bytes; runtime behavior is not inferred.")).join("\n")}

## What this comparison covers

The version/wave tables cover only those two fields. The machine report also
retains \`objectComparisons\` with full-object hashes and changed JSON Pointer
paths from the shared static classifier, plus \`inputs\` with exact receipt,
recipe and Application file hashes. A version/wave-unchanged Application can
still have changed configuration. The classifier leaves these custom-resource
changes unclassified and does not predict their controller effects.

This comparison covers the retained recipe and the 17 materialized Argo CD
Application objects. It does not render the downstream workload charts, run
the AICR health checks, contact EKS, or prove a GPU workload. Those are separate
route, delivery, and runtime steps with separate receipts.
`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
