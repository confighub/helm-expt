# Top-100 APIService Coverage

This generated report joins the source-scan APIService signal to maintained
recipe/package rows and committed runtime evidence.

APIService objects need a stricter runtime contract than ordinary rendered
objects. The desired object can match while Kubernetes API aggregation, CA
trust, or backing service readiness still fails. This report therefore keeps
four facts separate:

~~~text
rendered APIService object observed
backing workload observed
Helm-vs-ConfigHub live parity observed
aggregated API availability observed
~~~

## Current Reading

~~~text
source top-100 APIService rows:          5
catalog-supported APIService rows:       1
rows with API aggregation observation:   2
rows with object/workload observation:   2
rows with two-cluster parity only:       0
rows still source-detected only:         3
aggregated API availability receipts:    2
active proof/import work orders:          4
~~~

Only rows with both an `Available=True` APIService condition and a successful
aggregated API query receipt claim aggregated API availability. Today that
evidence exists for Metrics Server and KEDA.

## Coverage Status

| Status | Rows |
| --- | ---: |
| `api-aggregation-observed` | 2 |
| `source-detected-needs-recipe` | 3 |

## Source Top-100 Rows

| Rank | Chart | Source version | Status | Object observed | Workload observed | Live parity | Aggregation observed | Next action |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 9 | `k8s-dashboard/kubernetes-dashboard` | 7.14.0 | `source-detected-needs-recipe` | no | no | no | no | create recipe/import candidate, then model APIService readiness and aggregation observation before catalog claims |
| 11 | `metrics-server/metrics-server` | 3.13.0 | `api-aggregation-observed` | yes | yes | yes | yes | keep the runtime/GitOps APIService receipt fresh; use this pattern for the next APIService chart |
| 43 | `datadog/datadog` | 3.214.0 | `source-detected-needs-recipe` | no | no | no | no | create recipe/import candidate, then model APIService readiness and aggregation observation before catalog claims |
| 53 | `kedacore/keda` | 2.19.0 | `api-aggregation-observed` | yes | yes | no | yes | decide whether KEDA enters a catalog promotion wave using the two-cluster parity and ConfigHub OCI APIService receipts |
| 71 | `bitnami/metrics-server` | 7.4.12 | `source-detected-needs-recipe` | no | no | no | no | create recipe/import candidate, then model APIService readiness and aggregation observation before catalog claims |

## How To Use This

- `api-aggregation-observed` means committed runtime evidence records both
  APIService `Available=True` and a successful aggregated API query.
- `object-and-workload-observed` means the APIService object and backing
  workload were observed in committed receipts. It is still not an aggregated
  API availability claim.
- `two-cluster-parity-only` means regular Helm and `cub installer` reached
  live semantic parity, but there is no dedicated APIService observation.
- `modeled-needs-runtime-observation` means recipe proof exists, but runtime
  APIService evidence is missing.
- `source-detected-needs-recipe` means the source scan found an APIService,
  but the chart is not yet a maintained recipe/package row.

## Files

| File | Purpose |
| --- | --- |
| `top100-apiservice-coverage.csv` | One row per source top-100 chart that renders APIService objects. |
| `work-orders.md` | Human next-proof queue for APIService charts. |
| `work-orders.csv` | Spreadsheet-ready next-proof queue for assignment and reruns. |
| `data/quirk-work-queue/top100-queue.csv` | Source quirk queue that currently carries the APIService hard gap. |
| `runs/top20-local-kind/metrics-server-default/observation-receipt.json` | Metrics Server object/workload observation evidence. |
| `data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml` | Metrics Server APIService Available=True and `kubectl top nodes` evidence. |
| `data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml` | KEDA ConfigHub OCI/Argo runtime evidence: workloads ready, APIService Available=True, and aggregated API query pass. |
| `runs/live-kind-parity/*/receipt.yaml` | Two-cluster Helm-vs-`cub installer` parity evidence. |

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
