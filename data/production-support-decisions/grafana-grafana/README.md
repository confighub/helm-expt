# grafana/grafana@10.5.15 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `grafana/grafana@10.5.15` |
| Candidate base | `generated-passwords` |
| Decision state | `draft` |
| Target scope | vanilla-kubernetes; namespace=grafana; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Image digest | Pin rendered image references by digest or record an explicit mutable-image exception. |
| Scan scope | Record which scanner findings are accepted, fixed, or outside this target scope. |
| Fresh evidence | Refresh ConfigHub OCI/GitOps and live/e2e evidence after earlier decisions are closed. |


## Closeout Sequence

1. Choose the final target scope, GitOps controller, namespace, and artifact digest.
2. Pin rendered image references by digest or record an explicit mutable-image exception.
3. Decide which scanner findings are accepted, fixed, hardened, or outside this target scope.
4. Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence after the earlier decisions are closed.

## Required Before Final Support

- Choose the final target scope, exact GitOps controller, namespace, and artifact digest.
- Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.
- resolve image digests or record explicit exception before production OCI support

## Support Boundary

Included:

- grafana/grafana@10.5.15 generated-passwords base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/grafana/grafana/10.5.15/revisions/generated-passwords/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/grafana/grafana/10.5.15/revisions/generated-passwords/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/grafana/grafana/10.5.15/revisions/generated-passwords/r001/receipts/scan-receipt.yaml](../../../recipes/grafana/grafana/10.5.15/revisions/generated-passwords/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/grafana-grafana-generated-passwords/receipt.yaml](../../../runs/live-kind-parity/grafana-grafana-generated-passwords/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/grafana-grafana-generated-passwords/receipt.yaml](../../../runs/live-helm-confighub-compare/grafana-grafana-generated-passwords/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-disposition/receipts/grafana-grafana/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/grafana-grafana/cluster-rbac-review.yaml) - The cluster rbac review receipt exists for this chart.
- [data/production-disposition/receipts/grafana-grafana/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/grafana-grafana/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy receipt exists for this chart.
- [data/production-disposition/receipts/grafana-grafana/generated-fact-ownership.yaml](../../../data/production-disposition/receipts/grafana-grafana/generated-fact-ownership.yaml) - The generated fact ownership receipt exists for this chart.
- [data/production-disposition/receipts/grafana-grafana/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/grafana-grafana/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.
- [data/production-disposition/receipts/grafana-grafana/target-fact-preflight.yaml](../../../data/production-disposition/receipts/grafana-grafana/target-fact-preflight.yaml) - The target fact preflight receipt exists for this chart.

## Next Action

resolve image digests for each affected variant before production OCI support

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
