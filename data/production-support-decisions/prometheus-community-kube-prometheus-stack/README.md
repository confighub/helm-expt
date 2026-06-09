# prometheus-community/kube-prometheus-stack@85.3.3 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `prometheus-community/kube-prometheus-stack@85.3.3` |
| Candidate base | `default` |
| Decision state | `draft` |
| Target scope | vanilla-kubernetes; namespace=monitoring; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Lifecycle | Record the lifecycle boundary, or execute and observe the selected hook/lifecycle route. |
| Fresh evidence | Refresh ConfigHub OCI/GitOps and live/e2e evidence after earlier decisions are closed. |


## Closeout Sequence

1. Choose the final target scope, GitOps controller, namespace, and artifact digest.
2. Execute or observe the selected lifecycle route and bind the receipt to this target scope.
3. Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence after the earlier decisions are closed.

## Required Before Final Support

- Choose the final target scope, exact GitOps controller, namespace, and artifact digest.
- Execute or observe the selected hook lifecycle route, including webhook TLS/readiness, cleanup, ordering, and upgrade behavior.
- Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope after the lifecycle decision is closed.

## Support Boundary

Included:

- prometheus-community/kube-prometheus-stack@85.3.3 default base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base
- declared target-fact preflight for the Prometheus Operator admission webhook TLS Secret

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/receipts/scan-receipt.yaml](../../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/prometheus-community-kube-prometheus-stack-default/receipt.yaml](../../../runs/live-kind-parity/prometheus-community-kube-prometheus-stack-default/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml](../../../runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/image-digest-workdown/receipts/prometheus-community-kube-prometheus-stack/default/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/prometheus-community-kube-prometheus-stack/default/image-digest-resolution.yaml) - The rendered mutable image references for the candidate base have registry digest-resolution evidence.
- [data/production-support-decisions/prometheus-community-kube-prometheus-stack/image-policy-decision.yaml](../../../data/production-support-decisions/prometheus-community-kube-prometheus-stack/image-policy-decision.yaml) - The target-scoped image policy decision accepts mutable rendered tags for this public monitoring support draft with explicit limits.
- [data/production-support-decisions/prometheus-community-kube-prometheus-stack/security-decision.yaml](../../../data/production-support-decisions/prometheus-community-kube-prometheus-stack/security-decision.yaml) - The target-scoped production security decision accepts the recorded scan findings for this public monitoring support draft.
- [data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/cluster-rbac-review.yaml) - The cluster rbac review disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/crd-lifecycle-and-upgrade-policy.yaml](../../../data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/crd-lifecycle-and-upgrade-policy.yaml) - The crd lifecycle and upgrade policy disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/generated-fact-ownership.yaml](../../../data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/generated-fact-ownership.yaml) - The generated fact ownership disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/target-fact-preflight.yaml](../../../data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/target-fact-preflight.yaml) - The target fact preflight disposition exists for this chart.
- [data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/webhook-readiness-and-failure-policy.yaml](../../../data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/webhook-readiness-and-failure-policy.yaml) - The webhook readiness and failure policy disposition exists for this chart.
- [data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml](../../../data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml) - The hook lifecycle route is selected; execution or observation is still pending.

## Next Action

treat kube-prometheus-stack as the serious-chart proof: execute or observe lifecycle behavior next, then refresh scoped ConfigHub OCI/GitOps evidence for the monitoring namespace

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
