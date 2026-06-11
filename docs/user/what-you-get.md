# What You Get

**UNOFFICIAL/EXPERIMENTAL**

This project is a public proof that Helm charts can become reviewed ConfigHub
config variants without asking users to abandon the Helm ecosystem.

The user-facing promise is:

```text
Use Helm charts.
Choose a reviewed base variant.
Inspect the exact Kubernetes objects.
Manage derived variants in ConfigHub.
Keep receipts for what was rendered, checked, uploaded, delivered, and observed.
```

## The Product Model

Helm remains the chart source. `cub installer` turns a selected chart, version,
values set, and capability/fact profile into a repeatable package with named
base variants.

ConfigHub then stores the rendered objects as Units. From there, teams can use
ConfigHub labels, links, targets, gates, functions, changesets, approvals, and
`cub variant create` to manage post-render variants.

The practical split is:

| Choice | Route |
| --- | --- |
| Already managed by Argo, Flux, KRM, rendered YAML, or live resources | Adopt first through `cub gitops discover/import`, `cub unit import`, or a managed import workflow. |
| Changes Helm inputs, object shape, object count, topology, CRDs, RBAC, storage, generated facts, extension slots, or lifecycle behavior | New or updated `cub installer` base variant. |
| Refines already-rendered fields, target, environment, region, customer, gates, links, observation policy, or approved placeholder fills | Derived ConfigHub variant after upload. |
| Requires an external runtime prerequisite | Delivery prerequisite, target fact, preflight, gate, or observation receipt. |

This keeps Helm rendering, ConfigHub variation, and live-cluster evidence as
separate stages. A user can see which stage is responsible for a change.

## The Graph Bridge

Helm normally renders objects and discards the relationships that produced
them. helm-expt keeps some of those relationships as explicit artifacts:

```text
base variant -> derived base variant
variant value -> rendered field
generated fact -> rendered field
target fact -> required live prerequisite
```

Those recovered edges are not a complete ConfigHub graph yet. They are graph
fragments that show how a Helm chart can move from flat rendered YAML into
managed desired state. The current generated edge-recovery scope covers the
top-20 catalog-supported charts, with field reachability still limited to
charts that have value-source-map coverage:

[Edge Recovery](../../data/edge-recovery/summary.md)

## What Is Already In The Corpus

The current public corpus contains:

```text
100 recipe/package proof artifacts
20 top-chart catalog entries with bespoke base variants
20 top-20 charts with chart-level local kind runtime receipts
20 top-20 charts with chart-level ConfigHub upload, scan, and safe-operation receipt sets
20 top-20 charts with production-review-ready disposition receipts
20 top-20 charts with target-scoped support decision artifacts
17 top-20 charts with supported target-scoped proof scopes
2 top-20 charts kept as superseded deprecated-source proof evidence
1 top-20 chart with a rejected default base and a concrete follow-up route
20 chart-specific Helm pain reports
10 derived ConfigHub variant work orders with live `cub variant create` receipts
6 target-bound derived variant receipts with OCI/GitOps/runtime evidence
20 top-20 charts with recovered desired-state graph fragments
top-100 and top-500 catalog analysis data
extension-slot coverage for 13/20 top catalog charts and 82/100 top100 chart facts
11/100 public top-100 source-scan rows containing Helm hooks
5 maintained hook queue rows with route receipts and 5/5 lifecycle observation receipts
separate cert-manager `startupapicheck` hook observations and External Secrets lifecycle observations for common CRD/webhook/controller-owned runtime behavior
selected GitOps/OCI and live parity receipts
```

Those chart-level counts do not mean every base variant has every live lane.
For exact chart/base status, use the generated status dashboard and
`base-outcomes.csv`.

For a compact generated view of the catalog and proof state, open
[`site/index.html`](../../site/index.html). It shows command routing, proof
counters, top-20 base readiness, exact `cub installer setup` commands for the
recommended bases, top-100 readiness, the top-500 evidence boundary, and
extension-slot coverage.

The generated summaries and verifier scripts decide the exact current counts.
Use [Current Proof Status](./current-proof-status.md) and
[Verification Lanes](./verification-lanes.md) before making a narrow claim such
as "GitOps live", "local live", or "live parity".

Use [Chain Of Proof](./chain-of-proof.md) when you need to explain which tool
proves which boundary. The short rule is: render proof, ConfigHub proof,
delivery proof, and live proof are related but not interchangeable.

## From Proof Corpus To Product Path

The current corpus proves that the model works across real public charts. The
next product step is to make the path obvious for a user and supportable for a
team.

That means:

