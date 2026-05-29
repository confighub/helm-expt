# ConfigHub Promotion Mapping Doctrine

This document explains how the Helm recipe story joins up with ConfigHub's
component and promotion model.

This is a **background proof and implementation document**. It is not a new
user-facing step in the happy path. Users should see charts, variants, diffs,
checks, and ConfigHub components. The machine-readable mapping exists so the
repo, CLI, GUI, and agents can prove they are all using the same component and
promotion model.

The short version:

```text
cub install creates reviewed ConfigHub component bases.
cub variant create creates downstream ConfigHub variants from those bases.
ConfigHub Promotion shows and advances changes across those variants.
```

This is the bridge between the Helm catalog and the existing ConfigHub GUI.

## Doctrine

The same component should be traceable through every layer:

```text
Helm chart / wrapper release
-> cub install package base
-> rendered Kubernetes objects
-> ConfigHub Units in a base Space
-> ConfigHub variant Spaces
-> Promotion graph and diff/upgrade/apply workflow
```

The user should not have to learn this ladder. The user should see:

```text
Create Redis prod-us-east from Redis default.
Preview differences.
Run checks.
Create.
Promote later changes safely.
```

The system needs the ladder so the workflow is deterministic, auditable, and
machine-checkable.

## Mapping Contract

| Helm / installer concept | ConfigHub concept | Required mapping |
| --- | --- | --- |
| Chart or wrapper chart | Component identity | Space and Unit label `Component=<name>` |
| Package base | Base Space | Space label `Variant=<base>` and no production target unless deliberately assigned |
| Package variant that changes render inputs | New rendered base | New `cub install` render/upload, not a post-render clone |
| Reviewed rendered object | Unit | One Unit per rendered object, plus installer record where present |
| Server-side variant | Downstream Space | Created by `cub variant create`, with `Variant`, `Environment`, `Region`, target, gates, and metadata |
| Promotion edge | Upstream Unit link | Downstream Units have `UpstreamUnitID` pointing to source Units |
| Production target | Target assignment | Units have `TargetID`; Space may carry the target annotation for UX |
| Variant customization | Post-render mutation | Placeholders, TransformPaths, functions, links, MutationSources, and receipts |
| Release proof | Receipts | Render, scan, clone, mutation, approval, apply/publish, and observation receipts |

The minimum identity labels are:

```text
Component
Owner
Environment
Region
Variant
HelmChart
HelmChartVersion
```

For Helm-derived catalog entries, Units should also retain enough labels or
annotations to answer:

```text
Which recipe/package produced this?
Which package base was rendered?
Which chart version and digest were used?
Which rendered object digest was approved?
```

## Redis Example

Start with the rendered and uploaded base:

```text
Space: helm-redis-default
Labels:
  Component=Redis
  Variant=default
  Environment=Catalog
  Owner=ConfigHubHelm

Units:
  Component=Redis
  HelmChart=bitnami-redis
  HelmChartVersion=25.5.3
  Variant=default
```

Create a production variant:

```sh
cub variant create prod-us-east helm-redis-default \
  --environment Prod \
  --region us-east \
  --target redis-prod/cluster \
  --space-name-pattern "template:{{.Labels.Component}}-{{.Labels.Variant}}" \
  --unit-delete-gate production-review \
  --unit-destroy-gate production-review
```

Expected ConfigHub shape:

```text
Component: Redis
Base node: default
Deployment node: prod-us-east
Edge: default -> prod-us-east
```

ConfigHub Promotion can then show:

```text
base changed
prod-us-east is behind
field diffs are visible
upgrade applies the upstream Unit revisions into prod-us-east
apply/publish sends the approved result to the target
```

## Boundary Rule

Use recipe/package bases when the choice changes Helm-rendered objects:

```text
generated Secret vs existing Secret
CRDs on/off
HA/storage mode
ingress/TLS object shape
cloud-provider Helm values
wrapper chart + customer overlay values
anything requiring a Helm render
```

Use ConfigHub variants when the choice refines already-rendered Units:

```text
target
environment
region
namespace when represented as a post-render field
labels and annotations
secret references
links
placeholders
policy gates
approval state
observation requirements
```

If a requested Variant Creator choice would require a different rendered object
set, the Creator must route the user back to the recipe/package path. It should
not hide a Helm rerender inside a post-render promotion.

## Current ConfigHub Fit

Current ConfigHub already has the main substrate:

| Existing piece | What it contributes |
| --- | --- |
| `cub variant create` | Clones a source Space into a downstream Space, copies Units, sets labels/target/metadata/gates, and preserves upstream links. |
| `Space.Labels.Component` | Groups spaces into one component in the Promotion UI. |
| `Space.Labels.Variant` | Names the node shown in the Promotion UI. |
| `Unit.UpstreamUnitID` | Creates the promotion edge and lets the UI compute upgradeability. |
| Bulk unit patch with `upgrade=true` | Advances downstream Units to the upstream revision. |
| Dry-run upgrade | Produces the preview data used for field diffs. |
| Apply / publish operations | Move approved desired state to the declared target. |
| Target annotations | Allow deep links from ConfigHub to Argo, Flux, or other target UIs. |
| PostClone triggers | Run post-clone customization functions. |
| Target facts | Provide target-specific data to trigger/function parameters and checks. |
| MutationSources | Explain which paths functions or links changed. |

