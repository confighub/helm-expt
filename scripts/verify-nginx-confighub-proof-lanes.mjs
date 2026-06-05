import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const receiptRoot = join(repoRoot, "runs", "nginx-confighub-proof", "latest");

verifyConfigHubProof();
verifyFunctionScan();
verifySafeOps();

console.log("verified NGINX ConfigHub scan and safe-ops receipts");

function verifyConfigHubProof() {
  const path = join(receiptRoot, "confighub-proof-receipt.yaml");
  check(existsSync(path), "missing NGINX ConfigHub proof receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubProofReceipt", "NGINX ConfigHub proof receipt kind mismatch");
  check(receipt.spec?.package?.chart === "bitnami/nginx", "NGINX receipt chart mismatch");
  check(receipt.spec?.package?.chartVersion === "24.0.2", "NGINX receipt chart version mismatch");
  check(receipt.spec?.render?.result === "pass", "NGINX render must pass");
  check(receipt.spec?.render?.manifestCount === 6, "NGINX render must produce 6 manifests");
  check(receipt.spec?.render?.separatedSecretCount === 0, "NGINX http-clusterip must not separate secrets");
  check(receipt.spec?.deterministicPackage?.byteIdenticalAcrossTwoLocalBundles === true, "NGINX package must be deterministic");
  check(receipt.spec?.upload?.kubernetesUnitCount === 6, "NGINX upload must create 6 Kubernetes Units");
  check(receipt.spec?.upload?.installerRecordUnitCount === 1, "NGINX upload must create installer-record Unit");
  check(receipt.spec?.plan?.result === "pass", "NGINX post-upload plan must pass");
  check(receipt.spec?.serverSideVariant?.result === "pass", "NGINX server-side variant must pass");
  check(receipt.spec?.serverSideVariant?.downstreamSpace === "NGINX-staging", "NGINX staging clone space mismatch");
  check(receipt.spec?.serverSideVariant?.clonedUnitCount === 7, "NGINX staging clone must contain 7 Units");
}

function verifyFunctionScan() {
  const path = join(receiptRoot, "function-scan-receipt.yaml");
  check(existsSync(path), "missing NGINX function scan receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubFunctionScanReceipt", "NGINX function scan receipt kind mismatch");
  check(receipt.spec?.context?.space === "helm-nginx-confighub-proof", "NGINX function scan receipt must target proof space");
  check(receipt.spec?.subject?.chart === "bitnami/nginx", "NGINX function scan chart mismatch");
  check(receipt.spec?.subject?.chartVersion === "24.0.2", "NGINX function scan chart version mismatch");
  check(receipt.spec?.subject?.configHubUnitCount === 6, "NGINX function scan must cover 6 Units");
  check(receipt.spec?.unitRevisionBindings?.length === 6, "NGINX function scan must bind 6 Unit revisions");
  const functions = receipt.spec?.validations ?? [];
  for (const fn of ["vet-format", "vet-placeholders", "vet-merge-keys"]) {
    const validation = functions.find((item) => item.function === fn);
    check(Boolean(validation), `NGINX function scan missing ${fn}`);
    check(validation.result === "pass", `NGINX ${fn} did not pass`);
    check(validation.scannedUnits === 6, `NGINX ${fn} must scan 6 Units`);
    check(validation.failedUnits === 0, `NGINX ${fn} must have zero failed Units`);
  }
  check(receipt.spec?.result === "pass", "NGINX function scan receipt result must pass");
}

function verifySafeOps() {
  const path = join(receiptRoot, "safe-ops-receipt.yaml");
  check(existsSync(path), "missing NGINX safe-ops receipt");
  const receipt = readYaml(path);
  check(receipt.kind === "ConfigHubSafeOpsReceipt", "NGINX safe-ops receipt kind mismatch");
  check(receipt.spec?.context?.space === "helm-nginx-confighub-proof", "NGINX safe-ops receipt must target proof space");
  check(receipt.spec?.subject?.chart === "bitnami/nginx", "NGINX safe-ops chart mismatch");
  check(receipt.spec?.changeset?.slug === "nginx-safe-ops-20260527", "NGINX safe-ops changeset slug mismatch");
  check(receipt.spec?.changeset?.createResult === "pass", "NGINX changeset create must pass");
  check(receipt.spec?.changeset?.updateResult === "pass", "NGINX changeset update must pass");
  check(receipt.spec?.approval?.result === "pass", "NGINX representative approval must pass");
  check(receipt.spec?.applyDryRun?.result === "blocked-no-target", "NGINX dry-run apply must be blocked without a target");
  check(receipt.spec?.applyDryRun?.expected === true, "NGINX dry-run no-target block must be marked expected");
  check(receipt.spec?.cancel?.result === "pass", "NGINX cancel must pass");
  check(receipt.spec?.safetyResult === "pass", "NGINX safe-ops safety result must pass");
}
