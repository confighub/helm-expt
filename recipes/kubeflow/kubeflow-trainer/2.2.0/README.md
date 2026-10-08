# kubeflow/kubeflow-trainer 2.2.0 Proof

This is the exact-artifact ConfigHub component package for kubeflow-trainer@2.2.0. Kubeflow Trainer runs distributed training jobs from TrainJob custom resources. The chart installs the trainer controller manager and, as a subchart, the JobSet controller, with four CRDs, their RBAC, Services, ConfigMaps, four webhook configurations and two empty webhook certificate Secrets.

Variants:

- `default`: chart defaults; 28 Helm objects, 29 cub installer objects including Namespace.
- `aicr-eks-training-v0-20-0`: the values the AICR v0.20.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/012-kubeflow-trainer/values.yaml): the full name set to kubeflow-trainer, the manager given resource requests and limits and tolerating every taint, and the JobSet controller tolerating every taint. Several keys in the AICR values, among them crds, manager.metrics, manager.leaderElection and webhook.enabled, are not defined in the chart's values.yaml; the render differs from the default base only in the two controller Deployments; 28 Helm objects, 29 cub installer objects including Namespace.
- `aicr-eks-training-v1-0-0`: the values the AICR v1.0.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/012-kubeflow-trainer/values.yaml): the v0.20.0 values with the manager and the JobSet controller also selected onto the system-worker node group, and jobset.install written in place of jobset.enabled. Several keys in the AICR values, among them crds, manager.metrics, manager.leaderElection and webhook.enabled, are not defined in the chart's values.yaml; the render differs from the default base only in the two controller Deployments; 28 Helm objects, 29 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only kubeflow-trainer@2.2.0
npm run aicr-nested-charts-coverage:verify -- --only kubeflow-trainer@2.2.0
```
