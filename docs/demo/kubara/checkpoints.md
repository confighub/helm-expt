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

Every live row below comes from the Kubara v0.13 four-cluster hx-app-*
reference organization, recorded in August 2026. That organization is retired
and is not rerun, and its receipts predate the cub 0.4 field renames. By the
owner's decision of 2026-09-30 the proof is accepted and labelled historical.
The current live proof is the
[kind lab](https://github.com/confighub/kubara-confighub/tree/bd57184d6841d253703fc2a0511432ca99545677/examples/kind-lab)
in confighub/kubara-confighub v0.4.0, with its
[recorded run](https://github.com/confighub/kubara-confighub/blob/bd57184d6841d253703fc2a0511432ca99545677/examples/kind-lab/run-2026-09-30.log),
[recorded hand-back](https://github.com/confighub/kubara-confighub/blob/bd57184d6841d253703fc2a0511432ca99545677/examples/kind-lab/handback-2026-09-30.log),
[run on Kubara v0.16](https://github.com/confighub/kubara-confighub/blob/bd57184d6841d253703fc2a0511432ca99545677/examples/kind-lab/run-v0.16-2026-09-30.log),
[run with a second approver](https://github.com/confighub/kubara-confighub/blob/bd57184d6841d253703fc2a0511432ca99545677/examples/kind-lab/run-approve-2026-09-30.log),
[recovery after `kubara bootstrap`](https://github.com/confighub/kubara-confighub/blob/bd57184d6841d253703fc2a0511432ca99545677/examples/kind-lab/rebootstrap-2026-09-30.log),
[run against ConfigHub v0.8.0](https://github.com/confighub/kubara-confighub/blob/bd57184d6841d253703fc2a0511432ca99545677/examples/kind-lab/run-sdk-2026-10-02.log)
and [run with live status on the Release](https://github.com/confighub/kubara-confighub/blob/bd57184d6841d253703fc2a0511432ca99545677/examples/kind-lab/run-live-status-2026-10-09.log).

| Claim | Exact evidence | Current status |
| --- | --- | --- |
| Kubara remains recognizable and reproducible | [generation receipt](../../../examples/kubara/current-platform/generation-receipt.yaml): Kubara v0.13.0, four clusters, seven exact artifacts, 13 deterministic renders | **Current deterministic** |
| The official and aligned catalogs produce the same platform | [catalog parity receipt](../../../examples/kubara/current-platform/catalog-parity-receipt.yaml): 135 files, path-and-byte-for-byte equality, no differences | **Current deterministic** |
| Catalog alignment is deterministic and does not mutate Kubara source | [adapter receipt](../../../data/kubara-catalog-adapter/receipt.yaml) and its immutable exports | **Current deterministic** |
| ConfigHub retains a component-first catalog without throwing old versions away | [full coverage receipt](../../../data/kubara-catalog-1.1-full-coverage/receipt.yaml): 103 components, 130 versions, all 18 exact selections, 10 exact OCI publications, additive-only/no-overwrite | **Current deterministic** |
| The complete Git hand-off is clean and reproducible | [prepared hand-off receipt](../../../examples/kubara/prepared-current-platform/preparation-receipt.yaml), checksums, exact locks, renders, and wiring | **Current deterministic** |
| The general importer creates per-component/config OCI before an organization is selected, then binds the same bytes to the chosen destination | [importer contract and commands](../../../examples/kubara/git-import/README.md); isolated tests produce 22 packages and a digest index, keep destination facts out of portable OCI, compile the selected-organization journal, and verify a zero-action second run | **Current deterministic, isolated**. The fresh selected-organization live path is still unproved. |
| The familiar Kubara hub-and-spoke lane remains available | [faithful summary](../../../data/kubara-faithful-hub-spoke/summary.md) and exact receipt | **Historical live**: Kubara v0.13.0/current 135-file source, hub Argo, AppProject, ApplicationSets, spoke registration, and selected cert-manager witness passed. |
| ConfigHub can take the hub role while each cluster keeps a local reconciler | [mini-IDP receipt](../../../runs/kubara-mini-idp-reconcile/receipt.yaml) | **Historical live for the retired four-cluster `Kubara` organization**. A fresh user-selected organization import is not yet live-proved. |
| Mutable `latest` cannot bypass governed release selection | All 35 managed Applications retain `targetRevision: latest` as discovery-only, omit `spec.syncPolicy.automated`, run pinned argobot v0.1.6 in Kubernetes hard-refresh-only mode, and reconcile only a revalidated `operation.sync.revision=<ManifestDigest>` submitted with Kubernetes UID/resourceVersion compare-and-set and no active operation | **Historical live for the managed automated path**. This does not cover privileged human/manual Argo sync without separate RBAC or admission proof. |
| No second Argo owner is hidden from the normal view | Cluster-wide Application inventory contains exactly the 35 allowlisted Applications, all in `argocd`, with zero ApplicationSets and no ApplicationSet owner references | **Historical live in the mini-IDP receipt; orphan receipt remains the separate final inventory gate** |
| Retained release history is complete without becoming deployment authority | Every current Release references its same-Space `release-N` Tag, and each retained Tag stream is contiguous from 1 through the current Release number. The exact OCI `ManifestDigest`, not mutable Tag membership, remains Argo authority. | **Historical live in the bracketed receipt snapshots** |
| Production approval is bound to the observed exact head | The client approves the Unit slug at server `HeadRevisionNum`; authoritative reads before and after require unchanged Unit ID, observed numeric head, and `DataHash`, and exactly one cleared gate | **Historical live**. This is bracketed exact-head evidence, not a numeric approval-API compare-and-set claim. |
| Existing workloads can cross immutable selector changes safely | [mini-IDP receipt](../../../runs/kubara-mini-idp-reconcile/receipt.yaml): 16 exact journaled replacements, including four PostgreSQL StatefulSets with retained bound PVC UID and volume identity | **Historical live** |
| Component placement is visible across the fleet | [36-cell matrix](../../../data/kubara-platform-matrix/summary.md) | **Historical live observations exist in the mini-IDP receipt; public projection must be regenerated and verified**. Desired placement/version/departure stays separate from ConfigHub release digest, Argo revision/sync/health, and Kubernetes desired/ready counts. Missing observations remain `Unknown`; disabled cells are `NotApplicable`. |
| Platform wiring is inspectable | [wiring summary](../../../data/kubara-wiring/summary.md): deterministic provides/needs extraction plus 25 curated relationship intents | **Historical live Links in the mini-IDP receipt; public full graph remains deterministic render evidence** |
| Approvals, promotion, rollback, departures, and immutable releases improve day-two operation | Current reconciler contract and [mini-IDP receipt](../../../runs/kubara-mini-idp-reconcile/receipt.yaml) | **Historical live** |
| hx-web and Cubbychat run across their intended targets | Exact release, Argo, and workload observations in the [mini-IDP receipt](../../../runs/kubara-mini-idp-reconcile/receipt.yaml) | **Historical live** |
| The Kubara organization has no unexpected governed inventory or audited runtime residue | Exact ConfigHub allowlist, Argo pruning, five durable-workload types, UID-bound controller ownership, and protected-Namespace checks | **Historical live when `runs/kubara-mini-idp-reconcile/orphan-audit.yaml` passes**. This is not a complete inventory of every Kubernetes resource type. |
| Reconciliation cost is measured honestly | [measured cost model](reconciliation-performance.md), [v2 acceptance contract](../../../data/kubara-mini-idp-performance/contract.yaml), paired-run verifier, and [mini-IDP receipt](../../../runs/kubara-mini-idp-reconcile/receipt.yaml) | **Historical live fixture evidence, not a speed claim**: the immediate no-op made zero ConfigHub mutation attempts and zero Argo sync requests. It recorded 33 ConfigHub CLI read commands for the complete no-op run, 208 total subprocess calls, and about 77 seconds end to end, so the fixture regression target is met. CLI commands are not HTTP round trips; this is not a raw-Kubara comparison or a service-level promise. |

## Commands for current deterministic evidence

These checks do not mutate a live organization or cluster:

```sh
npm run kubara-current-example:verify
npm run kubara-catalog-adapter:verify
npm run kubara-catalog-full-coverage:verify
npm run kubara-git-handoff:verify-current
npm run kubara-app-release:self-test
npm run kubara-upstream-evidence:verify
npm run kubara-wiring:verify
npm run kubara-mini-idp:performance-contract:verify
npm run kubara-mini-idp:performance:self-test
```

The importer and selected-organization self-tests and the matrix
re-derivation belong to the Kubara live proof, which lives in
[confighub/kubara-confighub](https://github.com/confighub/kubara-confighub) since the [#1956](https://github.com/confighub/helm-expt/issues/1956) cutover. Run them there:

```sh
npm run kubara-git-import:self-test
npm run kubara-selected-org:self-test
npm run kubara-platform-matrix:verify
```

Here, `npm run kubara-upstream-evidence:verify` checks that the pinned matrix
and receipts are exactly that repository's bytes at the pinned commit.

Each check has a narrower claim than the complete live journey. Passing them
does not synthesize a live receipt.

## Current live release checkpoint

The current experience becomes suitable for a screenshot-backed sales demo
only when one serial run proves all of the following:

1. faithful hub/spoke evidence is regenerated from the current 135-file tree;
2. the adapted v0.13 mini-IDP applies successfully;
3. an immediate second apply reports zero actions;
4. the paired-run performance receipt is verified without hiding the measured
   cost: the current no-op records 33 ConfigHub CLI read commands, 208 total
   subprocess calls, about 77 seconds, zero ConfigHub mutation attempts, and
   zero Argo sync requests. It meets the fixture regression target, but must
   not be sold as a raw-Kubara comparison, HTTP-round-trip count, or SLO;
5. every required platform and application workload converges;
6. every Argo Application observes the exact current ConfigHub release, keeps
   `latest` discovery-only, and omits automated sync; the pinned refresh-only
   argobot runtime and exact-digest Kubernetes UID/resourceVersion
   compare-and-set are proved;
7. all 16 immutable-selector replacements are terminal and the four
   PostgreSQL PVC identities remain bound and unchanged;
8. the exact ConfigHub inventory and scoped cluster audit report zero
   Argo-prunable, unclassified, dangling, or UID-stale audited residue;
9. the 36-cell matrix is regenerated directly from the accepted receipt and
   preserves desired, ConfigHub release, Argo, and Kubernetes runtime fields;
10. the screenshot-free [pre-capture gate](gui-tour.md#pre-capture-gate)
   passes, then native GUI Components, Units, Links, approvals, history, and OCI digests are
   inspected against the receipt; and
11. exactly six real GUI frames are receipt-bound and the public website is
    regenerated from those artifacts.

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
