# Flattening-safety verdicts

Each audited chart version gets one receipted answer to one question: what happens if you ship it as literal rendered YAML instead of running Helm? Findings come from a template-level scan of the pinned chart package (the witnesses directory), joined with the catalog's recorded hook and lifecycle evidence. The verdict schema is schemas/flattening-safety-verdict.schema.json and the model it feeds is docs/reference/certified-bundle-spec.md.

| chart | version | base | lane | verdict |
| --- | --- | --- | --- | --- |
| traefik/traefik | 41.0.2 | default | flatten-with-routes | recipes/traefik/traefik/41.0.2/publication/flattening-safety-verdict.yaml |
| jetstack/cert-manager | v1.21.0 | default | flatten-with-routes | recipes/jetstack/cert-manager/v1.21.0/publication/flattening-safety-verdict.yaml |
| jetstack/cert-manager | v1.21.0 | crds-enabled | flatten-with-routes | recipes/jetstack/cert-manager/v1.21.0/publication/flattening-safety-verdict-crds-enabled.yaml |
| external-secrets/external-secrets | 2.8.0 | default | flatten-with-routes | recipes/external-secrets/external-secrets/2.8.0/publication/flattening-safety-verdict.yaml |
| prometheus-community/kube-prometheus-stack | 87.19.2 | default | do-not-flatten | recipes/prometheus-community/kube-prometheus-stack/87.19.2/publication/flattening-safety-verdict.yaml |
| metrics-server/metrics-server | 3.13.1 | default | safe-to-flatten | recipes/metrics-server/metrics-server/3.13.1/publication/flattening-safety-verdict.yaml |
| kyverno/kyverno | 3.8.1 | default | do-not-flatten | recipes/kyverno/kyverno/3.8.1/publication/flattening-safety-verdict.yaml |
| aws-controllers-k8s/ec2-chart | 1.18.4 | eks-inference | flatten-with-routes | recipes/aws-controllers-k8s/ec2-chart/1.18.4/publication/flattening-safety-verdict.yaml |
| aws-controllers-k8s/iam-chart | 1.7.3 | eks-inference | flatten-with-routes | recipes/aws-controllers-k8s/iam-chart/1.7.3/publication/flattening-safety-verdict.yaml |
| aws-controllers-k8s/eks-chart | 1.16.3 | eks-inference | flatten-with-routes | recipes/aws-controllers-k8s/eks-chart/1.16.3/publication/flattening-safety-verdict.yaml |
| karpenter/karpenter | 1.14.0 | eks-inference | flatten-with-routes | recipes/karpenter/karpenter/1.14.0/publication/flattening-safety-verdict.yaml |
| nvidia/nvidia-device-plugin | 0.19.3 | eks-inference | safe-to-flatten | recipes/nvidia/nvidia-device-plugin/0.19.3/publication/flattening-safety-verdict.yaml |
| aws-controllers-k8s/ec2-chart | 1.18.4 | default | flatten-with-routes | recipes/aws-controllers-k8s/ec2-chart/1.18.4/publication/flattening-safety-verdict-default.yaml |
| aws-controllers-k8s/iam-chart | 1.7.3 | default | flatten-with-routes | recipes/aws-controllers-k8s/iam-chart/1.7.3/publication/flattening-safety-verdict-default.yaml |
| aws-controllers-k8s/eks-chart | 1.16.3 | default | flatten-with-routes | recipes/aws-controllers-k8s/eks-chart/1.16.3/publication/flattening-safety-verdict-default.yaml |
| karpenter/karpenter | 1.14.0 | default | flatten-with-routes | recipes/karpenter/karpenter/1.14.0/publication/flattening-safety-verdict-default.yaml |
| nvidia/nvidia-device-plugin | 0.19.3 | default | safe-to-flatten | recipes/nvidia/nvidia-device-plugin/0.19.3/publication/flattening-safety-verdict-default.yaml |
| karpenter/karpenter | 1.14.0 | crds-managed | safe-to-flatten | recipes/karpenter/karpenter/1.14.0/publication/flattening-safety-verdict-crds-managed.yaml |
| nvidia/nvidia-device-plugin | 0.19.3 | nfd-enabled | flatten-with-routes | recipes/nvidia/nvidia-device-plugin/0.19.3/publication/flattening-safety-verdict-nfd-enabled.yaml |
| bitnami/redis | 27.0.0 | default | do-not-flatten | recipes/bitnami/redis/27.0.0/publication/flattening-safety-verdict.yaml |
| argo-cd/argo-cd | 9.5.15 | default | flatten-with-routes | recipes/argo-cd/argo-cd/9.5.15/publication/flattening-safety-verdict.yaml |
| grafana/grafana | 10.5.15 | default | do-not-flatten | recipes/grafana/grafana/10.5.15/publication/flattening-safety-verdict.yaml |
| grafana/loki | 7.0.0 | default | flatten-with-routes | recipes/grafana/loki/7.0.0/publication/flattening-safety-verdict.yaml |
| grafana/tempo | 1.24.4 | default | safe-to-flatten | recipes/grafana/tempo/1.24.4/publication/flattening-safety-verdict.yaml |
| hashicorp/consul | 2.0.0 | default | do-not-flatten | recipes/hashicorp/consul/2.0.0/publication/flattening-safety-verdict.yaml |
| hashicorp/vault | 0.32.0 | default | safe-to-flatten | recipes/hashicorp/vault/0.32.0/publication/flattening-safety-verdict.yaml |
| ingress-nginx/ingress-nginx | 4.15.1 | default | do-not-flatten | recipes/ingress-nginx/ingress-nginx/4.15.1/publication/flattening-safety-verdict.yaml |
| jetstack/cert-manager | v1.20.2 | default | flatten-with-routes | recipes/jetstack/cert-manager/v1.20.2/publication/flattening-safety-verdict.yaml |
| longhorn/longhorn | 1.11.2 | default | do-not-flatten | recipes/longhorn/longhorn/1.11.2/publication/flattening-safety-verdict.yaml |
| metrics-server/metrics-server | 3.13.0 | default | safe-to-flatten | recipes/metrics-server/metrics-server/3.13.0/publication/flattening-safety-verdict.yaml |
| prometheus-community/kube-prometheus-stack | 85.3.3 | default | do-not-flatten | recipes/prometheus-community/kube-prometheus-stack/85.3.3/publication/flattening-safety-verdict.yaml |
| prometheus-community/prometheus | 29.8.0 | default | safe-to-flatten | recipes/prometheus-community/prometheus/29.8.0/publication/flattening-safety-verdict.yaml |
| secrets-store-csi-driver/secrets-store-csi-driver | 1.6.0 | default | flatten-with-routes | recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/publication/flattening-safety-verdict.yaml |
| bitnami/mongodb | 19.0.7 | default | do-not-flatten | recipes/bitnami/mongodb/19.0.7/publication/flattening-safety-verdict.yaml |
| bitnami/mysql | 14.0.3 | default | do-not-flatten | recipes/bitnami/mysql/14.0.3/publication/flattening-safety-verdict.yaml |
| bitnami/nginx | 24.0.2 | default | do-not-flatten | recipes/bitnami/nginx/24.0.2/publication/flattening-safety-verdict.yaml |
| bitnami/postgresql | 18.6.7 | default | do-not-flatten | recipes/bitnami/postgresql/18.6.7/publication/flattening-safety-verdict.yaml |
| bitnami/rabbitmq | 16.0.14 | default | do-not-flatten | recipes/bitnami/rabbitmq/16.0.14/publication/flattening-safety-verdict.yaml |
| bitnami/redis | 25.5.3 | default | do-not-flatten | recipes/bitnami/redis/25.5.3/publication/flattening-safety-verdict.yaml |
| external-secrets/external-secrets | 2.5.0 | default | flatten-with-routes | recipes/external-secrets/external-secrets/2.5.0/publication/flattening-safety-verdict.yaml |
| gatekeeper/gatekeeper | 3.22.2 | default | flatten-with-routes | recipes/gatekeeper/gatekeeper/3.22.2/publication/flattening-safety-verdict.yaml |
| fluent/fluent-bit | 0.57.6 | default | safe-to-flatten | recipes/fluent/fluent-bit/0.57.6/publication/flattening-safety-verdict.yaml |
| prometheus-community/prometheus-blackbox-exporter | 11.15.1 | default | safe-to-flatten | recipes/prometheus-community/prometheus-blackbox-exporter/11.15.1/publication/flattening-safety-verdict.yaml |
| projectcalico/tigera-operator | v3.32.0 | default | flatten-with-routes | recipes/projectcalico/tigera-operator/v3.32.0/publication/flattening-safety-verdict.yaml |
| autoscaler/cluster-autoscaler | 9.57.0 | default | safe-to-flatten | recipes/autoscaler/cluster-autoscaler/9.57.0/publication/flattening-safety-verdict.yaml |
| coredns/coredns | 1.45.2 | default | safe-to-flatten | recipes/coredns/coredns/1.45.2/publication/flattening-safety-verdict.yaml |
| crossplane-stable/crossplane | 2.3.1 | default | safe-to-flatten | recipes/crossplane-stable/crossplane/2.3.1/publication/flattening-safety-verdict.yaml |
| descheduler/descheduler | 0.36.0 | default | safe-to-flatten | recipes/descheduler/descheduler/0.36.0/publication/flattening-safety-verdict.yaml |
| elastic/filebeat | 8.5.1 | default | safe-to-flatten | recipes/elastic/filebeat/8.5.1/publication/flattening-safety-verdict.yaml |
| elastic/logstash | 8.5.1 | default | safe-to-flatten | recipes/elastic/logstash/8.5.1/publication/flattening-safety-verdict.yaml |
| elastic/metricbeat | 8.5.1 | default | safe-to-flatten | recipes/elastic/metricbeat/8.5.1/publication/flattening-safety-verdict.yaml |
| gitlab/gitlab-runner | 0.89.0 | default | safe-to-flatten | recipes/gitlab/gitlab-runner/0.89.0/publication/flattening-safety-verdict.yaml |
| istio/gateway | 1.30.0 | default | safe-to-flatten | recipes/istio/gateway/1.30.0/publication/flattening-safety-verdict.yaml |
| jetstack/cert-manager-csi-driver | v0.14.0 | default | safe-to-flatten | recipes/jetstack/cert-manager-csi-driver/v0.14.0/publication/flattening-safety-verdict.yaml |
| nats/surveyor | 0.20.9 | default | safe-to-flatten | recipes/nats/surveyor/0.20.9/publication/flattening-safety-verdict.yaml |
| nfs-subdir-external-provisioner/nfs-subdir-external-provisioner | 4.0.18 | default | safe-to-flatten | recipes/nfs-subdir-external-provisioner/nfs-subdir-external-provisioner/4.0.18/publication/flattening-safety-verdict.yaml |
| opencost/opencost | 2.5.21 | default | safe-to-flatten | recipes/opencost/opencost/2.5.21/publication/flattening-safety-verdict.yaml |
| prometheus-community/kube-state-metrics | 7.4.0 | default | safe-to-flatten | recipes/prometheus-community/kube-state-metrics/7.4.0/publication/flattening-safety-verdict.yaml |
| prometheus-community/prometheus-adapter | 5.3.0 | default | safe-to-flatten | recipes/prometheus-community/prometheus-adapter/5.3.0/publication/flattening-safety-verdict.yaml |
| prometheus-community/prometheus-blackbox-exporter | 11.10.0 | default | safe-to-flatten | recipes/prometheus-community/prometheus-blackbox-exporter/11.10.0/publication/flattening-safety-verdict.yaml |
| prometheus-community/prometheus-node-exporter | 4.55.0 | default | safe-to-flatten | recipes/prometheus-community/prometheus-node-exporter/4.55.0/publication/flattening-safety-verdict.yaml |
| prometheus-community/prometheus-pushgateway | 3.6.0 | default | safe-to-flatten | recipes/prometheus-community/prometheus-pushgateway/3.6.0/publication/flattening-safety-verdict.yaml |
| stakater/reloader | 2.2.12 | default | safe-to-flatten | recipes/stakater/reloader/2.2.12/publication/flattening-safety-verdict.yaml |
| stakater/reloader | 2.2.14 | default | safe-to-flatten | recipes/stakater/reloader/2.2.14/publication/flattening-safety-verdict.yaml |
| vm/victoria-metrics-single | 0.39.0 | default | safe-to-flatten | recipes/vm/victoria-metrics-single/0.39.0/publication/flattening-safety-verdict.yaml |
| rook-release/rook-ceph-cluster | v1.19.5 | default | safe-to-flatten | recipes/rook-release/rook-ceph-cluster/v1.19.5/publication/flattening-safety-verdict.yaml |
| grafana/promtail | 6.17.1 | default | safe-to-flatten | recipes/grafana/promtail/6.17.1/publication/flattening-safety-verdict.yaml |
| nats/nats | 2.14.0 | default | safe-to-flatten | recipes/nats/nats/2.14.0/publication/flattening-safety-verdict.yaml |
| minio-operator/tenant | 7.1.1 | default | do-not-flatten | recipes/minio-operator/tenant/7.1.1/publication/flattening-safety-verdict.yaml |
| external-dns/external-dns | 1.21.1 | default | flatten-with-routes | recipes/external-dns/external-dns/1.21.1/publication/flattening-safety-verdict.yaml |
| grafana/alloy | 1.11.0 | default | flatten-with-routes | recipes/grafana/alloy/1.11.0/publication/flattening-safety-verdict.yaml |
| grafana/alloy | 1.8.2 | default | flatten-with-routes | recipes/grafana/alloy/1.8.2/publication/flattening-safety-verdict.yaml |
| linkerd/linkerd-crds | 1.8.0 | default | flatten-with-routes | recipes/linkerd/linkerd-crds/1.8.0/publication/flattening-safety-verdict.yaml |
| minio-operator/operator | 7.1.1 | default | flatten-with-routes | recipes/minio-operator/operator/7.1.1/publication/flattening-safety-verdict.yaml |
| nats/nack | 0.34.0 | default | flatten-with-routes | recipes/nats/nack/0.34.0/publication/flattening-safety-verdict.yaml |
| prometheus-community/prometheus-operator-crds | 29.0.0 | default | flatten-with-routes | recipes/prometheus-community/prometheus-operator-crds/29.0.0/publication/flattening-safety-verdict.yaml |
| strimzi/strimzi-kafka-operator | 1.0.0 | default | flatten-with-routes | recipes/strimzi/strimzi-kafka-operator/1.0.0/publication/flattening-safety-verdict.yaml |
| argo-cd/argo-events | 2.4.21 | default | flatten-with-routes | recipes/argo-cd/argo-events/2.4.21/publication/flattening-safety-verdict.yaml |
| argo-cd/argo-rollouts | 2.40.9 | default | flatten-with-routes | recipes/argo-cd/argo-rollouts/2.40.9/publication/flattening-safety-verdict.yaml |
| argo-cd/argocd-image-updater | 1.2.2 | default | flatten-with-routes | recipes/argo-cd/argocd-image-updater/1.2.2/publication/flattening-safety-verdict.yaml |
| rook-release/rook-ceph | v1.19.5 | default | flatten-with-routes | recipes/rook-release/rook-ceph/v1.19.5/publication/flattening-safety-verdict.yaml |
| policy-reporter/policy-reporter | 3.9.1 | default | safe-to-flatten | recipes/policy-reporter/policy-reporter/3.9.1/publication/flattening-safety-verdict.yaml |
| bitnami/apache | 11.4.29 | default | safe-to-flatten | recipes/bitnami/apache/11.4.29/publication/flattening-safety-verdict.yaml |
| bitnami/elasticsearch | 22.1.6 | default | safe-to-flatten | recipes/bitnami/elasticsearch/22.1.6/publication/flattening-safety-verdict.yaml |
| bitnami/memcached | 8.5.5 | default | safe-to-flatten | recipes/bitnami/memcached/8.5.5/publication/flattening-safety-verdict.yaml |
| bitnami/opensearch | 2.0.10 | default | safe-to-flatten | recipes/bitnami/opensearch/2.0.10/publication/flattening-safety-verdict.yaml |
| bitnami/phpmyadmin | 20.0.0 | default | safe-to-flatten | recipes/bitnami/phpmyadmin/20.0.0/publication/flattening-safety-verdict.yaml |
| bitnami/spark | 10.0.3 | default | safe-to-flatten | recipes/bitnami/spark/10.0.3/publication/flattening-safety-verdict.yaml |
| bitnami/zookeeper | 13.8.7 | default | safe-to-flatten | recipes/bitnami/zookeeper/13.8.7/publication/flattening-safety-verdict.yaml |
| bitnami/contour | 21.1.4 | default | do-not-flatten | recipes/bitnami/contour/21.1.4/publication/flattening-safety-verdict.yaml |

A lane holds for the audited base named in the verdict. The variantScope block records how other values move the finding set; a different base deserves its own verdict, which is why certified bundles key on chart version and recipe variant together.

This lane scans helm.sh/resource-policy at template level, which the catalog's quirk coverage recorded as a missing axis (data/quirk-coverage/coverage.csv). The 74 charts here now have that axis answered from source, across 90 chart-and-base verdicts; the catalog-wide rendered-object scan remains open.

Witnesses are recorded once per pinned package by scripts/scan-flattening-witness.mjs, which needs the chart tarball and so runs outside the verify chain. Every witness hash is checked against the recipe source-lock here. Regenerate with `npm run flattening-safety`. Verify with `npm run flattening-safety:verify`.
