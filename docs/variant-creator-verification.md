# Variant Creator Artifact Verification

This document describes how to verify the proposed
[Variant Creator artifact](variant-creation-artifact.md) and its formal
underpinning, currently described as `VariantCreationPlan`.

The goal is simple:

```text
The same Variant Creator artifact should produce the same preview, checks, and
receipts whether it is read by a person, an AX agent, a CLI/API flow, or an FX
fleet runner.
```

Doctrine:

```text
UX is the foundational user-led way to make a variant.
AX is the agent-based way to make the same variant.
FX is the function-based way to make the same variant from one row or many rows.
```

Verification exists to prove those three ways stay equivalent.

## Canonical Creation Shape

First golden:

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

This is an artifact shape, not proof that a GUI named Variant Creator or a
current `cub variant` command exists.

The verification target is the creation lifecycle:

```text
From -> Blueprint -> Target -> Fill -> Preview -> Checks -> Create
```

## Invariants

| Invariant | Why it matters |
| --- | --- |
| Same `From`, `Blueprint`, `Target`, and `Fill` values produce the same preview. | Prevents product, agent, and fleet drift. |
| Preview happens before create/apply. | Review is over exact changes, not guesses. |
| Changes stay inside allowed Units, paths, links, labels, annotations, targets, and gates. | Prevents hidden broad mutation. |
| Required fill values are resolved. | Prevents half-created variants. |
| Required target facts are bound, checked, or explicitly deferred with a receipt. | Keeps target-specific assumptions visible. |
| If a choice changes rendered Kubernetes objects, the request routes back to `cub installer`. | Prevents hidden Helm rerenders in post-render variant creation. |
| Every mutation has a path-level explanation. | Makes "what changed and why" reviewable. |
| Successful runs leave clone, mutation, check, and approval/apply/observation receipts as applicable. | Makes the operation auditable. |
| Failed runs explain the failing check and do not leave a trusted variant. | Keeps failure safe and usable. |

## Formal Contract Checks

`VariantCreationPlan` should be verified as the machine-readable underpinning
for the artifact shape.

It should make these things explicit:

```text
source selector
blueprint name
required fill values
allowed mutations
preview contract
required checks
receipt contract
```

Verification should fail if the plan omits one of those concerns, permits an
unexpected mutation, skips preview/checks, or cannot produce receipts.

## UX, AX, And FX Goldens

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

The field names may change later. The verification requirement should not:
equivalent inputs must produce equivalent previews, checks, and receipts.

## Verification Gates

| Layer | Verification |
| --- | --- |
| Artifact/schema | Required fields are present and supported operations are explicit. |
| CLI/API, when available | Dry-run returns the golden preview and rejects bad input with useful errors. |
| UX | User-led flow shows source, creation pattern, fill values, preview, checks, create action, and receipts. |
| AX | Agent task produces the same preview and check results as UX. |
| FX | Function run produces equivalent per-row receipts and a summary; one bad row fails clearly. |
| Tamper tests | Changed source digest, missing target fact, unexpected path mutation, or skipped check fails verification. |

## Continuous Test Shape

As code appears, add a command such as:

```text
npm run variant-creator:verify
```

It should eventually check:

```text
artifact/schema validity
VariantCreationPlan formal contract
golden preview
UX/AX/FX equivalence
receipt binding
tamper failures
docs freshness
```

Until that command exists, implementation PRs should state which parts are
covered and which remain manual.

## Acceptance Standard

A Variant Creator artifact is not proven when it creates one variant once. It
is proven when we can show:

```text
same source
same creation pattern
same fill values
same preview
same checks
same receipts
```
