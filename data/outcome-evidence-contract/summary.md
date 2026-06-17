# Outcome Evidence Contract

This generated contract answers a simple product question: for each user-visible
outcome, what do we currently promise, what evidence backs it, what command
checks it, and where are the limits?

It is intentionally narrower than the full proof corpus. The rows below are
the outcomes a Helm user, platform team, or reviewer is likely to ask about
first.

## Summary

```text
outcomes: 11
backed: 2
partial: 6
gap: 2
planned: 0
refused: 1
```

## Outcome Rows

| Outcome | Status | Current metric | Scope | Next action |
| --- | --- | --- | --- | --- |
| Can I see exactly what the chart will produce before I install it? | backed | render parity rows 192/192 good | chart/version/base under recorded values and capability profile | Keep new bases on the render-parity lane before publishing them. |
| Can I start from a recommended public catalog path instead of inventing values? | partial | catalog-supported charts 20/100 partial; top20 start-here base variants 26/42 partial; public catalog answers 20/100 partial | public catalog entries and their named start-here bases | Promote the next proof-grade charts only after base usefulness and live lanes are reviewed. |
| Can I prove the ConfigHub/installer path did not secretly change Helm output? | backed | render parity rows 192/192 good; two-cluster semantic parity pass rows 145/162 good; ConfigHub/OCI semantic parity defect receipts 0/184 good | selected chart/version/base rows with committed receipts | Add or refresh live parity receipts when a base, chart version, or target profile changes. |
| Can I manage the rendered objects as ConfigHub configs with scans and safe operations? | partial | in-ConfigHub proof rows 192/192 partial; runtime/GitOps wave rows 11/11 partial; high-priority scan rows 4/20 partial | catalog rows with committed ConfigHub upload, scan, safe-op, or runtime receipts | Expand ConfigHub scan/safe-operation receipts beyond the current catalog-supported rows. |
| Can Argo or Flux pull ConfigHub OCI and can I see that the workload actually works? | partial | GitOps/OCI live pass rows 135/192 partial; local live rows 142/192 partial; ConfigHub/OCI semantic parity defect receipts 0/184 good | live receipts for declared targets; local live is not the same as GitOps live | Keep GitOps/runtime receipts fresh and add more target-bound cub-scout witness runs. |
| Can I create variants without falling back into hidden Helm values sprawl? | partial | variant-rich maintained chart rows 74/110 partial; derived variant golden rows 10/10 good; target-bound derived variant receipts 6/10 partial | base variants are render-time choices; derived variants are post-render refinements | Add more target-bound derived variant receipts and keep routing rules visible before OCI delivery. |
| Can wrapper charts, values files, and customer overlays be supported without pretending they are simple public-chart installs? | gap | top100 user-shaped variant queue 35/80 partial; useful-base proposal rows 45 partial; useful-base realized rows 10/45 partial; useful-base proposals not yet built 35/45 gap; top100 promotion-review queue 37/80 partial | managed imports and reviewed overlay paths; arbitrary private overlays are not public-catalog guarantees | Convert more user-shaped variant queue rows into reviewed base or overlay examples. |
| Can hooks, CRDs, webhooks, and controller-populated fields be handled without lying about static YAML? | partial | top100 source-scan hook charts 11/100 partial; hook lifecycle observations present 5/5 good; related lifecycle observation receipts passing 4/4 good | maintained hook queue and candidate source-hook routes; every hook class remains per-chart until observed or refused | Turn candidate hook routes into maintained lifecycle receipts, especially for top-100 source hook charts. |
| Can I tell what is production-supported, what is review-ready, and what is only proof evidence? | partial | supported decision artifacts 17/20 partial; top20 production-review-ready charts 20/20 partial; rejected decision artifacts 1/20 partial | target-scoped support decisions; production support is not implied by render parity | Create broader or stricter support decisions only after target, image, scan, lifecycle, and live evidence are refreshed. |
| Can this scale from 20 charts to 100 or 500 without turning into spreadsheet theater? | gap | proof-grade non-catalog charts 80/100 partial; rows with current recipe proof 91/500 partial; rows with no current recipe proof 409/500 gap | top-100 has maintained proof artifacts; top-500 is planning/reconnaissance unless a row links to current proof | Promote proof-grade rows through useful-base review, selected live lanes, and production disposition. |
| Can I trust the project not to overclaim when a lane is missing or blocked? | refused | ConfigHub/OCI semantic parity defect receipts 0/184 good; two-cluster semantic parity defect receipts 8/162 good; source-scanned but not surfaced axes 5/26 gap | public claims must name chart, version, base, lane, and target profile | Keep rejected, partial, planned, watch, blocked, and missing statuses visible in public-facing summaries. |

## Evidence And Commands

