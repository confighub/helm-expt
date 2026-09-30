// The Kubara page reads kubara-confighub's live proof at a pinned commit.
// These tests carry the contract of the three lanes retired with the helm-expt
// copies of the executors (#1759, #1956): the pinned matrix publishes as live
// only when its overlay is accepted, complete, faithful-current and
// scoped-residue clean, and the mini-IDP and orphan receipts count only while
// they are the pinned bytes naming the pinned upstream implementations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  evaluateKubaraSiteLiveEvidence,
  evaluateKubaraSiteLiveEvidenceDocuments,
  KUBARA_SITE_EVIDENCE_PATHS,
  kubaraEvidencePill,
  kubaraEvidenceState,
  kubaraLiveProofLogs,
  kubaraRecordedMonth,
  loadKubaraSiteLiveEvidenceInput,
  readKubaraProofStatus,
  validateKubaraProofStatus,
} from '../scripts/lib/kubara-site-live-evidence.mjs';
import { lockPath, root } from '../scripts/sync-kubara-upstream-evidence.mjs';

const input = loadKubaraSiteLiveEvidenceInput({ root });
const evaluate = (change) => {
  const copy = structuredClone(input);
  change(copy);
  return evaluateKubaraSiteLiveEvidenceDocuments(copy);
};

test('the pinned proof chain is accepted as complete and consistent', () => {
  const result = evaluateKubaraSiteLiveEvidenceDocuments(structuredClone(input));
  for (const gate of ['miniIdp', 'orphan', 'performance', 'matrix', 'wiring']) {
    assert.equal(result[gate].current, true, `${gate}: ${result[gate].reasons.join('; ')}`);
  }
});

test('the matrix publication gate rejects a rejected, partial, stale or unclean overlay', () => {
  const cases = [
    [(c) => { c.matrix.spec.evidence.miniIdpReceipt.acceptedAsLive = false; }, /acceptedAsLive|current live evidence/],
    [(c) => { c.matrix.spec.evidence.miniIdpReceipt.parsedCells = 35; c.matrix.spec.evidence.parsedObservationCells = 35; }, /parse every live cell/],
    [(c) => { c.matrix.spec.evidence.faithfulReceiptStatus = 'stale-source'; }, /faithful receipt/],
    [(c) => { c.matrix.spec.evidence.orphanReceipt.acceptedAsScopedResidueClean = false; }, /scoped-residue clean/],
    [(c) => { c.matrix.spec.evidence.orphanReceipt.status = 'stale'; }, /scoped-residue clean/],
  ];
  for (const [change, reason] of cases) {
    const result = evaluate(change);
    assert.equal(result.matrix.current, false);
    assert.equal(result.current, false);
    assert.ok(result.matrix.reasons.some((text) => reason.test(text)), result.matrix.reasons.join('; '));
  }
});

test('the orphan audit must name the pinned upstream implementations and plan', () => {
  const cases = [
    [(c) => { c.orphan.spec.source.auditorSha256 = `sha256:${'0'.repeat(64)}`; }, /pinned upstream auditor/],
    [(c) => { c.orphan.spec.source.reconcilerSha256 = `sha256:${'0'.repeat(64)}`; }, /pinned upstream reconciler/],
    [(c) => { c.miniIdp.status.performanceAcceptance.reconcilerSha256 = `sha256:${'0'.repeat(64)}`; }, /acceptance reconciler/],
    [(c) => { c.orphan.spec.source.reconcilePlanSha256 = `sha256:${'0'.repeat(64)}`; }, /reconcile plan/],
    [(c) => { c.pinnedImplementations = { reconciler: null, auditor: null }; }, /pinned upstream/],
    [(c) => { c.canonicalValidation.orphan = { current: false, reason: 'orphan audit receipt differs from the pinned snapshot' }; }, /differs from the pinned snapshot/],
  ];
  for (const [change, reason] of cases) {
    const result = evaluate(change);
    assert.equal(result.orphan.current, false);
    assert.ok(result.orphan.reasons.some((text) => reason.test(text)), result.orphan.reasons.join('; '));
  }
});

