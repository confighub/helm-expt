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
const allOriginalsReceiptPath = join(repoRoot, "runs/bitnami-source-fetch/all-originals-receipt.json");
const surveyPath = "data/bitnami-successors/survey.json";
const survey = JSON.parse(readFileSync(join(repoRoot, surveyPath), "utf8"));
const historicalTargets = survey.exposure.filter((row) => row.httpStatus === 403 && !row.component.includes("("));
const originalComponents = ["redis", "nginx", "postgresql", "mysql", "mongodb", "rabbitmq"];
const allOriginalTargets = originalComponents.map((component) => {
  const target = survey.exposure.find((row) => row.component === component);
  assert.ok(target, `missing original source observation for ${component}`);
  return target;
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ANONYMOUS_AUTHENTICATION = "Empty Helm registry and Docker credential configurations; anonymous registry token exchange only.";
const ANONYMOUS_METHOD = "GET the historical direct tgz URL; helm pull the public OCI reference with a 60-second limit; compare archive SHA-256 with the retained source lock; read the default image from the pulled chart's values.yaml and request that image's manifest, and the same tag under bitnamilegacy, from Docker Hub with an anonymous token. No cluster operations or source-pin changes.";
const ANONYMOUS_BOUNDARY = "A failed fetch is an observation, not proof of retirement or a credential requirement. OCI availability does not establish runtime support. An image manifest that resolves does not establish that the image runs, is patched, or stays available, and a floating tag such as latest can resolve to different bytes later. Historical direct-URL failures do not establish OCI failure.";

function verdict(exitCode, actual, expected) {
  if (exitCode !== 0 || !actual) return "fetch-failed";
  return actual === expected ? "available-pinned-bytes" : "digest-mismatch";
}

const IMAGE_STATUSES = ["available", "not-found", "fetch-failed"];

// The image a chart runs by default, read from the chart's own values.yaml.
export function defaultImage(valuesText) {
  const lines = valuesText.split("\n");
  const start = lines.findIndex((line) => /^image:\s*$/.test(line));
  if (start < 0) return null;
  const fields = {};
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const match = line.match(/^  (registry|repository|tag):\s*["']?([^"'#\s]*)["']?\s*(#.*)?$/);
    if (match) fields[match[1]] = match[2];
  }
  if (!fields.repository || !fields.tag) return null;
  return { registry: fields.registry || "docker.io", repository: fields.repository, tag: fields.tag };
}

// Ask Docker Hub, anonymously, whether a repository:tag has a manifest.
function manifestStatus(repository, tag) {
  const token = spawnSync("curl", ["--disable", "--silent", "--max-time", "30", `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repository}:pull`], { encoding: "utf8", timeout: 35000 });
  let bearer = null;
  try { bearer = JSON.parse(token.stdout).token ?? null; } catch { bearer = null; }
  if (token.status !== 0 || !bearer) return { status: "fetch-failed", httpStatus: null };
  const head = spawnSync("curl", ["--disable", "--silent", "--max-time", "30", "--head", "--output", "/dev/null", "--write-out", "%{http_code}",
    "-H", `Authorization: Bearer ${bearer}`,
    "-H", "Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json",
    `https://registry-1.docker.io/v2/${repository}/manifests/${tag}`], { encoding: "utf8", timeout: 35000 });
  const httpStatus = Number(head.stdout) || null;
  return { status: httpStatus === 200 ? "available" : httpStatus === 404 ? "not-found" : "fetch-failed", httpStatus };
}

function observeImage(archive, component) {
  if (!archive) return { reference: null, status: "fetch-failed", httpStatus: null, legacyReference: null, legacyStatus: "fetch-failed", legacyHttpStatus: null };
  // Only the chart's own values.yaml: a subchart's image is not the one the chart runs.
  const values = spawnSync("tar", ["-xzOf", archive, `${component}/values.yaml`], { encoding: "utf8", timeout: 30000 });
  const image = defaultImage(values.stdout ?? "");
  if (!image || image.registry !== "docker.io" && image.registry !== "registry-1.docker.io") {
    return { reference: image ? `${image.registry}/${image.repository}:${image.tag}` : null, status: "fetch-failed", httpStatus: null, legacyReference: null, legacyStatus: "fetch-failed", legacyHttpStatus: null };
  }
  const own = manifestStatus(image.repository, image.tag);
  const legacyRepository = image.repository.replace(/^bitnami\//, "bitnamilegacy/");
  const legacy = manifestStatus(legacyRepository, image.tag);
  return {
    reference: `docker.io/${image.repository}:${image.tag}`, status: own.status, httpStatus: own.httpStatus,
    legacyReference: `docker.io/${legacyRepository}:${image.tag}`, legacyStatus: legacy.status, legacyHttpStatus: legacy.httpStatus,
  };
}

function verifyImageObservation(image) {
  assert.ok(image && typeof image === "object" && !Array.isArray(image), "image observation missing");
  for (const key of ["status", "legacyStatus"]) assert.ok(IMAGE_STATUSES.includes(image[key]), `image ${key} must be one of ${IMAGE_STATUSES.join(", ")}`);
  for (const key of ["reference", "legacyReference"]) assert.ok(image[key] === null || /^docker\.io\/[a-z0-9._\/-]+:[A-Za-z0-9._-]+$/.test(image[key]), `image ${key} is not a docker.io reference`);
  for (const key of ["httpStatus", "legacyHttpStatus"]) assert.ok(image[key] === null || Number.isInteger(image[key]));
  if (image.status === "available") assert.equal(image.httpStatus, 200);
  if (image.status === "not-found") assert.equal(image.httpStatus, 404);
}

function verifyDirectObservation(directTgz) {
  assert.ok(directTgz && typeof directTgz === "object" && !Array.isArray(directTgz));
  assert.equal(typeof directTgz.url, "string");
  for (const key of ["exitCode", "httpStatus"]) {
    assert.ok(directTgz[key] === null || Number.isInteger(directTgz[key]));
  }
  assert.equal(typeof directTgz.error, "string");
  assert.ok(directTgz.executionError === null || typeof directTgz.executionError === "string");
}

function record({ targets, outputPath }) {
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
        image: observeImage(archiveSHA256 ? archive : null, target.component),
      };
      console.log(`${row.chart}@${row.version}: direct HTTP ${row.directTgz.httpStatus}; OCI ${row.oci.result}; image ${row.image.reference} ${row.image.status}, bitnamilegacy ${row.image.legacyStatus}`);
      return row;
    });
    write(outputPath, JSON.stringify({
      schemaVersion: 1, survey: surveyPath, surveySHA256: hash(readFileSync(join(repoRoot, surveyPath))),
      authentication: ANONYMOUS_AUTHENTICATION,
      method: ANONYMOUS_METHOD,
      helmVersion: spawnSync("helm", ["version", "--short"], { encoding: "utf8" }).stdout.trim(),
      boundary: ANONYMOUS_BOUNDARY,
      rows,
    }, null, 2) + "\n");
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

export function verifyBitnamiSourceFetch(receipt = JSON.parse(readFileSync(receiptPath, "utf8")), { quiet = false, targets = historicalTargets } = {}) {
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.survey, surveyPath);
  assert.equal(receipt.authentication, ANONYMOUS_AUTHENTICATION, "receipt authentication declaration is not the anonymous configuration");
  assert.equal(receipt.method, ANONYMOUS_METHOD, "receipt method declaration is not the supported anonymous method");
  assert.equal(receipt.boundary, ANONYMOUS_BOUNDARY, "receipt boundary declaration is not the supported observation boundary");
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
    verifyDirectObservation(row.directTgz);
    assert.equal(row.directTgz.url, target.tgzUrl);
    assert.equal(row.oci.url, `oci://registry-1.docker.io/bitnamicharts/${target.component}`);
    assert.ok(Number.isFinite(Date.parse(row.observedAt)));
    assert.equal(row.oci.result, verdict(row.oci.exitCode, row.oci.archiveSHA256, row.expectedArchiveSHA256));
    assert.equal(row.oci.executionError, null, `${row.chart}@${row.version}: OCI fetch execution failed or was not recorded`);
    if (row.oci.archiveSHA256 !== null) assert.match(row.oci.archiveSHA256, /^[a-f0-9]{64}$/);
    assert.equal(row.oci.result, "available-pinned-bytes", `${row.chart}@${row.version}: OCI receipt must prove anonymous retrieval of the pinned archive`);
    verifyImageObservation(row.image);
  }
  if (!quiet) console.log(`verified ${receipt.rows.length} source-fetch observations without network access`);
}

