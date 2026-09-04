# AICR v0.20.0 nested lifecycle resolution

The retained AICR configuration contains 17 Argo CD Applications. One is the
root. The other 16 point to component sources. All 16 sources now have a
digest-bound local render: **409 Kubernetes objects**, including **36 CRDs in
eight components**.

That completes the local materialization record. It does not mean that EKS,
H100, Argo CD, or Flux ran. The two route resolutions state what each controller
must do for the recorded staging destination and keep the missing target work
blocked.

| Delivery path | Recorded result | Still required |
| --- | --- | --- |
| [Argo CD](../lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-20-0-staging-argo-cd.yaml) | 17 wrapper Applications matched to 16 source and output records | EKS/H100 facts, controller reconciliation, component health, and workload result |
| [Flux](../lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-20-0-staging-flux.yaml) | 29 controller objects build locally; NVSentinel alone has `CreateReplace` for component-owned CRDs | Real Git source, EKS/H100 target, controller reconciliation, CRD-upgrade receipt, and workload result |

Components with CRDs in the selected local renders: cert-manager, gpu-operator, kai-scheduler, kubeflow-trainer, nfd, nodewright-operator, nvidia-dra-driver-gpu, prometheus-operator-crds.

- [Full nested inventory](./inventory.yaml)
- [Flux structural receipt and rerun commands](./flux-structure-receipt.yaml)
- [Nested source receipts](../aicr-v0-20-0-nested-sources/summary.md)
