import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";
import { TOP20_CONFIGHUB_PROOF_CHARTS, chartBySlug } from "./lib/top20-confighub-proof.mjs";

const args = process.argv.slice(2);
const chartsArg = optionValue("--charts");
const selected = chartsArg
  ? chartsArg
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean)
      .map((slug) => {
        const chart = chartBySlug(slug);
        check(chart, `unknown top-20 chart slug: ${slug}`);
        return chart;
      })
  : TOP20_CONFIGHUB_PROOF_CHARTS;

for (const chart of selected) verifyChart(chart);

console.log(`verified ${selected.length} top-20 ConfigHub proof receipt set(s)`);

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function verifyChart(chart) {
  const root = join(repoRoot, "runs", `${chart.slug}-confighub-proof`, "latest");
  const demoRoot = join(repoRoot, "docs", "demo", chart.slug);
  const configHubProofPath = join(root, "confighub-proof-receipt.yaml");
  const functionScanPath = join(root, "function-scan-receipt.yaml");
  const safeOpsPath = join(root, "safe-ops-receipt.yaml");

  check(existsSync(configHubProofPath), `${chart.slug} missing ConfigHub proof receipt`);
  check(existsSync(functionScanPath), `${chart.slug} missing function scan receipt`);
  check(existsSync(safeOpsPath), `${chart.slug} missing safe-ops receipt`);
  check(existsSync(join(demoRoot, "confighub-proof.md")), `${chart.slug} missing ConfigHub proof doc`);
  check(existsSync(join(demoRoot, "confighub-proof-transcript.md")), `${chart.slug} missing ConfigHub proof transcript`);

  const receipt = readYaml(configHubProofPath);
  const functionScan = readYaml(functionScanPath);
  const safeOps = readYaml(safeOpsPath);

  check(receipt.kind === "ConfigHubProofReceipt", `${chart.slug} ConfigHub proof kind mismatch`);
  check(receipt.spec?.package?.path === chart.packagePath, `${chart.slug} package path mismatch`);
  check(receipt.spec?.package?.chart === chart.chart, `${chart.slug} chart mismatch`);
  check(String(receipt.spec?.package?.chartVersion) === chart.chartVersion, `${chart.slug} chart version mismatch`);
  check(receipt.spec?.package?.docVerified === true, `${chart.slug} package docs not verified`);
  check((receipt.spec?.package?.bases ?? []).length > 0, `${chart.slug} package bases missing`);
  check(receipt.spec?.render?.result === "pass", `${chart.slug} render did not pass`);
  check(Number(receipt.spec?.render?.manifestCount ?? 0) > 0, `${chart.slug} render manifest count must be positive`);
  check(receipt.spec?.rerender?.result === "pass", `${chart.slug} rerender did not pass`);
  check(
    Number(receipt.spec?.rerender?.manifestCount ?? 0) === Number(receipt.spec?.render?.manifestCount ?? -1),
    `${chart.slug} rerender count changed`,
  );
  check(
    receipt.spec?.deterministicPackage?.byteIdenticalAcrossTwoLocalBundles === true,
    `${chart.slug} package bundle is not deterministic`,
  );
  check(Boolean(receipt.spec?.deterministicPackage?.sha256), `${chart.slug} missing deterministic package sha`);
  check(receipt.spec?.vet?.result === "pass", `${chart.slug} vet did not pass`);
  check(receipt.spec?.upload?.result === "pass", `${chart.slug} upload did not pass`);
  check(Number(receipt.spec?.upload?.unitCount ?? 0) > 0, `${chart.slug} upload unit count must be positive`);
  check(kubernetesUnitCount(receipt) > 0, `${chart.slug} Kubernetes Unit count must be positive`);
  check(receipt.spec?.plan?.result === "pass", `${chart.slug} post-upload plan did not pass`);
  check(receipt.spec?.serverSideVariant?.result === "pass", `${chart.slug} server-side variant did not pass`);
  check(
    Number(receipt.spec?.serverSideVariant?.clonedUnitCount ?? 0) >= Number(receipt.spec?.upload?.unitCount ?? 1),
    `${chart.slug} staging clone count is smaller than upstream unit count`,
  );
  check(receipt.spec?.review?.unitList === "pass", `${chart.slug} unit list review missing`);
  check(receipt.spec?.review?.unitData === "pass", `${chart.slug} unit data review missing`);
  check(receipt.spec?.review?.revisionList === "pass", `${chart.slug} revision list review missing`);

  check(functionScan.kind === "ConfigHubFunctionScanReceipt", `${chart.slug} function scan kind mismatch`);
  check(functionScan.spec?.subject?.chart === chart.chart, `${chart.slug} function scan chart mismatch`);
  check(
    String(functionScan.spec?.subject?.chartVersion) === chart.chartVersion,
    `${chart.slug} function scan chart version mismatch`,
  );
  check(functionScan.spec?.subject?.packagePath === chart.packagePath, `${chart.slug} function scan package mismatch`);
  check(functionScan.spec?.result === "pass", `${chart.slug} function scan did not pass`);
  const bindings = functionScan.spec?.unitRevisionBindings ?? [];
  check(bindings.length > 0, `${chart.slug} function scan has no unit revision bindings`);
  check(
    bindings.length === Number(functionScan.spec?.subject?.configHubUnitCount ?? -1),
    `${chart.slug} function scan binding count mismatch`,
  );
  for (const fn of ["vet-format", "vet-placeholders", "vet-merge-keys"]) {
    const validation = (functionScan.spec?.validations ?? []).find((item) => item.function === fn);
    check(Boolean(validation), `${chart.slug} missing ${fn} validation`);
    check(validation.result === "pass", `${chart.slug} ${fn} did not pass`);
    check(Number(validation.scannedUnits) === bindings.length, `${chart.slug} ${fn} scanned count mismatch`);
    check(Number(validation.failedUnits) === 0, `${chart.slug} ${fn} must have zero failed units`);
  }

  check(safeOps.kind === "ConfigHubSafeOpsReceipt", `${chart.slug} safe ops kind mismatch`);
  check(safeOps.spec?.subject?.chart === chart.chart, `${chart.slug} safe ops chart mismatch`);
  check(String(safeOps.spec?.subject?.chartVersion) === chart.chartVersion, `${chart.slug} safe ops version mismatch`);
  check(safeOps.spec?.changeset?.createResult === "pass", `${chart.slug} changeset create did not pass`);
  check(safeOps.spec?.changeset?.updateResult === "pass", `${chart.slug} changeset update did not pass`);
  check(safeOps.spec?.approval?.result === "pass", `${chart.slug} approval did not pass`);
  check(safeOps.spec?.applyDryRun?.result === "blocked-no-target", `${chart.slug} apply dry-run boundary changed`);
  check(safeOps.spec?.applyDryRun?.expected === true, `${chart.slug} apply dry-run block is not marked expected`);
  check(safeOps.spec?.cancel?.result === "pass", `${chart.slug} cancel did not pass`);
  check(safeOps.spec?.safetyResult === "pass", `${chart.slug} safe ops result did not pass`);
}

function kubernetesUnitCount(receipt) {
  if (receipt.spec?.upload?.kubernetesUnitCount !== undefined) return Number(receipt.spec.upload.kubernetesUnitCount);
  const dynamicKey = Object.keys(receipt.spec?.upload ?? {}).find((key) => key.endsWith("KubernetesUnitCount"));
  return dynamicKey ? Number(receipt.spec.upload[dynamicKey]) : 0;
}
