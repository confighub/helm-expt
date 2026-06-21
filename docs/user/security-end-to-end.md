# Security end to end (secrets, credentials, RBAC, scanning)

**UNOFFICIAL/EXPERIMENTAL.** One throughline — *no silent privileged step* — across the
four places security shows up on the cub path.

## 1. App secrets (your app's own Secrets)

Three honest modes, never a guess:
- **Generated** — the chart renders a Secret into the recipe (visible in the Units).
- **Existing** — you pre-provide it; the recipe references it (an existing-secret base).
- **Target fact** — staged as a prerequisite input. ([target-prerequisites](target-prerequisites.md))

If a Secret is required and missing, it's a **named prerequisite**, not a silent default.

## 2. Delivery credentials (OCI pull auth)

Pulling the OCI bundle needs registry credentials (`confighub-oci-creds`). Provisioned for
Argo by `cub-lk`; **copied** (re-namespaced) for Flux — never printed, logged, or passed on
a command line. A wrong/missing format produces a **named error**, never a silent
unauthenticated pull. ([cub-deployment-path](cub-deployment-path.md))

## 3. Permissions (RBAC)

A chart's RBAC objects (ServiceAccounts, Roles, RoleBindings) are part of the **proven
object set** — render parity shows *exactly* what permissions an install grants, **before**
it lands. A privileged hook is a **route** (visible, `automatic: false`), not a hidden
imperative step. ([chart-hooks-what-happens](chart-hooks-what-happens.md))

## 4. Scanning + adversarial testing

Charts run through scan lanes plus **two** adversarial lanes:
- **F — deliberate breakers** (a skeptic trying to break it).
- **G — careless-dev randomness** (the `--set` footgun: across 180 random bad decisions,
  Helm caught ~1% at render, ~66% were silently absorbed, ~33% leaked to the API).

Findings get an **honest disposition**, never buried. ([test map](../../tests/README.md) ·
[doctrine](../../tests/doctrine.md))

## The throughline

Every privileged or sensitive step is **visible before it runs** — *rendered* (RBAC, a
generated Secret), *staged* (a target fact), *routed* (a hook), or surfaced as a *named
error* (a missing credential). Never silent.

→ deeper: [how-it-works](how-it-works.md) · [cub-deployment-path](cub-deployment-path.md) ·
[target-prerequisites](target-prerequisites.md) · [chart-hooks-what-happens](chart-hooks-what-happens.md)
