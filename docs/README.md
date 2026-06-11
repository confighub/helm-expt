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
| [offering.md](./user/offering.md) | Public offering overview: why visible Helm stages matter, what is free to try, and where managed ConfigHub workflows begin. |
| [try-now.md](./user/try-now.md) | Short Redis and kube-prometheus-stack paths for first public use. |
| [choose-your-path.md](./user/choose-your-path.md) | Quick route picker for direct render, one-shot upload, public catalog packages, and ConfigHub-managed variants/operations. |
| [serious-chart-proof.md](./user/serious-chart-proof.md) | Concise kube-prometheus-stack proof path for the serious chart example. |
| [what-you-get.md](./user/what-you-get.md) | Compact product model: what ConfigHub adds around Helm output, what is proven, and what remains product work. |
| [choosing-commands.md](./user/choosing-commands.md) | Short guide for choosing `cub helm template`, `cub helm install`, `cub installer`, `cub variant create`, or repo verifiers. |
| [outcomes-and-tests.md](./user/outcomes-and-tests.md) | User-facing outcome and test map, with links to the front-door CSVs. |
| [../data/outcome-evidence-contract/summary.md](../data/outcome-evidence-contract/summary.md) | Generated user-outcome contract: question, status, evidence, verifier command, scope, and next action. |
| [helm-pain-points.md](./user/helm-pain-points.md) | User-facing map from common Helm pain points to current proof, handoffs, and per-chart reports. |
| [why-this-exists.md](./user/why-this-exists.md) | Skeptical entry point: why this is not just `cub helm install` or `cub gitops import`, and what the catalog/proof path adds. |
| [tutorial-sequence.md](./user/tutorial-sequence.md) | Short show-and-tell tutorials for Redis, variants, overlays, GitOps, and bulk ops. |
| [current-proof-status.md](./user/current-proof-status.md) | Short guide to current proof status and the generated summaries that are authoritative. |
| [../data/chart-use-guide/summary.md](../data/chart-use-guide/summary.md) | Generated chart-use guide: one short answer per top-100 chart for use now, promotion review, base-variant work, or limitation decision. |
| [what-we-refuse-to-claim.md](./user/what-we-refuse-to-claim.md) | Trust boundary: why watchlist rows and strict witness blocks remain visible. |
| [../data/claims-register/summary.md](../data/claims-register/summary.md) | Generated claim-to-evidence register for checking whether a public claim is backed, partial, planned, or refused. |
| [why-synced-is-not-working.md](./user/why-synced-is-not-working.md) | Runtime false-green explanation: why sync/object presence does not prove workload health. |
| [why-this-does-not-collapse.md](./user/why-this-does-not-collapse.md) | Skeptic-facing explanation of how hooks, quirks, config volume, and blocked rows are routed. |
| [verify-it-yourself.md](./user/verify-it-yourself.md) | Reader verification commands for corpus checks, rendered installs, parity receipts, and cub-scout receipts. |
| [production-support-decisions.md](./user/production-support-decisions.md) | How a review-ready chart becomes production-supported for one target scope. |
| [chain-of-proof.md](./user/chain-of-proof.md) | Which tool proves which boundary: render, ConfigHub desired state, delivery, and live observation. |
| [top100-readiness.md](./user/top100-readiness.md) | User-facing guide to the top-100 corpus buckets and generated readiness data. |
| [top100-status.md](./user/top100-status.md) | Plain-English top-100 answers: what works today, what needs prerequisites or review, and how it differs from plain Helm. |
| [serious-charts.md](./user/serious-charts.md) | The serious-chart packets: why kube-prometheus-stack, cert-manager, and external-secrets are the hard cases and how to read their status. |
| [verification-lanes.md](./user/verification-lanes.md) | Plain-English definition of each verification lane and the commands that check them. |
| [live-parity.md](./user/live-parity.md) | User-facing guide to pass, watch, blocked, and rerun rows in the live parity lanes. |
| [how-the-harness-works.md](./user/how-the-harness-works.md) | Short technical explanation of the harness lifecycle and where user value is created. |
| [introduction-to-the-harness.md](./user/introduction-to-the-harness.md) | Detailed recipe-generation workflow and the table for where Helm pieces belong. |
| [creating-variants.md](./user/creating-variants.md) | Simple guide to base variants, derived ConfigHub variants, AI assistant tasks, and bulk creation. |
| [cub-variant-command-surface.md](./user/cub-variant-command-surface.md) | Current `cub variant create` command surface and how Space/Unit metadata maps to derived variants. |
| [change-routing-before-oci.md](./user/change-routing-before-oci.md) | Short guide for choosing a base variant, derived ConfigHub variant, or delivery prerequisite before OCI handoff. |
| [adopting-existing-apps.md](./user/adopting-existing-apps.md) | How existing Argo, Flux, KRM, rendered-manifest, and live-resource apps enter the ConfigHub model. |
| [custom-overlays.md](./user/custom-overlays.md) | Plain-English ExternalDNS example for wrapper charts, platform values, customer overlay values, and target facts. |
| [prometheus-overlay-promotion-example.md](./user/prometheus-overlay-promotion-example.md) | Worked Prometheus example for a values overlay and a ConfigHub-only promotion variant. |
| [prometheus-high-fanout.md](./user/prometheus-high-fanout.md) | Kube-prometheus-stack example showing how one base choice changes many objects and target prerequisites. |
| [extension-slots.md](./user/extension-slots.md) | General guide for raw manifests, tpl snippets, sidecars, config blocks, and other NGINX-like extension slots. |
| [nginx-configuration-files.md](./user/nginx-configuration-files.md) | NGINX-specific guide for config-file extension slots, base variants, derived variants, and future `nginx -t` checks. |
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
| `data/status-dashboard/summary.md` | Generated front-door status dashboard for top100, proof lanes, hooks, quirks, GitOps, and live parity. |
| `data/outcome-evidence-contract/summary.md` | Generated front-door map from user-visible outcomes to evidence, verifier commands, limits, and next action. |
| `data/chart-use-guide/summary.md` | Generated front-door guide for whether one top-100 chart can be used now, promoted after review, improved with a better base, or held for a limitation decision. |
| `data/useful-base-design-queue/summary.md` | Generated front-door queue for proof-grade top-100 charts whose current base is too default-shaped to recommend. |
| `data/claims-register/summary.md` | Generated claim-to-evidence register used to keep public claims scoped and reviewable. |
| `data/blast-radius-accuracy/summary.md` | Generated blast-radius accuracy seed: predicted affected objects compared with actual committed rerender diffs. |
| `data/top100-readiness/next80-queues.md` | Generated next80 operating queue: promotion review, user-shaped variant work, and limitation review. |
| `data/outcome-coverage/*.csv` | Front-door CSVs for chart, base, derived variant, and feature outcomes. |
| `data/latest-top20-refresh/candidates/README.md` | Generated summary for latest-version candidate proofs. |
| `runs/**/*.md` | Generated execution output from Pilot or other run harnesses. These are receipts/log summaries, not narrative docs. |

