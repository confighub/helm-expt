import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const script = join(repoRoot, "scripts", "sync-helm-org.mjs");
const receiptPath = join(repoRoot, "data", "apply-policy-profiles", "live-helm-catalog.yaml");
const work = mkdtempSync(join(tmpdir(), "workflow-policy-sync-boundary-"));
const fakeBin = join(work, "bin");
const markerPath = join(work, "cub-invoked");

mkdirSync(fakeBin);
writeFileSync(
  join(fakeBin, "cub"),
  "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$CUB_MARKER\"\nexit 99\n",
  { mode: 0o755 },
);
chmodSync(join(fakeBin, "cub"), 0o755);

function receiptHash() {
  return createHash("sha256").update(readFileSync(receiptPath)).digest("hex");
}

function run(mode, entrypoint = script) {
  rmSync(markerPath, { force: true });
  return spawnSync(process.execPath, [entrypoint, mode], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CUB_MARKER: markerPath,
      PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
    },
    timeout: 10_000,
  });
}

function assertNoCubInvocation() {
  assert.equal(existsSync(markerPath), false, "the boundary must refuse before invoking cub");
}

test.after(() => rmSync(work, { recursive: true, force: true }));

test("native policy conflict refuses before any policy write", () => {
  const before = receiptHash();
  const result = run("--policy-current-self-test");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /self-test passed/);
  assert.equal(receiptHash(), before, "native policy test changed historical receipt");
});

function assertOnlyReadAttempts() {
  const calls = existsSync(markerPath) ? readFileSync(markerPath, "utf8").trim().split("\n") : [];
  for (const call of calls) {
    assert.doesNotMatch(call, /\b(create|update|approve|publish|delete|destroy|apply|promote)\b/, `unexpected write attempted: ${call}`);
  }
}

test("unavailable ConfigHub preflight cannot overwrite historical policy evidence", () => {
  const before = receiptHash();
  for (const mode of ["--sync", "--refresh-recipes", "--relabel", "--exhibits", "--policy-sync", "--policy-record"]) {
    const result = run(mode);
    assert.notEqual(result.status, 0, mode);
    assertOnlyReadAttempts();
    assert.equal(receiptHash(), before, `${mode} changed historical receipt`);
  }
});

test("read-only planning and historical receipt verification remain cub-free", () => {
  const before = receiptHash();
  for (const mode of ["--plan", "--policy-receipt-verify"]) {
    const result = run(mode);
    assert.equal(result.status, 0, result.stderr);
    assertNoCubInvocation();
    assert.equal(receiptHash(), before, `${mode} changed the historical receipt`);
  }
});


test("proofs with unavailable preflight preserve historical evidence", () => {
  const preserved = [
    "runs/config-catalog-policy-functional-proof/receipt.yaml",
    "data/apply-policy-functional-proof/summary.md",
    "data/ai-operator-ladder/receipt.yaml",
    "data/ai-operator-ladder/summary.md",
  ];
  const before = preserved.map((path) => readFileSync(join(repoRoot, path)));
  for (const [entrypoint, modes] of [
    ["run-config-catalog-policy-proof.mjs", ["--run"]],
    ["run-ai-operator-ladder-proof.mjs", ["--upload", "--release", "--change", "--promote", "--gate", "--capture", "--down"]],
  ]) {
    for (const mode of modes) {
      const result = run(mode, join(repoRoot, "scripts", entrypoint));
      assert.notEqual(result.status, 0, `${entrypoint} ${mode}: ${result.stderr}`);
      assertOnlyReadAttempts();
      preserved.forEach((path, index) => assert.deepEqual(readFileSync(join(repoRoot, path)), before[index], path));
    }
  }
});


test("historical catalog proof still verifies without cub", () => {
  const result = run("--verify", join(repoRoot, "scripts", "run-config-catalog-policy-proof.mjs"));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verified historical Trigger-model evidence only/);
  assertNoCubInvocation();
});


test("Mini-IDP unavailable preflight preserves its operation journal", () => {
  const journal = join(homedir(), ".confighub", "locks", "helm-expt-kubara-operation-journal.json");
  const before = existsSync(journal) ? readFileSync(journal) : null;
  const result = run("--apply", join(repoRoot, "scripts", "reconcile-kubara-mini-idp.mjs"));
  assert.equal(result.status, 1, result.stderr);
  assertOnlyReadAttempts();
  assert.deepEqual(existsSync(journal) ? readFileSync(journal) : null, before, "operation journal must stay unchanged");
});
