import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const receiptRoot = join(repoRoot, "runs", "postgresql-confighub-proof", "latest");

verifyConfigHubProof();
verifyFunctionScan();
verifySafeOps();

console.log("verified PostgreSQL ConfigHub scan and safe-ops receipts");

function verifyConfigHubProof() {
  const path = join(receiptRoot, "confighub-proof-receipt.yaml");
  check(existsSync(path), "missing PostgreSQL ConfigHub proof receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubProofReceipt", "PostgreSQL ConfigHub proof receipt kind mismatch");
  check(receipt.spec?.package?.chart === "bitnami/postgresql", "PostgreSQL receipt chart mismatch");
  check(receipt.spec?.package?.chartVersion === "18.6.7", "PostgreSQL receipt chart version mismatch");
  check(receipt.spec?.render?.result === "pass", "PostgreSQL render must pass");
  check(receipt.spec?.render?.manifestCount === 7, "PostgreSQL render must produce 7 manifests");
  check(receipt.spec?.render?.separatedSecretCount === 1, "PostgreSQL static-passwords must separate 1 Secret");
  check(receipt.spec?.deterministicPackage?.byteIdenticalAcrossTwoLocalBundles === true, "PostgreSQL package must be deterministic");
  check(receipt.spec?.upload?.kubernetesUnitCount === 7, "PostgreSQL upload must create 7 Kubernetes Units");
  check(receipt.spec?.upload?.installerRecordUnitCount === 1, "PostgreSQL upload must create installer-record Unit");
  check(receipt.spec?.upload?.separatedSecretsNotUploaded?.length === 1, "PostgreSQL must record one separated Secret");
  check(receipt.spec?.plan?.result === "pass", "PostgreSQL post-upload plan must pass");
  check(receipt.spec?.serverSideVariant?.result === "pass", "PostgreSQL server-side variant must pass");
  check(receipt.spec?.serverSideVariant?.clonedUnitCount === 8, "PostgreSQL staging clone must contain 8 Units");
  check(receipt.spec?.review?.representativeUnit === "statefulset-postgresql-postgresql", "PostgreSQL representative review Unit must be StatefulSet");
}

function verifyFunctionScan() {
  const path = join(receiptRoot, "function-scan-receipt.yaml");
  check(existsSync(path), "missing PostgreSQL function scan receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubFunctionScanReceipt", "PostgreSQL function scan receipt kind mismatch");
  check(receipt.spec?.context?.space === "helm-postgresql-confighub-proof", "PostgreSQL function scan receipt must target proof space");
  check(receipt.spec?.subject?.chart === "bitnami/postgresql", "PostgreSQL function scan chart mismatch");
  check(receipt.spec?.subject?.chartVersion === "18.6.7", "PostgreSQL function scan chart version mismatch");
  check(receipt.spec?.subject?.configHubUnitCount === 7, "PostgreSQL function scan must cover 7 Units");
  check(receipt.spec?.unitRevisionBindings?.length === 7, "PostgreSQL function scan must bind 7 Unit revisions");
  const functions = receipt.spec?.validations ?? [];
  for (const fn of ["vet-format", "vet-placeholders", "vet-merge-keys"]) {
    const validation = functions.find((item) => item.function === fn);
    check(Boolean(validation), `PostgreSQL function scan missing ${fn}`);
    check(validation.result === "pass", `PostgreSQL ${fn} did not pass`);
    check(validation.scannedUnits === 7, `PostgreSQL ${fn} must scan 7 Units`);
    check(validation.failedUnits === 0, `PostgreSQL ${fn} must have zero failed Units`);
  }
  check(receipt.spec?.result === "pass", "PostgreSQL function scan receipt result must pass");
}

function verifySafeOps() {
  const path = join(receiptRoot, "safe-ops-receipt.yaml");
  check(existsSync(path), "missing PostgreSQL safe-ops receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubSafeOpsReceipt", "PostgreSQL safe-ops receipt kind mismatch");
  check(receipt.spec?.context?.space === "helm-postgresql-confighub-proof", "PostgreSQL safe-ops receipt must target proof space");
  check(receipt.spec?.subject?.chart === "bitnami/postgresql", "PostgreSQL safe-ops chart mismatch");
  check(receipt.spec?.changeset?.slug === "postgresql-safe-ops-20260527", "PostgreSQL safe-ops changeset slug mismatch");
  check(receipt.spec?.changeset?.createResult === "pass", "PostgreSQL changeset create must pass");
  check(receipt.spec?.changeset?.updateResult === "pass", "PostgreSQL changeset update must pass");
  check(receipt.spec?.approval?.result === "pass", "PostgreSQL representative approval must pass");
  check(receipt.spec?.applyDryRun?.result === "blocked-no-target", "PostgreSQL dry-run apply must be blocked without a target");
  check(receipt.spec?.applyDryRun?.expected === true, "PostgreSQL dry-run no-target block must be marked expected");
  check(receipt.spec?.cancel?.result === "pass", "PostgreSQL cancel must pass");
  check(receipt.spec?.safetyResult === "pass", "PostgreSQL safe-ops safety result must pass");
}
