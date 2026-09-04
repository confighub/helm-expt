// Stage A.1 of the eks-inf replica experiment: prove, from committed evidence
// alone, that every component of the hand-built EKS inference stack resolves to
// inputs the Config Workshop Catalog already retains.
//
// The driver reads three committed sources and writes two derived reports:
//   in:  data/eks-inf-replica/source/components-manifest.yaml  (pinned snapshot)
//        data/certified-bundles/receipts.csv                   (bundle registry)
//        data/certified-bundles/receipts/**/receipt.yaml       (per-bundle facts)
//   out: data/eks-inf-replica/closure.csv
//        data/eks-inf-replica/summary.md
//
// The join is derived, not asserted: a rendered stack component and a catalog
// variant match when they cite the same recipes/**/source-lock.yaml evidence.
// The run is deterministic and offline. It never pulls OCI and never renders.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const manifestPath = join(repoRoot, "data", "eks-inf-replica", "source", "components-manifest.yaml");
const registryPath = join(repoRoot, "data", "certified-bundles", "receipts.csv");
const stackReceiptsRoot = join(repoRoot, "data", "certified-bundles", "receipts", "eks-inference");
const catalogReceiptsRoot = join(repoRoot, "data", "certified-bundles", "receipts", "catalog");
const closureCsvPath = join(repoRoot, "data", "eks-inf-replica", "closure.csv");
const summaryPath = join(repoRoot, "data", "eks-inf-replica", "summary.md");

const manifest = readYaml(manifestPath);
const components = manifest.components;
check(Array.isArray(components) && components.length === 8, "the pinned manifest must list exactly eight components");

const registryRows = readFileSync(registryPath, "utf8").trim().split("\n").slice(1).map((line) => {
  const cells = line.split(",");
  check(cells.length === 13, `unexpected column count in receipts.csv row: ${line.slice(0, 60)}`);
  const [producer, name, sourceKind, contentsKind, chart, chartVersion, digest, fileCount, lane, status, ociReference] = cells;
  return { producer, name, sourceKind, contentsKind, chart, chartVersion, digest, fileCount: Number(fileCount), lane, status, ociReference };
});

const stackRows = new Map(registryRows.filter((row) => row.producer === "eks-inference").map((row) => [row.name.replace(/^eks-inference-/, ""), row]));
check(stackRows.size === 8, "the registry must carry exactly eight eks-inference stack bundles");

const sourceLocksOf = (receipt) => (receipt.spec.source.evidence ?? []).filter((path) => /^recipes\/.*\/source-lock\.yaml$/.test(path));

const catalogReceipts = readdirSync(catalogReceiptsRoot).map((dir) => {
  const receipt = readYaml(join(catalogReceiptsRoot, dir, "receipt.yaml"));
  return { dir, receipt, sourceLocks: sourceLocksOf(receipt) };
});

const rows = [];
for (const component of [...components].sort((a, b) => a.plane.localeCompare(b.plane) || a.order - b.order)) {
  const registryRow = stackRows.get(component.name);
  check(Boolean(registryRow), `no retained stack bundle for component ${component.name}`);
  const receiptPath = join(stackReceiptsRoot, component.name, "receipt.yaml");
  check(existsSync(receiptPath), `missing stack receipt for ${component.name}`);
  const receipt = readYaml(receiptPath);
  const digest = receipt.spec.bundle.manifestDigest;
  check(digest === registryRow.digest, `digest mismatch between registry and receipt for ${component.name}`);

  const rendered = registryRow.contentsKind === "rendered-config";
  let supplyMode;
  let catalogInputs = [];
  let comparisonMethod;
  if (rendered) {
    const locks = sourceLocksOf(receipt);
    check(locks.length > 0, `rendered component ${component.name} cites no source-lock evidence`);
    catalogInputs = catalogReceipts.filter((candidate) =>
      candidate.dir.endsWith("-eks-inference") && candidate.sourceLocks.some((lock) => locks.includes(lock)));
    check(catalogInputs.length > 0, `no eks-inference catalog variant shares a source lock with ${component.name}`);
    supplyMode = "rebuild-from-catalog";
    comparisonMethod = "object-set comparison: render the catalog variant inputs, pull the stack bundle, and compare parsed objects; file layouts differ by design";
  } else {
    supplyMode = "select-by-digest";
    comparisonMethod = "digest equality: the retained bundle is the source of record, so selecting it reproduces it exactly";
  }
  rows.push({
    name: component.name,
    plane: component.plane,
    order: component.order,
    render: component.render,
    digest,
    ociReference: registryRow.ociReference,
    supplyMode,
    catalogInputs: catalogInputs.map((input) => input.receipt.metadata.name),
    catalogInputDigests: catalogInputs.map((input) => input.receipt.spec.bundle.manifestDigest ?? input.receipt.spec.bundle.layerDigest ?? "committed-files"),
    comparisonMethod,
  });
}

