# AICR change promoted from development to staging

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live receipt. Rerun the scratch proof with `npm run aicr-variant-promotion:run`; verify it without external access with `npm run aicr-variant-promotion:verify`.

This test imported the AICR v0.14.0 Argo CD configuration into ConfigHub. The OCI contained 17 exact Argo CD `Application` objects, including the component order recorded as sync waves 0 through 15.

The base was copied into development and staging variants. In development, the Grafana setting was changed from the example `adminPassword: admin` value to an existing Secret named `aicr-grafana-admin`. ConfigHub's dry run named one affected Application and left the stored configuration unchanged.

The staging promotion was also previewed first. Staging stayed unchanged during the preview. The real promotion then copied the reviewed development configuration to staging, and the two variants had the same recorded data hash.

| Check | Result |
| --- | --- |
| OCI digest imported | `sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010` |
| Argo CD Applications | 17 |
| Applications changed | 1: `kube-prometheus-stack` |
| Development dry run changed stored data | no |
| Staging promotion dry run changed stored data | no |
| Staging matched reviewed development after promotion | yes |
| Scratch cleanup | pass |

The proof used three temporary Spaces for the base, development, and staging variants. All three were deleted after the checks.

No Kubernetes cluster was started. This receipt proves ConfigHub import, variants, an exact field change, a promotion preview, and a dev-to-staging promotion. It does not prove public Google Artifact Registry publication, Argo CD delivery, application health, GPU workload health, or the live `helm-catalog` apply policy.

- [AICR walkthrough](../../docs/demo/aicr/eks-h100-training-kubeflow.md)
- [Committed live receipt](../../runs/aicr-variant-promotion-proof/receipt.yaml)
