# The inference entry retains NIM on KServe as configuration

**What is inside.** The retained KServe tree: ten serving runtimes and sixteen
model shapes, from a single `InferenceService` on one GPU to
`llama3-70b-instruct` on four H100s, each a complete file you can read. What
you need to run one: AWS or equivalent GPU capacity and NGC access for the
model images. Reading costs nothing.


UNOFFICIAL/EXPERIMENTAL. This entry belongs to
[the AICR catalog overview](./index.md). It retains NVIDIA's KServe reference
implementation for NIM inference as governed configuration, pinned by one
digest, with the licensing boundary enforced in code. It is a config-plane
entry: no NIM container ran, no model was fetched, and nothing was pulled from
`nvcr.io`. One NGC surface was read, and the entry records which. The public
catalog page for the described model profile supplied the governing-terms
names, and the profile stores those names with the date they were read.

## Why this source, and what it is not

This entry retains NVIDIA's KServe reference implementation, which is a
different repository from AICR itself. That choice was made before anyone here
read AICR's own recipe catalog, and the
[composition-model reference](../../reference/aicr-composition-model.md)
records what a later study found: AICR v0.14.0 already has `platform: nim` as
a first-class criteria value, with `k8s-nim-operator` as a registered
component and its own overlay. Asking the pinned binary for that recipe
returns seventeen components including the NIM operator and an inference
gateway.

So there are two credible NVIDIA sources for a NIM inference shape, and this
entry retains the one that is not AICR-native. The retention, the digest
spine, and the licensing boundary all stand on their own. What does not stand
is any suggestion that this was the only or the strongest upstream option, and
whether the catalog should also retain the AICR-native recipe is an open
question rather than a settled one.

## What is retained

