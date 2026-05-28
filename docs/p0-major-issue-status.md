# P0 Major Issue Status

This file keeps the high-priority proof gaps visible in the repo. The goal is
to prevent the project from quietly drifting back into prose-only claims.

| Issue | Current status | What is now contract-backed | Still open |
| --- | --- | --- | --- |
| #4 HelmPlan pain report per chart | In progress | Top-20 and next-80 recipe folders include `helm-plan.yaml`; verifier requires at least 100 HelmPlan artifacts. | Richer per-chart pain summaries should be promoted into the generated catalog UI. |
| #5 EffectiveValues@sha | In progress | Effective values artifacts exist for the proof corpus; verifier checks Redis and corpus counts. | Full Helm value precedence/provenance is still partial and should be improved chart by chart. |
| #6 Dead/unknown/ignored values | In progress | `value-model.yaml` exists across the proof corpus; Redis records checked values and explicit not-yet-checked fields. | Automated dead-key detection remains a follow-up. |
| #7 Value-to-field explanation | In progress | Value models and rendered object inventories exist; Redis has checked-value rationale. | Field-level provenance needs a first full exemplar before we scale it to all charts. |
| #24 Artifact schemas and receipt verifier | Advanced here | `schemas/` now defines the core artifact contracts and `npm run p0:contracts` verifies schema presence plus corpus invariants. | Full JSON Schema validation of every artifact can be added after contract shape settles. |
| #25 Top-N adversarial harness | In progress | `data/adversarial10/` exists and is verified; top-500 catalog analysis exists separately. | The harness should grow from adversarial-10 to a repeatable top-N run plan with promotion gates. |
| #27 Observation freshness SLO | Advanced here | `docs/observation-freshness-slo.md` defines fresh, stale, failed, unknown, not-observed, and drifted states. | UI/API display of freshness status remains outside this repo. |
| #28 Generated fact receipt schema | Advanced here | `schemas/generated-fact-receipt.schema.json` defines the generated fact receipt shape. | The top secret-generating charts should emit concrete `GeneratedFactReceipt` examples. |
| #29 Capability profile catalog | Advanced here | `data/capability-profiles/catalog.yaml` defines bounded capability profiles with verified digests. | Chart render receipts should migrate from inline kubeVersion/API lists to named profile references. |
| #30 Upgrade and rollback simulation receipts | Advanced here | `schemas/upgrade-rollback-receipt.schema.json` defines receipt contracts for upgrade and rollback simulation. | Redis should become the first concrete old-version upgrade/rollback simulation. |

## Current Priority

1. Keep `npm run verify` green.
2. Convert Redis from "proof-grade" to the first complete production-support
   exemplar, including generated fact and upgrade/rollback receipts.
3. Apply the same contracts to the other 19 catalog entries without making the
   user journey feel heavier than Helm.
