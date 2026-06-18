# User Docs Reading Order

**UNOFFICIAL/EXPERIMENTAL**

This page gives the user-facing docs a single serial order. Start with the repo
[README](../../README.md), then use this list when you want the guided path
through the manual user docs.

You do not need every document on a first pass. Stop after step 6 if you only
want the practical user flow.

The [Choose Your Path](./choose-your-path.md) page is the quickest way to
decide between direct render, one-shot upload, public catalog packages, and
ConfigHub-managed operations. The [Tutorial Sequence](./tutorial-sequence.md)
also links each stage to a companion UX proposal. Those proposal files are
product sketches, not extra required reading for the first pass.

If your first question is "why is this better than `cub helm install` or
`cub gitops import`?", read [Why This Exists](./why-this-exists.md).

| Step | File | Read It For |
| --- | --- | --- |
| 1 | [ConfigHub Helm Catalog Offering](./offering.md) | The public value story in one short read. |
| 2 | [Generative GitOps Fit](./generative-gitops-fit.md) | How this repo maps to the broader generated-config and AI/GitOps thesis. |
| 2a | [Reverse-Reconcile Design](./reverse-reconcile-design.md) | The live-to-desired frontier: what is machine-checkable today and what requires a new `cub` write-back capability. |
| 3 | [Try Now](./try-now.md) | The shortest Redis and kube-prometheus-stack paths. |
| 4 | [Choose Your Path](./choose-your-path.md) | Which path fits: direct render, one-shot upload, public catalog, or ConfigHub operations. |
| 5 | [What You Get](./what-you-get.md) | The product model in one short read. |
| 6 | [Choosing Commands](./choosing-commands.md) | When to use `cub helm template`, `cub helm install`, `cub installer`, `cub variant create`, and repo verifiers. |
| 7 | [Outcomes And Tests](./outcomes-and-tests.md) | What the repo promises, which tests prove each promise, and where the CSVs live. |
| 8 | [Helm Pain Points](./helm-pain-points.md) | Which Helm pains are tracked generally and per chart. |
| 9 | [Helm Upgrade Crash Example](./helm-upgrade-crash-example.md) | How an opaque Helm upgrade becomes staged, reviewed, rehearsed, gated, and observed. |
| 10 | [Tutorial Sequence](./tutorial-sequence.md) | A short show-and-tell path with commands, checks, and expected results. |
| 11 | [Current Proof Status](./current-proof-status.md) | What is proven now and which generated summaries are authoritative. |
| 12 | [Hard Questions Before You Trust The Catalog](./hard-questions.md) | Short answers for skeptical Helm users: hooks, upgrades, overlays, false-green sync, free versus managed, and how to challenge the model. |
| 13 | [What We Refuse To Claim](./what-we-refuse-to-claim.md) | Why watchlist rows and blocked strict witnesses are part of the trust model. |
| 14 | [Why Synced Is Not Working](./why-synced-is-not-working.md) | Why object presence or GitOps sync can still miss broken runtime state. |
| 15 | [Target Prerequisites](./target-prerequisites.md) | Why hard charts need explicit CRDs, Secrets, lifecycle checks, and target facts beyond YAML parity. |
| 16 | [Why This Does Not Collapse](./why-this-does-not-collapse.md) | How hooks, quirks, config volume, and blocked rows stay visible instead of becoming hidden risk. |
| 17 | [Verify It Yourself](./verify-it-yourself.md) | Commands for checking corpus files, rendered installs, parity receipts, and cub-scout receipts. |
| 18 | [Production Support Decisions](./production-support-decisions.md) | How a review-ready chart becomes production-supported for one target scope. |
| 19 | [Chain Of Proof](./chain-of-proof.md) | Which tool proves which boundary: render, ConfigHub desired state, delivery, and live observation. |
| 20 | [Top-100 Readiness](./top100-readiness.md) | How to read the top-100 corpus: public catalog, promotion candidates, default-only rows, and limitation decisions. |
| 21 | [Chart Use Guide](../../data/chart-use-guide/summary.md) | One generated answer per top-100 chart: use now, promote, improve the base, or decide a limitation first. |
| 22 | [Top-100 Status](./top100-status.md) | Plain-English answers: what works today, what needs prerequisites or review, and how it differs from plain Helm. |
| 23 | [Verification Lanes](./verification-lanes.md) | What each proof lane means and what it does not prove. |
| 24 | [Live Parity](./live-parity.md) | How to read pass, watch, blocked, and rerun rows in the live Helm-vs-ConfigHub lanes. |
| 25 | [Large ConfigHub Operations](./large-config-operations.md) | How to watch a 100+ Unit upload/apply/GitOps path without collapsing it into a vague hang. |
| 26 | [How The Harness Works](./how-the-harness-works.md) | The project lifecycle and the value of proofs, uploads, variants, and receipts. |
| 27 | [Creating Variants](./creating-variants.md) | The base variant versus derived ConfigHub variant distinction. |
| 28 | [cub Variant Command Surface](./cub-variant-command-surface.md) | The current `cub variant create` syntax and what is not a current variant command. |
| 29 | [Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md) | The routing rule before OCI or GitOps delivery. |
| 30 | [Adopting Existing Apps](./adopting-existing-apps.md) | How Argo, Flux, KRM, rendered manifests, and existing apps enter the ConfigHub model. |
| 31 | [Custom Overlay Example](./custom-overlays.md) | A plain ExternalDNS example for wrapper charts, customer values, target facts, and Creator flow. |
| 32 | [Prometheus Promotion Example](./prometheus-overlay-promotion-example.md) | A concrete promotion example that keeps the Helm install shape stable. |
| 33 | [Prometheus High-Fanout Example](./prometheus-high-fanout.md) | Why a small Helm base choice can affect many objects and target prerequisites. |
| 34 | [Serious Chart Proof](./serious-chart-proof.md) | The concise kube-prometheus-stack proof path: what passes, what is scoped, and what remains. |
| 35 | [Extension Slots](./extension-slots.md) | How raw manifests, tpl snippets, sidecars, config blocks, and add-on slots are routed. |
| 36 | [NGINX Configuration Files](./nginx-configuration-files.md) | How NGINX `serverBlock`, `streamServerBlock`, `extraDeploy`, and config-file checks fit the variant model. |
| 37 | [Introduction To The Harness](./introduction-to-the-harness.md) | The deeper recipe-generation workflow and the table for where Helm pieces belong. |
| 38 | [Product Support Tiers](./product-support-tiers.md) | Which scenarios fit public catalog, managed import, or commercial support. |
| 39 | [Maintenance SLA](./maintenance-sla.md) | How catalog entries are refreshed, patched, and supported. |
| 40 | [Hook Lifecycle Strategy](./hook-lifecycle-strategy.md) | Why Helm hooks need explicit lifecycle routes and receipts. |

Detailed doctrine and historical design material now lives under
[`docs/reference`](../reference/) so it does not look like the first-run user
flow. Use it when you need the deeper model:

| Reference | Read It For |
| --- | --- |
| [Seven-Stage Helm Lifecycle](../reference/seven-stage-helm-lifecycle.md) | The doctrine for render parity and for routing hooks, CRDs, target facts, generated values, overlays, GitOps, and observations. |
| [Chain Of Proof](./chain-of-proof.md) | The user-facing boundary map for render proof, ConfigHub proof, delivery proof, and live proof. |
| [Direct Cub Helm Model](../reference/direct-cub-helm-model.md) | Detailed reference for `cub helm template`, `cub helm install`, and the durable catalog path. |
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
