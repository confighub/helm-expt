import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocs, repoRoot, sha256 } from "./lib/proof-common.mjs";
import { verifyTimoniPolicyHistory } from "./lib/timoni-policy-history.mjs";

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
assert.equal(verifyTimoniPolicyHistory(JSON.stringify(current), policyText, { requireCurrent: true }).binding, "policy-file-digest");
current.spec.policy.checks.pop();
assert.throws(() => verifyTimoniPolicyHistory(JSON.stringify(current), policyText), /check set/);
current.spec.policy.definitionSha256 = "0".repeat(64);
assert.throws(() => verifyTimoniPolicyHistory(JSON.stringify(current), policyText), /definition digest/);
console.log("Timoni policy history: exact legacy witness, visible drift, and fabricated extra-check refusal pass");
