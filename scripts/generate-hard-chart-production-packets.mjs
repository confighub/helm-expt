#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "hard-chart-production-packets");
const packetsRoot = join(outputRoot, "packets");
const summaryPath = join(outputRoot, "summary.md");
const packetsCsvPath = join(outputRoot, "packets.csv");

const sources = {
  support: join(repoRoot, "data", "production-support-decisions", "decisions.csv"),
  disposition: join(repoRoot, "data", "production-disposition", "top20.csv"),
  baseReadiness: join(repoRoot, "data", "top20-base-readiness", "base-readiness.csv"),
  userReadiness: join(repoRoot, "data", "top100-user-readiness", "readiness.csv"),
  extensionSlots: join(repoRoot, "data", "extension-slots", "extension-slots.csv"),
  chartUseGuide: join(repoRoot, "data", "chart-use-guide", "chart-use-guide.csv"),
};

const hardCharts = [
  {
    chart: "prometheus-community/kube-prometheus-stack",
    reason:
      "Large monitoring stack with CRDs, admission webhooks, hooks, RBAC, generated facts, extension slots, high fanout, and upgrade-sensitive operator behavior.",
    safeUse:
      "Use the default base only inside the declared support scope while keeping the target-scoped evidence fresh. Treat no-crds and hardened monitoring profiles as separate support decisions.",
  },
  {
    chart: "jetstack/cert-manager",
    reason: "CRD-owning certificate controller with webhook readiness, startup API checks, lifecycle ordering, and issuer/certificate follow-on configuration.",
    safeUse:
      "Use crds-enabled as the first supported base. Treat issuer/provider/hardened resource shapes as separate bases or derived variants with fresh target evidence.",
  },
  {
    chart: "external-secrets/external-secrets",
    reason:
      "CRD-owning secrets controller where install readiness, webhook Secret delivery, and provider SecretStore/ExternalSecret reconciliation are separate lifecycle facts.",
    safeUse:
      "Use default for the controller install with the recorded separated-Secret prerequisite. The disposable fake-provider round trip is proven; production providers and credentials still need separate bases, overlays, or derived variants with provider-specific evidence.",
  },
  {
    chart: "argo-cd/argo-cd",
    reason: "GitOps control plane with CRDs, repository credentials, optional self-management, SSO, backup/restore, and bootstrap-order concerns.",
    safeUse:
      "Use default for the declared proof scope. Hardened, self-managed, repository-credential, SSO, or backup/restore paths need separate support decisions.",
  },
  {
    chart: "grafana/loki",
    reason: "Stateful logging system with CRDs, storage mode choices, retention/backups, object-store decisions, and security trade-offs.",
    safeUse:
      "Use single-binary-filesystem for the declared local proof scope. Object-store, retention, backup, restore, tenant, and hardened profiles need separate bases.",
  },
  {
    chart: "hashicorp/consul",
    reason: "Service-mesh control plane with TLS, ACL, gateway/UI options, storage/quorum choices, webhooks, and secret prerequisites.",
    safeUse:
      "Use default-control-plane for the declared proof scope. Secure mesh, TLS, ACL, gateway, UI, production quorum, and digest-pinned paths need separate bases.",
  },
  {
    chart: "hashicorp/vault",
    reason: "Security-sensitive stateful system where dev-mode is useful for parity but not a production support claim.",
    safeUse:
      "Use dev-mode only for local/demo proof. A production Vault base must cover init/unseal, storage, TLS, backup/restore, and operator runbook evidence.",
  },
  {
    chart: "longhorn/longhorn",
    reason: "Privileged storage infrastructure with CRDs, webhooks, node components, backup/restore expectations, and target-cluster assumptions.",
    safeUse:
      "Use default only inside the declared privileged storage proof scope. Backup/restore, upgrade, replica policy, UI ingress, and hardening need separate support decisions.",
  },
];

if (mode === "--generate") {
  const report = buildReport();
  rmSync(packetsRoot, { recursive: true, force: true });
  write(summaryPath, report.summary);
  write(packetsCsvPath, report.csv);
  for (const packet of report.packetFiles) write(packet.path, packet.contents);
  console.log(`wrote ${report.rows.length} hard chart production packet(s)`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "missing hard chart production packet summary; run npm run hard-charts:packets");
  check(existsSync(packetsCsvPath), "missing hard chart production packet CSV; run npm run hard-charts:packets");
  check(readFileSync(summaryPath, "utf8") === report.summary, "hard chart production packet summary is stale; run npm run hard-charts:packets");
  check(readFileSync(packetsCsvPath, "utf8") === report.csv, "hard chart production packet CSV is stale; run npm run hard-charts:packets");
  const expectedFiles = new Map(report.packetFiles.map((packet) => [packet.path, packet.contents]));
  for (const [path, contents] of expectedFiles) {
    check(existsSync(path), `missing hard chart packet ${relativeRepo(path)}; run npm run hard-charts:packets`);
    check(readFileSync(path, "utf8") === contents, `hard chart packet ${relativeRepo(path)} is stale; run npm run hard-charts:packets`);
  }
  console.log(`verified ${report.rows.length} hard chart production packet(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-hard-chart-production-packets.mjs --generate
  node scripts/generate-hard-chart-production-packets.mjs --verify`);
}

