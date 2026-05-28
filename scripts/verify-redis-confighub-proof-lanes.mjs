import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const receiptRoot = join(repoRoot, "runs", "redis-confighub-proof", "latest");

verifyFunctionScan();
verifySafeOps();

console.log("verified Redis ConfigHub scan and safe-ops receipts");

function verifyFunctionScan() {
  const path = join(receiptRoot, "function-scan-receipt.yaml");
  check(existsSync(path), "missing Redis function scan receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubFunctionScanReceipt", "function scan receipt kind mismatch");
  check(receipt.spec?.context?.space === "helm-redis-confighub-proof", "function scan receipt must target Redis proof space");
  check(receipt.spec?.subject?.chart === "bitnami/redis", "function scan chart mismatch");
  check(receipt.spec?.subject?.chartVersion === "25.5.3", "function scan chart version mismatch");
  check(receipt.spec?.subject?.configHubUnitCount === 14, "function scan must cover 14 Redis Units");
  check(receipt.spec?.unitRevisionBindings?.length === 14, "function scan must bind 14 Unit revisions");
  const functions = receipt.spec?.validations ?? [];
  check(functions.length >= 3, "function scan must include at least three validators");
  for (const fn of ["vet-format", "vet-placeholders", "vet-merge-keys"]) {
    const validation = functions.find((item) => item.function === fn);
    check(Boolean(validation), `function scan missing ${fn}`);
    check(validation.result === "pass", `${fn} did not pass`);
    check(validation.scannedUnits === 14, `${fn} must scan 14 Units`);
    check(validation.failedUnits === 0, `${fn} must have zero failed Units`);
  }
  check(receipt.spec?.result === "pass", "function scan receipt result must pass");
}

function verifySafeOps() {
  const path = join(receiptRoot, "safe-ops-receipt.yaml");
  check(existsSync(path), "missing Redis safe-ops receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubSafeOpsReceipt", "safe-ops receipt kind mismatch");
  check(receipt.spec?.context?.space === "helm-redis-confighub-proof", "safe-ops receipt must target Redis proof space");
  check(receipt.spec?.subject?.chart === "bitnami/redis", "safe-ops chart mismatch");
  check(receipt.spec?.changeset?.slug === "redis-safe-ops-20260527", "safe-ops changeset slug mismatch");
  check(receipt.spec?.changeset?.createResult === "pass", "changeset create must pass");
  check(receipt.spec?.changeset?.updateResult === "pass", "changeset update must pass");
  check(receipt.spec?.approval?.result === "pass", "representative approval must pass");
  check(receipt.spec?.applyDryRun?.result === "blocked-no-target", "dry-run apply must be blocked without a target");
  check(receipt.spec?.applyDryRun?.expected === true, "dry-run no-target block must be marked expected");
  check(receipt.spec?.cancel?.result === "pass", "cancel must pass");
  check(receipt.spec?.safetyResult === "pass", "safe-ops safety result must pass");
}

