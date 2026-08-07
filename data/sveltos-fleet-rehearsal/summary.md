# The fleet delivery machinery works on this machine

This rehearsal exists so the governed chapters do not meet their cluster
machinery for the first time on patch day. It built the full reference fleet
and drove the shared delivery path end to end with no ConfigHub involved.

Boundary: no review, approval, or promotion is claimed. Argo CD came from the
pinned upstream manifest instead of cub cluster up, Applications were applied
with kubectl instead of delivered as ConfigHub Units, and the chapter
matrices are untouched. When this receipt was recorded
(2026-08-07), the governed lanes were still
blocked by confighubai/confighub#4975.

What ran: a five-cluster kind fleet (one management cluster, four workload
clusters registered by environment label), Kyverno
3.8.1 converged on all four clusters
from portable OCI digests reconciled by Argo CD
v3.4.6, a values change landed on the
pilot alone, a chart version bump to
3.8.2 landed on the pilot alone with the
values intact, the other three clusters held their state through both, and
injected drift was repaired.

| Phase | Duration |
| --- | --- |
| temporary OCI registry ready | 1.2s |
| management cluster ready | 25.5s |
| Argo CD converged on the management cluster | 64.2s |
| four workload clusters ready | 102.1s |
| Sveltos controllers converged | 89.8s |
| four workload clusters registered | 1s |
| baseline delivered to all four clusters | 147s |
| values change delivered to the pilot only | 34.5s |
| version bump delivered to the pilot only | 104s |
| injected drift repaired on the pilot | 15.3s |
| Total measured | 585s |

| Check | Result |
| --- | --- |
| Clusters converged at baseline | 4/4 |
| Selective values change | pilot only |
| Selective version bump | pilot only, values intact |
| Distinct pilot digests across waves | 3 |
| Drift repaired | pass |
| Cleanup | Pass |

## Limits

- No ConfigHub organization, review, approval, or release was involved; this is not a governance proof.
- The portable OCI used a temporary anonymous registry; this is not a permanent public package.
- The rehearsal used five local kind clusters on one machine. It measures this machine, not a production fleet.
- The chapter matrices are untouched; only the governed lanes may fill their observed cells.

- [Committed receipt](../../runs/sveltos-fleet-rehearsal/receipt.yaml)
- [Rehearsal source lock](../../examples/sveltos/fleet-rehearsal/source-lock.yaml)
