# The AICR catalog retains exact AI-platform shapes

UNOFFICIAL/EXPERIMENTAL. This page is the starting point for the AICR entries in
the catalog. It names the three entry classes we track, what exists today, what
is planned, and the exact boundary every claim respects.

AICR is NVIDIA's Apache-2.0 tool for building AI-cluster platforms
([github.com/NVIDIA/aicr](https://github.com/NVIDIA/aicr)). You describe the
platform you want and AICR picks the components, orders the installs, and writes
the files. The catalog applies the same discipline here that it applies to Helm
charts and to the Kubara platform: retain exact versions, pin every package by an
immutable OCI digest, and attach a receipt to every claim. Teams assembling GPU
platforms copy YAML from blog posts today, and an H100 misconfiguration has a
dollar sign attached. Nobody offers governed, provenance-carrying configuration
for this space; that gap is why these entries exist.

## Three entry classes track how buyers differ

Buyers train, they serve, or they want to try the mechanics without GPUs. The
taxonomy follows that split.

| Entry class | Status | Source |
| --- | --- | --- |
| Training | Exists: [EKS + H100 + Kubeflow](./eks-h100-training-kubeflow.md) | NVIDIA AICR v0.14.0, retained exactly |
| Inference / serving | Exists as retained configuration: [NIM on KServe](./kserve-nim-inference.md) | The KServe subtree of [NVIDIA/nim-deploy](https://github.com/NVIDIA/nim-deploy) at an exact commit, Apache-2.0 |
| CPU starter | Exists as derived configuration: [the platform spine without accelerators](./cpu-starter.md) | Derived from the training entry by recorded selection rules; needs no GPU, cloud account, or NGC key |

All three entries exist today: the training entry with its proven mechanics,
the inference entry as retained configuration, and the CPU starter as a
rule-governed derivation of the training entry. The catalog refuses
manufactured variety: new entries come from upstream versions, from
deliberately authored shapes whose provenance is named, or from recorded
derivations of an existing entry. The inference entry's sixteen model-by-GPU
shapes are upstream-authored variety, retained exactly, and the starter's
seven components are byte-identical copies selected by rules the derivation
receipt records.

The inference class carries a licensing boundary worth stating early. NIM
deploys through public Helm charts and the NIM Operator, so the deployment
shapes can be cataloged, but the runtime images and models behind them are
NGC-gated under NVIDIA AI Enterprise licensing. The entry retains the
configuration shapes and never redistributes the gated artifacts. The
[license read](../../planning/nim-ngc-license-read.md) verified this boundary
against the actual terms: the scaffolding the entry would retain is Apache-2.0,
the gated material is exactly what a config-plane entry never touches, and NGC
API keys enter the shape only as target facts.

## Retained versions while upstream moves

The training entry retains NVIDIA AICR v0.14.0 exactly: the release commit, the
release-asset checksum, and the binary checksum are pinned in its
[generation receipt](../../../examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml).
Upstream has since released v0.15.0 through v0.18.0 (2026-07-23, checked
2026-08-07) on a roughly biweekly cadence.

That gap is the point of retention, not a defect. The retained entry stays
byte-for-byte reproducible and its receipts stay true while upstream moves.
Refreshing the catalog to a newer AICR version creates a new retained entry with
its own receipts next to the old one; it never overwrites the proven shape. This
is the same retained-versions discipline the chart catalog and the Kubara
component catalog follow.

## One digest pins each shape

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

## The boundary every receipt states

All proofs here run on kind or against ConfigHub, and they prove config-plane
mechanics only: import, render, digest pinning, variant, promotion, delivery
wiring. No GPU workload ran to produce or verify any receipt in this catalog.
Workload-plane claims wait until a real GPU target exists, and they stay absent
rather than implied.
