# Live Matrix Burn-Down

This generated queue answers a narrow operational question: how many live
commands remain before the live columns in the master matrix are green or
explicitly watch/blocked?

It uses [../master-catalog-matrix/matrix.csv](../master-catalog-matrix/matrix.csv)
as its spine and [../live-parity-rerun-plan/rerun-plan.csv](../live-parity-rerun-plan/rerun-plan.csv)
for active watch-row details. It does not create evidence, change any status,
or run Kubernetes. Run live commands serially.

## Current Count

| Metric | Rows |
| --- | ---: |
| Matrix variant rows | 192 |
| Variants needing at least one live command | 125 |
| Live commands remaining | 208 |
| GitOps/OCI + live Helm-vs-ConfigHub commands | 89 |
| Two-cluster kind parity commands | 119 |
| Watch/review rows | 12 |
| Ready-to-run todo rows | 196 |

## By Work Type

| Work type | Rows |
| --- | ---: |
| `kind-parity` | 119 |
| `live-parity` | 89 |

## By Current Status

| Status | Rows |
| --- | ---: |
| `todo` | 196 |
| `watch` | 12 |

## By Run Readiness

| Readiness | Rows |
| --- | ---: |
| `model-or-stage-first` | 1 |
| `ready-to-run` | 196 |
| `review-target-first` | 11 |

## Active Watch Rows

These rows already have live evidence. Review the support artifact before
rerunning; do not turn them green unless the new receipt proves the stronger
claim.

| Work Type | Chart | Version | Base | Lane Cells | Reason | Support Artifact | Receipt | Command |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| live-parity | argo-cd/argo-cd | 9.5.17 | default | G=watch;P=watch | gitops-runtime: child Argo Application not materialized (parity passed) | [recipes/argo-cd/argo-cd/9.5.17/gitops-runtime-review.yaml](../../recipes/argo-cd/argo-cd/9.5.17/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/argo-cd-argo-cd-default-9-5-17/receipt.yaml](../../runs/live-helm-confighub-compare/argo-cd-argo-cd-default-9-5-17/receipt.yaml) | npm run live-parity:run -- --recipe recipes/argo-cd/argo-cd/9.5.17 --base default |
| live-parity | bitnami/mongodb | 19.0.9 | existing-secret-replicaset | G=watch;P=watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml](../../recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-0-9/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-0-9/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/mongodb/19.0.9 --base existing-secret-replicaset --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/mongodb | 19.1.0 | existing-secret-replicaset | G=watch;P=watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml](../../recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-1-0/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-1-0/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/mongodb/19.1.0 --base existing-secret-replicaset --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | grafana/pyroscope | 2.0.2 | default | G=watch;P=watch | target-runtime: ConfigHub workload not ready (parity passed) | [recipes/grafana/pyroscope/2.0.2/runtime-review.yaml](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) | [runs/live-helm-confighub-compare/grafana-pyroscope-default/receipt.yaml](../../runs/live-helm-confighub-compare/grafana-pyroscope-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base default |
| live-parity | grafana/tempo | 1.24.4 | s3-query-observability | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml](../../recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/grafana-tempo-s3-query-observability/receipt.yaml](../../runs/live-helm-confighub-compare/grafana-tempo-s3-query-observability/receipt.yaml) | npm run live-parity:run -- --recipe recipes/grafana/tempo/1.24.4 --base s3-query-observability |
| live-parity | hashicorp/consul | 2.0.0 | secure-mesh-existing-secrets | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml](../../recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml](../../runs/live-helm-confighub-compare/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml) | npm run live-parity:run -- --recipe recipes/hashicorp/consul/2.0.0 --base secure-mesh-existing-secrets --target-profile kind-three-node |
| live-parity | hashicorp/vault | 0.32.0 | ha-raft-ui | G=watch;P=watch | operate-policy: Vault init/unseal readiness (parity passed) | [recipes/hashicorp/vault/0.32.0/operating-policy.yaml](../../recipes/hashicorp/vault/0.32.0/operating-policy.yaml) | [runs/live-helm-confighub-compare/hashicorp-vault-ha-raft-ui/receipt.yaml](../../runs/live-helm-confighub-compare/hashicorp-vault-ha-raft-ui/receipt.yaml) | npm run live-parity:run -- --recipe recipes/hashicorp/vault/0.32.0 --base ha-raft-ui |
| live-parity | linkerd/linkerd-crds | 1.8.0 | default | G=watch;P=watch | gitops-runtime: CustomResourceDefinition OutOfSync health Healthy (parity passed) | [recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml](../../recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/linkerd-linkerd-crds-default/receipt.yaml](../../runs/live-helm-confighub-compare/linkerd-linkerd-crds-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/linkerd/linkerd-crds/1.8.0 --base default |
| live-parity | open-telemetry/opentelemetry-operator | 0.114.0 | default | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml](../../recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/open-telemetry-opentelemetry-operator-default/receipt.yaml](../../runs/live-helm-confighub-compare/open-telemetry-opentelemetry-operator-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/open-telemetry/opentelemetry-operator/0.114.0 --base default |
| live-parity | prometheus-community/prometheus | 29.9.0 | default | G=watch;P=watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml](../../recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/prometheus-community-prometheus-default-29-9-0/receipt.yaml](../../runs/live-helm-confighub-compare/prometheus-community-prometheus-default-29-9-0/receipt.yaml) | npm run live-parity:run -- --recipe recipes/prometheus-community/prometheus/29.9.0 --base default |
| live-parity | traefik/traefik | 40.2.0 | no-crds | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml](../../recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/traefik-traefik-no-crds/receipt.yaml](../../runs/live-helm-confighub-compare/traefik-traefik-no-crds/receipt.yaml) | npm run live-parity:run -- --recipe recipes/traefik/traefik/40.2.0 --base no-crds |
| kind-parity | autoscaler/cluster-autoscaler | 9.57.0 | default | K=watch | two-cluster kind parity watch row needs review |  |  | npm run kind-parity:run -- --recipe recipes/autoscaler/cluster-autoscaler/9.57.0 --base default |

