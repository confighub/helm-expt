# GPU workload versus supplied Node facts

Trial root: `.`  
Plugin checkout: `./plugin`  
Scope: offline supplied Node snapshot; no cluster, account, registry, credentials, or publishing used.

## Outcomes

| Case | Receipt | Exit | Establishes |
|---|---|---:|---|
| Original facts: matching H100 label and 2 allocatable GPUs | `outcomes/candidate.json` | 0 | The supplied snapshot contains one node satisfying the workload's selector and 2 GPU per replica requirement. Status is `candidate`, not readiness or scheduling proof. |
| Copied facts with GPU quantity changed from 2 to 1 | `outcomes/mismatch.json` | 1 | The exact node label passes, but the per-node GPU quantity fails; the workload cannot be qualified from this snapshot. |
| Original facts with only `status.allocatable[nvidia.com/gpu]` removed | `outcomes/unknown-final.json` | 3 | Missing GPU data is preserved as `unknown`, rather than treated as zero or a match. The label still passes, but the GPU check is unknown. |

Each JSON receipt includes workload and target SHA-256 values, per-node checks, `liveChecked: false`, `execution: not-run`, omitted checks, and a next action. The original supplied inputs remain in `inputs/model.yaml` and `inputs/nodes.yaml`; modified copies are `inputs/mismatch-nodes.yaml` and `inputs/unknown-nodes.yaml`.

## Help and friction

The local site route and plugin README clearly described `cub app match ... --json --out`, expected statuses, exit codes, and the limits of the comparison. The first shell attempt used paths relative to the plugin while the shell workdir was already `plugin`, yielding `ENOENT`/exit 127 and no receipt; this was a harness path error, then corrected by using absolute trial paths. A first copy of the unknown fixture retained the GPU line due to an over-specific edit, producing a candidate; that intermediate output is retained as `outcomes/unknown.json` and the corrected missing-fact run is `unknown-final.json`.

## Decision and next action

This helped decide that the matcher distinguishes sufficient supplied capacity, explicit insufficient capacity, and absent capacity without contacting a target. Next action for real qualification is to obtain a fresh, authorized Node snapshot and separately verify free GPUs, memory/partitioning, runtime compatibility, scheduling, serving readiness, storage, credentials, entitlement, and an inference response.

## Limits

Proven: deterministic selector and allocatable-GPU comparison for this KServe InferenceService and one supplied Node document; hashes and receipts are retained.  
Unknown: snapshot authenticity/freshness, free capacity, GPU memory/partitioning, all other resources, taints/affinity/readiness/quotas/scheduling, replica placement/autoscaling, serving controllers/API, registry credentials/model entitlement, and application response.  
Not run: deployment, cluster access, inference, registry operations, ConfigHub operations, or timing measurement.
