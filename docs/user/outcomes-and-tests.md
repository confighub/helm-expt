# Outcomes And Tests

**UNOFFICIAL/EXPERIMENTAL**

Use this page when you want to know what the repo promises, which tests prove
each promise, and where to check the current status.

The shortest generated front door is:

[Status Dashboard](../../data/status-dashboard/summary.md)

It gives one current view of top100 readiness, the retained top500 evidence
map, proof lanes, hook and quirk residues, GitOps/OCI status, and live parity.

The detailed generated outcome front door is:

[Outcome Coverage](../../data/outcome-coverage/summary.md)

That summary joins the catalog, recipe, variant, proof, live-test, GitOps,
hook, and feature data into four CSVs. The pain-point and variant-path matrices
add two more front-door views for "what Helm pain is this solving?" and "which
exact chart/base/path has which proof?"

For the shortest chart-by-chart top-100 answer, start with:

[Top-100 Readiness](../../data/top100-readiness/summary.md)

## The Four Outcome Tables

| File | Use it for |
| --- | --- |
| [chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) | One row per chart. Shows model support, production readiness, lane counts, feature summary, and hard gaps. |
| [base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) | One row per chart/base variant. Shows render parity, ConfigHub proof, local live proof, GitOps/OCI live proof, live Helm parity, and two-cluster kind parity. |
| [derived-variant-outcomes.csv](../../data/outcome-coverage/derived-variant-outcomes.csv) | One row per derived ConfigHub variant. Shows intended-state proof and target-bound live status. |
| [feature-outcomes.csv](../../data/outcome-coverage/feature-outcomes.csv) | One row per chart feature or quirk. Shows hooks, generated secrets, CRDs, webhooks, required values, schemas, extension slots, and unresolved gaps. |

## Additional Front-Door Tables

| File | Use it for |
| --- | --- |
| [status.csv](../../data/status-dashboard/status.csv) | One row per dashboard metric: top100, top500 evidence, proof lanes, hooks, quirks, GitOps, and live parity. |
| [top20-status.csv](../../data/status-dashboard/top20-status.csv) | One row per top-20 catalog chart. Shows the recommended base, setup command, base-readiness mix, strongest evidence, lane counts, feature summary, hard gaps, and next action. |
| [top20 base readiness](../../data/top20-base-readiness/summary.md) | One row per top-20 base variant. Shows which bases are clean first paths and which need prerequisites, runtime review, or hook lifecycle work. |
| [production disposition](../../data/production-disposition/summary.md) | Top-20 production review boundary. Shows accepted dispositions, open blockers, and next actions before a target-scoped production support decision can be made. |
| [production disposition details](../../data/production-disposition/dispositions.md) | Detailed top-20 production plan. Shows accepted receipts, owners, required evidence, and unblock rules for each disposition type. |
| [production next actions](../../data/production-disposition/next-actions.csv) | One row per top-20 chart. Shows recommended base, production decision focus, image digest status, and next action. |
| [scan disposition workdown](../../data/scan-disposition-workdown/summary.md) | One row per top-20 chart. Routes scan warnings to image-pin fixes, resource policies, security hardening, privileged infrastructure acceptance, runtime endpoint review, or PDB policy decisions. |
| [image digest workdown](../../data/image-digest-workdown/summary.md) | Rendered image references that need digest resolution, image overrides, or explicit proof receipts before reproducible production OCI support. |
| [pain-points.csv](../../data/pain-point-coverage/pain-points.csv) | One row per common Helm pain point. Shows current answer, handoff, evidence, remaining gap, and next action. |
| [readiness.csv](../../data/top100-readiness/readiness.csv) | One row per top-100 chart. Shows workability, adoption bucket, current user status, strongest evidence, hard gap, and next action. |
| [next-ten waves](../../data/next-ten-waves/summary.md) | Compact next work queues for gap review, latest-version promotion, variant build, production disposition, and import prototypes. |
| [attack-plan workdown](../../data/attack-plan-workdown/summary.md) | Broader workdown across import examples, hard gaps, variants, production, runtime/GitOps, latest candidates, and image digests. |
| [top500 review.csv](../../data/top500-catalog-analysis/review.csv) | One row per retained source-scan chart. Shows source-scan status, current recipe/package proof status, catalog status, version drift, source features, and next action. |
| [coverage-matrix.csv](../../data/variant-path-coverage/coverage-matrix.csv) | One row per chart/base/path. Shows whether the row is a base, diff, operation, or derived variant, with proof status per lane. |
| [quirk coverage](../../data/quirk-coverage/summary.md) | One row per Helm quirk axis. Shows whether it is tracked, partly tracked, source-scanned only, or not scanned. |
| [extension slot coverage](../../data/extension-slots/summary.md) | One row per chart with NGINX-like raw manifests, tpl snippets, config blocks, sidecars, or add-on slots. |
| [hook and lifecycle boundary](../../data/lifecycle-boundary/summary.md) | Separates hook lifecycle queue rows from hook-like controller lifecycle observations. |
| [cert-manager and External Secrets lifecycle observations](../../data/lifecycle-observations/cert-manager-eso/summary.md) | Concrete post-apply checks for CRD policy, API readiness, webhook CA injection, and controller-populated Secret data. |
| [edges.csv](../../data/edge-recovery/edges.csv) | Recovered graph fragments for catalog-supported charts: inheritance, overrides, generated facts, target facts, and field reachability where known. |

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
| Hooks and hook-like lifecycle behavior are visible rather than hidden. | Hook lifecycle queue, lifecycle boundary, and lifecycle observation receipts. | `npm run hooks:lifecycle:verify && npm run lifecycle:boundary:verify && npm run lifecycle:cert-manager-eso:verify` |
| A chart is ready for production-support review. | Production disposition table plus accepted receipts for scan/gate, lifecycle, RBAC, storage, target facts, extension slots, and operation policy. | `npm run production:disposition:verify` |
| A chart can be called production-supported. | A final target-scoped support decision names the supported base, target scope, image policy, required live checks, lifecycle policy, and observation freshness. | No single repo-wide verifier yet; check production disposition, image digest workdown, live lanes, and the recorded support decision. |
| Scan warnings have been routed to the right kind of production work. | External scan lane plus scan disposition workdown. | `npm run external-scan:verify && npm run scan-disposition:workdown:verify` |
| Images, Secrets, CRDs, webhooks, target facts, and other chart-specific features are tracked. | Chart facts, attack-plan workdown, and image digest workdown. | `npm run chart-facts:verify && npm run attack-plan:verify && npm run image-digests:workdown:verify` |
| Known Helm quirks are either surfaced or disclosed as gaps. | Quirk coverage audit. | `npm run quirk-coverage:verify` |
| Common Helm pain points have an explicit answer and gap. | Pain-point coverage matrix and per-chart pain reports. | `npm run pain-points:verify` |
| The top-100 corpus has a clear user status. | Top-100 readiness rollup. | `npm run top100:readiness:verify` |
| Variant paths have row-level status. | Variant-path coverage matrix. | `npm run variant-paths:verify` |
| Helm artifacts feed graph fragments. | Inheritance graphs and edge-recovery CSV. | `npm run edges:verify` |

