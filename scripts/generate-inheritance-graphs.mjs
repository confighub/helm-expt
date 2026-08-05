#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";
import { catalogDerivedPath, recipeRoots } from "./lib/catalog-derived-views.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "edge-recovery");
const outputs = {
  csv: join(outputRoot, "edges.csv"),
  summary: join(outputRoot, "summary.md"),
};
const chartDirs = discoverCatalogSupportedRecipeDirs();

if (mode === "--generate") {
  const report = buildReport();
  for (const graph of report.graphs) writeYaml(join(repoRoot, graph.path), graph.document);
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote inheritance graphs for ${report.graphs.length} chart(s)`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const graph of report.graphs) {
    const path = join(repoRoot, graph.path);
    check(existsSync(path), `${graph.path} is missing; run npm run edges:generate`);
    check(readFileSync(path, "utf8") === `${toYamlStable(graph.document)}\n`, `${graph.path} is stale; run npm run edges:generate`);
  }
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run edges:generate`);
    check(readFileSync(path, "utf8") === report[name], `${relativeRepo(path)} is stale; run npm run edges:generate`);
  }
  console.log(`verified edge recovery for ${report.graphs.length} chart(s), ${report.rows.length} edge row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-inheritance-graphs.mjs --generate
  node scripts/generate-inheritance-graphs.mjs --verify`);
}

function buildReport() {
  const graphs = chartDirs.map(buildGraph);
  const rows = graphs.flatMap((graph) => graph.rows);
  return {
    graphs,
    rows,
    csv: toCsv(rows),
    summary: summary(graphs, rows),
  };
}

function discoverCatalogSupportedRecipeDirs() {
  const supported = recipeRoots()
    .map((root) => {
      const file = catalogDerivedPath(root, "catalog-status.yaml");
      const status = readYaml(file);
      return {
        file,
        chart: status.spec?.chart ?? "",
        version: status.spec?.version ?? "",
        status: status.spec?.status ?? "",
        recipeRel: relativeRepo(root),
      };
    })
    .filter((entry) => entry.status === "catalog-supported")
    .sort((a, b) => a.chart.localeCompare(b.chart) || a.version.localeCompare(b.version));
  check(supported.length > 0, "no catalog-supported recipes found");
  return supported.map((entry) => entry.recipeRel);
}

