# Managed Journey Coverage

This record tracks the six journeys that connect the public Config Workshop to
ConfigHub. It deliberately separates a working technical proof from evidence
that an ordinary user can complete the journey without help.

Generated from [config-catalog/managed-journeys.yaml](../../config-catalog/managed-journeys.yaml).

## Current result

```text
technical pass:   6/6
user trial pass:  0/6
user trial not run: 6/6
```

| User question | Technical result | User trial | User evidence | Current limit |
| --- | --- | --- | --- | --- |
| Can I turn Helm values written by AI into exact reviewed objects and OCI? | pass | not-run | None | One public NGINX chart and values example. Private dependency authentication and an outside-user trial remain open. |
| Can I retain the same reviewed OCI as a ConfigHub base without changing its objects? | pass | not-run | None | The digest-preserving handoff is proved for one literal Kubernetes object set. The public browser does not perform the authenticated upload. |
| Can I test exact candidates, compare the accepted result with production, and promote the selected revision? | pass | not-run | None | One NGINX capacity rule on one throwaway target. It is not a production sizing recommendation or a general promotion UI test. |
| Can I check hooks, CRDs, prerequisites, namespaces, and delivery mechanics after the final candidate exists? | pass | not-run | None | One chart, version pair, Argo CD path, and kind target. Automatic route selection and rollback have not run. |
| Can I promote an exact ConfigHub release, deliver it through GitOps, and check the resulting live state? | pass | not-run | None | Argo CD is proved for this lifecycle-heavy path. Flux has a separate source-OCI proof, not this ConfigHub release, and no long soak was run. |
| Can a useful public investigation become a retained Catalog answer with its decision and limits visible? | pass | not-run | None | The NGINX answer is retained and public. No outside user has yet completed the response process from question submission to accepted Catalog answer. |

## Evidence and commands

| Journey | Evidence | Verify |
| --- | --- | --- |
| ai-values-to-reviewed-oci | [data/byo-helm-values-review/summary.md](../../data/byo-helm-values-review/summary.md)<br>[runs/byo-helm-values-proof/public-oci-receipt.yaml](../../runs/byo-helm-values-proof/public-oci-receipt.yaml) | `npm run byo-helm-values:verify`<br>`npm run byo-helm-values:public-verify` |
| reviewed-oci-to-confighub-base | [data/byo-helm-values-review/public-and-confighub.md](../../data/byo-helm-values-review/public-and-confighub.md)<br>[runs/byo-helm-values-proof/confighub-upload-receipt.yaml](../../runs/byo-helm-values-proof/confighub-upload-receipt.yaml) | `npm run byo-helm-values:verify`<br>`npm run byo-helm-values:live-verify` |
| staging-candidate-versus-production | [data/measured-promotion-proof/summary.md](../../data/measured-promotion-proof/summary.md)<br>[runs/measured-promotion-proof/receipt.yaml](../../runs/measured-promotion-proof/receipt.yaml) | `npm run measured-promotion:verify` |
| lifecycle-and-destination-preflight | [data/kps-confighub-lifecycle-promotion/summary.md](../../data/kps-confighub-lifecycle-promotion/summary.md)<br>[examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/promotion-review.yaml](../../examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/promotion-review.yaml)<br>[examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/lifecycle-route.yaml](../../examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/lifecycle-route.yaml) | `npm run kps:confighub-lifecycle-promotion:verify` |
| exact-release-to-live-state | [runs/kps-confighub-lifecycle-promotion/receipt.yaml](../../runs/kps-confighub-lifecycle-promotion/receipt.yaml)<br>[data/kps-confighub-lifecycle-promotion/summary.md](../../data/kps-confighub-lifecycle-promotion/summary.md) | `npm run kps:confighub-lifecycle-promotion:verify` |
| public-investigation-to-catalog-answer | [data/config-review-decision-chain/summary.md](../../data/config-review-decision-chain/summary.md)<br>[runs/config-review-decision-chain/receipt.yaml](../../runs/config-review-decision-chain/receipt.yaml)<br>[site/charts/bitnami-nginx-24-0-2.html](../../site/charts/bitnami-nginx-24-0-2.html) | `npm run config-review-decision:verify`<br>`npm run site:verify` |

## Reading rule

A technical pass means the named example has committed evidence and a verifier.
It does not mean the public website, CLI, or ConfigHub browser makes the journey
easy for a new user. A user-trial pass requires an outside user to complete the
same task with their own input and normal AI assistant, produce the required
artifact, explain the unrun checks, and preserve the accepted object identity.
The aggregate evidence must be linked from the row; a status alone is refused.
