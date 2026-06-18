# Master Catalog Matrix

ONE view of the whole catalog: one row per chart/version/catalog layer,
including upstream sources, real installer bases, candidate paths, and
downstream ConfigHub-derived variants. The translation attributes and per-lane
status are joined from the committed sources below. This file invents no new
truth - every cell comes from a source the verifier checks this view against.

Three renderings of the same rows: this summary (GitHub),
[matrix.csv](matrix.csv) for spreadsheet import (CSV carries words, not
colors), and [matrix.html](matrix.html) - open it in a browser for the
literal red/green/grey colored cells.

## Legend

| Icon | Meaning |
| --- | --- |
| ✅ | yes / pass |
| ⚠️ | watch - passing with a recorded caution |
| ❌ | no / blocked |
| ⬜ | not yet run - absence of evidence, not a failure |
| - | not applicable - this lane does not apply to this row |

Deferred accepted means the cell already has an honest disposition, usually
watch or not applicable. It stays visible, but it is not where live-run time
should be spent until the product scope changes.

Lane columns: **R** render parity (helm template vs installer setup) ·
**C** ConfigHub upload + scan + safe ops · **L** local kind apply ·
**Y** explicit lifecycle observation ·
**G** ConfigHub OCI + Argo live · **P** live Helm-vs-ConfigHub dual parity ·
**K** two-cluster kind parity · **V** server-side ConfigHub variant promotion.
Hooks column: source hook count, disposition route, live-rehearsal status.
**Route** is the generated lifecycle route/off-ramp contract: ✅ all route rows
observed, ⚠️ route/executor named with cautions, ⬜ route work still todo, -
no route row applies.
`unrouted ⚠️` marks a chart whose source scan flags hooks but that has no
hook-disposition row yet; `(from @x.y.z)` marks chart-family evidence taken
from a different chart version's disposition row.

## Current Status

| Metric | Value |
| --- | ---: |
| Chart versions | 110 |
| Matrix rows | 396 |
| F1 source / F2 base / candidate / F4 derived rows | 110 / 199 / 74 / 13 |
| Layer rows | F1:110 / F2a:95 / F2b:104 / F2c:33 / F3:41 / F4a:7 / F4b:6 |
| Lane cells ✅ / ⚠️ / ❌ / ⬜ / - | 967 / 104 / 113 / 110 / 1478 |
| Base/derived rows with the complete core lane set | 132 |
| Rows with a target run decision | 26 |
| Target run decisions (runs / superseded / blocked-or-rejected) | 22 / 2 / 2 |
| Server-side variant promotion (proven / watch / todo / blocked / n/a) | 76 / 121 / 0 / 2 / 197 |
| Lifecycle route contracts (observed / watch / todo / n/a) | 7 / 0 / 3 / 386 |
| Hook-flagged variants with no disposition row (unrouted) | 0 |
| Rows currently in the active proof queue | 77 |
| Cells with deferred accepted disposition | 135 |

Chart versions in the lane matrix but not in top-100 readiness (retained candidates or version drift): `argo-cd/argo-cd@9.5.17`, `bitnami/mongodb@19.0.9`, `bitnami/mongodb@19.1.0`, `bitnami/nginx@24.0.4`, `bitnami/nginx@25.0.0`, `bitnami/postgresql@18.6.10`, `bitnami/postgresql@18.7.0`, `bitnami/redis@27.0.0`, `prometheus-community/kube-prometheus-stack@86.1.0`, `prometheus-community/prometheus@29.9.0`.

## How To Use This Sheet

Each row is one chart/version layer: F1 source chart, F2 base variant, F3
target-prerequisite/fill candidate, or F4 downstream ConfigHub-derived variant.
Use the row to answer three questions before deciding what to do next:

| Question | Column to check |
| --- | --- |
| Can I try this now, promote it, or does it need more design? | Use / adoption bucket |
| What is the strongest evidence currently available? | Evidence, R/C/L/G/P/K, Core |
| What prevents a stronger target-run claim? | Target, Scope, Gap, Next action |
| Where am I in the customization flow? | Layer, Kind |
| Can downstream ConfigHub variants be promoted from this base? | V, Promotion status |
| If a hook or lifecycle behavior exists, where does it go? | Route, Hooks, lifecycle route contract |
| Which non-pass live row should be rerun or reviewed now? | Active proof |
| Is this row active work, an external dependency, or deferred for now? | Action |

The HTML view carries these user/product columns directly:
[matrix.html](matrix.html). The CSV carries the same fields for filtering:
[matrix.csv](matrix.csv). Counts below are matrix rows unless stated
otherwise.

## Current Product Queues

