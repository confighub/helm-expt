# Top-20 Local Kind Live/E2E

This report records live Kubernetes observation receipts for the top-20 chart
proof set. A passing row means the rendered ConfigHub/cub installer package output
was applied to a local kind cluster and the declared live checks passed. A
failing row is still useful evidence: it tells us exactly which production
disposition or local-kind limitation must be handled before we claim broader
support.

```text
pass: 20
fail: 0
not-started: 0
```

| Rank | Chart | Variant | Result | cub-scout | cub-scout checks | Failure stage | Receipt |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `bitnami/redis@25.5.3` | default | pass | observed | 3/3 pass | - | runs/redis-local-kind/latest/observation-receipt.yaml |
| 2 | `metrics-server/metrics-server@3.13.0` | default | pass | observed | 2/3 pass | - | runs/top20-local-kind/metrics-server-default/observation-receipt.json |
| 3 | `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | pass | observed | 3/3 pass | - | runs/top20-local-kind/ingress-nginx-internal-clusterip/observation-receipt.json |
| 4 | `jetstack/cert-manager@v1.20.2` | crds-enabled | pass | - | - | - | runs/top20-local-kind/cert-manager-crds-enabled/observation-receipt.json |
| 5 | `external-secrets/external-secrets@2.5.0` | default | pass | - | - | - | runs/top20-local-kind/external-secrets-default/observation-receipt.json |
| 6 | `argo-cd/argo-cd@9.5.15` | default | pass | - | - | - | runs/top20-local-kind/argo-cd-default/observation-receipt.json |
| 7 | `prometheus-community/kube-prometheus-stack@85.3.3` | default | pass | observed | 3/4 pass | - | runs/top20-local-kind/kube-prometheus-stack-default/observation-receipt.json |
| 8 | `bitnami/postgresql@18.6.7` | generated-passwords | pass | - | - | - | runs/top20-local-kind/postgresql-generated-passwords/observation-receipt.json |
| 9 | `bitnami/rabbitmq@16.0.14` | generated-passwords | pass | - | - | - | runs/top20-local-kind/rabbitmq-generated-passwords/observation-receipt.json |
| 10 | `grafana/loki@7.0.0` | single-binary-filesystem | pass | - | - | - | runs/top20-local-kind/loki-single-binary-filesystem/observation-receipt.json |
| 11 | `longhorn/longhorn@1.11.2` | default | pass | - | - | - | runs/top20-local-kind/longhorn-default/observation-receipt.json |
| 12 | `hashicorp/vault@0.32.0` | dev-mode | pass | observed | 3/3 pass | - | runs/top20-local-kind/vault-dev-mode/observation-receipt.json |
| 13 | `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | pass | - | - | - | runs/top20-local-kind/secrets-store-csi-driver-default/observation-receipt.json |
| 14 | `prometheus-community/prometheus@29.8.0` | server-only-ephemeral | pass | - | - | - | runs/top20-local-kind/prometheus-server-only-ephemeral/observation-receipt.json |
| 15 | `grafana/grafana@10.5.15` | generated-passwords | pass | - | - | - | runs/top20-local-kind/grafana-generated-passwords/observation-receipt.json |
| 16 | `bitnami/mysql@14.0.3` | generated-passwords | pass | - | - | - | runs/top20-local-kind/mysql-generated-passwords/observation-receipt.json |
| 17 | `bitnami/mongodb@19.0.7` | generated-passwords | pass | - | - | - | runs/top20-local-kind/mongodb-generated-passwords/observation-receipt.json |
| 18 | `bitnami/nginx@24.0.2` | http-clusterip | pass | - | - | - | runs/top20-local-kind/nginx-http-clusterip/observation-receipt.json |
| 19 | `grafana/tempo@1.24.4` | local-persistent | pass | - | - | - | runs/top20-local-kind/tempo-local-persistent/observation-receipt.json |
| 20 | `hashicorp/consul@2.0.0` | default-control-plane | pass | - | - | - | runs/top20-local-kind/consul-default-control-plane/observation-receipt.json |
