# Current Handover

This is the current handover for the `helm-expt` repository. It is intended for
another engineer or agent picking up the work from public `main`.

For the next Codex running on a machine that can perform live Kubernetes and
GitOps testing, start with:

```text
docs/planning/large-machine-handover.md
docs/planning/large-machine-roadmap.md
```

Those files are stricter than this rolling handover about what "verified",
"live", "all charts", and "derived variant" mean.

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
  -> GitOps/OCI runtime evidence
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
The first GitOps/OCI wave is selected. Two rows are live-proven:
`bitnami/nginx@24.0.2 / http-clusterip` and
`metrics-server/metrics-server@3.13.0 / default`.
Two rows have committed non-pass receipts:
`ingress-nginx/ingress-nginx@4.15.1 / admission-disabled` is watch because the
controller Deployment is Ready but the kind target has no LoadBalancer external
IP.
`external-secrets/external-secrets@2.5.0 / no-crds`.
```

For chart-recipe-variant lane coverage, use the generated lane matrix instead
of chart-level shorthand:

```text
data/lane-test-matrix/summary.md
```

As of the current matrix, all 156 chart-recipe-variant rows have
Helm-equivalence plus installer setup-check evidence. ConfigHub proof,
local-kind evidence, and ConfigHub OCI/Argo live proof are partial by exact
variant row. Live Helm-vs-ConfigHub dual-deploy comparison is a required lane
but does not yet have committed PASS receipts in this repo.

Outcome doctrine:

```text
Every supported Helm chart default and declared main choice should become
verifiably reproducible, ConfigHub-reviewable, live-cluster verified, and tied
to receipts.
```

Do not treat an activity as done just because a script, doc, generated row, or
tutorial exists. The outcome must be visible in committed evidence and guarded
by a verifier. For catalog-supported charts, "main choices" means the default
base plus the declared supported non-default bases such as existing-secret,
no-crds, server-only, ingress, HA, ClusterIP, storage, or equivalent chart
choices. For derived ConfigHub variants, it means the post-render operating
choices that the docs claim are supported: target, environment, region,
customer, gates, facts, links, field fills, checks, and observation policy.

The current honest state is therefore:

```text
render reproducibility: complete for current recipe variants
ConfigHub proof: partial by exact chart-recipe-variant row
local live cluster proof: partial by exact chart-recipe-variant row
GitOps/OCI live proof: two exact rows pass, two exact rows are non-pass, remaining rows backlog
live Helm-vs-ConfigHub parity proof: backlog
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
| Lane-test matrix | [data/lane-test-matrix/summary.md](../../data/lane-test-matrix/summary.md) |

These files are generated and verified. Do not edit them by hand.

## 2026-06-04 Brian-List And Derived-Variant Sync

The near-term TODO list now folds in Brian's "configuration as data" value
lanes and the current `cub variant` command surface. See
[next-20-tasks.md](./next-20-tasks.md) for the active queue and
[issue-backlog.md](./issue-backlog.md) for the issue mirror.

Current CLI truth:

```text
cub variant create
```

`cub variant create` is the current derived-variant substrate. `cub variant
upload`, `cub variant promote`, and `cub variant release` are not current local
commands and should be described only as planned or candidate product lanes.

New issues created from the Brian-list / derived-variant review:

| Issue | Focus |
| --- | --- |
| [#143](https://github.com/confighub/helm-expt/issues/143) | Make `cub variant create` the explicit derived-variant substrate. |
| [#144](https://github.com/confighub/helm-expt/issues/144) | Build a derived-variant expansion wave across top-20 and wave-2 charts. |
| [#145](https://github.com/confighub/helm-expt/issues/145) | Prove promotion and environment management with derived ConfigHub variants. |
| [#146](https://github.com/confighub/helm-expt/issues/146) | Add fleet inventory and CMDB views. |
| [#147](https://github.com/confighub/helm-expt/issues/147) | Prove fleet-scale mutation and codemod workflows. |
| [#148](https://github.com/confighub/helm-expt/issues/148) | Add policy, compliance, and security posture reports. |
| [#149](https://github.com/confighub/helm-expt/issues/149) | Add dependency graph and impact analysis. |
| [#150](https://github.com/confighub/helm-expt/issues/150) | Add Creator and agentic intent flow over `cub variant create`. |
| [#151](https://github.com/confighub/helm-expt/issues/151) | Define variant release and OCI handoff semantics. |
| [#152](https://github.com/confighub/helm-expt/issues/152) | Define promotion UI expectations for clean variant diffs. |
| [#153](https://github.com/confighub/helm-expt/issues/153) | Reposition GitOps tutorial around Argo/OCI and bridge-independent proof. |

The most important gap is now explicit: the repo still needs more derived
ConfigHub variants with execution receipts. Issue #144 now has a generated
starting wave under
[data/variant-goldens/derived-expansion-wave/](../../data/variant-goldens/derived-expansion-wave/):
10 derived-variant work orders across Redis, Prometheus, NGINX, Grafana, and
Vault. Each work order now has golden clone, mutation, and check receipt targets
under `receipts/<work-order>/`. These are explicit proof targets, not live
execution receipts.

2026-06-05 update: live derived-variant execution receipts now exist for all 10
work orders in the first derived expansion wave: NGINX, Redis, Prometheus,
Grafana, and Vault. The receipts prove clone/link preservation, same final
data-hash set as the reviewed base, production gates where the work order asks
for them, and no Helm re-render. Grafana required one corrective update per
derived variant because the initial clone replaced one duplicated 9094 port's
`name` and `protocol` with `confighubplaceholder`; the receipts record that
friction explicitly. The active ConfigHub context did not have the desired
work-order targets, so these receipts intentionally stop before target binding
and live apply:

```text
runs/derived-variant-execution/nginx-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/nginx-customer-acme-prod/variant-create-receipt.yaml
runs/derived-variant-execution/redis-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/redis-staging-eu-west/variant-create-receipt.yaml
runs/derived-variant-execution/prometheus-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/prometheus-staging-eu-west/variant-create-receipt.yaml
runs/derived-variant-execution/grafana-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/grafana-customer-acme-prod/variant-create-receipt.yaml
runs/derived-variant-execution/vault-regulated-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/vault-staging-us-east/variant-create-receipt.yaml
npm run derived-variants:verify
```

Redis's ConfigHub proof receipt was also refreshed through the common top-20
ConfigHub proof lane. The Redis-specific verifier now checks the common
`upload.kubernetesUnitCount` and `serverSideVariant.downstreamSpace` fields, so
Redis no longer preserves the older receipt schema as a special case.

The next derived-variant step is target-bound live apply: create or select the
desired targets, attach them to a subset of these derived Spaces, and record
live Kubernetes receipts. The Grafana placeholder drift is tracked in
[#156](https://github.com/confighub/helm-expt/issues/156) as a follow-up issue
against clone/upgrade behavior.

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
| Which derived ConfigHub variant capability has receipt-style proof? | [data/variant-goldens/redis-prod-us-east/preview.yaml](../../data/variant-goldens/redis-prod-us-east/preview.yaml) shows one Redis default-to-prod clone with three changed paths and one preserved upstream-link change. [data/variant-goldens/derived-expansion-wave/README.md](../../data/variant-goldens/derived-expansion-wave/README.md) adds 10 derived-variant work orders across five reviewed bases. |
| Which managed overlay route proves a creator path? | [data/managed-overlay-goldens/external-dns-customer-acme-prod/preview.yaml](../../data/managed-overlay-goldens/external-dns-customer-acme-prod/preview.yaml), currently showing six classified overlay routes, including one creator route. |

Important gap:

```text
The big Top-500 sheet does not yet count derived ConfigHub variant opportunity.
It counts current base variant proof status and maps source problem-space
complexity. Derived variant reach is now represented by goldens, the generated
derived-expansion wave, and managed-overlay examples, not yet by scaled
Top-500 catalog metrics.
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
Every task should state the outcome it will prove, the evidence artifact that proves it, and the verifier that keeps it current.
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
| What derived-variant expansion wave exists? | [data/variant-goldens/derived-expansion-wave/README.md](../../data/variant-goldens/derived-expansion-wave/README.md) |
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

## Suggested Next Tasks

Use [next-20-tasks.md](./next-20-tasks.md) as the single active TODO queue. The
headline order is:

1. Make `cub variant create` current and explicit in docs, Tutorial 4, UX
   proposals, and command-surface verification (#143).
2. Build the derived-variant expansion wave so derived ConfigHub variants get
   real use across multiple charts (#144).
3. Prove promotion and environment management with derived ConfigHub variants
   (#145).
4. Close the open Helm import path P0 (#76).
5. Continue wave-2 base-variant promotion, production disposition, target
   facts, GitOps/Argo proof, release/OCI semantics, promotion UI expectations,
   fleet inventory, fleet mutation, policy/security posture, and impact
   analysis in the order listed in `next-20-tasks.md`.

## What Not To Do

Do not add another planning document when an existing generated work queue can
be refreshed instead.

Do not mark a catalog entry production-supported because it has local-kind
evidence. Production support needs the production-disposition lane, image
digest handling, and runtime/GitOps evidence.

Do not make the user-facing docs longer to explain internal proof machinery.
Link to generated evidence from the docs instead.

Do not file issues outside this repository without explicit approval.
