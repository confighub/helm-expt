# Status Dashboard

This generated dashboard is the short front door for current project status. It
joins the top100 readiness, top500 evidence map, proof lane, graph bridge,
quirk, hook, GitOps, and live-parity tables without replacing them.

Use this page to answer:

~~~text
What is working now?
Which claims are only partial?
Where are the main residues?
Which detailed CSV should I open next?
~~~

## Current State

| Section | Metric | Value | Status | Source |
| --- | --- | ---: | --- | --- |
| top100 | charts with model support | 98/100 | good | [data/outcome-coverage/chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) |
| top100 | catalog-supported charts | 20/100 | partial | [data/top100-readiness/readiness.csv](../../data/top100-readiness/readiness.csv) |
| top100 | proof-grade non-catalog charts | 80/100 | partial | [data/top100-readiness/readiness.csv](../../data/top100-readiness/readiness.csv) |
| top100 | variant-rich charts | 54/100 | partial | [data/outcome-coverage/chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) |
| top100 | covered by top100 contract | 20/100 | partial | [data/top100-coverage/coverage.csv](../../data/top100-coverage/coverage.csv) |
| top100 | partial by top100 contract | 80/100 | partial | [data/top100-coverage/coverage.csv](../../data/top100-coverage/coverage.csv) |
| top100 | average top100 coverage | 83/100 | partial | [data/top100-coverage/coverage.csv](../../data/top100-coverage/coverage.csv) |
| top100 | top100 promotion-review queue | 27/80 | partial | [data/top100-coverage/work-queue.csv](../../data/top100-coverage/work-queue.csv) |
| top100 | first strict top100 promotion wave | 8/27 | partial | [data/top100-promotion-wave/wave.csv](../../data/top100-promotion-wave/wave.csv) |
| top100 | top100 user-shaped variant queue | 46/80 | partial | [data/top100-coverage/work-queue.csv](../../data/top100-coverage/work-queue.csv) |
| top100 | top100 limitation-decision queue | 7/80 | partial | [data/top100-coverage/work-queue.csv](../../data/top100-coverage/work-queue.csv) |
| refresh | top20 proofs still current | 13/20 | partial | [data/refresh-survival/refreshes.csv](../../data/refresh-survival/refreshes.csv) |
| refresh | top20 upstream update candidates | 7/20 | partial | [data/refresh-survival/refreshes.csv](../../data/refresh-survival/refreshes.csv) |
| refresh | update candidates with proof-complete root paths | 3/7 | partial | [data/refresh-survival/refreshes.csv](../../data/refresh-survival/refreshes.csv) |
| top500 | source rows scanned | 495/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | rows with current recipe proof | 91/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | catalog-supported rows | 20/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | proof-grade rows | 71/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | rows with no current recipe proof | 409/500 | gap | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | version-drift review rows | 21/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| proof lanes | render parity rows | 159/159 | good | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | in-ConfigHub proof rows | 20/159 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | local live rows | 23/159 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | GitOps/OCI live pass rows | 22/159 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | live Helm-vs-ConfigHub parity pass rows | 20/159 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | two-cluster kind parity pass rows | 49/50 | partial | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| proof lanes | complete core lane rows | 20/159 | gap | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | top20 start-here base variants | 20/42 | partial | [data/top20-base-readiness/base-readiness.csv](../../data/top20-base-readiness/base-readiness.csv) |
| proof lanes | top20 bases needing unresolved prerequisite or runtime review | 0/42 | partial | [data/top20-base-readiness/base-readiness.csv](../../data/top20-base-readiness/base-readiness.csv) |
| derived variants | derived variant golden rows | 10/10 | good | [data/variant-goldens/derived-expansion-wave/work-orders.csv](../../data/variant-goldens/derived-expansion-wave/work-orders.csv) |
| derived variants | derived variant live create receipts | 10/10 | good | [runs/derived-variant-execution](../../runs/derived-variant-execution) |
| derived variants | target-bound derived variant receipts | 6/10 | partial | [runs/derived-variant-target-bound](../../runs/derived-variant-target-bound) |
| graph bridge | charts with recovered graph fragments | 20/100 | partial | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| graph bridge | recovered graph edge rows | 100/100 | good | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| graph bridge | target-fact graph edges | 57/100 | partial | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| graph bridge | generated-fact graph edges | 1/100 | partial | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| graph bridge | rows with field reachability | 3/100 | partial | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| live evidence | runtime/GitOps wave rows | 10/10 | partial | [data/runtime-gitops/wave1.csv](../../data/runtime-gitops/wave1.csv) |
| live evidence | live Helm-vs-ConfigHub receipts | 20/20 | partial | [data/live-helm-confighub-compare/summary.csv](../../data/live-helm-confighub-compare/summary.csv) |
| live evidence | two-cluster kind parity receipts | 50/50 | partial | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| live evidence | live parity rerun rows needing decisions | 0/0 | partial | [data/live-parity-rerun-plan/rerun-plan.csv](../../data/live-parity-rerun-plan/rerun-plan.csv) |
| live evidence | live parity rows needing model or staging first | 0/0 | partial | [data/live-parity-rerun-plan/rerun-plan.csv](../../data/live-parity-rerun-plan/rerun-plan.csv) |
| live evidence | live parity rows needing target review first | 0/0 | partial | [data/live-parity-rerun-plan/rerun-plan.csv](../../data/live-parity-rerun-plan/rerun-plan.csv) |
| live evidence | ConfigHub/OCI semantic parity defect receipts | 0/20 | good | [data/live-helm-confighub-compare/summary.csv](../../data/live-helm-confighub-compare/summary.csv) |
| live evidence | two-cluster semantic parity defect receipts | 0/50 | good | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| production disposition | top20 production-review-ready charts | 19/20 | partial | [data/production-disposition/top20.csv](../../data/production-disposition/top20.csv) |
| production disposition | top20 production-blocked charts | 1/20 | partial | [data/production-disposition/top20.csv](../../data/production-disposition/top20.csv) |
| production disposition | charts with accepted production dispositions | 20/20 | partial | [data/production-disposition/top20.csv](../../data/production-disposition/top20.csv) |
| production support decisions | target-scoped decision artifacts | 20/20 | partial | [data/production-support-decisions/decisions.csv](../../data/production-support-decisions/decisions.csv) |
| production support decisions | supported decision artifacts | 17/20 | partial | [data/production-support-decisions/decisions.csv](../../data/production-support-decisions/decisions.csv) |
| production support decisions | superseded decision artifacts | 2/20 | partial | [data/production-support-decisions/decisions.csv](../../data/production-support-decisions/decisions.csv) |
| production support decisions | rejected decision artifacts | 1/20 | partial | [data/production-support-decisions/decisions.csv](../../data/production-support-decisions/decisions.csv) |
| production support decisions | draft decision artifacts | 0/20 | good | [data/production-support-decisions/decisions.csv](../../data/production-support-decisions/decisions.csv) |
| scan disposition | high-priority scan rows | 4/20 | partial | [data/scan-disposition-workdown/workdown.csv](../../data/scan-disposition-workdown/workdown.csv) |
| scan disposition | remaining mutable-image rows | 0/20 | good | [data/scan-disposition-workdown/workdown.csv](../../data/scan-disposition-workdown/workdown.csv) |
| scan disposition | privileged infrastructure review rows | 4/20 | partial | [data/scan-disposition-workdown/workdown.csv](../../data/scan-disposition-workdown/workdown.csv) |
| quirks | tracked-and-surfaced axes | 9/26 | good | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| quirks | partly tracked axes | 3/26 | partial | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| quirks | source-scanned but not surfaced axes | 5/26 | gap | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| quirks | not-scanned axes | 6/26 | gap | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| extension slots | top20 charts with extension slots | 13/20 | partial | [data/extension-slots/extension-slots.csv](../../data/extension-slots/extension-slots.csv) |
| extension slots | top100 charts with extension slots | 82/100 | partial | [data/extension-slots/extension-slots.csv](../../data/extension-slots/extension-slots.csv) |
| extension slots | top500 source rows using tpl | 362/500 | partial | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| hooks | top100 maintained hook charts | 5/5 | partial | [data/hook-lifecycle/top100-hooks.csv](../../data/hook-lifecycle/top100-hooks.csv) |
| hooks | hook route receipts present | 5/5 | partial | [data/hook-lifecycle/top100-hooks.csv](../../data/hook-lifecycle/top100-hooks.csv) |
| hooks | hook lifecycle observations present | 0/5 | gap | [data/hook-lifecycle/top100-hooks.csv](../../data/hook-lifecycle/top100-hooks.csv) |
| hooks | hook/lifecycle boundary rows | 9/9 | partial | [data/lifecycle-boundary/lifecycle-boundary.csv](../../data/lifecycle-boundary/lifecycle-boundary.csv) |
| hooks | hook queue rows still needing route receipts | 0/5 | good | [data/lifecycle-boundary/lifecycle-boundary.csv](../../data/lifecycle-boundary/lifecycle-boundary.csv) |
| hooks | hook routes still needing execution or observation | 5/5 | gap | [data/lifecycle-boundary/lifecycle-boundary.csv](../../data/lifecycle-boundary/lifecycle-boundary.csv) |
| hooks | related lifecycle observation receipts passing | 4/4 | good | [data/lifecycle-observations/cert-manager-eso/summary.csv](../../data/lifecycle-observations/cert-manager-eso/summary.csv) |

