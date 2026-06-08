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

That does not magically solve every Helm problem. It makes each problem visible
and routes it to the right place.

## Where The Answer Lives

| Problem kind | Home |
| --- | --- |
| Chart source, dependency, values, render, and object inventory | helm-expt |
| Reviewed package/base that can be rendered or uploaded | `cub installer` |
| Managed desired state, variants, links, approvals, changesets | ConfigHub Server |
| Live state, drift, readiness, freshness | `cub-scout` and controllers |
| Private values, private overlays, old-version patches, production SLAs | managed/commercial lane |

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
