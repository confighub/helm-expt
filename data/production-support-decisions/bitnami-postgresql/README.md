# bitnami/postgresql@18.6.7 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `bitnami/postgresql@18.6.7` |
| Candidate base | `generated-passwords` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=postgresql; delivery=confighub-oci; controller=argo |
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

- bitnami/postgresql@18.6.7 generated-passwords base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered PostgreSQL StatefulSet, Service, PVC, PDB, generated Secret, labels, gates, receipts, and support objects produced by the recorded base
- digest-pinned upstream image references recorded in the proof corpus
- generated PostgreSQL postgres password bound before render, rendered deterministically, and separated by cub installer output
- recorded PDB warning acceptance and no-hooks lifecycle policy for the declared public proof scope

Excluded:

- existing-secret unless separately reviewed for target credential presence, custody, and rotation policy
- replication, backup, restore, point-in-time recovery, failover, credential rotation, and storage-class/SLO policy unless separately reviewed
- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- init scripts, extended configuration, external credentials, resource-hardened, storage-hardened, or customer production bases unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/bitnami/postgresql/18.6.7/revisions/generated-passwords/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/bitnami/postgresql/18.6.7/revisions/generated-passwords/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/bitnami/postgresql/18.6.7/revisions/generated-passwords/r001/receipts/scan-receipt.yaml](../../../recipes/bitnami/postgresql/18.6.7/revisions/generated-passwords/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/bitnami-postgresql-generated-passwords/receipt.yaml](../../../runs/live-kind-parity/bitnami-postgresql-generated-passwords/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/bitnami-postgresql-generated-passwords/receipt.yaml](../../../runs/live-helm-confighub-compare/bitnami-postgresql-generated-passwords/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-support-decisions/bitnami-postgresql/fresh-target-evidence-2026-06-05.yaml](../../../data/production-support-decisions/bitnami-postgresql/fresh-target-evidence-2026-06-05.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/production-support-decisions/bitnami-postgresql/image-policy-decision.yaml](../../../data/production-support-decisions/bitnami-postgresql/image-policy-decision.yaml) - The target-scoped image policy decision records that PostgreSQL image references are digest-pinned in the current proof corpus.
- [data/production-support-decisions/bitnami-postgresql/security-decision.yaml](../../../data/production-support-decisions/bitnami-postgresql/security-decision.yaml) - The target-scoped security decision accepts the generated-passwords PDB warning shape only for this public proof scope.
- [data/production-support-decisions/bitnami-postgresql/lifecycle-decision.yaml](../../../data/production-support-decisions/bitnami-postgresql/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds no-hooks policy, generated credential ownership, separated Secret handling, storage boundaries, and OCI/Argo runtime health to proof-scope evidence.
- [data/production-disposition/receipts/bitnami-postgresql/generated-fact-ownership.yaml](../../../data/production-disposition/receipts/bitnami-postgresql/generated-fact-ownership.yaml) - The generated fact ownership receipt exists for this chart.
- [data/production-disposition/receipts/bitnami-postgresql/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/bitnami-postgresql/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy receipt exists for this chart.
- [data/production-disposition/receipts/bitnami-postgresql/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/bitnami-postgresql/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.
- [data/production-disposition/receipts/bitnami-postgresql/storage-backup-restore-and-rollback-policy.yaml](../../../data/production-disposition/receipts/bitnami-postgresql/storage-backup-restore-and-rollback-policy.yaml) - The storage backup restore and rollback policy receipt exists for this chart.
- [data/production-disposition/receipts/bitnami-postgresql/target-fact-preflight.yaml](../../../data/production-disposition/receipts/bitnami-postgresql/target-fact-preflight.yaml) - The target fact preflight receipt exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate existing-secret, backup/restore, point-in-time-recovery, failover, credential-rotation, storage-class, SLO, replication, or resource-hardened bases for real customer PostgreSQL workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
