import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import { check, listFiles, readYaml, repoRoot } from "./lib/proof-common.mjs";

const root = join(repoRoot, "runs", "live-helm-confighub-compare");
const receipts = listFiles(root).filter((file) => /(?:^|\/)receipt\.(json|ya?ml)$/.test(file));
const trackedFiles = new Set(
  execFileSync("git", ["ls-files", "runs/live-helm-confighub-compare"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .map((file) => join(repoRoot, file)),
);
const targetFactEvidence = listFiles(root).filter(
  (file) => trackedFiles.has(file) && /target-facts-[^/]+\.ya?ml$/.test(file),
);
const trackedTlsKeys = [...trackedFiles].filter(
  (file) => existsSync(file) && /target-facts-tls[^/]*\.key$/.test(file),
);

check(receipts.length >= 1, "expected at least one live Helm-vs-ConfigHub parity receipt");
check(
  trackedTlsKeys.length === 0,
  `tracked live-parity TLS key files are forbidden: ${trackedTlsKeys.map((file) => relative(repoRoot, file)).join(", ")}`,
);

for (const evidencePath of targetFactEvidence) {
  check(
    !readFileSync(evidencePath, "utf8").includes("-----BEGIN PRIVATE KEY-----"),
    `${relative(repoRoot, evidencePath)} contains a private key; committed target-fact evidence must redact Secret values`,
  );
}

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
    verifyRuntime(legs[leg]?.runtime, `${context}: ${leg}`);
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

function verifyRuntime(runtime, context) {
  check(Boolean(runtime), `${context} missing runtime proof`);

  if (Array.isArray(runtime.checks)) {
    check(runtime.checks.length > 0, `${context} runtime checks must not be empty`);
    for (const item of runtime.checks) {
      check(item.result === "pass", `${context} runtime check did not pass: ${item.name ?? "unnamed"}`);
    }
  } else if (runtime.result) {
    check(runtime.result === "pass", `${context} runtime result mismatch`);
    check((runtime.notReady ?? []).length === 0, `${context} has not-ready pods`);
  } else {
    check(runtime.ready === "1/1", `${context} runtime readiness mismatch`);
    check(runtime.podStatus === "Running", `${context} pod status mismatch`);
  }

  if (runtime.redisPong) {
    check(runtime.redisPong.result === "pass", `${context} Redis PING must pass`);
    check(Boolean(runtime.redisPong.evidenceSHA256), `${context} Redis PING missing evidence hash`);
  }
}
