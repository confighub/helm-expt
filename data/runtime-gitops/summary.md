# Runtime/GitOps Wave

This generated file selects the first runtime/GitOps live-proof wave. The
top-20 already has local-kind evidence. This wave is the next step: prove that
selected catalog bases can be delivered by an OCI-capable GitOps controller and
observed back with a receipt.

## Current Reading

```text
top-100 runtime rows:             100
top-100 rows with local evidence: 20
first-wave chart/base pairs:      10
Argo CD OCI lanes:                5
Flux OCI lanes:                   5
first-wave receipts present:      0
```

## Files

| File | Purpose |
| --- | --- |
| `wave1.csv` | The first chart/base/controller pairs to run live through GitOps OCI. |
| `receipt-index.csv` | The required receipt path and minimum checks for each first-wave run. |

## Rule

Local-kind evidence is not the same as GitOps/OCI evidence. A row is not
GitOps-proven until the receipt under `data/runtime-gitops/receipts/` exists
and verifies the controller, artifact digest, sync result, runtime checks, and
freshness timestamp.
