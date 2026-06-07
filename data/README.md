# Data Index

This directory contains generated evidence, CSVs, and summary pages for the
Helm experiment. The data is meant to answer three questions without requiring
readers to inspect every recipe folder:

~~~text
What outcomes are promised?
Which tests prove those outcomes?
What is the current status for each chart, base, derived variant, and feature?
~~~

## Start Here

| File | Use it for |
| --- | --- |
| [outcome-coverage/summary.md](./outcome-coverage/summary.md) | Start here. Outcome promises, tests that prove them, and links to the four front-door CSVs. |
| [outcome-coverage/chart-outcomes.csv](./outcome-coverage/chart-outcomes.csv) | One row per chart: model support, production readiness, lane counts, hard gaps, feature summary. |
| [outcome-coverage/base-outcomes.csv](./outcome-coverage/base-outcomes.csv) | One row per chart/base variant: render parity, ConfigHub proof, local live, GitOps/OCI live, live Helm parity. |
| [outcome-coverage/derived-variant-outcomes.csv](./outcome-coverage/derived-variant-outcomes.csv) | One row per derived ConfigHub variant: intended-state proof and target-bound live status. |
| [outcome-coverage/feature-outcomes.csv](./outcome-coverage/feature-outcomes.csv) | One row per chart feature: hooks, generated secrets, CRDs, webhooks, required values, schemas, extension slots, gaps. |
| [csv-index.csv](./csv-index.csv) | Machine-readable index of every CSV under data/. |

The front-door CSVs are intentionally redundant with deeper generated reports.
They join the important evidence into a small set of spreadsheet-friendly
tables. Use the deeper CSVs when you need drill-down.

## How To Read Status

| Term | Meaning |
| --- | --- |
| `model-supported` | The chart has a complete, honest model for its declared scope. It is not a live-deployment claim by itself. |
| `render parity` | `cub installer` setup renders the same Kubernetes object set as regular Helm under recorded inputs. |
| `in-ConfigHub` | The rendered objects upload as ConfigHub Units with scan/safe-operation receipts. |
| `local live` | The rendered objects were applied to Kubernetes and observed with workload checks. |
| `GitOps live` | ConfigHub OCI was reconciled by Argo or Flux and observed. |
| `live parity` | A live Helm install was compared with ConfigHub delivery paths. |
| `missing` | No committed receipt for that exact row yet. |
| `blocked` / `watch` / `fail` | A committed receipt exists and records a non-pass outcome on the tested target. |

## Dataset Families

| Family | Main summary | Primary use |
| --- | --- | --- |
| `adversarial10` | [adversarial10/summary.md](./adversarial10/summary.md) | hard-chart readiness and control-point analysis |
| `attack-plan-workdown` | [attack-plan-workdown/summary.md](./attack-plan-workdown/summary.md) | execution workdown across gaps and proof lanes |
| `catalog-promotion-review` | [catalog-promotion-review/summary.md](./catalog-promotion-review/summary.md) | catalog promotion worksheet for the 100-chart corpus |
| `catalog-promotion-wave2` | [catalog-promotion-wave2/summary.md](./catalog-promotion-wave2/summary.md) | second promotion-wave review worksheet |
| `chart-facts` | [chart-facts/summary.md](./chart-facts/summary.md) | per-chart feature, quirk, and hard-gap facts |
| `data-index` | - | CSV index and generated data guide |
| `derived-variant-target-bound` | [derived-variant-target-bound/summary.md](./derived-variant-target-bound/summary.md) | derived ConfigHub variants with target/live evidence |
| `external-scan-lane` | [external-scan-lane/summary.md](./external-scan-lane/summary.md) | external scanner lane review output |
| `hook-lifecycle` | [hook-lifecycle/summary.md](./hook-lifecycle/summary.md) | hook-bearing charts and required lifecycle receipt paths |
| `image-digest-workdown` | [image-digest-workdown/summary.md](./image-digest-workdown/summary.md) | image pinning and mutable tag review |
| `lane-test-matrix` | [lane-test-matrix/summary.md](./lane-test-matrix/summary.md) | exact chart/base proof lane status |
| `latest-top20-refresh` | [latest-top20-refresh/summary.md](./latest-top20-refresh/summary.md) | latest upstream chart-version refresh candidates |
| `legacy-patch-review` | [legacy-patch-review/summary.md](./legacy-patch-review/summary.md) | older chart-version patch support review |
| `lifecycle-observations` | - | controller-owned or hook-like lifecycle observations |
| `live-e2e` | [live-e2e/summary.md](./live-e2e/summary.md) | top-20 local kind runtime status |
| `live-helm-confighub-compare` | [live-helm-confighub-compare/summary.md](./live-helm-confighub-compare/summary.md) | strict live Helm-vs-ConfigHub parity |
| `live-kind-parity` | [live-kind-parity/summary.md](./live-kind-parity/summary.md) | two-cluster kind parity receipts |
| `model-completeness` | [model-completeness/summary.md](./model-completeness/summary.md) | chart-level model support criteria |
| `next-ten-waves` | [next-ten-waves/summary.md](./next-ten-waves/summary.md) | compact next work queues |
| `next80-full-proofs` | [next80-full-proofs/summary.md](./next80-full-proofs/summary.md) | 80 additional full proof-grade chart artifacts |
| `outcome-coverage` | [outcome-coverage/summary.md](./outcome-coverage/summary.md) | front-door outcome, test, and status map |
| `production-disposition` | [production-disposition/summary.md](./production-disposition/summary.md) | top-20 production blockers and next actions |
| `quirk-review-queue` | [quirk-review-queue/summary.md](./quirk-review-queue/summary.md) | queue for chart quirks needing human or product review |
| `runtime-gitops` | [runtime-gitops/summary.md](./runtime-gitops/summary.md) | Argo/Flux OCI live proof wave |
| `top100-catalog-analysis` | [top100-catalog-analysis/summary.md](./top100-catalog-analysis/summary.md) | top-100 proof and promotion surface |
| `top500-catalog-analysis` | [top500-catalog-analysis/summary.md](./top500-catalog-analysis/summary.md) | top-500 catalog planning analysis |
| `variant-backlog` | [variant-backlog/summary.md](./variant-backlog/summary.md) | candidate base-variant expansion backlog |
| `variant-goldens` | - | golden work orders for derived-variant examples |

## Every CSV

The complete CSV list is generated at:

~~~text
data/csv-index.csv
~~~

It includes 50 CSV files. Each row records the path, audience,
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
