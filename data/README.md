# Data Index

This directory contains generated evidence, CSVs, and summary pages for the
Helm experiment. The data is meant to answer three questions without requiring
readers to inspect every recipe folder:

~~~text
What outcomes are promised?
Which tests prove those outcomes?
What is the current status for each chart, base, derived variant, and feature?
~~~

## Quick Routes

Do not start by opening every CSV. Pick the question first, then use the
smallest generated surface that answers it.

| Question | Start with |
| --- | --- |
| I want the current headline status. | [status-dashboard/summary.md](./status-dashboard/summary.md) |
| I want the next work queues. | [status-dashboard/next-work-queues.csv](./status-dashboard/next-work-queues.csv)<br>[status-dashboard/active-proof-queue.csv](./status-dashboard/active-proof-queue.csv) |
| I want to know which catalog base to try first. | [top20-base-readiness/start-here.md](./top20-base-readiness/start-here.md) |
| I want to know whether any top-20 chart/base is easy, partial, blocked, or watch. | [top20-base-readiness/summary.md](./top20-base-readiness/summary.md) |
| I want one spreadsheet row per chart/base proof lane. | [outcome-coverage/base-outcomes.csv](./outcome-coverage/base-outcomes.csv) |
| I want to check whether a public claim is backed, partial, planned, or refused. | [claims-register/summary.md](./claims-register/summary.md)<br>[claims-register/claims.csv](./claims-register/claims.csv) |
| I want to know whether value-change blast radius is measured or still assumed. | [blast-radius-accuracy/summary.md](./blast-radius-accuracy/summary.md)<br>[blast-radius-accuracy/cases.csv](./blast-radius-accuracy/cases.csv) |
| I want the top-100 coverage contract. | [top100-coverage/summary.md](./top100-coverage/summary.md)<br>[top100-coverage/coverage.csv](./top100-coverage/coverage.csv) |
| I want the strict top-100 work queue. | [top100-coverage/work-queue.md](./top100-coverage/work-queue.md)<br>[top100-coverage/work-queue.csv](./top100-coverage/work-queue.csv)<br>[top100-coverage/decisions-needed.md](./top100-coverage/decisions-needed.md) |
| I want the first strict top-100 promotion wave. | [top100-promotion-wave/summary.md](./top100-promotion-wave/summary.md)<br>[top100-promotion-wave/wave.csv](./top100-promotion-wave/wave.csv) |
| I want to know how upstream chart updates are handled. | [refresh-survival/summary.md](./refresh-survival/summary.md)<br>[latest-top20-refresh/action-queue/summary.md](./latest-top20-refresh/action-queue/summary.md)<br>[latest-top20-refresh/replacement-decisions/summary.md](./latest-top20-refresh/replacement-decisions/summary.md) |
| I want the top-100 or top-500 planning picture. | [top100-readiness/summary.md](./top100-readiness/summary.md)<br>[top100-readiness/next80-queues.md](./top100-readiness/next80-queues.md)<br>[top500-catalog-analysis/review.csv](./top500-catalog-analysis/review.csv) |
| I want live parity status. | [live-kind-parity/summary.md](./live-kind-parity/summary.md)<br>[live-helm-confighub-compare/summary.md](./live-helm-confighub-compare/summary.md) |
| I want hook, CRD, webhook, or lifecycle status. | [lifecycle-boundary/summary.md](./lifecycle-boundary/summary.md)<br>[outcome-coverage/feature-outcomes.csv](./outcome-coverage/feature-outcomes.csv) |
| I want extension-slot or custom-config risk. | [extension-slots/summary.md](./extension-slots/summary.md)<br>[nginx-config-checks/summary.md](./nginx-config-checks/summary.md) |
| I want production support status and next actions. | [status-dashboard/next-work-queues.csv](./status-dashboard/next-work-queues.csv)<br>[production-support-decisions/summary.md](./production-support-decisions/summary.md)<br>[production-support-decisions/work-items.csv](./production-support-decisions/work-items.csv)<br>[production-support-decisions/decisions.csv](./production-support-decisions/decisions.csv) |
| I want accepted pre-review production dispositions. | [production-disposition/summary.md](./production-disposition/summary.md)<br>[production-disposition/support-decision-contract.md](./production-disposition/support-decision-contract.md)<br>[production-disposition/support-decision-queue.csv](./production-disposition/support-decision-queue.csv) |

