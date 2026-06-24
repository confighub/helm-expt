# grafana/grafana@10.5.15 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `grafana/grafana@10.5.15` |
| Candidate base | `existing-secret-ingress` |
| Decision state | `superseded` |
| Target scope | vanilla-kubernetes; namespace=grafana; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

- No open generated work item for this decision.


## Closeout Sequence

1. Choose the final target scope, GitOps controller, namespace, and artifact digest.

## Required Before Final Support

- None.


## Support Boundary

Included:

- grafana/grafana@10.5.15 existing-secret-ingress base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/grafana/grafana/10.5.15/revisions/existing-secret-ingress/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/grafana/grafana/10.5.15/revisions/existing-secret-ingress/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/grafana/grafana/10.5.15/revisions/existing-secret-ingress/r001/receipts/scan-receipt.yaml](../../../recipes/grafana/grafana/10.5.15/revisions/existing-secret-ingress/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/grafana-grafana-existing-secret-ingress/receipt.yaml](../../../runs/live-kind-parity/grafana-grafana-existing-secret-ingress/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/grafana-grafana-existing-secret-ingress/receipt.yaml](../../../runs/live-helm-confighub-compare/grafana-grafana-existing-secret-ingress/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-disposition/receipts/grafana-grafana/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/grafana-grafana/cluster-rbac-review.yaml) - The cluster rbac review receipt exists for this chart.
- [data/production-disposition/receipts/grafana-grafana/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/grafana-grafana/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy receipt exists for this chart.
- [data/production-disposition/receipts/grafana-grafana/generated-fact-ownership.yaml](../../../data/production-disposition/receipts/grafana-grafana/generated-fact-ownership.yaml) - The generated fact ownership receipt exists for this chart.
- [data/production-disposition/receipts/grafana-grafana/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/grafana-grafana/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.
- [data/production-disposition/receipts/grafana-grafana/target-fact-preflight.yaml](../../../data/production-disposition/receipts/grafana-grafana/target-fact-preflight.yaml) - The target fact preflight receipt exists for this chart.

## Next Action

Keep this as catalog proof evidence only; review a maintained Grafana chart or replacement catalog source before making a production-support claim.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
