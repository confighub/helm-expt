# GitOps adopter guide (Argo, Flux, and the one OCI bundle)

**UNOFFICIAL/EXPERIMENTAL.** For teams already running Argo CD or Flux: what changes — and
what doesn't — when you deliver through ConfigHub's OCI bundle.

## What stays the same

You keep your controller. Argo stays Argo; Flux stays Flux. They pull and reconcile exactly
as they do today. **No new runtime in the apply path.**

## What changes — the source

Instead of pointing the controller at a git repo of Helm values (re-rendered downstream,
with drift between tools), you point it at **one OCI bundle** ConfigHub publishes from
reviewed Units. Every controller pulls the **same bytes** — no per-tool re-render.
([cub-deployment-path](cub-deployment-path.md))

## Argo CD

An `Application` whose `source.repoURL` is the OCI URL (`oci://.../oci`), path `./<space>`.
Synced / Healthy as usual. **Proven** end-to-end (render → ConfigHub → OCI → Argo → runtime).

## Flux

An `OCIRepository` at the same URL + a `Kustomization`. Same bundle, same credentials (the
copied secret). **Proven** — committed receipt (`runs/oci-hook-delivery-proof/receipt.yaml`):
Flux pulled the same OCI bundle and ran the routed hook.

## No controller (cub-direct)

`oras` / `kubectl` can pull and apply the same bundle — it isn't Argo/Flux-specific. Handy
for a one-shot apply or a CI step. **Proven** — same receipt: `oras pull` of the same
artifact + `kubectl apply` ran the routed hook with no controller.

## vs. raw Helm-through-Argo

Argo's native Helm support re-renders the chart *inside* Argo, with hooks as Argo
PreSync/PostSync. The cub path renders **once** (proven parity) and routes hooks
**explicitly** — so what Argo applies is reviewed config-as-data, and hooks aren't silent
sync-phase surprises. ([chart-hooks-what-happens](chart-hooks-what-happens.md))

## Hooks under GitOps

A Helm hook becomes an **explicit route**, not an inherited Argo/Flux hook. You can still
automate it — wire your own PostSync/test step — but **knowingly**, with a receipt.
([pathway-route-hooks-transparently](pathway-route-hooks-transparently.md))

→ deeper: [how-it-works](how-it-works.md) · [cub-deployment-path](cub-deployment-path.md) ·
[chart-hooks-what-happens](chart-hooks-what-happens.md) · [doctrine](../../tests/doctrine.md)
