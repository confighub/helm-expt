// Generate the quirk work queue: turn the quirk inventory audit's
// source-vs-modeled gaps into a ranked, chart-level work queue.
//
// Scope: the source top-100 (rank <= 100 in the committed source feature
// scan). For each chart it records which untracked quirk axes are present,
// joins the modeled and proof state where the chart is in the modeled
// corpus, scores user risk x catalog leverage, and emits one concrete first
// action. Scoring rules are documented in the generated summary; the queue
// invents no new evidence.
//
// Usage:
//   node scripts/generate-quirk-work-queue.mjs            # generate
//   node scripts/generate-quirk-work-queue.mjs --verify   # check committed
//
// No npm alias on purpose; package.json is owned by another workstream.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCES = {
  scan: "data/top500-catalog-analysis/source/source-feature-scan.raw.json",
  readiness: "data/top100-readiness/readiness.csv",
  hookCandidates: "data/hook-route-candidates/candidates.csv",
  hookQueue: "data/hook-lifecycle/top100-hooks.csv",
};

const OUTPUTS = {
  csv: "data/quirk-work-queue/top100-queue.csv",
  summary: "data/quirk-work-queue/summary.md",
};

// The untracked or under-modeled quirk axes from the quirk inventory audit
// (data/quirk-inventory-audit/), with user-risk weights and the concrete
// first action each implies. Weights: 3 = provenance/refresh risk that can
// change what ships, 2 = runtime surface with no modeled axis, 1 =
// render-conditional behavior interacting with the pinned profile.
const AXES = [
  {
    key: "remote-dependencies",
    weight: 3,
    present: (r) => count(r.remoteDependencyRepos) > 0,
    detail: (r) => `${count(r.remoteDependencyRepos)} remote dependency repo(s)`,
    action: "record remote dependency repos and vendoring/pin status as chart facts",
  },
  {
    key: "non-exact-dependencies",
    weight: 3,
    present: (r) => count(r.nonExactDependencyConstraints) > 0,
    detail: (r) => `${count(r.nonExactDependencyConstraints)} non-exact dependency constraint(s)`,
    action: "record non-exact dependency constraints and the pinned resolution as chart facts",
  },
  {
    key: "apiservice",
    weight: 2,
    present: (r) => count(r.apiServices) > 0,
    detail: (r) => `${count(r.apiServices)} APIService object(s)`,
    action: "model APIService aggregation as a capability/target fact with a preflight check",
  },
  {
    key: "hooks-unmodeled",
    weight: 2,
    present: (r, ctx) => count(r.hooks) > 0 && !ctx.hookModeled.has(chartKey(r)),
    detail: (r) => `${count(r.hooks)} hook template(s) outside the maintained queue`,
    action: "create or promote a hook route candidate (see data/hook-route-candidates/)",
  },
  {
    key: "semvercompare",
    weight: 1,
    present: (r) => count(r.semverCompare) > 0,
    detail: (r) => `${count(r.semverCompare)} semverCompare call site(s)`,
    action: "add a version-conditional rendering note to the pain report; bind claims to the capability profile",
  },
  {
    key: "files-get",
    weight: 1,
    present: (r) => count(r.filesGet) > 0,
    detail: (r) => `${count(r.filesGet)} .Files.Get call site(s)`,
    action: "record file-payload provenance in chart facts (payloads bypass values review)",
  },
];

const TIER_WEIGHT = {
  "top20-catalog-supported": 3,
  "works-as-proof-needs-catalog-review": 2,
};

function count(value) {
  if (value == null) return 0;
  if (typeof value === "object") return value.count ?? 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  return Number(value) || 0;
}

function chartKey(scanRow) {
  return `${scanRow.repository}/${scanRow.name}`;
}

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

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(header, rows) {
  return [header.join(","), ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(","))].join("\n") + "\n";
}

function buildReport() {
  const scan = JSON.parse(readFileSync(join(repoRoot, SOURCES.scan), "utf8"))
    .filter((row) => (row.rank ?? 9999) <= 100);
  const readiness = new Map(
    parseCsv(readFileSync(join(repoRoot, SOURCES.readiness), "utf8")).map((row) => {
      const at = row.chart.lastIndexOf("@");
      return [at === -1 ? row.chart : row.chart.slice(0, at), row];
    }),
  );
  const hookModeled = new Set(
    parseCsv(readFileSync(join(repoRoot, SOURCES.hookQueue), "utf8")).map((row) => row.chart),
  );
  const hookCandidates = new Set(
    parseCsv(readFileSync(join(repoRoot, SOURCES.hookCandidates), "utf8")).map((row) => row.chart),
  );
  const ctx = { hookModeled };

  const rows = [];
  for (const scanRow of scan) {
    const chart = chartKey(scanRow);
    const hits = AXES.filter((axis) => axis.present(scanRow, ctx));
    if (!hits.length) continue;
    const modeled = readiness.get(chart);
    const tier = modeled?.catalog_tier ?? "not-modeled";
    const leverage = TIER_WEIGHT[modeled?.workability === "try-now-public-catalog" ? "top20-catalog-supported" : tier] ?? (TIER_WEIGHT[tier] ?? 1);
    const risk = hits.reduce((sum, axis) => sum + axis.weight, 0);
    const first = hits.slice().sort((a, b) => b.weight - a.weight)[0];
    const firstAction = first.key === "hooks-unmodeled" && hookCandidates.has(chart)
      ? "promote the existing hook route candidate (data/hook-route-candidates/)"
      : first.action;
    rows.push({
      priority_rank: 0,
      chart,
      version: scanRow.version,
      source_rank: scanRow.rank,
      catalog_tier: tier,
      gap_axes: hits.map((axis) => axis.key).join(";"),
      gap_detail: hits.map((axis) => axis.detail(scanRow)).join("; "),
      modeled_state: modeled?.user_status ?? "not-modeled",
      proof_state: modeled?.strongest_evidence || "none",
      user_risk_score: risk,
      leverage_score: leverage,
      priority_score: risk * leverage,
      first_action: firstAction,
    });
  }

  rows.sort((a, b) => b.priority_score - a.priority_score || a.source_rank - b.source_rank);
  rows.forEach((row, idx) => {
    row.priority_rank = idx + 1;
  });

  const header = [
    "priority_rank",
    "chart",
    "version",
    "source_rank",
    "catalog_tier",
    "gap_axes",
    "gap_detail",
    "modeled_state",
    "proof_state",
    "user_risk_score",
    "leverage_score",
    "priority_score",
    "first_action",
  ];
  return { rows, csv: toCsv(header, rows), summary: summaryMarkdown(rows) };
}

