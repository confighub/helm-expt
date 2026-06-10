#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "quirk-coverage");
const outputs = {
  csv: join(outputRoot, "coverage.csv"),
  summary: join(outputRoot, "summary.md"),
};

if (mode === "--generate") {
  mkdirSync(outputRoot, { recursive: true });
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log("wrote quirk coverage -> data/quirk-coverage/");
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${path} is missing; run npm run quirk-coverage`);
    check(readFileSync(path, "utf8") === report[name], `${path} is stale; run npm run quirk-coverage`);
  }
  console.log(`verified quirk coverage for ${report.rows.length} axis row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-quirk-coverage.mjs --generate
  node scripts/generate-quirk-coverage.mjs --verify`);
}

function buildReport() {
  const top100 = parseCsvFile("data/top100-catalog-analysis/review.csv");
  const chartFacts = parseCsvFile("data/chart-facts/chart-facts.csv");
  const sourceTop100HookRows = parseCsvFile("data/hook-lifecycle/source-top100-hooks.csv");
  const rawTop500 = loadRawTop500();
  const top100Refs = new Set(top100.map((row) => normRef(row.chart)));
  const top20Refs = new Set(top100.filter((row) => row.proof_surface === "top20-catalog-supported").map((row) => normRef(row.chart)));
  const sourceRankTop100 = rawTop500.filter((row) => row.scanStatus === "scanned" && Number(row.rank) <= 100);
  const deps = dependencyFacts();
  const receipts = renderReceiptFacts();
  const explicitExtensionSlots = {
    top20: chartFactCountForRefs(chartFacts, "extension_slots", top20Refs),
    top100: chartFactCountForRefs(chartFacts, "extension_slots", top100Refs),
    sourceTop100RawExtra: sourceFieldCount(sourceRankTop100, "extraManifestValues"),
    sourceTop500RawExtra: sourceFieldCount(rawTop500, "extraManifestValues"),
    matchedTop500ProofRows: top500ProofExtensionSlotCount(),
    sourceTpl: sourceFieldCount(rawTop500, "tpl"),
  };

  const rows = [
    axis("lookup-target-facts", "tracked-and-surfaced", sourceFieldCount(sourceRankTop100, "lookup"), sourceFeatureCount(top100, "lookup"), sourceFieldCount(rawTop500, "lookup"), "data/top100-catalog-analysis/review.csv;recipes/*/*/*/control-points.yaml", "lookup is surfaced as a control point and routed to target facts or explicit variant policy.", "Target-fact enforcement is stronger for selected charts than for every top-100 source row.", "Promote target-fact requirements into installer-native preflight where the package model supports it."),
    axis("generated-facts", "tracked-and-surfaced", sourceGeneratedCount(sourceRankTop100), sourceFeatureCount(top100, "generated-facts"), sourceGeneratedCount(rawTop500), "recipes/*/*/*/generated-facts.yaml;recipes/*/*/*/helm-pain-report.yaml", "Generated passwords/certs/random values are disclosed and routed to generated-fact policy or existing-secret variants.", "Not every generated-fact path has field-level reachability yet.", "Extend value-source-map and edge recovery beyond Redis."),
    axis("capability-profile", "partly-tracked", sourceFieldCountAny(sourceRankTop100, ["capabilitiesKubeVersion", "capabilitiesAPIs"]), sourceFeatureCount(top100, "capabilities"), sourceFieldCountAny(rawTop500, ["capabilitiesKubeVersion", "capabilitiesAPIs"]), "data/capability-profiles/catalog.yaml;render receipts", "Render receipts bind kubeVersion, Helm version, and render flags where the newer receipt contract is present.", `${receipts.withRendererProfile}/${receipts.total} render receipts declare renderer flags and kubeVersion.`, "Backfill or classify older receipts that lack the full renderer profile."),
    axis("helm-flag-profile", "partly-tracked", "n/a", receipts.withFlagProfile, "n/a", "recipes/*/*/*/revisions/*/r001/receipts/render-receipt.yaml", "Render receipts declare the Helm flag profile where the newer receipt contract is present.", `${receipts.withFlagProfile}/${receipts.total} render receipts include the expected flag profile.`, "Fail package verification if a supported receipt lacks a complete flag profile, after legacy receipts are backfilled or classified."),
    axis("hook-phase", "partly-tracked", sourceTop100HookRows.length, 5, sourceFieldCount(rawTop500, "hooks"), "data/hook-lifecycle/source-top100-hooks.csv;data/hook-lifecycle/maintained-hook-queue.csv;data/hook-lifecycle/summary.md", "Hook-bearing top-100 source rows are inventoried, and maintained hook rows are queued for lifecycle route and receipt work.", "Hook presence and phase are tracked, but lifecycle receipts are not complete.", "Choose routes for hook-bearing charts and commit lifecycle or observation receipts."),
    axis("hook-delete-policy", "source-scanned-not-surfaced", sourceFieldCount(sourceRankTop100, "hookDeletePolicies"), 0, sourceFieldCount(rawTop500, "hookDeletePolicies"), "data/top500-catalog-analysis/source/source-feature-scan.raw.json", "The source scanner records hook delete policies, but chart facts do not yet promote them as an axis.", "Delete policy can change cleanup, rerun, and rollback behavior.", "Promote hook delete policy into chart facts and hook lifecycle queue rows."),
    axis("hook-weight-ordering", "source-scanned-not-surfaced", sourceFieldCount(sourceRankTop100, "hookWeights"), 0, sourceFieldCount(rawTop500, "hookWeights"), "data/top500-catalog-analysis/source/source-feature-scan.raw.json", "The source scanner records hook weights, but chart facts do not yet promote them as an axis.", "Weight ordering affects lifecycle sequencing and may not map cleanly to GitOps.", "Promote hook weights into hook lifecycle route planning."),
    axis("crds", "tracked-and-surfaced", sourceFieldCount(sourceRankTop100, "crdFiles"), chartFactCount(chartFacts, "crds"), sourceFieldCount(rawTop500, "crdFiles"), "data/chart-facts/chart-facts.csv;data/outcome-coverage/feature-outcomes.csv", "CRDs and no-crds variants are visible in chart facts, outcomes, and per-chart pain reports.", "CRD upgrade safety remains operator-reviewed.", "Keep CRD install and CRD upgrade as separate lifecycle paths."),
    axis("crd-upgrade-behavior", "disclosed-not-complete", sourceFieldCount(sourceRankTop100, "crdFiles"), chartFactCount(chartFacts, "crds"), sourceFieldCount(rawTop500, "crdFiles"), "data/hook-lifecycle/summary.md;recipes/*/*/*/helm-pain-report.yaml", "CRD presence is tracked, and production support remains gated where upgrade behavior needs review.", "Schema conversion and multi-version upgrade behavior are not fully modeled.", "Add CRD conversion webhook detection and upgrade receipts for supported CRD charts."),
    axis("install-vs-upgrade", "tracked-and-surfaced", sourceFieldCount(sourceRankTop100, "releaseModeBranching"), chartFactCount(chartFacts, "install_vs_upgrade"), sourceFieldCount(rawTop500, "releaseModeBranching"), "data/chart-facts/chart-facts.csv", "Install-vs-upgrade branching is surfaced as a chart fact.", "It is not yet tied to upgrade-simulation receipts for every affected chart.", "Add variant-path rows for install and upgrade mode where source branching exists."),
    axis("dependency-lock", "tracked-and-surfaced", "n/a", deps.locks, "n/a", "recipes/*/*/*/dependency-lock.yaml", "Every maintained recipe has a dependency lock.", `${deps.locks} dependency locks found.`, "Keep dependency locks part of package proof verification."),
    axis("library-chart", "tracked-by-lock-not-front-door", "n/a", deps.library, "n/a", "recipes/*/*/*/dependency-lock.yaml", "Library chart dependencies are recorded in dependency locks.", "Library chart presence is not yet a chart-facts column.", "Promote library chart count into chart facts and catalog analysis."),
    axis("dependency-alias", "tracked-by-lock-not-front-door", "n/a", deps.alias, "n/a", "recipes/*/*/*/dependency-lock.yaml", "Dependency aliases can be read from dependency locks, but are not yet a front-door chart-facts axis.", "Alias-driven subchart identity can obscure where objects come from.", "Promote dependency aliases into chart facts and catalog analysis."),
    axis("import-values", "not-scanned", "unknown", deps.importValues, "unknown", "recipes/*/*/*/dependency-lock.yaml", "Dependency import-values is not a first-class scanner axis today.", "Imported subchart values can create hidden high-density value paths.", "Teach the dependency scanner to surface import-values and link them to value-source maps."),
    axis("required-or-fail", "tracked-and-surfaced", sourceFieldCount(sourceRankTop100, "requiredOrFail"), chartFactCount(chartFacts, "required_values"), sourceFieldCount(rawTop500, "requiredOrFail"), "data/chart-facts/chart-facts.csv", "Helm required/fail checks are surfaced as mandatory input risk.", "Not every required value has a typed user prompt.", "Use values schema or explicit placeholder units for required inputs."),
    axis("values-schema", "tracked-and-surfaced", sourceFieldCount(sourceRankTop100, "valuesSchema"), chartFactCount(chartFacts, "values_schema"), sourceFieldCount(rawTop500, "valuesSchema"), "data/chart-facts/chart-facts.csv", "values.schema.json is surfaced as an input contract.", "Schemas are not yet centralized in a ConfigHub schema registry.", "Keep schema references with recipe/package artifacts and map to ConfigHub schema registry later."),
    axis("tpl-extension-slots", "tracked-and-surfaced", sourceFieldCount(sourceRankTop100, "tpl"), chartFactCount(chartFacts, "extension_slots"), sourceFieldCount(rawTop500, "tpl"), "data/chart-facts/chart-facts.csv;recipes/*/*/*/helm-pain-report.yaml", "tpl and extension slots are disclosed and reviewed per chart.", "Per-field provenance for arbitrary tpl content is not complete.", "Keep unsupported or unbounded tpl paths as explicit extension-slot decisions."),
    axis("explicit-extension-slot-control-points", "tracked-and-surfaced", explicitExtensionSlots.sourceTop100RawExtra, explicitExtensionSlots.top100, explicitExtensionSlots.sourceTop500RawExtra, "data/chart-facts/chart-facts.csv;recipes/*/*/*/control-points.yaml;recipes/*/*/*/helm-pain-report.yaml", `NGINX-like extension surfaces are promoted into per-chart control points or pain reports when recipes exist; ${explicitExtensionSlots.matchedTop500ProofRows} matched proof rows currently have explicit extension slots.`, "The broader source scan sees more raw/extra manifest values than the current modeled chart-facts surface.", "Keep extension slots explicit in chart facts, recipe control points, scan/gate findings, and user-facing variant decisions."),
    axis("semver-compare", "source-scanned-not-surfaced", sourceFieldCount(sourceRankTop100, "semverCompare"), 0, sourceFieldCount(rawTop500, "semverCompare"), "data/top500-catalog-analysis/source/source-feature-scan.raw.json", "The source scanner records semverCompare use.", "It is not yet promoted to chart facts or variant-path coverage.", "Promote semverCompare into chart facts and link it to source/version refresh review."),
    axis("files-get", "source-scanned-not-surfaced", sourceFieldCount(sourceRankTop100, "filesGet"), 0, sourceFieldCount(rawTop500, "filesGet"), "data/top500-catalog-analysis/source/source-feature-scan.raw.json", "The source scanner records .Files.Get usage.", "Bundled-file content can affect rendered config without appearing in values.", "Promote .Files.Get into chart facts and source-lock evidence."),
    axis("time-uuid-functions", "source-scanned-not-surfaced", sourceFieldCount(sourceRankTop100, "timeUuidFuncs"), 0, sourceFieldCount(rawTop500, "timeUuidFuncs"), "data/top500-catalog-analysis/source/source-feature-scan.raw.json", "The source scanner records time and UUID functions.", "These are distinct from secret generation and should be a separate nondeterminism axis.", "Promote time/UUID functions into chart facts and generated-fact policy."),
    axis("getHostByName", "not-scanned", "unknown", "unknown", "unknown", "docs/reference/quirk-coverage.md", "This Helm function is not currently detected as its own axis.", "DNS lookups during template render would make render depend on the network environment.", "Add scanner detection and reject or require a captured fact binding."),
    axis("resource-policy-keep", "not-scanned", "unknown", "unknown", "unknown", "docs/reference/quirk-coverage.md", "helm.sh/resource-policy: keep is not currently detected as its own axis.", "Uninstall and prune behavior may leave intentional orphans.", "Add rendered-object scan for resource-policy keep and route to lifecycle policy."),
    axis("post-renderer", "not-scanned", "unknown", "unknown", "unknown", "docs/reference/customization-algorithm.md", "Post-renderers are handled by doctrine as explicit recipe stages or rejected, but not scanned from chart source.", "Final applied objects can differ from helm template output.", "Represent post-renderers as pinned recipe/function stages or mark unsupported."),
    axis("helm-version-branching", "not-scanned", "unknown", "unknown", "unknown", "docs/reference/quirk-coverage.md", ".Capabilities.HelmVersion branching is not currently detected.", "Render output could vary by Helm binary version.", "Add scanner detection and bind Helm version into receipts."),
    axis("global-values", "not-scanned", "unknown", "unknown", "unknown", "docs/reference/quirk-coverage.md", "global.* propagation is not currently surfaced as a high-density value axis.", "One value can affect many subcharts and objects.", "Add value-source-map support for global values and subchart import paths."),
  ];

  return {
    rows,
    csv: toCsv(rows),
    summary: summary(rows, explicitExtensionSlots),
  };
}

function axis(axisName, coverageTier, sourceTop100Count, modeledOrSupportedCount, sourceTop500Count, evidence, currentTreatment, remainingGap, nextAction) {
  return {
    axis: axisName,
    coverage_tier: coverageTier,
    source_top100_count: String(sourceTop100Count),
    modeled_or_supported_count: String(modeledOrSupportedCount),
    source_top500_count: String(sourceTop500Count),
    primary_evidence: evidence,
    current_treatment: currentTreatment,
    remaining_gap: remainingGap,
    next_action: nextAction,
  };
}

function summary(rows, explicitExtensionSlots) {
  const counts = countBy(rows, (row) => row.coverage_tier);
  const byTier = [...counts.entries()].map(([tier, count]) => `| \`${tier}\` | ${count} | ${tierMeaning(tier)} |`).join("\n");
  const table = rows.map((row) => `| \`${row.axis}\` | \`${row.coverage_tier}\` | ${row.source_top100_count} | ${row.modeled_or_supported_count} | ${row.source_top500_count} | ${escapePipes(row.remaining_gap)} |`).join("\n");
  return `# Quirk Coverage

This generated audit says which Helm quirks are tracked, partly tracked,
source-scanned only, or not scanned. It is a coverage map, not a support claim.

## Summary

| Coverage tier | Axes | Meaning |
| --- | ---: | --- |
${byTier}

## High-Value Counts

The NGINX chart exposes concrete extension slots such as \`serverBlock\`,
\`streamServerBlock\`, and \`extraDeploy\`. The broader catalog has many similar
surfaces: raw manifests, sidecars, extra config blocks, templated snippets, and
add-on slots.

~~~text
explicit extension-slot control points in top-20 catalog: ${explicitExtensionSlots.top20}/20
extension slots surfaced in current top-100 chart facts: ${explicitExtensionSlots.top100}/100
matched top-500 proof rows with extension slots: ${explicitExtensionSlots.matchedTop500ProofRows}
top-500 source rows using tpl: ${explicitExtensionSlots.sourceTpl}/500
~~~

## Count Contract

The count columns intentionally separate source inventory from modeled support:

| Column | Meaning |
| --- | --- |
| \`source_top100_count\` | Public top-100 source-scan rows where this quirk was detected. |
| \`modeled_or_supported_count\` | Current chart facts, recipe artifacts, receipts, or maintained queues that model the quirk. The basis depends on the axis and is described in \`current_treatment\`. |
| \`source_top500_count\` | Public top-500 source-scan rows where this quirk was detected. |

Do not treat \`modeled_or_supported_count\` as a source count. Do not treat
\`source_top100_count\` as a support claim.

## Axes

| Axis | Coverage tier | Source top-100 | Modeled or supported | Source top-500 | Remaining gap |
| --- | --- | ---: | ---: | ---: | --- |
${table}

## How To Use This

- Use \`tracked-and-surfaced\` axes in user-facing chart status and pain reports.
- Treat \`partly-tracked\` axes as visible, but not complete enough for a broad
  production claim.
- Treat \`source-scanned-not-surfaced\` axes as cheap next candidates for
  \`chart-facts.csv\` or variant-path coverage.
- Treat \`not-scanned\` axes as known blind spots. A chart may still be usable,
  but the project should not imply that this behavior was checked.

## Files

| File | Purpose |
| --- | --- |
| \`data/quirk-coverage/coverage.csv\` | One row per quirk axis and current coverage tier. |
| \`docs/reference/quirk-coverage.md\` | Reader-facing reference for this taxonomy. |
| \`data/chart-facts/chart-facts.csv\` | Per-chart surfaced feature facts. |
| \`data/top500-catalog-analysis/source/source-feature-scan.raw.json\` | Source scan backing the source-scanned axes. |

Regenerate:

~~~sh
npm run quirk-coverage
npm run quirk-coverage:verify
~~~
`;
}

