---
title: Delivery Pattern Survey
status: draft
last_reviewed: 2026-09-06
---

# Delivery Pattern Survey

This survey maps working upstream examples to the catalog's three OCI roles.
The mappings and candidate recipes are design assessments for maintainer review,
not new support verdicts. Each family page records sources and their licenses,
assumptions, tradeoffs, conversion needs, and links to the repository's narrower
evidence. Upstream documentation was checked on the review date; pin controller
versions and recheck their readers before turning a candidate into a tested entry.

An installer package is a build input. An AICR per-file artifact contains literal
objects in separate layers. A Flux-native artifact is a rendered delivery shape.
Sharing OCI transport does not make these shapes interchangeable. A shape listed
in front matter can be an input needing conversion; use the per-page mapping table
to distinguish that from direct controller consumption. `none` means an additional
control workflow is needed, not that arbitrary OCI payloads should be deployed.

## Family index

| Family | Main fit | Main gap | Survey |
| --- | --- | --- | --- |
| rendered-manifests | Installer output committed as plain manifests | Git publication and controller health need their own receipt | [Draft](delivery-rendered-manifests.md) |
| oci-sources | Rendered artifact through Flux | Argo media types and AICR layer conversion | [Draft](delivery-oci-sources.md) |
| d2-stacks | Not assessed | Maintainer layout list requested before starting | Pending #1758 |
| app-of-apps | Literal Application objects after transport adaptation | Per-child lifecycle, destination and health | [Draft](delivery-app-of-apps.md) |
| overlays | Reviewed post-render changes | Final object digest differs from the base | [Draft](delivery-overlays.md) |
| image-automation | Rebuild and publish a reviewed configuration revision | Update policy is separate from all three artifact shapes | [Draft](delivery-image-automation.md) |
| fleets | Profile or per-cluster configuration revisions | Selection scope and per-cluster health | [Draft](delivery-fleets.md) |
| helm-without-helm | Pre-rendered workload artifacts | Helm rendering and Helm release management are different claims | [Draft](delivery-helm-without-helm.md) |

## Candidate shortlist

The maintainer decides admission. None of these rows creates a catalog entry.

| Candidate | Reason to investigate | First missing receipt |
| --- | --- | --- |
| NGINX rendered Git directory | Reuse an existing rendered producer with a plain Git consumer | Exact Git tree and controller reconciliation |
| NGINX Flux digest delivery | Start from the retained installer-to-Flux result | A maintained repeatable target beyond the temporary registry |
| Argo native OCI adapter | Make layer and media-type conversion explicit | Object-preserving archive conversion plus Argo reconciliation |
| AICR Application tree | Retain literal parent/child intent | Applied Application objects and child health; GPU claims remain separate |
| Reviewed environment overlay | Separate base provenance from final patched objects | Patch scope and local/controller output equivalence |
| Image-update review pipeline | Avoid promoting a new image under an old receipt | Proposed image change through fresh proof and approval |
| Sveltos pilot expansion | Extend the retained two-cluster selector example | Failure/pause behavior and wider target coverage |

## Authoritative Sources

- [Installer package roles](../../data/installer-oci-packages/summary.md).
- [OCI inspection reports](../../data/oci-inspection/summary.md).
- [Installer-to-Flux proof and limits](../../data/serverless-oci-gitops-proof/summary.md).
- [AICR object roundtrip and limits](../../data/aicr-oci-roundtrip-proof/summary.md).
- [Sveltos rollout proof and limits](../../data/sveltos-oci-delivery-proof/summary.md).
- [Survey work order and front-matter contract](https://github.com/confighub/helm-expt/issues/1758).
- [Request for d2 layouts](https://github.com/confighub/helm-expt/issues/1758#issuecomment-5561196457).
