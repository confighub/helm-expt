EXPERIMENTAL

# Documentation Map

This directory contains the manual documentation for the Helm experiment. The
primary user-facing surface should stay small. Most Markdown files in the repo
are generated catalog, recipe, package, proof, or run-output files.

## Primary User Docs

These are the files a new user should be able to follow without reading the
whole repo. For the single serial order through `docs/user/*.md`, start with
[user/README.md](./user/README.md).

| File | Role |
| --- | --- |
| [../README.md](../README.md) | Main user introduction: why the repo exists, what is proven, and how to try it. |
| [../CATALOG.md](../CATALOG.md) | Generated chart catalog: charts first, recommended variants underneath. |
| [user/README.md](./user/README.md) | Serial reading order for the manual user docs. |
| [what-you-get.md](./user/what-you-get.md) | Compact product model: what ConfigHub adds around Helm output, what is proven, and what remains product work. |
| [outcomes-and-tests.md](./user/outcomes-and-tests.md) | User-facing outcome and test map, with links to the front-door CSVs. |
| [helm-pain-points.md](./user/helm-pain-points.md) | User-facing map from common Helm pain points to current proof, handoffs, and per-chart reports. |
| [why-this-exists.md](./user/why-this-exists.md) | Skeptical entry point: why this is not just `cub helm install` or `cub gitops import`, and what the catalog/proof path adds. |
| [tutorial-sequence.md](./user/tutorial-sequence.md) | Short show-and-tell tutorials for Redis, variants, overlays, GitOps, and bulk ops. |
| [current-proof-status.md](./user/current-proof-status.md) | Short guide to current proof status and the generated summaries that are authoritative. |
| [verification-lanes.md](./user/verification-lanes.md) | Plain-English definition of each verification lane and the commands that check them. |
| [how-the-harness-works.md](./user/how-the-harness-works.md) | Short technical explanation of the harness lifecycle and where user value is created. |
| [introduction-to-the-harness.md](./user/introduction-to-the-harness.md) | Detailed recipe-generation workflow and the table for where Helm pieces belong. |
| [creating-variants.md](./user/creating-variants.md) | Simple guide to base variants, derived ConfigHub variants, AI assistant tasks, and bulk creation. |
| [cub-variant-command-surface.md](./user/cub-variant-command-surface.md) | Current `cub variant create` command surface and how Space/Unit metadata maps to derived variants. |
| [change-routing-before-oci.md](./user/change-routing-before-oci.md) | Short guide for choosing a base variant, derived ConfigHub variant, or delivery prerequisite before OCI handoff. |
| [adopting-existing-apps.md](./user/adopting-existing-apps.md) | How existing Argo, Flux, KRM, rendered-manifest, and live-resource apps enter the ConfigHub model. |
| [custom-overlays.md](./user/custom-overlays.md) | Plain-English ExternalDNS example for wrapper charts, platform values, customer overlay values, and target facts. |
| [prometheus-overlay-promotion-example.md](./user/prometheus-overlay-promotion-example.md) | Worked Prometheus example for a values overlay and a ConfigHub-only promotion variant. |
| [product-support-tiers.md](./user/product-support-tiers.md) | Which Helm scenarios fit the public catalog, managed imports, or commercial support. |
| [hook-lifecycle-strategy.md](./user/hook-lifecycle-strategy.md) | How Helm hooks are inventoried, classified, translated, or blocked. |
| [maintenance-sla.md](./user/maintenance-sla.md) | How catalog entries are refreshed, patched, and supported. |
| [demo/redis/demo-script.md](demo/redis/demo-script.md) | Runnable Redis walkthrough. |
| [demo/redis/ux-acceptance.md](demo/redis/ux-acceptance.md) | Redis demo acceptance criteria. |
| [demo/redis/function-scan-lane.md](demo/redis/function-scan-lane.md) | Redis ConfigHub function scan lane. |
| [demo/redis/safe-ops-lane.md](demo/redis/safe-ops-lane.md) | Redis safe operation lane. |
| [../tests/README.md](../tests/README.md) | Test directory map: npm verification scripts and portable runtime tests. |
| [../tests/npm-scripts.md](../tests/npm-scripts.md) | What each npm script family checks, why it exists, and when to run it. |