function tierMeaning(tier) {
  const meanings = {
    "tracked-and-surfaced": "Shown in generated chart/user data and tied to recipe or receipt evidence.",
    "tracked-by-lock-not-front-door": "Recorded in locks or artifacts but not yet promoted to front-door tables.",
    "partly-tracked": "Visible, but missing one or more lifecycle or per-chart proof pieces.",
    "disclosed-not-complete": "Disclosed and gated, but not yet fully modeled or live-proven.",
    "source-scanned-not-surfaced": "Detected in source scan but not yet promoted to chart facts or outcome tables.",
    "not-scanned": "Known blind spot in the current scanner/data model.",
  };
  return meanings[tier] ?? "";
}

function loadRawTop500() {
  const raw = JSON.parse(readFileSync(join(repoRoot, "data", "top500-catalog-analysis", "source", "source-feature-scan.raw.json"), "utf8"));
  return Array.isArray(raw) ? raw : raw.rows ?? raw.charts ?? Object.values(raw);
}

function dependencyFacts() {
  const locks = listFiles(join(repoRoot, "recipes")).filter((file) => file.endsWith("/dependency-lock.yaml"));
  let dependencyCount = 0;
  let library = 0;
  let alias = 0;
  let importValues = 0;
  for (const file of locks) {
    const data = readYaml(file);
    for (const dep of data.spec?.dependencies ?? []) {
      dependencyCount += 1;
      if (dep.type === "library") library += 1;
      if (dep.alias) alias += 1;
      if (dep.importValues || dep["import-values"]) importValues += 1;
    }
  }
  return { locks: locks.length, dependencyCount, library, alias, importValues };
}

