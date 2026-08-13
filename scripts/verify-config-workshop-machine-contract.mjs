#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const siteRoot = join(repoRoot, "site");
const feedPath = join(siteRoot, "changes.json");
const schemaPath = join(siteRoot, "changes.schema.json");
const catalogPath = join(siteRoot, "catalog.json");
const llmsPath = join(siteRoot, "llms.txt");
const askPath = join(siteRoot, "ask.html");
const checkScriptPath = join(siteRoot, "check-config.js");
const issueTemplatePath = join(repoRoot, ".github", "ISSUE_TEMPLATE", "problem-chart.yml");
const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const GITHUB_BLOB_BASE_URL = "https://github.com/confighub/helm-expt/blob/main/";
const STATUSES = new Set(["checked", "partial", "not_checked", "not_applicable"]);
const COVERAGE_FAMILIES = [
  "retained_package",
  "chart_analysis",
  "render_parity",
  "values_diagnostics",
  "lifecycle_observation",
  "local_kubernetes",
  "gitops_oci",
  "live_parity",
  "two_cluster",
  "promotion",
  "upstream_republish",
];

const feed = readJson(feedPath);
const schema = readJson(schemaPath);
const catalog = readJson(catalogPath);
const errors = validateFeed(feed, { checkFiles: true });

check(schema.$id === `${SITE_BASE_URL}changes.schema.json`, "schema $id must be the public schema URL");
check(schema.properties?.schema_version?.const === "1", "schema must pin major version 1");
check(schema.required?.includes("retention"), "schema must require the retention summary");
check(
  COVERAGE_FAMILIES.every((family) => schema.$defs?.entry?.properties?.coverage?.required?.includes(family)),
  "schema must require every coverage family",
);
check(feed.entries.length === (catalog.installerOciPackages ?? []).length, "feed must contain every retained package version");

const publishedRows = (catalog.installerOciPackages ?? []).filter(
  (row) => row.publication_status === "published-receipt" && row.publication_receipt,
);
const publicationDates = publishedRows.map((row) => {
  const text = readFileSync(join(repoRoot, row.publication_receipt), "utf8");
  const observedAt = text.match(/^  observedAt: "([^"]+)"$/m)?.[1];
  check(observedAt && !Number.isNaN(Date.parse(observedAt)), `${row.chart}@${row.version}: publication receipt has no valid observedAt`);
  return observedAt;
}).sort();
check(feed.retention.retained_components === new Set(catalog.installerOciPackages.map((row) => row.chart)).size, "retention component count differs from catalog.json");
check(feed.retention.retained_package_versions === catalog.installerOciPackages.length, "retention version count differs from catalog.json");
check(feed.retention.published_package_versions === publishedRows.length, "retention publication count differs from catalog.json");
check(feed.retention.oldest_publication_receipt_at === publicationDates[0], "retention oldest receipt date differs from publication evidence");
check(feed.retention.upstream_republished_version_pairs === (catalog.upstreamDrift ?? []).length, "retention republish count differs from the drift record");
check(feed.retention.license_evidence_as_of === catalog.chartLicensesResearchedAt, "retention license date differs from the chart-license record");

for (const row of catalog.installerOciPackages ?? []) {
  const entry = resolveEntry(feed, row.chart, row.version);
  check(entry, `${row.chart}@${row.version}: feed entry is missing`);
  check(entry.chart === row.chart, `${row.chart}@${row.version}: canonical resolution changed chart identity`);
  check(entry.digest === row.published_digest, `${row.chart}@${row.version}: feed digest differs from catalog.json`);
}

const redis = resolveEntry(feed, "bitnami/redis", "25.5.3");
check(redis?.coverage?.retained_package?.status === "checked", "Redis retained package must resolve as checked");
const aliasEntry = feed.entries.find((entry) => entry.aliases.length > 0);
check(aliasEntry, "feed must include at least one declared chart alias");
check(
  resolveEntry(feed, aliasEntry.aliases[0], aliasEntry.version)?.chart === aliasEntry.chart,
  "declared alias must resolve to the canonical chart and exact version",
);
check(consumerVerdict(redis, "values_diagnostics") === "checked", "checked coverage must remain checked for consumers");
check(consumerVerdict(redis, "upstream_republish") === "unknown", "not_checked coverage must be unknown, never pass");

