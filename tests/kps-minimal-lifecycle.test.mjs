import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const script = 'scripts/generate-kps-packaged-lifecycle.mjs';
function run(extra, args = ['--verify', '--version', '87.19.2']) {
  const env = { ...process.env, HELM_EXPT_KPS_MINIMAL_CANDIDATE: '1' };
  delete env.HELM_EXPT_PROOF_OUTPUT_ROOT;
  delete env.HELM_EXPT_PROOF_OFFLINE_CANDIDATE;
  return spawnSync(process.execPath, [script, ...args], { env: { ...env, ...extra }, encoding: 'utf8' });
}
for (const [label, env] of [
  ['missing output', { HELM_EXPT_PROOF_OFFLINE_CANDIDATE: '1' }],
  ['repository output', { HELM_EXPT_PROOF_OFFLINE_CANDIDATE: '1', HELM_EXPT_PROOF_OUTPUT_ROOT: '.' }],
  ['online generation', { HELM_EXPT_PROOF_OUTPUT_ROOT: 'runs/candidate' }],
]) test(`minimal lifecycle refuses ${label}`, () => {
  const result = run(env, ['--generate', '--version', '87.19.2']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /isolated offline candidate output root/);
});
for (const args of [['--verify'], ['--verify', '--version', '87.15.1']]) test(`minimal lifecycle requires exact version: ${args.join(' ')}`, () => {
  const result = run({ HELM_EXPT_PROOF_OFFLINE_CANDIDATE: '1', HELM_EXPT_PROOF_OUTPUT_ROOT: 'runs/candidate' }, args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit version 87.19.2/);
});

test('retained minimal lifecycle matches values, source render, image pin and ordered actions', () => {
  const result = run({
    HELM_EXPT_PROOF_OFFLINE_CANDIDATE: '1',
    HELM_EXPT_PROOF_OUTPUT_ROOT: 'runs/prometheus-operator-minimal-candidate',
  });
  assert.equal(result.status, 0, result.stderr);
});
