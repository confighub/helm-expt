# Master Catalog Matrix

ONE view of the whole catalog: one row per supported variant, grouped by chart
and version, with the translation attributes and per-lane status joined from
the committed sources below. This file invents no new truth — every cell comes
from a source the verifier checks this view against.

Three renderings of the same rows: this summary (GitHub),
[matrix.csv](matrix.csv) for spreadsheet import (CSV carries words, not
colors), and [matrix.html](matrix.html) — open it in a browser for the
literal red/green/grey colored cells.

## Legend

| Icon | Meaning |
| --- | --- |
| ✅ | yes / pass |
| ⚠️ | watch — passing with a recorded caution |
| ❌ | no / blocked |
| ⬜ | not yet run — absence of evidence, not a failure |
| — | not applicable — this lane does not apply to this base |

Lane columns: **R** render parity (helm template vs installer setup) ·
**C** ConfigHub upload + scan + safe ops · **L** local kind apply ·
**Y** explicit lifecycle observation ·
**G** ConfigHub OCI + Argo live · **P** live Helm-vs-ConfigHub dual parity ·
**K** two-cluster kind parity · **V** server-side ConfigHub variant promotion.
Hooks column: source hook count, disposition route, live-rehearsal status.
**Route** is the generated lifecycle route/off-ramp contract: ✅ all route rows
observed, ⚠️ route/executor named with cautions, ⬜ route work still todo, —
no route row applies.
`unrouted ⚠️` marks a chart whose source scan flags hooks but that has no
hook-disposition row yet; `(from @x.y.z)` marks chart-family evidence taken
from a different chart version's disposition row.

## Current Status

| Metric | Value |
| --- | ---: |
| Chart versions | 110 |
| Variant rows | 192 |
| Lane cells ✅ / ⚠️ / ❌ / ⬜ / — | 908 / 58 / 62 / 195 / 121 |
| Variants with the complete core lane set | 120 |
| Variants with a SUPPORTED production decision | 17 |
| Recorded production decisions (supported / superseded / rejected) | 17 / 2 / 1 |
| Server-side variant promotion (proven / watch / todo / blocked / n/a) | 0 / 20 / 172 / 0 / 0 |
| Lifecycle route contracts (observed / watch / todo / n/a) | 7 / 0 / 3 / 182 |
| Hook-flagged variants with no disposition row (unrouted) | 0 |
| Variants currently in the active proof queue | 36 |

Chart versions in the lane matrix but not in top-100 readiness (retained candidates or version drift): `argo-cd/argo-cd@9.5.17`, `bitnami/mongodb@19.0.9`, `bitnami/mongodb@19.1.0`, `bitnami/nginx@24.0.4`, `bitnami/nginx@25.0.0`, `bitnami/postgresql@18.6.10`, `bitnami/postgresql@18.7.0`, `bitnami/redis@27.0.0`, `prometheus-community/kube-prometheus-stack@86.1.0`, `prometheus-community/prometheus@29.9.0`.

## How To Use This Sheet

Each row is one chart/version/base variant. Use the row to answer three
questions before deciding what to do next:

| Question | Column to check |
| --- | --- |
| Can I try this now, promote it, or does it need more design? | Use / adoption bucket |
| What is the strongest evidence currently available? | Evidence, R/C/L/G/P/K, Core |
| What prevents a stronger claim? | Prod, Scope, Gap, Next action |
| Can downstream ConfigHub variants be promoted from this base? | V, Promotion status |
| If a hook or lifecycle behavior exists, where does it go? | Route, Hooks, lifecycle route contract |
| Which non-pass live row should be rerun or reviewed now? | Active proof |

The HTML view carries these user/product columns directly:
[matrix.html](matrix.html). The CSV carries the same fields for filtering:
[matrix.csv](matrix.csv). Counts below are variant rows unless stated
otherwise.

## Current Product Queues

