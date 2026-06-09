# argo-cd/argo-cd@9.5.15 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `argo-cd/argo-cd@9.5.15` |
| Candidate base | `default` |
| Decision state | `draft` |
| Target scope | vanilla-kubernetes; namespace=argo-cd; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Image digest | Pin rendered image references by digest or record an explicit mutable-image exception. |
| Scan scope | Record which scanner findings are accepted, fixed, or outside this target scope. |
| Fresh evidence | Refresh ConfigHub OCI/GitOps and live/e2e evidence after earlier decisions are closed. |


## Required Before Final Support

- Choose the final target scope, exact GitOps controller, namespace, and artifact digest.
- Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.
- resolve image digests or record explicit exception before production OCI support

## Support Boundary

Included:

- argo-cd/argo-cd@9.5.15 default base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/argo-cd/argo-cd/9.5.15/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/argo-cd-argo-cd-default/receipt.yaml](../../../runs/live-kind-parity/argo-cd-argo-cd-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/argo-cd-argo-cd-default/receipt.yaml](../../../runs/live-helm-confighub-compare/argo-cd-argo-cd-default/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-disposition/receipts/argo-cd-argo-cd/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/cluster-rbac-review.yaml) - The cluster rbac review disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/crd-lifecycle-and-upgrade-policy.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/crd-lifecycle-and-upgrade-policy.yaml) - The crd lifecycle and upgrade policy disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/storage-backup-restore-and-rollback-policy.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/storage-backup-restore-and-rollback-policy.yaml) - The storage backup restore and rollback policy disposition exists for this chart.
- [data/production-disposition/receipts/argo-cd-argo-cd/target-fact-preflight.yaml](../../../data/production-disposition/receipts/argo-cd-argo-cd/target-fact-preflight.yaml) - The target fact preflight disposition exists for this chart.

## Next Action

resolve image digests for each affected variant before production OCI support

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
