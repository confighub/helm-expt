# Creating Variants

This guide explains how a Helm user should think about variants in this
project.

There are three common situations:

```text
The Kubernetes objects need to change.
  Use a cub installer base variant.

The Kubernetes objects stay the same, but the target or operating rules change.
  Use a derived ConfigHub variant.

The artifact is ready, but Kubernetes or GitOps needs something else first.
  Record or satisfy the delivery prerequisite before OCI delivery.
```

## Base Variants

A base variant is a reviewed install shape produced by `cub installer`.

Use a base variant when Helm must render different Kubernetes objects.

Common examples:

- turn chart components on or off;
- change replicas, storage, ingress, TLS, CRDs, RBAC, webhooks, args, or env;
- switch between generated Secret mode and existing Secret mode when the
  rendered references differ;
- apply a Helm values file or `--set` flag that changes the rendered YAML;
- apply a Kustomize overlay or post-renderer that changes the rendered YAML;
- use a wrapper chart, umbrella chart, platform values, or customer overlay
  values that change the rendered YAML.

Examples:

```text
redis/default
redis/reuse-existing-secret
prometheus/default
prometheus/server-only-ephemeral
```

The important point is simple: if the YAML Kubernetes will receive is different,
make that difference visible in a base variant.

## Derived ConfigHub Variants

A derived ConfigHub variant starts from a reviewed uploaded base. It does not
run Helm again.

Use a derived variant when the Kubernetes object shape stays the same and the
change is about where or how the reviewed objects are operated.

Common examples:

- environment, region, customer, or target;
- ConfigHub labels, annotations, views, links, and ownership;
- approval gates and operation policy;
- observation policy and freshness expectations;
- filling an existing field that the reviewed base already exposes.

Example:

```text
prometheus/server-only-ephemeral
-> prometheus/prod-us-east
```

The production variant keeps the same Prometheus install shape. It changes the
target, labels, gates, and observation policy.

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
Review: same Prometheus install shape, new production operating context
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

The polished Creator flow should make those building blocks easy to use. It
should not introduce a separate variant system.

## AI Assistant Flow

An AI assistant should receive the same request as structured work.

Example:

```yaml
task: create_config_only_variant
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
  - observation policy metadata
checks:
  - no Helm rerender
  - rendered object digest unchanged
  - upstream links preserved
  - Unit count preserved
```

If the requested change touches rendered Kubernetes fields, the assistant should
route the work back to the `cub installer` base path.

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
  - rendered object digest is unchanged for every row
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
| "Change the StorageClass." | Usually create a base variant and record the target fact. |
| "Use customer overlay values for a wrapper chart." | Follow the custom overlay flow: classify values, create a reviewed base, then derive environment or customer variants. |
| "Point Argo CD or Flux at the result." | Configure delivery after the reviewed base or derived variant is ready. |

## What To Read Next

- [Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md)
- [Custom Overlays](./custom-overlays.md)
- [Customization Algorithm](./customization-algorithm.md)
- [Prometheus Overlay And Promotion Example](./prometheus-overlay-promotion-example.md)
- [Product Support Tiers For Helm Scenarios](./product-support-tiers.md)
- [Variant Creator Reference](../reference/variant-creation-artifact.md)
