# Creating Variants

**UNOFFICIAL/EXPERIMENTAL**

This guide explains how a Helm user should think about variants in this
project.

There are two variant stages. A **base variant** is the rendered install shape
created by `cub installer`. A **derived ConfigHub variant** starts from a
reviewed uploaded base and applies approved post-render refinements without
running Helm again. If those names feel similar, use this rule first:

```text
Helm render inputs or object shape change -> base variant.
Approved post-render fields, facts, links, targets, gates, or checks change -> derived ConfigHub variant.
```

There are three common situations:

```text
Helm needs to render a different object set or lifecycle shape.
  Use a cub installer base variant.

The reviewed object set is being refined after render.
  Use a derived ConfigHub variant.

The artifact is ready, but Kubernetes or GitOps needs something else first.
  Record or satisfy the delivery prerequisite before OCI delivery.
```

## Choose The Path First

| What the user wants | Use | Example |
| --- | --- | --- |
| a different Kubernetes object set | `cub installer` base variant | `prometheus/server-only-ephemeral`, `redis/reuse-existing-secret` |
| the same reviewed objects in a new operating context | derived ConfigHub variant | `prometheus/server-only-ephemeral -> prod-us-east` |
| something Kubernetes needs before it can use the artifact | delivery prerequisite | existing Secret, CRD owner, StorageClass, Argo/Flux pull credentials |

This choice should be visible before the user sees detailed receipts or proof
data. Receipts matter, but the first UX question is simply where the change
belongs.

## Variant File And Values Profile

A base variant usually has two related files:

| File | Meaning |
| --- | --- |
| `variants/<name>/variant.yaml` | The named install shape: recipe pointer, namespace, release name, values profile, capability profile, hook policy, and other variant-level controls. |
| `effective-values*.yaml` | The captured Helm values profile used to render that install shape. |

For example, Prometheus `server-only-ephemeral` is split like this:

```text
recipes/prometheus-community/prometheus/29.8.0/
  effective-values-server-only-ephemeral.yaml
  variants/server-only-ephemeral/variant.yaml
```

The `variant.yaml` file points at the values profile:

```yaml
spec:
  valuesProfile: "../../effective-values-server-only-ephemeral.yaml"
```

The values profile contains the Helm inputs that make this install shape
different from the default Prometheus render, such as disabling Alertmanager,
exporters, pushgateway, and persistence. The variant file gives that rendered
shape a name and records the surrounding render controls.

The files live in different folders because values profiles are recipe-level
proof artifacts. A recipe can hash, compare, reuse, and cite them across
variants and revisions. The variant directory is for the named variant's
control file and variant-specific artifacts.

Derived ConfigHub variants usually should not create a new `effective-values`
file, because they do not rerender Helm. If the user needs different Helm
values, route back to a base variant. If the user keeps the same reviewed
object set and changes target, labels, gates, fact bindings, or approved
post-render fields, use a derived ConfigHub variant.

## Base Variants

A base variant is a reviewed install shape produced by `cub installer`.

Use a base variant when Helm must render a different object set, object shape,
or lifecycle behavior.

Common examples:

- turn chart components on or off;
- change storage, ingress, TLS, CRDs, RBAC, webhooks, args, env, object count,
  or topology;
- change replica or HA settings when they alter topology, chart branches,
  services, PDBs, storage, or lifecycle behavior;
- switch between generated Secret mode and existing Secret mode when the
  rendered references differ;
- apply a Helm values file or `--set` flag that changes Helm template output
  or object shape;
- apply a Kustomize overlay or post-renderer that materially changes the
  install shape;
- use a wrapper chart, umbrella chart, platform values, or customer overlay
  values that change the Helm-rendered object set.

Examples:

```text
redis/default
redis/reuse-existing-secret
prometheus/default
prometheus/server-only-ephemeral
```

The important point is simple: if Helm needs to re-evaluate chart templates, or
if the object count, object shape, dependencies, or lifecycle behavior changes,
make that difference visible in a base variant.

## Derived ConfigHub Variants

A derived ConfigHub variant starts from a reviewed uploaded base. It does not
run Helm again.

Use a derived variant when the reviewed object set can be cloned and refined
with approved post-render changes over ConfigHub Units.

Common examples:

- environment, region, customer, or target;
- replica count when it is an approved edit to an already-rendered workload
  field;
- namespace when the base exposes it as a post-render field;
- ConfigHub labels, annotations, views, links, and ownership;
- approval gates and operation policy;
- observation policy and freshness expectations;
- target fact bindings such as Secret names, hosted zones, endpoint IDs, or
  account IDs when the base already exposes those references;
- placeholder, parameter Unit, or TransformPaths fills over existing fields;
- PostClone trigger or function mutations selected by the source Space, with
  checks and MutationSources receipts.

Example:

```text
prometheus/server-only-ephemeral
-> prometheus/prod-us-east
```

The production variant keeps the same Prometheus install shape. It may change
target, labels, namespace fields, fact bindings, gates, links, checks, and
observation policy through the Creator contract.

## Delivery Prerequisites

Before OCI publication or GitOps sync, the artifact should already represent
the reviewed desired state for that target.

Settle these before delivery:

- selected base variant;
- selected derived ConfigHub variant, if the deployment needs one;
- required existing Secret, StorageClass, IngressClass, namespace, CRD, API, or
  webhook;
