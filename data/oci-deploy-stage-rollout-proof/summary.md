# One OCI deployed, promoted, and rolled out through Argo CD and Flux

This is one continuous live test. It starts with literal Kubernetes objects in
an OCI artifact. ConfigHub imports those objects without running Helm and keeps
a `base -> development -> staging` chain. The reviewed staging objects are
then exported as one anonymous OCI package. Argo CD pulls that exact package on
two clusters, and Flux pulls the same digest on a third cluster.

## Result

**pass.** One literal Kubernetes OCI was imported and republished by ConfigHub with the same specs and user metadata plus a ConfigHub origin annotation, then promoted in sequence through development and staging and exported as one anonymous OCI package. Two Argo CD controllers and one Flux controller reconciled that exact digest. Fingerprinted cub-scout receipts confirm that all three live object sets match the reviewed package and all three NGINX Deployments reached two ready replicas.

| Step | Result | Evidence |
| --- | --- | --- |
| Build and pull the literal input OCI | pass | `sha256:ba9d5aa8f05766037d61f2ed04bfed5543bc5e7328cce193a3c577fe9071d714`; pulled objects matched the committed NGINX catalog base. |
| Import the OCI into ConfigHub | pass | 5 Units; source digest recorded; Kubernetes fields matched. The receipt names the internal comment marker ignored during comparison. |
| Publish the same configuration from ConfigHub | pass | Input `sha256:ba9d5aa8f05766037d61f2ed04bfed5543bc5e7328cce193a3c577fe9071d714`; ConfigHub output `sha256:72c5d6470b0c2a260dae933791046cc5b7544bcd3263a803f4763e94d65d3ca5`; 5 objects kept the same specs and user metadata. ConfigHub added `confighub.com/origin`. |
| Create the environment chain | pass | `base -> development -> staging`. |
| Change one reviewed field | pass | Deployment replicas changed from 1 to 2. |
| Promote to development | pass | The dry run showed the replica change without applying it. The promotion then applied the change and cleared the pending update. |
| Promote to staging | pass | The dry run showed the replica change without applying it. The promotion then applied the change and cleared the pending update. |
| Publish the ConfigHub staging release | pass | `sha256:6633e6a2174ea4f54ec011ad8c8549a85f63e0abc000a19abad132a8fad5db9b`. |
| Export the portable OCI | pass | 5 objects; `sha256:b90a1d56c878d18040bc8a92545eed0e8a1913d64ab960a887c2fc8004e22b55`; anonymous pull. |
| Roll out through Argo CD | pass | Both Argo CD controllers reported the portable OCI digest and both workloads became ready. |
| Roll out through Flux | pass | The Flux OCIRepository and Kustomization became ready at `sha256:b90a1d56c878d18040bc8a92545eed0e8a1913d64ab960a887c2fc8004e22b55`; the workload reached 2/2 ready replicas. |

## Argo CD controller feedback

