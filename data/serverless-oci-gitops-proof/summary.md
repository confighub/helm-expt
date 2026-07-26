# Public OCI in, reviewed files, OCI out

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from a live receipt. Run `npm run serverless-oci-gitops:proof` to repeat it, or `npm run serverless-oci-gitops:proof:verify` to check the committed result.

This run started with the public bitnami/nginx@24.0.2 installer package. `cub installer` pulled it using an empty registry credential file and an isolated cub home with no ConfigHub token. It rendered the `http-clusterip` configuration as 6 Kubernetes objects.

The rendered files were then packaged as a second OCI artifact. Flux pulled the exact digest from that artifact and applied it to a throwaway cluster. NGINX reached 1/1 ready replicas.

| Check | Result |
| --- | --- |
| Public installer OCI pulled without registry credentials | pass |
| ConfigHub token present | no |
| Rendered objects | 6: Deployment, Namespace, NetworkPolicy, PodDisruptionBudget, Service, ServiceAccount |
| Output OCI pulled back and compared with the reviewed files | pass |
| Output digest | `sha256:9d8185e99a660b9f594a7491acf28d49e05c989984a07d71ad648a557eb319d9` |
| Flux OCI source | ready |
| Flux Kustomization | ready |
| Flux-observed digest matches output | pass |
| NGINX | 1/1 ready |
| Cleanup | pass |

This proves the temporary, no-account `OCI -> work -> OCI -> Flux` path for this NGINX configuration. It does not prove a permanently hosted output service, and it does not cover charts whose hooks or CRDs need lifecycle routes.

- Input publication receipt: `runs/installer-oci/bitnami-nginx/24.0.2/installer-package-publication-receipt.yaml`
- Live receipt: `runs/serverless-oci-gitops-proof/receipt.yaml`
