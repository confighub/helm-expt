# Security end to end (secrets, credentials, RBAC, scanning)

**UNOFFICIAL/EXPERIMENTAL.** One throughline — *no silent privileged step* — across the
four places security shows up on the cub path.

## 1. App secrets (your app's own Secrets)

The catalog records which mode a preset uses:

- **Existing Secret** — the recommended preset names a Secret that the target
  must provide.
- **Generated for a local run** — `cub installer` keeps the rendered Secret in
  its local `out/secrets` directory and does not upload it as a ConfigHub Unit.
- **Target fact** — the required Secret or secret manager binding is staged as
  a prerequisite input. ([target-prerequisites](target-prerequisites.md))

If a Secret is required and missing, it's a **named prerequisite**, not a silent default.

## 2. Delivery credentials (OCI pull auth)

Pulling a private ConfigHub Space release needs registry credentials
(`confighub-oci-creds`). `cub cluster up` installs them for Argo CD. The Flux
proof copies the same credential into `flux-system` without printing it,
logging it, or passing it on a command line. A wrong or missing credential
produces a named error. ([cub-deployment-path](cub-deployment-path.md))

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
