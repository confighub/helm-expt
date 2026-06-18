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
recorded disposition:       1146  (96.0%)
+ derived blocked:          4
= verified disposition:     1150  (96.3%)
genuine todo (named next):  44
un-dispositioned gap:       0
```

**Distance to 99%:** 44 cells are not yet a
non-todo verified disposition (3.7% of cells).
Every one carries a named next action below — none is a silent gap.

## By lane

| Lane | Cells | Verified disposition | Genuine todo | Un-dispositioned |
| --- | ---: | ---: | ---: | ---: |
| R render_parity | 199 | 199 | 0 | 0 |
| C in_confighub | 199 | 192 | 7 | 0 |
| L local_live | 199 | 199 | 0 | 0 |
| G gitops_oci_live | 199 | 193 | 6 | 0 |
| P live_helm_vs_confighub_parity | 199 | 193 | 6 | 0 |
| K two_cluster_kind_parity | 199 | 174 | 25 | 0 |

## The work to 99%, by next action

Each genuine `todo` cell, grouped by what closes it.

| Cells | Next action |
| --- | --- |
| 25 | run the two-cluster kind parity lane |
| 6 | run the ConfigHub OCI/Argo live lane |
| 6 | run scripts/run-top20-live-parity.mjs for this row |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/apache@11.4.29 legacy (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/contour@21.1.4 legacy (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/elasticsearch@22.1.6 legacy (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/opensearch@2.0.10 legacy (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/phpmyadmin@20.0.0 legacy (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/spark@10.0.3 legacy (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/zookeeper@13.8.7 legacy (loop's bitnami/prometheus-community/elastic candidate pipeline) |

## Rules (so the derivation is auditable)

- A recorded `pass`/`watch`/`blocked`/`fail`/`refused`/`n-a` is already a verified disposition.
- A recorded two-cluster K receipt in `data/live-kind-parity/summary.csv` overrides the older aggregate `base-outcomes` K cell.
- A live lane (G/P/K) on a row whose `local_live` is **blocked** -> derived **blocked**, same named prerequisite (you cannot make a multi-cluster or GitOps live claim when one cluster will not converge).
- A live lane on a row whose `local_live` **failed** -> derived **blocked** on the upstream failure.
- A live lane on a row whose `local_live` **passes** -> genuine **todo**, runnable now, with the lane's run command as the next action.
- `in_confighub` missing -> **todo**, owner loop (the bitnami/prometheus-community/elastic candidate pipeline).

## Regenerate

~~~sh
npm run disposition-frontier
npm run disposition-frontier:verify
~~~
