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
| outcome coverage | maintained chart rows with model support | 108/110 | good | [data/outcome-coverage/chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) |
| top100 | catalog-supported charts | 20/100 | partial | [data/top100-readiness/readiness.csv](../../data/top100-readiness/readiness.csv) |
| top100 | proof-grade non-catalog charts | 80/100 | partial | [data/top100-readiness/readiness.csv](../../data/top100-readiness/readiness.csv) |
| outcome coverage | variant-rich maintained chart rows | 74/110 | partial | [data/outcome-coverage/chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) |
| chart use | public catalog answers | 20/100 | partial | [data/chart-use-guide/chart-use-guide.csv](../../data/chart-use-guide/chart-use-guide.csv) |
| chart use | proof-ready but not public catalog answers | 37/100 | partial | [data/chart-use-guide/chart-use-guide.csv](../../data/chart-use-guide/chart-use-guide.csv) |
| chart use | better base variant needed answers | 35/100 | gap | [data/chart-use-guide/chart-use-guide.csv](../../data/chart-use-guide/chart-use-guide.csv) |
| chart use | limitation decision needed answers | 7/100 | gap | [data/chart-use-guide/chart-use-guide.csv](../../data/chart-use-guide/chart-use-guide.csv) |
| top100 | covered by top100 contract | 20/100 | partial | [data/top100-coverage/coverage.csv](../../data/top100-coverage/coverage.csv) |
| top100 | partial by top100 contract | 80/100 | partial | [data/top100-coverage/coverage.csv](../../data/top100-coverage/coverage.csv) |
| top100 | average top100 coverage | 88/100 | partial | [data/top100-coverage/coverage.csv](../../data/top100-coverage/coverage.csv) |
| top100 | top100 promotion-review queue | 37/80 | partial | [data/top100-coverage/work-queue.csv](../../data/top100-coverage/work-queue.csv) |
| top100 | first strict top100 promotion wave | 24/37 | partial | [data/top100-promotion-wave/wave.csv](../../data/top100-promotion-wave/wave.csv) |
| top100 | fast-track top100 promotion candidates | 3/24 | partial | [data/top100-promotion-wave/fast-track.csv](../../data/top100-promotion-wave/fast-track.csv) |
| top100 | fast-track promotion review packets | 3/3 | partial | [data/top100-promotion-wave/fast-track-reviews/review-packets.csv](../../data/top100-promotion-wave/fast-track-reviews/review-packets.csv) |
| top100 | fast-track storage rollback reviews | 3/3 | partial | [data/top100-promotion-wave/fast-track-reviews/storage-rollback/storage-reviews.csv](../../data/top100-promotion-wave/fast-track-reviews/storage-rollback/storage-reviews.csv) |
| top100 | top100 user-shaped variant queue | 35/80 | partial | [data/top100-coverage/work-queue.csv](../../data/top100-coverage/work-queue.csv) |
| top100 | useful-base proposal rows | 45 | partial | [data/useful-base-design-queue/queue.csv](../../data/useful-base-design-queue/queue.csv) |
| top100 | useful-base realized rows | 10/45 | partial | [data/useful-base-realization-wave/wave.csv](../../data/useful-base-realization-wave/wave.csv) |
| top100 | useful-base proposal families | 7/7 | partial | [data/useful-base-design-queue/families.csv](../../data/useful-base-design-queue/families.csv) |
| top100 | useful-base proposals not yet built | 35/45 | gap | [data/useful-base-design-queue/queue.csv](../../data/useful-base-design-queue/queue.csv) |
| top100 | top100 limitation-decision queue | 7/80 | partial | [data/top100-coverage/work-queue.csv](../../data/top100-coverage/work-queue.csv) |
| refresh | top20 proofs still current | 13/20 | partial | [data/refresh-survival/refreshes.csv](../../data/refresh-survival/refreshes.csv) |
| refresh | top20 upstream update candidates | 7/20 | partial | [data/refresh-survival/refreshes.csv](../../data/refresh-survival/refreshes.csv) |
| refresh | update candidates with proof-complete root paths | 7/7 | partial | [data/refresh-survival/refreshes.csv](../../data/refresh-survival/refreshes.csv) |
| refresh | latest refresh p0 action rows | 0/7 | partial | [data/latest-top20-refresh/action-queue/queue.csv](../../data/latest-top20-refresh/action-queue/queue.csv) |
| top500 | source rows scanned | 495/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | rows with current recipe proof | 91/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | catalog-supported rows | 20/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | proof-grade rows | 71/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | rows with no current recipe proof | 409/500 | gap | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| top500 | version-drift review rows | 21/500 | partial | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) |
| proof lanes | render parity rows | 192/192 | good | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | in-ConfigHub proof rows | 192/192 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | local live rows | 139/192 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | explicit lifecycle observation rows | 10/10 | good | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | local live non-pass rows classified | 53/53 | good | [data/local-live-triage/triage.csv](../../data/local-live-triage/triage.csv) |
| proof lanes | GitOps/OCI live pass rows | 134/192 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | live Helm-vs-ConfigHub parity pass rows | 134/192 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | two-cluster kind parity pass rows | 113/128 | partial | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| proof lanes | two-cluster semantic parity pass rows | 123/128 | good | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| proof lanes | complete core lane rows | 120/192 | gap | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | top20 start-here base variants | 37/42 | partial | [data/top20-base-readiness/base-readiness.csv](../../data/top20-base-readiness/base-readiness.csv) |
| proof lanes | top20 bases needing unresolved prerequisite or runtime review | 1/42 | partial | [data/top20-base-readiness/base-readiness.csv](../../data/top20-base-readiness/base-readiness.csv) |
| derived variants | derived variant golden rows | 10/10 | good | [data/variant-goldens/derived-expansion-wave/work-orders.csv](../../data/variant-goldens/derived-expansion-wave/work-orders.csv) |
| derived variants | derived variant live create receipts | 10/10 | good | [runs/derived-variant-execution](../../runs/derived-variant-execution) |
| derived variants | target-bound derived variant receipts | 6/10 | partial | [runs/derived-variant-target-bound](../../runs/derived-variant-target-bound) |
| graph bridge | charts with recovered graph fragments | 20/110 | partial | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| graph bridge | recovered graph edge rows | 108/108 | good | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| graph bridge | target-fact graph edges | 65/108 | partial | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| graph bridge | generated-fact graph edges | 1/108 | partial | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| graph bridge | rows with field reachability | 4/108 | partial | [data/edge-recovery/edges.csv](../../data/edge-recovery/edges.csv) |
| live evidence | runtime/GitOps wave rows | 11/11 | partial | [data/runtime-gitops/wave1.csv](../../data/runtime-gitops/wave1.csv) |
| live evidence | selected live Helm-vs-ConfigHub parity receipts | 134/161 | partial | [data/live-helm-confighub-compare/summary.csv](../../data/live-helm-confighub-compare/summary.csv) |
| live evidence | two-cluster kind parity receipts | 128/128 | partial | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| live evidence | live parity rerun rows needing decisions | 42/42 | partial | [data/live-parity-rerun-plan/rerun-plan.csv](../../data/live-parity-rerun-plan/rerun-plan.csv) |
| live evidence | live parity rows needing model or staging first | 6/42 | partial | [data/live-parity-rerun-plan/rerun-plan.csv](../../data/live-parity-rerun-plan/rerun-plan.csv) |
| live evidence | live parity rows needing target review first | 31/42 | partial | [data/live-parity-rerun-plan/rerun-plan.csv](../../data/live-parity-rerun-plan/rerun-plan.csv) |
| live evidence | live matrix commands remaining | 137 | gap | [data/live-matrix-burndown/work-items.csv](../../data/live-matrix-burndown/work-items.csv) |
| live evidence | live matrix GitOps/OCI parity commands remaining | 58 | gap | [data/live-matrix-burndown/work-items.csv](../../data/live-matrix-burndown/work-items.csv) |
| live evidence | live matrix two-cluster kind commands remaining | 79 | gap | [data/live-matrix-burndown/work-items.csv](../../data/live-matrix-burndown/work-items.csv) |
| live evidence | GitOps aggregate health residue rows | 27/161 | partial | [data/gitops-health-residue/residue.csv](../../data/gitops-health-residue/residue.csv) |
| live evidence | ConfigHub/OCI semantic parity defect receipts | 0/161 | good | [data/live-helm-confighub-compare/summary.csv](../../data/live-helm-confighub-compare/summary.csv) |
| live evidence | two-cluster semantic parity defect receipts | 4/128 | good | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| production disposition | top20 production-review-ready charts | 20/20 | partial | [data/production-disposition/top20.csv](../../data/production-disposition/top20.csv) |
| production disposition | top20 production-blocked charts | 0/20 | partial | [data/production-disposition/top20.csv](../../data/production-disposition/top20.csv) |
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
| quirks | P0 source quirk work queue rows | 51/95 | gap | [data/quirk-work-queue/top100-queue.csv](../../data/quirk-work-queue/top100-queue.csv) |
| quirks | hard proof gap shortlist rows | 25/51 | gap | [data/hard-proof-gaps/shortlist.csv](../../data/hard-proof-gaps/shortlist.csv) |
| remote dependencies | top100 dependency-risk rows with maintained locks | 19/49 | partial | [data/remote-dependency-closure/top100.csv](../../data/remote-dependency-closure/top100.csv) |
| remote dependencies | active P0 dependency closure work rows | 21/49 | gap | [data/remote-dependency-closure/top100.csv](../../data/remote-dependency-closure/top100.csv) |
| extension slots | top20 charts with extension slots | 13/20 | partial | [data/extension-slots/extension-slots.csv](../../data/extension-slots/extension-slots.csv) |
| extension slots | top100 charts with extension slots | 82/100 | partial | [data/extension-slots/extension-slots.csv](../../data/extension-slots/extension-slots.csv) |
| extension slots | top500 source rows using tpl | 362/500 | partial | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| secrets | top100 variants with explicit Secret disposition | 172/172 | good | [data/secret-lifecycle/variant-summary.csv](../../data/secret-lifecycle/variant-summary.csv) |
| secrets | Secret rows needing lifecycle lane support | 8/71 | gap | [data/secret-lifecycle/secrets.csv](../../data/secret-lifecycle/secrets.csv) |
| secrets | target-fact Secret rows | 28/71 | partial | [data/secret-lifecycle/secrets.csv](../../data/secret-lifecycle/secrets.csv) |
| hooks | top100 source-scan hook charts | 11/100 | partial | [data/hook-lifecycle/source-top100-hooks.csv](../../data/hook-lifecycle/source-top100-hooks.csv) |
| hooks | top100 source hook rows still uncovered | 0/11 | good | [data/hook-coverage/top100-hook-coverage.csv](../../data/hook-coverage/top100-hook-coverage.csv) |
| hooks | maintained hook queue rows | 5/11 | partial | [data/hook-lifecycle/maintained-hook-queue.csv](../../data/hook-lifecycle/maintained-hook-queue.csv) |
| hooks | source-reviewed hook rows not yet maintained | 8/11 | gap | [data/hook-lifecycle-review/top100-source-hook-route-review.csv](../../data/hook-lifecycle-review/top100-source-hook-route-review.csv) |
| hooks | source hook rows with candidate route plans | 8/11 | partial | [data/hook-coverage/top100-hook-coverage.csv](../../data/hook-coverage/top100-hook-coverage.csv) |
| hooks | hook-like candidate rows outside source inventory | 2/10 | partial | [data/hook-route-candidates/candidates.csv](../../data/hook-route-candidates/candidates.csv) |
| hooks | hook candidate route work orders | 72/72 | partial | [data/hook-route-candidates/work-orders.csv](../../data/hook-route-candidates/work-orders.csv) |
| hooks | hook route receipts present | 5/5 | partial | [data/hook-lifecycle/maintained-hook-queue.csv](../../data/hook-lifecycle/maintained-hook-queue.csv) |
| hooks | hook lifecycle observations present | 5/5 | good | [data/hook-lifecycle/maintained-hook-queue.csv](../../data/hook-lifecycle/maintained-hook-queue.csv) |
| hooks | hook partial lifecycle observations present | 0/5 | good | [data/hook-lifecycle/maintained-hook-queue.csv](../../data/hook-lifecycle/maintained-hook-queue.csv) |
| hooks | hook/lifecycle boundary rows | 10/10 | partial | [data/lifecycle-boundary/lifecycle-boundary.csv](../../data/lifecycle-boundary/lifecycle-boundary.csv) |
| hooks | hook queue rows still needing route receipts | 0/5 | good | [data/lifecycle-boundary/lifecycle-boundary.csv](../../data/lifecycle-boundary/lifecycle-boundary.csv) |
| hooks | hook routes still needing execution or observation | 0/5 | good | [data/lifecycle-boundary/lifecycle-boundary.csv](../../data/lifecycle-boundary/lifecycle-boundary.csv) |
| hooks | related lifecycle observation receipts passing | 4/4 | good | [data/lifecycle-observations/cert-manager-eso/summary.csv](../../data/lifecycle-observations/cert-manager-eso/summary.csv) |
| apiservice | top100 source APIService charts | 5/100 | partial | [data/apiservice-coverage/top100-apiservice-coverage.csv](../../data/apiservice-coverage/top100-apiservice-coverage.csv) |
| apiservice | APIService rows with object/workload observation | 2/5 | partial | [data/apiservice-coverage/top100-apiservice-coverage.csv](../../data/apiservice-coverage/top100-apiservice-coverage.csv) |
| apiservice | APIService rows with aggregation availability receipts | 2/5 | partial | [data/apiservice-coverage/top100-apiservice-coverage.csv](../../data/apiservice-coverage/top100-apiservice-coverage.csv) |
| apiservice | APIService rows still source-detected only | 3/5 | gap | [data/apiservice-coverage/top100-apiservice-coverage.csv](../../data/apiservice-coverage/top100-apiservice-coverage.csv) |

