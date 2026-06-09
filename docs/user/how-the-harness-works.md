# How The Harness Works

**UNOFFICIAL/EXPERIMENTAL**

The Helm experiment harness turns public Helm charts into reviewed `cub
installer` packages, checks the rendered Kubernetes objects against regular
Helm output, and records the evidence needed to manage those objects in
ConfigHub.

The useful unit is the rendered object set for a named base variant. A user can
inspect that object set, compare it with Helm, scan it, upload it to ConfigHub,
create derived ConfigHub variants with approved post-render refinements, and
attach receipts for what was rendered, mutated, checked, approved, applied, or
observed.

## Seven-Stage Lifecycle

The harness uses the same seven stages for every chart:

| Stage | What it manages | User value |
| --- | --- | --- |
| 1. Acquire and pin | Chart source, dependencies, digests, provenance. | The input is fixed and reviewable. |
| 2. Render and capture | Helm render inputs, generated facts, capability profile, render parity. | The Kubernetes objects are known before install. |
| 3. Shape base variants | Supported install shapes such as `default`, `existing-secret`, `no-crds`, or HA. | Choices are named variants, not scattered values files. |
| 4. Scan and gate | Exact rendered objects, policy findings, install decision. | Checks run on the output that will be used. |
| 5. Settle prerequisites | Target facts, preflight needs, approvals, signatures, delivery requirements. | External dependencies are visible before deploy. |
| 6. Publish and deploy | OCI/GitOps/apply handoff and lifecycle routing. | The handoff has evidence and ordering. |
| 7. Observe and operate | Live state, freshness, drift, promotion, upgrade, rollback. | Day-1 and day-2 operations have receipts. |

Render parity is the first trust boundary:

```text
regular Helm render and cub installer render produce the same Kubernetes object
set under recorded inputs, except for explicitly classified support objects or
intentional differences.
```

Render parity proves the desired non-hook object set. Hooks, webhook readiness,
controller-populated fields, GitOps sync, drift, and upgrade behavior require
lifecycle, handoff, or observation receipts.

The detailed doctrine is
[Seven-Stage Helm Lifecycle](../reference/seven-stage-helm-lifecycle.md).
For the user-facing proof boundaries across the tools, see
[Chain Of Proof](./chain-of-proof.md).

## User Value

Helm often compresses install, render, release history, and cluster-side effects
into one workflow. The harness separates those concerns so each one can be
reviewed and checked.

| Helm lifecycle stage | Common pain | Harness output | User value |
| --- | --- | --- | --- |
| Discover chart | Popular charts still hide behavior. | Catalog entry, chart dossier, pain report, support scope. | Known risks are visible before install. |
| Choose install shape | Values files hide intent and variants are ad hoc. | Named installer bases such as `default`, `existing-secret`, `no-crds`, or HA. | The install shape is explicit. |
| Add values or overlays | It is unclear whether a change needs a new render. | Helm render and object-shape changes go through `cub installer`; approved post-render refinements go through derived ConfigHub variants. | Customization has a clear route. |
| Render | Templates, capabilities, `lookup`, generated values, and dependencies are implicit. | Source locks, dependency locks, effective values, capability profile, target facts, generated facts. | The render can be reproduced and explained. |
| Compare | Teams often review values instead of exact objects. | Helm-equivalence receipt and classified differences. | Approval is based on Kubernetes objects. |
| Review and scan | YAML review is noisy and scans can drift from the install output. | Object inventory, rendered scans, gates bound to manifest digests. | Misconfig checks run on the exact output. |
| Upload and manage | Helm release history is limited as a governance record. | ConfigHub Units, labels, revisions, links, receipts. | Teams can diff, search, approve, and audit config. |
| Create derived variants | Copying values files across environments loses provenance. | `cub variant create` clone/link plus guided variant creation. | Environment, region, and customer variants can be previewed and checked. |
| Deploy or hand off to GitOps | Desired, applied, and live state blur together. | OCI/GitOps handoff plus apply, publish, and observation receipts. | Teams know what was handed off and what was observed. |
| Observe live state | Observation freshness decays. | cub-scout, GitOps, or controller receipts with timestamps and TTL. | Evidence has an explicit freshness boundary. |
| Upgrade, patch, or roll back | Chart drift and release-state coupling make day-2 changes risky. | Upgrade/rollback receipts, production dispositions, legacy patch review. | Change is managed as a proven variant revision. |
| Hooks and lifecycle actions | Hooks depend on cluster state and phase. | Hook inventory, lifecycle policy, Argo/GitOps translation where safe, blockers where unsafe. | Lifecycle risk is visible before production use. |

