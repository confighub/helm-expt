# node-feature-discovery/node-feature-discovery 0.19.0 Proof

This is the exact-artifact ConfigHub component package for node-feature-discovery@0.19.0. Node Feature Discovery detects hardware features and system configuration on each node and publishes them as node labels. With chart defaults it runs the master, a worker on every node and the garbage collector, and installs three CRDs.

Variants:

- `default`: chart defaults; 17 Helm objects, 18 cub installer objects including Namespace.
- `aicr-eks-training-v0-20-0`: the values the AICR v0.20.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/004-nfd/values.yaml): the topology updater on with its CRD and resource requests and limits, and the master, worker, garbage collector and topology updater tolerating every taint; 23 Helm objects, 24 cub installer objects including Namespace.
- `aicr-eks-training-v1-0-0`: the values the AICR v1.0.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/004-nfd/values.yaml): the v0.20.0 values with the master and the garbage collector also selected onto the system-worker node group; 23 Helm objects, 24 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only node-feature-discovery@0.19.0
npm run aicr-nested-charts-coverage:verify -- --only node-feature-discovery@0.19.0
```
