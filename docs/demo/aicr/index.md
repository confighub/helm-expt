# Start from an AI platform somebody already checked

UNOFFICIAL/EXPERIMENTAL. Teams assembling GPU platforms copy YAML from blog
posts, and an H100 misconfiguration has a dollar sign attached. This page lists
six AI platform entries you can read before you run anything, and says what
each one needs.

AICR is NVIDIA's Apache-2.0 tool for building AI-cluster platforms
([github.com/NVIDIA/aicr](https://github.com/NVIDIA/aicr)). You describe the
platform you want and AICR picks the components, orders the installs, and writes
the files. It does not decide how your team reviews, approves, or promotes them.
That is the part this catalog adds, the same way it adds it to Helm charts.

If your immediate goal is to run a model rather than inspect a platform, start
with the separate [vLLM CPU example](../../../examples/inference/vllm-cpu-starter/README.md).
It runs one real request without a GPU or cloud account. It is not an AICR entry;
it is the accessible runtime check beside this platform catalog.

## Which entry should I open?

| Entry | What it builds | What you need | Retained version |
| --- | --- | --- | --- |
| [CPU starter](./cpu-starter.md) | The platform spine without accelerators. Start here to see the mechanics. | Nothing. No GPU, no cloud account, no NGC key. | Derived from AICR v0.14.0 |
| [EKS + H100 + Kubeflow](./eks-h100-training-kubeflow.md) | A training platform: EKS, H100 nodes, Kubeflow, a training job. | AWS and GPU capacity to run it. Reading it costs nothing. | AICR v0.14.0 |
| [The same platform, four minor versions later](./eks-h100-training-kubeflow-v0-18-0.md) | The same training platform regenerated, so you can see what upstream changed. | As above. | AICR v0.18.0 |
| [AICR v0.19.0 with source, objects, variants, and release OCI](./eks-h100-training-kubeflow-v0-19-0.md) | The same training choice retained again, including source signatures, 17 exact Applications, all 16 nested-source renders, public input OCI, ConfigHub variants, an approved release OCI, and the blocked EKS/H100 route. | Reading and local verification need no cloud account or GPU. Running it still needs EKS and H100 capacity. | AICR v0.19.0 |
| [The AICR-native NIM platform](./eks-h100-inference-nim.md) | A cluster that can serve NIM models. | AWS, GPU capacity, and NGC access to run the models. | AICR v0.14.0, `platform: nim` |
| [NIM on KServe](./kserve-nim-inference.md) | The exact shape one model runs in, at model level rather than cluster level. | As above. | Upstream commit 3ef33472 |

The training entry carries the proven mechanics. The two inference entries
answer the serving question at different granularities: the AICR-native entry
stands up a cluster that can serve NIM, and the KServe entry names the shape a
given model runs in. The [inference entry](./eks-h100-inference-nim.md) compares
them directly.

## What has actually been run

Every proof here ran on kind or against ConfigHub, and every one is
config-plane only: import, render, digest pinning, variants, promotion,
delivery wiring. **No GPU workload ran to produce or verify any receipt in this
catalog.** Workload claims stay absent rather than implied.

The [CPU starter](./cpu-starter.md) has been taken furthest: imported into
ConfigHub with a reviewed gp3 override, promoted to staging, delivered to a kind
cluster, and one component synced to Healthy with its volume bound by the
reviewed storage class. The training entry proved import, a reviewed Grafana
change, and a staging promotion. The [inference entry](./kserve-nim-inference.md)
proved two of those stages: import of all twenty-six retained surfaces with the license boundary held
live, a reviewed model-cache rename that touched exactly the sixteen model
shapes that mount it and left all ten serving runtimes untouched, and delivery
of its serving surface to a kind cluster.
What an entry has not done is listed per entry in the
[platform evidence record](../../../data/aicr-platform-evidence/summary.md)
rather than left to inference. Each receipt is recompiled offline by its own
verify lane, so these are checkable rather than asserted.

[The closing record](../../planning/aicr-track-conclusion.md) says what this
track proves, what it refuses to claim, and what is left for whoever picks it
up.

## Why the versions look old

The training entry retains NVIDIA AICR v0.14.0 exactly: the release commit, the
release-asset checksum, and the binary checksum are pinned in its
[generation receipt](../../../examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml).
How far behind upstream that leaves the catalog is measured rather than
described. The
[upstream watch](../../../data/aicr-upstream-watch/summary.md) compares every
retained version against a committed snapshot of the release list, and it
computes the release cadence instead of repeating it.

That gap is the point of retention, not a defect. The retained entry stays
byte-for-byte reproducible and its receipts stay true while upstream moves.
Refreshing the catalog to a newer AICR version creates a new retained entry with
its own receipts next to the old one; it never overwrites the proven shape. This
is the same retained-versions discipline the chart catalog and the Kubara
component catalog follow.

That is no longer only a policy statement. The catalog retains
[v0.18.0](./eks-h100-training-kubeflow-v0-18-0.md) and
[v0.19.0](./eks-h100-training-kubeflow-v0-19-0.md) beside the original entry.
The [version comparison](../../../data/aicr-version-diff/summary.md) is rebuilt
from their committed files. It shows which source versions, ordering rules,
checks, and exact objects changed at each step.

The v0.19.0 entry also verifies NVIDIA's signed CLI binary and recipe catalog
against the exact release-workflow identity. It keeps the AICR recipe, generated
source chart, literal Application OCI, all sixteen nested renders, route intent,
field-policy record, promoted staging variant, and approved ConfigHub release
OCI connected instead of treating one rendered directory as the whole answer.

## How do I know these are the files AICR wrote?

Every entry carries the digest spine the Kubara importer proved: one immutable
OCI payload per component plus one digest-bound platform index. For the training
entry, the [digest index](../../../examples/aicr/eks-h100-training-kubeflow/digest-index/README.md)
pins the upstream source, the recipe criteria, the three OCI transport
manifests, and all 17 rendered Argo CD Applications under a single platform
digest. Change any rendered byte anywhere in the shape and the digest changes.

```bash
npm run aicr-digest-index:verify
npm run aicr-digest-index:self-test
```

The inference entry carries the same spine. Its
[digest index](../../../examples/aicr/kserve-nim-inference/digest-index/README.md)
pins the retained KServe tree, every serving runtime and model shape, and the
described model profile, and its compiler adds the licensing boundary as
refusal rules: gated images stay references, and a literal credential value
anywhere in the tree stops the compile.

```bash
npm run aicr-kserve-nim:verify
npm run aicr-kserve-nim:self-test
```

The CPU starter's index adds a derivation chain: each member payload records
the training-entry payload hash it copies and the training entry's platform
digest, so the path from the AICR release pins through the training index to
the starter is checkable end to end.

```bash
npm run aicr-cpu-starter:verify
npm run aicr-cpu-starter:self-test
```

The training entry also carries an OCI round-trip receipt and a
variant-promotion receipt that changed one Grafana credential in a development
variant and promoted it to staging with matching data hashes. The
[entry page](./eks-h100-training-kubeflow.md) walks through both.

## What this catalog turns down

The catalog refuses manufactured variety. A new entry comes from an upstream
version, from a deliberately authored shape whose provenance is named, or from a
recorded derivation of an entry that already exists. The inference entry's
sixteen model-by-GPU shapes are upstream-authored variety retained exactly, and
the starter's seven components are byte-identical copies selected by rules its
derivation receipt records.

The [refusal corpus](./refusal-corpus.md) records what it turns down, by running
the shipped lanes against changes a contributor could plausibly propose and
publishing the verdicts. Two of those candidates have to be accepted, because
lanes that refused everything would look identical to lanes that refused the
right things.

The counts on these pages are checked the same way. Every number followed by a
counted noun is bound to a quantity computed from committed bytes, and
[the claim-integrity lane](./claim-integrity.md) refuses both a number that has
drifted and a counted claim nobody declared.
