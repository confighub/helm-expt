# How The Harness Works

This is the short reviewer-facing explanation of the Helm experiment harness. It
is meant to be easy to explain to Brian, Jesper, and anyone asking how the repo
turns Helm charts into ConfigHub-ready variants.

Important distinction:

```text
These are not user steps.
These are not implementation phases.
These are the proof layers the harness applies across the Helm lifecycle.
```

## One Sentence

```text
The harness turns a Helm chart into a reviewed cub installer package, proves the
rendered objects against Helm, then uses ConfigHub to manage variants,
operations, receipts, and live evidence.
```

## How The Harness Creates User Value

The harness creates value by breaking the Helm lifecycle into manageable stages.
Helm often compresses these stages into one command and a release record. That is
convenient, but it makes review, promotion, scanning, drift, upgrade, and audit
harder than they need to be.

The harness separates the lifecycle like this:

| Helm lifecycle stage | Helm pain | Harness answer | User value |
| --- | --- | --- | --- |
| Discover chart | Popular chart still has hidden behavior. | Catalog entry, chart dossier, pain report, support scope. | User can see known risks before install. |
| Choose install shape | Values files hide intent and variants are ad hoc. | Named installer bases / install variants. | User chooses `default`, `existing-secret`, `no-crds`, HA, etc. deliberately. |
| Add values or overlays | It is unclear whether a change is safe post-render or needs a new render. | Customization rule: rendered-object changes go through `cub installer`; post-render refinements go through ConfigHub variants. | User knows where each customization belongs. |
| Render | Templates, capabilities, `lookup`, generated values, and dependencies are implicit. | Source/dependency locks, effective values, capability profile, target/generated facts. | User can reproduce and explain the render. |
| Compare | Teams trust a values file instead of exact objects. | Helm-equivalence receipt and classified differences. | User approves the Kubernetes objects, not a guess. |
| Review and scan | Raw YAML review is noisy and scans are often detached from the thing installed. | Object inventory, rendered scans, gates bound to manifest digest. | User catches misconfigs on the exact output. |
| Upload/manage | Helm release history is not a governance model. | ConfigHub Units, labels, revisions, links, receipts. | User can diff, search, approve, and audit the config. |
| Create downstream variants | Copying values files across envs loses provenance. | `cub variant create` clone/link plus Creator contract. | User can make env/region/customer variants with preview/checks. |
| Deploy / GitOps handoff | Desired, applied, and live state blur together. | OCI/GitOps handoff plus apply/publish/observation receipts. | User knows what was handed off and what was observed. |
| Observe live state | Freshness decays and workerless systems can overclaim. | cub-scout/GitOps/controller observation receipts with timestamps and TTL. | User knows whether evidence is current. |
| Upgrade / patch / rollback | Helm release-state and chart drift make day-2 risky. | Upgrade/rollback receipts, production dispositions, legacy patch review. | User can manage change as a proven variant revision. |
| Hooks and lifecycle actions | Hooks depend on cluster state and phase. | Hook inventory, lifecycle policy, Argo/GitOps translation where safe, blockers where unsafe. | User sees lifecycle risk instead of discovering it late. |

That is the core value proposition:

```text
Break the Helm lifecycle apart.
Make each part explicit.
Prove each part with the right artifact.
Only then promote or operate it.
```

## What Is Real Today

The repo is no longer only a plan. Current verified evidence includes:

```text
100 recipe/package proof artifacts
20 top-chart catalog entries with bespoke variants
20/20 local kind live/e2e receipts
20/20 ConfigHub upload, scan, safe-ops, and server-side variant receipts
top-500 catalog analysis
20 per-chart Helm pain reports
hook/lifecycle risk estimate for the top-500 scan
```

The remaining work is mostly productization and clearer lanes:

```text
turn repo-proven scripts into cub installer / ConfigHub product surfaces
make import/analyze/preflight/prove/scan first-class
make server-side variant Creator porcelain first-class
add stronger production/GitOps/lifecycle proof where needed
```

## Pass 1 - Chart Intelligence

Question:

```text
What does this chart do, and where is the pain?
```

Inputs:

```text
public chart or wrapper chart
chart version
values / overlays when supplied
dependency closure
target capability assumptions
```

Current repo artifacts:

```text
source lock
dependency lock
effective values
helm-pain-report.yaml
helm-plan.yaml
chart-dossier.yaml
top500 source/catalog analysis
```

Current harness mechanics:

```text
AI-assisted chart analysis plus repo scripts and verifiers
```

Product ask:

```text
cub installer analyze
```

What Brian/Jesper should hear:

```text
This is where Helm's hidden behavior becomes visible before install.
```

## Pass 2 - Recipe And Package Construction

Question:

```text
Can this chart become a durable, reusable installer artifact?
```

Current repo artifacts:

```text
packages/<repo>/<chart>/<version>/installer.yaml
recipes/<repo>/<chart>/<version>/recipe.yaml
variants/<variant>/variant.yaml
install-checks.yaml where available
target fact requirements
generated fact policy
capability profile
```

Current harness mechanics:

```text
repo generators create cub installer packages and chart-specific recipe artifacts
```

Product ask:

```text
cub installer import helm
cub installer preflight
```

What Brian/Jesper should hear:

```text
cub helm install is a one-shot action.
A cub installer recipe/package is the reusable product artifact.
Import is the bridge from the first to the second.
```