## Next Work Queues

Use this section when the question is what should move next, not when the
question is whether a specific receipt passed.
Workstreams can overlap: one chart can need image, scan, lifecycle, and fresh
evidence work before it becomes production-supported for a target scope.

### Top100 Catalog Work

| Queue | Charts | Next action |
| --- | ---: | --- |
| Use public catalog now | 20 | Open CATALOG.md and top20 base readiness; choose a base with the lane you need. |
| Promote proof-grade charts | 37 | Run catalog promotion review, select realistic bases, and add selected live lanes. |
| Fast-track low-residue promotion rows | 3 | Open the storage/rollback reviews, choose the target boundaries, complete any proof lanes listed in fast-track.csv, then record target-scoped support decisions. |
| Design useful base variants | 35 | Build the proposed recipe/package bases, then rerun render parity and promotion review before treating them as catalog offers. |
| Resolve limitation decisions | 7 | Decide whether the named gap is supported, disclosed, deferred, or blocked. |

### Hard Proof Gap Work

These rows are the top assignment queue for public charts where source-scan
quirks, dependency closure, or hook routing could damage trust if overclaimed.

| Queue | Rows | Next action |
| --- | ---: | --- |
| Shortlist | 25 | Assign the first rows to modeled facts, route receipts, runtime observations, better bases, or explicit blockers. |
| Catalog-visible hard gaps | 3 | Handle visible catalog rows first so public claims stay narrow and backed. |
| Hook-route hard gaps | 9 | Promote candidate routes into maintained receipts, runtime observations, or explicit blockers. |
| Remote dependency hard gaps | 20 | Close dependency range policy, refresh-survival, and recipe-import gaps before stronger catalog claims. |
| APIService hard gaps | 4 | Add APIService readiness modeling and runtime observation routes. |

