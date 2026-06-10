# Latest Candidate Local Kind Live/E2E

This report records live Kubernetes observation receipts for the latest-version candidate chart proof set.
A passing row means the rendered ConfigHub/cub installer package output was
applied to a local kind cluster and the declared live checks passed. A failing
row is still useful evidence: it tells us exactly which production disposition
or local-kind limitation must be handled before we claim broader support.

```text
pass: 7
fail: 0
not-started: 0
```

| Rank | Chart | Variant | Result | cub-scout | cub-scout checks | Failure stage | Receipt |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 6 | `argo-cd/argo-cd@9.5.17` | default | pass | observed | 3/4 pass | - | runs/latest-top20-refresh/argo-cd-9.5.17/local-kind/observation-receipt.json |
| 17 | `bitnami/mongodb@19.0.9` | generated-passwords | pass | observed | 3/3 pass | - | runs/latest-top20-refresh/mongodb-19.0.9/local-kind/observation-receipt.json |
| 18 | `bitnami/nginx@25.0.0` | http-clusterip | pass | observed | 3/3 pass | - | runs/latest-top20-refresh/nginx-25.0.0/local-kind/observation-receipt.json |
| 8 | `bitnami/postgresql@18.6.10` | generated-passwords | pass | observed | 3/3 pass | - | runs/latest-top20-refresh/postgresql-18.6.10/local-kind/observation-receipt.json |
| 1 | `bitnami/redis@27.0.0` | default | pass | observed | 3/3 pass | - | runs/latest-top20-refresh/redis-27.0.0/local-kind/observation-receipt.json |
| 7 | `prometheus-community/kube-prometheus-stack@86.1.0` | default | pass | observed | 3/4 pass | - | runs/latest-top20-refresh/kube-prometheus-stack-86.1.0/local-kind/observation-receipt.json |
| 14 | `prometheus-community/prometheus@29.9.0` | server-only-ephemeral | pass | observed | 3/3 pass | - | runs/latest-top20-refresh/prometheus-29.9.0/local-kind/observation-receipt.json |
