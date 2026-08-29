# Do these version and digest records identify the same bytes?

A reviewer asks about goldilocks 10.3.0. The assistant compares the
digest the recipe locked against the digest the publisher later served for the same
version string; the gate checks that against the committed upstream-drift record.

## The answer: no, the version string was reused for different bytes

- The recipe locks `9498a6f49cdea77f...`.
- The publisher later served `3e51ce8032b0217d...` for the
  same version.
- The digests differ, so the same version string now names different bytes.

A version string is supposed to name one artifact. Here it does not, so the digest,
not the version, is what identifies the bytes. The recipe's decision is
`retained-exact`, which keeps the reviewed original bytes by pinning the retained
digest rather than following the republish.

## The gate

- The retained digest matches the record.
- The republished digest matches the record.
- The same-bytes verdict matches whether the two digests are equal.
- The decision matches the record.

The self-test mutates the answer two ways, calling the two digests the same bytes and
changing the retained digest, and confirms the gate rejects each. So the answer is the
assistant, and the drift record is the authority.

## The limit

This reads a committed record of digests already fetched and hashed. It does not fetch
the artifact live; the retained digest and the recorded republish are the evidence.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The drift facts the gate derived](./drift-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-supply-drift.yaml)
- [The upstream-drift record](../upstream-drift/summary.md)

Run:

```bash
npm run ai-supply-drift:verify
npm run ai-supply-drift:self-test
```