export function verifyAllOriginalSourceFetch(receipt = JSON.parse(readFileSync(allOriginalsReceiptPath, "utf8")), options = {}) {
  return verifyBitnamiSourceFetch(receipt, { ...options, targets: allOriginalTargets });
}

export function testBitnamiSourceFetch() {
  assert.equal(verdict(0, "same", "same"), "available-pinned-bytes");
  assert.equal(verdict(0, "different", "same"), "digest-mismatch");
  assert.equal(verdict(1, "same", "same"), "fetch-failed");
  assert.equal(verdict(null, null, "same"), "fetch-failed");
  assert.equal(verdict(0, null, "same"), "fetch-failed");
  assert.deepEqual(defaultImage("global:\n  x: 1\nimage:\n  registry: docker.io\n  repository: bitnami/redis\n  tag: 7.4.1-debian-12-r2\n  digest: \"\"\nauth:\n  enabled: true\n"), { registry: "docker.io", repository: "bitnami/redis", tag: "7.4.1-debian-12-r2" });
  assert.equal(defaultImage("replicaCount: 1\n"), null);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  for (const executionError of ["ETIMEDOUT", "ENOBUFS", "ENOENT", undefined]) {
    const failed = structuredClone(receipt);
    if (executionError === undefined) delete failed.rows[0].oci.executionError;
    else failed.rows[0].oci.executionError = executionError;
    assert.throws(() => verifyBitnamiSourceFetch(failed, { quiet: true }), /OCI fetch execution failed or was not recorded/);
  }
  for (const [exitCode, archiveSHA256, result] of [[1, null, "fetch-failed"], [null, null, "fetch-failed"], [0, "0".repeat(64), "digest-mismatch"]]) {
    const failed = structuredClone(receipt);
    Object.assign(failed.rows[0].oci, { exitCode, archiveSHA256, result });
    assert.throws(() => verifyBitnamiSourceFetch(failed, { quiet: true }), /must prove anonymous retrieval/);
  }
  for (const key of ["authentication", "method", "boundary"]) {
    const changed = structuredClone(receipt);
    changed[key] = "credentialed retrieval / arbitrary method";
    assert.throws(() => verifyBitnamiSourceFetch(changed, { quiet: true }));
    const missing = structuredClone(receipt);
    delete missing[key];
    assert.throws(() => verifyBitnamiSourceFetch(missing, { quiet: true }));
  }
  console.log("source-fetch verdict self-tests passed");
}

