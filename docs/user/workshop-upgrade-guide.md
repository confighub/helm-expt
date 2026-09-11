# Review a chart upgrade before promoting it

Compare retained Redis 25.5.3 and 27.0.0 configurations and save a review packet.
This Guide completes an offline candidate review. It does not upgrade a cluster,
approve a release or establish application/data compatibility.

## Set up the pinned inputs

You need Git, Node.js and `cub`; no Helm, account, registry, Docker or cluster is
needed. Install the pinned Workshop plugin using the
[Adapt setup](./workshop-adapt-guide.md#prerequisites-and-setup). In a separate
working directory that does not already contain `helm-expt`, obtain the retained
Catalog inputs:

```sh
git clone https://github.com/confighub/helm-expt.git
cd helm-expt
git checkout ed7efffe485b582b41f8d48dc568c8b85492fb74
mkdir upgrade-review
cp recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml upgrade-review/current.yaml
cp recipes/bitnami/redis/27.0.0/revisions/default/r001/rendered/release-objects.yaml upgrade-review/candidate.yaml
cp config-catalog/demonstrations/ai-upgrade-risk.yaml upgrade-review/source-reference.yaml
```

Keep the original copies. These are committed desired-state renders, not fresh
observations of your production system. The source reference identifies both
recipe paths and chart versions. The same image can appear in different chart
versions; a chart version change alone does not tell you which workload fields
changed.

## Produce the exact comparison

```sh
cub config diff upgrade-review/current.yaml upgrade-review/candidate.yaml --json --out upgrade-review/comparison.json
```

Expected exit: `0`. Open the JSON and review all changed objects and fields,
including label/version metadata. Keep both input hashes and the object summary.
There are no added or removed objects in this retained pair. This does not mean
there are no differences, and a successful command does not mean the upgrade is
safe.

Compare your findings with the retained risk evidence at
`data/ai-upgrade-risk/render-facts.yaml` and its receipt. That check covers
specific removed-object, immutable-field and image-change signals; it is not an
oracle for all Kubernetes admission rules, policies or application migrations.
Do not turn a low result on those checks into general production approval.

## Write the review decision

Create `upgrade-review/review.md` with these sections and actual findings:

| Section | What to retain |
| --- | --- |
| Source | Repository revision, both chart versions, recipe paths and input hashes. |
| Exact changes | Every changed object and field from the JSON, including metadata changes. |
| Protected intent | Values or overlays your team requires to survive; for this anonymous exercise no team-owned overlay has been supplied, so mark preservation untested. |
| Preconditions | Hook/CRD ordering, operator dependencies, policy, target capabilities, credentials and storage/migration questions that need target-specific evidence. |
| Decision | Local comparison complete; production promotion on hold pending the missing evidence and authorized approval. |
| Recovery | Prior reviewed configuration, storage/data recovery plan and actual rollback rehearsal evidence needed before a live release. |

To demonstrate a meaningful review hold, make a separate copy:

```sh
cp upgrade-review/candidate.yaml upgrade-review/unexpected.yaml
```

In that copy, change only one workload's `metadata.name`, leaving all other
fields unchanged. Save its comparison to a new file:

```sh
cub config diff upgrade-review/current.yaml upgrade-review/unexpected.yaml --json --out upgrade-review/unexpected-comparison.json
```

Expect exit `0` and an added/removed object pair caused by the changed identity,
in addition to the ordinary version differences. Record the unexpected
replacement in your review. Do not repair the input to make the report look
clean, and do not treat exit `0` as authorization to replace the workload.

## A task for an assistant

Start a fresh session in the prepared directory with normal approvals:

```text
Compare current.yaml and candidate.yaml with cub config diff, saving the full
JSON. Use source-reference.yaml to retain their version/source identities.
Read every changed object and field. Write review.md separating observed
changes from untested protected intent, target prerequisites, migration and
rollback questions. Do not infer safe promotion from exit 0 or from a narrow
low-risk classification. Make a separate unexpected.yaml candidate, change
only one workload metadata.name, compare it to the original and keep the
added/removed pair on review hold. Preserve all files and report actual exit
codes and hashes. Do not contact a cluster, ConfigHub or registry, publish,
approve or deploy anything.
```

## Where the next step belongs

The outcome is a local review packet. ConfigHub representation is not created;
approval, delivery, runtime observation and data recovery are not run. In a real
workflow, update the authored chart/values/overlay source, retain the new candidate
under the established ConfigHub authority, and advance the reconciler's desired
reference only through its approved release process. A written review does not
perform that transition.

Use the [hooks and CRDs Guide](./workshop-lifecycle-guide.md) to identify hidden
lifecycle work. The [field and restore Guide](./workshop-field-restore-guide.md)
shows exact local restoration; live rollback additionally needs evidence that
the old revision can run against the resulting data and target state.