- generated password, certificate, random value, or time-derived value;
- scan and gate status;
- hook, CRD, webhook, and lifecycle decision;
- approval state;
- OCI digest, signature, and access method;
- Argo CD or Flux configuration that will consume the OCI artifact.

Do not publish a generic artifact and rely on an untracked cluster patch to make
it correct later.

## Human Flow

The user-facing flow should be short and concrete.

Example:

```text
Create variant
From: prometheus/server-only-ephemeral
For: prod-us-east
Change: target, environment, region, production gates, observation policy
Review: same Prometheus install shape, approved post-render production refinements
Status: ready to create
Create
```

The first screen should show the route and the visible changes. Details such as
object digests, Unit counts, links, scans, and receipts should be available in
a details view, audit view, or verification output.

Current building blocks:

```text
cub installer setup
cub installer upload
cub variant create
ConfigHub Units, Spaces, labels, links, gates, functions, and receipts
```

The current CLI primitive is:

```sh
cub variant create prod-us-east helm-prometheus-server-only \
  --environment Prod \
  --region us-east \
  --space-name-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}'
```

That command clones the upstream Space and Units, sets the downstream Space
labels to `Variant=prod-us-east`, `Environment=Prod`, and `Region=us-east`, and
links the cloned Units back to their upstream Units. Add `--target
<target-slug>` only when the target already exists. Cloned Units keep their
source base labels unless a post-clone trigger or later bulk update changes
them.

Current live target-bound example:

```text
nginx/http-clusterip
-> NGINX-prod-us-east
```

That example starts from a clean uploaded NGINX base Space, runs
`cub variant create --target`, applies the cloned workload Units to a ConfigHub
OCI target, and lets Argo CD reconcile the derived Space into Kubernetes. The
receipt is:

```text
runs/derived-variant-target-bound/nginx-prod-us-east/receipt.yaml
```

The example deliberately excludes `installer-record` from the workload apply.
That Unit is installer support metadata, not a Kubernetes object for the
workload artifact.

A future/polished [Creator flow](../reference/variant-creation-artifact.md#creator-status)
should make those building blocks easy to use. It should not introduce a
separate variant system.

## AI Assistant Flow

An AI assistant should receive the same request as structured work.

Example:

```yaml
task: create_derived_variant
from:
  component: Prometheus
  variant: server-only-ephemeral
  space: helm-prometheus-server-only
blueprint: environment-clone
parameters:
  variant: prod-us-east
  environment: Prod
  region: us-east
  target: monitoring-targets/prod-us-east
allowedChanges:
  - space labels
  - target assignment
  - approval gates
  - target fact bindings
  - allowed TransformPaths fills
  - observation policy metadata
checks:
  - no Helm rerender
  - install shape preserved
  - mutation paths reviewed
  - upstream links preserved
  - Unit count preserved
```

If the requested change requires Helm to re-evaluate templates, changes the
object count or install shape, or touches fields outside the approved
post-render contract, the assistant should route the work back to the
`cub installer` base path.

## Bulk Creation Flow

The same creation pattern should also work across many environments, regions,
or customers.

Example:

```yaml
createVariantsFrom:
  component: Prometheus
  variant: server-only-ephemeral
  space: helm-prometheus-server-only
rows:
  - variant: prod-us-east
    environment: Prod
    region: us-east
    target: monitoring-targets/prod-us-east
  - variant: prod-eu-west
    environment: Prod
    region: eu-west
    target: monitoring-targets/prod-eu-west
checks:
  - no Helm rerender for every row
  - every mutation path is allowed by the Creator contract
  - each downstream Space keeps Component=Prometheus
  - every row has a target and observation policy
```

This keeps the human flow, AI assistant flow, and bulk flow aligned without
making the human flow complicated.

## Routing Examples

| Request | Route |
| --- | --- |
| "Install Redis with a generated password." | Select the `redis/default` base variant. |
| "Install Redis using an existing Secret." | Select the `redis/reuse-existing-secret` base variant if object references differ. |
| "Promote Prometheus server-only to prod-us-east." | Create a derived ConfigHub variant from `prometheus/server-only-ephemeral`. |
| "Disable Prometheus Alertmanager." | Create or select a `cub installer` base variant. |
| "Add production approval gates." | Create a derived ConfigHub variant. |
| "Fill a namespace or Secret reference already exposed by the base." | Create a derived ConfigHub variant with target facts, TransformPaths, checks, and receipts. |
| "Change the StorageClass." | Usually create a base variant and record the target fact. |
| "Use customer overlay values for a wrapper chart." | Follow the custom overlay flow: classify values, create a reviewed base, then derive environment or customer variants. |
| "Point Argo CD or Flux at the result." | Configure delivery after the reviewed base or derived variant is ready. |

## What To Read Next

- [Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md)
- [cub Variant Command Surface](./cub-variant-command-surface.md)
- [Custom Overlays](./custom-overlays.md)
- [Customization Algorithm](../reference/customization-algorithm.md)
- [Prometheus Overlay And Promotion Example](./prometheus-overlay-promotion-example.md)
- [Product Support Tiers For Helm Scenarios](./product-support-tiers.md)
- [Variant Creator Reference](../reference/variant-creation-artifact.md)
