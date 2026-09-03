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
| Base variant | The checked starting configuration: source and intent, 17 exact Applications, lifecycle plan, field policy, digests, and receipts. | Retained in the Catalog, published as OCI, and stored in the live ConfigHub Catalog organization. |
| Derived variant | A reviewed change made from the base for development, staging, production, a region, or a customer. | Development, staging, and production variants now contain one promoted Grafana Secret change. |

The [source record](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/source-catalog/source-catalog-record.yaml)
keeps three counts separate: 103 overlay files in the retained source tree, 102
entries in the embedded catalog, and 45 resolved leaves. The five choices select
one of those leaves. NVIDIA curates the built-in source variants. Other Catalog
providers can add target-specific configurations. A snapshot diff alone cannot
decide what a particular target ought to contain.

The selection is now an imported record rather than metadata inferred by the
ConfigHub Workshop generator:

| Field | Retained value |
| --- | --- |
| Provider | NVIDIA, acting as the source-catalog curator |
| Source catalog | NVIDIA AICR built-in catalog `v0.20.0` |
| Catalog content digest | `sha256:676f2d59eacd79ae1b72e5cbe00216b577def1da412dbdabb032f317a62dc1d8` |
| Selected source variant | `h100-eks-ubuntu-training-kubeflow` |
| Selection dimensions | `service=eks`, `accelerator=h100`, `os=ubuntu`, `intent=training`, `platform=kubeflow` |

The generated
[base-variant record](../../../data/base-variant-records/records/aicr-eks-h100-training-kubeflow-v0-20-0-argocd.yaml)
copies those fields from the source-catalog record. The
[ConfigHub upload receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/confighub-upload-receipt.yaml)
carries the same provider, catalog digest, selected variant, and dimensions beside
the exact-object comparison. This keeps the provider's source choice separate from
the ConfigHub base and the later development, staging, and production changes.
Provider-linked evidence is not treated as ConfigHub delivery or runtime evidence.

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
are exact. Sixteen of them point to Helm charts or local chart sources that a
controller processes later.

The Catalog now materializes those 16 sources separately. Each record binds the
fetched chart archive or local chart tree, the retained values, and the rendered
object set with SHA-256 digests. Together they produce 409 local Kubernetes
objects. Eight components contain 36 CRDs. No Helm hook object appears in this
selected render.

These are local renders. They show what each source produces with the selected
values. They do not show that Argo CD or Flux applied the objects, that the CRDs
became ready, or that a workload ran on H100 hardware.

- [Nested source inventory](../../../data/aicr-v0-20-0-nested-sources/summary.md)
- [Full object and lifecycle inventory](../../../data/aicr-v0-20-0-route-resolution/summary.md)

The [route intent](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/route-intent.yaml)
records the lifecycle work that may be needed: ordering, CRDs, prerequisites,
and AICR health checks. The destination-specific records then say who performs
that work for Argo CD and Flux. Neither record says that the work ran.

- [Argo CD route resolution](../../../data/lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-20-0-staging-argo-cd.yaml)
- [Flux route resolution](../../../data/lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-20-0-staging-flux.yaml)
- [Flux structural check and rerun commands](../../../data/aicr-v0-20-0-route-resolution/flux-structure-receipt.yaml)

The Flux bundle builds locally into 29 controller objects. Its NVSentinel
HelmRelease uses `CreateReplace` for CRDs because the component record declares
NVSentinel as their sole owner. The setting is not copied to components that
share CRDs. A live Flux CRD upgrade still needs a real Git source and target.

The
[field-policy assessment](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/field-policy-assessment.yaml)
separates source-controlled choices from fields that may become reviewed
ConfigHub changes.

## Stored, changed, and promoted in ConfigHub

The ConfigHub base stores the 17 Application objects and a README as separate
Units. Development, staging, and production are derived from that base.

The development change removes the literal Grafana administrator password and
uses the existing Secret `monitoring/aicr-grafana-admin` instead. A dry run
named the affected `kube-prometheus-stack` Application without changing stored
data. One ChangeOrder then moved that change through staging and production.
No other Application changed.

Every environment requires approval before release. An attempted unapproved
release was blocked. After the production configuration and README were
approved, ConfigHub published a release OCI with this manifest digest:

```text
sha256:2576c38241454d44998c4ad26615552e9b04ed745e06724f4213c1c39a8e47d1
```

The release was pulled back by that digest. Its configuration matches the
promoted production object set and its README matches the approved production
README. Promotion moved a reviewed change between ConfigHub environments;
release publication made the resulting OCI available for delivery.

- [ConfigHub base receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/confighub-upload-receipt.yaml)
- [Required-approval check](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/apply-policy-receipt.yaml)
- [Development-to-production promotion receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/promotion-readiness-receipt.yaml)
- [Approved release OCI receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/confighub-release-oci-receipt.yaml)
- [Complete source-to-release chain](../../../data/aicr-v0-20-0-chain/summary.md)

This proves the ConfigHub records, change, promotion, approval, OCI publication,
digest pull, and file comparison. It does not prove that Argo CD or Flux
reconciled the release, that EKS accepted the lifecycle work, or that an H100
workload ran.

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
| Materialize the 16 nested sources | Complete locally. The records bind 16 source artifacts and values sets to 409 objects, including 36 CRDs. | [Nested source inventory](../../../data/aicr-v0-20-0-nested-sources/summary.md) |
| Resolve lifecycle work for Argo CD and Flux | Plans recorded. Both remain blocked until a destination, controller, and required credentials are available. | [Route resolution summary](../../../data/aicr-v0-20-0-route-resolution/summary.md) |
| Retain a ConfigHub base and create derived variants | Complete. The base, development, staging, and production Spaces retain exact configuration and their own README Units. | [ConfigHub base receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/confighub-upload-receipt.yaml) and [promotion receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/promotion-readiness-receipt.yaml) |
| Check approval, promote, and publish a release OCI | Complete. One named change reached production; an unapproved release was blocked; the approved release pulled back by exact digest and matched. | [Required-approval check](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/apply-policy-receipt.yaml) and [release OCI receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/confighub-release-oci-receipt.yaml) |
| Deliver through Argo CD or Flux | Not run for v0.20.0. | Requires destination-specific receipts. |
| Run on EKS and H100 | Not run. No training or NIM request, observation, or rollback is claimed. | Tracked in issue #1581. |

The configuration work is now retained through an approved production release.
The next step is destination evidence: reconcile the release through Argo CD on
EKS, check its CRD and prerequisite handling, run an H100 workload, record live
state, and test exact rollback. Flux and small-fleet evidence follow that run.
