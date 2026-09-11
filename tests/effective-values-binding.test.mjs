import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renamedValuesWitnesses, verifyEffectiveValuesBinding } from "../scripts/lib/effective-values-binding.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function testEffectiveValuesBinding() {
  const bytes = Buffer.from("replicas: 2\n");
  const hash = sha(bytes);
  assert.throws(() => verifyEffectiveValuesBinding("current.yaml", Buffer.from("replicas: 3\n"), hash, hash), /effective values digest mismatch/);
  assert.equal(verifyEffectiveValuesBinding("current.yaml", bytes, hash, hash), "exact");
  for (const [revision, render] of [[undefined, undefined], [hash, undefined], ["0".repeat(64), hash]]) {
    assert.throws(() => verifyEffectiveValuesBinding("current.yaml", bytes, revision, render), /effective values digest mismatch/);
  }
  for (const [path, historical] of renamedValuesWitnesses) {
    const current = readFileSync(join(root, path));
    assert.equal(verifyEffectiveValuesBinding(path, current, historical, historical), "historical-metadata-rename");
    assert.throws(() => verifyEffectiveValuesBinding(`${path}.copy`, current, historical, historical), /effective values digest mismatch/);
    const changed = Buffer.concat([current, Buffer.from("\n# changed input\n")]);
    assert.throws(() => verifyEffectiveValuesBinding(path, changed, historical, historical), /effective values digest mismatch/);
    const changedSpec = Buffer.from(current.toString().replace("spec:\n", "spec:\n  changedInput: true\n"));
    assert.throws(() => verifyEffectiveValuesBinding(path, changedSpec, historical, historical), /effective values digest mismatch/);
    const wrongName = Buffer.from(current.toString().replace("-static-passwords\"", "-other\""));
    assert.throws(() => verifyEffectiveValuesBinding(path, wrongName, historical, historical), /effective values digest mismatch/);
    assert.throws(() => verifyEffectiveValuesBinding(path, current, historical, sha(current)), /effective values digest mismatch/);
    assert.equal(verifyEffectiveValuesBinding(path, current, sha(current), sha(current)), "exact");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  testEffectiveValuesBinding();
  console.log("effective values input binding tests passed");
}
