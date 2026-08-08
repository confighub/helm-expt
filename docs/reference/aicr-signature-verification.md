# How the catalog verifies AICR upstream signatures

Maintained decision, made 2026-08-07. The
[refresh brief](../planning/aicr-version-refresh-brief.md) blocked a second
retained AICR version on choosing a verification toolchain. This page records
the choice, the evidence behind it, and what the choice does and does not
prove. The runnable lane that implements it is
`npm run aicr-signature:verify`.

## The decision

The catalog verifies upstream AICR signatures with cosign 2.6.1, run from its
published container image, against a sigstore trust root committed in this
repository, with `--use-signed-timestamps`, and with the container's network
disabled. It does not use the vendor's own verification command, and it does
not install cosign on any machine.

## Why each part of that

**Cosign 2.6.1 specifically.** Older cosign cannot read these bundles at all.
Version 2.4.1 refuses the release's transparency-log entry with `nil value in
transaction log entry`, with and without `--insecure-ignore-tlog`, because it
expects a log entry shape this release does not use. Version 2.5.3 reads the
entry and then fails leaf-certificate verification against its default trust
root. Version 2.6.1 verifies the same bundle without any insecure flag. The
version is therefore load-bearing and is pinned in the receipt.

**Signed timestamps.** AICR's release signature is Rekor v2 era material: its
log entry is a `hashedrekord` version `0.0.2` carrying an inclusion proof, and
it has no integrated time. Cosign needs a trusted time to check the signing
certificate was valid when it signed, and without one it stops with
`threshold not met for verified log entry integrated timestamps`. The bundle
carries an RFC 3161 timestamp from sigstore's timestamp authority, and
`--use-signed-timestamps` tells cosign to use it. That flag is what makes the
verification work, and it is not a weakening.

**A committed trust root and no network.** Passing `--trusted-root` with a
committed copy of sigstore's trust root removes the last network dependency,
so verification runs with `--network none`. This matters twice over: it makes
the check reproducible years from now, and it matches the air-gapped story
upstream added in the same release. The trust root is the one input that ages,
so refreshing it is a deliberate, reviewable change rather than a silent
fetch.

**A container rather than an install.** The verifier is a pinned image
reference, so the exact verifier is recorded in the receipt and nobody has to
install anything to reproduce the result.

**Not the vendor command.** The `aicr` binary can verify its own artifacts,
and using it would mean running a freshly downloaded vendor binary to check
that same vendor's signature. The circularity is the problem, not the vendor.
An independent verifier checking a signature against public trust material is
a stronger claim, and it stays available if we ever verify a different
project's releases.

## What the lane proves

`npm run aicr-signature:run` performs the verification and writes a receipt.
It proves three things:

1. The signature over the release's recipe-catalog attestation verifies
   offline against pinned trust material.
2. The signer is the tagged release workflow in NVIDIA/aicr, identified
   through GitHub Actions OIDC, and the statement carries a SLSA provenance
   predicate naming the repository, organization, runner, and build commit.
3. The check can fail. The same command is run again with a different signer
   identity and must be refused, and the receipt records that refusal.

`npm run aicr-signature:verify` re-checks the committed receipt against the
committed bundle without cosign, a container, or a network, so the ordinary
verify chain stays free of this toolchain.

## The subject is bound to bytes we hold, since 2026-08-08

This section previously said the opposite, and the change is worth stating
plainly rather than quietly editing.

The signature covers a subject named `recipe-catalog`. Upstream computes that
subject in `pkg/recipe/catalog/digest.go` as a length-prefixed SHA-256 over
two files, the component registry and the validator catalog:

```
sha256( u64be(len(registry)) || registry || u64be(len(catalog)) || catalog )
```

The length prefixes make the encoding injective, so two different splits of
the same bytes cannot collide. Both files are now retained beside the bundle,
and the lane recomputes that digest over the retained bytes on every run. It
reproduces the attested subject exactly, and the lane refuses if it ever stops
doing so.

That upgrades the receipt from a statement about a signer to a statement about
an artifact this repository holds. An auditor can repeat the computation with
nothing but the retained files and a hash function.

## What it still does not prove

The two bound files are the whole of what the signature covers. The rest of
the recipe tree, including the overlays and mixins that decide what a platform
contains, is outside the attested subject, so this receipt says nothing about
them. That is upstream's scope decision rather than ours, and it is worth
knowing before treating the signature as covering the recipes themselves.

The receipt also concerns the upstream v0.18.0 release. The catalog still
retains v0.14.0, which shipped no signature at all, so no retained entry
carries a signature claim today.

## The trust root is the one input that ages, and it is now reviewed

Passing a committed trust root is what removes the last network dependency, and
it is also what makes that file the part of this lane that goes out of date.
Sigstore publishes updates to its trust root, and our copy is a snapshot of one
moment.

The refresh trigger is drift rather than expiry. Every active entry in the
committed root carries a start date and no end date. Only two entries have
ended, both years ago, and they are kept so signatures made while they were
valid still verify. There is no deadline to count down to, so a lane that
counted one down would be inventing it.

```bash
npm run aicr-trust-root:verify
```

`npm run aicr-trust-root:run` compares the committed trust root against the one
sigstore publishes and records the result either way. At the review on
2026-08-08 the two were byte-identical, so the committed copy is not a local
variant of anything. The verify lane is offline and refuses when the committed
trust root has changed since the review that recorded it, which makes replacing
trust material a reviewable step rather than a diff someone might scroll past.

It deliberately does not check the trust root against the network. That would
put a network dependency back into the ordinary verify chain, which is the
thing the committed copy exists to remove. The
[review record](../../data/aicr-trust-root-review/summary.md) lists what the
trust root contains and what it retains for older signatures.

## What this unblocks

The refresh brief can proceed with signature verification as the new rung a
second retained entry would carry, and the cost of that rung is now known
rather than estimated. The binding step it was waiting on is done, so a
v0.18.0 retained entry would inherit a provenance chain that already runs from
the signer through the attested subject to bytes on disk.
