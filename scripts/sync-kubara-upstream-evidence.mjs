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
  // The rest of the matrix generator's output. The generator is not carried
  // here any more, so these are bound to the commit whose CI re-derived them.
  'data/kubara-platform-matrix/desired-matrix.json',
  'data/kubara-platform-matrix/matrix.csv',
  'data/kubara-platform-matrix/matrix.html',
  'data/kubara-platform-matrix/summary.md',
  'data/kubara-platform-matrix/historical-v0.12.0/matrix.json',
  'data/kubara-platform-matrix/historical-v0.12.0/matrix.csv',
  'data/kubara-platform-matrix/historical-v0.12.0/matrix.html',
  'data/kubara-platform-matrix/historical-v0.12.0/summary.md',
]);
// The live executors whose digests the receipts cite. They are pinned by
// identity only: never written here and never run here.
export const implementations = Object.freeze([
  'scripts/reconcile-kubara-mini-idp.mjs',
  'scripts/audit-kubara-mini-idp-orphans.mjs',
]);
// The upstream gates that carry the contract of the retired helm-expt lanes.
// A commit may be pinned only when its own CI runs each of them and passed.
export const upstreamGates = Object.freeze({
  workflow: '.github/workflows/verify.yml',
  job: 'offline-verify',
  scripts: Object.freeze({
    'kubara-mini-idp:receipt-verify': 'node scripts/reconcile-kubara-mini-idp.mjs --receipt-verify',
    'kubara-mini-idp:orphan-audit:receipt-verify': 'node scripts/audit-kubara-mini-idp-orphans.mjs --receipt-verify',
    'kubara-mini-idp:performance:receipt-verify': 'node scripts/verify-kubara-mini-idp-performance.mjs --receipt-verify',
    'kubara-platform-matrix:verify': 'node scripts/generate-kubara-platform-matrix.mjs --verify --all',
  }),
});
export const lockPath = 'data/kubara-upstream-evidence/lock.json';
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
export const blobID = bytes => digest('sha1', Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]));
const check = (condition, message) => { if (!condition) throw new Error(message); };
export function validateLock(lock) {
  check(lock?.schemaVersion === 2 && lock.repository === repository, 'unexpected evidence lock identity');
  check(/^[0-9a-f]{40}$/.test(lock.commit ?? ''), 'source must be an exact commit');
  check(Array.isArray(lock.files) && lock.files.length === paths.length, 'evidence file set differs');
  check(JSON.stringify(lock.files.map(row => row.path)) === JSON.stringify(paths), 'evidence paths differ or are reordered');
  check(Array.isArray(lock.implementations) && JSON.stringify(lock.implementations.map(row => row.path)) === JSON.stringify(implementations), 'pinned implementation set differs or is reordered');
  for (const row of [...lock.files, ...lock.implementations]) {
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
  for (const row of [...lock.files, ...lock.implementations]) {
    const entry = entries.get(row.path);
    check(entry?.type === 'blob' && entry.mode === '100644' && entry.sha === row.gitBlob, `${row.path}: snapshot differs from upstream commit`);
  }
}
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The pinned commit must run the gates that replaced the retired helm-expt
// lanes, under the exact commands, and its own CI must have passed them.
export function verifyUpstreamGates(manifest, workflow, checkRuns) {
  const text = String(workflow ?? '');
  check(new RegExp(`^  ${escapeRegExp(upstreamGates.job)}:\\s*$`, 'm').test(text), `${upstreamGates.workflow}: has no ${upstreamGates.job} job`);
  for (const [name, command] of Object.entries(upstreamGates.scripts)) {
    check(manifest?.scripts?.[name] === command, `upstream package.json: ${name} is not "${command}"`);
    check(new RegExp(`^\\s*run: npm run ${escapeRegExp(name)}\\s*$`, 'm').test(text), `${upstreamGates.workflow}: does not run ${name}`);
  }
  const runs = (checkRuns?.check_runs ?? []).filter(row => row.name === upstreamGates.job && row.app?.slug === 'github-actions');
  check(runs.length > 0, `upstream commit has no ${upstreamGates.job} check run`);
  check(runs.every(row => row.status === 'completed' && row.conclusion === 'success'), `upstream ${upstreamGates.job} did not pass at the pinned commit`);
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
async function sourceBytes(commit, path) {
  return Buffer.from(await (await request(`https://raw.githubusercontent.com/${repository}/${commit}/${path}`)).arrayBuffer());
}
async function checkUpstreamGates(commit) {
  const manifest = JSON.parse((await sourceBytes(commit, 'package.json')).toString('utf8'));
  const workflow = (await sourceBytes(commit, upstreamGates.workflow)).toString('utf8');
  const checkRuns = await (await request(`https://api.github.com/repos/${repository}/commits/${commit}/check-runs?per_page=100`, true)).json();
  verifyUpstreamGates(manifest, workflow, checkRuns);
}
async function main(args) {
  if (args.length === 2 && args[0] === '--pin') {
    const commit = args[1];
    check(/^[0-9a-f]{40}$/.test(commit), '--pin requires a full commit');
    const tree = await sourceTree(commit);
    await checkUpstreamGates(commit);
    const pending = [];
    // Fetch and validate all inputs before writing any snapshot.
    for (const path of paths) {
      const bytes = await sourceBytes(commit, path);
      pending.push({ path, bytes, sha256: digest('sha256', bytes), gitBlob: blobID(bytes) });
    }
    // Implementations are hashed for identity, then discarded unwritten.
    const pinned = [];
    for (const path of implementations) {
      const bytes = await sourceBytes(commit, path);
      pinned.push({ path, sha256: digest('sha256', bytes), gitBlob: blobID(bytes) });
    }
    const lock = { schemaVersion: 2, repository, commit, files: pending.map(({ bytes, ...row }) => row), implementations: pinned };
    verifyTree(lock, tree);
    writeSnapshot(lock, pending);
    verifyLocal(lock);
    console.log(`Pinned ${paths.length} evidence files at ${repository}@${commit}; no live proof was run.`);
    return;
  }
  check(args.length === 1 && ['--verify', '--verify-upstream'].includes(args[0]), 'Use --verify, --verify-upstream, or --pin <full-commit>');
  const lock = JSON.parse(readFileSync(resolve(root, lockPath), 'utf8'));
  verifyLocal(lock);
  if (args[0] === '--verify-upstream') {
    verifyTree(lock, await sourceTree(lock.commit));
    await checkUpstreamGates(lock.commit);
  }
  console.log(args[0] === '--verify-upstream'
    ? `Verified ${paths.length} evidence files and ${implementations.length} implementation identities against the upstream commit, whose ${upstreamGates.job} gates passed; verdicts are unchanged.`
    : `Verified ${paths.length} evidence files against reviewed lock; verdicts are unchanged.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
