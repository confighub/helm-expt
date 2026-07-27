# Lifecycle Route Action Contract

**UNOFFICIAL/EXPERIMENTAL.** Field definitions and projection rules for
[actions.csv](./actions.csv) / [actions.json](./actions.json), generated with
the data from the same constants so they cannot drift. Machine schema:
[../../schemas/lifecycle-route-action.schema.json](../../schemas/lifecycle-route-action.schema.json).

## Purpose

Turn each legible lifecycle route into a checkable plan a UI or agent can act on
— phase, action kind, required facts, evidence required — while keeping the
honest boundary that a known route is **not** an automatically executed one.

## Columns

| Column | Meaning |
| --- | --- |
| `chart` / `version` / `base` | Subject. |
| `quirk_class` / `route_name` | The route identity, from lifecycle-routes. |
| `disposition` | Executability: `observed`, `routed`, `per-target`, `blocked`, `refused`. |
| `source_disposition` / `source_live_status` | The raw lifecycle-routes values, for traceability. |
| `lifecycle_phase` | `pre-render`, `preflight`, `pre-apply`, `post-apply`, `observe`, `refuse`. |
| `action_kind` | What kind of step it is (see table). |
| `execution_mode` | Who would run it: product-executes / user-executes / target-owned / not-yet-executable. |
| `automatic` | `true` only when `execution_mode` is `product-executes` AND evidence proves it. False otherwise. |
| `required_target_facts` | What the target must supply. |
| `human_command` | A placeholder command (not verified). May be empty. |
| `evidence_required` | What must exist before the row can advance to observed/supported. |
| `source_drift` | Named version drift vs the catalog; empty when none. |
| `evidence_or_next_action` | Receipt path when observed, else the next step. |

`actions.json` adds `alternatives` (off-ramp routes) and `agent_inputs` (the
stable selection block).

## Invariants (enforced by --verify)

1. Every routed/per-target lifecycle route has an action packet.
2. No packet is `automatic: true` without committed evidence — and none is today.
3. `disposition` / `lifecycle_phase` / `action_kind` never drift from the
   published vocabularies above.
4. Version drift is **named** in `source_drift`, never hidden.

## Source disposition crosswalk

lifecycle-routes disposition (+ live status) → action disposition:

| Source | Action disposition |
| --- | --- |
| `observed` | `observed` |
| `per-target` | `per-target` |
| `refused` | `refused` |
| `todo` | `blocked (no recipe/route built yet)` |
| `routed (live_status=blocked)` | `blocked` |
| `routed (live_status=none/other)` | `routed` |

## Route → phase / action kind

| route_name | lifecycle_phase | action_kind |
| --- | --- | --- |
| `recipe-time-lifecycle-verification` | `pre-render` | `verify-render` |
| `preflight-or-presync` | `preflight` | `run-preflight` |
| `target-facts-or-preflight` | `preflight` | `stage-target-facts` |
| `target-class-preflight-and-upgrade-action` | `preflight` | `run-preflight` |
| `preflight-or-presync-crd-apply` | `pre-apply` | `install-crd` |
| `preserve-ordering` | `pre-apply` | `preserve-ordering` |
| `self-contained-crd-base` | `pre-apply` | `preserve-ordering` |
| `upgrade-action-with-receipt` | `pre-apply` | `run-job` |
| `explicit-managed-action` | `post-apply` | `run-job` |
| `argocd-or-flux-lifecycle-hook` | `post-apply` | `gitops-sync-hook` |
| `postsync-check-or-observation` | `post-apply` | `run-check` |
| `explicit-test-check` | `observe` | `run-test` |
| `webhook-readiness-observation` | `observe` | `observe-webhook` |
| `preserve-cleanup-policy` | `observe` | `accept-target-policy` |
| `delete-cleanup-policy` | `observe` | `accept-target-policy` |

(For a `refused` route the phase is `refuse`.)

## Determinism

A pure function of `data/lifecycle-routes/routes.json` and `data/master-catalog-matrix/matrix.csv`. No timestamps, no
network, no cluster. Regenerate with `npm run lifecycle:route-actions`; verify
byte-for-byte plus invariants with `npm run lifecycle:route-actions:verify`.
