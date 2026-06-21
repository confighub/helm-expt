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
- **Variant** — a customized copy. A **base variant** is a different values preset of the
  same chart; a **derived (ConfigHub) variant** is a clone of a space's Units with overlays
  applied — *no Helm re-render*. ([creating-variants](creating-variants.md))
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

→ deeper: [how-it-works](how-it-works.md) · [cub-deployment-path](cub-deployment-path.md) ·
[direct-cub-helm-model](../reference/direct-cub-helm-model.md) ·
[target-prerequisites](target-prerequisites.md)
