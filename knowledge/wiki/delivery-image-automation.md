---
title: Image Automation with Digest Review
status: draft
last_reviewed: 2026-09-06
family: image-automation
shapes: [installer-package, aicr-per-file, flux-native-artifact, none]
assumes: ["git-write-access", "registry-read-access", "image-updater", "review-policy"]
sources:
  - url: https://fluxcd.io/flux/guides/image-update/
    licence: Apache-2.0
  - url: https://argocd-image-updater.readthedocs.io/en/stable/basics/update-strategies/
    licence: Apache-2.0
run_with: "No catalog command creates the updater policy; regenerate and verify changed configuration before publishing a new artifact."
---

# Image Automation with Digest Review

## Representative patterns and tradeoffs

Flux's guide separates registry scanning, policy selection and Git updates. Argo CD Image Updater documents a digest strategy for following the changing digest behind one tag. A digest recorded today is immutable; an automation policy can still select a different digest tomorrow.

These patterns need registry visibility and controlled write access. They trade a fixed approved deployment for a stream of proposed or automatic changes. A workload-image digest is distinct from an installer or rendered-configuration artifact digest. Updating an image must trigger the relevant render, scan and approval work; it cannot inherit an old receipt merely because its tag looks similar.

- [Flux image automation](https://fluxcd.io/flux/guides/image-update/) — Apache-2.0; [license](https://github.com/fluxcd/website/blob/main/LICENSE).
- [Argo CD Image Updater strategies](https://argocd-image-updater.readthedocs.io/en/stable/basics/update-strategies/) — Apache-2.0; [license](https://github.com/argoproj-labs/argocd-image-updater/blob/master/LICENSE).

## Mapping to catalog shapes

These are role mappings, not blanket direct-consumption claims.

| Shape | Fit and required step |
| --- | --- |
| installer-package | Rebuild and verify the package/base when source image choices change. |
| aicr-per-file | Republish changed literal objects; do not edit a retained artifact in place. |
| flux-native-artifact | Publish a newly verified configuration artifact and update its reviewed reference. |

## Candidate stack recipe

A candidate would make the updater propose an image change in Git, run the catalog proof chain, then publish a new rendered digest only after review. None of the three OCI shapes encodes the update policy, credentials or approval workflow by itself; the candidate needs separate updater resources and orchestration. No new artifact format is required just to transport the resulting manifests.

## Authoritative Sources

- [Installer package roles](../../data/installer-oci-packages/summary.md).
- [Recorded installer-to-Flux result](../../data/serverless-oci-gitops-proof/summary.md) and [receipt](../../runs/serverless-oci-gitops-proof/receipt.yaml).
- [AICR object roundtrip and limits](../../data/aicr-oci-roundtrip-proof/summary.md).
- [Variant promotion model](../../docs/reference/variant-promotion-model.md).
- [Survey work order](https://github.com/confighub/helm-expt/issues/1758).
