# User Docs Reading Order

**UNOFFICIAL/EXPERIMENTAL**

This page gives the user-facing docs a single serial order. Start with the repo
[README](../../README.md), then use this list when you want the guided path
through the manual user docs.

You do not need every document on a first pass. Stop after step 6 if you only
want the practical user flow.

| Step | File | Read It For |
| --- | --- | --- |
| 1 | [Tutorial Sequence](./tutorial-sequence.md) | A short show-and-tell path with commands, checks, and expected results. |
| 2 | [How The Harness Works](./how-the-harness-works.md) | The project lifecycle and the value of proofs, uploads, variants, and receipts. |
| 3 | [Creating Variants](./creating-variants.md) | The base variant versus derived ConfigHub variant distinction. |
| 4 | [Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md) | The routing rule before OCI or GitOps delivery. |
| 5 | [Custom Overlay Example](./custom-overlays.md) | A plain ExternalDNS example for wrapper charts, customer values, target facts, and Creator flow. |
| 6 | [Prometheus Promotion Example](./prometheus-overlay-promotion-example.md) | A concrete promotion example that keeps the Helm install shape stable. |
| 7 | [Customization Algorithm](./customization-algorithm.md) | The detailed routing algorithm for values, overlays, wrapper charts, and post-render variants. |
| 8 | [Introduction To The Harness](./introduction-to-the-harness.md) | The deeper recipe-generation workflow and the table for where Helm pieces belong. |
| 9 | [Product Support Tiers](./product-support-tiers.md) | Which scenarios fit public catalog, managed import, or commercial support. |
| 10 | [Maintenance SLA](./maintenance-sla.md) | How catalog entries are refreshed, patched, and supported. |
| 11 | [Hook Lifecycle Strategy](./hook-lifecycle-strategy.md) | Why Helm hooks need explicit lifecycle routes and receipts. |
| 12 | [Catalog Doctrine](./catalog-doctrine.md) | The catalog model for defaults, parameterized bases, and standard variants. |
| 13 | [Customization Decision Tree](./customization-decision-tree.md) | The design-level decision tree behind the customization flow. |
| 14 | [Fork Vocabulary](./fork-vocabulary.md) | Canonical naming for base variant dimensions. |
| 15 | [Per-Chart Recipes](./per-chart-recipes.md) | The recommended target recipe and variant surface for top-20 charts. |
| 16 | [Complete Corresponding Model](./complete-corresponding-model.md) | The completeness contract behind the larger ConfigHub replaces-Helm claim. |

The order is intentionally user-first:

```text
try it
understand the proof path
create variants
route customizations
read worked examples
then inspect doctrine, naming, and completeness contracts
```
