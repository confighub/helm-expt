# AICR v0.19.0 nested source processing

The parent AICR entry contains 17 literal Argo CD Applications. One is the root
Application. The other 16 name sources that Argo CD processes later. This table
makes that second boundary explicit.

A successful row binds the fetched chart archive or local chart tree, retained
values, and rendered object set with separate SHA-256 digests. It does not prove
that lifecycle work ran or that a controller reconciled the objects on EKS.

- Local renders captured: **16/16**.
- Components whose rendered output contains CRDs: **8**.
- Components whose rendered output contains Helm hook objects: **0**.

| Component | Exact nested source | Source SHA-256 | Local result | CRDs | hook objects | Evidence |
| --- | --- | --- | --- | ---: | ---: | --- |
| aws-ebs-csi-driver | `https://kubernetes-sigs.github.io/aws-ebs-csi-driver/aws-ebs-csi-driver@2.59.0` | `adb1961abcce...` | 19 objects | 0 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/aws-ebs-csi-driver/receipt.yaml) |
| aws-efa | `https://aws.github.io/eks-charts/aws-efa-k8s-device-plugin@0.5.29` | `078610ef6697...` | 1 object | 0 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/aws-efa/receipt.yaml) |
| cert-manager | `https://charts.jetstack.io/cert-manager@1.20.2` | `d2a50bd44a09...` | 52 objects | 6 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/cert-manager/receipt.yaml) |
| gpu-operator | `https://helm.ngc.nvidia.com/nvidia/gpu-operator@26.3.3` | `59abb5852a24...` | 14 objects | 2 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/gpu-operator/receipt.yaml) |
| k8s-ephemeral-storage-metrics | `https://jmcgrath207.github.io/k8s-ephemeral-storage-metrics/chart/k8s-ephemeral-storage-metrics@1.19.2` | `50efd3776450...` | 6 objects | 0 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/k8s-ephemeral-storage-metrics/receipt.yaml) |
| kai-scheduler | `oci://ghcr.io/kai-scheduler/kai-scheduler/kai-scheduler@v0.14.1` | `7ae052b56e75...` | 47 objects | 6 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/kai-scheduler/receipt.yaml) |
| kube-prometheus-stack | `https://prometheus-community.github.io/helm-charts/kube-prometheus-stack@84.4.0` | `87bac65f32a3...` | 123 objects | 0 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/kube-prometheus-stack/receipt.yaml) |
| kubeflow-trainer-post | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd/013-kubeflow-trainer-post@0.19.0` | `20b3c3aea98b...` | 1 object | 0 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/kubeflow-trainer-post/receipt.yaml) |
| kubeflow-trainer | `oci://ghcr.io/kubeflow/charts/kubeflow-trainer@2.2.0` | `34191da2886a...` | 28 objects | 4 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/kubeflow-trainer/receipt.yaml) |
| nfd | `https://kubernetes-sigs.github.io/node-feature-discovery/charts/node-feature-discovery@0.19.0` | `9e93b360e616...` | 27 objects | 4 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/nfd/receipt.yaml) |
| nodewright-customizations | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd/006-nodewright-customizations@0.19.0` | `e153d9784cc8...` | 1 object | 0 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/nodewright-customizations/receipt.yaml) |
| nodewright-operator | `oci://ghcr.io/nvidia/nodewright/charts/nodewright@v0.17.1` | `a75b0b3183e0...` | 24 objects | 2 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/nodewright-operator/receipt.yaml) |
| nvidia-dra-driver-gpu | `oci://registry.k8s.io/dra-driver-nvidia/charts/dra-driver-nvidia-gpu@0.4.1` | `c1c316f6bdcf...` | 21 objects | 2 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/nvidia-dra-driver-gpu/receipt.yaml) |
| nvsentinel | `oci://ghcr.io/nvidia/nvsentinel@v1.9.0` | `3f145e8ac660...` | 20 objects | 0 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/nvsentinel/receipt.yaml) |
| prometheus-adapter | `https://prometheus-community.github.io/helm-charts/prometheus-adapter@5.3.0` | `aa6752b6207e...` | 14 objects | 0 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/prometheus-adapter/receipt.yaml) |
| prometheus-operator-crds | `https://prometheus-community.github.io/helm-charts/prometheus-operator-crds@28.0.1` | `bc011e24c1e0...` | 10 objects | 10 | 0 | [receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/nested-renders/prometheus-operator-crds/receipt.yaml) |
