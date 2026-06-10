#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, toYaml, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "latest-top20-refresh", "replacement-decisions");
const csvPath = join(outputRoot, "decisions.csv");
const summaryPath = join(outputRoot, "summary.md");
const yamlPath = join(outputRoot, "decisions.yaml");

const readinessPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");
const latestReviewPath = join(repoRoot, "data", "latest-top20-refresh", "review.csv");
const candidateDispositionPath = join(
  repoRoot,
  "data",
  "latest-top20-refresh",
  "production-disposition",
  "candidate-production-disposition.yaml",
);
const currentSupportDecisionPath = join(repoRoot, "data", "production-support-decisions", "decisions.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  writeYaml(yamlPath, report.yaml);
  verify();
  console.log(`wrote latest candidate replacement decisions for ${report.rows.length} candidate(s)`);
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/generate-latest-candidate-replacement-decisions.mjs --generate
  node scripts/generate-latest-candidate-replacement-decisions.mjs --verify`);
  process.exit(1);
}

function verify() {
  check(existsSync(csvPath), `${relativeRepo(csvPath)} is missing`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing`);
  check(existsSync(yamlPath), `${relativeRepo(yamlPath)} is missing`);
  const report = buildReport();
  check(readFileSync(csvPath, "utf8") === report.csv, `${relativeRepo(csvPath)} is stale`);
  check(readFileSync(summaryPath, "utf8") === report.summary, `${relativeRepo(summaryPath)} is stale`);
  check(readFileSync(yamlPath, "utf8") === `${toYaml(report.yaml)}\n`, `${relativeRepo(yamlPath)} is stale`);
  check(report.rows.length === 6, `expected 6 latest candidate replacement rows; found ${report.rows.length}`);
  const undecided = report.rows.filter((row) => row.replacement_decision === "not-decided").length;
  check(undecided === report.rows.length, `latest candidates must remain not-decided until a target-scoped replacement decision is written; found ${report.rows.length - undecided} decided`);
  console.log(`verified latest candidate replacement decisions: ${report.rows.length} candidate(s), ${undecided} not decided`);
}

function buildReport() {
  const readinessRows = parseCsv(readFileSync(readinessPath, "utf8"));
  const latestReviewRows = new Map(parseCsv(readFileSync(latestReviewPath, "utf8")).map((row) => [row.chart, row]));
  const disposition = readYaml(candidateDispositionPath);
  const dispositionRows = new Map((disposition.spec?.rows ?? []).map((row) => [row.chart, row]));
  const currentSupportRows = new Map(parseCsv(readFileSync(currentSupportDecisionPath, "utf8")).map((row) => [row.chart, row]));

  const rows = readinessRows.map((readiness) => {
    const dispositionRow = dispositionRows.get(readiness.chart);
    check(dispositionRow, `missing candidate production disposition for ${readiness.chart}`);
    const currentSupport = currentSupportRows.get(readiness.chart);
    check(currentSupport, `missing current production support decision for ${readiness.chart}`);
    const latestReview = latestReviewRows.get(readiness.chart);
    check(latestReview, `missing latest refresh row for ${readiness.chart}`);
    const proofComplete =
      readiness.candidate_artifacts === "complete" &&
      readiness.catalog_promotion === "root-path-present" &&
      dispositionRow.proofStatus === "proof-complete";
    const replacementDecision = "not-decided";
    const candidateFreshness =
      readiness.candidate_version === latestReview.latest_version
        ? "latest-upstream-aligned"
        : "superseded-by-newer-upstream";
    const decisionTopics = dispositionRow.decisionTopics ?? [];
    const rootRecipe = readiness.promoted_recipe_path;
    const rootPackage = readiness.promoted_package_path;
    for (const path of [
      join(repoRoot, rootRecipe, "recipe.yaml"),
      join(repoRoot, rootPackage, "installer.yaml"),
      join(repoRoot, rootRecipe, "catalog-status.yaml"),
      join(repoRoot, rootRecipe, "publication", "installer-package-receipt.yaml"),
    ]) {
      check(existsSync(path), `${relativeRepo(path)} is missing`);
    }
    const candidateStatus = readYaml(join(repoRoot, rootRecipe, "catalog-status.yaml"));
    check(candidateStatus.spec?.status === "catalog-candidate", `${rootRecipe} must remain catalog-candidate`);
    return {
      chart: readiness.chart,
      current_version: readiness.current_version,
      current_supported_base: currentSupport.supported_base,
      current_decision: currentSupport.decision,
      current_support_decision: currentSupport.path,
      candidate_version: readiness.candidate_version,
      latest_upstream_version: latestReview.latest_version,
      candidate_freshness: candidateFreshness,
      candidate_primary_base: dispositionRow.primaryBase,
      candidate_catalog_status: candidateStatus.spec?.status ?? "",
      candidate_proof_status: proofComplete ? "proof-complete-root-path-present" : "incomplete",
      replacement_decision: replacementDecision,
      decision_topics: decisionTopics.join(";"),
      decision_topic_count: String(decisionTopics.length),
      candidate_recipe: rootRecipe,
      candidate_package: rootPackage,
      confighub_proof_receipt: dispositionRow.evidence?.configHubProofReceipt ?? "",
      local_live_receipt: dispositionRow.evidence?.localLiveReceipt ?? "",
      live_parity_receipt: dispositionRow.evidence?.liveParityReceipt ?? "",
      next_action: nextActionFor(
        readiness.chart,
        readiness.candidate_version,
        readiness.current_version,
        decisionTopics.length,
        candidateFreshness,
        latestReview.latest_version,
      ),
    };
  });

  return {
    rows,
    csv: csv(rows),
    summary: summary(rows),
    yaml: {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "LatestCandidateReplacementDecisions",
      metadata: {
        name: "latest-top20-refresh-replacement-decisions",
        generatedBy: "scripts/generate-latest-candidate-replacement-decisions.mjs",
      },
      spec: {
        claim: "retained proof-complete update candidates are visible for review, but do not replace supported catalog versions until a target-scoped replacement decision is written",
        rows: rows.map((row) => ({
          chart: row.chart,
          currentVersion: row.current_version,
          candidateVersion: row.candidate_version,
          latestUpstreamVersion: row.latest_upstream_version,
          candidateFreshness: row.candidate_freshness,
          currentSupportedBase: row.current_supported_base,
          candidatePrimaryBase: row.candidate_primary_base,
          candidateCatalogStatus: row.candidate_catalog_status,
          candidateProofStatus: row.candidate_proof_status,
          replacementDecision: row.replacement_decision,
          decisionTopics: splitList(row.decision_topics),
          evidence: {
            currentSupportDecision: row.current_support_decision,
            candidateRecipe: row.candidate_recipe,
            candidatePackage: row.candidate_package,
            configHubProofReceipt: row.confighub_proof_receipt,
            localLiveReceipt: row.local_live_receipt,
            liveParityReceipt: row.live_parity_receipt,
          },
          nextAction: row.next_action,
        })),
      },
    },
  };
}

