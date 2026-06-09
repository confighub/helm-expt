# bitnami/rabbitmq@16.0.14 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `bitnami/rabbitmq@16.0.14` |
| Candidate base | `generated-passwords` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=rabbitmq; delivery=confighub-oci; controller=argo |
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

- bitnami/rabbitmq@16.0.14 generated-passwords base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered RabbitMQ StatefulSet, Service, PVC, PDB, generated Secrets, labels, gates, receipts, and support objects produced by the recorded base
- mutable-image exception backed by registry digest-resolution evidence for the rendered image references
- generated RabbitMQ administrator password and Erlang cookie bound before render, rendered deterministically, and separated by cub installer output
- recorded PDB warning acceptance and no-hooks lifecycle policy for the declared public proof scope

Excluded:

- existing-secret unless separately reviewed for target credential presence, Erlang cookie presence, custody, and rotation policy
- RabbitMQ clustering, queue/message recovery, backup, restore, failover, credential rotation, Erlang-cookie rotation, and storage-class/SLO policy unless separately reviewed
- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- custom configuration, advanced configuration, init scripts, external credentials, resource-hardened, storage-hardened, or customer production bases unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/bitnami/rabbitmq/16.0.14/revisions/generated-passwords/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/bitnami/rabbitmq/16.0.14/revisions/generated-passwords/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/bitnami/rabbitmq/16.0.14/revisions/generated-passwords/r001/receipts/scan-receipt.yaml](../../../recipes/bitnami/rabbitmq/16.0.14/revisions/generated-passwords/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/bitnami-rabbitmq-generated-passwords/receipt.yaml](../../../runs/live-kind-parity/bitnami-rabbitmq-generated-passwords/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/bitnami-rabbitmq-generated-passwords/receipt.yaml](../../../runs/live-helm-confighub-compare/bitnami-rabbitmq-generated-passwords/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-support-decisions/bitnami-rabbitmq/fresh-target-evidence-2026-06-05.yaml](../../../data/production-support-decisions/bitnami-rabbitmq/fresh-target-evidence-2026-06-05.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/image-digest-workdown/receipts/bitnami-rabbitmq/generated-passwords/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/bitnami-rabbitmq/generated-passwords/image-digest-resolution.yaml) - Registry digest resolution exists for the rendered generated-passwords RabbitMQ image reference.
- [data/production-support-decisions/bitnami-rabbitmq/image-policy-decision.yaml](../../../data/production-support-decisions/bitnami-rabbitmq/image-policy-decision.yaml) - The target-scoped image policy decision records the mutable-image exception and digest-resolution evidence.
- [data/production-support-decisions/bitnami-rabbitmq/security-decision.yaml](../../../data/production-support-decisions/bitnami-rabbitmq/security-decision.yaml) - The target-scoped security decision accepts the generated-passwords PDB warning shape only for this public proof scope.
- [data/production-support-decisions/bitnami-rabbitmq/lifecycle-decision.yaml](../../../data/production-support-decisions/bitnami-rabbitmq/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds no-hooks policy, generated credential ownership, separated Secret handling, storage boundaries, and OCI/Argo runtime health to proof-scope evidence.
- [data/production-disposition/receipts/bitnami-rabbitmq/generated-fact-ownership.yaml](../../../data/production-disposition/receipts/bitnami-rabbitmq/generated-fact-ownership.yaml) - The generated fact ownership disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-rabbitmq/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/bitnami-rabbitmq/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-rabbitmq/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/bitnami-rabbitmq/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-rabbitmq/storage-backup-restore-and-rollback-policy.yaml](../../../data/production-disposition/receipts/bitnami-rabbitmq/storage-backup-restore-and-rollback-policy.yaml) - The storage backup restore and rollback policy disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-rabbitmq/target-fact-preflight.yaml](../../../data/production-disposition/receipts/bitnami-rabbitmq/target-fact-preflight.yaml) - The target fact preflight disposition exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate existing-secret, clustering, backup/restore, queue-recovery, failover, credential-rotation, Erlang-cookie-rotation, storage-class, SLO, or resource-hardened bases for real customer RabbitMQ workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
