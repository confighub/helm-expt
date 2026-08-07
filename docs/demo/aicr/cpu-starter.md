# The CPU starter derives the shape anyone can exercise

UNOFFICIAL/EXPERIMENTAL. This entry belongs to
[the AICR catalog overview](./index.md). It is the third entry class: the AICR
platform spine without accelerators, for anyone who wants to exercise the
catalog's config mechanics without a GPU, a cloud account, or an NGC key.

## Provenance by derivation, not authorship

The starter invents nothing. Every one of its seven Argo CD Applications is a
byte-identical copy of a rendered Application the
[training entry](./eks-h100-training-kubeflow.md) retains from NVIDIA AICR
v0.14.0. What the starter adds is a selection, and the selection is recorded,
not implied: two mechanical rules exclude anything whose rendered bytes
reference `nvidia.com/gpu` and anything bound to the training OCI bundle by a
path source, and one curated rule excludes three components whose purpose is
cloud-specific or GPU-fleet operations, each with its reason written next to
its name in the
[derivation receipt](../../../examples/aicr/cpu-starter/derivation-receipt.yaml).
The compiler refuses to compile if the curated list goes stale against the
source entry.

What survives is the platform spine: cert-manager, node feature discovery, the
Prometheus operator CRDs, Kube Prometheus Stack, ephemeral-storage metrics,
the KAI scheduler, and the Prometheus adapter, with their original sync-waves
preserved.

## The derivation is pinned end to end

```bash
npm run aicr-cpu-starter:verify
npm run aicr-cpu-starter:self-test
```

The [digest index](../../../examples/aicr/cpu-starter/digest-index/README.md)
pins the starter under one platform digest,
`sha256:d4c19c203ba379690c8de8716b29712b14d69006ae928136f410f634a4a80564`, and
each member payload records the training-entry payload hash it derives from
plus the training entry's own platform digest. The chain from the AICR v0.14.0
release pins through the training index to the starter is checkable end to
end, offline. The compiler also cross-checks every copied byte against the
training index before it compiles, so the starter cannot silently drift from
what the training entry pinned.

The self-test proves the selection rules, the byte-identical copying, the
digest sensitivity, and the refusals against fake surfaces only.

## Honest residues instead of silent edits

The starter keeps the source bytes faithful. Where the retained values
reference cloud resources, the index records the residue instead of editing
it: today that is one reference to the `gp3` storage class inside the Kube
Prometheus Stack values, which a cluster without AWS storage classes does not
provide. Overriding it is exactly the variant mechanics this catalog already
proves elsewhere, and the section below records that override with a receipt.

## The residue override, proven live against ConfigHub

```bash
npm run aicr-starter-variant:verify
```

The starter's first live proof follows the training entry's path and closes
the loop on the recorded residue. A scratch run imported the seven derived
Applications as a ConfigHub base variant from a temporary OCI reference,
confirmed the base Unit matched the committed starter bytes exactly, created
development and staging variants, and applied the gp3 override as a reviewed
change in development: ConfigHub's dry run named the one affected Application
and changed nothing, then the real change moved the Prometheus storage class
from `gp3` to the cluster-default `standard` and touched exactly one
Application. The staging promotion was previewed first and left staging
unchanged; the real promotion then carried the reviewed configuration to
staging with matching canonical data. The
[receipt](../../../runs/aicr-cpu-starter-variant/receipt.yaml) binds the run
to the starter's committed platform digest, and the
[summary](../../../data/aicr-cpu-starter-variant/summary.md) retells it in
plain language. Both scratch Spaces and the temporary registry were deleted
afterward, and the receipt refuses to verify unless that cleanup passed.

## Delivery to a cluster, proven at the config plane

```bash
npm run aicr-starter-delivery:verify
```

The delivery proof puts the starter on a real cluster and stops exactly at the
config plane. The seven Applications traveled as one OCI artifact, were
pulled back byte-faithful, and were applied to a throwaway kind cluster
running a pinned Argo CD. All seven were accepted with their specs and
sync-waves intact, and the boundary was proven rather than asserted: the
retained Applications carry upstream automated sync policies, so the
application controller was held at zero replicas for the entire run, zero
sync operations appeared, and every component destination namespace stayed
absent. Delivery cannot begin until a human scales the controller up. The
[receipt](../../../runs/aicr-cpu-starter-delivery/receipt.yaml) and
[summary](../../../data/aicr-cpu-starter-delivery/summary.md) record the run;
the cluster, registry, and working files were removed afterward.

## One reviewed component, synced

```bash
npm run aicr-starter-sync:verify
```

The first deliberate step past the config plane takes exactly one step. The
reviewed storage-class override from the variant receipt was applied to the
committed Kube Prometheus Stack bytes, the result traveled as one OCI
artifact with the six untouched components, and a running Argo CD on a
throwaway kind cluster synced the CRD prerequisite first and then the
reviewed component, in the order the sync-waves state. Both reached Synced
and Healthy, and the reviewed field became real: every Prometheus volume
claim bound with the cluster-default `standard` class the review selected,
which is exactly what the recorded `gp3` residue prevented before the review.
Scope was proven, not implied: two Applications existed on the cluster, and
every other component destination namespace stayed absent. The
[receipt](../../../runs/aicr-cpu-starter-sync/receipt.yaml) chains the
starter's platform digest, the training entry's digest, and the variant
receipt whose change it realizes; the
[summary](../../../data/aicr-cpu-starter-sync/summary.md) retells it in plain
language.

## What is proven and what is not

Proven: the selection is rule-governed, every copy is byte-identical to
retained configuration, the whole entry is pinned by one digest with an
end-to-end derivation chain, ConfigHub imported the starter and carried the
residue override as a reviewed development-variant change with a dry-run
preview, the same reviewed configuration reached staging through a previewed
promotion, a real cluster's Argo CD accepted all seven Applications with zero
sync operations started, and the one reviewed component synced to Healthy
with its volume bound by the reviewed storage class. Not proven, and stated
rather than implied: the other five components never synced, no GPU exists
anywhere in this entry, and nothing here claims production, AWS, or fleet
behavior. This entry has climbed every rung of the ladder; the increment that
remains is config-plane delivery for the inference entry.
