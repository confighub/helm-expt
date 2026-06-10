#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, listFiles, parseDocs, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "blast-radius-accuracy");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  cases: join(outputRoot, "cases.csv"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.summary, report.summary);
  write(outputs.cases, report.csv);
  console.log(`wrote blast-radius accuracy -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run blast-radius:accuracy`);
    check(readFileSync(path, "utf8") === report[name === "cases" ? "csv" : name], `${relativeRepo(path)} is stale; run npm run blast-radius:accuracy`);
  }
  console.log(`verified blast-radius accuracy for ${report.measured.length} measured case(s), ${report.unmeasured.length} unmeasured value-source row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-blast-radius-accuracy.mjs --generate
  node scripts/generate-blast-radius-accuracy.mjs --verify`);
}

function buildReport() {
  const measured = [measureKubePrometheusNoCrds()];
  const measuredKeys = new Set(measured.map((row) => `${row.chart}@${row.version}|${row.value_path}`));
  const unmeasured = valueSourceEntries()
    .filter((entry) => !measuredKeys.has(`${entry.chart}@${entry.version}|${entry.value_path}`))
    .map((entry) => ({
      chart: entry.chart,
      version: entry.version,
      case_id: entry.id,
      value_path: entry.value_path,
      measurement_type: "not-measured-yet",
      from_variant: "",
      to_variant: "",
      predicted_objects: entry.predicted_objects,
      actual_removed_objects: "",
      actual_added_objects: "",
      actual_changed_objects: "",
      false_negatives: "",
      false_positives: "",
      precision: "",
      recall: "",
      result: "todo",
      evidence: entry.evidence,
      limit: "No actual rerender-diff score has been recorded for this value path yet.",
    }));
  const rows = [...measured, ...unmeasured].sort((a, b) => `${a.chart}@${a.version}/${a.value_path}/${a.case_id}`.localeCompare(`${b.chart}@${b.version}/${b.value_path}/${b.case_id}`));
  for (const row of rows) {
    for (const path of row.evidence.split("; ").filter(Boolean)) {
      check(existsSync(join(repoRoot, path)), `blast-radius row ${row.case_id} points at missing evidence: ${path}`);
    }
  }
  return {
    measured,
    unmeasured,
    rows,
    csv: toCsv(rows),
    summary: summary({ measured, unmeasured, rows }),
  };
}

function measureKubePrometheusNoCrds() {
  const chart = "prometheus-community/kube-prometheus-stack";
  const version = "85.3.3";
  const recipeRel = `recipes/prometheus-community/kube-prometheus-stack/${version}`;
  const recipeDir = join(repoRoot, recipeRel);
  const valueSourceMapPath = join(recipeDir, "value-source-map.yaml");
  const valueSourceMap = readYaml(valueSourceMapPath);
  const entry = valueSourceMap.spec.entries.find((item) => item.valuePath === "crds.enabled");
  check(entry, "missing kube-prometheus-stack crds.enabled value-source-map entry");

  const defaultObjects = objectMap(join(recipeDir, "revisions", "default", "r001", "rendered", "release-objects.yaml"));
  const noCrdsObjects = objectMap(join(recipeDir, "revisions", "no-crds", "r001", "rendered", "release-objects.yaml"));
  const predicted = new Set(entry.renderedFields.map((field) => field.object).sort());
  const actualRemoved = [...defaultObjects.keys()].filter((identity) => !noCrdsObjects.has(identity)).sort();
  const actualAdded = [...noCrdsObjects.keys()].filter((identity) => !defaultObjects.has(identity)).sort();
  const actualChanged = [...defaultObjects.keys()]
    .filter((identity) => noCrdsObjects.has(identity) && defaultObjects.get(identity) !== noCrdsObjects.get(identity))
    .sort();
  const actualAffected = new Set([...actualRemoved, ...actualAdded, ...actualChanged]);
  const falseNegatives = [...actualAffected].filter((identity) => !predicted.has(identity)).sort();
  const falsePositives = [...predicted].filter((identity) => !actualAffected.has(identity)).sort();
  const truePositives = [...predicted].filter((identity) => actualAffected.has(identity)).length;
  const precision = predicted.size === 0 ? "" : ratio(truePositives, predicted.size);
  const recall = actualAffected.size === 0 ? "" : ratio(truePositives, actualAffected.size);
  const result = falseNegatives.length === 0 && falsePositives.length === 0 ? "pass" : "fail";

  check(actualRemoved.length === 10, `expected kube-prometheus-stack no-crds to remove 10 objects, got ${actualRemoved.length}`);
  check(actualAdded.length === 0, `expected kube-prometheus-stack no-crds to add 0 objects, got ${actualAdded.length}`);
  check(actualChanged.length === 0, `expected kube-prometheus-stack no-crds to change 0 shared objects, got ${actualChanged.length}`);

  return {
    chart,
    version,
    case_id: "kps-crds-enabled-default-to-no-crds",
    value_path: "crds.enabled",
    measurement_type: "committed-base-pair-rerender-diff",
    from_variant: "default",
    to_variant: "no-crds",
    predicted_objects: predicted.size,
    actual_removed_objects: actualRemoved.length,
    actual_added_objects: actualAdded.length,
    actual_changed_objects: actualChanged.length,
    false_negatives: falseNegatives.length,
    false_positives: falsePositives.length,
    precision,
    recall,
    result,
    evidence: [
      `${recipeRel}/value-source-map.yaml`,
      `${recipeRel}/inheritance-graph.yaml`,
      `${recipeRel}/revisions/default/r001/rendered/release-objects.yaml`,
      `${recipeRel}/revisions/no-crds/r001/rendered/release-objects.yaml`,
      "data/high-fanout-demo/summary.md",
    ].join("; "),
    limit: "This measures one committed base-pair rerender diff. It does not prove blast-radius accuracy for all KPS values or all charts.",
  };
}

