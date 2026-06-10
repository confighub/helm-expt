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
recipes reviewed: 110
machine checks pass: 110
machine checks fail: 0
proof-grade: 80
catalog-candidate: 10
catalog-supported: 20
blocked: 0
default-only recipes: 46
multi-variant recipes: 64
recipes with warning gates: 96
recipes with non-current executable fixture path: 0
```

## Proof Tiers

- `bespoke-top20`: 30
- `next80-full`: 80

## Support Levels

- `machine-proof-only`: 80
- `promotion-review-needed`: 10
- `supported-for-declared-scopes`: 20

## Catalog Candidates

These are not catalog-supported yet. They are the first recipes worth human
promotion review because they already have richer variant artifacts or bespoke
proof work.

| Chart | Variants | Gate | Recommendation |
| --- | ---: | --- | --- |
| `argo-cd/argo-cd@9.5.17` | 2 | warn | run human catalog promotion review |
| `bitnami/mongodb@19.0.9` | 2 | warn | run human catalog promotion review |
| `bitnami/mongodb@19.1.0` | 2 | warn | run human catalog promotion review |
| `bitnami/nginx@24.0.4` | 2 | warn | run human catalog promotion review |
| `bitnami/nginx@25.0.0` | 2 | warn | run human catalog promotion review |
| `bitnami/postgresql@18.6.10` | 2 | warn | run human catalog promotion review |
| `bitnami/postgresql@18.7.0` | 2 | warn | run human catalog promotion review |
| `bitnami/redis@27.0.0` | 2 | warn | run human catalog promotion review |
| `prometheus-community/kube-prometheus-stack@86.1.0` | 2 | warn | run human catalog promotion review |
| `prometheus-community/prometheus@29.9.0` | 2 | warn | run human catalog promotion review |

## Main Gaps

- Default-only recipes remain proof-grade until they get user-shaped variants
  or explicit deferrals.
- Warning gates need dispositions, waivers, or stronger mitigations before
  production support.
- Charts with CRDs, webhooks, generated facts, lookup, cluster RBAC, or
  stateful storage need plain-English catalog notes, not only machine receipts.
- Executable fixture paths now point at current `packages/` paths; keep this as
  a hard invariant.

## Next Actions

1. Pick 3-5 proof-grade charts from the generated/default set and add
   user-shaped variants before promotion.
2. Record target-scoped production support decisions for review-ready top-20
   charts.
3. Keep `catalog-status.yaml` explicit for every maintained chart.
4. Use the legacy-patch review lane for supported old versions.
5. Re-run this report whenever chart versions, scan policy, installer behavior,
   or supported variants change.
