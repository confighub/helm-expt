# Edge Recovery

This generated report records graph fragments recovered from Helm-derived recipe
artifacts. The goal is to show that helm-expt can preserve more than flat YAML:
base variants, overrides, generated facts, target facts, and field reachability
can become desired-state graph input.

## Current Scope

~~~text
charts with inheritance graphs: 20
edge rows:                      99
target-fact edges:              56
generated-fact edges:           1
charts with target facts:        13
charts with field reachability:  2
~~~

## Catalog Graph Coverage

| Chart | Graph | Why it matters |
| --- | --- | --- |
| argo-cd/argo-cd@9.5.15 | [../../recipes/argo-cd/argo-cd/9.5.15/inheritance-graph.yaml](../../recipes/argo-cd/argo-cd/9.5.15/inheritance-graph.yaml) | Catalog-supported chart with 5 target fact edges captured from recipe artifacts. |
| bitnami/mongodb@19.0.7 | [../../recipes/bitnami/mongodb/19.0.7/inheritance-graph.yaml](../../recipes/bitnami/mongodb/19.0.7/inheritance-graph.yaml) | Catalog-supported chart with 1 target fact edge captured from recipe artifacts. |
| bitnami/mysql@14.0.3 | [../../recipes/bitnami/mysql/14.0.3/inheritance-graph.yaml](../../recipes/bitnami/mysql/14.0.3/inheritance-graph.yaml) | Catalog-supported chart with 1 target fact edge captured from recipe artifacts. |
| bitnami/nginx@24.0.2 | [../../recipes/bitnami/nginx/24.0.2/inheritance-graph.yaml](../../recipes/bitnami/nginx/24.0.2/inheritance-graph.yaml) | Catalog-supported chart with 2 target fact edges captured from recipe artifacts. |
| bitnami/postgresql@18.6.7 | [../../recipes/bitnami/postgresql/18.6.7/inheritance-graph.yaml](../../recipes/bitnami/postgresql/18.6.7/inheritance-graph.yaml) | Catalog-supported chart with 1 target fact edge captured from recipe artifacts. |
| bitnami/rabbitmq@16.0.14 | [../../recipes/bitnami/rabbitmq/16.0.14/inheritance-graph.yaml](../../recipes/bitnami/rabbitmq/16.0.14/inheritance-graph.yaml) | Catalog-supported chart with 2 target fact edges captured from recipe artifacts. |
| bitnami/redis@25.5.3 | [../../recipes/bitnami/redis/25.5.3/inheritance-graph.yaml](../../recipes/bitnami/redis/25.5.3/inheritance-graph.yaml) | Teaching chart for generated facts, target facts, and secret variants. |
| external-secrets/external-secrets@2.5.0 | [../../recipes/external-secrets/external-secrets/2.5.0/inheritance-graph.yaml](../../recipes/external-secrets/external-secrets/2.5.0/inheritance-graph.yaml) | Catalog-supported chart with 23 target fact edges captured from recipe artifacts. |
| grafana/grafana@10.5.15 | [../../recipes/grafana/grafana/10.5.15/inheritance-graph.yaml](../../recipes/grafana/grafana/10.5.15/inheritance-graph.yaml) | Catalog-supported chart with 1 target fact edge captured from recipe artifacts. |
| grafana/loki@7.0.0 | [../../recipes/grafana/loki/7.0.0/inheritance-graph.yaml](../../recipes/grafana/loki/7.0.0/inheritance-graph.yaml) | Catalog-supported chart with base and variant inheritance captured from recipe artifacts. |
| grafana/tempo@1.24.4 | [../../recipes/grafana/tempo/1.24.4/inheritance-graph.yaml](../../recipes/grafana/tempo/1.24.4/inheritance-graph.yaml) | Catalog-supported chart with 2 target fact edges captured from recipe artifacts. |
| hashicorp/consul@2.0.0 | [../../recipes/hashicorp/consul/2.0.0/inheritance-graph.yaml](../../recipes/hashicorp/consul/2.0.0/inheritance-graph.yaml) | Catalog-supported chart with 4 target fact edges captured from recipe artifacts. |
| hashicorp/vault@0.32.0 | [../../recipes/hashicorp/vault/0.32.0/inheritance-graph.yaml](../../recipes/hashicorp/vault/0.32.0/inheritance-graph.yaml) | Catalog-supported chart with base and variant inheritance captured from recipe artifacts. |
| ingress-nginx/ingress-nginx@4.15.1 | [../../recipes/ingress-nginx/ingress-nginx/4.15.1/inheritance-graph.yaml](../../recipes/ingress-nginx/ingress-nginx/4.15.1/inheritance-graph.yaml) | Catalog-supported chart with base and variant inheritance captured from recipe artifacts. |
| jetstack/cert-manager@v1.20.2 | [../../recipes/jetstack/cert-manager/v1.20.2/inheritance-graph.yaml](../../recipes/jetstack/cert-manager/v1.20.2/inheritance-graph.yaml) | Catalog-supported chart with base and variant inheritance captured from recipe artifacts. |
| longhorn/longhorn@1.11.2 | [../../recipes/longhorn/longhorn/1.11.2/inheritance-graph.yaml](../../recipes/longhorn/longhorn/1.11.2/inheritance-graph.yaml) | Catalog-supported chart with base and variant inheritance captured from recipe artifacts. |
| metrics-server/metrics-server@3.13.0 | [../../recipes/metrics-server/metrics-server/3.13.0/inheritance-graph.yaml](../../recipes/metrics-server/metrics-server/3.13.0/inheritance-graph.yaml) | Catalog-supported chart with 1 target fact edge captured from recipe artifacts. |
| prometheus-community/kube-prometheus-stack@85.3.3 | [../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml) | Main hard chart for high fanout, CRDs, webhooks, dependencies, and large object count. |
| prometheus-community/prometheus@29.8.0 | [../../recipes/prometheus-community/prometheus/29.8.0/inheritance-graph.yaml](../../recipes/prometheus-community/prometheus/29.8.0/inheritance-graph.yaml) | Catalog-supported chart with base and variant inheritance captured from recipe artifacts. |
| secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 | [../../recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/inheritance-graph.yaml](../../recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/inheritance-graph.yaml) | Catalog-supported chart with base and variant inheritance captured from recipe artifacts. |

## Regenerate

~~~sh
npm run edges:generate
npm run edges:verify
~~~
