#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputPath = join(repoRoot, "data", "catalog-index", "summary.md");

const ROUTES = [
  {
    question: "Current headline status",
    openFirst: "data/status-dashboard/summary.md",
    csv: "data/status-dashboard/status.csv",
    field: "`section`, `metric`, `value`, `status`, `source`",
    note: "Use for counts and the current dashboard rollup. Follow `source` for drill-down.",
  },
  {
    question: "Can I use a specific top-100 chart?",
    openFirst: "data/chart-use-guide/summary.md",
    csv: "data/chart-use-guide/chart-use-guide.csv",
    field: "`answer`, `first_action`, `recommended_base_or_variant`, `catalog_path`",
    note: "Best first user-facing yes/no route. Does not replace per-chart receipts.",
  },
  {
    question: "What works, what needs prerequisites, and what is not ready?",
    openFirst: "data/top100-user-readiness/summary.md",
    csv: "data/top100-user-readiness/readiness.csv",
    field: "`bucket`, `user_must_provide`, `current_proof`, `next_action`",
    note: "Best single top-100 chart row for user-language status.",
  },
  {
    question: "Which top-100 rows need a better base?",
    openFirst: "data/useful-base-design-queue/summary.md",
    csv: "data/useful-base-design-queue/queue.csv",
    field: "`proposed_base`, `user_job`, `render_choices`, `proof_required`",
    note: "Use for default-shaped proof rows that should not be promoted as-is.",
  },
  {
    question: "Which useful bases have already been made real?",
    openFirst: "data/useful-base-realization-wave/summary.md",
    csv: "data/useful-base-realization-wave/wave.csv",
    field: "`chart`, `base`, `strategy`, `remaining_proof_work`",
    note: "Use after the design queue to see realized recipe/package bases.",
  },
  {
    question: "Which rows are blocked by a limitation decision?",
    openFirst: "data/top100-coverage/decisions-needed.md",
    csv: "data/top100-coverage/work-queue.csv",
    field: "`queue`, `missing_items`, `first_step`, `done_when`",
    note: "Use for support/disclose/defer/block decisions before promotion.",
  },
  {
    question: "Where is chart/base proof-lane evidence?",
    openFirst: "data/outcome-coverage/summary.md",
    csv: "data/outcome-coverage/base-outcomes.csv",
    field: "`render_parity`, `in_confighub`, `local_live`, `gitops_live`, `live_parity`",
    note: "Use for lane status by exact chart/base. `missing` is backlog, not failure.",
  },
  {
    question: "Where is strict top-100 coverage evidence?",
    openFirst: "data/top100-coverage/summary.md",
    csv: "data/top100-coverage/coverage.csv",
    field: "`coverage_status`, item statuses, evidence paths, `next_action`",
    note: "Use for the strict top-100 contract result and missing item list.",
  },
  {
    question: "What does the top-500 source/catalog scan say?",
    openFirst: "data/top500-catalog-analysis/summary.md",
    csv: "data/top500-catalog-analysis/review.csv",
    field: "`source_rank`, proof status, catalog status, drift, source features",
    note: "Use for planning beyond the maintained top-100/front-door set.",
  },
  {
    question: "Which hook-bearing rows have coverage or candidate routes?",
    openFirst: "data/hook-coverage/summary.md",
    csv: "data/hook-coverage/top100-hook-coverage.csv",
    field: "source hook signal, maintained lifecycle status, candidate route status",
    note: "Use for hook status without treating candidate routes as receipts.",
  },
  {
    question: "Which source quirks still need modeled catalog facts?",
    openFirst: "data/quirk-work-queue/summary.md",
    csv: "data/quirk-work-queue/top100-queue.csv",
    field: "`open_quirks`, `priority`, `first_action`, `next_artifact`",
    note: "Use for source-scan quirk work that could affect catalog trust.",
  },
  {
    question: "Which APIService rows need readiness or aggregation evidence?",
    openFirst: "data/apiservice-coverage/summary.md",
    csv: "data/apiservice-coverage/top100-apiservice-coverage.csv",
    field: "source signal, modeled status, object/workload evidence, aggregation evidence",
    note: "Use for APIService-specific evidence and work orders.",
  },
  {
    question: "Which rows have remote dependency closure risk?",
    openFirst: "data/remote-dependency-closure/summary.md",
    csv: "data/remote-dependency-closure/top100.csv",
    field: "dependency risk, maintained lock status, policy gap, next action",
    note: "Use before claiming strong provenance or refresh-survival coverage.",
  },
  {
    question: "Where are production-support decisions and evidence?",
    openFirst: "data/production-support-decisions/summary.md",
    csv: "data/production-support-decisions/decisions.csv",
    field: "`decision_state`, `target_scope`, evidence decision, `next_action`",
    note: "Use for target-scoped production claims. Catalog support is not enough.",
  },
  {
    question: "What should move next?",
    openFirst: "data/status-dashboard/summary.md",
    csv: "data/status-dashboard/next-work-queues.csv",
    field: "`section`, `queue`, `count`, `next_action`, `source`",
    note: "Use for assignment routing across top100, production, live parity, and lifecycle queues.",
  },
];

