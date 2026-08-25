# AICR v0.20.0: inspect an EKS H100 training platform

UNOFFICIAL/EXPERIMENTAL. This entry keeps NVIDIA AICR v0.20.0 beside the
[v0.14.0](./eks-h100-training-kubeflow.md),
[v0.18.0](./eks-h100-training-kubeflow-v0-18-0.md), and
[v0.19.0](./eks-h100-training-kubeflow-v0-19-0.md) entries. It uses the same
EKS, H100, Ubuntu, training, and Kubeflow choices, so you can see what the new
release changes without replacing the earlier configurations.

## Why use this entry?

Use it when you want a checked starting configuration for an EKS H100 training
platform. You can inspect the source package and all 17 generated Argo CD
Applications without a ConfigHub account, EKS cluster, or GPU.

The two public OCI artifacts have different jobs:

| Artifact | What it contains | Digest |
| --- | --- | --- |
| Source package | The AICR-generated app-of-apps Helm chart. | `sha256:2eedf6b36ea2cfab828245e38f72b7ed344915b6695c6a56d92a744d25992431` |
| Literal configuration | The 17 exact Argo CD Application objects, one YAML layer per object. | `sha256:4779ed69b9858791379a93704bb92ac11ec3b72e987b34921e293dd695415be8` |

Run this repository check to pull both artifacts without registry credentials
and compare every pulled blob with the retained copy:

```bash
npm run aicr-v0200:public-verify
```

The [public OCI receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/public-oci-receipt.yaml)
records the exact references, digests, and anonymous pulls.

## Three kinds of variant

The word *variant* appears at three different points. They are related, but
they are not interchangeable.

| Variant | Meaning here | Current v0.20.0 status |
| --- | --- | --- |
| Source variant | NVIDIA's curated combination of service, accelerator, operating system, workload, and platform: `h100-eks-ubuntu-training-kubeflow`. | Selected and retained. |
| Base variant | The checked starting configuration: source and intent, 17 exact Applications, lifecycle plan, field policy, digests, and receipts. | Retained in the Catalog and published as OCI. It has not yet been uploaded as a ConfigHub base. |
| Derived variant | A reviewed change made from the base for development, staging, production, a region, or a customer. | Not created for v0.20.0 yet. |

The [source record](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/source-catalog/source-catalog-record.yaml)
shows how NVIDIA's 104 overlay files compose into 46 resolvable leaves and how
the five choices select this one source variant. NVIDIA and other Catalog
providers curate those choices; a snapshot diff alone cannot decide what a
particular target ought to contain.

## What the source produces

AICR resolves the selected source variant into a recipe with 15 ordered
components. It then generates an Argo CD app-of-apps Helm chart. Helm renders
that wrapper chart into 17 exact Application objects.

The [digest index](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/digest-index/README.md)
binds the selected inputs, source package, rendered Applications, and OCI
manifests under one platform digest. The
[generation receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/generation-receipt.yaml)
records the commands and source version. The
[source verification](../../../data/aicr-provenance-v0-20-0/summary.md) checks
the release checksum, signed binary provenance, recipe-catalog signature, and
SBOM attestation.

## Rendering and lifecycle work

The wrapper is only a partial flattening boundary. The 17 Application objects
are exact. Sixteen of them still point to Helm charts or local chart sources
that Argo CD would render later. Their final Kubernetes objects are not in this
entry yet.

The [route intent](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/route-intent.yaml)
records the lifecycle work that must be handled around those later renders:
ordering, CRDs, prerequisites, and AICR health checks. It is a plan, not a claim
that those steps ran. The
[field-policy assessment](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/field-policy-assessment.yaml)
separates source-controlled choices from fields that may become reviewed
ConfigHub changes.

## What changed from v0.19.0?

The [computed comparison](../../../data/aicr-version-diff/summary.md) records
four source-version changes and no ordering change:

- the wrapper moves from 0.19.0 to 0.20.0;
- `kubeflow-trainer-post` and `nodewright-customizations` move to 0.20.0;
- NVSentinel moves from v1.9.0 to v1.20.0.

NVSentinel's health check now checks two driver-labelled DaemonSets as well as
the labeler Deployment and pods. Its overall timeout changes from five minutes
to 90 seconds, so a stalled DaemonSet reports the useful failure sooner. The
optional zero-desired cases remain excluded. This is a source comparison; the
health check has not run on EKS in this entry.

## Current status

| Stage | Result | Record |
| --- | --- | --- |
| Select the AICR source variant | Complete. The five criteria resolve to one provider-curated variant. | [Source record](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/source-catalog/source-catalog-record.yaml) |
| Verify the upstream source | Complete. Checksums, binary provenance, recipe-catalog signature, and SBOM attestation pass. | [Source verification](../../../data/aicr-provenance-v0-20-0/summary.md) |
| Generate the wrapper and exact Applications | Complete. The retained result contains 17 Applications. | [Generation receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/generation-receipt.yaml) |
| Publish source and literal configuration OCI | Complete. Both artifacts pull anonymously and match the retained bytes. | [Public OCI receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/public-oci-receipt.yaml) |
| Resolve all nested chart objects and lifecycle work | Not run. The 16 downstream sources still need the separate materialization and route-resolution pass. | [Route intent](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/route-intent.yaml) |
| Retain a ConfigHub base and create derived variants | Not run for v0.20.0. | Tracked in issue #1616. |
| Promote and publish a ConfigHub release OCI | Not run for v0.20.0. | Tracked in issue #1616. |
| Deliver through Argo CD or Flux | Not run for v0.20.0. | Requires destination-specific receipts. |
| Run on EKS and H100 | Not run. No training or NIM request, observation, or rollback is claimed. | Tracked in issue #1581. |

The public OCI artifacts are useful now for inspection and local work. The next
ConfigHub step is to retain the exact literal configuration as a base, make one
reviewed derived variant, and promote that exact change. Delivery and H100
runtime testing come after the lifecycle work is resolved for the destination.
