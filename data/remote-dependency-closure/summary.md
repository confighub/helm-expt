# Remote Dependency Closure

This generated report joins public top-100 source-scan dependency risk to the
dependency locks in maintained recipe artifacts.

It answers:

~~~text
Which popular charts depend on remote or vendored subcharts, and what exact
dependency closure evidence do we already have?
~~~

This is not a live dependency resolver and not a support claim. It uses the
committed source scan, maintained recipe metadata, and dependency-lock.yaml
files.

## Current Reading

~~~text
source top-100 rows with remote, vendored, or non-exact dependencies: 49
rows with a maintained dependency lock:                         19/49
source-only rows without a maintained recipe:                   30/49
locked rows with dependencies but no Chart.lock digest:          11/49
P0:                                                             33
P1:                                                             14
P2:                                                             2
~~~

## Closure Status

| Status | Rows | Meaning |
| --- | ---: | --- |
| `source-only-no-maintained-recipe` | 30 | The source chart is not currently represented by a maintained recipe row. |
| `source-version-lock-present` | 15 | A maintained dependency lock matches the source-scan chart version. |
| `modeled-version-lock-present` | 4 | A maintained dependency lock exists for the modeled/catalog version; source scan and model may differ. |

## Workstreams

| Workstream | Rows | First action | Done when |
| --- | ---: | --- | --- |
| `create-recipe-import-candidate` | 30 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer | recipe candidate exists with source lock, dependency lock, first base variant, render parity, and an explicit catalog decision |
| `dependency-range-policy` | 9 | record dependency range policy and refresh-survival check for non-exact dependency constraints | non-exact dependency constraints have a recorded policy plus refresh-survival evidence for the supported version |
| `chart-lock-digest` | 6 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived | dependency lock records a Chart.lock digest or explains the source of the locked dependency list |
| `promote-closure-facts` | 4 | promote dependency closure facts into chart facts and keep refresh-survival evidence current | chart facts and status surfaces expose dependency closure, remote repositories, and refresh-survival expectation |

## Highest Priority Rows

| Source rank | Chart | Lock status | Locked dependencies | Next action |
| ---: | --- | --- | ---: | --- |
| 1 | `prometheus-community/kube-prometheus-stack@85.3.0` | `modeled-version-lock-present` | 5 | record dependency range policy and refresh-survival check for non-exact dependency constraints |
| 4 | `argo/argo-cd@9.5.15` | `source-version-lock-present` | 1 | promote dependency closure facts into chart facts and keep refresh-survival evidence current |
| 5 | `prometheus-community/prometheus@29.8.0` | `source-version-lock-present` | 4 | record dependency range policy and refresh-survival check for non-exact dependency constraints |
| 6 | `bitnami/redis@25.5.3` | `source-version-lock-present` | 1 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived |
| 7 | `bitnami/postgresql@18.6.7` | `source-version-lock-present` | 1 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived |
| 9 | `k8s-dashboard/kubernetes-dashboard@7.14.0` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 10 | `grafana/loki@7.0.0` | `source-version-lock-present` | 3 | promote dependency closure facts into chart facts and keep refresh-survival evidence current |
| 13 | `gitlab/gitlab@10.0.0` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 15 | `bitnami/keycloak@25.2.0` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 17 | `external-secrets-operator/external-secrets@2.5.0` | `source-version-lock-present` | 1 | promote dependency closure facts into chart facts and keep refresh-survival evidence current |
| 20 | `bitnami/rabbitmq@16.0.14` | `source-version-lock-present` | 1 | record dependency range policy and refresh-survival check for non-exact dependency constraints |
| 23 | `bitnami/kafka@32.4.3` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 24 | `bitnami/mysql@14.0.3` | `source-version-lock-present` | 1 | record dependency range policy and refresh-survival check for non-exact dependency constraints |
| 25 | `bitnami/external-dns@9.0.3` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 26 | `apache-airflow/airflow@1.21.0` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 28 | `bitnami/mongodb@19.0.3` | `modeled-version-lock-present` | 1 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived |
| 29 | `nextcloud/nextcloud@9.1.0` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 32 | `bitnami/minio@17.0.21` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 34 | `metallb/metallb@0.16.0` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 38 | `kyverno/kyverno@3.8.1` | `source-version-lock-present` | 5 | record dependency range policy and refresh-survival check for non-exact dependency constraints |

## Most Common Locked Repositories

| Repository | Locked rows |
| --- | ---: |
| `oci://registry-1.docker.io/bitnamicharts` | 7 |
| `https://dandydeveloper.github.io/charts/` | 2 |
| `https://prometheus-community.github.io/helm-charts` | 2 |
| `https://charts.bitnami.com/bitnami` | 1 |
| `https://charts.min.io/` | 1 |
| `https://cloudnative-pg.github.io/grafana-dashboards` | 1 |
| `https://falcosecurity.github.io/charts` | 1 |
| `https://grafana-community.github.io/helm-charts` | 1 |
| `https://grafana.github.io/helm-charts` | 1 |
| `https://kyverno.github.io/api` | 1 |
| `https://kyverno.github.io/reports-server/` | 1 |
| `https://openreports.github.io/reports-api` | 1 |

## How To Use This

- If the row has `source-version-lock-present`, the maintained recipe has a
  dependency lock for the same chart version seen in the source scan.
- If the row has `modeled-version-lock-present`, the maintained recipe has a
  lock for the catalog version, but the source scan and model version differ.
  Use refresh-survival evidence before replacing or promoting the chart.
- If `join_status` is `chart-name-version-alias`, the source repository and
  maintained recipe repository differ, but the chart name and version match.
  Keep that alias visible when presenting catalog coverage.
- If the row is `source-only-no-maintained-recipe`, create a recipe/import
  candidate before making catalog claims.
- If dependencies are locked but no `chartLockDigest` is present, decide
  whether to backfill a Chart.lock digest or explicitly document the source of
  the dependency list.

## Files

| File | Purpose |
| --- | --- |
| `top100.csv` | One row per top-100 source chart with remote, vendored, or non-exact dependency risk. |
| `recipes/*/*/*/dependency-lock.yaml` | Maintained recipe dependency locks joined into this report. |
| `data/quirk-work-queue/top100-queue.csv` | Source quirk priority used to rank dependency work. |
| `data/top500-catalog-analysis/source/source-feature-scan.raw.json` | Source-scan input. |

Regenerate:

~~~sh
npm run remote-deps:closure
npm run remote-deps:closure:verify
~~~
