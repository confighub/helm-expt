# helm-expt Testing Strategy

_The Coverage Ladder layer of the [helm-expt test map](README.md)._

This file explains when to run each class of test and what kind of claim each
test can support. It complements [npm-scripts.md](npm-scripts.md), which lists
the individual commands.

The goal is not to run every test after every edit. The goal is to keep claims
matched to evidence:

```text
static corpus check
-> render parity
-> ConfigHub proof
-> local Kubernetes proof
-> GitOps/OCI proof
-> strict live Helm-vs-ConfigHub parity
-> lifecycle observation
-> production support decision
```

## Test Principles

Use scoped checks while working. Run the full repo gate only before broad merges,
public review, or release-style claims.

Do not use `npm run verify` as a substitute for a live test. It proves committed
artifacts and receipts are internally consistent. It does not create fresh live
evidence.

Do not use a live test as a substitute for render parity. Live success can hide
object drift. Render parity must still prove that regular Helm and
`cub installer` produced the same intended object set under recorded inputs.

Commit live receipts when the claim depends on them. If a live run is not
committed and indexed by the matching generated summary, do not claim the lane
changed.

Separate semantic parity from target fit. A chart/base can have perfect object
parity and still need a CRD, Secret, StorageClass, hook route, controller
readiness check, or operating-policy decision.

## Coverage Ladder

| Level | Evidence | Claim |
| --- | --- | --- |
| 1 | Recipe, package, source lock, effective values, receipts, catalog map | The chart/base is represented in the corpus. |
| 2 | Helm template versus `cub installer setup` receipt | The base renders the same intended Kubernetes objects as regular Helm, with documented intentional differences. |
| 3 | ConfigHub upload, scan, and safe-operation receipts | The rendered objects can become ConfigHub Units and participate in ConfigHub review. |
| 4 | Local kind observation receipt | The rendered objects work on the tested Kubernetes target. |
| 5 | ConfigHub OCI plus Argo or Flux receipt | The ConfigHub artifact can be reconciled by a GitOps controller on the tested target. |
| 6 | Strict live parity receipt | Regular Helm and the `cub installer` path reached the recorded equivalent live outcome. |
| 7 | Lifecycle observation receipt | Controller-owned, hook-like, or post-apply behavior was observed fresh. |
| 8 | Production disposition and target-scoped decision | The chart is accepted for a named production support scope. |

Use the narrowest true claim. For example, `render parity` is not the same as
`GitOps live`, and `production-review-ready` is not the same as
`production-supported`.

## Current Corpus Shape

Top-20 is the public catalog lane. It has named base variants, broad proof
coverage, live evidence, and production-disposition inputs. Exact status still
depends on chart, base, and lane.

Top-100 is the maintained proof corpus. Every chart has recipe/package proof and
render parity, but most rows still need catalog promotion review, useful
variants, or selected live lanes.

Top-500 is source and catalog-planning reconnaissance. It shows where Helm pain
appears across popular public charts. It is not an installable catalog.

Authoritative generated views:

| Need | Start with |
| --- | --- |
| Current aggregate status | `data/status-dashboard/summary.md` |
| Outcome and lane coverage | `data/outcome-coverage/summary.md` |
| Top-20 base readiness | `data/top20-base-readiness/summary.md` |
| Top-100 workability | `data/top100-readiness/summary.md` |
| Top-500 evidence map | `data/top500-catalog-analysis/summary.md` |
| Live parity residue | `data/live-parity-rerun-plan/summary.md` |
| Hook and lifecycle boundary | `data/lifecycle-boundary/summary.md` |
| Test command details | `tests/npm-scripts.md` |

## When To Run What

| Work | Checks |
| --- | --- |
| One manual doc edit | `npm run docs:verify` |
| Command example edit | `npm run docs:verify` and `npm run installer:command-surface:verify` |
| Generated data edit | The owner `*:verify`, then `npm run data:index:verify` if CSVs were added, removed, renamed, or reclassified |
| Static site edit | `npm run site:verify` |
| One curated chart proof edit | `<chart>:compare`, `<chart>:verify-proof`, `<chart>:verify-proof:self-test`, `<chart>:verify-package` |
| Shared proof-kit edit | Representative chart checks for the changed hook, then all migrated top-20 proof/package checks before broad merge |
| Recipe/package graph or target facts | Chart-specific checks, `npm run verify:artifact-chain`, and `npm run installer:target-facts:verify` when facts changed |
| Broad proof-model change | Focused checks for each changed surface, then `npm run verify` |
| Fresh local Kubernetes evidence | The lane runner that writes the receipt, followed by the lane summary and verifier |
| Fresh GitOps/OCI evidence | `tests/chart-install-test` or `tests/chart-install-sweep`, followed by the runtime/GitOps summary verifier |
| Fresh strict live parity evidence | `npm run kind-parity:run` for one chart/base, or the top-20 variant runner for a campaign |

## Live Test Work Unit

The atomic live work unit is one chart/base row:

```text
chart
base variant
target cluster or pair of clusters
commands run
rendered object digest
runtime observations
result: pass, watch, blocked, or fail
receipt path
```

Every receipt should explain non-pass rows. A `watch` or `blocked` row is useful
when it separates:

- semantic object parity defect;
- target prerequisite;
- runtime readiness;
- hook or lifecycle behavior;
- storage or operating-policy decision;
- infrastructure/provisioning failure.

Do not collapse those cases into a generic failure.

## Strict Helm-vs-Installer Parity

The preferred parity test uses two identical vanilla kind clusters:

```text
cluster A: regular Helm install
cluster B: cub installer setup + kubectl apply
compare intended objects and live outcomes
```

This keeps the parity question separate from ConfigHub delivery machinery. It
does not require ConfigHub's `cub cluster` helper.

Use ConfigHub/OCI live tests for a different question:

```text
Can ConfigHub Units be published or applied through OCI and reconciled by Argo
or Flux on a live target?
```

Both lanes matter. They prove different outcomes.

Run strict live parity serially unless a lock/guard prevents concurrent cleanup
from deleting another run's kind clusters. Every `kubectl` command should pin
the intended kubeconfig and context.

## Chart Refresh Strategy

Do not replace a supported chart version just because upstream released a new
one.

Use this path:

```text
current supported version
-> latest candidate render/proof
-> diff, quirk, and gap review
-> live or lifecycle evidence where needed
-> production-disposition update if needed
-> catalog promotion decision
```

Older supported versions can remain valuable for patch, audit, and enterprise
support. Keep old versions until the project has an explicit replacement or
retirement decision.

## Scaling Strategy

Scale by rows, not by narrative claims:

```text
top20 chart/base rows
-> top100 proof rows
-> top500 promotion candidates
```

Parallel runs are appropriate for independent chart/base rows, but each live
runner must own its cluster names, kubeconfigs, namespaces, ConfigHub spaces,
and cleanup. Receipt aggregation should be mechanical: collect row receipts,
regenerate summaries, then run the matching verifiers.

The desired end state is a catalog where every chart/base row has:

- render parity;
- in-ConfigHub proof when the row is presented as a ConfigHub-managed path;
- live proof for the target delivery mode being claimed;
- lifecycle receipts for hooks, CRDs, webhooks, generated data, or
  controller-owned fields;
- production support decisions only for explicitly scoped targets.