function summaryMarkdown(rows) {
  const axisCounts = Object.fromEntries(AXES.map((axis) => [axis.key, rows.filter((row) => row.gap_axes.split(";").includes(axis.key)).length]));
  const lines = [];
  lines.push("# Quirk Work Queue (Source Top-100)");
  lines.push("");
  lines.push("Generated. Do not edit by hand.");
  lines.push("");
  lines.push("```sh");
  lines.push("node scripts/generate-quirk-work-queue.mjs            # regenerate");
  lines.push("node scripts/generate-quirk-work-queue.mjs --verify   # check");
  lines.push("```");
  lines.push("");
  lines.push(
    "This queue turns the [quirk inventory audit](../quirk-inventory-audit/summary.md) gaps into chart-level work. Scope: the source top-100. A chart appears when it carries at least one under-modeled quirk axis; rank = user-risk weight times catalog leverage. Source state, modeled state, and proof state stay separate columns; nothing here is a proof claim. Full table: [top100-queue.csv](./top100-queue.csv).");
  lines.push("");
  lines.push("## Scoring");
  lines.push("");
  lines.push("| Axis | Weight | First action it implies |");
  lines.push("| --- | --- | --- |");
  for (const axis of AXES) {
    lines.push(`| ${axis.key} | ${axis.weight} | ${axis.action} |`);
  }
  lines.push("");
  lines.push("Leverage: top-20 catalog charts 3 (claims are strongest there, so untracked quirks cost the most credibility), promotion-review charts 2, everything else 1. Priority = risk x leverage; ties break by source rank.");
  lines.push("");
  lines.push(`## Queue Size Per Axis (of ${rows.length} queued charts)`);
  lines.push("");
  lines.push("| Axis | Charts |");
  lines.push("| --- | --- |");
  for (const axis of AXES) {
    lines.push(`| ${axis.key} | ${axisCounts[axis.key]} |`);
  }
  lines.push("");
  lines.push("## Highest-Leverage Charts");
  lines.push("");
  lines.push("| # | Chart | Tier | Gaps | First action |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const row of rows.slice(0, 10)) {
    lines.push(`| ${row.priority_rank} | ${row.chart}@${row.version} | ${row.catalog_tier} | ${row.gap_axes} | ${row.first_action} |`);
  }
  lines.push("");
  lines.push("## Boundaries");
  lines.push("");
  lines.push("- Source counts come from the committed static source feature scan; modeled and proof state from the maintained readiness data. The source and modeled top-100s are different lists; `not-modeled` rows are source-only charts.");
  lines.push("- A queue position is prioritization, not a defect claim, and never a proof claim.");
  lines.push("- Weights are editorial and documented above; change them in the generator, not the output.");
  lines.push("");
  return lines.join("\n");
}

function generate() {
  const report = buildReport();
  mkdirSync(join(repoRoot, "data/quirk-work-queue"), { recursive: true });
  writeFileSync(join(repoRoot, OUTPUTS.csv), report.csv);
  writeFileSync(join(repoRoot, OUTPUTS.summary), report.summary);
  console.log(`wrote ${OUTPUTS.csv} (${report.rows.length} rows) and ${OUTPUTS.summary}`);
}

function verify() {
  const report = buildReport();
  const problems = [];
  for (const [key, path] of Object.entries(OUTPUTS)) {
    const absolute = join(repoRoot, path);
    if (!existsSync(absolute)) {
      problems.push(`${path} is missing; run node scripts/generate-quirk-work-queue.mjs`);
      continue;
    }
    const expected = key === "csv" ? report.csv : report.summary;
    if (readFileSync(absolute, "utf8") !== expected) {
      problems.push(`${path} is stale; run node scripts/generate-quirk-work-queue.mjs`);
    }
  }
  if (!report.rows.length) problems.push("queue derived zero rows; sources missing or empty");
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log(`verified quirk work queue (${report.rows.length} charts)`);
}

const mode = process.argv[2] ?? "--generate";
if (mode === "--generate") generate();
else if (mode === "--verify") verify();
else {
  console.error(`unknown mode ${mode}; use --generate or --verify`);
  process.exit(1);
}
