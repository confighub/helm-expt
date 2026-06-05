import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, listFiles, readYaml, repoRoot } from "./lib/proof-common.mjs";

const receiptRoot = join(repoRoot, "runs", "derived-variant-target-bound");
const receipts = listFiles(receiptRoot).filter((file) => /receipt\.ya?ml$/.test(file));

check(receipts.length >= 1, "expected at least one target-bound derived variant receipt");

for (const receiptPath of receipts) {
  const receipt = readYaml(receiptPath);
  const spec = receipt.spec ?? {};
  const context = `${spec.source?.chart ?? "unknown"}@${spec.source?.chartVersion ?? "unknown"} / ${spec.create?.variant ?? "unknown"}`;

  check(receipt.apiVersion === "helm-expt.confighub.com/v1alpha1", `${context}: apiVersion mismatch`);
  check(receipt.kind === "TargetBoundDerivedVariantReceipt", `${context}: kind mismatch`);
  check(["pass", "blocked", "watch"].includes(spec.result), `${context}: invalid result`);
  check(Boolean(spec.source?.package), `${context}: missing package path`);
  check(existsSync(join(repoRoot, spec.source.package)), `${context}: package path does not exist`);
  check(Boolean(spec.source?.base), `${context}: missing base`);
  check(Boolean(spec.source?.sourceSpace), `${context}: missing source space`);
  check(Boolean(spec.create?.downstreamSpace), `${context}: missing downstream space`);
  check(Boolean(spec.target?.slug), `${context}: missing target slug`);

  if (spec.result === "pass") verifyPass(spec, context);
  if (spec.result === "blocked") verifyBlocked(spec, context);
}

console.log(`verified ${receipts.length} target-bound derived variant receipt(s)`);

function verifyPass(spec, context) {
  check(spec.create?.result === "pass", `${context}: variant create must pass`);
  check(spec.create?.command?.includes("cub variant create"), `${context}: create command must use cub variant create`);
  check(spec.create?.command?.includes(" --target "), `${context}: create command must include --target`);
  check(spec.target?.bound === true, `${context}: target must be bound`);
  check(Boolean(spec.target?.targetID), `${context}: missing target ID`);
  check(spec.clone?.unitCount >= 1, `${context}: clone unit count missing`);
  check(spec.clone?.workloadUnitCount >= 1, `${context}: workload unit count missing`);
  check(spec.clone?.targetBoundUnitCount === spec.clone?.unitCount, `${context}: all cloned units should carry target ID`);
  check(spec.clone?.targetBoundWorkloadUnitCount === spec.clone?.workloadUnitCount, `${context}: all workload units should carry target ID`);
  check(spec.clone?.upstreamLinkedWorkloadUnitCount === spec.clone?.workloadUnitCount, `${context}: workload upstream links mismatch`);

  check(spec.apply?.result === "pass", `${context}: apply must pass`);
  check(spec.apply?.appliedUnitCount === spec.clone?.workloadUnitCount, `${context}: applied unit count mismatch`);
  check((spec.apply?.excludedUnits ?? []).includes("installer-record"), `${context}: installer-record exclusion must be explicit`);

  check(spec.argo?.result === "pass", `${context}: Argo result must pass`);
  check(spec.argo?.syncStatus === "Synced", `${context}: Argo sync status mismatch`);
  check(spec.argo?.healthStatus === "Healthy", `${context}: Argo health status mismatch`);
  check(spec.argo?.resourceCount === spec.clone?.workloadUnitCount, `${context}: Argo resource count mismatch`);
  check(/^sha256:[a-f0-9]{64}$/.test(spec.argo?.revision ?? ""), `${context}: Argo revision must be an OCI digest`);

  check(spec.runtime?.result === "pass", `${context}: runtime result must pass`);
  check(spec.runtime?.deployment?.ready === "1/1", `${context}: deployment readiness mismatch`);
  check(spec.runtime?.deployment?.rollout === "pass", `${context}: deployment rollout must pass`);
  check(spec.runtime?.pod?.status === "Running", `${context}: pod must be Running`);
  check(spec.runtime?.service?.type === "ClusterIP", `${context}: service type mismatch`);

  check(spec.review?.noHelmRerender === true, `${context}: receipt must assert no Helm rerender`);
  check(spec.review?.sameInstallShape === true, `${context}: receipt must assert same install shape`);

  for (const [name, digest] of Object.entries(spec.evidenceSHA256 ?? {})) {
    check(/^[a-f0-9]{64}$/.test(digest), `${context}: invalid evidence digest for ${name}`);
  }

  check(spec.cleanup?.result === "pass", `${context}: cleanup must pass`);
}

function verifyBlocked(spec, context) {
  check(Array.isArray(spec.blockers), `${context}: blocked receipt must include blockers`);
  check(spec.blockers.length > 0, `${context}: blocked receipt must include at least one blocker`);
  for (const blocker of spec.blockers) {
    check(Boolean(blocker.id), `${context}: blocker missing id`);
    check(Boolean(blocker.reason), `${context}: blocker missing reason`);
    check(Boolean(blocker.requiredCapability), `${context}: blocker missing required capability`);
  }
  check(Array.isArray(spec.routeForward), `${context}: blocked receipt must include routeForward`);
  check(spec.routeForward.length > 0, `${context}: blocked receipt routeForward must not be empty`);
  check(spec.target?.bound !== true, `${context}: blocked receipt must not claim target binding`);
  check(spec.apply?.result !== "pass", `${context}: blocked receipt must not claim apply pass`);
  check(spec.argo?.result !== "pass", `${context}: blocked receipt must not claim Argo pass`);
  check(spec.runtime?.result !== "pass", `${context}: blocked receipt must not claim runtime pass`);
}
