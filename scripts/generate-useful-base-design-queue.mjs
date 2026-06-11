#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const sources = {
  chartUse: "data/chart-use-guide/chart-use-guide.csv",
  readiness: "data/top100-readiness/readiness.csv",
  chartFacts: "data/chart-facts/chart-facts.csv",
  top100Coverage: "data/top100-coverage/work-queue.csv",
};

const outputs = {
  queue: "data/useful-base-design-queue/queue.csv",
  families: "data/useful-base-design-queue/families.csv",
  summary: "data/useful-base-design-queue/summary.md",
};

const familyRules = [
  {
    family: "monitoring-metrics",
    match: /prometheus|kube-state-metrics|node-exporter|blackbox|pushgateway|opencost|goldilocks|descheduler/,
    base: "cluster-metrics-readonly",
    userJob: "collect or expose cluster metrics without changing application workloads",
    renderChoices: "service exposure; RBAC scope; persistence if the chart stores state; CRD ownership if present",
    derivedKnobs: "namespace, target, labels, resource requests, scrape endpoint names",
  },
  {
    family: "logging-telemetry-agent",
    match: /fluent|filebeat|metricbeat|promtail|falco|falcosidekick|jaeger/,
    base: "node-or-cluster-collector",
    userJob: "run an observability collector or security agent with explicit output destinations",
    renderChoices: "DaemonSet versus Deployment shape; destination Secret or endpoint; RBAC scope; persistence if present",
    derivedKnobs: "target, region, labels, output endpoint references, resource requests",
  },
  {
    family: "web-admin-ui",
    match: /pgadmin|kibana|phpmyadmin|apache|dex/,
    base: "web-ui-existing-secret",
    userJob: "deploy a reviewable web UI using existing credentials or external identity",
    renderChoices: "Service/Ingress shape; TLS Secret reference; auth or admin Secret policy; persistence if present",
    derivedKnobs: "hostname, TLS Secret reference, namespace, target, approval labels",
  },
  {
    family: "storage-platform",
    match: /nfs|rook|ceph|minio|aws-ebs|csi|memcached/,
    base: "storage-default-reviewed",
    userJob: "install storage or cache infrastructure with explicit storage and lifecycle choices",
    renderChoices: "StorageClass; persistence; CRD ownership if present; privileged permissions; cleanup/retention policy",
    derivedKnobs: "target, storage class label, region, blast-radius labels, observation policy",
  },
  {
    family: "platform-controller",
    match: /calico|tigera|crossplane|argo|istio|linkerd|cert-manager-csi|cluster-autoscaler|coredns|haproxy|kyverno|reloader/,
    base: "controller-default-reviewed",
    userJob: "install a cluster controller with explicit CRD, RBAC, and lifecycle boundaries",
    renderChoices: "CRD ownership; admission/webhook behavior; RBAC scope; leader-election or HA flags; required values",
    derivedKnobs: "target, environment, cluster class, approval labels, observation policy",
  },
  {
    family: "ci-runner",
    match: /gitlab-runner/,
    base: "runner-existing-secret",
    userJob: "run CI runners with explicit registration Secret and RBAC boundaries",
    renderChoices: "registration Secret reference; runner RBAC; namespace; executor/storage choices",
    derivedKnobs: "target, environment labels, runner tags, resource requests",
  },
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  return rows
    .filter((cells) => cells.length > 1 || (cells[0] ?? "").trim() !== "")
    .map((cells) => Object.fromEntries(header.map((name, idx) => [name, cells[idx] ?? ""])));
}

