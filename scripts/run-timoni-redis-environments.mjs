#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, resolve } from "node:path";
import { parseDocs, readYaml, repoRoot } from "./lib/proof-common.mjs";
import { objectSetSha256 } from "./transform-config-oci.mjs";

const fixture = join(repoRoot, "examples/timoni/redis-8-10-1");
const outputDir = join(repoRoot, "runs/timoni-redis-environments");
const sourceLockPath = join(fixture, "source-lock.yaml");
const names = ["development", "production"];
const valuePaths = Object.fromEntries(names.map((name) => [name, join(fixture, "environments", `${name}.cue`)]));
const outputPaths = Object.fromEntries(names.map((name) => [name, join(outputDir, `${name}.yaml`)]));
const receiptJsonPath = join(outputDir, "receipt.json");

export function verifyReceipt(receipt, { root = repoRoot } = {}) {
  fail(typeof receipt === "object" && receipt?.kind === "TimoniRedisEnvironmentReceipt", "receipt kind");
  fail(receipt.apiVersion === "catalog.confighub.com/v1alpha1", "receipt apiVersion");
  const lockPath = join(root, "examples/timoni/redis-8-10-1/source-lock.yaml");
  fail(receipt.spec?.sourceLock?.path === "examples/timoni/redis-8-10-1/source-lock.yaml", "source lock path");
  fail(receipt.spec.sourceLock.sha256 === hash(readFileSync(lockPath)), "source lock hash");
  const lock = readYaml(lockPath);
  assert.deepEqual(receipt.spec.source, lock.spec.source, "source identity");
  assert.deepEqual(receipt.spec.selection, { instance: lock.spec.selection.instance, namespace: lock.spec.selection.namespace, maskSecrets: true }, "selection identity");
  fail(lock.spec.selection.maskSecrets === true, "source maskSecrets selection");
  fail(receipt.spec.processor?.name === "timoni" && receipt.spec.processor?.version === lock.spec.processor.version, "processor identity");
  fail(Array.isArray(receipt.spec.environments) && receipt.spec.environments.length === 2, "environment count");
  const byName = new Map(receipt.spec.environments.map((entry) => [entry.name, entry]));
  fail(names.every((name) => byName.has(name)), "fixed environment names");
  for (const name of names) {
    const entry = byName.get(name);
    fail(entry.valuesPath === `examples/timoni/redis-8-10-1/environments/${name}.cue`, `${name} values path`);
    fail(entry.outputPath === `runs/timoni-redis-environments/${name}.yaml`, `${name} output path`);
    fail(entry.valuesSha256 === hash(readFileSync(join(root, entry.valuesPath))), `${name} values hash`);
    const values = readFileSync(join(root, entry.valuesPath), "utf8");
    fail(values === (name === "development" ? "package main\n\nvalues: {}\n" : "package main\n\nvalues: readonly: replicas: 2\n"), `${name} fixed values`);
    const text = readFileSync(join(root, entry.outputPath), "utf8");
    fail(entry.outputSha256 === hash(text), `${name} output hash`);
    const objects = parseDocs(text);
    fail(objects.length === 7 && entry.objectCount === 7, `${name} object count`);
    fail(entry.deltaFrom === (name === "production" ? "development" : null), `${name} delta relation`);
    fail(entry.objectSetSha256 === objectSetSha256(objects), `${name} object hash`);
    if (name === "development") fail(text === readFileSync(join(root, "examples/timoni/redis-8-10-1/rendered/release-objects.yaml"), "utf8"), "development historical bytes");
  }
  const dev = parseDocs(readFileSync(join(root, byName.get("development").outputPath), "utf8"));
  const prod = parseDocs(readFileSync(join(root, byName.get("production").outputPath), "utf8"));
  const expectedProduction = structuredClone(dev);
  const replicaDeployments = expectedProduction.filter((object) => object.kind === "Deployment" && object.metadata?.name === "redis-replica");
  fail(replicaDeployments.length === 1, "unique replica deployment");
  fail(replicaDeployments[0].spec?.replicas === 1, "baseline replica count");
  replicaDeployments[0].spec.replicas = 2;
  assert.deepEqual(sortObjects(prod), sortObjects(expectedProduction), "production full object delta");
  const expectedDelta = [{ path: "Deployment/redis-replica/spec.replicas", before: 1, after: 2 }];
  fail(JSON.stringify(receipt.spec.expectedDelta) === JSON.stringify(expectedDelta), "declared production delta");
  assert.deepEqual(receipt.status, { materialization: "pass", kubernetesSchemaValidation: "not-run",
    kubernetesApply: "not-run", lifecycleExecution: "not-run", configHubDelivery: "not-run" }, "status boundary");
  return true;
}

