import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import test from "node:test";
import { validateAdmission } from "../scripts/verify-workshop-guide-admission.mjs";
const manifest = JSON.parse(readFileSync("data/workshop-guides/admissions/catalog-inspection-v1.json", "utf8"));
const invalid = (mutate, pattern) => { const copy = structuredClone(manifest); mutate(copy); assert.throws(() => validateAdmission(copy), pattern); };
test("draft exact lookup admission validates against retained proof", () => assert.equal(validateAdmission(manifest), true));
test("wrong story mapping is rejected", () => invalid((m) => { m.storyId = "S-E2"; }, /Guide\/story mapping changed/));
test("empty goal and prerequisites are rejected", () => { invalid((m) => { m.goal = ""; }, /goal must be nonempty/); invalid((m) => { m.prerequisites = [""]; }, /prerequisites must be nonempty/); });
test("materialization and live claims cannot be upgraded", () => { invalid((m) => { m.stages[1].state = "completed"; }, /stage mapping overclaims/); invalid((m) => { m.stages[4].state = "completed"; }, /stage mapping overclaims/); });
test("publication owner and approval cannot authorize this draft", () => { invalid((m) => { m.editorial.ownerAssigned = true; }, /unassigned owner/); invalid((m) => { m.publication.approvalReference = "approval-1"; }, /publication must remain blocked/); });
test("swapped paths are rejected even when both files exist", () => invalid((m) => { [m.exercise.successOutputPath, m.exercise.refusalOutputPath] = [m.exercise.refusalOutputPath, m.exercise.successOutputPath]; }, /exercise successOutputPath changed/));
test("proof step and output links must remain exact", () => invalid((m) => { m.outcomes.success.proofStep = "mismatch"; }, /success outcome changed/));
test("extra manifest fields are rejected", () => invalid((m) => { m.extra = true; }, /admission fields changed/));

test("JSON field order does not change admission", () => {
  const copy = structuredClone(manifest);
  copy.outcomes.success = Object.fromEntries(Object.entries(copy.outcomes.success).reverse());
  copy.stages = copy.stages.map(stage => Object.fromEntries(Object.entries(stage).reverse()));
  assert.equal(validateAdmission(copy), true);
});

function withProofFixture(change, expected) {
  const rootDir = mkdtempSync(join(tmpdir(), "guide-admission-"));
  const receipt = JSON.parse(readFileSync(manifest.exercise.proofReceiptPath));
  const paths = new Set([...receipt.inputs.map(input => input.path), ...Object.values(receipt.outputs), manifest.exercise.proofReceiptPath, "data/workshop-guides/portfolio.json"]);
  try {
    for (const path of paths) { mkdirSync(dirname(join(rootDir, path)), { recursive:true }); copyFileSync(path, join(rootDir, path)); }
    change(rootDir, receipt);
    assert.throws(() => validateAdmission(manifest, { rootDir }), expected);
  } finally { rmSync(rootDir, { recursive:true, force:true }); }
}
test("admission refuses a changed maintained CLI pin", () => withProofFixture(rootDir => {
  writeFileSync(join(rootDir, manifest.exercise.lookupCliPath), "// changed source\n", { flag:"a" });
}, /stale input/));
test("admission refuses a forged record in the refusal even with a new output hash", () => withProofFixture((rootDir, receipt) => {
  const output = JSON.parse(readFileSync(join(rootDir, manifest.exercise.refusalOutputPath)));
  output.record = { metadata: { name: manifest.source.recordName } };
  const bytes = Buffer.from(JSON.stringify(output) + "\n");
  writeFileSync(join(rootDir, manifest.exercise.refusalOutputPath), bytes);
  receipt.steps.mismatch.stdoutSha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  writeFileSync(join(rootDir, manifest.exercise.proofReceiptPath), JSON.stringify(receipt));
}, /refusal|mismatch/));
