import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = "runs/workshop-guides/2026-09-11";
// This dated command trial is historical evidence, not a current assistant or
// live-target trial. Preserve the receipt and its original verifier exactly.
const witnesses = {
  "receipt.json": "6f83f28d4f76c412e98a369db684e031d34f45216dfd3d9410eeab03150192e8",
  "verify.mjs": "4af296b9c1616582381df0bed98ab6e39ece855f5767a89e420754bccfe16d51",
};

export function verifyDemonstrationHistory({ root = repoRoot } = {}) {
  for (const [file, expected] of Object.entries(witnesses)) {
    const bytes = readFileSync(join(root, directory, file));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, `historical Guide witness changed: ${file}`);
  }
  // The retained verifier checks every recorded artifact and the shared render
  // bytes, then validates Compose continuity, Adapt fields and Match bindings.
  return execFileSync(process.execPath, [join(root, directory, "verify.mjs")], {
    cwd: root, encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"],
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(verifyDemonstrationHistory());
}
