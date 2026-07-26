# One OCI deployed, promoted, and rolled out to two clusters

This is one continuous live test. It starts with literal Kubernetes objects in
an OCI artifact. ConfigHub imports those objects without running Helm and keeps
a `base -> development -> staging` chain. The reviewed staging objects are
then exported as one anonymous OCI package. Argo CD pulls that exact package on
two clusters.

## Result

**pass.** One literal Kubernetes OCI was imported and republished by ConfigHub with the same specs and user metadata plus a ConfigHub origin annotation, then promoted in sequence through development and staging, exported as one anonymous OCI package, and reconciled at the same digest by Argo CD on two clusters. Fingerprinted cub-scout receipts confirm that both live object sets match the reviewed package and both NGINX Deployments reached two ready replicas.

| Step | Result | Evidence |
| --- | --- | --- |
| Build and pull the literal input OCI | pass | `sha256:5ca7ea87efa64f76a29cfa564a9af8e0f087c2bd638962e24a2b1b144417e261`; pulled objects matched the committed NGINX catalog base. |
| Import the OCI into ConfigHub | pass | 5 Units; source digest recorded; Kubernetes fields matched. The receipt names the internal comment marker ignored during comparison. |
| Publish the same configuration from ConfigHub | pass | Input `sha256:5ca7ea87efa64f76a29cfa564a9af8e0f087c2bd638962e24a2b1b144417e261`; ConfigHub output `sha256:99f4404680e4cc1dda389431d49938c6e2c5067fe89360c7b2f9673a0924f320`; 5 objects kept the same specs and user metadata. ConfigHub added `confighub.com/origin`. |
| Create the environment chain | pass | `base -> development -> staging`. |
| Change one reviewed field | pass | Deployment replicas changed from 1 to 2. |
| Promote to development | pass | The preview changed nothing. After promotion, development had no pending upstream change. |
| Promote to staging | pass | The preview changed nothing. After promotion, staging had no pending upstream change. |
| Publish the ConfigHub staging release | pass | `sha256:573a5aa8bafbc0f8e91953c11bbbc2592d72c2784b3372d91cee5a26e28b4681`. |
| Export the portable OCI | pass | 5 objects; `sha256:04e06df7342b396fc63292ff64bdb1fa44a4b74ed86ee53665f76906a4bf5210`; anonymous pull. |
| Roll out to two clusters | pass | Both controllers reported the portable OCI digest and both workloads became ready. |

## Live controller feedback

| Cluster | Argo sync | Argo health | OCI revision | Exact objects | Ready replicas | Current objects | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hx-oci-flow-20260726-1oq1-a` | Synced | Healthy | `sha256:04e06df7342b396fc63292ff64bdb1fa44a4b74ed86ee53665f76906a4bf5210` | 5/5 | 2/2 | 5/5 | pass |
| `hx-oci-flow-20260726-1oq1-b` | Synced | Healthy | `sha256:04e06df7342b396fc63292ff64bdb1fa44a4b74ed86ee53665f76906a4bf5210` | 5/5 | 2/2 | 5/5 | pass |

## Live observation receipts

`cub-scout` checked the reviewed staging files against each live cluster. The
object receipts compare the five namespaced Kubernetes objects and their authored
fields, using the named Kubernetes zero-default normalization profile for fields
the API server may omit. The convergence receipts check that all five objects are
current, including the NGINX Deployment at two ready replicas. Each receipt records
a one-hour freshness boundary and a fingerprint that can be validated later.

| Cluster | Object receipt | Fingerprint | Workload receipt | Fingerprint |
| --- | --- | --- | --- | --- |
| `hx-oci-flow-20260726-1oq1-a` | [object match](../../runs/oci-deploy-stage-rollout-proof/observations/target-a-object-set.json) | `sha256:62023edff95ca30bb19382000dd2e1622e29ec40726a11a32b652da7271e7359` | [workload convergence](../../runs/oci-deploy-stage-rollout-proof/observations/target-a-workloads.json) | `sha256:51ed848dc6df6f10b03de7f7f9e943becd48838ba0979215503fdbcbb3ea3c06` |
| `hx-oci-flow-20260726-1oq1-b` | [object match](../../runs/oci-deploy-stage-rollout-proof/observations/target-b-object-set.json) | `sha256:c4cd4eeda538b94e77cccba9f0a42a9c5b015e5e740571b54c934de15482bf95` | [workload convergence](../../runs/oci-deploy-stage-rollout-proof/observations/target-b-workloads.json) | `sha256:5ebeb5993308f16681d1ac57ef157b7deb1b938155c0a6581f3c47d057846932` |

## What this proves

- An existing literal OCI can enter ConfigHub without rerunning Helm.
- ConfigHub can publish its first release with the same specs and user-supplied
  metadata. The output has its own OCI digest and adds the
  `confighub.com/origin` provenance annotation.
- ConfigHub can keep one base and advance a reviewed change through development
  and staging in sequence.
- ConfigHub can publish its own staged release, while the same reviewed objects
  can also leave as a portable OCI package.
- Two Argo CD controllers can pull the same portable OCI digest. Fingerprinted
  observation receipts confirm that both live object sets match the reviewed
  files and both workloads converged.

## What this does not prove

- The input and portable output OCI packages used a temporary local registry. Public Google Artifact Registry publication is a separate receipt.
- This proves one NGINX catalog configuration on two throwaway kind clusters, not every chart or production target.
- cub-scout recorded fingerprinted object-match and workload-convergence receipts locally. This test did not submit those receipts to ConfigHub observation storage.
- The test did not exercise hooks, CRDs, Secrets, or admission webhooks; those keep their separate lifecycle routes and receipts.
- ConfigHub's target-scoped OCI credential was not shared between clusters. The fleet consumed the portable anonymous OCI output instead.

The run removed both kind clusters, their ConfigHub cluster Spaces, the three
workload Spaces, the temporary registry, and the generated local files.

- Receipt: [`runs/oci-deploy-stage-rollout-proof/receipt.yaml`](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml)
- Reviewed staging files: [`runs/oci-deploy-stage-rollout-proof/observations/staging-desired.yaml`](../../runs/oci-deploy-stage-rollout-proof/observations/staging-desired.yaml)
- Source record: [`data/base-variant-records/records/bitnami-nginx-24-0-2-http-clusterip.yaml`](../../data/base-variant-records/records/bitnami-nginx-24-0-2-http-clusterip.yaml)
- Literal objects: [`recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml`](../../recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml)
