# The work queue going into September 2026

This page exists so any operator, human, agent, or the review loop, can continue the work from a cold start. Every item links an issue that stands alone, and the deeper context lives in the linked planning docs. When an item lands, close its issue and strike it here in the same change.

The state of the site itself: the vocabulary is settled ([cub-noun-vocabulary.md](./cub-noun-vocabulary.md)), the value ladder is on the spine, two audit rounds are acted on, and the homepage carries the recorded-live platform story. The site is ready for real visitors.

## Continue the replica track, in order

The staged plan is [eks-inf-replica-plan.md](./eks-inf-replica-plan.md). Stage A.1 landed with the closure map in [data/eks-inf-replica](../../data/eks-inf-replica/summary.md).

1. ~~[#1671](https://github.com/confighub/helm-expt/issues/1671) Stage A.2. Rebuild the three rendered components from catalog inputs and compare object sets.~~ Done: [the parity report](../../data/eks-inf-replica/parity.md) shows byte-exact literals, spec parity except the ACK deletion policy, sync-wave ordering as the one metadata class, and seven authored objects.
2. ~~[#1672](https://github.com/confighub/helm-expt/issues/1672) Stage B. Run the composition verdict of [composition-certification.md](./composition-certification.md) over the assembled stack, its first real target.~~ Done: [the verdict](../../data/eks-inf-replica/composition-verdict.md) passes five checks, names findings on three, catches the hand-caught karpenter-aws defect and more, and proves every check can fail via self-test.
3. ~~[#1673](https://github.com/confighub/helm-expt/issues/1673) Stage C. Rebuild the ConfigHub organization with generic tooling and compare it with the plugin's own sandbox build.~~ Done, shape parity: [the comparison](../../data/eks-inf-replica/org-rebuild/comparison.md) finds the twenty-space rebuild identical to the plugin's on every compared dimension, and the run leaves the server as it found it.
4. ~~[#1674](https://github.com/confighub/helm-expt/issues/1674) Stage D. Accept the inference workloads on simulated GPU capacity through the governed path.~~ Done: [the receipt](../../data/eks-inf-replica/sim-gpu/receipt.yaml) shows the governed delivery, the pre-capacity refusal, both GPU pods scheduling onto simulated capacity, and the smoke pod's own log naming the boundary.
5. [#1581](https://github.com/confighub/helm-expt/issues/1581) The real H100 serving run stays the final rung, blocked on GPU capacity and NGC access. Its receipt is what earns the AI story a homepage card; until then the homepage keeps the calm AI door by owner decision.

## Close the delivery and proof follow-ups

- ~~[#1675](https://github.com/confighub/helm-expt/issues/1675) Repeat the proven Argo delivery lane with Flux as the reconciler, kind only.~~ Done: [the receipt](../../data/eks-inf-replica/flux-delivery/receipt.yaml) shows two exact digest handoffs, the initial release and a governed change, with Flux applying precisely the digests ConfigHub published.
- ~~[#1677](https://github.com/confighub/helm-expt/issues/1677) Record an AI operator driving the whole ladder, check, upload, release, promote, as committed evidence with the human approving at the gates.~~ Done: [the receipt](../../data/ai-operator-ladder/receipt.yaml) carries every rung, the refused-then-approved gate, the reproduced clone trap and its fix, and the promoted set equal to the base head canonically.
- [#1667](https://github.com/confighub/helm-expt/issues/1667) Surface the existing package and index signing on the security page, with the trust anchor named exactly.

## Finish the vocabulary alignment

- ~~[#1676](https://github.com/confighub/helm-expt/issues/1676) Align the prototype cub scripts under examples/cub-* with the settled noun and verb table.~~ Done: check inspects a config or an app, sandbox renders a stack, upload replaces install, and the help text carries the same one-line meanings.

## Prepare the human-gated proofs

- [#1678](https://github.com/confighub/helm-expt/issues/1678) Write the real-human trial protocol. Running the first three trials then needs only three links sent by the owner.
- The fresh-organization acceptance run for the Kubara example is staged in confighub/kubara-confighub#8. Everything is preparable by an agent; creating and selecting the fresh organization is the owner's step.
- The commercial roadtest and the config-versus-component naming decision are owner conversations. The pitch materials exist outside this repository.

## Hand the engineering builds to their owners

- [#1660](https://github.com/confighub/helm-expt/issues/1660) The disruptive-change classifier on proven blast-radius evidence.
- [#1582](https://github.com/confighub/helm-expt/issues/1582) The GPU Operator release review and promotion test.
- A live-state reporter that feeds fleet state back into ConfigHub is named in the demand map but has no owner or issue yet, because it belongs to the product rather than this repository.

## Leave the parked work parked

The cub 0.4 migration PRs, [#1635](https://github.com/confighub/helm-expt/pull/1635), [#1651](https://github.com/confighub/helm-expt/pull/1651), and [#1652](https://github.com/confighub/helm-expt/pull/1652), stay with the review loop that owns merges. Do not rebase or absorb them from here.
