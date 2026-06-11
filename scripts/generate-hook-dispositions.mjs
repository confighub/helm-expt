#!/usr/bin/env node

// Top-100 hook disposition table.
//
// One row per hook-bearing source-top-100 chart with a single selected
// disposition: observed, routed, refused, per-target, or recipe-needed.
// Joins the source hook inventory, the maintained hook queue, the route
// candidates, and the worked evidence under data/hook-disposition/evidence/.
//
// The --verify mode HARD-FAILS when any hook-bearing chart lacks a
// disposition row, when a disposition is outside the vocabulary, or when a
// cited evidence path does not exist. That is the completeness contract:
// hooks stop being a static count.
//
//   node scripts/generate-hook-dispositions.mjs --generate
//   node scripts/generate-hook-dispositions.mjs --verify

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "hook-disposition");
const outputs = {
  csv: join(outDir, "top100-hook-dispositions.csv"),
  summary: join(outDir, "summary.md"),
};

const DISPOSITIONS = ["observed", "routed", "refused", "per-target", "recipe-needed"];

// Worked evidence registered by this lane. Paths are verified to exist.
const WORKED = {
  "bitnami/kafka": {
    evidence: [
      "data/hook-disposition/evidence/bitnami-kafka/evidence.yaml",
      "data/hook-disposition/evidence/bitnami-kafka/hook-resources.yaml",
      "data/hook-disposition/evidence/bitnami-kafka/live-rehearsal-blocker-receipt.yaml",
    ],
    evidenceStatus: "render-proven (values-conditional) + live rehearsal attempted",
    liveStatus: "blocked: pinned default image tag no longer exists upstream (see blocker receipt)",
    nextAction:
      "create an image-override or digest-pinned base, then re-run the provisioning-Job route rehearsal",
  },
  "kong/kong": {
    evidence: [
      "data/hook-disposition/evidence/kong-kong/evidence.yaml",
      "data/hook-disposition/evidence/kong-kong/hook-resources.yaml",
    ],
    evidenceStatus: "render-proven: hooks absent in DB-less default, present in postgres mode",
    liveStatus: "none (postgres-mode rehearsal needs a database and pullable images)",
    nextAction:
      "create the recipe with DB-less and postgres bases; rehearse the migration pair against a database",
  },
  "k8s-dashboard/kubernetes-dashboard": {
    evidence: [
      "data/hook-disposition/evidence/k8s-dashboard-kubernetes-dashboard/evidence.yaml",
      "data/hook-disposition/evidence/k8s-dashboard-kubernetes-dashboard/hook-resources.yaml",
    ],
    evidenceStatus:
      "render-proven: vendored kong hooks DO NOT render under default values; appear only in postgres mode",
    liveStatus: "none (default base is hook-inert; no rehearsal needed for it)",
    nextAction:
      "record hook-inert-under-default-values for the default base at recipe time; keep the route plan for postgres-mode bases",
  },
  "airflow-helm/airflow": {
    evidence: [
      "data/hook-disposition/evidence/airflow-helm-airflow/evidence.yaml",
      "data/hook-disposition/evidence/airflow-helm-airflow/hook-resources.yaml",
      "data/hook-disposition/evidence/airflow-helm-airflow/live-rehearsal-blocker-receipt.yaml",
    ],
    evidenceStatus:
      "render-proven: default is hook-free (migrations run as a Deployment); runAsJob=true renders the hook Job",
    liveStatus: "blocked before attempt: dependency closure + image-availability preconditions (see blocker receipt)",
    nextAction:
      "decide the supported migration mode (Deployment vs hook Job) at recipe time; rehearse after image preconditions clear",
  },
};

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

function readCsv(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(header, rows) {
  return [header.join(","), ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(","))].join("\n") + "\n";
}