Do not hand-edit generated Markdown unless the generator is also updated.

## Manual Docs By Role

### Core Model And Harness

| File | Role |
| --- | --- |
| [chart-recipe-manifest-flow.md](./reference/chart-recipe-manifest-flow.md) | Canonical object model: chart, recipe, variant, revision, rendered objects, receipts. |
| [seven-stage-helm-lifecycle.md](./reference/seven-stage-helm-lifecycle.md) | Doctrine for render parity and for routing hooks, CRDs, target facts, generated values, overlays, GitOps, and observations. |
| [offering.md](./user/offering.md) | Public overview of the Helm catalog offering and the free-to-managed adoption path. |
| [try-now.md](./user/try-now.md) | Short first-run path for Redis and kube-prometheus-stack. |
| [choose-your-path.md](./user/choose-your-path.md) | Short first-run route picker across direct Helm, public catalog, and managed ConfigHub workflows. |
| [tutorial-sequence.md](./user/tutorial-sequence.md) | Sequential tutorial flow with commands and expected results. |
| [current-proof-status.md](./user/current-proof-status.md) | User-facing entry point for current proof status. |
| [what-we-refuse-to-claim.md](./user/what-we-refuse-to-claim.md) | User-facing trust boundary for strict witness blocks, watchlist rows, and normalization rules. |
| [../data/claims-register/summary.md](../data/claims-register/summary.md) | Generated register mapping public claims to evidence, limits, and scoped verification commands. |
| [why-synced-is-not-working.md](./user/why-synced-is-not-working.md) | User-facing explanation of object-set false greens and runtime/prerequisite checks. |
| [why-this-does-not-collapse.md](./user/why-this-does-not-collapse.md) | User-facing explanation of why hooks, quirks, and config volume are handled as routed facts instead of hidden risk. |
| [verify-it-yourself.md](./user/verify-it-yourself.md) | User-facing commands for independently checking repo, render, parity, and cub-scout receipt evidence. |
| [production-support-decisions.md](./user/production-support-decisions.md) | User-facing path from production-review-ready to a target-scoped production support decision. |
| [chain-of-proof.md](./user/chain-of-proof.md) | User-facing proof-boundary map across `helm-expt`, `cub installer`, ConfigHub, GitOps, and live observations. |
| [top100-readiness.md](./user/top100-readiness.md) | User-facing guide to public catalog rows, promotion candidates, default-only rows, and limitation decisions in the top-100 corpus. |
| [outcomes-and-tests.md](./user/outcomes-and-tests.md) | User-facing map from promised outcomes to tests, CSVs, and commands. |
| [../data/outcome-evidence-contract/summary.md](../data/outcome-evidence-contract/summary.md) | Generated product-facing contract for current outcomes, evidence, scopes, and next actions. |
| [../data/useful-base-design-queue/summary.md](../data/useful-base-design-queue/summary.md) | Generated queue of proposed useful base shapes for top-100 charts that are not yet good catalog offers. |
| [live-parity.md](./user/live-parity.md) | User-facing explanation of strict live parity status, non-pass rows, and rerun rules. |
| [helm-pain-points.md](./user/helm-pain-points.md) | User-facing map from common Helm pain points to helm-expt, ConfigHub, installer, and live-observation answers. |
| [verification-lanes.md](./user/verification-lanes.md) | User-facing explanation of proof lanes and command checks. |
| [how-the-harness-works.md](./user/how-the-harness-works.md) | Lifecycle-stage explanation of the harness. |
| [introduction-to-the-harness.md](./user/introduction-to-the-harness.md) | Detailed import workflow, recipe decisions, and hook policy. |
| [choosing-commands.md](./user/choosing-commands.md) | User-facing command-routing guide for the Helm and ConfigHub command family. |
| [creating-variants.md](./user/creating-variants.md) | Simple user guide for base variants, derived ConfigHub variants, AI assistant tasks, and bulk creation. |
| [cub-variant-command-surface.md](./user/cub-variant-command-surface.md) | Current `cub variant create` syntax, labels, annotations, targets, gates, and non-current variant verbs. |
| [change-routing-before-oci.md](./user/change-routing-before-oci.md) | User-facing routing guide for base variants, derived variants, and delivery prerequisites before OCI handoff. |
| [adopting-existing-apps.md](./user/adopting-existing-apps.md) | User-facing adoption path for existing Argo, Flux, KRM, rendered-manifest, and live-resource apps. |
| [custom-overlays.md](./user/custom-overlays.md) | ExternalDNS managed overlay example with wrapper chart, platform values, customer values, target facts, and ConfigHub variant routing. |
| [prometheus-overlay-promotion-example.md](./user/prometheus-overlay-promotion-example.md) | Concrete Prometheus example showing when an overlay becomes an installer base and when a change is ConfigHub-only. |
| [prometheus-high-fanout.md](./user/prometheus-high-fanout.md) | Kube-prometheus-stack example for base-variant fanout and prerequisite tracking. |
| [extension-slots.md](./user/extension-slots.md) | General extension-slot routing for raw manifests, tpl snippets, sidecars, config blocks, and add-on slots. |
| [nginx-configuration-files.md](./user/nginx-configuration-files.md) | NGINX-specific config-file routing: Helm extension slots, derived ConfigHub variants, and future syntax checks. |
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
| [seven-stage-helm-lifecycle.md](./reference/seven-stage-helm-lifecycle.md) | Seven-stage lifecycle, render parity boundary, hook routing, and support claims. |
| [proof-kit-migration.md](./reference/proof-kit-migration.md) | How repeated chart proof scripts are migrated to the shared proof-kit generator/verifier. |
| [customization-algorithm.md](./reference/customization-algorithm.md) | Reference algorithm for values files, overlays, wrapper charts, and post-render variants. |
| [catalog-doctrine.md](./reference/catalog-doctrine.md) | Catalog doctrine: chart → recipes → placeholdered base variants → derived ConfigHub variants. |
| [customization-decision-tree.md](./reference/customization-decision-tree.md) | Design-level routing tree for customization and support outcomes. |
| [complete-corresponding-model.md](./reference/complete-corresponding-model.md) | Completeness contract a supported chart must satisfy. |
| [per-chart-recipes.md](./reference/per-chart-recipes.md) | Method for recommending per-chart recipe + variant counts. |
| [top100-user-readiness.md](./reference/top100-user-readiness.md) | Methodology for the generated top-100 user-readiness view: sources, bucket rules, and honest limits. |
| [what-hook-support-means.md](./reference/what-hook-support-means.md) | The hook disposition vocabulary: what observed/routed/refused/per-target/recipe-needed claim and refuse to claim. |
| [kube-prometheus-stack-serious-chart-review.md](./reference/kube-prometheus-stack-serious-chart-review.md) | Reviewer-facing map of the serious chart: what is proved, partial, and not yet claimable. |
| [helm-quirk-support-matrix.md](./reference/helm-quirk-support-matrix.md) | How each Helm quirk class (hooks, CRDs, lookup, capabilities, secrets, slots, RBAC, webhooks, storage) is handled across the seven lifecycle stages, with honest status per quirk. |
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
| [serverless-verified-install-plan.md](./planning/serverless-verified-install-plan.md) | Planning model for the no-login verified-install wedge: public catalog package resolution, local apply, in-cluster receipt, and where ConfigHub Server begins. |
| [verified-install-commercial-model.md](./planning/verified-install-commercial-model.md) | Commercial model for verified installs, factory scans, image digest inventory, signed artifacts, refresh SLAs, private catalogs, and fleet security queries. |
| [robust-sceptic-plan.md](./planning/robust-sceptic-plan.md) | Sceptic-facing attack taxonomy and adversarial test plan, including claims register, blast-radius accuracy, torture fixtures, environment matrix, and external reproduction. |
| [corpus-rationalization-plan.md](./planning/corpus-rationalization-plan.md) | Named redundancy map across the data views (lane truth, hook family, readiness family) with merge/retire queue and the rules that stop view re-accretion. |
| [top20-full-proof-target.md](./planning/top20-full-proof-target.md) | Definition and status of the top-20 full proof milestone. |
| [top100-full-proof-target.md](./planning/top100-full-proof-target.md) | Definition and status of the top-100 proof surface. |
| [top500-matrix-refresh-review.md](./planning/top500-matrix-refresh-review.md) | How the top-500 analysis should be regenerated and interpreted. |
| [latest-top20-refresh-plan.md](./planning/latest-top20-refresh-plan.md) | Latest-version refresh plan for the supported top-20 charts. |
| [upgrade-story-plan.md](./planning/upgrade-story-plan.md) | Upgrade proof lane: old/new rendered sets, lifecycle review, live before/after observation, and scoped support decision. |
| [legacy-patch-review.md](./planning/legacy-patch-review.md) | Review lane for older chart versions and patch support. |
| [../data/attack-plan-workdown/summary.md](../data/attack-plan-workdown/summary.md) | Generated workdown for import, gaps, variants, production, runtime/GitOps, latest-version candidates, and image digests. |
| [../data/refresh-survival/summary.md](../data/refresh-survival/summary.md) | Generated refresh-survival surface for current supported versions, upstream update candidates, and the kube-prometheus-stack upgrade seed. |
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
| [agreed-execution-plan.md](./planning/agreed-execution-plan.md) | Consolidated doctrine and historical execution record. Use current handover, status dashboard, and next-task docs for current counts. |
| [current-handover.md](./planning/current-handover.md) | Current pickup snapshot, including the base-variant versus derived ConfigHub variant vocabulary. |
| [large-machine-handover.md](./planning/large-machine-handover.md) | Strict handover for a Codex instance that can run live Kubernetes and GitOps proof lanes. |
| [large-machine-roadmap.md](./planning/large-machine-roadmap.md) | Outcome-driven roadmap for live parity, target-bound derived variants, chart quirks, and docs organization. |
| [next-execution-plan.md](./planning/next-execution-plan.md) | Current execution plan and near-term backlog. |
| [serverless-verified-install-plan.md](./planning/serverless-verified-install-plan.md) | Product planning for `cub install` as a no-login verified-install transcript and upgrade path into ConfigHub. |
| [verified-install-commercial-model.md](./planning/verified-install-commercial-model.md) | Paid-tier planning for scan receipts, image digest inventory, signed artifacts, private catalogs, and fleet-wide security operations. |
| [robust-sceptic-plan.md](./planning/robust-sceptic-plan.md) | Attack model and adversarial test queue for public claims, lifecycle gaps, blast-radius prediction, and external reproduction. |
| [issue-backlog.md](./planning/issue-backlog.md) | Issue index and execution order. |
| [independent-review-brief.md](./planning/independent-review-brief.md) | Brief for an independent product/technical review. |
| [review-prompts.md](./planning/review-prompts.md) | Longer review prompts for structured critique. |
| [pilot-adversarial-testing.md](./planning/pilot-adversarial-testing.md) | Plan for adversarial testing with external automation. |
| [outside-user-test.md](./planning/outside-user-test.md) | Fifteen-minute outside-user protocol for testing whether the public site and docs explain the product. |
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
