#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const queuePath = "data/latest-top20-refresh/action-queue/queue.yaml";
const receiptPath = join(repoRoot, "runs/latest-top20-refresh/source-fetch/receipt.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function targets() {
  return readYaml(join(repoRoot, queuePath)).spec.rows.map((row) => {
    assert.ok(row.retainedCandidateVersion, `${row.chart}: no retained candidate to audit`);
    const sourceLock = `recipes/${row.chart}/${row.retainedCandidateVersion}/source-lock.yaml`;
    const bytes = readFileSync(join(repoRoot, sourceLock));
    const spec = readYaml(join(repoRoot, sourceLock)).spec;
    assert.equal(spec.version, row.retainedCandidateVersion);
    assert.equal(`${spec.repositoryName}/${spec.chart}`, row.chart);
    const expectedArchiveSHA256 = spec.archiveSHA256 ?? spec.packageSHA256;
    assert.match(expectedArchiveSHA256, /^[a-f0-9]{64}$/);
    // Bitnami's public OCI distribution is checked against the retained archive,
    // including locks that only name the historical HTTP repository.
    const source = row.chart.startsWith("bitnami/")
      ? { transport: "oci", url: `oci://registry-1.docker.io/bitnamicharts/${spec.chart}` }
      : { transport: "helm-repository", url: spec.repositoryURL };
    return { chart: row.chart, version: spec.version, sourceLock, sourceLockSHA256: hash(bytes), expectedArchiveSHA256, source };
  });
}

function verdict(exitCode, digest, expected) {
  if (exitCode !== 0 || !digest) return "fetch-failed";
  return digest === expected ? "available-pinned-bytes" : "digest-mismatch";
}

function record() {
  const scratch = mkdtempSync(join(tmpdir(), "refresh-source-audit-"));
  try {
    const registryConfig = join(scratch, "registry.json");
    writeFileSync(registryConfig, '{"auths":{}}\n');
    writeFileSync(join(scratch, "config.json"), '{"auths":{}}\n');
    const env = { ...process.env, HELM_REGISTRY_CONFIG: registryConfig, DOCKER_CONFIG: scratch,
      HELM_REPOSITORY_CONFIG: join(scratch, "repositories.yaml"), HELM_REPOSITORY_CACHE: join(scratch, "cache") };
    const version = spawnSync("helm", ["version", "--short"], { encoding: "utf8", timeout: 10000 });
    assert.equal(version.status, 0, "helm version must succeed before recording");
    const rows = targets().map((target, index) => {
      const destination = join(scratch, String(index));
      mkdirSync(destination);
      const args = target.source.transport === "oci"
        ? ["pull", target.source.url]
        : ["pull", target.chart.split("/").at(-1), "--repo", target.source.url];
      args.push("--version", target.version, "--registry-config", registryConfig, "--destination", destination);
      const observedAt = new Date().toISOString();
      const result = spawnSync("helm", args, { env, encoding: "utf8", timeout: 90000 });
      const archive = join(destination, `${target.chart.split("/").at(-1)}-${target.version}.tgz`);
      const archiveSHA256 = existsSync(archive) ? hash(readFileSync(archive)) : null;
      const observation = { ...target, observedAt, exitCode: result.status, executionError: result.error?.code ?? null,
        archiveSHA256, result: verdict(result.status, archiveSHA256, target.expectedArchiveSHA256),
        output: `${result.stdout ?? ""}${result.stderr ?? ""}`.replaceAll(scratch, "$SCRATCH") };
      console.log(`${target.chart}@${target.version}: ${observation.result}`);
      return observation;
    });
    // Preserve failures too; the subsequent verifier must refuse them.
    write(receiptPath, JSON.stringify({ schemaVersion: 1, queue: queuePath,
      queueSHA256: hash(readFileSync(join(repoRoot, queuePath))), helmVersion: version.stdout.trim(),
      authentication: "Empty Helm registry, repository and Docker credential configurations; anonymous public source retrieval.",
      boundary: "Source archive availability at the observation time only. No image, cluster, upgrade or support claim; replacement deferrals remain in force.",
      rows }, null, 2) + "\n");
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

export function verifyRefreshCandidateSources(receipt = JSON.parse(readFileSync(receiptPath, "utf8")), { quiet = false } = {}) {
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.queue, queuePath);
  assert.equal(receipt.queueSHA256, hash(readFileSync(join(repoRoot, queuePath))));
  const expected = targets();
  assert.equal(receipt.rows.length, expected.length, "candidate coverage changed");
  for (const [index, target] of expected.entries()) {
    const row = receipt.rows[index];
    for (const key of Object.keys(target)) assert.deepEqual(row[key], target[key], `${target.chart}: ${key} changed`);
    assert.ok(Number.isFinite(Date.parse(row.observedAt)), "invalid observation time");
    assert.equal(row.result, verdict(row.exitCode, row.archiveSHA256, row.expectedArchiveSHA256));
    assert.equal(row.executionError, null, "fetch execution failed");
    assert.equal(row.result, "available-pinned-bytes", `${target.chart}: receipt must prove retrieval of the pinned archive`);
  }
  if (!quiet) console.log(`verified source retrieval receipts for ${expected.length} retained refresh candidates (offline)`);
}

function selfTest() {
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  verifyRefreshCandidateSources(receipt, { quiet: true });
  const mutations = [
    (r) => r.rows.pop(),
    (r) => { r.rows[1] = structuredClone(r.rows[0]); },
    (r) => { r.queueSHA256 = "0".repeat(64); },
    (r) => { r.rows[0].sourceLockSHA256 = "0".repeat(64); },
    (r) => { r.rows[0].source.url = "https://example.invalid/chart"; },
    (r) => { r.rows[0].version = "0.0.0"; },
    (r) => { r.rows[0].observedAt = "invalid"; },
    (r) => { Object.assign(r.rows[0], { exitCode: 1, archiveSHA256: null, result: "fetch-failed" }); },
    (r) => { Object.assign(r.rows[0], { exitCode: null, executionError: "ETIMEDOUT", archiveSHA256: null, result: "fetch-failed" }); },
    (r) => { Object.assign(r.rows[0], { archiveSHA256: "0".repeat(64), result: "digest-mismatch" }); },
    (r) => { r.rows[0].archiveSHA256 = "0".repeat(64); },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(receipt);
    mutate(changed);
    assert.throws(() => verifyRefreshCandidateSources(changed, { quiet: true }));
  }
  console.log(`candidate source receipt negative tests passed (${mutations.length})`);
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? "--verify";
  if (mode === "--record") { record(); verifyRefreshCandidateSources(); }
  else if (mode === "--verify") { selfTest(); verifyRefreshCandidateSources(); }
  else if (mode === "--self-test") selfTest();
  else throw new Error("Use --record, --verify or --self-test");
}
