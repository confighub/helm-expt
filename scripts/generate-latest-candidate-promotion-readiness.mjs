import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const mode = args[0] ?? "--generate";

const candidateStatusPath = join(repoRoot, "data", "latest-top20-refresh", "candidates", "candidate-status.csv");
const productionDispositionPath = join(repoRoot, "data", "production-disposition", "top20.csv");
const outputCsvPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");
const outputSummaryPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.md");

const requiredRecipeFiles = [
  "README.md",
  "recipe.yaml",
  "source-lock.yaml",
  "dependency-lock.yaml",
  "helm-plan.yaml",
  "chart-dossier.yaml",
  "control-points.yaml",
  "value-model.yaml",
  "publication/installer-package-receipt.yaml",
];

const requiredRevisionFiles = [
  "variant-revision.yaml",
  "receipts/helm-equivalence-receipt.yaml",
  "receipts/install-gate.yaml",
  "receipts/render-receipt.yaml",
  "receipts/scan-receipt.yaml",
  "rendered/object-inventory.yaml",
  "rendered/release-objects.yaml",
];

const requiredPromotionLanes = [
  "ConfigHub proof receipt",
  "live e2e observation receipt",
  "catalog status",
  "production disposition",
  "root catalog",
  "top-100 analysis",
  "top-500 analysis",
];

