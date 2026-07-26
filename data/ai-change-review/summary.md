# AI change review: stop a bad training change before it ships

This example starts with the AICR PyTorch training runtime already committed in
the catalog. The request is to increase the runtime to eight H100 nodes and
update its image.

The unchecked proposal does three concrete things: asks for more nodes than the
recorded target has, replaces a digest-pinned image with `latest`, and leaves
the API key as `confighubplaceholder`. The proposal is rejected before apply.

The reviewed candidate stays within the four-node target limit, keeps the pinned
image, and reads the API key from the existing
`training-provider-credentials` Secret. It is ready for human
review; it has not been approved or applied.

This is a deterministic example of an agent-produced change. It is not a
transcript from a named model.

## What changed

| Check | Unchecked proposal | Reviewed candidate |
| --- | --- | --- |
| Requested training nodes | 8; target limit is 4 | 4; target limit is 4 |
| Image | mutable tag; warning | digest pinned; pass |
| API key | unresolved placeholder; block | existing Secret reference; pass |
| ConfigHub schema function | not run | not run |
| Production approval | not reached | required, not run |
| Apply and observation | not run | not run |

## Open the evidence

- [Unchecked proposal](./proposal.yaml)
- [Reviewed candidate](./reviewed.yaml)
- [Receipt](./receipt.yaml)
- [Maintained scenario](../../config-catalog/demonstrations/ai-change-review.yaml)
- [AICR source object](../../examples/aicr/eks-h100-training-kubeflow/argocd-helm-bundle/013-kubeflow-trainer-post/templates/torch-distributed-cluster-training-runtime.yaml)
- [Standard apply policy](../../config-catalog/policies/catalog-standard.yaml)

Run:

```bash
npm run ai-change-review:verify
npm run ai-change-review:self-test
```
