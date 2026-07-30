# User Docs Reading Order

**UNOFFICIAL/EXPERIMENTAL**

This page gives the user-facing docs a single serial order. Start with the repo
[README](../../README.md), then use this list when you want the guided path
through the manual user docs.

You do not need every document on a first pass. Stop after step 6 if you only
want the practical user flow.

## First 10 Minutes

Use this route when you are trying to understand the product quickly.

| Question | Open | Why |
| --- | --- | --- |
| What is this offering? | [Offering](./offering.md) | The Helm user value story without the full proof corpus. |
| Which path should I take? | [Choose Your Path](./choose-your-path.md) | Direct render, one-shot upload, public catalog, and ConfigHub-managed operations. |
| Can I try it now? | [Try Now](./try-now.md) | A short public package OCI path and the serious-chart check. |
| What package do I pull? | [Installer Package OCI Refs](./installer-oci-packages.md) | The public `oci://` refs for catalog packages, and how they differ from ConfigHub delivery OCI. |
| How do Helm, AICR, cub installer, promotions, and fleet examples fit together? | [Config Catalog Demonstrations](./config-catalog-demonstrations.md) | The maintained status of each source path and the five ConfigHub App examples. |
| What should I see after each command? | [Expected Results And Clusters](./expected-results-and-clusters.md) | Output snippets, cluster choices, bring-your-own Kubernetes, `cub cluster up`, and optional npm proof checks. |
| How do chart presets relate to Helm values? | [Helm Chart Presets And Values](./helm-presets-and-values.md) | Why the catalog offers useful chart-specific presets instead of claiming every values combination. |
| How do I verify a claim? | [Verification](./verification.md) | The landing page for npm proof commands, user-side checks, committed receipts, and live lanes. |
| What can AI safely help with? | [AI-Assisted Helm Changes](./ai-assisted-helm-changes.md) | How AI proposals stay bounded by diff, gate, approval, delivery, and observation. |
| What if my chart breaks? | [Broken Chart Triage](./broken-chart-triage.md) | A practical route from failure to render gap, target prerequisite, lifecycle route, image issue, runtime issue, or model gap. |
| What known gaps should I trust you to show? | [Known Gaps We Surface](./known-gaps-we-surface.md) | Current watch findings such as credentials, prune, CRD ordering, drift coverage, and SSA conflict UX. |
| What is the whole catalog status? | [Master matrix](../../site/matrix.html) | One product/status view across chart versions, bases, variants, lanes, gaps, and next actions. |
| What hard questions should I ask? | [Hard Questions](../../site/hard-questions.html) | Hooks, upgrades, overlays, target prerequisites, false-green sync, and refusal boundaries. |
| What can be built on the held data? | [App-readiness proof](../../data/app-readiness/summary.md) | A read-only RBAC app over already-rendered objects, showing why explicit config becomes useful data. |

The [Choose Your Path](./choose-your-path.md) page is the quickest way to
decide between direct render, one-shot upload, public catalog packages, and
ConfigHub-managed operations. The [Tutorial Sequence](./tutorial-sequence.md)
also links each stage to a companion UX proposal. Those proposal files are
product sketches, not extra required reading for the first pass.

If your first question is "why is this more than a one-shot upload or GitOps
import?", read [Why This Exists](./why-this-exists.md).