### Remote Dependency Closure Work

These rows close provenance and refresh-survival gaps for public charts that
pull remote, vendored, or non-exact dependencies.

| Workstream | Rows | Next action |
| --- | ---: | --- |
| Create recipe/import candidates | 30 | Create recipe/import candidates with source locks, dependency locks, first bases, render parity, and catalog decisions. |
| Add dependency locks | 0 | Add dependency-lock.yaml or record that the dependency closure is intentionally empty. |
| Record dependency range policy | 5 | Record non-exact dependency policy and refresh-survival evidence before promotion or upgrade. |
| Backfill dependency provenance | 0 | Record a Chart.lock digest or source-derived dependency provenance. |
| Promote closure facts | 0 | Expose dependency closure facts in chart facts and status surfaces. |

### Top20 Production Support Work

| Workstream | Charts | Next action |
| --- | ---: | --- |
| Supported scope evidence | 17 | Keep target-scoped evidence fresh before using the supported scope as a production example. |

### Latest Refresh Work

These rows are the current upstream-update queue for the supported top-20
catalog. A row here does not replace the supported catalog version by itself.
It identifies the next proof or review action before a replacement can be
considered.

| Action | Charts | Next action |
| --- | ---: | --- |
| Write replacement decisions | 0 | Review the latest-aligned candidate against the supported version and record a target-scoped replacement decision. |
| Refresh superseded retained candidates | 0 | Regenerate candidate proof/package roots for the newer upstream version, then rerun the refresh surfaces. |
| Create missing retained candidates | 0 | Make the needed generator support version/output overrides, then create the missing candidate proof. |
| Promote render candidates and complete live lanes | 0 | Promote the candidate root paths, then run ConfigHub proof, local live, and live parity lanes before replacement. |

