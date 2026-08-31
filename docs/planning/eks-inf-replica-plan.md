# Build the EKS inference platform from certified parts

The EKS inference stack was assembled by hand by its plugin author. Its eight components are retained as certified bundles, its component manifest is machine-readable, and its plugin already replays the ConfigHub build. This plan proves a stronger claim in stages. The generic tooling and the Catalog can manufacture the same platform from certified parts, and the result matches the hand-built original or names its departures.

The experiment matters for two reasons. It merges the two keystones, because the platform builder manufactures the AI platform. And it converts the stack from a crafted artifact into a reproducible product of the Catalog, which is the certified-bundle model doing its job.

## Fix the source of truth

The pinned input is [data/eks-inf-replica/source/components-manifest.yaml](../../data/eks-inf-replica/source/components-manifest.yaml), a snapshot of the producer's `components.yaml` at the same commit the retained receipts cite. The manifest names eight components across three planes. The hub plane holds shared values in ConfigHub and never touches a cluster. The management plane runs on a local kind cluster and creates AWS infrastructure through ACK. The workload plane runs on the EKS cluster that the management plane creates.

The retained evidence lives in [data/certified-bundles](../../data/certified-bundles/summary.md). Three components are rendered from Helm charts, and each has a certified `eks-inference` catalog variant carrying the producer's reviewed values. Five components are literal YAML, retained as digest-addressed bundles.

## Stage A. Rebuild the parts and match the digests

Stage A runs on a laptop. It needs no AWS account, no GPU, no NGC key, and no ConfigHub quota.

**A.1, done.** [The closure map](../../data/eks-inf-replica/summary.md) derives, from committed receipts alone, that all eight components resolve to retained supply. Three rebuild from certified catalog chart variants, five select retained literal bundles by digest. The join key is shared `source-lock.yaml` evidence, so the mapping is derived rather than asserted.

**A.2, next.** Rebuild each rendered component from its catalog inputs and compare the result with the retained stack bundle at the object level. Render the catalog variant, pull the stack bundle anonymously from its public registry, parse both sides, and compare object sets. File layouts differ by design, so the comparison keys on parsed objects, not file hashes. Success is object parity per component, or a short named-departure list. A departure is a finding, not a failure, because it shows what the hand build knows that the Catalog does not yet encode.

## Stage B. Judge the whole composition

A certified component is not a certified composition. Stage B runs the composition verdict proposed in [composition-certification.md](./composition-certification.md) over the assembled stack: closure, single ownership, CRD and API-version compatibility, and conflicts, keyed by the digests the bundles already carry. The stack becomes the first real target for that verdict, and the verdict becomes the gate that says the manufactured platform is coherent before anything is loaded.

## Stage C. Build the ConfigHub organization with generic tooling

The plugin already builds its ConfigHub organization with `cub eksinf install` and `cub eksinf sandbox up`. Stage C rebuilds the same organization with the generic surface instead: `cub variant upload` for the bases, `cub variant create` for the sandbox variants, links for the shared values, and the standard checks and releases. The acceptance test compares the two organizations. Unit quota is limited, so the run is serial and cleans up after itself.

## Stage D. Accept the inference workload without a real GPU

The H100 serving run stays blocked on GPU capacity and NGC access, and this plan does not wait for it. Stage D proves everything short of CUDA execution on simulated GPU capacity.

A local cluster advertises `nvidia.com/gpu` resources on nodes that have no GPU, using a simulated-kubelet or fake-device approach. The inference workloads travel the governed path, ConfigHub to OCI to Argo CD, and land on the advertised capacity. That proves scheduling, node selection, tolerations, runtime-class wiring, policy, and delivery for the exact GPU-shaped objects. The honest boundaries stay explicit. No CUDA kernel runs, no model answers, and a scheduled pod on simulated capacity is not a serving proof. Image existence and digest pinning for gated registries are checked separately and named as their own result.

The real-GPU run remains the final rung, and its receipt is what earns the AI story a homepage card.

## Keep the claims honest

- A closure map is not a rebuild. A rebuild is not a composition verdict. A sandbox organization is not a deployment. A simulated-GPU acceptance is not a serving proof. Each stage claims its own result and nothing more.
- Departures between the manufactured and hand-built platforms are recorded and named, never smoothed over.
- Secrets, cloud identity, and target-owned facts stay outside every stage of this plan.
