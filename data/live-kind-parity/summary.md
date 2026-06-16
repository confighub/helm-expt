# Two-Cluster Helm-vs-Installer Kind Parity

This report tracks strict parity receipts that use two vanilla kind clusters:
regular Helm on one cluster and `cub installer` render/apply on the other.

It is the cleanest live check for the narrow parity question:

```text
Under the same chart, version, values, and base variant, does regular Helm reach
the same live outcome as cub installer output?
```

```text
pass: 116
watch: 9
blocked: 18
semantic parity pass: 132
semantic parity defects: 6
non-pass rows where semantic parity passed: 16
non-pass rows with related lifecycle evidence: 0
```

Non-pass rows are still useful when object parity passed. They usually point at
target prerequisites, controller readiness, storage, hooks, or operating policy.
Use the rerun plan for the next command and expected remediation:

```text
data/live-parity-rerun-plan/summary.md
```

## Non-Pass By Reason

| Reason | Rows |
| --- | ---: |
| parity: semantic object diff | 6 |
| helm-runtime: upstream not ready (parity passed) | 4 |
| target-prerequisite: CRDs missing | 3 |
| target-prerequisite: required Secret missing (parity passed) | 3 |
| blocked: inspect receipt | 2 |
| target-prerequisite: CRDs disabled or missing (parity passed) | 2 |
| target-runtime: pod crash loop (parity passed) | 2 |
| target-runtime: pods pending (parity passed) | 2 |
| render-input: required Helm values missing (parity passed) | 1 |
| target-runtime: installer-applied workload not ready at observation cutoff (parity passed) | 1 |
| watch: object parity passed; readiness needs review | 1 |

## How To Read Non-Pass Rows

The `result` column records the overall live command outcome. The
`semantic_parity` column records whether regular Helm and `cub installer`
produced the same Kubernetes object meaning. A non-pass row with
`semantic_parity=pass` is not an object parity defect. It means the row
exposed target, runtime, or lifecycle behavior that needs a route, observation,
or support decision.

The `related_lifecycle_evidence` column links a separate lifecycle receipt
when one exists. If a future row is non-pass while `semantic_parity=pass`,
read it as a target, runtime, or lifecycle route to investigate before making a
broader support claim.

## Rows

