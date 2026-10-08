# k8s-ephemeral-storage-metrics/k8s-ephemeral-storage-metrics 1.19.2 Proof

This is the exact-artifact ConfigHub component package for k8s-ephemeral-storage-metrics@1.19.2. k8s-ephemeral-storage-metrics exports each pod's ephemeral storage use as Prometheus metrics, read from the kubelet. The chart is a Deployment, its ServiceAccount, a ClusterRole and binding, a Service and a ServiceMonitor.

Variants:

- `default`: chart defaults; 6 Helm objects, 7 cub installer objects including Namespace.
- `aicr-eks-training-v0-20-0`: the values the AICR v0.20.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/010-k8s-ephemeral-storage-metrics/values.yaml): the ServiceMonitor labelled for the kube-prometheus-stack release, seven metrics named, and the pod tolerating every taint; 6 Helm objects, 7 cub installer objects including Namespace.
- `aicr-eks-training-v1-0-0`: the values the AICR v1.0.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/010-k8s-ephemeral-storage-metrics/values.yaml): the v0.20.0 values with the pod also selected onto the system-worker node group; 6 Helm objects, 7 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only k8s-ephemeral-storage-metrics@1.19.2
npm run aicr-nested-charts-coverage:verify -- --only k8s-ephemeral-storage-metrics@1.19.2
```