### Live Parity Work

| Queue | Rows | Next action |
| --- | ---: | --- |
| inspect-diff-first | 4 | Inspect the semantic diff before another rerun. |
| model-or-stage-first | 6 | Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning. |
| review-target-first | 31 | Review runtime, storage, controller health, or wait conditions before rerunning. |
| inspect-receipt-first | 1 | Read the receipt and classify the row before rerunning. |

### Active Proof Queue

These are the current live parity rows where another run is not the first useful
step. When a support artifact exists, it is linked here; otherwise the row still
needs a support artifact or a direct receipt review before rerun.

| Chart | Base | Result | Next step | Support artifact |
| --- | --- | --- | --- | --- |
| jaegertracing/jaeger-operator@2.57.0 | default | blocked | runtime-review | - |
| argo-cd/argo-cd@9.5.17 | default | watch | gitops-runtime-review | [recipes/argo-cd/argo-cd/9.5.17/gitops-runtime-review.yaml](../../recipes/argo-cd/argo-cd/9.5.17/gitops-runtime-review.yaml) |
| bitnami/mongodb@19.0.9 | existing-secret-replicaset | watch | gitops-runtime-review | [recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml](../../recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml) |
| bitnami/mongodb@19.1.0 | existing-secret-replicaset | watch | gitops-runtime-review | [recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml](../../recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml) |
| bitnami/nginx@24.0.4 | existing-tls-ingress | watch | gitops-runtime-review | [recipes/bitnami/nginx/24.0.4/gitops-runtime-review.yaml](../../recipes/bitnami/nginx/24.0.4/gitops-runtime-review.yaml) |
| bitnami/nginx@25.0.0 | existing-tls-ingress | watch | gitops-runtime-review | [recipes/bitnami/nginx/25.0.0/gitops-runtime-review.yaml](../../recipes/bitnami/nginx/25.0.0/gitops-runtime-review.yaml) |
| bitnami/opensearch@2.0.10 | default | watch | runtime-review | - |
| bitnami/opensearch@2.0.10 | ha | watch | runtime-review | - |
| elastic/filebeat@8.5.1 | default | watch | runtime-review | [recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml](../../recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml) |
| elastic/filebeat@8.5.1 | node-or-cluster-collector | watch | runtime-review | [recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml](../../recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml) |
| fluent/fluentd@0.5.3 | default | watch | runtime-review | [recipes/fluent/fluentd/0.5.3/runtime-review.yaml](../../recipes/fluent/fluentd/0.5.3/runtime-review.yaml) |
| grafana/pyroscope@2.0.2 | default | watch | runtime-review | [recipes/grafana/pyroscope/2.0.2/runtime-review.yaml](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) |
| grafana/pyroscope@2.0.2 | no-crds | watch | runtime-review | [recipes/grafana/pyroscope/2.0.2/runtime-review.yaml](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) |
| grafana/tempo@1.24.4 | s3-query-observability | watch | gitops-runtime-review | [recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml](../../recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml) |
| hashicorp/consul@2.0.0 | secure-mesh-existing-secrets | watch | gitops-runtime-review | [recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml](../../recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml) |
| hashicorp/terraform@1.1.2 | default | watch | runtime-review | [recipes/hashicorp/terraform/1.1.2/target-prerequisite-plan.yaml](../../recipes/hashicorp/terraform/1.1.2/target-prerequisite-plan.yaml) |
| hashicorp/terraform@1.1.2 | no-crds | watch | runtime-review | [recipes/hashicorp/terraform/1.1.2/target-prerequisite-plan.yaml](../../recipes/hashicorp/terraform/1.1.2/target-prerequisite-plan.yaml) |
| hashicorp/vault@0.32.0 | ha-raft-ui | watch | operating-policy | [recipes/hashicorp/vault/0.32.0/operating-policy.yaml](../../recipes/hashicorp/vault/0.32.0/operating-policy.yaml) |
| istio/gateway@1.30.0 | controller-default-reviewed | watch | runtime-review | [recipes/istio/gateway/1.30.0/target-prerequisite-plan.yaml](../../recipes/istio/gateway/1.30.0/target-prerequisite-plan.yaml) |
| istio/gateway@1.30.0 | default | watch | runtime-review | [recipes/istio/gateway/1.30.0/target-prerequisite-plan.yaml](../../recipes/istio/gateway/1.30.0/target-prerequisite-plan.yaml) |
| jetstack/trust-manager@v0.22.1 | default | watch | gitops-runtime-review | - |
| kyverno/kyverno-policies@3.8.0 | default | watch | gitops-runtime-review | [recipes/kyverno/kyverno-policies/3.8.0/gitops-runtime-review.yaml](../../recipes/kyverno/kyverno-policies/3.8.0/gitops-runtime-review.yaml) |
| linkerd/linkerd-crds@1.8.0 | default | watch | gitops-runtime-review | [recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml](../../recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml) |
| minio-operator/tenant@7.1.1 | default | watch | gitops-runtime-review | [recipes/minio-operator/tenant/7.1.1/gitops-runtime-review.yaml](../../recipes/minio-operator/tenant/7.1.1/gitops-runtime-review.yaml) |
| open-telemetry/opentelemetry-operator@0.114.0 | default | watch | gitops-runtime-review | [recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml](../../recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml) |
| prometheus-community/prometheus@29.9.0 | default | watch | gitops-runtime-review | [recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml](../../recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml) |
| traefik/traefik@40.2.0 | no-crds | watch | gitops-runtime-review | [recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml](../../recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml) |
| rook-release/rook-ceph-cluster@v1.19.5 | default | blocked | stage-prerequisite | [recipes/rook-release/rook-ceph-cluster/v1.19.5/target-prerequisite-plan.yaml](../../recipes/rook-release/rook-ceph-cluster/v1.19.5/target-prerequisite-plan.yaml) |
| bitnami/opensearch@2.0.10 | default | blocked | inspect-parity-diff | - |
| bitnami/opensearch@2.0.10 | ha | blocked | inspect-parity-diff | - |
| nats/nack@0.34.0 | default | blocked | inspect-parity-diff | - |
| nats/nats@2.14.0 | ha | blocked | inspect-parity-diff | - |
| autoscaler/cluster-autoscaler@9.57.0 | controller-default-reviewed | blocked | inspect-receipt | - |
| elastic/filebeat@8.5.1 | default | blocked | stage-prerequisite | [recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml](../../recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml) |
| fairwinds-stable/vpa@4.11.0 | no-crds | watch | stage-prerequisite | - |
| kedacore/keda@2.19.0 | no-crds | watch | stage-prerequisite | - |
| percona/pg-operator@3.0.0 | no-crds | watch | stage-prerequisite | - |
| fairwinds-stable/vpa@4.11.0 | default | watch | runtime-review | - |
| istio/gateway@1.30.0 | controller-default-reviewed | blocked | runtime-review | [recipes/istio/gateway/1.30.0/target-prerequisite-plan.yaml](../../recipes/istio/gateway/1.30.0/target-prerequisite-plan.yaml) |
| istio/gateway@1.30.0 | default | blocked | runtime-review | [recipes/istio/gateway/1.30.0/target-prerequisite-plan.yaml](../../recipes/istio/gateway/1.30.0/target-prerequisite-plan.yaml) |
| kyverno/kyverno-policies@3.8.0 | default | watch | runtime-review | - |
| nats/surveyor@0.20.9 | default | blocked | runtime-review | - |