function dependencySource(hookExamples, chart) {
  const examples = (hookExamples ?? "").split(";").map((entry) => entry.trim()).filter(Boolean);
  const vendored = new Set();
  let chartOwn = false;
  for (const example of examples) {
    const match = example.match(/charts\/([^/]+)\//);
    if (match) vendored.add(match[1]);
    else chartOwn = true;
  }
  if (vendored.size && chartOwn) return `chart-own + vendored (${[...vendored].join(", ")})`;
  if (vendored.size) return `vendored (${[...vendored].join(", ")})`;
  return "chart-own";
}

function buildReport() {
  const source = readCsv("data/hook-lifecycle/source-top100-hooks.csv");
  const maintained = new Map(readCsv("data/hook-lifecycle/receipt-index.csv").map((row) => [row.chart, row]));
  const candidates = new Map(readCsv("data/hook-route-candidates/candidates.csv").map((row) => [row.chart, row]));

  const rows = source.map((row) => {
    const chart = row.chart;
    const queue = maintained.get(chart);
    const candidate = candidates.get(chart);
    const worked = WORKED[chart];

    let disposition;
    let route;
    let evidenceStatus;
    let liveStatus;
    let nextAction;
    let evidence = [];

    if (queue) {
      disposition = "observed";
      route = queue.route_hint || queue.recommended_route;
      evidenceStatus = `maintained queue receipt (${queue.receipt_status})`;
      liveStatus = queue.receipt_status;
      nextAction = "keep the receipt fresh when chart, base, or cluster version changes";
      evidence = ["data/hook-lifecycle/receipt-index.csv", queue.required_receipt].filter(Boolean);
    } else if (chart === "datadog/datadog") {
      disposition = "per-target";
      route = candidate?.candidate_route ?? "target-class-preflight-and-upgrade-action";
      evidenceStatus = "candidate route plan; hooks are environment-conditional (GKE Autopilot preflight vs migration upgrade action)";
      liveStatus = "none";
      nextAction = candidate?.promotion_next_step ?? "split routes per target class at recipe time";
      evidence = ["data/hook-route-candidates/candidates.csv"];
    } else if (worked) {
      disposition = "routed";
      route = candidate?.candidate_route ?? "see evidence";
      evidenceStatus = worked.evidenceStatus;
      liveStatus = worked.liveStatus;
      nextAction = worked.nextAction;
      evidence = worked.evidence;
    } else if (candidate) {
      disposition = "recipe-needed";
      route = candidate.candidate_route;
      evidenceStatus = "candidate route plan only (static source scan)";
      liveStatus = "none";
      nextAction = candidate.promotion_next_step;
      evidence = ["data/hook-route-candidates/candidates.csv"];
    } else {
      disposition = "recipe-needed";
      route = "unrouted";
      evidenceStatus = "source scan only";
      liveStatus = "none";
      nextAction = "create a route candidate, then a recipe";
      evidence = ["data/hook-lifecycle/source-top100-hooks.csv"];
    }

    return {
      rank: row.rank,
      chart,
      version: row.version,
      source_hook_count: row.hook_count,
      dependency_source: dependencySource(row.hook_examples, chart),
      hook_phases: row.hook_types,
      disposition,
      selected_route: route,
      evidence_status: evidenceStatus,
      live_status: liveStatus,
      next_action: nextAction,
      evidence: evidence.join(";"),
    };
  });

  const header = [
    "rank",
    "chart",
    "version",
    "source_hook_count",
    "dependency_source",
    "hook_phases",
    "disposition",
    "selected_route",
    "evidence_status",
    "live_status",
    "next_action",
    "evidence",
  ];
  return { rows, csv: toCsv(header, rows), summary: summaryMarkdown(rows) };
}

function summaryMarkdown(rows) {
  const counts = {};
  for (const row of rows) counts[row.disposition] = (counts[row.disposition] ?? 0) + 1;
  const lines = [];
  lines.push("# Top-100 Hook Dispositions");
  lines.push("");
  lines.push("Generated. Do not edit by hand.");
  lines.push("");
  lines.push("```sh");
  lines.push("node scripts/generate-hook-dispositions.mjs            # regenerate");
  lines.push("node scripts/generate-hook-dispositions.mjs --verify   # completeness gate");
  lines.push("```");
  lines.push("");
  lines.push(
    "One row per hook-bearing source-top-100 chart, with one selected disposition. The verify mode fails if any hook-bearing chart lacks a disposition, so hooks cannot regress into a static count. Vocabulary and claim boundaries: [what hook support means](../../docs/reference/what-hook-support-means.md). Full table: [top100-hook-dispositions.csv](./top100-hook-dispositions.csv).");
  lines.push("");
  lines.push("| Disposition | Charts | Meaning |");
  lines.push("| --- | --- | --- |");
  const meaning = {
    observed: "A maintained hook lifecycle receipt exists from a live run.",
    routed: "A route is selected and worked evidence exists (rendered hook resources; live attempted or explicitly blocked).",
    "per-target": "The right route depends on the target cluster class; no single route claim is honest.",
    refused: "The hook behavior is explicitly not supported, with a refusal receipt.",
    "recipe-needed": "A route plan exists but the chart has no recipe, so no maintained lifecycle work can attach yet.",
  };
  for (const d of DISPOSITIONS) {
    if (counts[d]) lines.push(`| ${d} | ${counts[d]} | ${meaning[d]} |`);
  }
  lines.push("");
  lines.push("| # | Chart | Hooks | Dependency source | Disposition | Live status |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.chart}@${row.version} | ${row.source_hook_count} (${row.hook_phases}) | ${row.dependency_source} | ${row.disposition} | ${row.live_status} |`,
    );
  }
  lines.push("");
  lines.push("Notes:");
  lines.push("");
  lines.push("- Dependency-provided hooks are first-class: the dependency_source column names the vendored subchart that ships the hook.");
  lines.push("- The maintained queue also observes charts outside the source top-100 (tigera-operator, gatekeeper); they are tracked in data/hook-lifecycle/, not here.");
  lines.push("- bitnami/minio's worked evidence is owned by the active rehearsal lane and is deliberately not duplicated here.");
  lines.push("");
  return lines.join("\n");
}

function verifyReport(report) {
  const source = readCsv("data/hook-lifecycle/source-top100-hooks.csv");
  check(report.rows.length === source.length, `disposition rows (${report.rows.length}) != hook-bearing source charts (${source.length})`);
  for (const row of report.rows) {
    check(DISPOSITIONS.includes(row.disposition), `${row.chart}: disposition "${row.disposition}" outside vocabulary`);
    check(row.selected_route.trim() !== "", `${row.chart}: empty route`);
    check(row.next_action.trim() !== "", `${row.chart}: empty next action`);
    for (const path of row.evidence.split(";").filter(Boolean)) {
      check(existsSync(join(repoRoot, path)), `${row.chart}: cited evidence missing: ${path}`);
    }
  }
}

if (mode === "--generate") {
  const report = buildReport();
  verifyReport(report);
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote ${relativeRepo(outputs.csv)} (${report.rows.length} rows) and ${relativeRepo(outputs.summary)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  verifyReport(report);
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run node scripts/generate-hook-dispositions.mjs`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run node scripts/generate-hook-dispositions.mjs`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run node scripts/generate-hook-dispositions.mjs`);
  console.log(`verified hook dispositions (${report.rows.length} charts, all dispositioned)`);
} else {
  console.error(`unknown mode ${mode}; use --generate or --verify`);
  process.exit(1);
}
