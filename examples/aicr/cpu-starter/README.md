# The CPU starter derives from the training entry

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
`npm run aicr-cpu-starter:generate` and checked byte-for-byte by
`npm run aicr-cpu-starter:verify`. Do not edit it by hand.

Every file under [argocd-rendered/](./argocd-rendered/) is a byte-identical
copy of a rendered Argo CD Application the
[training entry](../eks-h100-training-kubeflow/) retains from
NVIDIA AICR v0.14.0. The
[derivation receipt](./derivation-receipt.yaml) records the selection rules and
every exclusion with its reason, and the
[digest index](./digest-index/README.md) pins the derivation under:

```
sha256:d4c19c203ba379690c8de8716b29712b14d69006ae928136f410f634a4a80564
```

The selected components, in install order:

| Wave | Component |
| --- | --- |
| 2 | cert-manager |
| 3 | nfd |
| 6 | prometheus-operator-crds |
| 7 | kube-prometheus-stack |
| 9 | k8s-ephemeral-storage-metrics |
| 10 | kai-scheduler |
| 15 | prometheus-adapter |

The starter needs no GPU. It keeps the source bytes faithful, so the recorded
cloud residues stay visible instead of silently edited; override them with
variant mechanics before a live run. No live run is claimed anywhere in this
directory; running the starter is a later increment.
