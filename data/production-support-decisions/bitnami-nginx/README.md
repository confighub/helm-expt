# bitnami/nginx@24.0.2 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `bitnami/nginx@24.0.2` |
| Candidate base | `http-clusterip` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=nginx; delivery=confighub-oci; controller=argo |
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

- bitnami/nginx@24.0.2 http-clusterip base
- empty NGINX extension slots in the supported base
- rendered Deployment, Service, PodDisruptionBudget, and support objects produced by the recorded base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope

Excluded:

- existing-tls-ingress base
- populated serverBlock, streamServerBlock, extraDeploy, sidecar, or raw manifest slots
- private values overlays
- production ingress, DNS, and certificate management
- customer production clusters
- non-vanilla Kubernetes distributions unless separately reviewed

## Evidence

- [recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/receipts/helm-equivalence-receipt.yaml) - The supported base is Helm-equivalent under recorded inputs, with only the installer Namespace support object added.
- [recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/receipts/scan-receipt.yaml](../../../recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/receipts/scan-receipt.yaml) - The supported base has no high or critical rendered-object scan findings and records the PDB warning explicitly.
- [data/production-disposition/receipts/bitnami-nginx/scan-gate-warning-disposition.yaml](../../../data/production-disposition/receipts/bitnami-nginx/scan-gate-warning-disposition.yaml) - The PDB warning has an accepted pre-review production disposition for the NGINX supported bases.
- [data/production-disposition/receipts/bitnami-nginx/extension-slot-provenance-and-scan-policy.yaml](../../../data/production-disposition/receipts/bitnami-nginx/extension-slot-provenance-and-scan-policy.yaml) - Extension slots are empty in the supported base and populated slots route back to a reviewed installer base.
- [runs/live-kind-parity/bitnami-nginx-http-clusterip/receipt.yaml](../../../runs/live-kind-parity/bitnami-nginx-http-clusterip/receipt.yaml) - The supported base passes strict two-cluster live parity between regular Helm and cub installer apply.
- [runs/live-helm-confighub-compare/bitnami-nginx-http-clusterip/receipt.yaml](../../../runs/live-helm-confighub-compare/bitnami-nginx-http-clusterip/receipt.yaml) - The selected live Helm-vs-ConfigHub comparison receipt exists for the supported base.
- [data/runtime-gitops/receipts/bitnami-nginx/http-clusterip/latest.yaml](../../../data/runtime-gitops/receipts/bitnami-nginx/http-clusterip/latest.yaml) - Runtime/GitOps receipt exists for the supported base and should be refreshed for the declared target before final support.
- [data/production-support-decisions/bitnami-nginx/fresh-target-evidence-2026-06-09.yaml](../../../data/production-support-decisions/bitnami-nginx/fresh-target-evidence-2026-06-09.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
