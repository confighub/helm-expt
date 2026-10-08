# Disposition Frontier — distance to the 99% bar

The [next-execution-plan](../../docs/planning/next-execution-plan.md) defines
the 99% target as **every top-100 chart/base/lane cell carrying a verified
disposition** — pass, watch, blocked, refused, or n/a — with `todo` allowed
only as a temporary state that names a next action. "Every cell green" is
explicitly NOT the goal; a correct `blocked` or `n/a` is part of the
product because it tells a user where the proof stops.

This view scores that bar at the cell granularity the master matrix shows,
and for every bare `missing` cell **derives** the honest disposition by
rule (a live lane whose single-cluster local-live row is blocked inherits
the same named prerequisite — it is blocked, not un-dispositioned). It
proposes; it does not mutate `base-outcomes`. Nearest views:
[master-catalog-matrix](../master-catalog-matrix/summary.md) (the cells),
[top100-coverage](../top100-coverage/summary.md) (chart-level coverage).

## Headline

```text
lane cells:                 2064
recorded disposition:       1318  (63.9%)
+ derived blocked:          9
+ derived n/a (K covered):  57
= verified disposition:     1384  (67.1%)
genuine todo (named next):  146
un-dispositioned gap:       534
```

**Distance to 99%:** 680 cells are not yet a
non-todo verified disposition (32.9% of cells).
Every one carries a named next action below — none is a silent gap.

## By lane

| Lane | Cells | Verified disposition | Genuine todo | Un-dispositioned |
| --- | ---: | ---: | ---: | ---: |
| R render_parity | 344 | 344 | 0 | 0 |
| C in_confighub | 344 | 198 | 146 | 0 |
| L local_live | 344 | 199 | 0 | 145 |
| G gitops_oci_live | 344 | 199 | 0 | 145 |
| P live_helm_vs_confighub_parity | 344 | 199 | 0 | 145 |
| K two_cluster_kind_parity | 344 | 245 | 0 | 99 |

## The work to 99%, by next action

Each genuine `todo` cell, grouped by what closes it.

