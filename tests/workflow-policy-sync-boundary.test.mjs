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
import { tmpdir } from "node:os";
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

function run(mode) {
  return spawnSync(process.execPath, [script, mode], {
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
