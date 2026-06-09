# argo-cd/argo-cd@9.5.15 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `argo-cd/argo-cd@9.5.15` |
| Candidate base | `default` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=argocd; delivery=confighub-oci; controller=argo |
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

- argo-cd/argo-cd@9.5.15 default base
- ConfigHub OCI delivery through an existing Argo CD controller for the declared cub-lk vanilla kind target scope
- rendered Argo CD CRDs, controller workloads, services, labels, gates, receipts, and support objects produced by the recorded base
- declared target-fact preflight for the argocd/argocd-redis auth Secret
- separated generated operational Secrets staged outside ConfigHub Units for the recorded proof scope
- recorded mutable-image exception for the declared public GitOps-controller support scope
- recorded resource-policy acceptance for the declared public GitOps-controller support scope

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- the no-crds target-prerequisite posture unless separately reviewed for a specific target
- zero-to-Argo self-bootstrap; this support scope assumes an existing Argo CD OCI controller reconciles the ConfigHub artifact
- repository credentials, admin credential rotation, SSO, RBAC policy, app state backup/restore, and self-management
- digest-pinned, resource-hardened, or customer production bases unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The supported base is Helm-equivalent under recorded inputs.
- [recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the supported base.
- [runs/live-kind-parity/argo-cd-argo-cd-default/receipt.yaml](../../../runs/live-kind-parity/argo-cd-argo-cd-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the supported base.
- [runs/live-helm-confighub-compare/argo-cd-argo-cd-default/receipt.yaml](../../../runs/live-helm-confighub-compare/argo-cd-argo-cd-default/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the supported base.
- [data/production-support-decisions/argo-cd-argo-cd/fresh-target-evidence-2026-06-09.yaml](../../../data/production-support-decisions/argo-cd-argo-cd/fresh-target-evidence-2026-06-09.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/image-digest-workdown/receipts/argo-cd-argo-cd/default/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/argo-cd-argo-cd/default/image-digest-resolution.yaml) - The rendered mutable image references for the supported base have registry digest-resolution evidence.
- [data/production-support-decisions/argo-cd-argo-cd/image-policy-decision.yaml](../../../data/production-support-decisions/argo-cd-argo-cd/image-policy-decision.yaml) - The target-scoped image policy decision accepts mutable rendered tags for this public GitOps-controller support scope with explicit limits.
- [data/production-support-decisions/argo-cd-argo-cd/security-decision.yaml](../../../data/production-support-decisions/argo-cd-argo-cd/security-decision.yaml) - The target-scoped security decision accepts missing resource requests/limits only for this public cub-lk proof scope.
- [data/production-support-decisions/argo-cd-argo-cd/lifecycle-decision.yaml](../../../data/production-support-decisions/argo-cd-argo-cd/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds CRD ownership, target facts, separated Secrets, and OCI/Argo runtime health to proof-scope observation evidence.
- [data/production-disposition/receipts/argo-cd-argo-cd/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/cluster-rbac-review.yaml) - The cluster rbac review disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/crd-lifecycle-and-upgrade-policy.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/crd-lifecycle-and-upgrade-policy.yaml) - The crd lifecycle and upgrade policy disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/storage-backup-restore-and-rollback-policy.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/storage-backup-restore-and-rollback-policy.yaml) - The storage backup restore and rollback policy disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/target-fact-preflight.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/target-fact-preflight.yaml) - The target fact preflight disposition exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate hardened, self-managed, repository-credential, SSO, or backup/restore bases for real customer GitOps control planes.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
