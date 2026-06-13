#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, parseDocs, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "secret-lifecycle");
const summaryPath = join(outDir, "summary.md");
const secretsPath = join(outDir, "secrets.csv");
const variantsPath = join(outDir, "variant-summary.csv");

const secretColumns = [
  "chart",
  "base",
  "secret_identity",
  "secret_name",
  "namespace",
  "secret_type",
  "source",
  "role",
  "disposition",
  "related_dependency",
  "evidence",
  "notes",
];

const variantColumns = [
  "chart",
  "base",
  "rendered_secret_count",
  "target_fact_secret_count",
  "lifecycle_secret_count",
  "user_secret_count",
  "review_secret_count",
  "overall_disposition",
  "dispositions",
  "roles",
  "evidence",
  "notes",
];

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(secretsPath, report.secretsCsv);
  write(variantsPath, report.variantsCsv);
  console.log(`wrote secret lifecycle survey for ${report.variantRows.length} variant(s)`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "data/secret-lifecycle/summary.md is missing; run npm run secrets:lifecycle");
  check(existsSync(secretsPath), "data/secret-lifecycle/secrets.csv is missing; run npm run secrets:lifecycle");
  check(existsSync(variantsPath), "data/secret-lifecycle/variant-summary.csv is missing; run npm run secrets:lifecycle");
  check(readFileSync(summaryPath, "utf8") === report.summary, "data/secret-lifecycle/summary.md is stale; run npm run secrets:lifecycle");
  check(readFileSync(secretsPath, "utf8") === report.secretsCsv, "data/secret-lifecycle/secrets.csv is stale; run npm run secrets:lifecycle");
  check(readFileSync(variantsPath, "utf8") === report.variantsCsv, "data/secret-lifecycle/variant-summary.csv is stale; run npm run secrets:lifecycle");
  check(report.secretRows.every((row) => row.disposition), "every Secret row must have a disposition");
  check(report.variantRows.every((row) => row.overall_disposition), "every variant row must have an overall disposition");
  console.log(`verified secret lifecycle survey for ${report.variantRows.length} variant(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-secret-lifecycle.mjs --generate
  node scripts/generate-secret-lifecycle.mjs --verify`);
}

function buildReport() {
  const top100Rows = readCsv("data/top100-readiness/readiness.csv");
  const webhookEvidence = readCsvIfExists("data/webhook-cert-lifecycle/evidence.csv");
  const lifecycleObservations = readCsvIfExists("data/lifecycle-observations/cert-manager-eso/summary.csv");
  const hookRows = readCsvIfExists("data/hook-lifecycle/maintained-hook-queue.csv");
  const secretRows = [];
  const variantRows = [];

  for (const row of top100Rows) {
    const indexPath = artifactIndexPath(row.recipe_path);
    if (!indexPath || !existsSync(join(repoRoot, indexPath))) continue;
    const index = readYaml(join(repoRoot, indexPath));
    const chart = index.spec.chart.ref;
    const version = index.spec.chart.version;
    const chartRef = `${chart}@${version}`;
    for (const variant of index.spec.variants ?? []) {
      const revision = variant.revisions?.[0];
      const renderedPath = revision?.renderedObjects;
      const docs = renderedPath && existsSync(join(repoRoot, renderedPath))
        ? parseDocs(readFileSync(join(repoRoot, renderedPath), "utf8"))
        : [];
      const renderedSecrets = docs.filter((doc) => doc.kind === "Secret");
      const targetSecrets = variant.targetFacts?.requiredSecrets ?? [];
      const rowsForVariant = [];

      for (const secret of renderedSecrets) {
        const secretRow = renderedSecretRow({
          chart,
          version,
          base: variant.name,
          secret,
          renderedPath,
          scanPath: revision?.receipts?.scan?.path ?? "",
          separatedSecretCount: Number(revision?.separatedSecretFiles ?? variant.setupCheck?.separatedSecretCount ?? 0),
          webhookEvidence,
          lifecycleObservations,
          hookRows,
        });
        secretRows.push(secretRow);
        rowsForVariant.push(secretRow);
      }

      for (const secret of targetSecrets) {
        const secretRow = targetSecretRow({ chart, version, base: variant.name, secret, evidencePath: variant.variant });
        secretRows.push(secretRow);
        rowsForVariant.push(secretRow);
      }

      variantRows.push(variantSummaryRow({
        chartRef,
        chart,
        version,
        base: variant.name,
        renderedSecrets,
        targetSecrets,
        rowsForVariant,
        catalogPath: index.catalogStatus?.path ?? "",
        artifactIndex: indexPath,
      }));
    }
  }

  secretRows.sort(compareSecretRows);
  variantRows.sort((a, b) => `${a.chart}@${a.version}#${a.base}`.localeCompare(`${b.chart}@${b.version}#${b.base}`));

  return {
    secretRows,
    variantRows,
    secretsCsv: toCsv(secretRows, secretColumns),
    variantsCsv: toCsv(variantRows, variantColumns),
    summary: summary({ secretRows, variantRows }),
  };
}

