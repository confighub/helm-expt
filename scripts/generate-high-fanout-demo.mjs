#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "high-fanout-demo");
const outputs = {
  csv: join(outputRoot, "prometheus-kps.csv"),
  summary: join(outputRoot, "summary.md"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log("wrote high-fanout demo -> data/high-fanout-demo/");
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${path} is missing; run npm run high-fanout:generate`);
    check(readFileSync(path, "utf8") === report[name], `${path} is stale; run npm run high-fanout:generate`);
  }
  console.log("verified Prometheus high-fanout demo");
} else {
  console.log(`Usage:
  node scripts/generate-high-fanout-demo.mjs --generate
  node scripts/generate-high-fanout-demo.mjs --verify`);
}

function buildReport() {
  const chart = "prometheus-community/kube-prometheus-stack";
  const version = "85.3.3";
  const basePath = join(repoRoot, "recipes", "prometheus-community", "kube-prometheus-stack", version);
  const variants = ["default", "no-crds"].map((base) => loadVariant(basePath, chart, version, base));
  const [defaultVariant, noCrdsVariant] = variants;
  const removed = difference(defaultVariant.identities, noCrdsVariant.identities);
  const removedObjects = removed.map((identity) => defaultVariant.objectByIdentity.get(identity));
  const removedKindCounts = countBy(removedObjects, (object) => object.kind);
  const runtimeReceipt = readYaml(join(repoRoot, "data", "runtime-gitops", "receipts", "prometheus-community-kube-prometheus-stack", "no-crds", "latest.yaml"));
  const kindRows = parseCsv(readFileSync(join(repoRoot, "data", "live-kind-parity", "summary.csv"), "utf8"));
  const runtimeRows = parseCsv(readFileSync(join(repoRoot, "data", "runtime-gitops", "receipt-index.csv"), "utf8"));

  const rows = [
    row({
      chart,
      version,
      base: "default",
      user_choice: "install the stack including Prometheus Operator CRDs",
      values_change: "baseline",
      helm_objects: defaultVariant.helmObjects,
      installer_objects: defaultVariant.installerObjects,
      separated_secrets: defaultVariant.separatedSecrets,
      crds: defaultVariant.kindCounts.get("CustomResourceDefinition") ?? 0,
      webhook_configurations: webhookCount(defaultVariant.objects),
      monitoring_custom_resources: monitoringCustomResources(defaultVariant.objects),
      render_parity: defaultVariant.equivalence.spec.result,
      local_kind_parity: statusFor(kindRows, chart, version, "default"),
      gitops_oci: "missing",
      lesson: "Use this base when this release owns the CRDs as part of the install.",
      evidence: "recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
    }),
    row({
      chart,
      version,
      base: "no-crds",
      user_choice: "install the stack without creating CRDs",
      values_change: "crds.enabled=false",
      helm_objects: noCrdsVariant.helmObjects,
      installer_objects: noCrdsVariant.installerObjects,
      separated_secrets: noCrdsVariant.separatedSecrets,
      crds: noCrdsVariant.kindCounts.get("CustomResourceDefinition") ?? 0,
      webhook_configurations: webhookCount(noCrdsVariant.objects),
      monitoring_custom_resources: monitoringCustomResources(noCrdsVariant.objects),
      render_parity: noCrdsVariant.equivalence.spec.result,
      local_kind_parity: statusFor(kindRows, chart, version, "no-crds"),
      gitops_oci: statusFor(runtimeRows, chart, version, "no-crds"),
      lesson: "Use this base only when CRDs and separated secrets are supplied by the target environment.",
      evidence: "data/runtime-gitops/receipts/prometheus-community-kube-prometheus-stack/no-crds/latest.yaml",
    }),
    row({
      chart,
      version,
      base: "default-to-no-crds-delta",
      user_choice: "compare base variants before promotion",
      values_change: "crds.enabled=false removes only CRD objects",
      helm_objects: removed.length,
      installer_objects: removed.length,
      separated_secrets: 0,
      crds: removedKindCounts.get("CustomResourceDefinition") ?? 0,
      webhook_configurations: webhookCount(removedObjects),
      monitoring_custom_resources: monitoringCustomResources(removedObjects),
      render_parity: "explained-diff",
      local_kind_parity: "n/a",
      gitops_oci: runtimeReceipt.spec?.result ?? "unknown",
      lesson: "The blocked GitOps receipt is useful: it proves the no-crds variant needs CRDs installed before the workload syncs.",
      evidence: "recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml",
    }),
  ];

  return {
    csv: toCsv(rows),
    summary: summary({ chart, version, rows, removedObjects, runtimeReceipt }),
  };
}

function loadVariant(basePath, chart, version, base) {
  const revisionRoot = join(basePath, "revisions", base, "r001");
  const inventory = readYaml(join(revisionRoot, "rendered", "object-inventory.yaml"));
  const equivalence = readYaml(join(revisionRoot, "receipts", "helm-equivalence-receipt.yaml"));
  const objects = inventory.spec.objects;
  return {
    chart,
    version,
    base,
    objects,
    identities: new Set(objects.map((object) => object.identity)),
    objectByIdentity: new Map(objects.map((object) => [object.identity, object])),
    kindCounts: countBy(objects, (object) => object.kind),
    equivalence,
    helmObjects: equivalence.spec.regularHelm.objectCount,
    installerObjects: equivalence.spec.cubInstall.objectCountIncludingSecretsAndSupportObjects,
    separatedSecrets: equivalence.spec.cubInstall.separatedSecretFiles,
  };
}

function row(values) {
  return values;
}

function summary({ chart, version, rows, removedObjects, runtimeReceipt }) {
  const defaultRow = rows[0];
  const noCrdsRow = rows[1];
  const deltaRow = rows[2];
  const removedTable = removedObjects
    .map((object) => `| \`${object.kind}\` | \`${object.name}\` |`)
    .join("\n");

  return `# Prometheus High-Fanout Demo

This generated demo uses \`${chart}@${version}\` to show why some Helm choices
belong in reviewed base variants instead of ad hoc post-render edits.

## Base Variants

| Base | User choice | Helm objects | CRDs | Webhook configs | Monitoring custom resources | Current live evidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| \`${defaultRow.base}\` | ${defaultRow.user_choice} | ${defaultRow.helm_objects} | ${defaultRow.crds} | ${defaultRow.webhook_configurations} | ${defaultRow.monitoring_custom_resources} | local kind parity: \`${defaultRow.local_kind_parity}\` |
| \`${noCrdsRow.base}\` | ${noCrdsRow.user_choice} | ${noCrdsRow.helm_objects} | ${noCrdsRow.crds} | ${noCrdsRow.webhook_configurations} | ${noCrdsRow.monitoring_custom_resources} | GitOps/OCI: \`${noCrdsRow.gitops_oci}\`; local kind parity: \`${noCrdsRow.local_kind_parity}\` |

The \`no-crds\` base changes one render-time choice:

~~~text
crds.enabled=false
~~~

That removes ${deltaRow.crds} CRD objects from the rendered set. It does not
remove the Prometheus custom resources that use those CRDs. The existing
GitOps/OCI receipt records \`${runtimeReceipt.spec?.result ?? "unknown"}\`
because Flux pulled the ConfigHub OCI artifact, then blocked before apply when
the target cluster did not have the required CRDs.

## Removed Objects

| Kind | Name |
| --- | --- |
${removedTable}

## How To Use The Example

Use this as the pattern for high-fanout charts:

1. Make render-time choices explicit as base variants.
2. Compare the rendered object inventory before promotion.
3. Keep target prerequisites visible, such as pre-existing CRDs and separated
   Secrets.
4. Treat blocked live receipts as useful evidence, not noise.

The lesson is not "always install CRDs with the chart." The lesson is that
\`default\` and \`no-crds\` are different deployable contracts. One release owns
the CRDs. The other assumes the target already provides them.

## Files

| File | Purpose |
| --- | --- |
| \`data/high-fanout-demo/prometheus-kps.csv\` | Spreadsheet row for each base and the default-to-no-crds delta. |
| \`recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md\` | Variant catalog and receipt links. |
| \`recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml\` | Desired-state graph fragment showing the base relation. |
| \`data/runtime-gitops/receipts/prometheus-community-kube-prometheus-stack/no-crds/latest.yaml\` | GitOps/OCI receipt for the no-crds prerequisite failure. |

Regenerate:

~~~sh
npm run high-fanout:generate
npm run high-fanout:verify
~~~
`;
}

function webhookCount(objects) {
  return objects.filter((object) => ["MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"].includes(object.kind)).length;
}

function monitoringCustomResources(objects) {
  return objects.filter((object) => object.apiVersion.startsWith("monitoring.coreos.com/")).length;
}

function difference(left, right) {
  return [...left].filter((item) => !right.has(item)).sort();
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) counts.set(keyFn(item), (counts.get(keyFn(item)) ?? 0) + 1);
  return counts;
}

function statusFor(rows, chart, version, base) {
  const row = rows.find((item) => item.chart === chart && item.version === version && item.base === base);
  return row?.result ?? row?.status ?? row?.receipt_result ?? "missing";
}

function parseCsv(text) {
  const lines = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      lines.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    lines.push(row);
  }
  const [headers, ...records] = lines.filter((line) => line.some((item) => item !== ""));
  if (!headers) return [];
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function toCsv(rows) {
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
