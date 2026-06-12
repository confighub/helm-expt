# Hook Route Candidate Work Orders

**UNOFFICIAL/EXPERIMENTAL — generated work orders, 2026-06-11.**

These generated work orders turn candidate hook route plans into assignable
proof work. They do not execute hooks, admit charts to the maintained hook
queue, or claim production readiness.

## Summary

~~~text
candidate charts: 10
work orders: 72
dependency-closure hook rows: 5
target/preflight rows: 9
~~~

## Pattern Mix

| Pattern | Charts |
| --- | ---: |
| `provisioning-job` | 3 |
| `database-migration-pair` | 2 |
| `environment-conditional-hooks` | 1 |
| `hook-like-migration-jobs` | 1 |
| `install-critical-crd-hook` | 1 |
| `migration-and-sync-hooks` | 1 |
| `vendored-traefik-lifecycle-hook` | 1 |

## Work Orders By Chart

### kong/kong@3.2.0

Pattern: `database-migration-pair`<br>
Phases: `pre-upgrade, post-upgrade`<br>
Dependency source: `chart-own`<br>
Candidate route: `upgrade-action-with-receipt`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | ordered-upgrade-action | operator reviewer | The pre-upgrade and post-upgrade actions are mapped to an ordered lifecycle route with rollback and failure-handling notes. |
| 3 | target-preflight | platform reviewer | Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope. |
| 4 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 5 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 6 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 7 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

### k8s-dashboard/kubernetes-dashboard@7.14.0

Pattern: `database-migration-pair (vendored)`<br>
Phases: `pre-upgrade, post-upgrade`<br>
Dependency source: `vendored kong subchart`<br>
Candidate route: `upgrade-action-with-receipt (if rendered)`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | dependency-closure-review | catalog reviewer | The dependency source, dependency lock, and affected bases are recorded before the route is admitted to the maintained queue. |
| 3 | ordered-upgrade-action | operator reviewer | The pre-upgrade and post-upgrade actions are mapped to an ordered lifecycle route with rollback and failure-handling notes. |
| 4 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 5 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 6 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 7 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

### gitlab/gitlab@10.0.0

Pattern: `vendored-traefik-lifecycle-hook`<br>
Phases: `post-install, post-upgrade`<br>
Dependency source: `vendored traefik subchart`<br>
Candidate route: `argocd-or-flux-lifecycle-hook`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | dependency-closure-review | catalog reviewer | The dependency source, dependency lock, and affected bases are recorded before the route is admitted to the maintained queue. |
| 3 | target-preflight | platform reviewer | Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope. |
| 4 | serious-chart-base-selection | catalog owner | A serious-chart review chooses the supported base and records which lifecycle concerns are supported, deferred, or blocked. |
| 5 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 6 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 7 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 8 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

### airflow-helm/airflow@8.9.0

Pattern: `migration-and-sync-hooks`<br>
Phases: `post-install, post-upgrade`<br>
Dependency source: `chart-own`<br>
Candidate route: `explicit-managed-action`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | target-preflight | platform reviewer | Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope. |
| 3 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 4 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 5 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 6 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

### bitnami/kafka@32.4.3

Pattern: `provisioning-job`<br>
Phases: `post-install, post-upgrade`<br>
Dependency source: `chart-own`<br>
Candidate route: `explicit-managed-action`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | provisioning-mode-split | catalog reviewer | The catalog has a provisioning-off base and, if useful, a provisioning-enabled base with target facts and a managed action receipt. |
| 3 | target-preflight | platform reviewer | Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope. |
| 4 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 5 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 6 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 7 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

### bitnami/minio@17.0.21

Pattern: `provisioning-job`<br>
Phases: `post-install, post-upgrade`<br>
Dependency source: `chart-own (also vendored into bitnami/thanos)`<br>
Candidate route: `explicit-managed-action`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | dependency-closure-review | catalog reviewer | The dependency source, dependency lock, and affected bases are recorded before the route is admitted to the maintained queue. |
| 3 | provisioning-mode-split | catalog reviewer | The catalog has a provisioning-off base and, if useful, a provisioning-enabled base with target facts and a managed action receipt. |
| 4 | target-preflight | platform reviewer | Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope. |
| 5 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 6 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 7 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 8 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

### datadog/datadog@3.214.0

Pattern: `environment-conditional-hooks`<br>
Phases: `pre-install, pre-upgrade, post-install, post-upgrade`<br>
Dependency source: `chart-own plus vendored datadog-csi-driver`<br>
Candidate route: `target-class-preflight-and-upgrade-action`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | dependency-closure-review | catalog reviewer | The dependency source, dependency lock, and affected bases are recorded before the route is admitted to the maintained queue. |
| 3 | target-scope-split | platform reviewer | Supported target classes are split into separate scopes with preflight checks or explicit unsupported-target blockers. |
| 4 | target-preflight | platform reviewer | Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope. |
| 5 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 6 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 7 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 8 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

### bitnami/thanos@17.3.1

Pattern: `provisioning-job (vendored)`<br>
Phases: `post-install, post-upgrade`<br>
Dependency source: `vendored minio subchart`<br>
Candidate route: `explicit-managed-action`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | dependency-closure-review | catalog reviewer | The dependency source, dependency lock, and affected bases are recorded before the route is admitted to the maintained queue. |
| 3 | provisioning-mode-split | catalog reviewer | The catalog has a provisioning-off base and, if useful, a provisioning-enabled base with target facts and a managed action receipt. |
| 4 | target-preflight | platform reviewer | Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope. |
| 5 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 6 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 7 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 8 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

### apache-airflow/airflow@1.21.0

Pattern: `hook-like-migration-jobs`<br>
Phases: `none found by static scan`<br>
Dependency source: `chart-own lifecycle-like Jobs`<br>
Candidate route: `recipe-time-lifecycle-verification`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | hook-free-claim-review | catalog reviewer | The chart records whether lifecycle jobs are normal desired state, managed actions, or blockers for the selected base. |
| 3 | target-preflight | platform reviewer | Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope. |
| 4 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 5 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 6 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 7 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

### argo-cd/argo-workflows@1.0.14

Pattern: `install-critical-crd-hook`<br>
Phases: `pre-install, pre-upgrade`<br>
Dependency source: `chart-own`<br>
Candidate route: `preflight-or-presync-crd-apply`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
| 1 | base-rendering-review | catalog reviewer | The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base. |
| 2 | target-preflight | platform reviewer | Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope. |
| 3 | maintained-route-receipt | catalog reviewer | A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base. |
| 4 | gitops-lifecycle-mapping | operator reviewer | The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step. |
| 5 | runtime-observation-or-execution | operator reviewer | The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred. |
| 6 | maintained-queue-admission | catalog owner | The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named. |

## Rules

- A candidate route is not a maintained route receipt.
- Source evidence does not prove a hook renders for a selected base.
- Dependency-provided hooks must be reviewed through the dependency closure.
- Lifecycle work needs an execution receipt, fresh observation receipt, or an
  explicit blocker before support claims.

## Spreadsheet

Use [work-orders.csv](./work-orders.csv) for assignment, filtering, and status
tracking.
