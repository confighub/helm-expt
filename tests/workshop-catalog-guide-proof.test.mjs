import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateEvidence } from "../scripts/run-workshop-catalog-guide-proof.mjs";

const receipt = JSON.parse(readFileSync(new URL("../data/workshop-catalog-guide-proof/receipt.json", import.meta.url), "utf8"));
const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const invalid = (mutate, pattern) => { const copy = structuredClone(receipt); mutate(copy); assert.throws(() => validateEvidence(copy), pattern); };

test("generated exact lookup proof validates", () => assert.equal(validateEvidence(receipt), true));
test("forged pass bytes remain bound to the captured output", () => invalid((r) => { r.steps.exact.stdoutSha256 = sha(Buffer.from(JSON.stringify({ status: "found", record: {} }))); }, /success\.json output bytes are stale/));
test("changed input is rejected", () => invalid((r) => { r.inputs[0].sha256 = "sha256:" + "0".repeat(64); }, /stale input/));
test("duplicate or substituted input pins are rejected before reads", () => invalid((r) => { r.inputs[1] = { ...r.inputs[0] }; }, /proof input manifest paths changed/));
test("wrong refusal exit is rejected", () => invalid((r) => { r.steps.mismatch.exitCode = 0; }, /mismatch command did not complete/));
test("refusal output cannot be changed into a substitute record", () => invalid((r) => { r.outputs.mismatch = r.outputs.exact; }, /proof output paths changed/));

function alteredOutput(key, mutate, pattern) {
  const copy = structuredClone(receipt);
  const output = JSON.parse(readFileSync(new URL(`../${copy.outputs[key]}`, import.meta.url), "utf8"));
  mutate(output);
  const bytes = Buffer.from(JSON.stringify(output));
  copy.steps[key].stdoutSha256 = sha(bytes);
  assert.throws(() => validateEvidence(copy, { outputBytes: { [key]: bytes } }), pattern);
}
test("a forged destination pass fails even with a recomputed output hash", () => {
  alteredOutput("exact", (out) => { out.record.spec.assessment.stages.find((s) => s.id === "destination").resultState = "pass"; }, /record differs/);
});
test("a refusal with a substitute record fails even with a recomputed hash", () => {
  alteredOutput("mismatch", (out) => { out.record = { metadata: { name: "substitute" } }; }, /mismatch returned a record/);
});
test("a refusal cannot bind a different Catalog", () => {
  alteredOutput("mismatch", (out) => { out.catalog.sha256 = "sha256:" + "0".repeat(64); }, /mismatch catalog\/schema binding changed/);
});
