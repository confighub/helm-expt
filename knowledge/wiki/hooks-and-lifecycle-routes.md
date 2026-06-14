---
title: Hooks And Lifecycle Routes
status: current
last_reviewed: 2026-06-14
---

# Hooks And Lifecycle Routes

Helm hooks are not silently treated as ordinary static YAML. The catalog
inventories hook and hook-like behavior, then names the route.

The main dispositions are:

- `observed`: the behavior has live evidence.
- `routed`: the route is named, but execution is not automatically claimed.
- `per-target`: the chart needs a target-specific decision.
- `refused`: the behavior is not supported by the config-only path.
- `todo`: the route is not complete yet.

The useful user question is: where does this behavior go, and who runs it? The
answer may be installer preflight, Argo sync wave/job, operator action,
ConfigHub target fact, post-apply observation, or a refusal with a named reason.

No route should imply automatic hook execution unless the product executes it
and there is evidence for that execution.

## Authoritative Sources

- [Lifecycle routes summary](../../data/lifecycle-routes/summary.md)
- [Lifecycle routes contract](../../data/lifecycle-routes/contract.md)
- [Hook lifecycle strategy](../../docs/user/hook-lifecycle-strategy.md)
- [What hook support means](../../docs/reference/what-hook-support-means.md)
- [Helm quirk support matrix](../../docs/reference/helm-quirk-support-matrix.md)

