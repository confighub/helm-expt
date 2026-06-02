// Quirk review queue — turns the Level-2 residue (every needs-operator-decision disposition across the
// catalog's helm-pain-report.yaml files) into a prioritized, classified, actionable backlog. It does NOT
// resolve dispositions (that is per-chart SME/build work — auto-resolving would be cosmetic). It organizes
// the disclosed residue so it can be worked down honestly.
//
//   node scripts/generate-quirk-review-queue.mjs --generate
//   node scripts/generate-quirk-review-queue.mjs --verify
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "quirk-review-queue");
const csvPath = join(outputRoot, "queue.csv");
const summaryPath = join(outputRoot, "summary.md");
const mode = process.argv[2] ?? "--generate";

// Classify each quirk category by HOW it gets resolved — never asserting it IS resolved.
// standard = a known catalog-wide ConfigHub home; a reviewer confirms the standard disposition applies.
// build    = needs a concrete artifact built (a variant) before it can be called handled.
// sme      = genuine per-chart judgment (could be benign or a real blocker); a human must decide.
function classify(category) {
  const c = String(category).toLowerCase();
  if (/tpl|extension|hook-policy|lifecycle|deprecation|platform-variant|runtime-risk|gitops-handoff|blocked-default/.test(c)) return "sme";
  if (/secret|rotation/.test(c)) return "build";
  return "standard";
}

const RESOLUTION = {
  standard: "confirm the catalog-wide ConfigHub home applies (CRD lifecycle / scan+admission gate / operate policy / ingress policy)",
  build: "build the variant that handles it (existing-secret base, rotation variant) then re-disposition",
  sme: "per-chart human call: confirm safe (lifecycle policy / explicit extension owner) OR mark an honest blocker",
};

if (mode === "--generate") {
  const report = buildReport();
  mkdirSync(outputRoot, { recursive: true });
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  console.log(`wrote ${relativeRepo(csvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
  console.log(`residue: ${report.total} flagged quirks across ${report.chartCount} charts (standard ${report.byClass.standard}, build ${report.byClass.build}, sme ${report.byClass.sme})`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath) && readFileSync(csvPath, "utf8") === report.csv, "quirk-review-queue queue.csv is stale; run npm run quirk-queue:generate");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === report.summary, "quirk-review-queue summary.md is stale; run npm run quirk-queue:generate");
  console.log(`verified quirk-review-queue (${report.total} flagged quirks across ${report.chartCount} charts)`);
} else {
  console.log("usage: node scripts/generate-quirk-review-queue.mjs --generate|--verify");
}

function buildReport() {
  const reports = listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/helm-pain-report.yaml"))
    .sort();
  const flags = [];
  for (const path of reports) {
    const data = readYaml(path);
    const chart = `${data.spec?.chart?.name}@${data.spec?.chart?.version}`;
    for (const point of data.spec?.painPoints ?? []) {
      if (String(point.disposition) !== "needs-operator-decision") continue;
      const category = String(point.id ?? "").replace(/-[0-9]+$/, "");
      flags.push({ chart, category, klass: classify(category), home: point.configHubHome ?? "" });
    }
  }
  const charts = new Set(flags.map((f) => f.chart));
  const byClass = { standard: 0, build: 0, sme: 0 };
  for (const f of flags) byClass[f.klass]++;
  const byCategory = {};
  for (const f of flags) {
    byCategory[f.category] ??= { klass: f.klass, count: 0, charts: new Set() };
    byCategory[f.category].count++;
    byCategory[f.category].charts.add(f.chart);
  }
  return {
    total: flags.length,
    chartCount: charts.size,
    byClass,
    csv: toCsv(flags),
    summary: toSummary({ total: flags.length, chartCount: charts.size, byClass, byCategory }),
  };
}

function toCsv(flags) {
  const headers = ["chart", "category", "class", "confighub_home"];
  const rows = flags
    .slice()
    .sort((a, b) => a.klass.localeCompare(b.klass) || a.category.localeCompare(b.category) || a.chart.localeCompare(b.chart))
    .map((f) => [f.chart, f.category, f.klass, f.home].map(csvEscape).join(","));
  return `${[headers.join(","), ...rows].join("\n")}\n`;
}

function toSummary({ total, chartCount, byClass, byCategory }) {
  const order = { standard: 0, build: 1, sme: 2 };
  const cats = Object.entries(byCategory).sort(
    ([, a], [, b]) => order[a.klass] - order[b.klass] || b.count - a.count,
  );
  const section = (klass, title) =>
    `### ${title}\n\n_Resolution: ${RESOLUTION[klass]}_\n\n| Category | Flags | Charts |\n| --- | ---: | ---: |\n` +
    cats
      .filter(([, v]) => v.klass === klass)
      .map(([cat, v]) => `| \`${cat}\` | ${v.count} | ${v.charts.size} |`)
      .join("\n");
  return `# Quirk Review Queue — the Level-2 residue, made actionable

Every \`needs-operator-decision\` disposition across the catalog's \`helm-pain-report.yaml\` files. These are the
quirks that are **disclosed** (so the chart is Level-2 supported) but **not yet reviewed/handled**. This queue
classifies them so they can be worked down honestly — it does NOT resolve them (that is per-chart SME/build work;
auto-resolving would be cosmetic).

## Headline

\`\`\`text
flagged quirks: ${total}
charts affected: ${chartCount}
  standard (confirm a catalog-wide home): ${byClass.standard}
  build    (build a variant, then handle):  ${byClass.build}
  sme      (genuine per-chart human call):   ${byClass.sme}
\`\`\`

## Work it down in this order

${section("standard", "1. Standard — quickest wins (confirm the known ConfigHub home applies)")}

${section("build", "2. Build — needs a concrete variant first")}

${section("sme", "3. SME — genuine per-chart judgment (could be benign or a real blocker)")}

## Honesty note
A chart stays **Level-2 supported** while these sit at \`needs-operator-decision\` — the quirk is disclosed, not
silent. Moving a flag to *handled* (with evidence) or *blocker* (with reason) is what upgrades it to **reviewed**.
Re-run \`npm run quirk-queue:generate\` after pain reports change to re-measure the residue.
`;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