### Local Live Non-Pass Triage

Every chart/base row now has local-kind observation evidence. Passing rows prove
that the rendered objects converged on the tested target. Non-pass rows are
classified here so they become next actions rather than vague failures.

| Route class | Rows | Next action |
| --- | ---: | --- |
| `runtime-readiness` | 22 | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. |
| `target-prerequisite` | 9 | Turn the missing target condition into a target fact, preflight, lifecycle route, or better base variant. |
| `webhook-cert-lifecycle` | 8 | Model the serving certificate as a generated fact, target fact, cert-manager dependency, preflight, or explicit lifecycle action, then rerun. |
| `image-dependency` | 6 | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. |
| `admission-or-rbac` | 3 | Decide whether the base needs a permission/admission preflight, a different target scope, or a rejected support boundary. |
| `api-version-unsupported` | 2 | Use a supported chart version, compatibility base, or target Kubernetes profile before rerun. |
| `cloud-or-provider-prerequisite` | 2 | Model the provider dependency as target facts or an external managed prerequisite before rerun. |
| `lifecycle-ordering` | 1 | Use the lifecycle route for this chart, then observe the staged apply or cleanup sequence with a receipt. |

| Chart | Base | Result | Route class |
| --- | --- | --- | --- |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | default | fail | `admission-or-rbac` |
| `velero/velero@12.0.1` | default | blocked | `admission-or-rbac` |
| `velero/velero@12.0.1` | no-crds | blocked | `admission-or-rbac` |
| `prometheus-community/prometheus-adapter@5.3.0` | cluster-metrics-readonly | blocked | `api-version-unsupported` |
| `prometheus-community/prometheus-adapter@5.3.0` | default | blocked | `api-version-unsupported` |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | default | fail | `cloud-or-provider-prerequisite` |
| `grafana/tempo@1.24.4` | s3-query-observability | blocked | `cloud-or-provider-prerequisite` |
| `bitnami/spark@10.0.3` | default | blocked | `image-dependency` |
| `bitnami/spark@10.0.3` | ha | blocked | `image-dependency` |
| `bitnami/zookeeper@13.8.7` | default | blocked | `image-dependency` |
| `bitnami/zookeeper@13.8.7` | ha | blocked | `image-dependency` |
| `istio/gateway@1.30.0` | controller-default-reviewed | blocked | `image-dependency` |

Use [local-live-triage/summary.md](../local-live-triage/summary.md) for the
full table with receipts and per-row next actions.

### Hook And Lifecycle Work

