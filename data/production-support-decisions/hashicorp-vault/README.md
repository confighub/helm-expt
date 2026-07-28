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
| Target scope | kind-vanilla; namespace=vault; delivery=confighub-oci; controller=argo |
| Delivery path | `confighub-oci` |

## Open Work

- No open generated work item for this decision.


## Closeout Sequence

1. Choose the final target scope, GitOps controller, namespace, and artifact digest.

## Required Before Final Support

- None.


## Support Boundary

Included:

- the production-support decision for hashicorp/vault@0.32.0 default
- the recorded Helm, ConfigHub direct-apply, and ConfigHub OCI/Argo evidence used to evaluate that base
- continued use of the default base as a ready-to-try catalog and parity example

Excluded:

- a production-support claim for the default base
- a production Vault storage, TLS, unseal, recovery, backup, or upgrade policy
- private values overlays, wrapper charts, populated extension slots, and other target scopes

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

Keep the default base as a ready-to-try parity example. Create a separate TLS-enabled, digest-pinned, persistent-storage base with explicit init, unseal, recovery, backup, and upgrade procedures before reconsidering production support.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
