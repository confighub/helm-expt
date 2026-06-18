# cub-scout Diff: One GitOps-Agnostic Differ

**UNOFFICIAL/EXPERIMENTAL - design; the cub-scout field-level diff command is the product piece.**

Day-1 **dry-run** ("what will this change touch?") and day-2 **drift** ("what
differs from desired now?") are the *same* operation: **desired vs live**.
cub-scout already does the boolean form: `object-set-matches` and `drift`.
This design extends it to the **field-level delta** while keeping the desired
side deterministic and independent of the GitOps controller that applied it.

## The architecture

```
  held render-once desired data        live cluster
  (deterministic, no re-render)        (any deliverer)
            \                              /
             \                            /
        server-side dry-run apply
                          |
                 ObjectSetDiffReceipt
        field-level delta + provenance + fleet + authority + residue
```

Two moves make the diff useful for this catalog:

1. **Deterministic desired side** - diff the *held render-once data*, never a
   fresh `helm template`. Preview == apply, every time.
2. **GitOps-tool-agnostic** - cub-scout reads *the cluster + the held data*; it
   does not care who applied. The same diff holds under **Argo, Flux, or
   cub-direct** (both Argo and Flux are already proven in `data/runtime-gitops`).
   You build one differ, not an Argo version and a Flux version.

It also **unifies day-1 and day-2**: the same engine is a *dry-run* pre-apply
(desired-next vs live-now) and *drift* post-apply (desired vs live-now).

## The receipt: `ObjectSetDiffReceipt`

Extends `object-set-matches` from a boolean into a delta. Key fields (all checked
by `scripts/verify-cub-scout-diff.mjs`):

| Field | Meaning |
| --- | --- |
| `operation` | `dry-run` (pre-apply) or `drift` (post-apply), same engine |
| `desired` | the held render-once object set (deterministic source) |
| `live.method` | `server-side-dry-run-apply` |
| `toolAgnostic` + `deliveredBy` | the diff is invariant across argo / flux / cub-direct |
| `diff.changedObjects` | the field-level delta |
| `provenance` | which **value** caused the delta (links the value-source-map) |
| `fleet` | the cross-environment blast-radius (links the fleet) |
| `authority` | the change is gated before apply |
| `residue` | runtime-minted values are *witnessed*, not faked into the diff |

## How It Relates To ArgoCD And Flux

See [`data/cub-scout-diff/capability-matrix.csv`](../../data/cub-scout-diff/capability-matrix.csv)
and the rendered [summary](../../data/cub-scout-diff/summary.md). In short: Argo
and Flux each give an accurate live-side diff (we adopt their server-side
technique) but re-render the desired side, are scoped to one Application /
HelmRelease, carry no value-provenance, no cross-fleet view, and don't gate the
diff on authority. cub-scout's diff keeps their good part and adds the catalog-specific layers
across all three delivery paths.

## Tool-agnostic, proven by construction

redis is delivered in this repo under **both** Argo and Flux
(`data/runtime-gitops`). The diff of an `image.digest` change is the *same* two
StatefulSets regardless of which tool applied it because the diff is computed
from the held desired data and the live objects, not from the reconciler. That
invariance is the point of `toolAgnostic: true`.

## Worked example

[`data/cub-scout-diff/examples/redis-image-digest-dryrun.yaml`](../../data/cub-scout-diff/examples/redis-image-digest-dryrun.yaml):
a dry-run of an `image.digest` change on redis. The diff (the two redis
StatefulSets) is checked against the chart's `value-source-map` (proven 13/13 in
`blast-radius-accuracy`), so the **provenance is real**, not asserted. The same
receipt notes the change propagates across the fleet but is shielded in
`prod-eu-west` (which pins the image).

## Honest scope

The schema, the capability matrix, the tool-agnostic invariance, and the
value-provenance check are real. The **cub-scout field-level diff command** that
runs the server-side dry-run end-to-end is the product piece (frontier).
`status: design-example` until it lands and a live dry-run + drift run on a
cluster, under each of Argo, Flux, and cub-direct, agree.

## Maps to the user story

This realizes the **day-1 dry-run** and **day-2 drift** stages of
[the public journey](../../site/journey.html) (#989), as one capability.