This list is the intended public reading path. Generated package docs, recipe
catalog pages, data summaries, and per-chart proof transcripts are corpus
evidence. They should be linked when useful, but they are not the first-run
documentation set.

## Generated And Reference Markdown

| Location | Role |
| --- | --- |
| `recipes/<repo>/<chart>/<version>/README.md` | Generated recipe summary for one chart/version. |
| `recipes/<repo>/<chart>/<version>/CATALOG.md` | Generated per-chart catalog page with supported variants, revisions, receipts, and package links. |
| `recipes/<repo>/<chart>/<version>/weirdness-and-mitigations.md` | Chart-specific notes for top-20 proof entries. |
| `packages/<repo>/<chart>/<version>/README.md` | Generated `cub installer` package usage note. This is package reference, not a primary user guide. |
| `docs/demo/<chart>/confighub-proof.md` | Per-chart ConfigHub proof summary. Corpus evidence. |
| `docs/demo/<chart>/confighub-proof-transcript.md` | Per-chart command transcript and observed outputs. Corpus evidence. |
| `data/*/summary.md` | Generated status, review, or matrix summary. |
| `data/README.md` | Generated data index and start-here guide for CSVs. |
| `data/csv-index.csv` | Generated machine-readable index of every CSV under `data/`. |
| `data/outcome-coverage/*.csv` | Front-door CSVs for chart, base, derived variant, and feature outcomes. |
| `data/latest-top20-refresh/candidates/README.md` | Generated summary for latest-version candidate proofs. |
| `runs/**/*.md` | Generated execution output from Pilot or other run harnesses. These are receipts/log summaries, not narrative docs. |

Do not hand-edit generated Markdown unless the generator is also updated.

## Manual Docs By Role

### Core Model And Harness

| File | Role |
| --- | --- |
| [chart-recipe-manifest-flow.md](./reference/chart-recipe-manifest-flow.md) | Canonical object model: chart, recipe, variant, revision, rendered objects, receipts. |
| [tutorial-sequence.md](./user/tutorial-sequence.md) | Sequential tutorial flow with commands and expected results. |
| [current-proof-status.md](./user/current-proof-status.md) | User-facing entry point for current proof status. |
| [outcomes-and-tests.md](./user/outcomes-and-tests.md) | User-facing map from promised outcomes to tests, CSVs, and commands. |
| [helm-pain-points.md](./user/helm-pain-points.md) | User-facing map from common Helm pain points to helm-expt, ConfigHub, installer, and live-observation answers. |
| [verification-lanes.md](./user/verification-lanes.md) | User-facing explanation of proof lanes and command checks. |
| [how-the-harness-works.md](./user/how-the-harness-works.md) | Lifecycle-stage explanation of the harness. |
| [introduction-to-the-harness.md](./user/introduction-to-the-harness.md) | Detailed import workflow, recipe decisions, and hook policy. |
| [creating-variants.md](./user/creating-variants.md) | Simple user guide for base variants, derived ConfigHub variants, AI assistant tasks, and bulk creation. |
| [cub-variant-command-surface.md](./user/cub-variant-command-surface.md) | Current `cub variant create` syntax, labels, annotations, targets, gates, and non-current variant verbs. |
| [change-routing-before-oci.md](./user/change-routing-before-oci.md) | User-facing routing guide for base variants, derived variants, and delivery prerequisites before OCI handoff. |
| [adopting-existing-apps.md](./user/adopting-existing-apps.md) | User-facing adoption path for existing Argo, Flux, KRM, rendered-manifest, and live-resource apps. |
| [custom-overlays.md](./user/custom-overlays.md) | ExternalDNS managed overlay example with wrapper chart, platform values, customer values, target facts, and ConfigHub variant routing. |
| [prometheus-overlay-promotion-example.md](./user/prometheus-overlay-promotion-example.md) | Concrete Prometheus example showing when an overlay becomes an installer base and when a change is ConfigHub-only. |
| [product-support-tiers.md](./user/product-support-tiers.md) | Free, public, managed, and commercial support boundaries. |
| [maintenance-sla.md](./user/maintenance-sla.md) | Catalog maintenance and update expectations. |

### Tutorial UX Proposal Companions

These are product sketches linked from
[tutorial-sequence.md](./user/tutorial-sequence.md). They are not extra first-pass
requirements; they show how each tutorial's CLI steps could become a simpler
human-facing Creator-style flow backed by formal contracts, AX/FX, and current
ConfigHub primitives.

