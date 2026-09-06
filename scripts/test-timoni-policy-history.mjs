import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDocs, repoRoot, sha256 } from "./lib/proof-common.mjs";
import { timoniHubReceiptPath, verifyTimoniPolicyHistory } from "./lib/timoni-policy-history.mjs";

const receiptText = readFileSync(join(repoRoot, "runs/timoni-redis-catalog-proof/confighub-receipt.yaml"), "utf8");
const policyText = readFileSync(join(repoRoot, "config-catalog/policies/catalog-standard.yaml"), "utf8");
const historical = verifyTimoniPolicyHistory(receiptText, policyText);
assert.equal(historical.binding, "legacy-receipt-digest");
assert.equal(historical.currentPolicyDefinition, "not-recorded");
assert.ok(historical.addedChecks.includes("workload-sensitive-env-secret-refs"));
assert.throws(() => verifyTimoniPolicyHistory(receiptText, policyText, { requireCurrent: true }), /fresh ConfigHub sync/);
const fabricated = parseDocs(receiptText)[0];
fabricated.spec.policy.checks.push("workload-sensitive-env-secret-refs");
assert.throws(() => verifyTimoniPolicyHistory(JSON.stringify(fabricated), policyText), /retained witness/);

// This constructs only a test fixture for the new receipt schema, not a live result.
const current = structuredClone(fabricated);
current.spec.policy.checks = parseDocs(policyText)[0].spec.baseline.checks.map((item) => item.trigger.split("/").at(-1)).sort();
current.spec.policy.definitionSha256 = sha256(policyText);
const policy = parseDocs(policyText)[0].spec;
current.spec.policy.liveBaseline = {
  filter: { ref: policy.baseline.filter, id: "test-filter", from: "Trigger", where: policy.baseline.filterWhere },
  triggers: policy.baseline.checks.map((item) => ({ ...policy.triggerDefinitions.find((row) => row.ref === item.trigger), effect: item.effect, validating: true })),
  spaces: ["timoni-redis-8-10-1-base", "timoni-redis-8-10-1-dev"].map((slug) => ({ slug, triggerFilterId: "test-filter", whereTrigger: null })),
};
assert.equal(verifyTimoniPolicyHistory(JSON.stringify(current), policyText, { requireCurrent: true }).binding, "policy-file-digest");
for (const [mutate, pattern] of [
  [(value) => { delete value.spec.policy.liveBaseline; }, /filter identity/],
  [(value) => { value.spec.policy.liveBaseline.filter.where = "Slug = 'other'"; }, /filter selector/],
  [(value) => { value.spec.policy.liveBaseline.triggers.pop(); }, /trigger definitions/],
  [(value) => { value.spec.policy.liveBaseline.triggers[0].functionName = "other"; }, /trigger definitions/],
  [(value) => { value.spec.policy.liveBaseline.triggers[0].description = "other"; }, /trigger definitions/],
  [(value) => { value.spec.policy.liveBaseline.triggers.find((item) => item.arguments?.length).arguments = []; }, /trigger definitions/],
  [(value) => { value.spec.policy.liveBaseline.triggers[0].event = "Apply"; }, /trigger definitions/],
  [(value) => { value.spec.policy.liveBaseline.triggers[0].toolchain = "other"; }, /trigger definitions/],
  [(value) => { value.spec.policy.liveBaseline.triggers[0].validating = false; }, /trigger definitions/],
  [(value) => { value.spec.policy.liveBaseline.spaces[0].triggerFilterId = "other"; }, /assignment/],
  [(value) => { value.spec.policy.liveBaseline.spaces[0].whereTrigger = "Slug = 'other'"; }, /assignment/],
  [(value) => { value.spec.policy.liveBaseline.spaces.pop(); }, /Space set/],
]) {
  const changed = structuredClone(current);
  mutate(changed);
  assert.throws(() => verifyTimoniPolicyHistory(JSON.stringify(changed), policyText), pattern);
}
current.spec.policy.checks.pop();
assert.throws(() => verifyTimoniPolicyHistory(JSON.stringify(current), policyText), /check set/);
current.spec.policy.definitionSha256 = "0".repeat(64);
assert.throws(() => verifyTimoniPolicyHistory(JSON.stringify(current), policyText), /definition digest/);
const scratch = mkdtempSync(join(tmpdir(), "timoni-receipt-selection-"));
try {
  assert.equal(timoniHubReceiptPath(scratch), "runs/timoni-redis-catalog-proof/confighub-receipt.yaml");
  const currentPath = timoniHubReceiptPath(scratch, { forWrite: true });
  assert.equal(currentPath, "runs/timoni-redis-catalog-proof/confighub-policy-bound-receipt.yaml");
  mkdirSync(join(scratch, "runs/timoni-redis-catalog-proof"), { recursive: true });
  writeFileSync(join(scratch, currentPath), "test fixture only");
  assert.equal(timoniHubReceiptPath(scratch), currentPath);
} finally { rmSync(scratch, { recursive: true, force: true }); }
console.log("Timoni policy history: exact legacy witness, visible drift, and fabricated extra-check refusal pass");
