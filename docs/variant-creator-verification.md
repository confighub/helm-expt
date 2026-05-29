# Variant Creator Verification Doctrine

This document explains how we should use invariants, goldens, and verification
to keep the Variant Creator reliable as we build CLI, GUI, API, agent, and fleet
surfaces.

The goal is simple:

```text
The same Variant Blueprint must produce the same safe, reviewable result
whether it is driven by a human, an agent, or a fleet function.
```

## What We Are Testing

The Variant Creator is the guided UX around the `variant create` operation.
The Variant Blueprint is reusable component-author guidance. The
`VariantCreationPlan` is the formal machine-readable plan underneath.

That gives us three surfaces to test continuously:

```text
UX: human wizard
AX: structured agent task
FX: parameterized fleet function
```

They must all follow the same plan, run the same required checks, and produce
comparable receipts.

## Invariants

Invariants are rules that must stay true across every implementation surface.

| Invariant | Why it matters |
| --- | --- |
| Same blueprint, same source, same parameters produce the same planned changes. | Prevents UI, CLI, agent, and fleet drift. |
| Preview happens before create/apply. | Users and agents approve exact changes, not guesses. |
| Changes are limited to blueprint-allowed paths, links, labels, annotations, targets, triggers, and gates. | Prevents hidden broad mutation. |
| No unresolved required placeholders. | Prevents half-created variants. |
| Required target facts are bound, checked, or explicitly deferred with a receipt. | Prevents target-specific non-determinism from being invisible. |
| If a change would alter rendered Kubernetes objects, the workflow goes back to the recipe/package base path. | Prevents hidden Helm rerenders inside post-render variants. |
| Every mutation has a MutationSources-style explanation. | Makes "what changed and why" reviewable. |
| Every successful run leaves receipts for clone, checks, and approval/apply/publish/observe as applicable. | Makes the operation auditable. |
| Failed runs explain the failing check and do not leave a trusted variant. | Keeps failure safe and usable. |
| Human, agent, and fleet paths use the same schema and checks. | Avoids separate mechanisms for UI, AI, and batch operations. |

## Goldens

Goldens are small canonical examples that prove the intended behavior. They
should be committed and reviewed like product fixtures.

The first golden should be Redis:

```text
source: redis/default
blueprint: environment-clone
target: prod-us-east
fill: namespace, Redis secret reference
expected preview: 14 Units, 3 changed paths, 1 link changed
expected checks: pass
expected outcome: created ConfigHub variant with receipts
```

We should keep matching goldens for all three surfaces:

| Surface | Golden artifact |
| --- | --- |
| UX | A short transcript or screenshot flow: choose source, choose blueprint, fill fields, preview, checks, create, receipts. |
| AX | A `create_variant` task YAML plus expected planned changes and receipt list. |
| FX | A matrix YAML plus expected per-row receipts and fleet summary. |

Golden outputs should include:

```text
planned changes
unit diff summary
allowed path list
target-fact bindings/checks
required check results
receipt set
failure examples
```

The goldens are not only for correctness. They are also product UX tests: if
the golden flow feels harder than Helm, the implementation is wrong even if the
backend succeeds.

## Verification Gates

Every Variant Creator implementation lane should add machine checks.

| Layer | Verification |
| --- | --- |
| Plan/schema | `VariantCreationPlan` validates; required fields and supported operations are explicit. |
| CLI | `cub variant create --blueprint ... --dry-run` or equivalent produces the golden preview; bad input exits non-zero with a useful message. |
| GUI | Browser/Playwright flow follows the golden UX and shows source, blueprint, fields, preview, checks, create, and receipts. |
| API/server | Same request produces the same planned changes and receipts as CLI and GUI. |
| Agent | Structured `create_variant` task produces the same plan and check results as the human path. |
| Fleet | Matrix run produces per-row receipts, fleet summary, and wave promotion behavior; one bad row does not silently poison the whole fleet. |
| Tamper tests | Edited blueprint, changed source digest, missing target fact, or unexpected path mutation must fail verification. |

## Redis Golden Checks

The Redis golden should prove:

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

And the same intent as AX:

```yaml
task: create_variant
fromSpace: helm-redis-default
blueprint: environment-clone
parameters:
  environment: prod
  region: us-east
  namespace: redis-prod
  redisSecretRef: redis-existing-secret
requiredChecks:
  - no-unresolved-placeholders
  - target-facts-satisfied
  - unit-diff-reviewed
expectedReceipts:
  - clone
  - transformPaths
  - functionMutations
  - checks
```

And the same intent as FX:

```yaml
blueprint: redis-environment-clone
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

Expected fleet verification:

```text
map VariantBlueprint over matrix
verify each result
summarize fleet receipts
promote in waves
```

## Continuous Test Shape

As the code appears, the repo should grow a dedicated verification command,
for example:

```text
npm run variant-creator:verify
```

That command should eventually check:

```text
schema validity
golden UX transcript metadata
CLI dry-run output
AX task output
FX matrix output
receipt binding
tamper failures
docs freshness
```

Until that command exists, every implementation PR should state which pieces of
this doctrine are covered and which remain manual.

## Acceptance Standard

A Variant Creator feature is not done when it creates a variant once. It is
done when we can prove:

```text
same blueprint
same inputs
same preview
same checks
same receipts
across UX, AX, and FX
```
