#!/usr/bin/env node

import { createHash } from "node:crypto";
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
const workshopResultSchemaPath = join(siteRoot, "workshop-result.schema.json");
const workshopCiReportSchemaPath = join(siteRoot, "workshop-ci-report.schema.json");
const promotePath = join(siteRoot, "promote.html");
const promoteScriptPath = join(siteRoot, "promote-config.js");
const promotionSchemaPath = join(siteRoot, "promotion-review.schema.json");
const baseVariantRecordsPath = join(siteRoot, "base-variant-records.json");
const listingSchemaPath = join(siteRoot, "listing.schema.json");
const listingRoot = join(siteRoot, "listings");
const listingIndexPath = join(listingRoot, "index.json");
const agentSkillPath = join(siteRoot, ".well-known", "agent-skills", "config-workshop", "SKILL.md");
const agentSkillIndexPath = join(siteRoot, ".well-known", "agent-skills", "index.json");
const issueTemplatePath = join(repoRoot, ".github", "ISSUE_TEMPLATE", "problem-chart.yml");
const commandContractPath = join(repoRoot, "data", "config-workshop-command-contract", "command-map.json");
const commandContractSummaryPath = join(repoRoot, "data", "config-workshop-command-contract", "summary.md");
const commandContractResultPaths = [
  join(repoRoot, "data", "config-workshop-command-contract", "helm", "workshop-result.json"),
  join(repoRoot, "data", "config-workshop-command-contract", "kubernetes-yaml", "workshop-result.json"),
];
const commandContractPromotionReviewPath = join(
  repoRoot,
  "data",
  "config-workshop-command-contract",
  "helm",
  "promotion-review.json",
);
const ciReportPaths = [
  join(repoRoot, "data", "config-workshop-ci-report", "nginx-reviewed", "report.json"),
  join(repoRoot, "data", "config-workshop-ci-report", "kubernetes-yaml", "report.json"),
  join(repoRoot, "data", "config-workshop-ci-report", "redis-reuse-existing-secret", "report.json"),
];
const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const GITHUB_BLOB_BASE_URL = "https://github.com/confighub/helm-expt/blob/main/";
const STATUSES = new Set(["checked", "partial", "not_checked", "not_applicable"]);
// The address an agent builds to read one catalog entry. It is published in
// llms.txt and in the listing index, and both are checked against this.
const LISTING_URL_PATTERN = `${SITE_BASE_URL}listings/{id}.json`;
// The nine sections every catalog listing carries, whatever format the
// configuration came from. A listing that drops one stops being uniform, and an
// agent reading listings by URL has no way to notice.
const LISTING_SECTIONS = [
  "identity",
  "source",
  "flattened",
  "oci",
  "variants",
  "routing",
  "lifecycle",
  "assessment",
  "evidence",
];
const LISTING_COVERAGE_LANES = [
  "render_parity",
  "confighub_scan_ops",
  "local_kubernetes",
  "lifecycle_observation",
  "gitops_oci_live",
  "live_dual_parity",
  "two_cluster_kind",
  "variant_promotion",
];
const LISTING_STATUSES = new Set(["checked", "partial", "not_checked", "not_applicable", "not_declared"]);
// A listing may only call a lane checked when the catalog recorded one of
// these words for it. Without this, a projection could promote a todo.
const LISTING_CHECKED_WORDS = new Set(["yes", "proven"]);
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
const workshopResultSchema = readJson(workshopResultSchemaPath);
const workshopCiReportSchema = readJson(workshopCiReportSchemaPath);
const promote = readFileSync(promotePath, "utf8");
const promoteScript = readFileSync(promoteScriptPath, "utf8");
const promotionSchema = readJson(promotionSchemaPath);
const baseVariantRecords = readJson(baseVariantRecordsPath);
const agentSkill = readFileSync(agentSkillPath, "utf8");
const agentSkillIndex = readJson(agentSkillIndexPath);
const issueTemplate = readFileSync(issueTemplatePath, "utf8");
const commandContract = readJson(commandContractPath);
const commandContractSummary = readFileSync(commandContractSummaryPath, "utf8");
const commandContractResults = commandContractResultPaths.map(readJson);
const commandContractPromotionReview = readJson(commandContractPromotionReviewPath);
const ciReports = ciReportPaths.map(readJson);
for (const term of ["## Machine contract", "Missing coverage means we have not checked that claim", "changes.schema.json", "retention object is computed", "Normal catalog refreshes are additive"]) {
  check(llms.includes(term), `site/llms.txt must explain the machine contract: ${term}`);
}
for (const term of ["workshop-result.schema.json", "workshop-ci-report.schema.json", "promotion-review.schema.json", "base-variant-records.json"]) {
  check(llms.includes(term), `site/llms.txt must link the source-aware promotion contract: ${term}`);
}
for (const term of ["ConfigHub Workshop agent skill", ".well-known/agent-skills/config-workshop/SKILL.md"]) {
  check(llms.includes(term), `site/llms.txt must expose the agent contract: ${term}`);
}
check(agentSkill.includes("Promote my config"), "published agent skill must include the promotion task");
check(agentSkill.includes("Never print Secret values"), "published agent skill must include the Secret boundary");
check(agentSkillIndex.skills?.some((item) => item.name === "config-workshop"), "agent discovery index must list config-workshop");
for (const term of ["Choose a question", "WORKSHOP FINDING", "Only completed checks count as evidence", "review.schema.json", "workshop-result.schema.json", "Propose this public case", "Run the shared checks on your machine", "cub plugin install confighub/homebrew-tap@cub-scan-v0.7.3 --name scan", "cub check --format json --output cub-check.json ./rendered", "stable finding IDs", "Add the result from <code>cub check</code>", "accepts it only when its object count and object-set hash match", "Local findings remain advisory", "I am back with the rendered files"]) {
  check(ask.includes(term), `site/ask.html must expose the question-first contract: ${term}`);
}
for (const term of ["Run shared local checks", "cub check --format json --output cub-check.json ./rendered", "local and advisory"]) {
  check(llms.includes(term), `site/llms.txt must expose the released local check path: ${term}`);
}
check(workshopResultSchema.properties?.kind?.const === "WorkshopResult", "workshop result schema must define WorkshopResult");
check(workshopResultSchema.properties?.apiVersion?.const === "workshop.confighub.com/v1alpha2", "workshop result schema must pin v1alpha2");
check(workshopResultSchema.properties?.spec?.required?.includes("candidate"), "workshop result must require the candidate identity");
check(workshopResultSchema.properties?.spec?.required?.includes("assessment"), "workshop result must require the four assessment stages");
check(workshopResultSchema.properties?.spec?.required?.includes("findingDecisions"), "workshop result must require finding decisions");
check(workshopResultSchema.$defs?.objectSetIdentity?.properties?.algorithm?.const === "cub-scan-canonical-json-v1", "workshop result must name the canonical object-set algorithm");
check(workshopResultSchema.properties?.spec?.properties?.checks?.required?.includes("advisoryReceipts"), "workshop result must require explicit advisory receipts");
check(workshopResultSchema.$defs?.localAdvisoryReceipt?.properties?.authority?.const === "local-advisory", "workshop result must keep local checks advisory");
check(workshopCiReportSchema.properties?.schemaVersion?.const === "workshop-ci-report-v1", "CI report schema must pin v1");
check(workshopCiReportSchema.properties?.verdict?.enum?.includes("clear-in-completed-checks"), "CI report schema must use the bounded clear verdict");
check(!workshopCiReportSchema.properties?.verdict?.enum?.includes("safe"), "CI report schema must not call a static result safe");
for (const report of ciReports) {
  check(report.schemaVersion === "workshop-ci-report-v1", "generated CI report must use v1");
  check(/^sha256:[0-9a-f]{64}$/.test(report.candidate?.objectSetSha256 ?? ""), "generated CI report must retain the exact object-set hash");
  check(report.checks?.runtime === "not-checked", "generated local CI report must not claim runtime status");
  check(report.scope?.notProven?.includes("destination acceptance"), "generated CI report must name its destination limit");
}
for (const term of ["kind: \"WorkshopResult\"", "download-workshop-result", "workshop-result.json", "notRun", "findingDecisions", "unreviewed", "matchedCubCheck", "scannerObjectSetPayload", "validateCubCheckReceipt", "cub-check.json", "local-check-object-set-sha256", "local advisory evidence, not ConfigHub validation"]) {
  check(checkScript.includes(term), `site/check-config.js must expose the complete browser result: ${term}`);
}
check(commandContract.kind === "CommandContract", "command contract must define CommandContract");
check(commandContract.spec?.jobs?.length === 3, "command contract must expose the same three jobs as the website");
check(commandContract.spec?.examples?.length === 2, "command contract must include Helm and non-Helm examples");
check(commandContract.spec.examples.some((item) => item.source?.type === "helm"), "command contract must include Helm");
check(commandContract.spec.examples.some((item) => item.source?.type === "kubernetes-yaml"), "command contract must include literal Kubernetes YAML");
for (const term of ["same three jobs", "canonical object-set hash", "ConfigHub begins", "recorded as a no-op", "exact command proof stops before release publication", "Live NGINX retention and promotion proof", "npm run workshop:commands:run-local"]) {
  check(commandContractSummary.includes(term), `command-contract summary must explain ${term}`);
}
for (const result of commandContractResults) validateWorkshopResult(result);
for (const example of commandContract.spec.examples) {
  const result = commandContractResults.find((candidate) => candidate.spec.source.type === example.source.type);
  check(result, `${example.id}: generated WorkshopResult is missing`);
  check(result.spec.candidate.objectSet.sha256 === example.acceptedObjectSet.sha256, `${example.id}: command map and WorkshopResult object-set hashes differ`);
  check(example.stages.check.command.startsWith("cub check "), `${example.id}: shared check must use the released cub check command`);
  check(example.stages.retain.dryRun.includes("cub variant upload --dry-run --component"), `${example.id}: retention must start with a complete dry run`);
  check(example.stages.retain.dryRun.includes(`workshop.confighub.com/object-set-sha256=${example.acceptedObjectSet.sha256}`), `${example.id}: retention must carry the accepted object-set hash`);
  check(example.stages.retain.bindAcceptedIdentity.includes("cub unit update"), `${example.id}: retention must bind the accepted identity after upload`);
  check(example.stages.vary.command.includes("--space-pattern template:"), `${example.id}: variant creation must use current released cub syntax`);
  check(example.stages.promote.command.includes("cub variant promote") && example.stages.promote.command.includes("--dry-run -o mutations"), `${example.id}: promotion must remain a dry-run preview`);
  check(example.stages.release.status === "requires-release-target-and-gates", `${example.id}: release publication must name its target and gate prerequisites`);
  check(example.stages.release.note.includes("release target") && example.stages.release.note.includes("approvals pass"), `${example.id}: release boundary must be explicit`);
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
check(promotionSchema.properties?.kind?.const === "PromotionReview", "promotion schema must define PromotionReview");
check(
  promotionSchema.properties?.spec?.required?.includes("destinationPreflight"),
  "promotion schema must require destination preflight",
);
check(
  promotionSchema.properties?.spec?.required?.includes("assessment"),
  "promotion schema must require the four assessment stages",
);
check(
  promotionSchema.definitions?.destinationPreflight?.required?.includes("checks"),
  "promotion destination preflight must require checks",
);
check(Array.isArray(baseVariantRecords.records) && baseVariantRecords.records.length > 0, "base variant record index must contain records");
validateAssessment(commandContractPromotionReview.spec?.assessment, "generated PromotionReview");
check(baseVariantRecords.records.some((record) => record.spec?.source?.type === "timoni"), "base variant records must include the Timoni source pilot");
for (const term of ["Where the changes came from", "Hooks, CRDs, and required setup", "Before this reaches the destination", "Target results", "promotion-review.schema.json", "Preview commands do not change ConfigHub", "Run after approval", "confighub-promotion-preview", "confighub-promotion-run", "Create it, then run the preview again before using the write commands"]) {
  check(promote.includes(term), `site/promote.html must expose source-aware promotion results: ${term}`);
}
for (const term of ["classifySourceAware", "destinationPreflight", "parseTargetResults", "--dry-run -o mutations", "Do not call the fleet successful", "setConfigHubCommands", "copy-confighub-preview", "copy-confighub-run", "set -euo pipefail", "Stop if ${destination} has not been created and previewed"]) {
  check(promoteScript.includes(term), `site/promote-config.js must keep the promotion boundary: ${term}`);
}
check(!promote.includes("remove <code>--dry-run</code>"), "site/promote.html must not tell users to turn a preview into a write by editing the command");

const listingSchema = readJson(listingSchemaPath);
const listingIndex = readJson(listingIndexPath);

check(listingSchema.$id === `${SITE_BASE_URL}listing.schema.json`, "listing schema $id must be the public schema URL");
check(listingSchema.properties?.kind?.const === "CatalogListing", "listing schema must define CatalogListing");
check(listingSchema.properties?.listingVersion?.const === "1", "listing schema must pin major version 1");
for (const section of LISTING_SECTIONS) {
  check(listingSchema.required?.includes(section), `listing schema must require the ${section} section on every format`);
}
check(
  LISTING_COVERAGE_LANES.every((lane) => listingSchema.properties?.lifecycle?.properties?.coverage?.required?.includes(lane)),
  "listing schema must require every coverage lane",
);
const listingCoverageStatuses = listingSchema.$defs?.coverageLane?.properties?.status?.enum ?? [];
check(listingCoverageStatuses.includes("not_declared"), "a listing must be able to say a lane was never declared");
check(!listingCoverageStatuses.includes("safe"), "a listing coverage lane must not offer a safety verdict");
check(listingSchema.$defs?.ociState?.enum?.includes("not-recorded"), "a listing must be able to say an OCI role was never recorded");
check(
  listingSchema.properties?.oci?.properties?.bundles?.minItems === 4
    && listingSchema.properties?.oci?.properties?.runtimes?.minItems === 3,
  "listing schema must require the same OCI roles and runtimes on every listing",
);

check(listingIndex.kind === "CatalogListingIndex", "the listing index must define CatalogListingIndex");
check(listingIndex.listingVersion === "1", "the listing index must pin the same major version as the schema");
check(listingIndex.schema === `${SITE_BASE_URL}listing.schema.json`, "the listing index must name the published schema");
check(listingIndex.urlPattern === LISTING_URL_PATTERN, "the listing index must publish the per-listing URL pattern");
check(
  listingIndex.counts?.listings === baseVariantRecords.records.length,
  "every retained base variant record must project into exactly one listing",
);
check(listingIndex.listings?.length === listingIndex.counts.listings, "the listing index count differs from its own rows");
for (const format of ["helm", "aicr", "timoni", "kubara", "sveltos", "kubernetes-yaml", "configuration-oci", "cub-installer"]) {
  check(listingIndex.counts.formats?.[format] > 0, `the listing index must cover the ${format} format`);
}
const listedIds = new Set(listingIndex.listings.map((row) => row.id));
for (const record of baseVariantRecords.records) {
  check(listedIds.has(record.metadata.name), `${record.metadata.name}: the catalog record has no published listing`);
}

// The promise is that an agent can build one URL and read one entry, so every
// listing is opened here rather than trusted because the index mentions it.
for (const row of listingIndex.listings) {
  check(row.url === LISTING_URL_PATTERN.replace("{id}", row.id), `${row.id}: the listing URL is not the published pattern`);
  const localPath = localPathForUrl(row.url);
  check(localPath && existsSync(localPath), `${row.id}: the per-listing file is missing`);
  const listing = readJson(localPath);
  check(listing.kind === "CatalogListing", `${row.id}: the per-listing file is not a CatalogListing`);
  check(listing.listingVersion === "1", `${row.id}: the per-listing file does not pin major version 1`);
  check(listing.identity?.id === row.id && listing.identity?.url === row.url, `${row.id}: the listing disagrees with the index about its own address`);
  check(listing.identity?.format === row.format, `${row.id}: the listing and the index disagree about the source format`);
  check(listing.flattened?.digest === row.digest, `${row.id}: the listing and the index disagree about the exact object-set digest`);
  check(listing.generatedFrom?.recordKind === "BaseVariantRecord", `${row.id}: the listing must name the record it projects`);
  for (const section of LISTING_SECTIONS) check(listing[section], `${row.id}: the listing is missing the ${section} section`);
  check(listing.oci.bundles.length === 4 && listing.oci.runtimes.length === 3, `${row.id}: the listing does not declare the same OCI roles and runtimes as every other listing`);
  const coverageErrors = listingCoverageErrors(listing);
  check(coverageErrors.length === 0, `${row.id}: ${coverageErrors[0]}`);
  for (const bundle of listing.oci.bundles) {
    check(
      bundle.referenceState !== "published" || bundle.state === "published",
      `${row.id}: the ${bundle.role} bundle calls its reference published while the bundle is ${bundle.state}`,
    );
    check(
      bundle.referenceState === "none" ? bundle.reference === "" : bundle.reference !== "",
      `${row.id}: the ${bundle.role} bundle reference and its state disagree about whether an address exists`,
    );
  }
  for (const route of listing.routing.routes) {
    check(
      route.automatic === false || route.evidence.length > 0,
      `${row.id}: route ${route.id} claims it runs automatically with no evidence`,
    );
  }
}

// One listing read the way an agent would read it, including the record hash it
// claims to project and the boundary between a preview and a write.
const redisListing = readJson(join(listingRoot, "bitnami-redis-25-5-3-default.json"));
check(
  redisListing.generatedFrom.record.sha256
    === `sha256:${createHash("sha256").update(readFileSync(join(repoRoot, redisListing.generatedFrom.record.path))).digest("hex")}`,
  "a listing must carry the current hash of the record it projects",
);
check(redisListing.generatedFrom.catalog.path === "data/base-variant-records/records.json", "a listing must name the catalog index it came from");
check(listingVerdict(redisListing, "render_parity") === "checked", "checked listing coverage must remain checked for consumers");
check(listingVerdict(redisListing, "two_cluster_kind") === "unknown", "unchecked listing coverage must be unknown, never pass");
check(redisListing.variants.known.some((entry) => entry.self), "a listing must appear in its own variant set");
check(redisListing.variants.known.every((entry) => entry.url === LISTING_URL_PATTERN.replace("{id}", entry.id)), "a sibling variant must be addressed by the same URL pattern");
check(redisListing.variants.howToMakeOne.commands.some((entry) => entry.writes === false), "a listing must show a preview before any write command");
check(redisListing.variants.howToMakeOne.commands.some((entry) => entry.command.includes("--dry-run")), "the listed preview must use a dry run");
check(redisListing.assessment.stages.map((stage) => stage.id).join(",") === "inspection,materialization,destination,post-deployment", "a listing must keep the four assessment stages in order");

const forgedCoverage = structuredClone(redisListing);
forgedCoverage.lifecycle.coverage.two_cluster_kind = { status: "checked", declared: "todo" };
check(
  listingCoverageErrors(forgedCoverage).some((message) => message.includes("two_cluster_kind")),
  "self-test: a lane calling itself checked while the catalog recorded undone work must fail validation",
);
const forgedLane = structuredClone(redisListing);
delete forgedLane.lifecycle.coverage.gitops_oci_live;
check(
  listingCoverageErrors(forgedLane).some((message) => message.includes("gitops_oci_live")),
  "self-test: deleting a listing coverage lane must fail validation",
);
const forgedUndeclared = structuredClone(redisListing);
forgedUndeclared.lifecycle.coverage.live_dual_parity = { status: "not_declared", declared: "yes" };
check(
  listingCoverageErrors(forgedUndeclared).some((message) => message.includes("live_dual_parity")),
  "self-test: a lane hiding a recorded word behind not_declared must fail validation",
);

for (const term of [
  "listings/{id}.json",
  "listings/index.json",
  "listing.schema.json",
  "listingVersion pins their meanings",
  "not_declared was never declared",
  "A planned OCI reference",
]) {
  check(llms.includes(term), `site/llms.txt must publish the per-listing contract: ${term}`);
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  throw new Error(`ConfigHub Workshop machine contract has ${errors.length} error(s)`);
}

console.log(
  `verified ConfigHub Workshop machine contract for ${feed.entries.length} exact package version(s), ${aliasCount(feed)} alias(es), ${COVERAGE_FAMILIES.length} coverage families, and ${listingIndex.counts.listings} per-listing URL(s) across ${Object.keys(listingIndex.counts.formats).length} source format(s)`,
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

function listingVerdict(listing, lane) {
  return listing.lifecycle?.coverage?.[lane]?.status === "checked" ? "checked" : "unknown";
}

// A listing projects the catalog's lane words into statuses a consumer can act
// on. The projection may narrow a verdict and may never widen one, so the
// recorded word is checked against the status it produced.
function listingCoverageErrors(listing) {
  const findings = [];
  for (const lane of LISTING_COVERAGE_LANES) {
    const coverage = listing.lifecycle?.coverage?.[lane];
    if (!coverage) {
      findings.push(`missing listing coverage lane ${lane}`);
      continue;
    }
    if (!LISTING_STATUSES.has(coverage.status)) findings.push(`${lane} has invalid status ${coverage.status}`);
    if (coverage.status === "checked" && !LISTING_CHECKED_WORDS.has(coverage.declared)) {
      findings.push(`${lane} claims checked from the recorded word ${JSON.stringify(coverage.declared)}`);
    }
    if (coverage.status === "not_declared" && coverage.declared !== null) {
      findings.push(`${lane} says not_declared while recording ${JSON.stringify(coverage.declared)}`);
    }
    if (coverage.status !== "not_declared" && coverage.declared === null) {
      findings.push(`${lane} reports ${coverage.status} while recording nothing`);
    }
  }
  return findings;
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

function validateWorkshopResult(result) {
  check(result.apiVersion === "workshop.confighub.com/v1alpha2", "generated WorkshopResult must use v1alpha2");
  check(result.kind === "WorkshopResult", "generated command-contract result must be WorkshopResult");
  const identity = result.spec?.candidate?.objectSet;
  validateAssessment(result.spec?.assessment, "generated WorkshopResult");
  check(identity?.algorithm === "cub-scan-canonical-json-v1", "generated WorkshopResult must name its object-set algorithm");
  check(/^sha256:[0-9a-f]{64}$/.test(identity?.sha256 ?? ""), "generated WorkshopResult has an invalid object-set hash");
  const receipt = result.spec?.checks?.advisoryReceipts?.[0];
  check(receipt?.authority === "local-advisory", "generated WorkshopResult must keep cub check advisory");
  check(receipt?.input?.objectCount === identity.objectCount, "generated WorkshopResult receipt has a different object count");
  check(receipt?.input?.objectSetSha256 === identity.sha256, "generated WorkshopResult receipt has a different object-set hash");
  const candidateFile = result.spec.files.find((file) => file.path === result.spec.candidate.content.path);
  check(candidateFile, "generated WorkshopResult must include its candidate content");
  const digest = `sha256:${createHash("sha256").update(candidateFile.content).digest("hex")}`;
  check(digest === result.spec.candidate.content.sha256, "generated WorkshopResult candidate hash does not match its content");
  check(candidateFile.sha256 === digest, "generated WorkshopResult file record has the wrong candidate hash");
  const decisions = result.spec.findingDecisions;
  check(decisions?.candidateObjectSetSha256 === identity.sha256, "generated WorkshopResult decisions have a different object-set hash");
  check(decisions.outcomes.length === receipt.findingCount, "generated WorkshopResult must decide or mark every finding unreviewed");
  if (decisions.status === "recorded") {
    check(decisions.record?.kind === "ConfigurationDecision", "recorded finding decisions must name their source record");
    check(decisions.outcomes.every((outcome) => outcome.decision !== "unreviewed"), "recorded finding decisions must not leave scan findings unreviewed");
  } else {
    check(["not-required", "not-recorded"].includes(decisions.status), "finding-decision status changed");
    check(decisions.status !== "not-required" || decisions.outcomes.length === 0, "a result with findings cannot say decisions are not required");
    check(decisions.outcomes.every((outcome) => outcome.decision === "unreviewed"), "unrecorded findings must remain unreviewed");
  }
  check(result.spec.next.managed.includes(`workshop.confighub.com/object-set-sha256=${identity.sha256}`), "generated WorkshopResult must carry its accepted hash into the ConfigHub handoff");
}

function validateAssessment(assessment, label) {
  const expected = ["inspection", "materialization", "destination", "post-deployment"];
  const stages = assessment?.stages ?? [];
  check(
    JSON.stringify(stages.map((stage) => stage.id)) === JSON.stringify(expected),
    `${label} must keep the four assessment stages in order`,
  );
  for (const stage of stages) {
    check(stage.question && stage.answer && stage.nextAction, `${label}/${stage.id} must explain its answer and next action`);
    check(Array.isArray(stage.requiredInputs) && stage.requiredInputs.length > 0, `${label}/${stage.id} must name its required inputs`);
    check(typeof stage.destinationAccessRequired === "boolean" && typeof stage.deploymentRequired === "boolean", `${label}/${stage.id} must name its prerequisites`);
    if (stage.id === "destination") check(stage.destinationAccessRequired && !stage.deploymentRequired, `${label}/destination prerequisites changed`);
    if (stage.id === "post-deployment") check(stage.destinationAccessRequired && stage.deploymentRequired, `${label}/post-deployment prerequisites changed`);
    if (stage.evidenceState === "blocked") check(["blocked", "not-run"].includes(stage.resultState), `${label}/${stage.id} turns missing evidence into a completed result`);
  }
}

function readJson(path) {
  check(existsSync(path), `${path} is missing; run npm run site:generate`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}
