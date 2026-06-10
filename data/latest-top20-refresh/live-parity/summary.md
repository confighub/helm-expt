# Latest Candidate Two-Cluster Helm-vs-Installer Kind Parity

This report tracks the latest-version candidate parity lane. It uses two
vanilla kind clusters per candidate: regular Helm on one cluster and
`cub installer` render/apply on the other.

It does not promote candidate versions. It records whether a candidate has
started the same strict parity lane used by the supported catalog versions.

```text
pass: 7
watch: 0
blocked: 0
not-started: 0
semantic parity defects: 0
```

## Non-Pass By Reason

| Reason | Rows |
| --- | ---: |
| - | 0 |

## Rows

| Chart | Base | Result | Reason | Receipt |
| --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.17` | default | pass |  | runs/latest-top20-refresh/argo-cd-9.5.17/live-parity/default/receipt.yaml |
| `bitnami/mongodb@19.1.0` | generated-passwords | pass |  | runs/latest-top20-refresh/mongodb-19.1.0/live-parity/generated-passwords/receipt.yaml |
| `bitnami/nginx@25.0.0` | http-clusterip | pass |  | runs/latest-top20-refresh/nginx-25.0.0/live-parity/http-clusterip/receipt.yaml |
| `bitnami/postgresql@18.7.0` | generated-passwords | pass |  | runs/latest-top20-refresh/postgresql-18.7.0/live-parity/generated-passwords/receipt.yaml |
| `bitnami/redis@27.0.0` | default | pass |  | runs/latest-top20-refresh/redis-27.0.0/live-parity/default/receipt.yaml |
| `prometheus-community/kube-prometheus-stack@86.1.0` | default | pass |  | runs/latest-top20-refresh/kube-prometheus-stack-86.1.0/live-parity/default/receipt.yaml |
| `prometheus-community/prometheus@29.9.0` | server-only-ephemeral | pass |  | runs/latest-top20-refresh/prometheus-29.9.0/live-parity/server-only-ephemeral/receipt.yaml |