function buildReport() {
  const supportRows = parseCsvFile(sources.support);
  const dispositionRows = parseCsvFile(sources.disposition);
  const baseRows = parseCsvFile(sources.baseReadiness);
  const userRows = parseCsvFile(sources.userReadiness);
  const extensionRows = parseCsvFile(sources.extensionSlots);
  const chartUseRows = parseCsvFile(sources.chartUseGuide);

  const rows = hardCharts.map((entry) =>
    packetRow(entry, {
      supportRows,
      dispositionRows,
      baseRows,
      userRows,
      extensionRows,
      chartUseRows,
    }),
  );
  const packetFiles = rows.map((row) => ({
    path: join(packetsRoot, `${row.slug}.md`),
    contents: packetMarkdown(row),
  }));
  return {
    rows,
    packetFiles,
    summary: summaryMarkdown(rows),
    csv: toCsv(rows),
  };
}

function packetRow(entry, data) {
  const support = findByChart(data.supportRows, entry.chart);
  check(support, `missing production support decision for ${entry.chart}`);
  const chartVersion = `${support.chart}@${support.version}`;
  const disposition = data.dispositionRows.find((row) => row.chart === support.chart && row.version === support.version);
  check(disposition, `missing production disposition row for ${chartVersion}`);
  const bases = data.baseRows.filter((row) => row.chart === chartVersion);
  check(bases.length > 0, `missing base readiness rows for ${chartVersion}`);
  const userReadiness = data.userRows.find((row) => row.chart === support.chart && row.version === support.version);
  const extension = data.extensionRows.find((row) => row.chart === chartVersion);
  const chartUse = data.chartUseRows.find((row) => row.chart === chartVersion);
  const slug = support.chart.replaceAll("/", "-");
  const packetPath = `data/hard-chart-production-packets/packets/${slug}.md`;

  return {
    chart: support.chart,
    version: support.version,
    chart_version: chartVersion,
    slug,
    why_hard: entry.reason,
    decision: support.decision,
    supported_base: support.supported_base,
    supported_variants: disposition.supported_variants,
    production_disposition: disposition.production_support,
    target_scope: support.target_scope,
    delivery_path: support.delivery_path,
    evidence_count: support.evidence_count,
    live_evidence_decision: support.live_evidence_decision,
    lifecycle_decision: support.lifecycle_decision,
    scan_decision: support.scan_decision,
    image_decision: support.image_decision,
    target_fact_decision: support.target_fact_decision,
    safe_today: entry.safeUse,
    broader_support_work: support.next_action,
    quirks: userReadiness?.quirks ?? "",
    user_must_provide: userReadiness?.user_must_provide ?? "",
    confighub_absorbs: userReadiness?.confighub_absorbs ?? "",
    extension_slot_route: extension?.route ?? "",
    strongest_evidence: chartUse?.strongest_evidence ?? "",
    live_summary: chartUse?.live_summary ?? "",
    base_count: String(bases.length),
    start_here_bases: bases.filter((row) => row.user_readiness === "start-here").map((row) => row.base).join(";"),
    non_start_bases: bases.filter((row) => row.user_readiness !== "start-here").map((row) => `${row.base}:${row.user_readiness}`).join(";"),
    base_rows: bases,
    support_decision_path: support.path,
    production_disposition_path: "data/production-disposition/top20.csv",
    catalog_path: `recipes/${support.chart}/${support.version}/CATALOG.md`,
    package_path: `packages/${support.chart}/${support.version}`,
    pain_report: `recipes/${support.chart}/${support.version}/helm-pain-report.yaml`,
    public_chart_page: `site/charts/${chartPageFileName(support)}.html`,
    packet_path: packetPath,
  };
}

function summaryMarkdown(rows) {
  const supported = rows.filter((row) => row.decision === "supported").length;
  const rejected = rows.filter((row) => row.decision === "rejected").length;
  const superseded = rows.filter((row) => row.decision === "superseded").length;
  const blocked = rows.filter((row) => row.production_disposition === "blocked").length;
  return `# Hard Chart Production Packets

This generated packet set gathers the evidence for the charts most likely to
raise serious production questions. It does not create new support claims. It
joins existing production support decisions, production disposition rows, base
readiness, chart-use guidance, extension-slot routing, and per-chart pain
reports.

Use this when a reviewer asks whether the model survives hard Helm charts:
operators, CRDs, hooks, webhooks, storage, security-sensitive systems, GitOps
control planes, and high-fanout monitoring stacks.

## Summary

\`\`\`text
packet charts: ${rows.length}
supported for a declared target scope: ${supported}
rejected for production support: ${rejected}
superseded: ${superseded}
production-disposition blocked: ${blocked}
\`\`\`

## Packets

| Chart | Supported base | Decision | Production disposition | Safe today | Packet |
| --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart_version}\` | ${md(row.supported_base)} | ${md(row.decision)} | ${md(row.production_disposition)} | ${md(shorten(row.safe_today, 130))} | [packet](./packets/${row.slug}.md) |`).join("\n")}