test('a receipt that is not the pinned snapshot has no upstream verification', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kubara-site-evidence-'));
  try {
    for (const path of [lockPath, KUBARA_SITE_EVIDENCE_PATHS.miniIdp, KUBARA_SITE_EVIDENCE_PATHS.orphan]) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), readFileSync(join(root, path)));
    }
    writeFileSync(join(dir, KUBARA_SITE_EVIDENCE_PATHS.orphan), `${readFileSync(join(root, KUBARA_SITE_EVIDENCE_PATHS.orphan), 'utf8')}# edited\n`);
    let result = evaluateKubaraSiteLiveEvidence({ root: dir, requireGui: false });
    assert.ok(!result.miniIdp.reasons.some((text) => /pinned in/.test(text)), result.miniIdp.reasons.join('; '));
    assert.ok(result.orphan.reasons.some((text) => /differs from the kubara-confighub snapshot/.test(text)), result.orphan.reasons.join('; '));
    rmSync(join(dir, lockPath));
    result = evaluateKubaraSiteLiveEvidence({ root: dir, requireGui: false });
    assert.ok(result.miniIdp.reasons.some((text) => /no pinned upstream verification/.test(text)), result.miniIdp.reasons.join('; '));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the four-cluster proof is labelled frozen historical evidence, never live', () => {
  const status = readKubaraProofStatus(root);
  assert.equal(status.spec.state, 'historical');
  // The recorded month is the month the accepted receipts were observed.
  assert.ok(input.miniIdp.status.observedAt.startsWith(status.spec.reference.recorded));
  assert.ok(input.orphan.spec.observedAt.startsWith(status.spec.reference.recorded));
  assert.equal(kubaraRecordedMonth(status), 'August 2026');
  assert.equal(kubaraEvidenceState({ accepted: true, status }), 'historical');
  assert.equal(kubaraEvidenceState({ accepted: false, status }), 'gated');
  assert.deepEqual(kubaraEvidencePill({ accepted: true, status, missing: 'x' }), { tone: 'historical', text: 'retained (historical)' });
  assert.deepEqual(kubaraEvidencePill({ accepted: true, status, result: 'audited residue zero', missing: 'x' }), { tone: 'historical', text: 'retained (historical): audited residue zero' });
  assert.deepEqual(kubaraEvidencePill({ accepted: false, status, missing: 'live receipt required' }), { tone: 'warn', text: 'live receipt required' });
  assert.doesNotMatch(kubaraEvidencePill({ accepted: true, status, result: 'performance gate passed' }).text, /live|current/);
  const live = structuredClone(status); live.spec.state = 'live';
  assert.equal(kubaraEvidenceState({ accepted: true, status: live }), 'current');
  assert.deepEqual(kubaraEvidencePill({ accepted: true, status: live }), { tone: 'good', text: 'retained live' });
});

test('a historical proof status must say it is retired, what it predates, and where the live proof is', () => {
  const status = readKubaraProofStatus(root);
  for (const change of [
    (s) => { s.spec.state = 'current'; },
    (s) => { s.spec.reference.retired = false; },
    (s) => { s.spec.reference.rerun = true; },
    (s) => { delete s.spec.reference.predates; },
    (s) => { delete s.spec.currentLiveProof; },
    (s) => { delete s.spec.currentLiveProof.commit; },
    (s) => { s.spec.currentLiveProof.url = 'https://github.com/confighub/kubara-confighub/tree/main/examples/kind-lab'; },
    (s) => { s.spec.currentLiveProof.logs = []; },
    (s) => { s.spec.currentLiveProof.logs[0].path = 'README.md'; },
    (s) => { s.spec.reference.recorded = 'August'; },
    (s) => { s.spec.reference.clusters = ['hx-app-dev']; },
  ]) {
    const copy = structuredClone(status); change(copy);
    assert.throws(() => validateKubaraProofStatus(copy));
  }
});

test('the current live proof is the kind lab at the pinned upstream commit, and its logs link there', () => {
  const status = readKubaraProofStatus(root);
  const lock = JSON.parse(readFileSync(join(root, lockPath), 'utf8'));
  const live = status.spec.currentLiveProof;
  assert.equal(live.repository, lock.repository);
  assert.equal(live.commit, lock.commit);
  assert.equal(live.url, `https://github.com/${lock.repository}/tree/${lock.commit}/examples/kind-lab`);
  const logs = kubaraLiveProofLogs(status);
  assert.ok(logs.length >= 1);
  for (const row of logs) assert.equal(row.url, `https://github.com/${lock.repository}/blob/${lock.commit}/${row.path}`);
});
