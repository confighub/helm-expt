---
title: Rendered Manifest Repositories
status: draft
last_reviewed: 2026-09-06
family: rendered-manifests
shapes: [installer-package, aicr-per-file, flux-native-artifact]
assumes: ["git-access", "ci-renderer", "controller-version"]
sources:
  - url: https://fluxcd.io/flux/use-cases/gh-actions-manifest-generation/
    licence: Apache-2.0
  - url: https://argo-cd.readthedocs.io/en/stable/user-guide/directory/
    licence: Apache-2.0
run_with: "cub installer setup --pull <digest-pinned-package> --base <reviewed-base> --work-dir ./work --non-interactive"
---

# Rendered Manifest Repositories

## Representative patterns and tradeoffs

Flux's worked CI example renders configuration and commits output into a deployment branch. Argo CD's directory example consumes plain YAML/JSON from a selected repository path, with explicit recursion and file filtering when needed. These are producer/consumer examples; neither makes arbitrary package source files deployable.

The approach assumes CI can push reviewed output and the controller can read Git. It gives a readable configuration diff, but creates a second representation to keep in sync and makes renderer versions and generated-file hygiene part of the delivery contract.

- [Flux CI manifest generation](https://fluxcd.io/flux/use-cases/gh-actions-manifest-generation/) — Apache-2.0; [license](https://github.com/fluxcd/website/blob/main/LICENSE).
- [Argo CD directory applications](https://argo-cd.readthedocs.io/en/stable/user-guide/directory/) — Apache-2.0; [license](https://github.com/argoproj/argo-cd/blob/master/LICENSE).

## Mapping to catalog shapes

These are role mappings, not blanket direct-consumption claims.

| Shape | Fit and required step |
| --- | --- |
| installer-package | Render the selected base in CI, then commit only deployable output files. |
| aicr-per-file | Extract literal objects before committing; individual OCI layers are not a Git directory. |
| flux-native-artifact | A registry delivery alternative, not the Git source itself; unpack or publish the same reviewed files. |

## Candidate stack recipe

A candidate recipe would take one retained installer base, capture the object-set digest, and publish a deployment branch containing only its reviewed manifests. It would configure a directory Application or Flux Git source separately and test pruning and health for that base. The catalog OCI proof establishes a producer path, not this Git-commit workflow.

## Authoritative Sources

- [Installer package roles](../../data/installer-oci-packages/summary.md).
- [Recorded installer-to-Flux result](../../data/serverless-oci-gitops-proof/summary.md) and [receipt](../../runs/serverless-oci-gitops-proof/receipt.yaml).
- [AICR object roundtrip and limits](../../data/aicr-oci-roundtrip-proof/summary.md).
- [Survey work order](https://github.com/confighub/helm-expt/issues/1758).
