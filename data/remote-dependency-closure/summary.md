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
non-exact dependency rows frozen to Chart.lock:                  4/49
frozen range rows with refresh-survival evidence:                4/4
P0 source rows:                                                  33
active P0 work rows:                                             25
keep-current rows:                                               8
P1 source rows:                                                  14
P2 source rows:                                                  2
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
| `chart-lock-digest` | 11 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived | dependency lock records a Chart.lock digest or explains the source of the locked dependency list |
| `keep-current` | 8 | keep dependency lock evidence current with the supported recipe version | dependency evidence is still current for the supported recipe version |

## Highest Priority Active Work Rows

| Source rank | Chart | Workstream | Lock status | Locked dependencies | Next action |
| ---: | --- | --- | --- | ---: | --- |
| 6 | `bitnami/redis@25.5.3` | `chart-lock-digest` | `source-version-lock-present` | 1 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived |
| 7 | `bitnami/postgresql@18.6.7` | `chart-lock-digest` | `source-version-lock-present` | 1 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived |
| 9 | `k8s-dashboard/kubernetes-dashboard@7.14.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 13 | `gitlab/gitlab@10.0.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 15 | `bitnami/keycloak@25.2.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 23 | `bitnami/kafka@32.4.3` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 25 | `bitnami/external-dns@9.0.3` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 26 | `apache-airflow/airflow@1.21.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 28 | `bitnami/mongodb@19.0.3` | `chart-lock-digest` | `modeled-version-lock-present` | 1 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived |
| 29 | `nextcloud/nextcloud@9.1.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 32 | `bitnami/minio@17.0.21` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 34 | `metallb/metallb@0.16.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 38 | `kyverno/kyverno@3.8.1` | `chart-lock-digest` | `source-version-lock-present` | 5 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived |
| 39 | `gitea/gitea@12.6.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 40 | `sonarqube/sonarqube@2026.3.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 41 | `cloudnative-pg/cloudnative-pg@0.28.2` | `chart-lock-digest` | `source-version-lock-present` | 1 | record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived |
| 43 | `datadog/datadog@3.214.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 44 | `bitnami/thanos@17.3.1` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 46 | `oauth2-proxy/oauth2-proxy@10.6.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |
| 47 | `bitnami/wordpress@31.0.0` | `create-recipe-import-candidate` | `source-only-no-maintained-recipe` | 0 | create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer |

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
- If `dependency_range_policy` is `freeze-to-chart-lock`, the maintained
  path does not resolve dependency ranges during install. It uses the committed
  dependency lock, and any re-resolution must happen through a refresh candidate
  with its own proof.
- If `refresh_survival_status` is present, the row is connected to the
  top-20 refresh-survival surface. That is update-review evidence, not a live
  upgrade proof.

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
