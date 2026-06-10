# Attack Plan Workdown

This generated index tracks the current 1-10 execution queue. It points at the
dedicated proof artifacts rather than replacing them.

## Headline

```text
import-contract examples complete: 3 / 3
existing-secret hard gaps:         15
template-CRD/no-crds hard gaps:    3
wave-2 variant work orders:        5
top-20 production rows:            20
top-100 runtime/GitOps rows:       100
top-100 rows with local runtime:   20
latest top-20 candidates:          7
rendered image rows reviewed:      431
rendered subjects with mutable/floating images: 149
```

## Files

| File | Purpose |
| --- | --- |
| `helm-import-contract.csv` | #76 import examples and required artifact chain. |
| `secret-gap-workdown.csv` | Charts where no chart-native existing-Secret toggle is known. |
| `crd-gap-workdown.csv` | Charts where no clean no-CRDs variant is currently available. |
| `variant-workdown.csv` | Wave-2 user-shaped variant jobs. |
| `production-workdown.csv` | Top-20 production-disposition blockers and next action. |
| `runtime-gitops-sweep.csv` | Top-100 runtime/GitOps sweep plan by chart. |
| `latest-candidate-workdown.csv` | Six latest-version candidate promotion lanes. |
| `image-digest-review.csv` | #99 rendered image tags/digests by chart and variant. |

## Read This With

```text
data/chart-facts/summary.md
data/top100-catalog-analysis/summary.md
data/production-disposition/summary.md
data/latest-top20-refresh/promotion-readiness.md
tests/top100-runtime-gitops.md
docs/reference/helm-import-contract.md
```
