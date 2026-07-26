# One OCI deployed, promoted, and rolled out to two clusters

This is one continuous live test. It starts with literal Kubernetes objects in
an OCI artifact. ConfigHub imports those objects without running Helm and keeps
a `base -> development -> staging` chain. The reviewed staging objects are
then exported as one anonymous OCI package. Argo CD pulls that exact package on
two clusters.

## Result

**pass.** One literal Kubernetes OCI was imported and republished by ConfigHub with the same specs and user metadata plus a ConfigHub origin annotation, then promoted in sequence through development and staging, exported as one anonymous OCI package, and reconciled at the same digest by Argo CD on two clusters. Both NGINX Deployments reached two ready replicas.

| Step | Result | Evidence |
| --- | --- | --- |
| Build and pull the literal input OCI | pass | `sha256:827fea8e1e1395a4218e6364b6b0c95dad651dcd426ff4b988561b97f2a568f5`; pulled objects matched the committed NGINX catalog base. |
| Import the OCI into ConfigHub | pass | 5 Units; source digest recorded; Kubernetes fields matched. The receipt names the internal comment marker ignored during comparison. |
| Publish the same configuration from ConfigHub | pass | Input `sha256:827fea8e1e1395a4218e6364b6b0c95dad651dcd426ff4b988561b97f2a568f5`; ConfigHub output `sha256:3f0714b632a5d2fb23a7eaa3027516fff78a4a9d46fe7d0bac06df509c9bd5e4`; 5 objects kept the same specs and user metadata. ConfigHub added `confighub.com/origin`. |
| Create the environment chain | pass | `base -> development -> staging`. |
| Change one reviewed field | pass | Deployment replicas changed from 1 to 2. |
| Promote to development | pass | The preview changed nothing. After promotion, development had no pending upstream change. |
| Promote to staging | pass | The preview changed nothing. After promotion, staging had no pending upstream change. |
| Publish the ConfigHub staging release | pass | `sha256:f9897450a2de450de735126a8fd12a0f3d4fd800afbb127fe79de810b046efc9`. |
| Export the portable OCI | pass | 5 objects; `sha256:6b50e52cbf5ef7a7799a8ca1b3fbc1c421f145558c76997bb452cf37f605ab7a`; anonymous pull. |
| Roll out to two clusters | pass | Both controllers reported the portable OCI digest and both workloads became ready. |

## Live controller feedback

| Cluster | Argo sync | Argo health | OCI revision | Ready replicas | Result |
| --- | --- | --- | --- | --- | --- |
| `hx-oci-flow-20260726-xlk-a` | Synced | Healthy | `sha256:6b50e52cbf5ef7a7799a8ca1b3fbc1c421f145558c76997bb452cf37f605ab7a` | 2/2 | pass |
| `hx-oci-flow-20260726-xlk-b` | Synced | Healthy | `sha256:6b50e52cbf5ef7a7799a8ca1b3fbc1c421f145558c76997bb452cf37f605ab7a` | 2/2 | pass |

## What this proves

- An existing literal OCI can enter ConfigHub without rerunning Helm.
- ConfigHub can publish its first release with the same specs and user-supplied
  metadata. The output has its own OCI digest and adds the
  `confighub.com/origin` provenance annotation.
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
