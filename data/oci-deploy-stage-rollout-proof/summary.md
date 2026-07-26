# One OCI deployed, promoted, and rolled out to two clusters

This is one continuous live test. It starts with literal Kubernetes objects in
an OCI artifact. ConfigHub imports those objects without running Helm and keeps
a `base -> development -> staging` chain. The reviewed staging objects are
then exported as one anonymous OCI package. Argo CD pulls that exact package on
two clusters.

## Result

**pass.** One literal Kubernetes OCI was imported as a ConfigHub base, promoted in sequence through development and staging, exported as one anonymous OCI package, and reconciled at the same digest by Argo CD on two clusters. Both NGINX Deployments reached two ready replicas.

| Step | Result | Evidence |
| --- | --- | --- |
| Build and pull the literal input OCI | pass | `sha256:7cbbe182825121c0df57799d5a90d323884c8be0817c96a4f095b643be638ebe`; pulled objects matched the committed NGINX catalog base. |
| Import the OCI into ConfigHub | pass | 5 Units; source digest recorded; Kubernetes fields matched. The receipt names the internal comment marker ignored during comparison. |
| Create the environment chain | pass | `base -> development -> staging`. |
| Change one reviewed field | pass | Deployment replicas changed from 1 to 2. |
| Promote to development | pass | The preview changed nothing. After promotion, development had no pending upstream change. |
| Promote to staging | pass | The preview changed nothing. After promotion, staging had no pending upstream change. |
| Publish the ConfigHub staging release | pass | `sha256:211484786fc1d7d4d7631e48d3dad429f0e3c88df07b91e4fd3ff74948a2dcf9`. |
| Export the portable OCI | pass | 5 objects; `sha256:a3e98e6a9533ffbf5803a1570f9e2870e770723a3682f9210d87d6d66834e13e`; anonymous pull. |
| Roll out to two clusters | pass | Both controllers reported the portable OCI digest and both workloads became ready. |

## Live controller feedback

| Cluster | Argo sync | Argo health | OCI revision | Ready replicas | Result |
| --- | --- | --- | --- | --- | --- |
| `hx-oci-flow-20260726-1zhl-a` | Synced | Healthy | `sha256:a3e98e6a9533ffbf5803a1570f9e2870e770723a3682f9210d87d6d66834e13e` | 2/2 | pass |
| `hx-oci-flow-20260726-1zhl-b` | Synced | Healthy | `sha256:a3e98e6a9533ffbf5803a1570f9e2870e770723a3682f9210d87d6d66834e13e` | 2/2 | pass |

## What this proves

- An existing literal OCI can enter ConfigHub without rerunning Helm.
- ConfigHub can keep one base and advance a reviewed change through development
  and staging in sequence.
- ConfigHub can publish its own staged release, while the same reviewed objects
  can also leave as a portable OCI package.
- Two Argo CD controllers can pull the same portable OCI digest and report live
  workload health.

## What this does not prove

- The input and portable output OCI packages used a temporary local registry. Public Google Artifact Registry publication is a separate receipt.
- This proves one NGINX catalog configuration on two throwaway kind clusters, not every chart or production target.
- This test read Argo CD and Kubernetes status directly. It did not test ConfigHub's cluster observation feed.
- The test did not exercise hooks, CRDs, Secrets, or admission webhooks; those keep their separate lifecycle routes and receipts.
- ConfigHub's target-scoped OCI credential was not shared between clusters. The fleet consumed the portable anonymous OCI output instead.

The run removed both kind clusters, their ConfigHub cluster Spaces, the three
workload Spaces, the temporary registry, and the generated local files.

- Receipt: [`runs/oci-deploy-stage-rollout-proof/receipt.yaml`](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml)
- Source record: [`data/base-variant-records/records/bitnami-nginx-24-0-2-http-clusterip.yaml`](../../data/base-variant-records/records/bitnami-nginx-24-0-2-http-clusterip.yaml)
- Literal objects: [`recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml`](../../recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml)