| Queue | Rows | Meaning | Examples |
| --- | ---: | --- | --- |
| F1 source charts | 110 | Upstream Helm chart/version source rows. These are the starting points before any installer base is chosen. | `aqua/trivy-operator@0.32.1/(source)`, `argo-cd/argo-cd@9.5.15/(source)`, `argo-cd/argo-cd@9.5.17/(source)` |
| Public catalog rows | 42 | Reviewed top-20 catalog rows. Use base-readiness or the per-chart catalog page to choose the easiest first base. | `argo-cd/argo-cd@9.5.15/default`, `argo-cd/argo-cd@9.5.15/no-crds`, `bitnami/mongodb@19.0.7/existing-secret-replicaset` |
| Promote after review | 78 | Proof-grade rows that need catalog/product review before becoming public starting points. | `aqua/trivy-operator@0.32.1/default`, `aqua/trivy-operator@0.32.1/no-crds`, `argo-cd/argo-events@2.4.21/default` |
| Design a more useful base | 37 | Rows where plain render proof exists but the first user-facing base is not yet good enough. | `argo-cd/argocd-image-updater@1.2.2/default`, `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1/default`, `bitnami/apache@11.4.29/default` |
| Decide a limitation first | 19 | Rows where a product or operator boundary must be chosen before promotion. | `bitnami/contour@21.1.4/default`, `bitnami/contour@21.1.4/legacy`, `bitnami/contour@21.1.4/no-crds` |
| Complete the core proof lane | 80 | Real base or derived rows missing at least one core evidence lane: ConfigHub proof, live Kubernetes, GitOps/OCI, or live parity. | `argo-cd/argo-cd@9.5.15/no-crds`, `argo-cd/argo-cd@9.5.17/default`, `argo-cd/argo-workflows@1.0.14/default` |
| Active proof queue | 77 | Rows with a current non-pass live parity result and an exact rerun or review action. | `argo-cd/argo-cd@9.5.17/default`, `autoscaler/cluster-autoscaler@9.57.0/controller-default-reviewed`, `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1/default` |
| Deferred accepted dispositions | 13 | Rows whose current non-green cells are already accepted as watch or n/a; do not spend live-run time until scope changes. | `grafana/loki@7.0.0/simple-scalable-minio`, `grafana/loki@7.0.0/single-binary-filesystem`, `hashicorp/consul@2.0.0/default-control-plane` |
| Derived ConfigHub variants | 13 | Downstream ConfigHub variants cloned from reviewed bases. These show environment, region, customer, or target-specific post-render customization without a Helm rerender. | `bitnami/nginx@24.0.2/customer-acme-prod`, `bitnami/nginx@24.0.2/prod-us-east`, `bitnami/redis@25.5.3/prod-us-east` |
| Candidate rows | 74 | Planned F2/F3 paths from committed work-order data. These are visible product paths, not proof claims. | `autoscaler/cluster-autoscaler@9.57.0/default + review`, `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1/default + topology`, `bitnami/memcached@8.5.5/storage-default-reviewed` |
| Custom-discussion candidates | 58 | Non-default or target-specific paths where inputs, ownership, or risk must be discussed before the row becomes runnable. | `autoscaler/cluster-autoscaler@9.57.0/default + review`, `bitnami/memcached@8.5.5/storage-default-reviewed`, `bitnami/phpmyadmin@20.0.0/web-ui-existing-secret` |
| Decide target run scope | 186 | Rows without a target run decision or target-bound receipt yet. | `aqua/trivy-operator@0.32.1/default`, `aqua/trivy-operator@0.32.1/no-crds`, `argo-cd/argo-cd@9.5.15/no-crds` |
| Investigate hard gaps | 124 | Rows with a named chart/product gap rather than a simple missing receipt. | `argo-cd/argo-cd@9.5.15/default`, `argo-cd/argo-cd@9.5.15/no-crds`, `argo-cd/argocd-image-updater@1.2.2/default` |

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
| [production-support-decisions/decisions.csv](../production-support-decisions/decisions.csv) | target run decision and target scope | delivery_path, image/scan/lifecycle/target-fact/live-evidence sub-decisions, evidence_count, remaining_final_requirements, next_action |
| [variant-promotion/status.csv](../variant-promotion/status.csv) | server-side ConfigHub promotion status, matrix value, evidence path, reason, and next action | none; follow the source when you need the full per-row promotion route |
| [live-helm-confighub-compare/summary.csv](../live-helm-confighub-compare/summary.csv) | exact chart/version/base live GitOps/OCI and live Helm-vs-ConfigHub parity result, overriding older aggregate outcome rows when a newer receipt exists | receipt reason and path; follow the source when diagnosing the run itself |
| [live-kind-parity/summary.csv](../live-kind-parity/summary.csv) | exact chart/version/base two-cluster kind parity result, overriding older aggregate outcome rows when a newer receipt exists | semantic parity details, reason, related lifecycle evidence, and receipt path |
| [live-parity-rerun-plan/rerun-plan.csv](../live-parity-rerun-plan/rerun-plan.csv) | active non-pass live parity rows: current result, next step, rerun readiness, reason, support artifact, rerun command | priority and receipt path; follow the source when diagnosing the run itself |
| [coverage-completion-plan/actions.json](../coverage-completion-plan/actions.json) | row-level completion action overlay: active run/fix/stage work, upstream dependency, scope decision, or deferred accepted disposition | full cell-level completion families; follow the coverage completion plan for the exact affected cells and family ranking |
| [../runs/derived-variant-execution](../../runs/derived-variant-execution) | real downstream ConfigHub derived variants: source base, downstream space, clone/link/gate result, environment, region, and no-Helm-rerender proof | full command transcript, unit hash details, corrective update details, and gate counts |
| [derived-variant-target-bound/summary.csv](../derived-variant-target-bound/summary.csv) | target-bound status for derived variants when a downstream variant has been reconciled through OCI/Argo and observed | receipt internals; follow the target-bound receipt when diagnosing the target run |
| [catalog-promotion-wave2/variant-work-orders.yaml](../catalog-promotion-wave2/variant-work-orders.yaml) | candidate F2 base/fork rows that are explicitly not rendered yet and need recipe/package/evidence work before becoming real bases | per-value detail beyond the compact inputs, blockers, and first action shown in the candidate row |
| [useful-base-realization-wave/wave2-selection.csv](../useful-base-realization-wave/wave2-selection.csv) | candidate F2 user-shaped base rows from the useful-base queue, including render-time knobs, target inputs, and required receipts | priority scoring internals; follow the source for full wave ordering |
| [target-prerequisite-actions/actions.csv](../target-prerequisite-actions/actions.csv) | candidate F3 target prerequisite/fill rows, including required facts, action kind, evidence required, and whether a custom discussion is needed | duplicate lane-level rows after they are grouped by chart/base/prerequisite/action |

