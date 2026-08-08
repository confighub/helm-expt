# How far behind upstream the retained AICR versions are

**UNOFFICIAL/EXPERIMENTAL.** The snapshot is taken by
`npm run aicr-upstream-watch:run`, which is the only step that reaches the
network. The summary is rendered by `npm run aicr-upstream-watch:generate`
and checked offline by `npm run aicr-upstream-watch:verify`.

Retaining an exact version is a deliberate choice, and a deliberate choice
needs a number next to it. This measures the gap instead of leaving it to be
discovered when someone happens to look at a release page.

Everything below is measured against the snapshot's own timestamp,
**2026-08-08T15:49:54.745Z**, rather than against the clock. The record stays stable
until someone takes a new snapshot on purpose, and a stale snapshot is visible
as a date rather than hidden behind a moving number.

## The gap today

The catalog's newest retained version is upstream's newest release. There is no gap to report today, which is a fact with a date on it rather than a permanent state.

| Entry | Provenance | AICR version | Released | Releases published since |
| --- | --- | --- | --- | --- |
| `eks-h100-training-kubeflow` | retained-upstream | v0.14.0 | 2026-06-01 | 4 |
| `eks-h100-training-kubeflow-v0-18-0` | retained-upstream | v0.18.0 | 2026-07-23 | 0 |
| `eks-h100-inference-nim` | retained-upstream | v0.14.0 | 2026-06-01 | 4 |
| `cpu-starter` | derived | v0.14.0 | 2026-06-01 | 4 |

A derived entry carries the version of the entry it came from, so it moves when
that entry moves rather than on its own. Listing it here keeps the row count
equal to the number of entries whose freshness depends on an AICR release.

## Recent upstream releases

| Release | Published | In the catalog |
| --- | --- | --- |
| v0.18.0 | 2026-07-23 | retained |
| v0.17.0 | 2026-07-14 | not retained |
| v0.16.0 | 2026-06-30 | not retained |
| v0.15.0 | 2026-06-15 | not retained |
| v0.14.0 | 2026-06-01 | retained |
| v0.13.0 | 2026-05-16 | not retained |

## The cadence is computed now

The median gap between minor releases is **14 days**, over 9 intervals across 10 minor releases in this snapshot. The pages have been saying AICR ships roughly every two weeks, which the measurement supports. It was read off a release page by hand once and repeated since. It is derived now, so it can be wrong out loud rather than quietly.

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