## Next Work Queues

Use this section when the question is what should move next, not when the
question is whether a specific receipt passed.
Workstreams can overlap: one chart can need image, scan, lifecycle, and fresh
evidence work before it becomes production-supported for a target scope.

### Top100 Catalog Work

| Queue | Charts | Next action |
| --- | ---: | --- |
| Use public catalog now | 20 | Open CATALOG.md and top20 base readiness; choose a base with the lane you need. |
| Promote proof-grade charts | 27 | Run catalog promotion review, select realistic bases, and add selected live lanes. |
| Design useful base variants | 46 | Create the first user-shaped base before treating the chart as a catalog offer. |
| Resolve limitation decisions | 7 | Decide whether the named gap is supported, disclosed, deferred, or blocked. |

### Top20 Production Support Work

| Workstream | Charts | Next action |
| --- | ---: | --- |
| Supported scope evidence | 17 | Keep target-scoped evidence fresh before using the supported scope as a production example. |

### Live Parity Work

| Queue | Rows | Next action |
| --- | ---: | --- |
| none | 0 | No current queue rows. |

### Active Proof Queue

These are the current live parity rows where another run is not the first useful
step. Each row points at the support artifact that explains the prerequisite,
lifecycle route, target fit, or operating policy.

| Chart | Base | Result | Next step | Support artifact |
| --- | --- | --- | --- | --- |
| none | - | - | - | - |

