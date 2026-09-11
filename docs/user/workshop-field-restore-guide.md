# Add one field and keep the original configuration

Add a label to the retained Prometheus Deployment, inspect exactly what changed,
and restore a separate copy of the original file. Finish with the source,
candidate, comparison and restored file together. No account or cluster is
needed. This is a local configuration review, not a chart upgrade or deployment.

[Jump to the assistant task](#give-the-same-task-to-an-assistant).
Complete the setup below first if this is your first Guide.

## Start from a pinned source

You need Git, Node.js and `cub` on your PATH. GitHub access is needed for setup;
no registry, Docker, Helm, credentials or target access is needed. If you already
installed the source below for another Workshop Guide, return to that exact
checkout and skip only this installation block:

```sh
git clone https://github.com/confighub/cub-workshop.git
cd cub-workshop
git checkout 56e261a87dc3b060a86474bc796d379dd9bb7f3d
cub plugin install "$PWD"
```

From the checkout root, prepare a new trial every time:

```sh
mkdir field-review
cp examples/adapt/prometheus-before.yaml field-review/source.yaml
cp examples/adapt/source.json field-review/source-reference.json
cp field-review/source.yaml field-review/candidate.yaml
```

If `field-review` exists, stop and choose a fresh trial directory; do not reuse
or overwrite its outputs. The source is one Deployment excerpt, not the full
Prometheus chart. Keep `source.yaml` unchanged throughout the exercise.

## Add a field that the materialized object can carry

Open `field-review/candidate.yaml`. Under the **top-level** `metadata.labels`,
add this entry alongside the existing labels:

```yaml
    workshop.confighub.com/review: reviewed
```

Do not add it to the Pod template or selector. Do not change the object name,
namespace, image, replicas or existing labels. Review the candidate:

```sh
cub config diff field-review/source.yaml field-review/candidate.yaml --json --out field-review/addition.json
```

Expected exit: `0`. Inspect `addition.json`:

- `equal` is `false` and exactly one object is changed, with none added or removed.
- The object is Deployment `monitoring/prometheus-server`.
- Its only field change is `operation: "add"`, path
  `/metadata/labels/workshop.confighub.com~1review`, value `reviewed`.
- Both input hashes are retained and differ.

`~1` is how a slash in the label key is represented in a JSON pointer; it is not
part of the actual label name. A successful diff means comparison succeeded. It
does not validate the label against admission policy or authorize deployment.

This is useful when you need an explicit edit to materialized configuration.
It does not prove that the chart lacks an equivalent values key. Before using
this change beyond the exercise, decide whether its ongoing source should be
chart values, a maintained overlay, or a governed variant. The next chart render
will not automatically preserve an edit made only to this local YAML file.

## Detect an unintended object replacement

Preserve the candidate, then make a separate bad copy:

```sh
cp field-review/candidate.yaml field-review/wrong-name.yaml
```

In that copy, change only the top-level `metadata.name` from
`prometheus-server` to `prometheus-server-copy`. Compare it with the original:

```sh
cub config diff field-review/source.yaml field-review/wrong-name.yaml --json --out field-review/review-hold.json
```

Expected exit: `0`, with one removed object and one added object, not one changed
object. Name is part of object identity. Keep this result on review hold: it
exceeds the requested label addition. The comparison does not automatically
refuse the candidate, and exit `0` does not approve it. Keep the failed candidate
and its review result rather than silently repairing them.

## Restore the exact local source

Copy the original to a new file; retain the candidate and both prior results:

```sh
cp field-review/source.yaml field-review/restored.yaml
cub config diff field-review/source.yaml field-review/restored.yaml --json --out field-review/restoration.json
cmp field-review/source.yaml field-review/restored.yaml
```

Both commands should exit `0`. The JSON has `equal: true`, one unchanged object,
no changes, and equal `before.sha256` and `after.sha256`. `cmp` establishes byte
identity as well. Configuration equality alone is weaker: comments or mapping
order can change the bytes without changing the compared objects.

If hashes differ, keep that result and investigate the file choice or edit;
do not declare an exact restoration solely because `equal` is true. Missing or
malformed input is an error, not an empty successful comparison. Existing JSON
outputs are protected; use new filenames for retries.

You have restored a local file, not an earlier live revision. Nothing here
reverses a schema migration, recovers a volume, rolls back a controller, or proves
that a workload will start. A live rollback needs the target's prior good revision
and separate evidence that reversing the change succeeds without losing data.

## Give the same task to an assistant

Prepare a fresh trial directory with the pinned `source.yaml` and
`source-reference.json`. Start Claude Code or Codex there with normal approvals:

```text
Preserve source.yaml and its source-reference.json. Copy source.yaml to
candidate.yaml and add only workshop.confighub.com/review: reviewed under the
top-level metadata.labels. Use cub config diff to save addition.json. Report
the object identity, operation, JSON pointer and both hashes. Make a separate
wrong-name.yaml from the candidate and change only metadata.name to
prometheus-server-copy. Save its comparison with the original as
review-hold.json; explain why it exceeds the requested edit. Do not fix or
approve that candidate. Copy the original to restored.yaml, compare it into
restoration.json and check exact byte identity with cmp. Keep all files and
report actual exit codes. Do not contact ConfigHub, a cluster or registry,
read credentials, upload or deploy. Explain which source should own the next
edit, and why restoring this file proves nothing about live rollback or data
recovery.
```

## What you have, and what comes next

| Stage | Result |
| --- | --- |
| Source | Pinned Deployment excerpt and its retained source reference; original bytes preserved. |
| Materialization | Local candidate, exact comparison, name change held for review and exact source copy. No chart rerender. |
| ConfigHub representation | Not created. These files are not stored Units, Components or approved revisions. |
| Delivery and observation | Not run; no target or application was contacted. |
| Authority and next edit | The local trial takes no ongoing authority. Choose the actual source owner and representation before carrying the edit forward. |

Use the [Adapt Guide](./workshop-adapt-guide.md) to inspect a replica change and
an unexpected extra edit, or [Compose](./workshop-compose-guide.md) to retain and
resume a complete multi-component workspace. For real upgrades, start with the
[upgrade risk walkthrough](./helm-upgrade-crash-example.md); local restoration
alone does not satisfy its rehearsal, approval or observation requirements.
