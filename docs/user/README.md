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
`cub gitops import`?", read [Brian Entry: Why This Exists](./brian-entry.md).

| Step | File | Read It For |
| --- | --- | --- |
| 1 | [Tutorial Sequence](./tutorial-sequence.md) | A short show-and-tell path with commands, checks, and expected results. |
| 2 | [How The Harness Works](./how-the-harness-works.md) | The project lifecycle and the value of proofs, uploads, variants, and receipts. |
| 3 | [Creating Variants](./creating-variants.md) | The base variant versus derived ConfigHub variant distinction. |
| 4 | [cub Variant Command Surface](./cub-variant-command-surface.md) | The current `cub variant create` syntax and what is not a current variant command. |
| 5 | [Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md) | The routing rule before OCI or GitOps delivery. |
| 6 | [Custom Overlay Example](./custom-overlays.md) | A plain ExternalDNS example for wrapper charts, customer values, target facts, and Creator flow. |
| 7 | [Prometheus Promotion Example](./prometheus-overlay-promotion-example.md) | A concrete promotion example that keeps the Helm install shape stable. |
| 8 | [Introduction To The Harness](./introduction-to-the-harness.md) | The deeper recipe-generation workflow and the table for where Helm pieces belong. |
| 9 | [Product Support Tiers](./product-support-tiers.md) | Which scenarios fit public catalog, managed import, or commercial support. |
| 10 | [Maintenance SLA](./maintenance-sla.md) | How catalog entries are refreshed, patched, and supported. |
| 11 | [Hook Lifecycle Strategy](./hook-lifecycle-strategy.md) | Why Helm hooks need explicit lifecycle routes and receipts. |

Detailed doctrine and historical design material now lives under
[`docs/reference`](../reference/) so it does not look like the first-run user
flow. Use it when you need the deeper model:

| Reference | Read It For |
| --- | --- |
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