function renderedSecretRow({ chart, version, base, secret, renderedPath, scanPath, separatedSecretCount, webhookEvidence, lifecycleObservations, hookRows }) {
  const metadata = secret.metadata ?? {};
  const namespace = metadata.namespace ?? "";
  const name = metadata.name ?? "";
  const type = secret.type ?? "Opaque";
  const role = classifyRenderedSecret(secret);
  const observedEvidence = findObservedEvidence({ chart, version, base, namespace, name, webhookEvidence, lifecycleObservations, hookRows });
  const disposition = renderedDisposition({ role, observedEvidence, separatedSecretCount });
  return {
    chart: `${chart}@${version}`,
    base,
    secret_identity: `v1|Secret|${namespace}|${name}`,
    secret_name: name,
    namespace,
    secret_type: type,
    source: "rendered-object",
    role,
    disposition,
    related_dependency: relatedDependency(secret),
    evidence: observedEvidence || renderedPath,
    notes: renderedNotes({ role, disposition, separatedSecretCount, scanPath }),
  };
}

function targetSecretRow({ chart, version, base, secret, evidencePath }) {
  const namespace = secret.namespace ?? "";
  const name = secret.name ?? "";
  const role = classifyTargetSecret(secret);
  const keys = Array.isArray(secret.keys) ? secret.keys.join(";") : "";
  return {
    chart: `${chart}@${version}`,
    base,
    secret_identity: `v1|Secret|${namespace}|${name}`,
    secret_name: name,
    namespace,
    secret_type: "target-fact",
    source: "target-fact",
    role,
    disposition: "staged",
    related_dependency: keys ? `required keys: ${keys}` : "required Secret exists",
    evidence: evidencePath,
    notes: secret.purpose ?? "Secret must exist in the target before the selected lane applies the rendered objects.",
  };
}

function variantSummaryRow({ chartRef, chart, version, base, renderedSecrets, targetSecrets, rowsForVariant, catalogPath, artifactIndex }) {
  const dispositions = unique(rowsForVariant.map((row) => row.disposition));
  const roles = unique(rowsForVariant.map((row) => row.role));
  return {
    chart: chartRef,
    base,
    rendered_secret_count: renderedSecrets.length,
    target_fact_secret_count: targetSecrets.length,
    lifecycle_secret_count: rowsForVariant.filter((row) => row.role === "kubernetes-lifecycle-state").length,
    user_secret_count: rowsForVariant.filter((row) => row.role === "user-credential-material").length,
    review_secret_count: rowsForVariant.filter((row) => row.role === "secret-material-review").length,
    overall_disposition: overallDisposition(rowsForVariant),
    dispositions: dispositions.length ? dispositions.join(";") : "not-applicable",
    roles: roles.length ? roles.join(";") : "not-applicable",
    evidence: rowsForVariant.length ? unique(rowsForVariant.map((row) => row.evidence)).join(";") : catalogPath || artifactIndex,
    notes: rowsForVariant.length
      ? "Secret handling is explicit for this base; read secrets.csv for per-Secret ownership."
      : "No rendered Secret or required target Secret is present in the committed artifact index for this base.",
  };
}

