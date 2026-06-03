// Generated first-wave runtime/GitOps work plan.
//
// This script does not run a cluster. It selects the first small set of
// already local-tested catalog entries that should receive Argo/Flux OCI live
// receipts next, and keeps that selection tied to the broader top-100 sweep.
//
//   node scripts/generate-runtime-gitops-wave.mjs --generate
//   node scripts/generate-runtime-gitops-wave.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "runtime-gitops");
const paths = {
  wave1: join(outputRoot, "wave1.csv"),
  receiptIndex: join(outputRoot, "receipt-index.csv"),
  summary: join(outputRoot, "summary.md"),
};

const firstWave = [
  { chart: "bitnami/redis", base: "reuse-existing-secret", controller: "Flux OCI" },
  { chart: "bitnami/nginx", base: "http-clusterip", controller: "Argo CD OCI" },
  { chart: "metrics-server/metrics-server", base: "default", controller: "Argo CD OCI" },
  { chart: "prometheus-community/prometheus", base: "server-only-ephemeral", controller: "Flux OCI" },
  { chart: "bitnami/postgresql", base: "existing-secret", controller: "Flux OCI" },
  { chart: "external-secrets/external-secrets", base: "no-crds", controller: "Argo CD OCI" },
  { chart: "ingress-nginx/ingress-nginx", base: "admission-disabled", controller: "Argo CD OCI" },
  { chart: "argo-cd/argo-cd", base: "no-crds", controller: "Argo CD OCI" },
  { chart: "prometheus-community/kube-prometheus-stack", base: "no-crds", controller: "Flux OCI" },
  { chart: "hashicorp/consul", base: "secure-mesh-existing-secrets", controller: "Flux OCI" },
];

if (mode === "--generate") {
  const report = buildReport();
  write(paths.wave1, report.outputs.wave1);
  write(paths.receiptIndex, report.outputs.receiptIndex);
  write(paths.summary, report.outputs.summary);
  console.log(`wrote runtime/GitOps wave -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [key, path] of Object.entries(paths)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run runtime-gitops:wave`);
    check(readFileSync(path, "utf8") === report.outputs[key], `${relativeRepo(path)} is stale; run npm run runtime-gitops:wave`);
  }
  console.log(`verified runtime/GitOps wave: ${report.waveRows.length} first-wave chart/base pair(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-runtime-gitops-wave.mjs --generate
  node scripts/generate-runtime-gitops-wave.mjs --verify`);
}

function buildReport() {
  const sweepRows = parseCsvFile(join(repoRoot, "data", "attack-plan-workdown", "runtime-gitops-sweep.csv"));
  const productionRows = parseCsvFile(join(repoRoot, "data", "production-disposition", "top20.csv"));
  const sweepByChart = new Map(sweepRows.map((row) => [row.chart, row]));
  const productionByChart = new Map(productionRows.map((row) => [row.chart, row]));

  const waveRows = firstWave.map((selection, index) => {
    const sweep = sweepByChart.get(selection.chart);
    const production = productionByChart.get(selection.chart);
    check(sweep, `missing runtime sweep row for ${selection.chart}`);
    check(production, `missing production row for ${selection.chart}`);
    check(
      splitList(production.supported_variants).includes(selection.base),
      `${selection.chart} ${selection.base} is not a supported top-20 base`,
    );

    const packagePath = `packages/${selection.chart}/${sweep.version}`;
    const recipePath = `recipes/${selection.chart}/${sweep.version}`;
    const receiptPath = `data/runtime-gitops/receipts/${slug(selection.chart)}/${selection.base}/latest.yaml`;
    return {
      wave: 1,
      priority: index + 1,
      chart: selection.chart,
      version: sweep.version,
      base: selection.base,
      controller: selection.controller,
      current_evidence: production.live_e2e,
      status: production.live_e2e === "local-kind-observed" ? "ready-for-gitops-live-run" : "blocked-until-local-runtime",
      package_path: packagePath,
      recipe_path: recipePath,
      required_receipt: receiptPath,
      next_action: "publish/upload the selected base, let the declared OCI controller sync it, then commit the runtime/GitOps observation receipt",
    };
  });

  const receiptRows = waveRows.map((row) => ({
    chart: row.chart,
    version: row.version,
    base: row.base,
    controller: row.controller,
    required_receipt: row.required_receipt,
    receipt_status: existsSync(join(repoRoot, row.required_receipt)) ? "present" : "not-yet-written",
    minimum_checks: [
      "ConfigHub OCI artifact digest recorded",
      "GitOps controller observed synced revision",
      "Kubernetes resources ready",
      "workload-specific smoke check passes where applicable",
      "freshness timestamp recorded",
    ].join(";"),
  }));

  check(waveRows.length === 10, `expected 10 runtime/GitOps first-wave rows; found ${waveRows.length}`);
  check(receiptRows.every((row) => row.receipt_status === "not-yet-written"), "runtime/GitOps wave receipts should not be pre-claimed");

  const outputs = {
    wave1: csv(waveRows),
    receiptIndex: csv(receiptRows),
    summary: summary(waveRows, receiptRows, sweepRows),
  };

  return { outputs, waveRows };
}

function summary(waveRows, receiptRows, sweepRows) {
  const localTop100 = sweepRows.filter((row) => row.current_runtime_evidence === "local-kind-observed").length;
  const argo = waveRows.filter((row) => row.controller === "Argo CD OCI").length;
  const flux = waveRows.filter((row) => row.controller === "Flux OCI").length;
  return `# Runtime/GitOps Wave

This generated file selects the first runtime/GitOps live-proof wave. The
top-20 already has local-kind evidence. This wave is the next step: prove that
selected catalog bases can be delivered by an OCI-capable GitOps controller and
observed back with a receipt.

## Current Reading

\`\`\`text
top-100 runtime rows:             ${sweepRows.length}
top-100 rows with local evidence: ${localTop100}
first-wave chart/base pairs:      ${waveRows.length}
Argo CD OCI lanes:                ${argo}
Flux OCI lanes:                   ${flux}
first-wave receipts present:      ${receiptRows.filter((row) => row.receipt_status === "present").length}
\`\`\`

## Files

| File | Purpose |
| --- | --- |
| \`wave1.csv\` | The first chart/base/controller pairs to run live through GitOps OCI. |
| \`receipt-index.csv\` | The required receipt path and minimum checks for each first-wave run. |

## Rule

Local-kind evidence is not the same as GitOps/OCI evidence. A row is not
GitOps-proven until the receipt under \`data/runtime-gitops/receipts/\` exists
and verifies the controller, artifact digest, sync result, runtime checks, and
freshness timestamp.
`;
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(path, "utf8"));
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

function splitList(value) {
  return String(value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function csv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function slug(value) {
  return value.replaceAll("/", "-");
}
