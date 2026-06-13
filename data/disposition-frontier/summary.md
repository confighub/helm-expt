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
lane cells:                 1146
recorded disposition:       775  (67.6%)
+ derived blocked:          145
= verified disposition:     920  (80.3%)
genuine todo (named next):  226
un-dispositioned gap:       0
```

**Distance to 99%:** 226 cells are not yet a
non-todo verified disposition (19.7% of cells).
Every one carries a named next action below — none is a silent gap.

## By lane

| Lane | Cells | Verified disposition | Genuine todo | Un-dispositioned |
| --- | ---: | ---: | ---: | ---: |
| R render_parity | 191 | 191 | 0 | 0 |
| C in_confighub | 191 | 155 | 36 | 0 |
| L local_live | 191 | 191 | 0 | 0 |
| G gitops_oci_live | 191 | 134 | 57 | 0 |
| P live_helm_vs_confighub_parity | 191 | 134 | 57 | 0 |
| K two_cluster_kind_parity | 191 | 115 | 76 | 0 |

## The work to 99%, by next action

Each genuine `todo` cell, grouped by what closes it.

| Cells | Next action |
| --- | --- |
| 76 | run the two-cluster kind parity lane |
| 57 | run the ConfigHub OCI/Argo live lane |
| 57 | run scripts/run-top20-live-parity.mjs for this row |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/apache@11.4.29 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/contour@21.1.4 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/contour@21.1.4 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/elasticsearch@22.1.6 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/elasticsearch@22.1.6 ha (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/memcached@8.5.5 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/mongodb@19.0.9 existing-secret-replicaset (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/mongodb@19.0.9 generated-passwords (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/mongodb@19.1.0 existing-secret-replicaset (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/mongodb@19.1.0 generated-passwords (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/nginx@24.0.4 existing-tls-ingress (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/nginx@24.0.4 http-clusterip (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/nginx@25.0.0 existing-tls-ingress (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/nginx@25.0.0 http-clusterip (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/opensearch@2.0.10 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/phpmyadmin@20.0.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/postgresql@18.6.10 existing-secret (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/postgresql@18.6.10 generated-passwords (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/postgresql@18.7.0 existing-secret (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/postgresql@18.7.0 generated-passwords (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/redis@27.0.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/redis@27.0.0 reuse-existing-secret (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/spark@10.0.3 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/spark@10.0.3 ha (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/zookeeper@13.8.7 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for bitnami/zookeeper@13.8.7 ha (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for elastic/filebeat@8.5.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for elastic/kibana@8.5.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for elastic/metricbeat@8.5.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@86.1.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@86.1.0 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/prometheus-adapter@5.3.0 cluster-metrics-readonly (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/prometheus-operator-crds@29.0.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/prometheus-pushgateway@3.6.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/prometheus@29.9.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/prometheus@29.9.0 server-only-ephemeral (loop's bitnami/prometheus-community/elastic candidate pipeline) |

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
