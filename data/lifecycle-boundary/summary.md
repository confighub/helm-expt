# Hook And Lifecycle Boundary

This generated report separates two related but different claims:

~~~text
Helm hook lifecycle support: hook-bearing charts need a selected route and a
receipt before production support.

Hook-like lifecycle observation: some charts have Helm hook, controller, CRD,
webhook, or runtime behavior that rendered YAML cannot prove through render
parity alone.
~~~

The distinction matters because passing cert-manager and External Secrets
lifecycle observations do not mean every Helm hook is solved. Cert-manager
proves a chart-specific route for its known startup API check hook. External
Secrets proves controller-owned webhook behavior in bases that do not use a
Helm hook.

## Current Reading

~~~text
maintained hook queue rows:               5
hook route receipts present:              5/5
hook lifecycle observations present:      5/5
hook partial lifecycle observations:      0/5
hook routes awaiting observation:         0/5
hook rows still needing route receipt:    0/5
hook-like lifecycle observations passing: 4/4
~~~

## Rows

| Lane | Chart | Base | Status | Route or policy | What it proves | What it does not prove |
| --- | --- | --- | --- | --- | --- | --- |
| helm-hook-lifecycle-queue | `prometheus-community/kube-prometheus-stack@85.3.3` | default | lifecycle-observed | preflight-or-presync;postsync-check-or-observation;upgrade-action-with-receipt;preserve-ordering;preserve-cleanup-policy;webhook-readiness-observation;target-facts-or-preflight | hook route has a lifecycle observation or execution receipt | universal Helm hook support or support for unrelated hook-bearing charts |
| helm-hook-lifecycle-queue | `kyverno/kyverno@3.8.1` | default | lifecycle-observed | upgrade-action-with-receipt;delete-cleanup-policy;explicit-test-check;preserve-ordering;preserve-cleanup-policy;target-facts-or-preflight | hook route has a lifecycle observation or execution receipt | universal Helm hook support or support for unrelated hook-bearing charts |
| helm-hook-lifecycle-queue | `fluent/fluent-bit@0.57.6` | default | lifecycle-observed | explicit-test-check;preserve-cleanup-policy | hook route has a lifecycle observation or execution receipt | universal Helm hook support or support for unrelated hook-bearing charts |
| helm-hook-lifecycle-queue | `projectcalico/tigera-operator@v3.32.0` | default | lifecycle-observed | delete-cleanup-policy;preserve-ordering;preserve-cleanup-policy;target-facts-or-preflight | hook route has a lifecycle observation or execution receipt | universal Helm hook support or support for unrelated hook-bearing charts |
| helm-hook-lifecycle-queue | `gatekeeper/gatekeeper@3.22.2` | default | lifecycle-observed | preflight-or-presync;upgrade-action-with-receipt;preserve-ordering;preserve-cleanup-policy;webhook-readiness-observation | hook route has a lifecycle observation or execution receipt | universal Helm hook support or support for unrelated hook-bearing charts |
| hook-like-lifecycle-observation | `jetstack/cert-manager@v1.20.2` | default | pass | startupapicheck-becomes-post-apply-api-dry-run | CRD ownership policy, startup API readiness route, webhook CA bundle injection, and server dry-run | universal Helm hook support or support for unrelated hook-bearing charts |
| hook-like-lifecycle-observation | `jetstack/cert-manager@v1.20.2` | crds-enabled | pass | startupapicheck-becomes-post-apply-api-dry-run | CRD ownership policy, startup API readiness route, webhook CA bundle injection, and server dry-run | universal Helm hook support or support for unrelated hook-bearing charts |
| hook-like-lifecycle-observation | `external-secrets/external-secrets@2.5.0` | default | pass | no-helm-hook | CRD ownership policy, webhook CA bundle injection, controller-populated webhook Secret data, and server dry-run | universal Helm hook support or support for unrelated hook-bearing charts |
| hook-like-lifecycle-observation | `external-secrets/external-secrets@2.5.0` | no-crds | pass | no-helm-hook | CRD ownership policy, webhook CA bundle injection, controller-populated webhook Secret data, and server dry-run | universal Helm hook support or support for unrelated hook-bearing charts |

## Files

| File | Purpose |
| --- | --- |
| `data/lifecycle-boundary/lifecycle-boundary.csv` | One row per hook queue item or lifecycle observation row. |
| `data/hook-lifecycle/source-top100-hooks.csv` | Source-scan inventory of top-100 public charts where the retained source scan found Helm hooks. |
| `data/hook-lifecycle/maintained-hook-queue.csv` | Maintained hook queue rows that need route, execution, or observation receipts. |
| `data/lifecycle-observations/cert-manager-eso/summary.csv` | Current cert-manager and External Secrets lifecycle observations. |

Regenerate:

~~~sh
npm run lifecycle:boundary
npm run lifecycle:boundary:verify
~~~
