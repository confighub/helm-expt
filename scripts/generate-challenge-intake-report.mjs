#!/usr/bin/env node

// Publish the aggregate record for the Config Workshop question intake.
//
// Contact details and private chart information do not belong in this
// repository. The source file therefore holds one row of counts per month.
// This generator validates those counts and turns them into a short public
// report. A zero row is useful: it says the demand test has not started rather
// than making silence look like evidence.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const sourcePath = join(repoRoot, "data", "challenge-intake", "monthly.csv");
const summaryPath = join(repoRoot, "data", "challenge-intake", "summary.md");

const HEADERS = [
  "month",
  "status",
  "qualified_invitations",
  "cohort_public_submissions",
  "other_public_submissions",
  "triage_ready_submissions",
  "decisions_within_7_days",
  "user_confirmations",
  "local_only_responses",
];
const STATUSES = new Set(["not_started", "running", "complete"]);

const mode = process.argv[2] ?? "--verify";
if (!new Set(["--generate", "--verify", "--self-test"]).has(mode)) {
  console.error(`Usage:
  node scripts/generate-challenge-intake-report.mjs --generate
  node scripts/generate-challenge-intake-report.mjs --verify
  node scripts/generate-challenge-intake-report.mjs --self-test`);
  process.exit(2);
}

if (mode === "--self-test") {
  runSelfTest();
  console.log("verified challenge-intake report self-tests");
  process.exit(0);
}

check(existsSync(sourcePath), `${relativeRepo(sourcePath)} is missing`);
const rows = parseRows(readFileSync(sourcePath, "utf8"));
const findings = validateRows(rows);
check(findings.length === 0, findings.join("\n"));
const report = analyse(rows);
const rendered = renderSummary(report);

if (mode === "--generate") {
  write(summaryPath, rendered);
  console.log(`wrote ${relativeRepo(summaryPath)}: ${report.totalInvitations} invitation(s), ${report.totalPublicSubmissions} public submission(s)`);
} else {
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run challenge-intake:generate`);
  check(readFileSync(summaryPath, "utf8") === rendered, `${relativeRepo(summaryPath)} is stale; run npm run challenge-intake:generate`);
  console.log(`verified challenge intake: ${report.totalInvitations} invitation(s), ${report.totalPublicSubmissions} public submission(s), status ${report.status}`);
}

function parseRows(text) {
  const lines = text.trim().split("\n").filter(Boolean);
  check(lines.length >= 2, "monthly.csv must contain a header and at least one month");
  const headers = lines[0].split(",");
  check(JSON.stringify(headers) === JSON.stringify(HEADERS), `monthly.csv headers must be ${HEADERS.join(",")}`);
  return lines.slice(1).map((line, index) => {
    const fields = line.split(",");
    check(fields.length === HEADERS.length, `monthly.csv row ${index + 2} has ${fields.length} fields; expected ${HEADERS.length}`);
    return Object.fromEntries(HEADERS.map((header, fieldIndex) => [header, fields[fieldIndex]]));
  });
}

function validateRows(rows) {
  const findings = [];
  const months = new Set();
  let previous = "";
  for (const [index, row] of rows.entries()) {
    const prefix = `row ${index + 2}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)) findings.push(`${prefix}: month must use YYYY-MM`);
    if (months.has(row.month)) findings.push(`${prefix}: month ${row.month} is duplicated`);
    if (previous && row.month <= previous) findings.push(`${prefix}: months must be in ascending order`);
    months.add(row.month);
    previous = row.month;
    if (!STATUSES.has(row.status)) findings.push(`${prefix}: status must be not_started, running, or complete`);

    for (const field of HEADERS.slice(2)) {
      if (!/^\d+$/.test(row[field])) findings.push(`${prefix}: ${field} must be a non-negative integer`);
      row[field] = Number(row[field]);
    }

    const publicTotal = row.cohort_public_submissions + row.other_public_submissions;
    if (row.cohort_public_submissions + row.local_only_responses > row.qualified_invitations) {
      findings.push(`${prefix}: cohort public and local-only responses cannot exceed qualified invitations`);
    }
    if (row.triage_ready_submissions > publicTotal) findings.push(`${prefix}: triage-ready submissions cannot exceed public submissions`);
    if (row.decisions_within_7_days > row.triage_ready_submissions) findings.push(`${prefix}: seven-day decisions cannot exceed triage-ready submissions`);
    if (row.user_confirmations > row.decisions_within_7_days) findings.push(`${prefix}: user confirmations cannot exceed seven-day decisions`);
    if (row.status === "not_started" && HEADERS.slice(2).some((field) => row[field] !== 0)) {
      findings.push(`${prefix}: a not_started month must contain zero counts`);
    }
  }
  return findings;
}

