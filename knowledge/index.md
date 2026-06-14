# Project Knowledge Index

This is the maintained orientation layer for helm-expt. It summarizes the
current model and points to the files that prove it.

Use this when you need to understand the project quickly. Use the linked
generated data, receipts, recipes, issues, and verifiers when you need to prove
a claim.

## Rules

- This layer is not authoritative over generated evidence.
- Do not copy volatile counts here.
- If a page conflicts with generated data, the page is wrong.
- Maintenance rules are in [SCHEMA.md](./SCHEMA.md).
- Changes are recorded in [log.md](./log.md).

## Wiki Pages

| Page | Purpose | Status | Last reviewed | Main evidence |
| --- | --- | --- | --- | --- |
| [Helm Lifecycle](./wiki/helm-lifecycle.md) | Seven-stage model for chart analysis, render parity, live observation, and operations. | current | 2026-06-14 | [seven-stage lifecycle](../docs/reference/seven-stage-helm-lifecycle.md), [harness guide](../docs/user/how-the-harness-works.md), [master matrix](../data/master-catalog-matrix/matrix.html) |
| [Variants And Promotion](./wiki/variants-and-promotion.md) | Base variants, derived ConfigHub variants, promotion, and the render/post-render boundary. | current | 2026-06-14 | [creating variants](../docs/user/creating-variants.md), [variant promotion model](../docs/reference/variant-promotion-model.md), [issue #682](https://github.com/confighub/helm-expt/issues/682) |
| [Hooks And Lifecycle Routes](./wiki/hooks-and-lifecycle-routes.md) | Hook disposition vocabulary and the off-ramp model. | current | 2026-06-14 | [lifecycle routes](../data/lifecycle-routes/summary.md), [hook strategy](../docs/user/hook-lifecycle-strategy.md), [hook support meaning](../docs/reference/what-hook-support-means.md) |
| [Top100 Status Model](./wiki/top100-status-model.md) | How to read top20, top100, and top500 status without overclaiming. | current | 2026-06-14 | [status dashboard](../data/status-dashboard/summary.md), [top100 readiness](../data/top100-readiness/summary.md), [data index](../data/README.md) |
| [Free To Paid Journey](./wiki/free-to-paid-journey.md) | Public try path, ConfigHub adoption path, and managed/commercial boundary. | current | 2026-06-14 | [site journey](../site/journey.html), [offering](../docs/user/offering.md), [product tiers](../docs/user/product-support-tiers.md) |
| [Evidence And Authority](./wiki/evidence-and-authority.md) | What each proof lane proves, what it does not prove, and which source wins. | current | 2026-06-14 | [claims register](../data/claims-register/summary.md), [verification lanes](../docs/user/verification-lanes.md), [tests map](../tests/README.md) |
| [Hard Chart Patterns](./wiki/hard-chart-patterns.md) | Repeating difficult chart patterns: CRDs, webhooks, target facts, hooks, generated runtime state, target shape. | current | 2026-06-14 | [serious charts](../docs/user/serious-charts.md), [KPS review](../docs/reference/kube-prometheus-stack-serious-chart-review.md), [GitOps residue](../data/gitops-health-residue/summary.md) |
| [Agent Operating Guide](./wiki/agent-operating-guide.md) | Practical rules for AI agents working in this repo without stale claims or live-lane collisions. | current | 2026-06-14 | [tests npm scripts](../tests/npm-scripts.md), [docs map](../docs/README.md), [live parity guide](../docs/user/live-parity.md) |

