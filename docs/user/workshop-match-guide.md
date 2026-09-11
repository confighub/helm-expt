# Match a GPU workload with supplied facts

Use this guide to compare a retained KServe workload with a supplied Node
snapshot. The snapshot is an input file, not a target observation. The workflow
does not contact a cluster, schedule a workload, or run inference.

[Jump to the assistant task](#a-task-for-an-ai-assistant).
Complete the setup below first if this is your first Guide.

## Prerequisites and setup

You need Node.js, Git, and `cub` on your `PATH`. No ConfigHub account,
credentials, cluster, Docker, registry, Helm, or GPU target is needed. GitHub
access is needed to clone the reviewed source.

Missing a tool? Install [Node.js](https://nodejs.org/en/download),
[Git](https://git-scm.com/downloads), and the
[cub CLI](https://docs.confighub.com/get-started/setup/#install-the-cli).
The local steps in this Guide do not require signup or login.
For the CLI version used in the retained local trials, choose the matching
[cub v0.4.4 release binary](https://github.com/confighub/sdk/releases/tag/v0.4.4).
Check `node --version`, `git --version`, and `cub version` in the terminal or
assistant session you will use, then install the pinned plugin below.

If you already completed setup for another Guide, return to that pinned
checkout and skip cloning and installation. Otherwise, start in a directory
that does not already contain `cub-workshop`:

```sh
git clone https://github.com/confighub/cub-workshop.git
cd cub-workshop
git checkout 56e261a87dc3b060a86474bc796d379dd9bb7f3d
cub plugin install "$PWD"
```

For every new match trial, including when reusing that checkout, run the
following from its root. Choose a fresh directory if this trial already exists.

```sh
mkdir match-demo
cp examples/match/model.yaml match-demo/model.yaml
cp examples/match/nodes.yaml match-demo/nodes.yaml
```

The model declares two GPUs per replica and a node selector. The supplied node
file contains illustrative facts used by the static matcher.

## Produce candidate, mismatch, and unknown results

Run the candidate case and retain its JSON:

```sh
cd match-demo
cub app match model.yaml --target nodes.yaml --json --out candidate.json
```

Expected exit code: `0`, with `status: "candidate"`.

Copy the original Node facts:

```sh
cp nodes.yaml mismatch-nodes.yaml
```

In `mismatch-nodes.yaml`, change only `status.allocatable.nvidia.com/gpu`
from `2` to `1`, then run:

```sh
cub app match model.yaml --target mismatch-nodes.yaml --json --out mismatch.json
```

Expected exit code: `1`, with `status: "mismatch"`. Preserve the mismatch.

Make a fresh copy of the original facts:

```sh
cp nodes.yaml unknown-nodes.yaml
```

In `unknown-nodes.yaml`, remove only the `nvidia.com/gpu` line under
`status.allocatable`, then run:

```sh
cub app match model.yaml --target unknown-nodes.yaml --json --out unknown.json
```

Expected exit code: `3`, with `status: "unknown"`. Missing data is unknown; it
must not be treated as zero or as a match. Do not chain these deliberate
nonzero cases with `&&`. Use new output filenames when repeating a run because
existing outputs are protected.

If a case refuses because an input is malformed or exceeds a bound, retain the
sanitized error and repair a fresh copy. For a repeatable comparison, start
with fresh copies of the original model and node snapshot; never turn an
unknown fact into a value merely to obtain a candidate.

## A task for an AI assistant

Return to the pinned `cub-workshop` checkout root. Prepare a separate trial:

```sh
mkdir match-ai
cp examples/match/model.yaml match-ai/model.yaml
cp examples/match/nodes.yaml match-ai/nodes.yaml
cd match-ai
```

Open Claude Code or Codex in this directory and paste the task below. Use
your normal tool approvals; do not disable them. Keep the resulting files
and the assistant report together.

```text
Use the prepared model.yaml and nodes.yaml in this directory. Use cub app match to save candidate.json. Before editing either case,
make two separate copies of the original nodes.yaml: in one, change only
allocatable nvidia.com/gpu from 2 to 1 and save mismatch.json; in the other,
remove only that GPU fact and save unknown.json. Preserve the original model
and nodes files. Report each exit code, status, input hashes, per-node findings,
and omitted checks. Do not contact a cluster, ConfigHub, registry, credentials,
or a live target, and do not claim scheduling, runtime, model entitlement, or
inference proof. A nonzero mismatch or unknown result is an expected finding,
not permission to repair the input.
```

The [retained workload](https://github.com/confighub/cub-workshop/blob/56e261a87dc3b060a86474bc796d379dd9bb7f3d/examples/match/model.yaml),
[illustrative facts](https://github.com/confighub/cub-workshop/blob/56e261a87dc3b060a86474bc796d379dd9bb7f3d/examples/match/nodes.yaml),
and [recorded task scope](https://github.com/confighub/cub-workshop/blob/56e261a87dc3b060a86474bc796d379dd9bb7f3d/tasks/match-local.md)
are the evidence boundary. The matcher demonstrates source files to static
comparison results; it does not prove that the nodes are reachable, have free
GPUs, satisfy runtime compatibility or scheduling constraints, or can serve an
inference response. Continue with the [compose guide](./workshop-compose-guide.md)
for a saved multi-component stack.
