#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const dataRoot = join(repoRoot, "data", "catalog-shared-checks");
const receiptsRoot = join(dataRoot, "receipts");
const indexPath = join(dataRoot, "index.json");
const summaryPath = join(dataRoot, "summary.md");
const mappingPath = join(repoRoot, "config-catalog", "shared-control-mappings.yaml");

if (mode === "--run") {
  runScans();
} else if (mode === "--generate") {
  const report = buildReport();
  writeGenerated(report);
  console.log(`wrote shared check index for ${report.index.entries.length} exact Helm configuration(s)`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(indexPath), `${relativeRepo(indexPath)} is missing; run npm run catalog-shared-checks:generate`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run catalog-shared-checks:generate`);
  check(readFileSync(indexPath, "utf8") === report.indexJson, `${relativeRepo(indexPath)} is stale; run npm run catalog-shared-checks:generate`);
  check(readFileSync(summaryPath, "utf8") === report.summary, `${relativeRepo(summaryPath)} is stale; run npm run catalog-shared-checks:generate`);
  console.log(`verified ${report.index.entries.length} exact shared check receipt(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-catalog-shared-checks.mjs --run
  node scripts/generate-catalog-shared-checks.mjs --generate
  node scripts/generate-catalog-shared-checks.mjs --verify`);
}

function runScans() {
  const mapping = readAndValidateMapping();
  const bases = catalogBases();
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-catalog-shared-checks-"));
  try {
    bases.forEach((base, index) => {
      const outputPath = join(tempRoot, `${base.id}.json`);
      execFileSync(
        "cub",
        ["check", "--format", "json", "--output", outputPath, join(repoRoot, base.renderPath)],
        {
          cwd: repoRoot,
          encoding: "utf8",
          env: { ...process.env, CONFIGHUB_AGENT: "1" },
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 1024 * 1024 * 50,
        },
      );
      const scannerResult = JSON.parse(readFileSync(outputPath, "utf8"));
      validateScannerResult(base, scannerResult, mapping);
      const receipt = wrapReceipt(base, scannerResult);
      validateSharedReceipt(base, receipt, mapping);
      write(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
      if ((index + 1) % 25 === 0 || index + 1 === bases.length) {
        console.log(`checked ${index + 1}/${bases.length}`);
      }
    });
    rmSync(receiptsRoot, { recursive: true, force: true });
    for (const base of bases) {
      const receipt = JSON.parse(readFileSync(join(tempRoot, `${base.id}.json`), "utf8"));
      write(join(receiptsRoot, `${base.id}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
    }
    const report = buildReport();
    writeGenerated(report);
    console.log(`recorded ${bases.length} exact shared check receipt(s)`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeGenerated(report) {
  write(indexPath, report.indexJson);
  write(summaryPath, report.summary);
}

function buildReport() {
  const mapping = readAndValidateMapping();
  const bases = catalogBases();
  check(existsSync(receiptsRoot), `${relativeRepo(receiptsRoot)} is missing; run npm run catalog-shared-checks:run`);
  const actualFiles = readdirSync(receiptsRoot).filter((name) => name.endsWith(".json")).sort();
  const expectedFiles = bases.map((base) => `${base.id}.json`).sort();
  check(JSON.stringify(actualFiles) === JSON.stringify(expectedFiles), `${relativeRepo(receiptsRoot)} must contain exactly one receipt for each maintained Helm base`);

  const entries = bases.map((base) => {
    const receipt = JSON.parse(readFileSync(join(receiptsRoot, `${base.id}.json`), "utf8"));
    validateSharedReceipt(base, receipt, mapping);
    return sharedCheckEntry(base, receipt);
  });
  const scanner = scannerIdentity(entries);
  const counts = severityCounts(entries.flatMap((entry) => entry.findings));
  const controlCounts = new Map();
  for (const entry of entries) {
    for (const finding of entry.findings) {
      const current = controlCounts.get(finding.id) ?? {
        id: finding.id,
        name: finding.name,
        severity: finding.severity,
        configurationCount: 0,
        findingCount: 0,
      };
      current.findingCount += finding.count;
      current.configurationCount += 1;
      controlCounts.set(finding.id, current);
    }
  }
  const index = {
    schemaVersion: "catalog-shared-check-index-v1",
    generatedAt: entries.map((entry) => entry.scanTime).sort().at(-1),
    scope: "Exact rendered Kubernetes objects for every maintained Helm base revision under recipes/.",
    authority: "advisory-local-check",
    scanner,
    summary: {
      configurations: entries.length,
      configurationsWithFindings: entries.filter((entry) => entry.findingCount > 0).length,
      configurationsWithoutFindings: entries.filter((entry) => entry.findingCount === 0).length,
      findings: entries.reduce((sum, entry) => sum + entry.findingCount, 0),
      severityCounts: counts,
      distinctControls: controlCounts.size,
    },
    controlCounts: [...controlCounts.values()].sort((left, right) => right.findingCount - left.findingCount || left.id.localeCompare(right.id)),
    mappings: mapping.spec.mappings,
    intentionallyUnmapped: mapping.spec.intentionallyUnmapped,
    entries,
  };
  const indexJson = `${JSON.stringify(index, null, 2)}\n`;
  return { index, indexJson, summary: summaryMarkdown(index) };
}

function catalogBases() {
  const pattern = /^recipes\/([^/]+)\/([^/]+)\/([^/]+)\/revisions\/([^/]+)\/r001\/rendered\/release-objects\.yaml$/;
  const bases = listFiles(join(repoRoot, "recipes"))
    .map((path) => relative(repoRoot, path).replaceAll("\\", "/"))
    .filter((path) => pattern.test(path))
    .map((renderPath) => {
      const match = renderPath.match(pattern);
      const [, repository, chartName, version, base] = match;
      const chart = `${repository}/${chartName}`;
      const revisionRoot = renderPath.replace(/\/rendered\/release-objects\.yaml$/, "");
      return {
        id: slug(`${chart}-${version}-${base}`),
        chart,
        version,
        base,
        renderPath,
        variantRevisionPath: `${revisionRoot}/variant-revision.yaml`,
        catalogReceiptPath: `${revisionRoot}/receipts/scan-receipt.yaml`,
        sharedReceiptPath: `data/catalog-shared-checks/receipts/${slug(`${chart}-${version}-${base}`)}.json`,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  check(bases.length > 0, "no maintained Helm base renders found under recipes/");
  check(new Set(bases.map((base) => base.id)).size === bases.length, "shared check receipt IDs must be unique");
  return bases;
}

function readAndValidateMapping() {
  check(existsSync(mappingPath), `${relativeRepo(mappingPath)} is missing`);
  const mapping = readYaml(mappingPath);
  check(mapping?.apiVersion === "catalog.confighub.com/v1alpha1", "shared control mapping apiVersion changed");
  check(mapping?.kind === "SharedControlMappings", "shared control mapping kind changed");
  const scanner = mapping.spec?.sharedScanner ?? {};
  check(scanner.command === "cub check", "shared scanner command must remain cub check");
  check(scanner.surface === "cub-scan", "shared scanner surface must remain cub-scan");
  check(/^v\d+\.\d+\.\d+$/.test(scanner.version ?? ""), "shared scanner version must be pinned");
  check(/^[a-f0-9]{64}$/.test(scanner.bundleManifestSHA256 ?? ""), "shared bundle manifest SHA-256 must be complete");
  check(/^[a-f0-9]{64}$/.test(scanner.catalogSHA256 ?? ""), "shared catalog SHA-256 must be complete");

  const currentRules = catalogRuleNames();
  const mappedRules = (mapping.spec?.mappings ?? []).flatMap((item) => item.catalogRules ?? []);
  const unmappedRules = (mapping.spec?.intentionallyUnmapped ?? []).flatMap((item) => item.catalogRules ?? []);
  const declaredRules = [...mappedRules, ...unmappedRules];
  check(new Set(declaredRules).size === declaredRules.length, "each Catalog scanner rule must appear once in the shared-control mapping");
  check(JSON.stringify([...new Set(declaredRules)].sort()) === JSON.stringify(currentRules), "shared-control mapping must classify every current Catalog scanner rule");
  for (const item of mapping.spec?.mappings ?? []) {
    check(item.relationship === "partial", `mapping for ${(item.catalogRules ?? []).join(", ")} must not claim unsupported equivalence`);
    check((item.sharedControlIds ?? []).length > 0, `mapping for ${(item.catalogRules ?? []).join(", ")} has no shared control IDs`);
    check((item.sharedControlIds ?? []).every((id) => /^CCVE-\d{4}-\d{4}$/.test(id)), `mapping for ${(item.catalogRules ?? []).join(", ")} has an invalid control ID`);
    check(String(item.explanation ?? "").length > 20, `mapping for ${(item.catalogRules ?? []).join(", ")} needs an explanation`);
  }
  return mapping;
}

function catalogRuleNames() {
  const rules = new Set();
  for (const base of catalogBases()) {
    check(existsSync(join(repoRoot, base.catalogReceiptPath)), `${base.catalogReceiptPath} is missing`);
    const receipt = readYaml(join(repoRoot, base.catalogReceiptPath));
    for (const finding of receipt.spec?.findings ?? []) rules.add(finding.rule);
  }
  return [...rules].sort();
}

function validateSharedReceipt(base, receipt, mapping) {
  check(receipt.schemaVersion === "catalog-shared-check-receipt-v1", `${base.id}: shared receipt wrapper schema changed`);
  check(receipt.subject?.id === base.id, `${base.id}: shared receipt subject ID changed`);
  check(receipt.subject?.chart === base.chart, `${base.id}: shared receipt chart changed`);
  check(receipt.subject?.version === base.version, `${base.id}: shared receipt version changed`);
  check(receipt.subject?.base === base.base, `${base.id}: shared receipt base changed`);
  check(receipt.subject?.renderPath === base.renderPath, `${base.id}: shared receipt render path changed`);
  check(receipt.subject?.renderFileSHA256 === `sha256:${sha256File(join(repoRoot, base.renderPath))}`, `${base.id}: shared receipt file digest does not match the exact render`);
  check(receipt.catalogReview?.path === base.catalogReceiptPath, `${base.id}: shared receipt Catalog review path changed`);
  validateScannerResult(base, receipt.scannerResult, mapping);
}

function validateScannerResult(base, receipt, mapping) {
  const expected = mapping.spec.sharedScanner;
  check(receipt.schema_version === "risk-scan-findings-v1", `${base.id}: shared receipt schema changed`);
  check(receipt.surface === expected.surface, `${base.id}: shared receipt surface changed`);
  check(receipt.provenance?.source === expected.surface, `${base.id}: shared receipt source changed`);
  check(receipt.provenance?.source_version === expected.version, `${base.id}: shared receipt scanner version changed`);
  check(!Number.isNaN(Date.parse(receipt.provenance?.scan_time)), `${base.id}: shared receipt scan time is invalid`);
  check(receipt.pattern_bundle?.version === expected.version, `${base.id}: shared receipt bundle version changed`);
  check(receipt.pattern_bundle?.source_repo === expected.sourceRepo, `${base.id}: shared receipt source repository changed`);
  check(receipt.pattern_bundle?.manifest_sha256 === expected.bundleManifestSHA256, `${base.id}: shared receipt bundle manifest changed`);
  check(receipt.pattern_bundle?.catalog_sha256 === expected.catalogSHA256, `${base.id}: shared receipt catalog changed`);
  check(Array.isArray(receipt.findings), `${base.id}: shared receipt findings are missing`);
  check(receipt.finding_count === receipt.findings.length, `${base.id}: shared receipt finding count does not match`);
  check(receipt.findings.every((finding) => /^CCVE-\d{4}-\d{4}$/.test(finding.id ?? "")), `${base.id}: shared receipt has an invalid control ID`);
  check(receipt.findings.every((finding) => ["critical", "warning", "info"].includes(finding.severity)), `${base.id}: shared receipt has an unsupported severity`);

  check(Number.isInteger(receipt.input?.object_count) && receipt.input.object_count > 0, `${base.id}: shared receipt object count is invalid`);
  check(/^sha256:[a-f0-9]{64}$/.test(receipt.input?.object_set_sha256 ?? ""), `${base.id}: shared receipt object digest is invalid`);
  const receiptText = JSON.stringify(receipt);
  check(!receiptText.includes("/Users/") && !receiptText.includes("file://"), `${base.id}: shared receipt contains a local path`);

  const catalogReceipt = readYaml(join(repoRoot, base.catalogReceiptPath));
  if (catalogReceipt.spec?.scanner) {
    check(catalogReceipt.spec.scanner.name === mapping.spec.catalogScanner.name, `${base.id}: existing Catalog receipt was relabeled`);
    check(mapping.spec.catalogScanner.versions.includes(catalogReceipt.spec.scanner.version), `${base.id}: existing Catalog scanner version changed`);
  }
  check(catalogReceipt.spec?.renderedObjectSetSHA256 === sha256File(join(repoRoot, base.renderPath)), `${base.id}: existing Catalog receipt no longer matches the render file`);
}

function wrapReceipt(base, scannerResult) {
  return {
    schemaVersion: "catalog-shared-check-receipt-v1",
    subject: {
      id: base.id,
      chart: base.chart,
      version: base.version,
      base: base.base,
      renderPath: base.renderPath,
      renderFileSHA256: `sha256:${sha256File(join(repoRoot, base.renderPath))}`,
    },
    catalogReview: {
      path: base.catalogReceiptPath,
      note: "Separate chart-specific Catalog review; not a cub check result.",
    },
    scannerResult,
  };
}

function sharedCheckEntry(base, receipt) {
  const scannerResult = receipt.scannerResult;
  const grouped = new Map();
  for (const finding of scannerResult.findings) {
    const current = grouped.get(finding.id) ?? {
      id: finding.id,
      name: displayFindingName(finding),
      severity: finding.severity,
      count: 0,
    };
    current.count += 1;
    grouped.set(finding.id, current);
  }
  return {
    id: base.id,
    chart: base.chart,
    version: base.version,
    base: base.base,
    outcome: scannerResult.finding_count > 0 ? "findings" : "no-findings",
    findingCount: scannerResult.finding_count,
    severityCounts: severityCounts(scannerResult.findings),
    findings: [...grouped.values()].sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || right.count - left.count || left.id.localeCompare(right.id)),
    objectCount: scannerResult.input.object_count,
    objectSetSHA256: scannerResult.input.object_set_sha256,
    renderFileSHA256: receipt.subject.renderFileSHA256,
    scanTime: scannerResult.provenance.scan_time,
    renderPath: base.renderPath,
    catalogReceiptPath: base.catalogReceiptPath,
    sharedReceiptPath: base.sharedReceiptPath,
  };
}

function scannerIdentity(entries) {
  const firstReceipt = JSON.parse(readFileSync(join(repoRoot, entries[0].sharedReceiptPath), "utf8")).scannerResult;
  return {
    command: "cub check",
    surface: firstReceipt.surface,
    version: firstReceipt.provenance.source_version,
    sourceRepo: firstReceipt.pattern_bundle.source_repo,
    bundleVersion: firstReceipt.pattern_bundle.version,
    bundleManifestSHA256: firstReceipt.pattern_bundle.manifest_sha256,
    catalogSHA256: firstReceipt.pattern_bundle.catalog_sha256,
  };
}

function severityCounts(findings) {
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += finding.count ?? 1;
  return counts;
}

function severityRank(severity) {
  return { critical: 3, warning: 2, info: 1 }[severity] ?? 0;
}

function displayFindingName(finding) {
  if (finding.name && finding.name !== finding.id) return finding.name;
  return String(finding.message ?? finding.id).replace(/;.*$/, "");
}

function summaryMarkdown(index) {
  const rows = index.entries.map((entry) => {
    const result = entry.findingCount === 0
      ? "No finding from this ruleset"
      : `${entry.findingCount} finding${entry.findingCount === 1 ? "" : "s"} (${severityText(entry.severityCounts)})`;
    return `| \`${entry.chart}\` | \`${entry.version}\` | \`${entry.base}\` | ${result} | [result](./receipts/${basename(entry.sharedReceiptPath)}) | [objects](../../${entry.renderPath}) | [Catalog review](../../${entry.catalogReceiptPath}) |`;
  });
  const mappingRows = index.mappings.map((item) => `| ${item.catalogRules.map((rule) => `\`${rule}\``).join("<br>")} | ${item.relationship} | ${item.sharedControlIds.map((id) => `\`${id}\``).join("<br>")} | ${item.explanation} |`);
  const unmappedRows = index.intentionallyUnmapped.map((item) => `| ${item.catalogRules.map((rule) => `\`${rule}\``).join("<br>")} | ${item.reason} |`);
  return `# Shared Local Configuration Checks

This directory contains the released \`cub check\` result for every exact maintained Helm base in \`recipes/\`. The check runs locally and needs no ConfigHub account or server. Each result is bound to the rendered Kubernetes object set, scanner version, pattern-bundle hashes, and scan time.

These results are advisory. They do not prove that hooks ran, CRDs are ready, a target supplies the required Secrets or cloud services, admission will accept the objects, or the workload is healthy. ConfigHub validation and approval are separate managed controls.

The older per-revision \`scan-receipt.yaml\` files remain the chart-specific Catalog review. Where that scanner ran, the receipt names \`helm-expt-local-rendered-object-scan\` and its version. Some older receipts explicitly record that the check did not run. Those reviews also cover chart inputs and operating decisions that a shared rendered-object scanner cannot see.

## Coverage

- Exact Helm configurations checked: **${index.summary.configurations}**
- Configurations with advisory findings: **${index.summary.configurationsWithFindings}**
- Configurations with no finding from this ruleset: **${index.summary.configurationsWithoutFindings}**
- Findings: **${index.summary.findings}** (${severityText(index.summary.severityCounts)})
- Stable controls reported: **${index.summary.distinctControls}**
- Scanner: **${index.scanner.command} ${index.scanner.version}**
- Bundle manifest: \`sha256:${index.scanner.bundleManifestSHA256}\`
- Risk catalog: \`sha256:${index.scanner.catalogSHA256}\`

"No finding" means only that this scanner and bundle reported none for the exact objects. It is not a deployment or production-readiness verdict.

## Relationship To The Catalog Review

The mappings below are deliberately partial. A shared field check can support a chart-specific review, but it does not replace source, lifecycle, target, or live evidence.

| Catalog rule | Relationship | Shared controls | What overlaps |
| --- | --- | --- | --- |
${mappingRows.join("\n")}

### Catalog rules without a shared static equivalent

| Catalog rules | Why they remain separate |
| --- | --- |
${unmappedRows.join("\n")}

## Exact Results

| Chart | Version | Configuration | Advisory result | Shared result | Exact objects | Catalog review |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Commands

Refresh the committed results only when the released scanner or exact rendered objects change:

\`\`\`bash
npm run catalog-shared-checks:run
\`\`\`

Regenerate the deterministic index and summary without rerunning the scanner:

\`\`\`bash
npm run catalog-shared-checks:generate
\`\`\`

Verify every receipt against the exact objects, scanner identity, bundle identity, mapping contract, and generated index:

\`\`\`bash
npm run catalog-shared-checks:verify
\`\`\`
`;
}

function severityText(counts) {
  return [`${counts.critical} critical`, `${counts.warning} warning`, `${counts.info} info`].join(", ");
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
