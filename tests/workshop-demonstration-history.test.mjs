import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDemonstrationHistory } from "../scripts/verify-workshop-demonstration-history.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const history = "runs/workshop-guides/2026-09-11";

export function testDemonstrationHistory() {
  const root = mkdtempSync(join(tmpdir(), "workshop-history-test-"));
  try {
    for (const path of [history, "runs/workshop-integration/2026-09-10"]) {
      cpSync(join(repoRoot, path), join(root, path), { recursive: true });
    }
    assert.match(verifyDemonstrationHistory({ root }), /Verified retained Guide artifacts/);
    for (const file of ["receipt.json", "verify.mjs", "compose-baseline.json", "adapt-after.yaml", "match-nodes.yaml"]) {
      const path = join(root, history, file);
      const original = readFileSync(path);
      writeFileSync(path, Buffer.concat([original, Buffer.from("\n")]));
      assert.throws(() => verifyDemonstrationHistory({ root }), file);
      writeFileSync(path, original);
    }
    const render = join(root, "runs/workshop-integration/2026-09-10/rendered.yaml.gz");
    rmSync(render);
    assert.throws(() => verifyDemonstrationHistory({ root }), "missing shared render dependency");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  testDemonstrationHistory();
  console.log("Guide history rejection tests passed");
}
