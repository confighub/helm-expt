# Compare two AICR GPU-node snapshots

This maintained example answers one question: **what differs between two GPU
nodes, and does the difference matter for each node's intended role?**

The snapshot diff finds two differences. It does not call either one a fault.
The baseline is assessed as an L40 node with Mellanox RDMA. The target is
assessed as an L40 node with standard networking. Both pass their selected
demonstration profiles. The same target produces two findings when it is
assessed against the RDMA profile.

## Observed differences

| Field | Baseline | Target |
| --- | --- | --- |
| `OS/kernel-cmdline/cmdline` | `quiet splash iommu=pt` | `quiet splash` |
| `OS/kernel-modules/nvidia_peermem` | `loaded` | `absent` |

## Variant-aware result

| Observation | Selected profile | Result | Findings | Not applicable |
| --- | --- | --- | ---: | ---: |
| Baseline | `l40-mellanox-rdma` | `pass` | 0 | 0 |
| Target | `l40-standard-networking` | `pass` | 0 | 2 |
| Target under baseline profile | `l40-mellanox-rdma` | `finding` | 2 | 0 |

The two profiles are maintained in
[`config-catalog/aicr-snapshot-profiles.yaml`](../../config-catalog/aicr-snapshot-profiles.yaml).
They demonstrate provider-owned target intent; they are not NVIDIA AICR leaves
or production hardware advice. The review keeps the profile catalog SHA-256,
the retained AICR source record SHA-256, both snapshot SHA-256 values, and every
field decision in [`review.yaml`](./review.yaml).

## What did not run

- No recipe or bundle was selected for the snapshot comparison.
- No configuration was generated or deployed.
- The recipe-dependent `expected-resources` check is blocked and not run when
  its declared components are absent. That is not failed GPU conformance.
- No GPU workload, RDMA transfer, model request, or performance test ran.

## Keep the result

The review can remain as files, be packed into a local OCI review artifact, or
be stored as three non-deployable ConfigHub Units. The commands are recorded in
[`review.yaml`](./review.yaml). Keeping the result preserves the two snapshot
digests and the intent used to interpret them.
