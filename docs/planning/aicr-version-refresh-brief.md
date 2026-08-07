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

## Probe result recorded 2026-08-07

The verification probe ran the same day and returned a more useful answer than
yes or no. The signing is real and its provenance is excellent, but verifying
it needs tooling this environment does not have, and that changes the shape of
the work rather than cancelling it.

What the `recipe-catalog.sigstore.json` from the v0.18.0 release actually
contains, read without any verification tool:

- A sigstore bundle version 0.3 carrying a DSSE envelope, whose payload is an
  in-toto Statement v1 with a SLSA provenance v1 predicate.
- One subject, `recipe-catalog`, pinned at
  `sha256:b622b4f66d60129b8b6ff49b154ea2ea34e308bd681028cec5c79e6e9ed2db18`.
- A Fulcio certificate whose subject alternative name is
  `https://github.com/NVIDIA/aicr/.github/workflows/on-tag.yaml@refs/tags/v0.18.0`,
  issued through `https://token.actions.githubusercontent.com`, naming the
  NVIDIA organization, the source repository, a GitHub-hosted runner, and the
  exact build commit `1439f2fc5db27e6bb9ef3d73e8f8afca45a32126`.
- One transparency-log entry of kind `hashedrekord` version `0.0.2` carrying
  an inclusion proof, with no inclusion promise and no integrated time.

That last detail is the blocker. Stock cosign 2.4.1 refuses the entry with
`nil value in transaction log entry`, both with and without
`--insecure-ignore-tlog`, because it expects the older entry shape. Cosign
2.5.3 parses the entry and then fails leaf-certificate verification against
its default trust root. Both results are consistent with the release notes,
which say AICR runs its own Rekor v2 identity monitoring for the release
signer: this is Rekor v2 era material, and verifying it needs either newer
trust material passed explicitly or the vendor's own `aicr` verification
command.

The probe stopped there rather than running a freshly downloaded vendor
binary.

What this means for the decision. The refresh still buys a genuinely new rung,
and the provenance chain above is stronger evidence than expected, because it
identifies the workflow, repository, organization, and commit that produced
the catalog. The cost estimate changes: the refresh needs a verification
toolchain decision first, either pinning a cosign version with an explicit
trusted root or adopting the vendor command and recording what it checks. That
decision is the real first increment, and it is smaller than the entry build
it gates.

## Toolchain decision made 2026-08-07

That decision is now made and recorded in
[how the catalog verifies AICR upstream signatures](../reference/aicr-signature-verification.md),
with a runnable lane behind it. Cosign 2.6.1 in a container, a committed
sigstore trust root, `--use-signed-timestamps` for the missing integrated
time, and the network disabled verifies the v0.18.0 signature with no insecure
flag, and the lane also proves it refuses a wrong signer identity. The refresh
is unblocked, and the rung it would add is now demonstrated rather than
assumed.