function classifyRenderedSecret(secret) {
  const metadata = secret.metadata ?? {};
  const name = String(metadata.name ?? "").toLowerCase();
  const type = String(secret.type ?? "Opaque").toLowerCase();
  const annotations = metadata.annotations ?? {};
  const dataKeys = Object.keys(secret.data ?? {}).map((key) => key.toLowerCase());
  const text = [name, type, ...dataKeys, ...Object.keys(annotations).map((key) => key.toLowerCase())].join(" ");
  if (type === "kubernetes.io/service-account-token" || annotations["kubernetes.io/service-account.name"]) {
    return "kubernetes-lifecycle-state";
  }
  if (/\b(webhook|admission|ca|cert|certificate|tls)\b/.test(text)) {
    return "kubernetes-lifecycle-state";
  }
  if (/\b(password|passwd|token|auth|admin|root|gossip|credential|access|secret|s3|minio|redis|mysql|postgres|mongodb|rabbitmq|grafana)\b/.test(text)) {
    return "user-credential-material";
  }
  return "secret-material-review";
}

function classifyTargetSecret(secret) {
  const text = [secret.name, secret.purpose, ...(secret.keys ?? [])].join(" ").toLowerCase();
  if (/\b(webhook|cert-controller|service-account|admission)\b/.test(text)) return "kubernetes-lifecycle-state";
  return "user-credential-material";
}

function renderedDisposition({ role, observedEvidence, separatedSecretCount }) {
  if (observedEvidence) return "observed";
  if (role === "kubernetes-lifecycle-state") return "needs-lane-support";
  if (separatedSecretCount > 0) return "delivered";
  return "delivered";
}

function renderedNotes({ role, disposition, separatedSecretCount, scanPath }) {
  const parts = [];
  if (role === "kubernetes-lifecycle-state") {
    parts.push("Kubernetes lifecycle Secret such as webhook or serving certificate material; do not confuse this with user credentials.");
  } else if (role === "user-credential-material") {
    parts.push("User or application credential material; production use needs a target-scoped Secret policy.");
  } else {
    parts.push("Rendered Secret needs review before stronger production claims.");
  }
  if (separatedSecretCount > 0) parts.push("The installer package records separated Secret handling for this base.");
  if (disposition === "needs-lane-support") parts.push("Add staged Secret, controller observation, or an explicit refusal before claiming live lifecycle support.");
  if (scanPath) parts.push(`Scan evidence: ${scanPath}.`);
  return parts.join(" ");
}

function relatedDependency(secret) {
  const refs = [];
  const annotations = secret.metadata?.annotations ?? {};
  if (annotations["kubernetes.io/service-account.name"]) refs.push(`ServiceAccount ${annotations["kubernetes.io/service-account.name"]}`);
  return refs.join(";") || "-";
}

function findObservedEvidence({ chart, version, base, namespace, name, webhookEvidence, lifecycleObservations, hookRows }) {
  const chartAtVersion = `${chart}@${version}`;
  const staged = `${namespace}/${name}`;
  const webhook = webhookEvidence.find((row) =>
    row.chart === chartAtVersion && row.base === base && row.result === "pass" && row.staged_secret === staged
  );
  if (webhook) return webhook.staging_receipt || webhook.paired_observation;
  const lifecycle = lifecycleObservations.find((row) =>
    row.chart === chart && row.version === version && row.base === base && row.result === "pass"
  );
  if (lifecycle && /webhook|cert|tls|ca/i.test(name)) return lifecycle.receipt;
  const hook = hookRows.find((row) =>
    row.chart === chart && row.version === version && row.selected_base === base && row.receipt_status === "observed"
  );
  return hook?.required_receipt ?? "";
}