const STATUS_FIELDS = [
  ["`chart-use-guide.answer`", "`yes-public-catalog`, `not-yet-public-catalog-proof-ready`, `not-yet-user-ready`, `decision-needed-first`"],
  ["`top100-user-readiness.bucket`", "`ready-to-try`, `works-with-target-prerequisites`, `works-with-operator-review`, `needs-better-base-variant`, `not-ready-yet`"],
  ["`outcome-coverage` lane cells", "`pass`, `missing`, `watch`, `blocked`, `fail` where committed receipts define the row status"],
  ["`status-dashboard.status`", "`good`, `partial`, `gap` as dashboard rollup labels, not per-chart verdicts"],
];

if (mode === "--generate") {
  write(outputPath, buildMarkdown());
  console.log("wrote catalog data index");
} else if (mode === "--verify") {
  const expected = buildMarkdown();
  check(existsSync(outputPath), "data/catalog-index/summary.md is missing; run node scripts/generate-catalog-index.mjs --generate");
  check(readFileSync(outputPath, "utf8") === expected, "data/catalog-index/summary.md is stale; run node scripts/generate-catalog-index.mjs --generate");
  console.log("verified catalog data index");
} else {
  console.log(`Usage:
  node scripts/generate-catalog-index.mjs --generate
  node scripts/generate-catalog-index.mjs --verify`);
  process.exit(1);
}

function buildMarkdown() {
  const csvIndex = csvIndexByPath();
  for (const route of ROUTES) {
    check(existsSync(join(repoRoot, route.openFirst)), `${route.openFirst} is missing`);
    check(existsSync(join(repoRoot, route.csv)), `${route.csv} is missing`);
    check(csvIndex.has(route.csv), `${route.csv} is missing from data/csv-index.csv`);
  }

  return `# Catalog Data Index

Generated. Do not edit by hand.

~~~sh
node scripts/generate-catalog-index.mjs --generate
node scripts/generate-catalog-index.mjs --verify
~~~

This is a routing index for top100/top500 catalog data. It does not introduce a
new status field. Pick the question, open the smallest summary, then use the
listed CSV as the authoritative spreadsheet row source.

## Question Routes

| Question | Open first | Authoritative CSV | Fields to read | Notes |
| --- | --- | --- | --- | --- |
${ROUTES.map((route) => routeRow(route, csvIndex)).join("\n")}

## Existing Status Fields

Use existing fields before adding another label.

| Field | Values to expect |
| --- | --- |
${STATUS_FIELDS.map(([field, values]) => `| ${field} | ${values} |`).join("\n")}

## Maintenance Rule

When a routed CSV changes, run that CSV's owner generator and verifier first.
Then regenerate this page and the root data index:

~~~sh
node scripts/generate-catalog-index.mjs --generate
npm run data:index
node scripts/generate-catalog-index.mjs --verify
npm run data:index:verify
~~~

No live tests are required for this routing page.
`;
}

function routeRow(route, csvIndex) {
  const csv = csvIndex.get(route.csv);
  const note = `${route.note} Owner verify: \`${csv.verify || "n/a"}\`.`;
  return `| ${route.question} | ${link(route.openFirst)} | ${link(route.csv)} | ${route.field} | ${note} |`;
}

function link(path) {
  return `[${path.replace("data/", "")}](${relativeFromCatalogIndex(path)})`;
}

function relativeFromCatalogIndex(path) {
  return path.startsWith("data/") ? `../${path.slice("data/".length)}` : `../../${path}`;
}

function csvIndexByPath() {
  const rows = readCsv(join(repoRoot, "data", "csv-index.csv"));
  return new Map(rows.map((row) => [row.path, row]));
}

function readCsv(path) {
  const text = readFileSync(path, "utf8");
  const rows = parseCsv(text);
  const headers = rows.shift() ?? [];
  return rows
    .filter((row) => row.length > 1 || (row[0] ?? "").trim() !== "")
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
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
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
