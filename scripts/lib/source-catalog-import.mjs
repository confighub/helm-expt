import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  repoRoot,
  sha256File,
} from "./proof-common.mjs";

export const sourceCatalogImportRegistryPath =
  "config-catalog/source-catalog-imports.yaml";

export function loadSourceCatalogImportRegistry(root = repoRoot) {
  const path = join(root, sourceCatalogImportRegistryPath);
  check(existsSync(path), `${sourceCatalogImportRegistryPath} is missing`);
  const registry = readYaml(path);
  check(
    registry.apiVersion === "catalog.confighub.com/v1alpha1"
      && registry.kind === "SourceCatalogImportRegistry",
    `${sourceCatalogImportRegistryPath} has the wrong type`,
  );
  const imports = registry.spec?.imports ?? [];
  check(Array.isArray(imports) && imports.length > 0, "source catalog import registry is empty");
  const ids = new Set();
  const baseRecords = new Set();
  for (const definition of imports) {
    check(definition.id && !ids.has(definition.id), "source catalog import id is missing or repeated");
    check(
      definition.baseVariantRecord && !baseRecords.has(definition.baseVariantRecord),
      `${definition.id}: base-variant record is missing or repeated`,
    );
    check(definition.sourceType, `${definition.id}: source type is missing`);
    check(definition.sourceCatalogRecord, `${definition.id}: source catalog record is missing`);
    check(
      definition.expected?.providerName
        && definition.expected?.catalogVersion
        && /^sha256:[a-f0-9]{64}$/.test(definition.expected?.catalogDigest ?? "")
        && definition.expected?.selectedSourceVariant,
      `${definition.id}: expected provider, catalog version, catalog digest, or source variant is missing`,
    );
    ids.add(definition.id);
    baseRecords.add(definition.baseVariantRecord);
  }
  return registry;
}

export function resolveSourceCatalogImports(root = repoRoot) {
  const registry = loadSourceCatalogImportRegistry(root);
  return registry.spec.imports.map((definition) =>
    resolveSourceCatalogImport(definition, root));
}

export function resolveSourceCatalogImport(definition, root = repoRoot) {
  const recordPath = join(root, definition.sourceCatalogRecord);
  check(existsSync(recordPath), `${definition.sourceCatalogRecord} is missing`);
  const record = readYaml(recordPath);
  validateSourceCatalogRecord(record, definition.expected, {
    root,
    recordPath: definition.sourceCatalogRecord,
  });
  const selection = normalizedSourceSelection(record, definition.sourceCatalogRecord);
  return {
    ...definition,
    record,
    recordSha256: `sha256:${sha256File(recordPath)}`,
    selection,
    handoff: {
      record: definition.sourceCatalogRecord,
      recordSha256: `sha256:${sha256File(recordPath)}`,
      provider: {
        name: record.spec.provider.name,
        role: record.spec.provider.role,
        identity: record.spec.provider.identity,
      },
      catalog: { ...selection.catalog },
      selection: {
        name: selection.name,
        kind: selection.kind,
        dimensions: { ...selection.dimensions },
        record: { ...selection.selectionRecord },
        evidence: {
          status: selection.evidence.status,
          records: [...selection.evidence.records],
          references: [...selection.evidence.references],
        },
      },
    },
  };
}

export function validateSourceCatalogRecord(
  record,
  expected,
  { root = repoRoot, recordPath = "source catalog record" } = {},
) {
  check(
    record?.apiVersion === "catalog.confighub.com/v1alpha1"
      && record?.kind === "SourceCatalogRecord",
    `${recordPath} has the wrong type`,
  );
  const provider = record.spec?.provider ?? {};
  check(
    provider.name && provider.role === "source-catalog-curator" && provider.identity,
    `${recordPath} does not identify its provider and curation role`,
  );
  const catalog = record.spec?.catalog ?? {};
  check(
    catalog.name
      && catalog.format
      && catalog.version
      && catalog.record
      && /^sha256:[a-f0-9]{64}$/.test(catalog.digest ?? "")
      && catalog.digestRole === "source-catalog-content",
    `${recordPath} does not identify exact catalog content`,
  );
  const catalogPath = join(root, catalog.record);
  check(existsSync(catalogPath), `${recordPath} points at missing catalog content ${catalog.record}`);
  check(
    catalog.digest === `sha256:${sha256File(catalogPath)}`,
    `${recordPath} catalog digest does not match ${catalog.record}`,
  );
  const selection = record.spec?.selection ?? {};
  check(
    selection.name
      && selection.kind === "source-variant"
      && selection.dimensions
      && Object.keys(selection.dimensions).length > 0,
    `${recordPath} does not identify the selected source variant and dimensions`,
  );
  check(
    selection.record?.path
      && /^sha256:[a-f0-9]{64}$/.test(selection.record?.digest ?? "")
      && selection.record?.digestRole === "selected-source-variant",
    `${recordPath} does not identify the selected source-variant input`,
  );
  const selectionPath = join(root, selection.record.path);
  check(
    existsSync(selectionPath),
    `${recordPath} points at missing selected source variant ${selection.record.path}`,
  );
  check(
    selection.record.digest === `sha256:${sha256File(selectionPath)}`,
    `${recordPath} selected source-variant digest does not match ${selection.record.path}`,
  );
  check(
    selection.evidence
      && ["provider-linked", "provider-pending", "not-recorded"].includes(selection.evidence.status)
      && Array.isArray(selection.evidence.records)
      && Array.isArray(selection.evidence.references),
    `${recordPath} does not state the provider evidence for the selected source variant`,
  );
  for (const evidencePath of selection.evidence.records) {
    check(existsSync(join(root, evidencePath)), `${recordPath} points at missing evidence ${evidencePath}`);
  }
  check(
    record.status?.catalogDigestVerified === true
      && record.status?.selectedVariantReproducible === true
      && record.status?.runtimeProven === false,
    `${recordPath} overstates or omits its imported-source status`,
  );
  if (expected) {
    check(provider.name === expected.providerName, `${recordPath} provider changed`);
    check(catalog.version === expected.catalogVersion, `${recordPath} catalog version changed`);
    check(catalog.digest === expected.catalogDigest, `${recordPath} catalog digest changed`);
    check(
      selection.name === expected.selectedSourceVariant,
      `${recordPath} selected source variant changed`,
    );
  }
  return record;
}

export function normalizedSourceSelection(record, recordPath) {
  const provider = record.spec.provider;
  const catalog = record.spec.catalog;
  const selection = record.spec.selection;
  return {
    name: selection.name,
    kind: "source-variant",
    provider: provider.name,
    providerRole: provider.role,
    providerIdentity: provider.identity,
    record: recordPath,
    catalog: {
      name: catalog.name,
      version: catalog.version,
      digest: catalog.digest,
      digestRole: catalog.digestRole,
      record: catalog.record,
    },
    dimensions: { ...selection.dimensions },
    selectionRecord: { ...selection.record },
    evidence: {
      status: selection.evidence.status,
      records: [...selection.evidence.records],
      references: [...selection.evidence.references],
    },
  };
}
