# Keep one exact configuration and see when to stop

**Draft Guide exercise.** Inspect a retained Redis configuration without an
account, registry or cluster. Finish with a complete local record you can review
or hand to an assistant, and a refusal showing that a changed pin does not select
another configuration. This exercise does not install Redis.

Audience: a developer or operator inspecting a candidate, or an assistant doing
the same task. The proposed Guide owner is unassigned. Publication admission,
independent user trials and measured completion time remain outstanding in
[#1869](https://github.com/confighub/helm-expt/issues/1869).

## Start

Use Node.js and this repository checkout, with the committed Catalog and lookup
adapter present. Run from the repository root. This uses the repository adapter
introduced in [#1867](https://github.com/confighub/helm-expt/pull/1867); it is not a
new cub command or shipped plugin. The [retained exercise evidence](../../data/workshop-catalog-guide-proof/summary.md)
binds the exact files used by the core success and refusal commands.

Create a fresh directory for your two answers. If it already exists, choose a
new directory before continuing so you keep the earlier results.

```sh
mkdir catalog-inspection
```

## Keep the exact candidate

Select the reviewed record and require its configuration digest. This digest is
for the canonical object set; a chart archive or OCI manifest digest is different.

```sh
node scripts/lookup-catalog-record.mjs --name bitnami-redis-25-5-3-default --configuration-digest 175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e > catalog-inspection/record.json
```

Expect exit **0** and `status: found`. Open `catalog-inspection/record.json` and
check these fields; keep the entire response, not just this short selection:

| Field | What this fixture says |
| --- | --- |
| `record.spec.source` | Bitnami Redis 25.5.3, default selection, with source and package references |
| `record.spec.configuration.objectCount` | 14 objects |
| `record.spec.configuration.digestRole` | `canonical-object-set` |
| `record.spec.inputs.installTimeStatus` | `not-yet-declared`; do not invent a free-form install surface |
| `record.spec.assessment.stages` | Destination and post-deployment are `not-run` |
| `catalog.sha256` | Exact index bytes read in this checkout |
| `selectedRecordSha256` | Canonical JSON identity of the returned complete record |

A match answers “is this the indexed configuration I asked for?” It does not
verify signatures, recompute the object set or decide whether a target can run
it. Local Catalog edits affect the result and reported hash. Retain both hashes
and the checkout revision alongside your review.

## Try a pin that must be refused

This deliberately wrong digest checks that lookup stops instead of replacing
your selection. Its nonzero exit is the expected outcome, not a broken example.

```sh
node scripts/lookup-catalog-record.mjs --name bitnami-redis-25-5-3-default --configuration-digest ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff > catalog-inspection/refusal.json
```

Expect exit **4**, `status: digest-mismatch`, the expected and observed digest,
and **no `record` field**. Investigate which source or reviewed pin changed before
retrying. Do not automatically accept the newly observed digest. A missing record
name instead returns exit 3; invalid input returns exit 2 with a sanitized error.

## Source, representation and authority

| Point in the journey | State after this exercise |
| --- | --- |
| Authored source | The record identifies the chart, default selection and retained render-intent file. |
| Materialization | Existing object and revision evidence is referenced; this exercise does not rerender it. |
| ConfigHub representation | Not created. The retained Catalog record is a preview of the candidate and its boundaries, not a Component or Unit. |
| Delivery and observation | Not performed. No destination or post-deployment pass is added. |
| Authority and next edit | Source ownership remains as recorded. This read-only lookup takes no authority and makes no configuration edit. Review the recorded source/variant ownership before adapting a candidate. |

The successful anonymous outcome is the retained exact record. The justified
stop is the retained refusal. Both are useful without signup. Import, delivery,
promotion and live rollback require their own prerequisites and evidence.

A local coding assistant can run these same repository commands and inspect the
JSON. That is not an API call from a live chat session. Equivalent cub/plugin and
connected API routes remain [#1861](https://github.com/confighub/helm-expt/issues/1861).
For further inspection, use the exact source/object references in the record and
its [lookup contract](../../docs/reference/catalog-record-lookup.md); do not infer
a runnable deployment from the successful lookup.

This draft's [scope and evidence record](../../data/workshop-guides/admissions/catalog-inspection-v1.json)
connects it to Guide G-E1 and story S-E1. Its checks validate the exact local
lookup and refusal, not a new render or deployment. Publication remains blocked
until an accountable owner and the required review are in place.
