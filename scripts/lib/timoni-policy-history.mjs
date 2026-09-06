import { check, parseDocs, sha256 } from "./proof-common.mjs";

// Exact receipt retained by #1589 at be59b87227f6af7a8252500d1bb9d1458e677103.
// This exception covers those historical bytes, not arbitrary seven-check receipts.
const legacyReceiptSha256 = "f505f6226dff94bca1d420ec00c000f1ce7823af0bc479c1d8b9ead47c020a27";

export function verifyTimoniPolicyHistory(receiptText, policyText, { requireCurrent = false } = {}) {
  const receipt = parseDocs(receiptText)[0];
  const policy = parseDocs(policyText)[0];
  check(receipt?.kind === "TimoniRedisConfigHubReceipt" && receipt.spec?.policy?.profile === "catalog-standard", "Timoni policy receipt identity differs");
  check(policy?.kind === "ApplyPolicyProfile" && policy.metadata?.name === "catalog-standard", "Timoni policy definition identity differs");
  const recorded = receipt.spec.policy.checks;
  const current = policy.spec.baseline.checks.map((item) => item.trigger.split("/").at(-1)).sort();
  check(Array.isArray(recorded) && recorded.every((item) => typeof item === "string") && new Set(recorded).size === recorded.length, "Timoni policy check names are invalid");
  const addedChecks = current.filter((item) => !recorded.includes(item));
  const removedChecks = recorded.filter((item) => !current.includes(item));
  const definitionSha256 = receipt.spec.policy.definitionSha256;
  if (definitionSha256) {
    check(definitionSha256 === sha256(policyText), "Timoni policy definition digest differs from current policy");
    check(!addedChecks.length && !removedChecks.length, "Timoni policy check set differs from its bound definition");
    return { binding: "policy-file-digest", currentPolicyDefinition: "recorded", addedChecks, removedChecks };
  }
  check(sha256(receiptText) === legacyReceiptSha256, "Timoni legacy policy receipt bytes differ from the retained witness");
  check(!requireCurrent, "Timoni historical receipt does not bind the current policy; a fresh ConfigHub sync receipt is required");
  return { binding: "legacy-receipt-digest", currentPolicyDefinition: "not-recorded", addedChecks, removedChecks };
}
