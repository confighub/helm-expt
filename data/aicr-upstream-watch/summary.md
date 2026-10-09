# How far behind upstream the watched AICR entries are

**UNOFFICIAL/EXPERIMENTAL.** The snapshot is taken by
`npm run aicr-upstream-watch:run`, which is the only step that reaches the
network. The summary is rendered by `npm run aicr-upstream-watch:generate`
and checked offline by `npm run aicr-upstream-watch:verify`.

Retaining an exact version is a deliberate choice, and a deliberate choice
needs a number next to it. This measures the gap instead of leaving it to be
discovered when someone happens to look at a release page.

This watch contains 137 entries: the intersection of the AICR naming
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

131 watched entries are at v1.0.0, which was released after this snapshot was taken. The snapshot lists v0.21.1 as upstream's newest, so it is older than those entries, and their gap is not measured here. [runs/aicr-provenance-v1-0-0/receipt.yaml](../../runs/aicr-provenance-v1-0-0/receipt.yaml) records the offline check of the v1.0.0 release signatures on 2026-10-07. A new snapshot from `npm run aicr-upstream-watch:run` is needed before this page can say how far behind they are.

The newest version this snapshot lists in the watch is v0.20.0, which is 2 release(s) and 16 days behind the newest release in the snapshot.

| Entry | Provenance | AICR version | Released | Releases published since |
| --- | --- | --- | --- | --- |
| `eks-h100-training-kubeflow` | retained-upstream | v0.14.0 | 2026-06-01 | 8 |
| `eks-h100-training-kubeflow-v0-18-0` | retained-upstream | v0.18.0 | 2026-07-23 | 4 |
| `eks-h100-training-kubeflow-v0-19-0` | retained-upstream | v0.19.0 | 2026-08-10 | 3 |
| `eks-h100-training-kubeflow-v0-20-0` | retained-upstream | v0.20.0 | 2026-08-24 | 2 |
| `eks-h100-inference-nim` | retained-upstream | v0.14.0 | 2026-06-01 | 8 |
| `cpu-starter` | derived | v0.14.0 | 2026-06-01 | 8 |
| `a100-aks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-aks-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-aks-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-any` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-eks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-eks-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-eks-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-gke-cos-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-gke-cos-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-oke-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-oke-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `a100-oke-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `aks` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `aks-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `aks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `aks-ubuntu` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `b200-any` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `b200-gke-cos-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `b200-gke-cos-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `b200-gke-cos-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `b200-gke-cos-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `bcm` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `bcm-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `bcm-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `eks` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `eks-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `eks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `eks-ubuntu` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-any` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-eks-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-eks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-eks-ubuntu-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-eks-ubuntu-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-eks-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-eks-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-eks-ubuntu-training-slurm` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-gke-cos-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-gke-cos-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-gke-cos-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-gke-cos-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-gke-cos-training-slurm` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-oke-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-oke-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-oke-ubuntu-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-oke-ubuntu-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-oke-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb200-oke-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb300-any` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb300-eks-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb300-eks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb300-eks-ubuntu-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb300-eks-ubuntu-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb300-eks-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb300-eks-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb300-eks-ubuntu-training-slurm` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gb300-generic-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gke-cos` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gke-cos-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `gke-cos-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-aks-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-aks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-aks-ubuntu-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-aks-ubuntu-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-aks-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-aks-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-aks-ubuntu-training-slurm` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-any` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-bcm-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-bcm-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-bcm-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-eks-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-eks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-eks-ubuntu-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-eks-ubuntu-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-eks-ubuntu-inference-nim` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-eks-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-eks-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-eks-ubuntu-training-slurm` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-gke-cos-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-gke-cos-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-gke-cos-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-gke-cos-training-slurm` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-kind-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-kind-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-kind-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-kind-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h100-kind-training-slurm` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h200-any` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h200-eks-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h200-eks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h200-eks-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `h200-k0s-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `k0s` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `k0s-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `kind` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `kind-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `l40-any` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `l40s-any` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `l40s-oke-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `l40s-oke-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `l40s-oke-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `lke` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `lke-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `lke-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `ocp` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `ocp-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `ocp-inference-nim` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `ocp-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `oke-ol` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `oke-ol-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `oke-ol-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rke2` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rke2-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rke2-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-any` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-eks-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-eks-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-eks-ubuntu-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-eks-ubuntu-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-eks-ubuntu-inference-nim` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-eks-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-eks-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-lke-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-lke-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-lke-ubuntu-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-lke-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `rtx-pro-6000-lke-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `vr200-rke2-ubuntu-inference` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `vr200-rke2-ubuntu-inference-dynamo` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `vr200-rke2-ubuntu-training` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |
| `vr200-rke2-ubuntu-training-kubeflow` | mirrored-upstream-overlay | v1.0.0 | after this snapshot | not measured |

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
