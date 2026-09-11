import { createHash } from "node:crypto";

const LEGS = ["regularHelm", "configHubKubectlApply", "configHubOciArgo"];

// These three retained receipts predate per-leg namespace recording. Only their
// exact paths and bytes qualify; this preserves history, not target authenticity.
export const LEGACY_MISSING_NAMESPACE_WITNESSES = new Map([
  ["runs/live-helm-confighub-compare/bitnami-nginx-http-clusterip/receipt.yaml", "adeb080ee26eee60d95b6e7bbad17545fe60a543059854c3836112862a256e81"],
  ["runs/live-helm-confighub-compare/bitnami-redis-default/receipt.yaml", "f9914c3076766ad365c0951e7f2ade7bf55975eac0ab492ba6be4844e5a9dfcb"],
  ["runs/live-helm-confighub-compare/metrics-server-metrics-server-default/receipt.yaml", "7452631eb68d1bf16d519d374638118b7c6ac5a95e237c808f8c634b3a681d54"],
]);

export function isLegacyNamespaceWitness(path, bytes) {
  const expected = LEGACY_MISSING_NAMESPACE_WITNESSES.get(path);
  return expected !== undefined && createHash("sha256").update(bytes).digest("hex") === expected;
}

export function verifyPassingRunBinding(spec, context = "live parity receipt", { allowLegacyMissingNamespaces = false } = {}) {
  const rig = spec.run?.rig;
  fail(nonempty(rig), `${context}: missing run rig`);
  fail(spec.run?.kubeContext === `kind-${rig}`, `${context}: kube context does not match rig`);
  const legNamespaces = spec.run?.legNamespaces;
  const allNamespacesAbsent = legNamespaces === undefined
    && LEGS.every((leg) => spec.legs?.[leg]?.namespace === undefined);
  if (allowLegacyMissingNamespaces && allNamespacesAbsent) return;
  fail(legNamespaces && typeof legNamespaces === "object" && !Array.isArray(legNamespaces), `${context}: missing leg namespaces`);
  for (const leg of LEGS) {
    const namespace = legNamespaces[leg];
    fail(nonempty(namespace), `${context}: ${leg} missing run namespace`);
    fail(nonempty(spec.legs?.[leg]?.namespace), `${context}: ${leg} missing leg namespace`);
    fail(namespace === spec.legs[leg].namespace, `${context}: ${leg} run and leg namespaces differ`);
  }
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(condition, message) {
  if (!condition) throw new Error(message);
}