The [upstream tree](../../../examples/aicr/kserve-nim-inference/upstream/kserve/README.md)
is the `kserve` subtree of
[NVIDIA/nim-deploy](https://github.com/NVIDIA/nim-deploy) at commit
`3ef33472b84da9f39131dff0326bf05ac1dc0fe6` (2026-07-31), copied unmodified
under its Apache-2.0 license, which
[travels with the tree](../../../examples/aicr/kserve-nim-inference/upstream/LICENSE).
The tree holds ten `ClusterServingRuntime` definitions, one per NIM version,
and sixteen `InferenceService` shapes covering the upstream model-by-GPU
matrix, from one-GPU Llama 3.1 8B up to eight-GPU Mixtral, plus the setup
scripts. That matrix is real upstream variety, not manufactured variety: every
shape in it was authored by NVIDIA.

The [retention receipt](../../../examples/aicr/kserve-nim-inference/retention-receipt.yaml)
pins the source, the commit, the retrieval method, and the boundary. One
provenance note matters for the record: nim-deploy removed its local nim-llm
Helm chart on 2025-05-09 (pull request 143), and that chart now ships only
through NGC. The [license read](../../planning/nim-ngc-license-read.md)
classifies NGC-served artifacts as gated, so the KServe path is the surface
this catalog retains from GitHub.

## One digest pins the shape

```bash
npm run aicr-kserve-nim:verify
npm run aicr-kserve-nim:self-test
```

The [digest index](../../../examples/aicr/kserve-nim-inference/digest-index/README.md)
compiles one immutable payload per component: each serving runtime, each model
shape, and the described model profile, with every support file bound by
checksum. The whole entry is pinned by
`sha256:7a219c5b0fdef1860454f741d7089379b605d9a7c88d6a2a2ec1df5dbb90c720`.
The compiler refuses to compile when any retained byte drifts from its
recorded checksum, when an `InferenceService` references a runtime that is not
retained, or when a literal credential value appears anywhere in the tree. The
self-test proves all of that against fake surfaces only.

## The licensing boundary, enforced in code

The retained runtimes reference NGC-gated images such as
`nvcr.io/nim/meta/llama-3.1-8b-instruct:1.1.0`. The index lists every gated
reference explicitly, and the references are configuration data: the images
are pulled only by a user's cluster, with the user's own NGC API key, under
the user's own NVIDIA entitlement. Every secret surface in the tree carries
names or environment substitutions only, and the compiler's credential guard
turns that observation into a refusal rule.

The [model profile](../../../examples/aicr/kserve-nim-inference/profile/model-profile.yaml)
describes the smallest current-generation shape, Llama 3.1 8B on one GPU, as
data. It records the four governing-terms names the NGC catalog page stated on
2026-08-07, including the Llama 3.1 Community License Agreement for the model
itself, and it tells the reader to re-read the per-artifact terms at deploy
time because those override any general statement.

## The retained surfaces, imported into ConfigHub

```bash
npm run aicr-kserve-nim-import:verify
```

The entry's first live proof follows the training entry's path. A scratch run
imported the twenty-six retained deployment surfaces (ten serving runtimes
and sixteen model shapes) as one ConfigHub base-variant Unit from a temporary
OCI reference, and the imported Unit matched the committed retained bytes
exactly, with the Space recording the exact OCI source and digest. The
license boundary held live: no NGC surface was contacted, no image was
pulled, the imported data carries no literal credential value, and the gated
image references present in the runtimes are recorded in the
[receipt](../../../runs/aicr-kserve-nim-import/receipt.yaml) as evidence that
references are data. The
[summary](../../../data/aicr-kserve-nim-import/summary.md) retells the run;
all three scratch Spaces and the registry were removed afterward.

The same run then carried one reviewed change through development and into
staging. Upstream leaves the shared model-cache claim for the operator to
create, so its name is a per-cluster decision that has to land consistently
everywhere it appears. Renaming it in the development variant changed exactly
the sixteen model shapes that mount it and left all ten serving runtimes
untouched, with a dry run first that reported the change and altered nothing.
The staging promotion was previewed before it ran and left staging untouched
until it did; staging ended with the reviewed configuration's exact canonical
data.

One CLI limitation is recorded in the receipt rather than worked around.
`NIM_TELEMETRY_MODE` is the telemetry control point the NVIDIA product terms
document, and setting it means adding an environment entry to a runtime.
ConfigHub's search-replace substitutes single tokens rather than inserting
structure, and it reports "Config data not changed" when a multi-line
replacement finds no match, so that change waits for a structural editing
path instead of being faked here.

## Delivery to a cluster, and one thing it found

```bash
npm run aicr-kserve-delivery:verify
```

The retained documents met a real Kubernetes API server. All twenty-six
traveled as one OCI artifact to a throwaway kind cluster carrying KServe's own
custom resource definitions. Twenty-five were accepted and stored unchanged.

One was refused, and finding that is why the proof exists. The serving runtime
for the Nemotron shape carries underscores in its name, which is not a valid
RFC 1123 subdomain, so no Kubernetes cluster will accept it. The proof
confirms the refusal rather than assuming it from a pattern match, and the
entry keeps the document exactly as upstream published it, because retention
records what upstream shipped including its defects.

The KServe controller was deliberately not installed. Without it nothing
reconciles an InferenceService, so the run scheduled no pod and pulled no
image, which is what keeps both the config-plane boundary and the licensing
boundary intact. The run confirmed that too, finding zero workload pods and
zero image-pull events naming the gated registry.

## What is proven and what is not

Proven: the retention is exact, the shape is pinned by one digest, the
cross-references hold, no credential value exists in the tree, ConfigHub
imported the retained surfaces byte-faithful with the license boundary held
live, and one reviewed change moved exactly the sixteen model shapes that
mount the shared claim and reached staging through a previewed promotion. Not
proven, and stated rather than implied: no KServe cluster ran these shapes
under this catalog, no NIM container started, no model was fetched, no claim
was created for the renamed model cache, and no GPU workload claim exists. The
next increment follows the starter's ladder: config-plane delivery mechanics
for the retained shapes.