| File | Role |
| --- | --- |
| [ux-proposal-redis-quick-start-tutorial.md](./user/ux-proposal-redis-quick-start-tutorial.md) | Proposal for turning the Redis quick-start render/upload path into an intent-first base creation flow. |
| [ux-proposal-redis-secret-modes-tutorial.md](./user/ux-proposal-redis-secret-modes-tutorial.md) | Proposal for presenting generated Secret versus existing Secret as a base-variant choice with target fact checks. |
| [ux-proposal-prometheus-base-variant-tutorial.md](./user/ux-proposal-prometheus-base-variant-tutorial.md) | Proposal for presenting Prometheus server-only as a base-variant creation flow. |
| [ux-proposal-prometheus-promotion-tutorial.md](./user/ux-proposal-prometheus-promotion-tutorial.md) | Proposal for presenting Prometheus promotion as a derived ConfigHub Creator flow. |
| [ux-proposal-externaldns-custom-overlay-tutorial.md](./user/ux-proposal-externaldns-custom-overlay-tutorial.md) | Proposal for separating ExternalDNS render-time overlay choices from customer Creator choices. |
| [ux-proposal-gitops-runtime-proof-tutorial.md](./user/ux-proposal-gitops-runtime-proof-tutorial.md) | Proposal for presenting GitOps and runtime proof as publish-and-prove intent. |
| [ux-proposal-bulk-scan-patch-tutorial.md](./user/ux-proposal-bulk-scan-patch-tutorial.md) | Proposal for presenting scan, patch, review, and approve as a single bulk hardening flow. |

### Installer And Proof Contracts

| File | Role |
| --- | --- |
| [artifact-verifier-spec.md](./reference/artifact-verifier-spec.md) | What the artifact verifier must check. |
| [proof-kit-migration.md](./reference/proof-kit-migration.md) | How repeated chart proof scripts are migrated to the shared proof-kit generator/verifier. |
| [customization-algorithm.md](./reference/customization-algorithm.md) | Reference algorithm for values files, overlays, wrapper charts, and post-render variants. |
| [catalog-doctrine.md](./reference/catalog-doctrine.md) | Catalog doctrine: chart → recipes → placeholdered base variants → derived ConfigHub variants. |
| [customization-decision-tree.md](./reference/customization-decision-tree.md) | Design-level routing tree for customization and support outcomes. |
| [complete-corresponding-model.md](./reference/complete-corresponding-model.md) | Completeness contract a supported chart must satisfy. |
| [per-chart-recipes.md](./reference/per-chart-recipes.md) | Method for recommending per-chart recipe + variant counts. |
| [fork-vocabulary.md](./reference/fork-vocabulary.md) | Shared vocabulary for base vs derived variants and how names map. |
| [helm-import-contract.md](./reference/helm-import-contract.md) | Contract for graduating from direct `cub helm install` rendering into maintained `cub installer` recipes. |
| [capability-profile-catalog.md](./reference/capability-profile-catalog.md) | Named Kubernetes capability profiles used during render. |
| [generated-fact-receipts.md](./reference/generated-fact-receipts.md) | Generated secrets, certs, random values, and time-value receipt specification. |
| [observation-freshness-slo.md](./reference/observation-freshness-slo.md) | Freshness states for live observations in a workerless ConfigHub model. |
| [upgrade-rollback-receipts.md](./reference/upgrade-rollback-receipts.md) | Upgrade and rollback receipt shape. |
| [hook-lifecycle-strategy.md](./user/hook-lifecycle-strategy.md) | How Helm hooks are inventoried, classified, translated, or blocked. |
| [direct-cub-helm-model.md](./reference/direct-cub-helm-model.md) | Current `cub helm template` / `cub helm install` roles and how they differ from durable installer recipes. |

### Variants, Promotion, And Operations