## Start Here

| File | Use it for |
| --- | --- |
| [status-dashboard/summary.md](./status-dashboard/summary.md) | Start here for a one-page status dashboard: top100, top500 evidence, proof lanes, hooks, quirks, GitOps, and live parity. |
| [status-dashboard/next-work-queues.csv](./status-dashboard/next-work-queues.csv) | Machine-readable next work queues for top100 catalog work, top20 production support, live parity, and hook/lifecycle work. |
| [status-dashboard/active-proof-queue.csv](./status-dashboard/active-proof-queue.csv) | Current non-pass live parity rows with the exact support artifact that should be handled before rerun. |
| [status-dashboard/top20-status.csv](./status-dashboard/top20-status.csv) | Compact chart-by-chart status for the top-20 public catalog: recommended base, setup command, base-readiness mix, evidence strength, proof lanes, feature summary, gaps, next action. |
| [top20-base-readiness/start-here.md](./top20-base-readiness/start-here.md) | Short guide to the clean first catalog paths: chart, base, command, and production-support reminder. |
| [top20-base-readiness/summary.md](./top20-base-readiness/summary.md) | One row per top-20 base variant: which bases are good first paths and which need prerequisites, runtime review, or hook lifecycle work. |
| [outcome-coverage/summary.md](./outcome-coverage/summary.md) | Start here. Outcome promises, tests that prove them, and links to the four front-door CSVs. |
| [outcome-coverage/chart-outcomes.csv](./outcome-coverage/chart-outcomes.csv) | One row per chart: model support, production readiness, lane counts, hard gaps, feature summary. |
| [outcome-coverage/base-outcomes.csv](./outcome-coverage/base-outcomes.csv) | One row per chart/base variant: render parity, ConfigHub proof, local live, GitOps/OCI live, live Helm parity. |
| [outcome-coverage/derived-variant-outcomes.csv](./outcome-coverage/derived-variant-outcomes.csv) | One row per derived ConfigHub variant: intended-state proof and target-bound live status. |
| [outcome-coverage/feature-outcomes.csv](./outcome-coverage/feature-outcomes.csv) | One row per chart feature: hooks, generated secrets, CRDs, webhooks, required values, schemas, extension slots, gaps. |
| [claims-register/summary.md](./claims-register/summary.md) | Claim-to-evidence register: public claims, status, evidence paths, scoped verifiers, and limits. |
| [claims-register/claims.csv](./claims-register/claims.csv) | Spreadsheet form of the claim-to-evidence register. |
| [blast-radius-accuracy/summary.md](./blast-radius-accuracy/summary.md) | Measured blast-radius accuracy seed: predicted affected objects compared with actual committed rerender diffs. |
| [blast-radius-accuracy/cases.csv](./blast-radius-accuracy/cases.csv) | Spreadsheet form of measured and unmeasured value-source-map blast-radius rows. |
| [extension-slots/extension-slots.csv](./extension-slots/extension-slots.csv) | One row per chart with NGINX-like extension slots: scope, built variants, surfaces, route, evidence. |
| [nginx-config-checks/checks.csv](./nginx-config-checks/checks.csv) | NGINX supported-base checks for empty config extension slots, sidecars, metrics, raw objects, and ingress shape. |
| [lifecycle-boundary/summary.md](./lifecycle-boundary/summary.md) | Hook and hook-like lifecycle boundary: hook queue rows, lifecycle observations, evidence, and current limits. |
| [lifecycle-observations/cert-manager-eso/summary.md](./lifecycle-observations/cert-manager-eso/summary.md) | Concrete lifecycle observations for cert-manager and External Secrets: CRD policy, post-apply API readiness, webhook CA injection, and controller-populated Secret data. |
| [live-kind-parity/summary.md](./live-kind-parity/summary.md) | Two-cluster live parity: regular Helm in one vanilla kind cluster and cub installer output in another. |
| [live-helm-confighub-compare/summary.md](./live-helm-confighub-compare/summary.md) | Selected live Helm-vs-ConfigHub parity: regular Helm compared with ConfigHub delivery for selected top-20 rows. |
| [live-parity-rerun-plan/summary.md](./live-parity-rerun-plan/summary.md) | Rerun queue for non-pass live parity rows: next action, current diagnosis, and exact rerun command. |
| [production-disposition/summary.md](./production-disposition/summary.md) | Production support boundary for top-20 catalog charts: accepted dispositions, open blockers, and next actions. |
| [production-disposition/dispositions.md](./production-disposition/dispositions.md) | Detailed production disposition plan: accepted receipts, open dispositions, owners, required evidence, and unblock rules. |
| [production-disposition/next-actions.csv](./production-disposition/next-actions.csv) | Production decision work queue: recommended base, decision focus, image digest gap, and next action per top-20 chart. |
| [production-disposition/support-decision-contract.md](./production-disposition/support-decision-contract.md) | Production support decision contract: required fields, current decision states, and the rule for moving from production-review-ready to production-supported. |
| [production-disposition/support-decision-queue.csv](./production-disposition/support-decision-queue.csv) | Pre-review queue showing the candidate production base, support boundary work, and required evidence before target-scoped decisions. |
| [production-support-decisions/summary.md](./production-support-decisions/summary.md) | Target-scoped support decision artifacts: supported, rejected, and superseded decisions, boundaries, evidence state, and next action. |
| [production-support-decisions/work-items.csv](./production-support-decisions/work-items.csv) | One row per production-support task or keep-fresh item: chart, base, work type, status field, priority, action, and source decision. |
| [production-support-decisions/decisions.csv](./production-support-decisions/decisions.csv) | One row per target-scoped support decision artifact: chart, base, decision state, target scope, evidence decision, and next action. |
| [external-scan-lane/chart-workdown.csv](./external-scan-lane/chart-workdown.csv) | Chart-level scan/gate workdown: grouped scanner findings, priority, and next action before production disposition. |
| [scan-disposition-workdown/workdown.csv](./scan-disposition-workdown/workdown.csv) | Scan warning routes: which rows need fixes, hardened bases, explicit security acceptance, runtime endpoint review, or PDB policy decisions. |
| [image-digest-workdown/summary.md](./image-digest-workdown/summary.md) | Image digest workdown: rendered image references that need digest resolution, image overrides, or explicit proof receipts before reproducible production OCI support. |
| [pain-point-coverage/summary.md](./pain-point-coverage/summary.md) | General Helm pain point coverage: current answers, handoffs, evidence, gaps, and next actions. |
| [top100-readiness/summary.md](./top100-readiness/summary.md) | Top-100 readiness: one chart-by-chart answer for workability, adoption bucket, strongest evidence, hard gap, next action, and first work queues. |
| [top100-readiness/next80-queues.md](./top100-readiness/next80-queues.md) | Next80 operating queue: proof-grade non-catalog charts split into promotion review, limitation review, and user-shaped variant work. |
| [top100-coverage/summary.md](./top100-coverage/summary.md) | Top-100 coverage contract result: covered versus partial rows and item-by-item pass/todo breakdown. |
| [top100-coverage/coverage.csv](./top100-coverage/coverage.csv) | One row per top-100 chart: strict coverage contract status, item statuses, evidence paths, and next action. |
| [top100-coverage/work-queue.md](./top100-coverage/work-queue.md) | Top-100 strict coverage work queue: promotion review, user-shaped variants, limitation decisions, and first rows. |
| [top100-coverage/work-queue.csv](./top100-coverage/work-queue.csv) | One row per partial top-100 chart: queue, priority, missing items, first step, done-when rule, evidence, and owner. |
| [top100-coverage/decisions-needed.md](./top100-coverage/decisions-needed.md) | Human decision memos for top-100 limitation-decision rows. |
| [top100-promotion-wave/summary.md](./top100-promotion-wave/summary.md) | First strict top-100 promotion-review wave: proof-grade charts with two-cluster parity that need production disposition and support decisions. |
| [top100-promotion-wave/wave.csv](./top100-promotion-wave/wave.csv) | One row per selected top-100 promotion wave chart: variants, evidence, scan/gate status, first step, and done-when rule. |
| [top100-promotion-wave/wave.yaml](./top100-promotion-wave/wave.yaml) | Machine-readable strict top-100 promotion wave input. |
| [refresh-survival/summary.md](./refresh-survival/summary.md) | Latest-version refresh survival: current supported chart versions, upstream update candidates, and promotion gates before replacement. |
| [refresh-survival/refreshes.csv](./refresh-survival/refreshes.csv) | One row per top-20 chart in the latest refresh review: current version, latest version, candidate proof, promotion state, and next action. |
| [latest-top20-refresh/action-queue/summary.md](./latest-top20-refresh/action-queue/summary.md) | Action queue for current top-20 upstream movement: replacement decisions, retained-candidate refreshes, and new-candidate creation. |
| [latest-top20-refresh/action-queue/queue.csv](./latest-top20-refresh/action-queue/queue.csv) | Spreadsheet action queue for latest-refresh work: current version, latest upstream version, retained candidate, priority, command, evidence, and done-when rule. |
| [latest-top20-refresh/action-queue/queue.yaml](./latest-top20-refresh/action-queue/queue.yaml) | Machine-readable latest-refresh action queue. |
| [latest-top20-refresh/promotion-work-orders.md](./latest-top20-refresh/promotion-work-orders.md) | Per-candidate lane closure table for retained proof-complete update candidates. |
| [latest-top20-refresh/promotion-work-orders.csv](./latest-top20-refresh/promotion-work-orders.csv) | Spreadsheet work orders for retained candidates: render proof, ConfigHub proof, local live, live parity, production disposition, catalog/site, and top100/top500 refresh. |
| [latest-top20-refresh/replacement-decisions/summary.md](./latest-top20-refresh/replacement-decisions/summary.md) | Final review queue for retained proof-complete update candidates before any supported catalog version is replaced. |
| [latest-top20-refresh/replacement-decisions/decisions.csv](./latest-top20-refresh/replacement-decisions/decisions.csv) | Spreadsheet replacement-decision queue: current supported version, retained candidate version, latest upstream version, freshness, proof status, evidence, and next action. |
| [latest-top20-refresh/replacement-decisions/decisions.yaml](./latest-top20-refresh/replacement-decisions/decisions.yaml) | Machine-readable replacement-decision queue for the retained proof-complete update candidates. |
| [next-ten-waves/summary.md](./next-ten-waves/summary.md) | Compact next work queues: gap review, latest-version promotion, variant build, production disposition, and import prototypes. |
| [attack-plan-workdown/summary.md](./attack-plan-workdown/summary.md) | Broader execution workdown: import examples, hard gaps, variants, production, runtime/GitOps, latest candidates, and image digests. |
| [top500-catalog-analysis/review.csv](./top500-catalog-analysis/review.csv) | Top-500 evidence map: retained source-scan rows joined to current recipe proof, catalog status, version drift, source features, and next action. |
| [variant-path-coverage/summary.md](./variant-path-coverage/summary.md) | Per chart/base/path matrix for base variants, diffs, operations, and derived ConfigHub variants. |
| [quirk-coverage/summary.md](./quirk-coverage/summary.md) | Coverage audit for Helm quirks: tracked, partly tracked, source-scanned only, or not scanned. |
| [high-fanout-demo/summary.md](./high-fanout-demo/summary.md) | Prometheus/kube-prometheus-stack example showing how one base choice changes many objects and prerequisites. |
| [high-fanout-demo/operation-preview.md](./high-fanout-demo/operation-preview.md) | Pre-ship operation preview for kube-prometheus-stack high-fanout inputs: route, reach, guardrail, and next proof. |
| [edge-recovery/summary.md](./edge-recovery/summary.md) | Recovered graph fragments from catalog-supported recipe artifacts. |
| [csv-index.csv](./csv-index.csv) | Machine-readable index of every CSV under data/. |

