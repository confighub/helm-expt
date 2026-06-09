# ingress-nginx/ingress-nginx@4.15.1 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `ingress-nginx/ingress-nginx@4.15.1` |
| Candidate base | `default` |
| Decision state | `draft` |
| Target scope | vanilla-kubernetes; namespace=ingress-nginx; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Scan scope | Record which scanner findings are accepted, fixed, or outside this target scope. |
| Runtime decision | Decide whether the runtime condition is supported before refreshing live evidence. |


## Closeout Sequence

1. Choose the final target scope, GitOps controller, namespace, and artifact digest.
2. Decide which scanner findings are accepted, fixed, hardened, or outside this target scope.
3. Decide whether the runtime condition is supported, excluded, or operator-owned.

## Required Before Final Support

- Choose the final target scope, exact GitOps controller, namespace, and artifact digest.
- Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.
- choose whether default is in production scope; close or document its runtime-watch live-readiness issue first

## Support Boundary

Included:

- ingress-nginx/ingress-nginx@4.15.1 default base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/ingress-nginx-ingress-nginx-default/receipt.yaml](../../../runs/live-kind-parity/ingress-nginx-ingress-nginx-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [data/production-disposition/receipts/ingress-nginx-ingress-nginx/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/ingress-nginx-ingress-nginx/cluster-rbac-review.yaml) - The cluster rbac review disposition exists for this chart.
- [data/production-disposition/receipts/ingress-nginx-ingress-nginx/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/ingress-nginx-ingress-nginx/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy disposition exists for this chart.
- [data/production-disposition/receipts/ingress-nginx-ingress-nginx/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/ingress-nginx-ingress-nginx/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.
- [data/production-disposition/receipts/ingress-nginx-ingress-nginx/webhook-readiness-and-failure-policy.yaml](../../../data/production-disposition/receipts/ingress-nginx-ingress-nginx/webhook-readiness-and-failure-policy.yaml) - The webhook readiness and failure policy disposition exists for this chart.

## Next Action

choose whether default is in production scope; close or document its runtime-watch live-readiness issue first

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
