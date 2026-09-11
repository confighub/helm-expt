# Adapt a configuration and inspect the exact edit

Use this guide to review a single local configuration change. It compares two
files, reports object and field changes, and preserves the source hashes. It
does not merge files, upload anything, or contact ConfigHub or Kubernetes.

[Jump to the assistant task](#a-task-for-an-ai-assistant).
Complete the setup below first if this is your first Guide.

## Prerequisites and setup

You need Node.js, Git, and `cub` on your `PATH`. No account, credentials,
cluster, registry, Docker, Helm, or target access is needed. GitHub access is
needed to clone the reviewed source.

If you already completed setup for another Guide, return to that pinned
checkout and skip cloning and installation. Otherwise, start in a directory
that does not already contain `cub-workshop`:

```sh
git clone https://github.com/confighub/cub-workshop.git
cd cub-workshop
git checkout 56e261a87dc3b060a86474bc796d379dd9bb7f3d
cub plugin install "$PWD"
```

For every new adapt trial, including when reusing that checkout, run the
following from its root. Choose a fresh directory if this trial already exists.

```sh
mkdir adapt-demo
cp examples/adapt/prometheus-before.yaml adapt-demo/before.yaml
cp adapt-demo/before.yaml adapt-demo/after.yaml
```

Open `adapt-demo/after.yaml` and change only the Deployment
`spec.replicas` value from `1` to `2`. Keep `before.yaml` unchanged.

## Run the direct review

```sh
cub config diff adapt-demo/before.yaml adapt-demo/after.yaml --json --out adapt-demo/diff.json
```

Expected exit code: `0`. The JSON should identify Deployment
`monitoring/prometheus-server`, one changed field at `/spec/replicas`, and the
change from `1` to `2`. It retains hashes for both input files. `diff.json` is
review evidence; it is not approval and does not make the edit authoritative.

To use an exit status that distinguishes differences, run the same comparison
with `--exit-code` and a new output filename:

```sh
cub config diff adapt-demo/before.yaml adapt-demo/after.yaml --json --exit-code --out adapt-demo/diff-with-exit.json
```

Expected exit code: `1` because a difference exists. Malformed input and other
errors return `2`. Existing output files are protected; choose a new filename
when repeating the review.

Move the directory and rerun the comparison to check that the local files, hashes,
and findings travel together:

```sh
mv adapt-demo adapt-demo-moved
cub config diff adapt-demo-moved/before.yaml adapt-demo-moved/after.yaml --json --out adapt-demo-moved/recheck.json
```

## Keep unexpected edits visible

Make a separate candidate from the changed file:

```sh
cp adapt-demo-moved/after.yaml adapt-demo-moved/unexpected.yaml
```

In `unexpected.yaml`, change only the existing `spec.revisionHistoryLimit`
from `10` to `5`, then compare it with the unchanged baseline:

```sh
cub config diff adapt-demo-moved/before.yaml adapt-demo-moved/unexpected.yaml --json --out adapt-demo-moved/unexpected-diff.json
```

Expected exit code: `0`, with two changed fields: `/spec/replicas` (`1` to `2`)
and `/spec/revisionHistoryLimit` (`10` to `5`). Keep this candidate on review
hold because it exceeds the requested replica edit. The tool reports the
extra change; it does not automatically refuse or approve it.

If the result contains an unexpected field, keep that result for review and
repeat from fresh copies after deciding which edit is authorized. A successful
comparison means the files were compared; it does not authorize the change.

## A task for an AI assistant

Return to the pinned `cub-workshop` checkout root. Prepare a separate trial:

```sh
mkdir adapt-ai
cp examples/adapt/prometheus-before.yaml adapt-ai/before.yaml
cp adapt-ai/before.yaml adapt-ai/after.yaml
cd adapt-ai
```

Open Claude Code or Codex in this directory and paste the task below. Use
your normal tool approvals; do not disable them. Keep the resulting files
and the assistant report together.

```text
Use the prepared before.yaml and after.yaml in this directory. Using cub
config diff, inspect those local files. Change only the Deployment
monitoring/prometheus-server spec.replicas value in after.yaml from 1 to 2;
never change before.yaml. Save the JSON result to diff.json and report the exit
code, both input hashes, the changed JSON pointer, and its old and new values.
Repeat with --exit-code to diff-with-exit.json (expected exit 1). Move the
whole directory by running cd .., then mv adapt-ai adapt-ai-moved, then
cd adapt-ai-moved. Rerun there to recheck.json;
compare hashes and findings. Then copy after.yaml to unexpected.yaml, change only
spec.revisionHistoryLimit from 10 to 5 in that copy, and run a second diff
against the unchanged before.yaml to a fresh output file. Expect two field
changes and retain them for reviewer inspection; this is a review hold, not an
automatic refusal. Do not install, upload, publish, deploy, contact ConfigHub
or Kubernetes, or read credentials. Explain that this is a local comparison
and does not prove an upstream merge, schema validity, approval, or runtime
health.
```

The [retained source metadata](https://github.com/confighub/cub-workshop/blob/56e261a87dc3b060a86474bc796d379dd9bb7f3d/examples/adapt/source.json)
and [input excerpt](https://github.com/confighub/cub-workshop/blob/56e261a87dc3b060a86474bc796d379dd9bb7f3d/examples/adapt/prometheus-before.yaml)
establish the local source scope. The excerpt is one Deployment, not a full
Prometheus chart. Mapping and document order are ignored;
array order, null, missing values, and duplicate identities remain meaningful.
The result demonstrates source files and a materialized comparison only:
ConfigHub creation and delivery are not run. Continue with the [match guide](./workshop-match-guide.md)
for supplied target facts.

For a new field rather than a changed replica count, use [Add a field and restore
the source](./workshop-field-restore-guide.md). It also explains why an exact
local restoration is different from live rollback.
