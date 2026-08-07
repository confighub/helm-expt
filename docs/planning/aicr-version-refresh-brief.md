# Brief: refreshing AICR to a second retained version

Status: proposal, 2026-08-07. The upstream facts below were read from the
NVIDIA/aicr releases on that date and should be re-read before the build,
because the project ships roughly every two weeks.

## The question this answers

The catalog retains AICR v0.14.0 exactly, and upstream is four minor versions
ahead at v0.18.0 (2026-07-23). The retained-versions discipline says a refresh
creates a new retained entry beside the old one rather than overwriting it.
This brief works out what that second entry actually costs and what it buys,
so the decision is made from facts rather than from the general principle.

## What changed upstream between the retained version and now

The release notes and release assets show four changes that matter to us.

1. **Bundles became signable and verifiable offline.** v0.18.0 adds
   `--tlog-upload=false` for signing without a transparency-log upload and
   `--insecure-ignore-tlog` for verification in disconnected environments,
   plus KMS-backed signing through HashiCorp Vault. Verification also got
   stricter: bundles verify as self-contained artifacts and `recipe.yaml` is
   now covered by bundle checksums.
2. **The recipe catalog is signed.** Every release from v0.15.0 onward ships a
   `recipe-catalog.sigstore.json` asset. The v0.14.0 release we retain does
   not have one.
3. **Recipe resolution enforces stated-criteria coverage** and fails fast when
   a recipe cannot satisfy its declared criteria. Our retained criteria are
   EKS, H100, Ubuntu, training, and Kubeflow, so this is the one change that
   could alter what a refreshed recipe resolves to.
4. **Components moved.** GPU Operator is at v26.3.3 with driver 580.173.02,
   nvidia-tuned is at 0.3.2, and the deployer now deploys independent
   components in parallel rather than strictly in sequence.

## What the refresh buys

The first two changes are the reason to do this, and they are worth more than
a version bump normally is. Today every AICR receipt we hold proves that we
retained bytes and pinned them by digest. A v0.18.0 entry could prove
something we cannot prove at all today: that the upstream bundle carries a
signature, that the signature verifies offline, and that the catalog checked
it before retaining anything. That is a new rung on the proof ladder rather
than a repeat of an existing one, and it is exactly the provenance claim the
catalog exists to make.

The parallel-deployment change is also worth recording honestly. Our delivery
proof holds the Argo application controller at zero replicas precisely because
sync ordering is a decision we have not earned yet. Upstream moving to
dependency-graph parallelism is evidence that sync-wave order is not the whole
story, and a refreshed entry should say so.

## What the refresh costs

The mechanical cost is small and known, because the pipeline exists. A second
entry needs its own generation receipt with the new release-asset and binary
checksums, its own rendered set, its own OCI layouts, and its own digest
index. The compilers take the example root as a parameter already.

Two costs are less obvious.

- **The starter is derived, so it forks.** The CPU starter derives from the
  training entry by recorded rules. A v0.18.0 training entry means either a
  second derived starter or an explicit decision that the starter tracks one
  retained version. The second is probably right, and the derivation receipt
  should name which version it derives from, which it already does.
- **Every claim on the entry pages is version-scoped.** The pages currently
  say "the training entry" where they mean "the v0.14.0 training entry". A
  second version turns that shorthand into ambiguity, and the fix is a naming
  pass before the second entry lands, not after.

## The honest question about breadth

A second retained version doubles the surface without adding a new shape. That
is the right trade only if the refresh proves something new, and here it does:
signature verification. If the signing story turns out not to work offline for
our recipe, the refresh becomes a version bump with no new claim, and the
better decision is to leave v0.14.0 retained and record why. The build should
therefore start with the verification probe, not with the render.

## First increment

Download the v0.18.0 release assets and its `recipe-catalog.sigstore.json`,
verify the signature offline with the documented flags, and record the result
either way. If verification works, continue into the full retained entry with
the signature check as its distinguishing rung. If it does not, write the
finding and stop; the catalog keeps v0.14.0 and gains a recorded reason.
Nothing in this increment needs a GPU or a cluster.
