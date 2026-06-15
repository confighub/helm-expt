# Live Matrix Burn-Down

This generated queue answers a narrow operational question: how many live
commands remain before the live columns in the master matrix are green or
explicitly watch/blocked?

It uses [../master-catalog-matrix/matrix.csv](../master-catalog-matrix/matrix.csv)
as its spine and [../live-parity-rerun-plan/rerun-plan.csv](../live-parity-rerun-plan/rerun-plan.csv)
for active watch-row details. It does not create evidence, change any status,
or run Kubernetes. Run live commands serially.

Do not compare this command count directly with the 99% cell frontier. This
page is an execution queue: watch/review rows stay visible until reviewed, and
one `live-parity` command covers both the G and P cells in the master matrix.
For the cell-level completion count, use
[../disposition-frontier/summary.md](../disposition-frontier/summary.md).

## Current Count

| Metric | Rows |
| --- | ---: |
| Matrix variant rows | 192 |
| Variants needing at least one live command | 107 |
| Live commands remaining | 159 |
| GitOps/OCI + live Helm-vs-ConfigHub commands | 61 |
| Two-cluster kind parity commands | 98 |
| Watch/blocked/review rows | 44 |
| Ready-to-run todo rows | 115 |

## By Work Type

| Work type | Rows |
| --- | ---: |
| `kind-parity` | 98 |
| `live-parity` | 61 |

## By Current Status

| Status | Rows |
| --- | ---: |
| `blocked` | 3 |
| `todo` | 135 |
| `watch` | 21 |

## By Run Readiness

| Readiness | Rows |
| --- | ---: |
| `inspect-receipt-first` | 2 |
| `model-or-stage-first` | 24 |
| `ready-to-run` | 115 |
| `review-target-first` | 18 |

Rows marked `model-or-stage-first` are not safe copy-paste commands yet. For
example, a two-cluster kind row may need a versioned receipt path before rerun
so it does not overwrite an existing receipt for a different chart version.

## Active Watch Or Blocked Rows

These rows already have live evidence. Review the support artifact before
rerunning; do not turn them green unless the new receipt proves the stronger
claim.