function readCsv(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(header, rows) {
  return `${header.join(",")}\n${rows.map((row) => header.map((key) => csvEscape(row[key])).join(",")).join("\n")}\n`;
}

function splitChart(chartRef) {
  const idx = chartRef.lastIndexOf("@");
  return idx === -1 ? { chart: chartRef, version: "" } : { chart: chartRef.slice(0, idx), version: chartRef.slice(idx + 1) };
}

function flagged(value) {
  const text = (value ?? "").trim();
  return text !== "" && text !== "-" && text !== "—" && !text.toLowerCase().startsWith("n/a");
}

function familyFor(chart) {
  return familyRules.find((rule) => rule.match.test(chart)) ?? {
    family: "application-or-addon",
    base: "default-reviewed",
    userJob: "turn the default render into a named, reviewed install shape",
    renderChoices: "required values; Secret policy; Service/Ingress shape; storage if present",
    derivedKnobs: "target, namespace, labels, approvals, observation policy",
  };
}

function factsFor(chart, factsByChart) {
  return factsByChart.get(chart) ?? {};
}

function quirkList(row, facts) {
  const quirks = [];
  if (flagged(facts.generates_secrets)) quirks.push("generated-secrets");
  if (flagged(facts.existing_secret)) quirks.push("existing-secret");
  if (flagged(facts.crds)) quirks.push("crds");
  if (flagged(facts.webhooks)) quirks.push("webhooks");
  if (flagged(facts.post_deploy_hooks) || flagged(facts.other_hooks) || flagged(facts.hook_status)) quirks.push("hooks");
  if (flagged(facts.extension_slots)) quirks.push("extension-slots");
  if (flagged(facts.required_values)) quirks.push("required-values");
  for (const token of (row.source_features ?? "").split(";").map((item) => item.trim()).filter(Boolean)) {
    if (!quirks.includes(token)) quirks.push(token);
  }
  return quirks;
}

function targetInputs(facts, quirks) {
  const inputs = [];
  if (quirks.includes("existing-secret")) inputs.push("Secret reference");
  if (quirks.includes("stateful-storage")) inputs.push("StorageClass or persistence choice");
  if (quirks.includes("crds")) inputs.push("CRD ownership choice");
  if (quirks.includes("webhooks")) inputs.push("webhook readiness observation");
  if (quirks.includes("lookup") || quirks.includes("generated-facts")) inputs.push("target facts");
  if (flagged(facts.required_values)) inputs.push("required chart values");
  return inputs.length ? inputs.join("; ") : "namespace and target only";
}

function proofRequired(quirks) {
  const proof = ["recipe/package base", "render parity", "helm pain report update", "scan or gate receipt", "production disposition"];
  if (quirks.includes("crds")) proof.push("CRD lifecycle route");
  if (quirks.includes("hooks")) proof.push("hook lifecycle receipt or explicit blocker");
  if (quirks.includes("webhooks")) proof.push("webhook/runtime observation");
  if (quirks.includes("existing-secret") || quirks.includes("generated-secrets")) proof.push("Secret/target-fact policy");
  if (quirks.includes("stateful-storage")) proof.push("storage and rollback note");
  return proof.join("; ");
}

function priority(row, quirks) {
  let score = Number(row.proof_surface_rank || 999);
  if (quirks.includes("hooks")) score -= 20;
  if (quirks.includes("crds")) score -= 12;
  if (quirks.includes("webhooks")) score -= 10;
  if (quirks.includes("stateful-storage")) score -= 5;
  return String(Math.max(1, score));
}

function buildReport() {
  const chartUseRows = readCsv(sources.chartUse).filter((row) => row.answer === "not-yet-user-ready");
  const readinessByChart = new Map(readCsv(sources.readiness).map((row) => [row.chart, row]));
  const factsByChart = new Map(readCsv(sources.chartFacts).map((row) => [row.chart, row]));
  const queueByChart = new Map(readCsv(sources.top100Coverage).map((row) => [row.chart_ref, row]));

  const rows = chartUseRows.map((chartUse) => {
    const { chart, version } = splitChart(chartUse.chart);
    const readiness = readinessByChart.get(chartUse.chart) ?? {};
    const coverage = queueByChart.get(chartUse.chart) ?? {};
    const facts = factsFor(chart, factsByChart);
    const rule = familyFor(chart);
    const quirks = quirkList(readiness, facts);
    return {
      priority: priority(chartUse, quirks),
      chart,
      version,
      family: rule.family,
      proposed_base: rule.base,
      proposal_status: "proposal-not-built",
      user_job: rule.userJob,
      render_time_choices: rule.renderChoices,
      target_inputs: targetInputs(facts, quirks),
      post_render_variant_knobs: rule.derivedKnobs,
      quirks: quirks.join(";") || "none-flagged",
      current_evidence: chartUse.strongest_evidence,
      proof_required_before_catalog: proofRequired(quirks),
      source_next_action: chartUse.first_action || chartUse.next_action,
      done_when: coverage.done_when || "the proposed base has recipe/package artifacts, render parity, scan/gate evidence, and a catalog decision",
      evidence: [chartUse.catalog_path, chartUse.helm_pain_report, coverage.evidence].filter(Boolean).join(";"),
    };
  });

  rows.sort((a, b) => Number(a.priority) - Number(b.priority) || `${a.chart}@${a.version}`.localeCompare(`${b.chart}@${b.version}`));

  const familyRows = familySummary(rows);
  return {
    rows,
    familyRows,
    queue: toCsv([
      "priority",
      "chart",
      "version",
      "family",
      "proposed_base",
      "proposal_status",
      "user_job",
      "render_time_choices",
      "target_inputs",
      "post_render_variant_knobs",
      "quirks",
      "current_evidence",
      "proof_required_before_catalog",
      "source_next_action",
      "done_when",
      "evidence",
    ], rows),
    families: toCsv(["family", "charts", "proposed_base", "first_charts", "user_job"], familyRows),
    summary: summaryMarkdown(rows, familyRows),
  };
}

function familySummary(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.family)) grouped.set(row.family, []);
    grouped.get(row.family).push(row);
  }
  return [...grouped.entries()]
    .map(([family, familyRows]) => ({
      family,
      charts: String(familyRows.length),
      proposed_base: familyRows[0].proposed_base,
      first_charts: familyRows.slice(0, 6).map((row) => `${row.chart}@${row.version}`).join("; "),
      user_job: familyRows[0].user_job,
    }))
    .sort((a, b) => Number(b.charts) - Number(a.charts) || a.family.localeCompare(b.family));
}

