# jetstack/cert-manager@v1.20.2 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `jetstack/cert-manager@v1.20.2` |
| Candidate base | `default` |
| Decision state | `draft` |
| Target scope | vanilla-kubernetes; namespace=cert-manager; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Image digest | Pin rendered image references by digest or record an explicit mutable-image exception. |
| Scan scope | Record which scanner findings are accepted, fixed, or outside this target scope. |
| Lifecycle | Record the lifecycle boundary, or execute and observe the selected hook/lifecycle route. |
| Lifecycle observation | Bind lifecycle observation evidence to this target scope before final support. |


## Closeout Sequence

1. Choose the final target scope, GitOps controller, namespace, and artifact digest.
2. Pin rendered image references by digest or record an explicit mutable-image exception.
3. Decide which scanner findings are accepted, fixed, hardened, or outside this target scope.
4. Record the lifecycle boundary, including hook, webhook, CRD, cleanup, ordering, and upgrade behavior.
5. Bind lifecycle observation evidence to this target scope.

## Required Before Final Support

- Choose the final target scope, exact GitOps controller, namespace, and artifact digest.
- Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.
- resolve image digests or record explicit exception before production OCI support
- bind lifecycle observation receipt to supported scope

## Support Boundary

Included:

- jetstack/cert-manager@v1.20.2 default base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/jetstack/cert-manager/v1.20.2/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/jetstack/cert-manager/v1.20.2/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/jetstack/cert-manager/v1.20.2/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/jetstack/cert-manager/v1.20.2/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/jetstack-cert-manager-default/receipt.yaml](../../../runs/live-kind-parity/jetstack-cert-manager-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [data/production-disposition/receipts/jetstack-cert-manager/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/cluster-rbac-review.yaml) - The cluster rbac review disposition exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/crd-lifecycle-and-upgrade-policy.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/crd-lifecycle-and-upgrade-policy.yaml) - The crd lifecycle and upgrade policy disposition exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy disposition exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy disposition exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/webhook-readiness-and-failure-policy.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/webhook-readiness-and-failure-policy.yaml) - The webhook readiness and failure policy disposition exists for this chart.

## Next Action

choose whether default is in production scope; record the target-scoped lifecycle support decision before claiming production support

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
