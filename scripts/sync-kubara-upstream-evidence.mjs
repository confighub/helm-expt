#!/usr/bin/env node
// Import evidence, never execute the upstream live tooling.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, lstatSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repository = 'confighub/kubara-confighub';
export const paths = Object.freeze([
  'examples/kubara/current-platform/catalog-parity-receipt.yaml',
  'examples/kubara/current-platform/generation-receipt.yaml',
  'data/kubara-catalog-1.1-full-coverage/receipt.yaml',
  'data/kubara-release-acceptance/contract.yaml',
  'data/kubara-platform-matrix/matrix.json',
  'data/kubara-wiring/graph.json',
  'runs/kubara-mini-idp-reconcile/receipt.yaml',
  'runs/kubara-mini-idp-reconcile/orphan-audit.yaml',
  'runs/kubara-mini-idp-reconcile/attempts.yaml',
]);
export const lockPath = 'data/kubara-upstream-evidence/lock.json';
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
export const blobID = bytes => digest('sha1', Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]));
const check = (condition, message) => { if (!condition) throw new Error(message); };
export function validateLock(lock) {
  check(lock?.schemaVersion === 1 && lock.repository === repository, 'unexpected evidence lock identity');
  check(/^[0-9a-f]{40}$/.test(lock.commit ?? ''), 'source must be an exact commit');
  check(Array.isArray(lock.files) && lock.files.length === paths.length, 'evidence file set differs');
  check(JSON.stringify(lock.files.map(row => row.path)) === JSON.stringify(paths), 'evidence paths differ or are reordered');
  for (const row of lock.files) {
    check(/^[0-9a-f]{64}$/.test(row.sha256 ?? '') && /^[0-9a-f]{40}$/.test(row.gitBlob ?? ''), `${row.path}: malformed hash`);
  }
  return lock;
}
export function verifyLocal(lock, repoRoot = root) {
  validateLock(lock);
  for (const row of lock.files) {
    const path = resolve(repoRoot, row.path);
    check(existsSync(path) && lstatSync(path).isFile(), `${row.path}: missing regular evidence file`);
    const bytes = readFileSync(path);
    check(digest('sha256', bytes) === row.sha256 && blobID(bytes) === row.gitBlob, `${row.path}: snapshot differs from lock`);
  }
}
export function verifyTree(lock, tree) {
  validateLock(lock);
  check(tree?.truncated === false && Array.isArray(tree.tree), 'upstream tree missing or truncated');
  const entries = new Map(tree.tree.map(row => [row.path, row]));
  check(entries.size === tree.tree.length, 'duplicate upstream tree paths');
  for (const row of lock.files) {
    const entry = entries.get(row.path);
    check(entry?.type === 'blob' && entry.mode === '100644' && entry.sha === row.gitBlob, `${row.path}: snapshot differs from upstream commit`);
  }
}
export function writeSnapshot(lock, pending, repoRoot = root, replace = renameSync) {
  validateLock(lock);
  check(pending.length === paths.length && pending.every((row, i) => row.path === paths[i]
    && digest('sha256', row.bytes) === lock.files[i].sha256 && blobID(row.bytes) === lock.files[i].gitBlob), 'pending bytes differ from lock');
  const writes = [...pending.map(row => ({ path: row.path, bytes: row.bytes })),
    { path: lockPath, bytes: Buffer.from(`${JSON.stringify(lock, null, 2)}\n`) }];
  // Reject file and directory symlinks before preparing any writes.
  for (const row of writes) {
    let cursor = resolve(repoRoot, row.path);
    while (cursor !== dirname(resolve(repoRoot))) {
      if (existsSync(cursor) || (() => { try { lstatSync(cursor); return true; } catch { return false; } })()) {
        check(!lstatSync(cursor).isSymbolicLink(), `${relative(repoRoot, cursor)}: snapshot destination is a symlink`);
      }
      if (cursor === resolve(repoRoot)) break;
      cursor = dirname(cursor);
    }
  }
  const staging = mkdtempSync(join(repoRoot, '.kubara-evidence-stage-'));
  const done = [];
  try {
    for (const [i, row] of writes.entries()) {
      row.destination = resolve(repoRoot, row.path);
      row.previous = existsSync(row.destination) ? readFileSync(row.destination) : null;
      row.staged = join(staging, String(i));
      writeFileSync(row.staged, row.bytes);
    }
    try {
      for (const row of writes) {
        mkdirSync(dirname(row.destination), { recursive: true });
        replace(row.staged, row.destination);
        done.push(row);
      }
    } catch (error) {
      for (const [i, row] of [...done].reverse().entries()) {
        if (row.previous === null) rmSync(row.destination);
        else {
          const backup = join(staging, `restore-${i}`);
          writeFileSync(backup, row.previous);
          renameSync(backup, row.destination);
        }
      }
      throw error;
    }
  } finally { rmSync(staging, { recursive: true, force: true }); }
}
async function request(url, api = false) {
  const headers = { 'User-Agent': 'confighub-evidence-reader' };
  if (api && process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000), redirect: 'error' });
  check(response.ok, `upstream request failed: HTTP ${response.status}`);
  return response;
}
async function sourceTree(commit) {
  return (await request(`https://api.github.com/repos/${repository}/git/trees/${commit}?recursive=1`, true)).json();
}
async function main(args) {
  if (args.length === 2 && args[0] === '--pin') {
    const commit = args[1];
    check(/^[0-9a-f]{40}$/.test(commit), '--pin requires a full commit');
    const tree = await sourceTree(commit);
    const pending = [];
    // Fetch and validate all inputs before writing any snapshot.
    for (const path of paths) {
      const bytes = Buffer.from(await (await request(`https://raw.githubusercontent.com/${repository}/${commit}/${path}`)).arrayBuffer());
      pending.push({ path, bytes, sha256: digest('sha256', bytes), gitBlob: blobID(bytes) });
    }
    const lock = { schemaVersion: 1, repository, commit, files: pending.map(({ bytes, ...row }) => row) };
    verifyTree(lock, tree);
    writeSnapshot(lock, pending);
    verifyLocal(lock);
    console.log(`Pinned ${paths.length} evidence files at ${repository}@${commit}; no live proof was run.`);
    return;
  }
  check(args.length === 1 && ['--verify', '--verify-upstream'].includes(args[0]), 'Use --verify, --verify-upstream, or --pin <full-commit>');
  const lock = JSON.parse(readFileSync(resolve(root, lockPath), 'utf8'));
  verifyLocal(lock);
  if (args[0] === '--verify-upstream') verifyTree(lock, await sourceTree(lock.commit));
  console.log(`Verified ${paths.length} evidence files${args[0] === '--verify-upstream' ? ' against upstream commit' : ' against reviewed lock'}; verdicts are unchanged.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