| Work | Product reason |
| --- | --- |
| Finish target-scoped production support decisions for the top-20 catalog. | Users need to know which bases are supported for which target scope, not only that receipts exist. |
| Make kube-prometheus-stack the serious-chart proof. | It exercises high fanout, CRDs, webhooks, RBAC, generated facts, extension slots, and large rendered-object sets. |
| Expand field reachability beyond Redis. | Helm's core weakness is forgetful generation. The ConfigHub value grows when rendered fields keep provenance and relationships. |
| Complete hook and lifecycle observation receipts for maintained hook charts. | Hook inventory is useful, but production users need a route, an execution decision, and fresh evidence. |
| Keep the first public path short. | A Helm user should be able to choose a base, inspect objects, run the command, and understand the proof without reading the planning docs. |

The persistent ConfigHub graph is the long-term product surface. helm-expt
should feed that graph with checkable chart, variant, provenance, quirk, and
receipt data. ConfigHub Server then adds authority, query, history, approvals,
target assignment, and freshness across many variants and clusters.

## Why This Is Better Than Plain Helm For Operations

Plain Helm is useful for rendering and installing. The operational gap is what
happens after someone needs to approve, compare, promote, patch, audit, or
observe the install.

ConfigHub adds:

| Helm pain | ConfigHub-shaped answer |
| --- | --- |
| Values files hide the object-level result. | Review exact rendered Kubernetes objects. |
| Environments drift through copied values files. | Use named base variants and derived ConfigHub variants with links and receipts. |
| Scans can run on a different YAML than the install. | Bind scan/gate results to rendered object digests. |
| Promotion reruns generators and hopes for the same answer. | Promote an approved rendered object set or a reviewed derived variant. |
| Day-2 patches spread through hand-edited YAML. | Use labeled Units, functions, changesets, approvals, and receipts. |
| Live state gets stale. | Record observer, method, timestamp, result, and freshness. |

## What Is Still Product Work

The repo is a proof corpus and product design surface. Some workflows are still
scripted, narrow, or represented by receipts rather than polished commands.

Candidate product surfaces and workflow work include:

```text
cub installer import helm
cub installer analyze
cub installer compare/prove
cub installer scan
Creator-style preview/check flows over cub variant create
clear release/OCI handoff semantics
closing the remaining live parity watch and blocked rows
per-chart lifecycle routes for hook-heavy charts
```

Those lines are product gaps or proposed surfaces unless the current CLI help
already exposes them. Do not treat this list as a runnable command sequence.
Current command routing is in [Choosing Commands](./choosing-commands.md).

## Hook And Lifecycle Boundary

Hooks and hook-like lifecycle behavior need cautious handling. The repo can
inventory hooks and prove the normal rendered object set. It should not claim
that hook execution is reproduced unless a lifecycle route, execution result,
and fresh observation receipt exist.

The source scan currently finds Helm hooks in 11 of the public top-100 chart
rows. The maintained hook queue is narrower: it tracks the five hook-bearing
recipe/package rows that have been promoted into lifecycle work. Cert-manager
is tracked in the related lifecycle lane because its `startupapicheck` hook is
known even though the retained source-scan row did not flag hooks. External
Secrets is not a Helm hook case in the tested bases; it shows how target-aware
lifecycle observations can prove CRD, webhook, and controller-owned runtime
behavior after apply.

Some hooks may map to tests, preflight checks, Argo lifecycle hooks, sync waves,
or managed actions. Some will remain blocked until reviewed. That is an
expected product outcome, not a failure of the model.

For the full lifecycle model, see
[Seven-Stage Helm Lifecycle](../reference/seven-stage-helm-lifecycle.md).
For free, public, managed, and production claim boundaries, see
[Product Support Tiers](./product-support-tiers.md).

## Read Next

| If you want to... | Read |
| --- | --- |
| Try the shortest verified path | [Tutorial Sequence](./tutorial-sequence.md) |
| See outcome status and CSVs | [Outcomes And Tests](./outcomes-and-tests.md) |
| See which Helm pains are addressed | [Helm Pain Points](./helm-pain-points.md) |
| Understand which proof proves which boundary | [Chain Of Proof](./chain-of-proof.md) |
| Adopt existing apps | [Adopting Existing Apps](./adopting-existing-apps.md) |
| Understand proof levels | [Verification Lanes](./verification-lanes.md) |
| Choose base versus derived variants | [Creating Variants](./creating-variants.md) |
| Route values files and overlays | [Custom Overlays](./custom-overlays.md) |
| Route raw manifests, tpl snippets, sidecars, and config blocks | [Extension Slots](./extension-slots.md) |
| Understand hook handling | [Hook Lifecycle Strategy](./hook-lifecycle-strategy.md) |
| See why this is not just a fast render command | [Why This Exists](./why-this-exists.md) |
| Understand free, managed, and production boundaries | [Product Support Tiers](./product-support-tiers.md) |
| Understand how review-ready becomes production-supported | [Production Support Decisions](./production-support-decisions.md) |