The pattern is:

```text
chart
-> cub installer recipe/package
    -> named base variants
    -> exact rendered objects
    -> scans, gates, and receipts
    -> ConfigHub Units
    -> derived ConfigHub variants with approved post-render fields, facts, targets, gates, links, and checks
    -> live or GitOps observations
```

## Current Evidence

The current repo verifies:

```text
100 recipe/package proof artifacts
20 top-chart catalog entries with bespoke variants
20/20 top-20 charts with at least one local kind live/e2e receipt
20/20 top-20 charts with chart-level ConfigHub upload, scan, and safe-ops receipt sets
20 per-chart Helm pain reports
top-500 catalog analysis
hook/lifecycle risk estimate for the top-500 scan
latest-version candidate proofs for 6 moved top-20 charts
```

Per-base lane status is tracked separately. A chart can have a chart-level proof
set while one of its bases still needs ConfigHub, local live, GitOps, parity, or
lifecycle evidence.

The remaining work is productization: turning repo-proven scripts into product
surfaces for import, analysis, preflight, compare/prove, scan, and variant
creation.

## Stage 1 - Chart Intelligence

Chart intelligence records what the chart is, which inputs are being used, and
which Helm behaviors need control points.

Inputs:

```text
public chart or wrapper chart
chart version
values and overlays when supplied
dependency closure
target capability assumptions
```

Artifacts:

```text
source-lock.yaml
dependency-lock.yaml
effective-values.yaml
helm-pain-report.yaml
helm-plan.yaml
chart-dossier.yaml
top500 catalog analysis
```

Current implementation:

```text
AI-assisted chart analysis
repo generators
repo verifiers
```

Roadmap surface, not a current command in this repo:

```text
cub installer analyze
```

This is where hidden chart behavior becomes visible before install.

## Stage 2 - Recipe And Package Construction

Recipe and package construction turns the chart and selected inputs into a
durable installer artifact.

Artifacts:

```text
packages/<repo>/<chart>/<version>/installer.yaml
recipes/<repo>/<chart>/<version>/recipe.yaml
variants/<variant>/variant.yaml
install-checks.yaml where available
target fact requirements
generated fact policy
capability profile
```

Current implementation:

```text
repo generators create cub installer packages and chart-specific recipe artifacts
```

Roadmap surfaces, not current commands in this repo:

```text
cub installer import helm
cub installer preflight
```

`cub helm template` is the quick local render path. It is useful for inspection,
debugging values, CRD/resource split checks, and Helm-equivalence baselines.

`cub helm install` is the quick one-shot ConfigHub load path. It is useful when
the goal is to create ConfigHub Units from one chart render now.

A `cub installer` recipe/package is the reusable catalog artifact. Import
bridges the fast Helm command paths into the maintained recipe/package path.

## Stage 3 - Render, Compare, And Prove

The render stage checks that the `cub installer` path produces the expected
Kubernetes objects.

Artifacts:

```text
rendered/release-objects.yaml
rendered/object-inventory.yaml
helm-equivalence-receipt.yaml
render-receipt.yaml
scan-receipt.yaml
install-gate.yaml
variant-revision.yaml
```

Current implementation:

```text
npm run verify
per-chart compare/proof scripts
tamper-detection self-tests
verify-install helpers for user-side Redis checks
```

Roadmap surfaces, not current commands in this repo:

```text
cub installer compare
cub installer prove
cub installer scan
```

The proof unit is the exact rendered object set.

## Stage 4 - ConfigHub Upload, Governance, And Derived Variants

After rendered objects are reviewed, ConfigHub stores them as Units and gives
teams revision history, labels, links, approvals, scans, and variant operations.

