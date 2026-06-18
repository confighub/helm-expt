# The helm-expt User Story

**UNOFFICIAL/EXPERIMENTAL**

This is the spine the whole project hangs on. Two rules:

1. **Chart-agnostic.** Every stage is a capability proven *across the catalog*,
   never tied to one chart. The generated map measures per-stage coverage so
   "works for all" is a number, not a claim.
2. **Visible everywhere.** This story should appear in every doc and demo. The
   same generator reports which docs/demos carry it and lists the gap.

> **Helm serverless → add server → add app (write green | load brown) → make
> changes + variants → day-1 (preview, dry-run, lifecycle, …) → day-2.**
> Cross-cut by **SecOps, platforms, fleets, stacks**, and other groups.

The canonical machine-readable spine is
[`data/user-story/spine.yaml`](../../data/user-story/spine.yaml); the measured
coverage + visibility map is
[`data/user-story/summary.md`](../../data/user-story/summary.md).

## The stages — for any chart

| Stage | What the user does | Proven by |
| --- | --- | --- |
| Helm, serverless | render + apply a chart with no server (`cub installer`) | installer packages + render parity |
| Add server | upload the reviewed object set as governed ConfigHub Units | confighub scan / upload lane |
| Add app — load brown | import an existing chart: render once → data → variants recovered | the import path (recipes) |
| Add app — write green | author a new app directly as data (greenfield) | *(gap — thin today)* |
| Make changes + variants | edit the held data; fork variants for env/region/customer | variants + value-source-map |
| Day-1: preview | see exactly what will deploy, with cluster-dependence captured as data | preview-readiness (#988) |
| Day-1: dry-run | see what a change touches first — provenance + fleet blast-radius | blast-radius (#982) + fleet (#985) |
| Day-1: lifecycle | stage prerequisites, route hooks, witness convergence | target facts + hook routes + cub-scout |
| Day-2 | upgrade, rollback, drift, authorized reverse-reconcile | reverse-reconcile design (#986) + upgrade lanes |

## Cross-cutting (every stage, every chart)

- **SecOps** — scan lanes, the reverse-reconcile authority model, separated secrets, signatures.
- **platforms** — catalog + recipe/installer + target facts (platform prerequisites).
- **fleets** — fleet blast-radius + promotion across environments.
- **stacks** — dependency-lock/closure; *multi-chart app bundles as a first-class stack is a gap.*
- **groups** — authority / RBAC — who can change what; seeded by the reverse-reconcile policy.

## Day-1 dry-run beats ArgoCD

Argo's dry-run re-renders the desired side with `helm template` (inheriting
`lookup` + generated-value nondeterminism), is per-Application, field-level, and
ungoverned. Ours diffs the **held render-once data** (deterministic desired
side), adds **value provenance** (which value caused which objects), **fleet-wide
blast-radius** with override-protection, and an **authority + bounds** gate —
same diff Argo gives, plus the layers it lacks. The full comparison is a planned
build under #989.

## Honest gaps (named, not hidden)

- **write-green** (greenfield authoring as data) — thin; import (brown) is the strong path.
- **dry-run provenance reach** — the value-source-map mechanism is chart-agnostic, but it is realized on a few anchor charts, not the whole catalog yet.
- **stacks-as-bundles** — multi-chart applications are not yet a first-class object.

## Why measured

`scripts/generate-user-story.mjs` (`--generate` / `--verify`) counts each stage's
coverage across the catalog and scans the docs/demos for spine visibility, so
both rules above stay honest over time:

~~~sh
npm run user-story:generate
npm run user-story:verify
~~~
