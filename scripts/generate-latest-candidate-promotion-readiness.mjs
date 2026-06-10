import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const mode = args[0] ?? "--generate";

const candidateStatusPath = join(repoRoot, "data", "latest-top20-refresh", "candidates", "candidate-status.csv");
const productionDispositionPath = join(repoRoot, "data", "production-disposition", "top20.csv");
const outputCsvPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");
const outputSummaryPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.md");
const workOrdersCsvPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-work-orders.csv");
const workOrdersSummaryPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-work-orders.md");

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
  const { csvText, summaryText, workOrdersCsvText, workOrdersSummaryText, rows, workOrders } = buildOutputs();
  write(outputCsvPath, csvText);
  write(outputSummaryPath, summaryText);
  write(workOrdersCsvPath, workOrdersCsvText);
  write(workOrdersSummaryPath, workOrdersSummaryText);
  verify();
  console.log(`wrote latest candidate readiness for ${rows.length} candidate(s) and ${workOrders.length} work-order row(s)`);
}

function verify() {
  check(existsSync(outputCsvPath), `${relativeRepo(outputCsvPath)} is missing`);
  check(existsSync(outputSummaryPath), `${relativeRepo(outputSummaryPath)} is missing`);
  check(existsSync(workOrdersCsvPath), `${relativeRepo(workOrdersCsvPath)} is missing`);
  check(existsSync(workOrdersSummaryPath), `${relativeRepo(workOrdersSummaryPath)} is missing`);
  const { csvText, summaryText, workOrdersCsvText, workOrdersSummaryText, rows, workOrders } = buildOutputs();
  check(readFileSync(outputCsvPath, "utf8") === csvText, `${relativeRepo(outputCsvPath)} is stale`);
  check(readFileSync(outputSummaryPath, "utf8") === summaryText, `${relativeRepo(outputSummaryPath)} is stale`);
  check(readFileSync(workOrdersCsvPath, "utf8") === workOrdersCsvText, `${relativeRepo(workOrdersCsvPath)} is stale`);
  check(readFileSync(workOrdersSummaryPath, "utf8") === workOrdersSummaryText, `${relativeRepo(workOrdersSummaryPath)} is stale`);
  check(rows.length === 6, `expected 6 latest-version candidates; found ${rows.length}`);
  check(workOrders.length === rows.length * 8, `expected ${rows.length * 8} work-order rows; found ${workOrders.length}`);
  const complete = rows.filter((row) => row.candidate_artifacts === "complete").length;
  const notPromoted = rows.filter((row) => row.catalog_promotion === "not-promoted").length;
  check(complete === rows.length, `expected all latest-version candidate artifacts to be complete; found ${complete}/${rows.length}`);
  check(notPromoted === rows.length, `expected no latest-version candidates to be promoted yet; found ${rows.length - notPromoted} promoted path(s)`);
  console.log(`verified latest candidate promotion readiness: ${complete}/${rows.length} complete candidate artifact set(s), ${notPromoted}/${rows.length} not promoted, ${workOrders.length} work-order row(s)`);
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

  const workOrders = buildWorkOrders(rows);

  return {
    rows,
    csvText: csv(rows),
    summaryText: summary(rows),
    workOrders,
    workOrdersCsvText: workOrderCsv(workOrders),
    workOrdersSummaryText: workOrderSummary(rows, workOrders),
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

The generated lane work orders are:

[promotion-work-orders.md](./promotion-work-orders.md)

## Verify

\`\`\`sh
npm run top20:latest-promotion-readiness:verify
\`\`\`
`;
}

function buildWorkOrders(rows) {
  const laneDefinitions = [
    {
      lane: "candidate-render-proof",
      phase: "already-generated",
      evidence: (row) => `${row.candidate_recipe};${row.candidate_package}`,
      firstAction: "keep the generated candidate recipe/package artifacts verified",
      doneWhen: "top20:latest-candidates:verify and top20:latest-promotion-readiness:verify pass",
      command: "npm run top20:latest-candidates:verify && npm run top20:latest-promotion-readiness:verify",
    },
    {
      lane: "promote-versioned-root-paths",
      phase: "todo",
      evidence: (row) => `${row.promoted_recipe_path};${row.promoted_package_path}`,
      firstAction: "promote the candidate recipe/package into normal versioned root paths while retaining the previous supported version",
      doneWhen: "new root recipe/package paths exist and current supported version is still retained",
      command: "manual promotion, then npm run catalog:maps && npm run catalog:index",
    },
    {
      lane: "confighub-proof",
      phase: (row) => candidateConfighubProofComplete(row) ? "done" : "todo",
      evidence: (row) => candidateConfighubProofReceipts(row).join(";"),
      firstAction: (row) =>
        candidateConfighubProofComplete(row)
          ? "keep the candidate ConfigHub proof, function-scan, and safe-ops receipts committed"
          : "run ConfigHub upload, function scan, safe-ops, and server-side variant proof against the candidate package",
      doneWhen: "candidate ConfigHub proof, function-scan, and safe-ops receipts are committed or summarized",
      command: (row) =>
        candidateConfighubProofComplete(row)
          ? "npm run top20:latest-promotion-readiness:verify"
          : `node scripts/run-top20-confighub-proof.mjs --latest-candidates --charts ${slug(row.chart)} --cleanup-spaces`,
    },
    {
      lane: "local-live-e2e",
      phase: "todo",
      evidence: (row) => `runs/latest-top20-refresh/${slug(row.chart)}-${row.candidate_version}/local-kind/observation-receipt.json`,
      firstAction: "apply the candidate rendered objects to a fresh kind target and observe workloads and prerequisites",
      doneWhen: "fresh local observation receipt records pass, watch, or blocked with a route",
      command: "run the chart-specific local-kind lane for the candidate package path",
    },
    {
      lane: "live-parity",
      phase: "todo",
      evidence: (row) => `runs/latest-top20-refresh/${slug(row.chart)}-${row.candidate_version}/live-parity/receipt.yaml`,
      firstAction: "compare regular Helm and ConfigHub/cub-installer delivery for the candidate on the declared Kubernetes profile",
      doneWhen: "live parity receipt records pass, watch, or blocked with no silent semantic defect",
      command: "run the two-cluster live parity lane for the candidate package path",
    },
    {
      lane: "production-disposition",
      phase: "todo",
      evidence: (row) => `data/production-disposition/candidates/${slug(row.chart)}-${row.candidate_version}/`,
      firstAction: "write scan, lifecycle, storage, RBAC, webhook, extension-slot, image, and target-fact dispositions for the candidate",
      doneWhen: "production disposition or support-decision artifact states the target-scoped boundary",
      command: "extend production disposition generators for candidate versions",
    },
    {
      lane: "catalog-and-site",
      phase: "todo",
      evidence: () => "CATALOG.md;site/catalog.json;site/index.html",
      firstAction: "regenerate the chart catalog and generated site after the candidate is accepted",
      doneWhen: "catalog and site show the candidate as supported only after all proof lanes are present",
      command: "npm run catalog:maps && npm run catalog:index && npm run site:generate",
    },
    {
      lane: "top100-top500-refresh",
      phase: "todo",
      evidence: () => "data/top100-catalog-analysis/;data/top500-catalog-analysis/;data/status-dashboard/",
      firstAction: "refresh top100, top500, status dashboard, data index, and refresh-survival after promotion",
      doneWhen: "top100/top500/status/refresh outputs agree with the promoted catalog state",
      command: "npm run top100:catalog && npm run top500:catalog && npm run refresh:survival && npm run status:dashboard && npm run data:index",
    },
  ];

  return rows.flatMap((row) =>
    laneDefinitions.map((definition, laneIndex) => ({
      priority: laneIndex + 1,
      chart: row.chart,
      current_version: row.current_version,
      candidate_version: row.candidate_version,
      variants: row.variants,
      lane: definition.lane,
      phase: typeof definition.phase === "function" ? definition.phase(row) : definition.phase,
      evidence_target: definition.evidence(row),
      first_action: typeof definition.firstAction === "function" ? definition.firstAction(row) : definition.firstAction,
      done_when: typeof definition.doneWhen === "function" ? definition.doneWhen(row) : definition.doneWhen,
      command_or_route: typeof definition.command === "function" ? definition.command(row) : definition.command,
    })),
  );
}

function candidateConfighubProofReceipts(row) {
  const root = `runs/latest-top20-refresh/${slug(row.chart)}-${row.candidate_version}/confighub-proof/latest`;
  return [
    `${root}/confighub-proof-receipt.yaml`,
    `${root}/function-scan-receipt.yaml`,
    `${root}/safe-ops-receipt.yaml`,
  ];
}

function candidateConfighubProofComplete(row) {
  return candidateConfighubProofReceipts(row).every((path) => existsSync(join(repoRoot, path)));
}

function workOrderSummary(rows, workOrders) {
  const laneOrder = [...new Set(workOrders.map((row) => row.lane))];
  const laneRows = laneOrder.map((lane) => {
    const laneOrders = workOrders.filter((row) => row.lane === lane);
    const done = laneOrders.filter((row) => row.phase === "done" || row.phase === "already-generated").length;
    const todo = laneOrders.filter((row) => row.phase === "todo").length;
    const other = laneOrders.length - done - todo;
    return `| ${lane} | ${done} | ${todo} | ${other} |`;
  });
  const candidateProgressRows = rows.map((row) => {
    const orders = workOrders.filter((order) => order.chart === row.chart && order.candidate_version === row.candidate_version);
    const done = orders.filter((order) => order.phase === "done" || order.phase === "already-generated").length;
    const todo = orders.filter((order) => order.phase === "todo").length;
    const next = orders.find((order) => order.phase === "todo");
    return `| \`${row.chart}@${row.candidate_version}\` | ${done} / ${orders.length} | ${todo} | ${next?.lane ?? "none"} | ${next?.first_action ?? "all lanes complete"} |`;
  });
  const candidateRows = rows.map(
    (row) =>
      `| \`${row.chart}\` | \`${row.current_version}\` | \`${row.candidate_version}\` | ${displayList(row.variants)} | [${slug(row.chart)} rows](./promotion-work-orders.csv) |`,
  );
  const doneRows = workOrders.filter((row) => row.phase === "done" || row.phase === "already-generated").length;
  const todoRows = workOrders.filter((row) => row.phase === "todo").length;

  return `# Latest Candidate Promotion Work Orders

This file turns the latest-version candidates into lane work orders.

It does not say the candidate versions are supported. It says exactly what must
happen before any candidate can replace the current supported catalog version.

## Summary

\`\`\`text
candidate charts: ${rows.length}
work-order rows: ${workOrders.length}
candidate render proof: already generated
completed work-order rows: ${doneRows}
todo work-order rows: ${todoRows}
candidate support status: not promoted
\`\`\`

## Candidates

| Chart | Current supported version | Candidate version | Variants | Work orders |
| --- | --- | --- | --- | --- |
${candidateRows.join("\n")}

## Lanes

| Lane | Done or generated | Todo | Other |
| --- | ---: | ---: | ---: |
${laneRows.join("\n")}

## Candidate Progress

| Candidate | Done or generated lanes | Todo lanes | Next lane | Next action |
| --- | ---: | ---: | --- | --- |
${candidateProgressRows.join("\n")}

## How To Use This

Work through one candidate chart at a time. Keep the previous supported version
available until every todo lane for the candidate has evidence and the generated
catalog, status, top100, top500, and refresh-survival surfaces agree.

The spreadsheet form is:

\`\`\`text
data/latest-top20-refresh/promotion-work-orders.csv
\`\`\`

## Verify

\`\`\`sh
npm run top20:latest-promotion-readiness:verify
\`\`\`
`;
}

function slug(chart) {
  return chart.split("/").at(-1).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
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

function workOrderCsv(rows) {
  const headers = [
    "priority",
    "chart",
    "current_version",
    "candidate_version",
    "variants",
    "lane",
    "phase",
    "evidence_target",
    "first_action",
    "done_when",
    "command_or_route",
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
