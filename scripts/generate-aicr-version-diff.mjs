#!/usr/bin/env node

// Record what changed between retained AICR versions, as data.
//
// Every retained entry was generated from the same criteria, so adjacent
// versions can be compared without deleting history. The top-level fields
// remain the original v0.14.0 -> v0.18.0 transition because numeric-claim
// records already cite those paths. New transitions live under `latest`.
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

const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";
const retained = [
  "eks-h100-training-kubeflow",
  "eks-h100-training-kubeflow-v0-18-0",
  "eks-h100-training-kubeflow-v0-19-0",
];
const summaryPath = join(repoRoot, "data", "aicr-version-diff", "summary.md");
const recordPath = join(repoRoot, "data", "aicr-version-diff", "diff.json");

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-aicr-version-diff.mjs --generate
  node scripts/generate-aicr-version-diff.mjs --verify`);
  process.exit(2);
}

const historical = compare(retained[0], retained[1]);
const latest = compare(retained[1], retained[2]);
const diff = {
  schemaVersion: 2,
  retained: retained.map((id) => {
    const entry = readEntry(id);
    return { entry: entry.id, version: entry.version, commit: entry.commit };
  }),
  ...historical,
  latest,
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
  const root = join(repoRoot, "examples", "aicr", name);
  check(existsSync(root), `${relativeRepo(root)} is missing`);
  const receipt = readYaml(join(root, "generation-receipt.yaml"));
  const recipe = readYaml(join(root, "recipe.yaml"));
  const renderedRoot = join(root, "argocd-rendered", "templates");
  const applications = new Map();
  for (const file of readdirSync(renderedRoot).filter((entry) => entry.endsWith(".yaml")).sort()) {
    const docs = parseDocs(readFileSync(join(renderedRoot, file), "utf8"));
    check(docs.length === 1, `${name}/${file}: expected exactly one document`);
    const doc = docs[0];
    const wave = doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION];
    applications.set(doc.metadata?.name ?? file, {
      wave: wave === undefined ? null : Number(wave),
      chart: doc.spec?.source?.chart ?? null,
      targetRevision: doc.spec?.source?.targetRevision ?? null,
      repoURL: doc.spec?.source?.repoURL ?? null,
    });
  }
  return {
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
    selectedProfile: recipe.metadata?.selectedProfile ?? null,
    applications,
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

${note}
`;
}

function renderSummary(diff) {
  const historicalNote = `The sync-wave count fell from ${diff.shape.distinctWavesBefore} to ${diff.shape.distinctWavesAfter}. v0.18.0 began grouping independent components into parallel waves. That change is why the ordering verifier checks dependency edges instead of requiring one unique wave per component.`;
  const latest = diff.latest;
  const latestNote = `The v0.19.0 EKS recipe remains unprofiled. The new \`gpuStack\` source profile is available on AKS and GKE families, not on this EKS composition. The retained field-policy assessment records that boundary and shows which AKS fields the profile protects.`;

  return `# What changed across retained AICR versions

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-version-diff:generate\` and checked by
\`npm run aicr-version-diff:verify\`. Every number here is computed from the
committed bytes of all retained entries, so the version tables cannot drift
from the recipes and Application objects they describe.

The catalog retains ${diff.retained.map((entry) => entry.version).join(", ")} side by side.
Each entry uses the same EKS, H100, Ubuntu, training, and Kubeflow criteria and
the same local generation inputs. Earlier entries remain available when a new
one is added.

${transitionSummary(diff, historicalNote)}

${transitionSummary(latest, latestNote)}

## What this comparison covers

This comparison covers the retained recipe and the 17 materialized Argo CD
Application objects. It does not render the downstream workload charts, run
the AICR health checks, contact EKS, or prove a GPU workload. Those are separate
route, delivery, and runtime steps with separate receipts.
`;
}