function summaryMarkdown(rows, familyRows) {
  const topRows = rows.slice(0, 20);
  return `# Useful Base Design Queue

Generated. Do not edit by hand.

This queue expands the top-100 "needs better base variant" gap into concrete,
reviewable base-design work. Rows are proposals, not supported catalog entries.
They are derived from the current chart-use guide, top-100 readiness data,
chart facts, and strict coverage work queue.

The purpose is to answer:

~~~text
Which proof-grade charts are still too default-shaped for users?
What kind of base would make each one useful?
What must be proven before that base becomes a catalog offer?
~~~

## Summary

~~~text
charts needing useful bases: ${rows.length}
families: ${familyRows.length}
proposal status: proposal-not-built
~~~

## Design Families

| Family | Charts | Proposed base shape | First charts |
| --- | ---: | --- | --- |
${familyRows.map((row) => `| ${row.family} | ${row.charts} | ${row.proposed_base} | ${row.first_charts} |`).join("\n")}

## First Twenty Rows

| Priority | Chart | Proposed base | User job | Target inputs | Proof required |
| ---: | --- | --- | --- | --- | --- |
${topRows.map((row) => `| ${row.priority} | ${row.chart}@${row.version} | ${row.proposed_base} | ${row.user_job} | ${row.target_inputs} | ${row.proof_required_before_catalog} |`).join("\n")}

## Reading Rule

- \`proposal-not-built\` means the row is a product/design candidate only.
- If the choice changes rendered Kubernetes objects, build it as a recipe/package
  base and rerun render parity.
- If the choice only changes target, labels, approvals, links, observations, or
  environment/customer metadata, make it a derived ConfigHub variant after
  upload.
- A proposed base becomes public-catalog ready only after the proof listed in
  \`proof_required_before_catalog\` exists.

Machine-readable forms:

- [queue.csv](./queue.csv)
- [families.csv](./families.csv)

Regenerate:

~~~sh
npm run top100:useful-base-queue
npm run top100:useful-base-queue:verify
~~~
`;
}

function writeOutputs(report) {
  const outDir = join(repoRoot, "data", "useful-base-design-queue");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(repoRoot, outputs.queue), report.queue);
  writeFileSync(join(repoRoot, outputs.families), report.families);
  writeFileSync(join(repoRoot, outputs.summary), report.summary);
}

function verifyOutputs(report) {
  for (const [name, path] of Object.entries(outputs)) {
    const absolute = join(repoRoot, path);
    check(existsSync(absolute), `${path} is missing; run npm run top100:useful-base-queue`);
    check(readFileSync(absolute, "utf8") === report[name], `${path} is stale; run npm run top100:useful-base-queue`);
  }
  check(report.rows.length === 46, `expected 46 useful-base rows, found ${report.rows.length}`);
  for (const row of report.rows) {
    for (const path of row.evidence.split(";").map((item) => item.trim()).filter(Boolean)) {
      check(existsSync(join(repoRoot, path)), `missing evidence path for ${row.chart}@${row.version}: ${path}`);
    }
  }
}

const report = buildReport();

if (mode === "--generate") {
  writeOutputs(report);
  console.log(`wrote useful base design queue for ${report.rows.length} chart(s)`);
} else if (mode === "--verify") {
  verifyOutputs(report);
  console.log(`verified useful base design queue for ${report.rows.length} chart(s)`);
} else {
  console.error(`Usage:
  node scripts/generate-useful-base-design-queue.mjs --generate
  node scripts/generate-useful-base-design-queue.mjs --verify`);
  process.exit(1);
}