| Step | File | Read It For |
| --- | --- | --- |
| 1 | [ConfigHub Helm Catalog Offering](./offering.md) | The public value story in one short read. |
| 2 | [Generative GitOps Fit](./generative-gitops-fit.md) | How this repo maps to the broader generated-config and AI/GitOps thesis. |
| 2a | [Reverse-Reconcile Design](./reverse-reconcile-design.md) | The live-to-desired frontier: what is machine-checkable today and what requires a new `cub` write-back capability. |
| 2b | [cub-scout Diff Design](./cub-scout-diff-design.md) | The field-level desired-vs-live frontier for dry-run and drift across Argo, Flux, or cub-direct delivery. |
| 2c | [App-readiness proof](../../data/app-readiness/summary.md) | A small read-app over rendered RBAC that shows how held config becomes queryable product data. |
| 2d | [Config Catalog Demonstrations](./config-catalog-demonstrations.md) | How Helm, AICR, cub installer, promotions, Kubara, Sveltos, and the five Apps enter one base-variant and policy model. |
| 2e | [Kubara Platform Example](../demo/kubara/local-platform.md) | A real Kubara generation, the rendered Argo CD base, the CRDs and hook work around it, and the checks that have not run yet. |
| 3 | [Try Now](./try-now.md) | The shortest Redis and kube-prometheus-stack paths. |
| 3a | [Expected Results And Clusters](./expected-results-and-clusters.md) | What users should see after each step, what cluster they need, and which npm proof checks are optional. |
| 4 | [Choose Your Path](./choose-your-path.md) | Which path fits: direct render, one-shot upload, public catalog, or ConfigHub operations. |
| 5 | [What You Get](./what-you-get.md) | The product model in one short read. |
| 6 | [Helm Chart Presets And Values](./helm-presets-and-values.md) | Why public chart presets are the useful support surface, how they map to repo base variants, and why this is not an every-values-combination claim. |
| 7 | [Installer Package OCI Refs](./installer-oci-packages.md) | The public package refs users pull with `cub installer setup --pull oci://...`, plus the difference between package OCI and delivery OCI. |
| 8 | [Helm Render Intents](./helm-render-intents.md) | The compact two-layer model: base variants for render, managed variants after render, with the full proof chain underneath. |
| 9 | [Verification](./verification.md) | The landing page for npm proof commands, committed evidence, fresh live lanes, and render-record-route. |
| 10 | [Choosing Commands](./choosing-commands.md) | When to use `helm template`, `cub installer`, `cub variant upload`, `cub variant create`, and repo verifiers. |
| 11 | [AI-Assisted Helm Changes](./ai-assisted-helm-changes.md) | How AI can propose changes without bypassing diffs, gates, approvals, delivery, or observation. |
| 12 | [Broken Chart Triage](./broken-chart-triage.md) | How to turn a broken chart into a named render, target, lifecycle, image, runtime, or model finding. |
| 13 | [Known Gaps We Surface](./known-gaps-we-surface.md) | Why current watch findings are visible and how to read them. |
| 14 | [Outcomes And Tests](./outcomes-and-tests.md) | What the repo promises, which tests prove each promise, and where the CSVs live. |
| 15 | [Helm Pain Points](./helm-pain-points.md) | Which Helm pains are tracked generally and per chart. |
| 16 | [Helm Upgrade Crash Example](./helm-upgrade-crash-example.md) | How an opaque Helm upgrade becomes staged, reviewed, rehearsed, gated, and observed. |
| 17 | [Tutorial Sequence](./tutorial-sequence.md) | A short show-and-tell path with commands, checks, and expected results. |
| 18 | [Current Proof Status](./current-proof-status.md) | What is proven now and which generated summaries are authoritative. |
| 19 | [Hard Questions Before You Trust The Catalog](./hard-questions.md) | Short answers for skeptical Helm users: hooks, upgrades, overlays, false-green sync, free versus managed, and how to challenge the model. |
| 20 | [What We Refuse To Claim](./what-we-refuse-to-claim.md) | Why watchlist rows and blocked strict witnesses are part of the trust model. |
| 21 | [Why Synced Is Not Working](./why-synced-is-not-working.md) | Why object presence or GitOps sync can still miss broken runtime state. |
| 22 | [Target Prerequisites](./target-prerequisites.md) | Why hard charts need explicit CRDs, Secrets, lifecycle checks, and target facts beyond YAML parity. |
| 23 | [Why This Does Not Collapse](./why-this-does-not-collapse.md) | How hooks, quirks, config volume, and blocked rows stay visible instead of becoming hidden risk. |
| 24 | [Verify It Yourself](./verify-it-yourself.md) | Commands for checking corpus files, rendered installs, parity receipts, and cub-scout receipts. |
| 25 | [Production Support Decisions](./production-support-decisions.md) | How a review-ready chart becomes production-supported for one target scope. |
| 26 | [Chain Of Proof](./chain-of-proof.md) | Which tool proves which boundary: render, ConfigHub desired state, delivery, and live observation. |
| 27 | [Top-100 Readiness](./top100-readiness.md) | How to read the top-100 corpus: public catalog, promotion candidates, default-only rows, and limitation decisions. |
| 28 | [Chart Use Guide](../../data/chart-use-guide/summary.md) | One generated answer per top-100 chart: use now, promote, improve the base, or decide a limitation first. |
| 29 | [Top-100 Status](./top100-status.md) | Plain-English answers: what works today, what needs prerequisites or review, and how it differs from plain Helm. |
| 30 | [Verification Lanes](./verification-lanes.md) | What each proof lane means and what it does not prove. |
| 31 | [Live Parity](./live-parity.md) | How to read pass, watch, blocked, and rerun rows in the live Helm-vs-ConfigHub lanes. |
| 32 | [Large ConfigHub Operations](./large-config-operations.md) | How to watch a 100+ Unit upload/apply/GitOps path without collapsing it into a vague hang. |
| 33 | [How The Harness Works](./how-the-harness-works.md) | The project lifecycle and the value of proofs, uploads, variants, and receipts. |
| 34 | [Creating Variants](./creating-variants.md) | The base variant versus derived ConfigHub variant distinction. |
| 35 | [cub Variant Command Surface](./cub-variant-command-surface.md) | The current `cub variant create` syntax and what is not a current variant command. |
| 36 | [Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md) | The routing rule before OCI or GitOps delivery. |
| 37 | [Adopting Existing Apps](./adopting-existing-apps.md) | How Argo, Flux, KRM, rendered manifests, and existing apps enter the ConfigHub model. |
| 38 | [Custom Overlay Example](./custom-overlays.md) | A plain ExternalDNS example for wrapper charts, customer values, target facts, and Creator flow. |
| 39 | [Prometheus Promotion Example](./prometheus-overlay-promotion-example.md) | A concrete promotion example that keeps the Helm install shape stable. |
| 40 | [Prometheus High-Fanout Example](./prometheus-high-fanout.md) | Why a small Helm base choice can affect many objects and target prerequisites. |
| 41 | [Serious Chart Proof](./serious-chart-proof.md) | The concise kube-prometheus-stack proof path: what passes, what is scoped, and what remains. |
| 42 | [Extension Slots](./extension-slots.md) | How raw manifests, tpl snippets, sidecars, config blocks, and add-on slots are routed. |
| 43 | [NGINX Configuration Files](./nginx-configuration-files.md) | How NGINX `serverBlock`, `streamServerBlock`, `extraDeploy`, and config-file checks fit the variant model. |
| 44 | [Introduction To The Harness](./introduction-to-the-harness.md) | The deeper recipe-generation workflow and the table for where Helm pieces belong. |
| 45 | [Product Support Tiers](./product-support-tiers.md) | Which scenarios fit public catalog, managed import, or commercial support. |
| 46 | [Maintenance SLA](./maintenance-sla.md) | How catalog entries are refreshed, patched, and supported. |
| 47 | [Hook Lifecycle Strategy](./hook-lifecycle-strategy.md) | Why Helm hooks need explicit lifecycle routes and receipts. |
| 48 | [Inspect An OCI Package](./inspect-oci-package.md) | Identify an OCI package, resolve its digest, and list the exact Kubernetes objects and lifecycle clues before choosing what to do with it. |
| 49 | [Change An OCI Package](./transform-oci-package.md) | Change one named field, keep the source and check records, and build a new OCI without a ConfigHub account or server. |
| 50 | [Your App To Live](./app-to-live-walkthrough.md) | Continue from plain Kubernetes YAML into ConfigHub variants, releases, Argo CD delivery, and promotion. |

