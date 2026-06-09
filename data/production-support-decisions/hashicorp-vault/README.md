# hashicorp/vault@0.32.0 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `hashicorp/vault@0.32.0` |
| Candidate base | `default` |
| Decision state | `rejected` |
| Target scope | vanilla-kubernetes; namespace=vault; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

- No open generated work item for this decision.


## Closeout Sequence

1. Choose the final target scope, GitOps controller, namespace, and artifact digest.

## Required Before Final Support

- None.


## Support Boundary

Included:

- hashicorp/vault@0.32.0 default base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/hashicorp/vault/0.32.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/hashicorp/vault/0.32.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/hashicorp/vault/0.32.0/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/hashicorp/vault/0.32.0/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/hashicorp-vault-default/receipt.yaml](../../../runs/live-kind-parity/hashicorp-vault-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/hashicorp-vault-default/receipt.yaml](../../../runs/live-helm-confighub-compare/hashicorp-vault-default/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-disposition/receipts/hashicorp-vault/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/hashicorp-vault/cluster-rbac-review.yaml) - The cluster rbac review receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-vault/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/hashicorp-vault/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-vault/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/hashicorp-vault/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-vault/storage-backup-restore-and-rollback-policy.yaml](../../../data/production-disposition/receipts/hashicorp-vault/storage-backup-restore-and-rollback-policy.yaml) - The storage backup restore and rollback policy receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-vault/webhook-readiness-and-failure-policy.yaml](../../../data/production-disposition/receipts/hashicorp-vault/webhook-readiness-and-failure-policy.yaml) - The webhook readiness and failure policy receipt exists for this chart.

## Next Action

Keep this default base as parity evidence only; create a separate Vault production base with init/unseal, storage, TLS, backup/restore, and operator runbook evidence before making a support claim.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
