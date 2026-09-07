import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import { repoRoot } from "./lib/proof-common.mjs";

const fixture = "examples/timoni/redis-8-10-1";
const generator = "scripts/generate-timoni-redis-pilot.mjs";

export function testTimoniProcessorIntegrity() {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "helm-expt-timoni-processor-integrity-")));
  try {
    copyFixture(scratch);
    const stub = writeStub(scratch);
    const fixtureFiles = listFiles(join(scratch, fixture));
    const original = snapshot(fixtureFiles);
    const run = (clientVersion, mutateLock) => {
      restore(fixtureFiles, original);
      if (mutateLock) mutateLock(join(scratch, `${fixture}/source-lock.yaml`));
      const before = snapshot(fixtureFiles);
      writeFileSync(stub.marker, "");
      const result = runRefresh(scratch, stub.path, stub.marker, clientVersion);
      return { result, calls: readCalls(stub.marker, scratch), before, after: snapshot(fixtureFiles) };
    };

    const mismatch = run("0.34.0");
    assert.notEqual(mismatch.result.status, 0, "mismatching Timoni client version was accepted");
    assert.match(mismatch.result.stderr, /client version 0\.34\.0 does not match.*0\.33\.0/, "mismatch did not report both versions");
    assert.deepEqual(mismatch.calls, [["version", "-o", "json"]], "schema/build ran after a version mismatch");
    assertSnapshotEqual(mismatch.after, mismatch.before, "mismatching version changed fixture bytes");

    for (const [label, mutate] of [
      ["malformed", (path) => replaceProcessorVersion(path, "not-a-version")],
      ["missing", removeProcessorVersion],
    ]) {
      const refused = run("0.33.0", mutate);
      assert.notEqual(refused.result.status, 0, `${label} processor version was accepted`);
      assert.match(refused.result.stderr, /declares no valid Timoni processor version/, `${label} refusal reason was not recorded`);
      assert.deepEqual(refused.calls, [], `${label} processor version invoked Timoni`);
      assertSnapshotEqual(refused.after, refused.before, `${label} processor version changed fixture bytes`);
    }

    for (const [label, output] of [["malformed client", "not-json"], ["missing client", "missing-client"]]) {
      const refused = run(output);
      assert.notEqual(refused.result.status, 0, `${label} output was accepted`);
      assert.match(refused.result.stderr, label === "malformed client" ? /not valid JSON/ : /no valid client version/, `${label} refusal reason was not recorded`);
      assert.deepEqual(refused.calls, [["version", "-o", "json"]], `${label} output ran schema/build`);
      assertSnapshotEqual(refused.after, refused.before, `${label} output changed fixture bytes`);
    }

    const matching = run("0.33.0");
    assert.equal(matching.result.status, 0, "matching Timoni client version did not refresh");
    assertSnapshotEqual(matching.after, matching.before, "matching refresh changed deterministic fixture bytes");
    assert.deepEqual(matching.calls, [
      ["version", "-o", "json"],
      ["mod", "show", "config", "oci://ghcr.io/stefanprodan/modules/redis", "-v", "8.10.1"],
      ["-n", "redis", "build", "redis", "oci://ghcr.io/stefanprodan/modules/redis", "-v", "8.10.1", "-d", "sha256:7f24e8f7e49132c90789464dcf5b82eb137e378c97735eec36efbe0d1caeb872", "-f", "$SCRATCH/examples/timoni/redis-8-10-1/selected-values.cue", "--mask-secrets"],
    ], "matching refresh did not run the expected Timoni calls");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  console.log("Timoni processor integrity self-test passed: refresh is version-bound before materialization");
}

function copyFixture(scratch) {
  for (const [source, destination, options] of [
    [join(repoRoot, fixture), join(scratch, fixture), { recursive: true }],
    [join(repoRoot, generator), join(scratch, generator)],
    [join(repoRoot, "scripts/transform-config-oci.mjs"), join(scratch, "scripts/transform-config-oci.mjs")],
    [join(repoRoot, "scripts/lib"), join(scratch, "scripts/lib"), { recursive: true }],
  ]) {
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, options);
  }
}

function writeStub(scratch) {
  const path = join(scratch, "timoni-stub.mjs");
  const marker = join(scratch, "timoni-calls.jsonl");
  writeFileSync(path, `#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
appendFileSync(process.env.TIMONI_STUB_MARKER, JSON.stringify(args) + "\\n");
if (args[0] === "version") {
  process.stdout.write(process.env.TIMONI_STUB_VERSION === "not-json"
    ? "not-json\\n"
    : JSON.stringify(process.env.TIMONI_STUB_VERSION === "missing-client"
      ? { api: "timoni.sh/v1alpha1" }
      : { api: "timoni.sh/v1alpha1", client: process.env.TIMONI_STUB_VERSION, cue: "0.17.1" }));
} else if (args[0] === "mod") {
  process.stdout.write(readFileSync(join(process.cwd(), "examples/timoni/redis-8-10-1/config-schema.cue"), "utf8"));
} else if (args.includes("build")) {
  process.stdout.write(readFileSync(join(process.cwd(), "examples/timoni/redis-8-10-1/rendered/release-objects.yaml"), "utf8"));
} else {
  process.exitCode = 2;
}
`, "utf8");
  chmodSync(path, 0o755);
  return { path, marker };
}

function runRefresh(scratch, stub, marker, version) {
  return spawnRefresh(scratch, {
    TIMONI_BIN: stub,
    TIMONI_STUB_MARKER: marker,
    TIMONI_STUB_VERSION: version,
  });
}

function spawnRefresh(scratch, env) {
  try {
    execFileSync(process.execPath, [join(scratch, generator), "--refresh"], {
      cwd: scratch,
      env: { ...process.env, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0 };
  } catch (error) {
    return { status: error.status ?? 1, stderr: error.stderr?.toString() ?? String(error) };
  }
}

function replaceProcessorVersion(path, version) {
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text.replace("    version: 0.33.0\n", `    version: ${version}\n`));
}

function removeProcessorVersion(path) {
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text.replace("    version: 0.33.0\n", ""));
}

function listFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files.sort();
}

function snapshot(files) {
  return new Map(files.map((path) => [relative(repoRoot, path), readFileSync(path)]));
}

function restore(files, original) {
  for (const path of files) writeFileSync(path, original.get(relative(repoRoot, path)));
}

function assertSnapshotEqual(actual, expected, message) {
  assert.deepEqual([...actual].map(([path, bytes]) => [path, bytes.toString("base64")]),
    [...expected].map(([path, bytes]) => [path, bytes.toString("base64")]), message);
}

function readCalls(marker, scratch) {
  return readFileSync(marker, "utf8").trim()
    ? readFileSync(marker, "utf8").trim().split("\n").map((line) => JSON.parse(line).map((arg) => arg.replaceAll(scratch, "$SCRATCH")))
    : [];
}
