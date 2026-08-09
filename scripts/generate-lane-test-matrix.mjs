import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  check,
  listFiles,
  listTrackedFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "lane-test-matrix");
const csvPath = join(outputRoot, "variant-lanes.csv");
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
  console.log(`wrote ${relativeRepo(csvPath)}`);
  console.log(`lane matrix: ${report.rows.length} chart-recipe-variant row(s)`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), "missing lane-test CSV; run npm run lane-tests:generate");
  check(readFileSync(csvPath, "utf8") === report.csv, "lane-test CSV is stale; run npm run lane-tests:generate");
  console.log(`verified lane-test CSV for ${report.rows.length} chart-recipe-variant row(s)`);
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
  return { rows, csv: toCsv(rows) };
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
  for (const receiptPath of listTrackedFiles(join(repoRoot, "runs")).filter((file) => file.endsWith("/confighub-proof-receipt.yaml"))) {
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
  for (const receiptPath of listTrackedFiles(join(repoRoot, "runs")).filter((file) => /observation-receipt\.(json|ya?ml)$/.test(file))) {
    const receipt = readYaml(receiptPath);
    const revision = receipt.spec?.variantRevision;
    if (!revision) continue;
    const result = receipt.spec?.result ?? "pass";
    const method = receipt.spec?.observer?.method ?? "";
    if (!method.includes("kubectl") && !relativeRepo(receiptPath).includes("top20-local-kind")) continue;
    index.set(revision, {
      status: normalizeLaneResult(result),
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
  for (const receiptPath of listFiles(join(repoRoot, "data", "runtime-gitops", "receipts")).filter((file) =>
    /latest\.ya?ml$/.test(file)
  )) {
    const receipt = readYaml(receiptPath);
    const spec = receipt.spec ?? {};
    const packagePath = spec.packagePath;
    const base = spec.base;
    if (!packagePath || !base) continue;
    index.set(`${packagePath}|${base}`, {
      status: normalizeLaneResult(spec.result),
      note: relativeRepo(receiptPath),
    });
  }
  for (const receiptPath of listFiles(join(repoRoot, "runs", "live-helm-confighub-compare")).filter((file) =>
    /receipt\.(json|ya?ml)$/.test(file)
  )) {
    const receipt = readYaml(receiptPath);
    const spec = receipt.spec ?? {};
    const packagePath = spec.package?.path;
    const base = spec.base;
    const ociLegResult = spec.legs?.configHubOciArgo?.result;
    if (!packagePath || !base || !ociLegResult) continue;
    index.set(`${packagePath}|${base}`, {
      status: normalizeLaneResult(ociLegResult),
      note: `${relativeRepo(receiptPath)}#configHubOciArgo`,
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
      status: normalizeLaneResult(receipt.spec?.result),
      note: relativeRepo(receiptPath),
    });
  }
  return index;
}

function missing(note) {
  return { status: "missing", note };
}

function normalizeLaneResult(result) {
  if (["pass", "watch", "blocked", "fail", "missing"].includes(result)) return result;
  if (result === "PASS") return "pass";
  if (result === "FAIL") return "fail";
  return result ? "fail" : "missing";
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

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
