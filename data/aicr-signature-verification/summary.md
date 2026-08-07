# AICR upstream signature verification

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed
receipt. Re-run the verification with `npm run aicr-signature:run`; check the
committed result without cosign or a network with
`npm run aicr-signature:verify`.

NVIDIA AICR v0.18.0 ships a signed recipe catalog, and
that signature verifies here with the network disabled. The signer is the
tagged release workflow in NVIDIA/aicr
(`https://github.com/NVIDIA/aicr/.github/workflows/on-tag.yaml@refs/tags/v0.18.0`), identified through GitHub Actions OIDC at
`https://token.actions.githubusercontent.com`. The signed statement is an in-toto statement
carrying a `https://slsa.dev/provenance/v1` predicate over
1 subject
(`recipe-catalog`).

The verification runs gcr.io/projectsigstore/cosign:v2.6.1 inside a container with no
network, against the sigstore trust root committed beside the bundle. The
release's transparency-log entry is
`hashedrekord` version
`0.0.2` and carries no integrated time,
so trusted time comes from the 1 RFC 3161
signed timestamp in the bundle. The same command was then run against a
different signer identity and refused it, so the lane can fail.

## Limits

- This receipt verifies the signature over the release's recipe-catalog attestation. It does not verify the recipe catalog artifact itself, because the catalog is not a release asset and no copy is retained here; the attestation's subject digest is recorded so a future retained copy can be bound to it.
- Claim checking is disabled for the same reason, so this receipt proves who signed the statement and that the statement is intact, not that a local artifact matches it.
- The trust root is pinned as committed bytes. Refreshing it is a deliberate change, and it is the one input that ages.
- This receipt concerns the upstream v0.18.0 release. The catalog still retains v0.14.0, which shipped no signature at all.