| Outcome | Evidence | Verify |
| --- | --- | --- |
| inspect-before-install | data/outcome-coverage/base-outcomes.csv; data/claims-register/summary.md; data/chart-use-guide/summary.md; data/live-kind-parity/summary.md; data/live-helm-confighub-compare/summary.md | `npm run outcomes:verify; npm run claims:register:verify` |
| try-a-supported-public-path | CATALOG.md; data/chart-use-guide/summary.md; data/top20-base-readiness/summary.md; site/charts/index.html; data/top100-readiness/readiness.csv; data/top20-base-readiness/base-readiness.csv; data/chart-use-guide/chart-use-guide.csv; data/status-dashboard/top20-status.csv; data/live-e2e/summary.md; data/outcome-coverage/base-outcomes.csv | `npm run top20:base-readiness:verify; npm run chart-use:guide:verify; npm run site:verify` |
| prove-helm-equivalence | data/live-kind-parity/summary.md; data/live-helm-confighub-compare/summary.md; data/outcome-coverage/base-outcomes.csv; data/live-kind-parity/summary.csv; data/live-helm-confighub-compare/summary.csv | `npm run kind-parity:verify; npm run live-parity:verify; npm run outcomes:verify` |
| manage-rendered-configs-in-confighub | data/external-scan-lane/summary.md; data/scan-disposition-workdown/summary.md; runs; data/outcome-coverage/base-outcomes.csv; data/runtime-gitops/wave1.csv; data/scan-disposition-workdown/workdown.csv; docs/user/tutorial-sequence.md; docs/demo/redis/function-scan-lane.md; docs/demo/redis/safe-ops-lane.md | `npm run top20:verify-confighub-proof; npm run external-scan:verify; npm run scan-disposition:workdown:verify` |
| deliver-through-gitops-and-observe-live | data/runtime-gitops/summary.md; data/live-e2e/summary.md; data/live-e2e/cub-scout-watchlist.md; data/outcome-coverage/base-outcomes.csv; data/live-helm-confighub-compare/summary.csv; data/runtime-gitops/wave1.csv; docs/user/adopting-existing-apps.md; docs/user/chain-of-proof.md | `npm run runtime-gitops:wave:verify; npm run top20:verify-local-e2e; npm run live-parity:verify` |
| create-safe-variants | docs/user/creating-variants.md; data/variant-goldens/derived-expansion-wave/work-orders.csv; data/outcome-coverage/derived-variant-outcomes.csv; data/outcome-coverage/chart-outcomes.csv; runs/derived-variant-target-bound; docs/user/change-routing-before-oci.md; data/variant-goldens/redis-prod-us-east/README.md | `npm run variant-goldens:verify; npm run derived-variants:verify; npm run derived-variants:target-bound:verify` |
| route-custom-overlays | docs/user/custom-overlays.md; docs/reference/customization-algorithm.md; data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md; data/useful-base-design-queue/summary.md; data/useful-base-realization-wave/summary.md; data/top100-coverage/work-queue.csv; data/useful-base-design-queue/queue.csv; data/useful-base-realization-wave/wave.csv; docs/corpus/kubara-customized-overlays.md | `npm run variant-goldens:verify; npm run top100:coverage:verify; npm run top100:useful-base-queue:verify; npm run top100:useful-base-realization:verify` |
| handle-hooks-and-lifecycle | data/hook-lifecycle/summary.md; data/hook-coverage/summary.md; data/lifecycle-boundary/summary.md; data/lifecycle-observations/cert-manager-eso/summary.md; data/hook-lifecycle/source-top100-hooks.csv; data/hook-lifecycle/maintained-hook-queue.csv; data/lifecycle-observations/cert-manager-eso/summary.csv; docs/user/hook-lifecycle-strategy.md; runs/hook-lifecycle/gatekeeper-gatekeeper/default/latest/receipt.yaml | `npm run hooks:lifecycle:verify; npm run hooks:coverage:verify; npm run lifecycle:boundary:verify; npm run lifecycle:cert-manager-eso:verify` |
| make-production-scope-explicit | data/production-support-decisions/summary.md; data/hard-chart-production-packets/summary.md; data/production-disposition/summary.md; data/production-support-decisions/decisions.csv; data/production-disposition/top20.csv; data/status-dashboard/top20-status.csv; data/live-e2e/summary.md; data/top20-base-readiness/summary.md; data/outcome-coverage/base-outcomes.csv | `npm run production:support-decisions:verify; npm run hard-charts:packets:verify; npm run production:disposition:verify` |
| scale-the-catalog-honestly | data/top100-readiness/summary.md; data/top100-coverage/summary.md; data/top500-catalog-analysis/summary.md; data/status-dashboard/summary.md; data/top100-readiness/readiness.csv; data/top500-catalog-analysis/review.csv; data/top100-catalog-analysis/summary.md; data/next80-full-proofs/summary.md | `npm run top100:readiness:verify; npm run top100:coverage:verify; npm run top500:catalog:verify; npm run status:dashboard:verify` |
| keep-overclaims-out | data/claims-register/summary.md; docs/user/what-we-refuse-to-claim.md; data/status-dashboard/summary.md; data/live-helm-confighub-compare/summary.csv; data/live-kind-parity/summary.csv; data/quirk-coverage/coverage.csv; docs/user/current-proof-status.md; docs/user/live-parity.md; data/live-parity-rerun-plan/summary.md | `npm run claims:register:verify; npm run docs:verify; npm run status:dashboard:verify` |

## Reading Rule

Use the narrowest true status:

- `backed`: current evidence and scoped verifiers support the claim.
- `partial`: the model works for named rows, but not across the full catalog
  or every target scope.
- `gap`: the repo records a missing or weak area that needs work before
  stronger claims.
- `planned`: product or commercial direction, not current shipped behavior.
- `refused`: the repo deliberately refuses a broad claim.

Regenerate:

~~~sh
npm run outcomes:contract
npm run outcomes:contract:verify
~~~
