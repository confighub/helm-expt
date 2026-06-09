# hashicorp/consul@2.0.0 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `hashicorp/consul@2.0.0` |
| Candidate base | `default-control-plane` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=consul; delivery=confighub-oci; controller=argo |
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

- hashicorp/consul@2.0.0 default-control-plane base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered Consul server, connect injector, webhook certificate manager, CRDs, RBAC, labels, gates, receipts, and support objects produced by the recorded base
- recorded mutable-image exception with digest-resolution evidence for the declared public proof scope
- recorded resource/probe warning acceptance for the declared public proof scope
- recorded no-hook desired-object lifecycle policy for the declared public proof scope

Excluded:

- secure-mesh-existing-secrets unless separately reviewed for a target with required Secrets, TLS, ACL, gateway, UI, mesh, and runtime policies
- Consul production quorum, backup, restore, rollback, ACL state, gossip key continuity, and traffic failover unless separately reviewed
- platform-owned Gateway API or Consul CRDs unless separately reviewed through an external-CRD base
- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- digest-pinned, resource-hardened, TLS/ACL-enabled, gateway-enabled, UI-ingress, or customer production bases unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/hashicorp/consul/2.0.0/revisions/default-control-plane/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/hashicorp/consul/2.0.0/revisions/default-control-plane/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/hashicorp/consul/2.0.0/revisions/default-control-plane/r001/receipts/scan-receipt.yaml](../../../recipes/hashicorp/consul/2.0.0/revisions/default-control-plane/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/hashicorp-consul-default-control-plane/receipt.yaml](../../../runs/live-kind-parity/hashicorp-consul-default-control-plane/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/hashicorp-consul-default-control-plane/receipt.yaml](../../../runs/live-helm-confighub-compare/hashicorp-consul-default-control-plane/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-support-decisions/hashicorp-consul/fresh-target-evidence-2026-06-08.yaml](../../../data/production-support-decisions/hashicorp-consul/fresh-target-evidence-2026-06-08.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/image-digest-workdown/receipts/hashicorp-consul/default-control-plane/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/hashicorp-consul/default-control-plane/image-digest-resolution.yaml) - The rendered mutable image references for the supported base have registry digest-resolution evidence.
- [data/production-support-decisions/hashicorp-consul/image-policy-decision.yaml](../../../data/production-support-decisions/hashicorp-consul/image-policy-decision.yaml) - The target-scoped image policy decision accepts mutable rendered tags for this public proof scope with explicit limits.
- [data/production-support-decisions/hashicorp-consul/security-decision.yaml](../../../data/production-support-decisions/hashicorp-consul/security-decision.yaml) - The target-scoped security decision accepts the default-control-plane warning shape only for this public proof scope.
- [data/production-support-decisions/hashicorp-consul/lifecycle-decision.yaml](../../../data/production-support-decisions/hashicorp-consul/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds no-hook desired-object policy, CRD/webhook policy, secure-mesh exclusions, and OCI/Argo runtime health to proof-scope evidence.
- [data/production-disposition/receipts/hashicorp-consul/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/hashicorp-consul/cluster-rbac-review.yaml) - The cluster rbac review receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-consul/crd-lifecycle-and-upgrade-policy.yaml](../../../data/production-disposition/receipts/hashicorp-consul/crd-lifecycle-and-upgrade-policy.yaml) - The crd lifecycle and upgrade policy receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-consul/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/hashicorp-consul/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-consul/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/hashicorp-consul/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-consul/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/hashicorp-consul/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-consul/storage-backup-restore-and-rollback-policy.yaml](../../../data/production-disposition/receipts/hashicorp-consul/storage-backup-restore-and-rollback-policy.yaml) - The storage backup restore and rollback policy receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-consul/target-fact-preflight.yaml](../../../data/production-disposition/receipts/hashicorp-consul/target-fact-preflight.yaml) - The target fact preflight receipt exists for this chart.
- [data/production-disposition/receipts/hashicorp-consul/webhook-readiness-and-failure-policy.yaml](../../../data/production-disposition/receipts/hashicorp-consul/webhook-readiness-and-failure-policy.yaml) - The webhook readiness and failure policy receipt exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate secure-mesh, TLS, ACL, gateway, UI, external-CRD, production-quorum, hardening, and digest-pinned bases for real customer Consul workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
