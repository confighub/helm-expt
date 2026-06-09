# metrics-server/metrics-server@3.13.0 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `metrics-server/metrics-server@3.13.0` |
| Candidate base | `default` |
| Decision state | `draft` |
| Target scope | vanilla-kubernetes; namespace=metrics-server; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Image digest | Pin rendered image references by digest or record an explicit mutable-image exception. |
| Scan scope | Record which scanner findings are accepted, fixed, or outside this target scope. |
| Missing proof lane | Complete the missing ConfigHub, GitOps, or live lane before final support. |


## Closeout Sequence

1. Choose the final target scope, GitOps controller, namespace, and artifact digest.
2. Pin rendered image references by digest or record an explicit mutable-image exception.
3. Decide which scanner findings are accepted, fixed, hardened, or outside this target scope.
4. Complete the missing ConfigHub, GitOps, or live lane for the selected support boundary.

## Required Before Final Support

- Choose the final target scope, exact GitOps controller, namespace, and artifact digest.
- Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.
- resolve image digests or record explicit exception before production OCI support

## Support Boundary

Included:

- metrics-server/metrics-server@3.13.0 default base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/metrics-server/metrics-server/3.13.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/metrics-server/metrics-server/3.13.0/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/metrics-server/metrics-server/3.13.0/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/metrics-server/metrics-server/3.13.0/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/metrics-server-metrics-server-default/receipt.yaml](../../../runs/live-kind-parity/metrics-server-metrics-server-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/metrics-server-metrics-server-default/receipt.yaml](../../../runs/live-helm-confighub-compare/metrics-server-metrics-server-default/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml](../../../data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml) - The runtime/GitOps receipt exists for the candidate base and should be refreshed for the declared target before final support.
- [data/production-disposition/receipts/metrics-server-metrics-server/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/metrics-server-metrics-server/cluster-rbac-review.yaml) - The cluster rbac review disposition exists for this chart.
- [data/production-disposition/receipts/metrics-server-metrics-server/generated-fact-ownership.yaml](../../../data/production-disposition/receipts/metrics-server-metrics-server/generated-fact-ownership.yaml) - The generated fact ownership disposition exists for this chart.
- [data/production-disposition/receipts/metrics-server-metrics-server/hook-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/metrics-server-metrics-server/hook-lifecycle-phase-policy.yaml) - The hook lifecycle phase policy disposition exists for this chart.
- [data/production-disposition/receipts/metrics-server-metrics-server/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/metrics-server-metrics-server/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.
- [data/production-disposition/receipts/metrics-server-metrics-server/target-fact-preflight.yaml](../../../data/production-disposition/receipts/metrics-server-metrics-server/target-fact-preflight.yaml) - The target fact preflight disposition exists for this chart.

## Next Action

resolve image digests for each affected variant before production OCI support

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