| Queue | Rows | Meaning | Examples |
| --- | ---: | --- | --- |
| Public catalog rows | 42 | Reviewed top-20 catalog rows. Use base-readiness or the per-chart catalog page to choose the easiest first base. | `argo-cd/argo-cd@9.5.15/default`, `argo-cd/argo-cd@9.5.15/no-crds`, `bitnami/mongodb@19.0.7/existing-secret-replicaset` |
| Promote after review | 77 | Proof-grade rows that need catalog/product review before becoming public starting points. | `aqua/trivy-operator@0.32.1/default`, `aqua/trivy-operator@0.32.1/no-crds`, `argo-cd/argo-events@2.4.21/default` |
| Design a more useful base | 35 | Rows where plain render proof exists but the first user-facing base is not yet good enough. | `argo-cd/argocd-image-updater@1.2.2/default`, `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1/default`, `bitnami/apache@11.4.29/default` |
| Decide a limitation first | 15 | Rows where a product or operator boundary must be chosen before promotion. | `bitnami/contour@21.1.4/default`, `bitnami/contour@21.1.4/no-crds`, `bitnami/elasticsearch@22.1.6/default` |
| Complete the core proof lane | 72 | Rows missing at least one core evidence lane: ConfigHub proof, live Kubernetes, GitOps/OCI, or live parity. | `argo-cd/argo-cd@9.5.15/no-crds`, `argo-cd/argo-cd@9.5.17/default`, `argo-cd/argo-workflows@1.0.14/default` |
| Active proof queue | 36 | Rows with a current non-pass live parity result and an exact rerun or review action. | `argo-cd/argo-cd@9.5.17/default`, `autoscaler/cluster-autoscaler@9.57.0/controller-default-reviewed`, `bitnami/mongodb@19.0.9/existing-secret-replicaset` |
| Record or finish production scope | 172 | Rows without a target-scoped supported, superseded, or rejected production decision. | `aqua/trivy-operator@0.32.1/default`, `aqua/trivy-operator@0.32.1/no-crds`, `argo-cd/argo-cd@9.5.15/no-crds` |
| Investigate hard gaps | 43 | Rows with a named chart/product gap rather than a simple missing receipt. | `argo-cd/argo-cd@9.5.15/default`, `argo-cd/argo-cd@9.5.15/no-crds`, `argo-cd/argocd-image-updater@1.2.2/default` |

## Sources joined, and what this view compresses

The matrix is the variant-granularity overview, not a replacement for its
sources. Per source: what is carried here, and what deliberately stays
behind (follow the source link when you need it). Chart-granularity,
value-path-granularity, and claim-granularity views (status dashboard,
blast-radius accuracy, claims register) are different granularities, not
duplicates of this one.

