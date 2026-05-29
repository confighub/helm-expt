# Variant Creator: How Variants Get Created

This document explains how ConfigHub variants get created.

The working artifact shape is:

```text
Variant Creator
From: redis/default
Blueprint: Environment clone
Target: prod-us-east
Fill: namespace, Redis secret reference
Preview: 14 Units, 3 changed paths, 1 link changed
Checks: pass
Create
```

Important: **Variant Creator** here means the artifact/proposal shape. It does
not mean we have agreed on a separate GUI that a user opens, a new backend
engine, or a current `cub variant` command.

## Core Doctrine

Every variant should be expressible in three ways of being made:

| Way | Meaning |
| --- | --- |
| UX | The foundational user-led way. A person reviews the source, chooses the creation pattern, fills required values, inspects preview/checks, and creates. |
| AX | The agent-based way. An agent receives the same intent as a structured task with required checks and receipts. |
| FX | The function-based way. A function maps the same creation intent over one row or many rows. |

These are not three different variant models. They are three expressions of the
same variant-making intent:

```text
From + Blueprint + Target + Fill + Preview + Checks + Create
```

## Creation Lifecycle

A variant is created in seven steps.

| Step | What happens | What must be reviewable |
| --- | --- | --- |
| `From` | Select a reviewed source base or variant. | Source Space, source Units, source revision/digest, existing labels and links. |
| `Blueprint` | Select the creation pattern. | Which kind of variant is being made and which changes are allowed. |
| `Target` | Name the downstream variant and, when applicable, choose its target. | Space name/labels, target assignment, environment/region/customer identity. |
| `Fill` | Supply, select, link, or bind required values. | Required inputs, target facts, placeholders, links, field paths. |
| `Preview` | Compute the exact planned changes before writing trusted state. | Unit count, path diffs, label/target/gate changes, link changes. |
| `Checks` | Run required validations and gates. | No unresolved required values, target facts satisfied or deferred, schema/policy checks, diff reviewed. |
| `Create` | Write the downstream ConfigHub state and receipts. | Created Space, cloned Units, upstream links, mutation receipts, check receipts. |

The key property is that `Create` happens after `Preview` and `Checks`, not
before.

## What Gets Created

Creating a variant should create or update ConfigHub state, not rerender Helm.

Expected ConfigHub state:

| ConfigHub object | Purpose |
| --- | --- |
| Downstream Space | The new variant node, such as `prod-us-east`. |
| Space labels | Component and variant identity, such as `Component=Redis`, `Variant=prod-us-east`. |
| Cloned Units | The reviewed source Units copied into the downstream Space. |
| `Unit.UpstreamUnitID` links | Promotion edges from source Units to downstream Units. |
| Target assignment | The deployment/apply destination when the variant is deployable. |
| Gates/checks | Required approval, policy, schema, fact, and diff checks. |
| Receipts | Evidence for clone, fill/mutation, checks, approval/apply/publish/observation as applicable. |

This is why Variant Creator is post-render ConfigHub variant creation.

## Boundary With `cub installer`

There are two different jobs:

| Job | Example | Home |
| --- | --- | --- |
| Change the rendered install shape | generated Secret vs existing Secret, CRDs on/off, HA/storage mode, provider values that change Deployment args/env, wrapper chart overlay values | `cub installer` recipe/package/base |
| Create a downstream operational variant from reviewed Units | target, environment, region, namespace field, labels, gates, fact bindings, approvals, links, receipts | Variant Creator / ConfigHub variant creation |

Rule:

```text
If the choice changes Helm-rendered objects, go through cub installer.
If the choice customizes already-rendered ConfigHub Units, use Variant Creator.
```

This prevents variant creation from hiding a Helm rerender.

## Formal Underpinning

Once the creation shape feels right, it needs a formal underpinning so UX, AX,
and FX all run the same operation.

Working name:

```text
VariantCreationPlan
```

`VariantCreationPlan` should be an internal machine-readable contract for the
Variant Creator artifact. It is not necessarily a public noun.

It should specify:

| Part | Purpose |
| --- | --- |
| source selector | Which base/variant may be used as `From`. |
| blueprint name | Which creation pattern is being used. |
| required fill values | Values, target facts, links, or placeholders that must be supplied or resolved. |
| allowed mutations | Paths, labels, annotations, targets, links, gates, or functions the creation may change. |
| preview contract | The expected diff summary and what must be shown before create. |
| required checks | Validations and gates required before trusted creation. |
| receipt contract | Evidence that must be written after clone, mutation/fill, checks, approval, apply/publish, or observation. |

