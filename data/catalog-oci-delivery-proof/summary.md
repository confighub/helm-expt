# NGINX delivered from one ConfigHub release OCI

**UNOFFICIAL/EXPERIMENTAL.** Generated from the committed live receipt. Regenerate this page with `npm run catalog-oci:proof:generate`; rerun the cluster test with `npm run catalog-oci:proof`.

This test used the real `bitnami/nginx@24.0.2` `http-clusterip` catalog base. `cub installer` pulled the public package, selected that base, and reproduced the committed Kubernetes objects. ConfigHub then published those objects once as a release OCI.

Argo CD, Flux, and direct apply consumed that release in sequence on one throwaway cluster. All three reported the same OCI digest and reached a ready NGINX Deployment and ClusterIP Service.

| Delivery method | Source | OCI digest | NGINX replicas | Service | Result |
| --- | --- | --- | --- | --- | --- |
| Argo CD | OCI Application | sha256:26d97438d5b52dcacf140d2ef4c57a97bacd0c63e22d5cfa19076a0723b73049 | 1/1 | ClusterIP | pass |
| Flux | OCIRepository and Kustomization | sha256:26d97438d5b52dcacf140d2ef4c57a97bacd0c63e22d5cfa19076a0723b73049 | 1/1 | ClusterIP | pass |
| Direct apply | oras pull and kubectl apply | sha256:26d97438d5b52dcacf140d2ef4c57a97bacd0c63e22d5cfa19076a0723b73049 | 1/1 | ClusterIP | pass |

Overall: **pass**. Rendered objects: **6**. Published Units: **6**. Cleanup: namespace **pass**, ConfigHub Space **pass**, rig **pass**.

This proves one catalog configuration on the recorded target. It does not prove another chart, base, Kubernetes version, or production cluster. The scratch organization did not run the `helm-catalog` apply-policy Triggers, so policy and delivery remain separate claims.

- [Render intent](../../data/helm-render-intents/intents/bitnami-nginx-24-0-2-http-clusterip.yaml)
- [Committed Kubernetes objects](../../recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml)
- [Live receipt](../../runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml)
