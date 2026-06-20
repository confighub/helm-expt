# FAQ: Hard Questions Before You Trust The Catalog

**UNOFFICIAL/EXPERIMENTAL**

This page is for a skeptical Helm user, platform engineer, or reviewer. It
answers the questions that should be asked before using the public catalog or
moving a chart into ConfigHub-managed operations.

Questions that still need product work are tracked in
[P1: hard-questions-for-later FAQ backlog](https://github.com/confighub/helm-expt/issues/1001).

## Is this just Helm with extra paperwork?

No. Helm still renders. The catalog turns selected render paths into durable
`cub installer` packages with named bases, exact objects, scans, receipts, live
evidence, and ConfigHub Units when uploaded.

Use direct Helm commands when you only need one render:

```sh
cub helm template
cub helm install
```

Use `cub installer` packages when you want a maintained base with receipts and
proof:

```sh
cub installer setup --pull <package> --base <base>
```

See [Choosing Commands](./choosing-commands.md).

## Do I have to rewrite my charts?

No. The point is to keep using public Helm charts where they are already the
right source, then make selected install paths explicit, reviewable,
variant-aware, and observable.

If the chart needs a better base, the base is produced by changing the Helm
inputs and rerendering through the installer path. If the chart needs an
environment, region, customer, target, gate, or observation refinement after
upload, that belongs in ConfigHub as a derived variant.

See [Why This Exists](./why-this-exists.md) and
[Creating Variants](./creating-variants.md).

## Does it only work for easy charts?

No. Redis teaches the path, but kube-prometheus-stack is the serious chart
example. It exercises CRDs, webhooks, RBAC, generated facts, extension slots,
target prerequisites, upgrades, and live observations.

Render parity is only the baseline. The useful proof is that target facts and
lifecycle prerequisites become explicit, staged, observed, and bounded.

See [Serious Chart Proof](./serious-chart-proof.md).

## What happens to Helm hooks?

Hooks are not treated as ordinary static YAML. A hook or hook-like behavior
must be observed, routed, marked per-target, blocked, or refused.

A known route is not the same as automatic execution. The route tells a human,
agent, or product surface what must happen and who owns it.

See [Chart Hooks: What Happens?](./chart-hooks-what-happens.md) and
[Hook Lifecycle Strategy](./hook-lifecycle-strategy.md).

## Where do Secrets and credentials live?

They should not be hidden inside ConfigHub by accident. The catalog separates
generated Secrets, existing-Secret references, target facts, and runtime Secret
lifecycle where the chart requires that distinction.

For Redis, for example, `default` preserves the generated-Secret install
shape. `reuse-existing-secret` deliberately renders no Redis Secret and
requires the target Secret to exist.

See [Secret Lifecycle](../reference/secret-lifecycle.md), the generated
[Secret Lifecycle data](../../data/secret-lifecycle/summary.md), and
[Target Prerequisites](./target-prerequisites.md).

## What if the cluster is the wrong shape?

Then a green render is not enough. Some charts need CRDs, Secrets, storage
classes, cloud identity, multiple schedulable nodes, API capabilities, or
controller behavior that a generic cluster does not provide.

The catalog should mark those as target prerequisites, target-fit decisions,
watch rows, blocked rows, or per-target routes. Logstash HA needing three
schedulable workers is a good example: the model should say the target shape is
invalid, not pretend the chart failed generically.

See [Target Prerequisites](./target-prerequisites.md) and
[Target Prerequisites Before Rerun](./target-prerequisites-before-rerun.md).

## What if a Helm upgrade caused a production crash?

The model helps by breaking the upgrade into stages:

```text
old render
new render
object diff
blast-radius evidence
lifecycle checks
target prerequisites
gates
rehearsals
receipts
```

That reduces opaque upgrades. It does not promise crash-free production.

See [Helm Upgrade Crash Example](./helm-upgrade-crash-example.md).

## Can I bring my own values files or overlays?

Yes, but the route matters.

If a choice changes Helm inputs or object shape, it belongs in a new installer
base or import path. Examples: CRDs on/off, storage mode, ingress shape,
generated Secret versus existing Secret, wrapper chart values, or extension
slots that render new objects.

If a choice refines an uploaded object set, it belongs in a derived ConfigHub
variant. Examples: target, labels, approval gates, observation policy, links,
or approved post-render field fills.

See [Custom Overlays](./custom-overlays.md), [Creating Variants](./creating-variants.md),
and [Change Routing Before OCI](./change-routing-before-oci.md).

## Can I trust a green GitOps sync?

Not by itself. Sync means the controller accepted the desired state. Workload
convergence, target prerequisites, controller-owned fields, and semantic
parity need separate evidence.

See [Why Synced Is Not Working](./why-synced-is-not-working.md).

## What if I already use Argo, Flux, or KRM?

That is the expected production shape, not a reason to start over. The catalog
separates desired objects, ConfigHub Units, OCI publication, GitOps controller
health, and live workload evidence so those tools can stay in the path without
being mistaken for the whole proof.

Existing apps can be discovered or imported as product work, but the repo must
not claim that every live object has already been converted back into desired
state.

See [Adopting Existing Apps](./adopting-existing-apps.md),
[Generative GitOps Fit](./generative-gitops-fit.md), and
[Verification Lanes](./verification-lanes.md).

## What is free and what needs ConfigHub?

Public catalog browsing, local render checks, and public package setup are
free or low-friction. Private catalogs, teams, approvals, variants,
promotions, fleet operations, and production responsibility are
ConfigHub-managed.

See [Product Support Tiers](./product-support-tiers.md) and the generated
[Journey page](../../site/journey.html).

## What should I do if this breaks on my chart?

Send the public chart and values that expose the problem:

[Problem chart issue template](https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml)

The expected response is a public fixture and one of these outcomes:

| Outcome | Meaning |
| --- | --- |
| pass | The catalog path is updated and the receipt proves the behavior. |
| watch | The main path works, but a target or lifecycle caution remains visible. |
| blocked | A missing prerequisite, runtime failure, or target capability conflict is named. |
| refused | The current model deliberately does not claim support for that path. |

## Where To Check The Current Truth

| Question | Surface |
| --- | --- |
| Can I use this chart now? | [Chart Use Guide](../../data/chart-use-guide/summary.md) |
| What does each cell in the matrix mean? | [Reading The Matrix](./reading-the-matrix.md) |
| What is proven today? | [Current Proof Status](./current-proof-status.md) |
| What do we refuse to claim? | [What We Refuse To Claim](./what-we-refuse-to-claim.md) |
| What are the proof lanes? | [Verification Lanes](./verification-lanes.md) |
| What is the machine-checked claim boundary? | [Claims Register](../../data/claims-register/summary.md) |
| How do I verify it myself? | [Verify It Yourself](./verify-it-yourself.md) |