| File | Role |
| --- | --- |
| [variant-creation-artifact.md](./reference/variant-creation-artifact.md) | Reference design for guided variant creation over existing ConfigHub capabilities. |
| [cub-variant-command-surface.md](./user/cub-variant-command-surface.md) | User-facing command surface for the current `cub variant create` clone/link substrate. |
| [redis-variant-creation-plan.yaml](./reference/redis-variant-creation-plan.yaml) | Concrete Redis variant creation blueprint. |
| [variant-creator-verification.md](./reference/variant-creator-verification.md) | How Creator previews, checks, receipts, UX, agent, and fleet paths are verified. |
| [derived-variant-live-proof.md](./reference/derived-variant-live-proof.md) | First live `cub variant create` execution receipts for derived ConfigHub variants. |
| [lane-test-doctrine.md](./reference/lane-test-doctrine.md) | Core corpus lane-test doctrine for every chart-recipe-variant row. |
| [two-cluster-parity-harness.md](./reference/two-cluster-parity-harness.md) | Strict Helm-vs-installer live parity contract using two vanilla kind clusters. |
| [variant-promotion-worked-example.md](./reference/variant-promotion-worked-example.md) | Worked promotion examples for Redis and managed overlays. |
| [confighub-promotion-mapping.md](./reference/confighub-promotion-mapping.md) | Mapping between Helm-derived bases, ConfigHub variants, and promotion concepts. |
| [kubara-customized-overlays.md](./corpus/kubara-customized-overlays.md) | Managed wrapper chart plus customer overlay test case. |

Generated proof data for this section lives in:

| Location | Role |
| --- | --- |
| `data/variant-goldens/redis-prod-us-east/` | Generated Redis example: `redis/default` to `prod-us-east` with preview, checks, and receipts. |
| `data/managed-overlay-goldens/external-dns-customer-acme-prod/` | Generated ExternalDNS managed overlay example: wrapper chart plus platform/customer overlay values and route classification. |
| `data/lane-test-matrix/` | Generated lane-test coverage matrix for every chart-recipe-variant row. |
| `runs/derived-variant-execution/` | Live ConfigHub intended-state receipts for derived variant creation. |

### Catalog, Scale, And Refresh

| File | Role |
| --- | --- |
| [helm-community-persona-prd.md](./planning/helm-community-persona-prd.md) | Product requirements for Helm-user personas, free/paid boundaries, and the shift from rendering to day-1/day-2 variant operations. |
| [helm-community-persona-plan.md](./planning/helm-community-persona-plan.md) | Execution plan for making the public repo and catalog valuable to different Helm user personas. |
| [helm-community-persona-reference.md](./reference/helm-community-persona-reference.md) | Reference matrix for personas, free/paid capabilities, day-0/day-1/day-2 value, and variant routing decisions. |
| [catalog-promotion-review.md](./planning/catalog-promotion-review.md) | Rules for deciding whether a proven chart becomes catalog-supported. |
| [catalog-promotion-next-candidates.md](./planning/catalog-promotion-next-candidates.md) | Candidate charts for the next promotion wave. |
| [top20-full-proof-target.md](./planning/top20-full-proof-target.md) | Definition and status of the top-20 full proof milestone. |
| [top100-full-proof-target.md](./planning/top100-full-proof-target.md) | Definition and status of the top-100 proof surface. |
| [top500-matrix-refresh-review.md](./planning/top500-matrix-refresh-review.md) | How the top-500 analysis should be regenerated and interpreted. |
| [latest-top20-refresh-plan.md](./planning/latest-top20-refresh-plan.md) | Latest-version refresh plan for the supported top-20 charts. |
| [legacy-patch-review.md](./planning/legacy-patch-review.md) | Review lane for older chart versions and patch support. |
| [../data/attack-plan-workdown/summary.md](../data/attack-plan-workdown/summary.md) | Generated workdown for import, gaps, variants, production, runtime/GitOps, latest-version candidates, and image digests. |
| [../data/hook-lifecycle/summary.md](../data/hook-lifecycle/summary.md) | Generated hook lifecycle queue and required receipt paths. |
| [known-adversarial-charts.md](./corpus/known-adversarial-charts.md) | Public chart set used to exercise difficult Helm behaviors. |
| [quirk-coverage.md](./reference/quirk-coverage.md) | Which Helm quirks we track, scan-but-don't-surface, or don't track yet — the honest taxonomy audit. |
| [verification-properties.md](./reference/verification-properties.md) | The catalog's acceptance contract: properties every proven chart must satisfy. |
| [next-20-tasks.md](./planning/next-20-tasks.md) | Distilled near-term catalog task queue. |

### Redis Proof Specs

These files define the first complete proof slice and the checks used by the
Redis demo:

