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
- payload digest or check evidence digest
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

## Minimum Redis Live Proof

The Redis proof is the minimum live observation shape for this repo:

- receipt path:
  `runs/redis-local-kind/latest/observation-receipt.yaml`
- target: local kind cluster `helm-expt-redis`, namespace `redis`
- rendered digest:
  `362dbc4854421a23ea48da4ee7e72dbc98422fa9affc26ac372c761d4b90e10d`
- required checks: namespace support object applied, both Redis StatefulSets
  rolled out, Redis `PING` returned `PONG`, and four PVCs were bound

Other chart live receipts may use chart-specific checks, but they must keep the
same freshness contract: observer, target, rendered digest, timestamp, TTL,
result, and check list.

## Why This Matters

This keeps the promise crisp: ConfigHub can show what was intended, rendered,
scanned, uploaded, applied, and observed. It only says a cluster is currently OK
when a fresh observation receipt says so.
