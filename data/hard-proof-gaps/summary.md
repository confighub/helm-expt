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
catalog-supported rows on shortlist: 3
rows with remote dependency work: 20
rows with hook route candidates: 8
~~~

## Main Gap Types

| Gap | Rows |
| --- | ---: |
| create-recipe-import-candidate | 13 |
| apiservice | 4 |
| dependency-range-policy | 4 |
| semver-compare | 4 |

## First Rows

| Rank | Chart | Main gap | Why it matters | First action |
| ---: | --- | --- | --- | --- |
| 1 | `k8s-dashboard/kubernetes-dashboard@7.14.0` | apiservice | APIService aggregation can pass render parity while failing at API aggregation or TLS/runtime readiness. | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 2 | `gitlab/gitlab@10.0.0` | create-recipe-import-candidate | source-only charts have no maintained recipe path, so catalog claims would be disconnected from proof artifacts. | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 3 | `datadog/datadog@3.214.0` | apiservice | APIService aggregation can pass render parity while failing at API aggregation or TLS/runtime readiness. | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 4 | `kong/kong@3.2.0` | create-recipe-import-candidate | source-only charts have no maintained recipe path, so catalog claims would be disconnected from proof artifacts. | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 5 | `bitnami/kafka@32.4.3` | create-recipe-import-candidate | source-only charts have no maintained recipe path, so catalog claims would be disconnected from proof artifacts. | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 6 | `bitnami/minio@17.0.21` | create-recipe-import-candidate | source-only charts have no maintained recipe path, so catalog claims would be disconnected from proof artifacts. | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 7 | `bitnami/thanos@17.3.1` | create-recipe-import-candidate | source-only charts have no maintained recipe path, so catalog claims would be disconnected from proof artifacts. | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 8 | `prometheus-community/kube-prometheus-stack@85.3.0` | semver-compare | version-conditional templates can change rendered objects under a different Kubernetes, chart, or dependency version. | promote version-conditional rendering into chart facts and variant-path coverage |
| 9 | `grafana/loki@7.0.0` | semver-compare | version-conditional templates can change rendered objects under a different Kubernetes, chart, or dependency version. | promote version-conditional rendering into chart facts and variant-path coverage |
| 10 | `apache-airflow/airflow@1.21.0` | create-recipe-import-candidate | source-only charts have no maintained recipe path, so catalog claims would be disconnected from proof artifacts. | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 11 | `kyverno/kyverno@3.8.1` | dependency-range-policy | non-exact dependency ranges can silently change the rendered dependency closure during refresh. | record dependency range policy and refresh-survival check for non-exact dependency constraints |
| 12 | `bitnami/keycloak@25.2.0` | create-recipe-import-candidate | source-only charts have no maintained recipe path, so catalog claims would be disconnected from proof artifacts. | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |

## Catalog Rows On The Shortlist

These rows are visible because they are already public catalog entries or have
strong proof surfaces. They should be kept honest first.

| Chart | Main gap | Next artifact |
| --- | --- | --- |
| `prometheus-community/kube-prometheus-stack@85.3.0` | semver-compare | chart facts axis plus capability/version matrix row |
| `grafana/loki@7.0.0` | semver-compare | chart facts axis plus capability/version matrix row |
| `metrics-server/metrics-server@3.13.0` | apiservice | chart facts axis plus lifecycle observation receipt |

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
