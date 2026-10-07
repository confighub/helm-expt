# nvidia/cluster-readiness-engine v0.6.0 Proof

This is the exact-artifact ConfigHub component package for cluster-readiness-engine@v0.6.0. The NVIDIA Cluster Readiness Engine is a controller that certifies GPU clusters by running training and communication workloads and reporting the nodes that fail.

Variants:

- `default`: chart defaults; 43 Helm objects, 44 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- the chart-default configuration renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run nvidia-gpu-stack-coverage:generate -- --only cluster-readiness-engine@v0.6.0
npm run nvidia-gpu-stack-coverage:verify -- --only cluster-readiness-engine@v0.6.0
```