| Queue | Rows | Next action |
| --- | ---: | --- |
| Hook candidate route plans | 10 | Use these as reviewed inputs; do not treat them as maintained receipts or runtime proof. |
| Hook candidate work orders | 72 | Assign base rendering, dependency closure, target preflight, GitOps mapping, receipt, and observation tasks from the generated work-order list. |
| Hook candidates not yet maintained | 8 | Promote each candidate into a maintained lifecycle receipt, runtime observation path, or explicit blocker before support claims. |
| Hook route selected, observation pending | 0 | Run the selected lifecycle path and commit execution or observation receipts. |
| Hook install lifecycle observed, remaining phase pending | 0 | Run the remaining lifecycle phase, such as upgrade, and commit the execution or observation receipt. |
| Hook-bearing rows observed | 5 | Keep receipt freshness current when the supported target changes. |
| Related CRD/webhook/controller observations | 4 | Use these as examples for hook-like lifecycle proof, not as universal hook support. |

Spreadsheet forms: [next-work-queues.csv](next-work-queues.csv) and
[active-proof-queue.csv](active-proof-queue.csv).

## Chart Use Answers

The Chart Use Guide is the user-facing route into the top-100 data. It answers
whether a chart is ready to try from the public catalog, needs promotion
review, needs a better base variant, or needs a limitation decision first.

| Answer | Charts | Meaning |
| --- | ---: | --- |
| yes-public-catalog | 20 | Public catalog entry exists. Choose a base and check the proof lane you need. |
| not-yet-public-catalog-proof-ready | 37 | Proof exists and variants look useful, but catalog promotion review is not done. |
| not-yet-user-ready | 35 | The current proof is too default-shaped; design a useful base variant first. |
| decision-needed-first | 7 | A named gap must be supported, disclosed, deferred, or blocked before promotion. |

Use [chart-use-guide/summary.md](../chart-use-guide/summary.md) for one row per
top-100 chart and the next command or file to open.

## Top100 Readiness

| Adoption bucket | Charts |
| --- | ---: |
| promote-after-review | 37 |
| needs-useful-variant | 35 |
| try-from-public-catalog | 20 |
| limitation-decision-first | 7 |
| not-ready | 1 |

