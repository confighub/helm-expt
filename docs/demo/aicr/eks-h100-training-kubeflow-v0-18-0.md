# The same platform, four minor versions later

UNOFFICIAL/EXPERIMENTAL. This entry belongs to
[the AICR catalog overview](./index.md). It retains AICR v0.18.0 from the same
criteria as
[the v0.14.0 training entry](./eks-h100-training-kubeflow.md), so the catalog
now holds two retained versions of one platform and can say exactly what moved
between them.

```bash
npm run aicr-training-v0180:verify
```

## Why a second version rather than an upgrade

The retained-versions discipline says a refresh creates a new entry beside the
old one. Overwriting would destroy the only thing that makes a retained version
worth having, which is that it stays available to compare against. The
[refresh brief](../../planning/aicr-version-refresh-brief.md) worked out what
that costs before any of it was built.

The brief also set a condition. A second version doubles the surface without
adding a new shape, so it is only worth doing if it proves something new. It
does, and the proof is below.

## What was checked before the binary ran

This is the first AICR entry whose generating binary arrives with a verified
provenance chain rather than a checksum alone.

The downloaded release asset matches the sha256 in the release's own
`aicr_checksums.txt`, and that file's own hash is recorded so the check can be
repeated against the same list. The tarball ships
`recipe-catalog.sigstore.json`, and it is byte-identical to the copy this
repository committed and verified offline with
[the signature lane](../../reference/aicr-signature-verification.md). The
binary reports build commit `1439f2fc`, which is the commit named in the Fulcio
certificate that the verified signature carries.

So the binary and the signature agree about which build produced them. The
[generation receipt](../../../examples/aicr/eks-h100-training-kubeflow-v0-18-0/generation-receipt.yaml)
also records what that does not cover: the signature attests the recipe
catalog, not the binary, so the binary's provenance still rests partly on
checksums served over HTTPS. Saying so is the difference between a provenance
chain and a provenance impression.

## The stricter resolver changed nothing here

v0.18.0 enforces stated-criteria coverage and fails fast when a recipe cannot
satisfy its declared criteria. That was the one upstream change that could have
altered what our criteria resolve to.

It resolved without complaint and produced the same fifteen components the
v0.14.0 recipe declares. That is a real answer to a real question, and it is
recorded in the receipt rather than assumed from a successful run.

## What actually moved

```bash
npm run aicr-version-diff:verify
```

The [version diff](../../../data/aicr-version-diff/summary.md) is computed from
the committed bytes of both entries on every run, so it cannot drift from the
entries it describes. The short version is that the platform did not change and
the parts did. The component set is identical, the declared deployment order is
identical, and both render seventeen Argo CD Applications. Nine components
changed the chart version they pull, including the GPU Operator moving from
26.3.1 to 26.3.3, and one changed its versioning scheme entirely.

## The scheduling change is the one that mattered to us

The distinct sync-wave count fell from sixteen to five while the number of
Applications stayed the same. v0.14.0 gave every component its own wave, which
is a strict sequence. v0.18.0 puts independent components in one wave, which is
parallel deployment of everything that does not depend on anything else.

That broke two of our own checks, and both were wrong rather than upstream.

The digest-index compiler required the waves to be a contiguous unique range,
which was a fair structural check when every component had its own wave and is
simply false now. The ordering-parity lane compared the wave order against the
recipe's `deploymentOrder` as a linearization, which a partial order cannot
satisfy.

Both now check what the ordering was always meant to express. Every recipe
carries the dependency edges its order was computed from, and the lane checks
that each component's wave comes after the wave of everything it depends on. It
checks `deploymentOrder` against the same edges, because a declared order that
contradicts its own graph is worth catching. Seventeen edges hold in each
entry, under both models.

An entry whose waves are all distinct is still held to the stronger claim that
the rendered order equals the declared one exactly. An entry that groups them
is not, and
[the ordering-parity record](../../../data/aicr-ordering-parity/summary.md)
says which model each entry follows rather than flattening them into one rule.

## One digest pins this entry too

The [digest index](../../../examples/aicr/eks-h100-training-kubeflow-v0-18-0/digest-index/README.md)
pins the upstream source, the recipe criteria, and all seventeen rendered
Applications under
`sha256:b9e5af994a0e1aeb2a055d43ccf88399c3d4faab880e1ae7ae03b06c14571575`. It
is compiled by the same compiler the other entries use.

## What is proven and what is not

Proven: the generating binary's release asset matched its published checksum,
it ships the signature bundle this repository verified offline, its build
commit agrees with that signature, the criteria resolved under the stricter
resolver to the same component set, every retained byte is pinned by one
digest, and the dependency edges hold in the rendered waves.

Not proven, and stated rather than implied: this entry was never published, so
it carries no public digest and no OCI transport receipts. It has no ConfigHub
import, no variant, no promotion, and no delivery proof. The
[platform evidence record](../../../data/aicr-platform-evidence/summary.md)
lists it with an empty ladder for exactly that reason. No GPU workload ran, no
cluster was contacted, and one file had trailing spaces removed, which the
receipt records as a normalization rather than passing off as upstream bytes.
