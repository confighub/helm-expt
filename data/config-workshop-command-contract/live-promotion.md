# One checked result retained and promoted without losing its identity

This run starts with the reviewed NGINX base, checks a candidate that changes
replicas from three to four and adds an `emptyDir` size limit, then carries the
candidate's canonical object-set hash through ConfigHub.

| Step | Result | Identity |
| --- | --- | --- |
| Keep the reviewed base | pass | `sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397` |
| Check the promotion candidate locally | pass | `sha256:55f6bdcd4f07dc2f57d2dad456addcb035eaf867adcf864ebdf224555636f9e2` |
| Preview the staging promotion | pass; stored data and revision did not change | Deployment/nginx: replicas 3 to 4; emptyDir sizeLimit set to 512Mi; ConfigHub also reported one storage-only source-comment change. |
| Record the candidate on the ChangeSet | pass | `sha256:55f6bdcd4f07dc2f57d2dad456addcb035eaf867adcf864ebdf224555636f9e2` |
| Promote and approve staging | pass | `sha256:55f6bdcd4f07dc2f57d2dad456addcb035eaf867adcf864ebdf224555636f9e2` |

The ConfigHub data hash remains a storage identity. The canonical object-set
hash identifies the accepted Kubernetes objects. The local `cub check` result,
the ConfigHub ChangeSet, and the destination Unit all name the latter.

## Not run

- The required staging Secret was not checked.
- Release OCI publication did not run.
- Argo CD or Flux delivery did not run.
- No live workload observation was recorded.

These later checks remain separate from the successful retention and promotion
proof.

- [WorkshopResult for the base](helm/workshop-result.json)
- [WorkshopResult for the candidate](helm/promoted-workshop-result.json)
- [PromotionReview](helm/promotion-review.json)
- [Live receipt](../../runs/config-workshop-command-contract/receipt.yaml)
