# ingress-nginx/ingress-nginx@4.15.1 Production Support Workdown

This generated page is a human workdown for one target-scoped production
support decision. It does not replace the source decision artifact:

[support-decision.yaml](./support-decision.yaml)

## Current Decision

| Field | Value |
| --- | --- |
| Chart | `ingress-nginx/ingress-nginx@4.15.1` |
| Candidate base | `internal-clusterip` |
| Decision state | `supported` |
| Target scope | cub-lk-kind-vanilla; namespace=ingress-nginx; delivery=confighub-oci; controller=argo |
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

- ingress-nginx/ingress-nginx@4.15.1 internal-clusterip base
- admission webhook objects disabled in the supported base
- rendered Deployment, Service, IngressClass, RBAC, ConfigMap, ServiceAccount, and Namespace support object produced by the recorded base
- ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope

Excluded:

- default base with admission webhook and LoadBalancer behavior
- admission-disabled base with LoadBalancer behavior
- public LoadBalancer provisioning
- production ingress, DNS, and certificate management
- private values overlays, wrapper charts, and populated extension slots unless separately reviewed
- non-vanilla Kubernetes distributions unless separately reviewed

## Evidence

- [recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/internal-clusterip/r001/receipts/helm-equivalence-receipt.yaml](../../../recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/internal-clusterip/r001/receipts/helm-equivalence-receipt.yaml) - The supported base is Helm-equivalent under recorded inputs, with only the installer Namespace support object added.
- [recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/internal-clusterip/r001/receipts/scan-receipt.yaml](../../../recipes/ingress-nginx/ingress-nginx/4.15.1/revisions/internal-clusterip/r001/receipts/scan-receipt.yaml) - The supported base records cluster RBAC findings and has no high or critical rendered-object scan findings.
- [runs/ingress-nginx-confighub-proof/latest/confighub-proof-receipt.yaml](../../../runs/ingress-nginx-confighub-proof/latest/confighub-proof-receipt.yaml) - ConfigHub upload, plan, safe operations, labels, and server-side variant clone proof passed for the supported base.
- [runs/top20-local-kind/ingress-nginx-internal-clusterip/observation-receipt.json](../../../runs/top20-local-kind/ingress-nginx-internal-clusterip/observation-receipt.json) - Local kind apply, rollout, cub-scout object-set, closed-world, and workload convergence checks passed for the supported base.
- [runs/live-kind-parity/ingress-nginx-ingress-nginx-internal-clusterip/receipt.yaml](../../../runs/live-kind-parity/ingress-nginx-ingress-nginx-internal-clusterip/receipt.yaml) - The supported base passes strict two-cluster live parity between regular Helm and cub installer apply.
- [runs/live-helm-confighub-compare/ingress-nginx-ingress-nginx-internal-clusterip/receipt.yaml](../../../runs/live-helm-confighub-compare/ingress-nginx-ingress-nginx-internal-clusterip/receipt.yaml) - Regular Helm, ConfigHub kubectl apply, and ConfigHub OCI/Argo delivery reached the same live outcome for the supported base.
- [data/production-support-decisions/ingress-nginx-ingress-nginx/fresh-target-evidence-2026-06-09.yaml](../../../data/production-support-decisions/ingress-nginx-ingress-nginx/fresh-target-evidence-2026-06-09.yaml) - Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared support scope.

## Next Action

Keep the target-scoped evidence fresh before using this supported scope as a production-support example.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
