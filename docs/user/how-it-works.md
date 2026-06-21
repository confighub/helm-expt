# How it works

**UNOFFICIAL/EXPERIMENTAL.** The whole system is **four moves** — *render → route →
deliver → observe* — plus how you customize, promote, and operate over time. This page
is the map; each link goes deeper.

## The mental model

1. **Render** — turn a chart into the *exact* Kubernetes objects (the **recipe**).
2. **Route** — everything that is *not* in the recipe (hooks, CRD installs, target facts,
   `lookup()`, …) becomes an **explicit, named step** — never silently run.
3. **Deliver** — publish the recipe **once to OCI**; Argo, Flux, or plain `kubectl` all pull
   the **same** bundle.
4. **Observe** — prove it live with **receipts**; report an **honest disposition**, never
   "just green."

---

## 1. Render — the recipe
`cub installer` renders a chart base into the same objects `helm template` produces, proven
object-for-object by render parity.
→ [direct-cub-helm-model](../reference/direct-cub-helm-model.md) ·
[reading-the-matrix](reading-the-matrix.md) · [chain-of-proof](chain-of-proof.md)

## 2. Route — everything not in the recipe
Hooks, CRD installs, target facts, lookups — anything that does not survive a config-only
render is a **routed quirk**: visible, named, receipted, and never silently executed. The
standing rules are in the [doctrine](../../tests/doctrine.md).
→ [chart-hooks-what-happens](chart-hooks-what-happens.md) ·
[pathway-route-hooks-transparently](pathway-route-hooks-transparently.md) ·
[change-routing-before-oci](change-routing-before-oci.md) ·
[hook-lifecycle-strategy](hook-lifecycle-strategy.md) ·
[target-prerequisites](target-prerequisites.md)

## 3. Deliver — one OCI bundle, your choice of controller
ConfigHub publishes the Units once as an OCI artifact; Argo (`Application`), Flux
(`OCIRepository`), or `cub`/`kubectl` all pull the same bytes. Includes the credentials
story (OCI pull creds vs app secrets).
→ [cub-deployment-path](cub-deployment-path.md)

## 4. Observe — receipts, honest disposition
Live proof, lane by lane; `watch ≠ pass`; render parity ≠ live-ready; we say what we
**refuse** to claim. The full testing model is the [test map](../../tests/README.md).
→ [verification-lanes](verification-lanes.md) · [outcomes-and-tests](outcomes-and-tests.md) ·
[what-we-refuse-to-claim](what-we-refuse-to-claim.md) · [live-parity](live-parity.md) ·
[why-synced-is-not-working](why-synced-is-not-working.md)

---

## Customize + promote (variants)
Base variants vs derived ConfigHub variants, overlays, and promotion across environments.
→ [creating-variants](creating-variants.md) ·
[derived-variant-walkthrough](derived-variant-walkthrough.md) ·
[custom-overlays](custom-overlays.md) · [extension-slots](extension-slots.md) ·
[cub-variant-command-surface](cub-variant-command-surface.md)

## Day-1 — preview, dry-run, drift
See desired-vs-live *before* you apply; understand why "synced" isn't "working."
→ [cub-scout-diff-design](cub-scout-diff-design.md) ·
[reverse-reconcile-design](reverse-reconcile-design.md) ·
[why-synced-is-not-working](why-synced-is-not-working.md)

## Day-2 — upgrade, rollback, maintenance
How an opaque Helm upgrade becomes staged, reviewed, rehearsed, and observed; refresh and
support over time.
→ [helm-upgrade-crash-example](helm-upgrade-crash-example.md) ·
[remote-images-and-supported-bases](remote-images-and-supported-bases.md) ·
[maintenance-sla](maintenance-sla.md)

## Secrets + credentials
Two separate concerns: **delivery** creds (OCI pull, copied not printed) and your **app's**
Secrets (generated vs existing vs staged target fact).
→ [cub-deployment-path](cub-deployment-path.md) · [target-prerequisites](target-prerequisites.md)

## Why this exists / why it holds
The Generative GitOps thesis, the Helm pain points it answers, and why it doesn't collapse
under hooks/quirks/volume.
→ [why-this-exists](why-this-exists.md) · [generative-gitops-fit](generative-gitops-fit.md) ·
[why-this-does-not-collapse](why-this-does-not-collapse.md) · [helm-pain-points](helm-pain-points.md)

## Free vs managed
What's public and free to try, and where ConfigHub Server / managed workflows begin.
→ [offering](offering.md) · [what-you-get](what-you-get.md) ·
[product-support-tiers](product-support-tiers.md)

## Get started
→ [choose-your-path](choose-your-path.md) · [choosing-commands](choosing-commands.md) ·
[first-run-walkthrough](first-run-walkthrough.md) · [try-now](try-now.md) ·
[tutorial-sequence](tutorial-sequence.md)
