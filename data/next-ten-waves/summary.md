# Next-Ten Waves

This generated directory turns the current execution plan into small work
queues. It is intentionally narrower than the full attack-plan workdown: these
are the next rows to work, not the whole corpus.

## Current Waves

```text
gap-review first rows:             9
latest-version promotion rows:     6
variant-build rows:                5
production-disposition first rows: 5
import prototype rows:             3
```

## Files

| File | Purpose |
| --- | --- |
| `gap-review-wave.csv` | First existing-secret and CRD/no-CRDs hard gaps to review. |
| `latest-promotion-wave.csv` | Six latest top-20 candidates that are ready for full lane promotion work. |
| `variant-build-wave.csv` | Wave-2 chart variants to render and prove next. |
| `production-disposition-wave.csv` | First five catalog-supported charts to move toward production disposition. |
| `import-prototype-wave.csv` | Import examples that explain public chart, managed overlay, and post-render promotion routes. |

The production-disposition wave separates accepted dispositions from open
dispositions, so the queue shows only the production decisions still needing
receipts before the follow-up runtime/GitOps and image-digest lanes run.
