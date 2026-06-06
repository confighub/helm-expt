# Two-Cluster Helm-vs-Installer Kind Parity

This report tracks strict parity receipts that use two vanilla kind clusters:
regular Helm on one cluster and `cub installer` render/apply on the other.

```text
pass: 14
watch: 2
blocked: 4
```

| Chart | Base | Result | Receipt |
| --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | default | watch | runs/live-kind-parity/argo-cd-argo-cd-default/receipt.yaml |
| `bitnami/mongodb@19.0.7` | generated-passwords | pass | runs/live-kind-parity/bitnami-mongodb-generated-passwords/receipt.yaml |
| `bitnami/mysql@14.0.3` | generated-passwords | pass | runs/live-kind-parity/bitnami-mysql-generated-passwords/receipt.yaml |
| `bitnami/nginx@24.0.2` | http-clusterip | pass | runs/live-kind-parity/bitnami-nginx-http-clusterip/receipt.yaml |
| `bitnami/postgresql@18.6.7` | generated-passwords | pass | runs/live-kind-parity/bitnami-postgresql-generated-passwords/receipt.yaml |
| `bitnami/rabbitmq@16.0.14` | generated-passwords | pass | runs/live-kind-parity/bitnami-rabbitmq-generated-passwords/receipt.yaml |
| `bitnami/redis@25.5.3` | default | pass | runs/live-kind-parity/bitnami-redis-default/receipt.yaml |
| `external-secrets/external-secrets@2.5.0` | default | pass | runs/live-kind-parity/external-secrets-external-secrets-default/receipt.yaml |
| `grafana/grafana@10.5.15` | generated-passwords | pass | runs/live-kind-parity/grafana-grafana-generated-passwords/receipt.yaml |
| `grafana/loki@7.0.0` | single-binary-filesystem | blocked | runs/live-kind-parity/grafana-loki-single-binary-filesystem/receipt.yaml |
| `grafana/tempo@1.24.4` | local-persistent | blocked | runs/live-kind-parity/grafana-tempo-local-persistent/receipt.yaml |
| `hashicorp/consul@2.0.0` | default-control-plane | blocked | runs/live-kind-parity/hashicorp-consul-default-control-plane/receipt.yaml |
| `hashicorp/vault@0.32.0` | default | blocked | runs/live-kind-parity/hashicorp-vault-default/receipt.yaml |
| `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | pass | runs/live-kind-parity/ingress-nginx-ingress-nginx-admission-disabled/receipt.yaml |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | pass | runs/live-kind-parity/jetstack-cert-manager-crds-enabled/receipt.yaml |
| `longhorn/longhorn@1.11.2` | default | pass | runs/live-kind-parity/longhorn-longhorn-default/receipt.yaml |
| `metrics-server/metrics-server@3.13.0` | default | pass | runs/live-kind-parity/metrics-server-metrics-server-default/receipt.yaml |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | watch | runs/live-kind-parity/prometheus-community-kube-prometheus-stack-default/receipt.yaml |
| `prometheus-community/prometheus@29.8.0` | server-only-ephemeral | pass | runs/live-kind-parity/prometheus-community-prometheus-server-only-ephemeral/receipt.yaml |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | pass | runs/live-kind-parity/secrets-store-csi-driver-secrets-store-csi-driver-default/receipt.yaml |