### Hook And Lifecycle Work

| Queue | Rows | Next action |
| --- | ---: | --- |
| Hook route selected, observation pending | 5 | Run the selected lifecycle path and commit execution or observation receipts. |
| Hook-bearing rows observed | 0 | Keep receipt freshness current when the supported target changes. |
| Related CRD/webhook/controller observations | 4 | Use these as examples for hook-like lifecycle proof, not as universal hook support. |

Spreadsheet forms: [next-work-queues.csv](next-work-queues.csv) and
[active-proof-queue.csv](active-proof-queue.csv).

## Top100 Readiness

| Adoption bucket | Charts |
| --- | ---: |
| needs-useful-variant | 46 |
| promote-after-review | 27 |
| try-from-public-catalog | 20 |
| limitation-decision-first | 7 |

| Strongest evidence | Charts |
| --- | ---: |
| render-parity | 72 |
| live-helm-vs-confighub-parity | 20 |
| two-cluster-kind-parity | 8 |

The top100 is model-supported, but not uniformly live-proven. Use
[top100-readiness/readiness.csv](../top100-readiness/readiness.csv) for one row
per chart, and [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv)
for exact chart/base lane status.

## Top500 Evidence Map

The top500 table is retained source reconnaissance joined to the current
recipe/package corpus. It shows which retained source-scan rows now have
current proof, which rows only have source facts, and where the retained source
version differs from the maintained recipe version.

