import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, parseDocs, repoRoot, sha256 } from "./proof-common.mjs";

export function timoniHubReceiptPath(root = repoRoot, { forWrite = false } = {}) {
  const current = "runs/timoni-redis-catalog-proof/confighub-policy-bound-receipt.yaml";
  return forWrite || existsSync(join(root, current)) ? current : "runs/timoni-redis-catalog-proof/confighub-receipt.yaml";
}

export function verifyTimoniLiveBaseline(policyText, observed) {
  const spec = parseDocs(policyText)[0].spec;
  const baseline = spec.baseline;
  check(observed?.filter?.ref === baseline.filter && observed.filter.from === "Trigger", "Timoni live policy filter identity differs");
  check(typeof observed.filter.id === "string" && observed.filter.id.length > 0, "Timoni live policy filter ID is missing");
  check(observed.filter.where === baseline.filterWhere, "Timoni live policy filter selector differs");
  const normalize = (trigger) => ({
    ref: trigger.ref, event: trigger.event, toolchain: trigger.toolchain,
    displayName: trigger.displayName, description: trigger.description,
    functionName: trigger.functionName,
    arguments: [...(trigger.arguments ?? [])].map((arg) => ({ name: arg.name, value: arg.value })).sort((a, b) => a.name.localeCompare(b.name)),
    effect: trigger.effect, validating: trigger.validating,
  });
  const expected = baseline.checks.map((item) => {
    const definition = spec.triggerDefinitions.find((row) => row.ref === item.trigger);
    check(definition, `Timoni policy definition missing for ${item.trigger}`);
    return normalize({ ...definition, effect: item.effect, validating: true });
  }).sort((a, b) => a.ref.localeCompare(b.ref));
  check(Array.isArray(observed.triggers), "Timoni live policy triggers are missing");
  const actual = observed.triggers.map(normalize).sort((a, b) => a.ref.localeCompare(b.ref));
  check(JSON.stringify(actual) === JSON.stringify(expected), "Timoni live policy trigger definitions differ");
  const expectedSpaces = ["timoni-redis-8-10-1-base", "timoni-redis-8-10-1-dev"];
  check(Array.isArray(observed.spaces) && JSON.stringify(observed.spaces.map((space) => space.slug).sort()) === JSON.stringify(expectedSpaces), "Timoni live policy Space set differs");
  for (const space of observed.spaces) {
    check(space.triggerFilterId === observed.filter.id && [null, undefined, ""].includes(space.whereTrigger), `Timoni live policy assignment differs for ${space.slug}`);
  }
}

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
    verifyTimoniLiveBaseline(policyText, receipt.spec.policy.liveBaseline);
    return { binding: "policy-file-digest", currentPolicyDefinition: "recorded", addedChecks, removedChecks };
  }
  check(sha256(receiptText) === legacyReceiptSha256, "Timoni legacy policy receipt bytes differ from the retained witness");
  check(!requireCurrent, "Timoni historical receipt does not bind the current policy; a fresh ConfigHub sync receipt is required");
  return { binding: "legacy-receipt-digest", currentPolicyDefinition: "not-recorded", addedChecks, removedChecks };
}
