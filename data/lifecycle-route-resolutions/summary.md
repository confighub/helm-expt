# Lifecycle route resolutions

These records answer a destination-specific question: who will perform the work
around normal apply, in what order, for this exact configuration? Each record binds
one base revision and one exact object set to a destination and delivery runtime.
Its status separates a plan from work that has actually run.

| Resolution | Delivery runtime | Destination | Ordered routes | Decision | Evidence |
| --- | --- | --- | ---: | --- | --- |
| [kube-prometheus-stack-85-3-3-no-crds-direct](./kube-prometheus-stack-85-3-3-no-crds-direct.yaml) | cub installer direct runner | `hx-kps-route-20260729104751` | 6 | ready | observed |
| [kube-prometheus-stack-85-3-3-no-crds-argo-cd](./kube-prometheus-stack-85-3-3-no-crds-argo-cd.yaml) | Argo CD | `hx-kps-argo-20260729-1zvp` | 7 | ready | observed |
| [kube-prometheus-stack-85-3-3-no-crds-flux](./kube-prometheus-stack-85-3-3-no-crds-flux.yaml) | Flux | `hx-kps-flux-20260729-1zvp` | 7 | ready | observed |
| [aicr-eks-h100-training-kubeflow-v0-19-0-staging-argo-cd](./aicr-eks-h100-training-kubeflow-v0-19-0-staging-argo-cd.yaml) | Argo CD | `eks-h100-staging` | 6 | blocked | partly-observed |

The three kube-prometheus-stack records have runtime receipts. The AICR v0.19.0
staging record binds a real promoted variant to its intended EKS/H100/Argo CD
destination, but stays blocked until the target facts, nested chart routes, and
runtime checks have been recorded. A new source version, lifecycle-sensitive
variant, destination, or delivery runtime requires another resolution.

Schema: [lifecycle-route-resolution.schema.json](../../schemas/lifecycle-route-resolution.schema.json).
