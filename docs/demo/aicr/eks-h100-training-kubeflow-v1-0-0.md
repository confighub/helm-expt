# AICR v1.0.0: inspect an EKS H100 training platform

UNOFFICIAL/EXPERIMENTAL. This entry keeps NVIDIA AICR v1.0.0 beside the
[v0.14.0](./eks-h100-training-kubeflow.md),
[v0.18.0](./eks-h100-training-kubeflow-v0-18-0.md),
[v0.19.0](./eks-h100-training-kubeflow-v0-19-0.md), and
[v0.20.0](./eks-h100-training-kubeflow-v0-20-0.md) entries. It uses the same
EKS, H100, Ubuntu, training, and Kubeflow choices, so you can see what the
v1.0.0 release changes without replacing the earlier configurations.

## Why use this entry?

Use it when you want to read what NVIDIA's first 1.0 release produces for an
EKS H100 training platform. You can inspect all 17 generated Argo CD
Applications in this repository without a ConfigHub account, an EKS cluster, or
a GPU.

Less has been done for v1.0.0 than for v0.20.0. The entry is generated, kept
in this repository, and checked against NVIDIA's signed release. It is not
published to a public registry, and it is not in ConfigHub. The
[status table](#current-status) says what has run.

## This entry in the model's five words

The [model page](../../user/model-and-vocabulary.md) describes every entry as
Pack, Recipe, Bundle, Variant, and Deployment.

| Word | For the v1.0.0 training entry |
| --- | --- |
| Source catalog | NVIDIA's AICR built-in catalog, version v1.0.0. |
| Data pack | None. The entry uses NVIDIA's catalog as it is. |
| Recipe | Five criteria, `service=eks`, `accelerator=h100`, `os=ubuntu`, `intent=training`, and `platform=kubeflow`, with the build inputs listed below. |
| Generator | `aicr recipe`, then `aicr bundle` with the `argocd-helm` deployer, then `helm template`. |
| Bundle | 17 exact Argo CD Application objects, retained here with a plan of nine steps. No bundle is published. |
| Variant | None yet. The entry is not in ConfigHub. |
| Deployment | None. Nothing has been delivered or run. |

## What the source produces

AICR reads nine overlays and turns the five criteria into one recipe with 16
components, in order. It makes one Helm chart from 15 of them. It leaves out
`dra-node-labeler`, because no DRA eviction node label was supplied. Helm
renders that chart into 17 Application objects, and those are what this entry
keeps.

The entry is only partly flattened. Sixteen of the 17 Application objects
still name a Helm chart. Argo CD renders those charts later, on the cluster.

- The [generation receipt](../../../examples/aicr/eks-h100-training-kubeflow-v1-0-0/generation-receipt.yaml)
  records the commands, the inputs, and the source version.
- The [digest index](../../../examples/aicr/eks-h100-training-kubeflow-v1-0-0/digest-index/README.md)
  gives one digest that covers the inputs, the source package, and the
  rendered Applications. If any of them changes, the digest changes.
- The [source record](../../../examples/aicr/eks-h100-training-kubeflow-v1-0-0/source-catalog/source-catalog-record.yaml)
  names NVIDIA as the provider, the catalog version, and the selected source
  variant.
- The [source verification](../../../data/aicr-provenance-v1-0-0/summary.md)
  checks the release checksum, the signed binary provenance, the
  recipe-catalog signature, and the SBOM attestation.

Run these two repository checks to repeat the verification without Docker or
network access:

```bash
npm run aicr-training-v100:verify
npm run aicr-provenance-v100:verify
```

## The inputs fixed when the entry was built

| Input | Value |
| --- | --- |
| Storage class | `gp3` |
| Accelerated node selector | `nvidia.com/gpu.present=true` |
| Workload selector | `app.kubernetes.io/part-of=training` |
| System node selector | `nodeGroup=system-worker`. This is a placeholder. Change it to the label on your own cluster's system node group. |
| Deployer | `argocd-helm` |

A change to one of these inputs is made before the bundle, by generating the
entry again. A change for one environment is made after the bundle, as a
variant in ConfigHub.

## The plan

Not all source configuration can be completely flattened. The configuration
steps taken after flattening are called the plan. This entry's plan has nine
steps, and none has been carried out.

| Step | What it asks |
| --- | --- |
| Match the target | Compare what the destination has with what NVIDIA's source variant expects. |
| Argo CD first | Make the Argo CD Application API and controller available. |
| Component order | Reconcile the component Applications in AICR's dependency order. |
| The charts inside | Handle CRDs, hooks, certificates, operators, and setup Jobs for every nested source. The nested sources are not materialized for v1.0.0. |
| Upgrade over an earlier installation | Follow the manual steps AICR lists before applying this bundle over an earlier one. |
| System node selector | Replace the placeholder with the label on the destination cluster's system node group. |
| DRA plugin eviction | Decide whether the DRA kubelet plugin is evicted before a GPU driver container restarts. |
| Node inspection | Collect and compare node facts with AICR's own tool. |
| Configuration validation | Run the AICR checks whose prerequisites the source variant satisfies. |

The [route intent](../../../examples/aicr/eks-h100-training-kubeflow-v1-0-0/route-intent.yaml)
is the record behind this table. The
[field-policy assessment](../../../examples/aicr/eks-h100-training-kubeflow-v1-0-0/field-policy-assessment.yaml)
says which fields NVIDIA's source controls and which you may change in
ConfigHub.

## What changed from v0.20.0?

The [computed comparison](../../../data/aicr-version-diff/summary.md) records
these differences. The Catalog retains no v0.21.0 entry, so the step between is
not compared.

| | v0.20.0 | v1.0.0 |
| --- | --- | --- |
| Components in the recipe | 15 | 16 |
| Argo CD Applications | 17 | 17 |
| Distinct sync-waves | 5 | 5 |

Eight components pull a different chart version, and none moved to another
sync-wave.

| Component | v0.20.0 | v1.0.0 |
| --- | --- | --- |
| `gpu-operator` | 26.3.3 | 26.7.1 |
| `kai-scheduler` | v0.14.1 | v0.16.9 |
| `nodewright-operator` | v0.17.1 | v0.19.0 |
| `nvidia-dra-driver-gpu` | 0.4.1 | 0.5.0 |
| `nvsentinel` | v1.20.0 | v1.25.0 |
| `aicr-stack`, `kubeflow-trainer-post`, `nodewright-customizations` | 0.20.0 | 1.0.0 |

The recipe's own format also moves, from `aicr.run/v1alpha2` to `aicr.run/v1`.
NVSentinel's health check now covers three DaemonSets, where it covered two.
The full comparison finds 15 changed Application objects. This is a source
comparison. No health check has run on EKS in this entry.

## Current status

| Stage | Result | Record |
| --- | --- | --- |
| Select the AICR source variant | Complete. The five criteria resolve to one provider-curated variant. | [Source record](../../../examples/aicr/eks-h100-training-kubeflow-v1-0-0/source-catalog/source-catalog-record.yaml) |
| Verify the upstream source | Complete. Checksums, binary provenance, recipe-catalog signature, and SBOM attestation pass. | [Source verification](../../../data/aicr-provenance-v1-0-0/summary.md) |
| Generate the wrapper and exact Applications | Complete. The retained result contains 17 Applications. | [Generation receipt](../../../examples/aicr/eks-h100-training-kubeflow-v1-0-0/generation-receipt.yaml) |
| Publish source and literal configuration OCI | Not run. Both artifacts are kept as local OCI layouts in this repository. | [Generation receipt](../../../examples/aicr/eks-h100-training-kubeflow-v1-0-0/generation-receipt.yaml) |
| Materialize the 16 nested sources | Not done for v1.0.0. | The plan's fourth step. |
| Retain a ConfigHub base and create derived variants | Not run. | None. |
| Check approval, promote, and publish a release OCI | Not run. | None. |
| Deliver through Argo CD or Flux | Not run. | None. |
| Run on EKS and H100 | Not run. No training request, observation, or rollback is claimed. | Tracked in issue #1581. |

The next step for this entry is the one the v0.20.0 entry has already taken:
publish the two OCI artifacts and store the base in ConfigHub.
