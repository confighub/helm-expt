# eks/aws-efa-k8s-device-plugin v0.5.29 Proof

This is the exact-artifact ConfigHub component package for aws-efa-k8s-device-plugin@v0.5.29. The AWS EFA Kubernetes device plugin advertises Elastic Fabric Adapter interfaces on EC2 nodes as the extended resource vpc.amazonaws.com/efa. The chart is one DaemonSet.

Variants:

- `default`: chart defaults; 1 Helm objects, 2 cub installer objects including Namespace.
- `aicr-eks-training`: the values the AICR v0.20.0 and AICR v1.0.0 EKS training entries supply (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/002-aws-efa/values.yaml and examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/002-aws-efa/values.yaml): the full name set to aws-efa-k8s-device-plugin, the DaemonSet selected onto nodes labelled nvidia.com/gpu.present and tolerating every taint, the image named explicitly, resource requests set, and the container security context tightened; 1 Helm objects, 2 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only aws-efa-k8s-device-plugin@v0.5.29
npm run aicr-nested-charts-coverage:verify -- --only aws-efa-k8s-device-plugin@v0.5.29
```
