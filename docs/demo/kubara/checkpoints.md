# Kubara + ConfigHub evidence checkpoints

This page is the claim ledger for the buyer journey. A feature being
implemented is not enough: every claim says whether its evidence is current,
offline deterministic, historical, or still waiting for a source-current live
receipt.

Return to the [buyer overview](index.md), follow the
[six-step tutorial](adoption.md), or open the
[complete technical reference](single-platform.md).

## Status meanings

| Status | Meaning |
| --- | --- |
| **Current deterministic** | Recomputed from current committed source without relying on an old live environment. |
| **Current live** | Bound to current source and an exact dated observation of ConfigHub, Argo CD, and/or Kubernetes. |
| **Historical live** | A real retained observation, useful for lineage but not evidence for the current source. |
| **Waiting for current live proof** | Implemented or generated, but the exact current live receipt is absent or rejected. |

## Adoption and benefit ledger

| Claim | Exact evidence | Current status |
| --- | --- | --- |
| Kubara remains recognizable and reproducible | [generation receipt](../../../examples/kubara/current-platform/generation-receipt.yaml): Kubara v0.13.0, four clusters, seven exact artifacts, 13 deterministic renders | **Current deterministic** |
| The official and aligned catalogs produce the same platform | [catalog parity receipt](../../../examples/kubara/current-platform/catalog-parity-receipt.yaml): 135 files, path-and-byte-for-byte equality, no differences | **Current deterministic** |
| Catalog alignment is deterministic and does not mutate Kubara source | [adapter receipt](../../../data/kubara-catalog-adapter/receipt.yaml) and its immutable exports | **Current deterministic** |
| ConfigHub retains a component-first catalog without throwing old versions away | [full coverage receipt](../../../data/kubara-catalog-1.1-full-coverage/receipt.yaml): 103 components, 130 versions, all 18 exact selections, 10 exact OCI publications, additive-only/no-overwrite | **Current deterministic** |
| The complete Git hand-off is clean and reproducible | [prepared hand-off receipt](../../../examples/kubara/prepared-current-platform/preparation-receipt.yaml), checksums, exact locks, renders, and wiring | **Current deterministic** |
| The general importer creates per-component/config OCI instead of one giant artifact | [importer contract and commands](../../../examples/kubara/git-import/README.md); isolated self-test produces 22 packages and a digest index and verifies a zero-action second run | **Current deterministic, isolated** |
| The familiar Kubara hub-and-spoke lane remains available | [faithful summary](../../../data/kubara-faithful-hub-spoke/summary.md) | **Waiting for source-current refresh**: retained proof is tied to the earlier 131-file tree, while current source has 135 files. |
| ConfigHub can take the hub role while each cluster keeps a local reconciler | Current mini-IDP reconciler and the retained historical organization-shape receipt | **Waiting for current live proof** |
| Component placement is visible across the fleet | [36-cell matrix](../../../data/kubara-platform-matrix/summary.md) | **Current deterministic desired state; live fields waiting** |
| Platform wiring is inspectable | [wiring summary](../../../data/kubara-wiring/summary.md): deterministic provides/needs extraction plus curated relationship intent | **Current deterministic graph; native live Links waiting** |
| Approvals, promotion, rollback, departures, and immutable releases improve day-two operation | Current reconciler contract plus retained isolated and historical receipts | **Waiting for current integrated live proof** |
| hx-web and Cubbychat run across their intended targets | Digest-pinned application source and desired matrix rows | **Waiting for current integrated live proof** |
| The Kubara organization is exact and orphan-free | Exact allowlist auditor and protected-Namespace checks | **Waiting for `runs/kubara-mini-idp-reconcile/orphan-audit.yaml`** |
| Reconciliation is acceptably fast | [measured cost model](reconciliation-performance.md) | **Measurement in progress**; do not sell speed before a successful end-to-end receipt meets the target. |

## Commands for current deterministic evidence

These checks do not mutate a live organization or cluster:

```sh
npm run kubara-current-example:verify
npm run kubara-catalog-adapter:verify
npm run kubara-catalog-full-coverage:verify
npm run kubara-git-handoff:verify-current
npm run kubara-git-import:self-test
npm run kubara-platform-matrix:verify
npm run kubara-wiring:verify
```

Each check has a narrower claim than the complete live journey. Passing them
does not synthesize a live receipt.

## Current live release checkpoint

The current experience becomes suitable for a screenshot-backed sales demo
only when one serial run proves all of the following:

1. faithful hub/spoke evidence is regenerated from the current 135-file tree;
2. the adapted v0.13 mini-IDP applies successfully;
3. an immediate second apply reports zero actions;
4. every required platform and application workload converges;
5. every Argo Application observes the exact current ConfigHub release;
6. the exact ConfigHub inventory and cluster audit report zero orphans;
7. the 36-cell matrix is regenerated from the accepted receipt;
8. native GUI Components, Units, Links, approvals, history, and OCI digests are
   inspected against the receipt; and
9. the public website is regenerated from those artifacts.

## Evidence that must remain separate

- Faithful Kubara topology and adapted ConfigHub delivery are two lanes, not
  two names for one topology.
- Desired-state matrix cells and live-observed cells are visually distinct.
- Extracted wiring facts, curated native Links, and runtime dependency health
  are related but different claims.
- OCI publication, live delivery, and production support are different proof
  levels.
- An isolated importer self-test and a fresh user-selected organization import
  are different proof levels.
- Historical v0.12 receipts remain valuable history but never substitute for a
  current v0.13 result.

Next: [walk through the intended ConfigHub GUI experience](gui-tour.md).
