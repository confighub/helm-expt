---
title: Overlays on Rendered Manifests
status: draft
last_reviewed: 2026-09-06
family: overlays
shapes: [installer-package, aicr-per-file, flux-native-artifact]
assumes: ["git-or-registry", "kustomize-version", "reviewed-render"]
sources:
  - url: https://fluxcd.io/flux/components/kustomize/kustomizations/
    licence: Apache-2.0
  - url: https://argo-cd.readthedocs.io/en/stable/user-guide/kustomize/
    licence: Apache-2.0
run_with: "cub installer setup --pull <digest-pinned-package> --base <reviewed-base> --work-dir ./work --non-interactive"
---

# Overlays on Rendered Manifests

## Representative patterns and tradeoffs

Flux Kustomization supports patches and image overrides. Argo CD detects a kustomization.yaml at the selected source path and runs Kustomize. Both allow environment-specific changes around a reusable base; they require an agreed Kustomize version and a source layout containing every referenced resource.

An overlay changes the objects being approved. Its result needs its own digest and checks, even when the base was already tested. A patch cannot recreate omitted Helm resources or infer render-time capabilities. Controller-side patches also mean the artifact digest alone does not describe the final applied configuration.

- [Flux Kustomization patches](https://fluxcd.io/flux/components/kustomize/kustomizations/) — Apache-2.0; [license](https://github.com/fluxcd/website/blob/main/LICENSE).
- [Argo CD Kustomize applications](https://argo-cd.readthedocs.io/en/stable/user-guide/kustomize/) — Apache-2.0; [license](https://github.com/argoproj/argo-cd/blob/master/LICENSE).

## Mapping to catalog shapes

These are role mappings, not blanket direct-consumption claims.

| Shape | Fit and required step |
| --- | --- |
| installer-package | Render a base, apply the reviewed patch set, then verify the resulting objects. |
| aicr-per-file | Extract and normalize objects into a base before applying overlays. |
| flux-native-artifact | Fits Flux sources; either bundle the overlay inputs or publish the final rendered result and record which model is used. |

## Candidate stack recipe

A candidate would render a catalog base, apply a narrowly owned environment overlay, and record both source and resulting object digests. It would compare local and controller output and test that the patch touches only intended objects. The existing variant model distinguishes render-time changes from post-render refinements; this survey does not certify a new overlay.

## Authoritative Sources

- [Installer package roles](../../data/installer-oci-packages/summary.md).
- [Recorded installer-to-Flux result](../../data/serverless-oci-gitops-proof/summary.md) and [receipt](../../runs/serverless-oci-gitops-proof/receipt.yaml).
- [AICR object roundtrip and limits](../../data/aicr-oci-roundtrip-proof/summary.md).
- [Variant promotion model](../../docs/reference/variant-promotion-model.md).
- [Survey work order](https://github.com/confighub/helm-expt/issues/1758).
