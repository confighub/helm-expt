import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseDocs, readYaml, sha256 } from "../scripts/lib/proof-common.mjs";

const recipe = "recipes/jetstack/cert-manager/v1.21.0";
const contractPath = `${recipe}/publication/default-lifecycle-contract.yaml`;
const contract = readYaml(contractPath);
const spec = contract.spec;

const crds = [
  "certificaterequests.cert-manager.io",
  "certificates.cert-manager.io",
  "challenges.acme.cert-manager.io",
  "clusterissuers.cert-manager.io",
  "issuers.cert-manager.io",
  "orders.acme.cert-manager.io",
];

function validate(value) {
  assert.equal(value.kind, "LifecycleCompanionContract");
  assert.equal(value.spec.chart, "jetstack/cert-manager");
  assert.equal(value.spec.version, "v1.21.0");
  assert.equal(value.spec.base, "default");
  assert.equal(value.spec.status, "declared-not-observed");
  assert.equal(value.spec.externalCRDs.ownership, "external-to-default-base");
  assert.equal(value.spec.externalCRDs.source.path, `${recipe}/revisions/crds-enabled/r001/rendered/release-objects.yaml`);
  assert.equal(value.spec.externalCRDs.apply.mode, "server-side");
  assert.equal(value.spec.externalCRDs.apply.waitFor, "every named definition reports the Established condition");
  assert.deepEqual([...value.spec.externalCRDs.names].sort(), crds);
  assert.equal(value.spec.startupApiCheck.execution.mode, "manual-until-runtime-observed");
  assert.equal(value.spec.startupApiCheck.execution.after.includes("external-crds-established"), true);
  assert.equal(value.spec.startupApiCheck.execution.after.includes("default-base-applied"), true);
}

test("the default lifecycle contract remains an exact, unobserved v1.21.0 companion", () => {
  validate(contract);
  assert.equal(sha256(readFileSync(spec.renderedObjectSet.path, "utf8")), spec.renderedObjectSet.sha256);
  assert.equal(sha256(readFileSync(spec.externalCRDs.source.path, "utf8")), spec.externalCRDs.source.sha256);
  assert.equal(sha256(readFileSync(spec.startupApiCheck.source.payload, "utf8")), spec.startupApiCheck.source.payloadSHA256);
});

test("contract tampering cannot turn external CRDs or the startup check into an implicit claim", () => {
  for (const [label, mutate] of [
    ["observed status", (candidate) => { candidate.spec.status = "observed"; }],
    ["in-bundle CRD ownership", (candidate) => { candidate.spec.externalCRDs.ownership = "owned-by-default-base"; }],
    ["missing Established wait", (candidate) => { candidate.spec.externalCRDs.apply.waitFor = "none"; }],
    ["automatic startup execution", (candidate) => { candidate.spec.startupApiCheck.execution.mode = "automatic"; }],
  ]) {
    const candidate = structuredClone(contract);
    mutate(candidate);
    assert.throws(() => validate(candidate), undefined, label);
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

test("the live runner keeps the namespace, retry, sanitization, and evidence checks", () => {
  const runner = readFileSync("scripts/run-cert-manager-v121-default-lifecycle.mjs", "utf8");
  for (const required of [
    '"namespace-created"',
    "already exists; refuse to overwrite retained lifecycle evidence",
    "kindest/node:v1.30.0",
    "expectedStageSources",
    'replaceAll(repoRoot, "<workspace>")',
    "execution/kubeconfig",
  ]) assert.match(runner, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("the retained passing attempt passes the real lifecycle verifier", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/run-cert-manager-v121-default-lifecycle.mjs", "--verify", "--output", "runs/lifecycle-observations/cert-manager-v121-default/attempts/namespace-fix"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verified cert-manager v1\.21\.0 default lifecycle observation/);
});
