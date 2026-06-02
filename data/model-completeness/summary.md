# Model Completeness Report

Generated from recipe / variant / receipt / catalog-status artifacts. Scores every recipe against the
7-point contract in `docs/user/complete-corresponding-model.md`. A chart's corresponding model is
**complete** only when all 7 criteria pass; `blocked-with-reason` is an honest disposition, not a gap.

## Headline

```text
charts: 100
model-complete (all 7): 20
incomplete: 80
```

## Per-criterion coverage

- `render_equivalent`: 100/100
- `behaviorally_complete`: 20/100
- `variant_complete`: 20/100
- `readable`: 100/100
- `usable`: 100/100
- `verifiable`: 100/100
- `honestly_scoped`: 100/100

## Gap by criterion (how many charts each one blocks)

- `behaviorally_complete`: 80
- `variant_complete`: 80

## Incomplete charts (the work queue)

| Chart | Score | Missing criteria |
| --- | ---: | --- |
| `aqua/trivy-operator@0.32.1` | 5/7 | behaviorally_complete, variant_complete |
| `argo-cd/argo-events@2.4.21` | 5/7 | behaviorally_complete, variant_complete |
| `argo-cd/argo-rollouts@2.40.9` | 5/7 | behaviorally_complete, variant_complete |
| `argo-cd/argo-workflows@1.0.14` | 5/7 | behaviorally_complete, variant_complete |
| `argo-cd/argocd-image-updater@1.2.2` | 5/7 | behaviorally_complete, variant_complete |
| `autoscaler/cluster-autoscaler@9.57.0` | 5/7 | behaviorally_complete, variant_complete |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | 5/7 | behaviorally_complete, variant_complete |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | 5/7 | behaviorally_complete, variant_complete |
| `bitnami/apache@11.4.29` | 5/7 | behaviorally_complete, variant_complete |
| `bitnami/contour@21.1.4` | 5/7 | behaviorally_complete, variant_complete |
| `bitnami/elasticsearch@22.1.6` | 5/7 | behaviorally_complete, variant_complete |
| `bitnami/memcached@8.5.5` | 5/7 | behaviorally_complete, variant_complete |
| `bitnami/opensearch@2.0.10` | 5/7 | behaviorally_complete, variant_complete |
| `bitnami/phpmyadmin@20.0.0` | 5/7 | behaviorally_complete, variant_complete |
| `bitnami/spark@10.0.3` | 5/7 | behaviorally_complete, variant_complete |
| `bitnami/zookeeper@13.8.7` | 5/7 | behaviorally_complete, variant_complete |
| `cloudnative-pg/cloudnative-pg@0.28.2` | 5/7 | behaviorally_complete, variant_complete |
| `coredns/coredns@1.45.2` | 5/7 | behaviorally_complete, variant_complete |
| `crossplane-stable/crossplane@2.3.1` | 5/7 | behaviorally_complete, variant_complete |
| `descheduler/descheduler@0.36.0` | 5/7 | behaviorally_complete, variant_complete |
| `dex/dex@0.24.0` | 5/7 | behaviorally_complete, variant_complete |
| `elastic/eck-operator@3.4.0` | 5/7 | behaviorally_complete, variant_complete |
| `elastic/filebeat@8.5.1` | 5/7 | behaviorally_complete, variant_complete |
| `elastic/kibana@8.5.1` | 5/7 | behaviorally_complete, variant_complete |
| `elastic/logstash@8.5.1` | 5/7 | behaviorally_complete, variant_complete |
| `elastic/metricbeat@8.5.1` | 5/7 | behaviorally_complete, variant_complete |
| `external-dns/external-dns@1.21.1` | 5/7 | behaviorally_complete, variant_complete |
| `fairwinds-stable/goldilocks@10.3.0` | 5/7 | behaviorally_complete, variant_complete |
| `fairwinds-stable/vpa@4.11.0` | 5/7 | behaviorally_complete, variant_complete |
| `falcosecurity/falco@9.0.0` | 5/7 | behaviorally_complete, variant_complete |
| `falcosecurity/falcosidekick@0.13.1` | 5/7 | behaviorally_complete, variant_complete |
| `fluent/fluent-bit@0.57.6` | 5/7 | behaviorally_complete, variant_complete |
| `fluent/fluentd@0.5.3` | 5/7 | behaviorally_complete, variant_complete |
| `gatekeeper/gatekeeper@3.22.2` | 5/7 | behaviorally_complete, variant_complete |
| `gitlab/gitlab-runner@0.89.0` | 5/7 | behaviorally_complete, variant_complete |
| `grafana/alloy@1.8.2` | 5/7 | behaviorally_complete, variant_complete |
| `grafana/promtail@6.17.1` | 5/7 | behaviorally_complete, variant_complete |
| `grafana/pyroscope@2.0.2` | 5/7 | behaviorally_complete, variant_complete |
| `grafana/rollout-operator@0.49.0` | 5/7 | behaviorally_complete, variant_complete |
| `haproxytech/kubernetes-ingress@1.52.0` | 5/7 | behaviorally_complete, variant_complete |
| `hashicorp/terraform@1.1.2` | 5/7 | behaviorally_complete, variant_complete |
| `istio/gateway@1.30.0` | 5/7 | behaviorally_complete, variant_complete |
| `istio/istiod@1.30.0` | 5/7 | behaviorally_complete, variant_complete |
| `jaegertracing/jaeger-operator@2.57.0` | 5/7 | behaviorally_complete, variant_complete |
| `jaegertracing/jaeger@4.8.0` | 5/7 | behaviorally_complete, variant_complete |
| `jetstack/cert-manager-csi-driver@v0.14.0` | 5/7 | behaviorally_complete, variant_complete |
| `jetstack/trust-manager@v0.22.1` | 5/7 | behaviorally_complete, variant_complete |
| `kedacore/keda@2.19.0` | 5/7 | behaviorally_complete, variant_complete |
| `kyverno/kyverno-policies@3.8.0` | 5/7 | behaviorally_complete, variant_complete |
| `kyverno/kyverno@3.8.1` | 5/7 | behaviorally_complete, variant_complete |
| `linkerd/linkerd-crds@1.8.0` | 5/7 | behaviorally_complete, variant_complete |
| `minio-operator/operator@7.1.1` | 5/7 | behaviorally_complete, variant_complete |
| `minio-operator/tenant@7.1.1` | 5/7 | behaviorally_complete, variant_complete |
| `nats/nack@0.34.0` | 5/7 | behaviorally_complete, variant_complete |
| `nats/nats@2.14.0` | 5/7 | behaviorally_complete, variant_complete |
| `nats/surveyor@0.20.9` | 5/7 | behaviorally_complete, variant_complete |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | 5/7 | behaviorally_complete, variant_complete |
| `open-telemetry/opentelemetry-operator@0.114.0` | 5/7 | behaviorally_complete, variant_complete |
| `opencost/opencost@2.5.21` | 5/7 | behaviorally_complete, variant_complete |
| `percona/pg-operator@3.0.0` | 5/7 | behaviorally_complete, variant_complete |
| `percona/psmdb-operator@1.22.0` | 5/7 | behaviorally_complete, variant_complete |
| `percona/pxc-operator@1.19.1` | 5/7 | behaviorally_complete, variant_complete |
| `projectcalico/tigera-operator@v3.32.0` | 5/7 | behaviorally_complete, variant_complete |
| `prometheus-community/alertmanager@1.37.0` | 5/7 | behaviorally_complete, variant_complete |
| `prometheus-community/kube-state-metrics@7.4.0` | 5/7 | behaviorally_complete, variant_complete |
| `prometheus-community/prometheus-adapter@5.3.0` | 5/7 | behaviorally_complete, variant_complete |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | 5/7 | behaviorally_complete, variant_complete |
| `prometheus-community/prometheus-node-exporter@4.55.0` | 5/7 | behaviorally_complete, variant_complete |
| `prometheus-community/prometheus-operator-crds@29.0.0` | 5/7 | behaviorally_complete, variant_complete |
| `prometheus-community/prometheus-pushgateway@3.6.0` | 5/7 | behaviorally_complete, variant_complete |
| `rook-release/rook-ceph-cluster@v1.19.5` | 5/7 | behaviorally_complete, variant_complete |
| `rook-release/rook-ceph@v1.19.5` | 5/7 | behaviorally_complete, variant_complete |
| `runix/pgadmin4@1.62.0` | 5/7 | behaviorally_complete, variant_complete |
| `sealed-secrets/sealed-secrets@2.18.6` | 5/7 | behaviorally_complete, variant_complete |
| `stakater/reloader@2.2.12` | 5/7 | behaviorally_complete, variant_complete |
| `strimzi/strimzi-kafka-operator@1.0.0` | 5/7 | behaviorally_complete, variant_complete |
| `traefik/traefik@40.2.0` | 5/7 | behaviorally_complete, variant_complete |
| `velero/velero@12.0.1` | 5/7 | behaviorally_complete, variant_complete |
| `vm/victoria-logs-single@0.12.5` | 5/7 | behaviorally_complete, variant_complete |
| `vm/victoria-metrics-single@0.39.0` | 5/7 | behaviorally_complete, variant_complete |

## How to close the gap

- `variant_complete` is the dominant gap: default-only charts need their meaningful render-time variants
  built (real recipe variant + package base + rendered revision + scan/gate + Helm-equivalence receipt),
  **or** their obvious variants explicitly listed as `deferredVariants`/`candidateVariants` in
  `catalog-status.yaml` with a reason.
- Re-run `npm run completeness:generate` after any chart's variants, receipts, or catalog-status change.
- A chart counts as catalog-supported for its declared scope only once it is model-complete here.
