# Catalog Promotion Review Report

This report is generated from the recipe, variant, receipt, and package
artifacts. It executes the machine-readable part of
`docs/catalog-promotion-review.md` and identifies the human/product review
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
catalog-candidate: 19
catalog-supported: 1
blocked: 0
default-only recipes: 80
multi-variant recipes: 20
recipes with warning gates: 86
recipes with non-current executable fixture path: 0
```

## Proof Tiers

- `bespoke-top20`: 20
- `next80-full`: 80

## Support Levels

- `machine-proof-only`: 80
- `promotion-review-needed`: 19
- `supported-for-declared-scopes`: 1

## Catalog Candidates

These are not catalog-supported yet. They are the first recipes worth human
promotion review because they already have richer variant artifacts or bespoke
proof work.

| Chart | Variants | Gate | Recommendation |
| --- | ---: | --- | --- |
| `argo-cd/argo-cd@9.5.15` | 2 | warn | run human catalog promotion review |
| `bitnami/mongodb@19.0.7` | 2 | warn | run human catalog promotion review |
| `bitnami/mysql@14.0.3` | 2 | warn | run human catalog promotion review |
| `bitnami/nginx@24.0.2` | 2 | warn | run human catalog promotion review |
| `bitnami/postgresql@18.6.7` | 2 | warn | run human catalog promotion review |
| `bitnami/rabbitmq@16.0.14` | 2 | warn | run human catalog promotion review |
| `external-secrets/external-secrets@2.5.0` | 2 | warn | run human catalog promotion review |
| `grafana/grafana@10.5.15` | 2 | warn | run human catalog promotion review |
| `grafana/loki@7.0.0` | 2 | warn | run human catalog promotion review |
| `grafana/tempo@1.24.4` | 2 | warn | run human catalog promotion review |
| `hashicorp/consul@2.0.0` | 2 | warn | run human catalog promotion review |
| `hashicorp/vault@0.32.0` | 2 | warn | run human catalog promotion review |
| `ingress-nginx/ingress-nginx@4.15.1` | 2 | warn | run human catalog promotion review |
| `jetstack/cert-manager@v1.20.2` | 2 | warn | run human catalog promotion review |
| `longhorn/longhorn@1.11.2` | 2 | warn | run human catalog promotion review |
| `metrics-server/metrics-server@3.13.0` | 2 | warn | run human catalog promotion review |
| `prometheus-community/kube-prometheus-stack@85.3.3` | 2 | warn | run human catalog promotion review |
| `prometheus-community/prometheus@29.8.0` | 2 | warn | run human catalog promotion review |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | 2 | warn | run human catalog promotion review |

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

1. Pick 3-5 next catalog candidates and run the human product review in
   `docs/catalog-promotion-review.md`.
2. For each selected chart, decide the supported variants and explicitly defer
   the variants we will not support yet.
3. Keep `catalog-status.yaml` explicit for every maintained chart.
4. Use the legacy-patch review lane for supported old versions.
5. Re-run this report whenever chart versions, scan policy, installer behavior,
   or supported variants change.
