# Variant Creator Contract Verification

This document describes how to verify the
[Variant Creator contract](./variant-creation-artifact.md): the formal product,
agent, and fleet contract for creating post-render ConfigHub variants from a
reviewed base.

The goal is simple:

```text
The same Variant Creator contract should produce the same preview, checks, and
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
Target variant: prod-us-east
Fill: namespace, target, Redis Secret mode
Preview: 15 Units, 3 changed paths, 1 link changed
Checks: pass with carried scan warning
Create
```

This is a Creator UX shape, not proof that a polished GUI flow already exists.
The current `cub variant create` command provides the clone/link substrate; the
full Creator experience still needs porcelain for blueprint selection, preview,
checks, and receipts.

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
| If a choice requires a different Helm render, the request routes back to `cub installer`. | Prevents hidden Helm rerenders in post-render variant creation. |
| Every mutation has a path-level explanation. | Makes "what changed and why" reviewable. |
| Successful runs leave clone, mutation, check, and approval/apply/observation receipts as applicable. | Makes the operation auditable. |
| Failed runs explain the failing check and do not leave a trusted variant. | Keeps failure safe and usable. |

## Formal Contract Checks

The Variant Creator contract should be verified as the machine-readable
underpinning for the UX/AX/FX shape.

It should make these things explicit:

```text
source selector
blueprint name
required fill values
allowed mutations
ConfigHub primitives used
preview contract
required checks
receipt contract
```

Verification should fail if the contract omits one of those concerns, permits
an unexpected mutation, skips preview/checks, or cannot produce receipts.

## UX, AX, And FX Goldens

UX user-led form:

```text
Variant Creator
From: redis/default
Blueprint: Environment clone
Target variant: prod-us-east
Fill: environment=prod, region=us-east, namespace=redis-prod, target=redis-targets/prod-us-east
Preview: 15 Units, 3 changed paths, 1 link changed
Checks: pass with carried Redis scan warning
Create
```

AX agent-based form:

```yaml
task: create_variant
from: redis/default
blueprint: environment-clone
variant: prod-us-east
fill:
  namespace: redis-prod
  target: redis-targets/prod-us-east
  redisSecretMode: preserve-generated-secret-reference
requiredChecks:
  - source-revision-bound
  - no-hidden-helm-rerender
  - unit-count-preserved
  - redis-secret-mode-preserved
  - existing-secret-request-routes-back-to-installer
expectedReceipts:
  - clone
  - mutations
  - checks
  - route-back
```

FX function-based form:

```yaml
from: redis/default
blueprint: environment-clone
rows:
  - target: redis-targets/prod-us-east
    namespace: redis-prod-use1
    redisSecretMode: preserve-generated-secret-reference
  - target: redis-targets/prod-eu-west
    namespace: redis-prod-euw1
    redisSecretMode: preserve-generated-secret-reference
```

The field names may change later. The verification requirement should not:
equivalent inputs must produce equivalent previews, checks, and receipts.

The Redis default base must not silently become the existing-Secret base. A
request to use `redis-existing-secret` routes back to the maintained
`reuse-existing-secret` base or to a new `cub installer` render.

## Generated Goldens

The current generated goldens are:

| Golden | Path | What it proves |
| --- | --- | --- |
| Redis production variant | `data/variant-goldens/redis-prod-us-east/` | `redis/default` can be cloned into `prod-us-east` with preview, checks, and receipts. |
| Managed overlay import | `data/managed-overlay-goldens/external-dns-customer-acme-prod/` | Wrapper chart, platform values, customer overlay values, target facts, and post-render Creator choices are separated before use. |

Verification command:

```sh
npm run variant-goldens:verify
```

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

The current command is:

```sh
npm run variant-goldens:verify
```

It checks:

```text
generated artifact freshness
Redis Creator contract
Redis preview and receipts
managed overlay classification
render boundary checks
UX/AX/FX equivalence
```

Future product implementation should extend the same command or a successor to
cover CLI/API dry-runs, GUI preview data, and tamper failures.

## Acceptance Standard

A Variant Creator contract is not proven when one person creates one variant
once. It is proven when we can show:

```text
same source
same creation pattern
same fill values
same preview
same checks
same receipts
```
