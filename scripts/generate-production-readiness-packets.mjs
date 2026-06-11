#!/usr/bin/env node

// Production-readiness packets for the serious charts.
//
// A reviewer-facing layer over the hard-chart production packets: for each
// selected chart it answers, in one page, the seven questions a sceptical
// user asks - first base, quirks, render parity, live parity, what is only
// watch/per-target/manual, what production decision remains, and the exact
// next test - plus the claims that must not be made yet. Every section
// links generated data instead of restating counts.
//
//   node scripts/generate-production-readiness-packets.mjs --generate
//   node scripts/generate-production-readiness-packets.mjs --verify

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outRoot = join(repoRoot, "data", "production-readiness-packets");

const CHARTS = [
  {
    slug: "kube-prometheus-stack",
    chart: "prometheus-community/kube-prometheus-stack",
    packet: "data/hard-chart-production-packets/packets/prometheus-community-kube-prometheus-stack.md",
    whyHard:
      "CRDs, admission webhooks with hook-driven cert patching, cluster RBAC, generated facts, large fanout, dependency-locked subcharts, and real image/security surface in one install.",
    extraLive: [
      [
        "Live CRD upgrade rehearsal 85.3.3 -> 86.1.0 (API-server apply of the new CRDs over the old)",
        "data/serious-chart-reviews/kube-prometheus-stack.csv",
      ],
      [
        "Render-level CRD upgrade delta (6/10 CRDs change; all additive)",
        "data/serious-chart-reviews/kps-crd-upgrade-delta-85.3.3-to-86.1.0.yaml",
      ],
      [
        "Regular Helm workload upgrade rehearsal 85.3.3 -> 86.1.0 (install, workloads Ready, upgrade, workloads Ready)",
        "runs/serious-chart-reviews/kube-prometheus-stack/workload-upgrade-live/latest/receipt.yaml",
      ],
      [
        "No-CRDs two-cluster live parity with explicit CRD and admission Secret target facts staged",
        "runs/live-kind-parity/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml",
      ],
    ],
    mustNot: [
      "\"ConfigHub upgrades are proven\" - the workload-upgrade receipt exercises regular Helm on one kind profile, not ConfigHub upgrade orchestration",
      "\"all upgrades are proven\" - no rollback, soak, private overlay, no-crds, or production target upgrade has been receipted",
      "\"webhook runtime lifecycle is proven for this chart\" - the observed pattern lives on cert-manager/external-secrets; this chart's own operator webhook lifecycle has no receipt",
    ],
    nextTest:
      "a ConfigHub-managed upgrade or target-scoped no-crds GitOps/OCI evidence showing how compatible external CRDs and the admission Secret are supplied",
  },
  {
    slug: "cert-manager",
    chart: "jetstack/cert-manager",
    packet: "data/hard-chart-production-packets/packets/jetstack-cert-manager.md",
    whyHard:
      "CRD-heavy controller with webhooks, CA injection, and controller-owned runtime state; the canonical case where 'synced' and 'working' diverge.",
    extraLive: [
      [
        "CRD/webhook/controller runtime lifecycle observations",
        "data/lifecycle-observations/cert-manager-eso/summary.md",
      ],
      [
        "SelectableFields capability-profile witness on kind Kubernetes 1.35",
        "data/capability-profile-witnesses/selectablefields/receipts/jetstack-cert-manager-crds-enabled-kind-1.35.yaml",
      ],
    ],
    mustNot: [
      "\"strict rendered-object/live parity holds on Kubernetes 1.30\" - the strict witness BLOCKs: rendered CRDs author selectableFields, which the 1.30 API drops; routed on the watchlist, parity for that profile is deliberately not claimed",
    ],
    nextTest:
      "keep the target-scoped evidence fresh; create separate issuer, certificate, provider, or hardened resource bases before claiming real customer certificate workflows",
  },
  {
    slug: "external-secrets",
    chart: "external-secrets/external-secrets",
    packet: "data/hard-chart-production-packets/packets/external-secrets-external-secrets.md",
    whyHard:
      "CRDs plus webhooks plus an external-system dependency by design: the chart's whole job is reconciling secrets from providers the cluster cannot prove locally.",
    extraLive: [
      [
        "CRD/webhook/controller runtime lifecycle observations",
        "data/lifecycle-observations/cert-manager-eso/summary.md",
      ],
      [
        "ConfigHub OCI default-base rehearsal: Argo synced, runtime blocked on separated webhook Secret delivery",
        "data/runtime-gitops/receipts/external-secrets-external-secrets/default/latest.yaml",
      ],
      [
        "ConfigHub OCI default-base rehearsal with separated webhook Secret pre-staged: Argo synced and runtime became healthy",
        "data/runtime-gitops/receipts/external-secrets-external-secrets/default-prestaged-secret/latest.yaml",
      ],
      [
        "ConfigHub OCI default-base rehearsal with fake-provider SecretStore and ExternalSecret round trip",
        "data/runtime-gitops/receipts/external-secrets-external-secrets/default-fake-provider-roundtrip/latest.yaml",
      ],
      [
        "SelectableFields capability-profile witness on kind Kubernetes 1.35",
        "data/capability-profile-witnesses/selectablefields/receipts/external-secrets-external-secrets-default-kind-1.35.yaml",
      ],
    ],
    mustNot: [
      "\"strict rendered-object/live parity holds on Kubernetes 1.30\" - same selectableFields watchlist row as cert-manager; not claimed for that profile",
      "\"external-secrets/default is live-ready through workload-only OCI\" - the workload-only rehearsal blocks; the passing rehearsal requires the separated external-secrets-webhook Secret to be staged as an explicit prerequisite",
      "\"production providers are proven\" - the provider round-trip receipt uses the disposable fake provider; AWS, Vault, Kubernetes, GCP, Azure, and provider credential behavior still need separate evidence",
    ],
    nextTest:
      "keep the target-scoped evidence fresh; create separate provider-specific, credential, resource-hardened, or profile-specific bases for real customer External Secrets workloads",
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
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
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

const read = (path) => readFileSync(join(repoRoot, path), "utf8");

function buildPacket(target, sources) {
  const packetRow = sources.packets.find((row) => row.chart === target.chart);
  check(packetRow, `${target.chart}: no hard-chart packet row`);
  const kindParity = sources.kindParity.filter((row) => row.chart === target.chart);
  const liveE2e = sources.liveE2e.find((row) => target.chart.endsWith(row.chart) || row.chart === target.chart.split("/")[1]);
  const watch = sources.watchlist.filter((row) => target.chart.includes(row.chart.split("/")[1] ?? row.chart));
  const hook = sources.hooks.find((row) => row.chart === target.chart);
  const workItem = sources.workItems.find((row) => row.chart === target.chart);
  const supportDecision = sources.supportDecisions.find((row) => row.chart === target.chart);
  const supportedBase = supportDecision?.supported_base || packetRow.supported_base;
  const decision = supportDecision?.decision || packetRow.decision;
  const targetScope = supportDecision?.target_scope || packetRow.target_scope;

  const lines = [];
  lines.push(`# ${target.chart} Production-Readiness Packet`);
  lines.push("");
  lines.push("Generated. Do not edit by hand. This packet answers the reviewer questions");
  lines.push("in one place and links the generated evidence; it makes no new claims.");
  lines.push(`Companion navigation packet: [hard-chart packet](../../../${target.packet}).`);
  lines.push("");
  lines.push("## Why this chart matters");
  lines.push("");
  lines.push(target.whyHard);
  lines.push("");
  lines.push("## What should a serious user try first?");
  lines.push("");
  lines.push(`Base \`${supportedBase}\` - support decision \`${decision}\`, disposition \`${packetRow.production_disposition}\`, bounded to target scope: ${targetScope}.`);
  if (supportDecision) {
    lines.push("");
    lines.push(`Support decision evidence: \`${supportDecision.live_evidence_decision || "-"}\` ([decision](../../../${supportDecision.path})).`);
  }
  lines.push("");
  lines.push("## Quirks");
  lines.push("");
  lines.push(`${packetRow.quirks}`);
  lines.push("");
  lines.push(`You provide: ${packetRow.user_must_provide || "see packet"}. Absorbed for you: ${packetRow.confighub_absorbs || "see packet"}.`);
  if (hook) {
    lines.push("");
    lines.push(`Hook disposition: \`${hook.disposition}\` (${hook.hook_phases}; dependency source: ${hook.dependency_source}) - [hook dispositions](../../../data/hook-disposition/summary.md).`);
  }
  lines.push("");
  lines.push("## What is at render parity?");
  lines.push("");
  lines.push(`Lane summary: ${packetRow.live_summary}. Authoritative per-lane rows: [outcome coverage](../../../data/outcome-coverage/summary.md).`);
  lines.push("");
  lines.push("## What is at live parity?");
  lines.push("");
  for (const row of kindParity) {
    lines.push(`- two-cluster kind parity, base \`${row.base}\`: ${row.result || row.status || "see summary"} ([receipt](../../../${(row.receipt || row.receipt_path || "data/live-kind-parity/summary.md").trim()}))`);
  }
  if (liveE2e) {
    lines.push(`- local kind live e2e: ${liveE2e.result}, strict witness \`${liveE2e.cubScout || "-"}\` (${liveE2e.cubScoutChecks || "-"})`);
  }
  for (const [label, path] of target.extraLive) {
    lines.push(`- ${label} ([evidence](../../../${path}))`);
  }
  lines.push("");
  lines.push("## What is only watch, per-target, or manual?");
  lines.push("");
  if (watch.length) {
    for (const row of watch) {
      lines.push(`- WATCH/BLOCK (routed): ${row.issue} - route: ${row.route} ([watchlist](../../../data/live-e2e/cub-scout-watchlist.md))`);
    }
  } else {
    lines.push("- no routed watchlist rows for this chart today ([watchlist](../../../data/live-e2e/cub-scout-watchlist.md))");
  }
  if (decision === "supported") {
    lines.push(`- every supported claim is per-target: the decision above covers \`${targetScope}\` and nothing broader`);
  } else {
    lines.push(`- no final production support is claimed yet: the draft scope is \`${targetScope}\` and must be closed before support is claimed`);
  }
  lines.push("");
  lines.push("## What production support work remains?");
  lines.push("");
  if (supportDecision && supportDecision.decision !== "supported") {
    lines.push(`The support decision is \`${supportDecision.decision}\`; live evidence is \`${supportDecision.live_evidence_decision || "-"}\`.`);
    if (supportDecision.remaining_final_requirements) {
      lines.push("");
      lines.push("Required before final support:");
      lines.push("");
      for (const requirement of splitCsvList(supportDecision.remaining_final_requirements)) {
        lines.push(`- ${requirement}`);
      }
    }
    lines.push("");
    lines.push(`Next action: ${supportDecision.next_action}`);
  } else {
    lines.push(`The target-scoped support decision is \`${decision}\`. ${packetRow.broader_support_work || "Keep evidence fresh before using this support scope."}`);
  }
  if (workItem) {
    lines.push("");
    lines.push(`Current work item: ${workItem.work_type || workItem.kind || "keep-fresh"} - [work items](../../../data/production-support-decisions/work-items.csv).`);
  }
  lines.push("");
  lines.push("## Claims we must not make yet");
  lines.push("");
  for (const claim of target.mustNot) lines.push(`- ${claim}`);
  lines.push("- \"production-supported beyond the named target scope\" - support is a per-scope decision");
  lines.push("- \"works on any Kubernetes\" - live claims are bounded to the tested capability profile");
  lines.push("");
  lines.push("## The exact next test");
  lines.push("");
  lines.push(target.nextTest + ".");
  lines.push("");
  return lines.join("\n");
}

function buildAll() {
  const sources = {
    packets: parseCsv(read("data/hard-chart-production-packets/packets.csv")),
    kindParity: parseCsv(read("data/live-kind-parity/summary.csv")),
    liveE2e: parseCsv(read("data/live-e2e/top20-local-kind.csv")),
    watchlist: parseCsv(read("data/live-e2e/cub-scout-watchlist.csv")),
    hooks: parseCsv(read("data/hook-disposition/top100-hook-dispositions.csv")),
    supportDecisions: parseCsv(read("data/production-support-decisions/decisions.csv")),
    workItems: parseCsv(read("data/production-support-decisions/work-items.csv")),
  };
  return CHARTS.map((target) => ({ target, content: buildPacket(target, sources) }));
}

function splitCsvList(value) {
  return value
    .split(/;\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

if (mode === "--generate") {
  for (const { target, content } of buildAll()) {
    write(join(outRoot, target.slug, "packet.md"), content);
  }
  console.log(`wrote ${CHARTS.length} production-readiness packets under ${relativeRepo(outRoot)}`);
} else if (mode === "--verify") {
  for (const { target, content } of buildAll()) {
    const path = join(outRoot, target.slug, "packet.md");
    check(existsSync(path), `${relativeRepo(path)} is missing; run node scripts/generate-production-readiness-packets.mjs`);
    check(readFileSync(path, "utf8") === content, `${relativeRepo(path)} is stale; run node scripts/generate-production-readiness-packets.mjs`);
  }
  console.log(`verified ${CHARTS.length} production-readiness packets`);
} else {
  console.error(`unknown mode ${mode}; use --generate or --verify`);
  process.exit(1);
}
