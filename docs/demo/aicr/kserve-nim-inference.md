# The inference entry retains NIM on KServe as configuration

UNOFFICIAL/EXPERIMENTAL. This entry belongs to
[the AICR catalog overview](./index.md). It retains NVIDIA's KServe reference
implementation for NIM inference as governed configuration, pinned by one
digest, with the licensing boundary enforced in code. It is a config-plane
entry: no NIM container ran, no model was fetched, and no NGC surface was
contacted to produce or verify anything here.

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
the scratch Space and registry were removed afterward.

## One reviewed change, sixteen model shapes

```bash
npm run aicr-kserve-nim-variant:verify
```

The entry then climbed the starter's next rung. A scratch run created
development and staging variants from the imported base and made the decision a
platform team makes before anything runs: development model shapes read from
their own model cache volume rather than the shared one, so
`spec.predictor.model.storageUri` moved from `pvc://nvidia-nim-pvc/` to
`pvc://nvidia-nim-pvc-dev/`.

That is where configuration as data earns its keep. One reviewed change covered
all sixteen model shapes, and all ten serving runtimes came through
byte-identical, which the
[receipt](../../../runs/aicr-kserve-nim-variant/receipt.yaml) checks by
comparing every resource rather than by asserting it. ConfigHub previewed the
change first: the dry run named all sixteen affected model shapes and the exact
field it would update, and left the stored configuration untouched. The
promotion to staging was previewed the same way, and the promoted staging
variant recorded the same canonical data as the reviewed development variant.

The license boundary held here too. The gated image references were identical
before and after the change, nothing was pulled from `nvcr.io`, and no
variant's data carries a literal credential value. The
[summary](../../../data/aicr-kserve-nim-variant/summary.md) retells the run;
all three scratch Spaces and the temporary registry were removed afterward.

## What is proven and what is not

Proven: the retention is exact, the shape is pinned by one digest, the
cross-references hold, no credential value exists in the tree, ConfigHub
imported the retained surfaces byte-faithful with the license boundary held
live, and one reviewed change moved every model shape and no serving runtime
through a previewed dev-to-staging promotion. Not proven, and stated rather
than implied: no KServe cluster ran these shapes under this catalog, no NIM
container started, no model was fetched, no PersistentVolumeClaim was created
for the development model cache, and no GPU workload claim exists. The next
increment is the starter's last rung, config-plane delivery mechanics.
