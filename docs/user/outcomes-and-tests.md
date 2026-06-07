# Outcomes And Tests

**UNOFFICIAL/EXPERIMENTAL**

Use this page when you want to know what the repo promises, which tests prove
each promise, and where to check the current status.

The generated front door is:

[Outcome Coverage](../../data/outcome-coverage/summary.md)

That summary joins the catalog, recipe, variant, proof, live-test, GitOps,
hook, and feature data into four CSVs.

## The Four Outcome Tables

| File | Use it for |
| --- | --- |
| [chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) | One row per chart. Shows model support, production readiness, lane counts, feature summary, and hard gaps. |
| [base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) | One row per chart/base variant. Shows render parity, ConfigHub proof, local live proof, GitOps/OCI live proof, and live Helm parity. |
| [derived-variant-outcomes.csv](../../data/outcome-coverage/derived-variant-outcomes.csv) | One row per derived ConfigHub variant. Shows intended-state proof and target-bound live status. |
| [feature-outcomes.csv](../../data/outcome-coverage/feature-outcomes.csv) | One row per chart feature or quirk. Shows hooks, generated secrets, CRDs, webhooks, required values, schemas, extension slots, and unresolved gaps. |

Every CSV under `data/` is indexed here:

[Data Index](../../data/README.md)

The machine-readable index is:

[csv-index.csv](../../data/csv-index.csv)

## What Each Outcome Means

| Outcome | What proves it | Command |
| --- | --- | --- |
| The chart model is understandable and honestly scoped. | Model completeness, chart facts, pain report, and weirdness notes. | `npm run completeness:verify` |
| A base variant renders the same object set as Helm. | `helm_template_vs_installer_setup` lane. | `npm run lane-tests:verify` |
| The rendered objects can be uploaded and operated in ConfigHub. | Upload, scan, and safe-operation receipts. | `npm run top20:verify-confighub-proof` |
| The rendered objects work in Kubernetes for tested rows. | Local kind live receipts. | `npm run top20:verify-local-e2e` |
| ConfigHub OCI can be reconciled by GitOps for tested rows. | Argo or Flux OCI receipts plus runtime observation. | `npm run runtime-gitops:wave:verify` |
| Plain Helm and ConfigHub delivery reach equivalent live outcomes for tested rows. | Live Helm-vs-ConfigHub comparison receipts and two-cluster parity receipts. | `npm run live-parity:verify && npm run kind-parity:verify` |
| Derived ConfigHub variants preserve reviewed bases and expose post-render changes. | Derived variant execution receipts and target-bound receipts. | `npm run derived-variants:verify && npm run derived-variants:target-bound:verify` |
| Hooks and hook-like lifecycle behavior are visible rather than hidden. | Hook lifecycle queue and lifecycle observation receipts. | `npm run hooks:lifecycle:verify && npm run lifecycle:cert-manager-eso:verify` |
| Images, Secrets, CRDs, webhooks, target facts, and other chart-specific features are tracked. | Chart facts, attack-plan workdown, and image digest workdown. | `npm run chart-facts:verify && npm run attack-plan:verify && npm run image-digests:workdown:verify` |

## How To Use The Tables

1. Pick a chart in [CATALOG.md](../../CATALOG.md).
2. Open the per-chart catalog page at `recipes/<repo>/<chart>/<version>/CATALOG.md`.
3. Check [chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) for the chart-level status.
4. Filter [base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) by chart to see each base variant.
5. Check [feature-outcomes.csv](../../data/outcome-coverage/feature-outcomes.csv) for hooks, CRDs, generated facts, target facts, and other chart-specific behavior.
6. Check [derived-variant-outcomes.csv](../../data/outcome-coverage/derived-variant-outcomes.csv) when the question is about post-render ConfigHub variants.
7. Run `npm run outcomes:verify` when you only need the outcome tables, or `npm run verify` when you need the full corpus check.

## Narrow Claim Rule

Do not say a chart is simply "tested" without naming the lane.

Use the narrowest true claim:

```text
model-supported
render parity
in-ConfigHub proof
local live
GitOps live
live parity
lifecycle observed
production-ready
```

A `missing` row means the exact chart/base/variant/feature has no committed
receipt for that lane yet. A `blocked`, `watch`, or `fail` row means there is a
receipt and the result is part of the evidence.