| Work Type | Chart | Version | Base | Lane Cells | Reason | Support Artifact | Receipt | Command |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| live-parity | argo-cd/argo-cd | 9.5.17 | default | G=watch;P=watch | gitops-runtime: child Argo Application not materialized (parity passed) | [recipes/argo-cd/argo-cd/9.5.17/gitops-runtime-review.yaml](../../recipes/argo-cd/argo-cd/9.5.17/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/argo-cd-argo-cd-default-9-5-17/receipt.yaml](../../runs/live-helm-confighub-compare/argo-cd-argo-cd-default-9-5-17/receipt.yaml) | npm run live-parity:run -- --recipe recipes/argo-cd/argo-cd/9.5.17 --base default |
| live-parity | bitnami/mongodb | 19.0.9 | existing-secret-replicaset | G=watch;P=watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml](../../recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-0-9/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-0-9/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/mongodb/19.0.9 --base existing-secret-replicaset --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/mongodb | 19.1.0 | existing-secret-replicaset | G=watch;P=watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml](../../recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-1-0/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-1-0/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/mongodb/19.1.0 --base existing-secret-replicaset --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/nginx | 24.0.4 | existing-tls-ingress | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/bitnami/nginx/24.0.4/gitops-runtime-review.yaml](../../recipes/bitnami/nginx/24.0.4/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-nginx-existing-tls-ingress-24-0-4/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-nginx-existing-tls-ingress-24-0-4/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/nginx/24.0.4 --base existing-tls-ingress --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/nginx | 25.0.0 | existing-tls-ingress | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/bitnami/nginx/25.0.0/gitops-runtime-review.yaml](../../recipes/bitnami/nginx/25.0.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-nginx-existing-tls-ingress-25-0-0/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-nginx-existing-tls-ingress-25-0-0/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/nginx/25.0.0 --base existing-tls-ingress --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | fluent/fluentd | 0.5.3 | default | G=watch;P=watch | target-runtime: pod config/runtime errors (parity passed) | [recipes/fluent/fluentd/0.5.3/runtime-review.yaml](../../recipes/fluent/fluentd/0.5.3/runtime-review.yaml) | [runs/live-helm-confighub-compare/fluent-fluentd-default/receipt.yaml](../../runs/live-helm-confighub-compare/fluent-fluentd-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/fluent/fluentd/0.5.3 --base default |
| live-parity | grafana/pyroscope | 2.0.2 | default | G=watch;P=watch | target-runtime: ConfigHub workload not ready (parity passed) | [recipes/grafana/pyroscope/2.0.2/runtime-review.yaml](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) | [runs/live-helm-confighub-compare/grafana-pyroscope-default/receipt.yaml](../../runs/live-helm-confighub-compare/grafana-pyroscope-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base default |
| live-parity | grafana/pyroscope | 2.0.2 | no-crds | G=watch;P=watch | target-runtime: ConfigHub workload not ready (parity passed) | [recipes/grafana/pyroscope/2.0.2/runtime-review.yaml](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) | [runs/live-helm-confighub-compare/grafana-pyroscope-no-crds/receipt.yaml](../../runs/live-helm-confighub-compare/grafana-pyroscope-no-crds/receipt.yaml) | npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base no-crds |
| live-parity | grafana/tempo | 1.24.4 | s3-query-observability | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml](../../recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/grafana-tempo-s3-query-observability/receipt.yaml](../../runs/live-helm-confighub-compare/grafana-tempo-s3-query-observability/receipt.yaml) | npm run live-parity:run -- --recipe recipes/grafana/tempo/1.24.4 --base s3-query-observability |
| live-parity | hashicorp/consul | 2.0.0 | secure-mesh-existing-secrets | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml](../../recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml](../../runs/live-helm-confighub-compare/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml) | npm run live-parity:run -- --recipe recipes/hashicorp/consul/2.0.0 --base secure-mesh-existing-secrets --target-profile kind-three-node |
| live-parity | hashicorp/vault | 0.32.0 | ha-raft-ui | G=watch;P=watch | operate-policy: Vault init/unseal readiness (parity passed) | [recipes/hashicorp/vault/0.32.0/operating-policy.yaml](../../recipes/hashicorp/vault/0.32.0/operating-policy.yaml) | [runs/live-helm-confighub-compare/hashicorp-vault-ha-raft-ui/receipt.yaml](../../runs/live-helm-confighub-compare/hashicorp-vault-ha-raft-ui/receipt.yaml) | npm run live-parity:run -- --recipe recipes/hashicorp/vault/0.32.0 --base ha-raft-ui |
| live-parity | kyverno/kyverno-policies | 3.8.0 | default | G=watch;P=watch | gitops-runtime: ClusterPolicy OutOfSync health Healthy (parity passed) | [recipes/kyverno/kyverno-policies/3.8.0/gitops-runtime-review.yaml](../../recipes/kyverno/kyverno-policies/3.8.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/kyverno-kyverno-policies-default/receipt.yaml](../../runs/live-helm-confighub-compare/kyverno-kyverno-policies-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/kyverno/kyverno-policies/3.8.0 --base default |
| live-parity | linkerd/linkerd-crds | 1.8.0 | default | G=watch;P=watch | gitops-runtime: CustomResourceDefinition OutOfSync health Healthy (parity passed) | [recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml](../../recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/linkerd-linkerd-crds-default/receipt.yaml](../../runs/live-helm-confighub-compare/linkerd-linkerd-crds-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/linkerd/linkerd-crds/1.8.0 --base default |
| live-parity | minio-operator/tenant | 7.1.1 | default | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/minio-operator/tenant/7.1.1/gitops-runtime-review.yaml](../../recipes/minio-operator/tenant/7.1.1/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/minio-operator-tenant-default/receipt.yaml](../../runs/live-helm-confighub-compare/minio-operator-tenant-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/minio-operator/tenant/7.1.1 --base default |
| live-parity | open-telemetry/opentelemetry-operator | 0.114.0 | default | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml](../../recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/open-telemetry-opentelemetry-operator-default/receipt.yaml](../../runs/live-helm-confighub-compare/open-telemetry-opentelemetry-operator-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/open-telemetry/opentelemetry-operator/0.114.0 --base default |
| live-parity | prometheus-community/prometheus | 29.9.0 | default | G=watch;P=watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml](../../recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/prometheus-community-prometheus-default-29-9-0/receipt.yaml](../../runs/live-helm-confighub-compare/prometheus-community-prometheus-default-29-9-0/receipt.yaml) | npm run live-parity:run -- --recipe recipes/prometheus-community/prometheus/29.9.0 --base default |
| live-parity | traefik/traefik | 40.2.0 | no-crds | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml](../../recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/traefik-traefik-no-crds/receipt.yaml](../../runs/live-helm-confighub-compare/traefik-traefik-no-crds/receipt.yaml) | npm run live-parity:run -- --recipe recipes/traefik/traefik/40.2.0 --base no-crds |
| kind-parity | autoscaler/cluster-autoscaler | 9.57.0 | default | K=watch | two-cluster kind parity watch row needs review | [runs/live-kind-parity/autoscaler-cluster-autoscaler-default/receipt.yaml](../../runs/live-kind-parity/autoscaler-cluster-autoscaler-default/receipt.yaml) | [runs/live-kind-parity/autoscaler-cluster-autoscaler-default/receipt.yaml](../../runs/live-kind-parity/autoscaler-cluster-autoscaler-default/receipt.yaml) | npm run kind-parity:run -- --recipe recipes/autoscaler/cluster-autoscaler/9.57.0 --base default |
| kind-parity | fairwinds-stable/vpa | 4.11.0 | default | K=watch | target-runtime: pod crash loop (parity passed) | [runs/live-kind-parity/fairwinds-stable-vpa-default/receipt.yaml](../../runs/live-kind-parity/fairwinds-stable-vpa-default/receipt.yaml) | [runs/live-kind-parity/fairwinds-stable-vpa-default/receipt.yaml](../../runs/live-kind-parity/fairwinds-stable-vpa-default/receipt.yaml) | npm run kind-parity:run -- --recipe recipes/fairwinds-stable/vpa/4.11.0 --base default |
| kind-parity | fairwinds-stable/vpa | 4.11.0 | no-crds | K=watch | target-prerequisite: CRDs disabled or missing (parity passed) | [runs/live-kind-parity/fairwinds-stable-vpa-no-crds/receipt.yaml](../../runs/live-kind-parity/fairwinds-stable-vpa-no-crds/receipt.yaml) | [runs/live-kind-parity/fairwinds-stable-vpa-no-crds/receipt.yaml](../../runs/live-kind-parity/fairwinds-stable-vpa-no-crds/receipt.yaml) | npm run kind-parity:run -- --recipe recipes/fairwinds-stable/vpa/4.11.0 --base no-crds |

## Next Ready Live-Parity Commands

These are the first non-watch GitOps/OCI + live Helm-vs-ConfigHub rows by the
generated priority. They are good candidates for a serial live block.

| Chart | Version | Base | Catalog Tier | Lane Cells | Command |
| --- | --- | --- | --- | --- | --- |
| argo-cd/argo-workflows | 1.0.14 | controller-default-reviewed | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/argo-cd/argo-workflows/1.0.14 --base controller-default-reviewed |
| argo-cd/argo-workflows | 1.0.14 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/argo-cd/argo-workflows/1.0.14 --base default |
| bitnami/opensearch | 2.0.10 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/opensearch/2.0.10 --base default |
| bitnami/opensearch | 2.0.10 | ha | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/opensearch/2.0.10 --base ha |
| elastic/filebeat | 8.5.1 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/elastic/filebeat/8.5.1 --base default |
| elastic/filebeat | 8.5.1 | node-or-cluster-collector | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/elastic/filebeat/8.5.1 --base node-or-cluster-collector |
| grafana/rollout-operator | 0.49.0 | no-crds | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/grafana/rollout-operator/0.49.0 --base no-crds |
| hashicorp/terraform | 1.1.2 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/hashicorp/terraform/1.1.2 --base default |
| hashicorp/terraform | 1.1.2 | no-crds | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/hashicorp/terraform/1.1.2 --base no-crds |
| istio/gateway | 1.30.0 | controller-default-reviewed | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/istio/gateway/1.30.0 --base controller-default-reviewed |
| istio/gateway | 1.30.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/istio/gateway/1.30.0 --base default |
| jaegertracing/jaeger-operator | 2.57.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/jaegertracing/jaeger-operator/2.57.0 --base default |
| jaegertracing/jaeger-operator | 2.57.0 | no-crds | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/jaegertracing/jaeger-operator/2.57.0 --base no-crds |
| jetstack/trust-manager | v0.22.1 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/jetstack/trust-manager/v0.22.1 --base default |
| jetstack/trust-manager | v0.22.1 | no-crds | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/jetstack/trust-manager/v0.22.1 --base no-crds |
| nats/surveyor | 0.20.9 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/nats/surveyor/0.20.9 --base default |
| nats/surveyor | 0.20.9 | default-reviewed | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/nats/surveyor/0.20.9 --base default-reviewed |
| open-telemetry/opentelemetry-operator | 0.114.0 | no-crds | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/open-telemetry/opentelemetry-operator/0.114.0 --base no-crds |
| strimzi/strimzi-kafka-operator | 1.0.0 | no-crds | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/strimzi/strimzi-kafka-operator/1.0.0 --base no-crds |
| velero/velero | 12.0.1 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/velero/velero/12.0.1 --base default |

## Full Queue

The complete queue is [work-items.csv](work-items.csv). Each row is one command,
not one colored cell. A `live-parity` row exercises both G and P in the master
matrix. A `kind-parity` row exercises K.
