# Choosing Base Variants, Derived Variants, And Delivery Changes

**UNOFFICIAL/EXPERIMENTAL**

This document explains which changes belong in a `cub installer` base variant,
which changes belong in a derived ConfigHub variant, and which checks or
bindings must be completed before publishing an OCI artifact for Kubernetes
delivery.

For the short guide to creating variants through human, AI assistant, and bulk
flows, see
[Creating Variants](./creating-variants.md).

## Three Decisions

Before delivery, ask three questions in order.

### 1. Does This Change Rendered Kubernetes Objects?

If yes, use a `cub installer` base variant.

Base variants are render-time install shapes. They are created from Helm chart
inputs, values, overlays, capability profiles, target facts, generated facts,
and lifecycle policy. They produce a new rendered object set.

Use a base variant for:

- enabling or disabling chart components;
- changing replicas, storage, ingress, TLS, RBAC, CRDs, webhooks, args, env, or
  object count;
- choosing generated Secret versus existing Secret mode when the rendered
  objects differ;
- applying a Helm values file or `--set` input that changes output YAML;
- applying a Kustomize overlay or post-renderer that changes output YAML;
- selecting a wrapper chart, umbrella chart, platform values, or customer
  overlay values that change output YAML;
- changing hook or lifecycle policy that affects what must happen at install,
  upgrade, test, or delete time.

The output is a reviewed rendered revision with equivalence checks, scans,
gates, and receipts.

Example:

```text
prometheus/default
prometheus/server-only-ephemeral
```

`server-only-ephemeral` disables bundled components and persistence. Those
objects disappear from the render, so it is a base variant.

### 2. Does This Only Change How A Reviewed Object Set Is Operated?

If yes, use a derived ConfigHub variant.

Derived variants start from an uploaded reviewed base or another derived
variant. They clone ConfigHub Spaces and Units, preserve upstream links, and
apply allowed post-render changes without running Helm again.

Use a derived variant for:

- environment, region, customer, or target assignment;
- labels and annotations used by ConfigHub views, filters, ownership, or
  promotion;
- approval gates, delete/destroy gates, and operation policy;
- observation policy and freshness expectations;
- links between Units and external inputs;
- placeholder or TransformPaths fills where the rendered fields already exist;
- narrow ConfigHub function changes that are approved for this component and do
  not change the install shape unexpectedly.

The output is a downstream ConfigHub Space and Unit set that can be reviewed,
published, approved, applied, and observed.

Example:

```text
prometheus/server-only-ephemeral
-> prometheus/prod-us-east
```

The production variant changes target, labels, gates, and observation policy.
It keeps the same Prometheus rendered object shape.

### 3. What Must Be Settled Before OCI Delivery?

OCI delivery should publish the reviewed object set that Kubernetes or GitOps
will consume. Anything that changes those objects must be captured before the
artifact is published.

Before OCI delivery, settle:

- selected base variant;
- any derived ConfigHub variant that changes target, labels, gates, links, or
  delivery policy for this deployment;
- effective values and overlay digests;
- target fact bindings such as existing Secret name, StorageClass, IngressClass,
  CRD/API availability, or namespace expectation;
- generated fact bindings for generated passwords, certificates, random values,
  or time-derived values;
- capability profile such as Kubernetes version and API set;
- hook, CRD, webhook, and lifecycle disposition;
- rendered-object scans and gates;
- approval state;
- OCI artifact identity, digest, signature, and access method;
- GitOps controller configuration that points at the OCI artifact.

Some prerequisites may live outside the OCI artifact but still need explicit
evidence before delivery. Examples include an existing Secret, a required CRD
owner, a StorageClass, an IngressClass, a GitOps pull Secret, or an Argo/Flux
controller in the target cluster.

## Quick Routing Table

| User request | Route | Why |
| --- | --- | --- |
| "Use this values file." | Base variant unless proven to fill existing fields only. | Values commonly change rendered objects. |
| "Disable Alertmanager in Prometheus." | Base variant. | Object set changes. |
| "Promote this reviewed Prometheus install to prod-us-east." | Derived ConfigHub variant. | Operating context changes; render shape stays the same. |
| "Use an existing Redis Secret." | Base variant if Secret mode changes rendered objects; derived variant only when the base already exposes the reference. | Secret material stays outside public proof, but object references must be explicit. |
| "Change namespace, target, environment, or region labels." | Derived ConfigHub variant. | ConfigHub operating metadata. |
| "Add a Kustomize patch that changes a Deployment field." | Base variant or approved recipe overlay. | OCI artifact must contain the changed object. |
| "Set approval gates and observation freshness." | Derived ConfigHub variant before delivery. | Delivery and operation policy. |
| "Run a Helm post-install hook." | Lifecycle policy plus hook/lifecycle receipt. | Hook execution depends on the target cluster. |
| "Point Argo CD or Flux at the artifact." | Delivery configuration. | The component object set is already published; GitOps consumes it. |

## The OCI Boundary

After OCI publication, the artifact should be treated as the reviewed desired
object set. Do not rely on an untracked GitOps patch, manual cluster edit, or
post-render script to make it correct after publication.

If a change must alter Kubernetes objects, send it back to the `cub installer`
base path and publish a new artifact. If a change only selects how the reviewed
object set is operated, make it a derived ConfigHub variant and publish or
apply that reviewed variant.

## User-Facing Wording

The product should explain the route plainly:

```text
This changes the Kubernetes objects, so it needs a new installer base.
```

or:

```text
This keeps the same Kubernetes objects and changes the operating context, so it
can be a ConfigHub variant.
```

or:

```text
This is a delivery prerequisite. It must be satisfied or recorded before the
OCI artifact is used by Kubernetes.
```
