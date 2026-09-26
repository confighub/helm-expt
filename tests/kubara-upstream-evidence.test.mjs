import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { blobID, paths, root, lockPath, validateLock, verifyLocal, verifyTree, writeSnapshot } from '../scripts/sync-kubara-upstream-evidence.mjs';
const lock = JSON.parse(readFileSync(join(root, lockPath), 'utf8'));
const tree = () => ({ truncated: false, tree: lock.files.map(row => ({ path: row.path, type: 'blob', mode: '100644', sha: row.gitBlob })) });
test('retained bytes match reviewed lock', () => verifyLocal(lock));
test('missing or substituted paths and mutable refs fail closed', () => {
  for (const changed of [{ ...lock, commit: 'main' }, { ...lock, files: lock.files.slice(1) }, { ...lock, files: lock.files.map((row, i) => i ? row : { ...row, path: '../outside' }) }]) {
    assert.throws(() => validateLock(changed));
  }
});
test('corrupted snapshot is rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kubara-snapshot-test-'));
  try {
    for (const path of paths) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), readFileSync(join(root, path))); }
    verifyLocal(lock, dir);
    writeFileSync(join(dir, paths[0]), 'changed');
    assert.throws(() => verifyLocal(lock, dir), /snapshot differs/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('upstream binding rejects missing, symlink, changed and truncated trees', () => {
  verifyTree(lock, tree());
  for (const change of [t => { t.truncated = true; }, t => { t.tree.shift(); }, t => { t.tree[0].mode = '120000'; }, t => { t.tree[0].sha = blobID(Buffer.from('forged')); }]) {
    const t = tree(); change(t); assert.throws(() => verifyTree(lock, t));
  }
});

test('pin rejects destination symlinks without modifying outside files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kubara-pin-test-'));
  const outside = join(dir, 'outside');
  const repo = join(dir, 'repo'); mkdirSync(repo); writeFileSync(outside, 'keep');
  const pending = paths.map(path => ({ path, bytes: readFileSync(join(root, path)) }));
  try {
    mkdirSync(dirname(join(repo, paths[0])), { recursive: true });
    symlinkSync(outside, join(repo, paths[0]));
    assert.throws(() => writeSnapshot(lock, pending, repo), /symlink/);
    assert.equal(readFileSync(outside, 'utf8'), 'keep');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('failed replacement restores earlier files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kubara-pin-rollback-'));
  const pending = paths.map(path => ({ path, bytes: readFileSync(join(root, path)) }));
  try {
    for (const path of [...paths, lockPath]) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), 'old'); }
    let calls = 0;
    assert.throws(() => writeSnapshot(lock, pending, dir, (a, b) => {
      if (++calls === 3) throw new Error('injected I/O failure');
      renameSync(a, b);
    }), /injected/);
    for (const path of [...paths, lockPath]) assert.equal(readFileSync(join(dir, path), 'utf8'), 'old');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
