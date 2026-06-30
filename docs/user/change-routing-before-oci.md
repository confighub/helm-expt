# Choosing Presets, Derived Variants, And Delivery Changes

**UNOFFICIAL/EXPERIMENTAL**

This document explains where a Helm change belongs before delivery.

The public word is **preset**. The repo word is **base variant**. Use a preset
when the change asks Helm to render a different shape. Use a derived ConfigHub
variant when the rendered shape is already right and you are changing the
operating context after render.

For the short guide to creating variants through human, AI assistant, and bulk
flows, see
[Creating Variants](./creating-variants.md).

## Three Decisions

Before delivery, ask three questions in order.

### 1. Does This Change Helm Render Inputs Or Object Shape?

If yes, use a catalog preset / `cub installer` base variant.

Presets are render-time install shapes. They are created from Helm chart
inputs, values, overlays, capability profiles, target facts, generated facts,
and lifecycle policy. They produce a new reviewed rendered object set.

The catalog does not claim to support every values combination. It supports
useful chart-specific presets and records the values, generated output, and
evidence for each one.

Use a preset for:

- enabling or disabling chart components;
- changing storage, ingress, TLS, RBAC, CRDs, webhooks, args, env, object count,
  topology, or lifecycle behavior;
- changing replica or HA settings when they alter topology, chart branches,
  services, PDBs, storage, or lifecycle behavior;
- choosing generated Secret versus existing Secret mode when the Helm render or
  object shape differs;
- applying a Helm values file or `--set` input that changes chart branches,
  object shape, object count, or lifecycle behavior;
- populating raw manifest, `tpl`, sidecar, config-block, or application config
  extension slots such as `extraDeploy`, `serverBlock`, or extra scrape config;
- applying a Kustomize overlay or post-renderer that materially changes the
  install shape;
- selecting a wrapper chart, umbrella chart, platform values, or customer
  overlay values that change the Helm-rendered object set;
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
objects disappear from the render, so it is a preset/base variant.

### 2. Does This Refine A Reviewed Object Set After Render?

If yes, use a derived ConfigHub variant.

Derived variants start from an uploaded reviewed base or another derived
variant. They clone ConfigHub Spaces and Units, preserve upstream links, and
apply allowed post-render changes without running Helm again. They can cover
more than metadata when the source base and Creator contract explicitly allow
the changed paths, facts, functions, and checks.

Use a derived variant for:

- environment, region, customer, or target assignment;
- replica count when it is an approved edit to an already-rendered workload
  field;
- namespace or release-name fields when the base exposes them for post-render
  fill;
- labels and annotations used by ConfigHub views, filters, ownership, or
  promotion;
- approval gates, delete/destroy gates, and operation policy;
- observation policy and freshness expectations;
- links between Units and external inputs;
- target facts such as existing Secret names, hosted zones, endpoint IDs,
  account IDs, StorageClasses, or IngressClasses;
- placeholder, parameter Unit, or TransformPaths fills where the rendered
  fields already exist;
- narrow ConfigHub function changes that are approved for this component and do
  not change the install shape unexpectedly;
- MutationSources and receipts that explain every post-render field change.

The output is a downstream ConfigHub Space and Unit set that can be reviewed,
published, approved, applied, and observed.

Example:

```text
prometheus/server-only-ephemeral
-> prometheus/prod-us-east
```

The production variant can change target, labels, gates, fact bindings,
approved field fills, checks, and observation policy. It keeps the same
Prometheus install shape and does not rerender Helm.

### 3. What Must Be Settled Before OCI Delivery?

OCI delivery should publish the reviewed desired state that Kubernetes or GitOps
will consume. Helm-rendered bases and derived post-render refinements must both
be captured before the artifact is published or applied.

Before OCI delivery, settle:

- selected preset/base variant;
- any derived ConfigHub variant that changes target, fields, facts, labels,
  gates, links, checks, or delivery policy for this deployment;
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
| "Use this values file." | Preset/base variant unless proven to fill already-rendered fields only. | Values commonly change Helm template branches, object shape, or object count. |
| "Disable Alertmanager in Prometheus." | Preset/base variant. | Object set changes. |
| "Promote this reviewed Prometheus install to prod-us-east." | Derived ConfigHub variant. | The install shape stays the same; production fields, facts, gates, links, and policy are reviewed after clone. |
| "Use an existing Redis Secret." | Preset/base variant if Secret mode changes object shape; derived variant only when the base already exposes the reference. | Secret material stays outside public proof, but object references must be explicit. |
| "Change namespace, target, environment, or region labels." | Derived ConfigHub variant. | These can be cloned, filled, linked, checked, and receipted without rerendering Helm when the base exposes the right fields. |
| "Add a Kustomize patch that changes a Deployment field." | Usually preset/base variant or approved recipe overlay; derived only for a narrow approved post-render field. | Broad patches belong in the reviewed rendered artifact; narrow fills need MutationSources and receipts. |
| "Set approval gates, target facts, and observation freshness." | Derived ConfigHub variant before delivery. | Delivery and operation policy. |
| "Run a Helm post-install hook." | Lifecycle policy plus hook/lifecycle receipt. | Hook execution depends on the target cluster. |
| "Point Argo CD or Flux at the artifact." | Delivery configuration. | The component object set is already published; GitOps consumes it. |

## The OCI Boundary

After OCI publication, the artifact should be treated as the reviewed desired
object set. Do not rely on an untracked GitOps patch, manual cluster edit, or
post-render script to make it correct after publication.

If a change requires Helm to render different objects, send it back to the
`cub installer` preset/base path and publish a new artifact. If a change is an
approved post-render refinement of the reviewed object set, make it a derived
ConfigHub variant and publish or apply that reviewed variant.

## User-Facing Wording

The product should explain the route plainly:

```text
This changes Helm render inputs or object shape, so it needs a new chart preset.
```

or:

```text
This keeps the same install shape and applies approved post-render fields,
facts, links, targets, gates, or checks, so it can be a derived ConfigHub
variant.
```

or:

```text
This is a delivery prerequisite. It must be satisfied or recorded before the
OCI artifact is used by Kubernetes.
```
