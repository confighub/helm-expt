# Day-2: how upgrade and rollback work

**UNOFFICIAL/EXPERIMENTAL.** What happens when you change a running app — and how to undo
it. The contrast is an opaque `helm upgrade` versus a **staged, reviewed, rehearsed,
observed** change.

## The Helm baseline (what we're improving on)

`helm upgrade` re-renders and applies in one opaque step; you see the result *after* it
lands. If a hook or a bad value breaks it, you find out live. See
[helm-pain-points](helm-pain-points.md) and a real failure in
[helm-upgrade-crash-example](helm-upgrade-crash-example.md).

## The cub path — four checkpoints

1. **Re-render the new base** → a new recipe (new Unit revisions). Same render parity as a
   fresh install.
2. **Diff before applying.** Compare desired-vs-desired *and* desired-vs-live, field-level,
   with no controller in the loop (`cub-scout compare three-way --dry-from`). This is the
   **rehearsal** — you see exactly what changes. ([cub-scout-diff-design](cub-scout-diff-design.md))
3. **Apply through the OCI bundle.** Argo / Flux / kubectl pull the new bundle. What lands
   is *the diff you reviewed*, not a surprise. ([cub-deployment-path](cub-deployment-path.md))
4. **Observe.** Receipts confirm the new state is actually live and healthy — not just
   "synced." ([why-synced-is-not-working](why-synced-is-not-working.md))

## Rollback

Units are **versioned**. Rollback = re-publish the previous Unit revision to the OCI
bundle; the controller reconciles back to it. Because the previous desired state is kept as
**config** (not an opaque Helm release blob), a rollback is a config revert — reviewable
like any other change, with the same diff + receipt path.

## Honest disposition

- A preview is a *preview*, not a guarantee the apply will converge.
- Some upgrades carry **irreversible** steps (a data/schema migration hook). Those are
  **routed and flagged** — surfaced as an explicit action, never silently run — so an
  un-clean rollback is a known chart property, not a hidden trap.
  ([chart-hooks-what-happens](chart-hooks-what-happens.md))

→ deeper: [how-it-works](how-it-works.md) · [helm-upgrade-crash-example](helm-upgrade-crash-example.md) ·
[cub-scout-diff-design](cub-scout-diff-design.md) · [why-synced-is-not-working](why-synced-is-not-working.md)
