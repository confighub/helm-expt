import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, toYaml, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "latest-top20-refresh", "production-disposition");
const yamlPath = join(root, "candidate-production-disposition.yaml");
const summaryPath = join(root, "summary.md");
const csvPath = join(root, "summary.csv");
const readinessPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");

if (mode === "--generate") {
  const report = buildReport();
  writeOutputs(report);
  verify();
  console.log(`wrote latest candidate production disposition for ${report.rows.length} candidate(s)`);
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/generate-latest-candidate-production-disposition.mjs --generate
  node scripts/generate-latest-candidate-production-disposition.mjs --verify`);
}

function verify() {
  check(existsSync(yamlPath), `${relativeRepo(yamlPath)} is missing`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing`);
  check(existsSync(csvPath), `${relativeRepo(csvPath)} is missing`);
  const report = buildReport();
  check(readFileSync(yamlPath, "utf8") === report.yaml, `${relativeRepo(yamlPath)} is stale`);
  check(readFileSync(summaryPath, "utf8") === report.summary, `${relativeRepo(summaryPath)} is stale`);
  check(readFileSync(csvPath, "utf8") === report.csv, `${relativeRepo(csvPath)} is stale`);
  check(report.rows.length === 6, `expected 6 latest candidate disposition rows; found ${report.rows.length}`);
  check(report.rows.every((row) => row.proof_status === "proof-complete"), "latest candidate production disposition requires complete proof lanes");
  check(report.rows.every((row) => row.production_support_status === "not-production-supported"), "candidate report must not promote production support");
  console.log(`verified latest candidate production disposition: ${report.rows.length} candidate(s), production support not claimed`);
}

function buildReport() {
  const rows = parseCsv(readFileSync(readinessPath, "utf8")).map(candidateRow);
  const doc = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "LatestCandidateProductionDisposition",
    metadata: {
      name: "latest-top20-refresh-production-disposition",
      generatedBy: "scripts/generate-latest-candidate-production-disposition.mjs",
    },
    spec: {
      claim: "retained update candidates have proof lanes recorded, but are not production-supported until target-scoped support decisions are made",
      rows: rows.map((row) => ({
        chart: row.chart,
        currentVersion: row.current_version,
        candidateVersion: row.candidate_version,
        primaryBase: row.primary_base,
        proofStatus: row.proof_status,
        productionSupportStatus: row.production_support_status,
        productionBoundary: row.production_boundary,
        decisionTopics: splitList(row.decision_topics),
        evidence: {
          candidateRecipe: row.candidate_recipe,
          candidatePackage: row.candidate_package,
          configHubProofReceipt: row.confighub_proof_receipt,
          localLiveReceipt: row.local_live_receipt,
          liveParityReceipt: row.live_parity_receipt,
        },
        nextAction: row.next_action,
      })),
    },
  };
  return {
    rows,
    yaml: `${toYaml(doc)}\n`,
    summary: toSummary(rows),
    csv: toCsv(rows),
  };
}

function candidateRow(row) {
  const primaryBase = primaryLatestCandidateBase(row);
  const recipeRoot = join(repoRoot, row.candidate_recipe);
  const controls = readYaml(join(recipeRoot, "control-points.yaml"));
  const helmPlan = readYaml(join(recipeRoot, "helm-plan.yaml"));
  const configHubProofReceipt = `runs/latest-top20-refresh/${slug(row.chart)}-${row.candidate_version}/confighub-proof/latest/confighub-proof-receipt.yaml`;
  const localLiveReceipt = `runs/latest-top20-refresh/${slug(row.chart)}-${row.candidate_version}/local-kind/observation-receipt.json`;
  const liveParityReceipt = `runs/latest-top20-refresh/${slug(row.chart)}-${row.candidate_version}/live-parity/${primaryBase}/receipt.yaml`;
  const proofChecks = [
    existsSync(join(repoRoot, configHubProofReceipt)),
    localLivePass(localLiveReceipt),
    liveParityPass(liveParityReceipt),
  ];
  const topics = dispositionTopics(controls.spec?.points ?? []);
  const proofStatus = proofChecks.every(Boolean) ? "proof-complete" : "proof-incomplete";
  return {
    chart: row.chart,
    current_version: row.current_version,
    candidate_version: row.candidate_version,
    variants: row.variants,
    primary_base: primaryBase,
    proof_status: proofStatus,
    production_support_status: "not-production-supported",
    production_boundary: "candidate may proceed to production review only after target-scoped support decisions accept or route each topic",
    decision_topics: topics.join(";"),
    scan_gate: helmPlan.spec?.readiness?.scanGate ?? "",
    next_action: nextAction({ proofStatus, topics, row }),
    candidate_recipe: row.candidate_recipe,
    candidate_package: row.candidate_package,
    confighub_proof_receipt: configHubProofReceipt,
    local_live_receipt: localLiveReceipt,
    live_parity_receipt: liveParityReceipt,
  };
}

