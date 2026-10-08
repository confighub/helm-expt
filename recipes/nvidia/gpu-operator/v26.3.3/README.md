# nvidia/gpu-operator v26.3.3 Proof

This recipe audits the NVIDIA GPU Operator chart at v26.3.3, taken from the NGC Helm repository by exact archive URL and SHA-256. The operator installs and manages the driver, container toolkit, device plugin and monitoring workloads that GPU nodes need. Each base holds the ordinary objects the chart renders; the Helm hook objects are packaged separately as recorded lifecycle actions.

Variants:

- `default`: chart defaults: the bundled node-feature-discovery on, driver 580.126.20; 24 Helm objects, 25 cub installer objects including Namespace.
- `driver-580.105.08`: chart defaults with only driver.version changed, from 580.126.20 to 580.105.08, the default driver of chart v25.10.1; driver support for this chart version and for any operating system was not checked; 24 Helm objects, 25 cub installer objects including Namespace.
- `driver-595.91.07`: chart defaults with only driver.version changed, from 580.126.20 to 595.91.07, the default driver of chart v26.7.1; driver support for this chart version and for any operating system was not checked; 24 Helm objects, 25 cub installer objects including Namespace.
- `preinstalled-driver`: the NVIDIA driver is already installed on the GPU nodes: driver.enabled false, so the operator deploys no driver; everything else is chart defaults; 24 Helm objects, 25 cub installer objects including Namespace.
- `preinstalled-driver-and-toolkit`: the NVIDIA driver and the NVIDIA Container Toolkit are already installed on the GPU nodes: driver.enabled false and toolkit.enabled false, so the operator deploys neither; everything else is chart defaults; 24 Helm objects, 25 cub installer objects including Namespace.
- `external-nfd`: Node Feature Discovery already runs in the cluster: nfd.enabled false, so the bundled node-feature-discovery, its three CRDs and its post-delete prune hook do not render; everything else is chart defaults; 9 Helm objects, 10 cub installer objects including Namespace.
- `aicr-eks-training`: the values the AICR v0.20.0 EKS training recipe supplies (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/009-gpu-operator/values.yaml): node-feature-discovery off, driver 580.173.02, a dcgm-exporter metrics ConfigMap; 10 Helm objects, 11 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked without a mutable Helm index lookup;
- every base renders deterministically and the installer package preserves the rendered object set, plus the explained Namespace support object;
- the rendered driver version of every base is the one this recipe records, at ClusterPolicy /spec/driver/version;
- no base contains a Helm hook object;
- retention here does not imply publication, live convergence, GPU scheduling, or production support.

Useful commands:

```sh
npm run nvidia-gpu-stack-coverage:generate -- --only gpu-operator@v26.3.3
npm run nvidia-gpu-stack-coverage:verify -- --only gpu-operator@v26.3.3
```
