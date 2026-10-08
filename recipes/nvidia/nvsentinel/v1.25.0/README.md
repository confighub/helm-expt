# nvidia/nvsentinel v1.25.0 Proof

This is the exact-artifact ConfigHub component package for nvsentinel@v1.25.0. NVSentinel is NVIDIA's GPU node health monitoring system. With chart defaults it runs the GPU health monitors, the syslog health monitors, the labeler, the metadata collector and the platform connectors.

Variants:

- `default`: chart defaults; 22 Helm objects, 23 cub installer objects including Namespace.
- `no-pod-monitor`: chart defaults with podMonitor.enabled false, which the chart's values.yaml gives for a cluster that scrapes with standard Prometheus annotations instead of the Prometheus Operator; the PodMonitor does not render, so no Prometheus Operator CRD is needed; 21 Helm objects, 22 cub installer objects including Namespace.
- `aicr-eks-training`: the values the AICR v1.0.0 EKS training recipe supplies (examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/015-nvsentinel/values.yaml): the metrics-access NetworkPolicy off and the labeler Deployment tolerating every taint, the labeler selected onto the system-worker node group, and the syslog health monitor given four checks and NIC driver patterns; 21 Helm objects, 22 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run nvidia-gpu-stack-coverage:generate -- --only nvsentinel@v1.25.0
npm run nvidia-gpu-stack-coverage:verify -- --only nvsentinel@v1.25.0
```