const ackRow = rows.find((row) => row.name === "ack-controllers");
check(ackRow.catalogInputs.length === 3, "ack-controllers must resolve to the three ACK controller chart variants");
const renderedRows = rows.filter((row) => row.supplyMode === "rebuild-from-catalog");
const literalRows = rows.filter((row) => row.supplyMode === "select-by-digest");
check(renderedRows.length === 3 && literalRows.length === 5, "the stack must split into three rendered and five literal components");

const csvHeader = "component,plane,order,render,stack_bundle_digest,stack_oci_reference,supply_mode,catalog_inputs,comparison_method";
const csvLines = rows.map((row) => [
  row.name, row.plane, row.order, row.render, row.digest, row.ociReference, row.supplyMode,
  row.catalogInputs.join(" + ") || "retained stack bundle",
  row.comparisonMethod.split(":")[0],
].join(","));
write(closureCsvPath, `${csvHeader}\n${csvLines.join("\n")}\n`);

const sourceCommit = readFileSync(manifestPath, "utf8").match(/^# Commit: (\S+)/m)?.[1] ?? "unknown";
const tableRows = rows.map((row) => `| ${row.name} | ${row.plane} | ${row.order} | ${row.supplyMode} | ${row.catalogInputs.join(", ") || "the retained stack bundle"} | \`${row.digest.slice(0, 19)}\` |`);
write(summaryPath, `# Stage A.1: the closure map for the eks-inf replica

<!-- Generated by scripts/generate-eks-inf-replica-closure.mjs. Do not edit by hand. -->

This report answers one question from committed evidence alone. Can the Config Workshop Catalog supply every component of the hand-built EKS inference stack? The answer is yes for all eight components.

The stack manifest is pinned at commit \`${sourceCommit.slice(0, 12)}\` of the producer repository. Each rendered component joins its catalog inputs through a shared source lock, so the mapping is derived rather than asserted.

| Component | Plane | Order | Supply | Catalog inputs | Stack digest |
| --- | --- | ---: | --- | --- | --- |
${tableRows.join("\n")}

## What this run proves

- All eight stack components resolve to retained, digest-addressed supply. Three rebuild from certified catalog chart variants, and five select the retained literal bundles by digest.
- Every rendered component has a certified \`eks-inference\` catalog variant carrying the producer's reviewed values. The join key is the shared \`source-lock.yaml\` evidence, checked file by file.
- The run is offline and deterministic. It reads committed receipts only.

## What this run does not prove

- No objects were rendered, pulled, or compared. File-level and object-level parity between a catalog rebuild and the retained stack bundles is Stage A.2.
- Nothing was loaded into ConfigHub, and no cluster or cloud account was touched.
- A certified component is not a certified composition. The whole-stack verdict is Stage B.

The staged plan lives in [docs/planning/eks-inf-replica-plan.md](../../docs/planning/eks-inf-replica-plan.md).
`);

console.log(`closure map written for ${rows.length} component(s): ${renderedRows.length} rebuild-from-catalog, ${literalRows.length} select-by-digest`);
