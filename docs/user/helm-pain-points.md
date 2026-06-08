# Helm Pain Points

**UNOFFICIAL/EXPERIMENTAL**

This project tracks Helm pain points in two ways.

First, it keeps a general matrix that explains how the model addresses common
Helm problems:

```text
data/pain-point-coverage/pain-points.csv
data/pain-point-coverage/summary.md
```

Second, each supported chart has its own pain report:

```text
recipes/<repo>/<chart>/<version>/helm-pain-report.yaml
```

The general matrix says what kind of problem we are dealing with. The per-chart
report says how that problem appears in a real chart and what the current
disposition is.

## The Short Version

Helm is a generator. One chart plus one set of values can produce many
Kubernetes objects. Some values touch many objects and fields. After render,
the output no longer explains clearly which input produced which field.

helm-expt addresses that by turning the render into explicit artifacts:

```text
source lock
dependency lock
effective values
named base variant
rendered objects
object inventory
Helm-equivalence receipt
scan/gate receipts
pain report
optional live receipts
```

That does not solve every Helm problem by itself. It makes each problem visible
and routes it to the right place.

## Where The Answer Lives

| Problem kind | Home |
| --- | --- |
| Chart source, dependency, values, render, and object inventory | helm-expt |
| Reviewed package/base that can be rendered or uploaded | `cub installer` |
| Managed desired state, variants, links, approvals, changesets | ConfigHub Server |
| Live state, drift, readiness, freshness | `cub-scout` and controllers |
| Private values, private overlays, old-version patches, production SLAs | managed/commercial lane |

## General Model

The general answer is the same for every chart:

```text
Helm chart or wrapper chart
-> cub installer recipe/package
-> named base variant
-> exact rendered object revision
-> scans, gates, and receipts
-> ConfigHub Units and optional derived ConfigHub variants
-> OCI/GitOps handoff
-> cub-scout, controller, or other observation receipts
```

`helm-expt` is the public proof corpus: chart analysis, recipes, variants,
rendered objects, receipts, and pain reports.

`cub installer` is the executable package path: setup, render, package, upload,
and verify the reviewed bases.

ConfigHub Server is the managed operations layer: Units, variants, links,
changesets, approvals, diffs, receipts, search, and governance.

GitOps controllers apply or pull the published desired state. `cub-scout` and
other observers provide fresh live evidence. Workerless ConfigHub should not
claim current cluster truth without a fresh observation receipt.

## Per-Chart Proof

The general model is not enough by itself because Helm pain is chart-specific.
Each maintained chart has a chart-level report:

```text
recipes/<repo>/<chart>/<version>/helm-pain-report.yaml
```

That file answers:

```text
What chart behavior caused pain?
Where did it land in the model?
Which variants are supported?
Which receipts prove the current claim?
What remains blocked, partial, or operator-reviewed?
```

Examples:

| Chart | Pain report |
| --- | --- |
| Redis | [recipes/bitnami/redis/25.5.3/helm-pain-report.yaml](../../recipes/bitnami/redis/25.5.3/helm-pain-report.yaml) |
| cert-manager | [recipes/jetstack/cert-manager/v1.20.2/helm-pain-report.yaml](../../recipes/jetstack/cert-manager/v1.20.2/helm-pain-report.yaml) |

## The 15 Pain Points

This is the user-facing view of the generated matrix in
[`data/pain-point-coverage/pain-points.csv`](../../data/pain-point-coverage/pain-points.csv).
The status column is deliberately conservative. "Strong" means there is current
catalog evidence for the supported scope. "Partial" means the route is defined
but still depends on live evidence, product work, or chart-specific review.

| Pain point | General answer | Per-chart proof | Status |
| --- | --- | --- | --- |
| Go-templated YAML | Render to explicit objects, inventories, and Helm-equivalence receipts. | Render receipts and object inventories per base. | Strong current proof |
| values.yaml sprawl | Capture effective values and expose named base variants. | Effective values, variants, and value models. | Strong for supported bases |
| State lives in cluster secrets | Keep desired state, locks, and receipts outside Helm release state. | Outcome and runtime/GitOps rows. | Partial handoff |
| Failed upgrades wedge releases | Treat upgrade, rollback, and prune as explicit variant paths. | Operation receipts and variant-path coverage where present. | Partial |
| CRD handling | Make CRDs visible, separable where possible, and lifecycle-gated. | CRD rows in inventories, gates, and pain reports. | Partial |
| Subchart and dependency hell | Lock and document the dependency closure. | Dependency locks and chart dossiers. | Partial |
| No field-level governance | Move reviewed objects into ConfigHub Units, links, functions, gates, and mutation records. | Value-source maps and recovered edges where present. | Partial, strongest on Redis |
| No native secrets story | Separate generated facts, target facts, and external secret requirements. | Secret variants and install checks. | Partial known gap |
| Hooks are brittle | Classify hooks by lifecycle phase; do not claim hook execution from render parity alone. | Hook lifecycle data and chart pain reports. | Partial doctrine |
| Multi-environment promotion is DIY | Use base variants plus derived ConfigHub variants, labels, links, approvals, and receipts. | Derived variant receipts and promotion examples. | Partial |
| GitOps impedance mismatch | Publish pinned rendered object sets and keep GitOps live proof separate from render proof. | Runtime/GitOps and live-parity summaries. | Partial live lane |
| History without diffs | Store object revisions, diffs, operation receipts, and live observations. | Variant revisions, diffs, and receipts. | Strong static, partial operational |
| Templating language limits | Surface `tpl`, raw manifest slots, and extension points instead of hiding them. | Feature outcomes and pain reports. | Partial |
| Dry-run does not match reality | Separate static render proof from live target evidence. | Verification lanes, kind parity, lifecycle observations. | Partial live-dependent |
| Chart ownership and fork burden | Route shape changes to installer bases and post-render changes to ConfigHub variants. | Change-routing and custom-overlay guides. | Partial product lane |

## What To Read

| Question | File |
| --- | --- |
| Which Helm pains are tracked? | [pain-points.csv](../../data/pain-point-coverage/pain-points.csv) |
| What is the summary? | [summary.md](../../data/pain-point-coverage/summary.md) |
| What does this chart specifically do? | `recipes/<repo>/<chart>/<version>/helm-pain-report.yaml` |
| Which proof lanes pass per base? | [base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| Which paths still need proof? | [coverage-matrix.csv](../../data/variant-path-coverage/coverage-matrix.csv) |

## Examples

Redis is the fast teaching chart. It shows the difference between a generated
credential base and a reuse-existing-secret base.

kube-prometheus-stack is the main hard chart. It shows why the model matters
for CRDs, webhooks, RBAC, dependencies, high object count, and blast radius.

The user should not need to read every receipt. The catalog should answer:

```text
What variant should I use?
What objects will it install?
What Helm pain is known for this chart?
What has been proven?
What still needs a human decision or live evidence?
```
