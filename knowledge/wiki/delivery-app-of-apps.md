---
title: Application Trees and ApplicationSets
status: draft
last_reviewed: 2026-09-06
family: app-of-apps
shapes: [installer-package, aicr-per-file, flux-native-artifact]
assumes: ["git-access", "argocd", "applicationset-controller", "cluster-registration"]
sources:
  - url: https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/
    licence: Apache-2.0
  - url: https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Cluster/
    licence: Apache-2.0
run_with: "No admitted parent-stack command; the retained AICR per-file objects need a tested native-reader conversion."
---

# Application Trees and ApplicationSets

## Representative patterns and tradeoffs

Argo CD documents a parent Application containing child Applications, and ApplicationSets generating Applications from registered clusters and selectors. The parent configuration chooses destinations and source revisions; child sources still determine whether Helm, Kustomize, or plain manifests are evaluated.

This assumes installed Argo CD CRDs/controllers, registered destinations and reviewed project permissions. A parent repository can control broad deployment authority. It gives up the simplicity of one workload inventory: parent synchronization alone does not prove every child is healthy, and deletion behavior must be reviewed.

- [Argo CD cluster bootstrapping](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/) — Apache-2.0; [license](https://github.com/argoproj/argo-cd/blob/master/LICENSE).
- [ApplicationSet cluster generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Cluster/) — Apache-2.0; [license](https://github.com/argoproj/argo-cd/blob/master/LICENSE).

## Mapping to catalog shapes

These are role mappings, not blanket direct-consumption claims.

| Shape | Fit and required step |
| --- | --- |
| installer-package | Possible child build input; it is not an ApplicationSet template or a native Argo source package. |
| aicr-per-file | The retained AICR example contains Applications, so its object role fits; native archive consumption still needs conversion. |
| flux-native-artifact | Can carry controller objects as rendered YAML, but successful extraction does not prove child reconciliation. |

## Candidate stack recipe

A candidate would package pinned child Application objects with explicit destinations, project boundaries and deletion policy. The AICR roundtrip receipt is an object-preservation starting point: it explicitly did not apply the Applications. A live recipe would need controller and per-child health receipts before making a stack-readiness claim.

## Authoritative Sources

- [Installer package roles](../../data/installer-oci-packages/summary.md).
- [Recorded installer-to-Flux result](../../data/serverless-oci-gitops-proof/summary.md) and [receipt](../../runs/serverless-oci-gitops-proof/receipt.yaml).
- [AICR object roundtrip and limits](../../data/aicr-oci-roundtrip-proof/summary.md).
- [Survey work order](https://github.com/confighub/helm-expt/issues/1758).
