# Catalog Promotion Review

Catalog promotion is the repeatable review that decides whether a proof-grade
recipe is good enough to recommend to Helm users.

It is both:

- a machine-verifiable harness;
- a product/readability review.

The core question is:

```text
Is this the best, simplest, safest way for a Helm user to install and vary this
chart through ConfigHub?
```

## Required Machine Checks

Every promoted catalog variant must pass:

- source lock and dependency lock verification;
- deterministic regular Helm render under the declared capability profile;
- `cub install package` deterministic bundle verification;
- `cub install setup` semantic equivalence against regular Helm output;
- rendered object inventory verification;
- digest-bound VariantRevision verification;
- render receipt verification;
- Helm-equivalence receipt verification;
- scan receipt verification;
- install-gate verification;
- self-test that rejects rendered object tampering.

For the current repo:

```sh
npm run verify
npm run next80:verify
npm run next80:verify:packages
```

## Required Product Checks

Promotion also needs a human-readable answer to each question:

| Question | Pass Standard |
| --- | --- |
| Is the default variant what a normal Helm user expects? | It preserves familiar chart behavior or clearly explains a safer default. |
| Are obvious variants present? | Common choices are covered: existing Secret, HA, ingress/TLS, storage, CRDs, RBAC, cloud/provider knobs. |
| Are risks visible? | CRDs, hooks, generated facts, lookup, RBAC, webhooks, PVCs, and raw/template slots are documented. |
| Is the UX simpler than Helm? | A user can install, review, and understand the result without learning the full artifact model. |
| Are differences explained? | Any difference from regular Helm output is classified and allowed. |
| Is production status honest? | Warnings, blockers, and observation requirements are visible. |

## Promotion States

```text
proof-grade
catalog-candidate
catalog-supported
deprecated
blocked
```

`proof-grade` means the mechanics work. `catalog-supported` means we recommend
the recipe and its supported variants to Helm users.

## Promotion Decision

A chart can be promoted to catalog-supported only when:

- at least one variant is useful as a real install path;
- obvious high-demand variants are either implemented or explicitly deferred;
- the README for the chart is shorter and clearer than the equivalent Helm
  troubleshooting path;
- all proof receipts pass;
- scan/gate status is acceptable for the intended scope;
- upgrade behavior is understood for the current chart version.

## Re-Review Triggers

Run catalog promotion review again when:

- the upstream chart version changes;
- a dependency version changes;
- Kubernetes capability profile changes;
- a scan policy changes;
- a user requests a new supported variant;
- a chart introduces CRDs, hooks, webhooks, generated facts, lookup, or raw
  extension slots;
- ConfigHub installer behavior changes.

## Current Repo Interpretation

The top 20 are proof-grade and some are catalog-candidate. Redis is closest to
catalog-supported.

The next 80 are full equivalence proofs for default variants. They are not
automatically catalog-supported because most do not yet have user-shaped
variant choices.
