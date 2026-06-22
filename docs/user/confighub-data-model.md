# The ConfigHub data model (the words this all uses)

**UNOFFICIAL/EXPERIMENTAL.** The vocabulary the rest of *how it works* assumes — short
definitions and how the pieces fit. If a term elsewhere is unfamiliar, it's probably here.

## The pieces

- **Chart base** — a chart pinned to a version + a values preset (e.g.
  `bitnami/nginx@24.0.2 / default`). The thing you render.
- **Recipe** — the *exact* Kubernetes objects a base renders to (the render-parity claim).
  Ordinary desired-state config — nothing imperative.
- **Unit** — ConfigHub's atom of desired state: one piece of config, **versioned and
  diffable**, living in a space. A recipe becomes a set of Units.
- **Space** — a named container for Units (a project / environment boundary). You create a
  space, then put Units in it.
- **Component** — the logical thing being configured and shipped: an app, service,
  platform package, or deployable capability such as `payments-api`, `redis`, or
  `ingress-nginx`. Today, Component is represented by standard metadata rather than a
  separate first-class API entity. It groups the configuration that belongs to the same
  product family.
- **Variant** — one named configuration instance of a Component. A **base variant** is a
  render-time Helm/recipe install shape. A **derived ConfigHub variant** is a clone of a
  reviewed configuration instance with approved post-render refinements applied, with no
  Helm re-render. ([creating-variants](creating-variants.md))
- **Target** — *where* Units are delivered. The **OCI target** (`<space>/oci`) publishes the
  Units as an OCI artifact for a controller to pull.
- **Worker** — the agent that services a target (e.g. the OCI worker `cub-lk` installs) —
  it turns Units into the published bundle.
- **OCI bundle** — the single published artifact (`oci://oci.hub.confighub.com/.../oci`)
  that **every** consumer (Argo / Flux / kubectl) pulls. ([cub-deployment-path](cub-deployment-path.md))
- **Target fact** — an input the chart needs that isn't in the YAML (an existing secret, a
  CRD, a storage class, cloud identity). **Staged, not guessed.**
  ([target-prerequisites](target-prerequisites.md))
- **Route / lifecycle action** — a non-recipe step (a hook, a CRD install) made **explicit,
  named, and receipted**; `automatic: false`. ([chart-hooks-what-happens](chart-hooks-what-happens.md))
- **Receipt** — the typed evidence that a step or proof actually happened (the *observe*
  layer). `watch ≠ pass`.

## How they fit (one line)

> chart base → **render** → recipe → becomes **Units** in a **space** → published to an
> **OCI bundle** via a **target** (serviced by a **worker**) → pulled + applied by Argo /
> Flux / kubectl → non-recipe bits run as **routes** → everything proven with **receipts**.

## Component and variant families

ConfigHub should not force people to reason only about individual Kubernetes objects. A
Component lets a person or tool see one logical app, service, platform package, or
workload family. Variants are the named configuration instances inside that family:

```text
Component: payments-api

Variants:
  payments-api/base
  payments-api/dev
  payments-api/staging
  payments-api/prod-us
  payments-api/prod-eu
```

This is what makes higher-level questions possible:

- what changed between the base and prod-us variant;
- which variants are downstream of this base;
- whether a base change can promote to staging but not prod yet;
- which target facts or overrides make prod-eu different;
- whether an AI-assisted change stayed inside the approved variant boundary.

Caveat: Component is currently mostly a grouping concept. Variant has stronger behavior
because `cub variant create` and `cub variant promote` give it upstream/downstream clone
and promotion semantics.

→ deeper: [how-it-works](how-it-works.md) · [cub-deployment-path](cub-deployment-path.md) ·
[direct-cub-helm-model](../reference/direct-cub-helm-model.md) ·
[target-prerequisites](target-prerequisites.md)
