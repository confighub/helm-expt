# User Story: Spine, Coverage, and Visibility

The canonical product narrative, **chart-agnostic** and **measured**. Every stage is a capability counted across the catalog (so "works for all charts" is a number), and doc/demo visibility is tracked (so "visible everywhere" stays honest). Narrative: [docs/user/user-story.md](../../docs/user/user-story.md); machine-readable: [spine.yaml](spine.yaml).

> Helm serverless -> add server -> add app (write green | load brown) -> make changes + variants -> day-1 (preview, dry-run, lifecycle, ...) -> day-2 — for ANY chart, cross-cut by SecOps, platforms, fleets, stacks, and other groups.

## Stage coverage across the catalog

| Stage | Story | Coverage | Reach | Evidence |
| --- | --- | --- | --- | --- |
| **Helm, serverless** | Render and apply a chart with no server: cub installer pulls the package and applies the reviewed object set. | 110 | broad | installer packages + render parity |
| **Add server** | Upload the reviewed object set into ConfigHub as governed Units (the desired-state store). | 110 | broad | confighub scan / upload lane |
| **Add app - load brown** | Import an existing Helm chart: render once, hold as data, recover its variants. | 110 | broad | the import path (recipes) |
| **Add app - write green** | Author a new app directly as ConfigHub data (greenfield), with no chart to import. | 0 | gap | greenfield authored units |
| **Make changes + variants** | Edit the held data directly (not re-render) and fork governed variants for environment, region, or customer. | 199 | broad | variants + value-source-map |
| **Day-1: preview** | See exactly what will deploy, pre-deploy, with cluster-dependence captured as data (capability profile, target facts). | 199/199 | catalog-wide | preview-readiness (#988) |
| **Day-1: dry-run** | See what a change touches before applying: value provenance + fleet blast-radius + override-protection (better than ArgoCD's diff). | 4 | anchor-only | blast-radius (#982) + fleet (#985) |
| **Day-1: lifecycle + other functions** | Stage prerequisites, route hooks, witness convergence - the things plain Helm hides inside one install step. | 50/199 | broad | target facts + hook routes + cub-scout |
| **Day-2** | Upgrade, rollback (revisions), drift, and authorized reverse-reconcile back into desired state. | qualitative | qualitative | reverse-reconcile design (#986) + upgrade lanes + revisions |

Reach: **catalog-wide** (>=90% of variants) · **broad** (>=20 charts) · **anchor-only** (a few) · **gap** (none yet) · **qualitative** (design/narrative).

## Cross-cutting lenses (every stage, every chart)

- **secops** — Scan lanes, the reverse-reconcile authority model, separated secrets, signatures.
- **platforms** — Catalog + recipe/installer + target facts (platform prerequisites).
- **fleets** — Fleet blast-radius + promotion across environments (#985).
- **stacks** — Dependency-lock / closure; multi-chart app bundles as a first-class stack is a gap.
- **groups** — Authority / RBAC - who can change what; seeded by the reverse-reconcile policy.

## Visibility across docs & demos

- **46/190** docs reference the user story.
- **45/45** demo pages carry the spine.

## Honest gaps

- **Add app - write green** (0, gap) — no greenfield-authored units yet (import-focused)
- **Day-1: dry-run** (4, anchor-only) — charts with a value-source-map (dry-run provenance)

## Next

- Roll the one-line spine banner into every doc and demo until visibility is 100% (tracked above).
- The dry-run vs ArgoCD comparison (day-1 dry-run), chart-agnostic, under #989.
- Lift the thin stages: greenfield (write-green) authoring; value-source-map reach beyond the anchor charts; stacks-as-bundles.

## Regenerate

~~~sh
npm run user-story:generate
npm run user-story:verify
~~~
