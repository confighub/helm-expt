# APIService Proof Work Orders

This generated queue turns the APIService coverage report into assignable
proof work. APIService rows are high value because a rendered object can match
regular Helm while Kubernetes API aggregation still fails after apply.

## Work Queue

| Priority | Chart | Version | Current state | Work type | First task | Done when |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `kedacore/keda` | 2.19.0 | `api-aggregation-observed` | `catalog-promotion-decision` | decide whether KEDA enters a catalog promotion wave using the two-cluster parity and ConfigHub OCI APIService receipts | KEDA has either a target-scoped production/support decision or a named reason to stay proof-grade |
| 2 | `k8s-dashboard/kubernetes-dashboard` | 7.14.0 | `source-detected-needs-recipe` | `recipe-import-plus-runtime-proof` | create the recipe/import candidate, then add APIService readiness and runtime aggregation checks | the chart has a maintained recipe row plus a pass/watch/refused aggregation receipt |
| 4 | `datadog/datadog` | 3.214.0 | `source-detected-needs-recipe` | `recipe-import-plus-runtime-proof` | create the recipe/import candidate, then add APIService readiness and runtime aggregation checks | the chart has a maintained recipe row plus a pass/watch/refused aggregation receipt |
| 5 | `bitnami/metrics-server` | 7.4.12 | `source-detected-needs-recipe` | `duplicate-chart-decision` | decide whether Bitnami Metrics Server should be imported separately or routed to the existing upstream Metrics Server catalog entry | the row is either modeled with APIService readiness or intentionally refused as a duplicate package route |
| 8 | `metrics-server/metrics-server` | 3.13.0 | `api-aggregation-observed` | `keep-fresh-pattern` | keep the Metrics Server runtime/GitOps aggregation receipt fresh and reuse its checks as the next chart pattern | existing api-aggregation-observed row remains fresh and reproducible |
| 9 | `prometheus-community/prometheus-adapter` | 5.3.0 | `target-api-version-refused` | `target-compatibility-recorded` | no rerun is useful for the recorded target profile until the chart or compatibility base renders a supported APIService API version | target compatibility decision records the refusal and the row stays proof-grade for that target profile |
| 9 | `fairwinds-stable/goldilocks` | 10.3.0 | `source-signal-not-rendered-in-maintained-bases` | `render-path-recorded` | no runtime APIService test is owed for the current maintained bases; create an APIService-enabled base only if product chooses to support that path | render-path notes record the conditional dependency path and the current bases remain APIService-free |
| 9 | `fairwinds-stable/vpa` | 4.11.0 | `source-signal-not-rendered-in-maintained-bases` | `render-path-recorded` | no runtime APIService test is owed for the current maintained bases; create an APIService-enabled base only if product chooses to support that path | render-path notes record the conditional dependency path and the current bases remain APIService-free |

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

KEDA now has both two-cluster parity and ConfigHub OCI/Argo API aggregation
evidence. Its next question is product scope: whether to promote it to a
catalog-supported entry for a named target profile, or keep it proof-grade.
Kubernetes Dashboard, Datadog, and Bitnami Metrics Server need import/catalog
decisions before a runtime aggregation receipt can close the gap. Prometheus
Adapter has a maintained recipe and ConfigHub proof, but the tested target does
not serve the rendered APIService version; the target-compatibility decision
records that it stays proof-grade for that target profile. Goldilocks and VPA
have render-path notes: their current maintained bases do not render APIService
objects, so they do not owe runtime aggregation evidence unless a future base
enables that path.

## Files

| File | Purpose |
| --- | --- |
| `top100-apiservice-coverage.csv` | Current APIService state per top-100 source row. |
| `work-orders.csv` | Same queue in spreadsheet form. |
| `render-path-notes.md` | Render-path decisions for maintained rows whose APIService source signals are not active in current bases. |
| `target-compatibility-decisions.md` | Target-scoped compatibility decisions for maintained rows that render unsupported APIService versions. |
| `data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml` | Existing Metrics Server pattern receipt. |
| `data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml` | KEDA ConfigHub OCI/Argo APIService receipt. |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
