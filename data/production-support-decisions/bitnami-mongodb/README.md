# bitnami/mongodb@19.0.7 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `bitnami/mongodb@19.0.7` |
| Candidate base | `static-passwords` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=mongodb; delivery=confighub-oci; controller=argo |
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

- bitnami/mongodb@19.0.7 static-passwords base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered MongoDB Deployment, Service, PVC, PDB, Secret, labels, gates, receipts, and support objects produced by the recorded base
- digest-pinned upstream image references recorded in the proof corpus
- generated MongoDB root password bound before render, rendered deterministically, and separated by cub installer output
- recorded PDB warning acceptance and no-hooks lifecycle policy for the declared public proof scope

Excluded:

- existing-secret-replicaset unless separately reviewed for target runtime behavior
- replica-set topology, failover, backup, restore, point-in-time recovery, credential rotation, and storage-class/SLO policy unless separately reviewed
- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- init scripts, extended configuration, external credentials, resource-hardened, storage-hardened, or customer production bases unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/bitnami/mongodb/19.0.7/revisions/static-passwords/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/bitnami/mongodb/19.0.7/revisions/static-passwords/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/bitnami/mongodb/19.0.7/revisions/static-passwords/r001/receipts/scan-receipt.yaml](../../../recipes/bitnami/mongodb/19.0.7/revisions/static-passwords/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/bitnami-mongodb-static-passwords/receipt.yaml](../../../runs/live-kind-parity/bitnami-mongodb-static-passwords/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/bitnami-mongodb-static-passwords/receipt.yaml](../../../runs/live-helm-confighub-compare/bitnami-mongodb-static-passwords/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-support-decisions/bitnami-mongodb/fresh-target-evidence-2026-06-05.yaml](../../../data/production-support-decisions/bitnami-mongodb/fresh-target-evidence-2026-06-05.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/production-support-decisions/bitnami-mongodb/image-policy-decision.yaml](../../../data/production-support-decisions/bitnami-mongodb/image-policy-decision.yaml) - The target-scoped image policy decision records that MongoDB image references are digest-pinned in the current proof corpus.
- [data/production-support-decisions/bitnami-mongodb/security-decision.yaml](../../../data/production-support-decisions/bitnami-mongodb/security-decision.yaml) - The target-scoped security decision accepts the static-passwords PDB warning shape only for this public proof scope.
- [data/production-support-decisions/bitnami-mongodb/lifecycle-decision.yaml](../../../data/production-support-decisions/bitnami-mongodb/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds no-hooks policy, generated credential ownership, separated Secret handling, storage boundaries, and OCI/Argo runtime health to proof-scope evidence.
- [data/production-disposition/receipts/bitnami-mongodb/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy receipt exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/generated-fact-ownership.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/generated-fact-ownership.yaml) - The generated fact ownership receipt exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy receipt exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/storage-backup-restore-and-rollback-policy.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/storage-backup-restore-and-rollback-policy.yaml) - The storage backup restore and rollback policy receipt exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/target-fact-preflight.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/target-fact-preflight.yaml) - The target fact preflight receipt exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate existing-secret, replica-set, backup/restore, failover, credential-rotation, storage-class, SLO, or resource-hardened bases for real customer MongoDB workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
