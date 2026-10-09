# nvidia/nodewright v0.17.1 Proof

This is the exact-artifact ConfigHub component package for nodewright@v0.17.1. NodeWright, formerly Skyhook, is an NVIDIA operator that applies packages and configuration to cluster nodes from custom resources. The chart installs the operator, its CRDs, RBAC, two Services, a mutating and a validating webhook configuration, a NetworkPolicy, a LimitRange and a PodDisruptionBudget.

Variants:

- `default`: chart defaults; 18 Helm objects, 19 cub installer objects including Namespace.
- `aicr-eks-training`: the values the AICR v0.20.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/005-nodewright-operator/values.yaml): the full name overridden to skyhook-operator, the manager given CPU and memory requests and limits and tolerating every taint, and the namespace LimitRange defaults set; 18 Helm objects, 19 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only nodewright@v0.17.1
npm run aicr-nested-charts-coverage:verify -- --only nodewright@v0.17.1
```
