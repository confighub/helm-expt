# nvidia/nvidia-device-plugin 0.19.3 Proof

This recipe audits the NVIDIA device plugin chart at version 0.19.3. The plugin makes GPU nodes advertise the nvidia.com/gpu resource; without it a GPU pod stays Pending forever and the failure masquerades as an autoscaler bug. The default base renders the chart exactly as shipped, the eks-inference base retargets scheduling to that platform's node taints and labels and turns on failOnInitError, and the nfd-enabled base opens the node-feature-discovery gate the producer leaves closed. The chart refuses to render into the default namespace, and every base here renders into gpu-operator.

Variants:

- `default`: chart defaults, subchart gate closed, safe-to-flatten verdict; 5 Helm objects, 6 cub installer objects including Namespace.
- `eks-inference`: producer values: platform taints and labels for scheduling, failOnInitError true; 5 Helm objects, 6 cub installer objects including Namespace.
- `nfd-enabled`: the eks-inference values plus nfd.enabled true; renders the full node-feature-discovery stack including the visible post-delete prune set and three NodeFeature CRDs; 26 Helm objects, 27 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- all three renders are deterministic under the pinned Kubernetes capability profile and the exact pinned upstream artifact;
- the default and eks-inference bases render 5 objects each with no hooks, CRDs, Secrets, or lookups, matching their safe-to-flatten verdicts;
- the nfd-enabled base renders 26 objects with hooks visible, so the post-delete prune set (ServiceAccount, ClusterRole, ClusterRoleBinding, Job) and the three NodeFeature CRDs are audited objects rather than hidden Helm behavior.

Useful commands:

```sh
npm run nvidia-device-plugin:generate-proof
npm run nvidia-device-plugin:generate-package
npm run nvidia-device-plugin:verify-proof
npm run nvidia-device-plugin:verify-package
npm run nvidia-device-plugin:compare
```
