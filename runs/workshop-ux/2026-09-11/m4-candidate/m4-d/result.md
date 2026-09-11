# GPU workload versus supplied Node facts

The retained workload `llama3-8b-instruct-2xh100` requires the label `nvidia.com/gpu.product=NVIDIA-H100-SXM4-80GB` and 2 GPUs per replica. The Node fixture is explicitly illustrative, not a live observation.

| Case | Result | What it establishes |
|---|---|---|
| Supplied Node facts | `candidate`, exit 0 | The one supplied node has the requested label and allocatable GPU quantity 2. This is enough for a candidate comparison against the supplied snapshot. |
| Same node with allocatable GPU changed to 1 | `mismatch`, exit 1 | The exact label still matches, but one node cannot satisfy the workload's per-replica 2-GPU requirement. |
| Same node with allocatable GPU fact removed | `unknown`, exit 3 | The label matches, but missing GPU data prevents a conclusion; missing is not treated as zero or as a match. |

Receipts, copied inputs, logs, and exit-code files are listed in `./trial-log.md`.

Proven: only the declared selector and per-node allocatable GPU comparisons for these supplied YAML inputs, with source hashes in each JSON receipt. Unknown: whether the snapshot is authentic or current, whether GPUs are free, GPU memory/partitioning/runtime compatibility, other resources, scheduling/taints/affinity/replica placement, controllers, storage, credentials, entitlement, and inference behavior. Not run: deployment, cluster access, ConfigHub, registry, credentials, or live inference.

Next action: supply a fresh, authorized Node export and rerun; then qualify the exact workload on the target, including the omitted runtime, capacity, scheduling, platform, entitlement, and inference checks. The candidate result must not be called ready.