Detailed doctrine and historical design material now lives under
[`docs/reference`](../reference/) so it does not look like the first-run user
flow. Use it when you need the deeper model:

| Reference | Read It For |
| --- | --- |
| [Seven-Stage Helm Lifecycle](../reference/seven-stage-helm-lifecycle.md) | The doctrine for render parity and for routing hooks, CRDs, target facts, generated values, overlays, GitOps, and observations. |
| [Chain Of Proof](./chain-of-proof.md) | The user-facing boundary map for render proof, ConfigHub proof, delivery proof, and live proof. |
| [Direct Cub Helm Model](../reference/direct-cub-helm-model.md) | Historical and plugin-specific reference for the separate `cub-helm` command surface; the public site uses Helm, `cub installer`, and `cub variant upload` as its front doors. |
| [Customization Algorithm](../reference/customization-algorithm.md) | The detailed routing algorithm for values, overlays, wrapper charts, and post-render variants. |
| [Catalog Doctrine](../reference/catalog-doctrine.md) | The catalog model for defaults, parameterized bases, standard forks, and derived fills. |
| [Customization Decision Tree](../reference/customization-decision-tree.md) | The design-level decision tree behind the customization flow. |
| [Fork Vocabulary](../reference/fork-vocabulary.md) | Canonical naming for base variant dimensions. |
| [Per-Chart Recipes](../reference/per-chart-recipes.md) | The recommended target recipe and variant surface for top-20 charts. |
| [Complete Corresponding Model](../reference/complete-corresponding-model.md) | The completeness contract behind the larger ConfigHub replaces-Helm claim. |

The order is intentionally user-first:

```text
try it
understand the proof path
create variants
route customizations
read worked examples
then inspect reference doctrine only when needed
```
