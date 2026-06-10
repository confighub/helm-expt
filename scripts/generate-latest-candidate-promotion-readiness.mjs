import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const mode = args[0] ?? "--generate";

const candidateStatusPath = join(repoRoot, "data", "latest-top20-refresh", "candidates", "candidate-status.csv");
const productionDispositionPath = join(repoRoot, "data", "production-disposition", "top20.csv");
const outputCsvPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");
const outputSummaryPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.md");
const workOrdersCsvPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-work-orders.csv");
const workOrdersSummaryPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-work-orders.md");
const candidateProductionDispositionPath = join(
  repoRoot,
  "data",
  "latest-top20-refresh",
  "production-disposition",
  "candidate-production-disposition.yaml",
);

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
  "live parity receipt",
  "production disposition",
  "catalog status",
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
  const rootPathPresent = rows.filter((row) => row.catalog_promotion === "root-path-present").length;
  check(complete === rows.length, `expected all latest-version candidate artifacts to be complete; found ${complete}/${rows.length}`);
  check(
    rows.every((row) => ["not-promoted", "root-path-present"].includes(row.catalog_promotion)),
    "latest-version candidates must be either not-promoted or root-path-present",
  );
  console.log(`verified latest candidate promotion readiness: ${complete}/${rows.length} complete candidate artifact set(s), ${rootPathPresent}/${rows.length} root path set(s) present, ${workOrders.length} work-order row(s)`);
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
    const rootRecipeExists = existsSync(rootRecipePath);
    const rootPackageExists = existsSync(rootPackagePath);
    const catalogPromotion =
      rootRecipeExists && rootPackageExists
        ? "root-path-present"
        : !rootRecipeExists && !rootPackageExists
          ? "not-promoted"
          : "partial-root-path-present";
    const promotionReadiness =
      candidateArtifacts !== "complete"
        ? "candidate-files-missing"
        : catalogPromotion === "not-promoted"
          ? "ready-for-root-path-promotion"
          : catalogPromotion === "root-path-present"
            ? "root-path-promoted-review-required"
            : "review-required";
    const nextAction =
      promotionReadiness === "ready-for-root-path-promotion"
        ? "copy the candidate recipe/package into normal root paths, regenerate catalog status and catalog indexes, then keep the current supported version unchanged"
        : promotionReadiness === "root-path-promoted-review-required"
          ? "refresh catalog, site, top-100, top-500, status, and refresh-survival surfaces; then run target-scoped product review before any support replacement"
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
  const rootPathPresent = rows.filter((row) => row.catalog_promotion === "root-path-present").length;
  const readyForRoot = rows.filter((row) => row.promotion_readiness === "ready-for-root-path-promotion").length;

  const tableRows = rows.map(
    (row) =>
      `| \`${row.chart}\` | \`${row.current_version}\` | \`${row.candidate_version}\` | ${displayList(row.variants)} | ${row.candidate_artifacts} | ${row.catalog_promotion} | ${row.promotion_readiness} |`,
  );

  return `# Retained Candidate Promotion Readiness

This file is generated from retained update candidate proofs and the current
top-20 production-disposition table.

It does not promote newer chart versions. It shows whether the generated
candidate artifacts are complete, whether root catalog paths are present, and
whether the public catalog support decision still points at the current
supported versions.

## Result

\`\`\`text
Retained candidates checked: ${rows.length}
Complete candidate artifact sets: ${complete} / ${rows.length}
Not yet promoted to root catalog paths: ${notPromoted} / ${rows.length}
Root catalog paths present: ${rootPathPresent} / ${rows.length}
Ready for root-path promotion work: ${readyForRoot} / ${rows.length}
\`\`\`

## Candidates

| Chart | Current supported version | Candidate version | Variants | Candidate artifacts | Catalog promotion | Readiness |
| --- | --- | --- | --- | --- | --- | --- |
${tableRows.join("\n")}

## Closed Proof Lanes

The work-order report records these proof lanes for each retained candidate:

${requiredPromotionLanes.map((lane) => `- ${lane}`).join("\n")}

The previous supported version remains the supported catalog version until a
target-scoped replacement decision explicitly chooses to replace, defer, or keep
both versions.

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
      phase: (row) => candidateLocalLiveE2ePhase(row),
      evidence: (row) => candidateLocalLiveE2eReceipt(row),
      firstAction: (row) => {
        const phase = candidateLocalLiveE2ePhase(row);
        if (phase === "done") return "keep the candidate local-kind observation receipt committed";
        if (phase === "needs-route") return "inspect the candidate local-kind observation receipt and route the failure before promotion";
        return "apply the candidate rendered objects to a fresh kind target and observe workloads and prerequisites";
      },
      doneWhen: "fresh local observation receipt records pass, watch, or blocked with a route",
      command: (row) => {
        const phase = candidateLocalLiveE2ePhase(row);
        if (phase === "done") return `node scripts/run-top20-local-e2e.mjs --verify --latest-candidates --chart ${slug(row.chart)}`;
        if (phase === "needs-route") return `inspect ${candidateLocalLiveE2eReceipt(row)} and add a routed watchlist/disposition before support`;
        return `node scripts/run-top20-local-e2e.mjs --run --latest-candidates --chart ${slug(row.chart)} --cluster helm-expt-${slug(row.chart)}-${versionSlug(row.candidate_version)} --continue-on-fail`;
      },
    },
    {
      lane: "live-parity",
      phase: (row) => candidateLiveParityPhase(row),
      evidence: (row) => candidateLiveParityReceipt(row),
      firstAction: "compare regular Helm and cub installer delivery for the candidate on the declared Kubernetes profile",
      doneWhen: "live parity receipt records pass, watch, or blocked with no silent semantic defect",
      command: (row) => {
        const phase = candidateLiveParityPhase(row);
        if (phase === "done") return `node scripts/run-kind-parity.mjs --verify --latest-candidates --chart ${slug(row.chart)}`;
        if (phase === "needs-route") return `inspect ${candidateLiveParityReceipt(row)} and add a routed watchlist/disposition before support`;
        return `node scripts/run-kind-parity.mjs --run --latest-candidates --chart ${slug(row.chart)} --continue-on-fail`;
      },
    },
    {
      lane: "production-disposition",
      phase: (row) => candidateProductionDispositionComplete(row) ? "done" : "todo",
      evidence: () => "data/latest-top20-refresh/production-disposition/",
      firstAction: (row) =>
        candidateProductionDispositionComplete(row)
          ? "keep the candidate production-disposition boundary report committed"
          : "write scan, lifecycle, storage, RBAC, webhook, extension-slot, image, and target-fact dispositions for the candidate",
      doneWhen: "candidate production-disposition report states the target-scoped boundary without claiming production support",
      command: (row) =>
        candidateProductionDispositionComplete(row)
          ? "npm run top20:latest-production-disposition:verify"
          : "npm run top20:latest-production-disposition",
    },
    {
      lane: "promote-versioned-root-paths",
      phase: (row) => candidateRootPromotionComplete(row) ? "done" : "todo",
      evidence: (row) => `${row.promoted_recipe_path};${row.promoted_package_path}`,
      firstAction: (row) =>
        candidateRootPromotionComplete(row)
          ? "keep the candidate recipe/package visible at normal root paths while retaining the previous supported version"
          : "promote the candidate recipe/package into normal versioned root paths while retaining the previous supported version",
      doneWhen: "new root recipe/package paths exist and current supported version is still retained",
      command: (row) =>
        candidateRootPromotionComplete(row)
          ? "npm run top20:latest-promote-root-paths:verify"
          : "npm run top20:latest-promote-root-paths && npm run catalog:status && npm run catalog:maps && npm run catalog:index",
    },
    {
      lane: "catalog-and-site",
      phase: (row) => catalogAndSiteFresh(row) ? "done" : "todo",
      evidence: () => "CATALOG.md;site/catalog.json;site/index.html",
      firstAction: "regenerate the chart catalog and generated site after the candidate root paths are present",
      doneWhen: "catalog and site show the candidate as a candidate, not as supported, until support review accepts it",
      command: "npm run catalog:maps && npm run catalog:index && npm run site:generate",
    },
    {
      lane: "top100-top500-refresh",
      phase: (row) => aggregateSurfacesFresh(row) ? "done" : "todo",
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

function candidateLocalLiveE2eReceipt(row) {
  return `runs/latest-top20-refresh/${slug(row.chart)}-${row.candidate_version}/local-kind/observation-receipt.json`;
}

function candidateLocalLiveE2ePhase(row) {
  const receiptPath = join(repoRoot, candidateLocalLiveE2eReceipt(row));
  if (!existsSync(receiptPath)) return "todo";
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  return receipt.spec?.result === "pass" ? "done" : "needs-route";
}

function candidateLiveParityReceipt(row) {
  return `runs/latest-top20-refresh/${slug(row.chart)}-${row.candidate_version}/live-parity/${primaryLatestCandidateBase(row)}/receipt.yaml`;
}

function candidateLiveParityPhase(row) {
  const receiptPath = join(repoRoot, candidateLiveParityReceipt(row));
  if (!existsSync(receiptPath)) return "todo";
  const receipt = readYaml(receiptPath);
  return receipt.spec?.result === "pass" ? "done" : "needs-route";
}

function candidateProductionDispositionComplete(row) {
  if (!existsSync(candidateProductionDispositionPath)) return false;
  const report = readYaml(candidateProductionDispositionPath);
  const rows = report.spec?.rows ?? [];
  const item = rows.find((candidate) => candidate.chart === row.chart && String(candidate.candidateVersion) === row.candidate_version);
  return item?.proofStatus === "proof-complete" && item?.productionSupportStatus === "not-production-supported";
}

function candidateRootPromotionComplete(row) {
  return (
    existsSync(join(repoRoot, row.promoted_recipe_path, "recipe.yaml")) &&
    existsSync(join(repoRoot, row.promoted_package_path, "installer.yaml")) &&
    existsSync(join(repoRoot, row.current_supported_recipe, "recipe.yaml")) &&
    existsSync(join(repoRoot, row.current_supported_package, "installer.yaml"))
  );
}

function catalogAndSiteFresh(row) {
  const marker = `${row.chart}@${row.candidate_version}`;
  return filesExist([
    "CATALOG.md",
    "site/catalog.json",
    "site/index.html",
    "site/try.html",
  ]) && fileContains("CATALOG.md", marker);
}

function aggregateSurfacesFresh(row) {
  const marker = row.candidate_version;
  return filesExist([
    "data/top100-catalog-analysis/summary.md",
    "data/top100-catalog-analysis/review.csv",
    "data/top500-catalog-analysis/summary.md",
    "data/top500-catalog-analysis/review.csv",
    "data/status-dashboard/summary.md",
    "data/status-dashboard/status.csv",
    "data/refresh-survival/summary.md",
    "data/README.md",
    "data/csv-index.csv",
  ]) && fileContains("data/refresh-survival/summary.md", marker);
}

function filesExist(paths) {
  return paths.every((path) => existsSync(join(repoRoot, path)));
}

function fileContains(path, text) {
  const fullPath = join(repoRoot, path);
  return existsSync(fullPath) && readFileSync(fullPath, "utf8").includes(text);
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

  return `# Retained Candidate Promotion Work Orders

This file turns retained update candidates into lane work orders and shows which
proof lanes have closed.

It does not say the candidate versions are supported. It records proof-lane
closure before the separate replacement decision chooses whether any candidate
replaces, defers, or lives alongside the current supported catalog version.

## Summary

\`\`\`text
candidate charts: ${rows.length}
work-order rows: ${workOrders.length}
candidate proof lanes: closed
completed work-order rows: ${doneRows}
todo work-order rows: ${todoRows}
candidate support status: not support-promoted
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

Work through one candidate chart at a time. The proof lanes are closed when
there are no todo rows. Keep the previous supported version available until a
target-scoped replacement decision records whether to replace, defer, or keep
both versions.

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

function versionSlug(value) {
  return String(value)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
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