function record() {
  const lock = readYaml(sourceLockPath);
  const timoni = process.env.TIMONI_BIN ?? "timoni";
  let version;
  try { version = JSON.parse(execFileSync(timoni, ["version", "-o", "json"], { cwd: repoRoot, encoding: "utf8" })).client; }
  catch (error) { throw new Error(`cannot read Timoni version: ${error.message}`); }
  fail(version === lock.spec.processor.version, "Timoni processor version");
  mkdirSync(outputDir, { recursive: true });
  for (const name of names) {
    const args = ["-n", lock.spec.selection.namespace, "build", lock.spec.selection.instance, lock.spec.source.module, "-v", lock.spec.source.version, "-d", lock.spec.source.manifestDigest, "-f", valuePaths[name], "--mask-secrets"];
    const text = execFileSync(timoni, args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 200 * 1024 * 1024 });
    writeFileSync(outputPaths[name], text.endsWith("\n") ? text : `${text}\n`);
  }
  const receipt = makeReceipt(lock, version);
  verifyReceipt(receipt);
  writeFileSync(receiptJsonPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`recorded Timoni Redis environments -> ${relative(repoRoot, outputDir)}`);
}

export function verifyTimoniRedisEnvironments() {
  const receipt = JSON.parse(readFileSync(receiptJsonPath, "utf8"));
  verifyReceipt(receipt);
  console.log("verified Timoni Redis environment receipt");
}

export async function testTimoniRedisEnvironments() {
  const { runEnvironmentTests } = await import("../tests/timoni-redis-environments.test.mjs");
  runEnvironmentTests();
}

function makeReceipt(lock, processorVersion) {
  return { apiVersion: "catalog.confighub.com/v1alpha1", kind: "TimoniRedisEnvironmentReceipt", metadata: { name: "timoni-redis-8-10-1-environments" }, spec: {
    sourceLock: { path: "examples/timoni/redis-8-10-1/source-lock.yaml", sha256: hash(readFileSync(sourceLockPath)) },
    source: structuredClone(lock.spec.source),
    selection: { instance: lock.spec.selection.instance, namespace: lock.spec.selection.namespace, maskSecrets: true },
    processor: { name: "timoni", version: processorVersion },
    environments: names.map((name) => { const text = readFileSync(outputPaths[name], "utf8"); const objects = parseDocs(text); return { name, valuesPath: `examples/timoni/redis-8-10-1/environments/${name}.cue`, valuesSha256: hash(readFileSync(valuePaths[name])), outputPath: `runs/timoni-redis-environments/${name}.yaml`, outputSha256: hash(text), objectCount: objects.length, objectSetSha256: objectSetSha256(objects), deltaFrom: name === "production" ? "development" : null }; }),
    expectedDelta: [{ path: "Deployment/redis-replica/spec.replicas", before: 1, after: 2 }],
  }, status: { materialization: "pass", kubernetesSchemaValidation: "not-run", kubernetesApply: "not-run", lifecycleExecution: "not-run", configHubDelivery: "not-run" } };
}

function sortObjects(objects) { return [...objects].sort((a, b) => `${a.kind}/${a.metadata?.name}`.localeCompare(`${b.kind}/${b.metadata?.name}`)); }
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function fail(condition, message) { if (!condition) throw new Error(`environment receipt verification failed: ${message}`); }

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  fail(process.argv.length <= 3, "unexpected CLI arguments");
  const mode = process.argv[2] ?? "--verify";
  if (mode === "--record") record();
  else if (mode === "--verify") verifyTimoniRedisEnvironments();
  else { console.error("Usage: node scripts/run-timoni-redis-environments.mjs --record|--verify"); process.exit(1); }
}
