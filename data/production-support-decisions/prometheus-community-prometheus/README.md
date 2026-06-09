# prometheus-community/prometheus@29.8.0 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `prometheus-community/prometheus@29.8.0` |
| Candidate base | `default` |
| Decision state | `draft` |
| Target scope | vanilla-kubernetes; namespace=prometheus; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Image digest | Pin rendered image references by digest or record an explicit mutable-image exception. |
| Security posture | Accept current findings for this infrastructure scope or create a narrower hardened base. |
| Missing proof lane | Complete the missing ConfigHub, GitOps, or live lane before final support. |


## Required Before Final Support

- Choose the final target scope, exact GitOps controller, namespace, and artifact digest.
- Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.
- resolve image digests or record explicit exception before production OCI support
- record security acceptance or create hardened base

## Support Boundary

Included:

- prometheus-community/prometheus@29.8.0 default base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/prometheus-community/prometheus/29.8.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/prometheus-community/prometheus/29.8.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/prometheus-community/prometheus/29.8.0/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/prometheus-community/prometheus/29.8.0/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/prometheus-community-prometheus-default/receipt.yaml](../../../runs/live-kind-parity/prometheus-community-prometheus-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [data/production-disposition/receipts/prometheus-community-prometheus/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/prometheus-community-prometheus/cluster-rbac-review.yaml) - The cluster rbac review disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-prometheus/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/prometheus-community-prometheus/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-prometheus/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/prometheus-community-prometheus/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.

## Next Action

choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