function renderReceiptFacts() {
  const receipts = listFiles(join(repoRoot, "recipes")).filter((file) => /\/revisions\/[^/]+\/r001\/receipts\/render-receipt\.yaml$/.test(file));
  let withRendererProfile = 0;
  let withFlagProfile = 0;
  for (const file of receipts) {
    const data = readYaml(file);
    const renderer = data.spec?.renderer ?? {};
    const flags = renderer.flags ?? [];
    if (renderer.name && renderer.version && renderer.kubeVersion && Array.isArray(flags)) withRendererProfile += 1;
    if (["--include-crds", "--skip-tests", "--no-hooks"].every((flag) => flags.includes(flag))) withFlagProfile += 1;
  }
  return { total: receipts.length, withRendererProfile, withFlagProfile };
}

function sourceFeatureCount(rows, feature) {
  return rows.filter((row) => String(row.source_features ?? "").split(";").includes(feature)).length;
}

function sourceGeneratedCount(rows) {
  return rows.filter((row) => ["randFuncs", "certFuncs", "hashPasswordFuncs", "timeUuidFuncs"].some((field) => fieldCount(row[field]) > 0)).length;
}

function sourceFieldCount(rows, field) {
  return rows.filter((row) => fieldCount(row[field]) > 0).length;
}

