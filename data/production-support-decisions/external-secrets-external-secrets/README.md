# external-secrets/external-secrets@2.5.0 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `external-secrets/external-secrets@2.5.0` |
| Candidate base | `default` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=external-secrets; delivery=confighub-oci; controller=argo |
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

- external-secrets/external-secrets@2.5.0 default base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base
- recorded mutable-image exception for the declared public controller support scope
- recorded resource-policy acceptance for the declared public controller support scope
- controller-owned webhook lifecycle observation for the declared public controller support scope

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- SecretStore, ClusterSecretStore, ExternalSecret, PushSecret, provider credentials, and provider-specific workloads
- digest-pinned, resource-hardened, or provider-specific production bases unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/external-secrets/external-secrets/2.5.0/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/external-secrets-external-secrets-default/receipt.yaml](../../../runs/live-kind-parity/external-secrets-external-secrets-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/external-secrets-external-secrets-default/receipt.yaml](../../../runs/live-helm-confighub-compare/external-secrets-external-secrets-default/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-support-decisions/external-secrets-external-secrets/fresh-target-evidence-2026-06-08.yaml](../../../data/production-support-decisions/external-secrets-external-secrets/fresh-target-evidence-2026-06-08.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/image-digest-workdown/receipts/external-secrets-external-secrets/default/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/external-secrets-external-secrets/default/image-digest-resolution.yaml) - The rendered mutable image references for the candidate base have registry digest-resolution evidence.
- [data/production-support-decisions/external-secrets-external-secrets/image-policy-decision.yaml](../../../data/production-support-decisions/external-secrets-external-secrets/image-policy-decision.yaml) - The target-scoped image policy decision accepts mutable rendered tags for this public controller support scope with explicit limits.
- [data/production-support-decisions/external-secrets-external-secrets/security-decision.yaml](../../../data/production-support-decisions/external-secrets-external-secrets/security-decision.yaml) - The target-scoped security decision accepts missing resource requests/limits only for this public cub-lk proof scope.
- [data/production-support-decisions/external-secrets-external-secrets/lifecycle-decision.yaml](../../../data/production-support-decisions/external-secrets-external-secrets/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds controller-owned webhook fields and CRD readiness to proof-scope observation evidence.
- [data/production-disposition/receipts/external-secrets-external-secrets/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/external-secrets-external-secrets/cluster-rbac-review.yaml) - The cluster rbac review receipt exists for this chart.
- [data/production-disposition/receipts/external-secrets-external-secrets/crd-lifecycle-and-upgrade-policy.yaml](../../../data/production-disposition/receipts/external-secrets-external-secrets/crd-lifecycle-and-upgrade-policy.yaml) - The crd lifecycle and upgrade policy receipt exists for this chart.
- [data/production-disposition/receipts/external-secrets-external-secrets/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/external-secrets-external-secrets/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy receipt exists for this chart.
- [data/production-disposition/receipts/external-secrets-external-secrets/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/external-secrets-external-secrets/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.
- [data/production-disposition/receipts/external-secrets-external-secrets/target-fact-preflight.yaml](../../../data/production-disposition/receipts/external-secrets-external-secrets/target-fact-preflight.yaml) - The target fact preflight receipt exists for this chart.
- [data/production-disposition/receipts/external-secrets-external-secrets/webhook-readiness-and-failure-policy.yaml](../../../data/production-disposition/receipts/external-secrets-external-secrets/webhook-readiness-and-failure-policy.yaml) - The webhook readiness and failure policy receipt exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate provider-specific bases for SecretStore and ExternalSecret use cases.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
