# secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` |
| Candidate base | `default` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=kube-system; delivery=confighub-oci; controller=argo |
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

- secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 default base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered CRDs, CSI DaemonSet, cluster RBAC, labels, gates, receipts, and support objects produced by the default base
- mutable-image exception backed by registry digest-resolution evidence for the rendered image references
- recorded security acceptance, lifecycle observation, live Helm-vs-ConfigHub parity, and two-cluster Helm-vs-installer parity for the declared public proof scope

Excluded:

- sync-secret-rotation unless separately reviewed with provider-specific SecretProviderClass and synced-Secret runtime evidence
- provider-specific SecretProviderClass, external provider, cloud IAM, or secret-store integration unless separately reviewed
- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/secrets-store-csi-driver-secrets-store-csi-driver-default/receipt.yaml](../../../runs/live-kind-parity/secrets-store-csi-driver-secrets-store-csi-driver-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/secrets-store-csi-driver-secrets-store-csi-driver-default/receipt.yaml](../../../runs/live-helm-confighub-compare/secrets-store-csi-driver-secrets-store-csi-driver-default/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-support-decisions/secrets-store-csi-driver-secrets-store-csi-driver/fresh-target-evidence-2026-06-05.yaml](../../../data/production-support-decisions/secrets-store-csi-driver-secrets-store-csi-driver/fresh-target-evidence-2026-06-05.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/image-digest-workdown/receipts/secrets-store-csi-driver-secrets-store-csi-driver/default/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/secrets-store-csi-driver-secrets-store-csi-driver/default/image-digest-resolution.yaml) - Registry digest resolution exists for the rendered default image references.
- [data/production-support-decisions/secrets-store-csi-driver-secrets-store-csi-driver/image-policy-decision.yaml](../../../data/production-support-decisions/secrets-store-csi-driver-secrets-store-csi-driver/image-policy-decision.yaml) - The target-scoped image policy decision records the mutable-image exception and digest-resolution evidence.
- [data/production-support-decisions/secrets-store-csi-driver-secrets-store-csi-driver/security-decision.yaml](../../../data/production-support-decisions/secrets-store-csi-driver-secrets-store-csi-driver/security-decision.yaml) - The target-scoped security decision records the accepted infrastructure security boundary.
- [data/production-support-decisions/secrets-store-csi-driver-secrets-store-csi-driver/lifecycle-decision.yaml](../../../data/production-support-decisions/secrets-store-csi-driver-secrets-store-csi-driver/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds CRD, webhook, node, runtime, and OCI/Argo health to proof-scope evidence.
- [data/production-disposition/receipts/secrets-store-csi-driver-secrets-store-csi-driver/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/secrets-store-csi-driver-secrets-store-csi-driver/cluster-rbac-review.yaml) - The cluster rbac review receipt exists for this chart.
- [data/production-disposition/receipts/secrets-store-csi-driver-secrets-store-csi-driver/crd-lifecycle-and-upgrade-policy.yaml](../../../data/production-disposition/receipts/secrets-store-csi-driver-secrets-store-csi-driver/crd-lifecycle-and-upgrade-policy.yaml) - The crd lifecycle and upgrade policy receipt exists for this chart.
- [data/production-disposition/receipts/secrets-store-csi-driver-secrets-store-csi-driver/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/secrets-store-csi-driver-secrets-store-csi-driver/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy receipt exists for this chart.
- [data/production-disposition/receipts/secrets-store-csi-driver-secrets-store-csi-driver/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/secrets-store-csi-driver-secrets-store-csi-driver/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate provider, sync-secret-rotation, IAM, node-policy, resource-hardened, or digest-pinned bases for real customer secret-store workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
