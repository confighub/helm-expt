# Check an AICR training change before it is released

This example sends two versions of the same AICR PyTorch
`ClusterTrainingRuntime` through ConfigHub. The first version asks for eight H100
nodes, changes a digest-pinned image to `latest`, and puts a placeholder API key
directly in the object. ConfigHub reports the mutable AICR image and blocks the
inline API key. It does not run Deployment image or probe checks against this custom
resource.

The reviewed version uses four nodes, restores the pinned image, and refers to an
existing Secret. Its AICR image and API-key checks are clear. The four-node capacity
limit is checked separately against the recorded target facts because the current
ConfigHub policy cannot read that target-specific value.

Both versions were uploaded to a temporary Space in the `helm-catalog` ConfigHub
organization. ConfigHub stored the reviewed Kubernetes fields without changing
them. Because this is cluster-wide system configuration, ConfigHub blocked the
reviewed version until its exact revision was approved. After approval, the same
dry run against the recorded OCI target was allowed.

| Check | Result |
| --- | --- |
| Mutable image in the unsafe AICR proposal | Reported |
| Inline API key in the unsafe AICR proposal | Blocked |
| Deployment image or probe warnings on either AICR object | None |
| AICR image and API-key findings on the reviewed object | None |
| Reviewed object stored without field changes | Pass |
| Content hash changed during approval | No |
| Dry run before approval | Blocked |
| Revision selector | `HeadRevisionNum` |
| Recorded approvals | 1 |
| Dry run after approval | Allowed |
| Kubernetes apply | Not run |
| Temporary Space removed | Yes |

All apply attempts used `--dry-run` against an OCI target. This run did not publish
a release, read the referenced Secret, start a GPU workload, promote the change,
roll it back, or observe a cluster.

- [Unsafe AICR proposal](../ai-change-review/proposal.yaml)
- [Reviewed AICR object](../ai-change-review/reviewed.yaml)
- [Local target-capacity check](../ai-change-review/summary.md)
- [Committed live receipt](../../runs/ai-change-review-live-proof/receipt.yaml)
- [Catalog policy](../../config-catalog/policies/catalog-standard.yaml)
