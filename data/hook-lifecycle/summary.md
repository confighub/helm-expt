# Hook Lifecycle Wave

This generated file tracks maintained charts whose source scan found Helm hooks.
Render equivalence makes hook resources explicit; it does not prove hook
execution. Production support requires a lifecycle route and a lifecycle or
observation receipt for that route.

Hook rows move through explicit states: inventoried, render-proven,
route-selected, lifecycle-observed, or blocked. The first two states are useful
evidence, but they are not hook lifecycle support. Some hooks may remain blocked
until chart-specific review finds a safe route.

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

Related lifecycle observations can exist outside this hook queue when a chart
has hook-like runtime behavior but no Helm hook. For example, cert-manager and
External Secrets lifecycle observations live under
`data/lifecycle-observations/cert-manager-eso/`. Those receipts demonstrate
the lifecycle-observation pattern, not universal hook support.
