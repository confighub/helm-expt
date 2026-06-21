# If My Chart Has Hooks, What Happens?

**UNOFFICIAL/EXPERIMENTAL.**

Short answer: the catalog renders your chart's objects **without running its Helm
hooks**, and records — for each hook or hook-like behavior — a *route*: where it
goes, who runs it, and what evidence exists. A route being **known** is not the
same as it being **run for you**. Today nothing is executed automatically; the
catalog makes the plan legible and checkable, for you and for an agent.

## What a route tells you

- **Where it goes** — a lifecycle phase: `pre-render`, `preflight`, `pre-apply`,
  `post-apply`, `observe`, or `refuse`.
- **Who runs it** — you, your cluster/controller, or (not yet) the product.
- **Whether it's automatic** — `automatic` stays `false` until the product runs
  the route and a receipt proves it. So far it is `false` for every route.
- **What's needed next** — the target facts to supply, and the evidence required
  before the route can be called supported.

Each behavior carries a disposition: `observed` (route plus a live receipt),
`routed` (route known, not run), `per-target` (a target decision is required),
`blocked` (a prerequisite or evidence is missing), or `refused` (deliberately
not run).

The machine-readable form is
[data/lifecycle-route-actions/](../../data/lifecycle-route-actions/summary.md):
an agent reads `actions.json` and turns a row into a preflight/action/observe
plan. The route contract behind it is
[data/lifecycle-routes/](../../data/lifecycle-routes/summary.md). The **per-chart** view —
each chart's routes, disposition, `automatic: false`, and whether a skill applies — is
[data/per-chart-hooks/](../../data/per-chart-hooks/summary.md) (colored cards in
`by-chart.html`).

## What you actually do

1. **Read the chart's routes.** If a behavior is `observed`, it has a receipt
   for the supported scope. If it is `routed`, `blocked`, or `per-target`, the
   route is named but you (or your GitOps controller) set it up — the catalog
   tells you the phase, the action kind, and the facts to supply.
2. **Supply the required target facts** (Secrets, CRDs, storage, and so on).
3. **Run the named action** (a preflight job, a CRD apply, a post-apply check).
   The catalog gives a *placeholder* command, not a verified one.
4. The behavior becomes `observed` for your scope once you capture a receipt.

## Worked examples

### cert-manager / External Secrets — `observed`

cert-manager's `startupapicheck` post-install hook becomes a **post-apply API
dry-run / readiness check**, and CRD ownership is a **per-target** decision (a
base ships the CRDs, or the cluster owns them). External Secrets has no Helm
hook, but its controller populates Secret data and a webhook CA bundle after
apply — a post-apply observation. Both are **observed**, with receipts, in the
[cert-manager / ESO lifecycle lane](../../data/lifecycle-observations/cert-manager-eso/summary.md).
(These are not in the hook-disposition source yet, so they do not have action
packets — they are shown here until that source is folded in.)

### Consul UI Ingress — `per-target`

Exposing the Consul UI is a **per-target** decision, not an automatic step:
whether and how to route ingress depends on your platform, and Consul's
controller health is still a `watch` item. The catalog **names the decision**
rather than guessing or claiming it is done.

### A hook that stays `routed`, not automatic

`bitnami/kafka`'s provisioning Job is a `post-install` / `post-upgrade` hook
routed as a managed action — but its live status is **blocked** (pinned image
tags no longer resolve upstream), so its action packet is `blocked`,
`automatic: false`. The route is known; it is not run for you. The packet says
exactly that, with the blocker and the evidence required to advance.

## The honest boundary

A known route is not an executed one. `automatic` is `false` for every route
today. The value now is **legibility**: you — or an agent — can see where each
hidden behavior goes and what it needs, instead of reverse-engineering Helm.
Making the product *execute* observed/routed steps is separate, continuing work
([#688](https://github.com/confighub/helm-expt/issues/688)).

## See also

- [hook-lifecycle-strategy.md](./hook-lifecycle-strategy.md) — the canonical hook
  treatment and disposition vocabulary.
- [schemas/lifecycle-route-action.schema.json](../../schemas/lifecycle-route-action.schema.json)
  — the action-packet schema.
