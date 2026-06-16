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
lane cells:                 1152
recorded disposition:       1056  (91.7%)
+ derived blocked:          68
= verified disposition:     1124  (97.6%)
genuine todo (named next):  28
un-dispositioned gap:       0
```

**Distance to 99%:** 28 cells are not yet a
non-todo verified disposition (2.4% of cells).
Every one carries a named next action below — none is a silent gap.

## By lane

| Lane | Cells | Verified disposition | Genuine todo | Un-dispositioned |
| --- | ---: | ---: | ---: | ---: |
| R render_parity | 192 | 192 | 0 | 0 |
| C in_confighub | 192 | 192 | 0 | 0 |
| L local_live | 192 | 192 | 0 | 0 |
| G gitops_oci_live | 192 | 192 | 0 | 0 |
| P live_helm_vs_confighub_parity | 192 | 192 | 0 | 0 |
| K two_cluster_kind_parity | 192 | 164 | 28 | 0 |

## The work to 99%, by next action

Each genuine `todo` cell, grouped by what closes it.

| Cells | Next action |
| --- | --- |
| 28 | run the two-cluster kind parity lane |

## Rules (so the derivation is auditable)

- A recorded `pass`/`watch`/`blocked`/`fail`/`refused`/`n-a` is already a verified disposition.
- A live lane (G/P/K) on a row whose `local_live` is **blocked** -> derived **blocked**, same named prerequisite (you cannot make a multi-cluster or GitOps live claim when one cluster will not converge).
- A live lane on a row whose `local_live` **failed** -> derived **blocked** on the upstream failure.
- A live lane on a row whose `local_live` **passes** -> genuine **todo**, runnable now, with the lane's run command as the next action.
- `in_confighub` missing -> **todo**, owner loop (the bitnami/prometheus-community/elastic candidate pipeline).

## Regenerate

~~~sh
npm run disposition-frontier
npm run disposition-frontier:verify
~~~
