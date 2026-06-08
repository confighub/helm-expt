// Generated execution waves for the current next-ten work queue.
//
// This is the compact reviewer-facing layer over existing detailed artifacts.
// It groups the next work into small waves without claiming that planned work
// has already passed.
//
//   node scripts/generate-next-ten-waves.mjs --generate
//   node scripts/generate-next-ten-waves.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "next-ten-waves");
const paths = {
  summary: join(outputRoot, "summary.md"),
  gaps: join(outputRoot, "gap-review-wave.csv"),
  latest: join(outputRoot, "latest-promotion-wave.csv"),
  variants: join(outputRoot, "variant-build-wave.csv"),
  production: join(outputRoot, "production-disposition-wave.csv"),
  importPrototype: join(outputRoot, "import-prototype-wave.csv"),
};

const productionPriority = [
  "bitnami/redis",
  "bitnami/nginx",
  "metrics-server/metrics-server",
  "prometheus-community/prometheus",
  "bitnami/postgresql",
];

if (mode === "--generate") {
  const report = buildReport();
  for (const [key, path] of Object.entries(paths)) write(path, report.outputs[key]);
  console.log(`wrote next-ten waves -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [key, path] of Object.entries(paths)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run next-ten:waves`);
    check(readFileSync(path, "utf8") === report.outputs[key], `${relativeRepo(path)} is stale; run npm run next-ten:waves`);
  }
  console.log(
    `verified next-ten waves: ${report.latestRows.length} latest, ${report.variantRows.length} variant, ${report.productionRows.length} production row(s)`,
  );
} else {
  console.log(`Usage:
  node scripts/generate-next-ten-waves.mjs --generate
  node scripts/generate-next-ten-waves.mjs --verify`);
}

function buildReport() {
  const secretGaps = parseCsvFile(join(repoRoot, "data", "attack-plan-workdown", "secret-gap-workdown.csv"));
  const crdGaps = parseCsvFile(join(repoRoot, "data", "attack-plan-workdown", "crd-gap-workdown.csv"));
  const latestCandidates = parseCsvFile(join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv"));
  const production = parseCsvFile(join(repoRoot, "data", "production-disposition", "top20.csv"));
  const importRows = parseCsvFile(join(repoRoot, "data", "attack-plan-workdown", "helm-import-contract.csv"));
  const wave2 = readYaml(join(repoRoot, "data", "catalog-promotion-wave2", "variant-work-orders.yaml"));

  const gapRows = [
    ...secretGaps.slice(0, 6).map((row) => gapRow(row, "existing-secret")),
    ...crdGaps.slice(0, 3).map((row) => gapRow(row, "no-crds")),
  ].map((row, index) => ({ priority: index + 1, ...row }));

  const latestRows = latestCandidates.map((row, index) => ({
    priority: index + 1,
    chart: row.chart,
    current_version: row.current_version,
    candidate_version: row.candidate_version,
    status: row.promotion_readiness,
    required_lanes: row.required_lanes_before_support,
    next_action: "run the full support lane before replacing the supported catalog version",
  }));

  const variantRows = (wave2.spec?.workOrders ?? []).map((order, index) => ({
    priority: index + 1,
    chart: order.chart,
    version: order.version,
    state: order.state,
    proposed_variants: (order.variants ?? []).map((variant) => variant.name).join(";"),
    blocking_questions: (order.variants ?? []).flatMap((variant) => variant.blockers ?? []).filter(Boolean).join(";"),
    next_action: "render the proposed variants, add package bases, then run equivalence, scan, gate, and runtime checks",
  }));

  const productionByChart = new Map(production.map((row) => [row.chart, row]));
  const productionRows = productionPriority.map((chart, index) => {
    const row = productionByChart.get(chart);
    check(row, `missing production row for ${chart}`);
    return {
      priority: index + 1,
      chart: row.chart,
      version: row.version,
      supported_variants: row.supported_variants,
      production_support: row.production_support,
      accepted_dispositions: row.accepted_dispositions,
      open_dispositions: row.open_dispositions,
      next_action: row.open_dispositions
        ? "write receipts for open dispositions, then rerun runtime/GitOps and image-digest lanes"
        : "rerun runtime/GitOps and image-digest lanes",
    };
  });

  const importPrototypeRows = importRows.map((row, index) => ({
    priority: index + 1,
    case: row.case,
    import_unit: row.import_unit,
    route: row.route,
    status: row.status,
    decision_rule: row.decision_rule,
    next_action: row.case === "public-chart-redis"
      ? "turn the contract into a CLI/user transcript once installer import exists"
      : "keep as a golden input for server-side variant and managed-overlay work",
  }));

  check(gapRows.length === 9, `expected 9 first gap-review rows; found ${gapRows.length}`);
  check(latestRows.length === 6, `expected 6 latest promotion rows; found ${latestRows.length}`);
  check(variantRows.length === 5, `expected 5 variant build rows; found ${variantRows.length}`);
  check(productionRows.length === 5, `expected 5 production disposition rows; found ${productionRows.length}`);
  check(importPrototypeRows.length === 3, `expected 3 import prototype rows; found ${importPrototypeRows.length}`);

  const outputs = {
    summary: summary({ gapRows, latestRows, variantRows, productionRows, importPrototypeRows }),
    gaps: csv(gapRows),
    latest: csv(latestRows),
    variants: csv(variantRows),
    production: csv(productionRows),
    importPrototype: csv(importPrototypeRows),
  };

  return { outputs, latestRows, variantRows, productionRows };
}

function gapRow(row, capability) {
  return {
    chart: row.chart,
    version: row.version,
    capability,
    proof_tier: row.proof_tier,
    gap: row.gap,
    route: row.route,
    next_action: row.next_action,
  };
}

function summary({ gapRows, latestRows, variantRows, productionRows, importPrototypeRows }) {
  return `# Next-Ten Waves

This generated directory turns the current execution plan into small work
queues. It is intentionally narrower than the full attack-plan workdown: these
are the next rows to work, not the whole corpus.

## Current Waves

\`\`\`text
gap-review first rows:             ${gapRows.length}
latest-version promotion rows:     ${latestRows.length}
variant-build rows:                ${variantRows.length}
production-disposition first rows: ${productionRows.length}
import prototype rows:             ${importPrototypeRows.length}
\`\`\`

## Files

| File | Purpose |
| --- | --- |
| \`gap-review-wave.csv\` | First existing-secret and CRD/no-CRDs hard gaps to review. |
| \`latest-promotion-wave.csv\` | Six latest top-20 candidates that are ready for full lane promotion work. |
| \`variant-build-wave.csv\` | Wave-2 chart variants to render and prove next. |
| \`production-disposition-wave.csv\` | First five catalog-supported charts to move toward production disposition. |
| \`import-prototype-wave.csv\` | Import examples that explain public chart, managed overlay, and post-render promotion routes. |

The production-disposition wave separates accepted dispositions from open
dispositions, so the queue shows only the production decisions still needing
receipts before the follow-up runtime/GitOps and image-digest lanes run.
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
