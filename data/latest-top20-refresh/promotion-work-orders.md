# Retained Candidate Promotion Work Orders

This file turns retained update candidates into lane work orders and shows which
proof lanes have closed.

It does not say the candidate versions are supported. It records proof-lane
closure before the separate replacement decision chooses whether any candidate
replaces, defers, or lives alongside the current supported catalog version.

## Summary

```text
candidate charts: 7
work-order rows: 56
candidate proof lanes: closed
completed work-order rows: 51
todo work-order rows: 5
candidate support status: not support-promoted
```

## Candidates

| Chart | Current supported version | Candidate version | Variants | Work orders |
| --- | --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | `default`, `no-crds` | [argo-cd rows](./promotion-work-orders.csv) |
| `bitnami/mongodb` | `19.0.7` | `19.0.9` | `generated-passwords`, `existing-secret-replicaset` | [mongodb rows](./promotion-work-orders.csv) |
| `bitnami/nginx` | `24.0.2` | `24.0.4` | `http-clusterip`, `existing-tls-ingress` | [nginx rows](./promotion-work-orders.csv) |
| `bitnami/postgresql` | `18.6.7` | `18.6.10` | `generated-passwords`, `existing-secret` | [postgresql rows](./promotion-work-orders.csv) |
| `bitnami/redis` | `25.5.3` | `27.0.0` | `default`, `reuse-existing-secret` | [redis rows](./promotion-work-orders.csv) |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | `default`, `no-crds` | [kube-prometheus-stack rows](./promotion-work-orders.csv) |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | `default`, `server-only-ephemeral` | [prometheus rows](./promotion-work-orders.csv) |

## Lanes

| Lane | Done or generated | Todo | Other |
| --- | ---: | ---: | ---: |
| candidate-render-proof | 7 | 0 | 0 |
| confighub-proof | 7 | 0 | 0 |
| local-live-e2e | 6 | 1 | 0 |
| live-parity | 6 | 1 | 0 |
| production-disposition | 6 | 1 | 0 |
| promote-versioned-root-paths | 6 | 1 | 0 |
| catalog-and-site | 6 | 1 | 0 |
| top100-top500-refresh | 7 | 0 | 0 |

## Candidate Progress

| Candidate | Done or generated lanes | Todo lanes | Next lane | Next action |
| --- | ---: | ---: | --- | --- |
| `argo-cd/argo-cd@9.5.17` | 8 / 8 | 0 | none | all lanes complete |
| `bitnami/mongodb@19.0.9` | 8 / 8 | 0 | none | all lanes complete |
| `bitnami/nginx@24.0.4` | 8 / 8 | 0 | none | all lanes complete |
| `bitnami/postgresql@18.6.10` | 8 / 8 | 0 | none | all lanes complete |
| `bitnami/redis@27.0.0` | 3 / 8 | 5 | local-live-e2e | apply the candidate rendered objects to a fresh kind target and observe workloads and prerequisites |
| `prometheus-community/kube-prometheus-stack@86.1.0` | 8 / 8 | 0 | none | all lanes complete |
| `prometheus-community/prometheus@29.9.0` | 8 / 8 | 0 | none | all lanes complete |

## How To Use This

Work through one candidate chart at a time. The proof lanes are closed when
there are no todo rows. Keep the previous supported version available until a
target-scoped replacement decision records whether to replace, defer, or keep
both versions.

The spreadsheet form is:

```text
data/latest-top20-refresh/promotion-work-orders.csv
```

## Verify

```sh
npm run top20:latest-promotion-readiness:verify
```