| Cells | Next action |
| --- | --- |
| 1 | run scripts/run-top20-confighub-proof.mjs for argo-cd/argo-cd@10.1.3 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for argo-cd/argo-cd@10.1.3 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for argo-cd/argo-cd@10.2.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for argo-cd/argo-cd@10.2.1 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for argo-cd/argo-cd@10.7.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for argo-cd/argo-cd@10.7.0 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for argo-cd/argo-cd@9.5.17 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for aws-controllers-k8s/ec2-chart@1.18.4 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for aws-controllers-k8s/ec2-chart@1.18.4 eks-inference (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for aws-controllers-k8s/eks-chart@1.16.3 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for aws-controllers-k8s/eks-chart@1.16.3 eks-inference (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for aws-controllers-k8s/iam-chart@1.7.3 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for aws-controllers-k8s/iam-chart@1.7.3 eks-inference (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for aws-ebs-csi-driver/aws-ebs-csi-driver@2.59.0 aicr-eks-training-v0-20-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for aws-ebs-csi-driver/aws-ebs-csi-driver@2.59.0 aicr-eks-training-v1-0-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for aws-ebs-csi-driver/aws-ebs-csi-driver@2.59.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for cloudnative-pg/cloudnative-pg@0.29.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for cloudpirates/nginx@0.16.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for cloudpirates/rabbitmq@0.21.13 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for cloudpirates/rabbitmq@0.21.13 existing-secret (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for cloudpirates/redis@0.34.11 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for cloudpirates/redis@0.34.11 reuse-existing-secret (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for dra-driver-nvidia/dra-driver-nvidia-gpu@0.4.1 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for dra-driver-nvidia/dra-driver-nvidia-gpu@0.4.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for dra-driver-nvidia/dra-driver-nvidia-gpu@0.4.1 gpu-resources (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for dra-driver-nvidia/dra-driver-nvidia-gpu@0.5.0 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for dra-driver-nvidia/dra-driver-nvidia-gpu@0.5.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for dra-driver-nvidia/dra-driver-nvidia-gpu@0.5.0 gpu-resources (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for eks/aws-efa-k8s-device-plugin@v0.5.29 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for eks/aws-efa-k8s-device-plugin@v0.5.29 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for external-secrets/external-secrets@2.10.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for external-secrets/external-secrets@2.10.0 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for external-secrets/external-secrets@2.7.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for external-secrets/external-secrets@2.7.0 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for external-secrets/external-secrets@2.8.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for external-secrets/external-secrets@2.8.0 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for grafana/alloy@1.11.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for grafana/alloy@1.12.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for grafana/loki@7.1.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for grafana/loki@7.3.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for jetstack/cert-manager@v1.21.0 crds-enabled (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for jetstack/cert-manager@v1.21.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for jetstack/cert-manager@v1.21.1 crds-enabled (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for jetstack/cert-manager@v1.21.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for k8s-ephemeral-storage-metrics/k8s-ephemeral-storage-metrics@1.19.2 aicr-eks-training-v0-20-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for k8s-ephemeral-storage-metrics/k8s-ephemeral-storage-metrics@1.19.2 aicr-eks-training-v1-0-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for k8s-ephemeral-storage-metrics/k8s-ephemeral-storage-metrics@1.19.2 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kai-scheduler/kai-scheduler@v0.14.1 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kai-scheduler/kai-scheduler@v0.14.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kai-scheduler/kai-scheduler@v0.16.9 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kai-scheduler/kai-scheduler@v0.16.9 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for karpenter/karpenter@1.14.0 crds-managed (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for karpenter/karpenter@1.14.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for karpenter/karpenter@1.14.0 eks-inference (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kubeflow/kubeflow-trainer@2.2.0 aicr-eks-training-v0-20-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kubeflow/kubeflow-trainer@2.2.0 aicr-eks-training-v1-0-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kubeflow/kubeflow-trainer@2.2.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kyverno/kyverno-policies@3.8.2 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kyverno/kyverno-policies@3.9.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kyverno/kyverno@3.8.2 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for kyverno/kyverno@3.9.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for longhorn/longhorn@1.12.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for longhorn/longhorn@1.12.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for metallb/metallb@0.16.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for metrics-server/metrics-server@3.13.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for metrics-server/metrics-server@3.13.1 external-tls-ca (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for metrics-server/metrics-server@3.14.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for metrics-server/metrics-server@3.14.0 external-tls-ca (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for mysql/mysql-operator@2.3.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for node-feature-discovery/node-feature-discovery@0.19.0 aicr-eks-training-v0-20-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for node-feature-discovery/node-feature-discovery@0.19.0 aicr-eks-training-v1-0-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for node-feature-discovery/node-feature-discovery@0.19.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/cluster-readiness-engine@v0.6.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v25.10.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v25.10.1 driver-580.126.20 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v25.10.1 driver-595.91.07 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v25.10.1 external-nfd (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v25.10.1 preinstalled-driver (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v25.10.1 preinstalled-driver-and-toolkit (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.2 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.2 driver-580.105.08 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.2 driver-595.91.07 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.2 external-nfd (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.2 preinstalled-driver (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.2 preinstalled-driver-and-toolkit (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.3 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.3 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.3 driver-580.105.08 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.3 driver-595.91.07 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.3 external-nfd (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.3 preinstalled-driver (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.3.3 preinstalled-driver-and-toolkit (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.7.1 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.7.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.7.1 driver-580.105.08 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.7.1 driver-580.126.20 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.7.1 external-nfd (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.7.1 preinstalled-driver (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/gpu-operator@v26.7.1 preinstalled-driver-and-toolkit (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/k8s-nim-operator@3.1.0 aicr-eks-inference (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/k8s-nim-operator@3.1.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/k8s-nim-operator@3.1.2 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nodewright@v0.17.1 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nodewright@v0.17.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nodewright@v0.19.0 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nodewright@v0.19.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvidia-device-plugin@0.19.3 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvidia-device-plugin@0.19.3 eks-inference (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvidia-device-plugin@0.19.3 nfd-enabled (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.20.0 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.20.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.20.0 no-pod-monitor (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.25.0 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.25.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.25.0 no-pod-monitor (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.26.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.26.0 no-pod-monitor (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.9.0 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.9.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for nvidia/nvsentinel@v1.9.0 no-pod-monitor (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for oauth2-proxy/oauth2-proxy@10.7.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for percona/psmdb-operator@1.23.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for policy-reporter/policy-reporter@3.10.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for policy-reporter/policy-reporter@3.9.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@84.4.0 aicr-eks-training-v0-20-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@84.4.0 aicr-eks-training-v1-0-0 (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@84.4.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@87.15.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@87.15.1 existing-secret (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@87.15.1 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@87.19.2 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@87.19.2 existing-secret (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@87.19.2 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@88.6.3 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@88.6.3 existing-secret (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/kube-prometheus-stack@88.6.3 no-crds (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/prometheus-blackbox-exporter@11.15.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/prometheus-blackbox-exporter@11.18.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/prometheus-operator-crds@28.0.1 aicr-eks-training (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for prometheus-community/prometheus-operator-crds@28.0.1 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for stakater/reloader@2.2.14 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for stakater/reloader@2.2.16 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for traefik/traefik@41.0.2 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for traefik/traefik@41.4.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for valkey/valkey@0.11.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |
| 1 | run scripts/run-top20-confighub-proof.mjs for velero/velero@12.1.0 default (loop's bitnami/prometheus-community/elastic candidate pipeline) |

## Rules (so the derivation is auditable)

- A recorded `pass`/`watch`/`blocked`/`fail`/`refused`/`n-a` is already a verified disposition.
- A recorded two-cluster K receipt in `data/live-kind-parity/summary.csv` overrides the older aggregate `base-outcomes` K cell.
- The two-cluster **K** lane is **variant-keyed**: `scripts/run-kind-parity.mjs` writes one receipt per chart-variant (`runs/live-kind-parity/<chart>-<base>/`, **no version in the slug**), so only the version that last ran holds the receipt. A bare `missing` K cell whose chart-variant **is** proven on another shipped version is therefore **not** a runnable gap — it is **n/a, covered by that version** (re-running it would overwrite the sibling receipt: net-negative). If every receipt for the variant is itself `blocked`/`fail` (no version has a passing K proof), the cell **inherits blocked** rather than n/a, so a blocked variant is never laundered into a clean n/a. Only a chart-variant with **no** K receipt on any version stays a genuine K `todo`.
- A live lane (G/P/K) on a row whose `local_live` is **blocked** -> derived **blocked**, same named prerequisite (you cannot make a multi-cluster or GitOps live claim when one cluster will not converge).
- A live lane on a row whose `local_live` **failed** -> derived **blocked** on the upstream failure.
- A live lane on a row whose `local_live` **passes** -> genuine **todo**, runnable now, with the lane's run command as the next action.
- `in_confighub` missing -> **todo**, owner loop (the bitnami/prometheus-community/elastic candidate pipeline).

## Regenerate

~~~sh
npm run disposition-frontier
npm run disposition-frontier:verify
~~~