The front-door CSVs are intentionally redundant with deeper generated reports.
They join the important evidence into a small set of spreadsheet-friendly
tables. Use the deeper CSVs when you need drill-down.

## CSV Audience Labels

`csv-index.csv` assigns each CSV one audience label. Use the labels to decide
which files are evidence, which files are planning, and which files are
supporting drill-down.

| Audience | Meaning |
| --- | --- |
| `user/front-door` | Start here. These CSVs join the important proof and status data into reader-facing tables. |
| `verification` | Evidence tables for committed proof lanes, live receipts, runtime checks, and parity checks. |
| `corpus` | Maintained chart facts, feature facts, quirk facts, and graph fragments used by the catalog. |
| `planning` | Work queues, promotion reviews, refresh candidates, and future catalog expansion inputs. |
| `supporting` | Secondary generated tables that explain or drill into another summary. Do not cite these as the headline status without following the linked summary. |

When in doubt, read in this order:

~~~text
user/front-door
-> verification
-> corpus
-> planning
-> supporting
~~~

## Regeneration Order

Use the narrowest generator that matches the change, then run the matching
verify command. Do not run live tests just to refresh CSVs.

| Change | Regenerate in this order |
| --- | --- |
| Chart facts, quirk facts, or variant metadata | `npm run chart-facts`, `npm run outcomes:generate`, `npm run top100:readiness`, `npm run status:dashboard`, `npm run site:generate` |
| Production support decisions or blockers | `npm run production:disposition`, `npm run production:disposition:details`, `npm run top100:readiness`, `npm run status:dashboard`, `npm run site:generate` |
| Live receipt status | Regenerate the lane summary, then `npm run outcomes:generate`, `npm run status:dashboard`, `npm run site:generate` |
| Per-chart catalog or artifact map inputs | `npm run catalog:maps`, then `npm run catalog:index` if the root catalog view changed |
| CSV files added, removed, or renamed | Run the owner generator first, then `npm run data:index` |

