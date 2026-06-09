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
  const sourceFeatures = sourceFeatureIndex();
  const extensionSlots = extensionSlotIndex();
  const lifecycleObservations = lifecycleObservationIndex();
  const dispositionReceipts = productionDispositionReceiptIndex();
  const rows = recipeRoots()
    .map((root) => productionRow(root, configHubProof, liveE2E, sourceFeatures, extensionSlots, lifecycleObservations, dispositionReceipts))
    .filter(Boolean)
    .sort((left, right) => left.chart.localeCompare(right.chart));
  check(rows.length === 20, `expected 20 catalog-supported rows, found ${rows.length}`);
  check(rows.every((row) => row.local_test_support === "catalog-supported"), "all top20 rows must be catalog-supported");
  check(rows.every((row) => row.confighub_proof === "pass"), "all top20 rows must have passing ConfigHub proof receipts");
  check(rows.every((row) => row.production_support !== "production-supported"), "production support should remain separate from disposition closure");
  check(rows.some((row) => row.live_e2e === "local-kind-observed"), "at least one supported chart needs a live/e2e observation receipt");
  checkAllDispositionReceiptsUsed(rows, dispositionReceipts);
  return { rows, csv: toCsv(rows), summary: toSummary(rows) };
}

function recipeRoots() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
}

function productionRow(root, configHubProof, liveE2E, sourceFeatures, extensionSlots, lifecycleObservations, dispositionReceipts) {
  const catalog = readYaml(join(root, "catalog-status.yaml"));
  if (catalog.spec?.status !== "catalog-supported") return null;
  const index = readYaml(join(root, "artifact-index.yaml"));
  const controls = readYaml(join(root, "control-points.yaml"));
  const chart = catalog.spec.chart;
  const source = sourceFeatures.get(chart) ?? {};
  const observations = lifecycleObservations.get(chart) ?? [];
  const version = String(catalog.spec.version);
  const receipt = configHubProof.get(chart);
  const configHubProofStatus = receipt?.status ?? "missing";
  const live = liveStatus(chart, liveE2E);
  const requiredDispositions = dispositionList({
    controls: controls.spec?.points ?? [],
    variants: index.spec?.variants ?? [],
    hasExtensionSlot: extensionSlots.has(`${chart}@${version}`),
  });
  const accepted = acceptedDispositionReceipts(chart, requiredDispositions, dispositionReceipts);
  const acceptedNames = new Set(accepted.map((receipt) => receipt.disposition));
  const openDispositions = requiredDispositions.filter((name) => !acceptedNames.has(name));
  const lifecycleBasis = lifecyclePolicyBasis(controls.spec?.points ?? [], source, observations);
  const productionSupport = openDispositions.length === 0 ? "production-review-ready" : "blocked";
  return {
    chart,
    version,
    local_test_support: catalog.spec.status,
    supported_variants: (catalog.spec.supportedVariants ?? []).join(";"),
    confighub_proof: configHubProofStatus,
    live_e2e: live.status,
    live_e2e_receipts: live.receipts.join(";"),
    production_support: productionSupport,
    required_dispositions: requiredDispositions.join(";"),
    accepted_dispositions: accepted.map((receipt) => receipt.disposition).join(";"),
    open_dispositions: openDispositions.join(";"),
    production_disposition_receipts: accepted.map((receipt) => receipt.path).join(";"),
    source_hook_count: source.hooks?.count ?? 0,
    lifecycle_policy_basis: lifecycleBasis.join(";"),
    lifecycle_observation_receipts: observations.map((row) => row.receipt).join(";"),
    next_action: nextAction(openDispositions, live.status),
    recipe_path: relativeRepo(root),
    package_path: index.spec?.installerPackage?.path ?? "",
    confighub_proof_receipt: receipt?.path ?? "",
  };
}

