import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const receiptRoot = join(repoRoot, "runs", "metrics-server-confighub-proof", "latest");

verifyConfigHubProof();
verifyFunctionScan();
verifySafeOps();

console.log("verified Metrics Server ConfigHub scan and safe-ops receipts");

function verifyConfigHubProof() {
  const path = join(receiptRoot, "confighub-proof-receipt.yaml");
  check(existsSync(path), "missing Metrics Server ConfigHub proof receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubProofReceipt", "Metrics Server ConfigHub proof receipt kind mismatch");
  check(receipt.spec?.package?.chart === "metrics-server/metrics-server", "Metrics Server receipt chart mismatch");
  check(receipt.spec?.package?.chartVersion === "3.13.0", "Metrics Server receipt chart version mismatch");
  check(receipt.spec?.render?.result === "pass", "Metrics Server render must pass");
  check(receipt.spec?.render?.manifestCount === 10, "Metrics Server render must produce 10 manifests");
  check(receipt.spec?.render?.separatedSecretCount === 0, "Metrics Server default must not separate secrets");
  check(receipt.spec?.deterministicPackage?.byteIdenticalAcrossTwoLocalBundles === true, "Metrics Server package must be deterministic");
  check(receipt.spec?.upload?.metricsServerKubernetesUnitCount === 10, "Metrics Server upload must create 10 Kubernetes Units");
  check(receipt.spec?.upload?.installerRecordUnitCount === 1, "Metrics Server upload must create installer-record Unit");
  check(receipt.spec?.upload?.unresolvedClusterReferences?.length === 2, "Metrics Server must record two unresolved cluster references");
  check(receipt.spec?.plan?.result === "pass", "Metrics Server post-upload plan must pass");
  check(receipt.spec?.serverSideVariant?.result === "pass", "Metrics Server server-side variant must pass");
  check(receipt.spec?.serverSideVariant?.clonedUnitCount === 11, "Metrics Server staging clone must contain 11 Units");
  check(receipt.spec?.review?.representativeUnit === "apiservice-v1beta1-metrics-k8s-io", "Metrics Server representative review Unit must be APIService");
}

function verifyFunctionScan() {
  const path = join(receiptRoot, "function-scan-receipt.yaml");
  check(existsSync(path), "missing Metrics Server function scan receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubFunctionScanReceipt", "Metrics Server function scan receipt kind mismatch");
  check(receipt.spec?.context?.space === "helm-metrics-server-confighub-proof", "Metrics Server function scan receipt must target proof space");
  check(receipt.spec?.subject?.chart === "metrics-server/metrics-server", "Metrics Server function scan chart mismatch");
  check(receipt.spec?.subject?.chartVersion === "3.13.0", "Metrics Server function scan chart version mismatch");
  check(receipt.spec?.subject?.configHubUnitCount === 10, "Metrics Server function scan must cover 10 Units");
  check(receipt.spec?.unitRevisionBindings?.length === 10, "Metrics Server function scan must bind 10 Unit revisions");
  const functions = receipt.spec?.validations ?? [];
  for (const fn of ["vet-format", "vet-placeholders", "vet-merge-keys"]) {
    const validation = functions.find((item) => item.function === fn);
    check(Boolean(validation), `Metrics Server function scan missing ${fn}`);
    check(validation.result === "pass", `Metrics Server ${fn} did not pass`);
    check(validation.scannedUnits === 10, `Metrics Server ${fn} must scan 10 Units`);
    check(validation.failedUnits === 0, `Metrics Server ${fn} must have zero failed Units`);
  }
  check(receipt.spec?.result === "pass", "Metrics Server function scan receipt result must pass");
}

function verifySafeOps() {
  const path = join(receiptRoot, "safe-ops-receipt.yaml");
  check(existsSync(path), "missing Metrics Server safe-ops receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubSafeOpsReceipt", "Metrics Server safe-ops receipt kind mismatch");
  check(receipt.spec?.context?.space === "helm-metrics-server-confighub-proof", "Metrics Server safe-ops receipt must target proof space");
  check(receipt.spec?.subject?.chart === "metrics-server/metrics-server", "Metrics Server safe-ops chart mismatch");
  check(receipt.spec?.changeset?.slug === "metrics-server-safe-ops-20260527", "Metrics Server safe-ops changeset slug mismatch");
  check(receipt.spec?.changeset?.createResult === "pass", "Metrics Server changeset create must pass");
  check(receipt.spec?.changeset?.updateResult === "pass", "Metrics Server changeset update must pass");
  check(receipt.spec?.approval?.result === "pass", "Metrics Server representative approval must pass");
  check(receipt.spec?.applyDryRun?.result === "blocked-no-target", "Metrics Server dry-run apply must be blocked without a target");
  check(receipt.spec?.applyDryRun?.expected === true, "Metrics Server dry-run no-target block must be marked expected");
  check(receipt.spec?.cancel?.result === "pass", "Metrics Server cancel must pass");
  check(receipt.spec?.safetyResult === "pass", "Metrics Server safe-ops safety result must pass");
}