function analyse(rows) {
  const sum = (field) => rows.reduce((total, row) => total + row[field], 0);
  const totalInvitations = sum("qualified_invitations");
  const cohortPublicSubmissions = sum("cohort_public_submissions");
  const otherPublicSubmissions = sum("other_public_submissions");
  const totalPublicSubmissions = cohortPublicSubmissions + otherPublicSubmissions;
  const triageReady = sum("triage_ready_submissions");
  const decisionsWithin7Days = sum("decisions_within_7_days");
  const userConfirmations = sum("user_confirmations");
  const localOnlyResponses = sum("local_only_responses");
  const status = rows.some((row) => row.status === "running")
    ? "running"
    : rows.some((row) => row.status === "complete")
      ? "complete"
      : "not started";
  return {
    rows,
    status,
    totalInvitations,
    cohortPublicSubmissions,
    otherPublicSubmissions,
    totalPublicSubmissions,
    triageReady,
    decisionsWithin7Days,
    userConfirmations,
    localOnlyResponses,
  };
}

function renderSummary(report) {
  const statusSentence = report.status === "not started"
    ? "The controlled thirty-day test has not started. The zero counts below are a baseline, not a demand result."
    : report.status === "running"
      ? "The controlled thirty-day test is running. Read the counts as progress, not as a final result."
      : "The controlled thirty-day test is complete. Compare the totals with the stated thresholds below.";
  const monthRows = report.rows.map((row) => {
    const publicTotal = row.cohort_public_submissions + row.other_public_submissions;
    return `| ${row.month} | ${row.status.replaceAll("_", " ")} | ${row.qualified_invitations} | ${publicTotal} | ${row.triage_ready_submissions} | ${row.decisions_within_7_days} | ${row.user_confirmations} | ${row.local_only_responses} |`;
  }).join("\n");
  return `# Public question intake

${statusSentence}

Config Workshop invites operators with a current public configuration problem to ask one exact question. The source may be Helm, AICR, OCI, or Kubernetes YAML. Public submissions use the \`challenge-intake\` label. Private source, values, contact details, and conversations stay outside this repository.

## Current totals

| Measure | Count | Thirty-day target |
| --- | ---: | ---: |
| Qualified invitations | ${report.totalInvitations} | 40 |
| Public submissions from the cohort | ${report.cohortPublicSubmissions} | 4 |
| Other public submissions | ${report.otherPublicSubmissions} | observed separately |
| Triage-ready submissions | ${report.triageReady} | 3 |
| Decisions posted within seven days | ${report.decisionsWithin7Days} | at least half of accepted submissions |
| Users who said the answer changed or confirmed a decision | ${report.userConfirmations} | 1 |
| Invited users who kept the result local | ${report.localOnlyResponses} | observed, no target |

## Monthly aggregate

| Month | Status | Invitations | Public submissions | Triage ready | Decisions in 7 days | User confirmations | Local only |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${monthRows}

## How reports are handled

A complete public report should be acknowledged within two business days. It should receive a Catalog answer, a named refusal, or an evidence decision within seven days. Rendering alone does not make a case known-good. [Read the response process and comment templates](../../docs/reference/question-intake-operation.md).

## How to read this record

This file does not count page views or infer private activity. The cohort denominator comes from invitations recorded outside the public repository; only the monthly total is committed here. Organic public issues are counted separately so they do not make the forty-person test look stronger than it is.
`;
}

function runSelfTest() {
  const valid = parseRows(`${HEADERS.join(",")}\n2026-08,running,10,2,1,2,1,1,3\n`);
  check(validateRows(valid).length === 0, "self-test: valid intake row failed validation");

  const impossible = parseRows(`${HEADERS.join(",")}\n2026-08,running,2,2,0,2,2,3,1\n`);
  check(validateRows(impossible).some((finding) => finding.includes("user confirmations")), "self-test: impossible confirmation count passed validation");

  const falseStart = parseRows(`${HEADERS.join(",")}\n2026-08,not_started,1,0,0,0,0,0,0\n`);
  check(validateRows(falseStart).some((finding) => finding.includes("not_started")), "self-test: nonzero not-started row passed validation");
}
