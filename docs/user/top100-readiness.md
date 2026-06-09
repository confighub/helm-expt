# Top-100 Readiness

**UNOFFICIAL/EXPERIMENTAL**

The top-100 corpus is the bridge between the polished top-20 catalog and the
larger top-500 reconnaissance data.

Read it as chart-by-chart readiness, not as a blanket support claim.

## Current Shape

```text
100 charts have maintained recipe/package proof artifacts.
20 charts are public top-20 catalog entries with at least one live evidence lane.
80 charts are proof-grade but not catalog-supported yet.
54 charts already have more than one base variant.
46 charts are still default-only.
25 charts have at least one named hard gap for a recommended capability.
```

The generated source of truth is:

[Top-100 Readiness](../../data/top100-readiness/summary.md)

The spreadsheet-friendly CSV is:

[readiness.csv](../../data/top100-readiness/readiness.csv)

## The Four Buckets

| Bucket | Meaning | User answer |
| --- | --- | --- |
| `try-from-public-catalog` | A top-20 catalog entry exists. At least one base has live evidence. | Good demo/catalog candidate. Check the exact base before claiming GitOps, live parity, or production support. |
| `promote-after-review` | Recipe/package proof and useful variants exist, but catalog review is not done. | Good next promotion candidate. Needs catalog review and selected live lanes. |
| `needs-useful-variant` | The default render proves the mechanism, but the chart does not yet have a compelling user-shaped base. | Do not present it as a good catalog offer yet. Add realistic variants first. |
| `limitation-decision-first` | A named capability gap affects the recommended path. | Decide whether to support, disclose, or defer the capability before promotion. |

## What The Counts Mean

`render-parity` means regular Helm and `cub installer setup` produce equivalent
Kubernetes objects under recorded inputs.

`in-ConfigHub`, `local_live`, `gitops_live`, and `live_parity` are separate
lanes. A chart can be proof-grade with render parity while still missing live
or GitOps evidence for some bases.

`hard_gap` does not mean the chart is broken. It means a useful capability is
not yet handled as a supported path. Common examples are:

```text
existing-secret path not exposed by the chart
HA path needs a separate curated variant
CRDs cannot be cleanly disabled
the chart's topology belongs to a different chart or product decision
```

## How To Use It

Start with the generated summary when choosing what to work on next:

[Top-100 Readiness](../../data/top100-readiness/summary.md)

Use the CSV when comparing many charts:

[readiness.csv](../../data/top100-readiness/readiness.csv)

Then drill down:

| Question | Use |
| --- | --- |
| What exact bases exist for this chart? | `recipes/<repo>/<chart>/<version>/CATALOG.md` |
| Which lanes pass for each base? | [base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| Which chart features or gaps matter? | [feature-outcomes.csv](../../data/outcome-coverage/feature-outcomes.csv) |
| Which charts are next for promotion? | [catalog-promotion-wave2](../../data/catalog-promotion-wave2/summary.md) |
| Which production decision is still missing? | [Production Next Actions](../../data/production-disposition/next-actions.csv) |

## Promotion Rule

A top-100 chart should not move from proof-grade to catalog-supported just
because it renders.

Promotion should show:

```text
useful base variants
render parity
scan/gate receipts
clear target facts and lifecycle routes
at least one selected live lane where appropriate
plain user guidance for when to use each variant
```

That is how the top-100 becomes a useful catalog rather than a spreadsheet of
successful renders.
