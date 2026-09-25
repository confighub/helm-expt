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

test("workflow policy blocks every mutating sync mode before cub or receipt changes", () => {
  const before = receiptHash();
  for (const mode of [
    "--sync",
    "--refresh-recipes",
    "--relabel",
    "--exhibits",
    "--policy-sync",
    "--policy-record",
  ]) {
    const result = run(mode);
    assert.notEqual(result.status, 0, mode);
    assert.match(result.stderr, /blocked: catalog-standard requires workflow approval/);
    assertNoCubInvocation();
    assert.equal(receiptHash(), before, `${mode} changed the historical receipt`);
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


test("retired approval proofs stop before invoking cub or overwriting evidence", () => {
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
      assert.equal(result.status, 1, `${entrypoint} ${mode}: ${result.stderr}`);
      assert.match(result.stderr, /blocked: this legacy .*ChangeWorkflow and ChangeOrder/);
      assertNoCubInvocation();
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


test("Mini-IDP refuses its retired approval writer before any live work", () => {
  const journal = join(homedir(), ".confighub", "locks", "helm-expt-kubara-operation-journal.json");
  const before = existsSync(journal) ? readFileSync(journal) : null;
  const result = run("--apply", join(repoRoot, "scripts", "reconcile-kubara-mini-idp.mjs"));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Mini-IDP --apply is blocked before any live action/);
  assertNoCubInvocation();
  assert.deepEqual(existsSync(journal) ? readFileSync(journal) : null, before, "operation journal must stay unchanged");
});