const missingCoverage = structuredClone(feed);
delete missingCoverage.entries[0].coverage.render_parity;
check(
  validateFeed(missingCoverage, { checkFiles: false }).some((message) => message.includes("render_parity")),
  "self-test: deleting a coverage family must fail validation",
);
const falseChecked = structuredClone(feed);
falseChecked.entries[0].coverage.retained_package = { status: "checked", evidence_urls: [] };
check(
  validateFeed(falseChecked, { checkFiles: false }).some((message) => message.includes("requires evidence")),
  "self-test: checked coverage without evidence must fail validation",
);
const missingRetention = structuredClone(feed);
delete missingRetention.retention;
check(
  validateFeed(missingRetention, { checkFiles: false }).some((message) => message.includes("retention")),
  "self-test: deleting the retention summary must fail validation",
);
const falseRetentionCount = structuredClone(feed);
falseRetentionCount.retention.retained_package_versions += 1;
check(
  validateFeed(falseRetentionCount, { checkFiles: false }).some((message) => message.includes("retained_package_versions")),
  "self-test: an impossible retention count must fail validation",
);

const llms = readFileSync(llmsPath, "utf8");
const ask = readFileSync(askPath, "utf8");
const checkScript = readFileSync(checkScriptPath, "utf8");
const issueTemplate = readFileSync(issueTemplatePath, "utf8");
for (const term of ["## Machine contract", "Missing coverage means we have not checked that claim", "changes.schema.json", "retention object is computed", "Normal catalog refreshes are additive"]) {
  check(llms.includes(term), `site/llms.txt must explain the machine contract: ${term}`);
}
for (const term of ["Choose a question", "WORKSHOP FINDING", "Only completed checks count as evidence", "review.schema.json", "Propose this public case"]) {
  check(ask.includes(term), `site/ask.html must expose the question-first contract: ${term}`);
}
for (const term of ["config-diff", "Comparison objects", "Source reference", "Optional comparison: add what you run today"]) {
  check(ask.includes(term), `site/ask.html must expose the local comparison path: ${term}`);
}
for (const forbidden of [
  'target.searchParams.set("observed"',
  'target.searchParams.set("values"',
  "Assistant finding:",
]) {
  check(!checkScript.includes(forbidden), `site/check-config.js must not put private inputs or the full assistant answer in the GitHub URL: ${forbidden}`);
}
check(ask.includes('"maxIssueUrlLength":1800'), "site/ask.html must keep the public issue URL below 1,800 characters");
for (const term of ['lastIndexOf("WORKSHOP FINDING")', "target.toString().length <= settings.maxIssueUrlLength", "Paste the copied finding or review record"]) {
  check(checkScript.includes(term), `site/check-config.js must keep the public issue handoff bounded: ${term}`);
}
for (const term of ["challenge-intake", "id: question_code", "id: question", "config-diff", "two business days", "within seven days"]) {
  check(issueTemplate.includes(term), `problem-chart issue template must expose the receiving contract: ${term}`);
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  throw new Error(`Config Workshop machine contract has ${errors.length} error(s)`);
}

console.log(
  `verified Config Workshop machine contract for ${feed.entries.length} exact package version(s), ${aliasCount(feed)} alias(es), and ${COVERAGE_FAMILIES.length} coverage families`,
);

