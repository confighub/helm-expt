# Brian Entry: Why This Exists

**UNOFFICIAL/EXPERIMENTAL**

This page answers the skeptical first question:

```text
How is this better than cub helm install or cub gitops import?
Isn't it just helm template plus a wrapper?
What is the wrapper and machinery for?
How do you expect this to be used?
```

The short answer is:

```text
For a one-off install, cub helm install or a direct GitOps import should be simpler.

This repo is about the catalog/proof/product path:
turn a popular Helm chart into a reviewed, named, reusable, supportable
ConfigHub model with variants, checks, receipts, promotion, GitOps handoff, and
maintenance expectations.
```

## Not A Replacement For The Fast Path

`cub helm install` is the fast action path. Use it when the user wants to point
at a chart and get objects installed or rendered now.

`cub gitops import` should be the natural path when the user already has a
GitOps source and wants ConfigHub to understand or manage it.

This repo is not trying to make those flows more complicated. It is trying to
answer a different set of questions:

```text
Which install shapes are recommended?
What exactly do those shapes render?
Are they equivalent to Helm?
Which changes are base variants and which are post-render variants?
What can be promoted safely across environments?
What was scanned, approved, applied, observed, and supported?
```

## What The Wrapper/Machinery Is For

Yes, the first step often resembles `helm template`: render the Helm chart and
inspect the resulting Kubernetes objects.

The machinery exists because the useful product object is not a raw render. It
is a reviewed model around the render:

```text
chart/version/source lock
recipe/package
named base variants
exact rendered object set
Helm-equivalence proof
scan and gate receipts
generated/target fact handling
ConfigHub Space and Unit upload
upstream links between variants
Creator contract for safe derived variants
OCI/GitOps delivery proof
runtime observation receipt
catalog status and maintenance SLA
```

That wrapper should not hide Helm. It should make Helm's output durable,
comparable, searchable, promotable, and auditable.

## Why Not Just Render And Import?

Render-and-import is enough for a local experiment. It is not enough for a
catalog or supported operational flow.

The catalog path adds:

| Need | What this repo adds |
| --- | --- |
| Repeatability | Source locks, dependency locks, package paths, named bases, and rendered digests. |
| Reviewability | Stable ConfigHub Units with labels, upstream links, scans, gates, and receipts. |
| Variant clarity | A hard distinction between base variants and derived ConfigHub variants. |
| Promotion | Clone/link/preserve upstream provenance instead of copying YAML by hand. |
| GitOps handoff | OCI artifact plus controller/runtime proof, not just "we rendered YAML." |
| Support | Catalog status, maintenance expectations, and known blockers. |

Future bridgeless import work can replace parts of the substrate. It should not
remove the need for the model above. The desired product story is stable even
if the implementation path changes from `cub installer` to direct import.

## The Human UX We Want

The current CLI exposes implementation steps:

```text
setup
render
upload
clone space
set labels
set target
add gates
run checks
record receipts
```

The human-facing story should be simpler:

```text
Take this reviewed base.
Extend it with x and y.
Show me what changes.
Create it if checks pass.
Record proof of what happened.
```

For example:

```text
Create variant
From: Prometheus/server-only-ephemeral
For: prod-us-east
Extend with: target, environment, region, production gates, observation policy
Review: same Prometheus install shape, changed ConfigHub fields only
Status: ready to create
Create
```

Underneath, that can still map to a formal
[Variant Creator contract](../reference/variant-creation-artifact.md#creator-status),
YAML/object roles, AX tasks, FX functions, `cub variant create`, ConfigHub
links, checks, and receipts.

## The Important Boundary

Do not classify every Helm value change as an installer/base variant.

Use this rule:

```text
If the change alters Helm chart branches, object count, object shape, topology,
dependencies, or lifecycle semantics, route it to a reviewed base variant.

If the change edits an already-rendered field that the base and Creator
contract allow, route it to a derived ConfigHub variant or Day-2 operation.
```

Replica count is the good example:

```text
replicas: 1 -> 2 on an existing Deployment field
  can be an approved post-render ConfigHub operation.

replicas / HA mode that changes StatefulSet topology, PDBs, services,
anti-affinity, storage, or chart branches
  belongs in a base variant.
```

The product should explain this boundary before showing CLI commands.

## Expected Use

Use this repo as:

```text
a proof catalog for popular Helm charts
a source of reviewed base variants
a place to test derived ConfigHub variants
a recipe for turning wrapper/customer overlays into managed imports
a way to show GitOps/runtime receipts
a pressure test for Creator UX, AX, FX, and formal contracts
```

Do not use it as:

```text
the simplest possible one-off Helm install path
a claim that every chart behavior is production-supported
a finished Creator GUI
a final bridgeless import design
```

The next product move should be to make the Creator-style story first-class:
human intent first, formal contract underneath, current CLI primitives as the
execution substrate.
