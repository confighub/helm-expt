# hashicorp/vault@0.32.0 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `hashicorp/vault@0.32.0` |
| Candidate base | `default` |
| Decision state | `draft` |
| Target scope | vanilla-kubernetes; namespace=vault; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Image digest | Pin rendered image references by digest or record an explicit mutable-image exception. |
| Scan scope | Record which scanner findings are accepted, fixed, or outside this target scope. |
| Runtime decision | Decide whether the runtime condition is supported before refreshing live evidence. |


## Closeout Sequence

1. Choose the final target scope, GitOps controller, namespace, and artifact digest.
2. Pin rendered image references by digest or record an explicit mutable-image exception.
3. Decide which scanner findings are accepted, fixed, hardened, or outside this target scope.
4. Decide whether the runtime condition is supported, excluded, or operator-owned.

## Required Before Final Support

- Choose the final target scope, exact GitOps controller, namespace, and artifact digest.
- Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.
- resolve image digests or record explicit exception before production OCI support
- choose whether default is in production scope; close or document its runtime-review-needed live-readiness issue first

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

choose whether default is in production scope; close or document its runtime-review-needed live-readiness issue first

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
