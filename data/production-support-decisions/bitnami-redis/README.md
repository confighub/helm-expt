# bitnami/redis@25.5.3 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `bitnami/redis@25.5.3` |
| Candidate base | `default` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=redis; delivery=confighub-oci; controller=argo |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Keep fresh | Keep target-scoped evidence fresh before using this supported scope as an example. |


## Closeout Sequence

1. Keep the target-scoped evidence fresh for the declared support boundary.

## Required Before Final Support

- None.


## Support Boundary

Included:

- bitnami/redis@25.5.3 default base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered Redis StatefulSets, Services, PodDisruptionBudgets, labels, gates, receipts, and support objects produced by the recorded base
- generated Redis password bound before render through the generated-fact receipt
- separated Redis Secret staged outside the workload OCI artifact before apply or sync
- recorded PDB warning acceptance for the declared public teaching and parity proof scope
- recorded no-hooks lifecycle policy for the declared public teaching and parity proof scope

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- the reuse-existing-secret target-fact posture unless separately reviewed for a specific target
- backup, restore, failover, persistence class, sizing, and customer SLO tuning
- digest-pinned, availability-hardened, or customer production bases unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The supported base is Helm-equivalent under recorded inputs.
- [recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the supported base.
- [runs/live-kind-parity/bitnami-redis-default/receipt.yaml](../../../runs/live-kind-parity/bitnami-redis-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the supported base.
- [runs/live-helm-confighub-compare/bitnami-redis-default/receipt.yaml](../../../runs/live-helm-confighub-compare/bitnami-redis-default/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the supported base.
- [data/production-support-decisions/bitnami-redis/fresh-target-evidence-2026-06-05.yaml](../../../data/production-support-decisions/bitnami-redis/fresh-target-evidence-2026-06-05.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/production-support-decisions/bitnami-redis/security-decision.yaml](../../../data/production-support-decisions/bitnami-redis/security-decision.yaml) - The target-scoped security decision accepts Redis PDB warnings only for this public proof scope.
- [data/production-support-decisions/bitnami-redis/lifecycle-decision.yaml](../../../data/production-support-decisions/bitnami-redis/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds generated facts, separated Secret staging, no-hooks policy, and OCI/Argo runtime health to proof-scope evidence.
- [data/production-disposition/receipts/bitnami-redis/generated-fact-ownership.yaml](../../../data/production-disposition/receipts/bitnami-redis/generated-fact-ownership.yaml) - The generated fact ownership disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-redis/hook-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/bitnami-redis/hook-lifecycle-phase-policy.yaml) - The hook lifecycle phase policy disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-redis/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/bitnami-redis/scan-gate-warning-disposition.yaml) - The scan gate warning disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-redis/target-fact-preflight.yaml](../../../data/production-disposition/receipts/bitnami-redis/target-fact-preflight.yaml) - The target fact preflight disposition exists for the reuse-existing-secret variant.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate existing-secret, backup/restore, failover, storage-class, SLO, or availability-hardened bases for real customer Redis workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
