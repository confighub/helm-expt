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

## Maintained Hook Chart Details

| Chart | Hooks | Hook types | Route hint | Example templates |
| --- | ---: | --- | --- | --- |
| prometheus-community/kube-prometheus-stack@85.3.3 | 2 | post-install, post-upgrade, pre-install, pre-upgrade | preflight-or-presync;postsync-check-or-observation;upgrade-action-with-receipt;preserve-ordering;preserve-cleanup-policy;webhook-readiness-observation;target-facts-or-preflight | kube-prometheus-stack/templates/prometheus-operator/admission-webhooks/job-patch/ciliumnetworkpolicy-createSecret.yaml<br>kube-prometheus-stack/templates/prometheus-operator/admission-webhooks/job-patch/ciliumnetworkpolicy-patchWebhook.yaml |
| kyverno/kyverno@3.8.1 | 8 | post-upgrade, pre-delete, test | upgrade-action-with-receipt;delete-cleanup-policy;explicit-test-check;preserve-ordering;preserve-cleanup-policy;target-facts-or-preflight | kyverno/charts/reports-server/templates/hooks/pre-delete-api-service-cleanup.yaml<br>kyverno/templates/hooks/post-upgrade-migrate-resources.yaml |
| fluent/fluent-bit@0.57.6 | 1 | test | explicit-test-check;preserve-cleanup-policy | fluent-bit/templates/tests/test-connection.yaml |
| projectcalico/tigera-operator@v3.32.0 | 1 | pre-delete | delete-cleanup-policy;preserve-ordering;preserve-cleanup-policy;target-facts-or-preflight | tigera-operator/templates/tigera-operator/00-uninstall.yaml |
| gatekeeper/gatekeeper@3.22.2 | 4 | pre-install, pre-upgrade | preflight-or-presync;upgrade-action-with-receipt;preserve-ordering;preserve-cleanup-policy;webhook-readiness-observation | gatekeeper/templates/upgrade-crds-hook.yaml |