## Live Observation Witness

Live observation lanes may write additional cub-scout receipts when a compatible
`cub-scout` binary is available. Use cub-scout v2.4.0 or newer for the full
standalone install-verification set: object-set matching, prerequisites,
workload convergence, closed-world extras, freshness TTLs, and standalone
three-way drift from rendered files.

These receipts answer runtime questions that render parity cannot answer:

| Receipt | Question |
| --- | --- |
| `cub-scout.object-set.receipt.json` | Are the rendered objects present live, with authored fields matching? |
| `cub-scout.closed-world.receipt.json` | Are there extra live objects of the rendered kinds in scope? Extra objects are usually WATCH evidence, not automatically a failed install. |
| `cub-scout.workloads.receipt.json` | Did the desired workloads converge to a usable runtime state? |
| `cub-scout.prerequisites.receipt.json` | Are declared target facts, such as required Secrets or CRDs, present? |

These receipts belong to live runs only. They are not part of the deterministic
render, recipe, package, or `npm run verify` path.

## Confidence Tiers

| Corpus | What it means |
| --- | --- |
| top-20 | Bespoke catalog entries with declared base variants and the broadest live evidence. |
| top-100 | Maintained recipe/package proof artifacts. Some are catalog-supported; most are proof-grade and need promotion review or user-shaped variants. |
| top-500 | Source-feature and catalog-planning reconnaissance. It shows where Helm pain appears, not that every chart is ready to install. |

## How To Use The Tables

1. Pick a chart in [CATALOG.md](../../CATALOG.md).
2. Open the per-chart catalog page at `recipes/<repo>/<chart>/<version>/CATALOG.md`.
3. Check [Status Dashboard](../../data/status-dashboard/summary.md) for the current aggregate state.
4. Check [chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) for the chart-level status.
5. Check [top20 base readiness](../../data/top20-base-readiness/summary.md) when the question is "which public catalog base should I try first?"
6. Check [production disposition](../../data/production-disposition/summary.md) when the question is "is this ready for production-support review, and what remains before support?"
7. Check [production disposition details](../../data/production-disposition/dispositions.md) when the question is "what evidence closes this production blocker?"
8. Check [production next actions](../../data/production-disposition/next-actions.csv) when the question is "what production decision, image digest work, runtime scope, or support action should we work on next?"
9. Check [scan disposition workdown](../../data/scan-disposition-workdown/summary.md) when the question is "is this scan finding a fix, a hardened base, an acceptance, or a runtime review?"
10. Check [image digest workdown](../../data/image-digest-workdown/summary.md) when the question is "are rendered images reproducible enough for production OCI?"
11. Check [next-ten waves](../../data/next-ten-waves/summary.md) when the question is "what compact work queue should we pick from next?"
12. Check [attack-plan workdown](../../data/attack-plan-workdown/summary.md) when the question is "what is the broader generated workdown?"
13. Check the `workability` column in [readiness.csv](../../data/top100-readiness/readiness.csv) when the question is "can I use this chart now?"
14. Check [top500 review.csv](../../data/top500-catalog-analysis/review.csv) when the question is how the retained top500 source scan maps to current proof.
15. Filter [base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) by chart to see each base variant.
16. Check [feature-outcomes.csv](../../data/outcome-coverage/feature-outcomes.csv) for hooks, CRDs, generated facts, target facts, and other chart-specific behavior.
17. Check [pain-points.csv](../../data/pain-point-coverage/pain-points.csv) for the general Helm pain being addressed.
18. Check [coverage-matrix.csv](../../data/variant-path-coverage/coverage-matrix.csv) when the question is about one base, diff, operation, or derived variant path.
19. Check [derived-variant-outcomes.csv](../../data/outcome-coverage/derived-variant-outcomes.csv) when the question is about post-render ConfigHub variants.
20. Check [cert-manager and External Secrets lifecycle observations](../../data/lifecycle-observations/cert-manager-eso/summary.md) when the question is about controller-owned fields or post-apply readiness.
21. Run the scoped verifier for the table you opened, or `npm run verify` only when you need the full corpus gate.

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
two-cluster live parity
lifecycle observed
production-review-ready
production-supported
```

A `missing` row means the exact chart/base/variant/feature has no committed
receipt for that lane yet. A `blocked`, `watch`, or `fail` row means there is a
receipt and the result is part of the evidence.
