# UX Proposal: Redis Secret Modes Tutorial

**UNOFFICIAL/EXPERIMENTAL**

Companion to [Tutorial Sequence](./tutorial-sequence.md).

This is a UX proposal, not a shipped GUI. It uses Creator-style language to
turn the secret-mode decision into a user-facing choice backed by a formal
contract and the current CLI primitives.

## Shared Mapping

All tutorial UX proposals use the same map:

```text
Human: express the desired base, environment, region, customer, delivery, or operation.
CLI: use cub installer for render/base work; use cub variant create for derived ConfigHub variants.
Proof: run checks, gates, and receipts before the change is called ready.
```

## Current CLI Friction

The CLI UX exposes the mechanics:

```text
create namespace
create existing Secret
choose reuse-existing-secret base
render from package
verify render
optionally apply manifests
verify cluster
understand why the Secret object count changed
```

The human question is simpler:

```text
Should Redis create its own Secret, or use one that already exists?
```

## Simpler Human Intent

A Creator-style flow can present:

```text
Choose Secret mode
From: bitnami/redis@25.5.3
For: Redis in namespace redis
Mode: reuse existing Secret
Secret: redis/redis-existing-secret
Key: redis-password
Review: Redis will not render a Secret object
Status: ready when target Secret exists
Create
```

The user should see the difference in product terms:

```text
default
  creates generated Redis Secret

reuse-existing-secret
  expects redis/redis-existing-secret
  renders no Redis Secret
```

## Guardrail

The important guardrail is:

```text
If the Secret mode changes rendered Kubernetes objects,
it is a base variant.

If a reviewed object already has a bindable Secret reference,
the concrete target Secret can be a derived variant input or target fact.
```

Tutorial 2 is a base-variant decision because Helm renders a different object
set.

## Formal Shape

The same choice can be represented as:

```yaml
kind: BaseCreatorContract
from:
  chart: bitnami/redis
  version: 25.5.3
create:
  component: Redis
  variant: reuse-existing-secret
render:
  base: reuse-existing-secret
  namespace: redis
requires:
  targetFacts:
    - kind: Secret
      namespace: redis
      name: redis-existing-secret
      key: redis-password
review:
  renderedDifference:
    - no Redis Secret object is rendered
    - workloads reference redis-existing-secret
checks:
  - helmEquivalentRender
  - targetSecretExists
  - redisPingWhenApplied
receipts:
  - renderReceipt
  - externalRequirementReceipt
```

## Mapping Back To Current Primitives

```text
Creator-style intent = choose the Redis Secret operating mode.
Formal contract = base variant plus target Secret requirement.
cub installer setup = render substrate.
kubectl secret check = target fact proof.
AX/FX = same decision and checks expressed as structured work.
```

The user does not need to start with namespace commands and Secret manifests.
Those are execution details behind the clearer question: generated Secret or
existing Secret.