function overallDisposition(rows) {
  if (!rows.length) return "not-applicable";
  const values = new Set(rows.map((row) => row.disposition));
  if (values.has("needs-lane-support")) return "needs-lane-support";
  if (values.has("staged") && values.has("delivered")) return "delivered-and-staged";
  if (values.has("observed")) return "observed";
  if (values.has("staged")) return "staged";
  return "delivered";
}

function artifactIndexPath(recipePath) {
  if (!recipePath) return "";
  return `${dirname(recipePath)}/artifact-index.yaml`;
}

function summary({ secretRows, variantRows }) {
  const dispositionCounts = groupCount(secretRows, "disposition");
  const roleCounts = groupCount(secretRows, "role");
  const variantDispositionCounts = groupCount(variantRows, "overall_disposition");
  const lifecycleNeedingSupport = secretRows.filter((row) => row.role === "kubernetes-lifecycle-state" && row.disposition === "needs-lane-support");
  return `# Secret Lifecycle Survey

Generated. Do not edit by hand.

This survey separates two kinds of Secret handling that Helm often mixes
together:

- user or application credential material, such as passwords, tokens, TLS keys,
  object-store credentials, and existing Secret references;
- Kubernetes lifecycle state, such as webhook serving certificates and
  service-account token Secrets.

The survey is built from committed top-100 artifact indexes, rendered object
sets, target facts, hook lifecycle receipts, and webhook certificate lifecycle
receipts. It does not run live lanes.

## Summary

~~~text
variants surveyed: ${variantRows.length}
secret rows: ${secretRows.length}
variant dispositions: ${formatCounts(variantDispositionCounts)}
secret dispositions: ${formatCounts(dispositionCounts)}
secret roles: ${formatCounts(roleCounts)}
lifecycle secrets still needing lane support: ${lifecycleNeedingSupport.length}
~~~

## Reading Rule

- \`delivered\` means the rendered artifact contains the Secret and the recipe or
  installer package records how it is handled.
- \`staged\` means the selected base requires a target Secret before apply.
- \`observed\` means committed lifecycle evidence records the Secret staging or
  controller behavior for that base.
- \`needs-lane-support\` means the Secret is visible, but the repo should add a
  staging receipt, lifecycle observation, or explicit refusal before stronger
  live or production claims.
- \`not-applicable\` means the base has no rendered Secret and no required target
  Secret in the committed artifact index.

## Lifecycle Secrets Needing Lane Support

| Chart | Base | Secret | Evidence |
| --- | --- | --- | --- |
${lifecycleNeedingSupport.slice(0, 40).map((row) => `| \`${row.chart}\` | \`${row.base}\` | \`${row.namespace}/${row.secret_name}\` | ${link(row.evidence)} |`).join("\n") || "| - | - | - | - |"}

Machine-readable forms:

- [variant-summary.csv](./variant-summary.csv)
- [secrets.csv](./secrets.csv)

Regenerate:

~~~sh
npm run secrets:lifecycle
npm run secrets:lifecycle:verify
~~~
`;
}

function compareSecretRows(a, b) {
  return `${a.chart}#${a.base}#${a.secret_identity}#${a.source}`.localeCompare(`${b.chart}#${b.base}#${b.secret_identity}#${b.source}`);
}

function groupCount(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] || "-";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function formatCounts(map) {
  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join(", ") || "-";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function link(path) {
  if (!path || path === "-") return "-";
  return `[${path}](../../${path})`;
}

function readCsv(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function readCsvIfExists(path) {
  const absolute = join(repoRoot, path);
  return existsSync(absolute) ? parseCsv(readFileSync(absolute, "utf8")) : [];
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((item) => item.some((cell) => cell !== ""));
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function toCsv(rows, columns) {
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