export function testAllOriginalSourceFetch() {
  const historical = JSON.parse(readFileSync(receiptPath, "utf8"));
  const fixture = structuredClone(historical);
  const retainedRows = new Map(fixture.rows.map((row) => [row.chart, row]));
  fixture.rows = allOriginalTargets.map((target) => retainedRows.get(`bitnami/${target.component}`)).filter(Boolean);
  for (const target of allOriginalTargets.filter((item) => !historicalTargets.includes(item))) {
    const sourceLock = `recipes/bitnami/${target.component}/${target.pinnedVersion}/source-lock.yaml`;
    const sourceBytes = readFileSync(join(repoRoot, sourceLock));
    const spec = readYaml(join(repoRoot, sourceLock)).spec;
    const expected = spec.archiveSHA256 ?? spec.packageSHA256;
    fixture.rows.push({
      chart: `bitnami/${target.component}`, version: target.pinnedVersion,
      observedAt: new Date(0).toISOString(), sourceLock,
      sourceLockSHA256: hash(sourceBytes), expectedArchiveSHA256: expected,
      directTgz: { url: target.tgzUrl, exitCode: 0, httpStatus: 200, error: "", executionError: null },
      oci: { url: `oci://registry-1.docker.io/bitnamicharts/${target.component}`, exitCode: 0,
        archiveSHA256: expected, result: "available-pinned-bytes", output: "", executionError: null },
      image: { reference: `docker.io/bitnami/${target.component}:1.0.0`, status: "not-found", httpStatus: 404, legacyReference: `docker.io/bitnamilegacy/${target.component}:1.0.0`, legacyStatus: "available", legacyHttpStatus: 200 },
    });
  }
  fixture.rows.sort((a, b) => originalComponents.indexOf(a.chart.split("/")[1]) - originalComponents.indexOf(b.chart.split("/")[1]));
  verifyAllOriginalSourceFetch(fixture, { quiet: true });
  const accepted403 = structuredClone(fixture);
  accepted403.rows[0].directTgz.httpStatus = 403;
  verifyAllOriginalSourceFetch(accepted403, { quiet: true });
  for (const mutation of [
    (receipt) => { receipt.rows.pop(); },
    (receipt) => { receipt.rows[0].sourceLockSHA256 = "0".repeat(64); },
    (receipt) => { receipt.rows[1].expectedArchiveSHA256 = "0".repeat(64); },
    (receipt) => { delete receipt.rows[0].directTgz.httpStatus; },
    (receipt) => { receipt.rows[1].directTgz.exitCode = "0"; },
    (receipt) => { receipt.rows[2].directTgz.error = null; },
    (receipt) => { receipt.rows[3].directTgz.executionError = 7; },
    (receipt) => { receipt.rows[3].oci.archiveSHA256 = "0".repeat(64); receipt.rows[3].oci.result = "digest-mismatch"; },
    (receipt) => { receipt.rows[5].oci.exitCode = 1; receipt.rows[5].oci.archiveSHA256 = null; receipt.rows[5].oci.result = "fetch-failed"; },
    (receipt) => { receipt.rows[4].chart = "bitnami/redis"; },
    (receipt) => { delete receipt.rows[0].image; },
    (receipt) => { receipt.rows[1].image.status = "gone"; },
    (receipt) => { receipt.rows[2].image.status = "available"; receipt.rows[2].image.httpStatus = 404; },
    (receipt) => { receipt.rows[3].image.reference = "ghcr.io/other:1"; },
  ]) {
    const changed = structuredClone(fixture);
    mutation(changed);
    assert.throws(() => verifyAllOriginalSourceFetch(changed, { quiet: true }));
  }
  console.log("all-original source-fetch self-tests passed");
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? "--verify";
  const cliArgs = process.argv.slice(2);
  if (![
    cliArgs.length === 0,
    cliArgs.length === 1 && ["--record", "--verify", "--self-test"].includes(cliArgs[0]),
    cliArgs.length === 2 && ["--record", "--verify"].includes(cliArgs[0]) && cliArgs[1] === "--all-originals",
  ].some(Boolean)) {
    throw new Error("Use --record, --verify, [--verify --all-originals], or --self-test");
  }
  const allOriginals = cliArgs[1] === "--all-originals";
  if (mode === "--record" && allOriginals) {
    record({ targets: allOriginalTargets, outputPath: allOriginalsReceiptPath });
    verifyAllOriginalSourceFetch();
  } else if (mode === "--record") {
    record({ targets: historicalTargets, outputPath: receiptPath });
    verifyBitnamiSourceFetch();
  } else if (mode === "--verify" && allOriginals) {
    verifyAllOriginalSourceFetch();
  } else if (mode === "--verify") {
    testBitnamiSourceFetch();
    testAllOriginalSourceFetch();
    verifyBitnamiSourceFetch();
    verifyAllOriginalSourceFetch();
  } else if (mode === "--self-test") {
    testBitnamiSourceFetch();
    testAllOriginalSourceFetch();
  } else throw new Error("Use --record, --verify, [--verify --all-originals], or --self-test");
}
