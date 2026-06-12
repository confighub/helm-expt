# Live Helm-vs-ConfigHub Parity

This report tracks the strict live comparison lane for the selected top-20
chart/base rows and any additional committed base-variant receipts. Each
completed row has a receipt under
`runs/live-helm-confighub-compare/`.

```text
pass: 39
watch: 0
blocked: 0
not-started: 0
```

Blocked rows broken down by cause (see `blocked-triage.md`):

```text
(none)
```

| Rank | Chart | Base | Result | Reason | Receipt |
| ---: | --- | --- | --- | --- | --- |
| 1 | `bitnami/redis@25.5.3` | default | pass | - | runs/live-helm-confighub-compare/bitnami-redis-default/receipt.yaml |
| 2 | `metrics-server/metrics-server@3.13.0` | default | pass | - | runs/live-helm-confighub-compare/metrics-server-metrics-server-default/receipt.yaml |
| 3 | `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | pass | - | runs/live-helm-confighub-compare/ingress-nginx-ingress-nginx-internal-clusterip/receipt.yaml |
| 4 | `jetstack/cert-manager@v1.20.2` | crds-enabled | pass | - | runs/live-helm-confighub-compare/jetstack-cert-manager-crds-enabled/receipt.yaml |
| 5 | `external-secrets/external-secrets@2.5.0` | default | pass | - | runs/live-helm-confighub-compare/external-secrets-external-secrets-default/receipt.yaml |
| 6 | `argo-cd/argo-cd@9.5.15` | default | pass | - | runs/live-helm-confighub-compare/argo-cd-argo-cd-default/receipt.yaml |
| 7 | `prometheus-community/kube-prometheus-stack@85.3.3` | default | pass | - | runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml |
| 8 | `bitnami/postgresql@18.6.7` | generated-passwords | pass | - | runs/live-helm-confighub-compare/bitnami-postgresql-generated-passwords/receipt.yaml |
| 9 | `bitnami/rabbitmq@16.0.14` | generated-passwords | pass | - | runs/live-helm-confighub-compare/bitnami-rabbitmq-generated-passwords/receipt.yaml |
| 10 | `grafana/loki@7.0.0` | single-binary-filesystem | pass | - | runs/live-helm-confighub-compare/grafana-loki-single-binary-filesystem/receipt.yaml |
| 11 | `longhorn/longhorn@1.11.2` | default | pass | - | runs/live-helm-confighub-compare/longhorn-longhorn-default/receipt.yaml |
| 12 | `hashicorp/vault@0.32.0` | dev-mode | pass | - | runs/live-helm-confighub-compare/hashicorp-vault-dev-mode/receipt.yaml |
| 13 | `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | pass | - | runs/live-helm-confighub-compare/secrets-store-csi-driver-secrets-store-csi-driver-default/receipt.yaml |
| 14 | `prometheus-community/prometheus@29.8.0` | server-only-ephemeral | pass | - | runs/live-helm-confighub-compare/prometheus-community-prometheus-server-only-ephemeral/receipt.yaml |
| 15 | `grafana/grafana@10.5.15` | generated-passwords | pass | - | runs/live-helm-confighub-compare/grafana-grafana-generated-passwords/receipt.yaml |
| 16 | `bitnami/mysql@14.0.3` | generated-passwords | pass | - | runs/live-helm-confighub-compare/bitnami-mysql-generated-passwords/receipt.yaml |
| 17 | `bitnami/mongodb@19.0.7` | generated-passwords | pass | - | runs/live-helm-confighub-compare/bitnami-mongodb-generated-passwords/receipt.yaml |
| 18 | `bitnami/nginx@24.0.2` | http-clusterip | pass | - | runs/live-helm-confighub-compare/bitnami-nginx-http-clusterip/receipt.yaml |
| 19 | `grafana/tempo@1.24.4` | local-persistent | pass | - | runs/live-helm-confighub-compare/grafana-tempo-local-persistent/receipt.yaml |
| 20 | `hashicorp/consul@2.0.0` | default-control-plane | pass | - | runs/live-helm-confighub-compare/hashicorp-consul-default-control-plane/receipt.yaml |
| 1 | `bitnami/redis@25.5.3` | reuse-existing-secret | pass | - | runs/live-helm-confighub-compare/bitnami-redis-reuse-existing-secret/receipt.yaml |
| 2 | `metrics-server/metrics-server@3.13.0` | external-tls-ca | pass | - | runs/live-helm-confighub-compare/metrics-server-metrics-server-external-tls-ca/receipt.yaml |
| 3 | `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | pass | - | runs/live-helm-confighub-compare/ingress-nginx-ingress-nginx-admission-disabled/receipt.yaml |
| 3 | `ingress-nginx/ingress-nginx@4.15.1` | default | pass | - | runs/live-helm-confighub-compare/ingress-nginx-ingress-nginx-default/receipt.yaml |
| 4 | `jetstack/cert-manager@v1.20.2` | default | pass | - | runs/live-helm-confighub-compare/jetstack-cert-manager-default/receipt.yaml |
| 7 | `prometheus-community/kube-prometheus-stack@85.3.3` | no-crds | pass | - | runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml |
| 8 | `bitnami/postgresql@18.6.7` | existing-secret | pass | - | runs/live-helm-confighub-compare/bitnami-postgresql-existing-secret/receipt.yaml |
| 9 | `bitnami/rabbitmq@16.0.14` | existing-secret | pass | - | runs/live-helm-confighub-compare/bitnami-rabbitmq-existing-secret/receipt.yaml |
| 10 | `grafana/loki@7.0.0` | simple-scalable-minio | pass | - | runs/live-helm-confighub-compare/grafana-loki-simple-scalable-minio/receipt.yaml |
| 11 | `longhorn/longhorn@1.11.2` | ui-ingress | pass | - | runs/live-helm-confighub-compare/longhorn-longhorn-ui-ingress/receipt.yaml |
| 12 | `hashicorp/vault@0.32.0` | default | pass | - | runs/live-helm-confighub-compare/hashicorp-vault-default/receipt.yaml |
| 13 | `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | sync-secret-rotation | pass | - | runs/live-helm-confighub-compare/secrets-store-csi-driver-secrets-store-csi-driver-sync-secret-rotation/receipt.yaml |
| 14 | `prometheus-community/prometheus@29.8.0` | default | pass | - | runs/live-helm-confighub-compare/prometheus-community-prometheus-default/receipt.yaml |
| 15 | `grafana/grafana@10.5.15` | existing-secret-ingress | pass | - | runs/live-helm-confighub-compare/grafana-grafana-existing-secret-ingress/receipt.yaml |
| 16 | `bitnami/mysql@14.0.3` | existing-secret | pass | - | runs/live-helm-confighub-compare/bitnami-mysql-existing-secret/receipt.yaml |
| 17 | `bitnami/mongodb@19.0.7` | existing-secret-replicaset | pass | - | runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset/receipt.yaml |
| 18 | `bitnami/nginx@24.0.2` | existing-tls-ingress | pass | - | runs/live-helm-confighub-compare/bitnami-nginx-existing-tls-ingress/receipt.yaml |
|  | `elastic/logstash@8.5.1` | default | pass | - | runs/live-helm-confighub-compare/elastic-logstash-default/receipt.yaml |
|  | `kedacore/keda@2.19.0` | default | pass | - | runs/live-helm-confighub-compare/kedacore-keda-default/receipt.yaml |
