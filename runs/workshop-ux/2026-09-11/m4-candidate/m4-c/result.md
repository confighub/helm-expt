# GPU workload matching trial

Guide: `http://127.0.0.1:8768/site/d/docs/user/workshop-match-guide.html` (discovered from `site/index.html`). The pinned plugin checkout is `./plugin`; the installed CLI plugin copy is under `./cli/plugins/plugin`. All `cub` commands used `CUB_CONFIG=./cli/config.yaml` and ran offline.

The copied workload `./inputs/workload.yaml` declares KServe InferenceService `llama3-8b-instruct-2xh100`, requiring 2 NVIDIA GPUs per replica and selector `nvidia.com/gpu.product=NVIDIA-H100-SXM4-80GB`. Its SHA-256 is `a87b0aec9b6d8b3d34bb645fa6bd3ef1957160aa5cd3104e9004b050b2f984e6`.

| Case | Facts | Result / exit | Establishes |
|---|---|---|---|
| Supplied facts | `./inputs/nodes-supplied.yaml` (H100 label, allocatable GPU 2; SHA `8c5540977b4d9f0492f24493aef521e82a78d9425a10ad36737d6c073124eae5`) | `results/candidate.json`, `candidate.exitcode`: `candidate`, 0 | The supplied snapshot satisfies the declared selector and per-node GPU count. |
| Insufficient GPU | `./inputs/nodes-insufficient-gpu.yaml` (same label, GPU 1; SHA `e7fc2f27e9925bbe4d5847dd478ff09a1a1969d78b7a7c9e760eec26d37ccadf`) | `results/mismatch.json`, `mismatch.exitcode`: `mismatch`, 1 | The node has the right label but cannot satisfy the 2-GPU-per-replica requirement. |
| Missing GPU fact | `./inputs/nodes-missing-gpu.yaml` (same label, allocatable GPU omitted; SHA `b4ecb53a9912e33f94761e9bb53772ee7573737c214b2e1d77272e9fb8d439a7`) | `results/unknown.json`, `unknown.exitcode`: `unknown`, 3 | Missing allocatable GPU data prevents a conclusion; it is not treated as zero or a match. |

Each JSON receipt records `execution: not-run`, `liveChecked: false`, input hashes, per-node checks, omitted checks, and next action. The candidate is only a static qualification input. It does not establish snapshot freshness/authenticity, free GPUs or occupancy, GPU memory/partitioning, runtime compatibility, scheduling/taints/affinity, other resources, serving readiness, credentials, entitlement, or inference response. No cluster, ConfigHub, registry, credentials, or setup-excluded system was contacted.

What helped decide: the Guide's explicit expected statuses/exit codes and the deterministic matcher checks. Next action: for the candidate, qualify the exact workload against an authorized, fresh target; for mismatch, choose a node with the requested label and at least 2 GPUs per node or change the retained workload; for unknown, supply the missing GPU fact. Proven: only the three static comparison outcomes above. Unknown: all omitted checks. Not run: deployment, scheduling, runtime, or inference. Friction: the first repeated unknown output name was protected by the CLI, so a fresh output name was used and retained as `results/unknown-fresh.json` with its log and exit code.
