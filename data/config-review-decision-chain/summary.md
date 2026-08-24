# From an AI-written values file to an approved staging result

This example answers one practical question: **what happened to every problem we
found?** It starts with a supplied NGINX values file, keeps the requested scale,
fixes unsafe settings, records one narrow exception, and follows the same result
through ConfigHub and Argo CD.

## The result in one table

| Step | What happened | Record |
| --- | --- | --- |
| Check the proposal | `cub check` reported 6 findings against 5 objects. The separate chart review also rejected the public LoadBalancer. | [Local result](../../runs/config-catalog-policy-functional-proof/proposed-cub-check.json) and [chart review](../byo-helm-values-review/review.yaml) |
| Correct the configuration | 6 findings have an accepted fix. The image is pinned, container security is restored, the API key uses an existing Secret, and the Service is ClusterIP. | [Reviewed objects](../byo-helm-values-review/reviewed-render.yaml) |
| Decide the remaining finding | `CCVE-2025-3745` remains visible. Its exception applies only to the exact development and staging demonstration on throwaway kind clusters. Production is excluded. Review it by 2026-11-30. | [ConfigurationDecision](../../config-catalog/review-decisions/byo-nginx-ai-values-24-0-2-reviewed.yaml) |
| Validate the stored revision | ConfigHub independently checks the retained revision. The literal API-key control is clear. The local emptyDir finding has no managed equivalent and is not presented as a ConfigHub pass. | [Managed validation](../apply-policy-functional-proof/summary.md) |
| Keep the decision | ConfigHub stores the decision as the non-deployable `review-decision` Unit beside the configuration. Revision 3 has 1 recorded approval. | [Live receipt](../../runs/config-review-decision-chain/receipt.yaml) |
| Promote the accepted change | ConfigHub promotes `spec.replicas` from three in the reviewed base to four in staging while keeping the other reviewed settings. | [Promotion receipt](../../runs/byo-helm-values-promotion-proof/receipt.yaml) |
| Deliver it | Argo CD delivered the reviewed base and the promoted staging result on separate throwaway kind clusters. | [Base delivery](../byo-helm-values-deploy-proof/summary.md) and [staging delivery](../byo-helm-values-staging-deploy-proof/summary.md) |

## Why the records stay separate

- **Local check:** useful before signup; advisory only.
- **Configuration decision:** says which findings were fixed, rejected, or
  accepted for a narrow scope.
- **ConfigHub validation:** evaluates managed controls against a stored revision.
- **Approval:** binds the exception decision to one exact decision revision.
- **Promotion and delivery:** show what moved and what actually ran.

Approving the decision does not hide the scanner finding, approve a production
workload, or turn the local check into a ConfigHub control. A later object digest,
target, or production environment needs a new decision.

## Exact identities

| Item | Identity |
| --- | --- |
| Accepted Kubernetes object set | `sha256:ded2b7c2624c74ae1dce2a947ad9d99a32a62f5114361970af61c9ca51449345` |
| Scanner's normalized object set | `sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397` |
| Public OCI | `sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683` |
| ConfigHub configuration Unit | `63f66d73-7c57-4316-b8ef-2d79dedbf4cf`, revision `1` |
| ConfigHub decision Unit | `3ccf9ba6-0c11-4eb1-8ae4-dcd2a264316a`, revision `3` |

The two object-set hashes use different canonicalization rules and are named
separately. Neither is an OCI manifest digest or a ConfigHub data hash.
