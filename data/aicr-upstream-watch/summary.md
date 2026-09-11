# How far behind upstream the watched AICR entries are

**UNOFFICIAL/EXPERIMENTAL.** The snapshot is taken by
`npm run aicr-upstream-watch:run`, which is the only step that reaches the
network. The summary is rendered by `npm run aicr-upstream-watch:generate`
and checked offline by `npm run aicr-upstream-watch:verify`.

Retaining an exact version is a deliberate choice, and a deliberate choice
needs a number next to it. This measures the gap instead of leaving it to be
discovered when someone happens to look at a release page.

This watch contains 6 entries: the intersection of the AICR naming
register and published platform evidence naming upstream `NVIDIA AICR`.
Generated overlay records without matching platform evidence are outside this
watch. That exclusion is a scope boundary, not evidence that those records are
absent from the repository or a claim about the newest version in the whole
catalog.

Everything below is measured against the snapshot's own timestamp,
**2026-09-10T08:04:24.469Z**, rather than against the clock. The record stays stable
until someone takes a new snapshot on purpose, and a stale snapshot is visible
as a date rather than hidden behind a moving number.

## The gap today

The newest version in this watch is 2 release(s) and 16 days behind upstream's newest.

| Entry | Provenance | AICR version | Released | Releases published since |
| --- | --- | --- | --- | --- |
| `eks-h100-training-kubeflow` | retained-upstream | v0.14.0 | 2026-06-01 | 8 |
| `eks-h100-training-kubeflow-v0-18-0` | retained-upstream | v0.18.0 | 2026-07-23 | 4 |
| `eks-h100-training-kubeflow-v0-19-0` | retained-upstream | v0.19.0 | 2026-08-10 | 3 |
| `eks-h100-training-kubeflow-v0-20-0` | retained-upstream | v0.20.0 | 2026-08-24 | 2 |
| `eks-h100-inference-nim` | retained-upstream | v0.14.0 | 2026-06-01 | 8 |
| `cpu-starter` | derived | v0.14.0 | 2026-06-01 | 8 |

A derived entry carries the version of the entry it came from, so it moves when
that entry moves rather than on its own. Listing it here keeps the row count
equal to the number of AICR-dependent entries within this watch.

## Recent upstream releases

| Release | Published | In this watch |
| --- | --- | --- |
| v0.21.1 | 2026-09-09 | outside this watch |
| v0.21.0 | 2026-09-08 | outside this watch |
| v0.20.0 | 2026-08-24 | watched |
| v0.19.0 | 2026-08-10 | watched |
| v0.18.0 | 2026-07-23 | watched |
| v0.17.0 | 2026-07-14 | outside this watch |

## The cadence is computed now

The median gap between minor releases is **14 days**, over 12 intervals across 13 minor releases in this snapshot. The pages have been saying AICR ships roughly every two weeks, which the measurement supports. It was read off a release page by hand once and repeated since. It is derived now, so it can be wrong out loud rather than quietly.

The measurement covers minor releases only. This project publishes several tags
on one day, so a median across every tag would be a day and would say nothing
about how fast the platform moves. What a retained version cares about is when
the next minor lands.

That number is what makes retention a decision rather than neglect. A version
retained today falls a release behind within about 14 days whatever
anyone intends, and the catalog's answer is to retain deliberately and record
the distance rather than chase the tag.

## What this does not do

It does not decide anything. A gap is not a defect, and closing one costs a new
entry with its own receipts, which
[the refresh brief](../../docs/planning/aicr-version-refresh-brief.md) works
out in full. This lane exists so that decision is made against a measured
number.

It also says nothing about what changed between versions. That is
[the version diff](../aicr-version-diff/summary.md), which compares the
retained entries byte for byte.

The snapshot is a record of what upstream listed at one moment, taken from
https://api.github.com/repos/NVIDIA/aicr/releases?per_page=30. No cluster, no organization, and no GPU workload is involved,
and nothing here downloads or runs an upstream artifact.
