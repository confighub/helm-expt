---
title: Multi-cluster Fleets and Profiles
status: draft
last_reviewed: 2026-09-06
family: fleets
shapes: [installer-package, aicr-per-file, flux-native-artifact]
assumes: ["management-cluster", "cluster-registration", "cluster-labels", "controller-version"]
sources:
  - url: https://projectsveltos.io/main/addons/addons/
    licence: Apache-2.0
  - url: https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Cluster/
    licence: Apache-2.0
run_with: "No generic fleet-package command is claimed; use the retained Sveltos profile workflow as a proposed recipe starting point."
---

# Multi-cluster Fleets and Profiles

## Representative patterns and tradeoffs

Sveltos uses Profiles or ClusterProfiles to select clusters and distribute Helm charts, Kustomize resources or plain manifests. Argo CD's cluster generator produces Applications from registered cluster data and can restrict targets with labels. Both examples make cluster selection a configuration input rather than duplicating every workload by hand.

This assumes a management control plane, target credentials and deliberate label ownership. It trades local independence for shared management authority and a larger change scope. Removing a selector can expand a rollout without changing any workload value. Per-cluster health and rollback behavior remain separate evidence requirements.

- [Sveltos add-on distribution](https://projectsveltos.io/main/addons/addons/) — Apache-2.0; [license](https://github.com/projectsveltos/sveltos/blob/main/LICENSE).
- [Argo CD cluster generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Cluster/) — Apache-2.0; [license](https://github.com/argoproj/argo-cd/blob/master/LICENSE).

## Mapping to catalog shapes

These are role mappings, not blanket direct-consumption claims.

| Shape | Fit and required step |
| --- | --- |
| installer-package | Prepare each workload/base variant before fleet distribution; the package is not cluster inventory. |
| aicr-per-file | Can carry literal profile objects, but needs the tested transport conversion and management controllers. |
| flux-native-artifact | Can carry reviewed profile or workload manifests; downstream behavior depends on the selected controllers. |

## Candidate stack recipe

A candidate would preserve a pilot selector, publish its reviewed profile, observe the pilot, then approve a second selector revision. The retained Sveltos proof exercised that sequence on two local clusters, including drift repair, through a portable OCI consumed by Argo CD. It used Sveltos as a prerequisite and installed a Helm chart downstream; it is neither large-fleet proof nor a Helm-free workload path.

## Authoritative Sources

- [Installer package roles](../../data/installer-oci-packages/summary.md).
- [Recorded installer-to-Flux result](../../data/serverless-oci-gitops-proof/summary.md) and [receipt](../../runs/serverless-oci-gitops-proof/receipt.yaml).
- [AICR object roundtrip and limits](../../data/aicr-oci-roundtrip-proof/summary.md).
- [Sveltos rollout receipt and limits](../../data/sveltos-oci-delivery-proof/summary.md).
- [Survey work order](https://github.com/confighub/helm-expt/issues/1758).