if (mode === "--generate") {
  generate();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/generate-latest-candidate-promotion-readiness.mjs --generate
  node scripts/generate-latest-candidate-promotion-readiness.mjs --verify`);
}

function generate() {
  const { csvText, summaryText, rows } = buildOutputs();
  write(outputCsvPath, csvText);
  write(outputSummaryPath, summaryText);
  verify();
  console.log(`wrote ${relativeRepo(outputCsvPath)} and ${relativeRepo(outputSummaryPath)} for ${rows.length} candidate(s)`);
}

function verify() {
  check(existsSync(outputCsvPath), `${relativeRepo(outputCsvPath)} is missing`);
  check(existsSync(outputSummaryPath), `${relativeRepo(outputSummaryPath)} is missing`);
  const { csvText, summaryText, rows } = buildOutputs();
  check(readFileSync(outputCsvPath, "utf8") === csvText, `${relativeRepo(outputCsvPath)} is stale`);
  check(readFileSync(outputSummaryPath, "utf8") === summaryText, `${relativeRepo(outputSummaryPath)} is stale`);
  check(rows.length === 6, `expected 6 latest-version candidates; found ${rows.length}`);
  const complete = rows.filter((row) => row.candidate_artifacts === "complete").length;
  const notPromoted = rows.filter((row) => row.catalog_promotion === "not-promoted").length;
  check(complete === rows.length, `expected all latest-version candidate artifacts to be complete; found ${complete}/${rows.length}`);
  check(notPromoted === rows.length, `expected no latest-version candidates to be promoted yet; found ${rows.length - notPromoted} promoted path(s)`);
  console.log(`verified latest candidate promotion readiness: ${complete}/${rows.length} complete candidate artifact set(s), ${notPromoted}/${rows.length} not promoted`);
}

function buildOutputs() {
  const candidateRows = parseCsv(readFileSync(candidateStatusPath, "utf8"));
  const productionRows = parseCsv(readFileSync(productionDispositionPath, "utf8"));
  const productionByChart = new Map(productionRows.map((row) => [row.chart, row]));

  const rows = candidateRows.map((candidate) => {
    const current = productionByChart.get(candidate.chart);
    check(current, `production disposition is missing current row for ${candidate.chart}`);
    check(candidate.current_version === current.version, `${candidate.chart} current version changed: candidate has ${candidate.current_version}, production has ${current.version}`);

    const variants = splitList(candidate.variants);
    const candidateRecipePath = join(repoRoot, candidate.recipe_path);
    const candidatePackagePath = join(repoRoot, candidate.package_path);
    const rootRecipePath = join(repoRoot, "recipes", candidate.chart, candidate.latest_version);
    const rootPackagePath = join(repoRoot, "packages", candidate.chart, candidate.latest_version);
    const missingCandidateFiles = missingFiles([
      ...requiredRecipeFiles.map((file) => join(candidateRecipePath, file)),
      ...variants.flatMap((variant) => [
        join(candidateRecipePath, "variants", variant, "variant.yaml"),
        ...requiredRevisionFiles.map((file) => join(candidateRecipePath, "revisions", variant, "r001", file)),
        join(candidatePackagePath, "bases", variant, "kustomization.yaml"),
        join(candidatePackagePath, "bases", variant, "upstream.yaml"),
      ]),
      join(candidatePackagePath, "README.md"),
      join(candidatePackagePath, "installer.yaml"),
    ]);

    const candidateArtifacts = missingCandidateFiles.length === 0 ? "complete" : "missing-files";
    const catalogPromotion = !existsSync(rootRecipePath) && !existsSync(rootPackagePath) ? "not-promoted" : "root-path-present";
    const promotionReadiness =
      candidateArtifacts === "complete" && catalogPromotion === "not-promoted"
        ? "ready-for-full-lane-promotion"
        : "review-required";
    const nextAction =
      promotionReadiness === "ready-for-full-lane-promotion"
        ? "run ConfigHub proof, live e2e, catalog status, production disposition, root catalog, top-100, and top-500 lanes before replacing the supported version"
        : "fix missing candidate files or inspect unexpected promoted root paths before continuing";

    return {
      chart: candidate.chart,
      current_version: candidate.current_version,
      candidate_version: candidate.latest_version,
      variants: candidate.variants,
      candidate_artifacts: candidateArtifacts,
      catalog_promotion: catalogPromotion,
      promotion_readiness: promotionReadiness,
      missing_candidate_files: missingCandidateFiles.map(relativeRepo).join(";"),
      required_lanes_before_support: requiredPromotionLanes.join(";"),
      current_supported_recipe: current.recipe_path,
      current_supported_package: current.package_path,
      candidate_recipe: candidate.recipe_path,
      candidate_package: candidate.package_path,
      promoted_recipe_path: relativeRepo(rootRecipePath),
      promoted_package_path: relativeRepo(rootPackagePath),
      next_action: nextAction,
    };
  });

  return {
    rows,
    csvText: csv(rows),
    summaryText: summary(rows),
  };
}

function missingFiles(paths) {
  return paths.filter((path) => !existsSync(path));
}

function summary(rows) {
  const complete = rows.filter((row) => row.candidate_artifacts === "complete").length;
  const notPromoted = rows.filter((row) => row.catalog_promotion === "not-promoted").length;
  const ready = rows.filter((row) => row.promotion_readiness === "ready-for-full-lane-promotion").length;

  const tableRows = rows.map(
    (row) =>
      `| \`${row.chart}\` | \`${row.current_version}\` | \`${row.candidate_version}\` | ${displayList(row.variants)} | ${row.candidate_artifacts} | ${row.catalog_promotion} | ${row.promotion_readiness} |`,
  );

  return `# Latest Candidate Promotion Readiness

This file is generated from the latest-version candidate proofs and the current
top-20 production-disposition table.

It does not promote newer chart versions. It shows whether the generated
candidate artifacts are complete enough to start the full catalog promotion
lanes, and whether the public catalog still points at the current supported
versions.

## Result

\`\`\`text
Latest-version candidates checked: ${rows.length}
Complete candidate artifact sets: ${complete} / ${rows.length}
Not yet promoted to root catalog paths: ${notPromoted} / ${rows.length}
Ready for full-lane promotion work: ${ready} / ${rows.length}
\`\`\`

## Candidates

| Chart | Current supported version | Candidate version | Variants | Candidate artifacts | Catalog promotion | Readiness |
| --- | --- | --- | --- | --- | --- | --- |
${tableRows.join("\n")}

## Required Lanes Before Support

Each candidate still needs these lanes before it can replace the supported
catalog version:

${requiredPromotionLanes.map((lane) => `- ${lane}`).join("\n")}

The previous supported version remains the catalog version until those lanes
produce receipts and the generated catalog, production-disposition, top-100, and
top-500 outputs are regenerated.

## Verify

\`\`\`sh
npm run top20:latest-promotion-readiness:verify
\`\`\`
`;
}

function displayList(value) {
  return splitList(value)
    .map((item) => `\`${item}\``)
    .join(", ");
}

function csv(rows) {
  const headers = [
    "chart",
    "current_version",
    "candidate_version",
    "variants",
    "candidate_artifacts",
    "catalog_promotion",
    "promotion_readiness",
    "missing_candidate_files",
    "required_lanes_before_support",
    "current_supported_recipe",
    "current_supported_package",
    "candidate_recipe",
    "candidate_package",
    "promoted_recipe_path",
    "promoted_package_path",
    "next_action",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
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
