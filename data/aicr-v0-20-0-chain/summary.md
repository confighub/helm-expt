# AICR v0.20.0: from source to an approved release

This page follows one configuration from NVIDIA AICR v0.20.0 into ConfigHub.
The earlier retained AICR versions remain available for comparison.

## What was completed

| Step | Result |
| --- | --- |
| Source and intent | AICR selected the provider-curated EKS, H100, Ubuntu, Kubeflow training source variant at commit `b8a6eadb2d6f7e5b62dcb93446874f383940de0f`. |
| Materialize | AICR and Helm produced 17 exact Argo CD Applications. |
| Flatten | The 17 wrapper Applications were retained as literal configuration. All 16 nested sources also rendered locally; eight contain CRDs. Each nested source still needs its own flattening and lifecycle decision. |
| Route lifecycle work | The staging resolution binds the promoted configuration to an EKS/H100/Argo CD destination. It remains blocked until the destination facts, nested routes, and runtime checks have receipts. |
| Protect fields | AICR source-owned fields and later ConfigHub changes are kept separate. |
| Publish OCI | The source package and literal configuration are publicly pullable without an account. |
| Retain in ConfigHub | ConfigHub recorded the literal OCI digest, retained the same 17 object identities, and recorded its own data hash for the Unit. |
| Check policy | ConfigHub refused to publish an unapproved release. |
| Change and promote | Development changed one Grafana setting to use an existing Secret. The reviewed result was promoted through staging and production. |
| Publish the approved release | After approval, ConfigHub published the production result as OCI. A pull by manifest digest matched all 17 promoted Applications. |

## Exact references

| Record | Exact value |
| --- | --- |
| Source package | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow/aicr-bundle:0.20.0@sha256:2eedf6b36ea2cfab828245e38f72b7ed344915b6695c6a56d92a744d25992431` |
| Literal configuration | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd-config:0.20.0@sha256:4779ed69b9858791379a93704bb92ac11ec3b72e987b34921e293dd695415be8` |
| ConfigHub Unit data hash | `99246a3a947ec2b4a0037a395e81c21c4f6efb92198fe08e9a9afb63b2f3ab56` |
| ConfigHub base | `aicr-eks-h100-training-kubeflow-v0-20-0-argocd` |
| Development | `aicr-eks-h100-training-kubeflow-v0-20-0-argocd-development` |
| Staging | `aicr-eks-h100-training-kubeflow-v0-20-0-argocd-staging` |
| Production | `aicr-eks-h100-training-kubeflow-v0-20-0-argocd-production` |
| ConfigHub release OCI | `oci://oci.hub.confighub.com:443/space/aicr-eks-h100-training-kubeflow-v0-20-0-argocd-production@sha256:4684baa1f7d7c83b479dfeaa8a189e452e9de41156dd8eda5a707e37689ffdd7` |

## What did not run

- Argo CD reconciliation for this v0.20.0 configuration
- Flux delivery for this v0.20.0 configuration
- EKS or H100 execution
- A training workload or model request
- An exact runtime rollback

## Records

- [Source generation receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/generation-receipt.yaml)
- [Flattening verdict](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/flattening-safety-verdict.yaml)
- [Route intent](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/route-intent.yaml)
- [Staging route resolution](../../data/lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-20-0-staging-argo-cd.yaml)
- [Nested source processing](../../data/aicr-v0-20-0-nested-sources/summary.md)
- [Field policy](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/field-policy-assessment.yaml)
- [Public OCI receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/public-oci-receipt.yaml)
- [ConfigHub upload receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/confighub-upload-receipt.yaml)
- [Apply-policy receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/apply-policy-receipt.yaml)
- [Promotion receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/promotion-readiness-receipt.yaml)
- [Approved ConfigHub release OCI receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/confighub-release-oci-receipt.yaml)
