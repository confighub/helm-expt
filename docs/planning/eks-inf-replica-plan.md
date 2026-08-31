# Build the EKS inference platform from certified parts

The EKS inference stack was assembled by hand by its plugin author. Its eight components are retained as certified bundles, its component manifest is machine-readable, and its plugin already replays the ConfigHub build. This plan proves a stronger claim in stages. The generic tooling and the Catalog can manufacture the same platform from certified parts, and the result matches the hand-built original or names its departures.

The experiment matters for two reasons. It merges the two keystones, because the platform builder manufactures the AI platform. And it converts the stack from a crafted artifact into a reproducible product of the Catalog, which is the certified-bundle model doing its job.

## Fix the source of truth

The pinned input is [data/eks-inf-replica/source/components-manifest.yaml](../../data/eks-inf-replica/source/components-manifest.yaml), a snapshot of the producer's `components.yaml` at the same commit the retained receipts cite. The manifest names eight components across three planes. The hub plane holds shared values in ConfigHub and never touches a cluster. The management plane runs on a local kind cluster and creates AWS infrastructure through ACK. The workload plane runs on the EKS cluster that the management plane creates.

The retained evidence lives in [data/certified-bundles](../../data/certified-bundles/summary.md). Three components are rendered from Helm charts, and each has a certified `eks-inference` catalog variant carrying the producer's reviewed values. Five components are literal YAML, retained as digest-addressed bundles.

## Stage A. Rebuild the parts and match the digests

Stage A runs on a laptop. It needs no AWS account, no GPU, no NGC key, and no ConfigHub quota.

**A.1, done.** [The closure map](../../data/eks-inf-replica/summary.md) derives, from committed receipts alone, that all eight components resolve to retained supply. Three rebuild from certified catalog chart variants, five select retained literal bundles by digest. The join key is shared `source-lock.yaml` evidence, so the mapping is derived rather than asserted.

**A.2, done.** [The parity report](../../data/eks-inf-replica/parity.md) rebuilds each rendered component from its catalog inputs, pulls the retained bundle by pinned digest, and compares object sets. The five literal components verify byte for byte. Every chart-rendered object matches at the spec level except one field: the three ACK controller Deployments run with a deletion policy of delete where the catalog variants keep retain, a real operational choice now named in the report. The remaining departures are exactly two known kinds. Eighty-seven objects carry the producer's Argo CD sync-wave annotation, ordering knowledge the catalog keeps in route files instead, and seven authored objects, two namespaces, two EC2NodeClasses, and three NodePools, exist only in the hand build. Those findings are the stage's product: each is a candidate catalog intake or variant revision.

## Stage B. Judge the whole composition

A certified component is not a certified composition. Stage B runs the eight-check composition verdict proposed in [composition-certification.md](./composition-certification.md) over the assembled stack, its first real target, keyed by one composition digest over the member digests and the pinned manifest.

**B, done.** [The verdict](../../data/eks-inf-replica/composition-verdict.md) passes five checks and returns named findings on three. The acceptance test holds: the single-owner check catches the karpenter-aws component hardcoding the cluster name the profile owns, the defect curation caught by hand, and it catches more of the same kind, including the unlinked provider side of the karpenter discovery tags and an unbound cluster-name environment variable. Closure names the one target-supplied secret, and parity inherits the stage A.2 departures. The single-owner check reads the producer's declared link set, snapshotted with provenance, so a literal copy is one the links would not repair. A self-test mutates the composition in memory and proves every check can go red. The digest is computed by the verdict and not yet promoted into the receipt schema, which stays open as backlog item 30.

## Stage C. Build the ConfigHub organization with generic tooling

The plugin already builds its ConfigHub organization with `cub eksinf install` and `cub eksinf sandbox up`. Stage C rebuilds the same organization with the generic surface instead: `cub variant upload` for the bases, `cub variant create` for the sandbox variants, links for the shared values, and the standard checks and releases. The acceptance test compares the two organizations.

**C, done, shape parity.** [The comparison](../../data/eks-inf-replica/org-rebuild/comparison.md) captures both builds of the twenty-space organization on a disposable self-hosted server and finds every compared dimension identical: space labels, unit sets, unit data hashes, upstream linkage, link counts, triggers, release counts, and targets. The rebuild is driven only by the committed snapshots, the manifest, the bindings, and the retained bundle digests, and the profile links are created with `cub link create` bodies that mirror the producer's, escaped paths and all. Two product behaviors surfaced on the way. The server itself generates an Argo Application unit for every target-bound variant, from the target's argo-apps annotation, so the delivery scaffolding is generically reachable. And the producer patches `prune: true` into each generated Application at deploy time, which its own comments pair with the ACK deletion-policy choice that stage A.2 surfaced: one design decision, spanning two artifacts, that the composition verdict should eventually own. The run leaves the organization exactly as it found it.

## Stage D. Accept the inference workload without a real GPU

The H100 serving run stays blocked on GPU capacity and NGC access, and this plan does not wait for it. Stage D proves everything short of CUDA execution on simulated GPU capacity.

A local cluster advertises `nvidia.com/gpu` resources on nodes that have no GPU. The inference workloads travel the governed path, ConfigHub to OCI to Argo CD, and land on the advertised capacity.

**D-sim, done.** [The receipt](../../data/eks-inf-replica/sim-gpu/receipt.yaml) records the whole path on a kind cluster brought up by `cub cluster up`. The retained bundle travelled by pinned digest through upload, variant, and release; the GPU deployments ship at zero replicas, so the scale-up went through cub and a republish, never kubectl. Before capacity existed the scheduler refused the GPU pod and named the missing resource. One node-status patch then advertised two simulated GPUs behind a NoSchedule taint and the pool label, and both GPU-shaped pods scheduled onto the node, with selection, toleration, and extended-resource accounting all honored. The smoke pod's own log states the boundary verbatim: the test line prints, and nvidia-smi is not found. No CUDA kernel ran, no model answered, every image in this bundle is public so the gated-registry check does not apply, and these workloads set no runtimeClassName, so that wiring goes unexercised. The run tears down to a clean organization.

The real-GPU run remains the final rung, and its receipt is what earns the AI story a homepage card.

## Coda. The keystone speaks the vocabulary

The replica track rebuilt the platform with generic verbs; the coda expresses it in the settled stack vocabulary. [The stack definition](../../examples/cub-stack/stacks/eks-inference.yaml) composes the eight digest-pinned bundles across three planes, and `cub stack sandbox eks-inference` certifies and renders the whole platform for free, with [a committed receipt](../../data/eks-inf-replica/stack-sandbox/summary.md). The prototype's certify surfaced one finding of its own, the shared ACK CRDs carried byte-identically by several charts inside one component, which the eight-check verdict's conflict map had silently deduplicated: the two certify layers check each other. `cub stack upload` points at the proven organization rebuild rather than re-implementing it.

## Keep the claims honest

- A closure map is not a rebuild. A rebuild is not a composition verdict. A sandbox organization is not a deployment. A simulated-GPU acceptance is not a serving proof. Each stage claims its own result and nothing more.
- Departures between the manufactured and hand-built platforms are recorded and named, never smoothed over.
- Secrets, cloud identity, and target-owned facts stay outside every stage of this plan.