function dispositionTopics(points) {
  const categories = new Set(points.map((point) => point.category));
  const has = (...names) => names.some((name) => categories.has(name));
  const result = new Set(["scan/gate warning disposition"]);
  if (has("crd-policy", "crds", "crd-lifecycle", "crd-ownership")) result.add("CRD lifecycle and upgrade policy");
  if (has("admission-webhook", "webhooks", "webhook-secret")) result.add("webhook readiness and failure policy");
  if (has("cluster-rbac")) result.add("cluster RBAC review");
  if (has("stateful-workload", "stateful-storage", "pvc-policy", "storage-retention")) {
    result.add("storage backup restore and rollback policy");
  }
  if (has("generated-facts", "hook-generated-secret")) result.add("generated fact ownership");
  if (has("target-facts")) result.add("target fact preflight");
  if (has("hook-policy", "lifecycle-policy")) result.add("hook and lifecycle phase policy");
  if (has("tpl", "extension-slots", "tpl-extension-slots", "scrape-config")) {
    result.add("extension slot provenance and scan policy");
  }
  if (has("image-digest")) result.add("image digest support decision");
  if (has("edge-ingress-policy")) result.add("ingress and edge exposure policy");
  return [...result].sort();
}

function localLivePass(path) {
  const fullPath = join(repoRoot, path);
  if (!existsSync(fullPath)) return false;
  const receipt = JSON.parse(readFileSync(fullPath, "utf8"));
  return receipt.spec?.result === "pass";
}

function liveParityPass(path) {
  const fullPath = join(repoRoot, path);
  if (!existsSync(fullPath)) return false;
  const receipt = readYaml(fullPath);
  return receipt.spec?.result === "pass";
}

function nextAction({ proofStatus, topics, row }) {
  if (proofStatus !== "proof-complete") return "finish ConfigHub proof, local live e2e, and live parity before production review";
  return `review ${topics.length} production decision topic(s), then decide whether ${row.chart}@${row.candidate_version} can replace ${row.current_version}`;
}

function toSummary(rows) {
  const proofComplete = rows.filter((row) => row.proof_status === "proof-complete").length;
  const notSupported = rows.filter((row) => row.production_support_status === "not-production-supported").length;
  const topicRows = rows.map(
    (row) =>
      `| \`${row.chart}@${row.candidate_version}\` | ${row.primary_base} | ${row.proof_status} | ${row.production_support_status} | ${splitList(row.decision_topics).length} | ${row.scan_gate} | ${row.next_action} |`,
  );
  return `# Retained Candidate Production Disposition

This report records the production boundary for retained proof-complete update
candidates.

It does not promote these versions and does not claim production support. It
states that the candidate proof lanes are present, then lists the decision
topics that still need a target-scoped support decision before a candidate can
replace the current supported catalog version.

\`\`\`text
candidate charts: ${rows.length}
proof-complete: ${proofComplete} / ${rows.length}
not production-supported: ${notSupported} / ${rows.length}
\`\`\`

| Candidate | Primary base | Proof status | Production support | Decision topics | Scan gate | Next action |
| --- | --- | --- | --- | ---: | --- | --- |
${topicRows.join("\n")}

## Evidence

The machine-readable form is:

\`\`\`text
data/latest-top20-refresh/production-disposition/candidate-production-disposition.yaml
\`\`\`

The spreadsheet form is:

\`\`\`text
data/latest-top20-refresh/production-disposition/summary.csv
\`\`\`
`;
}

function toCsv(rows) {
  const headers = [
    "chart",
    "current_version",
    "candidate_version",
    "variants",
    "primary_base",
    "proof_status",
    "production_support_status",
    "production_boundary",
    "decision_topics",
    "scan_gate",
    "next_action",
    "candidate_recipe",
    "candidate_package",
    "confighub_proof_receipt",
    "local_live_receipt",
    "live_parity_receipt",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function writeOutputs(report) {
  write(yamlPath, report.yaml);
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
}

function primaryLatestCandidateBase(row) {
  const primaryByChart = new Map([
    ["argo-cd/argo-cd", "default"],
    ["bitnami/mongodb", "generated-passwords"],
    ["bitnami/nginx", "http-clusterip"],
    ["bitnami/postgresql", "generated-passwords"],
    ["prometheus-community/kube-prometheus-stack", "default"],
    ["prometheus-community/prometheus", "server-only-ephemeral"],
  ]);
  const base = primaryByChart.get(row.chart);
  check(base, `no primary latest-candidate base configured for ${row.chart}`);
  return base;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function splitList(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slug(chart) {
  return chart.split("/").at(-1).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
