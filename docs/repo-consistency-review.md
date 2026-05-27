# Repo Consistency Review

## Verdict

The repo now has a clearer shape:

```text
README -> current mission and simple UX claim
docs/ -> doctrine, maintenance, customization, promotion review
recipes/ -> chart proof artifacts
packages/ -> executable cub installer packages
data/ -> generated review outputs
outputs/helm_top500_matrix/ -> historical source-feature matrix only
```

The old top-20 render-and-vendor payload is removed from the active tree. The
current proof path is `recipes/` plus `packages/`, verified against regular
Helm renders and `cub install`.

## Current Logical Flow

1. Pick a public Helm chart and version.
2. Render it with regular Helm under pinned inputs.
3. Capture a HelmPlan, ChartDossier, source/dependency locks, control points,
   and value model.
4. Create one or more install variants.
5. Store immutable variant revisions with rendered release objects.
6. Run scans and install gates against the exact rendered objects.
7. Build an executable `cub install` package under `packages/`.
8. Compare `cub install setup` output with the regular Helm baseline.
9. Generate catalog-promotion review output.
10. Promote only after human/product review assigns explicit catalog status.

## What Is Consistent

- The public claim is stable: correct variants, safe operations, immediate
  proof.
- Redis, the promoted top-20 recipes, and the next-80 recipes all use current
  `packages/` executable fixtures.
- `npm run verify` checks current artifact chains instead of obsolete archive
  receipts.
- The catalog-promotion review separates machine proof from catalog support.

## What Still Needs Tightening

- The old top-500 matrix should be recalculated in the new catalog-proof shape.
- Every chart should get an explicit `catalog-status.yaml`; support status
  should not be inferred from proof tier.
- Redis should be the first deliberate `catalog-supported` entry, with warning
  gates and production dispositions stated plainly.
- The repo needs an upgrade/legacy-patch review lane for old chart versions.
- The README should continue to favor short user commands and keep internal
  nouns in the docs, not the happy path.

## Current Review Boundary

Do not use the removed top-20 archive or the old matrix to judge the current
plan. They explain how we learned the control points. The current plan is
judged by current recipes, current packages, current receipts, generated
reviews, and repeatable Helm-vs-`cub install` comparisons.
