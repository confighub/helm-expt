# longhorn/longhorn@1.11.2 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `longhorn/longhorn@1.11.2` |
| Candidate base | `default` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=longhorn-system; delivery=confighub-oci; controller=argo |
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

- longhorn/longhorn@1.11.2 default base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered Longhorn CRDs, storage controllers, CSI components, webhooks, UI, cluster RBAC, labels, gates, receipts, and support objects produced by the default base
- mutable-image exception backed by registry digest-resolution evidence for the rendered image references
- recorded security acceptance, lifecycle observation, live Helm-vs-ConfigHub parity, and two-cluster Helm-vs-installer parity for the declared public proof scope

Excluded:

- ui-ingress unless separately reviewed with ingress, DNS, and TLS evidence
- backup, restore, recurring jobs, snapshot policy, replica policy, default storage class changes, and upgrade/failover operations unless separately reviewed
- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/longhorn/longhorn/1.11.2/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/longhorn/longhorn/1.11.2/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/longhorn/longhorn/1.11.2/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/longhorn/longhorn/1.11.2/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/longhorn-longhorn-default/receipt.yaml](../../../runs/live-kind-parity/longhorn-longhorn-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/longhorn-longhorn-default/receipt.yaml](../../../runs/live-helm-confighub-compare/longhorn-longhorn-default/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-support-decisions/longhorn-longhorn/fresh-target-evidence-2026-06-08.yaml](../../../data/production-support-decisions/longhorn-longhorn/fresh-target-evidence-2026-06-08.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/image-digest-workdown/receipts/longhorn-longhorn/default/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/longhorn-longhorn/default/image-digest-resolution.yaml) - Registry digest resolution exists for the rendered default image references.
- [data/production-support-decisions/longhorn-longhorn/image-policy-decision.yaml](../../../data/production-support-decisions/longhorn-longhorn/image-policy-decision.yaml) - The target-scoped image policy decision records the mutable-image exception and digest-resolution evidence.
- [data/production-support-decisions/longhorn-longhorn/security-decision.yaml](../../../data/production-support-decisions/longhorn-longhorn/security-decision.yaml) - The target-scoped security decision records the accepted infrastructure security boundary.
- [data/production-support-decisions/longhorn-longhorn/lifecycle-decision.yaml](../../../data/production-support-decisions/longhorn-longhorn/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds CRD, webhook, node, runtime, and OCI/Argo health to proof-scope evidence.
- [data/production-disposition/receipts/longhorn-longhorn/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/longhorn-longhorn/cluster-rbac-review.yaml) - The cluster rbac review receipt exists for this chart.
- [data/production-disposition/receipts/longhorn-longhorn/crd-lifecycle-and-upgrade-policy.yaml](../../../data/production-disposition/receipts/longhorn-longhorn/crd-lifecycle-and-upgrade-policy.yaml) - The crd lifecycle and upgrade policy receipt exists for this chart.
- [data/production-disposition/receipts/longhorn-longhorn/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/longhorn-longhorn/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.
- [data/production-disposition/receipts/longhorn-longhorn/webhook-readiness-and-failure-policy.yaml](../../../data/production-disposition/receipts/longhorn-longhorn/webhook-readiness-and-failure-policy.yaml) - The webhook readiness and failure policy receipt exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate backup/restore, upgrade, replica-policy, storage-class, UI-ingress, resource-hardened, or digest-pinned bases for real customer Longhorn workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
