# Review an AI change before it is released

The example begins with a proposed change to an AICR PyTorch training runtime.
The unchecked proposal asks for eight H100 nodes when the recorded target limit is
four, replaces a digest-pinned image with `latest`, and leaves an API key as a
placeholder. The reviewed file uses four nodes, keeps the pinned image, and refers to
an existing Secret.

This live run uploaded that reviewed YAML to a temporary Space in the
`helm-catalog` ConfigHub organization. ConfigHub stored the same Kubernetes object
fields. Because the object is cluster-wide system configuration, ConfigHub blocked
the first dry-run apply until its exact head revision was approved. After approval,
the same dry run against the recorded OCI target was allowed.

| Check | Result |
| --- | --- |
| Reviewed object stored without field changes | Pass |
| Content hash changed during approval | No |
| Dry run before approval | Blocked |
| Revision selector | `HeadRevisionNum` |
| Recorded approvals | 1 |
| Dry run after approval | Allowed |
| Generic image and probe warnings | Reported, but not useful for this custom resource |
| Kubernetes apply | Not run |
| Temporary Space removed | Yes |

The standard ConfigHub checks and approval ran. The four-node capacity rule was
checked by the repository example; it is not yet a ConfigHub Function. The two
generic workload checks also reported image and probe warnings. They inspect the
ordinary workload-controller field shape and do not understand the deeper container
path in this AICR custom resource. Those warnings do not tell us whether this object
is safe. The policy needs AICR-aware checks or narrower generic checks.

Both apply attempts used `--dry-run` against an OCI target. This run did not publish
a release, read the referenced Secret, start a GPU workload, promote the change, roll
it back, or observe a cluster.

- [Reviewed AICR object](../ai-change-review/reviewed.yaml)
- [Unchecked proposal and local checks](../ai-change-review/summary.md)
- [Committed live receipt](../../runs/ai-change-review-live-proof/receipt.yaml)
- [Catalog policy](../../config-catalog/policies/catalog-standard.yaml)
