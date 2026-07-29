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

We do not claim to prove every possible Helm values combination. Most charts
expose too many switches for that to be useful or honest.

We claim something narrower and more practical:

- users keep their Helm charts;
- the catalog offers ready-to-use chart presets for common operating choices;
- each chart preset records the values and render inputs that produced it;
- the rendered Kubernetes objects are captured as generated output;
- hooks, CRDs, setup jobs, generated Secrets, cloud accounts, and target
  prerequisites are recorded with the chart preset;
- tests, receipts, and chart pages say what is proven, blocked, refused, or
  still waiting for more work.

That is enough for most real cases because teams usually want recognizable
operating shapes, not every theoretical values permutation.

Examples include:

| Chart preset | Typical reason |
| --- | --- |
| `default` | Start from the chart author's normal path. |
| `no-crds` | The target cluster or another controller owns the CRDs. |
| `crds-enabled` | The package owns the CRDs for this install. |
| `reuse-existing-secret` | Keep secret material outside the chart render. |
| `server-only` | Run one useful component instead of the whole chart stack. |
| `ha` | Use a reviewed high-availability shape. |
| `internal-service` | Keep the service private to the cluster or platform. |

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
versions. When a user needs another real operating shape, that shape can become
another chart preset.

## What A Chart Preset Records

| Item | Why it matters |
| --- | --- |
| Chart source and version | The upstream input is pinned. |
| Values profile | Reviewers can see which values were used. |
| Release name and namespace | The render can be repeated. |
| Capability profile | Kubernetes API assumptions are explicit. |
| Source lock | The chart and dependencies can be traced. |
| Render intent | The compact machine-readable record of the render inputs. |
| Render variant | The captured Kubernetes objects produced by the chart preset. |
| Installer package OCI ref | The public package address users pull with `cub installer setup --pull oci://...`. |
| Package base | The generated package users can inspect and try. |
| Evidence lanes | The checks, receipts, scans, and live observations for the row. |
| Chart extras | Hooks, CRDs, setup jobs, generated facts, target facts, and other work outside plain YAML. |

For the render-intent layer, see
[Helm Render Intents](./helm-render-intents.md).

## Where Each Setting Lives

There are four places to look:

| Place | What belongs there | How to see what is set now |
| --- | --- | --- |
| Helm values | Choices that change what Helm renders: components, object count or shape, storage mode, CRDs, ingress, Secret strategy, hooks, service exposure, or topology. | Open the base variant's `valuesProfile` link in its `HelmRenderIntent`, then open the rendered YAML it produced. |
| ConfigHub changes | Exact post-render edits when the base is right but an environment, region, customer, policy, image, label, resource, or other object field must differ. | Open the Unit revision history or derived variant. The public catalog base itself has no ConfigHub edits. |
| Install work | Required Secrets, CRDs, target facts, hooks, setup jobs, certificates, cloud accounts, and other work around the objects. | Open the base variant's prerequisites and lifecycle routes. These are not hidden as values or post-render edits. |
| Live cluster | What actually ran. | Compare observations with the reviewed Units. A live-only edit is drift until it is recorded as an intended ConfigHub revision or removed. |

One field should not have two silent owners. If a new Helm render and a
ConfigHub revision both change the same field, review the overlap before
promotion and choose the intended result. The Helm values profile shows one
side; ConfigHub Unit revision history shows the other.

Every generated `HelmRenderIntent` records this split under
`spec.settingSources`. Chart pages and the `readme` Unit in each demo Space
show the same information in plain English.

## What Happens When You Bring Values?

If a values file changes what Helm renders, it belongs in a new or updated chart
preset. That includes choices that change object count, object shape, CRDs,
RBAC, storage, ingress, hooks, service exposure, generated Secrets, or topology.

If a change only fills or refines already-rendered objects after upload, it can
belong in a derived ConfigHub variant. That is the right place for many
environment, target, customer, label, approval, and policy choices.

The rule is:

```text
Changes Helm render inputs or object shape -> chart preset / base variant.
Changes the operating context after render -> derived ConfigHub variant.
Needs a cluster or external system -> target fact, route, setup step, blocker,
or refusal.
```

See [Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md)
for the detailed routing rule.

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
  point. Users should choose from the Helm Ops Catalog pages first.

The goal is practical support for the way Helm is actually used: keep the chart,
choose a useful chart preset, inspect the generated objects, record the extra work,
and keep the result testable as charts and applications change.