The CSV and HTML carry adoption bucket, hard gap, strongest evidence, next
action, target run scope, and active proof queue details. The Markdown
table below stays compact for GitHub readability; open [matrix.html](matrix.html)
when you want the user/product view with those columns visible.

## Matrix

| Chart | Layer | Kind | Variant | Tier | Quirks | Hooks | Route | R | C | L | Y | G | P | K | V | Action | Outcome | Target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aqua/trivy-operator@0.32.1` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `argo-cd/argo-cd@9.5.15` | F1 | source | (source) | top20 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ✅ |
|  | F2b | base | no-crds | top20 | - | - | - | ✅ | ✅ | ❌ | - | ✅ | ✅ | ⬜ | ✅ | stage | live-parity | ⬜ |
| `argo-cd/argo-cd@9.5.17` | F1 | source | (source) | - | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | - | - | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ⬜ | ⚠️ | run | local-live | ⬜ |
|  | F2b | base | no-crds | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `argo-cd/argo-events@2.4.21` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `argo-cd/argo-rollouts@2.40.9` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `argo-cd/argo-workflows@1.0.14` | F1 | source | (source) | next80 | - | 1 candidate-route ⬜ | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | 1 candidate-route ⬜ | ⬜ | ✅ | ✅ | ❌ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | stage | live-parity | ⬜ |
|  | F2b | base | controller-default-reviewed | next80 | - | 1 candidate-route ⬜ | ⬜ | ✅ | ✅ | ❌ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | stage | live-parity | ⬜ |
|  | F2b | base | minimal-crds | next80 | - | 1 observed ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `argo-cd/argocd-image-updater@1.2.2` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `autoscaler/cluster-autoscaler@9.57.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ⚠️ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | controller-default-reviewed | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ❌ | ⚠️ | model | live-parity | ⬜ |
|  | F3 | candidate discussion | default + review | candidate | - | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | F1 | source | (source) | next80 | `tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | model | in-confighub | ⬜ |
|  | F3 | candidate | default + topology | candidate | `tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `bitnami/apache@11.4.29` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | legacy | next80 | `lookup;generated-facts;tpl;capabilities` | - | - | ✅ | ✅ | ✅ | - | ⬜ | ⬜ | ⬜ | ✅ | run | local-live | ⬜ |
| `bitnami/contour@21.1.4` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac` | - | - | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | legacy | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac` | - | - | ✅ | ✅ | ❌ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | stage | in-confighub | ⬜ |
|  | F2b | base | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac` | - | - | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
| `bitnami/elasticsearch@22.1.6` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | ha | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | legacy | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ⬜ | ⬜ | ⬜ | ✅ | run | local-live | ⬜ |
| `bitnami/memcached@8.5.5` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | storage-default-reviewed | candidate | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `bitnami/mongodb@19.0.7` | F1 | source | (source) | top20 | `lookup;generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-secret-replicaset | top20 | `lookup;generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ⬜ |
|  | F2b | base | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ✅ |
| `bitnami/mongodb@19.0.9` | F1 | source | (source) | - | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-secret-replicaset | - | - | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ⬜ | ⚠️ | run | local-live | ⬜ |
|  | F2b | base | generated-passwords | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ⬜ | ⚠️ | run | live-parity | ⬜ |
| `bitnami/mongodb@19.1.0` | F1 | source | (source) | - | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-secret-replicaset | - | - | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ✅ | ⚠️ | run | two-cluster-kind-parity | ⬜ |
|  | F2b | base | generated-passwords | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `bitnami/mysql@14.0.3` | F1 | source | (source) | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2b | base | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ✅ |
| `bitnami/nginx@24.0.2` | F1 | source | (source) | top20 | `lookup;generated-facts;tpl;capabilities` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-tls-ingress | top20 | `lookup;generated-facts;tpl;capabilities` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ⬜ |
|  | F2b | base | http-clusterip | top20 | `lookup;generated-facts;tpl;capabilities` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ✅ |
|  | F4b | derived from http-clusterip | customer-acme-prod | derived | `lookup;generated-facts;tpl;capabilities` | - | - | - | ✅ | - | - | ✅ | - | - | - | - | target-bound-derived | ✅ |
|  | F4b | derived from http-clusterip | prod-us-east | derived | `lookup;generated-facts;tpl;capabilities` | - | - | - | ✅ | - | - | ✅ | - | - | - | - | target-bound-derived | ✅ |
| `bitnami/nginx@24.0.4` | F1 | source | (source) | - | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-tls-ingress | - | - | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ⬜ | ⚠️ | run | local-live | ⬜ |
|  | F2b | base | http-clusterip | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ⬜ | ⚠️ | run | live-parity | ⬜ |
| `bitnami/nginx@25.0.0` | F1 | source | (source) | - | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-tls-ingress | - | - | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ✅ | ⚠️ | run | two-cluster-kind-parity | ⬜ |
|  | F2b | base | http-clusterip | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `bitnami/opensearch@2.0.10` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | ha | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | legacy | next80 | - | - | - | ✅ | ✅ | ✅ | - | ⬜ | ⬜ | ⬜ | ✅ | run | local-live | ⬜ |
| `bitnami/phpmyadmin@20.0.0` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | legacy | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ⬜ | ⬜ | ⬜ | ✅ | run | local-live | ⬜ |
|  | F2c | candidate discussion | web-ui-existing-secret | candidate | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `bitnami/postgresql@18.6.7` | F1 | source | (source) | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ⬜ |
|  | F2b | base | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ✅ |
| `bitnami/postgresql@18.6.10` | F1 | source | (source) | - | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-secret | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ⬜ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | generated-passwords | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ⬜ | ⚠️ | run | live-parity | ⬜ |
| `bitnami/postgresql@18.7.0` | F1 | source | (source) | - | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-secret | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | generated-passwords | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `bitnami/rabbitmq@16.0.14` | F1 | source | (source) | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2b | base | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ✅ |
| `bitnami/redis@25.5.3` | F1 | source | (source) | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ✅ |
|  | F2b | base | reuse-existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ⬜ |
|  | F4a | derived from default | prod-us-east | derived | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | ✅ | - | - | ⬜ | - | - | - | run | derived-intended-state | ⬜ |
|  | F4b | derived from default | staging-eu-west | derived | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | ✅ | - | - | ❌ | - | - | - | stage | derived-intended-state | ❌ |
| `bitnami/redis@27.0.0` | F1 | source | (source) | - | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | reuse-existing-secret | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `bitnami/spark@10.0.3` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | ha | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | legacy | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ⬜ | ⬜ | ⬜ | ✅ | run | local-live | ⬜ |
| `bitnami/zookeeper@13.8.7` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | ha | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | legacy | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ⬜ | ⬜ | ⬜ | ✅ | run | local-live | ⬜ |
| `cloudnative-pg/cloudnative-pg@0.28.2` | F1 | source | (source) | next80 | `generated-facts;tpl;crds;cluster-rbac;webhooks` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `generated-facts;tpl;crds;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `generated-facts;tpl;crds;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ❌ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | stage | live-parity | ⬜ |
| `coredns/coredns@1.45.2` | F1 | source | (source) | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | controller-default-reviewed | candidate | `generated-facts;tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `crossplane-stable/crossplane@2.3.1` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `descheduler/descheduler@0.36.0` | F1 | source | (source) | next80 | `tpl;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | cluster-metrics-readonly | candidate | `tpl;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `dex/dex@0.24.0` | F1 | source | (source) | next80 | `tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F2c | candidate discussion | web-ui-existing-secret | candidate | `tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F3 | candidate discussion | default + review | candidate | `tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `elastic/eck-operator@3.4.0` | F1 | source | (source) | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | ha | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `elastic/filebeat@8.5.1` | F1 | source | (source) | next80 | `tpl;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;cluster-rbac` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F2b | base | node-or-cluster-collector | next80 | `tpl;cluster-rbac` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F3 | candidate discussion | default + review | candidate | `tpl;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate | default + secret | candidate | `tpl;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
|  | F3 | candidate discussion | node-or-cluster-collector + external-api | candidate | `tpl;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate discussion | node-or-cluster-collector + review | candidate | `tpl;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `elastic/kibana@8.5.1` | F1 | source | (source) | next80 | `tpl` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F2c | candidate discussion | web-ui-existing-secret | candidate | `tpl` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F3 | candidate discussion | default + external-api | candidate | `tpl` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate discussion | default + review | candidate | `tpl` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `elastic/logstash@8.5.1` | F1 | source | (source) | next80 | `tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | ha | next80 | `tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ✅ | ✅ | ✅ | ⚠️ | stage | live-parity | ⬜ |
| `elastic/metricbeat@8.5.1` | F1 | source | (source) | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F3 | candidate discussion | default + review | candidate | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate | default + secret | candidate | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `external-dns/external-dns@1.21.1` | F1 | source | (source) | next80 | `tpl;crds;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;crds;cluster-rbac` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | dry-run-txt-registry | next80 | `tpl;crds;cluster-rbac` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `tpl;crds;cluster-rbac` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | cloudflare-existing-secret | candidate | `tpl;crds;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F2c | candidate discussion | route53-irsa | candidate | `tpl;crds;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `external-secrets/external-secrets@2.5.0` | F1 | source | (source) | top20 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | - | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | live-parity | ✅ |
|  | F2b | base | no-crds | top20 | - | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `fairwinds-stable/goldilocks@10.3.0` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | cluster-metrics-readonly | candidate | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `fairwinds-stable/vpa@4.11.0` | F1 | source | (source) | next80 | `lookup;tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `lookup;tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | run | live-parity | ⬜ |
|  | F3 | candidate discussion | default + review | candidate | `lookup;tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate | no-crds + crd | candidate | `lookup;tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `falcosecurity/falco@9.0.0` | F1 | source | (source) | next80 | `lookup;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | node-or-cluster-collector | candidate | `lookup;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `falcosecurity/falcosidekick@0.13.1` | F1 | source | (source) | next80 | `capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `fluent/fluent-bit@0.57.6` | F1 | source | (source) | next80 | `tpl;capabilities;hooks;cluster-rbac` | 1 observed ✅ | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;hooks;cluster-rbac` | 1 observed ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | node-or-cluster-collector | candidate | `tpl;capabilities;hooks;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `fluent/fluentd@0.5.3` | F1 | source | (source) | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ✅ | ⚠️ | run | two-cluster-kind-parity | ⬜ |
|  | F2c | candidate discussion | node-or-cluster-collector | candidate | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F3 | candidate discussion | default + review | candidate | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `gatekeeper/gatekeeper@3.22.2` | F1 | source | (source) | next80 | `capabilities;hooks;crds;cluster-rbac;webhooks` | 4 observed ✅ | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `capabilities;hooks;crds;cluster-rbac;webhooks` | 4 observed ✅ | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `capabilities;hooks;crds;cluster-rbac;webhooks` | 4 observed ✅ | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `gitlab/gitlab-runner@0.89.0` | F1 | source | (source) | next80 | `generated-facts;tpl;capabilities` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `generated-facts;tpl;capabilities` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ⚠️ | ⚠️ | stage | in-confighub | ⬜ |
|  | F2c | candidate discussion | runner-existing-secret | candidate | `generated-facts;tpl;capabilities` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F3 | candidate discussion | default + external-api | candidate | `generated-facts;tpl;capabilities` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate discussion | default + review | candidate | `generated-facts;tpl;capabilities` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `grafana/alloy@1.8.2` | F1 | source | (source) | next80 | `tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ❌ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ❌ | run | live-parity | ⬜ |
| `grafana/grafana@10.5.15` | F1 | source | (source) | top20 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | existing-secret-ingress | top20 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2b | base | generated-passwords | top20 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | superseded |
|  | F4a | derived from generated-passwords | customer-acme-prod | derived | - | - | - | - | ✅ | - | - | ⬜ | - | - | - | run | derived-intended-state | ⬜ |
|  | F4a | derived from generated-passwords | prod-us-east | derived | - | - | - | - | ✅ | - | - | ⬜ | - | - | - | run | derived-intended-state | ⬜ |
| `grafana/loki@7.0.0` | F1 | source | (source) | top20 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | simple-scalable-minio | top20 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ⬜ |
|  | F2b | base | single-binary-filesystem | top20 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ✅ |
| `grafana/promtail@6.17.1` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `grafana/pyroscope@2.0.2` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ⚠️ | ⚠️ | ✅ | ⚠️ | run | two-cluster-kind-parity | ⬜ |
|  | F2b | base | ha | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ❌ | ⚠️ | model | in-confighub | ⬜ |
|  | F2b | base | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ⚠️ | ⚠️ | ✅ | ⚠️ | run | two-cluster-kind-parity | ⬜ |
|  | F3 | candidate discussion | default + review | candidate | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate discussion | ha + review | candidate | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate discussion | no-crds + review | candidate | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `grafana/rollout-operator@0.49.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ❌ | - | ✅ | ✅ | ⚠️ | ⚠️ | stage | live-parity | ⬜ |
|  | F3 | candidate discussion | no-crds + review | candidate | - | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `grafana/tempo@1.24.4` | F1 | source | (source) | top20 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | local-persistent | top20 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | superseded |
|  | F2b | base | s3-query-observability | top20 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ✅ | ✅ | stage | two-cluster-kind-parity | ⬜ |
| `haproxytech/kubernetes-ingress@1.52.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `hashicorp/consul@2.0.0` | F1 | source | (source) | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2b | base | default-control-plane | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ✅ |
|  | F2b | base | secure-mesh-existing-secrets | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ✅ | ✅ | stage | two-cluster-kind-parity | ⬜ |
| `hashicorp/terraform@1.1.2` | F1 | source | (source) | next80 | `crds` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `crds` | - | - | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ❌ | ⚠️ | model | in-confighub | ⬜ |
|  | F2b | base | no-crds | next80 | `crds` | - | - | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F3 | candidate discussion | default + review | candidate | `crds` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate discussion | no-crds + review | candidate | `crds` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate | no-crds + secret | candidate | `crds` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `hashicorp/vault@0.32.0` | F1 | source | (source) | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ⬜ |
|  | F2b | base | dev-mode | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ❌ |
|  | F2b | base | ha-raft-ui | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ❌ | ⬜ | ⚠️ | ⚠️ | ✅ | ✅ | stage | two-cluster-kind-parity | ⬜ |
|  | F3 | candidate discussion | ha-raft-ui + review | candidate | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F4a | derived from default | regulated-prod-us-east | derived | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | - | ✅ | - | - | ⬜ | - | - | - | run | derived-intended-state | ⬜ |
|  | F4a | derived from default | staging-us-east | derived | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | - | - | - | ✅ | - | - | ⬜ | - | - | - | run | derived-intended-state | ⬜ |
| `ingress-nginx/ingress-nginx@4.15.1` | F1 | source | (source) | top20 | `tpl;capabilities;cluster-rbac;webhooks` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | `tpl;capabilities;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2b | base | admission-disabled | top20 | `tpl;capabilities;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ⬜ |
|  | F2b | base | internal-clusterip | top20 | `tpl;capabilities;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ✅ |
| `istio/gateway@1.30.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
|  | F2b | base | controller-default-reviewed | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | image | in-confighub | ⬜ |
| `istio/istiod@1.30.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ❌ | - | ❌ | ❌ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F2c | candidate discussion | external-ca | candidate | - | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F2c | candidate | minimal-profile | candidate | - | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F2c | candidate discussion | revisioned-control-plane | candidate | - | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F3 | candidate | default + namespace | candidate | - | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `jaegertracing/jaeger@4.8.0` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | node-or-cluster-collector | candidate | `lookup;generated-facts;tpl;capabilities` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `jaegertracing/jaeger-operator@2.57.0` | F1 | source | (source) | next80 | `crds;webhooks` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `crds;webhooks` | - | - | ✅ | ✅ | ✅ | ⬜ | ❌ | ❌ | ❌ | ⚠️ | stage | local-live | ⬜ |
|  | F2b | base | no-crds | next80 | `crds;webhooks` | - | - | ✅ | ✅ | ❌ | ⬜ | ❌ | ❌ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F3 | candidate discussion | default + crd | candidate | `crds;webhooks` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate discussion | no-crds + crd | candidate | `crds;webhooks` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `jetstack/cert-manager@v1.20.2` | F1 | source | (source) | top20 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | - | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2b | base | crds-enabled | top20 | - | - | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | live-parity | ✅ |
| `jetstack/cert-manager-csi-driver@v0.14.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `jetstack/trust-manager@v0.22.1` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ✅ | ⚠️ | stage | two-cluster-kind-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ✅ | ⚠️ | stage | two-cluster-kind-parity | ⬜ |
| `kedacore/keda@2.19.0` | F1 | source | (source) | next80 | `tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⚠️ | ⚠️ | run | live-parity | ⬜ |
|  | F3 | candidate | no-crds + secret | candidate | `tpl;capabilities;crds;cluster-rbac;webhooks` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `kyverno/kyverno@3.8.1` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | 8 observed ✅ | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | 8 observed ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | 8 observed ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | default-admission | candidate | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F2c | candidate discussion | external-crds | candidate | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F2c | candidate discussion | ha-admission-reports | candidate | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `kyverno/kyverno-policies@3.8.0` | F1 | source | (source) | next80 | `lookup;tpl` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;tpl` | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ⚠️ | ⚠️ | run | local-live | ⬜ |
| `linkerd/linkerd-crds@1.8.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ✅ | ⚠️ | run | two-cluster-kind-parity | ⬜ |
| `longhorn/longhorn@1.11.2` | F1 | source | (source) | top20 | `generated-facts;tpl;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | `generated-facts;tpl;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ✅ |
|  | F2b | base | ui-ingress | top20 | `generated-facts;tpl;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `metrics-server/metrics-server@3.13.0` | F1 | source | (source) | top20 | `lookup;generated-facts;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | `lookup;generated-facts;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ✅ |
|  | F2b | base | external-tls-ca | top20 | `lookup;generated-facts;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F4b | derived from default | prod-us-east | derived | `lookup;generated-facts;capabilities;cluster-rbac` | - | - | - | ✅ | - | - | ✅ | - | - | - | - | target-bound-derived | ✅ |
| `minio-operator/operator@7.1.1` | F1 | source | (source) | next80 | `cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `cluster-rbac` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | storage-default-reviewed | candidate | `cluster-rbac` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `minio-operator/tenant@7.1.1` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ✅ | ⚠️ | run | two-cluster-kind-parity | ⬜ |
| `nats/nack@0.34.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ❌ | ⚠️ | model | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `nats/nats@2.14.0` | F1 | source | (source) | next80 | `tpl` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | ha | next80 | `tpl` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ❌ | ⚠️ | model | live-parity | ⬜ |
| `nats/surveyor@0.20.9` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F2b | base | default-reviewed | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F3 | candidate discussion | default + review | candidate | - | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate discussion | default-reviewed + external-api | candidate | - | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
|  | F3 | candidate discussion | default-reviewed + review | candidate | - | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | F1 | source | (source) | next80 | `capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ❌ | ❌ | ❌ | ⚠️ | model | in-confighub | ⬜ |
|  | F2c | candidate discussion | storage-default-reviewed | candidate | `capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F3 | candidate discussion | default + review | candidate | `capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `open-telemetry/opentelemetry-operator@0.114.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ✅ | ⚠️ | stage | two-cluster-kind-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ✅ | ⚠️ | stage | two-cluster-kind-parity | ⬜ |
| `opencost/opencost@2.5.21` | F1 | source | (source) | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ❌ | - | ⚠️ | ⚠️ | ❌ | ⚠️ | stage | in-confighub | ⬜ |
|  | F2c | candidate discussion | cluster-metrics-readonly | candidate | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F3 | candidate discussion | default + review | candidate | `tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `percona/pg-operator@3.0.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⚠️ | ⚠️ | run | live-parity | ⬜ |
|  | F3 | candidate | no-crds + crd | candidate | - | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `percona/psmdb-operator@1.22.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `percona/pxc-operator@1.19.1` | F1 | source | (source) | next80 | `lookup;crds;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;crds;cluster-rbac` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `lookup;crds;cluster-rbac` | - | - | ✅ | ✅ | ❌ | ⬜ | ✅ | ✅ | ⚠️ | ⚠️ | stage | live-parity | ⬜ |
|  | F3 | candidate discussion | no-crds + external-api | candidate | `lookup;crds;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | scope | candidate-plan | - |
| `projectcalico/tigera-operator@v3.32.0` | F1 | source | (source) | next80 | `lookup;hooks;cluster-rbac` | 1 observed ✅ | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;hooks;cluster-rbac` | 1 observed ✅ | - | ✅ | ✅ | ❌ | ⬜ | ❌ | ❌ | ❌ | ⚠️ | model | in-confighub | ⬜ |
|  | F2c | candidate discussion | controller-default-reviewed | candidate | `lookup;hooks;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F3 | candidate | default + crd | candidate | `lookup;hooks;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `prometheus-community/alertmanager@1.37.0` | F1 | source | (source) | next80 | `tpl;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | ha | next80 | `tpl;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `prometheus-community/kube-prometheus-stack@85.3.3` | F1 | source | (source) | top20 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;webhooks;stateful-storage` | 2 observed ✅ | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;webhooks;stateful-storage` | 2 observed ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ✅ |
|  | F2b | base | no-crds | top20 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;webhooks;stateful-storage` | 2 observed ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ⬜ |
| `prometheus-community/kube-prometheus-stack@86.1.0` | F1 | source | (source) | - | - | 2 observed ✅ (from @85.3.0) | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | - | - | 2 observed ✅ (from @85.3.0) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | model | live-parity | ⬜ |
|  | F2b | base | no-crds | - | - | 2 observed ✅ (from @85.3.0) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `prometheus-community/kube-state-metrics@7.4.0` | F1 | source | (source) | next80 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2b | base | cluster-metrics-readonly | next80 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `prometheus-community/prometheus@29.8.0` | F1 | source | (source) | top20 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ⬜ |
|  | F2b | base | server-only-ephemeral | top20 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ⬜ | ✅ | run | live-parity | ✅ |
|  | F4a | derived from default | prod-us-east | derived | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | ✅ | - | - | ⬜ | - | - | - | run | derived-intended-state | ⬜ |
|  | F4a | derived from default | staging-eu-west | derived | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | ✅ | - | - | ⬜ | - | - | - | run | derived-intended-state | ⬜ |
|  | F4b | derived from server-only-ephemeral | prod-us-east | derived | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | ✅ | - | - | ✅ | - | - | - | - | target-bound-derived | ✅ |
|  | F4b | derived from server-only-ephemeral | staging-eu-west | derived | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | - | - | - | ✅ | - | - | ✅ | - | - | - | - | target-bound-derived | ✅ |
| `prometheus-community/prometheus@29.9.0` | F1 | source | (source) | - | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | - | - | - | - | ✅ | ✅ | ✅ | - | ⚠️ | ⚠️ | ✅ | ✅ | deferred | two-cluster-kind-parity | ⬜ |
|  | F2b | base | server-only-ephemeral | - | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `prometheus-community/prometheus-adapter@5.3.0` | F1 | source | (source) | next80 | `tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ❌ | ⬜ | ❌ | ❌ | ❌ | ✅ | model | in-confighub | ⬜ |
|  | F2b | base | apiservice-v1-capability | next80 | `tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ⬜ |
|  | F2b | base | cluster-metrics-readonly | next80 | `tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ❌ | ⬜ | ❌ | ❌ | ❌ | ✅ | model | in-confighub | ⬜ |
|  | F3 | candidate | cluster-metrics-readonly + crd | candidate | `tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
|  | F3 | candidate | default + crd | candidate | `tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | F1 | source | (source) | next80 | `tpl;capabilities` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | cluster-metrics-readonly | next80 | `tpl;capabilities` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `prometheus-community/prometheus-node-exporter@4.55.0` | F1 | source | (source) | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2b | base | cluster-metrics-readonly | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
| `prometheus-community/prometheus-operator-crds@29.0.0` | F1 | source | (source) | next80 | `generated-facts;crds` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `generated-facts;crds` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ⬜ |
|  | F2c | candidate discussion | cluster-metrics-readonly | candidate | `generated-facts;crds` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `prometheus-community/prometheus-pushgateway@3.6.0` | F1 | source | (source) | next80 | `tpl;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ⚠️ | run | live-parity | ⬜ |
|  | F2c | candidate discussion | cluster-metrics-readonly | candidate | `tpl;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `rook-release/rook-ceph@v1.19.5` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ⬜ |
| `rook-release/rook-ceph-cluster@v1.19.5` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ❌ | ❌ | ❌ | ✅ | stage | local-live | ⬜ |
|  | F3 | candidate | default + namespace | candidate | - | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `runix/pgadmin4@1.62.0` | F1 | source | (source) | next80 | `tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;stateful-storage` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2c | candidate discussion | web-ui-existing-secret | candidate | `tpl;capabilities;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `sealed-secrets/sealed-secrets@2.18.6` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | F1 | source | (source) | top20 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | top20 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ✅ |
|  | F2b | base | sync-secret-rotation | top20 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `stakater/reloader@2.2.12` | F1 | source | (source) | next80 | `tpl;capabilities;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2b | base | controller-default-reviewed | next80 | `tpl;capabilities;cluster-rbac` | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `strimzi/strimzi-kafka-operator@1.0.0` | F1 | source | (source) | next80 | `tpl;capabilities;crds;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `tpl;capabilities;crds;cluster-rbac` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ | ✅ | deferred | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `tpl;capabilities;crds;cluster-rbac` | - | - | ✅ | ✅ | ❌ | ⬜ | ✅ | ✅ | ⚠️ | ✅ | stage | live-parity | ⬜ |
|  | F3 | candidate | no-crds + namespace | candidate | `tpl;capabilities;crds;cluster-rbac` | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `traefik/traefik@40.2.0` | F1 | source | (source) | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ | ❌ | ✅ | model | live-parity | ⬜ |
|  | F2b | base | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | - | - | ✅ | ✅ | ✅ | ⬜ | ⚠️ | ⚠️ | ✅ | ✅ | deferred | two-cluster-kind-parity | ⬜ |
|  | F2c | candidate discussion | cloud-loadbalancer | candidate | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F2c | candidate discussion | external-crds | candidate | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F2c | candidate | internal-clusterip-dashboard-off | candidate | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
| `velero/velero@12.0.1` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ❌ | - | ❌ | ❌ | ❌ | ✅ | model | in-confighub | ⬜ |
|  | F2b | base | no-crds | next80 | - | - | - | ✅ | ✅ | ❌ | - | ❌ | ❌ | ❌ | ✅ | model | in-confighub | ⬜ |
|  | F2c | candidate discussion | aws-s3-existing-secret | candidate | - | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F2c | candidate discussion | azure-blob-existing-secret | candidate | - | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F2c | candidate discussion | filesystem-backup-node-agent | candidate | - | - | - | - | - | - | - | - | - | - | - | model | candidate-plan | - |
|  | F3 | candidate | no-crds + crd | candidate | - | - | - | - | - | - | - | - | - | - | - | stage | candidate-plan | - |
| `vm/victoria-logs-single@0.12.5` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
| `vm/victoria-metrics-single@0.39.0` | F1 | source | (source) | next80 | - | - | - | - | - | - | - | - | - | - | - | - | source-lock | - |
|  | F2a | base | default | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |
|  | F2b | base | default-reviewed | next80 | - | - | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ | - | live-parity | ⬜ |

## Regenerate

~~~sh
npm run master-matrix
npm run master-matrix:verify
~~~
