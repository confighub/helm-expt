# Helm Chart Presets And Values

**UNOFFICIAL/EXPERIMENTAL**

This page explains how the catalog handles Helm values.

The public phrase is **preset chart configuration**, shortened to **chart
preset** in tables and compact UI. The repo word is **base variant**. They mean
the same thing in this context: a named, supported way to render one Helm chart
version.

For the plain-English path from one chart preset into ConfigHub, use the
generated [ConfigHub Example Guides](../../data/confighub-example-guides/summary.md).
Each guide shows what was rendered, why that preset is a reasonable starting
point, how to repeat it, and which CRDs, Secrets, hooks, setup jobs, or other
requirements still need attention.

## The Claim

We do not try to prove every possible Helm values combination. Most charts
expose too many switches for that to be useful or honest. We claim something
narrower: the catalog offers ready-to-use chart presets for common operating
choices, and each one records its values, rendered objects, and required
setup together.

[Variants](../../site/variants.html#preset) states the claim in full, with
the chart-preset examples (`default`, `no-crds`, `reuse-existing-secret`, and
the rest) and what each preset records.

## Why Not Every Values Combination?

Helm values files can describe many things at once: security choices, storage,
topology, CRDs, hooks, service exposure, labels, RBAC, image choices, and
application config.

Some combinations are useful. Some are unsafe. Some only work on a specific
target. Some look valid but do not create a deployable system. A catalog that
claims to support all combinations would either skip the hard checks or become
too vague to trust.

The catalog takes a different path. It chooses useful chart presets, records them,
renders them, checks them, and keeps the result maintainable across chart
versions. When a user needs another useful operating configuration, it can
become another chart preset.

## What A Chart Preset Records

A chart preset records its chart source and version, values profile, release
name and namespace, capability profile, source lock, render intent, render
variant, installer package OCI ref, package base, evidence lanes, and chart
extras.

[Variants](../../site/variants.html#preset) lists what each of those items
means and why it matters. For the render-intent layer, see
[Helm Render Intents](./helm-render-intents.md).

## Where Each Setting Lives

There are four places to look: Helm values, ConfigHub changes, install work,
and the live cluster. One field should not have two silent owners; if a new
Helm render and a ConfigHub revision both change the same field, review the
overlap before promotion and choose the intended result.

Every generated `HelmRenderIntent` records this split under
`spec.settingSources`. Chart pages and the `readme` Unit in each demo Space
show the same information in plain English.

[Variants](../../site/variants.html#fields) has the full four-place table,
with where to look for each one.

## What Happens When You Bring Values?

If a values file changes what Helm renders, it belongs in a new or updated
chart preset. If a change only fills or refines already-rendered objects
after upload, it can belong in a derived ConfigHub variant instead.

[Variants](../../site/variants.html#choose) has the full three-line rule and
the detailed routing table, drawn from
[Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md).

## Hooks, CRDs, And Setup Work

Some chart behavior is not just static YAML. Hooks may run jobs. CRDs may need
to exist before custom resources apply. Webhooks may need certificates. A chart
may assume a Secret, cloud account, StorageClass, IngressClass, hosted zone, or
controller already exists.

The catalog should make those choices explicit for each supported chart preset.

| Chart extra | Common catalog answer |
| --- | --- |
| CRDs | Include them in the chart preset, split a no-CRDs preset, require an external owner, or block. |
| Hooks | Inventory the hook and record whether it is observed, routed, target-specific, blocked, or refused. |
| Setup jobs | Turn the job into a named setup step only where evidence exists, or keep it blocked/refused. |
| Generated Secrets | Use a generated demo value, an existing-Secret preset, or a target fact with clear warnings. |
| Cloud or platform accounts | Require target facts and checks before claiming the path works. |
| Webhook certificates | Record the setup or observation needed before production use. |

A named route is not automatic execution. It is a recorded piece of work with a
status and evidence boundary.

## How AI Helps

AI helps make this approach maintainable. It can read chart docs and templates,
spot values that matter, propose useful chart presets, update notes across chart
versions, draft checks, and explain receipts.

AI does not make a catalog claim true. A chart preset is accepted only when the
generated output, tests, receipts, and chart page support it.

That is the working model:

```text
AI proposes and maintains candidates.
The catalog records the chosen chart preset.
Verification decides what can be claimed.
```

## What This Does Not Claim

- It does not claim every values combination works.
- It does not claim every hook is automatically executed.
- It does not claim render parity is production readiness.
- It does not require users to abandon Helm charts.
- It does not treat generated GitHub package folders as the catalog entry
  point. Users should choose from the Configuration Catalog pages first.

The goal is practical support for the way Helm is actually used: keep the chart,
choose a useful chart preset, inspect the generated objects, record the extra work,
and keep the result testable as charts and applications change.
