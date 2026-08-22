# AICR v0.19.0: retain the source, objects, and install plan

UNOFFICIAL/EXPERIMENTAL. This entry keeps NVIDIA AICR v0.19.0 beside the
[v0.14.0](./eks-h100-training-kubeflow.md) and
[v0.18.0](./eks-h100-training-kubeflow-v0-18-0.md) entries. It uses the same
EKS, H100, Ubuntu, training, and Kubeflow choices so the versions can be
compared without replacing either earlier result.

```bash
npm run aicr-provenance-v0190:verify
npm run aicr-training-v0190:verify
npm run aicr-training-v0190:verify-artifacts
```

## Why this entry exists

An AI platform configuration has more than one useful form. The AICR recipe
records what the user selected. The generated Helm chart is the source package
Argo CD can process. The rendered Argo CD Applications are the exact
configuration ConfigHub can retain and compare. The lifecycle record says what
must happen around normal Kubernetes apply.

Keeping those records together answers different questions without pretending
that one YAML directory answers all of them.

## What was selected

AICR v0.19.0 resolved one native AICR recipe from these choices:

| Choice | Value |
| --- | --- |
| Service | EKS |
| Accelerator | H100 |
| Operating system | Ubuntu |
| Workload | Training |
| Platform | Kubeflow |

The recipe contains 15 components and their dependency order. This use of
**recipe** is specific to AICR. It is not our general name for an OCI package,
plain YAML, or a ConfigHub revision.

## How the configuration is processed

| Step | What happens for this entry |
| --- | --- |
| Select | AICR resolves the five choices into its native recipe. |
| Materialize | AICR generates an Argo CD app-of-apps Helm chart. Helm renders that chart into 17 Applications. |
| Flatten | The 17 Applications are retained as exact files and as a literal configuration OCI. |
| Route lifecycle work | The route record assigns the Argo CD prerequisite, component ordering, downstream chart work, and AICR health checks. |
| Protect fields | The field-policy record says which choices belong to the source and which may become later ConfigHub changes. |
| Retain | Checksums, two local OCI layouts, one platform digest, and the source receipts bind the retained files. |

This is a partial flattening boundary. The 17 Applications are exact, but 16
of them still point to Helm charts or local chart paths. Argo CD renders those
sources later. This entry therefore does not contain every Kubernetes object
that will eventually run on the target cluster.

Read the [route intent](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/route-intent.yaml)
for the lifecycle work and the
[field policy](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/field-policy-assessment.yaml)
for source-owned choices.

The [nested-source report](../../../data/aicr-v0-19-0-nested-sources/summary.md)
records a local render for all 16 component sources. Eight rendered outputs
contain CRDs. This closes the source-discovery gap, but it does not make the
nested charts safe to flatten or prove that they ran on EKS.

## What changed since v0.18.0

The [computed comparison](../../../data/aicr-version-diff/summary.md) shows the
same component set, dependency order, Application count, and sync-wave shape.
The root package version moved to 0.19.0. The local
`kubeflow-trainer-post` and `nodewright-customizations` sources also moved to
0.19.0. The other chart source versions stayed the same.

The health-check text changed even though the selected platform shape did not.
That is why the catalog retains the source recipe and receipts as well as the
rendered Applications: two releases can produce the same top-level shape while
changing the checks and source material around it.

## Which fields AICR controls

AICR v0.19.0 adds named `gpuStack` profiles to its AKS and GKE families. Those
profiles lock related GPU-driver settings so a later override cannot create a
mixed ownership model. The retained EKS recipe does not declare that profile;
supplying it is refused before generation.

For this EKS entry, GPU-driver ownership is therefore still a target decision.
We record that result instead of copying the AKS rule onto EKS. A later
ConfigHub change should preserve a source-owned field only when the exact
source version and selected profile say it is locally changeable.

## Source and artifact checks

The release archive matched NVIDIA's checksum list. The v0.19.0 CLI binary and
recipe-catalog signatures both verified against NVIDIA's exact release workflow
with networking disabled. A wrong signer identity was refused.

The retained source chart OCI contains the AICR-generated Helm chart. The
literal configuration OCI contains the 17 exact Application files as separate
YAML layers. A fresh Helm render of the retained source chart produces the same
Kubernetes data as those files.

The [generation receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/generation-receipt.yaml),
[source verification](../../../data/aicr-provenance-v0-19-0/summary.md), and
[digest index](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/digest-index/README.md)
record the exact hashes.

## Current status

| Stage | Result | Evidence |
| --- | --- | --- |
| Verify the NVIDIA source | Complete. The release checksum and both retained signatures pass. | [Source verification](../../../data/aicr-provenance-v0-19-0/summary.md) |
| Produce the wrapper configuration | Complete. AICR and Helm produce 17 exact Argo CD Applications. | [Generation receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/generation-receipt.yaml) |
| Inspect the nested sources | Complete for local rendering. All 16 exact sources and values render; eight outputs contain CRDs. | [Nested-source report](../../../data/aicr-v0-19-0-nested-sources/summary.md) |
| Publish public input artifacts | Complete. The source package and literal configuration pull anonymously from Google Artifact Registry at their recorded digests. | [Public OCI receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/public-oci-receipt.yaml) |
| Retain and vary in ConfigHub | Complete. The base, development, and staging Spaces exist. Development changes one Grafana field to use an existing Secret, and staging receives that exact reviewed change. | [Promotion receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/promotion-readiness-receipt.yaml) |
| Enforce approval | Complete. ConfigHub first refused an unapproved release. After both current staging Units were approved, the current retained release published successfully. The receipt records its release number and digests. | [Apply-policy receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/apply-policy-receipt.yaml) and [release OCI receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/confighub-release-oci-receipt.yaml) |
| Pull the ConfigHub release OCI | Complete. The registry resolved the exact manifest digest, and the pulled release matched all 17 promoted Applications after removing only ConfigHub's provenance annotation. | [Release OCI receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/confighub-release-oci-receipt.yaml) |
| Resolve the staging install work | Recorded, but blocked. The resolution binds the staging object digest to EKS, H100, and Argo CD and names the added Grafana Secret, CRDs, ordering, and checks. It still needs destination and runtime receipts. | [Staging route resolution](../../../data/lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-19-0-staging-argo-cd.yaml) |
| Reconcile and run on NVIDIA hardware | Not run. There is no v0.19.0 Argo-on-EKS, H100 training, NIM request, observation, or rollback receipt. | This remains the next hardware-backed test. |
| Deliver through Flux or a small fleet | Not run for v0.19.0. | These remain separate follow-up tests. |

## What remains

The next complete run needs an EKS destination with H100 nodes, NGC access,
the required Secret and storage inputs, and Argo CD. It should deliver the
recorded ConfigHub release digest, run the nested chart routes in order, make
one real training or NIM request, record observations, and roll back to the
previous exact release. Flux delivery and a small Sveltos fleet come after that
single-cluster result.