function productionDispositionReceiptIndex() {
  const result = new Map();
  const root = join(repoRoot, "data", "production-disposition", "receipts");
  if (!existsSync(root)) return result;
  for (const receiptPath of listFiles(root).filter((file) => /\.ya?ml$/.test(file))) {
    const receipt = readYaml(receiptPath);
    if (receipt.kind !== "ProductionDispositionReceipt") continue;
    if (receipt.spec?.decision !== "accepted") continue;
    const chart = receipt.spec?.chart;
    const disposition = receipt.spec?.disposition;
    if (!chart || !disposition) continue;
    for (const item of receipt.spec?.evidence ?? []) {
      if (item.path) check(existsSync(join(repoRoot, item.path)), `${relativeRepo(receiptPath)} references missing evidence ${item.path}`);
    }
    result.set(dispositionKey(chart, disposition), {
      chart,
      disposition,
      path: relativeRepo(receiptPath),
      decision: receipt.spec.decision,
      acceptedAt: receipt.spec.acceptedAt ?? "",
    });
  }
  return result;
}

function checkAllDispositionReceiptsUsed(rows, dispositionReceipts) {
  const used = new Set(rows.flatMap((row) => splitList(row.production_disposition_receipts)));
  const unused = [...dispositionReceipts.values()].map((receipt) => receipt.path).filter((path) => !used.has(path));
  check(unused.length === 0, `production disposition receipt does not match a required disposition: ${unused.join(", ")}`);
}

function acceptedDispositionReceipts(chart, requiredDispositions, dispositionReceipts) {
  return requiredDispositions
    .map((disposition) => dispositionReceipts.get(dispositionKey(chart, disposition)))
    .filter(Boolean);
}

function dispositionKey(chart, disposition) {
  return `${chart}\u0000${disposition}`;
}

function sourceFeatureIndex() {
  const path = join(repoRoot, "data", "top500-catalog-analysis", "source", "source-feature-scan.raw.json");
  const result = new Map();
  if (!existsSync(path)) return result;
  const rows = JSON.parse(readFileSync(path, "utf8"));
  for (const row of rows) result.set(row.chart, row);
  return result;
}

function extensionSlotIndex() {
  const result = new Set();
  const path = join(repoRoot, "data", "extension-slots", "extension-slots.csv");
  if (!existsSync(path)) return result;
  for (const row of parseCsv(readFileSync(path, "utf8"))) result.add(row.chart);
  return result;
}

function lifecycleObservationIndex() {
  const result = new Map();
  const path = join(repoRoot, "data", "lifecycle-observations", "cert-manager-eso", "summary.csv");
  if (!existsSync(path)) return result;
  for (const row of parseCsv(readFileSync(path, "utf8"))) {
    if (!result.has(row.chart)) result.set(row.chart, []);
    result.get(row.chart).push(row);
  }
  return result;
}

function lifecyclePolicyBasis(points, source, observations) {
  const categories = new Set(points.map((point) => point.category));
  const bases = [];
  const sourceHookCount = Number(source.hooks?.count ?? 0);
  if (sourceHookCount > 0) bases.push(`source-hooks:${sourceHookCount}`);
  const hookPoint = points.find((point) => point.category === "hook-policy");
  if (hookPoint) bases.push(`recipe-hook-policy:${hookPoint.policy ?? hookPoint.status ?? "declared"}`);
  if (categories.has("lifecycle-policy")) bases.push("recipe-lifecycle-policy");
  if (observations.length > 0) bases.push(`lifecycle-observations:${observations.filter((row) => row.result === "pass").length}/${observations.length}`);
  return bases.length > 0 ? bases : ["none"];
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
  for (const receiptPath of listFiles(join(repoRoot, "runs")).filter((file) => file.endsWith("observation-receipt.json") || file.endsWith("observation-receipt.yaml"))) {
    const receipt = receiptPath.endsWith(".json") ? JSON.parse(readFileSync(receiptPath, "utf8")) : readYaml(receiptPath);
    const chart = chartFromObservation(receipt);
    if (!chart || receipt.spec?.result !== "pass") continue;
    if (!result.has(chart)) result.set(chart, []);
    result.get(chart).push(relativeRepo(receiptPath));
  }
  return result;
}

function liveStatus(chart, liveE2E) {
  const receipts = [...new Set(liveE2E.get(chart) ?? [])];
  const existingReceipts = receipts.filter((path) => existsSync(join(repoRoot, path))).sort();
  return {
    status: existingReceipts.length > 0 ? "local-kind-observed" : "not-started",
    receipts: existingReceipts,
  };
}

