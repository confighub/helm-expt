# Current Handover

This is the current handover for the `helm-expt` repository. It is intended for
another engineer or agent picking up the work from public `main`.

## Repository State

The repository is a public proof corpus for turning popular public Helm charts
into reviewed `cub installer` packages, supported base variants, rendered
objects, scans, receipts, and live-test evidence.

In this handover, **base variant** means a render-time installer/package
variant. **Derived ConfigHub variant** means a downstream ConfigHub variant
created after a reviewed base has been uploaded, using clone/link plus approved
post-render refinements. The public catalog primarily proves base variants.
Derived variants are still part of the product model, but they appear after
upload when a deployment needs target, environment, region, customer, namespace
field, fact binding, placeholder, TransformPaths, function, gate, link, check,
or observation-policy changes without re-rendering Helm.

The current public path is:

```text
Helm chart
  -> analyzed chart facts and control points
  -> cub installer package
  -> supported base variants that change or select the Helm-rendered object set
  -> rendered Kubernetes objects
  -> ConfigHub upload receipts
  -> optional derived ConfigHub variants for approved post-render fields, facts, targets, gates, links, checks, or observation policy
  -> operation receipts
  -> local runtime evidence
  -> planned GitOps/OCI runtime evidence
```

If a reader sees "supported variants" in generated catalog evidence, read that
as "supported base variants" unless the artifact explicitly says it is a
derived ConfigHub variant.

The current proof surface is:

```text
100 charts have recipe/package proof artifacts.
20 charts are catalog-supported for the declared local-test scope.
20/20 top-20 charts have local-kind runtime receipts.
20/20 top-20 charts have ConfigHub proof receipts.
80 additional charts are proof-grade, not catalog-supported.
The first GitOps/OCI wave is selected but not yet live-proven.
```

The top-level public entry points are [README.md](../../README.md),
[CATALOG.md](../../CATALOG.md), and the generated static site under
[site/](../../site/).

## Latest Completed Work

The latest completed work added generated queues for the next proof stages:

| Area | Artifact |
| --- | --- |
| Runtime/GitOps first wave | [data/runtime-gitops/summary.md](../../data/runtime-gitops/summary.md) |
| Hook lifecycle wave | [data/hook-lifecycle/summary.md](../../data/hook-lifecycle/summary.md) |
| Image digest workdown | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) |
| Compact next-ten waves | [data/next-ten-waves/summary.md](../../data/next-ten-waves/summary.md) |

These files are generated and verified. Do not edit them by hand.

## 2026-06-03 Variant And Spreadsheet Findings

Today's review found that the public data tracks **base/render variants** and
Helm problem-space signals, but it does not yet track derived ConfigHub variant
opportunity as a first-class Top-500 metric.

Current Top-500 counts:

```text
rows: 500
source scanned: 495
source failed: 5
current proof recipes in repo: 100
current proof recipes matched to old matrix rows: 91
no current recipe proof: 409
catalog-supported rows: 20
proof-grade rows: 71
default-only proofs: 41
multi-variant proofs: 50
matched proof variants/revisions in top-500 rows: 143
catalog-supported base variants in matched top-500 rows: 40
```

Current Top-500 next-action counts:

```text
review source/current-version drift and refresh recipe if needed: 21
add production dispositions and live/e2e observation lane: 15
run catalog promotion review: 24
create recipe, package, variants, rendered digest, scans, and receipts: 404
add user-shaped variants before catalog promotion: 31
repair source acquisition before recipe proof: 5
```

Where the counts live:

| Question | Current tracking |
| --- | --- |
| How many rows have proof, support, package, and variant status? | [data/top500-catalog-analysis/review.csv](../../data/top500-catalog-analysis/review.csv) and [data/top500-catalog-analysis/raw.json](../../data/top500-catalog-analysis/raw.json). |
| How do those rows map to the Helm problem-space? | [data/top500-catalog-analysis/drilldown.csv](../../data/top500-catalog-analysis/drilldown.csv) and `raw.json` columns such as `source_features`, `lookup_count`, `tpl_count`, `crd_files_count`, `cluster_roles_count`, `webhooks_count`, `stateful_sets_count`, `pvc_count`, and proof control categories. |
| Which concrete base/render variants are next? | [data/catalog-promotion-wave2/summary.md](../../data/catalog-promotion-wave2/summary.md), [data/catalog-promotion-wave2/variant-work-orders.md](../../data/catalog-promotion-wave2/variant-work-orders.md), and [data/next-ten-waves/variant-build-wave.csv](../../data/next-ten-waves/variant-build-wave.csv). |
| Which derived ConfigHub variant capability has a receipt-style golden? | [data/variant-goldens/redis-prod-us-east/preview.yaml](../../data/variant-goldens/redis-prod-us-east/preview.yaml), currently showing one Redis default-to-prod clone with three changed paths and one preserved upstream-link change. |
| Which managed overlay route proves a creator path? | [data/managed-overlay-goldens/external-dns-customer-acme-prod/preview.yaml](../../data/managed-overlay-goldens/external-dns-customer-acme-prod/preview.yaml), currently showing six classified overlay routes, including one creator route. |

