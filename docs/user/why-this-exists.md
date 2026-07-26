# Why this exists

**UNOFFICIAL/EXPERIMENTAL.**

A fair skeptic asks one question first: *isn't this just `helm template` with a wrapper
around it?* Here is the honest answer.

For three jobs, the catalogue is more than you need. To inspect a chart's output, use
`helm template`. To load already-rendered files or a literal OCI bundle into ConfigHub,
use `cub variant upload`. To bring in an estate you already run, start with discovery
or import. Reach for those.

This repo is for a different job: turning a popular Helm chart into something you can
trust across a fleet. Not a raw render — a package and record that are **reviewed,
named, reusable, and supportable**, with variants you can compare, checks you can gate
on, receipts you can cite, and a clean handoff to Argo or Flux. The wrapper is not
there to hide Helm. It is there to make Helm's output durable, comparable, and
auditable — to turn one install into something you can still reason about a year and a
thousand installs later.

That is the simplification: the command is just how you start. The operating model is a
declarative source of record for what the fleet should run. Most settings should be
decided and hardened when the package is built. The few choices left for install time
should be small, typed, and restricted, so a cluster or customer can opt into the right
shape without reopening the whole Helm values surface.

Parity with Helm is not the product benefit by itself. It is the migration
assurance check: before ConfigHub adds value, the user needs to know that the
ConfigHub path did not quietly change the starting objects. The product value is
what becomes possible after that check: recorded render inputs, explicit
variants, safer upgrade review, policy gates, GitOps handoff, observations, and
operations on visible desired state.

A one-shot upload only becomes durable when its source inputs are captured.
For Helm that means chart source, version, release name, namespace, values
files, `--set` flags, capability assumptions, and generated facts. For AICR it
means the recipe, component versions, remaining inputs, generated bundle, and
checksums. The source-neutral base-variant record keeps those facts beside the
literal objects.

## Not A Replacement For The Fast Paths

`helm template` is the fast local render path. Use it when the user wants
to inspect what a chart produces, debug values, or create a regular Helm
baseline without a ConfigHub server connection.

`cub variant upload` is the fast ConfigHub action path. Use it when the user
has rendered files or a literal configuration OCI and wants ConfigHub Units
now.

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

Command routing:

| Need | Use |
| --- | --- |
| Render and inspect Helm output locally. | `helm template` |
| Load rendered files or a literal OCI bundle into ConfigHub Units now. | `cub variant upload <files-or-oci-ref>` |
| Maintain a reviewed, variant-aware catalog entry. | `cub installer` recipe/package path |
| Graduate a chart render into that catalog path. | future `cub installer import helm` |
| Bring existing Argo CD or Flux apps under ConfigHub visibility. | `cub gitops discover` / `cub gitops import` |
| Bring KRM YAML or rendered manifests under ConfigHub visibility. | `cub unit import` or managed import workflow |

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

The result should feel less like an imperative install sequence and more like a record
that can be reconciled. One-time bootstrap commands are useful. Repeated upgrades should
come from a known package release, an allowed input schema, and ConfigHub records that say
which clusters, customers, or environments should receive it.

## Why Not Just Render And Import?

Render-and-import is enough for a local experiment. It is not enough for a
catalog or supported operational flow.

The catalog path adds:

| Need | What this repo adds |
| --- | --- |
| Repeatability | Source locks, dependency locks, package paths, named bases, and rendered digests. |
| Reviewability | Stable ConfigHub Units with labels, upstream links, scans, gates, and receipts. |
| Variant clarity | A hard distinction between base variants and derived ConfigHub variants. |
| Small install surface | Most chart settings are fixed in the package; the remaining inputs should be explicit and restricted. |
| Fleet record | A durable desired record for which package, base, inputs, target, and variant each fleet member should run. |
| Promotion | Clone/link/preserve upstream provenance instead of copying YAML by hand. |
| GitOps handoff | OCI artifact plus controller/runtime proof, not just "we rendered YAML." |
| Support | Catalog status, maintenance expectations, and known blockers. |

Future bridgeless import work can replace parts of the substrate. It should not
remove the need for the model above. The desired product story is stable even
if the implementation path changes from `cub installer` to direct import.

## The Human UX We Want

The current `cub variant create` support makes the downstream variant part of
this story concrete. The command clones an uploaded reviewed Space and its
Units into a linked downstream Space. It is not the polished Creator UX, but it
is the current substrate for the derived-variant path.

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

For exact current syntax, see
[cub Variant Command Surface](./cub-variant-command-surface.md).

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

## Where The Recommended Values Live

The recommended Helm values are not generated at install time by a hidden
recommendation engine. They are explicit recipe artifacts for each reviewed
base variant.

Each recipe records:

```text
variants/<name>/variant.yaml
  the named install shape and render controls

effective-values*.yaml
  the Helm values profile used to render that shape
```

For example, Prometheus `server-only-ephemeral` has:

```text
recipes/prometheus-community/prometheus/29.8.0/
  effective-values-server-only-ephemeral.yaml
  variants/server-only-ephemeral/variant.yaml
```

The variant file points at the values profile:

```yaml
spec:
  valuesProfile: "../../effective-values-server-only-ephemeral.yaml"
```

The values profile is stored at recipe root because it is recipe-level proof
evidence: it can be hashed, compared, reused, and cited by revisions and
receipts. The variant directory stores the named variant control file and any
variant-specific artifacts.

That folder split is easy to miss. The human wording should be:

```text
Variant = the named install shape.
Values profile = the Helm inputs used to produce that install shape.
The variant points to the values profile.
```

Derived ConfigHub variants should normally keep the same reviewed values
profile, because they do not rerender Helm. If a request needs new Helm values,
it belongs in the base-variant path. If it changes target, labels, gates, fact
bindings, or approved post-render fields, it belongs in the derived-variant
path.

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

## Where this sits in the Helm ecosystem

[Artifact Hub](https://artifacthub.io/) and [Helm](https://helm.sh/) solve
discovery and tooling, and this project builds on both: every catalog chart
comes from a public upstream repository you can find on Artifact Hub, and
every render is plain Helm output. What neither upstream provides as a
complete catalog-level workflow is the proof layer used here. Artifact Hub's
"verified publisher" badge verifies who controls a repository — by design,
not whether a chart renders, installs, or runs. Helm supports chart
installation, templating, release management, and related verification
features, but it does not by itself create this catalog's per-chart,
per-variant proof receipt chain. That open seat is the one this catalog
takes: receipts for rendering, upload, live application, observation, and
parity — re-runnable by anyone, with refusals published alongside passes.
Discovery tells you what exists; the proof layer tells you what is
demonstrated, and exactly how far each demonstration goes.