## Next Ready Live-Parity Commands

These are the first non-watch GitOps/OCI + live Helm-vs-ConfigHub rows by the
generated priority. They are good candidates for a serial live block.

| Chart | Version | Base | Catalog Tier | Lane Cells | Command |
| --- | --- | --- | --- | --- | --- |
| bitnami/mongodb | 19.1.0 | generated-passwords | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/mongodb/19.1.0 --base generated-passwords |
| bitnami/nginx | 24.0.4 | existing-tls-ingress | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/nginx/24.0.4 --base existing-tls-ingress |
| bitnami/nginx | 24.0.4 | http-clusterip | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/nginx/24.0.4 --base http-clusterip |
| bitnami/nginx | 25.0.0 | existing-tls-ingress | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/nginx/25.0.0 --base existing-tls-ingress |
| bitnami/nginx | 25.0.0 | http-clusterip | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/nginx/25.0.0 --base http-clusterip |
| bitnami/postgresql | 18.6.10 | existing-secret | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/postgresql/18.6.10 --base existing-secret |
| bitnami/postgresql | 18.6.10 | generated-passwords | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/postgresql/18.6.10 --base generated-passwords |
| bitnami/postgresql | 18.7.0 | existing-secret | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/postgresql/18.7.0 --base existing-secret |
| bitnami/postgresql | 18.7.0 | generated-passwords | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/postgresql/18.7.0 --base generated-passwords |
| bitnami/redis | 27.0.0 | default | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/redis/27.0.0 --base default |
| bitnami/redis | 27.0.0 | reuse-existing-secret | uncategorized | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/redis/27.0.0 --base reuse-existing-secret |
| falcosecurity/falco | 9.0.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/falcosecurity/falco/9.0.0 --base default |
| falcosecurity/falcosidekick | 0.13.1 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/falcosecurity/falcosidekick/0.13.1 --base default |
| fluent/fluentd | 0.5.3 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/fluent/fluentd/0.5.3 --base default |
| grafana/pyroscope | 2.0.2 | no-crds | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base no-crds |
| grafana/rollout-operator | 0.49.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/grafana/rollout-operator/0.49.0 --base default |
| haproxytech/kubernetes-ingress | 1.52.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/haproxytech/kubernetes-ingress/1.52.0 --base default |
| jaegertracing/jaeger | 4.8.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/jaegertracing/jaeger/4.8.0 --base default |
| jetstack/cert-manager-csi-driver | v0.14.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/jetstack/cert-manager-csi-driver/v0.14.0 --base default |
| kyverno/kyverno-policies | 3.8.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/kyverno/kyverno-policies/3.8.0 --base default |

## Full Queue

The complete queue is [work-items.csv](work-items.csv). Each row is one command,
not one colored cell. A `live-parity` row exercises both G and P in the master
matrix. A `kind-parity` row exercises K.
