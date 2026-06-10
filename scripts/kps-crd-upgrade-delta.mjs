// CRD upgrade delta receipt for kube-prometheus-stack.
//
// Compares the CustomResourceDefinitions in two committed rendered object
// sets (default base) and writes a render-level delta receipt: CRDs added or
// removed, version entries and served/storage changes, schema property paths
// added or removed, and conversion strategy changes.
//
// Claim boundary: this is desired-state analysis of committed renders. It
// proves what a chart upgrade would CHANGE in CRD desired state. It does not
// prove runtime upgrade behavior, controller compatibility, or stored-object
// migration; those need live receipts and stay explicitly not-claimed.
//
//   node scripts/kps-crd-upgrade-delta.mjs            # write the receipt
//   node scripts/kps-crd-upgrade-delta.mjs --verify   # recompute and compare
//
// No npm alias on purpose; package.json is owned by another workstream.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, parseDocs, repoRoot, toYaml, write } from "./lib/proof-common.mjs";

const FROM_VERSION = "85.3.3";
const TO_VERSION = "86.1.0";
const BASE = "default";
const EXAMPLE_CAP = 8;

const receiptPath = join(
  repoRoot,
  "data/serious-chart-reviews",
  `kps-crd-upgrade-delta-${FROM_VERSION}-to-${TO_VERSION}.yaml`,
);

function renderPath(version) {
  return join(
    repoRoot,
    "recipes/prometheus-community/kube-prometheus-stack",
    version,
    "revisions",
    BASE,
    "r001/rendered/release-objects.yaml",
  );
}

function loadCrds(version) {
  const docs = parseDocs(readFileSync(renderPath(version), "utf8"));
  const crds = new Map();
  for (const doc of docs) {
    if (doc && doc.kind === "CustomResourceDefinition") crds.set(doc.metadata.name, doc);
  }
  return crds;
}

function schemaPaths(node, prefix, out) {
  if (!node || typeof node !== "object") return;
  const properties = node.properties;
  if (properties && typeof properties === "object") {
    for (const key of Object.keys(properties)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out.add(path);
      schemaPaths(properties[key], path, out);
    }
  }
  if (node.items) schemaPaths(node.items, prefix ? `${prefix}[]` : "[]", out);
}

function versionEntry(crd, name) {
  return (crd.spec.versions ?? []).find((entry) => entry.name === name);
}

function diffCrd(name, fromCrd, toCrd) {
  const fromVersions = (fromCrd.spec.versions ?? []).map((entry) => entry.name);
  const toVersions = (toCrd.spec.versions ?? []).map((entry) => entry.name);
  const versionsAdded = toVersions.filter((version) => !fromVersions.includes(version));
  const versionsRemoved = fromVersions.filter((version) => !toVersions.includes(version));

  const servedStorageChanges = [];
  const schemaChanges = [];
  for (const version of toVersions.filter((entry) => fromVersions.includes(entry))) {
    const fromEntry = versionEntry(fromCrd, version);
    const toEntry = versionEntry(toCrd, version);
    if (fromEntry.served !== toEntry.served || fromEntry.storage !== toEntry.storage) {
      servedStorageChanges.push(
        `${version}: served ${fromEntry.served}->${toEntry.served}, storage ${fromEntry.storage}->${toEntry.storage}`,
      );
    }
    const fromPaths = new Set();
    const toPaths = new Set();
    schemaPaths(fromEntry.schema?.openAPIV3Schema, "", fromPaths);
    schemaPaths(toEntry.schema?.openAPIV3Schema, "", toPaths);
    const added = [...toPaths].filter((path) => !fromPaths.has(path)).sort();
    const removed = [...fromPaths].filter((path) => !toPaths.has(path)).sort();
    if (added.length || removed.length) {
      schemaChanges.push({
        version,
        propertyPathsAdded: added.length,
        propertyPathsRemoved: removed.length,
        addedExamples: added.slice(0, EXAMPLE_CAP),
        removedExamples: removed.slice(0, EXAMPLE_CAP),
      });
    }
  }

  const fromConversion = fromCrd.spec.conversion?.strategy ?? "None";
  const toConversion = toCrd.spec.conversion?.strategy ?? "None";

  const unchanged =
    !versionsAdded.length &&
    !versionsRemoved.length &&
    !servedStorageChanges.length &&
    !schemaChanges.length &&
    fromConversion === toConversion;

  return {
    crd: name,
    status: unchanged ? "unchanged" : "changed",
    versionsAdded,
    versionsRemoved,
    servedStorageChanges,
    conversionStrategy: fromConversion === toConversion ? fromConversion : `${fromConversion} -> ${toConversion}`,
    schemaChanges,
  };
}

