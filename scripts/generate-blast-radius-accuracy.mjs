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
  const measured = [measureKubePrometheusNoCrds(), measureRedisExistingSecret(), measureNginxExistingTlsIngress()];
  const measuredKeys = new Set(
    measured.flatMap((row) => (row.measured_value_paths ?? [row.value_path]).map((valuePath) => `${row.chart}@${row.version}|${valuePath}`)),
  );
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
  return measureBasePair({
    chart,
    version,
    recipeRel,
    case_id: "kps-crds-enabled-default-to-no-crds",
    value_path: "crds.enabled",
    from_variant: "default",
    to_variant: "no-crds",
    expected_removed: 10,
    expected_added: 0,
    expected_changed: 0,
    extra_evidence: [
      `${recipeRel}/value-source-map.yaml`,
      `${recipeRel}/inheritance-graph.yaml`,
      `${recipeRel}/revisions/default/r001/rendered/release-objects.yaml`,
      `${recipeRel}/revisions/no-crds/r001/rendered/release-objects.yaml`,
      "data/high-fanout-demo/summary.md",
    ],
    limit: "This measures one committed base-pair rerender diff. It does not prove blast-radius accuracy for all KPS values or all charts.",
  });
}

function measureRedisExistingSecret() {
  const chart = "bitnami/redis";
  const version = "25.5.3";
  const recipeRel = `recipes/bitnami/redis/${version}`;
  return measureBasePair({
    chart,
    version,
    recipeRel,
    case_id: "redis-auth-password-default-to-existing-secret",
    value_path: "auth.password",
    from_variant: "default",
    to_variant: "reuse-existing-secret",
    expected_removed: 1,
    expected_added: 0,
    expected_changed: 2,
    extra_evidence: [
      `${recipeRel}/value-source-map.yaml`,
      `${recipeRel}/inheritance-graph.yaml`,
      `${recipeRel}/revisions/default/r001/rendered/release-objects.yaml`,
      `${recipeRel}/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml`,
      `${recipeRel}/revisions/default/r001/receipts/generated-fact-receipt.yaml`,
      `${recipeRel}/install-checks.yaml`,
    ],
    limit: "This measures the supported Redis default-to-existing-secret base-pair diff. It does not prove every Redis value path or every generated-secret chart.",
  });
}

function measureNginxExistingTlsIngress() {
  const chart = "bitnami/nginx";
  const version = "24.0.2";
  const recipeRel = `recipes/bitnami/nginx/${version}`;
  return measureBasePair({
    chart,
    version,
    recipeRel,
    case_id: "nginx-ingress-enabled-http-clusterip-to-existing-tls-ingress",
    value_path: "ingress.enabled + tls.existingSecret",
    measured_value_paths: ["ingress.enabled", "tls.existingSecret"],
    from_variant: "http-clusterip",
    to_variant: "existing-tls-ingress",
    expected_removed: 0,
    expected_added: 1,
    expected_changed: 1,
    extra_evidence: [
      `${recipeRel}/value-source-map.yaml`,
      `${recipeRel}/inheritance-graph.yaml`,
      `${recipeRel}/value-model.yaml`,
      `${recipeRel}/revisions/http-clusterip/r001/rendered/release-objects.yaml`,
      `${recipeRel}/revisions/existing-tls-ingress/r001/rendered/release-objects.yaml`,
      `${recipeRel}/helm-pain-report.yaml`,
    ],
    limit: "This measures the supported NGINX http-clusterip to existing-tls-ingress base-pair diff for the ingress and backend TLS Secret choice. It does not prove every NGINX value path or every extension slot.",
  });
}

function measureBasePair({ chart, version, recipeRel, case_id, value_path, measured_value_paths, from_variant, to_variant, expected_removed, expected_added, expected_changed, extra_evidence, limit }) {
  const recipeDir = join(repoRoot, recipeRel);
  const valueSourceMap = readYaml(join(recipeDir, "value-source-map.yaml"));
  const valuePaths = measured_value_paths ?? [value_path];
  const entries = valuePaths.map((path) => {
    const entry = valueSourceMap.spec.entries.find((item) => item.valuePath === path);
    check(entry, `missing ${chart}@${version} ${path} value-source-map entry`);
    return entry;
  });

  const fromObjects = objectMap(join(recipeDir, "revisions", from_variant, "r001", "rendered", "release-objects.yaml"));
  const toObjects = objectMap(join(recipeDir, "revisions", to_variant, "r001", "rendered", "release-objects.yaml"));
  const predicted = new Set(entries.flatMap((entry) => entry.renderedFields.map((field) => field.object)).sort());
  const actualRemoved = [...fromObjects.keys()].filter((identity) => !toObjects.has(identity)).sort();
  const actualAdded = [...toObjects.keys()].filter((identity) => !fromObjects.has(identity)).sort();
  const actualChanged = [...fromObjects.keys()]
    .filter((identity) => toObjects.has(identity) && fromObjects.get(identity) !== toObjects.get(identity))
    .sort();
  const actualAffected = new Set([...actualRemoved, ...actualAdded, ...actualChanged]);
  const falseNegatives = [...actualAffected].filter((identity) => !predicted.has(identity)).sort();
  const falsePositives = [...predicted].filter((identity) => !actualAffected.has(identity)).sort();
  const truePositives = [...predicted].filter((identity) => actualAffected.has(identity)).length;
  const precision = predicted.size === 0 ? "" : ratio(truePositives, predicted.size);
  const recall = actualAffected.size === 0 ? "" : ratio(truePositives, actualAffected.size);
  const result = falseNegatives.length === 0 && falsePositives.length === 0 ? "pass" : "fail";

  check(actualRemoved.length === expected_removed, `expected ${case_id} to remove ${expected_removed} objects, got ${actualRemoved.length}`);
  check(actualAdded.length === expected_added, `expected ${case_id} to add ${expected_added} objects, got ${actualAdded.length}`);
  check(actualChanged.length === expected_changed, `expected ${case_id} to change ${expected_changed} shared objects, got ${actualChanged.length}`);

  const row = {
    chart,
    version,
    case_id,
    value_path,
    measurement_type: "committed-base-pair-rerender-diff",
    from_variant,
    to_variant,
    predicted_objects: predicted.size,
    actual_removed_objects: actualRemoved.length,
    actual_added_objects: actualAdded.length,
    actual_changed_objects: actualChanged.length,
    false_negatives: falseNegatives.length,
    false_positives: falsePositives.length,
    precision,
    recall,
    result,
    evidence: extra_evidence.join("; "),
    limit,
  };
  if (measured_value_paths) {
    Object.defineProperty(row, "measured_value_paths", { value: measured_value_paths });
  }
  return row;
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

The measured cases now cover three different risk shapes:

- kube-prometheus-stack \`crds.enabled=false\`: the prediction says exactly the
  Prometheus Operator CRD objects are affected, and the committed \`default\`
  and \`no-crds\` rendered object sets confirm that exactly 10 CRD objects are
  removed.
- Redis \`auth.password\`: the prediction says the generated Secret and the two
  Redis StatefulSets are affected when moving to \`reuse-existing-secret\`, and
  the committed rendered object sets confirm one removed Secret and two changed
  StatefulSets.
- NGINX \`ingress.enabled + tls.existingSecret\`: the prediction says the
  reviewed \`existing-tls-ingress\` base adds an Ingress and changes the NGINX
  Deployment to mount the backend TLS Secret, and the committed rendered object
  sets confirm exactly that.

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
