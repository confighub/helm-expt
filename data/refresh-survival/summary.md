# Refresh Survival

This generated report shows whether the catalog survives upstream Helm chart
movement without silently changing what users install.

It is not a live upgrade proof. It is the refresh control surface that says
which chart versions remain current, which upstream charts moved, and which
candidate versions have only passed the recipe/package/render/compare lane so
far.

## Result

```text
Top-20 rows checked: 20
Current chart proofs: 14 / 20
Upstream update candidates: 6 / 20
Candidates with render proof: 6 / 6
Candidates not yet promoted: 6 / 6
```

## Update Candidates

| Chart | Current proof | Latest candidate | Candidate proof | Promotion state | Next action |
| --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | candidate-render-proof-present | ready-for-full-lane-promotion | run ConfigHub proof, live e2e, production disposition, catalog, top100, and top500 lanes before replacement |
| `bitnami/mongodb` | `19.0.7` | `19.0.9` | candidate-render-proof-present | ready-for-full-lane-promotion | run ConfigHub proof, live e2e, production disposition, catalog, top100, and top500 lanes before replacement |
| `bitnami/nginx` | `24.0.2` | `24.0.4` | candidate-render-proof-present | ready-for-full-lane-promotion | run ConfigHub proof, live e2e, production disposition, catalog, top100, and top500 lanes before replacement |
| `bitnami/postgresql` | `18.6.7` | `18.6.10` | candidate-render-proof-present | ready-for-full-lane-promotion | run ConfigHub proof, live e2e, production disposition, catalog, top100, and top500 lanes before replacement |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | candidate-render-proof-present | ready-for-full-lane-promotion | run ConfigHub proof, live e2e, production disposition, catalog, top100, and top500 lanes before replacement |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | candidate-render-proof-present | ready-for-full-lane-promotion | run ConfigHub proof, live e2e, production disposition, catalog, top100, and top500 lanes before replacement |

## What This Proves

- Supported catalog rows do not roll forward just because upstream Helm changed.
- New upstream versions can be tested as candidate artifacts while the previous
  supported version remains pinned.
- Candidate render proof is only the first lane. Support still needs ConfigHub
  proof, live e2e, production disposition, catalog regeneration, and top100/top500
  regeneration.

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
