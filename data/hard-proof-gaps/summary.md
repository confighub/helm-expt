# Hard Proof Gaps Shortlist

This generated shortlist joins the P0 source-quirk queue with remote dependency
closure and hook route candidate data. It is the short assignment surface for
the top-100 rows most likely to damage trust if the project overclaims them.

It does not say these charts are unsupported. It says the named gap must be
modeled, routed, observed, or explicitly refused before stronger catalog or
production claims are made.

## Summary

~~~text
shortlist rows: 25
catalog-supported rows on shortlist: 8
rows with remote dependency work: 24
rows with hook route candidates: 8
~~~

## Main Gap Types

| Gap | Rows |
| --- | ---: |
| remote-dependencies | 22 |
| apiservice | 2 |
| semver-compare | 1 |

## First Rows

| Rank | Chart | Main gap | Why it matters | First action |
| ---: | --- | --- | --- | --- |
| 1 | `k8s-dashboard/kubernetes-dashboard@7.14.0` | apiservice | APIService aggregation can pass render parity while failing at API aggregation or TLS/runtime readiness. | add an APIService readiness model and runtime observation route |
| 2 | `prometheus-community/kube-prometheus-stack@85.3.0` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |
| 3 | `gitlab/gitlab@10.0.0` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |
| 4 | `grafana/loki@7.0.0` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |
| 5 | `datadog/datadog@3.214.0` | apiservice | APIService aggregation can pass render parity while failing at API aggregation or TLS/runtime readiness. | add an APIService readiness model and runtime observation route |
| 6 | `kyverno/kyverno@3.8.1` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |
| 7 | `kong/kong@3.2.0` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |
| 8 | `bitnami/kafka@32.4.3` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |
| 9 | `bitnami/minio@17.0.21` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |
| 10 | `bitnami/thanos@17.3.1` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |
| 11 | `apache-airflow/airflow@1.21.0` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |
| 12 | `bitnami/rabbitmq@16.0.14` | remote-dependencies | remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart. | model remote dependency closure in chart facts and source/dependency lock evidence |

## Catalog Rows On The Shortlist

These rows are visible because they are already public catalog entries or have
strong proof surfaces. They should be kept honest first.

| Chart | Main gap | Next artifact |
| --- | --- | --- |
| `prometheus-community/kube-prometheus-stack@85.3.0` | remote-dependencies | dependency closure facts plus refresh-survival check |
| `grafana/loki@7.0.0` | remote-dependencies | dependency closure facts plus refresh-survival check |
| `bitnami/rabbitmq@16.0.14` | remote-dependencies | dependency closure facts plus refresh-survival check |
| `bitnami/mysql@14.0.3` | remote-dependencies | dependency closure facts plus refresh-survival check |
| `prometheus-community/prometheus@29.8.0` | remote-dependencies | dependency closure facts plus refresh-survival check |
| `bitnami/redis@25.5.3` | remote-dependencies | dependency closure facts plus refresh-survival check |
| `bitnami/postgresql@18.6.7` | remote-dependencies | dependency closure facts plus refresh-survival check |
| `bitnami/mongodb@19.0.3` | remote-dependencies | dependency closure facts plus refresh-survival check |

## How To Use This

1. Pick a row from the top of the table.
2. Open the source evidence and required artifact.
3. Decide whether the gap becomes a modeled fact, a route receipt, a runtime
   observation, a better base variant, or an explicit blocker.
4. Regenerate the owning queue before changing any support or catalog claim.

## Source Tables

| Source | Use |
| --- | --- |
| [quirk-work-queue/top100-queue.csv](../quirk-work-queue/top100-queue.csv) | P0 source-quirk queue and first action. |
| [remote-dependency-closure/top100.csv](../remote-dependency-closure/top100.csv) | Dependency closure and refresh-survival workstreams. |
| [hook-route-candidates/candidates.csv](../hook-route-candidates/candidates.csv) | Candidate routes for hook-bearing source charts not yet in the maintained queue. |
| [top100-coverage/work-queue.csv](../top100-coverage/work-queue.csv) | Current top-100 promotion, variant, and limitation queues. |