Possible storage homes:

```text
metadata on the base Space
an AppConfig Unit in the base Space
fields in existing catalog/artifact metadata
a future typed ConfigHub object
```

The product can choose the storage home later. The important thing now is the
shape of creation and the equivalence of UX, AX, and FX.

## UX, AX, And FX Forms

The same `VariantCreationPlan` / Variant Creator artifact should have
equivalent UX, AX, and FX forms.

UX user-led form:

```text
Variant Creator
From: redis/default
Blueprint: Environment clone
Target: prod-us-east
Fill: namespace, Redis secret reference
Preview: 14 Units, 3 changed paths, 1 link changed
Checks: pass
Create
```

AX agent-based form:

```yaml
task: create_variant
from: redis/default
blueprint: environment-clone
target: prod-us-east
fill:
  namespace: redis-prod
  redisSecretRef: redis-existing-secret
requiredChecks:
  - no-unresolved-placeholders
  - target-facts-satisfied
  - unit-diff-reviewed
expectedReceipts:
  - clone
  - mutations
  - checks
```

FX function-based form:

```yaml
function: create_variant
from: redis/default
blueprint: environment-clone
rows:
  - target: prod-us-east
    namespace: redis-prod-use1
    redisSecretRef: redis-existing-secret
  - target: prod-eu-west
    namespace: redis-prod-euw1
    redisSecretRef: redis-existing-secret
```

The exact field names can change. The doctrine should not:

```text
same variant intent
same preview
same checks
same receipts
```

## Target Facts

A created variant can need target facts. The route depends on how the fact is
used.

| Fact use | Correct route |
| --- | --- |
| Fact changes rendered Kubernetes objects | `cub installer` recipe/base render |
| Fact fills or links an already-rendered Unit field | Variant Creator |
| Fact only proves target readiness | Gate or observation receipt |

Examples:

| Fact | Usually means |
| --- | --- |
| Existing Redis Secret reference | Variant Creator if the field already exists; installer base if the rendered Secret model changes. |
| StorageClass or IngressClass | Variant Creator if it is only a field value; installer base if it changes object shape. |
| DNS provider credentials for ExternalDNS | Installer base if it changes args/env/volumes; Variant Creator if it only binds a declared reference. |
| Cluster API or CRD availability | Gate or observation receipt. |

## Kubara Wrapper And Overlay Rule

For Kubara-style managed apps, the import unit is often:

```text
managed wrapper chart
  + platform values
  + customer overlay values
  + dependency closure
  + render context
```

Those inputs belong to the maintained `cub installer` recipe/package when they
affect rendered output.

Variant Creator starts after that reviewed base is uploaded to ConfigHub. It is
for customer, environment, region, target, gate, link, and receipt refinement
of the reviewed object set.

## Where The Examples Go

After we like the creation shape and its formal underpinning, the next step is
to show two examples:

| Example | Purpose |
| --- | --- |
| Redis default -> prod-us-east | Shows a reviewed Helm-derived base becoming a downstream ConfigHub variant. |
| Kubara-style ExternalDNS overlay | Shows wrapper chart plus platform/customer overlay boundaries and target facts. |

The examples should demonstrate the doctrine rather than define it.

See:

- [Variant Promotion Worked Example](variant-promotion-worked-example.md)
- [Kubara Customized Overlay Analysis](kubara-customized-overlays.md)

## Acceptance Checks

A reader should be able to answer:

- How does a variant get created from a reviewed base?
- What happens in `From`, `Blueprint`, `Target`, `Fill`, `Preview`, `Checks`, and `Create`?
- What ConfigHub state is created or updated?
- When does the request go back to `cub installer`?
- How does the same variant get made through UX, AX, and FX?
- What would `VariantCreationPlan` formalize?
- Which receipts prove the result?

## What Not To Claim Yet

Do not claim:

- `cub variant create` exists in the current local CLI;
- a GUI named Variant Creator exists;
- the storage home for `VariantCreationPlan` has been chosen;
- all Kubara apps are imported;
- `cub installer import helm` exists;
- post-render variant creation may rerender Helm invisibly.
