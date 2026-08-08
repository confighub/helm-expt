# The trust root the signature lane depends on

**UNOFFICIAL/EXPERIMENTAL.** Reviewed by `npm run aicr-trust-root:run`, which
is the only step that reaches the network, and checked offline by
`npm run aicr-trust-root:verify`. The review is recorded at
`runs/aicr-trust-root-review/receipt.yaml`.

[The signature lane](../../docs/reference/aicr-signature-verification.md)
verifies AICR's release signature with the network disabled, against a sigstore
trust root committed in this repository. That is what makes the check
reproducible years from now. It also makes the trust root the one input that
ages, because sigstore publishes updates and our copy is a snapshot.

## The cadence, and why it is drift rather than expiry

Review when a retained AICR version changes, when the signature lane changes, and otherwise whenever this lane is run. There is no expiry to count down to: every active entry in the trust root carries a start date and no end date.

Replacing the committed trust root is a reviewable change on its own, never a side effect of another one. The verify lane refuses a trust root that moved without a review recording it.

## What the committed trust root contains

Last reviewed **2026-08-08**, against https://raw.githubusercontent.com/sigstore/root-signing/main/targets/trusted_root.json.
At that review the committed copy was **byte-identical** to the published one, so nothing about it is a local variant.

| Kind | Subject | Valid from | Valid until |
| --- | --- | --- | --- |
| certificate authority | sigstore | 2022-04-13 | no end date |
| transparency log | https://rekor.sigstore.dev | 2021-01-12 | no end date |
| transparency log | https://log2025-1.rekor.sigstore.dev | 2025-09-23 | no end date |
| certificate transparency log | https://ctfe.sigstore.dev/2022 | 2022-10-20 | no end date |
| timestamp authority | sigstore-tsa-selfsigned | 2025-07-04 | no end date |

## What it keeps for old signatures

These entries ended, and they are retained so signatures made while they were
valid still verify. A trust root that dropped them would quietly break the
verification of anything older.

| Kind | Subject | Valid from | Valid until |
| --- | --- | --- | --- |
| certificate authority | sigstore | 2021-03-07 | 2022-12-31 |
| certificate transparency log | https://ctfe.sigstore.dev/test | 2021-03-14 | 2022-10-31 |

## The gate

`npm run aicr-trust-root:verify` refuses when the committed trust root has
changed since the review that recorded it. Swapping trust material is exactly
the change that should never happen quietly, and the lane makes it a reviewable
step rather than a diff someone might scroll past.

It does not check the trust root against the network. That would put a network
dependency back into the ordinary verify chain, which is the thing the
committed copy exists to remove.

Everything in the verify path runs offline against committed bytes. No cluster,
no organization, and no GPU workload takes part.