function buildGraph(recipeRel) {
  const recipeDir = join(repoRoot, recipeRel);
  const recipe = readYaml(join(recipeDir, "recipe.yaml"));
  const catalogStatus = readYaml(catalogDerivedPath(recipeDir, "catalog-status.yaml"));
  const chart = recipe.spec?.chart?.name ?? chartFromPath(recipeRel);
  const version = recipe.spec?.chart?.version ?? recipeRel.split("/").at(-1);
  const supportedVariants = catalogStatus.spec?.supportedVariants ?? [];
  const variants = listFiles(join(recipeDir, "variants"))
    .filter((file) => file.endsWith("/variant.yaml"))
    .map((file) => {
      const variant = readYaml(file);
      const name = variant.metadata?.name ?? basename(dirname(file));
      const valuesProfile = normalizeRel(recipeDir, dirname(file), variant.spec?.valuesProfile ?? `../../effective-values${name === "default" ? "" : `-${name}`}.yaml`);
      const values = readEffectiveValues(join(recipeDir, valuesProfile));
      return {
        name,
        path: relativeRepo(file),
        valuesProfile,
        values,
        flattened: flatten(values),
        targetFacts: variant.spec?.targetFacts ?? {},
        capabilityProfile: variant.spec?.capabilityProfile ?? {},
      };
    })
    .sort((a, b) => variantRank(a.name, supportedVariants) - variantRank(b.name, supportedVariants) || a.name.localeCompare(b.name));

  const base = variants.find((variant) => variant.name === supportedVariants[0])
    ?? variants.find((variant) => variant.name === "default")
    ?? variants[0];
  const valueSourceMapPath = join(recipeDir, "value-source-map.yaml");
  const valueSourceMap = existsSync(valueSourceMapPath) ? readYaml(valueSourceMapPath) : null;
  const fieldReachability = (valueSourceMap?.spec?.entries ?? []).map((entry) => ({
    valuePath: entry.valuePath,
    source: entry.source,
    renderedFieldCount: (entry.renderedFields ?? []).length,
    renderedFields: (entry.renderedFields ?? []).map((field) => `${field.object}:${field.field}`),
    immutableFieldRisk: entry.immutableFieldRisk ?? false,
    rolloutImpact: entry.rolloutImpact ?? "",
  }));

  const generatedFacts = generatedFactEdges(recipeDir, valueSourceMap);
  const targetFactEdges = variants.flatMap((variant) => targetFactEdgesForVariant(variant));
  const edges = [];
  for (const variant of variants) {
    const comparison = compareVariant(base, variant);
    edges.push({
      from: base.name,
      to: variant.name,
      type: variant.name === base.name ? "base-self" : "inherits-with-overrides",
      inheritedValuePaths: comparison.inherited,
      overriddenValuePaths: comparison.overridden,
      addedValuePaths: comparison.added,
      removedValuePaths: comparison.removed,
      valueSourceMapCoverage: fieldReachability.filter((entry) => comparison.allTouched.has(entry.valuePath)).map((entry) => entry.valuePath),
    });
  }

  const document = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "InheritanceGraph",
    metadata: {
      name: `${chart.replaceAll("/", "-")}-${version}`,
    },
    spec: {
      chart,
      version,
      recipe: "recipe.yaml",
      baseVariant: base.name,
      variants: variants.map((variant) => ({
        name: variant.name,
        variant: relativeFrom(recipeDir, join(repoRoot, variant.path)),
        valuesProfile: variant.valuesProfile,
      })),
      edges,
      targetFactEdges,
      generatedFactEdges: generatedFacts,
      fieldReachability,
      notes: [
        "This graph is recovered from checked-in recipe artifacts.",
        "It is a desired-state graph fragment, not a live-cluster observation.",
        "Field reachability is limited to charts that have value-source-map.yaml coverage.",
      ],
    },
  };
  const rows = [
    ...edges.map((edge) => ({
      chart: `${chart}@${version}`,
      edge_type: edge.type,
      from_variant: edge.from,
      to_variant: edge.to,
      inherited_paths: edge.inheritedValuePaths.length,
      overridden_paths: edge.overriddenValuePaths.join(";"),
      added_paths: edge.addedValuePaths.join(";"),
      removed_paths: edge.removedValuePaths.join(";"),
      field_reachability_paths: edge.valueSourceMapCoverage.join(";"),
      target_fact_edges: targetFactEdges.filter((item) => item.variant === edge.to).length,
      generated_fact_edges: generatedFacts.filter((item) => item.variant === edge.to || item.variant === "default").length,
      graph: relativeRepo(catalogDerivedPath(recipeDir, "inheritance-graph.yaml")),
    })),
    ...targetFactEdges.map((edge) => ({
      chart: `${chart}@${version}`,
      edge_type: "target-fact",
      from_variant: "",
      to_variant: edge.variant,
      inherited_paths: "",
      overridden_paths: "",
      added_paths: edge.fact,
      removed_paths: "",
      field_reachability_paths: "",
      target_fact_edges: 1,
      generated_fact_edges: 0,
      graph: relativeRepo(catalogDerivedPath(recipeDir, "inheritance-graph.yaml")),
    })),
    ...generatedFacts.map((edge) => ({
      chart: `${chart}@${version}`,
      edge_type: "generated-fact",
      from_variant: "",
      to_variant: edge.variant,
      inherited_paths: "",
      overridden_paths: "",
      added_paths: edge.valuePath,
      removed_paths: "",
      field_reachability_paths: edge.renderedFields.join(";"),
      target_fact_edges: 0,
      generated_fact_edges: 1,
      graph: relativeRepo(catalogDerivedPath(recipeDir, "inheritance-graph.yaml")),
    })),
  ];
  return {
    path: relativeRepo(catalogDerivedPath(recipeDir, "inheritance-graph.yaml")),
    document,
    rows,
  };
}

function readEffectiveValues(path) {
  const doc = readYaml(path);
  return doc.spec?.values ?? {};
}

function compareVariant(base, variant) {
  const inherited = [];
  const overridden = [];
  const added = [];
  const removed = [];
  const allPaths = [...new Set([...Object.keys(base.flattened), ...Object.keys(variant.flattened)])].sort();
  for (const path of allPaths) {
    const baseHas = Object.hasOwn(base.flattened, path);
    const variantHas = Object.hasOwn(variant.flattened, path);
    if (baseHas && variantHas && sameValue(base.flattened[path], variant.flattened[path])) inherited.push(path);
    else if (baseHas && variantHas) overridden.push(path);
    else if (!baseHas && variantHas) added.push(path);
    else if (baseHas && !variantHas) removed.push(path);
  }
  return { inherited, overridden, added, removed, allTouched: new Set([...overridden, ...added, ...removed]) };
}

function flatten(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return prefix ? { [prefix]: value } : {};
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) Object.assign(result, flatten(child, path));
    else result[path] = child;
  }
  return result;
}

function targetFactEdgesForVariant(variant) {
  const edges = [];
  for (const secret of variant.targetFacts?.requiredSecrets ?? []) {
    edges.push({
      variant: variant.name,
      kind: "Secret",
      namespace: secret.namespace ?? "",
      name: secret.name ?? "",
      keys: secret.keys ?? [],
      fact: `Secret/${secret.namespace ?? ""}/${secret.name ?? ""}:${(secret.keys ?? []).join("+")}`,
      purpose: secret.purpose ?? "",
    });
  }
  for (const crd of variant.targetFacts?.requiredCRDs ?? []) {
    edges.push({
      variant: variant.name,
      kind: "CustomResourceDefinition",
      namespace: "",
      name: crd.name ?? "",
      keys: [],
      fact: `CRD/${crd.name ?? ""}`,
      purpose: crd.purpose ?? "",
      sourceVariant: crd.sourceVariant ?? "",
      deliveryLanes: crd.deliveryLanes ?? [],
    });
  }
  return edges;
}

