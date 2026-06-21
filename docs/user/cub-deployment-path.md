# How deployment works on the cub path (ConfigHub → OCI → your controller)

**UNOFFICIAL/EXPERIMENTAL.** What actually happens when you deploy a chart through
ConfigHub — the steps, the **OCI transport**, and how **credentials** are handled.
The delivery tool (Argo, Flux, or none) is your choice; the artifact is the same.

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
   - **No controller (cub-direct)** — `cub` / `kubectl` pulls the same bundle and applies it.
5. **Quirks run as explicit routes.** Hooks, CRD installs, and other non-recipe behavior
   are **not** in the bundle — they are separate, named, receipted lifecycle actions
   (see [chart-hooks-what-happens.md](chart-hooks-what-happens.md) and the hooks doctrine).

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

## Honest status (what's proven vs. in progress)

- **Argo from ConfigHub OCI — proven.** End-to-end receipt: `render → ConfigHub → OCI →
  Argo (Synced / Healthy) → runtime (workload ready)`. This is the G/P lane (see the
  status dashboard and live-parity surfaces).
- **Flux from ConfigHub OCI, and cub-direct (no controller) — intended; proof in progress.**
  The `OCIRepository` and cub-direct paths are being validated on a throwaway cub-lk rig.
  Until a committed receipt exists, they are documented here as the **design**, not a claim
  — per the doctrine that a route is only "proven" with evidence.

## Try it

```sh
cub auth login
cub plugin install jesperfj/cub-lk
cub lk up --name myrig                      # provisions kind + Argo + the OCI worker
tests/chart-install-test --package packages/bitnami/nginx/24.0.2 --slug nginx \
  --namespace nginx --rig myrig --json      # cub installer → ConfigHub → OCI → Argo, with a receipt
cub lk down --name myrig --force
```
