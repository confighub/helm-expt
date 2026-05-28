# P0 Major Issue Status

This file keeps the high-priority proof gaps visible in the repo. The goal is
to prevent the project from quietly drifting back into prose-only claims.

| Issue | Current status | What is now contract-backed | Still open |
| --- | --- | --- | --- |
| #4 HelmPlan pain report per chart | Redis acceptance satisfied | Redis now has `helm-pain-report.yaml`; HelmPlan links it; verifier checks that default Redis has no unhandled pain points. | Scale the richer report shape to every catalog chart. |
| #5 EffectiveValues@sha | Redis acceptance satisfied | Redis effective values include file/tree digests and provenance; render receipts and variant revisions bind the effective-values digest. | Full Helm value precedence across defaults, globals, and subcharts remains chart-by-chart work. |
| #6 Dead/unknown/ignored values | Redis acceptance satisfied | Redis has `values-diagnostics.yaml` with a synthetic wrong-key test; HelmPlan and ValueModel link it; verifier checks the finding. | Automate dead-key detection more broadly. |
| #7 Value-to-field explanation | Redis acceptance satisfied | Redis has `value-source-map.yaml` explaining replica count, release name, namespace, and password effects; verifier checks those entries. | Scale field-level provenance to the rest of the catalog. |
| #24 Artifact schemas and receipt verifier | Advanced here | `schemas/` now defines the core artifact contracts and `npm run p0:contracts` verifies schema presence plus corpus invariants. | Full JSON Schema validation of every artifact can be added after contract shape settles. |
| #25 Top-N adversarial harness | In progress | `data/adversarial10/` exists and is verified; top-500 catalog analysis exists separately. | The harness should grow from adversarial-10 to a repeatable top-N run plan with promotion gates. |
| #27 Observation freshness SLO | Advanced here | `docs/observation-freshness-slo.md` defines fresh, stale, failed, unknown, not-observed, and drifted states. | UI/API display of freshness status remains outside this repo. |
| #28 Generated fact receipt schema | Redis acceptance satisfied | Schema exists and Redis default emits a concrete generated fact receipt bound into the render receipt and variant revision. | The top secret-generating charts should emit concrete `GeneratedFactReceipt` examples. |
| #29 Capability profile catalog | Redis acceptance satisfied | Capability catalog exists with verified digests; Redis variants, render receipts, and variant revisions bind `k8s-1.30-default`. | Migrate every chart from inline kubeVersion/API lists to named profile references. |
| #30 Upgrade and rollback simulation receipts | First Redis exemplar landed | Schema exists and Redis has concrete upgrade/rollback simulation receipts for the default <-> reuse-existing-secret transition. | Add true old-version chart upgrade simulations next. |

## Current Priority

1. Keep `npm run verify` green.
2. Convert Redis from "proof-grade" to the first complete production-support
   exemplar, including generated fact and upgrade/rollback receipts.
3. Apply the same contracts to the other 19 catalog entries without making the
   user journey feel heavier than Helm.
