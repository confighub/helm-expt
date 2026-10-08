# dra-driver-nvidia/dra-driver-nvidia-gpu 0.4.1 Proof

This is the exact-artifact ConfigHub component package for dra-driver-nvidia-gpu@0.4.1. The DRA Driver for NVIDIA GPUs lets workloads claim NVIDIA devices through Kubernetes Dynamic Resource Allocation. The chart installs a controller Deployment, a kubelet plugin DaemonSet, their RBAC, two CRDs, DeviceClass objects and a ValidatingAdmissionPolicy with its binding.

Variants:

- `default`: chart defaults with resources.gpus.enabled false; the chart's own defaults do not render, because the chart refuses resources.gpus.enabled true unless gpuResourcesEnabledOverride is also set; 21 Helm objects, 22 cub installer objects including Namespace.
- `gpu-resources`: chart defaults with gpuResourcesEnabledOverride true, which the chart requires before it will render resources.gpus.enabled true; the chart's values.yaml and its refusal message say this driver must then not share a node with the standard GPU device plugin; 24 Helm objects, 25 cub installer objects including Namespace.
- `aicr-eks-training`: the values the AICR v0.20.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/014-nvidia-dra-driver-gpu/values.yaml): GPU allocation off and ComputeDomains on, the name overridden to nvidia-dra-driver-gpu, the driver root set to /run/nvidia/driver, the kubelet plugin selected onto nodes labelled nvidia.com/gpu.present, every pod tolerating every taint and annotated with gpu-operator chart version v26.3.3; 21 Helm objects, 22 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only dra-driver-nvidia-gpu@0.4.1
npm run aicr-nested-charts-coverage:verify -- --only dra-driver-nvidia-gpu@0.4.1
```
