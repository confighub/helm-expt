import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "production-disposition");
const reviewCsvPath = join(outputRoot, "top20.csv");
const summaryPath = join(outputRoot, "summary.md");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const report = buildReport();
  writeReport(report);
  console.log(`wrote ${relativeRepo(reviewCsvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(reviewCsvPath), "missing production disposition CSV; run npm run production:disposition");
  check(existsSync(summaryPath), "missing production disposition summary; run npm run production:disposition");
  check(readFileSync(reviewCsvPath, "utf8") === report.csv, "production disposition CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "production disposition summary is stale");
  console.log("verified production disposition lane outputs");
} else {
  console.log(`Usage:
  node scripts/generate-production-disposition-lane.mjs --generate
  node scripts/generate-production-disposition-lane.mjs --verify`);
}

function buildReport() {
  const configHubProof = configHubProofIndex();
  const liveE2E = liveE2EIndex();
  const rows = recipeRoots()
    .map((root) => productionRow(root, configHubProof, liveE2E))
    .filter(Boolean)
    .sort((left, right) => left.chart.localeCompare(right.chart));
  check(rows.length === 20, `expected 20 catalog-supported rows, found ${rows.length}`);
  check(rows.every((row) => row.local_test_support === "catalog-supported"), "all top20 rows must be catalog-supported");
  check(rows.every((row) => row.confighub_proof === "pass"), "all top20 rows must have passing ConfigHub proof receipts");
  check(rows.every((row) => row.production_support === "blocked"), "production support should remain explicitly blocked");
  check(rows.some((row) => row.live_e2e === "local-kind-observed"), "at least one supported chart needs a live/e2e observation receipt");
  return { rows, csv: toCsv(rows), summary: toSummary(rows) };
}

function recipeRoots() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
}

function productionRow(root, configHubProof, liveE2E) {
  const catalog = readYaml(join(root, "catalog-status.yaml"));
  if (catalog.spec?.status !== "catalog-supported") return null;
  const index = readYaml(join(root, "artifact-index.yaml"));
  const controls = readYaml(join(root, "control-points.yaml"));
  const chart = catalog.spec.chart;
  const version = String(catalog.spec.version);
  const receipt = configHubProof.get(chart);
  const configHubProofStatus = receipt?.status ?? "missing";
  const live = liveStatus(chart, liveE2E);
  const requiredDispositions = dispositionList({
    controls: controls.spec?.points ?? [],
    variants: index.spec?.variants ?? [],
    productionReadiness: catalog.spec?.productionReadiness,
  });
  return {
    chart,
    version,
    local_test_support: catalog.spec.status,
    supported_variants: (catalog.spec.supportedVariants ?? []).join(";"),
    confighub_proof: configHubProofStatus,
    live_e2e: live.status,
    live_e2e_receipts: live.receipts.join(";"),
    production_support: catalog.spec.productionReadiness === "blocked-by-current-scan-gate" ? "blocked" : "review",
    required_dispositions: requiredDispositions.join(";"),
    next_action: nextAction(requiredDispositions, live.status),
    recipe_path: relativeRepo(root),
    package_path: index.spec?.installerPackage?.path ?? "",
    confighub_proof_receipt: receipt?.path ?? "",
  };
}

function configHubProofIndex() {
  const result = new Map();
  for (const receiptPath of listFiles(join(repoRoot, "runs")).filter((file) => file.endsWith("/latest/confighub-proof-receipt.yaml"))) {
    const receipt = readYaml(receiptPath);
    const chart = receipt.spec?.package?.chart;
    if (!chart) continue;
    const scanPath = join(dirname(receiptPath), "function-scan-receipt.yaml");
    const safeOpsPath = join(dirname(receiptPath), "safe-ops-receipt.yaml");
    const scan = existsSync(scanPath) ? readYaml(scanPath) : {};
    const safeOps = existsSync(safeOpsPath) ? readYaml(safeOpsPath) : {};
    const status =
      receipt.spec?.package?.docVerified === true &&
      receipt.spec?.render?.result === "pass" &&
      receipt.spec?.rerender?.result === "pass" &&
      receipt.spec?.deterministicPackage?.byteIdenticalAcrossTwoLocalBundles === true &&
      receipt.spec?.upload?.result === "pass" &&
      receipt.spec?.serverSideVariant?.result === "pass" &&
      scan.spec?.result === "pass" &&
      safeOps.spec?.safetyResult === "pass"
        ? "pass"
        : "fail";
    result.set(chart, { status, path: relativeRepo(receiptPath) });
  }
  return result;
}

function liveE2EIndex() {
  const result = new Map();
  for (const receiptPath of listFiles(join(repoRoot, "runs")).filter((file) => file.endsWith("observation-receipt.json"))) {
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    const chart = receipt.spec?.chart;
    if (!chart || receipt.spec?.result !== "pass") continue;
    if (!result.has(chart)) result.set(chart, []);
    result.get(chart).push(relativeRepo(receiptPath));
  }
  return result;
}

function liveStatus(chart, liveE2E) {
  const receipts = [...(liveE2E.get(chart) ?? [])];
  if (chart === "bitnami/redis") {
    receipts.push(
    "runs/redis-local-kind/latest/observation-receipt.yaml",
    "runs/redis-local-kind/reuse-existing-secret-latest/observation-receipt.yaml",
    );
  }
  const existingReceipts = receipts.filter((path) => existsSync(join(repoRoot, path))).sort();
  return {
    status: existingReceipts.length > 0 ? "local-kind-observed" : "not-started",
    receipts: existingReceipts,
  };
}

function dispositionList({ controls, variants, productionReadiness }) {
  const categories = new Set(controls.map((point) => point.category));
  const hasCategory = (...names) => names.some((name) => categories.has(name));
  const variantTargetFacts = variants.flatMap((variant) => {
    const facts = [];
    if (variant.targetFactSummary && variant.targetFactSummary !== "none") facts.push("target fact preflight");
    return facts;
  });
  const dispositions = new Set();
  if (productionReadiness === "blocked-by-current-scan-gate") dispositions.add("scan/gate warning disposition");
  if (hasCategory("crds", "crd-policy", "crd-lifecycle", "crd-ownership")) {
    dispositions.add("CRD lifecycle and upgrade policy");
  }
  if (hasCategory("webhooks", "admission-webhook", "webhook-secret")) {
    dispositions.add("webhook readiness and failure policy");
  }
  if (hasCategory("cluster-rbac")) dispositions.add("cluster RBAC review");
  if (hasCategory("stateful-storage", "stateful-workload")) {
    dispositions.add("storage backup restore and rollback policy");
  }
  if (hasCategory("generated-facts")) dispositions.add("generated fact ownership");
  if (hasCategory("target-facts") || variantTargetFacts.length) dispositions.add("target fact preflight");
  if (hasCategory("lifecycle-policy", "hook-policy")) dispositions.add("hook and lifecycle phase policy");
  if (hasCategory("tpl-extension-slots", "extension-slots", "tpl")) {
    dispositions.add("extension slot provenance and scan policy");
  }
  if (dispositions.size === 1) dispositions.add("production values and target assumptions");
  return [...dispositions].sort();
}

function nextAction(requiredDispositions, liveStatus) {
  if (liveStatus === "not-started") return "add target-backed live/e2e observation receipt after production dispositions are written";
  return "extend live/e2e lane beyond local kind after production dispositions are written";
}

function toCsv(rows) {
  const headers = [
    "chart",
    "version",
    "local_test_support",
    "supported_variants",
    "confighub_proof",
    "live_e2e",
    "production_support",
    "required_dispositions",
    "next_action",
    "recipe_path",
    "package_path",
    "confighub_proof_receipt",
    "live_e2e_receipts",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function toSummary(rows) {
  const localSupported = rows.filter((row) => row.local_test_support === "catalog-supported").length;
  const configHubProofPass = rows.filter((row) => row.confighub_proof === "pass").length;
  const liveObserved = rows.filter((row) => row.live_e2e === "local-kind-observed").length;
  const productionBlocked = rows.filter((row) => row.production_support === "blocked").length;
  return `# Production Disposition And Live/E2E Lane

The top-20 are mandatory catalog entries because their upstream Helm charts are
too popular to omit. This lane records the work needed to move those supported
top-20 entries from \`local-test\` support toward production support.

It does **not** claim production readiness yet.

## Summary

\`\`\`text
catalog-supported local-test charts: ${localSupported}
ConfigHub proof receipts passing: ${configHubProofPass}
live/e2e observed charts: ${liveObserved}
production-supported charts: 0
production-blocked pending disposition: ${productionBlocked}
\`\`\`

## Top-20 Disposition Table

| Chart | Variants | ConfigHub proof | Live/e2e | Production status | Required dispositions |
| --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.supported_variants.replaceAll(";", ", ")} | ${row.confighub_proof} | ${row.live_e2e} | ${row.production_support} | ${row.required_dispositions.replaceAll(";", ", ")} |`).join("\n")}

## Doctrine

The top-20 must be in the catalog. Their local-test paths are easy to try
because they have passing ConfigHub/cub install receipts. They are not
production-supported until their scan/gate warnings, lifecycle risks, target
facts, and live/e2e observation requirements have explicit dispositions.
`;
}

function writeReport(report) {
  write(reviewCsvPath, report.csv);
  write(summaryPath, report.summary);
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
