# Disposition Frontier — distance to the 99% bar

The [next-execution-plan](../../docs/planning/next-execution-plan.md) defines
the 99% target as **every top-100 chart/base/lane cell carrying a verified
disposition** — pass, watch, blocked, refused, or n/a — with `todo` allowed
only as a temporary state that names a next action. "Every cell green" is
explicitly NOT the goal; a correct `blocked` or `n/a` is part of the
product because it tells a user where the proof stops.

This view scores that bar at the cell granularity the master matrix shows,
and for every bare `missing` cell **derives** the honest disposition by
rule (a live lane whose single-cluster local-live row is blocked inherits
the same named prerequisite — it is blocked, not un-dispositioned). It
proposes; it does not mutate `base-outcomes`. Nearest views:
[master-catalog-matrix](../master-catalog-matrix/summary.md) (the cells),
[top100-coverage](../top100-coverage/summary.md) (chart-level coverage).

## Headline

```text
lane cells:                 1194
recorded disposition:       1170  (98.0%)
+ derived blocked:          4
+ derived n/a (K covered):  19
= verified disposition:     1193  (99.9%)
genuine todo (named next):  1
un-dispositioned gap:       0
```

**Distance to 99%:** 1 cells are not yet a
non-todo verified disposition (0.1% of cells).
Every one carries a named next action below — none is a silent gap.

## By lane

| Lane | Cells | Verified disposition | Genuine todo | Un-dispositioned |
| --- | ---: | ---: | ---: | ---: |
| R render_parity | 199 | 199 | 0 | 0 |
| C in_confighub | 199 | 198 | 1 | 0 |
| L local_live | 199 | 199 | 0 | 0 |
| G gitops_oci_live | 199 | 199 | 0 | 0 |
| P live_helm_vs_confighub_parity | 199 | 199 | 0 | 0 |
| K two_cluster_kind_parity | 199 | 199 | 0 | 0 |

## The work to 99%, by next action

Each genuine `todo` cell, grouped by what closes it.

| Cells | Next action |
| --- | --- |
| 1 | run scripts/run-top20-confighub-proof.mjs for argo-cd/argo-cd@9.5.17 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |

## Rules (so the derivation is auditable)

- A recorded `pass`/`watch`/`blocked`/`fail`/`refused`/`n-a` is already a verified disposition.
- A recorded two-cluster K receipt in `data/live-kind-parity/summary.csv` overrides the older aggregate `base-outcomes` K cell.
- The two-cluster **K** lane is **variant-keyed**: `scripts/run-kind-parity.mjs` writes one receipt per chart-variant (`runs/live-kind-parity/<chart>-<base>/`, **no version in the slug**), so only the version that last ran holds the receipt. A bare `missing` K cell whose chart-variant **is** proven on another shipped version is therefore **not** a runnable gap — it is **n/a, covered by that version** (re-running it would overwrite the sibling receipt: net-negative). If every receipt for the variant is itself `blocked`/`fail` (no version has a passing K proof), the cell **inherits blocked** rather than n/a, so a blocked variant is never laundered into a clean n/a. Only a chart-variant with **no** K receipt on any version stays a genuine K `todo`.
- A live lane (G/P/K) on a row whose `local_live` is **blocked** -> derived **blocked**, same named prerequisite (you cannot make a multi-cluster or GitOps live claim when one cluster will not converge).
- A live lane on a row whose `local_live` **failed** -> derived **blocked** on the upstream failure.
- A live lane on a row whose `local_live` **passes** -> genuine **todo**, runnable now, with the lane's run command as the next action.
- `in_confighub` missing -> **todo**, owner loop (the bitnami/prometheus-community/elastic candidate pipeline).

## Regenerate

~~~sh
npm run disposition-frontier
npm run disposition-frontier:verify
~~~
