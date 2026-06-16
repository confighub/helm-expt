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
| Variants needing at least one live command | 89 |
| Live commands remaining | 133 |
| GitOps/OCI + live Helm-vs-ConfigHub commands | 57 |
| Two-cluster kind parity commands | 76 |
| Watch/blocked/review rows | 95 |
| Ready-to-run todo rows | 38 |

## By Work Type

| Work type | Rows |
| --- | ---: |
| `kind-parity` | 76 |
| `live-parity` | 57 |

## By Current Status

| Status | Rows |
| --- | ---: |
| `blocked` | 30 |
| `todo` | 58 |
| `watch` | 45 |

## By Run Readiness

| Readiness | Rows |
| --- | ---: |
| `inspect-diff-first` | 7 |
| `inspect-receipt-first` | 2 |
| `model-or-stage-first` | 51 |
| `ready-to-run` | 38 |
| `review-target-first` | 35 |

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
| live-parity | aws-ebs-csi-driver/aws-ebs-csi-driver | 2.60.1 | default | G=watch;P=watch | target-fit: AWS/EKS metadata or provider identity missing on vanilla kind (parity passed) | [recipes/aws-ebs-csi-driver/aws-ebs-csi-driver/2.60.1/target-topology.yaml](../../recipes/aws-ebs-csi-driver/aws-ebs-csi-driver/2.60.1/target-topology.yaml) | [runs/live-helm-confighub-compare/aws-ebs-csi-driver-aws-ebs-csi-driver-default/receipt.yaml](../../runs/live-helm-confighub-compare/aws-ebs-csi-driver-aws-ebs-csi-driver-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/aws-ebs-csi-driver/aws-ebs-csi-driver/2.60.1 --base default |
| live-parity | bitnami/apache | 11.4.29 | default | G=watch;P=watch | remote-image: image pull failed or pinned image is unavailable (parity passed) | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) | [runs/live-helm-confighub-compare/bitnami-apache-default/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-apache-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/apache/11.4.29 --base default --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/contour | 21.1.4 | default | G=watch;P=watch | remote-image: image pull failed or pinned image is unavailable (parity passed) | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) | [runs/live-helm-confighub-compare/bitnami-contour-default/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-contour-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/contour/21.1.4 --base default --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/contour | 21.1.4 | no-crds | G=watch;P=watch | remote-image: image pull failed or pinned image is unavailable (parity passed) | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) | [runs/live-helm-confighub-compare/bitnami-contour-no-crds/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-contour-no-crds/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/contour/21.1.4 --base no-crds --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/elasticsearch | 22.1.6 | default | G=watch;P=watch | remote-image: image pull failed or pinned image is unavailable (parity passed) | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) | [runs/live-helm-confighub-compare/bitnami-elasticsearch-default/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-elasticsearch-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/elasticsearch/22.1.6 --base default --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/mongodb | 19.0.9 | existing-secret-replicaset | G=watch;P=watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml](../../recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-0-9/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-0-9/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/mongodb/19.0.9 --base existing-secret-replicaset --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/mongodb | 19.1.0 | existing-secret-replicaset | G=watch;P=watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml](../../recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-1-0/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-mongodb-existing-secret-replicaset-19-1-0/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/mongodb/19.1.0 --base existing-secret-replicaset --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/nginx | 24.0.4 | existing-tls-ingress | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/bitnami/nginx/24.0.4/gitops-runtime-review.yaml](../../recipes/bitnami/nginx/24.0.4/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-nginx-existing-tls-ingress-24-0-4/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-nginx-existing-tls-ingress-24-0-4/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/nginx/24.0.4 --base existing-tls-ingress --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/nginx | 25.0.0 | existing-tls-ingress | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/bitnami/nginx/25.0.0/gitops-runtime-review.yaml](../../recipes/bitnami/nginx/25.0.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/bitnami-nginx-existing-tls-ingress-25-0-0/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-nginx-existing-tls-ingress-25-0-0/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/nginx/25.0.0 --base existing-tls-ingress --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/opensearch | 2.0.10 | default | G=watch;P=watch | remote-image: image pull failed or pinned image is unavailable (parity passed) | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) | [runs/live-helm-confighub-compare/bitnami-opensearch-default/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-opensearch-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/opensearch/2.0.10 --base default --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/opensearch | 2.0.10 | ha | G=watch;P=watch | remote-image: image pull failed or pinned image is unavailable (parity passed) | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) | [runs/live-helm-confighub-compare/bitnami-opensearch-ha/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-opensearch-ha/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/opensearch/2.0.10 --base ha --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | bitnami/phpmyadmin | 20.0.0 | default | G=watch;P=watch | remote-image: image pull failed or pinned image is unavailable (parity passed) | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) | [runs/live-helm-confighub-compare/bitnami-phpmyadmin-default/receipt.yaml](../../runs/live-helm-confighub-compare/bitnami-phpmyadmin-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/bitnami/phpmyadmin/20.0.0 --base default --repo-url oci://registry-1.docker.io/bitnamicharts |
| live-parity | elastic/filebeat | 8.5.1 | default | G=watch;P=watch | target-runtime: pod ContainerCreating (parity passed) | [recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml](../../recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml) | [runs/live-helm-confighub-compare/elastic-filebeat-default/receipt.yaml](../../runs/live-helm-confighub-compare/elastic-filebeat-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/elastic/filebeat/8.5.1 --base default |
| live-parity | elastic/filebeat | 8.5.1 | node-or-cluster-collector | G=watch;P=watch | target-runtime: pod ContainerCreating (parity passed) | [recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml](../../recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml) | [runs/live-helm-confighub-compare/elastic-filebeat-node-or-cluster-collector/receipt.yaml](../../runs/live-helm-confighub-compare/elastic-filebeat-node-or-cluster-collector/receipt.yaml) | npm run live-parity:run -- --recipe recipes/elastic/filebeat/8.5.1 --base node-or-cluster-collector |
| live-parity | fluent/fluentd | 0.5.3 | default | G=watch;P=watch | target-runtime: pod config/runtime errors (parity passed) | [recipes/fluent/fluentd/0.5.3/runtime-review.yaml](../../recipes/fluent/fluentd/0.5.3/runtime-review.yaml) | [runs/live-helm-confighub-compare/fluent-fluentd-default/receipt.yaml](../../runs/live-helm-confighub-compare/fluent-fluentd-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/fluent/fluentd/0.5.3 --base default |
| live-parity | grafana/pyroscope | 2.0.2 | default | G=watch;P=watch | target-runtime: ConfigHub workload not ready (parity passed) | [recipes/grafana/pyroscope/2.0.2/runtime-review.yaml](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) | [runs/live-helm-confighub-compare/grafana-pyroscope-default/receipt.yaml](../../runs/live-helm-confighub-compare/grafana-pyroscope-default/receipt.yaml) | npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base default |
| live-parity | grafana/pyroscope | 2.0.2 | no-crds | G=watch;P=watch | target-runtime: ConfigHub workload not ready (parity passed) | [recipes/grafana/pyroscope/2.0.2/runtime-review.yaml](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) | [runs/live-helm-confighub-compare/grafana-pyroscope-no-crds/receipt.yaml](../../runs/live-helm-confighub-compare/grafana-pyroscope-no-crds/receipt.yaml) | npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base no-crds |
| live-parity | grafana/tempo | 1.24.4 | s3-query-observability | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml](../../recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/grafana-tempo-s3-query-observability/receipt.yaml](../../runs/live-helm-confighub-compare/grafana-tempo-s3-query-observability/receipt.yaml) | npm run live-parity:run -- --recipe recipes/grafana/tempo/1.24.4 --base s3-query-observability |
| live-parity | hashicorp/consul | 2.0.0 | secure-mesh-existing-secrets | G=watch;P=watch | gitops-runtime: Argo health Progressing (parity passed) | [recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml](../../recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml) | [runs/live-helm-confighub-compare/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml](../../runs/live-helm-confighub-compare/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml) | npm run live-parity:run -- --recipe recipes/hashicorp/consul/2.0.0 --base secure-mesh-existing-secrets --target-profile kind-three-node |

## Next Ready Live-Parity Commands

These are the first non-watch GitOps/OCI + live Helm-vs-ConfigHub rows by the
generated priority. They are good candidates for a serial live block.

| Chart | Version | Base | Catalog Tier | Lane Cells | Command |
| --- | --- | --- | --- | --- | --- |
| bitnami/elasticsearch | 22.1.6 | ha | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/elasticsearch/22.1.6 --base ha |
| bitnami/spark | 10.0.3 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/spark/10.0.3 --base default |
| bitnami/spark | 10.0.3 | ha | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/spark/10.0.3 --base ha |
| bitnami/zookeeper | 13.8.7 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/zookeeper/13.8.7 --base default |
| bitnami/zookeeper | 13.8.7 | ha | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/bitnami/zookeeper/13.8.7 --base ha |
| dex/dex | 0.24.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/dex/dex/0.24.0 --base default |
| elastic/kibana | 8.5.1 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/elastic/kibana/8.5.1 --base default |
| elastic/metricbeat | 8.5.1 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/elastic/metricbeat/8.5.1 --base default |
| gitlab/gitlab-runner | 0.89.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/gitlab/gitlab-runner/0.89.0 --base default |
| grafana/pyroscope | 2.0.2 | ha | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base ha |
| istio/istiod | 1.30.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/istio/istiod/1.30.0 --base default |
| nfs-subdir-external-provisioner/nfs-subdir-external-provisioner | 4.0.18 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/nfs-subdir-external-provisioner/nfs-subdir-external-provisioner/4.0.18 --base default |
| opencost/opencost | 2.5.21 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/opencost/opencost/2.5.21 --base default |
| projectcalico/tigera-operator | v3.32.0 | default | next80-proof-grade | G=todo;P=todo | npm run live-parity:run -- --recipe recipes/projectcalico/tigera-operator/v3.32.0 --base default |

## Full Queue

The complete queue is [work-items.csv](work-items.csv). Each row is one command,
not one colored cell. A `live-parity` row exercises both G and P in the master
matrix. A `kind-parity` row exercises K.
