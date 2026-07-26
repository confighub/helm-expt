# How deployment works on the cub path (ConfigHub → OCI → your controller)

**UNOFFICIAL/EXPERIMENTAL.** What actually happens when you deploy a chart through
ConfigHub: the steps, the **OCI transport**, and how **credentials** are handled.
For one approved release, Argo CD, Flux, or the direct path can consume the same
artifact.

## The path, end to end

1. **Render.** `cub installer` turns a chart base into the exact Kubernetes objects —
   the same set `helm template` produces, proven object-for-object by the render-parity
   lane. This is the *recipe*: ordinary desired-state config.
2. **Desired state.** Those objects become **ConfigHub Units** in a space — reviewable,
   diffable, versioned.
3. **Publish to OCI.** ConfigHub publishes the Units as a single **OCI artifact**
   (`oci://oci.hub.confighub.com:443/target/<space>/oci`). This is the one transport —
   nothing downstream re-renders from git or local files.
4. **Apply.** A delivery agent pulls that OCI artifact and applies it to the cluster:
   - **Argo CD** — an `Application` whose `source.repoURL` is the OCI URL.
   - **Flux** — an `OCIRepository` at the same URL + a `Kustomization`.
   - **No controller (cub-direct)** — the managed cub-direct applier pulls the same
     bundle and applies it without a GitOps controller.
5. **Quirks run as explicit routes.** Hooks, CRD installs, and other non-recipe behavior
   are **not** in the bundle — they are separate, named, receipted lifecycle actions
   (see [chart-hooks-what-happens.md](chart-hooks-what-happens.md) and the hooks doctrine).

## cub-direct is managed apply, not bare apply

The no-controller path is useful for a quick run or a controlled one-shot delivery, but a
plain `kubectl apply` is not enough for safe first install and upgrade behavior. The managed
cub-direct applier must handle three things that plain apply does not:

| Adoption caveat | Managed path |
| --- | --- |
| CRDs and custom resources in the same bundle | Apply CRDs first, wait for them to establish, then apply the rest. |
| Upgrade removes a resource | Prune removed objects with a safe selector/allowlist, or use a controller that owns prune. |
| Manual live edit creates a server-side-apply conflict | Show a plain reconcile choice instead of a raw Kubernetes conflict: keep live, accept desired, or force with receipt. |

If a chart has CRDs or you are upgrading a long-lived app, Argo or Flux is usually the
cleaner path because the controller already owns ordering, prune, and reconciliation loops.
The cub-direct path is still valid, but it should be the managed applier path rather than
an unmanaged `kubectl apply` transcript.

## Why OCI — one bundle, every consumer

ConfigHub publishes **once** to OCI; Argo, Flux, and a plain `kubectl` all pull the **same**
artifact. You pick the delivery tool; the bytes are identical. Re-rendering from git or
local files would be a *different* artifact — so the cub path always sources from the OCI
bundle, never a re-render.

## Credentials — two separate kinds

**1. OCI pull credentials (delivery auth).** Pulling from the ConfigHub OCI registry needs
registry credentials:
- cub-lk provisions a `confighub-oci-creds` secret into the **Argo** namespace automatically.
- For **Flux**, the *same* secret is **copied** into the flux namespace (by re-namespacing
  its YAML); `OCIRepository.secretRef` points at the copy.
- **Security posture:** the credential moves **cluster-internally, by copy** — it is never
  printed to a terminal, written to a log, or passed on a command line. If the secret's
  format isn't what a consumer expects, that consumer reports a named error (an honest
  failure) — it never silently runs unauthenticated.

**2. Application secrets (your app's own Secrets).** A *different* concern from delivery
auth. A chart's Secret is either **generated** (rendered into the bundle) or **existing**
(you pre-provide it — an existing-secret base, or a staged *target fact*). These belong to
the recipe + target facts, not the OCI pull credentials. See
[target-prerequisites.md](target-prerequisites.md).

## What the live delivery test proves

A small routed-hook fixture was published once as a ConfigHub release OCI. Argo
CD, Flux, and direct apply each pulled that artifact on a throwaway test cluster.
The workload was applied and the hook completed under all three. The committed
receipt is `runs/oci-hook-delivery-proof/receipt.yaml` (summary:
[../../data/oci-hook-delivery-proof/summary.md](../../data/oci-hook-delivery-proof/summary.md)):

- **Argo CD (OCI `Application`) passed.** `render -> ConfigHub -> OCI -> Argo -> runtime`.
- **Flux (`OCIRepository` + `Kustomization`) passed.** The OCI pull Secret was copied into `flux-system` and was never printed.
- **cub-direct (no controller) passed.** The same OCI artifact can be
  applied without a controller, and the managed applier proof covers CRD ordering, prune,
  and product-readable server-side-apply conflicts.

This proves the delivery mechanism for that fixture. It does not prove that
every catalog base has been delivered through all three paths. A chart or other
catalog configuration has controller-delivery proof only when its own page
links to a receipt for that exact configuration.

For direct apply, use the managed applier when CRDs, upgrades, or manual live
edits are in scope.

## Try it

```sh
cub auth login
cub plugin install jesperfj/cub-lk
cub lk up --name myrig                      # provisions kind + Argo + the OCI worker
tests/chart-install-test --package packages/bitnami/nginx/24.0.2 --slug nginx \
  --namespace nginx --rig myrig --json      # cub installer → ConfigHub → OCI → Argo, with a receipt
cub lk down --name myrig --force
```
