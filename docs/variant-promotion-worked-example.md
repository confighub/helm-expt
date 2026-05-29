# Variant Promotion Worked Example

This is a worked example of promoting a Redis ConfigHub variant. It shows the
same idea through three surfaces:

```text
Human: guided Variant Creator
Agent: structured task with checks and receipts
Function: blueprint mapped over one row or many rows
```

This is about post-render ConfigHub variant promotion. It is not chart catalog
promotion, and it is not a hidden Helm rerender.

## Scenario

We start with a reviewed Redis base:

```text
chart: bitnami/redis@25.5.3
base: default
source variant: redis/default
```

The source has already been rendered, scanned, uploaded, and tested. Now we
want production variants:

```text
redis/prod-us-east
redis/prod-eu-west
```

The promotion should keep the reviewed object set stable unless the user
explicitly chooses a different recipe/package base.

## Human UX

```text
Variant Creator
From: redis/default
Blueprint: Promote to production
Target: prod-us-east
Fill: namespace, Redis secret reference
Preview: 14 Units, 3 changed paths, 1 link changed
Checks: pass
Create
```

The user should not need to understand `VariantCreationPlan` to do this. The
creator asks only for the values needed to make this production variant real.

## What The Blueprint Does

The blueprint tells ConfigHub how to use its existing primitives:

| Step | Primitive | Result |
| --- | --- | --- |
| Clone reviewed source | `variant create` / bulk clone | New prod space with copied Units, links, triggers, permissions, and metadata. |
| Set identity | labels and target metadata | `Variant=prod-us-east`, environment/region labels, target selection. |
| Fill required values | placeholders, parameter Unit, TransformPaths | Namespace and Redis secret reference land in the right paths. |
| Review relationships | links, NeedsProvides, outgoing link review | Cross-Unit bindings are preserved or deliberately changed. |
| Check safety | schema checks, function checks, target facts, gates | No unresolved placeholders, facts satisfied, diff reviewed. |
| Record proof | receipts, MutationSources, scan/apply/observe receipts | The promotion is explainable and repeatable. |

## AX: Agent Task

An agent should receive a structured task, not a loose prompt:

```yaml
task: create_variant
fromSpace: helm-redis-default
blueprint: promote-to-production
parameters:
  environment: prod
  region: us-east
  namespace: redis-prod
  redisSecretRef: redis-existing-secret
requiredChecks:
  - no-unresolved-placeholders
  - target-facts-satisfied
  - unit-diff-reviewed
  - scan-pass-or-approved-exception
expectedReceipts:
  - clone
  - transformPaths
  - functionMutations
  - checks
  - approval
```

The agent experience is deterministic because the task says what to create,
what to check, and which receipts prove the result.

## FX: Fleet Promotion

The same blueprint should also work as a function over a matrix:

```yaml
blueprint: redis-promote-to-production
matrix:
  - environment: prod
    region: us-east
    namespace: redis-prod-use1
    redisSecretRef: redis-existing-secret
  - environment: prod
    region: eu-west
    namespace: redis-prod-euw1
    redisSecretRef: redis-existing-secret
```

Fleet execution:

```text
map VariantBlueprint over matrix
verify each result
summarize fleet receipts
promote in waves
```

## Promotion Rules

Use the Variant Creator when the change is post-render:

```text
target
namespace
labels
links
placeholders
secret references
policy gates
approval state
observation requirements
```

Go back to the recipe/package base path when the change affects rendered
objects:

```text
CRDs on/off
generated Secret vs existing Secret
HA/storage mode
ingress/TLS shape that changes rendered objects
cloud-specific Helm values
anything requiring a new Helm render
```

The rule is simple:

```text
Promote reviewed ConfigHub variants without rerendering.
Rerender only when the install shape changes.
```

## Expected Proof

A completed promotion should leave enough evidence to answer:

```text
What did we clone?
What changed?
Which target facts were used or checked?
Which scans and gates passed?
Who approved it?
What was applied or published?
How fresh is the observation?
```

Minimum proof objects:

```text
clone receipt
unit diff / MutationSources
target-fact or preflight receipt
scan/check receipt
approval receipt
apply/publish receipt
observation receipt when live proof is required
```
