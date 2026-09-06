---
title: OCI Sources for Flux and Argo CD
status: draft
last_reviewed: 2026-09-06
family: oci-sources
shapes: [installer-package, aicr-per-file, flux-native-artifact]
assumes: [registry, registry-read-access, controller-version, reviewed-render]
sources:
  - url: https://fluxcd.io/flux/cheatsheets/oci-artifacts/
    licence: Apache-2.0
  - url: https://argo-cd.readthedocs.io/en/stable/user-guide/oci/
    licence: Apache-2.0
run_with: "cub installer setup --pull <digest-pinned-package> --base <reviewed-base> --work-dir ./work --non-interactive --output-oci <writable-output-ref>"
---

# OCI Sources for Flux and Argo CD

This family publishes reviewed configuration to a registry and makes the
controller select an artifact revision. OCI transport alone does not establish
compatibility: the layer format and the files inside it matter. The shape list
above includes inputs needing conversion; it is not a direct-consumption list.

## Representative patterns

The [Flux OCI guide](https://fluxcd.io/flux/cheatsheets/oci-artifacts/) shows a
CI job publishing manifests, an OCIRepository selecting them, and a Kustomization
applying the extracted files. It also documents Helm chart sources: those feed
a HelmRelease and still need Helm reconciliation. A manifest artifact avoids
that only when its contents are already rendered workload objects. The guide
is covered by the [Flux website license](https://github.com/fluxcd/website/blob/main/LICENSE),
Apache-2.0.

The [Argo CD OCI guide](https://argo-cd.readthedocs.io/en/stable/user-guide/oci/)
shows an Application selecting an OCI source and path. Its documented native
reader expects one archive layer, accepts OCI and Helm gzip media types by
default, and permits extra media types through repo-server configuration.
This requires a controller release with native OCI-source support; verify that
release's reader settings before selecting an artifact. The documentation's
[repository license](https://github.com/argoproj/argo-cd/blob/master/LICENSE)
is Apache-2.0.

## Mapping to catalog shapes

| Shape | Fit and required step |
| --- | --- |
| installer-package | Build input. Select a reviewed base with cub installer setup and publish the rendered output. Do not treat installer.yaml as workload YAML. |
| aicr-per-file | Conversion required for the native archive readers described here. The retained AICR artifact has individual YAML layers; it is not Argo CD's documented single archive layer. |
| flux-native-artifact | Direct fit for Flux OCIRepository plus Kustomization when the artifact contains the reviewed manifests. Argo CD needs an accepted archive media type; interoperability must be tested for the actual producer output. |

The [serverless OCI proof](../../data/serverless-oci-gitops-proof/summary.md)
records installer input, setup with --output-oci, a digest-matched Flux pull,
and a ready NGINX replica for one retained base. That receipt supports the
command in front matter. It does not establish Argo CD interoperability or a
universal hook/CRD lifecycle solution. The
[AICR source receipt](../../examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml)
records individual-yaml-layers. Its separate
[roundtrip proof](../../data/aicr-oci-roundtrip-proof/summary.md) compares objects
through ConfigHub but explicitly does not apply the Applications or prove GPU
readiness.

## Assumptions and tradeoffs

CI needs registry write access; controllers need read access and a compatible
reader. Pinning a digest fixes the reviewed revision, while following a mutable
tag permits updates outside that fixed approval. Configuration changes require
another build and publication. Registry retention and pull authentication become
runtime dependencies. Ordering, health checks, and pruning still need a separate
plan for the selected objects.

## Candidate stack recipe

A candidate would select an existing reviewed installer base, produce rendered
OCI, record the output digest, then create a Flux OCIRepository and Kustomization
with explicit path, health and pruning choices. Keep an Argo CD variant separate
until its archive/media-type path has a receipt. This is a proposed recipe, not
a new supported entry; the maintainer decides whether to admit it.

## Authoritative Sources

- [Serverless OCI receipt](../../runs/serverless-oci-gitops-proof/receipt.yaml)
  and [verifier](../../scripts/run-serverless-oci-gitops-proof.mjs).
- [Installer OCI package roles](../../data/installer-oci-packages/summary.md).
- [OCI inspection evidence](../../data/oci-inspection/summary.md).
- [AICR source receipt](../../examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml).
- [Flux OCI guide](https://fluxcd.io/flux/cheatsheets/oci-artifacts/).
- [Argo CD OCI guide](https://argo-cd.readthedocs.io/en/stable/user-guide/oci/).
- [Survey work order](https://github.com/confighub/helm-expt/issues/1758).
