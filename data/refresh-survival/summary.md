# Refresh Survival

This generated report shows whether the catalog survives upstream Helm chart
movement without silently changing what users install.

It is not a live upgrade proof. It is the refresh control surface that says
which chart versions remain current, which upstream charts moved, which
candidate versions have proof-complete root paths, and which decisions still
stand between a candidate and catalog replacement.

## Result

```text
Top-20 rows checked: 20
Current chart proofs: 13 / 20
Upstream update candidates: 7 / 20
Candidates with render-only proof: 1 / 7
Candidates with proof-complete root paths: 3 / 7
Retained candidates superseded by newer upstream versions: 3 / 7
Candidates without root paths: 1 / 7
```

## Update Candidates

| Chart | Current proof | Latest candidate | Candidate proof | Promotion state | Next action |
| --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | candidate-proof-complete-root-path-present | root-path-promoted-review-required | review target-scoped production support decision before replacing the supported version |
| `bitnami/mongodb` | `19.0.7` | `19.1.0` | candidate-superseded-by-newer-upstream | root-path-promoted-review-required | refresh retained candidate 19.0.9 to latest upstream 19.1.0 before replacement decision |
| `bitnami/nginx` | `24.0.2` | `25.0.0` | candidate-superseded-by-newer-upstream | root-path-promoted-review-required | refresh retained candidate 24.0.4 to latest upstream 25.0.0 before replacement decision |
| `bitnami/postgresql` | `18.6.7` | `18.7.0` | candidate-superseded-by-newer-upstream | root-path-promoted-review-required | refresh retained candidate 18.6.10 to latest upstream 18.7.0 before replacement decision |
| `bitnami/redis` | `25.5.3` | `27.0.0` | candidate-render-proof-present | ready-for-root-path-promotion | run ConfigHub proof, live e2e, production disposition, catalog, top100, and top500 lanes before replacement |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | candidate-proof-complete-root-path-present | root-path-promoted-review-required | review target-scoped production support decision before replacing the supported version |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | candidate-proof-complete-root-path-present | root-path-promoted-review-required | review target-scoped production support decision before replacing the supported version |

## What This Proves

- Supported catalog rows do not roll forward just because upstream Helm changed.
- New upstream versions can be retained as candidate root paths while the
  previous supported version remains pinned.
- Proof-complete root paths make candidates visible for review. They do not
  replace the supported catalog version without an explicit target-scoped
  support decision.

## What This Does Not Prove

- It does not prove a live upgrade from the old version to the new version.
- It does not prove the candidate should replace the supported version.
- It does not prove production support for any target profile.

## Files

| File | Role |
| --- | --- |
| [refreshes.csv](./refreshes.csv) | One row per top-20 chart in the latest refresh review. |
| [kube-prometheus-stack-upgrade-seed.md](./kube-prometheus-stack-upgrade-seed.md) | Narrow upgrade-story seed for the serious Helm chart in the current update wave. |
| [../latest-top20-refresh/summary.md](../latest-top20-refresh/summary.md) | Latest top-20 refresh snapshot. |
| [../latest-top20-refresh/promotion-readiness.md](../latest-top20-refresh/promotion-readiness.md) | Candidate promotion readiness. |

## Verify

```sh
npm run refresh:survival:verify
```
