#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, toYaml, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "latest-top20-refresh", "replacement-decisions");
const csvPath = join(outputRoot, "decisions.csv");
const summaryPath = join(outputRoot, "summary.md");
const yamlPath = join(outputRoot, "decisions.yaml");
const explicitDecisionRoot = join(outputRoot, "decision-artifacts");

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
  const expectedRows = parseCsv(readFileSync(readinessPath, "utf8"))
    .filter((row) => row.catalog_promotion === "root-path-present").length;
  check(report.rows.length === expectedRows, `expected ${expectedRows} latest candidate replacement rows; found ${report.rows.length}`);
  const undecided = report.rows.filter((row) => row.replacement_decision === "not-decided").length;
  const promoted = report.rows.filter((row) => row.replacement_decision === "replace-supported-version").length;
  check(
    report.rows.every((row) => row.replacement_decision !== "replace-supported-version" || row.candidate_catalog_status === "catalog-supported"),
    "a replace-supported-version decision requires the candidate catalog status to be catalog-supported",
  );
  console.log(`verified latest candidate replacement decisions: ${report.rows.length} candidate(s), ${undecided} not decided, ${promoted} support-promoted`);
}

function buildReport() {
  const readinessRows = parseCsv(readFileSync(readinessPath, "utf8"));
  const latestReviewRows = new Map(parseCsv(readFileSync(latestReviewPath, "utf8")).map((row) => [row.chart, row]));
  const disposition = readYaml(candidateDispositionPath);
  const dispositionRows = new Map((disposition.spec?.rows ?? []).map((row) => [row.chart, row]));
  const currentSupportRows = new Map(parseCsv(readFileSync(currentSupportDecisionPath, "utf8")).map((row) => [row.chart, row]));
  const explicitDecisions = explicitDecisionMap();

  const rows = readinessRows.filter((readiness) => readiness.catalog_promotion === "root-path-present").map((readiness) => {
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
    const explicitDecision = explicitDecisions.get(readiness.chart);
    const replacementDecision = explicitDecision
      ? validateExplicitDecision({
          explicitDecision,
          readiness,
          currentSupport,
          dispositionRow,
          candidateFreshness,
          latestVersion: latestReview.latest_version,
          decisionTopics,
        })
      : null;
    const candidateStatus = readYaml(join(repoRoot, rootRecipe, "catalog-status.yaml"));
    const candidateCatalogStatus = candidateStatus.spec?.status ?? "";
    check(
      ["catalog-candidate", "catalog-supported"].includes(candidateCatalogStatus),
      `${rootRecipe} must be catalog-candidate or catalog-supported`,
    );
    if (replacementDecision?.decision === "replace-supported-version") {
      check(candidateCatalogStatus === "catalog-supported", `${rootRecipe} must be catalog-supported when replacement decision is replace-supported-version`);
    } else {
      check(candidateCatalogStatus === "catalog-candidate", `${rootRecipe} must remain catalog-candidate until a replace-supported-version decision is executed`);
    }
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
      candidate_catalog_status: candidateCatalogStatus,
      candidate_proof_status: proofComplete ? "proof-complete-root-path-present" : "incomplete",
      replacement_decision: replacementDecision?.decision ?? "not-decided",
      replacement_decision_path: replacementDecision?.path ?? "",
      replacement_decision_summary: replacementDecision?.summary ?? "",
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
        replacementDecision?.decision,
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
          replacementDecisionArtifact: row.replacement_decision_path || null,
          replacementDecisionSummary: row.replacement_decision_summary || null,
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

function explicitDecisionMap() {
  if (!existsSync(explicitDecisionRoot)) return new Map();
  const decisions = new Map();
  for (const path of listFiles(explicitDecisionRoot).filter((file) => file.endsWith(".yaml")).sort()) {
    const decision = readYaml(path);
    const chart = decision.spec?.chart;
    check(chart, `${relativeRepo(path)} missing spec.chart`);
    check(!decisions.has(chart), `duplicate replacement decision for ${chart}`);
    decisions.set(chart, { path: relativeRepo(path), document: decision });
  }
  return decisions;
}

function validateExplicitDecision({
  explicitDecision,
  readiness,
  currentSupport,
  dispositionRow,
  candidateFreshness,
  latestVersion,
  decisionTopics,
}) {
  const { path, document } = explicitDecision;
  check(document.kind === "LatestCandidateReplacementDecision", `${path} must be kind LatestCandidateReplacementDecision`);
  const spec = document.spec ?? {};
  check(spec.chart === readiness.chart, `${path} chart mismatch`);
  check(String(spec.currentVersion) === readiness.current_version, `${path} currentVersion mismatch`);
  check(String(spec.currentSupportedVersion) === readiness.current_version, `${path} currentSupportedVersion mismatch`);
  check(spec.currentSupportedBase === currentSupport.supported_base, `${path} currentSupportedBase mismatch`);
  check(String(spec.candidateVersion) === readiness.candidate_version, `${path} candidateVersion mismatch`);
  check(String(spec.latestUpstreamVersion) === latestVersion, `${path} latestUpstreamVersion mismatch`);
  check(spec.candidateFreshness === candidateFreshness, `${path} candidateFreshness mismatch`);
  check(spec.candidateBase === dispositionRow.primaryBase, `${path} candidateBase mismatch`);
  check(
    ["replace-supported-version", "defer-replacement", "keep-current-supported", "supersede-candidate"].includes(spec.decision),
    `${path} has unsupported replacement decision ${spec.decision}`,
  );
  check(spec.targetScope?.name, `${path} missing spec.targetScope.name`);
  check(spec.targetScope?.deliveryPath, `${path} missing spec.targetScope.deliveryPath`);
  check((spec.decisionTopicsReviewed ?? []).length > 0, `${path} missing decisionTopicsReviewed`);
  for (const topic of spec.decisionTopicsReviewed ?? []) {
    check(decisionTopics.includes(topic), `${path} reviews unknown topic ${topic}`);
  }
  for (const evidence of spec.evidence ?? []) {
    check(evidence.path, `${path} has evidence without path`);
    check(existsSync(join(repoRoot, evidence.path)), `${path} references missing evidence ${evidence.path}`);
  }
  if (spec.decision !== "replace-supported-version") {
    check(spec.catalogEffect === "no-catalog-promotion", `${path} must record no-catalog-promotion when not replacing`);
  }
  return {
    decision: spec.decision,
    path,
    summary: spec.summary ?? "",
  };
}

function nextActionFor(chart, candidateVersion, currentVersion, topicCount, freshness, latestUpstreamVersion, decision) {
  if (decision === "defer-replacement") {
    return `replacement decision defers ${chart}@${candidateVersion}; keep ${currentVersion} pinned and revisit after the recorded requirements are satisfied`;
  }
  if (decision === "keep-current-supported") {
    return `replacement decision keeps ${chart}@${currentVersion} as the supported catalog version; retain ${candidateVersion} only as candidate evidence`;
  }
  if (decision === "supersede-candidate") {
    return `replacement decision supersedes ${chart}@${candidateVersion}; refresh to ${latestUpstreamVersion} before considering replacement`;
  }
  if (decision === "replace-supported-version") {
    return `replacement decision selects ${chart}@${candidateVersion}; promote only after catalog status, support decision, and fresh evidence are updated`;
  }
  if (freshness === "superseded-by-newer-upstream") {
    return `candidate ${chart}@${candidateVersion} is behind latest upstream ${latestUpstreamVersion}; decide whether to supersede it or keep it for legacy patch/rollback evidence before replacing ${currentVersion}`;
  }
  return `write target-scoped replacement decision for ${chart}@${candidateVersion}; review ${topicCount} topic(s), then choose replace, defer, or keep ${currentVersion} pinned`;
}

function summary(rows) {
  const proofComplete = rows.filter((row) => row.candidate_proof_status === "proof-complete-root-path-present").length;
  const notDecided = rows.filter((row) => row.replacement_decision === "not-decided").length;
  const decided = rows.length - notDecided;
  const latestAligned = rows.filter((row) => row.candidate_freshness === "latest-upstream-aligned").length;
  const superseded = rows.filter((row) => row.candidate_freshness === "superseded-by-newer-upstream").length;
  const promoted = rows.filter((row) => row.replacement_decision === "replace-supported-version").length;
  const tableRows = rows.map(
    (row) =>
      `| \`${row.chart}\` | \`${row.current_version}\` | \`${row.candidate_version}\` | \`${row.latest_upstream_version}\` | ${row.candidate_freshness} | ${row.candidate_primary_base} | ${row.candidate_proof_status} | ${decisionCell(row)} | ${row.decision_topic_count} | ${row.next_action} |`,
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
replacement decisions written: ${decided} / ${rows.length}
support-promoted candidates: ${promoted} / ${rows.length}
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
| [decision-artifacts/](./decision-artifacts/) | Target-scoped replacement decisions that close individual rows. |
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
    "replacement_decision_path",
    "replacement_decision_summary",
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

function decisionCell(row) {
  if (!row.replacement_decision_path) return row.replacement_decision;
  return `[${row.replacement_decision}](${row.replacement_decision_path.replace(/^data\/latest-top20-refresh\/replacement-decisions\//, "./")})`;
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
