# nvidia/gpu-operator v26.7.1 Proof

This recipe audits the NVIDIA GPU Operator chart at v26.7.1, taken from the NGC Helm repository by exact archive URL and SHA-256. The operator installs and manages the driver, container toolkit, device plugin and monitoring workloads that GPU nodes need. Each base holds the ordinary objects the chart renders; the Helm hook objects are packaged separately as recorded lifecycle actions.

Variants:

- `default`: chart defaults: the bundled node-feature-discovery on, driver 595.91.07; 27 Helm objects, 28 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked without a mutable Helm index lookup;
- every base renders deterministically and the installer package preserves the rendered object set, plus the explained Namespace support object;
- the rendered driver version of every base is the one this recipe records, at ClusterPolicy /spec/driver/version;
- no base contains a Helm hook object;
- retention here does not imply publication, live convergence, GPU scheduling, or production support.

Useful commands:

```sh
npm run nvidia-gpu-stack-coverage:generate -- --only gpu-operator@v26.7.1
npm run nvidia-gpu-stack-coverage:verify -- --only gpu-operator@v26.7.1
```
