#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  repoRoot,
} from "./lib/proof-common.mjs";
import {
  loadSourceCatalogImportRegistry,
  resolveSourceCatalogImports,
  validateSourceCatalogRecord,
} from "./lib/source-catalog-import.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--verify", "--self-test"].includes(mode), "use --verify or --self-test");

if (mode === "--self-test") {
  runSelfTest();
  console.log("verified source-catalog import refusal cases");
  process.exit(0);
}

JSON.parse(readFileSync(join(repoRoot, "schemas", "source-catalog-record.schema.json"), "utf8"));
const imports = resolveSourceCatalogImports();
for (const sourceCatalogImport of imports) {
  const baseRecordPath = join(
    repoRoot,
    "data",
    "base-variant-records",
    "records",
    `${sourceCatalogImport.baseVariantRecord}.yaml`,
  );
  const baseRecord = readYaml(baseRecordPath);
  check(
    stableJson(baseRecord.spec?.source?.selection)
      === stableJson(sourceCatalogImport.selection),
    `${sourceCatalogImport.id}: BaseVariantRecord does not retain the imported source selection`,
  );
  check(
    !Object.hasOwn(baseRecord.spec?.source ?? {}, "sourceVariant")
      && !Object.hasOwn(baseRecord.spec?.source ?? {}, "sourceCatalog"),
    `${sourceCatalogImport.id}: BaseVariantRecord still carries legacy AICR-only source fields`,
  );
  if (sourceCatalogImport.configHubUploadReceipt) {
    const receipt = readYaml(join(repoRoot, sourceCatalogImport.configHubUploadReceipt));
    check(
      receipt.kind === "ConfigHubUploadReceipt",
      `${sourceCatalogImport.id}: ConfigHub handoff record has the wrong kind`,
    );
    check(
      stableJson(receipt.spec?.source?.sourceCatalog)
        === stableJson(sourceCatalogImport.handoff),
      `${sourceCatalogImport.id}: ConfigHub handoff does not retain the provider source catalog`,
    );
    check(
      receipt.spec?.unit?.sourceObjectsMatched === true
        && receipt.spec?.provenanceBinding?.objectIdentitiesMatched === true,
      `${sourceCatalogImport.id}: ConfigHub handoff does not bind the imported selection to exact objects`,
    );
  }
  const renderedPage = readFileSync(join(repoRoot, "site", "try-aicr.html"), "utf8");
  for (const value of [
    sourceCatalogImport.selection.provider,
    sourceCatalogImport.selection.catalog.version,
    sourceCatalogImport.selection.catalog.digest,
    sourceCatalogImport.selection.name,
  ]) {
    check(
      renderedPage.includes(value),
      `${sourceCatalogImport.id}: rendered AICR page does not show ${value}`,
    );
  }
}

console.log(
  `verified ${imports.length} provider source-catalog import(s) through BaseVariantRecord and ConfigHub handoff`,
);

function runSelfTest() {
  const registry = loadSourceCatalogImportRegistry();
  const definition = registry.spec.imports[0];
  const source = readYaml(join(repoRoot, definition.sourceCatalogRecord));
  for (const [label, mutate] of [
    ["missing provider", (record) => { delete record.spec.provider.name; }],
    ["changed provider", (record) => { record.spec.provider.name = "Different provider"; }],
    ["missing catalog digest", (record) => { delete record.spec.catalog.digest; }],
    ["changed catalog digest", (record) => {
      record.spec.catalog.digest = `sha256:${"0".repeat(64)}`;
    }],
    ["missing selected source variant", (record) => { delete record.spec.selection.name; }],
    ["changed selected source variant", (record) => {
      record.spec.selection.name = "different-source-variant";
    }],
  ]) {
    const changed = structuredClone(source);
    mutate(changed);
    expectFailure(
      () => validateSourceCatalogRecord(changed, definition.expected, {
        recordPath: `${definition.sourceCatalogRecord} (${label})`,
      }),
      `${label} fixture unexpectedly passed`,
    );
  }
}

function expectFailure(fn, message) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  check(failed, message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${stableJson(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}
