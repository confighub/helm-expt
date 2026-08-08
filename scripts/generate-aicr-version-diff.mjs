#!/usr/bin/env node

// Record what changed between the two retained AICR versions, as data.
//
// The catalog retains AICR v0.14.0 and now v0.18.0, generated from the same
// criteria so they can be compared. The interesting question is not that a
// version moved, it is what moved with it: which components changed version,
// which changed scheduling, and whether the shape itself changed.
//
// Writing that comparison as prose would put a second copy of the facts next
// to the entries, and copies rot. This computes it from the committed bytes of
// both entries on every run, so the record cannot drift from the entries it
// describes.
//
// Everything runs offline against committed bytes. No cluster, no network.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, parseDocs, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";
const older = "eks-h100-training-kubeflow";
const newer = "eks-h100-training-kubeflow-v0-18-0";
const summaryPath = join(repoRoot, "data", "aicr-version-diff", "summary.md");
const recordPath = join(repoRoot, "data", "aicr-version-diff", "diff.json");

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-aicr-version-diff.mjs --generate
  node scripts/generate-aicr-version-diff.mjs --verify`);
  process.exit(2);
}

const diff = compare();
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
    `verified the retained-version diff: ${diff.components.changed.length} of ${diff.components.compared} components moved between ${diff.from.version} and ${diff.to.version}`,
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
    applications,
  };
}

function compare() {
  const from = readEntry(older);
  const to = readEntry(newer);
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
    schemaVersion: 1,
    from: { entry: from.id, version: from.version, commit: from.commit },
    to: { entry: to.id, version: to.version, commit: to.commit },
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

function renderSummary(diff) {
  const rows = diff.components.changed.map((row) => {
    const before = row.from ? `${row.from.targetRevision ?? "n/a"} in wave ${row.from.wave ?? "none"}` : "absent";
    const after = row.to ? `${row.to.targetRevision ?? "n/a"} in wave ${row.to.wave ?? "none"}` : "absent";
    return `| \`${row.component}\` | ${row.change} | ${before} | ${after} |`;
  });
  const versionMoves = diff.components.changed.filter((row) => row.change.includes("version")).length;
  const waveMoves = diff.components.changed.filter((row) => row.change.includes("wave")).length;
  const unchangedCount = diff.components.unchanged.length;
  const setLine = `The component set is ${diff.shape.componentSetIdentical ? "identical" : "different"} and the declared deployment order is ${diff.shape.deploymentOrderIdentical ? "identical" : "different"}.`;
  const movedLine = `${versionMoves} components changed the chart version they pull, and ${waveMoves} changed the wave they deploy in.`;
  const unchangedLine = unchangedCount === 1
    ? `One of the ${diff.components.compared} rendered Applications is unchanged in both version and wave.`
    : `${unchangedCount} of the ${diff.components.compared} rendered Applications are unchanged in both version and wave.`;
  const waveLine = `The distinct wave count fell from ${diff.shape.distinctWavesBefore} to ${diff.shape.distinctWavesAfter} while the number of Applications stayed the same.`;

  return `# What changed between the two retained AICR versions

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-version-diff:generate\` and checked by
\`npm run aicr-version-diff:verify\`. Every number here is computed from the
committed bytes of both entries, so this record cannot drift from the entries
it describes.

The catalog retains ${diff.from.version} and ${diff.to.version} side by side, at
\`${diff.from.entry}\` and \`${diff.to.entry}\`. Both were generated from the
same criteria with the same generation inputs, so what differs between them is
upstream's doing rather than ours.

## The shape did not change

| | ${diff.from.version} | ${diff.to.version} |
| --- | --- | --- |
| Components the recipe declares | ${diff.shape.componentsBefore} | ${diff.shape.componentsAfter} |
| Argo CD Applications rendered | ${diff.shape.applicationsBefore} | ${diff.shape.applicationsAfter} |
| Distinct sync-waves | ${diff.shape.distinctWavesBefore} | ${diff.shape.distinctWavesAfter} |

${setLine} Four minor versions moved the parts without moving the platform,
which is the useful thing to know before deciding whether to move a retained
entry forward.

## What moved

${movedLine}

| Component | What moved | ${diff.from.version} | ${diff.to.version} |
| --- | --- | --- | --- |
${rows.join("\n")}

${unchangedLine}

## The waves are the story

${waveLine} That is upstream moving from a strict
sequence to parallel deployment of independent components, and it is why the
ordering-parity lane now checks the recipe's dependency edges rather than a
linearization. A rule that only understood total orders would have refused
this entry for doing what upstream now intends.

Everything here runs offline against committed bytes. No cluster, no
organization, and no network takes part, and no GPU workload was involved in
producing either entry.
`;
}
