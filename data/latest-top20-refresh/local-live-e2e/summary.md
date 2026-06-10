# Latest Candidate Local Kind Live/E2E

This report records live Kubernetes observation receipts for the latest-version candidate chart proof set.
A passing row means the rendered ConfigHub/cub installer package output was
applied to a local kind cluster and the declared live checks passed. A failing
row is still useful evidence: it tells us exactly which production disposition
or local-kind limitation must be handled before we claim broader support.

```text
pass: 1
fail: 0
not-started: 5
```

| Rank | Chart | Variant | Result | cub-scout | cub-scout checks | Failure stage | Receipt |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 6 | `argo-cd/argo-cd@9.5.17` | default | not-started | - | - | - | - |
| 17 | `bitnami/mongodb@19.0.9` | generated-passwords | not-started | - | - | - | - |
| 18 | `bitnami/nginx@24.0.4` | http-clusterip | pass | observed | 3/3 pass | - | runs/latest-top20-refresh/nginx-24.0.4/local-kind/observation-receipt.json |
| 8 | `bitnami/postgresql@18.6.10` | generated-passwords | not-started | - | - | - | - |
| 7 | `prometheus-community/kube-prometheus-stack@86.1.0` | default | not-started | - | - | - | - |
| 14 | `prometheus-community/prometheus@29.9.0` | server-only-ephemeral | not-started | - | - | - | - |