Artifacts:

```text
ConfigHub proof transcripts
upload receipts
function-scan receipts
safe-ops receipts
server-side variant clone receipts
variant creation guidance
```

Current implementation:

```text
cub installer upload
cub variant create
cub unit list/data/tree/diff/revision
cub changeset and unit approve/apply/cancel lanes where proven
ConfigHub function scans
```

Roadmap surfaces, not current commands in this repo:

```text
Creator preview
Creator check
variant diff
variant promote
variant update/rebase
operation receipts
```

`cub variant create` provides the clone/link substrate. The product layer should
make the safe variant-creation path easy to preview, check, and explain.

## Stage 5 - Live, GitOps, And Lifecycle Evidence

Live evidence records what happened after apply, publish, or GitOps sync.

Artifacts:

```text
local kind observation receipts
production disposition reports
observation freshness SLO
hook lifecycle strategy
GitOps/cub-scout references
```

Current implementation:

```text
local kind live/e2e receipts for top-20
optional cub-scout object-set, workload, and prerequisite receipts in live run dirs
workerless observation guidance
```

Roadmap surfaces, not current commands in this repo:

```text
cub observe
cub target observe
GitOps compatibility reports
hook/lifecycle receipts
upgrade and rollback receipts
```

ConfigHub stores desired/config truth and submitted observation receipts.
Runtime claims depend on fresh receipts from GitOps controllers, cub-scout, CI,
operators, or human-triggered checks.

## Stage 6 - Scale, Maintenance, And Commercial Lanes

The scale lane keeps the public proof honest and identifies work that belongs in
managed or commercial product workflows.

Artifacts:

```text
root CATALOG.md
per-chart CATALOG.md
top500 catalog analysis
catalog promotion review
production disposition lane
legacy patch review
latest top-20 refresh snapshot
latest top-20 candidate proofs
wave-2 variant work orders
commercial support-tier guidance
```

Current implementation:

```text
generated and verified corpus outputs
top-20 supported for local/test scope
latest-version refresh before catalog roll-forward
100 proof-grade packages
top-500 planning analysis
```

Roadmap surfaces, not current commands in this repo:

```text
cub catalog search/show/install
managed private import
managed overlay import
patch and lifecycle intelligence workflows
```

The public catalog proves the method on popular charts. Managed workflows extend
the same method to private charts, overlays, old versions, hooks, production
windows, and fleet operations.

## Roadmap Tracking

The user docs explain the model and the current evidence. The execution queue
and issue mirror live in planning docs:

| Planning file | Use it for |
| --- | --- |
| [Next 20 Tasks](../planning/next-20-tasks.md) | Prioritized workstream queue. |
| [Issue Backlog](../planning/issue-backlog.md) | Current issue mirror and capability roadmap. |
| [Current Handover](../planning/current-handover.md) | Current status for another engineer or agent. |

The original proof gates for Redis, schemas, effective values, generated facts,
capability profiles, top-N harness, freshness, and upgrade/rollback receipts
are closed and verified by the current harness. The remaining work is mostly
productization and coverage depth: importer/analyzer/preflight/proof/scan
surfaces, derived-variant Creator flows, production decisions, and live lanes.

## Summary

Helm remains the chart source. `helm-expt` proves a durable path from public
Helm charts to `cub installer` recipes, ConfigHub variants, rendered object
sets, scans, gates, receipts, and live observations.

The harness proves this today with 20 top charts and 100 recipe/package
artifacts. The next product work is importer/analyzer/preflight/proof/scan
support in `cub installer` and Creator flows over `cub variant create`.

## Doctrine Checkpoints

```text
If it changes Helm render inputs, object shape, object count, or lifecycle
semantics, route through cub installer.
If it refines already-rendered ConfigHub Units through approved post-render
fields, facts, links, targets, gates, functions, or checks, use cub variant
create plus guided variant creation.
If it depends on live cluster state, require target facts, preflight,
lifecycle receipts, or fresh observations.
If it is chart-specific pain, record it in helm-pain-report.yaml.
If it is a general pattern, put it in the maintained product guidance.
```
