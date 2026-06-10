# Image Digest Workdown

This generated workdown summarizes rendered image references from
`data/attack-plan-workdown/image-digest-review.csv`. It is a review queue for
image pinning, not a registry-resolution receipt.

## Current Reading

```text
rendered image references:             427
rendered subjects:                     169
image references needing resolution:   390
rendered subjects needing resolution:  149
resolution receipts recorded:          24
support policy decisions recorded:     28
catalog-supported subjects:            56
catalog-supported needing resolution:  37
charts with rendered image references: 103
priority subjects listed:              30
```

## Files

| File | Purpose |
| --- | --- |
| `priority-subjects.csv` | First image-digest rows to work, with catalog-supported charts first. |
| `chart-summary.csv` | One row per chart with rendered image counts and image-resolution state. |
| `all-subjects.csv` | One row per chart/version/variant rendered subject. |

## Rule

A production OCI claim needs image digest evidence. Mutable tags and `:latest`
may be acceptable for local proof, but production support needs either pinned
image references or an explicit image override/proof receipt.