| File | Role |
| --- | --- |
| [redis-proof-spec.md](./reference/redis-proof-spec.md) | Overall Redis proof specification. |
| [redis-installer-package-spec.md](./reference/redis-installer-package-spec.md) | Redis `cub installer` package requirements. |
| [redis-default-variant-spec.md](./reference/redis-default-variant-spec.md) | Default Redis variant requirements. |
| [redis-reuse-existing-secret-variant-spec.md](./reference/redis-reuse-existing-secret-variant-spec.md) | Redis existing-Secret variant requirements. |
| [redis-variant-diff-spec.md](./reference/redis-variant-diff-spec.md) | Expected differences between Redis variants. |
| [redis-local-e2e-spec.md](./reference/redis-local-e2e-spec.md) | Local kind live/e2e proof specification. |
| [redis-local-scan-spec.md](./reference/redis-local-scan-spec.md) | Local scan proof specification. |

### Demo Docs

| Location | Role |
| --- | --- |
| [demo/redis/demo-script.md](demo/redis/demo-script.md) | Redis walkthrough script. |
| [demo/redis/function-scan-lane.md](demo/redis/function-scan-lane.md) | Redis ConfigHub function scan lane. |
| [demo/redis/safe-ops-lane.md](demo/redis/safe-ops-lane.md) | Redis safe operation lane. |
| [demo/redis/ux-acceptance.md](demo/redis/ux-acceptance.md) | Redis UX acceptance criteria. |
| [demo/nginx/confighub-proof-plan.md](demo/nginx/confighub-proof-plan.md) | NGINX proof target plan. |

### Tests

| Location | Role |
| --- | --- |
| [../tests/README.md](../tests/README.md) | Entry point for the repo's test material. |
| [../tests/npm-scripts.md](../tests/npm-scripts.md) | NPM script guide: what, why, how, mutability, and recommended checks by change type. |
| [../tests/strategy.md](../tests/strategy.md) | Long-term catalog testing strategy. |
| [../tests/runbook.md](../tests/runbook.md) | Reproducible per-chart runtime test procedure. |
| [../tests/findings.md](../tests/findings.md) | Current runtime findings and guardrails. |
| [../tests/adversarial-strategy.md](../tests/adversarial-strategy.md) | Adversarial usage-test methodology. |

### Planning, Review, And Communications

These files support project planning, review, and public explanation. They are
not the primary user path.

| File | Role |
| --- | --- |
| [agreed-execution-plan.md](./planning/agreed-execution-plan.md) | Consolidated execution plan and project guidance. |
| [current-handover.md](./planning/current-handover.md) | Current pickup snapshot, including the base-variant versus derived ConfigHub variant vocabulary. |
| [large-machine-handover.md](./planning/large-machine-handover.md) | Strict handover for a Codex instance that can run live Kubernetes and GitOps proof lanes. |
| [large-machine-roadmap.md](./planning/large-machine-roadmap.md) | Outcome-driven roadmap for live parity, target-bound derived variants, chart quirks, and docs organization. |
| [next-execution-plan.md](./planning/next-execution-plan.md) | Current execution plan and near-term backlog. |
| [issue-backlog.md](./planning/issue-backlog.md) | Issue index and execution order. |
| [independent-review-brief.md](./planning/independent-review-brief.md) | Brief for an independent product/technical review. |
| [review-prompts.md](./planning/review-prompts.md) | Longer review prompts for structured critique. |
| [pilot-adversarial-testing.md](./planning/pilot-adversarial-testing.md) | Plan for adversarial testing with external automation. |
| [blog-posts.md](./planning/blog-posts.md) | Public writing plan. |
| [dedicated-website-plan.md](./planning/dedicated-website-plan.md) | Standalone website plan. |
| [archive/README.md](./planning/archive/README.md) | Historical planning snapshots retained for traceability. |

## Naming Rules

- User entry points should have plain names: `README.md`, `CATALOG.md`,
  `how-the-harness-works.md`.
- Keep the primary user docs small. Generated proof files are allowed to be
  numerous because they are evidence, not a required reading path.
- Dated files are historical handoff snapshots. New standing plans should use
  undated names.
- Generated files should stay near the artifacts they summarize.
- Recipe-level docs belong under `recipes/`.
- Executable package docs belong under `packages/`.
- Proof summaries and matrix outputs belong under `data/`.
- Product guidance and implementation plans belong under `docs/`.
