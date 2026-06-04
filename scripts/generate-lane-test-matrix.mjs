import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "lane-test-matrix");
const csvPath = join(outputRoot, "variant-lanes.csv");
const summaryPath = join(outputRoot, "summary.md");
const mode = process.argv[2] ?? "--generate";

const CORE_LANES = [
  "helm_template_vs_installer_setup",
  "confighub_upload_variant_scan_safe_ops",
  "local_kind_kubectl_apply",
  "confighub_oci_argo_live",
  "live_helm_vs_confighub_dual_compare",
];

if (mode === "--generate") {
  const report = buildReport();
  mkdirSync(outputRoot, { recursive: true });
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  console.log(`wrote ${relativeRepo(csvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
  console.log(`lane matrix: ${report.rows.length} chart-recipe-variant row(s)`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), "missing lane-test matrix; run npm run lane-tests:generate");
  check(existsSync(summaryPath), "missing lane-test summary; run npm run lane-tests:generate");
  check(readFileSync(csvPath, "utf8") === report.csv, "lane-test matrix is stale; run npm run lane-tests:generate");
  check(readFileSync(summaryPath, "utf8") === report.summary, "lane-test summary is stale; run npm run lane-tests:generate");
  console.log(`verified lane-test matrix for ${report.rows.length} chart-recipe-variant row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-lane-test-matrix.mjs --generate
  node scripts/generate-lane-test-matrix.mjs --verify`);
}

function buildReport() {
  const confighubProofs = confighubProofIndex();
  const localKind = localKindIndex();
  const ociArgo = ociArgoIndex();
  const liveDual = liveDualCompareIndex();
  const rows = recipeRoots()
    .flatMap((root) => variantRows(root, { confighubProofs, localKind, ociArgo, liveDual }))
    .sort((left, right) => `${left.chart}@${left.version}/${left.variant}`.localeCompare(`${right.chart}@${right.version}/${right.variant}`));
  return { rows, csv: toCsv(rows), summary: toSummary(rows) };
}

function recipeRoots() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
}

function variantRows(root, indexes) {
  const sourceLock = readYaml(join(root, "source-lock.yaml"));
  const packageReceiptPath = join(root, "publication", "installer-package-receipt.yaml");
  const packageReceipt = existsSync(packageReceiptPath) ? readYaml(packageReceiptPath) : null;
  const packagePath = packageReceipt?.spec?.package?.path ?? "";
  const chart = sourceLock.spec?.ref ?? `${sourceLock.spec?.repositoryName}/${sourceLock.spec?.chart}`;
  const version = String(sourceLock.spec?.version ?? "");
  const variantFiles = listFiles(join(root, "variants"))
    .filter((file) => file.endsWith("/variant.yaml"))
    .sort();

  return variantFiles.map((variantFile) => {
    const variant = relative(join(root, "variants"), dirname(variantFile));
    const revisionPath = relativeRepo(join(root, "revisions", variant, "r001", "variant-revision.yaml"));
    const helmLane = helmEquivalenceLane(root, variant, packageReceipt);
    const confighubLane = indexes.confighubProofs.get(`${packagePath}|${variant}`) ?? missing("no ConfigHub proof receipt for package/base");
    const localKindLane = indexes.localKind.get(revisionPath) ?? missing("no local-kind observation receipt for variant revision");
    const ociArgoLane = indexes.ociArgo.get(`${packagePath}|${variant}`) ?? missing("no ConfigHub OCI/Argo live receipt in this repo");
    const liveDualLane = indexes.liveDual.get(`${packagePath}|${variant}`) ?? missing("no live Helm vs ConfigHub dual-deploy comparison receipt");

    const laneValues = {
      helm_template_vs_installer_setup: helmLane.status,
      confighub_upload_variant_scan_safe_ops: confighubLane.status,
      local_kind_kubectl_apply: localKindLane.status,
      confighub_oci_argo_live: ociArgoLane.status,
      live_helm_vs_confighub_dual_compare: liveDualLane.status,
    };
    const missingCoreLanes = CORE_LANES.filter((lane) => laneValues[lane] !== "pass");
    return {
      chart,
      version,
      variant,
      recipe_path: relativeRepo(root),
      package_path: packagePath || "missing",
      variant_revision: revisionPath,
      ...laneValues,
      complete_core_lane_set: missingCoreLanes.length === 0 ? "yes" : "no",
      missing_core_lanes: missingCoreLanes.join(";") || "none",
      lane_notes: [
        helmLane.note,
        confighubLane.note,
        localKindLane.note,
        ociArgoLane.note,
        liveDualLane.note,
      ].filter(Boolean).join(" | "),
    };
  });
}

function helmEquivalenceLane(root, variant, packageReceipt) {
  const releasePath = join(root, "revisions", variant, "r001", "rendered", "release-objects.yaml");
  const equivalencePath = join(root, "revisions", variant, "r001", "receipts", "helm-equivalence-receipt.yaml");
  if (!existsSync(releasePath)) return missing(`missing rendered objects for ${variant}`);
  if (!existsSync(equivalencePath)) return missing(`missing Helm equivalence receipt for ${variant}`);
  const releaseSHA = sha256File(releasePath);
  const equivalence = readYaml(equivalencePath);
  const setupChecks = packageReceipt?.spec?.setupChecks ?? [];
  const setupCheck = setupChecks.find((item) => item.variant === variant || item.base === variant);
  const equivalent =
    equivalence.spec?.result === "pass" &&
    equivalence.spec?.regularHelm?.renderedSHA256 === releaseSHA &&
    Boolean(setupCheck);
  if (!equivalent) {
    const reasons = [];
    if (equivalence.spec?.result !== "pass") reasons.push("Helm equivalence result is not pass");
    if (equivalence.spec?.regularHelm?.renderedSHA256 !== releaseSHA) reasons.push("Helm equivalence digest mismatch");
    if (!setupCheck) reasons.push("installer package receipt has no setupCheck for variant");
    return { status: "fail", note: reasons.join("; ") };
  }
  return { status: "pass", note: "Helm equivalence receipt and installer setupCheck present" };
}

function confighubProofIndex() {
  const index = new Map();
  for (const receiptPath of listFiles(join(repoRoot, "runs")).filter((file) => file.endsWith("/confighub-proof-receipt.yaml"))) {
    const receipt = readYaml(receiptPath);
    const packagePath = receipt.spec?.package?.path;
    const selectedBase = receipt.spec?.package?.selectedBase;
    if (!packagePath || !selectedBase) continue;
    const receiptRoot = dirname(receiptPath);
    const functionScan = existsSync(join(receiptRoot, "function-scan-receipt.yaml"));
    const safeOps = existsSync(join(receiptRoot, "safe-ops-receipt.yaml"));
    const pass = [
      receipt.spec?.render?.result,
      receipt.spec?.rerender?.result,
      receipt.spec?.upload?.result,
      receipt.spec?.serverSideVariant?.result,
    ].every((value) => value === "pass") && functionScan && safeOps;
    index.set(`${packagePath}|${selectedBase}`, {
      status: pass ? "pass" : "fail",
      note: `${relativeRepo(receiptPath)}${functionScan && safeOps ? "" : " missing function/safe-op receipt"}`,
    });
  }
  return index;
}

function localKindIndex() {
  const index = new Map();
  for (const receiptPath of listFiles(join(repoRoot, "runs")).filter((file) => /observation-receipt\.(json|ya?ml)$/.test(file))) {
    const receipt = readYaml(receiptPath);
    const revision = receipt.spec?.variantRevision;
    if (!revision) continue;
    const result = receipt.spec?.result ?? "pass";
    const method = receipt.spec?.observer?.method ?? "";
    if (!method.includes("kubectl") && !relativeRepo(receiptPath).includes("top20-local-kind")) continue;
    index.set(revision, {
      status: result === "pass" ? "pass" : "fail",
      note: relativeRepo(receiptPath),
    });
  }
  return index;
}

function ociArgoIndex() {
  const index = new Map();
  for (const receiptPath of listFiles(join(repoRoot, "tests")).filter((file) => /receipt-.*\.json$/.test(file))) {
    const receipt = readYaml(receiptPath);
    const packagePath = receipt.package;
    const base = receipt.base;
    if (!packagePath || !base) continue;
    index.set(`${packagePath}|${base}`, {
      status: receipt.status === "PASS" ? "pass" : "fail",
      note: relativeRepo(receiptPath),
    });
  }
  return index;
}

function liveDualCompareIndex() {
  const index = new Map();
  const root = join(repoRoot, "runs", "live-helm-confighub-compare");
  for (const receiptPath of listFiles(root).filter((file) => /receipt\.(json|ya?ml)$/.test(file))) {
    const receipt = readYaml(receiptPath);
    const packagePath = receipt.spec?.package?.path;
    const base = receipt.spec?.variant ?? receipt.spec?.base;
    if (!packagePath || !base) continue;
    index.set(`${packagePath}|${base}`, {
      status: receipt.spec?.result === "pass" ? "pass" : "fail",
      note: relativeRepo(receiptPath),
    });
  }
  return index;
}

function missing(note) {
  return { status: "missing", note };
}

function toCsv(rows) {
  const headers = [
    "chart",
    "version",
    "variant",
    "helm_template_vs_installer_setup",
    "confighub_upload_variant_scan_safe_ops",
    "local_kind_kubectl_apply",
    "confighub_oci_argo_live",
    "live_helm_vs_confighub_dual_compare",
    "complete_core_lane_set",
    "missing_core_lanes",
    "recipe_path",
    "package_path",
    "variant_revision",
    "lane_notes",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function toSummary(rows) {
  const total = rows.length;
  const counts = Object.fromEntries(
    CORE_LANES.map((lane) => [
      lane,
      {
        pass: rows.filter((row) => row[lane] === "pass").length,
        missing: rows.filter((row) => row[lane] === "missing").length,
        fail: rows.filter((row) => row[lane] === "fail").length,
      },
    ]),
  );
  const complete = rows.filter((row) => row.complete_core_lane_set === "yes").length;
  const missingLive = rows.filter((row) => row.live_helm_vs_confighub_dual_compare !== "pass").slice(0, 25);
  const missingConfigHub = rows.filter((row) => row.confighub_upload_variant_scan_safe_ops !== "pass").slice(0, 25);
  const missingLocal = rows.filter((row) => row.local_kind_kubectl_apply !== "pass").slice(0, 25);

  return `# Lane Test Matrix

Generated from recipe variants, proof receipts, ConfigHub proof receipts, local-kind
observation receipts, and live-test receipt locations.

This is a corpus control surface. A lane can be \`missing\` without making this
generated report stale; the missing state is the backlog.

## Headline

\`\`\`text
chart-recipe-variant rows: ${total}
complete core lane set: ${complete}
incomplete core lane set: ${total - complete}
\`\`\`

## Core Lane Counts

| Lane | Pass | Missing | Fail |
| --- | ---: | ---: | ---: |
${CORE_LANES.map((lane) => `| ${lane} | ${counts[lane].pass} | ${counts[lane].missing} | ${counts[lane].fail} |`).join("\n")}

## Lane Definitions

| Lane | Evidence |
| --- | --- |
| \`helm_template_vs_installer_setup\` | \`revisions/<variant>/r001/receipts/helm-equivalence-receipt.yaml\` plus matching \`publication/installer-package-receipt.yaml.spec.setupChecks[]\`. |
| \`confighub_upload_variant_scan_safe_ops\` | \`runs/<slug>-confighub-proof/latest/confighub-proof-receipt.yaml\`, function scan receipt, and safe-ops receipt. |
| \`local_kind_kubectl_apply\` | \`runs/top20-local-kind/<chart>-<variant>/observation-receipt.json\` or equivalent Redis local-kind receipt. |
| \`confighub_oci_argo_live\` | \`tests/chart-install-test\` / \`tests/chart-install-sweep\` receipt proving ConfigHub Units were applied to OCI and reconciled by Argo. |
| \`live_helm_vs_confighub_dual_compare\` | Future receipt comparing a live \`helm install\` deployment against two live ConfigHub deployments: Argo/OCI or Flux, and kubectl/apply. |

## Current Gaps

The live Helm-vs-ConfigHub dual comparison lane is intentionally all backlog
until the receipt-producing harness exists. The ConfigHub OCI/Argo live lane has
a harness, but this repo currently has no committed PASS receipts for every
chart-recipe-variant row.

### First Missing ConfigHub Proof Rows

${rowList(missingConfigHub)}

### First Missing Local Kind Rows

${rowList(missingLocal)}

### First Missing Live Helm Vs ConfigHub Rows

${rowList(missingLive)}
`;
}

function rowList(rows) {
  if (!rows.length) return "none\n";
  return `${rows.map((row) => `- ${row.chart}@${row.version} / ${row.variant}`).join("\n")}\n`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