After regenerating, run the same commands with `:verify` where available.
Use `npm run verify` only as the broad release gate after scoped checks pass.

## How To Read Status

| Term | Meaning |
| --- | --- |
| `model-supported` | The chart has a complete, honest model for its declared scope. It is not a live-deployment claim by itself. |
| `render parity` | `cub installer` setup renders the same Kubernetes object set as regular Helm under recorded inputs. |
| `in-ConfigHub` | The rendered objects upload as ConfigHub Units with scan/safe-operation receipts. |
| `local live` | The rendered objects were applied to Kubernetes and observed with workload checks. |
| `GitOps live` | ConfigHub OCI was reconciled by Argo or Flux and observed. |
| `live parity` | A live Helm install was compared with ConfigHub delivery paths. |
| `missing` | No committed receipt for that exact row yet. This is backlog, not failure. |
| `watch` | A committed receipt exists and the lane produced useful evidence, but runtime, storage, controller-health, initialization, or operating policy still needs review. |
| `blocked` | A committed receipt exists, but a target prerequisite, lifecycle route, hook decision, Secret, CRD, storage class, or similar condition must be resolved before the row can pass. |
| `fail` | A committed receipt records a failed check. Read the reason before treating it as a ConfigHub-vs-Helm defect. |

## Dataset Families