The missing product work is porcelain and proof around these primitives.

## Code Changes Needed

### 1. `helm-expt`: define the product contract before adding artifacts

Do not create a new per-chart artifact unless it is consumed by the product
flow, a verifier, an agent workflow, or the ConfigHub UI/CLI. Otherwise it is
just another catalog one-off.

The product contract we need is:

```text
When this recipe/base is uploaded to ConfigHub, what labels, spaces, target
assignments, upstream links, clone behavior, and receipts make it appear as one
manageable component in ConfigHub Promotion?
```

That contract may eventually live in one of three places:

```text
existing artifact-index.yaml fields
a formal Variant Blueprint / VariantCreationPlan
ConfigHub metadata stored with the component/base Space
```

Only add a separate file if those homes are insufficient. If a separate file is
needed later, it should be generated and verified, not hand-written. Its shape
would be:

```yaml
component: Redis
sourceSpace:
  slugPattern: helm-redis-default
  labels:
    Component: Redis
    Variant: default
requiredUnitLabels:
  HelmChart: bitnami-redis
  HelmChartVersion: 25.5.3
variantBlueprints:
  - name: promote-to-production
    allowedFromBases: [default]
    requiredParameters:
      - environment
      - region
      - target
      - namespace
      - redisSecretRef
expectedPromotionGraph:
  source: default
  downstreamKinds: [environment, region, customer]
```

Wherever the contract lives, add verifier coverage so it agrees with:

```text
variant.yaml
variant-revision.yaml
upload receipts
confighub proof transcripts
helm-pain-report.yaml
install-checks.yaml
```

### 2. `installer`: preserve component identity at upload time

`cub install upload` already supports labels. The next step is to make the
catalog path harder to get wrong:

```text
package declares canonical Component, HelmChart, HelmChartVersion, base, and VariantKind
upload applies those labels by default
upload receipts record the labels actually written
verification fails if required labels are missing or inconsistent
```

This keeps the Promotion UI from depending on hand-written label flags in every
demo transcript.

### 3. `confighub` CLI: add blueprint-aware variant porcelain

`cub variant create` exists. Add optional blueprint-aware commands around it:

```sh
cub variant preview --blueprint redis-promote-to-production ...
cub variant check --blueprint redis-promote-to-production ...
cub variant create prod-us-east helm-redis-default --blueprint redis-promote-to-production ...
```

The first implementation can call existing APIs:

```text
bulk clone space
bulk clone units
set labels / annotations / target
run PostClone triggers
run checks/functions
show diff
write receipts
```

No new variant backend is required for v1.

### 4. `confighub` API/server: expose a Variant Blueprint object or unit convention

The UI, CLI, agents, and fleet runners need the same formal plan. Store it as
either:

```text
a typed ConfigHub entity
```

or initially:

```text
an AppConfig/Text Unit in the base Space with a known label/type
```

It must be queryable by component/base and must specify:

```text
allowed source Spaces
required parameters
post-clone labels/annotations/target behavior
placeholder checks
TransformPaths / NeedsProvides links
functions/checks
gates
required receipts
```

### 5. `confighub` GUI: add Variant Creator entry points

Add a guided flow over the current Promotion/Components surface:

```text
Open component
Select base or existing variant
Create variant
Select blueprint
Fill fields
Preview Units, changed paths, links, gates, target facts
Run checks
Create
Show receipts
```

The Promotion page should then show the new Space automatically because it is
already grouped by `Component` and named by `Variant`.

### 6. `confighub` GUI: strengthen promotion review

The Promotion UI should continue to distinguish:

```text
pending upstream promotion
intentional variant difference
unapplied local change
blocked/gated change
live/observed status when available
```

The open promotions-view work points in this direction with cross-variant value
inspection, overridden-upstream indicators, inline field editing, and target
deep links. That work should land only once it passes build/tests and preserves
the mapping contract above.

### 7. Verification: add goldens for UX, AX, and FX

One blueprint must behave the same across:

```text
Human wizard
Agent task
Fleet function
```

Minimum golden:

```text
source: Redis/default
blueprint: promote-to-production
parameters: prod-us-east, namespace, target, redisSecretRef
expected preview: unit count, changed paths, link changes, gates
expected receipts: clone, mutation, checks, approval/apply/observation when used
```

The verifier should fail if:

```text
required labels are missing
the new Space does not appear in the expected component graph
upstream links are missing
preview differs between CLI/API/GUI/fleet surfaces
checks are skipped
receipts are missing or unbound
```

## Why This Is Better

Before this mapping, Helm-derived ConfigHub content could be correct but still
look like loose spaces and units.

With this mapping:

```text
the catalog recipe creates the base
variant creation creates real downstream environments
Promotion shows how they relate
diffs explain what changed
upgrades advance exact reviewed Unit revisions
checks and receipts prove the path
```

That is the promised path from Helm pain to managed ConfigHub components.
