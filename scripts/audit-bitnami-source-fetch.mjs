#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const receiptPath = join(repoRoot, "runs/bitnami-source-fetch/receipt.json");
const surveyPath = "data/bitnami-successors/survey.json";
const survey = JSON.parse(readFileSync(join(repoRoot, surveyPath), "utf8"));
const targets = survey.exposure.filter((row) => row.httpStatus === 403 && !row.component.includes("("));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function verdict(exitCode, actual, expected) {
  if (exitCode !== 0 || !actual) return "fetch-failed";
  return actual === expected ? "available-pinned-bytes" : "digest-mismatch";
}

function record() {
  const scratch = mkdtempSync(join(tmpdir(), "chart-source-audit-"));
  try {
    const registryConfig = join(scratch, "registry.json");
    writeFileSync(registryConfig, '{"auths":{}}\n');
    writeFileSync(join(scratch, "config.json"), '{"auths":{}}\n');
    const env = { ...process.env, HELM_REGISTRY_CONFIG: registryConfig, DOCKER_CONFIG: scratch };
    const rows = targets.map((target) => {
      const sourceLock = `recipes/bitnami/${target.component}/${target.pinnedVersion}/source-lock.yaml`;
      const sourceBytes = readFileSync(join(repoRoot, sourceLock));
      const spec = readYaml(join(repoRoot, sourceLock)).spec;
      const expected = spec.archiveSHA256 ?? spec.packageSHA256;
      assert.match(expected, /^[a-f0-9]{64}$/);
      const observedAt = new Date().toISOString();
      const http = spawnSync("curl", ["--disable", "--silent", "--show-error", "--location", "--max-time", "30", "--output", "/dev/null", "--write-out", "%{http_code}", target.tgzUrl], { encoding: "utf8", timeout: 35000 });
      const ociUrl = `oci://registry-1.docker.io/bitnamicharts/${target.component}`;
      const args = ["pull", ociUrl, "--version", target.pinnedVersion, "--registry-config", registryConfig, "--destination", scratch];
      const oci = spawnSync("helm", args, { env, encoding: "utf8", timeout: 60000 });
      const archive = join(scratch, `${target.component}-${target.pinnedVersion}.tgz`);
      const archiveSHA256 = existsSync(archive) ? hash(readFileSync(archive)) : null;
      const clean = (value) => String(value ?? "").replaceAll(scratch, "$SCRATCH");
      const row = {
        chart: `bitnami/${target.component}`, version: target.pinnedVersion, observedAt,
        sourceLock, sourceLockSHA256: hash(sourceBytes), expectedArchiveSHA256: expected,
        directTgz: { url: target.tgzUrl, exitCode: http.status, httpStatus: Number(http.stdout) || null, error: clean(http.stderr), executionError: http.error?.code ?? null },
        oci: { url: ociUrl, exitCode: oci.status, archiveSHA256, result: verdict(oci.status, archiveSHA256, expected), output: clean(`${oci.stdout ?? ""}${oci.stderr ?? ""}`), executionError: oci.error?.code ?? null },
      };
      console.log(`${row.chart}@${row.version}: direct HTTP ${row.directTgz.httpStatus}; OCI ${row.oci.result}`);
      return row;
    });
    write(receiptPath, JSON.stringify({
      schemaVersion: 1, survey: surveyPath, surveySHA256: hash(readFileSync(join(repoRoot, surveyPath))),
      authentication: "Empty Helm registry and Docker credential configurations; anonymous registry token exchange only.",
      method: "GET the historical direct tgz URL; helm pull the public OCI reference with a 60-second limit; compare archive SHA-256 with the retained source lock. No cluster operations or source-pin changes.",
      helmVersion: spawnSync("helm", ["version", "--short"], { encoding: "utf8" }).stdout.trim(),
      boundary: "A failed fetch is an observation, not proof of retirement or a credential requirement. OCI availability does not establish runtime support or image availability. Historical direct-URL failures do not establish OCI failure.",
      rows,
    }, null, 2) + "\n");
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

export function verifyBitnamiSourceFetch(receipt = JSON.parse(readFileSync(receiptPath, "utf8")), { quiet = false } = {}) {
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.survey, surveyPath);
  assert.equal(receipt.surveySHA256, hash(readFileSync(join(repoRoot, surveyPath))));
  assert.equal(receipt.rows.length, targets.length);
  for (const [index, target] of targets.entries()) {
    const row = receipt.rows[index];
    assert.equal(row.chart, `bitnami/${target.component}`);
    assert.equal(row.version, target.pinnedVersion);
    assert.equal(row.sourceLock, `recipes/${row.chart}/${row.version}/source-lock.yaml`);
    assert.equal(row.sourceLockSHA256, hash(readFileSync(join(repoRoot, row.sourceLock))));
    const spec = readYaml(join(repoRoot, row.sourceLock)).spec;
    assert.equal(row.expectedArchiveSHA256, spec.archiveSHA256 ?? spec.packageSHA256);
    assert.equal(row.directTgz.url, target.tgzUrl);
    assert.equal(row.oci.url, `oci://registry-1.docker.io/bitnamicharts/${target.component}`);
    assert.ok(Number.isFinite(Date.parse(row.observedAt)));
    assert.equal(row.oci.result, verdict(row.oci.exitCode, row.oci.archiveSHA256, row.expectedArchiveSHA256));
    if (row.oci.archiveSHA256 !== null) assert.match(row.oci.archiveSHA256, /^[a-f0-9]{64}$/);
    assert.equal(row.oci.result, "available-pinned-bytes", `${row.chart}@${row.version}: OCI receipt must prove anonymous retrieval of the pinned archive`);
  }
  if (!quiet) console.log(`verified ${receipt.rows.length} source-fetch observations without network access`);
}

function selfTest() {
  assert.equal(verdict(0, "same", "same"), "available-pinned-bytes");
  assert.equal(verdict(0, "different", "same"), "digest-mismatch");
  assert.equal(verdict(1, "same", "same"), "fetch-failed");
  assert.equal(verdict(null, null, "same"), "fetch-failed");
  assert.equal(verdict(0, null, "same"), "fetch-failed");
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  for (const [exitCode, archiveSHA256, result] of [[1, null, "fetch-failed"], [null, null, "fetch-failed"], [0, "0".repeat(64), "digest-mismatch"]]) {
    const failed = structuredClone(receipt);
    Object.assign(failed.rows[0].oci, { exitCode, archiveSHA256, result });
    assert.throws(() => verifyBitnamiSourceFetch(failed, { quiet: true }), /must prove anonymous retrieval/);
  }
  console.log("source-fetch verdict self-tests passed");
}

const mode = process.argv[2] ?? "--verify";
if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (mode === "--record") { record(); verifyBitnamiSourceFetch(); }
  else if (mode === "--verify") { selfTest(); verifyBitnamiSourceFetch(); }
  else if (mode === "--self-test") selfTest();
  else throw new Error("Use --record, --verify, or --self-test");
}