function buildReceipt() {
  const fromCrds = loadCrds(FROM_VERSION);
  const toCrds = loadCrds(TO_VERSION);
  const names = [...new Set([...fromCrds.keys(), ...toCrds.keys()])].sort();

  const crdsAdded = names.filter((name) => !fromCrds.has(name));
  const crdsRemoved = names.filter((name) => !toCrds.has(name));
  const perCrd = names
    .filter((name) => fromCrds.has(name) && toCrds.has(name))
    .map((name) => diffCrd(name, fromCrds.get(name), toCrds.get(name)));
  const changed = perCrd.filter((entry) => entry.status === "changed");

  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "CrdUpgradeDeltaReceipt",
    metadata: {
      name: `kps-crd-upgrade-delta-${FROM_VERSION}-to-${TO_VERSION}`,
    },
    spec: {
      chart: "prometheus-community/kube-prometheus-stack",
      base: BASE,
      fromVersion: FROM_VERSION,
      toVersion: TO_VERSION,
      basis: "committed-render-crd-diff",
      inputs: [
        `recipes/prometheus-community/kube-prometheus-stack/${FROM_VERSION}/revisions/${BASE}/r001/rendered/release-objects.yaml`,
        `recipes/prometheus-community/kube-prometheus-stack/${TO_VERSION}/revisions/${BASE}/r001/rendered/release-objects.yaml`,
      ],
      summary: {
        crdsInFrom: fromCrds.size,
        crdsInTo: toCrds.size,
        crdsAdded,
        crdsRemoved,
        crdsChanged: changed.length,
        crdsUnchanged: perCrd.length - changed.length,
      },
      perCrd,
      claim:
        "the CRD desired-state delta between the two committed renders is exactly what this receipt records",
      notClaimed: [
        "runtime upgrade behavior (no live upgrade was run)",
        "operator/controller compatibility with the new schemas",
        "stored-object migration or conversion at runtime",
        "CRD behavior under any other base, values profile, or capability profile",
      ],
      regenerate: "node scripts/kps-crd-upgrade-delta.mjs",
      verify: "node scripts/kps-crd-upgrade-delta.mjs --verify",
    },
  };
}

function render(receipt) {
  return `# Generated by scripts/kps-crd-upgrade-delta.mjs. Do not edit by hand.\n${toYaml(receipt)}`;
}

const mode = process.argv[2] ?? "--generate";
if (mode === "--generate") {
  const receipt = buildReceipt();
  write(receiptPath, render(receipt));
  console.log(
    `wrote ${receiptPath.replace(`${repoRoot}/`, "")} (${receipt.spec.summary.crdsChanged} changed, ${receipt.spec.summary.crdsUnchanged} unchanged CRDs)`,
  );
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${receiptPath} is missing; run node scripts/kps-crd-upgrade-delta.mjs`);
  const expected = render(buildReceipt());
  check(
    readFileSync(receiptPath, "utf8") === expected,
    `${receiptPath} is stale; run node scripts/kps-crd-upgrade-delta.mjs`,
  );
  console.log("verified kps crd upgrade delta receipt");
} else {
  console.error(`unknown mode ${mode}; use --generate or --verify`);
  process.exit(1);
}
