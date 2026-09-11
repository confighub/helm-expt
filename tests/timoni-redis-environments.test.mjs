import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseDocs, repoRoot, toYaml } from "../scripts/lib/proof-common.mjs";
import { objectSetSha256 } from "../scripts/transform-config-oci.mjs";
import { verifyReceipt } from "../scripts/run-timoni-redis-environments.mjs";

const receiptRelativePath = "runs/timoni-redis-environments/receipt.json";
const fixtureRelativePath = "examples/timoni/redis-8-10-1";
const hash = (value) => createHash("sha256").update(value).digest("hex");

function copyFixture() {
  const root = mkdtempSync(join(tmpdir(), "timoni-redis-environments-test-"));
  cpSync(join(repoRoot, fixtureRelativePath), join(root, fixtureRelativePath), { recursive: true });
  cpSync(join(repoRoot, "runs/timoni-redis-environments"), join(root, "runs/timoni-redis-environments"), { recursive: true });
  return root;
}

function outputPath(root, name) {
  return join(root, "runs/timoni-redis-environments", `${name}.yaml`);
}

function rewriteObjects(root, receipt, name, objects) {
  const text = `${objects.map((object) => toYaml(object)).join("\n---\n")}\n`;
  writeFileSync(outputPath(root, name), text);
  const entry = receipt.spec.environments.find((item) => item.name === name);
  entry.objectCount = objects.length;
  entry.outputSha256 = hash(text);
  entry.objectSetSha256 = objectSetSha256(objects);
}

function expectRejected(mutator) {
  const root = copyFixture();
  try {
    const receipt = JSON.parse(readFileSync(join(root, receiptRelativePath), "utf8"));
    mutator(root, receipt);
    assert.throws(() => verifyReceipt(receipt, { root }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function runEnvironmentTests() {
  const root = copyFixture();
  try {
    const receipt = JSON.parse(readFileSync(join(root, receiptRelativePath), "utf8"));
    assert.doesNotThrow(() => verifyReceipt(receipt, { root }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  expectRejected((root, receipt) => {
    const objects = parseDocs(readFileSync(outputPath(root, "production"), "utf8"));
    const deployment = objects.find((object) => object.kind === "Deployment" && object.metadata?.name === "redis-replica");
    deployment.spec.template.spec.containers[0].image = "redis:changed";
    rewriteObjects(root, receipt, "production", objects);
  });

  expectRejected((root, receipt) => {
    const objects = parseDocs(readFileSync(outputPath(root, "production"), "utf8"));
    objects[1] = structuredClone(objects[0]);
    rewriteObjects(root, receipt, "production", objects);
  });

  expectRejected((root, receipt) => {
    const objects = parseDocs(readFileSync(outputPath(root, "production"), "utf8"));
    const extra = structuredClone(objects[0]);
    extra.metadata.name = "redis-extra";
    rewriteObjects(root, receipt, "production", [...objects, extra]);
  });

  expectRejected((root, receipt) => {
    const valuesPath = join(root, fixtureRelativePath, "environments/production.cue");
    const values = readFileSync(valuesPath, "utf8").replace("replicas: 2", "replicas: 3");
    writeFileSync(valuesPath, values);
    receipt.spec.environments.find((item) => item.name === "production").valuesSha256 = hash(values);
  });

  for (const mutate of [
    (receipt) => { receipt.spec.source.version = "8.10.2"; },
    (receipt) => { receipt.spec.source.module = "localhost/redis"; },
    (receipt) => { receipt.spec.processor.version = "0.34.0"; },
    (receipt) => { receipt.status.materialization = "watch"; },
    (receipt) => { receipt.status.workloadHealth = "pass"; },
    (receipt) => { receipt.spec.selection.namespace = "elsewhere"; },
    (receipt) => { receipt.spec.environments[0].objectCount = 6; },
    (receipt) => { receipt.spec.expectedDelta[0].after = 3; },
  ]) {
    expectRejected((_root, receipt) => mutate(receipt));
  }
  return true;
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  runEnvironmentTests();
  console.log("Timoni Redis environment receipt tamper checks passed");
}
