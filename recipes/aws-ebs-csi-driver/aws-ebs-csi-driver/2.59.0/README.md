# aws-ebs-csi-driver/aws-ebs-csi-driver 2.59.0 Proof

This is the exact-artifact ConfigHub component package for aws-ebs-csi-driver@2.59.0. The Amazon EBS CSI driver provisions and attaches EBS volumes for Kubernetes workloads. The chart installs a controller Deployment, node DaemonSets, a CSIDriver object, ServiceAccounts, RBAC and a PodDisruptionBudget.

Variants:

- `default`: chart defaults; 19 Helm objects, 20 cub installer objects including Namespace.
- `aicr-eks-training-v0-20-0`: the values the AICR v0.20.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/001-aws-ebs-csi-driver/values.yaml): a default StorageClass on, the Windows node DaemonSet off, the controller and node pods tolerating every taint, service account names and resource requests and limits set; 19 Helm objects, 20 cub installer objects including Namespace.
- `aicr-eks-training-v1-0-0`: the values the AICR v1.0.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/001-aws-ebs-csi-driver/values.yaml): the v0.20.0 values with the controller also selected onto the system-worker node group; 19 Helm objects, 20 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only aws-ebs-csi-driver@2.59.0
npm run aicr-nested-charts-coverage:verify -- --only aws-ebs-csi-driver@2.59.0
```
