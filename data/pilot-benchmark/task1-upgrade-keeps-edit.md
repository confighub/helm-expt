# Benchmark task 1: keep a replica edit across a chart upgrade

Run live on 2026-07-05, both arms on the same kind cluster (`hx-bench-1`).
The task: install redis 25.5.3, change the replica count to 2 (chart default
3), upgrade the chart to 27.0.0, and keep the change. Then: what record exists
of *why* replicas is 2, discoverable from the system alone?

This is not a rigged "bare helm fails". A competent engineer with plain helm
can keep the change. The benchmark measures the safety margin and the record,
not just the happy path.

## Bare arm (helm + kubectl, no substrate)

The agent installed redis 25.5.3 and set `replica.replicaCount=2` through the
helm release values (a `values-redis.yaml` file, not a `kubectl` edit) — the
right way. Then the upgrade to 27.0.0 was run three ways to find the margin:

| How the upgrade was run | Replicas after | Outcome |
| --- | --- | --- |
| `helm upgrade --version 27.0.0 --reuse-values` (careful) | 2 | **kept** — survives when the flag is remembered |
| `helm upgrade --version 27.0.0 --set auth.password=… ` (flag forgotten) | 3 | **silently reverted** — STATUS: deployed, no warning |

The ops requirement vanished on one forgotten flag, with no error. The record
of *why* replicas was 2 exists only if the engineer hand-wrote a helm
`--description` (optional; often blank) and kept the local `values-redis.yaml`.
Lose the file or forget `-f`/`--reuse-values` on any future upgrade and the
requirement reverts, silently.

## Pilot arm (the substrate)

The replica edit is a recorded revision (`Staging departure: 2 replicas, a
local decision that must survive upstream refreshes`). The chart upgrade to
27.0.0 arrived as an `UpgradeUnit` revision that **merged** with the local
edit; the departure survived by the merge semantics, not by anyone remembering
a flag. Applied live to the bench cluster: `redis-replicas` at **2 replicas on
chart 27.0.0**.

Crucially, the *why* is enforced, not optional. `cub revision list` shows the
edit, its change description, and the upgrade arriving, forever, queryable from
the org with no local file to keep.

## Score

| Dimension | Bare (careful) | Bare (one slip) | Pilot |
| --- | --- | --- | --- |
| Correct end state | yes | **no** (reverted) | yes |
| Silent failures | 0 | **1** (unwarned revert) | 0 |
| Survives without remembering a flag | no | no | **yes** (merge) |
| Record of *why*, from the system alone | optional (helm desc) | none | **enforced** (revision + change-desc) |
| Reproducible without a local file | no | no | **yes** |

## The honest conclusion

Both arms can produce the right end state. They differ in what happens when a
human is ordinary rather than careful. Plain helm keeps the change only while
every future upgrade remembers a flag and a file; one slip reverts an ops
requirement with no warning. The substrate keeps the change by construction and
records why. The Pilot advantage is not "helm cannot"; it is "helm will not
warn you when you forget, and keeps no enforced record of intent."