function chartFromObservation(receipt) {
  if (receipt.spec?.chart) return receipt.spec.chart;
  const variantRevision = String(receipt.spec?.variantRevision ?? "");
  const parts = variantRevision.split("/");
  if (parts[0] === "recipes" && parts.length >= 4) return `${parts[1]}/${parts[2]}`;
  return "";
}

function dispositionList({ controls, variants, hasExtensionSlot }) {
  const categories = new Set(controls.map((point) => point.category));
  const hasCategory = (...names) => names.some((name) => categories.has(name));
  const variantTargetFacts = variants.flatMap((variant) => {
    const facts = [];
    if (variant.targetFactSummary && variant.targetFactSummary !== "none") facts.push("target fact preflight");
    return facts;
  });
  const dispositions = new Set(["scan/gate warning disposition"]);
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
  if (hasCategory("tpl-extension-slots", "extension-slots") || (hasExtensionSlot && hasCategory("tpl"))) {
    dispositions.add("extension slot provenance and scan policy");
  }
  if (dispositions.size === 1) dispositions.add("production values and target assumptions");
  return [...dispositions].sort();
}

function nextAction(openDispositions, liveStatus) {
  if (openDispositions.length > 0) return `write or fix the ${openDispositions[0]} disposition receipt`;
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
    "accepted_dispositions",
    "open_dispositions",
    "production_disposition_receipts",
    "source_hook_count",
    "lifecycle_policy_basis",
    "lifecycle_observation_receipts",
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
  const productionReviewReady = rows.filter((row) => row.production_support === "production-review-ready").length;
  const sourceHookRows = rows.filter((row) => Number(row.source_hook_count) > 0).length;
  const lifecycleDispositionRows = rows.filter((row) => row.required_dispositions.includes("hook and lifecycle phase policy")).length;
  const lifecycleObservationRows = rows.filter((row) => row.lifecycle_observation_receipts).length;
  const acceptedDispositionCount = rows.reduce((sum, row) => sum + splitList(row.accepted_dispositions).length, 0);
  const rowsWithAcceptedDisposition = rows.filter((row) => row.accepted_dispositions).length;
  return `# Production Disposition And Live/E2E Lane

The top-20 are mandatory catalog entries because their upstream Helm charts are
too popular to omit. This lane records the work needed to move those supported
top-20 entries from \`local-test\` support toward production support.

It does **not** claim production support yet.

## Summary

\`\`\`text
catalog-supported local-test charts: ${localSupported}
ConfigHub proof receipts passing: ${configHubProofPass}
live/e2e observed charts: ${liveObserved}
production-supported charts: 0
production-review-ready pending final support decision: ${productionReviewReady}
production-blocked pending disposition: ${productionBlocked}
source Helm-hook rows: ${sourceHookRows}
hook/lifecycle disposition rows: ${lifecycleDispositionRows}
related lifecycle observation rows: ${lifecycleObservationRows}
accepted production disposition receipts: ${acceptedDispositionCount}
charts with accepted dispositions: ${rowsWithAcceptedDisposition}
\`\`\`

The hook/lifecycle disposition is a production-review item. It does not always
mean the retained source scan found Helm hooks. Use the evidence fields in
\`top20.csv\`:

- \`source_hook_count\` shows retained source-scan hook evidence.
- \`lifecycle_policy_basis\` shows whether the row came from source hooks,
  recipe hook policy, generic lifecycle policy, or related lifecycle
  observations.
- \`lifecycle_observation_receipts\` links receipts for cert-manager and
  External Secrets style CRD/webhook/controller behavior.

## Top-20 Disposition Table

| Chart | Variants | ConfigHub proof | Live/e2e | Production status | Accepted | Open dispositions |
| --- | --- | --- | --- | --- | ---: | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.supported_variants.replaceAll(";", ", ")} | ${row.confighub_proof} | ${row.live_e2e} | ${row.production_support} | ${splitList(row.accepted_dispositions).length} | ${row.open_dispositions.replaceAll(";", ", ")} |`).join("\n")}

## Doctrine

The top-20 must be in the catalog. Their local-test paths are easy to try
because they have passing ConfigHub/cub installer receipts. They are not
production-supported until their scan/gate warnings, lifecycle risks, target
facts, and live/e2e observation requirements have explicit dispositions and a
separate production support decision records the target scope.
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

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function splitList(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}
