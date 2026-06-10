# Quirk Work Queue

This generated queue turns the source-vs-modeled quirk audit into chart-level
work items. It answers a different question from `data/quirk-review-queue/`:

~~~text
Which public top-100 charts should we improve first so source-scan quirks become
modeled, reviewable, and eventually provable?
~~~

The queue is not a support claim. It is a prioritized work list for closing
source-inventory gaps, model gaps, and proof gaps.

## Current Reading

~~~text
queued source top-100 charts: 95
P0: 51
P1: 12
P2: 32
~~~

## Highest Priority Rows

| Priority | Source rank | Chart | Top quirk | First action |
| --- | ---: | --- | --- | --- |
| P0 | 9 | `k8s-dashboard/kubernetes-dashboard@7.14.0` | `apiservice` | add an APIService readiness model and runtime observation route |
| P0 | 1 | `prometheus-community/kube-prometheus-stack@85.3.0` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 38 | `kyverno/kyverno@3.8.1` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 13 | `gitlab/gitlab@10.0.0` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 97 | `kong/kong@3.2.0` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 43 | `datadog/datadog@3.214.0` | `apiservice` | add an APIService readiness model and runtime observation route |
| P0 | 10 | `grafana/loki@7.0.0` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 23 | `bitnami/kafka@32.4.3` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 32 | `bitnami/minio@17.0.21` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 44 | `bitnami/thanos@17.3.1` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 15 | `bitnami/keycloak@25.2.0` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 84 | `airflow-helm/airflow@8.9.0` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 4 | `argo/argo-cd@9.5.15` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 26 | `apache-airflow/airflow@1.21.0` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |
| P0 | 29 | `nextcloud/nextcloud@9.1.0` | `remote-dependencies` | model remote dependency closure in chart facts and source/dependency lock evidence |

## Hook Route Candidates Connected

These rows have source-scan hook signals and a candidate route plan. Candidate
routes are not receipts and do not claim runtime behavior; they are the next
step before admitting a chart to the maintained hook lifecycle queue.

| Priority | Chart | Candidate route | Candidate artifact |
| --- | --- | --- | --- |
| P0 | `k8s-dashboard/kubernetes-dashboard@7.14.0` | upgrade-action-with-receipt (if rendered) | data/hook-route-candidates/summary.md |
| P0 | `gitlab/gitlab@10.0.0` | argocd-or-flux-lifecycle-hook | data/hook-route-candidates/summary.md |
| P0 | `kong/kong@3.2.0` | upgrade-action-with-receipt | data/hook-route-candidates/summary.md |
| P0 | `datadog/datadog@3.214.0` | target-class-preflight-and-upgrade-action | data/hook-route-candidates/summary.md |
| P0 | `bitnami/kafka@32.4.3` | explicit-managed-action | data/hook-route-candidates/summary.md |
| P0 | `bitnami/minio@17.0.21` | explicit-managed-action | data/hook-route-candidates/summary.md |
| P0 | `bitnami/thanos@17.3.1` | explicit-managed-action | data/hook-route-candidates/summary.md |
| P0 | `apache-airflow/airflow@1.21.0` | recipe-time-lifecycle-verification | data/hook-route-candidates/summary.md |

## Top Quirk Driving Each Row

| Top quirk | Rows |
| --- | ---: |
| `remote-dependencies` | 44 |
| `semver-compare` | 26 |
| `generated-facts` | 7 |
| `apiservice` | 5 |
| `capabilities` | 5 |
| `files-get` | 4 |
| `required-or-fail` | 2 |
| `hooks` | 1 |
| `stateful-storage` | 1 |

## Audit Gaps Feeding This Queue

| Quirk | Source top-100 | Modeled count | Risk note |
| --- | ---: | --- | --- |
| `hooks` | 11 | 5 | undercount: 11 source-top-100 hook charts vs 5 modeled; the delta is reviewed in data/hook-lifecycle-review/ |
| `hook delete policies` | 10 | 5 (queue rows only) | undercount: delete policies are only tracked for charts already in the hook queue |
| `hook weights` | 3 | 4 (queue rows only) | inconsistency: queue counts 4 weight-bearing charts but the source top-100 scan counts 3; membership and counting method differ and should be reconciled |
| `lookup` | 47 | 26 | undercount: top-20 rows carry no source_features tokens so modeled lookup coverage is systematically understated |
| `generated/random/time/cert functions` | 60 | 29 generated-facts + 23 generates-secrets | definitional drift: the scan counts all rand/time/cert/htpasswd functions; the modeled layer tracks generated facts and Secrets only |
| `capabilities` | 81 | 49 | overclaim risk: parity covers the rendered output under one pinned profile; it does not prove behavior under other Kubernetes versions |
| `tpl` | 88 | 55 | overclaim risk if read as tpl-semantics proof; parity proves the output of one values profile only |
| `raw/extra manifests` | 65 | 82 | definitional drift: chart-facts extension_slots is broader (tpl snippets and sidecars included) than the scan's extraManifestValues; the two numbers must not be compared directly |
| `cluster RBAC` | 58 | 41 | undercount: top-20 token gap again; RBAC-specific proof exists only where live lanes ran |
| `webhooks` | 21 | 13 | undercount: 21 source vs 13 modeled; webhook runtime proof exists for 2 charts and must not be generalized |
| `APIService` | 5 | not tracked | undercount: APIService aggregation (metrics-server class) is visible in the source scan but has no modeled or proof representation |
| `stateful storage` | 62 | 31 | undercount: top-20 token gap; storage proof is per-live-lane not per-quirk |

## Files

| File | Purpose |
| --- | --- |
| `top100-queue.csv` | One chart-level work item per affected public top-100 source row. |
| `data/hook-route-candidates/summary.md` | Candidate hook route plans referenced by queue rows where available. |
| `data/quirk-inventory-audit/top100-source-vs-modeled.csv` | Source vs modeled vs proof counts that feed this queue. |
| `data/top500-catalog-analysis/source/source-feature-scan.raw.json` | Source-scan input. |

Regenerate:

~~~sh
npm run quirk-work-queue
npm run quirk-work-queue:verify
~~~