| Source of truth | Carried into the matrix | Stays in the source |
| --- | --- | --- |
| [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) | the spine: variants, the five proof lanes, lifecycle observation, two-cluster kind parity (K), outcome level, core-lane completeness, recipe path | two_cluster_kind_parity_reason, missing_or_non_pass_lanes, evidence_notes, package_path, variant_revision |
| [top100-readiness/readiness.csv](../top100-readiness/readiness.csv) | catalog tier, adoption bucket, quirk features, hard gap, strongest evidence, next action | workability, user_status, per-chart lane ratios, proof_surface_rank, top500_rank, next_action_source/receipt, file paths |
| [hook-disposition/top100-hook-dispositions.csv](../hook-disposition/top100-hook-dispositions.csv) | source-top100 hook count, disposition, live status | hook_phases, selected_route detail, evidence_status text, next_action, evidence paths, rank |
| [hook-lifecycle/maintained-hook-queue.csv](../hook-lifecycle/maintained-hook-queue.csv) | maintained hook lifecycle fallback rows when a chart has an observed route outside the source-top100 disposition table | hook examples, route details, required receipt path, next action |
| [hook-route-candidates/candidates.csv](../hook-route-candidates/candidates.csv) | candidate hook routes for charts whose hook or hook-like lifecycle work has been reviewed but not promoted to a maintained receipt | pattern, phases, delete policies, dependency source, target dependencies, promotion next step |
| [lifecycle-boundary/selected-routes.csv](../lifecycle-boundary/selected-routes.csv) | base-specific hook candidate routes that have a selected route receipt | receipt evidence list, non-claim boundaries, remaining work |
| [lifecycle-routes/routes.csv](../lifecycle-routes/routes.csv) | route-contract status, route count, disposition summary, execution-mode summary, safe-as-automatic count, and chart-family evidence version when needed | per-route alternatives, requirements, exact evidence/next-action text; follow the JSON/CSV route contract for agent-readable detail |
| [production-support-decisions/decisions.csv](../production-support-decisions/decisions.csv) | decision, target scope | delivery_path, image/scan/lifecycle/target-fact/live-evidence sub-decisions, evidence_count, remaining_final_requirements, next_action |
| [variant-promotion/status.csv](../variant-promotion/status.csv) | server-side ConfigHub promotion status, matrix value, evidence path, reason, and next action | none; follow the source when you need the full per-row promotion route |
| [live-helm-confighub-compare/summary.csv](../live-helm-confighub-compare/summary.csv) | exact chart/version/base live GitOps/OCI and live Helm-vs-ConfigHub parity result, overriding older aggregate outcome rows when a newer receipt exists | receipt reason and path; follow the source when diagnosing the run itself |
| [live-kind-parity/summary.csv](../live-kind-parity/summary.csv) | exact chart/version/base two-cluster kind parity result, overriding older aggregate outcome rows when a newer receipt exists | semantic parity details, reason, related lifecycle evidence, and receipt path |
| [live-parity-rerun-plan/rerun-plan.csv](../live-parity-rerun-plan/rerun-plan.csv) | active non-pass live parity rows: next step, rerun readiness, reason, support artifact, rerun command | priority, lane, current result, receipt path; follow the source when diagnosing the run itself |

The CSV and HTML carry adoption bucket, hard gap, strongest evidence, next
action, production target scope, and active proof queue details. The Markdown
table below stays compact for GitHub readability; open [matrix.html](matrix.html)
when you want the user/product view with those columns visible.

## Matrix

