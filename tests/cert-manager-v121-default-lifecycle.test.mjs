import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseDocs, readYaml, sha256 } from "../scripts/lib/proof-common.mjs";
import { verifyReceipt } from "../scripts/run-cert-manager-v121-default-lifecycle.mjs";

const recipe = "recipes/jetstack/cert-manager/v1.21.0";
const contractPath = "examples/cert-manager-v121-default-lifecycle/contract.yaml";
const contract = readYaml(contractPath);
const spec = contract.spec;

const receiptRoot = "runs/lifecycle-observations/cert-manager-v121-default/attempts/companion-contract";
const receipt = readYaml(`${receiptRoot}/receipt.yaml`);

test("the exact v1.21.0 contract sources remain bound to the retained receipt", () => {
  assert.equal(sha256(readFileSync(spec.renderedObjectSet.path, "utf8")), spec.renderedObjectSet.sha256);
  assert.equal(sha256(readFileSync(spec.externalCRDs.source.path, "utf8")), spec.externalCRDs.source.sha256);
  assert.equal(sha256(readFileSync(spec.startupApiCheck.source.payload, "utf8")), spec.startupApiCheck.source.payloadSHA256);
  assert.doesNotThrow(() => verifyReceipt(receipt, receiptRoot));
});

test("the production receipt verifier rejects tampered bindings, readiness, and evidence", () => {
  for (const [label, mutate] of [
    ["contract binding", (candidate) => { candidate.spec.contract.sha256 = "0".repeat(64); }],
    ["deployment readiness", (candidate) => { candidate.spec.checks = candidate.spec.checks.filter((check) => check.name !== "deployment-ready:cert-manager-webhook"); }],
    ["recorded evidence", (candidate) => { candidate.spec.checks.find((check) => check.name === "startupapicheck-complete").evidenceSHA256 = "0".repeat(64); }],
  ]) {
    const candidate = structuredClone(receipt);
    mutate(candidate);
    assert.throws(() => verifyReceipt(candidate, receiptRoot), undefined, label);
  }
});

test("the extracted startup payload retains the four reviewed source objects", () => {
  const docs = parseDocs(readFileSync(spec.startupApiCheck.source.payload, "utf8"));
  assert.equal(docs.length, 4);
  assert.ok(docs.every((doc) => doc.metadata?.annotations?.["helm.sh/hook"] === "post-install"));
  const job = docs.find((doc) => doc.kind === "Job");
  assert.equal(job?.metadata?.name, "cert-manager-startupapicheck");
  assert.deepEqual(job?.spec?.template?.spec?.containers?.[0]?.args, ["check", "api", "--wait=1m", "-v"]);
});

test("the retained passing attempt passes the real lifecycle verifier", () => {
  assert.doesNotThrow(() => verifyReceipt(receipt, receiptRoot));
});

test("the default guide matches current server ingestion semantics", () => {
  const guide = readFileSync("data/certified-bundles/guides/catalog/cert-manager-v1.21.0-default/space-guide.md", "utf8");
  assert.match(guide, /current server creates resource Units/);
  assert.doesNotMatch(guide, /--granularity per-file/);
});
