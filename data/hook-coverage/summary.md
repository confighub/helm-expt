# Top-100 Hook Coverage

This generated report joins the source-scan hook inventory to the maintained
hook lifecycle queue and the candidate route plans.

It answers:

~~~text
For each top-100 chart where the source scan found Helm hooks, do we have a
maintained lifecycle receipt, a candidate route, or an uncovered row?
~~~

It does not claim hook execution for candidate rows. Candidate rows are route
plans only. Maintained rows only claim what their receipt status says.

## Current Reading

~~~text
source top-100 hook rows:                    11
source rows with maintained hook coverage:   3
source rows with candidate route coverage:   8
source rows still uncovered:                 0
maintained hook queue rows total:            5
candidate route rows total:                  9
hook-like candidate rows outside inventory:  1
maintained rows outside source top100 hooks: 2
~~~

## Coverage Status

| Status | Rows |
| --- | ---: |
| `candidate-route-plan` | 8 |
| `maintained-observed` | 2 |
| `maintained-partial` | 1 |

## Source Top-100 Rows

| Rank | Chart | Source version | Status | Evidence | Next action |
| ---: | --- | --- | --- | --- | --- |
| 1 | `prometheus-community/kube-prometheus-stack` | 85.3.0 | `maintained-observed` | data/hook-lifecycle/maintained-hook-queue.csv;data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml | keep receipt fresh when chart, base, or cluster version changes |
| 9 | `k8s-dashboard/kubernetes-dashboard` | 7.14.0 | `candidate-route-plan` | data/hook-route-candidates/candidates.csv;data/hook-route-candidates/k8s-dashboard-kubernetes-dashboard.yaml | create recipe; determine whether vendored hooks render under default values; record hook-inert fact or route per base; then admit |
| 13 | `gitlab/gitlab` | 10.0.0 | `candidate-route-plan` | data/hook-route-candidates/candidates.csv;data/hook-route-candidates/gitlab-gitlab.yaml | treat as a serious-chart review; choose a supported base; confirm whether the vendored hook renders; then write maintained route receipt or hook-inert fact |
| 23 | `bitnami/kafka` | 32.4.3 | `candidate-route-plan` | data/hook-route-candidates/candidates.csv;data/hook-route-candidates/bitnami-kafka.yaml | create recipe with provisioning-off default and provisioning-enabled base; route Job as managed action with receipt; share route shape across the bitnami pattern |
| 32 | `bitnami/minio` | 17.0.21 | `candidate-route-plan` | data/hook-route-candidates/candidates.csv;data/hook-route-candidates/bitnami-minio.yaml | create recipe with provisioning-off default and provisioning-enabled base; reuse the shared route receipt shape; then admit |
| 38 | `kyverno/kyverno` | 3.8.1 | `maintained-partial` | data/hook-lifecycle/maintained-hook-queue.csv;data/hook-lifecycle/receipts/kyverno-kyverno/default/latest.yaml | run remaining lifecycle route and commit additional observation or execution receipt |
| 42 | `fluent/fluent-bit` | 0.57.6 | `maintained-observed` | data/hook-lifecycle/maintained-hook-queue.csv;data/hook-lifecycle/receipts/fluent-fluent-bit/default/latest.yaml | keep receipt fresh when chart, base, or cluster version changes |
| 43 | `datadog/datadog` | 3.214.0 | `candidate-route-plan` | data/hook-route-candidates/candidates.csv;data/hook-route-candidates/datadog-datadog.yaml | split normal and GKE Autopilot target scopes; route allowlist hooks as preflight and migration Job as lifecycle action with receipt |
| 44 | `bitnami/thanos` | 17.3.1 | `candidate-route-plan` | data/hook-route-candidates/candidates.csv;data/hook-route-candidates/bitnami-thanos.yaml | create Thanos recipe; distinguish provisioning-off and provisioning-enabled bases; reuse MinIO provisioning receipt shape when the hook renders |
| 84 | `airflow-helm/airflow` | 8.9.0 | `candidate-route-plan` | data/hook-route-candidates/candidates.csv;data/hook-route-candidates/airflow-helm-airflow.yaml | create recipe; choose supported base; route migration/sync hooks as managed actions with receipts or record hook-inert fact if disabled |
| 97 | `kong/kong` | 3.2.0 | `candidate-route-plan` | data/hook-route-candidates/candidates.csv;data/hook-route-candidates/kong-kong.yaml | create recipe with DB-less and database bases; confirm which bases render the pair; model ordered upgrade actions; then admit to maintained queue |

## Extra Rows

These rows are useful, but they are not counted as source top-100 hook coverage.

| Type | Chart | Version | Why |
| --- | --- | --- | --- |
| hook-like candidate | `apache-airflow/airflow` | 1.21.0 | candidate route exists, but this exact chart row is not in the source top-100 hook inventory |
| maintained hook row | `projectcalico/tigera-operator` | v3.32.0 | maintained hook lifecycle row exists outside the source top-100 hook inventory |
| maintained hook row | `gatekeeper/gatekeeper` | 3.22.2 | maintained hook lifecycle row exists outside the source top-100 hook inventory |

## How To Use This

- `maintained-observed` means a maintained hook lifecycle receipt has runtime
  observation or execution evidence for the selected route.
- `maintained-partial` means a maintained receipt exists and at least one
  lifecycle path was observed, but another phase such as upgrade/delete remains.
- `candidate-route-plan` means the source hook has been reviewed and routed,
  but the chart is not yet in the maintained hook lifecycle queue.
- `uncovered-source-hook` must stay at zero before saying the top-100 hook
  inventory is fully classified.

## Files

| File | Purpose |
| --- | --- |
| `top100-hook-coverage.csv` | One row per source top-100 hook chart with maintained/candidate coverage status. |
| `data/hook-lifecycle/source-top100-hooks.csv` | Source-scan hook inventory. |
| `data/hook-lifecycle/maintained-hook-queue.csv` | Maintained hook lifecycle queue. |
| `data/hook-route-candidates/candidates.csv` | Candidate route plans that are not maintained receipts. |

Regenerate:

~~~sh
npm run hooks:coverage
npm run hooks:coverage:verify
~~~
