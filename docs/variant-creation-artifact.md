# Creating Custom Variants

This document explains how custom ConfigHub variants get created.

## The Starting Point

First we make durable `cub installer` recipes and base variants.

A recipe/package base is the reviewed install shape for a component. It says:

- which chart or wrapper chart was used;
- which values were rendered;
- which Kubernetes objects were produced;
- which facts, checks, and receipts prove the base.

Examples:

```text
redis/default
redis/reuse-existing-secret
external-dns/managed-aws
```

Those bases are important because they are reviewed. They are the trusted
starting point for later variants.

## Why We Need Custom Variants

After a base exists, teams still need real operational variants:

```text
redis/prod-us-east
redis/prod-eu-west
external-dns/customer-acme-prod
```

These variants usually should not rerender Helm. They start from a reviewed
ConfigHub base or from another existing ConfigHub variant, then apply the
differences that are specific to an environment, region, target, or customer.

That is custom variant creation.

Simple version:

```text
Create prod-us-east from redis/default.
```

Before ConfigHub creates it, the user should see:

- the reviewed base that will be copied;
- the new variant name, labels, and target;
- the environment, region, customer, or fact values being supplied;
- the Units, links, gates, and fields that will change;
- the checks that must pass;
- the receipts that will prove what happened.

Then ConfigHub creates the downstream Space, clones the Units, preserves the
promotion links, applies the allowed changes, runs the checks, and records the
receipts.

The rule is: preview first, check first, then create.

## Recipe Base Or Custom Variant?

Use a recipe/package base when the choice changes the rendered Kubernetes
objects.

Use custom variant creation when the choice customizes an already-rendered
ConfigHub object set.

Examples:

- Generated Redis Secret versus existing Redis Secret changes the rendered
  chart shape. That belongs in a recipe/package base.
- Binding the name of an existing Secret can be a custom variant input if the
  reviewed base already has a field for that reference.
- ExternalDNS provider, sources, registry mode, domain filters, and TXT owner
  behavior usually change rendered args or env. Those belong in the installer
  base.
- Target, namespace, labels, approvals, gates, links, and observation policy
  are post-render ConfigHub concerns. Those belong in custom variant creation.

## VariantCreationPlan

The simple story above needs a formal underpinning so every creation path uses
the same rules.

Working name:

```text
VariantCreationPlan
```

`VariantCreationPlan` is not necessarily a public product noun. It is the
machine-readable plan underneath custom variant creation.

The first concrete example is
[redis-variant-creation-plan.yaml](redis-variant-creation-plan.yaml).

It answers:

- which reviewed bases or existing variants can be used as the source;
- what kind of custom variant can be created;
- which values, target facts, links, or placeholders must be filled;
- which paths, labels, annotations, targets, gates, links, or functions may
  change;
- what the preview must show before creation;
- which checks must pass;
- which receipts must be written.

The storage home can be decided later. It might live as metadata on the base
Space, an AppConfig Unit in the base Space, catalog metadata, or a future typed
ConfigHub object.

The important point is that the plan gives ConfigHub one shared contract for
creating the custom variant.

## CLI+UI, AX, And FX

Custom variants should be creatable in three ways:

- CLI+UI: the user-led product experience;
- AX: an agent performs the same creation task;
- FX: a function creates one or many variants from rows of input.

These should not produce three different experiences. They should all get the
user to the same UX: the same source, the same requested variant, the same
preview, the same checks, the same created ConfigHub state, and the same
receipts.

CLI+UI shape:

```text
Create custom variant
From: redis/default
Name: prod-us-east
Target: prod-us-east
Values: namespace, Redis secret reference
Preview: 14 Units, 3 changed paths, 1 link changed
Checks: pass
Create
```

AX shape:

```yaml
task: create_variant
from: redis/default
plan: environment-clone
name: prod-us-east
target: prod-us-east
values:
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

FX shape:

```yaml
function: create_variant
from: redis/default
plan: environment-clone
rows:
  - name: prod-us-east
    target: prod-us-east
    namespace: redis-prod-use1
    redisSecretRef: redis-existing-secret
  - name: prod-eu-west
    target: prod-eu-west
    namespace: redis-prod-euw1
    redisSecretRef: redis-existing-secret
```

The field names can change. The product rule should not: one creation model,
three ways to invoke it.

## Two Important Examples

There are two important examples.

### 1. Promotion

[Variant Promotion Worked Example](variant-promotion-worked-example.md) shows
`redis/default` becoming a downstream `prod-us-east` ConfigHub variant.

This is the straightforward promotion case:

```text
reviewed recipe/package base
  -> custom ConfigHub variant
  -> future base changes can be reviewed and promoted downstream
```

The custom variant does not rerender Redis. It clones the reviewed ConfigHub
Units, gives the downstream Space its production identity, binds the target and
environment-specific values, runs checks, and leaves receipts.

### 2. Kubara Customer Overlays

[Kubara Customized Overlay Analysis](kubara-customized-overlays.md) shows how
a managed app becomes a reviewed base before custom variants are created.

For Kubara-style managed apps, the reviewed base may be:

```text
managed wrapper chart
  + platform values
  + customer overlay values
  + dependency closure
  + render context
```

That example tests a harder boundary. Some customer choices change rendered
Kubernetes objects, so they belong in the maintained `cub installer`
recipe/package. Other customer choices only select target, region, labels,
fact bindings, gates, links, or already-rendered field values, so they belong
in custom ConfigHub variants.

Together, the two examples test the same rule from different directions:

```text
Use installer bases for render-time choices.
Use custom variants for post-render ConfigHub variation.
```
