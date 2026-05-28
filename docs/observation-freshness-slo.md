# Observation Freshness SLO

ConfigHub is workerless in this proof model. It stores desired/config truth and
submitted observation receipts; it does not claim fresh live cluster truth
unless a current receipt says so.

## Receipt Contract

Every live observation receipt must record:

- `observer.name` and `observer.method`
- `target.kind`, `target.name`, and, where applicable, context and namespace
- `variantRevision`
- `renderedObjectSetSHA256`
- `observedAt`
- `freshnessTTL`
- `result`
- `checks`

## Status Rules

- `fresh`: `observedAt + freshnessTTL` is still in the future and `result` is
  `pass` or `warn`.
- `stale`: the freshness window has expired.
- `failed`: the receipt result is `fail` or `blocked`.
- `unknown`: the receipt exists but lacks enough timing, target, or check data
  to make a freshness claim.
- `not-observed`: no receipt exists for the target and variant revision.
- `drifted`: a current receipt says the live target differs from the approved
  rendered object set.

## Default SLO

For local kind proof runs, the default `freshnessTTL` is `1h`. For customer or
production demonstrations, the TTL should be chosen by the target owner and
shown next to the receipt. A stale receipt is still audit evidence; it is not a
fresh live-state claim.

## Why This Matters

This keeps the promise crisp: ConfigHub can show what was intended, rendered,
scanned, uploaded, applied, and observed. It only says a cluster is currently OK
when a fresh observation receipt says so.
