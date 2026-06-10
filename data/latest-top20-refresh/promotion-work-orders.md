# Latest Candidate Promotion Work Orders

This file turns the latest-version candidates into lane work orders.

It does not say the candidate versions are supported. It says exactly what must
happen before any candidate can replace the current supported catalog version.

## Summary

```text
candidate charts: 6
work-order rows: 48
candidate render proof: already generated
completed work-order rows: 48
todo work-order rows: 0
candidate support status: not support-promoted
```

## Candidates

| Chart | Current supported version | Candidate version | Variants | Work orders |
| --- | --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | `default`, `no-crds` | [argo-cd rows](./promotion-work-orders.csv) |
| `bitnami/mongodb` | `19.0.7` | `19.0.9` | `generated-passwords`, `existing-secret-replicaset` | [mongodb rows](./promotion-work-orders.csv) |
| `bitnami/nginx` | `24.0.2` | `24.0.4` | `http-clusterip`, `existing-tls-ingress` | [nginx rows](./promotion-work-orders.csv) |
| `bitnami/postgresql` | `18.6.7` | `18.6.10` | `generated-passwords`, `existing-secret` | [postgresql rows](./promotion-work-orders.csv) |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | `default`, `no-crds` | [kube-prometheus-stack rows](./promotion-work-orders.csv) |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | `default`, `server-only-ephemeral` | [prometheus rows](./promotion-work-orders.csv) |

## Lanes

| Lane | Done or generated | Todo | Other |
| --- | ---: | ---: | ---: |
| candidate-render-proof | 6 | 0 | 0 |
| confighub-proof | 6 | 0 | 0 |
| local-live-e2e | 6 | 0 | 0 |
| live-parity | 6 | 0 | 0 |
| production-disposition | 6 | 0 | 0 |
| promote-versioned-root-paths | 6 | 0 | 0 |
| catalog-and-site | 6 | 0 | 0 |
| top100-top500-refresh | 6 | 0 | 0 |

## Candidate Progress

| Candidate | Done or generated lanes | Todo lanes | Next lane | Next action |
| --- | ---: | ---: | --- | --- |
| `argo-cd/argo-cd@9.5.17` | 8 / 8 | 0 | none | all lanes complete |
| `bitnami/mongodb@19.0.9` | 8 / 8 | 0 | none | all lanes complete |
| `bitnami/nginx@24.0.4` | 8 / 8 | 0 | none | all lanes complete |
| `bitnami/postgresql@18.6.10` | 8 / 8 | 0 | none | all lanes complete |
| `prometheus-community/kube-prometheus-stack@86.1.0` | 8 / 8 | 0 | none | all lanes complete |
| `prometheus-community/prometheus@29.9.0` | 8 / 8 | 0 | none | all lanes complete |

## How To Use This

Work through one candidate chart at a time. Keep the previous supported version
available until every todo lane for the candidate has evidence and the generated
catalog, status, top100, top500, and refresh-survival surfaces agree.

The spreadsheet form is:

```text
data/latest-top20-refresh/promotion-work-orders.csv
```

## Verify

```sh
npm run top20:latest-promotion-readiness:verify
```