function generatedFactEdges(recipeDir, valueSourceMap) {
  const entries = valueSourceMap?.spec?.entries ?? [];
  const mapped = entries
    .filter((entry) => String(entry.source ?? "").includes("generated-fact"))
    .map((entry) => ({
      variant: "default",
      valuePath: entry.valuePath,
      source: entry.source,
      effectiveValueDigest: entry.effectiveValueDigest ?? "",
      renderedFields: (entry.renderedFields ?? []).map((field) => `${field.object}:${field.field}`),
      relatedFacts: entry.relatedFacts ?? [],
    }));
  return mapped.length > 0 ? mapped : generatedFactReceipts(recipeDir);
}

function generatedFactReceipts(recipeDir) {
  return listFiles(recipeDir)
    .filter((file) => file.endsWith("generated-fact-receipt.yaml"))
    .map((file) => ({
      variant: file.split("/revisions/")[1]?.split("/")[0] ?? "",
      valuePath: "",
      source: "generated-fact-receipt",
      effectiveValueDigest: "",
      renderedFields: [],
      relatedFacts: [relativeRepo(file).replace(`${relativeRepo(recipeDir)}/`, "")],
    }));
}

function normalizeRel(recipeDir, fromDir, rel) {
  if (!rel) return rel;
  const resolved = join(fromDir, rel);
  return relativeRepo(resolved).replace(`${relativeRepo(recipeDir)}/`, "");
}

function relativeFrom(fromDir, toPath) {
  return relativeRepo(toPath).replace(`${relativeRepo(fromDir)}/`, "");
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function variantRank(name, supportedVariants = []) {
  const supportedIndex = supportedVariants.indexOf(name);
  if (supportedIndex >= 0) return supportedIndex;
  if (name === "default") return supportedVariants.length;
  return supportedVariants.length + 1;
}

function chartFromPath(recipeRel) {
  const parts = recipeRel.split("/");
  return `${parts[1]}/${parts[2]}`;
}

function summary(graphs, rows) {
  const targetFacts = rows.filter((row) => row.edge_type === "target-fact").length;
  const generatedFacts = rows.filter((row) => row.edge_type === "generated-fact").length;
  const withTargetFacts = graphs.filter((graph) => graph.document.spec.targetFactEdges.length > 0).length;
  const withFieldReachability = graphs.filter((graph) => graph.document.spec.fieldReachability.length > 0).length;
  return `# Edge Recovery

This generated report records graph fragments recovered from Helm-derived recipe
artifacts. The goal is to show that helm-expt can preserve more than flat YAML:
base variants, overrides, generated facts, target facts, and field reachability
can become desired-state graph input.

## Current Scope

~~~text
charts with inheritance graphs: ${graphs.length}
edge rows:                      ${rows.length}
target-fact edges:              ${targetFacts}
generated-fact edges:           ${generatedFacts}
charts with target facts:        ${withTargetFacts}
charts with field reachability:  ${withFieldReachability}
~~~

## Catalog Graph Coverage

| Chart | Graph | Why it matters |
| --- | --- | --- |
${graphs.map((graph) => {
  const chart = graph.document.spec.chart;
  const role = graphRole(graph);
  return `| ${chart}@${graph.document.spec.version} | [${graph.path.replace("recipes/", "../../recipes/")}](../../${graph.path}) | ${role} |`;
}).join("\n")}

## Regenerate

~~~sh
npm run edges:generate
npm run edges:verify
~~~
`;
}

function graphRole(graph) {
  const chart = graph.document.spec.chart;
  const targetFacts = graph.document.spec.targetFactEdges.length;
  const generatedFacts = graph.document.spec.generatedFactEdges.length;
  const fieldReachability = graph.document.spec.fieldReachability.length;
  if (chart === "bitnami/redis") return "Teaching chart for generated facts, target facts, and secret variants.";
  if (chart === "prometheus-community/kube-prometheus-stack") return "Main hard chart for high fanout, CRDs, webhooks, dependencies, and large object count.";
  const features = [];
  if (targetFacts > 0) features.push(`${targetFacts} target fact edge${targetFacts === 1 ? "" : "s"}`);
  if (generatedFacts > 0) features.push(`${generatedFacts} generated fact edge${generatedFacts === 1 ? "" : "s"}`);
  if (fieldReachability > 0) features.push("field reachability");
  if (features.length === 0) return "Catalog-supported chart with base and variant inheritance captured from recipe artifacts.";
  return `Catalog-supported chart with ${features.join(", ")} captured from recipe artifacts.`;
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toYamlStable(value) {
  return stringifyYaml(value);
}

function stringifyYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value.map((item) => {
      if (item && typeof item === "object") return `${pad}-\n${stringifyYaml(item, indent + 2)}`;
      return `${pad}- ${stringifyYaml(item, 0)}`;
    }).join("\n");
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return `${pad}{}`;
  return entries.map(([key, item]) => {
    if (item && typeof item === "object") return `${pad}${key}:\n${stringifyYaml(item, indent + 2)}`;
    return `${pad}${key}: ${stringifyYaml(item, 0)}`;
  }).join("\n");
}
