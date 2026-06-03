# Catalog Promotion Review Report

This report is generated from the recipe, variant, receipt, and package
artifacts. It executes the machine-readable part of
`docs/planning/catalog-promotion-review.md` and identifies the human/product review
gaps that remain before any recipe can be called catalog-supported.

Important boundary:

```text
This report does not infer catalog-supported status from machine checks.
Catalog support must come from explicit catalog-status.yaml files.
```

## Summary

```text
recipes reviewed: 100
machine checks pass: 100
machine checks fail: 0
proof-grade: 80
catalog-candidate: 0
catalog-supported: 20
blocked: 0
default-only recipes: 46
multi-variant recipes: 54
recipes with warning gates: 86
recipes with non-current executable fixture path: 0
```

## Proof Tiers

- `bespoke-top20`: 20
- `next80-full`: 80

## Support Levels

- `machine-proof-only`: 80
- `supported-for-declared-scopes`: 20

## Catalog Candidates

These are not catalog-supported yet. They are the first recipes worth human
promotion review because they already have richer variant artifacts or bespoke
proof work.

| Chart | Variants | Gate | Recommendation |
| --- | ---: | --- | --- |
| none | 0 | none | none |

## Main Gaps

- Default-only recipes remain proof-grade until they get user-shaped variants
  or explicit deferrals.
- Warning gates need production dispositions, waivers, or stronger mitigations
  before catalog support.
- Charts with CRDs, webhooks, generated facts, lookup, cluster RBAC, or
  stateful storage need plain-English catalog notes, not only machine receipts.
- Executable fixture paths now point at current `packages/` paths; keep this as
  a hard invariant.

## Next Actions

1. Pick 3-5 proof-grade charts from the generated/default set and add
   user-shaped variants before promotion.
2. Add production dispositions for the currently supported local-test charts.
3. Keep `catalog-status.yaml` explicit for every maintained chart.
4. Use the legacy-patch review lane for supported old versions.
5. Re-run this report whenever chart versions, scan policy, installer behavior,
   or supported variants change.