| Cluster | Argo sync | Argo health | OCI revision | Exact objects | Ready replicas | Current objects | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hx-oci-flow-20260729-s3t-a` | Synced | Healthy | `sha256:b90a1d56c878d18040bc8a92545eed0e8a1913d64ab960a887c2fc8004e22b55` | 5/5 | 2/2 | 5/5 | pass |
| `hx-oci-flow-20260729-s3t-b` | Synced | Healthy | `sha256:b90a1d56c878d18040bc8a92545eed0e8a1913d64ab960a887c2fc8004e22b55` | 5/5 | 2/2 | 5/5 | pass |

## Flux controller feedback

| Cluster | OCI source | Kustomization | OCI revision | Ready replicas | Result |
| --- | --- | --- | --- | --- | --- |
| `hx-oci-flow-20260729-s3t-flux` | Ready | Ready | `sha256:b90a1d56c878d18040bc8a92545eed0e8a1913d64ab960a887c2fc8004e22b55` | 2/2 | pass |

## Live observation receipts

`cub-scout` checked the reviewed staging files against all three live clusters. The
object receipts compare the five namespaced Kubernetes objects and their authored
fields, using the named Kubernetes zero-default normalization profile for fields
the API server may omit. The convergence receipts check that all five objects are
current, including the NGINX Deployment at two ready replicas. Each receipt records
a one-hour freshness boundary and a fingerprint that can be validated later.

| Cluster | Object receipt | Fingerprint | Workload receipt | Fingerprint |
| --- | --- | --- | --- | --- |
| `hx-oci-flow-20260729-s3t-a` | [object match](../../runs/oci-deploy-stage-rollout-proof/observations/target-a-object-set.json) | `sha256:78f1cf6b4a7e3a556bfc916884abe3635e95910737eadbfe2639aacb5b0d749b` | [workload convergence](../../runs/oci-deploy-stage-rollout-proof/observations/target-a-workloads.json) | `sha256:91cbd10d7615d51376dd25c806c39d526fca058bcc34597d9cf8d7b148ff1a6c` |
| `hx-oci-flow-20260729-s3t-b` | [object match](../../runs/oci-deploy-stage-rollout-proof/observations/target-b-object-set.json) | `sha256:fc72200157343b96f959766b15d1602925227cce8eaba9bc438525e5d5efde13` | [workload convergence](../../runs/oci-deploy-stage-rollout-proof/observations/target-b-workloads.json) | `sha256:3b167764a7b61675a95a24784dde1a5da195d5c8a20a967ff5539093506b4f22` |
| `hx-oci-flow-20260729-s3t-flux` | [object match](../../runs/oci-deploy-stage-rollout-proof/observations/flux-target-object-set.json) | `sha256:5a50be6aec6b2f042c244f00ffbc3a92d293a05628bb23ad5126c9f9f941e54d` | [workload convergence](../../runs/oci-deploy-stage-rollout-proof/observations/flux-target-workloads.json) | `sha256:ffaaf94dfd009988e3756985014bbdc7d280ffa70e61c8c6bcb6dc270eb22aed` |

## What this proves

- An existing literal OCI can enter ConfigHub without rerunning Helm.
- ConfigHub can publish its first release with the same specs and user-supplied
  metadata. The output has its own OCI digest and adds the
  `confighub.com/origin` provenance annotation.
- ConfigHub can keep one base and advance a reviewed change through development
  and staging in sequence.
- ConfigHub can publish its own staged release, while the same reviewed objects
  can also leave as a portable OCI package.
- Two Argo CD controllers and one Flux controller can pull the same portable
  OCI digest. Fingerprinted observation receipts confirm that all three live
  object sets match the reviewed files and all three workloads converged.

## What this does not prove

- The input and portable output OCI packages used a temporary local registry. Public Google Artifact Registry publication is a separate receipt.
- This proves one NGINX catalog configuration on two throwaway Argo CD clusters and one throwaway Flux cluster, not every chart or production target.
- cub-scout recorded fingerprinted object-match and workload-convergence receipts locally. This test did not submit those receipts to ConfigHub observation storage.
- The test did not exercise hooks, CRDs, Secrets, or admission webhooks; those keep their separate lifecycle routes and receipts.
- ConfigHub's target-scoped OCI credential was not shared between clusters. The fleet consumed the portable anonymous OCI output instead.

The run removed all three kind clusters, both ConfigHub cluster Spaces, the
three workload Spaces, the temporary registry, and the generated local files.

- Receipt: [`runs/oci-deploy-stage-rollout-proof/receipt.yaml`](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml)
- Reviewed staging files: [`runs/oci-deploy-stage-rollout-proof/observations/staging-desired.yaml`](../../runs/oci-deploy-stage-rollout-proof/observations/staging-desired.yaml)
- Source record: [`data/base-variant-records/records/bitnami-nginx-24-0-2-http-clusterip.yaml`](../../data/base-variant-records/records/bitnami-nginx-24-0-2-http-clusterip.yaml)
- Literal objects: [`recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml`](../../recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml)
