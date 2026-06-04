# Hook Lifecycle Wave

This generated file tracks maintained charts whose source scan found Helm hooks.
Render equivalence makes hook resources explicit; it does not prove hook
execution. Production support requires a lifecycle route and a lifecycle or
observation receipt for that route.

## Current Reading

```text
top-500 charts with Helm hooks:        54
top-100 maintained charts with hooks:  5
catalog-supported hook charts:         1
proof-grade hook charts:               4
hook lifecycle receipts present:       0
```

## Files

| File | Purpose |
| --- | --- |
| `top100-hooks.csv` | Maintained recipe/package entries whose source scan found Helm hooks. |
| `receipt-index.csv` | Required receipt path and minimum checks for each hook lifecycle proof. |

## Rule

A row is not hook-lifecycle-proven until the receipt under
`data/hook-lifecycle/receipts/` exists and records the chosen route,
execution or controller behavior, runtime outcome, and freshness timestamp.
