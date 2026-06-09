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
  const liveCompareRows = parseCsv(readFileSync(join(repoRoot, "data", "live-helm-confighub-compare", "summary.csv"), "utf8"));
  const runtimeRows = parseCsv(readFileSync(join(repoRoot, "data", "runtime-gitops", "receipt-index.csv"), "utf8"));
  const productionRows = parseCsv(readFileSync(join(repoRoot, "data", "production-disposition", "top20.csv"), "utf8"));
  const productionRow = productionRows.find((item) => item.chart === chart && item.version === version);
  const productionStatus = productionRow?.production_support ?? "missing";
  const productionNextAction = productionRow?.next_action ?? "missing";
  const confighubProof = productionRow?.confighub_proof ?? "missing";
  const valueSourceMap = readYaml(join(basePath, "value-source-map.yaml"));

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
      confighub_proof: confighubProof,
      two_cluster_kind_parity: statusFor(kindRows, chart, version, "default"),
      strict_live_configHub_argo: statusOr(liveCompareRows, chart, version, "default", "not-selected"),
      runtime_gitops_wave: statusOr(runtimeRows, chart, version, "default", "not-selected"),
      production_status: productionStatus,
      next_hard_work: productionNextAction,
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
      confighub_proof: confighubProof,
      two_cluster_kind_parity: statusFor(kindRows, chart, version, "no-crds"),
      strict_live_configHub_argo: statusOr(liveCompareRows, chart, version, "no-crds", "not-selected"),
      runtime_gitops_wave: statusFor(runtimeRows, chart, version, "no-crds"),
      production_status: productionStatus,
      next_hard_work: "stage CRDs and admission Secret for the target, then rerun GitOps/OCI and record a target-scoped support decision",
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
      confighub_proof: "n/a",
      two_cluster_kind_parity: "n/a",
      strict_live_configHub_argo: "n/a",
      runtime_gitops_wave: runtimeReceipt.spec?.result ?? "unknown",
      production_status: "n/a",
      next_hard_work: "use the delta to decide which base belongs on a target before promotion",
      lesson: "The blocked GitOps receipt is useful: it proves the no-crds variant needs CRDs installed before the workload syncs.",
      evidence: "recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml",
    }),
  ];

  return {
    csv: toCsv(rows),
    summary: summary({ chart, version, rows, removedObjects, runtimeReceipt, valueSourceMap }),
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

function summary({ chart, version, rows, removedObjects, runtimeReceipt, valueSourceMap }) {
  const defaultRow = rows[0];
  const noCrdsRow = rows[1];
  const deltaRow = rows[2];
  const removedTable = removedObjects
    .map((object) => `| \`${object.kind}\` | \`${object.name}\` |`)
    .join("\n");
  const reachabilityRows = (valueSourceMap.spec?.entries ?? [])
    .map((entry) => {
      const fieldCount = entry.renderedFields?.length ?? 0;
      return `| \`${entry.valuePath}\` | ${entry.rolloutImpact ?? ""} | ${fieldCount} |`;
    })
    .join("\n");

  return `# Prometheus High-Fanout Demo

This generated demo uses \`${chart}@${version}\` to show why some Helm choices
belong in reviewed base variants instead of ad hoc post-render edits.

## Base Variants

| Base | User choice | Helm objects | CRDs | Webhook configs | Monitoring custom resources | Current proof chain |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| \`${defaultRow.base}\` | ${defaultRow.user_choice} | ${defaultRow.helm_objects} | ${defaultRow.crds} | ${defaultRow.webhook_configurations} | ${defaultRow.monitoring_custom_resources} | render \`${defaultRow.render_parity}\`; two-cluster kind \`${defaultRow.two_cluster_kind_parity}\`; strict ConfigHub OCI/Argo \`${defaultRow.strict_live_configHub_argo}\`; production \`${defaultRow.production_status}\` |
| \`${noCrdsRow.base}\` | ${noCrdsRow.user_choice} | ${noCrdsRow.helm_objects} | ${noCrdsRow.crds} | ${noCrdsRow.webhook_configurations} | ${noCrdsRow.monitoring_custom_resources} | render \`${noCrdsRow.render_parity}\`; two-cluster kind \`${noCrdsRow.two_cluster_kind_parity}\`; runtime GitOps wave \`${noCrdsRow.runtime_gitops_wave}\`; production \`${noCrdsRow.production_status}\` |

The \`no-crds\` base changes one render-time choice:

~~~text
crds.enabled=false
~~~

That removes ${deltaRow.crds} CRD objects from the rendered set. It does not
remove the Prometheus custom resources that use those CRDs. The existing
GitOps/OCI receipt records \`${runtimeReceipt.spec?.result ?? "unknown"}\`
because Flux pulled the ConfigHub OCI artifact, then blocked before apply when
the target cluster did not have the required CRDs.

## Chain Of Proof Status

| Boundary | \`default\` | \`no-crds\` | Evidence |
| --- | --- | --- | --- |
| Render parity | \`${defaultRow.render_parity}\` | \`${noCrdsRow.render_parity}\` | Helm-equivalence receipts under \`recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/*/r001/receipts/\`. |
| ConfigHub proof | chart-level \`${defaultRow.confighub_proof}\` | chart-level \`${noCrdsRow.confighub_proof}\` | \`runs/kube-prometheus-stack-confighub-proof/latest/\`. |
| Two-cluster kind parity | \`${defaultRow.two_cluster_kind_parity}\` | \`${noCrdsRow.two_cluster_kind_parity}\` | \`runs/live-kind-parity/prometheus-community-kube-prometheus-stack-*/receipt.yaml\`. |
| ConfigHub OCI/GitOps | strict live \`${defaultRow.strict_live_configHub_argo}\` | runtime wave \`${noCrdsRow.runtime_gitops_wave}\` without pre-existing CRDs | \`runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml\` and \`data/runtime-gitops/receipts/prometheus-community-kube-prometheus-stack/no-crds/latest.yaml\`. |
| Production support | \`${defaultRow.production_status}\` | \`${noCrdsRow.production_status}\` | \`data/production-disposition/top20.csv\` and the KPS production-disposition receipts. |

This is the chain-of-proof lesson. The \`no-crds\` base is not semantically
wrong: it passes two-cluster kind parity when CRDs and the admission Secret are
staged as target facts. It is also correct for the runtime GitOps wave to block
when those CRDs are absent.

## Value Reachability

The value-source map records two user-visible inputs and the rendered fields
they affect:

| Value path | Impact | Rendered fields |
| --- | --- | ---: |
${reachabilityRows}

This is deliberately small. It does not claim a full inverse map for the whole
chart. It shows how high-value choices can become explicit graph edges instead
of disappearing into rendered YAML.

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

## Next Hard Work

| Base | Next action |
| --- | --- |
| \`${defaultRow.base}\` | ${defaultRow.next_hard_work}. |
| \`${noCrdsRow.base}\` | ${noCrdsRow.next_hard_work}. |

For production support, the target-scoped decision still has to choose CRD
ownership, admission Secret source, webhook freshness checks, RBAC and scrape
scope, storage posture, and the supported delivery path.

## Production Support Checklist

This chart is the serious-chart proof path. The current evidence makes the
base choices reviewable; it does not mark either base production-supported for
all targets. A production support decision is still target-scoped.

| Decision | \`default\` | \`no-crds\` | Evidence |
| --- | --- | --- | --- |
| CRD ownership | This release owns the Prometheus Operator CRDs. | The target cluster owns compatible Prometheus Operator CRDs before apply. | \`data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/crd-lifecycle-and-upgrade-policy.yaml\` |
| Admission Secret | Stage or manage \`monitoring/kube-prometheus-stack-admission\` cert/key before config-only delivery. | Stage the same admission Secret plus the external CRDs. | \`data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/target-fact-preflight.yaml\` |
| Webhook freshness | Observe webhook, operator, and caBundle readiness after apply. | Same, after CRDs are established. | \`data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/webhook-readiness-and-failure-policy.yaml\` |
| RBAC and scrape scope | Approve the rendered cluster RBAC and monitoring blast radius for the target. | Same RBAC family; target CRD ownership does not narrow scrape scope by itself. | \`data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/cluster-rbac-review.yaml\` |
| Scan and image posture | Accept the scan findings for this infrastructure scope or create a hardened base. | Same, plus prerequisite evidence for external CRDs. | \`data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/scan-gate-warning-disposition.yaml\` |
| Final live evidence | Refresh target-scoped live parity, GitOps/OCI, and observation receipts for the supported target. | Rerun GitOps/OCI after staging CRDs and the admission Secret. | \`runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml\`; \`runs/live-kind-parity/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml\` |

Use \`default\` when the catalog package should own the CRDs. Use \`no-crds\`
only when CRDs are a target prerequisite with their own owner, version, and
fresh observation. The two bases are both valid review inputs, but they are not
the same operational contract.

## Files

| File | Purpose |
| --- | --- |
| \`data/high-fanout-demo/prometheus-kps.csv\` | Spreadsheet row for each base and the default-to-no-crds delta. |
| \`recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md\` | Variant catalog and receipt links. |
| \`recipes/prometheus-community/kube-prometheus-stack/85.3.3/value-source-map.yaml\` | Value-to-rendered-field reachability for the Grafana admin password and CRD toggle. |
| \`recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml\` | Desired-state graph fragment showing the base relation. |
| \`runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml\` | Strict live proof for regular Helm, ConfigHub apply, and ConfigHub OCI/Argo on the default base. |
| \`runs/live-kind-parity/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml\` | Two-cluster kind parity proof for the no-crds base with target facts staged. |
| \`data/runtime-gitops/receipts/prometheus-community-kube-prometheus-stack/no-crds/latest.yaml\` | GitOps/OCI receipt for the no-crds prerequisite failure. |
| \`docs/user/chain-of-proof.md\` | User-facing guide to which proof boundary each receipt supports. |

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
  const row = rows.find((item) => item.chart === chart && item.version === version && (item.base ?? item.variant) === base);
  return row?.result ?? row?.status ?? row?.receipt_result ?? "missing";
}

function statusOr(rows, chart, version, base, fallback) {
  const status = statusFor(rows, chart, version, base);
  return status === "missing" ? fallback : status;
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
