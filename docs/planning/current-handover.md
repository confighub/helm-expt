# Current Handover

This is the current handover for the `helm-expt` repository. It is intended for
another engineer or agent picking up the work from public `main`.

## Repository State

The repository is a public proof corpus for turning popular public Helm charts
into reviewed `cub installer` packages, supported base variants, rendered
objects, scans, receipts, and live-test evidence.

The current public path is:

```text
Helm chart
  -> analyzed chart facts and control points
  -> cub installer package
  -> supported base variants
  -> rendered Kubernetes objects
  -> ConfigHub upload and operation receipts
  -> local runtime evidence
  -> planned GitOps/OCI runtime evidence
```

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
| Image digest workdown | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) |
| Compact next-ten waves | [data/next-ten-waves/summary.md](../../data/next-ten-waves/summary.md) |

These files are generated and verified. Do not edit them by hand.

## Current Invariants

Keep these rules intact:

```text
Use `cub installer` terminology consistently.
Do not claim GitOps/OCI proof unless a runtime/GitOps receipt exists.
Do not claim production support while production_disposition remains blocked.
Mutable or latest image tags are acceptable for local proof only.
Production OCI support needs image digest evidence or an explicit image override receipt.
If a choice changes rendered Kubernetes objects, route it through the installer package/base path.
If a choice only changes target, labels, links, approvals, gates, or observation policy, route it through ConfigHub variants.
Generated data must have a verify script that fails if committed output is stale.
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
| What image pinning work remains? | [data/image-digest-workdown/summary.md](../../data/image-digest-workdown/summary.md) |
| What are the next compact work rows? | [data/next-ten-waves/summary.md](../../data/next-ten-waves/summary.md) |

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
npm run image-digests:workdown:verify
npm run next-ten:waves:verify
npm run site:verify
```

Before merging broad changes:

```sh
npm run verify
```

The full verify chain is expected to pass on a clean checkout.

## Next Work

The next work should proceed in this order.

1. Run the first runtime/GitOps wave from
   [data/runtime-gitops/wave1.csv](../../data/runtime-gitops/wave1.csv).
   Commit receipts under `data/runtime-gitops/receipts/`.
2. Resolve image digests for the first priority subjects in
   [data/image-digest-workdown/priority-subjects.csv](../../data/image-digest-workdown/priority-subjects.csv).
3. Write production-disposition receipts for the first five rows in
   [data/next-ten-waves/production-disposition-wave.csv](../../data/next-ten-waves/production-disposition-wave.csv).
4. Work the six latest-version candidates in
   [data/next-ten-waves/latest-promotion-wave.csv](../../data/next-ten-waves/latest-promotion-wave.csv).
5. Build and prove the wave-2 variant rows in
   [data/next-ten-waves/variant-build-wave.csv](../../data/next-ten-waves/variant-build-wave.csv).
6. Review the first gap rows in
   [data/next-ten-waves/gap-review-wave.csv](../../data/next-ten-waves/gap-review-wave.csv).
7. Turn the import examples in
   [data/next-ten-waves/import-prototype-wave.csv](../../data/next-ten-waves/import-prototype-wave.csv)
   into an executable installer-backed import prototype when the installer
   surface exists.

## What Not To Do

Do not add another planning document when an existing generated work queue can
be refreshed instead.

Do not mark a catalog entry production-supported because it has local-kind
evidence. Production support needs the production-disposition lane, image
digest handling, and runtime/GitOps evidence.

Do not make the user-facing docs longer to explain internal proof machinery.
Link to generated evidence from the docs instead.

Do not file issues outside this repository without explicit approval.