| Family | Main summary | Primary use |
| --- | --- | --- |
| `adversarial10` | [adversarial10/summary.md](./adversarial10/summary.md) | hard-chart readiness and control-point analysis |
| `attack-plan-workdown` | [attack-plan-workdown/summary.md](./attack-plan-workdown/summary.md) | execution workdown across gaps and proof lanes |
| `blast-radius-accuracy` | [blast-radius-accuracy/summary.md](./blast-radius-accuracy/summary.md) | front-door measured blast-radius accuracy seed and backlog |
| `catalog-promotion-review` | [catalog-promotion-review/summary.md](./catalog-promotion-review/summary.md) | catalog promotion worksheet for the 100-chart corpus |
| `catalog-promotion-wave2` | [catalog-promotion-wave2/summary.md](./catalog-promotion-wave2/summary.md) | older user-shaped variant work-order worksheet |
| `chart-facts` | [chart-facts/summary.md](./chart-facts/summary.md) | per-chart feature, quirk, and hard-gap facts |
| `claims-register` | [claims-register/summary.md](./claims-register/summary.md) | front-door public claim-to-evidence register |
| `data-index` | - | CSV index and generated data guide |
| `derived-variant-target-bound` | [derived-variant-target-bound/summary.md](./derived-variant-target-bound/summary.md) | derived ConfigHub variants with target/live evidence |
| `edge-recovery` | [edge-recovery/summary.md](./edge-recovery/summary.md) | recovered desired-state graph fragments |
| `extension-slots` | [extension-slots/summary.md](./extension-slots/summary.md) | NGINX-like extension-slot coverage and routing |
| `external-scan-lane` | [external-scan-lane/summary.md](./external-scan-lane/summary.md) | external scanner lane review output |
| `high-fanout-demo` | [high-fanout-demo/summary.md](./high-fanout-demo/summary.md) | Prometheus base-variant fanout and prerequisite example |
| `hook-lifecycle` | [hook-lifecycle/summary.md](./hook-lifecycle/summary.md) | hook-bearing charts and required lifecycle receipt paths |
| `hook-lifecycle-review` | [hook-lifecycle-review/summary.md](./hook-lifecycle-review/summary.md) | supporting generated evidence |
| `image-digest-workdown` | [image-digest-workdown/summary.md](./image-digest-workdown/summary.md) | image pinning and mutable tag review |
| `lane-test-matrix` | [lane-test-matrix/summary.md](./lane-test-matrix/summary.md) | exact chart/base proof lane status |
| `latest-top20-refresh` | [latest-top20-refresh/summary.md](./latest-top20-refresh/summary.md) | latest upstream chart-version refresh candidates |
| `legacy-patch-review` | [legacy-patch-review/summary.md](./legacy-patch-review/summary.md) | older chart-version patch support review |
| `lifecycle-boundary` | [lifecycle-boundary/summary.md](./lifecycle-boundary/summary.md) | hook queue and hook-like lifecycle observation boundary |
| `lifecycle-observations` | [lifecycle-observations/cert-manager-eso/summary.md](./lifecycle-observations/cert-manager-eso/summary.md) | controller-owned or hook-like lifecycle observations |
| `live-e2e` | [live-e2e/summary.md](./live-e2e/summary.md) | top-20 local kind runtime status |
| `live-helm-confighub-compare` | [live-helm-confighub-compare/summary.md](./live-helm-confighub-compare/summary.md) | strict live Helm-vs-ConfigHub parity |
| `live-kind-parity` | [live-kind-parity/summary.md](./live-kind-parity/summary.md) | two-cluster kind parity receipts |
| `live-parity-rerun-plan` | [live-parity-rerun-plan/summary.md](./live-parity-rerun-plan/summary.md) | rerun queue for non-pass live parity rows |
| `model-completeness` | [model-completeness/summary.md](./model-completeness/summary.md) | chart-level model support criteria |
| `next-ten-waves` | [next-ten-waves/summary.md](./next-ten-waves/summary.md) | compact next work queues |
| `next80-full-proofs` | [next80-full-proofs/summary.md](./next80-full-proofs/summary.md) | 80 additional full proof-grade chart artifacts |
| `nginx-config-checks` | [nginx-config-checks/summary.md](./nginx-config-checks/summary.md) | NGINX supported-base config extension checks |
| `outcome-coverage` | [outcome-coverage/summary.md](./outcome-coverage/summary.md) | front-door outcome, test, and status map |
| `pain-point-coverage` | [pain-point-coverage/summary.md](./pain-point-coverage/summary.md) | front-door Helm pain point coverage map |
| `production-disposition` | [production-disposition/summary.md](./production-disposition/summary.md) | top-20 production blockers and next actions |
| `production-support-decisions` | [production-support-decisions/summary.md](./production-support-decisions/summary.md) | target-scoped production support decision artifacts |
| `quirk-coverage` | [quirk-coverage/summary.md](./quirk-coverage/summary.md) | Helm quirk-axis coverage audit |
| `quirk-review-queue` | [quirk-review-queue/summary.md](./quirk-review-queue/summary.md) | queue for chart quirks needing human or product review |
| `refresh-survival` | [refresh-survival/summary.md](./refresh-survival/summary.md) | latest-version refresh survival and upgrade seed |
| `runtime-gitops` | [runtime-gitops/summary.md](./runtime-gitops/summary.md) | Argo/Flux OCI live proof wave |
| `scan-disposition-workdown` | [scan-disposition-workdown/summary.md](./scan-disposition-workdown/summary.md) | scan warning routes to fixes, hardened bases, or explicit dispositions |
| `status-dashboard` | [status-dashboard/summary.md](./status-dashboard/summary.md) | one-page front-door status dashboard |
| `top100-catalog-analysis` | [top100-catalog-analysis/summary.md](./top100-catalog-analysis/summary.md) | top-100 proof and promotion surface |
| `top100-coverage` | [top100-coverage/summary.md](./top100-coverage/summary.md) | front-door top-100 coverage contract and work queue |
| `top100-promotion-wave` | [top100-promotion-wave/summary.md](./top100-promotion-wave/summary.md) | first strict top-100 promotion-review wave |
| `top100-readiness` | [top100-readiness/summary.md](./top100-readiness/summary.md) | front-door top-100 user readiness and evidence summary |
| `top100-user-readiness` | [top100-user-readiness/summary.md](./top100-user-readiness/summary.md) | supporting generated evidence |
| `top20-base-readiness` | [top20-base-readiness/summary.md](./top20-base-readiness/summary.md) | top-20 base-variant readiness and first-path guidance |
| `top500-catalog-analysis` | [top500-catalog-analysis/summary.md](./top500-catalog-analysis/summary.md) | top-500 catalog planning analysis |
| `variant-backlog` | [variant-backlog/summary.md](./variant-backlog/summary.md) | candidate base-variant expansion backlog |
| `variant-goldens` | - | golden work orders for derived-variant examples |
| `variant-path-coverage` | [variant-path-coverage/summary.md](./variant-path-coverage/summary.md) | chart/base/path proof status matrix |

## Every CSV

The complete CSV list is generated at:

~~~text
data/csv-index.csv
~~~

It includes 89 CSV files. Each row records the path, audience,
purpose, summary, and regenerate/verify command where known.

## Regeneration

Regenerate and verify this index:

~~~sh
npm run data:index
npm run data:index:verify
~~~

The full repository verifier includes the data index:

~~~sh
npm run verify
~~~
