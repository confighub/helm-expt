# prometheus-community/prometheus@29.8.0 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `prometheus-community/prometheus@29.8.0` |
| Candidate base | `server-only-ephemeral` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=monitoring; delivery=confighub-oci; controller=argo |
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

- prometheus-community/prometheus@29.8.0 server-only-ephemeral base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered Prometheus server Deployment, Service, ConfigMap, RBAC, labels, gates, receipts, and support objects produced by the recorded base
- recorded mutable-image exception with digest-resolution evidence for the declared public proof scope
- recorded security acceptance for the narrower server-only proof scope
- recorded no-hooks lifecycle policy for the declared public proof scope

Excluded:

- the broad default Prometheus stack unless separately reviewed for a specific target
- node-exporter, kube-state-metrics, pushgateway, Alertmanager, persistent storage, and long-retention production monitoring
- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- custom scrape configs, remote write/read, ingress, network policy, PDB settings, and extra manifests unless separately reviewed
- digest-pinned, resource-hardened, storage-backed, or customer production bases unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/receipts/helm-equivalence-receipt.yaml) - The supported base is Helm-equivalent under recorded inputs.
- [recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/receipts/scan-receipt.yaml](../../../recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the supported base.
- [runs/live-kind-parity/prometheus-community-prometheus-server-only-ephemeral/receipt.yaml](../../../runs/live-kind-parity/prometheus-community-prometheus-server-only-ephemeral/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the supported base.
- [runs/live-helm-confighub-compare/prometheus-community-prometheus-server-only-ephemeral/receipt.yaml](../../../runs/live-helm-confighub-compare/prometheus-community-prometheus-server-only-ephemeral/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the supported base.
- [data/production-support-decisions/prometheus-community-prometheus/fresh-target-evidence-2026-06-05.yaml](../../../data/production-support-decisions/prometheus-community-prometheus/fresh-target-evidence-2026-06-05.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/image-digest-workdown/receipts/prometheus-community-prometheus/server-only-ephemeral/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/prometheus-community-prometheus/server-only-ephemeral/image-digest-resolution.yaml) - The rendered mutable image references for the supported base have registry digest-resolution evidence.
- [data/production-support-decisions/prometheus-community-prometheus/image-policy-decision.yaml](../../../data/production-support-decisions/prometheus-community-prometheus/image-policy-decision.yaml) - The target-scoped image policy decision accepts mutable rendered tags for this public proof scope with explicit limits.
- [data/production-support-decisions/prometheus-community-prometheus/security-decision.yaml](../../../data/production-support-decisions/prometheus-community-prometheus/security-decision.yaml) - The target-scoped security decision accepts the narrower server-only warning shape only for this public proof scope.
- [data/production-support-decisions/prometheus-community-prometheus/lifecycle-decision.yaml](../../../data/production-support-decisions/prometheus-community-prometheus/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds no-hooks policy, selected components, and OCI/Argo runtime health to proof-scope evidence.
- [data/production-disposition/receipts/prometheus-community-prometheus/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/prometheus-community-prometheus/cluster-rbac-review.yaml) - The cluster RBAC review disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-prometheus/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/prometheus-community-prometheus/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-prometheus/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/prometheus-community-prometheus/scan-gate-warning-disposition.yaml) - The scan gate warning disposition exists for this chart and recommends server-only-ephemeral as the narrower first production-review base.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate default-stack, persistent-storage, remote-write, scrape-customization, ingress, node-exporter, resource-hardened, or digest-pinned bases for real customer monitoring workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
