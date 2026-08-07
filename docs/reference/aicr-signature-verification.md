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

## What it does not prove

The recipe catalog artifact itself is not checked here, because the catalog is
not published as a release asset and no copy is retained. The attestation's
subject digest is recorded in the receipt so that a future retained copy can
be bound to it, and claim checking stays off until that copy exists. Read the
receipt as evidence about who signed a statement, not yet as evidence about a
file we hold.

The receipt also concerns the upstream v0.18.0 release. The catalog still
retains v0.14.0, which shipped no signature at all, so no retained entry
carries a signature claim today.

## What this unblocks

The refresh brief can proceed with signature verification as the new rung a
second retained entry would carry, and the cost of that rung is now known
rather than estimated. When the refresh happens, the retained entry should
bind its retained bytes to the attested subject digest and turn claim checking
back on, which is the step that upgrades this from a statement about a signer
to a statement about the artifact we retain.
