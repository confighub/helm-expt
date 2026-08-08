# Variant Backlog — what each chart still needs

Derived from each chart's real `control-points.yaml` using the `per-chart-recipes.md` method: a standard
variant is recommended only where a detected behavior calls for it (no padding), minus the variants the chart
already ships. This **scopes** the wave-based variant build; it does not author the variants (those are
bespoke per chart — see `data/catalog-promotion-wave2/variant-work-orders.yaml` for the worked shape).

## Headline

```text
charts: 135
charts needing variant work: 85
charts already variant-complete: 50
total variants to build: 106
```

## Build volume by dimension (highest-leverage first)

- `existing-secret`: 66 charts
- `no-crds`: 19 charts
- `ha`: 17 charts
- `ingress-tls`: 3 charts
- `tls`: 1 charts

## Per-chart backlog (charts needing work)

| Chart | Has | Build next |
| --- | ---: | --- |
| `aqua/trivy-operator@0.32.1` | 2 | existing-secret |
| `argo-cd/argo-cd@10.1.3` | 2 | existing-secret, ha |
| `argo-cd/argo-cd@10.2.1` | 2 | existing-secret, ha |
| `argo-cd/argo-cd@9.5.15` | 2 | existing-secret, ha |
| `argo-cd/argo-cd@9.5.17` | 2 | existing-secret, ha |
| `argo-cd/argocd-image-updater@1.2.2` | 1 | existing-secret, no-crds |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | 2 | existing-secret |
| `aws-controllers-k8s/ec2-chart@1.18.4` | 2 | existing-secret, no-crds |
| `aws-controllers-k8s/eks-chart@1.16.3` | 2 | existing-secret, no-crds |
| `aws-controllers-k8s/iam-chart@1.7.3` | 2 | existing-secret, no-crds |
| `bitnami/apache@11.4.29` | 2 | existing-secret |
| `bitnami/contour@21.1.4` | 3 | existing-secret |
| `bitnami/elasticsearch@22.1.6` | 3 | existing-secret |
| `bitnami/memcached@8.5.5` | 1 | existing-secret |
| `bitnami/mysql@14.0.3` | 2 | ha |
| `bitnami/nginx@24.0.2` | 2 | existing-secret |
| `bitnami/nginx@24.0.4` | 2 | existing-secret |
| `bitnami/nginx@25.0.0` | 2 | existing-secret |
| `bitnami/opensearch@2.0.10` | 3 | existing-secret |
| `bitnami/phpmyadmin@20.0.0` | 2 | existing-secret |
| `bitnami/postgresql@18.6.10` | 2 | ha |
| `bitnami/postgresql@18.6.7` | 2 | ha |
| `bitnami/postgresql@18.7.0` | 2 | ha |
| `bitnami/rabbitmq@16.0.14` | 2 | ha |
| `bitnami/spark@10.0.3` | 3 | existing-secret |
| `bitnami/zookeeper@13.8.7` | 3 | existing-secret |
| `cloudnative-pg/cloudnative-pg@0.28.2` | 2 | existing-secret |
| `coredns/coredns@1.45.2` | 1 | existing-secret |
| `crossplane-stable/crossplane@2.3.1` | 1 | existing-secret |
| `dex/dex@0.24.0` | 1 | existing-secret |
| `elastic/eck-operator@3.4.0` | 3 | existing-secret |
| `external-dns/external-dns@1.21.1` | 3 | existing-secret |
| `external-secrets/external-secrets@2.5.0` | 2 | existing-secret |
| `external-secrets/external-secrets@2.7.0` | 2 | existing-secret |
| `external-secrets/external-secrets@2.8.0` | 2 | existing-secret |
| `fairwinds-stable/goldilocks@10.3.0` | 1 | existing-secret |
| `falcosecurity/falco@9.0.0` | 1 | existing-secret |
| `falcosecurity/falcosidekick@0.13.1` | 1 | existing-secret |
| `gatekeeper/gatekeeper@3.22.2` | 2 | existing-secret |
| `gitlab/gitlab-runner@0.89.0` | 1 | existing-secret |
| `grafana/alloy@1.11.0` | 1 | no-crds |
| `grafana/promtail@6.17.1` | 1 | existing-secret |
| `grafana/pyroscope@2.0.2` | 3 | existing-secret |
| `grafana/tempo@1.24.4` | 2 | no-crds, ha, ingress-tls |
| `haproxytech/kubernetes-ingress@1.52.0` | 1 | existing-secret |
| `hashicorp/consul@2.0.0` | 2 | no-crds, ha, ingress-tls |
| `hashicorp/vault@0.32.0` | 3 | ingress-tls, tls |
| `istio/istiod@1.30.0` | 1 | existing-secret |
| `jaegertracing/jaeger@4.8.0` | 1 | existing-secret |
| `jetstack/trust-manager@v0.22.1` | 2 | existing-secret |
| `karpenter/karpenter@1.14.0` | 3 | existing-secret |
| `kyverno/kyverno@3.8.1` | 2 | existing-secret |
| `kyverno/kyverno@3.8.2` | 1 | no-crds |
| `linkerd/linkerd-crds@1.8.0` | 1 | existing-secret, no-crds |
| `longhorn/longhorn@1.11.2` | 2 | no-crds, ha |
| `longhorn/longhorn@1.12.0` | 1 | no-crds |
| `metallb/metallb@0.16.1` | 1 | existing-secret, no-crds |
| `metrics-server/metrics-server@3.13.0` | 2 | existing-secret |
| `metrics-server/metrics-server@3.13.1` | 2 | existing-secret |
| `minio-operator/operator@7.1.1` | 1 | no-crds |
| `minio-operator/tenant@7.1.1` | 1 | existing-secret |
| `nats/nack@0.34.0` | 2 | existing-secret |
| `nats/nats@2.14.0` | 2 | existing-secret |
| `nvidia/nvidia-device-plugin@0.19.3` | 3 | existing-secret, no-crds |
| `oauth2-proxy/oauth2-proxy@10.7.0` | 1 | existing-secret |
| `open-telemetry/opentelemetry-operator@0.114.0` | 2 | existing-secret |
| `policy-reporter/policy-reporter@3.9.1` | 1 | existing-secret |
| `prometheus-community/kube-prometheus-stack@85.3.3` | 2 | existing-secret |
| `prometheus-community/kube-prometheus-stack@86.1.0` | 2 | existing-secret |
| `prometheus-community/kube-state-metrics@7.4.0` | 2 | existing-secret |
| `prometheus-community/prometheus-node-exporter@4.55.0` | 2 | existing-secret |
| `prometheus-community/prometheus-operator-crds@29.0.0` | 1 | existing-secret, no-crds |
| `prometheus-community/prometheus@29.8.0` | 2 | ha |
| `prometheus-community/prometheus@29.9.0` | 2 | ha |
| `rook-release/rook-ceph-cluster@v1.19.5` | 1 | existing-secret |
| `rook-release/rook-ceph@v1.19.5` | 1 | no-crds |
| `runix/pgadmin4@1.62.0` | 1 | existing-secret, ha |
| `sealed-secrets/sealed-secrets@2.18.6` | 2 | existing-secret |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | 2 | no-crds |
| `traefik/traefik@40.2.0` | 2 | existing-secret |
| `traefik/traefik@41.0.2` | 1 | no-crds |
| `velero/velero@12.0.1` | 2 | existing-secret |
| `velero/velero@12.1.0` | 1 | existing-secret, no-crds |
| `vm/victoria-logs-single@0.12.5` | 1 | existing-secret, ha |
| `vm/victoria-metrics-single@0.39.0` | 2 | ha |

## How to use this

1. Take a wave of charts from the top of the build-volume dimensions (`existing-secret`, `ha` are broadest).
2. For each, author the variant like the wave-2 work orders (real values delta that changes the object set),
   render it, prove Helm-equivalence, write the revision + scan/gate receipts, and declare its scope.
3. Re-run `npm run completeness:generate` — the chart flips to `variant_complete` and, once it has a
   pain report + scope, to model-complete.
