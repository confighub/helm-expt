# jetstack/cert-manager@v1.20.2 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `jetstack/cert-manager@v1.20.2` |
| Candidate base | `crds-enabled` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=cert-manager; delivery=confighub-oci; controller=argo |
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

- jetstack/cert-manager@v1.20.2 crds-enabled base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope
- rendered CRDs, controller workloads, webhook objects, labels, gates, receipts, and support objects produced by the recorded base
- recorded startup API check lifecycle route using post-apply server dry-run and observation, not direct Helm hook execution
- recorded mutable-image exception for the declared public controller support scope
- recorded resource-policy acceptance for the declared public controller support scope
- Kubernetes 1.35 selectableFields capability-profile witness for the rendered cert-manager CRDs

Excluded:

- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- the default no-CRD target-prerequisite posture unless separately reviewed for a specific target
- Issuer, ClusterIssuer, Certificate, CertificateRequest, ACME account, ingress-shim, Gateway API, and provider credential workflows
- digest-pinned, resource-hardened, or provider-specific production bases unless separately reviewed
- Kubernetes targets that drop selectableFields unless a profile-specific base or separate route is reviewed
- non-vanilla Kubernetes distributions unless separately reviewed
- other delivery controllers or target scopes unless separately reviewed

## Evidence

- [recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/receipts/helm-equivalence-receipt.yaml) - The supported base is Helm-equivalent under recorded inputs.
- [recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/receipts/scan-receipt.yaml](../../../recipes/jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/receipts/scan-receipt.yaml) - The rendered-object scan receipt exists for the supported base.
- [runs/live-kind-parity/jetstack-cert-manager-crds-enabled/receipt.yaml](../../../runs/live-kind-parity/jetstack-cert-manager-crds-enabled/receipt.yaml) - The two-cluster Helm-vs-installer parity receipt exists for the candidate base.
- [runs/live-helm-confighub-compare/jetstack-cert-manager-crds-enabled/receipt.yaml](../../../runs/live-helm-confighub-compare/jetstack-cert-manager-crds-enabled/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the supported base.
- [data/production-support-decisions/jetstack-cert-manager/fresh-target-evidence-2026-06-05.yaml](../../../data/production-support-decisions/jetstack-cert-manager/fresh-target-evidence-2026-06-05.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.
- [data/capability-profile-witnesses/selectablefields/receipts/jetstack-cert-manager-crds-enabled-kind-1.35.yaml](../../../data/capability-profile-witnesses/selectablefields/receipts/jetstack-cert-manager-crds-enabled-kind-1.35.yaml) - The rendered cert-manager CRDs preserved selectableFields after server-side apply on the kind-kubernetes-1.35 capability profile.
- [data/image-digest-workdown/receipts/jetstack-cert-manager/crds-enabled/image-digest-resolution.yaml](../../../data/image-digest-workdown/receipts/jetstack-cert-manager/crds-enabled/image-digest-resolution.yaml) - The rendered mutable image references for the supported base have registry digest-resolution evidence.
- [data/production-support-decisions/jetstack-cert-manager/image-policy-decision.yaml](../../../data/production-support-decisions/jetstack-cert-manager/image-policy-decision.yaml) - The target-scoped image policy decision accepts mutable rendered tags for this public controller support scope with explicit limits.
- [data/production-support-decisions/jetstack-cert-manager/security-decision.yaml](../../../data/production-support-decisions/jetstack-cert-manager/security-decision.yaml) - The target-scoped security decision accepts missing resource requests/limits only for this public cub-lk proof scope.
- [data/production-support-decisions/jetstack-cert-manager/lifecycle-decision.yaml](../../../data/production-support-decisions/jetstack-cert-manager/lifecycle-decision.yaml) - The target-scoped lifecycle decision binds the startup API route and webhook readiness to proof-scope observation evidence.
- [data/production-disposition/receipts/jetstack-cert-manager/cluster-rbac-review.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/cluster-rbac-review.yaml) - The cluster rbac review receipt exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/crd-lifecycle-and-upgrade-policy.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/crd-lifecycle-and-upgrade-policy.yaml) - The crd lifecycle and upgrade policy receipt exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/extension-slot-provenance-and-scan-policy.yaml) - The extension slot provenance and scan policy receipt exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/hook-and-lifecycle-phase-policy.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/hook-and-lifecycle-phase-policy.yaml) - The hook and lifecycle phase policy receipt exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/scan-gate-warning-disposition.yaml) - The scan gate warning disposition receipt exists for this chart.
- [data/production-disposition/receipts/jetstack-cert-manager/webhook-readiness-and-failure-policy.yaml](../../../data/production-disposition/receipts/jetstack-cert-manager/webhook-readiness-and-failure-policy.yaml) - The webhook readiness and failure policy receipt exists for this chart.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate issuer, certificate, provider, or hardened resource bases for real customer certificate workloads.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