Important gap:

```text
The big Top-500 sheet does not yet count derived ConfigHub variant opportunity.
It counts current base variant proof status and maps source problem-space
complexity. Derived variant reach is currently represented by goldens and
managed-overlay examples, not by scaled catalog metrics.
```

The next Top-500 generator update should add generated fields or a generated
companion table for:

```text
base_variant_opportunity_count
derived_variant_opportunity_count
delivery_prerequisite_count
variant_route_mix
derived_variant_routes
problem_space_tags
recommended_variant_strategy
```

Recommended `recommended_variant_strategy` values:

```text
needs-recipe-first
base-only
base-plus-derived
managed-overlay
delivery-prerequisite-first
```

The Top-500 front sheet is `review.csv`. The generator and verifier now check
that the summary's advertised outputs exist.

## Current Invariants

Keep these rules intact:

```text
Use `cub installer` terminology consistently.
Do not claim GitOps/OCI proof unless a runtime/GitOps receipt exists.
Do not claim production support while production_disposition remains blocked.
Mutable or latest image tags are acceptable for local proof only.
Production OCI support needs image digest evidence or an explicit image override receipt.
If a choice changes Helm render inputs, object count, object shape, or lifecycle semantics, route it through the installer package/base path.
If a choice refines already-rendered ConfigHub Units through approved fields, facts, links, targets, gates, functions, checks, or observation policy, route it through derived ConfigHub variants.
Do not imply derived ConfigHub variants replace base variants for render-time object changes.
Do not describe derived ConfigHub variants as catalog-supported unless receipts prove the uploaded-base-plus-derived-variant path.
Generated data must have a verify script that fails if committed output is stale.
```

## Variant Vocabulary

Use this wording consistently in user-facing docs:

| Term | Meaning | Use when |
| --- | --- | --- |
| Base variant | A reviewed install shape produced by `cub installer`. | Helm values, overlays, capabilities, generated facts, target facts, lifecycle policy, or component choices change the Helm-rendered object set, object shape, or lifecycle behavior. |
| Derived ConfigHub variant | A downstream ConfigHub Space/Unit set created from an uploaded reviewed base or another derived variant. It does not run Helm again. | The reviewed object set is cloned and refined through approved post-render fields, facts, links, targets, gates, functions, checks, approvals, or observation policy. |
| Delivery prerequisite | A required condition or binding outside the artifact path. | Kubernetes, GitOps, OCI, or the target cluster needs a Secret, CRD, StorageClass, digest, pull credential, controller, approval, or other evidence before delivery. |

Short rule:

```text
Helm render or object shape changes -> base variant.
Approved post-render refinement changes -> derived ConfigHub variant.
Delivery blocker remains -> delivery prerequisite.
```

## Important Generated Data

Use these generated summaries together:

| Question | Read |
| --- | --- |
| What can a user install now? | [CATALOG.md](../../CATALOG.md) |
| What does each chart prove? | [data/top100-catalog-analysis/summary.md](../../data/top100-catalog-analysis/summary.md) |
| What quirks and hard gaps remain? | [data/chart-facts/summary.md](../../data/chart-facts/summary.md) |
| What did we learn from the top 500? | [data/top500-catalog-analysis/summary.md](../../data/top500-catalog-analysis/summary.md) |
| What is the current attack-plan queue? | [data/attack-plan-workdown/summary.md](../../data/attack-plan-workdown/summary.md) |
| What is the first GitOps/OCI wave? | [data/runtime-gitops/summary.md](../../data/runtime-gitops/summary.md) |
| Which maintained charts need hook lifecycle receipts? | [data/hook-lifecycle/summary.md](../../data/hook-lifecycle/summary.md) |
| What image pinning work remains? | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) |
| What are the next compact work rows? | [data/next-ten-waves/summary.md](../../data/next-ten-waves/summary.md) |
| Which top-20 versions need refresh? | [data/latest-top20-refresh/summary.md](../../data/latest-top20-refresh/summary.md) |
| Which charts are next for real variants? | [data/catalog-promotion-wave2/summary.md](../../data/catalog-promotion-wave2/summary.md) |
| What derived-variant golden exists? | [data/variant-goldens/redis-prod-us-east/README.md](../../data/variant-goldens/redis-prod-us-east/README.md) |
| What managed-overlay creator route exists? | [data/managed-overlay-goldens/external-dns-customer-acme-prod/preview.yaml](../../data/managed-overlay-goldens/external-dns-customer-acme-prod/preview.yaml) |

## User Documentation

The primary user docs are under [docs/user](../user/). They should stay short,
plain, and concrete. Do not move generated proof transcripts into the user path.

Important user guides:

