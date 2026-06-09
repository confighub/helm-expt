# bitnami/mongodb@19.0.7 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `bitnami/mongodb@19.0.7` |
| Candidate base | `generated-passwords` |
| Decision state | `draft` |
| Target scope | vanilla-kubernetes; namespace=mongodb; delivery=confighub-oci; controller=argo-or-flux |
| Delivery path | `confighub-oci` |

## Open Work

| Work | Action |
| --- | --- |
| Scan scope | Record which scanner findings are accepted, fixed, or outside this target scope. |
| Fresh evidence | Refresh ConfigHub OCI/GitOps and live/e2e evidence after earlier decisions are closed. |


## Required Before Final Support

- Choose the final target scope, exact GitOps controller, namespace, and artifact digest.
- Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.
- record lifecycle support boundary: recipe-hook-policy:no-hooks

## Support Boundary

Included:

- bitnami/mongodb@19.0.7 generated-passwords base
- ConfigHub OCI delivery for the declared target scope after fresh target evidence is recorded
- rendered objects, labels, gates, receipts, and support objects produced by the recorded base

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/bitnami/mongodb/19.0.7/revisions/generated-passwords/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/bitnami/mongodb/19.0.7/revisions/generated-passwords/r001/receipts/helm-equivalence-receipt.yaml) - The candidate base is Helm-equivalent under recorded inputs.
- [recipes/bitnami/mongodb/19.0.7/revisions/generated-passwords/r001/receipts/scan-receipt.yaml](../../../recipes/bitnami/mongodb/19.0.7/revisions/generated-passwords/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the candidate base.
- [runs/live-kind-parity/bitnami-mongodb-generated-passwords/receipt.yaml](../../../runs/live-kind-parity/bitnami-mongodb-generated-passwords/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/bitnami-mongodb-generated-passwords/receipt.yaml](../../../runs/live-helm-confighub-compare/bitnami-mongodb-generated-passwords/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base.
- [data/production-disposition/receipts/bitnami-mongodb/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/generated-fact-ownership.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/generated-fact-ownership.yaml) - The generated fact ownership disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/scan-gate-warning-disposition.yaml) - The scan gate warning disposition disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/storage-backup-restore-and-rollback-policy.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/storage-backup-restore-and-rollback-policy.yaml) - The storage backup restore and rollback policy disposition exists for this chart.
- [data/production-disposition/receipts/bitnami-mongodb/target-fact-preflight.yaml](../../../data/production-disposition/receipts/bitnami-mongodb/target-fact-preflight.yaml) - The target fact preflight disposition exists for this chart.

## Next Action

record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