function sourceFieldCountAny(rows, fields) {
  return rows.filter((row) => fields.some((field) => fieldCount(row[field]) > 0)).length;
}

function fieldCount(value) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") return Number(value.count ?? 0);
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chartFactCount(rows, field) {
  return rows.filter((row) => truthyFact(row[field])).length;
}

function chartFactCountForRefs(rows, field, refs) {
  return rows.filter((row) => refs.has(normRef(row.chart)) && truthyFact(row[field])).length;
}

function top500ProofExtensionSlotCount() {
  const path = join(repoRoot, "data", "top500-catalog-analysis", "drilldown.csv");
  if (!existsSync(path)) return 0;
  return parseCsv(readFileSync(path, "utf8")).filter((row) => row.proof_has_extension_slots === "true").length;
}

function truthyFact(value) {
  const text = String(value ?? "").trim();
  return Boolean(text && text !== "-" && text !== "—" && !text.startsWith("n/a"));
}

function normRef(value) {
  const noVersion = String(value ?? "").split("@")[0];
  const parts = noVersion.split("/");
  return parts.length >= 2 ? parts.slice(0, 2).join("/") : noVersion;
}

function countBy(rows, keyFn) {
  const result = new Map();
  for (const row of rows) result.set(keyFn(row), (result.get(keyFn(row)) ?? 0) + 1);
  return new Map([...result.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function parseCsv(text) {
  const lines = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      lines.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    lines.push(row);
  }
  const [headers, ...records] = lines.filter((line) => line.some((item) => item !== ""));
  if (!headers) return [];
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = ascii(value === undefined || value === null ? "" : String(value));
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function ascii(text) {
  return String(text)
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2026", "...");
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|");
}