## Pass 3 - Render, Compare, And Prove

Question:

```text
Did the cub installer path produce the expected Kubernetes objects?
```

Current repo artifacts:

```text
rendered/release-objects.yaml
rendered/object-inventory.yaml
helm-equivalence-receipt.yaml
render-receipt.yaml
scan-receipt.yaml
install-gate.yaml
variant-revision.yaml
```

Current harness mechanics:

```text
npm run verify
per-chart compare/proof scripts
tamper-detection self-tests
verify-install helpers for user-side Redis checks
```

Product ask:

```text
cub installer compare
cub installer prove
cub installer scan
```

What Brian/Jesper should hear:

```text
The proof unit is the exact rendered object set, not a values file.
```

## Pass 4 - ConfigHub Upload, Governance, And Server-Side Variants

Question:

```text
Once the rendered objects are reviewed, how do teams manage variants and
operations safely?
```

Current repo artifacts:

```text
ConfigHub proof transcripts
upload receipts
function-scan receipts
safe-ops receipts
server-side variant clone receipts
confighub-promotion-map.yaml
Variant Creator contract docs
```

Current harness mechanics:

```text
cub installer upload
cub variant create
cub unit list/data/tree/diff/revision
cub changeset and unit approve/apply/cancel lanes where proven
ConfigHub function scans
```

Product ask:

```text
Creator porcelain over cub variant create:
  preview
  check
  diff
  promote
  update/rebase
  receipts
```

What Brian/Jesper should hear:

```text
cub variant create gives the clone/link substrate.
The missing product layer is a Creator flow that makes the safe path obvious.
```

## Pass 5 - Live, GitOps, And Lifecycle Evidence

Question:

```text
What actually happened after apply or GitOps sync?
```

Current repo artifacts:

```text
local kind observation receipts
production disposition reports
observation freshness SLO
hook lifecycle strategy
GitOps/cub-scout references
```

Current harness mechanics:

```text
local kind live/e2e receipts for top-20
workerless observation doctrine
additional cub-scout lane referenced for deeper runtime proof
```

Product ask:

```text
cub observe / cub target observe
GitOps compatibility reports
hook/lifecycle receipts
upgrade and rollback receipts
```

What Brian/Jesper should hear:

```text
ConfigHub does not pretend to have live truth.
It stores desired/config truth plus fresh observation receipts from GitOps,
cub-scout, CI, controllers, or human-triggered checks.
```

## Pass 6 - Scale, Maintenance, And Commercial Lanes

Question:

```text
Can this scale beyond Redis without becoming benchmark theater?
```

Current repo artifacts:

```text
root CATALOG.md
per-chart CATALOG.md
top500 catalog analysis
catalog promotion review
production disposition lane
legacy patch review
wave-2 variant work orders
commercial support-tier doctrine
```

Current harness mechanics:

```text
generated and verified corpus outputs
top-20 supported for local/test scope
100 proof-grade packages
top-500 planning analysis
```

Product ask:

```text
cub catalog search/show/install
managed private import
managed overlay import
patch and lifecycle intelligence workflows
```

What Brian/Jesper should hear:

```text
The catalog proves the method publicly.
The commercial product applies it to private charts, overlays, old versions,
hooks, production windows, and fleet operations.
```

## Issue Map

Current GitHub issue state as of 2026-05-31:

```text
Open P0:
  #76 Define Helm import path from cub helm install to cub installer recipes

Open docs/story issue:
  #82 Document how helm-expt, ConfigHub, and installer solve Helm pain points

Open P1:
  #11 ConsequencePreview
  #12 GitOpsCompatibilityReport
  #13 CRDCompatibilityReport
  #14 CI/PR comment mode
  #15 Existing Helm release state and upgrade footguns
  #16 Suggested fixes for common Helm pain findings

Open P2:
  #17 shared dossier / HelmPlan index
  #18 field-level governance and ownership
  #19 typed secret reference system
  #20 lifecycle contracts
  #21 enriched value model
  #22 cross-controller consequence engine
  #23 pure serverless cub installer option

Open content issues:
  #52-#59 blog / public explanation sequence
```

The original P0 proof gates for Redis, schemas, effective values, generated
facts, capability profiles, top-N harness, freshness, and upgrade/rollback
receipts are closed and verified by the current harness. The remaining P0 is
about turning the repo-proven import path into a clear product strategy and
future product capability.

## The Clean Brian / Jesper Script

```text
We are not replacing Helm. We use public Helm charts as inputs.

cub helm install is still useful as a fast one-shot action.
helm-expt is proving the durable path:
  chart -> cub installer recipe/package -> variants -> exact rendered objects
  -> scans/gates/receipts -> ConfigHub Units -> server-side variants
  -> live/GitOps observations.

The harness proves this today with 20 top charts and 100 recipe/package
artifacts. What remains is productizing the proven steps: installer import,
analyze, preflight, prove/compare, scan, and Creator porcelain over cub variant
create.
```

## Doctrine Checkpoints

```text
If it changes rendered Kubernetes objects, route through cub installer.
If it refines already-rendered ConfigHub Units, use cub variant create plus the
Creator contract.
If it depends on live cluster state, require target facts, preflight,
lifecycle receipts, or fresh observations.
If it is chart-specific pain, record it in helm-pain-report.yaml.
If it is a general pattern, put it in the harness/product doctrine.
```
