import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const here = new URL('./', import.meta.url);
const root = new URL('../../../', here);
const read = (name) => readFileSync(new URL(name, here));
const json = (name) => JSON.parse(read(name));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const receipt = json('receipt.json');
for (const item of receipt.artifacts) {
  assert.match(item.path, /^[a-z0-9.-]+$/);
  assert.equal(sha(read(item.path)), item.sha256, item.path);
}
for (const item of receipt.retainedRenderBytes) {
  assert.match(item.path, /^runs\/workshop-integration\/2026-09-10\/[a-z.]+\.gz$/);
  assert.equal(sha(gunzipSync(readFileSync(new URL(item.path, root)))), item.uncompressedSha256);
}
const baseline = json('compose-baseline.json');
const resumed = json('compose-resume.json');
const changed = json('compose-changed.json');
assert.equal(baseline.objectCount, 184);
assert.equal(baseline.certified, true);
assert.equal(resumed.renderedFile.sha256, baseline.renderedFile.sha256);
assert.equal(changed.certified, true);
assert.equal(changed.objectCount, 184);
assert.equal(baseline.renderedFile.sha256, receipt.retainedRenderBytes[0].uncompressedSha256);
assert.equal(changed.renderedFile.sha256, receipt.retainedRenderBytes[1].uncompressedSha256);
assert.equal(json('compose-refusal.json').certified, false);
const diff = json('adapt-diff.json');
assert.deepEqual(json('adapt-recheck.json'), diff);
assert.deepEqual(json('adapt-diff-with-exit.json'), diff);
assert.deepEqual(diff.changes[0].fields, [{ path: '/spec/replicas', operation: 'replace', before: 1, after: 2 }]);
const unexpected = json('adapt-unexpected-diff.json');
assert.deepEqual(unexpected.changes[0].fields, [
  { path: '/spec/replicas', operation: 'replace', before: 1, after: 2 },
  { path: '/spec/revisionHistoryLimit', operation: 'replace', before: 10, after: 5 },
]);
for (const [result, after] of [[diff, 'after'], [unexpected, 'unexpected']]) {
  assert.equal(result.before.sha256, `sha256:${sha(read('adapt-before.yaml'))}`);
  assert.equal(result.after.sha256, `sha256:${sha(read(`adapt-${after}.yaml`))}`);
}
for (const [status, input] of [['candidate', 'nodes'], ['mismatch', 'mismatch-nodes'], ['unknown', 'unknown-nodes']]) {
  const result = json(`match-${status}.json`);
  assert.equal(result.status, status);
  assert.equal(result.workload.sha256, `sha256:${sha(read('match-model.yaml'))}`);
  assert.equal(result.target.sha256, `sha256:${sha(read(`match-${input}.yaml`))}`);
  assert.equal(result.target.liveChecked, false);
}
console.log('Verified retained Guide artifacts, render continuity, exact Adapt fields and Match input bindings. Exit codes and execution history remain recorded observations.');