function nextActionFor(chart, candidateVersion, currentVersion, topicCount, freshness, latestUpstreamVersion) {
  if (freshness === "superseded-by-newer-upstream") {
    return `candidate ${chart}@${candidateVersion} is behind latest upstream ${latestUpstreamVersion}; decide whether to supersede it or keep it for legacy patch/rollback evidence before replacing ${currentVersion}`;
  }
  return `write target-scoped replacement decision for ${chart}@${candidateVersion}; review ${topicCount} topic(s), then choose replace, defer, or keep ${currentVersion} pinned`;
}

function summary(rows) {
  const proofComplete = rows.filter((row) => row.candidate_proof_status === "proof-complete-root-path-present").length;
  const notDecided = rows.filter((row) => row.replacement_decision === "not-decided").length;
  const latestAligned = rows.filter((row) => row.candidate_freshness === "latest-upstream-aligned").length;
  const superseded = rows.filter((row) => row.candidate_freshness === "superseded-by-newer-upstream").length;
  const tableRows = rows.map(
    (row) =>
      `| \`${row.chart}\` | \`${row.current_version}\` | \`${row.candidate_version}\` | \`${row.latest_upstream_version}\` | ${row.candidate_freshness} | ${row.candidate_primary_base} | ${row.candidate_proof_status} | ${row.replacement_decision} | ${row.decision_topic_count} | ${row.next_action} |`,
  );
  return `# Retained Candidate Replacement Decisions

This generated report is the final review surface for the retained
proof-complete update candidates.

The candidates have proof-complete root paths. They are visible in the catalog
as \`catalog-candidate\` entries. They do not replace the current supported
versions until a target-scoped replacement decision chooses that outcome. If a
candidate is already behind the latest upstream chart version, refresh or
explicitly retain it before making a replacement decision.

## Result

\`\`\`text
candidate charts: ${rows.length}
proof-complete root paths: ${proofComplete} / ${rows.length}
latest-upstream aligned: ${latestAligned} / ${rows.length}
superseded by newer upstream: ${superseded} / ${rows.length}
replacement decisions not written: ${notDecided} / ${rows.length}
support-promoted candidates: 0 / ${rows.length}
\`\`\`

## Candidates

| Chart | Current supported | Candidate | Latest upstream | Freshness | Candidate base | Proof status | Replacement decision | Topics | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
${tableRows.join("\n")}

## Decision Rule

A proof-complete candidate can still be the wrong replacement for a given
target. Replacement needs a target-scoped decision that records:

- whether to replace, defer, or keep both versions;
- the supported base and target scope;
- accepted lifecycle, scan, image, storage, RBAC, CRD, webhook, and target-fact
  boundaries;
- fresh live evidence requirements after replacement.

Until that decision exists, the current supported version remains pinned.

## Files

| File | Role |
| --- | --- |
| [decisions.csv](./decisions.csv) | Spreadsheet replacement queue. |
| [decisions.yaml](./decisions.yaml) | Machine-readable replacement queue. |
| [../promotion-work-orders.md](../promotion-work-orders.md) | Closed proof-lane work orders for these candidates. |
| [../production-disposition/summary.md](../production-disposition/summary.md) | Candidate production-disposition boundary. |

## Verify

\`\`\`sh
npm run top20:latest-replacement-decisions:verify
\`\`\`
`;
}

function csv(rows) {
  const headers = [
    "chart",
    "current_version",
    "current_supported_base",
    "current_decision",
    "current_support_decision",
    "candidate_version",
    "latest_upstream_version",
    "candidate_freshness",
    "candidate_primary_base",
    "candidate_catalog_status",
    "candidate_proof_status",
    "replacement_decision",
    "decision_topics",
    "decision_topic_count",
    "candidate_recipe",
    "candidate_package",
    "confighub_proof_receipt",
    "local_live_receipt",
    "live_parity_receipt",
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
