EXPERIMENTAL

# Documentation Map

The public website is the starting point for people who want to use the project.
This directory holds the detailed guides and the evidence behind that site.

## Human Route

Use these pages in order for the shortest introduction.

| Page | Purpose |
| --- | --- |
| [Try Redis](https://confighub.github.io/helm-expt/site/try.html) | Inspect one checked package without a ConfigHub account, server, or Kubernetes cluster. |
| [Examples](https://confighub.github.io/helm-expt/site/testing.html) | Start from Helm, AICR, OCI, or YAML, then explore promotions, fleets, policy, and Apps. |
| [Catalog](https://confighub.github.io/helm-expt/site/charts/index.html) | Choose a tested starting configuration for a public Helm chart. |
| [Deployment](https://confighub.github.io/helm-expt/site/how-it-works.html) | Choose files, OCI, ConfigHub, Argo CD, Flux, or direct Kubernetes delivery. |
| [Docs](https://confighub.github.io/helm-expt/site/docs.html) | Find instructions for the current step. |
| [ConfigHub](https://confighub.github.io/helm-expt/site/confighub.html) | Save, change, approve, promote, and roll out reviewed configuration. |

The rest of this file is a reference index. You do not need to read it from top
to bottom. Most Markdown files in the repository are generated catalog, recipe,
package, test, or run records.

## User Guide Index

For a guided reading order through `docs/user/*.md`, start with
[user/README.md](./user/README.md). Use the table below when you need a specific
subject.

| File | Role |
| --- | --- |
| [../README.md](../README.md) | Main user introduction: why the repo exists, what is proven, and how to try it. |
| [../CATALOG.md](../CATALOG.md) | Generated chart catalog: charts first, recommended variants underneath. |
| [../WEBSITE_UX_TEST.md](../WEBSITE_UX_TEST.md) | Local static-site UX test runbook for walking a fresh user through the public website. |
| [user/README.md](./user/README.md) | Serial reading order for the manual user docs. |
| [offering.md](./user/offering.md) | Public offering overview: why visible Helm stages matter, what is free to try, and where managed ConfigHub workflows begin. |
| [generative-gitops-fit.md](./user/generative-gitops-fit.md) | User-facing boundary between the broader Generative GitOps thesis and what helm-expt proves today. |
| [reverse-reconcile-design.md](./user/reverse-reconcile-design.md) | User-facing design for the reverse live-to-desired frontier: authority policy, bounds check, fixture receipt, and the missing `cub` write-back capability. |
| [cub-scout-diff-design.md](./user/cub-scout-diff-design.md) | User-facing design for one field-level desired-vs-live differ that can serve dry-run and drift across Argo, Flux, or cub-direct delivery. |
| [day2-upgrade-story.md](./user/day2-upgrade-story.md) | The day-2 upgrade path for catalog configuration and flattened bundles: value-model diffs first, control points and immutable fields checked, verdicts re-read per version, bases recreated in the safe order. |
| [try-now.md](./user/try-now.md) | Detailed Helm parity explanation behind the short public package exercise. |
| [installer-oci-packages.md](./user/installer-oci-packages.md) | Public installer package OCI refs, how users pull them, and how package OCI differs from ConfigHub delivery OCI. |
| [config-catalog-demonstrations.md](./user/config-catalog-demonstrations.md) | Generated, plain-English status of the Helm, AICR, cub installer, OCI delivery, promotion, Kubara, and Sveltos pathways and the five planned ConfigHub Apps. |
| [Kubara with ConfigHub](./demo/kubara/index.md) | Buyer overview: what remains Kubara, what becomes better, the measured evidence, honest boundaries, and the path to a future dedicated repository. |
| [Kubara six-step adoption tutorial](./demo/kubara/adoption.md) | One linear path from Kubara component selection and generation through Git, OCI, the user-selected ConfigHub organization, and application delivery with Argo CD. |
| [Current Kubara + ConfigHub technical mini-IDP](./demo/kubara/single-platform.md) | Complete v0.13.0 maintainer and release path: catalogs, config, overlays, hub/spoke topology, component-first OCI, governed definitions and instances, matrix, wiring, platform delivery, and two applications. |
| [Historical Kubara v0.12.0 proof](./demo/kubara/local-platform.md) | Retained read-only compatibility evidence for the original one-cluster generation, 77-object bootstrap render, lifecycle route, OCI delivery, and dated live receipt. |
| [AICR catalog overview](./demo/aicr/index.md) | The three AICR entry classes (training, inference, CPU starter), what exists against what is planned, the retained-versions discipline while upstream moves, and the config-plane-only boundary. |
| [AICR H100 training example](./demo/aicr/eks-h100-training-kubeflow.md) | The retained EKS + H100 + Kubeflow entry: committed bundles and receipts, the digest-bound platform index, OCI round trip, ConfigHub upload, and the development-to-staging promotion. |
| [AICR-native NIM inference example](./demo/aicr/eks-h100-inference-nim.md) | The platform-level inference entry generated by AICR itself with `platform: nim`, held next to the KServe entry, with the training-to-inference component diff and a direct comparison of the two inference sources. |
| [AICR KServe NIM inference example](./demo/aicr/kserve-nim-inference.md) | The retained NIM-on-KServe entry: the Apache-2.0 nim-deploy KServe subtree at an exact commit, the digest-bound index with licensing-boundary refusal rules, and the first model profile described as data. |
| [AICR CPU starter example](./demo/aicr/cpu-starter.md) | The derived starter entry: seven byte-identical components selected from the training entry by recorded rules, pinned end to end by digest, needing no GPU, cloud account, or NGC key. |
| [The Sveltos fleet chapters](./demo/sveltos/fleet-chapters.md) | One page tying the five fleet chapters together: what each chapter claims, what is recorded live, what stays honestly offline behind the approval-gate server defect, and how to run every offline proof. |
| [Sveltos Kyverno fleet example](./demo/sveltos/kyverno-fleet.md) | Two-wave example: ConfigHub approves a pilot and one selector expansion at different OCI digests; Argo CD and Sveltos deliver Kyverno to one cluster, then two, and Sveltos restores drift on each target. |
| [Hooks and CRDs example](./demo/hooks-crds/kube-prometheus-stack.md) | Plain-English Kube Prometheus Stack install order, chart-specific route records, Argo CD and Flux choices, live evidence, and the remaining manual boundary. |
| [RBAC review example](./demo/apps/rbac-review.md) | One exact permission correction: find unnecessary Secret access, require approval, publish the reviewed objects as OCI, and let Argo CD check the result on an isolated cluster. |
| [aicr-evidence-and-our-receipts.md](./reference/aicr-evidence-and-our-receipts.md) | How AICR's own evidence machinery compares with this project's receipts, which tool is authoritative for which question, and the three public claims that were corrected once upstream's evidence surface was read. |
| [aicr-composition-model.md](./reference/aicr-composition-model.md) | Maintained reference on how AICR composes a platform (overlays, mixins, the component registry, deployment order) and where its command surface overlaps this catalog's own concepts, plus what the study settled about our two sourcing choices. |
| [aicr-signature-verification.md](./reference/aicr-signature-verification.md) | Maintained decision for verifying upstream AICR signatures: pinned cosign in a container, a committed sigstore trust root, signed timestamps for Rekor v2 era entries, offline execution, and what the check does not cover. |
| [config-catalog-doctrine.md](./reference/config-catalog-doctrine.md) | Maintained doctrine for the anonymous-to-managed boundary, source-and-intent records, source-neutral base variants, four OCI package roles, fleet delivery, apply policy, AI use, and keeping the human and machine views aligned. |
| [config-catalog-demo-program.md](./planning/config-catalog-demo-program.md) | Execution plan and acceptance criteria for the shared records, AICR, literal OCI uploads, promotions, fleet paths, and Apps. |
| [catalog-kubara-composition-strategy.md](./planning/catalog-kubara-composition-strategy.md) | Strategy for platform composition: the catalog reviews parts and wiring facts, machines generate the wiring, deterministic gates check it, and ConfigHub records and delivers the result. |
| [kubara-git-to-confighub-blog-brief.md](./planning/kubara-git-to-confighub-blog-brief.md) | Future public article brief using the same six-step adoption journey, buyer wording, proof boundaries, and GUI evidence order as the website. |
| [three-pillars-brief.md](./planning/three-pillars-brief.md) | Brief behind the current website testing story: choices fixed before install, evidence users can inspect, and lifecycle work kept visible. |
| [catalog-entry-contract-brief.md](./planning/catalog-entry-contract-brief.md) | Brief proposing one contract for every catalog entry: the three-state rule generalised across every era, plus a permission axis so a forbidden obligation is not read as a gap, a limits axis so each artifact says what it does not prove, and the measured cost of adopting it today. |
| [catalog-refresh-plan.md](./planning/catalog-refresh-plan.md) | Plan for turning the weekly catalog refresh on: why its schedule is off, the never-delete-published-versions retention rule, the two preconditions (a current catalog, and every npm lane with a recorded role), and the gaps still open in the lane. |
| [catalog-consumer-contract-brief.md](./planning/catalog-consumer-contract-brief.md) | Brief adopting the catalog consumer contract from integrator feedback: fetched-bytes digests, published paths, a change feed, retention and schema-version commitments, and the CORS and object-inventory keep-clauses. |
| [aicr-catalog-brief.md](./planning/aicr-catalog-brief.md) | Brief for the AICR catalog: three entry classes, the OCI digest spine ported from the Kubara importer, retained versions, and the config-plane-only proof boundary. |
| [aicr-nim-track-backlog.md](./planning/aicr-nim-track-backlog.md) | The next fifty tasks in the AICR and NIM track, grouped by theme, with the ones that change shared Catalog and Config Workshop surfaces marked and the four gating tasks named. |
| [certified-bundle-track-backlog.md](./planning/certified-bundle-track-backlog.md) | The next fifty tasks in the certified bundle track, grouped by theme: deciding lanes where evidence sits, extending routes, putting the evidence in front of a reader, finishing the bundle, upstream drift and retention, and the consumers. |
| [aicr-pilot-variants-brief.md](./planning/aicr-pilot-variants-brief.md) | Brief for applying the Pilot variant model to AICR platform shapes: what parity means when the unit of change is a platform, the blast-radius level the entries' receipts already record, and the control-point map each entry needs. |
| [aicr-version-refresh-brief.md](./planning/aicr-version-refresh-brief.md) | Brief for a second retained AICR version: what upstream changed since v0.14.0, why signature verification is the rung that justifies the refresh, what the derived starter costs, and the probe that decides whether to build it. |
| [nim-ngc-license-read.md](./planning/nim-ngc-license-read.md) | Cited read of the NVIDIA NIM and NGC licensing surfaces with the config-plane verdict for the inference entry: retain the Apache-2.0 scaffolding, never touch the gated runtime artifacts, keys stay target facts. |
| [certified-bundle-model-brief.md](./planning/certified-bundle-model-brief.md) | Brief for the certified bundle model: the catalog certifies charts, flattened bundles deliver them, and a per-chart flattening verdict arbitrates render-early against render-late. |
| [flattening-safety-brief.md](./planning/flattening-safety-brief.md) | Brief for the flattening-safety audit lane: a receipted per-chart verdict on what breaks when a chart ships as literal rendered YAML instead of running Helm. |
| [chart-successors-brief.md](./planning/chart-successors-brief.md) | Brief for replacing the six single-publisher chart sources: the measured breakage, the live-verified successor per component, the redis engine question, and the operator shape tax. |
| [sveltos-fleet-brief.md](./planning/sveltos-fleet-brief.md) | Brief for the Sveltos fleet example in the Kubara style: a reference fleet we operate, governed changes with receipts, and a DIY path for readers with their own clusters. Chapters one and two are recorded live; the kyverno, canary, patching, and bulk-operation chapters are proven offline and await their live runs. |
| [expected-results-and-clusters.md](./user/expected-results-and-clusters.md) | Practical guide for what users should see after each step, when they need a Kubernetes cluster, when to use kind or `cub cluster up`, and when npm verifiers are optional. |
| [first-run-walkthrough.md](./user/first-run-walkthrough.md) | Captured real serverless try-out (render → kubectl apply → running pod) with the honest namespace rough edge; tested-UX companion to try-now. |
| [serverless-mode.md](./user/serverless-mode.md) | A local path that needs neither ConfigHub Server nor a ConfigHub account. It distinguishes those two choices, compares Helm install with cub render plus apply, and shows how reviewed files can become OCI for GitOps. |
| [inspect-oci-package.md](./user/inspect-oci-package.md) | One command for identifying an OCI package, resolving its digest, listing exact Kubernetes objects and lifecycle clues, and checking the permanent public NGINX example. |
| [transform-oci-package.md](./user/transform-oci-package.md) | Change one field in a literal Kubernetes OCI, preserve the input records, build a new local OCI, and inspect the separately published permanent example. |
| [choose-your-path.md](./user/choose-your-path.md) | Route picker for Helm, AICR, OCI, or YAML; local, anonymous, or managed use; and the official ConfigHub tutorial handoff. |
| [ai-assisted-helm-changes.md](./user/ai-assisted-helm-changes.md) | Plain-English guide to safe AI-assisted Helm changes: propose, diff, gate, approve, deliver, and observe. |
| [broken-chart-triage.md](./user/broken-chart-triage.md) | Practical triage path for broken charts, values files, target prerequisites, lifecycle routes, image pulls, runtime failures, and model gaps. |
| [known-gaps-we-surface.md](./user/known-gaps-we-surface.md) | User-facing guide to current watch findings that the project deliberately surfaces instead of hiding. |
| [serious-chart-proof.md](./user/serious-chart-proof.md) | Concise kube-prometheus-stack proof path for the serious chart example. |
| [what-you-get.md](./user/what-you-get.md) | Compact product model: what ConfigHub adds around Helm output, what is proven, and what remains product work. |
| [helm-render-intents.md](./user/helm-render-intents.md) | The Helm-specific source-and-intent record, with examples and generated coverage states for render inputs, captured output, lifecycle routes, target prerequisites, runner evidence, freshness, and incomplete contracts. |
| [helm-presets-and-values.md](./user/helm-presets-and-values.md) | How public presets map to repo base variants, why the catalog does not claim every values combination, and how AI helps maintain chart-specific choices. |
| [verification.md](./user/verification.md) | Landing page for npm proof commands, user-side checks, committed evidence, fresh live lanes, and render-record-route. |
| [choosing-commands.md](./user/choosing-commands.md) | Guide to the distinct roles of `helm template`, `cub helm`, `cub installer`, ConfigHub upload and variant commands, and repo verifiers. |
| [outcomes-and-tests.md](./user/outcomes-and-tests.md) | User-facing outcome and test map, with links to the front-door CSVs. |
| [../data/outcome-evidence-contract/summary.md](../data/outcome-evidence-contract/summary.md) | Generated user-outcome contract: question, status, evidence, verifier command, scope, and next action. |
| [helm-pain-points.md](./user/helm-pain-points.md) | User-facing map from common Helm pain points to current proof, handoffs, and per-chart reports. |
| [helm-upgrade-crash-example.md](./user/helm-upgrade-crash-example.md) | User-facing day-2 example: how an opaque Helm upgrade becomes staged, reviewed, rehearsed, gated, and observed. |
| [why-this-exists.md](./user/why-this-exists.md) | Skeptical entry point: why this is more than a one-shot upload or GitOps import, and what the catalog/proof path adds. |
| [tutorial-sequence.md](./user/tutorial-sequence.md) | Detailed repository proof sequence for Redis, variants, overlays, GitOps, and bulk operations; not the ConfigHub product tutorial. |
| [current-proof-status.md](./user/current-proof-status.md) | Short guide to current proof status and the generated summaries that are authoritative. |
| [../data/chart-use-guide/summary.md](../data/chart-use-guide/summary.md) | Generated chart-use guide: one short answer per top-100 chart for use now, promotion review, base-variant work, or limitation decision. |
| [../data/confighub-example-guides/summary.md](../data/confighub-example-guides/summary.md) | Generated plain-English guides for each public chart preset config: what was rendered, why it is the right starting point, how to repeat it, and what prerequisites or lifecycle work remain visible. |
| [../data/master-catalog-matrix/matrix.html](../data/master-catalog-matrix/matrix.html) | Browser view of the full chart/version/base matrix: user route, strongest evidence, core lanes, production scope, hooks, quirks, hard gaps, and next action. |
| [../data/cub-adoption-caveats/summary.md](../data/cub-adoption-caveats/summary.md) | Per-chart adoption caveats: for each of the 100 charts, which "worse-than / more-confusing-than plain Helm" rough edges apply (baked shared password, CRD-first ordering) with the exact remediation, plus the three universal cub-direct caveats — the per-chart companion to the adoption audit. CSV + colored HTML alongside. |
| [hard-questions.md](./user/hard-questions.md) | Skeptical user route: hooks, upgrades, overlays, false-green sync, free versus managed, and how to challenge the model. |
| [what-we-refuse-to-claim.md](./user/what-we-refuse-to-claim.md) | Trust boundary: why watchlist rows and strict witness blocks remain visible. |
| [../data/claims-register/summary.md](../data/claims-register/summary.md) | Generated claim-to-evidence register for checking whether a public claim is backed, partial, planned, or refused. |
| [why-synced-is-not-working.md](./user/why-synced-is-not-working.md) | Runtime false-green explanation: why sync/object presence does not prove workload health. |
| [target-prerequisites.md](./user/target-prerequisites.md) | Hard-chart guide: CRDs, Secrets, lifecycle checks, and target facts that must be staged or observed beyond YAML parity. |
| [why-this-does-not-collapse.md](./user/why-this-does-not-collapse.md) | Skeptic-facing explanation of how hooks, quirks, config volume, and blocked rows are routed. |
| [enterprise-parity-contract.md](./reference/enterprise-parity-contract.md) | Reference contract for private enterprise estates that combine first-party Helm charts, values-only repositories, and Argo ApplicationSet fan-out. |
| [verify-it-yourself.md](./user/verify-it-yourself.md) | Reader verification commands for corpus checks, rendered installs, parity receipts, and cub-scout receipts. |
| [production-support-decisions.md](./user/production-support-decisions.md) | How a review-ready chart becomes production-supported for one target scope. |
| [chain-of-proof.md](./user/chain-of-proof.md) | Which tool proves each boundary, plus the generated source-to-observation record for Helm, AICR, cub installer, Kubara, Sveltos, and literal Kubernetes configuration. |
| [cub-deployment-path.md](./user/cub-deployment-path.md) | How deployment works on the cub path: source package → ConfigHub Units → release OCI → Argo or Flux, with direct local apply kept as a portability test; also covers OCI pull credentials and application Secrets. |
| [top100-readiness.md](./user/top100-readiness.md) | User-facing guide to the top-100 corpus buckets and generated readiness data. |
| [top100-status.md](./user/top100-status.md) | Plain-English top-100 answers: what works today, what needs prerequisites or review, and how it differs from plain Helm. |
| [serious-charts.md](./user/serious-charts.md) | The serious-chart packets: why kube-prometheus-stack, cert-manager, and external-secrets are the hard cases and how to read their status. |
| [verification-lanes.md](./user/verification-lanes.md) | Plain-English definition of each verification lane and the commands that check them. |
| [live-parity.md](./user/live-parity.md) | User-facing guide to pass, watch, blocked, and rerun rows in the live parity lanes. |
| [reading-the-matrix.md](./user/reading-the-matrix.md) | How to read the master catalog matrix: the lanes, the G/P/K shorthands, the cell states (pass/watch/blocked/n-a/blank), and where to look when a row is not green. |
| [remote-images-and-supported-bases.md](./user/remote-images-and-supported-bases.md) | What to do when a catalog base is watch-grade because an upstream image disappeared: refresh the chart/base, override the image, pin/mirror a digest, route a lifecycle image, or watch/refuse. |
| [target-prerequisites-before-rerun.md](./user/target-prerequisites-before-rerun.md) | The action packets for a non-green row's target prerequisite: create-namespace / stage-secret / install-crds / provide-external-service / provide-storage-or-topology / operator-review, with required inputs and the rerun command. |
| [large-config-operations.md](./user/large-config-operations.md) | User-facing guide for watching large ConfigHub upload/apply/GitOps paths without collapsing them into a vague hang. |
| [how-the-harness-works.md](./user/how-the-harness-works.md) | Short technical explanation of the harness lifecycle and where user value is created. |
| [introduction-to-the-harness.md](./user/introduction-to-the-harness.md) | Detailed recipe-generation workflow and the table for where Helm pieces belong. |
| [how-it-works.md](./user/how-it-works.md) | The "how it works" hub: the four-move mental model (render → route → deliver → observe) plus customize/promote, day-1, day-2, secrets, and free-vs-managed — an organized index into the mechanism docs. |
| [helm-to-cub-migration.md](./user/helm-to-cub-migration.md) | Helm-fluent dev's cheat-sheet: how Helm habits (--set, -f values.yaml, --set image.tag, --set-string, release names) map to cub's declared-input / named-base model, and why the declared model catches the typo footgun Helm absorbs. |
| [confighub-data-model.md](./user/confighub-data-model.md) | The vocabulary the model assumes — chart base, recipe, Unit, space, variant, target, worker, OCI bundle, target fact, route, receipt — and how they fit in one line. |
| [model-and-vocabulary.md](./user/model-and-vocabulary.md) | One page for the source-and-intent role, the five main terms (recipe, rendering, render record, base variant, derived variant), the F1-F4 stages, and where each artifact lives today. |
| [variants-after-upload.md](./user/variants-after-upload.md) | The step-by-step walkthrough after `cub installer upload`: why and how to run `cub variant create` (labels, namespace, gates), preview with `cub variant promote --dry-run -o mutations`, promote, and where delivery and rollback pick up. Commands verified against `cub --help`. |
| [AI change review example](./demo/apps/ai-change-review.md) | A real AICR training object, an unsafe proposed change, the corrected candidate, and an honest receipt showing which checks and live steps did or did not run. |
| [app-to-live-walkthrough.md](./user/app-to-live-walkthrough.md) | The full chain from plain YAML into a base Space, staging and production variants, release OCI, Argo CD delivery, and staged promotion. It links to the smaller four-object fixture when import is the only question. |
| [image-registry-migration.md](./user/image-registry-migration.md) | Move a digest-pinned image to another registry, promote it to three environments, keep one environment pending, and verify the current ConfigHub records with a live or offline command. |
| [day2-upgrade-rollback.md](./user/day2-upgrade-rollback.md) | Day-2 explainer: how an opaque helm upgrade becomes a staged/reviewed/rehearsed/observed change, and how versioned-Unit rollback works (with honest irreversible-migration caveats). |
| [security-end-to-end.md](./user/security-end-to-end.md) | The "no silent privileged step" story end to end: app secrets (generated/existing/target-fact), delivery creds (copied not printed), RBAC visible in the recipe, and the scan + F/G adversarial lanes. |
| [gitops-adopter-guide.md](./user/gitops-adopter-guide.md) | For Argo/Flux teams: what changes (the source becomes one OCI bundle) and what doesn't (your controller); Argo proven, Flux/cub-direct in progress; vs raw Helm-through-Argo; hooks as explicit routes. |
| [creating-variants.md](./user/creating-variants.md) | Simple guide to base variants, derived ConfigHub variants, AI assistant tasks, and bulk creation. |
| [derived-variant-walkthrough.md](./user/derived-variant-walkthrough.md) | Captured real `cub variant create` read back from its receipt: faithful 7-unit clone, no Helm re-render, gates applied, honest intended-state-only scope. |
| [cub-variant-command-surface.md](./user/cub-variant-command-surface.md) | Current `cub variant` command surface and how Space/Unit metadata maps to derived variants. |
| [change-routing-before-oci.md](./user/change-routing-before-oci.md) | Short guide for choosing a preset/base variant, derived ConfigHub variant, or delivery prerequisite before OCI handoff. |
| [adopting-existing-apps.md](./user/adopting-existing-apps.md) | How existing Argo, Flux, KRM, rendered-manifest, and live-resource apps enter the ConfigHub model. |
| [custom-overlays.md](./user/custom-overlays.md) | Plain-English ExternalDNS example for wrapper charts, platform values, customer overlay values, and target facts. |
| [prometheus-overlay-promotion-example.md](./user/prometheus-overlay-promotion-example.md) | Worked Prometheus example for a values overlay and a ConfigHub-only promotion variant. |
| [prometheus-high-fanout.md](./user/prometheus-high-fanout.md) | Kube-prometheus-stack example showing how one base choice changes many objects and target prerequisites. |
| [extension-slots.md](./user/extension-slots.md) | General guide for raw manifests, tpl snippets, sidecars, config blocks, and other NGINX-like extension slots. |
| [nginx-configuration-files.md](./user/nginx-configuration-files.md) | NGINX-specific guide for config-file extension slots, base variants, derived variants, and future `nginx -t` checks. |
| [product-support-tiers.md](./user/product-support-tiers.md) | Which Helm scenarios fit the public catalog, managed imports, or commercial support. |
| [hook-lifecycle-strategy.md](./user/hook-lifecycle-strategy.md) | How Helm hooks are inventoried, classified, translated, or blocked. |
| [chart-hooks-what-happens.md](./user/chart-hooks-what-happens.md) | Practical answer to "if my chart has hooks, what happens with the ConfigHub/installer version?": routes, phases, who runs each, and that a known route is not an automatically executed one. |
| [pathway-route-hooks-transparently.md](./user/pathway-route-hooks-transparently.md) | Test pathway (Helm-user + SecOps × hook/lifecycle): render parity proves the non-hook objects, the hook runs as an explicit non-automatic route with a receipt, shown side-by-side vs. what Helm/Argo/Flux do silently. Anchored on fluent/fluent-bit; live proof via `npm run hook-test:proof`. |
| [maintenance-sla.md](./user/maintenance-sla.md) | How catalog entries are refreshed, patched, and supported. |
| [demo/redis/demo-script.md](demo/redis/demo-script.md) | Runnable Redis walkthrough. |
| [demo/redis/ux-acceptance.md](demo/redis/ux-acceptance.md) | Redis demo acceptance criteria. |
| [demo/redis/function-scan-lane.md](demo/redis/function-scan-lane.md) | Redis ConfigHub function scan lane. |
| [demo/redis/safe-ops-lane.md](demo/redis/safe-ops-lane.md) | Redis safe operation lane. |
| [../tests/README.md](../tests/README.md) | Test directory map: npm verification scripts and portable runtime tests. |
| [../tests/npm-scripts.md](../tests/npm-scripts.md) | What each npm script family checks, why it exists, and when to run it. |

This table is a reference inventory. Generated package docs, recipe catalog
pages, data summaries, and per-chart test transcripts support the public pages;
they are not the first-run documentation set.

## Maintained Orientation Layer

The [project knowledge index](../knowledge/index.md) is a short maintained
orientation layer for humans and agents. It summarizes the current model and
routes to authoritative evidence. It is not a second source of truth; generated
data, receipts, recipes, current issues, and verifiers remain authoritative.

## Agent And Operator Docs

These files are for agents and maintainers operating the repo. Keep public
website pages and `docs/user` pages human-readable; put command routing,
recovery steps, and repo-specific AX notes here.

| File | Role |
| --- | --- |
| [agent/README.md](./agent/README.md) | Canonical start page for agents and maintainers working in this repo. |
| [agent/tasks.md](./agent/tasks.md) | Task-to-command recipes for common repo operations. |
| [agent/recovery.md](./agent/recovery.md) | Recovery guide for stale generated files, broken links, command-surface failures, and live-lane failures. |
| [agent/verification.md](./agent/verification.md) | Agent-focused map from claims to the narrowest useful verifier. |
| [agent/catalog.md](./agent/catalog.md) | Read-only catalog guide for inspecting chart evidence without redesigning the catalog. |
| [agent/human-agent-doctrine.md](./agent/human-agent-doctrine.md) | Rules for keeping human-facing pages and agent/operator pages consistent without copying the same text. |
| [agent/terms.md](./agent/terms.md) | Compact glossary for repo-specific product, proof, catalog, and lane terms. |

## Generated And Reference Markdown

| Location | Role |
| --- | --- |
| `recipes/<repo>/<chart>/<version>/README.md` | Generated recipe summary for one chart/version. |
| `recipes/<repo>/<chart>/<version>/CATALOG.md` | Generated per-chart catalog page with supported variants, revisions, receipts, and package links. |
| `recipes/<repo>/<chart>/<version>/weirdness-and-mitigations.md` | Chart-specific notes for top-20 proof entries. |
| `config-catalog/package-extras/<repo>/<chart>/<version>/README.md` | Maintained source for package-local lifecycle instructions copied into the public installer package. |
| `packages/<repo>/<chart>/<version>/README.md` | Generated `cub installer` package usage note. This is package reference, not a primary user guide. |
| `packages/<repo>/<chart>/<version>/prerequisites/<action>/README.md` | Package-local instructions for one prerequisite or lifecycle action, including when it runs, what it creates, and how its receipt is recorded. |
| `docs/demo/<chart>/confighub-proof.md` | Per-chart ConfigHub proof summary. Corpus evidence. |
| `docs/demo/<chart>/confighub-proof-transcript.md` | Per-chart command transcript and observed outputs. Corpus evidence. |
| `data/*/summary.md` | Generated status, review, or matrix summary. |
| `data/README.md` | Generated data index and start-here guide for CSVs. |
| `data/csv-index.csv` | Generated machine-readable index of every CSV under `data/`. |
| `data/status-dashboard/summary.md` | Generated front-door status dashboard for top100, proof lanes, hooks, quirks, GitOps, and live parity. |
| `data/outcome-evidence-contract/summary.md` | Generated front-door map from user-visible outcomes to evidence, verifier commands, limits, and next action. |
| `data/chart-use-guide/summary.md` | Generated front-door guide for whether one top-100 chart can be used now, promoted after review, improved with a better base, or held for a limitation decision. |
| `data/confighub-example-guides/summary.md` | Generated per-preset guides for the chart journey into ConfigHub, including the render intent, render variant, package OCI ref, scripts, prerequisites, and evidence boundary. |
| `data/master-catalog-matrix/matrix.html` | Generated browser front door for chart/version/base status, user route, strongest evidence, production scope, and visible gaps. |
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
| [generative-gitops-fit.md](./user/generative-gitops-fit.md) | User-facing map from generated config and AI/GitOps expectations to current helm-expt evidence and limits. |
| [try-now.md](./user/try-now.md) | Detailed Redis Helm-parity path behind the short public package exercise. |
| [choose-your-path.md](./user/choose-your-path.md) | Route picker across input formats and local, anonymous, or ConfigHub-managed use. |
| [tutorial-sequence.md](./user/tutorial-sequence.md) | Detailed proof flow with commands and expected results; not the ConfigHub product tutorial. |
| [current-proof-status.md](./user/current-proof-status.md) | User-facing entry point for current proof status. |
| [hard-questions.md](./user/hard-questions.md) | Skeptical user route for the hard questions a Helm reviewer asks before trusting the catalog. |
| [what-we-refuse-to-claim.md](./user/what-we-refuse-to-claim.md) | User-facing trust boundary for strict witness blocks, watchlist rows, and normalization rules. |
| [../data/claims-register/summary.md](../data/claims-register/summary.md) | Generated register mapping public claims to evidence, limits, and scoped verification commands. |
| [why-synced-is-not-working.md](./user/why-synced-is-not-working.md) | User-facing explanation of object-set false greens and runtime/prerequisite checks. |
| [target-prerequisites.md](./user/target-prerequisites.md) | User-facing explanation of target facts and live prerequisite checks for hard charts such as cert-manager, VPA, and OpenTelemetry Operator. |
| [why-this-does-not-collapse.md](./user/why-this-does-not-collapse.md) | User-facing explanation of why hooks, quirks, and config volume are handled as routed facts instead of hidden risk. |
| [verification.md](./user/verification.md) | User-facing landing page for proof commands, committed evidence, fresh live lanes, and render-record-route. |
| [verify-it-yourself.md](./user/verify-it-yourself.md) | User-facing commands for independently checking repo, render, parity, and cub-scout receipt evidence. |
| [production-support-decisions.md](./user/production-support-decisions.md) | User-facing path from production-review-ready to a target-scoped production support decision. |
| [chain-of-proof.md](./user/chain-of-proof.md) | User-facing proof-boundary map across `helm-expt`, `cub installer`, ConfigHub, GitOps, and live observations, linked to the generated OCI evidence-chain records. |
| [top100-readiness.md](./user/top100-readiness.md) | User-facing guide to public catalog rows, promotion candidates, default-only rows, and limitation decisions in the top-100 corpus. |
| [outcomes-and-tests.md](./user/outcomes-and-tests.md) | User-facing map from promised outcomes to tests, CSVs, and commands. |
| [../data/outcome-evidence-contract/summary.md](../data/outcome-evidence-contract/summary.md) | Generated product-facing contract for current outcomes, evidence, scopes, and next actions. |
| [../data/useful-base-design-queue/summary.md](../data/useful-base-design-queue/summary.md) | Generated queue of proposed useful base shapes for top-100 charts that are not yet good catalog offers. |
| [live-parity.md](./user/live-parity.md) | User-facing explanation of strict live parity status, non-pass rows, and rerun rules. |
| [large-config-operations.md](./user/large-config-operations.md) | User-facing guide for large charts and 100+ Unit operations: what to watch, what to capture, and how to classify slow or progressing stages. |
| [helm-pain-points.md](./user/helm-pain-points.md) | User-facing map from common Helm pain points to helm-expt, ConfigHub, installer, and live-observation answers. |
| [helm-upgrade-crash-example.md](./user/helm-upgrade-crash-example.md) | User-facing upgrade-crash example linking old/new render, blast radius, live rehearsal, ConfigHub gates, and scoped support decisions. |
| [verification-lanes.md](./user/verification-lanes.md) | User-facing explanation of proof lanes and command checks. |
| [how-the-harness-works.md](./user/how-the-harness-works.md) | Lifecycle-stage explanation of the harness. |
| [introduction-to-the-harness.md](./user/introduction-to-the-harness.md) | Detailed import workflow, recipe decisions, and hook policy. |
| [choosing-commands.md](./user/choosing-commands.md) | User-facing guide to source, preparation, ConfigHub, delivery, and proof commands. |
| [creating-variants.md](./user/creating-variants.md) | Simple user guide for base variants, derived ConfigHub variants, AI assistant tasks, and bulk creation. |
| [cub-variant-command-surface.md](./user/cub-variant-command-surface.md) | Current `cub variant` syntax for create, promote, and upload, including labels, annotations, targets, namespaces, and gates. |
| [change-routing-before-oci.md](./user/change-routing-before-oci.md) | User-facing routing guide for presets/base variants, derived variants, and delivery prerequisites before OCI handoff. |
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
| [certified-bundle-spec.md](./reference/certified-bundle-spec.md) | The shared bundle-plus-receipt spec every producer emits against: bundle shape, receipt fields, quirk dispositions, and the flattening-safety verdict lanes. |
| [seven-stage-helm-lifecycle.md](./reference/seven-stage-helm-lifecycle.md) | Seven-stage lifecycle, render parity boundary, hook routing, and support claims. |
| [proof-kit-migration.md](./reference/proof-kit-migration.md) | How repeated chart proof scripts are migrated to the shared proof-kit generator/verifier. |
| [customization-algorithm.md](./reference/customization-algorithm.md) | Reference algorithm for values files, overlays, wrapper charts, and post-render variants. |
| [catalog-doctrine.md](./reference/catalog-doctrine.md) | Catalog doctrine: chart → recipes → placeholdered base variants → derived ConfigHub variants. |
| [customization-decision-tree.md](./reference/customization-decision-tree.md) | Design-level routing tree for customization and support outcomes. |
| [complete-corresponding-model.md](./reference/complete-corresponding-model.md) | Completeness contract a supported chart must satisfy. |
| [per-chart-recipes.md](./reference/per-chart-recipes.md) | Method for recommending per-chart recipe + variant counts. |
| [top100-user-readiness.md](./reference/top100-user-readiness.md) | Methodology for the generated top-100 user-readiness view: sources, bucket rules, and honest limits. |
| [master-catalog-matrix.md](./reference/master-catalog-matrix.md) | Doctrine for the master matrix: HTML for human/product decisions, CSV for machine/spreadsheet use, Markdown for compact orientation. |
| [residue-families.md](./reference/residue-families.md) | What a non-green matrix row's residue category means (`remote-image`, `render-input`, `capability-profile`, hook/lifecycle, target-prerequisite, runtime, controller-health, model gap): who fixes it, the next action, and where the rows live. |
| [matrix-completion-audit.md](./reference/matrix-completion-audit.md) | How the matrix completion audit triages every non-green/not-yet-run cell into needs-run / needs-target-or-prereq-fix / needs-modeling / already-decided, and how to use it to finish the matrix faster. |
| [variant-promotion-closeout.md](./reference/variant-promotion-closeout.md) | How the promotion-closeout queue makes the promotion column actionable: ready-to-run vs watch-grade vs blocked by the ConfigHub changeset bug, with owner classes; promotion is a ConfigHub server value. |
| [what-hook-support-means.md](./reference/what-hook-support-means.md) | The hook disposition vocabulary: what observed/routed/refused/per-target/recipe-needed claim and refuse to claim. |
| [kube-prometheus-stack-serious-chart-review.md](./reference/kube-prometheus-stack-serious-chart-review.md) | Reviewer-facing map of the serious chart: what is proved, partial, and not yet claimable. |
| [helm-quirk-support-matrix.md](./reference/helm-quirk-support-matrix.md) | How each Helm quirk class (hooks, CRDs, lookup, capabilities, secrets, slots, RBAC, webhooks, storage) is handled across the seven lifecycle stages, with honest status per quirk. |
| [fork-vocabulary.md](./reference/fork-vocabulary.md) | Shared vocabulary for base vs derived variants and how names map. |
| [helm-import-contract.md](./reference/helm-import-contract.md) | Historical contract for graduating a direct Helm render into maintained `cub installer` recipes. |
| [capability-profile-catalog.md](./reference/capability-profile-catalog.md) | Named Kubernetes capability profiles used during render. |
| [generated-fact-receipts.md](./reference/generated-fact-receipts.md) | Generated secrets, certs, random values, and time-value receipt specification. |
| [secret-lifecycle.md](./reference/secret-lifecycle.md) | How rendered Secrets, target Secret facts, and Kubernetes lifecycle Secret state are classified and checked. |
| [observation-freshness-slo.md](./reference/observation-freshness-slo.md) | Freshness states for live observations in a workerless ConfigHub model. |
| [upgrade-rollback-receipts.md](./reference/upgrade-rollback-receipts.md) | Upgrade and rollback receipt shape. |
| [hook-lifecycle-strategy.md](./user/hook-lifecycle-strategy.md) | How Helm hooks are inventoried, classified, translated, or blocked. |
| [direct-cub-helm-model.md](./reference/direct-cub-helm-model.md) | Plugin-specific reference for the separate `cub-helm` command surface and how it differs from durable installer recipes. |

### Variants, Promotion, And Operations

| File | Role |
| --- | --- |
| [variant-creation-artifact.md](./reference/variant-creation-artifact.md) | Reference design for guided variant creation over existing ConfigHub capabilities. |
| [cub-variant-command-surface.md](./user/cub-variant-command-surface.md) | User-facing command surface for current `cub variant` clone, promote, and upload operations. |
| [redis-variant-creation-plan.yaml](./reference/redis-variant-creation-plan.yaml) | Concrete Redis variant creation blueprint. |
| [variant-creator-verification.md](./reference/variant-creator-verification.md) | How Creator previews, checks, receipts, UX, agent, and fleet paths are verified. |
| [derived-variant-live-proof.md](./reference/derived-variant-live-proof.md) | First live `cub variant create` execution receipts for derived ConfigHub variants. |
| [lane-test-doctrine.md](./reference/lane-test-doctrine.md) | Core corpus lane-test doctrine for every chart-recipe-variant row. |
| [two-cluster-parity-harness.md](./reference/two-cluster-parity-harness.md) | Strict Helm-vs-installer live parity contract using two vanilla kind clusters. |
| [enterprise-parity-contract.md](./reference/enterprise-parity-contract.md) | Customer-safe extension of the parity model for private Helm, values-only, and Argo ApplicationSet estates. |
| [variant-promotion-worked-example.md](./reference/variant-promotion-worked-example.md) | Worked promotion examples for Redis and managed overlays. |
| [variant-promotion-model.md](./reference/variant-promotion-model.md) | Consolidated model for ConfigHub server-side variant promotion: UX, AX, fleet flow, current top-20 evidence, and product gaps. |
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
| [user-journey-test-pathways-brief.md](./planning/user-journey-test-pathways-brief.md) | Brief for the user-journey test pathways (persona × decisions × chart-class) and the hook-method validation work. |
| [user-journey-test-pathways-plan.md](./planning/user-journey-test-pathways-plan.md) | Verified research map + build plan for the test pathways: the pathway matrix, phase sequencing, live-run policy, and corrections to the brief. |
| [chart-claim-integrity-audit-2026-06-22.md](./planning/chart-claim-integrity-audit-2026-06-22.md) | Adversarial audit of the generated chart pages for false claims (page contradicts its cited receipt): the verified findings, the two systemic root causes, the clarity issues, and the permanent `chart-claim-integrity` gate that prevents them. |
| [catalog-promotion-review.md](./planning/catalog-promotion-review.md) | Rules for deciding whether a proven chart becomes catalog-supported. |
| [catalog-promotion-next-candidates.md](./planning/catalog-promotion-next-candidates.md) | Candidate charts for the next promotion wave. |
| [serverless-verified-install-plan.md](./planning/serverless-verified-install-plan.md) | Planning model for the no-login verified-install wedge: public catalog package resolution, local apply, in-cluster receipt, and where ConfigHub Server begins. |
| [verified-install-commercial-model.md](./planning/verified-install-commercial-model.md) | Commercial model for verified installs, factory scans, image digest inventory, signed artifacts, refresh SLAs, private catalogs, and fleet security queries. |
| [post-coverage-strategy.md](./planning/post-coverage-strategy.md) | Post-100%-coverage synthesis tying user journeys (incl. serverless entry + ConfigHub-server + cub-scout), the open-issue backlog, the coverage substrate, and the competitive landscape into one sequenced roadmap (Phase A finish coverage → B legibility/trust → C productize → D commercial). |
| [robust-sceptic-plan.md](./planning/robust-sceptic-plan.md) | Sceptic-facing attack taxonomy and adversarial test plan, including claims register, blast-radius accuracy, torture fixtures, environment matrix, and external reproduction. |
| [corpus-rationalization-plan.md](./planning/corpus-rationalization-plan.md) | Named redundancy map across the data views (lane truth, hook family, readiness family) with merge/retire queue and the rules that stop view re-accretion. |
| [maintenance-strategy.md](./planning/maintenance-strategy.md) | Maintenance NOTE: the free-tier daily-refresh SLA for public data and tests, perpetual append-only retention of all public data and its changes, and the free/paid boundary backed by a larger daily-updated private corpus. |
| [where-does-my-hook-go.md](./planning/where-does-my-hook-go.md) | Problem analysis and solution proposal generalizing the hook disposition model (observed/routed/per-target/refused) to every Helm behavior that does not survive a config-only render: named routes, the default-plus-legible-off-ramp requirement for humans and agents, a phased plan, and the #684 review notes. |
| [hook-route-execution-plan.md](./planning/hook-route-execution-plan.md) | Scope for executing hook lifecycle routes (closing automatic:false): what each route class needs, GitOps-native emission vs product-direct cub execution, the execution receipt, and the phasing so hooks are automated and audited rather than run by hand. |
| [top20-full-proof-target.md](./planning/top20-full-proof-target.md) | Definition and status of the top-20 full proof milestone. |
| [top100-full-proof-target.md](./planning/top100-full-proof-target.md) | Definition and status of the top-100 proof surface. |
| [../data/top50-completion/summary.md](../data/top50-completion/summary.md) | Generated fifty-task completion plan: current status, evidence, verification command, and the next step for every agreed programme outcome. |
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

### Operating Skills

These docs turn repeated hard-chart work into reusable operating knowledge for
humans and agents. They are not product proof tables, and they do not create a
dependency on Pilot or any other external demo runner.

| File | Role |
| --- | --- |
| [skills/README.md](./skills/README.md) | Entry point for helm-expt operating skills and common rules. |
| [skills/live-parity.md](./skills/live-parity.md) | How to run and classify live Helm-vs-ConfigHub parity, GitOps/OCI, kind, and cub-scout evidence. |
| [skills/large-app-evidence-funnel.md](./skills/large-app-evidence-funnel.md) | How to break a 100+ Unit app into rendered, uploaded, pulled, synced, converged, and controller-health stages. |
| [skills/target-facts-and-lifecycle.md](./skills/target-facts-and-lifecycle.md) | How to route existing Secrets, CRDs, APIService readiness, topology, storage, and generated runtime state. |
| [skills/hook-and-secret-lifecycle.md](./skills/hook-and-secret-lifecycle.md) | How to classify Helm hooks and Secret lifecycle rows without claiming execution from render evidence. |
| [skills/serious-chart-playbooks.md](./skills/serious-chart-playbooks.md) | Start points for kube-prometheus-stack, Consul, cert-manager, External Secrets, Loki, and Argo Workflows. |

### Planning, Review, And Communications

These files support project planning, review, and public explanation. They are
not the primary user path.

| File | Role |
| --- | --- |
| [roadmap.md](./planning/roadmap.md) | Canonical roadmap index: active workstreams, release guardrails, issue trackers, and which planning files are authoritative versus historical. |
| [../data/top50-completion/summary.md](../data/top50-completion/summary.md) | Canonical generated completion view for the agreed Top 50. Source: `config-catalog/top50.yaml`; verifier: `npm run top50:completion:verify`. |
| [agreed-execution-plan.md](./planning/agreed-execution-plan.md) | Consolidated doctrine and historical execution record. Use current handover, status dashboard, and next-task docs for current counts. |
| [current-handover.md](./planning/current-handover.md) | Current pickup snapshot, including the base-variant versus derived ConfigHub variant vocabulary. |
| [large-machine-handover.md](./planning/large-machine-handover.md) | Strict handover for a Codex instance that can run live Kubernetes and GitOps proof lanes. |
| [large-machine-roadmap.md](./planning/large-machine-roadmap.md) | Outcome-driven roadmap for live parity, target-bound derived variants, chart quirks, and docs organization. |
| [next-execution-plan.md](./planning/next-execution-plan.md) | Current execution plan and near-term backlog. |
| [serverless-verified-install-plan.md](./planning/serverless-verified-install-plan.md) | Product planning for `cub installer` as a no-login verified-install transcript and upgrade path into ConfigHub. |
| [verified-install-commercial-model.md](./planning/verified-install-commercial-model.md) | Paid-tier planning for scan receipts, image digest inventory, signed artifacts, private catalogs, and fleet-wide security operations. |
| [robust-sceptic-plan.md](./planning/robust-sceptic-plan.md) | Attack model and adversarial test queue for public claims, lifecycle gaps, blast-radius prediction, and external reproduction. |
| [issue-backlog.md](./planning/issue-backlog.md) | Issue index and execution order. |
| [independent-review-brief.md](./planning/independent-review-brief.md) | Brief for an independent product/technical review. |
| [review-prompts.md](./planning/review-prompts.md) | Longer review prompts for structured critique. |
| [pilot-adversarial-testing.md](./planning/pilot-adversarial-testing.md) | Plan for adversarial testing with external automation. |
| [pilot-demo-proof-plan.md](./planning/pilot-demo-proof-plan.md) | The demo-proof plan: the head-to-head benchmark design (bare model+helm versus Pilot+substrate), the agent-drivable variant generator, and the switch-effect maps, with the honest-run protocol. |
| [outside-user-test.md](./planning/outside-user-test.md) | Fifteen-minute outside-user protocol for testing whether the public site and docs explain the product. |
| [blog-posts.md](./planning/blog-posts.md) | Public writing plan. |
| [dedicated-website-plan.md](./planning/dedicated-website-plan.md) | Standalone website plan. |
| [house-voice.md](./planning/house-voice.md) | The house voice for all tech copy: the Fowler/Jobs/Dickens hybrid, ten rules, ready-to-apply before/after rewrites of the front-door site surfaces (Get Started, How It Works, chart-page intro), and how to check it (Flesch 60–70). |
| [onboarding-and-entry-paths.md](./planning/onboarding-and-entry-paths.md) | Doctrine for one canonical ConfigHub tutorial, short Helm/AICR/OCI/YAML entry paths, distinct local/anonymous/managed choices, and STE limits for the Try page. |
| [free-path-pitch.md](./planning/free-path-pitch.md) | The free-path value proposition: lead with a "look before you install" pre-flight check, keep parity as a quiet assurance, and separate ship-now copy from future security and AI builds. |
| [server-account-pitch.md](./planning/server-account-pitch.md) | The account value proposition: your versions, your apps, your releases, plus the shipped-versus-frontier wording that ties the homepage variant and Apps boxes together. |
| [house-layout.md](./planning/house-layout.md) | The house layout (companion to house-voice): seven principles drawn from hall.kvick.dev — narrow prose, hairline sections, terminal-card commands, two-column hero, light card grid, one accent, restraint — plus the terminal-card pattern and where to apply it. |
| [agent-experience-audit.md](./planning/agent-experience-audit.md) | Audit for the agent/operator docs: website pages stay for users, agent instructions live in repo Markdown, and catalog changes are out of scope for the first pass. |
| [agent-experience-worklog.md](./planning/agent-experience-worklog.md) | Running log of observed agent friction and the fixes made. |
| [get-started-rewrite-brief.md](./planning/get-started-rewrite-brief.md) | Brief for Codex to rewrite the generated Get Started page (try.html) install-first around parity of outcomes: the full new copy, the recipe-vs-package explanation of `--pull`, verified commands, and generator notes. |
| [persona-ux-rerun-2026-06-22.md](./planning/persona-ux-rerun-2026-06-22.md) | Rerun of the public-site persona UX audit after the adoption-lens site updates, including page metrics, eight persona findings, and ranked follow-up work. |
| [persona-ux-audit-2026-06-22.md](./planning/persona-ux-audit-2026-06-22.md) | Ten-persona public-site audit after the homepage and guide restructuring, with verified findings and the next ranked UX fixes. |
| [how-it-works-website-brief.md](./planning/how-it-works-website-brief.md) | Content + structure brief for the public site's "How it works" section (for Codex): the four-move spine, the honesty rails, suggested visuals, and the open content gaps. |
| [landing-page-restructure-brief.md](./planning/landing-page-restructure-brief.md) | Brief for Codex to restructure the generated homepage around one narrative spine (look first, prove it on a cluster, change it and keep it) so the page makes one pitch instead of nine; executed by #1101. |
| [fuzz-corpus-tests-roadmap.md](./planning/fuzz-corpus-tests-roadmap.md) | Roadmap for the non-website work (corpus, tests, fuzz, migration-UX): the test-our-tool principle, the persona taxonomy (F/G/cub-fuzz/Helm-migrant), the offline-first PR sequence, and the deferred live work. |
| [helm-vs-cub-adoption-audit.md](./planning/helm-vs-cub-adoption-audit.md) | Adoption audit for places where cub is worse than or more confusing than plain Helm on the common journey, with each gap marked solved, managed, partial, or unmanaged. |
| [per-chart-fact-sheet-spec.md](./planning/per-chart-fact-sheet-spec.md) | Design spec for the per-chart website page: section list, the exact data source per field, and a solid/partial/needs-more-testing status for each, plus the "level of support vs evidence depth" rule. |
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
