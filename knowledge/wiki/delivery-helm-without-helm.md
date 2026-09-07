---
title: Helm-derived Workloads without Helm Release Management
status: draft
last_reviewed: 2026-09-06
family: helm-without-helm
shapes: [installer-package, aicr-per-file, flux-native-artifact]
assumes: ["ci-renderer", "reviewed-render", "controller-version", "lifecycle-plan"]
sources:
  - url: https://argo-cd.readthedocs.io/en/stable/user-guide/helm/
    licence: Apache-2.0
  - url: https://fluxcd.io/flux/cheatsheets/oci-artifacts/
    licence: Apache-2.0
run_with: "cub installer setup --pull <digest-pinned-package> --base <reviewed-base> --work-dir ./work --non-interactive --output-oci <writable-output-ref>"
---

# Helm-derived Workloads without Helm Release Management

## Representative patterns and tradeoffs

Argo CD documents using Helm to render charts while Argo CD manages application lifecycle. That avoids Helm release management, but is not the same as removing Helm rendering from the cluster-side delivery system. Flux's rendered-manifest OCI pattern instead gives Kustomization already prepared objects; a HelmRelease in that artifact would reintroduce Helm reconciliation.

For a fully pre-rendered path, CI must capture values and capabilities, while delivery needs an explicit lifecycle plan. It gives up Helm's release history and automatic interpretation of chart lifecycle behavior. Hooks, CRD sequencing, lookup-dependent values and generated credentials must be reviewed before selecting a flat object path.

- [Argo CD Helm integration](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/) — Apache-2.0; [license](https://github.com/argoproj/argo-cd/blob/master/LICENSE).
- [Flux OCI manifest delivery](https://fluxcd.io/flux/cheatsheets/oci-artifacts/) — Apache-2.0; [license](https://github.com/fluxcd/website/blob/main/LICENSE).

## Mapping to catalog shapes

These are role mappings, not blanket direct-consumption claims.

| Shape | Fit and required step |
| --- | --- |
| installer-package | Fits as the off-cluster build input; deliver only its reviewed output. |
| aicr-per-file | Literal objects are already rendered, but transport conversion and object lifecycle remain necessary. |
| flux-native-artifact | Fits delivery of already-rendered workload objects through Flux, with the retained base-specific evidence limits. |

## Candidate stack recipe

A candidate would reuse the proven NGINX installer-to-Flux path and retain its exact output digest, then document the absence of HelmRelease objects and separately check workload health. A chart needing hooks or operator sequencing would require a different lifecycle recipe. The existing single-base receipt does not justify a universal Helm replacement claim.

## Authoritative Sources

- [Installer package roles](../../data/installer-oci-packages/summary.md).
- [Recorded installer-to-Flux result](../../data/serverless-oci-gitops-proof/summary.md) and [receipt](../../runs/serverless-oci-gitops-proof/receipt.yaml).
- [AICR object roundtrip and limits](../../data/aicr-oci-roundtrip-proof/summary.md).
- [Survey work order](https://github.com/confighub/helm-expt/issues/1758).
