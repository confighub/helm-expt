import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  listFiles,
  listTrackedFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "derived-variant-target-bound");
const csvPath = join(outputRoot, "summary.csv");
const mdPath = join(outputRoot, "summary.md");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, report.csv);
  write(mdPath, report.markdown);
  console.log(`wrote ${relativeRepo(csvPath)}`);
  console.log(`wrote ${relativeRepo(mdPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), "missing target-bound derived variant summary CSV");
  check(existsSync(mdPath), "missing target-bound derived variant summary markdown");
  check(readFileSync(csvPath, "utf8") === report.csv, "target-bound derived variant summary CSV is stale");
  check(readFileSync(mdPath, "utf8") === report.markdown, "target-bound derived variant summary markdown is stale");
  console.log(`verified target-bound derived variant summary for ${report.rows.length} receipt(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-target-bound-derived-variant-summary.mjs --generate
  node scripts/generate-target-bound-derived-variant-summary.mjs --verify`);
}

function buildReport() {
  const rows = listTrackedFiles(join(repoRoot, "runs", "derived-variant-target-bound"))
    .filter((file) => file.endsWith("/receipt.yaml"))
    .map((receiptPath) => rowFor(receiptPath))
    .sort((left, right) => `${left.chart}|${left.base}|${left.variant}`.localeCompare(`${right.chart}|${right.base}|${right.variant}`));
  return { rows, csv: csv(rows), markdown: markdown(rows) };
}

function rowFor(receiptPath) {
  const receipt = readYaml(receiptPath);
  const spec = receipt.spec ?? {};
  return {
    chart: spec.source?.chart ?? "",
    version: spec.source?.chartVersion ?? "",
    base: spec.source?.base ?? "",
    variant: spec.create?.variant ?? "",
    downstream_space: spec.create?.downstreamSpace ?? "",
    result: spec.result ?? "",
    target: spec.target?.slug ?? "",
    argo: spec.argo?.result ?? "",
    runtime: spec.runtime?.result ?? "",
    blocker_ids: (spec.blockers ?? []).map((item) => item.id).join(";") || "",
    route_forward: (spec.routeForward ?? []).join("; ") || "",
    receipt: relativeRepo(receiptPath),
  };
}

function csv(rows) {
  const headers = [
    "chart",
    "version",
    "base",
    "variant",
    "downstream_space",
    "result",
    "target",
    "argo",
    "runtime",
    "blocker_ids",
    "route_forward",
    "receipt",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function markdown(rows) {
  const pass = rows.filter((row) => row.result === "pass").length;
  const blocked = rows.filter((row) => row.result === "blocked").length;
  const watch = rows.filter((row) => row.result === "watch").length;
  return `# Target-Bound Derived Variants

Generated from committed receipts under \`runs/derived-variant-target-bound/\`.

This table is about derived ConfigHub variants after a reviewed base has already
been uploaded. It is separate from the chart-recipe-variant lane matrix, which
tracks base variants.

\`\`\`text
receipts: ${rows.length}
pass: ${pass}
blocked: ${blocked}
watch: ${watch}
\`\`\`

| Chart | Base | Derived variant | Result | Target | Runtime | Blockers | Receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | \`${row.base}\` | \`${row.variant}\` | ${row.result} | \`${row.target}\` | ${row.runtime || "-"} | ${row.blocker_ids || "-"} | [receipt](../../${row.receipt}) |`).join("\n")}
`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