## How To Read These

- \`supported\` means target-scoped support for the named base and target scope.
- \`rejected\` means the evidence remains useful, but the base is not a
  production support offer.
- A hard chart can pass render parity and live evidence while still requiring a
  separate support decision for another base, target, storage mode, provider, or
  overlay.
- These packets should be regenerated after support decisions, production
  disposition, base readiness, or chart pages change.

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
`;
}

function packetMarkdown(row) {
  const packetDir = dirname(join(repoRoot, row.packet_path));
  return `# ${row.chart_version} Production Packet

This generated packet summarizes the current support story for a hard chart. It
is a navigation surface over existing evidence, not a new support decision.

## Current Answer

| Field | Value |
| --- | --- |
| Supported base | \`${row.supported_base}\` |
| Support decision | \`${row.decision}\` |
| Production disposition | \`${row.production_disposition}\` |
| Target scope | ${md(row.target_scope)} |
| Delivery path | \`${row.delivery_path}\` |
| Evidence count | ${row.evidence_count} |
| Strongest user-facing evidence | ${md(row.strongest_evidence || "see linked receipts")} |
| Live summary | ${md(row.live_summary || "see linked receipts")} |

## Why This Chart Is Hard

${row.why_hard}

## What A User Can Safely Do Today

${row.safe_today}

## What Remains Before Broader Production Use

${row.broader_support_work}

## Bases

| Base | User readiness | Lane summary | Target facts | Command |
| --- | --- | --- | --- | --- |
${row.base_rows.map((base) => `| \`${base.base}\` | ${md(base.user_readiness)} | ${md(baseLaneSummary(base))} | ${md(base.target_facts || "none")} | \`${base.command}\` |`).join("\n")}

## Quirks And Inputs

| Field | Value |
| --- | --- |
| Quirks surfaced | ${md(row.quirks || "none recorded")} |
| User must provide | ${md(row.user_must_provide || "nothing beyond the declared target scope")} |
| ConfigHub / installer absorbs | ${md(row.confighub_absorbs || "see pain report")} |
| Extension slot route | ${md(row.extension_slot_route || "none recorded")} |

## Decision Details

| Decision | State |
| --- | --- |
| Image policy | \`${row.image_decision}\` |
| Scan policy | \`${row.scan_decision}\` |
| Lifecycle policy | \`${row.lifecycle_decision}\` |
| Target facts | \`${row.target_fact_decision}\` |
| Live evidence | \`${row.live_evidence_decision}\` |

## Evidence Links

- [Production support decision](${linkFrom(packetDir, row.support_decision_path)})
- [Production disposition table](${linkFrom(packetDir, row.production_disposition_path)})
- [Per-chart catalog](${linkFrom(packetDir, row.catalog_path)})
- [Installer package](${linkFrom(packetDir, row.package_path)})
- [Helm pain report](${linkFrom(packetDir, row.pain_report)})
- [Public chart page](${linkFrom(packetDir, row.public_chart_page)})

Regenerate:

~~~sh
npm run hard-charts:packets
npm run hard-charts:packets:verify
~~~
`;
}

function findByChart(rows, chart) {
  return rows.find((row) => row.chart === chart);
}

function baseLaneSummary(base) {
  return [
    `render=${base.render_parity}`,
    `confighub=${base.in_confighub}`,
    `local=${base.local_live}`,
    `gitops=${base.gitops_oci_live}`,
    `live-parity=${base.live_helm_vs_confighub_parity}`,
    `two-cluster=${base.two_cluster_kind_parity}`,
    base.lifecycle_observation ? `lifecycle=${base.lifecycle_observation}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function parseCsvFile(path) {
  check(existsSync(path), `missing ${relativeRepo(path)}`);
  return parseCsv(readFileSync(path, "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function toCsv(rows) {
  const headers = [
    "chart",
    "version",
    "supported_base",
    "decision",
    "production_disposition",
    "target_scope",
    "evidence_count",
    "strongest_evidence",
    "live_summary",
    "why_hard",
    "safe_today",
    "broader_support_work",
    "quirks",
    "user_must_provide",
    "confighub_absorbs",
    "base_count",
    "start_here_bases",
    "non_start_bases",
    "support_decision_path",
    "packet_path",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function md(value) {
  return String(value).replaceAll("|", "\\|");
}

function shorten(value, length) {
  const text = String(value);
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
}

function linkFrom(fromDir, target) {
  const targetPath = join(repoRoot, target);
  return relative(fromDir, targetPath).replaceAll("\\", "/");
}

function relativeRepo(path) {
  return relative(repoRoot, path).replaceAll("\\", "/");
}

function chartPageFileName(row) {
  return `${row.chart}-${row.version}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