| Chart | Variant | Tier | Quirks | Hooks | Route | R | C | L | Y | G | P | K | V | Outcome | Prod |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aqua/trivy-operator@0.32.1` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `argo-cd/argo-cd@9.5.15` | default | top20 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⚠️ | live-parity | ✅ |
|  | no-crds | top20 | — | — | — | ✅ | ✅ | ❌ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `argo-cd/argo-cd@9.5.17` | default | — | — | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
|  | no-crds | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `argo-cd/argo-events@2.4.21` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `argo-cd/argo-rollouts@2.40.9` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `argo-cd/argo-workflows@1.0.14` | default | next80 | — | 1 candidate-route ⬜ | ⬜ | ✅ | ✅ | ❌ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | controller-default-reviewed | next80 | — | 1 candidate-route ⬜ | ⬜ | ✅ | ✅ | ❌ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | minimal-crds | next80 | — | 1 observed ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `argo-cd/argocd-image-updater@1.2.2` | default | next80 | — | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `autoscaler/cluster-autoscaler@9.57.0` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⚠️ | ⬜ | live-parity | ⬜ |
|  | controller-default-reviewed | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ❌ | ⬜ | live-parity | ⬜ |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | default | next80 | — | — | — | ✅ | ✅ | ❌ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ❌ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | default | next80 | `tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `bitnami/apache@11.4.29` | default | next80 | `lookup;generated-facts;tpl;capabilities` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `bitnami/contour@21.1.4` | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac` | — | — | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac` | — | — | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `bitnami/elasticsearch@22.1.6` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | ha | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `bitnami/memcached@8.5.5` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `bitnami/mongodb@19.0.7` | existing-secret-replicaset | top20 | `lookup;generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
| `bitnami/mongodb@19.0.9` | existing-secret-replicaset | — | — | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | local-live | ⬜ |
|  | generated-passwords | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `bitnami/mongodb@19.1.0` | existing-secret-replicaset | — | — | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | local-live | ⬜ |
|  | generated-passwords | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `bitnami/mysql@14.0.3` | existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
| `bitnami/nginx@24.0.2` | existing-tls-ingress | top20 | `lookup;generated-facts;tpl;capabilities` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | http-clusterip | top20 | `lookup;generated-facts;tpl;capabilities` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
| `bitnami/nginx@24.0.4` | existing-tls-ingress | — | — | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | local-live | ⬜ |
|  | http-clusterip | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `bitnami/nginx@25.0.0` | existing-tls-ingress | — | — | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | local-live | ⬜ |
|  | http-clusterip | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `bitnami/opensearch@2.0.10` | default | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⚠️ | ⚠️ | ❌ | ⬜ | in-confighub | ⬜ |
|  | ha | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⚠️ | ⚠️ | ❌ | ⬜ | in-confighub | ⬜ |
| `bitnami/phpmyadmin@20.0.0` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `bitnami/postgresql@18.6.7` | existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
| `bitnami/postgresql@18.6.10` | existing-secret | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
|  | generated-passwords | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `bitnami/postgresql@18.7.0` | existing-secret | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
|  | generated-passwords | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `bitnami/rabbitmq@16.0.14` | existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
| `bitnami/redis@25.5.3` | default | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
|  | reuse-existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `bitnami/redis@27.0.0` | default | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
|  | reuse-existing-secret | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `bitnami/spark@10.0.3` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | ha | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `bitnami/zookeeper@13.8.7` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | ha | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `cloudnative-pg/cloudnative-pg@0.28.2` | default | next80 | `generated-facts;tpl;crds;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `generated-facts;tpl;crds;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ❌ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `coredns/coredns@1.45.2` | default | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `crossplane-stable/crossplane@2.3.1` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `descheduler/descheduler@0.36.0` | default | next80 | `tpl;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `dex/dex@0.24.0` | default | next80 | `tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `elastic/eck-operator@3.4.0` | default | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | ha | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `elastic/filebeat@8.5.1` | default | next80 | `tpl;cluster-rbac` | — | — | ✅ | ✅ | ❌ | — | ⚠️ | ⚠️ | ❌ | ⬜ | in-confighub | ⬜ |
|  | node-or-cluster-collector | next80 | `tpl;cluster-rbac` | — | — | ✅ | ✅ | ❌ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | in-confighub | ⬜ |
| `elastic/kibana@8.5.1` | default | next80 | `tpl` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `elastic/logstash@8.5.1` | default | next80 | `tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | ha | next80 | `tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `elastic/metricbeat@8.5.1` | default | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `external-dns/external-dns@1.21.1` | default | next80 | `tpl;crds;cluster-rbac` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | dry-run-txt-registry | next80 | `tpl;crds;cluster-rbac` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `tpl;crds;cluster-rbac` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `external-secrets/external-secrets@2.5.0` | default | top20 | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
|  | no-crds | top20 | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `fairwinds-stable/goldilocks@10.3.0` | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `fairwinds-stable/vpa@4.11.0` | default | next80 | `lookup;tpl;capabilities;crds;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `lookup;tpl;capabilities;crds;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⬜ | live-parity | ⬜ |
| `falcosecurity/falco@9.0.0` | default | next80 | `lookup;tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `falcosecurity/falcosidekick@0.13.1` | default | next80 | `capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `fluent/fluent-bit@0.57.6` | default | next80 | `tpl;capabilities;hooks;cluster-rbac` | 1 observed ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `fluent/fluentd@0.5.3` | default | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
| `gatekeeper/gatekeeper@3.22.2` | default | next80 | `capabilities;hooks;crds;cluster-rbac;webhooks` | 4 observed ✅ | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `capabilities;hooks;crds;cluster-rbac;webhooks` | 4 observed ✅ | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `gitlab/gitlab-runner@0.89.0` | default | next80 | `generated-facts;tpl;capabilities` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `grafana/alloy@1.8.2` | default | next80 | `tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `grafana/grafana@10.5.15` | existing-secret-ingress | top20 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | generated-passwords | top20 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | live-parity | superseded |
| `grafana/loki@7.0.0` | simple-scalable-minio | top20 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | single-binary-filesystem | top20 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
| `grafana/promtail@6.17.1` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `grafana/pyroscope@2.0.2` | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ⚠️ | ⚠️ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
|  | ha | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ⚠️ | ⚠️ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
| `grafana/rollout-operator@0.49.0` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ❌ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `grafana/tempo@1.24.4` | local-persistent | top20 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | live-parity | superseded |
|  | s3-query-observability | top20 | — | — | — | ✅ | ✅ | ❌ | — | ⚠️ | ⚠️ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
| `haproxytech/kubernetes-ingress@1.52.0` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `hashicorp/consul@2.0.0` | default-control-plane | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
|  | secure-mesh-existing-secrets | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
| `hashicorp/terraform@1.1.2` | default | next80 | `crds` | — | — | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | no-crds | next80 | `crds` | — | — | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ⬜ | ⬜ | in-confighub | ⬜ |
| `hashicorp/vault@0.32.0` | default | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | dev-mode | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ❌ |
|  | ha-raft-ui | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
| `ingress-nginx/ingress-nginx@4.15.1` | default | top20 | `tpl;capabilities;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | admission-disabled | top20 | `tpl;capabilities;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | internal-clusterip | top20 | `tpl;capabilities;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
| `istio/gateway@1.30.0` | default | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | controller-default-reviewed | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | in-confighub | ⬜ |
| `istio/istiod@1.30.0` | default | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `jaegertracing/jaeger@4.8.0` | default | next80 | `lookup;generated-facts;tpl;capabilities` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `jaegertracing/jaeger-operator@2.57.0` | default | next80 | `crds;webhooks` | — | — | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | no-crds | next80 | `crds;webhooks` | — | — | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `jetstack/cert-manager@v1.20.2` | default | top20 | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | crds-enabled | top20 | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
| `jetstack/cert-manager-csi-driver@v0.14.0` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `jetstack/trust-manager@v0.22.1` | default | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⚠️ | ⚠️ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
| `kedacore/keda@2.19.0` | default | next80 | `tpl;capabilities;crds;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `tpl;capabilities;crds;cluster-rbac;webhooks` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⚠️ | ⬜ | live-parity | ⬜ |
| `kyverno/kyverno@3.8.1` | default | next80 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | 8 observed ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | 8 observed ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `kyverno/kyverno-policies@3.8.0` | default | next80 | `lookup;tpl` | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ⚠️ | ⬜ | local-live | ⬜ |
| `linkerd/linkerd-crds@1.8.0` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | local-live | ⬜ |
| `longhorn/longhorn@1.11.2` | default | top20 | `generated-facts;tpl;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
|  | ui-ingress | top20 | `generated-facts;tpl;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `metrics-server/metrics-server@3.13.0` | default | top20 | `lookup;generated-facts;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
|  | external-tls-ca | top20 | `lookup;generated-facts;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `minio-operator/operator@7.1.1` | default | next80 | `cluster-rbac` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `minio-operator/tenant@7.1.1` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | local-live | ⬜ |
| `nats/nack@0.34.0` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ❌ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `nats/nats@2.14.0` | default | next80 | `tpl` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | ha | next80 | `tpl` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ❌ | ⬜ | live-parity | ⬜ |
| `nats/surveyor@0.20.9` | default | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ❌ | ⬜ | in-confighub | ⬜ |
|  | default-reviewed | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | default | next80 | `capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `open-telemetry/opentelemetry-operator@0.114.0` | default | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⚠️ | ⚠️ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ✅ | ⬜ | two-cluster-kind-parity | ⬜ |
| `opencost/opencost@2.5.21` | default | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `percona/pg-operator@3.0.0` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⚠️ | ⬜ | live-parity | ⬜ |
| `percona/psmdb-operator@1.22.0` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `percona/pxc-operator@1.19.1` | default | next80 | `lookup;crds;cluster-rbac` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `lookup;crds;cluster-rbac` | — | — | ✅ | ✅ | ❌ | ⬜ | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `projectcalico/tigera-operator@v3.32.0` | default | next80 | `lookup;hooks;cluster-rbac` | 1 observed ✅ | — | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `prometheus-community/alertmanager@1.37.0` | default | next80 | `tpl;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | ha | next80 | `tpl;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | top20 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;webhooks;stateful-storage` | 2 observed ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
|  | no-crds | top20 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;webhooks;stateful-storage` | 2 observed ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `prometheus-community/kube-prometheus-stack@86.1.0` | default | — | — | 2 observed ✅ (from @85.3.0) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
|  | no-crds | — | — | 2 observed ✅ (from @85.3.0) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `prometheus-community/kube-state-metrics@7.4.0` | default | next80 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | cluster-metrics-readonly | next80 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `prometheus-community/prometheus@29.8.0` | default | top20 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | server-only-ephemeral | top20 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
| `prometheus-community/prometheus@29.9.0` | default | — | — | — | — | ✅ | ✅ | ✅ | — | ⚠️ | ⚠️ | ⬜ | ⬜ | local-live | ⬜ |
|  | server-only-ephemeral | — | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `prometheus-community/prometheus-adapter@5.3.0` | default | next80 | `tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | apiservice-v1-capability | next80 | `tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
|  | cluster-metrics-readonly | next80 | `tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | default | next80 | `tpl;capabilities` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | cluster-metrics-readonly | next80 | `tpl;capabilities` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `prometheus-community/prometheus-node-exporter@4.55.0` | default | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | cluster-metrics-readonly | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `prometheus-community/prometheus-operator-crds@29.0.0` | default | next80 | `generated-facts;crds` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `prometheus-community/prometheus-pushgateway@3.6.0` | default | next80 | `tpl;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `rook-release/rook-ceph@v1.19.5` | default | next80 | — | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `rook-release/rook-ceph-cluster@v1.19.5` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ❌ | ❌ | ⬜ | ⬜ | local-live | ⬜ |
| `runix/pgadmin4@1.62.0` | default | next80 | `tpl;capabilities;stateful-storage` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `sealed-secrets/sealed-secrets@2.18.6` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | top20 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⚠️ | live-parity | ✅ |
|  | sync-secret-rotation | top20 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
| `stakater/reloader@2.2.12` | default | next80 | `tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
|  | controller-default-reviewed | next80 | `tpl;capabilities;cluster-rbac` | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `strimzi/strimzi-kafka-operator@1.0.0` | default | next80 | `tpl;capabilities;crds;cluster-rbac` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `tpl;capabilities;crds;cluster-rbac` | — | — | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `traefik/traefik@40.2.0` | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
|  | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | — | — | ✅ | ✅ | ✅ | ⬜ | ⚠️ | ⚠️ | ⬜ | ⬜ | local-live | ⬜ |
| `velero/velero@12.0.1` | default | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
|  | no-crds | next80 | — | — | — | ✅ | ✅ | ❌ | — | ⬜ | ⬜ | ⬜ | ⬜ | in-confighub | ⬜ |
| `vm/victoria-logs-single@0.12.5` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
| `vm/victoria-metrics-single@0.39.0` | default | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |
|  | default-reviewed | next80 | — | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⬜ | ⬜ | live-parity | ⬜ |

## Regenerate

~~~sh
npm run master-matrix
npm run master-matrix:verify
~~~
