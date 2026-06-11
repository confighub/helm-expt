# APIService Proof Work Orders

This generated queue turns the APIService coverage report into assignable
proof work. APIService rows are high value because a rendered object can match
regular Helm while Kubernetes API aggregation still fails after apply.

## Work Queue

| Priority | Chart | Version | Current state | Work type | First task | Done when |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `kedacore/keda` | 2.19.0 | `two-cluster-api-aggregation-observed` | `promotion-scope-decision` | review the new two-cluster API aggregation receipt and decide whether KEDA enters a catalog promotion wave | KEDA has either a promotion work order with runtime/GitOps scope or a named reason to stay proof-grade |
| 2 | `k8s-dashboard/kubernetes-dashboard` | 7.14.0 | `source-detected-needs-recipe` | `recipe-import-plus-runtime-proof` | create the recipe/import candidate, then add APIService readiness and runtime aggregation checks | the chart has a maintained recipe row plus a pass/watch/refused aggregation receipt |
| 3 | `datadog/datadog` | 3.214.0 | `source-detected-needs-recipe` | `recipe-import-plus-runtime-proof` | create the recipe/import candidate, then add APIService readiness and runtime aggregation checks | the chart has a maintained recipe row plus a pass/watch/refused aggregation receipt |
| 4 | `bitnami/metrics-server` | 7.4.12 | `source-detected-needs-recipe` | `duplicate-chart-decision` | decide whether Bitnami Metrics Server should be imported separately or routed to the existing upstream Metrics Server catalog entry | the row is either modeled with APIService readiness or intentionally refused as a duplicate package route |
| 5 | `metrics-server/metrics-server` | 3.13.0 | `api-aggregation-observed` | `keep-fresh-pattern` | keep the Metrics Server runtime/GitOps aggregation receipt fresh and reuse its checks as the next chart pattern | existing api-aggregation-observed row remains fresh and reproducible |

## Receipt Contract

For a row to become `api-aggregation-observed`, it needs committed evidence
for the selected chart/base:

~~~text
rendered APIService object observed
backing workload observed
APIService Available=True observed
aggregated API query or target-specific equivalent observed
freshness timestamp recorded
~~~

KEDA is the first proof-wave target because it already has a maintained
recipe row and two-cluster parity. Its current row records two-cluster API
aggregation evidence; the next KEDA question is whether it should move into a
catalog promotion or runtime/GitOps wave. Kubernetes Dashboard, Datadog, and
Bitnami Metrics Server need import/catalog decisions before a runtime
aggregation receipt can close the gap.

## Files

| File | Purpose |
| --- | --- |
| `top100-apiservice-coverage.csv` | Current APIService state per top-100 source row. |
| `work-orders.csv` | Same queue in spreadsheet form. |
| `data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml` | Existing Metrics Server pattern receipt. |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