function validateFeed(candidate, { checkFiles }) {
  const findings = [];
  if (candidate?.schema_version !== "1") findings.push("schema_version must equal 1");
  if (!candidate?.generated_at || Number.isNaN(Date.parse(candidate.generated_at))) findings.push("generated_at must be an ISO timestamp");
  validateRetention(candidate?.retention, candidate?.entries, findings, checkFiles);
  if (!Array.isArray(candidate?.entries)) return [...findings, "entries must be an array"];

  const identities = new Set();
  const canonicalCharts = new Set(candidate.entries.map((entry) => entry.chart));
  const aliases = new Set();
  for (const entry of candidate.entries) {
    const identity = `${entry.chart}@${entry.version}`;
    if (!/^[^/]+\/[^/]+$/.test(entry.chart ?? "")) findings.push(`${identity}: chart must be repository/name`);
    if (!entry.version) findings.push(`${identity}: version is required`);
    if (identities.has(identity)) findings.push(`${identity}: duplicate entry`);
    identities.add(identity);
    if (!/^[a-f0-9]{64}$/.test(entry.digest ?? "")) findings.push(`${identity}: digest must be 64 lowercase hex characters`);
    if (!String(entry.canonical_url ?? "").startsWith(`${SITE_BASE_URL}charts/`)) findings.push(`${identity}: canonical_url is not a public chart page`);
    if (!String(entry.package_oci_ref ?? "").startsWith("oci://")) findings.push(`${identity}: package_oci_ref must start with oci://`);
    if (!Array.isArray(entry.aliases)) findings.push(`${identity}: aliases must be an array`);
    for (const alias of entry.aliases ?? []) {
      if (!/^[^/]+\/[^/]+$/.test(alias)) findings.push(`${identity}: invalid alias ${alias}`);
      if (canonicalCharts.has(alias)) findings.push(`${identity}: alias collides with a canonical chart: ${alias}`);
      const aliasKey = `${alias}@${entry.version}`;
      if (aliases.has(aliasKey)) findings.push(`${identity}: alias and version are not unique: ${aliasKey}`);
      aliases.add(aliasKey);
    }
    if (!entry.coverage || typeof entry.coverage !== "object") {
      findings.push(`${identity}: coverage is required`);
      continue;
    }
    for (const family of COVERAGE_FAMILIES) {
      const coverage = entry.coverage[family];
      if (!coverage) {
        findings.push(`${identity}: missing coverage family ${family}`);
        continue;
      }
      if (!STATUSES.has(coverage.status)) findings.push(`${identity}: ${family} has invalid status ${coverage.status}`);
      if (!Array.isArray(coverage.evidence_urls)) findings.push(`${identity}: ${family} evidence_urls must be an array`);
      if (["checked", "partial"].includes(coverage.status) && !(coverage.evidence_urls?.length > 0)) {
        findings.push(`${identity}: ${family} ${coverage.status} requires evidence`);
      }
      for (const url of coverage.evidence_urls ?? []) {
        if (!String(url).startsWith("https://")) findings.push(`${identity}: ${family} evidence must use https: ${url}`);
        if (checkFiles) {
          const localPath = localPathForUrl(url);
          if (localPath && !existsSync(localPath)) findings.push(`${identity}: ${family} evidence target is missing: ${url}`);
        }
      }
    }
    if (checkFiles) {
      const canonicalPath = localPathForUrl(entry.canonical_url);
      if (!canonicalPath || !existsSync(canonicalPath)) findings.push(`${identity}: canonical chart page is missing`);
    }
  }
  return findings;
}

function validateRetention(retention, entries, findings, checkFiles) {
  if (!retention || typeof retention !== "object") {
    findings.push("retention summary is required");
    return;
  }
  if (retention.policy !== "additive_only") findings.push("retention policy must be additive_only");
  if (retention.license_gate !== "evidence_required_before_listing") findings.push("retention license_gate is invalid");
  for (const field of ["retained_components", "retained_package_versions", "published_package_versions", "upstream_republished_version_pairs"]) {
    if (!Number.isInteger(retention[field]) || retention[field] < 0) findings.push(`retention ${field} must be a non-negative integer`);
  }
  if (Array.isArray(entries) && retention.retained_package_versions !== entries.length) {
    findings.push("retention retained_package_versions must equal the number of entries");
  }
  if (!retention.oldest_publication_receipt_at || Number.isNaN(Date.parse(retention.oldest_publication_receipt_at))) {
    findings.push("retention oldest_publication_receipt_at must be an ISO timestamp");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retention.license_evidence_as_of ?? "")) {
    findings.push("retention license_evidence_as_of must be an ISO date");
  }
  for (const name of ["policy", "packages", "upstream_republishes", "licenses"]) {
    const url = retention.evidence_urls?.[name];
    if (!String(url ?? "").startsWith("https://")) {
      findings.push(`retention ${name} evidence must use https`);
      continue;
    }
    if (checkFiles) {
      const localPath = localPathForUrl(url);
      if (localPath && !existsSync(localPath)) findings.push(`retention ${name} evidence target is missing: ${url}`);
    }
  }
}

function resolveEntry(candidate, chart, version) {
  return candidate.entries.find((entry) => entry.version === version && (entry.chart === chart || entry.aliases.includes(chart)));
}

function consumerVerdict(entry, family) {
  return entry?.coverage?.[family]?.status === "checked" ? "checked" : "unknown";
}

function localPathForUrl(url) {
  if (url.startsWith(SITE_BASE_URL)) {
    const relPath = decodeURIComponent(url.slice(SITE_BASE_URL.length).split(/[?#]/)[0]) || "index.html";
    return join(siteRoot, relPath.endsWith("/") ? `${relPath}index.html` : relPath);
  }
  if (url.startsWith(GITHUB_BLOB_BASE_URL)) {
    return join(repoRoot, decodeURIComponent(url.slice(GITHUB_BLOB_BASE_URL.length)));
  }
  return null;
}

function aliasCount(candidate) {
  return candidate.entries.reduce((total, entry) => total + entry.aliases.length, 0);
}

function readJson(path) {
  check(existsSync(path), `${path} is missing; run npm run site:generate`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}