| Catalog status | Rows |
| --- | ---: |
| not-in-catalog | 409 |
| proof-grade | 71 |
| catalog-supported | 20 |

| Recipe status | Rows |
| --- | ---: |
| no-current-recipe | 409 |
| current-recipe-exact-version | 70 |
| current-recipe-different-version | 21 |

Use [top500-catalog-analysis/summary.md](../top500-catalog-analysis/summary.md)
for the narrative and [top500-catalog-analysis/review.csv](../top500-catalog-analysis/review.csv)
for one row per retained source-scan chart.

## Top20 Catalog Status

This is the compact chart-by-chart view for the public catalog. It shows the
supported base variants, current evidence strength, and lane counts. The CSV
also includes each chart's feature summary for hooks, CRDs, generated Secrets,
webhooks, values schemas, and other tracked quirks. Use
[top20-status.csv](top20-status.csv) when you want the same data in a
spreadsheet.

| Chart | Recommended base | Base readiness | Strongest evidence | Render | ConfigHub | Local live | GitOps live | Live parity | Hard gap |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| argo-cd/argo-cd@9.5.15 | default (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/mongodb@19.0.7 | generated-passwords (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| bitnami/mysql@14.0.3 | generated-passwords (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/nginx@24.0.2 | http-clusterip (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | existing-secret (chart ships no Secret toggle) |
| bitnami/postgresql@18.6.7 | generated-passwords (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 2/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/rabbitmq@16.0.14 | generated-passwords (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/redis@25.5.3 | default (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 2/2 | 2/2 | 1/2 | - |
| external-secrets/external-secrets@2.5.0 | default (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| grafana/grafana@10.5.15 | generated-passwords (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| grafana/loki@7.0.0 | single-binary-filesystem (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| grafana/tempo@1.24.4 | local-persistent (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (tempo single-binary chart; HA is the separate tempo-distributed chart) |
| hashicorp/consul@2.0.0 | default-control-plane (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| hashicorp/vault@0.32.0 | dev-mode (start-here) | start-here:1; try-with-proof:2 | live-helm-vs-confighub-parity | 3/3 | 1/3 | 2/3 | 1/3 | 1/3 | - |
| ingress-nginx/ingress-nginx@4.15.1 | internal-clusterip (start-here) | start-here:1; try-with-proof:2 | live-helm-vs-confighub-parity | 3/3 | 1/3 | 2/3 | 1/3 | 1/3 | - |
| jetstack/cert-manager@v1.20.2 | crds-enabled (start-here) | start-here:1; lifecycle-observed:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| longhorn/longhorn@1.11.2 | default (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| metrics-server/metrics-server@3.13.0 | default (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | existing-secret (chart ships no Secret toggle) |
| prometheus-community/kube-prometheus-stack@85.3.3 | default (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | existing-secret (chart ships no Secret toggle) |
| prometheus-community/prometheus@29.8.0 | server-only-ephemeral (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 | default (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |

The table is deliberately lane-specific. A chart can be useful today without
every lane passing for every base variant. The exact per-base rows are in
[outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv).
The `Base readiness` column is generated from
[top20-base-readiness/base-readiness.csv](../top20-base-readiness/base-readiness.csv),
which is the better source when the question is which base variant to try
first.

## Live And Parity Residue

| Lane | Pass | Non-pass | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| in-ConfigHub | 20 | 0 | 139 | 159 |
| local live | 23 | 0 | 136 | 159 |
| GitOps/OCI live | 22 | 6 | 131 | 159 |
| live Helm-vs-ConfigHub parity | 20 | 2 | 137 | 159 |
| two-cluster kind parity | 49 | 1 | 0 | 50 |

Non-pass live receipts are useful evidence. They usually identify a target
prerequisite, runtime behavior, or provisioning boundary rather than a render
parity failure.

Current semantic parity defect receipts:

~~~text
ConfigHub/OCI live comparison: 0/20
two-cluster kind parity:       0/50
~~~

The two-cluster kind parity lane is the cleanest live comparison for chart/base
rows: regular Helm is applied to one vanilla kind cluster and the `cub installer`
rendered objects are applied to another vanilla kind cluster. The receipts then
compare the live outcomes. Use
[live-kind-parity/summary.csv](../live-kind-parity/summary.csv) for those rows.

## Live Parity Next Actions

The rerun plan groups non-pass rows by the work needed before another rerun is
useful.

| Rerun readiness | Rows | Meaning |
| --- | ---: | --- |


| Next step | Rows | Meaning |
| --- | ---: | --- |


Use [live-parity-rerun-plan/summary.md](../live-parity-rerun-plan/summary.md)
for the exact row, command, receipt, diagnosis, and follow-up.

There are no current live parity non-pass receipts.


Current two-cluster kind parity non-pass receipts:

| Chart | Base | Result | Reason |
| --- | --- | --- | --- |
| jetstack/cert-manager@v1.20.2 | default | blocked | helm-hook: post-install hook failed (parity passed) |


## Production Disposition Boundary

The top-20 catalog entries are currently supported for the declared local-test
scope. Production support is tracked separately. A review-ready row has accepted
dispositions for scan/gate warnings, lifecycle risks, target facts, storage
policy, RBAC, webhook behavior, and extension slots. Final production support
is recorded only in the target-scoped support decision artifacts.

| Metric | Value |
| --- | ---: |
| production-review-ready disposition rows | 19/20 |
| production-blocked pending disposition | 1/20 |
| charts with accepted dispositions | 20/20 |
| target-scoped support decision artifacts | 20/20 |
| supported decision artifacts | 17/20 |
| superseded decision artifacts | 2/20 |
| rejected decision artifacts | 1/20 |
| draft decision artifacts | 0/20 |
| high-priority scan rows | 4/20 |
| mutable-image rows still needing fixes | 0/20 |

| Open disposition | Charts |
| --- | ---: |
| target fact preflight | 1 |

| Scan route | Charts |
| --- | ---: |
| accept-or-patch-pdb-policy | 6 |
| add-resource-policy | 5 |
| harden-security-context | 5 |
| accept-or-split-privileged-infrastructure | 4 |

| Chart | Production | Accepted | Open | Next action |
| --- | --- | ---: | ---: | --- |
| argo-cd/argo-cd@9.5.15 | production-review-ready | 7 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |
| bitnami/mongodb@19.0.7 | production-review-ready | 6 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |
| bitnami/mysql@14.0.3 | production-review-ready | 5 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |
| bitnami/nginx@24.0.2 | production-review-ready | 4 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |
| bitnami/postgresql@18.6.7 | production-review-ready | 5 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |
| bitnami/rabbitmq@16.0.14 | production-review-ready | 5 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |
| bitnami/redis@25.5.3 | production-review-ready | 4 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |
| external-secrets/external-secrets@2.5.0 | production-review-ready | 6 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |
| grafana/grafana@10.5.15 | production-review-ready | 5 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |
| grafana/loki@7.0.0 | production-review-ready | 5 | 0 | record final target-scoped support decision and refresh live/e2e evidence for that scope |

Use [production-disposition/summary.md](../production-disposition/summary.md)
for the full top-20 disposition table and
[scan-disposition-workdown/summary.md](../scan-disposition-workdown/summary.md)
for the scan warning routes. Use
[production-support-decisions/summary.md](../production-support-decisions/summary.md)
for target-scoped support decision artifacts.

## Derived Variant Evidence

Derived ConfigHub variants are the post-render half of the model. They start
from reviewed uploaded bases and use `cub variant create` plus ConfigHub
metadata, targets, gates, links, checks, and receipts. They do not rerender
Helm.

| Metric | Value |
| --- | ---: |
| derived variant golden rows | 10/10 |
| live cub variant create receipts | 10/10 |
| target-bound derived variant receipts | 6/10 |

The golden rows are in
[variant-goldens/derived-expansion-wave/work-orders.csv](../variant-goldens/derived-expansion-wave/work-orders.csv).
Live create receipts are in
[runs/derived-variant-execution](../../runs/derived-variant-execution), and
target-bound receipts are in
[runs/derived-variant-target-bound](../../runs/derived-variant-target-bound).

## Quirk And Hook Residue

| Quirk coverage tier | Axes |
| --- | ---: |
| tracked-and-surfaced | 9 |
| not-scanned | 6 |
| source-scanned-not-surfaced | 5 |
| partly-tracked | 3 |
| tracked-by-lock-not-front-door | 2 |
| disclosed-not-complete | 1 |

## Extension Slot Coverage

Extension slots are Helm inputs that can inject raw manifests, templated
snippets, config blocks, sidecars, extra volumes, or chart-specific config
files. They are useful, but a populated slot changes the install shape. The
supported catalog route is to keep them empty or controlled in the first base,
then create a reviewed `cub installer` base when a slot is populated.

| Scope | Charts |
| --- | ---: |
| top-20 catalog charts with extension slots | 13/20 |
| top-100 chart facts with extension slots | 82/100 |
| top-500 source rows using `tpl` | 362/500 |

| Top-20 chart | Example surfaces | Route |
| --- | --- | --- |
| argo-cd/argo-cd@9.5.15 | raw/extra manifests; tpl-powered values | keep empty in supported bases, or make a reviewed installer base when populated |
| bitnami/mongodb@19.0.7 | tpl-powered values | keep empty in supported bases, or make a reviewed installer base when populated |
| bitnami/nginx@24.0.2 | NGINX config blocks; raw/extra manifests; sidecars | keep empty in supported bases, or make a reviewed installer base when populated |
| external-secrets/external-secrets@2.5.0 | raw/extra manifests; tpl-powered values | keep empty in supported bases, or make a reviewed installer base when populated |
| grafana/grafana@10.5.15 | sidecars; monitoring config; Secret/env injection | keep empty in supported bases, or make a reviewed installer base when populated |
| grafana/loki@7.0.0 | raw/extra manifests; Secret/env injection; tpl-powered values | keep empty in supported bases, or make a reviewed installer base when populated |
| grafana/tempo@1.24.4 | volumes/mounts; tpl-powered values | keep empty in supported bases, or make a reviewed installer base when populated |
| hashicorp/consul@2.0.0 | controller/gateway config; tpl-powered values | keep empty in supported bases, or make a reviewed installer base when populated |
| hashicorp/vault@0.32.0 | sidecars; volumes/mounts; Secret/env injection | keep empty in supported bases, or make a reviewed installer base when populated |
| jetstack/cert-manager@v1.20.2 | raw/extra manifests; tpl-powered values | keep empty in supported bases, or make a reviewed installer base when populated |
| prometheus-community/kube-prometheus-stack@85.3.3 | raw/extra manifests; monitoring config; tpl-powered values | keep empty in supported bases, or make a reviewed installer base when populated |
| prometheus-community/prometheus@29.8.0 | raw/extra manifests; monitoring config | keep empty in supported bases, or make a reviewed installer base when populated |
| secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 | chart-specific tpl/raw/config slots | keep empty in supported bases, or make a reviewed installer base when populated |

Use [extension-slots/summary.md](../extension-slots/summary.md) for the full
NGINX-style extension-slot report.

## Hook Residue

| Hook chart | Selected base | Current disposition | Next action |
| --- | --- | --- | --- |
| prometheus-community/kube-prometheus-stack@85.3.3 | default | route-selected | run selected lifecycle path and commit observation or execution receipt |
| kyverno/kyverno@3.8.1 | default | route-selected | run selected lifecycle path and commit observation or execution receipt |
| fluent/fluent-bit@0.57.6 | default | route-selected | run selected lifecycle path and commit observation or execution receipt |
| projectcalico/tigera-operator@v3.32.0 | default | route-selected | run selected lifecycle path and commit observation or execution receipt |
| gatekeeper/gatekeeper@3.22.2 | default | route-selected | run selected lifecycle path and commit observation or execution receipt |

Hook rows are not support claims. Route-selected means the chart has an
explicit handling plan; lifecycle-observed means that plan has runtime or
execution evidence. The hook doctrine is
[Seven-Stage Helm Lifecycle](../../docs/reference/seven-stage-helm-lifecycle.md)
and [Hook Lifecycle Strategy](../../docs/user/hook-lifecycle-strategy.md).

The generated boundary table separates hook queue rows from hook-like
controller lifecycle observations:

| Lifecycle lane | Rows |
| --- | ---: |
| helm-hook-lifecycle-queue | 5 |
| hook-like-lifecycle-observation | 4 |

Open [lifecycle-boundary/summary.md](../lifecycle-boundary/summary.md) when the
question is whether a row proves hook execution or only proves controller
lifecycle observation.

## How To Use This

| Question | Open |
| --- | --- |
| Can I use this chart today? | [top100-readiness/readiness.csv](../top100-readiness/readiness.csv) |
| Which top-100 rows satisfy the strict coverage contract? | [top100-coverage/coverage.csv](../top100-coverage/coverage.csv) |
| Which top-100 partial rows should move next? | [top100-coverage/work-queue.md](../top100-coverage/work-queue.md) |
| Which top-100 promotion rows are first? | [top100-promotion-wave/summary.md](../top100-promotion-wave/summary.md) |
| Which top-100 rows need a human limitation decision? | [top100-coverage/decisions-needed.md](../top100-coverage/decisions-needed.md) |
| How much of the retained top500 source scan maps to current proof? | [top500-catalog-analysis/review.csv](../top500-catalog-analysis/review.csv) |
| Which base variants have which proof lanes? | [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) |
| Which top-20 base variant should I start with? | [top20-base-readiness/summary.md](../top20-base-readiness/summary.md) |
| Which hooks, CRDs, generated facts, or target facts matter? | [outcome-coverage/feature-outcomes.csv](../outcome-coverage/feature-outcomes.csv) |
| Which charts have NGINX-like extension slots? | [extension-slots/summary.md](../extension-slots/summary.md) |
| Which Helm quirk axes are still blind spots? | [quirk-coverage/coverage.csv](../quirk-coverage/coverage.csv) |
| Which hook charts need lifecycle receipts? | [hook-lifecycle/top100-hooks.csv](../hook-lifecycle/top100-hooks.csv) |
| Which hook claims are queued versus observed? | [lifecycle-boundary/summary.md](../lifecycle-boundary/summary.md) |
| Which Helm artifacts have recovered graph fragments? | [edge-recovery/summary.md](../edge-recovery/summary.md) |
| Which live comparisons passed or failed? | [live-helm-confighub-compare/summary.csv](../live-helm-confighub-compare/summary.csv) |
| Which live rows should be rerun next? | [live-parity-rerun-plan/summary.md](../live-parity-rerun-plan/summary.md) |
| Which top-20 charts are production-supported? | [production-support-decisions/summary.md](../production-support-decisions/summary.md) |
| Which production-support tasks can be assigned? | [production-support-decisions/work-items.csv](../production-support-decisions/work-items.csv) |
| Which derived variants are specified or executed? | [variant-goldens/derived-expansion-wave/work-orders.csv](../variant-goldens/derived-expansion-wave/work-orders.csv) |

Regenerate:

~~~sh
npm run status:dashboard
npm run status:dashboard:verify
~~~
