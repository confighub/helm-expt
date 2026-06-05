import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, listFiles, readYaml, repoRoot } from "./lib/proof-common.mjs";

const root = join(repoRoot, "runs", "live-helm-confighub-compare");
const receipts = listFiles(root).filter((file) => /receipt\.(json|ya?ml)$/.test(file));

check(receipts.length >= 1, "expected at least one live Helm-vs-ConfigHub parity receipt");

for (const receiptPath of receipts) {
  const receipt = readYaml(receiptPath);
  const spec = receipt.spec ?? {};
  const context = `${spec.chart ?? "unknown"}@${spec.version ?? "unknown"} / ${spec.base ?? "unknown"}`;

  check(receipt.apiVersion === "helm-expt.confighub.com/v1alpha1", `${context}: apiVersion mismatch`);
  check(receipt.kind === "LiveHelmConfigHubParityReceipt", `${context}: kind mismatch`);
  check(spec.result === "pass" || spec.result === "blocked" || spec.result === "watch", `${context}: invalid result`);
  check(Boolean(spec.chart), `${context}: missing chart`);
  check(Boolean(spec.version), `${context}: missing version`);
  check(Boolean(spec.base), `${context}: missing base`);
  check(Boolean(spec.package?.path), `${context}: missing package path`);
  check(existsSync(join(repoRoot, spec.package.path)), `${context}: package path does not exist`);

  if (spec.result === "pass") verifyPassingReceipt(spec, context);
}

console.log(`verified ${receipts.length} live Helm-vs-ConfigHub parity receipt(s)`);

function verifyPassingReceipt(spec, context) {
  const legs = spec.legs ?? {};
  for (const leg of ["regularHelm", "configHubKubectlApply", "configHubOciArgo"]) {
    check(legs[leg]?.result === "pass", `${context}: ${leg} must pass`);
    check(Boolean(legs[leg]?.manifestSHA256), `${context}: ${leg} missing manifest SHA`);
    check(Number(legs[leg]?.objectCount ?? 0) > 0, `${context}: ${leg} object count missing`);
    check(legs[leg]?.runtime?.ready === "1/1", `${context}: ${leg} runtime readiness mismatch`);
    check(legs[leg]?.runtime?.podStatus === "Running", `${context}: ${leg} pod status mismatch`);
  }

  const comparison = spec.semanticComparison ?? {};
  const allowed = comparison.allowedExtraConfigHubObjects ?? [];
  check(Array.isArray(allowed), `${context}: allowed extra ConfigHub objects must be a list`);

  for (const key of ["helmVsConfigHubKubectlApply", "helmVsConfigHubOciArgo"]) {
    const item = comparison[key] ?? {};
    check(item.result === "pass", `${context}: ${key} must pass`);
    check((item.missingFromConfigHub ?? []).length === 0, `${context}: ${key} has missing ConfigHub objects`);
    check((item.semanticDiffs ?? []).length === 0, `${context}: ${key} has semantic diffs`);
    check(
      JSON.stringify(item.extraInConfigHub ?? []) === JSON.stringify(allowed),
      `${context}: ${key} extra ConfigHub objects differ from the allowed list`,
    );
  }

  const cleanup = spec.run?.cleanup ?? {};
  check(cleanup.result === "pass", `${context}: cleanup must pass for non-retained parity rig`);
}
