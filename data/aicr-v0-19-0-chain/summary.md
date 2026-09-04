# AICR v0.19.0: from source to an approved release

This page follows one configuration from NVIDIA AICR v0.19.0 into ConfigHub.
The earlier retained AICR versions remain available for comparison.

## What was completed

| Step | Result |
| --- | --- |
| Source and intent | AICR selected the provider-curated EKS, H100, Ubuntu, Kubeflow training source variant at commit `f1f63463f7fae6dea608c89f92975b0dbc27c59c`. |
| Materialize | AICR and Helm produced 17 exact Argo CD Applications. |
| Flatten | The 17 wrapper Applications were retained as literal configuration. All 16 nested sources also rendered locally; eight contain CRDs. Each nested source still needs its own flattening and lifecycle decision. |
| Route lifecycle work | The staging resolution binds the promoted configuration to an EKS/H100/Argo CD destination. It remains blocked until the destination facts, nested routes, and runtime checks have receipts. |
| Protect fields | AICR source-owned fields and later ConfigHub changes are kept separate. |
| Publish OCI | The source package and literal configuration are publicly pullable without an account. |
| Retain in ConfigHub | ConfigHub recorded the literal OCI digest, retained the same 17 object identities, and recorded its own data hash for the Unit. |
| Check policy | ConfigHub refused to publish an unapproved release. |
| Change and promote | Development changed one Grafana setting to use an existing Secret. The reviewed result was promoted to staging. |
| Publish the approved release | After approval, ConfigHub published the staging result as OCI. A pull by manifest digest matched all 17 promoted Applications. |

## Exact references

| Record | Exact value |
| --- | --- |
| Source package | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd:0.19.0@sha256:00318b2196a914057ee3c1c7679be17f8500f65b2c2f96a791e404c1ba47c161` |
| Literal configuration | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd-config:0.19.0@sha256:60330c80709c8bddb0c9bf52b4be35f803c302931dfa52f1d1b2b4637eb90635` |
| ConfigHub Unit data hash | `127138237fb994791dfa5e7e6958e8d6083fb779660dc346c879f09b3025560a` |
| ConfigHub base | `aicr-eks-h100-training-kubeflow-v0-19-0-argocd` |
| Development | `aicr-eks-h100-training-kubeflow-v0-19-0-argocd-development` |
| Staging | `aicr-eks-h100-training-kubeflow-v0-19-0-argocd-staging` |
| ConfigHub release OCI | `oci://oci.hub.confighub.com:443/space/aicr-eks-h100-training-kubeflow-v0-19-0-argocd-staging@sha256:c2408fe664240a06620bc718698318953bec08c642a1c5a43996e868048cd0a1` |

## What did not run

- Argo CD reconciliation for this v0.19.0 configuration
- Flux delivery for this v0.19.0 configuration
- EKS or H100 execution
- A training workload or model request
- An exact runtime rollback

## Records

- [Source generation receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/generation-receipt.yaml)
- [Flattening verdict](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/flattening-safety-verdict.yaml)
- [Route intent](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/route-intent.yaml)
- [Staging route resolution](../../data/lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-19-0-staging-argo-cd.yaml)
- [Nested source processing](../../data/aicr-v0-19-0-nested-sources/summary.md)
- [Field policy](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/field-policy-assessment.yaml)
- [Public OCI receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/public-oci-receipt.yaml)
- [ConfigHub upload receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/confighub-upload-receipt.yaml)
- [Apply-policy receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/apply-policy-receipt.yaml)
- [Promotion receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/promotion-readiness-receipt.yaml)
- [Approved ConfigHub release OCI receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/confighub-release-oci-receipt.yaml)