| Strongest evidence | Charts |
| --- | ---: |
| live-helm-vs-confighub-parity | 49 |
| local-kubernetes-live | 24 |
| in-confighub-proof | 23 |
| two-cluster-kind-parity | 4 |

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
| argo-cd/argo-cd@9.5.15 | no-crds (try-with-proof) | try-with-proof:1; render-only:1 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 1/2 | 2/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/mongodb@19.0.7 | generated-passwords (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | - |
| bitnami/mysql@14.0.3 | generated-passwords (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/nginx@24.0.2 | http-clusterip (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | existing-secret (chart ships no Secret toggle) |
| bitnami/postgresql@18.6.7 | generated-passwords (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/rabbitmq@16.0.14 | generated-passwords (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/redis@25.5.3 | default (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | - |
| external-secrets/external-secrets@2.5.0 | default (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | - |
| grafana/grafana@10.5.15 | existing-secret-ingress (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | - |
| grafana/loki@7.0.0 | single-binary-filesystem (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | - |
| grafana/tempo@1.24.4 | local-persistent (start-here) | start-here:1; try-with-proof:1 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 1/2 | 1/2 | 1/2 | ha (tempo single-binary chart; HA is the separate tempo-distributed chart) |
| hashicorp/consul@2.0.0 | default-control-plane (start-here) | start-here:1; runtime-watch:1 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| hashicorp/vault@0.32.0 | default (start-here) | start-here:2; try-with-proof:1 | live-helm-vs-confighub-parity | 3/3 | 3/3 | 2/3 | 2/3 | 2/3 | - |
| ingress-nginx/ingress-nginx@4.15.1 | internal-clusterip (start-here) | start-here:3 | live-helm-vs-confighub-parity | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | - |
| jetstack/cert-manager@v1.20.2 | crds-enabled (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | - |
| longhorn/longhorn@1.11.2 | default (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | - |
| metrics-server/metrics-server@3.13.0 | default (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | existing-secret (chart ships no Secret toggle) |
| prometheus-community/kube-prometheus-stack@85.3.3 | default (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | existing-secret (chart ships no Secret toggle) |
| prometheus-community/prometheus@29.8.0 | server-only-ephemeral (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 | default (start-here) | start-here:2 | live-helm-vs-confighub-parity | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | - |

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
| in-ConfigHub | 192 | 0 | 0 | 192 |
| local live | 139 | 53 | 0 | 192 |
| GitOps/OCI live | 134 | 27 | 31 | 192 |
| live Helm-vs-ConfigHub parity | 134 | 27 | 31 | 192 |
| two-cluster kind parity | 113 | 15 | 0 | 128 |

Non-pass live receipts are useful evidence. They usually identify a target
prerequisite, runtime behavior, or provisioning boundary rather than a render
parity failure.

Current semantic parity defect receipts:

~~~text
ConfigHub/OCI live comparison: 0/161
two-cluster kind parity:       4/128
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
| inspect-diff-first | 4 | Inspect the semantic diff before another rerun. |
| model-or-stage-first | 6 | Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning. |
| review-target-first | 31 | Review runtime, storage, controller health, or wait conditions before rerunning. |
| inspect-receipt-first | 1 | Read the receipt and classify the row before rerunning. |

| Next step | Rows | Meaning |
| --- | ---: | --- |
| inspect-parity-diff | 4 | Inspect the semantic object diff before changing waits, target provisioning, or the recipe. |
| stage-prerequisite | 5 | Stage or model CRDs, APIs, Secrets, storage, or another target prerequisite before rerunning. |
| operating-policy | 1 | Record the operating policy decision, then rerun only if expected readiness changes. |
| gitops-runtime-review | 14 | Inspect GitOps/controller health and rerun after target conditions or controller waits are corrected. |
| runtime-review | 17 | Inspect runtime readiness, waits, storage, capacity, or app initialization before rerunning. |
| inspect-receipt | 1 | Read the receipt and classify the row before rerunning. |

Use [live-parity-rerun-plan/summary.md](../live-parity-rerun-plan/summary.md)
for the exact row, command, receipt, diagnosis, and follow-up.

Current ConfigHub/OCI live parity non-pass receipts:

| Chart | Variant | Result | Reason |
| --- | --- | --- | --- |
| argo-cd/argo-cd@9.5.17 | default | watch | gitops-runtime: child Argo Application not materialized (parity passed) |
| hashicorp/vault@0.32.0 | ha-raft-ui | watch | operate-policy: Vault init/unseal readiness (parity passed) |
| prometheus-community/prometheus@29.9.0 | default | watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) |
| bitnami/mongodb@19.0.9 | existing-secret-replicaset | watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) |
| bitnami/mongodb@19.1.0 | existing-secret-replicaset | watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) |
| bitnami/nginx@24.0.4 | existing-tls-ingress | watch | gitops-runtime: Argo health Progressing (parity passed) |
| bitnami/nginx@25.0.0 | existing-tls-ingress | watch | gitops-runtime: Argo health Progressing (parity passed) |
| grafana/tempo@1.24.4 | s3-query-observability | watch | gitops-runtime: Argo health Progressing (parity passed) |
| hashicorp/consul@2.0.0 | secure-mesh-existing-secrets | watch | gitops-runtime: Argo health Progressing (parity passed) |
| bitnami/opensearch@2.0.10 | default | watch | target-runtime: pod config/runtime errors (parity passed) |
| bitnami/opensearch@2.0.10 | ha | watch | target-runtime: pod config/runtime errors (parity passed) |
| elastic/filebeat@8.5.1 | default | watch | target-runtime: pod ContainerCreating (parity passed) |
| elastic/filebeat@8.5.1 | node-or-cluster-collector | watch | target-runtime: pod ContainerCreating (parity passed) |
| fluent/fluentd@0.5.3 | default | watch | target-runtime: pod config/runtime errors (parity passed) |
| grafana/pyroscope@2.0.2 | default | watch | target-runtime: ConfigHub workload not ready (parity passed) |
| grafana/pyroscope@2.0.2 | no-crds | watch | target-runtime: ConfigHub workload not ready (parity passed) |
| hashicorp/terraform@1.1.2 | default | watch | target-runtime: pod ContainerCreating (parity passed) |
| hashicorp/terraform@1.1.2 | no-crds | watch | target-runtime: pod ContainerCreating (parity passed) |
| istio/gateway@1.30.0 | controller-default-reviewed | watch | target-runtime: pod config/runtime errors (parity passed) |
| istio/gateway@1.30.0 | default | watch | target-runtime: pod config/runtime errors (parity passed) |
| jetstack/trust-manager@v0.22.1 | default | watch | gitops-runtime: Argo health Progressing (parity passed) |
| kyverno/kyverno-policies@3.8.0 | default | watch | gitops-runtime: ClusterPolicy OutOfSync health Healthy (parity passed) |
| linkerd/linkerd-crds@1.8.0 | default | watch | gitops-runtime: CustomResourceDefinition OutOfSync health Healthy (parity passed) |
| minio-operator/tenant@7.1.1 | default | watch | gitops-runtime: Argo health Progressing (parity passed) |
| open-telemetry/opentelemetry-operator@0.114.0 | default | watch | gitops-runtime: Argo health Progressing (parity passed) |
| rook-release/rook-ceph-cluster@v1.19.5 | default | blocked | target-prerequisite: namespace missing (parity passed) |
| traefik/traefik@40.2.0 | no-crds | watch | gitops-runtime: Argo health Progressing (parity passed) |


Current two-cluster kind parity non-pass receipts:

| Chart | Base | Result | Reason |
| --- | --- | --- | --- |
| autoscaler/cluster-autoscaler@9.57.0 | controller-default-reviewed | blocked | blocked: inspect receipt |
| autoscaler/cluster-autoscaler@9.57.0 | default | watch | render-input: required Helm values missing (parity passed) |
| bitnami/opensearch@2.0.10 | default | blocked | parity: semantic object diff |
| bitnami/opensearch@2.0.10 | ha | blocked | parity: semantic object diff |
| elastic/filebeat@8.5.1 | default | blocked | target-prerequisite: required Secret missing (parity passed) |
| fairwinds-stable/vpa@4.11.0 | default | watch | target-runtime: pod crash loop (parity passed) |
| fairwinds-stable/vpa@4.11.0 | no-crds | watch | target-prerequisite: CRDs disabled or missing (parity passed) |
| istio/gateway@1.30.0 | controller-default-reviewed | blocked | target-runtime: pods pending (parity passed) |
| istio/gateway@1.30.0 | default | blocked | target-runtime: pods pending (parity passed) |
| kedacore/keda@2.19.0 | no-crds | watch | target-prerequisite: required Secret missing (parity passed) |
| kyverno/kyverno-policies@3.8.0 | default | watch | watch: object parity passed; readiness needs review |
| nats/nack@0.34.0 | default | blocked | parity: semantic object diff |
| nats/nats@2.14.0 | ha | blocked | parity: semantic object diff |
| nats/surveyor@0.20.9 | default | blocked | target-runtime: pod crash loop (parity passed) |
| percona/pg-operator@3.0.0 | no-crds | watch | target-prerequisite: CRDs disabled or missing (parity passed) |


## Production Disposition Boundary

The top-20 catalog entries are currently supported for the declared local-test
scope. Production support is tracked separately. A review-ready row has accepted
dispositions for scan/gate warnings, lifecycle risks, target facts, storage
policy, RBAC, webhook behavior, and extension slots. Final production support
is recorded only in the target-scoped support decision artifacts.

| Metric | Value |
| --- | ---: |
| production-review-ready disposition rows | 20/20 |
| production-blocked pending disposition | 0/20 |
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
| none | 0 |

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
| prometheus-community/kube-prometheus-stack@85.3.3 | default | lifecycle-observed | keep receipt fresh when chart, base, or cluster version changes |
| kyverno/kyverno@3.8.1 | default | lifecycle-observed | keep receipt fresh when chart, base, or cluster version changes |
| fluent/fluent-bit@0.57.6 | default | lifecycle-observed | keep receipt fresh when chart, base, or cluster version changes |
| projectcalico/tigera-operator@v3.32.0 | default | lifecycle-observed | keep receipt fresh when chart, base, or cluster version changes |
| gatekeeper/gatekeeper@3.22.2 | default | lifecycle-observed | keep receipt fresh when chart, base, or cluster version changes |

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
| selected-hook-route | 1 |

Open [lifecycle-boundary/summary.md](../lifecycle-boundary/summary.md) when the
question is whether a row proves hook execution or only proves controller
lifecycle observation.

## How To Use This

| Question | Open |
| --- | --- |
| Can I use this chart today? | [chart-use-guide/summary.md](../chart-use-guide/summary.md) |
| What is the underlying top-100 readiness row? | [top100-readiness/readiness.csv](../top100-readiness/readiness.csv) |
| Which top-100 rows satisfy the strict coverage contract? | [top100-coverage/coverage.csv](../top100-coverage/coverage.csv) |
| Which top-100 partial rows should move next? | [top100-coverage/work-queue.md](../top100-coverage/work-queue.md) |
| Which top-100 promotion rows are first? | [top100-promotion-wave/summary.md](../top100-promotion-wave/summary.md) |
| Which top-100 rows need a human limitation decision? | [top100-coverage/decisions-needed.md](../top100-coverage/decisions-needed.md) |
| How much of the retained top500 source scan maps to current proof? | [top500-catalog-analysis/review.csv](../top500-catalog-analysis/review.csv) |
| Which base variants have which proof lanes? | [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) |
| Which top-20 base variant should I start with? | [top20-base-readiness/summary.md](../top20-base-readiness/summary.md) |
| Which hooks, APIService, CRDs, generated facts, Secrets, or target facts matter? | [outcome-coverage/feature-outcomes.csv](../outcome-coverage/feature-outcomes.csv) |
| Which Secrets are delivered, staged, observed, or still need lifecycle support? | [secret-lifecycle/summary.md](../secret-lifecycle/summary.md) |
| Which APIService charts have object, workload, parity, or aggregation evidence? | [apiservice-coverage/summary.md](../apiservice-coverage/summary.md) |
| Which APIService proof row should move next? | [apiservice-coverage/work-orders.md](../apiservice-coverage/work-orders.md) |
| Which charts have NGINX-like extension slots? | [extension-slots/summary.md](../extension-slots/summary.md) |
| Which Helm quirk axes are still blind spots? | [quirk-coverage/coverage.csv](../quirk-coverage/coverage.csv) |
| Which source-scan quirk gaps should move first? | [quirk-work-queue/summary.md](../quirk-work-queue/summary.md) |
| Which remote dependency closures are locked? | [remote-dependency-closure/summary.md](../remote-dependency-closure/summary.md) |
| Which top-100 source rows contain Helm hooks, and are they covered? | [hook-coverage/summary.md](../hook-coverage/summary.md) |
| Which top-100 source rows contain Helm hooks? | [hook-lifecycle/source-top100-hooks.csv](../hook-lifecycle/source-top100-hooks.csv) |
| Which maintained hook rows need lifecycle receipts? | [hook-lifecycle/maintained-hook-queue.csv](../hook-lifecycle/maintained-hook-queue.csv) |
| Which hook route candidates have assignable next work? | [hook-route-candidates/work-orders.md](../hook-route-candidates/work-orders.md) |
| Which hook claims are queued versus observed? | [lifecycle-boundary/summary.md](../lifecycle-boundary/summary.md) |
| Which Helm artifacts have recovered graph fragments? | [edge-recovery/summary.md](../edge-recovery/summary.md) |
| Which live comparisons passed or failed? | [live-helm-confighub-compare/summary.csv](../live-helm-confighub-compare/summary.csv) |
| Which live rows should be rerun next? | [live-parity-rerun-plan/summary.md](../live-parity-rerun-plan/summary.md) |
| Which top-20 charts are production-supported? | [production-support-decisions/summary.md](../production-support-decisions/summary.md) |
| Which production-support tasks can be assigned? | [production-support-decisions/work-items.csv](../production-support-decisions/work-items.csv) |
| Which top-20 upstream updates should move next? | [latest-top20-refresh/action-queue/summary.md](../latest-top20-refresh/action-queue/summary.md) |
| Which derived variants are specified or executed? | [variant-goldens/derived-expansion-wave/work-orders.csv](../variant-goldens/derived-expansion-wave/work-orders.csv) |

Regenerate:

~~~sh
npm run status:dashboard
npm run status:dashboard:verify
~~~