| Chart | Base | Result | Semantic parity | Reason | Lifecycle evidence | Meaning | Receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `aqua/trivy-operator@0.32.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/aqua-trivy-operator-default/receipt.yaml |
| `aqua/trivy-operator@0.32.1` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/aqua-trivy-operator-no-crds/receipt.yaml |
| `argo-cd/argo-cd@9.5.15` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argo-cd-no-crds/receipt.yaml |
| `argo-cd/argo-cd@9.5.17` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argo-cd-default/receipt.yaml |
| `argo-cd/argo-events@2.4.21` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argo-events-default/receipt.yaml |
| `argo-cd/argo-events@2.4.21` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argo-events-no-crds/receipt.yaml |
| `argo-cd/argo-rollouts@2.40.9` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argo-rollouts-default/receipt.yaml |
| `argo-cd/argo-rollouts@2.40.9` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argo-rollouts-no-crds/receipt.yaml |
| `argo-cd/argo-workflows@1.0.14` | controller-default-reviewed | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argo-workflows-controller-default-reviewed/receipt.yaml |
| `argo-cd/argo-workflows@1.0.14` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argo-workflows-default/receipt.yaml |
| `argo-cd/argo-workflows@1.0.14` | minimal-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argo-workflows-minimal-crds/receipt.yaml |
| `argo-cd/argocd-image-updater@1.2.2` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/argo-cd-argocd-image-updater-default/receipt.yaml |
| `autoscaler/cluster-autoscaler@9.57.0` | controller-default-reviewed | blocked | unknown | blocked: inspect receipt |  | inspect receipt | runs/live-kind-parity/autoscaler-cluster-autoscaler-controller-default-reviewed/receipt.yaml |
| `autoscaler/cluster-autoscaler@9.57.0` | default | watch | pass | render-input: required Helm values missing (parity passed) |  | semantic parity passed; required render inputs need a modeled base | runs/live-kind-parity/autoscaler-cluster-autoscaler-default/receipt.yaml |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/autoscaler-vertical-pod-autoscaler-default/receipt.yaml |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/autoscaler-vertical-pod-autoscaler-no-crds/receipt.yaml |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | default | blocked | defect | parity: semantic object diff |  | semantic object parity defect | runs/live-kind-parity/aws-ebs-csi-driver-aws-ebs-csi-driver-default/receipt.yaml |
| `bitnami/memcached@8.5.5` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-memcached-default/receipt.yaml |
| `bitnami/mongodb@19.0.7` | existing-secret-replicaset | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-mongodb-existing-secret-replicaset/receipt.yaml |
| `bitnami/mongodb@19.0.7` | generated-passwords | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-mongodb-generated-passwords/receipt.yaml |
| `bitnami/mysql@14.0.3` | existing-secret | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-mysql-existing-secret/receipt.yaml |
| `bitnami/mysql@14.0.3` | generated-passwords | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-mysql-generated-passwords/receipt.yaml |
| `bitnami/nginx@24.0.2` | existing-tls-ingress | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-nginx-existing-tls-ingress/receipt.yaml |
| `bitnami/nginx@24.0.2` | http-clusterip | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-nginx-http-clusterip/receipt.yaml |
| `bitnami/opensearch@2.0.10` | default | blocked | defect | parity: semantic object diff |  | semantic object parity defect | runs/live-kind-parity/bitnami-opensearch-default/receipt.yaml |
| `bitnami/opensearch@2.0.10` | ha | blocked | defect | parity: semantic object diff |  | semantic object parity defect | runs/live-kind-parity/bitnami-opensearch-ha/receipt.yaml |
| `bitnami/postgresql@18.6.7` | existing-secret | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-postgresql-existing-secret/receipt.yaml |
| `bitnami/postgresql@18.6.7` | generated-passwords | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-postgresql-generated-passwords/receipt.yaml |
| `bitnami/rabbitmq@16.0.14` | existing-secret | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-rabbitmq-existing-secret/receipt.yaml |
| `bitnami/rabbitmq@16.0.14` | generated-passwords | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-rabbitmq-generated-passwords/receipt.yaml |
| `bitnami/redis@25.5.3` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-redis-default/receipt.yaml |
| `bitnami/redis@25.5.3` | reuse-existing-secret | pass | pass |  |  | live parity passed | runs/live-kind-parity/bitnami-redis-reuse-existing-secret/receipt.yaml |
| `cloudnative-pg/cloudnative-pg@0.28.2` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/cloudnative-pg-cloudnative-pg-default/receipt.yaml |
| `cloudnative-pg/cloudnative-pg@0.28.2` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/cloudnative-pg-cloudnative-pg-no-crds/receipt.yaml |
| `coredns/coredns@1.45.2` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/coredns-coredns-default/receipt.yaml |
| `crossplane-stable/crossplane@2.3.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/crossplane-stable-crossplane-default/receipt.yaml |
| `descheduler/descheduler@0.36.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/descheduler-descheduler-default/receipt.yaml |
| `elastic/eck-operator@3.4.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/elastic-eck-operator-default/receipt.yaml |
| `elastic/eck-operator@3.4.0` | ha | pass | pass |  |  | live parity passed | runs/live-kind-parity/elastic-eck-operator-ha/receipt.yaml |
| `elastic/eck-operator@3.4.0` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/elastic-eck-operator-no-crds/receipt.yaml |
| `elastic/filebeat@8.5.1` | default | blocked | pass | target-prerequisite: required Secret missing (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/elastic-filebeat-default/receipt.yaml |
| `elastic/filebeat@8.5.1` | node-or-cluster-collector | blocked | pass | helm-runtime: upstream not ready (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/elastic-filebeat-node-or-cluster-collector/receipt.yaml |
| `elastic/logstash@8.5.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/elastic-logstash-default/receipt.yaml |
| `elastic/logstash@8.5.1` | ha | pass | pass |  |  | live parity passed | runs/live-kind-parity/elastic-logstash-ha/receipt.yaml |
| `external-dns/external-dns@1.21.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/external-dns-external-dns-default/receipt.yaml |
| `external-dns/external-dns@1.21.1` | dry-run-txt-registry | pass | pass |  |  | live parity passed | runs/live-kind-parity/external-dns-external-dns-dry-run-txt-registry/receipt.yaml |
| `external-dns/external-dns@1.21.1` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/external-dns-external-dns-no-crds/receipt.yaml |
| `external-secrets/external-secrets@2.5.0` | default | pass | pass |  | pass: runs/lifecycle-observations/cert-manager-eso/external-secrets-external-secrets-default/receipt.yaml | live parity passed | runs/live-kind-parity/external-secrets-external-secrets-default/receipt.yaml |
| `external-secrets/external-secrets@2.5.0` | no-crds | pass | pass |  | pass: runs/lifecycle-observations/cert-manager-eso/external-secrets-external-secrets-no-crds/receipt.yaml | live parity passed | runs/live-kind-parity/external-secrets-external-secrets-no-crds/receipt.yaml |
| `fairwinds-stable/goldilocks@10.3.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/fairwinds-stable-goldilocks-default/receipt.yaml |
| `fairwinds-stable/vpa@4.11.0` | default | watch | pass | target-runtime: pod crash loop (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/fairwinds-stable-vpa-default/receipt.yaml |
| `fairwinds-stable/vpa@4.11.0` | no-crds | watch | pass | target-prerequisite: CRDs disabled or missing (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/fairwinds-stable-vpa-no-crds/receipt.yaml |
| `falcosecurity/falco@9.0.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/falcosecurity-falco-default/receipt.yaml |
| `falcosecurity/falcosidekick@0.13.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/falcosecurity-falcosidekick-default/receipt.yaml |
| `fluent/fluent-bit@0.57.6` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/fluent-fluent-bit-default/receipt.yaml |
| `fluent/fluentd@0.5.3` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/fluent-fluentd-default/receipt.yaml |
| `gatekeeper/gatekeeper@3.22.2` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/gatekeeper-gatekeeper-default/receipt.yaml |
| `gatekeeper/gatekeeper@3.22.2` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/gatekeeper-gatekeeper-no-crds/receipt.yaml |
| `grafana/alloy@1.8.2` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-alloy-default/receipt.yaml |
| `grafana/alloy@1.8.2` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-alloy-no-crds/receipt.yaml |
| `grafana/grafana@10.5.15` | existing-secret-ingress | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-grafana-existing-secret-ingress/receipt.yaml |
| `grafana/grafana@10.5.15` | generated-passwords | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-grafana-generated-passwords/receipt.yaml |
| `grafana/loki@7.0.0` | simple-scalable-minio | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-loki-simple-scalable-minio/receipt.yaml |
| `grafana/loki@7.0.0` | single-binary-filesystem | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-loki-single-binary-filesystem/receipt.yaml |
| `grafana/promtail@6.17.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-promtail-default/receipt.yaml |
| `grafana/pyroscope@2.0.2` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-pyroscope-default/receipt.yaml |
| `grafana/pyroscope@2.0.2` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-pyroscope-no-crds/receipt.yaml |
| `grafana/rollout-operator@0.49.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-rollout-operator-default/receipt.yaml |
| `grafana/rollout-operator@0.49.0` | no-crds | watch | pass | target-runtime: installer-applied workload not ready at observation cutoff (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/grafana-rollout-operator-no-crds/receipt.yaml |
| `grafana/tempo@1.24.4` | local-persistent | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-tempo-local-persistent/receipt.yaml |
| `grafana/tempo@1.24.4` | s3-query-observability | pass | pass |  |  | live parity passed | runs/live-kind-parity/grafana-tempo-s3-query-observability/receipt.yaml |
| `haproxytech/kubernetes-ingress@1.52.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/haproxytech-kubernetes-ingress-default/receipt.yaml |
| `hashicorp/consul@2.0.0` | default-control-plane | pass | pass |  |  | live parity passed | runs/live-kind-parity/hashicorp-consul-default-control-plane/receipt.yaml |
| `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | pass | pass |  |  | live parity passed | runs/live-kind-parity/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml |
| `hashicorp/terraform@1.1.2` | default | blocked | defect | parity: semantic object diff |  | semantic object parity defect | runs/live-kind-parity/hashicorp-terraform-default/receipt.yaml |
| `hashicorp/terraform@1.1.2` | no-crds | blocked | pass | target-prerequisite: required Secret missing (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/hashicorp-terraform-no-crds/receipt.yaml |
| `hashicorp/vault@0.32.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/hashicorp-vault-default/receipt.yaml |
| `hashicorp/vault@0.32.0` | dev-mode | pass | pass |  |  | live parity passed | runs/live-kind-parity/hashicorp-vault-dev-mode/receipt.yaml |
| `hashicorp/vault@0.32.0` | ha-raft-ui | pass | pass |  |  | live parity passed | runs/live-kind-parity/hashicorp-vault-ha-raft-ui/receipt.yaml |
| `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | pass | pass |  |  | live parity passed | runs/live-kind-parity/ingress-nginx-ingress-nginx-admission-disabled/receipt.yaml |
| `ingress-nginx/ingress-nginx@4.15.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/ingress-nginx-ingress-nginx-default/receipt.yaml |
| `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | pass | pass |  |  | live parity passed | runs/live-kind-parity/ingress-nginx-ingress-nginx-internal-clusterip/receipt.yaml |
| `istio/gateway@1.30.0` | controller-default-reviewed | blocked | pass | target-runtime: pods pending (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/istio-gateway-controller-default-reviewed/receipt.yaml |
| `istio/gateway@1.30.0` | default | blocked | pass | target-runtime: pods pending (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/istio-gateway-default/receipt.yaml |
| `jaegertracing/jaeger@4.8.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/jaegertracing-jaeger-default/receipt.yaml |
| `jetstack/cert-manager-csi-driver@v0.14.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/jetstack-cert-manager-csi-driver-default/receipt.yaml |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | pass | pass |  | pass: runs/lifecycle-observations/cert-manager-eso/jetstack-cert-manager-crds-enabled/receipt.yaml | live parity passed | runs/live-kind-parity/jetstack-cert-manager-crds-enabled/receipt.yaml |
| `jetstack/cert-manager@v1.20.2` | default | pass | pass |  | pass: runs/lifecycle-observations/cert-manager-eso/jetstack-cert-manager-default/receipt.yaml | live parity passed | runs/live-kind-parity/jetstack-cert-manager-default/receipt.yaml |
| `jetstack/trust-manager@v0.22.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/jetstack-trust-manager-default/receipt.yaml |
| `jetstack/trust-manager@v0.22.1` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/jetstack-trust-manager-no-crds/receipt.yaml |
| `kedacore/keda@2.19.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/kedacore-keda-default/receipt.yaml |
| `kedacore/keda@2.19.0` | no-crds | watch | pass | target-prerequisite: required Secret missing (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/kedacore-keda-no-crds/receipt.yaml |
| `kyverno/kyverno-policies@3.8.0` | default | watch | pass | watch: object parity passed; readiness needs review |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/kyverno-kyverno-policies-default/receipt.yaml |
| `kyverno/kyverno@3.8.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/kyverno-kyverno-default/receipt.yaml |
| `kyverno/kyverno@3.8.1` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/kyverno-kyverno-no-crds/receipt.yaml |
| `linkerd/linkerd-crds@1.8.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/linkerd-linkerd-crds-default/receipt.yaml |
| `longhorn/longhorn@1.11.2` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/longhorn-longhorn-default/receipt.yaml |
| `longhorn/longhorn@1.11.2` | ui-ingress | pass | pass |  |  | live parity passed | runs/live-kind-parity/longhorn-longhorn-ui-ingress/receipt.yaml |
| `metrics-server/metrics-server@3.13.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/metrics-server-metrics-server-default/receipt.yaml |
| `metrics-server/metrics-server@3.13.0` | external-tls-ca | pass | pass |  |  | live parity passed | runs/live-kind-parity/metrics-server-metrics-server-external-tls-ca/receipt.yaml |
| `minio-operator/tenant@7.1.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/minio-operator-tenant-default/receipt.yaml |
| `nats/nack@0.34.0` | default | blocked | defect | parity: semantic object diff |  | semantic object parity defect | runs/live-kind-parity/nats-nack-default/receipt.yaml |
| `nats/nack@0.34.0` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/nats-nack-no-crds/receipt.yaml |
| `nats/nats@2.14.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/nats-nats-default/receipt.yaml |
| `nats/nats@2.14.0` | ha | blocked | defect | parity: semantic object diff |  | semantic object parity defect | runs/live-kind-parity/nats-nats-ha/receipt.yaml |
| `nats/surveyor@0.20.9` | default | blocked | pass | target-runtime: pod crash loop (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/nats-surveyor-default/receipt.yaml |
| `nats/surveyor@0.20.9` | default-reviewed | blocked | pass | helm-runtime: upstream not ready (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/nats-surveyor-default-reviewed/receipt.yaml |
| `open-telemetry/opentelemetry-operator@0.114.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/open-telemetry-opentelemetry-operator-default/receipt.yaml |
| `open-telemetry/opentelemetry-operator@0.114.0` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/open-telemetry-opentelemetry-operator-no-crds/receipt.yaml |
| `percona/pg-operator@3.0.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/percona-pg-operator-default/receipt.yaml |
| `percona/pg-operator@3.0.0` | no-crds | watch | pass | target-prerequisite: CRDs disabled or missing (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/percona-pg-operator-no-crds/receipt.yaml |
| `percona/psmdb-operator@1.22.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/percona-psmdb-operator-default/receipt.yaml |
| `percona/psmdb-operator@1.22.0` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/percona-psmdb-operator-no-crds/receipt.yaml |
| `percona/pxc-operator@1.19.1` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/percona-pxc-operator-default/receipt.yaml |
| `percona/pxc-operator@1.19.1` | no-crds | watch | pass | helm-runtime: upstream not ready (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/percona-pxc-operator-no-crds/receipt.yaml |
| `prometheus-community/alertmanager@1.37.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-alertmanager-default/receipt.yaml |
| `prometheus-community/alertmanager@1.37.0` | ha | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-alertmanager-ha/receipt.yaml |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-kube-prometheus-stack-default/receipt.yaml |
| `prometheus-community/kube-prometheus-stack@85.3.3` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml |
| `prometheus-community/kube-state-metrics@7.4.0` | cluster-metrics-readonly | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-kube-state-metrics-cluster-metrics-readonly/receipt.yaml |
| `prometheus-community/kube-state-metrics@7.4.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-kube-state-metrics-default/receipt.yaml |
| `prometheus-community/prometheus-adapter@5.3.0` | apiservice-v1-capability | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-prometheus-adapter-apiservice-v1-capability/receipt.yaml |
| `prometheus-community/prometheus-adapter@5.3.0` | cluster-metrics-readonly | blocked | unknown | target-prerequisite: CRDs missing |  | inspect receipt | runs/live-kind-parity/prometheus-community-prometheus-adapter-cluster-metrics-readonly/receipt.yaml |
| `prometheus-community/prometheus-adapter@5.3.0` | default | blocked | unknown | target-prerequisite: CRDs missing |  | inspect receipt | runs/live-kind-parity/prometheus-community-prometheus-adapter-default/receipt.yaml |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | cluster-metrics-readonly | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-prometheus-blackbox-exporter-cluster-metrics-readonly/receipt.yaml |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-prometheus-blackbox-exporter-default/receipt.yaml |
| `prometheus-community/prometheus-node-exporter@4.55.0` | cluster-metrics-readonly | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-prometheus-node-exporter-cluster-metrics-readonly/receipt.yaml |
| `prometheus-community/prometheus-node-exporter@4.55.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-prometheus-node-exporter-default/receipt.yaml |
| `prometheus-community/prometheus-operator-crds@29.0.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-prometheus-operator-crds-default/receipt.yaml |
| `prometheus-community/prometheus@29.8.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-prometheus-default/receipt.yaml |
| `prometheus-community/prometheus@29.8.0` | server-only-ephemeral | pass | pass |  |  | live parity passed | runs/live-kind-parity/prometheus-community-prometheus-server-only-ephemeral/receipt.yaml |
| `sealed-secrets/sealed-secrets@2.18.6` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/sealed-secrets-sealed-secrets-default/receipt.yaml |
| `sealed-secrets/sealed-secrets@2.18.6` | no-crds | pass | pass |  |  | live parity passed | runs/live-kind-parity/sealed-secrets-sealed-secrets-no-crds/receipt.yaml |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/secrets-store-csi-driver-secrets-store-csi-driver-default/receipt.yaml |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | sync-secret-rotation | pass | pass |  |  | live parity passed | runs/live-kind-parity/secrets-store-csi-driver-secrets-store-csi-driver-sync-secret-rotation/receipt.yaml |
| `stakater/reloader@2.2.12` | controller-default-reviewed | pass | pass |  |  | live parity passed | runs/live-kind-parity/stakater-reloader-controller-default-reviewed/receipt.yaml |
| `stakater/reloader@2.2.12` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/stakater-reloader-default/receipt.yaml |
| `strimzi/strimzi-kafka-operator@1.0.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/strimzi-strimzi-kafka-operator-default/receipt.yaml |
| `strimzi/strimzi-kafka-operator@1.0.0` | no-crds | watch | pass | helm-runtime: upstream not ready (parity passed) |  | semantic parity passed; target or lifecycle behavior needs review | runs/live-kind-parity/strimzi-strimzi-kafka-operator-no-crds/receipt.yaml |
| `velero/velero@12.0.1` | default | blocked | unknown | blocked: inspect receipt |  | inspect receipt | runs/live-kind-parity/velero-velero-default/receipt.yaml |
| `velero/velero@12.0.1` | no-crds | blocked | unknown | target-prerequisite: CRDs missing |  | inspect receipt | runs/live-kind-parity/velero-velero-no-crds/receipt.yaml |
| `vm/victoria-metrics-single@0.39.0` | default | pass | pass |  |  | live parity passed | runs/live-kind-parity/vm-victoria-metrics-single-default/receipt.yaml |
| `vm/victoria-metrics-single@0.39.0` | default-reviewed | pass | pass |  |  | live parity passed | runs/live-kind-parity/vm-victoria-metrics-single-default-reviewed/receipt.yaml |