function valueSourceEntries() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/value-source-map.yaml"))
    .sort()
    .flatMap((file) => {
      const document = readYaml(file);
      const recipeRel = dirname(relativeRepo(file));
      return (document.spec?.entries ?? []).map((entry) => ({
        chart: document.spec?.chart ?? "",
        version: document.spec?.version ?? "",
        id: entry.id ?? entry.valuePath,
        value_path: entry.valuePath ?? "",
        predicted_objects: new Set((entry.renderedFields ?? []).map((field) => field.object)).size,
        evidence: `${recipeRel}/value-source-map.yaml`,
      }));
    });
}

function objectMap(path) {
  return new Map(
    parseDocs(readFileSync(path, "utf8"))
      .map((doc) => {
        const metadata = doc.metadata ?? {};
        const identity = [doc.apiVersion ?? "", doc.kind ?? "", metadata.namespace ?? "", metadata.name ?? ""].join("|");
        return [identity, stableJson(doc)];
      })
      .filter(([identity]) => identity.replaceAll("|", "")),
  );
}

function stableJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]));
  }
  return value;
}

function summary({ measured, unmeasured, rows }) {
  const passed = measured.filter((row) => row.result === "pass").length;
  const failed = measured.filter((row) => row.result === "fail").length;
  const measuredTable = measured
    .map((row) => `| \`${row.chart}@${row.version}\` | \`${row.value_path}\` | \`${row.from_variant}\` -> \`${row.to_variant}\` | ${row.predicted_objects} | ${row.actual_removed_objects + row.actual_added_objects + row.actual_changed_objects} | ${row.false_negatives} | ${row.false_positives} | \`${row.result}\` |`)
    .join("\n");
  const unmeasuredTable = unmeasured
    .map((row) => `| \`${row.chart}@${row.version}\` | \`${row.value_path}\` | ${row.predicted_objects} | [value-source-map](${relativeLink(row.evidence)}) |`)
    .join("\n");

  return `# Blast-Radius Accuracy

This generated report scores whether a value-source-map prediction matched an
actual committed rerender diff. It is intentionally narrow. A value-source map
is not trusted because it exists; it becomes stronger when a rerender proves
that the predicted affected objects match the actual affected objects.

## Current Status

| Metric | Count |
| --- | ---: |
| Measured cases | ${measured.length} |
| Passing measured cases | ${passed} |
| Failing measured cases | ${failed} |
| Unmeasured value-source rows | ${unmeasured.length} |
| Total rows | ${rows.length} |

The first measured case is kube-prometheus-stack \`crds.enabled=false\`. The
prediction says that exactly the Prometheus Operator CRD objects are affected.
The committed \`default\` and \`no-crds\` rendered object sets confirm that
exactly 10 CRD objects are removed, with no added objects and no changed shared
objects.

This is useful evidence, not a general guarantee. The broader blast-radius
claim stays partial until more value paths are measured across more charts.

## Measured Cases

| Chart | Value path | Variants | Predicted objects | Actual affected objects | False negatives | False positives | Result |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
${measuredTable}

## Unmeasured Value-Source Rows

These rows have field reachability evidence but no scored actual rerender diff
yet.

| Chart | Value path | Predicted objects | Evidence |
| --- | --- | ---: | --- |
${unmeasuredTable}

## Regenerate

~~~sh
npm run blast-radius:accuracy
npm run blast-radius:accuracy:verify
~~~
`;
}

function ratio(numerator, denominator) {
  return (numerator / denominator).toFixed(3);
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function relativeLink(path) {
  const first = path.split("; ")[0];
  return first.startsWith("data/") ? `../${first.replace("data/", "")}` : `../../${first}`;
}
