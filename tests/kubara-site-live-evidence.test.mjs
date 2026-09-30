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
  loadKubaraSiteLiveEvidenceInput,
} from '../scripts/lib/kubara-site-live-evidence.mjs';
import { lockPath, root } from '../scripts/sync-kubara-upstream-evidence.mjs';

const input = loadKubaraSiteLiveEvidenceInput({ root });
const evaluate = (change) => {
  const copy = structuredClone(input);
  change(copy);
  return evaluateKubaraSiteLiveEvidenceDocuments(copy);
};

test('the pinned proof is accepted as the current live chain', () => {
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