| Topic | File |
| --- | --- |
| Harness lifecycle | [how-the-harness-works.md](../user/how-the-harness-works.md) |
| Recipe-generation workflow | [introduction-to-the-harness.md](../user/introduction-to-the-harness.md) |
| Base and derived variants | [creating-variants.md](../user/creating-variants.md) |
| Change routing before OCI | [change-routing-before-oci.md](../user/change-routing-before-oci.md) |
| Custom overlays | [custom-overlays.md](../user/custom-overlays.md) |
| Prometheus overlay and promotion example | [prometheus-overlay-promotion-example.md](../user/prometheus-overlay-promotion-example.md) |
| Hooks | [hook-lifecycle-strategy.md](../user/hook-lifecycle-strategy.md) |
| Support tiers | [product-support-tiers.md](../user/product-support-tiers.md) |

## Tests And Commands

Start with [tests/npm-scripts.md](../../tests/npm-scripts.md) for the full
command map.

For normal changes:

```sh
npm run docs:verify
npm run installer:command-surface:verify
```

For generated data changes:

```sh
npm run attack-plan:verify
npm run runtime-gitops:wave:verify
npm run hooks:lifecycle:verify
npm run image-digests:workdown:verify
npm run next-ten:waves:verify
npm run top20:verify-local-e2e
npm run production:disposition:verify
npm run catalog:wave2:verify
npm run top20:latest-refresh:verify
npm run top20:latest-candidates:verify
npm run top20:latest-promotion-readiness:verify
npm run site:verify
```

Before merging broad changes:

```sh
npm run verify
```

The full verify chain is expected to pass on a clean checkout.

## Suggested Next 20 Tasks

The next work should proceed in this order.

1. Add Top-500 generated columns for `base_variant_opportunity_count`,
   `derived_variant_opportunity_count`, `delivery_prerequisite_count`,
   `variant_route_mix`, `derived_variant_routes`, `problem_space_tags`, and
   `recommended_variant_strategy`.
2. Add a generated derived-route taxonomy so base/render changes,
   post-render ConfigHub refinements, and delivery prerequisites classify the
   same way in docs, CSV, JSON, and receipts.
3. Add a compact Top-500 summary section that rolls up base-only,
   base-plus-derived, managed-overlay, delivery-prerequisite-first, and
   needs-recipe-first counts.
4. Add the same strategy columns to the wave-2 candidate review so each
   proposed variant says whether it is a base variant, derived ConfigHub
   variant, or delivery prerequisite.
6. Run the first runtime/GitOps wave from
   [data/runtime-gitops/wave1.csv](../../data/runtime-gitops/wave1.csv)
   and commit receipts under `data/runtime-gitops/receipts/`.
7. Resolve image digests for the first priority subjects in
   [data/image-digest-workdown/priority-subjects.csv](../../data/image-digest-workdown/priority-subjects.csv).
8. Write production-disposition receipts for the first five rows in
   [data/next-ten-waves/production-disposition-wave.csv](../../data/next-ten-waves/production-disposition-wave.csv).
9. Work the six latest-version candidates in
   [data/next-ten-waves/latest-promotion-wave.csv](../../data/next-ten-waves/latest-promotion-wave.csv).
10. Build and prove the wave-2 variant rows in
    [data/next-ten-waves/variant-build-wave.csv](../../data/next-ten-waves/variant-build-wave.csv).
11. Build and prove the `traefik/traefik@40.2.0` wave-2 base variants:
    `default`, `external-crds`, `internal-clusterip-dashboard-off`, and
    `cloud-loadbalancer`.
12. Build and prove the `external-dns/external-dns@1.21.1` wave-2 base
    variants: `route53-irsa`, `cloudflare-existing-secret`, and
    `dry-run-txt-registry`.
13. Build and prove the `vmware-tanzu/velero@12.0.1`,
    `istio-official/istiod@1.30.0`, and `kyverno/kyverno@3.8.1` wave-2 base
    variants from the generated work orders.
14. Add at least one wave-2 derived ConfigHub variant golden that starts from
    an uploaded reviewed base and proves clone/link/check receipts without a
    hidden Helm rerender.
15. Add at least one wave-2 managed-overlay classification receipt that routes
    render-time choices to installer/base variants and post-render choices to a
    derived ConfigHub creator path.
16. Extend derived variant receipts to show target, environment, region,
    namespace, fact binding, TransformPaths, upstream-link preservation, checks,
    and route-back-to-installer cases.
17. Review the first gap rows in
    [data/next-ten-waves/gap-review-wave.csv](../../data/next-ten-waves/gap-review-wave.csv).
18. Turn the import examples in
    [data/next-ten-waves/import-prototype-wave.csv](../../data/next-ten-waves/import-prototype-wave.csv)
    into an executable installer-backed import prototype when the installer
    surface exists.
19. Regenerate the public site and catalog pages after the new strategy and
    derived-variant metrics exist.
20. Run the full `npm run verify` chain, then sync to GitHub with a clean
    branch, merged PRs, and no stale generated outputs.

## What Not To Do

Do not add another planning document when an existing generated work queue can
be refreshed instead.

Do not mark a catalog entry production-supported because it has local-kind
evidence. Production support needs the production-disposition lane, image
digest handling, and runtime/GitOps evidence.

Do not make the user-facing docs longer to explain internal proof machinery.
Link to generated evidence from the docs instead.

Do not file issues outside this repository without explicit approval.
