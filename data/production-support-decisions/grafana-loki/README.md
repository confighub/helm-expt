# grafana/loki@7.0.0 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `grafana/loki@7.0.0` |
| Candidate base | `single-binary-filesystem` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=loki; delivery=confighub-oci; controller=argo |
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

- grafana/loki@7.0.0 single-binary-filesystem base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered Loki single-binary, gateway, cache, canary, RBAC, labels, gates, receipts, and support objects produced by the recorded base
- recorded mutable-image exception with digest-resolution evidence for the declared public proof scope
- recorded resource and workload-security warning acceptance for the declared public proof scope
- recorded no-hook desired-object lifecycle policy for the declared public proof scope

Excluded:

- the simple-scalable-minio base unless separately reviewed for a target with enough runtime capacity and object-store policy
- S3 or other object-store production backends, object-store credentials, retention, backup, restore, rollback, and tenant policy unless separately reviewed
- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- populated loki.config, loki.structuredConfig, extraEnv, extraContainers, or raw extraObjects unless reviewed as a new base or managed ConfigHub units
- digest-pinned, resource-hardened, storage-backed, or customer production bases unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/grafana/loki/7.0.0/revisions/single-binary-filesystem/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/grafana/loki/7.0.0/revisions/single-binary-filesystem/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/grafana/loki/7.0.0/revisions/single-binary-filesystem/r001/receipts/scan-receipt.yaml](../../../recipes/grafana/loki/7.0.0/revisions/single-binary-filesystem/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/grafana-loki-single-binary-filesystem/receipt.yaml](../../../runs/live-kind-parity/grafana-loki-single-binary-filesystem/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/grafana-loki-single-binary-filesystem/receipt.yaml](../../../runs/live-helm-confighub-compare/grafana-loki-single-binary-filesystem/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-support-decisions/grafana-loki/fresh-target-evidence-2026-06-08.yaml](../../../data/production-support-decisions/grafana-loki/fresh-target-evidence-2026-06-08.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/image-digest-workdown/receipts/grafana-loki/single-binary-filesystem/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/grafana-loki/single-binary-filesystem/image-digest-resolution.yaml) - The rendered mutable image references for the supported base have registry digest-resolution evidence.
- [data/production-support-decisions/grafana-loki/image-policy-decision.yaml](../../../data/production-support-decisions/grafana-loki/image-policy-decision.yaml) - The target-scoped image policy decision accepts mutable rendered tags for this public proof scope with explicit limits.
- [data/production-support-decisions/grafana-loki/security-decision.yaml](../../../data/production-support-decisions/grafana-loki/security-decision.yaml) - The target-scoped security decision accepts the single-binary warning shape only for this public proof scope.
- [data/production-support-decisions/grafana-loki/lifecycle-decision.yaml](../../../data/production-support-decisions/grafana-loki/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds no-hook desired-object policy, storage boundaries, extension-slot policy, and OCI/Argo runtime health to proof-scope evidence.
- [data/production-disposition/receipts/grafana-loki/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/grafana-loki/cluster-rbac-review.yaml) - The cluster rbac review disposition exists for this chart.
- [data/production-disposition/receipts/grafana-loki/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/grafana-loki/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy disposition exists for this chart.
- [data/production-disposition/receipts/grafana-loki/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/grafana-loki/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy disposition exists for this chart.
- [data/production-disposition/receipts/grafana-loki/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/grafana-loki/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.
- [data/production-disposition/receipts/grafana-loki/storage-backup-restore-and-rollback-policy.yaml](../../../data/production-disposition/receipts/grafana-loki/storage-backup-restore-and-rollback-policy.yaml) - The storage backup restore and rollback policy disposition exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate object-store, retention, backup, restore, tenant, hardening, and digest-pinned bases for real customer Loki workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
