# prometheus-community/prometheus-operator-crds 28.0.1 Proof

This is the exact-artifact ConfigHub component package for prometheus-operator-crds@28.0.1. prometheus-operator-crds installs the ten Prometheus Operator CRDs, version v0.90.1, and nothing else, so the CRDs can be managed apart from the operator.

Variants:

- `default`: chart defaults; 10 Helm objects, 11 cub installer objects including Namespace.
- `aicr-eks-training`: the values the AICR v0.20.0 and AICR v1.0.0 EKS training entries supply (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/007-prometheus-operator-crds/values.yaml and examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/007-prometheus-operator-crds/values.yaml): one key, enabled: true, which the chart does not read, so the render equals the default base; 10 Helm objects, 11 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only prometheus-operator-crds@28.0.1
npm run aicr-nested-charts-coverage:verify -- --only prometheus-operator-crds@28.0.1
```
