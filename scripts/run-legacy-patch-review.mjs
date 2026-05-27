import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "legacy-patch-review");
const reviewCsvPath = join(outputRoot, "review.csv");
const summaryPath = join(outputRoot, "summary.md");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const report = buildReport();
  writeReport(report);
  console.log(`wrote ${relativeRepo(reviewCsvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(reviewCsvPath), "missing legacy patch review CSV; run npm run legacy-patch:review");
  check(existsSync(summaryPath), "missing legacy patch review summary; run npm run legacy-patch:review");
  check(readFileSync(reviewCsvPath, "utf8") === report.csv, "legacy patch review CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "legacy patch review summary is stale");
  console.log("verified legacy patch review outputs");
} else {
  console.log(`Usage:
  node scripts/run-legacy-patch-review.mjs --generate
  node scripts/run-legacy-patch-review.mjs --verify`);
}

function buildReport() {
  const rows = recipeRoots().map(reviewRecipe).sort((left, right) => left.chart.localeCompare(right.chart));
  check(rows.length === 100, `expected 100 recipe rows, found ${rows.length}`);
  return { rows, csv: toCsv(rows), summary: toSummary(rows) };
}

function recipeRoots() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
}

function reviewRecipe(root) {
  const sourceLock = readYaml(join(root, "source-lock.yaml"));
  const helmPlan = readYaml(join(root, "helm-plan.yaml"));
  const status = readYaml(join(root, "catalog-status.yaml"));
  const chart = status.spec?.chart ?? helmPlan.spec?.readiness?.chart ?? `${sourceLock.spec?.repositoryName}/${sourceLock.spec?.chart}`;
  const version = String(status.spec?.version ?? helmPlan.spec?.readiness?.version ?? sourceLock.spec?.version ?? "");
  const catalogStatus = status.spec?.status ?? "unknown";
  const eligible = catalogStatus === "catalog-supported";
  return {
    chart: `${chart}@${version}`,
    catalog_status: catalogStatus,
    legacy_patch_status: eligible ? "review-lane-open" : "not-eligible-until-catalog-promotion",
    current_supported_version: eligible ? version : "",
    old_versions_selected: "no",
    required_artifacts: eligible
      ? "old-version source lock; old-version recipe; upgrade diff; patch receipt; rollback receipt"
      : "none yet",
    next_action: eligible
      ? "Select old Redis versions worth paid patch support and generate first upgrade/patch scenario."
      : "Promote chart to catalog-supported before opening old-version patch support.",
    recipe_path: relativeRepo(root),
  };
}

function toCsv(rows) {
  const headers = [
    "chart",
    "catalog_status",
    "legacy_patch_status",
    "current_supported_version",
    "old_versions_selected",
    "required_artifacts",
    "next_action",
    "recipe_path",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function toSummary(rows) {
  const eligible = rows.filter((row) => row.legacy_patch_status === "review-lane-open");
  return `# Legacy Patch Review

This generated review creates the lane for valuable old-version patch support.
It does not claim old-version support yet.

## Summary

\`\`\`text
recipes reviewed: ${rows.length}
legacy patch lanes open: ${eligible.length}
old versions selected: 0
\`\`\`

## Open Lanes

| Chart | Status | Next action |
| --- | --- | --- |
${eligible.map((row) => `| \`${row.chart}\` | ${row.legacy_patch_status} | ${row.next_action} |`).join("\n") || "| none | none | none |"}

## Required Proof Before Selling Old-Version Patches

- old-version source lock and dependency lock
- old-version recipe and installer package
- old-version rendered revision digest
- patch diff against the supported current recipe
- scan/gate result for the patched rendered objects
- upgrade and rollback receipts
- explicit support window and scope
`;
}

function writeReport(report) {
  mkdirSync(outputRoot, { recursive: true });
  write(reviewCsvPath, report.csv);
  write(summaryPath, report.summary);
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
