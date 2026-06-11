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
maintained APIService recipe rows:       5
maintained rows outside source top-100:  3
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

## Maintained APIService Rows

This appendix includes maintained recipe/package rows with APIService source
signals even when the source chart sits outside the source top-100 slice. It
keeps target compatibility blockers visible without changing the source-top-100
counts above.

| Rank | Chart | Source version | Status | ConfigHub proof | Target block | Next action |
| ---: | --- | --- | --- | --- | --- | --- |
| 11 | `metrics-server/metrics-server` | 3.13.0 | `api-aggregation-observed` | yes | - | keep the runtime/GitOps APIService receipt fresh; use this pattern for the next APIService chart |
| 53 | `kedacore/keda` | 2.19.0 | `api-aggregation-observed` | yes | - | decide whether KEDA enters a catalog promotion wave using the two-cluster parity and ConfigHub OCI APIService receipts |
| 118 | `prometheus-community/prometheus-adapter` | 5.3.0 | `target-api-version-blocked` | yes | `api-version-unsupported` | choose a supported chart version, compatibility base, or target Kubernetes profile before rerunning live APIService observation |
| 130 | `fairwinds-stable/goldilocks` | 10.3.0 | `modeled-needs-runtime-observation` | no | - | add runtime APIService observation route and aggregated API availability receipt for the selected base |
| 148 | `fairwinds-stable/vpa` | 4.11.0 | `modeled-needs-runtime-observation` | no | - | add runtime APIService observation route and aggregated API availability receipt for the selected base |

Maintained status counts:

| Status | Rows |
| --- | ---: |
| `api-aggregation-observed` | 2 |
| `modeled-needs-runtime-observation` | 2 |
| `target-api-version-blocked` | 1 |

## Runtime Contract

APIService rows become trusted runtime evidence only when one committed receipt
records all of these facts for the selected chart/base:

| Fact | Why it matters |
| --- | --- |
| rendered APIService object observed | proves the desired aggregation object is present in the object set |
| backing workload observed | proves the APIService has a real server behind it |
| APIService `Available=True` observed | proves Kubernetes API aggregation accepted the route and trust chain |
| aggregated API query observed | proves a client can use the aggregated API, not only read the object |
| freshness timestamp recorded | lets support decide whether the observation is still usable |

Current contract rows:

| Chart | Receipt | Condition | Query | Freshness | Gaps |
| --- | --- | --- | --- | --- | --- |
| `k8s-dashboard/kubernetes-dashboard@7.14.0` | - | no | no | no | no maintained recipe/import row; no rendered APIService object observation; no backing workload observation; no APIService Available=True plus aggregated API query receipt |
| `metrics-server/metrics-server@3.13.0` | `data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml` | yes | yes | yes | none |
| `datadog/datadog@3.214.0` | - | no | no | no | no maintained recipe/import row; no rendered APIService object observation; no backing workload observation; no APIService Available=True plus aggregated API query receipt |
| `kedacore/keda@2.19.0` | `data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml` | yes | yes | yes | none |
| `bitnami/metrics-server@7.4.12` | - | no | no | no | no maintained recipe/import row; no rendered APIService object observation; no backing workload observation; no APIService Available=True plus aggregated API query receipt |

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
| `maintained-apiservice-coverage.csv` | Maintained recipe/package rows with APIService source signals, including rows outside the source top-100 slice. |
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
