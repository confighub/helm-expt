# User Docs Reading Order

**UNOFFICIAL/EXPERIMENTAL**

This page gives the user-facing docs a single serial order. Start with the repo
[README](../../README.md), then use this list when you want the guided path
through the manual user docs.

You do not need every document on a first pass. Stop after step 6 if you only
want the practical user flow.

The [Tutorial Sequence](./tutorial-sequence.md) also links each stage to a
companion UX proposal. Those proposal files are product sketches, not extra
required reading for the first pass.

If your first question is "why is this better than `cub helm install` or
`cub gitops import`?", read [Why This Exists](./why-this-exists.md).

| Step | File | Read It For |
| --- | --- | --- |
| 1 | [ConfigHub Helm Catalog Offering](./offering.md) | The public value story in one short read. |
| 2 | [What You Get](./what-you-get.md) | The product model in one short read. |
| 3 | [Choosing Commands](./choosing-commands.md) | When to use `cub helm template`, `cub helm install`, `cub installer`, `cub variant create`, and repo verifiers. |
| 4 | [Outcomes And Tests](./outcomes-and-tests.md) | What the repo promises, which tests prove each promise, and where the CSVs live. |
| 5 | [Helm Pain Points](./helm-pain-points.md) | Which Helm pains are tracked generally and per chart. |
| 6 | [Tutorial Sequence](./tutorial-sequence.md) | A short show-and-tell path with commands, checks, and expected results. |
| 7 | [Current Proof Status](./current-proof-status.md) | What is proven now and which generated summaries are authoritative. |
| 8 | [Top-100 Readiness](./top100-readiness.md) | How to read the top-100 corpus: public catalog, promotion candidates, default-only rows, and limitation decisions. |
| 9 | [Verification Lanes](./verification-lanes.md) | What each proof lane means and what it does not prove. |
| 10 | [Live Parity](./live-parity.md) | How to read pass, watch, blocked, and rerun rows in the live Helm-vs-ConfigHub lanes. |
| 11 | [How The Harness Works](./how-the-harness-works.md) | The project lifecycle and the value of proofs, uploads, variants, and receipts. |
| 12 | [Creating Variants](./creating-variants.md) | The base variant versus derived ConfigHub variant distinction. |
| 13 | [cub Variant Command Surface](./cub-variant-command-surface.md) | The current `cub variant create` syntax and what is not a current variant command. |
| 14 | [Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md) | The routing rule before OCI or GitOps delivery. |
| 15 | [Adopting Existing Apps](./adopting-existing-apps.md) | How Argo, Flux, KRM, rendered manifests, and existing apps enter the ConfigHub model. |
| 16 | [Custom Overlay Example](./custom-overlays.md) | A plain ExternalDNS example for wrapper charts, customer values, target facts, and Creator flow. |
| 17 | [Prometheus Promotion Example](./prometheus-overlay-promotion-example.md) | A concrete promotion example that keeps the Helm install shape stable. |
| 18 | [Prometheus High-Fanout Example](./prometheus-high-fanout.md) | Why a small Helm base choice can affect many objects and target prerequisites. |
| 19 | [Extension Slots](./extension-slots.md) | How raw manifests, tpl snippets, sidecars, config blocks, and add-on slots are routed. |
| 20 | [NGINX Configuration Files](./nginx-configuration-files.md) | How NGINX `serverBlock`, `streamServerBlock`, `extraDeploy`, and config-file checks fit the variant model. |
| 21 | [Introduction To The Harness](./introduction-to-the-harness.md) | The deeper recipe-generation workflow and the table for where Helm pieces belong. |
| 22 | [Product Support Tiers](./product-support-tiers.md) | Which scenarios fit public catalog, managed import, or commercial support. |
| 23 | [Maintenance SLA](./maintenance-sla.md) | How catalog entries are refreshed, patched, and supported. |
| 24 | [Hook Lifecycle Strategy](./hook-lifecycle-strategy.md) | Why Helm hooks need explicit lifecycle routes and receipts. |

Detailed doctrine and historical design material now lives under
[`docs/reference`](../reference/) so it does not look like the first-run user
flow. Use it when you need the deeper model:

| Reference | Read It For |
| --- | --- |
| [Seven-Stage Helm Lifecycle](../reference/seven-stage-helm-lifecycle.md) | The doctrine for render parity and for routing hooks, CRDs, target facts, generated values, overlays, GitOps, and observations. |
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
