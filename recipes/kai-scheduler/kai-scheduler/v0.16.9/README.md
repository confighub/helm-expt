# kai-scheduler/kai-scheduler v0.16.9 Proof

This is the exact-artifact ConfigHub component package for kai-scheduler@v0.16.9. KAI Scheduler is a Kubernetes scheduler for GPU workloads. The chart installs the kai-operator, six CRDs, four PriorityClasses, two default Queues and a default SchedulingShard; the operator then deploys the scheduler services that a Config object names.

Variants:

- `default`: chart defaults; 37 Helm objects, 37 cub installer objects including support objects.
- `aicr-eks-training`: the values the AICR v1.0.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/011-kai-scheduler/values.yaml): the default queues named, every pod selected onto the system-worker node group and tolerating every taint, and the post-delete cleanup hook off; 37 Helm objects, 37 cub installer objects including support objects.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only kai-scheduler@v0.16.9
npm run aicr-nested-charts-coverage:verify -- --only kai-scheduler@v0.16.9
```
