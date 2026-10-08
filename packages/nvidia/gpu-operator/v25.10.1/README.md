# nvidia/gpu-operator v25.10.1 Installer Package

This package is generated from the gpu-operator proof artifacts. It has not been
published or run on a cluster.

- `default` holds 24 objects, 5 of them CRDs: chart defaults: the bundled node-feature-discovery on, driver 580.105.08.
- `driver-580.126.20` holds 24 objects, 5 of them CRDs: chart defaults with only driver.version changed, from 580.105.08 to 580.126.20, the default driver of chart v26.3.2 and v26.3.3; driver support for this chart version and for any operating system was not checked.
- `driver-595.91.07` holds 24 objects, 5 of them CRDs: chart defaults with only driver.version changed, from 580.105.08 to 595.91.07, the default driver of chart v26.7.1; driver support for this chart version and for any operating system was not checked.
- `preinstalled-driver` holds 24 objects, 5 of them CRDs: the NVIDIA driver is already installed on the GPU nodes: driver.enabled false, so the operator deploys no driver; everything else is chart defaults.
- `preinstalled-driver-and-toolkit` holds 24 objects, 5 of them CRDs: the NVIDIA driver and the NVIDIA Container Toolkit are already installed on the GPU nodes: driver.enabled false and toolkit.enabled false, so the operator deploys neither; everything else is chart defaults.
- `external-nfd` holds 9 objects, 2 of them CRDs: Node Feature Discovery already runs in the cluster: nfd.enabled false, so the bundled node-feature-discovery, its three CRDs and its post-delete prune hook do not render; everything else is chart defaults.

The chart also renders Helm hook objects. Helm runs them when a release is
upgraded or deleted, so they are not in the bases. They are kept in
`prerequisites/gpu-operator-lifecycle`, and `prerequisites/gpu-operator-lifecycle/lifecycle-actions.yaml`
records when each one applies. Nothing runs them automatically.

Regenerate and check every reviewed version with:

```sh
npm run nvidia-gpu-stack-coverage:generate -- --only gpu-operator
npm run nvidia-gpu-stack-coverage:verify -- --only gpu-operator
```
